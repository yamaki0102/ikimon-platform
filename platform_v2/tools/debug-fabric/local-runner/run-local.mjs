#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { planExecution } from '../lib/execution-policy.mjs';
import { invokeCodex } from './lib/codex-adapter.mjs';
import { failureSignature, failureSummary, runChecks } from './lib/checks.mjs';
import { collectChanges, createCandidateCommit, prepareWorktree, readCandidateIdentity, verifyWorktree } from './lib/git-worktree.mjs';
import { appendEvent, openRunLedger, sha256, stableStringify, updateState, writeExclusiveJson } from './lib/ledger.mjs';
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
  try {
    await appendEvent(ledger, 'runner_started', { status: state.status, phase: state.phase });
    if (['pass','failed','blocked','unsafe'].includes(state.status) && options.retryTerminal !== true) return outcome(state, ledger);
    state = await updateState({ ...ledger, state }, { status: 'running', phase: 'preparing_worktree' });
    const worktree = await (options.prepareWorktree ?? prepareWorktree)(task, { ...ledger, state }, options);
    await appendEvent(ledger, 'worktree_ready', { worktree: worktree.worktree, branch: worktree.branch, base_sha: task.base_sha });

    let previousFailure = state.last_failure_signature
      ? { signature: state.last_failure_signature, summary: state.last_failure_summary ?? '' }
      : null;

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
      state = await updateState({ ...ledger, state }, { phase: 'codex_running', active_lane: plan.lane, active_pass: passNumber });
      const prompt = buildCodexPrompt(task, { lane: plan.lane, previousFailure });
      const codex = await (options.invokeCodex ?? invokeCodex)({
        lane: plan.lane,
        worktree: worktree.worktree,
        prompt,
        passNumber,
        logsDir: ledger.logs_dir,
      }, options);
      const counters = plan.lane === 'local_codex_terra'
        ? { terra_passes: state.terra_passes + 1 }
        : { luna_passes: state.luna_passes + 1 };
      state = await updateState({ ...ledger, state }, { ...counters, phase: 'deterministic_checks' });
      await appendEvent(ledger, 'codex_pass_completed', {
        lane: plan.lane, model: codex.model, exit_code: codex.exit_code, timed_out: codex.timed_out,
        duration_ms: codex.duration_ms,
      });

      await (options.verifyWorktree ?? verifyWorktree)(task, worktree.worktree, options.runProcess);
      const checks = await (options.runChecks ?? runChecks)(task, worktree.worktree, { ...ledger, state }, { ...options, passNumber });
      const signature = failureSignature(checks);
      await appendEvent(ledger, 'checks_completed', {
        pass: passNumber,
        checks: checks.map((entry) => ({ id: entry.id, status: entry.status, exit_code: entry.exit_code, timed_out: entry.timed_out })),
        failure_signature: signature,
      });

      if (!signature && codex.exit_code === 0 && !codex.timed_out) {
        const changes = await (options.collectChanges ?? collectChanges)(task, worktree.worktree, options.runProcess);
        if (!task.allow_no_changes && changes.entries.length === 0) {
          previousFailure = { signature: sha256('no_changes'), summary: 'Deterministic checks passed but the task produced no source changes.' };
          state = await recordFailure(ledger, state, previousFailure, 'no_changes_after_codex_pass');
          continue;
        }
        state = await updateState({ ...ledger, state }, { phase: 'creating_candidate_commit' });
        const candidateSha = await (options.createCandidateCommit ?? createCandidateCommit)(task, worktree.worktree, options.runProcess);
        const candidateIdentity = await (options.readCandidateIdentity ?? readCandidateIdentity)(worktree.worktree, candidateSha, options.runProcess);
        const evidence = {
          schema: 'ikimon.local-debug-evidence/v1',
          task_id: task.task_id,
          task_hash: ledger.task_hash,
          status: 'PASS',
          repository_path_hash: sha256(task.repository_path),
          base_sha: task.base_sha,
          candidate_sha: candidateSha,
          branch_name: task.branch_name,
          tree_sha: candidateIdentity.tree_sha,
          patch_sha256: sha256(candidateIdentity.patch),
          changed_files: changes.entries,
          luna_passes: state.luna_passes,
          terra_passes: state.terra_passes,
          checks: checks.map((entry) => ({
            id: entry.id, status: entry.status, exit_code: entry.exit_code, timed_out: entry.timed_out,
            duration_ms: entry.duration_ms, stdout_sha256: entry.stdout_sha256, stderr_sha256: entry.stderr_sha256,
          })),
          completed_at: new Date().toISOString(),
          protected_mutations: 0,
          cloud_debug_iterations: 0,
        };
        const evidenceHash = sha256(stableStringify(evidence));
        await writeExclusiveJson(path.join(ledger.artifacts_dir, 'local-evidence.json'), { ...evidence, evidence_sha256: evidenceHash });
        state = await updateState({ ...ledger, state }, {
          status: 'pass', phase: 'completed', classification: 'local_candidate_green',
          candidate_sha: candidateSha, evidence_sha256: evidenceHash,
        });
        await appendEvent(ledger, 'local_candidate_green', { candidate_sha: candidateSha, evidence_sha256: evidenceHash });
        return outcome(state, ledger);
      }

      const combinedSignature = signature ?? sha256(`codex:${codex.exit_code}:${codex.timed_out}`);
      const summary = signature ? failureSummary(checks) : `Codex process failed: exit=${codex.exit_code}, timeout=${codex.timed_out}\n${codex.stderr_tail}`;
      previousFailure = { signature: combinedSignature, summary };
      state = await recordFailure(ledger, state, previousFailure, signature ? 'deterministic_check_failed' : 'codex_process_failed');
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
