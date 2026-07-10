from pathlib import Path

runtime_path = Path("platform_v2/cloudflare_shadow/src/index.ts")
test_path = Path("platform_v2/cloudflare_shadow/src/index.test.ts")
boundary_path = Path("platform_v2/cloudflare_shadow/scripts/d1-migration-boundary-report.mjs")

runtime = runtime_path.read_text(encoding="utf-8")

helper_marker = "async function handleObservationEventRallyApi(request: Request, env: Env, sessionId: string, pathRemainder: string): Promise<Response> {\n"
helper_code = r'''interface ObservationRallyAutoMatchCandidateD1Row extends ObservationRallyMissionD1Row {
  session_id: string;
  matched_station_id: string;
  station_lat: number;
  station_lng: number;
  station_radius_m: number;
}

const RALLY_EARTH_RADIUS_M = 6_371_000;

function observationRallyDistanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const toRadians = (value: number) => value * Math.PI / 180;
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const a = sinLat * sinLat + Math.cos(fromLat) * Math.cos(toLat) * sinLng * sinLng;
  const bounded = Math.min(1, Math.max(0, a));
  return 2 * RALLY_EARTH_RADIUS_M * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded));
}

async function autoMatchObservationToActiveRalliesNative(
  env: Env,
  input: {
    userId: string;
    visitId: string;
    occurrenceId: string;
    lat: number;
    lng: number;
    observedAt: string;
  }
): Promise<{ matchedCandidates: number; createdSubmissions: number }> {
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    return { matchedCandidates: 0, createdSubmissions: 0 };
  }

  const candidates = await env.OBS_DB.prepare(
    `SELECT
       course.session_id AS session_id,
       course.course_id AS course_id,
       mission.mission_id AS mission_id,
       mission.course_id AS mission_course_id,
       mission.station_id AS station_id,
       mission.replacement_for_mission_id AS replacement_for_mission_id,
       mission.scope AS scope,
       mission.location_binding AS location_binding,
       mission.title AS title,
       mission.target AS target,
       mission.count_unit AS count_unit,
       mission.goal_count AS goal_count,
       mission.counting_policy_json AS counting_policy_json,
       mission.verification_policy AS verification_policy,
       mission.weather_sensitivity AS weather_sensitivity,
       mission.fallback_group AS fallback_group,
       mission.status AS status,
       mission.starts_at AS starts_at,
       mission.ends_at AS ends_at,
       mission.sort_order AS sort_order,
       mission.created_by AS created_by,
       mission.created_at AS created_at,
       mission.updated_at AS updated_at,
       station.station_id AS matched_station_id,
       station.lat AS station_lat,
       station.lng AS station_lng,
       station.radius_m AS station_radius_m
     FROM observation_rally_courses course
     JOIN observation_event_sessions event_session
       ON event_session.session_id = course.session_id
     JOIN observation_rally_missions mission
       ON mission.course_id = course.course_id
     JOIN observation_rally_stations station
       ON station.course_id = course.course_id
      AND (
        mission.station_id = station.station_id
        OR (mission.location_binding = 'any_registered_station' AND mission.station_id IS NULL)
      )
     WHERE course.status = 'live'
       AND mission.status = 'published'
       AND station.status = 'open'
       AND mission.location_binding IN ('station_required', 'any_registered_station')
       AND station.lat IS NOT NULL
       AND station.lng IS NOT NULL
       AND station.radius_m IS NOT NULL
       AND station.radius_m > 0
       AND datetime(event_session.started_at) <= datetime(?)
       AND (event_session.ended_at IS NULL OR datetime(event_session.ended_at) >= datetime(?))
       AND (mission.starts_at IS NULL OR datetime(mission.starts_at) <= datetime(?))
       AND (mission.ends_at IS NULL OR datetime(mission.ends_at) >= datetime(?))
     ORDER BY mission.sort_order ASC, station.sort_order ASC, station.created_at ASC
     LIMIT 500`
  ).bind(input.observedAt, input.observedAt, input.observedAt, input.observedAt).all<ObservationRallyAutoMatchCandidateD1Row>();

  let matchedCandidates = 0;
  let createdSubmissions = 0;

  for (const candidate of candidates.results) {
    const stationLat = Number(candidate.station_lat);
    const stationLng = Number(candidate.station_lng);
    const radiusM = Number(candidate.station_radius_m);
    if (!Number.isFinite(stationLat) || !Number.isFinite(stationLng) || !Number.isFinite(radiusM) || radiusM <= 0) continue;

    const distanceM = observationRallyDistanceMeters(
      { lat: input.lat, lng: input.lng },
      { lat: stationLat, lng: stationLng }
    );
    if (!Number.isFinite(distanceM) || distanceM > radiusM) continue;
    matchedCandidates += 1;

    const existing = await env.OBS_DB.prepare(
      `SELECT submission_id
         FROM observation_rally_submissions
        WHERE mission_id = ?
          AND source_type = 'observation_auto_match'
          AND source_ref = ?
          AND IFNULL(user_id, '') = ?
          AND IFNULL(guest_token, '') = ''
        LIMIT 1`
    ).bind(candidate.mission_id, input.visitId, input.userId).first<{ submission_id: string }>();
    if (existing) continue;

    const submissionId = crypto.randomUUID();
    const reviewStatus = candidate.verification_policy === "auto" ? "auto_accepted" : "pending";
    const publicLat = roundPublicEventCoordinate(input.lat);
    const publicLng = roundPublicEventCoordinate(input.lng);
    const insertResult = await env.OBS_DB.prepare(
      `INSERT OR IGNORE INTO observation_rally_submissions (
         submission_id, session_id, course_id, mission_id, station_id, user_id, guest_token, team_id,
         source_type, source_ref, count_value, public_lat, public_lng, payload_json, review_status
       ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 'observation_auto_match', ?, 1, ?, ?, ?, ?)`
    ).bind(
      submissionId,
      candidate.session_id,
      candidate.course_id,
      candidate.mission_id,
      candidate.matched_station_id,
      input.userId,
      input.visitId,
      publicLat,
      publicLng,
      JSON.stringify({
        source: "observation_post_save_auto_match",
        visit_id: input.visitId,
        occurrence_id: input.occurrenceId,
        station_id: candidate.matched_station_id,
        distance_m: Math.round(distanceM * 100) / 100,
        radius_m: radiusM,
        observed_at: input.observedAt,
        exact_location_used: true,
        exact_location_stored: false
      }),
      reviewStatus
    ).run() as { meta?: { changes?: number } };
    if (Number(insertResult.meta?.changes ?? 1) === 0) continue;

    createdSubmissions += 1;
    if (reviewStatus === "auto_accepted") {
      await incrementObservationRallyProgress(env, candidate.course_id, candidate, {
        countValue: 1,
        teamId: null,
        userId: input.userId,
        guestToken: null,
        stationId: candidate.matched_station_id
      });
    }
    await appendObservationEventLive(env, {
      sessionId: candidate.session_id,
      type: "rally_task_submitted",
      scope: "all",
      actorUserId: input.userId,
      payload: {
        submission_id: submissionId,
        mission_id: candidate.mission_id,
        station_id: candidate.matched_station_id,
        visit_id: input.visitId,
        occurrence_id: input.occurrenceId,
        source_type: "observation_auto_match",
        review_status: reviewStatus,
        public_lat: publicLat,
        public_lng: publicLng,
        exact_location_stored: false
      }
    });
  }

  return { matchedCandidates, createdSubmissions };
}

'''
if "async function autoMatchObservationToActiveRalliesNative" not in runtime:
    if helper_marker not in runtime:
        raise RuntimeError("rally API marker not found")
    runtime = runtime.replace(helper_marker, helper_code + helper_marker, 1)

