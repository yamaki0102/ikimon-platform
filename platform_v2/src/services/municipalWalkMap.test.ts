import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRegisteredCreatorProfileForWriteV0,
  buildMunicipalWalkMapConfigFromSourceCatalogV0,
  buildMunicipalWalkMapPublicReadModelV0,
  buildMunicipalWalkMapPublicSummaryV0,
  creatorProfileFromRegistryEntryV0,
  getMunicipalWalkMapConfigV0FromDb,
  getMunicipalWalkMapCreatorV0,
  getStaticMunicipalWalkMapConfigV0,
  listMunicipalWalkMapCreatorsV0,
  listMunicipalWalkMapReviewQueueV0,
  listMunicipalWalkMapSourceCatalogV0,
  listStaticMunicipalWalkMapPublicSummariesV0,
  listPublicMunicipalWalkMapSummariesV0,
  listMunicipalWalkMapTemplatesV0,
  reviewMunicipalWalkMapPublicationV0,
  sourceAccessModelV0,
  sourceOperationalModelV0,
  upsertMunicipalWalkMapConfigV0,
  upsertMunicipalWalkMapCreatorV0,
  validateMunicipalWalkMapCreatorV0,
  validateMunicipalWalkMapConfigV0,
  type MunicipalWalkMapConfigV0,
  type MunicipalWalkMapCreatorRegistryEntryV0,
} from "./municipalWalkMap.js";

function createMunicipalWalkMapFakeDb() {
  type CreatorRow = {
    creator_id: string;
    display_name: string;
    registration_kind: string;
    verification_status: string;
    commercial_intent: string;
    notes: string;
  };
  type MapRow = {
    walk_map_id: string;
    municipality: string;
    creator_name: string;
    creator_profile: MunicipalWalkMapConfigV0["creatorProfile"];
    title: string;
    summary: string;
    theme: MunicipalWalkMapConfigV0["theme"];
    publish_mode: MunicipalWalkMapConfigV0["publishMode"];
    area_scope: MunicipalWalkMapConfigV0["areaScope"];
    record_modes: MunicipalWalkMapConfigV0["recordModes"];
    route_flexibility: MunicipalWalkMapConfigV0["routeFlexibility"];
    public_precision_policy: MunicipalWalkMapConfigV0["publicPrecisionPolicy"];
    claim_boundary: string[];
    source_references: MunicipalWalkMapConfigV0["sourceReferences"];
    publication_review: MunicipalWalkMapConfigV0["publicationReview"];
    updated_at?: string;
  };
  type StopRow = {
    stop_id: string;
    title: string;
    area_kind: MunicipalWalkMapConfigV0["routeStops"][number]["areaKind"];
    linked_field_id: string | null;
    access: MunicipalWalkMapConfigV0["routeStops"][number]["access"];
    sensitive_context: MunicipalWalkMapConfigV0["routeStops"][number]["sensitiveContext"] | null;
    estimated_minutes: number | null;
    notice_cues: string[];
    record_cues: string[];
    safety_notes: string[];
    internal_memo: string | null;
  };
  const creators = new Map<string, CreatorRow>();
  const maps = new Map<string, MapRow>();
  const stops = new Map<string, StopRow[]>();
  const auditRows: unknown[][] = [];
  const sqlLog: string[] = [];

  async function query<T = unknown>(sql: string, params: unknown[] = []): Promise<{ rows: T[] }> {
    sqlLog.push(sql);
    if (/^BEGIN|^COMMIT|^ROLLBACK/.test(sql)) return { rows: [] };
    if (/FROM municipal_walk_map_creators\s+ORDER BY/.test(sql)) {
      return { rows: [...creators.values()] as T[] };
    }
    if (/FROM municipal_walk_map_creators\s+WHERE creator_id/.test(sql)) {
      const row = creators.get(String(params[0]));
      return { rows: (row ? [row] : []) as T[] };
    }
    if (/INSERT INTO municipal_walk_map_creators/.test(sql)) {
      const row: CreatorRow = {
        creator_id: String(params[0]),
        display_name: String(params[1]),
        registration_kind: String(params[2]),
        verification_status: String(params[3]),
        commercial_intent: String(params[4]),
        notes: String(params[6] ?? ""),
      };
      creators.set(row.creator_id, row);
      return { rows: [row] as T[] };
    }
    if (/FROM municipal_walk_maps\s+WHERE walk_map_id/.test(sql)) {
      const row = maps.get(String(params[0]));
      return { rows: (row ? [row] : []) as T[] };
    }
    if (/FROM municipal_walk_maps m/.test(sql) && /ORDER BY updated_at DESC/.test(sql)) {
      const rows = [...maps.values()]
        .filter((row) => row.publish_mode === "public")
        .map((row) => ({ ...row, stop_count: String((stops.get(row.walk_map_id) ?? []).length) }));
      return { rows: rows as T[] };
    }
    if (/FROM municipal_walk_maps\s+ORDER BY/.test(sql)) {
      const rows = [...maps.values()].map((row) => ({ ...row, updated_at: row.updated_at ?? "2026-06-25T00:00:00.000Z" }));
      return { rows: rows as T[] };
    }
    if (/INSERT INTO municipal_walk_maps/.test(sql)) {
      const row: MapRow = {
        walk_map_id: String(params[0]),
        municipality: String(params[1]),
        creator_name: String(params[2]),
        creator_profile: JSON.parse(String(params[3])) as MunicipalWalkMapConfigV0["creatorProfile"],
        title: String(params[4]),
        summary: String(params[5]),
        theme: params[6] as MunicipalWalkMapConfigV0["theme"],
        publish_mode: params[7] as MunicipalWalkMapConfigV0["publishMode"],
        area_scope: JSON.parse(String(params[8])) as MunicipalWalkMapConfigV0["areaScope"],
        record_modes: params[9] as MunicipalWalkMapConfigV0["recordModes"],
        route_flexibility: JSON.parse(String(params[10])) as MunicipalWalkMapConfigV0["routeFlexibility"],
        public_precision_policy: params[11] as MunicipalWalkMapConfigV0["publicPrecisionPolicy"],
        claim_boundary: params[12] as string[],
        source_references: JSON.parse(String(params[13])) as MunicipalWalkMapConfigV0["sourceReferences"],
        publication_review: JSON.parse(String(params[14])) as MunicipalWalkMapConfigV0["publicationReview"],
        updated_at: "2026-06-25T00:00:00.000Z",
      };
      maps.set(row.walk_map_id, row);
      return { rows: [row] as T[] };
    }
    if (/DELETE FROM municipal_walk_map_stops/.test(sql)) {
      stops.set(String(params[0]), []);
      return { rows: [] };
    }
    if (/INSERT INTO municipal_walk_map_stops/.test(sql)) {
      const walkMapId = String(params[0]);
      const row: StopRow = {
        stop_id: String(params[1]),
        title: String(params[3]),
        area_kind: params[4] as StopRow["area_kind"],
        linked_field_id: params[5] == null ? null : String(params[5]),
        access: params[6] as StopRow["access"],
        sensitive_context: params[12] as StopRow["sensitive_context"],
        estimated_minutes: params[7] == null ? null : Number(params[7]),
        notice_cues: params[8] as string[],
        record_cues: params[9] as string[],
        safety_notes: params[10] as string[],
        internal_memo: params[11] == null ? null : String(params[11]),
      };
      stops.set(walkMapId, [...(stops.get(walkMapId) ?? []), row]);
      return { rows: [] };
    }
    if (/FROM municipal_walk_map_stops/.test(sql)) {
      return { rows: (stops.get(String(params[0])) ?? []) as T[] };
    }
    if (/INSERT INTO municipal_walk_map_audit/.test(sql)) {
      auditRows.push(params);
      return { rows: [] };
    }
    throw new Error(`unexpected_sql:${sql.trim().split(/\s+/).slice(0, 8).join(" ")}`);
  }

  return {
    auditRows,
    sqlLog,
    pool: {
      query,
      connect: async () => ({
        query,
        release() {},
      }),
    },
  };
}

