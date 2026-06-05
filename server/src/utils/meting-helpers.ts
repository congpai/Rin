import type { AppContext } from "../core/hono-types";

export function normalizeMetingResourceId(rawId: string) {
  const id = rawId.trim();
  if (!id) {
    return id;
  }

  const hashOrQueryMatch = id.match(/[?&#]id=([^&#]+)/i);
  if (hashOrQueryMatch?.[1]) {
    return decodeURIComponent(hashOrQueryMatch[1]).trim();
  }

  const songMidMatch = id.match(/[?&#]songmid=([^&#]+)/i);
  if (songMidMatch?.[1]) {
    return decodeURIComponent(songMidMatch[1]).trim();
  }

  if (id.includes("://") || id.startsWith("//")) {
    try {
      const parsed = new URL(id.startsWith("//") ? `https:${id}` : id);
      const queryId = parsed.searchParams.get("id") ?? parsed.searchParams.get("songmid");
      if (queryId) {
        return queryId.trim();
      }
      const pathMatch = parsed.pathname.match(/\/(\d+)(?:\/|$)/);
      if (pathMatch?.[1]) {
        return pathMatch[1];
      }
    } catch {
      // fall through to raw id
    }
  }

  return id;
}

export function resolveMetingBaseUrl(c: AppContext) {
  const forwardedHost = c.req.header("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || c.req.header("host")?.trim();
  const forwardedProto = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim();

  try {
    const requestUrl = new URL(c.req.url);
    const protocol = forwardedProto || requestUrl.protocol.replace(":", "") || "https";
    const hostname = host || requestUrl.host;
    if (!hostname) {
      throw new Error("Missing host");
    }
    return `${protocol}://${hostname}/api/meting`;
  } catch {
    if (host) {
      const protocol = forwardedProto || "https";
      return `${protocol}://${host}/api/meting`;
    }
    throw new Error("Unable to resolve Meting API base URL");
  }
}

export function resolveOptionalHttpUrl(rawValue: string, label: string) {
  const value = rawValue.trim();
  if (!value) {
    return "";
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`${label} must use http or https`);
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${label} is invalid`);
  }
}

export function normalizeStreamUrl(server: string, rawUrl: string) {
  const url = rawUrl.trim();
  if (!url) {
    return "";
  }

  let normalized = url;
  if (server === "netease") {
    normalized = url
      .replace("://m7c.", "://m7.")
      .replace("://m8c.", "://m8.")
      .replace("http://", "https://");
    if (normalized.includes("vuutv=")) {
      try {
        const tempUrl = new URL(normalized);
        tempUrl.search = "";
        normalized = tempUrl.toString();
      } catch {
        return normalized;
      }
    }
    return normalized;
  }
  if (server === "tencent") {
    return url
      .replace("http://", "https://")
      .replace("://ws.stream.qqmusic.qq.com", "://dl.stream.qqmusic.qq.com");
  }
  if (server === "baidu") {
    return url.replace(
      "http://zhangmenshiting.qianqian.com",
      "https://gss3.baidu.com/y0s1hSulBw92lNKgpU_Z2jR7b2w6buu",
    );
  }
  return normalized;
}

export function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
