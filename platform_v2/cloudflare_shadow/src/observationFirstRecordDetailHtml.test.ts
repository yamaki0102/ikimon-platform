import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationFirstRecordDetail } from "./cloudflareObservationReadModel";
import { renderObservationFirstRecordDetailHtml } from "./observationFirstRecordDetailHtml";

const detail: ObservationFirstRecordDetail = {
  schema: "ikimon.observation-first-record-detail/v1",
  recordId: "visit-ui-contract",
  owner: true,
  visibility: "public",
  observationCount: 2,
  proposalPolicy: { identification: true, media: true, disabledReason: null },
  observations: [
    {
      observationId: "obs-owner",
      state: "active",
      subjectType: "organism",
      subjectLabel: "アゲハチョウ<script>alert(1)</script>",
      assertionStatus: "human_asserted",
      verificationStatus: "owner_confirmed",
      acceptedIdentification: null,
      communityIdentifications: [{ claimId: "claim-community", actorType: "community_member", proposedName: "ナミアゲハ", proposedScientificName: "Papilio xuthus", proposedRank: "species", stance: "support", accepted: false }],
      aiSuggestions: [{ suggestionId: "ai-1", proposedName: "ナミアゲハ", proposedScientificName: null, proposedRank: null, visualEvidence: ["後ろの翅に尾のような突起があります"], shootingAdvice: ["翅の表側も写すと比べやすくなります"], provisional: true }],
      media: [{ mediaId: "asset-1", mediaKind: "photo", displayOrder: 0 }],
      provenance: { owner: true, ai: true, community: false, curator: false, imported: true },
    },
    {
      observationId: "obs-group",
      state: "excluded",
      subjectType: "group",
      subjectLabel: "複数の生きもの",
      assertionStatus: "human_asserted",
      verificationStatus: "unverified",
      acceptedIdentification: null,
      communityIdentifications: [],
      aiSuggestions: [],
      media: [],
      provenance: { owner: true, ai: false, community: false, curator: false, imported: false },
    },
  ],
  privacy: { exactLocationExposed: false, publicLocationLabel: "位置情報は公開範囲に合わせて保護されています" },
};

