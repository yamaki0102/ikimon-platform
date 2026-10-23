import { createHash, randomUUID } from "node:crypto";
import {
  buildNocosilExportPayload,
  type NocosilExportObservationInput,
  type NocosilExportPayload,
} from "./nocosilExportPayload.js";
import type {
  NocosilExportClaim,
  NocosilExportCreateInput,
  NocosilExportRecord,
} from "./nocosilExportRepository.js";
import { normalizeObservationDataRights } from "./observationDataRights.js";
import {
  sendNocosilExport,
  type NocosilExportResult,
} from "./nocosilExportDelivery.js";

export type NocosilExportPeriod = { start: string; end: string };

export type NocosilExportRequest = {
  /** Must come from the authenticated server session, never a request body. */
  actorUserId: string;
  siteId: string;
  period: NocosilExportPeriod;
  selectedObservationIds: string[];
  idempotencyKey: string;
  /** An explicit opt-in by the authorized site OWNER for this export. */
  allowExactCoordinates: boolean;
};

export type NocosilExportSource = {
  /** Returns the site only when actorUserId has current OWNER authority. */
  getSite(siteId: string, actorUserId: string): Promise<{ id: string; ownerUserId?: string } | null>;
  /** Loads canonical observations scoped by site, selected IDs, and period. */
  loadObservations(input: {
    siteId: string;
    actorUserId: string;
    observationIds: string[];
    period: NocosilExportPeriod;
  }): Promise<NocosilExportObservationInput[]>;
};

export type NocosilExportServiceConfig = {
  /** Feature remains off unless this value is exactly true. */
  enabled?: boolean;
  signingSecret?: string;
  endpoint?: string;
  leaseDurationMs?: number;
};

export type NocosilExportServiceDependencies = {
  source: NocosilExportSource;
  repository: NocosilExportRepositoryPort;
  config?: NocosilExportServiceConfig;
  send?: (input: { exportId: string; body: string; secret: string; endpoint?: string }) => Promise<NocosilExportResult>;
  newLeaseOwner?: () => string;
};

export type NocosilExportServiceResult =
  | { status: "disabled" }
  | { status: "denied" }
  | { status: "invalid_request" }
  | { status: "selection_unavailable" }
  | { status: "no_eligible_observations" }
  | { status: "idempotency_conflict" }
  | { status: "in_progress"; exportId: string }
  | { status: "sent"; exportId: string; replayed: boolean }
  | { status: "delivery_failed"; exportId: string; reason: string };

export type NocosilExportRepositoryPort = {
  createOrGet(input: NocosilExportCreateInput): Promise<NocosilExportRecord>;
  claim(input: { exportId: string; leaseOwner?: string; now?: string; leaseDurationMs: number }): Promise<NocosilExportClaim>;
  markSent(input: { exportId: string; leaseOwner: string; result: unknown }): Promise<void>;
  markFailed(input: { exportId: string; leaseOwner: string; error: string }): Promise<void>;
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value) ?? "null", "utf8").digest("hex");
}

