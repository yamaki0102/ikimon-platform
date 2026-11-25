import { nameKeyOf } from "./gbifTaxonMatch";
import {
  normalizeSafePublicAreaLabelCandidate,
  publicSafetyDecisionForContext,
  resolveSafePublicAreaLabel,
} from "./publicAreaLabel";

export type SensitiveTier = "none" | "coarse" | "withhold";

export type AreaBackfillRow = {
  observation_id: string;
  public_cell: string | null;
  visibility: string | null;
  emergency_hidden: number | null;
  taxon_label: string | null;
  names: string | null;
  obs_label: string | null;
  rm_exists: number | null;
  rm_label: string | null;
  risk_lane: string | null;
  audience_scope: string | null;
  public_precision: string | null;
  withdrawn: number | null;
};

export type CellLocality = { prefecture: string; municipality: string; countryCode: string };

export type AreaDecision = {
  observationId: string;
  action: "fill" | "sync_readmodel" | "skip";
  reason: string;
  label: string | null;
  cell: string | null;
  prefecture: string | null;
  tier: SensitiveTier;
  fillObservation: boolean;
  fillReadmodel: boolean;
};

export const AREA_BACKFILL_CANDIDATE_SQL = `SELECT o.observation_id, o.public_cell, o.visibility, o.emergency_hidden, o.taxon_label,
  (SELECT group_concat(i.proposed_name, '|') FROM observation_identifications i
    WHERE i.is_current = 1 AND i.occurrence_id IN ('occ:' || o.observation_id || ':0', o.observation_id)) AS names,
  o.public_area_label AS obs_label,
  CASE WHEN r.observation_id IS NULL THEN 0 ELSE 1 END AS rm_exists,
  r.public_area_label AS rm_label,
  c.risk_lane, c.audience_scope, c.public_precision,
  CASE WHEN EXISTS (SELECT 1 FROM observation_data_rights d WHERE d.visit_id = o.observation_id AND d.withdrawal_status IS NOT NULL AND d.withdrawal_status <> 'active') THEN 1 ELSE 0 END AS withdrawn
FROM observations o
LEFT JOIN readmodel_public_observations r ON r.observation_id = o.observation_id
LEFT JOIN civic_observation_contexts c ON c.visit_id = o.observation_id
ORDER BY o.observation_id`;

export const AREA_BACKFILL_SENSITIVE_SQL = `SELECT t.name_key, t.tier FROM gbif_sensitive_taxa t
WHERE t.list_version = (SELECT list_version FROM gbif_sensitive_list_versions WHERE status = 'active' LIMIT 1)`;

const isEmpty = (value: string | null | undefined): boolean => !value || value.trim() === "";

export function parsePublicCellCenter(cell: string | null | undefined): { lat: number; lng: number; key: string } | null {
  const match = /^(?:cell:)?(-?\d{1,3}\.\d{1,2}),(-?\d{1,3}\.\d{1,2})$/u.exec((cell ?? "").trim());
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, key: `${lat.toFixed(2)},${lng.toFixed(2)}` };
}

const normalizePrefectureLabel = (value: unknown): string => {
  const raw = String(value || "").trim();
  const lower = raw.toLowerCase().replace(/[-\s]+/g, " ");
  if (raw === "静岡" || raw === "静岡県" || lower === "shizuoka" || lower === "shizuoka prefecture") return "静岡県";
  return raw;
};

const normalizeMunicipalityLabel = (value: unknown): string => {
  const raw = String(value || "").trim();
  const lower = raw.toLowerCase().replace(/[-\s]+/g, " ");
  if (raw === "浜松" || raw === "浜松市" || lower === "hamamatsu" || lower === "hamamatsu city" || lower === "hamamatsu shi") return "浜松市";
  if (raw === "静岡市" || lower === "shizuoka city" || lower === "shizuoka shi") return "静岡市";
  if (raw === "静岡県" || lower === "shizuoka" || lower === "shizuoka prefecture") return "";
  return raw;
};

const normalizeSubMunicipalityLabel = (value: unknown): string => {
  const raw = String(value || "").trim();
  const lower = raw.toLowerCase().replace(/[-\s]+/g, " ");
  if (!raw) return "";
  if (raw === "浜松市" || lower === "hamamatsu" || lower === "hamamatsu city" || lower === "hamamatsu shi") return "";
  if (raw === "静岡市" || lower === "shizuoka city" || lower === "shizuoka shi") return "";
  if (raw === "静岡県" || lower === "shizuoka" || lower === "shizuoka prefecture") return "";
  return raw;
};

