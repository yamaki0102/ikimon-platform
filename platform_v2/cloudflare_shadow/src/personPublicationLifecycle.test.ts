import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { PERSON_PUBLICATIONS } from "../../src/content/personPublications";
import {
  PERSON_EXCHANGE_SCHEMA, readPersonEdition, receivePersonEdition,
  type PersonD1, type PersonD1Statement, type PersonEditionEnvelope, type VerifiedPersonIssuer, type PersonEditionBlobStore,
} from "./personPublicationExchange";

type MockStatement = PersonD1Statement & { sql: string; args: (string | number | null)[] };
function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/core/0021_public_person_publications.sql", import.meta.url), "utf8"));
  const objects = new Map<string, string>();
  const blobs: PersonEditionBlobStore = {
    async put(key, value) { objects.set(key, value); return { key }; },
    async get(key) { const value = objects.get(key); return value === undefined ? null : { async text() { return value; } }; },
  };
  const database: PersonD1 = {
    prepare(sql: string) {
      const stmt: MockStatement = {
        sql, args: [],
        bind(...args) { this.args = args; return this; },
        async first<T = Record<string, unknown>>() {
          return (sqlite.prepare(this.sql).get(...this.args) ?? null) as T | null;
        },
      };
      return stmt;
    },
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        for (const entry of statements) {
          const stmt = entry as MockStatement;
          sqlite.prepare(stmt.sql).run(...stmt.args);
        }
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
      return [];
    },
  };
  return { sqlite, database, blobs, objects };
}
const verified: VerifiedPersonIssuer = {
  issuerPublicRef: "publisher_nocosil_owner",
  actorAuthorized: true, subjectConsent: true, ageAuthority: "adult",
};
const old = PERSON_PUBLICATIONS[0]!;
const p1: PersonEditionEnvelope = {
  schema: PERSON_EXCHANGE_SCHEMA, issuerPublicRef: verified.issuerPublicRef,
  publicId: old.publicId, editionId: "profile-1", revision: 1, action: "publish",
  profile: { ...old, edition: "profile-1" },
};
const issue = (input: Partial<PersonEditionEnvelope> = {}): PersonEditionEnvelope => ({ ...p1, ...input });

test("an exact retry is independent of JSON object key order", async t => {
  const { sqlite, database, blobs } = fixture(); t.after(() => sqlite.close());
  await receivePersonEdition(database, blobs, p1, verified);
  const reversed = Object.fromEntries(Object.entries(p1.profile!).reverse()) as unknown as NonNullable<PersonEditionEnvelope["profile"]>;
  assert.equal(await receivePersonEdition(database, blobs, issue({ profile: reversed }), verified), "replayed");
});

test("an applied D1 batch with a lost response is read back, not reported as a failed publication", async t => {
  const { sqlite, database, blobs } = fixture(); t.after(() => sqlite.close());
  const lostResponse: PersonD1 = {
    prepare: query => database.prepare(query),
    async batch(statements) { await database.batch(statements); throw new Error("injected_response_lost_after_commit"); },
  };
  assert.equal(await receivePersonEdition(lostResponse, blobs, p1, verified), "created");
  assert.equal((await readPersonEdition(database, blobs, p1.publicId)).profile?.edition, "profile-1");
});

test("a withdrawal during the blob read cannot return the withdrawn edition", async t => {
  const { sqlite, database, blobs } = fixture(); t.after(() => sqlite.close());
  await receivePersonEdition(database, blobs, p1, verified);
  let withdraw = true;
  const racingBlobs: PersonEditionBlobStore = {
    put: (key, value) => blobs.put(key, value),
    async get(key) {
      const result = await blobs.get(key);
      if (withdraw) {
        withdraw = false;
        await receivePersonEdition(database, blobs, issue({ editionId: "profile-2", revision: 2, action: "withdraw", profile: null }), verified);
      }
      return result;
    },
  };
  assert.deepEqual(await readPersonEdition(database, racingBlobs, p1.publicId), { found: true, profile: null });
});

test("malformed public field types and invalid calendar dates are rejected before storage", async t => {
  const { sqlite, database, blobs, objects } = fixture(); t.after(() => sqlite.close());
  for (const delta of [{ slug: 123 }, { updatedOn: "2026-02-31" }, { updatedOn: "2026-13-01" }]) {
    const malformed = { ...p1.profile!, ...delta } as unknown as NonNullable<PersonEditionEnvelope["profile"]>;
    await assert.rejects(receivePersonEdition(database, blobs, issue({ profile: malformed }), verified), /person_public_profile_invalid/u);
  }
  assert.equal(objects.size, 0);
});

