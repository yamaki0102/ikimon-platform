import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl } from "../i18n.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { resolveViewer } from "../services/viewerIdentity.js";
import { getLandingSnapshot } from "../services/landingSnapshot.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";
import { OBSERVATION_CARD_STYLES, renderObservationCard } from "../ui/observationCard.js";
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
      `<section class="grid" style="margin-top:20px">
        <div class="card">
          <div class="card-body">
            <div class="eyebrow">Quick capture</div>
            <form id="record-form" data-user-id="${escapeHtml(viewerUserId)}" class="stack" style="margin-top:14px">
              <label class="stack"><span style="font-weight:700">観察した日時</span><input id="observedAt" name="observedAt" type="datetime-local" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
              <label class="stack"><span style="font-weight:700">緯度</span><input name="latitude" type="number" step="0.000001" value="34.7108" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
              <label class="stack"><span style="font-weight:700">経度</span><input name="longitude" type="number" step="0.000001" value="137.7261" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
              <label class="stack"><span style="font-weight:700">市区町村</span><input name="municipality" type="text" placeholder="例: 浜松市" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">場所のメモ</span><input name="localityNote" type="text" placeholder="例: 公園の入口付近" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">学名 (分かれば)</span><input name="scientificName" type="text" placeholder="例: Passer montanus" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">和名 / 通称 (分かれば)</span><input name="vernacularName" type="text" placeholder="例: スズメ" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">分類の段階</span><input name="rank" type="text" value="species" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">写真</span><input name="photo" type="file" accept="image/*" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <button class="btn btn-solid" type="submit">観察を記録する</button>
            </form>
          </div>
        </div>
        <div class="card">
          <div class="card-body">
            <div class="eyebrow">サインイン中</div>
            <div class="title">${escapeHtml(viewerUserId)}</div>
            <div class="meta">サインインしたセッションで記録を送信します。</div>
            <div id="record-status" class="list" style="margin-top:16px">
              <div class="row"><div>入力が完了したら送信してください。</div></div>
            </div>
          </div>
        </div>
      </section>
      <script>
        const basePath = ${JSON.stringify(basePath)};
        const withBasePath = (path) => basePath ? basePath + (path.startsWith('/') ? path : '/' + path) : path;
        const form = document.getElementById('record-form');
        const status = document.getElementById('record-status');
        const observedAt = document.getElementById('observedAt');
        if (observedAt && !observedAt.value) {
          const now = new Date();
          observedAt.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        }
        const setStatus = (html) => { status.innerHTML = html; };
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
        lead: "観察した場所・時刻・気づいた生きものを、そのまま 1 件のノートに残します。同定候補は AIレンズが補助します。",
        actions: [
          { href: queryUserId ? `/home?userId=${encodeURIComponent(viewerUserId)}` : "/home", label: "ホーム" },
          { href: "/explore", label: "みつける", variant: "secondary" as const },
        ],
      },
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
          <div class="card"><div class="card-body"><div class="eyebrow">活発な自治体</div><div class="list">${municipalities || '<div class="row"><div>まだ自治体データがありません。</div></div>'}</div></div></div>
          <div class="card"><div class="card-body"><div class="eyebrow">よく観察されている種</div><div class="list">${taxa || '<div class="row"><div>まだ種データがありません。</div></div>'}</div></div></div>
        </div>
      </section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">直近の観察</div><h2>近くで見つかっているもの</h2></div></div><div class="explore-grid">${cards || '<div class="card"><div class="card-body">まだ観察がありません。</div></div>'}</div></section>`,
      "みつける",
      {
        eyebrow: "みつける",
        heading: "📡 近くの観察を広く見る",
        lead: "自治体・種・直近の観察を横断して、今どこで何が見つかっているかを俯瞰します。",
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
          <div class="card is-soft"><div class="card-body"><div class="eyebrow">みんなへの貢献</div><h2>Collective AI</h2><p class="meta">改善された観察と見分けの根拠は、将来の候補提示と explanation を良くする学習資産になります。</p></div></div>
        </div>
      </section>
      ${snapshot.viewerUserId ? `<section class="section"><div class="section-header"><div><div class="eyebrow">よく歩く場所</div><h2>My places</h2></div></div><div class="list">${myPlaces || '<div class="row"><div>まだ記録した場所はありません。</div></div>'}</div></section>` : ""}
      <section class="section"><div class="section-header"><div><div class="eyebrow">ノート</div><h2>最近の観察</h2></div></div><div class="home-grid">${cards}</div></section>`,
      "ホーム",
      {
        eyebrow: "my field mentor",
        heading: "前回より、少し見えるようになるホーム",
        lead: "前回からの気づきと、また行きたくなる場所をお届けするページです。",
        actions: [
          { href: "/notes", label: "ノートへ" },
          { href: "/record", label: "1 件記録する", variant: "secondary" as const },
        ],
      },
      `${OBSERVATION_CARD_STYLES}
        .home-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; }
        @media (max-width: 860px) { .home-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        @media (max-width: 480px) { .home-grid { grid-template-columns: 1fr; } }
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
      <section class="section"><div class="section-header"><div><div class="eyebrow">同定の履歴</div><h2>Identifications</h2></div></div><div class="list">${ids || '<div class="row"><div>まだ同定が付いていません。</div></div>'}</div></section>`,
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
    const requestedLane = typeof request.query === "object" && request.query && "lane" in request.query
      ? String((request.query as Record<string, unknown>).lane || "")
      : "";
    const lane = requestedLane === "public-claim" || requestedLane === "expert-lane" ? requestedLane : "default";
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
            <label class="stack"><span style="font-weight:700">Actor userId</span><input name="actorUserId" type="text" placeholder="reviewer-user-id" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
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
    const snapshot = await getSpecialistSnapshot("review-queue");
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
            <label class="stack"><span style="font-weight:700">Actor userId</span><input name="actorUserId" type="text" placeholder="reviewer-user-id" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
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
        .notes-head { display: flex; gap: 16px; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; margin-bottom: 16px; }
        .notes-head h2 { margin: 0; }
        .notes-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; }
        .notes-grid.is-compact { grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; }
        @media (max-width: 860px) { .notes-grid, .notes-grid.is-compact { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        @media (max-width: 480px) { .notes-grid, .notes-grid.is-compact { grid-template-columns: 1fr; } }
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
              : `<div class="card"><div class="card-body"><p class="meta">${escapeHtml(emptyCopy)}</p></div></div>`)
          : `<div class="card"><div class="card-body"><p class="meta">${escapeHtml(lang === "ja" ? "ログインすると、あなたのノートがここに表示されます。" : "Sign in to see your own notebook here.")}</p></div></div>`}
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

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: lang === "ja" ? "AIレンズ | ikimon" : "AI Lens | ikimon",
      activeNav: lang === "ja" ? "ホーム" : "Home",
      lang,
      hero: {
        eyebrow: lang === "ja" ? "撮って書く入口" : "Shoot and write",
        heading: lang === "ja" ? "🔍 AIレンズ" : "🔍 AI Lens",
        headingHtml: lang === "ja" ? "🔍 AIレンズ" : "🔍 AI Lens",
        lead: lang === "ja"
          ? "撮った瞬間、AI が候補を返す。名前を知らなくても、フィールドノートの最初の一行が書き始められる。"
          : "AI returns candidate species the moment you shoot. Start the first line of your field note without knowing the name.",
        tone: "light",
        align: "center",
        actions: [
          { href: "/record", label: lang === "ja" ? "撮影して試す" : "Try it now" },
          { href: "/notes", label: lang === "ja" ? "フィールドノートへ戻る" : "Back to Field Note", variant: "secondary" as const },
        ],
      },
      body: `<section class="section">
        <div class="grid">
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "使い方" : "How to use")}</div><h2>${escapeHtml(lang === "ja" ? "撮って、候補から選ぶ" : "Shoot, then pick a candidate")}</h2><p>${escapeHtml(lang === "ja" ? "記録画面で写真をアップすると、AI が可能な種の候補を返します。自信のない観察でも、ノートの最初の一行を書き始められます。" : "Upload a photo on the record screen. AI returns possible candidates so you can start a note even when you are unsure.")}</p></div></div>
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "ノートとの関係" : "Relation to the notebook")}</div><h2>${escapeHtml(lang === "ja" ? "主役はノート、レンズは入口" : "Notebook is the star, lens is the door")}</h2><p>${escapeHtml(lang === "ja" ? "AIレンズの候補はあくまで下書き補助です。最終的にノートに残す内容は、あなた自身が選びます。" : "AI candidates are just a draft helper. The content that actually lands in your notebook is your own choice.")}</p><div class="actions" style="margin-top:12px"><a class="inline-link" href="${escapeHtml(notesHref)}">${escapeHtml(lang === "ja" ? "フィールドノートへ" : "Go to Field Note")}</a></div></div></div>
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "次の一歩" : "Next step")}</div><h2>${escapeHtml(lang === "ja" ? "実際に撮って試す" : "Actually try it")}</h2><p>${escapeHtml(lang === "ja" ? "最初の 1 枚が一番ハードルが高い。身近な生きものや風景で構いません。" : "The first shot is the hardest. Any nearby creature or scene is fine.")}</p><div class="actions" style="margin-top:12px"><a class="btn btn-solid" href="${escapeHtml(recordHref)}">${escapeHtml(lang === "ja" ? "記録する" : "Record")}</a></div></div></div>
        </div>
      </section>`,
      footerNote: lang === "ja" ? "AIレンズはフィールドノートを育てる補助機能です。" : "AI Lens is a supporting tool that feeds the Field Note.",
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
        eyebrow: lang === "ja" ? "歩いて拾う入口" : "Walk and pick up",
        heading: lang === "ja" ? "📡 フィールドスキャン" : "📡 Field Scan",
        headingHtml: lang === "ja" ? "📡 フィールドスキャン" : "📡 Field Scan",
        lead: lang === "ja"
          ? "歩きながら近辺の種の気配を拾う。次にフィールドノートへ書き足す場所を、マップがおすすめ調査エリアとして教えてくれる。"
          : "Pick up the signal of species nearby while you walk. The map suggests the next place to add to your notebook.",
        tone: "light",
        align: "center",
        actions: [
          { href: "/map", label: lang === "ja" ? "マップで見る" : "See on the map" },
          { href: "/explore", label: lang === "ja" ? "自治体・種で見る" : "By place / species", variant: "secondary" as const },
        ],
      },
      body: `<section class="section">
        <div class="grid">
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "何をするか" : "What it does")}</div><h2>${escapeHtml(lang === "ja" ? "近辺の多様性の気配を返す" : "Returns the signal of nearby diversity")}</h2><p>${escapeHtml(lang === "ja" ? "場所・季節・最近の観察密度から、次に歩くと発見がありそうなエリアを地図上に示します。" : "From place, season, and recent observation density, the map highlights areas likely to yield a find if you walk there next.")}</p><div class="actions" style="margin-top:12px"><a class="btn btn-solid" href="${escapeHtml(mapHref)}">${escapeHtml(lang === "ja" ? "マップで見る" : "See on the map")}</a></div></div></div>
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "ノートとの関係" : "Relation to the notebook")}</div><h2>${escapeHtml(lang === "ja" ? "次のページのネタ元" : "Fuel for the next page")}</h2><p>${escapeHtml(lang === "ja" ? "スキャンは主役ではなく、ノートに新しいページを書き足す理由を与える補助機能です。" : "Scan is not the star — it gives you a reason to add a new page to your notebook.")}</p><div class="actions" style="margin-top:12px"><a class="inline-link" href="${escapeHtml(exploreHref)}">${escapeHtml(lang === "ja" ? "自治体と種の広がりを見る" : "Browse places and species")}</a></div></div></div>
        </div>
      </section>`,
      footerNote: lang === "ja" ? "フィールドスキャンはフィールドノートを育てる補助機能です。" : "Field Scan is a supporting tool that feeds the Field Note.",
    });
  });

  /* -------------------------------------------------------------- */
  /* Map (/map) — minimal MapLibre view of observation points       */
  /* -------------------------------------------------------------- */
  app.get("/map", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const snapshot = await getLandingSnapshot(null);
    const points = toMapPoints(snapshot.feed);
    const notesHref = appendLangToHref(withBasePath(basePath, "/notes"), lang);

    // Side column: recent observations list + municipality cluster.
    const recentListLabel = lang === "ja" ? "直近の観察" :
      lang === "es" ? "Observaciones recientes" :
      lang === "pt-BR" ? "Observações recentes" : "Recent observations";
    const clusterLabel = lang === "ja" ? "活発な自治体" :
      lang === "es" ? "Municipios activos" :
      lang === "pt-BR" ? "Municípios ativos" : "Active municipalities";
    const statsLabel = lang === "ja"
      ? `${snapshot.stats.observationCount.toLocaleString("ja-JP")} 件 · ${snapshot.stats.speciesCount.toLocaleString("ja-JP")} 種`
      : `${snapshot.stats.observationCount.toLocaleString("en-US")} obs · ${snapshot.stats.speciesCount.toLocaleString("en-US")} species`;

    const recentList = snapshot.feed.slice(0, 6).map((obs) => {
      const href = appendLangToHref(withBasePath(basePath, `/observations/${encodeURIComponent(obs.occurrenceId)}`), lang);
      const place = [obs.placeName, obs.municipality].filter(Boolean).join(" · ") || "—";
      return `<a class="map-side-item" href="${escapeHtml(href)}">
        <strong>${escapeHtml(obs.displayName)}</strong>
        <span>${escapeHtml(place)}</span>
      </a>`;
    }).join("");

    const clusterCounts = new Map<string, number>();
    for (const obs of snapshot.feed) {
      const key = obs.municipality || (lang === "ja" ? "未分類" : "Unknown");
      clusterCounts.set(key, (clusterCounts.get(key) ?? 0) + 1);
    }
    const clusterItems = [...clusterCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `<div class="map-cluster-item"><span>${escapeHtml(name)}</span><strong>${count}</strong></div>`)
      .join("");

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: lang === "ja" ? "探索マップ | ikimon" : "Explore Map | ikimon",
      activeNav: lang === "ja" ? "ホーム" : "Home",
      lang,
      extraStyles: `${MAP_MINI_STYLES}
        .map-page { margin-top: 24px; }
        .map-page-layout { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 20px; align-items: start; }
        .map-page-layout .map-mini { --map-mini-height: 64vh; }
        .map-side { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 16px; }
        .map-side-card { background: #fff; border: 1px solid rgba(15,23,42,.06); border-radius: 20px; padding: 16px 18px; box-shadow: 0 8px 20px rgba(15,23,42,.04); }
        .map-side-card h3 { margin: 0 0 10px; font-size: 13px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #059669; }
        .map-side-stat { font-size: 15px; font-weight: 800; color: #0f172a; }
        .map-side-list { display: flex; flex-direction: column; gap: 8px; }
        .map-side-item { padding: 10px 12px; border-radius: 12px; background: rgba(236,253,245,.4); border: 1px solid rgba(16,185,129,.12); text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 2px; }
        .map-side-item:hover { background: rgba(236,253,245,.8); }
        .map-side-item strong { font-size: 13px; font-weight: 800; color: #0f172a; }
        .map-side-item span { font-size: 11px; color: #64748b; }
        .map-cluster-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 10px; background: rgba(248,250,252,.8); font-size: 13px; }
        .map-cluster-item strong { font-weight: 800; color: #059669; }
        @media (max-width: 900px) {
          .map-page-layout { grid-template-columns: 1fr; }
          .map-side { position: static; flex-direction: row; overflow-x: auto; padding-bottom: 6px; }
          .map-side-card { min-width: 240px; flex-shrink: 0; }
        }
      `,
      hero: {
        eyebrow: lang === "ja" ? "探索マップ" : "Explore Map",
        heading: lang === "ja" ? "🗺️ 観察を地図で見る" : "🗺️ Observations on the map",
        headingHtml: lang === "ja" ? "🗺️ 観察を地図で見る" : "🗺️ Observations on the map",
        lead: lang === "ja"
          ? "あなたと周りの観察がどの場所に積み上がっているかを地図で確認できます。"
          : "See where you and others have stacked observations on the map.",
        tone: "light",
        align: "center",
        actions: [
          { href: "/notes", label: lang === "ja" ? "フィールドノートへ戻る" : "Back to Field Note", variant: "secondary" as const },
          { href: "/record", label: lang === "ja" ? "ここに書き足す" : "Add a page here" },
        ],
      },
      body: `<section class="section map-page">
        <div class="map-page-layout">
          <div>${renderMapMini({
            id: "ikimon-map-full",
            points,
            mapHref: notesHref,
            mapCtaLabel: lang === "ja" ? "ノートへ戻る" : "Back to notebook",
            emptyLabel: lang === "ja" ? "まだ地図に載せる観察がありません" : "No observations on the map yet",
            height: 520,
          })}</div>
          <aside class="map-side" aria-label="${escapeHtml(lang === "ja" ? "サイド情報" : "Side info")}">
            <div class="map-side-card">
              <h3>${escapeHtml(lang === "ja" ? "全体" : "Total")}</h3>
              <div class="map-side-stat">${escapeHtml(statsLabel)}</div>
            </div>
            ${clusterItems ? `<div class="map-side-card">
              <h3>${escapeHtml(clusterLabel)}</h3>
              <div class="map-side-list">${clusterItems}</div>
            </div>` : ""}
            ${recentList ? `<div class="map-side-card">
              <h3>${escapeHtml(recentListLabel)}</h3>
              <div class="map-side-list">${recentList}</div>
            </div>` : ""}
          </aside>
        </div>
      </section>
      ${mapMiniBootScript("ikimon-map-full")}`,
      footerNote: lang === "ja" ? "観察の広がりを、あとで見返せる地図として残す。" : "Keep the spread of observations as a map you can revisit.",
    });
  });
}
