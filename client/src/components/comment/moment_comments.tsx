import { client } from "../../app/runtime";
import { CommentSection } from "./comment_section";
import type { CommentRecord } from "./comment_list";

function parseCreateResult(data: unknown) {
    if (data === "Pending moderation") {
        return { pending: true as const };
    }
    return {};
}

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
                const { data, error } = await client.momentComment.create(momentId, body);
                if (error) return { error: error.value as string };
                return parseCreateResult(data);
            }}
            deleteComment={async (id) => {
                const { error } = await client.momentComment.delete(id);
                return { error: error?.value as string | undefined };
            }}
            approveComment={async (id) => {
                const { error } = await client.momentComment.approve(id);
                return { error: error?.value as string | undefined };
            }}
        />
    );
}
