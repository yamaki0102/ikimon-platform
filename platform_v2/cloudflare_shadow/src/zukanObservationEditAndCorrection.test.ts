import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index";
import {
  handleGetObservationCorrections,
  handlePostObservationCorrection,
  renderObservationEditAndCorrectionHtml,
} from "./zukanObservationEditAndCorrection";

test("renderObservationEditAndCorrectionHtml renders D3 edit, D4 irreversible delete confirm, and D7 correction history", () => {
  const html = renderObservationEditAndCorrectionHtml({
    observationId: "obs_1",
    lang: "ja",
    isOwner: true,
    currentNote: "元のメモ",
    currentTaxon: "アゲハ",
    history: [
      {
        correctionId: "corr_1",
        observationId: "obs_1",
        editorUserId: "user_1",
        field: "taxon_name",
        previousValue: "チョウ",
        nextValue: "アゲハ",
        reason: "翅の模様を確認",
        createdAt: "2026-11-25T10:00:00Z",
      },
    ],
  });
  assert.match(html, /data-detail-edit="d3-d4-d7"/);
  assert.match(html, /id="obs-edit-form"/);
  assert.match(html, /元に戻せません/);
  assert.match(html, /id="obs-correction-history"/);
  assert.match(html, /アゲハ/);
});

test("POST /api/v1/observations/:id/corrections enforces 401/403 and saves correction history", async () => {
  const unauthRes = await worker.fetch(
    new Request("https://shadow.test/api/v1/observations/obs_1/corrections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: "note", nextValue: "訂正後" }),
    }),
    {} as any
  );
  assert.equal(unauthRes.status, 401);

  const r2Store = new Map<string, string>();
  const updates: unknown[][] = [];
  const fakeEnv = {
    OBS_DB: {
      prepare(sql: string) {
        return {
          bind(...args: unknown[]) {
            return {
              async first() {
                if (sql.includes("FROM observations")) {
                  return {
                    observation_id: "obs_1",
                    user_id: "owner_1",
                    visibility: "private",
                    note: "元のメモ",
                    observed_at: "2026-11-25T10:00:00Z",
                  };
                }
                return null;
              },
              async run() {
                updates.push(args);
                return { success: true };
              },
            };
          },
        };
      },
    },
    ASSET_BUCKET: {
      async get(key: string) {
        const val = r2Store.get(key);
        return val ? { body: new Response(val).body } : null;
      },
      async put(key: string, val: string) {
        r2Store.set(key, val);
      },
    },
  };

  const otherUserRes = await handlePostObservationCorrection(
    "obs_1",
    new Request("https://shadow.test/api/v1/observations/obs_1/corrections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: "note", nextValue: "乗っ取り" }),
    }),
    { userId: "other_user", banned: false },
    fakeEnv as any
  );
  assert.equal(otherUserRes.status, 403);

  const okRes = await handlePostObservationCorrection(
    "obs_1",
    new Request("https://shadow.test/api/v1/observations/obs_1/corrections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: "note", nextValue: "訂正後メモ", reason: "現地で再確認" }),
    }),
    { userId: "owner_1", banned: false },
    fakeEnv as any
  );
  assert.equal(okRes.status, 200);
  const body = (await okRes.json()) as { ok: boolean; history: Array<{ nextValue: string }> };
  assert.equal(body.ok, true);
  assert.equal(body.history.length, 1);
  assert.equal(body.history[0]?.nextValue, "訂正後メモ");
  assert.equal(updates.length, 1);

  const getForbidden = await handleGetObservationCorrections(
    "obs_1",
    { userId: "other_user", banned: false },
    fakeEnv as any
  );
  assert.equal(getForbidden.status, 403);

  const getOk = await handleGetObservationCorrections(
    "obs_1",
    { userId: "owner_1", banned: false },
    fakeEnv as any
  );
  assert.equal(getOk.status, 200);
});
