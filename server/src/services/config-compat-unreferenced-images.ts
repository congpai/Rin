import type { DB } from "../core/hono-types";
import { collectReferencedOriginalImageStorageKeys } from "./config-compat-image-variants";
import {
    expandStorageKeysWithVariants,
    isVariantStorageFileName,
} from "../utils/image-variants";
import { deleteStorageObject, resolveFullStorageKey } from "../utils/storage";
import { isOwnedStorageKey } from "../utils/storage-image-cleanup";

const ORIGINAL_IMAGE_FILE_RE = /^[a-f0-9]{40}\.[a-z0-9]+$/i;

function normalizeFolder(folder: string) {
    return folder.replace(/^\/+|\/+$/g, "");
}

function storageKeyFileName(storageKey: string) {
    return storageKey.includes("/") ? storageKey.split("/").pop()! : storageKey;
}

export function isManagedImageStorageKey(storageKey: string, env: Env) {
    if (!isOwnedStorageKey(storageKey, env)) {
        return false;
    }

    const fileName = storageKeyFileName(storageKey);
    if (isVariantStorageFileName(fileName)) {
        return true;
    }

    return ORIGINAL_IMAGE_FILE_RE.test(fileName);
}

export async function collectExpandedReferencedStorageKeys(db: DB, env: Env) {
    const originals = await collectReferencedOriginalImageStorageKeys(db, env);
    const referenced = new Set<string>();

    for (const key of originals) {
        referenced.add(key);
        for (const variantKey of expandStorageKeysWithVariants([key])) {
            referenced.add(variantKey);
        }
    }

    return referenced;
}

export async function listOwnedStorageObjectKeys(env: Env) {
    const folder = normalizeFolder(env.S3_FOLDER || "");
    const prefix = folder ? `${folder}/` : "";
    const keys: string[] = [];

    if (!env.R2_BUCKET) {
        throw new Error("R2 bucket binding is required to scan storage objects");
    }

    let cursor: string | undefined;
    do {
        const result = await env.R2_BUCKET.list({
            prefix: prefix || undefined,
            cursor,
            limit: 1000,
        });

        for (const object of result.objects) {
            keys.push(object.key);
        }

        cursor = result.truncated ? result.cursor : undefined;
    } while (cursor);

    return keys;
}

export async function listUnreferencedStorageKeys(db: DB, env: Env) {
    const [referenced, stored] = await Promise.all([
        collectExpandedReferencedStorageKeys(db, env),
        listOwnedStorageObjectKeys(env),
    ]);

    return stored.filter((key) => !referenced.has(key) && isManagedImageStorageKey(key, env));
}

export async function countUnreferencedStorageObjects(db: DB, env: Env) {
    if (!env.R2_BUCKET) {
        return {
            storedObjects: 0,
            referencedObjects: 0,
            eligible: 0,
            listable: false,
        };
    }

    const [referenced, stored, orphans] = await Promise.all([
        collectExpandedReferencedStorageKeys(db, env),
        listOwnedStorageObjectKeys(env),
        listUnreferencedStorageKeys(db, env),
    ]);

    return {
        storedObjects: stored.length,
        referencedObjects: referenced.size,
        eligible: orphans.length,
        listable: true,
    };
}

export async function listUnreferencedImageCandidates(db: DB, env: Env) {
    const items = await listUnreferencedStorageKeys(db, env);
    return {
        generatedAt: new Date().toISOString(),
        items,
    };
}

export async function runUnreferencedImageCleanupForKeys(env: Env, storageKeys: string[]) {
    let deleted = 0;
    let failed = 0;

    for (const storageKey of storageKeys) {
        if (!isManagedImageStorageKey(storageKey, env)) {
            failed += 1;
            continue;
        }

        const fullKey = resolveFullStorageKey(env, storageKey);
        const keysToDelete = new Set<string>([fullKey]);
        for (const variantKey of expandStorageKeysWithVariants([fullKey])) {
            keysToDelete.add(variantKey);
        }

        for (const deleteKey of keysToDelete) {
            try {
                await deleteStorageObject(env, deleteKey);
                deleted += 1;
                console.info("[storage-cleanup] deleted unreferenced object:", deleteKey);
            } catch (error) {
                failed += 1;
                console.warn("[storage-cleanup] failed to delete unreferenced object:", deleteKey, error);
            }
        }
    }

    return {
        processed: storageKeys.length,
        deleted,
        failed,
    };
}
