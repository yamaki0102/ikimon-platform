import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { runProcess, safeCodexEnvironment, writePrivateLog } from './process.mjs';

export async function invokeCodex({ lane, worktree, prompt, passNumber, logsDir }, options = {}) {
  const runner = options.runProcess ?? runProcess;
  const envSource = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const executable = envSource.IKIMON_CODEX_BIN || (platform === 'win32' ? 'codex.exe' : 'codex');
  const invocation = resolveCodexInvocation(executable, envSource, platform);
  const model = lane === 'local_codex_terra'
    ? (envSource.IKIMON_CODEX_TERRA_MODEL || 'gpt-5.6-terra')
    : (envSource.IKIMON_CODEX_LUNA_MODEL || 'gpt-5.6-luna');
  const argv = [
    invocation.executable,
    ...invocation.prefixArgs,
    '-c', 'approval_policy="never"',
    'exec',
    '--cd', worktree,
    '--model', model,
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

export function resolveCodexInvocation(executable, envSource = process.env, platform = process.platform) {
  if (platform !== 'win32') return Object.freeze({ executable, prefixArgs: Object.freeze([]) });

  const name = path.basename(String(executable)).toLowerCase();
  if (name === 'codex.js' && existsSync(executable)) {
    return Object.freeze({ executable: process.execPath, prefixArgs: Object.freeze([path.resolve(executable)]) });
  }
  if (!['codex', 'codex.cmd', 'codex.exe', 'codex.ps1'].includes(name)) {
    return Object.freeze({ executable, prefixArgs: Object.freeze([]) });
  }

  const invocation = findCodexEntrypoint(executable, envSource);
  if (!invocation) return Object.freeze({ executable, prefixArgs: Object.freeze([]) });
  return Object.freeze({ executable: invocation.executable, prefixArgs: Object.freeze(invocation.prefixArgs) });
}

function findCodexEntrypoint(executable, envSource) {
  const directories = [];
  if (path.isAbsolute(executable)) directories.push(path.dirname(executable));
  for (const entry of String(envSource.PATH ?? '').split(path.delimiter)) {
    if (entry) directories.push(entry.replace(/^"|"$/gu, ''));
  }
  if (envSource.APPDATA) directories.push(path.join(envSource.APPDATA, 'npm'));
  if (envSource.npm_config_prefix) {
    directories.push(envSource.npm_config_prefix, path.join(envSource.npm_config_prefix, 'bin'));
  }

  const seen = new Set();
  for (const directory of directories) {
    const normalized = path.resolve(directory);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const nativeEntrypoint = path.join(
      normalized,
      'node_modules',
      '@openai',
      'codex',
      'node_modules',
      '@openai',
      `codex-win32-${process.arch === 'arm64' ? 'arm64' : 'x64'}`,
      'vendor',
      process.arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc',
      'bin',
      'codex.exe',
    );
    if (existsSync(nativeEntrypoint)) return { executable: path.resolve(nativeEntrypoint), prefixArgs: [] };
    for (const candidate of [
      path.join(normalized, 'node_modules', '@openai', 'codex', 'bin', 'codex.js'),
      path.join(normalized, '..', 'node_modules', '@openai', 'codex', 'bin', 'codex.js'),
    ]) {
      if (existsSync(candidate)) return { executable: process.execPath, prefixArgs: [path.resolve(candidate)] };
    }
  }
  return null;
}

function tail(value) {
  return String(value).replace(/\x1b\[[0-9;]*m/gu, '').split(/\r?\n/u).slice(-40).join('\n').slice(-12000);
}
