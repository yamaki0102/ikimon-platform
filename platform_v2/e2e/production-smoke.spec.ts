import { test, expect } from "@playwright/test";

const pages = [
  { path: "/", marker: /ikimon/i },
  { path: "/explore", marker: /地域のいのちを見る|Explore/i },
  { path: "/learn", marker: /ikimon|Learn/i },
  { path: "/contact", marker: /送信|Contact/i },
];

const publicSurfacePages = ["/", "/notes", "/explore", "/map"];
const fixtureLeakPattern = /e2e_test_|prod-media-smoke|smoke_regression_fixture|regression fixture|staging regression|fixture_prefix/i;

async function thumbUrlsOnPage(page: import("@playwright/test").Page): Promise<string[]> {
  return page.locator("img").evaluateAll((imgs) => {
    return Array.from(new Set(imgs
      .map((img) => (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || img.getAttribute("src") || "")
      .filter((src) => src.includes("/thumb/"))));
  });
}

test.describe("production candidate smoke", () => {
  for (const pageSpec of pages) {
    test(`${pageSpec.path} renders`, async ({ page }) => {
      const response = await page.goto(pageSpec.path, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${pageSpec.path} status`).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();
      await expect(page.locator("body")).toContainText(pageSpec.marker);
    });
  }

  test("/map renders map shell", async ({ page }) => {
    const response = await page.goto("/map", { waitUntil: "domcontentloaded" });
    expect(response?.status(), "/map status").toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("#map-explorer")).toBeVisible();
  });

  test("public surfaces do not leak fixtures or 1x1 placeholder thumbnails", async ({ page, request }) => {
    const checkedThumbs = new Set<string>();
    for (const path of publicSurfacePages) {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${path} status`).toBeLessThan(500);
      const html = await page.content();
      expect(html, `${path} leaked fixture marker`).not.toMatch(fixtureLeakPattern);

      for (const src of await thumbUrlsOnPage(page)) {
        const url = new URL(src, page.url()).toString();
        if (checkedThumbs.has(url)) continue;
        checkedThumbs.add(url);
        const imageResponse = await request.get(url);
        expect(imageResponse.status(), `${url} status`).toBeLessThan(400);
        expect(imageResponse.headers()["content-type"] ?? "", `${url} content-type`).toMatch(/^image\//);
        const body = await imageResponse.body();
        expect(body.length, `${url} should not be a 1x1 / placeholder asset`).toBeGreaterThan(512);
      }
    }
    expect(checkedThumbs.size, "public smoke should inspect at least one public thumbnail").toBeGreaterThan(0);
  });
});
