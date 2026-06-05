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

  if (id.includes("://") || id.startsWith("//")) {
    try {
      const parsed = new URL(id.startsWith("//") ? `https:${id}` : id);
      const queryId = parsed.searchParams.get("id") ?? parsed.searchParams.get("songmid");
      if (queryId) {
        return queryId.trim();
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
