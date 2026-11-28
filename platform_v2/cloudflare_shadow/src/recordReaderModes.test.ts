import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationFirstRecordDetail } from "./cloudflareObservationReadModel";
import { FIELD_CARD_PROMPT, FIELD_CARD_QUESTION } from "./fieldCard";
import { renderObservationFirstRecordDetailHtml } from "./observationFirstRecordDetailHtml";
import {
  RECORD_READER_MODES_FLAG,
  recordReaderModeCopy,
  renderRecordReaderModesHtml,
  renderRecordReaderModesScript,
  resolveRecordReaderGroup,
} from "./recordReaderModes";

const baseDetail = (overrides: Partial<ObservationFirstRecordDetail> = {}): ObservationFirstRecordDetail => ({
  schema: "ikimon.observation-first-record-detail/v1",
  recordId: "visit-rm-1",
  owner: false,
  visibility: "public",
  observationCount: 1,
  proposalPolicy: { identification: true, media: true, disabledReason: null },
  observations: [
    {
      observationId: "obs-rm-1",
      state: "active",
      subjectType: "organism",
      subjectLabel: "ナミアゲハ",
      assertionStatus: "human_asserted",
      verificationStatus: "owner_confirmed",
      acceptedIdentification: {
        claimId: "claim-1",
        actorType: "owner",
        actorId: "user-1",
        proposalActorType: "owner",
        proposedName: "ナミアゲハ",
        proposedScientificName: "Papilio xuthus",
        proposedRank: "species",
        humanDecision: true,
      },
      communityIdentifications: [],
      aiSuggestions: [],
      media: [{ mediaId: "asset-1", mediaKind: "photo", displayOrder: 0 }],
      provenance: { owner: true, ai: false, community: false, curator: false, imported: false },
    },
  ],
  privacy: { exactLocationExposed: false, publicLocationLabel: "位置情報は公開範囲に合わせて保護されています" },
  ...overrides,
});

test("recordReaderModeCopy shares copy with fieldCard.ts", () => {
  assert.equal(RECORD_READER_MODES_FLAG, "RECORD_READER_MODES_ENABLED");
  assert.deepEqual(recordReaderModeCopy("generic"), {
    childLabel: "こども",
    parentLabel: "おや",
    childQuestion: "どんな色やもようが見える？",
    parentPrompt: "気づいたところを指さしてもらおう",
  });
  for (const group of ["insect", "plant", "bird", "generic"] as const) {
    const copy = recordReaderModeCopy(group);
    assert.equal(copy.childQuestion, FIELD_CARD_QUESTION[group]);
    assert.equal(copy.parentPrompt, FIELD_CARD_PROMPT[group]);
  }
});

test("resolveRecordReaderGroup maps names and taxonomy to insect/plant/bird or generic", () => {
  assert.equal(resolveRecordReaderGroup({ taxonName: "ナミアゲハ" }), "insect");
  assert.equal(resolveRecordReaderGroup({ taxonName: "ツバメ" }), "bird");
  assert.equal(resolveRecordReaderGroup({ taxonName: "ソメイヨシノ" }), "plant");
  assert.equal(resolveRecordReaderGroup({ taxonName: "不明" }), "generic");
  assert.equal(resolveRecordReaderGroup({ taxonOrder: "Lepidoptera" }), "insect");
  assert.equal(resolveRecordReaderGroup({ taxonClass: "Aves" }), "bird");
  assert.equal(resolveRecordReaderGroup({ taxonKingdom: "Plantae" }), "plant");
});

test("renderRecordReaderModesHtml renders nothing when disabled, and omits species heading when unconfirmed", () => {
  assert.equal(renderRecordReaderModesHtml({ enabled: false, group: "insect", speciesHeading: "ナミアゲハ" }), "");

  assert.equal(renderRecordReaderModesHtml({ enabled: true, group: "insect", speciesHeading: "ナミアゲハ" }), "");
  assert.equal(renderRecordReaderModesHtml({ enabled: true, group: "generic", speciesHeading: null }), "");
});

test("renderRecordReaderModesScript is empty now that tabs are removed", () => {
  assert.equal(renderRecordReaderModesScript(true), "");
  assert.equal(renderRecordReaderModesScript(false), "");
});

test("renderObservationFirstRecordDetailHtml toggles reader modes behind flag while preserving certainty and blurred location", () => {
  const basePresentation = {
    lang: "ja" as const,
    title: "ナミアゲハ",
    titleIsFallback: false,
    titleStatus: "confirmed" as const,
    observedLabel: "2026年6月10日",
    note: null,
    media: [{ mediaId: "a1", mediaKind: "photo" as const, url: "/derived/1.jpg" }],
    actionNonce: "nonce-1",
  };

  const offHtml = renderObservationFirstRecordDetailHtml(baseDetail(), basePresentation);
  assert.ok(!offHtml.includes("data-record-reader-modes"));

  const onHtml = renderObservationFirstRecordDetailHtml(baseDetail(), {
    ...basePresentation,
    recordReaderModes: true,
  });
  assert.ok(!onHtml.includes("data-record-reader-modes"));
  assert.ok(!onHtml.includes("足は何本見える？もようはある？"));
  const guideHtml = renderObservationFirstRecordDetailHtml(baseDetail(), { ...basePresentation, recordReaderModes: true, observationGuide: "翅のもようを見てみてください。" });
  assert.match(guideHtml, /data-observation-guide/);
  assert.match(guideHtml, /翅のもようを見てみてください。/);
  assert.ok(!onHtml.includes("data-reader-mode-tab"));
  assert.ok(!onHtml.includes("tablist"));
  assert.match(onHtml, /data-location-blur/);
  assert.match(onHtml, /of-found-status is-confirmed/);

  const pendingHtml = renderObservationFirstRecordDetailHtml(
    baseDetail({
      observations: [
        {
          observationId: "obs-rm-pending",
          state: "active",
          subjectType: "unknown_subject",
          subjectLabel: "候補",
          assertionStatus: "ai_suggested",
          verificationStatus: "unverified",
          acceptedIdentification: null,
          communityIdentifications: [{ claimId: "c1", actorType: "community_member", proposedName: "アゲハ", proposedScientificName: null, proposedRank: "genus", stance: "support", accepted: false }],
          aiSuggestions: [],
          media: [{ mediaId: "asset-1", mediaKind: "photo", displayOrder: 0 }],
          provenance: { owner: false, ai: false, community: true, curator: false, imported: false },
        },
      ],
    }),
    {
      ...basePresentation,
      title: "生きものの記録",
      titleIsFallback: true,
      titleStatus: "proposed",
      recordReaderModes: true,
    },
  );
  assert.ok(!pendingHtml.includes("data-record-reader-modes"));
  assert.match(pendingHtml, /data-location-blur/);
  assert.match(pendingHtml, /of-found-status is-proposed/);
});
