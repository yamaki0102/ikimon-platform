/**
 * Centralized logic for resolving the "viewer" user id on read routes.
 *
 * Security model:
 *  - Authenticated session (cookie) is the only trusted source of identity in production.
 *  - A `?userId=...` query-string override is accepted ONLY when:
 *      (a) `ALLOW_QUERY_USER_ID=1` env is set (staging/QA opt-in), OR
 *      (b) the caller's session user id already matches the query userId
 *          (harmless self-identification).
 *  - Without those conditions, `?userId=` is ignored — the session userId wins,
 *    or the viewer is treated as anonymous.
 *
 * This closes the IDOR that existed while `queryUserId || session?.userId` was the
 * resolution rule. On production (where basic auth does not gate the site), passing
 * another user's id would expose their private notebook: recent places, identifications,
 * and observation timeline.
 *
 * See: docs/architecture/ikimon_v2_final_cutover_runbook_2026-04-15.md Step 0.
 */

export type ViewerResolution = {
  /** The resolved user id to drive read queries, or null if anonymous. */
  viewerUserId: string | null;
  /** The raw userId extracted from the query, for logging / debug only. */
  requestedUserId: string;
  /** True when a query-string override was honored. */
  queryOverrideHonored: boolean;
};

export type SessionLike = {
  userId: string;
} | null | undefined;

export function readQueryUserId(query: unknown): string {
  if (typeof query !== "object" || query === null) {
    return "";
  }
  const raw = (query as Record<string, unknown>).userId;
  if (typeof raw === "string") {
    return raw.trim();
  }
  if (Array.isArray(raw) && typeof raw[0] === "string") {
    return raw[0].trim();
  }
  return "";
}

function queryOverrideAllowed(session: SessionLike, requestedUserId: string): boolean {
  if (!requestedUserId) {
    return false;
  }
  // Explicit staging opt-in.
  if (process.env.ALLOW_QUERY_USER_ID === "1") {
    return true;
  }
  // Self-identification: the user may spell out their own id in the query.
  if (session?.userId && session.userId === requestedUserId) {
    return true;
  }
  return false;
}

export function resolveViewer(query: unknown, session: SessionLike): ViewerResolution {
  const requestedUserId = readQueryUserId(query);
  const honored = queryOverrideAllowed(session, requestedUserId);
  const viewerUserId = honored ? requestedUserId : session?.userId ?? null;
  return {
    viewerUserId,
    requestedUserId,
    queryOverrideHonored: honored,
  };
}
