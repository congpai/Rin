import { useContext } from "react";
import { useTranslation } from "react-i18next";
import Popup from "reactjs-popup";
import { useAlert, useConfirm } from "../dialog";
import { ProfileContext } from "../../state/profile";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { resolveCommentAvatar } from "../../utils/cravatar";
import { groupCommentThreads } from "../../utils/comment-thread";
import { timeago } from "../../utils/timeago";
import { CommentContent, CommentTailImages, stripMarkdownImages } from "./comment_content";

export type CommentRecord = {
    id: number;
    content: string;
    createdAt: Date | string;
    updatedAt?: Date | string;
    parentId?: number | null;
    replyToId?: number | null;
    user?: {
        id: number;
        username: string;
        avatar: string | null;
        permission: number | null;
    } | null;
    guestName?: string;
    guestEmail?: string;
    guestWebsite?: string;
    approved?: boolean;
};

export type CommentReplyTarget = {
    parentId: number;
    replyToId: number;
    name: string;
};

type CommentListProps = {
    comments: CommentRecord[];
    onDelete: (id: number) => Promise<{ error?: string }>;
    onApprove?: (id: number) => Promise<{ error?: string }>;
    onRefresh: () => void;
    onReply?: (target: CommentReplyTarget) => void;
};

function isPendingComment(comment: CommentRecord) {
    return comment.approved === false;
}

function commentName(comment: CommentRecord, anonymous: string) {
    return comment.user?.username || comment.guestName || anonymous;
}

function commentAvatar(comment: CommentRecord, defaultAvatar: string) {
    return resolveCommentAvatar({
        userAvatar: comment.user?.avatar,
        guestEmail: comment.guestEmail,
        defaultAvatar,
    });
}

function buildReplyTarget(
    root: CommentRecord,
    replyTo: CommentRecord,
    anonymous: string,
): CommentReplyTarget {
    return {
        parentId: root.id,
        replyToId: replyTo.id,
        name: commentName(replyTo, anonymous),
    };
}

function resolveReplyTargetComment(
    reply: CommentRecord,
    root: CommentRecord,
    byId: Map<number, CommentRecord>,
): CommentRecord {
    const targetId = reply.replyToId ?? root.id;
    return byId.get(targetId) ?? root;
}

function ClickableUser({
    name,
    avatar,
    onClick,
}: {
    name: string;
    avatar: string;
    onClick?: () => void;
}) {
    const inner = (
        <>
            <img
                src={avatar}
                alt=""
                className="h-4 w-4 shrink-0 rounded-full object-cover"
            />
            <span className="font-semibold text-theme">{name}</span>
        </>
    );

    if (!onClick) {
        return (
            <span className="inline-flex items-center gap-1 align-middle">{inner}</span>
        );
    }

    return (
        <button
            type="button"
            className="inline-flex items-center gap-1 align-middle hover:opacity-80"
            onClick={onClick}
        >
            {inner}
        </button>
    );
}

function CommentModerationActions({
    commentId,
    onApprove,
    onReject,
    onDone,
}: {
    commentId: number;
    onApprove?: (id: number) => Promise<{ error?: string }>;
    onReject: (id: number) => Promise<{ error?: string }>;
    onDone: () => void;
}) {
    const { t } = useTranslation();
    const { showConfirm, ConfirmUI } = useConfirm();
    const { showAlert, AlertUI } = useAlert();

    if (!onApprove) {
        return null;
    }

    return (
        <>
            <button
                type="button"
                className="rounded px-1 text-sm leading-none text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40"
                title={t("comment.approve")}
                aria-label={t("comment.approve")}
                onClick={() => {
                    void onApprove(commentId).then(({ error }) => {
                        if (error) {
                            showAlert(error);
                        } else {
                            showAlert(t("comment.approve_success"), onDone);
                        }
                    });
                }}
            >
                ✔
            </button>
            <button
                type="button"
                className="rounded px-1 text-sm leading-none text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                title={t("comment.reject")}
                aria-label={t("comment.reject")}
                onClick={() =>
                    showConfirm(t("comment.reject"), t("comment.reject_confirm"), () => {
                        void onReject(commentId).then(({ error }) => {
                            if (error) {
                                showAlert(error);
                            } else {
                                showAlert(t("comment.reject_success"), onDone);
                            }
                        });
                    })
                }
            >
                ✕
            </button>
            <ConfirmUI />
            <AlertUI />
        </>
    );
}