test("static municipal walk map config can publish public route stops without a DB migration", () => {
  const config = getStaticMunicipalWalkMapConfigV0();
  const publicMap = buildMunicipalWalkMapPublicReadModelV0(config);

  assert.equal(config.schemaVersion, "municipal_walk_map_config/v0");
  assert.equal(publicMap.schemaVersion, "municipal_walk_map_public/v0");
  assert.equal(publicMap.walkMapId, "jp-shizuoka-light-nature-walk-v0");
  assert.equal(publicMap.publishMode, "public_preview");
  assert.equal(publicMap.stops.length, 2);
  assert.equal(publicMap.stops[0]?.accessLabel, "public_scope");
  assert.equal(publicMap.routeFlexibility.routeStyle, "loose_stops");
  assert.deepEqual(publicMap.routeFlexibility.mobilityModes, ["walk", "bike", "public_transport"]);
  assert.match(publicMap.routeFlexibility.returnCues.join("\n"), /目印に戻る/);
  assert.match(publicMap.stops[0]?.recordHref ?? "", /context=municipal_walk_map/);
  assert.match(publicMap.stops[0]?.recordHref ?? "", /walkMapId=jp-shizuoka-light-nature-walk-v0/);
  assert.match(publicMap.stops[0]?.recordHref ?? "", /fieldId=osm_park%3Asample-public-park/);
  assert.match(publicMap.sourceReferences[0]?.url ?? "", /city\.shizuoka\.lg\.jp/);
  assert.equal(publicMap.validation.ok, true);
});

test("static municipal walk map summaries expose area-level hints without exact stop locations", () => {
  const config = getStaticMunicipalWalkMapConfigV0("jp-shizuoka-asahata-waterfront-sample-v0");
  const summary = buildMunicipalWalkMapPublicSummaryV0(config);

  assert.equal(summary.areaHint?.precision, "area_hint");
  assert.equal(summary.areaHint?.source, "official_source_sample");
  assert.match(summary.areaHint?.label ?? "", /麻機/);
  assert.equal(summary.areaHint?.lat, 35.015);
  assert.equal(summary.areaHint?.lng, 138.389);
  assert.doesNotMatch(JSON.stringify(summary), /routeStops|linkedFieldId|stopId|水辺を外から見る場所/);
});

test("static municipal walk map area hints stay coarse across public summaries", () => {
  const summaries = listStaticMunicipalWalkMapPublicSummariesV0().filter((summary) => summary.areaHint);
  assert.ok(summaries.length >= 3);

  for (const summary of summaries) {
    const hint = summary.areaHint;
    assert.equal(hint?.precision, "area_hint");
    assert.equal(hint?.source, "official_source_sample");
    assert.match(String(hint?.lat), /^-?\d+(\.\d{1,3})?$/);
    assert.match(String(hint?.lng), /^-?\d+(\.\d{1,3})?$/);
    assert.doesNotMatch(JSON.stringify(summary), /routeStops|linkedFieldId|stopId|public-park-start|asahata-water-edge|mariko-river-edge/);
  }
});

test("municipal walk map suppresses strong record CTA for school and permission-required stops", () => {
  const config: MunicipalWalkMapConfigV0 = {
    ...getStaticMunicipalWalkMapConfigV0(),
    publishMode: "draft",
    routeStops: [
      {
        stopId: "school-edge-check",
        title: "学校周辺は外から確認",
        areaKind: "school",
        linkedFieldId: null,
        access: "permission_required",
        estimatedMinutes: 5,
        noticeCues: ["道路側から見える季節の変化"],
        recordCues: ["公開道路から見える景色"],
        safetyNotes: ["敷地内へ入らない"],
      },
    ],
  };
  const publicMap = buildMunicipalWalkMapPublicReadModelV0(config);
  const schoolStop = publicMap.stops.find((stop) => stop.stopId === "school-edge-check");

  assert.equal(schoolStop?.accessLabel, "check_permission");
  assert.equal(schoolStop?.recordHref, null);
  assert.equal(publicMap.locationSafety.publicExactStopLocation, false);
  assert.equal(publicMap.locationSafety.recordCtaRule, "public_access_non_school_only");
  assert.deepEqual(publicMap.locationSafety.blockedStopIds, ["school-edge-check"]);
  assert.ok(publicMap.locationSafety.defaultHiddenContexts.includes("school_or_private_land"));
  assert.deepEqual(publicMap.validation.blockedStopIds, ["school-edge-check"]);
  assert.match(publicMap.validation.warnings.join("\n"), /school_stop_requires_permission:school-edge-check/);
});

test("municipal walk map validation blocks restricted stops from public modes", () => {
  const config: MunicipalWalkMapConfigV0 = {
    ...getStaticMunicipalWalkMapConfigV0(),
    publishMode: "public_preview",
    routeStops: [
      {
        stopId: "unknown-access",
        title: "立入条件を確認する場所",
        areaKind: "other",
        linkedFieldId: null,
        access: "unknown",
        estimatedMinutes: 5,
        noticeCues: ["現地案内"],
        recordCues: ["なし"],
        safetyNotes: ["立入条件を確認する"],
      },
    ],
  };

  const validation = validateMunicipalWalkMapConfigV0(config);

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /blocked_stop_not_publishable:unknown-access/);
  assert.deepEqual(validation.blockedStopIds, ["unknown-access"]);
});

