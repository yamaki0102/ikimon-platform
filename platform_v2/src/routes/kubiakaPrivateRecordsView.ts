import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import {
  classifyKubiakaAiStatus,
  kubiakaPrivateRecordsCopy,
} from "../services/kubiakaPrivateRecordsCopy.js";
import type {
  KubiakaPrivateAcknowledgement,
  KubiakaPrivateRecordDetail,
  KubiakaPrivateRecordOverview,
  KubiakaPrivateRecordPage,
  KubiakaPrivateRecordSummary,
} from "../services/kubiakaPrivateRecordsReadModel.js";

export const KUBIAKA_PRIVATE_RECORDS_PATH = "/kubiaka/me/records";
export const KUBIAKA_PRIVATE_RECORD_DETAIL_PREFIX = "/kubiaka/records";
export const KUBIAKA_PRIVATE_RECORD_MEDIA_PREFIX = "/api/v1/kubiaka/records";

const KUBIAKA_PRIVATE_DOCUMENT_STYLES = `
:root{color-scheme:light;--kpr-ink:#17211b;--kpr-green:#143f2e;--kpr-paper:#f5f8f5}
*{box-sizing:border-box}
html{background:var(--kpr-paper);font-family:Inter,"Noto Sans JP","Hiragino Sans",system-ui,sans-serif;color:var(--kpr-ink)}
body{min-height:100vh;margin:0;background:linear-gradient(180deg,#fbfdfb,var(--kpr-paper))}
a{color:inherit}
.kpr-skip{position:fixed;z-index:10;left:12px;top:12px;transform:translateY(-160%);padding:10px 14px;border-radius:12px;background:#fff;color:var(--kpr-green);font-weight:900}
.kpr-skip:focus{transform:none}
.kpr-site-header{border-bottom:1px solid rgba(20,63,46,.12);background:rgba(255,255,255,.96)}
.kpr-site-header-inner{width:min(1040px,calc(100% - 32px));min-height:64px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:18px}
.kpr-brand{font-size:20px;font-weight:950;letter-spacing:.04em;text-decoration:none;color:var(--kpr-green)}
.kpr-language{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.kpr-language a{min-width:38px;min-height:38px;padding:8px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-size:12px;font-weight:900;color:#5f6964}
.kpr-language a[aria-current="page"]{background:var(--kpr-green);color:#fff}
.kpr-main{width:min(1040px,calc(100% - 32px));margin:0 auto;padding:24px 0 0}
.kpr-site-footer{width:min(1040px,calc(100% - 32px));margin:0 auto;padding:20px 0 36px;color:#68736d;font-size:12px}
@media(max-width:520px){.kpr-site-header-inner{width:min(100% - 24px,1040px)}.kpr-main,.kpr-site-footer{width:min(100% - 24px,1040px)}}
`;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const KUBIAKA_PRIVATE_RECORDS_STYLES = `
.kpr-page{display:grid;gap:20px;max-width:920px;margin:0 auto;padding:12px 0 72px;min-width:0}
.kpr-hero,.kpr-panel,.kpr-record-card{min-width:0;border:1px solid rgba(20,63,46,.13);border-radius:26px;background:#fff;box-shadow:0 18px 48px rgba(20,63,46,.07)}
.kpr-hero,.kpr-panel{padding:clamp(22px,5vw,40px)}
.kpr-hero{background:linear-gradient(145deg,#f4faf5,#fff8f2)}
.kpr-eyebrow{font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#8b3d31}
.kpr-page h1,.kpr-page h2,.kpr-page h3{margin:8px 0 10px;line-height:1.25;color:#17211b;overflow-wrap:anywhere}
.kpr-page h1{font-size:clamp(30px,7vw,48px)}.kpr-page h2{font-size:clamp(22px,5vw,30px)}.kpr-page h3{font-size:20px}
.kpr-page p{margin:0;color:#56615b;line-height:1.8;overflow-wrap:anywhere}
.kpr-count{display:inline-flex;margin-top:18px;padding:9px 14px;border-radius:999px;background:#143f2e;color:#fff;font-weight:900}
.kpr-private{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:900;color:#143f2e}.kpr-private:before{content:"";width:9px;height:9px;border-radius:50%;background:#143f2e}
.kpr-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:22px}
.kpr-primary,.kpr-secondary{min-height:50px;max-width:100%;padding:0 21px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;text-align:center;font-weight:900}
.kpr-primary{background:#8b3d31;color:#fff}.kpr-secondary{border:1px solid rgba(20,63,46,.2);background:#fff;color:#143f2e}
.kpr-primary:focus-visible,.kpr-secondary:focus-visible,.kpr-record-card:focus-visible{outline:3px solid #143f2e;outline-offset:3px}
.kpr-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.kpr-record-card{display:grid;grid-template-columns:138px minmax(0,1fr);overflow:hidden;text-decoration:none;color:inherit}
.kpr-record-card img,.kpr-thumb-placeholder{width:100%;height:100%;min-height:138px;object-fit:cover;background:#eef3ef;display:grid;place-items:center;color:#647169;font-weight:900}
.kpr-card-copy{display:grid;align-content:center;gap:7px;padding:18px}.kpr-card-copy strong{font-size:18px;color:#17211b}.kpr-card-copy span{color:#5e6963;font-size:14px}.kpr-card-copy em{font-style:normal;font-weight:800;color:#143f2e}
.kpr-latest{display:grid;grid-template-columns:minmax(180px,260px) minmax(0,1fr);gap:20px;align-items:stretch}.kpr-latest-media{border-radius:20px;overflow:hidden;background:#eef3ef;min-height:190px}.kpr-latest-media img{width:100%;height:100%;object-fit:cover;display:block}.kpr-latest-copy{display:grid;align-content:center;gap:9px}
.kpr-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}.kpr-meta div{padding:16px;border-radius:18px;background:#f5f7f5}.kpr-meta dt{font-size:12px;font-weight:900;color:#657069}.kpr-meta dd{margin:6px 0 0;font-weight:900;color:#17211b}
.kpr-photo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.kpr-photo-grid figure{margin:0;border-radius:20px;overflow:hidden;background:#eef3ef;min-height:220px}.kpr-photo-grid img{display:block;width:100%;height:100%;max-height:560px;object-fit:contain;background:#eef3ef}
.kpr-notice{padding:15px 17px;border-left:4px solid #8b3d31;border-radius:12px;background:#fff8f2;color:#63544d;line-height:1.7}
@media(max-width:760px){.kpr-grid{grid-template-columns:1fr}.kpr-latest{grid-template-columns:1fr}.kpr-record-card{grid-template-columns:112px minmax(0,1fr)}.kpr-photo-grid{grid-template-columns:1fr}}
@media(max-width:520px){.kpr-hero,.kpr-panel{border-radius:21px}.kpr-actions>*{width:100%}.kpr-meta{grid-template-columns:1fr}.kpr-record-card{grid-template-columns:96px minmax(0,1fr)}}
@media(prefers-reduced-motion:reduce){.kpr-page *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;

function localizedHref(basePath: string, path: string, lang: SiteLang): string {
  return appendLangToHref(withBasePath(basePath, path), lang);
}

function detailHref(basePath: string, lang: SiteLang, visitId: string): string {
  return localizedHref(basePath, `${KUBIAKA_PRIVATE_RECORD_DETAIL_PREFIX}/${encodeURIComponent(visitId)}`, lang);
}

function mediaHref(basePath: string, visitId: string, photoIndex: number): string {
  return withBasePath(
    basePath,
    `${KUBIAKA_PRIVATE_RECORD_MEDIA_PREFIX}/${encodeURIComponent(visitId)}/photos/${photoIndex}`,
  );
}

function formatSavedAt(value: string, lang: SiteLang): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function aiLabel(lang: SiteLang, status: string): string {
  const copy = kubiakaPrivateRecordsCopy(lang);
  return copy.aiStates[classifyKubiakaAiStatus(status)];
}

function recordCard(
  basePath: string,
  lang: SiteLang,
  record: KubiakaPrivateRecordSummary,
): string {
  const copy = kubiakaPrivateRecordsCopy(lang);
  const href = detailHref(basePath, lang, record.visitId);
  const image = `<img src="${escapeHtml(mediaHref(basePath, record.visitId, 1))}" alt="${escapeHtml(copy.photoAlt(1, record.photoCount))}" loading="lazy" decoding="async" />`;
  return `<a class="kpr-record-card" href="${escapeHtml(href)}">
    ${image}
    <span class="kpr-card-copy">
      <span class="kpr-private">${escapeHtml(copy.privateLabel)}</span>
      <strong>${escapeHtml(formatSavedAt(record.savedAt, lang))}</strong>
      <span>${escapeHtml(copy.photoCountLabel(record.photoCount))}</span>
      <em>${escapeHtml(`${copy.aiLabel}: ${aiLabel(lang, record.aiAssessmentStatus)}`)}</em>
    </span>
  </a>`;
}

function latestRecord(
  basePath: string,
  lang: SiteLang,
  record: KubiakaPrivateRecordSummary,
): string {
  const copy = kubiakaPrivateRecordsCopy(lang);
  return `<section class="kpr-panel">
    <div class="kpr-eyebrow">Latest</div>
    <h2>${escapeHtml(copy.latestTitle)}</h2>
    <div class="kpr-latest">
      <div class="kpr-latest-media"><img src="${escapeHtml(mediaHref(basePath, record.visitId, 1))}" alt="${escapeHtml(copy.photoAlt(1, record.photoCount))}" /></div>
      <div class="kpr-latest-copy">
        <span class="kpr-private">${escapeHtml(copy.privateLabel)}</span>
        <p>${escapeHtml(formatSavedAt(record.savedAt, lang))}</p>
        <p>${escapeHtml(copy.photoCountLabel(record.photoCount))}</p>
        <p><strong>${escapeHtml(copy.aiLabel)}:</strong> ${escapeHtml(aiLabel(lang, record.aiAssessmentStatus))}</p>
        <div class="kpr-actions"><a class="kpr-primary" href="${escapeHtml(detailHref(basePath, lang, record.visitId))}">${escapeHtml(copy.detailAction)}</a></div>
      </div>
    </div>
  </section>`;
}

export function renderKubiakaPrivateDocument(input: {
  basePath: string;
  lang: SiteLang;
  currentPath: string;
  title: string;
  description: string;
  body: string;
}): string {
  const { basePath, lang, currentPath, title, description, body } = input;
  const languageLinks = ([
    ["ja", "JA"],
    ["en", "EN"],
    ["es", "ES"],
    ["pt-BR", "PT"],
  ] as const).map(([code, label]) => {
    const href = appendLangToHref(withBasePath(basePath, currentPath), code);
    const current = code === lang ? ' aria-current="page"' : "";
    return `<a href="${escapeHtml(href)}" hreflang="${escapeHtml(code)}" lang="${escapeHtml(code)}"${current}>${label}</a>`;
  }).join("");
  const copy = kubiakaPrivateRecordsCopy(lang);
  const homeHref = localizedHref(basePath, "/", lang);
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow,noarchive" />
  <meta name="referrer" content="no-referrer" />
  <meta name="color-scheme" content="light" />
  <meta name="theme-color" content="#143f2e" />
  <title>${escapeHtml(title)} | ZUKAN</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <style>${KUBIAKA_PRIVATE_DOCUMENT_STYLES}${KUBIAKA_PRIVATE_RECORDS_STYLES}</style>
</head>
<body>
  <a class="kpr-skip" href="#kpr-main">${escapeHtml(copy.skipToContent)}</a>
  <header class="kpr-site-header">
    <div class="kpr-site-header-inner">
      <a class="kpr-brand" href="${escapeHtml(homeHref)}" aria-label="ZUKAN">ZUKAN</a>
      <nav class="kpr-language" aria-label="${escapeHtml(copy.languageLabel)}">${languageLinks}</nav>
    </div>
  </header>
  <main id="kpr-main" class="kpr-main">${body}</main>
  <footer class="kpr-site-footer">ZUKAN / Kubiaka watch · ${escapeHtml(copy.privateLabel)}</footer>
</body>
</html>`;
}

