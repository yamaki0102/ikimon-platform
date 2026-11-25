import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { crc32 } from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { GBIF_NOTICE_VERSION, handleGbifConsentRoute } from "./gbifConsent.js";
import type { GbifDb, GbifRow } from "./gbifDb.js";
import {
  MULTIMEDIA_COLUMNS, OCCURRENCE_COLUMNS, buildGbifEdition, loadActiveSensitiveList, recordEdition, zipStore, type GbifEditionBuild, type SensitiveLookup,
} from "./gbifDwcaExport.js";
import { createGbifHttpMatcher, decideTaxonMatch, loadLatestMatches, refreshTaxonMatches, storeTaxonMatch, type RawGbifMatch, type TaxonMatcher } from "./gbifTaxonMatch.js";
import { computePublicLocationView } from "./locationPrivacy.js";
import { cellGridDeg, disclosePublicLocation, publicDateJst, publicRadiusM, radiusLabelJa } from "./recordPublicLocation.js";

const migration = (name: string) => readFileSync(path.join(process.cwd(), "migrations", "observations", name), "utf8");
const NOW = Date.parse("2026-12-20T00:00:00Z");
const OLD = "2026-12-01T00:00:00.000Z";
const RECENT = "2026-12-15T00:00:00.000Z";
const CELL = "cell:35.68,139.77";
const FACE_SAFE = JSON.stringify({
  facePrivacy: { status: "no_faces" }, tool: "cloudflare-images-public-derivative-v1", inspectionVersion: "webp-chunk-v2", contentType: "image/webp",
  scannedContainer: "webp", derivativeFormat: "webp", checkedAt: "2026-11-01T00:00:00Z", bytes: 1000, derivativeBytes: 1000,
  gpsExifPresent: false, exifPresent: false, gpsPresent: false, xmpPresent: false, exactCoordinateLiteralPresent: false,
});

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function openDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of ["0001_observation_write_contract.sql", "0004_public_derivative_gate.sql", "0012_public_derivative_binary_verification.sql", "0023_observation_identification_disputes.sql", "0030_observation_data_rights.sql", "0043_civic_observation_contexts.sql", "0067_record_observation_foundation.sql", "0085_gbif_export.sql"]) db.exec(migration(file));
  return db;
}

const dbOf = (db: DatabaseSync): GbifDb => ({
  query: async (sql, values) => db.prepare(sql).all(...(values as Array<string | number | null>)) as GbifRow[],
  run: async (sql, values) => ({ changes: Number(db.prepare(sql).run(...(values as Array<string | number | null>)).changes) }),
  batch: async (statements) => {
    db.exec("BEGIN");
    try {
      for (const statement of statements) db.prepare(statement.sql).run(...(statement.values as Array<string | number | null>));
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  },
});

let seq = 100;
function addRecord(db: DatabaseSync, recordId: string, over: { owner?: string; observedAt?: string; cell?: string; visibility?: string } = {}) {
  db.prepare(`INSERT INTO observations (observation_id, draft_id, owner_user_id, observed_at, public_cell, visibility, processing_state)
    VALUES (?, ?, ?, ?, ?, ?, 'accepted')`).run(recordId, `draft-${recordId}`, over.owner ?? "owner-1", over.observedAt ?? "2026-11-10T03:00:00Z", over.cell ?? CELL, over.visibility ?? "public");
}
function addOrganism(db: DatabaseSync, id: string, recordId: string, over: { owner?: string; captive?: string; updatedAt?: string; countMode?: string; count?: number | null } = {}) {
  db.prepare(`INSERT INTO record_observations (observation_id, record_runtime, record_id, owner_user_id, source_key, origin, subject_type, captive_context, count_mode, count_value, updated_at)
    VALUES (?, 'cloudflare_d1', ?, ?, ?, 'owner', 'organism', ?, ?, ?, ?)`)
    .run(id, recordId, over.owner ?? "owner-1", `src-${id}`, over.captive ?? "wild", over.countMode ?? "unknown", over.count ?? null, over.updatedAt ?? OLD);
}
function addClaim(db: DatabaseSync, observationId: string, actor: string, kind: string, over: { sci?: string; name?: string; rank?: string; stance?: string; updatedAt?: string; status?: string; payload?: unknown } = {}) {
  const id = uuid(++seq);
  const status = over.status ?? "candidate";
  db.prepare(`INSERT INTO observation_identification_claims (identification_id, observation_id, actor_id, actor_kind, claim_status, proposed_name, proposed_scientific_name, proposed_rank, stance, source_key, source_payload_json, created_at, updated_at, decided_by_actor_kind, decided_by_actor_id, decided_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, observationId, actor, kind, status, over.name ?? "ハシブトガラス", over.sci ?? "Corvus macrorhynchos", over.rank ?? "species", over.stance ?? "support", `claim-${id}`, JSON.stringify(over.payload ?? {}), over.updatedAt ?? OLD, over.updatedAt ?? OLD, status === "accepted" ? kind : null, status === "accepted" ? actor : null, status === "accepted" ? (over.updatedAt ?? OLD) : null);
}
function addAsset(db: DatabaseSync, recordId: string, assetId: string, over: { metadata?: string } = {}) {
  db.prepare(`INSERT INTO asset_ledger (asset_id, draft_id, observation_id, owner_user_id, object_key, mime, bytes, processing_state, created_at, public_derivative_key, exif_scrub_state, public_ready_at, public_derivative_verified_at, public_derivative_metadata_json)
    VALUES (?, ?, ?, 'owner-1', ?, 'image/jpeg', 10, 'uploaded', ?, ?, 'scrubbed', '2026-11-11T00:00:00Z', '2026-11-11T00:00:00Z', ?)`)
    .run(assetId, `draft-${recordId}`, recordId, `orig/${assetId}`, `2026-11-10T00:00:${assetId.slice(-2)}Z`, `derived/${assetId}.webp`, over.metadata ?? FACE_SAFE);
}
function linkMedia(db: DatabaseSync, observationId: string, assetId: string) {
  db.prepare(`INSERT INTO record_observation_media (link_id, observation_id, media_source_runtime, media_id, source_key) VALUES (?, ?, 'cloudflare_d1', ?, ?)`).run(uuid(++seq), observationId, assetId, `media-${observationId}-${assetId}`);
}
const CROW: RawGbifMatch = { usageKey: 2482468, canonicalName: "Corvus macrorhynchos", rank: "SPECIES", status: "ACCEPTED", matchType: "EXACT", kingdom: "Animalia", phylum: "Chordata", class: "Aves", order: "Passeriformes", family: "Corvidae", genus: "Corvus", species: "Corvus macrorhynchos" };
async function addMatch(db: DatabaseSync, name: string, rank: string | null, raw: RawGbifMatch | null) {
  await storeTaxonMatch(dbOf(db), { name, rank, raw, matchedAtIso: "2026-11-20T00:00:00Z" });
}
const ACTIVE_LIST: SensitiveLookup = { listVersion: "list-test/1", tierOf: () => "none" };

async function consent(db: DatabaseSync, recordId: string, scope: "data" | "media", decision: "on" | "off", over: { assetId?: string; alias?: string; user?: string; requestId?: string } = {}) {
  const request = new Request(`https://example.test/api/v1/records/${recordId}/gbif-consent`, {
    method: "POST", headers: { origin: "https://example.test", "content-type": "application/json" },
    body: JSON.stringify({ scope, decision, assetId: over.assetId, attributionAlias: over.alias ?? "あおぞら", noticeVersion: GBIF_NOTICE_VERSION, requestId: over.requestId ?? `req-${++seq}-${scope}-${decision}` }),
  });
  return handleGbifConsentRoute({ db: dbOf(db) }, async () => ({ userId: over.user ?? "owner-1" }), request, `/api/v1/records/${recordId}/gbif-consent`);
}

