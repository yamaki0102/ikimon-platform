import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { getPool } from "../db.js";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export type CivicContextKind = "ordinary" | "event" | "school" | "satoyama" | "risk" | "site_summary";
export type CivicActivityIntent = "discover" | "revisit" | "compare" | "learn" | "manage" | "confirm" | "share";
export type CivicParticipantRole = "finder" | "photographer" | "context_recorder" | "note_taker" | "guide" | "reviewer" | "manager" | "teacher" | "student" | "participant";
export type CivicAudienceScope = "private" | "class_group" | "event_participants" | "public" | "partner_internal" | "research_internal";
export type CivicPublicPrecision = "exact_private" | "site" | "mesh" | "municipality" | "hidden";
export type CivicRiskLane = "normal" | "danger_candidate" | "invasive_candidate" | "tree_anomaly" | "rare_sensitive";
export type CivicReportConsent = "none" | "internal" | "public_summary" | "research_export";

export type CivicObservationContext = {
  contextId: string;
  visitId: string;
  occurrenceId: string | null;
  contextKind: CivicContextKind;
  activityLabel: string | null;
  activityIntent: CivicActivityIntent | null;
  participantRole: CivicParticipantRole | null;
  audienceScope: CivicAudienceScope;
  publicPrecision: CivicPublicPrecision;
  riskLane: CivicRiskLane;
  reportConsent: CivicReportConsent;
  revisitOfVisitId: string | null;
  fieldId: string | null;
  routeId: string | null;
  plotId: string | null;
  sourcePayload: Record<string, unknown>;
};

export type CivicObservationContextInput = Partial<CivicObservationContext> & {
  visitId: string;
  occurrenceId?: string | null;
  sourcePayload?: Record<string, unknown> | null;
};

const CONTEXT_KINDS: CivicContextKind[] = ["ordinary", "event", "school", "satoyama", "risk", "site_summary"];
const ACTIVITY_INTENTS: CivicActivityIntent[] = ["discover", "revisit", "compare", "learn", "manage", "confirm", "share"];
const PARTICIPANT_ROLES: CivicParticipantRole[] = ["finder", "photographer", "context_recorder", "note_taker", "guide", "reviewer", "manager", "teacher", "student", "participant"];
const AUDIENCE_SCOPES: CivicAudienceScope[] = ["private", "class_group", "event_participants", "public", "partner_internal", "research_internal"];
const PUBLIC_PRECISIONS: CivicPublicPrecision[] = ["exact_private", "site", "mesh", "municipality", "hidden"];
const RISK_LANES: CivicRiskLane[] = ["normal", "danger_candidate", "invasive_candidate", "tree_anomaly", "rare_sensitive"];
const REPORT_CONSENTS: CivicReportConsent[] = ["none", "internal", "public_summary", "research_export"];

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 240) : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

function optionalOneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return allowed.includes(value as T) ? value as T : null;
}

function safePrecisionForRisk(riskLane: CivicRiskLane, requested: CivicPublicPrecision): CivicPublicPrecision {
  if (riskLane === "rare_sensitive") return "hidden";
  if (riskLane !== "normal" && requested === "exact_private") return "municipality";
  return requested;
}

export function normalizeCivicObservationContext(input: CivicObservationContextInput): CivicObservationContext {
  const visitId = normalizeText(input.visitId);
  if (!visitId) throw new Error("visit_id_required");
  const riskLane = oneOf(input.riskLane, RISK_LANES, "normal");
  const requestedPrecision = oneOf(input.publicPrecision, PUBLIC_PRECISIONS, "municipality");
  const contextKind = oneOf(input.contextKind, CONTEXT_KINDS, riskLane === "normal" ? "ordinary" : "risk");
  return {
    contextId: normalizeText(input.contextId) ?? `civic:${visitId}`,
    visitId,
    occurrenceId: normalizeText(input.occurrenceId),
    contextKind,
    activityLabel: normalizeText(input.activityLabel),
    activityIntent: optionalOneOf(input.activityIntent, ACTIVITY_INTENTS),
    participantRole: optionalOneOf(input.participantRole, PARTICIPANT_ROLES),
    audienceScope: oneOf(input.audienceScope, AUDIENCE_SCOPES, "private"),
    publicPrecision: safePrecisionForRisk(riskLane, requestedPrecision),
    riskLane,
    reportConsent: oneOf(input.reportConsent, REPORT_CONSENTS, "none"),
    revisitOfVisitId: normalizeText(input.revisitOfVisitId),
    fieldId: normalizeText(input.fieldId),
    routeId: normalizeText(input.routeId),
    plotId: normalizeText(input.plotId),
    sourcePayload: input.sourcePayload && typeof input.sourcePayload === "object" ? input.sourcePayload : {},
  };
}

