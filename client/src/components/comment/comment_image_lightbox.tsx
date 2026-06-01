import { useMemo, useState, type ReactNode } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

type CommentImageSlide = {
    src: string;
    alt: string;
};

export function useCommentImageLightbox(images: CommentImageSlide[]) {
    const [index, setIndex] = useState(-1);

    const slides = useMemo(
        () =>
            images.map((image) => ({
                src: image.src,
                alt: image.alt,
            })),
        [images],
    );

    function openAt(imageIndex: number) {
        if (imageIndex >= 0 && imageIndex < slides.length) {
            setIndex(imageIndex);
        }
    }

    const lightbox =
        slides.length > 0 ? (
            <Lightbox
                plugins={[Zoom]}
                index={index}
                slides={slides}
                open={index >= 0}
                close={() => setIndex(-1)}
            />
        ) : null;

    return { openAt, lightbox };
}

export function CommentImageLightboxProvider({
    images,
    children,
}: {
    images: CommentImageSlide[];
    children: (openAt: (index: number) => void) => ReactNode;
}) {
    const { openAt, lightbox } = useCommentImageLightbox(images);

    return (
        <>
            {children(openAt)}
            {lightbox}
        </>
    );
}
