const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

type ConfigReader = {
    getOrDefault<T>(key: string, defaultValue: T): Promise<T>;
};

export function stripMarkdownImages(content: string) {
    return content
        .replace(MARKDOWN_IMAGE_RE, "")
        .replace(/\s+/g, " ")
        .trim();
}

export function parseCommentMinLength(value: unknown, defaultValue = 1) {
    if (value === undefined || value === null || value === "") {
        return defaultValue;
    }

    const parsed = typeof value === "number" ? value : Number.parseInt(String(value).trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return defaultValue;
    }

    return Math.floor(parsed);
}

export async function getCommentMinLength(clientConfig: ConfigReader) {
    const value = await clientConfig.getOrDefault("comment.min_length", 1);
    return parseCommentMinLength(value, 1);
}

export function validateCommentContent(content: unknown, minLength: number) {
    if (typeof content !== "string" || !content.trim()) {
        return "Content is required";
    }

    const trimmed = content.trim();
    const text = stripMarkdownImages(trimmed);
    const hasImages = MARKDOWN_IMAGE_RE.test(trimmed);

    if (!text && !hasImages) {
        return "Content is required";
    }

    const min = parseCommentMinLength(minLength, 1);
    if (min > 1 && text.length > 0 && text.length < min) {
        return `Comment too short:${min}`;
    }

    return null;
}
