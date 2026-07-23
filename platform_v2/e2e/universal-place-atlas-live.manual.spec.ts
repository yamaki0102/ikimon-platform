import {
  chromium,
  expect,
  firefox,
  test,
  webkit,
  type BrowserType,
  type Page,
} from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const EXPECTED_SHA = process.env.PLACE_ATLAS_EXPECTED_SHA ?? "";
if (!/^[0-9a-f]{40}$/.test(EXPECTED_SHA)) {
  throw new Error(
    "PLACE_ATLAS_EXPECTED_SHA must be the exact 40-character staging SHA",
  );
}
const BASE_URL = process.env.STAGING_BASE_URL ?? "https://staging.ikimon.life";
const EVIDENCE_DIR = path.resolve(
  process.cwd(),
  `../docs/spec/universal-place-atlas/evidence/staging-${EXPECTED_SHA.slice(0, 12)}`,
);

type BrowserCase = {
  engine: "chromium" | "webkit" | "firefox";
  browserType: BrowserType;
  width: number;
  height: number;
  query: string;
  expectedName: string;
  expectedKind: string;
  expectedLocality: string;
  restricted: boolean;
};

const cases: BrowserCase[] = [
  {
    engine: "chromium",
    browserType: chromium,
    width: 375,
    height: 667,
    query: "常盤公園",
    expectedName: "常磐公園",
    expectedKind: "公園",
    expectedLocality: "静岡県静岡市葵区",
    restricted: false,
  },
  {
    engine: "chromium",
    browserType: chromium,
    width: 390,
    height: 844,
    query: "ジャングリア",
    expectedName: "JUNGLIA OKINAWA",
    expectedKind: "テーマパーク",
    expectedLocality: "沖縄県国頭郡今帰仁村",
    restricted: true,
  },
  {
    engine: "chromium",
    browserType: chromium,
    width: 768,
    height: 1024,
    query: "イオンモール浜松市野",
    expectedName: "イオンモール浜松市野",
    expectedKind: "ショッピングモール",
    expectedLocality: "静岡県浜松市中央区",
    restricted: false,
  },
  {
    engine: "chromium",
    browserType: chromium,
    width: 1024,
    height: 768,
    query: "常磐公園",
    expectedName: "常磐公園",
    expectedKind: "公園",
    expectedLocality: "静岡県静岡市葵区",
    restricted: false,
  },
  {
    engine: "chromium",
    browserType: chromium,
    width: 1280,
    height: 800,
    query: "JUNGLIA OKINAWA",
    expectedName: "JUNGLIA OKINAWA",
    expectedKind: "テーマパーク",
    expectedLocality: "沖縄県国頭郡今帰仁村",
    restricted: true,
  },
  {
    engine: "chromium",
    browserType: chromium,
    width: 1536,
    height: 960,
    query: "イオンモール浜松志都呂",
    expectedName: "イオンモール浜松志都呂",
    expectedKind: "ショッピングモール",
    expectedLocality: "静岡県浜松市中央区",
    restricted: false,
  },
  {
    engine: "webkit",
    browserType: webkit,
    width: 390,
    height: 844,
    query: "ジャングリア沖縄",
    expectedName: "JUNGLIA OKINAWA",
    expectedKind: "テーマパーク",
    expectedLocality: "沖縄県国頭郡今帰仁村",
    restricted: true,
  },
  {
    engine: "webkit",
    browserType: webkit,
    width: 1280,
    height: 800,
    query: "常盤公園",
    expectedName: "常磐公園",
    expectedKind: "公園",
    expectedLocality: "静岡県静岡市葵区",
    restricted: false,
  },
  {
    engine: "firefox",
    browserType: firefox,
    width: 390,
    height: 844,
    query: "常磐公園",
    expectedName: "常磐公園",
    expectedKind: "公園",
    expectedLocality: "静岡県静岡市葵区",
    restricted: false,
  },
  {
    engine: "firefox",
    browserType: firefox,
    width: 1280,
    height: 800,
    query: "イオンモール",
    expectedName: "イオンモール浜松市野",
    expectedKind: "ショッピングモール",
    expectedLocality: "静岡県浜松市中央区",
    restricted: false,
  },
];

function collectDiagnostics(page: Page) {
  const diagnostics = {
    pageErrors: [] as string[],
    consoleErrors: [] as string[],
    criticalResponses: [] as string[],
  };
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (
      /Failed to load resource|ERR_ABORTED|blockedbyclient|favicon|source map/i.test(
        text,
      )
    ) return;
    diagnostics.consoleErrors.push(text);
  });
  page.on("response", (response) => {
    if (response.status() < 500) return;
    if (!/\/api\/v1\/map\//.test(response.url())) return;
    diagnostics.criticalResponses.push(
      `${response.status()} ${new URL(response.url()).pathname}`,
    );
  });
  return diagnostics;
}

