import { createHash } from "node:crypto";
import { getPool } from "../db.js";
import type { GuideHypothesisEvalItem, GuideHypothesisEvalLabel } from "./guideHypothesisEvalSet.js";
import { loadGuideHypothesisEvalItems } from "./guideHypothesisEvalSet.js";

export type GuideHypothesisPromptImprovementType = "keep_pattern" | "rewrite_pattern" | "guardrail";

export type GuideHypothesisPromptImprovement = {
  sourceKey: string;
  improvementType: GuideHypothesisPromptImprovementType;
  label: GuideHypothesisEvalLabel | "mixed";
  claimType: string;
  trigger: string;
  recommendation: string;
  promptPatch: string;
  evidence: Record<string, unknown>;
  supportCount: number;
};

export type GuideHypothesisPromptImprovementQueueItem = {
  queueId: string;
  claimType: string;
  trigger: string;
  wrongCount: number;
  thresholdCount: number;
  queueStatus: "open" | "in_review" | "resolved" | "dismissed";
  improvementIds: string[];
  evidence: Record<string, unknown>;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
};

type ImprovementRow = {
  improvement_id: string;
  source_key: string;
  improvement_type: GuideHypothesisPromptImprovementType;
  label: GuideHypothesisEvalLabel | "mixed";
  claim_type: string;
  trigger: string;
  recommendation: string;
  prompt_patch: string;
  evidence: Record<string, unknown>;
  support_count: number | string;
  review_status: "auto" | "needs_review" | "reviewed" | "rejected";
  generated_at: string;
};

type QueueRow = {
  queue_id: string;
  claim_type: string;
  trigger: string;
  wrong_count: number | string;
  threshold_count: number | string;
  queue_status: GuideHypothesisPromptImprovementQueueItem["queueStatus"];
  improvement_ids: unknown;
  evidence: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
};

export type GuideHypothesisPromptImprovementRecord = GuideHypothesisPromptImprovement & {
  improvementId: string;
  reviewStatus: ImprovementRow["review_status"];
  generatedAt: string;
};

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function stableKey(parts: string[]): string {
  return createHash("sha256").update(parts.join(":")).digest("hex").slice(0, 24);
}

function topValues(values: string[], limit = 5): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    .slice(0, limit)
    .map(([value]) => value);
}

function groupBy<T>(items: T[], keyFor: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return groups;
}

function compactExamples(items: GuideHypothesisEvalItem[]): Array<Record<string, unknown>> {
  return items.slice(0, 8).map((item) => ({
    interactionId: item.interactionId,
    hypothesisId: item.hypothesisId,
    meshKey: item.meshKey,
    hypothesisText: item.hypothesisText,
    nextSamplingProtocol: item.nextSamplingProtocol,
    missingData: item.missingData,
    biasWarnings: item.biasWarnings,
  }));
}

function helpfulPattern(claimType: string, items: GuideHypothesisEvalItem[]): GuideHypothesisPromptImprovement {
  const missingData = topValues(items.flatMap((item) => item.missingData));
  const featureNames = topValues(items.flatMap((item) => item.guideContext.detectedFeatureNames));
  const sourceKey = `guide-hypothesis-improvement:${stableKey(["helpful", claimType, ...missingData, ...featureNames])}`;
  return {
    sourceKey,
    improvementType: "keep_pattern",
    label: "helpful",
    claimType,
    trigger: "helpful_feedback_cluster",
    recommendation: `${claimType} の次回観察指示では、現地手がかりを残したまま不足データを具体的な行動に変換する表現が役立っている。`,
    promptPatch: [
      `When claim_type is ${claimType}, preserve concrete next-sampling steps that name time, place scope, target taxa scope, and non-detection recording.`,
      "Keep the tone as a hypothesis. Do not convert helpful feedback into ecological evidence.",
      missingData.length ? `Common missing_data to keep visible: ${missingData.join(", ")}.` : "",
    ].filter(Boolean).join("\n"),
    evidence: {
      helpfulCount: items.length,
      commonMissingData: missingData,
      commonDetectedFeatures: featureNames,
      examples: compactExamples(items),
      doNotUseAsEcologicalEvidence: true,
    },
    supportCount: items.length,
  };
}

