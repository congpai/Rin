import { describe, expect, it } from "vitest";
import { buildVariantImageUrl } from "../image-variants";
import {
    buildResponsiveImageProps,
    buildResponsiveSrcSet,
    isResizableBlobUrl,
    pickResponsiveFallbackSrc,
} from "../responsive-image";

describe("responsive-image", () => {
    const sampleUrl = "/api/blob/images/abc123def4567890123456789012345678901234.png#width=1200&height=800";

    it("detects blob urls", () => {
        expect(isResizableBlobUrl(sampleUrl)).toBe(true);
        expect(isResizableBlobUrl("https://cdn.example.com/images/test.webp")).toBe(false);
    });

    it("detects direct storage host urls with hash filenames", () => {
        const cdnUrl = "https://blog.example.com/images/abc123def4567890123456789012345678901234.jpeg";
        expect(isResizableBlobUrl(cdnUrl)).toBe(true);
        const srcSet = buildResponsiveSrcSet(cdnUrl);
        expect(srcSet).toContain("_w640.webp");
    });

    it("builds srcset from pre-generated variant urls", () => {
        const srcSet = buildResponsiveSrcSet(sampleUrl);
        expect(srcSet).toContain("_w320.webp");
        expect(srcSet).not.toContain("_w320.png");
        expect(srcSet).not.toContain("?w=");
    });

    it("falls back to original url for external images", () => {
        const props = buildResponsiveImageProps("https://example.com/a.png", "100vw");
        expect(props).toEqual({ src: "https://example.com/a.png" });
    });

    it("picks a variant fallback width", () => {
        expect(pickResponsiveFallbackSrc(sampleUrl, 640)).toBe(
            buildVariantImageUrl(sampleUrl, 640),
        );
    });
});
