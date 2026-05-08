import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { getPool } from "../db.js";
import type { CivicObservationContext } from "./civicNatureContext.js";
import type { WaterRecordExtension } from "./waterRecordExtension.js";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export type ObservationActionMode = "image_post" | "video_post" | "identification" | "guide_survey" | "field_scan" | "passive_audio" | "camera_trap" | "ias_route_camera" | "edna_reference";
export type FieldScanMode = "site_snapshot" | "fixed_point" | "route" | "area_footprint" | "calibration_evidence";
export type DataProductStage = "raw_observation" | "reviewed_data" | "indicator_candidate" | "report_output" | "export_package";
export type DecisionAuthority = "human_required" | "observer" | "trusted_reviewer" | "expert_reviewer" | "admin" | "site_policy" | "system_risk_cap";
export type PublicPrecisionPolicy = "system_risk_cap" | "admin_reviewer" | "site_policy" | "user_preference";

export type FieldScanContext = {
  fieldScanContextId: string;
  visitId: string;
  occurrenceId: string | null;
  scanMode: FieldScanMode;
  fixedPointId: string | null;
  routeId: string | null;
  areaId: string | null;
  footprintGeometry: Record<string, unknown>;
  calibrationEvidence: Record<string, unknown>;
  methodPayload: Record<string, unknown>;
  qualityPayload: Record<string, unknown>;
  sourcePayload: Record<string, unknown>;
};

export type ObservationGovernanceContext = {
  governanceContextId: string;
  visitId: string;
  occurrenceId: string | null;
  localKnowledgeContext: Record<string, unknown>;
  sitePolicyContext: Record<string, unknown>;
  reviewScope: Record<string, unknown>;
  rolePermissions: Record<string, unknown>;
  publicPrecisionPolicy: PublicPrecisionPolicy;
  sourcePayload: Record<string, unknown>;
};

export type ObservationPackageEvent = {
  packageEventId: string;
  visitId: string;
  occurrenceId: string | null;
  eventStage: DataProductStage;
  eventKind: string;
  actorKind: string;
  actorUserId: string | null;
  decisionAuthority: DecisionAuthority;
  humanReviewRequired: boolean;
  eventPayload: Record<string, unknown>;
  createdAt: string;
};

export type ObservationMethodContext = {
  methodKind: "casual_photo" | "guided_survey" | "field_scan" | "water_capture" | "identification_review" | "passive_audio" | "camera_trap" | "ias_route_camera" | "edna_reference";
  samplingProtocol: string | null;
  fixedSurveyTemplate: FieldScanTemplate | null;
  effortMinutes: number | null;
  targetTaxaScope: string | null;
  completeChecklistFlag: boolean;
  captureOutcome: string | null;
  siteTimeMethodEffortQuality: {
    hasSite: boolean;
    hasTime: boolean;
    hasMethod: boolean;
    hasEffort: boolean;
    hasQualityEvidence: boolean;
  };
  modelReadyBasis: string[];
};

export type ObservationDataProductChain = {
  schemaVersion: "data_product_chain/v1";
  latestStage: DataProductStage;
  stages: Array<{
    stage: DataProductStage;
    status: "not_started" | "in_progress" | "human_review_required" | "complete";
    eventCount: number;
    latestEventAt: string | null;
  }>;
  events: ObservationPackageEvent[];
};

export type ObservationAiBoundary = {
  schemaVersion: "ai_boundary/v1";
  aiRoles: Array<"identification_assist" | "quantity_estimate" | "coverage_estimate" | "missing_evidence_detection" | "privacy_risk_detection" | "report_draft" | "queue_triage">;
  humanAuthorityRequiredFor: string[];
  humanDecisions: string[];
  publicClaimLimit: string;
};

export type TrendAbundancePolicy = {
  claimAllowed: boolean;
  defaultClaimLimit: "presence_only" | "capture_attempt_only" | "indicator_candidate" | "trend_or_abundance_supported";
  reasons: string[];
  blockers: string[];
};

export type FieldScanContextInput = Partial<Omit<FieldScanContext, "fieldScanContextId" | "visitId" | "occurrenceId">> & {
  fieldScanContextId?: string | null;
  visitId?: string;
  occurrenceId?: string | null;
};

