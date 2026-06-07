export type MusicSource = "platform" | "custom";

export type MusicPlatformSource = {
  server: string;
  type: string;
  id: string;
};

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

function normalizePlatformSource(item: unknown): MusicPlatformSource | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const source = item as Record<string, unknown>;
  const server = String(source.server ?? "").trim();
  const type = String(source.type ?? "").trim();
  const id = String(source.id ?? "").trim();
  if (!server || !type || !id) {
    return null;
  }
  return { server, type, id };
}

export function parseMusicPlatformSources(raw: unknown): MusicPlatformSource[] {
  if (!Array.isArray(raw)) {
    if (typeof raw !== "string" || !raw.trim()) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .map((item) => normalizePlatformSource(item))
        .filter((item): item is MusicPlatformSource => item !== null);
    } catch {
      return [];
    }
  }

  return raw
    .map((item) => normalizePlatformSource(item))
    .filter((item): item is MusicPlatformSource => item !== null);
}

export function serializeMusicPlatformSources(sources: MusicPlatformSource[]) {
  return JSON.stringify(sources);
}

export function buildMusicPlatformSources(
  primary: MusicPlatformSource | null,
  extraSources: MusicPlatformSource[],
): MusicPlatformSource[] {
  const merged: MusicPlatformSource[] = [];
  const seen = new Set<string>();

  for (const source of [primary, ...extraSources]) {
    if (!source) {
      continue;
    }
    const id = source.id.trim();
    if (!id) {
      continue;
    }
    const key = `${source.server}:${source.type}:${id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push({
      server: source.server,
      type: source.type,
      id,
    });
  }

  return merged;
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
