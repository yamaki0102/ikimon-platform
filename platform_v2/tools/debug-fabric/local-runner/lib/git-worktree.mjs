import { access, mkdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { runProcess } from './process.mjs';

const SHA40 = /^[0-9a-f]{40}$/u;
const BUILTIN_FORBIDDEN = [
  '.env', '.env.', '.dev.vars', 'credentials', 'private-key', '.github/workflows/',
];

export async function prepareWorktree(task, ledger, options = {}) {
  const run = options.runProcess ?? runProcess;
  const repoRoot = await resolveRepositoryRoot(task.repository_path, run);
  await assertCommit(repoRoot, task.base_sha, run);
  await mkdir(path.dirname(ledger.worktree_dir), { recursive: true, mode: 0o700 });
  if (!(await exists(ledger.worktree_dir))) {
    const added = await run(['git','-C',repoRoot,'worktree','add','--detach',ledger.worktree_dir,task.base_sha], {
      cwd: repoRoot, timeoutMs: 120000, maxOutputBytes: 1048576,
    });
    assertOk(added, 'git_worktree_add_failed');
    const switched = await run(['git','-C',ledger.worktree_dir,'switch','-c',task.branch_name], {
      cwd: ledger.worktree_dir, timeoutMs: 30000, maxOutputBytes: 1048576,
    });
    assertOk(switched, 'git_branch_create_failed');
  }
  await verifyWorktree(task, ledger.worktree_dir, run);
  return Object.freeze({ repo_root: repoRoot, worktree: ledger.worktree_dir, branch: task.branch_name });
}

export async function verifyWorktree(task, worktree, run = runProcess) {
  const head = await gitText(worktree, ['rev-parse','HEAD'], run);
  if (head !== task.base_sha) throw new Error('worktree_head_moved_before_runner_commit');
  const branch = await gitText(worktree, ['rev-parse','--abbrev-ref','HEAD'], run);
  if (branch !== task.branch_name) throw new Error('worktree_branch_mismatch');
  const staged = await run(['git','-C',worktree,'diff','--cached','--quiet'], { cwd: worktree, timeoutMs: 30000, maxOutputBytes: 65536 });
  if (staged.exit_code !== 0) throw new Error('codex_staged_changes_forbidden');
}

export async function collectChanges(task, worktree, run = runProcess) {
  await verifyWorktree(task, worktree, run);
  const status = await run(['git','-C',worktree,'status','--porcelain=v1','-z','--untracked-files=all'], {
    cwd: worktree, timeoutMs: 30000, maxOutputBytes: 1048576,
  });
  assertOk(status, 'git_status_failed');
  const entries = parsePorcelain(status.stdout);
  if (entries.length > task.max_changed_files) throw new Error('changed_file_limit_exceeded');
  for (const file of entries) enforcePathPolicy(task, file.path);
  const diff = await run(['git','-C',worktree,'diff','--binary','--no-ext-diff'], {
    cwd: worktree, timeoutMs: 120000, maxOutputBytes: 8388608,
  });
  assertOk(diff, 'git_diff_failed');
  return Object.freeze({ entries: Object.freeze(entries), patch: diff.stdout });
}

export async function createCandidateCommit(task, worktree, run = runProcess) {
  const before = await gitText(worktree, ['rev-parse','HEAD'], run);
  if (before !== task.base_sha) throw new Error('candidate_base_sha_mismatch');
  const add = await run(['git','-C',worktree,'add','--all'], { cwd: worktree, timeoutMs: 30000, maxOutputBytes: 1048576 });
  assertOk(add, 'git_add_failed');
  const commitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: 'IKIMON Local Debug Runner',
    GIT_AUTHOR_EMAIL: 'local-debug@ikimon.invalid',
    GIT_COMMITTER_NAME: 'IKIMON Local Debug Runner',
    GIT_COMMITTER_EMAIL: 'local-debug@ikimon.invalid',
    GIT_TERMINAL_PROMPT: '0',
  };
  const commit = await run(['git','-C',worktree,'commit','--no-gpg-sign','-m',task.commit_message], {
    cwd: worktree, env: commitEnv, timeoutMs: 120000, maxOutputBytes: 1048576,
  });
  assertOk(commit, 'git_candidate_commit_failed');
  const candidate = await gitText(worktree, ['rev-parse','HEAD'], run);
  if (!SHA40.test(candidate) || candidate === task.base_sha) throw new Error('candidate_sha_invalid');
  const clean = await run(['git','-C',worktree,'status','--porcelain=v1'], { cwd: worktree, timeoutMs: 30000, maxOutputBytes: 65536 });
  assertOk(clean, 'git_status_failed');
  if (clean.stdout.trim() !== '') throw new Error('candidate_worktree_not_clean');
  return candidate;
}

