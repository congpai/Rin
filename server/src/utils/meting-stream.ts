import type Meting from "@meting/core";
import { mergeNeteaseCookies } from "./meting-cookie";
import { isHttpUrl, normalizeStreamUrl } from "./meting-helpers";

const INJAHOW_METING_BASE = "https://api.injahow.cn/meting";

type MetingUrlResult = {
  url?: string;
  size?: number;
  br?: number;
};

type MetingInstance = InstanceType<typeof Meting>;

const PREVIEW_SIZE_BYTES = 700_000;

async function readMetingUrlResponse(server: string, response: string) {
  try {
    const data = JSON.parse(response) as MetingUrlResult;
    const url = normalizeStreamUrl(server, String(data.url ?? ""));
    if (!isHttpUrl(url)) {
      return null;
    }
    return {
      url,
      size: Number(data.size ?? 0),
      br: Number(data.br ?? 0),
    };
  } catch {
    return null;
  }
}

export async function fetchMetingUrlFromProvider(
  server: string,
  meting: MetingInstance,
  id: string,
  options?: { preferHighQuality?: boolean },
) {
  const bitrates = options?.preferHighQuality
    ? [999, 320, 128]
    : [320, 128];

  let bestCandidate: { url: string; size: number; br: number } | null = null;

  for (const bitrate of bitrates) {
    const response = await meting.url(id, bitrate);
    const candidate = await readMetingUrlResponse(server, response);
    if (!candidate) {
      continue;
    }

    if (!bestCandidate || candidate.size > bestCandidate.size) {
      bestCandidate = candidate;
    }

    if (options?.preferHighQuality && candidate.size >= PREVIEW_SIZE_BYTES) {
      return candidate.url;
    }
  }

  if (bestCandidate && (!options?.preferHighQuality || bestCandidate.size > 0)) {
    return bestCandidate.url;
  }

  return "";
}

type MetingUrlPayload = MetingUrlResult | { data?: MetingUrlResult };

function readUrlFromPayload(payload: MetingUrlPayload) {
  if ("url" in payload && payload.url) {
    return payload.url;
  }
  if ("data" in payload && payload.data?.url) {
    return payload.data.url;
  }
  return "";
}

export async function fetchInjahowPlayUrl(server: string, id: string) {
  const target = `${INJAHOW_METING_BASE}/?server=${encodeURIComponent(server)}&type=url&id=${encodeURIComponent(id)}`;
  const response = await fetch(target, { redirect: "manual" });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location") ?? "";
    const url = normalizeStreamUrl(server, location);
    return isHttpUrl(url) ? url : "";
  }

  const raw = await response.text().catch(() => "");
  if (!raw) {
    return "";
  }

  try {
    const payload = JSON.parse(raw) as MetingUrlPayload;
    const url = normalizeStreamUrl(server, String(readUrlFromPayload(payload)));
    return isHttpUrl(url) ? url : "";
  } catch {
    return "";
  }
}

export async function resolveMetingPlayUrl(
  server: string,
  id: string,
  meting: MetingInstance,
  options?: { preferHighQuality?: boolean },
) {
  const directUrl = await fetchMetingUrlFromProvider(server, meting, id, {
    preferHighQuality: options?.preferHighQuality,
  });
  if (directUrl) {
    return directUrl;
  }

  if (server === "netease") {
    return fetchInjahowPlayUrl(server, id);
  }

  return "";
}

export function buildStreamReferer(server: string) {
  switch (server) {
    case "netease":
      return "https://music.163.com/";
    case "tencent":
      return "https://y.qq.com/";
    case "kugou":
      return "https://www.kugou.com/";
    case "baidu":
      return "https://music.baidu.com/";
    case "kuwo":
      return "https://www.kuwo.cn/";
    default:
      return "";
  }
}

export async function proxyAudioStream(
  server: string,
  streamUrl: string,
  rangeHeader?: string | null,
  userCookie?: string,
) {
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  const referer = buildStreamReferer(server);
  if (referer) {
    headers.Referer = referer;
  }
  if (server === "netease" && userCookie?.trim()) {
    headers.Cookie = mergeNeteaseCookies("", userCookie.trim());
  }
  if (rangeHeader) {
    headers.Range = rangeHeader;
  }

  const upstream = await fetch(streamUrl, {
    headers,
    redirect: "follow",
  });

  if (!upstream.ok) {
    return upstream;
  }

  const responseHeaders = new Headers();
  responseHeaders.set(
    "Content-Type",
    upstream.headers.get("Content-Type") ?? "audio/mpeg",
  );
  responseHeaders.set(
    "Accept-Ranges",
    upstream.headers.get("Accept-Ranges") ?? "bytes",
  );

  const contentLength = upstream.headers.get("Content-Length");
  if (contentLength) {
    responseHeaders.set("Content-Length", contentLength);
  }

  const contentRange = upstream.headers.get("Content-Range");
  if (contentRange) {
    responseHeaders.set("Content-Range", contentRange);
  }

  responseHeaders.set("Cache-Control", "private, max-age=600");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
