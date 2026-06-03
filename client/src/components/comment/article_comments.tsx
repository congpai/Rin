import { client } from "../../app/runtime";
import { CommentSection } from "./comment_section";
import type { CommentRecord } from "./comment_list";

function parseCreateResult(data: unknown) {
    if (data === "Pending moderation") {
        return { pending: true as const };
    }
    return {};
}

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
                const { data, error } = await client.comment.create(feedId, body);
                if (error) return { error: error.value as string };
                return parseCreateResult(data);
            }}
            deleteComment={async (id) => {
                const { error } = await client.comment.delete(id);
                return { error: error?.value as string | undefined };
            }}
            approveComment={async (id) => {
                const { error } = await client.comment.approve(id);
                return { error: error?.value as string | undefined };
            }}
        />
    );
}
