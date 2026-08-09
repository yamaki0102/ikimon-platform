/**
 * Transitional municipal walk-map catalog helpers.
 *
 * This module is intentionally PostgreSQL-free. Production municipal walk-map
 * read/write/admin routes are owned by Cloudflare Worker + D1; this file only
 * keeps the static source catalog, draft config helpers, and public read-model
 * transforms until that catalog is moved fully into the Worker/D1 lane.
 */
export type MunicipalWalkMapThemeV0 =
  | "seasonal_walk"
  | "waterfront"
  | "park_walk"
  | "satoyama"
  | "city_nature"
  | "school_learning";

export type MunicipalWalkMapStopAccessV0 =
  | "public_access"
  | "permission_required"
  | "private_or_restricted"
  | "unknown";

export type MunicipalWalkMapMobilityModeV0 =
  | "walk"
  | "bike"
  | "car"
  | "motorbike"
  | "public_transport";

export type MunicipalWalkMapRouteFlexibilityV0 = {
  routeStyle: "loose_stops" | "suggested_order" | "free_area";
  mobilityModes: MunicipalWalkMapMobilityModeV0[];
  offRoutePolicy: "off_route_allowed" | "stay_near_public_path" | "guide_only";
  returnCues: string[];
};

export type MunicipalWalkMapCreatorProfileV0 = {
  creatorId?: string | null;
  registrationKind: "municipality" | "registered_group" | "registered_company" | "individual" | "unknown";
  verificationStatus: "verified" | "pending" | "self_declared";
  commercialIntent: "none" | "limited" | "primary";
};

export type MunicipalWalkMapCreatorRegistryEntryV0 = {
  schemaVersion: "municipal_walk_map_creator/v0";
  creatorId: string;
  displayName: string;
  registrationKind: "municipality" | "registered_group" | "registered_company";
  verificationStatus: "verified" | "pending" | "revoked";
  commercialIntent: "none" | "limited" | "primary";
  notes: string;
};

export type MunicipalWalkMapCreatorValidationV0 = {
  ok: boolean;
  errors: string[];
};

export type MunicipalWalkMapSourceReferenceV0 = {
  label: string;
  url: string;
  note: string;
};

export type MunicipalWalkMapAreaHintV0 = {
  lat: number;
  lng: number;
  label: string;
  precision: "area_hint";
  source: "official_source_sample";
};

export type MunicipalWalkMapPublicationReviewV0 = {
  publicAccessAttested: boolean;
  sourceRightsAttested: boolean;
  permissionAttestedBy?: string | null;
  permissionAttestedAt?: string | null;
  publishApprovedByUserId?: string | null;
  publishApprovedAt?: string | null;
  emergencyHidden?: boolean;
  takedownReason?: string | null;
};

export type MunicipalWalkMapStopV0 = {
  stopId: string;
  title: string;
  areaKind: "park" | "waterfront" | "satoyama" | "street_edge" | "school" | "other";
  linkedFieldId?: string | null;
  access: MunicipalWalkMapStopAccessV0;
  sensitiveContext?: "none" | "school_or_minor" | "private_edge" | "rare_species" | null;
  estimatedMinutes?: number | null;
  noticeCues: string[];
  recordCues: string[];
  safetyNotes: string[];
  internalMemo?: string | null;
};

export type MunicipalWalkMapConfigV0 = {
  schemaVersion: "municipal_walk_map_config/v0";
  walkMapId: string;
  municipality: string;
  creatorName: string;
  creatorProfile: MunicipalWalkMapCreatorProfileV0;
  title: string;
  summary: string;
  theme: MunicipalWalkMapThemeV0;
  publishMode: "draft" | "public_preview" | "public";
  areaScope: {
    municipalityCodes: string[];
    placeIds: string[];
    polygonIds: string[];
  };
  routeStops: MunicipalWalkMapStopV0[];
  recordModes: Array<"photo" | "audio" | "memo" | "unknown_species">;
  routeFlexibility: MunicipalWalkMapRouteFlexibilityV0;
  publicPrecisionPolicy: "site_or_coarser" | "mesh_or_coarser" | "municipality_or_hidden";
  claimBoundary: string[];
  sourceReferences: MunicipalWalkMapSourceReferenceV0[];
  publicationReview?: MunicipalWalkMapPublicationReviewV0;
};

export type MunicipalWalkMapValidationV0 = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  blockedStopIds: string[];
};

export type MunicipalWalkMapLocationSafetyPolicyV0 = {
  schemaVersion: "municipal_walk_map_location_safety/v0";
  publicPrecisionPolicy: MunicipalWalkMapConfigV0["publicPrecisionPolicy"];
  publicExactStopLocation: false;
  recordCtaRule: "public_access_non_school_only";
  blockedStopIds: string[];
  reviewRequired: string[];
  defaultHiddenContexts: Array<"home_or_minor_context" | "rare_species_context" | "school_or_private_land">;
};

export type MunicipalWalkMapPublicReadModelV0 = {
  schemaVersion: "municipal_walk_map_public/v0";
  walkMapId: string;
  municipality: string;
  title: string;
  summary: string;
  theme: MunicipalWalkMapThemeV0;
  publishMode: MunicipalWalkMapConfigV0["publishMode"];
  stops: Array<{
    stopId: string;
    title: string;
    areaKind: MunicipalWalkMapStopV0["areaKind"];
    estimatedMinutes: number | null;
    noticeCues: string[];
    recordCues: string[];
    recordHref: string | null;
    accessLabel: "public_scope" | "check_permission" | "not_for_route";
  }>;
  routeFlexibility: MunicipalWalkMapRouteFlexibilityV0;
  claimBoundary: string[];
  sourceReferences: MunicipalWalkMapSourceReferenceV0[];
  locationSafety: MunicipalWalkMapLocationSafetyPolicyV0;
  validation: MunicipalWalkMapValidationV0;
};

export type MunicipalWalkMapPublicSummaryV0 = {
  schemaVersion: "municipal_walk_map_public_summary/v0";
  walkMapId: string;
  municipality: string;
  title: string;
  summary: string;
  theme: MunicipalWalkMapThemeV0;
  publishMode: MunicipalWalkMapConfigV0["publishMode"];
  routeStyle: MunicipalWalkMapRouteFlexibilityV0["routeStyle"];
  mobilityModes: MunicipalWalkMapMobilityModeV0[];
  stopCount: number;
  sourceReferences: MunicipalWalkMapSourceReferenceV0[];
  areaHint?: MunicipalWalkMapAreaHintV0 | null;
};

export type MunicipalWalkMapReviewQueueItemV0 = {
  schemaVersion: "municipal_walk_map_review_queue_item/v0";
  walkMapId: string;
  municipality: string;
  title: string;
  creatorName: string;
  creatorProfile: MunicipalWalkMapCreatorProfileV0;
  publishMode: MunicipalWalkMapConfigV0["publishMode"];
  updatedAt: string | null;
  stopCount: number;
  sourceReferenceCount: number;
  blockedStopIds: string[];
  reviewRequired: string[];
  readyForPublicMode: boolean;
  editHref: string;
  previewHref: string;
};

export type MunicipalWalkMapReviewDecisionActionV0 = "approve_public_preview" | "request_changes" | "emergency_hide";

export type MunicipalWalkMapReviewDecisionInputV0 = {
  action: MunicipalWalkMapReviewDecisionActionV0;
  note?: string | null;
  reviewedAt?: string | null;
};

export type MunicipalWalkMapReviewDecisionResultV0 = {
  schemaVersion: "municipal_walk_map_review_decision_result/v0";
  action: MunicipalWalkMapReviewDecisionActionV0;
  config: MunicipalWalkMapConfigV0;
  reviewItem: MunicipalWalkMapReviewQueueItemV0;
};

export type MunicipalWalkMapTemplateV0 = {
  schemaVersion: "municipal_walk_map_template/v0";
  templateId: string;
  label: string;
  sourcePattern: string;
  summary: string;
  exampleSources: Array<{
    label: string;
    url: string;
  }>;
  config: MunicipalWalkMapConfigV0;
};

export type MunicipalWalkMapSourceCatalogEntryV0 = {
  schemaVersion: "municipal_walk_map_source_catalog/v0";
  sourceId: string;
  templateId: string;
  primaryType: "walk_route_species_map" | "species_distribution_map" | "citizen_science_report" | "worksheet_or_field_note";
  municipality: string;
  title: string;
  sourceUrl: string;
  officialPageUrl: string;
  affinityScore: number;
  cue: string;
};

export type MunicipalWalkMapOperationalModelV0 =
  | "official_walk_pdf"
  | "municipal_submission_map"
  | "external_app_campaign"
  | "national_platform_link"
  | "fieldwork_worksheet_portal";

export type MunicipalWalkMapSourceAccessModelV0 = {
  downloadKind: "direct_pdf" | "official_page_with_links" | "html_or_external_form";
  label: string;
  downloadUrl: string | null;
  rightsNote: string;
  importPolicy: "citation_only_no_body_copy";
};

export type MunicipalWalkMapSourceRiskModelV0 = {
  coordinateSensitivity: "low_public_route" | "medium_area_only" | "high_sensitive_or_minor";
  reuseRisk: "low_citation_page" | "medium_pdf_or_external_terms" | "high_photo_or_minor_content";
  reviewFlags: string[];
  reviewNote: string;
};

export type MunicipalWalkMapSourceCatalogFilterV0 = {
  templateId?: string;
  accessKind?: MunicipalWalkMapSourceAccessModelV0["downloadKind"] | "";
  coordinateSensitivity?: MunicipalWalkMapSourceRiskModelV0["coordinateSensitivity"] | "";
  reuseRisk?: MunicipalWalkMapSourceRiskModelV0["reuseRisk"] | "";
};

const DEFAULT_WALK_MAP_ID = "jp-shizuoka-light-nature-walk-v0";
const DEFAULT_CLAIM_BOUNDARY = [
  "公式調査結果ではなく、散策マップとして扱います。",
  "学校、私有地、立入不明の場所は公開前に確認します。",
  "希少種、自宅付近、未成年が推測される情報は場所の出し方を落とします。",
];
const SHIZUOKA_SOURCE_REFERENCE: MunicipalWalkMapSourceReferenceV0 = {
  label: "静岡市 いきもの散策マップ",
  url: "https://www.city.shizuoka.lg.jp/s6347/s001494.html",
  note: "静岡市公式ページを出典として、ZUKAN用に再構成したサンプル。PDF本文や図版は転載していません。",
};
const VALID_THEMES: readonly MunicipalWalkMapThemeV0[] = [
  "seasonal_walk",
  "waterfront",
  "park_walk",
  "satoyama",
  "city_nature",
  "school_learning",
];
const VALID_PUBLISH_MODES: readonly MunicipalWalkMapConfigV0["publishMode"][] = ["draft", "public_preview", "public"];
const VALID_AREA_KINDS: readonly MunicipalWalkMapStopV0["areaKind"][] = ["park", "waterfront", "satoyama", "street_edge", "school", "other"];
const VALID_ACCESS: readonly MunicipalWalkMapStopAccessV0[] = ["public_access", "permission_required", "private_or_restricted", "unknown"];
const VALID_SENSITIVE_CONTEXTS: readonly NonNullable<MunicipalWalkMapStopV0["sensitiveContext"]>[] = ["none", "school_or_minor", "private_edge", "rare_species"];
const VALID_RECORD_MODES: readonly MunicipalWalkMapConfigV0["recordModes"][number][] = ["photo", "audio", "memo", "unknown_species"];
const VALID_MOBILITY_MODES: readonly MunicipalWalkMapMobilityModeV0[] = ["walk", "bike", "car", "motorbike", "public_transport"];
const VALID_ROUTE_STYLES: readonly MunicipalWalkMapRouteFlexibilityV0["routeStyle"][] = ["loose_stops", "suggested_order", "free_area"];
const VALID_OFF_ROUTE_POLICIES: readonly MunicipalWalkMapRouteFlexibilityV0["offRoutePolicy"][] = [
  "off_route_allowed",
  "stay_near_public_path",
  "guide_only",
];
const VALID_REGISTRATION_KINDS: readonly MunicipalWalkMapCreatorProfileV0["registrationKind"][] = [
  "municipality",
  "registered_group",
  "registered_company",
  "individual",
  "unknown",
];
const VALID_VERIFICATION_STATUS: readonly MunicipalWalkMapCreatorProfileV0["verificationStatus"][] = [
  "verified",
  "pending",
  "self_declared",
];
const VALID_CREATOR_REGISTRATION_KINDS: readonly MunicipalWalkMapCreatorRegistryEntryV0["registrationKind"][] = [
  "municipality",
  "registered_group",
  "registered_company",
];
const VALID_CREATOR_VERIFICATION_STATUS: readonly MunicipalWalkMapCreatorRegistryEntryV0["verificationStatus"][] = [
  "verified",
  "pending",
  "revoked",
];
const VALID_COMMERCIAL_INTENTS: readonly MunicipalWalkMapCreatorProfileV0["commercialIntent"][] = ["none", "limited", "primary"];
const VALID_PRECISION_POLICIES: readonly MunicipalWalkMapConfigV0["publicPrecisionPolicy"][] = [
  "site_or_coarser",
  "mesh_or_coarser",
  "municipality_or_hidden",
];
const HEAVY_COPY_PATTERNS: readonly { pattern: RegExp; code: string }[] = [
  { pattern: /見返|読み返/, code: "review_copy" },
  { pattern: /少し厚|厚くな/, code: "thickening_copy" },
  { pattern: /貢献/, code: "contribution_copy" },
  { pattern: /順番通り/, code: "strict_route_copy" },
  { pattern: /育つ場所|ここから育つ/, code: "growth_place_copy" },
];

const DEFAULT_ROUTE_FLEXIBILITY: MunicipalWalkMapRouteFlexibilityV0 = {
  routeStyle: "loose_stops",
  mobilityModes: ["walk"],
  offRoutePolicy: "off_route_allowed",
  returnCues: ["案内板や大きな通りを目印に戻る"],
};
const DEFAULT_CREATOR_PROFILE: MunicipalWalkMapCreatorProfileV0 = {
  creatorId: null,
  registrationKind: "unknown",
  verificationStatus: "pending",
  commercialIntent: "none",
};
const STATIC_SAMPLE_PUBLICATION_REVIEW: MunicipalWalkMapPublicationReviewV0 = {
  publicAccessAttested: true,
  sourceRightsAttested: true,
  permissionAttestedBy: "ZUKAN curated sample",
  permissionAttestedAt: "2026-06-24",
  publishApprovedByUserId: "system:static-sample",
  publishApprovedAt: "2026-06-24",
  emergencyHidden: false,
  takedownReason: null,
};

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

function uniqueClean(values: string[], maxItems: number, maxLength: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const item = cleanText(raw, maxLength);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
    if (result.length >= maxItems) break;
  }
  return result;
}