export function deriveDefaultCivicContext(input: {
  visitId: string;
  occurrenceId?: string | null;
  eventSessionId?: unknown;
  eventCode?: unknown;
  sourcePayload?: Record<string, unknown> | null;
}): CivicObservationContext {
  const payload = input.sourcePayload ?? {};
  const hasEvent = typeof input.eventSessionId === "string" || typeof input.eventCode === "string";
  const riskLane = typeof payload.risk_lane === "string" ? payload.risk_lane : undefined;
  return normalizeCivicObservationContext({
    visitId: input.visitId,
    occurrenceId: input.occurrenceId ?? null,
    contextKind: hasEvent ? "event" : riskLane ? "risk" : "ordinary",
    activityIntent: hasEvent ? "share" : "discover",
    participantRole: hasEvent ? "participant" : "finder",
    riskLane: riskLane as CivicRiskLane | undefined,
    sourcePayload: {
      derived: true,
      event_session_id: typeof input.eventSessionId === "string" ? input.eventSessionId : null,
      event_code: typeof input.eventCode === "string" ? input.eventCode : null,
    },
  });
}

export async function upsertCivicObservationContext(
  input: CivicObservationContextInput,
  queryable: Queryable = getPool(),
): Promise<CivicObservationContext> {
  const context = normalizeCivicObservationContext(input);
  await queryable.query(
    `insert into civic_observation_contexts (
       context_id, visit_id, occurrence_id, context_kind, activity_label, activity_intent,
       participant_role, audience_scope, public_precision, risk_lane, report_consent,
       revisit_of_visit_id, field_id, route_id, plot_id, source_payload, updated_at
     ) values (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10, $11,
       $12, $13, $14, $15, $16::jsonb, now()
     )
     on conflict (visit_id) do update set
       occurrence_id = excluded.occurrence_id,
       context_kind = excluded.context_kind,
       activity_label = excluded.activity_label,
       activity_intent = excluded.activity_intent,
       participant_role = excluded.participant_role,
       audience_scope = excluded.audience_scope,
       public_precision = excluded.public_precision,
       risk_lane = excluded.risk_lane,
       report_consent = excluded.report_consent,
       revisit_of_visit_id = excluded.revisit_of_visit_id,
       field_id = excluded.field_id,
       route_id = excluded.route_id,
       plot_id = excluded.plot_id,
       source_payload = excluded.source_payload,
       updated_at = now()`,
    [
      context.contextId,
      context.visitId,
      context.occurrenceId,
      context.contextKind,
      context.activityLabel,
      context.activityIntent,
      context.participantRole,
      context.audienceScope,
      context.publicPrecision,
      context.riskLane,
      context.reportConsent,
      context.revisitOfVisitId,
      context.fieldId,
      context.routeId,
      context.plotId,
      JSON.stringify(context.sourcePayload),
    ],
  );
  return context;
}

