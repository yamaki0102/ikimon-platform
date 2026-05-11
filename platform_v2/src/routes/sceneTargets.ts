import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { assertSameOriginRequest } from "../services/authSecurity.js";
import {
  decideSceneCandidate,
  getSceneTargetWorkspace,
  upsertSceneTarget,
  type SceneTarget,
  type SceneTargetCandidate,
  type SceneTargetMedia,
  type SceneTargetStatus,
  type SceneTargetWorkspace,
} from "../services/sceneTargets.js";
import { resolveViewer } from "../services/viewerIdentity.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function routeErrorStatus(error: unknown, fallback = 400): number {
  if (!(error instanceof Error)) return fallback;
  if (error.message === "session_required" || error.message === "account_disabled") return 401;
  if (error.message === "same_origin_required" || error.message === "observation_not_owned") return 403;
  if (error.message === "scene_not_found" || error.message === "candidate_not_found" || error.message === "scene_target_not_found") return 404;
  return fallback;
}

function statusLabel(status: SceneTargetStatus): string {
  const labels: Record<SceneTargetStatus, string> = {
    draft: "下書き",
    adopted: "採用",
    ignored: "無視",
    later: "あとで見る",
    converted: "観察レコード化済み",
  };
  return labels[status];
}

function mediaKindLabel(kind: SceneTargetMedia["mediaKind"]): string {
  if (kind === "image") return "画像";
  if (kind === "video") return "動画";
  if (kind === "audio") return "音声";
  return "メディア";
}

