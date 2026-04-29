import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeGuideSceneResult } from "./guideSession.js";

test("vehicle guide mode does not treat Suzuki signage as a species", () => {
  const result = sanitizeGuideSceneResult({
    summary: "道路沿いにスズキの看板、街路樹、刈り込まれた草地が見えます。",
    primarySubject: { name: "スズキ", rank: "species", confidence: 0.82 },
    detectedSpecies: ["スズキ"],
    detectedFeatures: [
      { type: "species", name: "スズキ", confidence: 0.82, note: "看板の文字" },
      { type: "vegetation", name: "街路樹列", confidence: 0.76, note: "道路沿い" },
      { type: "structure", name: "自動車販売店の看板", confidence: 0.9 },
    ],
    environmentContext: "道路沿いの店舗前に街路樹と刈り込み草地がある。",
  }, "vehicle");

  assert.deepEqual(result.detectedSpecies, []);
  assert.equal(result.primarySubject, undefined);
  assert.ok(result.detectedFeatures.some((feature) => feature.type === "structure" && feature.name === "スズキ"));
  assert.ok(result.detectedFeatures.some((feature) => feature.type === "vegetation" && feature.name === "街路樹列"));
});

test("vehicle guide mode keeps coarse vegetation signals valuable without species", () => {
  const result = sanitizeGuideSceneResult({
    summary: "車窓から水路沿いの草地と畑の縁が見える。",
    detectedSpecies: [],
    detectedFeatures: [
      { type: "vegetation", name: "水路沿いの草地", confidence: 0.78 },
      { type: "landform", name: "農地の縁", confidence: 0.7 },
    ],
    environmentContext: "水路、農地、道路際が近接している。",
  }, "vehicle");

  assert.deepEqual(result.detectedSpecies, []);
  assert.match(result.summary, /水路|草地|畑/);
  assert.equal(result.detectedFeatures.length, 2);
});