async function build(db: DatabaseSync, over: Partial<Parameters<typeof buildGbifEdition>[0]> = {}): Promise<GbifEditionBuild> {
  return buildGbifEdition({ db: dbOf(db), nowMs: NOW, sensitive: ACTIVE_LIST, ...over });
}

async function eligibleScene(db: DatabaseSync, recordId = "rec-1", obs = uuid(1)) {
  addRecord(db, recordId);
  addOrganism(db, obs, recordId);
  addClaim(db, obs, "owner-1", "owner");
  addClaim(db, obs, "user-2", "community_member");
  await addMatch(db, "Corvus macrorhynchos", "species", CROW);
  assert.equal((await consent(db, recordId, "data", "on"))!.status, 200);
}

const lines = (text: string) => text.trimEnd().split("\n");
const column = (file: string, name: string, columns: ReadonlyArray<readonly [string, string]>) => lines(file).slice(1).map((line) => line.split("\t")[columns.findIndex(([n]) => n === name)]);

test("eligible: two independent people confirmed, consent on, 14+ days, protection decided -> exactly one occurrence row", async () => {
  const db = openDb();
  await eligibleScene(db);
  const edition = await build(db);
  assert.equal(edition.rows.length, 1);
  const v = edition.rows[0]!.values;
  assert.equal(v.occurrenceID, `urn:uuid:${uuid(1)}`);
  assert.equal(v.basisOfRecord, "HumanObservation");
  assert.equal(v.occurrenceStatus, "present");
  assert.equal(v.scientificName, "Corvus macrorhynchos");
  assert.equal(v.taxonRank, "species");
  assert.equal(v.family, "Corvidae");
  assert.equal(v.eventDate, "2026-11-10");
  assert.equal(v.decimalLatitude, "35.68");
  assert.equal(v.decimalLongitude, "139.77");
  assert.equal(v.coordinateUncertaintyInMeters, "800");
  assert.equal(v.recordedBy, "あおぞら");
  assert.equal(v.identificationVerificationStatus, "community consensus");
  assert.equal(v.license, "https://creativecommons.org/licenses/by/4.0/");
  assert.equal(v.taxonID, "https://www.gbif.org/species/2482468");
  assert.equal(v.vernacularName, "ハシブトガラス");
  assert.equal(v.references, "https://zukan.earth/ja/observations/rec-1");
  assert.doesNotMatch(edition.files["occurrence.txt"], /exact|owner-1|user-2/);
});

