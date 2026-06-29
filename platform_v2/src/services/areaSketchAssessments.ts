import { getPool } from "../db.js";
import {
  estimateAreaSketch,
  type AreaSketchEstimateResult,
  type AreaSketchLandCoverInput,
  type AreaSketchPolicyVersion,
} from "./areaSketchEstimate.js";
import {
  normalizeAreaSketchPolygon,
  type AreaSketchNormalizeResult,
} from "./areaSketchGeometry.js";
import type { PolygonGeometry } from "./observationEventAreaGeometry.js";

export type AreaSketchAssessmentVisibility = "private" | "field_managers" | "internal";
export type AreaSketchAssessmentStatus = "draft" | "archived";

export type AreaSketchAssessment = {
  assessmentId: string;
  fieldId: string;
  actorUserId: string;
  status: AreaSketchAssessmentStatus;
  visibility: AreaSketchAssessmentVisibility;
  policyVersion: AreaSketchPolicyVersion;
  estimateVersion: AreaSketchEstimateResult["estimateVersion"];
  sketchPolygon: Record<string, unknown>;
  normalizedPolygon: PolygonGeometry;
  landCover: AreaSketchLandCoverInput[];
  ownerAssertion: Record<string, unknown>;
  evidencePayload: Record<string, unknown>;
  resultPayload: AreaSketchEstimateResult;
  claimBoundary: AreaSketchEstimateResult["claimBoundary"];
  auditPayload: Record<string, unknown>;
  areaHa: number | null;
  greenCandidateAreaHa: number | null;
  conditionalGreenCandidateAreaHa: number | null;
  unknownAreaHa: number | null;
  greenRatio: number | null;
  createdAt: string;
  updatedAt: string;
};

export type BuildAreaSketchAssessmentDraftInput = {
  fieldId: string;
  actorUserId: string;
  sketchPolygon: unknown;
  landCover: AreaSketchLandCoverInput[];
  policyVersion?: AreaSketchPolicyVersion;
  visibility?: AreaSketchAssessmentVisibility;
  ownerAssertion?: Record<string, unknown>;
  evidencePayload?: Record<string, unknown>;
};

export class AreaSketchAssessmentValidationError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(code: string, details: Record<string, unknown> = {}) {
    super(code);
    this.name = "AreaSketchAssessmentValidationError";
    this.code = code;
    this.details = details;
  }
}

interface RawAreaSketchAssessmentRow extends Record<string, unknown> {
  assessment_id: string;
  field_id: string;
  actor_user_id: string;
  status: string;
  visibility: string;
  policy_version: string;
  estimate_version: string;
  sketch_polygon: Record<string, unknown>;
  normalized_polygon: PolygonGeometry;
  land_cover: AreaSketchLandCoverInput[];
  owner_assertion: Record<string, unknown>;
  evidence_payload: Record<string, unknown>;
  result_payload: AreaSketchEstimateResult;
  claim_boundary: AreaSketchEstimateResult["claimBoundary"];
  audit_payload: Record<string, unknown>;
  area_ha: string | number | null;
  green_candidate_area_ha: string | number | null;
  conditional_green_candidate_area_ha: string | number | null;
  unknown_area_ha: string | number | null;
  green_ratio: string | number | null;
  created_at: string;
  updated_at: string;
}

const SELECT_AREA_SKETCH_ASSESSMENT = `
  assessment_id, field_id, actor_user_id, status, visibility,
  policy_version, estimate_version,
  sketch_polygon, normalized_polygon, land_cover,
  owner_assertion, evidence_payload, result_payload, claim_boundary, audit_payload,
  area_ha::text AS area_ha,
  green_candidate_area_ha::text AS green_candidate_area_ha,
  conditional_green_candidate_area_ha::text AS conditional_green_candidate_area_ha,
  unknown_area_ha::text AS unknown_area_ha,
  green_ratio::text AS green_ratio,
  created_at::text AS created_at,
  updated_at::text AS updated_at
`;

