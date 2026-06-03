import { sql, type AnyColumn } from "drizzle-orm";
import type { DB } from "../core/hono-types";
import {
    comments,
    feeds,
    friends,
    momentComments,
    moments,
    users,
} from "../db/schema";
import { listContentImageUrls, stripImageMetadataFromUrl } from "./image";
import { deleteStorageObject } from "./storage";
import { expandStorageKeysWithVariants } from "./image-variants";

function normalizeFolder(folder: string) {
    return folder.replace(/^\/+|\/+$/g, "");
}

function decodeBlobPath(value: string) {
    const withoutQuery = value.split("?")[0] || "";
    try {
        return decodeURIComponent(withoutQuery);
    } catch {
        return withoutQuery;
    }
}

function storageKeyFromPublicPath(path: string) {
    const normalized = path.replace(/^\/+/, "");
    if (normalized.startsWith("api/blob/")) {
        return decodeBlobPath(normalized.slice("api/blob/".length));
    }
    return decodeBlobPath(normalized);
}

export function resolveStorageKeyFromImageUrl(rawUrl: string, env: Env): string | null {
    const stripped = stripImageMetadataFromUrl(rawUrl)?.trim();
    if (!stripped) {
        return null;
    }

    let storageKey: string | null = null;

    if (stripped.startsWith("/api/blob/")) {
        storageKey = storageKeyFromPublicPath(stripped);
    } else {
        try {
            const parsed = new URL(stripped, "https://placeholder.local");
            const pathname = parsed.pathname.replace(/^\/+/, "");

            if (pathname.startsWith("api/blob/")) {
                storageKey = storageKeyFromPublicPath(pathname);
            } else {
                const accessHost = env.S3_ACCESS_HOST?.replace(/\/+$/, "");
                if (accessHost && stripped.startsWith(`${accessHost}/`)) {
                    storageKey = storageKeyFromPublicPath(stripped.slice(accessHost.length + 1));
                } else if (env.S3_ENDPOINT && env.S3_BUCKET) {
                    const endpoint = env.S3_ENDPOINT.replace(/\/+$/, "");
                    const forcePathStyle = env.S3_FORCE_PATH_STYLE === "true";
                    if (forcePathStyle) {
                        const prefix = `${endpoint}/${env.S3_BUCKET}/`;
                        if (stripped.startsWith(prefix)) {
                            storageKey = decodeBlobPath(stripped.slice(prefix.length));
                        }
                    } else {
                        const endpointHost = new URL(endpoint).host;
                        const bucketHost = `${env.S3_BUCKET}.${endpointHost}`;
                        if (parsed.host === bucketHost) {
                            storageKey = decodeBlobPath(pathname);
                        }
                    }
                }
            }
        } catch {
            return null;
        }
    }

    if (!storageKey || storageKey.includes("..")) {
        return null;
    }

    return isOwnedStorageKey(storageKey, env) ? storageKey : null;
}

export function isOwnedStorageKey(storageKey: string, env: Env) {
    const folder = normalizeFolder(env.S3_FOLDER || "");
    if (!folder) {
        return storageKey.length > 0;
    }
    return storageKey === folder || storageKey.startsWith(`${folder}/`);
}

export function buildStorageReferencePatterns(storageKey: string) {
    return [
        storageKey,
        storageKey.replace(/\//g, "%2F"),
    ];
}

function columnContainsPattern(column: AnyColumn, pattern: string) {
    return sql`INSTR(${column}, ${pattern}) > 0`;
}

function nullableColumnContainsPattern(column: AnyColumn, pattern: string) {
    return sql`${column} IS NOT NULL AND INSTR(${column}, ${pattern}) > 0`;
}

export function collectStorageKeysFromContents(contents: string[], env: Env) {
    const keys = new Set<string>();

    for (const content of contents) {
        for (const url of listContentImageUrls(content)) {
            const key = resolveStorageKeyFromImageUrl(url, env);
            if (key) {
                keys.add(key);
            }
        }
    }

    return [...keys];
}

export async function findStorageKeyReferenceSource(db: DB, storageKey: string) {
    const patterns = buildStorageReferencePatterns(storageKey);

    for (const pattern of patterns) {
        const [
            feedHit,
            momentHit,
            commentHit,
            momentCommentHit,
            userHit,
            friendHit,
        ] = await Promise.all([
            db.select({ id: feeds.id }).from(feeds).where(columnContainsPattern(feeds.content, pattern)).limit(1),
            db.select({ id: moments.id }).from(moments).where(columnContainsPattern(moments.content, pattern)).limit(1),
            db.select({ id: comments.id }).from(comments).where(columnContainsPattern(comments.content, pattern)).limit(1),
            db.select({ id: momentComments.id }).from(momentComments).where(columnContainsPattern(momentComments.content, pattern)).limit(1),
            db.select({ id: users.id }).from(users).where(nullableColumnContainsPattern(users.avatar, pattern)).limit(1),
            db.select({ id: friends.id }).from(friends).where(nullableColumnContainsPattern(friends.avatar, pattern)).limit(1),
        ]);

        if (feedHit.length > 0) {
            return `feeds#${feedHit[0]!.id}`;
        }
        if (momentHit.length > 0) {
            return `moments#${momentHit[0]!.id}`;
        }
        if (commentHit.length > 0) {
            return `comments#${commentHit[0]!.id}`;
        }
        if (momentCommentHit.length > 0) {
            return `moment_comments#${momentCommentHit[0]!.id}`;
        }
        if (userHit.length > 0) {
            return `users#${userHit[0]!.id}`;
        }
        if (friendHit.length > 0) {
            return `friends#${friendHit[0]!.id}`;
        }
    }

    return null;
}

export async function isStorageKeyReferenced(db: DB, storageKey: string) {
    return (await findStorageKeyReferenceSource(db, storageKey)) !== null;
}

export async function cleanupUnreferencedImagesFromContents(
    db: DB,
    env: Env,
    contents: string[],
) {
    const keys = collectStorageKeysFromContents(contents, env);
    if (keys.length === 0) {
        const imageUrls = contents.flatMap((content) => listContentImageUrls(content));
        if (imageUrls.length > 0) {
            console.warn("[storage-cleanup] image urls found but no owned storage keys resolved:", imageUrls);
        }
        return { scanned: 0, deleted: 0, skipped: 0 };
    }

    let deleted = 0;
    let skipped = 0;

    for (const key of keys) {
        try {
            const referenceSource = await findStorageKeyReferenceSource(db, key);
            if (referenceSource) {
                skipped += 1;
                console.info("[storage-cleanup] skipped referenced object:", key, "referenced by", referenceSource);
                continue;
            }

            const keysToDelete = expandStorageKeysWithVariants([key]);
            for (const deleteKey of keysToDelete) {
                try {
                    await deleteStorageObject(env, deleteKey);
                    deleted += 1;
                    console.info("[storage-cleanup] deleted unreferenced object:", deleteKey);
                } catch (error) {
                    skipped += 1;
                    console.error("[storage-cleanup] failed to delete object:", deleteKey, error);
                }
            }
        } catch (error) {
            skipped += 1;
            console.error("[storage-cleanup] failed to process object:", key, error);
        }
    }

    return { scanned: keys.length, deleted, skipped };
}

export async function cleanupRemovedImagesFromPreviousContent(
    db: DB,
    env: Env,
    previousContent: string,
    nextContent?: string,
) {
    if (!previousContent || previousContent === nextContent) {
        return { scanned: 0, deleted: 0, skipped: 0 };
    }

    return cleanupUnreferencedImagesFromContents(db, env, [previousContent]);
}
