import assert from 'node:assert/strict';
import test from 'node:test';
import { planExecution } from '../lib/execution-policy.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const OTHER_SHA = '89abcdef0123456789abcdef0123456789abcdef';
const DIGEST = 'a'.repeat(64);

function request(overrides = {}) {
  return {
    schema: 'ikimon.debug-execution-request/v1',
    task_id: 'ai-commander-debug',
    scope: 'full_control_plane',
    risk: 'p0',
    repository_count: 3,
    local_state: 'not_started',
    luna_passes: 0,
    same_signature_failures: 0,
    real_runtime_dependency: true,
    final_candidate_sha: null,
    local_verified_sha: null,
    local_evidence_sha256: null,
    requested_lane: 'auto',
    cloud_deploy_runs_used: 0,
    cloud_rollback_runs_used: 0,
    rollback_proof_required: true,
    ...overrides,
  };
}

function green(overrides = {}) {
  return request({
    requested_lane: 'cloudflare_final_proof',
    local_state: 'pass',
    luna_passes: 1,
    final_candidate_sha: SHA,
    local_verified_sha: SHA,
    local_evidence_sha256: DIGEST,
    ...overrides,
  });
}

test('default debug execution is local Codex Luna', () => {
  const plan = planExecution(request());
  assert.equal(plan.status, 'READY');
  assert.equal(plan.lane, 'local_codex_luna');
  assert.equal(plan.model_role, 'luna');
  assert.equal(plan.cloud_debug_iterations_allowed, 0);
  assert.ok(plan.forbidden_actions.includes('cloudflare_deploy'));
  assert.ok(plan.forbidden_actions.includes('github_actions'));
});

test('a failed Luna pass stays on Luna before escalation threshold', () => {
  const plan = planExecution(request({ local_state: 'failed', luna_passes: 2, same_signature_failures: 2 }));
  assert.equal(plan.lane, 'local_codex_luna');
  assert.equal(plan.classification, 'continue_luna_fix_and_regression_loop');
});

test('Terra is allowed only after repeated cross-service Luna failure', () => {
  const blocked = planExecution(request({ requested_lane: 'local_terra', local_state: 'failed', luna_passes: 2, same_signature_failures: 2 }));
  assert.equal(blocked.status, 'BLOCKED');
  assert.equal(blocked.classification, 'terra_escalation_threshold_not_met');

  const ready = planExecution(request({ requested_lane: 'local_terra', local_state: 'failed', luna_passes: 3, same_signature_failures: 2 }));
  assert.equal(ready.status, 'READY');
  assert.equal(ready.lane, 'local_codex_terra');
});

test('automatic escalation uses Terra only after threshold', () => {
  const plan = planExecution(request({ local_state: 'failed', luna_passes: 3, same_signature_failures: 2 }));
  assert.equal(plan.lane, 'local_codex_terra');
});

test('explicit local Luna remains local even for final-runtime-proof scope', () => {
  const plan = planExecution(request({ requested_lane: 'local_luna', scope: 'final_runtime_proof' }));
  assert.equal(plan.status, 'READY');
  assert.equal(plan.lane, 'local_codex_luna');
});

test('Cloudflare proof is blocked before local green', () => {
  const plan = planExecution(request({ requested_lane: 'cloudflare_final_proof', final_candidate_sha: SHA }));
  assert.equal(plan.status, 'BLOCKED');
  assert.equal(plan.classification, 'local_green_required_before_cloud');
});

test('self-asserted local pass without a Luna pass is blocked', () => {
  const plan = planExecution(green({ luna_passes: 0 }));
  assert.equal(plan.status, 'BLOCKED');
  assert.equal(plan.classification, 'local_luna_pass_required_before_cloud');
});

test('Cloudflare proof requires a real runtime dependency and exact SHA', () => {
  const noRuntime = planExecution(green({ real_runtime_dependency: false }));
  assert.equal(noRuntime.classification, 'real_runtime_dependency_required_for_cloud');

  const noSha = planExecution(green({ final_candidate_sha: null }));
  assert.equal(noSha.classification, 'exact_candidate_sha_required_for_cloud');
});

test('Cloudflare proof requires immutable local evidence', () => {
  const noEvidence = planExecution(green({ local_evidence_sha256: null }));
  assert.equal(noEvidence.status, 'BLOCKED');
  assert.equal(noEvidence.classification, 'local_green_evidence_required_before_cloud');

  const noVerifiedSha = planExecution(green({ local_verified_sha: null }));
  assert.equal(noVerifiedSha.classification, 'local_green_evidence_required_before_cloud');
});

test('local verified SHA must equal the final candidate SHA', () => {
  const plan = planExecution(green({ local_verified_sha: OTHER_SHA }));
  assert.equal(plan.status, 'BLOCKED');
  assert.equal(plan.classification, 'local_verified_sha_mismatch');
});

test('Cloudflare final proof receives only one deploy and one rollback run', () => {
  const plan = planExecution(green());
  assert.equal(plan.status, 'READY');
  assert.equal(plan.lane, 'cloudflare_final_proof');
  assert.deepEqual(plan.cloud_budget, { deploy_runs_remaining: 1, rollback_runs_remaining: 1 });
  assert.equal(plan.cloud_debug_iterations_allowed, 0);
  assert.equal(plan.local_verified_sha, SHA);
  assert.equal(plan.local_evidence_sha256, DIGEST);

  const exhausted = planExecution(green({ cloud_deploy_runs_used: 1 }));
  assert.equal(exhausted.status, 'BLOCKED');
  assert.equal(exhausted.classification, 'cloud_deploy_budget_exhausted');
});

test('all mutation-bearing infrastructure actions remain forbidden', () => {
  const local = planExecution(request());
  const cloud = planExecution(green());
  for (const action of [
    'github_actions','ai_api_billing','database_write','migration','secret_read','secret_write',
    'dns_write','access_write','permission_write','customer_send','external_send','cloudflare_debug_loop'
  ]) {
    assert.ok(local.forbidden_actions.includes(action), `local forbids ${action}`);
    assert.ok(cloud.forbidden_actions.includes(action), `cloud forbids ${action}`);
  }
});

test('unknown request fields fail closed', () => {
  assert.throws(() => planExecution({ ...request(), surprise: true }), /unsupported request key/);
});

test('invalid proof identities fail closed', () => {
  assert.throws(() => planExecution(request({ final_candidate_sha: 'abc' })), /invalid final_candidate_sha/);
  assert.throws(() => planExecution(request({ local_verified_sha: 'abc' })), /invalid local_verified_sha/);
  assert.throws(() => planExecution(request({ local_evidence_sha256: 'abc' })), /invalid local_evidence_sha256/);
});
