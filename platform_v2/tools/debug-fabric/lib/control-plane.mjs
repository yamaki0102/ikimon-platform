const SHA40 = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const IDENTIFIER = /^[a-z][a-z0-9._-]{0,63}$/u;
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const REPOSITORY = /^yamaki0102\/[A-Za-z0-9._-]+$/u;

export const CONTROL_PLANE_LAYERS = Object.freeze([
  'intake',
  'command_bus',
  'queue',
  'executor',
  'release_commander',
  'release_command_bus',
  'target_runtime',
]);

const TERMINAL_STATES = new Set(['succeeded', 'blocked', 'failed', 'unsafe']);
const OBSERVATION_STATES = new Set(['accepted', 'started', ...TERMINAL_STATES]);
const ACTIONS = new Set(['validate_repository', 'dry_run', 'deploy', 'verify', 'rollback']);

const FAILURE_CODES = Object.freeze({
  intake: new Set([
    'intake_schema_invalid',
    'intake_identity_mismatch',
    'intake_organization_mismatch',
    'intake_repository_mismatch',
  ]),
  command_bus: new Set([
    'command_project_unregistered',
    'command_action_not_allowed',
    'command_environment_not_allowed',
    'command_signature_invalid',
    'command_enqueue_failed',
  ]),
  queue: new Set([
    'queue_publish_failed',
    'queue_delivery_timeout',
    'queue_duplicate_delivery',
    'queue_ack_failed',
  ]),
  executor: new Set([
    'executor_checkout_failed',
    'executor_source_identity_mismatch',
    'executor_validation_failed',
    'executor_lease_stale',
    'executor_evidence_upload_failed',
    'cloudflare_credential_missing',
    'cloudflare_credential_scope_insufficient',
  ]),
  release_commander: new Set([
    'release_authorization_not_found',
    'release_state_invalid',
    'release_reconcile_failed',
    'release_create_failed',
  ]),
  release_command_bus: new Set([
    'release_bridge_authorization_failed',
    'release_bridge_operation_failed',
    'release_command_bus_binding_unavailable',
    'release_command_bus_identity_mismatch',
  ]),
  target_runtime: new Set([
    'target_deploy_failed',
    'target_runtime_identity_mismatch',
    'target_verify_failed',
    'target_rollback_failed',
    'target_binding_missing',
    'github_credential_missing',
    'github_credential_scope_insufficient',
    'github_source_unhealthy',
  ]),
});

class ControlPlaneError extends Error {
  constructor(status, classification, responsibleLayer = null) {
    super(classification);
    this.name = 'ControlPlaneError';
    this.status = status;
    this.classification = classification;
    this.responsibleLayer = responsibleLayer;
  }
}

export function analyzeControlPlaneRun(raw) {
  try {
    const run = validateRun(raw);
    return analyzeValidated(run);
  } catch (error) {
    if (error instanceof ControlPlaneError) {
      return result({
        run: null,
        status: error.status,
        classification: error.classification,
        responsibleLayer: error.responsibleLayer,
      });
    }
    return result({ run: null, status: 'UNSAFE', classification: 'control_plane_manifest_invalid' });
  }
}

function validateRun(raw) {
  object(raw, 'control-plane run');
  keys(raw, [
    'schema',
    'environment',
    'debug_run_id',
    'trace_id',
    'target',
    'expected_layers',
    'expected_runtime_identities',
    'observations',
  ], 'control-plane run');

  if (raw.schema !== 'ikimon.control-plane-run/v1') {
    throw new ControlPlaneError('UNSAFE', 'unsupported_control_plane_schema');
  }
  if (raw.environment !== 'staging') {
    throw new ControlPlaneError('UNSAFE', 'control_plane_environment_not_staging');
  }
  if (!RUN_ID.test(raw.debug_run_id ?? '')) throw new Error('invalid debug_run_id');
  if (!RUN_ID.test(raw.trace_id ?? '')) throw new Error('invalid trace_id');

  const target = targetSpec(raw.target);
  const expectedLayers = layerList(raw.expected_layers);
  const expectedRuntimeIdentities = runtimeIdentities(raw.expected_runtime_identities, expectedLayers);
  const observations = observationList(raw.observations, raw.trace_id, expectedLayers);

  return Object.freeze({
    schema: raw.schema,
    environment: raw.environment,
    debug_run_id: raw.debug_run_id,
    trace_id: raw.trace_id,
    target,
    expected_layers: expectedLayers,
    expected_runtime_identities: expectedRuntimeIdentities,
    observations,
  });
}

