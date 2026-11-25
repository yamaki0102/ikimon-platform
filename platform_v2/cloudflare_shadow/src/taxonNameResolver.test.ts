import assert from "node:assert/strict";
import test from "node:test";
import { isWeakTaxonLabel, NEUTRAL_TAXON_FALLBACK_JA, publicTaxonDisplayName, resolveUnifiedTaxonName } from "./taxonNameResolver";

test("taxonNameResolver uses one canonical priority chain and never emits 名前待ち", () => {
  for (const weak of ["", "  ", "名前待ち", "同定待ち", "unidentified", "Unknown", "未同定", "不明"]) {
    assert.equal(isWeakTaxonLabel(weak), true);
    assert.equal(publicTaxonDisplayName(weak), NEUTRAL_TAXON_FALLBACK_JA);
    assert.doesNotMatch(publicTaxonDisplayName(weak), /名前待ち/);
  }

  assert.deepEqual(
    resolveUnifiedTaxonName({
      readmodelTaxonLabel: "名前待ち",
      observationTaxonLabel: "カワセミ",
      proposedName: "アオサギ",
      aiCandidateLabel: "スズメ",
    }),
    { effectiveTaxonLabel: "カワセミ", displayName: "カワセミ", isAwaitingId: false }
  );

  assert.deepEqual(
    resolveUnifiedTaxonName({
      readmodelTaxonLabel: "unidentified",
      proposedName: "メジロ",
      aiCandidateLabel: "ウグイス",
    }),
    { effectiveTaxonLabel: "メジロ", displayName: "メジロ", isAwaitingId: false }
  );

  assert.deepEqual(
    resolveUnifiedTaxonName({
      readmodelTaxonLabel: "unknown",
      aiCandidateLabel: "キジバト",
    }),
    { effectiveTaxonLabel: null, displayName: "キジバト", isAwaitingId: true }
  );

  assert.deepEqual(
    resolveUnifiedTaxonName({
      readmodelTaxonLabel: "名前待ち",
    }),
    { effectiveTaxonLabel: null, displayName: NEUTRAL_TAXON_FALLBACK_JA, isAwaitingId: true }
  );
});
