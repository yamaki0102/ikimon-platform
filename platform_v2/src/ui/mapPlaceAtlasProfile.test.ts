import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import type { PlaceAtlasProfile } from "../services/placeAtlasContract.js";
import {
  MAP_PLACE_ATLAS_PROFILE_RUNTIME,
  MAP_PLACE_ATLAS_PROFILE_STYLES,
  renderMapPlaceAtlasError,
  renderMapPlaceAtlasLoading,
  renderMapPlaceAtlasProfile,
} from "./mapPlaceAtlasProfile.js";

function fixture(overrides: Partial<PlaceAtlasProfile> = {}): PlaceAtlasProfile {
  return {
    version: 1,
    placeRef: { kind: "field", fieldId: "tokiwa-field" },
    place: {
      name: "常磐公園",
      type: "park",
      localityLabel: "静岡県 静岡市",
      description: "まちなかの公園です。",
      representativeMedia: [{
        url: "/derived/tokiwa/display.webp",
        recordId: "record-1",
        observedAt: "2026-07-20T10:00:00.000Z",
        kind: "photo",
      }],
    },
    summary: {
      recordCount: 3,
      contributorCount: null,
      firstRecordedAt: "2026-04-10T09:00:00.000Z",
      latestRecordedAt: "2026-07-20T10:00:00.000Z",
    },
    facets: [{
      key: "nature",
      label: "自然・生きもの",
      count: 3,
      representativeMediaUrl: "/derived/tokiwa/display.webp",
    }],
    highlights: [{
      kind: "recent_activity",
      text: "最近も新しい記録が追加されています",
      evidenceCount: 1,
      sourceLabel: "公開Record",
      confidence: "derived",
    }],
    recentRecords: [{
      recordId: "record-1",
      observedAt: "2026-07-20T10:00:00.000Z",
      displayName: "アゲハ候補",
      href: "/observations/occ%3Arecord-1%3A0",
      mediaUrl: "/derived/tokiwa/display.webp",
      mediaKind: "photo",
      taxonGroup: "insect",
      themes: ["nature"],
      identificationStatus: "ai_candidate",
    }],
    guide: {
      title: "公園の歩き方",
      preview: "園内の季節を安全に見ます。",
      sourceLinks: [{ label: "公園案内", url: "https://example.test/tokiwa" }],
    },
    memories: [],
    facilities: [{ kind: "toilet", label: "トイレ" }],
    policy: {
      placeVisibility: "public",
      recordingPolicy: "allowed",
      publicLocationMode: "place",
      contributionCtaMode: "record",
      ruleSource: "administrator",
      ruleUrl: "https://example.test/tokiwa/rules",
      reason: "verified_recording_policy",
    },
    dataGaps: [{
      key: "history",
      label: "歴史・物語",
      reason: "公開できる資料はこれから追加できます。",
    }],
    publication: {
      status: "partial",
      suppressedSections: ["field_profile_narrative"],
      locationMode: "field",
    },
    provenance: {
      generatedAt: "2026-07-23T00:00:00.000Z",
      profileVersion: "place_atlas_profile/v1",
      sources: ["public_map_snapshot"],
    },
    ...overrides,
  };
}

const options = {
  lang: "ja" as const,
  recordHref: "/ja/record",
  recordsHref: "/ja/records",
};

function withTimeline(state: "single_period" | "timeline" = "timeline"): PlaceAtlasProfile & Record<string, unknown> {
  return {
    ...fixture(),
    timelineProjection: {
      version: 1, state,
      summaryKey: state === "timeline" ? "multiple_observation_periods" : "one_observation_period",
      changeAssessment: "not_assessed", recordCount: 2, totalRecordCount: 3, sampled: true,
      distinctPeriodCount: state === "timeline" ? 2 : 1,
      oldestObservedAt: "2024-03-05T00:00:00Z", latestObservedAt: "2026-07-01T00:00:00Z",
      recordingSuggestion: "revisit", publicationStatus: "partial", excluded: {},
      periods: [
        { periodKey: "2024-03-05", observedDate: "2024-03-05", items: [{ recordId: "secret-old", observedAt: "2024-03-05T00:00:00Z", observedDate: "2024-03-05", displayLabel: "以前", publicMediaUrl: "/derived/old/display.webp", sourceKind: "public_record", verificationState: "candidate", identificationStatus: "ai_candidate", href: "/ja/observations/old", mediaKind: "photo", contributor: "secret-owner", exactLat: 35 }] },
        ...(state === "timeline" ? [{ periodKey: "2026-07-01", observedDate: "2026-07-01", items: [{ recordId: "secret-new", observedAt: "2026-07-01T00:00:00Z", observedDate: "2026-07-01", displayLabel: "現在", publicMediaUrl: "javascript:bad", sourceKind: "public_record", verificationState: "verified", identificationStatus: "confirmed", href: "https://evil.test", mediaKind: "photo" }] }] : []),
      ],
    },
  } as unknown as PlaceAtlasProfile & Record<string, unknown>;
}

