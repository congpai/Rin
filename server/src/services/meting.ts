import Meting from "@meting/core";
import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { buildMetingAuthToken } from "../utils/meting-auth";
import { formatMetingLyric } from "../utils/meting-lyric";
import {
  isHttpUrl,
  normalizeMetingResourceId,
  normalizeStreamUrl,
  resolveMetingBaseUrl,
  resolveOptionalHttpUrl,
} from "../utils/meting-helpers";

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

async function proxyUpstreamMetingApi(c: AppContext, upstreamBase: string) {
  const requestUrl = new URL(c.req.url);
  const target = new URL(`${upstreamBase}/api`);
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
  if (upstreamRaw) {
    const upstreamBase = resolveOptionalHttpUrl(upstreamRaw, "Meting upstream URL");
    return proxyUpstreamMetingApi(c, upstreamBase);
  }

  const requestUrl = new URL(c.req.url);
  const server = requestUrl.searchParams.get("server") ?? "netease";
  const type = requestUrl.searchParams.get("type") ?? "search";
  const rawId = requestUrl.searchParams.get("id") ?? "hello";
  const id = normalizeMetingResourceId(rawId);
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

  const cacheKey = `${server}/${type}/${id}`;
  let data = getCachedValue(cacheKey);
  if (data === undefined) {
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
        meting.cookie(cookie);
      }
    }

    const method = METING_METHODS[type as keyof typeof METING_METHODS];
    let response: string;
    try {
      response = await meting[method](id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "上游 API 调用失败";
      return c.json({ message }, 500);
    }

    try {
      data = JSON.parse(response);
    } catch {
      return c.json({ message: "上游 API 返回格式异常" }, 500);
    }

    setCachedValue(
      cacheKey,
      data,
      type === "url" ? 1000 * 60 * 10 : 1000 * 60 * 60,
    );
  }

  if (type === "url") {
    const url = normalizeStreamUrl(server, String((data as MetingUrlResult).url ?? ""));
    if (!isHttpUrl(url)) {
      return c.body(null, 404);
    }
    return c.redirect(url, 302);
  }

  if (type === "pic") {
    const url = String((data as MetingUrlResult).url ?? "").trim();
    if (!isHttpUrl(url)) {
      return c.body(null, 404);
    }
    return c.redirect(url, 302);
  }

  if (type === "lrc") {
    const lyricData = data as MetingLyricResult;
    return c.text(formatMetingLyric(lyricData.lyric ?? "", lyricData.tlyric ?? ""), 200, {
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
