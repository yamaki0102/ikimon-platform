import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { normalizeMapVisitedPlaceName } from "./mapVisitedPlaces.js";

test("normalizeMapVisitedPlaceName replaces broad prefecture titles with the municipality", () => {
  assert.equal(
    normalizeMapVisitedPlaceName({
      placeName: "愛知県",
      municipality: "浜松市浜名区",
    }),
    "浜松市浜名区",
  );
});

test("normalizeMapVisitedPlaceName keeps real place names", () => {
  assert.equal(
    normalizeMapVisitedPlaceName({
      placeName: "都田公園",
      municipality: "浜松市浜名区",
    }),
    "都田公園",
  );
});

test("public map quality gate excludes placeholder source and media markers", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "observationQualityGate.ts"), "utf8");

  assert.match(source, /PUBLIC_PLACEHOLDER_SOURCE_MARKER_PATTERN_SQL/);
  assert.match(source, /dummy\|placeholder\|sample/);
  assert.match(source, /dummy\[-_\]\?media/);
  assert.match(source, /placeholder\[-_\]\?media/);
  assert.match(source, /sample\[-_\]\?record/);
});
