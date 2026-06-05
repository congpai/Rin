import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ClientConfigContext, defaultClientConfig } from "../state/config";
import {
  normalizeMusicSource,
  parseCustomMusicTracks,
} from "../utils/music-config";
import { normalizeMusicResourceId } from "../utils/music-api";
import { MUSIC_SERVERS, MUSIC_TYPES } from "./useSiteConfig";

function parseBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value === "true" || value === "1";
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return fallback;
}

function readConfigValue(config: Record<string, unknown>, key: string) {
  const value = config[key];
  if (value !== undefined && value !== "") {
    return value;
  }
  if (defaultClientConfig.has(key)) {
    return defaultClientConfig.get(key);
  }
  return undefined;
}

export function useMusicPlayerConfig() {
  const contextConfig = useContext(ClientConfigContext);
  const [remoteConfig, setRemoteConfig] = useState<Record<string, unknown> | null>(null);

  const refreshRemoteConfig = useCallback(async () => {
    try {
      const response = await fetch("/api/config/client", {
        credentials: "same-origin",
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json() as Record<string, unknown>;
      setRemoteConfig(data);
      sessionStorage.setItem("config", JSON.stringify({
        ...JSON.parse(sessionStorage.getItem("config") || "{}"),
        ...data,
      }));
      (globalThis as typeof globalThis & { __RIN_CLIENT_CONFIG__?: Record<string, unknown> }).__RIN_CLIENT_CONFIG__ = {
        ...(globalThis as typeof globalThis & { __RIN_CLIENT_CONFIG__?: Record<string, unknown> }).__RIN_CLIENT_CONFIG__,
        ...data,
      };
    } catch {
      // ignore network errors; fall back to bootstrap/session config
    }
  }, []);

  useEffect(() => {
    void refreshRemoteConfig();
    const handleRefresh = () => {
      void refreshRemoteConfig();
    };
    window.addEventListener("rin:config-updated", handleRefresh);
    window.addEventListener("storage", handleRefresh);
    return () => {
      window.removeEventListener("rin:config-updated", handleRefresh);
      window.removeEventListener("storage", handleRefresh);
    };
  }, [refreshRemoteConfig]);

  const mergedConfig = useMemo(() => {
    const contextEntries = Object.fromEntries(
      Array.from(defaultClientConfig.keys()).map((key) => [key, contextConfig.get(key)]),
    );
    return {
      ...contextEntries,
      ...(remoteConfig ?? {}),
    };
  }, [contextConfig, remoteConfig]);

  const musicEnabled = parseBoolean(readConfigValue(mergedConfig, "music.enabled"));
  const musicSource = normalizeMusicSource(readConfigValue(mergedConfig, "music.source"));
  const musicServerRaw = String(readConfigValue(mergedConfig, "music.server") ?? "netease");
  const musicTypeRaw = String(readConfigValue(mergedConfig, "music.type") ?? "playlist");
  const musicServer = MUSIC_SERVERS.includes(musicServerRaw as typeof MUSIC_SERVERS[number])
    ? musicServerRaw as typeof MUSIC_SERVERS[number]
    : "netease";
  const musicType = MUSIC_TYPES.includes(musicTypeRaw as typeof MUSIC_TYPES[number])
    ? musicTypeRaw as typeof MUSIC_TYPES[number]
    : "playlist";
  const musicId = normalizeMusicResourceId(String(readConfigValue(mergedConfig, "music.id") ?? ""));
  const musicCustomTracks = useMemo(
    () => parseCustomMusicTracks(readConfigValue(mergedConfig, "music.custom_tracks")),
    [mergedConfig],
  );
  const musicAutoplay = parseBoolean(readConfigValue(mergedConfig, "music.autoplay"));
  const themeColor = String(readConfigValue(mergedConfig, "theme.color") ?? "#fc466b");

  const platformId = musicId.trim();
  const hasPlatformSource = musicSource === "platform" && platformId.length > 0;
  const hasCustomSource = musicSource === "custom" && musicCustomTracks.length > 0;
  const shouldRender = musicEnabled && (hasPlatformSource || hasCustomSource);

  return {
    musicEnabled,
    musicSource,
    musicServer,
    musicType,
    musicId: platformId,
    musicCustomTracks,
    musicAutoplay,
    themeColor,
    shouldRender,
    hasPlatformSource,
    hasCustomSource,
  };
}
