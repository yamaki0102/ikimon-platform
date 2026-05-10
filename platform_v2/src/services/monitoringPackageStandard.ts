export type MonitoringPillar =
  | "priority_indicators"
  | "protocol_harmonisation"
  | "new_technology_and_citizen_science"
  | "data_use"
  | "governance"
  | "pilot_learning";

export type MonitoringPackageId =
  | "casual_observation"
  | "guided_survey"
  | "fixed_point_scan"
  | "route_transect"
  | "waterbody_survey"
  | "passive_audio_station"
  | "camera_trap_station"
  | "ias_route_camera"
  | "edna_reference"
  | "forest_habitat_snapshot"
  | "insect_monitoring";

export type MonitoringPackageBlueprint = {
  packageId: MonitoringPackageId;
  label: string;
  description: string;
  observationMethods: string[];
  targetScopes: string[];
  requiredBasis: Array<"site" | "time" | "method" | "effort" | "quality" | "review" | "rights" | "external_taxon_id">;
  primaryOutput: "public_learning" | "monthly_site_evidence" | "indicator_candidate" | "research_export_candidate";
  claimLimit: string;
  pillars: MonitoringPillar[];
};

export type MonitoringPackageSelection = {
  packageId: MonitoringPackageId;
  label: string;
  primaryOutput: MonitoringPackageBlueprint["primaryOutput"];
  claimLimit: string;
  pillars: MonitoringPillar[];
  readiness: {
    ready: boolean;
    present: string[];
    missing: string[];
  };
};

export const MONITORING_PILLARS: Record<MonitoringPillar, string> = {
  priority_indicators: "優先テーマと指標",
  protocol_harmonisation: "プロトコル・方法・データ標準の調和",
  new_technology_and_citizen_science: "新技術と市民科学",
  data_use: "データ利用",
  governance: "ガバナンス",
  pilot_learning: "パイロット",
};

