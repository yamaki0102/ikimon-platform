import { createHash } from "node:crypto";

type RefKind = "place" | "record" | "quest" | "template";
type LifecycleState = "draft" | "active" | "ended" | "archived";
type ConsentState = "valid" | "unknown" | "withdrawn" | "not_applicable";
type ReviewState = "approved" | "unresolved" | "held" | "rejected" | "not_started";
type PublicationApprovalState = "approved" | "unresolved" | "held" | "rejected" | "not_started";

export type ProgramHandoverInput = {
  source: {
    programId: string;
    revision: string;
    lifecycle: LifecycleState | string;
    availableRefs: {
      placeIds: string[];
      recordIds: string[];
      questIds: string[];
      templateIds: string[];
    };
  };
  target: {
    programId: string;
    continuationId: string;
  };
  selectedRefs: {
    placeIds: string[];
    recordIds: string[];
    questIds: string[];
    templateIds: string[];
  };
  outgoingActor: {
    id: string;
    status: "active" | "removed" | "unknown" | string;
    scopeProgramId: string;
    authorized?: boolean;
    acceptedAt?: string;
  };
  incomingActor: {
    id: string;
    status: "authorized" | "pending" | "unknown" | string;
    scopeProgramId: string;
  };
  idempotency: {
    key: string;
    priorPlan?: {
      key: string;
      payloadDigest: string;
      planIdentity: string;
    };
  };
  observed: {
    observedAt: string;
    lifecycle: {
      sourceState: string;
      targetState: string;
    };
    rights: {
      boundary: "resolved" | "unresolved" | string;
      consent: ConsentState | string;
      review: ReviewState | string;
      publicationApproval: PublicationApprovalState | string;
    };
  };
};

type Responsibility = {
  actorId: string;
  status: string;
  scopeProgramId: string;
};

export type ProgramHandoverResult = {
  status: "planned" | "rejected";
  decision: "accepted" | "rejected";
  planIdentity: string;
  logicalPlanId: string | null;
  payloadDigest: string;
  provenance: {
    source: { programId: string; revision: string };
    target: { programId: string; continuationId: string };
    observedAt: string;
  };
  reuseRefs: {
    placeIds: string[];
    recordIds: string[];
    questIds: string[];
    templateIds: string[];
  };
  resetState: {
    participant: "not_started";
    consent: "not_granted";
    review: "not_started";
    publicationApproval: "not_granted";
    visibility: "private";
  };
  responsibility: {
    outgoing: Responsibility;
    incoming: Responsibility;
  };
  identityPolicy: {
    duplicateCanonicalPlaceRecord: false;
    referenceOnly: true;
  };
  nonTransferableState: string[];
  acceptanceReasons: string[];
  unresolvedReasons: string[];
  blockedReasons: string[];
  warnings: string[];
  retry: { replayed: boolean };
  sideEffects: {
    databaseWrites: 0;
    runtimeMutations: 0;
    productionMutations: 0;
  };
};

const RESET_STATE: ProgramHandoverResult["resetState"] = {
  participant: "not_started",
  consent: "not_granted",
  review: "not_started",
  publicationApproval: "not_granted",
  visibility: "private",
};

const NON_TRANSFERABLE_STATE = [
  "participant",
  "consent",
  "review",
  "publicationApproval",
  "withdrawal",
  "retention",
  "visibility",
];

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueSorted(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter(nonEmpty))].sort();
}

function isIsoTimestamp(value: unknown): boolean {
  return nonEmpty(value) && Number.isFinite(Date.parse(value));
}

function selectedRefKey(kind: RefKind): keyof ProgramHandoverInput["selectedRefs"] {
  return `${kind}Ids` as keyof ProgramHandoverInput["selectedRefs"];
}

function availableRefKey(kind: RefKind): keyof ProgramHandoverInput["source"]["availableRefs"] {
  return `${kind}Ids` as keyof ProgramHandoverInput["source"]["availableRefs"];
}

function validateRefs(input: ProgramHandoverInput, blocked: string[], selectedRefs: ProgramHandoverResult["reuseRefs"]): void {
  for (const kind of ["place", "record", "quest", "template"] as const) {
    const selected = input.selectedRefs?.[selectedRefKey(kind)];
    if (!Array.isArray(selected)) {
      blocked.push(`selected_${kind}_refs_invalid`);
      continue;
    }
    if (new Set(selected).size !== selected.length) blocked.push(`selected_${kind}_ref_duplicate`);
    if (selected.some((value) => !nonEmpty(value))) blocked.push(`selected_${kind}_ref_invalid`);
    const available = new Set(input.source?.availableRefs?.[availableRefKey(kind)] ?? []);
    for (const ref of selected) {
      if (nonEmpty(ref) && !available.has(ref)) blocked.push(`selected_${kind}_ref_unknown`);
    }
    selectedRefs[selectedRefKey(kind)] = uniqueSorted(selected);
  }
}

function payloadForDigest(input: ProgramHandoverInput, selectedRefs: ProgramHandoverResult["reuseRefs"]): unknown {
  return {
    source: {
      programId: input.source?.programId,
      revision: input.source?.revision,
      lifecycle: input.source?.lifecycle,
    },
    target: input.target,
    selectedRefs,
    outgoingActor: input.outgoingActor,
    incomingActor: input.incomingActor,
    idempotencyKey: input.idempotency?.key,
    observed: input.observed,
  };
}

