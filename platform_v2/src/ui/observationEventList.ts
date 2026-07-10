import type { ObservationEventSessionRow, EventMode } from "../services/observationEventModeManager.js";
import type { ObservationEventStrings } from "../i18n/strings.js";
import type { SiteLang } from "../i18n.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | null {
  const n = typeof value === "number" ? value : (typeof value === "string" && value.trim() ? Number(value) : NaN);
  return Number.isFinite(n) ? n : null;
}

function categoryLabel(value: unknown): string {
  switch (stringValue(value)) {
    case "family": return "親子向け";
    case "school": return "学校向け";
    case "beginner": return "初心者歓迎";
    case "corporate": return "企業・自治体向け";
    default: return "";
  }
}

function difficultyLabel(value: unknown): string {
  switch (stringValue(value)) {
    case "easy": return "初心者歓迎";
    case "moderate": return "少し歩く";
    case "hard": return "健脚向け";
    default: return "";
  }
}

function formatKm(value: number | null): string {
  if (value === null) return "";
  return `${Number(value.toFixed(1))}km`;
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
    const config = asRecord(s.config);
    const profile = asRecord(config.event_profile);
    const placeEvent = asRecord(config.place_event);
    const meetingPoint = stringValue(placeEvent.meeting_point);
    const placeLabel = stringValue(placeEvent.place_label);
    const targetAge = stringValue(profile.target_age_label);
    const difficulty = difficultyLabel(profile.difficulty);
    const category = categoryLabel(profile.category);
    const distance = formatKm(numberValue(profile.walking_distance_km));
    const capacity = numberValue(profile.capacity);
    const tags = [category, difficulty].filter(Boolean);
    const meta = [
      meetingPoint,
      targetAge,
      distance,
      capacity !== null ? `定員 ${capacity}名` : "",
    ].filter(Boolean);
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
        ${placeLabel ? `<p class="evt-lead" style="font-size:13px;">${escapeHtml(placeLabel)}</p>` : ""}
        ${tags.length ? `<div class="evt-event-card-tags">${tags.map((tag) => `<span class="evt-badge evt-mode-discovery">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        ${meta.length ? `<div class="evt-event-card-meta">${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
        <div class="evt-event-card-actions">
          <a class="evt-btn evt-btn-${isLive ? "primary" : "ghost"}" href="${detailHref}">
            ${isLive ? strings.joinCta : strings.recapCta}
          </a>
          <a class="evt-btn evt-btn-ghost" href="/community/events/new?template_from=${encodeURIComponent(s.sessionId)}"
             title="この観察会を再開催">🔁 もう一度開催</a>
        </div>
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

  <nav class="evt-wire-filterbar" aria-label="観察会を探す">
    <button type="button" class="evt-wire-chip is-active" data-event-filter="live">開催中</button>
    <button type="button" class="evt-wire-chip" data-event-filter="beginner">初心者歓迎</button>
    <button type="button" class="evt-wire-chip" data-event-filter="family">親子向け</button>
    <button type="button" class="evt-wire-chip" data-event-filter="public">Public</button>
    <a class="evt-wire-chip" href="/community/fields">フィールドから探す</a>
  </nav>

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
