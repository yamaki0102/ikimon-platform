import assert from "node:assert/strict";
import test from "node:test";
import {
  KUBIAKA_PRIVATE_RECORD_EXPERIENCE_KEY,
  KUBIAKA_PRIVATE_RECORD_MAX_PHOTOS,
  KUBIAKA_PRIVATE_RECORD_PAGE_LIMIT,
  KUBIAKA_PRIVATE_RECORD_SCOPE_SQL,
  listOwnedKubiakaRecords,
  readOwnedKubiakaAcknowledgement,
  readOwnedKubiakaPrivateMedia,
  readOwnedKubiakaRecordDetail,
  readOwnedKubiakaRecordOverview,
  type KubiakaPrivateRecordsDbQuery,
} from "./kubiakaPrivateRecordsReadModel.js";

function queryFromRows(rowsByCall: Array<Record<string, unknown>[]>, calls: Array<{ text: string; values: unknown[] }>): KubiakaPrivateRecordsDbQuery {
  let index = 0;
  return (async (text: string, values: unknown[]) => {
    calls.push({ text, values });
    const rows = rowsByCall[index] ?? [];
    index += 1;
    return { rows };
  }) as KubiakaPrivateRecordsDbQuery;
}

const row = {
  visit_id: "visit-owner-a",
  observed_at: "2026-08-01T09:00:00.000Z",
  saved_at: "2026-08-01T09:02:00.000Z",
  ai_assessment_status: "not_requested",
  photo_count: 2,
};

test("persisted owner, Kubiaka and private flags are mandatory", () => {
  assert.match(KUBIAKA_PRIVATE_RECORD_SCOPE_SQL, /v\.user_id = \$1/);
  assert.match(KUBIAKA_PRIVATE_RECORD_SCOPE_SQL, /public_visibility = 'hidden'/);
  assert.match(KUBIAKA_PRIVATE_RECORD_SCOPE_SQL, /experience_key/);
  assert.match(KUBIAKA_PRIVATE_RECORD_SCOPE_SQL, /private_record/);
  assert.match(KUBIAKA_PRIVATE_RECORD_SCOPE_SQL, /public_aggregation_allowed/);
  assert.match(KUBIAKA_PRIVATE_RECORD_SCOPE_SQL, /external_routing_allowed/);
  assert.match(KUBIAKA_PRIVATE_RECORD_SCOPE_SQL, /automatic_recipient_delivery_allowed/);
});

test("overview supports zero and one owned record without trusting client scope", async () => {
  const zeroCalls: Array<{ text: string; values: unknown[] }> = [];
  const zero = await readOwnedKubiakaRecordOverview("owner-a", queryFromRows([], zeroCalls));
  assert.deepEqual(zero, { totalCount: 0, latest: null });

  const oneCalls: Array<{ text: string; values: unknown[] }> = [];
  const one = await readOwnedKubiakaRecordOverview(
    "owner-a",
    queryFromRows([[{ ...row, total_count: 1 }]], oneCalls),
  );
  assert.equal(one.totalCount, 1);
  assert.equal(one.latest?.visitId, "visit-owner-a");
  assert.deepEqual(oneCalls[0]?.values, ["owner-a", KUBIAKA_PRIVATE_RECORD_EXPERIENCE_KEY]);
  assert.doesNotMatch(oneCalls[0]?.text ?? "", /query|client.*experience/i);
});

test("record list is newest-first and capped safely", async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const page = await listOwnedKubiakaRecords(
    "owner-a",
    queryFromRows([[
      { ...row, visit_id: "visit-new", total_count: 30 },
      { ...row, visit_id: "visit-old", saved_at: "2026-07-31T09:02:00.000Z", total_count: 30 },
    ]], calls),
    1000,
  );
  assert.deepEqual(page.records.map((record) => record.visitId), ["visit-new", "visit-old"]);
  assert.equal(page.limit, KUBIAKA_PRIVATE_RECORD_PAGE_LIMIT);
  assert.equal(page.hasMore, true);
  assert.match(calls[0]?.text ?? "", /order by saved_at desc/);
  assert.deepEqual(calls[0]?.values, [
    "owner-a",
    KUBIAKA_PRIVATE_RECORD_EXPERIENCE_KEY,
    KUBIAKA_PRIVATE_RECORD_PAGE_LIMIT,
  ]);
});

