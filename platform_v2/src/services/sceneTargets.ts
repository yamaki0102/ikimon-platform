import type { Pool, PoolClient } from "pg";
import { getPool } from "../db.js";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export type SceneTargetStatus = "draft" | "adopted" | "ignored" | "later" | "converted";
export type SceneTargetType = "organism" | "sound" | "trace" | "habitat" | "unknown";
export type SceneTargetMediaKind = "image" | "video" | "audio" | "unknown";

export type SceneTargetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SceneTargetTimeRange = {
  startSecond: number | null;
  endSecond: number | null;
};

export type SceneTarget = {
  sceneTargetId: string;
  visitId: string;
  assetId: string | null;
  candidateId: string | null;
  occurrenceId: string | null;
  targetType: SceneTargetType;
  mediaKind: SceneTargetMediaKind;
  label: string;
  memo: string;
  normalizedRect: SceneTargetRect | null;
  startSecond: number | null;
  endSecond: number | null;
  aiSuggestions: SceneTargetAiSuggestion[];
  status: SceneTargetStatus;
  sourceKind: "user" | "ai" | "system";
  createdAt: string;
  updatedAt: string;
};

export type SceneTargetMedia = {
  assetId: string;
  assetRole: string;
  mediaKind: SceneTargetMediaKind;
  mimeType: string | null;
  url: string | null;
  widthPx: number | null;
  heightPx: number | null;
  durationMs: number | null;
};

export type SceneTargetAiSuggestion = {
  candidateId: string;
  displayName: string;
  scientificName: string | null;
  rank: string | null;
  confidence: number | null;
  note: string | null;
};

export type SceneTargetCandidate = SceneTargetAiSuggestion & {
  status: string;
  targetStatus: SceneTargetStatus | null;
  targetId: string | null;
  regions: Array<{
    assetId: string | null;
    rect: SceneTargetRect | null;
    frameTimeMs: number | null;
    confidence: number | null;
    note: string | null;
  }>;
};

export type SceneTargetWorkspace = {
  visit: {
    visitId: string;
    observerUserId: string | null;
    observedAt: string;
    note: string | null;
    placeName: string | null;
    municipality: string | null;
  };
  media: SceneTargetMedia[];
  targets: SceneTarget[];
  candidates: SceneTargetCandidate[];
};

export type UpsertSceneTargetInput = {
  sceneId: string;
  actorUserId: string;
  targetId?: string | null;
  assetId?: string | null;
  targetType?: string | null;
  mediaKind?: string | null;
  label?: string | null;
  memo?: string | null;
  normalizedRect?: unknown;
  startSecond?: unknown;
  endSecond?: unknown;
  status?: string | null;
};

export type DecideSceneCandidateInput = {
  sceneId: string;
  candidateId: string;
  decision: "adopted" | "ignored" | "later";
  actorUserId: string;
};

function normalizeAssetUrl(raw: string | null): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return raw;
  return "/" + raw;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function readFiniteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeSceneTargetRect(value: unknown): SceneTargetRect | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const x = readFiniteNumber(source.x);
  const y = readFiniteNumber(source.y);
  const width = readFiniteNumber(source.width);
  const height = readFiniteNumber(source.height);
  if (x == null || y == null || width == null || height == null) return null;
  const normalized = {
    x: clamp01(x),
    y: clamp01(y),
    width: clamp01(width),
    height: clamp01(height),
  };
  if (normalized.width <= 0 || normalized.height <= 0) return null;
  if (normalized.x + normalized.width > 1) normalized.width = Math.max(0.001, 1 - normalized.x);
  if (normalized.y + normalized.height > 1) normalized.height = Math.max(0.001, 1 - normalized.y);
  return normalized;
}

export function normalizeTargetTimeRange(startValue: unknown, endValue: unknown): SceneTargetTimeRange {
  const start = readFiniteNumber(startValue);
  const end = readFiniteNumber(endValue);
  const startSecond = start == null ? null : Math.max(0, start);
  const endSecond = end == null ? null : Math.max(0, end);
  if (startSecond != null && endSecond != null && endSecond < startSecond) {
    throw new Error("invalid_scene_target_time_range");
  }
  return { startSecond, endSecond };
}

