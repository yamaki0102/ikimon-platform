import type { Env } from "./core/env";
import { escapeHtml } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { ZUKAN_EVENT_CSS, eventTiming, phaseChip, renderEventHero, EVENT_ICON_CAMERA, EVENT_ICON_SHARE, type EventPhase } from "./zukanEventUi";
import { canViewEventRecord, isSensitiveOrRareEventRecord, resolveEventRecordVisibility } from "./programs/eventRecordVisibility";
import { isObservationEventQaFixture } from "./programs/rally";
import { mapObservationEventSession, type ObservationEventSessionD1Row } from "./programs/runtime";

type Lang = "ja" | "en" | "es" | "pt-br";
type SessionLike = { userId: string; displayName?: string | null; banned?: boolean } | null;

export type EventsV2ScheduleItem = { time: string; title: string };

export type EventsV2Event = {
  sessionId: string;
  title: string;
  organizerUserId: string;
  startedAt: string;
  endedAt: string | null;
  fieldId: string | null;
  lat: number | null;
  lng: number | null;
  participants: number;
  placeName: string | null;
  meetingPoint: string | null;
  organizerLabel: string | null;
  summary: string | null;
  bring: string | null;
  schedule: EventsV2ScheduleItem[];
  station: string | null;
  parking: string | null;
  caution: string | null;
  rain: string | null;
  cost: string | null;
  kind: string | null;
  capacity: number | null;
};

export type EventsV2ListItem = EventsV2Event & { phase: EventPhase; distanceKm: number | null };

export type EventsV2Record = {
  observationId: string | null;
  taxon: string;
  at: string;
  photoUrl: string | null;
  mine: boolean;
};

export type EventsV2Records = { records: EventsV2Record[]; recordCount: number; speciesCount: number; speciesNames: string[] };

const PLACE_KEYS = ["placeName", "locationName", "venueName", "venue", "siteName"];
const MEETING_KEYS = ["meetingPoint", "meetingPlace", "assemblyPoint", "gatherPlace"];
const ORGANIZER_KEYS = ["organizerName", "hostName", "host", "issuerName", "issuer"];
const SUMMARY_KEYS = ["summary", "description", "overview", "lead"];
const BRING_KEYS = ["bring", "whatToBring", "belongings"];
const STATION_KEYS = ["nearestStation", "station", "access"];
const PARKING_KEYS = ["parking", "parkingInfo"];
const CAUTION_KEYS = ["cautions", "caution", "notes", "precautions", "safety"];
const RAIN_KEYS = ["rain", "rainPolicy", "weatherPolicy", "ifRain"];
const COST_KEYS = ["cost", "fee", "price"];
const KIND_KEYS = ["eventKind", "eventType", "category", "kind"];
const SCHEDULE_KEYS = ["schedule", "program", "flow", "agenda", "timeline"];

function configSources(config: Record<string, unknown>): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [config];
  for (const nested of ["detail", "info", "participation"]) {
    const value = config[nested];
    if (value && typeof value === "object" && !Array.isArray(value)) out.push(value as Record<string, unknown>);
  }
  return out;
}

function configText(config: Record<string, unknown>, keys: string[], max = 400): string | null {
  for (const source of configSources(config)) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) return value.trim().slice(0, max);
      if (Array.isArray(value) && key === "bring" && value.every((v) => typeof v === "string") && value.length > 0) return (value as string[]).join("・").slice(0, max);
    }
  }
  return null;
}

export function parseEventsV2Schedule(config: Record<string, unknown>): EventsV2ScheduleItem[] {
  for (const source of configSources(config)) {
    for (const key of SCHEDULE_KEYS) {
      const value = source[key];
      const items: EventsV2ScheduleItem[] = [];
      if (Array.isArray(value)) {
        for (const entry of value) {
          if (typeof entry === "string" && entry.trim()) {
            const m = entry.trim().match(/^(\d{1,2}[:：]\d{2})\s*[-–〜~]?\s*(.+)$/u);
            items.push(m ? { time: m[1]!.replace("：", ":"), title: m[2]!.slice(0, 80) } : { time: "", title: entry.trim().slice(0, 80) });
          } else if (entry && typeof entry === "object") {
            const o = entry as Record<string, unknown>;
            const title = [o.title, o.label, o.text, o.name].find((v) => typeof v === "string" && v.trim()) as string | undefined;
            const time = [o.time, o.at, o.start].find((v) => typeof v === "string" && v.trim()) as string | undefined;
            if (title) items.push({ time: (time ?? "").trim().slice(0, 12), title: title.trim().slice(0, 80) });
          }
        }
      } else if (typeof value === "string" && value.trim()) {
        for (const line of value.split(/\r?\n/u)) {
          const t = line.trim();
          if (!t) continue;
          const m = t.match(/^(\d{1,2}[:：]\d{2})\s*[-–〜~]?\s*(.+)$/u);
          items.push(m ? { time: m[1]!.replace("：", ":"), title: m[2]!.slice(0, 80) } : { time: "", title: t.slice(0, 80) });
        }
      }
      if (items.length > 0) return items.slice(0, 12);
    }
  }
  return [];
}

