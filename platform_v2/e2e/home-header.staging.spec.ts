import { test, expect, type Locator } from "@playwright/test";
import { MAP_VIEWPORTS, newStagingContext } from "./support/staging.js";

async function requiredBox(name: string, locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, `${name} should have a bounding box`).not.toBeNull();
  return box!;
}

for (const profile of MAP_VIEWPORTS.filter((candidate) => !candidate.isMobile)) {
  test(`home header stays single-row on desktop (${profile.slug})`, async ({ browser }) => {
    const context = await newStagingContext(browser, profile);
    const page = await context.newPage();

    await page.goto("/?lang=ja", { waitUntil: "domcontentloaded" });

    const header = page.locator(".site-header-inner");
    const brand = page.locator(".brand").first();
    const nav = page.locator(".site-nav-desktop");
    const utility = page.locator(".site-header-utility-desktop");

    await expect(header).toBeVisible();
    await expect(nav).toBeVisible();
    await expect(utility).toBeVisible();

    const headerBox = await requiredBox("header", header);
    const brandBox = await requiredBox("brand", brand);
    const navBox = await requiredBox("desktop nav", nav);
    const utilityBox = await requiredBox("desktop utility", utility);

    const brandCenterY = brandBox.y + brandBox.height / 2;
    const navCenterY = navBox.y + navBox.height / 2;
    const utilityCenterY = utilityBox.y + utilityBox.height / 2;

    expect(headerBox.height).toBeLessThan(92);
    expect(Math.abs(brandCenterY - navCenterY)).toBeLessThan(8);
    expect(Math.abs(navCenterY - utilityCenterY)).toBeLessThan(8);
    expect(utilityBox.x).toBeGreaterThan(navBox.x);

    await context.close();
  });
}
