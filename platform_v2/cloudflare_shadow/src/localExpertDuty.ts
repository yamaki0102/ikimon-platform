import type { Env } from "./core/env";

export const PLACE_LOCAL_EXPERTS_CREATE_SQL = `
CREATE TABLE IF NOT EXISTS place_local_experts (
  expert_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  specialty TEXT NOT NULL DEFAULT '',
  role_kind TEXT NOT NULL DEFAULT 'local_expert',
  verified INTEGER NOT NULL DEFAULT 1,
  verified_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(place_id, user_id)
)
`.trim();

export const EXPERT_DUTY_QUEUE_CREATE_SQL = `
CREATE TABLE IF NOT EXISTS expert_duty_queue (
  duty_id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  reason_kind TEXT NOT NULL,
  is_rare_species INTEGER NOT NULL DEFAULT 0,
  exact_lat REAL,
  exact_lng REAL,
  status TEXT NOT NULL DEFAULT 'pending',
  due_at INTEGER NOT NULL,
  expert_user_id TEXT NOT NULL DEFAULT '',
  expert_name TEXT NOT NULL DEFAULT '',
  human_comment TEXT NOT NULL DEFAULT '',
  responded_at INTEGER,
  created_at INTEGER NOT NULL
)
`.trim();

export type PlaceLocalExpertRow = {
  expert_id: string;
  place_id: string;
  user_id: string;
  display_name: string;
  specialty: string;
  role_kind: string;
  verified: number;
  verified_count: number;
  created_at: number;
};

export type ExpertDutyRow = {
  duty_id: string;
  record_id: string;
  place_id: string;
  reason_kind: string;
  is_rare_species: number;
  exact_lat: number | null;
  exact_lng: number | null;
  status: string;
  due_at: number;
  expert_user_id: string;
  expert_name: string;
  human_comment: string;
  responded_at: number | null;
  created_at: number;
};

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function shouldRouteToExpertDuty(input: {
  isRareSpecies?: boolean;
  isAiUncertain?: boolean;
  isSuspectedInvasive?: boolean;
}): { route: boolean; reasonKind: "rare_species" | "ai_uncertain" | "suspected_invasive" | null } {
  if (input.isRareSpecies) return { route: true, reasonKind: "rare_species" };
  if (input.isSuspectedInvasive) return { route: true, reasonKind: "suspected_invasive" };
  if (input.isAiUncertain) return { route: true, reasonKind: "ai_uncertain" };
  return { route: false, reasonKind: null };
}

export async function registerPlaceLocalExpert(
  env: Env,
  input: {
    placeId: string;
    userId: string;
    displayName: string;
    specialty?: string;
    roleKind?: string;
  }
): Promise<PlaceLocalExpertRow> {
  await env.CORE_DB.prepare(PLACE_LOCAL_EXPERTS_CREATE_SQL).run();
  const row: PlaceLocalExpertRow = {
    expert_id: `exp_${crypto.randomUUID().slice(0, 12)}`,
    place_id: input.placeId.trim(),
    user_id: input.userId.trim(),
    display_name: input.displayName.trim().slice(0, 80) || "地域の目利き",
    specialty: (input.specialty ?? "").trim().slice(0, 120),
    role_kind: (input.roleKind ?? "local_expert").trim().slice(0, 40),
    verified: 1,
    verified_count: 0,
    created_at: Date.now()
  };

  await env.CORE_DB.prepare(
    `INSERT INTO place_local_experts (
      expert_id, place_id, user_id, display_name, specialty, role_kind, verified, verified_count, created_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    ON CONFLICT(place_id, user_id) DO UPDATE SET
      display_name = excluded.display_name,
      specialty = excluded.specialty,
      role_kind = excluded.role_kind`
  ).bind(
    row.expert_id,
    row.place_id,
    row.user_id,
    row.display_name,
    row.specialty,
    row.role_kind,
    row.verified,
    row.verified_count,
    row.created_at
  ).run();

  return row;
}

