# Live Guide Data Lifecycle

This document is the implementation contract for Live Guide capture, offline sync,
audio handling, route privacy, publication, and deletion/anonymization.

## Lifecycle

Live Guide data must move through this explicit state machine:

`captured -> queued/uploaded -> analyzed -> transient|retained -> promoted -> published`

- `captured`: frame/audio/location exists only in the browser runtime.
- `queued`: browser IndexedDB may temporarily hold frame/audio/location while offline.
- `uploaded`: server may hold the scene job only within the analysis window.
- `transient`: person-only, indoor, duplicate, or weak evidence. Keep only reason/count/derived metadata.
- `retained`: a guide record candidate with privacy-safe thumbnail/metadata.
- `promoted`: user-authenticated promotion to an observation.
- `published`: public/research surface after location/audio/species gates.

## Browser Offline Queue

The guide offline queue may contain scene frame blobs, audio blobs, exact lat/lng,
and telemetry points. It is therefore private, temporary storage.

### Current runtime contract

The following describes the current implementation before the Survey Mode Phase 0 migration:

- Media-bearing queue items expire after 72 hours.
- Telemetry-only queue items expire after 24 hours.
- Each item carries `capturedConsentSnapshot`.
- Replay requires both capture-time consent and current consent.
- If audio consent is off at replay time, scene replay must drop `audioBlob`.
- Standalone audio replay must not upload without current and captured audio consent.
- Logout or consent reset purges the queue.

The current runtime has known defects documented in the ZUKAN Survey Mode review:

- current consent is incorrectly coupled to `running`
- final telemetry may be captured after `running=false` and become unreplayable
- reload-time drain can be blocked while no survey is running
- queue scans may load all media-bearing records repeatedly
- sync resumption is tied to the Guide page runtime

These are implementation facts, not acceptable target behavior.

### Target Survey Mode contract

The target contract is defined by:

- `docs/adr/zukan-survey-offline-lifecycle-contract-v1_2026-07-29.md`
- `docs/spec/zukan-survey-mode-canonical-v2_2026-07-29.md`

After Phase 0 is implemented and verified, the required behavior becomes:

- Media-bearing and telemetry-only raw queue items expire after 72 hours.
- A lightweight SurveyLedger checkpoint is stored separately from raw media in the existing app-outbox IndexedDB database.
- Replay requires capture-time consent, persistent current consent, and a matching owner/install boundary; it does not require `running=true`.
- Ordinary logout or authentication expiry quarantines unsent items as `blocked_auth`; it does not silently erase the SurveyLedger.
- Explicit consent withdrawal purges raw media/telemetry and leaves only a redacted local tombstone unless the user requests full local deletion.
- A blocked, deferred, expired, or consent-mismatched item must not stop later eligible items from syncing.
- Queue expiry, drop, and authentication blocking are recorded distinctly and are never shown as successful upload.
- Sync resumption is app-wide and must not depend on `/guide` being open.
- Replay is idempotent at session/item/install receipt boundaries.

Until the corresponding Phase 0 code and tests land, the target section is a migration contract and must not be cited as current runtime evidence.

## Audio Policy

Live Guide natural-sound audio is analysis-only by default.

- Speech-like chunks are rejected client-side and must not be uploaded.
- Natural-sound chunks use `rawAudioPolicy: analysis_only_delete_after_detection`.
- After detection/embedding callback, raw audio files and asset blob references are deleted.
- Detection rows, embeddings, aggregate bundles, and privacy-safe metadata may remain.
- `fingerprint` / `audioFingerprint` is a dedupe/acoustic-feature summary. It is not a speaker identity feature.
- Promotion must not attach raw audio unless the segment is privacy-clean and not analysis-deleted.

## Route Privacy

Exact route points are private effort data.

- `visit_track_points` may store exact route for private session effort calculation.
- Public summaries, partner views, research exports, and map aggregates must use mesh/cell summaries or public location labels.
- Raw start/end route coordinates must not be serialized into `GuideSessionPublicSummary`.
- Any future public route rendering must trim the first/last 200-300m or first/last 3 minutes.

## Promotion Gate

Promotion from guide record to observation requires these checks:

- no human voice evidence
- no person-centered frame evidence
- no exact location exposure on public surfaces
- sensitive species masking/public location rules applied
- user-authenticated explicit action, not background publication

## Deletion / Anonymization Cascade

When a user deletes a Live Guide session or withdraws consent, implementation must
delete or anonymize these records as one operation:

- `guide_records` for the session
- `guide_record_latency_states`
- `audio_segments` raw files and asset blob references
- `audio_detections`, embeddings, sound bundle memberships, and clusters that depend only on deleted segments
- `visit_track_points` for `guide:<sessionId>`
- session public summaries derived from those records
- mobile field session receipts that identify the deleted client scenes

Aggregate mesh summaries may remain only if they are irreversible and cannot be
linked back to a user, install id, exact route, or deleted guide record.

For Survey Mode aggregates, the internal system must retain enough non-public provenance to exclude withdrawn contributions from recomputable counts without exposing contributor identity in public aggregate payloads.