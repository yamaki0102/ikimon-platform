import type { PoolClient, QueryResultRow } from "pg";
import { getPool } from "../db.js";
import { MAP_GUIDE_SPOTS, type MapGuideSpot } from "./mapGuideSpots.js";

export type GuideProgramOwnerType = "owner" | "community" | "municipality" | "school";
export type GuideProgramParticipationMode = "any_order" | "ordered";
export type GuideProgramStatus = "draft" | "published" | "paused" | "closed";

export type GuideProgramEditorInput = {
  programId?: unknown;
  slug?: unknown;
  title?: unknown;
  ownerType?: unknown;
  participationMode?: unknown;
  status?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  publicSummary?: unknown;
  guideSpotIds?: unknown;
};

export type NormalizedGuideProgramEditorInput = {
  programId: string;
  slug: string;
  title: string;
  ownerType: GuideProgramOwnerType;
  participationMode: GuideProgramParticipationMode;
  status: GuideProgramStatus;
  startsAt: string | null;
  endsAt: string | null;
  publicSummary: string | null;
  safetyPolicy: typeof SAFE_GUIDE_PROGRAM_POLICY;
  guideSpotIds: string[];
};

export type GuideProgramAssignableSpot = {
  id: string;
  title: string;
  subtitle: string;
  ownerType: string;
  visibilityStatus: string;
  safetyStatus: string;
  landownerConsent: boolean;
  availableTimePolicy: string;
};

export type GuideProgramAdminSpot = GuideProgramAssignableSpot & {
  sortOrder: number;
  requiredForCompletion: boolean;
};

export type GuideProgramAdminItem = {
  programId: string;
  slug: string;
  title: string;
  ownerType: GuideProgramOwnerType;
  participationMode: GuideProgramParticipationMode;
  status: GuideProgramStatus;
  startsAt: string | null;
  endsAt: string | null;
  publicSummary: string | null;
  safetyPolicy: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  spots: GuideProgramAdminSpot[];
};

export type RuntimeGuideProgram = {
  id: string;
  slug: string;
  title: string;
  participationMode: GuideProgramParticipationMode;
  status: GuideProgramStatus;
};

export type GuideProgramRef = {
  id: string;
  slug: string;
  title: string;
};

export type GuideProgramPublicSpot = {
  id: string;
  title: string;
  subtitle: string;
  preview: string;
  storyPoints: string[];
  displayLat: number;
  displayLng: number;
  locationPrecision: "exact" | "approximate";
  sortOrder: number;
  requiredForCompletion: boolean;
  unlocked: boolean;
  href: string;
};

export type GuideProgramProgress = {
  state: "signed_out" | "not_started" | "in_progress" | "complete";
  totalRequired: number;
  unlockedRequired: number;
  totalSpots: number;
  unlockedSpots: number;
  percent: number;
};

export type GuideProgramPublicDetail = {
  programId: string;
  slug: string;
  title: string;
  ownerType: GuideProgramOwnerType;
  participationMode: GuideProgramParticipationMode;
  publicSummary: string | null;
  startsAt: string | null;
  endsAt: string | null;
  spots: GuideProgramPublicSpot[];
  progress: GuideProgramProgress;
  nextSpot: GuideProgramPublicSpot | null;
};

type ProgramRow = QueryResultRow & {
  program_id: string;
  slug: string;
  title: string;
  owner_type: GuideProgramOwnerType;
  participation_mode: GuideProgramParticipationMode;
  status: GuideProgramStatus;
  starts_at: string | null;
  ends_at: string | null;
  public_summary: string | null;
  safety_policy: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  spots: unknown;
};

type RuntimeProgramRow = QueryResultRow & {
  program_id: string;
  slug: string;
  title: string;
  participation_mode: GuideProgramParticipationMode;
  status: GuideProgramStatus;
};

type GuideProgramRefRow = QueryResultRow & {
  program_id: string;
  slug: string;
  title: string;
};

export const SAFE_GUIDE_PROGRAM_POLICY = {
  location_display: "coarse",
  unlock_visibility: "private",
  requires_public_post: false,
} as const;

const OWNER_TYPES: GuideProgramOwnerType[] = ["owner", "community", "municipality", "school"];
const PARTICIPATION_MODES: GuideProgramParticipationMode[] = ["any_order", "ordered"];
const STATUSES: GuideProgramStatus[] = ["draft", "published", "paused", "closed"];

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  const text = stringValue(value);
  if (!text) throw new Error(`invalid_${field}`);
  if (text.length > maxLength) throw new Error(`invalid_${field}_too_long`);
  return text;
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  const text = stringValue(value);
  if (!text) return null;
  if (text.length > maxLength) throw new Error(`invalid_${field}_too_long`);
  return text;
}

