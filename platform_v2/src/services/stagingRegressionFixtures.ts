import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "../db.js";
import { buildPlaceId, buildPlaceName, makeOccurrenceId, normalizeTimestamp } from "./writeSupport.js";
import { upsertAssetBlob } from "./writeSupportPg.js";

const TINY_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK8QAAAAASUVORK5CYII=";
const FIXTURE_PREFIX_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,80}$/;

type RegressionFixtureKind =
  | "manual"
  | "manual_companion_a"
  | "manual_companion_b"
  | "historical"
  | "historical_companion_a"
  | "historical_companion_b"
  | "smoke"
  | "scene";

type RegressionFixtureSeedInput = {
  fixturePrefix: string;
};

type RegressionFixtureSummary = {
  visitId: string;
  occurrenceId: string;
  placeId: string;
  subjectLabel: string;
  scientificName: string;
  observedAt: string;
  sourceKind: string;
  expectedVisibility: "manual_only" | "all_research_artifacts_only" | "excluded";
};

type RegressionFixtureReferenceSummary = {
  sourceId: string;
  title: string;
  taxonName: string;
  taxonRank: string;
  locator: string;
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
  scene: RegressionFixtureSummary;
  reference: RegressionFixtureReferenceSummary;
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

type FixtureAiCandidate = {
  candidateKey: string;
  vernacularName: string | null;
  scientificName: string | null;
  taxonRank: string | null;
  confidenceScore: number | null;
  note: string;
  regions?: FixtureMediaRegion[];
};

type FixtureVisitInput = {
  kind: RegressionFixtureKind;
  fixturePrefix: string;
  publicMapVisible?: boolean;
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
  aiCandidates?: FixtureAiCandidate[];
};

function assertFixturePrefix(value: string): string {
  const fixturePrefix = value.trim();
  if (!FIXTURE_PREFIX_PATTERN.test(fixturePrefix)) {
    throw new Error("invalid_fixture_prefix");
  }
  return fixturePrefix;
}

function publicMapIdPrefix(fixturePrefix: string): string {
  return `pubmap-${createHash("sha1").update(fixturePrefix).digest("hex").slice(0, 12)}`;
}

async function ensureFixturePhoto(fixturePrefix: string, kind: RegressionFixtureKind): Promise<FixturePhoto> {
  const buffer = Buffer.from(TINY_PNG_BASE64, "base64");
  const publicMapFixture = kind !== "smoke";
  const storageBase = publicMapFixture ? "uploads/regression-public" : "uploads/staging-regression";
  const storagePath = `${storageBase}/${fixturePrefix}/${kind}.${kind === "manual" ? "svg" : "png"}`;
  if (kind === "manual") {
    const svgMarker = Buffer.alloc(1039, "vertical-region-fixture.svg");
    return {
      storagePath,
      publicUrl: "/assets/regression/vertical-region-public.svg",
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
    bytes: Math.max(buffer.byteLength, 1024),
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
  const recordPrefix = input.publicMapVisible ? publicMapIdPrefix(input.fixturePrefix) : input.fixturePrefix;
  const visitId = `${recordPrefix}-${input.kind}`;
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
        null, $6, null, $7, null, null,
        null, '[]'::jsonb, '["qa_public"]'::jsonb, $8::jsonb, $9, now()
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

  const needsAiRun = (input.mediaRegions?.length ?? 0) > 0 || (input.aiCandidates?.length ?? 0) > 0;
  if (needsAiRun) {
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

    for (const region of input.mediaRegions ?? []) {
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

    for (const candidate of input.aiCandidates ?? []) {
      const candidateResult = await client.query<{ candidate_id: string }>(
        `insert into observation_ai_subject_candidates (
            ai_run_id, visit_id, suggested_occurrence_id, candidate_key,
            vernacular_name, scientific_name, taxon_rank, confidence_score,
            candidate_status, note, source_payload, created_at, updated_at
         ) values (
            $1::uuid, $2, null, $3, $4, $5, $6, $7,
            'proposed', $8, $9::jsonb, now(), now()
         )
         on conflict (ai_run_id, candidate_key) do update set
            vernacular_name = excluded.vernacular_name,
            scientific_name = excluded.scientific_name,
            taxon_rank = excluded.taxon_rank,
            confidence_score = excluded.confidence_score,
            candidate_status = excluded.candidate_status,
            note = excluded.note,
            source_payload = excluded.source_payload,
            updated_at = now()
         returning candidate_id::text as candidate_id`,
        [
          aiRunId,
          visitId,
          candidate.candidateKey,
          candidate.vernacularName,
          candidate.scientificName,
          candidate.taxonRank,
          candidate.confidenceScore,
          candidate.note,
          JSON.stringify({
            source: sourceName,
            fixture_prefix: input.fixturePrefix,
            scenario: input.kind,
            role: candidate.candidateKey,
          }),
        ],
      );
      const candidateId = candidateResult.rows[0]?.candidate_id;
      if (!candidateId) continue;

      for (const region of candidate.regions ?? []) {
        await client.query(
          `insert into subject_media_regions (
              ai_run_id, occurrence_id, candidate_id, asset_id, normalized_rect,
              frame_time_ms, confidence_score, source_kind, source_model, source_payload, created_at
           ) values (
              $1::uuid, null, $2::uuid, $3::uuid, $4::jsonb,
              null, $5, 'staging_fixture', 'scene-read-model-fixture', $6::jsonb, now()
           )`,
          [
            aiRunId,
            candidateId,
            storedAssetId,
            JSON.stringify(region.rect),
            region.confidenceScore,
            JSON.stringify({
              source: sourceName,
              fixture_prefix: input.fixturePrefix,
              scenario: input.kind,
              role: candidate.candidateKey,
              note: region.note,
            }),
          ],
        );
      }
    }
  }

  return {
    visitId,
    occurrenceId,
    placeId,
    subjectLabel: input.subjectLabel,
    scientificName: input.scientificName,
    observedAt,
    sourceKind: input.sourceKind,
    expectedVisibility:
      input.kind === "manual" || input.kind.startsWith("manual_companion_")
        ? "manual_only"
        : input.kind === "scene"
          ? "manual_only"
          : input.kind === "historical" || input.kind.startsWith("historical_companion_")
          ? "all_research_artifacts_only"
          : "excluded",
  };
}

async function upsertFixtureReference(
  client: PoolClient,
  input: {
    fixturePrefix: string;
    userId: string;
    taxonName: string;
    taxonRank: string;
  },
): Promise<RegressionFixtureReferenceSummary> {
  const title = `Regression Field Guide ${input.fixturePrefix}`;
  const url = `https://staging.zukan.earth/fixtures/${encodeURIComponent(input.fixturePrefix)}/regression-field-guide`;
  const sourcePayload = {
    source: "staging_regression_reference",
    fixture_prefix: input.fixturePrefix,
    scenario: "identification_workbench",
    no_page_text_stored: true,
  };
  const existingSource = await client.query<{ source_id: string }>(
    `select source_id::text from knowledge_sources where url = $1 limit 1`,
    [url],
  );
  const existingSourceId = existingSource.rows[0]?.source_id ?? null;
  const sourceResult = existingSourceId
    ? await client.query<{ source_id: string }>(
        `update knowledge_sources
            set source_kind = 'field_guide',
                source_provider = 'staging_regression',
                title = $2,
                publisher = 'IKIMON QA',
                publication_year = 2026,
                license_label = 'metadata-only fixture',
                access_policy = 'metadata_only',
                citation_text = $3,
                source_payload = $4::jsonb,
                updated_at = now()
          where source_id = $1::uuid
          returning source_id::text`,
        [
          existingSourceId,
          title,
          `${title}. IKIMON QA, 2026.`,
          JSON.stringify(sourcePayload),
        ],
      )
    : await client.query<{ source_id: string }>(
        `insert into knowledge_sources (
            source_kind, source_provider, title, doi, url, publisher, publication_year,
            license_label, access_policy, citation_text, source_payload, created_at, updated_at
         ) values (
            'field_guide', 'staging_regression', $1, null, $2, 'IKIMON QA', 2026,
            'metadata-only fixture', 'metadata_only', $3, $4::jsonb, now(), now()
         )
         returning source_id::text`,
        [
          title,
          url,
          `${title}. IKIMON QA, 2026.`,
          JSON.stringify(sourcePayload),
        ],
      );
  const sourceId = sourceResult.rows[0]?.source_id;
  if (!sourceId) {
    throw new Error("fixture_reference_source_missing");
  }

  await client.query(
    `insert into knowledge_source_reference_metadata (
        source_id, isbn, ean, author_text, edition, source_language,
        catalog_status, ai_extract_payload, created_at, updated_at
     ) values (
        $1::uuid, null, null, 'IKIMON QA', 'staging fixture', 'ja',
        'active', $2::jsonb, now(), now()
     )
     on conflict (source_id) do update set
        author_text = excluded.author_text,
        edition = excluded.edition,
        source_language = excluded.source_language,
        catalog_status = excluded.catalog_status,
        ai_extract_payload = excluded.ai_extract_payload,
        updated_at = now()`,
    [
      sourceId,
      JSON.stringify({
        source: "staging_regression_reference",
        fixture_prefix: input.fixturePrefix,
      }),
    ],
  );

  await client.query(
    `insert into knowledge_source_taxon_links (
        source_id, taxon_name, taxon_rank, link_type, confidence,
        created_by_user_id, source_payload, created_at, updated_at
     ) values (
        $1::uuid, $2, $3, 'user_confirmed', 0.980,
        $4, $5::jsonb, now(), now()
     )
     on conflict (source_id, lower(btrim(taxon_name)), lower(btrim(taxon_rank)), link_type) do update set
        confidence = excluded.confidence,
        created_by_user_id = excluded.created_by_user_id,
        source_payload = excluded.source_payload,
        updated_at = now()`,
    [
      sourceId,
      input.taxonName,
      input.taxonRank,
      input.userId,
      JSON.stringify(sourcePayload),
    ],
  );

  await client.query(
    `insert into user_reference_access_proofs (
        user_id, source_id, proof_asset_id, batch_id, proof_kind, verification_status,
        ai_check_payload, private_use_only, created_at, updated_at
     ) values (
        $1, $2::uuid, null, null, 'cover', 'user_confirmed',
        $3::jsonb, true, now(), now()
     )
     on conflict do nothing`,
    [
      input.userId,
      sourceId,
      JSON.stringify(sourcePayload),
    ],
  );

  return {
    sourceId,
    title,
    taxonName: input.taxonName,
    taxonRank: input.taxonRank,
    locator: "p.12",
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
    const [
      manualPhoto,
      manualCompanionPhotoA,
      manualCompanionPhotoB,
      historicalPhoto,
      historicalCompanionPhotoA,
      historicalCompanionPhotoB,
      smokePhoto,
      scenePhoto,
    ] = await Promise.all([
      ensureFixturePhoto(fixturePrefix, "manual"),
      ensureFixturePhoto(fixturePrefix, "manual_companion_a"),
      ensureFixturePhoto(fixturePrefix, "manual_companion_b"),
      ensureFixturePhoto(fixturePrefix, "historical"),
      ensureFixturePhoto(fixturePrefix, "historical_companion_a"),
      ensureFixturePhoto(fixturePrefix, "historical_companion_b"),
      ensureFixturePhoto(fixturePrefix, "smoke"),
      ensureFixturePhoto(fixturePrefix, "scene"),
    ]);

    const now = Date.now();
    await client.query("begin");
    await upsertFixtureUser(client, userId, displayName);

    const manual = await upsertFixtureVisit(client, {
      kind: "manual",
      fixturePrefix,
      publicMapVisible: true,
      userId,
      observedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      latitude: 35.0104,
      longitude: 138.3929,
      prefecture: "静岡県",
      municipality: "静岡市",
      localityNote: "staging regression manual fixture",
      siteId: `${fixturePrefix}-manual-site`,
      siteName: "谷津山の草地",
      note: "manual regression fixture",
      subjectLabel: "スズメ",
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

    await upsertFixtureVisit(client, {
      kind: "manual_companion_a",
      fixturePrefix,
      publicMapVisible: true,
      userId,
      observedAt: new Date(now - 115 * 60 * 1000).toISOString(),
      latitude: 35.0108,
      longitude: 138.3932,
      prefecture: "静岡県",
      municipality: "静岡市",
      localityNote: "staging regression manual companion fixture",
      siteId: `${fixturePrefix}-manual-companion-a-site`,
      siteName: "谷津山の草地 A",
      note: "manual companion regression fixture",
      subjectLabel: "カワラヒワ",
      scientificName: "Passer montanus",
      sourceKind: "v2_observation",
      sourcePayload: { source: "regression_seed_manual_companion" },
      qualityGrade: "casual",
      evidenceTier: 1,
      photo: manualCompanionPhotoA,
    });

    await upsertFixtureVisit(client, {
      kind: "manual_companion_b",
      fixturePrefix,
      publicMapVisible: true,
      userId,
      observedAt: new Date(now - 110 * 60 * 1000).toISOString(),
      latitude: 35.0112,
      longitude: 138.3935,
      prefecture: "静岡県",
      municipality: "静岡市",
      localityNote: "staging regression manual companion fixture",
      siteId: `${fixturePrefix}-manual-companion-b-site`,
      siteName: "谷津山の草地 B",
      note: "manual companion regression fixture",
      subjectLabel: "ホオジロ",
      scientificName: "Passer montanus",
      sourceKind: "v2_observation",
      sourcePayload: { source: "regression_seed_manual_companion" },
      qualityGrade: "casual",
      evidenceTier: 1,
      photo: manualCompanionPhotoB,
    });

    const historical = await upsertFixtureVisit(client, {
      kind: "historical",
      fixturePrefix,
      publicMapVisible: true,
      userId,
      observedAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      latitude: 35.0128,
      longitude: 138.3876,
      prefecture: "静岡県",
      municipality: "静岡市",
      localityNote: "staging regression historical fixture",
      siteId: `${fixturePrefix}-historical-site`,
      siteName: "安倍川のヨシ原",
      note: "historical regression fixture",
      subjectLabel: "オオヨシキリ",
      scientificName: "Acrocephalus orientalis",
      sourceKind: "legacy_observation",
      sourcePayload: { source: "regression_seed_historical" },
      qualityGrade: "research",
      evidenceTier: 2,
      photo: historicalPhoto,
    });

    await upsertFixtureVisit(client, {
      kind: "historical_companion_a",
      fixturePrefix,
      publicMapVisible: true,
      userId,
      observedAt: new Date(now - 235 * 60 * 1000).toISOString(),
      latitude: 35.0129,
      longitude: 138.3878,
      prefecture: "静岡県",
      municipality: "静岡市",
      localityNote: "staging regression historical companion fixture",
      siteId: `${fixturePrefix}-historical-companion-a-site`,
      siteName: "安倍川のヨシ原 A",
      note: "historical companion regression fixture",
      subjectLabel: "セッカ",
      scientificName: "Acrocephalus orientalis",
      sourceKind: "legacy_observation",
      sourcePayload: { source: "regression_seed_historical_companion" },
      qualityGrade: "research",
      evidenceTier: 2,
      photo: historicalCompanionPhotoA,
    });

    await upsertFixtureVisit(client, {
      kind: "historical_companion_b",
      fixturePrefix,
      publicMapVisible: true,
      userId,
      observedAt: new Date(now - 230 * 60 * 1000).toISOString(),
      latitude: 35.0130,
      longitude: 138.3880,
      prefecture: "静岡県",
      municipality: "静岡市",
      localityNote: "staging regression historical companion fixture",
      siteId: `${fixturePrefix}-historical-companion-b-site`,
      siteName: "安倍川のヨシ原 B",
      note: "historical companion regression fixture",
      subjectLabel: "カイツブリ",
      scientificName: "Acrocephalus orientalis",
      sourceKind: "legacy_observation",
      sourcePayload: { source: "regression_seed_historical_companion" },
      qualityGrade: "research",
      evidenceTier: 2,
      photo: historicalCompanionPhotoB,
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

    const scene = await upsertFixtureVisit(client, {
      kind: "scene",
      fixturePrefix,
      userId,
      observedAt: new Date(now - 10 * 60 * 1000).toISOString(),
      latitude: 34.7106,
      longitude: 137.7264,
      prefecture: "静岡県",
      municipality: "浜松市",
      localityNote: "staging regression scene fixture",
      siteId: `${fixturePrefix}-scene-site`,
      siteName: "Regression Scene Flower Patch",
      note: "white flower mat with visiting bee and surrounding grass",
      subjectLabel: "ヒメイワダレソウ",
      scientificName: "Phyla nodiflora",
      sourceKind: "v2_observation",
      sourcePayload: { source: "regression_seed_scene" },
      qualityGrade: "casual",
      evidenceTier: 1,
      photo: scenePhoto,
      mediaRegions: [
        {
          rect: { x: 0.12, y: 0.18, width: 0.76, height: 0.55 },
          confidenceScore: 0.93,
          note: "flower-mat-primary-fixture",
        },
      ],
      aiCandidates: [
        {
          candidateKey: "visiting-bee",
          vernacularName: "セイヨウミツバチ",
          scientificName: "Apis mellifera",
          taxonRank: "species",
          confidenceScore: 0.9,
          note: "白い花で訪花中のハチ",
          regions: [
            {
              rect: { x: 0.58, y: 0.24, width: 0.18, height: 0.12 },
              confidenceScore: 0.81,
              note: "visiting-bee-region-fixture",
            },
          ],
        },
        {
          candidateKey: "surrounding-grass",
          vernacularName: "イネ科の一種",
          scientificName: null,
          taxonRank: "family",
          confidenceScore: 0.56,
          note: "群落の周囲に細い葉の草が混じる",
        },
        {
          candidateKey: "weak-reference",
          vernacularName: "小さな黒い点",
          scientificName: null,
          taxonRank: null,
          confidenceScore: 0.28,
          note: "位置と分類が弱い参考候補",
        },
      ],
    });

    const reference = await upsertFixtureReference(client, {
      fixturePrefix,
      userId,
      taxonName: scene.scientificName,
      taxonRank: "species",
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
      scene,
      reference,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