test("timeline renders only the API projection in chronological order without identity leakage", () => {
  const html = renderMapPlaceAtlasProfile(withTimeline(), options);
  assert.ok(html.indexOf("この場所のうつろい") < html.indexOf("この場所で見えてきたこと"));
  assert.ok(html.indexOf("2024-03-05") < html.indexOf("2026-07-01"));
  assert.match(html, /複数の時期の記録/);
  assert.doesNotMatch(html, /変化した/);
  assert.match(html, /公開記録からの標本表示/);
  assert.match(html, /候補/);
  assert.match(html, /確認済み/);
  assert.match(html, />今を撮る</);
  assert.match(html, /data-kpi-event="selected_place_cta_click"/);
  assert.match(html, /data-kpi-action="map:place_atlas:timeline_revisit"/);
  assert.match(html, /data-kpi-funnel="map_selected_place"/);
  assert.match(html, /data-kpi-target="\/ja\/record"/);
  assert.doesNotMatch(html, /secret-old|secret-new|secret-owner|exactLat|evil\.test|javascript:bad/);
});

test("single, empty, and suppressed timeline states make no unsupported change or count claim", () => {
  assert.match(renderMapPlaceAtlasProfile(withTimeline("single_period"), options), /一時期の記録/);
  for (const state of ["empty", "suppressed"]) {
    const profile = withTimeline();
    (profile.timelineProjection as Record<string, unknown>).state = state;
    assert.doesNotMatch(renderMapPlaceAtlasProfile(profile, options), /この場所のうつろい/);
  }

  const suppressedProfile = withTimeline();
  suppressedProfile.publication.status = "suppressed";
  assert.doesNotMatch(renderMapPlaceAtlasProfile(suppressedProfile, options), /この場所のうつろい/);

  const suppressedProjection = withTimeline();
  (suppressedProjection.timelineProjection as Record<string, unknown>).publicationStatus = "suppressed";
  assert.doesNotMatch(renderMapPlaceAtlasProfile(suppressedProjection, options), /この場所のうつろい/);
});

test("timeline localization and browser runtime stay in exact renderer parity", () => {
  const profile = withTimeline();
  const context = vm.createContext({ URL });
  new vm.Script(MAP_PLACE_ATLAS_PROFILE_RUNTIME).runInContext(context);
  const runtime = (context as any).MapPlaceAtlasProfile;
  for (const lang of ["ja", "en", "es", "pt-BR"] as const) {
    const localizedOptions = { ...options, lang };
    const nodeHtml = renderMapPlaceAtlasProfile(profile, localizedOptions);
    assert.equal(runtime.render(profile, localizedOptions), nodeHtml);
    assert.match(nodeHtml, /確認済み|Verified|Verificado/);
  }
});

test("place atlas renderer leads with place, representative media, safe summary, and themes", () => {
  const html = renderMapPlaceAtlasProfile(fixture(), options);

  assert.match(html, /data-place-atlas-profile/);
  assert.match(html, /常磐公園/);
  assert.match(html, /\/derived-transform\/w680\/derived\/tokiwa\/display\.webp/);
  assert.match(html, /公開Record/);
  assert.match(html, />3<\/strong>/);
  assert.match(html, /この場所で見えてきたこと/);
  assert.match(html, /自然・生きもの/);
  assert.match(html, /最近の記録/);
  assert.match(html, /AI candidate/);
  assert.match(html, /現地ガイド/);
  assert.match(html, /場所・施設/);
  assert.match(html, /これから記録できること/);
  assert.match(html, /data-kpi-action="map:place_atlas:record_here"/);
  assert.match(html, /href="\/ja\/record"/);
  assert.doesNotMatch(html, /緯度|経度|exact_lat|exact_lng/);
});

