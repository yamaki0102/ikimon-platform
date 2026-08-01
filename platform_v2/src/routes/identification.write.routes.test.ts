import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { buildApp } from "../app.js";

test("public identification write is retired from Fastify", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/observations/occ-1/identifications",
      headers: { "content-type": "application/json" },
      payload: {
        proposedName: "Pieris rapae",
        proposedRank: "species",
        stance: "support",
      },
    });

    assert.equal(response.statusCode, 404);
  } finally {
    await app.close();
  }
});

test("public dispute write is retired from Fastify", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/observations/occ-1/disputes",
      headers: { "content-type": "application/json" },
      payload: {
        kind: "needs_more_evidence",
        reason: "Need a close-up photo.",
      },
    });

    assert.equal(response.statusCode, 404);
  } finally {
    await app.close();
  }
});

test("AI judgement review requires a session", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/observation-records/occ-1/ai-review",
      headers: { "content-type": "application/json" },
      payload: {
        reviewState: "agree",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "session_required");
  } finally {
    await app.close();
  }
});

test("identification workbench hold requires a session", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/observations/occ-1/identification-workbench-hold",
      headers: { "content-type": "application/json" },
      payload: {
        reason: "Review later.",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "session_required");
  } finally {
    await app.close();
  }
});

test("specialist dispute resolution requires a session before touching DB", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/specialist/disputes/dispute-1/resolve",
      headers: { "content-type": "application/json" },
      payload: {
        resolution: "reject_dispute",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "session_required");
  } finally {
    await app.close();
  }
});

test("reference duplicate merge requires a session before touching DB", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/references/duplicates/merge",
      headers: { "content-type": "application/json" },
      payload: {
        canonicalSourceId: "00000000-0000-0000-0000-000000000001",
        duplicateSourceId: "00000000-0000-0000-0000-000000000002",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "session_required");
  } finally {
    await app.close();
  }
});

test("alternative identifications keep selected reference evidence attached", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "identificationParticipation.ts"), "utf8");

  assert.match(source, /referenceSourceIds\?: string\[\]/);
  assert.match(source, /const identificationId = await upsertPublicIdentification\(client, \{[\s\S]*stance: "alternative"/);
  assert.match(source, /recordIdentificationReferenceSelections\(client, \{[\s\S]*sourceIds: input\.referenceSourceIds \?\? \[\]/);
});

test("Worker dispute write accepts reference evidence payloads", async () => {
  const source = await readFile(path.join(process.cwd(), "cloudflare_shadow", "src", "index.ts"), "utf8");

  assert.match(source, /referenceSourceIds\?: unknown/);
  assert.match(source, /referenceLocator\?: unknown/);
  assert.match(source, /async function openCompatibleObservationDispute/);
  assert.match(source, /const referenceSourceIds = Array\.isArray\(input\.referenceSourceIds\)/);
  assert.match(source, /const referenceLocator = normalizeOptionalText\(input\.referenceLocator\)/);
  assert.match(source, /sourcePayload = \{[\s\S]*source: "cloudflare_public_dispute"[\s\S]*referenceSourceIds,[\s\S]*referenceLocator,/);
});

test("public observation write routes apply per-user rate limits", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "routes", "write.ts"), "utf8");

  assert.match(source, /function assertMutationRateLimit/);
  assert.match(source, /assertAuthRateLimit\(\[scope, userId, request\.ip\]/);
  assert.match(source, /"observation-upsert"/);
  assert.match(source, /"observation-photo-upload"/);
  assert.match(source, /"identification-workbench-hold"/);
  assert.doesNotMatch(source, /"observation-identification"/);
  assert.doesNotMatch(source, /"observation-dispute"/);
  assert.doesNotMatch(source, /"video-direct-upload"/);
  assert.doesNotMatch(source, /"video-finalize"/);
});

test("identification workbench hold has a migration and read/write guards", async () => {
  const migration = await readFile(path.join(process.cwd(), "db", "migrations", "0131_identification_workbench_holds.sql"), "utf8");
  const service = await readFile(path.join(process.cwd(), "src", "services", "identificationWorkbenchHolds.ts"), "utf8");
  const readRoute = `${await readFile(path.join(process.cwd(), "src", "routes", "read.ts"), "utf8")}\n${await readFile(path.join(process.cwd(), "src", "routes", "personalLibrary.ts"), "utf8")}`;
  const writeRoute = await readFile(path.join(process.cwd(), "src", "routes", "write.ts"), "utf8");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS identification_workbench_holds/);
  assert.match(migration, /occurrence_id\s+TEXT\s+NOT NULL REFERENCES occurrences\(occurrence_id\)/);
  assert.match(migration, /UNIQUE \(occurrence_id, actor_user_id\)/);
  assert.match(service, /holdIdentificationWorkbenchItem/);
  assert.match(service, /listHeldIdentificationOccurrenceIds/);
  assert.match(service, /where actor_user_id = \$1/);
  assert.doesNotMatch(service, /\$1::uuid/);
  assert.match(readRoute, /listHeldIdentificationOccurrenceIds/);
  assert.match(readRoute, /view === "needs_id" && session\?\.userId[\s\S]*listHeldIdentificationOccurrenceIds\(session\.userId\)/);
  assert.match(readRoute, /data-hold-endpoint/);
  assert.match(writeRoute, /identification-workbench-hold/);
});

test("reference duplicate merge preserves evidence before marking duplicate", async () => {
  const serviceSource = await readFile(path.join(process.cwd(), "src", "services", "referenceLibrary.ts"), "utf8");
  const routeSource = await readFile(path.join(process.cwd(), "src", "routes", "references.ts"), "utf8");

  assert.match(serviceSource, /confirmReferenceDuplicateMerge/);
  assert.match(serviceSource, /insert into identification_references \([\s\S]*from identification_references ir[\s\S]*where ir\.source_id = \$2::uuid/);
  assert.match(serviceSource, /catalog_status = 'duplicate'/);
  assert.match(routeSource, /data-ref-duplicate-merge/);
  assert.match(routeSource, /canonicalへ統合/);
});
