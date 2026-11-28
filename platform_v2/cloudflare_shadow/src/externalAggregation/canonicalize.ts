import { PUBLIC_AREA_LABEL_SENSITIVE_PATTERN } from "../publicAreaLabel";
import { loadAdminIndexForBbox } from "./adminLookup";
import { dedupeKey } from "./dedupe";
import type { ExtDb, ExtractedFact } from "./types";
import { sha256Hex } from "./util";
import { normalizeName, resolveVenue } from "./venueResolve";

export const HIDDEN_VENUE_NAME = "非公開の会場";

interface RecordRow {
  record_id: string;
  source_id: string;
  raw_json: string;
  gone_at: string | null;
  name: string;
  operator: string | null;
}

const OFFICIAL_PATTERN = /市|県|財団|科学館|動物園|美術館|図書館|博物館|公社|ビューロー|協会|役所/;

function orgType(name: string): string {
  if (/株式会社|有限会社|合同会社|（株）/.test(name.normalize("NFKC").replace(/\(株\)/g, "株式会社"))) return "company";
  if (/市役所|県庁|町役場|村役場|市$|県$|区役所|教育委員会/.test(name)) return "government";
  if (/図書館|美術館|科学館|動物園|博物館|公民館|センター/.test(name)) return "facility";
  if (/NPO|法人|協会|財団|組合/.test(name)) return "nonprofit";
  return "unknown";
}