function pushHeavyCopyWarnings(warnings: string[], scope: string, values: unknown[]): void {
  const text = values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => cleanText(value, 240))
    .filter(Boolean)
    .join("\n");
  if (!text) return;
  for (const { pattern, code } of HEAVY_COPY_PATTERNS) {
    if (pattern.test(text)) warnings.push(`copy_lint_heavy_expression:${scope}:${code}`);
  }
}

function cleanSourceReferences(value: unknown): MunicipalWalkMapSourceReferenceV0[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((raw) => {
    const ref = (raw && typeof raw === "object" ? raw : {}) as Partial<MunicipalWalkMapSourceReferenceV0>;
    const label = cleanText(ref.label, 120);
    const url = cleanText(ref.url, 400);
    const note = cleanText(ref.note, 220);
    if (!label || !url) return [];
    if (!/^https:\/\/[^\s]+$/i.test(url)) return [];
    return [{ label, url, note }];
  });
}

function cleanPublicationReview(value: unknown): MunicipalWalkMapPublicationReviewV0 {
  const review = (value && typeof value === "object" ? value : {}) as Partial<MunicipalWalkMapPublicationReviewV0>;
  return {
    publicAccessAttested: review.publicAccessAttested === true,
    sourceRightsAttested: review.sourceRightsAttested === true,
    permissionAttestedBy: cleanText(review.permissionAttestedBy, 160) || null,
    permissionAttestedAt: cleanText(review.permissionAttestedAt, 40) || null,
    publishApprovedByUserId: cleanText(review.publishApprovedByUserId, 160) || null,
    publishApprovedAt: cleanText(review.publishApprovedAt, 40) || null,
    emergencyHidden: review.emergencyHidden === true,
    takedownReason: cleanText(review.takedownReason, 240) || null,
  };
}

function hasSensitiveContext(stop: MunicipalWalkMapStopV0): boolean {
  return Boolean(stop.sensitiveContext && stop.sensitiveContext !== "none");
}

function isStrongRecordAllowed(stop: MunicipalWalkMapStopV0): boolean {
  return stop.access === "public_access" && stop.areaKind !== "school" && !hasSensitiveContext(stop) && Boolean(cleanText(stop.linkedFieldId, 160));
}

function stopBlocker(stop: MunicipalWalkMapStopV0): string | null {
  if (stop.areaKind === "school") return "school_stop_requires_permission";
  if (stop.sensitiveContext === "school_or_minor") return "school_or_minor_context_stop";
  if (stop.sensitiveContext === "private_edge") return "private_edge_context_stop";
  if (stop.sensitiveContext === "rare_species") return "rare_species_context_stop";
  if (stop.access === "private_or_restricted") return "private_or_restricted_stop";
  if (stop.access === "permission_required") return "permission_required_stop";
  if (stop.access === "unknown") return "unknown_access_stop";
  return null;
}

function isValidValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isCreatorId(value: string): boolean {
  return /^(municipality|group|company):[a-z0-9][a-z0-9_-]{2,80}$/i.test(value);
}

export function validateMunicipalWalkMapCreatorV0(input: unknown): MunicipalWalkMapCreatorValidationV0 {
  const errors: string[] = [];
  const candidate = (input && typeof input === "object" ? input : {}) as Partial<MunicipalWalkMapCreatorRegistryEntryV0>;
  const creatorId = cleanText(candidate.creatorId, 128);
  const displayName = cleanText(candidate.displayName, 120);

  if (candidate.schemaVersion !== "municipal_walk_map_creator/v0") errors.push("schema_version_mismatch");
  if (!creatorId) errors.push("creator_id_required");
  else if (!isCreatorId(creatorId)) errors.push("invalid_creator_id");
  if (!displayName) errors.push("display_name_required");
  if (!isValidValue(VALID_CREATOR_REGISTRATION_KINDS, candidate.registrationKind)) errors.push("invalid_registration_kind");
  if (!isValidValue(VALID_CREATOR_VERIFICATION_STATUS, candidate.verificationStatus)) errors.push("invalid_verification_status");
  if (!isValidValue(VALID_COMMERCIAL_INTENTS, candidate.commercialIntent)) errors.push("invalid_commercial_intent");
  if (candidate.verificationStatus === "verified" && candidate.commercialIntent === "primary") {
    errors.push("commercial_primary_creator_cannot_be_verified");
  }

  return { ok: errors.length === 0, errors };
}

export function creatorProfileFromRegistryEntryV0(
  entry: MunicipalWalkMapCreatorRegistryEntryV0,
): MunicipalWalkMapCreatorProfileV0 {
  return {
    creatorId: entry.creatorId,
    registrationKind: entry.registrationKind,
    verificationStatus: entry.verificationStatus === "verified" ? "verified" : "pending",
    commercialIntent: entry.commercialIntent,
  };
}

export function applyRegisteredCreatorProfileForWriteV0(
  config: MunicipalWalkMapConfigV0,
  creator: MunicipalWalkMapCreatorRegistryEntryV0 | null,
): MunicipalWalkMapConfigV0 {
  const requestedCreatorId = cleanText(config.creatorProfile?.creatorId, 128);
  if (!requestedCreatorId) return cloneWalkMapConfig(config);
  if (!creator || creator.creatorId !== requestedCreatorId) {
    throw new Error("registered_creator_not_found");
  }
  const creatorValidation = validateMunicipalWalkMapCreatorV0(creator);
  if (!creatorValidation.ok) {
    throw new Error(`registered_creator_invalid:${creatorValidation.errors.join(",")}`);
  }
  const next = cloneWalkMapConfig({
    ...config,
    creatorName: cleanText(creator.displayName, 120),
    creatorProfile: creatorProfileFromRegistryEntryV0(creator),
  });
  const validation = validateMunicipalWalkMapConfigV0(next);
  if (!validation.ok) {
    throw new Error(`municipal_walk_map_invalid:${validation.errors.join(",")}`);
  }
  return next;
}

export function validateMunicipalWalkMapConfigV0(config: MunicipalWalkMapConfigV0 | unknown): MunicipalWalkMapValidationV0 {
  const errors: string[] = [];
  const warnings: string[] = [];
  const blockedStopIds: string[] = [];
  const candidate = (config && typeof config === "object" ? config : {}) as Partial<MunicipalWalkMapConfigV0>;
  const routeStops = Array.isArray(candidate.routeStops) ? candidate.routeStops : [];
  const recordModes = Array.isArray(candidate.recordModes) ? candidate.recordModes : [];
  const publishMode = candidate.publishMode;
  const creatorProfile = (candidate.creatorProfile && typeof candidate.creatorProfile === "object"
    ? candidate.creatorProfile
    : {}) as Partial<MunicipalWalkMapCreatorProfileV0>;
  const publicationReview = cleanPublicationReview(candidate.publicationReview);
  const routeFlexibility = (candidate.routeFlexibility && typeof candidate.routeFlexibility === "object"
    ? candidate.routeFlexibility
    : {}) as Partial<MunicipalWalkMapRouteFlexibilityV0>;
  const isPublicMode = publishMode === "public" || publishMode === "public_preview";

  if (candidate.schemaVersion !== "municipal_walk_map_config/v0") errors.push("schema_version_mismatch");
  if (!cleanText(candidate.walkMapId, 128)) errors.push("walk_map_id_required");
  if (!cleanText(candidate.municipality, 80)) errors.push("municipality_required");
  if (!cleanText(candidate.creatorName, 120)) errors.push("creator_name_required");
  if (!candidate.creatorProfile || typeof candidate.creatorProfile !== "object") errors.push("creator_profile_required");
  if (!isValidValue(VALID_REGISTRATION_KINDS, creatorProfile.registrationKind)) errors.push("invalid_registration_kind");
  if (!isValidValue(VALID_VERIFICATION_STATUS, creatorProfile.verificationStatus)) errors.push("invalid_verification_status");
  if (!isValidValue(VALID_COMMERCIAL_INTENTS, creatorProfile.commercialIntent)) errors.push("invalid_commercial_intent");
  const creatorId = cleanText(creatorProfile.creatorId, 128);
  if (creatorProfile.verificationStatus === "verified" && !creatorId) errors.push("creator_id_required_for_verified_creator");
  if (!cleanText(candidate.title, 120)) errors.push("title_required");
  if (!isValidValue(VALID_THEMES, candidate.theme)) errors.push("invalid_theme");
  if (!isValidValue(VALID_PUBLISH_MODES, candidate.publishMode)) errors.push("invalid_publish_mode");
  if (!candidate.areaScope || typeof candidate.areaScope !== "object") errors.push("area_scope_required");
  if (!Array.isArray(candidate.routeStops) || candidate.routeStops.length === 0) errors.push("route_stops_required");
  if (routeStops.length > 12) warnings.push("route_stop_count_high");
  if (!Array.isArray(candidate.recordModes)) errors.push("record_modes_required");
  if (!recordModes.every((mode) => isValidValue(VALID_RECORD_MODES, mode))) errors.push("invalid_record_mode");
  if (!candidate.routeFlexibility || typeof candidate.routeFlexibility !== "object") errors.push("route_flexibility_required");
  if (!isValidValue(VALID_ROUTE_STYLES, routeFlexibility.routeStyle)) errors.push("invalid_route_style");
  if (!Array.isArray(routeFlexibility.mobilityModes) || routeFlexibility.mobilityModes.length === 0) errors.push("mobility_modes_required");
  if (Array.isArray(routeFlexibility.mobilityModes) && !routeFlexibility.mobilityModes.every((mode) => isValidValue(VALID_MOBILITY_MODES, mode))) errors.push("invalid_mobility_mode");
  if (!isValidValue(VALID_OFF_ROUTE_POLICIES, routeFlexibility.offRoutePolicy)) errors.push("invalid_off_route_policy");
  if (!isStringArray(routeFlexibility.returnCues)) errors.push("return_cues_required");
  const canUseSuggestedOrder = Boolean(creatorId)
    && creatorProfile.verificationStatus === "verified"
    && (creatorProfile.registrationKind === "municipality"
      || creatorProfile.registrationKind === "registered_group"
      || creatorProfile.registrationKind === "registered_company");
  const canPublish = Boolean(creatorId)
    && creatorProfile.verificationStatus === "verified"
    && (creatorProfile.registrationKind === "municipality"
      || creatorProfile.registrationKind === "registered_group"
      || creatorProfile.registrationKind === "registered_company");
  if (isPublicMode && !canPublish) {
    errors.push("public_publish_requires_verified_creator");
  }
  if (routeFlexibility.routeStyle === "suggested_order" && !canUseSuggestedOrder) {
    errors.push("suggested_order_requires_verified_org");
  }
  if (isPublicMode && routeFlexibility.routeStyle === "free_area") {
    errors.push("free_area_publication_requires_area_safety_review");
  }
  if (isPublicMode && creatorProfile.commercialIntent === "primary") {
    errors.push("commercial_primary_not_publishable");
  }
  if (isPublicMode && publicationReview.emergencyHidden) errors.push("emergency_hidden_not_public");
  if (isPublicMode && !publicationReview.publicAccessAttested) errors.push("public_access_review_required");
  if (isPublicMode && !publicationReview.sourceRightsAttested) errors.push("source_rights_attestation_required");
  if (isPublicMode && !publicationReview.publishApprovedByUserId) errors.push("publish_approval_required");
  if (isPublicMode && !publicationReview.publishApprovedAt) errors.push("publish_approval_timestamp_required");
  if (!recordModes.includes("unknown_species")) warnings.push("unknown_species_mode_missing");
  if (!recordModes.includes("memo")) warnings.push("memo_mode_missing");
  if (!isValidValue(VALID_PRECISION_POLICIES, candidate.publicPrecisionPolicy)) errors.push("invalid_public_precision_policy");
  if (isPublicMode && candidate.publicPrecisionPolicy === "site_or_coarser") errors.push("public_precision_requires_mesh_or_coarser");
  if (!isStringArray(candidate.claimBoundary)) errors.push("claim_boundary_required");
  if (!Array.isArray(candidate.sourceReferences)) errors.push("source_references_required");
  if (Array.isArray(candidate.sourceReferences) && candidate.sourceReferences.length !== cleanSourceReferences(candidate.sourceReferences).length) {
    errors.push("invalid_source_reference");
  }
  if (isPublicMode && cleanSourceReferences(candidate.sourceReferences).length === 0) errors.push("public_source_reference_required");
  pushHeavyCopyWarnings(warnings, "map", [
    candidate.title,
    candidate.summary,
    candidate.claimBoundary,
    routeFlexibility.returnCues,
  ]);

  const stopIds = new Set<string>();
  for (const rawStop of routeStops) {
    const stop = (rawStop && typeof rawStop === "object" ? rawStop : {}) as MunicipalWalkMapStopV0;
    if (!cleanText(stop.stopId, 80)) errors.push("stop_id_required");
    if (!cleanText(stop.title, 120)) errors.push(`stop_title_required:${cleanText(stop.stopId, 80) || "unknown"}`);
    if (stop.stopId && stopIds.has(stop.stopId)) errors.push(`duplicate_stop_id:${cleanText(stop.stopId, 80)}`);
    if (stop.stopId) stopIds.add(stop.stopId);
    if (!isValidValue(VALID_AREA_KINDS, stop.areaKind)) errors.push(`invalid_area_kind:${cleanText(stop.stopId, 80) || "unknown"}`);
    if (!isValidValue(VALID_ACCESS, stop.access)) errors.push(`invalid_access:${cleanText(stop.stopId, 80) || "unknown"}`);
    if (stop.sensitiveContext != null && !isValidValue(VALID_SENSITIVE_CONTEXTS, stop.sensitiveContext)) errors.push(`invalid_sensitive_context:${cleanText(stop.stopId, 80) || "unknown"}`);
    if (!isStringArray(stop.noticeCues)) errors.push(`notice_cues_required:${cleanText(stop.stopId, 80) || "unknown"}`);
    if (!isStringArray(stop.recordCues)) errors.push(`record_cues_required:${cleanText(stop.stopId, 80) || "unknown"}`);
    if (!isStringArray(stop.safetyNotes)) errors.push(`safety_notes_required:${cleanText(stop.stopId, 80) || "unknown"}`);
    const blocker = stopBlocker(stop);
    if (blocker) {
      blockedStopIds.push(stop.stopId);
      warnings.push(`${blocker}:${stop.stopId}`);
      if (isPublicMode) errors.push(`blocked_stop_not_publishable:${cleanText(stop.stopId, 80) || "unknown"}`);
    }
    if (!stop.linkedFieldId && stop.access === "public_access") warnings.push(`public_stop_without_linked_field:${stop.stopId}`);
    if (isPublicMode && stop.access === "public_access" && !cleanText(stop.linkedFieldId, 160)) {
      errors.push(`public_stop_requires_linked_field:${cleanText(stop.stopId, 80) || "unknown"}`);
    }
    if (Array.isArray(stop.noticeCues) && Array.isArray(stop.recordCues) && !stop.noticeCues.length && !stop.recordCues.length) {
      warnings.push(`stop_cues_missing:${stop.stopId}`);
    }
    pushHeavyCopyWarnings(warnings, `stop:${cleanText(stop.stopId, 80) || "unknown"}`, [
      stop.title,
      stop.noticeCues,
      stop.recordCues,
      stop.safetyNotes,
    ]);
  }

  if (candidate.publicPrecisionPolicy === "site_or_coarser") {
    warnings.push("site_precision_requires_public_place_review");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings: uniqueClean(warnings, 80, 160),
    blockedStopIds: uniqueClean(blockedStopIds, 80, 80),
  };
}