test("AI-only, owner-only, disputed, no consent and under 14 days all give zero rows", async () => {
  // AI only: organism with an AI suggestion but no human claim
  const db = openDb();
  addRecord(db, "rec-ai"); addOrganism(db, uuid(10), "rec-ai");
  db.prepare(`INSERT INTO observation_ai_suggestions (suggestion_id, observation_id, candidate_key, source_key, proposed_name, proposed_scientific_name, model_provider, model_name, model_version, prompt_version, rule_version, input_digest)
    VALUES (?, ?, 'c1', 's1', 'ハシブトガラス', 'Corvus macrorhynchos', 'g', 'm', '1', 'p', 'r', 'd')`).run(uuid(11), uuid(10));
  await addMatch(db, "Corvus macrorhynchos", "species", CROW);
  await consent(db, "rec-ai", "data", "on");
  // owner-only confirmation
  addRecord(db, "rec-own"); addOrganism(db, uuid(20), "rec-own"); addClaim(db, uuid(20), "owner-1", "owner", { status: "accepted" });
  await consent(db, "rec-own", "data", "on");
  // disputed (open dispute) even with two agreeing people
  addRecord(db, "rec-dis"); addOrganism(db, uuid(30), "rec-dis"); addClaim(db, uuid(30), "owner-1", "owner"); addClaim(db, uuid(30), "user-2", "community_member");
  db.prepare("INSERT INTO observation_identification_disputes (dispute_id, occurrence_id, actor_user_id, kind, status, created_at, updated_at) VALUES ('d1', 'occ:rec-dis:0', 'user-3', 'alternative_id', 'open', ?, ?)").run(OLD, OLD);
  await consent(db, "rec-dis", "data", "on");
  // objection by stance
  addRecord(db, "rec-obj"); addOrganism(db, uuid(40), "rec-obj"); addClaim(db, uuid(40), "owner-1", "owner"); addClaim(db, uuid(40), "user-2", "community_member"); addClaim(db, uuid(40), "user-3", "community_member", { stance: "not_organism" });
  await consent(db, "rec-obj", "data", "on");
  // confirmed but no consent
  addRecord(db, "rec-nc"); addOrganism(db, uuid(50), "rec-nc"); addClaim(db, uuid(50), "owner-1", "owner"); addClaim(db, uuid(50), "user-2", "community_member");
  // confirmed but changed 5 days ago
  addRecord(db, "rec-new"); addOrganism(db, uuid(60), "rec-new"); addClaim(db, uuid(60), "owner-1", "owner"); addClaim(db, uuid(60), "user-2", "community_member", { updatedAt: RECENT });
  await consent(db, "rec-new", "data", "on");

  const edition = await build(db);
  assert.equal(edition.rows.length, 0);
  assert.equal(lines(edition.files["occurrence.txt"]).length, 1);
  const reasons = Object.fromEntries(edition.held.map((h) => [h.recordId, h.reason]));
  assert.deepEqual(reasons, { "rec-ai": "no_human_claim", "rec-own": "single_voter", "rec-dis": "objection", "rec-obj": "objection", "rec-new": "unstable_under_14_days" });
  assert.equal(edition.candidateCount, 5, "the record without consent is never a candidate");
});

test("consent withdrawn or media-only consent does not publish data", async () => {
  const db = openDb();
  await eligibleScene(db);
  assert.equal((await build(db)).rows.length, 1);
  assert.equal((await consent(db, "rec-1", "data", "off"))!.status, 200);
  assert.equal((await build(db)).rows.length, 0);
  assert.equal((await consent(db, "rec-1", "data", "on"))!.status, 200);
  assert.equal((await build(db)).rows.length, 1);
});

test("same bird in two photos is one row; media rows only for consented photos", async () => {
  const db = openDb();
  await eligibleScene(db);
  addAsset(db, "rec-1", "asset-01"); addAsset(db, "rec-1", "asset-02");
  linkMedia(db, uuid(1), "asset-01"); linkMedia(db, uuid(1), "asset-02");
  let edition = await build(db);
  assert.equal(edition.rows.length, 1);
  assert.equal(edition.mediaRows.length, 0, "media off by default");
  assert.equal(lines(edition.files["multimedia.txt"]).length, 1);

  assert.equal((await consent(db, "rec-1", "media", "on", { assetId: "asset-01" }))!.status, 200);
  edition = await build(db);
  assert.equal(edition.rows.length, 1);
  assert.equal(edition.mediaRows.length, 1);
  assert.equal(edition.rows[0]!.mediaCount, 1);
  const mm = edition.mediaRows[0]!.values;
  assert.equal(mm.license, "https://creativecommons.org/licenses/by-nc/4.0/");
  assert.equal(mm.identifier, "https://zukan.earth/derived/asset-01.webp");
  assert.equal(mm.creator, "あおぞら");
  assert.doesNotMatch(edition.files["multimedia.txt"], /orig\/|asset-02/);

  assert.equal((await consent(db, "rec-1", "media", "on", { assetId: "asset-02" }))!.status, 200);
  edition = await build(db);
  assert.equal(edition.rows.length, 1);
  assert.equal(edition.mediaRows.length, 2);

  assert.equal((await consent(db, "rec-1", "media", "off", { assetId: "asset-01" }))!.status, 200);
  assert.equal((await build(db)).mediaRows.length, 1);

  db.prepare("UPDATE asset_ledger SET public_derivative_metadata_json = '{}' WHERE asset_id = 'asset-02'").run();
  edition = await build(db);
  assert.equal(edition.rows.length, 1);
  assert.equal(edition.mediaRows.length, 0, "a photo without face-safety proof is never listed");
});

