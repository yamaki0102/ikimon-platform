import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import { getSessionFromCookie } from "../services/authSession.js";
import {
  listKnowledgeSourceCorrections,
  listReferenceLibrary,
  resolveCommerceCountryCode,
  type ReferenceCard,
  type ReferenceLibrarySnapshot,
  type ReferenceTab,
} from "../services/referenceLibrary.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function requestUrl(request: { url?: string; raw?: { url?: string; originalUrl?: string } }): string {
  return String(request.raw?.originalUrl ?? request.raw?.url ?? request.url ?? "");
}

function loginCard(basePath: string, redirect: string): string {
  return `<section class="section">
    <div class="card is-soft">
      <div class="card-body stack">
        <div class="eyebrow">reference library</div>
        <h2>参照資料ライブラリ</h2>
        <p class="meta">ログインすると、所有確認済み資料と共有カタログを使えます。</p>
        <div class="actions">
          <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, `/login?redirect=${encodeURIComponent(redirect)}`))}">ログインする</a>
          <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/register?redirect=/references"))}">登録する</a>
        </div>
      </div>
    </div>
  </section>`;
}

function tabFromQuery(url: string): ReferenceTab {
  const parsed = new URL(url.startsWith("http") ? url : `https://ikimon.local${url}`);
  const raw = parsed.searchParams.get("tab");
  if (raw === "catalog") return "catalog";
  if (raw === "needs_review") return "needs_review";
  return "owned";
}

function tabHref(basePath: string, lang: SiteLang, tab: ReferenceTab): string {
  return appendLangToHref(withBasePath(basePath, `/references?tab=${tab}`), lang);
}

function tabLabel(tab: ReferenceTab): string {
  if (tab === "catalog") return "共有カタログ";
  if (tab === "needs_review") return "要整理";
  return "所有確認済み";
}

function metaLine(card: ReferenceCard): string {
  return [
    card.authorText,
    card.publisher,
    card.publicationYear ? String(card.publicationYear) : "",
  ].filter(Boolean).join(" / ");
}

function sourceIdentifierLine(card: ReferenceCard): string {
  if (card.isbn) return `ISBN ${card.isbn}`;
  if (card.doi) return `DOI ${card.doi}`;
  if (card.url) return card.url;
  return card.sourceKind;
}

function ownedStatusLabel(card: ReferenceCard): string {
  if (card.ownedStatus === "owned_verified") return "所有確認済み";
  if (card.ownedStatus === "needs_review") return "要整理";
  return "共有カタログ";
}

function renderCommerceLinks(card: ReferenceCard): string {
  if (card.commerceLinks.length === 0) {
    return `<span class="ref-muted">購入リンク未登録</span>`;
  }
  const disclosure = card.commerceLinks.some((link) => link.disclosureRequired)
    ? `<div class="ref-disclosure">広告/成果報酬リンクを含みます</div>`
    : "";
  return `${disclosure}<div class="ref-commerce-links">
    ${card.commerceLinks.map((link) => `<a href="${escapeHtml(link.url)}" rel="${escapeHtml(link.rel)}" target="_blank">${escapeHtml(link.label)}</a>`).join("")}
  </div>`;
}

