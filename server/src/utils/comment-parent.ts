import { eq } from "drizzle-orm";
import type { DB } from "../core/hono-types";
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
    db: DB,
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
    if (parent.parentId != null) {
        return { error: "Nested replies are not supported" };
    }
    return { parentId: parsed };
}

export async function resolveMomentCommentParentId(
    db: DB,
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
    if (parent.parentId != null) {
        return { error: "Nested replies are not supported" };
    }
    return { parentId: parsed };
}

function validateReplyTargetInThread(
    target: { id: number; parentId: number | null },
    rootId: number,
): { replyToId: number } | { error: string } {
    if (target.id !== rootId && target.parentId !== rootId) {
        return { error: "Invalid reply target" };
    }
    return { replyToId: target.id };
}

async function resolveFeedReplyTarget(
    db: DB,
    feedId: number,
    rootId: number,
    replyToId: unknown,
): Promise<{ replyToId: number } | { error: string }> {
    const parsed = parseParentId(replyToId);
    if (parsed === "invalid") {
        return { error: "Invalid reply target" };
    }

    const effectiveReplyTo = parsed ?? rootId;
    const target = await db.query.comments.findFirst({
        where: eq(comments.id, effectiveReplyTo),
    });
    if (!target) {
        return { error: "Reply target not found" };
    }
    if (target.feedId !== feedId) {
        return { error: "Invalid reply target" };
    }

    const validated = validateReplyTargetInThread(target, rootId);
    if ("error" in validated) {
        return validated;
    }
    return { replyToId: effectiveReplyTo };
}

async function resolveMomentReplyTarget(
    db: DB,
    momentId: number,
    rootId: number,
    replyToId: unknown,
): Promise<{ replyToId: number } | { error: string }> {
    const parsed = parseParentId(replyToId);
    if (parsed === "invalid") {
        return { error: "Invalid reply target" };
    }

    const effectiveReplyTo = parsed ?? rootId;
    const target = await db.query.momentComments.findFirst({
        where: eq(momentComments.id, effectiveReplyTo),
    });
    if (!target) {
        return { error: "Reply target not found" };
    }
    if (target.momentId !== momentId) {
        return { error: "Invalid reply target" };
    }

    const validated = validateReplyTargetInThread(target, rootId);
    if ("error" in validated) {
        return validated;
    }
    return { replyToId: effectiveReplyTo };
}

export async function resolveFeedCommentReplyContext(
    db: DB,
    feedId: number,
    parentId: unknown,
    replyToId: unknown,
): Promise<{ parentId: number | null; replyToId: number | null } | { error: string }> {
    const parentResult = await resolveFeedCommentParentId(db, feedId, parentId);
    if ("error" in parentResult) {
        return parentResult;
    }

    if (parentResult.parentId === null) {
        const parsedReplyTo = parseParentId(replyToId);
        if (parsedReplyTo === "invalid") {
            return { error: "Invalid reply target" };
        }
        if (parsedReplyTo != null) {
            return { error: "replyToId is only allowed for thread replies" };
        }
        return { parentId: null, replyToId: null };
    }

    const replyTarget = await resolveFeedReplyTarget(
        db,
        feedId,
        parentResult.parentId,
        replyToId,
    );
    if ("error" in replyTarget) {
        return replyTarget;
    }

    return {
        parentId: parentResult.parentId,
        replyToId: replyTarget.replyToId,
    };
}

export async function resolveMomentCommentReplyContext(
    db: DB,
    momentId: number,
    parentId: unknown,
    replyToId: unknown,
): Promise<{ parentId: number | null; replyToId: number | null } | { error: string }> {
    const parentResult = await resolveMomentCommentParentId(db, momentId, parentId);
    if ("error" in parentResult) {
        return parentResult;
    }

    if (parentResult.parentId === null) {
        const parsedReplyTo = parseParentId(replyToId);
        if (parsedReplyTo === "invalid") {
            return { error: "Invalid reply target" };
        }
        if (parsedReplyTo != null) {
            return { error: "replyToId is only allowed for thread replies" };
        }
        return { parentId: null, replyToId: null };
    }

    const replyTarget = await resolveMomentReplyTarget(
        db,
        momentId,
        parentResult.parentId,
        replyToId,
    );
    if ("error" in replyTarget) {
        return replyTarget;
    }

    return {
        parentId: parentResult.parentId,
        replyToId: replyTarget.replyToId,
    };
}