function normalizeTargetType(value: string | null | undefined): SceneTargetType {
  if (value === "organism" || value === "sound" || value === "trace" || value === "habitat" || value === "unknown") {
    return value;
  }
  return "organism";
}

function normalizeMediaKind(value: string | null | undefined): SceneTargetMediaKind {
  if (value === "image" || value === "video" || value === "audio" || value === "unknown") {
    return value;
  }
  return "unknown";
}

function normalizeStatus(value: string | null | undefined): SceneTargetStatus {
  if (value === "draft" || value === "adopted" || value === "ignored" || value === "later" || value === "converted") {
    return value;
  }
  return "draft";
}

function readAiSuggestions(value: unknown): SceneTargetAiSuggestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const candidateId = typeof row.candidateId === "string" ? row.candidateId : "";
      const displayName = typeof row.displayName === "string" ? row.displayName : "";
      if (!candidateId || !displayName) return null;
      const confidence = readFiniteNumber(row.confidence);
      return {
        candidateId,
        displayName,
        scientificName: typeof row.scientificName === "string" ? row.scientificName : null,
        rank: typeof row.rank === "string" ? row.rank : null,
        confidence,
        note: typeof row.note === "string" ? row.note : null,
      };
    })
    .filter((item): item is SceneTargetAiSuggestion => item !== null);
}

async function resolveVisit(queryable: Queryable, id: string): Promise<SceneTargetWorkspace["visit"] | null> {
  const result = await queryable.query<{
    visit_id: string;
    user_id: string | null;
    observed_at: string;
    note: string | null;
    place_name: string | null;
    municipality: string | null;
  }>(
    `WITH resolved_visit AS (
        SELECT visit_id
          FROM visits
         WHERE visit_id = $1
            OR legacy_observation_id = $1
        UNION
        SELECT visit_id
          FROM occurrences
         WHERE occurrence_id = $1
            OR legacy_observation_id = $1
     )
     SELECT v.visit_id,
            v.user_id,
            v.observed_at::text,
            v.note,
            p.canonical_name AS place_name,
            coalesce(v.observed_municipality, p.municipality) AS municipality
       FROM resolved_visit rv
       JOIN visits v ON v.visit_id = rv.visit_id
       LEFT JOIN places p ON p.place_id = v.place_id
      ORDER BY v.observed_at DESC
      LIMIT 1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    visitId: row.visit_id,
    observerUserId: row.user_id,
    observedAt: row.observed_at,
    note: row.note,
    placeName: row.place_name,
    municipality: row.municipality,
  };
}

async function assertSceneOwner(queryable: Queryable, sceneId: string, actorUserId: string): Promise<SceneTargetWorkspace["visit"]> {
  const visit = await resolveVisit(queryable, sceneId);
  if (!visit) throw new Error("scene_not_found");
  if (visit.observerUserId !== actorUserId) throw new Error("observation_not_owned");
  return visit;
}

function rowToSceneTarget(row: {
  scene_target_id: string;
  visit_id: string;
  asset_id: string | null;
  candidate_id: string | null;
  occurrence_id: string | null;
  target_type: string;
  media_kind: string;
  label: string;
  memo: string;
  normalized_rect: unknown;
  start_second: string | null;
  end_second: string | null;
  ai_suggestions: unknown;
  status: string;
  source_kind: string;
  created_at: string;
  updated_at: string;
}): SceneTarget {
  return {
    sceneTargetId: row.scene_target_id,
    visitId: row.visit_id,
    assetId: row.asset_id,
    candidateId: row.candidate_id,
    occurrenceId: row.occurrence_id,
    targetType: normalizeTargetType(row.target_type),
    mediaKind: normalizeMediaKind(row.media_kind),
    label: row.label,
    memo: row.memo,
    normalizedRect: normalizeSceneTargetRect(row.normalized_rect),
    startSecond: row.start_second == null ? null : Number(row.start_second),
    endSecond: row.end_second == null ? null : Number(row.end_second),
    aiSuggestions: readAiSuggestions(row.ai_suggestions),
    status: normalizeStatus(row.status),
    sourceKind: row.source_kind === "ai" || row.source_kind === "system" ? row.source_kind : "user",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listSceneTargets(queryable: Queryable, visitId: string): Promise<SceneTarget[]> {
  const result = await queryable.query<{
    scene_target_id: string;
    visit_id: string;
    asset_id: string | null;
    candidate_id: string | null;
    occurrence_id: string | null;
    target_type: string;
    media_kind: string;
    label: string;
    memo: string;
    normalized_rect: unknown;
    start_second: string | null;
    end_second: string | null;
    ai_suggestions: unknown;
    status: string;
    source_kind: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT scene_target_id::text,
            visit_id,
            asset_id::text,
            candidate_id::text,
            occurrence_id,
            target_type,
            media_kind,
            label,
            memo,
            normalized_rect,
            start_second::text,
            end_second::text,
            ai_suggestions,
            status,
            source_kind,
            created_at::text,
            updated_at::text
       FROM scene_targets
      WHERE visit_id = $1
      ORDER BY created_at ASC`,
    [visitId],
  );
  return result.rows.map(rowToSceneTarget);
}

