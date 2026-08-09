import { test, expect, type Route } from "@playwright/test";

const STAGING_BASE_URL = process.env.STAGING_BASE_URL ?? "https://staging.zukan.earth";
const STAGING_ORIGIN = new URL(STAGING_BASE_URL).origin;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const fixtureImage = {
  name: "zukan-runtime-fixture.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZpWQAAAAASUVORK5CYII=",
    "base64",
  ),
};

type MutationCounters = {
  observationUpsert: number;
  photoUpload: number;
  photoFeedback: number;
  kpi: number;
  unknown: string[];
};

async function fulfillJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body),
  });
}

test.describe.serial("ZUKAN capture P0 fixture-only retry gate", () => {
  test("saves one Record, retries media, and succeeds without duplicate Record", async ({ page }, testInfo) => {
    const fixtureId = `zukan-runtime-${Date.now()}`;
    const visitId = `${fixtureId}-visit`;
    const occurrenceId = `occ:${visitId}:0`;
    let allowSuccessfulUpload = false;
    const counters: MutationCounters = {
      observationUpsert: 0,
      photoUpload: 0,
      photoFeedback: 0,
      kpi: 0,
      unknown: [],
    };

    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method().toUpperCase();

      if (url.hostname === "nominatim.openstreetmap.org") {
        await fulfillJson(route, 200, {
          display_name: "静岡県浜松市",
          address: { state: "静岡県", city: "浜松市" },
        });
        return;
      }

      if (url.origin !== STAGING_ORIGIN) {
        await route.abort("blockedbyclient");
        return;
      }

      if (SAFE_METHODS.has(method)) {
        await route.continue();
        return;
      }

      if (url.pathname === "/api/v1/ui-kpi/events" || url.pathname === "/api/v1/ui-kpi/events/") {
        counters.kpi += 1;
        await fulfillJson(route, 202, { ok: true });
        return;
      }

      if (url.pathname === "/api/v1/record/photo-feedback") {
        counters.photoFeedback += 1;
        await fulfillJson(route, 200, {
          ok: true,
          feedback: {
            summary: "fixture",
            nextCaptureHint: "同じ場所をもう一度撮れます",
          },
        });
        return;
      }

      if (url.pathname === "/api/v1/observations/upsert") {
        counters.observationUpsert += 1;
        await fulfillJson(route, 200, {
          ok: true,
          observationId: visitId,
          visitId,
          occurrenceId,
          detailId: visitId,
          publicState: "private",
          qualityReviewStatus: "pending",
          contributionReceipts: [],
          feedbackLoop: { status: "queued" },
        });
        return;
      }

      if (/\/api\/v1\/observations\/[^/]+\/photos\/upload$/u.test(url.pathname)) {
        counters.photoUpload += 1;
        if (!allowSuccessfulUpload) {
          await fulfillJson(route, 503, {
            ok: false,
            error: "fixture_photo_upload_temporarily_unavailable",
            retryable: true,
          });
          return;
        }
        await fulfillJson(route, 200, {
          ok: true,
          assetId: `${fixtureId}-asset`,
          mediaId: `${fixtureId}-media`,
          publicReady: false,
          facePrivacy: "no_faces",
          status: "stored",
        });
        return;
      }

      counters.unknown.push(`${method} ${url.pathname}`);
      await fulfillJson(route, 409, { ok: false, error: "fixture_unknown_mutation_rejected" });
    });

    const response = await page.goto(`/ja/record?userId=${encodeURIComponent(`${fixtureId}-user`)}&zukan_runtime_qa=1`, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status() ?? 0).toBeLessThan(400);

    const photoAction = page.locator('[data-capture-action="photo"]');
    await expect(photoAction).toBeVisible();
    await photoAction.click();

    const photoInput = page.locator("#record-media-photo");
    await expect(photoInput).toHaveAttribute("accept", /image/u);
    await photoInput.setInputFiles(fixtureImage);

    const privateVisibility = page.locator('input[name="visibility"][value="private"]');
    if (await privateVisibility.count()) {
      await privateVisibility.check({ force: true });
    }

    const submit = page.locator(".record-submit-primary");
    await expect(submit).toBeVisible();
    await submit.click();

    await expect(page.locator("#record-status")).toContainText(/記録本体は保存済みです。|送信に失敗しました。/u);
    await expect.poll(() => new URL(page.url()).searchParams.get("retry")).toBe("media");
    expect(counters.observationUpsert).toBe(1);
    expect(counters.photoUpload).toBeGreaterThan(0);
    const failedUploadAttempts = counters.photoUpload;

    allowSuccessfulUpload = true;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/record-media-retry-mode/u);
    await expect(page.locator("body")).toContainText(/残っていたメディアを同じ記録に再送できます。|この画面ではメディアだけ送ります。/u);

    const retryInput = page.locator("#record-media-photo");
    await retryInput.setInputFiles(fixtureImage);
    const retrySubmit = page.locator(".record-submit-primary");
    await expect(retrySubmit).toBeEnabled();
    await retrySubmit.click();

    await expect(page.locator("#record-status")).toContainText(/記録できました|保存しました|保存済み/u);
    await expect(page.locator("[data-record-success-cta]").first()).toBeVisible();

    expect(counters.observationUpsert, "media retry must not create a duplicate Record").toBe(1);
    expect(counters.photoUpload, "retry must add exactly one successful upload attempt").toBe(failedUploadAttempts + 1);
    expect(counters.kpi, "the capture UI should emit existing KPI events").toBeGreaterThan(0);
    expect(counters.unknown, "no non-idempotent request may reach staging or an unknown fixture").toEqual([]);

    const screenshot = await page.screenshot({ animations: "disabled", fullPage: true });
    await testInfo.attach("zukan-capture-p0-retry-success", {
      body: screenshot,
      contentType: "image/png",
    });
  });
});
