import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl } from "../i18n.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { assertSpecialistSession } from "../services/writeGuards.js";
import { resolveViewer } from "../services/viewerIdentity.js";
import { getLandingSnapshot } from "../services/landingSnapshot.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";
import { OBSERVATION_CARD_STYLES, renderObservationCard } from "../ui/observationCard.js";
import { getObservationContext, groupFeaturesByLayer } from "../services/observationContext.js";
import {
  getExploreSnapshot,
  getHomeSnapshot,
  getObservationDetailSnapshot,
  getProfileSnapshot,
  getSpecialistSnapshot,
} from "../services/readModels.js";
import {
  MAP_MINI_STYLES,
  mapMiniBootScript,
  renderMapMini,
  toMapPoints,
} from "../ui/mapMini.js";
import {
  MAP_EXPLORER_STYLES,
  mapExplorerBootScript,
  renderMapExplorer,
} from "../ui/mapExplorer.js";
import { GUIDE_FLOW_STYLES, renderGuideFlow } from "../ui/guideFlow.js";

type LayoutHero = {
  eyebrow: string;
  heading: string;
  headingHtml?: string;
  lead: string;
  actions?: Array<{ href: string; label: string; variant?: "primary" | "secondary" }>;
};

function layout(
  basePath: string,
  title: string,
  body: string,
  activeNav: string,
  hero?: LayoutHero,
  extraStyles?: string,
): string {
  return renderSiteDocument({
    basePath,
    title,
    activeNav,
    body,
    hero: hero
      ? {
          eyebrow: hero.eyebrow,
          heading: hero.heading,
          headingHtml: hero.headingHtml ?? hero.heading,
          lead: hero.lead,
          tone: "light",
          align: "center",
          actions: hero.actions,
        }
      : undefined,
    extraStyles,
    footerNote: "いつもの道で見つけた自然を、あとで見返せる形に残す。",
  });
}

/** Small inline "state" card for 401 / 404 states — replaces the old dark-hero div. */
function stateCard(eyebrow: string, title: string, body: string): string {
  return `<section class="section">
    <div class="card is-soft">
      <div class="eyebrow">${escapeHtml(eyebrow)}</div>
      <h2 style="margin-top:8px">${escapeHtml(title)}</h2>
      <p style="margin-top:8px;color:#475569;line-height:1.7">${body}</p>
    </div>
  </section>`;
}

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