function configCapacity(config: Record<string, unknown>): number | null {
  const pub = config.public_page;
  const raw = (pub && typeof pub === "object" && !Array.isArray(pub) ? (pub as Record<string, unknown>).capacity : undefined) ?? config.capacity;
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 1 ? raw : null;
}

function parseConfig(raw: unknown): Record<string, unknown> {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch { /* ignore */ }
  return {};
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function loadPlaceNames(db: Env["OBS_DB"], fieldIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(fieldIds.filter(Boolean))];
  if (ids.length === 0) return out;
  const marks = ids.map(() => "?").join(", ");
  try {
    const res = await db.prepare(`SELECT place_id, canonical_name FROM places WHERE place_id IN (${marks})`).bind(...ids).all<{ place_id: string; canonical_name: string }>();
    for (const r of res.results ?? []) if (r.canonical_name) out.set(r.place_id, r.canonical_name);
  } catch { /* optional */ }
  const missing = ids.filter((id) => !out.has(id));
  if (missing.length > 0) {
    try {
      const m2 = missing.map(() => "?").join(", ");
      const res = await db.prepare(`SELECT field_id, name FROM user_observation_fields WHERE field_id IN (${m2}) AND deleted_at IS NULL`).bind(...missing).all<{ field_id: string; name: string }>();
      for (const r of res.results ?? []) if (r.name) out.set(r.field_id, r.name);
    } catch { /* optional */ }
  }
  return out;
}

async function loadParticipantCounts(db: Env["OBS_DB"], ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  try {
    const res = await db
      .prepare(`SELECT session_id, COUNT(*) AS n FROM observation_event_participants WHERE session_id IN (${ids.map(() => "?").join(", ")}) GROUP BY session_id`)
      .bind(...ids)
      .all<{ session_id: string; n: number }>();
    for (const r of res.results ?? []) out.set(r.session_id, Number(r.n));
  } catch { /* optional */ }
  return out;
}

function mapRow(row: Record<string, unknown>, participants: number, placeNames: Map<string, string>): EventsV2Event {
  const config = parseConfig(row.config_json);
  const text = (k: string): string | null => (typeof row[k] === "string" && row[k] ? (row[k] as string) : null);
  const num = (k: string): number | null => (typeof row[k] === "number" && Number.isFinite(row[k]) ? (row[k] as number) : null);
  const fieldId = text("field_id");
  return {
    sessionId: String(row.session_id),
    title: text("title") ?? "",
    organizerUserId: text("organizer_user_id") ?? "",
    startedAt: text("started_at") ?? "",
    endedAt: text("ended_at"),
    fieldId,
    lat: num("location_lat"),
    lng: num("location_lng"),
    participants,
    placeName: configText(config, PLACE_KEYS) ?? (fieldId ? placeNames.get(fieldId) ?? null : null),
    meetingPoint: configText(config, MEETING_KEYS),
    organizerLabel: configText(config, ORGANIZER_KEYS),
    summary: configText(config, SUMMARY_KEYS, 600),
    bring: configText(config, BRING_KEYS),
    schedule: parseEventsV2Schedule(config),
    station: configText(config, STATION_KEYS),
    parking: configText(config, PARKING_KEYS),
    caution: configText(config, CAUTION_KEYS, 600),
    rain: configText(config, RAIN_KEYS),
    cost: configText(config, COST_KEYS, 80),
    kind: configText(config, KIND_KEYS, 12),
    capacity: configCapacity(config),
  };
}

const LIST_COLUMNS = `session_id, legacy_event_id, event_code, title, organizer_user_id, corporation_id,
  plan, primary_mode, active_modes_json, location_lat, location_lng, location_radius_m,
  started_at, ended_at, target_species_json, config_json, field_id, template_source_session_id,
  created_at, updated_at`;

export async function loadEventsV2List(
  db: Env["OBS_DB"],
  options: { lat: number | null; lng: number | null; viewerUserId: string | null; lang: Lang; now?: Date }
): Promise<{ upcoming: EventsV2ListItem[]; recent: EventsV2ListItem[]; failed: boolean }> {
  let rows: ObservationEventSessionD1Row[] = [];
  try {
    const res = await db
      .prepare(`SELECT ${LIST_COLUMNS} FROM observation_event_sessions WHERE event_code IS NOT NULL AND trim(event_code) <> '' ORDER BY started_at DESC LIMIT 120`)
      .all<ObservationEventSessionD1Row>();
    rows = res.results ?? [];
  } catch {
    return { upcoming: [], recent: [], failed: true };
  }
  const visible = rows.filter((row) => {
    try {
      const mapped = mapObservationEventSession(row);
      return options.viewerUserId === row.organizer_user_id || !isObservationEventQaFixture(mapped);
    } catch {
      return false;
    }
  });
  const ids = visible.map((r) => r.session_id);
  const [counts, places] = await Promise.all([
    loadParticipantCounts(db, ids),
    loadPlaceNames(db, visible.map((r) => r.field_id ?? "")),
  ]);
  const items: EventsV2ListItem[] = visible.map((row) => {
    const ev = mapRow(row as unknown as Record<string, unknown>, counts.get(row.session_id) ?? 0, places);
    const phase = eventTiming(ev, options.lang, options.now).phase;
    const distanceKm =
      options.lat !== null && options.lng !== null && ev.lat !== null && ev.lng !== null
        ? Math.round(haversineKm(options.lat, options.lng, ev.lat, ev.lng) * 10) / 10
        : null;
    return { ...ev, phase, distanceKm };
  });
  const byStart = (a: EventsV2ListItem, b: EventsV2ListItem) => Date.parse(a.startedAt) - Date.parse(b.startedAt);
  const upcoming = items.filter((i) => i.phase !== "past").sort(byStart);
  const recent = items.filter((i) => i.phase === "past").sort((a, b) => byStart(b, a)).slice(0, 8);
  return { upcoming, recent, failed: false };
}

