import type { DB } from "../core/hono-types";
import { isResendConfigured, sendResendEmail } from "./resend";

function escapeHtml(text: string) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function plainSummary(text: string, max = 200) {
    return text
        .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/<[^>]+>/g, " ")
        .replace(/https?:\/\/\S+/g, " ")
        .replace(/[#>*`~_\-|]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max);
}

type NewsletterFeed = {
    id: number;
    title?: string | null;
    summary?: string | null;
    content?: string | null;
    alias?: string | null;
};

// Notify all subscribers about a newly published post. No-op unless Resend is
// configured. Failures per-recipient are logged and skipped.
export async function notifyNewsletterSubscribers(
    db: DB,
    env: Env,
    origin: string,
    feed: NewsletterFeed,
    siteName: string,
) {
    if (!isResendConfigured(env)) {
        return;
    }

    const subscribers = await db.query.newsletterSubscribers.findMany();
    if (subscribers.length === 0) {
        return;
    }

    const title = feed.title?.trim() || "Untitled";
    const summary = plainSummary(feed.summary || feed.content || "");
    const path = feed.alias?.trim() ? `/${feed.alias.trim()}` : `/feed/${feed.id}`;
    const url = `${origin}${path}`;

    for (const subscriber of subscribers) {
        const unsubscribeUrl = `${origin}/api/newsletter/unsubscribe?token=${encodeURIComponent(subscriber.token)}`;
        const html = `<div style="font-family:sans-serif;line-height:1.6;color:#111;">
<p>「${escapeHtml(siteName)}」发布了新文章：</p>
<h2 style="margin:8px 0;">${escapeHtml(title)}</h2>
${summary ? `<p style="color:#444;">${escapeHtml(summary)}</p>` : ""}
<p><a href="${escapeHtml(url)}">阅读全文 →</a></p>
<hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
<p style="color:#999;font-size:12px;">你订阅了「${escapeHtml(siteName)}」的更新。<a href="${escapeHtml(unsubscribeUrl)}">取消订阅</a></p>
</div>`;
        try {
            const result = await sendResendEmail(env, {
                to: subscriber.email,
                subject: `【${siteName}】${title}`,
                html,
            });
            if (!result.ok) {
                console.error("Newsletter send failed", subscriber.email, result.error);
            }
        } catch (error) {
            console.error("Newsletter send error", subscriber.email, error);
        }
    }
}
