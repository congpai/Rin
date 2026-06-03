import { client } from "../app/runtime";
import {
    THUMBNAIL_WIDTHS,
    VARIANT_FILE_EXTENSION,
} from "./image-variants";

export type ImageVariantBackfillResult = {
    generated: number;
    failed: number;
    skipped: number;
};

function encodeBlobPath(storageKey: string) {
    return storageKey
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
}

export function buildBlobUrlForStorageKey(storageKey: string) {
    return `/api/blob/${encodeBlobPath(storageKey)}`;
}

function hashBaseFromStorageKey(storageKey: string) {
    const fileName = storageKey.split("/").pop() ?? "";
    const dot = fileName.lastIndexOf(".");
    return dot > 0 ? fileName.slice(0, dot) : fileName;
}

function supportsWebpExport() {
    if (typeof document === "undefined") {
        return false;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

async function loadImage(url: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        image.src = url;
    });
}

async function renderThumbnailBlob(image: HTMLImageElement, maxWidth: number) {
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    if (!longest) {
        throw new Error("Invalid image dimensions");
    }

    let width: number;
    let height: number;

    if (longest <= maxWidth) {
        width = image.naturalWidth;
        height = image.naturalHeight;
    } else {
        const scale = maxWidth / longest;
        width = Math.max(1, Math.round(image.naturalWidth * scale));
        height = Math.max(1, Math.round(image.naturalHeight * scale));
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Failed to create canvas context");
    }

    context.drawImage(image, 0, 0, width, height);
    const mimeType = supportsWebpExport() ? "image/webp" : "image/jpeg";

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("Failed to encode thumbnail"))),
            mimeType,
            0.85,
        );
    });
}

export async function backfillVariantsForStorageKey(storageKey: string): Promise<ImageVariantBackfillResult> {
    const url = buildBlobUrlForStorageKey(storageKey);
    const hashBase = hashBaseFromStorageKey(storageKey);
    const extension = supportsWebpExport() ? VARIANT_FILE_EXTENSION : "jpg";
    let generated = 0;
    let failed = 0;

    let image: HTMLImageElement;
    try {
        image = await loadImage(url);
    } catch (error) {
        console.warn("[variant-backfill] failed to load original", storageKey, error);
        return { generated: 0, failed: THUMBNAIL_WIDTHS.length, skipped: 0 };
    }

    for (const width of THUMBNAIL_WIDTHS) {
        try {
            const blob = await renderThumbnailBlob(image, width);
            const variantStorageKey = `${hashBase}_w${width}.${extension}`;
            const file = new File([blob], variantStorageKey, { type: blob.type });
            const { error } = await client.storage.upload(file, file.name, {
                storageKey: variantStorageKey,
            });

            if (error) {
                failed += 1;
            } else {
                generated += 1;
            }
        } catch (error) {
            failed += 1;
            console.warn("[variant-backfill] failed for", storageKey, width, error);
        }
    }

    return { generated, failed, skipped: 0 };
}
