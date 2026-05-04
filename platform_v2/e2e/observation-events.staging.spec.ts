import { test, expect } from "@playwright/test";
import { newStagingContext } from "./support/staging.js";

/**
 * 観察会機能の E2E:
 *   1. /community/events で 200 + ヒーロー表示
 *   2. 存在しない event_code → 404 ページ表示
 *   3. 存在しない sessionId → 404 ページ表示
 *   4. SSE 経由で live event をトリガし、フィードに反映されるか
 *      (Stage に観察会 fixture を仕込めない場合、既存 cookie + DB 接続前提でスキップ)
 */

test("observation event list page renders hero", async ({ browser }) => {
  const context = await newStagingContext(browser, { slug: "desktop-1280", viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  try {
    const resp = await page.goto("/community/events", { waitUntil: "networkidle" });
    expect(resp?.status()).toBe(200);
    await expect(page.locator(".evt-hero")).toBeVisible();
    await expect(page.locator(".evt-hero h1")).toContainText("小さな発見");
  } finally {
    await context.close();
  }
});

test("invalid event code returns 404 with html", async ({ browser }) => {
  const context = await newStagingContext(browser, { slug: "desktop-1280", viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  try {
    const resp = await page.goto("/community/events/__invalid__/join", { waitUntil: "networkidle" });
    expect(resp?.status()).toBe(404);
    await expect(page.locator(".evt-recap-shell")).toBeVisible();
    await expect(page.locator(".evt-heading")).toContainText("見つかりません");
  } finally {
    await context.close();
  }
});

test("invalid session id returns 404 on live page", async ({ browser }) => {
  const context = await newStagingContext(browser, { slug: "desktop-1280", viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  try {
    const resp = await page.goto("/events/00000000-0000-0000-0000-000000000000/live", { waitUntil: "networkidle" });
    expect(resp?.status()).toBe(404);
    await expect(page.locator(".evt-heading")).toContainText("見つかりません");
  } finally {
    await context.close();
  }
});

/**
 * SSE → 投稿 → ファンファーレ:
 *   ステージング DB に1セッション "evt-e2e-smoke" が存在する前提でのみ動く。
 *   存在しない場合は test.skip() する。
 *
 *   有効化するには:
 *     INSERT INTO observation_event_sessions
 *       (event_code, organizer_user_id, started_at, title, target_species, primary_mode, location_lat, location_lng)
 *     VALUES ('EVTE2E', 'staging-organizer', NOW(), 'E2E smoke', ARRAY['Test target'], 'discovery', 35.681, 139.767);
 */
test("SSE delivers observation_added event to live feed", async ({ browser }) => {
  const stagingBaseEnv = process.env.STAGING_BASE_URL ?? process.env.PLAYWRIGHT_STAGING_BASE_URL;
  if (!stagingBaseEnv) {
    test.skip(true, "STAGING_BASE_URL not configured");
  }
  const context = await newStagingContext(browser, { slug: "desktop-1280", viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  try {
    const probe = await page.request.get("/api/v1/observation-events/by-code/EVTE2E");
    if (probe.status() !== 200) {
      test.skip(true, "EVTE2E session not seeded in staging DB");
    }
    const session = await probe.json();
    const sessionId: string = session.session.session_id ?? session.session.sessionId;
    expect(typeof sessionId).toBe("string");

    await page.goto(`/events/${sessionId}/live`, { waitUntil: "networkidle" });
    await expect(page.locator(".evt-live-shell")).toBeVisible();

    // appendLiveEvent を直接 trigger するエンドポイントは無いので、announce で代替確認。
    const announceResp = await page.request.post(`/api/v1/observation-events/${sessionId}/announce`, {
      data: { message: "E2E ping" },
    });
    if (announceResp.status() !== 200) {
      test.skip(true, "announce requires organizer auth — seed organizer cookie before running");
    }

    await expect(page.locator("[data-evt-feed]")).toContainText("E2E ping", { timeout: 5_000 });
  } finally {
    await context.close();
  }
});
