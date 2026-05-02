import type { ObservationEventSessionRow } from "../services/observationEventModeManager.js";

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

interface TeamLite {
  teamId: string;
  name: string;
  color: string;
  memberCount: number;
}

export interface RenderCheckinArgs {
  session: ObservationEventSessionRow;
  teams: TeamLite[];
  isAuthenticated: boolean;
}

export function renderCheckinBody(args: RenderCheckinArgs): string {
  const { session, teams, isAuthenticated } = args;
  const targets = (session.targetSpecies ?? []).slice(0, 8).map(escapeHtml).join("、") || "未設定";

  const teamCards = teams.length === 0
    ? `<div class="evt-card">
         <span class="evt-eyebrow">班</span>
         <p class="evt-lead" style="margin-top:4px;">主催者がまだ班を作成していません。後で参加できます。</p>
       </div>`
    : teams.map((t) => `
        <label class="evt-checkin-team-card" data-team-card>
          <input type="radio" name="team_id" value="${escapeHtml(t.teamId)}" style="display:none;" />
          <span style="display:flex; align-items:center; gap:8px;">
            <span class="evt-team-color" style="background:${escapeHtml(t.color)};"></span>
            <strong>${escapeHtml(t.name)}</strong>
          </span>
          <span class="evt-lead" style="font-size:12px;">${t.memberCount} 名参加中</span>
        </label>`).join("");

  return `
<section class="evt-checkin-shell" data-session-id="${escapeHtml(session.sessionId)}" data-event-code="${escapeHtml(session.eventCode ?? "")}">
  <header>
    <span class="evt-eyebrow">チェックイン</span>
    <h1 class="evt-heading" style="margin-top:6px; font-size:clamp(22px, 4vw, 30px);">${escapeHtml(session.title || "観察会に参加")}</h1>
    <p class="evt-lead">「${escapeHtml(MODE_LABEL[session.primaryMode] ?? "発見")}」モードで進行中。目標: ${targets}</p>
  </header>

  <form class="evt-checkin-form" data-evt-checkin-form>
    <label>表示名(チームに表示されます)
      <input type="text" name="display_name" required maxlength="32" placeholder="例: たかし" />
    </label>

    <fieldset style="border:0; padding:0; margin:0; display:grid; gap:6px;">
      <span class="evt-eyebrow">班を選ぶ</span>
      <div class="evt-checkin-team-grid">
        ${teamCards}
      </div>
    </fieldset>

    <label style="display:flex; gap:8px; align-items:center; min-height:44px;">
      <input type="checkbox" name="share_location" checked />
      <span>同じ班員にだけ位置を共有(100m メッシュ粒度)</span>
    </label>
    <label style="display:flex; gap:8px; align-items:center; min-height:44px;">
      <input type="checkbox" name="is_minor" />
      <span>未成年です(位置共有は自動で OFF)</span>
    </label>

    ${isAuthenticated
      ? `<p class="evt-lead">ログイン済みアカウントで参加します。</p>`
      : `<p class="evt-lead">ゲスト参加でも、ふり返り URL は永続的に残ります。</p>`}

    <button type="submit" class="evt-btn evt-btn-primary" style="justify-self:stretch;">
      ✨ 観察を始める
    </button>
  </form>
</section>
`;
}

export function checkinScript(): string {
  return String.raw`
(() => {
  const root = document.querySelector(".evt-checkin-shell");
  if (!root) return;
  const sessionId = root.dataset.sessionId;
  const teamCards = root.querySelectorAll("[data-team-card]");
  teamCards.forEach(card => {
    const input = card.querySelector('input[name="team_id"]');
    card.addEventListener("click", () => {
      teamCards.forEach(c => c.classList.remove("is-selected"));
      card.classList.add("is-selected");
      if (input) input.checked = true;
    });
  });

  // ゲスト用 token は永続化(localStorage)
  function ensureGuestToken(){
    let token = localStorage.getItem("evt-guest-token");
    if (!token) {
      token = "g_" + Math.random().toString(36).slice(2,8) + Date.now().toString(36);
      localStorage.setItem("evt-guest-token", token);
    }
    return token;
  }

  const form = root.querySelector("[data-evt-checkin-form]");
  form?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const isMinor = fd.get("is_minor") === "on";
    const shareLocation = fd.get("share_location") === "on" && !isMinor;
    const teamId = fd.get("team_id") || null;
    const guestToken = ensureGuestToken();
    const payload = {
      display_name: String(fd.get("display_name") || ""),
      team_id: teamId,
      share_location: shareLocation,
      is_minor: isMinor,
      guest_token: guestToken,
    };
    const r = await fetch("/api/v1/observation-events/" + sessionId + "/checkin", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      alert("チェックインに失敗しました。時間をおいて再試行してください。");
      return;
    }
    if (window.evtFanfare) window.evtFanfare("ようこそ!");
    setTimeout(() => {
      window.location.href = "../../events/" + sessionId + "/live";
    }, 600);
  });
})();
`;
}