function recordHref(config: MunicipalWalkMapConfigV0, stop: MunicipalWalkMapStopV0): string | null {
  if (!isStrongRecordAllowed(stop)) return null;
  const params = new URLSearchParams({
    context: "municipal_walk_map",
    walkMapId: config.walkMapId,
    stopId: stop.stopId,
    source: "municipal_walk_map",
  });
  if (stop.linkedFieldId) params.set("fieldId", stop.linkedFieldId);
  return `/ja/record?${params.toString()}`;
}

function accessLabel(stop: MunicipalWalkMapStopV0): "public_scope" | "check_permission" | "not_for_route" {
  if (isStrongRecordAllowed(stop)) return "public_scope";
  if (stop.access === "permission_required" || stop.areaKind === "school") return "check_permission";
  return "not_for_route";
}

export function buildMunicipalWalkMapLocationSafetyPolicyV0(
  config: MunicipalWalkMapConfigV0,
  validation = validateMunicipalWalkMapConfigV0(config),
): MunicipalWalkMapLocationSafetyPolicyV0 {
  const publicationReview = cleanPublicationReview(config.publicationReview);
  const reviewRequired = [
    ...validation.errors,
    ...validation.warnings,
    config.publicPrecisionPolicy === "site_or_coarser" ? "site_precision_public_place_review" : "",
    config.routeFlexibility.routeStyle === "free_area" ? "free_area_safety_review" : "",
    cleanSourceReferences(config.sourceReferences).length === 0 ? "source_reference_required_before_public" : "",
    publicationReview.emergencyHidden ? "emergency_hidden" : "",
    publicationReview.publicAccessAttested ? "" : "public_access_review_required",
    publicationReview.sourceRightsAttested ? "" : "source_rights_attestation_required",
    publicationReview.publishApprovedByUserId && publicationReview.publishApprovedAt ? "" : "publish_approval_required",
  ].filter(Boolean);
  return {
    schemaVersion: "municipal_walk_map_location_safety/v0",
    publicPrecisionPolicy: config.publicPrecisionPolicy,
    publicExactStopLocation: false,
    recordCtaRule: "public_access_non_school_only",
    blockedStopIds: uniqueClean(validation.blockedStopIds, 80, 80),
    reviewRequired: uniqueClean(reviewRequired, 80, 160),
    defaultHiddenContexts: ["home_or_minor_context", "rare_species_context", "school_or_private_land"],
  };
}

export function buildMunicipalWalkMapPublicReadModelV0(config: MunicipalWalkMapConfigV0): MunicipalWalkMapPublicReadModelV0 {
  const validation = validateMunicipalWalkMapConfigV0(config);
  return {
    schemaVersion: "municipal_walk_map_public/v0",
    walkMapId: config.walkMapId,
    municipality: cleanText(config.municipality, 80),
    title: cleanText(config.title, 120),
    summary: cleanText(config.summary, 240),
    theme: config.theme,
    publishMode: config.publishMode,
    stops: config.routeStops.map((stop) => ({
      stopId: cleanText(stop.stopId, 80),
      title: cleanText(stop.title, 120),
      areaKind: stop.areaKind,
      estimatedMinutes: Number.isFinite(Number(stop.estimatedMinutes)) ? Math.max(1, Math.round(Number(stop.estimatedMinutes))) : null,
      noticeCues: uniqueClean(stop.noticeCues, 5, 80),
      recordCues: uniqueClean(stop.recordCues, 5, 80),
      recordHref: recordHref(config, stop),
      accessLabel: accessLabel(stop),
    })),
    routeFlexibility: {
      routeStyle: config.routeFlexibility.routeStyle,
      mobilityModes: uniqueClean(config.routeFlexibility.mobilityModes, 6, 40) as MunicipalWalkMapMobilityModeV0[],
      offRoutePolicy: config.routeFlexibility.offRoutePolicy,
      returnCues: uniqueClean(config.routeFlexibility.returnCues, 6, 120),
    },
    claimBoundary: uniqueClean(config.claimBoundary, 8, 180),
    sourceReferences: cleanSourceReferences(config.sourceReferences),
    locationSafety: buildMunicipalWalkMapLocationSafetyPolicyV0(config, validation),
    validation,
  };
}

export function buildMunicipalWalkMapPublicSummaryV0(config: MunicipalWalkMapConfigV0): MunicipalWalkMapPublicSummaryV0 {
  return {
    schemaVersion: "municipal_walk_map_public_summary/v0",
    walkMapId: cleanText(config.walkMapId, 128),
    municipality: cleanText(config.municipality, 80),
    title: cleanText(config.title, 120),
    summary: cleanText(config.summary, 240),
    theme: config.theme,
    publishMode: config.publishMode,
    routeStyle: config.routeFlexibility.routeStyle,
    mobilityModes: uniqueClean(config.routeFlexibility.mobilityModes, 6, 40) as MunicipalWalkMapMobilityModeV0[],
    stopCount: config.routeStops.length,
    sourceReferences: cleanSourceReferences(config.sourceReferences),
    areaHint: municipalWalkMapAreaHintForPublicSummary(config),
  };
}

function roundAreaHintCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function staticAreaHint(lat: number, lng: number, label: string): MunicipalWalkMapAreaHintV0 {
  return {
    lat: roundAreaHintCoordinate(lat),
    lng: roundAreaHintCoordinate(lng),
    label: cleanText(label, 80),
    precision: "area_hint",
    source: "official_source_sample",
  };
}

const STATIC_MUNICIPAL_WALK_MAP_AREA_HINTS_V0: Record<string, MunicipalWalkMapAreaHintV0> = {
  [DEFAULT_WALK_MAP_ID]: staticAreaHint(34.981, 138.397, "静岡市中心部"),
  "jp-shizuoka-yatsuyama-sample-v0": staticAreaHint(34.986, 138.407, "谷津山周辺"),
  "jp-shizuoka-asahata-waterfront-sample-v0": staticAreaHint(35.015, 138.389, "麻機の水辺"),
  "jp-shizuoka-mariko-waterfront-sample-v0": staticAreaHint(34.925, 138.379, "丸子川・広野海岸公園周辺"),
};

function municipalWalkMapAreaHintForPublicSummary(config: MunicipalWalkMapConfigV0): MunicipalWalkMapAreaHintV0 | null {
  const hint = STATIC_MUNICIPAL_WALK_MAP_AREA_HINTS_V0[config.walkMapId];
  if (!hint) return null;
  if (config.publicPrecisionPolicy === "site_or_coarser") return null;
  if (config.publishMode !== "public" && config.publishMode !== "public_preview") return null;
  return { ...hint };
}

export const STATIC_MUNICIPAL_WALK_MAPS_V0: MunicipalWalkMapConfigV0[] = [
  {
    schemaVersion: "municipal_walk_map_config/v0",
    walkMapId: DEFAULT_WALK_MAP_ID,
    municipality: "静岡市",
    creatorName: "ZUKAN model",
    creatorProfile: {
      creatorId: "municipality:shizuoka-city",
      registrationKind: "municipality",
      verificationStatus: "verified",
      commercialIntent: "none",
    },
    title: "身近な自然を歩く散策マップ",
    summary: "公開範囲を歩きながら、景色、音、季節の変化を軽く残すためのモデル散策マップ。",
    theme: "seasonal_walk",
    publishMode: "public_preview",
    areaScope: {
      municipalityCodes: ["22100"],
      placeIds: [],
      polygonIds: [],
    },
    routeStops: [
      {
        stopId: "public-park-start",
        title: "公園・緑地から始める",
        areaKind: "park",
        linkedFieldId: "osm_park:sample-public-park",
        access: "public_access",
        estimatedMinutes: 20,
        noticeCues: ["案内板", "木陰", "足元の草地"],
        recordCues: ["花", "鳥の声", "水たまりや湿った場所"],
        safetyNotes: ["公開範囲と現地の案内を優先する"],
      },
      {
        stopId: "school-edge-check",
        title: "通学路沿いの植栽を見る",
        areaKind: "street_edge",
        linkedFieldId: "osm_street_edge:sample-school-route-edge",
        access: "public_access",
        estimatedMinutes: 5,
        noticeCues: ["通学路の植栽", "道路側から見える季節の変化"],
        recordCues: ["公開道路から見える景色"],
        safetyNotes: ["敷地内へ入らず、児童生徒が写る写真は扱わない"],
      },
    ],
    recordModes: ["photo", "audio", "memo", "unknown_species"],
    routeFlexibility: {
      routeStyle: "loose_stops",
      mobilityModes: ["walk", "bike", "public_transport"],
      offRoutePolicy: "off_route_allowed",
      returnCues: ["公園や大きな道を目印に戻る", "疲れたら近い入口で終える"],
    },
    publicPrecisionPolicy: "mesh_or_coarser",
    claimBoundary: [
      "公式提出物ではなく、散策マップ作成のためのモデルです。",
      "学校、私有地、立入不明の場所には記録CTAを出しません。",
      "希少種、自宅付近、未成年が推測される情報は公開範囲を落とします。",
    ],
    sourceReferences: [SHIZUOKA_SOURCE_REFERENCE],
    publicationReview: STATIC_SAMPLE_PUBLICATION_REVIEW,
  },
  {
    schemaVersion: "municipal_walk_map_config/v0",
    walkMapId: "jp-shizuoka-yatsuyama-sample-v0",
    municipality: "静岡市",
    creatorName: "静岡市",
    creatorProfile: {
      creatorId: "municipality:shizuoka-city",
      registrationKind: "municipality",
      verificationStatus: "verified",
      commercialIntent: "none",
    },
    title: "谷津山周辺を歩く",
    summary: "静岡市公式資料を出典として、公開範囲で木陰、足元の草地、鳥の声を軽く残すために再構成したサンプルです。",
    theme: "satoyama",
    publishMode: "public_preview",
    areaScope: {
      municipalityCodes: ["22100"],
      placeIds: [],
      polygonIds: [],
    },
    routeStops: [
      {
        stopId: "yatsuyama-open-edge",
        title: "公開された道沿い",
        areaKind: "satoyama",
        linkedFieldId: "sample:shizuoka-yatsuyama-open-edge",
        access: "public_access",
        estimatedMinutes: 15,
        noticeCues: ["木陰", "足元の草", "鳥の声"],
        recordCues: ["葉の色", "聞こえた音", "地面の湿り"],
        safetyNotes: ["道を外れず、私有地や管理区域には入らない"],
      },
      {
        stopId: "yatsuyama-rest-point",
        title: "明るい休憩場所",
        areaKind: "park",
        linkedFieldId: "sample:shizuoka-yatsuyama-rest-point",
        access: "public_access",
        estimatedMinutes: 10,
        noticeCues: ["案内板", "木の実", "日なたと日陰"],
        recordCues: ["見えた花", "虫の動き", "風の様子"],
        safetyNotes: ["人の顔や学校・住宅が分かる写真は公開しない"],
      },
    ],
    recordModes: ["photo", "memo", "unknown_species"],
    routeFlexibility: {
      routeStyle: "loose_stops",
      mobilityModes: ["walk", "bike", "public_transport"],
      offRoutePolicy: "stay_near_public_path",
      returnCues: ["案内板や大きな道を目印に戻る", "無理に次の場所へ進まず近い出口で終える"],
    },
    publicPrecisionPolicy: "mesh_or_coarser",
    claimBoundary: [
      "静岡市公式資料を出典にしたサンプルで、PDF本文や図版は転載していません。",
      "現地の案内、立入条件、天候を優先します。",
      "公式調査結果ではなく、散策と記録導線のサンプルとして扱います。",
    ],
    sourceReferences: [
      SHIZUOKA_SOURCE_REFERENCE,
      {
        label: "谷津山 関連PDF",
        url: "https://www.city.shizuoka.lg.jp/documents/1483/yatsuyama-map.pdf",
        note: "静岡市公式ページ掲載PDF。内容は転載せず、サンプル構成の出典として表示します。",
      },
    ],
    publicationReview: STATIC_SAMPLE_PUBLICATION_REVIEW,
  },
  {
    schemaVersion: "municipal_walk_map_config/v0",
    walkMapId: "jp-shizuoka-asahata-waterfront-sample-v0",
    municipality: "静岡市",
    creatorName: "静岡市",
    creatorProfile: {
      creatorId: "municipality:shizuoka-city",
      registrationKind: "municipality",
      verificationStatus: "verified",
      commercialIntent: "none",
    },
    title: "麻機の水辺を歩くサンプル",
    summary: "静岡市公式資料を出典として、水辺を安全に見ながら、鳥の声、水面、草地の変化を残すサンプルです。",
    theme: "waterfront",
    publishMode: "public_preview",
    areaScope: {
      municipalityCodes: ["22100"],
      placeIds: [],
      polygonIds: [],
    },
    routeStops: [
      {
        stopId: "asahata-water-edge",
        title: "水辺を外から見る場所",
        areaKind: "waterfront",
        linkedFieldId: "sample:shizuoka-asahata-water-edge",
        access: "public_access",
        estimatedMinutes: 15,
        noticeCues: ["水面", "岸辺の草", "鳥の声"],
        recordCues: ["水の量", "見えた鳥", "草地の様子"],
        safetyNotes: ["水際へ降りず、柵や現地案内を優先する"],
      },
      {
        stopId: "asahata-open-path",
        title: "開けた道沿い",
        areaKind: "street_edge",
        linkedFieldId: "sample:shizuoka-asahata-open-path",
        access: "public_access",
        estimatedMinutes: 10,
        noticeCues: ["空の広がり", "足元の花", "風の向き"],
        recordCues: ["花", "虫の動き", "聞こえた音"],
        safetyNotes: ["通行の邪魔にならない場所で止まる"],
      },
    ],
    recordModes: ["photo", "audio", "memo", "unknown_species"],
    routeFlexibility: {
      routeStyle: "loose_stops",
      mobilityModes: ["walk", "bike", "public_transport"],
      offRoutePolicy: "stay_near_public_path",
      returnCues: ["大きな道や案内板へ戻る", "水位が高いときは近い公開道へ戻る"],
    },
    publicPrecisionPolicy: "mesh_or_coarser",
    claimBoundary: [
      "静岡市公式資料を出典にしたサンプルで、PDF本文や図版は転載していません。",
      "水辺では現地の安全表示と立入条件を優先します。",
      "希少種や営巣場所が推測される情報は場所の出し方を落とします。",
    ],
    sourceReferences: [
      SHIZUOKA_SOURCE_REFERENCE,
      {
        label: "麻機 関連PDF",
        url: "https://www.city.shizuoka.lg.jp/documents/1483/asahata2024-map.pdf",
        note: "静岡市公式ページ掲載PDF。内容は転載せず、サンプル構成の出典として表示します。",
      },
    ],
    publicationReview: STATIC_SAMPLE_PUBLICATION_REVIEW,
  },
  {
    schemaVersion: "municipal_walk_map_config/v0",
    walkMapId: "jp-shizuoka-mariko-waterfront-sample-v0",
    municipality: "静岡市",
    creatorName: "静岡市",
    creatorProfile: {
      creatorId: "municipality:shizuoka-city",
      registrationKind: "municipality",
      verificationStatus: "verified",
      commercialIntent: "none",
    },
    title: "丸子川・広野海岸公園周辺サンプル",
    summary: "静岡市公式資料を出典として、川と海岸公園の公開範囲で、水辺の様子や鳥の声を残すサンプルです。",
    theme: "waterfront",
    publishMode: "public_preview",
    areaScope: {
      municipalityCodes: ["22100"],
      placeIds: [],
      polygonIds: [],
    },
    routeStops: [
      {
        stopId: "mariko-river-edge",
        title: "川沿いの公開範囲",
        areaKind: "waterfront",
        linkedFieldId: "sample:shizuoka-mariko-river-edge",
        access: "public_access",
        estimatedMinutes: 15,
        noticeCues: ["川の流れ", "橋の下", "水辺の草"],
        recordCues: ["水の色", "見えた鳥", "岸辺の植物"],
        safetyNotes: ["増水時や足元が悪い場所には近づかない"],
      },
      {
        stopId: "hirono-park-open-space",
        title: "公園の開けた場所",
        areaKind: "park",
        linkedFieldId: "sample:shizuoka-hirono-park-open-space",
        access: "public_access",
        estimatedMinutes: 15,
        noticeCues: ["芝生", "木陰", "海からの風"],
        recordCues: ["花", "虫", "聞こえた音"],
        safetyNotes: ["混雑時は周囲の人が写らない向きで記録する"],
      },
    ],
    recordModes: ["photo", "audio", "memo", "unknown_species"],
    routeFlexibility: {
      routeStyle: "loose_stops",
      mobilityModes: ["walk", "bike", "car", "public_transport"],
      offRoutePolicy: "off_route_allowed",
      returnCues: ["橋や公園入口を目印に戻る", "車や自転車では停められる公開場所だけ使う"],
    },
    publicPrecisionPolicy: "mesh_or_coarser",
    claimBoundary: [
      "静岡市公式資料を出典にしたサンプルで、PDF本文や図版は転載していません。",
      "川、海岸、公園の公開範囲だけを扱います。",
      "公式調査結果ではなく、散策と記録導線のサンプルとして扱います。",
    ],
    sourceReferences: [
      SHIZUOKA_SOURCE_REFERENCE,
      {
        label: "丸子川・広野海岸公園 関連PDF",
        url: "https://www.city.shizuoka.lg.jp/documents/1483/000980916.pdf",
        note: "静岡市公式ページ掲載PDF。内容は転載せず、サンプル構成の出典として表示します。",
      },
    ],
    publicationReview: STATIC_SAMPLE_PUBLICATION_REVIEW,
  },
];

