import { useEffect, useRef } from "react";
import { useSiteConfig } from "../hooks/useSiteConfig";
import {
  mapCustomTracks,
  mapMetingTracks,
  type MetingApiTrack,
} from "../utils/music-config";

const APLAYER_CSS = "https://cdn.jsdelivr.net/npm/aplayer/dist/APlayer.min.css";
const APLAYER_JS = "https://cdn.jsdelivr.net/npm/aplayer/dist/APlayer.min.js";

function loadStylesheet(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load stylesheet: ${href}`));
    document.head.appendChild(link);
  });
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-rin-src="${src}"]`) as HTMLScriptElement | null;
    if (existing?.dataset.rinLoaded === "true") {
      resolve();
      return;
    }

    const script = existing ?? document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.rinSrc = src;
    script.onload = () => {
      script.dataset.rinLoaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    if (!existing) {
      document.body.appendChild(script);
    }
  });
}

async function fetchPlatformTracks(server: string, type: string, id: string) {
  const params = new URLSearchParams({
    server,
    type,
    id,
  });
  const response = await fetch(`/api/meting/api?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Meting API failed (${response.status})`);
  }
  const payload = await response.json() as MetingApiTrack[] | MetingApiTrack;
  const list = Array.isArray(payload) ? payload : [payload];
  return mapMetingTracks(list);
}

export function GlobalMusicPlayer() {
  const {
    musicEnabled,
    musicSource,
    musicServer,
    musicType,
    musicId,
    musicCustomTracks,
    musicAutoplay,
    themeColor,
  } = useSiteConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<{ destroy: () => void } | null>(null);
  const platformId = musicId.trim();
  const hasPlatformSource = musicSource === "platform" && platformId.length > 0;
  const hasCustomSource = musicSource === "custom" && musicCustomTracks.length > 0;
  const shouldRender = musicEnabled && (hasPlatformSource || hasCustomSource);

  useEffect(() => {
    if (!shouldRender) {
      document.body.classList.remove("rin-has-music-player");
      playerRef.current?.destroy();
      playerRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      return undefined;
    }

    document.body.classList.add("rin-has-music-player");
    let cancelled = false;

    async function mountPlayer() {
      await loadStylesheet(APLAYER_CSS);
      await loadScript(APLAYER_JS);

      if (cancelled || !containerRef.current) {
        return;
      }

      playerRef.current?.destroy();
      playerRef.current = null;
      containerRef.current.innerHTML = "";

      const audio = musicSource === "custom"
        ? mapCustomTracks(musicCustomTracks)
        : await fetchPlatformTracks(musicServer, musicType, platformId);

      if (cancelled || !containerRef.current || audio.length === 0) {
        throw new Error("No playable tracks found");
      }

      if (!window.APlayer) {
        throw new Error("APlayer is unavailable");
      }

      playerRef.current = new window.APlayer({
        container: containerRef.current,
        fixed: true,
        mini: false,
        autoplay: musicAutoplay,
        theme: themeColor,
        loop: "all",
        order: "list",
        preload: "metadata",
        listFolded: true,
        listMaxHeight: 340,
        mutex: true,
        audio,
      });
    }

    mountPlayer().catch((error) => {
      console.error("Failed to mount music player:", error);
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      document.body.classList.remove("rin-has-music-player");
    };
  }, [
    shouldRender,
    musicAutoplay,
    musicCustomTracks,
    musicServer,
    musicSource,
    musicType,
    platformId,
    themeColor,
  ]);

  if (!shouldRender) {
    return null;
  }

  return <div ref={containerRef} className="global-music-player" aria-hidden="true" />;
}
