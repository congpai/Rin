import { describe, expect, it } from "bun:test";
import {
    isOriginalImageStorageKey,
    storageKeyToUploadKey,
} from "../config-compat-image-variants";
import { resolveFullStorageKey } from "../../utils/storage";

describe("config-compat-image-variants", () => {
    const env = { S3_FOLDER: "images" } as unknown as Env;

    it("detects original image storage keys", () => {
        expect(isOriginalImageStorageKey("images/abc123def4567890123456789012345678901234.jpeg")).toBe(true);
        expect(isOriginalImageStorageKey("images/abc123def4567890123456789012345678901234_w640.webp")).toBe(false);
        expect(isOriginalImageStorageKey("images/photo.jpeg")).toBe(false);
    });

    it("strips configured folder from upload key", () => {
        expect(storageKeyToUploadKey("images/abc123.jpeg", env)).toBe("abc123.jpeg");
    });

    it("normalizes full storage keys for variant generation", () => {
        expect(resolveFullStorageKey(env, "images/abc123.jpeg")).toBe("images/abc123.jpeg");
        expect(resolveFullStorageKey(env, "abc123.jpeg")).toBe("images/abc123.jpeg");
    });
});
