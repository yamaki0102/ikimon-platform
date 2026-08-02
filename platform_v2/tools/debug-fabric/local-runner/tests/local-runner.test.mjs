import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { runLocalDebugTask } from '../run-local.mjs';
import { invokeCodex } from '../lib/codex-adapter.mjs';
import { safeCheckEnvironment, safeCodexEnvironment, writePrivateLog } from '../lib/process.mjs';
import { validateLocalDebugTask } from '../lib/task.mjs';

const exec = promisify(execFile);

async function repository(t, { passingCheck = true } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'local-debug-repo-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await exec('git', ['init', '-b', 'main'], { cwd: root });
  await exec('git', ['config', 'user.name', 'Test'], { cwd: root });
  await exec('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root });
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'base.txt'), 'base\n');
  const check = passingCheck
    ? "import { readFileSync } from 'node:fs'; if (readFileSync('src/result.txt','utf8').trim() !== 'fixed') process.exit(2);\n"
    : "console.error('stable failure 42ms'); process.exit(2);\n";
  await writeFile(path.join(root, 'check.mjs'), check);
  await exec('git', ['add', '.'], { cwd: root });
  await exec('git', ['commit', '-m', 'base'], { cwd: root });
  const { stdout } = await exec('git', ['rev-parse', 'HEAD'], { cwd: root });
  return { root, sha: stdout.trim() };
}

function task(repo, overrides = {}) {
  return {
    schema: 'ikimon.local-debug-task/v1',
    task_id: 'runner-test-task',
    repository_path: repo.root,
    base_sha: repo.sha,
    branch_name: 'debug/runner-test-task',
    scope: 'full_control_plane',
    risk: 'p1',
    repository_count: 2,
    objective: 'Create src/result.txt with the exact text fixed and preserve all runner safety boundaries.',
    acceptance_criteria: ['The local deterministic check exits with status zero.'],
    checks: [{ id: 'result', argv: ['node', 'check.mjs'], cwd: '.', timeout_seconds: 30, max_output_bytes: 65536 }],
    max_luna_passes: 3,
    max_terra_passes: 1,
    allow_terra: true,
    max_changed_files: 5,
    allowed_path_prefixes: ['src'],
    allow_no_changes: false,
    commit_message: 'fix: create local candidate',
    ...overrides,
  };
}

function fakeCodexWrite() {
  let calls = 0;
  const fn = async ({ lane, worktree }) => {
    calls += 1;
    await writeFile(path.join(worktree, 'src', 'result.txt'), 'fixed\n');
    return { lane, model: lane.endsWith('terra') ? 'terra' : 'luna', exit_code: 0, timed_out: false, output_truncated: false, duration_ms: 1, stdout_tail: '', stderr_tail: '' };
  };
  fn.calls = () => calls;
  return fn;
}

function fakeCodexNoop(lanes = []) {
  return async ({ lane }) => {
    lanes.push(lane);
    return { lane, model: lane.endsWith('terra') ? 'terra' : 'luna', exit_code: 0, timed_out: false, output_truncated: false, duration_ms: 1, stdout_tail: '', stderr_tail: '' };
  };
}

test('creates an isolated candidate commit and immutable local evidence', async (t) => {
  const repo = await repository(t);
  const runsRoot = await mkdtemp(path.join(os.tmpdir(), 'local-debug-runs-'));
  t.after(() => rm(runsRoot, { recursive: true, force: true }));
  const codex = fakeCodexWrite();
  const result = await runLocalDebugTask(task(repo), { runsRoot, invokeCodex: codex });
  assert.equal(result.status, 'pass');
  assert.match(result.candidate_sha, /^[0-9a-f]{40}$/u);
  assert.match(result.evidence_sha256, /^[0-9a-f]{64}$/u);
  assert.equal(codex.calls(), 1);
  const evidence = JSON.parse(await readFile(path.join(result.run_dir, 'artifacts', 'local-evidence.json'), 'utf8'));
  assert.equal(evidence.candidate_sha, result.candidate_sha);
  assert.equal(evidence.base_sha, repo.sha);
  assert.deepEqual(evidence.changed_files.map((entry) => entry.path), ['src/result.txt']);
  assert.equal(evidence.protected_mutations, 0);
  const { stdout: branch } = await exec('git', ['-C', path.join(result.run_dir, 'worktree'), 'rev-parse', '--abbrev-ref', 'HEAD']);
  assert.equal(branch.trim(), 'debug/runner-test-task');
});

