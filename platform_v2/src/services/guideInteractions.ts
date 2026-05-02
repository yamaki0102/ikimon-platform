import { getPool } from "../db.js";

export type GuideInteractionType =
  | "surfaced"
  | "played"
  | "skipped"
  | "saved_later"
  | "helpful"
  | "wrong"
  | "corrected";

export type GuideInteractionInput = {
  guideRecordId?: string | null;
  hypothesisId?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  interactionType: GuideInteractionType;
  payload?: Record<string, unknown>;
  occurredAt?: string | null;
};

export const GUIDE_INTERACTION_TYPES: GuideInteractionType[] = [
  "surfaced",
  "played",
  "skipped",
  "saved_later",
  "helpful",
  "wrong",
  "corrected",
];

function cleanUuid(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)
    ? trimmed
    : null;
}

function cleanOccurredAt(value: string | null | undefined): string | null {
  if (!value) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}

export function parseGuideInteractionType(value: unknown): GuideInteractionType | null {
  return typeof value === "string" && (GUIDE_INTERACTION_TYPES as string[]).includes(value)
    ? value as GuideInteractionType
    : null;
}

export async function recordGuideInteraction(input: GuideInteractionInput): Promise<string> {
  const result = await getPool().query<{ interaction_id: string }>(
    `insert into guide_interactions
       (guide_record_id, hypothesis_id, user_id, session_id, interaction_type, payload, occurred_at)
     values ($1, $2, $3, $4, $5, $6::jsonb, coalesce($7::timestamptz, now()))
     returning interaction_id::text`,
    [
      cleanUuid(input.guideRecordId),
      cleanUuid(input.hypothesisId),
      input.userId ?? null,
      input.sessionId?.trim().slice(0, 120) || "",
      input.interactionType,
      JSON.stringify(input.payload ?? {}),
      cleanOccurredAt(input.occurredAt),
    ],
  );
  return result.rows[0]?.interaction_id ?? "";
}

export const __test__ = { cleanUuid, cleanOccurredAt };