export const MUNICIPAL_WALK_MAP_TEMPLATES_V0: MunicipalWalkMapTemplateV0[] = [
  {
    schemaVersion: "municipal_walk_map_template/v0",
    templateId: "habitat_micro_walk",
    label: "水辺・田んぼ・海岸の観察ルート",
    sourcePattern: "Habitat micro walk",
    summary: "川、池、海岸沿いで、鳥、水生生物、水位や草地の変化を扱う散策マップ。",
    exampleSources: [
      { label: "静岡市 いきもの散策マップ", url: "https://www.city.shizuoka.lg.jp/s6347/s001494.html" },
      { label: "高知市 鏡川流域いきもの図鑑", url: "https://www.city.kochi.kochi.jp/soshiki/186/r8--kagamigawaryuiki-ikimonozukan.html" },
    ],
    config: {
      schemaVersion: "municipal_walk_map_config/v0",
      walkMapId: "",
      municipality: "",
      creatorName: "",
      creatorProfile: DEFAULT_CREATOR_PROFILE,
      title: "水辺を歩く散策マップ",
      summary: "公開範囲の水辺を歩きながら、鳥の声、水面、草地の変化を軽く残します。",
      theme: "waterfront",
      publishMode: "draft",
      areaScope: { municipalityCodes: [], placeIds: [], polygonIds: [] },
      routeStops: [
        {
          stopId: "waterfront-start",
          title: "水辺の入口",
          areaKind: "waterfront",
          linkedFieldId: null,
          access: "public_access",
          estimatedMinutes: 15,
          noticeCues: ["案内板", "水面", "岸辺の草地"],
          recordCues: ["鳥の声", "水の量", "水辺の植物"],
          safetyNotes: ["増水時は近づかず、柵や現地案内を優先する"],
        },
        {
          stopId: "waterfront-open-edge",
          title: "開けた岸辺",
          areaKind: "waterfront",
          linkedFieldId: null,
          access: "public_access",
          estimatedMinutes: 15,
          noticeCues: ["水鳥", "浅瀬", "橋の下"],
          recordCues: ["見えた鳥", "水際の花", "風やにおい"],
          safetyNotes: ["足元が悪い場所には入らない"],
        },
      ],
      recordModes: ["photo", "memo", "unknown_species"],
      routeFlexibility: {
        routeStyle: "loose_stops",
        mobilityModes: ["walk", "bike"],
        offRoutePolicy: "stay_near_public_path",
        returnCues: ["橋や案内板を目印に戻る", "水位が高いときは近い道へ戻る"],
      },
      publicPrecisionPolicy: "mesh_or_coarser",
      claimBoundary: DEFAULT_CLAIM_BOUNDARY,
      sourceReferences: [],
    },
  },
  {
    schemaVersion: "municipal_walk_map_template/v0",
    templateId: "route_species_walk",
    label: "コース散策＋見つかる生きもの",
    sourcePattern: "Route + species walk",
    summary: "歩く場所と見つかりやすい生きものを同じ画面で扱う、初回散策向けの型。",
    exampleSources: [
      { label: "小山市 小山のいきものさがしてみよう", url: "https://www.city.oyama.tochigi.jp/kurashi/shiminkatsudo-machizukuri/page009360.html" },
      { label: "浦添市 環境マップ", url: "https://www.city.urasoe.lg.jp/doc/62328b2cbb48c45ee17db2b4/" },
    ],
    config: {
      schemaVersion: "municipal_walk_map_config/v0",
      walkMapId: "",
      municipality: "",
      creatorName: "",
      creatorProfile: DEFAULT_CREATOR_PROFILE,
      title: "コースで歩く散策マップ",
      summary: "短い時間で歩ける公開範囲を中心に、花、虫、鳥の声、足元の変化を残します。",
      theme: "park_walk",
      publishMode: "draft",
      areaScope: { municipalityCodes: [], placeIds: [], polygonIds: [] },
      routeStops: [
        {
          stopId: "park-entrance",
          title: "公園入口",
          areaKind: "park",
          linkedFieldId: null,
          access: "public_access",
          estimatedMinutes: 10,
          noticeCues: ["案内板", "花壇", "木陰"],
          recordCues: ["咲いている花", "虫の動き", "木の実"],
          safetyNotes: ["混雑時は通行の邪魔にならない場所で止まる"],
        },
        {
          stopId: "grass-edge",
          title: "草地のふち",
          areaKind: "park",
          linkedFieldId: null,
          access: "public_access",
          estimatedMinutes: 10,
          noticeCues: ["草の高さ", "湿った場所", "落ち葉"],
          recordCues: ["足元の草花", "聞こえた音", "季節の色"],
          safetyNotes: ["管理作業中の場所には入らない"],
        },
      ],
      recordModes: ["photo", "memo", "unknown_species"],
      routeFlexibility: {
        routeStyle: "loose_stops",
        mobilityModes: ["walk", "bike", "public_transport"],
        offRoutePolicy: "off_route_allowed",
        returnCues: ["入口や広場を目印に戻る", "短い時間なら1か所だけで終える"],
      },
      publicPrecisionPolicy: "mesh_or_coarser",
      claimBoundary: DEFAULT_CLAIM_BOUNDARY,
      sourceReferences: [],
    },
  },
  {
    schemaVersion: "municipal_walk_map_template/v0",
    templateId: "stewardship_manners_walk",
    label: "保全・マナーつき自然観察",
    sourcePattern: "Stewardship + manners walk",
    summary: "公開範囲、立入条件、現地マナーを先に示して、保全区域や管理地の散策を扱う型。",
    exampleSources: [
      { label: "横浜市 森の散策ガイド", url: "https://www.city.yokohama.lg.jp/kurashi/machizukuri-kankyo/midori-koen/midori_up/1mori/forest/guidemap.html" },
      { label: "町田市 生きものマップ", url: "https://www.city.machida.tokyo.jp/kurashi/kankyo/kankyo/midori/shikankyo_ikimono/ikimonomap.html" },
    ],
    config: {
      schemaVersion: "municipal_walk_map_config/v0",
      walkMapId: "",
      municipality: "",
      creatorName: "",
      creatorProfile: DEFAULT_CREATOR_PROFILE,
      title: "マナーを確認して歩く散策マップ",
      summary: "公開された道沿いを中心に、木陰、鳥の声、草地や水の気配を残します。",
      theme: "satoyama",
      publishMode: "draft",
      areaScope: { municipalityCodes: [], placeIds: [], polygonIds: [] },
      routeStops: [
        {
          stopId: "trail-open-edge",
          title: "公開された道沿い",
          areaKind: "satoyama",
          linkedFieldId: null,
          access: "public_access",
          estimatedMinutes: 20,
          noticeCues: ["木陰", "落ち葉", "鳥の声"],
          recordCues: ["葉の色", "足元の花", "聞こえた音"],
          safetyNotes: ["道を外れず、ぬかるみや倒木には近づかない"],
        },
        {
          stopId: "satoyama-water-sign",
          title: "水の気配がある場所",
          areaKind: "satoyama",
          linkedFieldId: null,
          access: "public_access",
          estimatedMinutes: 10,
          noticeCues: ["湿った土", "小さな水路", "日陰"],
          recordCues: ["土の湿り", "水辺の草", "音やにおい"],
          safetyNotes: ["水路や斜面へ降りない"],
        },
      ],
      recordModes: ["photo", "memo", "unknown_species"],
      routeFlexibility: {
        routeStyle: "loose_stops",
        mobilityModes: ["walk", "public_transport"],
        offRoutePolicy: "guide_only",
        returnCues: ["案内板や舗装された道へ戻る", "暗くなる前に近い出口へ戻る"],
      },
      publicPrecisionPolicy: "mesh_or_coarser",
      claimBoundary: DEFAULT_CLAIM_BOUNDARY,
      sourceReferences: [],
    },
  },
  {
    schemaVersion: "municipal_walk_map_template/v0",
    templateId: "seasonal_target_walk",
    label: "季節のいきもの探し",
    sourcePattern: "Seasonal target walk",
    summary: "季節ごとに、花、鳴き声、飛ぶ虫、水鳥、落ち葉、実などを扱う短い散策型。",
    exampleSources: [
      { label: "秋田市 いきものマップ", url: "https://www.city.akita.lg.jp/kurashi/recycle/1006075/1044957.html" },
      { label: "小山市 小山のいきものさがしてみよう", url: "https://www.city.oyama.tochigi.jp/kurashi/shiminkatsudo-machizukuri/page009360.html" },
      { label: "岡崎市 みんなでつくる生きもの図鑑", url: "https://www.city.okazaki.lg.jp/kurashi/gomi/1002429/1002431/1002427.html" },
    ],
    config: {
      schemaVersion: "municipal_walk_map_config/v0",
      walkMapId: "",
      municipality: "",
      creatorName: "",
      creatorProfile: DEFAULT_CREATOR_PROFILE,
      title: "季節のいきものを探す散策マップ",
      summary: "季節ごとに見えやすい花、虫、鳥、水辺や落ち葉の変化を軽く残します。",
      theme: "seasonal_walk",
      publishMode: "draft",
      areaScope: { municipalityCodes: [], placeIds: [], polygonIds: [] },
      routeStops: [
        {
          stopId: "seasonal-open-place",
          title: "季節が見える場所",
          areaKind: "park",
          linkedFieldId: null,
          access: "public_access",
          estimatedMinutes: 15,
          noticeCues: ["花", "葉の色", "虫や鳥の声"],
          recordCues: ["今日見えた季節", "前と違う色", "聞こえた音"],
          safetyNotes: ["巣や繁殖場所には近づきすぎない"],
        },
        {
          stopId: "seasonal-water-or-tree",
          title: "水辺や木の近く",
          areaKind: "park",
          linkedFieldId: null,
          access: "public_access",
          estimatedMinutes: 10,
          noticeCues: ["木の実", "落ち葉", "水の量"],
          recordCues: ["実や落ち葉", "水辺の様子", "におい"],
          safetyNotes: ["採集せず、見る範囲で扱う"],
        },
      ],
      recordModes: ["photo", "memo", "unknown_species"],
      routeFlexibility: {
        routeStyle: "loose_stops",
        mobilityModes: ["walk", "bike", "public_transport"],
        offRoutePolicy: "off_route_allowed",
        returnCues: ["見つけた場所から近い公開道へ戻る", "次の場所へ行かずにそこで終えてよい"],
      },
      publicPrecisionPolicy: "mesh_or_coarser",
      claimBoundary: DEFAULT_CLAIM_BOUNDARY,
      sourceReferences: [],
    },
  },
  {
    schemaVersion: "municipal_walk_map_template/v0",
    templateId: "citizen_campaign_walk",
    label: "市民参加型いきもの調査",
    sourcePattern: "Citizen science campaign",
    summary: "市内全域で、住宅地、公園、道沿いなど身近な場所の発見を集めるキャンペーン型。",
    exampleSources: [
      { label: "飯田市 いきもの大調査", url: "https://www.city.iida.lg.jp/soshiki/19/ikimonochousainiidasaishuuhoukoku.html" },
      { label: "岡崎市 みんなでつくる生きもの図鑑", url: "https://www.city.okazaki.lg.jp/kurashi/gomi/1002429/1002431/1002427.html" },
      { label: "町田市 生きもの発見レポート", url: "https://www.city.machida.tokyo.jp/kurashi/kankyo/kankyo/midori/ibent/chosa/ikimonohakkenreport.html" },
    ],
    config: {
      schemaVersion: "municipal_walk_map_config/v0",
      walkMapId: "",
      municipality: "",
      creatorName: "",
      creatorProfile: DEFAULT_CREATOR_PROFILE,
      title: "市内の生きものを残す散策マップ",
      summary: "市内の公開範囲で、花、虫、鳥、身近な季節の変化を軽く残します。",
      theme: "city_nature",
      publishMode: "draft",
      areaScope: { municipalityCodes: [], placeIds: [], polygonIds: [] },
      routeStops: [
        {
          stopId: "nearby-park-or-street",
          title: "近くの公園や道沿い",
          areaKind: "street_edge",
          linkedFieldId: null,
          access: "public_access",
          estimatedMinutes: 10,
          noticeCues: ["街路樹", "花壇", "足元の草"],
          recordCues: ["見えた花", "虫や鳥", "気づいた季節"],
          safetyNotes: ["自宅前や人の顔が分かる写真は公開しない"],
        },
      ],
      recordModes: ["photo", "memo", "unknown_species"],
      routeFlexibility: {
        routeStyle: "free_area",
        mobilityModes: ["walk", "bike", "car", "motorbike", "public_transport"],
        offRoutePolicy: "off_route_allowed",
        returnCues: ["近くの公園や大きな通りへ戻る", "車やバイクでは停められる公開場所だけ使う"],
      },
      publicPrecisionPolicy: "municipality_or_hidden",
      claimBoundary: DEFAULT_CLAIM_BOUNDARY,
      sourceReferences: [],
    },
  },
  {
    schemaVersion: "municipal_walk_map_template/v0",
    templateId: "worksheet_family_walk",
    label: "親子・学校向けワークシート散策",
    sourcePattern: "Worksheet / family fieldwork",
    summary: "学校や観察会に近い用途。公開前に許可と参加範囲を確認する下書き向け。",
    exampleSources: [
      { label: "浦添市 てだこ環境調査団", url: "https://www.city.urasoe.lg.jp/doc/62328b2cbb48c45ee17db2b4/" },
      { label: "豊島区 生きもの調査", url: "https://www.city.toshima.lg.jp/148/2305291059.html" },
      { label: "世田谷区 生きもの調査", url: "https://www.city.setagaya.lg.jp/02074/4717.html" },
    ],
    config: {
      schemaVersion: "municipal_walk_map_config/v0",
      walkMapId: "",
      municipality: "",
      creatorName: "",
      creatorProfile: DEFAULT_CREATOR_PROFILE,
      title: "観察会で使う散策マップ",
      summary: "参加範囲と許可を確認しながら、観察会で見るもの、残すもの、安全メモを整理します。",
      theme: "school_learning",
      publishMode: "draft",
      areaScope: { municipalityCodes: [], placeIds: [], polygonIds: [] },
      routeStops: [
        {
          stopId: "event-meeting-point",
          title: "集合場所",
          areaKind: "other",
          linkedFieldId: null,
          access: "permission_required",
          estimatedMinutes: 10,
          noticeCues: ["集合場所", "案内板", "足元"],
          recordCues: ["観察会で見たもの", "講師の確認済みメモ"],
          safetyNotes: ["参加者、学校、施設管理者の許可を確認してから公開する"],
        },
        {
          stopId: "event-observation-point",
          title: "観察ポイント",
          areaKind: "park",
          linkedFieldId: null,
          access: "permission_required",
          estimatedMinutes: 20,
          noticeCues: ["草地", "水辺", "木陰"],
          recordCues: ["観察した分類群", "環境の様子"],
          safetyNotes: ["未成年が写る写真や名札が分かる写真は扱わない"],
        },
      ],
      recordModes: ["photo", "memo", "unknown_species"],
      routeFlexibility: {
        routeStyle: "loose_stops",
        mobilityModes: ["walk", "public_transport"],
        offRoutePolicy: "stay_near_public_path",
        returnCues: ["集合場所や案内役のいる場所へ戻る", "許可された範囲から外れたら記録を止める"],
      },
      publicPrecisionPolicy: "municipality_or_hidden",
      claimBoundary: DEFAULT_CLAIM_BOUNDARY,
      sourceReferences: [],
    },
  },
];

