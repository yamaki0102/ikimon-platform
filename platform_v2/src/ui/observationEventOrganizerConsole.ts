import type { ObservationEventSessionRow } from "../services/observationEventModeManager.js";
import { EVENT_MODES, MODE_METERS } from "../services/observationEventModeManager.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const MODE_LABEL: Record<string, string> = {
  discovery: "発見",
  effort_maximize: "努力量",
  bingo: "ビンゴ",
  absence_confirm: "不在確認",
  ai_quest: "AI クエスト",
};

const MODE_BADGE_CLS: Record<string, string> = {
  discovery: "discovery",
  effort_maximize: "effort",
  bingo: "bingo",
  absence_confirm: "absence",
  ai_quest: "quest",
};

export function renderOrganizerConsoleBody(session: ObservationEventSessionRow): string {
  const meter = MODE_METERS[session.primaryMode] ?? MODE_METERS.discovery;

  const modeButtons = EVENT_MODES.map((mode) => {
    const cls = mode === session.primaryMode ? "evt-mode-pill is-active" : "evt-mode-pill";
    return `<button type="button" class="${cls}" data-organizer-mode="${mode}">${MODE_LABEL[mode] ?? mode}</button>`;
  }).join("");

  return `
<section class="evt-console-shell" data-session-id="${escapeHtml(session.sessionId)}">
  <aside class="evt-console-side">
    <header style="display:flex; align-items:center; gap:8px;">
      <span class="evt-badge evt-mode-${MODE_BADGE_CLS[session.primaryMode] ?? "discovery"} is-live">LIVE</span>
      <span class="evt-eyebrow">${escapeHtml(MODE_LABEL[session.primaryMode] ?? "発見")} モード</span>
    </header>
    <h1 class="evt-heading" style="margin:4px 0 6px;">${escapeHtml(session.title || "観察会")}</h1>
    <p class="evt-lead">主催者管制塔。班・モード・アナウンスをここから操作する。</p>

    <div class="evt-console-mode-switch" role="group" aria-label="モード切替">
      ${modeButtons}
    </div>

    <div>
      <span class="evt-eyebrow">アナウンス</span>
      <form data-organizer-announce style="display:grid; gap:8px; margin-top:6px;">
        <textarea name="message" placeholder="例: 集合5分前です。順次戻ってきてください。"
                  rows="3" required
                  style="border:1px solid var(--evt-line); border-radius:14px; padding:10px 12px; font: inherit; min-height:72px;"></textarea>
        <button type="submit" class="evt-btn evt-btn-primary">全員に配信</button>
      </form>
    </div>

    <div>
      <span class="evt-eyebrow">AI クエスト</span>
      <p class="evt-lead" style="margin:6px 0;">5 分周期で自動配信中。即時発火も可能。</p>
      <button type="button" class="evt-btn evt-btn-ghost" data-organizer-quest-run>いま 1 セット発火</button>
    </div>

    <div>
      <span class="evt-eyebrow">参加リンク</span>
      <p class="evt-lead" style="margin:6px 0;">参加コード: <b style="font-family:'Roboto Mono',monospace; font-size:18px;">${escapeHtml(session.eventCode ?? "—")}</b></p>
      <p class="evt-lead">QR は <code>/community/events/${escapeHtml(session.eventCode ?? "")}/join</code> を読み込ませる。</p>
    </div>

    <div style="display:grid; gap:8px;">
      <a class="evt-btn evt-btn-ghost" href="../live">参加者ライブ画面へ</a>
      <a class="evt-btn evt-btn-ghost" href="../rally">観察ラリー画面へ</a>
      <a class="evt-btn evt-btn-ghost" href="./edit">⚙ 観察会を編集</a>
      <a class="evt-btn evt-btn-ghost" href="./recap">📊 振り返り(終了後も常に有効)</a>
      <button type="button" class="evt-btn evt-btn-danger" data-organizer-end>セッションを終了</button>
    </div>
  </aside>

  <main class="evt-console-main">
    <header style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <span class="evt-eyebrow">セッション統計</span>
        <h2 class="evt-heading" style="margin-top:4px;">いま起きていること</h2>
      </div>
      <span data-evt-clock style="font-variant-numeric: tabular-nums; font-weight:850; font-size:18px;">--:--:--</span>
    </header>

    <div class="evt-console-grid">
      <div class="evt-console-meter" data-mode="discovery">
        <span class="evt-eyebrow">参加</span>
        <strong class="evt-console-meter-value" data-evt-stat="participants">0</strong>
        <span class="evt-lead">チェックイン済</span>
      </div>
      <div class="evt-console-meter" data-mode="discovery">
        <span class="evt-eyebrow">観察</span>
        <strong class="evt-console-meter-value" data-evt-stat="obs">0</strong>
        <span class="evt-lead">${escapeHtml(meter.label)} (${escapeHtml(meter.unit)})</span>
      </div>
      <div class="evt-console-meter" data-mode="absence">
        <span class="evt-eyebrow">不在</span>
        <strong class="evt-console-meter-value" data-evt-stat="absence">0</strong>
        <span class="evt-lead">確かめた数</span>
      </div>
      <div class="evt-console-meter" data-mode="bingo">
        <span class="evt-eyebrow">クエスト</span>
        <strong class="evt-console-meter-value" data-evt-stat="quests">0</strong>
        <span class="evt-lead">受諾→達成</span>
      </div>
    </div>

    <section class="evt-card" style="display:grid; gap:12px; padding:14px;">
      <header style="display:flex; justify-content:space-between; gap:12px; align-items:center;">
        <div>
          <span class="evt-eyebrow">観察ラリー</span>
          <h2 class="evt-heading" style="margin-top:4px;">地点固定と全体ミッションを同時に運用</h2>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
          <button type="button" class="evt-btn evt-btn-ghost" data-rally-weather-rain style="min-height:36px; padding:6px 14px;">雨天モードに切替</button>
          <button type="button" class="evt-btn evt-btn-ghost" data-rally-refresh style="min-height:36px; padding:6px 14px;">再読込</button>
        </div>
      </header>

      <div data-rally-summary style="display:grid; gap:8px;"></div>

      <details>
        <summary style="cursor:pointer; font-weight:700; padding:6px 0;">地点を追加</summary>
        <form data-rally-station-form style="display:grid; gap:8px; margin-top:8px;">
          <input name="name" required placeholder="例: A地点 企業前の街路樹" style="border:1px solid var(--evt-line); border-radius:12px; padding:8px 12px; font:inherit;" />
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <input name="lat" type="number" step="0.000001" placeholder="緯度" style="border:1px solid var(--evt-line); border-radius:12px; padding:8px 12px; font:inherit;" />
            <input name="lng" type="number" step="0.000001" placeholder="経度" style="border:1px solid var(--evt-line); border-radius:12px; padding:8px 12px; font:inherit;" />
          </div>
          <input name="danger_note" placeholder="注意点（道路横、川沿い、私有地など）" style="border:1px solid var(--evt-line); border-radius:12px; padding:8px 12px; font:inherit;" />
          <label style="display:flex; gap:8px; align-items:center;"><input type="checkbox" name="is_private" /> 私有地・企業敷地を含む</label>
          <button type="submit" class="evt-btn evt-btn-primary">地点を追加</button>
        </form>
      </details>

      <details open>
        <summary style="cursor:pointer; font-weight:700; padding:6px 0;">ミッションを追加</summary>
        <form data-rally-mission-form style="display:grid; gap:8px; margin-top:8px;">
          <input name="title" required placeholder="例: 街路樹シーンを20件集める" style="border:1px solid var(--evt-line); border-radius:12px; padding:8px 12px; font:inherit;" />
          <input name="target" required placeholder="対象（例: 街路樹、樹皮、水辺、落ち葉）" style="border:1px solid var(--evt-line); border-radius:12px; padding:8px 12px; font:inherit;" />
          <input name="fallback_group" placeholder="差し替えグループ（例: tree-main。雨天用と同じ値にする）" style="border:1px solid var(--evt-line); border-radius:12px; padding:8px 12px; font:inherit;" />
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <select name="count_unit" style="border:1px solid var(--evt-line); border-radius:12px; padding:8px 12px; font:inherit;">
              <option value="scene">シーン</option>
              <option value="individual">個体</option>
              <option value="location">地点</option>
              <option value="comparison_pair">比較ペア</option>
              <option value="station_clear">地点クリア</option>
              <option value="team_completion">班達成</option>
            </select>
            <input name="goal_count" required type="number" min="1" value="20" style="border:1px solid var(--evt-line); border-radius:12px; padding:8px 12px; font:inherit;" />
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <select name="location_binding" data-rally-location-binding style="border:1px solid var(--evt-line); border-radius:12px; padding:8px 12px; font:inherit;">
              <option value="none">場所非限定</option>
              <option value="station_required">地点固定</option>
              <option value="within_area">エリア内</option>
              <option value="near_route">ルート沿い</option>
              <option value="any_registered_station">登録地点のどこか</option>
            </select>
            <select name="station_id" data-rally-station-select style="border:1px solid var(--evt-line); border-radius:12px; padding:8px 12px; font:inherit;">
              <option value="">地点なし</option>
            </select>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <select name="verification_policy" style="border:1px solid var(--evt-line); border-radius:12px; padding:8px 12px; font:inherit;">
              <option value="auto">自動カウント</option>
              <option value="organizer_review">主催者承認</option>
              <option value="ai_assisted">AI補助確認</option>
              <option value="qr">QR</option>
            </select>
            <select name="weather_sensitivity" style="border:1px solid var(--evt-line); border-radius:12px; padding:8px 12px; font:inherit;">
              <option value="all_weather">全天候</option>
              <option value="rain_ok">雨OK</option>
              <option value="dry_only">乾燥時のみ</option>
              <option value="sunny_only">晴天時のみ</option>
              <option value="wind_sensitive">強風注意</option>
              <option value="temperature_sensitive">気温依存</option>
            </select>
          </div>
          <button type="submit" class="evt-btn evt-btn-primary">ミッションを公開</button>
        </form>
      </details>

      <div data-rally-mission-list style="display:grid; gap:8px;"></div>
    </section>

    <section>
      <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <span class="evt-eyebrow">班ステータス</span>
      </header>
      <details style="margin-bottom:10px;">
        <summary style="cursor:pointer; font-weight:700; padding:6px 0;">班を追加</summary>
        <form data-organizer-team-form style="display:grid; gap:8px; margin-top:8px;">
          <label style="display:grid; gap:4px; font-size:13px; font-weight:700;">班名
            <input name="name" required maxlength="20" placeholder="例: 川沿い班"
                   style="border:1px solid var(--evt-line); border-radius:12px; padding:8px 12px; font:inherit;" />
          </label>
          <label style="display:grid; gap:4px; font-size:13px; font-weight:700;">色
            <input name="color" type="color" value="#10b981"
                   style="border:1px solid var(--evt-line); border-radius:12px; height:40px; padding:4px; font:inherit;" />
          </label>
          <label style="display:grid; gap:4px; font-size:13px; font-weight:700;">担当目標種(カンマ区切り、任意)
            <input name="target_taxa" placeholder="例: ヤマセミ, エナガ"
                   style="border:1px solid var(--evt-line); border-radius:12px; padding:8px 12px; font:inherit;" />
          </label>
          <button type="submit" class="evt-btn evt-btn-primary">班を作成</button>
        </form>
      </details>
      <div data-evt-team-list style="display:grid; gap:8px;">
        <p class="evt-lead" data-evt-team-empty>まだ班がありません。「班を追加」から作成してください。</p>
      </div>
    </section>

    <section>
      <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <span class="evt-eyebrow">参加者</span>
        <button type="button" class="evt-btn evt-btn-ghost" data-organizer-refresh-participants style="min-height:36px; padding:6px 14px;">再読込</button>
      </header>
      <div data-evt-participant-list style="display:grid; gap:6px;">
        <p class="evt-lead">チェックイン待機中…</p>
      </div>
    </section>

    <section>
      <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <span class="evt-eyebrow">最新フィード</span>
      </header>
      <div data-evt-feed-list style="display:grid; gap:8px;">
        <div class="evt-card">
          <span class="evt-eyebrow">セッション開始</span>
          <p class="evt-lead" style="margin-top:4px;">参加者が集まり次第ここに動きが流れます。</p>
        </div>
      </div>
    </section>
  </main>
</section>
`;
}

