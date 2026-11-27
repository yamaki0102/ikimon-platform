import { recordPageScriptAsset } from "./recordPageScriptAsset";
import assert from "node:assert/strict";
import test from "node:test";
import worker, { renderCloudflareRecordHtml } from "./index";
import {
  ZUKAN_RECORD_INPUT_STYLES,
  handleRecordVoiceTranscribe,
  renderRecordModeBarHtml,
  renderRecordVoiceButtonHtml,
} from "./zukanRecordInput";

test("zukanRecordInput renders C3/C11/C12 mode bar and mic buttons for input fields", () => {
  const modeBar = renderRecordModeBarHtml({ lang: "ja", prefix: "/ja", activeMode: "memo" });
  assert.match(modeBar, /data-record-mode-bar="c3-c11-c12"/);
  assert.match(modeBar, /href="\/ja\/record\?mode=memo"/);
  assert.match(modeBar, /href="\/ja\/record\?mode=voice"/);
  assert.match(modeBar, /aria-current="page"/);

  const micBtn = renderRecordVoiceButtonHtml({ targetSelector: 'textarea[name="note"]', lang: "ja" });
  assert.match(micBtn, /data-voice-mic-target/);
  assert.match(micBtn, /声で入力/);
  assert.match(ZUKAN_RECORD_INPUT_STYLES, /prefers-reduced-motion:\s*reduce/);
  assert.match(ZUKAN_RECORD_INPUT_STYLES, /min-height:\s*44px/);
});

test("POST /api/v1/record/voice-transcribe requires session auth (401 without session)", async () => {
  const res = await worker.fetch(
    new Request("https://shadow.test/api/v1/record/voice-transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mimeType: "audio/webm",
        base64Data: Buffer.from("fake-audio").toString("base64"),
      }),
    }),
    {} as any
  );
  assert.equal(res.status, 401);
});

test("handleRecordVoiceTranscribe validates audio payload and transcribes via Gemini", async () => {
  const badMime = await handleRecordVoiceTranscribe(
    new Request("https://shadow.test/api/v1/record/voice-transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mimeType: "text/plain", base64Data: "abc" }),
    }),
    { GEMINI_API_KEY: "test-key" } as any,
    async () => new Response()
  );
  assert.equal(badMime.status, 400);

  const noKey = await handleRecordVoiceTranscribe(
    new Request("https://shadow.test/api/v1/record/voice-transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mimeType: "audio/webm",
        base64Data: Buffer.from("fake-audio").toString("base64"),
      }),
    }),
    {} as any,
    async () => new Response()
  );
  assert.equal(noKey.status, 503);

  const ok = await handleRecordVoiceTranscribe(
    new Request("https://shadow.test/api/v1/record/voice-transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mimeType: "audio/webm",
        base64Data: Buffer.from("fake-audio").toString("base64"),
      }),
    }),
    { GEMINI_API_KEY: "test-key" } as any,
    async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ transcript: "アゲハチョウが飛んでいた" }) }] } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
  );
  assert.equal(ok.status, 200);
  const body = (await ok.json()) as { ok: boolean; transcript: string };
  assert.equal(body.ok, true);
  assert.equal(body.transcript, "アゲハチョウが飛んでいた");
});

test("renderCloudflareRecordHtml puts the memo and voice mic in the capture stage while keeping the default form hidden", () => {
  const html = renderCloudflareRecordHtml(
    { userId: "user_c3_c11_c12", displayName: "テスター", banned: false } as any,
    new URL("https://ikimon.life/ja/record"),
    "test-nonce"
  ) + recordPageScriptAsset().content.toString("utf8");
  assert.match(html, /data-zt-memo-open/);
  assert.doesNotMatch(html, /data-record-mode-bar=/);
  assert.match(html, /data-voice-mic-target/);
  assert.match(html, /\/api\/v1\/record\/voice-transcribe/);
  assert.match(html, /id="record-form"[^>]*hidden/);
});