test("municipal walk map public modes require linked public fields for record CTAs", () => {
  const base = getStaticMunicipalWalkMapConfigV0();
  const validation = validateMunicipalWalkMapConfigV0({
    ...base,
    publishMode: "public_preview",
    routeStops: [
      {
        stopId: "public-without-field",
        title: "公開範囲だが未確認の入口",
        areaKind: "park",
        linkedFieldId: null,
        access: "public_access",
        estimatedMinutes: 5,
        noticeCues: ["案内板"],
        recordCues: ["花"],
        safetyNotes: ["公開範囲を確認"],
      },
    ],
  });
  const publicMap = buildMunicipalWalkMapPublicReadModelV0({
    ...base,
    publishMode: "public_preview",
    routeStops: [
      {
        stopId: "public-without-field",
        title: "公開範囲だが未確認の入口",
        areaKind: "park",
        linkedFieldId: null,
        access: "public_access",
        estimatedMinutes: 5,
        noticeCues: ["案内板"],
        recordCues: ["花"],
        safetyNotes: ["公開範囲を確認"],
      },
    ],
  });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /public_stop_requires_linked_field:public-without-field/);
  assert.equal(publicMap.stops[0]?.recordHref, null);
});

test("municipal walk map public modes require verified non-primary organization creators and approval", () => {
  const base = getStaticMunicipalWalkMapConfigV0("jp-shizuoka-asahata-waterfront-sample-v0");
  const unverified = validateMunicipalWalkMapConfigV0({
    ...base,
    publishMode: "public",
    creatorProfile: {
      creatorId: "group:pending-walk-team",
      registrationKind: "registered_group",
      verificationStatus: "pending",
      commercialIntent: "none",
    },
    publicationReview: {
      publicAccessAttested: true,
      sourceRightsAttested: true,
      permissionAttestedBy: "test",
      permissionAttestedAt: "2026-06-24",
      publishApprovedByUserId: "admin-user",
      publishApprovedAt: "2026-06-24",
      emergencyHidden: false,
      takedownReason: null,
    },
  });
  const commercialPrimary = validateMunicipalWalkMapConfigV0({
    ...base,
    publishMode: "public_preview",
    creatorProfile: {
      creatorId: "company:tour-sales",
      registrationKind: "registered_company",
      verificationStatus: "verified",
      commercialIntent: "primary",
    },
  });
  const missingApproval = validateMunicipalWalkMapConfigV0({
    ...base,
    publishMode: "public",
    publicationReview: {
      publicAccessAttested: true,
      sourceRightsAttested: true,
      permissionAttestedBy: "test",
      permissionAttestedAt: "2026-06-24",
      publishApprovedByUserId: null,
      publishApprovedAt: null,
      emergencyHidden: false,
      takedownReason: null,
    },
  });

  assert.match(unverified.errors.join("\n"), /public_publish_requires_verified_creator/);
  assert.match(commercialPrimary.errors.join("\n"), /commercial_primary_not_publishable/);
  assert.match(missingApproval.errors.join("\n"), /publish_approval_required/);
});

test("municipal walk map suggested order is limited to verified organization creators", () => {
  const base = getStaticMunicipalWalkMapConfigV0("jp-shizuoka-asahata-waterfront-sample-v0");
  const validation = validateMunicipalWalkMapConfigV0({
    ...base,
    publishMode: "draft",
    creatorProfile: {
      creatorId: null,
      registrationKind: "individual",
      verificationStatus: "self_declared",
      commercialIntent: "none",
    },
    routeFlexibility: {
      ...base.routeFlexibility,
      routeStyle: "suggested_order",
    },
  });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /suggested_order_requires_verified_org/);
});

test("municipal walk map sensitive public-edge context blocks public publication and record CTA", () => {
  const base = getStaticMunicipalWalkMapConfigV0();
  const config: MunicipalWalkMapConfigV0 = {
    ...base,
    publishMode: "public_preview",
    routeStops: [
      {
        stopId: "school-route-edge",
        title: "通学路の植え込み",
        areaKind: "street_edge",
        linkedFieldId: "field:public-road-edge",
        access: "public_access",
        sensitiveContext: "school_or_minor",
        estimatedMinutes: 5,
        noticeCues: ["道沿いの緑"],
        recordCues: ["足元の花"],
        safetyNotes: ["子どもが写らないようにする"],
      },
    ],
  };

  const validation = validateMunicipalWalkMapConfigV0(config);
  const publicMap = buildMunicipalWalkMapPublicReadModelV0(config);

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /blocked_stop_not_publishable:school-route-edge/);
  assert.match(validation.warnings.join("\n"), /school_or_minor_context_stop:school-route-edge/);
  assert.equal(publicMap.stops[0]?.recordHref, null);
  assert.deepEqual(publicMap.locationSafety.blockedStopIds, ["school-route-edge"]);
});

test("municipal walk map validation returns errors for malformed config instead of throwing", () => {
  const validation = validateMunicipalWalkMapConfigV0({
    schemaVersion: "municipal_walk_map_config/v0",
    walkMapId: "broken",
    municipality: "テスト市",
    creatorName: "テスト市",
    title: "壊れたマップ",
    publishMode: "public",
    theme: "bad-theme",
    recordModes: "photo",
    routeStops: [
      {
        stopId: "x",
        title: "x",
        areaKind: "bad",
        access: "bad",
        noticeCues: "x",
        recordCues: [],
        safetyNotes: [],
      },
    ],
  });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /invalid_theme/);
  assert.match(validation.errors.join("\n"), /record_modes_required/);
  assert.match(validation.errors.join("\n"), /invalid_area_kind:x/);
  assert.match(validation.errors.join("\n"), /notice_cues_required:x/);
});

