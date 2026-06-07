import { useContext, useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet'
import { client } from "../app/runtime"

import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants"
import { useTranslation } from "react-i18next"
import { ProfileContext } from "../state/profile"
import { tryInt } from "../utils/int"
import { useSearch } from "wouter"
import { useAlert, useConfirm } from "../components/dialog"
import Modal from "react-modal"
import { MarkdownEditor } from "../components/markdown_editor"
import { Input } from "../components/input"
import { Waiting } from "../components/loading"
import { MomentItem } from "../components/moment_item"
import { formatTagsInput, parseTagsInput } from "../utils/parse-tags"

function parseMomentHash() {
    const match = /^id-(\d+)$/.exec(window.location.hash.replace(/^#/, ""));
    if (!match) {
        return null;
    }
    const id = Number(match[1]);
    return Number.isFinite(id) && id > 0 ? id : null;
}

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

export function MomentsPage() {
    const [moments, setMoments] = useState<Moment[]>([])
    const [length, setLength] = useState(0)
    const [content, setContent] = useState("")
    const [tags, setTags] = useState("")
    const [isPrivate, setIsPrivate] = useState(false)
    const [loading, setLoading] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingMoment, setEditingMoment] = useState<Moment | null>(null)
    const query = new URLSearchParams(useSearch());
    const ref = useRef("")
    const { t } = useTranslation()
    const siteConfig = useSiteConfig();
    const profile = useContext(ProfileContext);
    const { showAlert, AlertUI } = useAlert()
    const { showConfirm, ConfirmUI } = useConfirm()
    
    const [currentPage, setCurrentPage] = useState(1)
    const [hasNextPage, setHasNextPage] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [targetMomentId, setTargetMomentId] = useState<number | null>(() => parseMomentHash())
    
    const limit = tryInt(siteConfig.pageSize, query.get("limit"))
    
    function fetchMoments(page = 1, append = false) {
        if (loadingMore) return
        
        const isInitialLoad = page === 1 && !append
        if (isInitialLoad) {
            setLoading(true)
        } else {
            setLoadingMore(true)
        }
        
        client.moments.list({
            page: page,
            limit: limit
        }).then(({ data }) => {
            if (data) {
                setLength(data.data.length)
                setHasNextPage(data.hasNext)
                
                if (append) {
                    setMoments(prev => [...prev, ...data.data] as any)
                } else {
                    setMoments(data.data as any)
                }
                
                setCurrentPage(page)
            }
        }).finally(() => {
            if (isInitialLoad) {
                setLoading(false)
            } else {
                setLoadingMore(false)
            }
        })
    }
    
    function loadMore() {
        if (hasNextPage && !loadingMore) {
            fetchMoments(currentPage + 1, true)
        }
    }
    
    function handleSubmit() {
        if (!content.trim()) return
        
        setLoading(true)
        const tagList = parseTagsInput(tags)

        if (editingMoment) {
            client.moments.update(editingMoment.id, { content, tags: tagList, private: isPrivate })
            .then(({ error }) => {
                if (error) {
                    showAlert(t('update.failed$message', { message: error.value }))
                } else {
                    setContent("")
                    setTags("")
                    setIsPrivate(false)
                    setEditingMoment(null)
                    setIsModalOpen(false)
                    fetchMoments(1, false)
                    showAlert(t('update.success'))
                }
            }).finally(() => {
                setLoading(false)
            })
        } else {
            client.moments.create({ content, tags: tagList, private: isPrivate })
            .then(({ error }) => {
                if (error) {
                    showAlert(t('publish.failed$message', { message: error.value }))
                } else {
                    setContent("")
                    setTags("")
                    setIsPrivate(false)
                    setIsModalOpen(false)
                    fetchMoments(1, false)
                    showAlert(t('publish.success'))
                }
            }).finally(() => {
                setLoading(false)
            })
        }
    }

    function handleEdit(moment: Moment) {
        setEditingMoment(moment)
        setContent(moment.content)
        setTags(formatTagsInput(moment.hashtags ?? []))
        setIsPrivate(Boolean(moment.private))
        setIsModalOpen(true)
    }
    
    function handleDelete(id: number) {
        showConfirm(
            t("delete.title"),
            t("delete.confirm"),
            () => {
                client.moments.delete(id).then(({ error }) => {
                    if (error) {
                        showAlert(t('delete.failed$message', { message: error.value }))
                    } else {
                        fetchMoments(1, false)
                        showAlert(t('delete.success'))
                    }
                })
            }
        )
    }
    
    function openCreateModal() {
        if (editingMoment !== null) {
            setContent("")
            setTags("")
        }
        setIsPrivate(false)
        setEditingMoment(null)
        setIsModalOpen(true)
    }

    function closeModal() {
        setIsModalOpen(false)
    }
    
    useEffect(() => {
        const key = `${limit}`
        if (ref.current === key) return
        fetchMoments(1, false)
        ref.current = key
    }, [limit])

    useEffect(() => {
        function syncHashTarget() {
            setTargetMomentId(parseMomentHash());
        }

        syncHashTarget();
        window.addEventListener("hashchange", syncHashTarget);
        return () => window.removeEventListener("hashchange", syncHashTarget);
    }, []);

    useEffect(() => {
        if (!targetMomentId || loading || loadingMore) {
            return;
        }

        const found = moments.some((moment) => moment.id === targetMomentId);
        if (!found && hasNextPage) {
            fetchMoments(currentPage + 1, true);
        }
    }, [targetMomentId, moments, hasNextPage, loading, loadingMore, currentPage]);

    useEffect(() => {
        if (!targetMomentId) {
            return;
        }

        if (!moments.some((moment) => moment.id === targetMomentId)) {
            return;
        }

        requestAnimationFrame(() => {
            document.getElementById(`id-${targetMomentId}`)?.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        });
    }, [targetMomentId, moments]);
    
    return (
        <>
            <Helmet>
                <title>{`${t('moments.title')} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('moments.title')} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={!loading}>
                <main className="w-full flex flex-col justify-center items-center mb-8 ani-show">
                    <div className="wauto text-start text-black dark:text-white py-4 text-4xl font-bold">
                        <p>
                            {t('moments.title')}
                        </p>
                        <div className="flex flex-row justify-between items-center">
                            <p className="text-sm mt-4 text-neutral-500 font-normal">
                                {t('moments.total$count', { count: length })}
                            </p>
                            {profile?.permission && (
                                <button 
                                    onClick={openCreateModal}
                                    className="text-sm font-normal rounded-full px-4 py-2 text-white bg-theme"
                                >
                                    {t('publish.title')}
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div className="wauto">
                        {moments && moments.length > 0 ? (
                            <div className="space-y-6">
                                {moments.map((moment) => (
                                    <MomentItem 
                                        key={moment.id} 
                                        moment={moment} 
                                        onDelete={handleDelete}
                                        onEdit={handleEdit}
                                        canManage={profile?.permission || false}
                                        openCommentsInitially={targetMomentId === moment.id}
                                    />
                                ))}
                            </div>
                        ) : null}
                        
                        <Waiting for={!loadingMore}>
                            <div className="py-4 text-center">
                                {!hasNextPage && moments && moments.length > 0 ? (
                                    <div className="text-gray-500 pt-6">{t('no_more')}</div>
                                ) : hasNextPage ? (
                                    <button
                                        onClick={loadMore}
                                        className="text-sm font-normal rounded-full px-4 py-2 text-white bg-theme"
                                    >
                                        {t('load_more')}
                                    </button>
                                ) : null}
                            </div>
                        </Waiting>
                    </div>
                </main>
            </Waiting>
            
            <Modal 
                isOpen={isModalOpen}
                onRequestClose={closeModal}
                style={{
                    content: {
                        top: '50%',
                        left: '50%',
                        right: 'auto',
                        bottom: 'auto',
                        marginRight: '-50%',
                        transform: 'translate(-50%, -50%)',
                        padding: '0',
                        border: 'none',
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        background: 'transparent',
                        maxWidth: '90%',
                        width: '800px'
                    },
                    overlay: {
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 1000
                    }
                }}
            >
                <div className="w-full bg-w p-4 rounded-2xl shadow-xl">
                    <h2 className="text-2xl font-bold mb-4 t-primary">
                        {editingMoment ? t('moments.edit') : t('moments.publish')}
                    </h2>
                    
                    <div className="bg-w rounded-2xl t-primary">
                        <MarkdownEditor 
                            content={content}
                            setContent={setContent}
                            height="300px"
                        />
                    </div>

                    <div className="mt-3">
                        <Input
                            value={tags}
                            setValue={setTags}
                            placeholder={t("moments.tags_placeholder")}
                            variant="flat"
                        />
                        <p className="mt-1 text-xs text-neutral-500">{t("moments.tags_hint")}</p>
                    </div>

                    <label className="mt-3 flex items-center gap-2 text-sm t-primary cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={isPrivate}
                            onChange={(e) => setIsPrivate(e.target.checked)}
                            className="h-4 w-4 accent-theme"
                        />
                        <span>{t("moments.private")}</span>
                    </label>

                    <div className="flex justify-end mt-4 space-x-2">
                        <button
                            onClick={closeModal}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded-lg"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !content.trim()}
                            className="px-4 py-2 bg-theme text-white rounded-lg disabled:opacity-50"
                        >
                            {loading ? t('saving') : editingMoment ? t('update.title') : t('publish.title')}
                        </button>
                    </div>
                </div>
            </Modal>
            
            <AlertUI />
            <ConfirmUI />
        </>
    )
}
