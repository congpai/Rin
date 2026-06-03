import { parseImageUrlMetadata } from "./image-upload";

const availableKeys = new Set<string>();
const unavailableKeys = new Set<string>();
const changeListeners = new Set<() => void>();

function notifyChange() {
    changeListeners.forEach((listener) => listener());
}

export function onVariantAvailabilityChange(listener: () => void) {
    changeListeners.add(listener);
    return () => {
        changeListeners.delete(listener);
    };
}

function getImageStorageKey(url: string) {
    const { src } = parseImageUrlMetadata(url);
    const match = src.match(/([a-f0-9]{40})/i);
    return match?.[1]?.toLowerCase() ?? src;
}

/** undefined = unknown, true = variants exist, false = confirmed missing */
export function getKnownVariantAvailability(url: string): boolean | undefined {
    const key = getImageStorageKey(url);
    if (availableKeys.has(key)) {
        return true;
    }
    if (unavailableKeys.has(key)) {
        return false;
    }
    return undefined;
}

export function markVariantsAvailable(url: string) {
    const key = getImageStorageKey(url);
    if (availableKeys.has(key)) {
        return;
    }
    unavailableKeys.delete(key);
    availableKeys.add(key);
    notifyChange();
}

export function markVariantsUnavailable(url: string) {
    const key = getImageStorageKey(url);
    if (unavailableKeys.has(key)) {
        return;
    }
    availableKeys.delete(key);
    unavailableKeys.add(key);
    notifyChange();
}
