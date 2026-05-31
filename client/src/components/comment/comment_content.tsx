import type { ReactNode } from "react";
import { parseImageUrlMetadata } from "../../utils/image-upload";

const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

export function CommentContent({ content }: { content: string }) {
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    for (const match of content.matchAll(MARKDOWN_IMAGE_RE)) {
        const index = match.index ?? 0;
        if (index > lastIndex) {
            parts.push(
                <span key={key++} className="whitespace-pre-wrap break-words">
                    {content.slice(lastIndex, index)}
                </span>,
            );
        }
        const alt = match[1] ?? "";
        const src = parseImageUrlMetadata(match[2]).src;
        parts.push(
            <img
                key={key++}
                src={src}
                alt={alt}
                loading="lazy"
                className="mt-2 max-h-48 max-w-full rounded-lg object-contain"
            />,
        );
        lastIndex = index + match[0].length;
    }

    if (lastIndex < content.length) {
        parts.push(
            <span key={key++} className="whitespace-pre-wrap break-words">
                {content.slice(lastIndex)}
            </span>,
        );
    }

    if (parts.length === 0) {
        return <p className="t-primary whitespace-pre-wrap break-words">{content}</p>;
    }

    return <div className="t-primary">{parts}</div>;
}
