import { describe, expect, it } from "bun:test";
import { normalizeMetingResourceId } from "../meting-helpers";
import {
  fetchTencentSongMidFromSongId,
  followShareRedirects,
  isTencentSongShareUrl,
  resolveTencentResourceId,
} from "../meting-tencent";

describe("normalizeMetingResourceId QQ Music links", () => {
  it("extracts songid from playsong.html links", () => {
    expect(
      normalizeMetingResourceId("https://i.y.qq.com/v8/playsong.html?songid=106680290&songtype=0#webchat_redirect"),
    ).toBe("106680290");
  });

  it("extracts songid from songDetail links", () => {
    expect(
      normalizeMetingResourceId("https://y.qq.com/n/ryqq_v2/songDetail/106680290?ADTAG=h5_play_song"),
    ).toBe("106680290");
  });
});

describe("isTencentSongShareUrl", () => {
  it("detects song share URLs", () => {
    expect(isTencentSongShareUrl("https://y.qq.com/n/ryqq_v2/songDetail/106680290")).toBe(true);
    expect(isTencentSongShareUrl("https://i.y.qq.com/v8/playsong.html?songid=106680290")).toBe(true);
    expect(isTencentSongShareUrl("https://y.qq.com/n/ryqq/playlist/7266465760")).toBe(false);
  });
});

describe("fetchTencentSongMidFromSongId", () => {
  it("converts numeric songid to songmid", async () => {
    const mid = await fetchTencentSongMidFromSongId("106680290");
    expect(mid).toBe("000ah21O10ffUj");
  });
});

describe("followShareRedirects", () => {
  it("resolves QQ Music short links to songDetail URLs", async () => {
    const resolved = await followShareRedirects("https://c6.y.qq.com/base/fcgi-bin/u?__=y3zSv2");
    expect(resolved).toContain("songDetail/106680290");
  });
});

describe("resolveTencentResourceId", () => {
  it("resolves song share links to songmid", async () => {
    const mid = await resolveTencentResourceId(
      "https://i.y.qq.com/v8/playsong.html?songid=106680290&songtype=0",
      "song",
    );
    expect(mid).toBe("000ah21O10ffUj");
  });

  it("resolves short links to songmid", async () => {
    const mid = await resolveTencentResourceId(
      "https://c6.y.qq.com/base/fcgi-bin/u?__=y3zSv2",
      "song",
    );
    expect(mid).toBe("000ah21O10ffUj");
  });

  it("converts numeric songid when type is song", async () => {
    const mid = await resolveTencentResourceId("106680290", "song");
    expect(mid).toBe("000ah21O10ffUj");
  });
});