test("place atlas renderer sends imported display derivatives through the canonical responsive transform", () => {
  const importedUrl = "/derived/import/20260615/observation_photo/asset-1/display.webp";
  const html = renderMapPlaceAtlasProfile(fixture({
    place: {
      ...fixture().place,
      representativeMedia: [{
        url: importedUrl,
        recordId: "record-imported",
        kind: "photo",
      }],
    },
    recentRecords: [{
      ...fixture().recentRecords[0]!,
      mediaUrl: importedUrl,
    }],
  }), options);

  assert.match(html, /src="\/derived-transform\/w680\/derived\/import\/20260615\/observation_photo\/asset-1\/display\.webp"/);
  assert.match(html, /src="\/derived-transform\/w360\/derived\/import\/20260615\/observation_photo\/asset-1\/display\.webp"/);
  assert.match(html, /srcset="\/derived-transform\/w360\/derived\/import\/.+? 360w, \/derived-transform\/w680\/derived\/import\/.+? 680w, \/derived-transform\/w1020\/derived\/import\/.+? 1020w, \/derived-transform\/w1360\/derived\/import\/.+? 1360w"/);
  assert.match(html, /sizes="\(max-width: 767px\) 100vw, 680px"/);
});

test("place atlas imported media accepts only sanitized paths and never bypasses the transform", () => {
  const unsafeUrl = "/derived/import/20260615/observation_photo/asset-1/display.webp\n.svg";
  const rawImportUrl = "/derived/import/20260615/observation_photo/asset-1/original.jpg";
  const html = renderMapPlaceAtlasProfile(fixture({
    place: {
      ...fixture().place,
      representativeMedia: [{
        url: unsafeUrl,
        recordId: "record-unsafe",
        kind: "photo",
      }],
    },
    facets: [],
    recentRecords: [{
      ...fixture().recentRecords[0]!,
      mediaUrl: rawImportUrl,
    }],
  }), options);

  assert.doesNotMatch(html, /display\.webp[\r\n]/);
  assert.match(html, /src="\/derived-transform\/w360\/derived\/import\/20260615\/observation_photo\/asset-1\/original\.jpg"/);
  assert.doesNotMatch(html, /src="\/derived\/import\/20260615\/observation_photo\/asset-1\/original\.jpg"/);
});

test("place atlas media allowlist rejects same-origin API and traversal-shaped image URLs", () => {
  const html = renderMapPlaceAtlasProfile(fixture({
    place: {
      ...fixture().place,
      representativeMedia: [{
        url: "/api/v1/auth/session",
        recordId: "record-api",
        kind: "photo",
      }],
    },
    facets: [{
      key: "nature",
      label: "自然・生きもの",
      count: 1,
      representativeMediaUrl: "/uploads/../api/v1/auth/session",
    }],
    recentRecords: [{
      ...fixture().recentRecords[0]!,
      mediaUrl: "/record",
    }],
  }), options);

  assert.doesNotMatch(html, /src="\/api\/v1\/auth\/session"/);
  assert.doesNotMatch(html, /src="\/record"/);
  assert.doesNotMatch(html, /uploads\/\.\.\/api/);
});

test("place atlas renderer never turns unknown counts into zero or a false empty claim", () => {
  const profile = fixture({
    summary: {
      recordCount: null,
      contributorCount: null,
      firstRecordedAt: null,
      latestRecordedAt: null,
    },
  });
  const html = renderMapPlaceAtlasProfile(profile, options);

  assert.doesNotMatch(html, /公開Record<\/span><strong>0/);
  assert.doesNotMatch(html, /記録はありません/);
  assert.match(html, /未確認/);
});

test("place atlas renders sourced activities and stories without turning them into reviews", () => {
  const html = renderMapPlaceAtlasProfile(fixture({
    activities: [{
      title: "観察会",
      temporalState: "ended",
      source: { url: "https://example.test/event" },
    }],
    stories: [{
      title: "公園の由来",
      body: "自治体資料で確認された内容です。",
      source: { url: "https://example.test/history" },
    }],
  }), options);
  assert.match(html, /出来事・活動/);
  assert.match(html, /観察会/);
  assert.match(html, /ended/);
  assert.match(html, /歴史・物語/);
  assert.match(html, /自治体資料で確認された内容です。/);
  assert.doesNotMatch(html, /★|rating|レビュー点数/);
});

