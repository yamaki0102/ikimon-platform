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
  assert.match(materializer, /targetEnv === "production" \? \{ source_sha: materializationSourceSha \} : \{\}/);
  assert.match(materializer, /production_materialization_source_sha_invalid/);
  assert.match(materializer, /const materializationSecret = targetEnv === "production"\s*\?\s*String\(process\.env\.IKIMON_PRODUCTION_MATERIALIZATION_JOB_SECRET \|\| ""\)\s*:\s*String\(process\.env\.IKIMON_AUTOMATION_PUSH_SECRET \|\| ""\)/);
  assert.match(materializer, /delete process\.env\.IKIMON_PRODUCTION_MATERIALIZATION_JOB_SECRET/);
  assert.match(materializer, /delete process\.env\.IKIMON_AUTOMATION_PUSH_SECRET/);
  assert.doesNotMatch(materializer, /OPS_PRODUCTION_MATERIALIZATION_HMAC_SECRET/);
  assert.match(materializer, /checkpointInterval = 25/);
  assert.match(materializer, /gatewayMaxAttempts = 5/);
  assert.match(materializer, /signed r2 gateway sync/);
  assert.doesNotMatch(materializer, /wrangler["',\s]+r2["',\s]+object/);
  const stagingRelease = await source("../../../scripts/run_cloudflare_staging_release.sh");
  assert.match(stagingRelease, /--concurrency 8/);
  const productionMaterialization = await source("../../../scripts/run_cloudflare_production_materialization.sh");
  assert.match(productionMaterialization, /exec \.\/node_modules\/\.bin\/tsx scripts\/materialize-original-ui-html\.mjs --execute --approval APPROVE_IKIMON_CF_PRODUCTION_WORKER_DEPLOY --target-env production --scope core --skip-if-unchanged --concurrency 8 --phase-result/);
  assert.match(materializer, /\.deploy\/production-phase-materialize\.json/);
  assert.match(materializer, /schema:\s*"ikimon\.production-phase-result\/v1"/);
  assert.match(materializer, /bundle_hash:\s*bundleHash/);
  assert.match(materializer, /manifest_hash:\s*manifestHash/);
});

test("production mutation phases use fixed fresh-sandbox entrypoints without secret overlap", async () => {
  const materialization = await source("../../../scripts/run_cloudflare_production_materialization.sh");
  const deploy = await source("../../../scripts/run_cloudflare_production_worker_deploy.sh");
  const combined = await source("../../../scripts/run_cloudflare_production_release.sh");

  assert.match(materialization, /ikimon\.production-phase\/v1:materialize/);
  assert.match(materialization, /production_materialization_secret_overlap_forbidden/);
  assert.match(materialization, /exec \.\/node_modules\/\.bin\/tsx/);
  assert.doesNotMatch(materialization, /\b(?:npm|npx|git)\b/);
  assert.match(deploy, /ikimon\.production-phase\/v1:deploy/);
  assert.match(deploy, /production_deploy_secret_overlap_forbidden/);
  assert.equal(deploy.match(/\.\/node_modules\/\.bin\/wrangler/g)?.length, 1);
  assert.match(deploy, /exec \.\/node_modules\/\.bin\/wrangler deploy --env production/);
  assert.doesNotMatch(deploy, /\b(?:npm|npx|git|test)\b/);
  assert.doesNotMatch(deploy, /wrangler\s+d1|migrations\s+apply/i);
  assert.match(combined, /combined_production_release_execute_forbidden/);
  assert.match(combined, /combined_production_release_secret_forbidden/);
});

test("production deploy guard remains a secretless preflight guard", async () => {
  const guard = await source("../scripts/deploy-production-guard.mjs");

  assert.match(guard, /production_execute_phase_entrypoint_required/);
  assert.match(guard, /eventCommandLine/);
  assert.match(guard, /eventCommandLine:\s*"npx wrangler deploy --env production --dry-run"/);
  assert.match(guard, /const requiredCommands = \["npm run check", testCommandForProfile\(profile\)\.commandLine, "npx wrangler deploy --env production --dry-run"\]/);
  assert.doesNotMatch(guard, /captureCloudflareReleaseToken|cloudflareDeployEnvironment/);
  assert.doesNotMatch(guard, /eventCommandLine:\s*"npx wrangler deploy --env production"/);
  assert.doesNotMatch(guard, /command:\s*actualCommandLine/);
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
  assert.match(guard, /production_execute_phase_entrypoint_required/);
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