test('completed run resumes without invoking Codex again', async (t) => {
  const repo = await repository(t);
  const runsRoot = await mkdtemp(path.join(os.tmpdir(), 'local-debug-runs-'));
  t.after(() => rm(runsRoot, { recursive: true, force: true }));
  const codex = fakeCodexWrite();
  const first = await runLocalDebugTask(task(repo), { runsRoot, invokeCodex: codex });
  const second = await runLocalDebugTask(task(repo), { runsRoot, invokeCodex: async () => { throw new Error('must not run'); } });
  assert.equal(second.status, 'pass');
  assert.equal(second.candidate_sha, first.candidate_sha);
});

test('Codex-staged changes fail closed as unsafe', async (t) => {
  const repo = await repository(t);
  const runsRoot = await mkdtemp(path.join(os.tmpdir(), 'local-debug-runs-'));
  t.after(() => rm(runsRoot, { recursive: true, force: true }));
  const result = await runLocalDebugTask(task(repo), {
    runsRoot,
    invokeCodex: async ({ lane, worktree }) => {
      await writeFile(path.join(worktree, 'src', 'result.txt'), 'fixed\n');
      await exec('git', ['add', 'src/result.txt'], { cwd: worktree });
      return { lane, model: 'luna', exit_code: 0, timed_out: false, output_truncated: false, duration_ms: 1, stdout_tail: '', stderr_tail: '' };
    },
  });
  assert.equal(result.status, 'unsafe');
  assert.equal(result.classification, 'codex_staged_changes_forbidden');
});