test("occurrenceID is stable after a taxonomy change and permanent in the reservation table", async () => {
  const db = openDb();
  await eligibleScene(db);
  const first = await build(db);
  await recordEdition(dbOf(db), first);
  const revised: RawGbifMatch = { ...CROW, canonicalName: "Corvus levaillantii", species: "Corvus levaillantii" };
  await addMatch(db, "Corvus macrorhynchos", "species", revised);
  const second = await build(db);
  assert.equal(second.rows[0]!.occurrenceId, first.rows[0]!.occurrenceId);
  assert.equal(first.rows[0]!.values.scientificName, "Corvus macrorhynchos");
  assert.equal(second.rows[0]!.values.scientificName, "Corvus levaillantii");
  const versions = db.prepare("SELECT match_version FROM gbif_taxon_matches ORDER BY match_version").all().map((row) => Number(row.match_version));
  assert.deepEqual(versions, [1, 2]);
  assert.throws(() => db.prepare("DELETE FROM gbif_occurrence_ids").run(), /gbif_occurrence_id_is_permanent/);
  assert.throws(() => db.prepare("UPDATE gbif_occurrence_ids SET observation_id = ?").run(uuid(99)), /gbif_occurrence_id_is_permanent/);
  assert.throws(() => db.prepare("INSERT INTO gbif_occurrence_ids (occurrence_id, observation_id) VALUES ('urn:uuid:other', ?)").run(uuid(98)));
});

test("an edition records members, withdraws rows that left, and keeps ids reserved", async () => {
  const db = openDb();
  await eligibleScene(db);
  const first = await build(db);
  assert.deepEqual((await recordEdition(dbOf(db), first)).withdrawnOccurrenceIds, []);
  await consent(db, "rec-1", "data", "off");
  const second = await build(db, { nowMs: NOW + 60_000 });
  const result = await recordEdition(dbOf(db), second);
  assert.deepEqual(result.withdrawnOccurrenceIds, [`urn:uuid:${uuid(1)}`]);
  const editions = db.prepare("SELECT status, occurrence_count, withdrawn_count FROM gbif_editions ORDER BY built_at, edition_id").all();
  assert.deepEqual(editions.map((e) => [e.status, e.occurrence_count, e.withdrawn_count]), [["superseded", 1, 0], ["built", 0, 1]]);
  assert.equal(Number((db.prepare("SELECT COUNT(*) AS c FROM gbif_occurrence_ids").get() as { c: number }).c), 1);
});

