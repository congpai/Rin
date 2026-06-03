export type ResendEmailPayload = {
    to: string;
    subject: string;
    html: string;
};

export function isResendConfigured(env: Env) {
    return Boolean(env.RESEND_API_KEY?.trim() && env.RESEND_FROM?.trim());
}

export async function sendResendEmail(env: Env, payload: ResendEmailPayload) {
    const apiKey = env.RESEND_API_KEY?.trim();
    const from = env.RESEND_FROM?.trim();
    if (!apiKey || !from) {
        return { ok: false as const, error: "Resend is not configured" };
    }

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from,
            to: [payload.to],
            subject: payload.subject,
            html: payload.html,
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        return { ok: false as const, error: body || response.statusText };
    }

    return { ok: true as const };
}
