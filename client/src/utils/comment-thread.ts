type ThreadComment = {
    id: number;
    parentId?: number | null;
    createdAt: Date | string;
};

export type CommentThread<T extends ThreadComment = ThreadComment> = {
    root: T;
    replies: T[];
};

function normalizeParentId(parentId: unknown): number | null {
    if (parentId == null || parentId === "" || parentId === 0) {
        return null;
    }
    const parsed = typeof parentId === "number" ? parentId : parseInt(String(parentId), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function groupCommentThreads<T extends ThreadComment>(comments: T[]): CommentThread<T>[] {
    const byId = new Map<number, T>();
    for (const comment of comments) {
        byId.set(comment.id, comment);
    }

    const roots: T[] = [];
    const repliesByParent = new Map<number, T[]>();

    for (const comment of comments) {
        const parentId = normalizeParentId(comment.parentId);
        if (parentId != null && byId.has(parentId)) {
            const list = repliesByParent.get(parentId) ?? [];
            list.push(comment);
            repliesByParent.set(parentId, list);
        } else {
            roots.push(comment);
        }
    }

    roots.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return roots.map((root) => ({
        root,
        replies: (repliesByParent.get(root.id) ?? []).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
    }));
}