call_marker = '''  await hookLegacyObservationToEventNative(env, input, {
    visitId,
    occurrenceId,
    occurrenceIds,
    taxonLabel
  });
'''
call_code = '''  await autoMatchObservationToActiveRalliesNative(env, {
    userId: input.userId,
    visitId,
    occurrenceId,
    lat: input.latitude,
    lng: input.longitude,
    observedAt: input.observedAt
  }).catch((error) => {
    console.error("[observation-rally-auto-match] native post-save match failed", error);
  });

'''
if "[observation-rally-auto-match] native post-save match failed" not in runtime:
    if call_marker not in runtime:
        raise RuntimeError("observation event hook marker not found")
    runtime = runtime.replace(call_marker, call_code + call_marker, 1)

runtime_path.write_text(runtime, encoding="utf-8")

source = test_path.read_text(encoding="utf-8")

insert_handler_marker = '''    if (normalized.startsWith("INSERT INTO observation_rally_submissions")) {
'''
insert_ignore_handler = r'''    if (normalized.startsWith("INSERT OR IGNORE INTO observation_rally_submissions")) {
      const duplicate = [...this.db.observationRallySubmissions.values()].find((row) =>
        row.mission_id === string(v[3]) &&
        row.source_type === "observation_auto_match" &&
        row.source_ref === string(v[6]) &&
        row.user_id === string(v[5]) &&
        row.guest_token === null
      );
      if (duplicate) return { meta: { changes: 0 } };
      this.db.observationRallySubmissions.set(string(v[0]), {
        submission_id: string(v[0]),
        session_id: string(v[1]),
        course_id: string(v[2]),
        mission_id: string(v[3]),
        station_id: nullableString(v[4]),
        user_id: nullableString(v[5]),
        guest_token: null,
        team_id: null,
        source_type: "observation_auto_match",
        source_ref: nullableString(v[6]),
        count_value: 1,
        public_lat: nullableNumber(v[7]),
        public_lng: nullableNumber(v[8]),
        payload_json: string(v[9]),
        review_status: string(v[10]),
        reviewed_by: null,
        reviewed_at: null,
        created_at: new Date().toISOString()
      });
      return { meta: { changes: 1 } };
    }

'''
if "INSERT OR IGNORE INTO observation_rally_submissions" not in source:
    if insert_handler_marker not in source:
        raise RuntimeError("rally submission insert test handler not found")
    source = source.replace(insert_handler_marker, insert_ignore_handler + insert_handler_marker, 1)

