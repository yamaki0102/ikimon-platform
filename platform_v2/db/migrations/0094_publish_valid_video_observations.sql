-- 0094_publish_valid_video_observations
-- Backfill video-only observations that have valid Cloudflare Stream evidence but
-- remained in native_no_photo review before webhook publication guaranteed parity.
-- destructive-ok: scoped UPDATE only promotes visits with existing valid observation_video evidence; rollback can set affected visits back to review from deploy logs if needed.

with video_visits as (
  select distinct v.visit_id
    from visits v
    join evidence_assets ea on ea.visit_id = v.visit_id
    join asset_blobs ab on ab.blob_id = ea.blob_id
   where v.public_visibility = 'review'
     and v.quality_review_status = 'needs_review'
     and ea.asset_role = 'observation_video'
     and nullif(coalesce(ab.public_url, ab.storage_path, ab.source_payload->>'iframe_url'), '') is not null
     and coalesce(ab.public_url, ab.storage_path, ab.source_payload->>'iframe_url', '') !~* '(e2e[-_]?test|fixture[-_]?prefix|prod[-_]?media[-_]?smoke|smoke[-_]?regression[-_]?fixture|smoke[-_]?ui|staging[-_]?regression)'
)
update visits v
   set public_visibility = 'public',
       quality_review_status = 'accepted',
       quality_gate_reasons = coalesce((
         select jsonb_agg(reason)
           from jsonb_array_elements_text(coalesce(v.quality_gate_reasons, '[]'::jsonb)) as reasons(reason)
          where reason <> 'missing_photo'
       ), '[]'::jsonb),
       updated_at = now()
  from video_visits vv
 where v.visit_id = vv.visit_id;

with video_visits as (
  select distinct v.visit_id
    from visits v
    join evidence_assets ea on ea.visit_id = v.visit_id
    join asset_blobs ab on ab.blob_id = ea.blob_id
   where v.public_visibility = 'public'
     and v.quality_review_status = 'accepted'
     and ea.asset_role = 'observation_video'
     and nullif(coalesce(ab.public_url, ab.storage_path, ab.source_payload->>'iframe_url'), '') is not null
     and coalesce(ab.public_url, ab.storage_path, ab.source_payload->>'iframe_url', '') !~* '(e2e[-_]?test|fixture[-_]?prefix|prod[-_]?media[-_]?smoke|smoke[-_]?regression[-_]?fixture|smoke[-_]?ui|staging[-_]?regression)'
)
update observation_quality_reviews oqr
   set review_status = 'accepted',
       public_visibility = 'public',
       reviewed_at = coalesce(reviewed_at, now()),
       updated_at = now()
  from video_visits vv
 where oqr.visit_id = vv.visit_id
   and oqr.reason_code = 'native_no_photo'
   and oqr.review_status = 'needs_review';
