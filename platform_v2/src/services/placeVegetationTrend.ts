import { getPool } from "../db.js";
import {
  normalizeAreaInferenceFromDb,
  normalizeManagementActionCandidatesFromRaw,
  pickParsedFromRawJson,
  type AreaInference,
  type ManagementActionCandidate,
} from "./observationAiAssessment.js";
import type { PlaceManagementPolicy } from "./placeManagementPolicy.js";

export type PlaceVegetationTrendInput = {
  visitId: string;
  observedAt: string;
  managementActionCandidates: ManagementActionCandidate[];
  areaInference: AreaInference | null;
};

export type PlaceVegetationTrend = {
  status: "increasing" | "suppressed" | "stable" | "insufficient";
  priority: "high" | "medium" | "low";
  recordCount: number;
  recentRecordCount: number;
  recentScore: number;
  previousScore: number;
  stewardshipActionCount: number;
  headline: string;
  summary: string;
  evidence: string[];
  nextActions: string[];
};

const VEGETATION_TEXT = /草|雑草|つる|蔓|グランドカバー|裸地|踏圧|刈|剪定|外来|invasive|mowing|bare|trampling|cleanup/i;

function actionSeverity(candidate: ManagementActionCandidate): number {
  switch (candidate.actionKind) {
    case "invasive_removal": return 3;
    case "mowing":
    case "bare_ground":
    case "trampling":
    case "cleanup": return 2;
    case "pruning": return 1;
    default: return VEGETATION_TEXT.test(`${candidate.label} ${candidate.why}`) ? 1 : 0;
  }
}

function areaSeverity(area: AreaInference | null): number {
  if (!area) return 0;
  const text = [
    ...area.vegetationStructureCandidates,
    ...area.humanInfluenceCandidates,
    ...area.managementHintCandidates,
  ].map((candidate) => `${candidate.label} ${candidate.why}`).join(" ");
  if (/外来|繁茂|覆|つる|蔓|地下茎/i.test(text)) return 2;
  if (VEGETATION_TEXT.test(text)) return 1;
  return 0;
}

function recordScore(record: PlaceVegetationTrendInput): number {
  return Math.max(
    areaSeverity(record.areaInference),
    ...record.managementActionCandidates.map(actionSeverity),
    0,
  );
}

function avg(score: number, count: number): number {
  return count > 0 ? score / count : 0;
}

