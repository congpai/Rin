/** MD5 hex digest (browser-safe, for Cravatar email hash). */
function md5(input: string): string {
    const utf8 = unescape(encodeURIComponent(input));
    const words: number[] = [];
    for (let i = 0; i < utf8.length; i += 1) {
        words[i >> 2] |= utf8.charCodeAt(i) << ((i % 4) * 8);
    }
    words[utf8.length >> 2] |= 0x80 << ((utf8.length % 4) * 8);
    words[(((utf8.length + 8) >> 6) + 1) << 4] = utf8.length * 8;

    let a = 0x67452301;
    let b = 0xefcdab89;
    let c = 0x98badcfe;
    let d = 0x01234567;

    const ff = (q: number, a0: number, b0: number, c0: number, d0: number, x: number, s: number, t: number) =>
        c0 + (((a0 + q + x + t) << s) | ((a0 + q + x + t) >>> (32 - s))) + d0;
    const gg = (q: number, a0: number, b0: number, c0: number, d0: number, x: number, s: number, t: number) =>
        c0 + (((a0 + q + x + t) << s) | ((a0 + q + x + t) >>> (32 - s))) + d0;
    const hh = (q: number, a0: number, b0: number, c0: number, d0: number, x: number, s: number, t: number) =>
        c0 + (((a0 + q + x + t) << s) | ((a0 + q + x + t) >>> (32 - s))) + d0;
    const ii = (q: number, a0: number, b0: number, c0: number, d0: number, x: number, s: number, t: number) =>
        d0 + (((a0 + q + x + t) << s) | ((a0 + q + x + t) >>> (32 - s))) + c0;

    for (let i = 0; i < words.length; i += 16) {
        const oa = a;
        const ob = b;
        const oc = c;
        const od = d;

        a = ff((b & c) | (~b & d), a, b, c, d, words[i], 7, 0xd76aa478);
        d = ff((a & b) | (~a & c), d, a, b, c, words[i + 1], 12, 0xe8c7b756);
        c = ff((d & a) | (~d & b), c, d, a, b, words[i + 2], 17, 0x242070db);
        b = ff((c & d) | (~c & a), b, c, d, a, words[i + 3], 22, 0xc1bdceee);
        a = ff((b & c) | (~b & d), a, b, c, d, words[i + 4], 7, 0xf57c0faf);
        d = ff((a & b) | (~a & c), d, a, b, c, words[i + 5], 12, 0x4787c62a);
        c = ff((d & a) | (~d & b), c, d, a, b, words[i + 6], 17, 0xa8304613);
        b = ff((c & d) | (~c & a), b, c, d, a, words[i + 7], 22, 0xfd469501);
        a = ff((b & c) | (~b & d), a, b, c, d, words[i + 8], 7, 0x698098d8);
        d = ff((a & b) | (~a & c), d, a, b, c, words[i + 9], 12, 0x8b44f7af);
        c = ff((d & a) | (~d & b), c, d, a, b, words[i + 10], 17, 0xffff5bb1);
        b = ff((c & d) | (~c & a), b, c, d, a, words[i + 11], 22, 0x895cd7be);
        a = ff((b & c) | (~b & d), a, b, c, d, words[i + 12], 7, 0x6b901122);
        d = ff((a & b) | (~a & c), d, a, b, c, words[i + 13], 12, 0xfd987193);
        c = ff((d & a) | (~d & b), c, d, a, b, words[i + 14], 17, 0xa679438e);
        b = ff((c & d) | (~c & a), b, c, d, a, words[i + 15], 22, 0x49b40821);

        a = gg((b & d) | (c & ~d), a, b, c, d, words[i + 1], 5, 0xf61e2562);
        d = gg((a & c) | (b & ~c), d, a, b, c, words[i + 6], 9, 0xc040b340);
        c = gg((d & b) | (a & ~b), c, d, a, b, words[i + 11], 14, 0x265e5a51);
        b = gg((c & a) | (d & ~a), b, c, d, a, words[i], 20, 0xe9b6c7aa);
        a = gg((b & d) | (c & ~d), a, b, c, d, words[i + 5], 5, 0xd62f105d);
        d = gg((a & c) | (b & ~c), d, a, b, c, words[i + 10], 9, 0x02441453);
        c = gg((d & b) | (a & ~b), c, d, a, b, words[i + 15], 14, 0xd8a1e681);
        b = gg((c & a) | (d & ~a), b, c, d, a, words[i + 4], 20, 0xe7d3fbc8);
        a = gg((b & d) | (c & ~d), a, b, c, d, words[i + 9], 5, 0x21e1cde6);
        d = gg((a & c) | (b & ~c), d, a, b, c, words[i + 14], 9, 0xc33707d6);
        c = gg((d & b) | (a & ~b), c, d, a, b, words[i + 3], 14, 0xf4d50d87);
        b = gg((c & a) | (d & ~a), b, c, d, a, words[i + 8], 20, 0x455a14ed);
        a = gg((b & d) | (c & ~d), a, b, c, d, words[i + 13], 5, 0xa9e3e905);
        d = gg((a & c) | (b & ~c), d, a, b, c, words[i + 2], 9, 0xfcefa3f8);
        c = gg((d & b) | (a & ~b), c, d, a, b, words[i + 7], 14, 0x676f02d9);
        b = gg((c & a) | (d & ~a), b, c, d, a, words[i + 12], 20, 0x8d2a4c8a);

        a = hh(b ^ c ^ d, a, b, c, d, words[i + 5], 4, 0xfffa3942);
        d = hh(a ^ b ^ c, d, a, b, c, words[i + 8], 11, 0x8771f681);
        c = hh(d ^ a ^ b, c, d, a, b, words[i + 11], 16, 0x6d9d6122);
        b = hh(c ^ d ^ a, b, c, d, a, words[i + 14], 23, 0xfde5380c);
        a = hh(b ^ c ^ d, a, b, c, d, words[i + 1], 4, 0xa4beea44);
        d = hh(a ^ b ^ c, d, a, b, c, words[i + 4], 11, 0x4bdecfa9);
        c = hh(d ^ a ^ b, c, d, a, b, words[i + 7], 16, 0xf6bb4b60);
        b = hh(c ^ d ^ a, b, c, d, a, words[i + 10], 23, 0xbebfbc70);
        a = hh(b ^ c ^ d, a, b, c, d, words[i + 13], 4, 0x289b7ec6);
        d = hh(a ^ b ^ c, d, a, b, c, words[i], 11, 0xeaa127fa);
        c = hh(d ^ a ^ b, c, d, a, b, words[i + 3], 16, 0xd4ef3085);
        b = hh(c ^ d ^ a, b, c, d, a, words[i + 6], 23, 0x04881d05);
        a = hh(b ^ c ^ d, a, b, c, d, words[i + 9], 4, 0xd9d4d039);
        d = hh(a ^ b ^ c, d, a, b, c, words[i + 12], 11, 0xe6db99e5);
        c = hh(d ^ a ^ b, c, d, a, b, words[i + 15], 16, 0x1fa27cf8);
        b = hh(c ^ d ^ a, b, c, d, a, words[i + 2], 23, 0xc4ac5665);

        a = ii(c ^ (b | ~d), a, b, c, d, words[i], 6, 0xf4292244);
        d = ii(b ^ (a | ~c), d, a, b, c, words[i + 7], 10, 0x432aff97);
        c = ii(a ^ (d | ~b), c, d, a, b, words[i + 14], 15, 0xab9423a7);
        b = ii(d ^ (c | ~a), b, c, d, a, words[i + 5], 21, 0xfc93a039);
        a = ii(c ^ (b | ~d), a, b, c, d, words[i + 12], 6, 0x655b59c3);
        d = ii(b ^ (a | ~c), d, a, b, c, words[i + 3], 10, 0x8f0ccc92);
        c = ii(a ^ (d | ~b), c, d, a, b, words[i + 10], 15, 0xffeff47d);
        b = ii(d ^ (c | ~a), b, c, d, a, words[i + 1], 21, 0x85845dd1);
        a = ii(c ^ (b | ~d), a, b, c, d, words[i + 8], 6, 0x6fa87e4f);
        d = ii(b ^ (a | ~c), d, a, b, c, words[i + 15], 10, 0xfe2ce6e0);
        c = ii(a ^ (d | ~b), c, d, a, b, words[i + 6], 15, 0xa3014314);
        b = ii(d ^ (c | ~a), b, c, d, a, words[i + 13], 21, 0x4e0811a1);
        a = ii(c ^ (b | ~d), a, b, c, d, words[i + 4], 6, 0xf7537e82);
        d = ii(b ^ (a | ~c), d, a, b, c, words[i + 11], 10, 0xbd3af235);
        c = ii(a ^ (d | ~b), c, d, a, b, words[i + 2], 15, 0x2ad7d2bb);
        b = ii(d ^ (c | ~a), b, c, d, a, words[i + 9], 21, 0xeb86d391);

        a = (a + oa) >>> 0;
        b = (b + ob) >>> 0;
        c = (c + oc) >>> 0;
        d = (d + od) >>> 0;
    }

    const hex = (n: number) => {
        const s = (n >>> 0).toString(16);
        return "00000000".slice(s.length) + s;
    };
    return hex(a) + hex(b) + hex(c) + hex(d);
}

