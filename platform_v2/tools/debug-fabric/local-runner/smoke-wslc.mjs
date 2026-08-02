#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { runLocalDebugTask } from './run-local.mjs';

const exec = promisify(execFile);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

export async function runWslcSmoke(options = {}) {
  const id = options.id ?? new Date().toISOString().replace(/[-:.TZ]/gu, '').slice(0, 14);
  const root = path.resolve(options.root ?? path.join(os.homedir(), '.ikimon-debug-fabric', 'smoke', id));
  const repository = path.join(root, 'fixture-repository');
  const runDir = path.join(root, 'run');
  await mkdir(path.join(repository, 'src'), { recursive: true, mode: 0o700 });
  await writeFile(path.join(repository, 'src', '.gitkeep'), '', { mode: 0o600, flag: 'wx' });
  await writeFile(path.join(repository, 'README.md'), '# IKIMON Local Luna smoke fixture\n', { mode: 0o600, flag: 'wx' });
  await writeFile(path.join(repository, 'check.mjs'), "import { readFileSync } from 'node:fs';\nif (readFileSync('src/result.txt','utf8').trim() !== 'fixed') process.exit(2);\n", { mode: 0o600, flag: 'wx' });
  await git(repository, ['init','-b','main']);
  await git(repository, ['config','user.name','IKIMON WSLC Smoke']);
  await git(repository, ['config','user.email','wslc-smoke@ikimon.invalid']);
  await git(repository, ['add','.']);
  await git(repository, ['commit','--no-gpg-sign','-m','smoke fixture base']);
  const baseSha = (await git(repository, ['rev-parse','HEAD'])).trim();
  const task = {
    schema: 'ikimon.local-debug-task/v1',
    task_id: `wslc-smoke-${id}`.toLowerCase(),
    repository_path: repository,
    base_sha: baseSha,
    branch_name: `debug/wslc-smoke-${id}`.toLowerCase(),
    scope: 'fix_loop',
    risk: 'p3',
    repository_count: 1,
    objective: 'Create src/result.txt containing exactly the single line fixed. Do not change any other file.',
    acceptance_criteria: [
      'src/result.txt exists and contains exactly fixed followed by one newline.',
      'The deterministic check exits successfully.',
      'No file outside src is changed.',
    ],
    checks: [{ id: 'smoke-result', argv: ['node','check.mjs'], cwd: '.', timeout_seconds: 30, max_output_bytes: 65536 }],
    max_luna_passes: 1,
    max_terra_passes: 0,
    allow_terra: false,
    max_changed_files: 1,
    allowed_path_prefixes: ['src'],
    allow_no_changes: false,
    commit_message: 'test(debug-fabric): complete WSLC Luna smoke',
  };
  const result = await runLocalDebugTask(task, {
    runDir,
    invokeCodex: options.invokeCodex,
    env: options.env,
  });
  const evidencePath = path.join(runDir, 'artifacts', 'local-evidence.json');
  const evidence = result.status === 'pass' ? JSON.parse(await readFile(evidencePath, 'utf8')) : null;
  if (evidence && (evidence.candidate_sha !== result.candidate_sha || evidence.status !== 'PASS')) {
    throw new Error('smoke_evidence_readback_mismatch');
  }
  return Object.freeze({ ...result, root, repository, evidence_path: evidence ? evidencePath : null });
}

async function git(cwd, args) {
  const { stdout } = await exec('git', args, {
    cwd,
    env: { PATH: process.env.PATH, HOME: cwd, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' },
    maxBuffer: 1024 * 1024,
  });
  return stdout;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    const result = await runWslcSmoke({ root: args.root });
    console.log(`status=${result.status}`);
    console.log(`classification=${result.classification ?? 'none'}`);
    console.log(`candidate_sha=${result.candidate_sha ?? 'none'}`);
    console.log(`evidence=${result.evidence_path ?? 'none'}`);
    console.log(`smoke_root=${result.root}`);
    process.exitCode = result.status === 'pass' ? 0 : 1;
  } catch (error) {
    console.error(`ERROR: ${String(error?.message ?? error)}`);
    process.exitCode = 2;
  }
}

function parseArgs(argv) {
  const out = { root: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--root') out.root = argv[++index] ?? null;
    else if (argv[index] === '--help' || argv[index] === '-h') {
      console.log('Usage: node local-runner/smoke-wslc.mjs [--root <private-smoke-dir>]');
      process.exit(0);
    } else throw new Error('unsupported CLI argument');
  }
  return out;
}
