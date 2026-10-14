import { PERSON_PUBLICATIONS, type PersonPublication, type PersonContactMethod } from "../../src/content/personPublications";
import { publicPortraitBytes } from "./personPortrait";

const ORIGIN = "https://zukan.earth";
const PREFIX = "/ja/people/";
const ORGANIZATIONS = "/ja/organizations/";
const ID = /^[a-f0-9]{32}$/u;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const METHODS: Record<PersonContactMethod, string> = {
  online: "オンライン", in_person: "直接会う", phone: "電話", email: "メール", sns: "SNS", discuss: "方法は相談して決める",
};

// Product-local composition over the existing shared design foundation. No new UI framework.
const STYLE = `
.person-page{--person-accent:var(--zukan-action-primary,#143f2e);--person-tint:#f2f5ef;max-width:1080px;margin:auto;padding:0 clamp(20px,5vw,64px);color:var(--zukan-text-primary,#17211b);font:16px/1.85 var(--zukan-font-sans,system-ui,-apple-system,"Noto Sans JP",sans-serif);overflow-wrap:anywhere}
.person-page[data-appearance=ink]{--person-accent:#29313e;--person-tint:#f3f4f5}.person-page[data-appearance=blue]{--person-accent:#154c70;--person-tint:#f0f5f8}
.person-page *{box-sizing:border-box}.person-page a{color:inherit;text-underline-offset:.25em}.person-page :is(h1,h2,h3,p,figure){margin:0}.person-page :is(h1,h2,h3){text-wrap:balance}.person-page button{font:inherit;cursor:pointer}
.person-nav{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:88px;border-bottom:1px solid var(--zukan-border-decorative,#dde2dc)}
.person-brand{display:inline-flex;align-items:center;min-height:44px;font-weight:750;letter-spacing:.13em;text-decoration:none}.person-nav-label{font-size:14px;color:var(--zukan-text-secondary,#55615a)}
.person-hero{display:grid;grid-template-columns:minmax(0,1fr);gap:40px;padding:clamp(40px,7vw,72px) 0 48px;align-items:center}.person-hero.has-portrait{grid-template-columns:minmax(0,1fr) minmax(180px,.58fr)}
.person-eyebrow{font-size:14px;letter-spacing:.09em;color:var(--person-accent);font-weight:650}.person-headline{margin-top:16px!important;font-size:16px;font-weight:500;color:var(--zukan-text-secondary,#55615a)}
.person-page h1{font-size:clamp(36px,5.2vw,60px);line-height:1.25;letter-spacing:.025em;font-weight:600;margin:12px 0!important}.person-latin{font-size:14px;letter-spacing:.12em;color:var(--zukan-text-secondary,#55615a)}
.person-summary{margin-top:28px!important;max-width:36em;font-size:clamp(18px,2.1vw,21px);line-height:1.85;white-space:pre-line}
.person-portrait{width:100%;max-width:320px;justify-self:end;aspect-ratio:4/5;overflow:hidden;border-radius:8px;background:var(--person-tint)}.person-portrait img{display:block;width:100%;height:100%;object-fit:cover}
.person-inline-nav{display:flex;flex-wrap:wrap;gap:4px 24px;margin-top:26px}.person-inline-nav a{display:inline-flex;align-items:center;min-height:44px;font-size:14px;text-decoration:none;border-bottom:1px solid var(--zukan-border-decorative,#dde2dc)}.person-inline-nav a:hover{border-color:var(--person-accent)}
.person-section{display:grid;grid-template-columns:180px minmax(0,1fr);gap:32px;padding:40px 0;border-top:1px solid var(--zukan-border-decorative,#dde2dc)}.person-page h2{font-size:18px;line-height:1.6;font-weight:650}.person-page h3{font-size:17px;line-height:1.65;font-weight:650}
.person-about{display:grid;gap:16px}.person-about p{white-space:pre-line;max-width:44em}.person-activities{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:30px}.person-activity p{margin-top:10px;color:var(--zukan-text-secondary,#55615a);white-space:pre-line}
.person-collaboration{background:var(--person-tint);padding:32px;border-radius:8px;margin-bottom:40px;display:grid;grid-template-columns:180px minmax(0,1fr);gap:32px}.person-collaboration h2{color:var(--person-accent)}.person-collaboration-body{display:grid;gap:20px}.person-interests{line-height:1.9}.person-contact-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;margin:0}.person-contact-details dt{font-size:14px;color:var(--zukan-text-secondary,#55615a);margin-bottom:5px}.person-contact-details dd{margin:0;white-space:pre-line}.person-note{font-size:14px;color:var(--zukan-text-secondary,#55615a);line-height:1.7}.person-methods{display:block}
.person-links{display:grid;gap:0}.person-link{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:60px;padding:10px 0;text-decoration:none;border-bottom:1px solid var(--zukan-border-decorative,#dde2dc)}.person-link:last-child{border-bottom:0}.person-link:hover .person-link-label{text-decoration:underline}.person-link-label{font-weight:550}.person-link-arrow{flex-shrink:0;color:var(--person-accent);font-size:21px;transition:transform .16s ease}.person-link:hover .person-link-arrow{transform:translate(2px,-2px)}
.person-footer{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px 24px;padding:24px 0 32px;border-top:1px solid var(--zukan-border-decorative,#dde2dc);font-size:14px;color:var(--zukan-text-secondary,#55615a)}.person-footer-info{display:flex;flex-wrap:wrap;gap:4px 24px}
.person-page :is(a,button):focus-visible{outline:2px solid var(--zukan-focus-outline,#000);outline-offset:4px;box-shadow:0 0 0 4px var(--zukan-focus-yellow-300,#ffd43d);border-radius:4px}.person-skip{position:absolute;left:16px;top:-100px;background:white;padding:12px;z-index:10}.person-skip:focus{top:8px}.person-page :target{scroll-margin-top:24px}
@media(max-width:760px){.person-section,.person-collaboration{grid-template-columns:1fr;gap:20px}.person-collaboration{padding:26px}.person-hero.has-portrait{gap:24px;grid-template-columns:minmax(0,1fr) 180px}.person-summary{grid-column:1/-1}}
@media(max-width:540px){.person-nav{min-height:72px}.person-hero,.person-hero.has-portrait{grid-template-columns:1fr;gap:28px;padding:32px 0}.person-portrait{order:-1;justify-self:start;max-width:112px;aspect-ratio:1;border-radius:50%}.person-summary{margin-top:22px!important}.person-section{padding:28px 0;gap:18px}.person-activities,.person-contact-details{grid-template-columns:1fr;gap:22px}.person-collaboration{padding:22px;margin-bottom:28px}.person-footer{align-items:start}.person-nav-label{font-size:14px}}
@media(prefers-reduced-motion:reduce){.person-page *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}@media(forced-colors:active){.person-collaboration{border:1px solid CanvasText}.person-page a:focus-visible{outline:2px solid Highlight;box-shadow:none}}
@media print{.person-nav,.person-inline-nav,.person-skip{display:none}.person-page{max-width:none;padding:0}.person-section{break-inside:avoid}.person-hero{padding-top:0}.person-collaboration{background:none;border:1px solid #888}}
`;

