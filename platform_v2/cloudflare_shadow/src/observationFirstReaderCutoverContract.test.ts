import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workerSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

test("observation-first cutover fails closed for policy-forbidden and unavailable records", () => {
  assert.match(workerSource, /observationFirst\.state === "forbidden"/);
  assert.match(workerSource, /renderObservationNotFoundHtml\(\), 404/);
  assert.match(workerSource, /observationFirst\.state === "unavailable"/);
  assert.match(workerSource, /renderObservationNotFoundHtml\(\), 503/);
  assert.match(workerSource, /retry-after": "30"/);
});

test("legacy detail fallback remains available only when the observation-first record is missing", () => {
  assert.match(workerSource, /if \(observationFirst\.state === "ready"\)/);
  assert.match(workerSource, /if \(!container\) return \{ state: "missing" as const, detail: null \}/);
  assert.match(workerSource, /return html\(renderPublicObservationDetailHtml\(detail, ownerStatus\)/);
});
