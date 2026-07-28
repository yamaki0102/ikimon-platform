import {
  ZUKAN_FOUNDATION_SOURCE_IMPORT_OPERATION,
  foundationSourceImportEntityCount,
  validateFoundationWriteRequest,
  withFoundationDialect,
  type FoundationDialect,
  type FoundationRepositoryCapabilities,
  type FoundationSourceImportOperation,
  type FoundationWriteOutcome,
  type FoundationWriteRequest,
  type ZukanFoundationV2Repository,
} from "./zukanFoundationV2RepositoryContract.js";
import type {
  VerifiedFoundationEvidenceSourceSha,
} from "./zukanFoundationV2ReadOnlyEvidence.js";

export type FoundationShadowReadMode = "off" | "shadow";
export type FoundationDualWriteMode = "off" | "on";

export type FoundationRolloutConfig = {
  shadowReadMode: FoundationShadowReadMode;
  dualWriteMode: FoundationDualWriteMode;
  writeKillSwitch: boolean;
  allowedTenants: string[];
  allowedOperations: FoundationSourceImportOperation[];
  maxEntities: number;
  invalidValues: string[];
};

function commaValues(raw: string | undefined): string[] {
  return [...new Set(
    (raw ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  )].sort();
}

function explicitBoolean(raw: string | undefined, fallback: boolean, invalidValues: string[], key: string): boolean {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === undefined || normalized === "") return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  invalidValues.push(`${key}:${raw}`);
  return fallback;
}

export function loadFoundationRolloutConfig(
  environment: Readonly<Record<string, string | undefined>>,
): FoundationRolloutConfig {
  const invalidValues: string[] = [];
  const shadowRaw = environment.ZUKAN_FOUNDATION_V2_SHADOW_READ_MODE?.trim().toLowerCase();
  const dualRaw = environment.ZUKAN_FOUNDATION_V2_DUAL_WRITE_MODE?.trim().toLowerCase();
  const shadowReadMode: FoundationShadowReadMode = shadowRaw === "shadow" ? "shadow" : "off";
  const dualWriteMode: FoundationDualWriteMode = dualRaw === "on" ? "on" : "off";
  if (shadowRaw && shadowRaw !== "off" && shadowRaw !== "shadow") {
    invalidValues.push(`ZUKAN_FOUNDATION_V2_SHADOW_READ_MODE:${shadowRaw}`);
  }
  if (dualRaw && dualRaw !== "off" && dualRaw !== "on") {
    invalidValues.push(`ZUKAN_FOUNDATION_V2_DUAL_WRITE_MODE:${dualRaw}`);
  }
  const requestedOperations = commaValues(environment.ZUKAN_FOUNDATION_V2_ALLOWED_OPERATIONS);
  const allowedOperations = requestedOperations.includes(ZUKAN_FOUNDATION_SOURCE_IMPORT_OPERATION)
    ? [ZUKAN_FOUNDATION_SOURCE_IMPORT_OPERATION]
    : [];
  for (const operation of requestedOperations) {
    if (operation !== ZUKAN_FOUNDATION_SOURCE_IMPORT_OPERATION) {
      invalidValues.push(`ZUKAN_FOUNDATION_V2_ALLOWED_OPERATIONS:${operation}`);
    }
  }
  const maxRaw = environment.ZUKAN_FOUNDATION_V2_MAX_ENTITIES?.trim();
  const parsedMax = Number.parseInt(maxRaw ?? "", 10);
  const maxEntities = !maxRaw
    ? 64
    : Number.isInteger(parsedMax) && String(parsedMax) === maxRaw && parsedMax >= 1 && parsedMax <= 64
      ? parsedMax
      : 0;
  if (maxRaw && maxEntities === 0) {
    invalidValues.push(`ZUKAN_FOUNDATION_V2_MAX_ENTITIES:${maxRaw}`);
  }

  return {
    shadowReadMode,
    dualWriteMode,
    writeKillSwitch: explicitBoolean(
      environment.ZUKAN_FOUNDATION_V2_WRITE_KILL_SWITCH,
      true,
      invalidValues,
      "ZUKAN_FOUNDATION_V2_WRITE_KILL_SWITCH",
    ),
    allowedTenants: commaValues(environment.ZUKAN_FOUNDATION_V2_ALLOWED_TENANTS),
    allowedOperations,
    maxEntities,
    invalidValues: invalidValues.sort(),
  };
}

