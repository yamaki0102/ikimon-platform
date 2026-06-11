import { fileURLToPath } from "node:url";
import path from "node:path";
import { getPool } from "../db.js";

type MonitorOptions = {
  fixturePrefix: string | null;
  maxAgeMinutes: number;
  repair: boolean;
  dryRun: boolean;
  failOnResidue: boolean;
};

type CountMap = Record<string, number>;

type MonitorSummary = {
  fixturePrefix: string | null;
  maxAgeMinutes: number;
  repair: boolean;
  dryRun: boolean;
  matched: CountMap;
  repaired: CountMap;
  remaining: CountMap;
};

const SAFE_PREFIX_RE = /^(?:prod-media-smoke|smoke-ui)-[A-Za-z0-9_-]{6,96}$/;

function parseArgs(argv: string[]): MonitorOptions {
  const options: MonitorOptions = {
    fixturePrefix: null,
    maxAgeMinutes: 30,
    repair: true,
    dryRun: false,
    failOnResidue: true,
  };

  for (const arg of argv) {
    if (arg.startsWith("--fixture-prefix=")) {
      const value = arg.slice("--fixture-prefix=".length).trim();
      if (!SAFE_PREFIX_RE.test(value)) {
        throw new Error("fixture_prefix_must_match_production_smoke_pattern");
      }
      options.fixturePrefix = value;
      continue;
    }
    if (arg.startsWith("--max-age-minutes=")) {
      const value = Number(arg.slice("--max-age-minutes=".length));
      if (!Number.isFinite(value) || value < 0 || value > 1440) {
        throw new Error("max_age_minutes_must_be_between_0_and_1440");
      }
      options.maxAgeMinutes = Math.trunc(value);
      continue;
    }
    if (arg === "--no-repair") {
      options.repair = false;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      options.repair = false;
      continue;
    }
    if (arg === "--allow-residue") {
      options.failOnResidue = false;
    }
  }

  return options;
}

function countRows(rows: Array<{ c: string | number }>): number {
  return Number(rows[0]?.c ?? 0);
}

function visitPredicate(alias: string): string {
  return `(
    ($1::text is not null and (
      ${alias}.visit_id like $1::text || '%'
      or coalesce(${alias}.legacy_observation_id, '') like $1::text || '%'
      or ${alias}.source_payload::text like '%' || $1::text || '%'
    ))
    or ($1::text is null and (
      ${alias}.visit_id ~ '^(prod-media-smoke-|smoke-ui-)'
      or coalesce(${alias}.legacy_observation_id, '') ~ '^(prod-media-smoke-|smoke-ui-)'
      or ${alias}.source_payload::text ~* '(prod_media_smoke|production_place_memory_smoke|smoke_ui|production_smoke)'
      or coalesce(${alias}.locality_note, '') ~* '(prod media smoke|production smoke|smoke-ui)'
      or coalesce(${alias}.note, '') ~* '(prod media smoke|production smoke|smoke-ui)'
    ))
  )`;
}

function eventPredicate(alias: string): string {
  return `(
    ($1::text is not null and (
      ${alias}.session_id::text = $1::text
      or coalesce(${alias}.event_code, '') like $1::text || '%'
      or ${alias}.title like '%' || $1::text || '%'
      or ${alias}.config::text like '%' || $1::text || '%'
    ))
    or ($1::text is null and (
      coalesce(${alias}.event_code, '') ~ '^(smoke-ui-|prod-media-smoke-)'
      or ${alias}.title ~* '(smoke-ui-|production smoke|スモーク)'
      or ${alias}.config::text ~* '(production_smoke|smoke-ui-|fixture_prefix)'
    ))
  )`;
}

async function deleteCount(client: Awaited<ReturnType<ReturnType<typeof getPool>["connect"]>>, sql: string, params: unknown[]): Promise<number> {
  const result = await client.query<{ c: string }>(
    `with deleted_rows as (${sql} returning 1) select count(*)::text as c from deleted_rows`,
    params,
  );
  return Number(result.rows[0]?.c ?? 0);
}

