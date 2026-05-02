import type { Pool, PoolClient } from "pg";
import { createHash } from "node:crypto";
import { getPool } from "../db.js";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export type ObservationPackageVisit = {
  visitId: string;
  legacyObservationId: string | null;
  observedAt: string;
  placeId: string | null;
  locationPrecision: string;
  observedPrefecture: string | null;
  observedMunicipality: string | null;
  effortMinutes: number | null;
  targetTaxaScope: string | null;
  sourceKind: string;
};

export type ObservationPackageOccurrence = {
  occurrenceId: string;
  visitId: string;
  scientificName: string | null;
  vernacularName: string | null;
  taxonRank: string | null;
  confidenceScore: number | null;
  evidenceTier: number | null;
  qualityGrade: string | null;
  riskLane: string;
  safePublicRank: string;
  sourcePayload: Record<string, unknown>;
};

export type ObservationPackageEvidenceAsset = {
  assetId: string;
  blobId: string | null;
  occurrenceId: string | null;
  visitId: string | null;
  mediaType: string;
  mimeType: string | null;
  assetRole: string;
  mediaRole: string;
  capturedAt: string | null;
  sha256: string | null;
  publicUrl: string | null;
};

export type ObservationPackageIdentification = {
  identificationId: string;
  occurrenceId: string;
  actorKind: string;
  actorUserId: string | null;
  proposedName: string;
  proposedRank: string | null;
  confidenceScore: number | null;
  isCurrent: boolean;
  rationale: string;
  similarTaxaRuledOut: string[];
  reviewScope: string | null;
};

export type ObservationPackageAiRun = {
  aiRunId: string;
  visitId: string;
  triggerOccurrenceId: string | null;
  modelProvider: string;
  modelName: string;
  promptVersion: string;
  pipelineVersion: string;
  taxonomyVersion: string;
  knowledgeVersionSet: Record<string, unknown>;
  inputAssetFingerprint: string;
  runStatus: string;
};

export type ObservationPackageClaimRef = {
  claimId: string;
  claimType: string;
  claimText: string;
  taxonName: string;
  scientificName: string;
  taxonGroup: string;
  placeRegion: string;
  seasonBucket: string;
  habitat: string;
  evidenceType: string;
  riskLane: string;
  targetOutputs: string[];
  citationSpan: string;
  confidence: number;
  humanReviewStatus: string;
  useInFeedback: boolean;
  scopeMatch: string;
};

export type ObservationPackageFeedbackPayload = {
  simpleSummary: string;
  safeIdentification: string;
  whyThisRank: string;
  diagnosticFeaturesSeen: string[];
  missingEvidence: string[];
  nextShots: string[];
  claimRefsUsed: string[];
  reviewRoute: string;
  publicClaimLimit: string;
};

export type ObservationPackageReviewState = {
  currentEvidenceTier: number | null;
  tierLabel: string;
  reviewStatus: string;
  reviewPriority: string;
  requiredReviewerScope: string | null;
  blockingIssues: string[];
  publicClaimLimit: string;
};

export type ObservationPackageReportOutput = {
  outputKind: "observation_feedback" | "mypage_weekly" | "site_report" | "event_report" | "enterprise_report";
  outputId: string;
  generatedAt: string;
  claimRefsUsed: string[];
  knowledgeVersionSet: Record<string, unknown>;
  audience: string;
  publicPrivateSurface: string;
};

export type ObservationPackage = {
  packageVersion: "observation_package/v1";
  packageId: string;
  generatedAt: string;
  visit: ObservationPackageVisit;
  occurrences: ObservationPackageOccurrence[];
  evidenceAssets: ObservationPackageEvidenceAsset[];
  identifications: ObservationPackageIdentification[];
  aiRuns: ObservationPackageAiRun[];
  feedbackPayload: ObservationPackageFeedbackPayload | null;
  claimRefs: ObservationPackageClaimRef[];
  reviewState: ObservationPackageReviewState;
  reportOutputs: ObservationPackageReportOutput[];
};

