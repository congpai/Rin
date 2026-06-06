export function normalizeMusicResourceId(rawId: string) {
  const id = rawId.trim();
  if (!id) {
    return id;
  }

  const hashOrQueryMatch = id.match(/[?&#]id=([^&#]+)/i);
  if (hashOrQueryMatch?.[1]) {
    return decodeURIComponent(hashOrQueryMatch[1]).trim();
  }

  const songMidMatch = id.match(/[?&#]songmid=([^&#]+)/i);
  if (songMidMatch?.[1]) {
    return decodeURIComponent(songMidMatch[1]).trim();
  }

  const disstidMatch = id.match(/[?&#]disstid=([^&#]+)/i);
  if (disstidMatch?.[1]) {
    return decodeURIComponent(disstidMatch[1]).trim();
  }

  const playlistPathMatch = id.match(/\/playlist\/(\d+)/i);
  if (playlistPathMatch?.[1]) {
    return playlistPathMatch[1];
  }

  if (id.includes("://") || id.startsWith("//")) {
    try {
      const parsed = new URL(id.startsWith("//") ? `https:${id}` : id);
      const queryId = parsed.searchParams.get("id")
        ?? parsed.searchParams.get("songmid")
        ?? parsed.searchParams.get("disstid");
      if (queryId) {
        return queryId.trim();
      }
      const pathMatch = parsed.pathname.match(/\/(\d+)(?:\/|$)/);
      if (pathMatch?.[1]) {
        return pathMatch[1];
      }
      const songMidPathMatch = parsed.pathname.match(/\/song(?:mid)?\/([A-Za-z0-9]+)/i);
      if (songMidPathMatch?.[1]) {
        return songMidPathMatch[1];
      }
    } catch {
      // fall through
    }
  }

  return id;
}

export async function readApiErrorMessage(response: Response) {
  const raw = await response.text().catch(() => "");
  if (!raw) {
    return `Request failed (${response.status})`;
  }

  try {
    const payload = JSON.parse(raw) as {
      message?: string;
      error?: { message?: string };
    };
    return payload.message || payload.error?.message || raw;
  } catch {
    return raw;
  }
}
