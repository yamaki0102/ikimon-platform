#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { DebugError, maxStatus, resolveSecrets, validateManifest } from './lib/contract.mjs';
import { stableStringify, sha256, writeEvidence } from './lib/evidence.mjs';
import { request } from './lib/http.mjs';

const EXIT = Object.freeze({ PASS: 0, FAIL: 10, BLOCKED: 20, UNSAFE: 30 });

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

export async function runDebugFabric(rawManifest, options = {}) {
  const started = new Date();
  const runId = options.runId ?? `debug-${started.toISOString().replace(/[-:.TZ]/g, '').slice(0,14)}-${randomBytes(5).toString('hex')}`;
  const outDir = path.resolve(options.outDir ?? path.join(process.cwd(), '.debug-fabric', runId));
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const result = baseResult(runId, started);
  let secrets = {};

  try {
    const manifest = validateManifest(rawManifest);
    result.application = manifest.application;
    result.environment = manifest.environment;
    result.source_sha = manifest.source_sha;
    result.manifest_sha256 = sha256(stableStringify(rawManifest));
    const resolved = resolveSecrets(manifest.secrets, options.env ?? process.env);
    secrets = resolved.values;
    if (resolved.missing.length) {
      result.missing_env_names = resolved.missing;
      throw new DebugError('BLOCKED', 'required_secret_env_missing');
    }

    const start = await identity(manifest, secrets, fetchImpl);
    result.identity_start = start;
    expected(manifest, start, 'start');

    for (const probe of manifest.probes) {
      const probeResult = await executeProbe(manifest, probe, secrets, fetchImpl);
      result.probes.push(probeResult);
      result.status = maxStatus(result.status, probeResult.status);
      if (['BLOCKED','UNSAFE'].includes(probeResult.status)) {
        result.classification = probeResult.classification;
        break;
      }
    }

    if (!['BLOCKED','UNSAFE'].includes(result.status)) {
      const end = await identity(manifest, secrets, fetchImpl);
      result.identity_end = end;
      expected(manifest, end, 'end');
      if (JSON.stringify(start) !== JSON.stringify(end)) throw new DebugError('BLOCKED', 'runtime_identity_changed_during_run');
      result.classification = result.status === 'PASS' ? 'all_assertions_passed' : 'assertion_failed';
    }
  } catch (error) {
    if (error instanceof DebugError) {
      result.status = maxStatus(result.status, error.status);
      result.classification = error.classification;
    } else {
      result.status = 'BLOCKED';
      result.classification = 'runner_internal_error';
    }
  }

  const finished = new Date();
  result.finished_at = finished.toISOString();
  result.duration_ms = Math.max(0, finished.getTime() - started.getTime());
  const evidence = await writeEvidence(outDir, result, secrets);
  return { result: evidence.result, paths: evidence.paths };
}

async function identity(manifest, secrets, fetchImpl) {
  const response = await request(manifest, { method: 'GET', path: manifest.identity.path, headers_profile: 'public' }, secrets, fetchImpl);
  const deploymentId = manifest.identity.deployment_id_header
    ? response.headers[manifest.identity.deployment_id_header] ?? null
    : null;
  const schemaDigest = manifest.identity.schema_digest_header
    ? response.headers[manifest.identity.schema_digest_header] ?? null
    : null;
  if (manifest.identity.deployment_id_header && !deploymentId) throw new DebugError('BLOCKED', 'deployment_id_missing');
  if (manifest.identity.schema_digest_header && !schemaDigest) throw new DebugError('BLOCKED', 'schema_digest_missing');
  return {
    source_sha: response.headers[manifest.identity.source_sha_header] ?? null,
    deployment_id: deploymentId,
    schema_digest: schemaDigest,
  };
}

function expected(manifest, value, phase) {
  if (value.source_sha !== manifest.source_sha) throw new DebugError('BLOCKED', `source_sha_mismatch_at_${phase}`);
}