function analyzeValidated(run) {
  const byLayer = new Map(run.observations.map((observation) => [observation.layer, observation]));

  for (const layer of run.expected_layers) {
    const observation = byLayer.get(layer);
    if (!observation) {
      return result({
        run,
        status: 'BLOCKED',
        classification: `trace_gap_at_${layer}`,
        responsibleLayer: layer,
      });
    }

    const expectedSha = run.expected_runtime_identities[layer];
    if (observation.runtime_sha !== expectedSha) {
      return result({
        run,
        status: 'BLOCKED',
        classification: 'control_plane_runtime_identity_mismatch',
        responsibleLayer: layer,
        runtimeMismatches: [{ layer, expected_sha: expectedSha, observed_sha: observation.runtime_sha }],
      });
    }

    if (!TERMINAL_STATES.has(observation.state)) {
      return result({
        run,
        status: 'BLOCKED',
        classification: `layer_not_terminal_${layer}`,
        responsibleLayer: layer,
      });
    }

    if (observation.state !== 'succeeded') {
      const status = observation.state === 'unsafe'
        ? 'UNSAFE'
        : observation.state === 'failed'
          ? 'FAIL'
          : 'BLOCKED';
      return result({
        run,
        status,
        classification: observation.failure_code,
        responsibleLayer: layer,
        retryable: observation.retryable,
      });
    }
  }

  return result({
    run,
    status: 'PASS',
    classification: 'control_plane_path_succeeded',
    responsibleLayer: null,
  });
}

function result({ run, status, classification, responsibleLayer = null, retryable = false, runtimeMismatches = [] }) {
  const target = run?.target ?? null;
  const observedLayers = run?.observations.map((entry) => entry.layer) ?? [];
  const missingLayers = run?.expected_layers.filter((layer) => !observedLayers.includes(layer)) ?? [];
  const expectedRuntimeSha = responsibleLayer && run ? run.expected_runtime_identities[responsibleLayer] : null;
  return Object.freeze({
    schema: 'ikimon.control-plane-result/v1',
    debug_run_id: run?.debug_run_id ?? null,
    trace_id: run?.trace_id ?? null,
    environment: run?.environment ?? null,
    target,
    status,
    classification,
    responsible_layer: responsibleLayer,
    retryable: Boolean(retryable),
    observed_layers: Object.freeze(observedLayers),
    missing_layers: Object.freeze(missingLayers),
    runtime_mismatches: Object.freeze(runtimeMismatches),
    reproducer: responsibleLayer && run
      ? Object.freeze({
          schema: 'ikimon.control-plane-reproducer/v1',
          debug_run_id: run.debug_run_id,
          trace_id: run.trace_id,
          restart_from_layer: responsibleLayer,
          expected_runtime_sha: expectedRuntimeSha,
          failure_code: classification,
          target,
        })
      : null,
  });
}

function targetSpec(raw) {
  object(raw, 'target');
  keys(raw, ['project_id', 'repository', 'exact_source_sha', 'action'], 'target');
  if (!IDENTIFIER.test(raw.project_id ?? '')) throw new Error('invalid project_id');
  if (!REPOSITORY.test(raw.repository ?? '')) throw new Error('invalid repository');
  if (!SHA40.test(raw.exact_source_sha ?? '')) throw new Error('invalid exact_source_sha');
  if (!ACTIONS.has(raw.action)) throw new Error('invalid action');
  return Object.freeze({
    project_id: raw.project_id,
    repository: raw.repository,
    exact_source_sha: raw.exact_source_sha,
    action: raw.action,
  });
}

