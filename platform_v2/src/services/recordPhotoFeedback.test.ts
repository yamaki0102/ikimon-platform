import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  fallbackRecordPhotoFeedbackSentence,
  normalizeRecordPhotoFeedbackContext,
  normalizeRecordPhotoFeedbackImages,
  sanitizeRecordPhotoFeedbackResponse,
} from "./recordPhotoFeedback.js";

test("record photo feedback normalizes compact image payloads", () => {
  const validBase64 = "a".repeat(120);
  const images = normalizeRecordPhotoFeedbackImages([
    { mimeType: "image/jpeg", base64Data: `data:image/jpeg;base64,${validBase64}` },
    { mimeType: "image/gif", base64Data: validBase64 },
    { mimeType: "image/png", base64Data: "short" },
  ]);

  assert.deepEqual(images, [{ mimeType: "image/jpeg", base64Data: validBase64 }]);
});

test("record photo feedback sanitizes model JSON into a one sentence result", () => {
  const result = sanitizeRecordPhotoFeedbackResponse(JSON.stringify({
    sentence: "主役は見えていますが、葉裏が弱いので次は裏側が分かる1枚を足すと見分けやすくなります。",
    priority: "angle",
    visualSignals: ["花は見える", "葉裏が見えない"],
    environmentDraft: {
      surrounding_cover: { value: "low_grass", confidence: 0.63 },
      human_change: { value: "invalid", confidence: 0.9 },
    },
  }));

  assert.equal(result.priority, "angle");
  assert.equal(result.sentence, "主役は見えていますが、葉裏が弱いので次は裏側が分かる1枚を足すと見分けやすくなります。");
  assert.deepEqual(result.visualSignals, ["花は見える", "葉裏が見えない"]);
  assert.equal(result.environmentDraft.surrounding_cover, "low_grass");
  assert.equal(result.environmentDraft.surrounding_cover_source, "derived");
  assert.equal(result.environmentDraft.human_change, undefined);
});

test("record photo feedback keeps a useful fallback when model output is malformed", () => {
  const result = sanitizeRecordPhotoFeedbackResponse("not-json");

  assert.equal(result.priority, "context");
  assert.match(result.sentence, /周囲の文脈/);
});

test("record photo feedback context is bounded", () => {
  const context = normalizeRecordPhotoFeedbackContext({
    hasVideo: true,
    hasLocation: true,
    photoCount: 99,
    userNote: "  葉が気になる  ".repeat(80),
    taxonName: "サツキ",
  });

  assert.equal(context.hasVideo, true);
  assert.equal(context.hasLocation, true);
  assert.equal(context.photoCount, 12);
  assert.equal(context.taxonName, "サツキ");
  assert.ok((context.userNote ?? "").length <= 220);
});

test("record photo feedback fallback can acknowledge already-good photos", () => {
  assert.match(
    fallbackRecordPhotoFeedbackSentence("already_good", ["花と葉の形"]),
    /花と葉の形/,
  );
});

test("record photo feedback keeps Gemini thinking from consuming the reply budget", () => {
  const source = readFileSync(new URL("./recordPhotoFeedback.ts", import.meta.url), "utf8");

  assert.match(source, /thinkingConfig:\s*\{\s*thinkingLevel:\s*"minimal"\s*\}/);
  assert.match(source, /maxOutputTokens:\s*960/);
});
