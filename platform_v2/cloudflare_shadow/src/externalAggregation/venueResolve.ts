import { resolveAdminCodes, type AdminIndex } from "../adminUnits";
import type { ExtDb, ExtractedFact } from "./types";

export interface VenueResolution {
  city_unit_id: string | null;
  admin_unit_id: string | null;
  zukan_place_id: string | null;
}

export function normalizeName(text: string | null | undefined): string {
  return (text ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

async function cityByName(db: ExtDb, name: string): Promise<string | null> {
  const row = await db.prepare("SELECT code FROM admin_units WHERE level='city' AND name_ja=? ORDER BY code LIMIT 1").bind(name).first<{ code: string }>();
  return row?.code ?? null;
}

async function resolveByPlaceName(db: ExtDb, venue: string): Promise<VenueResolution | null> {
  const norm = normalizeName(venue);
  if (!norm) return null;
  const row = await db.prepare(
    `SELECT p.place_id,p.municipality FROM places p WHERE p.canonical_name_normalized=?
     UNION SELECT p.place_id,p.municipality FROM place_aliases a JOIN places p ON p.place_id=a.place_id WHERE a.alias_normalized=?
     ORDER BY 1 LIMIT 1`,
  ).bind(norm, norm).first<{ place_id: string; municipality: string | null }>();
  if (!row) return null;
  const city = row.municipality ? await cityByName(db, normalizeName(row.municipality)) : null;
  return { city_unit_id: city, admin_unit_id: city, zukan_place_id: row.place_id };
}

async function resolveByAddress(db: ExtDb, address: string): Promise<VenueResolution | null> {
  const text = address.normalize("NFKC").replace(/\s+/g, "").replace(/^.*?[都道府県]/, "");
  const m = /([一-龠ぁ-んァ-ヶー]{1,6}市)(?:([一-龠ぁ-んァ-ヶー]{1,5}区))?/.exec(text);
  if (!m) return null;
  const city = await cityByName(db, m[1]!);
  if (!city) return null;
  let admin = city;
  if (m[2]) {
    const ward = await db.prepare("SELECT code FROM admin_units WHERE level='ward' AND parent_code=? AND name_ja=? AND valid_to IS NULL LIMIT 1").bind(city, m[2]).first<{ code: string }>();
    if (ward) admin = ward.code;
  }
  return { city_unit_id: city, admin_unit_id: admin, zukan_place_id: null };
}

export async function resolveVenue(db: ExtDb, fact: Pick<ExtractedFact, "lat" | "lng" | "venue_name" | "venue_address">, index: AdminIndex | null): Promise<VenueResolution> {
  const none: VenueResolution = { city_unit_id: null, admin_unit_id: null, zukan_place_id: null };
  try {
    let placeId: string | null = null;
    if (fact.venue_name) {
      const byName = await resolveByPlaceName(db, fact.venue_name);
      placeId = byName?.zukan_place_id ?? null;
      if (byName && fact.lat === null) return byName;
    }
    if (index && typeof fact.lat === "number" && typeof fact.lng === "number") {
      const codes = resolveAdminCodes(fact.lng, fact.lat, index);
      if (codes.city_code) {
        return { city_unit_id: codes.city_code, admin_unit_id: codes.ward_code ?? codes.city_code, zukan_place_id: placeId };
      }
    }
    if (fact.venue_name) {
      const byName = await resolveByPlaceName(db, fact.venue_name);
      if (byName?.city_unit_id) return byName;
    }
    if (fact.venue_address) {
      const byAddr = await resolveByAddress(db, fact.venue_address);
      if (byAddr) return { ...byAddr, zukan_place_id: placeId };
    }
    return { ...none, zukan_place_id: placeId };
  } catch {
    return none;
  }
}
