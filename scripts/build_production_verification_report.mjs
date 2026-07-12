#!/usr/bin/env node
import { createHash } from 'node:crypto';
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

export function parseVerificationLog(source) {
  const lines = String(source ?? '').split(/\r?\n/);
  const phases = [];
  const endpoints = [];
  for (const line of lines) {
    const phase = line.match(/^==\s+(.+?)\s+==$/);
    if (phase) phases.push(phase[1]);
    const endpoint = line.match(/^(OK|FAIL)\s+(https?:\/\/\S+)\s+->\s+(\d{3})$/);
    if (endpoint) {
      endpoints.push({
        outcome: endpoint[1] === 'OK' ? 'success' : 'failure',
        url: endpoint[2],
        status: Number(endpoint[3]),
      });
    }
  }
  return { lines, phases, endpoints };
}

export function buildProductionVerificationReport(input) {
  const {
    expectedGitSha,
    actualGitSha = '',
    exitCode,
    startedAt,
    finishedAt,
    smokeTier,
    source,
    runnerId = '',
    logPath = '',
    log = '',
    runtime = null,
  } = input;
  if (!/^[0-9a-f]{40}$/i.test(expectedGitSha ?? '')) {
    throw new Error('expectedGitSha must be a 40-character SHA');
  }
  const numericExitCode = Number(exitCode);
  if (!Number.isInteger(numericExitCode) || numericExitCode < 0) {
    throw new Error('exitCode must be a non-negative integer');
  }
  const parsed = parseVerificationLog(log);
  const status = numericExitCode === 0 ? 'success' : 'failure';
  const startedMs = Date.parse(startedAt);
  const finishedMs = Date.parse(finishedAt);
  const logBuffer = Buffer.from(log, 'utf8');
  const phaseChecks = parsed.phases.map((name, index) => ({
    id: `phase-${index + 1}`,
    name,
    outcome: status === 'failure' && index === parsed.phases.length - 1 ? 'failure' : 'success',
  }));
  return {
    schemaVersion: 'ikimon_production_verification/v1',
    status,
    exitCode: numericExitCode,
    startedAt,
    finishedAt,
    durationMs: Number.isFinite(startedMs) && Number.isFinite(finishedMs)
      ? Math.max(0, finishedMs - startedMs)
      : null,
    expectedGitSha,
    actualGitSha: /^[0-9a-f]{40}$/i.test(actualGitSha ?? '') ? actualGitSha : null,
    shaMatches: /^[0-9a-f]{40}$/i.test(actualGitSha ?? '') ? actualGitSha === expectedGitSha : null,
    smokeTier,
    source,
    runnerId: runnerId || null,
    productionMutation: false,
    noPersonalData: true,
    checks: phaseChecks,
    endpoints: parsed.endpoints,
    runtime: runtime && typeof runtime === 'object'
      ? {
          workerVersion: runtime.workerVersion ?? null,
          uiBundleHash: runtime.uiBundleHash ?? null,
          originalUiManifestHash: runtime.originalUiManifestHash ?? null,
          deployedAt: runtime.deployedAt ?? null,
          buildMarker: runtime.buildMarker ?? null,
        }
      : null,
    log: {
      path: logPath || null,
      bytes: logBuffer.length,
      lines: parsed.lines.length,
      sha256: createHash('sha256').update(logBuffer).digest('hex'),
    },
  };
}

export function writeProductionVerificationReport(filePath, report) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

export function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const log = fs.readFileSync(args.log, 'utf8');
  let runtime = null;
  if (args.runtime && fs.existsSync(args.runtime)) {
    runtime = JSON.parse(fs.readFileSync(args.runtime, 'utf8'));
  }
  const report = buildProductionVerificationReport({
    expectedGitSha: args['expected-sha'],
    actualGitSha: args['actual-sha'] ?? '',
    exitCode: args['exit-code'],
    startedAt: args['started-at'],
    finishedAt: args['finished-at'],
    smokeTier: args['smoke-tier'] ?? 'targeted',
    source: args.source ?? 'external-watch',
    runnerId: args['runner-id'] ?? '',
    logPath: args.log,
    log,
    runtime,
  });
  writeProductionVerificationReport(args.report, report);
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  }
}
