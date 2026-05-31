import { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ClientConfigContext } from "../../state/config";
import { CommentComposer } from "./comment_composer";
import { CommentList, type CommentRecord } from "./comment_list";

type CommentSectionProps = {
    enabled: boolean;
    loadComments: () => Promise<{ data?: CommentRecord[]; error?: string }>;
    createComment: (body: {
        content: string;
        guestName?: string;
        guestEmail?: string;
        guestWebsite?: string;
    }) => Promise<{ error?: string }>;
    deleteComment: (id: number) => Promise<{ error?: string }>;
    /** 动态评论：折叠面板内懒加载 */
    lazy?: boolean;
    open?: boolean;
};

export function CommentSection({
    enabled,
    loadComments,
    createComment,
    deleteComment,
    lazy = false,
    open = true,
}: CommentSectionProps) {
    const { t } = useTranslation();
    const config = useContext(ClientConfigContext);
    const [comments, setComments] = useState<CommentRecord[]>([]);
    const [error, setError] = useState("");
    const [loaded, setLoaded] = useState(!lazy);
    const ref = useRef(false);

    function refresh() {
        return loadComments().then(({ data, error: err }) => {
            if (err) {
                setError(err);
            } else if (data) {
                setComments(data);
                setError("");
            }
        });
    }

    useEffect(() => {
        if (!enabled) return;
        if (lazy && !open) return;
        if (ref.current && lazy) return;
        ref.current = true;
        setLoaded(true);
        void refresh();
    }, [enabled, lazy, open]);

    if (!enabled || !config.getBoolean("comment.enabled")) {
        return null;
    }

    if (lazy && !open) {
        return null;
    }

    return (
        <div className="mt-3 w-full">
            <CommentComposer
                onSubmit={async (payload) => {
                    const result = await createComment(payload);
                    if (!result.error) {
                        await refresh();
                    }
                    return result;
                }}
            />
            {error ? (
                <div className="mt-2 rounded-xl bg-w p-4 text-center">
                    <p className="t-primary">{error}</p>
                    <button
                        className="mt-2 rounded-full bg-theme px-4 py-2 text-white"
                        onClick={() => void refresh()}
                    >
                        {t("reload")}
                    </button>
                </div>
            ) : null}
            {loaded ? (
                <CommentList
                    comments={comments}
                    onDelete={deleteComment}
                    onRefresh={() => void refresh()}
                />
            ) : null}
        </div>
    );
}