export type FieldScanTemplate = {
  templateId: string;
  scanMode: FieldScanMode;
  label: string;
  repeatability: "one_time_snapshot" | "repeatable_point" | "repeatable_route" | "repeatable_area" | "calibration_only";
  requiredBasis: Array<"site" | "time" | "method" | "effort" | "quality">;
  minimumEffortMinutes: number | null;
  qualityEvidence: string[];
  outputStage: "raw_observation" | "indicator_candidate";
};

export type ObservationGovernanceContextInput = Partial<Omit<ObservationGovernanceContext, "governanceContextId" | "visitId" | "occurrenceId">> & {
  governanceContextId?: string | null;
  visitId?: string;
  occurrenceId?: string | null;
};

export type ObservationPackageEventInput = Partial<Omit<ObservationPackageEvent, "packageEventId" | "visitId" | "occurrenceId" | "createdAt">> & {
  packageEventId?: string | null;
  visitId?: string;
  occurrenceId?: string | null;
};

const FIELD_SCAN_MODES: FieldScanMode[] = ["site_snapshot", "fixed_point", "route", "area_footprint", "calibration_evidence"];
const STAGES: DataProductStage[] = ["raw_observation", "reviewed_data", "indicator_candidate", "report_output", "export_package"];
const DECISION_AUTHORITIES: DecisionAuthority[] = ["human_required", "observer", "trusted_reviewer", "expert_reviewer", "admin", "site_policy", "system_risk_cap"];
const PUBLIC_PRECISION_POLICIES: PublicPrecisionPolicy[] = ["system_risk_cap", "admin_reviewer", "site_policy", "user_preference"];

export const FIELD_SCAN_TEMPLATES: Record<FieldScanMode, FieldScanTemplate> = {
  site_snapshot: {
    templateId: "field_scan_template/site_snapshot/v0",
    scanMode: "site_snapshot",
    label: "Site snapshot",
    repeatability: "one_time_snapshot",
    requiredBasis: ["site", "time", "method", "quality"],
    minimumEffortMinutes: null,
    qualityEvidence: ["wide_context_media", "public_precision_policy"],
    outputStage: "raw_observation",
  },
  fixed_point: {
    templateId: "field_scan_template/fixed_point/v0",
    scanMode: "fixed_point",
    label: "Fixed point",
    repeatability: "repeatable_point",
    requiredBasis: ["site", "time", "method", "effort", "quality"],
    minimumEffortMinutes: 5,
    qualityEvidence: ["fixed_point_id", "repeatable_framing_or_direction", "evidence_media"],
    outputStage: "indicator_candidate",
  },
  route: {
    templateId: "field_scan_template/route/v0",
    scanMode: "route",
    label: "Route",
    repeatability: "repeatable_route",
    requiredBasis: ["site", "time", "method", "effort", "quality"],
    minimumEffortMinutes: 10,
    qualityEvidence: ["route_id", "start_end_or_track", "evidence_media"],
    outputStage: "indicator_candidate",
  },
  area_footprint: {
    templateId: "field_scan_template/area_footprint/v0",
    scanMode: "area_footprint",
    label: "Area footprint",
    repeatability: "repeatable_area",
    requiredBasis: ["site", "time", "method", "effort", "quality"],
    minimumEffortMinutes: 10,
    qualityEvidence: ["area_id_or_footprint", "coverage_note", "evidence_media"],
    outputStage: "indicator_candidate",
  },
  calibration_evidence: {
    templateId: "field_scan_template/calibration_evidence/v0",
    scanMode: "calibration_evidence",
    label: "Calibration evidence",
    repeatability: "calibration_only",
    requiredBasis: ["site", "time", "method", "quality"],
    minimumEffortMinutes: null,
    qualityEvidence: ["calibration_target", "device_or_method_note", "evidence_media"],
    outputStage: "raw_observation",
  },
};

