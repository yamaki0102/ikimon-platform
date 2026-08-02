export const STATUS_PRIORITY = Object.freeze({ PASS: 0, FAIL: 1, BLOCKED: 2, UNSAFE: 3 });
const SHA40 = /^[0-9a-f]{40}$/;
const IDENTIFIER = /^[a-z][a-z0-9._-]{0,63}$/;
const ENV_NAME = /^[A-Z][A-Z0-9_]{1,95}$/;
const HEADER_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SENSITIVE = new Set(['authorization', 'cookie', 'proxy-authorization', 'x-api-key']);

export class DebugError extends Error {
  constructor(status, classification) {
    super(classification);
    this.name = 'DebugError';
    this.status = status;
    this.classification = classification;
  }
}

export function validateManifest(raw) {
  object(raw, 'manifest');
  keys(raw, ['schema','application','environment','source_sha','base_url','allowed_hosts','allow_insecure_localhost','timeout_ms','max_response_bytes','identity','secrets','header_profiles','probes','labels'], 'manifest');
  if (raw.schema !== 'ikimon.debug-run/v1') throw new Error('unsupported schema');
  if (!IDENTIFIER.test(raw.application ?? '')) throw new Error('invalid application');
  if (raw.environment !== 'staging') throw new DebugError('UNSAFE', 'environment_not_staging');
  if (!SHA40.test(raw.source_sha ?? '')) throw new Error('invalid source sha');
  if (!Array.isArray(raw.allowed_hosts) || raw.allowed_hosts.length < 1 || raw.allowed_hosts.length > 4) throw new Error('invalid allowed_hosts');
  const allowedHosts = raw.allowed_hosts.map(normalizeHost);
  if (new Set(allowedHosts).size !== allowedHosts.length) throw new Error('duplicate allowed host');
  const baseUrl = base(raw.base_url, allowedHosts, Boolean(raw.allow_insecure_localhost));
  const secrets = secretSpecs(raw.secrets ?? {});
  const profiles = headerProfiles(raw.header_profiles, secrets);
  const identity = identitySpec(raw.identity);
  const probes = probeSpecs(raw.probes, profiles, secrets);
  return Object.freeze({
    schema: raw.schema,
    application: raw.application,
    environment: raw.environment,
    source_sha: raw.source_sha,
    base_url: baseUrl,
    allowed_hosts: allowedHosts,
    allow_insecure_localhost: Boolean(raw.allow_insecure_localhost),
    timeout_ms: int(raw.timeout_ms ?? 10000, 500, 30000),
    max_response_bytes: int(raw.max_response_bytes ?? 1048576, 1024, 2097152),
    identity,
    secrets,
    header_profiles: profiles,
    probes,
    labels: labels(raw.labels ?? {}),
  });
}

export function resolveSecrets(specs, env) {
  const values = {};
  const missing = [];
  for (const [name, spec] of Object.entries(specs)) {
    const value = env[spec.env];
    if (value === undefined || value === '') {
      if (spec.required) missing.push(spec.env);
      continue;
    }
    if (typeof value !== 'string' || value.length > 8192 || /[\0\r\n]/.test(value)) throw new DebugError('UNSAFE', 'secret_value_invalid');
    values[name] = value;
  }
  return { values, missing: missing.sort() };
}

export function safePath(value) {
  const text = String(value ?? '');
  if (!text.startsWith('/') || text.startsWith('//') || text.includes('\\') || /[\r\n]/.test(text)) throw new DebugError('UNSAFE', 'unsafe_path');
  if (text.split('?')[0].split('/').some((part) => part === '.' || part === '..')) throw new DebugError('UNSAFE', 'path_traversal_forbidden');
  return text;
}

export function normalizeHost(value) {
  const text = String(value ?? '').toLowerCase();
  if (text === '::1') return text;
  if (text.includes('*') || text.length > 253 || !/^([a-z0-9-]+\.)*[a-z0-9-]+$/.test(text)) throw new Error('invalid host');
  return text;
}

