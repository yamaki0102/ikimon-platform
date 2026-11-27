import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import type { ObservationFirstRecordDetail } from "./cloudflareObservationReadModel";
import { renderObservationFirstRecordDetailHtml } from "./observationFirstRecordDetailHtml";
import { renderGlobalPlaceDetailPage } from "./placeDetailPage";
import { PROTOTYPE_FLAGS } from "./flags/index.generated";
import * as speciesFlagMeta from "./flags/SPECIES_READER_LAYER_ENABLED";
import {
  SPECIES_READER_LAYER_FLAG,
  buildSpeciesReaderGenerationPrompt,
  loadSpeciesReaderLayerForRecord,
  loadSpeciesReaderLayersForPlace,
  normalizeSpeciesReaderKey,
  renderPlaceSpeciesReaderLayersHtml,
  renderSpeciesReaderLayerHtml,
  spliceSpeciesReaderLiveStats,
  validateSpeciesReaderOutput,
  type SpeciesReaderAggregateInput,
} from "./speciesReaderLayer";
import { generateSpeciesReaderLayerBatch } from "../scripts/generate-species-reader-layers";

function sqliteDb(sqlite: DatabaseSync): Env["OBS_DB"] {
  const wrapStmt = (query: string, values: unknown[]) => ({
    runSync: () => ({ meta: { changes: Number(sqlite.prepare(query).run(...(values as never[])).changes) } }),
  });
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          values = args;
          return stmt;
        },
        async run() {
          return wrapStmt(query, values).runSync();
        },
        async first<T>() {
          return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null;
        },
        async all<T>() {
          return { results: sqlite.prepare(query).all(...(values as never[])) as T[] };
        },
        __raw: () => wrapStmt(query, values),
      };
      return stmt as unknown as ReturnType<Env["OBS_DB"]["prepare"]>;
    },
  } as unknown as Env["OBS_DB"];
}

const baseDetail = (confirmedName = "ナミアゲハ"): ObservationFirstRecordDetail => ({
  schema: "ikimon.observation-first-record-detail/v1",
  recordId: "visit-srl-1",
  owner: false,
  visibility: "public",
  observationCount: 1,
  proposalPolicy: { identification: true, media: true, disabledReason: null },
  observations: [
    {
      observationId: "obs-srl-1",
      state: "active",
      subjectType: "organism",
      subjectLabel: confirmedName,
      assertionStatus: "human_asserted",
      verificationStatus: "owner_confirmed",
      acceptedIdentification: {
        claimId: "claim-srl-1",
        actorType: "owner",
        actorId: "user-1",
        proposalActorType: "owner",
        proposedName: confirmedName,
        proposedScientificName: "Papilio xuthus",
        proposedRank: "species",
        humanDecision: true,
      },
      communityIdentifications: [],
      aiSuggestions: [],
      media: [{ mediaId: "asset-1", mediaKind: "photo", displayOrder: 0 }],
      provenance: { owner: true, ai: false, community: false, curator: false, imported: false },
    },
  ],
  privacy: { exactLocationExposed: false, publicLocationLabel: "位置情報は公開範囲に合わせて保護されています" },
});

test("SPECIES_READER_LAYER_ENABLED flag is default off", () => {
  const entry = PROTOTYPE_FLAGS.find((f) => f.flag === SPECIES_READER_LAYER_FLAG);
  assert.ok(entry);
  assert.equal(speciesFlagMeta.staging, false);
  assert.equal(speciesFlagMeta.production, false);
});

test("validateSpeciesReaderOutput rejects toxic/edible/touch/rare terms and species mismatch", () => {
  assert.equal(normalizeSpeciesReaderKey(" カワセミ "), "カワセミ");

  for (const forbidden of [
    "この植物は毒があるので注意。",
    "若葉は食用になります。",
    "直接の接触は避けてください。",
    "地域では希少な種とされています。",
    "さわって確かめよう。",
    "食べられません。",
  ]) {
    const res = validateSpeciesReaderOutput({
      expectedSpecies: "セイタカアワダチソウ",
      output: {
        speciesName: "セイタカアワダチソウ",
        childText: forbidden,
        parentText: "秋の野原で見つかります。",
        teacherText: "キク科の外来種として記録されています。",
      },
    });
    assert.equal(res.valid, false, `should reject: ${forbidden}`);
    assert.ok(res.reasons.length > 0);
  }

  const mismatch = validateSpeciesReaderOutput({
    expectedSpecies: "ナミアゲハ",
    output: {
      speciesName: "モンシロチョウ",
      childText: "羽の模様をくらべてみよう。",
      parentText: "春から秋によく見つかります。",
      teacherText: "チョウ目の仲間です。",
    },
  });
  assert.equal(mismatch.valid, false);
  assert.ok(mismatch.reasons.includes("species_name_mismatch"));

  const ok = validateSpeciesReaderOutput({
    expectedSpecies: "アライグマ",
    output: {
      speciesName: "アライグマ",
      childText: "しっぽにしまもようがある生きものです。",
      parentText: "公開記録では {{count}} 件（{{seasons}}）見つかっています。",
      teacherText: "特定外来生物に区分される種として、地域での観察記録が集まっています。",
    },
  });
  assert.equal(ok.valid, true);
  assert.deepEqual(ok.reasons, []);
});