type PersonLocator = Pick<PersonPublication, "slug" | "publicId" | "identityMode" | "subjectKind">;
export function personPublicationPath(p: PersonLocator): string {
  return `${p.subjectKind === "organization" ? ORGANIZATIONS : PREFIX}${p.identityMode === "alias" || p.identityMode === "anonymous" ? "person" : p.slug}-${p.publicId}`;
}
const escapeHtml = (value: string): string => value.replace(/[&<>"']/gu, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const publicName = (p: PersonPublication): string => p.identityMode === "anonymous" ? "匿名" : p.name;
const showLatinName = (p: PersonPublication): boolean => (p.identityMode ?? "real_name") === "real_name";
const safeLink = (href: string): boolean => {
  try { const u = new URL(href); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; }
};
const allowedPortrait = (p: PersonPublication): boolean => p.identityMode !== "anonymous" && !!p.portrait && publicPortraitBytes(p.portrait.dataUrl) !== null;

function collaborationSection(p: PersonPublication): string {
  const c = p.collaboration;
  if (!c || !c.accepting) return "";
  const e = escapeHtml;
  const methods = c.firstContact.filter(method => Object.hasOwn(METHODS, method)).map(method => METHODS[method]);
  const rows: string[] = [];
  if (methods.length) rows.push(`<div><dt>まずは、こんな形で</dt><dd class="person-methods">${e(methods.join("・"))}</dd></div>`);
  if (c.availabilityNote) rows.push(`<div><dt>話しやすい時間の目安</dt><dd>${e(c.availabilityNote)}</dd></div>`);
  if (c.locationNote) rows.push(`<div><dt>直接会う場合</dt><dd>${e(c.locationNote)}</dd></div>`);
  return `<section class="person-collaboration" aria-labelledby="person-collaboration" id="collaboration"><h2 id="person-collaboration">一緒にできること</h2><div class="person-collaboration-body">${c.interests.length ? `<p class="person-interests">${e(c.interests.join(" / "))}</p>` : ""}${rows.length ? `<dl class="person-contact-details">${rows.join("")}</dl>` : ""}${c.availabilityNote ? `<p class="person-note">時間帯は目安です。日程・方法は相談して決めます。<br>タイムゾーン：${e(c.timeZone)}</p>` : ""}${c.salesAccepted ? "" : `<p class="person-note">一般的な営業・売り込みは受け付けていません。</p>`}</div></section>`;
}

/** Render only the holder's public edition; unavailable actions are never decorative buttons. */
export function renderPersonPublication(p: PersonPublication, indexable: boolean): string {
  const e = escapeHtml, name = publicName(p), portrait = allowedPortrait(p);
  const url = ORIGIN + personPublicationPath(p);
  const links = (p.identityMode === "anonymous" ? [] : p.links).filter(link => safeLink(link.href));
  const appearance = ["earth", "ink", "blue"].includes(p.appearance ?? "") ? p.appearance! : "earth";
  const about = p.paragraphs.filter(value => value.trim());
  const activities = p.activities.filter(value => value.title.trim() || value.text.trim());
  const nav = [activities.length ? '<a href="#activities">取り組んでいること</a>' : "", p.collaboration?.accepting ? '<a href="#collaboration">一緒にできること</a>' : "", links.length ? '<a href="#links">関連リンク</a>' : ""].join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="${indexable ? "index,follow" : "noindex,nofollow"}"><title>${e(name)} | ZUKAN</title><meta name="description" content="${e(p.summary)}"><link rel="canonical" href="${url}"><meta property="og:type" content="${p.subjectKind === "organization" ? "website" : "profile"}"><meta property="og:title" content="${e(name)} | ZUKAN"><meta property="og:description" content="${e(p.summary)}"><meta property="og:url" content="${url}">${portrait ? `<meta property="og:image" content="${url}/portrait.webp">` : ""}<style>${STYLE}</style></head><body><a class="person-skip" href="#person-main">本文へ</a><div class="person-page" data-appearance="${appearance}"><nav class="person-nav" aria-label="ZUKAN"><a class="person-brand" href="/ja">ZUKAN</a><span class="person-nav-label">人と活動</span></nav><main id="person-main"><header class="person-hero${portrait ? " has-portrait" : ""}"><div class="person-intro"><p class="person-eyebrow">${p.subjectKind === "organization" ? "団体の紹介" : "自己紹介"}</p><h1>${e(name)}</h1>${showLatinName(p) && p.latinName ? `<p class="person-latin" lang="en">${e(p.latinName)}</p>` : ""}${p.headline ? `<p class="person-headline">${e(p.headline)}</p>` : ""}<p class="person-summary">${e(p.summary)}</p>${nav ? `<nav class="person-inline-nav" aria-label="このページの内容">${nav}</nav>` : ""}</div>${portrait ? `<figure class="person-portrait"><img src="${e(p.portrait!.dataUrl)}" alt="${e(p.portrait!.alt)}" width="640" height="800" decoding="async" fetchpriority="high"></figure>` : ""}</header>${about.length ? `<section class="person-section" aria-labelledby="person-about"><h2 id="person-about">プロフィール</h2><div class="person-about">${about.map(value => `<p>${e(value)}</p>`).join("")}</div></section>` : ""}${activities.length ? `<section class="person-section" aria-labelledby="person-activities" id="activities"><h2 id="person-activities">取り組んでいること</h2><div class="person-activities">${activities.map(item => `<article class="person-activity"><h3>${e(item.title)}</h3><p>${e(item.text)}</p></article>`).join("")}</div></section>` : ""}${collaborationSection(p)}${links.length ? `<section class="person-section" aria-labelledby="person-links" id="links"><h2 id="person-links">関連リンク</h2><div class="person-links">${links.map(link => `<a class="person-link" href="${e(link.href)}" rel="noopener"><span class="person-link-label">${e(link.label)}</span><span class="person-link-arrow" aria-hidden="true">↗</span></a>`).join("")}</div></section>` : ""}</main><footer class="person-footer"><div class="person-footer-info"><span>${p.subjectKind === "organization" ? "団体の意思により公開" : "本人の意思により公開"}</span><span>更新日 <time datetime="${e(p.updatedOn)}">${e(p.updatedOn.replaceAll("-", "."))}</time></span></div></footer></div></body></html>`;
}

/** Existing contributor and organization routes keep their original handler. */
export function personPublicationResponse(request: Request, env: { ENVIRONMENT?: string; IKIMON_GIT_SHA?: string }, publications: readonly PersonPublication[] = PERSON_PUBLICATIONS): Response | null {
  const url = new URL(request.url);
  const prefix = url.pathname.startsWith(PREFIX) ? PREFIX : url.pathname.startsWith(ORGANIZATIONS) ? ORGANIZATIONS : null;
  if (prefix === null) return null;
  const notFound = () => new Response(request.method === "HEAD" ? null : "Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
  const isPortrait = url.pathname.endsWith("/portrait.webp");
  const pagePath = isPortrait ? url.pathname.slice(0, -14) : url.pathname;
  const segment = pagePath.slice(prefix.length).replace(/\/$/u, "");
  const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)-([a-f0-9]{32})$/u.exec(segment);
  if (!match) return prefix === ORGANIZATIONS ? null : notFound();
  const p = publications.find(item => item.publicId === match[2] && item.state === "published" && item.authority === "subject_explicit" && item.locale === "ja" && ID.test(item.publicId) && SLUG.test(item.slug)
    && (prefix === ORGANIZATIONS) === (item.subjectKind === "organization"));
  if (!p) return notFound();
  if (!["GET", "HEAD"].includes(request.method)) return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
  const path = personPublicationPath(p);
  if (pagePath !== path) {
    if (p.identityMode === "anonymous" || p.identityMode === "alias" || isPortrait) return notFound();
    return new Response(null, { status: 308, headers: { location: path, "cache-control": "no-store" } });
  }
  if (isPortrait) {
    if (!allowedPortrait(p)) return notFound();
    const bytes = publicPortraitBytes(p.portrait!.dataUrl)!;
    return new Response(request.method === "HEAD" ? null : bytes, { headers: { "content-type": "image/webp", "cache-control": "no-store", "x-content-type-options": "nosniff", "x-robots-tag": "noindex, nofollow" } });
  }
  const indexable = env.ENVIRONMENT === "production" && url.origin === ORIGIN && p.discoverability === "indexed";
  return new Response(request.method === "HEAD" ? null : renderPersonPublication(p, indexable), {
    headers: {
      "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-language": "ja",
      "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "x-frame-options": "DENY",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
      "content-security-policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "x-robots-tag": indexable ? "index, follow" : "noindex, nofollow",
      "x-zukan-publication-id": p.publicId, "x-zukan-publication-edition": p.edition,
      ...(env.IKIMON_GIT_SHA && /^[a-f0-9]{40}$/u.test(env.IKIMON_GIT_SHA) ? { "x-ikimon-deploy-sha": env.IKIMON_GIT_SHA } : {}),
    },
  });
}
