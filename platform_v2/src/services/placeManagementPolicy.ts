import { getPool } from "../db.js";

export type ManagementGoal = "balanced" | "keep_clear" | "native_patch" | "flowering_allowed" | "invasive_watch";
export type WeedTolerance = "low" | "medium" | "high";
export type InvasivePolicyResponse = "ask_first" | "controlled_removal" | "observe";
export type MowingFrequency = "as_needed" | "monthly" | "seasonal" | "rare";

export type PlaceManagementPolicy = {
  placeId: string;
  userId: string;
  managementGoal: ManagementGoal;
  weedTolerance: WeedTolerance;
  invasiveResponse: InvasivePolicyResponse;
  mowingFrequency: MowingFrequency;
  notes: string;
  updatedAt: string | null;
};

export type PlaceManagementPolicyInput = {
  managementGoal?: unknown;
  weedTolerance?: unknown;
  invasiveResponse?: unknown;
  mowingFrequency?: unknown;
  notes?: unknown;
};

const MANAGEMENT_GOALS: ManagementGoal[] = ["balanced", "keep_clear", "native_patch", "flowering_allowed", "invasive_watch"];
const WEED_TOLERANCES: WeedTolerance[] = ["low", "medium", "high"];
const INVASIVE_RESPONSES: InvasivePolicyResponse[] = ["ask_first", "controlled_removal", "observe"];
const MOWING_FREQUENCIES: MowingFrequency[] = ["as_needed", "monthly", "seasonal", "rare"];

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

function cleanNotes(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 600);
}

function rowToPolicy(row: {
  place_id: string;
  user_id: string;
  management_goal: string;
  weed_tolerance: string;
  invasive_response: string;
  mowing_frequency: string;
  notes: string | null;
  updated_at: string | null;
}): PlaceManagementPolicy {
  return {
    placeId: row.place_id,
    userId: row.user_id,
    managementGoal: pickEnum(row.management_goal, MANAGEMENT_GOALS, "balanced"),
    weedTolerance: pickEnum(row.weed_tolerance, WEED_TOLERANCES, "medium"),
    invasiveResponse: pickEnum(row.invasive_response, INVASIVE_RESPONSES, "ask_first"),
    mowingFrequency: pickEnum(row.mowing_frequency, MOWING_FREQUENCIES, "as_needed"),
    notes: row.notes ?? "",
    updatedAt: row.updated_at,
  };
}

export function normalizePlaceManagementPolicyInput(input: PlaceManagementPolicyInput): Omit<PlaceManagementPolicy, "placeId" | "userId" | "updatedAt"> {
  return {
    managementGoal: pickEnum(input.managementGoal, MANAGEMENT_GOALS, "balanced"),
    weedTolerance: pickEnum(input.weedTolerance, WEED_TOLERANCES, "medium"),
    invasiveResponse: pickEnum(input.invasiveResponse, INVASIVE_RESPONSES, "ask_first"),
    mowingFrequency: pickEnum(input.mowingFrequency, MOWING_FREQUENCIES, "as_needed"),
    notes: cleanNotes(input.notes),
  };
}

export async function getPlaceManagementPolicy(placeId: string | null | undefined, userId: string | null | undefined): Promise<PlaceManagementPolicy | null> {
  if (!placeId || !userId) return null;
  const pool = getPool();
  const result = await pool.query<{
    place_id: string;
    user_id: string;
    management_goal: string;
    weed_tolerance: string;
    invasive_response: string;
    mowing_frequency: string;
    notes: string | null;
    updated_at: string | null;
  }>(
    `SELECT place_id, user_id, management_goal, weed_tolerance, invasive_response,
            mowing_frequency, notes, updated_at::text
       FROM place_management_policies
      WHERE place_id = $1
        AND user_id = $2
      LIMIT 1`,
    [placeId, userId],
  );
  const row = result.rows[0];
  return row ? rowToPolicy(row) : null;
}

export async function savePlaceManagementPolicy(placeId: string, userId: string, input: PlaceManagementPolicyInput): Promise<PlaceManagementPolicy> {
  const normalized = normalizePlaceManagementPolicyInput(input);
  const pool = getPool();
  const result = await pool.query<{
    place_id: string;
    user_id: string;
    management_goal: string;
    weed_tolerance: string;
    invasive_response: string;
    mowing_frequency: string;
    notes: string | null;
    updated_at: string | null;
  }>(
    `INSERT INTO place_management_policies (
        place_id, user_id, management_goal, weed_tolerance, invasive_response,
        mowing_frequency, notes, policy_json, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,NOW())
     ON CONFLICT (place_id, user_id) DO UPDATE SET
        management_goal = excluded.management_goal,
        weed_tolerance = excluded.weed_tolerance,
        invasive_response = excluded.invasive_response,
        mowing_frequency = excluded.mowing_frequency,
        notes = excluded.notes,
        policy_json = excluded.policy_json,
        updated_at = NOW()
     RETURNING place_id, user_id, management_goal, weed_tolerance, invasive_response,
               mowing_frequency, notes, updated_at::text`,
    [
      placeId,
      userId,
      normalized.managementGoal,
      normalized.weedTolerance,
      normalized.invasiveResponse,
      normalized.mowingFrequency,
      normalized.notes || null,
      JSON.stringify({ source: "observation_detail_field_advice" }),
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("place_management_policy_save_failed");
  return rowToPolicy(row);
}
