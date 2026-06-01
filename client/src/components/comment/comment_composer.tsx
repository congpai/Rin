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

function EmojiIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 496 512"
            className={className}
            aria-hidden="true"
        >
            <path
                fill="currentColor"
                d="M248 8C111 8 0 119 0 256s111 248 248 248 248-111 248-248S385 8 248 8zm141.4 389.4c-37.8 37.8-88 58.6-141.4 58.6s-103.6-20.8-141.4-58.6S48 309.4 48 256s20.8-103.6 58.6-141.4S194.6 56 248 56s103.6 20.8 141.4 58.6S448 202.6 448 256s-20.8 103.6-58.6 141.4zM328 224c17.7 0 32-14.3 32-32s-14.3-32-32-32-32 14.3-32 32 14.3 32 32 32zm-160 0c17.7 0 32-14.3 32-32s-14.3-32-32-32-32 14.3-32 32 14.3 32 32 32zm194.4 64H133.6c-8.2 0-14.5 7-13.5 15 7.5 59.2 58.9 105 121.1 105h13.6c62.2 0 113.6-45.8 121.1-105 1-8-5.3-15-13.5-15z"
            />
        </svg>
    );
}

function ImageUploadIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            className={className}
            aria-hidden="true"
        >
            <path
                fill="currentColor"
                d="M464 64H48C21.49 64 0 85.49 0 112v288c0 26.51 21.49 48 48 48h416c26.51 0 48-21.49 48-48V112c0-26.51-21.49-48-48-48zm-6 336H54a6 6 0 0 1-6-6V118a6 6 0 0 1 6-6h404a6 6 0 0 1 6 6v276a6 6 0 0 1-6 6zM128 152c-22.091 0-40 17.909-40 40s17.909 40 40 40 40-17.909 40-40-17.909-40-40-40zM96 352h320v-80l-87.515-87.515c-4.686-4.686-12.284-4.686-16.971 0L192 304l-39.515-39.515c-4.686-4.686-12.284-4.686-16.971 0L96 304v48z"
            />
        </svg>
    );
}

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
                        aria-label={t("comment.emoji_picker")}
                        title={t("comment.emoji_picker")}
                        className="inline-flex items-center justify-center rounded-full bg-secondary px-3 py-1.5 text-sm hover:bg-button"
                        onClick={() => setShowEmoji((v) => !v)}
                    >
                        <EmojiIcon className="h-4 w-4" />
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
                                aria-label={uploading ? t("uploading") : t("upload.title")}
                                title={uploading ? t("uploading") : t("upload.title")}
                                className="inline-flex items-center justify-center rounded-full bg-secondary px-3 py-1.5 text-sm hover:bg-button disabled:opacity-50"
                                onClick={() => fileRef.current?.click()}
                            >
                                <ImageUploadIcon className="h-4 w-4" />
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
