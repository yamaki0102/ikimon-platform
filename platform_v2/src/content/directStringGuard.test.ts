import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const platformRootPath = fileURLToPath(new URL("../../", import.meta.url));
const japanesePattern = /[ぁ-んァ-ン一-龯]/;

const migratedFiles = [
  "platform_v2/src/app.ts",
  "platform_v2/src/routes/marketing.ts",
  "platform_v2/src/ui/quickNav.ts",
  "platform_v2/src/ui/siteShell.ts",
];

const policy = JSON.parse(
  readFileSync(fileURLToPath(new URL("./humanWritingPolicy.json", import.meta.url)), "utf8"),
) as { directJapaneseAllowlist: string[] };

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function listSourceFiles(dirPath: string): string[] {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }
    if (!entry.isFile() || !fullPath.endsWith(".ts") || fullPath.endsWith(".test.ts")) {
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

test("migrated route and shell files stay free of direct Japanese strings", () => {
  for (const relativePath of migratedFiles) {
    const body = readFileSync(join(platformRootPath, relativePath.replace("platform_v2/", "")), "utf8");
    assert.doesNotMatch(body, japanesePattern, `${relativePath} should stay content-backed`);
  }
});

test("route and ui files with direct Japanese remain on an explicit allowlist", () => {
  const scannedFiles = [
    ...listSourceFiles(join(platformRootPath, "src", "routes")),
    ...listSourceFiles(join(platformRootPath, "src", "ui")),
    join(platformRootPath, "src", "app.ts"),
  ];
  const actual = scannedFiles
    .filter((filePath) => japanesePattern.test(readFileSync(filePath, "utf8")))
    .map((filePath) => normalizePath(`platform_v2/${relative(platformRootPath, filePath)}`))
    .sort();

  assert.deepEqual(actual, policy.directJapaneseAllowlist.slice().sort());
});