function renderReferenceCard(card: ReferenceCard, basePath: string): string {
  const taxa = card.taxonLabels.length
    ? card.taxonLabels.slice(0, 6).map((taxon) => `<span>${escapeHtml(taxon)}</span>`).join("")
    : `<span>分類群未整理</span>`;
  return `<article class="ref-card">
    <div class="ref-card-head">
      <div>
        <div class="eyebrow">${escapeHtml(ownedStatusLabel(card))}</div>
        <h3>${escapeHtml(card.title)}</h3>
      </div>
      <span class="ref-count">${escapeHtml(String(card.usedCount))}回</span>
    </div>
    <p class="ref-meta">${escapeHtml(metaLine(card) || "著者/出版社未整理")}</p>
    <p class="ref-id">${escapeHtml(sourceIdentifierLine(card))}</p>
    <div class="ref-tags">${taxa}</div>
    ${card.officialCorrectionCount > 0 ? `<div class="ref-correction">公式確認済み訂正 ${escapeHtml(String(card.officialCorrectionCount))}件</div>` : ""}
    <div class="ref-card-actions">
      <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, `/records?view=needs_id&referenceSourceId=${encodeURIComponent(card.sourceId)}`))}">同定に使う</a>
      <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, `/references/${encodeURIComponent(card.sourceId)}`))}">詳細</a>
    </div>
    <div class="ref-commerce">${renderCommerceLinks(card)}</div>
  </article>`;
}

function renderSummary(snapshot: ReferenceLibrarySnapshot, basePath: string): string {
  const recent = snapshot.summary.recent.length
    ? snapshot.summary.recent.map((item) => `<li>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.taxonLabels.slice(0, 3).join(" / ") || "分類群未整理")} · 同定 ${escapeHtml(String(item.usedCount))}回</span>
      </li>`).join("")
    : `<li><strong>まだ登録はありません</strong><span>表紙/ISBNをまとめて登録できます</span></li>`;
  return `<section class="section ref-summary">
    <div class="ref-summary-grid">
      <div class="ref-summary-main">
        <div class="eyebrow">Reference library</div>
        <h2>所有確認済み資料</h2>
        <p>同定フォームで再アップロードなしに使える資料です。</p>
        <div class="ref-summary-actions">
          <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/references/capture"))}">表紙を連続登録</a>
          <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/references?tab=catalog"))}">共有カタログを見る</a>
        </div>
      </div>
      <div class="ref-stat"><span>所有確認済み</span><strong>${escapeHtml(String(snapshot.summary.ownedVerifiedCount))}</strong></div>
      <div class="ref-stat"><span>要整理</span><strong>${escapeHtml(String(snapshot.summary.needsReviewCount))}</strong></div>
    </div>
    <ul class="ref-recent">${recent}</ul>
  </section>`;
}

function renderReferenceLibrary(snapshot: ReferenceLibrarySnapshot, basePath: string, lang: SiteLang): string {
  const tabs: ReferenceTab[] = ["owned", "catalog", "needs_review"];
  const tabNav = `<nav class="ref-tabs" aria-label="参照資料">
    ${tabs.map((tab) => `<a class="${tab === snapshot.tab ? "is-active" : ""}" href="${escapeHtml(tabHref(basePath, lang, tab))}">${escapeHtml(tabLabel(tab))}</a>`).join("")}
  </nav>`;
  const cards = snapshot.cards.length
    ? `<div class="ref-grid">${snapshot.cards.map((card) => renderReferenceCard(card, basePath)).join("")}</div>`
    : `<div class="onboarding-empty"><div class="eyebrow">${escapeHtml(tabLabel(snapshot.tab))}</div><h3>資料はまだありません</h3><p>登録すると、同定フォームの参照候補に出ます。</p></div>`;
  return `${renderSummary(snapshot, basePath)}<section class="section">${tabNav}${cards}</section>`;
}

