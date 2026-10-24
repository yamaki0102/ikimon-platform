import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("record detail preview guard generates an isolated workers.dev config", async () => {
  const result = spawnSync(process.execPath, [
    "scripts/deploy-record-detail-preview-guard.mjs",
    "--branch",
    "codex/record-image-preview-test",
    "--config-only",
    "--write-preflight-report",
    ".deploy/test-record-detail-preview.json",
    "--preview-config",
    ".deploy/test-record-detail-preview-wrangler.jsonc"
  ], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);

  const report = JSON.parse(await readFile(path.join(process.cwd(), ".deploy", "test-record-detail-preview.json"), "utf8")) as {
    status: string;
    workerName: string;
    workerUrl: string;
    noProductionDataMutation: boolean;
    noSharedStagingRoute: boolean;
    noCronTriggers: boolean;
    noQueueConsumers: boolean;
    previewConfigPath: string;
    previewConfigSummary: {
      routes: string[];
      triggers: unknown;
      queues: unknown;
      d1Names: string[];
      r2Buckets: string[];
    };
  };
  const config = JSON.parse(await readFile(path.join(process.cwd(), report.previewConfigPath), "utf8")) as {
    name: string;
    main: string;
    workers_dev: boolean;
    routes?: unknown[];
    triggers?: unknown;
    queues?: unknown;
    vars: Record<string, string>;
  };

  assert.equal(report.status, "record_detail_preview_config_ready");
  assert.match(report.workerName, /^ikimon-rec-preview-codex-record-image-preview-[a-f0-9]{8}$/);
  assert.ok(report.workerName.length <= 54);
  assert.equal(report.workerUrl, `https://${report.workerName}.yamaki0102.workers.dev`);
  assert.equal(report.noProductionDataMutation, true);
  assert.equal(report.noSharedStagingRoute, true);
  assert.equal(report.noCronTriggers, true);
  assert.equal(report.noQueueConsumers, true);
  assert.deepEqual(report.previewConfigSummary.routes, []);
  assert.equal(report.previewConfigSummary.triggers, null);
  assert.equal(report.previewConfigSummary.queues, null);
  assert.deepEqual(report.previewConfigSummary.d1Names, ["ikimon_shadow_core", "ikimon_shadow_observations_2026_06"]);
  assert.deepEqual(report.previewConfigSummary.r2Buckets, ["ikimon-shadow-media"]);

  assert.equal(config.name, report.workerName);
  assert.equal(config.main, "../src/index.ts");
  assert.equal(config.workers_dev, true);
  assert.equal(config.routes, undefined);
  assert.equal(config.triggers, undefined);
  assert.equal(config.queues, undefined);
  assert.equal(config.vars.ENVIRONMENT, "staging");
  assert.equal(config.vars.PREVIEW_WORKER_KIND, "record-detail");
  assert.equal(config.vars.PREVIEW_ROUTE_ISOLATION, "workers_dev_only");
});

test("record detail preview workflow is scoped to codex record/image/detail PRs", async () => {
  const workflow = await readFile(path.join(process.cwd(), "..", "..", ".github", "workflows", "deploy-record-detail-preview.yml"), "utf8");
  const guard = await readFile(path.join(process.cwd(), "scripts", "deploy-record-detail-preview-guard.mjs"), "utf8");
  const packageJson = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8")) as { scripts: Record<string, string> };

  assert.match(workflow, /name: Deploy Record Detail Preview/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /startsWith\(github\.ref_name, 'codex\/'\)/);
  assert.match(workflow, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(workflow, /startsWith\(github\.head_ref, 'codex\/'\)/);
  assert.match(workflow, /contains\(github\.head_ref, 'record'\)/);
  assert.match(workflow, /contains\(github\.head_ref, 'image'\)/);
  assert.match(workflow, /contains\(github\.head_ref, 'detail'\)/);
  assert.match(workflow, /npm run deploy:record-detail-preview:dry-run/);
  assert.match(workflow, /npx playwright install --with-deps chromium/);
  assert.match(workflow, /OBSERVATION_IMAGE_TARGET_COUNT="3" OBSERVATION_DETAIL_BASE_URL="\$\{PREVIEW_URL\}" npm run e2e:observation-image-target/);
  assert.match(workflow, /Shared staging route touched: `false`/);
  assert.match(guard, /const smokeRetryAttempts = 12;/);
  assert.match(guard, /const smokeRetryDelayMs = 5000;/);
  assert.equal(packageJson.scripts["deploy:record-detail-preview:config"], "node scripts/deploy-record-detail-preview-guard.mjs --config-only");
  assert.equal(packageJson.scripts["deploy:record-detail-preview:dry-run"], "node scripts/deploy-record-detail-preview-guard.mjs");
  assert.equal(packageJson.scripts["deploy:record-detail-preview"], "node scripts/deploy-record-detail-preview-guard.mjs --execute");
});
