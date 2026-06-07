import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Markdown } from "./markdown";
import { timeago } from "../utils/timeago";
import { MomentImageGrid } from "./moment_image_grid";
import { extractMomentImages, stripMomentImages } from "../utils/moment-content";
import { HashTag } from "./hashtag";
import { MomentComments } from "./comment/moment_comments";

interface Moment {
    id: number;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    private?: number | boolean;
    hashtags?: Array<{ id: number; name: string }>;
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
    canManage,
    openCommentsInitially = false,
}: {
    moment: Moment,
    onDelete: (id: number) => void,
    onEdit: (moment: Moment) => void,
    canManage: boolean,
    openCommentsInitially?: boolean,
}) {
    const { t } = useTranslation()
    const { createdAt, updatedAt } = moment;
    const images = extractMomentImages(moment.content);
    const textContent = stripMomentImages(moment.content);
    const [commentsOpen, setCommentsOpen] = useState(openCommentsInitially);

    useEffect(() => {
        if (openCommentsInitially) {
            setCommentsOpen(true);
        }
    }, [openCommentsInitially]);

    return (
        <div id={`id-${moment.id}`} className="scroll-mt-24 bg-w p-4 rounded-lg">
            <div className="flex justify-between">
                <div className="flex items-center space-x-3">
                    <img
                        src={moment.user.avatar}
                        alt={moment.user.username}
                        className="w-8 h-8 rounded-full object-cover"
                    />
                    <div>
                        <p className="t-primary flex items-center gap-2">
                            <span>{moment.user.username}</span>
                            {moment.private ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-normal t-secondary">
                                    <i className="ri-lock-line" />
                                    {t('moments.private_badge')}
                                </span>
                            ) : null}
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

            <div className="mt-3 flex flex-row flex-wrap items-center gap-2">
                <button
                    type="button"
                    className="rounded-full bg-secondary px-3 py-1.5 text-sm t-secondary hover:bg-button"
                    onClick={() => setCommentsOpen((v) => !v)}
                >
                    <i className="ri-chat-3-line mr-1" />
                    {commentsOpen ? t("comment.hide", { defaultValue: "收起评论" }) : t("comment.title")}
                </button>
                {(moment.hashtags?.length ?? 0) > 0 ? (
                    <>
                        <div className="flex-1" />
                        <div className="flex flex-row flex-wrap items-center justify-end gap-x-2 gap-y-1">
                            {moment.hashtags?.map(({ id, name }) => (
                                <HashTag key={id} name={name} />
                            ))}
                        </div>
                    </>
                ) : null}
            </div>

            <MomentComments momentId={moment.id} open={commentsOpen} />
        </div>
    )
}