test("municipal walk map public read model strips internal memo and normalizes cues", () => {
  const config: MunicipalWalkMapConfigV0 = {
    schemaVersion: "municipal_walk_map_config/v0",
    walkMapId: "test-walk-map",
    municipality: "テスト市",
    creatorName: "テスト市",
    creatorProfile: {
      creatorId: "municipality:test-city",
      registrationKind: "municipality",
      verificationStatus: "verified",
      commercialIntent: "none",
    },
    title: "川沿いの散歩",
    summary: "公開範囲から水辺を見る。",
    theme: "waterfront",
    publishMode: "public_preview",
    areaScope: {
      municipalityCodes: ["00000"],
      placeIds: [],
      polygonIds: [],
    },
    routeStops: [
      {
        stopId: "river-edge",
        title: "川沿い",
        areaKind: "waterfront",
        linkedFieldId: "field:river-edge",
        access: "public_access",
        estimatedMinutes: 18.7,
        noticeCues: ["水面", "水面", "橋の下", ""],
        recordCues: ["鳥の声", "草地", "鳥の声"],
        safetyNotes: ["増水時は近づかない"],
        internalMemo: "管理者だけの確認事項",
      },
    ],
    recordModes: ["photo", "memo", "unknown_species"],
    routeFlexibility: {
      routeStyle: "loose_stops",
      mobilityModes: ["walk", "bike"],
      offRoutePolicy: "off_route_allowed",
      returnCues: ["橋を目印に戻る"],
    },
    publicPrecisionPolicy: "mesh_or_coarser",
    claimBoundary: ["安全確認済みの公開範囲だけ扱う"],
    sourceReferences: [
      {
        label: "テスト市 散策資料",
        url: "https://example.test/walk-map",
        note: "テスト用の出典",
      },
    ],
    publicationReview: {
      publicAccessAttested: true,
      sourceRightsAttested: true,
      permissionAttestedBy: "テスト市",
      permissionAttestedAt: "2026-06-24",
      publishApprovedByUserId: "admin-user",
      publishApprovedAt: "2026-06-24",
      emergencyHidden: false,
      takedownReason: null,
    },
  };

  const publicMap = buildMunicipalWalkMapPublicReadModelV0(config);
  const stop = publicMap.stops[0];

  assert.equal(stop?.estimatedMinutes, 19);
  assert.deepEqual(stop?.noticeCues, ["水面", "橋の下"]);
  assert.deepEqual(stop?.recordCues, ["鳥の声", "草地"]);
  assert.equal(JSON.stringify(publicMap).includes("管理者だけ"), false);
  assert.equal(publicMap.locationSafety.schemaVersion, "municipal_walk_map_location_safety/v0");
  assert.equal(publicMap.locationSafety.publicPrecisionPolicy, "mesh_or_coarser");
  assert.equal(publicMap.locationSafety.publicExactStopLocation, false);
  assert.equal(publicMap.sourceReferences[0]?.label, "テスト市 散策資料");
  assert.equal(validateMunicipalWalkMapConfigV0(config).ok, true);
});

test("municipal walk map location safety policy carries review reasons without exact stop publication", () => {
  const base = getStaticMunicipalWalkMapConfigV0();
  const publicMap = buildMunicipalWalkMapPublicReadModelV0({
    ...base,
    publishMode: "draft",
    publicPrecisionPolicy: "site_or_coarser",
    sourceReferences: [],
    routeFlexibility: {
      ...base.routeFlexibility,
      routeStyle: "free_area",
    },
    routeStops: [
      {
        stopId: "private-edge",
        title: "私有地に近い場所",
        areaKind: "other",
        linkedFieldId: null,
        access: "private_or_restricted",
        estimatedMinutes: 4,
        noticeCues: ["道路から見える植栽"],
        recordCues: ["公開道路からの写真"],
        safetyNotes: ["敷地内へ入らない"],
      },
    ],
  });

  assert.equal(publicMap.locationSafety.publicExactStopLocation, false);
  assert.deepEqual(publicMap.locationSafety.blockedStopIds, ["private-edge"]);
  assert.match(publicMap.locationSafety.reviewRequired.join("\n"), /private_or_restricted_stop:private-edge/);
  assert.match(publicMap.locationSafety.reviewRequired.join("\n"), /site_precision_public_place_review/);
  assert.match(publicMap.locationSafety.reviewRequired.join("\n"), /free_area_safety_review/);
  assert.match(publicMap.locationSafety.reviewRequired.join("\n"), /source_reference_required_before_public/);
});

test("municipal walk map templates cover MECE municipal source patterns", () => {
  const templates = listMunicipalWalkMapTemplatesV0();
  const ids = templates.map((template) => template.templateId);

  assert.deepEqual(ids, [
    "habitat_micro_walk",
    "route_species_walk",
    "stewardship_manners_walk",
    "seasonal_target_walk",
    "citizen_campaign_walk",
    "worksheet_family_walk",
  ]);
  assert.equal(new Set(ids).size, ids.length);
  const citizenCampaignTemplate = templates.find((template) => template.templateId === "citizen_campaign_walk");
  assert.deepEqual(citizenCampaignTemplate?.config.routeFlexibility.mobilityModes, ["walk", "bike", "car", "motorbike", "public_transport"]);
  assert.equal(citizenCampaignTemplate?.config.routeFlexibility.routeStyle, "free_area");
  for (const template of templates) {
    assert.equal(template.schemaVersion, "municipal_walk_map_template/v0");
    assert.ok(template.exampleSources.length >= 2);
    assert.equal(template.config.publishMode, "draft");
    assert.equal(validateMunicipalWalkMapConfigV0({
      ...template.config,
      walkMapId: `test-${template.templateId}`,
      municipality: "テスト市",
      creatorName: "テスト市",
    }).ok, true);
  }
});