export const MONITORING_PACKAGE_BLUEPRINTS: MonitoringPackageBlueprint[] = [
  {
    packageId: "casual_observation",
    label: "Casual observation",
    description: "日常投稿。学習と公開フィード向けで、trendや外部exportの根拠にはしない。",
    observationMethods: ["casual_photo", "image_post", "video_post"],
    targetScopes: ["any_visible_taxon"],
    requiredBasis: ["site", "time", "method", "quality"],
    primaryOutput: "public_learning",
    claimLimit: "presence_or_learning_only",
    pillars: ["new_technology_and_citizen_science"],
  },
  {
    packageId: "guided_survey",
    label: "Guided survey",
    description: "人が調査努力量と対象範囲を持って歩く観察。月次レポートとindicator候補の入口。",
    observationMethods: ["guided_survey", "survey"],
    targetScopes: ["birds", "plants", "insects", "all_visible_taxa"],
    requiredBasis: ["site", "time", "method", "effort", "quality", "review"],
    primaryOutput: "indicator_candidate",
    claimLimit: "repeatable_survey_context_required_for_trend",
    pillars: ["protocol_harmonisation", "new_technology_and_citizen_science", "data_use"],
  },
  {
    packageId: "fixed_point_scan",
    label: "Fixed point scan",
    description: "同じ地点・同じ向きで繰り返す定点観察。比較可能性を優先する。",
    observationMethods: ["field_scan", "fixed_point"],
    targetScopes: ["habitat_condition", "plants", "pollinators", "landscape_context"],
    requiredBasis: ["site", "time", "method", "effort", "quality", "review"],
    primaryOutput: "indicator_candidate",
    claimLimit: "fixed_point_indicator_candidate",
    pillars: ["priority_indicators", "protocol_harmonisation", "data_use"],
  },
  {
    packageId: "route_transect",
    label: "Route transect",
    description: "同じ経路を繰り返す調査。IAS route camera や巡回調査と相性が良い。",
    observationMethods: ["field_scan", "route", "guide_vehicle_transect_v1", "guide_walk_effort_v1"],
    targetScopes: ["ias", "roadside_plants", "birds", "insects"],
    requiredBasis: ["site", "time", "method", "effort", "quality", "review"],
    primaryOutput: "indicator_candidate",
    claimLimit: "route_indicator_candidate",
    pillars: ["protocol_harmonisation", "new_technology_and_citizen_science", "pilot_learning"],
  },
  {
    packageId: "waterbody_survey",
    label: "Waterbody survey",
    description: "池・河川・湿地の観察。捕獲・非捕獲・観察のみを occurrence absence と混ぜずに扱う。",
    observationMethods: ["water_capture", "waterbody_survey"],
    targetScopes: ["fish", "amphibians", "macroinvertebrates", "aquatic_plants", "bats"],
    requiredBasis: ["site", "time", "method", "effort", "quality", "review", "rights"],
    primaryOutput: "monthly_site_evidence",
    claimLimit: "waterbody_monitoring_context_required",
    pillars: ["priority_indicators", "protocol_harmonisation", "pilot_learning"],
  },
  {
    packageId: "passive_audio_station",
    label: "Passive audio station",
    description: "BirdNET/TinyML等の音声機械観測。AI候補、reviewer検証済み、活動指標を分ける。",
    observationMethods: ["passive_audio", "passive_audio_ingest"],
    targetScopes: ["birds", "bats", "nocturnal_insects"],
    requiredBasis: ["site", "time", "method", "effort", "quality", "review", "rights"],
    primaryOutput: "monthly_site_evidence",
    claimLimit: "machine_observation_requires_human_review_for_species_claim",
    pillars: ["new_technology_and_citizen_science", "protocol_harmonisation", "data_use", "governance"],
  },
  {
    packageId: "camera_trap_station",
    label: "Camera trap station",
    description: "固定カメラの機械観測。device deployment、稼働状態、privacy処理を監査対象にする。",
    observationMethods: ["camera_trap"],
    targetScopes: ["mammals", "birds", "insects"],
    requiredBasis: ["site", "time", "method", "effort", "quality", "review", "rights"],
    primaryOutput: "monthly_site_evidence",
    claimLimit: "machine_observation_requires_human_review_for_species_claim",
    pillars: ["new_technology_and_citizen_science", "governance", "data_use"],
  },
  {
    packageId: "ias_route_camera",
    label: "IAS route camera",
    description: "外来種の道路・巡回撮影。位置一般化、AI不確実性、外部ID連携を必須に近づける。",
    observationMethods: ["ias_route_camera"],
    targetScopes: ["invasive_plants", "invasive_insects"],
    requiredBasis: ["site", "time", "method", "effort", "quality", "review", "rights", "external_taxon_id"],
    primaryOutput: "research_export_candidate",
    claimLimit: "ias_claim_requires_scoped_review_and_external_taxon_id",
    pillars: ["priority_indicators", "new_technology_and_citizen_science", "data_use", "governance", "pilot_learning"],
  },
  {
    packageId: "edna_reference",
    label: "eDNA reference",
    description: "eDNA等の外部検査・参照証拠。ikimon内ではsample metadataとtaxonomic resolutionを保持する。",
    observationMethods: ["edna_reference"],
    targetScopes: ["waterbody", "soil", "multi_taxa"],
    requiredBasis: ["site", "time", "method", "quality", "review", "rights", "external_taxon_id"],
    primaryOutput: "research_export_candidate",
    claimLimit: "reference_result_requires_lab_metadata_and_review",
    pillars: ["new_technology_and_citizen_science", "data_use", "protocol_harmonisation"],
  },
  {
    packageId: "forest_habitat_snapshot",
    label: "Forest habitat snapshot",
    description: "森林状態の写真・定点・リモセン参照の受け皿。wall-to-wall評価は外部処理と分ける。",
    observationMethods: ["field_scan", "forest_habitat_snapshot"],
    targetScopes: ["forest_structure", "understory", "canopy_condition", "habitat_condition"],
    requiredBasis: ["site", "time", "method", "quality", "review"],
    primaryOutput: "monthly_site_evidence",
    claimLimit: "habitat_condition_snapshot_not_wall_to_wall_remote_sensing",
    pillars: ["priority_indicators", "protocol_harmonisation", "pilot_learning"],
  },
  {
    packageId: "insect_monitoring",
    label: "Insect monitoring",
    description: "昆虫の写真・トラップ・metabarcodingを同じ分類群としてではなく、方法別に束ねる。",
    observationMethods: ["field_scan", "camera_trap", "edna_reference", "insect_monitoring"],
    targetScopes: ["pollinators", "moths", "flying_insects", "metabarcoding"],
    requiredBasis: ["site", "time", "method", "effort", "quality", "review", "external_taxon_id"],
    primaryOutput: "indicator_candidate",
    claimLimit: "insect_indicator_requires_method_specific_review",
    pillars: ["priority_indicators", "new_technology_and_citizen_science", "pilot_learning"],
  },
];

