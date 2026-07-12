#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    args[key.slice(2)] = value;
    index += 1;
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertInside(parent, child) {
  const parentPath = `${path.resolve(parent)}${path.sep}`;
  const childPath = path.resolve(child);
  if (!childPath.startsWith(parentPath)) {
    throw new Error(`Archive path escapes archive directory: ${childPath}`);
  }
}

function atomicWrite(filePath, content, mode = 0o600) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o750 });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporaryPath, content, { encoding: 'utf8', mode });
  fs.renameSync(temporaryPath, filePath);
  fs.chmodSync(filePath, mode);
}

function safeSegment(value, fallback) {
  const normalized = String(value ?? '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function timestampParts(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid archive timestamp: ${value}`);
  return {
    date,
    day: date.toISOString().slice(0, 10),
    compact: date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'),
  };
}

function copyOptional(sourcePath, destinationPath) {
  if (!sourcePath || !fs.existsSync(sourcePath)) return false;
  fs.copyFileSync(sourcePath, destinationPath);
  fs.chmodSync(destinationPath, 0o600);
  return true;
}

function pruneArchive(archiveDir, retentionDays, now) {
  if (!Number.isFinite(retentionDays) || retentionDays < 1) {
    throw new Error('retentionDays must be a positive number');
  }
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  let removedFiles = 0;
  if (!fs.existsSync(archiveDir)) return { removedFiles };

  for (const entry of fs.readdirSync(archiveDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d{4}-\d{2}-\d{2}$/.test(entry.name)) continue;
    const directoryPath = path.join(archiveDir, entry.name);
    assertInside(archiveDir, directoryPath);
    const day = new Date(`${entry.name}T00:00:00.000Z`);
    if (!Number.isFinite(day.getTime()) || day.getTime() >= cutoff) continue;
    for (const file of fs.readdirSync(directoryPath)) {
      const filePath = path.join(directoryPath, file);
      assertInside(archiveDir, filePath);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
        removedFiles += 1;
      }
    }
    if (fs.readdirSync(directoryPath).length === 0) fs.rmdirSync(directoryPath);
  }
  return { removedFiles };
}

export function archiveProductionVerificationEvidence({
  reportPath,
  logPath = '',
  runtimePath = '',
  archiveDir,
  retentionDays = 14,
  now = new Date(),
}) {
  if (!reportPath || !archiveDir) throw new Error('reportPath and archiveDir are required');
  const report = readJson(reportPath);
  if (report.schemaVersion !== 'ikimon_production_verification/v1') {
    throw new Error(`Unsupported verification report schema: ${report.schemaVersion}`);
  }
  const sha = String(report.expectedGitSha ?? '');
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('Verification report expectedGitSha is invalid');
  const finished = timestampParts(report.finishedAt ?? now.toISOString());
  const smokeTier = safeSegment(report.smokeTier, 'unknown');
  const status = safeSegment(report.status, 'unknown');
  const stem = `${finished.compact}-${sha.slice(0, 12)}-${smokeTier}-${status}`;
  const resolvedArchiveDir = path.resolve(archiveDir);
  const dayDir = path.join(resolvedArchiveDir, finished.day);
  assertInside(resolvedArchiveDir, dayDir);
  fs.mkdirSync(dayDir, { recursive: true, mode: 0o750 });

  const reportDestination = path.join(dayDir, `${stem}.json`);
  const logDestination = path.join(dayDir, `${stem}.log`);
  const runtimeDestination = path.join(dayDir, `${stem}.runtime.json`);
  atomicWrite(reportDestination, `${JSON.stringify(report, null, 2)}\n`);
  const logCopied = copyOptional(logPath, logDestination);
  const runtimeCopied = copyOptional(runtimePath, runtimeDestination);

  const latest = {
    schemaVersion: 'ikimon_production_verification_archive_pointer/v1',
    updatedAt: now.toISOString(),
    expectedGitSha: sha,
    status: report.status,
    smokeTier: report.smokeTier,
    report: path.relative(resolvedArchiveDir, reportDestination),
    log: logCopied ? path.relative(resolvedArchiveDir, logDestination) : null,
    runtime: runtimeCopied ? path.relative(resolvedArchiveDir, runtimeDestination) : null,
  };
  atomicWrite(path.join(resolvedArchiveDir, 'latest.json'), `${JSON.stringify(latest, null, 2)}\n`);
  const pruned = pruneArchive(resolvedArchiveDir, Number(retentionDays), now);

  return {
    archiveDir: resolvedArchiveDir,
    reportPath: reportDestination,
    logPath: logCopied ? logDestination : null,
    runtimePath: runtimeCopied ? runtimeDestination : null,
    removedFiles: pruned.removedFiles,
  };
}

export function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const result = archiveProductionVerificationEvidence({
    reportPath: args.report,
    logPath: args.log,
    runtimePath: args.runtime,
    archiveDir: args['archive-dir'],
    retentionDays: Number(args['retention-days'] ?? 14),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  }
}