function CommentReplyTail({
    root,
    replies,
    byId,
    defaultAvatar,
    onDelete,
    onApprove,
    onRefresh,
    onReply,
}: {
    root: CommentRecord;
    replies: CommentRecord[];
    byId: Map<number, CommentRecord>;
    defaultAvatar: string;
    onDelete: (id: number) => Promise<{ error?: string }>;
    onApprove?: (id: number) => Promise<{ error?: string }>;
    onRefresh: () => void;
    onReply?: (target: CommentReplyTarget) => void;
}) {
    const { t } = useTranslation();
    const { showConfirm, ConfirmUI } = useConfirm();
    const { showAlert, AlertUI } = useAlert();
    const profile = useContext(ProfileContext);
    const anonymous = t("anonymous");
    const isAdmin = Boolean(profile?.permission);

    return (
        <div className="mt-3 rounded-lg bg-secondary/80 px-3 py-2 text-sm leading-relaxed">
            {replies.map((reply) => {
                const name = commentName(reply, anonymous);
                const target = resolveReplyTargetComment(reply, root, byId);
                const targetName = commentName(target, anonymous);
                const text = stripMarkdownImages(reply.content);
                const canDelete =
                    profile?.permission ||
                    (reply.user && profile?.id === reply.user.id);
                const pending = isPendingComment(reply);

                return (
                    <div
                        key={reply.id}
                        className={`group py-1 ${pending ? "rounded-md bg-amber-50/80 px-2 -mx-2 dark:bg-amber-950/20" : ""}`}
                    >
                        <div className="min-w-0 overflow-hidden break-words leading-relaxed t-primary">
                            <div className="float-right ml-2 flex shrink-0 items-center gap-1 pl-1">
                                {isAdmin && pending ? (
                                    <CommentModerationActions
                                        commentId={reply.id}
                                        onApprove={onApprove}
                                        onReject={onDelete}
                                        onDone={onRefresh}
                                    />
                                ) : null}
                                {pending ? (
                                    <span className="rounded-full bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                                        {t("comment.pending")}
                                    </span>
                                ) : null}
                                <span
                                    title={new Date(reply.createdAt).toLocaleString()}
                                    className="text-xs whitespace-nowrap text-gray-400"
                                >
                                    {timeago(reply.createdAt)}
                                </span>
                                {canDelete ? (
                                    <Popup
                                        arrow={false}
                                        trigger={
                                            <button
                                                type="button"
                                                className="rounded px-1 opacity-0 transition group-hover:opacity-100"
                                                aria-label={t("delete.comment.title")}
                                            >
                                                <i className="ri-more-fill text-xs t-secondary" />
                                            </button>
                                        }
                                        position="left center"
                                    >
                                        <button
                                            type="button"
                                            className="rounded-full bg-secondary px-2 py-1"
                                            onClick={() =>
                                                showConfirm(
                                                    t("delete.comment.title"),
                                                    t("delete.comment.confirm"),
                                                    () => {
                                                        void onDelete(reply.id).then(({ error }) => {
                                                            if (error) {
                                                                showAlert(error);
                                                            } else {
                                                                showAlert(t("delete.success"), onRefresh);
                                                            }
                                                        });
                                                    },
                                                )
                                            }
                                        >
                                            <i className="ri-delete-bin-2-line t-secondary" />
                                        </button>
                                    </Popup>
                                ) : null}
                            </div>
                            <ClickableUser
                                name={name}
                                avatar={commentAvatar(reply, defaultAvatar)}
                                onClick={
                                    onReply
                                        ? () => onReply(buildReplyTarget(root, reply, anonymous))
                                        : undefined
                                }
                            />
                            <span className="t-secondary"> {t("comment.reply_action")} </span>
                            <ClickableUser
                                name={targetName}
                                avatar={commentAvatar(target, defaultAvatar)}
                                onClick={
                                    onReply
                                        ? () => onReply(buildReplyTarget(root, target, anonymous))
                                        : undefined
                                }
                            />
                            <span className="t-secondary">：</span>
                            {text ? (
                                <span className="break-all [overflow-wrap:anywhere]">{text}</span>
                            ) : null}
                        </div>
                        <CommentTailImages content={reply.content} />
                    </div>
                );
            })}
            <ConfirmUI />
            <AlertUI />
        </div>
    );
}

