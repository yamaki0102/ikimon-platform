#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { planExecution } from '../lib/execution-policy.mjs';
import { invokeCodex } from './lib/codex-adapter.mjs';
import { failureSignature, failureSummary, runChecks } from './lib/checks.mjs';
import {
  collectChanges, collectCommittedChanges, createCandidateCommit, prepareWorktree,
  readCandidateIdentity, verifyWorktree,
} from './lib/git-worktree.mjs';
import {
  appendEvent, openRunLedger, readJsonIfExists, sha256, stableStringify,
  updateState, writeExclusiveJson,
} from './lib/ledger.mjs';
import { buildCodexPrompt } from './lib/prompt.mjs';
import { validateLocalDebugTask } from './lib/task.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

export async function runLocalDebugTask(rawTask, options = {}) {
  const task = validateLocalDebugTask(rawTask);
  const defaultRoot = process.env.IKIMON_DEBUG_RUNS_ROOT || path.join(os.homedir(), '.ikimon-debug-fabric', 'runs', sha256(task.repository_path).slice(0, 16));
  const runsRoot = path.resolve(options.runsRoot ?? defaultRoot);
  const runDir = path.resolve(options.runDir ?? path.join(runsRoot, task.task_id));
  const ledger = await openRunLedger(runDir, task);
  let state = ledger.state;
  const resumePhase = state.phase;
  try {
    await appendEvent(ledger, 'runner_started', { status: state.status, phase: state.phase });
    if (['pass','failed','blocked','unsafe'].includes(state.status) && options.retryTerminal !== true) return outcome(state, ledger);
    state = await updateState({ ...ledger, state }, {
      status: 'running',
      phase: resumePhase === 'created' || resumePhase === 'not_started' ? 'preparing_worktree' : resumePhase,
    });
    const worktree = await (options.prepareWorktree ?? prepareWorktree)(task, { ...ledger, state }, options);
    await appendEvent(ledger, 'worktree_ready', {
      worktree: worktree.worktree, branch: worktree.branch, base_sha: task.base_sha,
      recovered_candidate_sha: worktree.candidate_sha,
    });

    if (worktree.candidate_sha) {
      state = await updateState({ ...ledger, state }, {
        phase: 'candidate_committed', candidate_sha: worktree.candidate_sha,
      });
      const recovered = await finalizeCandidate(task, state, ledger, worktree.worktree, worktree.candidate_sha, options);
      return recovered.outcome;
    }

    let previousFailure = state.last_failure_signature
      ? { signature: state.last_failure_signature, summary: state.last_failure_summary ?? '' }
      : null;

    if (['deterministic_checks','creating_candidate_commit'].includes(resumePhase)) {
      const resumed = await evaluateCurrentChanges(task, state, ledger, worktree.worktree, {
        ...options,
        codexOk: state.last_codex_exit_code === 0 && state.last_codex_timed_out === false,
        passNumber: state.active_pass ?? state.luna_passes + state.terra_passes,
      });
      state = resumed.state;
      if (resumed.outcome) return resumed.outcome;
      previousFailure = resumed.previousFailure;
    }

    while (true) {
      const request = executionRequest(task, state);
      const plan = planExecution(request);
      if (plan.status !== 'READY') {
        state = await updateState({ ...ledger, state }, { status: 'blocked', phase: 'planning_blocked', classification: plan.classification });
        await appendEvent(ledger, 'execution_blocked', { classification: plan.classification });
        return outcome(state, ledger);
      }
      if (plan.lane === 'local_codex_luna' && state.luna_passes >= task.max_luna_passes) {
        state = await updateState({ ...ledger, state }, { status: 'failed', phase: 'luna_pass_limit', classification: 'local_luna_pass_limit_reached' });
        return outcome(state, ledger);
      }
      if (plan.lane === 'local_codex_terra' && (!task.allow_terra || state.terra_passes >= task.max_terra_passes)) {
        state = await updateState({ ...ledger, state }, { status: 'failed', phase: 'terra_pass_limit', classification: 'local_terra_pass_limit_reached' });
        return outcome(state, ledger);
      }

      const passNumber = state.luna_passes + state.terra_passes + 1;
      const counters = plan.lane === 'local_codex_terra'
        ? { terra_passes: state.terra_passes + 1 }
        : { luna_passes: state.luna_passes + 1 };
      state = await updateState({ ...ledger, state }, {
        ...counters,
        phase: 'codex_running', active_lane: plan.lane, active_pass: passNumber,
        last_codex_exit_code: null, last_codex_timed_out: null,
      });
      await appendEvent(ledger, 'codex_pass_started', { lane: plan.lane, pass: passNumber });
      const prompt = buildCodexPrompt(task, { lane: plan.lane, previousFailure });
      const codex = await (options.invokeCodex ?? invokeCodex)({
        lane: plan.lane,
        worktree: worktree.worktree,
        prompt,
        passNumber,
        logsDir: ledger.logs_dir,
      }, options);
      state = await updateState({ ...ledger, state }, {
        phase: 'deterministic_checks',
        last_codex_exit_code: codex.exit_code,
        last_codex_timed_out: codex.timed_out,
      });
      await appendEvent(ledger, 'codex_pass_completed', {
        lane: plan.lane, model: codex.model, exit_code: codex.exit_code, timed_out: codex.timed_out,
        duration_ms: codex.duration_ms,
      });

      const evaluated = await evaluateCurrentChanges(task, state, ledger, worktree.worktree, {
        ...options,
        codexOk: codex.exit_code === 0 && !codex.timed_out,
        codexFailureSummary: `Codex process failed: exit=${codex.exit_code}, timeout=${codex.timed_out}\n${codex.stderr_tail}`,
        passNumber,
      });
      state = evaluated.state;
      if (evaluated.outcome) return evaluated.outcome;
      previousFailure = evaluated.previousFailure;
    }
  } catch (error) {
    state = await updateState({ ...ledger, state }, {
      status: 'unsafe', phase: 'runner_error', classification: String(error?.message ?? 'runner_error').slice(0, 200),
    });
    await appendEvent(ledger, 'runner_error', { classification: state.classification });
    return outcome(state, ledger);
  } finally {
    await ledger.release_lock();
  }
}

