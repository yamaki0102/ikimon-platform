import assert from "node:assert/strict";
import test from "node:test";
import { isAiUsageV2Enabled } from "./aiUsageRuntime.js";

function withEnv(values: Record<string, string | undefined>, run: () => void): void {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("AI usage activation requires global flag and explicit feature allowlist", () => {
  withEnv({ AI_USAGE_V2_ENABLED: undefined, AI_USAGE_V2_FEATURES: undefined }, () => {
    assert.equal(isAiUsageV2Enabled("guide_tts_audio"), false);
  });
  withEnv({ AI_USAGE_V2_ENABLED: "1", AI_USAGE_V2_FEATURES: undefined }, () => {
    assert.equal(isAiUsageV2Enabled("guide_tts_audio"), false);
  });
  withEnv({ AI_USAGE_V2_ENABLED: "1", AI_USAGE_V2_FEATURES: "guide_tts_audio,guide_tts_text" }, () => {
    assert.equal(isAiUsageV2Enabled("guide_tts_audio"), true);
    assert.equal(isAiUsageV2Enabled("profile_note_digest"), false);
  });
  withEnv({ AI_USAGE_V2_ENABLED: "1", AI_USAGE_V2_FEATURES: "*" }, () => {
    assert.equal(isAiUsageV2Enabled("profile_note_digest"), true);
  });
});
