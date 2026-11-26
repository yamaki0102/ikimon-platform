import { isWeakTaxonLabel } from "./taxonNameResolver";
import { escapeHtml } from "../../src/ui/siteShell";

export type PlaceV3Record = {
  id: string;
  href: string;
  name: string;
  mediaUrl: string | null;
  observedAt: string | null;
  dateLabel: string | null;
  confirmed: boolean;
};

export type PlaceV3Event = { title: string; href: string; whenLabel: string; thumbUrl?: string | null };
export type PlaceV3Steward = { fieldName: string; initial?: string | null };
export type PlaceV3Nearby = { name: string; href: string; distanceLabel?: string | null };

export type PlaceV3Input = {
  lang: string;
  prefix: string;
  canonicalPlaceId: string;
  name: string;
  localName: string | null;
  locality: string;
  hasRecords: boolean;
  suppressed: boolean;
  shownCount: number;
  startYear: string;
  latestLabel: string | null;
  records: PlaceV3Record[];
  photoUrls: string[];
  recordHref: string;
  allRecordsHref: string;
  backHref: string;
  backLabel: string;
  shareLabel: string;
  copiedLabel: string;
  shareTitle: string;
  saveHtml: string;
  moreLabel: string;
  moreHref: string;
  mapHref: string;
  externalMapHref: string;
  externalMapLabel: string;
  stewardIntro: string | null;
  events: PlaceV3Event[];
  steward: PlaceV3Steward | null;
  nearby: PlaceV3Nearby[];
  now: Date;
};

const COPY = {
  ja: {
    top: "場所", mark: "場所の図鑑", stat: "この場所の記録", since: "記録の始まり", latest: "最新の記録",
    record: "この場所で記録する", first: "最初に記録する",
    emptyTitle: "まだ記録がありません", emptyBody: "最初の記録を残すと、この場所の図鑑が始まります。見つけた鳥や花、まわりのようすを、写真1枚から残せます。",
    pendingTitle: "記録が集まり始めています", pendingBody: "公開できる記録がそろうと、ここに表示されます。",
    season: "いまの季節のようす", seasonTitle: (m: number) => `${m}月の記録`,
    recent: "最近の記録", seeAll: "すべて見る", unnamed: "名前はこれから", confirmed: "確認済み",
    events: "ここで開かれる観察会", steward: "場所の担当", stewardNote: "この場所の担当です。観察会や記録の相談ができます。", stewardSuffix: " さん",
    around: "この場所のまわり", openMap: "地図で見る", nearby: "近くの場所",
  },
  en: {
    top: "Place", mark: "Place guide", stat: "Records here", since: "First record", latest: "Latest record",
    record: "Record at this place", first: "Record the first one",
    emptyTitle: "No records yet", emptyBody: "Leave the first record and this place's guide begins. A single photo of a bird, a flower or the surroundings is enough.",
    pendingTitle: "Records are starting to arrive", pendingBody: "They will appear here once enough can be shown.",
    season: "This season here", seasonTitle: (m: number) => `Record from month ${m}`,
    recent: "Recent records", seeAll: "See all", unnamed: "Not named yet", confirmed: "Confirmed",
    events: "Events held here", steward: "Place steward", stewardNote: "Steward of this place. Ask about events and records.", stewardSuffix: "",
    around: "Around this place", openMap: "View on map", nearby: "Nearby places",
  },
} as const;

const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.4-6.5-10.3A6.5 6.5 0 0 1 12 4a6.5 6.5 0 0 1 6.5 6.7C18.5 15.6 12 21 12 21z"/><circle cx="12" cy="10.6" r="2.3"/></svg>';
const BOOK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 1 6.5 18H19v3H6.5A1.5 1.5 0 0 1 5 19.5z"/></svg>';
const CHEV = '<svg class="pv3-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5.5 6 6.5-6 6.5"/></svg>';
const CAMERA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="12.5" r="3.5"/></svg>';
const SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 12v7h14v-7"/></svg>';
const BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>';

