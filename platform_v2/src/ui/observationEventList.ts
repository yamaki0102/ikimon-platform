import type { ObservationEventSessionRow, EventMode } from "../services/observationEventModeManager.js";
import type { ObservationEventStrings } from "../i18n/strings.js";
import type { SiteLang } from "../i18n.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const MODE_BADGE: Record<string, string> = {
  discovery: "discovery",
  effort_maximize: "effort",
  bingo: "bingo",
  absence_confirm: "absence",
  ai_quest: "quest",
};

function localeForLang(lang: SiteLang): string {
  switch (lang) {
    case "en": return "en-US";
    case "es": return "es-ES";
    case "pt-BR": return "pt-BR";
    case "ja":
    default:
      return "ja-JP";
  }
}

function formatStartedAt(iso: string, lang: SiteLang): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(localeForLang(lang), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function renderEventListBody(sessions: ObservationEventSessionRow[], strings: ObservationEventStrings, lang: SiteLang): string {
  const liveSessions = sessions.filter((s) => s.endedAt === null);
  const pastSessions = sessions.filter((s) => s.endedAt !== null);

  const renderCard = (s: ObservationEventSessionRow): string => {
    const isLive = s.endedAt === null;
    const badgeCls = `evt-badge evt-mode-${MODE_BADGE[s.primaryMode] ?? "discovery"}${isLive ? " is-live" : ""}`;
    const detailHref = isLive
      ? (s.eventCode ? `/community/events/${encodeURIComponent(s.eventCode)}/join` : `/events/${s.sessionId}/live`)
      : `/events/${s.sessionId}/recap`;
    const modeLabel = strings.modeLabels[s.primaryMode as EventMode] ?? s.primaryMode;
    return `
      <article class="evt-card" style="display:grid; gap:6px;">
        <header style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <span class="${badgeCls}">${isLive ? strings.badgeLive : strings.badgeEnded} • ${escapeHtml(modeLabel)}</span>
          <span class="evt-eyebrow">${escapeHtml(formatStartedAt(s.startedAt, lang))}</span>
        </header>
        <h3 class="evt-heading" style="margin:0; font-size:18px;">${escapeHtml(s.title || "")}</h3>
        <p class="evt-lead">${(s.targetSpecies ?? []).slice(0, 4).map(escapeHtml).join("、") || "—"}</p>
        <a class="evt-btn evt-btn-${isLive ? "primary" : "ghost"}" href="${detailHref}" style="justify-self:start;">
          ${isLive ? strings.joinCta : strings.recapCta}
        </a>
      </article>`;
  };

  return `
<section class="evt-recap-shell">
  <article class="evt-hero">
    <span class="evt-hero-eyebrow">${escapeHtml(strings.listEyebrow)}</span>
    <h1>${escapeHtml(strings.listHeroHeading)}</h1>
    <p>${escapeHtml(strings.listHeroLead)}</p>
    <div class="evt-hero-actions">
      <a class="evt-btn evt-btn-primary" href="/community/events/new">${escapeHtml(strings.listCreateCta)}</a>
      <a class="evt-btn evt-btn-on-dark" href="/community">${escapeHtml(strings.listBackToCommunity)}</a>
    </div>
  </article>

  <section>
    <header style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
      <h2 class="evt-heading" style="margin:0;">${escapeHtml(strings.listLiveSection)}</h2>
      <span class="evt-eyebrow">${liveSessions.length}</span>
    </header>
    ${liveSessions.length === 0
      ? `<p class="evt-lead">${escapeHtml(strings.listLiveEmpty)}</p>`
      : `<div class="evt-stagger" style="display:grid; gap:12px; grid-template-columns: repeat(auto-fit, minmax(280px,1fr));">
           ${liveSessions.map(renderCard).join("")}
         </div>`}
  </section>

  <section>
    <header style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
      <h2 class="evt-heading" style="margin:0;">${escapeHtml(strings.listPastSection)}</h2>
      <span class="evt-eyebrow">${pastSessions.length}</span>
    </header>
    ${pastSessions.length === 0
      ? `<p class="evt-lead">${escapeHtml(strings.listPastEmpty)}</p>`
      : `<div class="evt-stagger" style="display:grid; gap:12px; grid-template-columns: repeat(auto-fit, minmax(280px,1fr));">
           ${pastSessions.slice(0, 12).map(renderCard).join("")}
         </div>`}
  </section>
</section>
`;
}
