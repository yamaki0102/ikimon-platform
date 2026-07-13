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
  assert.match(materializer, /renderStaticAsset\(app, pathname\)/);
  assert.match(materializer, /headers:\s*canonicalRenderHeaders/);
  assert.match(materializer, /canonical_static_origin_mismatch/);
  assert.match(materializer, /renderLlmsFull/);
  assert.match(materializer, /createHmac\("sha256", materializationSecret\)/);
  assert.match(materializer, /checkpointInterval = 25/);
  assert.match(materializer, /gatewayMaxAttempts = 5/);
  assert.match(materializer, /signed r2 gateway sync/);
  assert.doesNotMatch(materializer, /wrangler["',\s]+r2["',\s]+object/);
  const stagingRelease = await source("../../../scripts/run_cloudflare_staging_release.sh");
  assert.match(stagingRelease, /--concurrency 8/);
  const productionRelease = await source("../../../scripts/run_cloudflare_production_release.sh");
  assert.match(productionRelease, /materialize:original-ui -- --skip-if-unchanged --concurrency 8/);
});

test("production deploy guard injects and verifies the exact git SHA without exposing release vars", async () => {
  const guard = await source("../scripts/deploy-production-guard.mjs");

  assert.match(guard, /IKIMON_GIT_SHA:\s*releaseVars\.IKIMON_GIT_SHA\.trim\(\) \|\| state\.gitHead/);
  assert.match(guard, /production_release_git_sha_mismatch/);
  assert.match(guard, /payload\.gitSha\s*===\s*expectedGitSha/);
  assert.match(guard, /const SMOKE_MAX_ATTEMPTS = 12/);
  assert.match(guard, /const SMOKE_RETRY_DELAY_MS = 5_000/);
  assert.match(guard, /attempt < SMOKE_MAX_ATTEMPTS/);
  assert.match(guard, /await delay\(SMOKE_RETRY_DELAY_MS\)/);
  assert.match(guard, /deploy_check=\$\{Date\.now\(\)\}-\$\{attempt\}/);
  assert.match(guard, /actualGitSha/);
  assert.match(guard, /deferredSafetyGates/);
  assert.match(guard, /execute\s*\?\s*\["post_deploy_health_ready_smoke"\]\s*:\s*\[\]/);
  assert.match(guard, /eventCommandLine/);
  assert.match(guard, /eventCommandLine:\s*"npx wrangler deploy --env production --dry-run"/);
  assert.match(guard, /eventCommandLine:\s*"npx wrangler deploy --env production"/);
  assert.match(guard, /const requiredCommands = \["npm run check", testCommandForProfile\(profile\)\.commandLine, "npx wrangler deploy --env production --dry-run"\]/);
  assert.doesNotMatch(guard, /command:\s*actualCommandLine/);
});

test("staging release separates pre-materialization and final metadata contracts", async () => {
  const contractUrl = new URL("../scripts/staging-release-contract.mjs", import.meta.url).href;
  const runContract = async (phase: string, runtime: Record<string, unknown>, expected: Record<string, unknown>) => execFileAsync(process.execPath, [
    "--input-type=module",
    "--eval",
    `import { assertStagingRuntimeContract } from ${JSON.stringify(contractUrl)};
     assertStagingRuntimeContract(${JSON.stringify(runtime)}, ${JSON.stringify(expected)}, ${JSON.stringify(phase)});
     process.stdout.write("contract-passed");`,
  ]);
  const expected = {
    gitSha: "a".repeat(40),
    workerVersion: "cloudflare-executor-aaaaaaaaaaaa",
    uiBundleHash: "bundle-hash",
    originalUiManifestHash: "manifest-hash",
  };
  const beforeMaterialization = {
    ok: true,
    gitSha: expected.gitSha,
    workerVersion: expected.workerVersion,
    uiBundleHash: null,
    originalUiManifestHash: null,
  };

  assert.equal((await runContract("pre-materialization", beforeMaterialization, expected)).stdout, "contract-passed");
  await assert.rejects(
    runContract("post-materialization", beforeMaterialization, expected),
    /staging_runtime_contract_failed:post-materialization/,
  );
  const afterMaterialization = {
    ...beforeMaterialization,
    uiBundleHash: expected.uiBundleHash,
    originalUiManifestHash: expected.originalUiManifestHash,
  };
  assert.equal((await runContract("post-materialization", afterMaterialization, expected)).stdout, "contract-passed");

  const stagingRelease = await source("../../../scripts/run_cloudflare_staging_release.sh");
  assert.match(stagingRelease, /materialize-staging-original-ui\.json/);
  assert.match(stagingRelease, /--release-phase post-materialization/);
  assert.match(stagingRelease, /Materialized staging UI release identity is incomplete/);
  assert.match(stagingRelease, /report\.pointerVerified !== true/);

  const guard = await source("../scripts/deploy-staging-guard.mjs");
  assert.match(guard, /runtime_release_identity_match/);
  assert.match(guard, /uploadSkipped: true/);
  assert.match(guard, /const SMOKE_MAX_ATTEMPTS = 12/);
  assert.match(guard, /const SMOKE_RETRY_DELAY_MS = 5_000/);
  assert.match(guard, /attempt <= SMOKE_MAX_ATTEMPTS/);
  assert.match(guard, /await delay\(SMOKE_RETRY_DELAY_MS\)/);
  assert.match(guard, /release_smoke=\$\{Date\.now\(\)\}-\$\{attempt\}/);
  const materializer = await source("../scripts/materialize-original-ui-html.mjs");
  assert.match(materializer, /materialization_pointer_identity_mismatch/);
  assert.match(materializer, /pointerVerified = true/);
});

