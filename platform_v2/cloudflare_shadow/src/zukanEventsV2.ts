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
.zev-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0}
.zev-stats div{padding:14px 8px;border-radius:16px;background:#f7f7f3;text-align:center}
.zev-stats dt{font-size:.8125rem;color:#55615a}
.zev-stats dd{margin:2px 0 0;font-size:1.375rem;font-weight:700;color:#143F2E}
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

function listRow(prefix: string, ev: EventsV2ListItem, lang: Lang): string {
  const timing = eventTiming(ev, lang);
  const line1 = [ev.phase === "today" ? "本日" : "", timing.timeLabel, ev.placeName ?? ""].filter(Boolean).join(" ・ ");
  const line2 = [ev.participants > 0 ? `${ev.phase === "past" ? "参加" : "参加予定"} ${ev.participants}人` : "", ev.distanceKm !== null ? (ev.distanceKm < 1 ? "1km未満" : `約${ev.distanceKm}km`) : ""].filter(Boolean).join(" ・ ");
  return `<li><a class="ze-row" data-event-row="${escapeHtml(ev.sessionId)}" href="${escapeHtml(`${prefix}/events/${encodeURIComponent(ev.sessionId)}/preview`)}">
    <span class="ze-date" aria-hidden="true"><small>${escapeHtml(timing.shortMonth)}</small><b>${escapeHtml(timing.shortDay)}</b></span>
    <span class="ze-row-body"><strong>${escapeHtml(ev.title)}${ev.phase === "today" ? '<span class="zev-chip">本日開催</span>' : ""}</strong>${line1 ? `<small>${escapeHtml(line1)}</small>` : ""}${line2 ? `<small>${escapeHtml(line2)}</small>` : ""}</span>${CHEV}
  </a></li>`;
}

export async function handleEventsV2List(url: URL, lang: Lang, session: SessionLike, db: Env["OBS_DB"]): Promise<Response> {
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const latRaw = url.searchParams.get("lat");
  const lngRaw = url.searchParams.get("lng");
  const lat = latRaw !== null && latRaw !== "" && Number.isFinite(Number(latRaw)) && Math.abs(Number(latRaw)) <= 90 ? Number(latRaw) : null;
  const lng = lngRaw !== null && lngRaw !== "" && Number.isFinite(Number(lngRaw)) && Math.abs(Number(lngRaw)) <= 180 ? Number(lngRaw) : null;
  const known = lat !== null && lng !== null;
  const data = await loadEventsV2List(db, { lat: known ? lat : null, lng: known ? lng : null, viewerUserId: session && !session.banned ? session.userId : null, lang });

  const upcomingHtml = data.failed
    ? `<p class="ze-empty">イベントを読み込めませんでした。少し待ってからもう一度開いてください。</p>`
    : data.upcoming.length > 0
      ? `<ul class="ze-list" data-events-upcoming="1">${data.upcoming.map((e) => listRow(prefix, e, lang)).join("")}</ul>`
      : `<p class="ze-empty" data-events-empty="1">いま参加できる観察会はまだありません。それまで、みんなの記録を見てみましょう。</p>
         <a class="ze-btn is-outline" href="${escapeHtml(`${prefix}/library`)}">みんなの記録を見る</a>`;
  const recentHtml = data.recent.length > 0
    ? `<section class="zev-sec"><h2>最近の観察会</h2><ul class="ze-list" data-events-recent="1">${data.recent.map((e) => listRow(prefix, e, lang)).join("")}</ul></section>`
    : "";
  const geo = known
    ? `<p class="ze-note">現在地から近い順の距離を表示しています。</p>`
    : `<button type="button" class="zev-geo" id="zev-geo">現在地からの距離を表示する</button>
       <script>(()=>{const b=document.getElementById("zev-geo");if(!b||!navigator.geolocation)return;b.addEventListener("click",()=>{navigator.geolocation.getCurrentPosition(p=>{const u=new URL(location.href);u.searchParams.set("lat",p.coords.latitude.toFixed(3));u.searchParams.set("lng",p.coords.longitude.toFixed(3));location.href=u.toString();},()=>{b.textContent="現在地を取得できませんでした";});});})();</script>`;
  const bodyHtml = `<div class="ze zev" data-event-view="v2-list">
    <h1 class="zev-title">近くのイベント</h1>
    ${geo}
    <section class="zev-sec">${data.upcoming.length > 0 ? "<h2>これからの観察会</h2>" : ""}${upcomingHtml}</section>
    ${recentHtml}
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
  if (userId) {
    try {
      const p = await db.prepare("SELECT 1 AS ok FROM observation_event_participants WHERE session_id = ? AND user_id = ? LIMIT 1").bind(eventId, userId).first();
      joined = Boolean(p);
    } catch { /* optional */ }
  }
  const isOrganizer = Boolean(userId && userId === ev.organizerUserId);
  const member = joined || isOrganizer;
  const recs = phase === "upcoming" ? null : await loadEventsV2Records(db, ev, userId, member);
  const placeHref = ev.fieldId ? `${prefix}/places/${encodeURIComponent(ev.fieldId)}` : null;

  const facts: Array<[string, string]> = [["日時", timing.whenLabel]];
  if (ev.meetingPoint) facts.push(["集合場所", ev.meetingPoint]);
  if (ev.placeName && ev.placeName !== ev.meetingPoint) facts.push(["場所", ev.placeName]);
  if (ev.organizerLabel) facts.push(["主催", ev.organizerLabel]);
  facts.push(["持ち物", ev.bring ?? "動きやすい靴・飲み物・充電したスマートフォン"]);
  const factsHtml = `<dl class="ze-facts" data-event-facts="1">${facts.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("")}</dl>`;
  const flowHtml = ev.schedule.length > 0
    ? `<section class="zev-sec" data-event-flow="1"><h2>当日の流れ</h2><ol class="zev-flow">${ev.schedule.map((s) => `<li>${s.time ? `<time>${escapeHtml(s.time)}</time>` : "<span></span>"}<span>${escapeHtml(s.title)}</span></li>`).join("")}</ol></section>`
    : "";
  const summaryHtml = ev.summary ? `<p class="ze-text">${escapeHtml(ev.summary)}</p>` : "";

  let primary = "";
  const loginHref = `${prefix}/login?redirect=${encodeURIComponent(`${prefix}/events/${eventId}/confirm`)}`;
  const joinBtn = `<a class="ze-btn" data-event-cta="join" href="${escapeHtml(authed ? `${prefix}/events/${enc}/confirm` : loginHref)}">参加する</a>`;
  const statusHtml = joined ? `<p class="ze-status" data-event-joined="1"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>参加予定です</p>` : "";
  let sectionsHtml = "";

  if (phase === "upcoming") {
    primary = member ? "" : joinBtn;
    sectionsHtml = `<section class="zev-sec">${factsHtml}</section>${flowHtml}${summaryHtml}`;
  } else if (phase === "today") {
    primary = member ? `<a class="ze-btn" data-event-cta="capture" href="${escapeHtml(`${prefix}/record?eventSessionId=${enc}`)}">${EVENT_ICON_CAMERA}写真を加える</a>` : joinBtn;
    const r = recs!;
    sectionsHtml = `<section class="zev-sec" data-event-day="1"><h2>今日の記録</h2>${r.recordCount > 0 ? `<p class="ze-note">記録 ${r.recordCount}件・${r.speciesCount}種</p>${recordsGrid(r.records, prefix)}` : `<p class="ze-empty">まだ記録はありません。最初の1枚を加えてみましょう。</p>`}</section>
      <section class="zev-sec">${factsHtml}</section>${flowHtml}${summaryHtml}`;
  } else {
    const r = recs!;
    primary = placeHref ? `<a class="ze-btn" data-event-cta="place" href="${escapeHtml(placeHref)}">この場所の記録を見る</a>` : "";
    sectionsHtml = `<section class="zev-sec" data-event-after="1"><h2>観察会のまとめ</h2>
        <dl class="zev-stats"><div><dt>見つけた種</dt><dd>${r.speciesCount}</dd></div><div><dt>記録</dt><dd>${r.recordCount}</dd></div><div><dt>参加</dt><dd>${ev.participants}</dd></div></dl>
        ${r.speciesNames.length > 0 ? `<p class="zev-names" style="margin-top:12px">${r.speciesNames.map(escapeHtml).join("・")}</p>` : ""}
      </section>
      ${r.recordCount > 0 ? `<section class="zev-sec"><h2>この日の記録</h2>${recordsGrid(r.records, prefix)}</section>` : ""}
      <section class="zev-sec">${factsHtml}</section>${summaryHtml}`;
  }

  const secondary = [
    phase === "past" && member ? `<a class="ze-btn is-outline" href="${escapeHtml(`${prefix}/events/${enc}/take`)}">図鑑に載せる</a>` : "",
    `<a class="ze-btn is-outline" href="${escapeHtml(`${prefix}/events/${enc}/share`)}">${EVENT_ICON_SHARE}共有する</a>`,
  ].join("");
  const people = ev.participants > 0 ? `${phase === "past" ? "参加" : "参加予定"} ${ev.participants}人` : "";
  const bodyHtml = `<div class="ze zev" data-event-view="v2-detail" data-event-phase="${phase}">
    <div class="ze-main">
      ${renderEventHero({ title: ev.title, chip: phaseChip(phase, timing.dateLabel, false), sub: people, backHref: `${prefix}/community/events`, backLabel: "イベント一覧へ", shareHref: `${prefix}/events/${enc}/share`, shareLabel: "共有する" })}
      ${sectionsHtml}
      <aside class="ze-cta">${statusHtml}${primary}${secondary}<p class="ze-note">${joined || phase === "past" ? "" : "主催者に伝わるのはフィールドネームまでです。"}</p></aside>
    </div>
  </div>`;
  return shell({ lang, title: ev.title, session, bodyHtml, pathname: `${prefix}/events/${enc}/preview` });
}
