// Relationship Score v0.1 - snapshot fetcher
// Inputs ロード → Calculator → (任意) ナラティブ生成 → 永続化 → 前期間差分

import { randomUUID } from "node:crypto";
import { getPool } from "../db.js";
import { loadConfig } from "../config.js";
import type { SiteLang } from "../i18n.js";
import {
  calculateRelationshipScore,
  RELATIONSHIP_AXES,
  RELATIONSHIP_SCORE_CALC_VERSION,
  type RelationshipAxis,
  type RelationshipScoreInputs,
  type RelationshipScoreResult,
} from "./relationshipScore.js";
import { loadRelationshipScoreInputs } from "./relationshipScore.queries.js";
import {
  generateNarrative,
  type NarrativeBundle,
} from "./relationshipScoreNarrative.js";
import {
  DEMO_FIXTURES,
  isDemoFixtureKey,
  type DemoFixtureKey,
} from "./relationshipScoreFixture.js";

export type SnapshotSource = "live" | "demo";

export type RelationshipScoreSnapshot = {
  source: SnapshotSource;
  placeId: string;
  placeName: string | null;
  industry: string | null;
  localityLabel: string | null;
  periodStart: string; // ISO date
  periodEnd: string;   // ISO date
  score: RelationshipScoreResult;
  inputs: RelationshipScoreInputs;
  narrative: NarrativeBundle | null;
  diffFromPrevious: Record<RelationshipAxis, number> | null;
  topActions: Array<{ axis: RelationshipAxis; score: number; priority: number }>;
  styleGuideVersion: string | null;
  generatedAt: string;
  fixtureKey: DemoFixtureKey | null;
};

const COST_FACTOR_LOOKUP: Record<RelationshipAxis, number> = {
  access: 0.4,
  engagement: 0.7,
  learning: 0.8,
  stewardship: 0.6,
  evidence: 0.5,
};

function deriveTopActions(
  result: RelationshipScoreResult
): Array<{ axis: RelationshipAxis; score: number; priority: number }> {
  const items = (Object.keys(result.axes) as RelationshipAxis[]).map((axis) => {
    const sc = result.axes[axis].score;
    const gap = (20 - sc) / 20;
    const cost = COST_FACTOR_LOOKUP[axis];
    const headroom = sc === 0 ? 0.5 : sc === 10 ? 1.0 : 0;
    const priority = gap * 0.5 + cost * 0.3 + headroom * 0.2;
    return { axis, score: sc, priority };
  });
  return items
    .filter((it) => it.score < 20)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);
}

export type GetSnapshotOptions = {
  placeId?: string;
  demoKey?: string | null; // ?demo=urban_park
  lang: SiteLang;
  periodEnd?: Date;
  periodWindowDays?: number; // default 90
  generateNarrative?: boolean;
  persist?: boolean; // default true (live), false (demo)
};