export async function registerReadRoutes(app: FastifyInstance): Promise<void> {
  app.get("/record", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const session = await getSessionFromCookie(request.headers.cookie);
    const resolution = resolveViewer(request.query, session);
    const viewerUserId = resolution.viewerUserId ?? "";
    const queryUserId = resolution.queryOverrideHonored ? resolution.requestedUserId : "";
    if (!viewerUserId) {
      reply.code(401).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "Session required",
        stateCard(
          "Session required",
          "記録するにはサインインが必要です",
          `<p style="margin:0 0 12px">ログイン済みのセッションがまだありません。</p>
          <div class="actions" style="margin-top:16px">
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/"))}">トップへ戻る</a>
            <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/faq"))}">サインイン方法</a>
          </div>
          ${process.env.ALLOW_QUERY_USER_ID === "1" ? `<p class="meta" style="margin-top:16px;font-size:12px;color:#94a3b8">staging QA: <code>${escapeHtml(withBasePath(basePath, "/record?userId=..."))}</code></p>` : ""}`,
        ),
        "Record",
      );
    }

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "ikimon v2 record",
      `<section class="record-page">
        <div class="record-shell">
          <section class="record-card record-sheet">
            <div class="record-card-head">
              <div>
                <div class="eyebrow">Quick capture</div>
                <h2>観察を 1 ページとして残す</h2>
                <p class="meta">場所・時刻・名前の仮説を最小入力で残し、あとからノートで育てる前提の入力画面です。</p>
              </div>
              <div class="record-session-pill">
                <span class="record-session-label">Signed in</span>
                <strong>${escapeHtml(viewerUserId)}</strong>
              </div>
            </div>
            <form id="record-form" data-user-id="${escapeHtml(viewerUserId)}" class="record-form">
              <label class="record-field record-field-wide"><span class="record-label">観察した日時</span><input id="observedAt" name="observedAt" type="datetime-local" required /></label>
              <div class="record-field record-field-wide record-gps-row">
                <span class="record-label">現在地</span>
                <button type="button" class="btn btn-ghost record-gps-btn" onclick="navigator.geolocation.getCurrentPosition(function(p){document.querySelector('[name=latitude]').value=p.coords.latitude.toFixed(6);document.querySelector('[name=longitude]').value=p.coords.longitude.toFixed(6);},function(){alert('位置情報の取得に失敗しました。手動で入力してください。')})">現在地を自動取得</button>
                <div class="record-gps-inputs">
                  <label class="record-field"><span class="record-label">緯度</span><input name="latitude" type="number" step="0.000001" placeholder="自動取得 or 手入力" required /></label>
                  <label class="record-field"><span class="record-label">経度</span><input name="longitude" type="number" step="0.000001" placeholder="自動取得 or 手入力" required /></label>
                </div>
              </div>
              <label class="record-field"><span class="record-label">市区町村</span><input name="municipality" type="text" placeholder="例: 浜松市" /></label>
              <label class="record-field record-field-wide"><span class="record-label">場所のメモ</span><input name="localityNote" type="text" placeholder="例: 公園の入口付近 / 水辺の柵のそば" /></label>
              <label class="record-field"><span class="record-label">生きもの名（分かれば）</span><input name="scientificName" type="text" placeholder="例: スズメ / Passer montanus" /></label>
              <label class="record-field"><span class="record-label">和名 / 通称</span><input name="vernacularName" type="text" placeholder="例: スズメ" /></label>
              <label class="record-field"><span class="record-label">確信度</span><input name="rank" type="text" value="species" placeholder="species / genus / family" /></label>
              <label class="record-field record-field-wide record-photo-field"><span class="record-label">写真</span><input id="record-photo" name="photo" type="file" accept="image/*" /><span class="record-help">写真は観察の証拠として保存できます。未添付でも記録は残せます。</span></label>
              <div class="record-actions">
                <button class="btn btn-solid" type="submit">観察を記録する</button>
                <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/notes"))}">ノートへ戻る</a>
              </div>
            </form>
          </section>
          <aside class="record-sidebar">
            <section class="record-card record-preview-card">
              <div class="eyebrow">Notebook preview</div>
              <h2>この記録が残る形</h2>
              <div class="record-preview">
                <div class="record-preview-topline">
                  <span class="record-preview-kicker">field note</span>
                  <span id="record-preview-date">今日</span>
                </div>
                <h3 id="record-preview-title">名前未確定の観察</h3>
                <p id="record-preview-place">場所メモが入ると、あとから再訪理由として効きます。</p>
                <div class="record-preview-meta">
                  <span id="record-preview-municipality">自治体未入力</span>
                  <span id="record-preview-coords">34.7108, 137.7261</span>
                </div>
                <div id="record-preview-photo" class="record-preview-photo is-empty">写真プレビュー</div>
              </div>
            </section>
            <section class="record-card record-guide-card">
              <div class="eyebrow">Why this matters</div>
              <h2>この 1 件が効く理由</h2>
              <div class="list">
                <div class="row"><div><strong>再訪理由が残る</strong><div class="meta">場所メモと日時が、次に同じ道を歩く理由になる。</div></div></div>
                <div class="row"><div><strong>見分け方の仮説が残る</strong><div class="meta">写真と名前の仮説が、次に見返したときの手がかりになる。</div></div></div>
                <div class="row"><div><strong>ノートとして読み返せる</strong><div class="meta">単発投稿ではなく、前回との差分が見える履歴になる。</div></div></div>
              </div>
            </section>
            <section class="record-card">
              <div class="eyebrow">Status</div>
              <h2>送信ステータス</h2>
              <div id="record-status" class="list" style="margin-top:16px">
                <div class="row"><div>入力が完了したら送信してください。</div></div>
              </div>
            </section>
          </aside>
        </div>
      </section>
      <script>
        const basePath = ${JSON.stringify(basePath)};
        const withBasePath = (path) => basePath ? basePath + (path.startsWith('/') ? path : '/' + path) : path;
        const form = document.getElementById('record-form');
        const status = document.getElementById('record-status');
        const observedAt = document.getElementById('observedAt');
        const previewDate = document.getElementById('record-preview-date');
        const previewTitle = document.getElementById('record-preview-title');
        const previewPlace = document.getElementById('record-preview-place');
        const previewMunicipality = document.getElementById('record-preview-municipality');
        const previewCoords = document.getElementById('record-preview-coords');
        const previewPhoto = document.getElementById('record-preview-photo');
        const photoInput = document.getElementById('record-photo');
        if (observedAt && !observedAt.value) {
          const now = new Date();
          observedAt.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        }
        const setStatus = (html) => { status.innerHTML = html; };
        const syncPreview = () => {
          const data = new FormData(form);
          const scientificName = String(data.get('scientificName') || '').trim();
          const vernacularName = String(data.get('vernacularName') || '').trim();
          const localityNote = String(data.get('localityNote') || '').trim();
          const municipality = String(data.get('municipality') || '').trim();
          const latitude = String(data.get('latitude') || '').trim();
          const longitude = String(data.get('longitude') || '').trim();
          const observedAtValue = String(data.get('observedAt') || '').trim();
          previewTitle.textContent = vernacularName || scientificName || '名前未確定の観察';
          previewPlace.textContent = localityNote || '場所メモが入ると、あとから再訪理由として効きます。';
          previewMunicipality.textContent = municipality || '自治体未入力';
          previewCoords.textContent = latitude && longitude ? latitude + ', ' + longitude : '座標未入力';
          previewDate.textContent = observedAtValue ? new Date(observedAtValue).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }) : '今日';
        };
        form.addEventListener('input', syncPreview);
        if (photoInput && previewPhoto) {
          photoInput.addEventListener('change', () => {
            const file = photoInput.files && photoInput.files[0];
            if (!file) {
              previewPhoto.className = 'record-preview-photo is-empty';
              previewPhoto.innerHTML = '写真プレビュー';
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              previewPhoto.className = 'record-preview-photo';
              previewPhoto.innerHTML = '<img src="' + String(reader.result || '') + '" alt="preview" />';
            };
            reader.readAsDataURL(file);
          });
        }
        syncPreview();
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const data = new FormData(form);
          const userId = form.dataset.userId || '';
          const observationId = 'record-' + Date.now();
          if (!userId) {
            setStatus('<div class="row"><div>User context is missing.</div></div>');
            return;
          }
          setStatus('<div class="row"><div>記録を送信中...</div></div>');
          try {
            const payload = {
              observationId,
              legacyObservationId: observationId,
              userId,
              observedAt: new Date(String(data.get('observedAt'))).toISOString(),
              latitude: Number(data.get('latitude')),
              longitude: Number(data.get('longitude')),
              prefecture: 'Shizuoka',
              municipality: String(data.get('municipality') || ''),
              localityNote: String(data.get('localityNote') || ''),
              note: '',
              sourcePayload: { source: 'v2_web' },
              taxon: {
                scientificName: String(data.get('scientificName') || ''),
                vernacularName: String(data.get('vernacularName') || ''),
                rank: String(data.get('rank') || ''),
              },
            };
            const observationResponse = await fetch(withBasePath('/api/v1/observations/upsert'), {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify(payload),
            });
            const observationJson = await observationResponse.json();
            if (!observationResponse.ok) {
              throw new Error(observationJson.error || 'observation_upsert_failed');
            }
            const file = data.get('photo');
            if (file instanceof File && file.size > 0) {
              const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(new Error('file_read_failed'));
                reader.readAsDataURL(file);
              });
              const photoResponse = await fetch(withBasePath('/api/v1/observations/' + encodeURIComponent(observationId) + '/photos/upload'), {
                method: 'POST',
                headers: { 'content-type': 'application/json', accept: 'application/json' },
                body: JSON.stringify({
                  filename: file.name || 'upload.jpg',
                  mimeType: file.type || 'image/jpeg',
                  base64Data,
                }),
              });
              const photoJson = await photoResponse.json();
              if (!photoResponse.ok) {
                throw new Error(photoJson.error || 'photo_upload_failed');
              }
            }
            setStatus('<div class="row"><div><strong>記録を保存しました。</strong><div class="meta"><a href=\"' + withBasePath('/observations/' + encodeURIComponent(observationId)) + '\">観察を見る</a> · <a href=\"' + withBasePath('/notes') + '\">ノートへ戻る</a></div></div></div>');
            form.reset();
            if (observedAt) {
              const now = new Date();
              observedAt.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            }
          } catch (error) {
            setStatus('<div class="row"><div>送信に失敗しました。<div class="meta">' + String(error.message || error) + '</div></div></div>');
          }
        });
      </script>`,
      "Record",
      {
        eyebrow: "記録する",
        heading: "今日の 1 ページを書く",
        lead: "観察した場所・時刻・気づいた生きものを、そのまま 1 件のノートに残します。まずは再訪できる形で残すことを優先します。",
        actions: [
          { href: queryUserId ? `/home?userId=${encodeURIComponent(viewerUserId)}` : "/home", label: "ホーム" },
          { href: "/explore", label: "みつける", variant: "secondary" as const },
        ],
      },
      `
        .record-page { margin-top: 24px; }
        .record-shell { display: grid; grid-template-columns: 1fr; gap: 18px; align-items: start; max-width: 860px; }
        .record-card { border-radius: 28px; background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(248,250,252,.92)); border: 1px solid rgba(15,23,42,.06); box-shadow: 0 16px 36px rgba(15,23,42,.06); padding: 24px; }
        .record-sheet { position: relative; overflow: hidden; }
        .record-sheet::before { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(180deg, transparent 0, transparent 34px, rgba(14,165,233,.05) 35px, transparent 36px); pointer-events: none; }
        .record-sheet::after { content: ""; position: absolute; inset: 0 auto 0 20px; width: 2px; background: linear-gradient(180deg, rgba(239,68,68,.28), rgba(239,68,68,.14)); pointer-events: none; }
        .record-sheet > * { position: relative; z-index: 1; }
        .record-card-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 18px; padding-left: 16px; }
        .record-card-head h2 { margin: 10px 0 0; font-size: clamp(24px, 2.8vw, 34px); line-height: 1.26; letter-spacing: -.02em; }
        .record-session-pill { display: inline-flex; flex-direction: column; gap: 4px; padding: 12px 16px; border-radius: 18px; background: rgba(255,255,255,.86); border: 1px solid rgba(15,23,42,.08); min-width: 180px; }
        .record-session-label { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
        .record-session-pill strong { font-size: 14px; color: #0f172a; word-break: break-all; }
        .record-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; padding-left: 16px; }
        .record-field { display: flex; flex-direction: column; gap: 8px; }
        .record-field-wide { grid-column: 1 / -1; }
        .record-label { font-weight: 800; color: #0f172a; font-size: 14px; }
        .record-help { font-size: 12px; line-height: 1.6; color: #64748b; }
        .record-photo-field input[type="file"] { padding: 14px; border-style: dashed; }
        .record-actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 12px; padding-top: 4px; }
        .record-sidebar { display: grid; gap: 18px; }
        .record-preview-card h2, .record-guide-card h2 { margin: 10px 0 0; font-size: 22px; line-height: 1.3; }
        .record-preview {
          margin-top: 16px;
          padding: 20px 20px 18px 24px;
          border-radius: 24px;
          background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,250,252,.96));
          border: 1px solid rgba(15,23,42,.06);
          position: relative;
          overflow: hidden;
        }
        .record-preview::before { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(180deg, transparent 0, transparent 30px, rgba(14,165,233,.06) 31px, transparent 32px); pointer-events: none; }
        .record-preview::after { content: ""; position: absolute; inset: 0 auto 0 16px; width: 2px; background: linear-gradient(180deg, rgba(239,68,68,.24), rgba(239,68,68,.12)); pointer-events: none; }
        .record-preview > * { position: relative; z-index: 1; }
        .record-preview-topline { display: flex; justify-content: space-between; gap: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: #64748b; font-weight: 800; }
        .record-preview-kicker { color: #059669; }
        .record-preview h3 { margin: 14px 0 10px; font-size: 24px; line-height: 1.3; letter-spacing: -.02em; }
        .record-preview p { margin: 0; color: #475569; line-height: 1.8; }
        .record-preview-meta { display: flex; flex-wrap: wrap; gap: 8px 12px; margin-top: 14px; color: #334155; font-size: 13px; font-weight: 700; }
        .record-preview-photo { margin-top: 16px; min-height: 160px; border-radius: 20px; overflow: hidden; background: linear-gradient(135deg, rgba(16,185,129,.12), rgba(14,165,233,.12)); border: 1px solid rgba(14,165,233,.12); display: grid; place-items: center; color: #0f172a; font-weight: 800; }
        .record-preview-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .record-preview-photo.is-empty { color: #475569; font-size: 13px; }
        @media (max-width: 720px) {
          .record-card { padding: 20px; border-radius: 24px; }
          .record-form { grid-template-columns: 1fr; padding-left: 0; }
          .record-card-head { padding-left: 0; }
          .record-sheet::after, .record-preview::after { display: none; }
        }
      `,
    );
  });

  app.get("/explore", async (_request, reply) => {
    const basePath = requestBasePath(_request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((_request as unknown as { url?: string }).url ?? ""));
    const snapshot = await getExploreSnapshot();
    const cards = snapshot.recentObservations.map((item) =>
      renderObservationCard(basePath, lang, {
        occurrenceId: item.occurrenceId,
        visitId: item.visitId,
        displayName: item.displayName,
        observedAt: item.observedAt,
        observerName: item.observerName,
        placeName: item.placeName,
        municipality: item.municipality,
        photoUrl: item.photoUrl,
        identificationCount: item.identificationCount,
        latitude: null,
        longitude: null,
        observerUserId: null,
        observerAvatarUrl: null,
      }),
    ).join("");
    const municipalities = snapshot.municipalities.map((item) => `
      <div class="row">
        <div>
          <div style="font-weight:800">${escapeHtml(item.municipality)}</div>
          <div class="meta">観察クラスター</div>
        </div>
        <span class="pill">${item.observationCount} 件</span>
      </div>`).join("");
    const taxa = snapshot.topTaxa.map((item) => `
      <div class="row">
        <div>
          <div style="font-weight:800">${escapeHtml(item.displayName)}</div>
          <div class="meta">よく観察されている種</div>
        </div>
        <span class="pill">${item.observationCount} 件</span>
      </div>`).join("");

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "みつける | ikimon",
      `<section class="section">
        <div class="grid">
          <div class="card"><div class="card-body"><div class="eyebrow">また見に行ける場所</div><div class="list">${municipalities || '<div class="row"><div>まだ場所データがありません。</div></div>'}</div></div></div>
          <div class="card"><div class="card-body"><div class="eyebrow">そこで目立つ生きもの</div><div class="list">${taxa || '<div class="row"><div>まだ種データがありません。</div></div>'}</div></div></div>
        </div>
      </section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">直近の観察</div><h2>次に歩く理由を探す</h2></div></div><div class="explore-grid">${cards || '<div class="card"><div class="card-body">まだ観察がありません。</div></div>'}</div></section>`,
      "みつける",
      {
        eyebrow: "みつける",
        heading: "次に歩く場所を探す",
        lead: "場所ごとの観察の積み重なりから、どこを再訪すると発見が増えそうかを見つけます。",
        actions: [
          { href: "/map", label: "マップで見る" },
          { href: "/notes", label: "ノートに戻る", variant: "secondary" as const },
        ],
      },
      `${OBSERVATION_CARD_STYLES}
        .explore-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; }
        @media (max-width: 860px) { .explore-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        @media (max-width: 480px) { .explore-grid { grid-template-columns: 1fr; } }
      `,
    );
  });

  app.get("/home", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const session = await getSessionFromCookie(request.headers.cookie);
    const { viewerUserId } = resolveViewer(request.query, session);
    const snapshot = await getHomeSnapshot(viewerUserId);
    const cards = snapshot.recentObservations.map((item) =>
      renderObservationCard(basePath, lang, {
        occurrenceId: item.occurrenceId,
        visitId: item.visitId,
        displayName: item.displayName,
        observedAt: item.observedAt,
        observerName: item.observerName,
        placeName: item.placeName,
        municipality: item.municipality,
        photoUrl: item.photoUrl,
        identificationCount: item.identificationCount,
        latitude: null,
        longitude: null,
        observerUserId: null,
        observerAvatarUrl: null,
      }),
    ).join("");
    const myPlaces = snapshot.myPlaces.map((place) => `
      <a class="row" href="${escapeHtml(withBasePath(basePath, `/profile/${encodeURIComponent(snapshot.viewerUserId || "")}`))}">
        <div>
          <div style="font-weight:800">${escapeHtml(place.placeName)}</div>
          <div class="meta">${escapeHtml(place.municipality || "自治体不明")} · 前回 ${escapeHtml(place.lastObservedAt)}</div>
        </div>
        <span class="pill">${place.visitCount} 回</span>
      </a>`).join("");
    const revisitCue = snapshot.myPlaces[0]
      ? `${snapshot.myPlaces[0].placeName} を起点に、前回の記録と今季の変化を見返せます。`
      : "まず1件記録すると、場所ごとの再訪理由が育ち始めます。";
    const growthCue = snapshot.recentObservations[0]
      ? `${snapshot.recentObservations[0].displayName} のような最近の観察から、前回より細かく見られた点を積み上げます。`
      : "観察履歴がたまるほど、前回からの成長と見分けポイントが読み返しやすくなります。";

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "ホーム | ikimon",
      `<section class="section">
        <div class="grid">
          <div class="card has-accent is-soft"><div class="card-body"><div class="eyebrow">今回の学び</div><h2>前回より見えた点</h2><p class="meta">${escapeHtml(growthCue)}</p></div></div>
          <div class="card has-accent is-soft"><div class="card-body"><div class="eyebrow">また行く理由</div><h2>次に訪れる場所</h2><p class="meta">${escapeHtml(revisitCue)}</p></div></div>
          <div class="card is-soft"><div class="card-body"><div class="eyebrow">積み上がる意味</div><h2>長く残る観察</h2><p class="meta">今日の観察は、次に見返すための記録であり、長い時間の自然アーカイブにもなっていきます。</p></div></div>
        </div>
      </section>
      ${snapshot.viewerUserId ? `<section class="section"><div class="section-header"><div><div class="eyebrow">よく歩く場所</div><h2>再訪したい場所</h2></div></div><div class="list">${myPlaces || '<div class="row"><div>まだ記録した場所はありません。</div></div>'}</div></section>` : ""}
      <section class="section"><div class="section-header"><div><div class="eyebrow">ノート</div><h2>最近の観察</h2></div></div><div class="home-grid">${cards}</div></section>`,
      "ホーム",
      {
        eyebrow: "再訪のホーム",
        heading: "前回より、少し見えるようになる",
        lead: "前回からの気づきと、また行きたくなる場所をまとめて返すホームです。",
        actions: [
          { href: "/notes", label: "ノートへ" },
          { href: "/record", label: "1 件記録する", variant: "secondary" as const },
        ],
      },
      `${OBSERVATION_CARD_STYLES}
        .home-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
      `,
    );
  });

  app.get<{ Params: { id: string } }>("/observations/:id", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const snapshot = await getObservationDetailSnapshot(request.params.id);
    if (!snapshot) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Observation not found", stateCard("見つかりません", "この観察はまだ取得できません", "リンクが古い、または観察が削除されている可能性があります。"), "みつける");
    }
    const photos = snapshot.photoUrls.map((url) => `<div class="obs-detail-photo"><img src="${escapeHtml(url)}" alt="${escapeHtml(snapshot.displayName)}" loading="lazy" onerror="this.closest('.obs-detail-photo').classList.add('is-broken');" /><span class="obs-detail-photo-fallback">📷 ${escapeHtml(snapshot.displayName)} / 写真なし</span></div>`).join("");
    const ids = snapshot.identifications.map((item) => `
      <div class="row">
        <div>
          <div style="font-weight:800">${escapeHtml(item.proposedName)}</div>
          <div class="meta">${escapeHtml(item.actorName)} · ${escapeHtml(item.createdAt)}${item.proposedRank ? ` · ${escapeHtml(item.proposedRank)}` : ""}</div>
          ${item.notes ? `<div class="meta">${escapeHtml(item.notes)}</div>` : ""}
        </div>
      </div>`).join("");
    const unresolvedReason = snapshot.identifications.length === 0
      ? "まだ正式な同定は付いていません。今は写真で分かる範囲で止めておくのが正しい状態です。"
      : snapshot.scientificName
        ? "候補は出ていますが、もう少し良い角度の写真や追加の観察があると根拠が厚くなります。"
        : "候補はありますが、急いで種まで断定せず、もう一度観察するのが安心です。";

    // Phase D: フィールドノート 3層構造。同 visit / 同 place の guide_records + audio_detections を折り畳み表示。
    const obsContext = await getObservationContext(request.params.id, snapshot.visitId ?? null, null).catch(() => null);
    const grouped = obsContext ? groupFeaturesByLayer(obsContext.features) : { coexistingTaxa: [], environment: [], sounds: [] };
    const renderFeatureChips = (list: typeof grouped.coexistingTaxa): string =>
      list
        .map(
          (f) => `<li class="obs-chip" title="${escapeHtml(f.note ?? "")}"><span class="obs-chip-name">${escapeHtml(f.name)}</span>${
            typeof f.confidence === "number" ? `<span class="obs-chip-conf">${Math.round(f.confidence * 100)}%</span>` : ""
          }<span class="obs-chip-src">${f.sourceKind === "audio" ? "🎤" : "📷"}</span></li>`,
        )
        .join("");
    const coexistingSection = grouped.coexistingTaxa.length > 0
      ? `<details class="obs-fold" open>
           <summary>🌿 同地点の生きもの <span class="obs-fold-count">${grouped.coexistingTaxa.length}</span></summary>
           <p class="meta obs-fold-hint">写真 (AI フィールドガイド) や音声が拾った主種以外の記録。属・科レベル含む。</p>
           <ul class="obs-chips">${renderFeatureChips(grouped.coexistingTaxa)}</ul>
         </details>`
      : "";
    const soundsSection = grouped.sounds.length > 0
      ? `<details class="obs-fold">
           <summary>🎤 音声で拾った生きもの <span class="obs-fold-count">${grouped.sounds.length}</span></summary>
           <p class="meta obs-fold-hint">鳴き声・環境音の検出結果。将来の再同定用に位置情報付きで保存されている。</p>
           <ul class="obs-chips">${renderFeatureChips(grouped.sounds)}</ul>
         </details>`
      : "";
    const storyBits: string[] = [];
    if (obsContext && obsContext.environmentContexts.length > 0) storyBits.push(...obsContext.environmentContexts.map((s) => `<p class="meta">${escapeHtml(s)}</p>`));
    if (obsContext && obsContext.seasonalNotes.length > 0) storyBits.push(...obsContext.seasonalNotes.map((s) => `<p class="meta">${escapeHtml(s)}</p>`));
    if (grouped.environment.length > 0) storyBits.push(`<ul class="obs-chips">${renderFeatureChips(grouped.environment)}</ul>`);
    const storySection = storyBits.length > 0
      ? `<details class="obs-fold">
           <summary>🏞️ 場所の物語 <span class="obs-fold-count">${storyBits.length}</span></summary>
           <p class="meta obs-fold-hint">EXIF・環境文脈・季節から推論されるその場所の状況。</p>
           ${storyBits.join("")}
         </details>`
      : "";
    const layerBlock = coexistingSection || soundsSection || storySection
      ? `<section class="section obs-layer-block">${coexistingSection}${soundsSection}${storySection}</section>`
      : "";
    const retakeChecklist = [
      "全身だけでなく、決め手になる部位をもう1枚撮る",
      "同じ場所で時間を変えて再訪し、季節や行動差を取る",
      snapshot.photoUrls.length > 0 ? "今ある写真と次回写真を比べて、何が増えたかを確認する" : "まずは1枚でも写真を追加して、根拠を残す",
    ].map((item) => `<div class="row"><div>${escapeHtml(item)}</div></div>`).join("");

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      `${snapshot.displayName} | ikimon`,
      `${photos ? `<section class="section"><div class="obs-detail-gallery">${photos}</div></section>` : ""}
      <section class="section">
        <div class="grid">
          <div class="card has-accent is-soft"><div class="card-body"><div class="eyebrow">今の状態</div><h2>無理に当て切らない理由</h2><p class="meta">${escapeHtml(unresolvedReason)}</p></div></div>
          <div class="card has-accent is-soft"><div class="card-body"><div class="eyebrow">次の一歩</div><h2>次に撮ると進むこと</h2><div class="list">${retakeChecklist}</div></div></div>
          <div class="card is-soft"><div class="card-body"><div class="eyebrow">学習資産</div><h2>今回の記録の意味</h2><p class="meta">場所の変化を後から比較するための前提情報であり、同時に future AI explanation の学習データ候補です。</p></div></div>
        </div>
      </section>
      <section class="section">
        <div class="grid">
          <div class="card"><div class="card-body"><div class="eyebrow">場所</div><h2>${escapeHtml(snapshot.placeName)}</h2><p class="meta">${escapeHtml(snapshot.municipality || "自治体不明")}</p></div></div>
          <div class="card"><div class="card-body"><div class="eyebrow">学名</div><h2>${escapeHtml(snapshot.scientificName || "未確定")}</h2><p class="meta">${escapeHtml(snapshot.note || "メモなし")}</p></div></div>
        </div>
      </section>
      ${layerBlock}
      <section class="section"><div class="section-header"><div><div class="eyebrow">名前の確定まで</div><h2>Identifications</h2></div></div><div class="list">${ids || '<div class="row"><div>まだ同定が付いていません。</div></div>'}</div></section>`,
      "みつける",
      {
        eyebrow: "観察の詳細",
        heading: escapeHtml(snapshot.displayName),
        headingHtml: escapeHtml(snapshot.displayName),
        lead: `${snapshot.placeName} · ${snapshot.observedAt} · ${snapshot.observerName} さんの観察`,
        actions: [
          { href: "/map", label: "マップで見る" },
          ...(snapshot.observerUserId ? [{ href: `/profile/${encodeURIComponent(snapshot.observerUserId)}`, label: "観察者を見る", variant: "secondary" as const }] : []),
        ],
      },
      `.obs-detail-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
       .obs-detail-photo { position: relative; aspect-ratio: 4/3; border-radius: 18px; overflow: hidden; background: linear-gradient(135deg,#ecfdf5,#e0f2fe); border: 1px solid rgba(15,23,42,.06); }
       .obs-detail-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
       .obs-detail-photo-fallback { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; text-align: center; padding: 16px; color: #475569; font-size: 13px; font-weight: 700; background: repeating-linear-gradient(0deg, transparent 0 24px, rgba(15,23,42,.04) 24px 25px); }
       .obs-detail-photo.is-broken img { display: none; }
       .obs-detail-photo.is-broken .obs-detail-photo-fallback { display: flex; }
       .obs-layer-block { display: grid; gap: 12px; }
       .obs-fold { border-radius: 14px; background: #f9fafb; border: 1px solid rgba(15,23,42,.08); padding: 0; overflow: hidden; }
       .obs-fold > summary { padding: 14px 18px; font-weight: 800; color: #111827; cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 14px; }
       .obs-fold > summary::after { content: "+"; font-weight: 400; color: #9ca3af; font-size: 18px; }
       .obs-fold[open] > summary::after { content: "−"; }
       .obs-fold > summary::-webkit-details-marker { display: none; }
       .obs-fold-count { background: rgba(15,23,42,.08); color: #475569; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; margin-left: auto; }
       .obs-fold-hint { padding: 0 18px; color: #6b7280; font-size: 12.5px; line-height: 1.7; margin: 2px 0 10px; }
       .obs-fold .obs-chips { padding: 0 18px 16px; margin: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 8px; }
       .obs-chip { display: inline-flex; align-items: center; gap: 6px; background: #fff; border: 1px solid rgba(15,23,42,.1); border-radius: 999px; padding: 6px 12px; font-size: 12.5px; font-weight: 700; color: #111827; }
       .obs-chip-conf { color: #16a34a; font-weight: 800; font-size: 11px; }
       .obs-chip-src { color: #6b7280; font-size: 11px; }
      `,
    );
  });

  app.get<{ Params: { userId: string } }>("/profile/:userId", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const snapshot = await getProfileSnapshot(request.params.userId);
    if (!snapshot) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Profile not found", stateCard("プロフィールなし", "このユーザーは見つかりません", "リンクが古い、または非公開の可能性があります。"), "ホーム");
    }
    const places = snapshot.recentPlaces.map((place) => `
      <div class="row">
        <div>
          <div style="font-weight:800">${escapeHtml(place.placeName)}</div>
          <div class="meta">${escapeHtml(place.municipality || "自治体不明")} · ${escapeHtml(place.lastObservedAt)}</div>
        </div>
        <span class="pill">${place.visitCount} 回</span>
      </div>`).join("");
    const observations = snapshot.recentObservations.map((item) => `
      <a class="row" href="${escapeHtml(withBasePath(basePath, `/observations/${encodeURIComponent(item.occurrenceId)}`))}">
        <div>
          <div style="font-weight:800">${escapeHtml(item.displayName)}</div>
          <div class="meta">${escapeHtml(item.placeName)} · ${escapeHtml(item.observedAt)}</div>
        </div>
        <span class="pill">${item.identificationCount} ids</span>
      </a>`).join("");

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      `${snapshot.displayName} | ikimon`,
      `<section class="section"><div class="section-header"><div><div class="eyebrow">よく歩く場所</div><h2>最近の My places</h2></div></div><div class="list">${places || '<div class="row"><div>まだ場所の記録はありません。</div></div>'}</div></section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">ノート</div><h2>最近の観察</h2></div></div><div class="list">${observations || '<div class="row"><div>まだ観察はありません。</div></div>'}</div></section>`,
      "ホーム",
      {
        eyebrow: snapshot.rankLabel || "Observer",
        heading: snapshot.displayName,
        headingHtml: escapeHtml(snapshot.displayName),
        lead: `この人のフィールドノート — 最近の場所と観察を追う。`,
        actions: [
          { href: `/home?userId=${encodeURIComponent(snapshot.userId)}`, label: "このユーザーのホームを見る" },
        ],
      },
    );
  });

  app.get("/profile", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const session = await getSessionFromCookie(request.headers.cookie);
    if (!session) {
      reply.code(401).type("text/html; charset=utf-8");
      return layout(basePath, "サインインが必要です", stateCard("サインイン", "プロフィールの表示にはサインインが必要です", "ログイン済みのセッションがまだありません。トップページからサインインしてください。"), "ホーム");
    }
    const snapshot = await getProfileSnapshot(session.userId);
    if (!snapshot) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Profile not found", stateCard("プロフィールなし", "まだ公開できるプロフィールがありません", "観察を 1 件でも記録するとプロフィールが育ち始めます。"), "ホーム");
    }
    const places = snapshot.recentPlaces.map((place) => `
      <div class="row">
        <div>
          <div style="font-weight:800">${escapeHtml(place.placeName)}</div>
          <div class="meta">${escapeHtml(place.municipality || "自治体不明")} · ${escapeHtml(place.lastObservedAt)}</div>
        </div>
        <span class="pill">${place.visitCount} 回</span>
      </div>`).join("");
    const observations = snapshot.recentObservations.map((item) => `
      <a class="row" href="${escapeHtml(withBasePath(basePath, `/observations/${encodeURIComponent(item.occurrenceId)}`))}">
        <div>
          <div style="font-weight:800">${escapeHtml(item.displayName)}</div>
          <div class="meta">${escapeHtml(item.placeName)} · ${escapeHtml(item.observedAt)}</div>
        </div>
        <span class="pill">${item.identificationCount} ids</span>
      </a>`).join("");

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      `${snapshot.displayName} | ikimon`,
      `<section class="section"><div class="section-header"><div><div class="eyebrow">よく歩く場所</div><h2>最近の My places</h2></div></div><div class="list">${places || '<div class="row"><div>まだ場所の記録はありません。</div></div>'}</div></section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">ノート</div><h2>最近の観察</h2></div></div><div class="list">${observations || '<div class="row"><div>まだ観察はありません。</div></div>'}</div></section>`,
      "ホーム",
      {
        eyebrow: "あなたのプロフィール",
        heading: snapshot.displayName,
        headingHtml: escapeHtml(snapshot.displayName),
        lead: `${snapshot.rankLabel || "Observer"} — あなたのフィールドノートと場所の記録。`,
        actions: [
          { href: "/notes", label: "ノートへ" },
          { href: "/home", label: "ホームへ", variant: "secondary" as const },
        ],
      },
    );
  });

  app.get("/specialist/id-workbench", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const session = await getSessionFromCookie(request.headers.cookie);
    try {
      assertSpecialistSession(session, session?.userId ?? "");
    } catch {
      reply.code(403).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "Specialist access required",
        stateCard(
          "Specialist only",
          "この画面は専門家ロール専用です",
          `<p style="margin:0 0 12px">レビュー queue と同定 workbench は、サインイン済みの専門家アカウントからのみ閲覧できます。</p>
          <div class="actions" style="margin-top:16px">
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/"))}">トップへ戻る</a>
          </div>`,
        ),
        "ホーム",
      );
    }
    const requestedLane = typeof request.query === "object" && request.query && "lane" in request.query
      ? String((request.query as Record<string, unknown>).lane || "")
      : "";
    const lane = requestedLane === "public-claim" || requestedLane === "expert-lane" ? requestedLane : "default";
    const reviewerUserId = session?.userId ?? "";
    const snapshot = await getSpecialistSnapshot(lane);
    const laneTitle =
      lane === "public-claim"
        ? "Public Claim Lane"
        : lane === "expert-lane"
          ? "Expert Lane"
          : "Identification Workbench";
    const rows = snapshot.queue.map((item) => `
      <a class="row" href="${escapeHtml(withBasePath(basePath, `/observations/${encodeURIComponent(item.occurrenceId)}`))}">
        <div>
          <div style="font-weight:800">${escapeHtml(item.displayName)}</div>
          <div class="meta">${escapeHtml(item.placeName)} · ${escapeHtml(item.observedAt)}</div>
          <div class="meta">${escapeHtml(item.observerName)} · ${escapeHtml(item.municipality || "Municipality unknown")}</div>
        </div>
        <span class="pill">${item.identificationCount} ids</span>
      </a>`).join("");

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      `${laneTitle} | ikimon`,
      `<section class="section"><div class="card"><div class="card-body">
          <div class="eyebrow">Action</div>
          <h2>Minimal specialist action</h2>
          <form id="specialist-review-form" class="stack" style="margin-top:14px">
            <input name="actorUserId" type="hidden" value="${escapeHtml(reviewerUserId)}" />
            <div class="row"><div><strong>Signed in reviewer</strong><div class="meta">${escapeHtml(reviewerUserId)}</div></div><span class="pill">${escapeHtml(session?.rankLabel || session?.roleName || "specialist")}</span></div>
            <label class="stack"><span style="font-weight:700">Occurrence ID</span><input name="occurrenceId" type="text" placeholder="occ:..." style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
            <label class="stack"><span style="font-weight:700">Proposed name</span><input name="proposedName" type="text" placeholder="Scientific or common name" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            <label class="stack"><span style="font-weight:700">Proposed rank</span><input name="proposedRank" type="text" value="species" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            <label class="stack"><span style="font-weight:700">Note</span><textarea name="notes" rows="3" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8"></textarea></label>
            <div class="actions">
              <button class="btn" type="button" data-decision="approve">Approve</button>
              <button class="btn secondary" type="button" data-decision="reject">Reject</button>
              <button class="btn secondary" type="button" data-decision="note">Note</button>
            </div>
          </form>
          <div id="specialist-review-status" class="list" style="margin-top:14px"><div class="row"><div>Ready.</div></div></div>
        </div></div>
      </section>
      <section class="section">
        <div class="grid">
          <div class="card is-soft"><div class="card-body"><div class="eyebrow">Summary</div><h2>${snapshot.summary.unresolvedOccurrences}</h2><p class="meta">unresolved occurrences / ${snapshot.summary.totalOccurrences} total</p></div></div>
          <div class="card is-soft"><div class="card-body"><div class="eyebrow">Identifications</div><h2>${snapshot.summary.identificationCount}</h2><p class="meta">current identification rows in v2</p></div></div>
          <div class="card is-soft"><div class="card-body"><div class="eyebrow">Observation photos</div><h2>${snapshot.summary.observationPhotoAssets}</h2><p class="meta">photo assets available for review</p></div></div>
        </div>
      </section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">Queue</div><h2>レビュー待ちの観察</h2></div></div><div class="list">${rows || '<div class="row"><div>キューに観察はありません。</div></div>'}</div></section>
      <script>
        const basePath = ${JSON.stringify(basePath)};
        const lane = ${JSON.stringify(lane)};
        const withBasePath = (path) => basePath ? basePath + (path.startsWith('/') ? path : '/' + path) : path;
        const form = document.getElementById('specialist-review-form');
        const status = document.getElementById('specialist-review-status');
        const setStatus = (html) => { status.innerHTML = html; };
        form.querySelectorAll('button[data-decision]').forEach((button) => {
          button.addEventListener('click', async () => {
            const data = new FormData(form);
            const occurrenceId = String(data.get('occurrenceId') || '');
            const actorUserId = String(data.get('actorUserId') || '');
            const proposedName = String(data.get('proposedName') || '');
            const proposedRank = String(data.get('proposedRank') || '');
            const notes = String(data.get('notes') || '');
            const decision = button.getAttribute('data-decision');
            if (!occurrenceId || !actorUserId) {
              setStatus('<div class="row"><div>occurrenceId と actorUserId は必須です。</div></div>');
              return;
            }
            setStatus('<div class="row"><div>Submitting specialist review...</div></div>');
            const response = await fetch(withBasePath('/api/v1/specialist/occurrences/' + encodeURIComponent(occurrenceId) + '/review'), {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({ actorUserId, lane, decision, proposedName, proposedRank, notes }),
            });
            const json = await response.json();
            if (!response.ok || json.ok === false) {
              setStatus('<div class="row"><div>Submit failed.<div class="meta">' + String(json.error || 'specialist_review_failed') + '</div></div></div>');
              return;
            }
            setStatus('<div class="row"><div><strong>Review saved.</strong><div class="meta">' + String(json.decision || decision) + ' · ' + String(json.occurrenceId || occurrenceId) + '</div></div></div>');
          });
        });
      </script>`,
      "ホーム",
      {
        eyebrow: "専門家向け",
        heading: laneTitle,
        headingHtml: escapeHtml(laneTitle),
        lead: "観察の正式な同定や確認を行う、専門家向けの作業画面です。一般の方にはこの画面は表示されません。",
        actions: [
          { href: "/specialist/id-workbench?lane=public-claim", label: "公開同定" },
          { href: "/specialist/id-workbench?lane=expert-lane", label: "Expert lane", variant: "secondary" as const },
          { href: "/specialist/review-queue", label: "レビュー待ち", variant: "secondary" as const },
        ],
      },
    );
  });

  app.get("/specialist/review-queue", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const session = await getSessionFromCookie(request.headers.cookie);
    try {
      assertSpecialistSession(session, session?.userId ?? "");
    } catch {
      reply.code(403).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "Specialist access required",
        stateCard(
          "Specialist only",
          "この画面は専門家ロール専用です",
          `<p style="margin:0 0 12px">レビュー queue は一般公開しません。</p>
          <div class="actions" style="margin-top:16px">
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/"))}">トップへ戻る</a>
          </div>`,
        ),
        "ホーム",
      );
    }
    const snapshot = await getSpecialistSnapshot("review-queue");
    const reviewerUserId = session?.userId ?? "";
    const rows = snapshot.queue.map((item) => `
      <a class="row" href="${escapeHtml(withBasePath(basePath, `/observations/${encodeURIComponent(item.occurrenceId)}`))}">
        <div>
          <div style="font-weight:800">${escapeHtml(item.displayName)}</div>
          <div class="meta">${escapeHtml(item.placeName)} · ${escapeHtml(item.observedAt)}</div>
          <div class="meta">${escapeHtml(item.observerName)} · ${item.identificationCount} ids</div>
        </div>
        <span class="pill">Open</span>
      </a>`).join("");

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "Review Queue | ikimon",
      `<section class="section"><div class="card"><div class="card-body">
          <div class="eyebrow">Action</div>
          <h2>Minimal review action</h2>
          <form id="review-queue-form" class="stack" style="margin-top:14px">
            <input name="actorUserId" type="hidden" value="${escapeHtml(reviewerUserId)}" />
            <div class="row"><div><strong>Signed in reviewer</strong><div class="meta">${escapeHtml(reviewerUserId)}</div></div><span class="pill">${escapeHtml(session?.rankLabel || session?.roleName || "specialist")}</span></div>
            <label class="stack"><span style="font-weight:700">Occurrence ID</span><input name="occurrenceId" type="text" placeholder="occ:..." style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
            <label class="stack"><span style="font-weight:700">Note</span><textarea name="notes" rows="3" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8"></textarea></label>
            <div class="actions">
              <button class="btn" type="button" data-decision="approve">Approve</button>
              <button class="btn secondary" type="button" data-decision="reject">Reject</button>
              <button class="btn secondary" type="button" data-decision="note">Note</button>
            </div>
          </form>
          <div id="review-queue-status" class="list" style="margin-top:14px"><div class="row"><div>Ready.</div></div></div>
        </div></div>
      </section>
      <section class="section"><div class="grid">
        <div class="card is-soft"><div class="card-body"><div class="eyebrow">Queue size</div><h2>${snapshot.queue.length}</h2><p class="meta">review shell に表示中の observation sample</p></div></div>
        <div class="card is-soft"><div class="card-body"><div class="eyebrow">Unresolved</div><h2>${snapshot.summary.unresolvedOccurrences}</h2><p class="meta">unresolved occurrences across v2</p></div></div>
      </div></section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">Review sample</div><h2>レビュー対象</h2></div></div><div class="list">${rows || '<div class="row"><div>キューに観察はありません。</div></div>'}</div></section>
      <script>
        const basePath = ${JSON.stringify(basePath)};
        const withBasePath = (path) => basePath ? basePath + (path.startsWith('/') ? path : '/' + path) : path;
        const form = document.getElementById('review-queue-form');
        const status = document.getElementById('review-queue-status');
        const setStatus = (html) => { status.innerHTML = html; };
        form.querySelectorAll('button[data-decision]').forEach((button) => {
          button.addEventListener('click', async () => {
            const data = new FormData(form);
            const occurrenceId = String(data.get('occurrenceId') || '');
            const actorUserId = String(data.get('actorUserId') || '');
            const notes = String(data.get('notes') || '');
            const decision = button.getAttribute('data-decision');
            if (!occurrenceId || !actorUserId) {
              setStatus('<div class="row"><div>occurrenceId と actorUserId は必須です。</div></div>');
              return;
            }
            setStatus('<div class="row"><div>Submitting review action...</div></div>');
            const response = await fetch(withBasePath('/api/v1/specialist/occurrences/' + encodeURIComponent(occurrenceId) + '/review'), {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({ actorUserId, lane: 'review-queue', decision, notes }),
            });
            const json = await response.json();
            if (!response.ok || json.ok === false) {
              setStatus('<div class="row"><div>Submit failed.<div class="meta">' + String(json.error || 'specialist_review_failed') + '</div></div></div>');
              return;
            }
            setStatus('<div class="row"><div><strong>Review saved.</strong><div class="meta">' + String(json.decision || decision) + ' · ' + String(json.occurrenceId || occurrenceId) + '</div></div></div>');
          });
        });
      </script>`,
      "ホーム",
      {
        eyebrow: "専門家向け",
        heading: "レビュー待ちの観察",
        headingHtml: "レビュー待ちの観察",
        lead: "公開同定に進める前に、専門家が内容を確認するための画面です。",
        actions: [
          { href: "/specialist/id-workbench?lane=expert-lane", label: "Expert lane" },
          { href: "/specialist/id-workbench?lane=public-claim", label: "公開同定", variant: "secondary" as const },
        ],
      },
    );
  });

  /* -------------------------------------------------------------- */
  /* Field Note main entry (/notes) — user's own notebook           */
  /* -------------------------------------------------------------- */
  app.get("/notes", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const session = await getSessionFromCookie(request.headers.cookie);
    const { viewerUserId } = resolveViewer(request.query, session);
    const snapshot = await getLandingSnapshot(viewerUserId);

    const isLoggedIn = Boolean(viewerUserId);
    const ownCards = snapshot.myFeed
      .map((obs) => renderObservationCard(basePath, lang, obs))
      .join("");
    const nearbyCards = snapshot.feed
      .slice(0, 9)
      .map((obs) => renderObservationCard(basePath, lang, obs, { compact: true }))
      .join("");

    const emptyCopy = lang === "ja"
      ? "まだノートは真っ白です。1 件記録すると、あなたの観察がここに積み上がります。"
      : "The notebook is blank. Record one observation to stack pages here.";
    const nearbyCopy = lang === "ja" ? "近くで書かれているノート" : "Nearby pages";
    const myCopy = lang === "ja" ? "あなたのノート" : "Your pages";

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: lang === "ja" ? "フィールドノート | ikimon" : "Field Note | ikimon",
      activeNav: lang === "ja" ? "ホーム" : "Home",
      lang,
      extraStyles: `${OBSERVATION_CARD_STYLES}
        .notes-page { margin-top: 24px; }
        .notes-head { display: flex; flex-direction: column; gap: 8px; justify-content: flex-start; align-items: flex-start; margin-bottom: 16px; }
        .notes-head h2 { margin: 0; }
        .notes-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .notes-grid.is-compact { grid-template-columns: 1fr; gap: 12px; }
      `,
      hero: {
        eyebrow: lang === "ja" ? "あなたの 1 冊" : "Your notebook",
        heading: lang === "ja" ? "📖 フィールドノート" : "📖 Field Note",
        headingHtml: lang === "ja" ? "📖 フィールドノート" : "📖 Field Note",
        lead: lang === "ja"
          ? "あなたの観察が積み上がるノート。あとから読み返すほど、同じ道が違って見えてきます。"
          : "Your notebook where observations stack up. The more you re-read it, the more the same path changes.",
        tone: "light",
        align: "center",
        actions: [
          { href: "/record", label: lang === "ja" ? "続きを書く" : "Keep writing" },
          { href: "/map", label: lang === "ja" ? "マップで見る" : "See on the map", variant: "secondary" as const },
        ],
      },
      body: `<section class="section notes-page">
        <div class="notes-head"><div><h2>${escapeHtml(myCopy)}</h2></div></div>
        ${isLoggedIn
          ? (ownCards
              ? `<div class="notes-grid">${ownCards}</div>`
              : `<div class="onboarding-empty">
                  <div class="eyebrow">${escapeHtml(lang === "ja" ? "まだ 0 ページ" : "0 pages so far")}</div>
                  <h3>${escapeHtml(lang === "ja" ? "最初の 1 枚を書いてみる" : "Write your first page")}</h3>
                  <p>${escapeHtml(lang === "ja" ? "名前が分からなくても大丈夫。場所とメモだけで、あとから読み返せる記録になります。" : "You don't need the name. Place and a note is enough to make something worth revisiting.")}</p>
                  <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/record"))}">${escapeHtml(lang === "ja" ? "観察を記録する" : "Record an observation")}</a>
                </div>`)
          : `<div class="onboarding-empty">
              <div class="eyebrow">${escapeHtml(lang === "ja" ? "ゲスト" : "Guest")}</div>
              <h3>${escapeHtml(lang === "ja" ? "ノートを始める" : "Start a notebook")}</h3>
              <p>${escapeHtml(lang === "ja" ? "記録すると、あなた専用のフィールドノートがここに積み上がります。" : "Start recording and your personal field notebook will build up here.")}</p>
              <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/record"))}">${escapeHtml(lang === "ja" ? "観察を記録する" : "Record an observation")}</a>
            </div>`}
      </section>
      <section class="section notes-page">
        <div class="notes-head"><div><h2>${escapeHtml(nearbyCopy)}</h2></div></div>
        ${nearbyCards
          ? `<div class="notes-grid is-compact">${nearbyCards}</div>`
          : `<div class="card"><div class="card-body"><p class="meta">${escapeHtml(emptyCopy)}</p></div></div>`}
      </section>`,
      footerNote: lang === "ja" ? "フィールドノート — 歩いて、見つけて、1 冊に残す。" : "Field Note — walk, find, write it in one notebook.",
    });
  });

  /* -------------------------------------------------------------- */
  /* AI Lens entry (/lens) — marketing + CTA into /record           */
  /* -------------------------------------------------------------- */
  app.get("/lens", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const recordHref = appendLangToHref(withBasePath(basePath, "/record"), lang);
    const notesHref = appendLangToHref(withBasePath(basePath, "/notes"), lang);
    const mapHref = appendLangToHref(withBasePath(basePath, "/map"), lang);

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: lang === "ja" ? "フィールドガイド | ikimon" : "Field Guide | ikimon",
      activeNav: lang === "ja" ? "ホーム" : "Home",
      lang,
      hero: {
        eyebrow: lang === "ja" ? "歩きながら、世界を読み解く" : "Read the world around you as you walk",
        heading: lang === "ja" ? "🔍 フィールドガイド" : "🔍 Field Guide",
        headingHtml: lang === "ja" ? "🔍 フィールドガイド" : "🔍 Field Guide",
        lead: lang === "ja"
          ? "散歩中に気になったものにカメラを向けると、AI が何かを教えてくれます。名前が分からなくても、その場で写真と場所を記録として残せます。"
          : "Point your camera at anything that catches your eye — the AI will offer clues. Even without a name, you can save the photo and location as a record.",
        tone: "light",
        align: "center",
        actions: [
          { href: "/record", label: lang === "ja" ? "このまま記録する" : "Record this now" },
          { href: "/notes", label: lang === "ja" ? "ノートへ戻る" : "Back to Field Note", variant: "secondary" as const },
        ],
      },
      body: `<section class="section">
        <div class="list">
          <div class="row"><div><strong>${escapeHtml(lang === "ja" ? "1. まず写真かメモを残す" : "1. Save a photo or note first")}</strong><div class="meta">${escapeHtml(lang === "ja" ? "分からなくても構いません。場所・時刻・見た印象を失わないことが先です。" : "Do not wait for certainty. Preserve place, time, and first impression.")}</div></div></div>
          <div class="row"><div><strong>${escapeHtml(lang === "ja" ? "2. AI が出した名前より『次に何を確認すればいいか』を見る" : "2. Look for what to check next, not just the name")}</strong><div class="meta">${escapeHtml(lang === "ja" ? "名前が合っているかどうかより、次に確認すべきポイントを絞るのがここの使い方です。" : "The useful part is not certainty but what to check next.")}</div></div></div>
          <div class="row"><div><strong>${escapeHtml(lang === "ja" ? "3. 気づいたことを record 画面で記録として残す" : "3. Save the observation in the record screen")}</strong><div class="meta">${escapeHtml(lang === "ja" ? "このページだけでは記録は保存されません。写真と場所は record 画面で 1 件にまとめて残してください。" : "This page does not save records. Save your photo and location in the record screen.")}</div></div></div>
        </div>
      </section>
      <section class="section">
        <div class="grid">
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "向いている場面" : "Best for")}</div><h2>${escapeHtml(lang === "ja" ? "道端で名前が気になったとき" : "When you wonder what something is in the field")}</h2><p>${escapeHtml(lang === "ja" ? "その場で調べ込むより、とりあえず記録しておいて後から確認したいときに向いています。" : "Use it when it is better to keep moving and look it up later.")}</p></div></div>
          <details class="card"><summary style="padding:16px 20px;cursor:pointer;font-weight:700">${escapeHtml(lang === "ja" ? "期待しすぎないこと" : "Limitations")}</summary><div class="card-body" style="padding-top:0"><p>${escapeHtml(lang === "ja" ? "正確な名前を自動で確定する機能ではありません。候補と手がかりを返す補助として使ってください。名前の確定はコミュニティの合意で決まります。" : "This does not automatically confirm a name. Use it as a hint, not a verdict. Names are confirmed by the community.")}</p></div></details>
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "次の一歩" : "Next step")}</div><h2>${escapeHtml(lang === "ja" ? "写真と場所を record 画面で残す" : "Save photo and location in the record screen")}</h2><p>${escapeHtml(lang === "ja" ? "このページ単体では記録は残りません。場所・時刻・写真は record 画面で 1 件にまとめてください。" : "This page does not save records. Go to the record screen to save place, time, and photo.")}</p><div class="actions" style="margin-top:12px"><a class="btn btn-solid" href="${escapeHtml(recordHref)}">${escapeHtml(lang === "ja" ? "記録する" : "Record")}</a></div></div></div>
        </div>
      </section>
      <section class="section">
        <div class="grid">
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "記録の置き場所" : "Where records live")}</div><h2>${escapeHtml(lang === "ja" ? "このページで記録は完結しない" : "This page does not complete the record")}</h2><p>${escapeHtml(lang === "ja" ? "散歩中に見たものは、record 画面で写真・場所・メモを 1 件にまとめて残します。そこに残った記録が、あとで読み返せる観察になります。" : "Save what you saw in the record screen — photo, location, and note together. That is what becomes a revisitable observation.")}</p><p class="meta" style="margin-top:10px">${escapeHtml(lang === "ja" ? "記録を残す場所は record、積み重ねて読み返す場所は notes です。" : "Record is where you save. Notes is where you revisit.")}</p><div class="actions" style="margin-top:12px"><a class="inline-link" href="${escapeHtml(notesHref)}">${escapeHtml(lang === "ja" ? "記録一覧を見る" : "View notes")}</a></div></div></div>
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "どこを歩くか迷っているなら" : "Not sure where to walk?")}</div><h2>${escapeHtml(lang === "ja" ? "先に地図で場所を選ぶ" : "Choose a place on the map first")}</h2><p>${escapeHtml(lang === "ja" ? "名前を調べるより先に、どこを歩くか決まっていないなら地図で確認してから出発する方がスムーズです。" : "If you have not decided where to walk yet, checking the map first makes things smoother.")}</p><p class="meta" style="margin-top:10px">${escapeHtml(lang === "ja" ? "このページが『その場で見たものを調べる入口』なら、地図は『次にどこへ行くかを決める入口』です。" : "This page is for identifying what you see. The map is for deciding where to go next.")}</p><div class="actions" style="margin-top:12px"><a class="inline-link" href="${escapeHtml(mapHref)}">${escapeHtml(lang === "ja" ? "マップで場所を見る" : "See on the map")}</a></div></div></div>
        </div>
      </section>`,
      footerNote: lang === "ja" ? "カメラで見たものを AI が分析します。名前の確定より、まずその場の記録を残すことを優先してください。" : "The AI analyzes what your camera sees. Prioritize saving the record over getting the name right.",
    });
  });

  /* -------------------------------------------------------------- */
  /* Field Scan entry (/scan) — marketing + CTA into map/explore    */
  /* -------------------------------------------------------------- */
  app.get("/scan", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const mapHref = appendLangToHref(withBasePath(basePath, "/map"), lang);
    const exploreHref = appendLangToHref(withBasePath(basePath, "/explore"), lang);

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: lang === "ja" ? "フィールドスキャン | ikimon" : "Field Scan | ikimon",
      activeNav: lang === "ja" ? "ホーム" : "Home",
      lang,
      hero: {
        eyebrow: lang === "ja" ? "次にどこへ行くか決める" : "Decide where to go next",
        heading: lang === "ja" ? "📡 フィールドスキャン" : "📡 Field Scan",
        headingHtml: lang === "ja" ? "📡 フィールドスキャン" : "📡 Field Scan",
        lead: lang === "ja"
          ? "以前歩いたことがある場所に、また行く理由を見つけるためのページです。地図で記録が積み上がっている場所を確認して、次の散歩先を決めます。"
          : "Use this page to find a reason to return somewhere you have walked before. Check the map and decide where to go next.",
        tone: "light",
        align: "center",
        actions: [
          { href: "/map", label: lang === "ja" ? "マップで見る" : "See on the map" },
          { href: "/notes", label: lang === "ja" ? "ノートへ戻る" : "Back to notebook", variant: "secondary" as const },
        ],
      },
      body: `<section class="section">
        <div class="list">
          <div class="row"><div><strong>${escapeHtml(lang === "ja" ? "1. 地図でどの場所に記録が多いか見る" : "1. See which places have the most records on the map")}</strong><div class="meta">${escapeHtml(lang === "ja" ? "記録が多い場所・少ない場所の偏りから、次に歩く候補が見つかります。" : "Clusters and gaps on the map show you where to go next.")}</div></div></div>
          <div class="row"><div><strong>${escapeHtml(lang === "ja" ? "2. そこで何が見られているかをざっくり確認する" : "2. Get a rough sense of what has been seen there")}</strong><div class="meta">${escapeHtml(lang === "ja" ? "細かい名前より、その場所の雰囲気をつかむ感覚で見てください。" : "Focus on the feel of the place, not precise identification.")}</div></div></div>
          <div class="row"><div><strong>${escapeHtml(lang === "ja" ? "3. 歩く場所が決まったら、実際の観察を record 画面で記録する" : "3. Once you decide where to go, record observations in the record screen")}</strong><div class="meta">${escapeHtml(lang === "ja" ? "このページには記録を保存する機能がありません。実際に歩いて見たものは record 画面で残してください。" : "This page does not save records. Use the record screen to save what you actually observe.")}</div></div></div>
        </div>
      </section>
      <section class="section">
        <div class="grid">
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "向いている場面" : "Best for")}</div><h2>${escapeHtml(lang === "ja" ? "今日どこを歩くか迷っているとき" : "When you are not sure where to walk today")}</h2><p>${escapeHtml(lang === "ja" ? "前に行ったことがある場所にまた行く理由を見つけたいとき、次の 20 分をどこで過ごすか決めるのに向いています。" : "Use it when you want a reason to return somewhere, or to decide where to spend the next 20 minutes.")}</p><p class="meta" style="margin-top:10px">${escapeHtml(lang === "ja" ? "たとえば、今日は水辺側へ寄るか、公園の奥まで入るか、住宅地の縁を回るかを、ここで確認してから出発できます。" : "Decide today — waterside, deep park, or neighborhood edge — before you set out.")}</p></div></div>
          <details class="card"><summary><div class="card-body"><strong>${escapeHtml(lang === "ja" ? "期待しすぎないこと" : "Limitations")}</strong></div></summary><div class="card-body" style="padding-top:0"><p>${escapeHtml(lang === "ja" ? "このページには記録を保存する機能がありません。場所を決める入口として使い、実際の観察は record 画面で残してください。" : "This page does not save records. Use it to choose a place, then record your observations in the record screen.")}</p></div></details>
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "次の一歩" : "Next step")}</div><h2>${escapeHtml(lang === "ja" ? "マップで場所を決めて、そこで記録する" : "Pick a place on the map, then go record")}</h2><p>${escapeHtml(lang === "ja" ? "行き先が決まったら、実際にその場所を歩いて record 画面で 1 件記録してください。" : "Once you choose a place, go there and save at least one observation in the record screen.")}</p><div class="actions" style="margin-top:12px"><a class="btn btn-solid" href="${escapeHtml(mapHref)}">${escapeHtml(lang === "ja" ? "マップで見る" : "See on the map")}</a></div></div></div>
        </div>
      </section>
      <section class="section">
        <div class="grid">
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "使い方の流れ" : "How it fits in")}</div><h2>${escapeHtml(lang === "ja" ? "場所を決めて、そこで実際に記録する" : "Choose a place, then go record there")}</h2><p>${escapeHtml(lang === "ja" ? "ここで気になる場所を見つけたら、次のステップはその場所を実際に歩いて観察を 1 件残すことです。" : "Once you find an interesting place here, the next step is to walk there and save an observation.")}</p><p class="meta" style="margin-top:10px">${escapeHtml(lang === "ja" ? "場所を決める → 歩く → 記録する。この順番がikimon の基本的な使い方です。" : "Choose a place → walk → record. That is the basic flow.")}</p><div class="actions" style="margin-top:12px"><a class="inline-link" href="${escapeHtml(exploreHref)}">${escapeHtml(lang === "ja" ? "場所と種の広がりを見る" : "Browse place and species spread")}</a></div></div></div>
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "実際に残すなら" : "Ready to record?")}</div><h2>${escapeHtml(lang === "ja" ? "record 画面で写真と場所を残す" : "Save photo and location in the record screen")}</h2><p>${escapeHtml(lang === "ja" ? "場所が決まったら、その場の写真・時刻・メモを record 画面で 1 件にまとめてください。" : "Once you choose a place, save the photo, time, and note in the record screen.")}</p><p class="meta" style="margin-top:10px">${escapeHtml(lang === "ja" ? "ここで場所を決め、record で記録し、records に積み上げる。この繰り返しが散歩を観察に変えます。" : "Choose here, record there, accumulate in notes — the cycle that turns walks into observations.")}</p><div class="actions" style="margin-top:12px"><a class="inline-link" href="${escapeHtml(withBasePath(basePath, "/record"))}">${escapeHtml(lang === "ja" ? "記録する" : "Record")}</a></div></div></div>
        </div>
      </section>`,
      footerNote: lang === "ja" ? "次の散歩先を決めるためのページです。記録そのものは record 画面で残してください。" : "Use this page to decide where to walk next. Save your actual observations in the record screen.",
    });
  });

  /* -------------------------------------------------------------- */
  /* Map (/map) — full Map Explorer (tabs, filters, basemaps, xlinks)*/
  /* -------------------------------------------------------------- */
  app.get("/map", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));

    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 10; y -= 1) years.push(y);

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: lang === "ja" ? "探索マップ | ikimon" : "Explore Map | ikimon",
      activeNav: lang === "ja" ? "ホーム" : "Home",
      lang,
      extraStyles: MAP_EXPLORER_STYLES,
      // Deliberately no hero: a map page should land on the map, not on
      // a wall of text. The explorer component carries a tight eyebrow
      // strip at the top so context is still one line away.
      body: `${renderMapExplorer({ basePath, lang, years })}
${mapExplorerBootScript({ basePath, lang })}`,
      footerNote: lang === "ja"
        ? "観察の広がりを、次に歩く理由に変える地図。"
        : "A map that turns the spread of observations into your next reason to walk.",
    });
  });

  app.get("/guide", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: lang === "ja" ? "フィールドガイド | ikimon" : "Field Guide | ikimon",
      activeNav: lang === "ja" ? "フィールドガイド" : "Field Guide",
      lang,
      extraStyles: GUIDE_FLOW_STYLES,
      body: renderGuideFlow(basePath, lang),
      footerNote: lang === "ja"
        ? "映像と音声で、土地の物語を聴く。"
        : "Listen to the land's story through video and sound.",
    });
  });
}

// Keep the legacy mini map exports accessible so TypeScript doesn't mark them unused.
void MAP_MINI_STYLES;
void mapMiniBootScript;
void renderMapMini;
void toMapPoints;
void getLandingSnapshot;
