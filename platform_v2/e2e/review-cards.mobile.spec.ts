import { expect, test, type Page } from "@playwright/test";
import { OBSERVATION_CARD_STYLES, renderObservationCard } from "../src/ui/observationCard.js";

const baseObservation = {
  occurrenceId: "occ-review-card",
  visitId: "visit-review-card",
  displayName: null,
  vernacularName: null,
  scientificName: null,
  aiCandidateName: "モンシロチョウ",
  isAiCandidate: true,
  observedAt: "2026-10-29T09:00:00.000Z",
  observerName: "観察者",
  placeName: "確認用の場所",
  municipality: "浜松市",
  publicLocation: { label: "浜松市", scope: "municipality" as const },
  identificationCount: 0,
  latitude: 34.7,
  longitude: 137.7,
  observerUserId: null,
  observerAvatarUrl: null,
  entryType: "observation" as const,
};

const imageSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><rect width="240" height="180" fill="#15803d"/><circle cx="120" cy="90" r="48" fill="#fef08a"/></svg>`;

function documentFor(cards: string): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:clip}body{padding:8px;background:#f8fafc}.cards{display:grid;gap:12px;max-width:960px;margin:auto}.desktop-row{display:grid;grid-template-columns:320px 320px;gap:24px}${OBSERVATION_CARD_STYLES}</style></head><body>${cards}</body></html>`;
}

async function installFixture(page: Page, body: string): Promise<void> {
  await page.route("https://cards.test/present-thumb.jpg", (route) => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: imageSvg,
  }));
  await page.route("https://cards.test/failed-thumb.jpg", (route) => route.fulfill({
    status: 404,
    contentType: "text/plain",
    body: "not found",
  }));
  await page.route("https://cards.test/fixture", (route) => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: documentFor(body),
  }));
  await page.goto("https://cards.test/fixture");
}

function compactCard(id: string, photoUrl: string | null): string {
  return `<div id="${id}">${renderObservationCard("", "ja", {
    ...baseObservation,
    occurrenceId: `occ-${id}`,
    visitId: `visit-${id}`,
    photoUrl,
  }, { compact: true, locationMode: "public" })}</div>`;
}

for (const width of [360, 393, 412]) {
  test(`compact media states keep mobile geometry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installFixture(page, `<main class="cards">${compactCard("present", "https://cards.test/present-thumb.jpg")}${compactCard("missing", null)}${compactCard("failed", "https://cards.test/failed-thumb.jpg")}</main>`);

    const presentImage = page.locator("#present img.obs-card-photo");
    await expect.poll(() => presentImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator("#present .obs-card-photo-fallback")).toBeHidden();
    await expect(page.locator("#missing .obs-card-photo.is-sketch")).toBeVisible();
    await expect(page.locator("#failed .obs-card-photo-fallback")).toBeVisible();
    await expect(page.locator("#failed img.obs-card-photo")).toBeHidden();

    for (const state of ["present", "missing", "failed"]) {
      const mediaBox = await page.locator(`#${state} .obs-card-media`).boundingBox();
      const visualBox = await page.locator(`#${state} .obs-card-photo:visible`).boundingBox();
      expect(mediaBox).toMatchObject({ width: 112, height: 112 });
      expect(visualBox).toMatchObject({ width: 112, height: 112 });
      await expect(page.locator(`#${state} .obs-card-species-ai-badge`)).toHaveText("AI候補");
      await expect(page.locator(`#${state} .obs-card-species-ai-badge`)).toHaveAttribute("aria-label", "AI候補");
      const target = await page.locator(`#${state} .obs-card-actions a`).boundingBox();
      expect(target?.height).toBeGreaterThanOrEqual(44);
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
  });
}

test("desktop compact and noncompact media ratios remain distinct and unchanged", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const compact = compactCard("desktop-compact", "https://cards.test/present-thumb.jpg");
  const regular = `<div id="desktop-regular">${renderObservationCard("", "ja", { ...baseObservation, photoUrl: "https://cards.test/present-thumb.jpg" }, { compact: false })}</div>`;
  await installFixture(page, `<main class="desktop-row">${compact}${regular}</main>`);

  const compactBox = await page.locator("#desktop-compact .obs-card-media").boundingBox();
  const regularBox = await page.locator("#desktop-regular .obs-card-media").boundingBox();
  // Each 320px grid cell contains a card with 1px borders on both sides.
  expect(compactBox?.width).toBe(318);
  expect(compactBox?.height).toBe(238.5);
  expect(regularBox?.width).toBe(318);
  expect(regularBox?.height).toBe(318);
  await expect(page.locator(".obs-card-species-ai-badge")).toHaveCount(2);
});
