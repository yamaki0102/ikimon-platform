import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  REGIONAL_PUBLISHERS,
  REGIONAL_SOURCE_ASSETS,
} from "../services/regionalSourceRegistry.js";
import {
  canonicalFoundationJson,
} from "../services/zukanFoundationV2RepositoryContract.js";
import {
  planRegionalSourceFoundationImport,
} from "../services/zukanFoundationV2SourceRegistryImport.js";

export type FoundationSourceImportEvidence = {
  schema: "zukan.foundation-source-import-evidence/v1";
  mode: "dry_run";
  sourceSha: string | null;
  sourceShaVerification: "git_head_clean" | "not_requested";
  tenantId: string;
  sourceRegistry: {
    publisherCount: number;
    sourceAssetCount: number;
  };
  twoRunStability: {
    firstPayloadSha256: string;
    secondPayloadSha256: string;
    stable: true;
  };
  idempotencySimulation: {
    payloadSha256: string;
    wouldInsert: 0;
    unchanged: number;
    conflicts: 0;
  };
  plan: ReturnType<typeof planRegionalSourceFoundationImport>;
};

declare const verifiedFoundationSourceSha: unique symbol;
export type VerifiedFoundationSourceSha = string & {
  readonly [verifiedFoundationSourceSha]: true;
};

export type FoundationGitStateReader = () => {
  headSha: string;
  porcelainStatus: string;
};

function readFoundationGitState(): ReturnType<FoundationGitStateReader> {
  const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
  return {
    headSha: execFileSync(
      "git",
      ["-C", repositoryRoot, "rev-parse", "HEAD"],
      { encoding: "utf8" },
    ).trim().toLowerCase(),
    porcelainStatus: execFileSync(
      "git",
      ["-C", repositoryRoot, "status", "--porcelain=v1", "--untracked-files=normal"],
      { encoding: "utf8" },
    ),
  };
}

export function verifyFoundationSourceSha(
  sourceSha: string | null,
  readGitState: FoundationGitStateReader = readFoundationGitState,
): VerifiedFoundationSourceSha | null {
  if (sourceSha === null) return null;
  const state = readGitState();
  if (state.headSha !== sourceSha) {
    throw new Error(`foundation_dry_run_source_sha_head_mismatch:${sourceSha}:${state.headSha}`);
  }
  if (state.porcelainStatus.trim().length > 0) {
    throw new Error("foundation_dry_run_source_sha_requires_clean_worktree");
  }
  return sourceSha as VerifiedFoundationSourceSha;
}

export function parseFoundationSourceImportCli(argv: readonly string[]): {
  tenantId: string;
  sourceSha: string | null;
} {
  const forbidden = argv.find((arg) =>
    arg === "--apply"
    || arg === "--write"
    || arg.startsWith("--database")
    || arg.startsWith("--execute"));
  if (forbidden) throw new Error(`foundation_dry_run_forbids:${forbidden}`);
  const unknown = argv.find((arg) =>
    !arg.startsWith("--tenant=")
    && !arg.startsWith("--source-sha="));
  if (unknown) throw new Error(`foundation_dry_run_unknown_argument:${unknown}`);
  const tenantArguments = argv.filter((arg) => arg.startsWith("--tenant="));
  const sourceShaArguments = argv.filter((arg) => arg.startsWith("--source-sha="));
  if (tenantArguments.length > 1) {
    throw new Error("foundation_dry_run_duplicate_tenant");
  }
  if (sourceShaArguments.length > 1) {
    throw new Error("foundation_dry_run_duplicate_source_sha");
  }
  const tenantId = tenantArguments.length === 0
    ? "zukan-regional-source-dry-run"
    : tenantArguments[0]!.slice("--tenant=".length).trim();
  if (tenantId.length === 0) {
    throw new Error("foundation_dry_run_tenant_must_not_be_empty");
  }
  const sourceSha = sourceShaArguments.length === 0
    ? null
    : sourceShaArguments[0]!.slice("--source-sha=".length).trim().toLowerCase();
  if (sourceSha !== null && !/^[0-9a-f]{40}$/u.test(sourceSha)) {
    throw new Error("foundation_dry_run_source_sha_must_be_full_commit");
  }
  return { tenantId, sourceSha };
}

export function buildFoundationSourceImportEvidence(input: {
  tenantId: string;
  verifiedSourceSha?: VerifiedFoundationSourceSha | null;
}): FoundationSourceImportEvidence {
  const first = planRegionalSourceFoundationImport({ tenantId: input.tenantId });
  const second = planRegionalSourceFoundationImport({ tenantId: input.tenantId });
  if (first.payloadSha256 !== second.payloadSha256) {
    throw new Error("foundation_source_import_digest_unstable");
  }
  const idempotent = planRegionalSourceFoundationImport({
    tenantId: input.tenantId,
    existing: {
      subjects: first.batch.subjects,
      sourceWorks: first.batch.sourceWorks,
      sourceEditions: first.batch.sourceEditions,
      contentFixityEvents: first.batch.contentFixityEvents,
      contentObjects: first.batch.contentObjects,
      publicIdentifiers: first.batch.publicIdentifiers,
    },
  });
  if (
    idempotent.payloadSha256 !== first.payloadSha256
    || idempotent.counts.wouldInsert !== 0
    || idempotent.counts.conflicts !== 0
    || idempotent.counts.unchanged !== first.counts.entities
  ) {
    throw new Error("foundation_source_import_idempotency_unstable");
  }
  return {
    schema: "zukan.foundation-source-import-evidence/v1",
    mode: "dry_run",
    sourceSha: input.verifiedSourceSha ?? null,
    sourceShaVerification: input.verifiedSourceSha ? "git_head_clean" : "not_requested",
    tenantId: input.tenantId,
    sourceRegistry: {
      publisherCount: REGIONAL_PUBLISHERS.length,
      sourceAssetCount: REGIONAL_SOURCE_ASSETS.length,
    },
    twoRunStability: {
      firstPayloadSha256: first.payloadSha256,
      secondPayloadSha256: second.payloadSha256,
      stable: true,
    },
    idempotencySimulation: {
      payloadSha256: idempotent.payloadSha256,
      wouldInsert: 0,
      unchanged: idempotent.counts.unchanged,
      conflicts: 0,
    },
    plan: first,
  };
}

async function main(): Promise<void> {
  const options = parseFoundationSourceImportCli(process.argv.slice(2));
  const evidence = buildFoundationSourceImportEvidence({
    tenantId: options.tenantId,
    verifiedSourceSha: verifyFoundationSourceSha(options.sourceSha),
  });
  process.stdout.write(`${canonicalFoundationJson(evidence)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main();
}
