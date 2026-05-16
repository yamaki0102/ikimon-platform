import type { PoolClient } from "pg";
import { getPool } from "../db.js";
import {
  createRallyMission,
  createRallyStation,
  ensureRallyCourse,
  recordRallySubmission,
  type RallyMission,
  type RallyStation,
} from "./observationRally.js";
import { cleanupStagingFixtures } from "./stagingFixtureCleanup.js";

const FIXTURE_PREFIX_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,80}$/;

type RallyFixtureSeedInput = {
  fixturePrefix: string;
};

export type StagingRallyFixtureSeedResult = {
  fixturePrefix: string;
  user: {
    userId: string;
    displayName: string;
  };
  session: {
    sessionId: string;
    eventCode: string;
    title: string;
  };
  station: RallyStation;
  missions: {
    open: RallyMission;
    sunnyStation: RallyMission;
    rainFallback: RallyMission;
  };
  progress: {
    actualCount: number;
    goalCount: number;
    percent: number;
  };
};

function assertFixturePrefix(value: string): string {
  const fixturePrefix = value.trim();
  if (!FIXTURE_PREFIX_PATTERN.test(fixturePrefix)) {
    throw new Error("invalid_fixture_prefix");
  }
  return fixturePrefix;
}

function toEventCode(fixturePrefix: string): string {
  return fixturePrefix.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 48);
}

async function upsertFixtureUser(
  client: PoolClient,
  userId: string,
  displayName: string,
): Promise<void> {
  await client.query(
    `insert into users (
        user_id, legacy_user_id, display_name, email, password_hash, avatar_asset_id,
        role_name, rank_label, auth_provider, oauth_id, banned, created_at, updated_at
     ) values (
        $1, $2, $3, $4, null, null, 'Organizer', '主催者', 'staging_rally', null, false, now(), now()
     )
     on conflict (user_id) do update set
        display_name = excluded.display_name,
        email = excluded.email,
        role_name = excluded.role_name,
        rank_label = excluded.rank_label,
        auth_provider = excluded.auth_provider,
        banned = false,
        updated_at = now()`,
    [userId, userId, displayName, `${userId}@example.invalid`],
  );
}

async function seedEventSession(input: {
  fixturePrefix: string;
  organizerUserId: string;
  eventCode: string;
  title: string;
}): Promise<string> {
  const pool = getPool();
  const result = await pool.query<{ session_id: string }>(
    `insert into observation_event_sessions (
        event_code, title, organizer_user_id, plan, primary_mode, active_modes,
        location_lat, location_lng, location_radius_m, started_at, ended_at,
        target_species, config, created_at, updated_at
     ) values (
        $1, $2, $3, 'community', 'discovery', ARRAY['discovery', 'absence_confirm']::text[],
        35.6812, 139.7671, 900, now() - interval '10 minutes', null,
        ARRAY['街路樹', '落ち葉']::text[], $4::jsonb, now(), now()
     )
     returning session_id::text as session_id`,
    [
      input.eventCode,
      input.title,
      input.organizerUserId,
      JSON.stringify({
        source: "rally_smoke_fixture",
        fixturePrefix: input.fixturePrefix,
        fixture_prefix: input.fixturePrefix,
      }),
    ],
  );
  const sessionId = result.rows[0]?.session_id;
  if (!sessionId) throw new Error("failed_to_seed_rally_session");
  return sessionId;
}

async function addOrganizerParticipant(input: {
  sessionId: string;
  organizerUserId: string;
  displayName: string;
}): Promise<void> {
  await getPool().query(
    `insert into observation_event_participants (
        session_id, user_id, display_name, role, status, checked_in_at,
        share_location, is_minor, location_share_started_at, location_share_until,
        location_share_consent_type, last_ping_at, last_lat, last_lng
     ) values (
        $1::uuid, $2, $3, 'organizer', 'checked_in', now(),
        true, false, now(), now() + interval '2 hours',
        'self', now(), 35.6812, 139.7671
     )
     on conflict (session_id, user_id) where user_id is not null do update set
        display_name = excluded.display_name,
        role = excluded.role,
        status = excluded.status,
        checked_in_at = excluded.checked_in_at,
        share_location = excluded.share_location,
        is_minor = excluded.is_minor,
        location_share_started_at = excluded.location_share_started_at,
        location_share_until = excluded.location_share_until,
        location_share_consent_type = excluded.location_share_consent_type,
        last_ping_at = excluded.last_ping_at,
        last_lat = excluded.last_lat,
        last_lng = excluded.last_lng`,
    [input.sessionId, input.organizerUserId, input.displayName],
  );
}

