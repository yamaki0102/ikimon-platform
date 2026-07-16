import type { Pool } from "pg";
import { getPool } from "../db.js";
import { getSessionFromCookie } from "./authSession.js";
import { observationEventGuestCredentialDigestFromCookie } from "./observationEventGuestCredential.js";
import type { ObservationEventSessionRow } from "./observationEventModeManager.js";

export interface ObservationEventViewerAccess {
  participantId: string | null;
  userId: string | null;
  guestCredentialDigest: string | null;
  teamId: string | null;
  isOrganizer: boolean;
  isMinor: boolean;
}

export function isObservationEventCheckinOpen(
  session: Pick<ObservationEventSessionRow, "endedAt">,
  nowMs = Date.now(),
): boolean {
  if (!session.endedAt) return true;
  const endedAtMs = Date.parse(session.endedAt);
  return Number.isFinite(endedAtMs) && endedAtMs > nowMs;
}

export async function requireObservationEventViewerAccess(
  session: ObservationEventSessionRow,
  cookieHeader: string | undefined,
): Promise<ObservationEventViewerAccess | null> {
  const auth = await getSessionFromCookie(cookieHeader ?? "").catch(() => null);
  const userId = auth?.userId ?? null;
  const isOrganizer = userId !== null && userId === session.organizerUserId;
  // An authenticated request must use its account identity. The guest identity is
  // only available to anonymous requests and is explicitly promoted at check-in.
  const guestCredentialDigest = auth
    ? null
    : observationEventGuestCredentialDigestFromCookie(session.sessionId, cookieHeader);

  if (!userId && !guestCredentialDigest) return null;

  const result = await getPool().query<{
    participant_id: string;
    user_id: string | null;
    team_id: string | null;
    is_minor: boolean;
  }>(
    `SELECT participant_id, user_id, team_id, is_minor
       FROM observation_event_participants
      WHERE session_id = $1
        AND (
          (user_id IS NOT NULL AND user_id = $2)
          OR (user_id IS NULL AND guest_token IS NOT NULL AND guest_token = $3)
        )
      ORDER BY CASE WHEN user_id = $2 THEN 0 ELSE 1 END
      LIMIT 1`,
    [session.sessionId, userId, guestCredentialDigest],
  );
  const row = result.rows[0];
  if (!isOrganizer && !row) return null;

  return {
    participantId: row?.participant_id ?? null,
    userId,
    guestCredentialDigest: row?.user_id ? null : guestCredentialDigest,
    teamId: row?.team_id ?? null,
    isOrganizer,
    isMinor: row?.is_minor ?? false,
  };
}

export interface ObservationEventGuestPromotionResult {
  participantId: string | null;
  promoted: boolean;
  mergedIntoExistingParticipant: boolean;
}

/**
 * Promote one event-scoped guest identity to an authenticated account.
 *
 * Attribution migration and participant de-duplication are one transaction so
 * recap never observes a half-promoted identity.
 */
export async function promoteObservationEventGuestIdentity(
  input: { sessionId: string; userId: string; guestCredentialDigest: string },
  pool: Pick<Pool, "connect"> = getPool(),
): Promise<ObservationEventGuestPromotionResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const guestResult = await client.query<{ participant_id: string; user_id: string | null }>(
      `SELECT participant_id, user_id
         FROM observation_event_participants
        WHERE session_id = $1
          AND guest_token = $2
          AND (user_id IS NULL OR user_id = $3)
        FOR UPDATE`,
      [input.sessionId, input.guestCredentialDigest, input.userId],
    );
    const guestParticipantId = guestResult.rows[0]?.participant_id ?? null;

    const accountResult = await client.query<{ participant_id: string }>(
      `SELECT participant_id
         FROM observation_event_participants
        WHERE session_id = $1
          AND user_id = $2
        FOR UPDATE`,
      [input.sessionId, input.userId],
    );
    const accountParticipantId = accountResult.rows[0]?.participant_id ?? null;

    if (!guestParticipantId) {
      await client.query("COMMIT");
      return {
        participantId: accountParticipantId,
        promoted: false,
        mergedIntoExistingParticipant: false,
      };
    }

    await client.query(
      `UPDATE observation_event_live_events
          SET actor_user_id = CASE WHEN actor_guest_token = $2 THEN $3 ELSE actor_user_id END,
              actor_guest_token = CASE WHEN actor_guest_token = $2 THEN NULL ELSE actor_guest_token END,
              payload = CASE
                WHEN payload->>'target_guest_token' = $2
                  THEN (payload - 'target_guest_token') || jsonb_build_object('target_user_id', $3)
                ELSE payload
              END
        WHERE session_id = $1
          AND (
            actor_guest_token = $2
            OR payload->>'target_guest_token' = $2
          )`,
      [input.sessionId, input.guestCredentialDigest, input.userId],
    );
    await client.query(
      `UPDATE observation_event_absences
          SET user_id = $3, guest_token = NULL
        WHERE session_id = $1 AND guest_token = $2`,
      [input.sessionId, input.guestCredentialDigest, input.userId],
    );
    // Avoid violating the retry-idempotency index when the same source was
    // already attributed to the authenticated account.
    await client.query(
      `DELETE FROM observation_rally_submissions guest
        USING observation_rally_submissions account
        WHERE guest.session_id = $1
          AND guest.guest_token = $2
          AND account.session_id = $1
          AND account.user_id = $3
          AND guest.source_ref IS NOT NULL
          AND BTRIM(guest.source_ref) <> ''
          AND account.mission_id = guest.mission_id
          AND account.source_type = guest.source_type
          AND account.source_ref = guest.source_ref`,
      [input.sessionId, input.guestCredentialDigest, input.userId],
    );
    await client.query(
      `UPDATE observation_rally_submissions
          SET user_id = $3, guest_token = NULL
        WHERE session_id = $1 AND guest_token = $2`,
      [input.sessionId, input.guestCredentialDigest, input.userId],
    );
    await client.query(
      `UPDATE observation_event_recap_views
          SET user_id = $3, guest_token = NULL
        WHERE session_id = $1 AND guest_token = $2`,
      [input.sessionId, input.guestCredentialDigest, input.userId],
    );

    let participantId = guestParticipantId;
    if (accountParticipantId && accountParticipantId !== guestParticipantId) {
      await client.query(
        `UPDATE observation_event_participants account
            SET display_name = COALESCE(NULLIF(account.display_name, ''), guest.display_name),
                team_id = COALESCE(account.team_id, guest.team_id),
                declared_job = COALESCE(account.declared_job, guest.declared_job)
           FROM observation_event_participants guest
          WHERE account.participant_id = $1
            AND guest.participant_id = $2`,
        [accountParticipantId, guestParticipantId],
      );
      await client.query(
        `DELETE FROM observation_event_participants
          WHERE participant_id = $1
            AND session_id = $2
            AND user_id IS NULL
            AND guest_token = $3`,
        [guestParticipantId, input.sessionId, input.guestCredentialDigest],
      );
      participantId = accountParticipantId;
    } else {
      await client.query(
        `UPDATE observation_event_participants
            SET user_id = $3, guest_token = NULL
          WHERE participant_id = $1
            AND session_id = $2
            AND (user_id IS NULL OR user_id = $3)`,
        [guestParticipantId, input.sessionId, input.userId],
      );
    }

    await client.query("COMMIT");
    return {
      participantId,
      promoted: true,
      mergedIntoExistingParticipant: accountParticipantId !== null && accountParticipantId !== guestParticipantId,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
