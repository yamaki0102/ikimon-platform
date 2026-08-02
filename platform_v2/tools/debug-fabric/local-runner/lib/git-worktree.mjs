import { access, lstat, mkdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { readJsonIfExists, sha256, stableStringify, writeExclusiveJson } from './ledger.mjs';
import { runProcess, safeGitEnvironment, safeGitInspectionEnvironment } from './process.mjs';

const SHA40 = /^[0-9a-f]{40}$/u;
const BUILTIN_FORBIDDEN = [
  '.env', '.env.', '.dev.vars', 'credentials', 'private-key', '.github/workflows/',
];
const RECOVERABLE_CANDIDATE_PHASES = new Set(['creating_candidate_commit','candidate_committed','finalizing_candidate']);

export async function prepareWorktree(task, ledger, options = {}) {
  const context = gitContext(ledger, options);
  await mkdir(path.join(context.git_guard_dir, 'empty-hooks'), { recursive: true, mode: 0o700 });
  await mkdir(context.git_home_dir, { recursive: true, mode: 0o700 });
  const repoRoot = await resolveRepositoryRoot(task.repository_path, context);
  await assertCommit(repoRoot, task.base_sha, context);
  await assertBranchName(repoRoot, task.branch_name, context);
  await mkdir(path.dirname(ledger.worktree_dir), { recursive: true, mode: 0o700 });
  if (!(await exists(ledger.worktree_dir))) {
    const branchExists = await context.run(['git','-C',repoRoot,'show-ref','--verify','--quiet',`refs/heads/${task.branch_name}`], gitOptions(repoRoot, context, 30000, 65536));
    if (branchExists.exit_code === 0) throw new Error('debug_branch_already_exists');
    if (branchExists.exit_code !== 1) throw new Error('git_branch_probe_failed');
    const added = await context.run(['git','-C',repoRoot,'worktree','add','--detach',ledger.worktree_dir,task.base_sha], gitOptions(repoRoot, context, 120000, 1048576));
    assertOk(added, 'git_worktree_add_failed');
    const switched = await context.run(['git','-C',ledger.worktree_dir,'switch','-c',task.branch_name], gitOptions(ledger.worktree_dir, context, 30000, 1048576));
    assertOk(switched, 'git_branch_create_failed');
  }
  await ensureRepositoryGuard(ledger.worktree_dir, task, ledger.repository_guard_path, context);
  const inspected = await inspectWorktree(task, ledger.worktree_dir, context);
  if (inspected.head_sha === task.base_sha) {
    if (ledger.state.candidate_sha) throw new Error('persisted_candidate_missing_from_worktree');
    return Object.freeze({ repo_root: repoRoot, worktree: ledger.worktree_dir, branch: task.branch_name, head_sha: inspected.head_sha, candidate_sha: null });
  }
  const parent = await gitText(ledger.worktree_dir, ['rev-parse',`${inspected.head_sha}^`], context);
  const persistedMatches = ledger.state.candidate_sha === inspected.head_sha;
  const phaseAllowsRecovery = RECOVERABLE_CANDIDATE_PHASES.has(ledger.state.phase);
  if (parent !== task.base_sha || (!persistedMatches && !phaseAllowsRecovery)) throw new Error('worktree_head_moved_before_runner_commit');
  const commitIdentity = await gitText(ledger.worktree_dir, ['show','-s','--format=%ae%x00%ce%x00%s',inspected.head_sha], context);
  const [authorEmail, committerEmail, subject] = commitIdentity.split('\0');
  if (authorEmail !== 'local-debug@ikimon.invalid' || committerEmail !== 'local-debug@ikimon.invalid' || subject !== task.commit_message) {
    throw new Error('candidate_recovery_identity_mismatch');
  }
  if (!inspected.clean || inspected.staged) throw new Error('candidate_recovery_worktree_not_clean');
  return Object.freeze({ repo_root: repoRoot, worktree: ledger.worktree_dir, branch: task.branch_name, head_sha: inspected.head_sha, candidate_sha: inspected.head_sha });
}

export async function verifyWorktree(task, worktree, options = {}) {
  const context = gitContext(options.ledger ?? null, options);
  const inspected = await inspectWorktree(task, worktree, context);
  if (inspected.head_sha !== task.base_sha) throw new Error('worktree_head_moved_before_runner_commit');
  if (inspected.staged) throw new Error('codex_staged_changes_forbidden');
  if (options.repositoryGuardPath) await verifyRepositoryGuard(worktree, task, options.repositoryGuardPath, context);
  return inspected;
}

export async function collectChanges(task, worktree, options = {}) {
  const context = gitContext(options.ledger ?? null, options);
  await verifyWorktree(task, worktree, options);
  const status = await context.run(['git','-C',worktree,'status','--porcelain=v1','-z','--untracked-files=all'], gitOptions(worktree, context, 30000, 1048576));
  assertOk(status, 'git_status_failed');
  const entries = parsePorcelain(status.stdout);
  await validateChangedEntries(task, worktree, entries);
  return Object.freeze({ entries: Object.freeze(entries) });
}

export async function collectCommittedChanges(task, worktree, candidateSha, options = {}) {
  if (!SHA40.test(candidateSha)) throw new Error('candidate_sha_invalid');
  const context = gitContext(options.ledger ?? null, options);
  const inspected = await inspectWorktree(task, worktree, context);
  if (inspected.head_sha !== candidateSha || !inspected.clean || inspected.staged) throw new Error('candidate_worktree_not_clean');
  const parent = await gitText(worktree, ['rev-parse',`${candidateSha}^`], context);
  if (parent !== task.base_sha) throw new Error('candidate_parent_mismatch');
  if (options.repositoryGuardPath) await verifyRepositoryGuard(worktree, task, options.repositoryGuardPath, context);
  const changed = await context.run(['git','-C',worktree,'diff','--name-status','-z','--no-renames',task.base_sha,candidateSha], gitOptions(worktree, context, 30000, 1048576));
  assertOk(changed, 'candidate_changed_files_read_failed');
  const entries = parseNameStatus(changed.stdout);
  await validateChangedEntries(task, worktree, entries);
  return Object.freeze({ entries: Object.freeze(entries) });
}

export async function createCandidateCommit(task, worktree, options = {}) {
  const context = gitContext(options.ledger ?? null, options);
  await verifyWorktree(task, worktree, options);
  const add = await context.run(['git','-C',worktree,'add','--all'], gitOptions(worktree, context, 30000, 1048576));
  assertOk(add, 'git_add_failed');
  const staged = await context.run(['git','-C',worktree,'diff','--cached','--name-only','-z'], gitOptions(worktree, context, 30000, 1048576));
  assertOk(staged, 'git_staged_paths_read_failed');
  const stagedEntries = staged.stdout.split('\0').filter(Boolean).map((file) => Object.freeze({ code: 'S', path: file.replaceAll('\\', '/') }));
  await validateChangedEntries(task, worktree, stagedEntries);
  const commitEnv = {
    ...context.git_env,
    GIT_AUTHOR_NAME: 'IKIMON Local Debug Runner',
    GIT_AUTHOR_EMAIL: 'local-debug@ikimon.invalid',
    GIT_COMMITTER_NAME: 'IKIMON Local Debug Runner',
    GIT_COMMITTER_EMAIL: 'local-debug@ikimon.invalid',
  };
  const commit = await context.run([
    'git','-C',worktree,'-c',`core.hooksPath=${path.join(context.git_guard_dir, 'empty-hooks')}`,
    'commit','--no-verify','--no-gpg-sign','-m',task.commit_message,
  ], { ...gitOptions(worktree, context, 120000, 1048576), env: commitEnv });
  assertOk(commit, 'git_candidate_commit_failed');
  const candidate = await gitText(worktree, ['rev-parse','HEAD'], context);
  if (!SHA40.test(candidate) || candidate === task.base_sha) throw new Error('candidate_sha_invalid');
  const inspected = await inspectWorktree(task, worktree, context);
  if (!inspected.clean || inspected.staged) throw new Error('candidate_worktree_not_clean');
  if (options.repositoryGuardPath) await verifyRepositoryGuard(worktree, task, options.repositoryGuardPath, context);
  return candidate;
}

export async function readCandidateIdentity(worktree, candidateSha, options = {}) {
  if (!SHA40.test(candidateSha)) throw new Error('candidate_sha_invalid');
  const context = gitContext(options.ledger ?? null, options);
  const patch = await context.run(['git','-C',worktree,'show','--format=','--binary','--no-ext-diff',candidateSha], gitOptions(worktree, context, 120000, 8388608));
  assertOk(patch, 'candidate_patch_read_failed');
  const treeSha = await gitText(worktree, ['rev-parse',`${candidateSha}^{tree}`], context);
  if (!SHA40.test(treeSha)) throw new Error('candidate_tree_sha_invalid');
  return Object.freeze({ candidate_sha: candidateSha, tree_sha: treeSha, patch: patch.stdout });
}

export async function captureRepositoryGuard(worktree, task, options = {}) {
  const context = gitContext(options.ledger ?? null, options);
  const inspection = context.inspection_env;
  const config = await context.run(['git','-C',worktree,'config','--local','--null','--list'], { cwd: worktree, env: inspection, timeoutMs: 30000, maxOutputBytes: 1048576 });
  assertOk(config, 'repository_config_read_failed');
  const refs = await context.run(['git','-C',worktree,'for-each-ref','--format=%(refname)%09%(objectname)'], { cwd: worktree, env: inspection, timeoutMs: 30000, maxOutputBytes: 1048576 });
  assertOk(refs, 'repository_refs_read_failed');
  const filteredRefs = refs.stdout.split(/\r?\n/u).filter(Boolean).filter((line) => !line.startsWith(`refs/heads/${task.branch_name}\t`)).sort();
  return Object.freeze({
    schema: 'ikimon.local-repository-guard/v1',
    config_sha256: sha256(config.stdout),
    refs_sha256: sha256(filteredRefs.join('\n')),
  });
}

async function ensureRepositoryGuard(worktree, task, file, context) {
  const current = await captureRepositoryGuard(worktree, task, { ...context, ledger: null });
  const persisted = await readJsonIfExists(file);
  if (!persisted) {
    await writeExclusiveJson(file, current);
    return;
  }
  if (stableStringify(persisted) !== stableStringify(current)) throw new Error('repository_control_state_changed');
}

async function verifyRepositoryGuard(worktree, task, file, context) {
  const persisted = await readJsonIfExists(file);
  if (!persisted) throw new Error('repository_guard_missing');
  const current = await captureRepositoryGuard(worktree, task, { ...context, ledger: null });
  if (stableStringify(persisted) !== stableStringify(current)) throw new Error('repository_control_state_changed');
}

async function inspectWorktree(task, worktree, context) {
  const head = await gitText(worktree, ['rev-parse','HEAD'], context);
  const branch = await gitText(worktree, ['rev-parse','--abbrev-ref','HEAD'], context);
  if (branch !== task.branch_name) throw new Error('worktree_branch_mismatch');
  const stagedResult = await context.run(['git','-C',worktree,'diff','--cached','--quiet'], gitOptions(worktree, context, 30000, 65536));
  if (![0,1].includes(stagedResult.exit_code) || stagedResult.timed_out) throw new Error('git_staged_probe_failed');
  const status = await context.run(['git','-C',worktree,'status','--porcelain=v1'], gitOptions(worktree, context, 30000, 65536));
  assertOk(status, 'git_status_failed');
  return Object.freeze({ head_sha: head, branch, staged: stagedResult.exit_code === 1, clean: status.stdout.trim() === '' });
}

async function validateChangedEntries(task, worktree, entries) {
  if (entries.length > task.max_changed_files) throw new Error('changed_file_limit_exceeded');
  for (const entry of entries) {
    if (/[RC]/u.test(entry.code)) throw new Error(`rename_or_copy_forbidden:${entry.path}`);
    enforcePathPolicy(task, entry.path);
    await assertSafeFileType(worktree, entry.path);
  }
}

async function assertSafeFileType(worktree, file) {
  try {
    const info = await lstat(path.resolve(worktree, file));
    if (info.isSymbolicLink()) throw new Error(`changed_symlink_forbidden:${file}`);
    if (info.isDirectory()) throw new Error(`changed_directory_or_gitlink_forbidden:${file}`);
    if (!info.isFile()) throw new Error(`changed_file_type_forbidden:${file}`);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
}

async function resolveRepositoryRoot(input, context) {
  await access(input);
  const result = await context.run(['git','-C',input,'rev-parse','--show-toplevel'], gitOptions(input, context, 30000, 65536));
  assertOk(result, 'repository_not_git');
  const root = await realpath(result.stdout.trim());
  const info = await stat(root);
  if (!info.isDirectory()) throw new Error('repository_root_not_directory');
  return root;
}

async function assertCommit(repoRoot, sha, context) {
  const result = await context.run(['git','-C',repoRoot,'cat-file','-e',`${sha}^{commit}`], gitOptions(repoRoot, context, 30000, 65536));
  assertOk(result, 'base_sha_not_found');
}

async function assertBranchName(repoRoot, branchName, context) {
  const result = await context.run(['git','-C',repoRoot,'check-ref-format','--branch',branchName], gitOptions(repoRoot, context, 30000, 65536));
  assertOk(result, 'invalid_branch_name');
}

function parsePorcelain(value) {
  const chunks = value.split('\0').filter(Boolean);
  const entries = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const entry = chunks[index];
    const code = entry.slice(0, 2);
    const rawPath = entry.slice(3).replaceAll('\\', '/');
    if (/[RC]/u.test(code)) throw new Error(`rename_or_copy_forbidden:${rawPath}`);
    entries.push(Object.freeze({ code, path: rawPath }));
  }
  return entries;
}

function parseNameStatus(value) {
  const chunks = value.split('\0').filter(Boolean);
  if (chunks.length % 2 !== 0) throw new Error('candidate_name_status_invalid');
  const entries = [];
  for (let index = 0; index < chunks.length; index += 2) {
    const code = chunks[index];
    const file = chunks[index + 1].replaceAll('\\', '/');
    if (/[RC]/u.test(code)) throw new Error(`rename_or_copy_forbidden:${file}`);
    entries.push(Object.freeze({ code, path: file }));
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

async function gitText(worktree, args, context) {
  const result = await context.run(['git','-C',worktree,...args], gitOptions(worktree, context, 30000, 65536));
  assertOk(result, `git_${args[0]}_failed`);
  return result.stdout.trim();
}

function gitContext(ledger, options) {
  if (options?.run && options?.git_env && options?.inspection_env) return options;
  const gitHomeDir = options.gitHomeDir || ledger?.home_dir || path.join(process.cwd(), '.ikimon-local-git-home');
  const gitGuardDir = options.gitGuardDir || ledger?.git_guard_dir || path.join(gitHomeDir, 'git-guard');
  return Object.freeze({
    run: options.runProcess ?? runProcess,
    git_home_dir: gitHomeDir,
    git_guard_dir: gitGuardDir,
    git_env: safeGitEnvironment(gitHomeDir, options.env ?? process.env, gitGuardDir),
    inspection_env: safeGitInspectionEnvironment(gitHomeDir, options.env ?? process.env),
  });
}

function gitOptions(cwd, context, timeoutMs, maxOutputBytes) {
  return { cwd, env: context.git_env, timeoutMs, maxOutputBytes };
}

function assertOk(result, classification) {
  if (result.exit_code !== 0 || result.timed_out) throw new Error(classification);
}

async function exists(value) {
  try { await access(value); return true; } catch { return false; }
}