export type BuildObservationPackageInput = {
  visitId?: string;
  occurrenceId?: string;
  legacyObservationId?: string;
  targetOccurrenceId?: string | null;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function asTargetOutputs(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function inferLocationPrecision(row: { point_latitude: number | null; point_longitude: number | null; coordinate_uncertainty_m: string | number | null }): string {
  if (row.point_latitude === null || row.point_longitude === null) return "unknown";
  const uncertainty = toNumber(row.coordinate_uncertainty_m);
  if (uncertainty === null) return "point_unknown_accuracy";
  if (uncertainty <= 30) return "point_high";
  if (uncertainty <= 250) return "point_medium";
  return "coarse";
}

export function inferSafePublicRank(input: {
  taxonRank: string | null;
  evidenceTier: number | null;
  riskLane: string;
}): string {
  const rank = (input.taxonRank ?? "").trim().toLowerCase();
  if (!rank) return "unknown";
  if (input.riskLane === "rare" || input.riskLane === "invasive") {
    return (input.evidenceTier ?? 0) >= 3 ? rank : rank === "species" ? "genus" : rank;
  }
  if (rank === "species" && (input.evidenceTier ?? 0) < 1) return "genus";
  return rank;
}

function inferRiskLane(sourcePayload: Record<string, unknown>): string {
  const raw = String(sourcePayload.risk_lane ?? sourcePayload.riskLane ?? "").trim().toLowerCase();
  if (["rare", "invasive", "normal", "unknown"].includes(raw)) return raw;
  return "normal";
}

function tierLabel(tier: number | null): string {
  if (tier === null) return "unreviewed";
  if (tier >= 4) return "external_evidence";
  if (tier >= 3) return "expert_verified";
  if (tier >= 2) return "community_supported";
  if (tier >= 1.5) return "ai_ecology_checked";
  if (tier >= 1) return "ai_suggestion";
  return "unreviewed";
}

function reviewStateFor(occurrences: ObservationPackageOccurrence[]): ObservationPackageReviewState {
  const target = occurrences[0] ?? null;
  const tier = target?.evidenceTier ?? null;
  const riskLane = target?.riskLane ?? "normal";
  const blockingIssues: string[] = [];
  if (!target) blockingIssues.push("no_occurrence");
  if (target && target.safePublicRank === "unknown") blockingIssues.push("no_safe_rank");
  if (riskLane !== "normal" && (tier ?? 0) < 3) blockingIssues.push(`${riskLane}_requires_scoped_review`);
  return {
    currentEvidenceTier: tier,
    tierLabel: tierLabel(tier),
    reviewStatus: (tier ?? 0) >= 3 ? "verified" : blockingIssues.length > 0 ? "needs_review" : "reviewable",
    reviewPriority: riskLane === "rare" || riskLane === "invasive" ? "high" : "normal",
    requiredReviewerScope: riskLane === "normal" ? null : `${riskLane}:taxon-region`,
    blockingIssues,
    publicClaimLimit: blockingIssues.length > 0 ? "cautious_feedback_only" : "observation_supported",
  };
}

function packageIdFor(visitId: string, targetOccurrenceId: string | null | undefined): string {
  return `obspkg_${createHash("sha1").update(`${visitId}|${targetOccurrenceId ?? ""}`).digest("hex").slice(0, 20)}`;
}

async function resolveVisitId(queryable: Queryable, input: BuildObservationPackageInput): Promise<string | null> {
  if (input.visitId) return input.visitId;
  const key = input.occurrenceId ?? input.legacyObservationId;
  if (!key) return null;
  const result = await queryable.query<{ visit_id: string }>(
    `SELECT visit_id
       FROM visits
      WHERE legacy_observation_id = $1
      UNION
     SELECT visit_id
       FROM occurrences
      WHERE occurrence_id = $1
         OR legacy_observation_id = $1
      LIMIT 1`,
    [key],
  );
  return result.rows[0]?.visit_id ?? null;
}

export async function buildObservationPackage(
  input: BuildObservationPackageInput,
  queryable: Queryable = getPool(),
): Promise<ObservationPackage | null> {
  const visitId = await resolveVisitId(queryable, input);
  if (!visitId) return null;

  const visitResult = await queryable.query<{
    visit_id: string;
    legacy_observation_id: string | null;
    observed_at: string;
    place_id: string | null;
    point_latitude: number | null;
    point_longitude: number | null;
    coordinate_uncertainty_m: string | number | null;
    observed_prefecture: string | null;
    observed_municipality: string | null;
    effort_minutes: string | number | null;
    target_taxa_scope: string | null;
    source_kind: string;
  }>(
    `SELECT visit_id,
            legacy_observation_id,
            observed_at::text AS observed_at,
            place_id,
            point_latitude,
            point_longitude,
            coordinate_uncertainty_m::text AS coordinate_uncertainty_m,
            observed_prefecture,
            observed_municipality,
            effort_minutes::text AS effort_minutes,
            target_taxa_scope,
            source_kind
       FROM visits
      WHERE visit_id = $1
      LIMIT 1`,
    [visitId],
  );
  const visitRow = visitResult.rows[0];
  if (!visitRow) return null;

  const occurrenceRows = await queryable.query<{
    occurrence_id: string;
    visit_id: string;
    scientific_name: string | null;
    vernacular_name: string | null;
    taxon_rank: string | null;
    confidence_score: string | number | null;
    evidence_tier: string | number | null;
    quality_grade: string | null;
    source_payload: unknown;
  }>(
    `SELECT occurrence_id,
            visit_id,
            scientific_name,
            vernacular_name,
            taxon_rank,
            confidence_score::text AS confidence_score,
            evidence_tier::text AS evidence_tier,
            quality_grade,
            source_payload
       FROM occurrences
      WHERE visit_id = $1
      ORDER BY CASE WHEN occurrence_id = $2 THEN 0 ELSE 1 END, subject_index ASC, created_at ASC`,
    [visitId, input.targetOccurrenceId ?? input.occurrenceId ?? ""],
  );

  const occurrences: ObservationPackageOccurrence[] = occurrenceRows.rows.map((row) => {
    const sourcePayload = asObject(row.source_payload);
    const riskLane = inferRiskLane(sourcePayload);
    const evidenceTier = toNumber(row.evidence_tier);
    return {
      occurrenceId: row.occurrence_id,
      visitId: row.visit_id,
      scientificName: row.scientific_name,
      vernacularName: row.vernacular_name,
      taxonRank: row.taxon_rank,
      confidenceScore: toNumber(row.confidence_score),
      evidenceTier,
      qualityGrade: row.quality_grade,
      riskLane,
      safePublicRank: inferSafePublicRank({ taxonRank: row.taxon_rank, evidenceTier, riskLane }),
      sourcePayload,
    };
  });

  const assets = await queryable.query<{
    asset_id: string;
    blob_id: string | null;
    occurrence_id: string | null;
    visit_id: string | null;
    media_type: string | null;
    mime_type: string | null;
    asset_role: string;
    media_role: string | null;
    captured_at: string | null;
    sha256: string | null;
    public_url: string | null;
  }>(
    `SELECT ea.asset_id::text AS asset_id,
            ea.blob_id::text AS blob_id,
            ea.occurrence_id,
            ea.visit_id,
            ab.media_type,
            ab.mime_type,
            ea.asset_role,
            emr.media_role,
            ea.captured_at::text AS captured_at,
            ab.sha256,
            ab.public_url
       FROM evidence_assets ea
       LEFT JOIN asset_blobs ab ON ab.blob_id = ea.blob_id
       LEFT JOIN evidence_asset_media_roles emr ON emr.asset_id = ea.asset_id
      WHERE ea.visit_id = $1
      ORDER BY ea.created_at ASC`,
    [visitId],
  );

  const identifications = await queryable.query<{
    identification_id: string;
    occurrence_id: string;
    actor_kind: string;
    actor_user_id: string | null;
    proposed_name: string;
    proposed_rank: string | null;
    confidence_score: string | number | null;
    is_current: boolean;
    notes: string | null;
    source_payload: unknown;
  }>(
    `SELECT identification_id::text AS identification_id,
            occurrence_id,
            actor_kind,
            actor_user_id,
            proposed_name,
            proposed_rank,
            confidence_score::text AS confidence_score,
            COALESCE(is_current, FALSE) AS is_current,
            notes,
            source_payload
       FROM identifications
      WHERE occurrence_id = ANY($1::text[])
      ORDER BY is_current DESC, created_at DESC`,
    [occurrences.map((o) => o.occurrenceId)],
  );

  const aiRuns = await queryable.query<{
    ai_run_id: string;
    visit_id: string;
    trigger_occurrence_id: string | null;
    model_provider: string;
    model_name: string;
    prompt_version: string;
    pipeline_version: string;
    taxonomy_version: string;
    input_asset_fingerprint: string;
    run_status: string;
    source_payload: unknown;
  }>(
    `SELECT ai_run_id::text AS ai_run_id,
            visit_id,
            trigger_occurrence_id,
            model_provider,
            model_name,
            prompt_version,
            pipeline_version,
            taxonomy_version,
            input_asset_fingerprint,
            run_status,
            source_payload
       FROM observation_ai_runs
      WHERE visit_id = $1
      ORDER BY generated_at DESC
      LIMIT 10`,
    [visitId],
  );

  const feedback = await queryable.query<{
    assessment_id: string;
    simple_summary: string;
    recommended_taxon_name: string | null;
    recommended_rank: string | null;
    stop_reason: string;
    diagnostic_features_seen: unknown;
    missing_evidence: unknown;
    shot_suggestions: unknown;
    raw_json: unknown;
  }>(
    `SELECT assessment_id::text AS assessment_id,
            simple_summary,
            recommended_taxon_name,
            recommended_rank,
            stop_reason,
            diagnostic_features_seen,
            missing_evidence,
            shot_suggestions,
            raw_json
       FROM observation_ai_assessments
      WHERE visit_id = $1
      ORDER BY generated_at DESC
      LIMIT 1`,
    [visitId],
  );

  const latestFeedback = feedback.rows[0];
  const rawJson = asObject(latestFeedback?.raw_json);
  const parsed = asObject(rawJson.parsed);
  const claimRefsUsed = asStringArray(parsed.claim_refs_used);
  const feedbackPayload = latestFeedback
    ? {
        simpleSummary: latestFeedback.simple_summary,
        safeIdentification: [latestFeedback.recommended_taxon_name, latestFeedback.recommended_rank].filter(Boolean).join(" / "),
        whyThisRank: latestFeedback.stop_reason,
        diagnosticFeaturesSeen: asStringArray(latestFeedback.diagnostic_features_seen),
        missingEvidence: asStringArray(latestFeedback.missing_evidence),
        nextShots: asStringArray(latestFeedback.shot_suggestions).slice(0, 5),
        claimRefsUsed,
        reviewRoute: "feedback_contract",
        publicClaimLimit: reviewStateFor(occurrences).publicClaimLimit,
      }
    : null;

  return {
    packageVersion: "observation_package/v1",
    packageId: packageIdFor(visitId, input.targetOccurrenceId ?? input.occurrenceId),
    generatedAt: new Date().toISOString(),
    visit: {
      visitId: visitRow.visit_id,
      legacyObservationId: visitRow.legacy_observation_id,
      observedAt: visitRow.observed_at,
      placeId: visitRow.place_id,
      locationPrecision: inferLocationPrecision(visitRow),
      observedPrefecture: visitRow.observed_prefecture,
      observedMunicipality: visitRow.observed_municipality,
      effortMinutes: toNumber(visitRow.effort_minutes),
      targetTaxaScope: visitRow.target_taxa_scope,
      sourceKind: visitRow.source_kind,
    },
    occurrences,
    evidenceAssets: assets.rows.map((row) => ({
      assetId: row.asset_id,
      blobId: row.blob_id,
      occurrenceId: row.occurrence_id,
      visitId: row.visit_id,
      mediaType: row.media_type ?? "unknown",
      mimeType: row.mime_type,
      assetRole: row.asset_role,
      mediaRole: row.media_role ?? "context",
      capturedAt: row.captured_at,
      sha256: row.sha256,
      publicUrl: row.public_url,
    })),
    identifications: identifications.rows.map((row) => {
      const sourcePayload = asObject(row.source_payload);
      return {
        identificationId: row.identification_id,
        occurrenceId: row.occurrence_id,
        actorKind: row.actor_kind,
        actorUserId: row.actor_user_id,
        proposedName: row.proposed_name,
        proposedRank: row.proposed_rank,
        confidenceScore: toNumber(row.confidence_score),
        isCurrent: row.is_current,
        rationale: row.notes ?? String(sourcePayload.rationale ?? ""),
        similarTaxaRuledOut: asStringArray(sourcePayload.similar_taxa_ruled_out),
        reviewScope: typeof sourcePayload.review_scope === "string" ? sourcePayload.review_scope : null,
      };
    }),
    aiRuns: aiRuns.rows.map((row) => {
      const sourcePayload = asObject(row.source_payload);
      return {
        aiRunId: row.ai_run_id,
        visitId: row.visit_id,
        triggerOccurrenceId: row.trigger_occurrence_id,
        modelProvider: row.model_provider,
        modelName: row.model_name,
        promptVersion: row.prompt_version,
        pipelineVersion: row.pipeline_version,
        taxonomyVersion: row.taxonomy_version,
        knowledgeVersionSet: asObject(sourcePayload.knowledgeVersionSet),
        inputAssetFingerprint: row.input_asset_fingerprint,
        runStatus: row.run_status,
      };
    }),
    feedbackPayload,
    claimRefs: [],
    reviewState: reviewStateFor(occurrences),
    reportOutputs: [],
  };
}

export function summarizeObservationPackageForPrompt(pkg: ObservationPackage | null): string {
  if (!pkg) return "ObservationPackage unavailable.";
  const target = pkg.occurrences[0] ?? null;
  const mediaRoles = [...new Set(pkg.evidenceAssets.map((asset) => asset.mediaRole))].filter(Boolean);
  const missing = pkg.feedbackPayload?.missingEvidence?.slice(0, 4) ?? [];
  return [
    `package=${pkg.packageId}`,
    `visit=${pkg.visit.visitId}`,
    `place=${pkg.visit.observedPrefecture ?? ""}/${pkg.visit.observedMunicipality ?? ""}`,
    `safe_rank=${target?.safePublicRank ?? "unknown"}`,
    `evidence_tier=${target?.evidenceTier ?? "none"}`,
    `review=${pkg.reviewState.reviewStatus}`,
    `media_roles=${mediaRoles.join(",") || "none"}`,
    missing.length > 0 ? `previous_missing=${missing.join(" / ")}` : "",
  ].filter(Boolean).join("\n");
}

export function claimRefsForPackage(pkg: ObservationPackage, refs: ObservationPackageClaimRef[]): ObservationPackage {
  return { ...pkg, claimRefs: refs };
}

export { asTargetOutputs };