async function monitorProductionSmokeCleanup(options: MonitorOptions): Promise<MonitorSummary> {
  const pool = getPool();
  const client = await pool.connect();
  const params: unknown[] = [options.fixturePrefix, options.maxAgeMinutes];
  const matched: CountMap = {};
  const repaired: CountMap = {};
  const remaining: CountMap = {};

  try {
    const visitSql = `
      select visit_id
        from visits v
       where ${visitPredicate("v")}
         and v.created_at <= now() - make_interval(mins => $2::int)`;
    const eventSql = `
      select session_id::text as session_id
        from observation_event_sessions s
       where ${eventPredicate("s")}
         and s.created_at <= now() - make_interval(mins => $2::int)`;
    const occurrenceSql = `
      select occurrence_id
        from occurrences o
       where o.visit_id in (${visitSql})
          or o.occurrence_id in (
               select 'occ:' || v.visit_id || ':0'
                 from visits v
                where ${visitPredicate("v")}
                  and v.created_at <= now() - make_interval(mins => $2::int)
             )
          or o.source_payload::text like case when $1::text is null then '__never_match__' else '%' || $1::text || '%' end`;

    matched.visits = countRows((await client.query<{ c: string }>(`select count(*)::text as c from (${visitSql}) q`, params)).rows);
    matched.occurrences = countRows((await client.query<{ c: string }>(`select count(*)::text as c from (${occurrenceSql}) q`, params)).rows);
    matched.eventSessions = countRows((await client.query<{ c: string }>(`select count(*)::text as c from (${eventSql}) q`, params)).rows);
    matched.placeMemoryEntries = countRows((await client.query<{ c: string }>(
      `select count(*)::text as c
         from place_memory_entries p
        where p.visit_id in (${visitSql})
           or p.occurrence_id in (${occurrenceSql})
           or p.source_payload::text like case when $1::text is null then '__never_match__' else '%' || $1::text || '%' end`,
      params,
    )).rows);

    if (options.repair && !options.dryRun) {
      await client.query("begin");
      try {
        repaired.visits = countRows((await client.query<{ c: string }>(
          `with target as (${visitSql}),
                updated as (
                  update visits v
                     set public_visibility = 'hidden',
                         quality_review_status = 'archived',
                         quality_gate_reasons = case
                           when coalesce(v.quality_gate_reasons, '[]'::jsonb) ? 'production_smoke_record'
                             then coalesce(v.quality_gate_reasons, '[]'::jsonb)
                           else coalesce(v.quality_gate_reasons, '[]'::jsonb) || '["production_smoke_record"]'::jsonb
                         end,
                         source_payload = coalesce(v.source_payload, '{}'::jsonb) || jsonb_build_object(
                           'production_smoke_cleanup_monitor', jsonb_build_object(
                             'action', 'isolated',
                             'reason', 'post_smoke_residue_monitor',
                             'isolated_at', now()
                           )
                         ),
                         updated_at = now()
                   where v.visit_id in (select visit_id from target)
                   returning 1
                )
           select count(*)::text as c from updated`,
          params,
        )).rows);

        repaired.placeMemoryEntries = countRows((await client.query<{ c: string }>(
          `with target_visits as (${visitSql}),
                target_occurrences as (${occurrenceSql}),
                updated as (
                  update place_memory_entries p
                     set moderation_status = 'hidden_by_admin',
                         deleted_at = coalesce(p.deleted_at, now()),
                         source_payload = coalesce(p.source_payload, '{}'::jsonb) || jsonb_build_object(
                           'production_smoke_cleanup_monitor', jsonb_build_object(
                             'action', 'isolated',
                             'reason', 'post_smoke_residue_monitor',
                             'isolated_at', now()
                           )
                         ),
                         updated_at = now()
                   where p.visit_id in (select visit_id from target_visits)
                      or p.occurrence_id in (select occurrence_id from target_occurrences)
                      or p.source_payload::text like case when $1::text is null then '__never_match__' else '%' || $1::text || '%' end
                   returning 1
                )
           select count(*)::text as c from updated`,
          params,
        )).rows);

        repaired.eventRecapViews = await deleteCount(client, `delete from observation_event_recap_views where session_id::text in (${eventSql})`, params);
        repaired.eventLiveEvents = await deleteCount(client, `delete from observation_event_live_events where session_id::text in (${eventSql})`, params);
        repaired.eventMeshCells = await deleteCount(client, `delete from observation_event_mesh_cells where session_id::text in (${eventSql})`, params);
        repaired.eventParticipants = await deleteCount(client, `delete from observation_event_participants where session_id::text in (${eventSql})`, params);
        repaired.eventQuests = await deleteCount(client, `delete from observation_event_quests where session_id::text in (${eventSql})`, params);
        repaired.eventCapsules = await deleteCount(client, `delete from observation_event_capsules where session_id::text in (${eventSql})`, params);
        repaired.eventAbsences = await deleteCount(client, `delete from observation_event_absences where session_id::text in (${eventSql})`, params);
        repaired.eventTeams = await deleteCount(client, `delete from observation_event_teams where session_id::text in (${eventSql})`, params);
        repaired.guideLatencyStates = await deleteCount(
          client,
          `delete from guide_record_latency_states
            where guide_record_id in (
              select guide_record_id from guide_records where session_id::text in (${eventSql})
            )`,
          params,
        );
        repaired.guideRecords = await deleteCount(client, `delete from guide_records where session_id::text in (${eventSql})`, params);
        repaired.eventSessions = await deleteCount(client, `delete from observation_event_sessions where session_id::text in (${eventSql})`, params);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }

    remaining.visibleVisits = countRows((await client.query<{ c: string }>(
      `select count(*)::text as c
         from visits v
        where v.visit_id in (${visitSql})
          and (
            coalesce(v.public_visibility, 'public') <> 'hidden'
            or coalesce(v.quality_review_status, 'accepted') <> 'archived'
          )`,
      params,
    )).rows);
    remaining.eventSessions = countRows((await client.query<{ c: string }>(`select count(*)::text as c from (${eventSql}) q`, params)).rows);
    remaining.visiblePlaceMemoryEntries = countRows((await client.query<{ c: string }>(
      `select count(*)::text as c
         from place_memory_entries p
        where (
              p.visit_id in (${visitSql})
           or p.occurrence_id in (${occurrenceSql})
           or p.source_payload::text like case when $1::text is null then '__never_match__' else '%' || $1::text || '%' end
        )
          and p.moderation_status not in ('hidden_by_admin', 'deleted_by_owner', 'hidden_by_report_threshold')`,
      params,
    )).rows);
  } finally {
    client.release();
  }

  const summary: MonitorSummary = {
    fixturePrefix: options.fixturePrefix,
    maxAgeMinutes: options.maxAgeMinutes,
    repair: options.repair,
    dryRun: options.dryRun,
    matched,
    repaired,
    remaining,
  };

  if (options.failOnResidue && Object.values(remaining).some((value) => value > 0)) {
    throw new Error(`production_smoke_residue_remaining:${JSON.stringify(summary)}`);
  }

  return summary;
}

async function main(): Promise<void> {
  const summary = await monitorProductionSmokeCleanup(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
