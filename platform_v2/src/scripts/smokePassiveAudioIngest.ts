import { Pool } from "pg";

type SmokeOptions = {
  baseUrl: string;
  fixturePrefix: string;
  privilegedWriteApiKey: string;
  databaseUrl: string;
};

type JsonResponse = {
  status: number;
  ok: boolean;
  payload: unknown;
};

function parseArgs(argv: string[]): SmokeOptions {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}`;
  const options: SmokeOptions = {
    baseUrl: process.env.V2_BASE_URL ?? "http://127.0.0.1:3200",
    fixturePrefix: `passive-audio-${stamp}`,
    privilegedWriteApiKey: process.env.V2_PRIVILEGED_WRITE_API_KEY ?? "",
    databaseUrl: process.env.DATABASE_URL ?? "",
  };

  for (const arg of argv) {
    if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length).trim() || options.baseUrl;
      continue;
    }
    if (arg.startsWith("--fixture-prefix=")) {
      options.fixturePrefix = arg.slice("--fixture-prefix=".length).trim() || options.fixturePrefix;
    }
  }
  return options;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function postJson(url: string, payload: unknown, key: string): Promise<JsonResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-ikimon-write-key": key,
    },
    body: JSON.stringify(payload),
  });
  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  return { status: response.status, ok: response.ok, payload: parsed };
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`response_${key}_missing`);
  }
  return value;
}

function buildFixture(prefix: string): Record<string, unknown> {
  const observedStartAt = "2026-05-05T05:03:12+09:00";
  return {
    ingest_schema_version: "birdnet-go-event-only-v0.1",
    source_type: "birdnet_go_rest",
    source_id: `staging-${prefix}-source`,
    source_name: `staging-${prefix}-mic`,
    site_id: `staging-${prefix}-site`,
    plot_id: `staging-${prefix}-plot`,
    observed_start_at: observedStartAt,
    observed_end_at: "2026-05-05T05:03:15+09:00",
    timezone: "Asia/Tokyo",
    species_label: "Brown-eared Bulbul",
    scientific_name: "Hypsipetes amaurotis",
    confidence: 0.94,
    detection_method: "ai_audio",
    basisOfRecord: "MachineObservation",
    samplingProtocol: "passive-audio",
    model_id: "birdnet",
    model_version: "birdnet-go-staging-smoke-20260504",
    birdnet_go_version: "nightly-20260502",
    device_id: `staging-${prefix}-device`,
    audio_snippet_hash: `sha256:${prefix}:audio-snippet`,
    consent_scope: "private",
    provenance: {
      created_by: "import",
      imported_at: new Date().toISOString(),
      adapter_name: "staging_passive_audio_smoke",
      adapter_version: "v0.1",
      raw_payload_hash: `sha256:${prefix}:birdnet-row-001`,
    },
  };
}

async function verifyDb(options: SmokeOptions, ids: { dedupeKey: string; visitId: string; occurrenceId: string; segmentId: string }): Promise<Record<string, unknown>> {
  const pool = new Pool({ connectionString: options.databaseUrl });
  try {
    const result = await pool.query<{
      ledger_count: string;
      visit_count: string;
      occurrence_count: string;
      identification_count: string;
      evidence_count: string;
      segment_count: string;
      detection_count: string;
      review_count: string;
      tier15_candidate: boolean | null;
      evidence_tier: string | null;
      review_status: string | null;
      segment_storage_provider: string | null;
      segment_bytes: string | null;
      g1_site_hour_count: string;
    }>(
      `select
          (select count(*) from passive_audio_ingest_events where dedupe_key = $1)::text as ledger_count,
          (select count(*) from visits where visit_id = $2 and source_kind = 'passive_audio_ingest' and public_visibility = 'review' and quality_review_status = 'needs_review')::text as visit_count,
          (select count(*) from occurrences where occurrence_id = $3 and basis_of_record = 'MachineObservation' and ai_assessment_status = 'ai_audio_candidate')::text as occurrence_count,
          (select count(*) from identifications where occurrence_id = $3 and actor_kind = 'ai' and identification_method = 'ai_audio')::text as identification_count,
          (select count(*) from evidence_assets where occurrence_id = $3 and asset_role = 'observation_audio' and source_payload->>'media_type' = 'audio-derived' and source_payload->>'raw_audio_stored' = 'false')::text as evidence_count,
          (select count(*) from audio_segments where segment_id = $4::uuid and storage_provider = 'event_only' and bytes = 0)::text as segment_count,
          (select count(*) from audio_detections where segment_id = $4::uuid and provider = 'birdnet')::text as detection_count,
          (select count(*) from observation_quality_reviews where occurrence_id = $3 and review_kind = 'passive_audio_ai_detection' and review_status = 'needs_review')::text as review_count,
          (select tier15_candidate from passive_audio_ingest_events where dedupe_key = $1 limit 1) as tier15_candidate,
          (select evidence_tier::text from occurrences where occurrence_id = $3 limit 1) as evidence_tier,
          (select review_status from observation_quality_reviews where occurrence_id = $3 and review_kind = 'passive_audio_ai_detection' limit 1) as review_status,
          (select storage_provider from audio_segments where segment_id = $4::uuid limit 1) as segment_storage_provider,
          (select bytes::text from audio_segments where segment_id = $4::uuid limit 1) as segment_bytes,
          (select count(*) from passive_audio_ingest_events
            where site_id = (select site_id from passive_audio_ingest_events where dedupe_key = $1 limit 1)
              and observed_start_at >= '2026-05-05T05:00:00+09:00'::timestamptz
              and observed_start_at < '2026-05-05T06:00:00+09:00'::timestamptz)::text as g1_site_hour_count`,
      [ids.dedupeKey, ids.visitId, ids.occurrenceId, ids.segmentId],
    );
    const row = result.rows[0];
    if (!row) throw new Error("db_verification_no_row");
    const counts = {
      ledger: Number(row.ledger_count),
      visit: Number(row.visit_count),
      occurrence: Number(row.occurrence_count),
      identification: Number(row.identification_count),
      evidence: Number(row.evidence_count),
      audioSegment: Number(row.segment_count),
      audioDetection: Number(row.detection_count),
      review: Number(row.review_count),
    };
    for (const [name, count] of Object.entries(counts)) {
      if (count !== 1) throw new Error(`db_${name}_count_expected_1_got_${count}`);
    }
    if (row.tier15_candidate !== true) throw new Error("db_tier15_candidate_not_true");
    if (Number(row.evidence_tier) !== 1) throw new Error(`db_evidence_tier_expected_1_got_${row.evidence_tier}`);
    if (row.review_status !== "needs_review") throw new Error(`db_review_status_unexpected_${row.review_status}`);
    if (row.segment_storage_provider !== "event_only") throw new Error("db_segment_storage_provider_not_event_only");
    if (Number(row.segment_bytes) !== 0) throw new Error("db_segment_bytes_not_zero");

    return {
      counts,
      tier15Candidate: row.tier15_candidate,
      evidenceTier: Number(row.evidence_tier),
      reviewStatus: row.review_status,
      segmentStorageProvider: row.segment_storage_provider,
      segmentBytes: Number(row.segment_bytes),
      g1SiteHourCount: Number(row.g1_site_hour_count),
      g2ToG4Ready: {
        tier15CandidateTracked: row.tier15_candidate === true,
        reviewQueueRecordPresent: counts.review === 1,
        detectionAndReviewTimestampsAvailable: true,
      },
    };
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options.privilegedWriteApiKey) throw new Error("V2_PRIVILEGED_WRITE_API_KEY is required");
  if (!options.databaseUrl) throw new Error("DATABASE_URL is required");

  const fixture = buildFixture(options.fixturePrefix);
  const response = await postJson(
    `${options.baseUrl.replace(/\/$/, "")}/api/v1/ingest/audio-detections`,
    fixture,
    options.privilegedWriteApiKey,
  );
  if (!response.ok) {
    throw new Error(`passive_audio_ingest_http_${response.status}`);
  }
  if (!isRecord(response.payload)) throw new Error("passive_audio_ingest_response_not_object");
  if (response.payload.ok !== true) throw new Error("passive_audio_ingest_response_not_ok");
  if (response.payload.accepted !== 1) throw new Error(`passive_audio_ingest_accepted_expected_1_got_${String(response.payload.accepted)}`);
  if (!Array.isArray(response.payload.results) || !isRecord(response.payload.results[0])) {
    throw new Error("passive_audio_ingest_result_missing");
  }
  const first = response.payload.results[0];
  if (first.status !== "accepted") throw new Error(`passive_audio_ingest_result_status_${String(first.status)}`);
  const ids = {
    dedupeKey: requireString(first, "dedupeKey"),
    visitId: requireString(first, "visitId"),
    occurrenceId: requireString(first, "occurrenceId"),
    segmentId: requireString(first, "segmentId"),
  };
  const db = await verifyDb(options, ids);
  console.log(JSON.stringify({
    ok: true,
    fixturePrefix: options.fixturePrefix,
    endpoint: "/api/v1/ingest/audio-detections",
    ids,
    db,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : "unknown_passive_audio_smoke_failure",
  }, null, 2));
  process.exitCode = 1;
});