test("prompt only uses allowed inputs (species, taxonomy, invasive table, aggregate count/season/region) and live stats splice without AI", () => {
  const input: SpeciesReaderAggregateInput = {
    speciesName: "セイタカアワダチソウ",
    scientificName: "Solidago altissima",
    taxonomy: { kingdom: "Plantae", order: "Asterales", family: "Asteraceae" },
    publicCount: 14,
    seasons: ["秋", "夏"],
    regions: ["浜松市"],
  };
  const prompt = buildSpeciesReaderGenerationPrompt(input);
  assert.match(prompt, /セイタカアワダチソウ/);
  assert.match(prompt, /Solidago altissima/);
  assert.match(prompt, /重点対策外来種/);
  assert.match(prompt, /14件/);
  assert.match(prompt, /浜松市/);
  assert.match(prompt, /毒|食用|接触|希少/);

  const spliced = spliceSpeciesReaderLiveStats(
    "公開記録は{{count}}件、時期は{{seasons}}、地域は{{regions}}です。",
    { publicCount: 42, seasons: ["春", "夏"], regions: ["浜松市", "掛川市"] }
  );
  assert.equal(spliced, "公開記録は42件、時期は春・夏、地域は浜松市・掛川市です。");
});

test("only approved entries pass load and splice live stats onto record detail & place pages behind flag", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(await readFile(new URL("../migrations/observations/0001_observation_write_contract.sql", import.meta.url), "utf8"));
  sqlite.exec(await readFile(new URL("../migrations/observations/0090_species_reader_layers.sql", import.meta.url), "utf8"));

  sqlite.prepare(`
    INSERT INTO draft_observations (draft_id, owner_user_id, observed_at, public_cell, visibility, processing_state)
    VALUES ('d1', 'u1', '2026-06-10T01:00:00Z', 'cell_hamamatsu', 'public', 'finalized'),
           ('d2', 'u1', '2026-10-05T01:00:00Z', 'cell_kakegawa', 'public', 'finalized')
  `).run();
  sqlite.prepare(`
    INSERT INTO observations (observation_id, draft_id, owner_user_id, observed_at, taxon_label, public_cell, visibility)
    VALUES ('o1', 'd1', 'u1', '2026-06-10T01:00:00Z', 'ナミアゲハ', 'cell_hamamatsu', 'public'),
           ('o2', 'd2', 'u1', '2026-10-05T01:00:00Z', 'ナミアゲハ', 'cell_kakegawa', 'public')
  `).run();

  sqlite.prepare(`
    INSERT INTO species_reader_layers
    (species_key, canonical_name, scientific_name, taxon_group, child_text, parent_text, teacher_text, review_status)
    VALUES
    ('ナミアゲハ', 'ナミアゲハ', 'Papilio xuthus', 'insect',
     'はねの色やもようを見てみよう。',
     '{{seasons}}に{{count}}件の記録があります。',
     '地域ごとの観察季節（{{seasons}}）を比べてみる素材になります。',
     'approved'),
    ('未承認種', '未承認種', NULL, 'generic', '子', '親', '先生', 'pending_review'),
    ('禁止語種', '禁止語種', NULL, 'plant', '毒があります', '親', '先生', 'approved')
  `).run();

  const db = sqliteDb(sqlite);
  assert.equal(await loadSpeciesReaderLayerForRecord(db, "未承認種"), null);
  assert.equal(await loadSpeciesReaderLayerForRecord(db, "禁止語種"), null);
  assert.equal(await loadSpeciesReaderLayerForRecord(db, "生きもの"), null);

  const loaded = await loadSpeciesReaderLayerForRecord(db, "ナミアゲハ");
  assert.ok(loaded);
  assert.equal(loaded.liveStats.publicCount, 2);
  assert.match(loaded.parentText, /2件/);
  assert.match(loaded.parentText, /夏/);
  assert.match(loaded.parentText, /秋/);

  const hiddenHtml = renderSpeciesReaderLayerHtml({ enabled: false, layer: loaded });
  assert.equal(hiddenHtml, "");

  const shownHtml = renderSpeciesReaderLayerHtml({ enabled: true, layer: loaded });
  assert.match(shownHtml, /data-species-reader-layer/);
  assert.match(shownHtml, /of-rm-tabs/);
  assert.match(shownHtml, /data-reader-mode-tab="child"[^>]*>こども</);
  assert.match(shownHtml, /data-reader-mode-tab="parent"[^>]*>おや</);
  assert.match(shownHtml, /data-reader-mode-tab="teacher"[^>]*>せんせい</);
  assert.match(shownHtml, /2件/);

  const recordHtml = renderObservationFirstRecordDetailHtml(baseDetail("ナミアゲハ"), {
    lang: "ja",
    title: "ナミアゲハ",
    titleIsFallback: false,
    titleStatus: "confirmed",
    observedLabel: "2026年6月10日",
    note: null,
    media: [{ mediaId: "a1", mediaKind: "photo", url: "/derived/1.jpg" }],
    actionNonce: "nonce-1",
    speciesReaderLayer: loaded,
  });
  assert.match(recordHtml, /data-species-reader-layer/);
  assert.match(recordHtml, /せんせい/);

  // Place page integration
  const placeLayers = await loadSpeciesReaderLayersForPlace(db, ["ナミアゲハ", "未承認種"]);
  assert.equal(placeLayers.length, 1);
  const placeSectionHtml = renderPlaceSpeciesReaderLayersHtml({ enabled: true, layers: placeLayers });
  assert.match(placeSectionHtml, /data-place-species-reader-layers/);
  assert.match(placeSectionHtml, /ナミアゲハ/);
  assert.match(placeSectionHtml, /せんせい/);

  const placeHtml = renderGlobalPlaceDetailPage({
    profile: {
      version: 1,
      placeRef: { kind: "registered_place", placeId: "plc_1" },
      place: {
        name: "佐鳴湖公園",
        type: "park",
        localityLabel: "静岡県浜松市",
        description: null,
        representativeMedia: [],
        canonicalPlaceId: "plc_1",
        aliases: [],
        multilingualNames: { ja: "佐鳴湖公園" },
        verificationStatus: "source_verified",
        officialStatus: "official",
      },
      summary: { recordCount: 2, contributorCount: null, firstRecordedAt: null, latestRecordedAt: null },
      facets: [],
      highlights: [],
      recentRecords: [],
      guide: null,
      memories: [],
      facilities: [],
      policy: {
        placeVisibility: "public",
        recordingPolicy: "check_rules",
        publicLocationMode: "place",
        contributionCtaMode: "check_rules",
        ruleSource: "official",
        ruleUrl: null,
        reason: "park",
      },
      dataGaps: [],
      publication: { status: "published", suppressedSections: [], locationMode: "registered_place" },
      provenance: {
        generatedAt: "2026-11-27T00:00:00Z",
        profileVersion: "place_atlas_profile/v1",
        sources: ["place_registry"],
        sourceReferences: [],
      },
    },
    lang: "ja",
    speciesReaderLayersHtml: placeSectionHtml,
  });
  assert.match(placeHtml, /data-place-species-reader-layers/);
});

