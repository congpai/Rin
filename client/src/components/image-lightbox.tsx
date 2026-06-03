import { useEffect, useMemo, useState } from "react";
import Lightbox, {
    ImageSlide,
    type LightboxExternalProps,
    type RenderSlideProps,
    isImageSlide,
} from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import {
    getLightboxOriginalSrc,
    type LightboxSlideData,
} from "../utils/lightbox-image";
import { markVariantsAvailable, markVariantsUnavailable } from "../utils/variant-availability";

function FallbackImageSlide({
    slide,
    offset,
    rect,
}: RenderSlideProps) {
    const originalSrc = getLightboxOriginalSrc(slide as LightboxSlideData);
    const [useOriginal, setUseOriginal] = useState(false);

    useEffect(() => {
        setUseOriginal(false);
    }, [slide.src, originalSrc]);

    const displaySlide = useMemo(() => {
        if (!useOriginal || !originalSrc) {
            return slide;
        }

        const data = slide as LightboxSlideData;
        const nextSlide = {
            ...slide,
            src: originalSrc,
            srcSet: undefined,
        };

        if (data.originalWidth && data.originalHeight) {
            nextSlide.width = data.originalWidth;
            nextSlide.height = data.originalHeight;
        }

        return nextSlide;
    }, [slide, useOriginal, originalSrc]);

    if (!isImageSlide(displaySlide)) {
        return null;
    }

    return (
        <ImageSlide
            key={useOriginal ? `${displaySlide.src}-original` : `${displaySlide.src}-preview`}
            slide={displaySlide}
            offset={offset}
            rect={rect}
            onLoad={() => {
                if (!useOriginal && originalSrc && displaySlide.src !== originalSrc) {
                    markVariantsAvailable(originalSrc);
                }
            }}
            onError={() => {
                if (!useOriginal && originalSrc && displaySlide.src !== originalSrc) {
                    markVariantsUnavailable(originalSrc);
                    setUseOriginal(true);
                }
            }}
        />
    );
}

type ImageLightboxProps = LightboxExternalProps;

export function ImageLightbox({ render, ...props }: ImageLightboxProps) {
    return (
        <Lightbox
            {...props}
            render={{
                ...render,
                slide: (slideProps) => {
                    const custom = render?.slide?.(slideProps);
                    if (custom) {
                        return custom;
                    }
                    if (isImageSlide(slideProps.slide)) {
                        return <FallbackImageSlide {...slideProps} />;
                    }
                    return undefined;
                },
            }}
        />
    );
}
