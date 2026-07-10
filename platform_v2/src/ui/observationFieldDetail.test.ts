import test from "node:test";
import assert from "node:assert/strict";
import { FIELD_DETAIL_ALBUM_STYLES, fieldDetailScript, renderFieldDetailBody } from "./observationFieldDetail.js";
import { RECORD_CARD_SIZING_TOKENS } from "./recordCardSizing.js";
import type { ObservationField, FieldStats } from "../services/observationFieldRegistry.js";
import type { AreaPlaceSnapshot } from "../services/areaPlaceSnapshot.js";

function field(): ObservationField {
  return {
    fieldId: "5133aea8-7b1d-49b2-950e-b3c9ac74bc79",
    source: "user_defined",
    adminLevel: "osm_park",
    name: "牧志公園",
    nameKana: "",
    summary: "",
    prefecture: "沖縄県",
    city: "那覇市",
    lat: 26.2179484,
    lng: 127.6918878,
    radiusM: 50,
    polygon: null,
    areaHa: null,
    certificationId: "",
    certifiedAt: null,
    officialUrl: "",
    ownerUrl: "",
    storyUrl: "",
    certificationUrl: "",
    sourceConfidence: 0.45,
    verificationLevel: "unverified",
    verificationMethod: "",
    verificationLabel: "",
    verificationUpdatedAt: null,
    ownerUserId: null,
    entityKey: "",
    validFrom: null,
    validTo: null,
    supersededBy: null,
    payload: {},
    createdAt: "2026-05-01",
    updatedAt: "2026-05-01",
  };
}

function sourcedField(): ObservationField {
  return {
    ...field(),
    source: "nature_symbiosis_site",
    ownerUrl: "https://example.com/owner",
    certificationUrl: "https://example.com/cert",
    storyUrl: "https://ikimon.life/stories/field",
    verificationLabel: "認定情報と一致",
  };
}

function encyclopediaField(): ObservationField {
  return {
    ...field(),
    payload: {
      area_encyclopedia: {
        page_kind: "area",
        tags: ["浜名湖", "水辺"],
        spots: [
          {
            id: "reed-bed",
            name: "葦原デッキ",
            type: "water_care",
            summary: "水辺の変化を見やすい入口です。",
            lat: 34.7221,
            lng: 137.6292,
            public_record_count: 8,
            guide_count: 1,
            actor_ids: ["actor-1"],
          },
          {
            id: "lakeside-table",
            name: "湖畔の食",
            type: "food",
            summary: "記録の後に立ち寄れる場所です。",
            public_record_count: 0,
            guide_count: 0,
          },
        ],
        local_guides: [
          {
            id: "guide-1",
            spot_id: "reed-bed",
            title: "葦原の声を聞く",
            status: "planned",
            unlock_radius_m: 50,
            transcript_available: true,
            audio_duration_seconds: 125,
            languages: ["ja"],
            transcript: "ロック前に出してはいけない本文",
            audio_url: "https://example.com/private/audio.mp3",
          },
        ],
        actors: [
          {
            id: "actor-1",
            name: "浜名湖パートナーズ",
            role_label: "案内協力",
            url: "https://example.com/actors/1",
          },
        ],
        external_links: [
          { label: "外部名鑑", url: "https://example.com/directory" },
        ],
      },
    },
  };
}

function stats(): FieldStats {
  return {
    fieldId: "5133aea8-7b1d-49b2-950e-b3c9ac74bc79",
    totalSessions: 0,
    liveSessions: 0,
    totalObservations: 0,
    uniqueSpeciesCount: 0,
    totalAbsences: 0,
    totalParticipants: 0,
    topTaxa: [],
    recentSessions: [],
  };
}

