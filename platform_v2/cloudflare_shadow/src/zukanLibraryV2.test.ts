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

  assert.match(listHtml, /class="zv2l-vhead">池のまわりの観察記録<\/h3>/);
  assert.match(listHtml, /data-library-sync/);
  assert.match(listHtml, /ikimon-app-outbox-v1/);
  assert.match(listHtml, /もう一度送る/);
  assert.match(listHtml, /を送っています/);
  assert.match(listHtml, /件を送れませんでした/);
  assert.match(listHtml, /processing-status/);
  assert.match(listHtml, /\/ja\/record\?draft=1/);

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
  assert.match(zeroHtml, />記録をはじめる</);
  assert.doesNotMatch(zeroHtml, />写真を選ぶ</);
  assert.match(zeroHtml, /data-library-sync/);
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

test("library v2 chrome keeps mobile bottom nav single-line and desktop sidebar displayName single-line ellipsis", () => {
  const html = renderLibraryV2Page({ visits: [], lang: "ja", authenticated: true, displayName: "とても長い利用者表示名テスト浜松花子", nextCursor: null });
  assert.match(html, /\.zt-nav-item,\.zt-nav-item:visited\{[^}]*white-space:nowrap/u);
  assert.match(html, /\.zt-side-me>span:last-child\{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis\}/u);
  assert.doesNotMatch(html, /\.zt-side-me>span:last-child\{[^}]*overflow-wrap:anywhere/u);
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

  const listHtml = renderLibraryV2Page({ visits, lang: "ja", authenticated: true, displayName: "とても長い利用者表示名テスト浜松花子", nextCursor: null });
  const openHtml = renderLibraryV2VisitDetailPage(visits[0]!, { lang: "ja", displayName: "とても長い利用者表示名テスト浜松花子" });

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
    const listCheck = await page.evaluate(() => {
      const navItems = Array.from(document.querySelectorAll(".zt-bottom-nav .zt-nav-item"));
      const libNav = navItems.find((el) => (el.textContent ?? "").includes("ライブラリ"));
      const libSpan = libNav?.querySelector("span");
      let navLineCount = 0;
      if (libSpan) {
        const range = document.createRange();
        range.selectNodeContents(libSpan);
        navLineCount = range.getClientRects().length;
      }
      const sideName = document.querySelector(".zt-side-me > span:last-child") as HTMLElement | null;
      let sideNameLineCount = 0;
      if (sideName) {
        const range = document.createRange();
        range.selectNodeContents(sideName);
        sideNameLineCount = new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top))).size;
      }
      const sideStyle = sideName ? getComputedStyle(sideName) : null;
      return {
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        addBtnHeight: (document.querySelector("[data-zv2l-open-add]") as HTMLElement)?.getBoundingClientRect().height ?? 0,
        navLineCount,
        sideNameLineCount,
        sideNameHeight: sideName?.getBoundingClientRect().height ?? 0,
        sideWhiteSpace: sideStyle?.whiteSpace ?? "",
        sideTextOverflow: sideStyle?.textOverflow ?? "",
      };
    });
    assert.equal(listCheck.overflowX, 0);
    assert.ok(listCheck.addBtnHeight >= 44, `add button height ${listCheck.addBtnHeight} < 44`);
    if (vp.width < 960) {
      assert.equal(listCheck.navLineCount, 1, `expected mobile bottom nav ライブラリ on 1 line, got ${listCheck.navLineCount}`);
    } else {
      assert.equal(listCheck.sideNameLineCount, 1, `expected desktop sidebar user name on 1 line, got ${listCheck.sideNameLineCount}`);
      assert.ok(listCheck.sideNameHeight > 0 && listCheck.sideNameHeight <= 28, `expected 1-line height <= 28px, got ${listCheck.sideNameHeight}`);
      assert.equal(listCheck.sideWhiteSpace, "nowrap");
      assert.equal(listCheck.sideTextOverflow, "ellipsis");
    }

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

