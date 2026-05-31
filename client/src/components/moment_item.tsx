import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Markdown } from "./markdown";
import { timeago } from "../utils/timeago";
import { MomentImageGrid } from "./moment_image_grid";
import { extractMomentImages, stripMomentImages } from "../utils/moment-content";
import { MomentComments } from "./comment/moment_comments";

interface Moment {
    id: number;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    user: {
        id: number;
        username: string;
        avatar: string;
    };
}

export function MomentItem({
    moment,
    onDelete,
    onEdit,
    canManage
}: {
    moment: Moment,
    onDelete: (id: number) => void,
    onEdit: (moment: Moment) => void,
    canManage: boolean
}) {
    const { t } = useTranslation()
    const { createdAt, updatedAt } = moment;
    const images = extractMomentImages(moment.content);
    const textContent = stripMomentImages(moment.content);
    const [commentsOpen, setCommentsOpen] = useState(false);

    return (
        <div className="bg-w p-4 rounded-lg">
            <div className="flex justify-between">
                <div className="flex items-center space-x-3">
                    <img
                        src={moment.user.avatar}
                        alt={moment.user.username}
                        className="w-8 h-8 rounded-full object-cover"
                    />
                    <div>
                        <p className="t-primary">
                            {moment.user.username}
                        </p>
                        <p className="space-x-2 t-secondary text-sm">
                            <span title={new Date(createdAt).toLocaleString()}>
                                {createdAt === updatedAt ? timeago(createdAt) : t('feed_card.published$time', { time: timeago(createdAt) })}
                            </span>
                            {createdAt !== updatedAt &&
                                <span title={new Date(updatedAt).toLocaleString()}>
                                    {t('feed_card.updated$time', { time: timeago(updatedAt) })}
                                </span>
                            }
                        </p>
                    </div>
                </div>
                {canManage && (
                    <div>
                        <div className="flex gap-2">
                            <button
                                aria-label={t("edit")}
                                onClick={() => onEdit(moment)}
                                className="flex-1 flex flex-col items-end justify-center px-2 py bg-secondary bg-button rounded-full transition"
                            >
                                <i className="ri-edit-2-line dark:text-neutral-400" />
                            </button>
                            <button
                                aria-label={t("delete.title")}
                                onClick={() => onDelete(moment.id)}
                                className="flex-1 flex flex-col items-end justify-center px-2 py bg-secondary bg-button rounded-full transition"
                            >
                                <i className="ri-delete-bin-7-line text-red-500" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {textContent ? (
                <div className="text-black dark:text-white mt-2">
                    <Markdown content={textContent} />
                </div>
            ) : null}
            <MomentImageGrid images={images} />

            <div className="mt-3">
                <button
                    type="button"
                    className="rounded-full bg-secondary px-3 py-1.5 text-sm t-secondary hover:bg-button"
                    onClick={() => setCommentsOpen((v) => !v)}
                >
                    <i className="ri-chat-3-line mr-1" />
                    {commentsOpen ? t("comment.hide", { defaultValue: "收起评论" }) : t("comment.title")}
                </button>
            </div>

            <MomentComments momentId={moment.id} open={commentsOpen} />
        </div>
    )
}
