import APlayer from "aplayer";
import { useEffect, useRef, useState } from "react";
import { useMusicPlayerConfig } from "../hooks/useMusicPlayerConfig";
import {
  mapCustomTracks,
  mapMetingTracks,
  type MetingApiTrack,
} from "../utils/music-config";
import "aplayer/dist/APlayer.min.css";

type PlayerStatus = "idle" | "loading" | "ready" | "error";

async function fetchPlatformTracks(server: string, type: string, id: string) {
  const params = new URLSearchParams({
    server,
    type,
    id,
  });
  const response = await fetch(`/api/meting/api?${params.toString()}`);
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Meting API failed (${response.status})`);
  }
  const payload = await response.json() as MetingApiTrack[] | MetingApiTrack;
  const list = Array.isArray(payload) ? payload : [payload];
  const tracks = mapMetingTracks(list);
  if (tracks.length === 0) {
    throw new Error("No playable tracks found");
  }
  return tracks;
}

export function GlobalMusicPlayer() {
  const {
    musicSource,
    musicServer,
    musicType,
    musicId,
    musicCustomTracks,
    musicAutoplay,
    themeColor,
    shouldRender,
  } = useMusicPlayerConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<InstanceType<typeof APlayer> | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!shouldRender) {
      document.body.classList.remove("rin-has-music-player");
      playerRef.current?.destroy();
      playerRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      setStatus("idle");
      setErrorMessage("");
      return undefined;
    }

    document.body.classList.add("rin-has-music-player");
    let cancelled = false;
    setStatus("loading");
    setErrorMessage("");

    async function mountPlayer() {
      if (!containerRef.current) {
        return;
      }

      playerRef.current?.destroy();
      playerRef.current = null;
      containerRef.current.innerHTML = "";

      const audio = musicSource === "custom"
        ? mapCustomTracks(musicCustomTracks)
        : await fetchPlatformTracks(musicServer, musicType, musicId);

      if (cancelled || !containerRef.current || audio.length === 0) {
        throw new Error("No playable tracks found");
      }

      playerRef.current = new APlayer({
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

      if (!cancelled) {
        setStatus("ready");
      }
    }

    mountPlayer().catch((error) => {
      console.error("Failed to mount music player:", error);
      if (!cancelled) {
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Music player failed to load");
      }
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
    musicId,
    musicServer,
    musicSource,
    musicType,
    themeColor,
  ]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="global-music-player-root" aria-live="polite">
      {status === "loading" ? (
        <div className="global-music-player-status">Loading music player...</div>
      ) : null}
      {status === "error" ? (
        <div className="global-music-player-status global-music-player-status-error">
          {errorMessage || "Music player failed to load"}
        </div>
      ) : null}
      <div ref={containerRef} className="global-music-player" />
    </div>
  );
}
