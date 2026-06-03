export const MAX_MOMENT_TAGS = 5;

export function normalizeTagNames(tags: unknown, max = MAX_MOMENT_TAGS) {
    if (!Array.isArray(tags)) {
        return [];
    }

    const normalized: string[] = [];
    const seen = new Set<string>();

    for (const raw of tags) {
        if (typeof raw !== "string") {
            continue;
        }
        const name = raw.trim();
        if (!name) {
            continue;
        }
        const key = name.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        normalized.push(name);
        if (normalized.length >= max) {
            break;
        }
    }

    return normalized;
}
