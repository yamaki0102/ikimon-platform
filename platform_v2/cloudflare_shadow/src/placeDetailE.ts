import { escapeHtml } from "../../src/ui/siteShell";
import { sizedImageUrl, sizedImgAttrs } from "./derivedImageUrl";
import { isWeakTaxonLabel } from "./taxonNameResolver";

export type PlaceERecord = { id: string; href: string; name: string; mediaUrl: string | null; dateLabel: string | null; confirmed: boolean };
import type { PlaceInvasiveItem } from "./placeInvasive";
export type PlaceEEvent = { title: string; href: string; whenLabel: string; thumbUrl?: string | null };

export type PlaceEInput = {
  lang: string;
  name: string;
  localName: string | null;
  locality: string;
  hasRecords: boolean;
  suppressed: boolean;
  shownCount: number;
  latestLabel: string | null;
  records: PlaceERecord[];
  recordHref: string;
  allRecordsHref: string;
  backHref: string;
  backLabel: string;
  shareLabel: string;
  copiedLabel: string;
  shareTitle: string;
  saveHtml: string;
  moreHref: string;
  moreLabel: string;
  events: PlaceEEvent[];
  invasive?: PlaceInvasiveItem[];
};

const COPY = {
  ja: {
    top: "場所", records: "この場所の記録", seeAll: "すべて見る", events: "つながっているイベント", invasive: "この場所で見つかっている外来種", invConfirmed: (n: number, first: string | null) => `この場所の記録${n}件で、名前が確認されています。${first ? `最初に見つかったのは${first}です。` : ""}`, invSee: "見つかった記録を見る", invLearn: "この種について見る", cautionTitle: "見つけたときは", caution1: "持ち帰らないでください。飼うこと・運ぶことが法律で禁止されている種があります。", caution2: "駆除は自治体や専門家が行っています。写真で記録を残すことが、広がりを止める助けになります。",
    record: "この場所で記録する", first: "この場所で最初の記録を残す",
    emptyTitle: "まだ記録がありません", emptyBody: "この場所の最初の記録を残すと、ここから図鑑が始まります。写真1枚から残せます。",
    pendingTitle: "記録が集まり始めています", pendingBody: "公開できる記録がそろうと、ここに表示されます。",
    chipRecords: (n: number) => `記録 ${n}件`, chipLatest: (d: string) => `最新 ${d}`, unnamed: "名前は未確定", confirmed: "確認済み",
  },
  en: {
    top: "Place", records: "Records here", seeAll: "See all", events: "Connected events", invasive: "", invConfirmed: (_n: number, _f: string | null) => "", invSee: "", invLearn: "", cautionTitle: "", caution1: "", caution2: "",
    record: "Record at this place", first: "Leave the first record here",
    emptyTitle: "No records yet", emptyBody: "Leave the first record here and this place's guide begins. One photo is enough.",
    pendingTitle: "Records are starting to arrive", pendingBody: "They will appear here once enough can be shown.",
    chipRecords: (n: number) => `${n} records`, chipLatest: (d: string) => `Latest ${d}`, unnamed: "Not named yet", confirmed: "Confirmed",
  },
} as const;

const CAMERA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="12.5" r="3.5"/></svg>';
const SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 12v7h14v-7"/></svg>';
const BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>';
const CHEV = '<svg class="pe-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5.5 6 6.5-6 6.5"/></svg>';
const IMG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m5 17 5-4.5 3.5 3L16 13l3 3"/></svg>';

