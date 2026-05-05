import { Buffer } from "node:buffer";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const pages = [
  { path: "/", marker: /ikimon/i },
  { path: "/explore", marker: /地域のいのちを見る|Explore/i },
  { path: "/learn", marker: /ikimon|Learn/i },
  { path: "/contact", marker: /送信|Contact/i },
];

const publicSurfacePages = ["/", "/notes", "/explore", "/map"];
const fixtureLeakPattern = /e2e_test_|prod-media-smoke|smoke-ui|smoke_regression_fixture|regression fixture|staging regression|fixture_prefix/i;
const smokePhotoBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAUAAAADwCAIAAAD+Tyo8AAAACXBIWXMAAAABAAAAAQBPJcTWAAAGdElEQVR4nO3dX3JbNRjG4SMo04sugF2zANbAHcuDVoxjMhP6h6bx0ZFefc/TXART7ETyL5/sDHY7JumTbrd944b7t/7FWbd7zNH7nFu+4Fb717Zs8DYud39+N+l21zK6XkZo/fan+NpWD9g9IFp7Ol9U3sTSAVfe+J20wqO4aMBl93tXreoorhhwwW2ulHE/KqkVcOuznpTlIr3dNrj1KhkXCrjOptJbK7LdVQIusp1Ua3j/gCvsImWP05sHvPfm8Rp7j+KdA9542/ghfd+G9wx4193izfqmx+kNA95vkzhL324U7xbwZtvD6fpeDW8V8E4bwzh9o4b3CXibLeECfZeGNwl4j83gSn2LhncIeINtYIqe33B8wOkbwFw9vOHsgKOXnkX05IaDA85ddFbTYxtODTh0uVlWz2w4MuDEhWZ9PbDhvIDjlpggPa3hsICzFpdEParhpICDlpVoPafhmIBTFpQ99JCGMwKOWEo20xMaDgh4/UVkV335hlcPePHlY3t97YaXDnjlhaOOvnDDSwcMpAa87M88CuqrDuFFA15zsaisL9nwigEvuExwLNnwigEDqQGv9hMOVh7CawW81NLA+g0vFPA6iwIpDS8UMJAa8CI/zyBrCC8R8AoLAYkNLxEwkBrw9J9hkDuEJwesXtL1qQ3Pn8BAZMDGL3vorR2ThvC0gNXLTtrtHD2hYUdoCDYn4N57m3LDsNcQNoEh2ISApzxUgC2HsAkMwa4O2Phlb+3aIWwCQ7BLAzZ+qaBdOISvC1i91NGuatgRGoJdFLDxSzXtkiFsAkMwAUOwKwJ2fqamNv4UbQJDsOEBG79U1gYPYRMYgo0N2PiFNnIIm8AQTMAQbGDAzs8w+hRtAkOwUQEbv3DBEDaBIZiAIdiQgJ2f4ZpTtAkMwQQMwc4P2PkZLjtFm8AQTMAQ7OSAnZ/hylO0CQzBBAzBzgzY+RkuPkWbwBBMwBBMwBDstIA9AIbrHwabwBBMwBBMwBBMwHBUD9gzWDDleSwTGIIJmNLai88fmoft5TVdR8AQTMBQO2DPYMGs57FMYErrL/ppDzyOPet6fpSAIZiAIZiAIZiAIZiAoXDAfocEE3+TZAJDMAFDMAFDMAFDMAFDMAFDMAFDMAFDMAFDMAFDMAFDMAFDMAFDMAFTWjvp9auufB2slwQMwQQMwQQMwQRMad3rQgOzmMAQTMAQTMAQTMAQTMAQTMAQTMAQTMAQTMAQTMAQTMAQTMAQTMBQOOAH354YiuuP5WMCQzABQzABQzABQzABU1p78XrOjzyf5HWhgRkT2G+S4G0e/xWsIzQEEzCl9Zf/MOn9jR4hYAgmYDiqB+x5LPhRp/xPBCYwBBMwBBMwBBMwBDstYM9jweud9TIYJjAEEzAEEzAEOzNgD4PhNU58HUgTGIIJGIKdHLBTNPy/c19H3QSGYAKGYOcH7BQN33L6+xCZwBBMwBBsSMBO0fClEe/jaQJDMAFDsFEBO0XD6POzCQzZBh6hDWEYOn5NYMjmSSwINjZgp2jow87PJjBkG36ENoSprI8cvyYwZLviSSxDmJr64PF7C/h2C+/++/HLgEt+a59d0h++5k/t+Pv49+Ov50++e8mf/S3/1eOXfHj+5OPTsg9b6M8vacfvp13zp3bpkr3pkvbrF5d8vOQO/rW/80d76Jqf7izf+eb9GgmCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCCRiCvWvH85sVXuv1b5zaTn2T1X77hieYdLNHP/Eb/uk43j99rPz9tpOv8JV3vzFvBPzz08f77Ancn94gfPZXQUVt+TteQMAaZoq2fL0xAWuYi7WEepMC1jCXaSH1hgWsYS7QcurNC1jDDNWi6o0MWMMM0tLqTQ1Yw5yuBdYbHLCGOVFovdkBa5ji9cYHrGEq17tDwBqmbL2bBKxhata7T8AapmC9WwWsYarVu1vAGqZUvRsGrGHq1LtnwPeGt9wt3qxtemfYM+A7L+XB3vVuHrCGObaud/+AHacra1unWyXgO8fpalqBegsFrOFSWo16awX83PDRW5XdLaiVSbdiwHet3/7M/io4X6+3sRUDvjd83+/ZXwjn6FW3smjAd0bxHnrVeqsHbBSn64XTvfsH5/7dUxum3iYAAAAASUVORK5CYII=";
const smokeVideoBase64 =
  "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";

