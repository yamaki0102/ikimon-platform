import type { Pool, PoolClient } from "pg";
import { getPool } from "../db.js";
import type { ObservationPackage, ObservationPackageClaimRef } from "./observationPackage.js";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export type NavigableBranch =
  | "observation_quality"
  | "identification_granularity"
  | "evidence_tier_review"
  | "knowledge_claims"
  | "feedback_contract"
  | "mypage_learning"
  | "enterprise_reporting"
  | "privacy_claim_boundary"
  | "freshness_sources"
  | "evaluation";

export type BranchClaimRetrievalInput = {
  branch: NavigableBranch;
  observationPackage: ObservationPackage;
  limit?: number;
};

const BRANCH_TARGET_OUTPUTS: Partial<Record<NavigableBranch, string[]>> = {
  feedback_contract: ["observation_feedback"],
  knowledge_claims: ["observation_feedback", "mypage_weekly", "site_report", "enterprise_report"],
  mypage_learning: ["mypage_weekly", "observation_feedback"],
  enterprise_reporting: ["site_report", "enterprise_report"],
  privacy_claim_boundary: ["observation_feedback", "site_report", "enterprise_report"],
};

function targetOutputsForBranch(branch: NavigableBranch): string[] {
  return BRANCH_TARGET_OUTPUTS[branch] ?? ["observation_feedback"];
}

function textArray(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function inferSeasonBucket(observedAt: string): string {
  const date = new Date(observedAt);
  const month = Number.isFinite(date.getTime()) ? date.getMonth() + 1 : 0;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  if (month === 12 || month === 1 || month === 2) return "winter";
  return "";
}

function scopeMatchFor(row: {
  scientific_name: string;
  taxon_name: string;
  taxon_group: string;
  place_region: string;
  season_bucket: string;
  risk_lane: string;
}, pkg: ObservationPackage): string {
  const occurrences = pkg.occurrences;
  const scientificNames = new Set(occurrences.map((o) => (o.scientificName ?? "").toLowerCase()).filter(Boolean));
  const vernacularNames = new Set(occurrences.map((o) => (o.vernacularName ?? "").toLowerCase()).filter(Boolean));
  if (row.scientific_name && scientificNames.has(row.scientific_name.toLowerCase())) return "scientific_name";
  if (row.taxon_name && vernacularNames.has(row.taxon_name.toLowerCase())) return "taxon_name";
  if (row.risk_lane !== "normal" && occurrences.some((o) => o.riskLane === row.risk_lane)) return "risk_lane";
  if (row.place_region && [pkg.visit.observedPrefecture, pkg.visit.observedMunicipality].includes(row.place_region)) return "place_region";
  if (row.season_bucket && row.season_bucket === inferSeasonBucket(pkg.visit.observedAt)) return "season_bucket";
  if (row.taxon_group === "general") return "general";
  return "broad";
}

export async function retrieveBranchKnowledgeClaims(
  input: BranchClaimRetrievalInput,
  queryable: Queryable = getPool(),
): Promise<ObservationPackageClaimRef[]> {
  const pkg = input.observationPackage;
  const targetOutputs = targetOutputsForBranch(input.branch);
  const occurrences = pkg.occurrences;
  const scientificNames = textArray(occurrences.map((o) => o.scientificName));
  const taxonNames = textArray(occurrences.map((o) => o.vernacularName));
  const taxonGroups = textArray(occurrences.map((o) => String(o.sourcePayload.taxon_group ?? o.sourcePayload.taxonGroup ?? "")));
  const riskLanes = textArray(occurrences.map((o) => o.riskLane));
  const placeRegions = textArray([pkg.visit.observedPrefecture, pkg.visit.observedMunicipality]);
  const seasonBucket = inferSeasonBucket(pkg.visit.observedAt);
  const limit = Math.max(1, Math.min(20, input.limit ?? 8));

  const result = await queryable.query<{
    claim_id: string;
    claim_type: string;
    claim_text: string;
    taxon_name: string;
    scientific_name: string;
    taxon_group: string;
    place_region: string;
    season_bucket: string;
    habitat: string;
    evidence_type: string;
    risk_lane: string;
    target_outputs: unknown;
    citation_span: string;
    confidence: string | number;
    human_review_status: string;
    use_in_feedback: boolean;
  }>(
    `SELECT claim_id::text AS claim_id,
            claim_type,
            claim_text,
            taxon_name,
            scientific_name,
            taxon_group,
            place_region,
            season_bucket,
            habitat,
            evidence_type,
            risk_lane,
            target_outputs,
            citation_span,
            confidence::text AS confidence,
            human_review_status,
            use_in_feedback
       FROM knowledge_claims
      WHERE human_review_status = 'ready'
        AND use_in_feedback = TRUE
        AND target_outputs ?| $1::text[]
        AND (
          lower(scientific_name) = ANY($2::text[])
          OR lower(taxon_name) = ANY($3::text[])
          OR lower(taxon_group) = ANY($4::text[])
          OR taxon_group = 'general'
          OR risk_lane = ANY($5::text[])
          OR place_region = ANY($6::text[])
          OR season_bucket = $7
        )
      ORDER BY
        CASE
          WHEN lower(scientific_name) = ANY($2::text[]) THEN 0
          WHEN lower(taxon_name) = ANY($3::text[]) THEN 1
          WHEN risk_lane = ANY($5::text[]) AND risk_lane <> 'normal' THEN 2
          WHEN place_region = ANY($6::text[]) THEN 3
          WHEN season_bucket = $7 AND season_bucket <> '' THEN 4
          WHEN taxon_group = 'general' THEN 6
          ELSE 8
        END,
        confidence DESC,
        updated_at DESC
      LIMIT $8`,
    [
      targetOutputs,
      scientificNames.map((value) => value.toLowerCase()),
      taxonNames.map((value) => value.toLowerCase()),
      taxonGroups.map((value) => value.toLowerCase()),
      riskLanes,
      placeRegions,
      seasonBucket,
      limit,
    ],
  );

  return result.rows.map((row) => ({
    claimId: row.claim_id,
    claimType: row.claim_type,
    claimText: row.claim_text,
    taxonName: row.taxon_name,
    scientificName: row.scientific_name,
    taxonGroup: row.taxon_group,
    placeRegion: row.place_region,
    seasonBucket: row.season_bucket,
    habitat: row.habitat,
    evidenceType: row.evidence_type,
    riskLane: row.risk_lane,
    targetOutputs: Array.isArray(row.target_outputs) ? row.target_outputs.map(String).filter(Boolean) : [],
    citationSpan: row.citation_span,
    confidence: Number(row.confidence ?? 0),
    humanReviewStatus: row.human_review_status,
    useInFeedback: row.use_in_feedback,
    scopeMatch: scopeMatchFor(row, pkg),
  }));
}

export function formatClaimRefsForPrompt(claims: ObservationPackageClaimRef[]): string {
  if (claims.length === 0) return "No reviewed knowledge_claims are available for this ObservationPackage.";
  return claims
    .slice(0, 8)
    .map((claim) => [
      `- claim_id=${claim.claimId}`,
      `type=${claim.claimType}`,
      `scope=${claim.scopeMatch}`,
      `risk=${claim.riskLane}`,
      `text=${claim.claimText}`,
      claim.citationSpan ? `citation_span=${claim.citationSpan}` : "",
    ].filter(Boolean).join(" | "))
    .join("\n");
}
