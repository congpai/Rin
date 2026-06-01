import { stripMarkdownImages } from "../components/comment/comment_content";

const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

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

export type CommentContentValidationError = "empty" | { tooShort: number };

export function validateCommentContent(
    content: string,
    minLength: number,
): CommentContentValidationError | null {
    const trimmed = content.trim();
    if (!trimmed) {
        return "empty";
    }

    const text = stripMarkdownImages(trimmed);
    const hasImages = MARKDOWN_IMAGE_RE.test(trimmed);

    if (!text && !hasImages) {
        return "empty";
    }

    const min = parseCommentMinLength(minLength, 1);
    if (min > 1 && text.length > 0 && text.length < min) {
        return { tooShort: min };
    }

    return null;
}
