export const MAX_MOMENT_TAGS = 5;

export function parseTagsInput(input: string, max = MAX_MOMENT_TAGS) {
    const tags = input
        .split("#")
        .map((tag) => tag.trim())
        .filter(Boolean);

    const normalized: string[] = [];
    const seen = new Set<string>();

    for (const tag of tags) {
        const key = tag.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        normalized.push(tag);
        if (normalized.length >= max) {
            break;
        }
    }

    return normalized;
}

export function formatTagsInput(tags: Array<{ name: string }>) {
    return tags.map((tag) => `#${tag.name}`).join(" ");
}
