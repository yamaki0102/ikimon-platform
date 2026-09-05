import type { ObservationEventSessionRow } from "../services/observationEventModeManager.js";
import type { ObservationEventStrings } from "../i18n/strings.js";
import type { SiteLang } from "../i18n.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

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

export const OBSERVATION_EVENT_LIST_STYLES = `
.zukan-participation-shell {
  width: min(100%, 1040px);
  margin: 0 auto;
  padding: clamp(24px, 4vw, 52px) clamp(16px, 3vw, 28px) 72px;
  color: #17211b;
}
.zukan-participation-header {
  padding: 0 0 24px;
  border-bottom: 1px solid #dde2dd;
}
.zukan-participation-eyebrow {
  margin: 0 0 8px;
  color: #55615a;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: .05em;
}
.zukan-participation-header h1 {
  margin: 0;
  color: #17211b;
  font-size: clamp(30px, 5vw, 48px);
  line-height: 1.15;
  letter-spacing: -.025em;
}
.zukan-participation-header p {
  max-width: 48rem;
  margin: 12px 0 0;
  color: #55615a;
  font-size: 16px;
  line-height: 1.75;
}
.zukan-participation-section {
  margin-top: 32px;
}
.zukan-participation-section h2 {
  margin: 0 0 12px;
  color: #17211b;
  font-size: clamp(20px, 3vw, 26px);
  line-height: 1.35;
}
.zukan-participation-list {
  border-top: 1px solid #dde2dd;
}
.zukan-participation-row {
  display: grid;
  grid-template-columns: minmax(108px, 132px) minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 18px 0;
  border-bottom: 1px solid #dde2dd;
}
.zukan-participation-time {
  color: #55615a;
  font-size: 14px;
  line-height: 1.5;
}
.zukan-participation-status {
  display: block;
  margin-bottom: 4px;
  color: #143f2e;
  font-size: 12px;
  font-weight: 800;
}
.zukan-participation-row h3 {
  margin: 0;
  color: #17211b;
  font-size: 18px;
  line-height: 1.45;
}
.zukan-participation-meta {
  margin: 5px 0 0;
  color: #55615a;
  font-size: 14px;
  line-height: 1.55;
}
.zukan-participation-action,
.zukan-participation-secondary-action {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  padding: 9px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 800;
  text-decoration: none;
}
.zukan-participation-action {
  border: 1px solid #143f2e;
  background: #143f2e;
  color: #fff;
}
.zukan-participation-secondary-action {
  border: 1px solid #bfc8c1;
  background: #fff;
  color: #143f2e;
}
.zukan-participation-action:focus-visible,
.zukan-participation-secondary-action:focus-visible,
.zukan-participation-history > summary:focus-visible {
  outline: 3px solid #7aa68e;
  outline-offset: 3px;
}
.zukan-participation-empty {
  margin: 0;
  padding: 18px 0;
  color: #55615a;
  line-height: 1.7;
}
.zukan-participation-empty a {
  color: #143f2e;
  font-weight: 800;
}
.zukan-participation-history {
  margin-top: 28px;
  border-top: 1px solid #dde2dd;
}
.zukan-participation-history > summary {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  color: #143f2e;
  font-weight: 800;
  list-style: none;
}
.zukan-participation-history > summary::-webkit-details-marker { display: none; }
.zukan-participation-history > summary::after {
  content: "›";
  display: inline-block;
  flex: 0 0 auto;
  font-size: 22px;
  font-weight: 500;
  line-height: 1;
  transform: rotate(90deg);
  transition: transform 160ms ease;
}
.zukan-participation-history[open] > summary::after { transform: rotate(-90deg); }
@media (prefers-reduced-motion: reduce) {
  .zukan-participation-history > summary::after { transition: none; }
}
.zukan-participation-organizer {
  margin-top: 40px;
  padding: 22px;
  border: 1px solid #dde2dd;
  border-radius: 14px;
  background: #f7f7f3;
}
.zukan-participation-organizer h2 {
  margin: 0;
  color: #17211b;
  font-size: 18px;
}
.zukan-participation-organizer p {
  margin: 8px 0 14px;
  color: #55615a;
  font-size: 14px;
  line-height: 1.65;
}
@media (max-width: 700px) {
  .zukan-participation-shell { padding-bottom: 96px; }
  .zukan-participation-row {
    grid-template-columns: 1fr;
    gap: 8px;
    align-items: start;
  }
  .zukan-participation-row-action { justify-self: start; }
  .zukan-participation-action,
  .zukan-participation-secondary-action { width: auto; }
}
`;

