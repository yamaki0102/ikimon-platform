import { test, expect, type Route } from "@playwright/test";

const STAGING_BASE_URL = process.env.STAGING_BASE_URL ?? "https://staging.ikimon.life";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const fixtureImage = {
  name: "zukan-preview-draft-recovery.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQoAHxcCAgCXa7QJAAAAAElFTkSuQmCC",
    "base64",
  ),
};

async function blockWritesAndSession(route: Route): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method().toUpperCase();
  if (url.pathname === "/api/v1/session") {
    await route.abort("internetdisconnected");
    return;
  }
  if (SAFE_METHODS.has(method)) {
    await route.continue();
    return;
  }
  await route.abort("blockedbyclient");
}

test.describe("ZUKAN preview draft reload recovery", () => {
  test("restores a guest photo after reload and does not resurrect an explicitly removed draft", async ({ page }) => {
    await page.route("**/*", blockWritesAndSession);
    await page.goto(new URL("/?lang=ja", STAGING_BASE_URL).toString(), { waitUntil: "domcontentloaded" });

    await page.locator('[data-global-record-trigger="photo"]').click();
    await page.locator('[data-global-record-input="gallery"]').setInputFiles(fixtureImage);

    const sheet = page.locator("[data-global-record-camera-sheet]");
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute("data-photo-draft", "true");
    await expect(page.locator("[data-global-record-photo-tray]")).toBeVisible();

    const markerBeforeReload = await expect.poll(async () => {
      return page.evaluate(() => {
        const state = history.state && typeof history.state === "object" ? history.state as Record<string, unknown> : {};
        const marker = state.ikimonRecordPreviewDraftV1;
        return marker && typeof marker === "object" ? marker as Record<string, unknown> : null;
      });
    }).not.toBeNull();
    void markerBeforeReload;

    const markerSnapshot = await page.evaluate(() => {
      const state = history.state && typeof history.state === "object" ? history.state as Record<string, unknown> : {};
      return state.ikimonRecordPreviewDraftV1 as Record<string, unknown> | undefined;
    });
    expect(markerSnapshot).toBeTruthy();
    expect(Object.keys(markerSnapshot ?? {}).sort()).toEqual(["continuationToken", "draftKey", "ownerKey", "savedAt"].sort());
    expect(JSON.stringify(markerSnapshot)).not.toMatch(/base64|filename|latitude|longitude|metadata/u);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute("data-photo-draft", "true");
    await expect(page.locator("[data-global-record-photo-tray]")).toBeVisible();
    await expect(page.locator("[data-global-record-camera-status]")).toContainText("端末に残っていた写真を復元しました");

    const restoredMarker = await page.evaluate(() => {
      const state = history.state && typeof history.state === "object" ? history.state as Record<string, unknown> : {};
      return state.ikimonRecordPreviewDraftV1 as Record<string, unknown> | undefined;
    });
    expect(restoredMarker?.draftKey).toBe(markerSnapshot?.draftKey);
    expect(restoredMarker?.ownerKey).toBe(markerSnapshot?.ownerKey);
    expect(restoredMarker?.continuationToken).toBe(markerSnapshot?.continuationToken);

    const removeButton = page.locator("[data-global-record-photo-remove]").first();
    await expect(removeButton).toBeVisible();
    await removeButton.click();
    await expect(sheet).toHaveAttribute("data-photo-draft", "false");
    await expect.poll(async () => {
      return page.evaluate(() => {
        const state = history.state && typeof history.state === "object" ? history.state as Record<string, unknown> : {};
        return state.ikimonRecordPreviewDraftV1 ?? null;
      });
    }).toBeNull();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-global-record-camera-sheet]")).toBeHidden();
  });
});
