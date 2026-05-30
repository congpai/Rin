// Keep in sync with server/src/utils/feed-summary.ts (client bundle cannot import server code)

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

    text = text.replace(/<[^>]+>?/g, "");
    text = text.replace(/<[^>]*/g, "");
    text = text.replace(/https?:\/\/\S+/gi, "");

    return text.replace(/\s+/g, " ").trim();
}

export function normalizeFeedSummaryDisplay(summary: string, maxLength = 200): string {
    const normalized = normalizeContentForFeedSummary(summary);
    if (!normalized) {
        return summary.slice(0, maxLength);
    }
    return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength);
}