export type FoundationShadowDigest = {
  digest: string;
  count: number;
};

export type FoundationShadowReadOutcome = {
  status: "off" | "match" | "mismatch" | "unavailable";
  canonical: FoundationShadowDigest;
  shadow: FoundationShadowDigest | null;
};

export async function compareFoundationShadowRead(input: {
  mode: FoundationShadowReadMode;
  canonical: FoundationShadowDigest;
  readShadow: () => Promise<FoundationShadowDigest>;
}): Promise<FoundationShadowReadOutcome> {
  if (input.mode === "off") {
    return { status: "off", canonical: input.canonical, shadow: null };
  }
  try {
    const shadow = await input.readShadow();
    return {
      status: shadow.digest === input.canonical.digest && shadow.count === input.canonical.count
        ? "match"
        : "mismatch",
      canonical: input.canonical,
      shadow,
    };
  } catch {
    return { status: "unavailable", canonical: input.canonical, shadow: null };
  }
}

export type FoundationDualWriteOutcome = {
  status: "disabled" | "blocked" | "succeeded";
  auditCode:
    | "dual_write_off"
    | "invalid_rollout_config"
    | "kill_switch_active"
    | "write_policy_blocked"
    | "dual_write_succeeded";
  outcomes: FoundationWriteOutcome[];
};

export type FoundationDualWriteAuditDialectOutcome = {
  dialect: FoundationDialect;
  status:
    | "not_attempted"
    | "available"
    | "unavailable"
    | "succeeded"
    | "replayed"
    | "blocked"
    | "rejected";
  auditCode: FoundationWriteOutcome["auditCode"] | null;
  errorCode: string | null;
};

export type FoundationDualWriteTargetIdentity = {
  postgresHost: string;
  postgresPort: number;
  postgresDatabase: string;
  d1AccountId: string;
  d1DatabaseId: string;
  d1DatabaseName: string;
};

export type FoundationDualWriteAuditEvent = {
  schema: "zukan.foundation-v2-dual-write-audit/v2";
  attemptId: string;
  recordedAt: string;
  sourceCommitSha: string;
  phase:
    | "requested"
    | "disabled"
    | "blocked"
    | "preflight_failed"
    | "partial_failure"
    | "succeeded";
  tenantId: string;
  operation: FoundationSourceImportOperation;
  idempotencyKey: string;
  target: FoundationDualWriteTargetIdentity;
  payloadSha256: string;
  entityCount: number;
  retryRequired: boolean;
  killSwitchRecommended: boolean;
  outcomes: FoundationDualWriteAuditDialectOutcome[];
};

export interface FoundationDualWriteAuditSink {
  appendDurable(event: FoundationDualWriteAuditEvent): Promise<void>;
}

export class FoundationDualWriteError extends Error {
  constructor(
    message: string,
    readonly settled: PromiseSettledResult<FoundationWriteOutcome>[],
    readonly auditEvent: FoundationDualWriteAuditEvent,
    readonly auditPersisted = true,
  ) {
    super(message);
    this.name = "FoundationDualWriteError";
  }
}

export class FoundationDualWriteAuditPersistenceError extends Error {
  constructor(
    readonly auditEvent: FoundationDualWriteAuditEvent,
  ) {
    super("foundation_dual_write_audit_persistence_failed");
    this.name = "FoundationDualWriteAuditPersistenceError";
  }
}

function capabilityAuditOutcome(input: {
  dialect: FoundationDialect;
  result: PromiseSettledResult<FoundationRepositoryCapabilities>;
}): FoundationDualWriteAuditDialectOutcome {
  if (input.result.status === "rejected") {
    return {
      dialect: input.dialect,
      status: "unavailable",
      auditCode: null,
      errorCode: "foundation_repository_capability_rejected",
    };
  }
  return {
    dialect: input.dialect,
    status: input.result.value.available ? "available" : "unavailable",
    auditCode: null,
    errorCode: input.result.value.available
      ? null
      : input.result.value.blockers[0] ?? "foundation_repository_unavailable",
  };
}