function renderCapturePage(basePath: string): string {
  const endpoint = withBasePath(basePath, "/api/v1/references/capture-batches");
  return `<section class="section ref-capture" data-reference-capture data-endpoint="${escapeHtml(endpoint)}">
    <div class="ref-capture-shell">
      <div class="ref-camera-panel">
        <video class="ref-camera-video" data-ref-video autoplay muted playsinline></video>
        <canvas data-ref-canvas hidden></canvas>
        <div class="ref-camera-actions">
          <button class="btn btn-solid" type="button" data-ref-start>カメラ開始</button>
          <button class="btn btn-solid" type="button" data-ref-shot disabled>表紙を追加</button>
          <label class="btn btn-ghost ref-file-label">画像から追加<input type="file" accept="image/*" multiple data-ref-files hidden /></label>
        </div>
      </div>
      <div class="ref-queue-panel">
        <div class="section-header"><div><div class="eyebrow">Batch</div><h2>登録キュー</h2></div><span data-ref-count>0件</span></div>
        <div class="ref-queue" data-ref-queue></div>
        <button class="btn btn-solid" type="button" data-ref-submit disabled>AI分類して登録</button>
        <div class="ref-capture-status" data-ref-status role="status" aria-live="polite">Ready.</div>
      </div>
    </div>
    <div class="ref-result" data-ref-result hidden></div>
  </section>
  <script>
(function(){
  var root = document.querySelector('[data-reference-capture]');
  if (!root) return;
  var endpoint = root.getAttribute('data-endpoint') || '';
  var video = root.querySelector('[data-ref-video]');
  var canvas = root.querySelector('[data-ref-canvas]');
  var start = root.querySelector('[data-ref-start]');
  var shot = root.querySelector('[data-ref-shot]');
  var files = root.querySelector('[data-ref-files]');
  var queueEl = root.querySelector('[data-ref-queue]');
  var countEl = root.querySelector('[data-ref-count]');
  var submit = root.querySelector('[data-ref-submit]');
  var status = root.querySelector('[data-ref-status]');
  var resultEl = root.querySelector('[data-ref-result]');
  var queue = [];
  function setStatus(message, isError){
    status.textContent = message;
    status.classList.toggle('is-error', !!isError);
  }
  function renderQueue(){
    countEl.textContent = queue.length + '件';
    submit.disabled = queue.length === 0;
    queueEl.innerHTML = queue.map(function(item, index){
      return '<div class="ref-queue-item"><img src="' + item.base64Data.replace(/"/g, '&quot;') + '" alt="" /><span>表紙 ' + (index + 1) + '</span><button type="button" data-ref-remove="' + index + '">削除</button></div>';
    }).join('');
  }
  queueEl.addEventListener('click', function(event){
    var button = event.target && event.target.closest ? event.target.closest('[data-ref-remove]') : null;
    if (!button) return;
    var index = Number(button.getAttribute('data-ref-remove'));
    if (Number.isFinite(index)) queue.splice(index, 1);
    renderQueue();
  });
  start.addEventListener('click', function(){
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('この環境ではカメラを開始できません。画像から追加できます。', true);
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(function(stream){
        video.srcObject = stream;
        shot.disabled = false;
        setStatus('撮影できます。', false);
      })
      .catch(function(error){ setStatus('カメラを開始できません: ' + (error && error.message || 'camera'), true); });
  });
  shot.addEventListener('click', function(){
    if (!video.videoWidth || !video.videoHeight) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    queue.push({ filename: 'reference-cover-' + Date.now() + '.jpg', mimeType: 'image/jpeg', base64Data: canvas.toDataURL('image/jpeg', 0.82), proofKind: 'cover' });
    renderQueue();
  });
  files.addEventListener('change', function(){
    Array.prototype.slice.call(files.files || []).forEach(function(file){
      var reader = new FileReader();
      reader.onload = function(){
        queue.push({ filename: file.name, mimeType: file.type || 'image/jpeg', base64Data: String(reader.result || ''), proofKind: 'cover' });
        renderQueue();
      };
      reader.readAsDataURL(file);
    });
    files.value = '';
  });
  submit.addEventListener('click', function(){
    if (!queue.length) return;
    submit.disabled = true;
    setStatus('AI分類しています...', false);
    fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ items: queue })
    })
    .then(function(response){ return response.json().then(function(json){ return { ok: response.ok && json && json.ok, json: json }; }); })
    .then(function(result){
      if (!result.ok) throw new Error(String((result.json && result.json.error) || 'reference_capture_failed'));
      queue = [];
      renderQueue();
      var items = result.json.items || [];
      resultEl.hidden = false;
      resultEl.innerHTML = '<div class="section-header"><div><div class="eyebrow">Result</div><h2>登録結果</h2></div><a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/references"))}">一覧へ</a></div>' +
        '<div class="ref-result-grid">' + items.map(function(item){
          var uses = (item.useCases || []).slice(0, 4).map(function(use){ return '<li>' + String(use).replace(/[&<>"]/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]; }) + '</li>'; }).join('');
          return '<div class="ref-result-card"><strong>' + String(item.title || '未整理の参照資料').replace(/[&<>"]/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]; }) + '</strong><span>' + String(item.verificationStatus || '') + '</span><ul>' + uses + '</ul></div>';
        }).join('') + '</div>';
      setStatus('登録しました。', false);
    })
    .catch(function(error){
      submit.disabled = queue.length === 0;
      setStatus('登録できませんでした: ' + (error && error.message || 'network'), true);
    });
  });
})();
  </script>`;
}

