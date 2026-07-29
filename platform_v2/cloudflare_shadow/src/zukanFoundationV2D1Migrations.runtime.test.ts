import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, rmdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cloudflareRoot = fileURLToPath(new URL("../", import.meta.url));
const database = "ikimon_shadow_core";
const environment = "staging";

function runWrangler(
  command: readonly string[],
  args: readonly string[],
  persistPath: string,
  executionRoot: string,
) {
  const wranglerCli = path.join(executionRoot, "node_modules", "wrangler", "bin", "wrangler.js");
  const wranglerConfig = path.join(executionRoot, "wrangler.jsonc");
  const nodeOptions = process.platform === "win32"
    ? [process.env.NODE_OPTIONS, "--preserve-symlinks", "--preserve-symlinks-main"]
      .filter(Boolean)
      .join(" ")
    : process.env.NODE_OPTIONS;
  return spawnSync(
    process.execPath,
    [
      wranglerCli,
      "d1",
      ...command,
      database,
      ...args,
      "--local",
      "--persist-to",
      persistPath,
      "--env",
      environment,
      "--config",
      wranglerConfig,
    ],
    {
      cwd: cloudflareRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        CI: "1",
        NO_COLOR: "1",
        ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
      },
      maxBuffer: 10 * 1024 * 1024,
      timeout: 300_000,
    },
  );
}

test("exact D1 migrations apply through the pinned workerd runtime", { timeout: 360_000 }, () => {
  const persistPath = mkdtempSync(path.join(tmpdir(), "f2d-"));
  const shortExecutionRoot = process.platform === "win32"
    ? path.join(tmpdir(), `f2w-${process.pid}-${Date.now()}`)
    : undefined;
  if (shortExecutionRoot) {
    symlinkSync(cloudflareRoot, shortExecutionRoot, "junction");
  }
  const executionRoot = shortExecutionRoot ?? cloudflareRoot;
  try {
    const apply = runWrangler(["migrations", "apply"], [], persistPath, executionRoot);
    assert.equal(
      apply.status,
      0,
      `wrangler migrations apply failed (signal=${apply.signal ?? "none"}, error=${apply.error?.message ?? "none"})\nstdout:\n${apply.stdout}\nstderr:\n${apply.stderr}`,
    );

    const ledger = runWrangler(["execute"], [
      "--command",
      "SELECT name FROM d1_migrations ORDER BY id",
      "--json",
      "--yes",
    ], persistPath, executionRoot);
    assert.equal(
      ledger.status,
      0,
      `wrangler ledger query failed (signal=${ledger.signal ?? "none"}, error=${ledger.error?.message ?? "none"})\nstdout:\n${ledger.stdout}\nstderr:\n${ledger.stderr}`,
    );
    const response = JSON.parse(ledger.stdout) as Array<{
      success: boolean;
      results: Array<{ name: string }>;
    }>;
    assert.equal(response[0]?.success, true);
    assert.deepEqual(
      response[0]?.results.slice(-7).map((row) => row.name),
      [
        "0009_zukan_foundation_v2_source_identity.sql",
        "0010_zukan_foundation_v2_predicate_claims.sql",
        "0011_zukan_foundation_v2_authority_resolution.sql",
        "0012_zukan_foundation_v2_governance_rights.sql",
        "0013_zukan_foundation_v2_disputes_coverage.sql",
        "0014_zukan_foundation_v2_integrity_hardening.sql",
        "0015_zukan_foundation_v2_records.sql",
      ],
    );
  } finally {
    rmSync(persistPath, { recursive: true, force: true });
    if (shortExecutionRoot) {
      rmdirSync(shortExecutionRoot);
    }
  }
});
