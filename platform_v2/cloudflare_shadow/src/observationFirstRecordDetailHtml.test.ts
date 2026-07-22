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
      aiSuggestions: [{ suggestionId: "ai-1", proposedName: "ナミアゲハ", proposedScientificName: null, proposedRank: null, provisional: true }],
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

test("owner HTML is no-JS, privacy-safe, and gives every action its own idempotency key", () => {
  const rendered = renderObservationFirstRecordDetailHtml(detail, {
    title: "庭の観察",
    observedLabel: "2026年7月22日 18:00",
    note: "葉の上で休んでいた",
    media: [{ mediaId: "asset-1", mediaKind: "photo", url: "https://media.example/safe.jpg" }],
    actionNonce: "nonce-contract",
    processingMessage: "写真を表示できるよう整えています。",
    notice: "変更を記録しました。",
    viewerAuthenticated: true,
  });

  assert.match(rendered, /data-observation-first-record-detail="1"/);
  assert.match(rendered, /2件の対象/);
  assert.match(rendered, /AIによる暫定候補・人の判断ではありません/);
  assert.match(rendered, /候補の追加だけでは採用されません/);
  assert.match(rendered, /位置情報は公開範囲に合わせて保護されています/);
  assert.match(rendered, /写真を表示できるよう整えています/);
  assert.match(rendered, /変更を記録しました/);
  assert.doesNotMatch(rendered, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(rendered, /<script\b/i);
  assert.doesNotMatch(rendered, /latitude|longitude|exact_location|みんなに聞く|提案募集中|確認0件/i);

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

test("guest HTML omits owner lifecycle and media reassignment controls", () => {
  const rendered = renderObservationFirstRecordDetailHtml({ ...detail, owner: false }, {
    title: "公開記録",
    observedLabel: "観察日時は未設定です",
    note: null,
    media: [{ mediaId: "asset-1", mediaKind: "photo", url: "https://media.example/photo.jpg?lat=35.123456&lng=138.123456" }],
    actionNonce: "nonce-guest",
    viewerAuthenticated: false,
  });
  assert.doesNotMatch(rendered, /この対象を編集|メディアの割り当て|対象を分ける|対象を統合/);
  assert.doesNotMatch(rendered, /name="action" value="identify"/);
  assert.match(rendered, /ログインして同定候補を記録/);
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
  assert.match(rendered, /外部からの同定候補を受け付ける/);
});