function normalizeId(value: unknown, field: string): string {
  const text = requiredText(value, field, 96).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,95}$/.test(text)) throw new Error(`invalid_${field}`);
  return text;
}

function enumValue<T extends string>(value: unknown, field: string, allowed: readonly T[], fallback: T): T {
  const text = stringValue(value);
  if (!text) return fallback;
  if (!allowed.includes(text as T)) throw new Error(`invalid_${field}`);
  return text as T;
}

function dateValue(value: unknown, field: string): string | null {
  const text = stringValue(value);
  if (!text) return null;
  const time = Date.parse(text);
  if (!Number.isFinite(time)) throw new Error(`invalid_${field}`);
  return new Date(time).toISOString();
}

function normalizeGuideSpotIds(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n]/)
      : [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of raw) {
    const id = stringValue(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function guideSpotIsAssignableToProgram(spot: MapGuideSpot): boolean {
  if ((spot.visibilityStatus ?? "published") !== "published") return false;
  if ((spot.safetyStatus ?? "active") !== "active") return false;
  if (spot.landownerConsent === false) return false;
  if (spot.ownerType === "school") return false;
  return true;
}

function spotSummary(spot: MapGuideSpot): GuideProgramAssignableSpot {
  return {
    id: spot.id,
    title: spot.title,
    subtitle: spot.subtitle,
    ownerType: spot.ownerType ?? "community",
    visibilityStatus: spot.visibilityStatus ?? "published",
    safetyStatus: spot.safetyStatus ?? "active",
    landownerConsent: spot.landownerConsent !== false,
    availableTimePolicy: spot.availableTimePolicy ?? "anytime_public",
  };
}

export function listAssignableGuideSpots(): GuideProgramAssignableSpot[] {
  return MAP_GUIDE_SPOTS
    .filter(guideSpotIsAssignableToProgram)
    .map(spotSummary)
    .sort((a, b) => a.title.localeCompare(b.title, "ja"));
}

export function normalizeGuideProgramEditorInput(input: GuideProgramEditorInput): NormalizedGuideProgramEditorInput {
  const programId = normalizeId(input.programId ?? input.slug, "program_id");
  const slug = normalizeId(input.slug ?? programId, "slug");
  const title = requiredText(input.title, "title", 120);
  const ownerType = enumValue(input.ownerType, "owner_type", OWNER_TYPES, "community");
  const participationMode = enumValue(input.participationMode, "participation_mode", PARTICIPATION_MODES, "any_order");
  const status = enumValue(input.status, "status", STATUSES, "draft");
  const startsAt = dateValue(input.startsAt, "starts_at");
  const endsAt = dateValue(input.endsAt, "ends_at");
  if (startsAt && endsAt && Date.parse(startsAt) > Date.parse(endsAt)) {
    throw new Error("invalid_program_date_range");
  }
  const guideSpotIds = normalizeGuideSpotIds(input.guideSpotIds);
  const assignable = new Set(listAssignableGuideSpots().map((spot) => spot.id));
  const blocked = guideSpotIds.filter((id) => !assignable.has(id));
  if (blocked.length > 0) throw new Error("invalid_guide_program_spot");
  if (status === "published" && guideSpotIds.length === 0) {
    throw new Error("invalid_guide_program_published_without_spots");
  }

  return {
    programId,
    slug,
    title,
    ownerType,
    participationMode,
    status,
    startsAt,
    endsAt,
    publicSummary: optionalText(input.publicSummary, "public_summary", 600),
    safetyPolicy: SAFE_GUIDE_PROGRAM_POLICY,
    guideSpotIds,
  };
}

function parseSpotRows(value: unknown): GuideProgramAdminSpot[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const spotId = stringValue(row.guide_spot_id);
    const spot = MAP_GUIDE_SPOTS.find((candidate) => candidate.id === spotId);
    if (!spot) return null;
    return {
      ...spotSummary(spot),
      sortOrder: Number(row.sort_order ?? 0),
      requiredForCompletion: row.required_for_completion !== false,
    };
  }).filter((item): item is GuideProgramAdminSpot => Boolean(item));
}