type JsonPayload = Record<string, unknown>;

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function productionSmokeBaseUrl(): string {
  return process.env.PRODUCTION_SMOKE_BASE_URL ?? "http://127.0.0.1:13202";
}

function productionSmokePrefix(): string {
  return process.env.PRODUCTION_SMOKE_UI_PREFIX?.trim() || `smoke-ui-local-${Date.now()}`;
}

function smokePhotoFile(prefix: string) {
  return {
    name: `${prefix}-photo.png`,
    mimeType: "image/png",
    buffer: Buffer.from(smokePhotoBase64, "base64"),
  };
}

function smokeVideoFile(prefix: string) {
  return {
    name: `${prefix}-video.webm`,
    mimeType: "video/webm",
    buffer: Buffer.from(smokeVideoBase64, "base64"),
  };
}

async function jsonFromResponse(response: import("@playwright/test").Response, label: string): Promise<JsonPayload> {
  const payload = (await response.json().catch(() => null)) as JsonPayload | null;
  expect(payload, `${label} should return JSON`).toBeTruthy();
  return payload!;
}

async function registerSmokeUser(api: APIRequestContext, baseUrl: string, prefix: string): Promise<string> {
  const password = `IkimonUiSmoke${prefix.replace(/\W/g, "").slice(-16)}!`;
  const email = `${prefix}@example.invalid`;
  const response = await api.post(joinUrl(baseUrl, "/api/v1/auth/register"), {
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin: baseUrl,
    },
    data: {
      displayName: `候補UIスモーク ${prefix}`,
      email,
      password,
      redirect: "/record",
    },
  });
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  expect(response.ok(), payload?.error ?? "register_failed").toBeTruthy();
  expect(payload?.ok, payload?.error ?? "register_failed").toBeTruthy();
  return email;
}

async function fillRequiredRecordFields(page: Page, prefix: string, mediaLabel: string): Promise<void> {
  await page.locator("summary", { hasText: "座標を直接編集" }).click();
  await page.locator("input[name='latitude']").fill("34.710800");
  await page.locator("input[name='longitude']").fill("137.726100");
  await page.locator("input[name='localityNote']").fill(`${prefix} ${mediaLabel} candidate UI smoke - delete after verification`);
}

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

  test("mobile record UI saves photo and video against the production candidate", async ({ browser }) => {
    test.setTimeout(180_000);

    const baseUrl = productionSmokeBaseUrl();
    const prefix = productionSmokePrefix();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      ignoreHTTPSErrors: true,
    });

    try {
      const email = await registerSmokeUser(context.request, baseUrl, prefix);
      const page = await context.newPage();

      await page.goto(joinUrl(baseUrl, "/record?lang=ja"), { waitUntil: "domcontentloaded" });
      await expect(page.locator("#record-form")).toBeHidden();
      await page.locator("#record-media-photo").setInputFiles(smokePhotoFile(prefix));
      await expect(page.locator("#record-form")).toBeVisible();
      await fillRequiredRecordFields(page, prefix, "photo");

      const photoUpload = page.waitForResponse((response) =>
        response.url().includes("/photos/upload") && response.request().method() === "POST",
      );
      await page.locator("#record-submit-panel button[type='submit']").click();
      const photoResponse = await photoUpload;
      const photoPayload = await jsonFromResponse(photoResponse, "photo upload");
      expect(photoResponse.ok(), `photo upload HTTP status for ${email}`).toBeTruthy();
      expect(photoPayload.ok, "photo upload must keep the shared ok:true contract").toBe(true);
      await expect(page.locator("#record-status")).toContainText("記録を保存しました");
      await expect(page.locator("#record-status")).toContainText("写真1枚を同じ観察に保存しました。");

      await page.goto(joinUrl(baseUrl, "/record?lang=ja&start=video"), { waitUntil: "domcontentloaded" });
      await page.locator("#record-media-video").setInputFiles(smokeVideoFile(prefix));
      await expect(page.locator("#record-form")).toBeVisible();
      await fillRequiredRecordFields(page, prefix, "video");

      const directUpload = page.waitForResponse((response) =>
        response.url().includes("/api/v1/videos/direct-upload") && response.request().method() === "POST",
      );
      const finalizeUpload = page.waitForResponse((response) =>
        /\/api\/v1\/videos\/[^/]+\/finalize$/.test(new URL(response.url()).pathname) &&
        response.request().method() === "POST",
      );
      await page.locator("#record-submit-panel button[type='submit']").click();
      const directResponse = await directUpload;
      const directPayload = await jsonFromResponse(directResponse, "video direct upload");
      expect(directResponse.ok(), "video direct upload HTTP status").toBeTruthy();
      expect(directPayload.ok, "video direct upload should return ok:true").toBe(true);
      expect(directPayload.uid, "video direct upload should issue a stream uid").toBeTruthy();
      const finalizeResponse = await finalizeUpload;
      const finalizePayload = await jsonFromResponse(finalizeResponse, "video finalize");
      expect(finalizeResponse.ok(), "video finalize HTTP status").toBeTruthy();
      expect(finalizePayload.ok, "video finalize should return ok:true").toBe(true);
      await expect(page.locator("#record-status")).toContainText("記録を保存しました", { timeout: 30_000 });
      await expect(page.locator("#record-status")).toContainText("動画は保存済みです。");
    } finally {
      await context.close();
    }
  });
});