export const MUNICIPAL_WALK_MAP_SOURCE_CATALOG_V0: MunicipalWalkMapSourceCatalogEntryV0[] = [
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "shizuoka-ikimono-walk-route",
    templateId: "route_species_walk",
    primaryType: "walk_route_species_map",
    municipality: "静岡市",
    title: "静岡市 いきもの散策マップ",
    sourceUrl: "https://www.city.shizuoka.lg.jp/s6347/s001494.html",
    officialPageUrl: "https://www.city.shizuoka.lg.jp/s6347/s001494.html",
    affinityScore: 21,
    cue: "コースと見つかる生きものを同時に見せる型。ZUKANでは立ち寄り先と記録CTAに分ける。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "shizuoka-species-distribution-panels",
    templateId: "seasonal_target_walk",
    primaryType: "species_distribution_map",
    municipality: "静岡市",
    title: "静岡市 生きもの紹介パネル群",
    sourceUrl: "https://www.city.shizuoka.lg.jp/s6347/s001494.html",
    officialPageUrl: "https://www.city.shizuoka.lg.jp/s6347/s001494.html",
    affinityScore: 13,
    cue: "生きものカードの量が多い型。散策マップでは季節や分類群ごとに短い記録対象へ落とす。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "ota-ikimono-discovery-map",
    templateId: "route_species_walk",
    primaryType: "walk_route_species_map",
    municipality: "大田区",
    title: "おおた区いきもの発見MAP",
    sourceUrl: "https://www.city.ota.tokyo.jp/seikatsu/sumaimachinami/kankyou/hogo/ikimonomap.html",
    officialPageUrl: "https://www.city.ota.tokyo.jp/seikatsu/sumaimachinami/kankyou/hogo/ikimonomap.html",
    affinityScore: 28,
    cue: "区内を5エリアに分けた都市型の散策PDF群。貴重種や外来種の扱いは位置を粗くし、エリア別の立ち寄り先に変換する。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "yokohama-citizen-forest-guide",
    templateId: "stewardship_manners_walk",
    primaryType: "walk_route_species_map",
    municipality: "横浜市",
    title: "市民の森・ふれあいの樹林ガイドマップ",
    sourceUrl: "https://www.city.yokohama.lg.jp/kurashi/machizukuri-kankyo/midori-koen/midori_up/1mori/forest/guidemap.html",
    officialPageUrl: "https://www.city.yokohama.lg.jp/kurashi/machizukuri-kankyo/midori-koen/midori_up/1mori/forest/guidemap.html",
    affinityScore: 16,
    cue: "道、入口、注意事項が強い型。ZUKANでは外れても戻れる手がかりと立入条件を前に出す。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "yokohama-enkaizan-hiking-map",
    templateId: "stewardship_manners_walk",
    primaryType: "walk_route_species_map",
    municipality: "横浜市",
    title: "円海山周辺マップ",
    sourceUrl: "https://www.city.yokohama.lg.jp/kurashi/machizukuri-kankyo/midori-koen/midori_up/1mori/enkaizan-map.html",
    officialPageUrl: "https://www.city.yokohama.lg.jp/kurashi/machizukuri-kankyo/midori-koen/midori_up/1mori/enkaizan-map.html",
    affinityScore: 22,
    cue: "住宅地に近い緑地のハイキングマップ型。閉鎖区間、位置標識、道外れ禁止を、現地の戻り方と安全確認に分けて扱う。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "iida-biome-campaign-report",
    templateId: "citizen_campaign_walk",
    primaryType: "citizen_science_report",
    municipality: "飯田市",
    title: "いきもの大調査 in いいだ",
    sourceUrl: "https://www.city.iida.lg.jp/soshiki/19/ikimonochousainiidasaishuuhoukoku.html",
    officialPageUrl: "https://www.city.iida.lg.jp/soshiki/19/ikimonochousainiidasaishuuhoukoku.html",
    affinityScore: 29,
    cue: "市内全域の投稿キャンペーン型。散策マップでは自由エリアと安全な公開粒度をセットにする。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "kochi-kagamigawa-biome",
    templateId: "habitat_micro_walk",
    primaryType: "citizen_science_report",
    municipality: "高知市",
    title: "鏡川流域いきもの図鑑をつくろう",
    sourceUrl: "https://www.city.kochi.kochi.jp/soshiki/186/r8--kagamigawaryuiki-ikimonozukan.html",
    officialPageUrl: "https://www.city.kochi.kochi.jp/soshiki/186/r8--kagamigawaryuiki-ikimonozukan.html",
    affinityScore: 29,
    cue: "川の流域を対象にした型。水辺、親子イベント、学校連携を分けて安全に扱う。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "okazaki-community-zukan",
    templateId: "citizen_campaign_walk",
    primaryType: "citizen_science_report",
    municipality: "岡崎市",
    title: "みんなでつくる おかざき生きもの図鑑",
    sourceUrl: "https://www.city.okazaki.lg.jp/kurashi/gomi/1002429/1002431/1002427.html",
    officialPageUrl: "https://www.city.okazaki.lg.jp/kurashi/gomi/1002429/1002431/1002427.html",
    affinityScore: 25,
    cue: "市民投稿と分類集計が中心の型。ZUKANでは投稿前の安全確認と公開範囲の調整を足す。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "oyama-seasonal-creatures",
    templateId: "seasonal_target_walk",
    primaryType: "citizen_science_report",
    municipality: "小山市",
    title: "小山のいきものさがしてみよう",
    sourceUrl: "https://www.city.oyama.tochigi.jp/kurashi/shiminkatsudo-machizukuri/page009360.html",
    officialPageUrl: "https://www.city.oyama.tochigi.jp/kurashi/shiminkatsudo-machizukuri/page009360.html",
    affinityScore: 25,
    cue: "季節の対象種と身近な場所の型。軽い散策マップにしやすい。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "funabashi-seasonal-monitoring",
    templateId: "seasonal_target_walk",
    primaryType: "citizen_science_report",
    municipality: "船橋市",
    title: "生きものモニタリング調査",
    sourceUrl: "https://www.city.funabashi.lg.jp/machi/kankyou/010/p082326.html",
    officialPageUrl: "https://www.city.funabashi.lg.jp/machi/kankyou/010/p082326.html",
    affinityScore: 27,
    cue: "季節ごとの指標種を探す継続調査型。ZUKANでは対象カード、記録場所、公開範囲を分けて扱う。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "machida-report-line-flow",
    templateId: "citizen_campaign_walk",
    primaryType: "citizen_science_report",
    municipality: "町田市",
    title: "生きもの発見レポート",
    sourceUrl: "https://www.city.machida.tokyo.jp/kurashi/kankyo/kankyo/midori/ibent/chosa/ikimonohakkenreport.html",
    officialPageUrl: "https://www.city.machida.tokyo.jp/kurashi/kankyo/kankyo/midori/ibent/chosa/ikimonohakkenreport.html",
    affinityScore: 23,
    cue: "報告手順が明確な型。ZUKANでは記録導線と管理者確認に置き換えやすい。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "urasoe-environment-map-fieldwork",
    templateId: "worksheet_family_walk",
    primaryType: "worksheet_or_field_note",
    municipality: "浦添市",
    title: "てだこ環境調査団",
    sourceUrl: "https://www.city.urasoe.lg.jp/doc/62328b2cbb48c45ee17db2b4/",
    officialPageUrl: "https://www.city.urasoe.lg.jp/doc/62328b2cbb48c45ee17db2b4/",
    affinityScore: 23,
    cue: "観察会・親子調査の型。許可、集合場所、参加範囲を下書きで管理する。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "akita-line-ikimono-map",
    templateId: "seasonal_target_walk",
    primaryType: "citizen_science_report",
    municipality: "秋田市",
    title: "秋田市いきものマップ",
    sourceUrl: "https://www.city.akita.lg.jp/kurashi/recycle/1006075/1044957.html",
    officialPageUrl: "https://www.city.akita.lg.jp/kurashi/recycle/1006075/1044957.html",
    affinityScore: 18,
    cue: "季節ごとの対象種とLINE報告の型。ZUKANではアプリ内記録と公開判断に置き換える。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "koka-field-sheets",
    templateId: "worksheet_family_walk",
    primaryType: "worksheet_or_field_note",
    municipality: "甲賀市",
    title: "いきものみっけ探検隊",
    sourceUrl: "https://www.city.koka.lg.jp/9178.htm",
    officialPageUrl: "https://www.city.koka.lg.jp/9178.htm",
    affinityScore: 19,
    cue: "調査票・図鑑シート型。現地で何を見るかを記録項目へ変換しやすい。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "toshima-ikimono-sagashi",
    templateId: "worksheet_family_walk",
    primaryType: "worksheet_or_field_note",
    municipality: "豊島区",
    title: "としま生きものさがし",
    sourceUrl: "https://www.city.toshima.lg.jp/148/2305291059.html",
    officialPageUrl: "https://www.city.toshima.lg.jp/148/2305291059.html",
    affinityScore: 21,
    cue: "紙レポートと区内調査の型。年齢層や提出方法をアプリ導線に置き換える。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "funabashi-nature-walk-maps",
    templateId: "route_species_walk",
    primaryType: "walk_route_species_map",
    municipality: "船橋市",
    title: "自然散策マップ",
    sourceUrl: "https://www.city.funabashi.lg.jp/machi/kankyou/010/p035951.html",
    officialPageUrl: "https://www.city.funabashi.lg.jp/machi/kankyou/010/p035951.html",
    affinityScore: 24,
    cue: "複数地区の散策PDF型。ZUKANでは地区別の入口、公開範囲、現地で見える対象を分けて管理する。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "kita-city-nature-course",
    templateId: "stewardship_manners_walk",
    primaryType: "walk_route_species_map",
    municipality: "北区",
    title: "自然観察路・自然ふれあい情報",
    sourceUrl: "https://www.city.kita.lg.jp/dev-environment/environment/1009900/1009950.html",
    officialPageUrl: "https://www.city.kita.lg.jp/dev-environment/environment/1009900/1009950.html",
    affinityScore: 20,
    cue: "都市河川や緑道のコース型。立入・水辺・学校周辺の注意を route stop ごとに落とす。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "kita-environment-portal-library",
    templateId: "route_species_walk",
    primaryType: "walk_route_species_map",
    municipality: "北区環境ポータル",
    title: "環境ポータル ライブラリ",
    sourceUrl: "https://www.kankyoportal.city.kita.lg.jp/library",
    officialPageUrl: "https://www.kankyoportal.city.kita.lg.jp/library",
    affinityScore: 22,
    cue: "散策PDF、河川調査、できること資料が同居するポータル型。ZUKANでは地図、記録、資料リンクを一画面につなぐ。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "fukuoka-kyushu-nature-walk",
    templateId: "route_species_walk",
    primaryType: "walk_route_species_map",
    municipality: "福岡県",
    title: "九州自然歩道 自然観察マップ",
    sourceUrl: "https://www.pref.fukuoka.lg.jp/contents/kyushusizenhodo-naturemap.html",
    officialPageUrl: "https://www.pref.fukuoka.lg.jp/contents/kyushusizenhodo-naturemap.html",
    affinityScore: 23,
    cue: "広域ルートと自然観察の型。歩き、自転車、車での移動差をゆるい立ち寄り先として扱う。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "asaka-ikimono-map",
    templateId: "seasonal_target_walk",
    primaryType: "species_distribution_map",
    municipality: "朝霞市",
    title: "あさかのいきものマップ",
    sourceUrl: "https://www.city.asaka.lg.jp/soshiki/52/ikimonomap.html",
    officialPageUrl: "https://www.city.asaka.lg.jp/soshiki/52/ikimonomap.html",
    affinityScore: 18,
    cue: "市内の確認種を地図化する型。散策前の対象選びと記録後の地域図鑑化に向く。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "chofu-nogawa-nature-map",
    templateId: "habitat_micro_walk",
    primaryType: "walk_route_species_map",
    municipality: "調布市",
    title: "野川自然観察マップ",
    sourceUrl: "https://www.city.chofu.lg.jp/070010/p039088.html",
    officialPageUrl: "https://www.city.chofu.lg.jp/070010/p039088.html",
    affinityScore: 24,
    cue: "川沿いの観察地点と生きものを見せる型。水辺の安全と季節の見どころを分ける。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "kyoto-biodiversity-map",
    templateId: "seasonal_target_walk",
    primaryType: "species_distribution_map",
    municipality: "京都市",
    title: "京都市 生物多様性マップ",
    sourceUrl: "https://www.city.kyoto.lg.jp/kankyo/page/0000224675.html",
    officialPageUrl: "https://www.city.kyoto.lg.jp/kankyo/page/0000224675.html",
    affinityScore: 19,
    cue: "CMSのPDF相対リンクは補正取得済み。子どもの観察作品を地域の入口にする型として、公開前の権利確認を強く扱う。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "machida-ikimono-map",
    templateId: "seasonal_target_walk",
    primaryType: "species_distribution_map",
    municipality: "町田市",
    title: "まちだ生きものマップ",
    sourceUrl: "https://www.city.machida.tokyo.jp/kurashi/kankyo/kankyo/midori/shikankyo_ikimono/ikimonomap.html",
    officialPageUrl: "https://www.city.machida.tokyo.jp/kurashi/kankyo/kankyo/midori/shikankyo_ikimono/ikimonomap.html",
    affinityScore: 22,
    cue: "投稿結果を地図化する型。ZUKANではLINEや紙の報告をアプリ内記録と公開粒度に置き換える。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "setagaya-biological-survey-guide",
    templateId: "worksheet_family_walk",
    primaryType: "worksheet_or_field_note",
    municipality: "世田谷区",
    title: "せたがや生きもの調査",
    sourceUrl: "https://www.city.setagaya.lg.jp/02074/4717.html",
    officialPageUrl: "https://www.city.setagaya.lg.jp/02074/4717.html",
    affinityScore: 21,
    cue: "区民調査とガイドブックの型。親子、学校、一般参加を分けて公開CTAを制御する。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "setagaya-nogawa-map",
    templateId: "habitat_micro_walk",
    primaryType: "walk_route_species_map",
    municipality: "世田谷区",
    title: "野川マップ 生きもの観察のすすめ",
    sourceUrl: "https://www.city.setagaya.lg.jp/03666/4863.html",
    officialPageUrl: "https://www.city.setagaya.lg.jp/03666/4863.html",
    affinityScore: 26,
    cue: "野川流域のおすすめスポットと生きもの観察を分冊で見せる型。水辺安全、流域の立ち寄り先、写真記録を分けて軽く出す。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "setagaya-park-nature-observation-guide",
    templateId: "habitat_micro_walk",
    primaryType: "worksheet_or_field_note",
    municipality: "世田谷区",
    title: "公園の自然観察ガイド みどころ地図",
    sourceUrl: "https://www.city.setagaya.lg.jp/02074/4725.html",
    officialPageUrl: "https://www.city.setagaya.lg.jp/02074/4725.html",
    affinityScore: 24,
    cue: "公園ごとの季節ガイドPDF型。ZUKANでは施設スポット、季節の観察対象、写真記録を同じ地図面から選べるようにする。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "sakai-ikimono-web",
    templateId: "citizen_campaign_walk",
    primaryType: "species_distribution_map",
    municipality: "堺市",
    title: "堺いきもの情報館",
    sourceUrl: "https://www.city.sakai.lg.jp/kurashi/gomi/kankyo_hozen/seibutsutayosei/sakaiikimonoweb.html",
    officialPageUrl: "https://www.city.sakai.lg.jp/kurashi/gomi/kankyo_hozen/seibutsutayosei/sakaiikimonoweb.html",
    affinityScore: 20,
    cue: "継続ポータル型。単発PDFではなく、地域図鑑、記録、結果公開をつなぐ比較対象にする。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "handa-waterfront-map",
    templateId: "habitat_micro_walk",
    primaryType: "walk_route_species_map",
    municipality: "半田市",
    title: "はんだ水辺マップ",
    sourceUrl: "https://www.city.handa.lg.jp/machi/kankyo/1002994/1003007.html",
    officialPageUrl: "https://www.city.handa.lg.jp/machi/kankyo/1002994/1003007.html",
    affinityScore: 24,
    cue: "水辺マップと水生生物資料を分ける型。ZUKANでは水辺の安全カードと観察対象カードを分ける。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "kagoshima-waterfront-guidebook",
    templateId: "habitat_micro_walk",
    primaryType: "worksheet_or_field_note",
    municipality: "鹿児島市",
    title: "かごしま水辺環境ガイドブック",
    sourceUrl: "https://www.city.kagoshima.lg.jp/machizukuri/kankyohozen/shizen/hozonju/kagoshimanomizube/index.html",
    officialPageUrl: "https://www.city.kagoshima.lg.jp/machizukuri/kankyohozen/shizen/hozonju/kagoshimanomizube/index.html",
    affinityScore: 26,
    cue: "魚類、鳥類、水辺マナーを分冊で扱う型。現地カードと安全カードの分離に向く。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "isesaki-summer-ikimono-zukan",
    templateId: "citizen_campaign_walk",
    primaryType: "citizen_science_report",
    municipality: "伊勢崎市",
    title: "みんなで作ろう！いせさき夏の生きもの図鑑",
    sourceUrl: "https://www.city.isesaki.lg.jp/soshiki/kankyobu/kankyo/kikaku/seibututayousei/21642.html",
    officialPageUrl: "https://www.city.isesaki.lg.jp/soshiki/kankyobu/kankyo/kikaku/seibututayousei/21642.html",
    affinityScore: 28,
    cue: "Biome募集から成果図鑑までの型。募集、投稿、結果ページを同じ地域データでつなぐ比較対象にする。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "osaka-biome-biodiversity-materials",
    templateId: "citizen_campaign_walk",
    primaryType: "citizen_science_report",
    municipality: "大阪市",
    title: "生物多様性トップページ / Biome関連資料",
    sourceUrl: "https://www.city.osaka.lg.jp/kankyo/page/0000067896.html",
    officialPageUrl: "https://www.city.osaka.lg.jp/kankyo/page/0000067896.html",
    affinityScore: 23,
    cue: "大都市の啓発、調査、外部アプリ導入が同居する型。ZUKANではキャンペーン管理と公開粒度を一体で扱う。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "osaka-pref-ikimono-resource-library",
    templateId: "worksheet_family_walk",
    primaryType: "worksheet_or_field_note",
    municipality: "大阪府",
    title: "大阪府いきもの資料館",
    sourceUrl: "https://www.pref.osaka.lg.jp/o120030/midori/seibututayousei/osakabdshiryoukan.html",
    officialPageUrl: "https://www.pref.osaka.lg.jp/o120030/midori/seibututayousei/osakabdshiryoukan.html",
    affinityScore: 22,
    cue: "府内のリーフレット、冊子、調査資料を集める資料館型。自治体向けには引用元一覧、ライト層向けには場所別カードへ変換する参考にする。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "sapporo-continuous-ikimono-search",
    templateId: "seasonal_target_walk",
    primaryType: "citizen_science_report",
    municipality: "札幌市",
    title: "さっぽろ生き物さがしプロジェクト",
    sourceUrl: "https://www.city.sapporo.jp/kankyo/biodiversity/chosa.html",
    officialPageUrl: "https://www.city.sapporo.jp/kankyo/biodiversity/chosa.html",
    affinityScore: 27,
    cue: "継続年次調査とミニ図鑑、結果ページが同居する型。ZUKANでは季節ごとの対象、結果ページ、次回募集を同じ地域導線で扱う。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "kobe-biome-summer-quest",
    templateId: "citizen_campaign_walk",
    primaryType: "citizen_science_report",
    municipality: "神戸市",
    title: "夏休み！生きものクエスト",
    sourceUrl: "https://www.city.kobe.lg.jp/a66324/kurashi/recycle/biodiversity/biomequest2025.html",
    officialPageUrl: "https://www.city.kobe.lg.jp/a66324/kurashi/recycle/biodiversity/biomequest2025.html",
    affinityScore: 26,
    cue: "Biomeのミッション型。外来種、夜、展示施設など複数ミッションを、ZUKANでは地域キャンペーンと確認待ちレーンに分ける。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "chiyoda-biome-postcard-monitoring",
    templateId: "citizen_campaign_walk",
    primaryType: "citizen_science_report",
    municipality: "千代田区",
    title: "千代田区生きものさがし",
    sourceUrl: "https://www.city.chiyoda.lg.jp/koho/machizukuri/kankyo/sebutsutayose/monitoring2025.html",
    officialPageUrl: "https://www.city.chiyoda.lg.jp/koho/machizukuri/kankyo/sebutsutayose/monitoring2025.html",
    affinityScore: 24,
    cue: "Biomeとハガキ報告を併用する型。デジタル参加と紙参加の結果を同じ地域キャンペーンとして扱う比較対象にする。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "tama-inaturalist-survey-team",
    templateId: "citizen_campaign_walk",
    primaryType: "citizen_science_report",
    municipality: "多摩市",
    title: "多摩市生きもの調査隊",
    sourceUrl: "https://www.city.tama.lg.jp/kurashi/kankyo/hozen/event/1017494.html",
    officialPageUrl: "https://www.city.tama.lg.jp/kurashi/kankyo/hozen/event/1017494.html",
    affinityScore: 26,
    cue: "iNaturalistの研究用グレードを活用する型。ZUKANでは同定状態、専門確認、自治体向け出力を分ける。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "iwaki-living-creature-survey-results",
    templateId: "citizen_campaign_walk",
    primaryType: "citizen_science_report",
    municipality: "いわき市",
    title: "令和6年度いわき市生き物調査の結果",
    sourceUrl: "https://www.city.iwaki.lg.jp/www/contents/1739336926201/index.html",
    officialPageUrl: "https://www.city.iwaki.lg.jp/www/contents/1739336926201/index.html",
    affinityScore: 25,
    cue: "地区別の結果PDFが多い型。ZUKANでは地区別ページと年度レポート出力に向く。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "tokyo-satoyama-go-utsuki",
    templateId: "stewardship_manners_walk",
    primaryType: "walk_route_species_map",
    municipality: "東京都",
    title: "里山へGO！宇津木緑地保全地域",
    sourceUrl: "https://satoyama.tokyo-biodiversity.metro.tokyo.lg.jp/map/utsuki/",
    officialPageUrl: "https://satoyama.tokyo-biodiversity.metro.tokyo.lg.jp/map/utsuki/",
    affinityScore: 21,
    cue: "保全地域を体験プログラムとして見せる型。団体登録ルートと活動導線の参考にする。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "fukuoka-city-biodiversity-events",
    templateId: "worksheet_family_walk",
    primaryType: "worksheet_or_field_note",
    municipality: "福岡市",
    title: "生物多様性イベント・お知らせ",
    sourceUrl: "https://www.city.fukuoka.lg.jp/kankyo/k-chosei/hp/tayousei/seibutsutayousei.html",
    officialPageUrl: "https://www.city.fukuoka.lg.jp/kankyo/k-chosei/hp/tayousei/seibutsutayousei.html",
    affinityScore: 18,
    cue: "イベント募集と市民参加資料が同居する型。ルート、記録、イベント入口を分けすぎない設計に向く。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "fukuoka-pref-biodiversity-pamphlets",
    templateId: "worksheet_family_walk",
    primaryType: "worksheet_or_field_note",
    municipality: "福岡県",
    title: "生物多様性に関する動画・パンフレット",
    sourceUrl: "https://www.pref.fukuoka.lg.jp/contents/biodiversity-pamphlet.html",
    officialPageUrl: "https://www.pref.fukuoka.lg.jp/contents/biodiversity-pamphlet.html",
    affinityScore: 20,
    cue: "同定資料と学習資料が厚い型。現地カード、学校向けワークシート、種名不明の記録導線に向く。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "kawasaki-living-creature-map",
    templateId: "seasonal_target_walk",
    primaryType: "species_distribution_map",
    municipality: "川崎市",
    title: "みんなで生きものしらべKAWASAKI",
    sourceUrl: "https://www.city.kawasaki.jp/300/page/0000085873.html",
    officialPageUrl: "https://www.city.kawasaki.jp/300/page/0000085873.html",
    affinityScore: 27,
    cue: "季節テーマ、冊子、投稿地図が同居する型。ZUKANでは季節カード、記録、公開地図を同じ地域導線にまとめる。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "saitama-minuma-garden-guide",
    templateId: "habitat_micro_walk",
    primaryType: "worksheet_or_field_note",
    municipality: "さいたま市",
    title: "大宮南部浄化センター・みぬま見聞館 自然庭園ガイド",
    sourceUrl: "https://www.city.saitama.lg.jp/001/009/017/003/p006268.html",
    officialPageUrl: "https://www.city.saitama.lg.jp/001/009/017/003/p006268.html",
    affinityScore: 24,
    cue: "施設内の自然庭園、季節の草花、生きもの、貸出備品が同居する型。ZUKANでは施設スポットと観察カードを分ける。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "yokosuka-nearby-nature-guide",
    templateId: "habitat_micro_walk",
    primaryType: "walk_route_species_map",
    municipality: "横須賀市",
    title: "横須賀の身近な自然",
    sourceUrl: "https://www.city.yokosuka.kanagawa.jp/0880/kaiganshokubutu/mijikanasizen.html",
    officialPageUrl: "https://www.city.yokosuka.kanagawa.jp/0880/kaiganshokubutu/mijikanasizen.html",
    affinityScore: 28,
    cue: "海、川、山の地域別PDFとガイドブックを束ねる型。ZUKANでは地域スポットを loose stops と写真記録の入口にする。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "yokosuka-maedagawa-riverside-walk",
    templateId: "habitat_micro_walk",
    primaryType: "walk_route_species_map",
    municipality: "横須賀市",
    title: "前田川遊歩道のご案内",
    sourceUrl: "https://www.city.yokosuka.kanagawa.jp/5540/maedagawa/index.html",
    officialPageUrl: "https://www.city.yokosuka.kanagawa.jp/5540/maedagawa/index.html",
    affinityScore: 25,
    cue: "遊歩道、ポイント、通行止め注意、川の生きものが一体の型。ZUKANでは本筋から外れても戻りやすい案内を重視する。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "adachi-spring-autumn-creature-zukan",
    templateId: "seasonal_target_walk",
    primaryType: "worksheet_or_field_note",
    municipality: "足立区",
    title: "足立区だけの生きもの図鑑！2025春秋編",
    sourceUrl: "https://www.city.adachi.tokyo.jp/documents/74972/2025zukann.pdf",
    officialPageUrl: "https://www.city.adachi.tokyo.jp/documents/74972/2025zukann.pdf",
    affinityScore: 24,
    cue: "季節の図鑑と発見マップを一体で出す型。ZUKANではPDF転載ではなく、季節対象と公式引用元を分けて下書き化する。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "kitakyushu-yamada-green-walking-course",
    templateId: "route_species_walk",
    primaryType: "walk_route_species_map",
    municipality: "北九州市",
    title: "小倉北区 山田緑地散策コース",
    sourceUrl: "https://www.city.kitakyushu.lg.jp/page/walkingmap/kokurakita/kokurakita40.pdf",
    officialPageUrl: "https://www.city.kitakyushu.lg.jp/page/walkingmap/kokurakita/kokurakita40.pdf",
    affinityScore: 23,
    cue: "市公式ウォーキングマップ内で、自然と生きものの見どころをコース化する型。ZUKANでは厳密な順路ではなく、立ち寄り先と戻る手がかりに分ける。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "nagoya-sumika-map",
    templateId: "seasonal_target_walk",
    primaryType: "species_distribution_map",
    municipality: "名古屋市",
    title: "名古屋市生きものすみかマップ",
    sourceUrl: "https://www.city.nagoya.jp/kurashi/kankyou/1012463/1034795/1012526.html",
    officialPageUrl: "https://www.city.nagoya.jp/kurashi/kankyou/1012463/1034795/1012526.html",
    affinityScore: 23,
    cue: "すみかを分類して街の自然を読む型。ZUKANでは種名だけでなく、緑地、水辺、街路樹などの環境カードから記録へつなぐ。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "soka-ikimono-log-survey",
    templateId: "citizen_campaign_walk",
    primaryType: "citizen_science_report",
    municipality: "草加市",
    title: "そうか生きもの調査",
    sourceUrl: "https://www.city.soka.saitama.jp/cont/s1701/030/010/010/040/PAGE000000000000053060.html",
    officialPageUrl: "https://www.city.soka.saitama.jp/cont/s1701/030/010/010/040/PAGE000000000000053060.html",
    affinityScore: 24,
    cue: "紙調査票と環境省いきものログを併用する型。ZUKANでは自治体キャンペーン、外部提出、年度結果を同じ管理画面に寄せる比較対象にする。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "higashimurayama-ikimono-map",
    templateId: "seasonal_target_walk",
    primaryType: "species_distribution_map",
    municipality: "東村山市",
    title: "ひがしむらやま いきものマップ",
    sourceUrl: "https://www.city.higashimurayama.tokyo.jp/shisei/keikaku/bunya/kankyo/ikimonomap.html",
    officialPageUrl: "https://www.city.higashimurayama.tokyo.jp/shisei/keikaku/bunya/kankyo/ikimonomap.html",
    affinityScore: 24,
    cue: "市民と作る地域いきものマップ型。散歩道や川マップと組み合わせ、街歩きから生きもの記録へ移れる入口に向く。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "toda-saiko-nature-observation-map",
    templateId: "habitat_micro_walk",
    primaryType: "walk_route_species_map",
    municipality: "戸田市",
    title: "彩湖自然観察マップ",
    sourceUrl: "https://www.city.toda.saitama.jp/site/saiko/kyo-saiko-publish-kansatumap.html",
    officialPageUrl: "https://www.city.toda.saitama.jp/site/saiko/kyo-saiko-publish-kansatumap.html",
    affinityScore: 27,
    cue: "水辺の観察ポイントと生きものハンドブックが連動する型。ZUKANでは水辺安全、観察対象、写真記録を分けて軽く出す。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "fukui-ijira-satoyama-walk",
    templateId: "route_species_walk",
    primaryType: "walk_route_species_map",
    municipality: "福井市",
    title: "伊自良の里 いきもの散策マップ",
    sourceUrl: "https://www.city.fukui.lg.jp/kurasi/kankyo/study/pamphlet_1.html",
    officialPageUrl: "https://www.city.fukui.lg.jp/kurasi/kankyo/study/pamphlet_1.html",
    affinityScore: 27,
    cue: "里、川辺、山地を季節で歩く型。ZUKANでは車移動や温泉拠点も含め、順路固定ではなく立ち寄り先として扱う。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "fukui-pref-100yobako-worksheets",
    templateId: "worksheet_family_walk",
    primaryType: "worksheet_or_field_note",
    municipality: "福井県",
    title: "いきものひゃくようばこ",
    sourceUrl: "https://fncc.pref.fukui.lg.jp/entry/100yobako/explanation",
    officialPageUrl: "https://fncc.pref.fukui.lg.jp/entry/100yobako/explanation",
    affinityScore: 25,
    cue: "小学校周辺や身近な自然を継続観察するワークシート型。学校周辺の位置や子ども文脈は公開粒度を落として扱う。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "chiba-ogusa-yatsuda-living-creature-village",
    templateId: "habitat_micro_walk",
    primaryType: "walk_route_species_map",
    municipality: "千葉市",
    title: "大草谷津田いきものの里",
    sourceUrl: "https://www.city.chiba.jp/kankyo/kankyohozen/hozen/shizen/sizen_ikimono-top.html",
    officialPageUrl: "https://www.city.chiba.jp/kankyo/kankyohozen/hozen/shizen/sizen_ikimono-top.html",
    affinityScore: 25,
    cue: "谷津田の自然、利用案内、リーフレットが一体の保全地型。土地所有者協力地として立入条件と観察範囲を強めに確認する。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "kanagawa-koajiro-forest-guide",
    templateId: "stewardship_manners_walk",
    primaryType: "walk_route_species_map",
    municipality: "神奈川県",
    title: "小網代の森",
    sourceUrl: "https://www.pref.kanagawa.jp/docs/d2t/kankyo/p820028.html",
    officialPageUrl: "https://www.pref.kanagawa.jp/docs/d2t/kankyo/p820028.html",
    affinityScore: 25,
    cue: "森、湿地、干潟、海が続く散策路型。希少種、開場時間、採取禁止、駐車場なしをルート案内とは別の確認事項として扱う。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "oita-nature-observation-guide",
    templateId: "route_species_walk",
    primaryType: "walk_route_species_map",
    municipality: "大分市",
    title: "OITA自然観察ガイド / 身近な自然ガイドブック",
    sourceUrl: "https://www.city.oita.oita.jp/o141/oita-mijikanasizen-guide.html",
    officialPageUrl: "https://www.city.oita.oita.jp/o141/oita-mijikanasizen-guide.html",
    affinityScore: 26,
    cue: "複数コース、自然環境マップ、観察前注意を分冊で持つ型。ZUKANでは初回画面にコース候補と安全確認を同時に出す。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "kasukabe-oranavi-living-creature-map",
    templateId: "citizen_campaign_walk",
    primaryType: "citizen_science_report",
    municipality: "春日部市",
    title: "みんなで取り組む 生き物さがし / 生き物調査マップ",
    sourceUrl: "https://www.city.kasukabe.lg.jp/material/files/group/31/tyousainmanyuaru2023.pdf",
    officialPageUrl: "https://www.city.kasukabe.lg.jp/kurashi/kankyoshisaku/kankyokyoiku_gakushu/index.html",
    affinityScore: 28,
    cue: "公開型GISと紙調査票を併用する型。ZUKANでは投稿、確認待ち、公開地図を一つの運用レーンにまとめる比較対象にする。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "yamato-izumi-forest-guide",
    templateId: "habitat_micro_walk",
    primaryType: "walk_route_species_map",
    municipality: "大和市",
    title: "泉の森 自然観察ガイド",
    sourceUrl: "https://www.city.yamato.lg.jp/material/files/group/26/5_izuminomori.pdf",
    officialPageUrl: "https://www.city.yamato.lg.jp/material/files/group/26/5_izuminomori.pdf",
    affinityScore: 22,
    cue: "都市内の大きな緑地と自然観察拠点を扱う型。施設スポット、季節の観察、公開範囲を分けたライト導線に向く。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "ichikawa-living-creature-map",
    templateId: "citizen_campaign_walk",
    primaryType: "citizen_science_report",
    municipality: "市川市",
    title: "いちかわ生きものマップ",
    sourceUrl: "https://www.city.ichikawa.lg.jp/page/2301.html",
    officialPageUrl: "https://www.city.ichikawa.lg.jp/page/2301.html",
    affinityScore: 29,
    cue: "モニタリング調査員からの写真、発見日、場所を公開マップへ出す型。ZUKANでは投稿、確認、公開粒度、缶バッジのような返礼を同じ運用に寄せる。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "ichikawa-nature-observation-guide",
    templateId: "route_species_walk",
    primaryType: "walk_route_species_map",
    municipality: "市川市",
    title: "いちかわ自然観察ガイドマップ",
    sourceUrl: "https://www.city.ichikawa.lg.jp/page/2303.html",
    officialPageUrl: "https://www.city.ichikawa.lg.jp/page/2303.html",
    affinityScore: 27,
    cue: "地域別の自然観察ガイドPDFを複数持つ型。同じ市の投稿マップと組み合わせ、散策前の候補と散策後の記録を接続する参考にする。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "kawaguchi-ikilog-citizen-survey",
    templateId: "citizen_campaign_walk",
    primaryType: "citizen_science_report",
    municipality: "川口市",
    title: "川口いきもの調査",
    sourceUrl: "https://www.city.kawaguchi.lg.jp/soshiki/01100/021/ecosystem/27320.html",
    officialPageUrl: "https://www.city.kawaguchi.lg.jp/soshiki/01100/021/ecosystem/27320.html",
    affinityScore: 27,
    cue: "紙調査票といきものログ団体登録を併用する通年型。ZUKANでは初回記録を軽くしつつ、行政向けには調査員、指標種、年度結果を残す。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "arakawa-biome-zukan-campaign",
    templateId: "citizen_campaign_walk",
    primaryType: "citizen_science_report",
    municipality: "荒川区",
    title: "あら坊とつくろう！あらかわ生き物大図鑑",
    sourceUrl: "https://www.city.arakawa.tokyo.jp/a024/kankyou/tayousei/ikimono_daizukan.html",
    officialPageUrl: "https://www.city.arakawa.tokyo.jp/a024/kankyou/tayousei/ikimono_daizukan.html",
    affinityScore: 26,
    cue: "Biome投稿を区独自の図鑑や結果報告へ戻す型。ライト層にはキャラクターと季節イベント、自治体には結果ページという二段導線の参考にする。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "iijima-nature-positive-biome-survey",
    templateId: "citizen_campaign_walk",
    primaryType: "citizen_science_report",
    municipality: "飯島町",
    title: "飯島町のいきもの調査隊",
    sourceUrl: "https://www.town.iijima.lg.jp/soshikiichiran/juminzeimuka/kankyoukyouseienerugikakari/kankyoeisei/NaturePositive/5145.html",
    officialPageUrl: "https://www.town.iijima.lg.jp/soshikiichiran/juminzeimuka/kankyoukyouseienerugikakari/kankyoeisei/NaturePositive/5145.html",
    affinityScore: 28,
    cue: "町のネイチャーポジティブ戦略づくりとBiome調査を接続する型。ZUKANでは地域戦略、対象種、観察イベント、成果出力を一つの自治体画面に束ねる。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "katori-omigawa-park-nature-map",
    templateId: "habitat_micro_walk",
    primaryType: "worksheet_or_field_note",
    municipality: "香取市",
    title: "小見川 城山公園 自然観察マップ",
    sourceUrl: "https://www.city.katori.lg.jp/living/ahiminkatsudo/shiminkyodo/omigawatyuuou.files/20230415naturemap.pdf",
    officialPageUrl: "https://www.city.katori.lg.jp/living/ahiminkatsudo/shiminkyodo/omigawatyuuou.files/20230415naturemap.pdf",
    affinityScore: 23,
    cue: "公園内の植物観察ポイントと採取禁止を明示するPDF単体型。ZUKANでは施設スポットに安全メモと写真記録入口を足す余地が大きい。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "hiroshima-pref-ikilog-observation",
    templateId: "citizen_campaign_walk",
    primaryType: "citizen_science_report",
    municipality: "広島県",
    title: "ひろしま県民いきもの調査",
    sourceUrl: "https://www.pref.hiroshima.lg.jp/site/tayousei/investigation-biodiversity-wanted.html",
    officialPageUrl: "https://www.pref.hiroshima.lg.jp/site/tayousei/investigation-biodiversity-wanted.html",
    affinityScore: 24,
    cue: "県単位で対象種、外来種、いきものログ実習観察会を扱う型。市町村散策とは分け、広域キャンペーンと安全マナーの参考にする。",
  },
  {
    schemaVersion: "municipal_walk_map_source_catalog/v0",
    sourceId: "chiba-biome-living-creature-search",
    templateId: "citizen_campaign_walk",
    primaryType: "citizen_science_report",
    municipality: "千葉市",
    title: "身近な生き物さがし",
    sourceUrl: "https://www.city.chiba.jp/kankyo/kankyohozen/hozen/r1_ikimonosagashi.html",
    officialPageUrl: "https://www.city.chiba.jp/kankyo/kankyohozen/hozen/r1_ikimonosagashi.html",
    affinityScore: 25,
    cue: "身近な生き物を探すキャンペーンと結果公開の型。ZUKANでは投稿終了後も地域ページに結果と次回入口を残す比較対象にする。",
  },
];

