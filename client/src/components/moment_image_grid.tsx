import { useMemo, useState } from "react";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { ImageLightbox } from "./image-lightbox";
import { ResponsiveImage } from "./responsive-image";
import { buildLightboxSlides } from "../utils/lightbox-image";
import { useVariantAvailabilityRevision } from "../utils/use-variant-availability-revision";
import {
    type MomentImage,
    momentGridCols,
    MOMENT_GRID_MAX,
} from "../utils/moment-content";

type MomentImageGridProps = {
    images: MomentImage[];
};

export function MomentImageGrid({ images }: MomentImageGridProps) {
    const [index, setIndex] = useState(-1);
    const variantRevision = useVariantAvailabilityRevision();

    if (images.length === 0) {
        return null;
    }

    const visible = images.slice(0, MOMENT_GRID_MAX);
    const extra = images.length - MOMENT_GRID_MAX;
    const cols = momentGridCols(visible.length);
    const imageSizes =
        cols === 1
            ? "(max-width: 768px) 100vw, 960px"
            : cols === 2
              ? "(max-width: 768px) 50vw, 420px"
              : "(max-width: 768px) 33vw, 280px";
    const preferredWidth = cols === 1 ? 960 : 640;

    const gridClass =
    cols === 1
        ? "grid w-full grid-cols-1 gap-1"
        : cols === 2
          ? "grid w-full grid-cols-2 gap-1"
          : "grid w-full grid-cols-3 gap-1";

    const slides = useMemo(
        () => buildLightboxSlides(images.map((img) => ({ url: img.url, alt: img.alt }))),
        [images, variantRevision],
    );

    return (
        <>
            <div className={`${gridClass} mt-3`}>
                {visible.map((img, i) => {
                    const isLastWithMore =
                        extra > 0 && i === visible.length - 1;
                    const single = visible.length === 1;

                    return (
                        <button
                            key={`${img.cleanUrl}-${i}`}
                            type="button"
                            aria-label={img.alt || `图片 ${i + 1}`}
                            onClick={() => setIndex(i)}
                            className={`relative overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800 ${
                                single ? "aspect-[4/3]" : "aspect-square"
                            }`}
                        >
                            <ResponsiveImage
                                src={img.url}
                                alt={img.alt}
                                loading="lazy"
                                decoding="async"
                                sizes={imageSizes}
                                preferredWidth={preferredWidth}
                                className="h-full w-full object-cover transition hover:scale-105"
                            />
                            {isLastWithMore ? (
                                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-semibold text-white">
                                    +{extra}
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>

            <ImageLightbox
                plugins={[Zoom]}
                index={index}
                slides={slides}
                open={index >= 0}
                close={() => setIndex(-1)}
                onIndexChange={setIndex}
            />
        </>
    );
}
