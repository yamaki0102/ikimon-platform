import type { ObservationEventSessionRow } from "../services/observationEventModeManager.js";
import type { ObservationEventStrings } from "../i18n/strings.js";
import { appendLangToHref } from "../i18n.js";
import {
  getObservationEventDiscoveryStrings,
  type ObservationEventDiscoveryStrings,
} from "../i18n/observationEventStrings.js";
import type { SiteLang } from "../i18n.js";
import { renderCheckinBody } from "./observationEventCheckin.js";

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

function formatWindow(startedAt: string, endedAt: string | null, lang: SiteLang): string {
  const start = new Date(startedAt);
  if (isNaN(start.getTime())) return "";
  const locale = localeForLang(lang);
  const startDate = start.toLocaleDateString(locale, {
    timeZone: "Asia/Tokyo",
    month: "short",
    day: "numeric",
  });
  const startTime = start.toLocaleTimeString(locale, {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!endedAt) return `${startDate} ${startTime}`;
  const end = new Date(endedAt);
  if (isNaN(end.getTime())) return `${startDate} ${startTime}`;
  const endDate = end.toLocaleDateString(locale, {
    timeZone: "Asia/Tokyo",
    month: "short",
    day: "numeric",
  });
  const endTime = end.toLocaleTimeString(locale, {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return startDate === endDate
    ? `${startDate} ${startTime}–${endTime}`
    : `${startDate} ${startTime} – ${endDate} ${endTime}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function collectDetailConfigSources(config: Record<string, unknown>): Array<Record<string, unknown>> {
  const sources: Array<Record<string, unknown>> = [config];
  for (const key of ["detail", "participation", "signup", "booking", "reservation", "info"] as const) {
    const nested = asRecord(config[key]);
    if (nested) sources.push(nested);
  }
  return sources;
}

function readTextFromSources(sources: Array<Record<string, unknown>>, keys: readonly string[]): string | null {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      } else if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
      }
    }
  }
  return null;
}

function readBooleanFromSources(sources: Array<Record<string, unknown>>, keys: readonly string[]): boolean | null {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const trimmed = value.trim().toLowerCase();
        if (trimmed === "true") return true;
        if (trimmed === "false") return false;
      }
    }
  }
  return null;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function providerLabelFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    const firstLabel = host.split(".")[0] ?? "";
    if (!firstLabel) return "外部サイト";
    return firstLabel[0]!.toUpperCase() + firstLabel.slice(1);
  } catch {
    return "外部サイト";
  }
}

function resolveSummaryText(sources: Array<Record<string, unknown>>, keys: readonly string[]): string | null {
  return readTextFromSources(sources, keys);
}

function resolvePlaceLabel(
  _session: ObservationEventSessionRow,
  sources: Array<Record<string, unknown>>,
  fieldName?: string | null,
): string | null {
  void _session;
  if (fieldName && fieldName.trim()) return fieldName.trim();
  return readTextFromSources(sources, ["placeName", "locationName", "meetingPoint", "meetingPointLabel", "venueName", "venue", "siteName"]);
}

function resolveOrganizerLabel(sources: Array<Record<string, unknown>>): string | null {
  return readTextFromSources(sources, ["organizerName", "issuerName", "issuer", "hostName", "host", "sourceName"]);
}

function resolveCostLabel(sources: Array<Record<string, unknown>>): string | null {
  return readTextFromSources(sources, ["priceText", "price", "feeText", "fee", "cost", "ticketPrice", "entryFee"]);
}

export interface ObservationEventExternalSignup {
  providerLabel: string;
  providerUrl: string;
  note: string | null;
}

export type ObservationEventParticipationStatus = "open" | "upcoming" | "ended" | "cancelled";

export interface ObservationEventTeamLite {
  teamId: string;
  name: string;
  color: string;
  memberCount: number;
}

export interface ObservationEventDetailRenderOptions {
  fieldName?: string | null;
  externalSignup?: ObservationEventExternalSignup | null;
  showCheckin?: boolean;
  teams?: ObservationEventTeamLite[];
  isAuthenticated: boolean;
  recordHref?: string;
  recapHref?: string | null;
  status?: ObservationEventParticipationStatus;
}

export function isCancelledSession(s: ObservationEventSessionRow): boolean {
  const config = s.config as Record<string, unknown>;
  return (
    config.cancelled === true ||
    config.status === "cancelled" ||
    config.state === "cancelled"
  );
}

export function isEndedSession(s: ObservationEventSessionRow, nowMs = Date.now()): boolean {
  const endedMs = s.endedAt ? Date.parse(s.endedAt) : NaN;
  return Number.isFinite(endedMs) ? endedMs <= nowMs : s.endedAt !== null;
}

export function classifyObservationEventParticipation(
  s: ObservationEventSessionRow,
  nowMs = Date.now(),
): ObservationEventParticipationStatus {
  if (isCancelledSession(s)) return "cancelled";
  if (isEndedSession(s, nowMs)) return "ended";
  return startMs(s) > nowMs ? "upcoming" : "open";
}

export function readObservationEventExternalSignup(
  session: ObservationEventSessionRow,
): ObservationEventExternalSignup | null {
  const sources = collectDetailConfigSources(session.config);
  const url = readTextFromSources(sources, ["externalSignupUrl", "signupUrl", "bookingUrl", "providerUrl", "url", "link"]);
  if (!url || !isHttpUrl(url)) return null;
  const providerName = readTextFromSources(sources, ["providerName", "provider", "siteName", "site", "bookingSiteName"]);
  const note = readTextFromSources(sources, ["note", "description", "body", "lead"]);
  return {
    providerLabel: providerName ?? providerLabelFromUrl(url),
    providerUrl: url,
    note,
  };
}

export function shouldRenderObservationEventCheckin(
  session: ObservationEventSessionRow,
  externalSignup = readObservationEventExternalSignup(session),
): boolean {
  const sources = collectDetailConfigSources(session.config);
  const explicit = readBooleanFromSources(sources, ["nativeCheckinAllowed", "checkinAllowed", "walkInAllowed"]);
  if (externalSignup) return explicit === true;
  return explicit !== false;
}

export function buildParticipationRecordHref(session: ObservationEventSessionRow, lang: SiteLang): string {
  const params = new URLSearchParams();
  if (session.eventCode) params.set("event", session.eventCode);
  params.set("eventSessionId", session.sessionId);
  params.set("participantRole", "participant");
  return appendLangToHref(`/record?${params.toString()}`, lang);
}

function renderFact(label: string, value: string): string {
  return `
    <div class="zukan-participation-detail-fact">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>`;
}

export function renderObservationEventJoinBody(
  session: ObservationEventSessionRow,
  strings: ObservationEventStrings,
  lang: SiteLang,
  options: ObservationEventDetailRenderOptions = {},
): string {
  const d = getObservationEventDiscoveryStrings(lang);
  const status = options.status ?? classifyObservationEventParticipation(session);
  const sources = collectDetailConfigSources(session.config);
  const title = session.title || d.untitled;
  const summaryText = resolveSummaryText(sources, ["summary", "description", "body", "overview", "lead"]);
  const guidanceText = resolveSummaryText(sources, ["guide", "instructions", "whatToBring", "bring", "safety", "safetyNote"]);
  const placeText = resolvePlaceLabel(session, sources, options.fieldName);
  const organizerText = resolveOrganizerLabel(sources);
  const costText = resolveCostLabel(sources);
  const whenText = formatWindow(session.startedAt, session.endedAt, lang) || d.dateTbd;
  const externalSignup = options.externalSignup ?? readObservationEventExternalSignup(session);
  const showCheckin = options.showCheckin ?? shouldRenderObservationEventCheckin(session, externalSignup);
  const recordHref = options.recordHref ?? buildParticipationRecordHref(session, lang);
  const recapHref = status === "ended" ? options.recapHref ?? null : null;
  const stateLabel = status === "cancelled"
    ? d.badgeCancelled
    : status === "ended"
      ? strings.badgeEnded
      : status === "upcoming"
        ? d.badgeUpcoming
        : d.badgeActionable;
  const stateNote = status === "cancelled"
    ? d.detailCancelledNote
    : status === "ended"
      ? d.detailEndedNote
      : externalSignup
        ? d.detailExternalNote
        : showCheckin
          ? d.detailOpenNote
          : d.detailNoParticipationNote;
  const externalCtaLabel = externalSignup
    ? d.detailExternalCtaTemplate.replace("{provider}", externalSignup.providerLabel)
    : "";

  const actionButtons: string[] = [];
  if (status === "ended" || status === "cancelled") {
    actionButtons.push(`<a class="zukan-participation-action" href="${escapeHtml(recordHref)}">${escapeHtml(d.detailRecordCta)}</a>`);
    if (recapHref) {
      actionButtons.push(`<a class="zukan-participation-secondary-action" href="${escapeHtml(recapHref)}">${escapeHtml(strings.recapCta)}</a>`);
    }
  } else if (externalSignup && !showCheckin) {
    actionButtons.push(
      `<a class="zukan-participation-action" href="${escapeHtml(externalSignup.providerUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(externalCtaLabel)}</a>`,
      `<a class="zukan-participation-secondary-action" href="${escapeHtml(recordHref)}">${escapeHtml(d.detailRecordCta)}</a>`,
    );
  } else if (externalSignup && showCheckin) {
    actionButtons.push(
      `<a class="zukan-participation-action" href="${escapeHtml(externalSignup.providerUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(externalCtaLabel)}</a>`,
      `<a class="zukan-participation-secondary-action" href="#participation-checkin">${escapeHtml(strings.joinCta)}</a>`,
      `<a class="zukan-participation-secondary-action" href="${escapeHtml(recordHref)}">${escapeHtml(d.detailRecordCta)}</a>`,
    );
  } else if (showCheckin) {
    actionButtons.push(
      `<a class="zukan-participation-action" href="#participation-checkin">${escapeHtml(strings.joinCta)}</a>`,
      `<a class="zukan-participation-secondary-action" href="${escapeHtml(recordHref)}">${escapeHtml(d.detailRecordCta)}</a>`,
    );
  } else {
    actionButtons.push(`<a class="zukan-participation-action" href="${escapeHtml(recordHref)}">${escapeHtml(d.detailRecordCta)}</a>`);
  }

  const contentSection = summaryText
    ? `
    <section class="zukan-participation-detail-section" aria-labelledby="participation-content-heading">
      <h2 id="participation-content-heading">${escapeHtml(d.detailContentHeading)}</h2>
      <p>${escapeHtml(summaryText)}</p>
    </section>`
    : "";

  const guidanceSection = guidanceText
    ? `
    <section class="zukan-participation-detail-section" aria-labelledby="participation-guidance-heading">
      <h2 id="participation-guidance-heading">${escapeHtml(d.detailGuidanceHeading)}</h2>
      <p>${escapeHtml(guidanceText)}</p>
    </section>`
    : "";

  const checkinSection = showCheckin && status !== "ended" && status !== "cancelled"
    ? `
    <section id="participation-checkin" class="zukan-participation-detail-checkin">
      ${renderCheckinBody({
        session,
        teams: options.teams ?? [],
        isAuthenticated: options.isAuthenticated,
      })}
    </section>`
    : "";

  return `
<main class="zukan-participation-shell zukan-participation-detail-shell" data-participation-detail data-participation-status="${escapeHtml(status)}">
  <header class="zukan-participation-header">
    <p class="zukan-participation-eyebrow">${escapeHtml(d.detailPageTitle)}</p>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(d.detailLead)}</p>
    <p class="zukan-participation-tz-note">${escapeHtml(stateLabel)} · ${escapeHtml(whenText)}</p>
  </header>
  <div class="zukan-participation-detail-grid">
    <section class="zukan-participation-detail-panel" aria-labelledby="participation-summary-heading">
      <h2 id="participation-summary-heading">${escapeHtml(d.detailPageTitle)}</h2>
      <div class="zukan-participation-notice" role="status">
        <p>${escapeHtml(stateNote)}</p>
      </div>
      <div class="zukan-participation-detail-actions">
        ${actionButtons.join("")}
      </div>
      <p class="zukan-participation-detail-note">${escapeHtml(whenText)}</p>
    </section>
    <aside class="zukan-participation-detail-aside" aria-label="${escapeHtml(d.detailTimePlaceHeading)}">
      ${contentSection}
      <section class="zukan-participation-detail-section" aria-labelledby="participation-time-place-heading">
        <h2 id="participation-time-place-heading">${escapeHtml(d.detailTimePlaceHeading)}</h2>
        <dl class="zukan-participation-detail-facts">
          ${renderFact(d.detailWhenLabel, whenText)}
          ${renderFact(d.detailWhereLabel, placeText ?? d.detailUnknownValue)}
          ${renderFact(d.detailWhoLabel, organizerText ?? d.detailUnknownValue)}
        </dl>
      </section>
      <section class="zukan-participation-detail-section" aria-labelledby="participation-method-facts-heading">
        <h2 id="participation-method-facts-heading">${escapeHtml(d.detailParticipationHeading)}</h2>
        <dl class="zukan-participation-detail-facts">
          ${renderFact(d.detailCostLabel, costText ?? d.detailUnknownValue)}
          ${renderFact(d.detailMethodLabel, externalSignup ? externalSignup.providerLabel : (showCheckin ? d.detailNativeEntryLabel : d.detailUnknownValue))}
        </dl>
        ${externalSignup && externalSignup.note ? `<p class="zukan-participation-detail-note">${escapeHtml(externalSignup.note)}</p>` : ""}
      </section>
      ${guidanceSection}
      <section class="zukan-participation-detail-section" aria-labelledby="participation-record-heading" id="participation-record">
        <h2 id="participation-record-heading">${escapeHtml(d.detailRecordHeading)}</h2>
        <div class="zukan-participation-detail-record">
          <p>${escapeHtml(d.detailRecordLead)}</p>
          ${recapHref ? `<a class="zukan-participation-secondary-action" href="${escapeHtml(recapHref)}">${escapeHtml(strings.recapCta)}</a>` : ""}
        </div>
      </section>
    </aside>
  </div>
  ${checkinSection}
</main>
`;
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
.zukan-participation-detail-shell {
  width: min(100%, 1160px);
}
.zukan-participation-detail-grid {
  display: grid;
  gap: 20px;
}
.zukan-participation-detail-panel,
.zukan-participation-detail-aside,
.zukan-participation-detail-checkin {
  border: 1px solid #dde2dd;
  border-radius: 16px;
  background: #fff;
}
.zukan-participation-detail-panel {
  padding: 22px;
  background: linear-gradient(180deg, #ffffff 0%, #fafbf8 100%);
}
.zukan-participation-detail-panel h2 {
  margin: 0;
  color: #17211b;
  font-size: clamp(22px, 3.2vw, 30px);
  line-height: 1.28;
}
.zukan-participation-detail-panel p {
  margin: 10px 0 0;
  color: #55615a;
  font-size: 15px;
  line-height: 1.75;
}
.zukan-participation-detail-panel .zukan-participation-notice {
  margin-top: 16px;
}
.zukan-participation-detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 18px;
}
.zukan-participation-detail-note {
  margin: 14px 0 0;
  color: #55615a;
  font-size: 14px;
  line-height: 1.7;
}
.zukan-participation-detail-aside {
  padding: 18px;
  background: #f7f7f3;
}
.zukan-participation-detail-section + .zukan-participation-detail-section {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid #dde2dd;
}
.zukan-participation-detail-section h2 {
  margin: 0 0 10px;
  color: #17211b;
  font-size: 17px;
  line-height: 1.35;
}
.zukan-participation-detail-facts {
  display: grid;
  gap: 10px;
}
.zukan-participation-detail-fact {
  padding: 12px 14px;
  border: 1px solid #dde2dd;
  border-radius: 12px;
  background: #fff;
}
.zukan-participation-detail-fact dt {
  color: #55615a;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .04em;
}
.zukan-participation-detail-fact dd {
  margin: 4px 0 0;
  color: #17211b;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.5;
}
.zukan-participation-detail-record {
  display: grid;
  gap: 10px;
}
.zukan-participation-detail-record p {
  margin: 0;
  color: #55615a;
  font-size: 14px;
  line-height: 1.65;
}
.zukan-participation-detail-record .zukan-participation-action,
.zukan-participation-detail-record .zukan-participation-secondary-action {
  justify-self: start;
}
.zukan-participation-detail-checkin {
  margin-top: 24px;
  padding: 20px;
}
@media (min-width: 768px) {
  .zukan-participation-detail-facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1160px) {
  .zukan-participation-detail-grid {
    grid-template-columns: minmax(0, 1.18fr) minmax(300px, .82fr);
    align-items: start;
  }
  .zukan-participation-detail-facts {
    grid-template-columns: 1fr;
  }
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
      const href = appendLangToHref(`/community/events/${encodeURIComponent(s.eventCode)}/join`, lang);
      action = `<a class="zukan-participation-action" href="${href}" aria-label="${escapeHtml(`${d.detailCta}：${title}`)}">${escapeHtml(d.detailCta)}</a>`;
    } else if (kind === "ended") {
      const href = appendLangToHref(`/events/${encodeURIComponent(s.sessionId)}/recap`, lang);
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
      ? `<p><a class="zukan-participation-secondary-action" href="${escapeHtml(appendLangToHref(options.retryHref, lang))}">${escapeHtml(d.retryCta)}</a></p>`
      : ""}
  </div>`
    : "";

  const actionableSection = `
  <section class="zukan-participation-section" aria-labelledby="participation-actionable-heading">
    <h2 id="participation-actionable-heading">${escapeHtml(d.sectionActionable)}</h2>
    ${actionable.length === 0
      ? `<p class="zukan-participation-empty" data-participation-empty>${escapeHtml(d.actionableEmpty)} <a href="${escapeHtml(appendLangToHref("/records?view=public", lang))}">${escapeHtml(strings.listBackToCommunity)}</a></p>`
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
    <p class="zukan-participation-empty" data-participation-empty>${escapeHtml(d.actionableEmpty)} ${escapeHtml(d.noProgramsLead)} <a href="${escapeHtml(appendLangToHref("/records?view=public", lang))}">${escapeHtml(strings.listBackToCommunity)}</a></p>
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
    <a class="zukan-participation-secondary-action" href="${escapeHtml(appendLangToHref("/community/events/new", lang))}">${escapeHtml(strings.listCreateCta)}</a>
  </aside>
</main>
`;
}