function cloneWalkMapConfig(config: MunicipalWalkMapConfigV0): MunicipalWalkMapConfigV0 {
  return {
    ...config,
    areaScope: {
      municipalityCodes: [...config.areaScope.municipalityCodes],
      placeIds: [...config.areaScope.placeIds],
      polygonIds: [...config.areaScope.polygonIds],
    },
    creatorProfile: { ...config.creatorProfile },
    routeStops: config.routeStops.map((stop) => ({
      ...stop,
      sensitiveContext: stop.sensitiveContext ?? null,
      noticeCues: [...stop.noticeCues],
      recordCues: [...stop.recordCues],
      safetyNotes: [...stop.safetyNotes],
    })),
    recordModes: [...config.recordModes],
    routeFlexibility: {
      routeStyle: config.routeFlexibility.routeStyle,
      mobilityModes: [...config.routeFlexibility.mobilityModes],
      offRoutePolicy: config.routeFlexibility.offRoutePolicy,
      returnCues: [...config.routeFlexibility.returnCues],
    },
    claimBoundary: [...config.claimBoundary],
    sourceReferences: config.sourceReferences.map((ref) => ({ ...ref })),
    publicationReview: cleanPublicationReview(config.publicationReview),
  };
}

export function listMunicipalWalkMapTemplatesV0(): MunicipalWalkMapTemplateV0[] {
  return MUNICIPAL_WALK_MAP_TEMPLATES_V0.map((template) => ({
    ...template,
    exampleSources: template.exampleSources.map((source) => ({ ...source })),
    config: cloneWalkMapConfig(template.config),
  }));
}

