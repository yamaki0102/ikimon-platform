import type { PoolClient, QueryResultRow } from "pg";
import { getPool } from "../db.js";
import { MAP_GUIDE_PROGRAMS, MAP_GUIDE_SPOTS, type MapGuideProgram, type MapGuideSpot } from "./mapGuideSpots.js";

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
  visitAnchorLabel: string;
  publicLocationMode: MapGuideSpot["publicLocationMode"];
  subjectLocationMode: MapGuideSpot["subjectLocationMode"];
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

export type GuideProgramRecap = {
  schemaVersion: "guide_program_recap/v1";
  generatedAt: string;
  program: GuideProgramAdminItem;
  kAnonymityThreshold: number;
  suppressedBreakdownReasons: string[];
  privacyBoundary: {
    exactCoordinatesIncluded: false;
    userLevelRowsIncluded: false;
    smallCohortSuppressionApplied: boolean;
  };
  claimBoundary: {
    canSay: string[];
    cannotSay: string[];
  };
  stats: {
    guideSpotCount: number;
    requiredGuideSpotCount: number;
    guideUnlockCount: number | null;
    guidePlayCount: number | null;
    participantsCountRounded: number | null;
    completionRateBucket: GuideProgramRateBucket;
    playRateBucket: GuideProgramRateBucket;
  };
  nextActions: Array<{ label: string; body: string; href: string }>;
};

export type GuideProgramRateBucket =
  | "suppressed"
  | "not_applicable"
  | "none"
  | "starting"
  | "building"
  | "strong";

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

export const GUIDE_PROGRAM_RECAP_K_ANONYMITY_THRESHOLD = 5;

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
      visitAnchorLabel: spot.visitAnchorLabel,
      publicLocationMode: spot.publicLocationMode,
      subjectLocationMode: spot.subjectLocationMode,
      sortOrder: Number(row.sort_order ?? 0),
      requiredForCompletion: row.required_for_completion !== false,
      unlocked: unlockedIds.has(spot.id),
      href: `/my-guides?guide=${encodeURIComponent(spot.id)}`,
    };
  }).filter((item): item is GuideProgramPublicSpot => Boolean(item))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "ja"));
}

function staticGuideProgramSpots(program: MapGuideProgram, unlockedIds: Set<string>): GuideProgramPublicSpot[] {
  return program.guideSpotIds
    .map<GuideProgramPublicSpot | null>((spotId, index) => {
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
        visitAnchorLabel: spot.visitAnchorLabel,
        publicLocationMode: spot.publicLocationMode,
        subjectLocationMode: spot.subjectLocationMode,
        sortOrder: (index + 1) * 10,
        requiredForCompletion: true,
        unlocked: unlockedIds.has(spot.id),
        href: `/my-guides?guide=${encodeURIComponent(spot.id)}`,
      };
    })
    .filter((item): item is GuideProgramPublicSpot => Boolean(item));
}

function guideProgramOwnerTypeFromSpots(spots: GuideProgramPublicSpot[]): GuideProgramOwnerType {
  const ownerTypes = spots
    .map((spot) => MAP_GUIDE_SPOTS.find((candidate) => candidate.id === spot.id)?.ownerType)
    .filter((value): value is GuideProgramOwnerType => value === "owner" || value === "community" || value === "municipality" || value === "school");
  if (ownerTypes.includes("owner")) return "owner";
  if (ownerTypes.includes("municipality")) return "municipality";
  return ownerTypes[0] ?? "community";
}

function publishedStaticGuidePrograms(): MapGuideProgram[] {
  return MAP_GUIDE_PROGRAMS.filter((program) =>
    program.status === "published" &&
    staticGuideProgramSpots(program, new Set()).length > 0
  );
}

