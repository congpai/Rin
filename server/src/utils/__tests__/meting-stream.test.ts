import { describe, expect, it } from "bun:test";
import { buildStreamReferer } from "../meting-stream";

describe("meting-stream", () => {
  it("builds referer headers by platform", () => {
    expect(buildStreamReferer("netease")).toBe("https://music.163.com/");
    expect(buildStreamReferer("tencent")).toBe("https://y.qq.com/");
    expect(buildStreamReferer("unknown")).toBe("");
  });
});
