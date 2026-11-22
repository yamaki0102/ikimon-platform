import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSafePublicAreaLabelCandidate } from "./publicAreaLabel";

test("area labels reject backslashes, digits, schools and keep plain names", () => {
  assert.equal(normalizeSafePublicAreaLabelCandidate("中央\\区"), null);
  assert.equal(normalizeSafePublicAreaLabelCandidate("中央1区"), null);
  assert.equal(normalizeSafePublicAreaLabelCandidate("浜松小学校"), null);
  assert.equal(normalizeSafePublicAreaLabelCandidate(" 浜松市 中央区 "), "浜松市中央区");
});