export async function seedStagingRallyFixtures(
  input: RallyFixtureSeedInput,
): Promise<StagingRallyFixtureSeedResult> {
  const fixturePrefix = assertFixturePrefix(input.fixturePrefix);
  await cleanupStagingFixtures({ fixturePrefix, removeFiles: false });

  const pool = getPool();
  const client = await pool.connect();
  const userId = `${fixturePrefix}-organizer`;
  const displayName = "Rally Smoke Organizer";
  const eventCode = toEventCode(fixturePrefix);
  const title = `観察ラリー smoke ${fixturePrefix}`;

  try {
    await client.query("begin");
    await upsertFixtureUser(client, userId, displayName);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  const sessionId = await seedEventSession({ fixturePrefix, organizerUserId: userId, eventCode, title });
  await addOrganizerParticipant({ sessionId, organizerUserId: userId, displayName });

  const station = await createRallyStation({
    sessionId,
    actorUserId: userId,
    station: {
      code: "A",
      name: "A地点",
      description: "テスト用の駅前街路樹ポイント",
      lat: 35.6812,
      lng: 139.7671,
      radiusM: 60,
      isPrivate: false,
      accessNote: "歩道から観察する",
      dangerNote: "車道に出ない",
      sortOrder: 1,
    },
  });

  const openMission = await createRallyMission({
    sessionId,
    actorUserId: userId,
    mission: {
      scope: "event",
      locationBinding: "none",
      title: "開催時間内に街路樹シーンを20件",
      target: "街路樹",
      countUnit: "scene",
      goalCount: 20,
      weatherSensitivity: "all_weather",
      fallbackGroup: "",
      status: "published",
      sortOrder: 1,
    },
  });

  const sunnyStation = await createRallyMission({
    sessionId,
    actorUserId: userId,
    mission: {
      stationId: station.stationId,
      scope: "station",
      locationBinding: "station_required",
      title: "A地点で樹皮が見える街路樹シーンを3件",
      target: "樹皮が見える街路樹",
      countUnit: "scene",
      goalCount: 3,
      weatherSensitivity: "sunny_only",
      fallbackGroup: "tree-bark",
      status: "published",
      sortOrder: 2,
    },
  });

  const rainFallback = await createRallyMission({
    sessionId,
    actorUserId: userId,
    mission: {
      scope: "event",
      locationBinding: "any_registered_station",
      title: "雨天: 登録スポットで落ち葉シーンを3件",
      target: "落ち葉",
      countUnit: "scene",
      goalCount: 3,
      weatherSensitivity: "rain_ok",
      fallbackGroup: "tree-bark",
      status: "draft",
      sortOrder: 3,
    },
  });

  const submissionResult = await recordRallySubmission({
    sessionId,
    missionId: openMission.missionId,
    userId,
    guestToken: null,
    countValue: 42,
    sourceType: "staging_rally_smoke",
    sourceRef: `${fixturePrefix}-tree-scenes`,
    lat: 35.6812,
    lng: 139.7671,
    payload: {
      source: "rally_smoke_fixture",
      fixturePrefix,
      note: "42 scenes against a goal of 20 verifies 200%+ progress.",
    },
  });

  await ensureRallyCourse({
    sessionId,
    title: "観察ラリー",
    status: "live",
    actorUserId: userId,
    config: {
      source: "rally_smoke_fixture",
      fixturePrefix,
      fixture_prefix: fixturePrefix,
    },
  });

  return {
    fixturePrefix,
    user: {
      userId,
      displayName,
    },
    session: {
      sessionId,
      eventCode,
      title,
    },
    station,
    missions: {
      open: openMission,
      sunnyStation,
      rainFallback,
    },
    progress: {
      actualCount: submissionResult.progress?.actualCount ?? 42,
      goalCount: submissionResult.progress?.goalCount ?? 20,
      percent: submissionResult.progress?.percent ?? 210,
    },
  };
}