const REFERENCE_STYLES = `
  .ref-summary-grid { display: grid; grid-template-columns: minmax(0, 1fr) 160px 160px; gap: 12px; align-items: stretch; }
  .ref-summary-main, .ref-stat, .ref-card, .ref-capture-shell, .ref-result-card { min-width: 0; border: 1px solid rgba(15,23,42,.08); background: rgba(255,255,255,.92); border-radius: 8px; box-shadow: 0 12px 28px rgba(15,23,42,.05); }
  .ref-summary-main { padding: 22px; }
  .ref-summary-main h2 { margin: 6px 0 0; color: #10251a; line-height: 1.2; }
  .ref-summary-main p { margin: 10px 0 0; color: #64748b; font-weight: 720; line-height: 1.7; }
  .ref-summary-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
  .ref-stat { display: grid; align-content: center; gap: 8px; padding: 18px; }
  .ref-stat span { color: #047857; font-size: 12px; font-weight: 950; }
  .ref-stat strong { color: #0f172a; font-size: 34px; line-height: 1; }
  .ref-recent { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 12px 0 0; padding: 0; list-style: none; }
  .ref-recent li { min-width: 0; padding: 13px; border: 1px solid rgba(16,185,129,.13); border-radius: 8px; background: rgba(236,253,245,.62); }
  .ref-recent strong, .ref-recent span { display: block; overflow-wrap: anywhere; }
  .ref-recent strong { color: #10251a; line-height: 1.4; }
  .ref-recent span { margin-top: 5px; color: #64748b; font-size: 12px; font-weight: 750; line-height: 1.55; }
  .ref-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .ref-tabs a { min-height: 42px; display: inline-flex; align-items: center; padding: 9px 13px; border-radius: 999px; border: 1px solid rgba(15,23,42,.1); color: #334155; text-decoration: none; font-weight: 900; }
  .ref-tabs a.is-active { background: #10251a; color: #fff; border-color: #10251a; }
  .ref-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
  .ref-card { display: grid; gap: 10px; padding: 16px; }
  .ref-card-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .ref-card h3 { margin: 4px 0 0; color: #0f172a; font-size: 18px; line-height: 1.35; overflow-wrap: anywhere; }
  .ref-count { min-width: 48px; min-height: 34px; display: grid; place-items: center; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 12px; font-weight: 950; }
  .ref-meta, .ref-id, .ref-muted { margin: 0; color: #64748b; font-size: 12.5px; line-height: 1.55; font-weight: 740; overflow-wrap: anywhere; }
  .ref-tags, .ref-commerce-links, .ref-card-actions { display: flex; flex-wrap: wrap; gap: 7px; }
  .ref-tags span { display: inline-flex; min-height: 28px; align-items: center; padding: 5px 9px; border-radius: 999px; background: rgba(14,165,233,.1); color: #0369a1; font-size: 11px; font-weight: 900; }
  .ref-correction, .ref-disclosure { color: #92400e; background: #fffbeb; border: 1px solid rgba(217,119,6,.16); border-radius: 8px; padding: 8px 10px; font-size: 12px; font-weight: 850; }
  .ref-commerce-links a { color: #047857; font-size: 12px; font-weight: 900; }
  .ref-capture-shell { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(300px, .85fr); gap: 14px; padding: 16px; }
  .ref-camera-panel, .ref-queue-panel { min-width: 0; display: grid; gap: 12px; align-content: start; }
  .ref-camera-video { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 8px; background: #0f172a; }
  .ref-camera-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .ref-file-label { cursor: pointer; }
  .ref-queue { min-height: 180px; display: grid; gap: 8px; align-content: start; }
  .ref-queue-item { min-width: 0; display: grid; grid-template-columns: 54px minmax(0,1fr) auto; gap: 9px; align-items: center; padding: 8px; border-radius: 8px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); }
  .ref-queue-item img { width: 54px; height: 54px; object-fit: cover; border-radius: 6px; }
  .ref-queue-item span { color: #334155; font-weight: 850; }
  .ref-queue-item button { border: 0; background: transparent; color: #b91c1c; font-weight: 900; cursor: pointer; }
  .ref-capture-status { min-height: 34px; padding: 8px 10px; border-radius: 8px; background: #f8fafc; color: #475569; font-size: 12px; font-weight: 850; }
  .ref-capture-status.is-error { color: #b91c1c; background: #fef2f2; }
  .ref-result { margin-top: 16px; }
  .ref-result-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
  .ref-result-card { padding: 14px; display: grid; gap: 8px; }
  .ref-result-card strong { color: #0f172a; line-height: 1.4; }
  .ref-result-card span { color: #047857; font-size: 12px; font-weight: 950; }
  .ref-result-card ul { margin: 0; padding-left: 18px; color: #475569; font-size: 12.5px; line-height: 1.6; }
  @media (max-width: 820px) {
    .ref-summary-grid, .ref-recent, .ref-capture-shell { grid-template-columns: 1fr; }
    .ref-summary-actions .btn, .ref-camera-actions .btn, .ref-queue-panel > .btn { width: 100%; border-radius: 14px; white-space: normal; }
  }
`;

