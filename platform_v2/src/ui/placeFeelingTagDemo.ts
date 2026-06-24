import type { SiteLang } from "../i18n.js";
import {
  PLACE_FEELING_TAGS,
  placeFeelingTagLabel,
  type PlaceFeelingTagCategory,
  type PlaceFeelingTagKey,
} from "../services/placeFeelingTags.js";
import { escapeHtml } from "./siteShell.js";

type PlaceFeelingDemoSample = {
  title: string;
  mediaKind: "photo" | "video";
  place: string;
  recordedAt: string;
  tags: PlaceFeelingTagKey[];
};

type PlaceFeelingDemoCount = {
  key: PlaceFeelingTagKey;
  count: number;
};

type PlaceFeelingTagDemoOptions = {
  lang: SiteLang;
  recordHref: string;
};

const DEMO_RECENT_TAGS: PlaceFeelingTagKey[] = ["walking", "beautiful", "family_time"];

const DEMO_SAMPLES: PlaceFeelingDemoSample[] = [
  {
    title: "夕方の川沿い",
    mediaKind: "photo",
    place: "静岡市 葵区",
    recordedAt: "2026-06-21 17:30",
    tags: ["beautiful", "walking", "seasonal_change"],
  },
  {
    title: "駅前の小径",
    mediaKind: "video",
    place: "藤枝市",
    recordedAt: "2026-06-20 08:10",
    tags: ["trash_seen", "hard_to_walk", "guide_easy"],
  },
  {
    title: "海辺の公園",
    mediaKind: "photo",
    place: "沼津市",
    recordedAt: "2026-06-19 10:45",
    tags: ["felt_good", "family_time", "place_to_rest"],
  },
];

const DEMO_COUNTS: PlaceFeelingDemoCount[] = [
  { key: "beautiful", count: 18 },
  { key: "felt_good", count: 16 },
  { key: "walking", count: 14 },
  { key: "seasonal_change", count: 11 },
  { key: "trash_seen", count: 8 },
  { key: "hard_to_walk", count: 6 },
  { key: "family_time", count: 5 },
  { key: "guide_easy", count: 4 },
];

const CATEGORY_LABELS_JA: Record<PlaceFeelingTagCategory, string> = {
  positive: "よかったこと",
  concern: "困りごと",
  change: "変化の手がかり",
  accessibility_or_use: "使いやすさ",
  activity_context: "活動中",
  social_context: "誰といたか",
};

function copyForLang(lang: SiteLang) {
  if (lang !== "ja") {
    return {
      title: "Place feeling tag demo",
      eyebrow: "DEMO DATA",
      lead: "This page uses fixed sample data only. It does not read or write real user records.",
      demoBadge: "Not real data",
      recordCta: "Open posting form",
      uiTitle: "Posting UI preview",
      uiLead: "Recent selections appear first, and up to 3 tags can be selected.",
      recentLabel: "Recently selected",
      allLabel: "All tags",
      aggregateTitle: "Regional summary preview",
      aggregateLead: "Counts are fixture values for pitch and QA review.",
      detailTitle: "Post detail preview",
      payloadTitle: "Saved payload",
      payloadLead: "Stable keys are saved, not display labels.",
      mediaPhoto: "Photo",
      mediaVideo: "Video",
    };
  }
  return {
    title: "ひとことタグ デモ",
    eyebrow: "DEMO DATA",
    lead: "このページは固定サンプルだけで表示しています。実データの読み取り・保存は行いません。",
    demoBadge: "実データではありません",
    recordCta: "投稿フォームを開く",
    uiTitle: "投稿UIプレビュー",
    uiLead: "前回選んだタグを先頭に出し、選択は3つまでに抑えます。",
    recentLabel: "前回選んだタグ",
    allLabel: "全タグ",
    aggregateTitle: "地域集計プレビュー",
    aggregateLead: "ピッチやQAで確認するための固定値です。",
    detailTitle: "投稿詳細プレビュー",
    payloadTitle: "保存payload",
    payloadLead: "表示文ではなく、stable key の配列として保存します。",
    mediaPhoto: "写真",
    mediaVideo: "動画",
  };
}

function labelForTag(key: PlaceFeelingTagKey, lang: SiteLang): string {
  return placeFeelingTagLabel(key, lang) ?? key;
}

function renderTagChip(key: PlaceFeelingTagKey, lang: SiteLang, extraClass = ""): string {
  const tag = PLACE_FEELING_TAGS.find((item) => item.key === key);
  const category = tag?.category ?? "positive";
  return `<span class="pft-demo-chip ${escapeHtml(extraClass)}" data-tag-key="${escapeHtml(key)}" data-category="${escapeHtml(category)}"><b>${escapeHtml(key)}</b>${escapeHtml(labelForTag(key, lang))}</span>`;
}

