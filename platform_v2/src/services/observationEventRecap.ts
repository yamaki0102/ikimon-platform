import { getPool } from "../db.js";
import { summarizeSessionEffort, type SessionEffortSummary } from "./observationEventEffort.js";
import { getSessionById, type ObservationEventSessionRow } from "./observationEventModeManager.js";

/**
 * 事後振り返り(Post-Event Recap)集計。
 *
 * 既存 observation_event_live_events テーブルがそのまま時系列再生のデータソースになる。
 * 公開版(誰でも閲覧)/参加者版(自分の貢献詳細)/班版/マップ再生用 を 1 ロード可能にする。
 */

export interface RecapHighlights {
  observationCount: number;
  uniqueSpeciesCount: number;
  absencesCount: number;
  participantsCount: number;
  questsOffered: number;
  questsAccepted: number;
  questsCompleted: number;
  fanfareCount: number;
  totalEffortPersonHours: number;
  meshCoveragePct: number;
  topTaxa: Array<{ name: string; count: number }>;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
}

export interface RecapTeamSummary {
  teamId: string;
  name: string;
  color: string;
  memberCount: number;
  observationsCount: number;
  uniqueSpeciesCount: number;
  absencesCount: number;
  questsAccepted: number;
}

export interface RecapTimelineEntry {
  liveEventId: string;
  type: string;
  scope: string;
  teamId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface RecapImpactRecord {
  impactId: string;
  impactType: string;
  description: string;
  externalRef: string | null;
  recordedAt: string;
}

export interface ObservationEventRecap {
  session: ObservationEventSessionRow;
  highlights: RecapHighlights;
  effort: SessionEffortSummary;
  teams: RecapTeamSummary[];
  timeline: RecapTimelineEntry[];
  impacts: RecapImpactRecord[];
  myContribution: ParticipantContribution | null;
}

export interface ParticipantContribution {
  participantId: string | null;
  displayName: string | null;
  teamId: string | null;
  observationsCount: number;
  uniqueSpeciesCount: number;
  absencesCount: number;
  questsAccepted: number;
  recentTaxa: string[];
}

export async function buildRecap(
  sessionId: string,
  options: { viewerUserId?: string | null; viewerGuestToken?: string | null; timelineLimit?: number } = {},
): Promise<ObservationEventRecap | null> {
  const session = await getSessionById(sessionId);
  if (!session) return null;

  const pool = getPool();
  const timelineLimit = Math.max(20, Math.min(500, options.timelineLimit ?? 200));

  const targetCells = Number((session.config as Record<string, unknown>).coverage_target_cells ?? 100);
  const [
    highlightsRow,
    topTaxaResult,
    teamsResult,
    timelineResult,
    impactsResult,
    effort,
  ] = await Promise.all([
    pool.query<{
      obs_count: string;
      species_count: string;
      absence_count: string;
      participants: string;
      quests_offered: string;
      quests_accepted: string;
      quests_completed: string;
      fanfare_count: string;
    }>(
      `SELECT
         COALESCE((SELECT COUNT(*) FROM observation_event_live_events WHERE session_id = $1 AND type='observation_added'), 0)::text AS obs_count,
         COALESCE((SELECT COUNT(DISTINCT payload->>'taxon_name') FROM observation_event_live_events WHERE session_id = $1 AND type='observation_added' AND payload->>'taxon_name' IS NOT NULL), 0)::text AS species_count,
         COALESCE((SELECT COUNT(*) FROM observation_event_absences WHERE session_id = $1), 0)::text AS absence_count,
         COALESCE((SELECT COUNT(*) FROM observation_event_participants WHERE session_id = $1), 0)::text AS participants,
         COALESCE((SELECT COUNT(*) FROM observation_event_quests WHERE session_id = $1), 0)::text AS quests_offered,
         COALESCE((SELECT COUNT(*) FROM observation_event_quests WHERE session_id = $1 AND status IN ('accepted','completed')), 0)::text AS quests_accepted,
         COALESCE((SELECT COUNT(*) FROM observation_event_quests WHERE session_id = $1 AND status='completed'), 0)::text AS quests_completed,
         COALESCE((SELECT COUNT(*) FROM observation_event_live_events WHERE session_id = $1 AND type IN ('rare_species','target_hit','milestone','fanfare')), 0)::text AS fanfare_count`,
      [sessionId],
    ),
    pool.query<{ taxon_name: string; cnt: string }>(
      `SELECT payload->>'taxon_name' AS taxon_name, COUNT(*)::text AS cnt
       FROM observation_event_live_events
       WHERE session_id = $1
         AND type = 'observation_added'
         AND payload->>'taxon_name' IS NOT NULL
       GROUP BY payload->>'taxon_name'
       ORDER BY COUNT(*) DESC
       LIMIT 8`,
      [sessionId],
    ),
    pool.query<{
      team_id: string;
      name: string;
      color: string;
      member_count: string;
      obs_count: string;
      species_count: string;
      absence_count: string;
      quests_accepted: string;
    }>(
      `SELECT t.team_id, t.name, t.color,
              COALESCE((SELECT COUNT(*)::text FROM observation_event_participants p WHERE p.team_id = t.team_id), '0') AS member_count,
              COALESCE((SELECT COUNT(*)::text FROM observation_event_live_events e
                        WHERE e.session_id = t.session_id AND e.team_id = t.team_id AND e.type = 'observation_added'), '0') AS obs_count,
              COALESCE((SELECT COUNT(DISTINCT e.payload->>'taxon_name')::text FROM observation_event_live_events e
                        WHERE e.session_id = t.session_id AND e.team_id = t.team_id AND e.type = 'observation_added' AND e.payload->>'taxon_name' IS NOT NULL), '0') AS species_count,
              COALESCE((SELECT COUNT(*)::text FROM observation_event_absences a WHERE a.session_id = t.session_id AND a.team_id = t.team_id), '0') AS absence_count,
              COALESCE((SELECT COUNT(*)::text FROM observation_event_quests q WHERE q.session_id = t.session_id AND q.team_id = t.team_id AND q.status IN ('accepted','completed')), '0') AS quests_accepted
       FROM observation_event_teams t
       WHERE t.session_id = $1
       ORDER BY t.created_at`,
      [sessionId],
    ),
    pool.query<{
      live_event_id: string;
      type: string;
      scope: string;
      team_id: string | null;
      payload: Record<string, unknown>;
      created_at: string;
    }>(
      `SELECT live_event_id, type, scope, team_id, payload, created_at::text AS created_at
       FROM observation_event_live_events
       WHERE session_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [sessionId, timelineLimit],
    ),
    pool.query<{
      impact_id: string;
      impact_type: string;
      description: string;
      external_ref: string | null;
      recorded_at: string;
    }>(
      `SELECT impact_id, impact_type, description, external_ref, recorded_at::text AS recorded_at
       FROM observation_impact_records
       WHERE session_id = $1
       ORDER BY recorded_at DESC
       LIMIT 50`,
      [sessionId],
    ),
    summarizeSessionEffort(sessionId, Number.isFinite(targetCells) && targetCells > 0 ? targetCells : 100),
  ]);

  const h = highlightsRow.rows[0];
  const startedAt = session.startedAt;
  const endedAt = session.endedAt;
  const durationMinutes = (() => {
    const start = Date.parse(startedAt);
    const end = endedAt ? Date.parse(endedAt) : Date.now();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    return Math.max(0, Math.round((end - start) / 60000));
  })();

  const highlights: RecapHighlights = {
    observationCount: Number(h?.obs_count ?? 0),
    uniqueSpeciesCount: Number(h?.species_count ?? 0),
    absencesCount: Number(h?.absence_count ?? 0),
    participantsCount: Number(h?.participants ?? 0),
    questsOffered: Number(h?.quests_offered ?? 0),
    questsAccepted: Number(h?.quests_accepted ?? 0),
    questsCompleted: Number(h?.quests_completed ?? 0),
    fanfareCount: Number(h?.fanfare_count ?? 0),
    totalEffortPersonHours: effort.totalEffortPersonHours,
    meshCoveragePct: effort.coveragePct,
    topTaxa: topTaxaResult.rows.map((r) => ({ name: r.taxon_name, count: Number(r.cnt) })),
    startedAt,
    endedAt,
    durationMinutes,
  };

  const teams: RecapTeamSummary[] = teamsResult.rows.map((r) => ({
    teamId: r.team_id,
    name: r.name,
    color: r.color,
    memberCount: Number(r.member_count),
    observationsCount: Number(r.obs_count),
    uniqueSpeciesCount: Number(r.species_count),
    absencesCount: Number(r.absence_count),
    questsAccepted: Number(r.quests_accepted),
  }));

  const timeline: RecapTimelineEntry[] = timelineResult.rows.map((r) => ({
    liveEventId: r.live_event_id,
    type: r.type,
    scope: r.scope,
    teamId: r.team_id,
    payload: r.payload ?? {},
    createdAt: r.created_at,
  }));

  const impacts: RecapImpactRecord[] = impactsResult.rows.map((r) => ({
    impactId: r.impact_id,
    impactType: r.impact_type,
    description: r.description,
    externalRef: r.external_ref,
    recordedAt: r.recorded_at,
  }));

  let myContribution: ParticipantContribution | null = null;
  if (options.viewerUserId || options.viewerGuestToken) {
    myContribution = await buildContribution(sessionId, {
      userId: options.viewerUserId ?? null,
      guestToken: options.viewerGuestToken ?? null,
    });
  }

  // record audit view
  if (options.viewerUserId || options.viewerGuestToken) {
    void pool.query(
      `INSERT INTO observation_event_recap_views (session_id, user_id, guest_token, view_type)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, options.viewerUserId ?? null, options.viewerGuestToken ?? null, "personal"],
    ).catch(() => undefined);
  } else {
    void pool.query(
      `INSERT INTO observation_event_recap_views (session_id, view_type) VALUES ($1, 'public')`,
      [sessionId],
    ).catch(() => undefined);
  }

  return {
    session,
    highlights,
    effort,
    teams,
    timeline,
    impacts,
    myContribution,
  };
}

async function buildContribution(
  sessionId: string,
  viewer: { userId: string | null; guestToken: string | null },
): Promise<ParticipantContribution | null> {
  const pool = getPool();
  const participantResult = await pool.query<{
    participant_id: string;
    display_name: string;
    team_id: string | null;
  }>(
    `SELECT participant_id, display_name, team_id
     FROM observation_event_participants
     WHERE session_id = $1
       AND (
         (user_id IS NOT NULL AND user_id = $2)
         OR (guest_token IS NOT NULL AND guest_token = $3)
       )
     LIMIT 1`,
    [sessionId, viewer.userId, viewer.guestToken],
  );
  const participant = participantResult.rows[0] ?? null;

  const [obsRow, absenceRow, questRow, recentRow] = await Promise.all([
    pool.query<{ obs_count: string; species_count: string }>(
      `SELECT
         COUNT(*)::text AS obs_count,
         COUNT(DISTINCT payload->>'taxon_name')::text AS species_count
       FROM observation_event_live_events
       WHERE session_id = $1 AND type='observation_added'
         AND (
           (actor_user_id IS NOT NULL AND actor_user_id = $2)
           OR (actor_guest_token IS NOT NULL AND actor_guest_token = $3)
         )`,
      [sessionId, viewer.userId, viewer.guestToken],
    ),
    pool.query<{ absence_count: string }>(
      `SELECT COUNT(*)::text AS absence_count
       FROM observation_event_absences
       WHERE session_id = $1
         AND (
           (user_id IS NOT NULL AND user_id = $2)
           OR (guest_token IS NOT NULL AND guest_token = $3)
         )`,
      [sessionId, viewer.userId, viewer.guestToken],
    ),
    pool.query<{ quests_accepted: string }>(
      `SELECT COUNT(*)::text AS quests_accepted
       FROM observation_event_quests q
       WHERE q.session_id = $1
         AND q.decided_by = $2
         AND q.status IN ('accepted','completed')`,
      [sessionId, viewer.userId],
    ),
    pool.query<{ taxon_name: string }>(
      `SELECT DISTINCT payload->>'taxon_name' AS taxon_name
       FROM observation_event_live_events
       WHERE session_id = $1 AND type='observation_added'
         AND payload->>'taxon_name' IS NOT NULL
         AND (
           (actor_user_id IS NOT NULL AND actor_user_id = $2)
           OR (actor_guest_token IS NOT NULL AND actor_guest_token = $3)
         )
       ORDER BY taxon_name
       LIMIT 12`,
      [sessionId, viewer.userId, viewer.guestToken],
    ),
  ]);

  const obs = obsRow.rows[0];
  const abs = absenceRow.rows[0];
  const qst = questRow.rows[0];
  return {
    participantId: participant?.participant_id ?? null,
    displayName: participant?.display_name ?? null,
    teamId: participant?.team_id ?? null,
    observationsCount: Number(obs?.obs_count ?? 0),
    uniqueSpeciesCount: Number(obs?.species_count ?? 0),
    absencesCount: Number(abs?.absence_count ?? 0),
    questsAccepted: Number(qst?.quests_accepted ?? 0),
    recentTaxa: recentRow.rows.map((r) => r.taxon_name).filter(Boolean),
  };
}