export function normalizeHeader(value) {
  const text = String(value ?? '').toLowerCase();
  if (!HEADER_NAME.test(text)) throw new Error('invalid header');
  return text;
}

export function safeHeaderValue(value) {
  const text = String(value ?? '');
  if (text.length > 4096 || /[\0\r\n]/.test(text)) throw new DebugError('UNSAFE', 'header_injection_forbidden');
  return text;
}

export function maxStatus(a, b) {
  return STATUS_PRIORITY[b] > STATUS_PRIORITY[a] ? b : a;
}

function base(value, allowed, allowLocal) {
  let url;
  try { url = new URL(String(value)); } catch { throw new Error('invalid base_url'); }
  if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new DebugError('UNSAFE', 'base_url_contains_unsupported_parts');
  const name = normalizeHost(url.hostname);
  if (!allowed.includes(name)) throw new DebugError('UNSAFE', 'base_host_not_allowlisted');
  const local = ['localhost', '127.0.0.1', '::1'].includes(name);
  if (local) {
    if (!allowLocal || url.protocol !== 'http:') throw new DebugError('UNSAFE', 'localhost_not_explicitly_allowed');
  } else {
    if (url.protocol !== 'https:') throw new DebugError('UNSAFE', 'staging_requires_https');
    if (!name.includes('staging')) throw new DebugError('UNSAFE', 'host_not_staging_named');
  }
  return `${url.protocol}//${url.host}`;
}

function identitySpec(raw) {
  object(raw, 'identity');
  keys(raw, ['path','source_sha_header','deployment_id_header','schema_digest_header','per_response_source_sha_header'], 'identity');
  return Object.freeze({
    path: safePath(raw.path ?? '/'),
    source_sha_header: normalizeHeader(raw.source_sha_header),
    deployment_id_header: raw.deployment_id_header ? normalizeHeader(raw.deployment_id_header) : null,
    schema_digest_header: raw.schema_digest_header ? normalizeHeader(raw.schema_digest_header) : null,
    per_response_source_sha_header: raw.per_response_source_sha_header ? normalizeHeader(raw.per_response_source_sha_header) : null,
  });
}

function secretSpecs(raw) {
  object(raw, 'secrets');
  if (Object.keys(raw).length > 32) throw new Error('too many secrets');
  const out = {};
  for (const [name, spec] of Object.entries(raw)) {
    if (!IDENTIFIER.test(name)) throw new Error('invalid secret name');
    object(spec, `secret ${name}`); keys(spec, ['env','required'], `secret ${name}`);
    if (!ENV_NAME.test(spec.env ?? '')) throw new Error('invalid secret env');
    out[name] = Object.freeze({ env: spec.env, required: spec.required !== false });
  }
  return Object.freeze(out);
}

function headerProfiles(raw, secrets) {
  object(raw, 'header_profiles');
  if (!Object.hasOwn(raw, 'public')) throw new Error('public profile required');
  const out = {};
  for (const [profileName, profile] of Object.entries(raw)) {
    if (!IDENTIFIER.test(profileName)) throw new Error('invalid profile name');
    object(profile, `profile ${profileName}`); keys(profile, ['headers'], `profile ${profileName}`);
    const headers = {};
    for (const [rawName, spec] of Object.entries(profile.headers ?? {})) {
      const name = normalizeHeader(rawName);
      object(spec, `header ${name}`); keys(spec, ['literal','secret','prefix'], `header ${name}`);
      const literal = Object.hasOwn(spec, 'literal');
      const secret = Object.hasOwn(spec, 'secret');
      if (literal === secret) throw new Error('header requires literal or secret');
      if (literal) {
        if (SENSITIVE.has(name)) throw new DebugError('UNSAFE', 'sensitive_header_literal_forbidden');
        headers[name] = Object.freeze({ type: 'literal', value: safeHeaderValue(spec.literal) });
      } else {
        if (!Object.hasOwn(secrets, spec.secret)) throw new Error('unknown header secret');
        headers[name] = Object.freeze({ type: 'secret', secret: spec.secret, prefix: safeHeaderValue(spec.prefix ?? '') });
      }
    }
    if (profileName === 'public' && Object.values(headers).some((entry) => entry.type === 'secret')) throw new DebugError('UNSAFE', 'public_header_profile_cannot_use_secrets');
    out[profileName] = Object.freeze({ headers: Object.freeze(headers) });
  }
  return Object.freeze(out);
}

