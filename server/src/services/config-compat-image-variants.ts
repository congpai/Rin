import type { DB } from "../core/hono-types";
import { comments, feeds, friends, momentComments, moments, users } from "../db/schema";
import { generateImageVariants } from "../utils/generate-image-variants";
import {
    buildVariantStorageKey,
    isVariantStorageFileName,
    THUMBNAIL_WIDTHS,
} from "../utils/image-variants";
import {
    collectStorageKeysFromContents,
    resolveStorageKeyFromImageUrl,
} from "../utils/storage-image-cleanup";
import { headStorageObject } from "../utils/storage";

const ORIGINAL_IMAGE_KEY_RE = /^[a-f0-9]{40}\.[a-z0-9]+$/i;
const SKIP_EXTENSIONS = new Set(["gif", "svg", "svgz"]);

function normalizeFolder(folder: string) {
    return folder.replace(/^\/+|\/+$/g, "");
}

function storageKeyFileName(storageKey: string) {
    return storageKey.includes("/") ? storageKey.split("/").pop()! : storageKey;
}

export function storageKeyToUploadKey(storageKey: string, env: Env) {
    const folder = normalizeFolder(env.S3_FOLDER || "");
    if (!folder) {
        return storageKey;
    }

    const prefix = `${folder}/`;
    if (storageKey.startsWith(prefix)) {
        return storageKey.slice(prefix.length);
    }

    return storageKey;
}

function guessContentTypeFromStorageKey(storageKey: string) {
    const extension = storageKeyFileName(storageKey).split(".").pop()?.toLowerCase() ?? "";
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
        case "gif":
            return "image/gif";
        case "svg":
        case "svgz":
            return "image/svg+xml";
        default:
            return "application/octet-stream";
    }
}

export function isOriginalImageStorageKey(storageKey: string) {
    const fileName = storageKeyFileName(storageKey);
    if (isVariantStorageFileName(fileName)) {
        return false;
    }

    const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (SKIP_EXTENSIONS.has(extension)) {
        return false;
    }

    return ORIGINAL_IMAGE_KEY_RE.test(fileName);
}

async function collectAvatarStorageKeys(db: DB, env: Env) {
    const keys = new Set<string>();
    const [userRows, friendRows] = await Promise.all([
        db.select({ avatar: users.avatar }).from(users),
        db.select({ avatar: friends.avatar }).from(friends),
    ]);

    for (const row of [...userRows, ...friendRows]) {
        if (!row.avatar) {
            continue;
        }
        const key = resolveStorageKeyFromImageUrl(row.avatar, env);
        if (key) {
            keys.add(key);
        }
    }

    return [...keys];
}

export async function collectReferencedOriginalImageStorageKeys(db: DB, env: Env) {
    const [feedRows, momentRows, commentRows, momentCommentRows] = await Promise.all([
        db.select({ content: feeds.content }).from(feeds),
        db.select({ content: moments.content }).from(moments),
        db.select({ content: comments.content }).from(comments),
        db.select({ content: momentComments.content }).from(momentComments),
    ]);

    const keys = new Set<string>([
        ...collectStorageKeysFromContents(feedRows.map((row) => row.content), env),
        ...collectStorageKeysFromContents(momentRows.map((row) => row.content), env),
        ...collectStorageKeysFromContents(commentRows.map((row) => row.content), env),
        ...collectStorageKeysFromContents(momentCommentRows.map((row) => row.content), env),
        ...(await collectAvatarStorageKeys(db, env)),
    ]);

    return [...keys].filter(isOriginalImageStorageKey);
}

export async function storageKeyNeedsVariantBackfill(env: Env, storageKey: string) {
    if (!isOriginalImageStorageKey(storageKey)) {
        return false;
    }

    for (const width of THUMBNAIL_WIDTHS) {
        const variantKey = buildVariantStorageKey(storageKey, width);
        const existing = await headStorageObject(env, variantKey);
        if (!existing) {
            return true;
        }
    }

    return false;
}

export async function countImageVariantBackfillEligible(db: DB, env: Env) {
    const keys = await collectReferencedOriginalImageStorageKeys(db, env);
    let eligible = 0;

    for (const key of keys) {
        if (await storageKeyNeedsVariantBackfill(env, key)) {
            eligible += 1;
        }
    }

    return {
        referencedOriginals: keys.length,
        eligible,
    };
}

export async function listImageVariantBackfillCandidates(db: DB, env: Env) {
    const keys = await collectReferencedOriginalImageStorageKeys(db, env);
    const items: string[] = [];

    for (const key of keys) {
        if (await storageKeyNeedsVariantBackfill(env, key)) {
            items.push(key);
        }
    }

    return {
        generatedAt: new Date().toISOString(),
        items,
    };
}

export async function runImageVariantBackfillForKeys(env: Env, storageKeys: string[]) {
    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (const storageKey of storageKeys) {
        if (!isOriginalImageStorageKey(storageKey)) {
            skipped += 1;
            continue;
        }

        try {
            const result = await generateImageVariants(
                env,
                storageKeyToUploadKey(storageKey, env),
                guessContentTypeFromStorageKey(storageKey),
            );
            generated += result.generated;
            skipped += result.skipped;
            if (result.generated === 0 && result.skipped === 0) {
                failed += 1;
            }
        } catch (error) {
            failed += 1;
            console.warn("[variants-backfill] failed for", storageKey, error);
        }
    }

    return {
        processed: storageKeys.length,
        generated,
        skipped,
        failed,
    };
}
