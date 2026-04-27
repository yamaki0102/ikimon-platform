// Biodiversity Freshness OS: user_output_cache CRUD.
//
// Hot path stores generated AI output keyed by sha256(prompt_version +
// user + visit + asset blobs + digest_version + knowledge_version_set).
// Curator updates trigger invalidateByVersionRef() to expire affected rows.

import { createHash } from "node:crypto";
import { getPool } from "../db.js";

export type UserOutputKind =
  | "observation_assessment"
  | "taxon_insight"
  | "mypage_weekly"
  | "site_report"
  | "event_quest"
  | "guide_scene";

export type KnowledgeVersionSet = Record<string, string | string[]>;

export type CacheKeyInput = {
  promptVersion: string;
  userId: string;
  visitId?: string | null;
  occurrenceId?: string | null;
  assetBlobIds?: string[];
  digestVersion?: number | null;
  knowledgeVersionSet?: KnowledgeVersionSet;
};

export type UserOutputCacheRow = {
  cacheKey: string;
  userId: string;
  outputKind: UserOutputKind;
  promptVersion: string;
  visitId: string | null;
  occurrenceId: string | null;
  knowledgeVersionSet: KnowledgeVersionSet;
  outputPayload: unknown;
  costJpy: number;
  costUsd: number;
  hitCount: number;
  generatedAt: string;
  expiresAt: string | null;
  lastHitAt: string | null;
};

export type SaveCacheInput = {
  cacheKey: string;
  userId: string;
  outputKind: UserOutputKind;
  promptVersion: string;
  visitId?: string | null;
  occurrenceId?: string | null;
  knowledgeVersionSet?: KnowledgeVersionSet;
  outputPayload: unknown;
  costJpy?: number;
  costUsd?: number;
};

const KNOWLEDGE_KIND_KEYS = [
  "invasive",
  "redlist",
  "taxonomy",
  "place_env",
  "claim",
] as const;
export type KnowledgeKind = (typeof KNOWLEDGE_KIND_KEYS)[number];

export function buildCacheKey(input: CacheKeyInput): string {
  const sortedAssetBlobs = (input.assetBlobIds ?? []).slice().sort();
  const sortedKvs: KnowledgeVersionSet = {};
  for (const key of Object.keys(input.knowledgeVersionSet ?? {}).sort()) {
    const value = input.knowledgeVersionSet?.[key];
    if (Array.isArray(value)) {
      sortedKvs[key] = value.slice().sort();
    } else if (typeof value === "string") {
      sortedKvs[key] = value;
    }
  }
  const canonical = JSON.stringify({
    p: input.promptVersion,
    u: input.userId,
    v: input.visitId ?? null,
    o: input.occurrenceId ?? null,
    a: sortedAssetBlobs,
    d: input.digestVersion ?? 0,
    k: sortedKvs,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export async function fetchUserOutputCache(cacheKey: string): Promise<UserOutputCacheRow | null> {
  const pool = getPool();
  const result = await pool.query<{
    cache_key: string;
    user_id: string;
    output_kind: UserOutputKind;
    prompt_version: string;
    visit_id: string | null;
    occurrence_id: string | null;
    knowledge_version_set: KnowledgeVersionSet;
    output_payload: unknown;
    cost_jpy: string;
    cost_usd: string;
    hit_count: number;
    generated_at: string;
    expires_at: string | null;
    last_hit_at: string | null;
  }>(
    `SELECT cache_key, user_id, output_kind, prompt_version, visit_id, occurrence_id,
            knowledge_version_set, output_payload,
            cost_jpy::text AS cost_jpy, cost_usd::text AS cost_usd,
            hit_count, generated_at::text AS generated_at,
            expires_at::text AS expires_at, last_hit_at::text AS last_hit_at
       FROM user_output_cache
      WHERE cache_key = $1
        AND (expires_at IS NULL OR expires_at > NOW())`,
    [cacheKey]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    cacheKey: row.cache_key,
    userId: row.user_id,
    outputKind: row.output_kind,
    promptVersion: row.prompt_version,
    visitId: row.visit_id,
    occurrenceId: row.occurrence_id,
    knowledgeVersionSet: row.knowledge_version_set ?? {},
    outputPayload: row.output_payload,
    costJpy: Number(row.cost_jpy),
    costUsd: Number(row.cost_usd),
    hitCount: row.hit_count,
    generatedAt: row.generated_at,
    expiresAt: row.expires_at,
    lastHitAt: row.last_hit_at,
  };
}

export async function saveUserOutputCache(input: SaveCacheInput): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO user_output_cache (
       cache_key, user_id, output_kind, prompt_version, visit_id, occurrence_id,
       knowledge_version_set, output_payload, cost_jpy, cost_usd, generated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, NOW()
     )
     ON CONFLICT (cache_key) DO UPDATE SET
       output_payload = EXCLUDED.output_payload,
       knowledge_version_set = EXCLUDED.knowledge_version_set,
       cost_jpy = EXCLUDED.cost_jpy,
       cost_usd = EXCLUDED.cost_usd,
       generated_at = NOW(),
       expires_at = NULL`,
    [
      input.cacheKey,
      input.userId,
      input.outputKind,
      input.promptVersion,
      input.visitId ?? null,
      input.occurrenceId ?? null,
      JSON.stringify(input.knowledgeVersionSet ?? {}),
      JSON.stringify(input.outputPayload),
      input.costJpy ?? 0,
      input.costUsd ?? 0,
    ]
  );
}

export async function recordCacheHit(cacheKey: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE user_output_cache
        SET hit_count = hit_count + 1, last_hit_at = NOW()
      WHERE cache_key = $1`,
    [cacheKey]
  );
}

export async function invalidateByVersionRef(
  knowledgeKind: KnowledgeKind,
  versionId: string
): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ invalidated: string }>(
    `WITH affected AS (
       UPDATE user_output_cache
          SET expires_at = NOW()
        WHERE expires_at IS NULL
          AND knowledge_version_set @> jsonb_build_object($1::text, jsonb_build_array($2::text))
        RETURNING cache_key
     )
     SELECT COUNT(*)::text AS invalidated FROM affected`,
    [knowledgeKind, versionId]
  );
  return Number(result.rows[0]?.invalidated ?? 0);
}

export async function invalidateByPromptVersion(promptVersion: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ invalidated: string }>(
    `WITH affected AS (
       UPDATE user_output_cache
          SET expires_at = NOW()
        WHERE expires_at IS NULL
          AND prompt_version = $1
        RETURNING cache_key
     )
     SELECT COUNT(*)::text AS invalidated FROM affected`,
    [promptVersion]
  );
  return Number(result.rows[0]?.invalidated ?? 0);
}
