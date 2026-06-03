import { parseImageUrlMetadata } from "./image-upload";

export type MomentImage = {
    alt: string;
    url: string;
    cleanUrl: string;
};

const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

/** Extract all markdown images from moment content, in order. */
export function extractMomentImages(content: string): MomentImage[] {
    const images: MomentImage[] = [];
    for (const match of content.matchAll(MARKDOWN_IMAGE_RE)) {
        const alt = match[1] ?? "";
        const url = match[2] ?? "";
        if (!url) continue;
        images.push({
            alt,
            url,
            cleanUrl: parseImageUrlMetadata(url).src,
        });
    }
    return images;
}

/** Remove markdown image lines so Markdown renderer only shows text. */
export function stripMomentImages(content: string): string {
    return content
        .replace(/^\s*!\[[^\]]*\]\([^)]+\)\s*$/gm, "")
        .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/** Grid column count by image count (WeChat / 微博 style). */
export function momentGridCols(count: number): number {
    if (count <= 1) return 1;
    if (count === 2 || count === 4) return 2;
    return 3;
}

/** Max visible cells in grid (9-grid cap). */
export const MOMENT_GRID_MAX = 9;
