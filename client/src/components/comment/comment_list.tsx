import { useContext } from "react";
import { useTranslation } from "react-i18next";
import Popup from "reactjs-popup";
import { useAlert, useConfirm } from "../dialog";
import { ProfileContext } from "../../state/profile";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { resolveCommentAvatar } from "../../utils/cravatar";
import { groupCommentThreads } from "../../utils/comment-thread";
import { timeago } from "../../utils/timeago";
import { CommentContent } from "./comment_content";

export type CommentRecord = {
    id: number;
    content: string;
    createdAt: Date | string;
    updatedAt?: Date | string;
    parentId?: number | null;
    user?: {
        id: number;
        username: string;
        avatar: string | null;
        permission: number | null;
    } | null;
    guestName?: string;
    guestEmail?: string;
    guestWebsite?: string;
};

type CommentListProps = {
    comments: CommentRecord[];
    onDelete: (id: number) => Promise<{ error?: string }>;
    onRefresh: () => void;
    onReply?: (comment: CommentRecord) => void;
};

function commentName(comment: CommentRecord, anonymous: string) {
    return comment.user?.username || comment.guestName || anonymous;
}

function replyPreview(content: string, imageTag: string) {
    return content
        .replace(/!\[.*?\]\(\S+?(?:\s+"[^"]*")?\)/g, imageTag)
        .replace(/\s+/g, " ")
        .trim();
}

function CommentReplyTail({
    rootName,
    replies,
    onDelete,
    onRefresh,
}: {
    rootName: string;
    replies: CommentRecord[];
    onDelete: (id: number) => Promise<{ error?: string }>;
    onRefresh: () => void;
}) {
    const { t } = useTranslation();
    const { showConfirm, ConfirmUI } = useConfirm();
    const { showAlert, AlertUI } = useAlert();
    const profile = useContext(ProfileContext);
    const imageTag = t("comment.image_tag");

    return (
        <div className="mt-3 rounded-lg bg-secondary/80 px-3 py-2 text-sm leading-relaxed">
            {replies.map((reply) => {
                const name = commentName(reply, t("anonymous"));
                const text = replyPreview(reply.content, imageTag);
                const canDelete =
                    profile?.permission ||
                    (reply.user && profile?.id === reply.user.id);

                return (
                    <div key={reply.id} className="group flex items-start gap-1 py-0.5">
                        <p className="flex-1 break-words t-primary">
                            <span className="font-semibold text-theme">{name}</span>
                            <span className="t-secondary">
                                {" "}
                                {t("comment.reply_action")} {rootName}：
                            </span>
                            <span>{text}</span>
                        </p>
                        {canDelete ? (
                            <Popup
                                arrow={false}
                                trigger={
                                    <button
                                        type="button"
                                        className="shrink-0 rounded px-1 opacity-0 transition group-hover:opacity-100"
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
    onDelete,
    onRefresh,
    onReply,
}: {
    root: CommentRecord;
    replies: CommentRecord[];
    onDelete: (id: number) => Promise<{ error?: string }>;
    onRefresh: () => void;
    onReply?: (comment: CommentRecord) => void;
}) {
    const { t } = useTranslation();
    const { showConfirm, ConfirmUI } = useConfirm();
    const { showAlert, AlertUI } = useAlert();
    const profile = useContext(ProfileContext);
    const siteConfig = useSiteConfig();

    const name = commentName(root, t("anonymous"));
    const avatar = resolveCommentAvatar({
        userAvatar: root.user?.avatar,
        guestEmail: root.guestEmail,
        defaultAvatar: siteConfig.avatar,
    });
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
            <div className="ml-2 flex flex-1 flex-col rounded-xl bg-w p-4">
                <div className="flex flex-row items-center">
                    <span className="text-base font-bold t-primary">{name}</span>
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
                        rootName={name}
                        replies={replies}
                        onDelete={onDelete}
                        onRefresh={onRefresh}
                    />
                ) : null}
                <div className="mt-2 flex items-center justify-between gap-2">
                    {onReply ? (
                        <button
                            type="button"
                            className="rounded-full bg-secondary px-3 py-1 text-sm t-secondary hover:bg-button"
                            onClick={() => onReply(root)}
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

export function CommentList({ comments, onDelete, onRefresh, onReply }: CommentListProps) {
    if (comments.length === 0) {
        return null;
    }

    const threads = groupCommentThreads(comments);

    return (
        <div className="w-full">
            {threads.map(({ root, replies }) => (
                <CommentThread
                    key={root.id}
                    root={root}
                    replies={replies}
                    onDelete={onDelete}
                    onRefresh={onRefresh}
                    onReply={onReply}
                />
            ))}
        </div>
    );
}
