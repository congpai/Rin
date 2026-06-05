import { describe, expect, it } from "bun:test";
import {
  normalizeMetingUpstreamUrl,
  resolveUpstreamApiUrl,
  tryResolveMetingUpstreamUrl,
} from "../meting-helpers";

describe("normalizeMetingUpstreamUrl", () => {
  it("returns empty for blank values", () => {
    expect(normalizeMetingUpstreamUrl("")).toBe("");
    expect(normalizeMetingUpstreamUrl("   ")).toBe("");
  });

  it("auto-prefixes https when protocol is missing", () => {
    expect(normalizeMetingUpstreamUrl("api.injahow.cn/meting")).toBe(
      "https://api.injahow.cn/meting",
    );
  });

  it("treats built-in relative paths as empty", () => {
    expect(normalizeMetingUpstreamUrl("/api/meting")).toBe("");
    expect(normalizeMetingUpstreamUrl("/api/meting/")).toBe("");
  });

  it("strips query and hash from pasted URLs", () => {
    expect(
      normalizeMetingUpstreamUrl(
        "https://api.injahow.cn/meting/?server=netease&type=playlist&id=123",
      ),
    ).toBe("https://api.injahow.cn/meting");
  });

  it("normalizes duplicated /api suffix", () => {
    expect(normalizeMetingUpstreamUrl("https://example.com/api/meting/api")).toBe(
      "https://example.com/api/meting",
    );
  });

  it("sanitizes full-width punctuation", () => {
    expect(normalizeMetingUpstreamUrl("https：//api.injahow.cn/meting")).toBe(
      "https://api.injahow.cn/meting",
    );
  });

  it("falls back to built-in when upstream is invalid", () => {
    const mockC = {
      req: {
        url: "https://blog.example.com/api/meting/api?server=netease",
        header: (name: string) => ({
          host: "blog.example.com",
          "x-forwarded-host": "blog.example.com",
          "x-forwarded-proto": "https",
        }[name.toLowerCase()]),
      },
    } as never;

    expect(tryResolveMetingUpstreamUrl("https://", mockC)).toBe("");
    expect(tryResolveMetingUpstreamUrl("blog.example.com/api/meting", mockC)).toBe("");
  });
});

describe("resolveUpstreamApiUrl", () => {
  it("appends /api for generic bases", () => {
    expect(resolveUpstreamApiUrl("https://meting.example.com")).toBe(
      "https://meting.example.com/api",
    );
  });

  it("keeps injahow-style meting roots", () => {
    expect(resolveUpstreamApiUrl("https://api.injahow.cn/meting")).toBe(
      "https://api.injahow.cn/meting",
    );
  });

  it("appends /api for rin-style meting roots", () => {
    expect(resolveUpstreamApiUrl("https://example.com/api/meting")).toBe(
      "https://example.com/api/meting/api",
    );
  });
});
