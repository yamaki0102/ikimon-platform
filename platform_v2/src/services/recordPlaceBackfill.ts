import {
  decideRecordPlaceMembership,
  type MembershipBoundary,
  type MembershipDecision,
} from "./placeDomain.js";

export const RECORD_PLACE_CALCULATION_VERSION = "universal_place_membership/v1" as const;
export const RECORD_THEME_RULE_VERSION = "record_theme_rules/v1" as const;

export const RECORD_THEMES = [
  "nature",
  "scenery",
  "daily_life",
  "facility",
  "activity",
  "history",
  "audio_visual",
  "insight",
  "unclassified",
] as const;

export type RecordTheme = typeof RECORD_THEMES[number];

export type RecordBackfillInput = {
  recordId: string;
  exactLat: number | null;
  exactLng: number | null;
  uncertaintyM: number | null;
  occurrenceCount?: number | null;
  publicVisibility?: string | null;
  note?: string | null;
  mediaKinds?: string[];
  hasTaxonData?: boolean;
  placeMemoryTags?: string[];
  hasEventRelation?: boolean;
  hasRallyRelation?: boolean;
  hasGuideRelation?: boolean;
  hasFacilityRelation?: boolean;
  hasEnvironmentContext?: boolean;
};

export type MembershipBackfillRow = MembershipDecision & {
  membershipId: string;
  recordId: string;
  calculationVersion: string;
  internalPrecision: "exact_point" | "uncertain_point";
  publicPrecision: "place";
};

export type ThemeAssertionBackfillRow = {
  themeAssertionId: string;
  recordId: string;
  theme: RecordTheme;
  assertionSource: "rule";
  confidence: number;
  assertionStatus: "accepted" | "provisional";
  ruleVersion: typeof RECORD_THEME_RULE_VERSION;
  inputProvenance: {
    fieldsUsed: string[];
    exactLocationUsed: false;
  };
};

export type RecordPlaceBackfillReport = {
  version: "record_place_backfill_report/v1";
  calculationVersion: string;
  themeRuleVersion: string;
  dryRun: true;
  inputRows: number;
  uniqueRecords: number;
  sourceOccurrenceCount: number | null;
  recordsWithExactLocation: number;
  recordsWithoutExactLocation: number;
  recordsMatched: number;
  confirmedMemberships: number;
  candidateMemberships: number;
  ambiguousRecords: number;
  skippedReasons: Record<string, number>;
  evaluatedRecordIds: string[];
  memberships: MembershipBackfillRow[];
  themeAssertions: ThemeAssertionBackfillRow[];
  sourceRecordsMutated: false;
};

