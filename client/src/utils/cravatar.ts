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

    const rol = (v: number, s: number) => ((v << s) | (v >>> (32 - s))) >>> 0;
    const op = (base: number, q: number, x: number, t: number, s: number, add: number) =>
        (add + rol((base + q + x + t) >>> 0, s)) >>> 0;

    for (let i = 0; i < words.length; i += 16) {
        const oa = a;
        const ob = b;
        const oc = c;
        const od = d;

        a = op(a, (b & c) | (~b & d), words[i], 0xd76aa478, 7, d);
        d = op(d, (a & b) | (~a & c), words[i + 1], 0xe8c7b756, 12, c);
        c = op(c, (d & a) | (~d & b), words[i + 2], 0x242070db, 17, b);
        b = op(b, (c & d) | (~c & a), words[i + 3], 0xc1bdceee, 22, a);
        a = op(a, (b & c) | (~b & d), words[i + 4], 0xf57c0faf, 7, d);
        d = op(d, (a & b) | (~a & c), words[i + 5], 0x4787c62a, 12, c);
        c = op(c, (d & a) | (~d & b), words[i + 6], 0xa8304613, 17, b);
        b = op(b, (c & d) | (~c & a), words[i + 7], 0xfd469501, 22, a);
        a = op(a, (b & c) | (~b & d), words[i + 8], 0x698098d8, 7, d);
        d = op(d, (a & b) | (~a & c), words[i + 9], 0x8b44f7af, 12, c);
        c = op(c, (d & a) | (~d & b), words[i + 10], 0xffff5bb1, 17, b);
        b = op(b, (c & d) | (~c & a), words[i + 11], 0x895cd7be, 22, a);
        a = op(a, (b & c) | (~b & d), words[i + 12], 0x6b901122, 7, d);
        d = op(d, (a & b) | (~a & c), words[i + 13], 0xfd987193, 12, c);
        c = op(c, (d & a) | (~d & b), words[i + 14], 0xa679438e, 17, b);
        b = op(b, (c & d) | (~c & a), words[i + 15], 0x49b40821, 22, a);

        a = op(a, (b & d) | (c & ~d), words[i + 1], 0xf61e2562, 5, d);
        d = op(d, (a & c) | (b & ~c), words[i + 6], 0xc040b340, 9, c);
        c = op(c, (d & b) | (a & ~b), words[i + 11], 0x265e5a51, 14, b);
        b = op(b, (c & a) | (d & ~a), words[i], 0xe9b6c7aa, 20, a);
        a = op(a, (b & d) | (c & ~d), words[i + 5], 0xd62f105d, 5, d);
        d = op(d, (a & c) | (b & ~c), words[i + 10], 0x02441453, 9, c);
        c = op(c, (d & b) | (a & ~b), words[i + 15], 0xd8a1e681, 14, b);
        b = op(b, (c & a) | (d & ~a), words[i + 4], 0xe7d3fbc8, 20, a);
        a = op(a, (b & d) | (c & ~d), words[i + 9], 0x21e1cde6, 5, d);
        d = op(d, (a & c) | (b & ~c), words[i + 14], 0xc33707d6, 9, c);
        c = op(c, (d & b) | (a & ~b), words[i + 3], 0xf4d50d87, 14, b);
        b = op(b, (c & a) | (d & ~a), words[i + 8], 0x455a14ed, 20, a);
        a = op(a, (b & d) | (c & ~d), words[i + 13], 0xa9e3e905, 5, d);
        d = op(d, (a & c) | (b & ~c), words[i + 2], 0xfcefa3f8, 9, c);
        c = op(c, (d & b) | (a & ~b), words[i + 7], 0x676f02d9, 14, b);
        b = op(b, (c & a) | (d & ~a), words[i + 12], 0x8d2a4c8a, 20, a);

        a = op(a, b ^ c ^ d, words[i + 5], 0xfffa3942, 4, d);
        d = op(d, a ^ b ^ c, words[i + 8], 0x8771f681, 11, c);
        c = op(c, d ^ a ^ b, words[i + 11], 0x6d9d6122, 16, b);
        b = op(b, c ^ d ^ a, words[i + 14], 0xfde5380c, 23, a);
        a = op(a, b ^ c ^ d, words[i + 1], 0xa4beea44, 4, d);
        d = op(d, a ^ b ^ c, words[i + 4], 0x4bdecfa9, 11, c);
        c = op(c, d ^ a ^ b, words[i + 7], 0xf6bb4b60, 16, b);
        b = op(b, c ^ d ^ a, words[i + 10], 0xbebfbc70, 23, a);
        a = op(a, b ^ c ^ d, words[i + 13], 0x289b7ec6, 4, d);
        d = op(d, a ^ b ^ c, words[i], 0xeaa127fa, 11, c);
        c = op(c, d ^ a ^ b, words[i + 3], 0xd4ef3085, 16, b);
        b = op(b, c ^ d ^ a, words[i + 6], 0x04881d05, 23, a);
        a = op(a, b ^ c ^ d, words[i + 9], 0xd9d4d039, 4, d);
        d = op(d, a ^ b ^ c, words[i + 12], 0xe6db99e5, 11, c);
        c = op(c, d ^ a ^ b, words[i + 15], 0x1fa27cf8, 16, b);
        b = op(b, c ^ d ^ a, words[i + 2], 0xc4ac5665, 23, a);

        a = op(a, c ^ (b | ~d), words[i], 0xf4292244, 6, d);
        d = op(d, b ^ (a | ~c), words[i + 7], 0x432aff97, 10, c);
        c = op(c, a ^ (d | ~b), words[i + 14], 0xab9423a7, 15, b);
        b = op(b, d ^ (c | ~a), words[i + 5], 0xfc93a039, 21, a);
        a = op(a, c ^ (b | ~d), words[i + 12], 0x655b59c3, 6, d);
        d = op(d, b ^ (a | ~c), words[i + 3], 0x8f0ccc92, 10, c);
        c = op(c, a ^ (d | ~b), words[i + 10], 0xffeff47d, 15, b);
        b = op(b, d ^ (c | ~a), words[i + 1], 0x85845dd1, 21, a);
        a = op(a, c ^ (b | ~d), words[i + 8], 0x6fa87e4f, 6, d);
        d = op(d, b ^ (a | ~c), words[i + 15], 0xfe2ce6e0, 10, c);
        c = op(c, a ^ (d | ~b), words[i + 6], 0xa3014314, 15, b);
        b = op(b, d ^ (c | ~a), words[i + 13], 0x4e0811a1, 21, a);
        a = op(a, c ^ (b | ~d), words[i + 4], 0xf7537e82, 6, d);
        d = op(d, b ^ (a | ~c), words[i + 11], 0xbd3af235, 10, c);
        c = op(c, a ^ (d | ~b), words[i + 2], 0x2ad7d2bb, 15, b);
        b = op(b, d ^ (c | ~a), words[i + 9], 0xeb86d391, 21, a);

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

export function getCravatarUrl(
    email: string,
    options?: { size?: number; defaultUrl?: string },
): string {
    const hash = md5(email.trim().toLowerCase());
    const size = options?.size ?? 64;
    const params = new URLSearchParams({ s: String(size), r: "g" });
    if (options?.defaultUrl) {
        params.set("d", options.defaultUrl);
    }
    return `https://cravatar.cn/avatar/${hash}?${params.toString()}`;
}

/** Resolve avatar for a comment row (logged-in user or guest). */
export function resolveCommentAvatar(options: {
    userAvatar?: string | null;
    guestEmail?: string;
    /** Site default avatar from `site.avatar` */
    defaultAvatar?: string;
    size?: number;
}): string {
    if (options.userAvatar) {
        return options.userAvatar;
    }

    const fallback = options.defaultAvatar?.trim() ?? "";

    if (options.guestEmail?.trim()) {
        return getCravatarUrl(options.guestEmail, {
            size: options.size,
            defaultUrl: fallback || undefined,
        });
    }

    return fallback;
}