export function organizerConsoleScript(): string {
  return String.raw`
(() => {
  const root = document.querySelector(".evt-console-shell");
  if (!root) return;
  const sessionId = root.dataset.sessionId;

  const stats = { obs: 0, species: new Set(), absence: 0, quests: 0, participants: 0 };
  const obsEl = root.querySelector('[data-evt-stat="obs"]');
  const absEl = root.querySelector('[data-evt-stat="absence"]');
  const qstEl = root.querySelector('[data-evt-stat="quests"]');
  const partEl = root.querySelector('[data-evt-stat="participants"]');
  const feedList = root.querySelector("[data-evt-feed-list]");
  const clock = root.querySelector("[data-evt-clock]");
  const rallySummary = root.querySelector("[data-rally-summary]");
  const rallyMissionList = root.querySelector("[data-rally-mission-list]");
  const rallyStationSelect = root.querySelector("[data-rally-station-select]");
  const rallyLocationBinding = root.querySelector("[data-rally-location-binding]");
  let rallySnapshot = { course: null, stations: [], missions: [], progress: [] };
  function tick(){ if (clock) clock.textContent = new Date().toLocaleTimeString("ja-JP"); }
  setInterval(tick, 1000); tick();

  function refresh(){
    if (obsEl) obsEl.textContent = String(stats.obs);
    if (absEl) absEl.textContent = String(stats.absence);
    if (qstEl) qstEl.textContent = String(stats.quests);
    if (partEl) partEl.textContent = String(stats.participants);
  }
  function escapeText(s){
    return String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function pushFeed(typeLabel, text){
    if (!feedList) return;
    const card = document.createElement("div");
    card.className = "evt-card";
    card.innerHTML = '<span class="evt-eyebrow">' + escapeText(typeLabel) + '</span>' +
      '<p class="evt-lead" style="margin-top:4px;">' + text + '</p>';
    feedList.prepend(card);
    while (feedList.children.length > 30) feedList.lastElementChild?.remove();
  }
  function rallyMissionId(m){ return m?.missionId || m?.mission_id || ""; }
  function rallyStationId(s){ return s?.stationId || s?.station_id || ""; }
  function rallyProgressFor(missionId){
    return (rallySnapshot.progress || []).find(p => (p.missionId || p.mission_id) === missionId) || null;
  }
  function rallyUnitLabel(unit){
    return ({
      scene: "件",
      individual: "本",
      location: "地点",
      comparison_pair: "組",
      station_clear: "クリア",
      team_completion: "班",
    })[unit] || "件";
  }
  function rallyBindingLabel(binding){
    return ({
      none: "場所非限定",
      station_required: "地点固定",
      within_area: "エリア内",
      near_route: "ルート沿い",
      any_registered_station: "登録地点のどこか",
    })[binding] || binding || "";
  }
  function rallyStatusLabel(status){
    return ({
      draft: "下書き",
      published: "公開中",
      paused: "一時停止",
      replaced: "差し替え済",
      closed: "終了",
    })[status] || status || "";
  }
  function renderRally(){
    const missions = rallySnapshot.missions || [];
    const stations = rallySnapshot.stations || [];
    const active = missions.filter(m => (m.status || "") === "published");
    const top = missions
      .map(m => ({ mission: m, progress: rallyProgressFor(rallyMissionId(m)) }))
      .sort((a, b) => Number(b.progress?.percent || 0) - Number(a.progress?.percent || 0))[0];
    if (rallySummary) {
      const percent = Math.round(Number(top?.progress?.percent || 0));
      const actual = Number(top?.progress?.actualCount ?? top?.progress?.actual_count ?? 0);
      const goal = Number(top?.mission?.goalCount ?? top?.mission?.goal_count ?? 0);
      const unit = rallyUnitLabel(top?.mission?.countUnit || top?.mission?.count_unit);
      rallySummary.innerHTML = rallySnapshot.course
        ? '<div class="evt-card" style="padding:10px 12px;">' +
            '<div style="display:flex; justify-content:space-between; gap:8px; align-items:center;">' +
              '<strong>' + escapeText(active.length) + '件のミッション公開中</strong>' +
              '<span class="evt-badge evt-mode-quest">' + escapeText(String(percent)) + '%</span>' +
            '</div>' +
            '<p class="evt-lead" style="font-size:13px; margin-top:4px;">' +
              (top?.mission ? escapeText(top.mission.title || "") + ' ' + actual + '/' + goal + unit : 'ミッションを追加すると進捗が出ます。') +
            '</p>' +
          '</div>'
        : '<p class="evt-lead">ラリーはまだ未作成です。地点かミッションを追加すると自動で作成されます。</p>';
    }
    if (rallyStationSelect) {
      const current = rallyStationSelect.value;
      rallyStationSelect.innerHTML = '<option value="">地点なし</option>' + stations.map(s =>
        '<option value="' + escapeText(rallyStationId(s)) + '">' + escapeText(s.name || s.code || "地点") + '</option>'
      ).join("");
      if (current) rallyStationSelect.value = current;
    }
    if (rallyMissionList) {
      rallyMissionList.innerHTML = missions.map(m => {
        const missionId = rallyMissionId(m);
        const progress = rallyProgressFor(missionId);
        const actual = Number(progress?.actualCount ?? progress?.actual_count ?? 0);
        const goal = Number(m.goalCount ?? m.goal_count ?? 1);
        const percent = Math.round(Number(progress?.percent || 0));
        const unit = rallyUnitLabel(m.countUnit || m.count_unit);
        const status = m.status || "";
        const canOperate = status !== "closed" && status !== "replaced";
        const publishButton = status === "published"
          ? '<button type="button" class="evt-btn evt-btn-ghost" data-rally-mission-action="pause" data-mission-id="' + escapeText(missionId) + '" style="min-height:34px; padding:6px 10px;">一時停止</button>'
          : (canOperate ? '<button type="button" class="evt-btn evt-btn-primary" data-rally-mission-action="publish" data-mission-id="' + escapeText(missionId) + '" style="min-height:34px; padding:6px 10px;">公開</button>' : '');
        const replaceButton = canOperate
          ? '<button type="button" class="evt-btn evt-btn-ghost" data-rally-mission-action="replace" data-mission-id="' + escapeText(missionId) + '" style="min-height:34px; padding:6px 10px;">差し替え</button>'
          : '';
        const extendButton = canOperate
          ? '<button type="button" class="evt-btn evt-btn-ghost" data-rally-mission-action="extend" data-mission-id="' + escapeText(missionId) + '" style="min-height:34px; padding:6px 10px;">目標変更</button>'
          : '';
        const closeButton = canOperate
          ? '<button type="button" class="evt-btn evt-btn-danger" data-rally-mission-action="close" data-mission-id="' + escapeText(missionId) + '" style="min-height:34px; padding:6px 10px;">終了</button>'
          : '';
        return '<article class="evt-card" style="padding:12px; display:grid; gap:8px;">' +
          '<div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">' +
            '<div>' +
              '<span class="evt-eyebrow">' + escapeText(rallyBindingLabel(m.locationBinding || m.location_binding)) + ' / ' + escapeText(m.countUnit || m.count_unit) + ' / ' + escapeText(rallyStatusLabel(status)) + '</span>' +
              '<h3 class="evt-heading" style="font-size:18px; margin:3px 0 0;">' + escapeText(m.title || "") + '</h3>' +
            '</div>' +
            '<span class="evt-badge evt-mode-quest">' + percent + '%</span>' +
          '</div>' +
          '<p class="evt-lead" style="font-size:13px;">' + actual + '/' + goal + unit + '。対象: ' + escapeText(m.target || "") + '</p>' +
          '<div style="display:flex; gap:6px; flex-wrap:wrap;">' + publishButton + extendButton + replaceButton + closeButton + '</div>' +
        '</article>';
      }).join("") || '<p class="evt-lead">まだミッションがありません。</p>';
    }
  }
  async function loadRallySnapshot(){
    try {
      const r = await fetch("/api/v1/observation-events/" + sessionId + "/rally", { credentials: "include" });
      if (!r.ok) return;
      const data = await r.json();
      rallySnapshot = data.rally || rallySnapshot;
      renderRally();
    } catch(_){}
  }
  async function updateRallyMission(missionId, action, extra){
    const body = { action, ...(extra || {}) };
    const r = await fetch("/api/v1/observation-events/" + sessionId + "/rally/missions/" + encodeURIComponent(missionId), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      alert(data.error || "ミッション更新に失敗しました");
      return;
    }
    await loadRallySnapshot();
  }
  function handle(row){
    const p = row.payload || {};
    if (row.type === "observation_added"){
      stats.obs++;
      if (p.taxon_name) stats.species.add(p.taxon_name);
      pushFeed("観察", "<b>" + escapeText(p.taxon_name || "未同定") + "</b> が記録された");
    }
    else if (row.type === "absence_recorded"){
      stats.absence++;
      pushFeed("不在", "<b>" + escapeText(p.searched_taxon || "種不明") + "</b> を確かめた");
    }
    else if (row.type === "checkin"){
      stats.participants++;
      pushFeed("チェックイン", escapeText(p.display_name || "参加者") + " が到着");
    }
    else if (row.type === "quest_offered"){
      pushFeed("AI クエスト", escapeText(p.headline || ""));
    }
    else if (row.type === "quest_accepted" || row.type === "quest_completed"){
      stats.quests++;
      pushFeed("クエスト", row.type === "quest_accepted" ? "受諾" : "達成");
    }
    else if (row.type === "announce"){
      pushFeed("配信", escapeText(p.message || ""));
    }
    else if (String(row.type || "").startsWith("rally_")){
      void loadRallySnapshot();
      if (row.type === "rally_goal_exceeded") {
        pushFeed("観察ラリー", escapeText(p.mission?.title || "ミッション") + " が " + escapeText(String(p.threshold || "")) + "% を突破");
      } else if (row.type === "rally_next_action" && p.mode === "rain") {
        pushFeed("観察ラリー", "雨天モードへ切替: " + escapeText(String(p.replaced_count || 0)) + "件差し替え / " + escapeText(String(p.published_count || 0)) + "件公開");
      } else if (row.type === "rally_task_submitted") {
        pushFeed("観察ラリー", escapeText(p.title || "ミッション") + " に追加");
      }
    }
    else if (row.type === "participant_location_ping"){
      pushFeed("位置共有", escapeText(p.display_name || "参加者") + " の現在地を更新");
    }
    refresh();
  }

  // SSE
  let evtSource = null;
  try { evtSource = new EventSource("/api/v1/observation-events/" + sessionId + "/live", { withCredentials: true }); }
  catch(_){ }
  evtSource?.addEventListener("snapshot", (ev) => {
    try { (JSON.parse(ev.data).events || []).forEach(handle); } catch(_){}
  });
  evtSource?.addEventListener("live", (ev) => {
    try { handle(JSON.parse(ev.data)); } catch(_){}
  });

  // Mode switch
  root.querySelectorAll("[data-organizer-mode]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const next = btn.getAttribute("data-organizer-mode");
      const r = await fetch("/api/v1/observation-events/" + sessionId + "/mode", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary_mode: next }),
      });
      if (r.ok){
        root.querySelectorAll("[data-organizer-mode]").forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
      }
    });
  });

  // Announce
  root.querySelector("[data-organizer-announce]")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const fd = new FormData(form);
    const r = await fetch("/api/v1/observation-events/" + sessionId + "/announce", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: fd.get("message") }),
    });
    if (r.ok) form.reset();
  });

  // End session
  root.querySelector("[data-organizer-end]")?.addEventListener("click", async () => {
    if (!confirm("このセッションを終了しますか？参加者の SSE 接続は維持されますが、新しい AI Quest は発火しなくなります。")) return;
    const r = await fetch("/api/v1/observation-events/" + sessionId + "/end", {
      method: "POST", credentials: "include",
    });
    if (r.ok){
      if (window.evtFanfare) window.evtFanfare("セッションを終了");
      setTimeout(() => { window.location.href = "./recap"; }, 600);
    } else {
      alert("終了に失敗しました");
    }
  });

  // Quest run
  root.querySelector("[data-organizer-quest-run]")?.addEventListener("click", async () => {
    await fetch("/api/v1/observation-events/" + sessionId + "/quests/run", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger: "manual" }),
    });
  });

  root.querySelector("[data-rally-refresh]")?.addEventListener("click", () => void loadRallySnapshot());
  root.querySelector("[data-rally-weather-rain]")?.addEventListener("click", async () => {
    if (!confirm("雨に弱い公開ミッションを差し替え済みにし、同じ差し替えグループの雨天用ミッションを公開します。進捗は消えません。")) return;
    const r = await fetch("/api/v1/observation-events/" + sessionId + "/rally/preflight/weather-mode", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "rain", reason: "主催者による雨天モード切替" }),
    });
    if (r.ok) {
      const data = await r.json().catch(() => ({}));
      pushFeed("観察ラリー", "雨天モードへ切替: " + (data.replaced?.length || 0) + "件差し替え / " + (data.published?.length || 0) + "件公開");
      await loadRallySnapshot();
      if (window.evtFanfare) window.evtFanfare("雨天モードに切替");
    } else {
      const data = await r.json().catch(() => ({}));
      alert(data.error || "雨天モード切替に失敗しました");
    }
  });
  root.querySelector("[data-rally-station-form]")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const fd = new FormData(form);
    const payload = {
      name: fd.get("name"),
      lat: fd.get("lat") ? Number(fd.get("lat")) : null,
      lng: fd.get("lng") ? Number(fd.get("lng")) : null,
      is_private: fd.get("is_private") === "on",
      danger_note: fd.get("danger_note") || "",
    };
    const r = await fetch("/api/v1/observation-events/" + sessionId + "/rally/stations", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      form.reset();
      await loadRallySnapshot();
    } else {
      alert("地点追加に失敗しました");
    }
  });
  root.querySelector("[data-rally-mission-form]")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const fd = new FormData(form);
    const locationBinding = String(fd.get("location_binding") || "none");
    const stationId = String(fd.get("station_id") || "");
    if (locationBinding === "station_required" && !stationId) {
      alert("地点固定ミッションには地点を選んでください。");
      return;
    }
    const payload = {
      title: fd.get("title"),
      target: fd.get("target"),
      count_unit: fd.get("count_unit"),
      goal_count: Number(fd.get("goal_count") || 1),
      location_binding: locationBinding,
      station_id: stationId || null,
      verification_policy: fd.get("verification_policy"),
      weather_sensitivity: fd.get("weather_sensitivity"),
      fallback_group: fd.get("fallback_group") || "",
      status: "published",
    };
    const r = await fetch("/api/v1/observation-events/" + sessionId + "/rally/missions", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      form.reset();
      if (rallyLocationBinding) rallyLocationBinding.value = "none";
      await loadRallySnapshot();
    } else {
      const data = await r.json().catch(() => ({}));
      alert(data.error || "ミッション追加に失敗しました");
    }
  });
  rallyMissionList?.addEventListener("click", async (ev) => {
    const btn = ev.target instanceof Element ? ev.target.closest("[data-rally-mission-action]") : null;
    if (!btn) return;
    const missionId = btn.getAttribute("data-mission-id");
    const action = btn.getAttribute("data-rally-mission-action");
    if (!missionId || !action) return;
    if (action === "extend") {
      const current = (rallySnapshot.missions || []).find(m => rallyMissionId(m) === missionId);
      const nextGoal = Number(prompt("新しい目標数", String(current?.goalCount ?? current?.goal_count ?? "")));
      if (!Number.isFinite(nextGoal) || nextGoal <= 0) return;
      await updateRallyMission(missionId, "extend", { goal_count: nextGoal, reason: "開催中の目標調整" });
      return;
    }
    if (action === "replace") {
      if (!confirm("進捗を残したまま、このミッションを差し替え済みにしますか？新しいミッションは別途追加します。")) return;
      await updateRallyMission(missionId, "replace", { reason: "開催中のミッション差し替え" });
      return;
    }
    if (action === "close" && !confirm("このミッションを終了しますか？")) return;
    await updateRallyMission(missionId, action, {});
  });

  // Team CRUD
  const teamForm = root.querySelector("[data-organizer-team-form]");
  const teamList = root.querySelector("[data-evt-team-list]");
  const teamEmpty = root.querySelector("[data-evt-team-empty]");
  const knownTeams = new Map();
  function renderTeams(){
    if (!teamList) return;
    if (knownTeams.size === 0){
      if (teamEmpty) teamEmpty.style.display = "";
      return;
    }
    if (teamEmpty) teamEmpty.style.display = "none";
    Array.from(teamList.querySelectorAll("[data-team-row]")).forEach(el => el.remove());
    knownTeams.forEach((t) => {
      const row = document.createElement("div");
      row.className = "evt-console-team-row";
      row.dataset.teamRow = t.team_id;
      row.innerHTML =
        '<span class="evt-team-color" style="background:' + escapeText(t.color || "#10b981") + ';"></span>' +
        '<div><strong>' + escapeText(t.name || "班") + '</strong>' +
        '<div class="evt-lead" style="font-size:12px;">' + (t.target_taxa || []).map(escapeText).join("、") + '</div></div>' +
        '<span class="evt-badge evt-mode-discovery">' + (t.observations || 0) + '</span>' +
        '<span class="evt-lead" style="font-size:12px;">' + (t.member_count || 0) + ' 名</span>';
      teamList.appendChild(row);
    });
  }
  teamForm?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(teamForm);
    const targetTaxa = String(fd.get("target_taxa") || "").split(/[,、]/).map(s => s.trim()).filter(Boolean);
    const r = await fetch("/api/v1/observation-events/" + sessionId + "/teams", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        color: fd.get("color") || "#10b981",
        target_taxa: targetTaxa,
      }),
    });
    if (r.ok){
      const data = await r.json();
      if (data?.team){
        knownTeams.set(data.team.team_id, { ...data.team, member_count: 0, observations: 0 });
        renderTeams();
        teamForm.reset();
      }
    }
  });

  // SSE で team_update を受信したときに班リスト更新(handle にも記述)
  const originalHandle = handle;
  function handleEnhanced(row){
    if (row.type === "team_update" && row.payload?.team){
      const t = row.payload.team;
      knownTeams.set(t.team_id, { ...(knownTeams.get(t.team_id) ?? {}), ...t });
      renderTeams();
    }
    if (row.type === "checkin"){
      void loadParticipants();
    }
    if (row.type === "observation_added" && row.team_id){
      const t = knownTeams.get(row.team_id);
      if (t){ t.observations = (t.observations || 0) + 1; knownTeams.set(row.team_id, t); renderTeams(); }
    }
    return originalHandle(row);
  }
  // Participant list
  const participantList = root.querySelector("[data-evt-participant-list]");
  async function loadParticipants(){
    if (!participantList) return;
    try {
      const r = await fetch("/api/v1/observation-events/" + sessionId + "/recent?limit=100", { credentials: "include" });
      if (!r.ok) return;
      const data = await r.json();
      const checkins = (data.events || []).filter(e => e.type === "checkin");
      const seen = new Map();
      checkins.forEach(e => {
        const id = e.payload?.participant_id;
        if (!id) return;
        seen.set(id, e.payload);
      });
      participantList.innerHTML = "";
      if (seen.size === 0){
        const p = document.createElement("p");
        p.className = "evt-lead";
        p.textContent = "チェックインした参加者はまだいません。";
        participantList.appendChild(p);
        return;
      }
      seen.forEach((p, id) => {
        const row = document.createElement("div");
        row.className = "evt-card";
        row.style.padding = "10px 12px";
        row.innerHTML =
          '<div style="display:flex; justify-content:space-between; align-items:center;">' +
            '<strong>' + escapeText(p.display_name || "参加者") + '</strong>' +
            '<span class="evt-eyebrow">' + (p.team_id ? "班あり" : "班未割当") + '</span>' +
          '</div>';
        participantList.appendChild(row);
      });
    } catch(_){}
  }
  root.querySelector("[data-organizer-refresh-participants]")?.addEventListener("click", loadParticipants);
  loadParticipants();
  loadRallySnapshot();

  refresh();
})();
`;
}
