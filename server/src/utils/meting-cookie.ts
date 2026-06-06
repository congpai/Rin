import type Meting from "@meting/core";

type MetingWithHeader = InstanceType<typeof Meting> & {
  header?: {
    Cookie?: string;
  };
};

function parseCookieParts(cookie: string) {
  return cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function upsertCookiePart(cookie: string, part: string) {
  const key = part.split("=")[0]?.trim();
  if (!key) {
    return cookie;
  }

  const nextParts = parseCookieParts(cookie).filter((entry) => !entry.startsWith(`${key}=`));
  nextParts.push(part);
  return nextParts.join("; ");
}

export function mergeNeteaseCookies(baseCookie: string, userCookie: string) {
  return mergeProviderCookies(baseCookie, userCookie, "MUSIC_U");
}

export function mergeProviderCookies(
  baseCookie: string,
  userCookie: string,
  defaultKey?: string,
) {
  const base = baseCookie.trim();
  const user = userCookie.trim();
  if (!user) {
    return base;
  }

  const parts = user.includes("=")
    ? parseCookieParts(user)
    : defaultKey
      ? [`${defaultKey}=${user}`]
      : [user];

  let merged = base;
  for (const part of parts) {
    const normalized = part.includes("=") ? part : `${defaultKey ?? "cookie"}=${part}`;
    merged = upsertCookiePart(merged, normalized);
  }

  return merged;
}

export function applyMetingUserCookie(
  meting: MetingWithHeader,
  userCookie: string,
  server?: string,
) {
  const cookie = userCookie.trim();
  if (!cookie) {
    return;
  }

  const baseCookie = meting.header?.Cookie ?? "";
  if (server === "netease") {
    meting.cookie(mergeProviderCookies(baseCookie, cookie, "MUSIC_U"));
    return;
  }

  meting.cookie(mergeProviderCookies(baseCookie, cookie));
}
