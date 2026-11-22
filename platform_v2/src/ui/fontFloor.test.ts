import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const FILES = ["siteShell.ts", "frontendFoundation.ts", "appExperience.ts", "landingHomeState.ts", "mapExplorer.ts", "guideFlow.ts", "observationEventStyles.ts", "observationFieldList.ts", "../routes/personalLibrary.ts", "../routes/monitoringBusiness.ts", "../routes/guideRead.ts", "../../cloudflare_shadow/src/index.ts"];
const ALLOW: string[] = [];

test("shared CSS has no font-size below 14px", () => {
  const bad: string[] = [];
  for (const f of FILES) {
    if (f.endsWith("index.ts")) continue;
    const src = readFileSync(join(dir, f), "utf8");
    for (const m of src.matchAll(/([^{};\n]*\{[^{}]*?)font-size:\s*(\d*\.?\d+)(px|rem|em)\b/g)) {
      const v = parseFloat(m[2]!);
      const px = m[3] === "px" ? v : v * 16;
      if (px < 14 && !ALLOW.some((a) => m[1]!.includes(a))) bad.push(`${f}: ${m[0].slice(0, 80)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("walk-map and records shadow CSS has no font-size below 14px", () => {
  const lines = readFileSync(join(dir, "../../cloudflare_shadow/src/index.ts"), "utf8").split(/\r?\n/);
  const bad: string[] = [];
  for (const [a, b] of [[11899, 12340], [21782, 21783], [21914, 21930]] as const) {
    for (const l of lines.slice(a, b)) {
      for (const m of l.matchAll(/font-size:\s*(\d*\.?\d+)(px|rem|em)/g)) {
        const v = parseFloat(m[1]!);
        if ((m[2] === "px" ? v : v * 16) < 14 && v > 0) bad.push(l.slice(0, 80));
      }
    }
  }
  assert.deepEqual(bad, []);
});

test("short labels keep whole words and home categories fall back to one column", () => {
  const shell = readFileSync(join(dir, "siteShell.ts"), "utf8");
  assert.match(shell, /\[class\*=chip\][^}]*\{ word-break: keep-all; overflow-wrap: break-word; \}/);
  const home = readFileSync(join(dir, "landingHomeState.ts"), "utf8");
  assert.match(home, /\.home-category-section strong\{word-break:keep-all/);
  assert.match(home, /repeat\(auto-fit,minmax\(min\(100%,260px\),1fr\)\)/);
});
