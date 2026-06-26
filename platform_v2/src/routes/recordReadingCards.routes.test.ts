import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = readFileSync(new URL("./read.ts", import.meta.url), "utf8");
const writeSource = readFileSync(new URL("./write.ts", import.meta.url), "utf8");
const workerSource = readFileSync(new URL("../../cloudflare_shadow/src/index.ts", import.meta.url), "utf8");

test("observation detail wires the record reading cards into the existing insight block", () => {
  assert.match(readSource, /listRecordReadingCards\(\{ visitId: bundle\.visitId, viewerUserId \}\)/);
  assert.match(readSource, /getRecordReadingAvailability\(\{ observationId: bundle\.visitId, viewerUserId \}\)/);
  assert.match(readSource, /この記録を読み解く/);
  assert.match(readSource, /公開情報をもとに作成。内容は出典で確認できます。/);
});

test("record reading card writes are retired from Fastify origin and owned by Worker D1", () => {
  assert.doesNotMatch(writeSource, /"\/api\/v1\/observations\/:id\/reading-cards"/);
  assert.doesNotMatch(writeSource, /"\/api\/v1\/record-reading-cards\/:cardId"/);
  assert.doesNotMatch(writeSource, /generateRecordReadingCards/);
  assert.doesNotMatch(writeSource, /hideRecordReadingCard/);
  assert.match(workerSource, /generateCompatibleRecordReadingCards/);
  assert.match(workerSource, /hideCompatibleRecordReadingCard/);
  assert.match(workerSource, /record_reading_cards/);
});