export async function loadEventsV2Event(db: Env["OBS_DB"], eventId: string): Promise<EventsV2Event | null> {
  const row = await db
    .prepare("SELECT * FROM observation_event_sessions WHERE session_id = ? LIMIT 1")
    .bind(eventId)
    .first<Record<string, unknown>>();
  if (!row) return null;
  const fieldId = typeof row.field_id === "string" ? row.field_id : "";
  const [counts, places] = await Promise.all([loadParticipantCounts(db, [eventId]), loadPlaceNames(db, [fieldId])]);
  return mapRow(row, counts.get(eventId) ?? 0, places);
}

export async function loadEventsV2Records(
  db: Env["OBS_DB"],
  event: Pick<EventsV2Event, "sessionId" | "organizerUserId">,
  viewerUserId: string | null,
  isParticipant: boolean
): Promise<EventsV2Records> {
  const empty: EventsV2Records = { records: [], recordCount: 0, speciesCount: 0, speciesNames: [] };
  let rows: Array<{ actor_user_id: string | null; actor_guest_token: string | null; payload_json: string; created_at: string }> = [];
  try {
    const res = await db
      .prepare(
        `SELECT actor_user_id, actor_guest_token, payload_json, created_at
           FROM observation_event_live_events
          WHERE session_id = ? AND type = 'observation_added'
          ORDER BY created_at DESC LIMIT 300`
      )
      .bind(event.sessionId)
      .all<{ actor_user_id: string | null; actor_guest_token: string | null; payload_json: string; created_at: string }>();
    rows = res.results ?? [];
  } catch {
    return empty;
  }
  const isOrganizer = Boolean(viewerUserId && viewerUserId === event.organizerUserId);
  type Draft = { observationId: string | null; taxon: string; at: string; actor: string | null; visibility: string };
  const drafts: Draft[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const payload = parseConfig(row.payload_json);
    const visibility = resolveEventRecordVisibility(payload);
    const allowed = canViewEventRecord(
      { visibility, actorUserId: row.actor_user_id, actorGuestToken: row.actor_guest_token, isSensitiveOrRare: isSensitiveOrRareEventRecord(payload) },
      { userId: viewerUserId, guestToken: null, isOrganizer, isCheckedInParticipant: isParticipant }
    );
    if (!allowed) continue;
    const obsId = typeof payload.observation_id === "string" && payload.observation_id ? payload.observation_id : typeof payload.visit_id === "string" ? payload.visit_id : null;
    if (obsId) {
      if (seen.has(obsId)) continue;
      seen.add(obsId);
    }
    const taxon = typeof payload.taxon_name === "string" ? payload.taxon_name.trim().slice(0, 80) : "";
    drafts.push({ observationId: obsId, taxon, at: typeof payload.observed_at === "string" && payload.observed_at ? payload.observed_at : row.created_at, actor: row.actor_user_id, visibility });
  }
  if (drafts.length === 0) return empty;

  const media = new Map<string, { vis: string; hidden: number; photo: string | null; owner: string | null }>();
  const obsIds = drafts.map((d) => d.observationId).filter((v): v is string => Boolean(v));
  if (obsIds.length > 0) {
    try {
      const res = await db
        .prepare(
          `SELECT o.observation_id, o.owner_user_id, COALESCE(o.visibility, 'private') AS vis, COALESCE(o.emergency_hidden, 0) AS hidden,
                  (SELECT a.public_derivative_key FROM asset_ledger a WHERE a.observation_id = o.observation_id AND a.processing_state = 'uploaded' AND a.public_derivative_key IS NOT NULL AND (a.mime IS NULL OR a.mime LIKE 'image/%') ORDER BY COALESCE(a.uploaded_at, '') DESC LIMIT 1) AS derivative_key
             FROM observations o WHERE o.observation_id IN (${obsIds.map(() => "?").join(", ")})`
        )
        .bind(...obsIds)
        .all<{ observation_id: string; owner_user_id: string | null; vis: string; hidden: number; derivative_key: string | null }>();
      for (const r of res.results ?? []) {
        media.set(r.observation_id, { vis: r.vis, hidden: Number(r.hidden), owner: r.owner_user_id, photo: r.derivative_key ? `/${String(r.derivative_key).replace(/^\/+/, "")}` : null });
      }
    } catch { /* optional */ }
  }

  const records: EventsV2Record[] = [];
  const usedPhotos = new Set<string>();
  for (const d of drafts) {
    const m = d.observationId ? media.get(d.observationId) : undefined;
    if (m && m.hidden === 1) continue;
    const mine = Boolean(viewerUserId && (d.actor === viewerUserId || m?.owner === viewerUserId));
    let photo: string | null = null;
    if (m?.photo && (m.vis === "public" || mine) && !usedPhotos.has(m.photo)) {
      photo = m.photo;
      usedPhotos.add(m.photo);
    }
    records.push({ observationId: d.observationId, taxon: d.taxon, at: d.at, photoUrl: photo, mine });
  }
  const species = [...new Set(records.map((r) => r.taxon).filter(Boolean))];
  return { records, recordCount: records.length, speciesCount: species.length, speciesNames: species.slice(0, 24) };
}

