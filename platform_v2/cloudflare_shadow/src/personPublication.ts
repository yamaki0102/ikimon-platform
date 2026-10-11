import { PERSON_PUBLICATIONS, type PersonPublication } from "../../src/content/personPublications";

const ORIGIN = "https://zukan.earth";
const PREFIX = "/ja/people/";
const ID = /^[a-f0-9]{32}$/u;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const STYLE = `
.person-page{max-width:960px;margin:auto;padding:24px clamp(20px,5vw,64px) 40px;color:#20312a;font:16px/1.9 system-ui,-apple-system,"Noto Sans JP",sans-serif;overflow-wrap:anywhere}
.person-page *{box-sizing:border-box}.person-nav{display:flex;justify-content:space-between;align-items:center;gap:20px;padding-bottom:20px;border-bottom:1px solid #d9e0d9}
.person-page a{color:inherit;text-underline-offset:5px}.person-nav a,.person-links a{display:inline-flex;align-items:center;min-height:44px}.person-brand{font-weight:700;letter-spacing:.12em;text-decoration:none}
.person-hero{padding:56px 0 38px}.person-label{font-size:14px;color:#5b6961}.person-page h1{font-size:clamp(36px,7vw,56px);font-weight:600;letter-spacing:.08em;line-height:1.35;margin:16px 0 8px}
.person-latin{font-size:16px;letter-spacing:.06em;margin:0;color:#5b6961}.person-headline{font-size:18px;font-weight:500;margin:24px 0 12px}.person-summary{max-width:660px;font-size:clamp(18px,3vw,21px);line-height:1.85;margin:0}
.person-section{padding:30px 0;border-top:1px solid #d9e0d9}.person-page h2{font-size:20px;line-height:1.6;font-weight:600;margin:0 0 20px}.person-page p{max-width:700px}.person-about p{margin:0 0 16px}.person-about p:last-child{margin-bottom:0}
.person-activities{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px}.person-page h3{font-size:17px;line-height:1.6;font-weight:600;margin:0 0 12px}.person-activities p{margin:0;color:#4c5e53}
.person-links{display:flex;flex-wrap:wrap;gap:8px 28px}.person-footer{display:flex;flex-wrap:wrap;gap:6px 24px;padding-top:22px;border-top:1px solid #d9e0d9;font-size:14px;color:#5b6961}
.person-page a:focus-visible{outline:3px solid #285b42;outline-offset:5px;border-radius:2px}.person-skip{position:absolute;left:16px;top:-100px;background:white;padding:12px;z-index:10}.person-skip:focus{top:8px}
@media(max-width:600px){.person-hero{padding:36px 0 30px}.person-activities{grid-template-columns:1fr;gap:24px}.person-section{padding:26px 0}.person-nav{font-size:14px}}@media(prefers-reduced-motion:reduce){.person-page *{scroll-behavior:auto!important}}
`;

export function personPublicationPath(p: Pick<PersonPublication, "slug" | "publicId">): string {
  return `${PREFIX}${p.identityMode === "alias" || p.identityMode === "anonymous" ? "person" : p.slug}-${p.publicId}`;
}

