import { useEffect, useRef } from "react";
import { useSiteConfig } from "../hooks/useSiteConfig";

const APLAYER_CSS = "https://cdn.jsdelivr.net/npm/aplayer/dist/APlayer.min.css";
const APLAYER_JS = "https://cdn.jsdelivr.net/npm/aplayer/dist/APlayer.min.js";
const METING_JS = "https://cdn.jsdelivr.net/npm/meting@2/dist/Meting.min.js";

type MetingWindow = Window & {
  meting_api?: string;
};

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
  if (document.querySelector(`script[src="${src}"]`)) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
}

export function GlobalMusicPlayer() {
  const {
    musicEnabled,
    musicServer,
    musicType,
    musicId,
    musicAutoplay,
    themeColor,
  } = useSiteConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const playlistId = musicId.trim();

  useEffect(() => {
    if (!musicEnabled || !playlistId) {
      document.body.classList.remove("rin-has-music-player");
      return undefined;
    }

    document.body.classList.add("rin-has-music-player");
    let cancelled = false;

    async function mountPlayer() {
      const metingWindow = window as MetingWindow;
      metingWindow.meting_api = `${window.location.origin}/api/meting/api?server=:server&type=:type&id=:id&auth=:auth&r=:r`;

      await loadStylesheet(APLAYER_CSS);
      await loadScript(APLAYER_JS);
      await loadScript(METING_JS);

      if (cancelled || !containerRef.current) {
        return;
      }

      containerRef.current.innerHTML = "";
      const player = document.createElement("meting-js");
      player.setAttribute("server", musicServer);
      player.setAttribute("type", musicType);
      player.setAttribute("id", playlistId);
      player.setAttribute("fixed", "true");
      player.setAttribute("mini", "false");
      player.setAttribute("autoplay", musicAutoplay ? "true" : "false");
      player.setAttribute("theme", themeColor);
      player.setAttribute("loop", "all");
      player.setAttribute("order", "list");
      player.setAttribute("preload", "metadata");
      player.setAttribute("mutex", "true");
      player.setAttribute("list-folded", "true");
      player.setAttribute("list-max-height", "340px");
      containerRef.current.appendChild(player);
    }

    mountPlayer().catch((error) => {
      console.error("Failed to mount music player:", error);
    });

    return () => {
      cancelled = true;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      document.body.classList.remove("rin-has-music-player");
    };
  }, [musicEnabled, musicAutoplay, musicServer, musicType, playlistId, themeColor]);

  if (!musicEnabled || !playlistId) {
    return null;
  }

  return <div ref={containerRef} className="global-music-player" aria-hidden="true" />;
}
