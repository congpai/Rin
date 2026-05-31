import type { ReactNode } from "react";
import { parseImageUrlMetadata } from "../../utils/image-upload";

const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

export function stripMarkdownImages(content: string) {
    return content
        .replace(MARKDOWN_IMAGE_RE, "")
        .replace(/\s+/g, " ")
        .trim();
}

export function extractMarkdownImages(content: string) {
    const images: { alt: string; src: string }[] = [];
    for (const match of content.matchAll(MARKDOWN_IMAGE_RE)) {
        images.push({
            alt: match[1] ?? "",
            src: parseImageUrlMetadata(match[2]).src,
        });
    }
    return images;
}

export function CommentTailContent({ content }: { content: string }) {
    const text = stripMarkdownImages(content);
    const images = extractMarkdownImages(content);

    return (
        <>
            {text ? <span>{text}</span> : null}
            {images.length > 0 ? (
                <div className={text ? "mt-1.5 flex flex-wrap gap-1.5" : "mt-0.5 flex flex-wrap gap-1.5"}>
                    {images.map((image, index) => (
                        <a
                            key={`${image.src}-${index}`}
                            href={image.src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block"
                        >
                            <img
                                src={image.src}
                                alt={image.alt}
                                loading="lazy"
                                className="max-h-20 max-w-[8rem] rounded-md object-cover"
                            />
                        </a>
                    ))}
                </div>
            ) : null}
        </>
    );
}

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
