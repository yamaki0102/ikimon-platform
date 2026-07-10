import { test, expect } from "@playwright/test";
import {
  addSessionCookie,
  cleanupFixtures,
  createStagingApiContext,
  issueSessionCookie,
  newStagingContext,
  requireEnv,
  seedRegressionFixtures,
  uniqueFixturePrefix,
} from "./support/staging.js";

test("identification workbench saves selected reference to the detail history", async ({ browser, playwright }) => {
  const writeKey = requireEnv("V2_PRIVILEGED_WRITE_API_KEY");
  const api = await createStagingApiContext(playwright);
  const fixturePrefix = uniqueFixturePrefix("id-workbench");
  const fixture = await seedRegressionFixtures(api, writeKey, fixturePrefix);
  const rawCookie = await issueSessionCookie(api, writeKey, fixture.user.userId);
  const context = await newStagingContext(browser, {
    slug: "identification-workbench-desktop",
    viewport: { width: 1280, height: 860 },
  });
  await addSessionCookie(context, rawCookie);
  const page = await context.newPage();

  try {
    await page.goto("/records?view=needs_id&lang=ja", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-records-identify-workbench]")).toBeVisible();

    const card = page.locator("[data-records-identify-card]", { hasText: fixture.scene.subjectLabel }).first();
    await expect(card).toBeVisible();
    await card.locator(".records-post-card-link").click();

    const referenceOption = page.locator(".records-identify-reference-option", { hasText: fixture.reference.title }).first();
    await expect(referenceOption).toBeVisible();
    await expect(referenceOption.locator('input[name="referenceSourceIds"]')).not.toBeChecked();
    await referenceOption.locator('input[name="referenceSourceIds"]').check();
    await page.locator("[data-identify-panel-reference-locator]").fill(fixture.reference.locator);
    await page.locator('[data-identify-panel-action="support"]').click();
    await expect(page.locator("[data-identify-panel-status]")).toContainText("保存しました");

    await page.goto(
      `/observations/${encodeURIComponent(fixture.scene.visitId)}?subject=${encodeURIComponent(fixture.scene.occurrenceId)}&lang=ja`,
      { waitUntil: "domcontentloaded" },
    );
    const idHistory = page.locator(".obs-id-list").first();
    await expect(idHistory).toContainText(fixture.scene.subjectLabel);
    await expect(idHistory).toContainText(fixture.reference.title);
    await expect(idHistory).toContainText(fixture.reference.locator);
  } finally {
    await context.close();
    await cleanupFixtures(api, writeKey, fixturePrefix);
    await api.dispose();
  }
});
