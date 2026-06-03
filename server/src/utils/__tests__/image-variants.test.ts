import { describe, expect, it } from "bun:test";
import {
    buildVariantStorageKey,
    expandStorageKeysWithVariants,
    getBaseStorageKeyFromVariant,
    isValidVariantStorageKey,
    listVariantStorageKeys,
} from "../image-variants";

describe("image-variants", () => {
    it("builds predictable variant keys", () => {
        const base = "images/abc123def4567890123456789012345678901234.webp";
        expect(buildVariantStorageKey(base, 320)).toBe(
            "images/abc123def4567890123456789012345678901234_w320.webp",
        );
    });

    it("validates forced variant storage keys", () => {
        expect(isValidVariantStorageKey("abc123def4567890123456789012345678901234_w320.webp")).toBe(true);
        expect(isValidVariantStorageKey("abc123_w320.webp")).toBe(false);
    });

    it("expands base keys to include variants", () => {
        const base = "images/abc123def4567890123456789012345678901234.png";
        const expanded = expandStorageKeysWithVariants([base]);
        expect(expanded).toContain(base);
        expect(expanded).toContain("images/abc123def4567890123456789012345678901234_w320.webp");
        expect(expanded).toContain("images/abc123def4567890123456789012345678901234_w640.webp");
        expect(expanded).toContain("images/abc123def4567890123456789012345678901234_w960.webp");
    });

    it("resolves base key from variant key", () => {
        const variant = "images/abc123def4567890123456789012345678901234_w640.webp";
        expect(getBaseStorageKeyFromVariant(variant)).toBe(
            "images/abc123def4567890123456789012345678901234.png",
        );
    });

    it("does not generate variants for variant keys", () => {
        expect(listVariantStorageKeys("images/abc123def4567890123456789012345678901234_w320.webp")).toEqual([]);
    });
});
