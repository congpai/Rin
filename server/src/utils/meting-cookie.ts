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
  const base = baseCookie.trim();
  const user = userCookie.trim();
  if (!user) {
    return base;
  }

  let merged = base;
  const parts = user.includes("=")
    ? parseCookieParts(user)
    : [`MUSIC_U=${user}`];

  for (const part of parts) {
    merged = upsertCookiePart(merged, part);
  }

  return merged;
}

export function applyMetingUserCookie(meting: MetingWithHeader, userCookie: string) {
  const cookie = userCookie.trim();
  if (!cookie) {
    return;
  }

  const baseCookie = meting.header?.Cookie ?? "";
  meting.cookie(mergeNeteaseCookies(baseCookie, cookie));
}
