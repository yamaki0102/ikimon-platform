import type { ObservationEventSessionRow } from "../services/observationEventModeManager.js";
import { MODE_METERS, EVENT_MODES } from "../services/observationEventModeManager.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MODE_LABEL: Record<string, string> = {
  discovery: "発見",
  effort_maximize: "努力量",
  bingo: "ビンゴ",
  absence_confirm: "不在確認",
  ai_quest: "AI クエスト",
};

export interface RenderLiveArgs {
  session: ObservationEventSessionRow;
  participantSelfId: string | null;
  isOrganizer: boolean;
  guestToken: string | null;
}

export function renderObservationEventLiveBody(args: RenderLiveArgs): string {
  const { session, isOrganizer, guestToken } = args;
  const meter = MODE_METERS[session.primaryMode] ?? MODE_METERS.discovery;
  const modeBadgeClass = `evt-badge evt-mode-${session.primaryMode === "effort_maximize" ? "effort" : session.primaryMode === "absence_confirm" ? "absence" : session.primaryMode === "ai_quest" ? "quest" : session.primaryMode}`;

  const modeSwitcher = EVENT_MODES.map((mode) => {
    const cls = mode === session.primaryMode ? "evt-mode-pill is-active" : "evt-mode-pill";
    return `<button type="button" class="${cls}" data-mode="${mode}">${MODE_LABEL[mode] ?? mode}</button>`;
  }).join("");

  const targets = (session.targetSpecies ?? []).slice(0, 12).map(escapeHtml).join("、") || "未設定";

  const consoleLink = isOrganizer
    ? `<a class="evt-btn evt-btn-on-dark" href="./console">主催者管制塔</a>`
    : "";

  return `
<section class="evt-live-shell" data-session-id="${escapeHtml(session.sessionId)}" data-event-code="${escapeHtml(session.eventCode ?? "")}" data-guest-token="${escapeHtml(guestToken ?? "")}" data-primary-mode="${escapeHtml(session.primaryMode)}" data-target-species="${escapeHtml(JSON.stringify(session.targetSpecies ?? []))}">

  <header class="evt-live-topbar">
    <div>
      <span class="evt-eyebrow">${escapeHtml(MODE_LABEL[session.primaryMode] ?? "発見")} モード</span>
      <div class="evt-live-topbar-time" data-evt-clock>--:--</div>
    </div>
    <div class="evt-live-topbar-progress">
      <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--evt-ink-soft);">
        <span data-evt-meter-label>${escapeHtml(meter.label)}</span>
        <span data-evt-meter-value>0 / ${(session.targetSpecies ?? []).length || "—"} ${escapeHtml(meter.unit)}</span>
      </div>
      <div class="evt-live-progress-bar"><span data-evt-meter-bar style="width:0%"></span></div>
    </div>
    <div class="evt-live-topbar-mode">
      <span class="${modeBadgeClass} is-live">LIVE</span>
      ${consoleLink}
    </div>
  </header>

  <main class="evt-live-main">
    <section class="evt-live-map" aria-label="ライブマップ">
      <div class="evt-live-map-canvas" data-evt-map
           data-center-lat="${escapeHtml(String(session.locationLat ?? 35.0))}"
           data-center-lng="${escapeHtml(String(session.locationLng ?? 138.0))}"
           data-radius-m="${escapeHtml(String(session.locationRadiusM ?? 1000))}">
      </div>
      <div class="evt-live-map-overlay">
        <span class="evt-badge evt-mode-discovery">目標: ${targets}</span>
        <div style="margin-left:auto; display:flex; gap:6px;">
          <button type="button" class="evt-btn evt-btn-on-dark" data-replay-toggle style="min-height:36px; padding:6px 12px;">⏮ リプレイ</button>
        </div>
      </div>
      <div class="evt-replay-controls" data-replay-controls
           style="position:absolute; left:12px; right:12px; bottom:62px; display:none; gap:8px; align-items:center;
                  padding:8px 12px; background:rgba(15,23,42,.85); border-radius:14px;">
        <button type="button" class="evt-btn evt-btn-on-dark" data-replay-play style="min-height:32px; padding:4px 10px;">▶</button>
        <input type="range" data-replay-slider min="0" max="100" value="0" style="flex:1;" />
        <span data-replay-clock style="color:#ecfdf5; font-variant-numeric:tabular-nums; font-size:12px;">--:--</span>
      </div>
    </section>

    <section class="evt-live-feed" aria-label="発見フィード">
      <header class="evt-live-feed-header">
        <strong style="font-size:14px;">発見フィード</strong>
        <span class="evt-eyebrow" data-evt-feed-count>0 件</span>
      </header>
      <div class="evt-live-feed-list" data-evt-feed role="log" aria-live="polite">
        <div class="evt-live-feed-item">
          <span class="evt-live-feed-icon">🌱</span>
          <span>セッションに参加しました。最初の観察を投稿しよう。</span>
          <span class="evt-live-feed-time">いま</span>
        </div>
      </div>
    </section>

    <section class="evt-live-status">
      <div class="evt-live-stat-card">
        <span class="evt-live-stat-label">観察</span>
        <strong class="evt-live-stat-value" data-evt-stat="obs">0</strong>
      </div>
      <div class="evt-live-stat-card">
        <span class="evt-live-stat-label">種数</span>
        <strong class="evt-live-stat-value" data-evt-stat="species">0</strong>
      </div>
      <div class="evt-live-stat-card">
        <span class="evt-live-stat-label">不在確認</span>
        <strong class="evt-live-stat-value" data-evt-stat="absence">0</strong>
      </div>
    </section>
  </main>

  <footer class="evt-live-actions" role="group" aria-label="観察アクション">
    <button class="evt-live-action-btn" data-mood="record" type="button" data-action="record">
      <span class="evt-live-action-icon">📷</span>
      <span>観察を投稿</span>
    </button>
    <button class="evt-live-action-btn" data-mood="check" type="button" data-action="searched">
      <span class="evt-live-action-icon">🤔</span>
      <span>探したけど</span>
    </button>
    <button class="evt-live-action-btn" data-mood="absent" type="button" data-action="absent">
      <span class="evt-live-action-icon">❌</span>
      <span>いない</span>
    </button>
    <button class="evt-live-action-btn" data-mood="role" type="button" data-action="role">
      <span class="evt-live-action-icon">🎯</span>
      <span>役割宣言</span>
    </button>
  </footer>
</section>

<dialog class="evt-quest-dialog" data-evt-quest-dialog
        style="border:0; padding:0; background:transparent; max-width:480px; width:calc(100vw - 32px);">
  <div class="evt-quest-card" data-evt-quest-card>
    <div class="evt-quest-card-icon" aria-hidden="true">✨</div>
    <div>
      <span class="evt-eyebrow" data-evt-quest-headline>AI Quest</span>
      <p class="evt-quest-prompt" data-evt-quest-prompt>...</p>
      <div class="evt-quest-actions">
        <button type="button" data-evt-quest-decline>後で</button>
        <button type="button" class="is-accept" data-evt-quest-accept>受諾する</button>
      </div>
    </div>
  </div>
</dialog>

<dialog class="evt-absence-dialog" data-evt-absence-dialog
        style="border:0; padding:0; background:transparent; max-width:520px; width:calc(100vw - 32px);">
  <form class="evt-checkin-form" data-evt-absence-form>
    <header>
      <span class="evt-eyebrow">不在の確認</span>
      <h2 class="evt-heading" style="margin-top:4px;">「いなかった」を残そう</h2>
      <p class="evt-lead">見つからなかったことも、研究では同じくらい貴重なデータ。</p>
    </header>
    <label>探した種
      <input type="text" name="searched_taxon" placeholder="例: ヤマセミ" required />
    </label>
    <label>探した時間
      <select name="effort_seconds" required>
        <option value="60">1 分</option>
        <option value="180">3 分</option>
        <option value="300" selected>5 分</option>
        <option value="600">10 分</option>
        <option value="1200">20 分</option>
      </select>
    </label>
    <label>確からしさ
      <select name="confidence">
        <option value="searched">探したけど分からない</option>
        <option value="confirmed_absent">この場所には居なかった</option>
      </select>
    </label>
    <div style="display:flex; gap:8px; justify-content:flex-end;">
      <button type="button" class="evt-btn evt-btn-ghost" data-evt-absence-close>キャンセル</button>
      <button type="submit" class="evt-btn evt-btn-primary">不在を記録</button>
    </div>
  </form>
</dialog>
`;
}

