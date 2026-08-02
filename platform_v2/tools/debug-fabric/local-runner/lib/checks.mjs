import { mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { runProcess, safeCheckEnvironment, writePrivateLog } from './process.mjs';
import { sha256 } from './ledger.mjs';

export async function runChecks(task, worktree, ledger, options = {}) {
  const runner = options.runProcess ?? runProcess;
  await mkdir(ledger.home_dir, { recursive: true, mode: 0o700 });
  const root = await realpath(worktree);
  const results = [];
  for (const check of task.checks) {
    const requestedCwd = path.resolve(root, check.cwd);
    if (!within(root, requestedCwd)) throw new Error('check_cwd_outside_worktree');
    const cwd = await realpath(requestedCwd);
    if (!within(root, cwd)) throw new Error('check_cwd_symlink_escape');
    await assertScriptArgumentsInsideWorktree(check.argv, cwd, root);
    const result = await runner(check.argv, {
      cwd,
      env: safeCheckEnvironment(ledger.home_dir, options.env ?? process.env),
      timeoutMs: check.timeout_seconds * 1000,
      maxOutputBytes: check.max_output_bytes,
    });
    const pass = String(options.passNumber ?? 0).padStart(2, '0');
    const stdoutFile = path.join(ledger.logs_dir, `${pass}-check-${check.id}.stdout.log`);
    const stderrFile = path.join(ledger.logs_dir, `${pass}-check-${check.id}.stderr.log`);
    await writePrivateLog(stdoutFile, result.stdout);
    await writePrivateLog(stderrFile, result.stderr);
    results.push(Object.freeze({
      id: check.id,
      status: result.exit_code === 0 && !result.timed_out ? 'PASS' : 'FAIL',
      exit_code: result.exit_code,
      timed_out: result.timed_out,
      output_truncated: result.output_truncated,
      duration_ms: result.duration_ms,
      stdout_sha256: sha256(result.stdout),
      stderr_sha256: sha256(result.stderr),
      failure_tail: sanitizeTail(`${result.stdout}\n${result.stderr}`),
    }));
  }
  return Object.freeze(results);
}

export function failureSignature(results) {
  const failed = results.filter((entry) => entry.status !== 'PASS');
  if (!failed.length) return null;
  const canonical = failed.map((entry) => ({
    id: entry.id,
    exit_code: entry.exit_code,
    timed_out: entry.timed_out,
    failure_tail: normalize(entry.failure_tail),
  }));
  return sha256(JSON.stringify(canonical));
}

export function failureSummary(results) {
  return results.filter((entry) => entry.status !== 'PASS')
    .map((entry) => `### ${entry.id}\nexit=${entry.exit_code} timeout=${entry.timed_out}\n${entry.failure_tail}`)
    .join('\n\n')
    .slice(0, 24000);
}

async function assertScriptArgumentsInsideWorktree(argv, cwd, root) {
  const executable = argv[0].toLowerCase();
  let candidate = null;
  if (executable === 'bash' || executable === 'sh') candidate = argv[1] ?? null;
  else if (executable === 'powershell' || executable === 'pwsh') {
    const index = argv.findIndex((value) => value.toLowerCase() === '-file');
    candidate = index >= 0 ? argv[index + 1] : null;
  } else if (executable === 'python' || executable === 'python3' || executable === 'php') {
    candidate = argv.slice(1).find((value, index, values) => {
      if (value.startsWith('-')) return false;
      if (index > 0 && values[index - 1] === '-m') return false;
      return true;
    }) ?? null;
  } else if (executable === 'node') {
    candidate = argv.slice(1).find((value) => !value.startsWith('-') && /\.(?:c?js|mjs|ts|tsx)$/u.test(value)) ?? null;
  }
  if (!candidate || path.isAbsolute(candidate)) {
    if (candidate && path.isAbsolute(candidate)) throw new Error('check_script_must_be_relative');
    return;
  }
  const resolved = await realpath(path.resolve(cwd, candidate));
  if (!within(root, resolved)) throw new Error('check_script_symlink_escape');
}

function sanitizeTail(value) {
  return String(value)
    .replace(/\x1b\[[0-9;]*m/gu, '')
    .split(/\r?\n/u).slice(-60).join('\n').slice(-16000);
}
function normalize(value) {
  return value
    .replace(/[0-9a-f]{40}/gu, '<sha>')
    .replace(/\b\d+(?:\.\d+)?(?:ms|s|m)?\b/gu, '<n>')
    .replaceAll('\\', '/')
    .trim();
}
function within(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