const escapeHtml = (value: string): string => value.replace(/[&<>"']/gu, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const publicName = (p: PersonPublication): string => p.identityMode === "anonymous" ? "匿名" : p.name;
const showLatinName = (p: PersonPublication): boolean => (p.identityMode ?? "real_name") === "real_name";
const safeLink = (href: string): boolean => {
  try { const u = new URL(href); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; }
};

/** Render only the public edition's allowlisted fields. No account/source lookup. */
export function renderPersonPublication(p: PersonPublication, indexable: boolean): string {
  const e = escapeHtml;
  const name = publicName(p);
  const links = (p.identityMode === "anonymous" ? [] : p.links).filter(link => safeLink(link.href)).map(link => `<a href="${e(link.href)}">${e(link.label)}<span aria-hidden="true">&nbsp;↗</span></a>`).join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="${indexable ? "index,follow" : "noindex,nofollow"}"><title>${e(name)} | ZUKAN</title><meta name="description" content="${e(p.summary)}"><link rel="canonical" href="${ORIGIN}${personPublicationPath(p)}"><meta property="og:type" content="profile"><meta property="og:title" content="${e(name)} | ZUKAN"><meta property="og:description" content="${e(p.summary)}"><meta property="og:url" content="${ORIGIN}${personPublicationPath(p)}"><style>${STYLE}</style></head><body><a class="person-skip" href="#person-main">本文へ</a><div class="person-page"><nav class="person-nav" aria-label="ZUKAN"><a class="person-brand" href="/ja">ZUKAN</a><span class="person-label">人と活動</span></nav><main id="person-main"><header class="person-hero"><span class="person-label">自己紹介</span><h1>${e(name)}</h1>${showLatinName(p) ? `<p class="person-latin" lang="en">${e(p.latinName)}</p>` : ""}<p class="person-headline">${e(p.headline)}</p><p class="person-summary">${e(p.summary)}</p></header><section class="person-section person-about" aria-labelledby="person-about"><h2 id="person-about">プロフィール</h2>${p.paragraphs.map(text => `<p>${e(text)}</p>`).join("")}</section><section class="person-section" aria-labelledby="person-activities"><h2 id="person-activities">取り組んでいること</h2><div class="person-activities">${p.activities.map(item => `<div><h3>${e(item.title)}</h3><p>${e(item.text)}</p></div>`).join("")}</div></section><section class="person-section" aria-labelledby="person-links"><h2 id="person-links">関連リンク</h2><div class="person-links">${links}</div></section></main><footer class="person-footer"><span>本人の意思により公開</span><span>更新日 <time datetime="${e(p.updatedOn)}">${e(p.updatedOn.replaceAll("-", "."))}</time></span></footer></div></body></html>`;
}

/** Bounded public route; existing contributor profiles and all other routes delegate unchanged. */
export function personPublicationResponse(request: Request, env: { ENVIRONMENT?: string; IKIMON_GIT_SHA?: string }, publications: readonly PersonPublication[] = PERSON_PUBLICATIONS): Response | null {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(PREFIX)) return null;
  const notFound = () => new Response(request.method === "HEAD" ? null : "Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
  const segment = url.pathname.slice(PREFIX.length).replace(/\/$/u, "");
  const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)-([a-f0-9]{32})$/u.exec(segment);
  if (!match) return notFound();
  const p = publications.find(item => item.publicId === match[2] && item.state === "published" && item.authority === "subject_explicit" && item.locale === "ja" && ID.test(item.publicId) && SLUG.test(item.slug));
  if (!p) return notFound();
  if (!["GET", "HEAD"].includes(request.method)) return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
  const path = personPublicationPath(p);
  if (url.pathname !== path) {
    if (p.identityMode === "anonymous" || p.identityMode === "alias") return notFound(); // Never redirect a name-bearing old URL after anonymity is selected.
    return new Response(null, { status: 308, headers: { location: path, "cache-control": "no-store" } });
  }
  const indexable = env.ENVIRONMENT === "production" && url.origin === ORIGIN && p.discoverability === "indexed";
  return new Response(request.method === "HEAD" ? null : renderPersonPublication(p, indexable), {
    headers: {
      "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-language": "ja",
      "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "x-frame-options": "DENY",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "x-robots-tag": indexable ? "index, follow" : "noindex, nofollow",
      "x-zukan-publication-id": p.publicId, "x-zukan-publication-edition": p.edition,
      ...(env.IKIMON_GIT_SHA && /^[a-f0-9]{40}$/u.test(env.IKIMON_GIT_SHA) ? { "x-ikimon-deploy-sha": env.IKIMON_GIT_SHA } : {}),
    },
  });
}