test("production execute clean gate allows only owned generated deploy artifacts", async () => {
  const gateUrl = new URL("../scripts/production-deploy-clean-gate.mjs", import.meta.url).href;
  const runGate = async (execute: boolean, clean: boolean, phase: string, status: string) => execFileAsync(process.execPath, [
    "--input-type=module",
    "--eval",
    `import { assertProductionExecuteWorktreeClean } from ${JSON.stringify(gateUrl)};
     assertProductionExecuteWorktreeClean({ execute: ${JSON.stringify(execute)}, state: { worktreeClean: ${JSON.stringify(clean)}, worktreeGitStatus: ${JSON.stringify(status)} }, phase: ${JSON.stringify(phase)} });
     process.stdout.write("gate-passed");`,
  ]);

  assert.equal((await runGate(false, false, "start", " M src/index.ts")).stdout, "gate-passed");
  assert.equal((await runGate(true, true, "start", "")).stdout, "gate-passed");
  assert.equal((await runGate(true, false, "start", "?? .cache/")).stdout, "gate-passed");
  assert.equal((await runGate(true, false, "start", "?? platform_v2/cloudflare_shadow/materialize-original-ui.json")).stdout, "gate-passed");
  assert.equal((await runGate(true, false, "start", "?? materialize-original-ui.json")).stdout, "gate-passed");
  await assert.rejects(runGate(true, false, "start", " M src/index.ts"), /production_execute_requires_clean_worktree:start/);
  await assert.rejects(runGate(true, false, "pre-deploy", "?? unexpected.json"), /production_execute_requires_clean_worktree:pre-deploy/);
  await assert.rejects(
    runGate(true, false, "pre-deploy", "?? .cache/\n M src/index.ts"),
    /src\/index\.ts/,
  );
  await assert.rejects(
    runGate(true, false, "pre-deploy", "?? platform_v2/cloudflare_shadow/materialize-original-ui.json\n M src/index.ts"),
    /src\/index\.ts/,
  );

  const guard = await source("../scripts/deploy-production-guard.mjs");
  assert.match(guard, /const worktreeGitStatus = await gitText\(\["status", "--porcelain"\]\)/);
  assert.match(guard, /if \(execute && \(!report\.clean \|\| !state\.clean\)\)/);
  assert.match(guard, /assertProductionExecuteWorktreeClean\(\{ execute, state: initialState, phase: "start" \}\)/);
  assert.match(guard, /const preDeployState = await currentDeployState\(\);[\s\S]*assertProductionExecuteWorktreeClean\(\{ execute, state: preDeployState, phase: "pre-deploy" \}\)/);
});

test("production execute state gate rejects HEAD or deploy-input changes after preflight", async () => {
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
  await assert.rejects(runGate(true, { ...unchanged, packageLockSha256: "lock-b" }), /production_execute_state_changed:pre-deploy:packageLockSha256/);
});
