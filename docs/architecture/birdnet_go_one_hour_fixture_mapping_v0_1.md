# BirdNET-Go one-hour fixture mapping v0.1

Status: Draft fixture for contract validation
Date: 2026-05-04
Depends on: `E:\Projects\03_ikimon.life_Product\docs\architecture\birdnet_go_event_ingest_contract_v0_1.md`

## 1. Purpose

This document proves whether the BirdNET-Go event-only ingest contract can support G1-G7 measurement before implementation.

No real BirdNET-Go CSV or MQTT payload was found locally on 2026-05-04. The rows below are a synthetic one-hour fixture, not field evidence and not a performance claim. Replace the fixture with a real 60-minute export from the Aikan candidate site when available.

Rules:

- Do not implement a legacy PHP importer.
- Do not write to `upload_package/`.
- Do not store permanent raw server-side audio.
- Treat all detections as AI candidates until review.
- Use conservative report wording only: 補助資料, 検討材料, AI候補, reviewer検証済み.

## 2. Fixture context

| Field | Value |
|---|---|
| fixture_id | `birdnet-go-aikan-20260505-0500-jst-fixture-v0.1` |
| observation_window | `2026-05-05T05:00:00+09:00` to `2026-05-05T06:00:00+09:00` |
| timezone | `Asia/Tokyo` |
| site_id | `aikan-shizuoka-poc` |
| plot_id | `aikan-yard-north-plot-01` |
| source_type | `birdnet_go_csv` or `birdnet_go_mqtt` |
| source_id | `rtsp_a3f1b2c4` |
| source_name | `aikan-yard-north-mic` |
| device_id | `raspi5-birdnetgo-aikan-01` |
| birdnet_go_version | `nightly-20260502` |
| model_id | `birdnet` |
| model_version | `birdnet-go-embedded-model-unknown` |
| consent_scope | `private` |

`model_version` remains `unknown` in this fixture because the exact model hash/version must be captured from the actual BirdNET-Go deployment. Unknown model version blocks Tier 1.5 auto-promotion in the production policy unless explicitly whitelisted during PoC.

## 3. Synthetic CSV fixture

CSV shape:

