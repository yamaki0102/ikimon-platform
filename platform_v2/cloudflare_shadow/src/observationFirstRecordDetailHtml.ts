import type { ObservationFirstRecordDetail } from "./cloudflareObservationReadModel";

export type ObservationFirstMediaPresentation = {
  mediaId: string;
  mediaKind: "photo" | "video" | "audio";
  url: string | null;
};

export type ObservationFirstRecordPresentation = {
  title: string;
  observedLabel: string;
  note: string | null;
  media: ObservationFirstMediaPresentation[];
  actionNonce: string;
  processingMessage?: string | null;
  notice?: string | null;
};

const escapeHtml = (value: unknown): string => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const provenanceLabels = (card: ObservationFirstRecordDetail["observations"][number]): string[] => [
  card.provenance.owner ? "本人の観察" : "",
  card.provenance.ai ? "AIの暫定候補" : "",
  card.provenance.community ? "コミュニティの同定" : "",
  card.provenance.curator ? "専門家の確認" : "",
  card.provenance.imported ? "移行元の記録" : "",
].filter(Boolean);

const renderMedia = (media: ObservationFirstMediaPresentation | undefined, label: string): string => {
  if (!media?.url) return `<div class="of-media-empty" role="img" aria-label="${escapeHtml(label)}のメディアはありません"><span>${escapeHtml(label)}</span></div>`;
  if (media.mediaKind === "photo") return `<img src="${escapeHtml(media.url)}" alt="${escapeHtml(label)}" loading="lazy" decoding="async">`;
  if (media.mediaKind === "video") return `<video controls preload="metadata" src="${escapeHtml(media.url)}"><a href="${escapeHtml(media.url)}">動画を開く</a></video>`;
  return `<audio controls preload="metadata" src="${escapeHtml(media.url)}"><a href="${escapeHtml(media.url)}">音声を開く</a></audio>`;
};

const hidden = (name: string, value: string): string => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;

