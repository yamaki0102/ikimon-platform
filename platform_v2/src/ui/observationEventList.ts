import type { ObservationEventSessionRow } from "../services/observationEventModeManager.js";
import type { ObservationEventStrings } from "../i18n/strings.js";
import {
  getObservationEventDiscoveryStrings,
  type ObservationEventDiscoveryStrings,
} from "../i18n/observationEventStrings.js";
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
  // M6 sessions carry no per-Program IANA zone; the product is regional Japan,
  // so pin the display zone instead of leaning on the server's implicit zone.
  return d.toLocaleString(localeForLang(lang), {
    timeZone: "Asia/Tokyo",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
.zukan-participation-tz-note {
  margin: 12px 0 0;
  color: #55615a;
  font-size: 13px;
  line-height: 1.6;
}
.zukan-participation-notice {
  margin: 24px 0 0;
  padding: 16px 18px;
  border: 1px solid #c8a24a;
  border-radius: 12px;
  background: #fbf6e9;
}
.zukan-participation-notice p {
  margin: 0 0 12px;
  color: #17211b;
  font-size: 15px;
  line-height: 1.7;
}
.zukan-participation-notice p:last-child { margin-bottom: 0; }
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

export interface EventListRenderOptions {
  /** The discovery query failed; keep any already-loaded rows and offer retry. */
  loadFailed?: boolean;
  /** Where the explicit retry link points (normally the current list URL). */
  retryHref?: string;
}

type ParticipationKind = "actionable" | "upcoming" | "ended" | "cancelled";

interface HistoryEntry {
  row: ObservationEventSessionRow;
  cancelled: boolean;
}

interface GroupedSessions {
  actionable: ObservationEventSessionRow[];
  upcoming: ObservationEventSessionRow[];
  history: HistoryEntry[];
}

/**
 * Cancellation is a presentation-only read of the existing free-form `config`
 * blob. M6 has no dedicated cancelled column and this slice adds no schema, so a
 * row is only ever shown as `中止` when its own stored config already says so.
 */
function isCancelledSession(s: ObservationEventSessionRow): boolean {
  const config = s.config as Record<string, unknown>;
  return (
    config.cancelled === true ||
    config.status === "cancelled" ||
    config.state === "cancelled"
  );
}

function startMs(s: ObservationEventSessionRow): number {
  const ms = Date.parse(s.startedAt);
  return Number.isFinite(ms) ? ms : 0;
}

function groupSessions(sessions: ObservationEventSessionRow[], nowMs: number): GroupedSessions {
  const actionable: ObservationEventSessionRow[] = [];
  const upcoming: ObservationEventSessionRow[] = [];
  const history: HistoryEntry[] = [];

  for (const s of sessions) {
    const cancelled = isCancelledSession(s);
    const endedMs = s.endedAt ? Date.parse(s.endedAt) : NaN;
    const hasEnded = Number.isFinite(endedMs) ? endedMs <= nowMs : s.endedAt !== null;
    if (cancelled || hasEnded) {
      history.push({ row: s, cancelled });
      continue;
    }
    // Still open. A session without a public participation code is private and is
    // never advertised as joinable discovery.
    if (!s.eventCode) continue;
    if (startMs(s) > nowMs) upcoming.push(s);
    else actionable.push(s);
  }

  const byStartThenId = (a: ObservationEventSessionRow, b: ObservationEventSessionRow): number =>
    startMs(a) - startMs(b) || a.sessionId.localeCompare(b.sessionId);
  actionable.sort(byStartThenId);
  upcoming.sort(byStartThenId);
  history.sort((a, b) => {
    const am = Date.parse(a.row.endedAt ?? a.row.startedAt);
    const bm = Date.parse(b.row.endedAt ?? b.row.startedAt);
    return (Number.isFinite(bm) ? bm : 0) - (Number.isFinite(am) ? am : 0)
      || a.row.sessionId.localeCompare(b.row.sessionId);
  });

  return { actionable, upcoming, history };
}

export function renderEventListBody(
  sessions: ObservationEventSessionRow[],
  strings: ObservationEventStrings,
  lang: SiteLang,
  options: EventListRenderOptions = {},
): string {
  const d: ObservationEventDiscoveryStrings = getObservationEventDiscoveryStrings(lang);
  const { actionable, upcoming, history } = groupSessions(sessions, Date.now());
  const loadFailed = options.loadFailed === true;
  const nothing = actionable.length === 0 && upcoming.length === 0 && history.length === 0;

  const renderRow = (s: ObservationEventSessionRow, kind: ParticipationKind): string => {
    const title = s.title || d.untitled;
    const when = formatStartedAt(s.startedAt, lang) || d.dateTbd;
    const badge = kind === "actionable"
      ? d.badgeActionable
      : kind === "upcoming"
        ? d.badgeUpcoming
        : kind === "cancelled"
          ? d.badgeCancelled
          : strings.badgeEnded;
    const targets = (s.targetSpecies ?? []).slice(0, 4).map(escapeHtml).join("、");

    let action = "";
    if ((kind === "actionable" || kind === "upcoming") && s.eventCode) {
      const href = `/community/events/${encodeURIComponent(s.eventCode)}/join`;
      action = `<a class="zukan-participation-action" href="${href}" aria-label="${escapeHtml(`${d.detailCta}：${title}`)}">${escapeHtml(d.detailCta)}</a>`;
    } else if (kind === "ended") {
      const href = `/events/${encodeURIComponent(s.sessionId)}/recap`;
      action = `<a class="zukan-participation-secondary-action" href="${href}" aria-label="${escapeHtml(`${strings.recapCta}：${title}`)}">${escapeHtml(strings.recapCta)}</a>`;
    }
    // Cancelled rows carry no action button: there is no safe next step.

    return `
      <article class="zukan-participation-row" data-participation-result data-participation-kind="${kind}">
        <div class="zukan-participation-time">
          <span class="zukan-participation-status">${escapeHtml(badge)}</span>
          <time datetime="${escapeHtml(s.startedAt)}">${escapeHtml(when)}</time>
        </div>
        <div>
          <h3>${escapeHtml(title)}</h3>
          ${targets ? `<p class="zukan-participation-meta">${escapeHtml(strings.liveTargetLabel)}：${targets}</p>` : ""}
        </div>
        <div class="zukan-participation-row-action">${action}</div>
      </article>`;
  };

  const failureBanner = loadFailed
    ? `
  <div class="zukan-participation-notice" role="alert" data-load-failed>
    <p>${escapeHtml(d.loadFailed)}</p>
    ${options.retryHref
      ? `<p><a class="zukan-participation-secondary-action" href="${escapeHtml(options.retryHref)}">${escapeHtml(d.retryCta)}</a></p>`
      : ""}
  </div>`
    : "";

  const actionableSection = `
  <section class="zukan-participation-section" aria-labelledby="participation-actionable-heading">
    <h2 id="participation-actionable-heading">${escapeHtml(d.sectionActionable)}</h2>
    ${actionable.length === 0
      ? `<p class="zukan-participation-empty" data-participation-empty>${escapeHtml(d.actionableEmpty)} <a href="/records?view=public">${escapeHtml(strings.listBackToCommunity)}</a></p>`
      : `<div class="zukan-participation-list">${actionable.map((s) => renderRow(s, "actionable")).join("")}</div>`}
  </section>`;

  const upcomingSection = upcoming.length > 0
    ? `
  <section class="zukan-participation-section" aria-labelledby="participation-upcoming-heading">
    <h2 id="participation-upcoming-heading">${escapeHtml(d.sectionUpcoming)}</h2>
    <div class="zukan-participation-list">${upcoming.map((s) => renderRow(s, "upcoming")).join("")}</div>
  </section>`
    : "";

  const historySection = history.length > 0
    ? `
  <details class="zukan-participation-history">
    <summary>${escapeHtml(strings.listPastSection)}</summary>
    <div class="zukan-participation-list">${history.slice(0, 12).map(({ row, cancelled }) => renderRow(row, cancelled ? "cancelled" : "ended")).join("")}</div>
  </details>`
    : "";

  const noProgramsBlock = `
  <section class="zukan-participation-section" aria-labelledby="participation-actionable-heading">
    <h2 id="participation-actionable-heading">${escapeHtml(d.sectionActionable)}</h2>
    <p class="zukan-participation-empty" data-participation-empty>${escapeHtml(d.actionableEmpty)} ${escapeHtml(d.noProgramsLead)} <a href="/records?view=public">${escapeHtml(strings.listBackToCommunity)}</a></p>
  </section>`;

  let discoveryBody: string;
  if (loadFailed && nothing) {
    discoveryBody = "";
  } else if (nothing) {
    discoveryBody = noProgramsBlock;
  } else {
    discoveryBody = `${actionableSection}${upcomingSection}${historySection}`;
  }

  const tzNote = !nothing
    ? `<p class="zukan-participation-tz-note">${escapeHtml(d.timezoneNote)}</p>`
    : "";

  return `
<main class="zukan-participation-shell">
  <header class="zukan-participation-header">
    <p class="zukan-participation-eyebrow">${escapeHtml(strings.listEyebrow)}</p>
    <h1>${escapeHtml(strings.listHeroHeading)}</h1>
    <p>${escapeHtml(strings.listHeroLead)}</p>
    ${tzNote}
  </header>
${failureBanner}
${discoveryBody}
  <aside class="zukan-participation-organizer" data-organizer-entry>
    <h2>${escapeHtml(strings.listOrganizerHeading)}</h2>
    <p>${escapeHtml(strings.listOrganizerLead)}</p>
    <a class="zukan-participation-secondary-action" href="/community/events/new">${escapeHtml(strings.listCreateCta)}</a>
  </aside>
</main>
`;
}