function snapshot(): AreaPlaceSnapshot {
  return {
    field: { fieldId: "5133aea8-7b1d-49b2-950e-b3c9ac74bc79" },
    observationSummary: {
      totalObservations: 50,
      totalVisits: 19,
      totalEvents: 0,
      liveEvents: 0,
      uniqueTaxa: 43,
      latestObservedAt: "2026-05-08T10:30:00.000Z",
      taxonRankCount: 4,
      seasonsCovered: 1,
      seasonCoverageCap: 4,
      seasonLabels: ["春"],
      effortCompletionRate: 0,
      reviewAcceptedRate: 1,
      nativeCount: 0,
      exoticCount: 0,
      unknownOriginCount: 50,
      absentRecords: 0,
      stewardshipActionCount: 0,
      topTaxa: [],
    },
    relationshipScore: { score: { totalScore: 20 } },
    observationGallery: [],
    seasonalCoverage: [],
  } as unknown as AreaPlaceSnapshot;
}

function snapshotWithAlbumRecord(): AreaPlaceSnapshot {
  const base = snapshot();
  return {
    ...base,
    observationGallery: [
      {
        occurrenceId: "occ:record-1778828354813:1",
        visitId: "record-1778828354813",
        displayName: "ツルニチニチソウ ほか1件",
        observedAt: "2026-05-20T10:30:00.000Z",
        photoUrl: "/uploads/photos/sample.jpg",
        localityLabel: "静岡市 / 静岡県",
        observationCount: 2,
        recentObservationCount: 2,
        likeCount: 0,
        season: "spring",
        seasonLabel: "春",
        isCurrentSeason: true,
        visibility: "public",
        privacyLabel: null,
        privacyReason: null,
        shareAllowed: true,
      },
    ],
  } as unknown as AreaPlaceSnapshot;
}

test("field detail metrics use place snapshot observations when event stats are empty", () => {
  const html = renderFieldDetailBody({ field: field(), stats: stats(), snapshot: snapshot() });

  assert.match(html, /<strong>19<\/strong><span>記録回数<\/span>/);
  assert.match(html, /<strong>43<\/strong><span>累計種数<\/span>/);
  assert.match(html, /<strong>50<\/strong><span>累計記録<\/span>/);
  assert.match(html, /<span>最終記録<\/span><strong>2026年5月8日<\/strong>/);
  assert.doesNotMatch(html, /観察レコード|観察記録はまだありません|累計観察|最終観察/);
  assert.doesNotMatch(html, /<strong>0<\/strong><span>開催回数<\/span>/);
});

test("field detail starts with the area encyclopedia hero before numeric record metrics", () => {
  const html = renderFieldDetailBody({ field: field(), stats: stats(), snapshot: snapshot() });

  const areaHeroIndex = html.indexOf('<article class="field-area-hero">');
  const metricsIndex = html.indexOf('<section class="field-detail-metrics"');
  const numericIndex = html.indexOf("<span>記録回数</span>");

  assert.ok(areaHeroIndex >= 0);
  assert.ok(metricsIndex > areaHeroIndex);
  assert.ok(numericIndex > metricsIndex);
  assert.match(html, /このエリアで記録する/);
  assert.match(html, /公開範囲: 位置をぼかして表示/);
  assert.doesNotMatch(html, /data-evt-field-map/);
});

test("area encyclopedia renders stable empty states without payload", () => {
  const html = renderFieldDetailBody({ field: field(), stats: stats(), snapshot: snapshot() });

  assert.match(html, /エリア図鑑/);
  assert.match(html, /利用者が作成したエリア/);
  assert.match(html, /確認待ち/);
  assert.match(html, /正確な座標とジオメトリ本体は、この公開ページでは表示しません。/);
  assert.match(html, /<strong>50<\/strong><span>公開記録<\/span>/);
  assert.match(html, /<strong>0<\/strong><span>近くのスポット<\/span>/);
  assert.match(html, /<strong>3<\/strong><span>ガイド候補<\/span>/);
  assert.match(html, /近くのスポットはまだありません/);
  assert.match(html, /現地で聞けるガイド/);
  assert.match(html, /はじめての1分ガイド/);
  assert.match(html, /季節の入口ガイド/);
  assert.match(html, /木のまわりガイド/);
  assert.doesNotMatch(html, /関連する企業・団体はまだありません/);
  assert.doesNotMatch(html, /user_defined|unverified/);
});

