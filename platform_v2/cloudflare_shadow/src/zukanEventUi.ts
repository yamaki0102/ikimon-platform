import type { Env } from "./core/env";
import { escapeHtml } from "./core/http";

type Lang = "ja" | "en" | "es" | "pt-br";

export type EventCore = {
  sessionId: string;
  title: string;
  organizerUserId: string;
  startedAt: string;
  endedAt: string | null;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  participants: number | null;
  placeLabel: string | null;
  organizerLabel: string | null;
  summary: string | null;
  bring: string | null;
};

export type EventPhase = "upcoming" | "today" | "past";

function configText(config: Record<string, unknown>, keys: string[]): string | null {
  const sources: Array<Record<string, unknown>> = [config];
  for (const nested of ["detail", "info", "participation"]) {
    const value = config[nested];
    if (value && typeof value === "object" && !Array.isArray(value)) sources.push(value as Record<string, unknown>);
  }
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) return value.trim().slice(0, 400);
    }
  }
  return null;
}

export async function loadEventCore(db: Env["OBS_DB"], eventId: string): Promise<EventCore | null> {
  const row = await db
    .prepare("SELECT * FROM observation_event_sessions WHERE session_id = ? LIMIT 1")
    .bind(eventId)
    .first<Record<string, unknown>>();
  if (!row) return null;
  let participants: number | null = null;
  try {
    const counted = await db
      .prepare("SELECT COUNT(*) AS n FROM observation_event_participants WHERE session_id = ?")
      .bind(eventId)
      .first<{ n: number }>();
    participants = counted ? Number(counted.n) : null;
  } catch {
    participants = null;
  }
  const text = (key: string): string | null => (typeof row[key] === "string" && row[key] ? (row[key] as string) : null);
  const num = (key: string): number | null => (typeof row[key] === "number" && Number.isFinite(row[key]) ? (row[key] as number) : null);
  let config: Record<string, unknown> = {};
  try {
    const parsed = typeof row.config_json === "string" ? JSON.parse(row.config_json) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) config = parsed as Record<string, unknown>;
  } catch {
    config = {};
  }
  return {
    placeLabel: configText(config, ["placeName", "locationName", "meetingPoint", "venueName", "venue", "siteName"]),
    organizerLabel: configText(config, ["organizerName", "hostName", "host", "issuerName", "issuer"]),
    summary: configText(config, ["summary", "description", "overview", "lead"]),
    bring: configText(config, ["bring", "whatToBring"]),
    sessionId: String(row.session_id),
    title: text("title") ?? "",
    organizerUserId: text("organizer_user_id") ?? "",
    startedAt: text("started_at") ?? "",
    endedAt: text("ended_at"),
    placeId: text("place_id"),
    lat: num("location_lat"),
    lng: num("location_lng"),
    participants,
  };
}

const TZ = "Asia/Tokyo";

function partsOf(date: Date, locale: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat(locale, {
    timeZone: TZ,
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)) {
    out[p.type] = p.value;
  }
  return out;
}

function dayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function eventTiming(core: Pick<EventCore, "startedAt" | "endedAt">, lang: Lang, now: Date = new Date()) {
  const isEn = lang !== "ja";
  const locale = lang === "ja" ? "ja" : lang === "pt-br" ? "pt-BR" : lang;
  const start = new Date(core.startedAt);
  if (!core.startedAt || Number.isNaN(start.getTime())) {
    return { phase: "past" as EventPhase, dateLabel: core.startedAt, timeLabel: "", whenLabel: core.startedAt, shortMonth: "", shortDay: "" };
  }
  const sp = partsOf(start, locale);
  const dateLabel = isEn ? `${sp.month ? new Intl.DateTimeFormat(locale, { timeZone: TZ, month: "short", day: "numeric" }).format(start) : ""} (${sp.weekday})` : `${sp.month}月${sp.day}日（${sp.weekday}）`;
  const startTime = `${Number(sp.hour)}:${sp.minute}`;
  const end = core.endedAt ? new Date(core.endedAt) : null;
  const endTime = end && !Number.isNaN(end.getTime()) ? (() => { const ep = partsOf(end, locale); return `${Number(ep.hour)}:${ep.minute}`; })() : "";
  const timeLabel = endTime ? `${startTime}${isEn ? "–" : "〜"}${endTime}` : `${startTime}${isEn ? "" : "〜"}`;
  const sameDay = dayKey(start) === dayKey(now);
  const ended = end ? end.getTime() < now.getTime() : false;
  const phase: EventPhase = sameDay && !ended ? "today" : start.getTime() > now.getTime() ? "upcoming" : "past";
  return {
    phase,
    dateLabel,
    timeLabel,
    whenLabel: `${dateLabel} ${timeLabel}`,
    shortMonth: isEn ? new Intl.DateTimeFormat(locale, { timeZone: TZ, month: "short" }).format(start) : `${sp.month}月`,
    shortDay: sp.day ?? "",
  };
}