function endMs(raw: string): number {
  const t = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59+09:00` : raw;
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? Infinity : ms;
}

const PENDING_SQL = `SELECT r.record_id,r.source_id,r.raw_json,r.gone_at,s.name,s.operator FROM ext_source_records r
  JOIN ext_sources s ON s.source_id=r.source_id
  WHERE r.kind='event' AND (
    NOT EXISTS (SELECT 1 FROM ext_item_sources i WHERE i.item_kind='event' AND i.record_id=r.record_id)
    OR (r.gone_at IS NOT NULL AND EXISTS (
      SELECT 1 FROM ext_item_sources i JOIN ext_events e ON e.event_id=i.item_id
      WHERE i.item_kind='event' AND i.record_id=r.record_id AND e.status!='hidden'
        AND NOT EXISTS (SELECT 1 FROM ext_item_sources i2 JOIN ext_source_records r2 ON r2.record_id=i2.record_id
          WHERE i2.item_kind='event' AND i2.item_id=i.item_id AND r2.gone_at IS NULL)))
    OR (r.gone_at IS NULL AND EXISTS (
      SELECT 1 FROM ext_item_sources i JOIN ext_events e ON e.event_id=i.item_id
      WHERE i.item_kind='event' AND i.record_id=r.record_id AND e.status='hidden'))
  ) ORDER BY r.record_id LIMIT ?`;

export async function runCanonicalize(db: ExtDb, nowMs: number, limit = 200): Promise<{ records: number; events: number }> {
  const nowIso = new Date(nowMs).toISOString();
  const pending = (await db.prepare(PENDING_SQL).bind(limit).all<RecordRow>()).results;
  const parsed: { row: RecordRow; fact: ExtractedFact }[] = [];
  for (const row of pending) {
    try { parsed.push({ row, fact: JSON.parse(row.raw_json) as ExtractedFact }); } catch { /* skip */ }
  }
  const coords = parsed.filter(p => typeof p.fact.lat === "number" && typeof p.fact.lng === "number");
  const index = coords.length
    ? await loadAdminIndexForBbox(db, [
      Math.min(...coords.map(p => p.fact.lng!)), Math.min(...coords.map(p => p.fact.lat!)),
      Math.max(...coords.map(p => p.fact.lng!)), Math.max(...coords.map(p => p.fact.lat!)),
    ])
    : null;

  const touched = new Set<string>();
  for (const { row, fact } of parsed) {
    const eventId = `xe_${(await dedupeKey(fact)).slice(0, 32)}`;
    const prior = (await db.prepare("SELECT item_id FROM ext_item_sources WHERE item_kind='event' AND record_id=?").bind(row.record_id).all<{ item_id: string }>()).results;
    for (const p of prior) {
      if (p.item_id === eventId) continue;
      await db.prepare("DELETE FROM ext_item_sources WHERE item_kind='event' AND item_id=? AND record_id=?").bind(p.item_id, row.record_id).run();
      touched.add(p.item_id);
    }
    const role = OFFICIAL_PATTERN.test(`${row.operator ?? ""}${row.name}`) ? "official" : "listing";
    await db.prepare("INSERT INTO ext_item_sources (item_kind,item_id,record_id,role) VALUES ('event',?,?,?) ON CONFLICT(item_kind,item_id,record_id) DO UPDATE SET role=excluded.role")
      .bind(eventId, row.record_id, role).run();
    touched.add(eventId);
  }

  let events = 0;
  for (const eventId of touched) {
    const linked = (await db.prepare(
      `SELECT r.record_id,r.source_id,r.raw_json,r.gone_at FROM ext_item_sources i JOIN ext_source_records r ON r.record_id=i.record_id
       WHERE i.item_kind='event' AND i.item_id=? ORDER BY (r.gone_at IS NOT NULL), r.record_id`,
    ).bind(eventId).all<{ record_id: string; source_id: string; raw_json: string; gone_at: string | null }>()).results;
    if (!linked.length) {
      await db.prepare("DELETE FROM ext_events WHERE event_id=?").bind(eventId).run();
      continue;
    }
    const rep = linked[0]!;
    let fact: ExtractedFact;
    try { fact = JSON.parse(rep.raw_json) as ExtractedFact; } catch { continue; }
    const allGone = linked.every(l => l.gone_at !== null);

    const venue = await resolveVenue(db, fact, index);
    let placeId: string | null = null;
    const venueName = fact.venue_name ? fact.venue_name.normalize("NFKC").trim() : "";
    if (venueName) {
      const hidden = PUBLIC_AREA_LABEL_SENSITIVE_PATTERN.test(venueName);
      const name = hidden ? HIDDEN_VENUE_NAME : venueName;
      const lat = hidden ? null : fact.lat;
      const lng = hidden ? null : fact.lng;
      placeId = `xp_${(await sha256Hex([name, lat ?? "", lng ?? "", venue.admin_unit_id ?? "", venue.city_unit_id ?? "", venue.zukan_place_id ?? ""].join("|"))).slice(0, 32)}`;
      await db.prepare("INSERT OR IGNORE INTO ext_places (place_id,zukan_place_id,name,lat,lng,admin_unit_id,city_unit_id,created_at) VALUES (?,?,?,?,?,?,?,?)")
        .bind(placeId, venue.zukan_place_id, name, lat, lng, venue.admin_unit_id, venue.city_unit_id, nowIso).run();
    }

    let orgId: string | null = null;
    const orgName = fact.organizer_name ? fact.organizer_name.normalize("NFKC").replace(/\s+/g, " ").trim() : "";
    if (orgName) {
      const norm = normalizeName(orgName);
      orgId = `xo_${(await sha256Hex(`${rep.source_id}|${norm}`)).slice(0, 32)}`;
      await db.prepare("INSERT OR IGNORE INTO ext_orgs (org_id,org_type,display_name,identity_level,created_at,updated_at) VALUES (?,?,?,'unresolved',?,?)")
        .bind(orgId, orgType(orgName), orgName, nowIso, nowIso).run();
      await db.prepare("INSERT OR IGNORE INTO ext_org_keys (org_id,key_type,key_value,source_record_id) VALUES (?,'name_locality',?,?)")
        .bind(orgId, `${norm}|${venue.city_unit_id ?? ""}`, rep.record_id).run();
    }

    const status = allGone ? "hidden" : endMs(fact.ends_at ?? fact.starts_at) < nowMs ? "expired" : "active";
    await db.prepare(
      `INSERT INTO ext_events (event_id,org_id,place_id,title,category,starts_at,ends_at,all_day,status,city_unit_id,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(event_id) DO UPDATE SET org_id=excluded.org_id,place_id=excluded.place_id,title=excluded.title,category=excluded.category,starts_at=excluded.starts_at,
         ends_at=excluded.ends_at,all_day=excluded.all_day,status=excluded.status,city_unit_id=excluded.city_unit_id,updated_at=excluded.updated_at`,
    ).bind(eventId, orgId, placeId, fact.title, fact.category ?? null, fact.starts_at, fact.ends_at, fact.all_day ? 1 : 0, status, venue.city_unit_id, nowIso).run();
    events++;
  }

  const active = (await db.prepare("SELECT event_id,starts_at,ends_at FROM ext_events WHERE status='active' LIMIT 1000").all<{ event_id: string; starts_at: string; ends_at: string | null }>()).results;
  for (const e of active) {
    if (endMs(e.ends_at ?? e.starts_at) < nowMs) {
      await db.prepare("UPDATE ext_events SET status='expired',updated_at=? WHERE event_id=? AND status='active'").bind(nowIso, e.event_id).run();
    }
  }
  return { records: parsed.length, events };
}