export function renderKubiakaPrivateRecordsHome(input: {
  basePath: string;
  lang: SiteLang;
  overview: KubiakaPrivateRecordOverview;
  acknowledgement: KubiakaPrivateAcknowledgement | null;
}): string {
  const { basePath, lang, overview, acknowledgement } = input;
  const copy = kubiakaPrivateRecordsCopy(lang);
  const captureHref = localizedHref(basePath, "/kubiaka/record?start=photo", lang);
  const recordsHref = localizedHref(basePath, KUBIAKA_PRIVATE_RECORDS_PATH, lang);
  const guideHref = localizedHref(basePath, "/kubiaka", lang);
  const acknowledgementBlock = acknowledgement
    ? `<section class="kpr-panel"><div class="kpr-eyebrow">Acknowledgement</div><h2>${escapeHtml(copy.acknowledgementTitle)}</h2><p>${escapeHtml(copy.acknowledgementLead)}</p><div class="kpr-actions"><a class="kpr-primary" href="${escapeHtml(detailHref(basePath, lang, acknowledgement.visitId))}">${escapeHtml(copy.acknowledgementAction)}</a></div></section>`
    : "";
  const body = overview.latest
    ? `${latestRecord(basePath, lang, overview.latest)}
       <section class="kpr-panel"><div class="kpr-eyebrow">Next</div><h2>${escapeHtml(copy.nextTitle)}</h2><p>${escapeHtml(copy.nextLead)}</p><div class="kpr-actions"><a class="kpr-primary" href="${escapeHtml(captureHref)}">${escapeHtml(copy.captureAction)}</a><a class="kpr-secondary" href="${escapeHtml(recordsHref)}">${escapeHtml(copy.recordsAction)}</a></div></section>`
    : `<section class="kpr-panel"><div class="kpr-eyebrow">Start</div><h2>${escapeHtml(copy.emptyTitle)}</h2><p>${escapeHtml(copy.emptyLead)}</p><div class="kpr-actions"><a class="kpr-primary" href="${escapeHtml(captureHref)}">${escapeHtml(copy.captureAction)}</a><a class="kpr-secondary" href="${escapeHtml(guideHref)}">${escapeHtml(copy.guideAction)}</a></div></section>`;
  return `<div class="kpr-page">
    <section class="kpr-hero"><div class="kpr-eyebrow">ZUKAN / Kubiaka</div><h1>${escapeHtml(copy.homeTitle)}</h1><p>${escapeHtml(copy.homeLead)}</p><span class="kpr-count">${escapeHtml(copy.countLabel(overview.totalCount))}</span></section>
    ${acknowledgementBlock}${body}
  </div>`;
}

