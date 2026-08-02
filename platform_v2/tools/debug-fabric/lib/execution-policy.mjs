import { readFileSync } from 'node:fs';

const SHA40 = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const ID = /^[a-z][a-z0-9._-]{2,95}$/u;
const SCOPES = new Set(['source_analysis','test_generation','fault_injection','fix_loop','full_control_plane','final_runtime_proof']);
const RISKS = new Set(['p0','p1','p2','p3']);
const LOCAL_STATES = new Set(['not_started','running','pass','failed','blocked']);
const REQUESTED = new Set(['auto','local_luna','local_terra','cloudflare_final_proof']);
const POLICY = loadPolicy();
const THRESHOLDS = POLICY.thresholds;
const CLOUD = POLICY.lanes.cloudflare_final_proof;

export function planExecution(raw) {
  const request = validateExecutionRequest(raw);
  const cloudRequested = request.requested_lane === 'cloudflare_final_proof'
    || (request.requested_lane === 'auto' && request.scope === 'final_runtime_proof');

  if (cloudRequested) {
    if (request.local_state !== 'pass') return blocked(request, 'local_green_required_before_cloud');
    if (request.luna_passes < THRESHOLDS.cloud_minimum_luna_passes) return blocked(request, 'local_luna_pass_required_before_cloud');
    if (!request.real_runtime_dependency) return blocked(request, 'real_runtime_dependency_required_for_cloud');
    if (!request.final_candidate_sha) return blocked(request, 'exact_candidate_sha_required_for_cloud');
    if (!request.local_verified_sha || !request.local_evidence_sha256) return blocked(request, 'local_green_evidence_required_before_cloud');
    if (request.local_verified_sha !== request.final_candidate_sha) return blocked(request, 'local_verified_sha_mismatch');
    if (request.cloud_deploy_runs_used >= CLOUD.max_deploy_runs_per_sha) return blocked(request, 'cloud_deploy_budget_exhausted');
    if (request.cloud_rollback_runs_used >= CLOUD.max_rollback_runs_per_sha && request.rollback_proof_required) {
      return blocked(request, 'cloud_rollback_budget_exhausted');
    }
    return plan(request, 'cloudflare_final_proof', {
      model_role: null,
      reason: 'local_green_exact_sha_ready_for_minimal_runtime_proof',
      allowed_actions: request.rollback_proof_required
        ? ['staging_deploy','runtime_identity_readback','staging_verify','staging_rollback','rollback_readback']
        : ['staging_deploy','runtime_identity_readback','staging_verify'],
      forbidden_actions: forbiddenActions(),
      cloud_budget: {
        deploy_runs_remaining: CLOUD.max_deploy_runs_per_sha - request.cloud_deploy_runs_used,
        rollback_runs_remaining: CLOUD.max_rollback_runs_per_sha - request.cloud_rollback_runs_used,
      },
    });
  }

  const terraEligible = request.luna_passes >= THRESHOLDS.terra_minimum_luna_passes
    && request.same_signature_failures >= THRESHOLDS.terra_minimum_same_signature_failures
    && request.repository_count >= THRESHOLDS.terra_minimum_repository_count
    && ['full_control_plane','fault_injection','fix_loop'].includes(request.scope);

  if (request.requested_lane === 'local_terra') {
    if (!terraEligible) return blocked(request, 'terra_escalation_threshold_not_met');
    return localPlan(request, 'local_codex_terra', 'repeated_cross_service_failure_survived_luna_threshold');
  }

  if (request.requested_lane === 'auto' && terraEligible && request.local_state === 'failed') {
    return localPlan(request, 'local_codex_terra', 'automatic_terra_escalation_after_repeated_luna_failure');
  }

  return localPlan(request, 'local_codex_luna', request.local_state === 'failed'
    ? 'continue_luna_fix_and_regression_loop'
    : 'default_local_debug_lane');
}