function wrongPattern(claimType: string, items: GuideHypothesisEvalItem[]): GuideHypothesisPromptImprovement {
  const missingData = topValues(items.flatMap((item) => item.missingData));
  const warnings = topValues(items.flatMap((item) => item.biasWarnings));
  const sourceKey = `guide-hypothesis-improvement:${stableKey(["wrong", claimType, ...missingData, ...warnings])}`;
  return {
    sourceKey,
    improvementType: "rewrite_pattern",
    label: "wrong",
    claimType,
    trigger: "wrong_feedback_cluster",
    recommendation: `${claimType} の仮説で wrong が出ているため、断定調・広すぎる観察指示・不足データの曖昧化を避け、検証に必要な記録項目を先に出す。`,
    promptPatch: [
      `When claim_type is ${claimType} and similar feedback is wrong, rewrite the next_sampling_protocol before surfacing it.`,
      "Make the protocol narrower: same mesh, explicit duration, target_taxa_scope, complete_checklist_flag, occurrence_status=absent when not found.",
      "If evidence is AI-only or opportunistic, say that the claim is a candidate and requires repeat or human-reviewed evidence.",
      missingData.length ? `Prioritize missing_data: ${missingData.join(", ")}.` : "",
      warnings.length ? `Keep bias warnings visible: ${warnings.join(", ")}.` : "",
    ].filter(Boolean).join("\n"),
    evidence: {
      wrongCount: items.length,
      commonMissingData: missingData,
      commonBiasWarnings: warnings,
      examples: compactExamples(items),
      doNotUseAsEcologicalEvidence: true,
    },
    supportCount: items.length,
  };
}

function globalGuardrail(items: GuideHypothesisEvalItem[]): GuideHypothesisPromptImprovement | null {
  const wrong = items.filter((item) => item.label === "wrong");
  if (wrong.length === 0) return null;
  const warnings = topValues(wrong.flatMap((item) => item.biasWarnings));
  const missingData = topValues(wrong.flatMap((item) => item.missingData));
  return {
    sourceKey: `guide-hypothesis-improvement:${stableKey(["guardrail", ...warnings, ...missingData])}`,
    improvementType: "guardrail",
    label: "mixed",
    claimType: "",
    trigger: "feedback_guardrail",
    recommendation: "helpful/wrong は地域仮説の真偽ではなく、次回観察指示の評価として扱う。wrong がある場合は、断言を弱めて不足データを行動プロトコルに変換する。",
    promptPatch: [
      "Never treat guide_interactions helpful/wrong as ecological evidence.",
      "Use helpful/wrong only to improve next_sampling_protocol wording and prioritization.",
      "For trend, absence, rarity, or conservation-priority claims, require effort, repeat visits, explicit non-detection, and human review before assertive wording.",
    ].join("\n"),
    evidence: {
      wrongCount: wrong.length,
      totalFeedbackCount: items.length,
      commonMissingData: missingData,
      commonBiasWarnings: warnings,
      examples: compactExamples(wrong),
      doNotUseAsEcologicalEvidence: true,
    },
    supportCount: wrong.length,
  };
}

export function buildGuideHypothesisPromptImprovements(items: GuideHypothesisEvalItem[]): GuideHypothesisPromptImprovement[] {
  const improvements: GuideHypothesisPromptImprovement[] = [];
  const helpfulByClaim = groupBy(items.filter((item) => item.label === "helpful"), (item) => item.claimType || "unknown");
  for (const [claimType, group] of helpfulByClaim) {
    improvements.push(helpfulPattern(claimType, group));
  }
  const wrongByClaim = groupBy(items.filter((item) => item.label === "wrong"), (item) => item.claimType || "unknown");
  for (const [claimType, group] of wrongByClaim) {
    improvements.push(wrongPattern(claimType, group));
  }
  const guardrail = globalGuardrail(items);
  if (guardrail) improvements.push(guardrail);
  return improvements.sort((a, b) => b.supportCount - a.supportCount || a.sourceKey.localeCompare(b.sourceKey));
}