test("dry-run generator processes 25 species in 1 call/species, validates rules, and writes review file without touching DB", async () => {
  const speciesList: SpeciesReaderAggregateInput[] = Array.from({ length: 25 }, (_, i) => ({
    speciesName: `浜松テスト種${i + 1}`,
    scientificName: `Testus sp${i + 1}`,
    taxonomy: { kingdom: "Animalia", order: "Lepidoptera", family: "Papilionidae" },
    publicCount: i + 1,
    seasons: ["夏"],
    regions: ["浜松市"],
  }));

  let callCount = 0;
  const dir = mkdtempSync(join(tmpdir(), "species-layer-dryrun-"));
  const outJson = join(dir, "dry-run.json");
  const outSql = join(dir, "review-only.sql");
  try {
    const result = await generateSpeciesReaderLayerBatch(speciesList, {
      dryRun: true,
      outJsonPath: outJson,
      outSqlPath: outSql,
      invokeAi: async (input) => {
        callCount += 1;
        return {
          model: "gemini-2.5-flash",
          promptTokens: 450,
          outputTokens: 320,
          parsed: {
            speciesName: input.speciesName,
            childText: `${input.speciesName}の形や色をよく見てみよう。`,
            parentText: `{{seasons}}に{{count}}件見つかっています。`,
            teacherText: `地域（{{regions}}）での季節変化を比べる記録材料です。`,
          },
        };
      },
    });
    assert.equal(callCount, 25);
    assert.equal(result.entries.length, 25);
    assert.equal(result.approvedCount, 25);
    assert.equal(result.rejectedCount, 0);
    const written = JSON.parse(readFileSync(outJson, "utf8")) as { entries: unknown[] };
    assert.equal(written.entries.length, 25);
    const sqlText = readFileSync(outSql, "utf8");
    assert.match(sqlText, /INSERT OR IGNORE INTO species_reader_layers/);
    assert.match(sqlText, /'pending_review'/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
