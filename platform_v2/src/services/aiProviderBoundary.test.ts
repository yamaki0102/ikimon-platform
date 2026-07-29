import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const adjacentSourceRoot = path.resolve(moduleDirectory, "..");
const sourceRoot = existsSync(path.join(adjacentSourceRoot, "services", "aiModelRouter.ts"))
  ? adjacentSourceRoot
  : path.resolve(moduleDirectory, "../../src");
const googleModule = ["@", "google/genai"].join("");
const reviewedProviderImports = new Set(["services/providers/googleGenAiOperations.ts"]);
const legacyScriptImports: Record<string, { owner: string; removeBy: string; reason: string }> = {
  "scripts/draftRegionalKnowledgeHooks.ts": {
    owner: "knowledge-ingest", removeBy: "2026-09-30", reason: "standalone reviewed draft CLI",
  },
  "scripts/embedRegionalKnowledgeCards.ts": {
    owner: "knowledge-ingest", removeBy: "2026-09-30", reason: "standalone embedding migration CLI",
  },
};
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return files(absolute);
    return entry.isFile() && entry.name.endsWith(".ts") ? [absolute] : [];
  });
}
function hasImport(source: string, moduleName: string): boolean {
  return [`"${moduleName}"`, `'${moduleName}'`].some((literal) =>
    source.includes(`from ${literal}`)
    || source.includes(`import ${literal}`)
    || source.includes(`import(${literal})`)
    || source.includes(`require(${literal})`));
}

test("raw Google SDK imports are limited to one provider implementation and bounded scripts", () => {
  const imports = files(sourceRoot)
    .filter((file) => hasImport(readFileSync(file, "utf8"), googleModule))
    .map((file) => path.relative(sourceRoot, file).split(path.sep).join("/"))
    .sort();
  assert.deepEqual(imports, [...reviewedProviderImports, ...Object.keys(legacyScriptImports)].sort());
  for (const runtime of [
    "services/aiModelRouter.ts", "services/aiModelRouterV2.ts",
    "services/curatorGeminiWorker.ts", "services/curatorGeminiWorkerV2.ts",
    "services/guideLiveToken.ts", "services/guideLiveTokenV2.ts",
    "services/guideTts.ts", "services/guideTtsV2.ts",
  ]) assert.equal(imports.includes(runtime), false, runtime);
});

test("runtime provider operations pass the mandatory metering boundary", () => {
  for (const file of [
    "services/aiModelRouterV2.ts",
    "services/curatorGeminiWorkerV2.ts",
    "services/guideLiveTokenV2.ts",
    "services/guideTtsV2.ts",
  ]) {
    const source = readFileSync(path.join(sourceRoot, file), "utf8");
    assert.match(source, /executeMeteredAiOperation/u, file);
  }
  const runtime = readFileSync(path.join(sourceRoot, "services/aiUsageRuntime.ts"), "utf8");
  assert.match(runtime, /AI_USAGE_V2_ENABLED/u);
  assert.match(runtime, /AiUsagePostgresRepository/u);
});

test("legacy script imports have an owner reason and unexpired removal date", () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const [file, debt] of Object.entries(legacyScriptImports)) {
    assert.ok(debt.owner.trim(), `${file}:owner`);
    assert.ok(debt.reason.trim(), `${file}:reason`);
    assert.match(debt.removeBy, /^\d{4}-\d{2}-\d{2}$/u, `${file}:removeBy`);
    assert.ok(debt.removeBy >= today, `${file}:provider debt expired on ${debt.removeBy}`);
  }
});
