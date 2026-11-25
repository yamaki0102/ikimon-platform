import type { Env } from "./core/env";
import { normalizeSafePublicAreaLabelCandidate, resolveSafePublicAreaLabel } from "./publicAreaLabel";

export const OWNER_AREA_LABEL_NO_LOCATION = "場所なし";

const CHUNK = 50;

export async function loadOwnerAreaLabels(env: Env, observationIds: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(observationIds)];
  try {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const part = ids.slice(i, i + CHUNK);
      const marks = part.map((_, k) => `?${k + 1}`).join(",");
      const found = await env.OBS_DB.prepare(
        `SELECT observation_id, label FROM owner_area_label_cache WHERE observation_id IN (${marks})`
      ).bind(...part).all<{ observation_id: string; label: string | null }>();
      for (const row of found.results ?? []) {
        const label = normalizeSafePublicAreaLabelCandidate(row.label);
        if (label) out.set(row.observation_id, label);
      }
    }
  } catch {
    return out;
  }
  return out;
}

export function ownerAreaLabelFromInput(input: { municipality?: unknown; prefecture?: unknown }): string | null {
  return resolveSafePublicAreaLabel(input);
}

export async function saveOwnerAreaLabel(env: Env, observationId: string, label: string | null): Promise<void> {
  if (!label) return;
  try {
    await env.OBS_DB.prepare(
      "INSERT INTO owner_area_label_cache (observation_id, label, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP) ON CONFLICT(observation_id) DO UPDATE SET label = excluded.label, updated_at = excluded.updated_at"
    ).bind(observationId, label).run();
  } catch {
    return;
  }
}

export const OWNER_AREA_BACKFILL_SQL = `SELECT o.observation_id, o.public_cell, ROUND(o.exact_lat, 2) AS lat2, ROUND(o.exact_lng, 2) AS lng2
FROM observations o
WHERE (o.public_area_label IS NULL OR TRIM(o.public_area_label) = '')
  AND o.exact_lat IS NOT NULL AND o.exact_lng IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM owner_area_label_cache c WHERE c.observation_id = o.observation_id)
ORDER BY o.observation_id`;

export type OwnerAreaBackfillRow = { observation_id: string; public_cell: string | null; lat2: number | null; lng2: number | null };

export function ownerAreaCellKey(row: OwnerAreaBackfillRow): string | null {
  const m = /^(?:cell:)?(-?\d{1,3}\.\d{1,2}),(-?\d{1,3}\.\d{1,2})$/u.exec((row.public_cell ?? "").trim());
  if (m) return `${Number(m[1]).toFixed(2)},${Number(m[2]).toFixed(2)}`;
  if (row.lat2 !== null && row.lng2 !== null && Number.isFinite(row.lat2) && Number.isFinite(row.lng2)) return `${row.lat2.toFixed(2)},${row.lng2.toFixed(2)}`;
  return null;
}

const sqlText = (value: string): string => `'${value.replaceAll("'", "''")}'`;

export function buildOwnerAreaBackfillSql(entries: ReadonlyArray<{ observationId: string; label: string }>): { updates: string; rollback: string } {
  const up = entries.map((e) => `INSERT OR IGNORE INTO owner_area_label_cache (observation_id, label, updated_at) VALUES (${sqlText(e.observationId)}, ${sqlText(e.label)}, CURRENT_TIMESTAMP);`);
  const down = entries.map((e) => `DELETE FROM owner_area_label_cache WHERE observation_id = ${sqlText(e.observationId)} AND label = ${sqlText(e.label)};`);
  return { updates: up.join("\n") + (up.length ? "\n" : ""), rollback: down.join("\n") + (down.length ? "\n" : "") };
}

export function ownerAreaLabelFromNominatim(response: unknown): string | null {
  const address = (response as { address?: Record<string, string | undefined> } | null)?.address;
  if (!address || typeof address !== "object" || String(address.country_code ?? "").toLowerCase() !== "jp") return null;
  const city = String(address.city || address.town || address.village || address.municipality || address.county || "").trim();
  const ward = String(address.city_district || address.borough || address.district || address.ward || "").trim();
  const municipality = /市$/u.test(city) && /区$/u.test(ward) && !ward.startsWith(city) ? city + ward : city;
  return resolveSafePublicAreaLabel({ municipality, prefecture: String(address.state || address.province || address.region || "").trim() });
}
