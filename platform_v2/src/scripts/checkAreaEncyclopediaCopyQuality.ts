import { AREA_SPOT_TYPE_LABELS } from "../services/areaEncyclopediaPayload.js";
import type { AreaPlaceSnapshot } from "../services/areaPlaceSnapshot.js";
import type { FieldStats, ObservationField } from "../services/observationFieldRegistry.js";
import { renderFieldDetailBody } from "../ui/observationFieldDetail.js";

function parkField(payload: ObservationField["payload"] = {}): ObservationField {
  return {
    fieldId: "copy-gate-park",
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
    payload,
    createdAt: "2026-05-01",
    updatedAt: "2026-05-01",
  };
}

function stats(): FieldStats {
  return {
    fieldId: "copy-gate-park",
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
    field: { fieldId: "copy-gate-park" },
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

function fieldWithSpot(): ObservationField {
  return parkField({
    area_encyclopedia: {
      page_kind: "area",
      tags: ["浜名湖", "水辺"],
      spots: [
        {
          id: "reed-bed",
          name: "葦原デッキ",
          type: "water_care",
          summary: "水辺の変化を見やすい入口です。",
          public_record_count: 8,
          guide_count: 1,
        },
      ],
      local_guides: [],
      actors: [],
      external_links: [],
    },
  });
}

function extractAreaSpotSection(html: string): string {
  const start = html.indexOf('<section class="field-area-spots"');
  if (start < 0) return "";
  const end = html.indexOf("</section>", start);
  return end < 0 ? html.slice(start) : html.slice(start, end + "</section>".length);
}

function extractAreaGrowthSection(html: string): string {
  const start = html.indexOf('<section class="field-area-growth-empty"');
  if (start < 0) return "";
  const end = html.indexOf("</section>", start);
  return end < 0 ? html.slice(start) : html.slice(start, end + "</section>".length);
}

const failures: string[] = [];

const emptyHtml = renderFieldDetailBody({ field: parkField(), stats: stats(), snapshot: snapshot() });
const emptySection = extractAreaSpotSection(emptyHtml);
const emptyGrowthSection = extractAreaGrowthSection(emptyHtml);

if (emptySection) {
  failures.push("area encyclopedia spot section must be omitted in empty-state render");
}

if (!emptyGrowthSection) {
  failures.push("area encyclopedia empty-state render must include consolidated growth block");
}

for (const required of ["この図鑑はこれから育つ", "現地で見る入口へ", "field-local-guides"]) {
  if (!emptyGrowthSection.includes(required)) {
    failures.push(`area empty-state copy must include: ${required}`);
  }
}

for (const forbidden of [
  "近くのスポットはまだありません",
  "園内の見どころはこれから",
  "関連する企業・団体はまだありません",
  "<strong>0</strong><span>近くのスポット</span>",
  AREA_SPOT_TYPE_LABELS.park_land,
  "field-spot-filters",
  "data-spot-filter",
]) {
  if (emptyHtml.includes(forbidden)) {
    failures.push(`area empty-state copy must not deny or filter parent spot categories: ${forbidden}`);
  }
}

const spottedHtml = renderFieldDetailBody({ field: fieldWithSpot(), stats: stats(), snapshot: snapshot() });
const spottedSection = extractAreaSpotSection(spottedHtml);

for (const required of ["Area Spots", "近くのスポット", "field-spot-filters", AREA_SPOT_TYPE_LABELS.park_land, "葦原デッキ"]) {
  if (!spottedSection.includes(required)) {
    failures.push(`area spot list with records must keep existing spot navigation: ${required}`);
  }
}

if (spottedSection.includes("園内の見どころはこれから")) {
  failures.push("area spot list with records must not show empty-state copy");
}

if (failures.length > 0) {
  console.error("Area encyclopedia copy quality gate failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PASS: area encyclopedia empty-state copy avoids denying parent park categories");
