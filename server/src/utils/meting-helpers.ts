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

export function resolveRequestOrigin(c: AppContext) {
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
    return `${protocol}://${hostname}`;
  } catch {
    if (host) {
      const protocol = forwardedProto || "https";
      return `${protocol}://${host}`;
    }
    throw new Error("Unable to resolve request origin");
  }
}

function isBuiltInMetingPath(pathname: string) {
  const path = pathname.replace(/\/$/, "") || "/";
  return path === "/api/meting" || path.startsWith("/api/meting/");
}

export function sanitizeMetingUpstreamInput(rawValue: string) {
  return rawValue
    .trim()
    .replace(/\r?\n/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/^['"]+|['"]+$/g, "")
    .replace(/\uFF1A/g, ":")
    .replace(/\uFF0F/g, "/");
}

export function normalizeMetingUpstreamUrl(rawValue: string, c?: AppContext) {
  let value = sanitizeMetingUpstreamInput(rawValue);
  if (!value || /^(null|undefined|none|n\/a)$/i.test(value)) {
    return "";
  }

  if (value.startsWith("/")) {
    if (isBuiltInMetingPath(value)) {
      return "";
    }
    if (!c) {
      return "";
    }
    value = `${resolveRequestOrigin(c)}${value}`;
  }

  if (value.startsWith("//")) {
    value = `https:${value}`;
  } else if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    value = `https://${value}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Meting upstream URL is invalid");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Meting upstream URL must use http or https");
  }

  parsed.search = "";
  parsed.hash = "";

  let pathname = parsed.pathname.replace(/\/$/, "");
  if (pathname.endsWith("/api/meting/api")) {
    pathname = pathname.slice(0, -4);
  }

  const normalized = `${parsed.origin}${pathname}`;

  if (c) {
    try {
      const builtInBase = resolveMetingBaseUrl(c);
      const builtInUrl = new URL(builtInBase);
      const upstreamUrl = new URL(normalized);
      if (
        builtInUrl.origin === upstreamUrl.origin
        && isBuiltInMetingPath(upstreamUrl.pathname)
      ) {
        return "";
      }
    } catch {
      // fall through
    }
  }

  return normalized;
}

export function tryResolveMetingUpstreamUrl(rawValue: string, c: AppContext) {
  try {
    return normalizeMetingUpstreamUrl(rawValue, c);
  } catch (error) {
    console.warn(
      "Invalid meting.upstream_url, falling back to built-in Meting API:",
      error instanceof Error ? error.message : rawValue,
    );
    return "";
  }
}

export function resolveUpstreamApiUrl(upstreamBase: string) {
  const base = upstreamBase.replace(/\/$/, "");
  if (base.endsWith("/api/meting")) {
    return `${base}/api`;
  }
  if (base.endsWith("/api")) {
    return base;
  }
  if (/\/meting$/i.test(base)) {
    return base;
  }
  return `${base}/api`;
}

export function normalizeStreamUrl(server: string, rawUrl: string) {
  const url = rawUrl.trim();
  if (!url) {
    return "";
  }

  let normalized = url;
  if (server === "netease") {
    return url
      .replace("://m7c.", "://m7.")
      .replace("://m8c.", "://m8.")
      .replace("http://", "https://");
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
