import assert from "node:assert/strict";
import test from "node:test";
import {
  computePassiveAudioDedupeKey,
  defaultPassiveAudioCalibrationDecision,
  isTier15PassiveAudioCandidate,
  mapBirdnetCsvRowToPassiveAudioEvent,
  mapBirdnetMqttPayloadToPassiveAudioEvent,
  normalizePassiveAudioDetectionEvent,
  PassiveAudioValidationError,
  regionKeysForPassiveAudioCalibration,
} from "./passiveAudioIngest.js";

const baseEvent = {
  ingest_schema_version: "birdnet-go-event-only-v0.1",
  source_type: "birdnet_go_rest",
  source_id: "rtsp_a3f1b2c4",
  source_name: "aikan-yard-north-mic",
  site_id: "aikan-shizuoka-poc",
  observed_start_at: "2026-05-05T05:03:12+09:00",
  observed_end_at: "2026-05-05T05:03:15+09:00",
  timezone: "Asia/Tokyo",
  species_label: "Brown-eared Bulbul",
  scientific_name: "Hypsipetes amaurotis",
  confidence: 0.94,
  detection_method: "ai_audio",
  basisOfRecord: "MachineObservation",
  samplingProtocol: "passive-audio",
  model_id: "birdnet",
  model_version: "birdnet-go-embedded-model-20260502",
  provenance: {
    created_by: "import",
    imported_at: "2026-05-05T06:05:00+09:00",
    adapter_name: "test_mapper",
    adapter_version: "v0.1",
  },
};

test("BirdNET CSV fixture maps to normalized passive audio event", () => {
  const event = mapBirdnetCsvRowToPassiveAudioEvent({
    species: "Brown-eared Bulbul",
    scientific_name: "Hypsipetes amaurotis",
    confidence: "0.94",
    start_time: "2026-05-05T05:03:12+09:00",
    end_time: "2026-05-05T05:03:15+09:00",
    file: "aikan_20260505_050000.wav",
    source_name: "aikan-yard-north-mic",
    site_id: "aikan-shizuoka-poc",
    plot_id: "aikan-yard-north-plot-01",
    timezone: "Asia/Tokyo",
    model_version: "birdnet-go-embedded-model-20260502",
  }, { importedAt: "2026-05-05T06:05:00+09:00" });

  assert.equal(event.source_type, "birdnet_go_csv");
  assert.equal(event.source_name, "aikan-yard-north-mic");
  assert.equal(event.model_id, "birdnet");
  assert.equal(event.basisOfRecord, "MachineObservation");
  assert.equal(event.samplingProtocol, "passive-audio");
  assert.equal(event.detection_method, "ai_audio");
  assert.equal(event.consent_scope, "private");
  assert.equal(event.observation_method, "passive_audio");
  assert.equal(event.protocol_id, "passive-audio/event-only/v0.1");
  assert.equal(event.plot_id, "aikan-yard-north-plot-01");
});

test("BirdNET MQTT fixture maps sourceId and sourceName", () => {
  const event = mapBirdnetMqttPayloadToPassiveAudioEvent({
    sourceId: "rtsp_a3f1b2c4",
    sourceName: "aikan-yard-north-mic",
    timestamp: "2026-05-05T05:03:12+09:00",
    species: "Brown-eared Bulbul",
    scientificName: "Hypsipetes amaurotis",
    confidence: 0.94,
    startOffsetSec: 1,
    endOffsetSec: 4,
    deviceId: "raspi5-birdnetgo-aikan-01",
    device_deployment_id: "deploy-aikan-north-202605",
    sample_rate_hz: 48000,
    frequency_range_hz: { low: 0, high: 24000 },
    inference_window_sec: 3,
    embedding_model_id: "perch-v2",
    embedding_ref: "r2://private/audio-embedding/001.npy",
    sampling_effort: { duty_cycle: "1min/5min" },
    sensor_status: { battery: "ok" },
  }, { siteId: "aikan-shizuoka-poc", importedAt: "2026-05-05T06:05:00+09:00" });

  assert.equal(event.source_id, "rtsp_a3f1b2c4");
  assert.equal(event.source_name, "aikan-yard-north-mic");
  assert.equal(event.observed_start_at, "2026-05-04T20:03:13.000Z");
  assert.equal(event.observed_end_at, "2026-05-04T20:03:16.000Z");
  assert.equal(event.device_deployment_id, "deploy-aikan-north-202605");
  assert.equal(event.sample_rate_hz, 48000);
  assert.deepEqual(event.frequency_range_hz, { low: 0, high: 24000 });
  assert.equal(event.inference_window_sec, 3);
  assert.equal(event.embedding_model_id, "perch-v2");
  assert.deepEqual(event.sampling_effort, { duty_cycle: "1min/5min" });
  assert.deepEqual(event.sensor_status, { battery: "ok" });
});