test("LIBRARY_V2 search filters by taxon/AI candidate, place name, memo, seasonal/year expressions, and renders 0-match empty search state", async (t) => {
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
    CREATE TABLE places (place_id TEXT PRIMARY KEY, canonical_name TEXT NOT NULL, public_profile_status TEXT NOT NULL DEFAULT 'published');
    CREATE TABLE civic_observation_contexts (visit_id TEXT PRIMARY KEY, field_id TEXT NOT NULL);
    CREATE TABLE observation_ai_review_targets (
      occurrence_id TEXT PRIMARY KEY,
      candidate_vernacular_name TEXT,
      candidate_scientific_name TEXT,
      ai_recommended_taxon_name TEXT
    );
    CREATE TABLE zukan_book_publications (group_key TEXT PRIMARY KEY, user_id TEXT NOT NULL, place_name TEXT, observation_ids_json TEXT, published INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL);
    CREATE TABLE zukan_observation_publications (user_id TEXT NOT NULL, observation_id TEXT NOT NULL, place_id TEXT, legacy_group_key TEXT, published INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, observation_id));
  `);
  const token = "lib-v2-search-session";
  const sha = createHash("sha256").update(token).digest("hex");
  const exp = new Date(Date.now() + 86_400_000).toISOString();
  sqlite.prepare("INSERT INTO auth_sessions VALUES (?,?,?,?,?,?,?,?)").run(sha, "u-lib", "ゆい", "member", null, 0, exp, null);

  const nowYear = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric" }).format(new Date()));
  const lastYear = nowYear - 1;

  sqlite.prepare("INSERT INTO places VALUES (?,?,?)").run("pl-renge", "蓮華寺池公園", "published");
  sqlite.prepare("INSERT INTO places VALUES (?,?,?)").run("pl-tenryu", "天竜川河川敷", "published");

  const insObs = sqlite.prepare("INSERT INTO observations (observation_id, owner_user_id, observed_at, taxon_label, note, public_area_label, visibility) VALUES (?,?,?,?,?,?,?)");
  // Record 1: Last year's autumn (Oct), memo has 祭り, linked to 蓮華寺池公園 (note: public_area_label is empty so match MUST come from places.canonical_name!), taxon_label=未同定 but AI candidate is アオサギ
  insObs.run("obs-autumn", "u-lib", `${lastYear}-10-15T10:00:00+09:00`, "未同定", "秋祭りの太鼓が遠くから聞こえた。", "", "private");
  sqlite.prepare("INSERT INTO civic_observation_contexts VALUES (?,?)").run("obs-autumn", "pl-renge");
  sqlite.prepare("INSERT INTO observation_ai_review_targets VALUES (?,?,?,?)").run("occ:obs-autumn:0", "アオサギ", "Ardea cinerea", "アオサギ");

  // Record 2: Current year's summer (Jul), river/kingfisher
  insObs.run("obs-summer", "u-lib", `${nowYear}-07-20T08:30:00+09:00`, "カワセミ", "川のほとりで青い鳥を見た。", "佐鳴湖", "private");
  sqlite.prepare("INSERT INTO civic_observation_contexts VALUES (?,?)").run("obs-summer", "pl-tenryu");

  // Record 3: Another user's record MUST never appear
  insObs.run("obs-other", "u-other", `${lastYear}-10-15T10:00:00+09:00`, "祭り", "他人の祭りの記録", "蓮華寺池公園", "public");

  const db = {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) { values = args; return stmt; },
        async run() { return { meta: { changes: Number(sqlite.prepare(query).run(...(values as never[])).changes) } }; },
        async first<T>() { return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null; },
        async all<T>() { return { results: sqlite.prepare(query).all(...(values as never[])) as T[] }; },
      };
      return stmt;
    },
  } as unknown as Env["OBS_DB"];

  const env = {
    ENVIRONMENT: "staging",
    CORE_DB: db,
    OBS_DB: db,
    ZUKAN_FEATURE_ROLLOUTS: JSON.stringify({ LIBRARY_V2_ENABLED: { state: "all" } }),
  } as unknown as Env;

  const fetchQuery = async (q: string) => {
    const res = await worker.fetch(
      new Request(`https://zukan.earth/ja/library?q=${encodeURIComponent(q)}`, { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } }),
      env,
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-ikimon-cloudflare-native"), "zukan-library-v2");
    return res.text();
  };

  // Taxon name: カワセミ
  const taxonHtml = await fetchQuery("カワセミ");
  assert.match(taxonHtml, /川のほとりで青い鳥を見た/);
  assert.doesNotMatch(taxonHtml, /秋祭りの太鼓/);

  // Seasonal + relative year: 去年の秋
  const autumnHtml = await fetchQuery("去年の秋");
  assert.match(autumnHtml, /秋祭りの太鼓/);
  assert.doesNotMatch(autumnHtml, /川のほとりで青い鳥を見た/);
  assert.doesNotMatch(autumnHtml, /他人の祭りの記録/);

  // Place name from places.canonical_name
  const placeHtml = await fetchQuery("蓮華寺池公園");
  assert.match(placeHtml, /秋祭りの太鼓/);
  assert.doesNotMatch(placeHtml, /川のほとりで青い鳥を見た/);

  // AI candidate name when taxon_label is 未同定
  const aiNameHtml = await fetchQuery("アオサギ");
  assert.match(aiNameHtml, /秋祭りの太鼓/);
  assert.doesNotMatch(aiNameHtml, /川のほとりで青い鳥を見た/);

  // Memo + seasonal multi-keyword: 祭り 去年の秋
  const multiHtml = await fetchQuery("祭り 去年の秋");
  assert.match(multiHtml, /秋祭りの太鼓/);
  assert.doesNotMatch(multiHtml, /川のほとりで青い鳥を見た/);

  // Current year summer: 今年の夏
  const summerHtml = await fetchQuery("今年の夏");
  assert.match(summerHtml, /川のほとりで青い鳥を見た/);
  assert.doesNotMatch(summerHtml, /秋祭りの太鼓/);

  // 0-match empty search state
  const emptyHtml = await fetchQuery("存在しない沖縄の恐竜");
  assert.match(emptyHtml, /data-library-search-empty="1"/);
  assert.doesNotMatch(emptyHtml, /まだ記録がありません/);
  assert.match(emptyHtml, /検索をリセット/);
});

