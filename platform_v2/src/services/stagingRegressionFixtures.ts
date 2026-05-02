import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "../db.js";
import { buildPlaceId, buildPlaceName, makeOccurrenceId, normalizeTimestamp, upsertAssetBlob } from "./writeSupport.js";

const TINY_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK8QAAAAASUVORK5CYII=";
const FIXTURE_PREFIX_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,80}$/;

type RegressionFixtureKind = "manual" | "historical" | "smoke";

type RegressionFixtureSeedInput = {
  fixturePrefix: string;
};

type RegressionFixtureSummary = {
  visitId: string;
  occurrenceId: string;
  placeId: string;
  subjectLabel: string;
  observedAt: string;
  sourceKind: string;
  expectedVisibility: "manual_only" | "all_research_artifacts_only" | "excluded";
};

export type StagingRegressionFixtureSeedResult = {
  fixturePrefix: string;
  user: {
    userId: string;
    displayName: string;
  };
  manual: RegressionFixtureSummary;
  historical: RegressionFixtureSummary;
  smoke: RegressionFixtureSummary;
};

type FixturePhoto = {
  storagePath: string;
  publicUrl: string;
  sha256: string;
  bytes: number;
  mimeType: string;
  widthPx: number;
  heightPx: number;
};

type FixtureMediaRegion = {
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidenceScore: number;
  note: string;
};

type FixtureVisitInput = {
  kind: RegressionFixtureKind;
  fixturePrefix: string;
  userId: string;
  observedAt: string;
  latitude: number;
  longitude: number;
  prefecture: string;
  municipality: string;
  localityNote: string;
  siteId: string;
  siteName: string;
  note: string;
  subjectLabel: string;
  scientificName: string;
  sourceKind: "v2_observation" | "legacy_observation";
  sourcePayload: Record<string, unknown>;
  qualityGrade: string | null;
  evidenceTier: number;
  photo: FixturePhoto;
  mediaRegions?: FixtureMediaRegion[];
};

function assertFixturePrefix(value: string): string {
  const fixturePrefix = value.trim();
  if (!FIXTURE_PREFIX_PATTERN.test(fixturePrefix)) {
    throw new Error("invalid_fixture_prefix");
  }
  return fixturePrefix;
}

async function ensureFixturePhoto(fixturePrefix: string, kind: RegressionFixtureKind): Promise<FixturePhoto> {
  const buffer = Buffer.from(TINY_PNG_BASE64, "base64");
  const storagePath = `uploads/staging-regression/${fixturePrefix}/${kind}.${kind === "manual" ? "svg" : "png"}`;
  if (kind === "manual") {
    const svgMarker = Buffer.from("vertical-region-fixture.svg", "utf8");
    return {
      storagePath,
      publicUrl: "/assets/regression/vertical-region-fixture.svg",
      sha256: createHash("sha256").update(svgMarker).digest("hex"),
      bytes: svgMarker.byteLength,
      mimeType: "image/svg+xml",
      widthPx: 320,
      heightPx: 640,
    };
  }
  return {
    storagePath,
    publicUrl: "/assets/img/icon-192.png",
    sha256: createHash("sha256").update(buffer).digest("hex"),
    bytes: buffer.byteLength,
    mimeType: "image/png",
    widthPx: 192,
    heightPx: 192,
  };
}

async function upsertFixtureUser(
  client: PoolClient,
  userId: string,
  displayName: string,
): Promise<void> {
  await client.query(
    `insert into users (
        user_id, legacy_user_id, display_name, email, password_hash, avatar_asset_id,
        role_name, rank_label, auth_provider, oauth_id, banned, created_at, updated_at
     ) values (
        $1, $2, $3, $4, null, null, 'Observer', '観察者', 'staging_regression', null, false, now(), now()
     )
     on conflict (user_id) do update set
        display_name = excluded.display_name,
        email = excluded.email,
        role_name = excluded.role_name,
        rank_label = excluded.rank_label,
        auth_provider = excluded.auth_provider,
        banned = false,
        updated_at = now()`,
    [userId, userId, displayName, `${userId}@example.invalid`],
  );
}