export async function routeRecordToExpertDuty(
  env: Env,
  input: {
    recordId: string;
    placeId: string;
    isRareSpecies?: boolean;
    isAiUncertain?: boolean;
    isSuspectedInvasive?: boolean;
    exactLat?: number | null;
    exactLng?: number | null;
    nowMs?: number;
  }
): Promise<{ routed: boolean; duty?: ExpertDutyRow }> {
  const decision = shouldRouteToExpertDuty(input);
  if (!decision.route || !decision.reasonKind) {
    return { routed: false };
  }

  await env.CORE_DB.prepare(EXPERT_DUTY_QUEUE_CREATE_SQL).run();
  const now = input.nowMs ?? Date.now();
  const duty: ExpertDutyRow = {
    duty_id: `duty_${crypto.randomUUID().slice(0, 12)}`,
    record_id: input.recordId.trim(),
    place_id: input.placeId.trim(),
    reason_kind: decision.reasonKind,
    is_rare_species: input.isRareSpecies ? 1 : 0,
    exact_lat: typeof input.exactLat === "number" && Number.isFinite(input.exactLat) ? input.exactLat : null,
    exact_lng: typeof input.exactLng === "number" && Number.isFinite(input.exactLng) ? input.exactLng : null,
    status: "pending",
    due_at: now + 48 * 60 * 60 * 1000,
    expert_user_id: "",
    expert_name: "",
    human_comment: "",
    responded_at: null,
    created_at: now
  };

  await env.CORE_DB.prepare(
    `INSERT INTO expert_duty_queue (
      duty_id, record_id, place_id, reason_kind, is_rare_species, exact_lat, exact_lng,
      status, due_at, expert_user_id, expert_name, human_comment, responded_at, created_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
  ).bind(
    duty.duty_id,
    duty.record_id,
    duty.place_id,
    duty.reason_kind,
    duty.is_rare_species,
    duty.exact_lat,
    duty.exact_lng,
    duty.status,
    duty.due_at,
    duty.expert_user_id,
    duty.expert_name,
    duty.human_comment,
    duty.responded_at,
    duty.created_at
  ).run();

  return { routed: true, duty };
}

export async function submitExpertVoiceComment(
  env: Env,
  dutyId: string,
  input: {
    expertUserId: string;
    expertName: string;
    comment: string;
  }
): Promise<ExpertDutyRow | null> {
  await env.CORE_DB.prepare(EXPERT_DUTY_QUEUE_CREATE_SQL).run();
  await env.CORE_DB.prepare(PLACE_LOCAL_EXPERTS_CREATE_SQL).run();
  const existing = await env.CORE_DB.prepare(
    "SELECT * FROM expert_duty_queue WHERE duty_id = ?1 LIMIT 1"
  ).bind(dutyId).first<ExpertDutyRow>();
  if (!existing) return null;

  const expert = await env.CORE_DB.prepare(
    "SELECT * FROM place_local_experts WHERE place_id = ?1 AND user_id = ?2 AND verified = 1 LIMIT 1"
  ).bind(existing.place_id, input.expertUserId).first<PlaceLocalExpertRow>();
  if (!expert) return null;

  const comment = input.comment.trim().slice(0, 300);
  const now = Date.now();
  await env.CORE_DB.prepare(
    `UPDATE expert_duty_queue
     SET status = 'answered', expert_user_id = ?2, expert_name = ?3, human_comment = ?4, responded_at = ?5
     WHERE duty_id = ?1`
  ).bind(dutyId, input.expertUserId, input.expertName.trim().slice(0, 80) || expert.display_name, comment, now).run();

  await env.CORE_DB.prepare(
    "UPDATE place_local_experts SET verified_count = verified_count + 1 WHERE expert_id = ?1"
  ).bind(expert.expert_id).run();

  return {
    ...existing,
    status: "answered",
    expert_user_id: input.expertUserId,
    expert_name: input.expertName.trim().slice(0, 80) || expert.display_name,
    human_comment: comment,
    responded_at: now
  };
}

export async function listHumanExpertCommentsForRecord(env: Env, recordId: string): Promise<ExpertDutyRow[]> {
  try {
    await env.CORE_DB.prepare(EXPERT_DUTY_QUEUE_CREATE_SQL).run();
    const res = await env.CORE_DB.prepare(
      `SELECT * FROM expert_duty_queue
       WHERE record_id = ?1 AND status = 'answered' AND human_comment <> ''
       ORDER BY responded_at DESC`
    ).bind(recordId).all<ExpertDutyRow>();
    return res.results ?? [];
  } catch {
    return [];
  }
}

export function renderHumanExpertCommentHtml(comments: ExpertDutyRow[]): string {
  if (!comments || comments.length === 0) return "";
  return `<section class="of-human-comment" data-human-expert-comments aria-label="人のコメント">
    <h2 style="margin:0 0 6px;font-size:1rem">人のコメント</h2>
    <ul style="margin:0;padding-left:18px;display:grid;gap:6px">
      ${comments.map((c) => `<li><strong>${escapeHtml(c.expert_name || "地域の目利き")}:</strong> ${escapeHtml(c.human_comment)}</li>`).join("")}
    </ul>
  </section>`;
}