test("area encyclopedia renders spots, guides, and actors without exposing spot coordinates", () => {
  const html = renderFieldDetailBody({ field: encyclopediaField(), stats: stats(), snapshot: snapshot() });

  assert.match(html, /葦原デッキ/);
  assert.match(html, /守る水辺/);
  assert.match(html, /湖畔の食/);
  assert.match(html, /<strong>2<\/strong><span>近くのスポット<\/span>/);
  assert.match(html, /<strong>1<\/strong><span>現地ガイド<\/span>/);
  assert.match(html, /葦原の声を聞く/);
  assert.match(html, /予定あり/);
  assert.match(html, /半径約 50m/);
  assert.match(html, /文字起こしあり/);
  assert.match(html, /2分5秒/);
  assert.match(html, /位置情報は保存しない/);
  assert.match(html, /浜名湖パートナーズ/);
  assert.match(html, /外部名鑑/);
  assert.doesNotMatch(html, /ロック前に出してはいけない本文|audio\.mp3/);
  assert.doesNotMatch(html, /34\.7221|137\.6292|data-area-spots/);
});

test("area encyclopedia screen copy avoids reserved implementation and brand terms", () => {
  const html = renderFieldDetailBody({ field: encyclopediaField(), stats: stats(), snapshot: snapshot() });
  const blocked = [
    "子エリア",
    "代表",
    "大エリア",
    "全部並べず",
    "登録単位",
    "解放",
    "保全地",
    "GX",
    "ネイチャーポジティブ",
    "自然共生サイト",
    "実装",
    "要件",
    "仕様",
    "ikimon.life",
  ];

  for (const word of blocked) {
    assert.doesNotMatch(html, new RegExp(word.replace(".", "\\.")));
  }
});

test("field detail map script uses only area spot coordinates for markers", () => {
  const script = fieldDetailScript();

  assert.match(script, /areaSpots\.filter\(isPublicSpot\)\.forEach/);
  assert.match(script, /field-spot-map-pin/);
  assert.doesNotMatch(script, /buildCircle/);
  assert.doesNotMatch(script, /field-map-pin/);
});

test("field detail public html does not expose exact field coordinate or geometry attributes", () => {
  const html = renderFieldDetailBody({ field: field(), stats: stats(), snapshot: snapshot() });

  assert.doesNotMatch(html, /data-lat|data-lng|data-radius|data-polygon|data-area-spots/);
  assert.doesNotMatch(html, /26\.2179484|127\.6918878/);
  assert.doesNotMatch(html, /"Polygon"|"coordinates"/);
});

test("field detail can reload the latest area sketch draft and overlay normalized polygon", () => {
  const html = renderFieldDetailBody({ field: field(), stats: stats(), snapshot: snapshot() });
  const script = fieldDetailScript();

  assert.match(html, /data-area-sketch-panel hidden/);
  assert.match(html, /保存済み下書き診断/);
  assert.match(html, /data-area-sketch-summary/);
  assert.match(html, /不足資料リスト/);
  assert.match(script, /\/api\/v1\/fields\/" \+ encodeURIComponent\(fieldId\) \+ "\/area-sketch-assessments\?limit=1/);
  assert.match(script, /credentials: "same-origin"/);
  assert.match(script, /response\.status === 401/);
  assert.match(script, /assessment\.normalizedPolygon/);
  assert.match(script, /area-sketch-draft-fill/);
  assert.match(script, /area-sketch-draft-line/);
});

test("field detail area sketch copy keeps estimates inside the precheck boundary", () => {
  const html = renderFieldDetailBody({ field: field(), stats: stats(), snapshot: snapshot() });
  const script = fieldDetailScript();

  assert.match(html, /Area Sketch Assist/);
  assert.match(script, /正式申請、測量、行政判断、認定取得を保証するものではありません/);
  assert.match(script, /escapeText\(item\.reason\)/);
  assert.doesNotMatch(html + script, /認定されます|申請できます|正式面積/);
});

