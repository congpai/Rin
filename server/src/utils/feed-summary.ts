const DEFAULT_MAX_LENGTH = 240;

const HTML_ENTITIES: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&#x27;": "'",
};

function decodeHtmlEntities(text: string): string {
    let decoded = text;
    for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
        decoded = decoded.replace(new RegExp(entity, "gi"), char);
    }
    return decoded.replace(/&#(\d+);/g, (_, code: string) =>
        String.fromCharCode(Number.parseInt(code, 10)),
    );
}

/**
 * Turn article HTML/Markdown into plain text for list cards & RSS descriptions.
 * - iframe / video / embed / bilibili player → [视频]
 * - ![alt](url) or <img alt="..."> → [alt] (empty alt → [图片])
 * - Handles HTML entities (&lt;iframe) and truncated excerpts from old cache.
 */
export function normalizeContentForFeedSummary(content: string): string {
    if (!content) {
        return "";
    }

    let text = decodeHtmlEntities(content);

    text = text.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "[视频]");
    text = text.replace(/<iframe\b[^>]*/gi, "[视频]");
    text = text.replace(/<video\b[^>]*>[\s\S]*?<\/video>/gi, "[视频]");
    text = text.replace(/<video\b[^>]*/gi, "[视频]");
    text = text.replace(/<embed\b[^>]*/gi, "[视频]");
    text = text.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, "[视频]");

    text = text.replace(/<img\b[^>]*\balt=["']([^"']*)["'][^>]*\/?>/gi, (_, alt: string) => {
        const trimmed = alt.trim();
        return trimmed ? `[${trimmed}]` : "[图片]";
    });
    text = text.replace(/<img\b[^>]*/gi, "[图片]");

    text = text.replace(/!\[([^\]]*)\]\([^)]*\)?/g, (_, alt: string) => {
        const trimmed = alt.trim();
        return trimmed ? `[${trimmed}]` : "[图片]";
    });

    // Markdown links [text](url) → text
    text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

    text = text.replace(/<[^>]+>?/g, "");
    text = text.replace(/<[^>]*/g, "");
    text = text.replace(/https?:\/\/\S+/gi, "");

    // Markdown heading / bold markers → plain text
    text = text.replace(/^#{1,6}\s+/gm, "");
    text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
    text = text.replace(/\*([^*]+)\*/g, "$1");

    return text.replace(/\s+/g, " ").trim();
}

export function generateFeedSummaryFromContent(
    content: string,
    maxLength = DEFAULT_MAX_LENGTH,
): string {
    const normalized = normalizeContentForFeedSummary(content);
    if (normalized.length <= maxLength) {
        return normalized;
    }
    return normalized.slice(0, maxLength);
}

/** Use manual summary when set; otherwise derive from content. */
export function resolveFeedSummary(
    summary: string | null | undefined,
    content: string,
    maxLength = DEFAULT_MAX_LENGTH,
): string {
    const trimmedSummary = (summary ?? "").trim();
    if (trimmedSummary.length > 0) {
        return normalizeContentForFeedSummary(trimmedSummary).slice(0, maxLength)
            || trimmedSummary.slice(0, maxLength);
    }
    return generateFeedSummaryFromContent(content, maxLength);
}

/** Normalize an already-generated summary string (for client-side / cache fallback). */
export function normalizeFeedSummaryDisplay(
    summary: string,
    maxLength = DEFAULT_MAX_LENGTH,
): string {
    const normalized = normalizeContentForFeedSummary(summary);
    if (!normalized) {
        return summary.slice(0, maxLength);
    }
    return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength);
}

/** Re-export for feed.ts / rss.ts */
export { DEFAULT_MAX_LENGTH as FEED_AUTO_SUMMARY_MAX_LENGTH };
