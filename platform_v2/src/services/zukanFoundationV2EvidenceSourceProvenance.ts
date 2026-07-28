import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  type VerifiedFoundationEvidenceSourceSha,
} from "./zukanFoundationV2ReadOnlyEvidence.js";

export type FoundationEvidenceGitStateReader = () => {
  headSha: string;
  porcelainStatus: string;
};

export type VerifiedFoundationMigrationSet = {
  directory: string;
  files: Array<{
    file: string;
    sha256: string;
  }>;
  setSha256: string;
};

function comparablePath(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function verifyFoundationMigrationSet(input: {
  repositoryRoot: string;
  migrationDirectory: string;
  expectedRelativeDirectory: string;
  migrationFiles: readonly string[];
  readMigrationFile?: (absolutePath: string) => Buffer;
}): VerifiedFoundationMigrationSet {
  const relativeDirectory = input.expectedRelativeDirectory.replaceAll("\\", "/");
  if (
    path.isAbsolute(input.expectedRelativeDirectory)
    || relativeDirectory.split("/").some((part) => part === "..")
  ) {
    throw new Error("foundation_evidence_migration_directory_contract_invalid");
  }
  const expectedDirectory = path.resolve(
    input.repositoryRoot,
    input.expectedRelativeDirectory,
  );
  if (comparablePath(input.migrationDirectory) !== comparablePath(expectedDirectory)) {
    throw new Error("foundation_evidence_migration_directory_source_mismatch");
  }
  const readMigrationFile = input.readMigrationFile ?? readFileSync;
  const files = input.migrationFiles.map((file) => {
    if (path.basename(file) !== file) {
      throw new Error("foundation_evidence_migration_filename_contract_invalid");
    }
    return {
      file,
      sha256: createHash("sha256")
        .update(readMigrationFile(path.join(expectedDirectory, file)))
        .digest("hex"),
    };
  });
  const setSha256 = createHash("sha256")
    .update(files.map((item) => `${item.file}:${item.sha256}\n`).join(""))
    .digest("hex");
  return {
    directory: relativeDirectory,
    files,
    setSha256,
  };
}

export function verifyFoundationEvidenceSourceSha(input: {
  sourceSha: string;
  repositoryRoot: string;
  readGitState?: FoundationEvidenceGitStateReader;
}): VerifiedFoundationEvidenceSourceSha {
  const sourceSha = input.sourceSha.trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/u.test(sourceSha)) {
    throw new Error("foundation_evidence_source_sha_must_be_full_commit");
  }
  const state = input.readGitState?.() ?? {
    headSha: execFileSync(
      "git",
      ["-C", input.repositoryRoot, "rev-parse", "HEAD"],
      { encoding: "utf8" },
    ).trim().toLowerCase(),
    porcelainStatus: execFileSync(
      "git",
      ["-C", input.repositoryRoot, "status", "--porcelain=v1", "--untracked-files=normal"],
      { encoding: "utf8" },
    ),
  };
  if (state.headSha !== sourceSha) {
    throw new Error(`foundation_evidence_source_sha_head_mismatch:${sourceSha}:${state.headSha}`);
  }
  if (state.porcelainStatus.trim().length > 0) {
    throw new Error("foundation_evidence_source_sha_requires_clean_worktree");
  }
  return sourceSha as VerifiedFoundationEvidenceSourceSha;
}