const V2_CSS = `
.zev{max-width:720px}
.zev h1.zev-title{margin:0;font-size:1.5rem;line-height:1.4}
.zev-sec h2{margin:0 0 8px;font-size:1.125rem}
.zev .ze-btn{white-space:nowrap}
.zev .ze-row-body small{overflow-wrap:anywhere}
.zev-chip{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;background:#e8f0ea;color:#143F2E;font-size:.8125rem;font-weight:700;white-space:nowrap}
.zev-flow{margin:0;padding:0;list-style:none;display:grid}
.zev-flow li{display:grid;grid-template-columns:4.5em minmax(0,1fr);gap:12px;padding:10px 0;border-bottom:1px solid #dde2dc}
.zev-flow time{font-weight:700;color:#143F2E}
.zev-recs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0;padding:0;list-style:none}
a.zev-rec,a.zev-rec:visited{text-decoration:none}
.zev-rec{position:relative;aspect-ratio:1/1;border-radius:14px;overflow:hidden;background:#eef1ed;display:flex;align-items:flex-end}
.zev-rec img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.zev-rec span{position:relative;display:block;width:100%;padding:18px 8px 6px;font-size:.8125rem;font-weight:700;color:#fff;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(8,18,12,.7));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.zev-rec.is-text{background:#e8f0ea}.zev-rec.is-text span{color:#143F2E;background:none;white-space:normal;align-self:center;text-align:center;padding:8px}
.zev-names{margin:0;color:#55615a;line-height:1.8}
.zev-geo{background:none;border:0;padding:0;font:inherit;color:#143F2E;text-decoration:underline;min-height:44px;cursor:pointer}
.zev-search{display:flex;gap:8px;align-items:center}
.zev-search input{flex:1;min-width:0;min-height:44px;padding:8px 14px;border:1.5px solid #dde2dc;border-radius:14px;font:inherit;color:#17211B;background:#fff}
.zev-search button{min-height:44px;padding:8px 16px;border:1.5px solid #143F2E;border-radius:14px;background:#fff;color:#143F2E;font:inherit;font-weight:700;white-space:nowrap;cursor:pointer}
.zev-day{margin:8px 0 0;font-size:.9375rem;font-weight:700;color:#143F2E;padding-bottom:6px;border-bottom:2px solid #143F2E}
.zev-pending{color:#55615a;font-weight:500}
.zev-meet{padding:18px;border-radius:18px;background:#e8f0ea;color:#143F2E}
.zev-meet small{display:block;font-weight:700;font-size:.875rem}
.zev-meet strong{display:block;margin-top:4px;font-size:1.375rem;line-height:1.4;overflow-wrap:anywhere}
.zev-meet p{margin:6px 0 0;color:#17211B;line-height:1.7}
.zev-checkin{padding:16px 18px;border:1px solid #dde2dc;border-radius:18px;background:#fff;display:grid;gap:10px}
.zev-checkin h2{margin:0;font-size:1.0625rem}
.zev-checkin p{margin:0;color:#55615a;line-height:1.7}
.zev-checkin p.ze-status{color:#143F2E}
.zev-msg{color:#b42318;min-height:0}
@media(min-width:960px){.zev-recs{grid-template-columns:repeat(4,minmax(0,1fr))}}
`;

function shell(options: { lang: Lang; title: string; session: SessionLike; bodyHtml: string; pathname: string }): Response {
  const html = renderZukanCommonShell({
    lang: options.lang,
    title: options.title,
    activeNav: "events",
    authenticated: Boolean(options.session && !options.session.banned),
    displayName: options.session?.displayName ?? null,
    bodyHtml: `<style>${ZUKAN_EVENT_CSS}${V2_CSS}</style>${options.bodyHtml}`,
    pathname: options.pathname,
  });
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-ikimon-cloudflare-native": "zukan-events-v2" },
  });
}

