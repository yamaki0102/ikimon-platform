import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { runLocalDebugTask } from '../run-local.mjs';
import { collectChanges, createCandidateCommit, prepareWorktree } from '../lib/git-worktree.mjs';
import { openRunLedger, sha256, updateState } from '../lib/ledger.mjs';
import { writePrivateLog } from '../lib/process.mjs';
import { validateLocalDebugTask } from '../lib/task.mjs';

const exec = promisify(execFile);

async function repository(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'local-debug-hardening-repo-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await exec('git', ['init', '-b', 'main'], { cwd: root });
  await exec('git', ['config', 'user.name', 'Test'], { cwd: root });
  await exec('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root });
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'base.txt'), 'base\n');
  await writeFile(path.join(root, 'always.mjs'), 'process.exit(0);\n');
  await writeFile(path.join(root, 'check.mjs'), "import { readFileSync } from 'node:fs'; if (readFileSync('src/result.txt','utf8').trim() !== 'fixed') process.exit(2);\n");
  await exec('git', ['add', '.'], { cwd: root });
  await exec('git', ['commit', '-m', 'base'], { cwd: root });
  const { stdout } = await exec('git', ['rev-parse', 'HEAD'], { cwd: root });
  return { root, sha: stdout.trim() };
}

function task(repo, overrides = {}) {
  return {
    schema: 'ikimon.local-debug-task/v1',
    task_id: 'runner-hardening-task',
    repository_path: repo.root,
    base_sha: repo.sha,
    branch_name: 'debug/runner-hardening-task',
    scope: 'full_control_plane',
    risk: 'p1',
    repository_count: 2,
    objective: 'Create src/result.txt with the exact text fixed and preserve all Local Runner safety boundaries.',
    acceptance_criteria: ['The local deterministic check exits with status zero.'],
    checks: [{ id: 'result', argv: ['node', 'check.mjs'], cwd: '.', timeout_seconds: 30, max_output_bytes: 65536 }],
    max_luna_passes: 3,
    max_terra_passes: 1,
    allow_terra: true,
    max_changed_files: 5,
    allowed_path_prefixes: ['src'],
    allow_no_changes: false,
    commit_message: 'fix: create local hardening candidate',
    ...overrides,
  };
}

function codexResult(lane) {
  return { lane, model: lane.endsWith('terra') ? 'terra' : 'luna', exit_code: 0, timed_out: false, output_truncated: false, duration_ms: 1, stdout_tail: '', stderr_tail: '' };
}

async function writeCandidate({ lane, worktree }) {
  await writeFile(path.join(worktree, 'src', 'result.txt'), 'fixed\n');
  return codexResult(lane);
}

test('repository-local config mutation by Codex fails closed', async (t) => {
  const repo = await repository(t);
  const runsRoot = await mkdtemp(path.join(os.tmpdir(), 'local-debug-hardening-runs-'));
  t.after(() => rm(runsRoot, { recursive: true, force: true }));
  const result = await runLocalDebugTask(task(repo), {
    runsRoot,
    invokeCodex: async ({ lane, worktree }) => {
      await writeFile(path.join(worktree, 'src', 'result.txt'), 'fixed\n');
      await exec('git', ['config', '--local', 'ikimon.bad', 'true'], { cwd: worktree });
      return codexResult(lane);
    },
  });
  assert.equal(result.status, 'unsafe');
  assert.equal(result.classification, 'repository_control_state_changed');
});

test('changed symlinks and paths outside the allowlist are rejected', async (t) => {
  const symlinkRepo = await repository(t);
  const symlinkRuns = await mkdtemp(path.join(os.tmpdir(), 'local-debug-hardening-runs-'));
  t.after(() => rm(symlinkRuns, { recursive: true, force: true }));
  const symlinkResult = await runLocalDebugTask(task(symlinkRepo, {
    checks: [{ id: 'always', argv: ['node', 'always.mjs'], cwd: '.', timeout_seconds: 30, max_output_bytes: 65536 }],
  }), {
    runsRoot: symlinkRuns,
    invokeCodex: async ({ lane, worktree }) => {
      await symlink('base.txt', path.join(worktree, 'src', 'result.txt'));
      return codexResult(lane);
    },
  });
  assert.equal(symlinkResult.status, 'unsafe');
  assert.match(symlinkResult.classification, /changed_symlink_forbidden/u);

  const pathRepo = await repository(t);
  const pathRuns = await mkdtemp(path.join(os.tmpdir(), 'local-debug-hardening-runs-'));
  t.after(() => rm(pathRuns, { recursive: true, force: true }));
  const pathResult = await runLocalDebugTask(task(pathRepo, {
    checks: [{ id: 'always', argv: ['node', 'always.mjs'], cwd: '.', timeout_seconds: 30, max_output_bytes: 65536 }],
  }), {
    runsRoot: pathRuns,
    invokeCodex: async ({ lane, worktree }) => {
      await exec('git', ['mv', 'src/base.txt', 'outside.txt'], { cwd: worktree });
      await exec('git', ['reset'], { cwd: worktree });
      return codexResult(lane);
    },
  });
  assert.equal(pathResult.status, 'unsafe');
  assert.match(pathResult.classification, /changed_path_outside_allowlist/u);
});