async function evaluateCurrentChanges(task, state, ledger, worktree, options) {
  const gitOptions = runnerGitOptions(ledger, options);
  await (options.verifyWorktree ?? verifyWorktree)(task, worktree, gitOptions);
  const checks = await (options.runChecks ?? runChecks)(task, worktree, { ...ledger, state }, { ...options, passNumber: options.passNumber });
  const signature = failureSignature(checks);
  await appendEvent(ledger, 'checks_completed', {
    pass: options.passNumber,
    checks: checks.map((entry) => ({ id: entry.id, status: entry.status, exit_code: entry.exit_code, timed_out: entry.timed_out })),
    failure_signature: signature,
  });

  if (!signature && options.codexOk) {
    const changes = await (options.collectChanges ?? collectChanges)(task, worktree, gitOptions);
    if (changes.entries.length === 0) {
      if (task.allow_no_changes) {
        const noChange = await finalizeNoChange(task, state, ledger, worktree, checks, options);
        return { state: noChange.state, outcome: noChange.outcome, previousFailure: null };
      }
      const previousFailure = { signature: sha256('no_changes'), summary: 'Deterministic checks passed but the task produced no source changes.' };
      const next = await recordFailure(ledger, state, previousFailure, 'no_changes_after_codex_pass');
      return { state: next, outcome: null, previousFailure };
    }
    state = await updateState({ ...ledger, state }, { phase: 'creating_candidate_commit' });
    const candidateSha = await (options.createCandidateCommit ?? createCandidateCommit)(task, worktree, gitOptions);
    state = await updateState({ ...ledger, state }, { phase: 'candidate_committed', candidate_sha: candidateSha });
    await appendEvent(ledger, 'candidate_committed', { candidate_sha: candidateSha });
    const final = await finalizeCandidate(task, state, ledger, worktree, candidateSha, options);
    return { state: final.state, outcome: final.outcome, previousFailure: null };
  }

  const combinedSignature = signature ?? sha256(`codex:${state.last_codex_exit_code}:${state.last_codex_timed_out}`);
  const summary = signature ? failureSummary(checks) : (options.codexFailureSummary ?? 'The prior Codex pass did not complete successfully.');
  const previousFailure = { signature: combinedSignature, summary };
  const next = await recordFailure(ledger, state, previousFailure, signature ? 'deterministic_check_failed' : 'codex_process_failed');
  return { state: next, outcome: null, previousFailure };
}