const combineMunicipalityAndSubArea = (municipalityValue: unknown, subAreaValue: unknown): string => {
  const municipality = normalizeMunicipalityLabel(municipalityValue);
  const subArea = normalizeSubMunicipalityLabel(subAreaValue);
  if (!municipality) return subArea;
  if (!subArea || subArea === municipality) return municipality;
  if (subArea.startsWith(municipality)) return normalizeMunicipalityLabel(subArea);
  if (municipality.includes(subArea)) return municipality;
  if (/市$/.test(municipality) && /区$/.test(subArea)) return municipality + subArea;
  return municipality;
};

/** read.ts の localityFromAddress（新規投稿の入力欄を埋める処理）と同一の規則。 */
export function localityFromAddress(address: unknown): { prefecture: string; municipality: string } {
  const source = (address && typeof address === "object" ? address : {}) as Record<string, string | undefined>;
  const prefecture = normalizePrefectureLabel(source.state || source.province || source.region || "");
  const municipality = combineMunicipalityAndSubArea(
    source.city || source.town || source.village || source.municipality || source.county || "",
    source.city_district || source.borough || source.district || source.ward || ""
  );
  return { prefecture, municipality };
}

const PREFECTURES_BY_ISO_CODE = "北海道,青森県,岩手県,宮城県,秋田県,山形県,福島県,茨城県,栃木県,群馬県,埼玉県,千葉県,東京都,神奈川県,新潟県,富山県,石川県,福井県,山梨県,長野県,岐阜県,静岡県,愛知県,三重県,滋賀県,京都府,大阪府,兵庫県,奈良県,和歌山県,鳥取県,島根県,岡山県,広島県,山口県,徳島県,香川県,愛媛県,高知県,福岡県,佐賀県,長崎県,熊本県,大分県,宮崎県,鹿児島県,沖縄県".split(",");

export function cellLocalityFromNominatim(response: unknown): CellLocality | null {
  const address = (response as { address?: Record<string, string | undefined> } | null)?.address;
  if (!address || typeof address !== "object") return null;
  const located = localityFromAddress(address);
  const iso = /^JP-([0-9]{2})$/u.exec(String(address["ISO3166-2-lvl4"] ?? ""));
  const prefecture = located.prefecture || (iso ? PREFECTURES_BY_ISO_CODE[Number(iso[1]) - 1] ?? "" : "");
  return { prefecture, municipality: located.municipality, countryCode: String(address.country_code ?? "").toLowerCase() };
}

export function areaLabelForLocality(locality: CellLocality | null, tier: SensitiveTier): string | null {
  if (!locality || locality.countryCode !== "jp") return null;
  if (tier === "withhold") return null;
  if (tier === "coarse") return normalizeSafePublicAreaLabelCandidate(locality.prefecture);
  return resolveSafePublicAreaLabel({ municipality: locality.municipality, prefecture: locality.prefecture });
}

export function sensitiveTierFor(row: Pick<AreaBackfillRow, "taxon_label" | "names">, tiers: ReadonlyMap<string, SensitiveTier>): SensitiveTier {
  let tier: SensitiveTier = "none";
  const candidates = [row.taxon_label, ...String(row.names ?? "").split("|")];
  for (const candidate of candidates) {
    const key = nameKeyOf(candidate);
    if (!key) continue;
    const found = tiers.get(key);
    if (found === "withhold") return "withhold";
    if (found === "coarse") tier = "coarse";
  }
  return tier;
}

const skip = (row: AreaBackfillRow, reason: string, extra: Partial<AreaDecision> = {}): AreaDecision => ({
  observationId: row.observation_id,
  action: "skip",
  reason,
  label: null,
  cell: null,
  prefecture: null,
  tier: "none",
  fillObservation: false,
  fillReadmodel: false,
  ...extra,
});

