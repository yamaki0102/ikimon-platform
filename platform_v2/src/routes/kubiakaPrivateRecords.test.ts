import assert from "node:assert/strict";
import test from "node:test";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import type {
  KubiakaPrivateRecordDetail,
  KubiakaPrivateRecordOverview,
  KubiakaPrivateRecordPage,
} from "../services/kubiakaPrivateRecordsReadModel.js";
import {
  registerKubiakaPrivateRecordRoutes,
  type KubiakaPrivateRecordsRouteDependencies,
} from "./kubiakaPrivateRecords.js";

const overview: KubiakaPrivateRecordOverview = {
  totalCount: 1,
  latest: {
    visitId: "visit-owner-a",
    observedAt: "2026-08-01T09:00:00.000Z",
    savedAt: "2026-08-01T09:02:00.000Z",
    aiAssessmentStatus: "not_requested",
    photoCount: 2,
  },
};

const page: KubiakaPrivateRecordPage = {
  totalCount: 1,
  limit: 24,
  hasMore: false,
  records: [overview.latest!],
};

const detail: KubiakaPrivateRecordDetail = {
  ...overview.latest!,
  photos: [
    { photoIndex: 1, mimeType: "image/jpeg", widthPx: 1200, heightPx: 900 },
    { photoIndex: 2, mimeType: "image/jpeg", widthPx: 1200, heightPx: 900 },
  ],
};

function testUser(request: FastifyRequest): string | null {
  const value = request.headers["x-test-user"];
  return typeof value === "string" && value ? value : null;
}

function dependencies(): KubiakaPrivateRecordsRouteDependencies {
  return {
    async getSession(request) {
      const userId = testUser(request);
      return userId ? { userId } : null;
    },
    async readOverview(userId) {
      return userId === "owner-a" ? overview : { totalCount: 0, latest: null };
    },
    async readPage(userId) {
      return userId === "owner-a" ? page : { totalCount: 0, limit: 24, hasMore: false, records: [] };
    },
    async readDetail(visitId, userId) {
      return visitId === "visit-owner-a" && userId === "owner-a" ? detail : null;
    },
    async readAcknowledgement(recordId, userId) {
      return recordId === "occ:visit-owner-a:0" && userId === "owner-a"
        ? { recordId, visitId: "visit-owner-a", photoCount: 2 }
        : null;
    },
    async readMedia(visitId, photoIndex, userId) {
      return visitId === "visit-owner-a" && photoIndex === 1 && userId === "owner-a"
        ? { storagePath: "private-photos/v2-observations/visit-owner-a/photo.jpg", mimeType: "image/jpeg" }
        : null;
    },
    async readPrivateBuffer() {
      return Buffer.from("private-photo");
    },
  };
}

async function withApp<T>(run: (app: FastifyInstance) => Promise<T>): Promise<T> {
  const app = Fastify({ logger: false });
  await registerKubiakaPrivateRecordRoutes(app, dependencies());
  app.get("/kubiaka/me", async () => "legacy acknowledgement handler");
  try {
    return await run(app);
  } finally {
    await app.close();
  }
}

test("existing /kubiaka/me route is replaced without breaking acknowledgement links", async () => {
  await withApp(async (app) => {
    const home = await app.inject({
      method: "GET",
      url: "/kubiaka/me?lang=ja",
      headers: { "x-test-user": "owner-a" },
    });
    assert.equal(home.statusCode, 200);
    assert.match(home.body, /非公開記録 1件/);
    assert.doesNotMatch(home.body, /legacy acknowledgement handler/);

    const acknowledgement = await app.inject({
      method: "GET",
      url: "/kubiaka/me?record=occ%3Avisit-owner-a%3A0&lang=ja",
      headers: { "x-test-user": "owner-a" },
    });
    assert.equal(acknowledgement.statusCode, 200);
    assert.match(acknowledgement.body, /写真を受け付けました/);
    assert.match(acknowledgement.body, /\/kubiaka\/records\/visit-owner-a/);
    assert.doesNotMatch(acknowledgement.body, /occ(?::|%3A)visit-owner-a/i);
  });
});