async function finalizeCandidate(task, state, ledger, worktree, candidateSha, options) {
  state = await updateState({ ...ledger, state }, { phase: 'finalizing_candidate', candidate_sha: candidateSha });
  const gitOptions = runnerGitOptions(ledger, options);
  const changes = await (options.collectCommittedChanges ?? collectCommittedChanges)(task, worktree, candidateSha, gitOptions);
  const identity = await (options.readCandidateIdentity ?? readCandidateIdentity)(worktree, candidateSha, gitOptions);
  const persisted = await recoverPersistedEvidence(task, ledger, candidateSha, identity, changes.entries);
  if (persisted) {
    state = await updateState({ ...ledger, state }, {
      status: 'pass', phase: 'completed', classification: 'local_candidate_green',
      candidate_sha: candidateSha, evidence_sha256: persisted.evidence_sha256,
    });
    await appendEvent(ledger, 'local_candidate_evidence_recovered', { candidate_sha: candidateSha, evidence_sha256: persisted.evidence_sha256 });
    return { state, outcome: outcome(state, ledger) };
  }

  const passNumber = state.active_pass ?? state.luna_passes + state.terra_passes;
  const checks = await (options.runChecks ?? runChecks)(task, worktree, { ...ledger, state }, { ...options, passNumber });
  const signature = failureSignature(checks);
  if (signature) {
    state = await updateState({ ...ledger, state }, {
      status: 'unsafe', phase: 'candidate_post_commit_check_failed',
      classification: 'candidate_post_commit_check_failed', last_failure_signature: signature,
    });
    await appendEvent(ledger, 'candidate_post_commit_check_failed', { candidate_sha: candidateSha, failure_signature: signature });
    return { state, outcome: outcome(state, ledger) };
  }
  const evidenceCore = buildEvidence(task, state, ledger, candidateSha, identity, changes.entries, checks);
  const evidenceHash = sha256(stableStringify(evidenceCore));
  await persistEvidence(ledger, evidenceCore, evidenceHash);
  state = await updateState({ ...ledger, state }, {
    status: 'pass', phase: 'completed', classification: 'local_candidate_green',
    candidate_sha: candidateSha, evidence_sha256: evidenceHash,
  });
  await appendEvent(ledger, 'local_candidate_green', { candidate_sha: candidateSha, evidence_sha256: evidenceHash });
  return { state, outcome: outcome(state, ledger) };
}

async function finalizeNoChange(task, state, ledger, worktree, checks, options) {
  const gitOptions = runnerGitOptions(ledger, options);
  const identity = await (options.readCandidateIdentity ?? readCandidateIdentity)(worktree, task.base_sha, gitOptions);
  const noChangeIdentity = { ...identity, patch: '' };
  const persisted = await recoverPersistedEvidence(task, ledger, task.base_sha, noChangeIdentity, []);
  if (persisted) {
    state = await updateState({ ...ledger, state }, {
      status: 'pass', phase: 'completed', classification: 'local_no_change_green',
      candidate_sha: task.base_sha, evidence_sha256: persisted.evidence_sha256,
    });
    return { state, outcome: outcome(state, ledger) };
  }
  const evidenceCore = buildEvidence(task, state, ledger, task.base_sha, noChangeIdentity, [], checks);
  const evidenceHash = sha256(stableStringify(evidenceCore));
  await persistEvidence(ledger, evidenceCore, evidenceHash);
  state = await updateState({ ...ledger, state }, {
    status: 'pass', phase: 'completed', classification: 'local_no_change_green',
    candidate_sha: task.base_sha, evidence_sha256: evidenceHash,
  });
  await appendEvent(ledger, 'local_no_change_green', { candidate_sha: task.base_sha, evidence_sha256: evidenceHash });
  return { state, outcome: outcome(state, ledger) };
}

function buildEvidence(task, state, ledger, candidateSha, identity, entries, checks) {
  return {
    schema: 'ikimon.local-debug-evidence/v1',
    task_id: task.task_id,
    task_hash: ledger.task_hash,
    status: 'PASS',
    repository_path_hash: sha256(task.repository_path),
    base_sha: task.base_sha,
    candidate_sha: candidateSha,
    branch_name: task.branch_name,
    tree_sha: identity.tree_sha,
    patch_sha256: sha256(identity.patch),
    changed_files: entries,
    luna_passes: state.luna_passes,
    terra_passes: state.terra_passes,
    checks: checks.map((entry) => ({
      id: entry.id, status: entry.status, exit_code: entry.exit_code, timed_out: entry.timed_out,
      duration_ms: entry.duration_ms, stdout_sha256: entry.stdout_sha256, stderr_sha256: entry.stderr_sha256,
    })),
    protected_mutations: 0,
    cloud_debug_iterations: 0,
  };
}

