import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeControlPlaneRun, CONTROL_PLANE_LAYERS } from '../lib/control-plane.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const OTHER_SHA = '89abcdef0123456789abcdef0123456789abcdef';
const DIGEST = 'a'.repeat(64);
const TRACE = 'trace-ai-commander-20260802';

function run(overrides = {}) {
  const expectedRuntimeIdentities = Object.fromEntries(CONTROL_PLANE_LAYERS.map((layer) => [layer, SHA]));
  const observations = CONTROL_PLANE_LAYERS.map((layer) => ({
    layer,
    state: 'succeeded',
    trace_id: TRACE,
    runtime_sha: SHA,
    failure_code: null,
    retryable: false,
    evidence_sha256: DIGEST,
    attempt: 1,
  }));
  return {
    schema: 'ikimon.control-plane-run/v1',
    environment: 'staging',
    debug_run_id: 'debug-ai-commander-20260802',
    trace_id: TRACE,
    target: {
      project_id: 'ai-mail-commander',
      repository: 'yamaki0102/ai-mail-commander',
      exact_source_sha: SHA,
      action: 'validate_repository',
    },
    expected_layers: [...CONTROL_PLANE_LAYERS],
    expected_runtime_identities: expectedRuntimeIdentities,
    observations,
    ...overrides,
  };
}

test('complete exact-runtime path passes', () => {
  const result = analyzeControlPlaneRun(run());
  assert.equal(result.status, 'PASS');
  assert.equal(result.classification, 'control_plane_path_succeeded');
  assert.equal(result.responsible_layer, null);
  assert.deepEqual(result.missing_layers, []);
});

test('release authorization blocker is assigned to Release Commander', () => {
  const raw = run();
  raw.observations = raw.observations.slice(0, 5);
  raw.observations[4] = {
    ...raw.observations[4],
    state: 'blocked',
    failure_code: 'release_authorization_not_found',
    retryable: true,
  };
  const result = analyzeControlPlaneRun(raw);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.classification, 'release_authorization_not_found');
  assert.equal(result.responsible_layer, 'release_commander');
  assert.equal(result.reproducer.restart_from_layer, 'release_commander');
});

test('generic failed without a code is rejected instead of becoming an opaque failed result', () => {
  const raw = run();
  raw.observations = raw.observations.slice(0, 4);
  raw.observations[3] = {
    ...raw.observations[3],
    state: 'failed',
    failure_code: null,
  };
  const result = analyzeControlPlaneRun(raw);
  assert.equal(result.status, 'UNSAFE');
  assert.equal(result.classification, 'unclassified_terminal_failure_forbidden');
  assert.equal(result.responsible_layer, 'executor');
});

test('runtime SHA mismatch is blocked at the first mismatched layer', () => {
  const raw = run();
  raw.observations[3] = { ...raw.observations[3], runtime_sha: OTHER_SHA };
  const result = analyzeControlPlaneRun(raw);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.classification, 'control_plane_runtime_identity_mismatch');
  assert.equal(result.responsible_layer, 'executor');
  assert.deepEqual(result.runtime_mismatches, [{ layer: 'executor', expected_sha: SHA, observed_sha: OTHER_SHA }]);
});

test('target runtime expected SHA is bound to the target exact source SHA', () => {
  const raw = run();
  raw.expected_runtime_identities = { ...raw.expected_runtime_identities, target_runtime: OTHER_SHA };
  raw.observations[6] = { ...raw.observations[6], runtime_sha: OTHER_SHA };
  const result = analyzeControlPlaneRun(raw);
  assert.equal(result.status, 'UNSAFE');
  assert.equal(result.classification, 'target_runtime_expected_sha_mismatch');
  assert.equal(result.responsible_layer, 'target_runtime');
});

test('trace gap identifies the first service that failed to emit evidence', () => {
  const raw = run();
  raw.observations = raw.observations.slice(0, 3);
  const result = analyzeControlPlaneRun(raw);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.classification, 'trace_gap_at_executor');
  assert.equal(result.responsible_layer, 'executor');
});

test('started but non-terminal layer is blocked with explicit responsibility', () => {
  const raw = run();
  raw.observations = raw.observations.slice(0, 4);
  raw.observations[3] = { ...raw.observations[3], state: 'started' };
  const result = analyzeControlPlaneRun(raw);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.classification, 'layer_not_terminal_executor');
  assert.equal(result.responsible_layer, 'executor');
});

test('cross-service trace mismatch is unsafe', () => {
  const raw = run();
  raw.observations[2] = { ...raw.observations[2], trace_id: 'trace-wrong-20260802' };
  const result = analyzeControlPlaneRun(raw);
  assert.equal(result.status, 'UNSAFE');
  assert.equal(result.classification, 'cross_service_trace_id_mismatch');
  assert.equal(result.responsible_layer, 'queue');
});

test('duplicate layer evidence is unsafe', () => {
  const raw = run();
  raw.observations.push({ ...raw.observations[3] });
  const result = analyzeControlPlaneRun(raw);
  assert.equal(result.status, 'UNSAFE');
  assert.equal(result.classification, 'duplicate_layer_observation');
  assert.equal(result.responsible_layer, 'executor');
});

test('unknown failure code is unsafe and cannot be silently accepted', () => {
  const raw = run();
  raw.observations = raw.observations.slice(0, 6);
  raw.observations[5] = {
    ...raw.observations[5],
    state: 'failed',
    failure_code: 'something_broke',
  };
  const result = analyzeControlPlaneRun(raw);
  assert.equal(result.status, 'UNSAFE');
  assert.equal(result.classification, 'unknown_failure_code_for_layer');
  assert.equal(result.responsible_layer, 'release_command_bus');
});

test('retryability is owned by the analyzer, not the emitting service', () => {
  const raw = run();
  raw.observations = raw.observations.slice(0, 5);
  raw.observations[4] = {
    ...raw.observations[4],
    state: 'blocked',
    failure_code: 'release_authorization_not_found',
    retryable: false,
  };
  const result = analyzeControlPlaneRun(raw);
  assert.equal(result.status, 'UNSAFE');
  assert.equal(result.classification, 'failure_retryability_mismatch');
  assert.equal(result.responsible_layer, 'release_commander');
});

test('missing immutable evidence digest is unsafe', () => {
  const raw = run();
  raw.observations[1] = { ...raw.observations[1], evidence_sha256: '' };
  const result = analyzeControlPlaneRun(raw);
  assert.equal(result.status, 'UNSAFE');
  assert.equal(result.classification, 'observation_evidence_digest_missing');
  assert.equal(result.responsible_layer, 'command_bus');
});

test('production environment is rejected before analysis', () => {
  const result = analyzeControlPlaneRun(run({ environment: 'production' }));
  assert.equal(result.status, 'UNSAFE');
  assert.equal(result.classification, 'control_plane_environment_not_staging');
});
