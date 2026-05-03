/**
 * Field-level manager / steward role lookup (Phase 2).
 *
 * Wraps the `field_managers` table introduced in migration 0081. Powers the
 * "this user has authorisation for the exact coords of this area" gate in
 * sensitiveSpeciesMasking.
 *
 * Roles:
 *   - owner       — 認定地そのものの主体 (例: 自然共生サイトの運営法人)
 *   - steward     — モニタリング担当の調査員
 *   - viewer_exact — 学術機関や行政連携の読み取り専用権限
 */
import { getPool } from "../db.js";

export type FieldManagerRole = "owner" | "steward" | "viewer_exact";

export interface FieldManagerGrant {
  managerId: string;
  fieldId: string;
  userId: string;
  role: FieldManagerRole;
  grantedAt: string;
  grantedBy: string | null;
  expiresAt: string | null;
  note: string;
}

interface RawRow extends Record<string, unknown> {
  manager_id: string;
  field_id: string;
  user_id: string;
  role: string;
  granted_at: string;
  granted_by: string | null;
  expires_at: string | null;
  note: string;
}

const ACTIVE_FILTER = "AND (expires_at IS NULL OR expires_at > NOW())";

function isFieldManagerRole(value: unknown): value is FieldManagerRole {
  return value === "owner" || value === "steward" || value === "viewer_exact";
}

function mapRow(row: RawRow): FieldManagerGrant {
  return {
    managerId: row.manager_id,
    fieldId: row.field_id,
    userId: row.user_id,
    role: isFieldManagerRole(row.role) ? row.role : "viewer_exact",
    grantedAt: row.granted_at,
    grantedBy: row.granted_by,
    expiresAt: row.expires_at,
    note: row.note ?? "",
  };
}

/**
 * Returns the strongest active role the user holds on this field, or null
 * when no grant exists. Caller can short-circuit privileged behaviour by
 * checking against `null`.
 */
export async function getFieldManagerRole(
  userId: string | null | undefined,
  fieldId: string,
): Promise<FieldManagerRole | null> {
  if (!userId || !fieldId) return null;
  const result = await getPool().query<{ role: string }>(
    `SELECT role FROM field_managers
      WHERE user_id = $1 AND field_id = $2
        ${ACTIVE_FILTER}
      ORDER BY CASE role
        WHEN 'owner' THEN 0
        WHEN 'steward' THEN 1
        WHEN 'viewer_exact' THEN 2
        ELSE 3 END
      LIMIT 1`,
    [userId, fieldId],
  );
  const row = result.rows[0];
  if (!row || !isFieldManagerRole(row.role)) return null;
  return row.role;
}

export async function listManagersForField(fieldId: string): Promise<FieldManagerGrant[]> {
  const result = await getPool().query<RawRow>(
    `SELECT manager_id, field_id, user_id, role,
            granted_at::text AS granted_at,
            granted_by,
            expires_at::text AS expires_at,
            note
       FROM field_managers
      WHERE field_id = $1 ${ACTIVE_FILTER}
      ORDER BY granted_at DESC`,
    [fieldId],
  );
  return result.rows.map(mapRow);
}

export async function listFieldsForManager(userId: string): Promise<FieldManagerGrant[]> {
  if (!userId) return [];
  const result = await getPool().query<RawRow>(
    `SELECT manager_id, field_id, user_id, role,
            granted_at::text AS granted_at,
            granted_by,
            expires_at::text AS expires_at,
            note
       FROM field_managers
      WHERE user_id = $1 ${ACTIVE_FILTER}
      ORDER BY granted_at DESC`,
    [userId],
  );
  return result.rows.map(mapRow);
}

export interface GrantFieldManagerInput {
  fieldId: string;
  userId: string;
  role: FieldManagerRole;
  grantedBy?: string | null;
  expiresAt?: string | null;
  note?: string;
}

export async function grantFieldManager(input: GrantFieldManagerInput): Promise<FieldManagerGrant> {
  const result = await getPool().query<RawRow>(
    `INSERT INTO field_managers (field_id, user_id, role, granted_by, expires_at, note)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (field_id, user_id, role)
     DO UPDATE SET
       granted_at = NOW(),
       granted_by = COALESCE(EXCLUDED.granted_by, field_managers.granted_by),
       expires_at = EXCLUDED.expires_at,
       note       = EXCLUDED.note
     RETURNING manager_id, field_id, user_id, role,
               granted_at::text AS granted_at,
               granted_by,
               expires_at::text AS expires_at,
               note`,
    [
      input.fieldId,
      input.userId,
      input.role,
      input.grantedBy ?? null,
      input.expiresAt ?? null,
      input.note ?? "",
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("failed to grant field manager");
  return mapRow(row);
}

export async function revokeFieldManager(fieldId: string, userId: string, role: FieldManagerRole): Promise<void> {
  await getPool().query(
    `DELETE FROM field_managers WHERE field_id = $1 AND user_id = $2 AND role = $3`,
    [fieldId, userId, role],
  );
}

export const __test__ = { isFieldManagerRole };
