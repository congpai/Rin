import { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useAlert } from "../dialog";
import { ProfileContext } from "../../state/profile";
import { ClientConfigContext } from "../../state/config";
import { readGuestCommentProfile, writeGuestCommentProfile } from "../../utils/guest-comment-cache";
import { uploadImageFile, buildMarkdownImage } from "../../utils/image-upload";
import { COMMENT_MIN_LENGTH, validateCommentContent } from "../../utils/comment-validation";
import { EmojiPicker } from "./emoji_picker";

export type CommentSubmitPayload = {
    content: string;
    guestName?: string;
    guestEmail?: string;
    guestWebsite?: string;
    parentId?: number;
    replyToId?: number;
};

type CommentComposerProps = {
    onSubmit: (payload: CommentSubmitPayload) => Promise<{ error?: string; pending?: boolean }>;
    placeholder?: string;
    replyTo?: { parentId: number; replyToId: number; name: string } | null;
    onCancelReply?: () => void;
};

export function CommentComposer({
    onSubmit,
    placeholder,
    replyTo,
    onCancelReply,
}: CommentComposerProps) {
    const { t } = useTranslation();
    const cachedGuest = readGuestCommentProfile();
    const [content, setContent] = useState("");
    const [guestName, setGuestName] = useState(cachedGuest.name);
    const [guestEmail, setGuestEmail] = useState(cachedGuest.email);
    const [guestWebsite, setGuestWebsite] = useState(cachedGuest.website);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const { showAlert, AlertUI } = useAlert();
    const profile = useContext(ProfileContext);
    const config = useContext(ClientConfigContext);
    const [, setLocation] = useLocation();

    const rawGuest = config.get("comment.guest.enabled");
    const guestEnabled = rawGuest !== false && rawGuest !== "false";

    useEffect(() => {
        if (!replyTo) return;
        containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        requestAnimationFrame(() => textareaRef.current?.focus());
    }, [replyTo]);

    function insertAtCursor(text: string) {
        const el = textareaRef.current;
        if (!el) {
            setContent((prev) => prev + text);
            return;
        }
        const start = el.selectionStart ?? content.length;
        const end = el.selectionEnd ?? content.length;
        const next = content.slice(0, start) + text + content.slice(end);
        setContent(next);
        requestAnimationFrame(() => {
            el.focus();
            const pos = start + text.length;
            el.setSelectionRange(pos, pos);
        });
    }

    function commentValidationError(contentValue: string) {
        const validation = validateCommentContent(contentValue);
        if (validation === "empty") {
            return t("comment.empty");
        }
        if (validation && typeof validation === "object") {
            return t("comment.min_length", { min: validation.tooShort });
        }
        return null;
    }

    function humanizeError(msg: string) {
        if (msg === "Unauthorized") return t("login.required");
        if (msg === "Content is required") return t("comment.empty");
        if (msg.startsWith("Comment too short:")) {
            const min = Number(msg.slice("Comment too short:".length));
            return t("comment.min_length", { min: Number.isFinite(min) ? min : COMMENT_MIN_LENGTH });
        }
        if (msg === "Guest name is required") return t("comment.guest_name_required");
        if (msg === "Guest email is required") return t("comment.guest_email_required");
        if (msg === "Parent comment not found") return t("comment.parent_not_found");
        if (msg === "Invalid parent comment") return t("comment.invalid_parent");
        if (msg === "Nested replies are not supported") return t("comment.nested_reply_not_supported");
        return msg;
    }

    function persistGuestProfile() {
        writeGuestCommentProfile({
            name: guestName,
            email: guestEmail,
            website: guestWebsite,
        });
    }

    async function handleSubmit() {
        const validationError = commentValidationError(content);
        if (validationError) {
            setError(validationError);
            return;
        }
        if (!profile && !guestEnabled) {
            setLocation("/login");
            return;
        }
        if (!profile && !guestName.trim()) {
            setError(t("comment.guest_name_required"));
            return;
        }
        if (!profile && !guestEmail.trim()) {
            setError(t("comment.guest_email_required"));
            return;
        }

        setBusy(true);
        setError("");
        const result = await onSubmit({
            content: content.trim(),
            guestName: profile ? undefined : guestName.trim(),
            guestEmail: profile ? undefined : guestEmail.trim(),
            guestWebsite: profile ? undefined : guestWebsite.trim() || undefined,
            parentId: replyTo?.parentId,
            replyToId: replyTo?.replyToId,
        });
        setBusy(false);

        if (result.error) {
            setError(humanizeError(result.error));
            return;
        }

        setContent("");
        if (!profile) {
            persistGuestProfile();
        }
        showAlert(result.pending ? t("comment.pending_submitted") : t("comment.success"));
    }

    async function handleImageUpload(file: File) {
        setUploading(true);
        try {
            const result = await uploadImageFile(file);
            insertAtCursor(buildMarkdownImage(file.name, result.url).trim());
        } catch (e) {
            showAlert(e instanceof Error ? e.message : t("upload.failed"));
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    }

    return (
        <div
            ref={containerRef}
            className="flex w-full flex-col rounded-2xl bg-w p-4 t-primary sm:p-6"
        >
            <div className="mb-3 flex w-full flex-col items-start">
                <label htmlFor="comment-composer">{t("comment.title")}</label>
            </div>

            {!profile && guestEnabled ? (
                <>
                    <input
                        type="text"
                        placeholder={t("comment.guest_name_placeholder")}
                        className="mb-2 w-full rounded-lg border border-gray-200 bg-w px-3 py-2 dark:border-gray-700"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        onBlur={persistGuestProfile}
                    />
                    <input
                        type="email"
                        required
                        placeholder={t("comment.guest_email_placeholder")}
                        className="mb-2 w-full rounded-lg border border-gray-200 bg-w px-3 py-2 dark:border-gray-700"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        onBlur={persistGuestProfile}
                    />
                    <input
                        type="url"
                        placeholder={t("comment.guest_website_placeholder")}
                        className="mb-2 w-full rounded-lg border border-gray-200 bg-w px-3 py-2 dark:border-gray-700"
                        value={guestWebsite}
                        onChange={(e) => setGuestWebsite(e.target.value)}
                        onBlur={persistGuestProfile}
                    />
                </>
            ) : null}

            <div
                className={`mb-3 flex w-full overflow-hidden rounded-lg border bg-w ${
                    replyTo
                        ? "border-theme/40 ring-1 ring-theme/20"
                        : "border-gray-200 dark:border-gray-700"
                }`}
            >
                {replyTo ? (
                    <div className="flex shrink-0 items-start border-r border-gray-200 bg-secondary/60 px-3 py-3 dark:border-gray-700">
                        <span className="whitespace-nowrap text-sm font-medium text-theme">
                            @{replyTo.name}
                        </span>
                        {onCancelReply ? (
                            <button
                                type="button"
                                className="ml-2 text-gray-400 hover:text-theme"
                                aria-label={t("comment.cancel_reply")}
                                onClick={onCancelReply}
                            >
                                ×
                            </button>
                        ) : null}
                    </div>
                ) : null}
                <textarea
                    ref={textareaRef}
                    id="comment-composer"
                    placeholder={
                        replyTo
                            ? t("comment.reply_placeholder", { name: replyTo.name })
                            : (placeholder ?? t("comment.placeholder.title"))
                    }
                    className="min-h-24 flex-1 resize-y bg-transparent px-3 py-2 outline-none"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                />
            </div>

            <div className="relative flex w-full items-center gap-2">
                <div className="relative flex items-center gap-2">
                    <button
                        type="button"
                        aria-label="emoji"
                        className="rounded-full bg-secondary px-3 py-1.5 text-sm hover:bg-button"
                        onClick={() => setShowEmoji((v) => !v)}
                    >
                        😀
                    </button>
                    {showEmoji ? (
                        <div className="absolute bottom-full left-0 z-10 mb-2">
                            <EmojiPicker
                                onPick={(emoji) => {
                                    insertAtCursor(emoji);
                                    setShowEmoji(false);
                                }}
                            />
                        </div>
                    ) : null}
                    {profile ? (
                        <>
                            <button
                                type="button"
                                disabled={uploading}
                                className="rounded-full bg-secondary px-3 py-1.5 text-sm hover:bg-button disabled:opacity-50"
                                onClick={() => fileRef.current?.click()}
                            >
                                {uploading ? t("uploading") : t("upload.title")}
                            </button>
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) void handleImageUpload(file);
                                }}
                            />
                        </>
                    ) : null}
                </div>
                <div className="flex-1" />
                <button
                    className="shrink-0 rounded-full bg-theme px-4 py-2 text-white disabled:opacity-50"
                    disabled={busy || uploading}
                    onClick={() => void handleSubmit()}
                >
                    {t(replyTo ? "comment.submit_reply" : "comment.submit")}
                </button>
            </div>

            {error ? <p className="mt-2 w-full text-sm text-red-500">{error}</p> : null}
            <AlertUI />
        </div>
    );
}