const DEFAULT_WINDOW_DAYS = 365;

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function shiftDays(value: Date, days: number): Date {
  const d = new Date(value);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function deriveDiff(
  current: RelationshipScoreResult,
  previous: { axis_scores: unknown } | null
): Record<RelationshipAxis, number> | null {
  if (!previous || !previous.axis_scores || typeof previous.axis_scores !== "object") {
    return null;
  }
  const prev = previous.axis_scores as Record<string, { score?: number }>;
  const diff = {} as Record<RelationshipAxis, number>;
  for (const axis of RELATIONSHIP_AXES) {
    const prevScore = Number(prev[axis]?.score ?? 0);
    diff[axis] = current.axes[axis].score - prevScore;
  }
  return diff;
}

async function loadPreviousSnapshot(
  placeId: string,
  beforeDate: Date,
  calcVersion: string
): Promise<{ axis_scores: unknown } | null> {
  try {
    const pool = getPool();
    const result = await pool.query<{ axis_scores: unknown }>(
      `SELECT axis_scores
         FROM relationship_score_snapshots
        WHERE place_id = $1
          AND period_end < $2
          AND calc_version = $3
        ORDER BY period_end DESC
        LIMIT 1`,
      [placeId, beforeDate, calcVersion]
    );
    return result.rows[0] ?? null;
  } catch (error) {
    console.warn("[relationshipScoreSnapshot] previous snapshot lookup failed", error);
    return null;
  }
}

async function persistSnapshot(
  placeId: string,
  periodStart: Date,
  periodEnd: Date,
  result: RelationshipScoreResult,
  inputs: RelationshipScoreInputs,
  narrative: NarrativeBundle | null
): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO relationship_score_snapshots (
          snapshot_id, place_id, period_start, period_end, total_score,
          axis_scores, inputs, calc_version, claims_style_guide_version,
          narrative, narrative_model, narrative_validated_at, narrative_fallback_used
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10::jsonb,$11,$12,$13)
       ON CONFLICT (place_id, period_end, calc_version) DO UPDATE
         SET total_score = EXCLUDED.total_score,
             axis_scores = EXCLUDED.axis_scores,
             inputs = EXCLUDED.inputs,
             claims_style_guide_version = EXCLUDED.claims_style_guide_version,
             narrative = EXCLUDED.narrative,
             narrative_model = EXCLUDED.narrative_model,
             narrative_validated_at = EXCLUDED.narrative_validated_at,
             narrative_fallback_used = EXCLUDED.narrative_fallback_used`,
      [
        randomUUID(),
        placeId,
        periodStart,
        periodEnd,
        result.totalScore,
        JSON.stringify(result.axes),
        JSON.stringify(inputs),
        result.calcVersion,
        narrative?.styleGuideVersion ?? null,
        narrative ? JSON.stringify({
          nextActionText: narrative.nextActionText,
          summaryCard: narrative.summaryCard,
          seasonalNote: narrative.seasonalNote,
          fallbackUsed: narrative.fallbackUsed,
          softWarnings: narrative.validation.softWarnings,
          hardViolations: narrative.validation.hardViolations,
          inputTokens: narrative.inputTokens,
          outputTokens: narrative.outputTokens,
        }) : null,
        narrative?.model ?? null,
        narrative ? new Date() : null,
        narrative?.fallbackUsed ?? false,
      ]
    );
  } catch (error) {
    console.warn("[relationshipScoreSnapshot] persist failed", error);
  }
}

async function loadPlaceMeta(
  placeId: string
): Promise<{ placeName: string | null; industry: string | null; localityLabel: string | null }> {
  try {
    const pool = getPool();
    const result = await pool.query<{
      canonical_name: string | null;
      industry: string | null;
      locality_label: string | null;
    }>(
      `SELECT canonical_name, metadata->>'industry' AS industry, locality_label
         FROM places WHERE place_id = $1`,
      [placeId]
    );
    const row = result.rows[0];
    return {
      placeName: row?.canonical_name ?? null,
      industry: row?.industry ?? null,
      localityLabel: row?.locality_label ?? null,
    };
  } catch (error) {
    console.warn("[relationshipScoreSnapshot] place meta lookup failed", error);
    return { placeName: null, industry: null, localityLabel: null };
  }
}

// legacy_site_id (e.g. "ikan_hq") から place_id を解決する
export async function resolvePlaceIdByLegacy(legacyKey: string): Promise<string | null> {
  try {
    const pool = getPool();
    const result = await pool.query<{ place_id: string }>(
      `SELECT place_id FROM places
         WHERE legacy_site_id = $1
            OR legacy_place_key = $1
         ORDER BY visit_count DESC NULLS LAST
         LIMIT 1`,
      [legacyKey]
    );
    return result.rows[0]?.place_id ?? null;
  } catch (error) {
    console.warn("[relationshipScoreSnapshot] legacy place lookup failed", error);
    return null;
  }
}

export async function getRelationshipScoreSnapshot(
  options: GetSnapshotOptions
): Promise<RelationshipScoreSnapshot> {
  const lang = options.lang;
  const periodEnd = options.periodEnd ?? new Date();
  const windowDays = options.periodWindowDays ?? DEFAULT_WINDOW_DAYS;
  const periodStart = shiftDays(periodEnd, -windowDays);

  const wantNarrative = options.generateNarrative ?? false;
  const config = loadConfig();
  const apiKey = config.deepseekApiKey;

  // Demo path: fixture から計算、DB 触らない
  if (isDemoFixtureKey(options.demoKey)) {
    const fx = DEMO_FIXTURES[options.demoKey as DemoFixtureKey];
    const result = calculateRelationshipScore(fx.inputs);
    const narrative = wantNarrative
      ? await generateNarrative(result, { lang, industry: fx.industry, placeName: fx.placeName }, { apiKey })
      : null;
    return {
      source: "demo",
      placeId: `demo:${fx.key}`,
      placeName: fx.placeName,
      industry: fx.industry,
      localityLabel: null,
      periodStart: isoDate(periodStart),
      periodEnd: isoDate(periodEnd),
      score: result,
      inputs: fx.inputs,
      narrative,
      diffFromPrevious: null,
      topActions: deriveTopActions(result),
      styleGuideVersion: narrative?.styleGuideVersion ?? null,
      generatedAt: new Date().toISOString(),
      fixtureKey: fx.key,
    };
  }

  // Live path
  const placeId = options.placeId;
  if (!placeId) {
    throw new Error("relationshipScoreSnapshot: placeId or demoKey is required");
  }

  const [inputs, placeMeta, previous] = await Promise.all([
    loadRelationshipScoreInputs({ placeId, periodStart, periodEnd }),
    loadPlaceMeta(placeId),
    loadPreviousSnapshot(placeId, periodStart, RELATIONSHIP_SCORE_CALC_VERSION),
  ]);

  const result = calculateRelationshipScore(inputs);
  const diff = deriveDiff(result, previous);

  const narrative = wantNarrative
    ? await generateNarrative(
        result,
        { lang, industry: placeMeta.industry ?? undefined, placeName: placeMeta.placeName ?? undefined },
        { apiKey }
      )
    : null;

  if (options.persist !== false) {
    await persistSnapshot(placeId, periodStart, periodEnd, result, inputs, narrative);
  }

  return {
    source: "live",
    placeId,
    placeName: placeMeta.placeName,
    industry: placeMeta.industry,
    localityLabel: placeMeta.localityLabel,
    periodStart: isoDate(periodStart),
    periodEnd: isoDate(periodEnd),
    score: result,
    inputs,
    narrative,
    diffFromPrevious: diff,
    topActions: deriveTopActions(result),
    styleGuideVersion: narrative?.styleGuideVersion ?? null,
    generatedAt: new Date().toISOString(),
    fixtureKey: null,
  };
}
