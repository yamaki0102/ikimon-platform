import type { FastifyInstance } from "fastify";
import { detectLangFromUrl, type SiteLang } from "../i18n.js";
import type { ObservationField, FieldStats } from "../services/observationFieldRegistry.js";
import { buildAreaWatch } from "../services/areaWatch.js";
import { getAreaPlaceSnapshot, type AreaPlaceSnapshot } from "../services/areaPlaceSnapshot.js";
import { composePlaceSnapshot } from "../services/placeSnapshot.js";
import { PLACE_SNAPSHOT_STYLES, renderPlaceSnapshotBody } from "../ui/placeSnapshot.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

type LabCase = "renri-empty" | "renri-production-export" | "renri-growing" | "park-photo" | "school-empty";
type LabSource = "auto" | "db" | "fixture";
type LabVariant = "current" | "story";

const CASES: LabCase[] = ["renri-production-export", "renri-empty", "renri-growing", "park-photo", "school-empty"];
const SOURCES: LabSource[] = ["auto", "db", "fixture"];
const VARIANTS: LabVariant[] = ["story", "current"];
const RENRI_FIELD_ID = "7cb246a5-388b-4acb-b701-2bfd698fac13";

function requestUrl(request: { url?: string; raw?: { url?: string; originalUrl?: string } }): string {
  return String(request.raw?.originalUrl ?? request.raw?.url ?? request.url ?? "");
}

function labUrl(caseId: LabCase, variant: LabVariant, source: LabSource): string {
  return `/dev/place-snapshot-lab?case=${encodeURIComponent(caseId)}&variant=${encodeURIComponent(variant)}&source=${encodeURIComponent(source)}`;
}

function normalizeCase(value: unknown): LabCase {
  return CASES.includes(value as LabCase) ? value as LabCase : "renri-empty";
}

function normalizeVariant(value: unknown): LabVariant {
  return VARIANTS.includes(value as LabVariant) ? value as LabVariant : "story";
}

function normalizeSource(value: unknown): LabSource {
  return SOURCES.includes(value as LabSource) ? value as LabSource : "auto";
}

function baseField(overrides: Partial<ObservationField> = {}): ObservationField {
  return {
    fieldId: RENRI_FIELD_ID,
    source: "nature_symbiosis_site",
    adminLevel: "symbiosis",
    name: "愛管株式会社 連理の木の下で",
    nameKana: "",
    summary: "公開範囲と安全導線がある自然共生サイト",
    prefecture: "静岡県",
    city: "浜松市浜名区",
    lat: 34.814,
    lng: 137.732,
    radiusM: 160,
    polygon: null,
    areaHa: 1.3,
    certificationId: "aikan-renri-ikan-hq",
    certifiedAt: null,
    officialUrl: "",
    ownerUrl: "",
    storyUrl: "",
    certificationUrl: "",
    sourceConfidence: 0.75,
    verificationLevel: "unverified",
    verificationMethod: "",
    verificationLabel: "",
    verificationUpdatedAt: null,
    ownerUserId: null,
    payload: {},
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
    ...overrides,
  };
}

function stats(overrides: Partial<FieldStats> = {}): FieldStats {
  return {
    fieldId: RENRI_FIELD_ID,
    totalSessions: 0,
    liveSessions: 0,
    totalObservations: 0,
    uniqueSpeciesCount: 0,
    totalAbsences: 0,
    totalParticipants: 0,
    topTaxa: [],
    recentSessions: [],
    ...overrides,
  };
}