test("municipal walk map source catalog covers researched official seed patterns", () => {
  const catalog = listMunicipalWalkMapSourceCatalogV0();
  const municipalities = new Set(catalog.map((entry) => entry.municipality));
  const primaryTypes = new Set(catalog.map((entry) => entry.primaryType));
  const templateIds = new Set(catalog.map((entry) => entry.templateId));

  assert.ok(catalog.length >= 57);
  for (const municipality of [
    "静岡市",
    "大田区",
    "船橋市",
    "浦添市",
    "北区",
    "北区環境ポータル",
    "福岡県",
    "横浜市",
    "朝霞市",
    "岡崎市",
    "小山市",
    "甲賀市",
    "調布市",
    "京都市",
    "秋田市",
    "飯田市",
    "高知市",
    "町田市",
    "世田谷区",
    "豊島区",
    "堺市",
    "半田市",
    "鹿児島市",
    "伊勢崎市",
    "大阪市",
    "札幌市",
    "神戸市",
    "千代田区",
    "多摩市",
    "いわき市",
    "東京都",
    "福岡市",
    "川崎市",
    "さいたま市",
    "横須賀市",
    "足立区",
    "北九州市",
    "名古屋市",
    "草加市",
    "東村山市",
    "戸田市",
    "福井市",
    "大分市",
    "春日部市",
    "大和市",
    "市川市",
    "川口市",
    "荒川区",
    "飯島町",
    "香取市",
    "広島県",
    "千葉市",
  ]) {
    assert.ok(municipalities.has(municipality), `missing source catalog municipality: ${municipality}`);
  }
  assert.deepEqual([...primaryTypes].sort(), [
    "citizen_science_report",
    "species_distribution_map",
    "walk_route_species_map",
    "worksheet_or_field_note",
  ]);
  for (const templateId of [
    "route_species_walk",
    "stewardship_manners_walk",
    "seasonal_target_walk",
    "citizen_campaign_walk",
    "worksheet_family_walk",
    "habitat_micro_walk",
  ]) {
    assert.ok(templateIds.has(templateId), `missing source catalog template: ${templateId}`);
  }

  const routeSources = listMunicipalWalkMapSourceCatalogV0({ templateId: "route_species_walk" });
  assert.ok(routeSources.length >= 4);
  assert.ok(routeSources.every((entry) => entry.templateId === "route_species_walk"));
  const operationalModels = new Set(catalog.map(sourceOperationalModelV0));
  assert.deepEqual([...operationalModels].sort(), [
    "external_app_campaign",
    "fieldwork_worksheet_portal",
    "municipal_submission_map",
    "national_platform_link",
    "official_walk_pdf",
  ]);
  assert.equal(sourceOperationalModelV0(catalog.find((entry) => entry.sourceId === "shizuoka-ikimono-walk-route")!), "official_walk_pdf");
  assert.equal(sourceOperationalModelV0(catalog.find((entry) => entry.sourceId === "ichikawa-living-creature-map")!), "municipal_submission_map");
  assert.equal(sourceOperationalModelV0(catalog.find((entry) => entry.sourceId === "kobe-biome-summer-quest")!), "external_app_campaign");
  assert.equal(sourceOperationalModelV0(catalog.find((entry) => entry.sourceId === "soka-ikimono-log-survey")!), "national_platform_link");
  assert.equal(sourceOperationalModelV0(catalog.find((entry) => entry.sourceId === "koka-field-sheets")!), "fieldwork_worksheet_portal");
  const accessKinds = new Set(catalog.map((entry) => sourceAccessModelV0(entry).downloadKind));
  assert.deepEqual([...accessKinds].sort(), [
    "direct_pdf",
    "html_or_external_form",
    "official_page_with_links",
  ]);
  const directPdf = sourceAccessModelV0(catalog.find((entry) => entry.sourceId === "kitakyushu-yamada-green-walking-course")!);
  assert.equal(directPdf.downloadKind, "direct_pdf");
  assert.equal(directPdf.downloadUrl, "https://www.city.kitakyushu.lg.jp/page/walkingmap/kokurakita/kokurakita40.pdf");
  assert.equal(directPdf.importPolicy, "citation_only_no_body_copy");
  assert.match(directPdf.rightsNote, /転載しない/);
  assert.equal(sourceAccessModelV0(catalog.find((entry) => entry.sourceId === "shizuoka-ikimono-walk-route")!).downloadKind, "official_page_with_links");
  assert.equal(sourceAccessModelV0(catalog.find((entry) => entry.sourceId === "kobe-biome-summer-quest")!).downloadKind, "html_or_external_form");
  assert.equal(sourceAccessModelV0(catalog.find((entry) => entry.sourceId === "ota-ikimono-discovery-map")!).downloadKind, "official_page_with_links");
  assert.equal(sourceOperationalModelV0(catalog.find((entry) => entry.sourceId === "ota-ikimono-discovery-map")!), "official_walk_pdf");
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.funabashi\.lg\.jp\/machi\/kankyou\/010\/p035951\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.ota\.tokyo\.jp\/seikatsu\/sumaimachinami\/kankyou\/hogo\/ikimonomap\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.funabashi\.lg\.jp\/machi\/kankyou\/010\/p082326\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.setagaya\.lg\.jp\/02074\/4717\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.handa\.lg\.jp\/machi\/kankyo\/1002994\/1003007\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.isesaki\.lg\.jp\/soshiki\/kankyobu\/kankyo\/kikaku\/seibututayousei\/21642\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.kagoshima\.lg\.jp\/machizukuri\/kankyohozen\/shizen\/hozonju\/kagoshimanomizube\/index\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.sapporo\.jp\/kankyo\/biodiversity\/chosa\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.kobe\.lg\.jp\/a66324\/kurashi\/recycle\/biodiversity\/biomequest2025\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.chiyoda\.lg\.jp\/koho\/machizukuri\/kankyo\/sebutsutayose\/monitoring2025\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.tama\.lg\.jp\/kurashi\/kankyo\/hozen\/event\/1017494\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.kawasaki\.jp\/300\/page\/0000085873\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.saitama\.lg\.jp\/001\/009\/017\/003\/p006268\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.yokosuka\.kanagawa\.jp\/0880\/kaiganshokubutu\/mijikanasizen\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.yokosuka\.kanagawa\.jp\/5540\/maedagawa\/index\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.adachi\.tokyo\.jp\/documents\/74972\/2025zukann\.pdf/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.kitakyushu\.lg\.jp\/page\/walkingmap\/kokurakita\/kokurakita40\.pdf/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.nagoya\.jp\/kurashi\/kankyou\/1012463\/1034795\/1012526\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.soka\.saitama\.jp\/cont\/s1701\/030\/010\/010\/040\/PAGE000000000000053060\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.higashimurayama\.tokyo\.jp\/shisei\/keikaku\/bunya\/kankyo\/ikimonomap\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.toda\.saitama\.jp\/site\/saiko\/kyo-saiko-publish-kansatumap\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.fukui\.lg\.jp\/kurasi\/kankyo\/study\/pamphlet_1\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.oita\.oita\.jp\/o141\/oita-mijikanasizen-guide\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.kasukabe\.lg\.jp\/material\/files\/group\/31\/tyousainmanyuaru2023\.pdf/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.yamato\.lg\.jp\/material\/files\/group\/26\/5_izuminomori\.pdf/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.ichikawa\.lg\.jp\/page\/2301\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.ichikawa\.lg\.jp\/page\/2303\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.kawaguchi\.lg\.jp\/soshiki\/01100\/021\/ecosystem\/27320\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.arakawa\.tokyo\.jp\/a024\/kankyou\/tayousei\/ikimono_daizukan\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.town\.iijima\.lg\.jp\/soshikiichiran\/juminzeimuka\/kankyoukyouseienerugikakari\/kankyoeisei\/NaturePositive\/5145\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.katori\.lg\.jp\/living\/ahiminkatsudo\/shiminkyodo\/omigawatyuuou\.files\/20230415naturemap\.pdf/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.pref\.hiroshima\.lg\.jp\/site\/tayousei\/investigation-biodiversity-wanted\.html/);
  assert.match(JSON.stringify(catalog), /https:\/\/www\.city\.chiba\.jp\/kankyo\/kankyohozen\/hozen\/r1_ikimonosagashi\.html/);
});

