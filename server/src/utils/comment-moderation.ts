type ConfigReader = {
    getOrDefault<T>(key: string, defaultValue: T): Promise<T>;
};

export async function isGuestCommentModerationEnabled(clientConfig: ConfigReader) {
    return Boolean(await clientConfig.getOrDefault("comment.moderation.guest", false));
}

export function isCommentApprovedValue(approved: unknown) {
    return approved === 1 || approved === true;
}

export function isCommentVisibleToViewer(approved: unknown, isAdmin: boolean) {
    if (isAdmin) {
        return true;
    }
    return isCommentApprovedValue(approved);
}