function areaSnapshot(args: {
  field: ObservationField;
  stats: FieldStats;
  canonical: Parameters<typeof composePlaceSnapshot>[0]["canonical"];
  gallery?: AreaPlaceSnapshot["observationGallery"];
  now?: Date;
}): AreaPlaceSnapshot {
  const snapshot = composePlaceSnapshot({
    field: args.field,
    stats: args.stats,
    canonical: args.canonical,
    placeId: args.field.fieldId,
    now: args.now ?? new Date("2026-05-20T00:00:00.000Z"),
  });
  const months = new Set(args.canonical.months);
  const seasonalCoverage: AreaPlaceSnapshot["seasonalCoverage"] = [
    { season: "spring", label: "春", observations: months.has(3) || months.has(4) || months.has(5) ? Math.max(1, args.canonical.totalObservations) : 0, isCurrentSeason: true },
    { season: "summer", label: "夏", observations: months.has(6) || months.has(7) || months.has(8) ? 1 : 0, isCurrentSeason: false },
    { season: "autumn", label: "秋", observations: months.has(9) || months.has(10) || months.has(11) ? 1 : 0, isCurrentSeason: false },
    { season: "winter", label: "冬", observations: months.has(12) || months.has(1) || months.has(2) ? 1 : 0, isCurrentSeason: false },
  ];
  const observationGallery = args.gallery ?? [];
  const evidenceStats = {
    totalOccurrences: args.canonical.totalObservations,
    photoOccurrences: observationGallery.filter((item) => item.photoUrl).length,
    contextPhotoOccurrences: observationGallery.length > 0 ? 1 : 0,
    primarySubjectPhotoOccurrences: observationGallery.filter((item) => item.photoUrl).length,
    recent90Occurrences: Math.min(args.canonical.totalObservations, observationGallery.reduce((sum, item) => sum + item.recentObservationCount, 0)),
    recent180Occurrences: Math.min(args.canonical.totalObservations, observationGallery.reduce((sum, item) => sum + item.recentObservationCount, 0) + 1),
    reviewedOccurrences: args.canonical.acceptedCount,
    aiCandidateOccurrences: Math.max(0, args.canonical.reviewTotal - args.canonical.acceptedCount),
    methodContextVisits: args.canonical.effortFilled,
    latestObservedAt: args.canonical.totalObservations > 0 ? "2026-05-12T09:00:00.000Z" : null,
  };
  const effortIndicators: AreaPlaceSnapshot["effortIndicators"] = {
    effortReportedRate: args.canonical.effortTotal > 0 ? args.canonical.effortFilled / args.canonical.effortTotal : 0,
    completeChecklistRate: args.canonical.effortTotal > 0 ? args.canonical.effortFilled / args.canonical.effortTotal : 0,
    temporalSpreadIndex: Math.min(1, args.canonical.months.length / 12),
    observerDiversity: args.stats.totalParticipants > 1 ? 0.58 : 0,
    nonDetectionRate: args.stats.totalAbsences > 0 && args.stats.totalSessions > 0 ? args.stats.totalAbsences / args.stats.totalSessions : 0,
    effortIndex: 0,
    observerCount: args.stats.totalParticipants,
    topObserverShare: args.stats.totalParticipants > 1 ? 0.5 : 1,
    yearsCovered: args.canonical.totalVisits > 0 ? 1 : 0,
    monthsCovered: args.canonical.months.length,
    seasonsCovered: seasonalCoverage.filter((row) => row.observations > 0).length,
  };
  effortIndicators.effortIndex = Math.round((
    effortIndicators.effortReportedRate +
    effortIndicators.completeChecklistRate +
    effortIndicators.temporalSpreadIndex +
    effortIndicators.observerDiversity +
    effortIndicators.nonDetectionRate
  ) * 20);

  return {
    ...snapshot,
    representativePhoto: observationGallery[0]?.photoUrl ? {
      source: "community_curated",
      photoUrl: observationGallery[0].photoUrl,
      displayName: observationGallery[0].displayName,
      observedAt: observationGallery[0].observedAt,
      localityLabel: observationGallery[0].localityLabel,
      occurrenceId: observationGallery[0].occurrenceId,
      visitId: observationGallery[0].visitId,
    } : null,
    observationGallery,
    seasonalCoverage,
    yearlyTimeline: args.canonical.totalObservations > 0
      ? [{ year: 2026, observations: args.canonical.totalObservations, uniqueTaxa: args.canonical.uniqueTaxa, visits: args.canonical.totalVisits, effortVisits: args.canonical.effortFilled, completeChecklists: args.canonical.effortFilled }]
      : [],
    effortIndicators,
    sensitiveMasking: { totalRare: 0, maskedSpecies: 0, viewerCanSeeExact: false },
    firstSeenSpecies: [],
    environmentChange: null,
    areaWatch: buildAreaWatch({
      totalObservations: args.canonical.totalObservations,
      totalVisits: args.canonical.totalVisits,
      uniqueTaxa: args.canonical.uniqueTaxa,
      seasonalCoverage,
      yearlyTimeline: args.canonical.totalObservations > 0
        ? [{ year: 2026, observations: args.canonical.totalObservations, uniqueTaxa: args.canonical.uniqueTaxa, visits: args.canonical.totalVisits, effortVisits: args.canonical.effortFilled, completeChecklists: args.canonical.effortFilled }]
        : [],
      effortIndicators,
      sensitiveMasking: { totalRare: 0, maskedSpecies: 0, viewerCanSeeExact: false },
      evidenceStats,
    }),
  };
}