function CommentThread({
    root,
    replies,
    byId,
    onDelete,
    onApprove,
    onRefresh,
    onReply,
}: {
    root: CommentRecord;
    replies: CommentRecord[];
    byId: Map<number, CommentRecord>;
    onDelete: (id: number) => Promise<{ error?: string }>;
    onApprove?: (id: number) => Promise<{ error?: string }>;
    onRefresh: () => void;
    onReply?: (target: CommentReplyTarget) => void;
}) {
    const { t } = useTranslation();
    const { showConfirm, ConfirmUI } = useConfirm();
    const { showAlert, AlertUI } = useAlert();
    const profile = useContext(ProfileContext);
    const siteConfig = useSiteConfig();
    const anonymous = t("anonymous");
    const isAdmin = Boolean(profile?.permission);

    const name = commentName(root, anonymous);
    const avatar = commentAvatar(root, siteConfig.avatar);
    const pending = isPendingComment(root);
    const canDelete =
        profile?.permission ||
        (root.user && profile?.id === root.user.id);

    return (
        <div className="mt-2 flex flex-row items-start rounded-xl">
            <img
                src={avatar}
                alt=""
                className="mt-4 h-8 w-8 shrink-0 rounded-full object-cover"
            />
            <div
                className={`ml-2 flex flex-1 flex-col rounded-xl p-4 ${
                    pending
                        ? "bg-amber-50/80 ring-1 ring-amber-300/50 dark:bg-amber-950/20 dark:ring-amber-700/40"
                        : "bg-w"
                }`}
            >
                <div className="flex flex-row items-center gap-2">
                    <span className="text-base font-bold t-primary">{name}</span>
                    {pending ? (
                        <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                            {t("comment.pending")}
                        </span>
                    ) : null}
                    {root.guestWebsite ? (
                        <a
                            href={root.guestWebsite}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-gray-400 transition-colors hover:text-theme"
                        >
                            <i className="ri-external-link-line" />
                        </a>
                    ) : null}
                    <div className="flex-1" />
                    {isAdmin && pending ? (
                        <CommentModerationActions
                            commentId={root.id}
                            onApprove={onApprove}
                            onReject={onDelete}
                            onDone={onRefresh}
                        />
                    ) : null}
                    <span
                        title={new Date(root.createdAt).toLocaleString()}
                        className="text-sm text-gray-400"
                    >
                        {timeago(root.createdAt)}
                    </span>
                </div>
                <CommentContent content={root.content} />
                {replies.length > 0 ? (
                    <CommentReplyTail
                        root={root}
                        replies={replies}
                        byId={byId}
                        defaultAvatar={siteConfig.avatar}
                        onDelete={onDelete}
                        onApprove={onApprove}
                        onRefresh={onRefresh}
                        onReply={onReply}
                    />
                ) : null}
                <div className="mt-2 flex items-center justify-between gap-2">
                    {onReply ? (
                        <button
                            type="button"
                            className="rounded-full bg-secondary px-3 py-1 text-sm t-secondary hover:bg-button"
                            onClick={() => onReply(buildReplyTarget(root, root, anonymous))}
                        >
                            {t("comment.reply")}
                        </button>
                    ) : (
                        <span />
                    )}
                    {canDelete ? (
                        <Popup
                            arrow={false}
                            trigger={
                                <button className="rounded-full bg-secondary px-2 py-1">
                                    <i className="ri-more-fill t-secondary" />
                                </button>
                            }
                            position="left center"
                        >
                            <button
                                aria-label={t("delete.comment.title")}
                                className="rounded-full bg-secondary px-2 py-1"
                                onClick={() =>
                                    showConfirm(
                                        t("delete.comment.title"),
                                        t("delete.comment.confirm"),
                                        () => {
                                            void onDelete(root.id).then(({ error }) => {
                                                if (error) {
                                                    showAlert(error);
                                                } else {
                                                    showAlert(t("delete.success"), onRefresh);
                                                }
                                            });
                                        },
                                    )
                                }
                            >
                                <i className="ri-delete-bin-2-line t-secondary" />
                            </button>
                        </Popup>
                    ) : null}
                </div>
            </div>
            <ConfirmUI />
            <AlertUI />
        </div>
    );
}

export function CommentList({ comments, onDelete, onApprove, onRefresh, onReply }: CommentListProps) {
    if (comments.length === 0) {
        return null;
    }

    const byId = new Map(comments.map((comment) => [comment.id, comment]));
    const threads = groupCommentThreads(comments);

    return (
        <div className="w-full">
            {threads.map(({ root, replies }) => (
                <CommentThread
                    key={root.id}
                    root={root}
                    replies={replies}
                    byId={byId}
                    onDelete={onDelete}
                    onApprove={onApprove}
                    onRefresh={onRefresh}
                    onReply={onReply}
                />
            ))}
        </div>
    );
}
