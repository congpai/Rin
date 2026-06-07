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

// --- Unified playlist model -------------------------------------------------
// A single ordered list where each entry is either a platform source (expands
// to N tracks via Meting) or a direct custom track. This lets NetEase, QQ Music
// and self-hosted MP3 coexist in one playlist, in a user-defined order.

export type MusicPlatformItem = {
  kind: "platform";
  server: string;
  type: string;
  id: string;
};

export type MusicCustomItem = {
  kind: "custom";
  name: string;
  artist: string;
  url: string;
  cover?: string;
  lrc?: string;
};

export type MusicItem = MusicPlatformItem | MusicCustomItem;

export function emptyPlatformItem(): MusicPlatformItem {
  return { kind: "platform", server: "netease", type: "playlist", id: "" };
}

export function emptyCustomItem(): MusicCustomItem {
  return { kind: "custom", name: "", artist: "", url: "", cover: "" };
}

function normalizeMusicItem(item: unknown): MusicItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const record = item as Record<string, unknown>;
  // Custom track: identified by a direct url and no platform fields (or kind).
  const kind = String(record.kind ?? "").trim();
  const looksCustom = kind === "custom"
    || (kind !== "platform" && typeof record.url === "string" && !record.server);

  if (looksCustom) {
    const url = String(record.url ?? "").trim();
    if (!url) {
      return null;
    }
    return {
      kind: "custom",
      name: String(record.name ?? "Untitled").trim() || "Untitled",
      artist: String(record.artist ?? "").trim(),
      url,
      cover: String(record.cover ?? "").trim() || undefined,
      lrc: String(record.lrc ?? "").trim() || undefined,
    };
  }

  const server = String(record.server ?? "").trim();
  const type = String(record.type ?? "").trim();
  const id = String(record.id ?? "").trim();
  if (!server || !type || !id) {
    return null;
  }
  return { kind: "platform", server, type, id };
}

export function parseMusicItems(raw: unknown): MusicItem[] {
  let source: unknown = raw;
  if (typeof raw === "string") {
    if (!raw.trim()) {
      return [];
    }
    try {
      source = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(source)) {
    return [];
  }
  return source
    .map((item) => normalizeMusicItem(item))
    .filter((item): item is MusicItem => item !== null);
}

export function serializeMusicItems(items: MusicItem[]): string {
  return JSON.stringify(items);
}

// One-time migration: fold the legacy binary-mode config (music.source +
// platform sources OR custom tracks) into a unified, ordered item list.
export function buildMusicItemsFromLegacy(input: {
  source: MusicSource;
  platformSources: MusicPlatformSource[];
  customTracks: CustomMusicTrack[];
}): MusicItem[] {
  if (input.source === "custom") {
    return input.customTracks.map<MusicCustomItem>((track) => ({
      kind: "custom",
      name: track.name,
      artist: track.artist,
      url: track.url,
      cover: track.cover,
      lrc: track.lrc,
    }));
  }
  return input.platformSources.map<MusicPlatformItem>((source) => ({
    kind: "platform",
    server: source.server,
    type: source.type,
    id: source.id,
  }));
}
