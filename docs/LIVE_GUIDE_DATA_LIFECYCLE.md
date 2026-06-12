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

Required behavior:

- Media-bearing queue items expire after 72 hours.
- Telemetry-only queue items expire after 24 hours.
- Each item carries `capturedConsentSnapshot`.
- Replay requires both capture-time consent and current consent.
- If audio consent is off at replay time, scene replay must drop `audioBlob`.
- Standalone audio replay must not upload without current and captured audio consent.
- Logout or consent reset must purge the queue.

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
