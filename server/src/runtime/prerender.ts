import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq } from "drizzle-orm";
import * as schema from "../db/schema";
import { feeds } from "../db/schema";
import { extractImage } from "../utils/image";

// Search-engine crawlers (esp. Baiduspider) barely run JS, so the SPA shell
// looks empty to them. For these UAs we return a real HTML document with the
// article content so the site can actually be indexed. Humans never carry
// these UAs, and the content matches the live page, so this is not cloaking.
const CRAWLER_UA =
  /(baiduspider|bingbot|googlebot|google-inspectiontool|yandex|sogou|360spider|haosouspider|yisouspider|bytespider|sosospider|petalbot|duckduckbot|slurp|applebot|semrushbot|ahrefsbot|bingpreview)/i;

const RESERVED_SEGMENTS = new Set([
  "timeline", "moments", "friends", "hashtags", "search", "login",
  "callback", "profile", "admin", "writing", "user", "api",
]);

export function isCrawler(request: Request) {
  return CRAWLER_UA.test(request.headers.get("user-agent") || "");
}

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let unifiedFn: any;
let remarkParse: any;
let remarkGfm: any;
let remarkRehype: any;
let rehypeStringify: any;

async function markdownToHtml(markdown: string): Promise<string> {
  if (!markdown) return "";
  try {
    if (!unifiedFn) {
      const [u, rp, rg, rr, rs] = await Promise.all([
        import("unified"),
        import("remark-parse"),
        import("remark-gfm"),
        import("remark-rehype"),
        import("rehype-stringify"),
      ]);
      unifiedFn = u.unified;
      remarkParse = rp.default;
      remarkGfm = rg.default;
      remarkRehype = rr.default;
      rehypeStringify = rs.default;
    }
    const file = await unifiedFn()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeStringify)
      .process(markdown);
    return String(file);
  } catch {
    return `<p>${esc(markdown.slice(0, 4000))}</p>`;
  }
}

function renderDocument(opts: {
  title: string;
  description: string;
  canonical: string;
  origin: string;
  keywords?: string[];
  image?: string;
  bodyHtml: string;
  type?: string;
}) {
  const keywords = opts.keywords?.length
    ? `<meta name="keywords" content="${esc(opts.keywords.join(","))}">`
    : "";
  const image = opts.image ? `<meta property="og:image" content="${esc(opts.image)}">` : "";
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(opts.title)}</title><meta name="description" content="${esc(opts.description)}"><meta name="robots" content="index,follow">${keywords}<link rel="canonical" href="${esc(opts.canonical)}"><meta property="og:type" content="${opts.type || "article"}"><meta property="og:title" content="${esc(opts.title)}"><meta property="og:description" content="${esc(opts.description)}"><meta property="og:url" content="${esc(opts.canonical)}">${image}</head><body>${opts.bodyHtml}</body></html>`;
}

function summarize(text: string, max = 200) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")   // markdown images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")  // links -> their text
    .replace(/<[^>]+>/g, " ")                  // html tags
    .replace(/https?:\/\/\S+/g, " ")           // bare urls
    .replace(/[#>*`~_\-|]/g, " ")              // remaining markdown punctuation
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export async function prerenderForCrawler(request: Request, env: Env): Promise<Response | null> {
  if (request.method !== "GET" || !env.DB) {
    return null;
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const path = (url.pathname.replace(/\/+$/, "") || "/");
  const db = drizzle(env.DB, { schema });
  // NAME / DESCRIPTION are runtime Worker vars not present in the generated Env type.
  const vars = env as unknown as Record<string, string | undefined>;

  // Resolve which feed (article) this path points at, if any.
  let feedKey: string | null = null;
  let fromFeedPath = false;
  const feedPath = path.match(/^\/feed\/(.+)$/);
  if (feedPath) {
    feedKey = decodeURIComponent(feedPath[1]);
    fromFeedPath = true;
  } else if (path !== "/") {
    const segment = path.slice(1);
    if (!segment.includes("/") && !RESERVED_SEGMENTS.has(segment)) {
      feedKey = decodeURIComponent(segment);
    }
  }

  if (feedKey) {
    const numericId = /^\d+$/.test(feedKey) ? parseInt(feedKey, 10) : null;
    const feed = await db.query.feeds.findFirst({
      where: numericId != null ? eq(feeds.id, numericId) : eq(feeds.alias, feedKey),
      with: {
        user: { columns: { username: true } },
        hashtags: { columns: {}, with: { hashtag: { columns: { name: true } } } },
      },
    });

    if (!feed || feed.draft) {
      return null; // unknown / draft -> let the SPA handle it
    }

    const title = feed.title || "Untitled";
    const description = summarize(feed.summary || feed.content || "");
    const tags = (feed.hashtags ?? []).map((h: any) => h.hashtag.name).filter(Boolean);
    const contentHtml = await markdownToHtml(feed.content || "");
    const canonical = `${origin}${fromFeedPath ? `/feed/${feed.id}` : path}`;
    const siteName = String(vars.NAME || "Rin");

    const body =
      `<article>` +
      `<h1>${esc(title)}</h1>` +
      (feed.user?.username ? `<p>${esc(feed.user.username)}</p>` : "") +
      `<div>${contentHtml}</div>` +
      (tags.length ? `<p>${tags.map((t: string) => esc(`#${t}`)).join(" ")}</p>` : "") +
      `</article>` +
      `<nav><a href="${esc(origin)}/">${esc(siteName)}</a></nav>`;

    return new Response(
      renderDocument({
        title: `${title} - ${siteName}`,
        description,
        canonical,
        origin,
        keywords: tags,
        image: extractImage(feed.content || "") || undefined,
        bodyHtml: body,
      }),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600" } },
    );
  }

  if (path === "/") {
    const siteName = String(vars.NAME || "Rin");
    const siteDesc = String(vars.DESCRIPTION || "");
    const list = await db.query.feeds.findMany({
      where: and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
      orderBy: [desc(feeds.createdAt)],
      limit: 30,
      columns: { id: true, alias: true, title: true, summary: true },
    });

    const items = list
      .map((f) => {
        const href = `${origin}${f.alias ? `/${f.alias}` : `/feed/${f.id}`}`;
        const sm = summarize(f.summary || "", 120);
        return `<li><a href="${esc(href)}">${esc(f.title || "Untitled")}</a>${sm ? `<p>${esc(sm)}</p>` : ""}</li>`;
      })
      .join("");

    const body = `<h1>${esc(siteName)}</h1>${siteDesc ? `<p>${esc(siteDesc)}</p>` : ""}<ul>${items}</ul>`;

    return new Response(
      renderDocument({
        title: siteDesc ? `${siteName} - ${siteDesc}` : siteName,
        description: siteDesc || siteName,
        canonical: `${origin}/`,
        origin,
        bodyHtml: body,
        type: "website",
      }),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600" } },
    );
  }

  return null;
}
