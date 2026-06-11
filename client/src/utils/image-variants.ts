import { attachImageMetadataToUrl, parseImageUrlMetadata } from "./image-upload";

export const THUMBNAIL_WIDTHS = [640, 960] as const;
export const VARIANT_FILE_EXTENSION = "webp";

const VARIANT_FILE_RE = /^([a-f0-9]{40})_w(640|960)\.[a-z0-9]+$/i;
const BLOB_PATH_RE = /\/api\/blob\//;

export function isVariantFileName(fileName: string) {
    return VARIANT_FILE_RE.test(fileName);
}

export function buildVariantFileName(baseFileName: string, width: number) {
    if (isVariantFileName(baseFileName)) {
        return baseFileName;
    }

    const dot = baseFileName.lastIndexOf(".");
    const base = dot > 0 ? baseFileName.slice(0, dot) : baseFileName;
    return `${base}_w${width}.${VARIANT_FILE_EXTENSION}`;
}

export function buildVariantStorageKey(baseStorageKey: string, width: number) {
    const slash = baseStorageKey.lastIndexOf("/");
    const folder = slash >= 0 ? `${baseStorageKey.slice(0, slash + 1)}` : "";
    const fileName = slash >= 0 ? baseStorageKey.slice(slash + 1) : baseStorageKey;
    return `${folder}${buildVariantFileName(fileName, width)}`;
}

export function parseStorageFileNameFromUrl(url?: string | null) {
    if (!url) {
        return null;
    }

    const { src } = parseImageUrlMetadata(url);
    const blobMatch = src.match(/\/api\/blob\/(.+)$/);
    if (blobMatch) {
        const path = decodeURIComponent(blobMatch[1]);
        return path.split("/").pop() ?? null;
    }

    try {
        const parsed = new URL(src);
        const fileName = parsed.pathname.split("/").pop();
        return fileName || null;
    } catch {
        return null;
    }
}

export function parseStorageKeyFromUrl(url?: string | null) {
    const fileName = parseStorageFileNameFromUrl(url);
    if (!fileName) {
        return null;
    }

    const blobMatch = parseImageUrlMetadata(url!).src.match(/\/api\/blob\/(.+)$/);
    if (blobMatch) {
        return decodeURIComponent(blobMatch[1]);
    }

    try {
        const parsed = new URL(parseImageUrlMetadata(url!).src);
        const path = parsed.pathname.replace(/^\/+/, "");
        return path || null;
    } catch {
        return null;
    }
}

const ORIGINAL_IMAGE_FILE_RE = /^[a-f0-9]{40}\.[a-z0-9]+$/i;

export function isVariantCapableImageUrl(url?: string | null) {
    if (!url) {
        return false;
    }
    const { src } = parseImageUrlMetadata(url);
    if (BLOB_PATH_RE.test(src)) {
        return true;
    }

    if (/\/images\/[a-f0-9]{40}\.[a-z0-9]+$/i.test(src)) {
        return true;
    }

    const fileName = parseStorageFileNameFromUrl(url);
    return Boolean(fileName && ORIGINAL_IMAGE_FILE_RE.test(fileName) && !isVariantFileName(fileName));
}

function encodeBlobStoragePath(storageKey: string) {
    return storageKey
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
}

export function buildVariantImageUrl(src: string, width: number) {
    const { src: cleanSrc, blurhash, width: metaWidth, height: metaHeight } = parseImageUrlMetadata(src);
    if (!isVariantCapableImageUrl(cleanSrc)) {
        return cleanSrc;
    }

    const blobMatch = cleanSrc.match(/^(\/api\/blob\/)(.+)$/);
    if (blobMatch) {
        const storageKey = decodeURIComponent(blobMatch[2]);
        const variantKey = buildVariantStorageKey(storageKey, width);
        const variantSrc = `${blobMatch[1]}${encodeBlobStoragePath(variantKey)}`;
        return attachImageMetadataToUrl(variantSrc, {
            blurhash,
            width: metaWidth,
            height: metaHeight,
        });
    }

    try {
        const parsed = new URL(cleanSrc, "https://placeholder.local");
        const segments = parsed.pathname.split("/");
        const fileName = segments.pop();
        if (!fileName || isVariantFileName(fileName)) {
            return cleanSrc;
        }
        segments.push(buildVariantFileName(fileName, width));
        parsed.pathname = segments.join("/");
        return attachImageMetadataToUrl(`${parsed.origin}${parsed.pathname}`, {
            blurhash,
            width: metaWidth,
            height: metaHeight,
        });
    } catch {
        return cleanSrc;
    }
}
