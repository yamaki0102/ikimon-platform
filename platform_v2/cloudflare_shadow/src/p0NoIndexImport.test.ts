import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";

for (const dirName of ["core", "programs"]) {
  const dir = new URL(`./${dirName}/`, import.meta.url);
  test(`src/${dirName} does not import index`, () => {
    if (!existsSync(dir)) return;
    const offenders = readdirSync(dir, { recursive: true, encoding: "utf8" })
      .filter((entry) => /\.[cm]?tsx?$/.test(entry))
      .filter((entry) => /from\s+["'](?:\.\/|\.\.\/)index(?:\.[a-z]+)?["']|import\(\s*["'](?:\.\/|\.\.\/)index["']\s*\)/.test(readFileSync(new URL(entry, dir), "utf8")));
    assert.deepEqual(offenders, []);
  });
}
