export type MusicSource = "platform" | "custom";

export type CustomMusicTrack = {
  name: string;
  artist: string;
  url: string;
  cover?: string;
  lrc?: string;
};

export type MetingApiTrack = {
  title?: string;
  author?: string;
  url?: string;
  pic?: string;
  lrc?: string;
};

export type APlayerTrack = {
  name: string;
  artist: string;
  url: string;
  cover?: string;
  lrc?: string;
};

export function normalizeMusicSource(value: unknown): MusicSource {
  return value === "custom" ? "custom" : "platform";
}

export function parseCustomMusicTracks(raw: unknown): CustomMusicTrack[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => normalizeCustomTrack(item))
      .filter((item): item is CustomMusicTrack => item !== null);
  }

  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => normalizeCustomTrack(item))
      .filter((item): item is CustomMusicTrack => item !== null);
  } catch {
    return [];
  }
}

function normalizeCustomTrack(item: unknown): CustomMusicTrack | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const track = item as Record<string, unknown>;
  const url = String(track.url ?? "").trim();
  if (!url) {
    return null;
  }
  return {
    name: String(track.name ?? "Untitled").trim() || "Untitled",
    artist: String(track.artist ?? "").trim(),
    url,
    cover: String(track.cover ?? "").trim() || undefined,
    lrc: String(track.lrc ?? "").trim() || undefined,
  };
}

export function serializeCustomMusicTracks(tracks: CustomMusicTrack[]) {
  return JSON.stringify(tracks);
}

export function mapMetingTracks(tracks: MetingApiTrack[]): APlayerTrack[] {
  return tracks
    .map((track) => ({
      name: String(track.title ?? "").trim() || "Untitled",
      artist: String(track.author ?? "").trim(),
      url: String(track.url ?? "").trim(),
      cover: String(track.pic ?? "").trim() || undefined,
      lrc: String(track.lrc ?? "").trim() || undefined,
    }))
    .filter((track) => track.url.length > 0);
}

export function mapCustomTracks(tracks: CustomMusicTrack[]): APlayerTrack[] {
  return tracks.map((track) => ({
    name: track.name,
    artist: track.artist,
    url: track.url,
    cover: track.cover,
    lrc: track.lrc,
  }));
}