test("the archive is structurally valid: meta.xml maps every column, eml is well formed, zip entries check out", async () => {
  const db = openDb();
  await eligibleScene(db);
  addAsset(db, "rec-1", "asset-01"); linkMedia(db, uuid(1), "asset-01");
  await consent(db, "rec-1", "media", "on", { assetId: "asset-01" });
  const edition = await build(db, { publisher: { organizationName: "IKIMON株式会社" } });
  const { files } = edition;
  assert.deepEqual(Object.keys(files).sort(), ["eml.xml", "meta.xml", "multimedia.txt", "occurrence.txt"]);

  const section = (tag: string) => new RegExp(`<${tag} [\\s\\S]*?</${tag}>`).exec(files["meta.xml"])![0];
  const fieldsOf = (xml: string) => [...xml.matchAll(/<field index="(\d+)" term="([^"]+)"\/>/g)].map((m) => [Number(m[1]), m[2]!] as const);
  const core = section("core");
  const extension = section("extension");
  assert.match(core, /<location>occurrence\.txt<\/location>/);
  assert.match(core, /<id index="0"\/>/);
  assert.match(core, /rowType="http:\/\/rs\.tdwg\.org\/dwc\/terms\/Occurrence"/);
  assert.match(core, /ignoreHeaderLines="1"/);
  assert.match(extension, /<coreid index="0"\/>/);
  assert.match(extension, /rowType="http:\/\/rs\.gbif\.org\/terms\/1\.0\/Multimedia"/);
  const occurrenceHeader = lines(files["occurrence.txt"])[0]!.split("\t");
  const coreFields = fieldsOf(core);
  assert.equal(coreFields.length, occurrenceHeader.length);
  for (const [index, term] of coreFields) assert.equal(term.split("/").pop(), occurrenceHeader[index], `core column ${index}`);
  assert.deepEqual(occurrenceHeader, OCCURRENCE_COLUMNS.map(([n]) => n));
  const mediaHeader = lines(files["multimedia.txt"])[0]!.split("\t");
  assert.deepEqual(mediaHeader, MULTIMEDIA_COLUMNS.map(([n]) => n));
  const extFields = fieldsOf(extension);
  assert.equal(extFields.length, mediaHeader.length - 1);
  for (const [index, term] of extFields) assert.equal(term.split("/").pop(), mediaHeader[index], `extension column ${index}`);
  for (const file of ["occurrence.txt", "multimedia.txt"] as const) {
    const width = lines(files[file])[0]!.split("\t").length;
    for (const line of lines(files[file])) assert.equal(line.split("\t").length, width, `${file} row width`);
    assert.doesNotMatch(files[file], /\r|"\t|\t"/);
  }
  assert.equal(new Set(column(files["occurrence.txt"], "occurrenceID", OCCURRENCE_COLUMNS)).size, lines(files["occurrence.txt"]).length - 1);

  for (const name of ["meta.xml", "eml.xml"] as const) {
    const stack: string[] = [];
    for (const m of files[name].matchAll(/<(\/?)([A-Za-z][\w:.-]*)[^>]*?(\/?)>/g)) {
      if (m[3]) continue;
      if (m[1]) assert.equal(stack.pop(), m[2], `${name} closes ${m[2]}`); else stack.push(m[2]!);
    }
    assert.equal(stack.length, 0, `${name} balanced`);
  }
  assert.match(files["eml.xml"], new RegExp(`packageId="${edition.editionId}"`));
  assert.match(files["eml.xml"], /creativecommons\.org\/licenses\/by\/4\.0/);
  assert.match(files["eml.xml"], /<calendarDate>2026-11-10<\/calendarDate>/);

  const zip = zipStore(files);
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assert.equal(view.getUint32(zip.length - 22, true), 0x06054b50);
  const entries = view.getUint16(zip.length - 12, true);
  assert.equal(entries, 4);
  let pos = view.getUint32(zip.length - 6, true);
  const seen: string[] = [];
  for (let i = 0; i < entries; i += 1) {
    assert.equal(view.getUint32(pos, true), 0x02014b50);
    const crc = view.getUint32(pos + 16, true);
    const size = view.getUint32(pos + 24, true);
    const nameLen = view.getUint16(pos + 28, true);
    const local = view.getUint32(pos + 42, true);
    const name = new TextDecoder().decode(zip.subarray(pos + 46, pos + 46 + nameLen));
    assert.equal(view.getUint32(local, true), 0x04034b50);
    const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = zip.subarray(dataStart, dataStart + size);
    assert.equal(crc32(data), crc);
    assert.equal(new TextDecoder().decode(data), files[name as keyof typeof files]);
    seen.push(name);
    pos += 46 + nameLen;
  }
  assert.deepEqual(seen.sort(), ["eml.xml", "meta.xml", "multimedia.txt", "occurrence.txt"]);
});

test("location: page radius and exported uncertainty come from one function; protected rows get coarser or are withheld", async () => {
  for (const [lat, lng, authors, meters, expected, label] of [[35.6812, 139.7671, 5, 1000, 800, "およそ半径0.8km"], [35.6812, 139.7671, 1, 10000, 8000, "およそ半径8km"], [43.06, 141.35, 5, 1000, 800, "およそ半径0.8km"], [26.21, 127.68, 1, 10000, 8000, "およそ半径8km"]] as const) {
    const view = computePublicLocationView({ lat, lng, observedAt: "2026-01-01T00:00:00Z", nowMs: NOW, distinctAuthorsIn1kmCell: authors });
    const disclosed = disclosePublicLocation({ publicCell: view.publicCell, observedAt: "2026-01-01T00:00:00Z", nowMs: NOW });
    assert.equal(disclosed.status, "point");
    if (disclosed.status !== "point") continue;
    assert.equal(disclosed.gridMeters, view.gridMeters);
    assert.equal(disclosed.gridMeters, meters);
    assert.equal(disclosed.radiusM, expected);
    assert.equal(disclosed.radiusLabelJa, label);
    assert.equal(cellGridDeg(view.publicCell!), disclosed.gridDeg);
    assert.equal(radiusLabelJa(publicRadiusM(disclosed.centerLat, disclosed.centerLng, disclosed.gridDeg)), label);
  }
  assert.equal(disclosePublicLocation({ publicCell: "hidden", observedAt: "2026-01-01T00:00:00Z", nowMs: NOW }).status, "withheld");
  assert.deepEqual(disclosePublicLocation({ publicCell: CELL, observedAt: "2026-12-19T23:00:00Z", nowMs: NOW }), { status: "withheld", reason: "delayed" });
  assert.equal(publicDateJst("2026-11-09T15:30:00Z"), "2026-11-10");
  assert.equal(publicDateJst("2026-11-10"), "2026-11-10");

  const db = openDb();
  await eligibleScene(db);
  const coarse = await build(db, { sensitive: { listVersion: "l/1", tierOf: (key) => (key === "corvus macrorhynchos" ? "coarse" : "none") } });
  assert.equal(coarse.rows.length, 1);
  assert.equal(coarse.rows[0]!.values.coordinateUncertaintyInMeters, "8000");
  assert.equal(coarse.rows[0]!.values.decimalLatitude, "35.7");
  assert.match(coarse.rows[0]!.values.dataGeneralizations!, /about 10 km/);
  const withheld = await build(db, { sensitive: { listVersion: "l/1", tierOf: () => "withhold" } });
  assert.equal(withheld.rows.length, 0);
  assert.equal(withheld.held[0]!.reason, "location_protected_withhold");
  const unavailable = await build(db, { sensitive: null });
  assert.equal(unavailable.rows.length, 0);
  assert.equal(unavailable.held[0]!.reason, "sensitive_list_unavailable");

  // the strictest protection in the record covers the whole record, including an AI-only candidate on another organism
  addOrganism(db, uuid(2), "rec-1");
  db.prepare(`INSERT INTO observation_ai_suggestions (suggestion_id, observation_id, candidate_key, source_key, proposed_name, proposed_scientific_name, model_provider, model_name, model_version, prompt_version, rule_version, input_digest)
    VALUES (?, ?, 'c1', 's1', 'ミゾゴイ', 'Gorsachius goisagi', 'g', 'm', '1', 'p', 'r', 'd')`).run(uuid(3), uuid(2));
  const record = await build(db, { sensitive: { listVersion: "l/1", tierOf: (key) => (key === "gorsachius goisagi" ? "withhold" : "none") } });
  assert.equal(record.rows.length, 0);
});

