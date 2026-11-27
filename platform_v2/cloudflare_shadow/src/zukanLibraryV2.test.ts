import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "./index";
import type { Env } from "./core/env";
import { SESSION_COOKIE_NAME } from "./core/shared";
import * as libraryV2Flag from "./flags/LIBRARY_V2_ENABLED";
import { PROTOTYPE_FLAGS } from "./flags/index.generated";
import {
  groupObservationsIntoVisitsV2,
  renderLibraryV2Page,
  renderLibraryV2VisitDetailPage,
  type LibraryV2ObservationInput,
} from "./zukanLibraryV2";

function findChromiumExecutable(): string | null {
  for (const c of [
    process.env.CHROMIUM_PATH,
    "/home/nexus/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ]) {
    if (c && existsSync(c)) return c;
  }
  return null;
}

test("LIBRARY_V2_ENABLED is default off in staging and production", () => {
  assert.equal(libraryV2Flag.flag, "LIBRARY_V2_ENABLED");
  assert.equal(libraryV2Flag.staging, false);
  assert.equal(libraryV2Flag.production, false);
  assert.equal(PROTOTYPE_FLAGS.find((f) => f.flag === "LIBRARY_V2_ENABLED")?.stagingEnabled, false);
});

test("groupObservationsIntoVisitsV2 splits by calendar day, >500m distance, and >3h time gap, and excludes audio from ZUKAN eligibility", () => {
  const inputs: LibraryV2ObservationInput[] = [
    // Visit 1: Nov 23 morning at Yokkaichi (photo + video + report + event) -> merged within 3h
    {
      observationId: "obs-1",
      observedAt: "2026-11-23T00:12:00Z", // 09:12 JST
      placeId: "place-yokkaichi",
      placeName: "四日市市少年自然の家",
      areaLabel: "四日市市",
      lat: 35.01,
      lng: 136.47,
      reportTitle: "池のまわりの観察記録",
      reportBody: "池の北側でカワセミを1羽見た。9時半ごろ、杭の上にとまって水面を見ていた。",
      mediaKind: "photo",
      photoUrl: "/derived-transform/w360/derived/o1/display.webp",
      durationMs: null,
      visibility: "public",
      zukanPublished: true,
      eventSession: { sessionId: "ev-1", title: "自然観察指導員講習会" },
    },
    {
      observationId: "obs-2",
      observedAt: "2026-11-23T01:40:00Z", // 10:40 JST (1h28m gap -> same visit)
      placeId: "place-yokkaichi",
      placeName: "四日市市少年自然の家",
      areaLabel: "四日市市",
      lat: 35.011,
      lng: 136.471,
      reportTitle: null,
      reportBody: null,
      mediaKind: "video",
      photoUrl: "/derived-transform/w360/derived/o2/display.webp",
      durationMs: 38000,
      visibility: "public",
      zukanPublished: true,
      eventSession: null,
    },
    // Visit 2: Nov 23 afternoon at same place (>3h gap -> split into separate visit!)
    {
      observationId: "obs-3",
      observedAt: "2026-11-23T06:30:00Z", // 15:30 JST (4h50m later -> new visit)
      placeId: "place-yokkaichi",
      placeName: "四日市市少年自然の家",
      areaLabel: "四日市市",
      lat: 35.01,
      lng: 136.47,
      reportTitle: null,
      reportBody: null,
      mediaKind: "audio",
      photoUrl: null,
      audioTitle: "森の風の音",
      durationMs: 42000,
      visibility: "private",
      zukanPublished: false,
      eventSession: null,
    },
    // Visit 3: Nov 23 > 500m away unnamed spot -> separate visit
    {
      observationId: "obs-4",
      observedAt: "2026-11-23T01:50:00Z", // 10:50 JST, but ~3km east of obs-2
      placeId: null,
      placeName: null,
      areaLabel: "菰野町",
      lat: 35.01,
      lng: 136.51,
      reportTitle: "川沿いの植物",
      reportBody: "ヨシの群生が広がっていた。",
      mediaKind: null,
      photoUrl: null,
      durationMs: null,
      visibility: "private",
      zukanPublished: false,
      eventSession: null,
    },
  ];

  const visits = groupObservationsIntoVisitsV2(inputs);
  assert.equal(visits.length, 3);
  const yokkaichiMorning = visits.find((v) => v.observationIds.includes("obs-1"));
  assert.ok(yokkaichiMorning);
  assert.equal(yokkaichiMorning.observationIds.includes("obs-2"), true);
  assert.equal(yokkaichiMorning.observationIds.includes("obs-3"), false); // >3h gap split
  assert.equal(yokkaichiMorning.headingTitle, "池のまわりの観察記録");
  assert.equal(yokkaichiMorning.photos.length, 1);
  assert.equal(yokkaichiMorning.videos.length, 1);
  assert.equal(yokkaichiMorning.report?.body.includes("カワセミ"), true);
  assert.equal(yokkaichiMorning.eventParticipation?.title, "自然観察指導員講習会");
  assert.deepEqual(yokkaichiMorning.zukanEligibleObservationIds, ["obs-1", "obs-2"]);

  const afternoonAudioOnly = visits.find((v) => v.observationIds.includes("obs-3"));
  assert.ok(afternoonAudioOnly);
  assert.equal(afternoonAudioOnly.audios.length, 1);
  assert.deepEqual(afternoonAudioOnly.zukanEligibleObservationIds, []); // Audio never eligible for place ZUKAN
});

test("renderLibraryV2Page and renderLibraryV2VisitDetailPage match Muse rules (no メモ, no ズカン, no list publish CTA, zero-state & add-record sheet)", () => {
  const visits = groupObservationsIntoVisitsV2([
    {
      observationId: "o-1",
      observedAt: "2026-11-23T00:12:00Z",
      placeId: "pl-1",
      placeName: "四日市市少年自然の家",
      areaLabel: "四日市市",
      lat: 35.01,
      lng: 136.47,
      reportTitle: "池のまわりの観察記録",
      reportBody: "池の北側でカワセミを1羽見た。",
      mediaKind: "photo",
      photoUrl: "/derived-transform/w360/derived/o1/display.webp",
      durationMs: null,
      visibility: "public",
      zukanPublished: true,
      eventSession: { sessionId: "ev-1", title: "自然観察指導員講習会" },
    },
    {
      observationId: "o-2",
      observedAt: "2026-11-16T07:12:00+09:00",
      placeId: "pl-2",
      placeName: "佐鳴湖",
      areaLabel: "浜松市",
      lat: 34.706,
      lng: 137.702,
      reportTitle: null,
      reportBody: null,
      mediaKind: "audio",
      photoUrl: null,
      audioTitle: "鳥の声",
      durationMs: 42000,
      visibility: "private",
      zukanPublished: false,
      eventSession: null,
    },
  ]);

  const listHtml = renderLibraryV2Page({
    visits,
    lang: "ja",
    authenticated: true,
    displayName: "まっきー",
    nextCursor: null,
  });
  assert.doesNotMatch(listHtml, /メモ/);
  assert.doesNotMatch(listHtml, /ズカン/);
  assert.doesNotMatch(listHtml, /まだ図鑑に載せていません/);
  assert.doesNotMatch(listHtml, /data-zukan-open-popover/);
  assert.match(listHtml, /池のまわりの観察記録/);
  assert.match(listHtml, /公開しています/);
  assert.match(listHtml, /図鑑に載せています/);
  assert.match(listHtml, /記録を足す/);
  assert.match(listHtml, /鳥の声/);
  assert.match(listHtml, /自然観察指導員講習会/);

  const detailHtml = renderLibraryV2VisitDetailPage(visits[0]!, {
    lang: "ja",
    displayName: "まっきー",
  });
  assert.doesNotMatch(detailHtml, /メモ|ズカン|autoplay/i);
  const reportIdx = detailHtml.indexOf("フィールドレポート");
  const photoIdx = detailHtml.indexOf("写真（");
  assert.ok(reportIdx > 0 && photoIdx > reportIdx, "field report must appear before photos in open view");
  assert.match(detailHtml, /音は出ません/);

  const zeroHtml = renderLibraryV2Page({
    visits: [],
    lang: "ja",
    authenticated: true,
    displayName: "まっきー",
    nextCursor: null,
  });
  assert.match(zeroHtml, /まだ記録がありません/);
  assert.match(zeroHtml, /写真や動画、音、フィールドレポート、どれからでも始められます/);
  assert.match(zeroHtml, /記録をはじめる/);
  assert.doesNotMatch(zeroHtml, /メモ|ズカン/);
});

test("Worker gates /ja/library and logged-in /ja/ on LIBRARY_V2_ENABLED", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role_name TEXT NOT NULL,
      rank_label TEXT,
      banned INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      last_used_at TEXT
    );
    CREATE TABLE observations (
      observation_id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      taxon_label TEXT,
      note TEXT,
      exact_lat REAL,
      exact_lng REAL,
      public_cell TEXT NOT NULL DEFAULT 'cell:34.70,137.70',
      public_area_label TEXT,
      visibility TEXT NOT NULL DEFAULT 'private',
      emergency_hidden INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE asset_ledger (
      asset_id TEXT PRIMARY KEY,
      observation_id TEXT,
      mime TEXT NOT NULL,
      duration_ms INTEGER,
      processing_state TEXT NOT NULL DEFAULT 'uploaded',
      public_derivative_key TEXT,
      public_derivative_verified_at TEXT,
      public_derivative_metadata_json TEXT,
      exif_scrub_state TEXT NOT NULL DEFAULT 'scrubbed',
      public_ready_at TEXT,
      uploaded_at TEXT
    );
    CREATE TABLE zukan_book_publications (group_key TEXT PRIMARY KEY, user_id TEXT NOT NULL, place_name TEXT, observation_ids_json TEXT, published INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL);
    CREATE TABLE zukan_observation_publications (user_id TEXT NOT NULL, observation_id TEXT NOT NULL, place_id TEXT, legacy_group_key TEXT, published INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, observation_id));
  `);
  const token = "lib-v2-session";
  const sha = createHash("sha256").update(token).digest("hex");
  const exp = new Date(Date.now() + 86_400_000).toISOString();
  sqlite.prepare("INSERT INTO auth_sessions VALUES (?,?,?,?,?,?,?,?)").run(sha, "u-lib", "ゆい", "member", null, 0, exp, null);
  sqlite.prepare("INSERT INTO observations (observation_id, owner_user_id, observed_at, taxon_label, note, public_area_label, visibility) VALUES (?,?,?,?,?,?,?)").run(
    "obs-v2-1", "u-lib", "2026-11-25T10:00:00+09:00", "カワセミ", "川のほとりでカワセミを見た。", "佐鳴湖", "private"
  );

  const db = {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) { values = args; return stmt; },
        async run() {
          if (query.trim().startsWith("CREATE TABLE")) { sqlite.exec(query); return { meta: { changes: 0 } }; }
          return { meta: { changes: Number(sqlite.prepare(query).run(...(values as never[])).changes) } };
        },
        async first<T>() { return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null; },
        async all<T>() { return { results: sqlite.prepare(query).all(...(values as never[])) as T[] }; },
      };
      return stmt;
    },
  } as unknown as Env["OBS_DB"];

  const offEnv = { ENVIRONMENT: "staging", CORE_DB: db, OBS_DB: db } as unknown as Env;
  const offRes = await worker.fetch(
    new Request("https://zukan.earth/ja/library", { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } }),
    offEnv,
  );
  assert.equal(offRes.status, 200);
  assert.equal(offRes.headers.get("x-ikimon-cloudflare-native"), null);

  const onEnv = {
    ...offEnv,
    ZUKAN_FEATURE_ROLLOUTS: JSON.stringify({ LIBRARY_V2_ENABLED: { state: "all" } }),
  } as unknown as Env;
  const onRes = await worker.fetch(
    new Request("https://zukan.earth/ja/library", { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } }),
    onEnv,
  );
  assert.equal(onRes.status, 200);
  assert.equal(onRes.headers.get("x-ikimon-cloudflare-native"), "zukan-library-v2");
  const html = await onRes.text();
  assert.match(html, /川のほとりでカワセミを見た/);
});

test("Playwright verifies library v2 list, add-record sheet, open visit, and zero state at 375px and 1280px", async (t) => {
  const executablePath = findChromiumExecutable();
  if (!executablePath) {
    t.skip("No Chromium binary available");
    return;
  }
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  t.after(() => browser.close());

  const visits = groupObservationsIntoVisitsV2([
    {
      observationId: "obs-1",
      observedAt: "2026-11-23T09:12:00+09:00",
      placeId: "pl-1",
      placeName: "四日市市少年自然の家",
      areaLabel: "四日市市",
      lat: 35.01,
      lng: 136.47,
      reportTitle: "池のまわりの観察記録",
      reportBody: "池の北側でカワセミを1羽見た。9時半ごろ、杭の上にとまって水面を見ていた。",
      mediaKind: "photo",
      photoUrl: "/thumb/kingfisher.svg",
      durationMs: null,
      visibility: "public",
      zukanPublished: true,
      eventSession: { sessionId: "ev-1", title: "自然観察指導員講習会" },
    },
  ]);

  const listHtml = renderLibraryV2Page({ visits, lang: "ja", authenticated: true, displayName: "ゆい", nextCursor: null });
  const openHtml = renderLibraryV2VisitDetailPage(visits[0]!, { lang: "ja", displayName: "ゆい" });

  for (const vp of [{ width: 375, height: 812 }, { width: 1280, height: 800 }]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.route("**/*", async (route) => {
      const u = route.request().url();
      if (u.endsWith(".svg") || u.includes("/thumb/")) {
        await route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90"><rect width="120" height="90" fill="#2e6b4c"/></svg>' });
        return;
      }
      await route.fulfill({ status: 204, body: "" });
    });
    await page.setContent(listHtml);
    const listCheck = await page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      addBtnHeight: (document.querySelector("[data-zv2l-open-add]") as HTMLElement)?.getBoundingClientRect().height ?? 0,
    }));
    assert.equal(listCheck.overflowX, 0);
    assert.ok(listCheck.addBtnHeight >= 44, `add button height ${listCheck.addBtnHeight} < 44`);

    // Open Add-Record sheet
    await page.click("[data-zv2l-open-add]");
    const sheetVisible = await page.evaluate(() => !(document.getElementById("zv2l-add-sheet") as HTMLDialogElement | null)?.hidden);
    assert.equal(sheetVisible, true);

    await page.setContent(openHtml);
    const openOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(openOverflow, 0);
    await ctx.close();
  }
});