async function upsertFixtureVisit(client: PoolClient, input: FixtureVisitInput): Promise<RegressionFixtureSummary> {
  const visitId = `${input.fixturePrefix}-${input.kind}`;
  const occurrenceId = makeOccurrenceId(visitId, 0);
  const placeId = buildPlaceId({
    siteId: input.siteId,
    latitude: input.latitude,
    longitude: input.longitude,
    municipality: input.municipality,
    prefecture: input.prefecture,
  });
  const observedAt = normalizeTimestamp(input.observedAt);
  const sourceName = String(input.sourcePayload.source ?? "");
  const sourcePayload = {
    ...input.sourcePayload,
    source: sourceName,
    fixture_prefix: input.fixturePrefix,
    scenario: input.kind,
  };

  await client.query(
    `insert into places (
        place_id, legacy_place_key, legacy_site_id, canonical_name, locality_label,
        source_kind, country_code, prefecture, municipality, center_latitude, center_longitude, metadata, created_at, updated_at
     ) values (
        $1, $2, $3, $4, $5, $6, 'JP', $7, $8, $9, $10, $11::jsonb, $12, now()
     )
     on conflict (place_id) do update set
        legacy_site_id = excluded.legacy_site_id,
        canonical_name = excluded.canonical_name,
        locality_label = excluded.locality_label,
        source_kind = excluded.source_kind,
        prefecture = excluded.prefecture,
        municipality = excluded.municipality,
        center_latitude = excluded.center_latitude,
        center_longitude = excluded.center_longitude,
        metadata = excluded.metadata,
        updated_at = now()`,
    [
      placeId,
      placeId,
      input.siteId,
      buildPlaceName({ siteName: input.siteName, municipality: input.municipality, prefecture: input.prefecture }),
      input.localityNote,
      input.sourceKind,
      input.prefecture,
      input.municipality,
      input.latitude,
      input.longitude,
      JSON.stringify({
        source: sourceName,
        fixture_prefix: input.fixturePrefix,
        scenario: input.kind,
      }),
      observedAt,
    ],
  );

  await client.query(
    `insert into visits (
        visit_id, legacy_observation_id, place_id, user_id, observed_at, session_mode, visit_mode,
        complete_checklist_flag, target_taxa_scope, point_latitude, point_longitude,
        observed_country, observed_prefecture, observed_municipality, locality_note, note,
        source_kind, source_payload, created_at, updated_at
     ) values (
        $1, $2, $3, $4, $5, 'standard', 'manual', false, null, $6, $7,
        'JP', $8, $9, $10, $11, $12, $13::jsonb, $14, now()
     )
     on conflict (visit_id) do update set
        legacy_observation_id = excluded.legacy_observation_id,
        place_id = excluded.place_id,
        user_id = excluded.user_id,
        observed_at = excluded.observed_at,
        point_latitude = excluded.point_latitude,
        point_longitude = excluded.point_longitude,
        observed_prefecture = excluded.observed_prefecture,
        observed_municipality = excluded.observed_municipality,
        locality_note = excluded.locality_note,
        note = excluded.note,
        source_kind = excluded.source_kind,
        source_payload = excluded.source_payload,
        updated_at = now()`,
    [
      visitId,
      visitId,
      placeId,
      input.userId,
      observedAt,
      input.latitude,
      input.longitude,
      input.prefecture,
      input.municipality,
      input.localityNote,
      input.note,
      input.sourceKind,
      JSON.stringify(sourcePayload),
      observedAt,
    ],
  );

  await client.query(
    `insert into occurrences (
        occurrence_id, visit_id, legacy_observation_id, subject_index, scientific_name, vernacular_name,
        taxon_rank, basis_of_record, organism_origin, cultivation, occurrence_status,
        confidence_score, evidence_tier, data_quality, quality_grade, ai_assessment_status, best_supported_descendant_taxon,
        biome, substrate_tags, evidence_tags, source_payload, created_at, updated_at
     ) values (
        $1, $2, $3, 0, $4, $5, 'species', 'HumanObservation', null, null, 'present',
        null, $6, 'regression_fixture', $7, null, null,
        null, '[]'::jsonb, '["regression_fixture"]'::jsonb, $8::jsonb, $9, now()
     )
     on conflict (occurrence_id) do update set
        scientific_name = excluded.scientific_name,
        vernacular_name = excluded.vernacular_name,
        evidence_tier = excluded.evidence_tier,
        data_quality = excluded.data_quality,
        quality_grade = excluded.quality_grade,
        source_payload = excluded.source_payload,
        updated_at = now()`,
    [
      occurrenceId,
      visitId,
      visitId,
      input.scientificName,
      input.subjectLabel,
      input.evidenceTier,
      input.qualityGrade,
      JSON.stringify({
        ...sourcePayload,
        v2_subject: {
          subject_index: 0,
          is_primary: true,
          role_hint: "primary",
        },
      }),
      observedAt,
    ],
  );

  const blobId = await upsertAssetBlob(client, {
    storageBackend: "local_fs",
    storagePath: input.photo.storagePath,
    mediaType: "image",
    mimeType: input.photo.mimeType,
    publicUrl: input.photo.publicUrl,
    sha256: input.photo.sha256,
    bytes: input.photo.bytes,
    widthPx: input.photo.widthPx,
    heightPx: input.photo.heightPx,
    sourcePayload: {
      source: sourceName,
      fixture_prefix: input.fixturePrefix,
      scenario: input.kind,
    },
  });

  const assetId = randomUUID();
  const assetResult = await client.query<{ asset_id: string }>(
    `insert into evidence_assets (
        asset_id, blob_id, occurrence_id, visit_id, asset_role, legacy_asset_key, legacy_relative_path, source_payload
     ) values (
        $1::uuid, $2::uuid, $3, $4, 'observation_photo', $5, $6, $7::jsonb
     )
     on conflict (legacy_asset_key) do update set
        blob_id = excluded.blob_id,
        occurrence_id = excluded.occurrence_id,
        visit_id = excluded.visit_id,
        legacy_relative_path = excluded.legacy_relative_path,
        source_payload = excluded.source_payload
      returning asset_id::text as asset_id`,
    [
      assetId,
      blobId,
      occurrenceId,
      visitId,
      `regression_photo:${visitId}`,
      input.photo.storagePath,
      JSON.stringify({
        source: sourceName,
        fixture_prefix: input.fixturePrefix,
        scenario: input.kind,
      }),
    ],
  );
  const storedAssetId = assetResult.rows[0]?.asset_id ?? assetId;

  if (input.mediaRegions && input.mediaRegions.length > 0) {
    await client.query(
      `delete from observation_ai_runs
        where visit_id = $1
          and source_payload->>'fixture_prefix' = $2
          and source_payload->>'scenario' = $3`,
      [visitId, input.fixturePrefix, input.kind],
    );

    const aiRunId = randomUUID();
    await client.query(
      `insert into observation_ai_runs (
          ai_run_id, visit_id, trigger_occurrence_id, pipeline_version, model_provider,
          model_name, model_version, prompt_version, taxonomy_version, input_asset_fingerprint,
          trigger_kind, triggered_by, run_status, source_payload, generated_at, created_at
       ) values (
          $1::uuid, $2, $3, 'staging-regression', 'fixture',
          'region-alignment-fixture', '1', 'fixture', 'fixture', $4,
          'staging_fixture', $5, 'succeeded', $6::jsonb, $7, now()
       )`,
      [
        aiRunId,
        visitId,
        occurrenceId,
        input.photo.sha256,
        input.userId,
        JSON.stringify({
          source: sourceName,
          fixture_prefix: input.fixturePrefix,
          scenario: input.kind,
        }),
        observedAt,
      ],
    );

    for (const region of input.mediaRegions) {
      await client.query(
        `insert into subject_media_regions (
            ai_run_id, occurrence_id, candidate_id, asset_id, normalized_rect,
            frame_time_ms, confidence_score, source_kind, source_model, source_payload, created_at
         ) values (
            $1::uuid, $2, null, $3::uuid, $4::jsonb,
            null, $5, 'staging_fixture', 'region-alignment-fixture', $6::jsonb, now()
         )`,
        [
          aiRunId,
          occurrenceId,
          storedAssetId,
          JSON.stringify(region.rect),
          region.confidenceScore,
          JSON.stringify({
            source: sourceName,
            fixture_prefix: input.fixturePrefix,
            scenario: input.kind,
            note: region.note,
          }),
        ],
      );
    }
  }

  return {
    visitId,
    occurrenceId,
    placeId,
    subjectLabel: input.subjectLabel,
    observedAt,
    sourceKind: input.sourceKind,
    expectedVisibility:
      input.kind === "manual"
        ? "manual_only"
        : input.kind === "historical"
          ? "all_research_artifacts_only"
          : "excluded",
  };
}