export function listMunicipalWalkMapSourceCatalogV0(options: MunicipalWalkMapSourceCatalogFilterV0 = {}): MunicipalWalkMapSourceCatalogEntryV0[] {
  const templateId = cleanText(options.templateId, 80);
  const accessKind = cleanText(options.accessKind, 80);
  const coordinateSensitivity = cleanText(options.coordinateSensitivity, 80);
  const reuseRisk = cleanText(options.reuseRisk, 80);
  return MUNICIPAL_WALK_MAP_SOURCE_CATALOG_V0
    .filter((entry) => !templateId || entry.templateId === templateId)
    .filter((entry) => !accessKind || sourceAccessModelV0(entry).downloadKind === accessKind)
    .filter((entry) => !coordinateSensitivity || sourceRiskModelV0(entry).coordinateSensitivity === coordinateSensitivity)
    .filter((entry) => !reuseRisk || sourceRiskModelV0(entry).reuseRisk === reuseRisk)
    .map((entry) => ({ ...entry }));
}

export function sourceOperationalModelV0(source: MunicipalWalkMapSourceCatalogEntryV0): MunicipalWalkMapOperationalModelV0 {
  const haystack = [
    source.sourceId,
    source.title,
    source.sourceUrl,
    source.officialPageUrl,
    source.cue,
  ].join(" ").toLowerCase();
  if (haystack.includes("ikilog") || haystack.includes("いきものログ")) {
    return "national_platform_link";
  }
  if (haystack.includes("biome") || haystack.includes("inaturalist")) {
    return "external_app_campaign";
  }
  if (source.primaryType === "worksheet_or_field_note" || haystack.includes("worksheet") || haystack.includes("field")) {
    return "fieldwork_worksheet_portal";
  }
  if (
    source.primaryType === "citizen_science_report"
    || source.primaryType === "species_distribution_map"
    || haystack.includes("投稿")
    || haystack.includes("公開マップ")
    || haystack.includes("公開型gis")
    || haystack.includes("調査マップ")
  ) {
    return "municipal_submission_map";
  }
  return "official_walk_pdf";
}

