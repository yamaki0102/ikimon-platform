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
  assert.match(materializer, /"x-forwarded-host":\s*"zukan\.earth"/);
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
  assert.match(materializer, /signed r2 gateway/);
  assert.match(materializer, /"--direct-staging-r2"/);
  assert.match(materializer, /--direct-staging-r2 is restricted to the fixed staging bucket/);
  assert.match(materializer, /direct_staging_materialization_exact_sha_mismatch/);
  assert.match(materializer, /"original-ui\/current\/staging\.json"/);
  assert.match(materializer, /"node_modules",\s*"wrangler",\s*"bin",\s*"wrangler\.js"/);
  assert.match(materializer, /"r2",\s*"object",\s*"put"/);
  const stagingRelease = await source("../../../scripts/run_cloudflare_staging_release.sh");
  assert.match(stagingRelease, /--concurrency 8/);
  const productionMaterialization = await source("../../../scripts/run_cloudflare_production_materialization.sh");
  assert.match(productionMaterialization, /exec \.\/node_modules\/\.bin\/tsx scripts\/materialize-original-ui-html\.mjs --execute --approval APPROVE_IKIMON_CF_PRODUCTION_WORKER_DEPLOY --target-env production --scope core --skip-if-unchanged --concurrency 8 --phase-result/);
  assert.doesNotMatch(productionMaterialization, /direct-staging-r2/);
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

test("staging runtime smoke retries a stale edge until the exact SHA is visible", async () => {
  const helperUrl = new URL("../scripts/staging-runtime-smoke.mjs", import.meta.url).href;
  const expectedSha = "a".repeat(40);
  const oldSha = "b".repeat(40);
  const { stdout } = await execFileAsync(process.execPath, [
    "--input-type=module",
    "--eval",
    `import { waitForExactStagingRuntimeVersion } from ${JSON.stringify(helperUrl)};
     const seen = [];
     const sleeps = [];
     let calls = 0;
     const result = await waitForExactStagingRuntimeVersion({
       baseUrl: "https://staging.example",
       expectedSha: ${JSON.stringify(expectedSha)},
       maxAttempts: 3,
       delayMs: 1,
       sleep: async (ms) => sleeps.push(ms),
       fetchImpl: async (url) => {
         seen.push(String(url));
         calls += 1;
         return Response.json({
           ok: true,
           service: "ikimon.life",
           environment: "staging",
           runtime: "cloudflare-worker",
           gitSha: calls === 1 ? ${JSON.stringify(oldSha)} : ${JSON.stringify(expectedSha)}
         });
       }
     });
     process.stdout.write(JSON.stringify({ attempts: result.attempts, seen, sleeps }));`,
  ]);
  const result = JSON.parse(stdout) as { attempts: number; seen: string[]; sleeps: number[] };
  assert.equal(result.attempts, 2);
  assert.deepEqual(result.sleeps, [1]);
  assert.equal(result.seen.length, 2);
  assert.notEqual(result.seen[0], result.seen[1]);
  assert.ok(result.seen.every((url) => url.includes("deploy_smoke=")));
});

test("staging runtime smoke fails closed after its bounded retry budget", async () => {
  const helperUrl = new URL("../scripts/staging-runtime-smoke.mjs", import.meta.url).href;
  const expectedSha = "c".repeat(40);
  const { stdout } = await execFileAsync(process.execPath, [
    "--input-type=module",
    "--eval",
    `import { waitForExactStagingRuntimeVersion } from ${JSON.stringify(helperUrl)};
     let calls = 0;
     try {
       await waitForExactStagingRuntimeVersion({
         baseUrl: "https://staging.example",
         expectedSha: ${JSON.stringify(expectedSha)},
         maxAttempts: 2,
         delayMs: 1,
         sleep: async () => {},
         fetchImpl: async () => {
           calls += 1;
           return Response.json({ ok: true, service: "ikimon.life", environment: "staging", runtime: "cloudflare-worker", gitSha: "d".repeat(40) });
         }
       });
       process.exit(2);
     } catch (error) {
       let invalidBudget = "";
       try {
         await waitForExactStagingRuntimeVersion({ baseUrl: "https://staging.example", expectedSha: ${JSON.stringify(expectedSha)}, maxAttempts: 31 });
       } catch (budgetError) {
         invalidBudget = budgetError.message;
       }
       process.stdout.write(JSON.stringify({ calls, message: error.message, invalidBudget }));
     }`,
  ]);
  const result = JSON.parse(stdout) as { calls: number; message: string; invalidBudget: string };
  assert.equal(result.calls, 2);
  assert.match(result.message, /staging_runtime_version_not_converged/u);
  assert.match(result.invalidBudget, /staging_runtime_smoke_max_attempts_invalid/u);
});

