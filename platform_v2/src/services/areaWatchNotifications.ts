import type { PoolClient } from "pg";
import { getPool } from "../db.js";

export type EmitAreaWatchNotificationInput = {
  occurrenceId: string;
  visitId: string;
};

export type AreaWatchNotificationSummary = {
  areaWatchNotifications: number;
};

export type AreaWatchParticipationSummary = {
  followedAreas: number;
};

function cleanId(value: string): string {
  return value.trim();
}

export async function emitAreaWatchNotificationForObservation(
  input: EmitAreaWatchNotificationInput,
  client?: PoolClient,
): Promise<AreaWatchNotificationSummary> {
  const occurrenceId = cleanId(input.occurrenceId);
  const visitId = cleanId(input.visitId);
  if (!occurrenceId || !visitId) return { areaWatchNotifications: 0 };

  const exec = async (c: PoolClient): Promise<AreaWatchNotificationSummary> => {
    const result = await c.query<{ delivery_id: string }>(
      `with new_visit as (
          select v.visit_id,
                 v.place_id,
                 v.user_id,
                 v.observed_at,
                 v.resolved_field_ids,
                 v.observed_prefecture,
                 v.observed_municipality,
                 v.complete_checklist_flag,
                 v.effort_minutes,
                 v.distance_meters,
                 v.public_visibility,
                 v.quality_review_status
            from visits v
           where v.visit_id = $2
        ),
        new_occurrence as (
          select o.occurrence_id,
                 coalesce(nullif(o.vernacular_name, ''), nullif(o.scientific_name, ''), '新しい観察') as display_name,
                 o.scientific_name,
                 o.vernacular_name
            from occurrences o
           where o.occurrence_id = $1
        ),
        photo_state as (
          select exists (
            select 1
              from evidence_assets ea
              join asset_blobs ab on ab.blob_id = ea.blob_id
             where ea.occurrence_id = $1
               and (ab.media_type = 'image' or ab.mime_type like 'image/%')
          ) as has_photo
        ),
        matched_subscriptions as (
          select s.subscription_id,
                 s.user_id,
                 s.target_type,
                 s.target_id,
                 s.label,
                 s.href
            from user_area_subscriptions s
            join new_visit v on true
           where s.is_active = true
             and (v.user_id is null or s.user_id <> v.user_id)
             and (
               (s.target_type = 'place' and v.place_id = s.target_id)
               or (
                 s.target_type = 'field'
                 and exists (
                   select 1
                     from unnest(coalesce(v.resolved_field_ids, '{}'::uuid[])) as rf(field_id)
                    where rf.field_id::text = s.target_id
                 )
               )
               or (
                 s.target_type = 'region'
                 and s.target_id in (
                   coalesce(v.observed_prefecture, ''),
                   coalesce(v.observed_municipality, ''),
                   concat_ws(':', nullif(v.observed_prefecture, ''), nullif(v.observed_municipality, ''))
                 )
               )
             )
        )
        insert into alert_deliveries (
          occurrence_id, user_id, area_subscription_id, trigger_kind, channel,
          delivery_status, delivered_at, payload_json
        )
        select no.occurrence_id,
               ms.user_id,
               ms.subscription_id,
               'area_watch',
               'none',
               'sent',
               now(),
               jsonb_build_object(
                 'title', '見守りエリアに新しい記録',
                 'body', case
                   when v.complete_checklist_flag is true then coalesce(nullif(ms.label, ''), 'フォロー中のエリア') || ' にチェックリストつきの記録が増えました。'
                   when v.effort_minutes is not null or v.distance_meters is not null then coalesce(nullif(ms.label, ''), 'フォロー中のエリア') || ' にeffortつきの記録が増えました。'
                   when ps.has_photo then coalesce(nullif(ms.label, ''), 'フォロー中のエリア') || ' に写真つきの記録が増えました。'
                   else coalesce(nullif(ms.label, ''), 'フォロー中のエリア') || ' に新しい記録が増えました。'
                 end,
                 'href', coalesce(nullif(ms.href, ''), '/map'),
                 'areaLabel', coalesce(nullif(ms.label, ''), ms.target_id),
                 'targetType', ms.target_type,
                 'targetId', ms.target_id,
                 'occurrenceId', no.occurrence_id,
                 'visitId', v.visit_id,
                 'displayName', no.display_name,
                 'observedAt', v.observed_at,
                 'watchSignals', jsonb_strip_nulls(jsonb_build_object(
                   'hasPhoto', ps.has_photo,
                   'completeChecklist', v.complete_checklist_flag,
                   'effortMinutes', v.effort_minutes,
                   'distanceMeters', v.distance_meters
                 ))
               )
          from matched_subscriptions ms
          join new_visit v on true
          join new_occurrence no on true
          join photo_state ps on true
         where v.public_visibility = 'public'
           and coalesce(v.quality_review_status, '') in ('accepted', 'auto_accepted')
        on conflict (occurrence_id, user_id, area_subscription_id, trigger_kind)
          where user_id is not null and area_subscription_id is not null
          do nothing
        returning delivery_id::text`,
      [occurrenceId, visitId],
    );
    return { areaWatchNotifications: result.rows.length };
  };

  if (client) return await exec(client);
  const pool = getPool();
  const c = await pool.connect();
  try {
    return await exec(c);
  } finally {
    c.release();
  }
}

