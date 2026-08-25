import { test, expect, type Page, type Route } from "@playwright/test";

const STAGING_BASE_URL = process.env.STAGING_BASE_URL ?? "https://staging.zukan.earth";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type SessionMode = { kind: "offline" } | { kind: "user"; userId: string };

const fixtureImage = {
  name: "zukan-preview-draft-recovery.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQoAHxcCAgCXa7QJAAAAAElFTkSuQmCC",
    "base64",
  ),
};

async function handleFixtureRoute(route: Route, sessionMode: SessionMode): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method().toUpperCase();
  if (url.pathname === "/api/v1/session") {
    if (sessionMode.kind === "offline") {
      await route.abort("internetdisconnected");
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ ok: true, session: { userId: sessionMode.userId } }),
    });
    return;
  }
  if (SAFE_METHODS.has(method)) {
    await route.continue();
    return;
  }
  await route.abort("blockedbyclient");
}

async function openGalleryDraft(page: Page): Promise<void> {
  await page.locator('[data-global-record-trigger="photo"]').click();
  await page.locator('[data-global-record-input="gallery"]').setInputFiles(fixtureImage);
  const sheet = page.locator("[data-global-record-camera-sheet]");
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("data-photo-draft", "true");
  await expect(page.locator("[data-global-record-photo-tray]")).toBeVisible();
}

async function readMarker(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    const state = history.state && typeof history.state === "object" ? history.state as Record<string, unknown> : {};
    const marker = state.ikimonRecordPreviewDraftV1;
    return marker && typeof marker === "object" ? marker as Record<string, unknown> : null;
  });
}

test.describe("ZUKAN preview draft reload recovery", () => {
  test("restores a guest photo after reload and does not resurrect an explicitly removed draft", async ({ page }) => {
    const sessionMode: SessionMode = { kind: "offline" };
    await page.route("**/*", (route) => handleFixtureRoute(route, sessionMode));
    await page.goto(new URL("/?lang=ja", STAGING_BASE_URL).toString(), { waitUntil: "domcontentloaded" });
    await openGalleryDraft(page);

    await expect.poll(() => readMarker(page)).not.toBeNull();
    const markerSnapshot = await readMarker(page);
    expect(markerSnapshot).toBeTruthy();
    expect(Object.keys(markerSnapshot ?? {}).sort()).toEqual(["continuationToken", "draftKey", "ownerKey", "savedAt"].sort());
    expect(JSON.stringify(markerSnapshot)).not.toMatch(/base64|filename|latitude|longitude|metadata/u);

    const sheet = page.locator("[data-global-record-camera-sheet]");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute("data-photo-draft", "true");
    await expect(page.locator("[data-global-record-photo-tray]")).toBeVisible();
    await expect(page.locator("[data-global-record-camera-status]")).toContainText("端末に残っていた写真を復元しました");

    const restoredMarker = await readMarker(page);
    expect(restoredMarker?.draftKey).toBe(markerSnapshot?.draftKey);
    expect(restoredMarker?.ownerKey).toBe(markerSnapshot?.ownerKey);
    expect(restoredMarker?.continuationToken).toBe(markerSnapshot?.continuationToken);

    const removeButton = page.locator("[data-global-record-photo-remove]").first();
    await expect(removeButton).toBeVisible();
    await removeButton.click();
    await expect(sheet).toHaveAttribute("data-photo-draft", "false");
    await expect.poll(() => readMarker(page)).toBeNull();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-global-record-camera-sheet]")).toBeHidden();
  });

  test("signed-in draft fails closed while session is unavailable and restores after reconnect", async ({ page }) => {
    let sessionMode: SessionMode = { kind: "user", userId: "fixture-user-a" };
    await page.route("**/*", (route) => handleFixtureRoute(route, sessionMode));
    await page.goto(new URL("/?lang=ja", STAGING_BASE_URL).toString(), { waitUntil: "domcontentloaded" });
    await openGalleryDraft(page);

    await expect.poll(() => readMarker(page)).toMatchObject({ ownerKey: "user:fixture-user-a" });
    const markerSnapshot = await readMarker(page);

    sessionMode = { kind: "offline" };
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-global-record-camera-sheet]")).toBeHidden();
    expect((await readMarker(page))?.draftKey).toBe(markerSnapshot?.draftKey);

    sessionMode = { kind: "user", userId: "fixture-user-a" };
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.locator("[data-global-record-camera-sheet]")).toBeVisible();
    await expect(page.locator("[data-global-record-camera-status]")).toContainText("端末に残っていた写真を復元しました");
    expect((await readMarker(page))?.ownerKey).toBe("user:fixture-user-a");
  });

  test("draft from a different signed-in owner is never restored", async ({ page }) => {
    let sessionMode: SessionMode = { kind: "user", userId: "fixture-user-a" };
    await page.route("**/*", (route) => handleFixtureRoute(route, sessionMode));
    await page.goto(new URL("/?lang=ja", STAGING_BASE_URL).toString(), { waitUntil: "domcontentloaded" });
    await openGalleryDraft(page);
    await expect.poll(() => readMarker(page)).toMatchObject({ ownerKey: "user:fixture-user-a" });

    sessionMode = { kind: "user", userId: "fixture-user-b" };
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-global-record-camera-sheet]")).toBeHidden();
    await expect.poll(() => readMarker(page)).toBeNull();
  });
});
