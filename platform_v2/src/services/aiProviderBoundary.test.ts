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
const googleGenAiModule = ["@", "google/genai"].join("");
const reviewedProviderAdapters = new Set([
  "services/providers/googleGenAiSdk.ts",
]);
const legacyDirectImports: Record<string, { owner: string; removeBy: string; reason: string }> = {
  "scripts/draftRegionalKnowledgeHooks.ts": {
    owner: "knowledge-ingest",
    removeBy: "2026-09-30",
    reason: "standalone reviewed draft CLI",
  },
  "scripts/embedRegionalKnowledgeCards.ts": {
    owner: "knowledge-ingest",
    removeBy: "2026-09-30",
    reason: "standalone embedding migration CLI",
  },
  "services/curatorGeminiWorker.ts": {
    owner: "curator-runtime",
    removeBy: "2026-09-30",
    reason: "legacy curator provider implementation",
  },
  "services/guideLiveToken.ts": {
    owner: "guide-runtime",
    removeBy: "2026-09-30",
    reason: "ephemeral-token API not yet routed through provider adapters",
  },
  "services/guideTts.ts": {
    owner: "guide-runtime",
    removeBy: "2026-09-30",
    reason: "audio generation API not yet routed through provider adapters",
  },
};

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listTypeScriptFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".ts") ? [absolute] : [];
  });
}

function hasDirectImport(source: string): boolean {
  const quoted = [`"${googleGenAiModule}"`, `'${googleGenAiModule}'`];
  return quoted.some((moduleLiteral) =>
    source.includes(`from ${moduleLiteral}`)
    || source.includes(`import ${moduleLiteral}`)
    || source.includes(`import(${moduleLiteral})`)
    || source.includes(`require(${moduleLiteral})`));
}

test("Google GenAI SDK imports are limited to reviewed adapters and bounded legacy debt", () => {
  const directImports = listTypeScriptFiles(sourceRoot)
    .filter((absolute) => hasDirectImport(readFileSync(absolute, "utf8")))
    .map((absolute) => path.relative(sourceRoot, absolute).split(path.sep).join("/"))
    .sort();
  const expected = [
    ...reviewedProviderAdapters,
    ...Object.keys(legacyDirectImports),
  ].sort();
  assert.deepEqual(directImports, expected, [
    "Direct provider imports changed.",
    "Use services/providers or explicitly review and time-bound the legacy debt entry.",
  ].join(" "));
  assert.equal(directImports.includes("services/aiModelRouter.ts"), false);
});

test("legacy direct-import debt has an owner reason and unexpired removal date", () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const [file, debt] of Object.entries(legacyDirectImports)) {
    assert.ok(debt.owner.trim(), `${file}:owner`);
    assert.ok(debt.reason.trim(), `${file}:reason`);
    assert.match(debt.removeBy, /^\d{4}-\d{2}-\d{2}$/u, `${file}:removeBy`);
    assert.ok(debt.removeBy >= today, `${file}:legacy provider debt expired on ${debt.removeBy}`);
  }
});
