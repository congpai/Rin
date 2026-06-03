import type { SlideImage } from "yet-another-react-lightbox";
import { parseImageUrlMetadata } from "./image-upload";
import {
    buildVariantImageUrl,
    isVariantCapableImageUrl,
    THUMBNAIL_WIDTHS,
} from "./image-variants";
import { getKnownVariantAvailability } from "./variant-availability";

export const LIGHTBOX_PREVIEW_WIDTH = 960;

export type LightboxSlideData = SlideImage & {
    originalSrc?: string;
    originalWidth?: number;
    originalHeight?: number;
};

function computeVariantHeight(
    variantWidth: number,
    metaWidth?: number,
    metaHeight?: number,
) {
    if (metaWidth && metaHeight && metaWidth > 0) {
        return Math.round((metaHeight / metaWidth) * variantWidth);
    }
    return Math.round(variantWidth * 0.75);
}

function buildOriginalOnlySlide(
    originalSrc: string,
    alt: string,
    metaWidth?: number,
    metaHeight?: number,
): LightboxSlideData {
    return {
        src: originalSrc,
        alt,
        imageFit: "contain",
        originalSrc,
        originalWidth: metaWidth,
        originalHeight: metaHeight,
        ...(metaWidth && metaHeight
            ? { width: metaWidth, height: metaHeight }
            : {}),
        download: {
            url: originalSrc,
            filename: originalSrc.split("/").pop() || "image",
        },
    };
}

function buildVariantLightboxSlide(
    url: string,
    alt: string,
    originalSrc: string,
    metaWidth?: number,
    metaHeight?: number,
): LightboxSlideData {
    const previewSrc = parseImageUrlMetadata(
        buildVariantImageUrl(url, LIGHTBOX_PREVIEW_WIDTH),
    ).src;
    const previewHeight = computeVariantHeight(
        LIGHTBOX_PREVIEW_WIDTH,
        metaWidth,
        metaHeight,
    );

    const srcSet: Array<{ src: string; width: number; height: number }> =
        THUMBNAIL_WIDTHS.map((width) => ({
            src: parseImageUrlMetadata(buildVariantImageUrl(url, width)).src,
            width,
            height: computeVariantHeight(width, metaWidth, metaHeight),
        }));

    if (metaWidth && metaHeight) {
        srcSet.push({
            src: originalSrc,
            width: metaWidth,
            height: metaHeight,
        });
    }

    return {
        src: previewSrc,
        alt,
        width: LIGHTBOX_PREVIEW_WIDTH,
        height: previewHeight,
        imageFit: "contain",
        srcSet,
        originalSrc,
        originalWidth: metaWidth,
        originalHeight: metaHeight,
        download: {
            url: originalSrc,
            filename: originalSrc.split("/").pop() || "image",
        },
    };
}

export function getLightboxOriginalSrc(slide: LightboxSlideData) {
    const download = slide.download;
    const downloadUrl =
        download && typeof download === "object" && "url" in download
            ? download.url
            : undefined;
    return slide.originalSrc ?? downloadUrl ?? slide.src;
}

export function buildLightboxSlide(url: string, alt = ""): LightboxSlideData {
    const { src: originalSrc, width: metaWidth, height: metaHeight } =
        parseImageUrlMetadata(url);

    if (!isVariantCapableImageUrl(originalSrc)) {
        return buildOriginalOnlySlide(originalSrc, alt, metaWidth, metaHeight);
    }

    const knownVariants = getKnownVariantAvailability(url);
    if (knownVariants === false) {
        return buildOriginalOnlySlide(originalSrc, alt, metaWidth, metaHeight);
    }

    if (knownVariants === true) {
        return buildVariantLightboxSlide(
            url,
            alt,
            originalSrc,
            metaWidth,
            metaHeight,
        );
    }

    const previewSrc = parseImageUrlMetadata(
        buildVariantImageUrl(url, LIGHTBOX_PREVIEW_WIDTH),
    ).src;
    const previewHeight = computeVariantHeight(
        LIGHTBOX_PREVIEW_WIDTH,
        metaWidth,
        metaHeight,
    );

    return {
        src: previewSrc,
        alt,
        width: LIGHTBOX_PREVIEW_WIDTH,
        height: previewHeight,
        imageFit: "contain",
        originalSrc,
        originalWidth: metaWidth,
        originalHeight: metaHeight,
        srcSet:
            metaWidth && metaHeight
                ? [
                      {
                          src: originalSrc,
                          width: metaWidth,
                          height: metaHeight,
                      },
                  ]
                : undefined,
        download: {
            url: originalSrc,
            filename: originalSrc.split("/").pop() || "image",
        },
    };
}

export type LightboxImageInput = {
    url: string;
    alt?: string;
};

export function buildLightboxSlides(images: LightboxImageInput[]) {
    return images.map((image) => buildLightboxSlide(image.url, image.alt ?? ""));
}

export function findLightboxIndexByOriginalUrl(
    images: LightboxImageInput[],
    originalUrl: string,
) {
    const clean = parseImageUrlMetadata(originalUrl).src;
    return images.findIndex(
        (image) => parseImageUrlMetadata(image.url).src === clean,
    );
}
