import { createHash, randomBytes } from 'node:crypto';
import { appendFile, mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function sha256(value) {
  return createHash('sha256').update(Buffer.isBuffer(value) ? value : Buffer.from(String(value))).digest('hex');
}

export function stableStringify(value) {
  return JSON.stringify(sort(value));
}

export async function openRunLedger(runDir, task) {
  const absolute = path.resolve(runDir);
  await mkdir(absolute, { recursive: true, mode: 0o700 });
  const taskHash = sha256(stableStringify(task));
  const statePath = path.join(absolute, 'state.json');
  const taskPath = path.join(absolute, 'task.json');
  let state;
  try {
    state = JSON.parse(await readFile(statePath, 'utf8'));
    const persistedTask = JSON.parse(await readFile(taskPath, 'utf8'));
    if (sha256(stableStringify(persistedTask)) !== taskHash) throw new Error('task_hash_mismatch_on_resume');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    await writeExclusive(taskPath, `${JSON.stringify(task, null, 2)}\n`);
    state = initialState(taskHash);
    await atomicJson(statePath, state);
  }
  const releaseLock = await acquireLock(path.join(absolute, 'run.lock'));
  return Object.freeze({
    run_dir: absolute,
    state_path: statePath,
    task_path: taskPath,
    events_path: path.join(absolute, 'events.jsonl'),
    logs_dir: path.join(absolute, 'logs'),
    artifacts_dir: path.join(absolute, 'artifacts'),
    home_dir: path.join(absolute, 'isolated-home'),
    worktree_dir: path.join(absolute, 'worktree'),
    task_hash: taskHash,
    state,
    release_lock: releaseLock,
  });
}

export async function appendEvent(ledger, type, detail = {}) {
  const event = {
    schema: 'ikimon.local-debug-event/v1',
    event_id: `evt-${Date.now()}-${randomBytes(4).toString('hex')}`,
    at: new Date().toISOString(),
    type,
    detail,
  };
  const handle = await open(ledger.events_path, 'a', 0o600);
  try {
    await handle.write(`${JSON.stringify(event)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
  return event;
}

export async function updateState(ledger, patch) {
  const next = Object.freeze({ ...ledger.state, ...patch, updated_at: new Date().toISOString() });
  await atomicJson(ledger.state_path, next);
  return next;
}

export async function writeExclusiveJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeExclusive(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function acquireLock(file) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  try {
    await writeExclusive(file, `${JSON.stringify({ pid: process.pid, acquired_at: new Date().toISOString() })}\n`);
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const lock = JSON.parse(await readFile(file, 'utf8'));
    if (Number.isInteger(lock.pid) && processAlive(lock.pid)) throw new Error('run_already_locked');
    const info = await stat(file);
    await rename(file, `${file}.stale-${Math.round(info.mtimeMs)}-${randomBytes(3).toString('hex')}`);
    await writeExclusive(file, `${JSON.stringify({ pid: process.pid, acquired_at: new Date().toISOString(), recovered: true })}\n`);
  }
  return async () => { await rm(file, { force: true }); };
}

function processAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function initialState(taskHash) {
  const now = new Date().toISOString();
  return Object.freeze({
    schema: 'ikimon.local-debug-state/v1',
    task_hash: taskHash,
    status: 'not_started',
    phase: 'created',
    luna_passes: 0,
    terra_passes: 0,
    same_signature_failures: 0,
    last_failure_signature: null,
    candidate_sha: null,
    evidence_sha256: null,
    created_at: now,
    updated_at: now,
  });
}

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  await rename(temp, file);
}

async function writeExclusive(file, content) {
  await writeFile(file, content, { mode: 0o600, flag: 'wx' });
}

function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sort(value[key])]))
  }
  return value;
}