test('three identical Luna failures escalate once to Terra', async (t) => {
  const repo = await repository(t, { passingCheck: false });
  const runsRoot = await mkdtemp(path.join(os.tmpdir(), 'local-debug-runs-'));
  t.after(() => rm(runsRoot, { recursive: true, force: true }));
  const lanes = [];
  const result = await runLocalDebugTask(task(repo), { runsRoot, invokeCodex: fakeCodexNoop(lanes) });
  assert.equal(result.status, 'failed');
  assert.equal(result.classification, 'local_terra_pass_limit_reached');
  assert.deepEqual(lanes, ['local_codex_luna','local_codex_luna','local_codex_luna','local_codex_terra']);
  const events = (await readFile(path.join(result.run_dir, 'events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.ok(events.some((entry) => entry.type === 'pass_failed' && entry.detail.same_signature_failures >= 2));
});

test('a changed task cannot resume an existing run directory', async (t) => {
  const repo = await repository(t, { passingCheck: false });
  const runsRoot = await mkdtemp(path.join(os.tmpdir(), 'local-debug-runs-'));
  t.after(() => rm(runsRoot, { recursive: true, force: true }));
  await runLocalDebugTask(task(repo, { max_luna_passes: 1, allow_terra: false, max_terra_passes: 0 }), { runsRoot, invokeCodex: fakeCodexNoop() });
  await assert.rejects(
    runLocalDebugTask(task(repo, { max_luna_passes: 1, allow_terra: false, max_terra_passes: 0, objective: 'A different objective that must never reuse the prior ledger or worktree state.' }), { runsRoot, invokeCodex: fakeCodexNoop() }),
    /task_hash_mismatch_on_resume/u,
  );
});

test('terminal unsafe state does not rerun without an explicit retry option', async (t) => {
  const repo = await repository(t);
  const runsRoot = await mkdtemp(path.join(os.tmpdir(), 'local-debug-runs-'));
  t.after(() => rm(runsRoot, { recursive: true, force: true }));
  const unsafe = await runLocalDebugTask(task(repo), {
    runsRoot,
    invokeCodex: async ({ lane, worktree }) => {
      await writeFile(path.join(worktree, 'src', 'result.txt'), 'fixed\n');
      await exec('git', ['add', 'src/result.txt'], { cwd: worktree });
      return { lane, model: 'luna', exit_code: 0, timed_out: false, output_truncated: false, duration_ms: 1, stdout_tail: '', stderr_tail: '' };
    },
  });
  assert.equal(unsafe.status, 'unsafe');
  const resumed = await runLocalDebugTask(task(repo), { runsRoot, invokeCodex: async () => { throw new Error('must not run'); } });
  assert.equal(resumed.status, 'unsafe');
  assert.equal(resumed.classification, 'codex_staged_changes_forbidden');
});

test('private logs remain append-only across resumed attempts', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'private-logs-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'pass.log');
  const first = await writePrivateLog(file, 'first');
  const second = await writePrivateLog(file, 'second');
  assert.equal(first, file);
  assert.notEqual(second, file);
  assert.equal(await readFile(first, 'utf8'), 'first');
  assert.equal(await readFile(second, 'utf8'), 'second');
});

test('Codex adapter invokes the selected model with closed credential surfaces', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'codex-adapter-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let captured;
  const result = await invokeCodex({
    lane: 'local_codex_luna', worktree: dir, prompt: 'test prompt', passNumber: 1, logsDir: path.join(dir, 'logs'),
  }, {
    env: { PATH: process.env.PATH ?? '', HOME: '/home/test', IKIMON_CODEX_BIN: 'codex-custom', IKIMON_CODEX_LUNA_MODEL: 'luna-custom', GH_TOKEN: 'secret', CLOUDFLARE_API_TOKEN: 'secret' },
    runProcess: async (argv, options) => {
      captured = { argv, env: options.env, cwd: options.cwd };
      return { exit_code: 0, timed_out: false, output_truncated: false, duration_ms: 1, stdout: 'done', stderr: '' };
    },
  });
  const approvalFlag = '--ask' + '-for-approval';
  assert.deepEqual(captured.argv.slice(0, 8), ['codex-custom','exec','--cd',dir,'--model','luna-custom',approvalFlag,'never']);
  assert.equal(captured.argv.at(-2), 'workspace-write');
  assert.equal(captured.argv.at(-1), 'test prompt');
  assert.equal(captured.env.GH_TOKEN, '');
  assert.equal(captured.env.CLOUDFLARE_API_TOKEN, '');
  assert.equal(captured.env.GH_CONFIG_DIR, path.join(dir, 'codex-guard', 'gh'));
  assert.equal(result.model, 'luna-custom');
});

test('task validation rejects deployment-bearing deterministic checks', async (t) => {
  const repo = await repository(t);
  assert.throws(() => validateLocalDebugTask(task(repo, {
    checks: [{ id: 'bad', argv: ['npm', 'run', 'deploy'], cwd: '.' }],
  })), /forbidden check script:deploy/u);
});

test('check and Codex environments strip cloud and GitHub credentials', () => {
  const source = {
    PATH: process.env.PATH ?? '', HOME: '/home/test', USERPROFILE: '/home/test',
    GH_TOKEN: 'secret', GITHUB_TOKEN: 'secret', CLOUDFLARE_API_TOKEN: 'secret', OPENAI_API_KEY: 'secret',
  };
  const check = safeCheckEnvironment('/tmp/isolated', source);
  assert.equal(check.GH_TOKEN, undefined);
  assert.equal(check.CLOUDFLARE_API_TOKEN, undefined);
  assert.equal(check.HOME, '/tmp/isolated');
  assert.equal(check.HTTPS_PROXY, 'http://127.0.0.1:9');
  const codex = safeCodexEnvironment(source);
  assert.equal(codex.GH_TOKEN, '');
  assert.equal(codex.CLOUDFLARE_API_TOKEN, '');
  assert.equal(codex.OPENAI_API_KEY, '');
  assert.equal(codex.GIT_TERMINAL_PROMPT, '0');
});
