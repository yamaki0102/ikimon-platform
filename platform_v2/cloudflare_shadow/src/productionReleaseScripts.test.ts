import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function source(relativeUrl: string): Promise<string> {
  return readFile(new URL(relativeUrl, import.meta.url), "utf8");
}

test("original UI materializer pins discovery documents to the public canonical origin", async () => {
  const materializer = await source("../scripts/materialize-original-ui-html.mjs");

  assert.match(materializer, /"\/llms\.txt"/);
  assert.match(materializer, /"\/llms-full\.txt"/);
  assert.match(materializer, /"x-forwarded-host":\s*"ikimon\.life"/);
  assert.match(materializer, /"x-forwarded-proto":\s*"https"/);
  assert.match(materializer, /canonical_static_origin_mismatch/);
  assert.match(materializer, /renderLlmsFull/);
});

test("production deploy guard injects and verifies the exact git SHA without overstating dry-run gates", async () => {
  const guard = await source("../scripts/deploy-production-guard.mjs");

  assert.match(guard, /IKIMON_GIT_SHA:\$\{[^}]*gitHead\}/);
  assert.match(guard, /payload\.gitSha\s*===\s*expectedGitSha/);
  assert.match(guard, /deferredSafetyGates/);
  assert.match(guard, /execute\s*\?\s*\["post_deploy_health_ready_smoke"\]\s*:\s*\[\]/);
  assert.match(guard, /eventCommandLine/);
  assert.match(guard, /"npx wrangler deploy --env production --dry-run"/);
});

test("production execute clean gate rejects dirty deploys while preserving dirty dry-runs", async () => {
  const gateUrl = new URL("../scripts/production-deploy-clean-gate.mjs", import.meta.url).href;
  const runGate = async (execute: boolean, clean: boolean, phase: string) => execFileAsync(process.execPath, [
    "--input-type=module",
    "--eval",
    `import { assertProductionExecuteWorktreeClean } from ${JSON.stringify(gateUrl)};
     assertProductionExecuteWorktreeClean({ execute: ${JSON.stringify(execute)}, state: { clean: ${JSON.stringify(clean)}, gitStatus: ${JSON.stringify(clean ? "" : " M src/index.ts")} }, phase: ${JSON.stringify(phase)} });
     process.stdout.write("gate-passed");`,
  ]);

  assert.equal((await runGate(false, false, "start")).stdout, "gate-passed");
  assert.equal((await runGate(true, true, "start")).stdout, "gate-passed");
  await assert.rejects(runGate(true, false, "start"), /production_execute_requires_clean_worktree:start/);
  await assert.rejects(runGate(true, false, "pre-deploy"), /production_execute_requires_clean_worktree:pre-deploy/);

  const guard = await source("../scripts/deploy-production-guard.mjs");
  assert.match(guard, /const worktreeGitStatus = await gitText\(\["status", "--porcelain"\]\)/);
  assert.match(guard, /if \(execute && \(!report\.clean \|\| !state\.clean\)\)/);
  assert.match(guard, /assertProductionExecuteWorktreeClean\(\{\s*execute,\s*state:\s*initialState,\s*phase:\s*"start"\s*\}\)/);
  assert.match(guard, /const preDeployState = await currentDeployState\(\);[\s\S]*assertProductionExecuteWorktreeClean\(\{\s*execute,\s*state:\s*preDeployState,\s*phase:\s*"pre-deploy"\s*\}\)/);
  assert.match(guard, /assertProductionExecuteStateUnchanged\(\{\s*execute,\s*before:\s*initialState,\s*after:\s*preDeployState,\s*phase:\s*"pre-deploy"\s*\}\)/);
});

test("production execute state gate rejects clean HEAD or deploy-input changes after preflight", async () => {
  const gateUrl = new URL("../scripts/production-deploy-clean-gate.mjs", import.meta.url).href;
  const runGate = async (execute: boolean, after: Record<string, string>) => execFileAsync(process.execPath, [
    "--input-type=module",
    "--eval",
    `import { assertProductionExecuteStateUnchanged } from ${JSON.stringify(gateUrl)};
     assertProductionExecuteStateUnchanged({ execute: ${JSON.stringify(execute)}, before: { gitHead: "sha-a", deployInputSha256: "input-a", packageLockSha256: "lock-a" }, after: ${JSON.stringify(after)}, phase: "pre-deploy" });
     process.stdout.write("gate-passed");`,
  ]);
  const unchanged = { gitHead: "sha-a", deployInputSha256: "input-a", packageLockSha256: "lock-a" };
  assert.equal((await runGate(true, unchanged)).stdout, "gate-passed");
  assert.equal((await runGate(false, { ...unchanged, gitHead: "sha-b" })).stdout, "gate-passed");
  await assert.rejects(runGate(true, { ...unchanged, gitHead: "sha-b" }), /production_execute_state_changed:pre-deploy:gitHead/);
  await assert.rejects(runGate(true, { ...unchanged, deployInputSha256: "input-b" }), /production_execute_state_changed:pre-deploy:deployInputSha256/);
});

test("production write smoke owns one unique prefix and always performs Cloudflare cleanup", async () => {
  const smoke = await source("../../e2e/production-smoke.spec.ts");

  assert.match(smoke, /randomUUID/);
  assert.match(smoke, /test\.afterAll/);
  assert.match(smoke, /POST|\.post\("\/api\/v1\/internal\/production-smoke\/cleanup"/);
  assert.match(smoke, /"x-ikimon-write-key":\s*writeKey/);
  assert.match(smoke, /V2_PRIVILEGED_WRITE_API_KEY/);
  assert.match(smoke, /cleanupZero/);
  assert.match(smoke, /cleanup\.deleted\?\.r2Objects/);
  assert.match(smoke, /production_identification_smoke/);
  assert.match(smoke, /data-identify-endpoint[^\n]*occurrenceId/);
  assert.doesNotMatch(smoke, /CLOUDFLARE_API_TOKEN/);
  assert.doesNotMatch(smoke, /spawn\(process\.execPath/);
});