export function sourceAccessModelV0(source: MunicipalWalkMapSourceCatalogEntryV0): MunicipalWalkMapSourceAccessModelV0 {
  const sourceUrl = source.sourceUrl.trim();
  const officialPageUrl = source.officialPageUrl.trim();
  const haystack = [
    source.sourceId,
    source.title,
    sourceUrl,
    officialPageUrl,
    source.cue,
  ].join(" ").toLowerCase();
  const isDirectPdf = /\.pdf(?:$|[?#])/i.test(sourceUrl);
  const isExternalSubmission =
    haystack.includes("biome")
    || haystack.includes("inaturalist")
    || haystack.includes("ikilog")
    || haystack.includes("いきものログ")
    || haystack.includes("line")
    || haystack.includes("form")
    || haystack.includes("フォーム");
  if (isDirectPdf) {
    return {
      downloadKind: "direct_pdf",
      label: "PDF直接",
      downloadUrl: sourceUrl,
      rightsNote: "公式PDFは引用元として扱い、本文・図版・写真は転載しない。",
      importPolicy: "citation_only_no_body_copy",
    };
  }
  if (isExternalSubmission) {
    return {
      downloadKind: "html_or_external_form",
      label: "外部導線",
      downloadUrl: null,
      rightsNote: "外部アプリ、投稿フォーム、国基盤の案内を引用元として扱い、投稿データは取り込まない。",
      importPolicy: "citation_only_no_body_copy",
    };
  }
  return {
    downloadKind: "official_page_with_links",
    label: "公式ページ",
    downloadUrl: null,
    rightsNote: "公式ページ内のPDFや地図リンクを確認し、ZUKAN側には引用元URLと再構成した立ち寄り先だけを入れる。",
    importPolicy: "citation_only_no_body_copy",
  };
}

export function sourceRiskModelV0(source: MunicipalWalkMapSourceCatalogEntryV0): MunicipalWalkMapSourceRiskModelV0 {
  const access = sourceAccessModelV0(source);
  const cueForRiskAnalysis = source.cue.replace(/\bZUKAN\b/gi, " ");
  const haystack = [
    source.sourceId,
    source.templateId,
    source.primaryType,
    source.municipality,
    source.title,
    source.sourceUrl,
    source.officialPageUrl,
    cueForRiskAnalysis,
  ].join(" ").toLowerCase();
  const flags = new Set<string>();
  if (access.downloadKind === "direct_pdf") flags.add("direct_pdf_rights_check");
  if (access.downloadKind === "official_page_with_links" && /pdf/.test(haystack)) flags.add("official_page_pdf_links_check");
  if (access.downloadKind === "html_or_external_form") flags.add("external_platform_terms_check");
  if (source.primaryType === "species_distribution_map" || /希少|rare|貴重/.test(haystack)) flags.add("sensitive_species_location_check");
  if (/学校|児童|子ども|こども|親子|園児|minor|school|children/.test(haystack)) flags.add("minor_or_school_context_check");
  if (/私有地|住宅|自宅|private|permission|許可|立入|採取禁止/.test(haystack)) flags.add("private_or_permission_boundary_check");
  if (/水辺|川|河川|海|干潟|湖|池|遊水地|water|waterfront|river|wetland/.test(haystack)) flags.add("waterfront_safety_check");
  if (/写真|画像|図鑑|作品|photo|image|zukan/.test(haystack)) flags.add("photo_or_illustration_reuse_check");

  const coordinateSensitivity = flags.has("sensitive_species_location_check") || flags.has("minor_or_school_context_check")
    ? "high_sensitive_or_minor"
    : flags.has("private_or_permission_boundary_check") || flags.has("waterfront_safety_check") || access.downloadKind !== "official_page_with_links"
      ? "medium_area_only"
      : "low_public_route";
  const reuseRisk = flags.has("minor_or_school_context_check") || flags.has("photo_or_illustration_reuse_check")
    ? "high_photo_or_minor_content"
    : flags.has("direct_pdf_rights_check") || flags.has("official_page_pdf_links_check") || flags.has("external_platform_terms_check")
      ? "medium_pdf_or_external_terms"
      : "low_citation_page";

  const reviewFlags = [...flags].sort();
  return {
    coordinateSensitivity,
    reuseRisk,
    reviewFlags,
    reviewNote: reviewFlags.length > 0
      ? "公開前に位置の粗さ、立入条件、引用元、写真・図版の扱いを確認する。"
      : "公式ページURLの引用と、公開された道・施設の範囲で下書き化する。",
  };
}

export function getMunicipalWalkMapSourceCatalogEntryV0(sourceId: string): MunicipalWalkMapSourceCatalogEntryV0 | null {
  const cleanSourceId = cleanText(sourceId, 128);
  if (!cleanSourceId) return null;
  return listMunicipalWalkMapSourceCatalogV0().find((entry) => entry.sourceId === cleanSourceId) ?? null;
}

export function getMunicipalWalkMapTemplateV0(templateId: string): MunicipalWalkMapTemplateV0 | null {
  return listMunicipalWalkMapTemplatesV0().find((template) => template.templateId === templateId) ?? null;
}

export function buildMunicipalWalkMapConfigFromTemplateV0(templateId: string): MunicipalWalkMapConfigV0 {
  const template = getMunicipalWalkMapTemplateV0(templateId);
  if (!template) {
    throw new Error(`unknown_municipal_walk_map_template:${templateId}`);
  }
  return cloneWalkMapConfig(template.config);
}

function buildShizuokaIkimonoWalkRouteDraftV0(source: MunicipalWalkMapSourceCatalogEntryV0): MunicipalWalkMapConfigV0 {
  const samples = [
    getStaticMunicipalWalkMapConfigV0("jp-shizuoka-yatsuyama-sample-v0"),
    getStaticMunicipalWalkMapConfigV0("jp-shizuoka-asahata-waterfront-sample-v0"),
    getStaticMunicipalWalkMapConfigV0("jp-shizuoka-mariko-waterfront-sample-v0"),
  ];
  const routeStops = samples.flatMap((sample) => sample.routeStops.map((stop) => ({
    ...stop,
    stopId: `${sample.walkMapId.replace(/^jp-shizuoka-/, "").replace(/-sample-v0$/, "")}-${stop.stopId}`,
    internalMemo: "静岡市公式ページ掲載資料を出典に、本文・図版・写真を転載せず、公開範囲での立ち寄り先として再構成した下書き。",
  })));
  const sourceReferences = [
    {
      label: source.title,
      url: source.officialPageUrl,
      note: "公式ページを引用元として使います。PDF本文、図版、写真は転載しません。",
    },
    ...samples.flatMap((sample) => sample.sourceReferences)
      .filter((ref, index, refs) => refs.findIndex((candidate) => candidate.url === ref.url) === index),
  ];

  return {
    ...buildMunicipalWalkMapConfigFromTemplateV0(source.templateId),
    walkMapId: `draft-${source.sourceId}`,
    municipality: source.municipality,
    creatorName: source.municipality,
    creatorProfile: {
      creatorId: "municipality:shizuoka-city",
      registrationKind: "municipality",
      verificationStatus: "pending",
      commercialIntent: "none",
    },
    title: "静岡市 いきもの散策マップ 下書き",
    summary: "静岡市の公式ページを引用元に、谷津山、麻機、丸子川・広野海岸公園周辺を、公開範囲で立ち寄れる複数スポットとして整理する下書きです。",
    theme: "seasonal_walk",
    publishMode: "draft",
    areaScope: {
      municipalityCodes: ["22100"],
      placeIds: [],
      polygonIds: [],
    },
    routeStops,
    recordModes: ["photo", "audio", "memo", "unknown_species"],
    routeFlexibility: {
      routeStyle: "loose_stops",
      mobilityModes: ["walk", "bike", "car", "public_transport"],
      offRoutePolicy: "off_route_allowed",
      returnCues: [
        "近い公園入口、橋、案内板、大きな道を目印に戻る",
        "歩き、自転車、車では、それぞれ安全に止まれる公開場所だけ使う",
        "水辺や山側で天候や足元が悪いときは近い公開道へ戻る",
      ],
    },
    publicPrecisionPolicy: "mesh_or_coarser",
    claimBoundary: [
      "静岡市公式ページと掲載PDFを出典にした下書きで、PDF本文、図版、写真は転載していません。",
      "現地の案内、立入条件、天候、水位、交通状況を優先します。",
      "学校、住宅、私有地、希少種、営巣場所が推測される情報は公開前に出し方を確認します。",
      "公式調査結果ではなく、散策と記録導線をレビューするための下書きです。",
    ],
    sourceReferences,
    publicationReview: {
      publicAccessAttested: false,
      sourceRightsAttested: false,
      permissionAttestedBy: null,
      permissionAttestedAt: null,
      publishApprovedByUserId: null,
      publishApprovedAt: null,
      emergencyHidden: false,
      takedownReason: null,
    },
  };
}

export function buildMunicipalWalkMapConfigFromSourceCatalogV0(sourceId: string): MunicipalWalkMapConfigV0 {
  const source = getMunicipalWalkMapSourceCatalogEntryV0(sourceId);
  if (!source) {
    throw new Error(`unknown_municipal_walk_map_source:${sourceId}`);
  }
  if (source.sourceId === "shizuoka-ikimono-walk-route") {
    return buildShizuokaIkimonoWalkRouteDraftV0(source);
  }
  const config = buildMunicipalWalkMapConfigFromTemplateV0(source.templateId);
  return {
    ...config,
    walkMapId: `draft-${source.sourceId}`,
    municipality: source.municipality,
    creatorName: source.municipality,
    title: `${source.title} 下書き`.slice(0, 120),
    summary: `${source.municipality}の公式ページを引用元に、公開範囲、立入条件、記録項目をZUKAN用に整理する下書きです。`.slice(0, 240),
    sourceReferences: [
      {
        label: source.title,
        url: source.officialPageUrl,
        note: "公式ページを引用元として使います。PDF本文、図版、写真は転載しません。",
      },
    ],
    publicationReview: {
      publicAccessAttested: false,
      sourceRightsAttested: false,
      permissionAttestedBy: null,
      permissionAttestedAt: null,
      publishApprovedByUserId: null,
      publishApprovedAt: null,
      emergencyHidden: false,
      takedownReason: null,
    },
  };
}

export function getStaticMunicipalWalkMapConfigV0(walkMapId = DEFAULT_WALK_MAP_ID): MunicipalWalkMapConfigV0 {
  const config = STATIC_MUNICIPAL_WALK_MAPS_V0.find((map) => map.walkMapId === walkMapId);
  if (!config) {
    throw new Error(`unknown_municipal_walk_map_config:${walkMapId}`);
  }
  return config;
}

export function listStaticMunicipalWalkMapPublicSummariesV0(): MunicipalWalkMapPublicSummaryV0[] {
  return STATIC_MUNICIPAL_WALK_MAPS_V0
    .filter((config) => config.walkMapId !== DEFAULT_WALK_MAP_ID)
    .filter((config) => config.publishMode === "public" || config.publishMode === "public_preview")
    .map(buildMunicipalWalkMapPublicSummaryV0);
}
