import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

function loadClassifyPg(script: string): (text: string) => string[] {
  const match = script.match(/function classifyPg\(text\) \{[\s\S]*?\n\}/);
  const vectorMatch = script.match(/function hasPgVectorSignal\(text\) \{[\s\S]*?\n\}/);
  assert.ok(match, "classifyPg function is present");
  assert.ok(vectorMatch, "hasPgVectorSignal function is present");
  return new Function(`${vectorMatch[0]}; ${match[0]}; return classifyPg;`)() as (text: string) => string[];
}

function loadIsTestSourceFile(script: string): (relativeFile: string) => boolean {
  const match = script.match(/function isTestSourceFile\(relativeFile\) \{[\s\S]*?\n\}/);
  assert.ok(match, "isTestSourceFile function is present");
  return new Function(`${match[0]}; return isTestSourceFile;`)() as (relativeFile: string) => boolean;
}

function loadClassifyFallbackReason(script: string): (reason: string) => string {
  const match = script.match(/function classifyFallbackReason\(reason\) \{[\s\S]*?\n\}/);
  assert.ok(match, "classifyFallbackReason function is present");
  return new Function(`${match[0]}; return classifyFallbackReason;`)() as (reason: string) => string;
}

test("VPS stop readiness counts every runtime PostgreSQL dependency, not only displayed rows", async () => {
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");

  assert.match(script, /const PG_DEPENDENCY_TABLE_LIMIT = 80;/);
  assert.match(script, /const runtimePgFiles = pgFiles\.filter/);
  assert.match(script, /\.\.\.runtimePgFiles\.map\(\(item\) => \(\{/);
  assert.match(script, /PostgreSQL Test Source Dependencies/);
  assert.match(script, /runtimeImportedTestSourceFiles\.has\(item\.file\)/);
  assert.match(script, /runtime_imported_test_pg_dependency_files/);
  assert.match(script, /blocker_scope: runtime PostgreSQL\/vector\/PostGIS\/job-locking files/);
  assert.match(script, /displayed_pg_dependencies/);
  assert.doesNotMatch(script, /\.\.\.runtimePgFiles\.slice\(0,\s*80\)\.map\(\(item\) => \(\{/);
});

test("VPS stop readiness classifies test source paths conservatively", async () => {
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");
  const isTestSourceFile = loadIsTestSourceFile(script);

  assert.equal(isTestSourceFile("platform_v2/src/services/mapSnapshot.test.ts"), true);
  assert.equal(isTestSourceFile("platform_v2/src/scripts/applyMigrations.source.test.ts"), true);
  assert.equal(isTestSourceFile("platform_v2/src/routes/__tests__/guideApi.ts"), true);
  assert.equal(isTestSourceFile("platform_v2/tests/helpers/db-setup.ts"), true);
  assert.equal(isTestSourceFile("platform_v2/src/__mocks__/pg.ts"), true);

  assert.equal(isTestSourceFile("platform_v2/src/services/mapSnapshot.ts"), false);
  assert.equal(isTestSourceFile("platform_v2/src/services/latestObservations.ts"), false);
  assert.equal(isTestSourceFile("platform_v2/src/services/contestEntry.ts"), false);
});

test("public custom domain origin fallback is not registered twice", async () => {
  const workerSource = await readFile(path.join(process.cwd(), "src", "index.ts"), "utf8");
  const publicDomainFallbackCalls = workerSource.match(/fetchOriginFallback\([^)]*"public_custom_domain_path"/g) ?? [];

  assert.equal(publicDomainFallbackCalls.length, 1);
});

test("legacy observation event API fallback remains an explicit P0 dependency", async () => {
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");
  const classifyFallbackReason = loadClassifyFallbackReason(script);

  assert.equal(classifyFallbackReason("legacy_observation_event_api_origin_fallback"), "api_origin_fallback");
  assert.match(script, /inactive_public_custom_domain_origin_fallback_disabled/);
});

test("production origin session probe is dormant when import mode is disabled", async () => {
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");

  assert.match(script, /const originSessionImportMode = String\(productionVars\.ORIGIN_SESSION_IMPORT_MODE \?\? "enabled"\)/);
  assert.match(script, /item\.reason === "origin_session_probe" && originSessionImportMode === "disabled"/);
  assert.match(script, /inactive_origin_session_import_disabled/);
  assert.match(script, /ORIGIN_SESSION_IMPORT_MODE/);
});

test("PostgreSQL signal classifier does not count JavaScript listener or Array helpers", async () => {
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");
  const classifyPg = loadClassifyPg(script);

  assert.equal(classifyPg("window.addEventListener('click', () => {});").includes("job_locking"), false);
  assert.equal(classifyPg("const server = app.listen(3000);").includes("job_locking"), false);
  assert.equal(classifyPg("notify('saved');").includes("job_locking"), false);
  assert.equal(classifyPg("const list = Array(10);").includes("pg_types"), false);
  assert.equal(classifyPg("const ok = Array.isArray(value);").includes("pg_types"), false);
  assert.equal(classifyPg("type Items = Array<string>;").includes("pg_types"), false);
  assert.equal(classifyPg("export function normalizeEmbeddingVector(vector: number[]) { return vector; }").includes("vector"), false);
  assert.equal(classifyPg("const results = await env.VECTOR_INDEX.query(vector, { topK: 3 });").includes("vector"), false);
  assert.equal(classifyPg("await openai.embeddings.create({ model: 'text-embedding-3-small', input });").includes("vector"), false);

  assert.equal(classifyPg("await client.query('LISTEN observation_events');").includes("job_locking"), true);
  assert.equal(classifyPg("await client.query('notify observation_events');").includes("job_locking"), true);
  assert.equal(classifyPg("SELECT * FROM jobs FOR UPDATE SKIP LOCKED").includes("job_locking"), true);
  assert.equal(classifyPg("SELECT array[1, 2, 3] AS ids").includes("pg_types"), true);
  assert.equal(classifyPg("SELECT ARRAY(SELECT id FROM users)").includes("pg_types"), true);
  assert.equal(classifyPg("SELECT unnest(tags)").includes("pg_types"), true);
  assert.equal(classifyPg("SELECT embedding <=> $1::vector FROM audio_embeddings").includes("vector"), true);
  assert.equal(classifyPg("SELECT * FROM items ORDER BY embedding <-> $1 LIMIT 5").includes("vector"), true);
  assert.equal(classifyPg("SELECT * FROM items ORDER BY embedding <#> $1 LIMIT 5").includes("vector"), true);
  assert.equal(classifyPg("SELECT * FROM items ORDER BY embedding <+> $1 LIMIT 5").includes("vector"), true);
  assert.equal(classifyPg("CREATE EXTENSION IF NOT EXISTS vector;").includes("vector"), true);
  assert.equal(classifyPg("CREATE INDEX ON items USING hnsw (embedding vector_cosine_ops)").includes("vector"), true);
  assert.equal(classifyPg("SELECT CAST(my_array AS vector)").includes("vector"), true);
  assert.equal(classifyPg("CREATE INDEX ON cards USING ivfflat (retrieval_embedding vector_cosine_ops)").includes("vector"), true);

  assert.match(script, /PostgreSQL Signal Noise Suppression/);
  assert.match(script, /js_noise_suppressed_files/);
  assert.match(script, /non_pg_embedding_or_vector_text/);
  assert.doesNotMatch(script, /LISTEN\|NOTIFY\|SKIP LOCKED\|FOR UPDATE\/i/);
  assert.doesNotMatch(script, /\\bARRAY\\b\|unnest\\\(\//);
});
