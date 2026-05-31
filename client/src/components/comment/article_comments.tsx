import { client } from "../../app/runtime";
import { CommentSection } from "../comment/comment_section";
import type { CommentRecord } from "../comment/comment_list";

export function ArticleComments({ feedId }: { feedId: number }) {
    return (
        <CommentSection
            enabled
            loadComments={async () => {
                const { data, error } = await client.comment.list(feedId);
                if (error) return { error: error.value as string };
                return { data: (data ?? []) as CommentRecord[] };
            }}
            createComment={async (body) => {
                const { error } = await client.comment.create(feedId, body);
                return { error: error?.value as string | undefined };
            }}
            deleteComment={async (id) => {
                const { error } = await client.comment.delete(id);
                return { error: error?.value as string | undefined };
            }}
        />
    );
}