test("the sensitive list is read from the active version only and a missing list fails closed", async () => {
  const db = openDb();
  assert.equal(await loadActiveSensitiveList(dbOf(db)), null);
  db.prepare("INSERT INTO gbif_sensitive_list_versions (list_version, status, activated_at) VALUES ('v1', 'active', '2026-11-01')").run();
  db.prepare("INSERT INTO gbif_sensitive_taxa (list_version, name_key, tier) VALUES ('v1', 'gorsachius goisagi', 'withhold'), ('v1', 'grus japonensis', 'coarse')").run();
  const list = await loadActiveSensitiveList(dbOf(db));
  assert.equal(list!.listVersion, "v1");
  assert.equal(list!.tierOf("gorsachius goisagi"), "withhold");
  assert.equal(list!.tierOf("grus japonensis"), "coarse");
  assert.equal(list!.tierOf("passer montanus"), "none");
  assert.throws(() => db.prepare("INSERT INTO gbif_sensitive_list_versions (list_version, status) VALUES ('v2', 'active')").run(), /UNIQUE/);
});

test("confirmation follows the existing identification policy: ceilings, experts, two thirds", async () => {
  const db = openDb();
  const moth = (species: string) => ({ ...CROW, usageKey: species.length, canonicalName: species, species, genus: "Papilio", family: "Papilionidae", order: "Lepidoptera", class: "Insecta", phylum: "Arthropoda" });
  // two people agree on the same butterfly species -> the Lepidoptera ceiling is genus, so it is published at genus
  addRecord(db, "rec-bf"); addOrganism(db, uuid(70), "rec-bf");
  addClaim(db, uuid(70), "owner-1", "owner", { sci: "Papilio xuthus", name: "アゲハ" }); addClaim(db, uuid(70), "user-2", "community_member", { sci: "Papilio xuthus", name: "アゲハ" });
  await addMatch(db, "Papilio xuthus", "species", moth("Papilio xuthus"));
  await consent(db, "rec-bf", "data", "on");
  // two people disagree about the species of the same genus -> genus
  addRecord(db, "rec-gn"); addOrganism(db, uuid(71), "rec-gn");
  addClaim(db, uuid(71), "owner-1", "owner", { sci: "Papilio xuthus" }); addClaim(db, uuid(71), "user-2", "community_member", { sci: "Papilio machaon" });
  await addMatch(db, "Papilio machaon", "species", moth("Papilio machaon"));
  await consent(db, "rec-gn", "data", "on");
  // one curator is enough, at the curator's rank
  addRecord(db, "rec-ex"); addOrganism(db, uuid(72), "rec-ex");
  addClaim(db, uuid(72), "expert-1", "curator", { sci: "Papilio xuthus" });
  await consent(db, "rec-ex", "data", "on");
  // 1 of 3 supports -> no consensus
  addRecord(db, "rec-23"); addOrganism(db, uuid(73), "rec-23");
  addClaim(db, uuid(73), "a", "owner", { sci: "Corvus macrorhynchos" }); addClaim(db, uuid(73), "b", "community_member", { sci: "Corvus macrorhynchos" }); addClaim(db, uuid(73), "c", "community_member", { sci: "Passer montanus" });
  await addMatch(db, "Corvus macrorhynchos", "species", CROW);
  await addMatch(db, "Passer montanus", "species", { ...CROW, usageKey: 5231190, canonicalName: "Passer montanus", species: "Passer montanus", genus: "Passer", family: "Passeridae" });
  await consent(db, "rec-23", "data", "on");
  const edition = await build(db);
  const byRecord = Object.fromEntries(edition.rows.map((row) => [row.recordId, row.values]));
  assert.equal(byRecord["rec-bf"]!.taxonRank, "genus");
  assert.equal(byRecord["rec-bf"]!.scientificName, "Papilio");
  assert.equal(byRecord["rec-bf"]!.taxonID, "");
  assert.equal(byRecord["rec-bf"]!.vernacularName, "");
  assert.equal(byRecord["rec-gn"]!.scientificName, "Papilio");
  assert.equal(byRecord["rec-ex"]!.taxonRank, "species");
  assert.equal(byRecord["rec-ex"]!.identificationVerificationStatus, "expert verified");
  assert.equal(byRecord["rec-23"]!.scientificName, "Corvus macrorhynchos", "two of three is exactly two thirds");
});

