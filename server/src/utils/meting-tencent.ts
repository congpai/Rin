import { normalizeMetingResourceId } from "./meting-helpers";

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
