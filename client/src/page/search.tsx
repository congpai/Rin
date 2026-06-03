import { useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet'
import { useTranslation } from "react-i18next"
import { Link, useSearch } from "wouter"
import { FeedCard } from "../components/feed_card"
import { SearchMomentCard } from "../components/search_moment_card"
import { Waiting } from "../components/loading"
import { client } from "../app/runtime"

import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants"
import { tryInt } from "../utils/int"
import type { SearchResponse } from "@rin/api"

type SearchTab = "feeds" | "moments";

function resolveSearchTab(value: string | null): SearchTab {
    return value === "moments" ? "moments" : "feeds";
}

export function SearchPage({ keyword }: { keyword: string }) {
    const { t } = useTranslation()
    const siteConfig = useSiteConfig();
    const query = new URLSearchParams(useSearch());
    const [status, setStatus] = useState<'loading' | 'idle'>('idle')
    const [results, setResults] = useState<SearchResponse>()
    const page = tryInt(1, query.get("page"))
    const limit = tryInt(siteConfig.pageSize, query.get("limit"))
    const tab = resolveSearchTab(query.get("tab"))
    const feedListClass = siteConfig.feedLayout === "masonry"
        ? "wauto columns-1 gap-5 ani-show md:columns-2"
        : "wauto flex flex-col ani-show";
    const ref = useRef("")
    const searchBase = `/search/${encodeURIComponent(keyword)}`;

    function buildSearchHref(next: { tab?: SearchTab; page?: number }) {
        const params = new URLSearchParams();
        params.set("tab", next.tab ?? tab);
        params.set("page", String(next.page ?? page));
        params.set("limit", String(limit));
        return `${searchBase}?${params.toString()}`;
    }

    function fetchResults() {
        if (!keyword) return
        client.search.search(keyword, {
            page,
            limit,
        }).then(({ data }) => {
            if (data) {
                setResults(data)
                setStatus('idle')
            }
        })
    }
    useEffect(() => {
        const key = `${page} ${limit} ${keyword} ${tab}`
        if (ref.current == key) return
        setStatus('loading')
        fetchResults()
        ref.current = key
    }, [page, limit, keyword, tab])

    const title = t('article.search.title$keyword', { keyword })
    const feeds = results?.feeds
    const moments = results?.moments
    const activeHasNext = tab === "feeds" ? feeds?.hasNext : moments?.hasNext
    const tabClass = (active: boolean) => active
        ? "rounded-full px-4 py-2 text-sm font-medium text-white bg-theme"
        : "rounded-full px-4 py-2 text-sm font-medium text-neutral-600 bg-button dark:text-neutral-300";

    return (
        <>
            <Helmet>
                <title>{`${title} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={title} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={status === 'idle'}>
                <main className="w-full flex flex-col justify-center items-center mb-8">
                    <div className="wauto text-start text-black dark:text-white py-4 text-4xl font-bold">
                        <p>{t('article.search.title')}</p>
                        <p className="text-sm mt-2 text-neutral-500 font-normal">
                            {t('article.search.title$keyword', { keyword })}
                        </p>
                        <div className="mt-4 flex flex-row flex-wrap gap-2">
                            <Link
                                href={buildSearchHref({ tab: "feeds", page: 1 })}
                                className={tabClass(tab === "feeds")}
                            >
                                {t('search.tab_feeds$count', { count: feeds?.size ?? 0 })}
                            </Link>
                            <Link
                                href={buildSearchHref({ tab: "moments", page: 1 })}
                                className={tabClass(tab === "moments")}
                            >
                                {t('search.tab_moments$count', { count: moments?.size ?? 0 })}
                            </Link>
                        </div>
                    </div>
                    <Waiting for={status === 'idle'}>
                        {tab === "feeds" ? (
                            feeds && feeds.data.length > 0 ? (
                                <div className={feedListClass}>
                                    {feeds.data.map(({ id, ...feed }: any) => (
                                        <FeedCard key={id} id={id} {...feed} />
                                    ))}
                                </div>
                            ) : (
                                <p className="wauto text-sm text-neutral-500">{t('search.no_feeds')}</p>
                            )
                        ) : (
                            moments && moments.data.length > 0 ? (
                                <div className="wauto flex flex-col gap-4 ani-show">
                                    {moments.data.map((moment) => (
                                        <SearchMomentCard key={moment.id} moment={moment} />
                                    ))}
                                </div>
                            ) : (
                                <p className="wauto text-sm text-neutral-500">{t('search.no_moments')}</p>
                            )
                        )}

                        <div className="wauto flex flex-row items-center mt-4 ani-show">
                            {page > 1 && (
                                <Link
                                    href={buildSearchHref({ page: page - 1 })}
                                    className="text-sm font-normal rounded-full px-4 py-2 text-white bg-theme"
                                >
                                    {t('previous')}
                                </Link>
                            )}
                            <div className="flex-1" />
                            {activeHasNext && (
                                <Link
                                    href={buildSearchHref({ page: page + 1 })}
                                    className="text-sm font-normal rounded-full px-4 py-2 text-white bg-theme"
                                >
                                    {t('next')}
                                </Link>
                            )}
                        </div>
                    </Waiting>
                </main>
            </Waiting>
        </>
    )
}
