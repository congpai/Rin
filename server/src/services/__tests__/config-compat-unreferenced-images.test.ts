import { describe, expect, it } from "bun:test";
import { isManagedImageStorageKey } from "../config-compat-unreferenced-images";

describe("config-compat-unreferenced-images", () => {
    const env = { S3_FOLDER: "images" } as unknown as Env;

    it("accepts original image keys under configured folder", () => {
        expect(isManagedImageStorageKey(
            "images/abc123def4567890123456789012345678901234.jpeg",
            env,
        )).toBe(true);
    });

    it("accepts variant image keys under configured folder", () => {
        expect(isManagedImageStorageKey(
            "images/abc123def4567890123456789012345678901234_w640.webp",
            env,
        )).toBe(true);
    });

    it("rejects keys outside configured folder", () => {
        expect(isManagedImageStorageKey("uploads/abc123.jpeg", env)).toBe(false);
    });

    it("rejects non-managed filenames", () => {
        expect(isManagedImageStorageKey("images/photo.jpeg", env)).toBe(false);
    });
});