function renderUiPreview(lang: SiteLang): string {
  const copy = copyForLang(lang);
  const recentSet = new Set<PlaceFeelingTagKey>(DEMO_RECENT_TAGS);
  const orderedTags = [
    ...DEMO_RECENT_TAGS,
    ...PLACE_FEELING_TAGS.map((tag) => tag.key).filter((key) => !recentSet.has(key)),
  ];
  return `<section class="pft-demo-section pft-demo-ui" aria-labelledby="pft-demo-ui-title">
    <div class="pft-demo-section-head">
      <div>
        <span>${escapeHtml(copy.demoBadge)}</span>
        <h2 id="pft-demo-ui-title">${escapeHtml(copy.uiTitle)}</h2>
      </div>
      <p>${escapeHtml(copy.uiLead)}</p>
    </div>
    <div class="pft-demo-recent" aria-label="${escapeHtml(copy.recentLabel)}">
      <strong>${escapeHtml(copy.recentLabel)}</strong>
      <div>${DEMO_RECENT_TAGS.map((key) => renderTagChip(key, lang, "is-recent")).join("")}</div>
    </div>
    <div class="pft-demo-tag-grid" aria-label="${escapeHtml(copy.allLabel)}">
      ${orderedTags.map((key, index) => renderTagChip(key, lang, index < 3 ? "is-selected" : "")).join("")}
    </div>
  </section>`;
}

function renderAggregatePreview(lang: SiteLang): string {
  const copy = copyForLang(lang);
  const max = Math.max(...DEMO_COUNTS.map((item) => item.count));
  const categoryCounts = DEMO_COUNTS.reduce((acc, item) => {
    const category = PLACE_FEELING_TAGS.find((tag) => tag.key === item.key)?.category;
    if (!category) return acc;
    acc.set(category, (acc.get(category) ?? 0) + item.count);
    return acc;
  }, new Map<PlaceFeelingTagCategory, number>());
  return `<section class="pft-demo-section" aria-labelledby="pft-demo-aggregate-title">
    <div class="pft-demo-section-head">
      <div>
        <span>${escapeHtml(copy.demoBadge)}</span>
        <h2 id="pft-demo-aggregate-title">${escapeHtml(copy.aggregateTitle)}</h2>
      </div>
      <p>${escapeHtml(copy.aggregateLead)}</p>
    </div>
    <div class="pft-demo-category-row">
      ${Array.from(categoryCounts.entries()).map(([category, count]) => `<div class="pft-demo-category"><strong>${escapeHtml(String(count))}</strong><span>${escapeHtml(CATEGORY_LABELS_JA[category] ?? category)}</span></div>`).join("")}
    </div>
    <div class="pft-demo-bars">
      ${DEMO_COUNTS.map((item) => {
        const width = Math.round((item.count / max) * 100);
        return `<div class="pft-demo-bar-row">
          <span>${escapeHtml(labelForTag(item.key, lang))}</span>
          <div class="pft-demo-bar-track"><i style="width:${escapeHtml(String(width))}%"></i></div>
          <strong>${escapeHtml(String(item.count))}</strong>
        </div>`;
      }).join("")}
    </div>
  </section>`;
}

function renderDetailPreview(lang: SiteLang): string {
  const copy = copyForLang(lang);
  return `<section class="pft-demo-section" aria-labelledby="pft-demo-detail-title">
    <div class="pft-demo-section-head">
      <div>
        <span>${escapeHtml(copy.demoBadge)}</span>
        <h2 id="pft-demo-detail-title">${escapeHtml(copy.detailTitle)}</h2>
      </div>
    </div>
    <div class="pft-demo-samples">
      ${DEMO_SAMPLES.map((sample) => `<article class="pft-demo-sample">
        <div class="pft-demo-thumb" aria-hidden="true">${escapeHtml(sample.mediaKind === "photo" ? copy.mediaPhoto : copy.mediaVideo)}</div>
        <div>
          <h3>${escapeHtml(sample.title)}</h3>
          <p>${escapeHtml(`${sample.place} / ${sample.recordedAt}`)}</p>
          <div class="pft-demo-sample-tags">${sample.tags.map((key) => renderTagChip(key, lang)).join("")}</div>
        </div>
      </article>`).join("")}
    </div>
  </section>`;
}

function renderPayloadPreview(lang: SiteLang): string {
  const copy = copyForLang(lang);
  const samplePayload = {
    place_feeling_tags: DEMO_SAMPLES[0]?.tags ?? [],
  };
  return `<section class="pft-demo-section pft-demo-payload" aria-labelledby="pft-demo-payload-title">
    <div class="pft-demo-section-head">
      <div>
        <span>${escapeHtml(copy.demoBadge)}</span>
        <h2 id="pft-demo-payload-title">${escapeHtml(copy.payloadTitle)}</h2>
      </div>
      <p>${escapeHtml(copy.payloadLead)}</p>
    </div>
    <pre><code>${escapeHtml(JSON.stringify(samplePayload, null, 2))}</code></pre>
  </section>`;
}

