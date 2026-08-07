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

function failQuery(): KubiakaPrivateRecordsDbQuery {
  return (async () => {
    throw new Error("retired_postgresql_kubiaka_read_model_must_not_execute");
  }) as KubiakaPrivateRecordsDbQuery;
}

test("retired adapter retains only the Cloudflare private-record contract marker", () => {
  assert.equal(KUBIAKA_PRIVATE_RECORD_EXPERIENCE_KEY, "kubiaka-watch");
  assert.equal(KUBIAKA_PRIVATE_RECORD_MAX_PHOTOS, 6);
  assert.equal(KUBIAKA_PRIVATE_RECORD_PAGE_LIMIT, 24);
  assert.equal(
    KUBIAKA_PRIVATE_RECORD_SCOPE_SQL,
    "cloudflare_d1_kubiaka_private_record_owner_scope_v1",
  );
});

test("overview and list are inert after the PostgreSQL route retirement", async () => {
  assert.deepEqual(await readOwnedKubiakaRecordOverview("owner-a", failQuery()), {
    totalCount: 0,
    latest: null,
  });

  const largePage = await listOwnedKubiakaRecords("owner-a", failQuery(), 1000);
  assert.deepEqual(largePage, {
    totalCount: 0,
    records: [],
    limit: KUBIAKA_PRIVATE_RECORD_PAGE_LIMIT,
    hasMore: false,
  });

  const nonPositivePage = await listOwnedKubiakaRecords("owner-a", failQuery(), 0);
  assert.equal(nonPositivePage.limit, 1);
  assert.deepEqual(nonPositivePage.records, []);
});

test("detail, acknowledgement, and private media never query the retired store", async () => {
  assert.equal(await readOwnedKubiakaRecordDetail("visit-a", "owner-a", failQuery()), null);
  assert.equal(await readOwnedKubiakaAcknowledgement("record-a", "owner-a", failQuery()), null);
  assert.equal(await readOwnedKubiakaPrivateMedia("visit-a", 1, "owner-a", failQuery()), null);
  assert.equal(await readOwnedKubiakaPrivateMedia("visit-a", 7, "owner-a", failQuery()), null);
});

test("private read authority is the Worker D1 path, not client-provided PostgreSQL scope", async () => {
  const query = failQuery();
  const overview = await readOwnedKubiakaRecordOverview("client-supplied-owner", query);
  const page = await listOwnedKubiakaRecords("client-supplied-owner", query, 2);
  assert.equal(overview.latest, null);
  assert.equal(page.totalCount, 0);
  assert.equal(page.hasMore, false);
});
