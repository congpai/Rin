import { eq } from "drizzle-orm";
import { comments, momentComments } from "../db/schema";

function parseParentId(parentId: unknown): number | null | "invalid" {
    if (parentId === undefined || parentId === null || parentId === "") {
        return null;
    }
    const parsed = typeof parentId === "number" ? parentId : parseInt(String(parentId), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return "invalid";
    }
    return parsed;
}

export async function resolveFeedCommentParentId(
    db: {
        query: {
            comments: {
                findFirst: (args: { where: unknown }) => Promise<{
                    id: number;
                    feedId: number;
                    parentId: number | null;
                } | undefined>;
            };
        };
    },
    feedId: number,
    parentId: unknown,
): Promise<{ parentId: number | null } | { error: string }> {
    const parsed = parseParentId(parentId);
    if (parsed === "invalid") {
        return { error: "Invalid parent comment" };
    }
    if (parsed === null) {
        return { parentId: null };
    }

    const parent = await db.query.comments.findFirst({
        where: eq(comments.id, parsed),
    });
    if (!parent) {
        return { error: "Parent comment not found" };
    }
    if (parent.feedId !== feedId) {
        return { error: "Invalid parent comment" };
    }
    if (parent.parentId) {
        return { error: "Nested replies are not supported" };
    }
    return { parentId: parsed };
}

export async function resolveMomentCommentParentId(
    db: {
        query: {
            momentComments: {
                findFirst: (args: { where: unknown }) => Promise<{
                    id: number;
                    momentId: number;
                    parentId: number | null;
                } | undefined>;
            };
        };
    },
    momentId: number,
    parentId: unknown,
): Promise<{ parentId: number | null } | { error: string }> {
    const parsed = parseParentId(parentId);
    if (parsed === "invalid") {
        return { error: "Invalid parent comment" };
    }
    if (parsed === null) {
        return { parentId: null };
    }

    const parent = await db.query.momentComments.findFirst({
        where: eq(momentComments.id, parsed),
    });
    if (!parent) {
        return { error: "Parent comment not found" };
    }
    if (parent.momentId !== momentId) {
        return { error: "Invalid parent comment" };
    }
    if (parent.parentId) {
        return { error: "Nested replies are not supported" };
    }
    return { parentId: parsed };
}
