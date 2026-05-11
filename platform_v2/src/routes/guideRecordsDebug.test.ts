import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const routePath = fileURLToPath(new URL("./guideRecordsDebug.ts", import.meta.url));

test("guide outcomes cards separate candidates from promoted observations", () => {
  const source = readFileSync(routePath, "utf8");

  assert.match(source, /gr\.occurrence_id/);
  assert.match(source, /has_promotable_audio/);
  assert.match(source, /privacy_status = 'clean'/);
  assert.match(source, /coalesce\(audio\.voice_flag, false\) = false/);
  assert.match(source, /観察レコードにする/);
  assert.match(source, /観察を見る/);
  assert.match(source, /写真を追加して観察にする/);
  assert.match(source, /data-guide-promote-id/);
  assert.match(source, /\/api\/v1\/guide\/records\/' \+ encodeURIComponent\(guideRecordId\) \+ '\/promote/);
  assert.match(source, /nextAction === 'add_photo'/);
  assert.match(source, /AIガイド成果は未検証候補です/);
});
