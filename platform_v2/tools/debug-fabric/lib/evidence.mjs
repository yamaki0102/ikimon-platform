import { createHash, randomBytes } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function sha256(value) {
  return createHash('sha256').update(Buffer.isBuffer(value) ? value : Buffer.from(String(value))).digest('hex');
}

export function stableStringify(value) {
  return JSON.stringify(sort(value));
}

export async function writeEvidence(outDir, result, secrets) {
  await mkdir(outDir, { recursive: true, mode: 0o700 });
  const safeResult = JSON.parse(JSON.stringify(result));
  const capsule = {
    schema: 'ikimon.debug-capsule/v1',
    run_id: result.run_id,
    source_sha: result.source_sha,
    manifest_sha256: result.manifest_sha256,
    identity_start: result.identity_start,
    identity_end: result.identity_end,
    probe_ids: result.probes.map((probe) => probe.id),
  };
  const report = render(safeResult);
  const joined = `${JSON.stringify(safeResult)}\n${JSON.stringify(capsule)}\n${report}`;
  for (const [name, value] of Object.entries(secrets)) {
    if (typeof value === 'string' && value.length >= 4 && joined.includes(value)) {
      safeResult.status = 'UNSAFE';
      safeResult.classification = `evidence_secret_leak_${name}`;
      break;
    }
  }
  const paths = {
    result: path.join(outDir, 'result.json'),
    capsule: path.join(outDir, 'capsule.json'),
    report: path.join(outDir, 'debug-report.md'),
  };
  await atomic(paths.result, `${JSON.stringify(safeResult, null, 2)}\n`);
  await atomic(paths.capsule, `${JSON.stringify(capsule, null, 2)}\n`);
  await atomic(paths.report, render(safeResult));
  return paths;
}

function render(result) {
  const lines = [
    '# IKIMON Debug Fabric result', '',
    `- Status: **${result.status}**`,
    `- Classification: \`${result.classification}\``,
    `- Run ID: \`${result.run_id}\``,
    `- Source SHA: \`${result.source_sha ?? 'unknown'}\``,
    `- Duration: ${result.duration_ms} ms`, '', '## Probes',
  ];
  for (const probe of result.probes) lines.push(`- ${probe.id}: **${probe.status}** (${probe.classification})`);
  return `${lines.join('\n')}\n`;
}

async function atomic(file, content) {
  const temp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(temp, content, { mode: 0o600, flag: 'wx' });
  await rename(temp, file);
}

function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sort(value[key])]))
  }
  return value;
}