export function fieldScanTemplateForMode(scanMode: FieldScanMode): FieldScanTemplate {
  return FIELD_SCAN_TEMPLATES[scanMode];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeText(value: unknown, maxLength = 240): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

function optionalBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function hasRecord(value: Record<string, unknown> | null | undefined): boolean {
  return Boolean(value && Object.keys(value).length > 0);
}

export function inferObservationActionMode(input: {
  visit: { visitMode?: string | null };
  evidenceAssets: Array<{ mediaType?: string | null; mimeType?: string | null; mediaRole?: string | null }>;
  identifications: Array<unknown>;
  civicContext: CivicObservationContext | null;
  fieldScanContext: FieldScanContext | null;
}): ObservationActionMode {
  if (input.fieldScanContext) return "field_scan";
  if (input.visit.visitMode === "passive_audio") return "passive_audio";
  if (input.visit.visitMode === "camera_trap") return "camera_trap";
  if (input.visit.visitMode === "ias_route_camera") return "ias_route_camera";
  if (input.visit.visitMode === "edna_reference") return "edna_reference";
  if (input.visit.visitMode === "survey" || ["event", "school", "satoyama", "site_summary"].includes(input.civicContext?.contextKind ?? "")) {
    return "guide_survey";
  }
  const hasVideo = input.evidenceAssets.some((asset) =>
    asset.mediaType === "video"
    || asset.mediaRole === "video"
    || asset.mimeType?.startsWith("video/"),
  );
  if (hasVideo) return "video_post";
  const hasImage = input.evidenceAssets.some((asset) =>
    asset.mediaType === "image"
    || asset.mimeType?.startsWith("image/")
    || asset.mediaRole === "primary_subject",
  );
  if (!hasImage && input.identifications.length > 0) return "identification";
  return "image_post";
}

export function buildObservationMethodContext(input: {
  actionMode: ObservationActionMode;
  visit: {
    observedAt?: string | null;
    placeId?: string | null;
    effortMinutes?: number | null;
    targetTaxaScope?: string | null;
    completeChecklistFlag?: boolean | null;
    visitMode?: string | null;
  };
  evidenceAssets: Array<unknown>;
  civicContext: CivicObservationContext | null;
  waterRecord: WaterRecordExtension | null;
  fieldScanContext: FieldScanContext | null;
}): ObservationMethodContext {
  const effortMinutes = input.waterRecord?.effortMinutes ?? input.visit.effortMinutes ?? null;
  const targetTaxaScope = input.waterRecord?.targetTaxaScope ?? input.visit.targetTaxaScope ?? null;
  const hasSite = Boolean(
    input.visit.placeId
    || input.civicContext?.fieldId
    || input.civicContext?.routeId
    || input.civicContext?.plotId
    || input.waterRecord?.waterbodyId
    || input.waterRecord?.publicWaterbodyLabel
    || input.fieldScanContext?.fixedPointId
    || input.fieldScanContext?.routeId
    || input.fieldScanContext?.areaId
    || hasRecord(input.fieldScanContext?.footprintGeometry),
  );
  const hasMethod = Boolean(input.fieldScanContext || input.waterRecord || input.visit.visitMode === "survey" || input.actionMode === "identification");
  const isStructuredMethod = ["passive_audio", "camera_trap", "ias_route_camera", "edna_reference"].includes(input.actionMode);
  const hasQualityEvidence = input.evidenceAssets.length > 0 || hasRecord(input.fieldScanContext?.qualityPayload) || hasRecord(input.fieldScanContext?.calibrationEvidence);
  const methodKind: ObservationMethodContext["methodKind"] = input.fieldScanContext
    ? "field_scan"
    : input.waterRecord
      ? "water_capture"
      : input.actionMode === "identification"
        ? "identification_review"
        : input.actionMode === "passive_audio"
          ? "passive_audio"
          : input.actionMode === "camera_trap"
            ? "camera_trap"
            : input.actionMode === "ias_route_camera"
              ? "ias_route_camera"
              : input.actionMode === "edna_reference"
                ? "edna_reference"
        : input.visit.visitMode === "survey" || input.actionMode === "guide_survey"
          ? "guided_survey"
          : "casual_photo";

  const modelReadyBasis: string[] = [];
  if (hasSite) modelReadyBasis.push("site");
  if (input.visit.observedAt) modelReadyBasis.push("time");
  if (hasMethod || isStructuredMethod) modelReadyBasis.push("method");
  if (typeof effortMinutes === "number" && effortMinutes > 0) modelReadyBasis.push("effort");
  if (hasQualityEvidence) modelReadyBasis.push("quality");

  return {
    methodKind,
    samplingProtocol: input.fieldScanContext?.scanMode ?? input.waterRecord?.captureMethod ?? (isStructuredMethod ? input.actionMode : input.visit.visitMode) ?? null,
    fixedSurveyTemplate: input.fieldScanContext ? fieldScanTemplateForMode(input.fieldScanContext.scanMode) : null,
    effortMinutes,
    targetTaxaScope,
    completeChecklistFlag: Boolean(input.visit.completeChecklistFlag),
    captureOutcome: input.waterRecord?.catchOutcome ?? null,
    siteTimeMethodEffortQuality: {
      hasSite,
      hasTime: Boolean(input.visit.observedAt),
      hasMethod: hasMethod || isStructuredMethod,
      hasEffort: typeof effortMinutes === "number" && effortMinutes > 0,
      hasQualityEvidence,
    },
    modelReadyBasis,
  };
}

export function buildDataProductChain(input: {
  visitId: string;
  occurrenceId: string | null;
  generatedAt: string;
  reviewStatus: string;
  events: ObservationPackageEvent[];
}): ObservationDataProductChain {
  const events = input.events.length > 0
    ? input.events
    : [{
        packageEventId: `pkg_event:${input.visitId}:raw`,
        visitId: input.visitId,
        occurrenceId: input.occurrenceId,
        eventStage: "raw_observation" as const,
        eventKind: "package_generated_from_raw_observation",
        actorKind: "system",
        actorUserId: null,
        decisionAuthority: "human_required" as const,
        humanReviewRequired: input.reviewStatus !== "verified",
        eventPayload: { derived: true },
        createdAt: input.generatedAt,
      }];

  const stages = STAGES.map((stage) => {
    const stageEvents = events.filter((event) => event.eventStage === stage);
    const latest = stageEvents.at(-1) ?? null;
    return {
      stage,
      status: stageEvents.length === 0
        ? "not_started" as const
        : stageEvents.some((event) => event.humanReviewRequired)
          ? "human_review_required" as const
          : "complete" as const,
      eventCount: stageEvents.length,
      latestEventAt: latest?.createdAt ?? null,
    };
  });
  const latestStage = [...events]
    .sort((a, b) => STAGES.indexOf(b.eventStage) - STAGES.indexOf(a.eventStage))[0]?.eventStage ?? "raw_observation";

  return {
    schemaVersion: "data_product_chain/v1",
    latestStage,
    stages,
    events,
  };
}

export function buildObservationAiBoundary(input: {
  aiRuns: Array<unknown>;
  feedbackPayload: { missingEvidence?: string[]; nextShots?: string[]; publicClaimLimit?: string } | null;
  identifications: Array<{ actorKind?: string | null; isCurrent?: boolean | null }>;
  reviewStatus: string;
}): ObservationAiBoundary {
  const aiRoles: ObservationAiBoundary["aiRoles"] = input.aiRuns.length > 0
    ? ["identification_assist", "missing_evidence_detection", "privacy_risk_detection", "queue_triage"]
    : [];
  if ((input.feedbackPayload?.nextShots?.length ?? 0) > 0) aiRoles.push("report_draft");
  const humanDecisions = input.identifications
    .filter((identification) => identification.actorKind === "human" && identification.isCurrent)
    .map(() => "current_identification");
  return {
    schemaVersion: "ai_boundary/v1",
    aiRoles: [...new Set(aiRoles)],
    humanAuthorityRequiredFor: [
      "final_identification",
      "public_precision_increase",
      "external_export",
      "safety_or_risk_decision",
      "trend_or_abundance_claim",
    ],
    humanDecisions,
    publicClaimLimit: input.reviewStatus === "verified"
      ? (input.feedbackPayload?.publicClaimLimit ?? "observation_supported")
      : "assistive_feedback_only",
  };
}

export function buildTrendAbundancePolicy(input: {
  actionMode: ObservationActionMode;
  methodContext: ObservationMethodContext;
  fieldScanContext: FieldScanContext | null;
  reviewStatus: string;
}): TrendAbundancePolicy {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const keys = input.methodContext.siteTimeMethodEffortQuality;
  const isSensorOrProtocolMode = ["field_scan", "guide_survey", "passive_audio", "camera_trap", "ias_route_camera"].includes(input.actionMode);
  if (isSensorOrProtocolMode) reasons.push("designed_observation_mode");
  else blockers.push("casual_record_presence_only");
  if (keys.hasSite && keys.hasTime && keys.hasMethod && keys.hasEffort && keys.hasQualityEvidence) reasons.push("has_site_time_method_effort_quality");
  else blockers.push("missing_site_time_method_effort_quality");
  if (input.fieldScanContext?.scanMode === "fixed_point" || input.fieldScanContext?.scanMode === "route" || input.fieldScanContext?.scanMode === "area_footprint") {
    reasons.push(`repeatable_scan_mode_${input.fieldScanContext.scanMode}`);
  } else {
    blockers.push("missing_repeatable_field_scan_design");
  }
  if (input.reviewStatus === "verified") reasons.push("human_reviewed");
  else blockers.push("human_review_required_for_trend_or_abundance");

  const uniqueBlockers = [...new Set(blockers)];
  const claimAllowed = uniqueBlockers.length === 0;
  return {
    claimAllowed,
    defaultClaimLimit: claimAllowed
      ? "trend_or_abundance_supported"
      : input.methodContext.captureOutcome === "no_catch"
        ? "capture_attempt_only"
        : isSensorOrProtocolMode
          ? "indicator_candidate"
          : "presence_only",
    reasons,
    blockers: uniqueBlockers,
  };
}

export function normalizeFieldScanContext(input: FieldScanContextInput & { visitId: string; occurrenceId?: string | null }): FieldScanContext {
  const visitId = normalizeText(input.visitId);
  if (!visitId) throw new Error("visit_id_required");
  const scanMode = oneOf(input.scanMode, FIELD_SCAN_MODES, "site_snapshot");
  const template = fieldScanTemplateForMode(scanMode);
  const methodPayload = {
    fieldScanTemplateId: template.templateId,
    repeatability: template.repeatability,
    requiredBasis: template.requiredBasis,
    minimumEffortMinutes: template.minimumEffortMinutes,
    outputStage: template.outputStage,
    ...asRecord(input.methodPayload),
  };
  const qualityPayload = {
    templateQualityEvidence: template.qualityEvidence,
    ...asRecord(input.qualityPayload),
  };
  return {
    fieldScanContextId: normalizeText(input.fieldScanContextId) ?? `field_scan:${visitId}`,
    visitId,
    occurrenceId: normalizeText(input.occurrenceId),
    scanMode,
    fixedPointId: normalizeText(input.fixedPointId),
    routeId: normalizeText(input.routeId),
    areaId: normalizeText(input.areaId),
    footprintGeometry: asRecord(input.footprintGeometry),
    calibrationEvidence: asRecord(input.calibrationEvidence),
    methodPayload,
    qualityPayload,
    sourcePayload: asRecord(input.sourcePayload),
  };
}

export function normalizeObservationGovernanceContext(input: ObservationGovernanceContextInput & { visitId: string; occurrenceId?: string | null }): ObservationGovernanceContext {
  const visitId = normalizeText(input.visitId);
  if (!visitId) throw new Error("visit_id_required");
  return {
    governanceContextId: normalizeText(input.governanceContextId) ?? `governance:${visitId}`,
    visitId,
    occurrenceId: normalizeText(input.occurrenceId),
    localKnowledgeContext: asRecord(input.localKnowledgeContext),
    sitePolicyContext: asRecord(input.sitePolicyContext),
    reviewScope: asRecord(input.reviewScope),
    rolePermissions: asRecord(input.rolePermissions),
    publicPrecisionPolicy: oneOf(input.publicPrecisionPolicy, PUBLIC_PRECISION_POLICIES, "system_risk_cap"),
    sourcePayload: asRecord(input.sourcePayload),
  };
}

export function normalizeObservationPackageEvent(input: ObservationPackageEventInput & { visitId: string; occurrenceId?: string | null }): ObservationPackageEvent {
  const visitId = normalizeText(input.visitId);
  if (!visitId) throw new Error("visit_id_required");
  const eventStage = oneOf(input.eventStage, STAGES, "raw_observation");
  return {
    packageEventId: normalizeText(input.packageEventId) ?? `pkg_event:${randomUUID()}`,
    visitId,
    occurrenceId: normalizeText(input.occurrenceId),
    eventStage,
    eventKind: normalizeText(input.eventKind, 120) ?? `${eventStage}_recorded`,
    actorKind: normalizeText(input.actorKind, 80) ?? "system",
    actorUserId: normalizeText(input.actorUserId, 120),
    decisionAuthority: oneOf(input.decisionAuthority, DECISION_AUTHORITIES, "human_required"),
    humanReviewRequired: optionalBoolean(input.humanReviewRequired, true),
    eventPayload: asRecord(input.eventPayload),
    createdAt: new Date().toISOString(),
  };
}

export async function upsertFieldScanContext(
  input: FieldScanContextInput & { visitId: string; occurrenceId?: string | null },
  queryable: Queryable = getPool(),
): Promise<FieldScanContext> {
  const context = normalizeFieldScanContext(input);
  await queryable.query(
    `insert into field_scan_contexts (
       field_scan_context_id, visit_id, occurrence_id, scan_mode, fixed_point_id,
       route_id, area_id, footprint_geometry, calibration_evidence, method_payload,
       quality_payload, source_payload, updated_at
     ) values (
       $1, $2, $3, $4, $5,
       $6, $7, $8::jsonb, $9::jsonb, $10::jsonb,
       $11::jsonb, $12::jsonb, now()
     )
     on conflict (visit_id) do update set
       occurrence_id = excluded.occurrence_id,
       scan_mode = excluded.scan_mode,
       fixed_point_id = excluded.fixed_point_id,
       route_id = excluded.route_id,
       area_id = excluded.area_id,
       footprint_geometry = excluded.footprint_geometry,
       calibration_evidence = excluded.calibration_evidence,
       method_payload = excluded.method_payload,
       quality_payload = excluded.quality_payload,
       source_payload = excluded.source_payload,
       updated_at = now()`,
    [
      context.fieldScanContextId,
      context.visitId,
      context.occurrenceId,
      context.scanMode,
      context.fixedPointId,
      context.routeId,
      context.areaId,
      JSON.stringify(context.footprintGeometry),
      JSON.stringify(context.calibrationEvidence),
      JSON.stringify(context.methodPayload),
      JSON.stringify(context.qualityPayload),
      JSON.stringify(context.sourcePayload),
    ],
  );
  return context;
}

export async function upsertObservationGovernanceContext(
  input: ObservationGovernanceContextInput & { visitId: string; occurrenceId?: string | null },
  queryable: Queryable = getPool(),
): Promise<ObservationGovernanceContext> {
  const context = normalizeObservationGovernanceContext(input);
  await queryable.query(
    `insert into observation_governance_contexts (
       governance_context_id, visit_id, occurrence_id, local_knowledge_context,
       site_policy_context, review_scope, role_permissions, public_precision_policy,
       source_payload, updated_at
     ) values (
       $1, $2, $3, $4::jsonb,
       $5::jsonb, $6::jsonb, $7::jsonb, $8,
       $9::jsonb, now()
     )
     on conflict (visit_id) do update set
       occurrence_id = excluded.occurrence_id,
       local_knowledge_context = excluded.local_knowledge_context,
       site_policy_context = excluded.site_policy_context,
       review_scope = excluded.review_scope,
       role_permissions = excluded.role_permissions,
       public_precision_policy = excluded.public_precision_policy,
       source_payload = excluded.source_payload,
       updated_at = now()`,
    [
      context.governanceContextId,
      context.visitId,
      context.occurrenceId,
      JSON.stringify(context.localKnowledgeContext),
      JSON.stringify(context.sitePolicyContext),
      JSON.stringify(context.reviewScope),
      JSON.stringify(context.rolePermissions),
      context.publicPrecisionPolicy,
      JSON.stringify(context.sourcePayload),
    ],
  );
  return context;
}

export async function appendObservationPackageEvent(
  input: ObservationPackageEventInput & { visitId: string; occurrenceId?: string | null },
  queryable: Queryable = getPool(),
): Promise<ObservationPackageEvent> {
  const event = normalizeObservationPackageEvent(input);
  await queryable.query(
    `insert into observation_package_events (
       package_event_id, visit_id, occurrence_id, event_stage, event_kind,
       actor_kind, actor_user_id, decision_authority, human_review_required,
       event_payload, created_at
     ) values (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9,
       $10::jsonb, now()
     )
     on conflict (package_event_id) do nothing`,
    [
      event.packageEventId,
      event.visitId,
      event.occurrenceId,
      event.eventStage,
      event.eventKind,
      event.actorKind,
      event.actorUserId,
      event.decisionAuthority,
      event.humanReviewRequired,
      JSON.stringify(event.eventPayload),
    ],
  );
  return event;
}

export async function getFieldScanContext(visitId: string, queryable: Queryable = getPool()): Promise<FieldScanContext | null> {
  const result = await queryable.query<{
    field_scan_context_id: string;
    visit_id: string;
    occurrence_id: string | null;
    scan_mode: FieldScanMode;
    fixed_point_id: string | null;
    route_id: string | null;
    area_id: string | null;
    footprint_geometry: Record<string, unknown> | null;
    calibration_evidence: Record<string, unknown> | null;
    method_payload: Record<string, unknown> | null;
    quality_payload: Record<string, unknown> | null;
    source_payload: Record<string, unknown> | null;
  }>(
    `select field_scan_context_id, visit_id, occurrence_id, scan_mode, fixed_point_id,
            route_id, area_id, footprint_geometry, calibration_evidence, method_payload,
            quality_payload, source_payload
       from field_scan_contexts
      where visit_id = $1
      limit 1`,
    [visitId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    fieldScanContextId: row.field_scan_context_id,
    visitId: row.visit_id,
    occurrenceId: row.occurrence_id,
    scanMode: row.scan_mode,
    fixedPointId: row.fixed_point_id,
    routeId: row.route_id,
    areaId: row.area_id,
    footprintGeometry: row.footprint_geometry ?? {},
    calibrationEvidence: row.calibration_evidence ?? {},
    methodPayload: row.method_payload ?? {},
    qualityPayload: row.quality_payload ?? {},
    sourcePayload: row.source_payload ?? {},
  };
}

export async function getObservationGovernanceContext(visitId: string, queryable: Queryable = getPool()): Promise<ObservationGovernanceContext | null> {
  const result = await queryable.query<{
    governance_context_id: string;
    visit_id: string;
    occurrence_id: string | null;
    local_knowledge_context: Record<string, unknown> | null;
    site_policy_context: Record<string, unknown> | null;
    review_scope: Record<string, unknown> | null;
    role_permissions: Record<string, unknown> | null;
    public_precision_policy: PublicPrecisionPolicy;
    source_payload: Record<string, unknown> | null;
  }>(
    `select governance_context_id, visit_id, occurrence_id, local_knowledge_context,
            site_policy_context, review_scope, role_permissions, public_precision_policy,
            source_payload
       from observation_governance_contexts
      where visit_id = $1
      limit 1`,
    [visitId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    governanceContextId: row.governance_context_id,
    visitId: row.visit_id,
    occurrenceId: row.occurrence_id,
    localKnowledgeContext: row.local_knowledge_context ?? {},
    sitePolicyContext: row.site_policy_context ?? {},
    reviewScope: row.review_scope ?? {},
    rolePermissions: row.role_permissions ?? {},
    publicPrecisionPolicy: row.public_precision_policy,
    sourcePayload: row.source_payload ?? {},
  };
}

export async function getObservationPackageEvents(visitId: string, queryable: Queryable = getPool()): Promise<ObservationPackageEvent[]> {
  const result = await queryable.query<{
    package_event_id: string;
    visit_id: string;
    occurrence_id: string | null;
    event_stage: DataProductStage;
    event_kind: string;
    actor_kind: string;
    actor_user_id: string | null;
    decision_authority: DecisionAuthority;
    human_review_required: boolean;
    event_payload: Record<string, unknown> | null;
    created_at: string;
  }>(
    `select package_event_id, visit_id, occurrence_id, event_stage, event_kind,
            actor_kind, actor_user_id, decision_authority, human_review_required,
            event_payload, created_at::text as created_at
       from observation_package_events
      where visit_id = $1
      order by created_at asc`,
    [visitId],
  );
  return result.rows.map((row) => ({
    packageEventId: row.package_event_id,
    visitId: row.visit_id,
    occurrenceId: row.occurrence_id,
    eventStage: row.event_stage,
    eventKind: row.event_kind,
    actorKind: row.actor_kind,
    actorUserId: row.actor_user_id,
    decisionAuthority: row.decision_authority,
    humanReviewRequired: row.human_review_required,
    eventPayload: row.event_payload ?? {},
    createdAt: row.created_at,
  }));
}