function parsePublicSpotRows(value: unknown, unlockedIds: Set<string>): GuideProgramPublicSpot[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const spotId = stringValue(row.guide_spot_id);
    const spot = MAP_GUIDE_SPOTS.find((candidate) => candidate.id === spotId);
    if (!spot || !guideSpotIsAssignableToProgram(spot)) return null;
    return {
      id: spot.id,
      title: spot.title,
      subtitle: spot.subtitle,
      preview: spot.preview,
      storyPoints: spot.storyPoints,
      displayLat: spot.lat,
      displayLng: spot.lng,
      locationPrecision: spot.locationPrecision,
      sortOrder: Number(row.sort_order ?? 0),
      requiredForCompletion: row.required_for_completion !== false,
      unlocked: unlockedIds.has(spot.id),
      href: `/my-guides?guide=${encodeURIComponent(spot.id)}`,
    };
  }).filter((item): item is GuideProgramPublicSpot => Boolean(item))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "ja"));
}

function publicSpotIdsFromRows(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const spotId = stringValue(row.guide_spot_id);
    const spot = MAP_GUIDE_SPOTS.find((candidate) => candidate.id === spotId);
    return spot && guideSpotIsAssignableToProgram(spot) ? spot.id : null;
  }).filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

function toAdminItem(row: ProgramRow): GuideProgramAdminItem {
  return {
    programId: row.program_id,
    slug: row.slug,
    title: row.title,
    ownerType: row.owner_type,
    participationMode: row.participation_mode,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    publicSummary: row.public_summary,
    safetyPolicy: row.safety_policy ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    spots: parseSpotRows(row.spots),
  };
}

function publicProgress(spots: GuideProgramPublicSpot[], signedIn: boolean): GuideProgramProgress {
  const required = spots.filter((spot) => spot.requiredForCompletion);
  const totalRequired = required.length;
  const unlockedRequired = required.filter((spot) => spot.unlocked).length;
  const unlockedSpots = spots.filter((spot) => spot.unlocked).length;
  const percent = totalRequired > 0
    ? Math.round((unlockedRequired / totalRequired) * 100)
    : spots.length > 0
      ? Math.round((unlockedSpots / spots.length) * 100)
      : 0;
  return {
    state: !signedIn
      ? "signed_out"
      : totalRequired === 0
        ? unlockedSpots === 0
          ? "not_started"
          : unlockedSpots >= spots.length
            ? "complete"
            : "in_progress"
      : unlockedRequired === 0
        ? "not_started"
        : unlockedRequired >= totalRequired
          ? "complete"
          : "in_progress",
    totalRequired,
    unlockedRequired,
    totalSpots: spots.length,
    unlockedSpots,
    percent,
  };
}

function toPublicDetail(row: ProgramRow, unlockedIds: Set<string>, signedIn: boolean): GuideProgramPublicDetail {
  const spots = parsePublicSpotRows(row.spots, unlockedIds);
  const progress = publicProgress(spots, signedIn);
  const nextSpot = spots.find((spot) => spot.requiredForCompletion && !spot.unlocked) ?? null;
  return {
    programId: row.program_id,
    slug: row.slug,
    title: row.title,
    ownerType: row.owner_type,
    participationMode: row.participation_mode,
    publicSummary: row.public_summary,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    spots,
    progress,
    nextSpot,
  };
}

async function loadProgramSnapshot(client: PoolClient, programId: string): Promise<GuideProgramAdminItem | null> {
  const result = await client.query<ProgramRow>(
    `SELECT gp.program_id, gp.slug, gp.title, gp.owner_type, gp.participation_mode, gp.status,
            gp.starts_at::text, gp.ends_at::text, gp.public_summary, gp.safety_policy,
            gp.created_at::text, gp.updated_at::text,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'guide_spot_id', gps.guide_spot_id,
                  'sort_order', gps.sort_order,
                  'required_for_completion', gps.required_for_completion
                )
                ORDER BY gps.sort_order, gps.guide_spot_id
              ) FILTER (WHERE gps.guide_spot_id IS NOT NULL),
              '[]'::jsonb
            ) AS spots
       FROM guide_programs gp
       LEFT JOIN guide_program_spots gps ON gps.program_id = gp.program_id
      WHERE gp.program_id = $1
      GROUP BY gp.program_id`,
    [programId],
  );
  const row = result.rows[0];
  return row ? toAdminItem(row) : null;
}