test("Playwright verifies library v2 search results and empty-search UI at 375px and 1280px", async (t) => {
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

  const resultVisits = groupObservationsIntoVisitsV2([
    {
      observationId: "obs-search-1",
      observedAt: "2025-10-15T10:00:00+09:00",
      placeId: "pl-renge",
      placeName: "蓮華寺池公園",
      areaLabel: "藤枝市",
      lat: 34.86,
      lng: 138.25,
      reportTitle: "秋祭りの散策",
      reportBody: "秋祭りの太鼓が遠くから聞こえた。",
      mediaKind: "photo",
      photoUrl: "/thumb/kingfisher.svg",
      durationMs: null,
      visibility: "private",
      zukanPublished: false,
      eventSession: null,
    },
  ]);
  const resultsSearchHtml = renderLibraryV2Page({ visits: resultVisits, lang: "ja", authenticated: true, displayName: "ゆい", searchQuery: "去年の秋", nextCursor: null });
  const emptySearchHtml = renderLibraryV2Page({ visits: [], lang: "ja", authenticated: true, displayName: "ゆい", searchQuery: "祭り", nextCursor: null });
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
    await page.setContent(resultsSearchHtml);
    const resCheck = await page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      summaryShown: Boolean(document.querySelector('[data-library-search-summary="1"]')),
      resetLinkHeight: (document.querySelector('[data-library-search-summary="1"] a') as HTMLElement | null)?.getBoundingClientRect().height ?? 0,
      inputVal: (document.querySelector('form.zt-search input[name="q"]') as HTMLInputElement | null)?.value ?? "",
    }));
    assert.equal(resCheck.overflowX, 0);
    assert.equal(resCheck.summaryShown, true);
    assert.ok(resCheck.resetLinkHeight >= 44, `search reset link height ${resCheck.resetLinkHeight} < 44`);
    assert.equal(resCheck.inputVal, "去年の秋");

    await page.setContent(emptySearchHtml);
    const check = await page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      emptyShown: Boolean(document.querySelector('[data-library-search-empty="1"]')),
      resetHeight: (document.querySelector('[data-library-search-empty="1"] a.zv2l-btn-main') as HTMLElement | null)?.getBoundingClientRect().height ?? 0,
      inputVal: (document.querySelector('form.zt-search input[name="q"]') as HTMLInputElement | null)?.value ?? "",
    }));
    assert.equal(check.overflowX, 0);
    assert.equal(check.emptyShown, true);
    assert.ok(check.resetHeight >= 44, `reset CTA height ${check.resetHeight} < 44`);
    assert.equal(check.inputVal, "祭り");
    await ctx.close();
  }
});

test("library v2 emits infinite-scroll hooks only when nextCursor exists", () => {
  const visits = groupObservationsIntoVisitsV2([
    {
      observationId: "o-1",
      observedAt: "2026-11-23T00:12:00Z",
      placeId: "pl-1",
      placeName: "佐鳴湖",
      areaLabel: "浜松市",
      lat: 35.01,
      lng: 136.47,
      reportTitle: "池",
      reportBody: "カワセミ",
      mediaKind: "photo",
      photoUrl: "/derived-transform/w360/derived/o1/display.webp",
      durationMs: null,
      visibility: "public",
      zukanPublished: true,
      eventSession: null,
    },
  ]);
  const withMore = renderLibraryV2Page({ visits, lang: "ja", authenticated: true, nextCursor: "abc", cspNonce: "n1" });
  assert.match(withMore, /data-library-feed="1"/);
  assert.match(withMore, /data-library-more="1"/);
  assert.match(withMore, /data-load-more="1"/);
  assert.match(withMore, /<script nonce="n1" data-load-more-script>/);
  const noMore = renderLibraryV2Page({ visits, lang: "ja", authenticated: true, nextCursor: null });
  assert.match(noMore, /data-library-feed="1"/);
  assert.doesNotMatch(noMore, /data-library-more|data-load-more/);
});
