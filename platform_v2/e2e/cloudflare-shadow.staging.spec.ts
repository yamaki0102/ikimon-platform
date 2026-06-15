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

  test("proves missing legacy media stays ledgered and degraded through the staging route", async ({ request }) => {
    const response = await request.get("/cloudflare-shadow/shadow-smoke/missing-media-ledger-proof", {
      headers: { accept: "application/json" },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    expect(response.headers()["x-ikimon-shadow-proxy"]).toBe("1");

    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: true,
      gate: "missing_legacy_asset_degraded_public_readmodel",
      expected: {
        missingLegacyAssets: 47,
        streamInventoryPending: 34,
      },
      invariants: {
        missingLegacyAssetsLedgered: true,
        streamInventoryPendingLedgered: true,
        missingLegacyAssetsNotUploadedVerified: true,
        unresolvedAssetsRemainExplicit: true,
        publicReadyDoesNotIncludeUnresolved: true,
      },
    });
  });

  test("proves video metadata privacy and emergency takedown through the staging route", async ({ request }) => {
    const suffix = Date.now().toString(36);
    const videoProof = await request.get(`/cloudflare-shadow/shadow-smoke/video-metadata-proof?id=staging-${suffix}`, {
      headers: { accept: "application/json" },
    });
    expect(videoProof.ok(), await videoProof.text()).toBeTruthy();
    expect(videoProof.headers()["x-ikimon-shadow-proxy"]).toBe("1");
    const videoPayload = await videoProof.json();
    expect(videoPayload).toMatchObject({
      ok: true,
      served: {
        videoStatus: 200,
        videoContentType: "video/mp4",
        posterStatus: 200,
        posterContentType: "image/jpeg",
      },
      videoInspection: {
        tool: "shadow-video-container-byte-signature-scan-v1",
        scannedContainer: "mp4",
        ftypPresent: true,
        gpsExifPresent: false,
      },
      posterInspection: {
        gpsExifPresent: false,
      },
      visibility: {
        publicDetailVisible: true,
        mapVisible: true,
      },
      invariants: {
        servedVideoIsMp4: true,
        videoGpsExifAbsent: true,
        posterGpsExifAbsent: true,
        exactLocationExposed: false,
      },
    });

    const takedown = await request.get(`/cloudflare-shadow/shadow-smoke/takedown-proof?id=staging-${suffix}`, {
      headers: { accept: "application/json" },
    });
    expect(takedown.ok(), await takedown.text()).toBeTruthy();
    expect(takedown.headers()["x-ikimon-shadow-proxy"]).toBe("1");
    const takedownPayload = await takedown.json();
    expect(takedownPayload).toMatchObject({
      ok: true,
      before: {
        publicDetailVisible: true,
        mapVisible: true,
      },
      after: {
        readmodelRows: 0,
        publicDetailVisible: false,
        mapVisible: false,
      },
      canonical: {
        emergency_hidden: 1,
      },
      invariants: {
        canonicalDeleted: false,
        readmodelHidden: true,
        publicDetailHidden: true,
        mapHidden: true,
        exactLocationExposed: false,
      },
    });
    expect(takedownPayload.canonical.asset_count).toBeGreaterThan(0);
  });

  test("proves update, hide, and idempotent rollback replay through the staging route", async ({ request }) => {
    const suffix = Date.now().toString(36);
    const response = await request.get(`/cloudflare-shadow/shadow-smoke/update-delete-replay-proof?id=staging-${suffix}`, {
      headers: { accept: "application/json" },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    expect(response.headers()["x-ikimon-shadow-proxy"]).toBe("1");

    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: true,
      gate: "integrated_staging_update_delete_idempotent_replay",
      mode: "dry_run_no_vps_mutation",
      counts: {
        rollbackLedger: 4,
        observations: 1,
        assets: 1,
        eventTypes: {
          "observation.upsert": 2,
          "asset.photo.upload": 1,
          "observation.hide": 1,
        },
      },
      beforeHide: {
        readmodelRows: 1,
        publicDetailVisible: true,
        mapVisible: true,
      },
      afterHide: {
        readmodelRows: 0,
        publicDetailVisible: false,
        mapVisible: false,
      },
      canonical: {
        emergency_hidden: 1,
        asset_count: 1,
      },
      replay: {
        target: "VPS/PostgreSQL dry-run artifact",
        mutationPerformed: false,
        finalObservation: {
          note: "shadow update/delete replay proof updated",
          emergencyHidden: true,
        },
      },
      invariants: {
        updateLedgered: true,
        hideLedgered: true,
        assetLedgered: true,
        replayIdempotent: true,
        finalNoteUpdated: true,
        finalHidden: true,
        canonicalPreserved: true,
        publicSurfacesHidden: true,
        mutationPerformed: false,
        productionTrafficAffected: false,
      },
    });
    expect(payload.replay.firstFingerprint).toBe(payload.replay.secondFingerprint);
  });

  test("proves production-imported data and R2 inventory through the staging route", async ({ request }) => {
    const response = await request.get("/cloudflare-shadow/shadow-smoke/production-import-dress-rehearsal-proof", {
      headers: { accept: "application/json" },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    expect(response.headers()["x-ikimon-shadow-proxy"]).toBe("1");

    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: true,
      gate: "production_imported_data_r2_inventory_dress_rehearsal",
      mode: "dry_run_no_production_mutation",
      publicReadmodel: {
        rows: 588,
        assetCount: 1961,
        publicReadyAssetCount: 1906,
        unresolvedAssetCount: 55,
      },
      mediaCoverage: {
        evidenceAssets: 2032,
        r2Verified: 1951,
        legacyLedgered: 81,
        streamExists: 34,
      },
      r2Ledger: {
        verifiedCount: 1951,
        verifiedBytes: 2338615108,
        checksumMatchCount: 1951,
      },
      r2Inventory: {
        totalObjects: 1951,
        totalBytes: 2338615108,
      },
      streamInventory: {
        total: 34,
        existsCount: 34,
        readyCount: 32,
        nonReadyCount: 2,
      },
      invariants: {
        productionReadmodelImported: true,
        evidenceAssetsImported: true,
        mediaCoverageComplete: true,
        r2LedgerCountMatches: true,
        r2LedgerChecksumVerified: true,
        r2InventoryCountMatchesLedger: true,
        r2InventoryBytesMatchLedger: true,
        unresolvedAssetsRemainExplicit: true,
        streamInventoryExists: true,
        mutationPerformed: false,
        productionTrafficAffected: false,
      },
    });
    expect(payload.r2Inventory.prefixes).toEqual([
      expect.objectContaining({
        prefix: "import-smoke/20260615/",
        objects: 1156,
        bytes: 1528180221,
      }),
      expect.objectContaining({
        prefix: "import-smoke/20260615-data/original/",
        objects: 795,
        bytes: 810434887,
      }),
    ]);
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

    const reverseDelta = await request.get(`/cloudflare-shadow/shadow-smoke/reverse-delta-proof?target_prefix=${encodeURIComponent(visitId)}&expected_observations=1&expected_assets=2&expected_ledger=3`, {
      headers: { accept: "application/json" },
    });
    expect(reverseDelta.ok(), await reverseDelta.text()).toBeTruthy();
    expect(reverseDelta.headers()["x-ikimon-shadow-proxy"]).toBe("1");
    const reverseDeltaPayload = await reverseDelta.json();
    expect(reverseDeltaPayload).toMatchObject({
      ok: true,
      gate: "integrated_staging_reverse_delta_write_drain",
      mode: "dry_run_no_vps_mutation",
      targetPrefix: visitId,
      counts: {
        rollbackLedger: 3,
        observations: 1,
        assets: 2,
        ledgerObservations: 1,
        ledgerAssets: 2,
      },
      drift: {
        observationsWithoutLedger: 0,
        ledgerObservationsWithoutRows: 0,
        assetsWithoutLedger: 0,
        ledgerAssetsWithoutRows: 0,
      },
      invariants: {
        expectedObservationCount: true,
        expectedAssetCount: true,
        expectedRollbackLedgerCount: true,
        observationLedgerAligned: true,
        assetLedgerAligned: true,
        mutationPerformed: false,
        productionTrafficAffected: false,
      },
    });
  });
});