async function listSceneMedia(queryable: Queryable, visitId: string): Promise<SceneTargetMedia[]> {
  const result = await queryable.query<{
    asset_id: string;
    asset_role: string;
    media_type: string;
    mime_type: string | null;
    media_url: string | null;
    width_px: number | null;
    height_px: number | null;
    duration_ms: number | null;
  }>(
    `SELECT DISTINCT ON (ea.asset_id)
            ea.asset_id::text,
            ea.asset_role,
            ab.media_type,
            ab.mime_type,
            coalesce(ab.public_url, ab.storage_path) AS media_url,
            ab.width_px,
            ab.height_px,
            ab.duration_ms
       FROM evidence_assets ea
       JOIN asset_blobs ab ON ab.blob_id = ea.blob_id
      WHERE ea.visit_id = $1
         OR ea.occurrence_id IN (SELECT occurrence_id FROM occurrences WHERE visit_id = $1)
      ORDER BY ea.asset_id, ea.created_at ASC`,
    [visitId],
  );
  return result.rows.map((row) => ({
    assetId: row.asset_id,
    assetRole: row.asset_role,
    mediaKind: normalizeMediaKind(row.media_type),
    mimeType: row.mime_type,
    url: normalizeAssetUrl(row.media_url),
    widthPx: row.width_px,
    heightPx: row.height_px,
    durationMs: row.duration_ms,
  }));
}

async function listSceneCandidates(queryable: Queryable, visitId: string, targets: SceneTarget[]): Promise<SceneTargetCandidate[]> {
  const targetByCandidate = new Map(targets.filter((target) => target.candidateId).map((target) => [target.candidateId as string, target]));
  const candidateResult = await queryable.query<{
    candidate_id: string;
    vernacular_name: string | null;
    scientific_name: string | null;
    taxon_rank: string | null;
    confidence_score: string | null;
    candidate_status: string;
    note: string | null;
  }>(
    `SELECT candidate_id::text,
            vernacular_name,
            scientific_name,
            taxon_rank,
            confidence_score::text,
            candidate_status,
            note
       FROM observation_ai_subject_candidates
      WHERE visit_id = $1
      ORDER BY confidence_score DESC NULLS LAST, created_at DESC`,
    [visitId],
  ).catch(() => ({ rows: [] }));

  const candidateIds = candidateResult.rows.map((row) => row.candidate_id);
  const regionResult = candidateIds.length > 0
    ? await queryable.query<{
        candidate_id: string;
        asset_id: string | null;
        normalized_rect: unknown;
        frame_time_ms: number | null;
        confidence_score: string | null;
        source_payload: Record<string, unknown> | null;
      }>(
      `SELECT candidate_id::text,
              asset_id::text,
              normalized_rect,
              frame_time_ms,
              confidence_score::text,
              source_payload
         FROM subject_media_regions
        WHERE candidate_id = ANY($1::uuid[])
        ORDER BY created_at ASC`,
      [candidateIds],
    ).catch(() => ({ rows: [] }))
    : { rows: [] };
  const regionsByCandidate = new Map<string, SceneTargetCandidate["regions"]>();
  for (const row of regionResult.rows) {
    const list = regionsByCandidate.get(row.candidate_id) ?? [];
    const payload = row.source_payload ?? {};
    list.push({
      assetId: row.asset_id,
      rect: normalizeSceneTargetRect(row.normalized_rect),
      frameTimeMs: row.frame_time_ms,
      confidence: row.confidence_score == null ? null : Number(row.confidence_score),
      note: typeof payload.note === "string" ? payload.note : null,
    });
    regionsByCandidate.set(row.candidate_id, list);
  }

  return candidateResult.rows.map((row) => {
    const displayName = row.vernacular_name || row.scientific_name || "AI 候補";
    const target = targetByCandidate.get(row.candidate_id) ?? null;
    return {
      candidateId: row.candidate_id,
      displayName,
      scientificName: row.scientific_name,
      rank: row.taxon_rank,
      confidence: row.confidence_score == null ? null : Number(row.confidence_score),
      note: row.note,
      status: row.candidate_status,
      targetStatus: target?.status ?? null,
      targetId: target?.sceneTargetId ?? null,
      regions: regionsByCandidate.get(row.candidate_id) ?? [],
    };
  });
}