export async function seedStagingRegressionFixtures(
  input: RegressionFixtureSeedInput,
): Promise<StagingRegressionFixtureSeedResult> {
  const fixturePrefix = assertFixturePrefix(input.fixturePrefix);
  const pool = getPool();
  const client = await pool.connect();
  const userId = `${fixturePrefix}-observer`;
  const displayName = "Regression Field Note Observer";

  try {
    const [manualPhoto, historicalPhoto, smokePhoto] = await Promise.all([
      ensureFixturePhoto(fixturePrefix, "manual"),
      ensureFixturePhoto(fixturePrefix, "historical"),
      ensureFixturePhoto(fixturePrefix, "smoke"),
    ]);

    const now = Date.now();
    await client.query("begin");
    await upsertFixtureUser(client, userId, displayName);

    const manual = await upsertFixtureVisit(client, {
      kind: "manual",
      fixturePrefix,
      userId,
      observedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      latitude: 35.0104,
      longitude: 138.3929,
      prefecture: "静岡県",
      municipality: "静岡市",
      localityNote: "staging regression manual fixture",
      siteId: `${fixturePrefix}-manual-site`,
      siteName: "Regression Manual Terrace",
      note: "manual regression fixture",
      subjectLabel: "Regression Manual Sparrow",
      scientificName: "Passer montanus",
      sourceKind: "v2_observation",
      sourcePayload: { source: "regression_seed_manual" },
      qualityGrade: "casual",
      evidenceTier: 1,
      photo: manualPhoto,
      mediaRegions: [
        {
          rect: { x: 0.35, y: 0.28, width: 0.3, height: 0.53 },
          confidenceScore: 0.92,
          note: "visible-region-fixture",
        },
        {
          rect: { x: 0.05, y: 0.05, width: 0.2, height: 0.2 },
          confidenceScore: 0.49,
          note: "low-confidence-hidden-fixture",
        },
      ],
    });

    const historical = await upsertFixtureVisit(client, {
      kind: "historical",
      fixturePrefix,
      userId,
      observedAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      latitude: 35.0128,
      longitude: 138.3876,
      prefecture: "静岡県",
      municipality: "静岡市",
      localityNote: "staging regression historical fixture",
      siteId: `${fixturePrefix}-historical-site`,
      siteName: "Regression Historical Marsh",
      note: "historical regression fixture",
      subjectLabel: "Regression Historical Reed Warbler",
      scientificName: "Acrocephalus orientalis",
      sourceKind: "legacy_observation",
      sourcePayload: { source: "regression_seed_historical" },
      qualityGrade: "research",
      evidenceTier: 2,
      photo: historicalPhoto,
    });

    const smoke = await upsertFixtureVisit(client, {
      kind: "smoke",
      fixturePrefix,
      userId,
      observedAt: new Date(now - 30 * 60 * 1000).toISOString(),
      latitude: 35.0116,
      longitude: 138.4012,
      prefecture: "静岡県",
      municipality: "静岡市",
      localityNote: "staging regression smoke fixture",
      siteId: `${fixturePrefix}-smoke-site`,
      siteName: "Regression Smoke Alley",
      note: "smoke regression fixture",
      subjectLabel: "Regression Smoke Exclusion Finch",
      scientificName: "Fringilla montifringilla",
      sourceKind: "v2_observation",
      sourcePayload: { source: "smoke_regression_fixture" },
      qualityGrade: "casual",
      evidenceTier: 1,
      photo: smokePhoto,
    });

    await client.query("commit");

    return {
      fixturePrefix,
      user: {
        userId,
        displayName,
      },
      manual,
      historical,
      smoke,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