export function renderKubiakaPrivateRecordList(input: {
  basePath: string;
  lang: SiteLang;
  page: KubiakaPrivateRecordPage;
}): string {
  const { basePath, lang, page } = input;
  const copy = kubiakaPrivateRecordsCopy(lang);
  const captureHref = localizedHref(basePath, "/kubiaka/record?start=photo", lang);
  const homeHref = localizedHref(basePath, "/kubiaka/me", lang);
  const records = page.records.length > 0
    ? `<div class="kpr-grid">${page.records.map((record) => recordCard(basePath, lang, record)).join("")}</div>`
    : `<section class="kpr-panel"><h2>${escapeHtml(copy.emptyTitle)}</h2><p>${escapeHtml(copy.emptyLead)}</p><div class="kpr-actions"><a class="kpr-primary" href="${escapeHtml(captureHref)}">${escapeHtml(copy.captureAction)}</a></div></section>`;
  return `<div class="kpr-page">
    <section class="kpr-hero"><div class="kpr-eyebrow">Private history</div><h1>${escapeHtml(copy.recordsTitle)}</h1><p>${escapeHtml(copy.recordsLead)}</p><span class="kpr-count">${escapeHtml(copy.countLabel(page.totalCount))}</span><div class="kpr-actions"><a class="kpr-secondary" href="${escapeHtml(homeHref)}">${escapeHtml(copy.backAction)}</a></div></section>
    ${page.hasMore ? `<p class="kpr-notice">${escapeHtml(copy.limitedNotice(page.limit))}</p>` : ""}
    ${records}
  </div>`;
}