export async function ensureAreaWatchParticipationForVisit(
  input: { visitId: string },
  client?: PoolClient,
): Promise<AreaWatchParticipationSummary> {
  const visitId = cleanId(input.visitId);
  if (!visitId) return { followedAreas: 0 };

  const exec = async (c: PoolClient): Promise<AreaWatchParticipationSummary> => {
    const result = await c.query<{ subscription_id: string }>(
      `with new_visit as (
          select v.visit_id,
                 v.place_id,
                 v.user_id,
                 coalesce(nullif(p.canonical_name, ''), nullif(v.locality_note, ''), '参加したエリア') as place_label,
                 coalesce(v.resolved_field_ids, '{}'::uuid[]) as resolved_field_ids
            from visits v
            left join places p on p.place_id = v.place_id
           where v.visit_id = $1
             and nullif(v.user_id, '') is not null
        ),
        field_targets as (
          select nv.user_id,
                 'field'::text as target_type,
                 f.field_id::text as target_id,
                 coalesce(nullif(f.name, ''), '参加したフィールド') as label,
                 '/map?field=' || f.field_id::text as href,
                 1 as priority
            from new_visit nv
            join lateral unnest(nv.resolved_field_ids) as rf(field_id) on true
            join observation_fields f on f.field_id = rf.field_id
           limit 4
        ),
        place_target as (
          select nv.user_id,
                 'place'::text as target_type,
                 nv.place_id as target_id,
                 nv.place_label as label,
                 '/map?place=' || nv.place_id as href,
                 9 as priority
            from new_visit nv
           where nv.place_id is not null
             and not exists (select 1 from field_targets)
        ),
        targets as (
          select * from field_targets
          union all
          select * from place_target
        )
        insert into user_area_subscriptions (
          user_id, target_type, target_id, label, href, is_active, updated_at
        )
        select user_id, target_type, target_id, left(label, 120), left(href, 240), true, now()
          from targets
         order by priority asc
        on conflict (user_id, target_type, target_id)
        do update set label = excluded.label,
                      href = excluded.href,
                      is_active = true,
                      updated_at = now()
        returning subscription_id::text`,
      [visitId],
    );
    return { followedAreas: result.rows.length };
  };

  if (client) return await exec(client);
  const pool = getPool();
  const c = await pool.connect();
  try {
    return await exec(c);
  } finally {
    c.release();
  }
}
