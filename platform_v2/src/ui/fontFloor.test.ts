import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const FILES = ["siteShell.ts", "frontendFoundation.ts", "appExperience.ts", "landingHomeState.ts"];
const ALLOW: string[] = [];

test("shared CSS has no font-size below 14px", () => {
  const bad: string[] = [];
  for (const f of FILES) {
    const src = readFileSync(join(dir, f), "utf8");
    for (const m of src.matchAll(/([^{};\n]*\{[^{}]*?)font-size:\s*(\d*\.?\d+)(px|rem|em)\b/g)) {
      const v = parseFloat(m[2]!);
      const px = m[3] === "px" ? v : v * 16;
      if (px < 14 && !ALLOW.some((a) => m[1]!.includes(a))) bad.push(`${f}: ${m[0].slice(0, 80)}`);
    }
  }
  assert.deepEqual(bad, []);
});