export function planProgramHandover(input: ProgramHandoverInput): ProgramHandoverResult {
  const blocked: string[] = [];
  const warnings: string[] = [];
  const selectedRefs: ProgramHandoverResult["reuseRefs"] = {
    placeIds: [],
    recordIds: [],
    questIds: [],
    templateIds: [],
  };
  validateRefs(input, blocked, selectedRefs);

  if (!nonEmpty(input.source?.programId)) blocked.push("source_program_missing");
  if (!nonEmpty(input.source?.revision)) blocked.push("source_revision_missing");
  if (!nonEmpty(input.target?.programId)) blocked.push("target_program_missing");
  if (!nonEmpty(input.target?.continuationId)) blocked.push("target_continuation_missing");
  if (!isIsoTimestamp(input.observed?.observedAt)) blocked.push("observed_timestamp_missing");
  if (!isIsoTimestamp(input.outgoingActor?.acceptedAt) && input.outgoingActor?.status === "removed") {
    blocked.push("outgoing_actor_removed_without_acceptance");
  }
  if (!nonEmpty(input.outgoingActor?.id)) blocked.push("outgoing_actor_missing");
  if (input.outgoingActor?.authorized === false) blocked.push("outgoing_actor_not_authorized");
  if (nonEmpty(input.outgoingActor?.scopeProgramId) && input.outgoingActor.scopeProgramId !== input.source?.programId) {
    blocked.push("outgoing_actor_scope_mismatch");
  }
  if (input.outgoingActor?.status === "unknown" || !["active", "removed"].includes(input.outgoingActor?.status)) {
    blocked.push("outgoing_actor_status_unknown");
  }
  if (!nonEmpty(input.incomingActor?.id) || input.incomingActor?.status !== "authorized") {
    blocked.push("incoming_actor_not_authorized");
  }
  if (nonEmpty(input.incomingActor?.scopeProgramId) && input.incomingActor.scopeProgramId !== input.target?.programId) {
    blocked.push("incoming_actor_scope_mismatch");
  }
  if (!isIsoTimestamp(input.observed?.observedAt)) blocked.push("observed_timestamp_missing");
  if (input.observed?.lifecycle?.sourceState !== input.source?.lifecycle) blocked.push("lifecycle_snapshot_mismatch");
  if (input.observed?.rights?.boundary !== "resolved") blocked.push("rights_boundary_unresolved");
  if (!["valid", "not_applicable"].includes(input.observed?.rights?.consent)) blocked.push("rights_consent_unresolved");
  if (!nonEmpty(input.observed?.rights?.review)) blocked.push("review_state_missing");
  if (input.observed?.rights?.review !== "approved") warnings.push("review_reference_not_approval");
  if (input.observed?.rights?.publicationApproval !== "approved") warnings.push("publication_reference_not_approval");
  if (!nonEmpty(input.idempotency?.key)) blocked.push("idempotency_key_missing");

  const payloadDigest = digest(payloadForDigest(input, selectedRefs));
  const planIdentity = digest({ schema: "zukan.program-handover-plan/v1", payloadDigest });
  const priorPlan = input.idempotency?.priorPlan;
  let replayed = false;
  if (priorPlan) {
    if (priorPlan.key !== input.idempotency?.key) blocked.push("prior_plan_key_mismatch");
    if (priorPlan.payloadDigest !== payloadDigest) blocked.push("same_key_different_payload");
    if (priorPlan.planIdentity !== planIdentity) blocked.push("prior_plan_identity_mismatch");
    replayed = priorPlan.payloadDigest === payloadDigest && priorPlan.planIdentity === planIdentity;
  }

  const outgoingStatus = input.outgoingActor?.status === "removed"
    ? "removed_after_acceptance"
    : input.outgoingActor?.status || "unknown";
  if (outgoingStatus === "removed_after_acceptance") warnings.push("outgoing_actor_removed_after_acceptance");
  const dedupedBlocked = [...new Set(blocked)];
  const dedupedWarnings = [...new Set(warnings)];
  const accepted = dedupedBlocked.length === 0;
  const acceptanceReasons = accepted
    ? ["source_target_provenance_explicit", "selected_refs_valid", "incoming_actor_authorized", "reset_state_explicit"]
    : [];
  return {
    status: accepted ? "planned" : "rejected",
    decision: accepted ? "accepted" : "rejected",
    planIdentity,
    logicalPlanId: accepted ? `program-handover-${planIdentity.slice(0, 24)}` : null,
    payloadDigest,
    provenance: {
      source: { programId: input.source?.programId || "", revision: input.source?.revision || "" },
      target: { programId: input.target?.programId || "", continuationId: input.target?.continuationId || "" },
      observedAt: input.observed?.observedAt || "",
    },
    reuseRefs: selectedRefs,
    resetState: { ...RESET_STATE },
    responsibility: {
      outgoing: {
        actorId: input.outgoingActor?.id || "",
        status: outgoingStatus,
        scopeProgramId: input.outgoingActor?.scopeProgramId || "",
      },
      incoming: {
        actorId: input.incomingActor?.id || "",
        status: input.incomingActor?.status || "unknown",
        scopeProgramId: input.incomingActor?.scopeProgramId || "",
      },
    },
    identityPolicy: { duplicateCanonicalPlaceRecord: false, referenceOnly: true },
    nonTransferableState: [...NON_TRANSFERABLE_STATE],
    acceptanceReasons,
    unresolvedReasons: dedupedWarnings,
    blockedReasons: dedupedBlocked,
    warnings: dedupedWarnings,
    retry: { replayed },
    sideEffects: { databaseWrites: 0, runtimeMutations: 0, productionMutations: 0 },
  };
}
