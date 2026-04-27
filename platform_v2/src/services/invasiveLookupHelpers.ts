/**
 * 外来種 hard-gate 専用ヘルパ。
 *
 * 観察 reassess パイプラインで、LLM が `invasive_response.is_invasive=true` を
 * 返したときに、その判定が `invasive_status_versions` (Sprint 1 で導入された
 * versioned 外来種マスタ) に裏付けられているかを照合する。
 *
 * 設計方針:
 *  - prompt への knowledge 注入は freshness-os 移行で廃止された (prompt v3)。
 *    そのため事前注入はせず、出力に対する事後 gate のみを行う。
 *  - subject (主対象) の学名・属・科のいずれかが invasive_status_versions に
 *    現行版 (valid_to IS NULL) として存在する場合のみ is_invasive を許可する。
 *  - matched 時は mhlw_category / source_excerpt / valid_from を gate 後の
 *    output に上書きし、LLM の hallucination を実データで補正する。
 */

import type { PoolClient } from "pg";

export type InvasiveLookupTerm = {
  /** 学名・属名・科名のいずれか (lower-case 比較される) */
  name: string;
  /** species/genus/family/order */
  rank?: string;
  /** subject か coexisting か */
  appliesTo?: "subject" | "coexisting";
};

export type InvasiveStatusFact = {
  versionId: string;
  scientificName: string;
  regionScope: string;
  mhlwCategory: "iaspecified" | "priority" | "industrial" | "prevention" | "none";
  sourceExcerpt: string;
  validFrom: string;
  appliesTo: "subject" | "coexisting";
  matchedTerm: string;
};

const DEFAULT_REGION = "JP";
const VALID_CATEGORIES = new Set<InvasiveStatusFact["mhlwCategory"]>([
  "iaspecified",
  "priority",
  "industrial",
  "prevention",
  "none",
]);

/**
 * subject + coexisting 候補の学名・属・科一覧から、
 * invasive_status_versions の現行版 (valid_to IS NULL) に該当するものを返す。
 *
 * 該当が無いときは空配列。
 */
export async function lookupInvasiveStatusFacts(
  client: PoolClient,
  terms: InvasiveLookupTerm[],
  regionScope: string = DEFAULT_REGION,
): Promise<InvasiveStatusFact[]> {
  const dedup = new Map<string, InvasiveLookupTerm>();
  for (const t of terms) {
    if (!t || !t.name) continue;
    const trimmed = t.name.trim();
    if (!trimmed) continue;
    const key = `${trimmed.toLowerCase()}|${t.appliesTo ?? "subject"}`;
    if (!dedup.has(key)) {
      dedup.set(key, { name: trimmed, rank: t.rank, appliesTo: t.appliesTo ?? "subject" });
    }
  }
  if (dedup.size === 0) return [];

  const lowered = Array.from(dedup.values()).map((t) => t.name.toLowerCase());

  let rows: Array<{
    version_id: string;
    scientific_name: string;
    region_scope: string;
    mhlw_category: string;
    source_excerpt: string;
    valid_from: string;
  }>;
  try {
    const result = await client.query<{
      version_id: string;
      scientific_name: string;
      region_scope: string;
      mhlw_category: string;
      source_excerpt: string;
      valid_from: string;
    }>(
      `SELECT version_id::text,
              scientific_name,
              region_scope,
              mhlw_category,
              source_excerpt,
              valid_from::text
         FROM invasive_status_versions
        WHERE valid_to IS NULL
          AND region_scope = $2
          AND lower(scientific_name) = ANY($1::text[])`,
      [lowered, regionScope],
    );
    rows = result.rows;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/relation "invasive_status_versions" does not exist|undefined_table/i.test(msg)) {
      return [];
    }
    throw error;
  }

  const facts: InvasiveStatusFact[] = [];
  for (const row of rows) {
    const sciLower = row.scientific_name.toLowerCase();
    let matched: InvasiveLookupTerm | undefined;
    for (const term of dedup.values()) {
      if (term.name.toLowerCase() === sciLower) {
        matched = term;
        break;
      }
    }
    if (!matched) continue;
    const mhlwCategory = VALID_CATEGORIES.has(row.mhlw_category as InvasiveStatusFact["mhlwCategory"])
      ? (row.mhlw_category as InvasiveStatusFact["mhlwCategory"])
      : "none";
    facts.push({
      versionId: row.version_id,
      scientificName: row.scientific_name,
      regionScope: row.region_scope,
      mhlwCategory,
      sourceExcerpt: row.source_excerpt ?? "",
      validFrom: row.valid_from,
      appliesTo: matched.appliesTo ?? "subject",
      matchedTerm: matched.name,
    });
  }
  return facts;
}

/**
 * subject (appliesTo='subject') として一致した invasive 事実があるか。
 * applyThreeLensGates の hard-gate 判定に使う。
 */
export function hasSubjectInvasiveFact(facts: InvasiveStatusFact[]): boolean {
  return facts.some((f) => f.appliesTo === "subject" && f.mhlwCategory !== "none");
}

/**
 * subject に該当する fact を 1 件選んで返す。複数該当時は species → genus →
 * family の優先で先頭を取る (matchedTerm の長さで近似)。
 */
export function pickSubjectInvasiveFact(facts: InvasiveStatusFact[]): InvasiveStatusFact | null {
  const subjectFacts = facts.filter((f) => f.appliesTo === "subject" && f.mhlwCategory !== "none");
  if (subjectFacts.length === 0) return null;
  // species (matchedTerm に空白を含む二名法) を優先
  const species = subjectFacts.find((f) => /\s/.test(f.matchedTerm));
  return species ?? subjectFacts[0]!;
}