export const PLACE_V3_STYLES = `
.pv3{--pv3-ease:cubic-bezier(.2,0,0,1);--pv3-fade:cubic-bezier(.25,.1,.25,1);color:#17211B;letter-spacing:.01em}
.pv3 svg{width:22px;height:22px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.pv3-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:0;padding:0 16px;min-width:0}
.pv3-col{min-width:0}
.pv3-bandbox{position:relative;margin:0 -16px}
.pv3-band{display:grid;gap:4px;overflow:hidden;border-radius:0 0 18px 18px;grid-template-columns:1fr 1fr;grid-template-rows:246px 92px;background:#EEF1ED}
.pv3-band img{display:block;width:100%;height:100%;object-fit:cover}
.pv3-band .pv3-bm{grid-column:1/-1;min-height:0;overflow:hidden}
.pv3-band .pv3-bs{min-height:0;overflow:hidden}
.pv3-band-n1{grid-template-columns:1fr;grid-template-rows:300px}
.pv3-band-n2{grid-template-columns:1fr;grid-template-rows:246px 92px}
.pv3-top{position:relative;height:64px;display:flex;align-items:center;justify-content:center;margin:0 -16px}
.pv3-top b{font-size:16.5px;font-weight:800}
.pv3-top .gpd-hero-btn{background:transparent;box-shadow:none}
.pv3-top .gpd-hero-btn svg,.pv3-bandbox .gpd-hero-btn svg{width:22px;height:22px}
.pv3-head{margin-top:22px}
.pv3-mark{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.pv3-mark i{width:40px;height:40px;border-radius:12px;background:#EDF2EC;color:#143F2E;display:flex;align-items:center;justify-content:center;flex:none}
.pv3-mark span{font-size:12.5px;font-weight:700;letter-spacing:.1em;color:#143F2E}
.pv3-name{margin:0;font-size:30px;font-weight:800;letter-spacing:-.02em;line-height:1.32;overflow-wrap:anywhere}
.pv3-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin:10px 0 0;font-size:13px;font-weight:600;color:#55615A;letter-spacing:-.01em}
.pv3-meta span{display:inline-flex;align-items:center;gap:4px}
.pv3-meta svg{width:15px;height:15px;color:#143F2E}
.pv3-desc{margin:12px 0 0;font-size:16px;line-height:1.8;overflow-wrap:anywhere}
.pv3-strip{display:flex;border-top:1px solid #DDE2DC;border-bottom:1px solid #DDE2DC;padding:15px 0 14px;margin-top:22px}
.pv3-strip>div{flex:1;min-width:0}
.pv3-strip>div+div{border-left:1px solid #E3E7E1;padding-left:18px}
.pv3-strip .n{font-size:24px;font-weight:800;letter-spacing:-.01em;line-height:1.15;white-space:nowrap}
.pv3-strip .k{font-size:12px;color:#55615A;font-weight:600;margin-top:4px}
.pv3-cta{display:flex;gap:10px;margin-top:20px;flex-wrap:wrap}
.pv3-cta .gpd-primary{flex:1 1 220px;max-width:480px;height:52px;border-radius:14px;min-height:52px}
.pv3-cta .gpd-secondary,.pv3-cta .zs-control{min-height:52px;border-radius:14px}
.pv3-invite{background:#F7F7F3;border-radius:18px;padding:24px 20px;margin-top:22px}
.pv3-invite h2{margin:0;font-size:20px;font-weight:800;line-height:1.5;letter-spacing:-.01em}
.pv3-invite p{margin:9px 0 0;font-size:16px;line-height:1.8}
.pv3-invite .pv3-cta{margin-top:16px}
.pv3-invite .pv3-cta .gpd-primary{max-width:none}
.pv3-h{display:flex;align-items:baseline;gap:8px;margin:36px 0 14px;font-size:20px;font-weight:800;letter-spacing:-.01em}
.pv3-h h2{margin:0;font-size:inherit;font-weight:inherit}
.pv3-h a,.pv3-h a:visited{margin-left:auto;display:inline-flex;align-items:center;gap:2px;font-size:13.5px;font-weight:600;color:#0055AD;text-decoration:none;min-height:44px}
.pv3-h a svg{width:18px;height:18px}
.pv3-season{display:block;background:#fff;border:1px solid #DDE2DC;border-radius:16px;overflow:hidden;color:inherit;text-decoration:none}
.pv3-season img{display:block;width:100%;height:208px;object-fit:cover}
.pv3-season .sb{padding:14px 16px 16px}
.pv3-season .st{font-size:16.5px;font-weight:700;line-height:1.5}
.pv3-season .sx{margin:7px 0 0;font-size:16px;line-height:1.78;overflow-wrap:anywhere}
.pv3-cards{display:grid;grid-template-columns:1fr;gap:14px}
.pv3-card,.pv3-card:visited{display:block;background:#fff;border:1px solid #DDE2DC;border-radius:14px;overflow:hidden;color:inherit;text-decoration:none;transition:transform 120ms var(--pv3-ease)}
.pv3-card:active,.pv3-cta .gpd-primary:active{transform:scale(.98)}
.pv3-card .rp{aspect-ratio:4/3;overflow:hidden;background:#EEF1ED}
.pv3-card .rp img{display:block;width:100%;height:100%;object-fit:cover}
.pv3-card .rb{padding:11px 13px 13px}
.pv3-card .rt{font-size:15.5px;font-weight:700;line-height:1.5;overflow-wrap:anywhere}
.pv3-card .rm{margin-top:7px;font-size:13.5px;color:#55615A;font-weight:600;line-height:1.55}
.pv3-details{margin:12px auto 0;max-width:1120px;min-width:0}.pv3-details>summary{display:flex;align-items:center;justify-content:center;min-height:52px;color:#143F2E;font-weight:700;font-size:1.0625rem;text-decoration:underline;text-underline-offset:4px;cursor:pointer;list-style:none}.pv3-details>summary::-webkit-details-marker{display:none}.pv3-details[open]>summary{margin-bottom:8px}
.pv3-rail{display:flex;flex-direction:column;gap:16px;margin-top:36px;min-width:0}
.pv3-rc{background:#F7F7F3;border-radius:16px;padding:18px}
.pv3-rc h2{margin:0 0 12px;font-size:16px;font-weight:800;letter-spacing:-.01em}
.pv3-rc .row{display:flex;align-items:center;gap:12px;color:inherit;text-decoration:none;min-height:44px;transition:background-color 120ms var(--pv3-ease)}
.pv3-rc a.row:active{background:#F0F1EA}
.pv3-rc .row img,.pv3-rc .row .ph{width:56px;height:56px;border-radius:12px;object-fit:cover;flex:none;background:#EEF1ED}
.pv3-rc .row .tx{flex:1;min-width:0}
.pv3-rc .row .t{font-size:15.5px;font-weight:700;line-height:1.5;overflow-wrap:anywhere}
.pv3-rc .row .s{font-size:13.5px;color:#55615A;margin-top:2px;line-height:1.6}
.pv3-rc .pv3-chev{width:18px;height:18px;color:#8a948d}
.pv3-rc .av{width:46px;height:46px;border-radius:50%;background:#143F2E;color:#fff;display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:700;flex:none}
.pv3-rc .links{display:flex;flex-direction:column}
.pv3-rc .links a,.pv3-rc .links a:visited{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:8px 0;border-top:1px solid #DDE2DC;color:#17211B;font-weight:700;font-size:15px;text-decoration:none}
.pv3-rc .links a:first-child{border-top:0}
.pv3-rc .loc{margin:0 0 8px;font-size:14px;color:#55615A;line-height:1.6}
.pv3 :focus-visible{outline:3px solid currentColor;outline-offset:3px}
@media(min-width:768px){
.pv3-grid{padding:20px 20px 0}
.pv3-bandbox{margin:0}
.pv3-band{border-radius:18px;grid-template-columns:2fr 1fr;grid-template-rows:1fr 1fr;height:352px}
.pv3-band .pv3-bm{grid-column:1;grid-row:1/-1}
.pv3-band-n1{grid-template-columns:1fr;grid-template-rows:1fr}
.pv3-band-n1 .pv3-bm{grid-row:auto}
.pv3-band-n2{grid-template-columns:2fr 1fr;grid-template-rows:1fr}
.pv3-band-n2 .pv3-bm{grid-row:auto}
.pv3-top{margin:0}
.pv3-name{font-size:36px;line-height:1.3}
.pv3-meta{font-size:14px;gap:6px 14px;margin-top:12px}
.pv3-meta svg{width:16px;height:16px}
.pv3-desc{font-size:16.5px;line-height:1.85;max-width:620px}
.pv3-strip .n{font-size:26px}
.pv3-cards{grid-template-columns:repeat(3,minmax(0,1fr))}
.pv3-season img{height:208px}
}
@media(min-width:960px){
.pv3-grid{grid-template-columns:minmax(0,1fr) 324px;gap:36px;max-width:1120px;margin:0 auto;align-items:start}
.pv3-rail{margin-top:0}
}
@keyframes pv3-img{from{opacity:0;transform:scale(1.04)}to{opacity:1;transform:none}}
@keyframes pv3-fade{from{opacity:0}to{opacity:1}}
@keyframes pv3-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.pv3:not(.pv3-seen) .pv3-bm img{animation:pv3-img 360ms var(--pv3-ease) both}
.pv3:not(.pv3-seen) .pv3-bs img{animation:pv3-fade 360ms var(--pv3-fade) 60ms both}
.pv3:not(.pv3-seen) .pv3-head{animation:pv3-up 240ms var(--pv3-ease) 120ms both}
.pv3:not(.pv3-seen) .pv3-strip,.pv3:not(.pv3-seen) .pv3-cta,.pv3:not(.pv3-seen) .pv3-invite{animation:pv3-up 240ms var(--pv3-ease) 240ms both}
.pv3:not(.pv3-seen) .pv3-sec-season{animation:pv3-up 240ms var(--pv3-ease) 360ms both}
.pv3:not(.pv3-seen) .pv3-sec-recent{animation:pv3-up 240ms var(--pv3-ease) 480ms both}
@media(prefers-reduced-motion:reduce){.pv3 *{animation:none!important;transition:none!important}}
`;