export async function registerReferenceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/references", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const session = await getSessionFromCookie(request.headers.cookie);
    if (!session) {
      reply.type("text/html; charset=utf-8");
      return renderSiteDocument({
        basePath,
        lang,
        activeNav: "ホーム",
        title: "参照資料ライブラリ | ikimon",
        body: loginCard(basePath, "/references"),
        currentPath: appendLangToHref(withBasePath(basePath, "/references"), lang),
      });
    }
    const tab = tabFromQuery(requestUrl(request));
    const countryCode = resolveCommerceCountryCode({
      locale: lang === "ja" ? "ja-JP" : lang === "pt-BR" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US",
      acceptLanguage: String(request.headers["accept-language"] ?? ""),
    });
    const snapshot = await listReferenceLibrary({ userId: session.userId, tab, countryCode });
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      lang,
      activeNav: "ホーム",
      title: "参照資料ライブラリ | ikimon",
      hero: {
        eyebrow: "References",
        heading: "参照資料ライブラリ",
        lead: "所有確認済み資料、共有カタログ、要整理の資料をまとめます。",
        actions: [
          { href: "/references/capture", label: "表紙を連続登録" },
          { href: "/profile", label: "マイページへ", variant: "secondary" },
        ],
      },
      body: renderReferenceLibrary(snapshot, basePath, lang),
      extraStyles: REFERENCE_STYLES,
      currentPath: appendLangToHref(withBasePath(basePath, "/references"), lang),
    });
  });

  app.get("/references/capture", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const session = await getSessionFromCookie(request.headers.cookie);
    if (!session) {
      reply.type("text/html; charset=utf-8");
      return renderSiteDocument({
        basePath,
        lang,
        activeNav: "ホーム",
        title: "参照資料を登録 | ikimon",
        body: loginCard(basePath, "/references/capture"),
        currentPath: appendLangToHref(withBasePath(basePath, "/references/capture"), lang),
      });
    }
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      lang,
      activeNav: "ホーム",
      title: "参照資料を登録 | ikimon",
      hero: {
        eyebrow: "Capture",
        heading: "表紙を連続登録",
        lead: "撮影した表紙/ISBNから、AIが資料カタログと対象分類群を整理します。",
        actions: [
          { href: "/references", label: "一覧へ戻る", variant: "secondary" },
        ],
      },
      body: renderCapturePage(basePath),
      extraStyles: REFERENCE_STYLES,
      currentPath: appendLangToHref(withBasePath(basePath, "/references/capture"), lang),
    });
  });

  app.get<{ Params: { sourceId: string } }>("/references/:sourceId", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const session = await getSessionFromCookie(request.headers.cookie);
    if (!session) {
      reply.type("text/html; charset=utf-8");
      return renderSiteDocument({
        basePath,
        lang,
        activeNav: "ホーム",
        title: "参照資料 | ikimon",
        body: loginCard(basePath, `/references/${encodeURIComponent(request.params.sourceId)}`),
      });
    }
    const snapshot = await listReferenceLibrary({
      userId: session.userId,
      tab: "catalog",
      countryCode: resolveCommerceCountryCode({ acceptLanguage: String(request.headers["accept-language"] ?? "") }),
      limit: 80,
    });
    const card = snapshot.cards.find((item) => item.sourceId === request.params.sourceId);
    if (!card) {
      reply.code(404).type("text/html; charset=utf-8");
      return renderSiteDocument({
        basePath,
        lang,
        activeNav: "ホーム",
        title: "参照資料なし | ikimon",
        body: `<section class="section"><div class="onboarding-empty"><div class="eyebrow">Reference</div><h3>資料が見つかりません</h3><p>共有カタログから確認してください。</p></div></section>`,
        extraStyles: REFERENCE_STYLES,
      });
    }
    const corrections = await listKnowledgeSourceCorrections(card.sourceId);
    const correctionHtml = corrections.length
      ? `<section class="section"><div class="section-header"><div><div class="eyebrow">Official corrections</div><h2>公式確認が必要な訂正</h2></div></div>
          <div class="ref-grid">${corrections.map((item) => `<div class="ref-card">
            <div class="eyebrow">${escapeHtml(item.verificationStatus)}</div>
            <h3>${escapeHtml(item.locator || "ページ未指定")}</h3>
            <p class="ref-meta">${escapeHtml(item.originalName || item.originalTaxonName || "元の表示未指定")} → ${escapeHtml(item.correctedName || item.correctedTaxonName || "訂正先未指定")}</p>
            ${item.officialSourceUrl ? `<a href="${escapeHtml(item.officialSourceUrl)}" rel="noopener nofollow" target="_blank">公式情報</a>` : ""}
            ${item.officialReference ? `<p class="ref-id">${escapeHtml(item.officialReference)}</p>` : ""}
          </div>`).join("")}</div>
        </section>`
      : `<section class="section"><div class="onboarding-empty"><div class="eyebrow">Official corrections</div><h3>訂正情報はまだありません</h3><p>図鑑ページの誤同定・分類更新は、公式確認済みメタデータとして追加します。</p></div></section>`;
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      lang,
      activeNav: "ホーム",
      title: `${card.title} | 参照資料 | ikimon`,
      body: `<section class="section"><div class="ref-grid">${renderReferenceCard(card, basePath)}</div></section>${correctionHtml}`,
      extraStyles: REFERENCE_STYLES,
      currentPath: appendLangToHref(withBasePath(basePath, `/references/${encodeURIComponent(card.sourceId)}`), lang),
    });
  });
}
