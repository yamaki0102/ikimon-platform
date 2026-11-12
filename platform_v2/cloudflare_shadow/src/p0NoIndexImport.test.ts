import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const coreDir = new URL("./core/", import.meta.url);

test("src/core does not import index", () => {
  if (!existsSync(coreDir)) return;
  const offenders = readdirSync(coreDir, { recursive: true, encoding: "utf8" })
    .filter((entry) => /\.[cm]?tsx?$/.test(entry))
    .filter((entry) => /from\s+["'](?:\.\/|\.\.\/)index(?:\.[a-z]+)?["']|import\(\s*["'](?:\.\/|\.\.\/)index["']\s*\)/.test(readFileSync(new URL(entry, coreDir), "utf8")));
  assert.deepEqual(offenders, []);
});
