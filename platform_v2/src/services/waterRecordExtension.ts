import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { getPool } from "../db.js";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export type WaterbodyType =
  | "unspecified"
  | "basin"
  | "watershed"
  | "river"
  | "river_segment"
  | "lake"
  | "pond"
  | "wetland"
  | "estuary"
  | "coast"
  | "port"
  | "harbor"
  | "artificial_canal";

export type Waterbody = {
  ikimonWaterbodyId: string;
  waterbodyType: WaterbodyType;
  parentWaterbodyId: string | null;
  publicLabel: string;
  source: string;
  sourceVersion: string;
  geometryPrecision: "label_only" | "municipality" | "mesh" | "segment" | "polygon" | "exact_private";
  sourcePayload: Record<string, unknown>;
};

export type CatchOutcome = "caught" | "released" | "kept" | "lost" | "no_catch" | "observed_only";

export type WaterRecordExtension = {
  visitId: string;
  occurrenceId: string | null;
  waterbodyId: string | null;
  waterbody: Waterbody | null;
  catchOutcome: CatchOutcome;
  captureMethod: string | null;
  participantCount: number | null;
  effortMinutes: number | null;
  targetTaxaScope: string | null;
  releasedCount: number | null;
  keptCount: number | null;
  publicWaterbodyLabel: string | null;
  environmentSnapshot: Record<string, unknown>;
  sourcePayload: Record<string, unknown>;
};

export type WaterRecordExtensionInput = Partial<Omit<WaterRecordExtension, "visitId" | "occurrenceId" | "waterbody" | "waterbodyId">> & {
  visitId?: string;
  occurrenceId?: string | null;
  waterbodyId?: string | null;
  waterbodyType?: WaterbodyType | null;
  parentWaterbodyId?: string | null;
  source?: string | null;
  sourceVersion?: string | null;
  geometryPrecision?: Waterbody["geometryPrecision"] | null;
};

const CATCH_OUTCOMES: CatchOutcome[] = ["caught", "released", "kept", "lost", "no_catch", "observed_only"];
const WATERBODY_TYPES: WaterbodyType[] = ["unspecified", "basin", "watershed", "river", "river_segment", "lake", "pond", "wetland", "estuary", "coast", "port", "harbor", "artificial_canal"];
const GEOMETRY_PRECISIONS: Waterbody["geometryPrecision"][] = ["label_only", "municipality", "mesh", "segment", "polygon", "exact_private"];

function normalizeText(value: unknown, maxLength = 240): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function optionalPositiveInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function optionalPositiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

function optionalOneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return allowed.includes(value as T) ? value as T : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function waterbodyIdFor(label: string, type: WaterbodyType, source: string): string {
  const hash = createHash("sha1")
    .update(`${source}|${type}|${label.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 16);
  return `ikimon_waterbody_${hash}`;
}

export function normalizeWaterRecordExtension(
  input: WaterRecordExtensionInput & { visitId: string; occurrenceId?: string | null },
): Omit<WaterRecordExtension, "waterbody"> {
  const catchOutcome = optionalOneOf(input.catchOutcome, CATCH_OUTCOMES);
  if (!catchOutcome) {
    throw new Error("water_catch_outcome_required");
  }
  const publicWaterbodyLabel = normalizeText(input.publicWaterbodyLabel);
  const source = normalizeText(input.source, 80) ?? "ikimon";
  const waterbodyType = oneOf(input.waterbodyType, WATERBODY_TYPES, "unspecified");
  const waterbodyId = normalizeText(input.waterbodyId, 120)
    ?? (publicWaterbodyLabel ? waterbodyIdFor(publicWaterbodyLabel, waterbodyType, source) : null);

  return {
    visitId: input.visitId,
    occurrenceId: normalizeText(input.occurrenceId, 120),
    waterbodyId,
    catchOutcome,
    captureMethod: normalizeText(input.captureMethod, 120),
    participantCount: optionalPositiveInt(input.participantCount),
    effortMinutes: optionalPositiveNumber(input.effortMinutes),
    targetTaxaScope: normalizeText(input.targetTaxaScope, 240),
    releasedCount: optionalPositiveInt(input.releasedCount),
    keptCount: optionalPositiveInt(input.keptCount),
    publicWaterbodyLabel,
    environmentSnapshot: asRecord(input.environmentSnapshot),
    sourcePayload: asRecord(input.sourcePayload),
  };
}

export async function upsertWaterRecordExtension(
  input: WaterRecordExtensionInput & { visitId: string; occurrenceId?: string | null },
  queryable: Queryable = getPool(),
): Promise<WaterRecordExtension> {
  const record = normalizeWaterRecordExtension(input);
  const publicLabel = record.publicWaterbodyLabel;
  const waterbodyType = oneOf(input.waterbodyType, WATERBODY_TYPES, "unspecified");
  const geometryPrecision = oneOf(input.geometryPrecision, GEOMETRY_PRECISIONS, "label_only");
  const source = normalizeText(input.source, 80) ?? "ikimon";
  const sourceVersion = normalizeText(input.sourceVersion, 80) ?? "v0";
  const parentWaterbodyId = normalizeText(input.parentWaterbodyId, 120);

  if (record.waterbodyId && publicLabel) {
    await queryable.query(
      `insert into waterbodies (
         ikimon_waterbody_id, waterbody_type, parent_waterbody_id, public_label,
         source, source_version, geometry_precision, source_payload, updated_at
       ) values (
         $1, $2, $3, $4,
         $5, $6, $7, $8::jsonb, now()
       )
       on conflict (ikimon_waterbody_id) do update set
         waterbody_type = excluded.waterbody_type,
         parent_waterbody_id = excluded.parent_waterbody_id,
         public_label = excluded.public_label,
         source = excluded.source,
         source_version = excluded.source_version,
         geometry_precision = excluded.geometry_precision,
         source_payload = waterbodies.source_payload || excluded.source_payload,
         updated_at = now()`,
      [
        record.waterbodyId,
        waterbodyType,
        parentWaterbodyId,
        publicLabel,
        source,
        sourceVersion,
        geometryPrecision,
        JSON.stringify({
          ...(input.sourcePayload ?? {}),
          origin: "water_record_extension",
        }),
      ],
    );
  }

  await queryable.query(
    `insert into water_record_extensions (
       visit_id, occurrence_id, waterbody_id, catch_outcome, capture_method,
       participant_count, effort_minutes, target_taxa_scope, released_count, kept_count,
       public_waterbody_label, environment_snapshot, source_payload, updated_at
     ) values (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9, $10,
       $11, $12::jsonb, $13::jsonb, now()
     )
     on conflict (visit_id) do update set
       occurrence_id = excluded.occurrence_id,
       waterbody_id = excluded.waterbody_id,
       catch_outcome = excluded.catch_outcome,
       capture_method = excluded.capture_method,
       participant_count = excluded.participant_count,
       effort_minutes = excluded.effort_minutes,
       target_taxa_scope = excluded.target_taxa_scope,
       released_count = excluded.released_count,
       kept_count = excluded.kept_count,
       public_waterbody_label = excluded.public_waterbody_label,
       environment_snapshot = excluded.environment_snapshot,
       source_payload = excluded.source_payload,
       updated_at = now()`,
    [
      record.visitId,
      record.occurrenceId,
      record.waterbodyId,
      record.catchOutcome,
      record.captureMethod,
      record.participantCount,
      record.effortMinutes,
      record.targetTaxaScope,
      record.releasedCount,
      record.keptCount,
      record.publicWaterbodyLabel,
      JSON.stringify(record.environmentSnapshot),
      JSON.stringify(record.sourcePayload),
    ],
  );
  return { ...record, waterbody: null };
}

export async function getWaterRecordExtension(
  visitId: string,
  queryable: Queryable = getPool(),
): Promise<WaterRecordExtension | null> {
  const result = await queryable.query<{
    visit_id: string;
    occurrence_id: string | null;
    waterbody_id: string | null;
    catch_outcome: CatchOutcome;
    capture_method: string | null;
    participant_count: string | number | null;
    effort_minutes: string | number | null;
    target_taxa_scope: string | null;
    released_count: string | number | null;
    kept_count: string | number | null;
    public_waterbody_label: string | null;
    environment_snapshot: Record<string, unknown> | null;
    source_payload: Record<string, unknown> | null;
    waterbody_type: WaterbodyType | null;
    parent_waterbody_id: string | null;
    public_label: string | null;
    source: string | null;
    source_version: string | null;
    geometry_precision: Waterbody["geometryPrecision"] | null;
    waterbody_source_payload: Record<string, unknown> | null;
  }>(
    `select wre.visit_id,
            wre.occurrence_id,
            wre.waterbody_id,
            wre.catch_outcome,
            wre.capture_method,
            wre.participant_count,
            wre.effort_minutes::text as effort_minutes,
            wre.target_taxa_scope,
            wre.released_count,
            wre.kept_count,
            wre.public_waterbody_label,
            wre.environment_snapshot,
            wre.source_payload,
            wb.waterbody_type,
            wb.parent_waterbody_id,
            wb.public_label,
            wb.source,
            wb.source_version,
            wb.geometry_precision,
            wb.source_payload as waterbody_source_payload
       from water_record_extensions wre
       left join waterbodies wb on wb.ikimon_waterbody_id = wre.waterbody_id
      where wre.visit_id = $1
      limit 1`,
    [visitId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    visitId: row.visit_id,
    occurrenceId: row.occurrence_id,
    waterbodyId: row.waterbody_id,
    catchOutcome: row.catch_outcome,
    captureMethod: row.capture_method,
    participantCount: optionalPositiveInt(row.participant_count),
    effortMinutes: optionalPositiveNumber(row.effort_minutes),
    targetTaxaScope: row.target_taxa_scope,
    releasedCount: optionalPositiveInt(row.released_count),
    keptCount: optionalPositiveInt(row.kept_count),
    publicWaterbodyLabel: row.public_waterbody_label,
    environmentSnapshot: row.environment_snapshot ?? {},
    sourcePayload: row.source_payload ?? {},
    waterbody: row.waterbody_id && row.public_label
      ? {
          ikimonWaterbodyId: row.waterbody_id,
          waterbodyType: row.waterbody_type ?? "unspecified",
          parentWaterbodyId: row.parent_waterbody_id,
          publicLabel: row.public_label,
          source: row.source ?? "ikimon",
          sourceVersion: row.source_version ?? "v0",
          geometryPrecision: row.geometry_precision ?? "label_only",
          sourcePayload: row.waterbody_source_payload ?? {},
        }
      : null,
  };
}