export const PLACE_E_STYLES = `
.pe{color:#17211B;max-width:1120px;margin:0 auto;min-width:0}
.pe svg{width:22px;height:22px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.pe-hero{position:relative;height:min(56vw,240px);overflow:hidden;background:#EEF1ED}
.pe-hero>img{display:block;width:100%;height:100%;object-fit:cover}
.pe-top{position:relative;height:60px;display:flex;align-items:center;justify-content:center}
.pe-top b{font-size:16.5px;font-weight:800}
.pe .gpd-hero-btn{top:8px}
.pe-hero .gpd-hero-btn{top:14px}
.pe-body{padding:0 20px}
.pe-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-top:20px}
.pe-head>div{min-width:0;flex:1}
.pe-name{margin:0;font-size:26px;font-weight:800;line-height:1.35;letter-spacing:-.01em;overflow-wrap:anywhere}
.pe-meta{margin:6px 0 0;font-size:14px;color:#55615A;font-weight:600;line-height:1.6}
.pe-head .zs-control,.pe-head .gpd-secondary{flex:none;white-space:nowrap;min-height:44px;padding:0 18px;border-radius:999px}
.pe-chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0;padding:0;list-style:none}
.pe-chips li{background:#F1F3EE;color:#33403A;border-radius:999px;padding:7px 14px;font-size:13px;font-weight:700;white-space:nowrap}
.pe-h{display:flex;align-items:center;gap:8px;margin:30px 0 12px}
.pe-h h2{margin:0;font-size:19px;font-weight:800;letter-spacing:-.01em}
.pe-h a,.pe-h a:visited{margin-left:auto;display:inline-flex;align-items:center;min-height:44px;font-size:13.5px;font-weight:700;color:#143F2E;text-decoration:none;white-space:nowrap}
.pe-h a svg{width:18px;height:18px}
.pe-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.pe-strip a{display:block;aspect-ratio:1/1.1;border-radius:14px;overflow:hidden;background:#EEF1ED}
.pe-strip img{display:block;width:100%;height:100%;object-fit:cover}
.pe-rows{display:grid}
.pe-row,.pe-row:visited{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid #E3E7E1;color:inherit;text-decoration:none;min-width:0}
.pe-strip+.pe-rows{margin-top:6px}
.pe-thumb{flex:none;width:64px;height:64px;border-radius:14px;overflow:hidden;background:#EEF1ED}
.pe-thumb img{display:block;width:100%;height:100%;object-fit:cover}
.pe-row .tx{flex:1;min-width:0}
.pe-row .t{font-size:16.5px;font-weight:800;line-height:1.5;overflow-wrap:anywhere}
.pe-row .s{margin-top:2px;font-size:13.5px;color:#55615A;font-weight:600;line-height:1.55}
.pe-chev{width:18px;height:18px;color:#8a948d}
.pe-cnt{margin-left:auto;font-size:13.5px;font-weight:700;color:#55615A}
.pe-inv{border:1.5px solid #E0CD9E;border-radius:16px;padding:16px;background:#fff;margin-bottom:12px}
.pe-inv-h{display:flex;gap:13px;align-items:center}
.pe-inv-h img{width:62px;height:62px;border-radius:12px;object-fit:cover;flex:none}
.pe-inv-n{font-size:18px;font-weight:800;line-height:1.45;overflow-wrap:anywhere}
.pe-warn{display:inline-flex;margin-top:5px;background:#FAF3E3;border:1px solid #E0CD9E;color:#8A4B00;font-size:13px;font-weight:800;border-radius:999px;padding:4px 11px;white-space:nowrap}
.pe-inv p{margin:13px 0 0;font-size:15.5px;line-height:1.75}
.pe-inv-l,.pe-inv-l:visited{display:flex;align-items:center;gap:8px;min-height:44px;margin-top:6px;border-top:1px solid #EFE7D2;font-size:15.5px;font-weight:700;color:#0055AD;text-decoration:none}
.pe-inv-l svg{margin-left:auto}
.pe-caution{background:#FAF6EA;border-radius:16px;padding:18px}
.pe-caution b{font-size:16px;font-weight:800;color:#8A4B00}
.pe-caution ul{margin:10px 0 0;padding-left:20px}
.pe-caution li{font-size:15.5px;line-height:1.75;margin-top:4px}
.pe-empty{margin-top:28px;padding:32px 20px;border-radius:18px;background:#F7F7F3;text-align:center}
.pe-empty i{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:16px;background:#EDF2EC;color:#143F2E}
.pe-empty i svg{width:26px;height:26px}
.pe-empty h2{margin:14px 0 0;font-size:20px;font-weight:800;line-height:1.5}
.pe-empty p{margin:8px auto 0;max-width:30em;font-size:15px;line-height:1.8;color:#55615A}
.pe-actions{display:grid;gap:10px;margin:28px 0 0}
.pe-empty .pe-actions{margin-top:20px}
.pe-actions .gpd-primary,.pe-actions .gpd-secondary{min-height:52px;border-radius:999px;width:100%;white-space:nowrap}
.pe :focus-visible{outline:3px solid currentColor;outline-offset:3px}
@media(min-width:768px){.pe-hero{height:320px;margin:20px 20px 0;border-radius:20px}.pe-name{font-size:34px}.pe-actions{grid-template-columns:repeat(2,minmax(0,1fr))}.pe-empty .pe-actions{grid-template-columns:minmax(0,360px);justify-content:center}}
`;