export async function getSceneTargetWorkspace(sceneId: string): Promise<SceneTargetWorkspace | null> {
  const pool = getPool();
  const visit = await resolveVisit(pool, sceneId);
  if (!visit) return null;
  const [media, targets] = await Promise.all([
    listSceneMedia(pool, visit.visitId),
    listSceneTargets(pool, visit.visitId),
  ]);
  const candidates = await listSceneCandidates(pool, visit.visitId, targets);
  return { visit, media, targets, candidates };
}

export async function upsertSceneTarget(input: UpsertSceneTargetInput): Promise<SceneTarget> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const visit = await assertSceneOwner(client, input.sceneId, input.actorUserId);
    const targetId = input.targetId?.trim() || null;
    const label = String(input.label ?? "").trim().slice(0, 120);
    const memo = String(input.memo ?? "").trim().slice(0, 1200);
    const rect = normalizeSceneTargetRect(input.normalizedRect);
    const timeRange = normalizeTargetTimeRange(input.startSecond, input.endSecond);
    const targetType = normalizeTargetType(input.targetType);
    const mediaKind = normalizeMediaKind(input.mediaKind);
    const status = normalizeStatus(input.status);
    const assetId = input.assetId?.trim() || null;
    const rowValues = [
      visit.visitId,
      assetId,
      targetType,
      mediaKind,
      label,
      memo,
      JSON.stringify(rect ?? {}),
      timeRange.startSecond,
      timeRange.endSecond,
      status,
      input.actorUserId,
      targetId,
    ];
    const result = await client.query<{
      scene_target_id: string;
      visit_id: string;
      asset_id: string | null;
      candidate_id: string | null;
      occurrence_id: string | null;
      target_type: string;
      media_kind: string;
      label: string;
      memo: string;
      normalized_rect: unknown;
      start_second: string | null;
      end_second: string | null;
      ai_suggestions: unknown;
      status: string;
      source_kind: string;
      created_at: string;
      updated_at: string;
    }>(
      targetId
        ? `UPDATE scene_targets
              SET asset_id = $2::uuid,
                  target_type = $3,
                  media_kind = $4,
                  label = $5,
                  memo = $6,
                  normalized_rect = $7::jsonb,
                  start_second = $8,
                  end_second = $9,
                  status = $10,
                  updated_at = now()
            WHERE visit_id = $1
              AND scene_target_id = $12::uuid
        RETURNING scene_target_id::text, visit_id, asset_id::text, candidate_id::text, occurrence_id,
                  target_type, media_kind, label, memo, normalized_rect, start_second::text, end_second::text,
                  ai_suggestions, status, source_kind, created_at::text, updated_at::text`
        : `INSERT INTO scene_targets (
              visit_id, asset_id, target_type, media_kind, label, memo,
              normalized_rect, start_second, end_second, status, source_kind, created_by_user_id
           ) VALUES (
              $1, $2::uuid, $3, $4, $5, $6,
              $7::jsonb, $8, $9, $10, 'user', $11
           )
        RETURNING scene_target_id::text, visit_id, asset_id::text, candidate_id::text, occurrence_id,
                  target_type, media_kind, label, memo, normalized_rect, start_second::text, end_second::text,
                  ai_suggestions, status, source_kind, created_at::text, updated_at::text`,
      rowValues,
    );
    const row = result.rows[0];
    if (!row) throw new Error("scene_target_not_found");
    await client.query("commit");
    return rowToSceneTarget(row);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function decideSceneCandidate(input: DecideSceneCandidateInput): Promise<SceneTarget> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const visit = await assertSceneOwner(client, input.sceneId, input.actorUserId);
    const candidate = await client.query<{
      candidate_id: string;
      vernacular_name: string | null;
      scientific_name: string | null;
      taxon_rank: string | null;
      confidence_score: string | null;
      note: string | null;
    }>(
      `SELECT candidate_id::text,
              vernacular_name,
              scientific_name,
              taxon_rank,
              confidence_score::text,
              note
         FROM observation_ai_subject_candidates
        WHERE visit_id = $1
          AND candidate_id = $2::uuid
        LIMIT 1`,
      [visit.visitId, input.candidateId],
    );
    const candidateRow = candidate.rows[0];
    if (!candidateRow) throw new Error("candidate_not_found");

    const firstRegion = await client.query<{
      asset_id: string | null;
      normalized_rect: unknown;
      frame_time_ms: number | null;
    }>(
      `SELECT asset_id::text, normalized_rect, frame_time_ms
         FROM subject_media_regions
        WHERE candidate_id = $1::uuid
        ORDER BY created_at ASC
        LIMIT 1`,
      [input.candidateId],
    ).catch(() => ({ rows: [] }));
    const region = firstRegion.rows[0] ?? null;
    const suggestion: SceneTargetAiSuggestion = {
      candidateId: candidateRow.candidate_id,
      displayName: candidateRow.vernacular_name || candidateRow.scientific_name || "AI 候補",
      scientificName: candidateRow.scientific_name,
      rank: candidateRow.taxon_rank,
      confidence: candidateRow.confidence_score == null ? null : Number(candidateRow.confidence_score),
      note: candidateRow.note,
    };
    const frameSecond = region?.frame_time_ms == null ? null : Math.max(0, region.frame_time_ms / 1000);
    const result = await client.query<{
      scene_target_id: string;
      visit_id: string;
      asset_id: string | null;
      candidate_id: string | null;
      occurrence_id: string | null;
      target_type: string;
      media_kind: string;
      label: string;
      memo: string;
      normalized_rect: unknown;
      start_second: string | null;
      end_second: string | null;
      ai_suggestions: unknown;
      status: string;
      source_kind: string;
      created_at: string;
      updated_at: string;
    }>(
      `INSERT INTO scene_targets (
          visit_id, asset_id, candidate_id, target_type, media_kind, label, memo,
          normalized_rect, start_second, end_second, ai_suggestions, status, source_kind,
          created_by_user_id, source_payload
       ) VALUES (
          $1, $2::uuid, $3::uuid, 'organism', $4, $5, $6,
          $7::jsonb, $8, $9, $10::jsonb, $11, 'ai',
          $12, $13::jsonb
       )
       ON CONFLICT (candidate_id) WHERE candidate_id IS NOT NULL
       DO UPDATE SET
          status = excluded.status,
          label = excluded.label,
          memo = excluded.memo,
          asset_id = coalesce(scene_targets.asset_id, excluded.asset_id),
          normalized_rect = CASE
            WHEN scene_targets.normalized_rect = '{}'::jsonb THEN excluded.normalized_rect
            ELSE scene_targets.normalized_rect
          END,
          start_second = coalesce(scene_targets.start_second, excluded.start_second),
          end_second = coalesce(scene_targets.end_second, excluded.end_second),
          ai_suggestions = excluded.ai_suggestions,
          updated_at = now()
       RETURNING scene_target_id::text, visit_id, asset_id::text, candidate_id::text, occurrence_id,
                 target_type, media_kind, label, memo, normalized_rect, start_second::text, end_second::text,
                 ai_suggestions, status, source_kind, created_at::text, updated_at::text`,
      [
        visit.visitId,
        region?.asset_id ?? null,
        candidateRow.candidate_id,
        region?.asset_id ? "image" : "unknown",
        suggestion.displayName,
        candidateRow.note ?? "",
        JSON.stringify(normalizeSceneTargetRect(region?.normalized_rect) ?? {}),
        frameSecond,
        frameSecond == null ? null : frameSecond + 1,
        JSON.stringify([suggestion]),
        input.decision,
        input.actorUserId,
        JSON.stringify({ source: "scene_target_candidate_decision", decision: input.decision }),
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error("scene_target_not_found");
    await client.query("commit");
    return rowToSceneTarget(row);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
