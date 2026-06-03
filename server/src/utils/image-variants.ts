export const THUMBNAIL_WIDTHS = [320, 640, 960] as const;
export const VARIANT_FILE_EXTENSION = "webp";

const VARIANT_KEY_RE = /^([a-f0-9]{40})_w(320|640|960)\.[a-z0-9]+$/i;

export function isVariantStorageFileName(name: string) {
    return VARIANT_KEY_RE.test(name);
}

export function isValidVariantStorageKey(storageKey: string) {
    const fileName = storageKey.includes("/") ? storageKey.split("/").pop()! : storageKey;
    return isVariantStorageFileName(fileName);
}

export function buildVariantStorageKey(baseStorageKey: string, width: number) {
    const slash = baseStorageKey.lastIndexOf("/");
    const folder = slash >= 0 ? `${baseStorageKey.slice(0, slash + 1)}` : "";
    const fileName = slash >= 0 ? baseStorageKey.slice(slash + 1) : baseStorageKey;
    if (isVariantStorageFileName(fileName)) {
        return baseStorageKey;
    }

    const dot = fileName.lastIndexOf(".");
    const base = dot > 0 ? fileName.slice(0, dot) : fileName;
    return `${folder}${base}_w${width}.${VARIANT_FILE_EXTENSION}`;
}

export function getBaseStorageKeyFromVariant(storageKey: string) {
    const fileName = storageKey.includes("/") ? storageKey.split("/").pop()! : storageKey;
    if (!isVariantStorageFileName(fileName)) {
        return null;
    }

    const slash = storageKey.lastIndexOf("/");
    const folder = slash >= 0 ? `${storageKey.slice(0, slash + 1)}` : "";
    const match = fileName.match(/^([a-f0-9]{40})_w(320|640|960)\.[a-z0-9]+$/i);
    if (!match) {
        return null;
    }

    return `${folder}${match[1]}.png`;
}

export function listVariantStorageKeys(baseStorageKey: string, widths: readonly number[] = THUMBNAIL_WIDTHS) {
    const fileName = baseStorageKey.includes("/") ? baseStorageKey.split("/").pop()! : baseStorageKey;
    if (isVariantStorageFileName(fileName)) {
        return [];
    }
    return widths.map((width) => buildVariantStorageKey(baseStorageKey, width));
}

export function expandStorageKeysWithVariants(storageKeys: string[]) {
    const expanded = new Set<string>();

    for (const key of storageKeys) {
        const fileName = key.includes("/") ? key.split("/").pop()! : key;
        expanded.add(key);
        if (!isVariantStorageFileName(fileName)) {
            for (const variantKey of listVariantStorageKeys(key)) {
                expanded.add(variantKey);
            }
        }
    }

    return [...expanded];
}