function fixtureSnapshot(caseId: LabCase): AreaPlaceSnapshot {
  if (caseId === "renri-production-export") {
    return areaSnapshot({
      field: baseField(),
      stats: stats({
        totalSessions: 6,
        totalObservations: 24,
        uniqueSpeciesCount: 20,
        totalParticipants: 1,
        topTaxa: [
          { name: "イネ科植物", count: 3 },
          { name: "カラスノエンドウ", count: 3 },
          { name: "カタバミ属", count: 2 },
          { name: "コメツブツメクサ", count: 1 },
          { name: "セイヨウミツバチ", count: 1 },
          { name: "ヤブガラシ類", count: 1 },
        ],
      }),
      canonical: {
        totalObservations: 24,
        totalVisits: 6,
        uniqueTaxa: 20,
        taxonRankCount: 4,
        months: [5],
        effortFilled: 0,
        effortTotal: 6,
        acceptedCount: 6,
        reviewTotal: 6,
        nativeCount: 0,
        exoticCount: 0,
        unknownOriginCount: 24,
        stewardshipActionCount: 0,
      },
      gallery: [
        { occurrenceId: "occ:record-1779175247111:1", visitId: "record-1779175247111", displayName: "コメツブツメクサ", observedAt: "2026-05-19T07:20:29.000Z", photoUrl: "https://ikimon.life/uploads/v2-observations/record-1779175247111/ikimon-photo-1779175243409-dc58afb8d90b.jpg", localityLabel: "連理の木の下で", observationCount: 1, recentObservationCount: 1, likeCount: 0, season: "spring", seasonLabel: "春", isCurrentSeason: true },
        { occurrenceId: "occ:record-1779062106798:1", visitId: "record-1779062106798", displayName: "アメリカフウロ", observedAt: "2026-05-17T23:54:31.000Z", photoUrl: "https://ikimon.life/uploads/v2-observations/record-1779062106798/ikimon-photo-1779062100847-81212dccaf81.jpg", localityLabel: "連理の木の下で", observationCount: 1, recentObservationCount: 1, likeCount: 0, season: "spring", seasonLabel: "春", isCurrentSeason: true },
        { occurrenceId: "occ:record-1778828354813:1", visitId: "record-1778828354813", displayName: "カラスノエンドウ", observedAt: "2026-05-15T06:58:55.000Z", photoUrl: "https://ikimon.life/uploads/v2-observations/record-1778828354813/ikimon-photo-1778828352636-8f883029cb7f.jpg", localityLabel: "連理の木の下で", observationCount: 1, recentObservationCount: 1, likeCount: 0, season: "spring", seasonLabel: "春", isCurrentSeason: true },
        { occurrenceId: "occ:record-1778549526406:2", visitId: "record-1778549526406", displayName: "セイヨウミツバチ", observedAt: "2026-05-12T01:31:36.000Z", photoUrl: "https://ikimon.life/uploads/v2-observations/record-1778549526406/ikimon-photo-1778549521254-ff9ad82f19f7.jpg", localityLabel: "連理の木の下で", observationCount: 1, recentObservationCount: 1, likeCount: 0, season: "spring", seasonLabel: "春", isCurrentSeason: true },
      ],
    });
  }
  if (caseId === "renri-growing") {
    return areaSnapshot({
      field: baseField(),
      stats: stats({
        totalSessions: 3,
        totalObservations: 8,
        uniqueSpeciesCount: 5,
        totalParticipants: 3,
        topTaxa: [{ name: "シロツメクサ", count: 2 }, { name: "ヤブガラシ", count: 2 }, { name: "モンシロチョウ", count: 1 }],
      }),
      canonical: {
        totalObservations: 8,
        totalVisits: 3,
        uniqueTaxa: 5,
        taxonRankCount: 3,
        months: [4, 5, 10],
        effortFilled: 2,
        effortTotal: 3,
        acceptedCount: 1,
        reviewTotal: 3,
        nativeCount: 3,
        exoticCount: 1,
        unknownOriginCount: 4,
        stewardshipActionCount: 1,
      },
      gallery: [
        { occurrenceId: "11111111-1111-4111-8111-000000000001", visitId: "22222222-2222-4222-8222-000000000001", displayName: "シロツメクサ", observedAt: "2026-05-12T09:00:00.000Z", photoUrl: null, localityLabel: "連理の木の下で", observationCount: 2, recentObservationCount: 2, likeCount: 4, season: "spring", seasonLabel: "春", isCurrentSeason: true },
        { occurrenceId: "11111111-1111-4111-8111-000000000002", visitId: "22222222-2222-4222-8222-000000000002", displayName: "ヤブガラシ", observedAt: "2026-05-12T09:08:00.000Z", photoUrl: null, localityLabel: "連理の木の下で", observationCount: 2, recentObservationCount: 1, likeCount: 2, season: "spring", seasonLabel: "春", isCurrentSeason: true },
      ],
    });
  }
  if (caseId === "park-photo") {
    return areaSnapshot({
      field: baseField({
        fieldId: "99999999-9999-4999-8999-999999999999",
        source: "osm_park",
        adminLevel: "osm_park",
        name: "浜松城公園",
        summary: "街中で季節の生きものに出会える公園",
        city: "浜松市中央区",
        areaHa: 21.4,
        radiusM: 700,
      }),
      stats: stats({ fieldId: "99999999-9999-4999-8999-999999999999", totalSessions: 9, totalObservations: 26, uniqueSpeciesCount: 14, totalParticipants: 6 }),
      canonical: {
        totalObservations: 26,
        totalVisits: 9,
        uniqueTaxa: 14,
        taxonRankCount: 5,
        months: [3, 4, 5, 7, 10],
        effortFilled: 5,
        effortTotal: 9,
        acceptedCount: 3,
        reviewTotal: 9,
        nativeCount: 11,
        exoticCount: 3,
        unknownOriginCount: 12,
        stewardshipActionCount: 0,
      },
      gallery: [
        { occurrenceId: "33333333-3333-4333-8333-000000000001", visitId: "44444444-4444-4444-8444-000000000001", displayName: "ソメイヨシノ", observedAt: "2026-04-02T10:00:00.000Z", photoUrl: null, localityLabel: "浜松城公園", observationCount: 5, recentObservationCount: 2, likeCount: 12, season: "spring", seasonLabel: "春", isCurrentSeason: true },
        { occurrenceId: "33333333-3333-4333-8333-000000000002", visitId: "44444444-4444-4444-8444-000000000002", displayName: "カルガモ", observedAt: "2026-05-08T16:00:00.000Z", photoUrl: null, localityLabel: "浜松城公園", observationCount: 3, recentObservationCount: 1, likeCount: 8, season: "spring", seasonLabel: "春", isCurrentSeason: true },
      ],
    });
  }
  if (caseId === "school-empty") {
    return areaSnapshot({
      field: baseField({
        fieldId: "88888888-8888-4888-8888-888888888888",
        source: "school",
        adminLevel: "school",
        name: "浜松市立いきもの小学校",
        city: "浜松市中央区",
        areaHa: 2.6,
        certificationId: "mext-school:B122210001234",
        entityKey: "mext_school:B122210001234",
      }),
      stats: stats({ fieldId: "88888888-8888-4888-8888-888888888888" }),
      canonical: {
        totalObservations: 0,
        totalVisits: 0,
        uniqueTaxa: 0,
        taxonRankCount: 0,
        months: [],
        effortFilled: 0,
        effortTotal: 0,
        acceptedCount: 0,
        reviewTotal: 0,
        nativeCount: 0,
        exoticCount: 0,
        unknownOriginCount: 0,
        stewardshipActionCount: 0,
      },
    });
  }
  return areaSnapshot({
    field: baseField(),
    stats: stats(),
    canonical: {
      totalObservations: 0,
      totalVisits: 0,
      uniqueTaxa: 0,
      taxonRankCount: 0,
      months: [],
      effortFilled: 0,
      effortTotal: 0,
      acceptedCount: 0,
      reviewTotal: 0,
      nativeCount: 0,
      exoticCount: 0,
      unknownOriginCount: 0,
      stewardshipActionCount: 0,
    },
  });
}