test("owner HTML is media-first, no-JS, privacy-safe, and gives every action its own idempotency key", () => {
  const rendered = renderObservationFirstRecordDetailHtml(detail, {
    title: "庭の観察",
    observedLabel: "2026年7月22日 18:00",
    note: "葉の上で休んでいた",
    media: [{ mediaId: "asset-1", mediaKind: "photo", url: "https://media.example/safe.jpg" }],
    publicLocationLabel: "浜松市周辺",
    environment: { place_type: "grassland_urban_edge", contact_surface: "plant", human_change: "mowing", place_type_source: "derived", environment_record_status: "auto_draft" },
    related: [{ recordId: "related-safe", title: "近くのアゲハ", observedLabel: "2026年7月20日", photoUrl: "https://media.example/related.jpg" }],
    canonicalUrl: "https://ikimon.life/ja/observations/visit-ui-contract",
    actionNonce: "nonce-contract",
    processingMessage: "写真を表示できるよう整えています。",
    notice: "変更を記録しました。",
    viewerAuthenticated: true,
  });

  assert.match(rendered, /data-observation-first-record-detail="1"/);
  assert.ok(rendered.indexOf("of-media-stage") < rendered.indexOf("of-record-info"));
  assert.equal((rendered.match(/<img[^>]+https:\/\/media\.example\/safe\.jpg/g) ?? []).length, 1);
  assert.match(rendered, /この記録で見つかったもの|AIが見つけたもの/);
  assert.match(rendered, /<details class="of-manage"/);
  assert.match(rendered, /<summary[^>]*>記録を詳しくする<\/summary>/);
  assert.match(rendered, /<summary[^>]*>名前を提案する<\/summary>/);
  assert.match(rendered, /見分けるポイント/);
  assert.match(rendered, /この場所のようす/);
  assert.match(rendered, /草地と市街地の境界のようです/);
  assert.match(rendered, /つながる記録/);
  assert.match(rendered, /浜松市周辺/);
  assert.match(rendered, /写真を表示できるよう整えています/);
  assert.match(rendered, /変更を記録しました/);
  assert.doesNotMatch(rendered, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(rendered, /<script\b/i);
  assert.doesNotMatch(rendered, /latitude|longitude|exact_location|みんなに聞く|提案募集中|確認0件|観察記録|件の対象|名前は未決定|同定の履歴|人から記録された同定候補はまだありません|割り当てられたメディアはありません/i);

  const operationIds = [...rendered.matchAll(/name="operation_id" value="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(operationIds.length >= 7);
  assert.equal(new Set(operationIds).size, operationIds.length);
  assert.ok(operationIds.includes("nonce-contract-0-split"));
  assert.ok(operationIds.includes("nonce-contract-0-identify"));
  assert.ok(operationIds.includes("nonce-contract-1-restore"));
  assert.ok(operationIds.includes("nonce-contract-0-accept-0"));
  assert.ok(operationIds.includes("nonce-contract-add"));
  assert.ok(operationIds.includes("nonce-contract-policy-off"));
});

test("guest HTML omits owner management and keeps proposals on demand", () => {
  const rendered = renderObservationFirstRecordDetailHtml({ ...detail, owner: false }, {
    title: "公開記録",
    observedLabel: "観察日時は未設定です",
    note: null,
    media: [{ mediaId: "asset-1", mediaKind: "photo", url: "https://media.example/photo.jpg?lat=35.123456&lng=138.123456" }],
    actionNonce: "nonce-guest",
    viewerAuthenticated: false,
  });
  assert.doesNotMatch(rendered, /記録を詳しくする|写真を対象へ割り当てる|別の対象として分ける|別の対象とまとめる/);
  assert.doesNotMatch(rendered, /name="action" value="identify"/);
  assert.match(rendered, /ログインして名前を提案する/);
  assert.match(rendered, /a,button,input,select,textarea,summary\{min-height:44px/);
  assert.doesNotMatch(rendered, /35\.123456|138\.123456|[?&]lat=/);
});

test("owner identification remains available when external proposals are off", () => {
  const rendered = renderObservationFirstRecordDetailHtml({ ...detail, proposalPolicy: { identification: false, media: false, disabledReason: "record_policy" } }, {
    title: "非公開募集の記録",
    observedLabel: "観察日時は未設定です",
    note: null,
    media: [],
    actionNonce: "nonce-policy",
    viewerAuthenticated: true,
  });
  assert.match(rendered, /name="action" value="identify"/);
  assert.match(rendered, /名前の提案を受け付ける/);
});

test("all supported languages render localized viewer copy", () => {
  const expectations = {
    ja: "AIが見つけたもの",
    en: "What AI found",
    es: "Lo que encontró la IA",
    "pt-br": "O que a IA encontrou",
  } as const;
  for (const [lang, expected] of Object.entries(expectations)) {
    const rendered = renderObservationFirstRecordDetailHtml({ ...detail, owner: false }, {
      lang: lang as keyof typeof expectations,
      title: "Papilio xuthus",
      observedLabel: "2026-07-22",
      note: null,
      media: [{ mediaId: "asset-1", mediaKind: "photo", url: "https://media.example/photo.jpg" }],
      actionNonce: `nonce-${lang}`,
      viewerAuthenticated: false,
    });
    assert.match(rendered, new RegExp(expected));
    assert.match(rendered, new RegExp(`<html lang="${lang}"`));
  }
});

test("zero observations remains a normal media record without empty-state management copy", () => {
  const rendered = renderObservationFirstRecordDetailHtml({ ...detail, owner: false, observationCount: 0, observations: [] }, {
    title: "夕方の空",
    observedLabel: "2026年7月22日 18:30",
    note: null,
    media: [
      { mediaId: "photo-only", mediaKind: "photo", url: "https://media.example/sky.jpg" },
      { mediaId: "sound-only", mediaKind: "audio", url: "https://media.example/birds.m4a" },
    ],
    actionNonce: "nonce-zero",
    viewerAuthenticated: false,
  });
  assert.match(rendered, /夕方の空/);
  assert.match(rendered, /<img[^>]+sky\.jpg/);
  assert.match(rendered, /<audio controls/);
  assert.doesNotMatch(rendered, /<section class="of-summary"|対象はまだ分けられていません|名前は未決定|0件/);
});

test("multiple observations expose at most three summary rows and keep every detail collapsed", () => {
  const observations = Array.from({ length: 5 }, (_, index) => ({
    ...detail.observations[0]!,
    observationId: `obs-${index}`,
    subjectLabel: `対象名 ${index + 1}`,
    acceptedIdentification: { claimId: `accepted-${index}`, actorType: "owner" as const, actorId: "owner", proposalActorType: "owner" as const, proposedName: `生きもの ${index + 1}`, proposedScientificName: null, proposedRank: null, humanDecision: true as const },
    communityIdentifications: [],
    aiSuggestions: [],
  }));
  const rendered = renderObservationFirstRecordDetailHtml({ ...detail, owner: false, observationCount: observations.length, observations }, {
    title: "林の記録",
    observedLabel: "2026年7月22日",
    note: null,
    media: [{ mediaId: "shared", mediaKind: "video", url: "https://media.example/forest.mp4" }],
    actionNonce: "nonce-many",
    viewerAuthenticated: true,
  });
  const summary = rendered.match(/<ul class="of-summary-list">([\s\S]*?)<\/ul>/)?.[1] ?? "";
  assert.equal((summary.match(/<li/g) ?? []).length, 3);
  assert.equal((rendered.match(/<article class="of-observation-detail">/g) ?? []).length, 5);
  assert.match(rendered, /<summary>すべて見る<\/summary>/);
  assert.equal((rendered.match(/<video controls/g) ?? []).length, 1);
});