function writeAuditOutcome(input: {
  dialect: FoundationDialect;
  result: PromiseSettledResult<FoundationWriteOutcome>;
}): FoundationDualWriteAuditDialectOutcome {
  if (input.result.status === "rejected") {
    return {
      dialect: input.dialect,
      status: "rejected",
      auditCode: null,
      errorCode: "foundation_dual_write_repository_rejected",
    };
  }
  return {
    dialect: input.dialect,
    status: input.result.value.status === "disabled"
      ? "blocked"
      : input.result.value.status,
    auditCode: input.result.value.auditCode,
    errorCode: null,
  };
}

export async function runBoundedFoundationDualWrite(input: {
  config: FoundationRolloutConfig;
  repositories: readonly ZukanFoundationV2Repository[];
  request: Omit<FoundationWriteRequest, "policy">;
  audit: {
    attemptId: string;
    sourceCommitSha: VerifiedFoundationEvidenceSourceSha;
    target: FoundationDualWriteTargetIdentity;
    sink: FoundationDualWriteAuditSink;
    now?: () => string;
  };
}): Promise<FoundationDualWriteOutcome> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(input.audit.attemptId)) {
    throw new Error("foundation_dual_write_audit_attempt_id_invalid");
  }
  if (!/^[0-9a-f]{40}$/u.test(input.audit.sourceCommitSha)) {
    throw new Error("foundation_dual_write_source_sha_must_be_exact_commit");
  }
  const now = input.audit.now ?? (() => new Date().toISOString());
  const appendAudit = async (
    phase: FoundationDualWriteAuditEvent["phase"],
    options: {
      outcomes?: FoundationDualWriteAuditDialectOutcome[];
      retryRequired?: boolean;
      killSwitchRecommended?: boolean;
    } = {},
  ): Promise<FoundationDualWriteAuditEvent> => {
    const event: FoundationDualWriteAuditEvent = {
      schema: "zukan.foundation-v2-dual-write-audit/v2",
      attemptId: input.audit.attemptId,
      recordedAt: now(),
      sourceCommitSha: input.audit.sourceCommitSha,
      phase,
      tenantId: input.request.batch.tenantId,
      operation: input.request.batch.operation,
      idempotencyKey: input.request.idempotencyKey,
      target: input.audit.target,
      payloadSha256: input.request.batch.payloadSha256,
      entityCount: foundationSourceImportEntityCount(input.request.batch),
      retryRequired: options.retryRequired ?? false,
      killSwitchRecommended: options.killSwitchRecommended ?? false,
      outcomes: options.outcomes ?? [],
    };
    try {
      await input.audit.sink.appendDurable(event);
    } catch {
      throw new FoundationDualWriteAuditPersistenceError(event);
    }
    return event;
  };

  await appendAudit("requested", {
    outcomes: input.repositories.map((repository) => ({
      dialect: repository.dialect,
      status: "not_attempted",
      auditCode: null,
      errorCode: null,
    })),
  });

  if (input.config.dualWriteMode !== "on") {
    await appendAudit("disabled");
    return { status: "disabled", auditCode: "dual_write_off", outcomes: [] };
  }
  if (input.config.invalidValues.length > 0) {
    await appendAudit("blocked", {
      outcomes: [],
    });
    return { status: "blocked", auditCode: "invalid_rollout_config", outcomes: [] };
  }
  if (input.config.writeKillSwitch) {
    await appendAudit("blocked", {
      killSwitchRecommended: true,
    });
    return { status: "blocked", auditCode: "kill_switch_active", outcomes: [] };
  }
  if (input.repositories.length !== 2 || new Set(input.repositories.map((item) => item.dialect)).size !== 2) {
    await appendAudit("blocked", {
      outcomes: input.repositories.map((repository) => ({
        dialect: repository.dialect,
        status: "not_attempted",
        auditCode: null,
        errorCode: "foundation_dual_write_requires_postgres_and_d1",
      })),
    });
    throw new Error("foundation_dual_write_requires_postgres_and_d1");
  }
  const policy = {
    enabled: true,
    killSwitch: input.config.writeKillSwitch,
    allowedTenants: input.config.allowedTenants,
    allowedOperations: input.config.allowedOperations,
    maxEntities: input.config.maxEntities,
  } as const;
  const policyBlock = await validateFoundationWriteRequest({
    ...input.request,
    policy,
  });
  if (policyBlock) {
    const outcomes = input.repositories.map((repository) =>
      withFoundationDialect(policyBlock, repository.dialect));
    await appendAudit("blocked", {
      outcomes: outcomes.map((outcome) => ({
        dialect: outcome.dialect,
        status: "blocked",
        auditCode: outcome.auditCode,
        errorCode: null,
      })),
    });
    return { status: "blocked", auditCode: "write_policy_blocked", outcomes };
  }

  const capabilitySettled = await Promise.allSettled(
    input.repositories.map((repository) => repository.capabilities()),
  );
  const capabilityOutcomes = capabilitySettled.map((result, index) =>
    capabilityAuditOutcome({
      dialect: input.repositories[index]!.dialect,
      result,
    }));
  if (capabilityOutcomes.some((outcome) => outcome.status !== "available")) {
    await appendAudit("preflight_failed", {
      outcomes: capabilityOutcomes,
      retryRequired: true,
    });
    throw new Error("foundation_dual_write_capability_preflight_failed");
  }

  const settled = await Promise.allSettled(
    input.repositories.map((repository) => repository.applySourceImport({
      ...input.request,
      policy,
    })),
  );
  const auditOutcomes = settled.map((result, index) =>
    writeAuditOutcome({
      dialect: input.repositories[index]!.dialect,
      result,
    }));
  const appendPostWriteAudit = async (
    phase: FoundationDualWriteAuditEvent["phase"],
    options: {
      outcomes: FoundationDualWriteAuditDialectOutcome[];
      retryRequired?: boolean;
      killSwitchRecommended?: boolean;
    },
  ): Promise<FoundationDualWriteAuditEvent> => {
    try {
      return await appendAudit(phase, options);
    } catch (error) {
      if (!(error instanceof FoundationDualWriteAuditPersistenceError)) throw error;
      throw new FoundationDualWriteError(
        "foundation_dual_write_terminal_audit_failed",
        settled,
        {
          ...error.auditEvent,
          phase: "partial_failure",
          retryRequired: true,
          killSwitchRecommended: true,
        },
        false,
      );
    }
  };
  if (settled.some((result) => result.status === "rejected")) {
    const auditEvent = await appendPostWriteAudit("partial_failure", {
      outcomes: auditOutcomes,
      retryRequired: true,
      killSwitchRecommended: true,
    });
    throw new FoundationDualWriteError(
      "foundation_dual_write_partial_failure",
      settled,
      auditEvent,
    );
  }
  const outcomes = settled.map((result) => {
    if (result.status === "rejected") throw result.reason;
    return result.value;
  });
  if (outcomes.some((outcome) => outcome.status !== "succeeded" && outcome.status !== "replayed")) {
    const hasCommittedWrite = outcomes.some((outcome) =>
      outcome.status === "succeeded" || outcome.status === "replayed");
    const auditEvent = await appendPostWriteAudit(
      hasCommittedWrite ? "partial_failure" : "blocked",
      {
        outcomes: auditOutcomes,
        retryRequired: hasCommittedWrite,
        killSwitchRecommended: hasCommittedWrite,
      },
    );
    throw new FoundationDualWriteError(
      hasCommittedWrite
        ? "foundation_dual_write_partial_failure"
        : "foundation_dual_write_policy_blocked",
      settled,
      auditEvent,
    );
  }
  await appendPostWriteAudit("succeeded", {
    outcomes: auditOutcomes,
  });
  return { status: "succeeded", auditCode: "dual_write_succeeded", outcomes };
}
