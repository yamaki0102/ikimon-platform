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
  assert.doesNotThrow(() => new vm.Script(MAP_PLACE_ATLAS_PROFILE_RUNTIME));
  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, /min-height: 46px/);
  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, /:focus-visible/);
  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, /data-snap="peek"/);
  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, /prefers-reduced-motion: reduce/);
  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, /min-width: 0/);
  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, /@media \(min-width: 1280px\)/);
  assert.match(MAP_PLACE_ATLAS_PROFILE_STYLES, /@media \(max-width: 900px\)/);
  assert.doesNotMatch(MAP_PLACE_ATLAS_PROFILE_STYLES, /@platform_v2|observationMedia\.ts/);
});