const CHEV = '<svg class="ze-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
const PENDING = "まだ決まっていません。決まりしだい、このページで知らせます";
const FOOTNOTE = "行事は、ノコシルで企画されています。主催の人への連絡は、ノコシルからできます。";

function peopleText(ev: Pick<EventsV2Event, "participants" | "capacity">, phase: EventPhase): string {
  if (phase === "past") return ev.participants > 0 ? `${ev.participants}人が参加しました` : "";
  if (ev.participants <= 0) return "参加はまだいません。最初の一人として参加できます";
  return `${ev.participants}人が参加します${ev.capacity ? `（定員${ev.capacity}人）` : ""}`;
}

function jstYear(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric" }).format(d);
}

function listRow(prefix: string, ev: EventsV2ListItem, lang: Lang): string {
  const timing = eventTiming(ev, lang);
  const line1 = [ev.kind ?? "", timing.timeLabel].filter(Boolean).join(" ");
  const lines = [ev.placeName ?? "", ev.distanceKm !== null ? (ev.distanceKm < 1 ? "ここから1km未満" : `ここから約${ev.distanceKm}km`) : "", peopleText(ev, ev.phase)].filter(Boolean);
  return `<li><a class="ze-row" data-event-row="${escapeHtml(ev.sessionId)}" href="${escapeHtml(`${prefix}/events/${encodeURIComponent(ev.sessionId)}/preview`)}">
    <span class="ze-date" aria-hidden="true"><small>${escapeHtml(timing.shortMonth)}</small><b>${escapeHtml(timing.shortDay)}</b></span>
    <span class="ze-row-body"><strong>${escapeHtml(ev.title)}${ev.phase === "today" ? '<span class="zev-chip">本日開催</span>' : ""}</strong>${line1 ? `<small>${escapeHtml(line1)}</small>` : ""}${lines.map((l) => `<small>${escapeHtml(l)}</small>`).join("")}</span>${CHEV}
  </a></li>`;
}

function groupedRows(prefix: string, items: EventsV2ListItem[], lang: Lang): string {
  const thisYear = jstYear(new Date().toISOString());
  const groups: Array<{ label: string; items: EventsV2ListItem[] }> = [];
  for (const ev of items) {
    const y = jstYear(ev.startedAt);
    const label = `${y && y !== thisYear ? `${y}年` : ""}${eventTiming(ev, lang).dateLabel}`;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(ev);
    else groups.push({ label, items: [ev] });
  }
  return groups.map((g) => `<h3 class="zev-day">${escapeHtml(g.label)}</h3><ul class="ze-list">${g.items.map((e) => listRow(prefix, e, lang)).join("")}</ul>`).join("");
}

function matchesQuery(ev: EventsV2ListItem, q: string): boolean {
  const hay = [ev.title, ev.placeName ?? "", ev.kind ?? ""].join(" ").toLowerCase();
  return q.toLowerCase().split(/\s+/u).filter(Boolean).every((w) => hay.includes(w));
}

export async function handleEventsV2List(url: URL, lang: Lang, session: SessionLike, db: Env["OBS_DB"]): Promise<Response> {
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const latRaw = url.searchParams.get("lat");
  const lngRaw = url.searchParams.get("lng");
  const lat = latRaw !== null && latRaw !== "" && Number.isFinite(Number(latRaw)) && Math.abs(Number(latRaw)) <= 90 ? Number(latRaw) : null;
  const lng = lngRaw !== null && lngRaw !== "" && Number.isFinite(Number(lngRaw)) && Math.abs(Number(lngRaw)) <= 180 ? Number(lngRaw) : null;
  const known = lat !== null && lng !== null;
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
  const data = await loadEventsV2List(db, { lat: known ? lat : null, lng: known ? lng : null, viewerUserId: session && !session.banned ? session.userId : null, lang });
  const upcoming = q ? data.upcoming.filter((e) => matchesQuery(e, q)) : data.upcoming;
  const recent = q ? data.recent.filter((e) => matchesQuery(e, q)) : data.recent;

  const upcomingHtml = data.failed
    ? `<p class="ze-empty">イベントを読み込めませんでした。少し待ってからもう一度開いてください。</p>`
    : upcoming.length > 0
      ? `<div data-events-upcoming="1">${groupedRows(prefix, upcoming, lang)}</div>`
      : q
        ? `<p class="ze-empty" data-events-empty="1">「${escapeHtml(q)}」に合う行事は見つかりませんでした。ことばを変えて探してみてください。</p>`
        : `<p class="ze-empty" data-events-empty="1">近くでは、まだ行事が開かれていません。行事が開かれたら、ここに出ます。それまで、みんなの記録を見てみましょう。</p>
         <a class="ze-btn is-outline" href="${escapeHtml(`${prefix}/library`)}">みんなの記録を見る</a>`;
  const recentHtml = recent.length > 0
    ? `<section class="zev-sec"><h2>最近の観察会</h2><ul class="ze-list" data-events-recent="1">${recent.map((e) => listRow(prefix, e, lang)).join("")}</ul></section>`
    : "";
  const geo = known
    ? `<p class="ze-note">距離は、いまいる場所からの目安です。</p>`
    : `<button type="button" class="zev-geo" id="zev-geo">現在地からの距離を表示する</button>
       <script>(()=>{const b=document.getElementById("zev-geo");if(!b||!navigator.geolocation)return;b.addEventListener("click",()=>{navigator.geolocation.getCurrentPosition(p=>{const u=new URL(location.href);u.searchParams.set("lat",p.coords.latitude.toFixed(3));u.searchParams.set("lng",p.coords.longitude.toFixed(3));location.href=u.toString();},()=>{b.textContent="現在地を取得できませんでした";});});})();</script>`;
  const search = `<form class="zev-search" role="search" method="get" action="${escapeHtml(`${prefix}/community/events`)}" data-events-search="1">
      ${known ? `<input type="hidden" name="lat" value="${lat}"><input type="hidden" name="lng" value="${lng}">` : ""}
      <input type="search" name="q" value="${escapeHtml(q)}" placeholder="行事の名前・場所で探す" aria-label="行事を探す" maxlength="60">
      <button type="submit">探す</button>
    </form>`;
  const bodyHtml = `<div class="ze zev" data-event-view="v2-list">
    <h1 class="zev-title">近くのイベント</h1>
    <p class="ze-note">日付の近い順に並んでいます。</p>
    ${search}
    ${geo}
    <section class="zev-sec">${upcomingHtml}</section>
    ${recentHtml}
    <p class="ze-note">${FOOTNOTE}</p>
  </div>`;
  return shell({ lang, title: "近くのイベント", session, bodyHtml, pathname: `${prefix}/community/events` });
}

