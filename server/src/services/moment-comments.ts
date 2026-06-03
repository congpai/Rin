import { desc, eq } from "drizzle-orm";

import { Hono } from "hono";

import type { AppContext } from "../core/hono-types";

import { profileAsync } from "../core/server-timing";

import { momentComments, moments, users } from "../db/schema";

import { notify } from "../utils/webhook";

import { resolveWebhookConfig } from "./config-helpers";

import { resolveMomentCommentReplyContext } from "../utils/comment-parent";

import {

    isCommentApprovedValue,

    isCommentVisibleToViewer,

    isGuestCommentModerationEnabled,

} from "../utils/comment-moderation";

import { stripMarkdownImages, validateCommentContent } from "../utils/comment-content";
import { maybeNotifyGuestCommentReply } from "../utils/comment-reply-email";

function momentPageUrl(origin: string, momentId: number) {
    return `${origin}/moments#id-${momentId}`;
}



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



export function MomentCommentService(): Hono {

    const app = new Hono();



    app.get("/:moment", async (c: AppContext) => {

        const db = c.get("db");

        const admin = c.get("admin");

        const momentId = parseInt(c.req.param("moment"));



        const list = await profileAsync(c, "moment_comment_list_db", () =>

            db.query.momentComments.findMany({

                where: eq(momentComments.momentId, momentId),

                columns: { momentId: false, userId: false },

                with: {

                    user: {

                        columns: { id: true, username: true, avatar: true, permission: true },

                    },

                },

                orderBy: [desc(momentComments.createdAt)],

            }),

        );



        return c.json(

            list

                .filter((row) => isCommentVisibleToViewer(row.approved, admin))

                .map(formatCommentRow),

        );

    });



    app.post("/:moment", async (c: AppContext) => {

        const db = c.get("db");

        const env = c.get("env");

        const serverConfig = c.get("serverConfig");

        const clientConfig = c.get("clientConfig");

        const uid = c.get("uid");

        const momentId = parseInt(c.req.param("moment"));

        const body = await profileAsync(c, "moment_comment_create_parse", () => c.req.json());

        const { content, guestName, guestEmail, guestWebsite, parentId, replyToId } = body;



        const contentError = validateCommentContent(content);

        if (contentError) {

            return c.text(contentError, 400);

        }



        const replyContext = await resolveMomentCommentReplyContext(db, momentId, parentId, replyToId);

        if ("error" in replyContext) {

            return c.text(replyContext.error, 400);

        }



        const moment = await profileAsync(c, "moment_comment_create_lookup", () =>

            db.query.moments.findFirst({ where: eq(moments.id, momentId) }),

        );

        if (!moment) {

            return c.text("Moment not found", 400);

        }



        const preview = content.trim().slice(0, 120);



        if (uid) {

            const user = await profileAsync(c, "moment_comment_create_user", () =>

                db.query.users.findFirst({ where: eq(users.id, uid) }),

            );

            if (!user) {

                return c.text("User not found", 400);

            }



            await db.insert(momentComments).values({

                momentId,

                userId: uid,

                content: content.trim(),

                parentId: replyContext.parentId,

                replyToId: replyContext.replyToId,

            });



            const { webhookUrl, webhookMethod, webhookContentType, webhookHeaders, webhookBodyTemplate } =

                await profileAsync(c, "moment_comment_webhook_config", () =>

                    resolveWebhookConfig(serverConfig, env),

                );

            const frontendUrl = new URL(c.req.url).origin;

            try {

                await profileAsync(c, "moment_comment_notify", () =>

                    notify(

                        webhookUrl || "",

                        {

                            event: "comment.created",

                            message: `${momentPageUrl(frontendUrl, momentId)}\n${user.username} 评论了动态 #${momentId}\n${preview}`,

                            title: `Moment #${momentId}`,

                            url: momentPageUrl(frontendUrl, momentId),

                            username: user.username,

                            content: preview,

                        },

                        {

                            method: webhookMethod,

                            contentType: webhookContentType,

                            headers: webhookHeaders,

                            bodyTemplate: webhookBodyTemplate,

                        },

                    ),

                );

            } catch (error) {

                console.error("Failed to send moment comment webhook", error);

            }

            const momentTitle = stripMarkdownImages(moment.content).slice(0, 40)
                || `动态 #${momentId}`;

            try {

                await profileAsync(c, "moment_comment_reply_email", () =>

                    maybeNotifyGuestCommentReply({

                        db,

                        env,

                        clientConfig,

                        origin: frontendUrl,

                        replyToId: replyContext.replyToId,

                        replyContent: content.trim(),

                        replyPending: false,

                        replier: { userId: uid },

                        page: {

                            type: "moment",

                            momentId,

                            title: momentTitle,

                        },

                    }),

                );

            } catch (error) {

                console.error("Failed to send guest reply email", error);

            }

            return c.text("OK");

        }



        if (!guestName?.trim()) {

            return c.text("Guest name is required", 400);

        }



        if (!guestEmail?.trim()) {

            return c.text("Guest email is required", 400);

        }



        const moderateGuests = await isGuestCommentModerationEnabled(clientConfig);

        const approved = moderateGuests ? 0 : 1;



        await db.insert(momentComments).values({

            momentId,

            userId: null,

            content: content.trim(),

            guestName: guestName.trim(),

            guestEmail: guestEmail?.trim() || "",

            guestWebsite: guestWebsite?.trim() || "",

            parentId: replyContext.parentId,

            replyToId: replyContext.replyToId,

            approved,

        });



        const { webhookUrl, webhookMethod, webhookContentType, webhookHeaders, webhookBodyTemplate } =

            await profileAsync(c, "moment_comment_webhook_config", () =>

                resolveWebhookConfig(serverConfig, env),

            );

        const frontendUrl = new URL(c.req.url).origin;

        const moderationNote = moderateGuests ? "（待审核）" : "";

        try {

            await profileAsync(c, "moment_comment_notify", () =>

                notify(

                    webhookUrl || "",

                    {

                        event: "comment.created",

                        message: `${momentPageUrl(frontendUrl, momentId)}\n游客 ${guestName} 评论了${moderationNote}动态 #${momentId}\n${preview}`,

                        title: `Moment #${momentId}`,

                        url: momentPageUrl(frontendUrl, momentId),

                        username: guestName.trim(),

                        content: preview,

                    },

                    {

                        method: webhookMethod,

                        contentType: webhookContentType,

                        headers: webhookHeaders,

                        bodyTemplate: webhookBodyTemplate,

                    },

                ),

            );

        } catch (error) {

            console.error("Failed to send moment comment webhook", error);

        }

        const momentTitle = stripMarkdownImages(moment.content).slice(0, 40)
            || `动态 #${momentId}`;

        try {

            await profileAsync(c, "moment_comment_reply_email", () =>

                maybeNotifyGuestCommentReply({

                    db,

                    env,

                    clientConfig,

                    origin: frontendUrl,

                    replyToId: replyContext.replyToId,

                    replyContent: content.trim(),

                    replyPending: moderateGuests,

                    replier: {

                        guestName: guestName.trim(),

                        guestEmail: guestEmail?.trim() || "",

                    },

                    page: {

                        type: "moment",

                        momentId,

                        title: momentTitle,

                    },

                }),

            );

        } catch (error) {

            console.error("Failed to send guest reply email", error);

        }



        if (moderateGuests) {

            return c.text("Pending moderation");

        }

        return c.text("OK");

    });



    app.patch("/approve/:id", async (c: AppContext) => {

        const db = c.get("db");

        const admin = c.get("admin");



        if (!admin) {

            return c.text("Permission denied", 403);

        }



        const id = parseInt(c.req.param("id"));

        const comment = await profileAsync(c, "moment_comment_approve_lookup", () =>

            db.query.momentComments.findFirst({ where: eq(momentComments.id, id) }),

        );



        if (!comment) {

            return c.text("Not found", 404);

        }



        if (isCommentApprovedValue(comment.approved)) {

            return c.text("OK");

        }



        await db.update(momentComments).set({ approved: 1 }).where(eq(momentComments.id, id));

        return c.text("OK");

    });



    app.delete("/:id", async (c: AppContext) => {

        const db = c.get("db");

        const uid = c.get("uid");

        const admin = c.get("admin");



        if (uid === undefined) {

            return c.text("Unauthorized", 401);

        }



        const id = parseInt(c.req.param("id"));

        const comment = await profileAsync(c, "moment_comment_delete_lookup", () =>

            db.query.momentComments.findFirst({ where: eq(momentComments.id, id) }),

        );



        if (!comment) {

            return c.text("Not found", 404);

        }



        if (admin) {

            await db.delete(momentComments).where(eq(momentComments.id, id));

            return c.text("OK");

        }



        if (comment.userId !== uid) {

            return c.text("Permission denied", 403);

        }



        await db.delete(momentComments).where(eq(momentComments.id, id));

        return c.text("OK");

    });



    return app;

}


