import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Markdown } from "./markdown";
import { MomentImageGrid } from "./moment_image_grid";
import { extractMomentImages, stripMomentImages } from "../utils/moment-content";
import { timeago } from "../utils/timeago";

type SearchMoment = {
    id: number;
    content: string;
    createdAt: Date | string;
    updatedAt: Date | string;
    user: {
        id: number;
        username: string;
        avatar: string;
    };
};

export function SearchMomentCard({ moment }: { moment: SearchMoment }) {
    const { t } = useTranslation();
    const images = extractMomentImages(moment.content);
    const textContent = stripMomentImages(moment.content);
    const createdAt = new Date(moment.createdAt);
    const updatedAt = new Date(moment.updatedAt);

    return (
        <Link href={`/moments#id-${moment.id}`} className="block w-full">
            <article className="bg-w rounded-lg p-4 duration-300 hover:bg-button">
                <div className="flex items-center gap-3">
                    <img
                        src={moment.user.avatar}
                        alt={moment.user.username}
                        className="h-8 w-8 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                        <p className="t-primary truncate">{moment.user.username}</p>
                        <p className="t-secondary text-sm">
                            <span title={createdAt.toLocaleString()}>
                                {createdAt.getTime() === updatedAt.getTime()
                                    ? timeago(createdAt)
                                    : t("feed_card.published$time", { time: timeago(createdAt) })}
                            </span>
                        </p>
                    </div>
                </div>
                {textContent ? (
                    <div className="mt-2 text-black dark:text-white line-clamp-6">
                        <Markdown content={textContent} />
                    </div>
                ) : null}
                {images.length > 0 ? (
                    <div className="mt-2 pointer-events-none">
                        <MomentImageGrid images={images} />
                    </div>
                ) : null}
            </article>
        </Link>
    );
}
