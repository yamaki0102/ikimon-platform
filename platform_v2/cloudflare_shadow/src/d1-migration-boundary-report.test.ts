import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("VPS stop readiness counts every PostgreSQL dependency, not only displayed rows", async () => {
  const script = await readFile(path.join(process.cwd(), "scripts", "d1-migration-boundary-report.mjs"), "utf8");

  assert.match(script, /const PG_DEPENDENCY_TABLE_LIMIT = 80;/);
  assert.match(script, /\.\.\.pgFiles\.map\(\(item\) => \(\{/);
  assert.match(script, /displayed_pg_dependencies/);
  assert.doesNotMatch(script, /\.\.\.pgFiles\.slice\(0,\s*80\)\.map\(\(item\) => \(\{/);
});

test("public custom domain origin fallback is not registered twice", async () => {
  const workerSource = await readFile(path.join(process.cwd(), "src", "index.ts"), "utf8");
  const publicDomainFallbackCalls = workerSource.match(/fetchOriginFallback\([^)]*"public_custom_domain_path"/g) ?? [];

  assert.equal(publicDomainFallbackCalls.length, 1);
});
