import assert from "node:assert/strict";
import test from "node:test";

import { decideGuideAutoSave } from "./guideAutoSave.js";
import type { SceneResult } from "./guideSession.js";
import type { SiteBrief } from "./siteBrief.js";

const grasslandBrief: Pick<SiteBrief, "hypothesis" | "signals"> = {
  hypothesis: { id: "urban_grassland", label: "住宅地の草地", confidence: 0.72 },
  signals: {
    landcover: ["grassland"],
    nearbyLandcover: ["built_up"],
    waterDistanceM: null,
    elevationM: 12,
  },
};

const builtUpBrief: Pick<SiteBrief, "hypothesis" | "signals"> = {
  hypothesis: { id: "built_up", label: "市街地", confidence: 0.7 },
  signals: {
    landcover: ["built_up"],
    nearbyLandcover: ["built_up"],
    waterDistanceM: null,
    elevationM: 8,
  },
};

function scene(overrides: Partial<SceneResult>): SceneResult {
  return {
    summary: "足元の草地に黄色い花が見える",
    detectedSpecies: ["セイヨウタンポポ"],
    detectedFeatures: [{ type: "species", name: "セイヨウタンポポ", confidence: 0.82 }],
    primarySubject: { name: "セイヨウタンポポ", rank: "species", confidence: 0.82 },
    environmentContext: "住宅地の縁の草地",
    isNew: true,
    sceneHash: "scene-1",
    ...overrides,
  };
}

test("guide auto-save keeps outdoor nature signals", () => {
  const decision = decideGuideAutoSave({ result: scene({}), siteBrief: grasslandBrief });

  assert.equal(decision.decision, "save");
  assert.match(decision.reasonCodes.join(","), /field_nature_signal/);
});

test("guide auto-save skips indoor/person scenes before model preference", () => {
  const decision = decideGuideAutoSave({
    result: scene({
      summary: "室内で人物の顔と天井、蛍光灯が写っている",
      detectedSpecies: [],
      detectedFeatures: [{ type: "structure", name: "天井と蛍光灯", confidence: 0.9 }],
      primarySubject: { name: "人物", rank: "unknown", confidence: 0.88 },
      saveRecommendation: { decision: "save", confidence: 0.9 },
    }),
    siteBrief: grasslandBrief,
  });

  assert.equal(decision.decision, "skip");
  assert.match(decision.reasonCodes.join(","), /privacy_or_indoor_scene/);
});

test("guide auto-save skips built-up scenes when the model also rejects them", () => {
  const decision = decideGuideAutoSave({
    result: scene({
      summary: "舗装路と標識が中心で、自然手がかりは弱い",
      detectedSpecies: [],
      detectedFeatures: [{ type: "structure", name: "舗装路と標識", confidence: 0.8 }],
      saveRecommendation: { decision: "skip", confidence: 0.76, reasonCodes: ["location_mismatch"] },
    }),
    siteBrief: builtUpBrief,
  });

  assert.equal(decision.decision, "skip");
  assert.match(decision.reasonCodes.join(","), /no_field_nature_signal|built_up_location_model_skip/);
});

test("guide auto-save skips duplicate scene hashes", () => {
  const decision = decideGuideAutoSave({ result: scene({ isNew: false }), siteBrief: grasslandBrief });

  assert.equal(decision.decision, "skip");
  assert.match(decision.reasonCodes.join(","), /duplicate_scene/);
});

test("vehicle guide auto-save skips structure-only scenes", () => {
  const decision = decideGuideAutoSave({
    result: scene({
      summary: "道路沿いに車、看板、店舗の入口が見える",
      detectedSpecies: [],
      detectedFeatures: [
        { type: "structure", name: "車両", confidence: 0.92 },
        { type: "structure", name: "看板・ロゴ", confidence: 0.88 },
      ],
      primarySubject: undefined,
      environmentContext: "舗装道路と店舗前",
    }),
    siteBrief: builtUpBrief,
    guideMode: "vehicle",
  });

  assert.equal(decision.decision, "skip");
  assert.match(decision.reasonCodes.join(","), /vehicle_structure_only_scene|no_field_nature_signal/);
});
