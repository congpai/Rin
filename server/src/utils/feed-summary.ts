const DEFAULT_MAX_LENGTH = 100;

/**
 * Turn article HTML/Markdown into plain text for list cards & RSS descriptions.
 * - iframe / video / embed → [视频]
 * - ![alt](url) or <img alt="..."> → [alt] (empty alt → [图片])
 */
export function normalizeContentForFeedSummary(content: string): string {
    if (!content) {
        return "";
    }

    let text = content;

    // HTML video embeds
    text = text.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "[视频]");
    text = text.replace(/<iframe\b[^>]*\/?>/gi, "[视频]");
    text = text.replace(/<video\b[^>]*>[\s\S]*?<\/video>/gi, "[视频]");
    text = text.replace(/<video\b[^>]*\/?>/gi, "[视频]");
    text = text.replace(/<embed\b[^>]*\/?>/gi, "[视频]");

    // HTML images (prefer alt text)
    text = text.replace(/<img\b[^>]*\balt=["']([^"']*)["'][^>]*\/?>/gi, (_, alt: string) => {
        const trimmed = alt.trim();
        return trimmed ? `[${trimmed}]` : "[图片]";
    });
    text = text.replace(/<img\b[^>]*\/?>/gi, "[图片]");

    // Markdown images ![alt](url)
    text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt: string) => {
        const trimmed = alt.trim();
        return trimmed ? `[${trimmed}]` : "[图片]";
    });

    // Strip remaining HTML tags
    text = text.replace(/<[^>]+>/g, "");

    text = text
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'");

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
        return trimmedSummary;
    }
    return generateFeedSummaryFromContent(content, maxLength);
}
