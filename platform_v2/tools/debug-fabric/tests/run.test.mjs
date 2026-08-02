import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { writeEvidence } from '../lib/evidence.mjs';
import { runDebugFabric } from '../run.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const OTHER_SHA = '89abcdef0123456789abcdef0123456789abcdef';
const ENV = {
  ZUKAN_DEBUG_OWNER_COOKIE: 'session=owner-test',
  ZUKAN_DEBUG_PRIVATE_MARKER: 'private-marker-123',
  ZUKAN_DEBUG_PRIVATE_OBSERVATION_ID: 'obs-private-123',
  ZUKAN_DEBUG_PRIVATE_LATITUDE_EXACT: '34.712345',
  ZUKAN_DEBUG_PRIVATE_LONGITUDE_EXACT: '137.712345'
};

async function fixture(t, {
  leak = false,
  responseSha = SHA,
  switchEnd = false,
  omitDeploymentId = false,
  omitSchemaDigest = false,
} = {}) {
  let identityCalls = 0;
  const server = createServer((req, res) => {
    const headers = {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-ikimon-deploy-sha': req.url === '/identity' && switchEnd && ++identityCalls > 1 ? OTHER_SHA : responseSha,
    };
    if (!omitDeploymentId) headers['x-ikimon-worker-version'] = 'test-version-1';
    if (!omitSchemaDigest) headers['x-ikimon-schema-digest'] = 'schema-test-1';
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
    if (req.url === '/identity') return res.end('identity');
    if (req.url === '/owner') return res.end(`${ENV.ZUKAN_DEBUG_PRIVATE_MARKER} ${ENV.ZUKAN_DEBUG_PRIVATE_OBSERVATION_ID}`);
    if (req.url === '/public/map' && leak) return res.end(ENV.ZUKAN_DEBUG_PRIVATE_MARKER);
    if (req.url === '/large') return res.end('x'.repeat(10000));
    res.end('public-safe');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

function manifest(baseUrl, overrides = {}) {
  return {
    schema: 'ikimon.debug-run/v1',
    application: 'zukan',
    environment: 'staging',
    source_sha: SHA,
    base_url: baseUrl,
    allowed_hosts: ['127.0.0.1'],
    allow_insecure_localhost: true,
    timeout_ms: 2000,
    max_response_bytes: 4096,
    identity: {
      path: '/identity',
      source_sha_header: 'x-ikimon-deploy-sha',
      deployment_id_header: 'x-ikimon-worker-version',
      schema_digest_header: 'x-ikimon-schema-digest',
      per_response_source_sha_header: 'x-ikimon-deploy-sha'
    },
    secrets: {
      owner_cookie: { env: 'ZUKAN_DEBUG_OWNER_COOKIE', required: true },
      private_marker: { env: 'ZUKAN_DEBUG_PRIVATE_MARKER', required: true },
      private_observation_id: { env: 'ZUKAN_DEBUG_PRIVATE_OBSERVATION_ID', required: true },
      private_latitude_exact: { env: 'ZUKAN_DEBUG_PRIVATE_LATITUDE_EXACT', required: true },
      private_longitude_exact: { env: 'ZUKAN_DEBUG_PRIVATE_LONGITUDE_EXACT', required: true }
    },
    header_profiles: {
      public: { headers: {} },
      owner: { headers: { cookie: { secret: 'owner_cookie' } } }
    },
    probes: [
      {
        id: 'owner-visible', audience: 'owner', method: 'GET', path: '/owner', headers_profile: 'owner',
        assertions: [
          { type: 'status', equals: 200 },
          { type: 'contains_secret', secret: 'private_marker' },
          { type: 'contains_secret', secret: 'private_observation_id' }
        ]
      },
      ...['home', 'records', 'map'].map((surface) => ({
        id: `public-${surface}-hidden`, audience: 'public', method: 'GET', path: `/public/${surface}`, headers_profile: 'public',
        assertions: [
          { type: 'status', equals: 200 },
          { type: 'excludes_secret', secret: 'private_marker' },
          { type: 'excludes_secret', secret: 'private_observation_id' },
          { type: 'excludes_secret', secret: 'private_latitude_exact' },
          { type: 'excludes_secret', secret: 'private_longitude_exact' },
          { type: 'header_equals', header: 'cache-control', value: 'no-store' }
        ]
      }))
    ],
    labels: { pack: 'private-boundary' },
    ...overrides
  };
}

async function outDir(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'debug-fabric-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('green proof passes and evidence contains no secret values', async (t) => {
  const baseUrl = await fixture(t);
  const outcome = await runDebugFabric(manifest(baseUrl), { env: ENV, outDir: await outDir(t), runId: 'green' });
  assert.equal(outcome.result.status, 'PASS');
  assert.equal(outcome.result.probes.length, 4);
  const evidence = await Promise.all(Object.values(outcome.paths).map((file) => readFile(file, 'utf8')));
  for (const value of Object.values(ENV)) assert.ok(evidence.every((text) => !text.includes(value)));
});

test('red proof fails when the public map leaks the private marker', async (t) => {
  const baseUrl = await fixture(t, { leak: true });
  const outcome = await runDebugFabric(manifest(baseUrl), { env: ENV, outDir: await outDir(t), runId: 'red' });
  assert.equal(outcome.result.status, 'FAIL');
  assert.ok(outcome.result.probes.find((probe) => probe.id === 'public-map-hidden').failed_assertion_codes.includes('forbidden_secret_found'));
});

test('missing required secrets are BLOCKED before probes run', async (t) => {
  const baseUrl = await fixture(t);
  const outcome = await runDebugFabric(manifest(baseUrl), { env: {}, outDir: await outDir(t), runId: 'missing' });
  assert.equal(outcome.result.status, 'BLOCKED');
  assert.equal(outcome.result.classification, 'required_secret_env_missing');
  assert.equal(outcome.result.probes.length, 0);
});

test('an unresolved optional header secret is BLOCKED instead of sending undefined', async (t) => {
  const baseUrl = await fixture(t);
  const raw = manifest(baseUrl);
  raw.secrets.owner_cookie.required = false;
  const env = { ...ENV };
  delete env.ZUKAN_DEBUG_OWNER_COOKIE;
  const outcome = await runDebugFabric(raw, { env, outDir: await outDir(t), runId: 'optional-header' });
  assert.equal(outcome.result.status, 'BLOCKED');
  assert.equal(outcome.result.classification, 'header_secret_unresolved');
});

test('an unresolved optional assertion secret is BLOCKED instead of matching the word undefined', async (t) => {
  const baseUrl = await fixture(t);
  const raw = manifest(baseUrl);
  raw.secrets.private_marker.required = false;
  raw.probes[0].assertions = [{ type: 'status', equals: 200 }];
  const env = { ...ENV };
  delete env.ZUKAN_DEBUG_PRIVATE_MARKER;
  const outcome = await runDebugFabric(raw, { env, outDir: await outDir(t), runId: 'optional-assertion' });
  assert.equal(outcome.result.status, 'BLOCKED');
  assert.equal(outcome.result.classification, 'assertion_secret_unresolved');
});

test('configured deployment and schema identity headers must be present', async (t) => {
  const missingDeployment = await fixture(t, { omitDeploymentId: true });
  const first = await runDebugFabric(manifest(missingDeployment), { env: ENV, outDir: await outDir(t), runId: 'missing-deployment' });
  assert.equal(first.result.status, 'BLOCKED');
  assert.equal(first.result.classification, 'deployment_id_missing');

  const missingSchema = await fixture(t, { omitSchemaDigest: true });
  const second = await runDebugFabric(manifest(missingSchema), { env: ENV, outDir: await outDir(t), runId: 'missing-schema' });
  assert.equal(second.result.status, 'BLOCKED');
  assert.equal(second.result.classification, 'schema_digest_missing');
});

test('a production-looking host is UNSAFE before network access', async (t) => {
  let called = false;
  const raw = manifest('https://zukan.earth', { allowed_hosts: ['zukan.earth'], allow_insecure_localhost: false });
  const outcome = await runDebugFabric(raw, {
    env: ENV,
    outDir: await outDir(t),
    runId: 'unsafe-host',
    fetchImpl: async () => { called = true; throw new Error('must not run'); }
  });
  assert.equal(outcome.result.status, 'UNSAFE');
  assert.equal(outcome.result.classification, 'host_not_staging_named');
  assert.equal(called, false);
});

test('substring-only staging names and nonstandard staging ports are rejected', async (t) => {
  let called = false;
  for (const baseUrl of ['https://evilstaging.example.com', 'https://service-staging.example.com:8443']) {
    const host = new URL(baseUrl).hostname;
    const outcome = await runDebugFabric(manifest(baseUrl, {
      allowed_hosts: [host],
      allow_insecure_localhost: false,
    }), {
      env: ENV,
      outDir: await outDir(t),
      runId: `unsafe-${host.replaceAll('.', '-')}`,
      fetchImpl: async () => { called = true; throw new Error('must not run'); }
    });
    assert.equal(outcome.result.status, 'UNSAFE');
  }
  assert.equal(called, false);
});

test('per-response runtime SHA mismatch is BLOCKED', async (t) => {
  const baseUrl = await fixture(t, { responseSha: OTHER_SHA });
  const raw = manifest(baseUrl, { source_sha: OTHER_SHA });
  raw.probes[0].assertions = [{ type: 'status', equals: 200 }];
  const outcome = await runDebugFabric(raw, { env: ENV, outDir: await outDir(t), runId: 'sha' });
  assert.equal(outcome.result.status, 'PASS');
  raw.source_sha = SHA;
  const blocked = await runDebugFabric(raw, { env: ENV, outDir: await outDir(t), runId: 'sha-blocked' });
  assert.equal(blocked.result.status, 'BLOCKED');
  assert.equal(blocked.result.classification, 'source_sha_mismatch_at_start');
});

test('runtime identity drift between start and end is BLOCKED', async (t) => {
  const baseUrl = await fixture(t, { switchEnd: true });
  const outcome = await runDebugFabric(manifest(baseUrl), { env: ENV, outDir: await outDir(t), runId: 'drift' });
  assert.equal(outcome.result.status, 'BLOCKED');
  assert.equal(outcome.result.classification, 'source_sha_mismatch_at_end');
});

test('write methods are UNSAFE', async (t) => {
  const baseUrl = await fixture(t);
  const raw = manifest(baseUrl);
  raw.probes[0].method = 'POST';
  const outcome = await runDebugFabric(raw, { env: ENV, outDir: await outDir(t), runId: 'post' });
  assert.equal(outcome.result.status, 'UNSAFE');
  assert.equal(outcome.result.classification, 'debug_probe_method_not_read_only');
});

test('oversized bodies are UNSAFE and not retained', async (t) => {
  const baseUrl = await fixture(t);
  const raw = manifest(baseUrl, { max_response_bytes: 1024 });
  raw.probes = [{ id: 'large', audience: 'public', method: 'GET', path: '/large', headers_profile: 'public', assertions: [{ type: 'status', equals: 200 }] }];
  const outcome = await runDebugFabric(raw, { env: ENV, outDir: await outDir(t), runId: 'large' });
  assert.equal(outcome.result.status, 'UNSAFE');
  assert.ok(['response_body_too_large', 'response_body_declared_too_large'].includes(outcome.result.classification));
});

test('evidence secret detection changes the returned status and capsule', async (t) => {
  const dir = await outDir(t);
  const result = {
    schema: 'ikimon.debug-result/v1',
    run_id: 'evidence-secret-test',
    source_sha: SHA,
    manifest_sha256: 'b'.repeat(64),
    status: 'PASS',
    classification: 'contains-TOPSECRET-value',
    identity_start: null,
    identity_end: null,
    probes: [],
    duration_ms: 1,
  };
  const evidence = await writeEvidence(dir, result, { marker: 'TOPSECRET' });
  assert.equal(evidence.result.status, 'UNSAFE');
  assert.equal(evidence.result.classification, 'evidence_secret_leak_marker');
  const capsule = JSON.parse(await readFile(evidence.paths.capsule, 'utf8'));
  assert.equal(capsule.status, 'UNSAFE');
});

test('evidence files are immutable and cannot be overwritten by reusing an output directory', async (t) => {
  const dir = await outDir(t);
  const result = {
    schema: 'ikimon.debug-result/v1',
    run_id: 'immutable-evidence-test',
    source_sha: SHA,
    manifest_sha256: 'c'.repeat(64),
    status: 'PASS',
    classification: 'all_assertions_passed',
    identity_start: null,
    identity_end: null,
    probes: [],
    duration_ms: 1,
  };
  await writeEvidence(dir, result, {});
  await assert.rejects(writeEvidence(dir, result, {}), (error) => error?.code === 'EEXIST');
});
