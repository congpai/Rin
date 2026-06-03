import { path_join } from "./path";
import {
    buildVariantStorageKey,
    THUMBNAIL_WIDTHS,
} from "./image-variants";
import {
    getStorageObject,
    headStorageObject,
    putStorageObjectAtKey,
    resolveStorageTarget,
} from "./storage";

function isUncompressibleImageType(contentType: string) {
    return contentType === "image/gif"
        || contentType === "image/svg+xml"
        || contentType === "image/svg";
}

async function resizeImageBuffer(
    body: ArrayBuffer,
    contentType: string,
    maxWidth: number,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
    const blob = new Blob([body], { type: contentType });
    let bitmap: ImageBitmap;

    try {
        bitmap = await createImageBitmap(blob);
    } catch (error) {
        console.warn("[variants] createImageBitmap failed:", error);
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

export async function generateImageVariants(env: Env, hashkey: string, contentType: string) {
    if (!contentType.startsWith("image/") || isUncompressibleImageType(contentType)) {
        return { generated: 0, skipped: 0 };
    }

    const target = resolveStorageTarget(env);
    const fullKey = path_join(target.folder, hashkey);
    const original = await getStorageObject(env, fullKey);

    if (!original?.ok) {
        console.warn("[variants] original object missing:", fullKey);
        return { generated: 0, skipped: 0 };
    }

    const originalBuffer = await original.arrayBuffer();
    let generated = 0;
    let skipped = 0;

    for (const width of THUMBNAIL_WIDTHS) {
        const variantKey = buildVariantStorageKey(fullKey, width);

        try {
            const existing = await headStorageObject(env, variantKey);
            if (existing) {
                skipped += 1;
                continue;
            }

            const resized = await resizeImageBuffer(originalBuffer, contentType, width);
            if (!resized) {
                skipped += 1;
                continue;
            }

            await putStorageObjectAtKey(env, variantKey, resized.body, resized.contentType);
            generated += 1;
            console.info("[variants] generated", variantKey);
        } catch (error) {
            skipped += 1;
            console.warn("[variants] failed", variantKey, error);
        }
    }

    return { generated, skipped };
}
