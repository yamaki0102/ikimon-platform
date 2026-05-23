import assert from "node:assert/strict";
import test from "node:test";
import { buildRecordReadingCardDraftsForSignals } from "./recordReadingCards.js";

function draftsFor(text: string) {
  return buildRecordReadingCardDraftsForSignals({
    visit: {
      visitId: "record-test",
      ownerUserId: "user-test",
      publicVisibility: "public",
      observedAt: "2026-05-23T10:00:00.000Z",
      placeText: "沖縄県 本部町",
      note: text,
      mediaCount: 1,
    },
    subjects: [
      {
        occurrence_id: "occ-test",
        subject_index: 0,
        scientific_name: text,
        vernacular_name: text,
        taxon_rank: "species",
        recommended_rank: "species",
        recommended_taxon_name: text,
        best_specific_taxon_name: text,
        simple_summary: "",
        diagnostic_features_seen: [],
        geographic_context: "",
        seasonal_context: "",
      },
    ],
  });
}

test("record reading cards generate grounded clover cards without action tone", () => {
  const drafts = draftsFor("シロツメクサ Trifolium repens");
  assert.equal(drafts.length, 3);
  for (const draft of drafts) {
    assert.ok(draft.sources.length >= 2);
    assert.ok(draft.body.length >= 80);
    assert.ok(draft.body.length <= 520);
    assert.doesNotMatch(draft.body, /次は|今度|撮る|行くなら|再訪|また行/u);
  }
  assert.ok(drafts.some((draft) => draft.axis === "environment"));
});

test("record reading cards keep Okinawan snail wording at group scope", () => {
  const drafts = draftsFor("オキナワヤマタカマイマイ属 Satsuma");
  assert.equal(drafts.length, 3);
  assert.equal(drafts[0]?.generationCondition.identityScope, "genus_or_group");
  const body = drafts.map((draft) => draft.body).join("\n");
  assert.match(body, /ヤマタカマイマイ類|沖縄の陸貝/u);
  assert.doesNotMatch(body, /この個体は.+種です/u);
});

test("record reading cards stay absent for ungrounded observations", () => {
  assert.equal(draftsFor("名前を確認中の対象").length, 0);
});
