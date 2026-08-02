import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const sourceRoot = resolve(process.cwd(), "src");
const forbiddenImports = [
  "zukanGenericRecordPersistencePlan",
  "zukanRegionalCorePredicates",
];

function sourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return entry.isFile() && /\.(?:ts|mts|cts)$/u.test(entry.name) ? [target] : [];
  });
}

test("generic Record persistence remains disconnected from runtime routes and server", () => {
  const runtimeRoots = [
    resolve(sourceRoot, "routes"),
    resolve(sourceRoot, "server.ts"),
    resolve(sourceRoot, "app.ts"),
  ];
  const files = runtimeRoots.flatMap((target) =>
    existsSync(target) && statSync(target).isDirectory() ? sourceFiles(target) : existsSync(target) ? [target] : []);

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const forbidden of forbiddenImports) {
      assert.doesNotMatch(
        source,
        new RegExp(`(?:from\\s+["'][^"']*${forbidden}|import\\s*\\([^)]*${forbidden})`, "u"),
        `${file} must not wire ${forbidden} into runtime`,
      );
    }
  }
});

test("package scripts expose no generic Record apply command", () => {
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const scripts = packageJson.scripts ?? {};
  assert.equal(
    Object.keys(scripts).some((name) => /(?:apply|write|migrate).*generic.*record/iu.test(name)),
    false,
  );
});
