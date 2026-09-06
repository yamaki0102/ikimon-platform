import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationFirstRecordDetail } from "./cloudflareObservationReadModel";
import { isObservationDetectionEvidence, renderObservationFirstRecordDetailHtml, resolveObservationFirstDetectionState } from "./observationFirstRecordDetailHtml";

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

test("detection presentation is derived only from durable assessment facts", () => {
  assert.equal(resolveObservationFirstDetectionState(1, null, null), "detected");
  assert.equal(resolveObservationFirstDetectionState(1, "completed_no_candidate", "completed"), "not_detected");
  assert.equal(resolveObservationFirstDetectionState(1, "completed_not_assessable", "completed"), "not_assessable");
  assert.equal(resolveObservationFirstDetectionState(0, "completed_no_candidate", "completed"), "not_detected");
  assert.equal(resolveObservationFirstDetectionState(0, "completed_not_assessable", "completed"), "not_assessable");
  assert.equal(resolveObservationFirstDetectionState(0, null, "failed"), "not_assessable");
  assert.equal(resolveObservationFirstDetectionState(0, null, "pending"), null);
  assert.equal(resolveObservationFirstDetectionState(0, null, null), null);
});

test("generic imported placeholders do not override a durable no-biota result", () => {
  const placeholder: ObservationFirstRecordDetail["observations"][number] = {
    observationId: "placeholder",
    state: "active",
    subjectType: "unknown_subject",
    subjectLabel: "写っているもの",
    assertionStatus: "provisional",
    verificationStatus: "unreviewed",
    acceptedIdentification: null,
    communityIdentifications: [],
    aiSuggestions: [],
    media: [],
    provenance: { owner: false, ai: false, community: false, curator: false, imported: true },
  };
  assert.equal(isObservationDetectionEvidence(placeholder), false);
  assert.equal(resolveObservationFirstDetectionState([placeholder].filter(isObservationDetectionEvidence).length, "completed_no_candidate", "completed"), "not_detected");
  assert.equal(isObservationDetectionEvidence(detail.observations[0]!), true);
});

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
    aiFeedback: "主対象と環境の要素が確認できました。",
    aiNextPhoto: "頭部とくちばしの詳細がわかる角度から撮影してください。",
    mediaDedup: { sourcePhotoCount: 2, representativePhotoCount: 1, excludedPhotoCount: 1 },
    aiCandidateInsights: [
      {
        name: "ナミアゲハ",
        scientificName: "Papilio xuthus",
        supportingFeatures: ["後翅に尾状突起が見えます"],
        missingFeatures: ["翅の表側は確認できません"],
        contradictions: [],
      },
      {
        name: "キアゲハ",
        scientificName: "Papilio machaon",
        supportingFeatures: ["大きなアゲハ類の体形です"],
        missingFeatures: [],
        contradictions: ["前翅の模様は一致を確認できません"],
      },
    ],
    notice: "変更を記録しました。",
    viewerAuthenticated: true,
  });

  assert.match(rendered, /data-observation-first-record-detail="1"/);
  assert.match(rendered, /<title>庭の観察 \| ZUKAN<\/title>/);
  assert.ok(rendered.indexOf("of-media-stage") < rendered.indexOf("of-record-info"));
  assert.equal((rendered.match(/<img[^>]+https:\/\/media\.example\/safe\.jpg/g) ?? []).length, 1);
  assert.match(rendered, /この記録で見つかったもの|AIが見つけたもの/);
  assert.match(rendered, /<details class="of-manage"/);
  assert.match(rendered, /<summary[^>]*>記録に情報を追加<\/summary>/);
  assert.match(rendered, /name="action" value="set_visibility"/);
  assert.match(rendered, /name="visibility"[\s\S]*<option value="public" selected>公開<\/option>/);
  assert.match(rendered, /公開範囲を保存/);
  assert.match(rendered, /見つけた生きものや、環境、気づき、写真の整理を追加できます/);
  assert.match(rendered, /<summary[^>]*>名前を提案する<\/summary>/);
  assert.match(rendered, /見分けるポイント/);
  assert.match(rendered, /この場所のようす/);
  assert.match(rendered, /草地と市街地の境界のようです/);
  assert.match(rendered, /つながる記録/);
  assert.match(rendered, /浜松市周辺/);
  assert.match(rendered, /写真を表示できるよう整えています/);
  assert.match(rendered, /主対象と環境の要素が確認できました/);
  assert.match(rendered, /頭部とくちばしの詳細がわかる角度から撮影してください/);
  assert.match(rendered, /似た写真1枚は1枚にまとめて表示しています/);
  assert.match(rendered, /似ている候補との比較/);
  assert.match(rendered, /ナミアゲハ/);
  assert.match(rendered, /キアゲハ/);
  assert.match(rendered, /後翅に尾状突起が見えます/);
  assert.doesNotMatch(rendered, /confidence|0\.91/);
  assert.match(rendered, /変更を記録しました/);
  assert.doesNotMatch(rendered, /<script>alert\(1\)<\/script>/);
  assert.match(rendered, /data-owner-delete-script/);
  assert.match(rendered, /data-delete-endpoint="\/api\/v1\/observations\//);
  assert.match(rendered, /href="#of-manage-body"/);
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
  assert.ok(operationIds.includes("nonce-contract-visibility-public"));
});

