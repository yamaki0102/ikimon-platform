import assert from "node:assert/strict";
import test from "node:test";
import Fastify, { type FastifyInstance } from "fastify";
import { registerRegionalSourceRoutes } from "./regionalSources.js";

async function withApp<T>(run: (app: FastifyInstance) => Promise<T>): Promise<T> {
  const app = Fastify({ logger: false });
  await registerRegionalSourceRoutes(app);
  try {
    return await run(app);
  } finally {
    await app.close();
  }
}

test("regional source list preserves v1 and adds explicit edition state", async () => {
  await withApp(async (app) => {
    const response = await app.inject({ method: "GET", url: "/api/regional-sources" });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.schema, "zukan.regional-source-registry/v1");
    assert.equal(body.extendedSchema, "zukan.regional-source-registry/v2");
    assert.equal(body.foundationBinding.schema, "zukan.foundation-source-binding/v1");
    assert.equal(body.foundationBinding.projectionEmbedded, false);
    assert.ok(Array.isArray(body.publishers));
    assert.ok(Array.isArray(body.sources));
    assert.ok(Array.isArray(body.editions));
    assert.ok(Array.isArray(body.entries));
    assert.equal(body.summary.sourceCount, body.sources.length);
    assert.ok(body.summary.byState);
    assert.equal(body.extendedSummary.sourceCount, body.sources.length);
    assert.equal(body.extendedSummary.editionCount, body.editions.length);
  });
});

test("regional source filters combine and expose the applied filter", async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: "GET",
      url: "/api/regional-sources?publisherKind=municipality&format=rdf&rightsClass=ATTRIBUTION_REUSE&acquisitionState=METADATA_ONLY&updatedAfter=2024-01-01",
    });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.sources.length, 2);
    assert.equal(body.extendedSummary.sourceCount, 2);
    assert.equal(body.appliedFilter.publisherKind, "municipality");
    assert.equal(body.appliedFilter.acquisitionState, "METADATA_ONLY");
    assert.deepEqual(
      body.sources.map((source: { sourceAssetId: string }) => source.sourceAssetId).sort(),
      [
        "source:iwata:cultural-properties-linkdata",
        "source:iwata:tourism-facilities-linkdata",
      ],
    );
  });
});

test("invalid registry filters fail closed", async () => {
  await withApp(async (app) => {
    const invalidRights = await app.inject({
      method: "GET",
      url: "/api/regional-sources?rightsClass=PUBLIC_WITHOUT_REVIEW",
    });
    assert.equal(invalidRights.statusCode, 400);
    assert.equal(invalidRights.json().error, "invalid_rights_class");

    const invalidDate = await app.inject({
      method: "GET",
      url: "/api/regional-sources?updatedAfter=not-a-date",
    });
    assert.equal(invalidDate.statusCode, 400);
    assert.equal(invalidDate.json().error, "invalid_updated_after");
  });
});

test("regional source detail keeps the Miyakoda PDF fail closed", async () => {
  await withApp(async (app) => {
    const id = "source:miyakoda:wakuwaku-map:2025";
    const response = await app.inject({
      method: "GET",
      url: `/api/regional-sources/${encodeURIComponent(id)}`,
    });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.schema, "zukan.regional-source-registry-item/v1");
    assert.equal(body.extendedSchema, "zukan.regional-source-registry-item/v2");
    assert.equal(body.source.sourceAssetId, id);
    assert.equal(body.source.rightsClass, "INDEX_ONLY");
    assert.equal(body.source.state, "DISCOVERED");
    assert.equal(body.currentEdition.sourceEditionId, "edition:miyakoda:wakuwaku-map:2025");
    assert.equal(body.currentEdition.acquisitionState, "NOT_ACQUIRED");
    assert.equal(body.currentEdition.checksumSha256, null);
    assert.equal(body.foundationBinding.projectionEmbedded, false);
  });
});

test("unknown regional source returns a public-safe 404", async () => {
  await withApp(async (app) => {
    const response = await app.inject({ method: "GET", url: "/api/regional-sources/source%3Aunknown" });
    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), {
      schema: "zukan.regional-source-registry-error/v1",
      error: "source_not_found",
    });
  });
});