function numberOrNull(value: string | number | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isPolicyVersion(value: unknown): value is AreaSketchPolicyVersion {
  return value === "general_precheck_v1" ||
    value === "tsunag_2026_current" ||
    value === "tsunag_2027_planned";
}

export function isAreaSketchAssessmentVisibility(value: unknown): value is AreaSketchAssessmentVisibility {
  return value === "private" || value === "field_managers" || value === "internal";
}

function mapAssessmentRow(row: RawAreaSketchAssessmentRow): AreaSketchAssessment {
  return {
    assessmentId: row.assessment_id,
    fieldId: row.field_id,
    actorUserId: row.actor_user_id,
    status: row.status === "archived" ? "archived" : "draft",
    visibility: isAreaSketchAssessmentVisibility(row.visibility) ? row.visibility : "private",
    policyVersion: isPolicyVersion(row.policy_version) ? row.policy_version : "general_precheck_v1",
    estimateVersion: row.estimate_version === "area_sketch_estimate_v1" ? row.estimate_version : "area_sketch_estimate_v1",
    sketchPolygon: row.sketch_polygon,
    normalizedPolygon: row.normalized_polygon,
    landCover: Array.isArray(row.land_cover) ? row.land_cover : [],
    ownerAssertion: row.owner_assertion ?? {},
    evidencePayload: row.evidence_payload ?? {},
    resultPayload: row.result_payload,
    claimBoundary: row.claim_boundary,
    auditPayload: row.audit_payload ?? {},
    areaHa: numberOrNull(row.area_ha),
    greenCandidateAreaHa: numberOrNull(row.green_candidate_area_ha),
    conditionalGreenCandidateAreaHa: numberOrNull(row.conditional_green_candidate_area_ha),
    unknownAreaHa: numberOrNull(row.unknown_area_ha),
    greenRatio: numberOrNull(row.green_ratio),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertObject(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AreaSketchAssessmentValidationError(code);
  }
  return value as Record<string, unknown>;
}

function assertLandCover(value: unknown): AreaSketchLandCoverInput[] {
  if (!Array.isArray(value)) throw new AreaSketchAssessmentValidationError("land_cover_required");
  return value as AreaSketchLandCoverInput[];
}

export function buildAreaSketchAssessmentDraft(input: BuildAreaSketchAssessmentDraftInput): {
  normalized: AreaSketchNormalizeResult;
  estimate: AreaSketchEstimateResult;
  insert: {
    fieldId: string;
    actorUserId: string;
    status: AreaSketchAssessmentStatus;
    visibility: AreaSketchAssessmentVisibility;
    policyVersion: AreaSketchPolicyVersion;
    estimateVersion: AreaSketchEstimateResult["estimateVersion"];
    sketchPolygon: Record<string, unknown>;
    normalizedPolygon: PolygonGeometry;
    landCover: AreaSketchLandCoverInput[];
    ownerAssertion: Record<string, unknown>;
    evidencePayload: Record<string, unknown>;
    resultPayload: AreaSketchEstimateResult;
    claimBoundary: AreaSketchEstimateResult["claimBoundary"];
    auditPayload: Record<string, unknown>;
    areaHa: number;
    greenCandidateAreaHa: number;
    conditionalGreenCandidateAreaHa: number;
    unknownAreaHa: number;
    greenRatio: number;
  };
} {
  if (!input.fieldId) throw new AreaSketchAssessmentValidationError("field_id_required");
  if (!input.actorUserId) throw new AreaSketchAssessmentValidationError("actor_user_id_required");
  const sketchPolygon = assertObject(input.sketchPolygon, "sketch_polygon_required");
  const landCover = assertLandCover(input.landCover);
  const policyVersion = input.policyVersion ?? "general_precheck_v1";
  const visibility = input.visibility ?? "private";
  if (!isPolicyVersion(policyVersion)) throw new AreaSketchAssessmentValidationError("invalid_policy_version");
  if (!isAreaSketchAssessmentVisibility(visibility)) {
    throw new AreaSketchAssessmentValidationError("invalid_visibility");
  }

  const normalized = normalizeAreaSketchPolygon(sketchPolygon);
  if (!normalized.polygon || !normalized.isValidForAreaEstimate || normalized.validation.areaHa == null) {
    throw new AreaSketchAssessmentValidationError("invalid_sketch_polygon", {
      errors: normalized.errors,
      warnings: normalized.warnings,
    });
  }
  const estimate = estimateAreaSketch({
    totalAreaHa: normalized.validation.areaHa,
    landCover,
    policyVersion,
  });

  return {
    normalized,
    estimate,
    insert: {
      fieldId: input.fieldId,
      actorUserId: input.actorUserId,
      status: "draft",
      visibility,
      policyVersion,
      estimateVersion: estimate.estimateVersion,
      sketchPolygon,
      normalizedPolygon: normalized.polygon,
      landCover,
      ownerAssertion: input.ownerAssertion ?? {},
      evidencePayload: input.evidencePayload ?? {},
      resultPayload: estimate,
      claimBoundary: estimate.claimBoundary,
      auditPayload: {
        generated_by: "area_sketch_assist",
        normalized_point_count: normalized.cleanedPointCount,
        original_point_count: normalized.originalPointCount,
        removed_point_count: normalized.removedPointCount,
        geometry_warnings: normalized.warnings,
      },
      areaHa: estimate.totalAreaHa,
      greenCandidateAreaHa: estimate.greenCandidateAreaHa,
      conditionalGreenCandidateAreaHa: estimate.conditionalGreenCandidateAreaHa,
      unknownAreaHa: estimate.unknownAreaHa,
      greenRatio: estimate.greenRatio,
    },
  };
}

export async function createAreaSketchAssessment(
  input: BuildAreaSketchAssessmentDraftInput,
): Promise<AreaSketchAssessment> {
  const draft = buildAreaSketchAssessmentDraft(input);
  const row = draft.insert;
  const result = await getPool().query<RawAreaSketchAssessmentRow>(
    `INSERT INTO area_sketch_assessments (
       field_id, actor_user_id, status, visibility,
       policy_version, estimate_version,
       sketch_polygon, normalized_polygon, land_cover,
       owner_assertion, evidence_payload, result_payload, claim_boundary, audit_payload,
       area_ha, green_candidate_area_ha, conditional_green_candidate_area_ha, unknown_area_ha, green_ratio
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6,
       $7::jsonb, $8::jsonb, $9::jsonb,
       $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb,
       $15, $16, $17, $18, $19
     )
     RETURNING ${SELECT_AREA_SKETCH_ASSESSMENT}`,
    [
      row.fieldId,
      row.actorUserId,
      row.status,
      row.visibility,
      row.policyVersion,
      row.estimateVersion,
      JSON.stringify(row.sketchPolygon),
      JSON.stringify(row.normalizedPolygon),
      JSON.stringify(row.landCover),
      JSON.stringify(row.ownerAssertion),
      JSON.stringify(row.evidencePayload),
      JSON.stringify(row.resultPayload),
      JSON.stringify(row.claimBoundary),
      JSON.stringify(row.auditPayload),
      row.areaHa,
      row.greenCandidateAreaHa,
      row.conditionalGreenCandidateAreaHa,
      row.unknownAreaHa,
      row.greenRatio,
    ],
  );
  const inserted = result.rows[0];
  if (!inserted) throw new Error("failed to create area sketch assessment");
  return mapAssessmentRow(inserted);
}

export async function listAreaSketchAssessments(input: {
  fieldId: string;
  actorUserId: string;
  limit?: number;
}): Promise<AreaSketchAssessment[]> {
  const limit = Math.min(Math.max(1, input.limit ?? 20), 50);
  const result = await getPool().query<RawAreaSketchAssessmentRow>(
    `SELECT ${SELECT_AREA_SKETCH_ASSESSMENT}
       FROM area_sketch_assessments
      WHERE field_id = $1
        AND actor_user_id = $2
        AND status = 'draft'
      ORDER BY updated_at DESC
      LIMIT $3`,
    [input.fieldId, input.actorUserId, limit],
  );
  return result.rows.map(mapAssessmentRow);
}