test("municipal walk map source catalog builds a draft config without copying PDF bodies", () => {
  const config = buildMunicipalWalkMapConfigFromSourceCatalogV0("funabashi-nature-walk-maps");
  const validation = validateMunicipalWalkMapConfigV0(config);

  assert.equal(config.walkMapId, "draft-funabashi-nature-walk-maps");
  assert.equal(config.municipality, "船橋市");
  assert.equal(config.creatorName, "船橋市");
  assert.equal(config.publishMode, "draft");
  assert.equal(config.title, "自然散策マップ 下書き");
  assert.match(config.summary, /公式ページを引用元/);
  assert.equal(config.sourceReferences[0]?.label, "自然散策マップ");
  assert.equal(config.sourceReferences[0]?.url, "https://www.city.funabashi.lg.jp/machi/kankyou/010/p035951.html");
  assert.match(config.sourceReferences[0]?.note ?? "", /PDF本文、図版、写真は転載しません/);
  assert.equal(config.publicationReview?.publicAccessAttested, false);
  assert.equal(config.publicationReview?.sourceRightsAttested, false);
  assert.equal(validation.ok, true);
});

test("Shizuoka source catalog draft preserves multiple reviewed stops without copying PDF body", () => {
  const config = buildMunicipalWalkMapConfigFromSourceCatalogV0("shizuoka-ikimono-walk-route");
  const validation = validateMunicipalWalkMapConfigV0(config);
  const publicMap = buildMunicipalWalkMapPublicReadModelV0(config);

  assert.equal(config.walkMapId, "draft-shizuoka-ikimono-walk-route");
  assert.equal(config.municipality, "静岡市");
  assert.equal(config.creatorProfile.creatorId, "municipality:shizuoka-city");
  assert.equal(config.creatorProfile.verificationStatus, "pending");
  assert.equal(config.routeStops.length, 6);
  assert.deepEqual(config.routeFlexibility.mobilityModes, ["walk", "bike", "car", "public_transport"]);
  assert.match(config.routeFlexibility.returnCues.join("\n"), /安全に止まれる公開場所/);
  assert.ok(config.sourceReferences.length >= 4);
  assert.match(JSON.stringify(config.sourceReferences), /s001494\.html/);
  assert.match(JSON.stringify(config.sourceReferences), /yatsuyama-map\.pdf/);
  assert.match(JSON.stringify(config.sourceReferences), /asahata2024-map\.pdf/);
  assert.match(JSON.stringify(config.sourceReferences), /000980916\.pdf/);
  assert.equal(config.publicationReview?.publicAccessAttested, false);
  assert.equal(config.publicationReview?.sourceRightsAttested, false);
  assert.equal(validation.ok, true);
  assert.equal(publicMap.stops.length, 6);
  assert.equal(JSON.stringify(publicMap).includes("内部メモ"), false);
});

test("municipal walk map validation blocks incomplete authoring contracts", () => {
  const config: MunicipalWalkMapConfigV0 = {
    schemaVersion: "municipal_walk_map_config/v0",
    walkMapId: "",
    municipality: "",
    creatorName: "",
    creatorProfile: {
      creatorId: null,
      registrationKind: "unknown",
      verificationStatus: "pending",
      commercialIntent: "none",
    },
    title: "",
    summary: "",
    theme: "city_nature",
    publishMode: "draft",
    areaScope: {
      municipalityCodes: [],
      placeIds: [],
      polygonIds: [],
    },
    routeStops: [],
    recordModes: ["photo"],
    routeFlexibility: {
      routeStyle: "loose_stops",
      mobilityModes: ["walk"],
      offRoutePolicy: "off_route_allowed",
      returnCues: [],
    },
    publicPrecisionPolicy: "site_or_coarser",
    claimBoundary: [],
    sourceReferences: [],
  };

  const validation = validateMunicipalWalkMapConfigV0(config);

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /walk_map_id_required/);
  assert.match(validation.errors.join("\n"), /route_stops_required/);
  assert.match(validation.warnings.join("\n"), /unknown_species_mode_missing/);
  assert.match(validation.warnings.join("\n"), /site_precision_requires_public_place_review/);
});

test("municipal walk map suggested order requires a verified organization", () => {
  const base = getStaticMunicipalWalkMapConfigV0();
  const validation = validateMunicipalWalkMapConfigV0({
    ...base,
    publishMode: "draft",
    creatorProfile: {
      creatorId: null,
      registrationKind: "individual",
      verificationStatus: "self_declared",
      commercialIntent: "none",
    },
    routeFlexibility: {
      ...base.routeFlexibility,
      routeStyle: "suggested_order",
    },
  });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /suggested_order_requires_verified_org/);
});

test("municipal walk map free-area mode stays draft until area safety review exists", () => {
  const base = getStaticMunicipalWalkMapConfigV0();
  const validation = validateMunicipalWalkMapConfigV0({
    ...base,
    publishMode: "public_preview",
    routeFlexibility: {
      ...base.routeFlexibility,
      routeStyle: "free_area",
    },
  });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /free_area_publication_requires_area_safety_review/);
});

test("municipal walk map blocks primarily commercial public maps", () => {
  const base = getStaticMunicipalWalkMapConfigV0();
  const validation = validateMunicipalWalkMapConfigV0({
    ...base,
    publishMode: "public_preview",
    creatorProfile: {
      creatorId: "company:test-tour",
      registrationKind: "registered_company",
      verificationStatus: "verified",
      commercialIntent: "primary",
    },
    routeFlexibility: {
      ...base.routeFlexibility,
      routeStyle: "loose_stops",
    },
  });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /commercial_primary_not_publishable/);
});

test("municipal walk map public modes require a verified registered creator", () => {
  const base = getStaticMunicipalWalkMapConfigV0();
  const validation = validateMunicipalWalkMapConfigV0({
    ...base,
    publishMode: "public",
    creatorName: "未登録団体",
    creatorProfile: {
      creatorId: null,
      registrationKind: "unknown",
      verificationStatus: "pending",
      commercialIntent: "none",
    },
  });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /public_publish_requires_verified_creator/);
});

test("municipal walk map public modes require publication review attestations", () => {
  const base = getStaticMunicipalWalkMapConfigV0();
  const validation = validateMunicipalWalkMapConfigV0({
    ...base,
    publishMode: "public_preview",
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
  });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /public_access_review_required/);
  assert.match(validation.errors.join("\n"), /source_rights_attestation_required/);
  assert.match(validation.errors.join("\n"), /publish_approval_required/);
});

test("municipal walk map emergency hidden maps are not public", () => {
  const base = getStaticMunicipalWalkMapConfigV0();
  const validation = validateMunicipalWalkMapConfigV0({
    ...base,
    publishMode: "public",
    publicationReview: {
      ...(base.publicationReview ?? {
        publicAccessAttested: true,
        sourceRightsAttested: true,
        publishApprovedByUserId: "system:test",
        publishApprovedAt: "2026-06-24",
      }),
      emergencyHidden: true,
      takedownReason: "公開範囲を再確認中",
    },
  });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /emergency_hidden_not_public/);
});

