import {
    buildVariantStorageKey,
    THUMBNAIL_WIDTHS,
} from "./image-variants";
import {
    getStorageObject,
    isVariantObjectPresent,
    putStorageObjectAtKey,
    resolveFullStorageKey,
} from "./storage";

export type GenerateImageVariantsResult = {
    generated: number;
    skipped: number;
    failed: number;
};

function isUncompressibleImageType(contentType: string) {
    return contentType === "image/gif"
        || contentType === "image/svg+xml"
        || contentType === "image/svg";
}

function guessContentTypeFromKey(storageKey: string) {
    const extension = storageKey.split("/").pop()?.split(".").pop()?.toLowerCase() ?? "";
    switch (extension) {
        case "jpg":
        case "jpeg":
            return "image/jpeg";
        case "png":
            return "image/png";
        case "webp":
            return "image/webp";
        case "avif":
            return "image/avif";
        default:
            return "application/octet-stream";
    }
}

function resolveImageContentType(storageKey: string, responseType: string | null, hint: string) {
    const normalizedHint = hint.startsWith("image/") ? hint : "";
    const normalizedResponse = responseType?.startsWith("image/") ? responseType : "";
    if (normalizedResponse) {
        return normalizedResponse;
    }
    if (normalizedHint) {
        return normalizedHint;
    }
    const guessed = guessContentTypeFromKey(storageKey);
    return guessed.startsWith("image/") ? guessed : "image/jpeg";
}

async function loadImageBitmap(body: ArrayBuffer, contentType: string): Promise<ImageBitmap | null> {
    const attempts = [
        contentType,
        "image/jpeg",
        "image/png",
        "image/webp",
    ].filter((type, index, values) => type.startsWith("image/") && values.indexOf(type) === index);

    for (const type of attempts) {
        try {
            return await createImageBitmap(new Blob([body], { type }));
        } catch {
            continue;
        }
    }

    try {
        return await createImageBitmap(new Blob([body]));
    } catch (error) {
        console.warn("[variants] createImageBitmap failed for all mime attempts:", error);
        return null;
    }
}

async function resizeImageBuffer(
    body: ArrayBuffer,
    contentType: string,
    maxWidth: number,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
    const bitmap = await loadImageBitmap(body, contentType);
    if (!bitmap) {
        return null;
    }

    const longest = Math.max(bitmap.width, bitmap.height);
    let width: number;
    let height: number;

    if (longest <= maxWidth) {
        width = bitmap.width;
        height = bitmap.height;
    } else {
        const scale = maxWidth / longest;
        width = Math.max(1, Math.round(bitmap.width * scale));
        height = Math.max(1, Math.round(bitmap.height * scale));
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");

    if (!ctx) {
        bitmap.close();
        return null;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const outputType = "image/webp";
    const outputBlob = await canvas.convertToBlob({ type: outputType, quality: 0.85 });
    return {
        body: await outputBlob.arrayBuffer(),
        contentType: outputType,
    };
}

export async function generateImageVariants(
    env: Env,
    storageKey: string,
    contentTypeHint: string,
): Promise<GenerateImageVariantsResult> {
    const fullKey = resolveFullStorageKey(env, storageKey);
    const original = await getStorageObject(env, fullKey);

    if (!original?.ok) {
        console.warn("[variants] original object missing:", fullKey);
        return { generated: 0, skipped: 0, failed: 1 };
    }

    const resolvedContentType = resolveImageContentType(
        fullKey,
        original.headers.get("content-type"),
        contentTypeHint,
    );

    if (!resolvedContentType.startsWith("image/") || isUncompressibleImageType(resolvedContentType)) {
        return { generated: 0, skipped: 0, failed: 0 };
    }

    const originalBuffer = await original.arrayBuffer();
    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (const width of THUMBNAIL_WIDTHS) {
        const variantKey = buildVariantStorageKey(fullKey, width);

        try {
            if (await isVariantObjectPresent(env, variantKey)) {
                skipped += 1;
                continue;
            }

            const resized = await resizeImageBuffer(originalBuffer, resolvedContentType, width);
            if (!resized) {
                failed += 1;
                console.warn("[variants] encode failed", variantKey, fullKey);
                continue;
            }

            await putStorageObjectAtKey(env, variantKey, resized.body, resized.contentType);
            generated += 1;
            console.info("[variants] generated", variantKey);
        } catch (error) {
            failed += 1;
            console.warn("[variants] failed", variantKey, error);
        }
    }

    return { generated, skipped, failed };
}
