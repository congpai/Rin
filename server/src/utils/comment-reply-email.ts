import { eq } from "drizzle-orm";
import type { CacheImpl, DB } from "../core/hono-types";
import { comments, momentComments, users } from "../db/schema";
import { stripMarkdownImages } from "./comment-content";
import { isResendConfigured, sendResendEmail } from "./resend";

type Replier = {
    userId?: number;
    guestName?: string;
    guestEmail?: string;
};

type FeedPage = {
    type: "feed";
    feedId: number;
    title: string;
};

type MomentPage = {
    type: "moment";
    momentId: number;
    title: string;
};

function escapeHtml(text: string) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildReplyEmailHtml(options: {
    siteName: string;
    recipientName: string;
    replierName: string;
    pageTitle: string;
    pageUrl: string;
    replyPreview: string;
    pendingNote: string;
}) {
    const pending = options.pendingNote
        ? `<p style="color:#b45309;margin:0 0 12px;">${escapeHtml(options.pendingNote)}</p>`
        : "";

    return `<div style="font-family:sans-serif;line-height:1.6;color:#111;">
<p>你好，${escapeHtml(options.recipientName)}：</p>
<p><strong>${escapeHtml(options.replierName)}</strong> 在「${escapeHtml(options.siteName)}」回复了你在「${escapeHtml(options.pageTitle)}」下的评论：</p>
${pending}
<blockquote style="margin:12px 0;padding:12px;border-left:3px solid #e5e7eb;background:#f9fafb;">${escapeHtml(options.replyPreview)}</blockquote>
<p><a href="${escapeHtml(options.pageUrl)}">点击查看</a></p>
<p style="color:#6b7280;font-size:12px;">此邮件由评论系统自动发送，请勿直接回复本邮件。</p>
</div>`;
}

async function resolveReplier(
    db: DB,
    replier: Replier,
): Promise<{ name: string; email: string }> {
    if (replier.userId) {
        const user = await db.query.users.findFirst({
            where: eq(users.id, replier.userId),
            columns: { username: true },
        });
        return {
            name: user?.username || "博主",
            email: "",
        };
    }

    return {
        name: replier.guestName?.trim() || "访客",
        email: replier.guestEmail?.trim() || "",
    };
}

export async function maybeNotifyGuestCommentReply(options: {
    db: DB;
    env: Env;
    clientConfig: CacheImpl;
    origin: string;
    replyToId: number | null;
    replyContent: string;
    replyPending: boolean;
    replier: Replier;
    page: FeedPage | MomentPage;
}) {
    if (!options.replyToId || !isResendConfigured(options.env)) {
        return;
    }

    const target = options.page.type === "feed"
        ? await options.db.query.comments.findFirst({
            where: eq(comments.id, options.replyToId),
        })
        : await options.db.query.momentComments.findFirst({
            where: eq(momentComments.id, options.replyToId),
        });

    if (!target || target.userId != null) {
        return;
    }

    const recipientEmail = target.guestEmail?.trim() || "";
    if (!recipientEmail || !isValidEmail(recipientEmail)) {
        return;
    }

    const replierInfo = await resolveReplier(options.db, options.replier);
    if (
        replierInfo.email
        && normalizeEmail(replierInfo.email) === normalizeEmail(recipientEmail)
    ) {
        return;
    }

    const siteName = String(await options.clientConfig.getOrDefault("site.name", "Rin") || "Rin");
    const pageUrl = options.page.type === "feed"
        ? `${options.origin}/feed/${options.page.feedId}`
        : `${options.origin}/moments#id-${options.page.momentId}`;

    const replyPreview = stripMarkdownImages(options.replyContent.trim()).slice(0, 300)
        || options.replyContent.trim().slice(0, 300)
        || "（图片评论）";

    const subject = `【${siteName}】${replierInfo.name} 回复了您的评论`;
    const html = buildReplyEmailHtml({
        siteName,
        recipientName: target.guestName?.trim() || "访客",
        replierName: replierInfo.name,
        pageTitle: options.page.title,
        pageUrl,
        replyPreview,
        pendingNote: options.replyPending ? "该回复正在审核中，通过后将在页面公开显示。" : "",
    });

    try {
        const result = await sendResendEmail(options.env, {
            to: recipientEmail,
            subject,
            html,
        });
        if (!result.ok) {
            console.error("Failed to send guest reply email", result.error);
        }
    } catch (error) {
        console.error("Failed to send guest reply email", error);
    }
}