test("owner processing panel is retained with the page CSP nonce", () => {
  const rendered = renderObservationFirstRecordDetailHtml(detail, {
    title: "庭の観察",
    observedLabel: "2026年7月22日 18:00",
    note: null,
    media: [],
    actionNonce: "nonce-processing",
    processingStatusPanel: '<section data-observation-processing-status><button data-observation-reassess>AIで再確認</button><script nonce="page-csp-nonce" data-observation-reassess-script>window.testReassess=true;</script></section>',
  });
  assert.match(rendered, /data-observation-processing-status/);
  assert.match(rendered, /<button data-observation-reassess>AIで再確認<\/button>/);
  assert.match(rendered, /<script nonce="page-csp-nonce" data-observation-reassess-script>/);
});

test("guest HTML omits owner management and keeps proposals on demand", () => {
  const rendered = renderObservationFirstRecordDetailHtml({ ...detail, owner: false }, {
    title: "公開記録",
    observedLabel: "観察日時は未設定です",
    note: null,
    media: [{ mediaId: "asset-1", mediaKind: "photo", url: "https://media.example/photo.jpg?lat=35.123456&lng=138.123456" }],
    mediaDedup: { sourcePhotoCount: 2, representativePhotoCount: 1, excludedPhotoCount: 1 },
    actionNonce: "nonce-guest",
    viewerAuthenticated: false,
  });
  assert.doesNotMatch(rendered, /記録に情報を追加|写真を対象へ割り当てる|別の対象として分ける|別の対象とまとめる/);
  assert.doesNotMatch(rendered, /name="action" value="identify"/);
  assert.match(rendered, /ログインして名前を提案する/);
  assert.match(rendered, /a,button,input,select,textarea,summary\{min-height:44px/);
  assert.doesNotMatch(rendered, /35\.123456|138\.123456|[?&]lat=/);
  assert.doesNotMatch(rendered, /data-media-dedup-notice|similar photos|似た写真/);
});

test("accepted human identification suppresses the provisional AI comparison", () => {
  const acceptedDetail: ObservationFirstRecordDetail = {
    ...detail,
    observations: [{
      ...detail.observations[0]!,
      acceptedIdentification: {
        claimId: "accepted-human",
        actorType: "owner",
        actorId: "owner-1",
        proposalActorType: "community_member",
        proposedName: "ナミアゲハ",
        proposedScientificName: "Papilio xuthus",
        proposedRank: "species",
        humanDecision: true,
      },
    }],
  };
  const rendered = renderObservationFirstRecordDetailHtml(acceptedDetail, {
    title: "人が確認した記録",
    observedLabel: "2026年7月23日",
    note: null,
    media: [],
    aiCandidateInsights: [{
      name: "キアゲハ",
      scientificName: "Papilio machaon",
      supportingFeatures: ["AIだけの候補"],
      missingFeatures: [],
      contradictions: [],
    }],
    actionNonce: "nonce-accepted-human",
    viewerAuthenticated: true,
  });

  assert.match(rendered, /ナミアゲハ/);
  assert.doesNotMatch(rendered, /似ている候補との比較|AIだけの候補/);
});

test("related records without a photo use the full card width", () => {
  const rendered = renderObservationFirstRecordDetailHtml({ ...detail, owner: false }, {
    title: "関連記録の表示",
    observedLabel: "2026年7月23日",
    note: null,
    media: [],
    related: [{ recordId: "related-without-photo", title: "同じ季節の記録", observedLabel: "2026年7月20日", photoUrl: null }],
    actionNonce: "nonce-related-no-photo",
    viewerAuthenticated: false,
  });

  assert.match(rendered, /class="of-related-card has-no-photo"/);
  assert.match(rendered, /\.of-related-card\.has-no-photo\{grid-template-columns:minmax\(0,1fr\)\}/);
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
    ja: "この記録で見つかったもの",
    en: "Found in this record",
    es: "Encontrado en este registro",
    "pt-br": "Encontrado neste registro",
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

test("legacy unidentified sentinel is never exposed and uses a localized natural label", () => {
  const expectations = {
    ja: "写っているもの",
    en: "Something visible",
    es: "Algo visible",
    "pt-br": "Algo visível",
  } as const;
  const observations = [{
    ...detail.observations[0]!,
    subjectType: "unknown_subject" as const,
    subjectLabel: " unidentified ",
    acceptedIdentification: {
      claimId: "accepted-placeholder",
      actorType: "owner" as const,
      actorId: "owner",
      proposalActorType: "owner" as const,
      proposedName: "unidentified",
      proposedScientificName: null,
      proposedRank: null,
      humanDecision: true as const,
    },
    communityIdentifications: [{
      claimId: "community-placeholder",
      actorType: "community_member" as const,
      proposedName: "unknown_subject",
      proposedScientificName: null,
      proposedRank: null,
      stance: "support",
      accepted: false,
    }],
    aiSuggestions: [{
      suggestionId: "ai-placeholder",
      proposedName: "unclassified",
      proposedScientificName: null,
      proposedRank: null,
      visualEvidence: [],
      shootingAdvice: [],
      provisional: true as const,
    }],
  }];

  for (const [lang, expected] of Object.entries(expectations)) {
    const rendered = renderObservationFirstRecordDetailHtml({
      ...detail,
      owner: false,
      observationCount: 1,
      observations,
    }, {
      lang: lang as keyof typeof expectations,
      title: "Landscape record",
      observedLabel: "2026-07-23",
      note: null,
      media: [{ mediaId: "photo", mediaKind: "photo", url: "https://media.example/photo.jpg" }],
      actionNonce: `nonce-unidentified-${lang}`,
      viewerAuthenticated: false,
    });

    assert.match(rendered, new RegExp(expected));
    assert.doesNotMatch(rendered, /unidentified|unknown_subject|unclassified/i);
    if (lang === "ja") assert.doesNotMatch(rendered, /名前の提案があります/);
  }
});

test("scene and non-detection copy is localized in every supported language", () => {
  const expectations = {
    ja: ["この写真から見つかったもの", "この写真では、生きものの姿は見つかりませんでした"],
    en: ["Found in this photo", "No organism was visible in this photo"],
    es: ["Encontrado en esta foto", "En esta foto no se encontró la figura de ningún ser vivo"],
    "pt-br": ["Encontrado nesta foto", "Nesta foto, não foi possível encontrar a figura de um ser vivo"],
  } as const;
  for (const [lang, expected] of Object.entries(expectations)) {
    const rendered = renderObservationFirstRecordDetailHtml({ ...detail, owner: false, observationCount: 0, observations: [] }, {
      lang: lang as keyof typeof expectations,
      title: "River scene",
      observedLabel: "2026-07-22",
      note: null,
      detectionState: "not_detected",
      sceneElements: ["water"],
      media: [{ mediaId: "scene", mediaKind: "photo", url: "https://media.example/scene.jpg" }],
      actionNonce: `nonce-scene-${lang}`,
      viewerAuthenticated: false,
    });
    assert.match(rendered, new RegExp(expected[0]));
    assert.match(rendered, new RegExp(expected[1]));
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

test("a completed scene analysis without a biological candidate remains a useful landscape record", () => {
  const rendered = renderObservationFirstRecordDetailHtml({ ...detail, owner: false, observationCount: 0, observations: [] }, {
    title: "川沿いの夕景",
    observedLabel: "2026年7月19日 18:42",
    note: "水面が夕日に光っていた",
    publicLocationLabel: "静岡県浜松市",
    locationProtectionLabel: "位置はぼかして表示",
    detectionState: "not_detected",
    sceneElements: ["water", "low_grass", "built_surface"],
    media: [{ mediaId: "scene", mediaKind: "photo", url: "https://media.example/river.jpg" }],
    environment: {
      place_type: "water_edge",
      surrounding_cover: "low_grass",
      contact_surface: "artificial",
      human_change: "construction",
      place_type_source: "derived",
      surrounding_cover_source: "derived",
      contact_surface_source: "derived",
      human_change_source: "derived",
      environment_record_status: "auto_draft",
    },
    actionNonce: "nonce-scene",
    viewerAuthenticated: false,
  });

  assert.match(rendered, /この写真から見つかったもの/);
  assert.match(rendered, /水面/);
  assert.match(rendered, /低い草地/);
  assert.match(rendered, /舗装・構造物/);
  assert.match(rendered, /この写真では、生きものの姿は見つかりませんでした/);
  assert.match(rendered, /この場所のようす/);
  assert.match(rendered, /写真メモ/);
  assert.match(rendered, /位置はぼかして表示/);
  assert.doesNotMatch(rendered, /生きものなし|生きものはいない|不在|<section class="of-summary"/);
});

test("scene chips ignore non-derived environment fields and unknown internal codes", () => {
  const rendered = renderObservationFirstRecordDetailHtml({ ...detail, owner: false, observationCount: 0, observations: [] }, {
    title: "環境データ境界",
    observedLabel: "2026年7月19日",
    note: null,
    detectionState: "not_detected",
    media: [{ mediaId: "scene-boundary", mediaKind: "photo", url: "https://media.example/scene.jpg" }],
    environment: {
      place_type: "water_edge",
      place_type_source: "owner",
      surrounding_cover: "low_grass",
      surrounding_cover_source: "derived",
      contact_surface: "future_internal_code",
      contact_surface_source: "derived",
      environment_record_status: "auto_draft",
    },
    actionNonce: "nonce-scene-boundary",
    viewerAuthenticated: false,
  });

  assert.match(rendered, /低い草地/);
  assert.doesNotMatch(rendered, /水面/);
  assert.doesNotMatch(rendered, /future_internal_code/);
});

test("an unassessable photo never becomes an absence claim", () => {
  const rendered = renderObservationFirstRecordDetailHtml({ ...detail, owner: true, observationCount: 0, observations: [] }, {
    title: "暗い林",
    observedLabel: "2026年7月22日 21:30",
    note: null,
    detectionState: "not_assessable",
    sceneElements: ["trees_shrubs"],
    media: [{ mediaId: "dark", mediaKind: "photo", url: "https://media.example/dark.jpg" }],
    actionNonce: "nonce-unassessable",
    viewerAuthenticated: true,
  });

  assert.match(rendered, /この写真だけでは、生きものの姿を判断できませんでした/);
  assert.match(rendered, /樹木・低木/);
  assert.match(rendered, /記録に情報を追加/);
  assert.doesNotMatch(rendered, /見つかりませんでした|生きものなし|不在/);
});

test("comparison appears only with an evidence-backed presentation", () => {
  const basePresentation = {
    title: "河原の記録",
    observedLabel: "2026年7月22日",
    note: null,
    detectionState: "not_detected" as const,
    sceneElements: [] as string[],
    media: [{ mediaId: "river", mediaKind: "photo" as const, url: "https://media.example/river.jpg" }],
    actionNonce: "nonce-comparison",
    viewerAuthenticated: false,
  };
  const withoutComparison = renderObservationFirstRecordDetailHtml({ ...detail, owner: false, observationCount: 0, observations: [] }, basePresentation);
  const withComparison = renderObservationFirstRecordDetailHtml({ ...detail, owner: false, observationCount: 0, observations: [] }, {
    ...basePresentation,
    comparison: {
      summary: "前回より草がよく茂って見えます。",
      comparedRecordId: "previous-safe",
      comparedObservedLabel: "2026年7月12日",
    },
  });

  assert.doesNotMatch(withoutComparison, /前の記録との変化/);
  assert.match(withComparison, /前の記録との変化/);
  assert.match(withComparison, /前回より草がよく茂って見えます/);
  assert.match(withComparison, /2026年7月12日/);
  assert.doesNotMatch(withComparison, /latitude|longitude|geohash|public_cell/i);
});

test("detected records label learning and location protection without exposing internal state", () => {
  const rendered = renderObservationFirstRecordDetailHtml({ ...detail, owner: false }, {
    title: "庭のアゲハ",
    observedLabel: "2026年7月22日",
    note: null,
    publicLocationLabel: "浜松市周辺",
    locationProtectionLabel: "おおよその場所を表示",
    detectionState: "detected",
    sceneElements: [],
    media: [{ mediaId: "butterfly", mediaKind: "photo", url: "https://media.example/butterfly.jpg" }],
    actionNonce: "nonce-detected",
    viewerAuthenticated: false,
  });

  assert.match(rendered, /この記録で見つかったもの/);
  assert.match(rendered, /わかること/);
  assert.match(rendered, /おおよその場所を表示/);
  assert.doesNotMatch(rendered, /provisional|human_asserted|accepted identification|provenance|occurrence/i);
});

test("Japanese record detail suppresses English-only AI prose from reassessment", () => {
  const leakDetail: ObservationFirstRecordDetail = {
    ...detail,
    observations: detail.observations.map((card, index) => index === 0 ? {
      ...card,
      aiSuggestions: [{ ...card.aiSuggestions[0]!,
        visualEvidence: ["characteristic white and reddish-purple centered flowers and opposite leaves", "花の中心が赤紫色に見えます"],
        shootingAdvice: ["full root system details", "根系がわかる角度から撮影してください"],
      }],
    } : card),
  };
  const rendered = renderObservationFirstRecordDetailHtml(leakDetail, {
    lang: "ja", title: "ヘクソカズラ", observedLabel: "2026年9月2日", note: null, media: [], actionNonce: "nonce-ja-language",
    aiCandidateInsights: [{ name: "ヘクソカズラ", scientificName: "Paederia foetida",
      supportingFeatures: ["distinctive white-to-pinkish tubular flowers with dark red centers", "花冠の中心が赤紫色です"],
      missingFeatures: ["full root system details", "根系の詳細は確認できません"], contradictions: [],
    }],
    aiFeedback: "English feedback sentence", aiNextPhoto: "Take a closer photo of the roots",
  });
  assert.doesNotMatch(rendered, /characteristic white|distinctive white|full root system details|English feedback|Take a closer/);
  assert.match(rendered, /花の中心が赤紫色/);
  assert.match(rendered, /根系がわかる角度/);
  assert.match(rendered, /根系の詳細は確認できません/);
});

test("Japanese record detail suppresses mixed and short English AI prose", () => {
  const rendered = renderObservationFirstRecordDetailHtml(detail, {
    lang: "ja", title: "ヘクソカズラ", observedLabel: "2026年9月2日", note: null, media: [], actionNonce: "nonce-ja-short-english",
    aiCandidateInsights: [{ name: "ヘクソカズラ", scientificName: "Paederia foetida",
      supportingFeatures: ["白い flower が見えます", "赤紫色の花冠です"],
      missingFeatures: ["根の details", "根系は確認できません"], contradictions: [],
    }],
    aiFeedback: "観察の focus を保ってください", aiNextPhoto: "根元を撮影してください",
  });
  assert.doesNotMatch(rendered, /白い flower|根の details|観察の focus/);
  assert.match(rendered, /赤紫色の花冠です/);
  assert.match(rendered, /根系は確認できません/);
  assert.match(rendered, /根元を撮影してください/);
});
