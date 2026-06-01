import { stripMarkdownImages } from "../components/comment/comment_content";

const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

/** 评论纯文字最少字符数；只发图片不受此限制。需与 server/src/utils/comment-content.ts 保持一致。 */
export const COMMENT_MIN_LENGTH = 6;

export type CommentContentValidationError = "empty" | { tooShort: number };

export function validateCommentContent(content: string): CommentContentValidationError | null {
    const trimmed = content.trim();
    if (!trimmed) {
        return "empty";
    }

    const text = stripMarkdownImages(trimmed);
    const hasImages = MARKDOWN_IMAGE_RE.test(trimmed);

    if (!text && !hasImages) {
        return "empty";
    }

    if (
        COMMENT_MIN_LENGTH > 1
        && text.length > 0
        && text.length < COMMENT_MIN_LENGTH
    ) {
        return { tooShort: COMMENT_MIN_LENGTH };
    }

    return null;
}
