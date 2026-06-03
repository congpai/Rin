const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

/** 评论纯文字最少字符数；只发图片不受此限制。需与 client/src/utils/comment-validation.ts 保持一致。 */
export const COMMENT_MIN_LENGTH = 6;

export function stripMarkdownImages(content: string) {
    return content
        .replace(MARKDOWN_IMAGE_RE, "")
        .replace(/\s+/g, " ")
        .trim();
}

export function validateCommentContent(content: unknown) {
    if (typeof content !== "string" || !content.trim()) {
        return "Content is required";
    }

    const trimmed = content.trim();
    const text = stripMarkdownImages(trimmed);
    const hasImages = MARKDOWN_IMAGE_RE.test(trimmed);

    if (!text && !hasImages) {
        return "Content is required";
    }

    if (
        COMMENT_MIN_LENGTH > 1
        && text.length > 0
        && text.length < COMMENT_MIN_LENGTH
    ) {
        return `Comment too short:${COMMENT_MIN_LENGTH}`;
    }

    return null;
}
