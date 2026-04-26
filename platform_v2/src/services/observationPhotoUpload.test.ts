import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("photo upload promotes native no-photo reviews after adding evidence", () => {
  const source = readFileSync(path.join(process.cwd(), "src/services/observationPhotoUpload.ts"), "utf8");

  assert.match(source, /normalizeObservationImage/);
  assert.match(source, /width: 2560/);
  assert.match(source, /height: 2560/);
  assert.match(source, /fit: "inside"/);
  assert.match(source, /widthPx: normalizedImage\.widthPx/);
  assert.match(source, /heightPx: normalizedImage\.heightPx/);
  assert.match(source, /set public_visibility = 'public'/);
  assert.match(source, /quality_review_status = 'accepted'/);
  assert.match(source, /reason <> 'missing_photo'/);
  assert.match(source, /reason_code = 'native_no_photo'/);
  assert.match(source, /review_status = 'accepted'/);
  assert.match(source, /void reassessObservation\(visitId\)/);
  assert.match(source, /import \{ reassessObservation \} from "\.\/observationReassess\.js"/);
});