function monthJst(value: string | null): { year: number; month: number } | null {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric" }).formatToParts(new Date(value));
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return Number.isFinite(year) && Number.isFinite(month) ? { year, month } : null;
}

export function renderPlaceV3(input: PlaceV3Input): string {
  const c = input.lang === "ja" ? COPY.ja : COPY.en;
  const e = escapeHtml;
  const cardRecs = input.records.slice(0, 3);
  const cardPhotos = new Set(cardRecs.map((r) => r.mediaUrl).filter((u): u is string => Boolean(u)));
  const allPhotos = input.hasRecords ? input.photoUrls.filter(Boolean) : [];
  const spare = allPhotos.filter((u) => !cardPhotos.has(u)).slice(0, 3);
  const photos = spare.length ? spare : allPhotos.slice(0, 3);
  const used = new Set<string>(photos);
  const named = (n: string | null | undefined): string => (n && !isWeakTaxonLabel(n) ? n : "");
  const nowJst = monthJst(input.now.toISOString());

  const buttons = `<a class="gpd-hero-btn gpd-back" href="${e(input.backHref)}" aria-label="${e(input.backLabel)}">${BACK}</a><button type="button" class="gpd-hero-btn gpd-hero-share" data-gpd-share data-share-title="${e(input.shareTitle)}" data-share-copied="${e(input.copiedLabel)}" aria-label="${e(input.shareLabel)}">${SHARE}</button>`;

  const band = photos.length
    ? `<div class="pv3-bandbox"><div class="pv3-band pv3-band-n${photos.length}" data-pv3-band="${photos.length}"><div class="pv3-bm"><img src="${e(photos[0] ?? "")}" alt="" fetchpriority="high" decoding="async"></div>${photos.slice(1).map((u) => `<div class="pv3-bs"><img src="${e(u)}" alt="" loading="lazy" decoding="async"></div>`).join("")}</div>${buttons}</div>`
    : `<div class="pv3-top"><b>${e(c.top)}</b>${buttons}</div>`;

  const metaParts: string[] = [];
  if (input.locality) metaParts.push(`<span>${PIN}${e(input.locality)}</span>`);
  if (input.localName) metaParts.push(`<span lang="und">${e(input.localName)}</span>`);
  const head = `<header class="pv3-head">${input.hasRecords ? "" : `<div class="pv3-mark"><i>${BOOK}</i><span>${e(c.mark)}</span></div>`}<h1 id="gpd-title" class="pv3-name">${e(input.name)}</h1>${metaParts.length ? `<p class="pv3-meta">${metaParts.join("")}</p>` : ""}</header>`;
  const desc = input.stewardIntro ? `<p class="pv3-desc" data-pv3-intro>${e(input.stewardIntro)}</p>` : "";

  const strip = input.hasRecords
    ? `<div class="pv3-strip" data-pv3-strip><div><div class="n">${input.shownCount}</div><div class="k">${e(c.stat)}</div></div>${input.startYear ? `<div><div class="n">${e(input.startYear)}</div><div class="k">${e(c.since)}</div></div>` : ""}${input.latestLabel ? `<div><div class="n">${e(input.latestLabel)}</div><div class="k">${e(c.latest)}</div></div>` : ""}</div>`
    : "";
  const primary = (label: string) => `<a class="gpd-primary" href="${e(input.recordHref)}">${CAMERA}<span>${e(label)}</span></a>`;
  const cta = input.hasRecords
    ? `<div class="pv3-cta">${primary(c.record)}${input.saveHtml}</div>`
    : `<div class="pv3-invite" data-pv3-invite><h2>${e(input.suppressed ? c.pendingTitle : c.emptyTitle)}</h2><p>${e(input.suppressed ? c.pendingBody : c.emptyBody)}</p><div class="pv3-cta">${primary(input.suppressed ? c.record : c.first)}</div></div>`;

  let season = "";
  if (input.hasRecords && nowJst) {
    const pick = input.records.find((r) => {
      const m = monthJst(r.observedAt);
      if (!m || !named(r.name) || !r.mediaUrl || used.has(r.mediaUrl) || cardPhotos.has(r.mediaUrl)) return false;
      const ageMonths = (nowJst.year - m.year) * 12 + (nowJst.month - m.month);
      return ageMonths === 0;
    });
    if (pick) {
      if (pick.mediaUrl) used.add(pick.mediaUrl);
      season = `<section class="pv3-sec-season" data-pv3-season><div class="pv3-h"><h2>${e(c.season)}</h2></div><a class="pv3-season" href="${e(pick.href)}">${pick.mediaUrl ? `<img src="${e(pick.mediaUrl)}" alt="" loading="lazy" decoding="async">` : ""}<div class="sb"><div class="st">${e(c.seasonTitle(nowJst.month))}</div><p class="sx">${e(pick.name)}</p></div></a></section>`;
    }
  }

  const cards = cardRecs.map((r) => ({ ...r, mediaUrl: r.mediaUrl && !used.has(r.mediaUrl) ? r.mediaUrl : null })).map((r) =>
    `<a class="pv3-card" href="${e(r.href)}">${r.mediaUrl ? `<div class="rp"><img src="${e(r.mediaUrl)}" alt="${e(named(r.name))}" loading="lazy" decoding="async"></div>` : ""}<div class="rb"><div class="rt">${e(named(r.name) || c.unnamed)}</div><div class="rm">${e([r.dateLabel, r.confirmed ? c.confirmed : ""].filter(Boolean).join(" ・ "))}</div></div></a>`).join("");
  const recent = cards
    ? `<section class="pv3-sec-recent" data-pv3-recent><div class="pv3-h"><h2>${e(c.recent)}</h2><a href="${e(input.allRecordsHref)}">${e(c.seeAll)}${CHEV}</a></div><div class="pv3-cards">${cards}</div></section>`
    : "";

  const railParts: string[] = [];
  if (input.events.length) {
    railParts.push(`<div class="pv3-rc" data-pv3-events><h2>${e(c.events)}</h2>${input.events.slice(0, 3).map((ev) => `<a class="row" href="${e(ev.href)}">${ev.thumbUrl ? `<img src="${e(ev.thumbUrl)}" alt="" loading="lazy">` : `<span class="ph"></span>`}<span class="tx"><div class="t">${e(ev.title)}</div><div class="s">${e(ev.whenLabel)}</div></span>${CHEV}</a>`).join("")}</div>`);
  }
  if (input.steward) {
    const initial = (input.steward.initial || Array.from(input.steward.fieldName)[0] || "").slice(0, 2);
    railParts.push(`<div class="pv3-rc" data-pv3-steward><h2>${e(c.steward)}</h2><div class="row"><span class="av">${e(initial)}</span><span class="tx"><div class="t">${e(input.steward.fieldName + c.stewardSuffix)}</div><div class="s">${e(c.stewardNote)}</div></span></div></div>`);
  }
  const aroundLinks: string[] = [];
  for (const n of input.nearby.slice(0, 4)) {
    aroundLinks.push(`<a href="${e(n.href)}"><span>${e(n.name)}${n.distanceLabel ? ` <small style="font-weight:600;color:#55615A">${e(n.distanceLabel)}</small>` : ""}</span>${CHEV}</a>`);
  }
  if (input.mapHref) aroundLinks.push(`<a href="${e(input.mapHref)}"><span>${e(c.openMap)}</span>${CHEV}</a>`);
  if (input.externalMapHref) aroundLinks.push(`<a href="${e(input.externalMapHref)}" target="_blank" rel="noopener noreferrer"><span>${e(input.externalMapLabel)}</span>${CHEV}</a>`);
  if (aroundLinks.length) {
    railParts.push(`<div class="pv3-rc" data-pv3-around><h2>${e(c.around)}</h2>${input.locality ? `<p class="loc">${e(input.locality)}</p>` : ""}<div class="links">${aroundLinks.join("")}</div></div>`);
  }
  const rail = railParts.length ? `<aside class="pv3-rail" aria-label="${e(c.around)}">${railParts.join("")}</aside>` : "";

  const seen = `<script>(()=>{try{const r=document.currentScript.parentElement;const k='pv3:'+${JSON.stringify(input.canonicalPlaceId).replace(/</g, "\\u003c")};if(sessionStorage.getItem(k))r.classList.add('pv3-seen');else sessionStorage.setItem(k,'1');}catch{}})();</script>`;

  return `<div class="pv3" data-place-page-v3>${seen}<div class="pv3-grid"><div class="pv3-col">${band}${head}${desc}${strip}${cta}${season}${recent}</div>${rail}</div></div>`;
}
