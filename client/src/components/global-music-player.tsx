import APlayer from "aplayer";
import { useEffect, useRef, useState } from "react";
import { useMusicPlayerConfig } from "../hooks/useMusicPlayerConfig";
import {
  mapCustomTracks,
  mapMetingTracks,
  type APlayerTrack,
  type MetingApiTrack,
  type MusicItem,
} from "../utils/music-config";
import { readApiErrorMessage } from "../utils/music-api";
import "aplayer/dist/APlayer.min.css";

type PlayerStatus = "idle" | "loading" | "ready" | "error";

async function fetchPlatformItem(item: {
  server: string;
  type: string;
  id: string;
}): Promise<APlayerTrack[]> {
  const params = new URLSearchParams({
    server: item.server,
    type: item.type,
    id: item.id,
  });
  const response = await fetch(`/api/meting/api?${params.toString()}`);
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  const payload = await response.json() as MetingApiTrack[] | MetingApiTrack;
  const list = Array.isArray(payload) ? payload : [payload];
  return mapMetingTracks(list);
}

// Expand the unified item list into a flat playlist, preserving order. Each
// item is resolved independently so a single broken platform source (expired
// playlist, region block, ...) never wipes out the rest of the playlist.
async function loadMusicItems(items: MusicItem[]): Promise<APlayerTrack[]> {
  const results = await Promise.allSettled(
    items.map((item) => (
      item.kind === "custom"
        ? Promise.resolve(mapCustomTracks([{
            name: item.name,
            artist: item.artist,
            url: item.url,
            cover: item.cover,
            lrc: item.lrc,
          }]))
        : fetchPlatformItem(item)
    )),
  );

  const tracks: APlayerTrack[] = [];
  const errors: string[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      tracks.push(...result.value);
    } else {
      const reason = result.reason;
      errors.push(reason instanceof Error ? reason.message : String(reason));
    }
  }

  if (tracks.length === 0) {
    throw new Error(errors[0] ?? "No playable tracks found");
  }
  return tracks;
}

export function GlobalMusicPlayer() {
  const {
    musicItems,
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

      const rawAudio = await loadMusicItems(musicItems);

      const audio = rawAudio.map(({ name, artist, url, cover }) => ({
        name,
        artist,
        url,
        cover,
      }));

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
        preload: "auto",
        volume: 0.7,
        listFolded: true,
        listMaxHeight: 90,
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
    musicItems,
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
