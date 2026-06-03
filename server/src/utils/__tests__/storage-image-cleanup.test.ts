import { describe, expect, it } from "bun:test";
import {
    buildStorageReferencePatterns,
    collectStorageKeysFromContents,
    isOwnedStorageKey,
    resolveStorageKeyFromImageUrl,
} from "../storage-image-cleanup";

const baseEnv = {
    S3_FOLDER: "images",
    S3_ACCESS_HOST: "https://cdn.example.com",
} as unknown as Env;

describe("resolveStorageKeyFromImageUrl", () => {
    it("resolves S3_ACCESS_HOST urls", () => {
        expect(resolveStorageKeyFromImageUrl(
            "https://cdn.example.com/images/abc123.png#blurhash=test",
            baseEnv,
        )).toBe("images/abc123.png");
    });

    it("resolves /api/blob urls", () => {
        expect(resolveStorageKeyFromImageUrl(
            "/api/blob/images%2Fabc123.png",
            baseEnv,
        )).toBe("images/abc123.png");
    });

    it("resolves same-host blob urls when S3_ACCESS_HOST is set", () => {
        expect(resolveStorageKeyFromImageUrl(
            "https://cdn.example.com/api/blob/images%2Fabc123.png",
            baseEnv,
        )).toBe("images/abc123.png");
    });

    it("ignores external urls", () => {
        expect(resolveStorageKeyFromImageUrl(
            "https://other.example.com/images/abc123.png",
            baseEnv,
        )).toBeNull();
    });
});

describe("isOwnedStorageKey", () => {
    it("accepts keys under configured folder", () => {
        expect(isOwnedStorageKey("images/abc.png", baseEnv)).toBe(true);
        expect(isOwnedStorageKey("uploads/abc.png", baseEnv)).toBe(false);
    });
});

describe("buildStorageReferencePatterns", () => {
    it("includes encoded and plain key patterns", () => {
        const patterns = buildStorageReferencePatterns("images/abc123.png");
        expect(patterns).toContain("images/abc123.png");
        expect(patterns).toContain("images%2Fabc123.png");
    });
});

describe("collectStorageKeysFromContents", () => {
    it("collects unique owned storage keys from markdown", () => {
        const keys = collectStorageKeysFromContents([
            "hello ![a](https://cdn.example.com/images/one.png)",
            "![b](https://cdn.example.com/images/two.png)\n![c](https://cdn.example.com/images/one.png)",
        ], baseEnv);

        expect(keys.sort()).toEqual(["images/one.png", "images/two.png"]);
    });
});