test("guests, captive or unknown wild status, private and hidden records never enter the edition", async () => {
  const db = openDb();
  for (const [id, record, over] of [["g", "rec-guest", { owner: "guest:abc" }], ["h", "rec-guest2", { owner: "guest_5a50de" }], ["c", "rec-captive", { captive: "pet" }], ["u", "rec-unknown", { captive: "unknown" }]] as const) {
    addRecord(db, record, { owner: (over as { owner?: string }).owner });
    addOrganism(db, uuid(id.charCodeAt(0)), record, { owner: (over as { owner?: string }).owner, captive: (over as { captive?: string }).captive });
    addClaim(db, uuid(id.charCodeAt(0)), "owner-1", "owner"); addClaim(db, uuid(id.charCodeAt(0)), "user-2", "community_member");
    db.prepare("INSERT INTO gbif_consent_events (consent_id, record_id, scope, asset_id, decision, license_uri, attribution_alias, notice_version, actor_id, request_id) VALUES (?, ?, 'data', '', 'on', 'https://creativecommons.org/licenses/by/4.0/', 'a', 'n', 'u', ?)").run(uuid(++seq), record, `r-${record}`);
  }
  addRecord(db, "rec-priv", { visibility: "private" }); addOrganism(db, uuid(5), "rec-priv"); addClaim(db, uuid(5), "owner-1", "owner"); addClaim(db, uuid(5), "user-2", "community_member");
  db.prepare("INSERT INTO gbif_consent_events (consent_id, record_id, scope, asset_id, decision, license_uri, attribution_alias, notice_version, actor_id, request_id) VALUES (?, 'rec-priv', 'data', '', 'on', 'https://creativecommons.org/licenses/by/4.0/', 'a', 'n', 'u', 'r-priv')").run(uuid(++seq));
  await addMatch(db, "Corvus macrorhynchos", "species", CROW);
  assert.equal((await build(db)).candidateCount, 0);
  assert.equal((await build(db, { allowUnknownCaptive: true })).candidateCount, 1);
  assert.equal((await build(db, { allowUnknownCaptive: true })).rows.length, 1);
});

test("dry-run mode reports what would be eligible if everyone had consented", async () => {
  const db = openDb();
  addRecord(db, "rec-1"); addOrganism(db, uuid(1), "rec-1"); addClaim(db, uuid(1), "owner-1", "owner"); addClaim(db, uuid(1), "user-2", "community_member");
  await addMatch(db, "Corvus macrorhynchos", "species", CROW);
  assert.equal((await build(db)).rows.length, 0);
  const dry = await build(db, { assumeConsent: true });
  assert.equal(dry.rows.length, 1);
  assert.equal(dry.rows[0]!.values.recordedBy, "");
});

