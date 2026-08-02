import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { runProcess, safeCheckEnvironment, writePrivateLog } from './process.mjs';
import { sha256 } from './ledger.mjs';

export async function runChecks(task, worktree, ledger, options = {}) {
  const runner = options.runProcess ?? runProcess;
  await mkdir(ledger.home_dir, { recursive: true, mode: 0o700 });
  const results = [];
  for (const check of task.checks) {
    const cwd = path.resolve(worktree, check.cwd);
    if (!within(worktree, cwd)) throw new Error('check_cwd_outside_worktree');
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

function sanitizeTail(value) {
  return String(value)
    .replace(/\x1b\[[0-9;]*m/gu, '')
    .replace(/(?:gh[pousr]|github_pat)_[A-Za-z0-9_]+/gu, '[REDACTED_TOKEN]')
    .replace(/sk-[A-Za-z0-9_-]{12,}/gu, '[REDACTED_TOKEN]')
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