test("private pages redirect signed-out users and set private no-store headers for owners", async () => {
  await withApp(async (app) => {
    const signedOut = await app.inject({ method: "GET", url: "/kubiaka/me/records?lang=ja" });
    assert.equal(signedOut.statusCode, 302);
    assert.match(String(signedOut.headers.location), /\/login/);
    assert.equal(signedOut.headers["cache-control"], "private, no-store");
    assert.equal(signedOut.headers.vary, "Cookie");

    const owner = await app.inject({
      method: "GET",
      url: "/kubiaka/me/records?lang=ja",
      headers: { "x-test-user": "owner-a" },
    });
    assert.equal(owner.statusCode, 200);
    assert.equal(owner.headers["cache-control"], "private, no-store");
    assert.equal(owner.headers.vary, "Cookie");
    assert.equal(owner.headers["x-robots-tag"], "noindex, nofollow");
    assert.equal(owner.headers["referrer-policy"], "no-referrer");
    assert.equal(owner.headers["x-frame-options"], "DENY");
    assert.equal(owner.headers["cross-origin-opener-policy"], "same-origin");
    assert.equal(owner.headers["cross-origin-resource-policy"], "same-origin");
    assert.match(String(owner.headers["content-security-policy"]), /default-src 'none'/);
    assert.match(String(owner.headers["content-security-policy"]), /img-src 'self'/);
    assert.equal(owner.headers["permissions-policy"], "camera=(), microphone=(), geolocation=()");
    assert.doesNotMatch(owner.body, /<script\b|googletagmanager|clarity\.ms|data-global-record/i);
    assert.doesNotMatch(owner.body, /href="[^"]*(?:\/map|share|report)/i);
  });
});

test("owner A can read detail while owner B and non-Kubiaka IDs get the same 404", async () => {
  await withApp(async (app) => {
    const ownerA = await app.inject({
      method: "GET",
      url: "/kubiaka/records/visit-owner-a?lang=ja",
      headers: { "x-test-user": "owner-a" },
    });
    assert.equal(ownerA.statusCode, 200);
    assert.equal((ownerA.body.match(/<img /g) ?? []).length, 2);
    assert.doesNotMatch(ownerA.body, /34\.7108|137\.7261|owner-a@example|point_latitude/i);
    assert.doesNotMatch(ownerA.body, /<script\b|googletagmanager|clarity\.ms|data-global-record/i);
    assert.doesNotMatch(ownerA.body, /href="[^"]*(?:\/map|share|report)/i);

    const ownerB = await app.inject({
      method: "GET",
      url: "/kubiaka/records/visit-owner-a?lang=ja",
      headers: { "x-test-user": "owner-b" },
    });
    const nonKubiaka = await app.inject({
      method: "GET",
      url: "/kubiaka/records/visit-generic?lang=ja",
      headers: { "x-test-user": "owner-a" },
    });
    assert.equal(ownerB.statusCode, 404);
    assert.equal(nonKubiaka.statusCode, 404);
    assert.equal(ownerB.body, nonKubiaka.body);
  });
});

test("private photos are owner-gated and never converted to public URLs", async () => {
  await withApp(async (app) => {
    const owner = await app.inject({
      method: "GET",
      url: "/api/v1/kubiaka/records/visit-owner-a/photos/1",
      headers: { "x-test-user": "owner-a" },
    });
    assert.equal(owner.statusCode, 200);
    assert.equal(owner.body, "private-photo");
    assert.equal(owner.headers["cache-control"], "private, no-store");
    assert.equal(owner.headers["x-content-type-options"], "nosniff");
    assert.equal(owner.headers["cross-origin-resource-policy"], "same-origin");

    const ownerB = await app.inject({
      method: "GET",
      url: "/api/v1/kubiaka/records/visit-owner-a/photos/1",
      headers: { "x-test-user": "owner-b" },
    });
    assert.equal(ownerB.statusCode, 404);
  });
});

test("forwarded base paths appear exactly once", async () => {
  await withApp(async (app) => {
    const response = await app.inject({
      method: "GET",
      url: "/kubiaka/me/records?lang=en",
      headers: { "x-test-user": "owner-a", "x-forwarded-prefix": "/preview" },
    });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /\/preview\/kubiaka\/records\/visit-owner-a/);
    assert.doesNotMatch(response.body, /\/preview\/preview\//);
  });
});

test("invalid acknowledgement IDs fail closed with 404", async () => {
  await withApp(async (app) => {
    const invalid = await app.inject({
      method: "GET",
      url: "/kubiaka/me?record=%3Cscript%3E&lang=en",
      headers: { "x-test-user": "owner-a" },
    });
    assert.equal(invalid.statusCode, 404);
    assert.doesNotMatch(invalid.body, /<script>/);
  });
});