export type CravatarDefault =
    | "404"
    | "mp"
    | "identicon"
    | "monsterid"
    | "wavatar"
    | "retro"
    | "robohash"
    | "blank"
    | string;

/** Build Cravatar URL from email. See https://cravatar.com/developer/api */
export function getCravatarUrl(
    email: string,
    options?: { size?: number; default?: CravatarDefault },
): string {
    const hash = md5(email.trim().toLowerCase());
    const size = options?.size ?? 64;
    const fallback = options?.default ?? "identicon";
    const d =
        fallback.startsWith("http://") || fallback.startsWith("https://")
            ? encodeURIComponent(fallback)
            : fallback;
    return `https://cravatar.cn/avatar/${hash}?s=${size}&d=${d}&r=g`;
}

/** Resolve avatar for a comment row (logged-in user or guest). */
export function resolveCommentAvatar(options: {
    userAvatar?: string | null;
    guestEmail?: string;
    guestName?: string;
    /** Site default avatar URL, or built-in style like identicon */
    defaultAvatar?: CravatarDefault;
    size?: number;
}): string {
    if (options.userAvatar) {
        return options.userAvatar;
    }

    const fallback = options.defaultAvatar ?? "identicon";

    if (options.guestEmail?.trim()) {
        return getCravatarUrl(options.guestEmail, {
            size: options.size,
            default: fallback,
        });
    }

    if (options.guestName?.trim()) {
        return getCravatarUrl(options.guestName, {
            size: options.size,
            default: fallback,
        });
    }

    return getCravatarUrl("guest", { size: options.size, default: fallback });
}