async function loadSnapshot(caseId: LabCase, source: LabSource): Promise<{ snapshot: AreaPlaceSnapshot; sourceLabel: string }> {
  if (source === "auto" || source === "db") {
    const fieldId = caseId === "renri-empty" || caseId === "renri-production-export" || caseId === "renri-growing" ? RENRI_FIELD_ID : fixtureSnapshot(caseId).field.fieldId;
    const snapshot = await getAreaPlaceSnapshot(fieldId, {
      viewer: { isAdminOrAnalyst: false, fieldRole: null },
    }).catch(() => null);
    if (snapshot) return { snapshot, sourceLabel: "local database" };
  }
  const fallbackLabel = source === "db" ? "fixture fallback: database unavailable" : "fixture";
  return { snapshot: fixtureSnapshot(caseId), sourceLabel: fallbackLabel };
}

function renderCaseTabs(activeCase: LabCase, activeVariant: LabVariant, activeSource: LabSource): string {
  return `<nav class="ps-lab-tabs" aria-label="Lab cases">
    ${CASES.map((caseId) => `<a class="${caseId === activeCase ? "is-active" : ""}" href="${escapeHtml(labUrl(caseId, activeVariant, activeSource))}">${escapeHtml(caseId)}</a>`).join("")}
  </nav>`;
}