export function observationEventLiveScript(): string {
  return String.raw`
(() => {
  const root = document.querySelector(".evt-live-shell");
  if (!root) return;
  const sessionId = root.dataset.sessionId;
  const guestToken = root.dataset.guestToken || null;
  const targetSpeciesRaw = root.dataset.targetSpecies || "[]";
  let targetSpecies = [];
  try { targetSpecies = JSON.parse(targetSpeciesRaw) || []; } catch (_) {}

  const feedEl = root.querySelector("[data-evt-feed]");
  const feedCountEl = root.querySelector("[data-evt-feed-count]");
  const statObs = root.querySelector('[data-evt-stat="obs"]');
  const statSpecies = root.querySelector('[data-evt-stat="species"]');
  const statAbsence = root.querySelector('[data-evt-stat="absence"]');
  const meterBar = root.querySelector("[data-evt-meter-bar]");
  const meterValueEl = root.querySelector("[data-evt-meter-value]");
  const clockEl = root.querySelector("[data-evt-clock]");

  const obsState = { obs: 0, species: new Set(), absence: 0, hits: new Set(), feedItems: [] };

  function fmtTimeShort(iso){
    if (!iso) return "いま";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "いま";
    return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  }
  function nowTime(){
    const d = new Date();
    return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  function tickClock(){ if (clockEl) clockEl.textContent = nowTime(); }
  setInterval(tickClock, 1000); tickClock();

  function pushFeed(kind, html, ts){
    const item = document.createElement("div");
    item.className = "evt-live-feed-item " + (kind ? "is-" + kind : "");
    item.innerHTML = '<span class="evt-live-feed-icon">' + iconFor(kind) + '</span>' +
      '<span>' + html + '</span>' +
      '<span class="evt-live-feed-time">' + fmtTimeShort(ts) + '</span>';
    feedEl?.prepend(item);
    obsState.feedItems.push(item);
    while (feedEl && feedEl.children.length > 80) feedEl.lastElementChild?.remove();
  }
  function iconFor(kind){
    switch(kind){
      case "rare":     return "🪶";
      case "target":   return "🎯";
      case "quest":    return "✨";
      case "announce": return "📣";
      case "absence":  return "❌";
      case "milestone":return "🏁";
      case "fanfare":  return "🎉";
      default:         return "🌿";
    }
  }
  function refreshStats(){
    if (statObs) statObs.textContent = String(obsState.obs);
    if (statSpecies) statSpecies.textContent = String(obsState.species.size);
    if (statAbsence) statAbsence.textContent = String(obsState.absence);
    if (meterBar && meterValueEl){
      const total = targetSpecies.length || 1;
      const got = Array.from(obsState.hits).filter(t => targetSpecies.includes(t)).length;
      const pct = Math.min(100, (got / total) * 100);
      meterBar.style.width = pct + "%";
      meterValueEl.textContent = got + " / " + (targetSpecies.length || "—") + " 種";
    }
    if (feedCountEl) feedCountEl.textContent = obsState.obs + " 件";
  }

  function handleEvent(row){
    const payload = row.payload || {};
    const ts = row.created_at || row.createdAt;
    if (row.type === "observation_added"){
      obsState.obs++;
      pushObservationFeature(payload, ts);
      const taxon = payload.taxon_name || "未同定";
      if (taxon && taxon !== "未同定") {
        const wasNew = !obsState.species.has(taxon);
        obsState.species.add(taxon);
        obsState.hits.add(taxon);
        const isTarget = targetSpecies.includes(taxon);
        const kind = isTarget ? "target" : (wasNew ? "discovery" : "");
        pushFeed(kind, "<b>" + escapeText(taxon) + "</b> を発見", ts);
        if (isTarget && window.evtFanfare) window.evtFanfare(taxon + " 達成!");
      } else {
        pushFeed("", "観察を記録しました", ts);
      }
    }
    else if (row.type === "absence_recorded"){
      obsState.absence++;
      pushAbsenceFeature(payload, ts);
      pushFeed("absence", "<b>" + escapeText(payload.searched_taxon || "種不明") + "</b> を確かめた", ts);
    }
    else if (row.type === "rare_species"){
      pushFeed("rare", "希少種が記録されました(主催者通知)", ts);
    }
    else if (row.type === "target_hit"){
      pushFeed("target", "<b>" + escapeText(payload.taxon_name || "目標種") + "</b> を達成!", ts);
      if (window.evtFanfare) window.evtFanfare("目標達成!");
    }
    else if (row.type === "milestone"){
      pushFeed("milestone", "マイルストーン: " + escapeText(payload.message || ""), ts);
      if (window.evtFanfare) window.evtFanfare("マイルストーン!");
    }
    else if (row.type === "announce"){
      pushFeed("announce", "📣 " + escapeText(payload.message || ""), ts);
    }
    else if (row.type === "quest_offered"){
      pushFeed("quest", "<b>AI クエスト</b> " + escapeText(payload.headline || ""), ts);
      offerQuest(payload);
    }
    else if (row.type === "fanfare"){
      pushFeed("fanfare", escapeText(payload.message || "ファンファーレ!"), ts);
      if (window.evtFanfare) window.evtFanfare(payload.message || "");
    }
    refreshStats();
  }

  function escapeText(s){
    return String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ============ MapLibre 統合 ============
  const mapEl = root.querySelector("[data-evt-map]");
  let map = null;
  const observationFC = { type: "FeatureCollection", features: [] };
  const teamFC = { type: "FeatureCollection", features: [] };
  const absenceFC = { type: "FeatureCollection", features: [] };
  function ensureMaplibre(){
    return new Promise((resolve) => {
      if (window.maplibregl) return resolve(window.maplibregl);
      if (!document.querySelector("link[data-evt-maplibre-css]")){
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
        css.dataset.evtMaplibreCss = "1";
        document.head.appendChild(css);
      }
      if (!document.querySelector("script[data-evt-maplibre-js]")){
        const s = document.createElement("script");
        s.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
        s.async = true;
        s.dataset.evtMaplibreJs = "1";
        s.onload = () => resolve(window.maplibregl);
        document.head.appendChild(s);
      } else {
        const i = setInterval(() => { if (window.maplibregl){ clearInterval(i); resolve(window.maplibregl); } }, 60);
      }
    });
  }
  async function initMap(){
    if (!mapEl) return;
    const lat = Number(mapEl.dataset.centerLat || 35.0);
    const lng = Number(mapEl.dataset.centerLng || 138.0);
    const ml = await ensureMaplibre();
    if (!ml) return;
    map = new ml.Map({
      container: mapEl,
      style: {
        version: 8,
        sources: {
          gsi: {
            type: "raster",
            tiles: ["https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; 国土地理院"
          }
        },
        layers: [{ id: "gsi", type: "raster", source: "gsi" }]
      },
      center: [lng, lat],
      zoom: 14,
      attributionControl: { compact: true },
    });
    map.on("load", () => {
      map.addSource("evt-obs", { type: "geojson", data: observationFC });
      map.addLayer({
        id: "evt-obs-circle",
        type: "circle",
        source: "evt-obs",
        paint: {
          "circle-radius": 7,
          "circle-color": "#10b981",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-opacity": 0.92,
        },
      });
      map.addSource("evt-teams", { type: "geojson", data: teamFC });
      map.addLayer({
        id: "evt-teams-circle",
        type: "circle",
        source: "evt-teams",
        paint: {
          "circle-radius": 12,
          "circle-color": ["coalesce", ["get", "color"], "#0ea5e9"],
          "circle-opacity": 0.4,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      map.addSource("evt-absence", { type: "geojson", data: absenceFC });
      map.addLayer({
        id: "evt-absence-circle",
        type: "circle",
        source: "evt-absence",
        paint: {
          "circle-radius": 6,
          "circle-color": "#6366f1",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
          "circle-opacity": 0.7,
        },
      });
    });
  }
  void initMap();

  function pushObservationFeature(payload, ts){
    const lat = Number(payload?.lat), lng = Number(payload?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    observationFC.features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: { name: payload?.taxon_name ?? "", at: ts },
    });
    if (map?.getSource("evt-obs")) map.getSource("evt-obs").setData(observationFC);
  }
  function pushAbsenceFeature(payload, ts){
    const lat = Number(payload?.lat), lng = Number(payload?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    absenceFC.features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: { taxon: payload?.searched_taxon ?? "", at: ts },
    });
    if (map?.getSource("evt-absence")) map.getSource("evt-absence").setData(absenceFC);
  }

  // ============ 時系列リプレイ ============
  const replayToggle = document.querySelector("[data-replay-toggle]");
  const replayControls = document.querySelector("[data-replay-controls]");
  const replaySlider = document.querySelector("[data-replay-slider]");
  const replayClock = document.querySelector("[data-replay-clock]");
  let replayMode = false;
  function setReplayMode(on){
    replayMode = on;
    if (replayControls) replayControls.style.display = on ? "flex" : "none";
    if (replayToggle) replayToggle.textContent = on ? "✕ リアルタイムへ" : "⏮ リプレイ";
    if (on) renderReplayAt(Number(replaySlider?.value ?? 0));
    else if (map?.getSource("evt-obs")) map.getSource("evt-obs").setData(observationFC);
  }
  function renderReplayAt(pct){
    if (observationFC.features.length === 0) return;
    const total = observationFC.features.length;
    const idx = Math.max(0, Math.min(total, Math.round((pct / 100) * total)));
    const trimmed = { type: "FeatureCollection", features: observationFC.features.slice(0, idx) };
    if (map?.getSource("evt-obs")) map.getSource("evt-obs").setData(trimmed);
    const last = observationFC.features[Math.max(0, idx - 1)];
    if (replayClock && last?.properties?.at) {
      const d = new Date(last.properties.at);
      replayClock.textContent = isNaN(d.getTime()) ? "--:--" : d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    }
  }
  replayToggle?.addEventListener("click", () => setReplayMode(!replayMode));
  replaySlider?.addEventListener("input", (ev) => { if (replayMode) renderReplayAt(Number(ev.target.value)); });

  // SSE 接続
  let evtSource = null;
  let pollHandle = null;
  function connectSSE(){
    const tokenParam = guestToken ? "?guest_token=" + encodeURIComponent(guestToken) : "";
    const url = "/api/v1/observation-events/" + sessionId + "/live" + tokenParam;
    try { evtSource = new EventSource(url, { withCredentials: true }); }
    catch(_){ fallbackToPolling(); return; }
    evtSource.addEventListener("snapshot", (ev) => {
      try {
        const data = JSON.parse(ev.data);
        (data.events || []).forEach(handleEvent);
      } catch(_) {}
    });
    evtSource.addEventListener("live", (ev) => {
      try { handleEvent(JSON.parse(ev.data)); } catch(_) {}
    });
    evtSource.addEventListener("ping", () => { /* heartbeat */ });
    evtSource.addEventListener("error", () => {
      if (window.evtSetConn) window.evtSetConn("reconnect", "再接続中…");
      try { evtSource && evtSource.close(); } catch(_) {}
      evtSource = null;
      fallbackToPolling();
      setTimeout(() => { if (!evtSource) connectSSE(); }, 3000);
    });
  }
  function fallbackToPolling(){
    if (pollHandle) return;
    pollHandle = setInterval(async () => {
      try {
        const tokenParam = guestToken ? "&guest_token=" + encodeURIComponent(guestToken) : "";
        const r = await fetch("/api/v1/observation-events/" + sessionId + "/recent?limit=20" + tokenParam, { credentials: "include" });
        if (r.ok) {
          const data = await r.json();
          (data.events || []).slice().reverse().forEach(handleEvent);
        }
      } catch(_) {}
    }, 5000);
  }
  if (typeof EventSource !== "undefined") connectSSE(); else fallbackToPolling();

  // Quest dialog
  const questDialog = root.parentElement?.querySelector("[data-evt-quest-dialog]") || document.querySelector("[data-evt-quest-dialog]");
  const questHeadline = document.querySelector("[data-evt-quest-headline]");
  const questPrompt = document.querySelector("[data-evt-quest-prompt]");
  const questAccept = document.querySelector("[data-evt-quest-accept]");
  const questDecline = document.querySelector("[data-evt-quest-decline]");
  let activeQuestId = null;
  function offerQuest(payload){
    if (!payload || !payload.quest_id) return;
    activeQuestId = payload.quest_id;
    if (questHeadline) questHeadline.textContent = payload.headline || "AI Quest";
    if (questPrompt) questPrompt.textContent = payload.prompt || "";
    if (questDialog && typeof questDialog.showModal === "function") {
      try { questDialog.showModal(); } catch(_) {}
    }
  }
  async function decideQuest(decision){
    if (!activeQuestId) return;
    try {
      await fetch("/api/v1/observation-events/" + sessionId + "/quests/" + activeQuestId, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
    } catch(_) {}
    activeQuestId = null;
    if (questDialog && questDialog.open) questDialog.close();
    if (decision === "accepted" && window.evtFanfare) window.evtFanfare("クエスト受諾!");
  }
  questAccept?.addEventListener("click", () => decideQuest("accepted"));
  questDecline?.addEventListener("click", () => decideQuest("declined"));

  // Absence dialog
  const absenceDialog = document.querySelector("[data-evt-absence-dialog]");
  const absenceForm = document.querySelector("[data-evt-absence-form]");
  document.querySelectorAll('[data-action="searched"], [data-action="absent"]').forEach(btn => {
    btn.addEventListener("click", () => {
      if (!absenceDialog) return;
      const conf = btn.dataset.action === "absent" ? "confirmed_absent" : "searched";
      const select = absenceForm?.querySelector('[name="confidence"]');
      if (select) select.value = conf;
      try { absenceDialog.showModal(); } catch(_) {}
    });
  });
  document.querySelector("[data-evt-absence-close]")?.addEventListener("click", () => absenceDialog?.close());
  absenceForm?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(absenceForm);
    let lat = null, lng = null;
    if ("geolocation" in navigator) {
      try {
        const pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 }));
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch(_) { lat = 35.0; lng = 138.0; }
    }
    const payload = {
      searched_taxon: fd.get("searched_taxon"),
      effort_seconds: Number(fd.get("effort_seconds")),
      confidence: fd.get("confidence"),
      lat, lng,
      guest_token: guestToken,
    };
    try {
      const r = await fetch("/api/v1/observation-events/" + sessionId + "/absences", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (r.ok && window.evtFanfare) window.evtFanfare("不在を記録した");
    } catch(_) {}
    absenceDialog?.close();
  });

  // record button: open native record flow at /record with eventCode in query
  const recordBtn = document.querySelector('[data-action="record"]');
  recordBtn?.addEventListener("click", () => {
    const code = root.dataset.eventCode || "";
    const url = "/record" + (code ? "?event=" + encodeURIComponent(code) : "");
    window.location.href = url;
  });

  refreshStats();
})();
`;
}
