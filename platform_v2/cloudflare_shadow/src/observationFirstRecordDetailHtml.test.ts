import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationFirstRecordDetail } from "./cloudflareObservationReadModel";
import type { OwnerPublicationReturn } from "../../src/services/publicationSyndication";
import { isObservationDetectionEvidence, renderObservationFirstRecordDetailHtml, resolveObservationFirstDetectionState } from "./observationFirstRecordDetailHtml";
import { resolveLiveSignboardTitle } from "./index";
import { publicObservationAiFeedback } from "./publicObservationAiPresentation";
import { recordsDiscoveryDetailHref } from "./recordsDiscoveryContext";

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

test("authenticated detail can carry the private Saved control without changing record meaning", () => {
  const rendered = renderObservationFirstRecordDetailHtml(detail, {
    title: "庭の観察",
    observedLabel: "2026年7月22日 18:00",
    note: null,
    media: [],
    actionNonce: "nonce-saved",
    viewerAuthenticated: true,
    savedControlHtml: '<button data-zukan-save aria-pressed="false"><span>保存</span></button>',
    savedScriptHtml: '<script>window.savedContinuityFixture = true;</script>',
  });
  assert.match(rendered, /data-zukan-save/);
  assert.match(rendered, /savedContinuityFixture/);
  assert.doesNotMatch(rendered, /予約|応募|参加の申込み/);
});

