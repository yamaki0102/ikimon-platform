import { expect, test } from "@playwright/test";

function sessionCookie(response: { headers(): Record<string, string> }): string {
  const setCookie = response.headers()["set-cookie"] ?? "";
  const firstCookie = setCookie.split(";")[0]?.trim() ?? "";
  expect(firstCookie, "shadow session issue must return a cookie").toMatch(/^ikimon_v2_session=/);
  return firstCookie;
}

test.describe("cloudflare shadow staging proxy", () => {
  test.skip(process.env.EXPECT_CLOUDFLARE_SHADOW_STAGING !== "1", "Set EXPECT_CLOUDFLARE_SHADOW_STAGING=1 after the staging proxy env is configured.");

  test("exposes public shadow health through the staging base path and keeps internals closed", async ({ request }) => {
    const health = await request.get("/cloudflare-shadow/health", {
      headers: { accept: "application/json" },
    });
    expect(health.ok(), await health.text()).toBeTruthy();
    expect(health.headers()["x-ikimon-shadow-proxy"]).toBe("1");
    expect(await health.json()).toEqual({
      ok: true,
      environment: "shadow",
    });

    const internal = await request.get("/cloudflare-shadow/internal/production-import-summary", {
      headers: { accept: "application/json" },
    });
    expect([401, 403, 404]).toContain(internal.status());
    expect(internal.status(), "internal summary must not be exposed through the staging proxy").not.toBe(200);
  });

  test("proves non-ready Stream rows stay out of public-ready media through the staging route", async ({ request }) => {
    const response = await request.get("/cloudflare-shadow/shadow-smoke/stream-nonready-exclusion-proof", {
      headers: {
        accept: "application/json",
        "user-agent": "Python-urllib/3.12",
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    expect(response.headers()["x-ikimon-shadow-proxy"]).toBe("1");

    const payload = await response.json();
    expect(payload.gate).toBe("stream_nonready_excluded_from_public_ready");
    expect(payload.inventory).toMatchObject({
      total: 34,
      existsCount: 34,
      readyCount: 32,
      nonReadyCount: 2,
    });
    expect(payload.invariants).toMatchObject({
      allStreamRowsAccountedFor: true,
      readyCountMatchesExpected: true,
      nonReadyCountMatchesExpected: true,
      nonReadyRowsLedgered: true,
      publicReadyExcludesUnresolved: true,
      unresolvedCoversNonReady: true,
    });
  });

  test("rehearses auth, record, photo, video, map, and detail through the staging route", async ({ request }) => {
    const suffix = Date.now().toString(36);
    const userId = `staging-shadow-user-${suffix}`;
    const visitId = `staging-shadow-contract-${suffix}`;
    const exactLat = 34.71234;
    const exactLng = 137.81234;

    const issue = await request.post("/cloudflare-shadow/api/v1/auth/session/issue", {
      headers: { "content-type": "application/json", accept: "application/json" },
      data: {
        userId,
        displayName: "Staging Shadow User",
        roleName: "Observer",
        ttlHours: 1,
      },
    });
    expect(issue.ok(), await issue.text()).toBeTruthy();
    expect(issue.headers()["x-ikimon-shadow-proxy"]).toBe("1");
    const cookie = sessionCookie(issue);

    const session = await request.get("/cloudflare-shadow/api/v1/auth/session", {
      headers: { accept: "application/json", cookie },
    });
    expect(session.ok(), await session.text()).toBeTruthy();
    await expect(session.json()).resolves.toMatchObject({
      ok: true,
      session: { userId, roleName: "Observer" },
    });

    const upsert = await request.post("/cloudflare-shadow/api/v1/observations/upsert", {
      headers: { "content-type": "application/json", accept: "application/json", cookie },
      data: {
        observationId: visitId,
        userId,
        observedAt: "2026-06-15T08:45:00.000Z",
        latitude: exactLat,
        longitude: exactLng,
        locationAccuracyM: 12,
        note: "staging shadow route contract rehearsal",
        taxon: { vernacularName: "ステージング導線テスト植物", rank: "species" },
      },
    });
    expect(upsert.ok(), await upsert.text()).toBeTruthy();
    expect(upsert.headers()["x-ikimon-shadow-proxy"]).toBe("1");
    const upsertPayload = await upsert.json();
    expect(upsertPayload).toMatchObject({
      ok: true,
      visitId,
      occurrenceId: `occ:${visitId}:0`,
    });
    expect(upsertPayload.contributionReceipts).toHaveLength(3);

    const photo = await request.post(`/cloudflare-shadow/api/v1/observations/${encodeURIComponent(visitId)}/photos/upload`, {
      headers: { "content-type": "application/json", accept: "application/json", cookie },
      data: {
        filename: "staging-shadow.jpg",
        mimeType: "image/jpeg",
        base64Data: Buffer.from(`staging-shadow-image-${visitId}`).toString("base64"),
        facePrivacy: "no_faces",
      },
    });
    expect(photo.ok(), await photo.text()).toBeTruthy();
    expect(photo.headers()["x-ikimon-shadow-proxy"]).toBe("1");
    await expect(photo.json()).resolves.toMatchObject({
      ok: true,
      visitId,
      occurrenceId: `occ:${visitId}:0`,
      facePrivacy: "no_faces",
    });

    const direct = await request.post("/cloudflare-shadow/api/v1/videos/direct-upload", {
      headers: { "content-type": "application/json", accept: "application/json", cookie },
      data: {
        filename: "staging-shadow.mp4",
        observationId: visitId,
        mediaRole: "observation_video",
        uploadProtocol: "post",
        fileSizeBytes: 18,
      },
    });
    expect(direct.ok(), await direct.text()).toBeTruthy();
    const directPayload = await direct.json();
    expect(directPayload).toMatchObject({
      ok: true,
      uploadProtocol: "post",
    });
    expect(String(directPayload.uid)).toMatch(/^stream_/);

    const uid = String(directPayload.uid);
    const videoBody = await request.put(`/cloudflare-shadow/api/v1/videos/${encodeURIComponent(uid)}/body`, {
      headers: { "content-type": "video/mp4", accept: "application/json", cookie },
      data: "staging-video-bytes",
    });
    expect(videoBody.ok(), await videoBody.text()).toBeTruthy();
    await expect(videoBody.json()).resolves.toMatchObject({
      ok: true,
      uid,
      bytes: 19,
    });

    const finalize = await request.post(`/cloudflare-shadow/api/v1/videos/${encodeURIComponent(uid)}/finalize`, {
      headers: { "content-type": "application/json", accept: "application/json", cookie },
      data: {
        observationId: visitId,
        durationMs: 9000,
        readyToStream: true,
        bytes: 19,
      },
    });
    expect(finalize.ok(), await finalize.text()).toBeTruthy();
    const finalizePayload = await finalize.json();
    expect(finalizePayload).toMatchObject({
      ok: true,
      video: {
        provider: "cloudflare_stream",
        providerUid: uid,
        mediaType: "video",
        assetRole: "observation_video",
        uploadStatus: "ready",
        readyToStream: true,
        visitId,
        occurrenceId: `occ:${visitId}:0`,
      },
    });

    let detailPayload: any = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const detail = await request.get(`/cloudflare-shadow/api/v1/observations/${encodeURIComponent(`occ:${visitId}:0`)}/public-detail`, {
        headers: { accept: "application/json" },
      });
      if (detail.ok()) {
        detailPayload = await detail.json();
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    expect(detailPayload).toMatchObject({
      ok: true,
      observation: {
        visitId,
        occurrenceId: `occ:${visitId}:0`,
        publicLocation: { cellId: "cell:34.71,137.81" },
      },
    });
    expect(JSON.stringify(detailPayload)).not.toContain(String(exactLat));
    expect(JSON.stringify(detailPayload)).not.toContain(String(exactLng));
    expect(detailPayload.observation.photoAssets.length).toBeGreaterThanOrEqual(1);
    expect(detailPayload.observation.videoAssets.length).toBeGreaterThanOrEqual(1);

    const mapCells = await request.get("/cloudflare-shadow/api/v1/map/cells?bbox=137.70,34.70,137.82,34.72&zoom=13", {
      headers: { accept: "application/json" },
    });
    expect(mapCells.ok(), await mapCells.text()).toBeTruthy();
    const mapCellPayload = await mapCells.json();
    expect(mapCellPayload.type).toBe("FeatureCollection");
    expect(mapCellPayload.stats.totalRecords).toBeGreaterThan(0);

    const mapObservations = await request.get("/cloudflare-shadow/api/v1/map/observations?cell_id=cell%3A34.71%2C137.81", {
      headers: { accept: "application/json" },
    });
    expect(mapObservations.ok(), await mapObservations.text()).toBeTruthy();
    const mapObservationPayload = await mapObservations.json();
    expect(mapObservationPayload.items.some((item: any) => item.visitId === visitId)).toBe(true);
    expect(JSON.stringify(mapObservationPayload)).not.toContain(String(exactLat));
    expect(JSON.stringify(mapObservationPayload)).not.toContain(String(exactLng));

    const detailPage = await request.get(`/cloudflare-shadow/observations/${encodeURIComponent(visitId)}`, {
      headers: { accept: "text/html" },
    });
    expect(detailPage.ok(), await detailPage.text()).toBeTruthy();
    const detailHtml = await detailPage.text();
    expect(detailHtml).toContain('data-shadow-observation-detail="1"');
    expect(detailHtml).not.toContain(String(exactLat));
    expect(detailHtml).not.toContain(String(exactLng));
  });
});