test("parallel duplicate and conflicting edits cannot create two current editions", async t => {
  const { sqlite, database, blobs } = fixture(); t.after(() => sqlite.close());
  const results = await Promise.allSettled([
    receivePersonEdition(database, blobs, p1, verified),
    receivePersonEdition(database, blobs, p1, verified),
    receivePersonEdition(database, blobs, issue({ profile: { ...p1.profile!, name: "競合候補" } }), verified),
  ]);
  assert.equal(results.filter(x => x.status === "fulfilled").length, 2);
  assert.equal((await readPersonEdition(database, blobs, p1.publicId)).profile?.name, p1.profile!.name);
  assert.equal((sqlite.prepare("SELECT count(*) AS n FROM zukan_person_publication_editions").get() as {n:number}).n, 1);
});

test("failed or corrupted R2 writes never advance the public pointer", async t => {
  const { sqlite, database, blobs } = fixture(); t.after(() => sqlite.close());
  await receivePersonEdition(database, blobs, p1, verified);
  const corrupt: PersonEditionBlobStore = { put: (key,value) => blobs.put(key,value), async get() { return { async text() { return "corrupt"; } }; } };
  const p2 = issue({ revision: 2, editionId: "profile-2", profile: { ...p1.profile!, edition: "profile-2" } });
  await assert.rejects(receivePersonEdition(database, corrupt, p2, verified), /person_blob_readback_unavailable/u);
  assert.equal((await readPersonEdition(database, blobs, p1.publicId)).profile?.edition, "profile-1");
});

import { deliverNocosilPersonEdition, publicIdForNocosilPublisher } from "./personPublicationService";

test("private NOCOSIL delivery binds opaque subject and verifies create, retry, update and withdrawal", async t => {
  const { sqlite, database, blobs } = fixture(); t.after(() => sqlite.close());
  const issuer = { ...verified, issuerPublicRef: "publisher_" + "a".repeat(64) };
  const publicId = await publicIdForNocosilPublisher(issuer.issuerPublicRef);
  const envelope: PersonEditionEnvelope = { ...p1, issuerPublicRef: issuer.issuerPublicRef, publicId,
    profile: { ...p1.profile!, publicId, identityMode: "alias", name: "合成テスト", subjectKind: "organization" } };
  const env = { CORE_DB: database, ASSET_BUCKET: blobs };
  const first = await deliverNocosilPersonEdition(env, envelope, issuer);
  assert.equal(first.state, "published"); assert.equal(first.disposition, "created");
  assert.equal(first.path, "/ja/organizations/person-" + publicId);
  assert.equal((await deliverNocosilPersonEdition(env, envelope, issuer)).disposition, "replayed");
  const revision = { ...envelope, revision: 2, editionId: "second", profile: { ...envelope.profile!, edition: "second", summary: "新しい要約" } };
  assert.equal((await deliverNocosilPersonEdition(env, revision, issuer)).revision, 2);
  const gone = await deliverNocosilPersonEdition(env, { ...envelope, revision: 3, editionId: "withdrawn", action: "withdraw", profile: null }, issuer);
  assert.equal(gone.path, null); assert.equal(gone.state, "withdrawn");
});

test("private delivery cannot claim an arbitrary/legacy public ID or a different publisher", async t => {
  const { sqlite, database, blobs, objects } = fixture(); t.after(() => sqlite.close());
  const issuer = { ...verified, issuerPublicRef: "publisher_" + "b".repeat(64) };
  await assert.rejects(deliverNocosilPersonEdition({ CORE_DB: database, ASSET_BUCKET: blobs }, { ...p1, issuerPublicRef: issuer.issuerPublicRef }, issuer), /person_publication_subject_binding_denied/u);
  await assert.rejects(deliverNocosilPersonEdition({ CORE_DB: database, ASSET_BUCKET: blobs }, p1, issuer), /person_publication_authority_denied/u);
  assert.equal(objects.size, 0);
});

test("private service does not treat missing resources or malformed publisher references as success", async () => {
  const issuer = { ...verified, issuerPublicRef: "publisher_" + "c".repeat(64) };
  const publicId = await publicIdForNocosilPublisher(issuer.issuerPublicRef);
  const envelope = { ...p1, issuerPublicRef: issuer.issuerPublicRef, publicId, profile: { ...p1.profile!, publicId } };
  await assert.rejects(deliverNocosilPersonEdition({}, envelope, issuer), /person_publication_storage_unavailable/u);
  await assert.rejects(publicIdForNocosilPublisher("publisher_private_workspace_id"), /person_publisher_reference_invalid/u);
});