function renderSourceTabs(activeCase: LabCase, activeVariant: LabVariant, activeSource: LabSource): string {
  return `<nav class="ps-lab-tabs" aria-label="Lab data source">
    ${SOURCES.map((source) => `<a class="${source === activeSource ? "is-active" : ""}" href="${escapeHtml(labUrl(activeCase, activeVariant, source))}">${escapeHtml(source)}</a>`).join("")}
  </nav>`;
}

function renderVariantTabs(activeCase: LabCase, activeVariant: LabVariant, activeSource: LabSource): string {
  return `<nav class="ps-lab-tabs" aria-label="Lab variants">
    ${VARIANTS.map((variant) => `<a class="${variant === activeVariant ? "is-active" : ""}" href="${escapeHtml(labUrl(activeCase, variant, activeSource))}">${escapeHtml(variant)}</a>`).join("")}
  </nav>`;
}

function renderStoryHero(snapshot: AreaPlaceSnapshot, caseId: LabCase, sourceLabel: string): string {
  const gallery = snapshot.observationGallery.slice(0, 4);
  const missingSeasons = snapshot.seasonalCoverage.filter((row) => row.observations <= 0).map((row) => row.label);
  const nextAction = snapshot.areaWatch.nextAction;
  const visualItems = gallery.length > 0
    ? gallery.map((item) => `<article class="ps-lab-visual-card">
        <div class="ps-lab-visual-placeholder"><span>${escapeHtml((item.displayName || "記録").slice(0, 2))}</span></div>
        <strong>${escapeHtml(item.displayName || "同定待ち")}</strong>
        <small>${escapeHtml(item.seasonLabel ?? "季節未設定")} / ${escapeHtml(item.localityLabel ?? snapshot.field.name)}</small>
      </article>`).join("")
    : `<article class="ps-lab-visual-card is-empty">
        <div class="ps-lab-visual-placeholder"><span>初</span></div>
        <strong>最初の写真を待っています</strong>
        <small>生きものだけでなく、草・地面・水辺も1枚</small>
      </article>
      <article class="ps-lab-visual-card is-empty">
        <div class="ps-lab-visual-placeholder"><span>季</span></div>
        <strong>${escapeHtml(missingSeasons.join("・") || "四季")}</strong>
        <small>未記録の季節を、次の訪問理由にする</small>
      </article>`;

  return `<section class="ps-lab-story-hero" aria-label="Place story first view">
    <div class="ps-lab-story-copy">
      <div class="ps-lab-kicker">${escapeHtml(snapshot.field.sourceLabel)} / ${escapeHtml(sourceLabel)} / ${escapeHtml(caseId)}</div>
      <h1>${escapeHtml(snapshot.field.name)}</h1>
      <p>${escapeHtml(snapshot.field.locationLabel)}。この場所で何が始まっていて、次に何を見に行くと面白いかを先に見せる版です。</p>
      <div class="ps-lab-primary-action">
        <a href="/record">この場所で記録する</a>
        <span>${escapeHtml(nextAction.title)}: ${escapeHtml(nextAction.body)}</span>
      </div>
    </div>
    <div class="ps-lab-story-panel">
      <div class="ps-lab-score">
        <span>${escapeHtml(snapshot.areaWatch.label)}</span>
        <strong>${snapshot.areaWatch.score}</strong>
        <small>見守り材料</small>
      </div>
      <div class="ps-lab-visual-grid">${visualItems}</div>
    </div>
  </section>`;
}

