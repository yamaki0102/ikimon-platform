import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TOKEN_PATTERNS = [
  [/(?:gh[pousr]|github_pat)_[A-Za-z0-9_]+/gu, '[REDACTED_GITHUB_TOKEN]'],
  [/sk-[A-Za-z0-9_-]{12,}/gu, '[REDACTED_API_TOKEN]'],
  [/AKIA[0-9A-Z]{16}/gu, '[REDACTED_AWS_KEY]'],
  [/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/gu, '[REDACTED_PRIVATE_KEY]'],
];

export async function runProcess(argv, options = {}) {
  if (!Array.isArray(argv) || argv.length < 1) throw new Error('argv required');
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const timeoutMs = options.timeoutMs ?? 60000;
  const maxOutputBytes = options.maxOutputBytes ?? 1048576;
  const started = Date.now();
  return await new Promise((resolve, reject) => {
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let overflow = false;
    let timedOut = false;
    let settled = false;
    const detached = process.platform !== 'win32';
    const child = spawn(argv[0], argv.slice(1), {
      cwd,
      env: options.env ?? process.env,
      stdio: ['ignore','pipe','pipe'],
      windowsHide: true,
      shell: false,
      detached,
    });
    const terminate = (signal) => {
      if (!child.pid) return;
      try {
        if (detached) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {
        try { child.kill(signal); } catch { /* already exited */ }
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      terminate('SIGTERM');
      setTimeout(() => terminate('SIGKILL'), 2000).unref();
    }, timeoutMs);
    const collect = (current, chunk) => {
      if (current.length >= maxOutputBytes) { overflow = true; return current; }
      const remaining = maxOutputBytes - current.length;
      if (chunk.length > remaining) overflow = true;
      return Buffer.concat([current, chunk.subarray(0, remaining)]);
    };
    child.stdout.on('data', (chunk) => { stdout = collect(stdout, Buffer.from(chunk)); });
    child.stderr.on('data', (chunk) => { stderr = collect(stderr, Buffer.from(chunk)); });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(Object.freeze({
        argv: Object.freeze([...argv]),
        cwd,
        exit_code: Number.isInteger(code) ? code : null,
        signal: signal ?? null,
        timed_out: timedOut,
        output_truncated: overflow,
        stdout: redactSensitiveText(stdout.toString('utf8')),
        stderr: redactSensitiveText(stderr.toString('utf8')),
        duration_ms: Math.max(0, Date.now() - started),
      }));
    });
  });
}

export async function writePrivateLog(file, content) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const safeContent = redactSensitiveText(content);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = attempt === 0 ? file : `${file}.retry-${attempt}`;
    try {
      await writeFile(candidate, safeContent, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      return candidate;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }
  throw new Error('private_log_name_exhausted');
}

export function redactSensitiveText(value) {
  let text = String(value ?? '');
  for (const [pattern, replacement] of TOKEN_PATTERNS) text = text.replace(pattern, replacement);
  return text;
}

export function safeCheckEnvironment(runHome, base = process.env) {
  const env = minimalEnvironment(base);
  env.HOME = runHome;
  env.USERPROFILE = runHome;
  env.XDG_CONFIG_HOME = path.join(runHome, '.config');
  env.XDG_CACHE_HOME = path.join(runHome, '.cache');
  applyGitGuards(env, path.join(runHome, 'git-guard'));
  applyNetworkGuards(env);
  env.CI = '1';
  env.NO_COLOR = '1';
  return Object.freeze(env);
}

export function safeGitEnvironment(runHome, base = process.env, guardDir = null) {
  const env = minimalEnvironment(base);
  const home = path.resolve(runHome);
  env.HOME = home;
  env.USERPROFILE = home;
  env.XDG_CONFIG_HOME = path.join(home, '.config');
  env.XDG_CACHE_HOME = path.join(home, '.cache');
  env.GIT_CONFIG_NOSYSTEM = '1';
  applyGitGuards(env, guardDir || path.join(home, 'git-guard'));
  applyNetworkGuards(env);
  env.CI = '1';
  env.NO_COLOR = '1';
  return Object.freeze(env);
}