function formatSecond(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "";
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function confidenceLabel(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value * 100)}%` : "候補";
}

function firstImageMedia(workspace: SceneTargetWorkspace): SceneTargetMedia | null {
  return workspace.media.find((media) => media.mediaKind === "image" && media.url) ?? null;
}

function firstPlayableMedia(workspace: SceneTargetWorkspace): SceneTargetMedia | null {
  return workspace.media.find((media) => (media.mediaKind === "video" || media.mediaKind === "audio") && media.url) ?? null;
}

function renderTargetOverlay(targets: SceneTarget[]): string {
  return targets
    .filter((target) => target.normalizedRect)
    .map((target) => {
      const rect = target.normalizedRect!;
      return `<span class="scene-target-box is-${escapeHtml(target.status)}"
        style="left:${rect.x * 100}%;top:${rect.y * 100}%;width:${rect.width * 100}%;height:${rect.height * 100}%">
        <b>${escapeHtml(target.label || "記録対象")}</b>
      </span>`;
    })
    .join("");
}

function renderMediaPreview(workspace: SceneTargetWorkspace): string {
  const image = firstImageMedia(workspace);
  const playable = firstPlayableMedia(workspace);
  if (image?.url) {
    return `<div class="scene-target-preview">
      <img src="${escapeHtml(image.url)}" alt="シーンの画像" loading="lazy" decoding="async" />
      ${renderTargetOverlay(workspace.targets)}
    </div>`;
  }
  if (playable?.url && playable.mediaKind === "video") {
    return `<div class="scene-target-preview is-playable">
      <video src="${escapeHtml(playable.url)}" controls preload="metadata"></video>
    </div>`;
  }
  if (playable?.url && playable.mediaKind === "audio") {
    return `<div class="scene-target-preview is-audio">
      <audio src="${escapeHtml(playable.url)}" controls preload="metadata"></audio>
    </div>`;
  }
  return `<div class="scene-target-empty-preview">
    <strong>このシーンには、まだ表示できるメディアがありません。</strong>
    <span>メモだけのシーンでも、記録対象を下書きとして整理できます。</span>
  </div>`;
}

function renderMediaOptions(media: SceneTargetMedia[]): string {
  const options = media.map((item) => {
    const label = `${mediaKindLabel(item.mediaKind)} / ${item.assetRole}`;
    return `<option value="${escapeHtml(item.assetId)}" data-media-kind="${escapeHtml(item.mediaKind)}">${escapeHtml(label)}</option>`;
  }).join("");
  return `<option value="">メディア未指定</option>${options}`;
}

function renderTargets(targets: SceneTarget[]): string {
  if (targets.length === 0) {
    return `<div class="scene-target-empty">まだ記録対象はありません。画像の範囲、動画・音声の時間区間、メモを使って切り出せます。</div>`;
  }
  return `<div class="scene-target-list">
    ${targets.map((target) => {
      const interval = target.startSecond != null || target.endSecond != null
        ? `<span>${escapeHtml(`${formatSecond(target.startSecond)}-${formatSecond(target.endSecond)}`)}</span>`
        : "";
      const rect = target.normalizedRect
        ? `<span>box ${Math.round(target.normalizedRect.x * 100)},${Math.round(target.normalizedRect.y * 100)} / ${Math.round(target.normalizedRect.width * 100)}x${Math.round(target.normalizedRect.height * 100)}</span>`
        : "";
      const ai = target.aiSuggestions[0];
      return `<article class="scene-target-item is-${escapeHtml(target.status)}">
        <div>
          <div class="scene-target-row">
            <strong>${escapeHtml(target.label || "記録対象")}</strong>
            <b>${escapeHtml(statusLabel(target.status))}</b>
          </div>
          <p>${escapeHtml(target.memo || "メモなし")}</p>
          <div class="scene-target-meta">
            <span>${escapeHtml(mediaKindLabel(target.mediaKind))}</span>
            <span>${escapeHtml(target.targetType)}</span>
            ${interval}
            ${rect}
            ${target.occurrenceId ? `<span>観察レコード候補 ${escapeHtml(target.occurrenceId)}</span>` : ""}
          </div>
          ${ai ? `<div class="scene-target-ai">AI候補: ${escapeHtml(ai.displayName)} / ${escapeHtml(confidenceLabel(ai.confidence))}</div>` : ""}
        </div>
      </article>`;
    }).join("")}
  </div>`;
}

function renderCandidates(basePath: string, visitId: string, candidates: SceneTargetCandidate[], isOwner: boolean): string {
  if (candidates.length === 0) {
    return `<div class="scene-target-empty">AI候補はまだありません。候補が出ても、自動では観察レコード化しません。</div>`;
  }
  return `<div class="scene-candidate-list">
    ${candidates.map((candidate) => {
      const current = candidate.targetStatus ? statusLabel(candidate.targetStatus) : "未選択";
      const region = candidate.regions[0] ?? null;
      const regionText = region?.frameTimeMs != null
        ? `${formatSecond(region.frameTimeMs / 1000)} 付近`
        : region?.rect
          ? "画像内の範囲あり"
          : "範囲未指定";
      const endpoint = withBasePath(basePath, `/api/v1/scenes/${encodeURIComponent(visitId)}/targets/candidates/${encodeURIComponent(candidate.candidateId)}/decision`);
      const actions = isOwner
        ? `<div class="scene-candidate-actions">
            <button type="button" data-candidate-decision="adopted" data-endpoint="${escapeHtml(endpoint)}">採用する</button>
            <button type="button" data-candidate-decision="ignored" data-endpoint="${escapeHtml(endpoint)}">無視する</button>
            <button type="button" data-candidate-decision="later" data-endpoint="${escapeHtml(endpoint)}">あとで見る</button>
          </div>`
        : "";
      return `<article class="scene-candidate-card">
        <div>
          <div class="scene-target-row">
            <strong>${escapeHtml(candidate.displayName)}</strong>
            <b>${escapeHtml(current)}</b>
          </div>
          <p>${escapeHtml(candidate.note || "AIが記録対象の候補として拾ったものです。採用しても、最終同定済み扱いにはしません。")}</p>
          <div class="scene-target-meta">
            <span>${escapeHtml(confidenceLabel(candidate.confidence))}</span>
            ${candidate.rank ? `<span>${escapeHtml(candidate.rank)}</span>` : ""}
            <span>${escapeHtml(regionText)}</span>
          </div>
        </div>
        ${actions}
      </article>`;
    }).join("")}
  </div>`;
}

function renderSceneTargetForm(media: SceneTargetMedia[], isOwner: boolean): string {
  if (!isOwner) return "";
  return `<form class="scene-target-form" data-scene-target-form>
    <div class="scene-target-form-head">
      <div>
        <span>Manual target</span>
        <h2>記録対象を追加</h2>
      </div>
      <button type="submit">保存</button>
    </div>
    <label>対象ラベル
      <input name="label" type="text" maxlength="120" placeholder="例: 00:03-00:08 ウグイス / 右上の小さな虫" required />
    </label>
    <label>メモ
      <textarea name="memo" rows="3" maxlength="1200" placeholder="見え方、鳴き方、気になった点"></textarea>
    </label>
    <div class="scene-target-form-grid">
      <label>メディア
        <select name="assetId" data-media-select>${renderMediaOptions(media)}</select>
      </label>
      <label>種類
        <select name="targetType">
          <option value="organism">いきもの</option>
          <option value="sound">音</option>
          <option value="trace">痕跡</option>
          <option value="habitat">環境</option>
          <option value="unknown">未分類</option>
        </select>
      </label>
      <label>採用状態
        <select name="status">
          <option value="draft">下書き</option>
          <option value="adopted">採用</option>
          <option value="later">あとで見る</option>
          <option value="ignored">無視</option>
        </select>
      </label>
    </div>
    <div class="scene-target-range-grid" aria-label="画像の範囲">
      <label>X<input name="x" type="number" min="0" max="100" value="10" /></label>
      <label>Y<input name="y" type="number" min="0" max="100" value="10" /></label>
      <label>幅<input name="width" type="number" min="1" max="100" value="35" /></label>
      <label>高さ<input name="height" type="number" min="1" max="100" value="35" /></label>
    </div>
    <div class="scene-target-form-grid" aria-label="動画・音声の時間区間">
      <label>開始秒<input name="startSecond" type="number" min="0" step="0.1" placeholder="3" /></label>
      <label>終了秒<input name="endSecond" type="number" min="0" step="0.1" placeholder="8" /></label>
    </div>
    <div class="scene-target-status" data-scene-target-status>対象ラベル、メモ、範囲、時間区間を保存できます。</div>
  </form>`;
}

function renderSceneTargetScript(basePath: string, visitId: string): string {
  const endpoint = withBasePath(basePath, `/api/v1/scenes/${encodeURIComponent(visitId)}/targets`);
  return `<script>(function(){
    var form = document.querySelector('[data-scene-target-form]');
    var status = document.querySelector('[data-scene-target-status]');
    var setStatus = function(message, isError) {
      if (!status) return;
      status.textContent = message;
      status.classList.toggle('is-error', Boolean(isError));
    };
    if (form) {
      form.addEventListener('submit', function(event){
        event.preventDefault();
        var data = new FormData(form);
        var mediaSelect = form.querySelector('[data-media-select]');
        var selected = mediaSelect && mediaSelect.selectedOptions ? mediaSelect.selectedOptions[0] : null;
        var mediaKind = selected ? selected.getAttribute('data-media-kind') || 'unknown' : 'unknown';
        var body = {
          label: String(data.get('label') || ''),
          memo: String(data.get('memo') || ''),
          assetId: String(data.get('assetId') || '') || null,
          targetType: String(data.get('targetType') || 'organism'),
          mediaKind: mediaKind,
          status: String(data.get('status') || 'draft'),
          normalizedRect: {
            x: Number(data.get('x') || 0) / 100,
            y: Number(data.get('y') || 0) / 100,
            width: Number(data.get('width') || 0) / 100,
            height: Number(data.get('height') || 0) / 100,
          },
          startSecond: String(data.get('startSecond') || ''),
          endSecond: String(data.get('endSecond') || ''),
        };
        setStatus('保存しています...', false);
        fetch(${JSON.stringify(endpoint)}, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(body),
        })
        .then(function(response){ return response.json().then(function(json){ return { ok: response.ok && json && json.ok, json: json }; }); })
        .then(function(result){
          if (!result.ok) throw new Error(String((result.json && result.json.error) || 'scene_target_save_failed'));
          setStatus('このシーンの手がかりが増えました。', false);
          setTimeout(function(){ window.location.reload(); }, 600);
        })
        .catch(function(error){ setStatus('保存できませんでした: ' + String(error && error.message || 'network'), true); });
      });
    }
    Array.prototype.slice.call(document.querySelectorAll('[data-candidate-decision][data-endpoint]')).forEach(function(button){
      button.addEventListener('click', function(){
        var endpoint = button.getAttribute('data-endpoint');
        var decision = button.getAttribute('data-candidate-decision');
        if (!endpoint || !decision) return;
        var original = button.textContent;
        button.disabled = true;
        button.textContent = '保存中...';
        fetch(endpoint, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ decision: decision }),
        })
        .then(function(response){ return response.json().then(function(json){ return { ok: response.ok && json && json.ok, json: json }; }); })
        .then(function(result){
          if (!result.ok) throw new Error(String((result.json && result.json.error) || 'candidate_decision_failed'));
          var message = decision === 'adopted'
            ? '複数の観察レコードに育てられる状態になりました。'
            : decision === 'later'
              ? 'あとで見返せる対象が整理されました。'
              : 'このシーンの対象候補を整理しました。';
          button.textContent = message;
          setTimeout(function(){ window.location.reload(); }, 650);
        })
        .catch(function(error){
          button.disabled = false;
          button.textContent = original;
          alert('保存できませんでした: ' + String(error && error.message || 'network'));
        });
      });
    });
  })();</script>`;
}

function renderSceneTargetPage(options: {
  basePath: string;
  lang: SiteLang;
  workspace: SceneTargetWorkspace;
  isOwner: boolean;
}): string {
  const { basePath, lang, workspace, isOwner } = options;
  const visit = workspace.visit;
  const observationHref = appendLangToHref(withBasePath(basePath, `/observations/${encodeURIComponent(visit.visitId)}`), lang);
  const notesHref = appendLangToHref(withBasePath(basePath, "/notes"), lang);
  return renderSiteDocument({
    basePath,
    title: "記録対象を整理する | ikimon",
    activeNav: "シーン",
    lang,
    currentPath: appendLangToHref(withBasePath(basePath, `/scenes/${encodeURIComponent(visit.visitId)}/targets`), lang),
    shellClassName: "shell-scene-targets",
    extraStyles: SCENE_TARGET_STYLES,
    body: `<section class="scene-target-shell" data-scene-target-workbench>
      <header class="scene-target-hero">
        <div>
          <span>Scene targets</span>
          <h1>記録対象を整理する</h1>
          <p>シーンは、写真・動画・音声・場所・時間・周辺文脈のまとまりです。ここで切り出した記録対象は、あとで観察レコードに育てられる候補として残します。</p>
          <div class="scene-target-actions">
            <a href="${escapeHtml(observationHref)}">観察レコード詳細へ</a>
            <a href="${escapeHtml(notesHref)}">シーンライブラリへ</a>
          </div>
        </div>
        <div class="scene-target-feedback">
          <strong>評価軸</strong>
          <span>このシーンの手がかりが増えました</span>
          <span>あとで見返せる対象が整理されました</span>
          <span>複数の観察レコードに育てられる状態になりました</span>
        </div>
      </header>
      <section class="scene-target-layout">
        <div class="scene-target-media-panel">
          ${renderMediaPreview(workspace)}
        </div>
        <aside class="scene-target-side">
          ${renderSceneTargetForm(workspace.media, isOwner)}
          <section class="scene-target-panel">
            <div class="scene-target-panel-head">
              <span>Current targets</span>
              <h2>このシーンの記録対象</h2>
            </div>
            ${renderTargets(workspace.targets)}
          </section>
        </aside>
      </section>
      <section class="scene-target-panel">
        <div class="scene-target-panel-head">
          <span>AI candidates</span>
          <h2>記録対象の候補</h2>
          <p>AI候補は自動で観察レコード化しません。採用、無視、あとで見るをキミが選びます。採用しても最終同定済みにはしません。</p>
        </div>
        ${renderCandidates(basePath, visit.visitId, workspace.candidates, isOwner)}
      </section>
      ${renderSceneTargetScript(basePath, visit.visitId)}
    </section>`,
    footerNote: "シーン、記録対象、観察レコードを分けることで、1つの場面から複数の研究利用可能な記録へ育てられます。",
  });
}

const SCENE_TARGET_STYLES = `
  .shell.shell-scene-targets { max-width: 1240px; }
  .scene-target-shell { display: grid; gap: 18px; }
  .scene-target-hero {
    display: grid;
    grid-template-columns: minmax(0, .68fr) minmax(280px, .32fr);
    gap: 16px;
    align-items: stretch;
    padding: clamp(20px, 3vw, 34px);
    border-radius: 8px;
    background: #f8fafc;
    border: 1px solid rgba(15,23,42,.08);
  }
  .scene-target-hero span, .scene-target-panel-head span, .scene-target-form-head span { color: #047857; font-size: 12px; font-weight: 950; }
  .scene-target-hero h1 { margin: 8px 0 0; color: #10251a; font-size: clamp(32px, 4.4vw, 54px); line-height: 1.08; letter-spacing: 0; }
  .scene-target-hero p { margin: 12px 0 0; color: #475569; line-height: 1.75; font-weight: 720; }
  .scene-target-actions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 16px; }
  .scene-target-actions a, .scene-target-form button, .scene-candidate-actions button {
    min-height: 42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 1px solid rgba(15,23,42,.10);
    padding: 9px 13px;
    background: #fff;
    color: #064e3b;
    font: inherit;
    font-size: 13px;
    font-weight: 950;
    text-decoration: none;
    cursor: pointer;
  }
  .scene-target-actions a:first-child, .scene-target-form button, .scene-candidate-actions button:first-child { background: #064e3b; border-color: #064e3b; color: #fff; }
  .scene-target-feedback { display: grid; gap: 8px; padding: 16px; border-radius: 8px; background: #10251a; color: #fff; }
  .scene-target-feedback strong { font-size: 13px; }
  .scene-target-feedback span { min-height: 34px; display: flex; align-items: center; padding: 8px 10px; border-radius: 8px; background: rgba(255,255,255,.08); color: #ecfdf5; }
  .scene-target-layout { display: grid; grid-template-columns: minmax(0, .62fr) minmax(340px, .38fr); gap: 18px; align-items: start; }
  .scene-target-media-panel, .scene-target-panel, .scene-target-form {
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 14px 34px rgba(15,23,42,.06);
  }
  .scene-target-preview { position: relative; overflow: hidden; min-height: 420px; display: grid; place-items: center; background: #0f172a; border-radius: 8px; }
  .scene-target-preview img, .scene-target-preview video { width: 100%; height: 100%; max-height: 72vh; object-fit: contain; }
  .scene-target-preview audio { width: min(92%, 620px); }
  .scene-target-empty-preview { min-height: 360px; display: grid; place-items: center; gap: 6px; text-align: center; color: #475569; }
  .scene-target-box { position: absolute; border: 2px solid #34d399; background: rgba(16,185,129,.13); border-radius: 6px; pointer-events: none; }
  .scene-target-box b { position: absolute; left: 0; bottom: 100%; min-width: max-content; padding: 4px 7px; border-radius: 6px 6px 0 0; background: #064e3b; color: #fff; font-size: 11px; }
  .scene-target-box.is-ignored { border-color: #94a3b8; background: rgba(148,163,184,.14); }
  .scene-target-side { display: grid; gap: 14px; }
  .scene-target-form, .scene-target-panel { padding: 16px; display: grid; gap: 14px; }
  .scene-target-form-head, .scene-target-panel-head, .scene-target-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .scene-target-panel-head { align-items: flex-start; }
  .scene-target-panel-head h2, .scene-target-form-head h2 { margin: 4px 0 0; color: #10251a; font-size: 22px; line-height: 1.25; }
  .scene-target-panel-head p { margin: 8px 0 0; color: #64748b; line-height: 1.65; font-size: 13px; font-weight: 720; }
  .scene-target-form label { display: grid; gap: 6px; color: #334155; font-size: 12px; font-weight: 900; }
  .scene-target-form input, .scene-target-form textarea, .scene-target-form select {
    width: 100%;
    min-height: 42px;
    border: 1px solid rgba(15,23,42,.12);
    border-radius: 8px;
    padding: 9px 10px;
    font: inherit;
    color: #0f172a;
    background: #fff;
  }
  .scene-target-form-grid, .scene-target-range-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 9px; }
  .scene-target-range-grid { grid-template-columns: repeat(4, minmax(0,1fr)); }
  .scene-target-status { min-height: 38px; padding: 9px 10px; border-radius: 8px; background: #ecfdf5; color: #065f46; font-size: 12px; font-weight: 850; }
  .scene-target-status.is-error { background: #fef2f2; color: #991b1b; }
  .scene-target-list, .scene-candidate-list { display: grid; gap: 10px; }
  .scene-target-empty { padding: 16px; border-radius: 8px; background: #f8fafc; color: #64748b; font-weight: 780; }
  .scene-target-item, .scene-candidate-card {
    display: grid;
    gap: 10px;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid rgba(15,23,42,.08);
    background: #f8fafc;
  }
  .scene-target-item.is-adopted { border-color: rgba(16,185,129,.34); background: #ecfdf5; }
  .scene-target-item.is-ignored { opacity: .78; }
  .scene-target-row strong { color: #0f172a; font-size: 15px; line-height: 1.35; }
  .scene-target-row b { padding: 4px 8px; border-radius: 999px; background: #fff; color: #064e3b; font-size: 11px; }
  .scene-target-item p, .scene-candidate-card p { margin: 6px 0 0; color: #475569; line-height: 1.6; font-size: 13px; font-weight: 700; }
  .scene-target-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
  .scene-target-meta span, .scene-target-ai { padding: 4px 7px; border-radius: 999px; background: #fff; color: #334155; font-size: 11px; font-weight: 850; }
  .scene-target-ai { width: fit-content; margin-top: 8px; border-radius: 8px; }
  .scene-candidate-card { grid-template-columns: minmax(0, 1fr) auto; align-items: center; background: #ffffff; }
  .scene-candidate-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
  .scene-candidate-actions button:disabled { opacity: .62; cursor: wait; }
  @media (max-width: 960px) {
    .scene-target-hero, .scene-target-layout, .scene-candidate-card { grid-template-columns: 1fr; }
    .scene-target-preview { min-height: 300px; }
    .scene-target-form-grid, .scene-target-range-grid { grid-template-columns: 1fr 1fr; }
    .scene-candidate-actions { justify-content: stretch; }
    .scene-candidate-actions button { flex: 1 1 120px; }
  }
`;

export async function registerSceneTargetRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string }; Querystring: { userId?: string } }>("/scenes/:id/targets", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const session = await getSessionFromCookie(request.headers.cookie).catch(() => null);
    const { viewerUserId } = resolveViewer(request.query, session);
    const workspace = await getSceneTargetWorkspace(request.params.id);
    if (!workspace) {
      reply.code(404).type("text/html; charset=utf-8");
      return renderSiteDocument({
        basePath,
        title: "シーンが見つかりません | ikimon",
        activeNav: "シーン",
        lang,
        body: `<section class="section"><div class="card"><div class="card-body"><h1>シーンが見つかりません</h1><p>リンクが古い、またはシーンが削除されています。</p></div></div></section>`,
      });
    }
    const isOwner = Boolean(viewerUserId && workspace.visit.observerUserId === viewerUserId);
    if (!isOwner) {
      reply.code(viewerUserId ? 403 : 401).type("text/html; charset=utf-8");
      return renderSiteDocument({
        basePath,
        title: "記録対象の整理にはログインが必要です | ikimon",
        activeNav: "シーン",
        lang,
        body: `<section class="section"><div class="card"><div class="card-body"><h1>記録対象の整理にはログインが必要です</h1><p>この画面では、シーン内の対象候補を編集します。記録者としてログインしてください。</p><div class="actions"><a class="btn btn-solid" href="${escapeHtml(appendLangToHref(withBasePath(basePath, `/login?redirect=${encodeURIComponent(`/scenes/${workspace.visit.visitId}/targets`)}`), lang))}">ログインする</a><a class="btn secondary" href="${escapeHtml(appendLangToHref(withBasePath(basePath, `/observations/${workspace.visit.visitId}`), lang))}">観察レコードを見る</a></div></div></div></section>`,
      });
    }
    reply.type("text/html; charset=utf-8");
    return renderSceneTargetPage({ basePath, lang, workspace, isOwner });
  });

  app.post<{
    Params: { id: string };
    Body: {
      targetId?: string | null;
      assetId?: string | null;
      targetType?: string | null;
      mediaKind?: string | null;
      label?: string | null;
      memo?: string | null;
      normalizedRect?: unknown;
      startSecond?: unknown;
      endSecond?: unknown;
      status?: string | null;
    };
  }>("/api/v1/scenes/:id/targets", async (request, reply) => {
    try {
      assertSameOriginRequest(request);
      const session = await getSessionFromCookie(request.headers.cookie);
      if (!session) throw new Error("session_required");
      const target = await upsertSceneTarget({
        sceneId: request.params.id,
        actorUserId: session.userId,
        targetId: request.body?.targetId,
        assetId: request.body?.assetId,
        targetType: request.body?.targetType,
        mediaKind: request.body?.mediaKind,
        label: request.body?.label,
        memo: request.body?.memo,
        normalizedRect: request.body?.normalizedRect,
        startSecond: request.body?.startSecond,
        endSecond: request.body?.endSecond,
        status: request.body?.status,
      });
      return { ok: true, target };
    } catch (error) {
      reply.code(routeErrorStatus(error, 400));
      return { ok: false, error: error instanceof Error ? error.message : "scene_target_save_failed" };
    }
  });

  app.post<{
    Params: { id: string; candidateId: string };
    Body: { decision?: "adopted" | "ignored" | "later" };
  }>("/api/v1/scenes/:id/targets/candidates/:candidateId/decision", async (request, reply) => {
    try {
      assertSameOriginRequest(request);
      const session = await getSessionFromCookie(request.headers.cookie);
      if (!session) throw new Error("session_required");
      const decision = request.body?.decision;
      if (decision !== "adopted" && decision !== "ignored" && decision !== "later") {
        throw new Error("invalid_scene_target_decision");
      }
      const target = await decideSceneCandidate({
        sceneId: request.params.id,
        candidateId: request.params.candidateId,
        decision,
        actorUserId: session.userId,
      });
      return { ok: true, target };
    } catch (error) {
      reply.code(routeErrorStatus(error, 400));
      return { ok: false, error: error instanceof Error ? error.message : "scene_target_candidate_decision_failed" };
    }
  });
}