test("normalized event validation rejects required and invalid fields", () => {
  assert.throws(
    () => normalizePassiveAudioDetectionEvent({ ...baseEvent, site_id: "" }),
    /site_id_required/,
  );
  assert.throws(
    () => normalizePassiveAudioDetectionEvent({ ...baseEvent, confidence: 1.1 }),
    /confidence_out_of_range/,
  );
  assert.throws(
    () => normalizePassiveAudioDetectionEvent({ ...baseEvent, confidence: -0.1 }),
    /confidence_out_of_range/,
  );
  assert.throws(
    () => normalizePassiveAudioDetectionEvent({ ...baseEvent, observed_start_at: "not-a-date" }),
    /observed_start_at_invalid/,
  );
  assert.throws(
    () => normalizePassiveAudioDetectionEvent({
      ...baseEvent,
      observed_start_at: "2026-05-05T05:03:15+09:00",
      observed_end_at: "2026-05-05T05:03:12+09:00",
    }),
    /observed_end_before_start/,
  );
});

test("dedupe key is stable and raw payload hash takes precedence", () => {
  const event = normalizePassiveAudioDetectionEvent(baseEvent);
  const same = normalizePassiveAudioDetectionEvent({ ...baseEvent });
  const different = normalizePassiveAudioDetectionEvent({
    ...baseEvent,
    observed_end_at: "2026-05-05T05:03:18+09:00",
  });
  assert.equal(computePassiveAudioDedupeKey(event), computePassiveAudioDedupeKey(same));
  assert.notEqual(computePassiveAudioDedupeKey(event), computePassiveAudioDedupeKey(different));

  const withRawHash = normalizePassiveAudioDetectionEvent({
    ...baseEvent,
    provenance: { ...baseEvent.provenance, raw_payload_hash: "sha256:fixture-row-001" },
  });
  assert.equal(computePassiveAudioDedupeKey(withRawHash), "raw_payload_hash:sha256:fixture-row-001");
});

test("Tier 1.5 candidate flag is conservative and never mutates evidence tier", () => {
  const candidate = normalizePassiveAudioDetectionEvent(baseEvent);
  assert.equal(isTier15PassiveAudioCandidate(candidate), true);

  const unknownModel = normalizePassiveAudioDetectionEvent({
    ...baseEvent,
    model_version: "birdnet-go-embedded-model-unknown",
  });
  assert.equal(isTier15PassiveAudioCandidate(unknownModel), false);

  assert.throws(
    () => normalizePassiveAudioDetectionEvent(null),
    PassiveAudioValidationError,
  );
});

test("Tier 1.5 candidate gate can use active calibration thresholds without auto-verifying", () => {
  const calibratedCandidate = normalizePassiveAudioDetectionEvent({
    ...baseEvent,
    confidence: 0.86,
    plot_id: "aikan-yard-north-plot-01",
  });
  assert.equal(isTier15PassiveAudioCandidate(calibratedCandidate), false);
  assert.equal(isTier15PassiveAudioCandidate(calibratedCandidate, {
    source: "registry",
    threshold: 0.85,
    regionKey: "site:aikan-shizuoka-poc",
    taxonName: "Hypsipetes amaurotis",
    calibrationId: "00000000-0000-0000-0000-000000000001",
    calibrationStatus: "active",
  }), true);
  assert.deepEqual(regionKeysForPassiveAudioCalibration(calibratedCandidate), [
    "plot:aikan-yard-north-plot-01",
    "site:aikan-shizuoka-poc",
    "global",
  ]);
  assert.deepEqual(defaultPassiveAudioCalibrationDecision(calibratedCandidate), {
    source: "default",
    threshold: 0.9,
    regionKey: "global",
    taxonName: "Hypsipetes amaurotis",
  });
});
