export function FeedCardSkeleton() {
    return (
        <div className="my-2 inline-block w-full break-inside-avoid rounded-2xl bg-w p-6 duration-300 bg-button">
            <div className="mb-2 aspect-[4/3] max-h-80 w-full animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-800" />
            <div className="mb-3 h-7 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="mt-4 space-y-2">
                <div className="h-3 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                <div className="h-3 w-11/12 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            </div>
        </div>
    );
}
