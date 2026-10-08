import assert from "node:assert/strict";
import test from "node:test";
import { parseDiscoveryPrivacyResult, screenDiscoveryPhoto } from "./eventDiscoveryPrivacy";

test("privacy screen requires every explicit boolean, rejects malformed or incomplete answers", () => {
  const clear = { person: false, personal_information: false, sensitive_content: false, uncertain: false };
  assert.deepEqual(parseDiscoveryPrivacyResult(JSON.stringify(clear)), { clear: true, reason: "clear" });
  for (const key of Object.keys(clear)) assert.equal(parseDiscoveryPrivacyResult(JSON.stringify({ ...clear, [key]: true })).clear, false);
  for (const value of ["{}", "null", "[]", "bad", JSON.stringify({ ...clear, person: "false" }), JSON.stringify({ ...clear, allow: true })]) {
    assert.deepEqual(parseDiscoveryPrivacyResult(value), { clear: false, reason: "uncertain" });
  }
});

test("privacy provider failures, missing configuration and contact text never authorize publication", async () => {
  const image = new ArrayBuffer(1);
  let calls = 0;
  const fail: typeof fetch = async () => { calls++; throw new Error("provider failure"); };
  assert.equal((await screenDiscoveryPhoto(undefined, image, "", fail)).reason, "unavailable");
  assert.equal((await screenDiscoveryPhoto("test-key", image, "test@example.org", fail)).reason, "personal_information");
  assert.equal((await screenDiscoveryPhoto("test-key", image, "電話090-1234-5678", fail)).reason, "personal_information");
  assert.equal(calls, 0);
  assert.equal((await screenDiscoveryPhoto("test-key", image, "", fail)).reason, "unavailable");
  assert.equal(calls, 1);
});

test("privacy request uses inline image and structured booleans; truncated responses stay pending", async () => {
  const clear = JSON.stringify({ person: false, personal_information: false, sensitive_content: false, uncertain: false });
  for (const finishReason of ["STOP", "MAX_TOKENS"]) {
    const fetcher: typeof fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.contents[0].parts[0].inlineData.mimeType, "image/webp");
      assert.equal(body.generationConfig.responseMimeType, "application/json");
      assert.ok(init?.signal);
      return Response.json({ candidates: [{ content: { parts: [{ text: clear }] }, finishReason }] });
    };
    assert.equal((await screenDiscoveryPhoto("test-key", new ArrayBuffer(1), "葉っぱ", fetcher)).clear, finishReason === "STOP");
  }
});
