import { parseImageUrlMetadata } from "./image-upload";
import {
    buildVariantImageUrl,
    isVariantCapableImageUrl,
    THUMBNAIL_WIDTHS,
} from "./image-variants";

export { THUMBNAIL_WIDTHS };

export function isResizableBlobUrl(url?: string | null) {
    return isVariantCapableImageUrl(url);
}

export function buildResponsiveSrcSet(src: string, widths: readonly number[] = THUMBNAIL_WIDTHS) {
    if (!isVariantCapableImageUrl(src)) {
        return undefined;
    }

    return widths
        .map((width) => `${buildVariantImageUrl(src, width)} ${width}w`)
        .join(", ");
}

export function pickResponsiveFallbackSrc(
    src: string,
    preferredWidth = 640,
    widths: readonly number[] = THUMBNAIL_WIDTHS,
) {
    if (!isVariantCapableImageUrl(src)) {
        return parseImageUrlMetadata(src).src;
    }

    const sorted = [...widths].sort((a, b) => a - b);
    const chosen = sorted.find((value) => value >= preferredWidth) ?? sorted[sorted.length - 1] ?? preferredWidth;
    return buildVariantImageUrl(src, chosen);
}

export type ResponsiveImageProps = {
    src: string;
    srcSet?: string;
    sizes?: string;
};

export function buildResponsiveImageProps(
    src: string,
    sizes: string,
    preferredWidth = 640,
): ResponsiveImageProps {
    const cleanSrc = parseImageUrlMetadata(src).src;
    const srcSet = buildResponsiveSrcSet(src);
    if (!srcSet) {
        return { src: cleanSrc };
    }

    return {
        src: pickResponsiveFallbackSrc(src, preferredWidth),
        srcSet,
        sizes,
    };
}