export function buildWrongFeedbackQueueCandidates(
  items: GuideHypothesisEvalItem[],
  thresholdCount = 3,
): Array<{ claimType: string; wrongCount: number; thresholdCount: number; evidence: Record<string, unknown> }> {
  const wrongByClaim = groupBy(items.filter((item) => item.label === "wrong"), (item) => item.claimType || "unknown");
  const candidates: Array<{ claimType: string; wrongCount: number; thresholdCount: number; evidence: Record<string, unknown> }> = [];
  for (const [claimType, group] of wrongByClaim) {
    if (group.length < thresholdCount) continue;
    candidates.push({
      claimType,
      wrongCount: group.length,
      thresholdCount,
      evidence: {
        commonMissingData: topValues(group.flatMap((item) => item.missingData)),
        commonBiasWarnings: topValues(group.flatMap((item) => item.biasWarnings)),
        exampleHypothesisIds: group.map((item) => item.hypothesisId).filter(Boolean).slice(0, 12),
        examples: compactExamples(group),
        doNotUseAsEcologicalEvidence: true,
      },
    });
  }
  return candidates.sort((a, b) => b.wrongCount - a.wrongCount || a.claimType.localeCompare(b.claimType));
}

export async function upsertGuideHypothesisPromptImprovements(
  improvements: GuideHypothesisPromptImprovement[],
  options: { reviewThreshold?: number } = {},
): Promise<number> {
  let written = 0;
  const reviewThreshold = Math.max(1, Math.round(options.reviewThreshold ?? 3));
  for (const improvement of improvements) {
    await getPool().query(
      `insert into guide_hypothesis_prompt_improvements (
          source_key,
          improvement_type,
          label,
          claim_type,
          trigger,
          recommendation,
          prompt_patch,
          evidence,
          support_count,
          review_status,
          generated_at,
          updated_at
       ) values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8::jsonb,
          $9,
          case when $10::boolean then 'needs_review' else 'auto' end,
          now(),
          now()
       )
       on conflict (source_key) do update set
          recommendation = excluded.recommendation,
          prompt_patch = excluded.prompt_patch,
          evidence = excluded.evidence,
          support_count = excluded.support_count,
          review_status = case
            when guide_hypothesis_prompt_improvements.review_status in ('reviewed', 'rejected') then guide_hypothesis_prompt_improvements.review_status
            when excluded.review_status = 'needs_review' then 'needs_review'
            else guide_hypothesis_prompt_improvements.review_status
          end,
          generated_at = now(),
          updated_at = now()`,
      [
        improvement.sourceKey,
        improvement.improvementType,
        improvement.label,
        improvement.claimType,
        improvement.trigger,
        improvement.recommendation,
        improvement.promptPatch,
        JSON.stringify(improvement.evidence),
        improvement.supportCount,
        improvement.improvementType === "rewrite_pattern" && improvement.supportCount >= reviewThreshold,
      ],
    );
    written += 1;
  }
  return written;
}

export async function upsertWrongFeedbackQueue(
  candidates: Array<{ claimType: string; wrongCount: number; thresholdCount: number; evidence: Record<string, unknown> }>,
): Promise<number> {
  let written = 0;
  for (const candidate of candidates) {
    const improvementIds = await getPool().query<{ improvement_id: string }>(
      `select improvement_id::text
         from guide_hypothesis_prompt_improvements
        where claim_type = $1
          and label = 'wrong'
          and review_status <> 'rejected'
        order by support_count desc, generated_at desc
        limit 10`,
      [candidate.claimType],
    );
    await getPool().query(
      `insert into guide_hypothesis_prompt_improvement_queue (
          claim_type,
          trigger,
          wrong_count,
          threshold_count,
          queue_status,
          improvement_ids,
          evidence,
          first_seen_at,
          last_seen_at,
          updated_at
       ) values (
          $1,
          'wrong_feedback_threshold',
          $2,
          $3,
          'open',
          $4::jsonb,
          $5::jsonb,
          now(),
          now(),
          now()
       )
       on conflict (claim_type, trigger) do update set
          wrong_count = excluded.wrong_count,
          threshold_count = excluded.threshold_count,
          improvement_ids = excluded.improvement_ids,
          evidence = excluded.evidence,
          queue_status = case
            when guide_hypothesis_prompt_improvement_queue.queue_status in ('resolved', 'dismissed')
             and excluded.wrong_count > guide_hypothesis_prompt_improvement_queue.wrong_count
              then 'open'
            else guide_hypothesis_prompt_improvement_queue.queue_status
          end,
          last_seen_at = now(),
          updated_at = now()`,
      [
        candidate.claimType,
        candidate.wrongCount,
        candidate.thresholdCount,
        JSON.stringify(improvementIds.rows.map((row) => row.improvement_id)),
        JSON.stringify(candidate.evidence),
      ],
    );
    written += 1;
  }
  return written;
}

