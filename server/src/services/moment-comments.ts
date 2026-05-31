import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { momentComments, moments, users } from "../db/schema";
import { notify } from "../utils/webhook";
import { resolveWebhookConfig } from "./config-helpers";

import { notify } from "../utils/webhook";
import { resolveWebhookConfig } from "./config-helpers";
import { resolveMomentCommentParentId } from "../utils/comment-parent";

function formatCommentRow(row: any) {
    if (row.user) {
        return {
            ...row,
            parentId: row.parentId ?? null,
        };
    }
    const { user, ...rest } = row;
    return {
        ...rest,
        user: null,
        parentId: rest.parentId ?? null,
        guestName: rest.guestName || "",
        guestEmail: rest.guestEmail || "",
        guestWebsite: rest.guestWebsite || "",
    };
}

export function MomentCommentService(): Hono {
    const app = new Hono();

    app.get("/:moment", async (c: AppContext) => {
        const db = c.get("db");
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

        return c.json(list.map(formatCommentRow));
    });

    app.post("/:moment", async (c: AppContext) => {
        const db = c.get("db");
        const env = c.get("env");
        const serverConfig = c.get("serverConfig");
        const uid = c.get("uid");
        const momentId = parseInt(c.req.param("moment"));
        const body = await profileAsync(c, "moment_comment_create_parse", () => c.req.json());
        const { content, guestName, guestEmail, guestWebsite, parentId } = body;

        if (!content?.trim()) {
            return c.text("Content is required", 400);
        }

        const parentResult = await resolveMomentCommentParentId(db, momentId, parentId);
        if ("error" in parentResult) {
            return c.text(parentResult.error, 400);
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
                parentId: parentResult.parentId,
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
                            message: `${frontendUrl}/moments\n${user.username} 评论了动态 #${momentId}\n${preview}`,
                            title: `Moment #${momentId}`,
                            url: `${frontendUrl}/moments`,
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
            return c.text("OK");
        }

        if (!guestName?.trim()) {
            return c.text("Guest name is required", 400);
        }

        if (!guestEmail?.trim()) {
            return c.text("Guest email is required", 400);
        }

        await db.insert(momentComments).values({
            momentId,
            userId: null,
            content: content.trim(),
            guestName: guestName.trim(),
            guestEmail: guestEmail?.trim() || "",
            guestWebsite: guestWebsite?.trim() || "",
            parentId: parentResult.parentId,
            approved: 1,
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
                        message: `${frontendUrl}/moments\n游客 ${guestName} 评论了动态 #${momentId}\n${preview}`,
                        title: `Moment #${momentId}`,
                        url: `${frontendUrl}/moments`,
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
