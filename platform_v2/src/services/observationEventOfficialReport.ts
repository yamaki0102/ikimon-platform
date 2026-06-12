import { getPool } from "../db.js";
import { getSessionById, type ObservationEventSessionRow } from "./observationEventModeManager.js";

export interface OfficialEventSourceRow extends Record<string, unknown> {
  live_event_id: string;
  type: string;
  scope: string;
  team_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface OfficialSpeciesRecord {
  liveEventId: string;
  observedAt: string;
  teamId: string | null;
  taxonName: string;
  recordKind: "observation_added";
  matchSource: "explicit_session_event";
  evidenceRef: string | null;
}

export interface ObservationEventOfficialReport {
  schemaVersion: "observation_event_official_report/v1";
  session: ObservationEventSessionRow;
  generatedAt: string;
  claimBoundary: {
    canSay: string[];
    cannotSay: string[];
  };
  privacyBoundary: {
    exactCoordinatesIncluded: false;
    sensitiveSpeciesRequiresOrganizerReview: true;
  };
  stats: {
    officialObservationCount: number;
    uniqueTaxaCount: number;
    guideSceneCount: number;
    fieldScanCount: number;
  };
  topTaxa: Array<{ taxonName: string; count: number }>;
  speciesRecords: OfficialSpeciesRecord[];
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function firstString(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asNonEmptyString(payload[key]);
    if (value) return value;
  }
  return null;
}

export function isObservationEventSessionId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function speciesRecordsFromOfficialEvents(rows: OfficialEventSourceRow[]): OfficialSpeciesRecord[] {
  return rows
    .filter((row) => row.type === "observation_added")
    .map((row) => {
      const payload = row.payload ?? {};
      const taxonName = firstString(payload, ["taxon_name", "taxonName", "scientific_name", "vernacular_name"]);
      if (!taxonName) return null;
      return {
        liveEventId: row.live_event_id,
        observedAt: row.created_at,
        teamId: row.team_id,
        taxonName,
        recordKind: "observation_added" as const,
        matchSource: "explicit_session_event" as const,
        evidenceRef: firstString(payload, ["observation_id", "visit_id", "occurrence_id", "asset_id"]),
      };
    })
    .filter((row): row is OfficialSpeciesRecord => row !== null);
}

export function summarizeOfficialSpecies(records: OfficialSpeciesRecord[]): Array<{ taxonName: string; count: number }> {
  const counts = new Map<string, number>();
  for (const record of records) {
    counts.set(record.taxonName, (counts.get(record.taxonName) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([taxonName, count]) => ({ taxonName, count }))
    .sort((a, b) => b.count - a.count || a.taxonName.localeCompare(b.taxonName, "ja"))
    .slice(0, 30);
}

export function canAccessOfficialEventOutputs(
  session: ObservationEventSessionRow,
  viewerUserId: string | null,
): boolean {
  return session.plan === "public" || (viewerUserId !== null && viewerUserId === session.organizerUserId);
}

export async function buildOfficialEventReport(sessionId: string): Promise<ObservationEventOfficialReport | null> {
  if (!isObservationEventSessionId(sessionId)) return null;
  const session = await getSessionById(sessionId);
  if (!session) return null;

  const result = await getPool().query<OfficialEventSourceRow>(
    `SELECT live_event_id, type, scope, team_id, payload, created_at::text AS created_at
     FROM observation_event_live_events
     WHERE session_id = $1
       AND type IN ('observation_added', 'guide_scene_added', 'field_scan_added')
     ORDER BY created_at ASC`,
    [sessionId],
  );

  const rows = result.rows;
  const speciesRecords = speciesRecordsFromOfficialEvents(rows);
  const guideSceneCount = rows.filter((row) => row.type === "guide_scene_added").length;
  const fieldScanCount = rows.filter((row) => row.type === "field_scan_added").length;
  const topTaxa = summarizeOfficialSpecies(speciesRecords);

  return {
    schemaVersion: "observation_event_official_report/v1",
    session,
    generatedAt: new Date().toISOString(),
    claimBoundary: {
      canSay: [
        "この観察会セッションに明示的に紐づいた記録の集計",
        "観察会中に記録された種名候補と件数",
        "公式提出前の確認用リスト",
      ],
      cannotSay: [
        "半径内に存在しただけの第三者記録を観察会成果として扱うこと",
        "AI候補だけで種同定が確定したと表現すること",
        "希少種や配慮対象種の正確な位置を未確認のまま公開すること",
      ],
    },
    privacyBoundary: {
      exactCoordinatesIncluded: false,
      sensitiveSpeciesRequiresOrganizerReview: true,
    },
    stats: {
      officialObservationCount: speciesRecords.length,
      uniqueTaxaCount: topTaxa.length,
      guideSceneCount,
      fieldScanCount,
    },
    topTaxa,
    speciesRecords,
  };
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function officialSpeciesCsv(report: ObservationEventOfficialReport): string {
  const header = [
    "observed_at",
    "taxon_name",
    "team_id",
    "record_kind",
    "match_source",
    "evidence_ref",
  ];
  const rows = report.speciesRecords.map((record) => [
    record.observedAt,
    record.taxonName,
    record.teamId ?? "",
    record.recordKind,
    record.matchSource,
    record.evidenceRef ?? "",
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}