export function renderPlaceSnapshotLabPage(args: {
  snapshot: AreaPlaceSnapshot;
  caseId: LabCase;
  source: LabSource;
  variant: LabVariant;
  sourceLabel: string;
  lang?: SiteLang;
  currentPath?: string;
}): string {
  const story = args.variant === "story"
    ? renderStoryHero(args.snapshot, args.caseId, args.sourceLabel)
    : "";
  const body = `<main class="ps-lab-shell ${args.variant === "story" ? "is-story" : "is-current"}">
    <section class="ps-lab-toolbar">
      <div>
        <div class="ps-lab-eyebrow">Local UI Lab</div>
        <h1>Place Snapshot Lab</h1>
        <p>細かい往復を staging に出さず、実装レンダーに近い状態で壊して戻すためのローカル作業場。</p>
      </div>
      <div class="ps-lab-control-groups">
        ${renderCaseTabs(args.caseId, args.variant, args.source)}
        ${renderSourceTabs(args.caseId, args.variant, args.source)}
        ${renderVariantTabs(args.caseId, args.variant, args.source)}
      </div>
    </section>
    ${story}
    <section class="ps-lab-canvas">${renderPlaceSnapshotBody(args.snapshot)}</section>
  </main>`;
  return renderSiteDocument({
    basePath: "",
    title: `Place Snapshot Lab - ${args.snapshot.field.name}`,
    description: "Local UI lab for ikimon.life place snapshot design iterations.",
    extraStyles: `${PLACE_SNAPSHOT_STYLES}\n${PLACE_SNAPSHOT_LAB_STYLES}`,
    lang: args.lang ?? "ja",
    currentPath: args.currentPath ?? "/dev/place-snapshot-lab",
    noindex: true,
    shellClassName: "shell-bleed",
    hideFooter: true,
    body,
  });
}

export async function registerPlaceSnapshotLabRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { case?: string; variant?: string; source?: string } }>("/dev/place-snapshot-lab", async (request, reply) => {
    const caseId = normalizeCase(request.query.case);
    const variant = normalizeVariant(request.query.variant);
    const source = normalizeSource(request.query.source);
    const { snapshot, sourceLabel } = await loadSnapshot(caseId, source);
    reply.type("text/html; charset=utf-8");
    return renderPlaceSnapshotLabPage({
      snapshot,
      caseId,
      source,
      variant,
      sourceLabel,
      lang: detectLangFromUrl(requestUrl(request)),
      currentPath: requestUrl(request),
    });
  });
}

export const __test__ = {
  fixtureSnapshot,
};