first_marker = '''    if (normalized.startsWith("SELECT submission_id, session_id, course_id, mission_id")) {
'''
first_handler = r'''    if (normalized.startsWith("SELECT submission_id FROM observation_rally_submissions WHERE mission_id = ?")) {
      const row = [...this.db.observationRallySubmissions.values()].find((candidate) =>
        candidate.mission_id === string(v[0]) &&
        candidate.source_type === "observation_auto_match" &&
        candidate.source_ref === string(v[1]) &&
        candidate.user_id === string(v[2]) &&
        candidate.guest_token === null
      );
      return (row ? { submission_id: row.submission_id } : null) as T | null;
    }

'''
if "SELECT submission_id FROM observation_rally_submissions WHERE mission_id = ?" not in source:
    if first_marker not in source:
        raise RuntimeError("rally submission select test handler not found")
    source = source.replace(first_marker, first_handler + first_marker, 1)

all_marker = '''    if (normalized.startsWith("SELECT station_id, course_id, field_id, code, name")) {
'''
all_handler = r'''    if (normalized.startsWith("SELECT course.session_id AS session_id, course.course_id AS course_id, mission.mission_id AS mission_id")) {
      const observedAt = Date.parse(string(v[0]));
      const rows = [...this.db.observationRallyCourses.values()].flatMap((course) => {
        if (course.status !== "live") return [];
        const eventSession = this.db.observationEventSessions.get(course.session_id);
        if (!eventSession) return [];
        const startedAt = Date.parse(eventSession.started_at);
        const endedAt = eventSession.ended_at ? Date.parse(eventSession.ended_at) : Number.POSITIVE_INFINITY;
        if (!Number.isFinite(observedAt) || observedAt < startedAt || observedAt > endedAt) return [];
        return [...this.db.observationRallyMissions.values()].flatMap((mission) => {
          if (mission.course_id !== course.course_id || mission.status !== "published") return [];
          if (!['station_required', 'any_registered_station'].includes(mission.location_binding)) return [];
          const startsAt = mission.starts_at ? Date.parse(mission.starts_at) : Number.NEGATIVE_INFINITY;
          const endsAt = mission.ends_at ? Date.parse(mission.ends_at) : Number.POSITIVE_INFINITY;
          if (observedAt < startsAt || observedAt > endsAt) return [];
          return [...this.db.observationRallyStations.values()]
            .filter((station) =>
              station.course_id === course.course_id &&
              station.status === "open" &&
              station.lat !== null &&
              station.lng !== null &&
              station.radius_m !== null &&
              station.radius_m > 0 &&
              (mission.station_id === station.station_id || (mission.location_binding === 'any_registered_station' && mission.station_id === null))
            )
            .map((station) => ({
              session_id: course.session_id,
              course_id: course.course_id,
              mission_id: mission.mission_id,
              mission_course_id: mission.course_id,
              station_id: mission.station_id,
              replacement_for_mission_id: mission.replacement_for_mission_id,
              scope: mission.scope,
              location_binding: mission.location_binding,
              title: mission.title,
              target: mission.target,
              count_unit: mission.count_unit,
              goal_count: mission.goal_count,
              counting_policy_json: mission.counting_policy_json,
              verification_policy: mission.verification_policy,
              weather_sensitivity: mission.weather_sensitivity,
              fallback_group: mission.fallback_group,
              status: mission.status,
              starts_at: mission.starts_at,
              ends_at: mission.ends_at,
              sort_order: mission.sort_order,
              created_by: mission.created_by,
              created_at: mission.created_at,
              updated_at: mission.updated_at,
              matched_station_id: station.station_id,
              station_lat: station.lat,
              station_lng: station.lng,
              station_radius_m: station.radius_m
            }));
        });
      });
      return { results: rows as T[] };
    }

'''
if "SELECT course.session_id AS session_id, course.course_id AS course_id, mission.mission_id AS mission_id" not in source:
    if all_marker not in source:
        raise RuntimeError("rally station list test handler not found")
    source = source.replace(all_marker, all_handler + all_marker, 1)

