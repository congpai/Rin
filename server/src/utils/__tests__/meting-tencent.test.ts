import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { normalizeMetingResourceId } from "../meting-helpers";
import {
  fetchTencentPlayUrl,
  fetchTencentSongMidFromSongId,
  followShareRedirects,
  isTencentSongShareUrl,
  readTencentUin,
  resolveTencentResourceId,
} from "../meting-tencent";

const originalFetch = globalThis.fetch;
const SONG_DETAIL_URL = "https://y.qq.com/n/ryqq_v2/songDetail/106680290";
const SONG_MID = "000ah21O10ffUj";

function mockSongDetailResponse() {
  return new Response(JSON.stringify({
    code: 0,
    data: [{ mid: SONG_MID, title: "玻璃之情", id: 106680290 }],
  }), { status: 200 });
}

function mockRedirectResponse(location: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: location },
  });
}

beforeEach(() => {
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("fcgi-bin/u?__=y3zSv2")) {
      return mockRedirectResponse(SONG_DETAIL_URL);
    }

    if (url.includes("fcg_play_single_song.fcg?songid=106680290")) {
      return mockSongDetailResponse();
    }

    if (url.includes("musicu.fcg") && url.includes("001sTnpM1Kw5aa")) {
      return new Response(JSON.stringify({
        req: {
          data: {
            sip: ["http://aqqmusic.tc.qq.com/"],
            midurlinfo: [{
              purl: "C400001sTnpM1Kw5aa.m4a?guid=10000&vkey=test",
            }],
          },
        },
      }), { status: 200 });
    }

    return new Response(null, { status: 404 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

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
    expect(mid).toBe(SONG_MID);
  });
});

describe("followShareRedirects", () => {
  it("resolves QQ Music short links to songDetail URLs", async () => {
    const resolved = await followShareRedirects("https://c6.y.qq.com/base/fcgi-bin/u?__=y3zSv2");
    expect(resolved).toBe(SONG_DETAIL_URL);
  });

  it("follows multiple redirect hops", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("short.example/s/1")) {
        return mockRedirectResponse("https://short.example/s/2");
      }
      if (url.includes("short.example/s/2")) {
        return mockRedirectResponse(SONG_DETAIL_URL);
      }
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    const resolved = await followShareRedirects("https://short.example/s/1");
    expect(resolved).toBe(SONG_DETAIL_URL);
  });
});

describe("readTencentUin", () => {
  it("extracts numeric uin from cookie", () => {
    expect(readTencentUin("uin=o0123456789; qqmusic_key=abc")).toBe("123456789");
    expect(readTencentUin("")).toBe("0");
  });
});

describe("fetchTencentPlayUrl", () => {
  it("builds playable url from vkey response", async () => {
    const url = await fetchTencentPlayUrl("001sTnpM1Kw5aa");
    expect(url).toBe("https://aqqmusic.tc.qq.com/C400001sTnpM1Kw5aa.m4a?guid=10000&vkey=test");
  });
});

describe("resolveTencentResourceId", () => {
  it("resolves song share links to songmid", async () => {
    const mid = await resolveTencentResourceId(
      "https://i.y.qq.com/v8/playsong.html?songid=106680290&songtype=0",
      "song",
    );
    expect(mid).toBe(SONG_MID);
  });

  it("resolves short links to songmid", async () => {
    const mid = await resolveTencentResourceId(
      "https://c6.y.qq.com/base/fcgi-bin/u?__=y3zSv2",
      "song",
    );
    expect(mid).toBe(SONG_MID);
  });

  it("converts numeric songid when type is song", async () => {
    const mid = await resolveTencentResourceId("106680290", "song");
    expect(mid).toBe(SONG_MID);
  });
});