test("municipal walk map public modes require coarse precision", () => {
  const base = getStaticMunicipalWalkMapConfigV0();
  const validation = validateMunicipalWalkMapConfigV0({
    ...base,
    publishMode: "public_preview",
    publicPrecisionPolicy: "site_or_coarser",
  });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /public_precision_requires_mesh_or_coarser/);
});

test("municipal walk map verified creators require a registered creator id", () => {
  const base = getStaticMunicipalWalkMapConfigV0();
  const validation = validateMunicipalWalkMapConfigV0({
    ...base,
    publishMode: "draft",
    creatorProfile: {
      creatorId: null,
      registrationKind: "registered_group",
      verificationStatus: "verified",
      commercialIntent: "none",
    },
    routeFlexibility: {
      ...base.routeFlexibility,
      routeStyle: "loose_stops",
    },
  });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /creator_id_required_for_verified_creator/);
});

test("municipal walk map creator registry validates registered non-primary-commercial creators", () => {
  const validation = validateMunicipalWalkMapCreatorV0({
    schemaVersion: "municipal_walk_map_creator/v0",
    creatorId: "group:local-nature-club",
    displayName: "地域自然観察会",
    registrationKind: "registered_group",
    verificationStatus: "verified",
    commercialIntent: "limited",
    notes: "admin checked",
  });

  assert.equal(validation.ok, true);
});

test("municipal walk map creator registry blocks unregistered and primary-commercial verified creators", () => {
  const validation = validateMunicipalWalkMapCreatorV0({
    schemaVersion: "municipal_walk_map_creator/v0",
    creatorId: "person-1",
    displayName: "個人",
    registrationKind: "individual",
    verificationStatus: "verified",
    commercialIntent: "primary",
    notes: "",
  });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /invalid_creator_id/);
  assert.match(validation.errors.join("\n"), /invalid_registration_kind/);
  assert.match(validation.errors.join("\n"), /commercial_primary_creator_cannot_be_verified/);
});

test("municipal walk map creator registry maps to public creator profile", () => {
  const profile = creatorProfileFromRegistryEntryV0({
    schemaVersion: "municipal_walk_map_creator/v0",
    creatorId: "company:nature-guide",
    displayName: "Nature Guide",
    registrationKind: "registered_company",
    verificationStatus: "verified",
    commercialIntent: "limited",
    notes: "",
  });

  assert.deepEqual(profile, {
    creatorId: "company:nature-guide",
    registrationKind: "registered_company",
    verificationStatus: "verified",
    commercialIntent: "limited",
  });
});

test("municipal walk map write profile is resolved from the creator registry", () => {
  const base = getStaticMunicipalWalkMapConfigV0();
  const resolved = applyRegisteredCreatorProfileForWriteV0(
    {
      ...base,
      publishMode: "public_preview",
      creatorName: "フォーム入力の団体名",
      creatorProfile: {
        creatorId: "group:local-nature-club",
        registrationKind: "registered_company",
        verificationStatus: "verified",
        commercialIntent: "none",
      },
      routeFlexibility: {
        ...base.routeFlexibility,
        routeStyle: "suggested_order",
      },
    },
    {
      schemaVersion: "municipal_walk_map_creator/v0",
      creatorId: "group:local-nature-club",
      displayName: "地域自然観察会",
      registrationKind: "registered_group",
      verificationStatus: "verified",
      commercialIntent: "limited",
      notes: "admin checked",
    },
  );

  assert.equal(resolved.creatorName, "地域自然観察会");
  assert.deepEqual(resolved.creatorProfile, {
    creatorId: "group:local-nature-club",
    registrationKind: "registered_group",
    verificationStatus: "verified",
    commercialIntent: "limited",
  });
  assert.equal(validateMunicipalWalkMapConfigV0(resolved).ok, true);
});

test("municipal walk map write profile rejects missing or unverified creator registry entries", () => {
  const base = {
    ...getStaticMunicipalWalkMapConfigV0(),
    publishMode: "draft" as const,
    creatorProfile: {
      creatorId: "group:local-nature-club",
      registrationKind: "registered_group" as const,
      verificationStatus: "verified" as const,
      commercialIntent: "none" as const,
    },
    routeFlexibility: {
      ...getStaticMunicipalWalkMapConfigV0().routeFlexibility,
      routeStyle: "suggested_order" as const,
    },
  };

  assert.throws(
    () => applyRegisteredCreatorProfileForWriteV0(base, null),
    /registered_creator_not_found/,
  );
  assert.throws(
    () => applyRegisteredCreatorProfileForWriteV0(base, {
      schemaVersion: "municipal_walk_map_creator/v0",
      creatorId: "group:local-nature-club",
      displayName: "地域自然観察会",
      registrationKind: "registered_group",
      verificationStatus: "pending",
      commercialIntent: "none",
      notes: "",
    }),
    /suggested_order_requires_verified_org/,
  );
});

test("municipal walk map DB service round-trips registered creator maps", async () => {
  const db = createMunicipalWalkMapFakeDb();
  const creatorInput: MunicipalWalkMapCreatorRegistryEntryV0 = {
    schemaVersion: "municipal_walk_map_creator/v0",
    creatorId: "group:local-nature-club",
    displayName: "地域自然観察会",
    registrationKind: "registered_group",
    verificationStatus: "verified",
    commercialIntent: "limited",
    notes: "確認済みの地域団体",
  };
  const creator = await upsertMunicipalWalkMapCreatorV0(creatorInput, "admin-user", db.pool);
  const listed = await listMunicipalWalkMapCreatorsV0(db.pool);
  const foundCreator = await getMunicipalWalkMapCreatorV0("group:local-nature-club", db.pool);
  const base = getStaticMunicipalWalkMapConfigV0();
  const prepared = applyRegisteredCreatorProfileForWriteV0(
    {
      ...base,
      walkMapId: "jp-test-registered-creator-walk",
      municipality: "テスト市",
      creatorName: "フォーム入力名",
      publishMode: "public_preview",
      creatorProfile: {
        creatorId: "group:local-nature-club",
        registrationKind: "registered_company",
        verificationStatus: "verified",
        commercialIntent: "none",
      },
      routeFlexibility: {
        ...base.routeFlexibility,
        routeStyle: "suggested_order",
      },
    },
    foundCreator,
  );
  const saved = await upsertMunicipalWalkMapConfigV0(prepared, "admin-user", db.pool);
  const loaded = await getMunicipalWalkMapConfigV0FromDb("jp-test-registered-creator-walk", db.pool);
  const publicMap = buildMunicipalWalkMapPublicReadModelV0(loaded ?? saved);

  assert.equal(creator.creatorId, "group:local-nature-club");
  assert.equal(listed.length, 1);
  assert.equal(prepared.creatorName, "地域自然観察会");
  assert.equal(saved.creatorProfile.registrationKind, "registered_group");
  assert.equal(saved.creatorProfile.commercialIntent, "limited");
  assert.equal(loaded?.routeStops.length, base.routeStops.length);
  assert.equal(publicMap.validation.ok, true);
  assert.match(publicMap.stops[0]?.recordHref ?? "", /context=municipal_walk_map/);
  assert.equal(db.auditRows.length, 1);
});

