import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));
const googleGenAiModule = ["@", "google/genai"].join("");
const allowedDirectImports = new Set([
  "scripts/draftRegionalKnowledgeHooks.ts",
  "scripts/embedRegionalKnowledgeCards.ts",
  "services/aiModelRouter.ts",
  "services/curatorGeminiWorker.ts",
  "services/guideLiveToken.ts",
  "services/guideTts.ts",
]);

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listTypeScriptFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".ts") ? [absolute] : [];
  });
}

test("new direct Google GenAI SDK imports are blocked until routed through the usage boundary", () => {
  const directImports = listTypeScriptFiles(sourceRoot)
    .filter((absolute) => {
      const source = readFileSync(absolute, "utf8");
      return source.includes(`from \"${googleGenAiModule}\"`)
        || source.includes(`from '${googleGenAiModule}'`)
        || source.includes(`import \"${googleGenAiModule}\"`)
        || source.includes(`import '${googleGenAiModule}'`);
    })
    .map((absolute) => path.relative(sourceRoot, absolute).split(path.sep).join("/"))
    .sort();

  assert.deepEqual(directImports, [...allowedDirectImports].sort(), [
    "Direct provider imports changed.",
    "Route new calls through the metered provider boundary or explicitly review the baseline.",
  ].join(" "));
});