export async function generateAndStoreGuideHypothesisPromptImprovements(limit = 1000): Promise<{
  evalItems: number;
  generated: number;
  written: number;
  queued: number;
}> {
  const items = await loadGuideHypothesisEvalItems(limit);
  const improvements = buildGuideHypothesisPromptImprovements(items);
  const written = await upsertGuideHypothesisPromptImprovements(improvements);
  const queueCandidates = buildWrongFeedbackQueueCandidates(items);
  const queued = await upsertWrongFeedbackQueue(queueCandidates);
  return { evalItems: items.length, generated: improvements.length, written, queued };
}

export async function listGuideHypothesisPromptImprovements(
  limit = 10,
  options: { reviewStatus?: "auto" | "needs_review" | "reviewed" | "rejected" | "any" } = {},
): Promise<GuideHypothesisPromptImprovementRecord[]> {
  const values: unknown[] = [];
  const clauses = [];
  if (options.reviewStatus && options.reviewStatus !== "any") {
    values.push(options.reviewStatus);
    clauses.push(`review_status = $${values.length}`);
  } else {
    clauses.push("review_status <> 'rejected'");
  }
  values.push(Math.max(1, Math.min(50, Math.round(limit))));
  const result = await getPool().query<ImprovementRow>(
    `select improvement_id::text,
            source_key,
            improvement_type,
            label,
            claim_type,
            trigger,
            recommendation,
            prompt_patch,
            evidence,
            support_count,
            review_status,
            generated_at::text
       from guide_hypothesis_prompt_improvements
      where ${clauses.join(" and ")}
      order by support_count desc, generated_at desc
      limit $${values.length}`,
    values,
  );
  return result.rows.map((row) => ({
    improvementId: row.improvement_id,
    sourceKey: row.source_key,
    improvementType: row.improvement_type,
    label: row.label,
    claimType: row.claim_type,
    trigger: row.trigger,
    recommendation: row.recommendation,
    promptPatch: row.prompt_patch,
    evidence: row.evidence ?? {},
    supportCount: Number(row.support_count ?? 0),
    reviewStatus: row.review_status,
    generatedAt: row.generated_at,
  }));
}

export async function updateGuideHypothesisPromptImprovementReviewStatus(
  improvementId: string,
  reviewStatus: "auto" | "needs_review" | "reviewed" | "rejected",
): Promise<boolean> {
  const result = await getPool().query(
    `update guide_hypothesis_prompt_improvements
        set review_status = $2,
            updated_at = now()
      where improvement_id = $1`,
    [improvementId, reviewStatus],
  );
  return ((result as unknown as { rowCount?: number | null }).rowCount ?? 0) > 0;
}

export async function listGuideHypothesisPromptImprovementQueue(limit = 20): Promise<GuideHypothesisPromptImprovementQueueItem[]> {
  const result = await getPool().query<QueueRow>(
    `select queue_id::text,
            claim_type,
            trigger,
            wrong_count,
            threshold_count,
            queue_status,
            improvement_ids,
            evidence,
            first_seen_at::text,
            last_seen_at::text,
            resolved_at::text
       from guide_hypothesis_prompt_improvement_queue
      where queue_status in ('open', 'in_review')
      order by wrong_count desc, last_seen_at desc
      limit $1`,
    [Math.max(1, Math.min(100, Math.round(limit)))],
  );
  return result.rows.map((row) => ({
    queueId: row.queue_id,
    claimType: row.claim_type,
    trigger: row.trigger,
    wrongCount: Number(row.wrong_count ?? 0),
    thresholdCount: Number(row.threshold_count ?? 0),
    queueStatus: row.queue_status,
    improvementIds: normalizeStringArray(row.improvement_ids),
    evidence: row.evidence ?? {},
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    resolvedAt: row.resolved_at,
  }));
}

export async function updateGuideHypothesisPromptImprovementQueueStatus(
  queueId: string,
  queueStatus: "open" | "in_review" | "resolved" | "dismissed",
): Promise<boolean> {
  const result = await getPool().query(
    `update guide_hypothesis_prompt_improvement_queue
        set queue_status = $2,
            resolved_at = case when $2 in ('resolved', 'dismissed') then now() else null end,
            updated_at = now()
      where queue_id = $1`,
    [queueId, queueStatus],
  );
  return ((result as unknown as { rowCount?: number | null }).rowCount ?? 0) > 0;
}