export function summarizePlaceVegetationTrend(
  records: PlaceVegetationTrendInput[],
  stewardshipActionCount: number,
  policy: PlaceManagementPolicy | null = null,
  now = new Date(),
): PlaceVegetationTrend {
  const recentCutoff = now.getTime() - 45 * 24 * 60 * 60 * 1000;
  const recent = records.filter((record) => new Date(record.observedAt).getTime() >= recentCutoff);
  const previous = records.filter((record) => new Date(record.observedAt).getTime() < recentCutoff);
  const recentScore = recent.reduce((sum, record) => sum + recordScore(record), 0);
  const previousScore = previous.reduce((sum, record) => sum + recordScore(record), 0);
  const recentAvg = avg(recentScore, recent.length);
  const previousAvg = avg(previousScore, previous.length);
  const policyRaisesPriority = policy?.managementGoal === "keep_clear" || policy?.managementGoal === "invasive_watch" || policy?.invasiveResponse === "controlled_removal";

  let status: PlaceVegetationTrend["status"] = "insufficient";
  if (records.length >= 2 && recent.length > 0) {
    if (stewardshipActionCount > 0 && previous.length > 0 && recentAvg <= previousAvg) status = "suppressed";
    else if (recentScore >= 3 && (previous.length === 0 || recentAvg >= previousAvg + 0.75 || recent.length > previous.length)) status = "increasing";
    else if (recentScore > 0 || previousScore > 0) status = "stable";
  }

  const priority: PlaceVegetationTrend["priority"] =
    status === "increasing" && (recentScore >= 4 || policyRaisesPriority) ? "high"
    : status === "increasing" || status === "suppressed" || (status === "stable" && policyRaisesPriority) ? "medium"
    : "low";

  const headline =
    status === "increasing" ? "同じ場所で草の圧が上がっています"
    : status === "suppressed" ? "手入れ後は抑えられている可能性があります"
    : status === "stable" ? "今は急いで全面作業する材料は弱めです"
    : "連続記録が足りず、優先順位は仮置きです";
  const summary =
    status === "increasing" ? "直近の記録で、草刈り・裸地・踏圧・外来種対応につながるシグナルが増えています。"
    : status === "suppressed" ? "同じ場所で手入れ記録があり、直近の草管理シグナルは抑えられている可能性があります。"
    : status === "stable" ? "草管理の材料はありますが、増加とは言い切れません。方針に合わせて部分管理で十分です。"
    : "この場所の過去記録が少ないため、今回の写真だけで優先度を強く出しません。";
  const evidence = [
    `同じ場所の記録: ${records.length}件`,
    `直近45日の草管理シグナル: ${recentScore}`,
    previous.length > 0 ? `それ以前の草管理シグナル: ${previousScore}` : "",
    stewardshipActionCount > 0 ? `直近45日の手入れ記録: ${stewardshipActionCount}件` : "",
  ].filter(Boolean);
  const nextActions =
    status === "increasing" ? ["通路・排水・植栽を邪魔する範囲を先に作業", "同じ角度で次回も撮る", "外来種候補は処分方法を確認"]
    : status === "suppressed" ? ["作業後の同じ角度をもう一度撮る", "残した区画と抑えた区画を分けて見る", "作業記録を観察に紐付ける"]
    : status === "stable" ? ["全面作業より境界だけ整える", "種がつく前の時期だけ確認", "方針に反する場所だけ優先"]
    : ["同じ場所で次回も記録", "作業前後を分けて撮る", "敷地の方針を先に保存"];

  return {
    status,
    priority,
    recordCount: records.length,
    recentRecordCount: recent.length,
    recentScore,
    previousScore,
    stewardshipActionCount,
    headline,
    summary,
    evidence,
    nextActions,
  };
}

export async function getPlaceVegetationTrend(placeId: string | null | undefined, policy: PlaceManagementPolicy | null = null): Promise<PlaceVegetationTrend | null> {
  if (!placeId) return null;
  const pool = getPool();
  const [recordsResult, stewardshipResult] = await Promise.all([
    pool.query<{
      visit_id: string;
      observed_at: string;
      raw_json: unknown;
      area_inference: unknown;
    }>(
      `SELECT v.visit_id, v.observed_at::text, a.raw_json, a.area_inference
         FROM visits v
         JOIN occurrences o ON o.visit_id = v.visit_id
         LEFT JOIN LATERAL (
           SELECT raw_json, area_inference
             FROM observation_ai_assessments a
            WHERE a.occurrence_id = o.occurrence_id
            ORDER BY a.generated_at DESC
            LIMIT 1
         ) a ON true
        WHERE v.place_id = $1
          AND v.observed_at >= NOW() - INTERVAL '180 days'
        ORDER BY v.observed_at DESC
        LIMIT 120`,
      [placeId],
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM stewardship_actions
        WHERE place_id = $1
          AND occurred_at >= NOW() - INTERVAL '45 days'`,
      [placeId],
    ),
  ]);
  const records = recordsResult.rows.map((row) => {
    const areaInference = normalizeAreaInferenceFromDb(row.area_inference);
    const parsed = pickParsedFromRawJson(row.raw_json);
    return {
      visitId: row.visit_id,
      observedAt: row.observed_at,
      areaInference,
      managementActionCandidates: normalizeManagementActionCandidatesFromRaw(
        parsed?.["management_action_candidates"],
        areaInference,
      ),
    };
  });
  return summarizePlaceVegetationTrend(records, Number(stewardshipResult.rows[0]?.count ?? 0), policy);
}