function recordsGrid(records: EventsV2Record[], prefix: string): string {
  if (records.length === 0) return "";
  const items = records.slice(0, 24).map((r) => {
    const label = r.taxon || "名前はこれから";
    const inner = r.photoUrl
      ? `<img src="${escapeHtml(r.photoUrl)}" alt="${escapeHtml(label)}" loading="lazy"><span>${escapeHtml(label)}</span>`
      : `<span>${escapeHtml(label)}</span>`;
    const cls = r.photoUrl ? "zev-rec" : "zev-rec is-text";
    return r.mine && r.observationId
      ? `<li><a class="${cls}" href="${escapeHtml(`${prefix}/observations/${encodeURIComponent(r.observationId)}`)}">${inner}</a></li>`
      : `<li><div class="${cls}">${inner}</div></li>`;
  });
  return `<ul class="zev-recs" data-event-records="1">${items.join("")}</ul>`;
}

function guideHtml(ev: EventsV2Event): string {
  const rows: Array<[string, string | null]> = [
    ["集合場所", ev.meetingPoint],
    ["最寄り駅", ev.station],
    ["駐車場", ev.parking],
    ["持ち物", ev.bring],
    ["注意事項", ev.caution],
  ];
  if (ev.rain) rows.push(["雨のとき", ev.rain]);
  return `<section class="zev-sec" data-event-guide="1"><h2>当日の案内</h2><dl class="ze-facts">${rows
    .map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${v ? escapeHtml(v) : `<span class="zev-pending">${PENDING}</span>`}</dd></div>`)
    .join("")}</dl></section>`;
}

async function loadNextEvent(db: Env["OBS_DB"], ev: EventsV2Event): Promise<{ sessionId: string; title: string; startedAt: string; endedAt: string | null } | null> {
  if (!ev.fieldId) return null;
  try {
    return await db
      .prepare(
        `SELECT session_id AS sessionId, title, started_at AS startedAt, ended_at AS endedAt FROM observation_event_sessions
          WHERE field_id = ? AND session_id <> ? AND started_at > ? AND event_code IS NOT NULL AND trim(event_code) <> ''
          ORDER BY started_at ASC LIMIT 1`
      )
      .bind(ev.fieldId, ev.sessionId, new Date().toISOString())
      .first<{ sessionId: string; title: string; startedAt: string; endedAt: string | null }>();
  } catch {
    return null;
  }
}

export async function handleEventsV2Detail(eventId: string, lang: Lang, session: SessionLike, db: Env["OBS_DB"]): Promise<Response> {
  const ev = await loadEventsV2Event(db, eventId);
  if (!ev) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const enc = encodeURIComponent(eventId);
  const authed = Boolean(session && !session.banned);
  const userId = authed ? session!.userId : null;
  const timing = eventTiming(ev, lang);
  const phase = timing.phase;
  let joined = false;
  let checkedIn = false;
  let myName = "";
  if (userId) {
    try {
      const p = await db
        .prepare("SELECT status, checked_in_at, display_name FROM observation_event_participants WHERE session_id = ? AND user_id = ? LIMIT 1")
        .bind(eventId, userId)
        .first<{ status: string | null; checked_in_at: string | null; display_name: string | null }>();
      joined = Boolean(p);
      checkedIn = Boolean(p && (p.checked_in_at || p.status === "checked_in"));
      myName = p?.display_name ?? "";
    } catch { /* optional */ }
  }
  const isOrganizer = Boolean(userId && userId === ev.organizerUserId);
  const member = joined || isOrganizer;
  const recs = phase === "upcoming" ? null : await loadEventsV2Records(db, ev, userId, member);
  const placeHref = ev.fieldId ? `${prefix}/places/${encodeURIComponent(ev.fieldId)}` : null;

  const facts: Array<[string, string]> = [["日時", timing.whenLabel]];
  if (ev.placeName) facts.push(["場所", ev.placeName]);
  if (ev.cost) facts.push(["費用", ev.cost]);
  const ppl = peopleText(ev, phase);
  if (ppl && ev.participants > 0) facts.push(["参加", ppl]);
  if (ev.organizerLabel) facts.push(["主催", ev.organizerLabel]);
  const factsHtml = `<dl class="ze-facts" data-event-facts="1">${facts.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("")}</dl>`;
  const flowHtml = ev.schedule.length > 0
    ? `<section class="zev-sec" data-event-flow="1"><h2>当日の流れ</h2><ol class="zev-flow">${ev.schedule.map((s) => `<li>${s.time ? `<time>${escapeHtml(s.time)}</time>` : "<span></span>"}<span>${escapeHtml(s.title)}</span></li>`).join("")}</ol></section>`
    : "";
  const summaryHtml = ev.summary ? `<section class="zev-sec"><h2>内容</h2><p class="ze-text">${escapeHtml(ev.summary)}</p></section>` : "";

  let primary = "";
  let secondaryExtra = "";
  const loginHref = `${prefix}/login?redirect=${encodeURIComponent(`${prefix}/events/${eventId}/confirm`)}`;
  const joinBtn = `<a class="ze-btn" data-event-cta="join" href="${escapeHtml(authed ? `${prefix}/events/${enc}/confirm` : loginHref)}">参加する</a>`;
  const recordHref = `${prefix}/record?eventSessionId=${enc}`;
  const statusHtml = joined && phase !== "today" ? `<p class="ze-status" data-event-joined="1"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>参加予定です</p>` : "";
  let sectionsHtml = "";
  let footNote = joined || phase === "past" ? "" : "主催者に伝わるのはフィールドネームまでです。";

  if (phase === "upcoming") {
    primary = member ? "" : joinBtn;
    sectionsHtml = `<section class="zev-sec">${factsHtml}</section>${guideHtml(ev)}${flowHtml}${summaryHtml}`;
  } else if (phase === "today") {
    const startMs = Date.parse(ev.startedAt);
    const endMs = ev.endedAt ? Date.parse(ev.endedAt) : NaN;
    const now = Date.now();
    const opensAt = Number.isFinite(startMs) ? startMs - 3600000 : now;
    const windowOpen = now >= opensAt && (!Number.isFinite(endMs) || now <= endMs);
    const fmt = (ms: number) => new Intl.DateTimeFormat("ja", { timeZone: "Asia/Tokyo", hour: "numeric", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms));
    const r = recs!;
    const meetNotes = [`${timing.timeLabel}に歩きます`, ev.station ? `最寄り駅は${ev.station}` : "", ev.parking ? `駐車場：${ev.parking}` : ""].filter(Boolean).join(" ／ ");
    const meetHtml = `<section class="zev-meet" data-event-meet="1"><small>集合場所</small><strong>${ev.meetingPoint ? escapeHtml(ev.meetingPoint) : `<span class="zev-pending">${PENDING}</span>`}</strong><p>${escapeHtml(meetNotes)}</p></section>`;
    let checkHtml = "";
    if (member && checkedIn) {
      checkHtml = `<section class="zev-checkin" data-event-checkin="done"><p class="ze-status"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>チェックインしました</p><p>来たことが記録されています。見つけた生きものは、この企画の記録に残せます。</p></section>`;
      primary = `<a class="ze-btn" data-event-cta="capture" href="${escapeHtml(recordHref)}">${EVENT_ICON_CAMERA}この企画の記録を残す</a>`;
    } else if (member) {
      if (windowOpen) {
        checkHtml = `<section class="zev-checkin" data-event-checkin="open"><h2>チェックイン</h2><p>集合場所についたら、チェックインしてください。来たことが記録されて、あなたの「訪問」が始まります。今日の${escapeHtml(fmt(opensAt))}〜${Number.isFinite(endMs) ? escapeHtml(fmt(endMs)) : "終わり"}にできます。</p><p class="zev-msg" id="zev-checkin-msg" role="status"></p><p>チェックインしなくても、後からこの日の記録を足せます。</p></section>
          <script>(()=>{const b=document.getElementById("zev-checkin-btn");const m=document.getElementById("zev-checkin-msg");if(!b)return;b.addEventListener("click",async()=>{b.disabled=true;try{const r=await fetch(${JSON.stringify(`/api/v1/observation-events/${eventId}/checkin`)},{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({display_name:b.dataset.name||""})});if(r.ok){location.reload();return;}m.textContent="チェックインできませんでした。もう一度お試しください。";}catch(e){m.textContent="通信できませんでした。電波のよいところでもう一度お試しください。";}b.disabled=false;});})();</script>`;
        primary = `<button type="button" class="ze-btn" id="zev-checkin-btn" data-event-cta="checkin" data-name="${escapeHtml(myName)}">チェックインする</button>`;
        secondaryExtra = `<a class="ze-btn is-outline" data-event-cta="capture" href="${escapeHtml(recordHref)}">${EVENT_ICON_CAMERA}この企画の記録を残す</a>`;
      } else {
        checkHtml = `<section class="zev-checkin" data-event-checkin="later"><h2>チェックイン</h2><p>今日の${escapeHtml(fmt(opensAt))}からチェックインできます。チェックインしなくても、後からこの日の記録を足せます。</p></section>`;
        primary = `<a class="ze-btn" data-event-cta="capture" href="${escapeHtml(recordHref)}">${EVENT_ICON_CAMERA}この企画の記録を残す</a>`;
      }
    } else {
      primary = joinBtn;
    }
    sectionsHtml = `${meetHtml}${checkHtml}${guideHtml(ev)}
      <section class="zev-sec" data-event-day="1"><h2>みんなの記録</h2>${r.recordCount > 0 ? `<p class="ze-note">記録 ${r.recordCount}件・${r.speciesCount}種</p>${recordsGrid(r.records, prefix)}` : `<p class="ze-empty">まだ記録はありません。最初の1枚を加えてみましょう。</p>`}</section>
      <section class="zev-sec">${factsHtml}</section>${flowHtml}${summaryHtml}`;
    footNote = "";
  } else {
    const r = recs!;
    const mine = r.records.filter((x) => x.mine);
    primary = placeHref ? `<a class="ze-btn" data-event-cta="place" href="${escapeHtml(placeHref)}">${escapeHtml(ev.placeName ?? "この場所")}の記録を見る</a>` : "";
    const next = await loadNextEvent(db, ev);
    const nextTiming = next ? eventTiming(next, lang) : null;
    sectionsHtml = `<section class="zev-sec" data-event-after="1"><h2>この日に集まった記録</h2>
        ${r.recordCount > 0 ? `${recordsGrid(r.records, prefix)}<p class="ze-note" style="margin-top:10px">公開された記録 ${r.recordCount}件 ・ 見つかった生きもの ${r.speciesCount}種が、この日の記録として残っています。</p>${r.speciesNames.length > 0 ? `<p class="zev-names">${r.speciesNames.map(escapeHtml).join("・")}</p>` : ""}` : `<p class="ze-empty">この日の公開された記録は、まだありません。</p>`}
      </section>
      ${member && mine.length > 0 ? `<section class="zev-sec" data-event-mine="1"><h2>あなたの記録</h2><a class="ze-row" href="${escapeHtml(`${prefix}/library`)}"><span class="ze-row-body"><strong>${escapeHtml(timing.dateLabel)}の記録 ${mine.length}件</strong><small>参加の記録と、あなたが残した記録は、ライブラリに入っています</small></span>${CHEV}</a></section>` : ""}
      <section class="zev-sec">${factsHtml}</section>${summaryHtml}
      ${next && nextTiming ? `<section class="zev-sec" data-event-next="1"><h2>次の行事</h2><a class="ze-row" href="${escapeHtml(`${prefix}/events/${encodeURIComponent(next.sessionId)}/preview`)}"><span class="ze-row-body"><strong>${escapeHtml(next.title)}</strong><small>${escapeHtml(nextTiming.whenLabel)}</small></span>${CHEV}</a></section>` : ""}`;
  }

  const secondary = [
    secondaryExtra,
    phase === "past" && member ? `<a class="ze-btn is-outline" href="${escapeHtml(`${prefix}/events/${enc}/take`)}">図鑑に載せる</a>` : "",
    `<a class="ze-btn is-outline" href="${escapeHtml(`${prefix}/events/${enc}/share`)}">${EVENT_ICON_SHARE}共有する</a>`,
  ].join("");
  const heroChip = phase === "today" ? "今日です" : phase === "past" ? `終わりました ${timing.dateLabel}` : "参加を受け付けています";
  const heroSub = phase === "upcoming" ? [timing.whenLabel, ev.placeName ?? ""].filter(Boolean).join(" ・ ") : ev.placeName ?? "";
  const bodyHtml = `<div class="ze zev" data-event-view="v2-detail" data-event-phase="${phase}">
    <div class="ze-main">
      ${renderEventHero({ title: ev.title, chip: heroChip, sub: heroSub, backHref: `${prefix}/community/events`, backLabel: "イベント一覧へ", shareHref: `${prefix}/events/${enc}/share`, shareLabel: "共有する" })}
      ${sectionsHtml}
      <aside class="ze-cta">${statusHtml}${primary}${secondary}<p class="ze-note">${footNote}</p></aside>
      <p class="ze-note">${FOOTNOTE}</p>
    </div>
  </div>`;
  return shell({ lang, title: ev.title, session, bodyHtml, pathname: `${prefix}/events/${enc}/preview` });
}