async function recoverPersistedEvidence(task, ledger, candidateSha, identity, entries) {
  const file = path.join(ledger.artifacts_dir, 'local-evidence.json');
  const existing = await readJsonIfExists(file);
  if (!existing) return null;
  const { evidence_sha256: persistedHash, ...core } = existing;
  if (typeof persistedHash !== 'string' || sha256(stableStringify(core)) !== persistedHash) throw new Error('persisted_local_evidence_hash_invalid');
  const expectedStatic = {
    task_id: task.task_id,
    task_hash: ledger.task_hash,
    status: 'PASS',
    repository_path_hash: sha256(task.repository_path),
    base_sha: task.base_sha,
    candidate_sha: candidateSha,
    branch_name: task.branch_name,
    tree_sha: identity.tree_sha,
    patch_sha256: sha256(identity.patch),
    changed_files: entries,
    protected_mutations: 0,
    cloud_debug_iterations: 0,
  };
  for (const [key, value] of Object.entries(expectedStatic)) {
    if (stableStringify(core[key]) !== stableStringify(value)) throw new Error(`persisted_local_evidence_mismatch:${key}`);
  }
  if (!Array.isArray(core.checks) || core.checks.length !== task.checks.length
      || core.checks.some((entry, index) => entry.id !== task.checks[index].id || entry.status !== 'PASS')) {
    throw new Error('persisted_local_evidence_checks_invalid');
  }
  return Object.freeze({ evidence_sha256: persistedHash });
}

async function persistEvidence(ledger, evidenceCore, evidenceHash) {
  const file = path.join(ledger.artifacts_dir, 'local-evidence.json');
  await writeExclusiveJson(file, { ...evidenceCore, evidence_sha256: evidenceHash });
}

function executionRequest(task, state) {
  return {
    schema: 'ikimon.debug-execution-request/v1',
    task_id: task.task_id,
    scope: task.scope,
    risk: task.risk,
    repository_count: task.repository_count,
    local_state: state.last_failure_signature ? 'failed' : state.status === 'pass' ? 'pass' : 'running',
    luna_passes: state.luna_passes,
    same_signature_failures: state.same_signature_failures,
    real_runtime_dependency: false,
    final_candidate_sha: null,
    local_verified_sha: null,
    local_evidence_sha256: null,
    requested_lane: task.allow_terra ? 'auto' : 'local_luna',
    cloud_deploy_runs_used: 0,
    cloud_rollback_runs_used: 0,
    rollback_proof_required: false,
  };
}

async function recordFailure(ledger, state, failure, classification) {
  const same = state.last_failure_signature === failure.signature
    ? state.same_signature_failures + 1
    : 1;
  const next = await updateState({ ...ledger, state }, {
    status: 'running', phase: 'pass_failed', classification,
    last_failure_signature: failure.signature,
    last_failure_summary: failure.summary.slice(0, 24000),
    same_signature_failures: same,
  });
  await appendEvent(ledger, 'pass_failed', { classification, failure_signature: failure.signature, same_signature_failures: same });
  return next;
}

function runnerGitOptions(ledger, options) {
  return {
    ...options,
    ledger,
    gitHomeDir: ledger.home_dir,
    gitGuardDir: ledger.git_guard_dir,
    repositoryGuardPath: ledger.repository_guard_path,
  };
}

function outcome(state, ledger) {
  return Object.freeze({
    schema: 'ikimon.local-debug-outcome/v1',
    status: state.status,
    classification: state.classification ?? null,
    candidate_sha: state.candidate_sha,
    evidence_sha256: state.evidence_sha256,
    run_dir: ledger.run_dir,
    state_path: ledger.state_path,
    events_path: ledger.events_path,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.task) {
    console.log('Usage: node local-runner/run-local.mjs --task <task.json> [--runs-root <dir>] [--run-dir <dir>]');
    process.exitCode = args.help ? 0 : 2;
    return;
  }
  try {
    const raw = JSON.parse(await readFile(path.resolve(args.task), 'utf8'));
    const result = await runLocalDebugTask(raw, { runsRoot: args.runsRoot, runDir: args.runDir });
    console.log(`status=${result.status}`);
    console.log(`classification=${result.classification ?? 'none'}`);
    console.log(`candidate_sha=${result.candidate_sha ?? 'none'}`);
    console.log(`run_dir=${result.run_dir}`);
    process.exitCode = result.status === 'pass' ? 0 : result.status === 'unsafe' ? 30 : result.status === 'blocked' ? 20 : 10;
  } catch (error) {
    console.error(`ERROR: ${String(error?.message ?? error)}`);
    process.exitCode = 2;
  }
}

function parseArgs(argv) {
  const out = { task: null, runsRoot: null, runDir: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--task') out.task = argv[++index] ?? null;
    else if (argv[index] === '--runs-root') out.runsRoot = argv[++index] ?? null;
    else if (argv[index] === '--run-dir') out.runDir = argv[++index] ?? null;
    else if (argv[index] === '--help' || argv[index] === '-h') out.help = true;
    else throw new Error('unsupported CLI argument');
  }
  return out;
}
