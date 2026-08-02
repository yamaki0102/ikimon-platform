import assert from 'node:assert/strict';
import test from 'node:test';
import { planExecution } from '../lib/execution-policy.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';

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
    requested_lane: 'auto',
    cloud_deploy_runs_used: 0,
    cloud_rollback_runs_used: 0,
    rollback_proof_required: true,
    ...overrides,
  };
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

test('Cloudflare proof is blocked before local green', () => {
  const plan = planExecution(request({ requested_lane: 'cloudflare_final_proof', final_candidate_sha: SHA }));
  assert.equal(plan.status, 'BLOCKED');
  assert.equal(plan.classification, 'local_green_required_before_cloud');
});

test('Cloudflare proof requires a real runtime dependency and exact SHA', () => {
  const noRuntime = planExecution(request({ requested_lane: 'cloudflare_final_proof', local_state: 'pass', final_candidate_sha: SHA, real_runtime_dependency: false }));
  assert.equal(noRuntime.classification, 'real_runtime_dependency_required_for_cloud');

  const noSha = planExecution(request({ requested_lane: 'cloudflare_final_proof', local_state: 'pass' }));
  assert.equal(noSha.classification, 'exact_candidate_sha_required_for_cloud');
});

test('Cloudflare final proof receives only one deploy and one rollback run', () => {
  const plan = planExecution(request({ requested_lane: 'cloudflare_final_proof', local_state: 'pass', final_candidate_sha: SHA }));
  assert.equal(plan.status, 'READY');
  assert.equal(plan.lane, 'cloudflare_final_proof');
  assert.deepEqual(plan.cloud_budget, { deploy_runs_remaining: 1, rollback_runs_remaining: 1 });
  assert.equal(plan.cloud_debug_iterations_allowed, 0);

  const exhausted = planExecution(request({ requested_lane: 'cloudflare_final_proof', local_state: 'pass', final_candidate_sha: SHA, cloud_deploy_runs_used: 1 }));
  assert.equal(exhausted.status, 'BLOCKED');
  assert.equal(exhausted.classification, 'cloud_deploy_budget_exhausted');
});

test('GitHub Actions and AI API billing are forbidden by every local plan', () => {
  const plan = planExecution(request());
  assert.ok(plan.forbidden_actions.includes('github_actions'));
  assert.ok(plan.forbidden_actions.includes('ai_api_billing'));
});

test('unknown request fields fail closed', () => {
  assert.throws(() => planExecution({ ...request(), surprise: true }), /unsupported request key/);
});

test('invalid exact SHA fails closed', () => {
  assert.throws(() => planExecution(request({ final_candidate_sha: 'abc' })), /invalid final_candidate_sha/);
});
