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

function isSoloMicroSession(session: ObservationEventSessionRow): boolean {
  const config = session.config ?? {};
  const placeEvent = typeof config.place_event === "object" && config.place_event !== null
    ? config.place_event as Record<string, unknown>
    : {};
  return config.solo_observation === true || placeEvent.event_kind === "solo_micro_observation";
}

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
  const isSolo = isSoloMicroSession(session);
  const targets = (session.targetSpecies ?? []).slice(0, 8).map(escapeHtml).join("、") || "見つけたものを自由に記録";

  const teamCards = teams.length === 0
    ? `<div class="evt-card ${isSolo ? "evt-solo-empty-team" : ""}">
         <span class="evt-eyebrow">${isSolo ? "一人観察会" : "班分けなし"}</span>
         <p class="evt-lead" style="margin-top:4px;">${isSolo ? "班分けなしで開始します。現地では写真記録と不明メモを優先します。" : "そのまま参加できます。主催者が班を追加した場合は、会場で案内します。"}</p>
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
<section class="evt-checkin-shell" data-session-id="${escapeHtml(session.sessionId)}" data-event-code="${escapeHtml(session.eventCode ?? "")}" data-solo-observation="${isSolo ? "true" : "false"}" data-authenticated="${isAuthenticated ? "true" : "false"}">
  <header>
    <span class="evt-eyebrow">${isSolo ? "一人観察会チェックイン" : "観察会チェックイン"}</span>
    <h1 class="evt-heading" style="margin-top:6px; font-size:clamp(22px, 4vw, 30px);">${escapeHtml(session.title || "観察会に参加")}</h1>
    <p class="evt-lead">「${escapeHtml(MODE_LABEL[session.primaryMode] ?? "発見")}」モードで進行中。目標: ${targets}</p>
  </header>

  ${isSolo ? "" : `<aside class="evt-card" style="display:grid; gap:6px; padding:14px;">
    <strong>家族・グループは、スマホ1台で参加できます</strong>
    <span class="evt-lead" style="font-size:13px;">代表者のニックネームや「○○家」でチェックインしてください。アカウント登録なしでも参加でき、終了後のふり返りURLも同じ端末に残ります。</span>
  </aside>`}

  <form class="evt-checkin-form" data-evt-checkin-form novalidate>
    <label>参加名（家族・グループ名でもOK）
      <input type="text" name="display_name" required maxlength="32" autocomplete="nickname" placeholder="例: やまき家 / たかし" />
    </label>

    <fieldset style="border:0; padding:0; margin:0; display:grid; gap:6px;">
      <span class="evt-eyebrow">${teams.length > 0 ? "班を選ぶ（案内がある場合）" : "参加方法"}</span>
      <div class="evt-checkin-team-grid">
        ${teamCards}
      </div>
    </fieldset>

    <label style="display:flex; gap:8px; align-items:flex-start; min-height:44px;">
      <input type="checkbox" name="share_location" ${isSolo ? "" : "checked"} style="margin-top:4px;" />
      <span>${isSolo ? "開催範囲の補助として現在地を使う" : "開催中だけ、主催者におおよその現在地を共有"}<small style="display:block; margin-top:2px; color:var(--evt-muted, #64748b);">終了時刻を過ぎると自動で停止します。共有しなくても観察・投稿はできます。</small></span>
    </label>
    <label style="display:flex; gap:8px; align-items:center; min-height:44px;">
      <input type="checkbox" name="is_minor" />
      <span>参加者に未成年が含まれます</span>
    </label>
    <label data-guardian-consent-row hidden style="display:flex; gap:8px; align-items:flex-start; min-height:44px; padding:12px; border:1px solid rgba(15,23,42,.12); border-radius:12px; background:#f8fafc;">
      <input type="checkbox" name="guardian_location_consent" style="margin-top:4px;" />
      <span>未成年の位置共有について、保護者または引率者が同意しています</span>
    </label>

    ${isAuthenticated
      ? `<p class="evt-lead">ログイン済みアカウントで参加します。このイベント用のゲストIDは作りません。</p>`
      : `<p class="evt-lead">登録なしのゲスト参加です。この端末にイベント専用IDを保存し、ふり返りへ戻れるようにします。</p>`}

    <p class="evt-lead" data-evt-checkin-status role="status" aria-live="polite" style="min-height:22px; margin:0;"></p>
    <button type="submit" class="evt-btn evt-btn-primary" data-evt-checkin-submit style="justify-self:stretch; min-height:56px;">
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
  const isSolo = root.dataset.soloObservation === "true";
  const isAuthenticated = root.dataset.authenticated === "true";
  const teamCards = root.querySelectorAll("[data-team-card]");
  teamCards.forEach(card => {
    const input = card.querySelector('input[name="team_id"]');
    card.addEventListener("click", () => {
      teamCards.forEach(c => c.classList.remove("is-selected"));
      card.classList.add("is-selected");
      if (input) input.checked = true;
    });
  });

  function guestStorageKey(){
    return "evt-guest-token:" + sessionId;
  }
  function ensureGuestToken(){
    if (isAuthenticated) return null;
    const key = guestStorageKey();
    let token = localStorage.getItem(key);
    if (!token) {
      token = "g_" + Math.random().toString(36).slice(2,8) + Date.now().toString(36);
      localStorage.setItem(key, token);
    }
    return token;
  }

  const form = root.querySelector("[data-evt-checkin-form]");
  const status = root.querySelector("[data-evt-checkin-status]");
  const submit = root.querySelector("[data-evt-checkin-submit]");
  const minorInput = form?.querySelector('input[name="is_minor"]');
  const shareInput = form?.querySelector('input[name="share_location"]');
  const guardianInput = form?.querySelector('input[name="guardian_location_consent"]');
  const guardianRow = root.querySelector("[data-guardian-consent-row]");

  function setStatus(message, kind){
    if (!status) return;
    status.textContent = message || "";
    status.style.color = kind === "error" ? "#b91c1c" : kind === "success" ? "#047857" : "";
  }
  function syncGuardianConsent(){
    const required = Boolean(minorInput?.checked && shareInput?.checked);
    if (guardianRow) {
      guardianRow.hidden = !required;
      guardianRow.style.display = required ? "flex" : "none";
    }
    if (!required && guardianInput) guardianInput.checked = false;
  }
  minorInput?.addEventListener("change", syncGuardianConsent);
  shareInput?.addEventListener("change", syncGuardianConsent);
  syncGuardianConsent();

  form?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (submit?.disabled) return;
    const fd = new FormData(form);
    const displayName = String(fd.get("display_name") || "").trim();
    const isMinor = fd.get("is_minor") === "on";
    const guardianConsent = fd.get("guardian_location_consent") === "on";
    const shareLocation = fd.get("share_location") === "on";
    const teamId = fd.get("team_id") || null;

    if (!displayName) {
      setStatus("参加名を入力してください。", "error");
      form.querySelector('input[name="display_name"]')?.focus();
      return;
    }
    if (isMinor && shareLocation && !guardianConsent) {
      setStatus("位置情報を共有する場合は、保護者または引率者の同意を確認してください。共有しない設定でも参加できます。", "error");
      guardianInput?.focus();
      return;
    }

    const guestToken = ensureGuestToken();
    const payload = {
      display_name: displayName,
      team_id: teamId,
      share_location: shareLocation,
      is_minor: isMinor,
      guardian_location_consent: guardianConsent,
      location_share_consent_type: isMinor ? (guardianConsent ? "guardian" : null) : "self",
      guest_token: guestToken,
    };

    if (submit) submit.disabled = true;
    setStatus("参加情報を確認しています…", "info");
    try {
      const r = await fetch("/api/v1/observation-events/" + sessionId + "/checkin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        setStatus("チェックインできませんでした。通信状況を確認して、もう一度お試しください。入力内容は残っています。", "error");
        return;
      }
      setStatus("参加できました。観察画面を開きます。", "success");
      if (window.evtFanfare) window.evtFanfare("ようこそ!");
      setTimeout(() => {
        window.location.href = "/events/" + sessionId + (isSolo ? "/live" : "/rally") + (guestToken ? "?token=" + encodeURIComponent(guestToken) : "");
      }, 450);
    } catch {
      setStatus("通信が途切れました。電波が戻ったら、同じボタンでもう一度お試しください。", "error");
    } finally {
      if (submit) submit.disabled = false;
    }
  });
})();
`;
}
