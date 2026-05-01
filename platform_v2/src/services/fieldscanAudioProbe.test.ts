import assert from "node:assert/strict";
import test from "node:test";

import { validateAudioContainerMagic } from "./fieldscanAudio.js";

test("audio container probe accepts a WebM EBML header", () => {
  const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);

  assert.deepEqual(validateAudioContainerMagic(webm, "audio/webm;codecs=opus"), { ok: true });
});

test("audio container probe rejects malformed WebM before audio_segments insert", () => {
  const malformed = Buffer.from("not a webm chunk", "utf8");

  assert.deepEqual(validateAudioContainerMagic(malformed, "audio/webm;codecs=opus"), {
    ok: false,
    reason: "audio_container_invalid_webm",
  });
});

test("audio container probe accepts Ogg and MP4 signatures", () => {
  assert.deepEqual(validateAudioContainerMagic(Buffer.from("OggS0000", "ascii"), "audio/ogg"), { ok: true });
  assert.deepEqual(validateAudioContainerMagic(Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]), "audio/mp4"), { ok: true });
});
