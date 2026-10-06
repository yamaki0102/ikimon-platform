import type { ObservationEventSessionRow } from "../services/observationEventModeManager.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSoloMicroSession(session: ObservationEventSessionRow): boolean {
  const config = session.config ?? {};
  const placeEvent = typeof config.place_event === "object" && config.place_event !== null
    ? config.place_event as Record<string, unknown>
    : {};
  return config.solo_observation === true || placeEvent.event_kind === "solo_micro_observation";
}

export function renderObservationRallyBody(args: {
  session: ObservationEventSessionRow;
  isOrganizer: boolean;
  recordHref?: string;
}): string {
  const { session, isOrganizer } = args;
  const recordHref = args.recordHref && /^(?:#[A-Za-z][A-Za-z0-9_-]*|\/(?!\/)[^\\\r\n]*)$/.test(args.recordHref)
    ? args.recordHref
    : "";
  const isSolo = isSoloMicroSession(session);
  const consoleLink = isOrganizer
    ? `<a class="evt-btn evt-btn-ghost" href="./console">主催者管制塔</a>`
    : "";
  return `
<section class="evt-recap-shell evt-rally-shell"
         data-rally-root
         data-session-id="${escapeHtml(session.sessionId)}"
         data-event-code="${escapeHtml(session.eventCode ?? "")}"
         data-record-href="${escapeHtml(recordHref)}"
         data-ended-at="${escapeHtml(session.endedAt ?? "")}"
         data-solo-observation="${isSolo ? "true" : "false"}"
         data-radius-m="${escapeHtml(String(session.locationRadiusM ?? 80))}">
  <article class="evt-hero evt-rally-hero">
    <div class="evt-rally-hero-main">
      <span class="evt-hero-eyebrow">${isSolo ? "一人観察会" : "観察ラリー"}</span>
      <h1>${escapeHtml(session.title || "観察ラリー")}</h1>
      <p>${isSolo ? "狭い範囲で、写真・気づき・見つからなかったことを迷わず残します。" : "次にやるミッションを確認して、見つけたものをすぐ記録できます。"}</p>
    </div>
    <div class="evt-rally-actions">
      <button type="button" class="evt-btn evt-btn-primary" data-rally-action="record">記録する</button>
      ${consoleLink}
      <button type="button" class="evt-btn evt-btn-on-dark" data-rally-location-start aria-pressed="false">位置共有を使う</button>
      <a class="evt-btn evt-btn-ghost" href="./live">ライブ地図</a>
    </div>
    <p class="evt-rally-consent">
      <strong>位置共有は任意です。</strong>
      <span>開催中だけ使います。</span>
      <span>参加者のライブ地図と主催者確認に限ります。</span>
      <span>終了後は自動で止まります。</span>
      <a href="/community/events/${escapeHtml(encodeURIComponent(session.eventCode ?? ""))}/join" data-rally-location-settings>位置共有の設定を確認</a>
    </p>
  </article>

  <p class="evt-lead" data-rally-status role="status" aria-live="polite" aria-atomic="true">進み具合を確認しています。</p>

  <section class="evt-card" style="display:grid; gap:10px;">
    <span class="evt-eyebrow">いまおすすめ</span>
    <h2 class="evt-heading" data-rally-next-action style="margin:0;">ミッションを読み込み中…</h2>
    <p class="evt-lead" data-rally-momentum>受け付けた発見から進み具合を確認できます。</p>
  </section>

  <section class="evt-card" style="display:grid; gap:12px;">
    <header style="display:flex; justify-content:space-between; gap:12px; align-items:center;">
      <div>
        <span class="evt-eyebrow">進み具合</span>
        <h2 class="evt-heading" style="margin:4px 0 0;">目標への進み具合</h2>
      </div>
      <span class="evt-badge evt-mode-quest" data-rally-top-percent>0%</span>
    </header>
    <div data-rally-live-bars style="display:grid; gap:10px;"></div>
  </section>

  <section class="evt-card" style="display:grid; gap:12px;">
    <header style="display:flex; justify-content:space-between; gap:12px; align-items:center;">
      <div>
        <span class="evt-eyebrow">進行中ミッション</span>
        <h2 class="evt-heading" style="margin:4px 0 0;">挑戦するミッション</h2>
      </div>
      <button type="button" class="evt-btn evt-btn-ghost" data-rally-refresh style="min-height:44px; min-width:4em; flex-shrink:0; padding:8px 12px;">更新</button>
    </header>
    <div data-rally-missions style="display:grid; gap:10px;"></div>
  </section>

  <section class="evt-card" style="display:grid; gap:12px;">
    <span class="evt-eyebrow">地点・範囲・ルート</span>
    <div data-rally-stations style="display:grid; gap:8px;"></div>
  </section>

  <footer class="evt-rally-action-dock" role="group" aria-label="観察アクション">
    <button class="evt-rally-action-btn is-primary" type="button" data-rally-action="record">
      <span class="evt-rally-action-icon">📷</span><span>記録する</span>
    </button>
    <button class="evt-rally-action-btn" type="button" data-rally-action="guide">
      <span class="evt-rally-action-icon">🧭</span><span>ガイド</span>
    </button>
    <button class="evt-rally-action-btn" type="button" data-rally-action="scan">
      <span class="evt-rally-action-icon">📡</span><span>スキャン</span>
    </button>
    <button class="evt-rally-action-btn" type="button" data-rally-action="help">
      <span class="evt-rally-action-icon">🆘</span><span>ヘルプ</span>
    </button>
  </footer>
</section>`;
}

export function observationRallyScript(): string {
  return String.raw`
(() => {
  const root = document.querySelector("[data-rally-root]");
  if (!root || root.dataset.rallyBound === "true") return;
  root.dataset.rallyBound = "true";
  const sessionId = root.dataset.sessionId;
  const eventCode = root.dataset.eventCode || "";
  const isSolo = root.dataset.soloObservation === "true";
  const radiusM = Number(root.dataset.radiusM || 80);
  const liveBars = root.querySelector("[data-rally-live-bars]");
  const missionList = root.querySelector("[data-rally-missions]");
  const stationList = root.querySelector("[data-rally-stations]");
  const nextAction = root.querySelector("[data-rally-next-action]");
  const momentum = root.querySelector("[data-rally-momentum]");
  const topPercent = root.querySelector("[data-rally-top-percent]");
  const status = root.querySelector("[data-rally-status]");
  const refreshButton = root.querySelector("[data-rally-refresh]");
  const locationButton = root.querySelector("[data-rally-location-start]");
  let snapshot = { course: null, stations: [], missions: [], progress: [] };
  let watchId = null;
  let locationGeneration = 0;
  let liveSource = null;
  let loadInFlight = false;
  let hasSnapshot = false;
  let readOnly = Boolean(root.dataset.endedAt && Date.parse(root.dataset.endedAt) <= Date.now());
  let endTimer = null;
  const pending = new Map();
  const submitting = new Set();
  const controllers = new Set();

  function setStatus(message){
    if (status) status.textContent = message;
  }
  function pendingKey(missionId){
    return "zukan:rally:pending:" + sessionId + ":" + missionId;
  }
  function pendingRequest(missionId){
    if (pending.has(missionId)) return pending.get(missionId).requestId;
    let value = null;
    try { value = sessionStorage.getItem(pendingKey(missionId)); } catch (_) {}
    if (value && value.length <= 512) {
      try {
        const saved = JSON.parse(value);
        if (/^[A-Za-z0-9_-]{16,128}$/.test(saved?.requestId || "") &&
            (saved.stationId === null || typeof saved.stationId === "string" && saved.stationId.length <= 160)) {
          pending.set(missionId, { requestId: saved.requestId, stationId: saved.stationId });
        }
      } catch (_) {
        if (/^[A-Za-z0-9_-]{16,128}$/.test(value)) pending.set(missionId, { requestId: value, stationId: null });
      }
    }
    return pending.get(missionId)?.requestId || null;
  }
  function requestId(missionId, stationId){
    const existing = pendingRequest(missionId);
    if (existing) return existing;
    const value = crypto.randomUUID();
    const saved = { requestId: value, stationId };
    pending.set(missionId, saved);
    try { sessionStorage.setItem(pendingKey(missionId), JSON.stringify(saved)); } catch (_) {}
    return value;
  }
  function forgetRequest(missionId){
    pending.delete(missionId);
    try { sessionStorage.removeItem(pendingKey(missionId)); } catch (_) {}
  }
  async function request(url, options = {}, readJson = true){
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, { ...options, credentials: "include", signal: controller.signal });
      let data = null;
      if (readJson) {
        try { data = await response.json(); } catch (error) { if (response.ok) throw error; }
      }
      return { ok: response.ok, status: response.status, data };
    } finally {
      clearTimeout(timeout);
      controllers.delete(controller);
    }
  }
  function stopLocation(){
    locationGeneration += 1;
    if (watchId !== null) navigator.geolocation?.clearWatch(watchId);
    watchId = null;
    if (locationButton) {
      locationButton.textContent = "位置共有を使う";
      locationButton.setAttribute("aria-pressed", "false");
    }
  }
  function applyReadOnly(value){
    readOnly = value;
    if (readOnly) stopLocation();
    if (locationButton) locationButton.disabled = readOnly;
  }
  function armEndTimer(){
    clearTimeout(endTimer);
    const endsAt = Date.parse(root.dataset.endedAt || "");
    if (!Number.isFinite(endsAt)) return;
    const remaining = endsAt - Date.now();
    if (remaining <= 0) {
      applyReadOnly(true);
      render();
      setStatus("開催は終了しました。これまでの結果を見返せます。");
      return;
    }
    endTimer = setTimeout(armEndTimer, Math.min(remaining, 60000));
  }

  function escapeText(s){
    return String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function unitLabel(unit){
    return ({
      scene: "件",
      individual: "本",
      location: "地点",
      comparison_pair: "組",
      station_clear: "クリア",
      team_completion: "班",
    })[unit] || "件";
  }
  function bindingLabel(binding){
    return ({
      none: "どこでも",
      station_required: "地点固定",
      within_area: "エリア内",
      near_route: "ルート沿い",
      any_registered_station: "登録地点のどこか",
    })[binding] || binding;
  }
  function progressFor(missionId){
    const rows = (snapshot.progress || []).filter(p => p.missionId === missionId || p.mission_id === missionId);
    return rows.find(p => (p.progressScope || p.progress_scope) === "event") || rows[0] || null;
  }
  function missionIdOf(m){ return m.missionId || m.mission_id; }
  function pendingSubmissionsFor(missionId){
    return (Array.isArray(snapshot.pendingSubmissions) ? snapshot.pendingSubmissions : [])
      .filter(receipt => receipt.missionId === missionId && receipt.reviewStatus === "pending");
  }
  function receiptNumber(receipt){
    const id = receipt.submissionId || receipt.submission_id;
    return typeof id === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(id) ? id.slice(-12) : "";
  }
  function stationIdOf(s){ return s.stationId || s.station_id; }
  function needsStationChoice(mission){
    return ["station_required", "any_registered_station"].includes(mission.locationBinding || mission.location_binding) &&
      !(mission.stationId || mission.station_id);
  }
  function openStations(){
    return (snapshot.stations || []).filter(station => station.status === "open");
  }
  function renderBar(mission, progress){
    const percent = Number(progress?.percent ?? 0);
    const actual = Number(progress?.actualCount ?? progress?.actual_count ?? 0);
    const goal = Number(mission.goalCount ?? mission.goal_count ?? 1);
    const unit = unitLabel(mission.countUnit || mission.count_unit);
    const width = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
    return '<div class="evt-rally-bar" style="display:grid; gap:5px;">' +
      '<div style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px; font-size:14px;">' +
        '<strong>' + escapeText(mission.title) + '</strong>' +
        '<span style="font-variant-numeric:tabular-nums;">' + actual + '/' + goal + unit + ' ' + Math.round(percent) + '%</span>' +
      '</div>' +
      '<div class="evt-live-progress-bar" role="progressbar" aria-label="' + escapeText(mission.title) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + width + '" aria-valuetext="' + actual + '/' + goal + escapeText(unit) + '"><span style="width:' + width + '%"></span></div>' +
    '</div>';
  }
  function render(){
    const missions = (snapshot.missions || []).filter(m => (m.status || "") === "published" || pendingRequest(missionIdOf(m)) || pendingSubmissionsFor(missionIdOf(m)).length > 0 || readOnly && m.status !== "draft");
    if (missions.length === 0 && isSolo) {
      if (topPercent) topPercent.textContent = "solo";
      if (nextAction) nextAction.textContent = "まず1枚、名前不明のまま写真で記録する";
      if (momentum) momentum.textContent = "半径" + Math.round(radiusM) + "mの中で、移動より観察角度を変える。";
      if (liveBars) {
        liveBars.innerHTML =
          '<div class="evt-solo-loop-grid">' +
            '<article><span>1</span><strong>3分止まる</strong><p>ベンチ・木陰・水辺など、動かずに音と動きを拾う。</p></article>' +
            '<article><span>2</span><strong>写真を1枚</strong><p>名前が不明でも、対象・周辺・足元のどれかを残す。</p></article>' +
            '<article><span>3</span><strong>見つからないも記録</strong><p>探した対象がいなければ不在確認で残す。</p></article>' +
          '</div>';
      }
      if (missionList) {
        missionList.innerHTML =
          '<article class="evt-card" style="padding:12px; display:grid; gap:8px;">' +
            '<span class="evt-eyebrow">一人用チェックリスト</span>' +
            '<h3 class="evt-heading" style="font-size:18px; margin:0;">同じ場所を3つの目で見る</h3>' +
            '<p class="evt-lead">上・横・足元の順に見て、1つでも気づいたら記録へ進みます。</p>' +
            '<button type="button" class="evt-btn evt-btn-primary" data-rally-action="record" style="justify-self:start; min-height:44px; padding:8px 14px;">写真記録へ</button>' +
          '</article>';
      }
      if (stationList) {
        stationList.innerHTML = '<p class="evt-lead">地点固定ミッションがなくても、この画面だけで現地ループを回せます。</p>';
      }
      return;
    }
    const top = missions
      .map(m => ({ m, p: progressFor(missionIdOf(m)) }))
      .sort((a,b) => Number(b.p?.percent || 0) - Number(a.p?.percent || 0))[0];
    if (topPercent) topPercent.textContent = Math.round(Number(top?.p?.percent || 0)) + "%";
    if (nextAction) {
      const next = missions.find(m => Number(progressFor(missionIdOf(m))?.percent || 0) < 100) || missions[0];
      nextAction.textContent = next ? next.title : "主催者がミッションを準備中です";
    }
    if (momentum) {
      if (top?.p && Number(top.p.percent) >= 200) {
        momentum.textContent = top.m.title + " が目標の " + Math.round(Number(top.p.percent)) + "% まで伸びています。";
      } else if (top?.p && Number(top.p.percent) >= 100) {
        momentum.textContent = top.m.title + " が達成済み。まだ伸ばせます。";
      } else {
        momentum.textContent = "地点ごとのミッションと、どこでも残せる記録が同時に進みます。";
      }
    }
    if (liveBars) {
      liveBars.innerHTML = missions.slice(0, 5).map(m => renderBar(m, progressFor(missionIdOf(m)))).join("")
        || '<p class="evt-lead">進行中のミッションはまだありません。</p>';
    }
    if (missionList) {
      missionList.innerHTML = missions.map(m => {
        const p = progressFor(missionIdOf(m));
        const percent = Math.round(Number(p?.percent || 0));
        const unit = unitLabel(m.countUnit || m.count_unit);
        const actual = Number(p?.actualCount ?? p?.actual_count ?? 0);
        const goal = Number(m.goalCount ?? m.goal_count ?? 1);
        const id = missionIdOf(m);
        const retry = pendingRequest(id);
        const acceptsNew = !readOnly && m.status === "published";
        const awaiting = pendingSubmissionsFor(id);
        const pendingNote = awaiting.length
          ? '<p class="evt-lead">あなたの発見 ' + awaiting.reduce((sum, receipt) => sum + Math.max(0, Number(receipt.countValue) || 0), 0) + escapeText(unit) + ' は主催者の確認待ちです。進み具合には確認後に反映されます。</p>' +
            '<details><summary style="min-height:44px;display:flex;align-items:center;cursor:pointer;">受付番号を確認</summary><ul>' + awaiting.map(receipt => '<li><code>' + escapeText(receiptNumber(receipt)) + '</code></li>').join("") + '</ul></details>'
          : '';
        const needsStation = needsStationChoice(m);
        const stations = openStations();
        const unavailableStation = needsStation && stations.length === 0 && !retry;
        const savedStationId = pending.get(id)?.stationId;
        const stationChoice = needsStation
          ? '<label style="display:grid;gap:6px;">観察した地点<select data-rally-station-for="' + escapeText(id) + '" style="min-height:44px;font:inherit;max-width:100%;"' + (retry || readOnly ? ' disabled' : '') + '><option value="">地点を選ぶ</option>' +
            stations.map(station => '<option value="' + escapeText(stationIdOf(station)) + '"' + (savedStationId === stationIdOf(station) ? ' selected' : '') + '>' + escapeText(station.name || station.code || "地点") + '</option>').join("") + '</select></label>' +
            (unavailableStation ? '<p class="evt-lead">現在選べる地点がありません。主催者に確認してください。</p>' : '')
          : '';
        return '<article class="evt-card" style="padding:12px; display:grid; gap:8px;">' +
          '<div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start;">' +
            '<div><span class="evt-eyebrow">' + escapeText(bindingLabel(m.locationBinding || m.location_binding)) + '</span>' +
            '<h3 class="evt-heading" style="font-size:18px; margin:3px 0 0;">' + escapeText(m.title) + '</h3></div>' +
            '<span class="evt-badge evt-mode-quest">' + percent + '%</span>' +
          '</div>' +
          '<p class="evt-lead">目標: ' + actual + '/' + goal + unit + '。' + escapeText(m.target || "") + '</p>' +
          pendingNote +
          stationChoice +
          '<button type="button" class="evt-btn evt-btn-primary" data-rally-submit="' + escapeText(id) + '"' + (!acceptsNew && !retry || submitting.has(id) || unavailableStation ? ' disabled' : '') + ' style="justify-self:start; min-height:44px; padding:8px 14px;">' + (submitting.has(id) ? '送信を確認中…' : retry ? '同じ発見の送信を再確認' : !acceptsNew ? '現在は受付していません' : 'この発見を1つ追加') + '</button>' +
        '</article>';
      }).join("") || '<p class="evt-lead">主催者がミッションを準備中です。</p>';
      if (snapshot.pendingSubmissionsHasMore) missionList.innerHTML += '<p class="evt-lead">確認待ちの受付がほかにもあります。表示中の分を主催者が確認すると、続きが表示されます。</p>';
    }
    if (stationList) {
      stationList.innerHTML = (snapshot.stations || []).map(s => {
        return '<article class="evt-card" style="padding:10px 12px;">' +
          '<span class="evt-eyebrow">' + escapeText(s.code || "地点") + (s.isPrivate || s.is_private ? ' / 私有地' : '') + '</span>' +
          '<strong style="display:block; margin-top:3px;">' + escapeText(s.name || "地点") + '</strong>' +
          '<p class="evt-lead" style="font-size:14px; margin-top:3px;">' + escapeText(s.dangerNote || s.danger_note || s.accessNote || s.access_note || "") + '</p>' +
        '</article>';
      }).join("") || '<p class="evt-lead">地点固定ミッションがある場合、ここに地点が出ます。</p>';
    }
  }
  async function loadSnapshot(announce = false){
    if (loadInFlight) return;
    loadInFlight = true;
    if (refreshButton) refreshButton.disabled = true;
    try {
      const r = await request("/api/v1/observation-events/" + sessionId + "/rally");
      if (!r.ok || !r.data?.rally) throw new Error("snapshot_unavailable");
      snapshot = r.data.rally;
      hasSnapshot = true;
      const timedOut = Boolean(root.dataset.endedAt && Date.parse(root.dataset.endedAt) <= Date.now());
      applyReadOnly(timedOut || snapshot.readOnly === true);
      render();
      if (announce || !status?.textContent || status.textContent === "進み具合を確認しています。") {
        setStatus(readOnly ? "現在は受付時間外です。これまでの結果を見返せます。" : "進み具合を更新しました。");
      }
    } catch (_) {
      if (!hasSnapshot && nextAction) nextAction.textContent = "ミッションを読み込めませんでした";
      setStatus("進み具合を確認できませんでした。通信を確認して「更新」を押してください。送信済みの発見は取り消されません。");
    } finally {
      loadInFlight = false;
      if (refreshButton) refreshButton.disabled = false;
    }
  }
  async function submitMission(missionId){
    if (!missionId || readOnly && !pendingRequest(missionId) || submitting.has(missionId)) return;
    const mission = (snapshot.missions || []).find(item => missionIdOf(item) === missionId);
    if (!mission) return;
    if (mission.status !== "published" && !pendingRequest(missionId)) return;
    let stationId = pending.get(missionId)?.stationId || mission.stationId || mission.station_id || null;
    if (!pendingRequest(missionId) && needsStationChoice(mission)) {
      const selector = root.querySelectorAll("[data-rally-station-for]");
      const selected = Array.from(selector).find(control => control.getAttribute("data-rally-station-for") === missionId);
      stationId = selected?.value || null;
      if (!openStations().some(station => stationIdOf(station) === stationId)) {
        setStatus("観察した地点を選んでから、発見を追加してください。");
        selected?.focus();
        return;
      }
    }
    submitting.add(missionId);
    try {
      const payload = { mission_id: missionId, source_type: "manual_rally", count_value: 1, request_id: requestId(missionId, stationId), ...(stationId ? { station_id: stationId } : {}) };
      render();
      setStatus("発見の送信を確認しています。画面を閉じずにお待ちください。");
      const r = await request("/api/v1/observation-events/" + sessionId + "/rally/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok || !r.data?.submission) {
        if ([401, 403].includes(r.status)) {
          setStatus("参加状態を確認できませんでした。参加ページで状態を確認してから、同じ発見の送信を再確認してください。");
        } else if (r.status === 409) {
          setStatus("この発見は追加できませんでした。最新の進み具合を確認し、解決しない場合は主催者にお知らせください。");
        } else {
          setStatus("送信結果を確認できませんでした。同じ発見の送信を再確認してください。確認できるまで新しい発見として追加しません。");
        }
        return;
      }
      forgetRequest(missionId);
      const reviewStatus = r.data.submission.reviewStatus || r.data.submission.review_status;
      const receipt = receiptNumber(r.data.submission);
      const receiptMessage = receipt ? " 受付番号: " + receipt : "";
      setStatus((reviewStatus === "pending" ? "発見を受け付けました。主催者の確認後に進み具合へ反映されます。" : r.data.replayed ? "この発見はすでに受け付けています。重ねて加算していません。" : "発見を追加しました。") + receiptMessage);
      if (!r.data.replayed && window.evtFanfare) window.evtFanfare("ラリーに追加");
      await loadSnapshot();
    } catch (_) {
      setStatus("通信が途切れたため、送信結果を確認できませんでした。同じ発見の送信を再確認してください。");
    } finally {
      submitting.delete(missionId);
      render();
    }
  }
  root.addEventListener("click", (ev) => {
    const target = ev.target instanceof Element ? ev.target.closest("[data-rally-submit]") : null;
    if (target) {
      ev.preventDefault();
      void submitMission(target.getAttribute("data-rally-submit"));
    }
    const actionBtn = ev.target instanceof Element ? ev.target.closest("[data-rally-action]") : null;
    if (actionBtn) {
      ev.preventDefault();
      runRallyAction(actionBtn.getAttribute("data-rally-action"));
    }
  });
  refreshButton?.addEventListener("click", () => void loadSnapshot(true));
  locationButton?.addEventListener("click", () => {
    if (readOnly) {
      setStatus("現在は位置共有の受付時間外です。共有せずに結果を見返せます。");
      return;
    }
    if (!navigator.geolocation) {
      setStatus("このブラウザーでは位置情報を使えません。位置共有なしで参加を続けられます。");
      return;
    }
    if (watchId !== null) {
      stopLocation();
      setStatus("位置共有を停止しました。位置共有なしで参加を続けられます。");
      return;
    }
    const generation = ++locationGeneration;
    watchId = navigator.geolocation.watchPosition(async (pos) => {
      if (generation !== locationGeneration || readOnly || document.hidden) return;
      try {
        const r = await request("/api/v1/observation-events/" + sessionId + "/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        }, false);
        if (generation !== locationGeneration) return;
        if (r.status === 403) {
          stopLocation();
          setStatus("位置共有を停止しました。参加ページで「位置共有の設定を確認」できます。共有せずに参加を続けられます。");
          return;
        }
        if (!r.ok) throw new Error("location_unavailable");
        setStatus("開催中の位置共有を受け付けました。ボタンを押すと停止できます。");
      } catch (_) {
        if (generation !== locationGeneration) return;
        stopLocation();
        setStatus("位置共有を確認できなかったため停止しました。位置共有なしで参加を続けられます。");
      }
    }, () => {
      if (generation !== locationGeneration) return;
      stopLocation();
      setStatus("位置情報を取得できませんでした。許可しなくても参加を続けられます。");
    }, { enableHighAccuracy: false, maximumAge: 30000, timeout: 8000 });
    locationButton.textContent = "位置共有を止める";
    locationButton.setAttribute("aria-pressed", "true");
    setStatus("位置情報を確認しています。許可するか選べます。");
  });
  function runRallyAction(action){
      if ((action === "record" || action === "scan") && root.dataset.recordHref) {
        window.location.href = root.dataset.recordHref;
        return;
      }
      const params = new URLSearchParams();
      if (eventCode) params.set("event", eventCode);
      params.set("eventSessionId", sessionId);
      params.set("rally", "1");
      params.set("activityIntent", "share");
      if (action === "guide") window.location.href = "/guide?" + params.toString();
      else if (action === "scan") {
        params.set("fieldScanMode", "site_snapshot");
        params.set("start", "photo");
        window.location.href = "/record?" + params.toString();
      } else if (action === "help") {
        if (isSolo) {
          alert("一人観察会では、迷ったら同じ場所で3分止まってから写真記録に戻る。危険なら中止してください。");
          return;
        }
        void request("/api/v1/observation-events/" + sessionId + "/announce", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "ヘルプ要請がありました" }),
        }, false).then(r => {
          setStatus(r.ok ? "ヘルプ要請を受け付けました。近くのスタッフにもお知らせください。" : "ヘルプ要請を送れませんでした。近くのスタッフに直接お知らせください。");
        }).catch(() => setStatus("ヘルプ要請を確認できませんでした。近くのスタッフに直接お知らせください。"));
      } else {
        params.set("start", "photo");
        window.location.href = "/record?" + params.toString();
      }
  }
  function handleLive(row){
    if (String(row.type || "").startsWith("rally_")) {
      void loadSnapshot();
      if (row.type === "rally_goal_exceeded" && window.evtFanfare) {
        window.evtFanfare("目標 " + (row.payload?.threshold || "") + "%");
      }
    }
  }
  function connectSse(){
    if (typeof EventSource === "undefined" || liveSource || document.hidden) return;
    const es = new EventSource("/api/v1/observation-events/" + sessionId + "/live", { withCredentials: true });
    liveSource = es;
    es.addEventListener("snapshot", ev => {
      try {
        const data = JSON.parse(ev.data);
        if (["ended", "cancelled"].includes(data.session?.status)) {
          applyReadOnly(true);
          render();
        }
        (data.events || []).forEach(handleLive);
        void loadSnapshot();
      } catch (_) {}
    });
    es.addEventListener("live", ev => {
      try { handleLive(JSON.parse(ev.data)); } catch (_) {}
    });
  }
  function closeLive(){
    liveSource?.close();
    liveSource = null;
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopLocation();
      closeLive();
    } else {
      armEndTimer();
      void loadSnapshot();
      connectSse();
    }
  });
  window.addEventListener("pagehide", () => {
    stopLocation();
    closeLive();
    clearTimeout(endTimer);
    for (const controller of controllers) controller.abort();
  });
  window.addEventListener("pageshow", () => {
    armEndTimer();
    void loadSnapshot();
    connectSse();
  });
  applyReadOnly(readOnly);
  armEndTimer();
  void loadSnapshot();
  connectSse();
})();
`;
}