const BLUEPRINT_BY_ID = new Map(MONITORING_PACKAGE_BLUEPRINTS.map((blueprint) => [blueprint.packageId, blueprint]));

export function getMonitoringPackageBlueprint(packageId: MonitoringPackageId): MonitoringPackageBlueprint {
  const blueprint = BLUEPRINT_BY_ID.get(packageId);
  if (!blueprint) throw new Error(`unknown_monitoring_package:${packageId}`);
  return blueprint;
}

export function inferMonitoringPackageId(input: {
  actionMode?: string | null;
  observationMethod?: string | null;
  fieldScanMode?: string | null;
  captureOutcome?: string | null;
  targetTaxaScope?: string | null;
  visitMode?: string | null;
}): MonitoringPackageId {
  const values = [
    input.actionMode,
    input.observationMethod,
    input.fieldScanMode,
    input.captureOutcome ? "water_capture" : null,
    input.targetTaxaScope,
    input.visitMode,
  ].map((value) => String(value ?? "").toLowerCase());
  const has = (needle: string) => values.some((value) => value.includes(needle));

  if (has("edna")) return "edna_reference";
  if (has("ias")) return "ias_route_camera";
  if (has("passive_audio")) return "passive_audio_station";
  if (has("camera_trap")) return "camera_trap_station";
  if (input.captureOutcome || has("pond") || has("water") || has("fish") || has("amphibian")) return "waterbody_survey";
  if (has("forest")) return "forest_habitat_snapshot";
  if (has("insect") || has("pollinator") || has("moth")) return "insect_monitoring";
  if (has("route") || has("transect")) return "route_transect";
  if (has("fixed_point")) return "fixed_point_scan";
  if (has("field_scan")) return "fixed_point_scan";
  if (has("guided_survey") || has("survey")) return "guided_survey";
  return "casual_observation";
}

export function selectMonitoringPackage(input: {
  actionMode?: string | null;
  observationMethod?: string | null;
  fieldScanMode?: string | null;
  captureOutcome?: string | null;
  targetTaxaScope?: string | null;
  visitMode?: string | null;
  hasSite?: boolean;
  hasTime?: boolean;
  hasMethod?: boolean;
  hasEffort?: boolean;
  hasQualityEvidence?: boolean;
  hasReview?: boolean;
  hasRights?: boolean;
  hasExternalTaxonId?: boolean;
}): MonitoringPackageSelection {
  const blueprint = getMonitoringPackageBlueprint(inferMonitoringPackageId(input));
  const basisState: Record<MonitoringPackageBlueprint["requiredBasis"][number], boolean> = {
    site: Boolean(input.hasSite),
    time: input.hasTime !== false,
    method: Boolean(input.hasMethod || input.observationMethod || input.actionMode || input.visitMode),
    effort: Boolean(input.hasEffort),
    quality: Boolean(input.hasQualityEvidence),
    review: Boolean(input.hasReview),
    rights: Boolean(input.hasRights),
    external_taxon_id: Boolean(input.hasExternalTaxonId),
  };
  const present = blueprint.requiredBasis.filter((basis) => basisState[basis]);
  const missing = blueprint.requiredBasis.filter((basis) => !basisState[basis]);
  return {
    packageId: blueprint.packageId,
    label: blueprint.label,
    primaryOutput: blueprint.primaryOutput,
    claimLimit: blueprint.claimLimit,
    pillars: blueprint.pillars,
    readiness: {
      ready: missing.length === 0,
      present,
      missing,
    },
  };
}