test("consent API: owner only, notice version, alias, idempotent replay, linear history, defaults off", async () => {
  const db = openDb();
  addRecord(db, "rec-1");
  addAsset(db, "rec-1", "asset-01");
  const route = (method: string, body: unknown, over: { user?: string | null; origin?: string } = {}) => handleGbifConsentRoute(
    { db: dbOf(db) }, async () => (over.user === null ? null : { userId: over.user ?? "owner-1" }),
    new Request("https://example.test/api/v1/records/rec-1/gbif-consent", { method, headers: { origin: over.origin ?? "https://example.test" }, body: method === "POST" ? JSON.stringify(body) : undefined }),
    "/api/v1/records/rec-1/gbif-consent",
  );
  const initial = await (await route("GET", null))!.json() as { data: { on: boolean }; media: Array<{ assetId: string; on: boolean }>; notice: { data: string; media: string }; noticeVersion: string };
  assert.equal(initial.data.on, false);
  assert.deepEqual(initial.media, [{ assetId: "asset-01", on: false, licenseUri: "https://creativecommons.org/licenses/by-nc/4.0/", decidedAt: null }]);
  assert.match(initial.notice.data, /CC BY 4\.0/);
  assert.match(initial.notice.media, /CC BY-NC 4\.0/);

  assert.equal((await route("GET", null, { user: "someone-else" }))!.status, 403);
  assert.equal((await route("GET", null, { user: null }))!.status, 401);
  assert.equal((await route("POST", { scope: "data", decision: "on" }, { origin: "https://evil.test" }))!.status, 403);
  const base = { scope: "data", decision: "on", attributionAlias: "あおぞら", noticeVersion: GBIF_NOTICE_VERSION, requestId: "request-0001" };
  assert.equal((await route("POST", base, { user: "someone-else" }))!.status, 403);
  assert.equal((await route("POST", { ...base, noticeVersion: "old" }))!.status, 409);
  assert.equal((await route("POST", { ...base, attributionAlias: "" }))!.status, 400);
  assert.equal((await route("POST", { ...base, attributionAlias: "taro@example.com" }))!.status, 400);
  assert.equal((await route("POST", { ...base, scope: "media", assetId: "not-mine" }))!.status, 404);

  const on = await (await route("POST", base))!.json() as { ok: boolean; changed: boolean; consentId: string };
  assert.equal(on.changed, true);
  const replay = await (await route("POST", base))!.json() as { changed: boolean; replay: boolean; consentId: string };
  assert.deepEqual([replay.changed, replay.replay, replay.consentId], [false, true, on.consentId]);
  assert.equal((await route("POST", { ...base, decision: "off" }))!.status, 409, "same request id for another decision is rejected");
  const same = await (await route("POST", { ...base, requestId: "request-0002" }))!.json() as { changed: boolean };
  assert.equal(same.changed, false);
  const off = await (await route("POST", { ...base, decision: "off", requestId: "request-0003" }))!.json() as { changed: boolean };
  assert.equal(off.changed, true);
  const media = await (await route("POST", { scope: "media", decision: "on", assetId: "asset-01", noticeVersion: GBIF_NOTICE_VERSION, requestId: "request-0004" }))!.json() as { changed: boolean };
  assert.equal(media.changed, true);

  const chain = db.prepare("SELECT scope, decision, supersedes_id IS NULL AS root FROM gbif_consent_events ORDER BY decided_at, rowid").all().map((row) => `${row.scope}:${row.decision}:${row.root}`);
  assert.deepEqual(chain, ["data:on:1", "data:off:0", "media:on:1"]);
  assert.throws(() => db.prepare("UPDATE gbif_consent_events SET license_uri = 'https://example.test/x' WHERE scope = 'data'").run(), /CHECK/);
  assert.throws(() => db.prepare("INSERT INTO gbif_consent_events (consent_id, record_id, scope, asset_id, decision, license_uri, attribution_alias, notice_version, actor_id, request_id, supersedes_id) SELECT ?, record_id, scope, asset_id, 'on', license_uri, 'x', 'n', 'u', 'dup', supersedes_id FROM gbif_consent_events WHERE scope = 'data' AND decision = 'off'").run(uuid(200)), /UNIQUE/);
  const final = await (await route("GET", null))!.json() as { data: { on: boolean }; media: Array<{ on: boolean }> };
  assert.equal(final.data.on, false);
  assert.equal(final.media[0]!.on, true);
  const guest = await handleGbifConsentRoute({ db: dbOf(db) }, async () => ({ userId: "guest_5a50de" }), new Request("https://example.test/api/v1/records/rec-1/gbif-consent"), "/api/v1/records/rec-1/gbif-consent");
  assert.equal(guest!.status, 403);
});

test("taxon matching: only exact accepted matches are adopted; results are versioned and stored", async () => {
  assert.equal(decideTaxonMatch("species", CROW).decision, "accepted");
  assert.equal(decideTaxonMatch("species", { ...CROW, matchType: "FUZZY" }).decision, "hold");
  assert.equal(decideTaxonMatch("species", { ...CROW, matchType: "HIGHERRANK", rank: "GENUS" }).decision, "hold");
  assert.equal(decideTaxonMatch("species", { ...CROW, status: "SYNONYM", synonym: true }).decision, "hold");
  assert.equal(decideTaxonMatch("genus", CROW).decision, "hold", "submitted rank must agree with the matched rank");
  assert.equal(decideTaxonMatch(null, CROW).decision, "accepted");
  assert.equal(decideTaxonMatch("species", null).decision, "hold");

  const db = openDb();
  const first = await storeTaxonMatch(dbOf(db), { name: "  Corvus  Macrorhynchos ", rank: "Species", raw: CROW });
  assert.deepEqual([first.stored, first.version], [true, 1]);
  assert.deepEqual(await storeTaxonMatch(dbOf(db), { name: "corvus macrorhynchos", rank: "species", raw: CROW }).then((r) => [r.stored, r.version]), [false, 1]);
  const loaded = await loadLatestMatches(dbOf(db), [{ name: "Corvus macrorhynchos", rank: "species" }]);
  assert.equal([...loaded.values()][0]!.taxon!.name, "Corvus macrorhynchos");

  const calls: string[] = [];
  const matcher: TaxonMatcher = { match: async ({ name }) => { calls.push(name); return name === "Passer montanus" ? { ...CROW, canonicalName: name, species: name, genus: "Passer" } : null; } };
  const refreshed = await refreshTaxonMatches(dbOf(db), matcher, [{ name: "Passer montanus", rank: "species" }, { name: "Passer montanus", rank: "species" }, { name: "Unknown thing", rank: null }]);
  assert.deepEqual(refreshed, { looked: 2, stored: 1, skipped: 1 });

  const urls: string[] = [];
  const http = createGbifHttpMatcher((async (url: string) => { urls.push(url); return new Response(JSON.stringify(CROW), { status: 200 }); }) as unknown as typeof fetch);
  assert.equal((await http.match({ name: "Corvus macrorhynchos", rank: "species" }))!.matchType, "EXACT");
  assert.match(urls[0]!, /^https:\/\/api\.gbif\.org\/v1\/species\/match\?name=Corvus\+macrorhynchos&strict=true&rank=SPECIES$/);
});
