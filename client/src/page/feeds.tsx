import { useContext, useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet'
import { Link, useSearch } from "wouter"
import { FeedCard } from "../components/feed_card"
import { FeedCardSkeleton } from "../components/feed_card_skeleton"
import { client } from "../app/runtime"
import { ProfileContext } from "../state/profile"

import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants"
import { tryInt } from "../utils/int"
import { useTranslation } from "react-i18next";

type FeedsData = {
    size: number,
    data: any[],
    hasNext: boolean
}

type FeedType = 'draft' | 'unlisted' | 'normal'

type FeedsMap = {
    [key in FeedType]: FeedsData
}

export function FeedsPage() {
    const { t } = useTranslation()
    const siteConfig = useSiteConfig();
    const query = new URLSearchParams(useSearch());
    const profile = useContext(ProfileContext);
    const [listState, _setListState] = useState<FeedType>(query.get("type") as FeedType || 'normal')
    const [status, setStatus] = useState<'loading' | 'idle'>('idle')
    const [feeds, setFeeds] = useState<FeedsMap>({
        draft: { size: 0, data: [], hasNext: false },
        unlisted: { size: 0, data: [], hasNext: false },
        normal: { size: 0, data: [], hasNext: false }
    })
    const page = tryInt(1, query.get("page"))
    const limit = tryInt(siteConfig.pageSize, query.get("limit"))
    const feedListClass = siteConfig.feedLayout === "masonry" ? "wauto columns-1 gap-5 ani-show md:columns-2" : "wauto flex flex-col ani-show";
    const priorityImageCount = siteConfig.feedLayout === "masonry" ? 2 : 1;
    const ref = useRef("")
    function fetchFeeds(type: FeedType) {
        client.feed.list({
            page: page,
            limit: limit,
            type: type
        }).then(({ data }) => {
            if (data) {
                setFeeds((previous) => ({
                    ...previous,
                    [type]: data
                }))
                setStatus('idle')
            }
        })
    }
    useEffect(() => {
        const key = `${query.get("page")} ${query.get("type")} ${limit}`
        if (ref.current == key) return
        const type = query.get("type") as FeedType || 'normal'
        if (type !== listState) {
            _setListState(type)
        }
        setStatus('loading')
        fetchFeeds(type)
        ref.current = key
    }, [limit, query.get("page"), query.get("type")])
    const currentFeeds = feeds[listState];
    const isInitialLoading = status === 'loading' && currentFeeds.data.length === 0;
    const feedCount = currentFeeds.size;

    return (
        <>
            <Helmet>
                <title>{`${siteConfig.name} - ${siteConfig.description || t('article.title')}`}</title>
                {siteConfig.description ? (
                    <meta name="description" content={siteConfig.description} />
                ) : null}
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={siteConfig.name} />
                <meta property="og:description" content={siteConfig.description || ""} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="website" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <main className="w-full flex flex-col justify-center items-center mb-8">
                <div className="wauto text-start text-black dark:text-white py-4 text-4xl font-bold">
                    <p>
                        {listState === 'draft' ? t('draft_bin') : listState === 'normal' ? t('article.title') : t('unlisted')}
                    </p>
                    <div className="flex flex-row justify-between">
                        <p className="text-sm mt-4 text-neutral-500 font-normal">
                            {isInitialLoading
                                ? "\u00a0"
                                : t('article.total$count', { count: feedCount })}
                        </p>
                        {profile?.permission &&
                            <div className="flex flex-row space-x-4">
                                <Link href={listState === 'draft' ? '/?type=normal' : '/?type=draft'} className={`text-sm mt-4 text-neutral-500 font-normal ${listState === 'draft' ? "text-theme" : ""}`}>
                                    {t('draft_bin')}
                                </Link>
                                <Link href={listState === 'unlisted' ? '/?type=normal' : '/?type=unlisted'} className={`text-sm mt-4 text-neutral-500 font-normal ${listState === 'unlisted' ? "text-theme" : ""}`}>
                                    {t('unlisted')}
                                </Link>
                            </div>
                        }
                    </div>
                </div>
                <div className={feedListClass}>
                    {isInitialLoading
                        ? Array.from({ length: limit }, (_, index) => (
                            <FeedCardSkeleton key={`skeleton-${index}`} />
                        ))
                        : currentFeeds.data.map(({ id, ...feed }: any, index: number) => (
                            <FeedCard
                                key={id}
                                id={id}
                                {...feed}
                                imagePriority={index < priorityImageCount}
                            />
                        ))}
                </div>
                {!isInitialLoading ? (
                    <div className="wauto flex flex-row items-center mt-4 ani-show">
                        {page > 1 &&
                            <Link href={`/?type=${listState}&page=${(page - 1)}`}
                                className={`text-sm font-normal rounded-full px-4 py-2 text-white bg-theme`}>
                                {t('previous')}
                            </Link>
                        }
                        <div className="flex-1" />
                        {currentFeeds.hasNext &&
                            <Link href={`/?type=${listState}&page=${(page + 1)}`}
                                className={`text-sm font-normal rounded-full px-4 py-2 text-white bg-theme`}>
                                {t('next')}
                            </Link>
                        }
                    </div>
                ) : null}
            </main>
        </>
    )
}
