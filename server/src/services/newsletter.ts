import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppContext } from "../core/hono-types";
import { newsletterSubscribers } from "../db/schema";

function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function htmlPage(message: string) {
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${message}</title><style>body{font-family:sans-serif;display:flex;min-height:80vh;align-items:center;justify-content:center;color:#333}</style></head><body><p>${message}</p></body></html>`;
}

export function NewsletterService(): Hono {
    const app = new Hono();

    // POST /newsletter/subscribe  { email }
    app.post("/subscribe", async (c: AppContext) => {
        const db = c.get("db");
        const body = await c.req.json().catch(() => ({}));
        const email = String((body as { email?: string }).email ?? "").trim().toLowerCase();

        if (!isValidEmail(email)) {
            return c.json({ message: "邮箱格式不正确" }, 400);
        }

        const token = crypto.randomUUID();
        await db
            .insert(newsletterSubscribers)
            .values({ email, token })
            .onConflictDoNothing();

        return c.json({ success: true });
    });

    // GET /newsletter/unsubscribe?token=...
    app.get("/unsubscribe", async (c: AppContext) => {
        const db = c.get("db");
        const token = c.req.query("token") ?? "";
        if (token) {
            await db.delete(newsletterSubscribers).where(eq(newsletterSubscribers.token, token));
        }
        return c.html(htmlPage("已取消订阅。"));
    });

    return app;
}
