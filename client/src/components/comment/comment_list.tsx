import { useContext } from "react";
import { useTranslation } from "react-i18next";
import Popup from "reactjs-popup";
import { useAlert, useConfirm } from "../dialog";
import { ProfileContext } from "../../state/profile";
import { useSiteConfig } from "../../hooks/useSiteConfig";
import { resolveCommentAvatar } from "../../utils/cravatar";
import { timeago } from "../../utils/timeago";
import { CommentContent } from "./comment_content";

export type CommentRecord = {
    id: number;
    content: string;
    createdAt: Date | string;
    updatedAt?: Date | string;
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
};

export function CommentList({ comments, onDelete, onRefresh }: CommentListProps) {
    const { t } = useTranslation();
    const { showConfirm, ConfirmUI } = useConfirm();
    const { showAlert, AlertUI } = useAlert();
    const profile = useContext(ProfileContext);
    const siteConfig = useSiteConfig();

    if (comments.length === 0) {
        return null;
    }

    return (
        <div className="w-full">
            {comments.map((comment) => {
                const name = comment.user?.username || comment.guestName || t("anonymous");
                const avatar = resolveCommentAvatar({
                    userAvatar: comment.user?.avatar,
                    guestEmail: comment.guestEmail,
                    defaultAvatar: siteConfig.avatar,
                });
                const canDelete =
                    profile?.permission ||
                    (comment.user && profile?.id === comment.user.id);

                return (
                    <div key={comment.id} className="mt-2 flex flex-row items-start rounded-xl">
                        <img src={avatar} alt="" className="mt-4 h-8 w-8 rounded-full object-cover" />
                        <div className="ml-2 flex flex-1 flex-col rounded-xl bg-w p-4">
                            <div className="flex flex-row items-center">
                                <span className="text-base font-bold t-primary">{name}</span>
                                {comment.guestWebsite ? (
                                    <a
                                        href={comment.guestWebsite}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-2 text-gray-400 transition-colors hover:text-theme"
                                    >
                                        <i className="ri-external-link-line" />
                                    </a>
                                ) : null}
                                <div className="flex-1" />
                                <span
                                    title={new Date(comment.createdAt).toLocaleString()}
                                    className="text-sm text-gray-400"
                                >
                                    {timeago(comment.createdAt)}
                                </span>
                            </div>
                            <CommentContent content={comment.content} />
                            {canDelete ? (
                                <div className="mt-2 flex justify-end">
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
                                                        void onDelete(comment.id).then(({ error }) => {
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
                                </div>
                            ) : null}
                        </div>
                    </div>
                );
            })}
            <ConfirmUI />
            <AlertUI />
        </div>
    );
}
