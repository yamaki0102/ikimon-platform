import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildProductionVerificationReport,
  parseVerificationLog,
} from '../build_production_verification_report.mjs';
import {
  buildCommitStatusPayload,
  publishCommitStatus,
} from '../publish_production_verification_status.mjs';

const sha = 'a'.repeat(40);

test('verification log parser extracts phases and endpoint outcomes', () => {
  const parsed = parseVerificationLog([
    '== Production health and release identity checks ==',
    'OK https://ikimon.life/healthz -> 200',
    '== Materialized map and PWA shell checks ==',
  ].join('\n'));
  assert.deepEqual(parsed.phases, [
    'Production health and release identity checks',
    'Materialized map and PWA shell checks',
  ]);
  assert.deepEqual(parsed.endpoints, [{
    outcome: 'success',
    url: 'https://ikimon.life/healthz',
    status: 200,
  }]);
});

test('verification report is stable, non-personal and SHA-bound', () => {
  const report = buildProductionVerificationReport({
    expectedGitSha: sha,
    actualGitSha: sha,
    exitCode: 0,
    startedAt: '2026-07-12T00:00:00Z',
    finishedAt: '2026-07-12T00:01:00Z',
    smokeTier: 'targeted',
    source: 'unit-test',
    runnerId: 'test-runner',
    logPath: '/tmp/check.log',
    log: '== Health ==\nOK https://ikimon.life/healthz -> 200\n',
    runtime: { workerVersion: 'v1', deployedAt: '2026-07-12T00:00:00Z' },
  });
  assert.equal(report.status, 'success');
  assert.equal(report.shaMatches, true);
  assert.equal(report.noPersonalData, true);
  assert.equal(report.productionMutation, false);
  assert.equal(report.log.sha256.length, 64);
});

test('failed verification marks the final observed phase as failed', () => {
  const report = buildProductionVerificationReport({
    expectedGitSha: sha,
    actualGitSha: sha,
    exitCode: 1,
    startedAt: '2026-07-12T00:00:00Z',
    finishedAt: '2026-07-12T00:00:02Z',
    smokeTier: 'full',
    source: 'unit-test',
    log: '== Health ==\n== Map ==\n',
  });
  assert.equal(report.status, 'failure');
  assert.equal(report.checks.at(-1).outcome, 'failure');
});

test('commit status payload maps report outcome and stays within GitHub limits', () => {
  const payload = buildCommitStatusPayload({
    report: {
      status: 'success',
      smokeTier: 'targeted',
      checks: [{}, {}],
      endpoints: [{}],
    },
    targetUrl: 'https://github.com/example/repo/actions/runs/1',
  });
  assert.equal(payload.state, 'success');
  assert.equal(payload.context, 'ikimon/production-verification');
  assert.ok(payload.description.length <= 140);
  assert.equal(payload.target_url, 'https://github.com/example/repo/actions/runs/1');
});

test('commit status publisher posts to the exact repository SHA endpoint', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ id: 1 }), { status: 201 });
  };
  await publishCommitStatus({
    repository: 'example/repo',
    sha,
    token: 'token',
    payload: { state: 'success', context: 'test', description: 'ok' },
    fetchImpl,
  });
  assert.equal(request.url, `https://api.github.com/repos/example/repo/statuses/${sha}`);
  assert.equal(request.options.method, 'POST');
  assert.match(request.options.headers.authorization, /^Bearer /);
});

test('commit status publisher skips an unchanged context by default when requested', async () => {
  const calls = [];
  const payload = { state: 'success', context: 'test', description: 'ok' };
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    return new Response(JSON.stringify([{ id: 7, ...payload, target_url: null }]), { status: 200 });
  };
  const result = await publishCommitStatus({
    repository: 'example/repo',
    sha,
    token: 'token',
    payload,
    fetchImpl,
    skipUnchanged: true,
  });
  assert.equal(result.skipped, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/commits\/.+\/statuses\?per_page=100$/);
});

test('watch script rejects malformed runtime JSON and keeps status publishing best-effort', () => {
  const watch = readFileSync(new URL('../run_production_verification_watch.sh', import.meta.url), 'utf8');
  assert.match(watch, /if ! node -e [\s\S]*RUNTIME_TMP_PATH[\s\S]*return 1/);
  assert.match(watch, /if ! node "\$\{SCRIPT_DIR\}\/publish_production_verification_status\.mjs"[\s\S]*WARNING: GitHub production verification status publishing failed/);
  assert.match(watch, /exit "\$\{VERIFY_EXIT\}"/);
});
