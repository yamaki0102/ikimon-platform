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
  guestToken: string | null;
  isOrganizer: boolean;
}): string {
  const { session, guestToken, isOrganizer } = args;
  const isSolo = isSoloMicroSession(session);
  const consoleLink = isOrganizer
    ? `<a class="evt-btn evt-btn-ghost" href="./console">主催者管制塔</a>`
    : "";
  return `
<section class="evt-recap-shell evt-rally-shell"
         data-rally-root
         data-session-id="${escapeHtml(session.sessionId)}"
         data-event-code="${escapeHtml(session.eventCode ?? "")}"
         data-guest-token="${escapeHtml(guestToken ?? "")}"
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
      <button type="button" class="evt-btn evt-btn-on-dark" data-rally-location-start>位置共有を使う</button>
      <a class="evt-btn evt-btn-ghost" href="./live">ライブ地図</a>
    </div>
    <p class="evt-rally-consent">
      <strong>位置共有は任意です。</strong>
      <span>開催中だけ使います。</span>
      <span>参加者のライブ地図と主催者確認に限ります。</span>
      <span>終了後は自動で止まります。</span>
    </p>
  </article>

  <section class="evt-card" style="display:grid; gap:10px;">
    <span class="evt-eyebrow">いまおすすめ</span>
    <h2 class="evt-heading" data-rally-next-action style="margin:0;">ミッションを読み込み中…</h2>
    <p class="evt-lead" data-rally-momentum>みんなの達成状況がここに流れます。</p>
  </section>

  <section class="evt-card" style="display:grid; gap:12px;">
    <header style="display:flex; justify-content:space-between; gap:12px; align-items:center;">
      <div>
        <span class="evt-eyebrow">ライブ達成バー</span>
        <h2 class="evt-heading" style="margin:4px 0 0;">全体の伸び</h2>
      </div>
      <span class="evt-badge evt-mode-quest" data-rally-top-percent>0%</span>
    </header>
    <div data-rally-live-bars style="display:grid; gap:10px;"></div>
  </section>

  <section class="evt-card" style="display:grid; gap:12px;">
    <header style="display:flex; justify-content:space-between; gap:12px; align-items:center;">
      <div>
        <span class="evt-eyebrow">進行中ミッション</span>
        <h2 class="evt-heading" style="margin:4px 0 0;">地点固定も全体目標もここに並びます</h2>
      </div>
      <button type="button" class="evt-btn evt-btn-ghost" data-rally-refresh style="min-height:36px; padding:6px 12px;">更新</button>
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
  if (!root) return;
  const sessionId = root.dataset.sessionId;
  let guestToken = root.dataset.guestToken || readStoredGuestToken();
  const eventCode = root.dataset.eventCode || "";
  const isSolo = root.dataset.soloObservation === "true";
  const radiusM = Number(root.dataset.radiusM || 80);
  const liveBars = root.querySelector("[data-rally-live-bars]");
  const missionList = root.querySelector("[data-rally-missions]");
  const stationList = root.querySelector("[data-rally-stations]");
  const nextAction = root.querySelector("[data-rally-next-action]");
  const momentum = root.querySelector("[data-rally-momentum]");
  const topPercent = root.querySelector("[data-rally-top-percent]");
  let snapshot = { course: null, stations: [], missions: [], progress: [] };
  let watchId = null;
  function readStoredGuestToken(){
    try { return localStorage.getItem("evt-guest-token") || ""; } catch (_) { return ""; }
  }
  function ensureRallyGuestToken(label){
    if (guestToken) return guestToken;
    guestToken = readStoredGuestToken();
    if (!guestToken) {
      guestToken = "g_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
      try { localStorage.setItem("evt-guest-token", guestToken); } catch (_) {}
    }
    root.dataset.guestToken = guestToken;
    if (label && window.evtFanfare) window.evtFanfare(label);
    return guestToken;
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
    return snapshot.progress.find(p => p.missionId === missionId || p.mission_id === missionId) || null;
  }
  function missionIdOf(m){ return m.missionId || m.mission_id; }
  function stationIdOf(s){ return s.stationId || s.station_id; }
  function renderBar(mission, progress){
    const percent = Number(progress?.percent ?? 0);
    const actual = Number(progress?.actualCount ?? progress?.actual_count ?? 0);
    const goal = Number(mission.goalCount ?? mission.goal_count ?? 1);
    const unit = unitLabel(mission.countUnit || mission.count_unit);
    const width = Math.min(220, Math.max(0, percent));
    return '<div class="evt-rally-bar" style="display:grid; gap:5px;">' +
      '<div style="display:flex; justify-content:space-between; gap:8px; font-size:13px;">' +
        '<strong>' + escapeText(mission.title) + '</strong>' +
        '<span style="font-variant-numeric:tabular-nums;">' + actual + '/' + goal + unit + ' ' + Math.round(percent) + '%</span>' +
      '</div>' +
      '<div class="evt-live-progress-bar"><span style="width:' + width + '%"></span></div>' +
    '</div>';
  }
  function render(){
    const missions = (snapshot.missions || []).filter(m => (m.status || "") === "published");
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
            '<button type="button" class="evt-btn evt-btn-primary" data-rally-action="record" style="justify-self:start; min-height:38px; padding:7px 14px;">写真記録へ</button>' +
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
        momentum.textContent = "地点でやることと、どこでも足せる記録が同時に進みます。";
      }
    }
    if (liveBars) {
      liveBars.innerHTML = missions.slice(0, 5).map(m => renderBar(m, progressFor(missionIdOf(m)))).join("")
        || '<p class="evt-lead">進行中のミッションはまだありません。</p>';
    }
    if (missionList) {
      missionList.innerHTML = missions.slice(0, 8).map(m => {
        const p = progressFor(missionIdOf(m));
        const percent = Math.round(Number(p?.percent || 0));
        const unit = unitLabel(m.countUnit || m.count_unit);
        const actual = Number(p?.actualCount ?? p?.actual_count ?? 0);
        const goal = Number(m.goalCount ?? m.goal_count ?? 1);
        return '<article class="evt-card" style="padding:12px; display:grid; gap:8px;">' +
          '<div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start;">' +
            '<div><span class="evt-eyebrow">' + escapeText(bindingLabel(m.locationBinding || m.location_binding)) + ' / ' + escapeText(m.countUnit || m.count_unit) + '</span>' +
            '<h3 class="evt-heading" style="font-size:18px; margin:3px 0 0;">' + escapeText(m.title) + '</h3></div>' +
            '<span class="evt-badge evt-mode-quest">' + percent + '%</span>' +
          '</div>' +
          '<p class="evt-lead">目標: ' + actual + '/' + goal + unit + '。' + escapeText(m.target || "") + '</p>' +
          '<button type="button" class="evt-btn evt-btn-primary" data-rally-submit="' + escapeText(missionIdOf(m)) + '" style="justify-self:start; min-height:38px; padding:7px 14px;">この発見を1つ追加</button>' +
        '</article>';
      }).join("") || '<p class="evt-lead">主催者がミッションを準備中です。</p>';
    }
    if (stationList) {
      stationList.innerHTML = (snapshot.stations || []).map(s => {
        return '<article class="evt-card" style="padding:10px 12px;">' +
          '<span class="evt-eyebrow">' + escapeText(s.code || "地点") + (s.isPrivate || s.is_private ? ' / 私有地' : '') + '</span>' +
          '<strong style="display:block; margin-top:3px;">' + escapeText(s.name || "地点") + '</strong>' +
          '<p class="evt-lead" style="font-size:13px; margin-top:3px;">' + escapeText(s.dangerNote || s.danger_note || s.accessNote || s.access_note || "") + '</p>' +
        '</article>';
      }).join("") || '<p class="evt-lead">地点固定ミッションがある場合、ここに地点が出ます。</p>';
    }
  }
  async function loadSnapshot(){
    const r = await fetch("/api/v1/observation-events/" + sessionId + "/rally", { credentials: "include" });
    if (!r.ok) return;
    const data = await r.json();
    snapshot = data.rally || snapshot;
    render();
  }
  async function submitMission(missionId){
    const token = ensureRallyGuestToken("この記録でラリー参加を開始");
    const payload = { mission_id: missionId, guest_token: token, source_type: "manual_rally", count_value: 1 };
    const r = await fetch("/api/v1/observation-events/" + sessionId + "/rally/submissions", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      alert("追加できませんでした。主催者がミッションを一時停止している可能性があります。");
      return;
    }
    if (window.evtFanfare) window.evtFanfare("ラリーに追加");
    await loadSnapshot();
  }
  root.addEventListener("click", (ev) => {
    const target = ev.target instanceof Element ? ev.target.closest("[data-rally-submit]") : null;
    if (target) void submitMission(target.getAttribute("data-rally-submit"));
    const actionBtn = ev.target instanceof Element ? ev.target.closest("[data-rally-action]") : null;
    if (actionBtn) {
      ev.preventDefault();
      runRallyAction(actionBtn.getAttribute("data-rally-action"));
    }
  });
  root.querySelector("[data-rally-refresh]")?.addEventListener("click", () => void loadSnapshot());
  root.querySelector("[data-rally-location-start]")?.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("このブラウザでは位置情報を使えません。");
      return;
    }
    if (watchId !== null) return;
    const token = ensureRallyGuestToken("ラリー参加を開始");
    watchId = navigator.geolocation.watchPosition(async (pos) => {
      try {
        await fetch("/api/v1/observation-events/" + sessionId + "/location", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guest_token: token,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        });
      } catch (_) {}
    }, () => undefined, { enableHighAccuracy: false, maximumAge: 30000, timeout: 8000 });
    if (window.evtFanfare) window.evtFanfare("開催中の位置共有を開始");
  });
  function runRallyAction(action){
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
        fetch("/api/v1/observation-events/" + sessionId + "/announce", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "ヘルプ要請がありました" }),
        }).catch(() => undefined);
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
    if (typeof EventSource === "undefined") return;
    const tokenParam = guestToken ? "?guest_token=" + encodeURIComponent(guestToken) : "";
    const es = new EventSource("/api/v1/observation-events/" + sessionId + "/live" + tokenParam, { withCredentials: true });
    es.addEventListener("snapshot", ev => {
      try { (JSON.parse(ev.data).events || []).forEach(handleLive); } catch (_) {}
    });
    es.addEventListener("live", ev => {
      try { handleLive(JSON.parse(ev.data)); } catch (_) {}
    });
  }
  void loadSnapshot();
  connectSse();
})();
`;
}