export async function getCivicObservationContext(visitId: string): Promise<CivicObservationContext | null> {
  const result = await getPool().query<{
    context_id: string;
    visit_id: string;
    occurrence_id: string | null;
    context_kind: CivicContextKind;
    activity_label: string | null;
    activity_intent: CivicActivityIntent | null;
    participant_role: CivicParticipantRole | null;
    audience_scope: CivicAudienceScope;
    public_precision: CivicPublicPrecision;
    risk_lane: CivicRiskLane;
    report_consent: CivicReportConsent;
    revisit_of_visit_id: string | null;
    field_id: string | null;
    route_id: string | null;
    plot_id: string | null;
    source_payload: Record<string, unknown> | null;
  }>(
    `select context_id, visit_id, occurrence_id, context_kind, activity_label, activity_intent,
            participant_role, audience_scope, public_precision, risk_lane, report_consent,
            revisit_of_visit_id, field_id, route_id, plot_id, source_payload
       from civic_observation_contexts
      where visit_id = $1
      limit 1`,
    [visitId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    contextId: row.context_id,
    visitId: row.visit_id,
    occurrenceId: row.occurrence_id,
    contextKind: row.context_kind,
    activityLabel: row.activity_label,
    activityIntent: row.activity_intent,
    participantRole: row.participant_role,
    audienceScope: row.audience_scope,
    publicPrecision: row.public_precision,
    riskLane: row.risk_lane,
    reportConsent: row.report_consent,
    revisitOfVisitId: row.revisit_of_visit_id,
    fieldId: row.field_id,
    routeId: row.route_id,
    plotId: row.plot_id,
    sourcePayload: row.source_payload ?? {},
  };
}

export async function listCivicObservationContexts(visitIds: string[]): Promise<Map<string, CivicObservationContext>> {
  const ids = Array.from(new Set(visitIds.map((id) => id.trim()).filter(Boolean))).slice(0, 120);
  const contexts = new Map<string, CivicObservationContext>();
  if (ids.length === 0) return contexts;
  try {
    const result = await getPool().query<{
      context_id: string;
      visit_id: string;
      occurrence_id: string | null;
      context_kind: CivicContextKind;
      activity_label: string | null;
      activity_intent: CivicActivityIntent | null;
      participant_role: CivicParticipantRole | null;
      audience_scope: CivicAudienceScope;
      public_precision: CivicPublicPrecision;
      risk_lane: CivicRiskLane;
      report_consent: CivicReportConsent;
      revisit_of_visit_id: string | null;
      field_id: string | null;
      route_id: string | null;
      plot_id: string | null;
      source_payload: Record<string, unknown> | null;
    }>(
      `select context_id, visit_id, occurrence_id, context_kind, activity_label, activity_intent,
              participant_role, audience_scope, public_precision, risk_lane, report_consent,
              revisit_of_visit_id, field_id, route_id, plot_id, source_payload
         from civic_observation_contexts
        where visit_id = any($1::text[])`,
      [ids],
    );
    for (const row of result.rows) {
      contexts.set(row.visit_id, {
        contextId: row.context_id,
        visitId: row.visit_id,
        occurrenceId: row.occurrence_id,
        contextKind: row.context_kind,
        activityLabel: row.activity_label,
        activityIntent: row.activity_intent,
        participantRole: row.participant_role,
        audienceScope: row.audience_scope,
        publicPrecision: row.public_precision,
        riskLane: row.risk_lane,
        reportConsent: row.report_consent,
        revisitOfVisitId: row.revisit_of_visit_id,
        fieldId: row.field_id,
        routeId: row.route_id,
        plotId: row.plot_id,
        sourcePayload: row.source_payload ?? {},
      });
    }
  } catch {
    return contexts;
  }
  return contexts;
}

export function civicContextLabel(context: Pick<CivicObservationContext, "contextKind" | "activityIntent" | "activityLabel">): string {
  if (context.activityLabel) return context.activityLabel;
  if (context.contextKind === "event") return "観察会の記録";
  if (context.contextKind === "school") return "学校/クラスの自然ノート";
  if (context.contextKind === "satoyama") return "管理と観察の記録";
  if (context.contextKind === "risk") return "確認が必要な記録";
  if (context.contextKind === "site_summary") return "場所の初回自然サマリー";
  if (context.activityIntent === "revisit") return "この場所の再記録";
  return "フィールドノート";
}

export function newCivicContextId(): string {
  return `civic:${randomUUID()}`;
}