test("municipal walk map DB public summaries expose only published rows", async () => {
  const db = createMunicipalWalkMapFakeDb();
  const base = getStaticMunicipalWalkMapConfigV0();
  await upsertMunicipalWalkMapConfigV0(
    {
      ...base,
      walkMapId: "db-public-preview-map",
      publishMode: "public_preview",
    },
    "admin-user",
    db.pool,
  );
  await upsertMunicipalWalkMapConfigV0(
    {
      ...base,
      walkMapId: "db-public-map",
      publishMode: "public",
    },
    "admin-user",
    db.pool,
  );

  const summaries = await listPublicMunicipalWalkMapSummariesV0(db.pool);

  assert.deepEqual(summaries.map((summary) => summary.walkMapId), ["db-public-map"]);
  assert.match(db.sqlLog.join("\n"), /WHERE publish_mode = 'public'/);
  assert.doesNotMatch(db.sqlLog.join("\n"), /public_preview'\)/);
});

test("municipal walk map review queue surfaces saved drafts with public readiness blockers", async () => {
  const db = createMunicipalWalkMapFakeDb();
  const base = getStaticMunicipalWalkMapConfigV0("jp-shizuoka-asahata-waterfront-sample-v0");
  await upsertMunicipalWalkMapConfigV0(
    {
      ...base,
      walkMapId: "db-review-draft-map",
      publishMode: "draft",
      creatorProfile: {
        creatorId: "group:pending-walk-team",
        registrationKind: "registered_group",
        verificationStatus: "pending",
        commercialIntent: "none",
      },
      publicationReview: {
        publicAccessAttested: false,
        sourceRightsAttested: true,
        permissionAttestedBy: null,
        permissionAttestedAt: null,
        publishApprovedByUserId: null,
        publishApprovedAt: null,
        emergencyHidden: false,
        takedownReason: null,
      },
    },
    "admin-user",
    db.pool,
  );

  const queue = await listMunicipalWalkMapReviewQueueV0(db.pool);
  const item = queue.find((candidate) => candidate.walkMapId === "db-review-draft-map");

  assert.ok(item);
  assert.equal(item.readyForPublicMode, false);
  assert.equal(item.publishMode, "draft");
  assert.equal(item.stopCount, base.routeStops.length);
  assert.equal(item.sourceReferenceCount, base.sourceReferences.length);
  assert.match(item.reviewRequired.join("\n"), /public_publish_requires_verified_creator/);
  assert.match(item.reviewRequired.join("\n"), /public_access_review_required/);
  assert.match(item.reviewRequired.join("\n"), /publish_approval_required/);
  assert.equal(item.editHref, "/admin/municipal-walk-maps/db-review-draft-map");
});

test("municipal walk map validation warns on heavy public copy without blocking drafts", () => {
  const base = getStaticMunicipalWalkMapConfigV0("jp-shizuoka-asahata-waterfront-sample-v0");
  const validation = validateMunicipalWalkMapConfigV0({
    ...base,
    publishMode: "draft",
    summary: "地域に貢献し、あとで見返せる散策マップです。",
    routeFlexibility: {
      ...base.routeFlexibility,
      returnCues: ["順番通りに歩かなくても大丈夫です"],
    },
    routeStops: [
      {
        ...base.routeStops[0],
        recordCues: ["この場所が少し厚くなる記録"],
        safetyNotes: ["これはここから育つ場所です"],
      },
    ],
  });

  assert.equal(validation.ok, true);
  assert.match(validation.warnings.join("\n"), /copy_lint_heavy_expression:map:review_copy/);
  assert.match(validation.warnings.join("\n"), /copy_lint_heavy_expression:map:contribution_copy/);
  assert.match(validation.warnings.join("\n"), /copy_lint_heavy_expression:map:strict_route_copy/);
  assert.match(validation.warnings.join("\n"), /copy_lint_heavy_expression:stop:asahata-water-edge:thickening_copy/);
  assert.match(validation.warnings.join("\n"), /copy_lint_heavy_expression:stop:asahata-water-edge:growth_place_copy/);
});

test("municipal walk map review action approves ready organization drafts for public preview", async () => {
  const db = createMunicipalWalkMapFakeDb();
  const base = getStaticMunicipalWalkMapConfigV0("jp-shizuoka-asahata-waterfront-sample-v0");
  await upsertMunicipalWalkMapConfigV0(
    {
      ...base,
      walkMapId: "db-review-ready-map",
      publishMode: "draft",
      creatorProfile: {
        creatorId: "municipality:shizuoka",
        registrationKind: "municipality",
        verificationStatus: "verified",
        commercialIntent: "none",
      },
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
    },
    "admin-user",
    db.pool,
  );

  const result = await reviewMunicipalWalkMapPublicationV0(
    "db-review-ready-map",
    { action: "approve_public_preview", reviewedAt: "2026-06-25" },
    "admin-user",
    db.pool,
  );

  assert.equal(result.action, "approve_public_preview");
  assert.equal(result.config.publishMode, "public_preview");
  assert.equal(result.config.publicationReview?.publicAccessAttested, true);
  assert.equal(result.config.publicationReview?.sourceRightsAttested, true);
  assert.equal(result.config.publicationReview?.publishApprovedByUserId, "admin-user");
  assert.equal(result.config.publicationReview?.publishApprovedAt, "2026-06-25");
  assert.equal(result.reviewItem.readyForPublicMode, true);
  assert.equal(result.reviewItem.reviewRequired.length, 0);
});

test("municipal walk map review action refuses public preview approval with unresolved blockers", async () => {
  const db = createMunicipalWalkMapFakeDb();
  const base = getStaticMunicipalWalkMapConfigV0("jp-shizuoka-asahata-waterfront-sample-v0");
  await upsertMunicipalWalkMapConfigV0(
    {
      ...base,
      walkMapId: "db-review-blocked-map",
      publishMode: "draft",
      creatorProfile: {
        creatorId: "group:pending-walk-team",
        registrationKind: "registered_group",
        verificationStatus: "pending",
        commercialIntent: "none",
      },
    },
    "admin-user",
    db.pool,
  );

  await assert.rejects(
    () => reviewMunicipalWalkMapPublicationV0(
      "db-review-blocked-map",
      { action: "approve_public_preview", reviewedAt: "2026-06-25" },
      "admin-user",
      db.pool,
    ),
    /municipal_walk_map_review_not_ready:.*public_publish_requires_verified_creator/,
  );
});
