import { client } from "../../app/runtime";
import { CommentSection } from "../comment/comment_section";
import type { CommentRecord } from "../comment/comment_list";

export function MomentComments({
    momentId,
    open,
}: {
    momentId: number;
    open: boolean;
}) {
    return (
        <CommentSection
            enabled
            lazy
            open={open}
            loadComments={async () => {
                const { data, error } = await client.momentComment.list(momentId);
                if (error) return { error: error.value as string };
                return { data: (data ?? []) as CommentRecord[] };
            }}
            createComment={async (body) => {
                const { error } = await client.momentComment.create(momentId, body);
                return { error: error?.value as string | undefined };
            }}
            deleteComment={async (id) => {
                const { error } = await client.momentComment.delete(id);
                return { error: error?.value as string | undefined };
            }}
        />
    );
}