export function validateExecutionRequest(raw) {
  object(raw);
  closedKeys(raw, [
    'schema','task_id','scope','risk','repository_count','local_state','luna_passes',
    'same_signature_failures','real_runtime_dependency','final_candidate_sha','local_verified_sha',
    'local_evidence_sha256','requested_lane','cloud_deploy_runs_used','cloud_rollback_runs_used',
    'rollback_proof_required'
  ]);
  if (raw.schema !== 'ikimon.debug-execution-request/v1') throw new Error('unsupported schema');
  if (!ID.test(raw.task_id ?? '')) throw new Error('invalid task_id');
  if (!SCOPES.has(raw.scope)) throw new Error('invalid scope');
  if (!RISKS.has(raw.risk)) throw new Error('invalid risk');
  const repositoryCount = integer(raw.repository_count, 1, 8);
  if (!LOCAL_STATES.has(raw.local_state)) throw new Error('invalid local_state');
  const lunaPasses = integer(raw.luna_passes, 0, 20);
  const sameSignatureFailures = integer(raw.same_signature_failures, 0, 20);
  if (typeof raw.real_runtime_dependency !== 'boolean') throw new Error('invalid real_runtime_dependency');
  const finalCandidateSha = optionalPattern(raw.final_candidate_sha, SHA40, 'invalid final_candidate_sha');
  const localVerifiedSha = optionalPattern(raw.local_verified_sha, SHA40, 'invalid local_verified_sha');
  const localEvidenceSha256 = optionalPattern(raw.local_evidence_sha256, SHA256, 'invalid local_evidence_sha256');
  if (!REQUESTED.has(raw.requested_lane)) throw new Error('invalid requested_lane');
  const cloudDeployRunsUsed = integer(raw.cloud_deploy_runs_used, 0, CLOUD.max_deploy_runs_per_sha);
  const cloudRollbackRunsUsed = integer(raw.cloud_rollback_runs_used, 0, CLOUD.max_rollback_runs_per_sha);
  if (typeof raw.rollback_proof_required !== 'boolean') throw new Error('invalid rollback_proof_required');
  return Object.freeze({
    ...raw,
    repository_count: repositoryCount,
    luna_passes: lunaPasses,
    same_signature_failures: sameSignatureFailures,
    final_candidate_sha: finalCandidateSha,
    local_verified_sha: localVerifiedSha,
    local_evidence_sha256: localEvidenceSha256,
    cloud_deploy_runs_used: cloudDeployRunsUsed,
    cloud_rollback_runs_used: cloudRollbackRunsUsed,
  });
}

function localPlan(request, lane, reason) {
  return plan(request, lane, {
    model_role: lane === 'local_codex_luna' ? 'luna' : 'terra',
    reason,
    allowed_actions: ['read_source','create_worktree','edit_source','run_local_tests','generate_fault_matrix','write_local_evidence'],
    forbidden_actions: forbiddenActions('cloudflare_deploy','cloudflare_debug_iteration'),
    cloud_budget: {
      deploy_runs_remaining: CLOUD.max_deploy_runs_per_sha - request.cloud_deploy_runs_used,
      rollback_runs_remaining: CLOUD.max_rollback_runs_per_sha - request.cloud_rollback_runs_used,
    },
  });
}

function blocked(request, classification) {
  return Object.freeze({
    schema: 'ikimon.debug-execution-plan/v1',
    task_id: request.task_id,
    status: 'BLOCKED',
    classification,
    lane: null,
    model_role: null,
    local_first_enforced: true,
    cloud_debug_iterations_allowed: 0,
    allowed_actions: Object.freeze([]),
    forbidden_actions: Object.freeze(forbiddenActions('cloudflare_deploy','cloudflare_debug_iteration')),
    exact_candidate_sha: request.final_candidate_sha,
    local_verified_sha: request.local_verified_sha,
    local_evidence_sha256: request.local_evidence_sha256,
  });
}

function plan(request, lane, detail) {
  return Object.freeze({
    schema: 'ikimon.debug-execution-plan/v1',
    task_id: request.task_id,
    status: 'READY',
    classification: detail.reason,
    lane,
    model_role: detail.model_role,
    local_first_enforced: true,
    cloud_debug_iterations_allowed: 0,
    allowed_actions: Object.freeze(detail.allowed_actions),
    forbidden_actions: Object.freeze(detail.forbidden_actions),
    cloud_budget: Object.freeze(detail.cloud_budget),
    exact_candidate_sha: request.final_candidate_sha,
    local_verified_sha: request.local_verified_sha,
    local_evidence_sha256: request.local_evidence_sha256,
  });
}

function forbiddenActions(...extras) {
  return [...new Set([...POLICY.forbidden_defaults, ...extras])];
}

function loadPolicy() {
  const value = JSON.parse(readFileSync(new URL('../policy/execution-policy.v1.json', import.meta.url), 'utf8'));
  object(value);
  if (value.schema !== 'ikimon.debug-execution-policy/v1') throw new Error('invalid execution policy schema');
  if (value.primary_lane !== 'local_codex_luna') throw new Error('invalid primary lane');
  object(value.thresholds);
  object(value.lanes);
  object(value.lanes.cloudflare_final_proof);
  for (const name of [
    'terra_minimum_luna_passes','terra_minimum_same_signature_failures',
    'terra_minimum_repository_count','cloud_minimum_luna_passes'
  ]) integer(value.thresholds[name], 1, 20);
  integer(value.lanes.cloudflare_final_proof.max_deploy_runs_per_sha, 1, 1);
  integer(value.lanes.cloudflare_final_proof.max_rollback_runs_per_sha, 1, 1);
  if (value.lanes.cloudflare_final_proof.debug_iterations_allowed !== 0) throw new Error('cloud debug iterations must be zero');
  if (!Array.isArray(value.forbidden_defaults) || value.forbidden_defaults.length < 1) throw new Error('invalid forbidden defaults');
  return Object.freeze(value);
}

function optionalPattern(value, pattern, message) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error(message);
  return value;
}
function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new Error('request must be object');
}
function closedKeys(value, allowed) {
  const set = new Set(allowed);
  if (Object.keys(value).some((key) => !set.has(key))) throw new Error('unsupported request key');
}
function integer(value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error('invalid integer');
  return value;
}