export async function listGuideProgramsForAdmin(): Promise<GuideProgramAdminItem[]> {
  const result = await getPool().query<ProgramRow>(
    `SELECT gp.program_id, gp.slug, gp.title, gp.owner_type, gp.participation_mode, gp.status,
            gp.starts_at::text, gp.ends_at::text, gp.public_summary, gp.safety_policy,
            gp.created_at::text, gp.updated_at::text,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'guide_spot_id', gps.guide_spot_id,
                  'sort_order', gps.sort_order,
                  'required_for_completion', gps.required_for_completion
                )
                ORDER BY gps.sort_order, gps.guide_spot_id
              ) FILTER (WHERE gps.guide_spot_id IS NOT NULL),
              '[]'::jsonb
            ) AS spots
       FROM guide_programs gp
       LEFT JOIN guide_program_spots gps ON gps.program_id = gp.program_id
      GROUP BY gp.program_id
      ORDER BY
        CASE gp.status
          WHEN 'published' THEN 0
          WHEN 'draft' THEN 1
          WHEN 'paused' THEN 2
          ELSE 3
        END,
        gp.updated_at DESC
      LIMIT 100`,
  );
  return result.rows.map(toAdminItem);
}

export async function getGuideProgramEditorState(): Promise<{
  programs: GuideProgramAdminItem[];
  guideSpots: GuideProgramAssignableSpot[];
}> {
  const programs = await listGuideProgramsForAdmin();
  return {
    programs,
    guideSpots: listAssignableGuideSpots(),
  };
}

async function loadUnlockedGuideSpotIds(userId: string | null, guideSpotIds: string[]): Promise<Set<string>> {
  if (!userId || guideSpotIds.length === 0) return new Set();
  const result = await getPool().query<{ guide_spot_id: string }>(
    `SELECT guide_spot_id
       FROM guide_unlocks
      WHERE user_id = $1
        AND guide_spot_id = ANY($2::text[])`,
    [userId, guideSpotIds],
  );
  return new Set(result.rows.map((row) => row.guide_spot_id));
}

export async function getPublishedGuideProgramDetail(slug: string, userId: string | null = null): Promise<GuideProgramPublicDetail | null> {
  const normalizedSlug = stringValue(slug).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,95}$/.test(normalizedSlug)) return null;
  const result = await getPool().query<ProgramRow>(
    `SELECT gp.program_id, gp.slug, gp.title, gp.owner_type, gp.participation_mode, gp.status,
            gp.starts_at::text, gp.ends_at::text, gp.public_summary, gp.safety_policy,
            gp.created_at::text, gp.updated_at::text,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'guide_spot_id', gps.guide_spot_id,
                  'sort_order', gps.sort_order,
                  'required_for_completion', gps.required_for_completion
                )
                ORDER BY gps.sort_order, gps.guide_spot_id
              ) FILTER (WHERE gps.guide_spot_id IS NOT NULL),
              '[]'::jsonb
            ) AS spots
      FROM guide_programs gp
       LEFT JOIN guide_program_spots gps ON gps.program_id = gp.program_id
      WHERE gp.slug = $1
        AND gp.status = 'published'
        AND gp.owner_type != 'school'
        AND (gp.starts_at IS NULL OR gp.starts_at <= now())
        AND (gp.ends_at IS NULL OR gp.ends_at >= now())
      GROUP BY gp.program_id
      LIMIT 1`,
    [normalizedSlug],
  );
  const row = result.rows[0];
  if (!row) return null;
  const spotIds = publicSpotIdsFromRows(row.spots);
  const unlockedIds = await loadUnlockedGuideSpotIds(userId, spotIds).catch(() => new Set<string>());
  return toPublicDetail(row, unlockedIds, Boolean(userId));
}

export async function listPublishedGuideProgramsForPublic(userId: string | null = null): Promise<GuideProgramPublicDetail[]> {
  const result = await getPool().query<ProgramRow>(
    `SELECT gp.program_id, gp.slug, gp.title, gp.owner_type, gp.participation_mode, gp.status,
            gp.starts_at::text, gp.ends_at::text, gp.public_summary, gp.safety_policy,
            gp.created_at::text, gp.updated_at::text,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'guide_spot_id', gps.guide_spot_id,
                  'sort_order', gps.sort_order,
                  'required_for_completion', gps.required_for_completion
                )
                ORDER BY gps.sort_order, gps.guide_spot_id
              ) FILTER (WHERE gps.guide_spot_id IS NOT NULL),
              '[]'::jsonb
            ) AS spots
       FROM guide_programs gp
       LEFT JOIN guide_program_spots gps ON gps.program_id = gp.program_id
      WHERE gp.status = 'published'
        AND gp.owner_type != 'school'
        AND (gp.starts_at IS NULL OR gp.starts_at <= now())
        AND (gp.ends_at IS NULL OR gp.ends_at >= now())
      GROUP BY gp.program_id
      ORDER BY gp.updated_at DESC
      LIMIT 50`,
  );
  const allSpotIds = [...new Set(result.rows.flatMap((row) => publicSpotIdsFromRows(row.spots)))];
  const unlockedIds = await loadUnlockedGuideSpotIds(userId, allSpotIds).catch(() => new Set<string>());
  return result.rows.map((row) => toPublicDetail(row, unlockedIds, Boolean(userId)));
}

