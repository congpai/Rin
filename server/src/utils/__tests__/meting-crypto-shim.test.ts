import { describe, expect, it } from "bun:test";
import nodeCrypto from "node:crypto";

describe("meting-crypto-shim", () => {
  it("allows aes-128-ecb encryption with null iv after shim loads", async () => {
    await import("../meting-crypto-shim");

    const cipher = (nodeCrypto.createCipheriv as (
      algorithm: string,
      key: Buffer,
      iv: null,
    ) => ReturnType<typeof nodeCrypto.createCipheriv>)(
      "aes-128-ecb",
      Buffer.from("e82ckenh8dichen8", "utf8"),
      null,
    );
    cipher.setAutoPadding(true);
    let encrypted = cipher.update("payload", "utf8", "hex");
    encrypted += cipher.final("hex");

    expect(encrypted.length).toBeGreaterThan(0);
  });
});
