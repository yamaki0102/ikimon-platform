import { getPool } from "../db.js";

const EVENT_NAMES = new Set([
  "first_action",
  "task_completion",
  "section_view",
  "read_depth",
  "primary_cta_click",
  "funnel_step",
  "funnel_error",
] as const);
const OBSERVATION_EVENT_NAMES = new Set(["section_view", "read_depth", "primary_cta_click"] as const);
const RECORD_FUNNEL_EVENT_NAMES = new Set(["funnel_step", "funnel_error"] as const);

type UiKpiEventName =
  | "first_action"
  | "task_completion"
  | "section_view"
  | "read_depth"
  | "primary_cta_click"
  | "funnel_step"
  | "funnel_error";

type RecordUiKpiEventInput = {
  eventName: UiKpiEventName;
  eventSource: "web" | "api";
  pagePath?: string | null;
  routeKey?: string | null;
  actionKey?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
};

type RecordUiKpiEventResult = {
  eventId: string;
};

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, maxLength);
}

export function isUiKpiEventName(value: unknown): value is UiKpiEventName {
  return typeof value === "string" && EVENT_NAMES.has(value as UiKpiEventName);
}

export async function recordUiKpiEvent(input: RecordUiKpiEventInput): Promise<RecordUiKpiEventResult> {
  const pool = getPool();
  const tableName = RECORD_FUNNEL_EVENT_NAMES.has(input.eventName as "funnel_step" | "funnel_error")
    ? "record_ui_kpi_events"
    : OBSERVATION_EVENT_NAMES.has(input.eventName as "section_view" | "read_depth" | "primary_cta_click")
      ? "observation_ui_kpi_events"
      : "ui_kpi_events";
  const result = await pool.query<{ event_id: string }>(
    `insert into ${tableName} (
       event_name,
       event_source,
       page_path,
       route_key,
       action_key,
       user_id,
       metadata
     )
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)
     returning event_id`,
    [
      input.eventName,
      input.eventSource,
      normalizeText(input.pagePath, 256),
      normalizeText(input.routeKey, 256),
      normalizeText(input.actionKey, 128),
      normalizeText(input.userId, 128),
      JSON.stringify(input.metadata ?? {}),
    ],
  );

  return {
    eventId: result.rows[0]?.event_id ?? "",
  };
}