function layerList(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > CONTROL_PLANE_LAYERS.length) {
    throw new Error('invalid expected_layers');
  }
  const layers = raw.map((layer) => String(layer));
  if (new Set(layers).size !== layers.length) throw new Error('duplicate expected layer');
  for (const layer of layers) {
    if (!CONTROL_PLANE_LAYERS.includes(layer)) throw new Error('unknown control-plane layer');
  }
  const canonical = CONTROL_PLANE_LAYERS.filter((layer) => layers.includes(layer));
  if (canonical.join('\n') !== layers.join('\n')) throw new Error('expected_layers out of order');
  return Object.freeze(layers);
}

function runtimeIdentities(raw, expectedLayers) {
  object(raw, 'expected_runtime_identities');
  if (Object.keys(raw).sort().join('\n') !== [...expectedLayers].sort().join('\n')) {
    throw new Error('runtime identity keys must match expected_layers');
  }
  const out = {};
  for (const layer of expectedLayers) {
    if (!SHA40.test(raw[layer] ?? '')) throw new Error('invalid expected runtime sha');
    out[layer] = raw[layer];
  }
  return Object.freeze(out);
}

function observationList(raw, traceId, expectedLayers) {
  if (!Array.isArray(raw) || raw.length > 32) throw new Error('invalid observations');
  const seen = new Set();
  return Object.freeze(raw.map((entry) => {
    object(entry, 'observation');
    keys(entry, [
      'layer',
      'state',
      'trace_id',
      'runtime_sha',
      'failure_code',
      'retryable',
      'evidence_sha256',
      'attempt',
    ], 'observation');

    if (!expectedLayers.includes(entry.layer)) throw new Error('observation layer not expected');
    if (seen.has(entry.layer)) {
      throw new ControlPlaneError('UNSAFE', 'duplicate_layer_observation', entry.layer);
    }
    seen.add(entry.layer);
    if (entry.trace_id !== traceId) {
      throw new ControlPlaneError('UNSAFE', 'cross_service_trace_id_mismatch', entry.layer);
    }
    if (!OBSERVATION_STATES.has(entry.state)) throw new Error('invalid observation state');
    if (!SHA40.test(entry.runtime_sha ?? '')) throw new Error('invalid observation runtime sha');
    if (!SHA256.test(entry.evidence_sha256 ?? '')) {
      throw new ControlPlaneError('UNSAFE', 'observation_evidence_digest_missing', entry.layer);
    }
    if (!Number.isSafeInteger(entry.attempt) || entry.attempt < 1 || entry.attempt > 10) {
      throw new Error('invalid observation attempt');
    }
    if (typeof entry.retryable !== 'boolean') throw new Error('invalid retryable flag');

    if (['accepted', 'started', 'succeeded'].includes(entry.state)) {
      if (entry.failure_code !== null || entry.retryable !== false) {
        throw new ControlPlaneError('UNSAFE', 'success_state_cannot_carry_failure', entry.layer);
      }
    } else {
      if (typeof entry.failure_code !== 'string' || entry.failure_code.length < 3) {
        throw new ControlPlaneError('UNSAFE', 'unclassified_terminal_failure_forbidden', entry.layer);
      }
      if (!FAILURE_CODES[entry.layer].has(entry.failure_code)) {
        throw new ControlPlaneError('UNSAFE', 'unknown_failure_code_for_layer', entry.layer);
      }
    }

    return Object.freeze({
      layer: entry.layer,
      state: entry.state,
      trace_id: entry.trace_id,
      runtime_sha: entry.runtime_sha,
      failure_code: entry.failure_code,
      retryable: entry.retryable,
      evidence_sha256: entry.evidence_sha256,
      attempt: entry.attempt,
    });
  }));
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${label} must be object`);
  }
}

function keys(value, allowed, label) {
  const set = new Set(allowed);
  if (Object.keys(value).some((key) => !set.has(key))) {
    throw new Error(`${label} contains unsupported key`);
  }
}
