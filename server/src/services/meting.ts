import "../utils/meting-crypto-shim";
import Meting from "@meting/core";
import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { buildMetingAuthToken } from "../utils/meting-auth";
import { formatMetingLyric } from "../utils/meting-lyric";
import {
  isHttpUrl,
  normalizeMetingResourceId,
  resolveMetingBaseUrl,
  resolveUpstreamApiUrl,
  tryResolveMetingUpstreamUrl,
} from "../utils/meting-helpers";
import { applyMetingUserCookie } from "../utils/meting-cookie";
import {
  fetchInjahowLyric,
  fetchInjahowMetingList,
  fetchInjahowRedirectUrl,
  mapInjahowTracksToApiResponse,
  shouldUseInjahowFallback,
} from "../utils/meting-injahow";
import { resolveTencentResourceId } from "../utils/meting-tencent";
import {
  resolveMetingPlayUrl,
} from "../utils/meting-stream";

const VALID_SERVERS = new Set(["netease", "tencent", "kugou", "baidu", "kuwo"]);
const VALID_TYPES = new Set(["song", "album", "search", "artist", "playlist", "lrc", "url", "pic"]);
const AUTH_TYPES = new Set(["lrc", "url", "pic"]);
const METING_METHODS = {
  search: "search",
  song: "song",
  album: "album",
  artist: "artist",
  playlist: "playlist",
  lrc: "lyric",
  url: "url",
  pic: "pic",
} as const;

type MetingSong = {
  name: string;
  artist: string[];
  url_id: string;
  pic_id: string;
  lyric_id: string;
};

type MetingUrlResult = {
  url?: string;
};

type MetingLyricResult = {
  lyric?: string;
  tlyric?: string;
};

type CacheEntry = {
  expiresAt: number;
  data: unknown;
};

const metingCache = new Map<string, CacheEntry>();

function getCachedValue(key: string) {
  const entry = metingCache.get(key);
  if (!entry) {
    return undefined;
  }
  if (entry.expiresAt <= Date.now()) {
    metingCache.delete(key);
    return undefined;
  }
  return entry.data;
}

