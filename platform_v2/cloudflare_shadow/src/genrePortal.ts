export type PublicParticipationKind = "event" | "site" | "record";

export interface PublicParticipation {
  id: string;
  kind: PublicParticipationKind;
  genre: string;
  region?: string | null;
  name: string;
  description?: string | null;
  url?: string | null;
  startDate?: string | null;
  location?: string | null;
  publisher?: string | null;
}

export interface PublicParticipationSource {
  listPublic(filter: { genre?: string; region?: string }): Promise<PublicParticipation[]>;
}

export interface GenrePortalEnv {
  GENRE_PORTALS_ENABLED?: string;
}

const SLUG = /^[a-z0-9-]+$/;
const CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=600";
const ORIGIN = "https://zukan.earth";

const escapeHtml = (value: unknown): string => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const safeJson = (value: unknown): string => JSON.stringify(value).replaceAll("<", "\\u003c");
const genreLabel = (slug: string): string => slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

function response(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": CACHE_CONTROL } });
}

function page(input: { title: string; description: string; canonical: string; heading: string; breadcrumbs: Array<{ label: string; href?: string }>; body: string; structuredData: unknown[] }): string {
  const breadcrumbs = input.breadcrumbs.map((crumb) => `<li>${crumb.href ? `<a href="${escapeHtml(crumb.href)}">${escapeHtml(crumb.label)}</a>` : escapeHtml(crumb.label)}</li>`).join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)}</title><meta name="description" content="${escapeHtml(input.description)}"><link rel="canonical" href="${escapeHtml(input.canonical)}"><meta property="og:type" content="website"><meta property="og:site_name" content="ZUKAN"><meta property="og:title" content="${escapeHtml(input.title)}"><meta property="og:description" content="${escapeHtml(input.description)}"><meta property="og:url" content="${escapeHtml(input.canonical)}"><script type="application/ld+json">${safeJson(input.structuredData)}</script><style>