function consentSnapshot(observations: NocosilExportObservationInput[]): unknown {
  return observations
    .map(({ id, rights }) => {
      const current = normalizeObservationDataRights({ ...rights, visitId: id });
      return {
        id,
        recordConsent: current.recordConsent,
        researchUseConsent: current.researchUseConsent,
        datasetLicense: current.datasetLicense,
        mediaLicense: current.mediaLicense,
        externalExportAllowed: current.externalExportAllowed,
        consentSource: current.consentSource,
        rightsPolicyVersion: current.rightsPolicyVersion,
        withdrawalStatus: current.withdrawalStatus,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function validRequest(input: NocosilExportRequest): boolean {
  return Boolean(input.actorUserId.trim() && input.siteId.trim() && input.idempotencyKey.trim())
    && input.selectedObservationIds.length > 0
    && input.selectedObservationIds.length <= 500
    && input.idempotencyKey.length <= 200
    && input.selectedObservationIds.every((id) => typeof id === "string" && id.trim().length > 0)
    && new Set(input.selectedObservationIds).size === input.selectedObservationIds.length
    && Number.isFinite(Date.parse(input.period.start))
    && Number.isFinite(Date.parse(input.period.end))
    && Date.parse(input.period.start) < Date.parse(input.period.end);
}

function isConflict(error: unknown): boolean {
  return error instanceof Error && /idempotency_key_conflict|owner_conflict/.test(error.message);
}

function bodyString(body: unknown): string {
  return typeof body === "string" ? body : canonicalJson(body);
}

/** Owner-authorized, idempotent server-side delivery. No public route is registered here. */
export async function createAndSendNocosilExport(
  input: NocosilExportRequest,
  dependencies: NocosilExportServiceDependencies,
): Promise<NocosilExportServiceResult> {
  if (dependencies.config?.enabled !== true) return { status: "disabled" };
  if (!validRequest(input)) return { status: "invalid_request" };
  if (!dependencies.config.signingSecret) throw new Error("NOCOSIL export signing secret is required when enabled");

  const site = await dependencies.source.getSite(input.siteId, input.actorUserId);
  if (!site || site.id !== input.siteId) return { status: "denied" };

  const selectedIds = [...input.selectedObservationIds].sort((left, right) => left.localeCompare(right));
  let observations: NocosilExportObservationInput[];
  try {
    observations = await dependencies.source.loadObservations({
      siteId: site.id,
      actorUserId: input.actorUserId,
      observationIds: selectedIds,
      period: input.period,
    });
  } catch (error) {
    if (error instanceof Error && /site_owner_required/.test(error.message)) return { status: "denied" };
    throw error;
  }
  const returnedIds = observations.map((observation) => observation.id).sort((left, right) => left.localeCompare(right));
  if (returnedIds.length !== selectedIds.length || returnedIds.some((id, index) => id !== selectedIds[index])) {
    return { status: "selection_unavailable" };
  }

  const currentConsent = consentSnapshot(observations);
  const payload: NocosilExportPayload = buildNocosilExportPayload({
    site: { id: site.id },
    period: input.period,
    selectedObservations: observations,
    locationPolicy: { allowExactCoordinatesForOwner: input.allowExactCoordinates === true },
  });
  if (payload.observations.length === 0) return { status: "no_eligible_observations" };

  const requestDigest = sha256({
    actorUserId: input.actorUserId,
    siteId: site.id,
    period: input.period,
    selectedObservationIds: selectedIds,
    allowExactCoordinates: input.allowExactCoordinates === true,
    consentSnapshot: currentConsent,
    payloadDigest: payload.provenanceDigest,
  });

  let record: NocosilExportRecord;
  try {
    record = await dependencies.repository.createOrGet({
      siteId: site.id,
      ownerUserId: input.actorUserId,
      idempotencyKey: input.idempotencyKey,
      requestDigest,
      bodySnapshot: payload,
      consentSnapshot: currentConsent,
    });
  } catch (error) {
    if (isConflict(error)) return { status: "idempotency_conflict" };
    throw error;
  }

  if (record.siteId !== site.id
    || record.ownerUserId !== input.actorUserId
    || record.idempotencyKey !== input.idempotencyKey
    || record.requestDigest !== requestDigest) {
    return { status: "idempotency_conflict" };
  }

  // Fail closed if stored rights differ, even if an adapter accidentally omits digest comparison.
  if (sha256(record.consentSnapshot) !== sha256(currentConsent)) {
    return { status: "idempotency_conflict" };
  }

  const leaseOwner = (dependencies.newLeaseOwner ?? randomUUID)();
  const claim = await dependencies.repository.claim({
    exportId: record.exportId,
    leaseOwner,
    leaseDurationMs: Math.min(15 * 60_000, Math.max(120_000, dependencies.config.leaseDurationMs ?? 120_000)),
  });
  if (claim.status === "sent") return { status: "sent", exportId: record.exportId, replayed: true };
  if (claim.status === "busy") return { status: "in_progress", exportId: record.exportId };
  if (claim.status === "failed") return { status: "delivery_failed", exportId: record.exportId, reason: "previous_delivery_failed" };

  if (sha256(claim.bodySnapshot) !== sha256(payload)
    || sha256(claim.consentSnapshot) !== sha256(currentConsent)) {
    await dependencies.repository.markFailed({ exportId: record.exportId, leaseOwner: claim.leaseOwner, error: "snapshot_mismatch" });
    return { status: "delivery_failed", exportId: record.exportId, reason: "snapshot_mismatch" };
  }
  if (sha256(claim.consentSnapshot) !== sha256(currentConsent)) {
    await dependencies.repository.markFailed({ exportId: record.exportId, leaseOwner: claim.leaseOwner, error: "consent_snapshot_mismatch" });
    return { status: "idempotency_conflict" };
  }

  // Use the immutable first body snapshot; the request digest and consent check bind it to current rights.
  const send = dependencies.send ?? sendNocosilExport;
  let delivery: NocosilExportResult;
  try {
    delivery = await send({
      exportId: record.exportId,
      body: bodyString(claim.bodySnapshot),
      secret: dependencies.config.signingSecret,
      ...(dependencies.config.endpoint ? { endpoint: dependencies.config.endpoint } : {}),
    });
  } catch {
    await dependencies.repository.markFailed({ exportId: record.exportId, leaseOwner: claim.leaseOwner, error: "delivery_exception" });
    return { status: "delivery_failed", exportId: record.exportId, reason: "delivery_exception" };
  }
  if (delivery.ok) {
    await dependencies.repository.markSent({
      exportId: record.exportId,
      leaseOwner: claim.leaseOwner,
      result: { status: delivery.status, attempts: delivery.attempts },
    });
    return { status: "sent", exportId: record.exportId, replayed: record.replayed };
  }

  const reason = delivery.error;
  await dependencies.repository.markFailed({ exportId: record.exportId, leaseOwner: claim.leaseOwner, error: reason });
  return { status: "delivery_failed", exportId: record.exportId, reason };
}