function setCachedValue(key: string, data: unknown, ttlMs: number) {
  metingCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

function getMetingToken(c: AppContext) {
  const serverConfig = c.get("serverConfig");
  return String(serverConfig.get("meting.token") ?? "token");
}

function createMetingInstance(c: AppContext, server: string) {
  const serverConfig = c.get("serverConfig");
  const meting = new Meting(server);
  meting.format(true);

  const cookieKey = server === "netease"
    ? "meting.cookie_netease"
    : server === "tencent"
      ? "meting.cookie_tencent"
      : "";
  if (cookieKey) {
    const cookie = String(serverConfig.get(cookieKey) ?? "").trim();
    if (cookie) {
      applyMetingUserCookie(meting, cookie, server);
    }
  }

  return meting;
}

async function proxyUpstreamMetingApi(c: AppContext, upstreamBase: string) {
  const requestUrl = new URL(c.req.url);
  const target = new URL(resolveUpstreamApiUrl(upstreamBase));
  target.search = requestUrl.search;
  const response = await fetch(target.toString(), {
    headers: {
      accept: c.req.header("accept") ?? "*/*",
      referer: c.req.header("referer") ?? "",
    },
    redirect: "manual",
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

async function buildMetingApiResponse(c: AppContext) {
  const serverConfig = c.get("serverConfig");
  const upstreamRaw = String(serverConfig.get("meting.upstream_url") ?? "").trim();
  const upstreamBase = tryResolveMetingUpstreamUrl(upstreamRaw, c);
  if (upstreamBase) {
    return proxyUpstreamMetingApi(c, upstreamBase);
  }

  const requestUrl = new URL(c.req.url);
  const server = requestUrl.searchParams.get("server") ?? "netease";
  const type = requestUrl.searchParams.get("type") ?? "search";
  const rawId = requestUrl.searchParams.get("id") ?? "hello";
  const id = server === "tencent"
    ? await resolveTencentResourceId(rawId, type)
    : normalizeMetingResourceId(rawId);
  const token = requestUrl.searchParams.get("token") ?? requestUrl.searchParams.get("auth") ?? "token";

  if (!VALID_SERVERS.has(server)) {
    return c.json({ message: "server 参数不合法" }, 400);
  }
  if (!VALID_TYPES.has(type)) {
    return c.json({ message: "type 参数不合法" }, 400);
  }
  if (!id) {
    return c.json({ message: "id 参数不能为空" }, 400);
  }

  const metingToken = getMetingToken(c);
  if (AUTH_TYPES.has(type)) {
    const expected = await buildMetingAuthToken(metingToken, server, type, id);
    if (expected !== token) {
      return c.json({ message: "鉴权失败,非法调用" }, 401);
    }
  }

  if (type === "url") {
    const cookieKey = server === "netease"
      ? "meting.cookie_netease"
      : server === "tencent"
        ? "meting.cookie_tencent"
        : "";
    const userCookie = cookieKey
      ? String(serverConfig.get(cookieKey) ?? "").trim()
      : "";
    const streamCacheKey = `${server}/stream/${id}${userCookie ? "/auth" : ""}`;
    let streamUrl = getCachedValue(streamCacheKey) as string | undefined;
    if (!streamUrl) {
      const meting = createMetingInstance(c, server);
      streamUrl = await resolveMetingPlayUrl(server, id, meting, {
        preferHighQuality: Boolean(userCookie),
      });
      if (streamUrl) {
        setCachedValue(streamCacheKey, streamUrl, 1000 * 60 * 10);
      }
    }

    if (!streamUrl || !isHttpUrl(streamUrl)) {
      return c.json({
        message: server === "tencent"
          ? "无法获取 QQ 音乐播放地址，请检查歌单/歌曲 ID 或 Cookie"
          : "无法获取播放地址，请检查 Cookie 是否有效，或稍后重试",
      }, 404);
    }

    return c.redirect(streamUrl, 302);
  }

  const cacheKey = `${server}/${type}/${id}`;
  let data = getCachedValue(cacheKey);
  if (Array.isArray(data) && data.length === 0 && shouldUseInjahowFallback(server)) {
    data = undefined;
  }
  if (data === undefined) {
    const meting = createMetingInstance(c, server);

    const method = METING_METHODS[type as keyof typeof METING_METHODS];
    let response = "";
    try {
      response = await meting[method](id);
    } catch (error) {
      if (!shouldUseInjahowFallback(server)) {
        const message = error instanceof Error ? error.message : "上游 API 调用失败";
        return c.json({ message }, 500);
      }
      response = "[]";
    }

    try {
      data = JSON.parse(response);
    } catch {
      if (shouldUseInjahowFallback(server)) {
        data = [];
      } else {
        return c.json({ message: "上游 API 返回格式异常" }, 500);
      }
    }

    if (shouldUseInjahowFallback(server) && Array.isArray(data) && data.length === 0) {
      const injahowTracks = await fetchInjahowMetingList(server, type, id);
      if (injahowTracks) {
        return c.json(await mapInjahowTracksToApiResponse(c, server, injahowTracks, metingToken));
      }
      return c.json({
        message: server === "tencent"
          ? "QQ 音乐歌单/歌曲解析失败，请确认 ID 或粘贴 QQ 音乐分享链接"
          : "无法解析该平台歌单或歌曲",
      }, 404);
    }

    setCachedValue(
      cacheKey,
      data,
      1000 * 60 * 60,
    );
  }

  if (type === "pic") {
    let url = String((data as MetingUrlResult).url ?? "").trim();
    if (!isHttpUrl(url) && shouldUseInjahowFallback(server)) {
      url = String(await fetchInjahowRedirectUrl(server, "pic", id) ?? "").trim();
    }
    if (!isHttpUrl(url)) {
      return c.body(null, 404);
    }
    return c.redirect(url, 302);
  }

  if (type === "lrc") {
    const lyricData = data as MetingLyricResult;
    let lyric = lyricData.lyric ?? "";
    let tlyric = lyricData.tlyric ?? "";
    if (!lyric && shouldUseInjahowFallback(server)) {
      lyric = await fetchInjahowLyric(server, id);
    }
    return c.text(formatMetingLyric(lyric, tlyric), 200, {
      "Content-Type": "text/plain; charset=utf-8",
    });
  }

  const baseUrl = resolveMetingBaseUrl(c);
  const songs = (Array.isArray(data) ? data : [data]) as MetingSong[];
  const payload = await Promise.all(songs.map(async (song) => {
    const urlAuth = await buildMetingAuthToken(metingToken, server, "url", song.url_id);
    const picAuth = await buildMetingAuthToken(metingToken, server, "pic", song.pic_id);
    const lrcAuth = await buildMetingAuthToken(metingToken, server, "lrc", song.lyric_id);
    return {
      title: song.name,
      author: song.artist.join(" / "),
      url: `${baseUrl}/api?server=${server}&type=url&id=${encodeURIComponent(song.url_id)}&auth=${urlAuth}`,
      pic: `${baseUrl}/api?server=${server}&type=pic&id=${encodeURIComponent(song.pic_id)}&auth=${picAuth}`,
      lrc: `${baseUrl}/api?server=${server}&type=lrc&id=${encodeURIComponent(song.lyric_id)}&auth=${lrcAuth}`,
    };
  }));

  return c.json(payload);
}

export function MetingService(): Hono {
  const app = new Hono();

  app.get("/api", async (c: AppContext) => {
    try {
      return await buildMetingApiResponse(c);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Meting API failed";
      return c.json({ message }, 500);
    }
  });
  app.options("/api", (c) => c.body(null, 204));

  return app;
}