function probeSpecs(raw, profiles, secrets) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 32) throw new Error('invalid probes');
  const seen = new Set();
  return Object.freeze(raw.map((probe, index) => {
    object(probe, `probe ${index}`);
    keys(probe, ['id','audience','method','path','headers_profile','assertions'], `probe ${index}`);
    if (!IDENTIFIER.test(probe.id ?? '') || seen.has(probe.id)) throw new Error('invalid probe id');
    seen.add(probe.id);
    if (!['public','owner','sink'].includes(probe.audience)) throw new Error('invalid audience');
    const method = probe.method ?? 'GET';
    if (!['GET','HEAD'].includes(method)) throw new DebugError('UNSAFE', 'debug_probe_method_not_read_only');
    if (!Object.hasOwn(profiles, probe.headers_profile)) throw new Error('unknown profile');
    if (probe.audience === 'public' && probe.headers_profile !== 'public') throw new DebugError('UNSAFE', 'public_probe_requires_public_profile');
    if (!Array.isArray(probe.assertions) || probe.assertions.length < 1 || probe.assertions.length > 20) throw new Error('invalid assertions');
    const assertions = probe.assertions.map((assertion) => assertionSpec(assertion, secrets));
    return Object.freeze({ id: probe.id, audience: probe.audience, method, path: safePath(probe.path), headers_profile: probe.headers_profile, assertions: Object.freeze(assertions) });
  }));
}

function assertionSpec(raw, secrets) {
  object(raw, 'assertion');
  const type = raw.type;
  if (type === 'status') { keys(raw, ['type','equals'], 'assertion'); return Object.freeze({ type, equals: int(raw.equals, 100, 599) }); }
  if (['contains_secret','excludes_secret'].includes(type)) {
    keys(raw, ['type','secret'], 'assertion');
    if (!Object.hasOwn(secrets, raw.secret)) throw new Error('unknown assertion secret');
    return Object.freeze({ type, secret: raw.secret });
  }
  if (['contains_text','excludes_text'].includes(type)) { keys(raw, ['type','text'], 'assertion'); return Object.freeze({ type, text: text(raw.text, 1, 4096) }); }
  if (type === 'header_present') { keys(raw, ['type','header'], 'assertion'); return Object.freeze({ type, header: normalizeHeader(raw.header) }); }
  if (type === 'header_equals') { keys(raw, ['type','header','value'], 'assertion'); return Object.freeze({ type, header: normalizeHeader(raw.header), value: safeHeaderValue(raw.value) }); }
  throw new Error('unsupported assertion');
}

function labels(raw) {
  object(raw, 'labels');
  if (Object.keys(raw).length > 20) throw new Error('too many labels');
  const out = {};
  for (const [name, value] of Object.entries(raw)) {
    if (!IDENTIFIER.test(name)) throw new Error('invalid label');
    out[name] = text(value, 0, 256);
  }
  return Object.freeze(out);
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new Error(`${label} must be object`);
}
function keys(value, allowed, label) {
  const set = new Set(allowed);
  if (Object.keys(value).some((key) => !set.has(key))) throw new Error(`${label} contains unsupported key`);
}
function int(value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error('invalid integer');
  return value;
}
function text(value, min, max) {
  if (typeof value !== 'string' || value.length < min || value.length > max) throw new Error('invalid string');
  return value;
}
