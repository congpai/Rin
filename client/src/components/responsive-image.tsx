import { useState } from "react";
import type { ImgHTMLAttributes } from "react";
import { parseImageUrlMetadata } from "../utils/image-upload";
import { buildResponsiveImageProps } from "../utils/responsive-image";
import { markVariantsUnavailable } from "../utils/variant-availability";

type ResponsiveImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "sizes"> & {
    src?: string | null;
    sizes: string;
    preferredWidth?: number;
};

export function ResponsiveImage({
    src,
    sizes,
    preferredWidth,
    onError,
    ...props
}: ResponsiveImageProps) {
    const [useOriginal, setUseOriginal] = useState(false);

    if (!src) {
        return null;
    }

    const originalSrc = parseImageUrlMetadata(src).src;
    const responsive = buildResponsiveImageProps(src, sizes, preferredWidth);
    const shouldUseOriginal = useOriginal || !responsive.srcSet;

    return (
        <img
            {...props}
            src={shouldUseOriginal ? originalSrc : responsive.src}
            srcSet={shouldUseOriginal ? undefined : responsive.srcSet}
            sizes={shouldUseOriginal ? undefined : responsive.sizes}
            onError={(event) => {
                if (!shouldUseOriginal && responsive.srcSet) {
                    markVariantsUnavailable(src);
                    setUseOriginal(true);
                }
                onError?.(event);
            }}
        />
    );
}