export async function upsertGuideProgram(input: GuideProgramEditorInput, actorUserId: string | null): Promise<GuideProgramAdminItem> {
  const normalized = normalizeGuideProgramEditorInput(input);
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const before = await loadProgramSnapshot(client, normalized.programId);
    await client.query(
      `INSERT INTO guide_programs (
          program_id, slug, title, owner_type, participation_mode, status,
          starts_at, ends_at, public_summary, safety_policy, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9, $10::jsonb, now(), now())
       ON CONFLICT (program_id) DO UPDATE SET
          slug = EXCLUDED.slug,
          title = EXCLUDED.title,
          owner_type = EXCLUDED.owner_type,
          participation_mode = EXCLUDED.participation_mode,
          status = EXCLUDED.status,
          starts_at = EXCLUDED.starts_at,
          ends_at = EXCLUDED.ends_at,
          public_summary = EXCLUDED.public_summary,
          safety_policy = EXCLUDED.safety_policy,
          updated_at = now()`,
      [
        normalized.programId,
        normalized.slug,
        normalized.title,
        normalized.ownerType,
        normalized.participationMode,
        normalized.status,
        normalized.startsAt,
        normalized.endsAt,
        normalized.publicSummary,
        JSON.stringify(normalized.safetyPolicy),
      ],
    );

    await client.query("DELETE FROM guide_program_spots WHERE program_id = $1", [normalized.programId]);
    for (const [index, guideSpotId] of normalized.guideSpotIds.entries()) {
      await client.query(
        `INSERT INTO guide_program_spots (program_id, guide_spot_id, sort_order, required_for_completion, created_at)
         VALUES ($1, $2, $3, true, now())`,
        [normalized.programId, guideSpotId, (index + 1) * 10],
      );
    }

    const after = await loadProgramSnapshot(client, normalized.programId);
    if (!after) throw new Error("guide_program_upsert_failed");
    const action = !before
      ? "create"
      : before.status !== after.status
        ? "status_change"
        : "update";
    await client.query(
      `INSERT INTO guide_program_audit (program_id, actor_user_id, action, before_payload, after_payload)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
      [
        normalized.programId,
        actorUserId,
        action,
        JSON.stringify(before ?? {}),
        JSON.stringify(after),
      ],
    );

    await client.query("commit");
    return after;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function findActiveGuideProgramForSpot(guideSpotId: string): Promise<RuntimeGuideProgram | null> {
  const result = await getPool().query<RuntimeProgramRow>(
    `SELECT gp.program_id, gp.slug, gp.title, gp.participation_mode, gp.status
       FROM guide_program_spots gps
       JOIN guide_programs gp ON gp.program_id = gps.program_id
      WHERE gps.guide_spot_id = $1
        AND gp.status = 'published'
        AND (gp.starts_at IS NULL OR gp.starts_at <= now())
        AND (gp.ends_at IS NULL OR gp.ends_at >= now())
      ORDER BY gps.sort_order, gp.updated_at DESC
      LIMIT 1`,
    [guideSpotId],
  );
  const row = result.rows[0];
  return row
    ? {
        id: row.program_id,
        slug: row.slug,
        title: row.title,
        participationMode: row.participation_mode,
        status: row.status,
      }
    : null;
}

export async function listGuideProgramTitles(programIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(programIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const result = await getPool().query<{ program_id: string; title: string }>(
    `SELECT program_id, title
       FROM guide_programs
      WHERE program_id = ANY($1::text[])`,
    [ids],
  );
  return new Map(result.rows.map((row) => [row.program_id, row.title]));
}

export async function listGuideProgramRefs(programIds: string[]): Promise<Map<string, GuideProgramRef>> {
  const ids = [...new Set(programIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const result = await getPool().query<GuideProgramRefRow>(
    `SELECT program_id, slug, title
       FROM guide_programs
      WHERE program_id = ANY($1::text[])`,
    [ids],
  );
  return new Map(result.rows.map((row) => [row.program_id, {
    id: row.program_id,
    slug: row.slug,
    title: row.title,
  }]));
}
