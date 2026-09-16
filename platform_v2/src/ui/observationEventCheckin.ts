import type { ObservationEventSessionRow } from "../services/observationEventModeManager.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

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
  const targets = (session.targetSpecies ?? []).slice(0, 8).map(escapeHtml);

  const teamSection = isSolo
    ? ""
    : teams.length === 0
      ? `<div class="evt-card">
           <span class="evt-eyebrow">班について</span>
           <p class="evt-lead" style="margin-top:4px;">班の指定はありません。必要な場合は主催者から案内されます。</p>
         </div>`
      : `<fieldset style="border:0; padding:0; margin:0; display:grid; gap:6px;">
           <span class="evt-eyebrow">班を選ぶ</span>
           <div class="evt-checkin-team-grid">
             ${teams.map((t) => `
               <label class="evt-checkin-team-card" data-team-card>
                 <input type="radio" name="team_id" value="${escapeHtml(t.teamId)}" style="display:none;" />
                 <span style="display:flex; align-items:center; gap:8px;">
                   <span class="evt-team-color" style="background:${escapeHtml(t.color)};"></span>
                   <strong>${escapeHtml(t.name)}</strong>
                 </span>
                 <span class="evt-lead" style="font-size:12px;">${t.memberCount} 名参加中</span>
               </label>`).join("")}
           </div>
         </fieldset>`;

  const targetSummary = targets.length > 0
    ? `<p class="evt-lead">観察対象: ${targets.join("、")}</p>`
    : "";

  return `
<section class="evt-checkin-shell" data-session-id="${escapeHtml(session.sessionId)}" data-event-code="${escapeHtml(session.eventCode ?? "")}" data-solo-observation="${isSolo ? "true" : "false"}">
  <header>
    <span class="evt-eyebrow">参加受付</span>
    <h1 class="evt-heading" style="margin-top:6px; font-size:clamp(22px, 4vw, 30px);">${escapeHtml(session.title || "企画に参加")}</h1>
    <p class="evt-lead">参加に必要な情報を確認して、受付を完了します。</p>
    ${targetSummary}
  </header>

  <form class="evt-checkin-form" data-evt-checkin-form>
    <label>表示名
      <input type="text" name="display_name" required maxlength="32" autocomplete="nickname" placeholder="例: たかし" />
    </label>

    ${teamSection}

    <label style="display:flex; gap:8px; align-items:center; min-height:44px;">
      <input type="checkbox" name="share_location" />
      <span>${isSolo ? "開催範囲の補助として現在地を使う" : "開催中だけ、主催者に現在地を共有"}</span>
    </label>
    <label style="display:flex; gap:8px; align-items:center; min-height:44px;">
      <input type="checkbox" name="is_minor" />
      <span>未成年です</span>
    </label>
    <label style="display:flex; gap:8px; align-items:center; min-height:44px;">
      <input type="checkbox" name="guardian_location_consent" />
      <span>未成年の位置共有について、保護者または引率者の同意があります</span>
    </label>

    ${isAuthenticated
      ? `<p class="evt-lead">ログイン済みアカウントで参加します。</p>`
      : `<p class="evt-lead">ゲスト参加の記録とふり返りは、この端末の参加情報から開けます。</p>`}

    <p class="evt-lead" data-evt-checkin-error role="alert" tabindex="-1" hidden></p>

    <button type="submit" class="evt-btn evt-btn-primary" data-evt-checkin-submit style="justify-self:stretch;">
      受付して参加する
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
  const teamCards = root.querySelectorAll("[data-team-card]");
  teamCards.forEach(card => {
    const input = card.querySelector('input[name="team_id"]');
    card.addEventListener("click", () => {
      teamCards.forEach(c => c.classList.remove("is-selected"));
      card.classList.add("is-selected");
      if (input) input.checked = true;
    });
  });

  const form = root.querySelector("[data-evt-checkin-form]");
  const submitButton = root.querySelector("[data-evt-checkin-submit]");
  const errorNode = root.querySelector("[data-evt-checkin-error]");
  const showError = (message) => {
    if (!errorNode) return;
    errorNode.textContent = message;
    errorNode.hidden = false;
    errorNode.focus();
  };
  const clearError = () => {
    if (!errorNode) return;
    errorNode.textContent = "";
    errorNode.hidden = true;
  };

  form?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    clearError();
    const fd = new FormData(form);
    const isMinor = fd.get("is_minor") === "on";
    const guardianConsent = fd.get("guardian_location_consent") === "on";
    const shareLocation = fd.get("share_location") === "on";
    const teamId = fd.get("team_id") || null;
    if (isMinor && shareLocation && !guardianConsent) {
      showError("未成年の位置共有には、保護者または引率者の同意が必要です。");
      return;
    }
    const payload = {
      display_name: String(fd.get("display_name") || ""),
      team_id: teamId,
      share_location: shareLocation,
      is_minor: isMinor,
      guardian_location_consent: guardianConsent,
    };

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "参加手続きを送信中…";
    }

    try {
      const r = await fetch("/api/v1/observation-events/" + sessionId + "/checkin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        showError("参加手続きを完了できませんでした。入力内容を確認して、もう一度お試しください。");
        return;
      }
      if (window.evtFanfare) window.evtFanfare("参加を受け付けました");
      setTimeout(() => {
        window.location.href = "/events/" + sessionId + (isSolo ? "/live" : "/rally");
      }, 600);
    } catch {
      showError("通信できませんでした。接続を確認して、もう一度お試しください。");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "受付して参加する";
      }
    }
  });
})();
`;
}
