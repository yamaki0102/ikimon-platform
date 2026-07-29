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
const deepseekEndpoint = "https://api.deepseek.com/chat/completions";
const reviewedProviderImports = new Set(["services/providers/googleGenAiOperations.ts"]);
const legacyScriptImports: Record<string, { owner: string; removeBy: string; reason: string }> = {
  "scripts/draftRegionalKnowledgeHooks.ts": {
    owner: "knowledge-ingest", removeBy: "2026-09-30", reason: "standalone reviewed draft CLI",
  },
  "scripts/embedRegionalKnowledgeCards.ts": {
    owner: "knowledge-ingest", removeBy: "2026-09-30", reason: "standalone embedding migration CLI",
  },
};
const meteredDeepseekEndpoints = new Set([
  "services/aiModelRouterV2.ts",
  "services/curatorGeminiWorkerV2.ts",
  "services/llmClients/deepseekFlashClient.ts",
]);
const legacyDeepseekEndpoints: Record<string, { owner: string; removeBy: string; reason: string; blockedFeature: string }> = {
  "services/profileNoteDigest.ts": {
    owner: "profile-notebook",
    removeBy: "2026-08-05",
    reason: "legacy monthly-budget path; excluded from AI_USAGE_V2_FEATURES until migrated",
    blockedFeature: "profile_note_digest",
  },
};

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return files(absolute);
    return entry.isFile() && entry.name.endsWith(".ts") ? [absolute] : [];
  });
}
function relative(file: string): string {
  return path.relative(sourceRoot, file).split(path.sep).join("/");
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
    .map(relative)
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
    "services/llmClients/deepseekFlashClient.ts",
  ]) {
    const source = readFileSync(path.join(sourceRoot, file), "utf8");
    assert.match(source, /executeMeteredAiOperation/u, file);
  }
  const runtime = readFileSync(path.join(sourceRoot, "services/aiUsageRuntime.ts"), "utf8");
  assert.match(runtime, /AI_USAGE_V2_ENABLED/u);
  assert.match(runtime, /AI_USAGE_V2_FEATURES/u);
  assert.match(runtime, /AiUsagePostgresRepository/u);
});

test("direct DeepSeek endpoints are metered or explicitly blocked from activation", () => {
  const endpoints = files(sourceRoot)
    .filter((file) => readFileSync(file, "utf8").includes(deepseekEndpoint))
    .map(relative)
    .sort();
  assert.deepEqual(endpoints, [
    ...meteredDeepseekEndpoints,
    ...Object.keys(legacyDeepseekEndpoints),
  ].sort());
  const plan = readFileSync(
    path.resolve(sourceRoot, "../../docs/architecture/zukan_ai_usage_v2_consolidated_plan_2026-07-29.md"),
    "utf8",
  );
  for (const [file, debt] of Object.entries(legacyDeepseekEndpoints)) {
    assert.match(plan, new RegExp(debt.blockedFeature, "u"), `${file}:blockedFeature`);
    assert.match(plan, /excluded from the first allowlist/u, `${file}:allowlist exclusion`);
  }
});

test("provider debt has an owner reason and unexpired removal date", () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const [file, debt] of Object.entries({ ...legacyScriptImports, ...legacyDeepseekEndpoints })) {
    assert.ok(debt.owner.trim(), `${file}:owner`);
    assert.ok(debt.reason.trim(), `${file}:reason`);
    assert.match(debt.removeBy, /^\d{4}-\d{2}-\d{2}$/u, `${file}:removeBy`);
    assert.ok(debt.removeBy >= today, `${file}:provider debt expired on ${debt.removeBy}`);
  }
});