export function phaseChip(phase: EventPhase, dateLabel: string, isEn: boolean): string {
  if (phase === "today") return isEn ? "Happening today" : "本日開催中";
  if (phase === "upcoming") return isEn ? `Next ${dateLabel}` : `次回 ${dateLabel}`;
  return isEn ? `Ended ${dateLabel}` : `終了 ${dateLabel}`;
}

const ICON_BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>';
const ICON_SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4m0 0L8 8m4-4 4 4M5 13v6h14v-6"/></svg>';
const ICON_CAMERA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.2"/></svg>';
export const EVENT_ICON_SHARE = ICON_SHARE;
export const EVENT_ICON_CAMERA = ICON_CAMERA;

export const ZUKAN_EVENT_CSS = `
.ze{display:grid;gap:16px;min-width:0;max-width:1120px;margin:0 auto;color:#17251b}
.ze svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.ze-main{display:grid;gap:16px;min-width:0}
.ze-hero{position:relative;display:flex;flex-direction:column;justify-content:flex-end;gap:6px;min-height:240px;padding:20px;border-radius:20px;overflow:hidden;color:#fff;background:linear-gradient(180deg,rgba(8,18,12,0) 30%,rgba(8,18,12,.72) 100%),linear-gradient(150deg,#2a6b4f 0%,#143F2E 55%,#0c271c 100%)}
.ze-hero h1{margin:0;font-size:1.75rem;line-height:1.35;font-weight:700;overflow-wrap:anywhere;color:#fff}
.ze-hero p{margin:0;font-size:1rem;color:rgba(255,255,255,.92)}
.ze-chip{align-self:flex-start;margin-bottom:6px;padding:6px 14px;border-radius:999px;background:#fff;color:#17251b;font-weight:700;font-size:.9375rem}
.ze-hero-top{position:absolute;left:12px;right:12px;top:12px;display:flex;justify-content:space-between}
.ze-round,.ze-round:visited{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.92);color:#17251b}
.ze-facts{margin:0;display:grid}.ze-facts div{display:grid;grid-template-columns:5.5em minmax(0,1fr);gap:12px;padding:14px 0;border-bottom:1px solid #dde2dc}.ze-facts dt{color:#55615a;font-weight:600}.ze-facts dd{margin:0;font-weight:700;overflow-wrap:anywhere}
.ze-text{margin:0;font-size:1.0625rem;line-height:1.8}
.ze-note{margin:0;color:#55615a;font-size:1rem;line-height:1.7}
.ze-cta{display:grid;gap:12px;align-content:start}
.ze-cta h2{margin:0;font-size:1.0625rem}
.ze-btn,.ze-btn:visited{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:52px;padding:10px 18px;border:1.5px solid #143F2E;border-radius:16px;background:#143F2E;color:#fff;font:inherit;font-weight:700;text-decoration:none;cursor:pointer;box-shadow:0 2px 6px rgba(20,63,46,.25)}
.ze-btn.is-outline,.ze-btn.is-outline:visited{background:#fff;color:#143F2E;box-shadow:none}
.ze-section h2{margin:0 0 12px;font-size:1.25rem}
.ze-dot{display:flex;align-items:center;gap:8px;margin:0;font-weight:700;color:#143F2E}.ze-dot::before{content:"";width:8px;height:8px;border-radius:50%;background:#2f8f63}
.ze-empty{margin:0;padding:24px 16px;border:1px solid #dde2dc;border-radius:20px;text-align:center;color:#55615a;background:#fff;line-height:1.7;text-wrap:balance}
.ze-box{margin:0;padding:16px 18px;border-radius:16px;background:#f5f6f2;line-height:1.8}
.ze-summary{display:flex;align-items:center;gap:14px;padding-bottom:16px;border-bottom:1px solid #dde2dc}
.ze-summary-thumb{flex:none;width:64px;height:64px;border-radius:14px;background:linear-gradient(150deg,#2a6b4f,#143F2E)}
.ze-summary strong{display:block;font-size:1.125rem;line-height:1.4;overflow-wrap:anywhere}.ze-summary small{display:block;color:#55615a;margin-top:2px}
.ze-status{display:flex;align-items:center;gap:10px;padding:16px 18px;border-radius:16px;background:#e8f0ea;color:#143F2E;font-weight:700}
.ze-list{margin:0;padding:0;list-style:none;display:grid}
.ze-row,.ze-row:visited{display:flex;align-items:center;gap:14px;min-height:76px;padding:12px 0;border-bottom:1px solid #dde2dc;color:#17251b;text-decoration:none}
.ze-date{flex:none;display:grid;place-items:center;width:56px;height:64px;border-radius:14px;background:#e8f0ea;color:#143F2E;line-height:1.2;text-align:center}.ze-date small{font-size:.8125rem;font-weight:700}.ze-date b{font-size:1.375rem}
.ze-row-body{flex:1;min-width:0}.ze-row-body strong{display:block;font-size:1.0625rem;line-height:1.4;overflow-wrap:anywhere}.ze-row-body small{display:block;margin-top:2px;font-size:.9375rem;color:#55615a}
.ze-chev{width:20px!important;height:20px!important;color:#8a948d}
.ze-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.ze-head{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;min-height:56px}.ze-head h2{margin:0;text-align:center;font-size:1.25rem}
.ze-back,.ze-back:visited{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;color:#17251b}
.ze :focus-visible{outline:3px solid currentColor;outline-offset:3px}
@media(min-width:960px){.ze-main{grid-template-columns:minmax(0,1fr) 320px;gap:16px 32px;align-items:start}.ze-main>.ze-cta{grid-column:2;grid-row:1 / span 3;padding:20px;border:1px solid #dde2dc;border-radius:20px;background:#fff}.ze-main>:not(.ze-cta){grid-column:1}.ze-hero{min-height:280px}}
@media(prefers-reduced-motion:reduce){.ze,.ze *{transition:none!important;animation:none!important}}
`;

export function renderEventHero(options: {
  title: string;
  chip: string;
  sub?: string;
  backHref: string;
  backLabel: string;
  shareHref: string;
  shareLabel: string;
}): string {
  return `<header class="ze-hero">
    <div class="ze-hero-top"><a class="ze-round" href="${escapeHtml(options.backHref)}" aria-label="${escapeHtml(options.backLabel)}">${ICON_BACK}</a><a class="ze-round" href="${escapeHtml(options.shareHref)}" aria-label="${escapeHtml(options.shareLabel)}">${ICON_SHARE}</a></div>
    <span class="ze-chip">${escapeHtml(options.chip)}</span>
    <h1>${escapeHtml(options.title)}</h1>
    ${options.sub ? `<p>${escapeHtml(options.sub)}</p>` : ""}
  </header>`;
}

export function renderEventSubHead(title: string, backHref: string, backLabel: string): string {
  return `<header class="ze-head"><a class="ze-back" href="${escapeHtml(backHref)}" aria-label="${escapeHtml(backLabel)}">${ICON_BACK}</a><h2>${escapeHtml(title)}</h2><span></span></header>`;
}

export function renderEventFacts(rows: Array<[string, string]>): string {
  return `<dl class="ze-facts">${rows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("")}</dl>`;
}