function toStaticPublicDetail(program: MapGuideProgram, unlockedIds: Set<string>, signedIn: boolean): GuideProgramPublicDetail | null {
  const spots = staticGuideProgramSpots(program, unlockedIds);
  if (program.status !== "published" || spots.length === 0) return null;
  const progress = publicProgress(spots, signedIn);
  const nextSpot = spots.find((spot) => spot.requiredForCompletion && !spot.unlocked) ?? null;
  return {
    programId: program.id,
    slug: program.slug,
    title: program.title,
    ownerType: guideProgramOwnerTypeFromSpots(spots),
    participationMode: program.participationMode,
    publicSummary: program.summary,
    startsAt: null,
    endsAt: null,
    spots,
    progress,
    nextSpot,
  };
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

export function roundedGuideParticipantCount(
  count: number,
  threshold = GUIDE_PROGRAM_RECAP_K_ANONYMITY_THRESHOLD,
): number | null {
  if (!Number.isFinite(count) || count < threshold) return null;
  return Math.max(threshold, Math.floor(count / 5) * 5 || threshold);
}

export function guideProgramRateBucket(input: {
  numerator: number;
  denominator: number;
  participants: number;
  threshold?: number;
}): GuideProgramRateBucket {
  const threshold = input.threshold ?? GUIDE_PROGRAM_RECAP_K_ANONYMITY_THRESHOLD;
  if (!Number.isFinite(input.participants) || input.participants < threshold) return "suppressed";
  if (!Number.isFinite(input.denominator) || input.denominator <= 0) return "not_applicable";
  if (!Number.isFinite(input.numerator) || input.numerator <= 0) return "none";
  const rate = input.numerator / input.denominator;
  if (rate < 0.25) return "starting";
  if (rate < 0.6) return "building";
  return "strong";
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

export async function buildGuideProgramRecap(programId: string): Promise<GuideProgramRecap | null> {
  const normalizedProgramId = stringValue(programId).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,95}$/.test(normalizedProgramId)) return null;

  const pool = getPool();
  const programResult = await pool.query<ProgramRow>(
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
      GROUP BY gp.program_id
      LIMIT 1`,
    [normalizedProgramId],
  );
  const programRow = programResult.rows[0];
  if (!programRow) return null;
  const program = toAdminItem(programRow);
  const requiredGuideSpotCount = program.spots.filter((spot) => spot.requiredForCompletion).length;
  const completionDenominator = requiredGuideSpotCount > 0 ? requiredGuideSpotCount : program.spots.length;

  const summaryResult = await pool.query<{
    unlock_count: string;
    play_count: string;
    participants: string;
  }>(
    `SELECT
        COUNT(*)::text AS unlock_count,
        COUNT(last_listened_at)::text AS play_count,
        COUNT(DISTINCT user_id)::text AS participants
       FROM guide_unlocks
      WHERE program_id = $1`,
    [normalizedProgramId],
  );
  const summary = summaryResult.rows[0];
  const guideUnlockCount = Number(summary?.unlock_count ?? 0);
  const guidePlayCount = Number(summary?.play_count ?? 0);
  const participants = Number(summary?.participants ?? 0);

  const completionResult = await pool.query<{ completed: string }>(
    `WITH per_user AS (
        SELECT user_id, COUNT(DISTINCT guide_spot_id)::int AS unlocked_spots
          FROM guide_unlocks
         WHERE program_id = $1
         GROUP BY user_id
      )
      SELECT COUNT(*)::text AS completed
        FROM per_user
       WHERE $2::int > 0
         AND unlocked_spots >= $2::int`,
    [normalizedProgramId, completionDenominator],
  );
  const completedParticipants = Number(completionResult.rows[0]?.completed ?? 0);
  const participantsCountRounded = roundedGuideParticipantCount(participants);
  const smallCohortSuppressed = participantsCountRounded === null;
  const suppressedBreakdownReasons = participantsCountRounded === null
    ? ["participant_count_below_k_anonymity_threshold", "spot_window_breakdown_disabled_in_p0"]
    : ["spot_window_breakdown_disabled_in_p0"];

  return {
    schemaVersion: "guide_program_recap/v1",
    generatedAt: new Date().toISOString(),
    program,
    kAnonymityThreshold: GUIDE_PROGRAM_RECAP_K_ANONYMITY_THRESHOLD,
    suppressedBreakdownReasons,
    privacyBoundary: {
      exactCoordinatesIncluded: false,
      userLevelRowsIncluded: false,
      smallCohortSuppressionApplied: smallCohortSuppressed,
    },
    claimBoundary: {
      canSay: [
        "このガイド企画で本人用に解放されたガイド数",
        "解放後に再生されたガイド数",
        "次回のガイド追加や観察会化を考えるための匿名集計",
      ],
      cannotSay: [
        "参加者ごとの行動履歴",
        "正確な来訪経路や投稿位置",
        "生物多様性の改善や公式調査結果",
        "ガイド個人の評価",
      ],
    },
    stats: {
      guideSpotCount: program.spots.length,
      requiredGuideSpotCount,
      guideUnlockCount: smallCohortSuppressed ? null : guideUnlockCount,
      guidePlayCount: smallCohortSuppressed ? null : guidePlayCount,
      participantsCountRounded,
      completionRateBucket: guideProgramRateBucket({
        numerator: completedParticipants,
        denominator: participants,
        participants,
      }),
      playRateBucket: guideProgramRateBucket({
        numerator: guidePlayCount,
        denominator: guideUnlockCount,
        participants,
      }),
    },
    nextActions: [
      {
        label: "観察会として実施",
        body: "同じ場所で人を集める日は、Observation Eventにしてrecapと公式レポートへつなぐ。",
        href: "/community/events/new",
      },
      {
        label: "ガイドを増やす",
        body: "解放数に対して再生が少ない場合は、入口ガイドの短さ、題名、現地導線を見直す。",
        href: "/admin/guide-programs",
      },
      {
        label: "季節企画化",
        body: "同じ場所で季節差が出るなら、期間を切ったguide_programや観察会へ分ける。",
        href: "/guide-programs",
      },
    ],
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
  let row: ProgramRow | null = null;
  try {
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
    row = result.rows[0] ?? null;
  } catch {
    row = null;
  }
  const fallbackProgram = publishedStaticGuidePrograms().find((program) => program.slug === normalizedSlug) ?? null;
  const spotIds = row ? publicSpotIdsFromRows(row.spots) : (fallbackProgram?.guideSpotIds ?? []);
  const unlockedIds = await loadUnlockedGuideSpotIds(userId, spotIds).catch(() => new Set<string>());
  if (row) return toPublicDetail(row, unlockedIds, Boolean(userId));
  return fallbackProgram ? toStaticPublicDetail(fallbackProgram, unlockedIds, Boolean(userId)) : null;
}

export async function listPublishedGuideProgramsForPublic(userId: string | null = null): Promise<GuideProgramPublicDetail[]> {
  let rows: ProgramRow[] = [];
  try {
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
    rows = result.rows;
  } catch {
    rows = [];
  }
  const dbSlugs = new Set(rows.map((row) => row.slug));
  const staticPrograms = publishedStaticGuidePrograms().filter((program) => !dbSlugs.has(program.slug));
  const allSpotIds = [
    ...new Set([
      ...rows.flatMap((row) => publicSpotIdsFromRows(row.spots)),
      ...staticPrograms.flatMap((program) => program.guideSpotIds),
    ]),
  ];
  const unlockedIds = await loadUnlockedGuideSpotIds(userId, allSpotIds).catch(() => new Set<string>());
  return [
    ...rows.map((row) => toPublicDetail(row, unlockedIds, Boolean(userId))),
    ...staticPrograms
      .map((program) => toStaticPublicDetail(program, unlockedIds, Boolean(userId)))
      .filter((program): program is GuideProgramPublicDetail => Boolean(program)),
  ];
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
