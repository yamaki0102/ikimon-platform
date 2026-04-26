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

    <a class="evt-btn evt-btn-ghost" href="../live">参加者ライブ画面へ</a>
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

  // Quest run
  root.querySelector("[data-organizer-quest-run]")?.addEventListener("click", async () => {
    await fetch("/api/v1/observation-events/" + sessionId + "/quests/run", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger: "manual" }),
    });
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
  // override existing handle
  if (evtSource){
    evtSource.removeEventListener("snapshot", () => {});
    evtSource.removeEventListener("live", () => {});
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

  refresh();
})();
`;
}