test("field detail area hero stays compact on desktop", () => {
  assert.match(FIELD_DETAIL_ALBUM_STYLES, /max-width: 1160px;/);
  assert.match(FIELD_DETAIL_ALBUM_STYLES, /\.field-area-hero \{[\s\S]*grid-template-columns: minmax\(0, 1\.35fr\) minmax\(280px, \.65fr\);/);
  assert.match(FIELD_DETAIL_ALBUM_STYLES, /\.field-area-hero \{[\s\S]*padding: clamp\(18px, 3vw, 30px\);/);
  assert.doesNotMatch(FIELD_DETAIL_ALBUM_STYLES, /min-height: clamp\(480px, 58vw, 660px\);/);
  assert.match(FIELD_DETAIL_ALBUM_STYLES, /@media \(max-width: 1020px\) \{[\s\S]*\.field-area-hero \{[\s\S]*grid-template-columns: 1fr;/);
});

test("field detail keeps one primary hero action and moves trust links lower", () => {
  const html = renderFieldDetailBody({ field: sourcedField(), stats: stats(), snapshot: snapshot() });

  const heroStart = html.indexOf('<article class="field-area-hero">');
  const heroEnd = html.indexOf("</article>", heroStart);
  const metricsIndex = html.indexOf('<section class="field-detail-metrics"');
  const trustIndex = html.indexOf('<section class="field-trust-info"');
  const heroHtml = html.slice(heroStart, heroEnd);
  const heroPrimaryCount = (heroHtml.match(/class="evt-btn evt-btn-primary/g) ?? []).length;

  assert.equal(heroPrimaryCount, 1);
  assert.match(heroHtml, /このエリアで記録する/);
  assert.match(heroHtml, /この場所のいま/);
  assert.match(heroHtml, /公開写真 \/ 季節/);
  assert.match(heroHtml, /認定情報と一致/);
  assert.doesNotMatch(heroHtml, /公式 ↗|認定情報 ↗|事例 ↗/);
  assert.ok(trustIndex > metricsIndex);
  assert.match(html.slice(trustIndex), /公式 ↗/);
  assert.match(html.slice(trustIndex), /認定情報 ↗/);
  assert.match(html.slice(trustIndex), /事例 ↗/);
  assert.match(html.slice(trustIndex), /認定情報と一致/);
});

test("field album links cards to the record instead of the subject occurrence", () => {
  const html = renderFieldDetailBody({ field: field(), stats: stats(), snapshot: snapshotWithAlbumRecord() });

  assert.match(html, /href="\/observations\/record-1778828354813"/);
  assert.doesNotMatch(html, /href="\/observations\/occ%3Arecord-1778828354813%3A1"/);
  assert.match(html, /ツルニチニチソウ ほか1件/);
});

test("field album cards keep the same sizing contract as the landing content wall", () => {
  const html = renderFieldDetailBody({ field: field(), stats: stats(), snapshot: snapshotWithAlbumRecord() });

  assert.match(html, /class="field-album-thumb"/);
  assert.match(html, /class="field-album-body"/);
  assert.match(RECORD_CARD_SIZING_TOKENS, /--ikimon-record-card-grid-desktop: repeat\(6, minmax\(0, 1fr\)\);/);
  assert.match(RECORD_CARD_SIZING_TOKENS, /--ikimon-record-card-thumb-ratio: 4 \/ 5;/);
  assert.match(FIELD_DETAIL_ALBUM_STYLES, /\.field-album-grid \{[\s\S]*grid-template-columns: var\(--ikimon-record-card-grid-desktop\)/);
  assert.match(FIELD_DETAIL_ALBUM_STYLES, /\.field-album-thumb \{[\s\S]*aspect-ratio: var\(--ikimon-record-card-thumb-ratio\)/);
  assert.match(FIELD_DETAIL_ALBUM_STYLES, /@media \(max-width: 1020px\) \{[\s\S]*grid-template-columns: var\(--ikimon-record-card-grid-tablet\)/);
  assert.match(FIELD_DETAIL_ALBUM_STYLES, /@media \(max-width: 720px\) \{[\s\S]*grid-template-columns: var\(--ikimon-record-card-grid-mobile\)/);
});