export function renderPlaceE(input: PlaceEInput): string {
  const c = input.lang === "ja" ? COPY.ja : COPY.en;
  const e = escapeHtml;
  const named = (n: string | null | undefined): string => (n && !isWeakTaxonLabel(n) ? n : "");
  const buttons = `<a class="gpd-hero-btn gpd-back" href="${e(input.backHref)}" aria-label="${e(input.backLabel)}">${BACK}</a><button type="button" class="gpd-hero-btn gpd-hero-share" data-gpd-share data-share-title="${e(input.shareTitle)}" data-share-copied="${e(input.copiedLabel)}" aria-label="${e(input.shareLabel)}">${SHARE}</button>`;

  const withPhoto = input.hasRecords ? input.records.filter((r) => r.mediaUrl) : [];
  const heroUrl = withPhoto[0]?.mediaUrl ?? "";
  const rowRecs = input.hasRecords ? input.records.slice(0, 2) : [];
  const rowPhotos = new Set(rowRecs.map((r) => r.mediaUrl).filter((u): u is string => Boolean(u)));
  const stripUsed = new Set<string>(heroUrl ? [heroUrl] : []);
  const stripRecs: PlaceERecord[] = [];
  for (const r of withPhoto) {
    if (!r.mediaUrl || stripUsed.has(r.mediaUrl) || rowPhotos.has(r.mediaUrl)) continue;
    stripUsed.add(r.mediaUrl);
    stripRecs.push(r);
    if (stripRecs.length === 3) break;
  }
  const showStrip = stripRecs.length === 3;
  const strip = showStrip
    ? `<div class="pe-strip" data-pe-strip>${stripRecs.map((r) => `<a href="${e(r.href)}"><img ${sizedImgAttrs(r.mediaUrl as string, 360, [360, 680], "(max-width: 899px) 33vw, 360px", e)} alt="${e(named(r.name))}" loading="lazy" decoding="async"></a>`).join("")}</div>`
    : "";

  const shown = new Set<string>(heroUrl ? [heroUrl] : []);
  if (showStrip) for (const r of stripRecs) if (r.mediaUrl) shown.add(r.mediaUrl);
  const rows = rowRecs.map((r) => {
    let thumb = "";
    if (r.mediaUrl && !shown.has(r.mediaUrl)) {
      shown.add(r.mediaUrl);
      thumb = `<span class="pe-thumb"><img src="${e(sizedImageUrl(r.mediaUrl, 320))}" alt="" loading="lazy" decoding="async"></span>`;
    }
    const meta = [r.dateLabel, r.confirmed ? c.confirmed : ""].filter(Boolean).join(" ・ ");
    return `<a class="pe-row" href="${e(r.href)}">${thumb}<span class="tx"><div class="t">${e(named(r.name) || c.unnamed)}</div>${meta ? `<div class="s">${e(meta)}</div>` : ""}</span>${CHEV}</a>`;
  }).join("");

  const hero = heroUrl
    ? `<div class="pe-hero" data-pe-hero><img ${sizedImgAttrs(heroUrl, 1020, [680, 1020, 1360], "(max-width: 899px) 100vw, 1120px", e)} alt="" fetchpriority="high" decoding="async">${buttons}</div>`
    : `<div class="pe-top"><b>${e(c.top)}</b>${buttons}</div>`;

  const meta = [input.locality, input.localName].filter(Boolean).join(" ・ ");
  const chips = [c.chipRecords(input.hasRecords ? input.shownCount : 0), input.hasRecords && input.latestLabel ? c.chipLatest(input.latestLabel) : ""].filter(Boolean);
  const head = `<div class="pe-head"><div><h1 id="gpd-title" class="pe-name">${e(input.name)}</h1>${meta ? `<p class="pe-meta">${e(meta)}</p>` : ""}</div>${input.saveHtml}</div><ul class="pe-chips" data-pe-chips>${chips.map((x) => `<li>${e(x)}</li>`).join("")}</ul>`;

  const primary = (label: string) => `<a class="gpd-primary" href="${e(input.recordHref)}" data-pe-record>${CAMERA}<span>${e(label)}</span></a>`;
  const moreBtn = `<a class="gpd-secondary" href="${e(input.moreHref)}" data-pe-more>${e(input.moreLabel)}</a>`;

  let main: string;
  if (!input.hasRecords) {
    main = `<section class="pe-empty" data-pe-empty><i>${IMG}</i><h2>${e(input.suppressed ? c.pendingTitle : c.emptyTitle)}</h2><p>${e(input.suppressed ? c.pendingBody : c.emptyBody)}</p><div class="pe-actions">${primary(input.suppressed ? c.record : c.first)}</div></section><div class="pe-actions">${moreBtn}</div>`;
  } else {
    const recordsSec = `<section data-pe-records><div class="pe-h"><h2>${e(c.records)}</h2><a href="${e(input.allRecordsHref)}">${e(c.seeAll)}${CHEV}</a></div>${strip}${rows ? `<div class="pe-rows">${rows}</div>` : ""}</section>`;
    const invList = c.invasive && input.invasive?.length
      ? `<section data-pe-invasive><div class="pe-h"><h2>${e(c.invasive)}</h2><span class="pe-cnt">${input.invasive.length}種</span></div>${input.invasive.slice(0, 3).map((v) => {
          const img = v.mediaUrl && !shown.has(v.mediaUrl) ? (shown.add(v.mediaUrl), `<img src="${e(sizedImageUrl(v.mediaUrl, 320))}" alt="" loading="lazy" decoding="async">`) : "";
          return `<div class="pe-inv"><div class="pe-inv-h">${img}<div><div class="pe-inv-n">${e(v.name)}</div><span class="pe-warn">${e(v.label)}</span></div></div><p>${e(c.invConfirmed(v.count, v.firstLabel))}</p><a class="pe-inv-l" href="${e(v.recordHref)}">${e(c.invSee)}${CHEV}</a><a class="pe-inv-l" href="${e(v.learnHref)}">${e(c.invLearn)}${CHEV}</a></div>`;
        }).join("")}<div class="pe-caution"><b>${e(c.cautionTitle)}</b><ul><li>${e(c.caution1)}</li><li>${e(c.caution2)}</li></ul></div></section>`
      : "";
    const events = input.events.length
      ? `<section data-pe-events><div class="pe-h"><h2>${e(c.events)}</h2></div><div class="pe-rows">${input.events.slice(0, 3).map((ev) => `<a class="pe-row" href="${e(ev.href)}">${ev.thumbUrl && !shown.has(ev.thumbUrl) ? `<span class="pe-thumb"><img src="${e(ev.thumbUrl)}" alt="" loading="lazy"></span>` : ""}<span class="tx"><div class="t">${e(ev.title)}</div><div class="s">${e(ev.whenLabel)}</div></span>${CHEV}</a>`).join("")}</div></section>`
      : "";
    main = `${recordsSec}${invList}${events}<div class="pe-actions">${primary(c.record)}${moreBtn}</div>`;
  }
  return `<div class="pe" data-place-e-v2>${hero}<div class="pe-body">${head}${main}</div></div>`;
}
