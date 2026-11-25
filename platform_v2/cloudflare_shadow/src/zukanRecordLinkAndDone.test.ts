import assert from "node:assert/strict";
import test from "node:test";
import worker, { renderCloudflareRecordHtml } from "./index";
import {
  ZUKAN_RECORD_LINK_DONE_STYLES,
  handleSaveRecordLinks,
  renderRecordDoneCardHtml,
  renderRecordLinkSelectorHtml,
} from "./zukanRecordLinkAndDone";

test("zukanRecordLinkAndDone renders C7 link targets and C9 completion container", () => {
  const selector = renderRecordLinkSelectorHtml({ lang: "ja", hasEventContext: true });
  assert.match(selector, /data-record-link-targets="c7"/);
  assert.match(selector, /value="place_zukan"/);
  assert.match(selector, /value="event"/);
  assert.match(selector, /value="mine_only"/);

  const doneCard = renderRecordDoneCardHtml({ lang: "ja", prefix: "/ja" });
  assert.match(doneCard, /id="record-saved-links"/);
  assert.match(doneCard, /data-record-saved-links/);
  assert.match(ZUKAN_RECORD_LINK_DONE_STYLES, /prefers-reduced-motion:\s*reduce/);
});

test("POST /api/v1/record/links enforces auth (401) and owner check (403)", async () => {
  const unauthRes = await worker.fetch(
    new Request("https://shadow.test/api/v1/record/links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ observationId: "obs_1", targets: ["place_zukan"] }),
    }),
    {} as any
  );
  assert.equal(unauthRes.status, 401);

  const obsDbOther = {
    prepare(sql: string) {
      assert.match(sql, /SELECT\s+owner_user_id\s+FROM\s+observations/i);
      return {
        bind() {
          return {
            async first() {
              return { owner_user_id: "other_user" };
            },
          };
        },
      };
    },
  };
  const forbiddenRes = await handleSaveRecordLinks(
    new Request("https://shadow.test/api/v1/record/links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ observationId: "obs_1", targets: ["place_zukan"] }),
    }),
    "caller_user",
    obsDbOther as any,
    {} as any
  );
  assert.equal(forbiddenRes.status, 403);
});

test("handleSaveRecordLinks saves link targets for observation owner", async () => {
  const writes: unknown[][] = [];
  const obsDb = {
    prepare(sql: string) {
      assert.match(sql, /SELECT\s+owner_user_id\s+FROM\s+observations/i);
      return {
        bind() {
          return {
            async first() {
              return { owner_user_id: "owner_1" };
            },
          };
        },
      };
    },
  };
  const coreDb = {
    prepare() {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              writes.push(args);
              return { success: true };
            },
          };
        },
      };
    },
  };

  const okRes = await handleSaveRecordLinks(
    new Request("https://shadow.test/api/v1/record/links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        observationId: "obs_owner_1",
        targets: ["place_zukan"],
        placeId: "place_1",
      }),
    }),
    "owner_1",
    obsDb as any,
    coreDb as any
  );
  assert.equal(okRes.status, 200);
  const body = (await okRes.json()) as { ok: boolean; published: boolean; targets: string[] };
  assert.equal(body.ok, true);
  assert.equal(body.published, true);
  assert.deepEqual(body.targets, ["place_zukan"]);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.[0], "owner_1");
  assert.equal(writes[0]?.[1], "obs_owner_1");
  assert.equal(writes[0]?.[2], "place_1");
});

test("renderCloudflareRecordHtml includes C7-C9 link selector and completion card", () => {
  const html = renderCloudflareRecordHtml(
    { userId: "user_c7_c9", displayName: "テスター", banned: false } as any,
    new URL("https://ikimon.life/ja/record"),
    "test-nonce"
  );
  assert.match(html, /data-record-link-targets="c7"/);
  assert.match(html, /id="record-saved-links"/);
  assert.match(html, /data-record-saved-links/);
});