```csv
species,scientific_name,confidence,start_time,end_time,file,source_name,site_id,plot_id,timezone,model_id,model_version,birdnet_go_version
Brown-eared Bulbul,Hypsipetes amaurotis,0.94,2026-05-05T05:03:12+09:00,2026-05-05T05:03:15+09:00,aikan_20260505_050000.wav,aikan-yard-north-mic,aikan-shizuoka-poc,aikan-yard-north-plot-01,Asia/Tokyo,birdnet,birdnet-go-embedded-model-unknown,nightly-20260502
Japanese Tit,Parus minor,0.91,2026-05-05T05:07:45+09:00,2026-05-05T05:07:48+09:00,aikan_20260505_050000.wav,aikan-yard-north-mic,aikan-shizuoka-poc,aikan-yard-north-plot-01,Asia/Tokyo,birdnet,birdnet-go-embedded-model-unknown,nightly-20260502
Japanese Bush Warbler,Horornis diphone,0.88,2026-05-05T05:12:04+09:00,2026-05-05T05:12:07+09:00,aikan_20260505_050000.wav,aikan-yard-north-mic,aikan-shizuoka-poc,aikan-yard-north-plot-01,Asia/Tokyo,birdnet,birdnet-go-embedded-model-unknown,nightly-20260502
Japanese White-eye,Zosterops japonicus,0.93,2026-05-05T05:15:31+09:00,2026-05-05T05:15:34+09:00,aikan_20260505_050000.wav,aikan-yard-north-mic,aikan-shizuoka-poc,aikan-yard-north-plot-01,Asia/Tokyo,birdnet,birdnet-go-embedded-model-unknown,nightly-20260502
Eurasian Tree Sparrow,Passer montanus,0.82,2026-05-05T05:21:10+09:00,2026-05-05T05:21:13+09:00,aikan_20260505_050000.wav,aikan-yard-north-mic,aikan-shizuoka-poc,aikan-yard-north-plot-01,Asia/Tokyo,birdnet,birdnet-go-embedded-model-unknown,nightly-20260502
Oriental Turtle Dove,Streptopelia orientalis,0.90,2026-05-05T05:25:40+09:00,2026-05-05T05:25:43+09:00,aikan_20260505_050000.wav,aikan-yard-north-mic,aikan-shizuoka-poc,aikan-yard-north-plot-01,Asia/Tokyo,birdnet,birdnet-go-embedded-model-unknown,nightly-20260502
Large-billed Crow,Corvus macrorhynchos,0.76,2026-05-05T05:31:08+09:00,2026-05-05T05:31:11+09:00,aikan_20260505_050000.wav,aikan-yard-north-mic,aikan-shizuoka-poc,aikan-yard-north-plot-01,Asia/Tokyo,birdnet,birdnet-go-embedded-model-unknown,nightly-20260502
Oriental Greenfinch,Chloris sinica,0.89,2026-05-05T05:36:55+09:00,2026-05-05T05:36:58+09:00,aikan_20260505_050000.wav,aikan-yard-north-mic,aikan-shizuoka-poc,aikan-yard-north-plot-01,Asia/Tokyo,birdnet,birdnet-go-embedded-model-unknown,nightly-20260502
Varied Tit,Sittiparus varius,0.92,2026-05-05T05:42:20+09:00,2026-05-05T05:42:23+09:00,aikan_20260505_050000.wav,aikan-yard-north-mic,aikan-shizuoka-poc,aikan-yard-north-plot-01,Asia/Tokyo,birdnet,birdnet-go-embedded-model-unknown,nightly-20260502
Meadow Bunting,Emberiza cioides,0.87,2026-05-05T05:47:39+09:00,2026-05-05T05:47:42+09:00,aikan_20260505_050000.wav,aikan-yard-north-mic,aikan-shizuoka-poc,aikan-yard-north-plot-01,Asia/Tokyo,birdnet,birdnet-go-embedded-model-unknown,nightly-20260502
Brown-eared Bulbul,Hypsipetes amaurotis,0.95,2026-05-05T05:52:01+09:00,2026-05-05T05:52:04+09:00,aikan_20260505_050000.wav,aikan-yard-north-mic,aikan-shizuoka-poc,aikan-yard-north-plot-01,Asia/Tokyo,birdnet,birdnet-go-embedded-model-unknown,nightly-20260502
Japanese Tit,Parus minor,0.78,2026-05-05T05:56:33+09:00,2026-05-05T05:56:36+09:00,aikan_20260505_050000.wav,aikan-yard-north-mic,aikan-shizuoka-poc,aikan-yard-north-plot-01,Asia/Tokyo,birdnet,birdnet-go-embedded-model-unknown,nightly-20260502
```

## 4. Synthetic MQTT fixture

These three payloads test the `sourceId` / `sourceName` path and overlap with the CSV source identity.

```json
{
  "sourceId": "rtsp_a3f1b2c4",
  "sourceName": "aikan-yard-north-mic",
  "timestamp": "2026-05-05T05:03:12+09:00",
  "species": "Brown-eared Bulbul",
  "scientificName": "Hypsipetes amaurotis",
  "confidence": 0.94,
  "startOffsetSec": 0,
  "endOffsetSec": 3,
  "deviceId": "raspi5-birdnetgo-aikan-01",
  "model_id": "birdnet",
  "model_version": "birdnet-go-embedded-model-unknown"
}
```

```json
{
  "sourceId": "rtsp_a3f1b2c4",
  "sourceName": "aikan-yard-north-mic",
  "timestamp": "2026-05-05T05:25:40+09:00",
  "species": "Oriental Turtle Dove",
  "scientificName": "Streptopelia orientalis",
  "confidence": 0.9,
  "startOffsetSec": 0,
  "endOffsetSec": 3,
  "deviceId": "raspi5-birdnetgo-aikan-01",
  "payload_hash": "sha256:fixture-mqtt-002"
}
```

```json
{
  "sourceId": "rtsp_a3f1b2c4",
  "sourceName": "aikan-yard-north-mic",
  "timestamp": "2026-05-05T05:31:08+09:00",
  "species": "Large-billed Crow",
  "scientificName": "Corvus macrorhynchos",
  "confidence": 0.76,
  "startOffsetSec": 0,
  "endOffsetSec": 3,
  "deviceId": "raspi5-birdnetgo-aikan-01",
  "payload_hash": "sha256:fixture-mqtt-003"
}
```