const PLACE_SNAPSHOT_LAB_STYLES = `
.ps-lab-shell {
  background: #f7f3ea;
  min-height: 100vh;
  padding: 18px 0 56px;
}
.ps-lab-toolbar {
  max-width: var(--ikimon-content-max);
  margin: 0 auto 14px;
  padding: 18px 16px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 460px);
  gap: 16px;
  align-items: end;
}
.ps-lab-eyebrow,
.ps-lab-kicker {
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: #8a4b18;
}
.ps-lab-toolbar h1,
.ps-lab-story-copy h1 {
  margin: 4px 0 6px;
  letter-spacing: 0;
}
.ps-lab-toolbar p,
.ps-lab-story-copy p {
  margin: 0;
  color: #5f594f;
  line-height: 1.7;
}
.ps-lab-control-groups {
  display: grid;
  gap: 8px;
}
.ps-lab-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}
.ps-lab-tabs a {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  padding: 7px 11px;
  border-radius: 999px;
  background: rgba(255,255,255,.74);
  color: #3f3428;
  border: 1px solid rgba(63,52,40,.14);
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
}
.ps-lab-tabs a.is-active {
  color: #fff;
  background: #1f5132;
  border-color: #1f5132;
}
.ps-lab-story-hero {
  max-width: var(--ikimon-content-max);
  margin: 0 auto 18px;
  min-height: min(72vh, 680px);
  display: grid;
  grid-template-columns: minmax(0, .9fr) minmax(340px, 1.1fr);
  gap: clamp(18px, 4vw, 42px);
  align-items: center;
  padding: clamp(22px, 5vw, 58px) 16px;
}
.ps-lab-story-copy h1 {
  max-width: 11ch;
  font-size: clamp(42px, 8vw, 92px);
  line-height: .98;
  color: #193224;
}
.ps-lab-primary-action {
  margin-top: 24px;
  display: grid;
  gap: 10px;
  max-width: 520px;
}
.ps-lab-primary-action a {
  width: fit-content;
  min-height: 52px;
  display: inline-flex;
  align-items: center;
  padding: 13px 18px;
  border-radius: 12px;
  background: #1f5132;
  color: #fff;
  text-decoration: none;
  font-weight: 900;
}
.ps-lab-primary-action span {
  color: #50483f;
  line-height: 1.7;
}
.ps-lab-story-panel {
  border-radius: 8px;
  background: #fffdf8;
  border: 1px solid rgba(63,52,40,.12);
  box-shadow: 0 22px 56px rgba(44,36,24,.16);
  overflow: hidden;
}
.ps-lab-score {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 12px;
  align-items: end;
  padding: 18px;
  background: #193224;
  color: #f8f4e9;
}
.ps-lab-score strong {
  grid-row: span 2;
  font-size: 64px;
  line-height: .9;
}
.ps-lab-score span,
.ps-lab-score small {
  color: rgba(248,244,233,.82);
}
.ps-lab-visual-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  background: rgba(63,52,40,.12);
}
.ps-lab-visual-card {
  min-height: 188px;
  padding: 14px;
  background: #fffdf8;
  display: grid;
  align-content: space-between;
  gap: 12px;
}
.ps-lab-visual-placeholder {
  min-height: 116px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background:
    linear-gradient(145deg, rgba(44,116,74,.22), rgba(214,138,52,.18)),
    repeating-linear-gradient(35deg, rgba(31,81,50,.10) 0 8px, rgba(255,255,255,.12) 8px 16px);
}
.ps-lab-visual-placeholder span {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(255,253,248,.88);
  color: #1f5132;
  font-weight: 900;
}
.ps-lab-visual-card strong {
  color: #223326;
}
.ps-lab-visual-card small {
  color: #6d6258;
}
.ps-lab-canvas {
  max-width: var(--ikimon-content-max);
  margin: 0 auto;
  background: rgba(255,255,255,.52);
}
.ps-lab-shell.is-story .ps-lab-canvas > .ps-shell > .ps-hero,
.ps-lab-shell.is-story .ps-lab-canvas > .ps-shell > .ps-grid[aria-label="summary metrics"] {
  display: none;
}
@media (max-width: 760px) {
  .ps-lab-toolbar,
  .ps-lab-story-hero {
    grid-template-columns: 1fr;
  }
  .ps-lab-tabs {
    justify-content: flex-start;
  }
  .ps-lab-story-hero {
    min-height: auto;
    padding-top: 22px;
  }
  .ps-lab-story-copy h1 {
    max-width: 12ch;
    font-size: 46px;
  }
  .ps-lab-visual-grid {
    grid-template-columns: 1fr;
  }
}
`;
