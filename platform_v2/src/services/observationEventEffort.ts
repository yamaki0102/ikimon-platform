import { getPool } from "../db.js";

export type EffortClass = "casual" | "moderate" | "intensive";

export interface SessionEffortInput {
  startedAt: string;
  updatedAt: string;
  totalDistanceM?: number | null;
  stepCount?: number | null;
  observationCount: number;
  speciesCount: number;
}

export interface EffortMetrics {
  durationSec: number;
  durationMin: number;
  distanceM: number;
  stepCount: number | null;
  observationCount: number;
  speciesCount: number;
  obsPerHour: number;
  obsPerKm: number;
  speciesPerHour: number;
  effortClass: EffortClass;
  isSurveyQuality: boolean;
}

export function calculateSessionEffort(input: SessionEffortInput): EffortMetrics {
  const startTs = Date.parse(input.startedAt);
  const endTs = Date.parse(input.updatedAt);
  const durationSec = Number.isFinite(startTs) && Number.isFinite(endTs)
    ? Math.max(0, Math.floor((endTs - startTs) / 1000))
    : 0;
  const distanceM = Number(input.totalDistanceM ?? 0) || 0;

  const hours = durationSec / 3600;
  const km = distanceM / 1000;
  const obsPerHour = hours > 0 ? input.observationCount / hours : 0;
  const obsPerKm = km > 0 ? input.observationCount / km : 0;
  const speciesPerHour = hours > 0 ? input.speciesCount / hours : 0;

  const effortClass = classifyEffort(durationSec, distanceM, input.observationCount);

  return {
    durationSec,
    durationMin: Math.round(durationSec / 60),
    distanceM: Math.round(distanceM * 10) / 10,
    stepCount: input.stepCount ?? null,
    observationCount: input.observationCount,
    speciesCount: input.speciesCount,
    obsPerHour: Math.round(obsPerHour * 100) / 100,
    obsPerKm: Math.round(obsPerKm * 100) / 100,
    speciesPerHour: Math.round(speciesPerHour * 100) / 100,
    effortClass,
    isSurveyQuality: effortClass !== "casual",
  };
}

export function classifyEffort(
  durationSec: number,
  distanceM: number,
  observationCount: number,
): EffortClass {
  const minutes = durationSec / 60;
  if (minutes >= 60 && distanceM >= 2000) return "intensive";
  if (minutes >= 30 || distanceM >= 1000 || observationCount >= 5) return "moderate";
  return "casual";
}

/**
 * Absence 推論の信頼度: 努力量 × 期待出現率 で 0..1 にスケール
 */
export function absenceConfidence(
  effortClass: EffortClass,
  presenceScore: number,
): number {
  const multiplier = effortClass === "intensive" ? 0.9 : effortClass === "moderate" ? 0.6 : 0.3;
  return Math.min(1, Math.round(presenceScore * multiplier * 1000) / 1000);
}

/**
 * 100m メッシュキー: lat/lng を 0.001 度刻みで丸める。
 * 緯度 0.001 度 ≒ 111m なので 100m メッシュ近似として実用的。
 */
export function meshKey100m(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  const rounded = (v: number): string => {
    const sign = v < 0 ? "-" : "";
    const abs = Math.abs(v);
    return `${sign}${Math.floor(abs * 1000) / 1000}`;
  };
  return `${rounded(lat)},${rounded(lng)}`;
}

export function meshCenter100m(meshKey: string): { lat: number; lng: number } | null {
  const parts = meshKey.split(",");
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat: lat + 0.0005, lng: lng + 0.0005 };
}

export interface MeshVisitInput {
  sessionId: string;
  lat: number;
  lng: number;
  visitSeconds?: number;
  observationDelta?: number;
  absenceDelta?: number;
  teamId?: string | null;
}

/**
 * メッシュ訪問を記録。Effort Maximize モードのカバレッジ計算に使う。
 * 同じ mesh_key への upsert で、訪問時間や観察数を加算していく。
 */
export async function recordMeshVisit(input: MeshVisitInput): Promise<void> {
  const key = meshKey100m(input.lat, input.lng);
  if (!key) return;
  const center = meshCenter100m(key);
  if (!center) return;

  const visitSeconds = Math.max(0, Math.round(input.visitSeconds ?? 0));
  const obsDelta = Math.max(0, Math.round(input.observationDelta ?? 0));
  const absDelta = Math.max(0, Math.round(input.absenceDelta ?? 0));
  const teamId = input.teamId ?? null;

  await getPool().query(
    `INSERT INTO observation_event_mesh_cells (
       session_id, mesh_key, center_lat, center_lng,
       visit_seconds, observation_count, absence_count,
       last_visited_at, visited_team_ids, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(),
       CASE WHEN $8::uuid IS NULL THEN ARRAY[]::UUID[] ELSE ARRAY[$8::uuid] END,
       NOW())
     ON CONFLICT (session_id, mesh_key) DO UPDATE SET
       visit_seconds     = observation_event_mesh_cells.visit_seconds + EXCLUDED.visit_seconds,
       observation_count = observation_event_mesh_cells.observation_count + EXCLUDED.observation_count,
       absence_count     = observation_event_mesh_cells.absence_count + EXCLUDED.absence_count,
       last_visited_at   = NOW(),
       visited_team_ids  = (
         SELECT COALESCE(array_agg(DISTINCT t), ARRAY[]::UUID[])
         FROM unnest(observation_event_mesh_cells.visited_team_ids || EXCLUDED.visited_team_ids) AS t
         WHERE t IS NOT NULL
       ),
       updated_at        = NOW()`,
    [input.sessionId, key, center.lat, center.lng, visitSeconds, obsDelta, absDelta, teamId],
  );
}

export interface SessionEffortSummary {
  sessionId: string;
  totalVisitedCells: number;
  totalEffortSeconds: number;
  totalEffortPersonHours: number;
  totalObservations: number;
  totalAbsences: number;
  coveragePct: number;
}

/**
 * Effort Maximize モードの集合スコア用集計。
 * coveragePct は config.coverage_target_cells があればそれで割る、なければ 100 cells を仮の母数。
 */
export async function summarizeSessionEffort(
  sessionId: string,
  coverageTargetCells = 100,
): Promise<SessionEffortSummary> {
  const result = await getPool().query<{
    visited_cells: string;
    visit_seconds_sum: string;
    observation_sum: string;
    absence_sum: string;
  }>(
    `SELECT
       COUNT(*)::text                       AS visited_cells,
       COALESCE(SUM(visit_seconds), 0)::text AS visit_seconds_sum,
       COALESCE(SUM(observation_count), 0)::text AS observation_sum,
       COALESCE(SUM(absence_count), 0)::text AS absence_sum
     FROM observation_event_mesh_cells
     WHERE session_id = $1`,
    [sessionId],
  );
  const row = result.rows[0];
  const visitedCells = row ? Number(row.visited_cells) : 0;
  const visitSeconds = row ? Number(row.visit_seconds_sum) : 0;
  const observations = row ? Number(row.observation_sum) : 0;
  const absences = row ? Number(row.absence_sum) : 0;
  const target = Math.max(1, coverageTargetCells);
  const coveragePct = Math.min(100, Math.round((visitedCells / target) * 1000) / 10);

  return {
    sessionId,
    totalVisitedCells: visitedCells,
    totalEffortSeconds: visitSeconds,
    totalEffortPersonHours: Math.round((visitSeconds / 3600) * 100) / 100,
    totalObservations: observations,
    totalAbsences: absences,
    coveragePct,
  };
}
