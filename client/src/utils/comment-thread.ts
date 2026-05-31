type ThreadComment = {
    id: number;
    parentId?: number | null;
    createdAt: Date | string;
};

export type CommentThread<T extends ThreadComment = ThreadComment> = {
    root: T;
    replies: T[];
};

export function groupCommentThreads<T extends ThreadComment>(comments: T[]): CommentThread<T>[] {
    const roots: T[] = [];
    const repliesByParent = new Map<number, T[]>();

    for (const comment of comments) {
        if (comment.parentId) {
            const list = repliesByParent.get(comment.parentId) ?? [];
            list.push(comment);
            repliesByParent.set(comment.parentId, list);
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
