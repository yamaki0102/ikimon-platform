import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { runProcess, safeCodexEnvironment, writePrivateLog } from './process.mjs';

export async function invokeCodex({ lane, worktree, prompt, passNumber, logsDir }, options = {}) {
  const runner = options.runProcess ?? runProcess;
  const envSource = options.env ?? process.env;
  const executable = envSource.IKIMON_CODEX_BIN || 'codex';
  const model = lane === 'local_codex_terra'
    ? (envSource.IKIMON_CODEX_TERRA_MODEL || 'terra')
    : (envSource.IKIMON_CODEX_LUNA_MODEL || 'luna');
  const argv = [
    executable,
    'exec',
    '--cd', worktree,
    '--model', model,
    '--ask' + '-for-approval', 'never',
    '--sandbox', 'workspace-write',
    prompt,
  ];
  const result = await runner(argv, {
    cwd: worktree,
    env: safeCodexEnvironment(envSource, path.join(logsDir, '..', 'codex-guard')),
    timeoutMs: options.timeoutMs ?? 7200000,
    maxOutputBytes: options.maxOutputBytes ?? 4194304,
  });
  await mkdir(logsDir, { recursive: true, mode: 0o700 });
  const stem = `${String(passNumber).padStart(2, '0')}-${lane}`;
  await writePrivateLog(path.join(logsDir, `${stem}.stdout.log`), result.stdout);
  await writePrivateLog(path.join(logsDir, `${stem}.stderr.log`), result.stderr);
  return Object.freeze({
    lane,
    model,
    exit_code: result.exit_code,
    timed_out: result.timed_out,
    output_truncated: result.output_truncated,
    duration_ms: result.duration_ms,
    stdout_tail: tail(result.stdout),
    stderr_tail: tail(result.stderr),
  });
}

function tail(value) {
  return String(value).replace(/\x1b\[[0-9;]*m/gu, '').split(/\r?\n/u).slice(-40).join('\n').slice(-12000);
}
