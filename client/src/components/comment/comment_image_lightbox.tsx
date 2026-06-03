import { useMemo, useState, type ReactNode } from "react";
import Download from "yet-another-react-lightbox/plugins/download";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import { ImageLightbox } from "../image-lightbox";
import { buildLightboxSlides, type LightboxImageInput } from "../../utils/lightbox-image";
import { useVariantAvailabilityRevision } from "../../utils/use-variant-availability-revision";

export type CommentImageSlide = LightboxImageInput;

export function useCommentImageLightbox(images: CommentImageSlide[]) {
    const [index, setIndex] = useState(-1);
    const variantRevision = useVariantAvailabilityRevision();

    const slides = useMemo(
        () => buildLightboxSlides(images),
        [images, variantRevision],
    );

    function openAt(imageIndex: number) {
        if (imageIndex >= 0 && imageIndex < slides.length) {
            setIndex(imageIndex);
        }
    }

    const lightbox =
        slides.length > 0 ? (
            <ImageLightbox
                plugins={[Zoom, Download]}
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