test("anonymous proposal sign-in returns to the same language, record and bounded discovery context", () => {
  const context = { view: "public" as const, query: '浜松 & café + "記録"' };
  for (const lang of ["ja", "en", "es", "pt-br"] as const) {
    const rendered = renderObservationFirstRecordDetailHtml({ ...detail, owner: false }, {
      lang, title: "庭の観察", observedLabel: "2026-10-01", note: null, media: [],
      actionNonce: "proposal-return", viewerAuthenticated: false, recordsDiscoveryContext: context,
    });
    const href = rendered.match(/class="of-login-proposal" href="([^"]+)"/)![1]!.replaceAll("&amp;", "&");
    const login = new URL(href, "https://zukan.earth");
    assert.equal(login.pathname, `/${lang}/login`);
    assert.equal(login.searchParams.get("redirect"), recordsDiscoveryDetailHref(detail.recordId, lang, context));
    assert.doesNotMatch(rendered.match(/href="(mailto:[^"]+)"/)![1]!, /records_view|records_q/u);
  }
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
    shareUrl: "https://ikimon.life/ja/observations/visit-ui-contract?from=line&utm_source=instagram",
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
  assert.match(rendered, /草地と市街地の境界/);
  assert.doesNotMatch(rendered, /草地と市街地の境界のようです|写真から読み取った候補です/);
  assert.match(rendered, /つながる記録/);
  assert.match(rendered, /浜松市周辺/);
  assert.match(rendered, /写真を表示できるよう整えています/);
  assert.doesNotMatch(rendered, /AIからの短いメモ|主対象と環境の要素が確認できました/);
  assert.match(rendered, /次に撮るとよい写真：頭部とくちばしの詳細/);
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
  assert.match(rendered, /body=https%3A%2F%2Fikimon.life%2Fja%2Fobservations%2Fvisit-ui-contract%3Ffrom%3Dline%26utm_source%3Dinstagram/);
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
    ja: ["この写真から見つかったもの", "この写真では、場所や周囲のようすが記録されています"],
    en: ["Found in this photo", "This photo records the place and its surroundings"],
    es: ["Encontrado en esta foto", "Esta foto registra el lugar y su entorno"],
    "pt-br": ["Encontrado nesta foto", "Esta foto registra o local e o seu entorno"],
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
  assert.match(rendered, /この写真では、場所や周囲のようすが記録されています/);
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

test("record detail labels an absent date as unknown in both summary and capture metadata", () => {
  const rendered = renderObservationFirstRecordDetailHtml({ ...detail, owner: false }, {
    title: "時点が未確認の記録",
    observedLabel: "",
    note: null,
    media: [],
    actionNonce: "nonce-unknown-date",
    viewerAuthenticated: false,
  });

  assert.match(rendered, /日時不明/);
  assert.doesNotMatch(rendered, /1970/);
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

test("owner publication return distinguishes Review, eligible destination, and confirmed publication", () => {
  const publicationReturn: OwnerPublicationReturn = {
    schema_version: "zukan.publication-return/v1",
    review: { state: "approved", source: "human_review", decidedAt: "2026-09-14T12:00:00.000Z" },
    publication: {
      state: "eligible",
      exclusionCode: null,
      destinations: [{
        feedKey: "miyakoda-renri-area",
        label: "浜松・都田",
        sourceVersion: "public-feed-v1",
        sourceEnvironment: "production",
        readOnly: true,
        status: "eligible",
        exclusionCode: null,
      }],
    },
  };
  const rendered = renderObservationFirstRecordDetailHtml(detail, {
    title: "公開戻り値の記録",
    observedLabel: "2026年9月15日",
    note: null,
    media: [],
    publicationReturn,
    actionNonce: "nonce-publication-return",
    viewerAuthenticated: true,
  });
  assert.match(rendered, /data-publication-return="owner-only"/);
  assert.match(rendered, /公開の戻り値/);
  assert.match(rendered, /人によるReview/);
  assert.match(rendered, /Review済み・承認/);
  assert.match(rendered, /公開の権利条件を確認済み（公開先の掲載は未確認）/);
  assert.match(rendered, /公開先は設定済み（この記録の掲載は未確認）/);
  assert.match(rendered, /浜松・都田/);
  assert.match(rendered, /production Feed（読み取り専用）/);
  assert.match(rendered, /ポリシー版: public-feed-v1/);
  assert.doesNotMatch(rendered, /公開確認済み/);

  const published = renderObservationFirstRecordDetailHtml(detail, {
    title: "公開確認済みの記録",
    observedLabel: "2026年9月15日",
    note: null,
    media: [],
    publicationReturn: {
      ...publicationReturn,
      publication: {
        ...publicationReturn.publication,
        state: "published",
        destinations: [{ ...publicationReturn.publication.destinations[0]!, status: "published" }],
      },
    },
    actionNonce: "nonce-publication-published",
    viewerAuthenticated: true,
  });
  assert.match(published, /公開確認済み/);
});

test("owner publication destination uses a localized place label", () => {
  const publicationReturn: OwnerPublicationReturn = {
    schema_version: "zukan.publication-return/v1",
    review: { state: "not_reviewed", source: "none", decidedAt: null },
    publication: {
      state: "not_ready",
      exclusionCode: "review_not_approved",
      destinations: [{
        feedKey: "miyakoda-renri-area",
        label: "浜松・都田",
        sourceVersion: "public-feed-v1",
        sourceEnvironment: "production",
        readOnly: true,
        status: "excluded",
        exclusionCode: "review_not_approved",
      }],
    },
  };

  for (const lang of ["en", "es", "pt-br"] as const) {
    const rendered = renderObservationFirstRecordDetailHtml(detail, {
      lang,
      title: "Public record",
      observedLabel: "September 15, 2026",
      note: null,
      media: [],
      publicationReturn,
      actionNonce: `nonce-publication-${lang}`,
      viewerAuthenticated: true,
    });
    assert.match(rendered, /Miyakoda, Hamamatsu/);
    assert.doesNotMatch(rendered, /浜松・都田/);
  }
});

test("publication exclusion is owner-only and uses a safe localized reason", () => {
  const publicationReturn: OwnerPublicationReturn = {
    schema_version: "zukan.publication-return/v1",
    review: { state: "approved", source: "human_review", decidedAt: "2026-09-14T12:00:00.000Z" },
    publication: {
      state: "excluded",
      exclusionCode: "guardian_authority_unresolved",
      destinations: [{
        feedKey: "miyakoda-renri-area",
        label: "浜松・都田",
        sourceVersion: "public-feed-v1",
        sourceEnvironment: "production",
        readOnly: true,
        status: "excluded",
        exclusionCode: "guardian_authority_unresolved",
      }],
    },
  };
  const owner = renderObservationFirstRecordDetailHtml(detail, {
    title: "保護者確認待ち",
    observedLabel: "2026年9月15日",
    note: null,
    media: [],
    publicationReturn,
    actionNonce: "nonce-publication-excluded",
    viewerAuthenticated: true,
  });
  assert.match(owner, /公開対象外/);
  assert.match(owner, /保護者権限を確認できません/);
  assert.doesNotMatch(owner, /guardian_authority_unresolved/);

  const guest = renderObservationFirstRecordDetailHtml({ ...detail, owner: false }, {
    title: "公開記録",
    observedLabel: "2026年9月15日",
    note: null,
    media: [],
    publicationReturn,
    actionNonce: "nonce-publication-guest",
    viewerAuthenticated: false,
  });
  assert.doesNotMatch(guest, /data-publication-return|保護者権限を確認できません|miyakoda-renri-area/);
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

test("candidate comparison shows measured likelihood and how to tell lookalikes apart", () => {
  const rendered = renderObservationFirstRecordDetailHtml(detail, {
    lang: "ja", title: "カラス", observedLabel: "2026年11月23日", note: null, media: [], actionNonce: "nonce-likely",
    aiCandidateInsights: [
      { name: "ハシブトガラス", scientificName: "Corvus macrorhynchos", supportingFeatures: ["嘴: 太い"], missingFeatures: [], contradictions: [], probability: 0.93, howToTell: "嘴が太く額が盛り上がる" },
      { name: "ハシボソガラス", scientificName: "Corvus corone", supportingFeatures: [], missingFeatures: [], contradictions: ["嘴: 細め（写っていない）"], probability: 0.05 },
      { name: "ミヤマガラス", scientificName: "Corvus frugilegus", supportingFeatures: ["嘴の根元"], missingFeatures: [], contradictions: [] },
    ],
  });
  assert.match(rendered, /<em class="of-likely" data-likely="high">可能性 高<\/em>/);
  assert.match(rendered, /<em class="of-likely" data-likely="low">可能性 低<\/em>/);
  assert.match(rendered, /<b>見分けるポイント<\/b> 嘴が太く額が盛り上がる/);
  assert.equal((rendered.match(/class="of-likely"/g) ?? []).length, 2);
});

test("Japanese record detail suppresses mixed-language AI prose from reassessment", () => {
  const mixedLanguageDetail: ObservationFirstRecordDetail = {
    ...detail,
    observations: detail.observations.map((card, index) => index === 0 ? {
      ...card,
      aiSuggestions: [{ ...card.aiSuggestions[0]!,
        visualEvidence: ["この鳥は bright blue feathers near the neck が見えます"],
      }],
    } : card),
  };
  const rendered = renderObservationFirstRecordDetailHtml(mixedLanguageDetail, {
    lang: "ja", title: "地域の記録", observedLabel: "2026年10月3日", note: null, media: [], actionNonce: "nonce-ja-mixed-language",
    aiFeedback: "羽の模様は bright blue feathers near the neck のように見えます",
  });
  assert.doesNotMatch(rendered, /bright blue feathers/);
});

const humanAiCard: ObservationFirstRecordDetail["observations"][number] = {
  ...detail.observations[0]!,
  observationId: "person-ai",
  subjectLabel: "写っているもの",
  assertionStatus: "provisional",
  acceptedIdentification: null,
  communityIdentifications: [],
  aiSuggestions: [{
    suggestionId: "person-suggestion", proposedName: "人間", proposedScientificName: "Homo sapiens", proposedRank: "species",
    visualEvidence: ["観客が写っています"], shootingAdvice: ["人物の顔を近くから撮る"], provisional: true,
  }],
  provenance: { owner: false, ai: true, community: false, curator: false, imported: false },
};

test("person-only AI detail keeps the record without taxon comparisons or body close-up guidance", () => {
  const rendered = renderObservationFirstRecordDetailHtml({ ...detail, owner: false, observations: [humanAiCard] }, {
    lang: "ja", title: "競技場の記録", observedLabel: "2026年10月3日", note: "地域の行事を見学したときの記録。",
    media: [{ mediaId: "asset-public", mediaKind: "photo", url: "/derived/public-scene.webp" }], actionNonce: "person-scene",
    aiCandidateInsights: [{ name: "人間", scientificName: "Homo sapiens", supportingFeatures: ["観客が写っています"], missingFeatures: [], contradictions: [] }],
    aiFeedback: "地域の行事が記録されています。", aiNextPhoto: "頭部および胴体の鮮明な拡大画像",
  });
  for (const text of ["人間かもしれません", "Homo sapiens", "人物の顔を近くから撮る", "頭部および胴体の鮮明な拡大画像"]) {
    assert.equal(rendered.includes(text), false, text);
  }
  assert.match(rendered, /地域の行事を見学したときの記録/);
  assert.match(rendered, /\/derived\/public-scene\.webp/);
  assert.match(rendered, /地域の行事が記録されています/);
  assert.equal(rendered.includes('class="of-summary"'), false);
  assert.equal(rendered.includes("生きものは見つかりませんでした"), false);
});

test("person primary context suppresses novel AI names and learning while preserving the original record", () => {
  const personCard = {
    ...humanAiCard,
    subjectLabel: "男性",
    aiSuggestions: [{ ...humanAiCard.aiSuggestions[0]!, proposedName: "男性", proposedScientificName: null }],
  };
  for (const owner of [false, true]) {
    const rendered = renderObservationFirstRecordDetailHtml({ ...detail, owner, observations: [personCard] }, {
      lang: "ja", title: "男性", titleIsFallback: true, observedLabel: "2026年10月3日",
      note: "男性のいる地域の行事を記録しました。", actionNonce: "novel-person",
      media: [{ mediaId: "asset-public", mediaKind: "photo", url: "/derived/public-scene.webp" }],
      aiPersonPrimaryNames: ["男性"],
      aiCandidateInsights: [{ name: "男性", scientificName: null, supportingFeatures: ["観客が写っています"], missingFeatures: [], contradictions: [] }],
      aiFeedback: "地域の行事が記録されています。", aiNextPhoto: "頭部および胴体の鮮明な拡大画像",
    });
    assert.match(rendered, /<h1>自然の記録<\/h1>/);
    assert.match(rendered, /男性のいる地域の行事を記録しました/);
    assert.match(rendered, /\/derived\/public-scene\.webp/);
    assert.match(rendered, /地域の行事が記録されています/);
    assert.doesNotMatch(rendered, /男性かもしれません|>男性<|観客が写っています|人物の顔を近くから撮る|頭部および胴体の鮮明な拡大画像/);
    assert.doesNotMatch(rendered, /class="of-summary"|生きものは見つかりませんでした/);
  }
});

test("person primary context retains coexisting bird and plant suggestions and accepted user names", () => {
  const subjects = [
    { name: "スズメ", scientificName: "Passer montanus", evidence: "頬の黒い斑点が見えます", advice: "翼とくちばしを横から撮る。" },
    { name: "ヒトリシズカ", scientificName: "Chloranthus japonicus", evidence: "白い花が見えます", advice: "葉の裏側と茎の付け根を撮る。" },
  ];
  for (const subject of subjects) {
    const personSuggestion = { ...humanAiCard.aiSuggestions[0]!, proposedName: "男性", proposedScientificName: null };
    const organismSuggestion = { ...personSuggestion, suggestionId: "coexisting", proposedName: subject.name, proposedScientificName: subject.scientificName, visualEvidence: [subject.evidence], shootingAdvice: [subject.advice] };
    const rendered = renderObservationFirstRecordDetailHtml({ ...detail, owner: false, observations: [{ ...humanAiCard, aiSuggestions: [personSuggestion, organismSuggestion] }] }, {
      lang: "ja", title: "行事の記録", observedLabel: "2026年10月3日", note: null, media: [], actionNonce: "person-and-organism",
      aiPersonPrimaryNames: ["男性"],
      aiCandidateInsights: [
        { name: "男性", scientificName: null, supportingFeatures: ["観客が写っています"], missingFeatures: [], contradictions: [] },
        { name: subject.name, scientificName: subject.scientificName, supportingFeatures: [subject.evidence], missingFeatures: [], contradictions: [] },
      ],
      aiNextPhoto: subject.advice,
    });
    for (const text of [subject.name, subject.evidence, subject.advice]) assert.ok(rendered.includes(text), text);
    assert.doesNotMatch(rendered, /男性かもしれません|>男性<|観客が写っています|人物の顔を近くから撮る/);
  }
  const acceptedCard = { ...humanAiCard, assertionStatus: "human_asserted", subjectLabel: "男性", acceptedIdentification: {
    claimId: "accepted-person", actorType: "owner" as const, actorId: "owner", proposalActorType: "owner" as const,
    proposedName: "男性", proposedScientificName: null, proposedRank: null, humanDecision: true as const,
  } };
  const acceptedHtml = renderObservationFirstRecordDetailHtml({ ...detail, observations: [acceptedCard] }, {
    lang: "ja", title: "男性", observedLabel: "2026年10月3日", note: "利用者が残した人物の記録。", media: [], actionNonce: "accepted-novel-person",
    aiPersonPrimaryNames: ["男性"], aiNextPhoto: "頭部および胴体の鮮明な拡大画像",
  });
  assert.match(acceptedHtml, /<h1>男性<\/h1>/);
  assert.match(acceptedHtml, /<strong>男性<\/strong>/);
  assert.match(acceptedHtml, /利用者が残した人物の記録/);
  assert.doesNotMatch(acceptedHtml, /人物の顔を近くから撮る|頭部および胴体の鮮明な拡大画像/);
});

test("mixed AI detail retains bird evidence and mapped guidance while excluding the human alternative", () => {
  const birdSuggestion = { ...humanAiCard.aiSuggestions[0]!, suggestionId: "bird-suggestion", proposedName: "スズメ", proposedScientificName: "Passer montanus", visualEvidence: ["頬の黒い斑点が見えます"], shootingAdvice: ["翼とくちばしを横から撮る"] };
  const nextPhoto = publicObservationAiFeedback(JSON.stringify({
    recordClass: "mixed",
    topCandidates: [
      { candidateKey: "primary:person", name: "人間", scientificName: "Homo sapiens" },
      { candidateKey: "census:bird", name: "スズメ", scientificName: "Passer montanus" },
    ],
    summary: { subject_explanations: [
      { subject_id: "primary:person", title: "主対象", next_photo: "頭部および胴体の鮮明な拡大画像" },
      { subject_id: "census:bird", title: "鳥", next_photo: "翼を開いたところが撮れると比べやすくなります。" },
    ] },
  })).nextPhoto;
  const rendered = renderObservationFirstRecordDetailHtml({
    ...detail, owner: false, observations: [{ ...humanAiCard, aiSuggestions: [...humanAiCard.aiSuggestions, birdSuggestion] }],
  }, {
    lang: "ja", title: "地域の記録", observedLabel: "2026年10月3日", note: null, media: [], actionNonce: "mixed-scene", aiNextPhoto: nextPhoto,
    aiCandidateInsights: [
      { name: "人間", scientificName: "Homo sapiens", supportingFeatures: ["観客が写っています"], missingFeatures: [], contradictions: [] },
      { name: "スズメ", scientificName: "Passer montanus", supportingFeatures: ["頬に斑点が見えます"], missingFeatures: [], contradictions: [] },
    ],
  });
  for (const text of ["人間かもしれません", "Homo sapiens", "人物の顔を近くから撮る", "頭部および胴体の鮮明な拡大画像"]) {
    assert.equal(rendered.includes(text), false, text);
  }
  assert.match(rendered, /スズメかもしれません/);
  assert.match(rendered, /頬の黒い斑点が見えます/);
  assert.match(rendered, /翼とくちばしを横から撮る/);
  assert.match(rendered, /次に撮るとよい写真：翼を開いたところ/);
});

test("human accepted claims and original notes remain visible when human AI advice is omitted", () => {
  const accepted = { ...humanAiCard, assertionStatus: "human_asserted", acceptedIdentification: {
    claimId: "owner-person-label", actorType: "owner" as const, actorId: "owner", proposalActorType: "owner" as const,
    proposedName: "人間", proposedScientificName: "Homo sapiens", proposedRank: "species", humanDecision: true as const,
  } };
  const rendered = renderObservationFirstRecordDetailHtml({ ...detail, observations: [accepted] }, {
    lang: "ja", title: "行事の記録", observedLabel: "2026年10月3日", note: "人物が写っています。", media: [], actionNonce: "accepted-person",
    aiNextPhoto: "頭部および胴体の鮮明な拡大画像",
  });
  assert.match(rendered, /<strong>人間<\/strong>/);
  assert.match(rendered, /人物が写っています/);
  assert.equal(rendered.includes("人間かもしれません"), false);
  assert.equal(rendered.includes("人物の顔を近くから撮る"), false);
  assert.equal(rendered.includes("頭部および胴体の鮮明な拡大画像"), false);
  assert.equal(accepted.acceptedIdentification.claimId, "owner-person-label");
});

test("record detail renders an in-page zoomable lightbox for photos and omits it without photos", () => {
  const withPhoto = renderObservationFirstRecordDetailHtml(detail, {
    lang: "ja",
    title: "庭の観察",
    observedLabel: "2026年7月22日 18:00",
    note: null,
    media: [{ mediaId: "asset-photo", mediaKind: "photo", url: "https://media.example/safe-full.webp" }],
    actionNonce: "nonce-zoom",
  });
  assert.match(withPhoto, /data-of-photo-trigger/);
  assert.match(withPhoto, /data-of-lightbox/);
  assert.match(withPhoto, /data-of-lightbox-toggle/);
  assert.match(withPhoto, /data-of-lightbox-close/);
  assert.match(withPhoto, /data-of-lightbox-script/);

  const withoutPhoto = renderObservationFirstRecordDetailHtml(detail, {
    lang: "ja",
    title: "音声のみの記録",
    observedLabel: "2026年7月22日 18:00",
    note: null,
    media: [{ mediaId: "asset-audio", mediaKind: "audio", url: "https://media.example/audio.mp3" }],
    actionNonce: "nonce-no-photo",
  });
  assert.doesNotMatch(withoutPhoto, /data-of-photo-trigger/);
  assert.doesNotMatch(withoutPhoto, /data-of-lightbox-script/);
});

test("record detail uses theme-aware surface tokens, mobile bottom-nav clearance, and distinct AI feedback styling", () => {
  const rendered = renderObservationFirstRecordDetailHtml(detail, {
    lang: "ja",
    title: "水辺の観察",
    observedLabel: "2026年7月22日 18:00",
    note: null,
    media: [{ mediaId: "asset-photo", mediaKind: "photo", url: "https://media.example/safe-full.webp" }],
    aiFeedback: "水辺の植物と水面の状態が記録されています。",
    actionNonce: "nonce-polish",
  });
  assert.match(rendered, /\.of-panel[^}]*background:var\(--paper\)/);
  assert.match(rendered, /\.of-related-card[^}]*background:var\(--paper\)/);
  assert.match(rendered, /margin-bottom:calc\(88px \+ env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(rendered, /\[data-ai-feedback\]\{[^}]*background:var\(--soft\)/);
});

test("record detail resolves the 7 UX polish items: open capture, readable media nav, no radio meta, no empty subject row", () => {
  const rendered = renderObservationFirstRecordDetailHtml({
    ...detail,
    owner: false,
    observations: [{
      ...detail.observations[0]!,
      subjectType: "unknown_subject",
      subjectLabel: "写っているもの",
      acceptedIdentification: null,
      communityIdentifications: [],
      aiSuggestions: [],
    }],
  }, {
    lang: "ja",
    title: "水辺のトンボ",
    observedLabel: "2026/11/22 08:15",
    note: null,
    publicLocationLabel: "位置をぼかしています",
    media: [
      { mediaId: "p1", mediaKind: "photo", url: "https://media.example/1.webp" },
      { mediaId: "p2", mediaKind: "photo", url: "https://media.example/2.webp" },
    ],
    actionNonce: "nonce-7fixes",
    viewerAuthenticated: false,
  });
  assert.match(rendered, /<details class="of-capture" open>/);
  assert.doesNotMatch(rendered, /\.of-media-nav\{[^}]*position:absolute/);
  assert.match(rendered, /@media\(min-width:900px\)\{.*body\[data-zukan-app-experience\] \.of-media-slide :is\(img,video\)\{width:100%/);
  assert.doesNotMatch(rendered, /<span>◉<\/span>|<span>◌<\/span>/);
  assert.doesNotMatch(rendered, /位置はぼかして表示/);
  assert.doesNotMatch(rendered, /名前はこれから/);
});

test("existing landscape record without aiFeedback renders grounded environment feedback and avoids absence wording", () => {
  const rendered = renderObservationFirstRecordDetailHtml({ ...detail, owner: false, observationCount: 0, observations: [] }, {
    lang: "ja",
    title: "水辺の記録",
    observedLabel: "2026年11月22日",
    note: null,
    detectionState: "not_detected",
    aiFeedback: null,
    aiNextPhoto: null,
    media: [{ mediaId: "scene-water", mediaKind: "photo", url: "https://media.example/water.webp" }],
    environment: {
      place_type: "water_edge",
      surrounding_cover: "low_grass",
      place_type_source: "derived",
      surrounding_cover_source: "derived",
      environment_record_status: "auto_draft",
    },
    actionNonce: "nonce-water-scene",
    viewerAuthenticated: false,
  });
  assert.match(rendered, /data-ai-feedback/);
  assert.match(rendered, /水辺/);
  assert.doesNotMatch(rendered, /水辺のよう/);
  assert.doesNotMatch(rendered, /生きものの姿は見つかりませんでした/);
});

test("record detail fixes media-nav contrast after appExperience, desktop image height, and ai-feedback card framing", () => {
  const rendered = renderObservationFirstRecordDetailHtml(detail, {
    lang: "ja",
    title: "水辺の観察",
    observedLabel: "2026/11/22 08:15",
    note: null,
    aiFeedback: "水辺の植生が見えます。",
    media: [
      { mediaId: "p1", mediaKind: "photo", url: "https://media.example/1.webp" },
      { mediaId: "p2", mediaKind: "photo", url: "https://media.example/2.webp" },
    ],
    actionNonce: "nonce-3fixes",
    viewerAuthenticated: false,
  });
  assert.match(rendered, /\.of-media-nav a\{[^}]*color:var\(--ink\)/);
  assert.match(rendered, /body\[data-zukan-app-experience\] \.of-media-slide :is\(img,video\)\{[^}]*height:calc\(100vh - 96px\)/);
  assert.match(rendered, /body\[data-zukan-app-experience\] \.of-note\[data-ai-feedback\]\{[^}]*border:1px solid var\(--green\);border-radius:17px/);
});

test("rendered desktop 1440x900 page scales portrait photo height >= 600 and frames ai-feedback card", async () => {
  const { existsSync } = await import("node:fs");
  const chromePath = "/home/nexus/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";
  if (!existsSync(chromePath)) return;
  const { chromium } = await import("playwright-core");
  const portraitSvg = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="330" height="446" viewBox="0 0 330 446"><rect width="330" height="446" fill="#245c3a"/></svg>');
  const rendered = renderObservationFirstRecordDetailHtml(detail, {
    lang: "ja",
    title: "水辺の観察",
    observedLabel: "2026/11/22 08:15",
    note: null,
    aiFeedback: "水辺の植生が見えます。",
    media: [{ mediaId: "p1", mediaKind: "photo", url: portraitSvg }],
    actionNonce: "nonce-browser-measure",
    viewerAuthenticated: false,
  });
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.setContent(rendered, { waitUntil: "load" });
    const metrics = await page.evaluate(() => {
      const img = document.querySelector(".of-media-slide img");
      const feedback = document.querySelector("[data-ai-feedback]");
      const imgRect = img ? img.getBoundingClientRect() : null;
      const feedbackStyle = feedback ? getComputedStyle(feedback) : null;
      return {
        imgHeight: imgRect ? imgRect.height : 0,
        borderRadius: feedbackStyle ? feedbackStyle.borderRadius : "",
        borderTopWidth: feedbackStyle ? feedbackStyle.borderTopWidth : "",
        borderLeftWidth: feedbackStyle ? feedbackStyle.borderLeftWidth : "",
        backgroundColor: feedbackStyle ? feedbackStyle.backgroundColor : "",
      };
    });
    assert.ok(metrics.imgHeight >= 600, `expected portrait imgHeight >= 600, got ${metrics.imgHeight}`);
    assert.equal(metrics.borderRadius, "17px");
    assert.equal(metrics.borderTopWidth, "1px");
    assert.equal(metrics.borderLeftWidth, "1px");
    assert.notEqual(metrics.backgroundColor, "rgb(255, 255, 255)");
  } finally {
    await browser.close();
  }
});

test("card mode renders each heading and candidate once without advice prose, comparison lead, or awaiting placeholder", () => {
  const rendered = renderObservationFirstRecordDetailHtml(
    {
      ...detail,
      owner: false,
      observationCount: 2,
      observations: [
        detail.observations[0]!,
        {
          ...detail.observations[0]!,
          observationId: "obs-2",
          subjectLabel: "写っているもの",
          acceptedIdentification: null,
          aiSuggestions: [],
          communityIdentifications: [],
        },
      ],
    },
    {
      lang: "ja",
      title: "ナミアゲハ",
      observedLabel: "2026年11月23日",
      note: null,
      aiFeedback: null,
      aiNextPhoto: "腹部の裏面",
      aiCandidateInsights: [
        {
          name: "ナミアゲハ",
          scientificName: "Papilio xuthus",
          supportingFeatures: ["前翅の黒と黄の模様"],
          missingFeatures: ["腹部の裏面"],
          contradictions: [],
        },
      ],
      media: [{ mediaId: "p1", mediaKind: "photo", url: "https://media.example/1.webp" }],
      actionNonce: "nonce-dedup",
      viewerAuthenticated: false,
    },
  );
  assert.equal((rendered.match(/ナミアゲハかもしれません/g) ?? []).length, 1);
  assert.equal((rendered.match(/ログインして名前を提案する/g) ?? []).length, 1);
  assert.equal((rendered.match(/<small>候補<\/small>/g) ?? []).length, 1);
  assert.doesNotMatch(rendered, /写っているもの/);
  assert.doesNotMatch(rendered, /写真から見える特徴と、まだ確認できない点を並べています/);
  assert.doesNotMatch(rendered, /名前はこれから/);
  assert.match(rendered, /次に撮るとよい写真：腹部の裏面/);
  const feedbackBlock = rendered.match(/data-ai-feedback[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.doesNotMatch(feedbackBlock, /比べやすくなります/);
});

test("card mode suppresses saved advice prose, trims next_photo to a noun, omits photoInference/hedge wording, and deduplicates evidence", () => {
  const cardWithDupEvidence = {
    ...detail.observations[0]!,
    aiSuggestions: [
      {
        suggestionId: "ai-dup",
        proposedName: "ナミアゲハ",
        proposedScientificName: "Papilio xuthus",
        proposedRank: "species",
        visualEvidence: ["実物の生体詳細"],
        shootingAdvice: ["腹部の裏面を撮影すると比べやすくなります"],
        provisional: true as const,
      },
    ],
  };
  const rendered = renderObservationFirstRecordDetailHtml(
    { ...detail, owner: false, observations: [cardWithDupEvidence] },
    {
      lang: "ja",
      title: "ナミアゲハ",
      observedLabel: "2026年11月23日",
      note: null,
      aiFeedback: "全景とあわせて特徴的な模様を撮影することで、情報のつながりがより伝わりやすくなります。あわせて記録することをおすすめします。",
      aiNextPhoto: "腹部の裏面が分かる角度からの撮影",
      aiCandidateInsights: [
        {
          name: "ナミアゲハ",
          scientificName: "Papilio xuthus",
          supportingFeatures: ["実物の生体詳細"],
          missingFeatures: ["後翅の模様"],
          contradictions: [],
        },
      ],
      environment: { place_type: "woodland", environment_record_status: "auto_draft" },
      media: [{ mediaId: "p1", mediaKind: "photo", url: "https://media.example/1.webp" }],
      actionNonce: "nonce-concise",
      viewerAuthenticated: false,
    },
  );
  assert.doesNotMatch(rendered, /AIからの短いメモ|伝わりやすくなります|おすすめします/);
  assert.match(rendered, /次に撮るとよい写真：腹部の裏面<\/p>/);
  assert.doesNotMatch(rendered, /が分かる角度からの撮影/);
  assert.doesNotMatch(rendered, /写真から読み取った候補です/);
  assert.match(rendered, />林の中<\/p>/);
  assert.doesNotMatch(rendered, /林の中のようです/);
  assert.equal((rendered.match(/実物の生体詳細/g) ?? []).length, 1);
});

test("AI sections carry explicit AI label across all locales and consolidate next-photo guidance without repeating missing features", () => {
  const card = {
    ...detail.observations[0]!,
    aiSuggestions: [
      {
        suggestionId: "ai-cons",
        proposedName: "ナミアゲハ",
        proposedScientificName: "Papilio xuthus",
        proposedRank: "species",
        visualEvidence: ["前翅の模様"],
        shootingAdvice: ["実物の生体や周囲の自然環境の詳細が分かる部位・角度"],
        provisional: true as const,
      },
    ],
  };
  const rendered = renderObservationFirstRecordDetailHtml(
    { ...detail, owner: false, observations: [card] },
    {
      lang: "ja",
      title: "ナミアゲハ",
      observedLabel: "2026年11月23日",
      note: null,
      aiFeedback: null,
      aiNextPhoto: "実物の生体や周囲の自然環境の詳細が分かる部位・角度",
      aiCandidateInsights: [
        {
          name: "ナミアゲハ",
          scientificName: "Papilio xuthus",
          supportingFeatures: ["前翅の模様"],
          missingFeatures: ["実物の生体詳細"],
          contradictions: [],
        },
      ],
      sceneElements: ["trees_shrubs"],
      detectionState: "detected",
      environment: { place_type: "woodland", environment_record_status: "auto_draft" },
      media: [{ mediaId: "p1", mediaKind: "photo", url: "https://media.example/1.webp" }],
      actionNonce: "nonce-ai-label",
      viewerAuthenticated: false,
    },
  );
  const bodyHtml = rendered.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? "";
  const visibleText = bodyHtml.replace(/<[^>]*>/gu, " ");
  assert.match(visibleText, /題名とこの文章はAIが作成しました/);
  assert.match(visibleText, /この説明はAIが作成しました/);
  assert.match(visibleText, /この場所のようすはAIが読み取りました/);
  assert.equal((bodyHtml.match(/class="of-ai-note"/g) ?? []).length, 3);
  assert.equal((bodyHtml.match(/AIのコメント/g) ?? []).length, 1);
  assert.match(rendered, /確認の印がない名前と場所のようすは、AIが推定したものです。/);
  assert.doesNotMatch(rendered, /of-ai-badge|AIの見立て|AIからの短いメモ|AIが見つけた/);
  assert.doesNotMatch(rendered, /もう少し詳しく調べるには/);
  assert.doesNotMatch(rendered, /未確認/);
  assert.match(rendered, /次に撮るとよい写真：実物の生体や周囲の自然環境<\/p>/);
  assert.doesNotMatch(rendered, /の詳細が分かる部位・角度/);
});

test("signboard record with saved illustration-deer candidate suppresses organism candidate and shows 案内板", () => {
  const signCard = {
    ...detail.observations[0]!,
    aiSuggestions: [
      {
        suggestionId: "ai-sign",
        proposedName: "案内板のイラストのシカ",
        proposedScientificName: null,
        proposedRank: "species",
        visualEvidence: ["「四日市市少年自然の家パノラマ図」の案内板"],
        shootingAdvice: [],
        provisional: true as const,
      },
    ],
  };
  const rendered = renderObservationFirstRecordDetailHtml(
    { ...detail, owner: false, observations: [signCard] },
    {
      lang: "ja",
      title: "自然の記録",
      titleIsFallback: true,
      observedLabel: "2026年11月23日",
      note: null,
      aiFeedback: null,
      aiNextPhoto: "実物の生体や周囲の自然環境の詳細が分かる部位・角度",
      aiCandidateInsights: [
        {
          name: "案内板のイラストのシカ",
          scientificName: null,
          supportingFeatures: ["「四日市市少年自然の家パノラマ図」の案内板"],
          missingFeatures: [],
          contradictions: [],
        },
      ],
      sceneElements: ["trees_shrubs"],
      detectionState: "detected",
      media: [{ mediaId: "p1", mediaKind: "photo", url: "https://media.example/1.webp" }],
      actionNonce: "nonce-signboard",
      viewerAuthenticated: false,
    },
  );
  assert.match(rendered, /<h1>四日市市少年自然の家パノラマ図<\/h1>/);
  assert.doesNotMatch(rendered, /<h1>自然の記録<\/h1>/);
  assert.doesNotMatch(rendered, /シカかもしれません|案内板のイラストのシカ/);
  assert.doesNotMatch(rendered, /次に撮るとよい写真：実物の生体/);
  assert.equal((rendered.match(/この写真から見つかったもの/g) ?? []).length, 1);
  assert.match(rendered, /写っているもの：案内板/);
  const bodyHtml = rendered.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? "";
  assert.equal((bodyHtml.replace(/<[^>]*>/gu, " ").match(/この説明はAIが作成しました/g) ?? []).length, 1);

  const signCardNoQuote = {
    ...signCard,
    aiSuggestions: [
      {
        ...signCard.aiSuggestions[0]!,
        visualEvidence: ["案内板のイラスト"],
      },
    ],
  };
  const withFallbackOcrTitle = renderObservationFirstRecordDetailHtml(
    { ...detail, owner: false, observations: [signCardNoQuote] },
    {
      lang: "ja",
      title: "自然の記録",
      titleIsFallback: true,
      observedLabel: "2026-11-23 09:00",
      publicLocationLabel: "四日市市",
      note: "",
      media: [],
      actionNonce: "nonce-signboard-2",
      signboardTitle: "四日市市少年自然の家パノラマ図",
      aiFeedback: "",
    },
  );
  assert.match(withFallbackOcrTitle, /<title>四日市市少年自然の家パノラマ図 \| ZUKAN<\/title>/);
  assert.match(withFallbackOcrTitle, /<h1>四日市市少年自然の家パノラマ図<\/h1>/);
});

test("resolveLiveSignboardTitle runs OCR in waitUntil without blocking first render and caches failures for 24h", async () => {
  const bucket = new Map<string, string>();
  const env = {
    GEMINI_API_KEY: "test-key",
    ASSET_BUCKET: {
      async get(key: string) {
        const val = bucket.get(key);
        if (val === undefined) return null;
        return { body: new Response(val).body, httpMetadata: { contentType: "application/json" } };
      },
      async put(key: string, value: string) {
        bucket.set(key, value);
      },
    },
    OBS_DB: {
      prepare() {
        return {
          bind() {
            return {
              async first() {
                return { public_derivative_key: "photo/1.webp", mime: "image/webp" };
              },
            };
          },
        };
      },
    },
  } as unknown as Parameters<typeof resolveLiveSignboardTitle>[2];

  bucket.set("photo/1.webp", "fake-bytes");
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil(p: Promise<unknown>) { pending.push(p); } } as unknown as Parameters<typeof resolveLiveSignboardTitle>[3];
  const origFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response("upstream error", { status: 500 });
  }) as typeof fetch;

  try {
    const first = await resolveLiveSignboardTitle("visit-fail", "asset-1", env, ctx);
    assert.equal(first, null);
    assert.equal(pending.length, 1, "first miss schedules background OCR via waitUntil");
    await Promise.all(pending);
    assert.equal(fetchCalls, 1);

    const cachedRaw = bucket.get("signboard-title/visit-fail.json");
    assert.ok(cachedRaw, "failure must be persisted in R2 cache");
    assert.equal(JSON.parse(cachedRaw).status, "failed");

    const secondPending: Promise<unknown>[] = [];
    const secondCtx = { waitUntil(p: Promise<unknown>) { secondPending.push(p); } } as unknown as Parameters<typeof resolveLiveSignboardTitle>[3];
    const second = await resolveLiveSignboardTitle("visit-fail", "asset-1", env, secondCtx);
    assert.equal(second, null);
    assert.equal(secondPending.length, 0, "failed OCR must not be retried within 24h");
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("record detail shows owner title edit form and role-based provenance without user names", () => {
  const withMultiProposers = {
    ...detail,
    owner: true,
    observations: [
      {
        ...detail.observations[0]!,
        acceptedIdentification: { claimId: "acc-1", actorType: "owner" as const, actorId: "u1", proposalActorType: "owner" as const, proposedName: "キアゲハ", proposedScientificName: null, proposedRank: "species", humanDecision: true as const },
        communityIdentifications: [
          { claimId: "c1", actorType: "community_member" as const, proposedName: "ナミアゲハ", proposedScientificName: null, proposedRank: "species", stance: "support" as const, accepted: false },
          { claimId: "c2", actorType: "community_member" as const, proposedName: "ナミアゲハ", proposedScientificName: null, proposedRank: "species", stance: "support" as const, accepted: false },
        ],
      },
    ],
  };
  const ownerHtml = renderObservationFirstRecordDetailHtml(withMultiProposers, {
    lang: "ja",
    title: "キアゲハ",
    observedLabel: "2026年11月23日",
    publicLocationLabel: "静岡県浜松市",
    note: "",
    media: [],
    actionNonce: "nonce-roles",
  });
  assert.match(ownerHtml, /class="of-title-edit"/);
  assert.match(ownerHtml, /name="action" value="set_title"/);
  assert.match(ownerHtml, /記録した人が確認/);
  assert.match(ownerHtml, /ナミアゲハ.*ほかの人 2人/);

  const withCustomTitle = renderObservationFirstRecordDetailHtml(withMultiProposers, {
    lang: "ja",
    title: "キアゲハ",
    customTitle: "里山のチョウと野草",
    aiFeedback: "林縁の草地でよく見られます。",
    observedLabel: "2026年11月23日",
    publicLocationLabel: "静岡県浜松市",
    note: "",
    media: [],
    actionNonce: "nonce-custom-title",
  });
  assert.match(withCustomTitle, /<h1>里山のチョウと野草<\/h1>/);
  assert.match(withCustomTitle, /name="action" value="reset_title"/);
  assert.match(withCustomTitle, /自動の題名に戻す/);
  assert.match(withCustomTitle, /この文章はAIが作成しました/);
  assert.doesNotMatch(withCustomTitle, /題名とこの文章はAIが作成しました/);

  const guestHtml = renderObservationFirstRecordDetailHtml({ ...withMultiProposers, owner: false }, {
    lang: "ja",
    title: "キアゲハ",
    observedLabel: "2026年11月23日",
    publicLocationLabel: "静岡県浜松市",
    note: "",
    media: [],
    actionNonce: "nonce-roles-guest",
  });
  assert.doesNotMatch(guestHtml, /class="of-title-edit"/);
});


test("signboard, object, food, and person records do not fall back to 自然の記録 or biological advice", () => {
  const signboardWithIllustratedDeer = {
    ...detail,
    observations: [
      {
        ...detail.observations[0]!,
        acceptedIdentification: null,
        communityIdentifications: [],
        aiSuggestions: [
          {
            suggestionId: "ai-deer",
            proposedName: "シカ",
            proposedScientificName: "Cervus nippon",
            proposedRank: "species",
            visualEvidence: ["案内板のイラストに描かれたシカ"],
            shootingAdvice: [],
            provisional: true as const,
          },
        ],
      },
    ],
  };

  const signboardHtml = renderObservationFirstRecordDetailHtml(signboardWithIllustratedDeer, {
    lang: "ja",
    title: "自然の記録",
    titleIsFallback: true,
    recordClass: "document",
    observedLabel: "2026年11月23日",
    note: null,
    actionNonce: "n-sign",
    aiFeedback: "公園入口の看板「四日市市少年自然の家パノラマ図」です。",
    aiNextPhoto: "実物の生体や周囲の自然環境の詳細が分かる部位・角度",
    media: [{ mediaId: "m1", mediaKind: "photo", url: "/media/sign.jpg" }],
  });
  assert.match(signboardHtml, /<h1>四日市市少年自然の家パノラマ図<\/h1>/);
  assert.match(signboardHtml, /案内板/);
  assert.doesNotMatch(signboardHtml, /<h1>自然の記録<\/h1>/);
  assert.doesNotMatch(signboardHtml, /実物の生体/);
  assert.doesNotMatch(signboardHtml, />シカ</);

  const objectHtml = renderObservationFirstRecordDetailHtml(detail, {
    lang: "ja",
    title: "名前待ち",
    titleIsFallback: true,
    recordClass: "object",
    observedLabel: "2026年11月23日",
    note: null,
    actionNonce: "n-obj",
    aiNextPhoto: "実物の生体や周囲の自然環境の詳細が分かる部位・角度",
    media: [{ mediaId: "m2", mediaKind: "photo", url: "/media/building.jpg" }],
  });
  assert.match(objectHtml, /<h1>まちの記録<\/h1>/);
  assert.match(objectHtml, /建物・人工物/);
  assert.doesNotMatch(objectHtml, /<h1>自然の記録<\/h1>/);
  assert.doesNotMatch(objectHtml, /実物の生体/);

  const foodHtml = renderObservationFirstRecordDetailHtml(detail, {
    lang: "ja",
    title: "名前待ち",
    titleIsFallback: true,
    recordClass: "food",
    observedLabel: "2026年11月23日",
    note: null,
    actionNonce: "n-food",
    media: [{ mediaId: "m3", mediaKind: "photo", url: "/media/food.jpg" }],
  });
  assert.match(foodHtml, /<h1>食の記録<\/h1>/);
  assert.match(foodHtml, /料理・食/);
  assert.doesNotMatch(foodHtml, /<h1>自然の記録<\/h1>/);

  const personHtml = renderObservationFirstRecordDetailHtml(detail, {
    lang: "ja",
    title: "名前待ち",
    titleIsFallback: true,
    recordClass: "person",
    observedLabel: "2026年11月23日",
    note: null,
    actionNonce: "n-person",
    media: [{ mediaId: "m4", mediaKind: "photo", url: "/media/people.jpg" }],
  });
  assert.match(personHtml, /<h1>活動の記録<\/h1>/);
  assert.match(personHtml, /人の集まり・活動/);
  assert.doesNotMatch(personHtml, /<h1>自然の記録<\/h1>/);
});
