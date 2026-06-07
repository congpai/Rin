import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { comments, feeds, users } from "../db/schema";
import { profileAsync } from "../core/server-timing";
import { notify } from "../utils/webhook";
import { resolveWebhookConfig } from "./config-helpers";
import { resolveFeedCommentReplyContext } from "../utils/comment-parent";
import {
    isCommentApprovedValue,
    isCommentVisibleToViewer,
    isGuestCommentModerationEnabled,
} from "../utils/comment-moderation";
import { validateCommentContent } from "../utils/comment-content";
import { maybeNotifyGuestCommentReply } from "../utils/comment-reply-email";

function formatCommentRow(row: any) {
    const approved = isCommentApprovedValue(row.approved);
    if (row.user) {
        return {
            ...row,
            parentId: row.parentId ?? null,
            replyToId: row.replyToId ?? null,
            approved,
        };
    }
    const { user, ...rest } = row;
    return {
        ...rest,
        user: null,
        parentId: rest.parentId ?? null,
        replyToId: rest.replyToId ?? null,
        guestName: rest.guestName || "",
        guestEmail: rest.guestEmail || "",
        guestWebsite: rest.guestWebsite || "",
        approved,
    };
}

export function CommentService(): Hono {
    const app = new Hono();

    app.get('/:feed', async (c: AppContext) => {
        const db = c.get('db');
        const admin = c.get('admin');
        const feedId = parseInt(c.req.param('feed'));
        
        const comment_list = await profileAsync(c, 'comment_list_db', () => db.query.comments.findMany({
            where: eq(comments.feedId, feedId),
            columns: { feedId: false, userId: false },
            with: {
                user: {
                    columns: { id: true, username: true, avatar: true, website: true, permission: true }
                }
            },
            orderBy: [desc(comments.createdAt)]
        }));
        
        const result = comment_list
            .filter((row) => isCommentVisibleToViewer(row.approved, admin))
            .map(formatCommentRow);
        
        return c.json(result);
    });

    app.post('/:feed', async (c: AppContext) => {
        const db = c.get('db');
        const env = c.get('env');
        const serverConfig = c.get('serverConfig');
        const clientConfig = c.get('clientConfig');
        const uid = c.get('uid');
        const feedId = parseInt(c.req.param('feed'));
        const body = await profileAsync(c, 'comment_create_parse', () => c.req.json());
        const { content, guestName, guestEmail, guestWebsite, parentId, replyToId } = body;

        const contentError = validateCommentContent(content);
        if (contentError) {
            return c.text(contentError, 400);
        }

        const replyContext = await resolveFeedCommentReplyContext(db, feedId, parentId, replyToId);
        if ("error" in replyContext) {
            return c.text(replyContext.error, 400);
        }
        
        const exist = await profileAsync(c, 'comment_create_feed', () => db.query.feeds.findFirst({ where: eq(feeds.id, feedId) }));
        if (!exist) {
            return c.text('Feed not found', 400);
        }

        // 登录用户评论
        if (uid) {
            const user = await profileAsync(c, 'comment_create_user', () => db.query.users.findFirst({ where: eq(users.id, uid) }));
            if (!user) {
                return c.text('User not found', 400);
            }

            await db.insert(comments).values({
                feedId,
                userId: uid,
                content,
                parentId: replyContext.parentId,
                replyToId: replyContext.replyToId,
            });

            const { webhookUrl, webhookMethod, webhookContentType, webhookHeaders, webhookBodyTemplate } =
                await profileAsync(c, 'comment_create_webhook_config', () => resolveWebhookConfig(serverConfig, env));
            const frontendUrl = new URL(c.req.url).origin;
            try {
                await profileAsync(c, 'comment_create_notify', () => notify(
                    webhookUrl || "",
                    {
                        event: "comment.created",
                        message: `${frontendUrl}/feed/${feedId}\n${user.username} 评论了: ${exist.title}\n${content}`,
                        title: exist.title || "",
                        url: `${frontendUrl}/feed/${feedId}`,
                        username: user.username,
                        content,
                    },
                    {
                        method: webhookMethod,
                        contentType: webhookContentType,
                        headers: webhookHeaders,
                        bodyTemplate: webhookBodyTemplate,
                    },
                ));
            } catch (error) {
                console.error("Failed to send comment webhook", error);
            }

            try {
                await profileAsync(c, "comment_create_reply_email", () =>
                    maybeNotifyGuestCommentReply({
                        db,
                        env,
                        clientConfig,
                        origin: frontendUrl,
                        replyToId: replyContext.replyToId,
                        replyContent: content,
                        replyPending: false,
                        replier: { userId: uid },
                        page: {
                            type: "feed",
                            feedId,
                            title: exist.title || `文章 #${feedId}`,
                        },
                    }),
                );
            } catch (error) {
                console.error("Failed to send guest reply email", error);
            }

            return c.text('OK');
        }

        // 游客评论
        if (!guestName || !guestName.trim()) {
            return c.text('Guest name is required', 400);
        }
        if (!guestEmail || !guestEmail.trim()) {
            return c.text('Guest email is required', 400);
        }

        const moderateGuests = await isGuestCommentModerationEnabled(clientConfig);
        const approved = moderateGuests ? 0 : 1;

        await db.insert(comments).values({
            feedId,
            userId: null,
            content,
            guestName: guestName.trim(),
            guestEmail: guestEmail?.trim() || "",
            guestWebsite: guestWebsite?.trim() || "",
            parentId: replyContext.parentId,
            replyToId: replyContext.replyToId,
            approved,
        });

        const { webhookUrl, webhookMethod, webhookContentType, webhookHeaders, webhookBodyTemplate } =
            await profileAsync(c, 'comment_create_webhook_config', () => resolveWebhookConfig(serverConfig, env));
        const frontendUrl = new URL(c.req.url).origin;
        const moderationNote = moderateGuests ? "（待审核）" : "";
        try {
            await profileAsync(c, 'comment_create_notify', () => notify(
                webhookUrl || "",
                {
                    event: "comment.created",
                    message: `${frontendUrl}/feed/${feedId}\n游客 ${guestName} 评论了${moderationNote}: ${exist.title}\n${content}`,
                    title: exist.title || "",
                    url: `${frontendUrl}/feed/${feedId}`,
                    username: guestName,
                    content,
                },
                {
                    method: webhookMethod,
                    contentType: webhookContentType,
                    headers: webhookHeaders,
                    bodyTemplate: webhookBodyTemplate,
                },
            ));
        } catch (error) {
            console.error("Failed to send comment webhook", error);
        }

        try {
            await profileAsync(c, "comment_create_reply_email", () =>
                maybeNotifyGuestCommentReply({
                    db,
                    env,
                    clientConfig,
                    origin: frontendUrl,
                    replyToId: replyContext.replyToId,
                    replyContent: content,
                    replyPending: moderateGuests,
                    replier: {
                        guestName: guestName.trim(),
                        guestEmail: guestEmail?.trim() || "",
                    },
                    page: {
                        type: "feed",
                        feedId,
                        title: exist.title || `文章 #${feedId}`,
                    },
                }),
            );
        } catch (error) {
            console.error("Failed to send guest reply email", error);
        }

        if (moderateGuests) {
            return c.text('Pending moderation');
        }
        return c.text('OK');
    });

    app.patch('/approve/:id', async (c: AppContext) => {
        const db = c.get('db');
        const admin = c.get('admin');

        if (!admin) {
            return c.text('Permission denied', 403);
        }

        const id = parseInt(c.req.param('id'));
        const comment = await profileAsync(c, 'comment_approve_lookup', () =>
            db.query.comments.findFirst({ where: eq(comments.id, id) }),
        );

        if (!comment) {
            return c.text('Not found', 404);
        }

        if (isCommentApprovedValue(comment.approved)) {
            return c.text('OK');
        }

        await db.update(comments).set({ approved: 1 }).where(eq(comments.id, id));
        return c.text('OK');
    });

    app.delete('/:id', async (c: AppContext) => {
        const db = c.get('db');
        const uid = c.get('uid');
        const admin = c.get('admin');
        
        if (uid === undefined) {
            return c.text('Unauthorized', 401);
        }
        
        const id_num = parseInt(c.req.param('id'));
        const comment = await profileAsync(c, 'comment_delete_lookup', () => db.query.comments.findFirst({ where: eq(comments.id, id_num) }));
        
        if (!comment) {
            return c.text('Not found', 404);
        }
        
        // 管理员可删任意评论；普通用户只能删自己的
        if (admin) {
            await db.delete(comments).where(eq(comments.id, id_num));
            return c.text('OK');
        }
        
        if (comment.userId !== uid) {
            return c.text('Permission denied', 403);
        }
        
        await db.delete(comments).where(eq(comments.id, id_num));
        return c.text('OK');
    });

    return app;
}
