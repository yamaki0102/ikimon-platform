import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { PERSON_PUBLICATIONS } from "../../src/content/personPublications";
import {
  PERSON_EXCHANGE_SCHEMA, readPersonEdition, receivePersonEdition,
  type PersonD1, type PersonD1Statement, type PersonEditionEnvelope, type VerifiedPersonIssuer,
} from "./personPublicationExchange";

type MockStatement = PersonD1Statement & { sql: string; args: (string | number | null)[] };
function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/core/0021_public_person_publications.sql", import.meta.url), "utf8"));
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
  return { sqlite, database };
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

test("create, exact replay, update, withdrawal, and same opaque locator after republication", async t => {
  const { sqlite, database } = fixture(); t.after(() => sqlite.close());
  assert.equal(await receivePersonEdition(database, p1, verified), "created");
  assert.equal(await receivePersonEdition(database, p1, verified), "replayed");
  const p2 = issue({ editionId: "profile-2", revision: 2, profile: { ...p1.profile!, edition: "profile-2", name: "新しい表示名" } });
  assert.equal(await receivePersonEdition(database, p2, verified), "updated");
  assert.equal((await readPersonEdition(database, p1.publicId)).profile?.name, "新しい表示名");
  assert.equal((sqlite.prepare("SELECT count(*) AS n FROM zukan_person_publications").get() as {n:number}).n, 1);
  const gone = issue({ editionId: "profile-3", revision: 3, action: "withdraw", profile: null });
  assert.equal(await receivePersonEdition(database, gone, verified), "updated");
  assert.deepEqual(await readPersonEdition(database, p1.publicId), { found: true, profile: null });
  assert.equal(await receivePersonEdition(database, gone, verified), "replayed");
  const returnEdition = issue({ editionId: "profile-4", revision: 4, action: "publish", profile: { ...p1.profile!, edition: "profile-4" } });
  assert.equal(await receivePersonEdition(database, returnEdition, verified), "updated");
  assert.equal((await readPersonEdition(database, p1.publicId)).profile?.publicId, p1.publicId);
  assert.equal((sqlite.prepare("SELECT count(*) AS n FROM zukan_person_publication_editions").get() as {n:number}).n, 4);
});

test("stale concurrent revision, different issuer, and changed replay never overwrite", async t => {
  const { sqlite, database } = fixture(); t.after(() => sqlite.close());
  await receivePersonEdition(database, p1, verified);
  await assert.rejects(receivePersonEdition(database, issue({ editionId: "conflict", profile: { ...p1.profile!, edition: "conflict" } }), verified), /person_edition_stale_or_conflicting/u);
  await assert.rejects(receivePersonEdition(database, issue({ revision: 2, editionId: "profile-2", profile: { ...p1.profile!, edition: "profile-2" }, issuerPublicRef: "publisher_other_actor" }),
    { ...verified, issuerPublicRef: "publisher_other_actor" }), /person_issuer_conflict/u);
  await assert.rejects(receivePersonEdition(database, issue({ revision: 0 }), verified), /person_publication_authority_denied/u);
  assert.equal((await readPersonEdition(database, p1.publicId)).profile?.edition, "profile-1");
});

test("subject consent, adult/guardian authority and unknown private metadata fail closed", async t => {
  const { sqlite, database } = fixture(); t.after(() => sqlite.close());
  await assert.rejects(receivePersonEdition(database, p1,
    { ...verified, subjectConsent: false } as unknown as VerifiedPersonIssuer), /person_publication_authority_denied/u);
  await assert.rejects(receivePersonEdition(database, p1,
    { ...verified, ageAuthority: "unknown" } as unknown as VerifiedPersonIssuer), /person_publication_authority_denied/u);
  const privatePayload = issue({ profile: { ...p1.profile!, privateEmail: "leak@example.invalid" } as unknown as NonNullable<PersonEditionEnvelope["profile"]> });
  await assert.rejects(receivePersonEdition(database, privatePayload, verified), /person_public_profile_invalid/u);
  assert.equal((sqlite.prepare("SELECT count(*) AS n FROM zukan_person_publications").get() as {n:number}).n, 0);
});

test("alias and anonymous revisions are sanitized before they ever enter D1", async t => {
  const { sqlite, database } = fixture(); t.after(() => sqlite.close());
  const alias = issue({ profile: { ...p1.profile!, identityMode: "alias", discoverability: "unlisted",
    name: "浜松の案内役", latinName: "SECRET_LEGAL_ROMANIZED", slug: "prior-legal-name" } });
  await receivePersonEdition(database, alias, verified);
  const projected = (await readPersonEdition(database, p1.publicId)).profile!;
  assert.equal(projected.name, "浜松の案内役");
  assert.equal(projected.latinName, "");
  assert.equal(projected.slug, "person");
  assert.equal(projected.discoverability, "unlisted");
  const opaque = issue({ editionId: "profile-2", revision: 2, profile: {
    ...p1.profile!, edition: "profile-2", identityMode: "anonymous", name: "SECRET_LEGAL_NAME",
    latinName: "SECRET_ROMAN", slug: "secret-legal-name" } });
  await receivePersonEdition(database, opaque, verified);
  const anonymous = (await readPersonEdition(database, p1.publicId)).profile!;
  assert.equal(anonymous.name, "匿名");
  assert.equal(anonymous.slug, "person");
  assert.deepEqual(anonymous.links, []);
  assert.equal(JSON.stringify(anonymous).includes("SECRET"), false);
});
