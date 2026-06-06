import type { AppContext } from "../core/hono-types";
import { buildMetingAuthToken } from "./meting-auth";
import { resolveMetingBaseUrl } from "./meting-helpers";

const INJAHOW_METING_BASE = "https://api.injahow.cn/meting";

export type InjahowTrack = {
  name: string;
  artist: string;
  url: string;
  pic: string;
  lrc: string;
};

export function extractInjahowResourceId(injahowUrl: string) {
  try {
    return new URL(injahowUrl).searchParams.get("id") ?? "";
  } catch {
    return "";
  }
}

export async function fetchInjahowMetingList(server: string, type: string, id: string) {
  const target = `${INJAHOW_METING_BASE}/?server=${encodeURIComponent(server)}&type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;
  const response = await fetch(target);
  if (!response.ok) {
    return null;
  }

  const raw = await response.text().catch(() => "");
  if (!raw) {
    return null;
  }

  try {
    const payload = JSON.parse(raw) as InjahowTrack[] | { error?: string };
    if (!Array.isArray(payload)) {
      return null;
    }
    if (payload.length === 0) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function fetchInjahowRedirectUrl(server: string, type: string, id: string) {
  const target = `${INJAHOW_METING_BASE}/?server=${encodeURIComponent(server)}&type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;
  const response = await fetch(target, { redirect: "manual" });
  if (response.status >= 300 && response.status < 400) {
    return response.headers.get("location");
  }
  return null;
}

export async function fetchInjahowLyric(server: string, id: string) {
  const target = `${INJAHOW_METING_BASE}/?server=${encodeURIComponent(server)}&type=lrc&id=${encodeURIComponent(id)}`;
  const response = await fetch(target);
  if (!response.ok) {
    return "";
  }
  return response.text().catch(() => "");
}

export async function mapInjahowTracksToApiResponse(
  c: AppContext,
  server: string,
  tracks: InjahowTrack[],
  metingToken: string,
) {
  const baseUrl = resolveMetingBaseUrl(c);
  return Promise.all(tracks.map(async (track) => {
    const urlId = extractInjahowResourceId(track.url);
    const picId = extractInjahowResourceId(track.pic);
    const lrcId = extractInjahowResourceId(track.lrc) || urlId;
    const urlAuth = await buildMetingAuthToken(metingToken, server, "url", urlId);
    const picAuth = await buildMetingAuthToken(metingToken, server, "pic", picId);
    const lrcAuth = await buildMetingAuthToken(metingToken, server, "lrc", lrcId);
    return {
      title: track.name,
      author: track.artist,
      url: `${baseUrl}/api?server=${server}&type=url&id=${encodeURIComponent(urlId)}&auth=${urlAuth}`,
      pic: `${baseUrl}/api?server=${server}&type=pic&id=${encodeURIComponent(picId)}&auth=${picAuth}`,
      lrc: `${baseUrl}/api?server=${server}&type=lrc&id=${encodeURIComponent(lrcId)}&auth=${lrcAuth}`,
    };
  }));
}

export function shouldUseInjahowFallback(server: string) {
  return server === "tencent" || server === "kugou" || server === "baidu" || server === "kuwo";
}
