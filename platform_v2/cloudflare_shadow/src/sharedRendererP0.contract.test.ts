import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

test("shared field renderer keeps empty public pages concise and action-oriented", () => {
  assert.doesNotMatch(source, /\$\{renderFieldSiteIntelligenceSection\(row, isEnglish\)\}/);
  assert.match(source, /href=\"\/record\?field_id=/);
  assert.match(source, /href=\"\/map\"/);
  assert.match(source, /function renderFieldRecentRecords[\s\S]*if \(records\.length === 0\) return \"\"/);
  assert.match(source, /公開された新着記録/);
});

test("Ryuyo renderer separates core and nearby records", () => {
  assert.match(source, /renderFieldRecentRecords\(recentRecords\.core, isEnglish/);
  assert.match(source, /renderFieldRecentRecords\(recentRecords\.nearby, isEnglish, "周辺で見つかったもの"\)/);
  assert.match(source, /nearbyObservationGallery: recentRecords\.nearby/);
  assert.match(source, /classifyRyuyoPoint\(/);
  assert.doesNotMatch(source, /ryuyo[^\n]+map pipeline|ryuyo[^\n]+map endpoint/i);
});