## 5. Manual normalized-event mapping

| raw input | normalized field | mapped value rule | G gate dependency |
|---|---|---|---|
| CSV row count within 60 minutes | event count | one non-duplicate row -> one Tier 1 candidate | G1 |
| MQTT payload count within 60 minutes | event count | one non-duplicate payload -> one Tier 1 candidate | G1 |
| `confidence` | `confidence` | numeric 0.0-1.0 | G2, Tier 1.5 |
| `start_time` / `timestamp + startOffsetSec` | `observed_start_at` | ISO 8601 | G1, G4 |
| `end_time` / `timestamp + endOffsetSec` | `observed_end_at` | ISO 8601 | G1, G4 |
| `species` | `species_label` | copy as provider label | G2 |
| `scientific_name` / `scientificName` | `scientific_name` | copy when supplied | G2 |
| `sourceId` | `source_id` | BirdNET-Go stable hash-derived ID | dedupe, provenance |
| `sourceName` / `source_name` | `source_name` | human-readable source name | dedupe, review filtering |
| `site_id` | `site_id` | required before production ingest | G1-G5 site slicing |
| `plot_id` | `plot_id` | optional plot slicing | site / plot reports |
| `model_id` | `model_id` | `birdnet` | G2 provenance |
| `model_version` | `model_version` | exact version/hash when known | G2, Tier 1.5 hold |
| `file` / `payload_hash` | `provenance.raw_payload_hash` | SHA-256 over source row/payload, not raw audio | audit |
| fixture default | `basisOfRecord` | `MachineObservation` | canonical mapping |
| fixture default | `samplingProtocol` | `passive-audio` | canonical mapping |
| fixture default | `detection_method` | `ai_audio` | canonical mapping |
| fixture default | `consent_scope` | `private` | privacy |

Example normalized event:

```json
{
  "ingest_schema_version": "birdnet-go-event-only-v0.1",
  "source_type": "birdnet_go_csv",
  "source_id": "rtsp_a3f1b2c4",
  "source_name": "aikan-yard-north-mic",
  "site_id": "aikan-shizuoka-poc",
  "plot_id": "aikan-yard-north-plot-01",
  "observed_start_at": "2026-05-05T05:03:12+09:00",
  "observed_end_at": "2026-05-05T05:03:15+09:00",
  "timezone": "Asia/Tokyo",
  "species_label": "Brown-eared Bulbul",
  "scientific_name": "Hypsipetes amaurotis",
  "confidence": 0.94,
  "detection_method": "ai_audio",
  "basisOfRecord": "MachineObservation",
  "samplingProtocol": "passive-audio",
  "model_id": "birdnet",
  "model_version": "birdnet-go-embedded-model-unknown",
  "birdnet_go_version": "nightly-20260502",
  "device_id": "raspi5-birdnetgo-aikan-01",
  "consent_scope": "private",
  "provenance": {
    "created_by": "import",
    "imported_at": "2026-05-05T06:05:00+09:00",
    "adapter_name": "birdnet_go_csv_fixture_mapper",
    "adapter_version": "v0.1",
    "raw_payload_hash": "sha256:fixture-csv-row-001"
  }
}
```

## 6. Canonical write mapping

| Canonical layer | Field | Value for fixture | Notes |
|---|---|---|---|
| observation_event | `eventID` | generated UUID | immutable raw event |
| observation_event | `observed_at` | `observed_start_at` | event start |
| observation_event | `recorded_at` | ingest time | not BirdNET detection time |
| observation_event | `source_device` | `device_id` or `source_name` | source identity |
| observation_event | `samplingProtocol` | `passive-audio` | fixed |
| observation_event | `samplingEffort` | `60min; source=aikan-yard-north-mic` | aggregation-level effort |
| observation_event | `provenance` | adapter, source, payload hash | required |
| occurrence | `basisOfRecord` | `MachineObservation` | fixed |
| occurrence | `occurrenceStatus` | `present` | AI candidate presence |
| occurrence | `evidence_tier` | `1` by default | `1.5` only if policy passes |
| evidence | `media_type` | `audio-derived` | no raw audio required |
| evidence | `audio_snippet_hash` | optional | equality check only |
| evidence | `spectrogram_ref` | optional | reviewer aid |
| identification | `identificationMethod` | `ai_audio` | fixed |
| identification | `confidence` | normalized confidence | 0-1 |
| review | `review_status` | `needs_review` for Tier 1; `confirmed` after reviewer | G2-G4 |

