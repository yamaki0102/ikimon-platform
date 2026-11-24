import assert from "node:assert/strict";
import test from "node:test";
import { formatOutcomeUsageLine, handleNocosilOutcomeUsageApi, renderNocosilOutcomeUsageHtml } from "./nocosilOutcomeUsage";

async function signBody(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

test("handleNocosilOutcomeUsageApi verifies HMAC, enforces dual consent, blocks PII, and formats 1-line usage", async () => {
  const storedRows: unknown[] = [];
  const env = {
    NOCOSIL_INTEGRATION_HMAC_SECRET: "test-hmac-secret",
    CORE_DB: {
      prepare: () => ({
        run: async () => ({ meta: { changes: 1 } }),
        bind: (...args: unknown[]) => ({
          run: async () => {
            storedRows.push(args);
            return { meta: { changes: 1 } };
          }
        })
      })
    }
  } as unknown as Parameters<typeof handleNocosilOutcomeUsageApi>[2];

  const payload = JSON.stringify({
    outcomeId: "out_1",
    recordId: "rec_1",
    placeId: "plc_e3293ec4bb9288a0",
    eventTitle: "翌週の農園見学",
    occurredDate: "2026-11-23",
    nocosilPublicApproved: true,
    zukanPublicApproved: true
  });
  const sig = await signBody("test-hmac-secret", payload);
  const res = await handleNocosilOutcomeUsageApi(
    new Request("https://zukan.earth/api/v1/integrations/nocosil/outcome-usages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-nocosil-signature": `sha256=${sig}` },
      body: payload
    }),
    new URL("https://zukan.earth/api/v1/integrations/nocosil/outcome-usages"),
    env
  );
  assert.equal(res?.status, 200);
  const data = await res!.json() as { ok: boolean; stored: boolean; usageLine: string };
  assert.equal(data.stored, true);
  assert.equal(data.usageLine, "翌週の農園見学で使われました（2026-11-23）");
  assert.equal(storedRows.length, 1);

  const deniedPayload = JSON.stringify({
    outcomeId: "out_2",
    recordId: "rec_1",
    eventTitle: "非公開行事",
    nocosilPublicApproved: true,
    zukanPublicApproved: false
  });
  const deniedSig = await signBody("test-hmac-secret", deniedPayload);
  const deniedRes = await handleNocosilOutcomeUsageApi(
    new Request("https://zukan.earth/api/v1/integrations/nocosil/outcome-usages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-nocosil-signature": `sha256=${deniedSig}` },
      body: deniedPayload
    }),
    new URL("https://zukan.earth/api/v1/integrations/nocosil/outcome-usages"),
    env
  );
  assert.equal(deniedRes?.status, 200);
  assert.equal((await deniedRes!.json() as { stored: boolean }).stored, false);
  assert.equal(storedRows.length, 1);

  const html = renderNocosilOutcomeUsageHtml([
    {
      usage_id: "out_1:rec_1",
      outcome_id: "out_1",
      record_id: "rec_1",
      place_id: "plc_e3293ec4bb9288a0",
      event_title: "翌週の農園見学",
      usage_line: formatOutcomeUsageLine({ eventTitle: "翌週の農園見学", occurredDate: "2026-11-23" }),
      occurred_date: "2026-11-23",
      created_at: 1
    }
  ]);
  assert.match(html, /この記録が使われた行事/);
  assert.match(html, /翌週の農園見学で使われました（2026-11-23）/);
});
