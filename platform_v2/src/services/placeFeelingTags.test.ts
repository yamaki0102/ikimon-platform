import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  PLACE_FEELING_TAG_LIMIT,
  normalizePlaceFeelingTagKeys,
  placeFeelingTagLabel,
} from "./placeFeelingTags.js";

test("place feeling tags are optional, stable, deduplicated, and capped", () => {
  assert.equal(PLACE_FEELING_TAG_LIMIT, 3);
  assert.deepEqual(normalizePlaceFeelingTagKeys(null), []);
  assert.deepEqual(
    normalizePlaceFeelingTagKeys([
      "beautiful",
      "beautiful",
      "unknown_key",
      "walking",
      "family_time",
      "trash_seen",
    ]),
    ["beautiful", "walking", "family_time"],
  );
});

test("place feeling tags have safe labels and ignore unknown keys", () => {
  assert.equal(placeFeelingTagLabel("beautiful", "ja"), "きれいだった");
  assert.equal(placeFeelingTagLabel("observing_life", "ja"), "生きもの観察中");
  assert.equal(placeFeelingTagLabel("date_walk", "ja"), "誰かと散策");
  assert.equal(placeFeelingTagLabel("not_registered", "ja"), null);
});

test("record route saves place feeling tags and prefers recent device selections", () => {
  const readRoute = readFileSync(join(process.cwd(), "src/routes/read.ts"), "utf8");

  assert.match(readRoute, /name="placeFeelingTags"/);
  assert.match(readRoute, /data-place-feeling-tag/);
  assert.match(readRoute, /PLACE_FEELING_RECENT_STORAGE_KEY/);
  assert.match(readRoute, /applyRecentPlaceFeelingOrder/);
  assert.match(readRoute, /place_feeling_tags: placeFeelingTags/);
  assert.match(readRoute, /placeFeelingTags,/);
  assert.match(readRoute, /この場所で感じたこと/);
  assert.match(readRoute, /\/demo\/place-feeling-tags/);
  assert.match(readRoute, /renderPlaceFeelingTagDemo/);
});

test("server write and detail read normalize place feeling tags through the shared module", () => {
  const writeService = readFileSync(join(process.cwd(), "src/services/observationWrite.ts"), "utf8");
  const readModels = readFileSync(join(process.cwd(), "src/services/readModels.ts"), "utf8");

  assert.match(writeService, /normalizePlaceFeelingTagKeys/);
  assert.match(writeService, /input\.placeFeelingTags \?\? input\.sourcePayload\?\.place_feeling_tags/);
  assert.match(writeService, /place_feeling_tags: placeFeelingTags/);
  assert.match(readModels, /placeFeelingTags: PlaceFeelingTagKey\[\]/);
  assert.match(readModels, /normalizePlaceFeelingTagKeys\(visitPayload\.place_feeling_tags\)/);
});
