from pathlib import Path

node_path = Path("platform_v2/src/services/observationRallyAutoMatch.ts")
worker_path = Path("platform_v2/cloudflare_shadow/src/index.ts")
worker_test_path = Path("platform_v2/cloudflare_shadow/src/index.test.ts")
contract_path = Path("platform_v2/cloudflare_shadow/src/workerRallyAutoMatchContract.test.ts")

node = node_path.read_text(encoding="utf-8")
node_old = '''       AND event_session.started_at <= $3::timestamptz
       AND (event_session.ended_at IS NULL OR event_session.ended_at >= $3::timestamptz)
       AND (mission.starts_at IS NULL OR mission.starts_at <= $3::timestamptz)
       AND (mission.ends_at IS NULL OR mission.ends_at >= $3::timestamptz)
     ORDER BY mission.sort_order, station.sort_order, station.created_at`,
    [input.lat, input.lng, observedAt],
'''
node_new = '''       AND event_session.started_at <= $3::timestamptz
       AND (event_session.ended_at IS NULL OR event_session.ended_at >= $3::timestamptz)
       AND (mission.starts_at IS NULL OR mission.starts_at <= $3::timestamptz)
       AND (mission.ends_at IS NULL OR mission.ends_at >= $3::timestamptz)
       AND (
         event_session.organizer_user_id = $4
         OR EXISTS (
           SELECT 1
           FROM observation_event_participants participant
           WHERE participant.session_id = course.session_id
             AND participant.user_id = $4
             AND participant.status IN ('registered', 'checked_in')
         )
       )
     ORDER BY mission.sort_order, station.sort_order, station.created_at`,
    [input.lat, input.lng, observedAt, input.userId],
'''
if node_old not in node:
    raise RuntimeError("PostgreSQL rally candidate query marker not found")
node_path.write_text(node.replace(node_old, node_new, 1), encoding="utf-8")

worker = worker_path.read_text(encoding="utf-8")
worker_old = '''       AND datetime(event_session.started_at) <= datetime(?)
       AND (event_session.ended_at IS NULL OR datetime(event_session.ended_at) >= datetime(?))
       AND (mission.starts_at IS NULL OR datetime(mission.starts_at) <= datetime(?))
       AND (mission.ends_at IS NULL OR datetime(mission.ends_at) >= datetime(?))
     ORDER BY mission.sort_order ASC, station.sort_order ASC, station.created_at ASC
     LIMIT 500`
  ).bind(input.observedAt, input.observedAt, input.observedAt, input.observedAt).all<ObservationRallyAutoMatchCandidateD1Row>();
'''
worker_new = '''       AND datetime(event_session.started_at) <= datetime(?)
       AND (event_session.ended_at IS NULL OR datetime(event_session.ended_at) >= datetime(?))
       AND (mission.starts_at IS NULL OR datetime(mission.starts_at) <= datetime(?))
       AND (mission.ends_at IS NULL OR datetime(mission.ends_at) >= datetime(?))
       AND (
         event_session.organizer_user_id = ?
         OR EXISTS (
           SELECT 1
           FROM observation_event_participants participant
           WHERE participant.session_id = course.session_id
             AND participant.user_id = ?
             AND participant.status IN ('registered', 'checked_in')
         )
       )
     ORDER BY mission.sort_order ASC, station.sort_order ASC, station.created_at ASC
     LIMIT 500`
  ).bind(input.observedAt, input.observedAt, input.observedAt, input.observedAt, input.userId, input.userId).all<ObservationRallyAutoMatchCandidateD1Row>();
'''
if worker_old not in worker:
    raise RuntimeError("D1 rally candidate query marker not found")
worker_path.write_text(worker.replace(worker_old, worker_new, 1), encoding="utf-8")

worker_test = worker_test_path.read_text(encoding="utf-8")
handler_old = '''        const eventSession = this.db.observationEventSessions.get(course.session_id);
        if (!eventSession) return [];
        const startedAt = Date.parse(eventSession.started_at);
        const endedAt = eventSession.ended_at ? Date.parse(eventSession.ended_at) : Number.POSITIVE_INFINITY;
        if (!Number.isFinite(observedAt) || observedAt < startedAt || observedAt > endedAt) return [];
'''
handler_new = '''        const eventSession = this.db.observationEventSessions.get(course.session_id);
        if (!eventSession) return [];
        const userId = string(v[4]);
        const eligibleParticipant = eventSession.organizer_user_id === userId || [...this.db.observationEventParticipants.values()].some((participant) =>
          participant.session_id === course.session_id &&
          participant.user_id === userId &&
          (participant.status === "registered" || participant.status === "checked_in")
        );
        if (!eligibleParticipant) return [];
        const startedAt = Date.parse(eventSession.started_at);
        const endedAt = eventSession.ended_at ? Date.parse(eventSession.ended_at) : Number.POSITIVE_INFINITY;
        if (!Number.isFinite(observedAt) || observedAt < startedAt || observedAt > endedAt) return [];
'''
if handler_old not in worker_test:
    raise RuntimeError("fake D1 rally candidate handler marker not found")
worker_test = worker_test.replace(handler_old, handler_new, 1)
worker_test_path.write_text(worker_test, encoding="utf-8")

contract = contract_path.read_text(encoding="utf-8")
contract = contract.replace(
    '  assert.match(workerSource, /mission\\.location_binding IN \\\(\'station_required\', \'any_registered_station\'\\\)/);\n',
    '  assert.match(workerSource, /mission\\.location_binding IN \\\(\'station_required\', \'any_registered_station\'\\\)/);\n  assert.match(workerSource, /event_session\\.organizer_user_id = \\?/);\n  assert.match(workerSource, /participant\\.status IN \\\(\'registered\', \'checked_in\'\\\)/);\n',
    1,
)
contract_path.write_text(contract, encoding="utf-8")