mission_marker = '''    const submission = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/rally/submissions`, {
'''
auto_test = r'''    const autoMission = await worker.fetch(new Request(`https://ikimon.life/api/v1/observation-events/${created.sessionId}/rally/missions`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ station_id: stationPayload.station.stationId, scope: "event", location_binding: "station_required", title: "通常記録で通過", target: "水辺の記録", goal_count: 1, status: "published" })
    }), productionEnv);
    assert.equal(autoMission.status, 201);
    const autoMissionPayload = await autoMission.json() as any;

    const autoObservationRequest = () => new Request("https://ikimon.life/api/v1/observations/upsert", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        observationId: "obs-rally-auto-match-1",
        userId: "event-organizer",
        observedAt: "2026-06-25T10:20:00.000Z",
        latitude: 34.97564,
        longitude: 138.38284,
        municipality: "静岡市",
        prefecture: "静岡県",
        taxon: { vernacularName: "トンボ" }
      })
    });
    const autoObservation = await worker.fetch(autoObservationRequest(), productionEnv);
    assert.equal(autoObservation.status, 201);
    const autoSubmissions = [...obs.observationRallySubmissions.values()].filter((row) =>
      row.source_type === "observation_auto_match" && row.source_ref === "obs-rally-auto-match-1"
    );
    assert.equal(autoSubmissions.length, 1);
    assert.equal(autoSubmissions[0]?.mission_id, autoMissionPayload.mission.missionId);
    assert.equal(autoSubmissions[0]?.public_lat, 34.976);
    assert.equal(autoSubmissions[0]?.public_lng, 138.383);
    const autoPayload = JSON.parse(autoSubmissions[0]?.payload_json ?? "{}") as Record<string, unknown>;
    assert.equal(autoPayload.exact_location_used, true);
    assert.equal(autoPayload.exact_location_stored, false);
    assert.equal("exact_lat" in autoPayload, false);
    assert.equal("exact_lng" in autoPayload, false);
    const autoProgress = [...obs.observationRallyProgress.values()].find((row) => row.mission_id === autoMissionPayload.mission.missionId);
    assert.equal(autoProgress?.percent, 100);

    const autoObservationRetry = await worker.fetch(autoObservationRequest(), productionEnv);
    assert.equal(autoObservationRetry.status, 201);
    assert.equal([...obs.observationRallySubmissions.values()].filter((row) =>
      row.source_type === "observation_auto_match" && row.source_ref === "obs-rally-auto-match-1"
    ).length, 1);
    assert.equal([...obs.observationRallyProgress.values()].find((row) => row.mission_id === autoMissionPayload.mission.missionId)?.percent, 100);

'''
if "obs-rally-auto-match-1" not in source:
    if mission_marker not in source:
        raise RuntimeError("manual rally submission test marker not found")
    source = source.replace(mission_marker, auto_test + mission_marker, 1)

progress_old = '''    assert.equal(rallyPayload.rally.progress[0].percent, 150);
    assert.equal(rallyPayload.rally.progress[0].status, "exceeded");
'''
progress_new = '''    const manualProgress = rallyPayload.rally.progress.find((row: any) => row.missionId === missionPayload.mission.missionId);
    const autoMatchedProgress = rallyPayload.rally.progress.find((row: any) => row.missionId === autoMissionPayload.mission.missionId);
    assert.equal(manualProgress.percent, 150);
    assert.equal(manualProgress.status, "exceeded");
    assert.equal(autoMatchedProgress.percent, 100);
    assert.equal(autoMatchedProgress.status, "reached");
'''
if progress_old in source:
    source = source.replace(progress_old, progress_new, 1)

test_path.write_text(source, encoding="utf-8")

boundary = boundary_path.read_text(encoding="utf-8")
boundary_marker = '    "platform_v2/src/services/observationRally.ts": "cloudflare_observation_rally_api",\n'
boundary_line = '    "platform_v2/src/services/observationRallyAutoMatch.ts": "cloudflare_observation_rally_post_save_auto_match",\n'
if boundary_line not in boundary:
    if boundary_marker not in boundary:
        raise RuntimeError("boundary disposition marker not found")
    boundary = boundary.replace(boundary_marker, boundary_marker + boundary_line, 1)
boundary_path.write_text(boundary, encoding="utf-8")