export function renderObservationFirstRecordDetailHtml(
  detail: ObservationFirstRecordDetail,
  presentation: ObservationFirstRecordPresentation,
): string {
  const mediaById = new Map(presentation.media.map((item) => [item.mediaId, item]));
  const action = `/api/v1/records/${encodeURIComponent(detail.recordId)}/observation-actions`;
  const cards = detail.observations.length === 0
    ? `<section class="of-empty" aria-labelledby="of-empty-title"><h2 id="of-empty-title">対象はまだ分けられていません</h2><p>写真や音声を記録として残し、対象はあとから追加できます。</p></section>`
    : detail.observations.map((card, index) => {
      const labels = provenanceLabels(card);
      const accepted = card.acceptedIdentification
        ? `<div class="of-accepted"><span>採用された同定</span><strong>${escapeHtml(card.acceptedIdentification.proposedName)}</strong><small>${escapeHtml(card.acceptedIdentification.actorType)}による明示的な判断</small></div>`
        : `<div class="of-unresolved"><strong>名前は未決定</strong><span>観察内容は名前がなくても保存されています。</span></div>`;
      const ai = card.aiSuggestions.map((item) => `<li><strong>${escapeHtml(item.proposedName ?? item.proposedScientificName ?? "候補なし")}</strong><span>AIによる暫定候補・人の判断ではありません</span></li>`).join("");
      const claims = card.communityIdentifications.map((item) => `<li><strong>${escapeHtml(item.proposedName)}</strong><span>${escapeHtml(item.actorType)} / ${item.accepted ? "採用済み" : "候補"}</span></li>`).join("");
      const media = card.media.map((item) => `<figure>${renderMedia(mediaById.get(item.mediaId), `${card.subjectLabel}の${item.mediaKind}`)}<figcaption>${escapeHtml(item.mediaKind)}</figcaption></figure>`).join("");
      const common = hidden("observation_id", card.observationId);
      const operation = (kind: string) => hidden("operation_id", `${presentation.actionNonce}-${index}-${kind}`);
      const ownerActions = detail.owner ? `<details class="of-edit"><summary>この対象を編集</summary>
        <div class="of-action-grid">
          <form method="post" action="${escapeHtml(action)}">${common}${operation("split")}${hidden("action", "split")}<button type="submit">対象を分ける</button></form>
          ${card.state === "excluded"
            ? `<form method="post" action="${escapeHtml(action)}">${common}${operation("restore")}${hidden("action", "restore")}<button type="submit">対象を復元</button></form>`
            : `<form method="post" action="${escapeHtml(action)}">${common}${operation("exclude")}${hidden("action", "exclude")}<label>除外理由<input name="reason" value="別の対象だった"></label><button type="submit">この対象を除外</button></form>`}
          ${detail.observations.filter((candidate) => candidate.observationId !== card.observationId && candidate.state === "active").length > 0 ? `<form method="post" action="${escapeHtml(action)}">${common}${operation("merge")}${hidden("action", "merge")}<label>統合先<select name="target_observation_id">${detail.observations.filter((candidate) => candidate.observationId !== card.observationId && candidate.state === "active").map((candidate) => `<option value="${escapeHtml(candidate.observationId)}">${escapeHtml(candidate.subjectLabel)}</option>`).join("")}</select></label><button type="submit">対象を統合</button></form>` : ""}
        </div>
      </details>` : "";
      const identificationForm = detail.proposalPolicy.identification
        ? `<form class="of-identification-form" method="post" action="${escapeHtml(action)}">${common}${operation("identify")}${hidden("action", "identify")}<label>同定候補<input name="proposed_name" required autocomplete="off"></label><label>根拠・補足<textarea name="note" rows="2"></textarea></label><button type="submit">候補を記録</button><p>候補の追加だけでは採用されません。</p></form>`
        : `<p class="of-policy-off">この記録では外部からの同定候補を受け付けていません。</p>`;
      return `<article class="of-card${card.state === "excluded" ? " is-excluded" : ""}" aria-labelledby="of-card-${index}">
        <header><span class="of-index">対象 ${index + 1}</span><h2 id="of-card-${index}">${escapeHtml(card.subjectLabel)}</h2><div class="of-badges">${labels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div></header>
        <div class="of-media-grid">${media || `<div class="of-media-empty"><span>割り当てられたメディアはありません</span></div>`}</div>
        ${accepted}
        ${ai ? `<section class="of-ai"><h3>AIの暫定候補</h3><ul>${ai}</ul></section>` : ""}
        <section class="of-community"><h3>同定の履歴</h3>${claims ? `<ul>${claims}</ul>` : `<p>人から記録された同定候補はまだありません。</p>`}${identificationForm}</section>
        ${ownerActions}
      </article>`;
    }).join("");
  const mediaReassignment = detail.owner && presentation.media.length > 0 && detail.observations.length > 0
    ? `<section class="of-record-tools"><h2>メディアの割り当て</h2><p>写真・動画・音声を対象ごとに付け替えられます。</p>${presentation.media.map((item, index) => `<form method="post" action="${escapeHtml(action)}">${hidden("action", "media_reassign")}${hidden("media_id", item.mediaId)}${hidden("operation_id", `${presentation.actionNonce}-media-${index}`)}<label>${escapeHtml(item.mediaKind)} <select name="target_observation_id">${detail.observations.filter((card) => card.state === "active").map((card) => `<option value="${escapeHtml(card.observationId)}">${escapeHtml(card.subjectLabel)}</option>`).join("")}</select></label><button type="submit">割り当てる</button></form>`).join("")}</section>`
    : "";
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(presentation.title)} | ikimon</title>
  <style>
    :root{color-scheme:light;--ink:#14231b;--muted:#5b6b63;--line:#d8e4dc;--paper:#fff;--wash:#f3f8f5;--green:#087f5b;--teal:#0f766e}*{box-sizing:border-box}body{margin:0;background:var(--wash);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.6}a{color:var(--teal)}button,input,select,textarea{font:inherit}button,input,select,textarea,summary{min-height:44px}.of-header{position:sticky;top:0;z-index:3;display:flex;justify-content:space-between;align-items:center;padding:11px max(12px,calc((100vw - 920px)/2));background:rgba(255,255,255,.96);border-bottom:1px solid var(--line)}.of-header a{font-weight:900;text-decoration:none;color:var(--ink)}.of-shell{width:min(920px,calc(100% - 24px));margin:18px auto 56px}.of-hero,.of-card,.of-record-tools,.of-empty{background:var(--paper);border:1px solid var(--line);border-radius:18px;box-shadow:0 12px 34px rgba(15,35,25,.07)}.of-hero{padding:22px;margin-bottom:14px}.of-hero h1{margin:0;font-size:clamp(25px,6vw,38px);line-height:1.2}.of-hero p{margin:6px 0 0;color:var(--muted)}.of-count{display:inline-flex;margin-top:12px;padding:5px 10px;border-radius:999px;background:#dff6eb;color:#075c42;font-weight:900}.of-list{display:grid;gap:14px}.of-card{padding:18px}.of-card.is-excluded{opacity:.72;border-style:dashed}.of-card header h2{margin:3px 0 8px;font-size:22px}.of-index{color:var(--green);font-size:13px;font-weight:900}.of-badges{display:flex;flex-wrap:wrap;gap:6px}.of-badges span{padding:4px 8px;border-radius:999px;background:#edf7f2;font-size:12px;font-weight:800}.of-media-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:9px;margin:14px 0}.of-media-grid figure{margin:0;border-radius:13px;overflow:hidden;background:#eef3f0}.of-media-grid img,.of-media-grid video{display:block;width:100%;aspect-ratio:4/3;object-fit:cover}.of-media-grid audio{width:100%;margin:28px 0}.of-media-grid figcaption{padding:7px 10px;color:var(--muted);font-size:12px}.of-media-empty{display:grid;place-items:center;min-height:120px;padding:14px;border-radius:13px;background:#eef3f0;color:var(--muted)}.of-accepted,.of-unresolved,.of-ai,.of-community,.of-edit{margin-top:12px;padding:13px;border:1px solid var(--line);border-radius:13px}.of-accepted{display:grid;background:#effbf5}.of-accepted span,.of-accepted small,.of-unresolved span{color:var(--muted)}.of-unresolved{display:grid}.of-ai{background:#f3f0ff}.of-ai h3,.of-community h3{margin:0 0 8px;font-size:17px}.of-ai ul,.of-community ul{display:grid;gap:7px;margin:0;padding:0;list-style:none}.of-ai li,.of-community li{display:grid;padding:9px;border-radius:10px;background:#fff}.of-ai li span,.of-community li span{color:var(--muted);font-size:12px}.of-identification-form,.of-action-grid form,.of-record-tools form{display:grid;gap:7px;margin-top:10px}.of-identification-form label,.of-action-grid label,.of-record-tools label{display:grid;gap:4px;font-weight:800}.of-identification-form input,.of-identification-form textarea,.of-action-grid input,.of-action-grid select,.of-record-tools select{width:100%;padding:9px 10px;border:1px solid #b8c9bf;border-radius:9px;background:#fff}.of-identification-form button,.of-action-grid button,.of-record-tools button{border:0;border-radius:10px;background:var(--green);color:#fff;font-weight:900;padding:9px 12px}.of-identification-form p,.of-policy-off{color:var(--muted);font-size:13px}.of-edit summary{display:flex;align-items:center;cursor:pointer;font-weight:900}.of-action-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.of-record-tools,.of-empty{margin-top:14px;padding:18px}.of-record-tools h2,.of-empty h2{margin-top:0}.of-privacy{margin:16px 4px;color:var(--muted);font-size:13px}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}:focus-visible{outline:3px solid #f59e0b;outline-offset:3px}@media(max-width:390px){.of-shell{width:calc(100% - 16px);margin-top:10px}.of-hero,.of-card,.of-record-tools,.of-empty{border-radius:14px}.of-card{padding:13px}.of-action-grid{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
  </style></head><body><header class="of-header"><a href="/">ikimon</a><a href="/records">記録一覧</a></header><main class="of-shell" data-observation-first-record-detail="1">${presentation.notice ? `<p class="of-privacy" role="status">${escapeHtml(presentation.notice)}</p>` : ""}<section class="of-hero"><span>観察記録</span><h1>${escapeHtml(presentation.title)}</h1><p>${escapeHtml(presentation.observedLabel)}</p>${presentation.note ? `<p>${escapeHtml(presentation.note)}</p>` : ""}<strong class="of-count">${detail.observationCount}件の対象</strong>${presentation.processingMessage ? `<p role="status" aria-live="polite">${escapeHtml(presentation.processingMessage)}</p>` : ""}</section><div class="of-list">${cards}</div>${mediaReassignment}<p class="of-privacy">${escapeHtml(detail.privacy.publicLocationLabel)}</p></main></body></html>`;
}
