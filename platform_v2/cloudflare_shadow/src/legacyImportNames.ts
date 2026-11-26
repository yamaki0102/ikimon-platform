import { isWeakTaxonLabel } from "./taxonNameResolver";

export type LegacyImportName = {
  vernacularName: string | null;
  scientificName: string | null;
  rank: string | null;
};

type ImportRow = {
  occurrence_id?: string | null;
  visit_id: string | null;
  vernacular_name: string | null;
  scientific_name: string | null;
  taxon_rank: string | null;
  confidence_score: number | null;
  quality_grade: string | null;
  created_at: string | null;
};

type Db = { prepare(query: string): { bind(...values: unknown[]): { all<T>(): Promise<{ results: T[] }> } } };

const CHUNK = 90;

const clean = (value: string | null | undefined): string | null => {
  const text = (value ?? "").trim();
  return text && !isWeakTaxonLabel(text) ? text : null;
};

const gradeRank = (grade: string | null): number => (/research|verified|confirmed|community/i.test(grade ?? "") ? 0 : 1);

const confidenceOf = (value: number | null): number => (typeof value === "number" && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY);

export function pickLegacyImportName(rows: readonly ImportRow[]): LegacyImportName | null {
  const named = rows.filter((r) => clean(r.vernacular_name) || clean(r.scientific_name));
  if (named.length === 0) return null;
  const best = [...named].sort(
    (a, b) =>
      gradeRank(a.quality_grade) - gradeRank(b.quality_grade) ||
      confidenceOf(b.confidence_score) - confidenceOf(a.confidence_score) ||
      (a.created_at ?? "").localeCompare(b.created_at ?? "") ||
      (a.occurrence_id ?? "").localeCompare(b.occurrence_id ?? "")
  )[0]!;
  return {
    vernacularName: clean(best.vernacular_name),
    scientificName: clean(best.scientific_name),
    rank: (best.taxon_rank ?? "").trim() || null,
  };
}

export async function loadLegacyImportNames(db: Db, ids: readonly string[]): Promise<Map<string, LegacyImportName>> {
  const out = new Map<string, LegacyImportName>();
  const unique = [...new Set(ids.filter((id) => typeof id === "string" && id))];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += CHUNK) chunks.push(unique.slice(i, i + CHUNK));
  const results = await Promise.all(
    chunks.map((chunk) =>
      db
        .prepare(
          `SELECT occurrence_id, visit_id, vernacular_name, scientific_name, taxon_rank, confidence_score, quality_grade, created_at
             FROM production_import_occurrences
            WHERE visit_id IN (${chunk.map(() => "?").join(",")})
              AND (TRIM(COALESCE(vernacular_name, '')) <> '' OR TRIM(COALESCE(scientific_name, '')) <> '')`
        )
        .bind(...chunk)
        .all<ImportRow>()
        .then((r) => (Array.isArray(r?.results) ? r.results : []))
        .catch(() => [] as ImportRow[])
    )
  ).catch(() => [] as ImportRow[][]);
  const byVisit = new Map<string, ImportRow[]>();
  for (const row of results.flat()) {
    if (!row?.visit_id) continue;
    const list = byVisit.get(row.visit_id);
    if (list) list.push(row);
    else byVisit.set(row.visit_id, [row]);
  }
  for (const [visitId, rows] of byVisit) {
    const picked = pickLegacyImportName(rows);
    if (picked) out.set(visitId, picked);
  }
  return out;
}

export function legacyImportDisplayName(name: LegacyImportName | null | undefined): string | null {
  return name?.vernacularName ?? name?.scientificName ?? null;
}

export async function resolveWeakLabels(
  db: Db,
  items: ReadonlyArray<{ id: string; label: string | null | undefined }>
): Promise<Map<string, string>> {
  const weakIds = items.filter((i) => isWeakTaxonLabel(i.label)).map((i) => i.id);
  const names = weakIds.length ? await loadLegacyImportNames(db, weakIds).catch(() => new Map<string, LegacyImportName>()) : new Map<string, LegacyImportName>();
  const out = new Map<string, string>();
  for (const [id, name] of names) {
    const display = legacyImportDisplayName(name);
    if (display) out.set(id, display);
  }
  return out;
}