*{box-sizing:border-box}body{margin:0;color:#17352b;background:#f7faf7;font-family:"Noto Sans JP",system-ui,sans-serif;font-size:16px;line-height:1.75}a{color:#17664c;text-underline-offset:.2em}header,main,footer{width:min(100%,72rem);margin:auto;padding:16px}.brand{font-size:1.25rem;font-weight:700;text-decoration:none}.breadcrumbs{display:flex;flex-wrap:wrap;gap:8px;list-style:none;padding:16px 0 0;margin:0}.breadcrumbs li+li:before{content:"/";margin-right:8px;color:#728078}h1{font-size:clamp(1.875rem,7vw,3rem);line-height:1.35;margin:24px 0 8px}h2{font-size:1.375rem;line-height:1.45}.lead{max-width:44rem;margin:0 0 32px;color:#465a52}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr));gap:16px;padding:0;list-style:none}.card{height:100%;padding:24px;background:#fff;border:1px solid #dbe5df;border-radius:8px}.card h2{margin:0 0 8px}.meta{margin:8px 0;color:#53675f}.kind{font-weight:700;color:#17664c}.empty{padding:32px 24px;background:#fff;border:1px solid #dbe5df;border-radius:8px}footer{margin-top:40px;border-top:1px solid #dbe5df}@media(min-width:48rem){header,main,footer{padding-left:28px;padding-right:28px}}@media(min-width:72rem){header,main,footer{padding-left:40px;padding-right:40px}}
</style></head><body><header><a class="brand" href="/">ZUKAN</a></header><main><nav aria-label="パンくず"><ol class="breadcrumbs">${breadcrumbs}</ol></nav><h1>${escapeHtml(input.heading)}</h1>${input.body}</main><footer><small>地域の記録を、みんなで育てる。</small></footer></body></html>`;
}

function organization() {
  return { "@type": "Organization", name: "ZUKAN", url: ORIGIN };
}

function itemStructuredData(item: PublicParticipation): Record<string, unknown> {
  if (item.kind === "event") {
    return { "@type": "Event", name: item.name, ...(item.startDate ? { startDate: item.startDate } : {}), ...(item.location ? { location: { "@type": "Place", name: item.location } } : {}), organizer: { "@type": "Organization", name: item.publisher || "ZUKAN" }, ...(item.url ? { url: item.url } : {}) };
  }
  return { "@type": "CreativeWork", name: item.name, ...(item.url ? { url: item.url } : {}), publisher: { "@type": "Organization", name: item.publisher || "ZUKAN" } };
}

export async function handleGenrePortalRequest(request: Request, env: GenrePortalEnv, source: PublicParticipationSource): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/portal" && !url.pathname.startsWith("/portal/")) return null;
  if (env.GENRE_PORTALS_ENABLED !== "true" || (request.method !== "GET" && request.method !== "HEAD")) return response("Not Found", 404);
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] !== "portal" || segments.length > 3 || segments.slice(1).some((value) => !SLUG.test(value))) return response("Not Found", 404);

  const genre = segments[1];
  const region = segments[2];
  const items = await source.listPublic({ ...(genre ? { genre } : {}), ...(region ? { region } : {}) });
  let html: string;
  if (!genre) {
    const genres = [...new Set(items.map((item) => item.genre).filter((value) => SLUG.test(value)))].sort();
    const body = `<p class="lead">自然、文化、歴史、暮らしなど、関心のあるテーマから公開情報を探せます。</p>${genres.length ? `<ul class="grid">${genres.map((slug) => `<li><a class="card" href="/portal/${escapeHtml(slug)}"><h2>${escapeHtml(genreLabel(slug))}</h2><span>公開情報を見る</span></a></li>`).join("")}</ul>` : `<div class="empty"><p>公開中のジャンルは現在準備中です。</p></div>`}`;
    html = page({ title: "ジャンルポータル | ZUKAN", description: "ZUKANの公開情報をジャンルから探せます。", canonical: `${ORIGIN}/portal`, heading: "ジャンルから探す", breadcrumbs: [{ label: "ホーム", href: "/" }, { label: "ジャンルポータル" }], body, structuredData: [{ "@context": "https://schema.org", "@graph": [organization(), { "@type": "ItemList", itemListElement: genres.map((slug, index) => ({ "@type": "ListItem", position: index + 1, name: genreLabel(slug), url: `${ORIGIN}/portal/${slug}` })) }] }] });
  } else {
    const label = genreLabel(genre);
    const heading = region ? `${label}・${genreLabel(region)}の公開情報` : `${label}の公開情報`;
    const cards = items.map((item) => `<li><article class="card"><span class="kind">${item.kind === "event" ? "イベント" : item.kind === "site" ? "場所" : "記録"}</span><h2>${item.url ? `<a href="${escapeHtml(item.url)}">${escapeHtml(item.name)}</a>` : escapeHtml(item.name)}</h2>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}${item.startDate ? `<p class="meta">日時：<time datetime="${escapeHtml(item.startDate)}">${escapeHtml(item.startDate)}</time></p>` : ""}${item.location ? `<p class="meta">場所：${escapeHtml(item.location)}</p>` : ""}</article></li>`).join("");
    const body = `<p class="lead">公開されたイベント、場所、記録をまとめて紹介します。</p>${cards ? `<ul class="grid">${cards}</ul>` : `<div class="empty"><h2>まだ公開情報はありません</h2><p>このテーマの公開情報は現在準備中です。ほかのジャンルもご覧ください。</p><a href="/portal">ジャンル一覧へ戻る</a></div>`}`;
    const canonicalPath = `/portal/${genre}${region ? `/${region}` : ""}`;
    html = page({ title: `${heading} | ZUKAN`, description: `${heading}をZUKANで探せます。`, canonical: ORIGIN + canonicalPath, heading, breadcrumbs: [{ label: "ホーム", href: "/" }, { label: "ジャンル", href: "/portal" }, { label, ...(region ? { href: `/portal/${genre}` } : {}) }, ...(region ? [{ label: genreLabel(region) }] : [])], body, structuredData: [{ "@context": "https://schema.org", "@graph": [organization(), ...items.filter((item) => item.kind === "event").map(itemStructuredData), { "@type": "ItemList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, item: itemStructuredData(item) })) }] }] });
  }
  const rendered = response(html);
  return request.method === "HEAD" ? new Response(null, { status: rendered.status, headers: rendered.headers }) : rendered;
}