export function decideAreaLabel(
  row: AreaBackfillRow,
  localities: ReadonlyMap<string, CellLocality | null>,
  tiers: ReadonlyMap<string, SensitiveTier>
): AreaDecision {
  if (row.visibility !== "public") return skip(row, "not_public");
  if (Number(row.emergency_hidden ?? 0) !== 0) return skip(row, "emergency_hidden");
  if (Number(row.withdrawn ?? 0) !== 0) return skip(row, "withdrawn");
  const safety = publicSafetyDecisionForContext(
    row.risk_lane || row.audience_scope || row.public_precision
      ? { risk_lane: row.risk_lane, audience_scope: row.audience_scope, public_precision: row.public_precision }
      : null
  );
  if (safety.blocked) return skip(row, `safety_blocked:${safety.reason}`);
  const cell = parsePublicCellCenter(row.public_cell);
  if (!cell) return skip(row, "no_public_cell");
  const tier = sensitiveTierFor(row, tiers);
  if (tier === "withhold") return skip(row, "sensitive_withhold", { cell: cell.key, tier });

  const existing = normalizeSafePublicAreaLabelCandidate(row.obs_label);
  if (!isEmpty(row.obs_label)) {
    if (existing && Number(row.rm_exists ?? 0) === 1 && isEmpty(row.rm_label)) {
      return {
        observationId: row.observation_id, action: "sync_readmodel", reason: "readmodel_empty_obs_has_label", label: existing,
        cell: cell.key, prefecture: null, tier, fillObservation: false, fillReadmodel: true,
      };
    }
    return skip(row, "already_labeled", { cell: cell.key, tier });
  }

  const locality = localities.get(cell.key) ?? null;
  const label = areaLabelForLocality(locality, tier);
  if (!label) {
    const reason = !locality ? "cell_unresolved" : locality.countryCode !== "jp" ? "non_japan" : "label_rejected";
    return skip(row, reason, { cell: cell.key, tier, prefecture: locality?.prefecture || null });
  }
  return {
    observationId: row.observation_id, action: "fill", reason: tier === "coarse" ? "filled_coarse_sensitive" : "filled",
    label, cell: cell.key, prefecture: locality?.prefecture || null, tier,
    fillObservation: true, fillReadmodel: Number(row.rm_exists ?? 0) === 1 && isEmpty(row.rm_label),
  };
}

const sqlText = (value: string): string => `'${value.replaceAll("'", "''")}'`;
const EMPTY = "(public_area_label IS NULL OR TRIM(public_area_label) = '')";

export function buildAreaBackfillSql(decisions: readonly AreaDecision[]): { updates: string; rollback: string; statementCount: number } {
  const up: string[] = [];
  const down: string[] = [];
  for (const d of decisions) {
    if (!d.label) continue;
    const id = sqlText(d.observationId);
    const label = sqlText(d.label);
    if (d.fillObservation) {
      up.push(`UPDATE observations SET public_area_label = ${label} WHERE observation_id = ${id} AND visibility = 'public' AND emergency_hidden = 0 AND ${EMPTY};`);
      down.push(`UPDATE observations SET public_area_label = NULL WHERE observation_id = ${id} AND public_area_label = ${label};`);
    }
    if (d.fillReadmodel) {
      up.push(`UPDATE readmodel_public_observations SET public_area_label = ${label}, updated_at = CURRENT_TIMESTAMP WHERE observation_id = ${id} AND ${EMPTY};`);
      down.push(`UPDATE readmodel_public_observations SET public_area_label = NULL, updated_at = CURRENT_TIMESTAMP WHERE observation_id = ${id} AND public_area_label = ${label};`);
    }
  }
  return { updates: up.join("\n") + (up.length ? "\n" : ""), rollback: down.join("\n") + (down.length ? "\n" : ""), statementCount: up.length };
}

const csvCell = (value: string | number | null): string => {
  const text = value === null ? "" : String(value);
  return /[",\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function buildAreaPreviewCsv(decisions: readonly AreaDecision[]): string {
  const lines = ["observation_id,public_lat,public_lng,action,reason,sensitive_tier,new_label"];
  for (const d of decisions) {
    const [lat, lng] = d.cell ? d.cell.split(",") : ["", ""];
    lines.push([d.observationId, lat, lng, d.action, d.reason, d.tier, d.label].map((v) => csvCell(v ?? null)).join(","));
  }
  return lines.join("\n") + "\n";
}

export function summarizeAreaDecisions(decisions: readonly AreaDecision[]): {
  total: number; filled: number; synced: number; skipped: number;
  byReason: Record<string, number>; byPrefecture: Record<string, number>; byLabel: Record<string, number>;
} {
  const byReason: Record<string, number> = {};
  const byPrefecture: Record<string, number> = {};
  const byLabel: Record<string, number> = {};
  let filled = 0; let synced = 0; let skipped = 0;
  for (const d of decisions) {
    byReason[d.reason] = (byReason[d.reason] ?? 0) + 1;
    if (d.action === "skip") { skipped += 1; continue; }
    if (d.action === "fill") filled += 1; else synced += 1;
    const pref = d.prefecture || "(不明)";
    byPrefecture[pref] = (byPrefecture[pref] ?? 0) + 1;
    if (d.label) byLabel[d.label] = (byLabel[d.label] ?? 0) + 1;
  }
  return { total: decisions.length, filled, synced, skipped, byReason, byPrefecture, byLabel };
}