export function renderPlaceFeelingTagDemo(options: PlaceFeelingTagDemoOptions): string {
  const copy = copyForLang(options.lang);
  return `<main class="pft-demo-page">
    <section class="pft-demo-hero" aria-labelledby="pft-demo-title">
      <div>
        <span>${escapeHtml(copy.eyebrow)}</span>
        <h1 id="pft-demo-title">${escapeHtml(copy.title)}</h1>
        <p>${escapeHtml(copy.lead)}</p>
      </div>
      <a class="pft-demo-cta" href="${escapeHtml(options.recordHref)}">${escapeHtml(copy.recordCta)}</a>
    </section>
    ${renderUiPreview(options.lang)}
    ${renderAggregatePreview(options.lang)}
    ${renderDetailPreview(options.lang)}
    ${renderPayloadPreview(options.lang)}
  </main>`;
}

export const PLACE_FEELING_DEMO_STYLES = `
.shell-place-feeling-demo .site-main { background:#f8fafc; }
.global-record-launcher { display:none !important; }
.pft-demo-page { width:min(1120px, calc(100% - 32px)); margin:0 auto; padding:28px 0 56px; color:#0f172a; }
.pft-demo-hero { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; padding:10px 0 24px; border-bottom:1px solid #dbe5de; }
.pft-demo-hero span, .pft-demo-section-head span { display:inline-flex; min-height:24px; align-items:center; padding:4px 8px; border:1px solid #b6c6bc; border-radius:999px; color:#31533b; background:#eef7f0; font-size:12px; font-weight:900; letter-spacing:0; }
.pft-demo-hero h1 { margin:12px 0 8px; font-size:clamp(28px, 4vw, 48px); line-height:1.08; letter-spacing:0; }
.pft-demo-hero p { max-width:680px; margin:0; color:#475569; line-height:1.75; }
.pft-demo-cta { min-height:44px; display:inline-flex; align-items:center; justify-content:center; padding:10px 14px; border-radius:8px; background:#184b2a; color:#fff; text-decoration:none; font-weight:900; white-space:nowrap; }
.pft-demo-section { margin-top:24px; padding:20px; border:1px solid #dbe5de; border-radius:8px; background:#fff; }
.pft-demo-section-head { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:16px; }
.pft-demo-section-head h2 { margin:8px 0 0; font-size:22px; line-height:1.25; letter-spacing:0; }
.pft-demo-section-head p { max-width:460px; margin:2px 0 0; color:#475569; line-height:1.7; }
.pft-demo-recent { display:grid; gap:10px; padding:12px; border-radius:8px; background:#f8fafc; border:1px solid #e2e8f0; }
.pft-demo-recent strong { font-size:13px; color:#334155; }
.pft-demo-recent div, .pft-demo-tag-grid, .pft-demo-sample-tags { display:flex; flex-wrap:wrap; gap:8px; }
.pft-demo-tag-grid { margin-top:12px; }
.pft-demo-chip { min-height:36px; display:inline-flex; align-items:center; gap:7px; padding:7px 10px; border-radius:999px; border:1px solid #cbd5e1; background:#fff; color:#1f2937; font-size:13px; line-height:1.2; }
.pft-demo-chip b { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:11px; color:#64748b; font-weight:800; }
.pft-demo-chip.is-selected, .pft-demo-chip.is-recent { border-color:#1f6f3a; background:#edf7ef; box-shadow:inset 0 0 0 1px rgba(31,111,58,.12); }
.pft-demo-category-row { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; margin-bottom:18px; }
.pft-demo-category { display:grid; gap:4px; padding:12px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc; }
.pft-demo-category strong { font-size:24px; line-height:1; }
.pft-demo-category span { color:#475569; font-size:13px; }
.pft-demo-bars { display:grid; gap:10px; }
.pft-demo-bar-row { display:grid; grid-template-columns:minmax(120px, 1fr) minmax(120px, 2fr) 40px; align-items:center; gap:10px; font-size:14px; }
.pft-demo-bar-track { height:10px; border-radius:999px; background:#e2e8f0; overflow:hidden; }
.pft-demo-bar-track i { display:block; height:100%; border-radius:inherit; background:#1f6f3a; }
.pft-demo-samples { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px; }
.pft-demo-sample { display:grid; grid-template-columns:72px 1fr; gap:12px; padding:12px; border:1px solid #e2e8f0; border-radius:8px; background:#fff; }
.pft-demo-thumb { width:72px; aspect-ratio:1; display:grid; place-items:center; border-radius:8px; background:#dbeafe; color:#1e3a8a; font-weight:900; font-size:13px; }
.pft-demo-sample h3 { margin:0 0 4px; font-size:17px; letter-spacing:0; }
.pft-demo-sample p { margin:0 0 10px; color:#64748b; font-size:13px; line-height:1.5; }
.pft-demo-payload pre { margin:0; padding:14px; border-radius:8px; background:#0f172a; color:#e2e8f0; overflow:auto; font-size:13px; line-height:1.6; }
@media (max-width: 680px) {
  .pft-demo-page { width:min(100% - 24px, 1120px); padding-top:18px; }
  .pft-demo-hero, .pft-demo-section-head { display:grid; }
  .pft-demo-cta { width:100%; }
  .pft-demo-bar-row { grid-template-columns:1fr 34px; }
  .pft-demo-bar-row > span { grid-column:1 / -1; }
  .pft-demo-sample { grid-template-columns:56px 1fr; }
  .pft-demo-thumb { width:56px; }
}
`;