test('runner-owned commit disables repository hooks', async (t) => {
  const repo = await repository(t);
  const marker = path.join(repo.root, 'hook-ran.txt');
  const hook = path.join(repo.root, '.git', 'hooks', 'post-commit');
  await writeFile(hook, `#!/bin/sh\nprintf '%s' \"$GH_TOKEN:$CLOUDFLARE_API_TOKEN\" > ${JSON.stringify(marker)}\n`);
  await chmod(hook, 0o755);
  const runsRoot = await mkdtemp(path.join(os.tmpdir(), 'local-debug-hardening-runs-'));
  t.after(() => rm(runsRoot, { recursive: true, force: true }));
  const result = await runLocalDebugTask(task(repo), {
    runsRoot,
    env: { ...process.env, GH_TOKEN: 'must-not-reach-hook', CLOUDFLARE_API_TOKEN: 'must-not-reach-hook' },
    invokeCodex: writeCandidate,
  });
  assert.equal(result.status, 'pass');
  await assert.rejects(access(marker), /ENOENT/u);
});

test('candidate commit is recovered after an interrupted finalization window', async (t) => {
  const repo = await repository(t);
  const runsRoot = await mkdtemp(path.join(os.tmpdir(), 'local-debug-hardening-runs-'));
  t.after(() => rm(runsRoot, { recursive: true, force: true }));
  const validated = validateLocalDebugTask(task(repo));
  const runDir = path.join(runsRoot, validated.task_id);
  const ledger = await openRunLedger(runDir, validated);
  const state = await updateState({ ...ledger, state: ledger.state }, { status: 'running', phase: 'creating_candidate_commit', luna_passes: 1, active_pass: 1 });
  const worktree = await prepareWorktree(validated, { ...ledger, state });
  await writeFile(path.join(worktree.worktree, 'src', 'result.txt'), 'fixed\n');
  const gitOptions = { ledger: { ...ledger, state }, gitHomeDir: ledger.home_dir, gitGuardDir: ledger.git_guard_dir, repositoryGuardPath: ledger.repository_guard_path };
  await collectChanges(validated, worktree.worktree, gitOptions);
  const candidate = await createCandidateCommit(validated, worktree.worktree, gitOptions);
  await ledger.release_lock();

  const resumed = await runLocalDebugTask(task(repo), { runsRoot, invokeCodex: async () => { throw new Error('must not rerun Codex'); } });
  assert.equal(resumed.status, 'pass');
  assert.equal(resumed.candidate_sha, candidate);
});

test('allow_no_changes binds evidence to the base SHA without a synthetic commit', async (t) => {
  const repo = await repository(t);
  const runsRoot = await mkdtemp(path.join(os.tmpdir(), 'local-debug-hardening-runs-'));
  t.after(() => rm(runsRoot, { recursive: true, force: true }));
  const result = await runLocalDebugTask(task(repo, {
    checks: [{ id: 'always', argv: ['node', 'always.mjs'], cwd: '.', timeout_seconds: 30, max_output_bytes: 65536 }],
    allow_no_changes: true,
  }), { runsRoot, invokeCodex: async ({ lane }) => codexResult(lane) });
  assert.equal(result.status, 'pass');
  assert.equal(result.classification, 'local_no_change_green');
  assert.equal(result.candidate_sha, repo.sha);
  const evidence = JSON.parse(await readFile(path.join(result.run_dir, 'artifacts', 'local-evidence.json'), 'utf8'));
  assert.deepEqual(evidence.changed_files, []);
  assert.equal(evidence.patch_sha256, sha256(''));
});

test('ledger lock blocks concurrent initialization', async (t) => {
  const repo = await repository(t);
  const validated = validateLocalDebugTask(task(repo));
  const runDir = await mkdtemp(path.join(os.tmpdir(), 'local-debug-hardening-lock-'));
  t.after(() => rm(runDir, { recursive: true, force: true }));
  const first = await openRunLedger(runDir, validated);
  await assert.rejects(openRunLedger(runDir, validated), /run_already_locked/u);
  await first.release_lock();
});

test('inline interpreters, unsafe shell commands, and arbitrary npx binaries are rejected', async (t) => {
  const repo = await repository(t);
  for (const argv of [
    ['node', '-e', 'process.exit(0)'],
    ['python3', '-c', 'print(1)'],
    ['bash', '-c', 'true'],
    ['pwsh', '-Command', 'exit 0'],
    ['npx', 'wrangler', 'deploy'],
    ['/tmp/fake/node', 'check.mjs'],
  ]) {
    assert.throws(() => validateLocalDebugTask(task(repo, {
      checks: [{ id: 'unsafe', argv, cwd: '.' }],
    })));
  }
});

test('private logs redact common credential shapes', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'local-debug-hardening-redaction-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = await writePrivateLog(path.join(dir, 'log.txt'), 'token=ghp_abcdefghijklmnop secret=sk-abcdefghijklmnop');
  const body = await readFile(file, 'utf8');
  assert.doesNotMatch(body, /ghp_|sk-/u);
  assert.match(body, /REDACTED/u);
});