test("suppressed and empty profiles have explicit states without oversized empty theme cards", () => {
  const profile = fixture({
    facets: [],
    highlights: [],
    recentRecords: [],
    guide: null,
    facilities: [],
    summary: {
      recordCount: null,
      contributorCount: null,
      firstRecordedAt: null,
      latestRecordedAt: null,
    },
    publication: {
      status: "suppressed",
      suppressedSections: ["contribution_cta", "recent_records", "themes"],
      locationMode: "field",
    },
  });
  const html = renderMapPlaceAtlasProfile(profile, options);

  assert.match(html, /data-place-atlas-state="suppressed"/);
  assert.doesNotMatch(html, /me-place-atlas-facet/);
  assert.doesNotMatch(html, /map:place_atlas:record_here/);
  assert.match(html, /map:place_atlas:browse_records/);
  assert.match(html, /一部の情報を表示していません/);
});

test("unknown venue rules show check guidance without a direct contribution CTA", () => {
  const html = renderMapPlaceAtlasProfile(fixture({
    policy: {
      placeVisibility: "public",
      recordingPolicy: "check_rules",
      publicLocationMode: "place",
      contributionCtaMode: "check_rules",
      ruleSource: "osm_access",
      ruleUrl: null,
      reason: "osm_access_does_not_imply_recording_permission",
    },
  }), options);

  assert.match(html, /撮影・記録の前に、施設の案内と現地ルールを確認/);
  assert.doesNotMatch(html, /map:place_atlas:record_here/);
  assert.match(html, /施設ルール・出典/);
});

test("untrusted names and external-looking record hrefs are escaped or rejected", () => {
  const profile = fixture({
    place: {
      ...fixture().place,
      name: "<img src=x onerror=alert(1)>",
    },
    recentRecords: [{
      ...fixture().recentRecords[0]!,
      href: "https://evil.test/record",
      displayName: "<script>alert(1)</script>",
      mediaUrl: "https://tracking.evil.test/photo.jpg",
    }],
  });
  const html = renderMapPlaceAtlasProfile(profile, options);

  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /https:\/\/evil\.test/);
  assert.doesNotMatch(html, /tracking\.evil\.test/);
  assert.match(html, /&lt;script&gt;alert/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("loading and error states are distinct and accessible", () => {
  const loading = renderMapPlaceAtlasLoading("ja", "常磐公園");
  const error = renderMapPlaceAtlasError("ja");

  assert.match(loading, /data-place-atlas-state="loading"/);
  assert.match(loading, /aria-live="polite"/);
  assert.match(error, /data-place-atlas-state="error"/);
  assert.match(error, /role="status"/);
});

test("runtime is valid JavaScript and styles cover touch, focus, mobile peek, and reduced motion", () => {
  const html = renderMapPlaceAtlasProfile(fixture(), options);
  const context = vm.createContext({ URL });
  assert.doesNotThrow(() => new vm.Script(MAP_PLACE_ATLAS_PROFILE_RUNTIME).runInContext(context));
  const runtime = (context as {
    MapPlaceAtlasProfile?: {
      render: (profile: PlaceAtlasProfile, renderOptions: typeof options) => string;
    };
  }).MapPlaceAtlasProfile;
  assert.ok(runtime);
  const runtimeHtml = runtime.render(fixture(), options);
  assert.match(runtimeHtml, /data-place-atlas-theme="nature"/);
  assert.match(runtimeHtml, /施設ルール・出典/);
  assert.match(runtimeHtml, /公式ルール/);
  assert.match(html, /data-place-atlas-theme="nature"/);
  assert.match(html, /role="button" tabindex="0" aria-pressed="false"/);
  assert.match(MAP_PLACE_ATLAS_PROFILE_RUNTIME, /ikimon:place-atlas-image-error/);
  assert.match(MAP_PLACE_ATLAS_PROFILE_RUNTIME, /ikimon:place-atlas-theme-open/);
  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, /min-height: 46px/);
  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, /:focus-visible/);
  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, /data-snap="peek"/);
  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, /prefers-reduced-motion: reduce/);
  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, /min-width: 0/);
  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, /me-place-atlas-image-fallback/);
  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, /is-image-error > \.me-place-atlas-image-fallback/);
  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, /@media \(min-width: 1280px\)/);
  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, /@media \(max-width: 900px\)/);
  assert.doesNotMatch(MAP_PLACE_ATLAS_PROFILE_STYLES, /@platform_v2|observationMedia\.ts/);
});