function stableId(prefix: string, values: string[]): string {
  let hash = 0x811c9dc5;
  const input = values.join("|");
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${prefix}_${hash.toString(16).padStart(8, "0")}`;
}

function pushTheme(
  target: Map<RecordTheme, { confidence: number; fields: string[]; status: "accepted" | "provisional" }>,
  theme: RecordTheme,
  confidence: number,
  fields: string[],
  status: "accepted" | "provisional" = "accepted",
): void {
  const existing = target.get(theme);
  if (!existing || confidence > existing.confidence) {
    target.set(theme, { confidence, fields, status });
  }
}

export function classifyRecordThemes(record: RecordBackfillInput): ThemeAssertionBackfillRow[] {
  const themes = new Map<RecordTheme, { confidence: number; fields: string[]; status: "accepted" | "provisional" }>();
  const note = String(record.note ?? "").normalize("NFKC").toLowerCase();
  const tags = (record.placeMemoryTags ?? []).map((tag) => String(tag).normalize("NFKC").toLowerCase());
  const mediaKinds = (record.mediaKinds ?? []).map((kind) => kind.toLowerCase());

  if (record.hasTaxonData) pushTheme(themes, "nature", 0.98, ["taxon_data"]);
  if (mediaKinds.some((kind) => kind.includes("audio") || kind.includes("video"))) {
    pushTheme(themes, "audio_visual", 0.98, ["media_kind"]);
  }
  if (record.hasEventRelation || record.hasRallyRelation || record.hasGuideRelation) {
    pushTheme(themes, "activity", 0.96, [
      ...(record.hasEventRelation ? ["event_relation"] : []),
      ...(record.hasRallyRelation ? ["rally_relation"] : []),
      ...(record.hasGuideRelation ? ["guide_relation"] : []),
    ]);
  }
  if (record.hasFacilityRelation) pushTheme(themes, "facility", 0.98, ["facility_relation"]);
  if (record.hasEnvironmentContext) pushTheme(themes, "insight", 0.86, ["environment_context"]);

  if (/(景色|風景|夕焼け|朝焼け|紅葉|雪景色|季節|眺め|landscape|scenery)/i.test(note)) {
    pushTheme(themes, "scenery", 0.82, ["note"]);
  }
  if (/(祭|イベント|観察会|ラリー|ワークショップ|活動|散歩|遊ん|event|workshop)/i.test(note)) {
    pushTheme(themes, "activity", 0.8, ["note"]);
  }
  if (/(歴史|由来|昔|遺跡|史跡|伝承|history|heritage)/i.test(note) || tags.some((tag) => /history|歴史|story|物語/.test(tag))) {
    pushTheme(themes, "history", 0.8, tags.length ? ["note", "place_memory_tags"] : ["note"]);
  }
  if (/(建物|施設|トイレ|ベンチ|遊具|駐車場|駅|モール|facility)/i.test(note)) {
    pushTheme(themes, "facility", 0.78, ["note"]);
  }
  if (/(通勤|通学|買い物|日常|暮らし|いつもの|daily|everyday)/i.test(note)) {
    pushTheme(themes, "daily_life", 0.78, ["note"]);
  }
  if (/(気づ|発見|比べ|変化|違い|insight|noticed)/i.test(note)) {
    pushTheme(themes, "insight", 0.78, ["note"]);
  }
  if (themes.size === 0) pushTheme(themes, "unclassified", 1, [], "provisional");

  return [...themes.entries()].map(([theme, evidence]) => ({
    themeAssertionId: stableId("rta", [record.recordId, theme, RECORD_THEME_RULE_VERSION]),
    recordId: record.recordId,
    theme,
    assertionSource: "rule",
    confidence: evidence.confidence,
    assertionStatus: evidence.status,
    ruleVersion: RECORD_THEME_RULE_VERSION,
    inputProvenance: {
      fieldsUsed: [...new Set(evidence.fields)].sort(),
      exactLocationUsed: false,
    },
  }));
}

export function runRecordPlaceBackfill(input: {
  records: RecordBackfillInput[];
  boundaries: MembershipBoundary[];
  calculationVersion?: string;
}): RecordPlaceBackfillReport {
  const calculationVersion = input.calculationVersion ?? RECORD_PLACE_CALCULATION_VERSION;
  const uniqueRecords = new Map<string, RecordBackfillInput>();
  for (const record of input.records) {
    if (!uniqueRecords.has(record.recordId)) uniqueRecords.set(record.recordId, record);
  }
  const memberships: MembershipBackfillRow[] = [];
  const themeAssertions: ThemeAssertionBackfillRow[] = [];
  const evaluatedRecordIds: string[] = [];
  const skippedReasons: Record<string, number> = {};
  let recordsWithExactLocation = 0;
  let recordsMatched = 0;
  let ambiguousRecords = 0;
  const occurrenceCounts = [...uniqueRecords.values()]
    .map((record) => Number(record.occurrenceCount))
    .filter((count) => Number.isInteger(count) && count >= 0);

  for (const record of uniqueRecords.values()) {
    themeAssertions.push(...classifyRecordThemes(record));
    const lat = record.exactLat;
    const lng = record.exactLng;
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      skippedReasons.missing_or_invalid_exact_location = (skippedReasons.missing_or_invalid_exact_location ?? 0) + 1;
      continue;
    }
    recordsWithExactLocation += 1;
    evaluatedRecordIds.push(record.recordId);
    const decisions = decideRecordPlaceMembership({
      point: { lat, lng },
      uncertaintyM: record.uncertaintyM,
      boundaries: input.boundaries,
    }).filter((decision) => decision.state !== "outside");
    if (decisions.length === 0) {
      skippedReasons.outside_all_boundaries = (skippedReasons.outside_all_boundaries ?? 0) + 1;
      continue;
    }
    recordsMatched += 1;
    if (decisions.some((decision) => decision.state === "candidate")) ambiguousRecords += 1;
    for (const decision of decisions) {
      memberships.push({
        ...decision,
        membershipId: stableId("rpm", [record.recordId, decision.placeId, calculationVersion]),
        recordId: record.recordId,
        calculationVersion,
        internalPrecision: Number(record.uncertaintyM) > 0 ? "uncertain_point" : "exact_point",
        publicPrecision: "place",
      });
    }
  }

  return {
    version: "record_place_backfill_report/v1",
    calculationVersion,
    themeRuleVersion: RECORD_THEME_RULE_VERSION,
    dryRun: true,
    inputRows: input.records.length,
    uniqueRecords: uniqueRecords.size,
    sourceOccurrenceCount: occurrenceCounts.length > 0
      ? occurrenceCounts.reduce((sum, count) => sum + count, 0)
      : null,
    recordsWithExactLocation,
    recordsWithoutExactLocation: uniqueRecords.size - recordsWithExactLocation,
    recordsMatched,
    confirmedMemberships: memberships.filter((row) => row.state === "confirmed").length,
    candidateMemberships: memberships.filter((row) => row.state === "candidate").length,
    ambiguousRecords,
    skippedReasons,
    evaluatedRecordIds,
    memberships,
    themeAssertions,
    sourceRecordsMutated: false,
  };
}

function sqlText(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function buildD1RecordPlaceBackfillSql(report: RecordPlaceBackfillReport): string {
  const statements: string[] = [];
  for (const recordId of report.evaluatedRecordIds) {
    statements.push(
      `UPDATE record_place_memberships
          SET is_primary = 0,
              removed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE record_id = ${sqlText(recordId)}
          AND calculation_version = ${sqlText(report.calculationVersion)}
          AND reviewed_state = 'unreviewed'
      AND removed_at IS NULL;`,
    );
  }
  for (const row of report.memberships) {
    statements.push(
      `INSERT INTO record_place_memberships (
        membership_id, record_id, place_id, membership_type, membership_state,
        derivation_source, derivation_details_json, confidence, internal_precision,
        public_precision, is_primary, reviewed_state, calculation_version, updated_at
      ) VALUES (
        ${sqlText(row.membershipId)}, ${sqlText(row.recordId)}, ${sqlText(row.placeId)},
        ${sqlText(row.membershipType)}, ${sqlText(row.state)}, 'polygon_calculation',
        ${sqlText(JSON.stringify({ reason: row.reason }))}, ${row.confidence},
        ${sqlText(row.internalPrecision)}, 'place', ${row.primary ? 1 : 0}, 'unreviewed',
        ${sqlText(row.calculationVersion)}, CURRENT_TIMESTAMP
      )
      ON CONFLICT(record_id, place_id, calculation_version) DO UPDATE SET
        membership_type = excluded.membership_type,
        membership_state = excluded.membership_state,
        derivation_details_json = excluded.derivation_details_json,
        confidence = excluded.confidence,
        internal_precision = excluded.internal_precision,
        public_precision = 'place',
        is_primary = excluded.is_primary,
        removed_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE record_place_memberships.reviewed_state = 'unreviewed';`,
    );
  }
  for (const row of report.themeAssertions) {
    statements.push(
      `INSERT INTO record_theme_assertions (
        theme_assertion_id, record_id, theme, assertion_source, confidence,
        assertion_status, rule_version, input_provenance_json, updated_at
      ) VALUES (
        ${sqlText(row.themeAssertionId)}, ${sqlText(row.recordId)}, ${sqlText(row.theme)},
        'rule', ${row.confidence}, ${sqlText(row.assertionStatus)}, ${sqlText(row.ruleVersion)},
        ${sqlText(JSON.stringify(row.inputProvenance))}, CURRENT_TIMESTAMP
      )
      ON CONFLICT(record_id, theme, assertion_source, rule_version) DO UPDATE SET
        confidence = excluded.confidence,
        assertion_status = excluded.assertion_status,
        input_provenance_json = excluded.input_provenance_json,
        updated_at = CURRENT_TIMESTAMP;`,
    );
  }
  return statements.join("\n");
}