test("staging runtime smoke aborts every hung HTTP attempt within a bounded timeout", async () => {
  const helper = await source("../scripts/staging-runtime-smoke.mjs");
  assert.match(helper, /new AbortController\(\)/u);
  assert.match(helper, /attemptTimeoutMs/u);
  const helperUrl = new URL("../scripts/staging-runtime-smoke.mjs", import.meta.url).href;
  const expectedSha = "e".repeat(40);
  const { stdout } = await execFileAsync(process.execPath, [
    "--input-type=module",
    "--eval",
    `import { waitForExactStagingRuntimeVersion } from ${JSON.stringify(helperUrl)};
     let calls = 0;
     const attempts = [];
     try {
       await waitForExactStagingRuntimeVersion({
         baseUrl: "https://staging.example",
         expectedSha: ${JSON.stringify(expectedSha)},
         maxAttempts: 2,
         delayMs: 1,
         attemptTimeoutMs: 5,
         sleep: async () => {},
         onAttempt: (event) => attempts.push(event),
         fetchImpl: async (_url, init) => {
           calls += 1;
           return await new Promise((_resolve, reject) => {
             init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
           });
         }
       });
       process.exit(2);
     } catch (error) {
       process.stdout.write(JSON.stringify({ calls, attempts, message: error.message }));
     }`,
  ], { timeout: 2_000 });
  const result = JSON.parse(stdout) as { calls: number; attempts: Array<{ timedOut: boolean }>; message: string };
  assert.equal(result.calls, 2);
  assert.deepEqual(result.attempts.map((attempt) => attempt.timedOut), [true, true]);
  assert.match(result.message, /staging_runtime_version_not_converged/u);
});

test("staging execute rejects dirty or changed deploy inputs before mutation", async () => {
  const gateUrl = new URL("../scripts/staging-deploy-state-gate.mjs", import.meta.url).href;
  const runGate = async (execute: boolean, before: Record<string, unknown>, after: Record<string, unknown>) => execFileAsync(process.execPath, [
    "--input-type=module",
    "--eval",
    `import { assertStagingExecuteState } from ${JSON.stringify(gateUrl)};
     assertStagingExecuteState({ execute: ${JSON.stringify(execute)}, before: ${JSON.stringify(before)}, after: ${JSON.stringify(after)}, phase: "pre-deploy" });
     process.stdout.write("gate-passed");`,
  ]);
  const clean = { gitHead: "sha-a", deployInputSha256: "input-a", packageLockSha256: "lock-a", clean: true, gitStatus: "" };
  assert.equal((await runGate(false, { ...clean, clean: false }, { ...clean, clean: false })).stdout, "gate-passed");
  assert.equal((await runGate(true, clean, clean)).stdout, "gate-passed");
  await assert.rejects(runGate(true, { ...clean, clean: false, gitStatus: "?? scripts/staging-runtime-smoke.mjs" }, clean), /staging_execute_requires_clean_worktree:pre-deploy:before/u);
  await assert.rejects(runGate(true, clean, { ...clean, clean: false, gitStatus: " M src\/index.ts" }), /staging_execute_requires_clean_worktree:pre-deploy:after/u);
  await assert.rejects(runGate(true, clean, { ...clean, gitHead: "sha-b" }), /staging_execute_state_changed:pre-deploy:gitHead/u);
  await assert.rejects(runGate(true, clean, { ...clean, deployInputSha256: "input-b" }), /staging_execute_state_changed:pre-deploy:deployInputSha256/u);
  await assert.rejects(runGate(true, clean, { ...clean, packageLockSha256: "lock-b" }), /staging_execute_state_changed:pre-deploy:packageLockSha256/u);

  const guard = await source("../scripts/deploy-staging-guard.mjs");
  assert.match(guard, /scripts\/staging-runtime-smoke\.mjs/u);
  assert.match(guard, /scripts\/staging-deploy-state-gate\.mjs/u);
  assert.match(guard, /assertStagingExecuteState/u);
});