test("owner B, non-Kubiaka and private mismatch fail closed as no row", async () => {
  const empty = (async () => ({ rows: [] })) as KubiakaPrivateRecordsDbQuery;
  assert.equal(await readOwnedKubiakaRecordDetail("visit-owner-a", "owner-b", empty), null);
  assert.equal(await readOwnedKubiakaAcknowledgement("visit-non-kubiaka", "owner-a", empty), null);
  assert.equal(await readOwnedKubiakaPrivateMedia("visit-not-hidden", 1, "owner-a", empty), null);
});

test("detail accepts exactly one to six private photos", async () => {
  for (const photoCount of [1, KUBIAKA_PRIVATE_RECORD_MAX_PHOTOS]) {
    const calls: Array<{ text: string; values: unknown[] }> = [];
    const photos = Array.from({ length: photoCount }, (_, index) => ({
      photo_index: index + 1,
      mime_type: "image/jpeg",
      width_px: 1200,
      height_px: 900,
    }));
    const detail = await readOwnedKubiakaRecordDetail(
      "visit-owner-a",
      "owner-a",
      queryFromRows([[{ ...row, photo_count: photoCount }], photos], calls),
    );
    assert.equal(detail?.photos.length, photoCount);
    assert.deepEqual(calls[0]?.values, ["owner-a", KUBIAKA_PRIVATE_RECORD_EXPERIENCE_KEY, "visit-owner-a"]);
  }

  const mismatch = await readOwnedKubiakaRecordDetail(
    "visit-owner-a",
    "owner-a",
    queryFromRows([[{ ...row, photo_count: 2 }], [{ photo_index: 1, mime_type: "image/jpeg", width_px: null, height_px: null }]], []),
  );
  assert.equal(mismatch, null);
});

test("private media lookup requires an owner-gated private storage locator", async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  const media = await readOwnedKubiakaPrivateMedia(
    "visit-owner-a",
    2,
    "owner-a",
    queryFromRows([[{ storage_path: "private-photos/v2-observations/visit-owner-a/photo.jpg", mime_type: "image/jpeg" }]], calls),
  );
  assert.deepEqual(media, {
    storagePath: "private-photos/v2-observations/visit-owner-a/photo.jpg",
    mimeType: "image/jpeg",
  });
  assert.match(calls[0]?.text ?? "", /storage_backend = 'local_private_fs'/);
  assert.match(calls[0]?.text ?? "", /public_url is null/);
  assert.match(calls[0]?.text ?? "", /public_delivery_allowed/);
  assert.equal(await readOwnedKubiakaPrivateMedia("visit-owner-a", 0, "owner-a", queryFromRows([], [])), null);
  assert.equal(await readOwnedKubiakaPrivateMedia("visit-owner-a", 7, "owner-a", queryFromRows([], [])), null);
  assert.equal(
    await readOwnedKubiakaPrivateMedia(
      "visit-owner-a",
      1,
      "owner-a",
      queryFromRows([[{ storage_path: "private-photos/v2-observations/visit-owner-a/photo.svg", mime_type: "image/svg+xml" }]], []),
    ),
    null,
  );
});

test("read models never select exact coordinates or owner identity for rendering", async () => {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  await readOwnedKubiakaRecordOverview("owner-a", queryFromRows([], calls));
  await listOwnedKubiakaRecords("owner-a", queryFromRows([], calls));
  const sql = calls.map((call) => call.text).join("\n");
  assert.doesNotMatch(sql, /point_latitude|point_longitude|locality_note|display_name|email/i);
});