export async function readCandidateIdentity(worktree, candidateSha, run = runProcess) {
  if (!SHA40.test(candidateSha)) throw new Error('candidate_sha_invalid');
  const patch = await run(['git','-C',worktree,'show','--format=','--binary','--no-ext-diff',candidateSha], {
    cwd: worktree, timeoutMs: 120000, maxOutputBytes: 8388608,
  });
  assertOk(patch, 'candidate_patch_read_failed');
  const treeSha = await gitText(worktree, ['rev-parse',`${candidateSha}^{tree}`], run);
  if (!SHA40.test(treeSha)) throw new Error('candidate_tree_sha_invalid');
  return Object.freeze({ candidate_sha: candidateSha, tree_sha: treeSha, patch: patch.stdout });
}

async function resolveRepositoryRoot(input, run) {
  await access(input);
  const result = await run(['git','-C',input,'rev-parse','--show-toplevel'], { cwd: input, timeoutMs: 30000, maxOutputBytes: 65536 });
  assertOk(result, 'repository_not_git');
  const root = await realpath(result.stdout.trim());
  const info = await stat(root);
  if (!info.isDirectory()) throw new Error('repository_root_not_directory');
  return root;
}

async function assertCommit(repoRoot, sha, run) {
  const result = await run(['git','-C',repoRoot,'cat-file','-e',`${sha}^{commit}`], { cwd: repoRoot, timeoutMs: 30000, maxOutputBytes: 65536 });
  assertOk(result, 'base_sha_not_found');
}

function parsePorcelain(value) {
  const chunks = value.split('\0').filter(Boolean);
  const entries = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const entry = chunks[index];
    const code = entry.slice(0, 2);
    const rawPath = entry.slice(3).replaceAll('\\', '/');
    entries.push(Object.freeze({ code, path: rawPath }));
    if (/[RC]/u.test(code) && index + 1 < chunks.length) index += 1;
  }
  return entries;
}

function enforcePathPolicy(task, file) {
  const normalized = path.posix.normalize(file.replaceAll('\\', '/'));
  if (normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) throw new Error('changed_path_unsafe');
  const lower = normalized.toLowerCase();
  if (BUILTIN_FORBIDDEN.some((token) => lower === token || lower.startsWith(token) || lower.includes(`/${token}`))) {
    throw new Error(`forbidden_changed_path:${normalized}`);
  }
  if (task.allowed_path_prefixes.length && !task.allowed_path_prefixes.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix))) {
    throw new Error(`changed_path_outside_allowlist:${normalized}`);
  }
}

async function gitText(worktree, args, run) {
  const result = await run(['git','-C',worktree,...args], { cwd: worktree, timeoutMs: 30000, maxOutputBytes: 65536 });
  assertOk(result, `git_${args[0]}_failed`);
  return result.stdout.trim();
}

function assertOk(result, classification) {
  if (result.exit_code !== 0 || result.timed_out) throw new Error(classification);
}

async function exists(value) {
  try { await access(value); return true; } catch { return false; }
}
