import ReactLoading from "react-loading";

export function PageLoading() {
    return (
        <div className="flex min-h-[50vh] w-full flex-col items-center justify-center text-theme">
            <ReactLoading type="cylon" color="currentColor" />
        </div>
    );
}