test.describe.configure({ mode: "serial", retries: 0, timeout: 120_000 });

test.beforeAll(async ({ request }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const runtime = await request.get(
    `${BASE_URL}/api/v1/runtime/version`,
  );
  expect(runtime.status()).toBe(200);
  const payload = await runtime.json() as { gitSha?: string };
  expect(payload.gitSha).toBe(EXPECTED_SHA);
});

const results: Array<Record<string, unknown>> = [];

for (const browserCase of cases) {
  test(
    `${browserCase.engine} ${browserCase.width}px resolves ${browserCase.query}`,
    async () => {
      const browser = await browserCase.browserType.launch({ headless: true });
      const context = await browser.newContext({
        baseURL: BASE_URL,
        viewport: {
          width: browserCase.width,
          height: browserCase.height,
        },
        locale: "ja-JP",
        reducedMotion: "reduce",
        serviceWorkers: "block",
      });
      const page = await context.newPage();
      const diagnostics = collectDiagnostics(page);
      const startedAt = Date.now();
      try {
        const response = await page.goto(
          "/ja/map?tab=places&lng=138.3805&lat=34.9702&z=16.4",
          { waitUntil: "domcontentloaded" },
        );
        expect(response?.status()).toBeLessThan(500);

        const input = page.locator("#me-search-input");
        await expect(input).toBeVisible();
        await input.fill(browserCase.query);

        const result = page.locator("#me-search-results .me-search-row", {
          hasText: browserCase.expectedName,
        }).first();
        await expect(result).toBeVisible({ timeout: 30_000 });
        await expect(result).toContainText(browserCase.expectedKind);
        await expect(result).toContainText(browserCase.expectedLocality);
        await expect(result).toContainText("確認済み");

        if (
          browserCase.engine === "chromium" &&
          browserCase.width === 390
        ) {
          await page.screenshot({
            animations: "disabled",
            fullPage: true,
            path: path.join(
              EVIDENCE_DIR,
              "chromium-390-junglia-search.png",
            ),
          });
        }

        await result.click();
        const profile = page.locator("[data-place-atlas-profile]");
        await expect(profile).toBeVisible({ timeout: 30_000 });
        await expect(
          profile.getByRole("heading", { name: browserCase.expectedName }),
        ).toBeVisible();
        await expect(profile).toContainText(browserCase.expectedKind);

        if (browserCase.restricted) {
          await expect(
            profile.locator(
              '[data-kpi-action="map:place_atlas:record_here"]',
            ),
          ).toHaveCount(0);
          await expect(profile).toContainText("許可");
          await expect(
            profile.getByRole("link", { name: /公式/ }),
          ).toHaveAttribute("href", "https://junglia.jp/terms/park-termsofuse");
        }

        const layout = await page.evaluate(() => ({
          innerWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          focusedTag: document.activeElement?.tagName ?? null,
        }));
        expect(layout.documentWidth).toBeLessThanOrEqual(layout.innerWidth);
        expect(layout.bodyWidth).toBeLessThanOrEqual(layout.innerWidth);

        await page.screenshot({
          animations: "disabled",
          fullPage: true,
          path: path.join(
            EVIDENCE_DIR,
            `${browserCase.engine}-${browserCase.width}-${browserCase.expectedName.replaceAll(/\s+/g, "-")}.png`,
          ),
        });
        expect(diagnostics).toEqual({
          pageErrors: [],
          consoleErrors: [],
          criticalResponses: [],
        });
        results.push({
          engine: browserCase.engine,
          viewport: `${browserCase.width}x${browserCase.height}`,
          query: browserCase.query,
          canonicalName: browserCase.expectedName,
          restrictedCtaSuppressed: browserCase.restricted,
          horizontalOverflow: false,
          durationMs: Date.now() - startedAt,
          diagnostics,
          status: "passed",
        });
      } finally {
        await context.close();
        await browser.close();
      }
    },
  );
}

test.afterAll(async () => {
  await writeFile(
    path.join(EVIDENCE_DIR, "browser-qa-results.json"),
    `${JSON.stringify({
      schema: "ikimon.universal-place-atlas-browser-qa/v1",
      baseUrl: BASE_URL,
      expectedSha: EXPECTED_SHA,
      generatedAt: new Date().toISOString(),
      physicalDevices: {
        android: "not_available",
        ios: "not_available",
      },
      results,
    }, null, 2)}\n`,
    "utf8",
  );
});
