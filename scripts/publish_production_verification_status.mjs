#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const args = { dryRun: false, alwaysPublish: false };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (key === '--always-publish') {
      args.alwaysPublish = true;
      continue;
    }
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    args[key.slice(2)] = value;
    index += 1;
  }
  return args;
}

function truncate(value, max) {
  const text = String(value ?? '');
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
}

export function buildCommitStatusPayload({
  report,
  fallbackState = 'error',
  fallbackDescription = 'Production verification report is unavailable',
  context = 'ikimon/production-verification',
  targetUrl = '',
}) {
  const reportStatus = report?.status;
  const state = reportStatus === 'success'
    ? 'success'
    : reportStatus === 'failure'
      ? 'failure'
      : fallbackState;
  if (!['error', 'failure', 'pending', 'success'].includes(state)) {
    throw new Error(`Unsupported commit status state: ${state}`);
  }
  const checkCount = Array.isArray(report?.checks) ? report.checks.length : 0;
  const endpointCount = Array.isArray(report?.endpoints) ? report.endpoints.length : 0;
  const description = report
    ? state === 'success'
      ? `Production verification passed (${report.smokeTier ?? 'unknown'}, ${checkCount} phases, ${endpointCount} endpoints)`
      : `Production verification failed (${report.smokeTier ?? 'unknown'}, exit ${report.exitCode ?? 'unknown'})`
    : fallbackDescription;
  return {
    state,
    context,
    description: truncate(description, 140),
    ...(targetUrl ? { target_url: targetUrl } : {}),
  };
}

export function readReport(reportPath) {
  if (!reportPath || !fs.existsSync(reportPath)) return null;
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  if (report.schemaVersion !== 'ikimon_production_verification/v1') {
    throw new Error(`Unsupported verification report schema: ${report.schemaVersion}`);
  }
  return report;
}

export async function publishCommitStatus({
  repository,
  sha,
  token,
  payload,
  apiUrl = 'https://api.github.com',
  fetchImpl = fetch,
  skipUnchanged = false,
}) {
  if (!/^[^/]+\/[^/]+$/.test(repository ?? '')) throw new Error('repository must be owner/name');
  if (!/^[0-9a-f]{40}$/i.test(sha ?? '')) throw new Error('sha must be a 40-character commit SHA');
  if (!token) throw new Error('GITHUB_TOKEN or GH_TOKEN is required');
  const normalizedApiUrl = apiUrl.replace(/\/$/, '');
  if (skipUnchanged) {
    const existingResponse = await fetchImpl(`${normalizedApiUrl}/repos/${repository}/commits/${sha}/statuses?per_page=100`, {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
      },
    });
    const existingBody = await existingResponse.text();
    if (!existingResponse.ok) {
      throw new Error(`GitHub commit status lookup failed: ${existingResponse.status} ${existingBody.slice(0, 500)}`);
    }
    const existing = existingBody ? JSON.parse(existingBody) : [];
    const current = Array.isArray(existing) ? existing.find((item) => item.context === payload.context) : null;
    if (current && current.state === payload.state && current.description === payload.description && (current.target_url ?? '') === (payload.target_url ?? '')) {
      return { skipped: true, id: current.id ?? null };
    }
  }
  const response = await fetchImpl(`${normalizedApiUrl}/repos/${repository}/statuses/${sha}`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`GitHub commit status publish failed: ${response.status} ${body.slice(0, 500)}`);
  }
  return body ? JSON.parse(body) : {};
}

export async function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const report = readReport(args.report);
  const repository = args.repository ?? process.env.GITHUB_REPOSITORY ?? '';
  const sha = args.sha ?? report?.expectedGitSha ?? process.env.GITHUB_SHA ?? '';
  const targetUrl = args['target-url']
    ?? process.env.IKIMON_STATUS_TARGET_URL
    ?? (process.env.GITHUB_SERVER_URL && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : '');
  const payload = buildCommitStatusPayload({
    report,
    fallbackState: args['fallback-state'] ?? 'error',
    fallbackDescription: args['fallback-description'] ?? 'Production verification report is unavailable',
    context: args.context ?? 'ikimon/production-verification',
    targetUrl,
  });
  if (args.dryRun) {
    process.stdout.write(`${JSON.stringify({ repository, sha, payload }, null, 2)}\n`);
    return;
  }
  const result = await publishCommitStatus({
    repository,
    sha,
    token: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '',
    payload,
    apiUrl: process.env.GITHUB_API_URL ?? 'https://api.github.com',
    skipUnchanged: !args.alwaysPublish,
  });
  process.stdout.write(`${JSON.stringify({ repository, sha, payload, id: result.id ?? null, skipped: result.skipped === true }, null, 2)}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