export function renderKubiakaPrivateRecordDetail(input: {
  basePath: string;
  lang: SiteLang;
  detail: KubiakaPrivateRecordDetail;
}): string {
  const { basePath, lang, detail } = input;
  const copy = kubiakaPrivateRecordsCopy(lang);
  const backHref = localizedHref(basePath, KUBIAKA_PRIVATE_RECORDS_PATH, lang);
  const photos = detail.photos.map((photo) => `<figure><img src="${escapeHtml(mediaHref(basePath, detail.visitId, photo.photoIndex))}" alt="${escapeHtml(copy.photoAlt(photo.photoIndex, detail.photoCount))}" loading="${photo.photoIndex === 1 ? "eager" : "lazy"}" decoding="async" /></figure>`).join("");
  return `<div class="kpr-page">
    <section class="kpr-hero"><div class="kpr-eyebrow">Private detail</div><h1>${escapeHtml(copy.detailTitle)}</h1><p>${escapeHtml(copy.detailLead)}</p><span class="kpr-private">${escapeHtml(copy.privateLabel)}</span><dl class="kpr-meta"><div><dt>${escapeHtml(copy.savedLabel)}</dt><dd>${escapeHtml(formatSavedAt(detail.savedAt, lang))}</dd></div><div><dt>${escapeHtml(copy.aiLabel)}</dt><dd>${escapeHtml(aiLabel(lang, detail.aiAssessmentStatus))}</dd></div></dl><div class="kpr-actions"><a class="kpr-secondary" href="${escapeHtml(backHref)}">${escapeHtml(copy.backAction)}</a></div></section>
    <section class="kpr-panel"><h2>${escapeHtml(copy.photoCountLabel(detail.photoCount))}</h2><div class="kpr-photo-grid">${photos}</div></section>
  </div>`;
}

export function renderKubiakaPrivateRecordNotFound(basePath: string, lang: SiteLang): string {
  const copy = kubiakaPrivateRecordsCopy(lang);
  return `<div class="kpr-page"><section class="kpr-hero"><div class="kpr-eyebrow">Private record</div><h1>${escapeHtml(copy.notFoundTitle)}</h1><p>${escapeHtml(copy.notFoundLead)}</p><div class="kpr-actions"><a class="kpr-secondary" href="${escapeHtml(localizedHref(basePath, "/kubiaka/me", lang))}">${escapeHtml(copy.backAction)}</a></div></section></div>`;
}