export function safeGitInspectionEnvironment(runHome, base = process.env) {
  const env = minimalEnvironment(base);
  const home = path.resolve(runHome);
  env.HOME = home;
  env.USERPROFILE = home;
  env.XDG_CONFIG_HOME = path.join(home, '.config');
  env.XDG_CACHE_HOME = path.join(home, '.cache');
  env.GIT_CONFIG_NOSYSTEM = '1';
  env.GIT_TERMINAL_PROMPT = '0';
  env.GIT_ASKPASS = process.platform === 'win32' ? 'cmd /c exit 1' : '/bin/false';
  applyNetworkGuards(env);
  env.CI = '1';
  env.NO_COLOR = '1';
  return Object.freeze(env);
}

export function safeCodexEnvironment(base = process.env, guardDir = null) {
  const env = minimalEnvironment(base, [
    'HOME','USERPROFILE','APPDATA','LOCALAPPDATA','WSLENV','WSL_DISTRO_NAME','CODEX_HOME','CODEX_LOG',
  ]);
  applyGitGuards(env, guardDir || path.join(optionsHome(env), '.ikimon-local-runner-guard'));
  env.GIT_SSH_COMMAND = process.platform === 'win32' ? 'cmd /c exit 1' : '/bin/false';
  const guard = guardDir || path.join(optionsHome(env), '.ikimon-local-runner-guard');
  env.GH_CONFIG_DIR = path.join(guard, 'gh');
  env.WRANGLER_HOME = path.join(guard, 'wrangler');
  env.CLOUDFLARE_HOME = path.join(guard, 'cloudflare');
  env.AWS_CONFIG_FILE = path.join(guard, 'aws-config');
  env.AWS_SHARED_CREDENTIALS_FILE = path.join(guard, 'aws-credentials');
  env.KUBECONFIG = path.join(guard, 'kubeconfig');
  env.AZURE_CONFIG_DIR = path.join(guard, 'azure');
  env.GOOGLE_APPLICATION_CREDENTIALS = path.join(guard, 'google-credentials-disabled');
  env.GH_TOKEN = '';
  env.GITHUB_TOKEN = '';
  env.CLOUDFLARE_API_TOKEN = '';
  env.CLOUDFLARE_ACCOUNT_ID = '';
  env.OPENAI_API_KEY = '';
  env.CI = '1';
  env.NO_COLOR = '1';
  return Object.freeze(env);
}

function minimalEnvironment(base, extras = []) {
  const env = {};
  for (const name of [
    'PATH','PATHEXT','SYSTEMROOT','WINDIR','COMSPEC','TMP','TEMP','LANG','LC_ALL','SHELL', ...extras,
  ]) {
    if (typeof base[name] === 'string') env[name] = base[name];
  }
  return env;
}

function applyGitGuards(env, guardDir) {
  const hooksDir = path.join(guardDir, 'empty-hooks');
  env.GIT_TERMINAL_PROMPT = '0';
  env.GIT_ASKPASS = process.platform === 'win32' ? 'cmd /c exit 1' : '/bin/false';
  env.GIT_CONFIG_COUNT = '4';
  env.GIT_CONFIG_KEY_0 = 'credential.helper';
  env.GIT_CONFIG_VALUE_0 = '';
  env.GIT_CONFIG_KEY_1 = 'remote.origin.pushurl';
  env.GIT_CONFIG_VALUE_1 = 'disabled://ikimon-local-runner';
  env.GIT_CONFIG_KEY_2 = 'core.hooksPath';
  env.GIT_CONFIG_VALUE_2 = hooksDir;
  env.GIT_CONFIG_KEY_3 = 'commit.gpgSign';
  env.GIT_CONFIG_VALUE_3 = 'false';
}

function applyNetworkGuards(env) {
  env.HTTP_PROXY = 'http://127.0.0.1:9';
  env.HTTPS_PROXY = 'http://127.0.0.1:9';
  env.ALL_PROXY = 'http://127.0.0.1:9';
  env.NO_PROXY = 'localhost,127.0.0.1,::1';
}

function optionsHome(env) {
  return env.HOME || env.USERPROFILE || process.cwd();
}
