import { isHttpUrl, normalizeMetingResourceId, normalizeStreamUrl } from "./meting-helpers";

const QQ_SONG_DETAIL_API = "https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg";

type QqSongDetailResponse = {
  code?: number;
  data?: Array<{ mid?: string }>;
};

function looksLikeUrl(input: string) {
  return input.includes("://") || input.startsWith("//");
}

function looksLikeTencentShareUrl(input: string) {
  return /(?:^|\/\/)(?:[\w-]+\.)*y\.qq\.com/i.test(input)
    || /(?:^|\/\/)(?:[\w-]+\.)*qq\.com\/base\/fcgi-bin\/u/i.test(input);
}

export function isTencentSongShareUrl(input: string) {
  return /\/songDetail\/\d+/i.test(input)
    || /[?&#]songid=/i.test(input)
    || /\/playsong\.html/i.test(input)
    || /\/song\/\d+/i.test(input);
}

export async function followShareRedirects(rawUrl: string, maxHops = 5) {
  let current = rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl;

  for (let hop = 0; hop < maxHops; hop += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        break;
      }
      current = new URL(location, current).toString();
      continue;
    }

    break;
  }

  return current;
}

export async function fetchTencentSongMidFromSongId(songId: string) {
  const target = `${QQ_SONG_DETAIL_API}?songid=${encodeURIComponent(songId)}&format=json`;
  const response = await fetch(target, {
    headers: {
      Referer: "https://y.qq.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null) as QqSongDetailResponse | null;
  const mid = payload?.data?.[0]?.mid?.trim();
  return mid || null;
}

function shouldConvertTencentSongId(type: string, rawInput: string, normalizedId: string) {
  if (!/^\d+$/.test(normalizedId)) {
    return false;
  }

  if (type === "song") {
    return true;
  }

  return isTencentSongShareUrl(rawInput);
}

export async function resolveTencentResourceId(rawId: string, type: string) {
  let input = rawId.trim();
  if (!input) {
    return input;
  }

  if (looksLikeUrl(input) && looksLikeTencentShareUrl(input)) {
    input = await followShareRedirects(input);
  }

  const normalizedId = normalizeMetingResourceId(input);
  if (!shouldConvertTencentSongId(type, input, normalizedId)) {
    return normalizedId;
  }

  const songMid = await fetchTencentSongMidFromSongId(normalizedId);
  return songMid ?? normalizedId;
}

type TencentVkeyResponse = {
  req?: {
    data?: {
      sip?: string[];
      midurlinfo?: Array<{
        purl?: string;
      }>;
    };
  };
};

export function readTencentUin(userCookie?: string) {
  if (!userCookie?.trim()) {
    return "0";
  }

  const match = userCookie.match(/(?:^|;\s*)uin=([^;]+)/i);
  if (!match?.[1]) {
    return "0";
  }

  const decoded = decodeURIComponent(match[1]).trim();
  return decoded.replace(/^o0*/i, "") || "0";
}

export async function fetchTencentPlayUrl(songMid: string, userCookie?: string) {
  const mid = songMid.trim();
  if (!mid) {
    return "";
  }

  const uin = readTencentUin(userCookie);
  const payload = {
    req: {
      module: "vkey.GetVkeyServer",
      method: "CgiGetVkey",
      param: {
        guid: "10000",
        g_uin: Number(uin) || 0,
        songmid: [mid],
        songtype: [0],
        uin: String(uin),
        loginflag: 1,
        platform: "20",
      },
    },
  };

  const headers: Record<string, string> = {
    Referer: "https://y.qq.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  if (userCookie?.trim()) {
    headers.Cookie = userCookie.trim();
  }

  const response = await fetch(
    `https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=${encodeURIComponent(JSON.stringify(payload))}`,
    { headers },
  );
  if (!response.ok) {
    return "";
  }

  const data = await response.json().catch(() => null) as TencentVkeyResponse | null;
  const info = data?.req?.data?.midurlinfo?.[0];
  const purl = info?.purl?.trim();
  if (!purl) {
    return "";
  }

  const sip = data?.req?.data?.sip?.[0]?.trim() || "https://dl.stream.qqmusic.qq.com/";
  const url = normalizeStreamUrl("tencent", `${sip}${purl}`);
  return isHttpUrl(url) ? url : "";
}
