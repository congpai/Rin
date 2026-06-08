import { ChickenLoader } from "@rin/ui";

export function PageLoading() {
    return (
        <div className="flex min-h-[50vh] w-full flex-col items-center justify-center">
            <ChickenLoader />
        </div>
    );
}