## 7. G1-G7 measurement from this fixture

| Gate | Can measure from fixture? | Required fields | Calculation | Fixture result | Interpretation |
|---|---:|---|---|---:|---|
| G1 detection volume | yes | `observed_start_at`, event count, `evidence_tier` | Tier 1 events in 60 min | 12/hour | Passes fixture threshold; not field evidence |
| G2 AI accuracy | partially | Tier 1.5 candidates + reviewer outcomes | reviewer-confirmed Tier 1.5 / reviewed Tier 1.5 | needs review log | Not measurable from raw detections alone |
| G3 review speed | partially | review start/end timestamps | median minutes per record | needs review log | Not measurable from raw detections alone |
| G4 Tier 1 to Tier 2 speed | partially | detection time + reviewer approval time | median approval lag | needs review log | Not measurable from raw detections alone |
| G5 active reviewer | no | reviewer IDs + monthly activity | count reviewers with >=1 review/month | needs review system | Not an ingest metric |
| G6 CPU peak | no | Prometheus/server metrics | max CPU during ingest/inference window | needs ops metrics | Edge inference preferred |
| G7 storage | partially | stored bytes, derivative refs | storage growth over period | event-only small; derivatives unknown | Needs storage accounting |

The fixture proves G1 can be measured immediately from event-only ingest. G2-G4 require review logs. G5 requires reviewer activity logs. G6 requires Prometheus or server metrics. G7 requires byte accounting for spectrograms, optional clips, and metadata.

## 8. Minimal review log fixture for G2-G4

This is not a biological truth assertion. It is a shape test for metrics.

| event_key | tier_before | candidate_tier | reviewer_action | reviewer_id | review_started_at | reviewed_at | tier_after | reason |
|---|---:|---:|---|---|---|---|---:|---|
| `fixture-csv-row-001` | 1 | 1.5 | approve | `reviewer-001` | `2026-05-05T07:00:00+09:00` | `2026-05-05T07:02:10+09:00` | 2 | sound plausible; spectrogram usable |
| `fixture-csv-row-002` | 1 | 1.5 | approve | `reviewer-002` | `2026-05-05T07:03:00+09:00` | `2026-05-05T07:05:20+09:00` | 2 | sound plausible; common local species |
| `fixture-csv-row-004` | 1 | 1.5 | reject | `reviewer-001` | `2026-05-05T07:06:00+09:00` | `2026-05-05T07:08:50+09:00` | 1 | insufficient evidence |
| `fixture-csv-row-006` | 1 | 1.5 | approve | `reviewer-003` | `2026-05-05T07:09:00+09:00` | `2026-05-05T07:10:45+09:00` | 2 | low ambiguity |
| `fixture-csv-row-009` | 1 | 1.5 | approve | `reviewer-002` | `2026-05-05T07:11:00+09:00` | `2026-05-05T07:13:20+09:00` | 2 | spectrogram usable |

Metric shape:

- G2 = 4 approved / 5 reviewed Tier 1.5 candidates = 80%.
- G3 median review time = 2 minutes 20 seconds.
- G4 median Tier 1 to Tier 2 lag for approved records is about 1 hour 22 minutes.
- G5 fixture active reviewers = 3, below the PoC target of 5. This fixture deliberately shows that ingest success alone is not enough.

## 9. Acceptance for implementation readiness

Implementation can start only when:

- A real BirdNET-Go CSV or MQTT export replaces this synthetic fixture, or the team explicitly accepts this fixture for parser unit tests only.
- `model_version` / model hash capture is resolved.
- The `platform_v2` owner confirms the target ingest endpoint and service files.
- Review log fields needed for G2-G4 are available or added to the implementation backlog.
- Storage accounting for spectrograms and optional clips is defined for G7.

Immediate next engineering target:

- Add TypeScript fixture tests for CSV and MQTT normalization under `E:\Projects\03_ikimon.life_Product\platform_v2\` after the endpoint/service ownership is fixed.
