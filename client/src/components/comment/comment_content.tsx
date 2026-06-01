import type { ReactNode } from "react";
import { parseImageUrlMetadata } from "../../utils/image-upload";
import { useCommentImageLightbox } from "./comment_image_lightbox";

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

export function CommentTailImages({ content }: { content: string }) {
    const images = extractMarkdownImages(content);
    const { openAt, lightbox } = useCommentImageLightbox(images);

    if (images.length === 0) {
        return null;
    }

    const text = stripMarkdownImages(content);

    return (
        <>
            <div className={text ? "mt-1.5 flex flex-wrap gap-1.5" : "mt-0.5 flex flex-wrap gap-1.5"}>
                {images.map((image, index) => (
                    <button
                        key={`${image.src}-${index}`}
                        type="button"
                        aria-label={image.alt || undefined}
                        className="inline-block cursor-zoom-in overflow-hidden rounded-md"
                        onClick={() => openAt(index)}
                    >
                        <img
                            src={image.src}
                            alt={image.alt}
                            loading="lazy"
                            className="max-h-20 max-w-[8rem] rounded-md object-cover transition hover:opacity-90"
                        />
                    </button>
                ))}
            </div>
            {lightbox}
        </>
    );
}

export function CommentTailContent({ content }: { content: string }) {
    const text = stripMarkdownImages(content);

    return (
        <>
            {text ? <span>{text}</span> : null}
            <CommentTailImages content={content} />
        </>
    );
}

export function CommentContent({ content }: { content: string }) {
    const images = extractMarkdownImages(content);
    const { openAt, lightbox } = useCommentImageLightbox(images);
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;
    let imageIndex = 0;

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
        const currentIndex = imageIndex;
        imageIndex += 1;
        parts.push(
            <button
                key={key++}
                type="button"
                aria-label={alt || undefined}
                className="mt-2 block max-w-full cursor-zoom-in text-left"
                onClick={() => openAt(currentIndex)}
            >
                <img
                    src={src}
                    alt={alt}
                    loading="lazy"
                    className="max-h-48 max-w-full rounded-lg object-contain transition hover:opacity-90"
                />
            </button>,
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

    return (
        <div className="t-primary">
            {parts}
            {lightbox}
        </div>
    );
}
