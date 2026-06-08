import { useState } from "react";
import { useTranslation } from "react-i18next";
import { client } from "../app/runtime";

export function NewsletterSubscribe() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async () => {
    const value = email.trim();
    if (!value || status === "loading") {
      return;
    }
    setStatus("loading");
    setMessage("");
    try {
      const { error } = await client.newsletter.subscribe(value);
      if (error) {
        setStatus("error");
        setMessage(typeof error.value === "string" ? error.value : t("newsletter.error"));
      } else {
        setStatus("done");
        setEmail("");
        setMessage(t("newsletter.success"));
      }
    } catch {
      setStatus("error");
      setMessage(t("newsletter.error"));
    }
  };

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-2">
      <p className="text-sm text-neutral-500">{t("newsletter.prompt")}</p>
      <div className="flex w-full gap-2">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void submit();
            }
          }}
          placeholder={t("newsletter.placeholder")}
          disabled={status === "loading"}
          className="min-w-0 flex-1 rounded-full border border-black/10 bg-w px-4 py-2 text-sm t-primary outline-none focus:border-theme dark:border-white/10"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={status === "loading" || !email.trim()}
          className="shrink-0 rounded-full bg-theme px-4 py-2 text-sm text-white transition-opacity disabled:opacity-50"
        >
          {status === "loading" ? t("newsletter.subscribing") : t("newsletter.subscribe")}
        </button>
      </div>
      {message ? (
        <p className={`text-xs ${status === "error" ? "text-red-500" : "text-green-600"}`}>{message}</p>
      ) : null}
    </div>
  );
}