async function executeProbe(manifest, probe, secrets, fetchImpl) {
  try {
    const response = await request(manifest, probe, secrets, fetchImpl);
    const shaHeader = manifest.identity.per_response_source_sha_header;
    if (shaHeader && response.headers[shaHeader] !== manifest.source_sha) throw new DebugError('BLOCKED', 'source_sha_mismatch_in_probe_response');
    const failed = probe.assertions.map((assertion) => evaluate(assertion, response, secrets)).filter((entry) => !entry.pass).map((entry) => entry.code);
    return {
      id: probe.id,
      status: failed.length ? 'FAIL' : 'PASS',
      classification: failed.length ? 'assertion_failed' : 'probe_passed',
      http_status: response.status,
      response_bytes: response.bodyBytes,
      response_sha256: response.bodySha256,
      duration_ms: response.durationMs,
      failed_assertion_codes: failed,
    };
  } catch (error) {
    if (error instanceof DebugError) return { id: probe.id, status: error.status, classification: error.classification, failed_assertion_codes: [] };
    return { id: probe.id, status: 'BLOCKED', classification: 'probe_internal_error', failed_assertion_codes: [] };
  }
}

function evaluate(assertion, response, secrets) {
  switch (assertion.type) {
    case 'status': return { pass: response.status === assertion.equals, code: 'status_mismatch' };
    case 'contains_secret': return { pass: response.bodyText.includes(resolvedSecret(secrets, assertion.secret)), code: 'required_secret_missing' };
    case 'excludes_secret': return { pass: !response.bodyText.includes(resolvedSecret(secrets, assertion.secret)), code: 'forbidden_secret_found' };
    case 'contains_text': return { pass: response.bodyText.includes(assertion.text), code: 'required_text_missing' };
    case 'excludes_text': return { pass: !response.bodyText.includes(assertion.text), code: 'forbidden_text_found' };
    case 'header_present': return { pass: Object.hasOwn(response.headers, assertion.header), code: 'required_header_missing' };
    case 'header_equals': return { pass: response.headers[assertion.header] === assertion.value, code: 'header_value_mismatch' };
    default: return { pass: false, code: 'unsupported_assertion' };
  }
}

function resolvedSecret(secrets, name) {
  if (!Object.hasOwn(secrets, name)) throw new DebugError('BLOCKED', 'assertion_secret_unresolved');
  return secrets[name];
}

function baseResult(runId, started) {
  return {
    schema: 'ikimon.debug-result/v1', run_id: runId, application: null, environment: null,
    source_sha: null, manifest_sha256: null, status: 'PASS', classification: 'not_started',
    started_at: started.toISOString(), finished_at: null, duration_ms: 0,
    identity_start: null, identity_end: null, probes: [],
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.manifest) {
    console.log('Usage: node platform_v2/tools/debug-fabric/run.mjs --manifest <file> [--out <dir>]');
    process.exitCode = args.help ? 0 : 2;
    return;
  }
  try {
    const raw = JSON.parse(await readFile(path.resolve(args.manifest), 'utf8'));
    const outcome = await runDebugFabric(raw, { outDir: args.out });
    console.log(`status=${outcome.result.status}`);
    console.log(`classification=${outcome.result.classification}`);
    console.log(`run_id=${outcome.result.run_id}`);
    console.log(`report=${outcome.paths.report}`);
    process.exitCode = EXIT[outcome.result.status] ?? 2;
  } catch {
    console.error('ERROR: invalid debug-run invocation');
    process.exitCode = 2;
  }
}

function parseArgs(argv) {
  const out = { manifest: null, out: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--manifest') out.manifest = argv[++i] ?? null;
    else if (argv[i] === '--out') out.out = argv[++i] ?? null;
    else if (argv[i] === '--help' || argv[i] === '-h') out.help = true;
    else throw new Error('unsupported CLI argument');
  }
  return out;
}
