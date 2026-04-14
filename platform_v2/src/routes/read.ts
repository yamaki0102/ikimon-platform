import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl } from "../i18n.js";
import { getSessionFromCookie } from "../services/authSession.js";
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

function layout(basePath: string, title: string, body: string, activeNav: string): string {
  return renderSiteDocument({
    basePath,
    title,
    activeNav,
    body,
    footerNote: "shared website shell on staging. use these pages to verify the actual visual journey, not only the data endpoints.",
  });
}

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

export async function registerReadRoutes(app: FastifyInstance): Promise<void> {
  app.get("/record", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const queryUserId = typeof request.query === "object" && request.query && "userId" in request.query
      ? String((request.query as Record<string, unknown>).userId || "")
      : "";
    const session = queryUserId ? null : await getSessionFromCookie(request.headers.cookie);
    const viewerUserId = queryUserId || session?.userId || "";
    if (!viewerUserId) {
      reply.code(401).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "Session required",
        `<div class="hero"><div class="title">Session required</div><p class="muted" style="color:rgba(255,255,255,.86);margin-top:10px">Issue a v2 session first, or open <code>${escapeHtml(withBasePath(basePath, "/record?userId=..."))}</code> for staging capture.</p></div>`,
        "Record",
      );
    }

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "ikimon v2 record",
      `<section class="hero">
        <div class="eyebrow">Record</div>
        <h1 class="title">Record minimal shell</h1>
        <p class="muted" style="color:rgba(255,255,255,.86);margin-top:10px">Quick capture now runs on the v2 cutover lane with observation upsert and optional photo upload.</p>
        <div class="actions">
          <a class="btn secondary" href="${escapeHtml(queryUserId ? withBasePath(basePath, `/home?userId=${encodeURIComponent(viewerUserId)}`) : withBasePath(basePath, "/home"))}">Open home</a>
          <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/explore"))}">Explore</a>
        </div>
      </section>
      <section class="grid" style="margin-top:20px">
        <div class="card">
          <div class="card-body">
            <div class="eyebrow">Quick capture</div>
            <form id="record-form" data-user-id="${escapeHtml(viewerUserId)}" class="stack" style="margin-top:14px">
              <label class="stack"><span style="font-weight:700">Observed at</span><input id="observedAt" name="observedAt" type="datetime-local" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
              <label class="stack"><span style="font-weight:700">Latitude</span><input name="latitude" type="number" step="0.000001" value="34.7108" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
              <label class="stack"><span style="font-weight:700">Longitude</span><input name="longitude" type="number" step="0.000001" value="137.7261" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
              <label class="stack"><span style="font-weight:700">Municipality</span><input name="municipality" type="text" value="Hamamatsu" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">Place note</span><input name="localityNote" type="text" value="v2 quick capture shell" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">Scientific name</span><input name="scientificName" type="text" placeholder="Passer montanus" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">Vernacular name</span><input name="vernacularName" type="text" placeholder="Tree Sparrow" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">Rank</span><input name="rank" type="text" value="species" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">Photo</span><input name="photo" type="file" accept="image/*" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <button class="btn" type="submit">Submit observation</button>
            </form>
          </div>
        </div>
        <div class="card">
          <div class="card-body">
            <div class="eyebrow">Current actor</div>
            <div class="title">${escapeHtml(viewerUserId)}</div>
            <div class="meta">Session cookie or query userId can drive this capture shell.</div>
            <div id="record-status" class="list" style="margin-top:16px">
              <div class="row"><div>Ready to submit.</div></div>
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
          setStatus('<div class="row"><div>Submitting observation...</div></div>');
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
              note: 'v2 quick capture shell',
              sourcePayload: { source: 'v2_record_shell' },
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
            setStatus('<div class="row"><div><strong>Observation submitted.</strong><div class="meta"><a href=\"' + withBasePath('/observations/' + encodeURIComponent(observationId)) + '\">Open detail</a> · <a href=\"' + withBasePath('/home?userId=' + encodeURIComponent(userId)) + '\">Open home</a></div></div></div>');
            form.reset();
            if (observedAt) {
              const now = new Date();
              observedAt.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            }
          } catch (error) {
            setStatus('<div class="row"><div>Submit failed.<div class="meta">' + String(error.message || error) + '</div></div></div>');
          }
        });
      </script>`,
      "Record",
    );
  });

  app.get("/explore", async (_request, reply) => {
    const basePath = requestBasePath(_request as unknown as { headers: Record<string, unknown> });
    const snapshot = await getExploreSnapshot();
    const cards = snapshot.recentObservations.map((item) => `
      <a class="card" href="${escapeHtml(withBasePath(basePath, `/observations/${encodeURIComponent(item.occurrenceId)}`))}">
        ${item.photoUrl ? `<img class="thumb" src="${escapeHtml(item.photoUrl)}" alt="${escapeHtml(item.displayName)}" />` : ""}
        <div class="card-body">
          <div class="eyebrow">${escapeHtml(item.municipality || "Municipality unknown")}</div>
          <div class="title">${escapeHtml(item.displayName)}</div>
          <div class="meta">${escapeHtml(item.placeName)} · ${escapeHtml(item.observedAt)}</div>
          <div class="meta">${escapeHtml(item.observerName)} · ${item.identificationCount} identifications</div>
        </div>
      </a>`).join("");
    const municipalities = snapshot.municipalities.map((item) => `
      <div class="row">
        <div>
          <div style="font-weight:800">${escapeHtml(item.municipality)}</div>
          <div class="meta">Observation cluster</div>
        </div>
        <span class="pill">${item.observationCount} obs</span>
      </div>`).join("");
    const taxa = snapshot.topTaxa.map((item) => `
      <div class="row">
        <div>
          <div style="font-weight:800">${escapeHtml(item.displayName)}</div>
          <div class="meta">Top observed taxon</div>
        </div>
        <span class="pill">${item.observationCount} obs</span>
      </div>`).join("");

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "ikimon v2 explore",
      `<section class="hero">
        <div class="eyebrow">Explore</div>
        <h1 class="title">Explore minimal shell</h1>
        <p class="muted" style="color:rgba(255,255,255,.86);margin-top:10px">Recent observations, active municipalities, and top taxa are available on the v2 cutover lane.</p>
        <div class="actions">
          <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/home"))}">Open home</a>
          <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/ops/readiness"))}">Ops readiness</a>
        </div>
      </section>
      <section class="grid" style="margin-top:20px">
        <div class="card"><div class="card-body"><div class="eyebrow">Active municipalities</div><div class="list">${municipalities || '<div class="row"><div>No municipalities yet.</div></div>'}</div></div></div>
        <div class="card"><div class="card-body"><div class="eyebrow">Top taxa</div><div class="list">${taxa || '<div class="row"><div>No taxa yet.</div></div>'}</div></div></div>
      </section>
      <section style="margin-top:20px"><div class="eyebrow">Recent observations</div><div class="grid">${cards || '<div class="card"><div class="card-body">No observations yet.</div></div>'}</div></section>`,
      "Explore",
    );
  });

  app.get("/home", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const queryUserId = typeof request.query === "object" && request.query && "userId" in request.query
      ? String((request.query as Record<string, unknown>).userId || "")
      : "";
    const session = queryUserId ? null : await getSessionFromCookie(request.headers.cookie);
    const viewerUserId = queryUserId || session?.userId || null;
    const snapshot = await getHomeSnapshot(viewerUserId);
    const cards = snapshot.recentObservations.map((item) => `
      <a class="card" href="${escapeHtml(withBasePath(basePath, `/observations/${encodeURIComponent(item.occurrenceId)}`))}">
        ${item.photoUrl ? `<img class="thumb" src="${escapeHtml(item.photoUrl)}" alt="${escapeHtml(item.displayName)}" />` : ""}
        <div class="card-body">
          <div class="eyebrow">${escapeHtml(item.placeName)}</div>
          <div class="title">${escapeHtml(item.displayName)}</div>
          <div class="meta">${escapeHtml(item.observerName)} · ${escapeHtml(item.observedAt)}</div>
          <div class="meta">${escapeHtml(item.municipality || "Municipality unknown")} · ${item.identificationCount} identifications</div>
        </div>
      </a>`).join("");
    const myPlaces = snapshot.myPlaces.map((place) => `
      <a class="row" href="${escapeHtml(withBasePath(basePath, `/profile/${encodeURIComponent(snapshot.viewerUserId || "")}`))}">
        <div>
          <div style="font-weight:800">${escapeHtml(place.placeName)}</div>
          <div class="meta">${escapeHtml(place.municipality || "Municipality unknown")} · last ${escapeHtml(place.lastObservedAt)}</div>
        </div>
        <span class="pill">${place.visitCount} visits</span>
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
      "ikimon v2 home",
      `<section class="hero">
        <div class="eyebrow">my field mentor</div>
        <h1 class="title">前回より、少し見えるようになるホーム</h1>
        <p class="muted" style="color:rgba(255,255,255,.86);margin-top:10px">Home は一覧ではなく、前回からの成長と、また行きたくなる場所を返す面です。Session cookie または <code>?userId=...</code> で My places を開けます。</p>
        <div class="actions">
          <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/explore"))}">Explore nearby flow</a>
          <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/record"))}">Add another record</a>
          ${snapshot.viewerUserId ? `<a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/profile"))}">My profile</a>` : ""}
        </div>
      </section>
      <section class="grid" style="margin-top:20px">
        <div class="card"><div class="card-body"><div class="eyebrow">Growth cue</div><div class="title">今回の学び</div><div class="meta">${escapeHtml(growthCue)}</div></div></div>
        <div class="card"><div class="card-body"><div class="eyebrow">Revisit cue</div><div class="title">また行く理由</div><div class="meta">${escapeHtml(revisitCue)}</div></div></div>
        <div class="card"><div class="card-body"><div class="eyebrow">Collective AI</div><div class="title">みんなへの貢献</div><div class="meta">改善された観察と見分けの根拠は、将来の候補提示と explanation を良くする学習資産になります。</div></div></div>
      </section>
      ${snapshot.viewerUserId ? `<section style="margin-top:20px"><div class="eyebrow">My places</div><div class="list">${myPlaces || '<div class="row"><div>No places yet.</div></div>'}</div></section>` : ""}
      <section style="margin-top:20px"><div class="eyebrow">Recent observations</div><div class="grid">${cards}</div></section>`,
      "Home",
    );
  });

  app.get<{ Params: { id: string } }>("/observations/:id", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const snapshot = await getObservationDetailSnapshot(request.params.id);
    if (!snapshot) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Observation not found", `<div class="hero"><div class="title">Observation not found</div></div>`, "Explore");
    }
    const photos = snapshot.photoUrls.map((url) => `<img class="thumb" src="${escapeHtml(url)}" alt="${escapeHtml(snapshot.displayName)}" />`).join("");
    const ids = snapshot.identifications.map((item) => `
      <div class="row">
        <div>
          <div style="font-weight:800">${escapeHtml(item.proposedName)}</div>
          <div class="meta">${escapeHtml(item.actorName)} · ${escapeHtml(item.createdAt)}${item.proposedRank ? ` · ${escapeHtml(item.proposedRank)}` : ""}</div>
          ${item.notes ? `<div class="meta">${escapeHtml(item.notes)}</div>` : ""}
        </div>
      </div>`).join("");
    const unresolvedReason = snapshot.identifications.length === 0
      ? "まだ formal identification が付いていません。今は証拠に見合う粒度で止めるのが正しい状態です。"
      : snapshot.scientificName
        ? "現時点の候補はありますが、もっと良い写真や追加観察があると根拠を厚くできます。"
        : "候補は出ていても、まだ species certainty を急がない方が安全な状態です。";
    const retakeChecklist = [
      "全身だけでなく、決め手になる部位をもう1枚撮る",
      "同じ場所で時間を変えて再訪し、季節や行動差を取る",
      snapshot.photoUrls.length > 0 ? "今ある写真と次回写真を比べて、何が増えたかを確認する" : "まずは1枚でも写真を追加して、根拠を残す",
    ].map((item) => `<div class="row"><div>${escapeHtml(item)}</div></div>`).join("");

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      `${snapshot.displayName} | ikimon v2`,
      `<section class="hero">
        <div class="eyebrow">Observation detail</div>
        <h1 class="title">${escapeHtml(snapshot.displayName)}</h1>
        <p class="muted" style="color:rgba(255,255,255,.86);margin-top:10px">${escapeHtml(snapshot.placeName)} · ${escapeHtml(snapshot.observedAt)} · by ${escapeHtml(snapshot.observerName)}。観察結果だけでなく、次に何を見れば進むかまで確認する面です。</p>
        <div class="actions">
          <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/home"))}">Back to home</a>
          ${snapshot.observerUserId ? `<a class="btn secondary" href="${escapeHtml(withBasePath(basePath, `/profile/${encodeURIComponent(snapshot.observerUserId)}`))}">Open observer profile</a>` : ""}
        </div>
      </section>
      <section class="grid" style="margin-top:20px">
        <div class="card"><div class="card-body"><div class="eyebrow">Why not species yet</div><div class="title">いま無理に当て切らない理由</div><div class="meta">${escapeHtml(unresolvedReason)}</div></div></div>
        <div class="card"><div class="card-body"><div class="eyebrow">Next observation</div><div class="title">次に撮ると進むこと</div><div class="list">${retakeChecklist}</div></div></div>
        <div class="card"><div class="card-body"><div class="eyebrow">Learning loop</div><div class="title">今回の記録の意味</div><div class="meta">この観察は、場所の変化をあとで比較するための前提情報であり、同時に future AI explanation の学習資産候補でもあります。</div></div></div>
      </section>
      <section class="grid" style="margin-top:20px">${photos || '<div class="card"><div class="card-body">No photos</div></div>'}</section>
      <section class="grid" style="margin-top:20px">
        <div class="card"><div class="card-body"><div class="eyebrow">Place</div><div class="title">${escapeHtml(snapshot.placeName)}</div><div class="meta">${escapeHtml(snapshot.municipality || "Municipality unknown")}</div></div></div>
        <div class="card"><div class="card-body"><div class="eyebrow">Scientific name</div><div class="title">${escapeHtml(snapshot.scientificName || "Unresolved")}</div><div class="meta">${escapeHtml(snapshot.note || "No note")}</div></div></div>
      </section>
      <section style="margin-top:20px"><div class="eyebrow">Identifications</div><div class="list">${ids || '<div class="row"><div>No identifications yet.</div></div>'}</div></section>`,
      "Explore",
    );
  });

  app.get<{ Params: { userId: string } }>("/profile/:userId", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const snapshot = await getProfileSnapshot(request.params.userId);
    if (!snapshot) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Profile not found", `<div class="hero"><div class="title">Profile not found</div></div>`, "Home");
    }
    const places = snapshot.recentPlaces.map((place) => `
      <div class="row">
        <div>
          <div style="font-weight:800">${escapeHtml(place.placeName)}</div>
          <div class="meta">${escapeHtml(place.municipality || "Municipality unknown")} · ${escapeHtml(place.lastObservedAt)}</div>
        </div>
        <span class="pill">${place.visitCount} visits</span>
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
      `${snapshot.displayName} | profile`,
      `<section class="hero">
        <div class="eyebrow">Profile / My places</div>
        <h1 class="title">${escapeHtml(snapshot.displayName)}</h1>
        <p class="muted" style="color:rgba(255,255,255,.86);margin-top:10px">${escapeHtml(snapshot.rankLabel || "Observer")}</p>
        <div class="actions">
          <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, `/home?userId=${encodeURIComponent(snapshot.userId)}`))}">Open home as this user</a>
        </div>
      </section>
      <section style="margin-top:20px"><div class="eyebrow">Recent places</div><div class="list">${places || '<div class="row"><div>No places yet.</div></div>'}</div></section>
      <section style="margin-top:20px"><div class="eyebrow">Recent observations</div><div class="list">${observations || '<div class="row"><div>No observations yet.</div></div>'}</div></section>`,
      "Home",
    );
  });

  app.get("/profile", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const session = await getSessionFromCookie(request.headers.cookie);
    if (!session) {
      reply.code(401).type("text/html; charset=utf-8");
      return layout(basePath, "Session required", `<div class="hero"><div class="title">Session required</div><p class="muted" style="color:rgba(255,255,255,.86);margin-top:10px">Issue a v2 session first, then open profile.</p></div>`, "Home");
    }
    const snapshot = await getProfileSnapshot(session.userId);
    if (!snapshot) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Profile not found", `<div class="hero"><div class="title">Profile not found</div></div>`, "Home");
    }
    const places = snapshot.recentPlaces.map((place) => `
      <div class="row">
        <div>
          <div style="font-weight:800">${escapeHtml(place.placeName)}</div>
          <div class="meta">${escapeHtml(place.municipality || "Municipality unknown")} · ${escapeHtml(place.lastObservedAt)}</div>
        </div>
        <span class="pill">${place.visitCount} visits</span>
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
      `${snapshot.displayName} | profile`,
      `<section class="hero">
        <div class="eyebrow">Profile / Session</div>
        <h1 class="title">${escapeHtml(snapshot.displayName)}</h1>
        <p class="muted" style="color:rgba(255,255,255,.86);margin-top:10px">${escapeHtml(snapshot.rankLabel || "Observer")}</p>
        <div class="actions">
          <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/home"))}">Open home</a>
        </div>
      </section>
      <section style="margin-top:20px"><div class="eyebrow">Recent places</div><div class="list">${places || '<div class="row"><div>No places yet.</div></div>'}</div></section>
      <section style="margin-top:20px"><div class="eyebrow">Recent observations</div><div class="list">${observations || '<div class="row"><div>No observations yet.</div></div>'}</div></section>`,
      "Home",
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
      `ikimon v2 ${laneTitle}`,
      `<section class="hero">
        <div class="eyebrow">Specialist</div>
        <h1 class="title">${escapeHtml(laneTitle)}</h1>
        <p class="muted" style="color:rgba(255,255,255,.86);margin-top:10px">formal ID を詰める前に、queue と observation detail を v2 側で確認する最小 shell。</p>
        <div class="actions">
          <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/specialist/id-workbench?lane=public-claim"))}">Public claim</a>
          <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/specialist/id-workbench?lane=expert-lane"))}">Expert lane</a>
          <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/specialist/review-queue"))}">Review queue</a>
        </div>
      </section>
      <section class="card" style="margin-top:20px">
        <div class="card-body">
          <div class="eyebrow">Action</div>
          <div class="title">Minimal specialist action</div>
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
        </div>
      </section>
      <section class="grid" style="margin-top:20px">
        <div class="card"><div class="card-body"><div class="eyebrow">Summary</div><div class="title">${snapshot.summary.unresolvedOccurrences}</div><div class="meta">unresolved occurrences / ${snapshot.summary.totalOccurrences} total</div></div></div>
        <div class="card"><div class="card-body"><div class="eyebrow">Identifications</div><div class="title">${snapshot.summary.identificationCount}</div><div class="meta">current identification rows in v2</div></div></div>
        <div class="card"><div class="card-body"><div class="eyebrow">Observation photos</div><div class="title">${snapshot.summary.observationPhotoAssets}</div><div class="meta">photo assets available for review</div></div></div>
      </section>
      <section style="margin-top:20px"><div class="eyebrow">Queue</div><div class="list">${rows || '<div class="row"><div>No queued observations.</div></div>'}</div></section>
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
      "Specialist",
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
      "ikimon v2 review queue",
      `<section class="hero">
        <div class="eyebrow">Specialist</div>
        <h1 class="title">Review Queue</h1>
        <p class="muted" style="color:rgba(255,255,255,.86);margin-top:10px">自由入力レビューと public claim へ上げる前の確認用 read shell。</p>
        <div class="actions">
          <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/specialist/id-workbench?lane=expert-lane"))}">Expert lane</a>
          <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/specialist/id-workbench?lane=public-claim"))}">Public claim</a>
        </div>
      </section>
      <section class="card" style="margin-top:20px">
        <div class="card-body">
          <div class="eyebrow">Action</div>
          <div class="title">Minimal review action</div>
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
        </div>
      </section>
      <section class="grid" style="margin-top:20px">
        <div class="card"><div class="card-body"><div class="eyebrow">Queue size</div><div class="title">${snapshot.queue.length}</div><div class="meta">review shell に表示中の observation sample</div></div></div>
        <div class="card"><div class="card-body"><div class="eyebrow">Unresolved</div><div class="title">${snapshot.summary.unresolvedOccurrences}</div><div class="meta">unresolved occurrences across v2</div></div></div>
      </section>
      <section style="margin-top:20px"><div class="eyebrow">Review sample</div><div class="list">${rows || '<div class="row"><div>No queued observations.</div></div>'}</div></section>
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
      "Specialist",
    );
  });

  /* -------------------------------------------------------------- */
  /* Field Note main entry (/notes) — user's own notebook           */
  /* -------------------------------------------------------------- */
  app.get("/notes", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const queryUserId = typeof request.query === "object" && request.query && "userId" in request.query
      ? String((request.query as Record<string, unknown>).userId || "")
      : "";
    const session = queryUserId ? null : await getSessionFromCookie(request.headers.cookie);
    const viewerUserId = queryUserId || session?.userId || null;
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
        eyebrow: lang === "ja" ? "補助機能" : "Supporting tool",
        heading: lang === "ja" ? "🔍 AIレンズ" : "🔍 AI Lens",
        headingHtml: lang === "ja" ? "🔍 AIレンズ" : "🔍 AI Lens",
        lead: lang === "ja"
          ? "撮った瞬間、AI が候補を返す。名前を知らなくても、フィールドノートの最初の一行を書き始められる補助機能です。"
          : "AI returns candidate species the moment you shoot. A supporting tool that lets you start the first line of your field note without knowing the name.",
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
        eyebrow: lang === "ja" ? "補助機能" : "Supporting tool",
        heading: lang === "ja" ? "📡 フィールドスキャン" : "📡 Field Scan",
        headingHtml: lang === "ja" ? "📡 フィールドスキャン" : "📡 Field Scan",
        lead: lang === "ja"
          ? "歩きながら近辺の種の気配を拾う補助機能。次にフィールドノートへ書き足す場所を、マップがおすすめ調査エリアとして教えてくれます。"
          : "A supporting tool that picks up the signal of species nearby while you walk. The map suggests the next place to add to your notebook.",
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

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: lang === "ja" ? "探索マップ | ikimon" : "Explore Map | ikimon",
      activeNav: lang === "ja" ? "ホーム" : "Home",
      lang,
      extraStyles: `${MAP_MINI_STYLES}
        .map-page { margin-top: 24px; }
        .map-page .map-mini { --map-mini-height: 64vh; }
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
        ${renderMapMini({
          id: "ikimon-map-full",
          points,
          mapHref: notesHref,
          mapCtaLabel: lang === "ja" ? "ノートへ戻る" : "Back to notebook",
          emptyLabel: lang === "ja" ? "まだ地図に載せる観察がありません" : "No observations on the map yet",
          height: 520,
        })}
      </section>
      ${mapMiniBootScript("ikimon-map-full")}`,
      footerNote: lang === "ja" ? "観察の広がりを、あとで見返せる地図として残す。" : "Keep the spread of observations as a map you can revisit.",
    });
  });
}