export function renderEventListBody(sessions: ObservationEventSessionRow[], strings: ObservationEventStrings, lang: SiteLang): string {
  const liveSessions = sessions.filter((s) => s.endedAt === null && Boolean(s.eventCode));
  const pastSessions = sessions.filter((s) => s.endedAt !== null);

  const renderRow = (s: ObservationEventSessionRow): string => {
    const isLive = s.endedAt === null;
    const detailHref = isLive && s.eventCode
      ? `/community/events/${encodeURIComponent(s.eventCode)}/join`
      : `/events/${encodeURIComponent(s.sessionId)}/recap`;
    const title = s.title || (isLive ? strings.listLiveSection : strings.listPastSection);
    const targets = (s.targetSpecies ?? []).slice(0, 4).map(escapeHtml).join("、");
    const cta = isLive ? strings.joinCta : strings.recapCta;
    return `
      <article class="zukan-participation-row" data-participation-result>
        <div class="zukan-participation-time">
          <span class="zukan-participation-status">${escapeHtml(isLive ? strings.badgeLive : strings.badgeEnded)}</span>
          <time datetime="${escapeHtml(s.startedAt)}">${escapeHtml(formatStartedAt(s.startedAt, lang))}</time>
        </div>
        <div>
          <h3>${escapeHtml(title)}</h3>
          ${targets ? `<p class="zukan-participation-meta">${escapeHtml(strings.liveTargetLabel)}: ${targets}</p>` : ""}
        </div>
        <div class="zukan-participation-row-action">
          <a class="zukan-participation-action" href="${detailHref}" aria-label="${escapeHtml(`${cta}: ${title}`)}">${escapeHtml(cta)}</a>
        </div>
      </article>`;
  };

  return `
<main class="zukan-participation-shell">
  <header class="zukan-participation-header">
    <p class="zukan-participation-eyebrow">${escapeHtml(strings.listEyebrow)}</p>
    <h1>${escapeHtml(strings.listHeroHeading)}</h1>
    <p>${escapeHtml(strings.listHeroLead)}</p>
  </header>

  <section class="zukan-participation-section" aria-labelledby="participation-current-heading">
    <h2 id="participation-current-heading">${escapeHtml(strings.listLiveSection)}</h2>
    ${liveSessions.length === 0
      ? `<p class="zukan-participation-empty">${escapeHtml(strings.listLiveEmpty)} <a href="/records?view=public">${escapeHtml(strings.listBackToCommunity)}</a></p>`
      : `<div class="zukan-participation-list">${liveSessions.map(renderRow).join("")}</div>`}
  </section>

  ${pastSessions.length > 0 ? `
  <details class="zukan-participation-history">
    <summary>${escapeHtml(strings.listPastSection)}</summary>
    <div class="zukan-participation-list">${pastSessions.slice(0, 12).map(renderRow).join("")}</div>
  </details>` : ""}

  <aside class="zukan-participation-organizer" data-organizer-entry>
    <h2>${escapeHtml(strings.listOrganizerHeading)}</h2>
    <p>${escapeHtml(strings.listOrganizerLead)}</p>
    <a class="zukan-participation-secondary-action" href="/community/events/new">${escapeHtml(strings.listCreateCta)}</a>
  </aside>
</main>
`;
}
