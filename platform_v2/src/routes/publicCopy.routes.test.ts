import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { JA_PUBLIC_INTERNAL_AI_BOUNDARY_TERMS, JA_PUBLIC_INTERNAL_JARGON } from "../copy/jaPublic.js";
import { buildApp } from "../app.js";
import { recordsPostHrefForView, renderHomePageHtml } from "./read.js";
import type { HomeSnapshot } from "../services/readModels.js";

async function withEnv(
  overrides: Record<string, string | undefined>,
  run: () => Promise<void>,
): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

const shallowJaRoutes = [
  "/?lang=ja",
  "/records?lang=ja",
  "/guide?lang=ja",
  "/lens?lang=ja",
  "/map?lang=ja",
  "/community?lang=ja",
  "/about?lang=ja",
  "/faq?lang=ja",
  "/contact?lang=ja",
];

const publicAiBoundaryRoutes = [
  ...shallowJaRoutes,
  "/learn?lang=ja",
  "/learn/glossary?lang=ja",
  "/learn/methodology?lang=ja",
  "/learn/terms/ai-candidate?lang=ja",
  "/for-business?lang=ja",
  "/for-business/status?lang=ja",
  "/learn/updates?lang=ja",
];

function visibleTextOnly(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ");
}

function literalPattern(term: string): RegExp {
  return new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

test("shallow public ja routes avoid internal jargon", async () => {
  const app = buildApp();
  try {
    for (const url of shallowJaRoutes) {
      const response = await app.inject({ method: "GET", url, headers: { accept: "text/html" } });
      assert.equal(response.statusCode, 200, `${url} should render`);
      const visibleBody = response.body.replace(/href="[^"]+"/g, 'href=""');
      for (const jargon of JA_PUBLIC_INTERNAL_JARGON) {
        assert.doesNotMatch(visibleBody, new RegExp(jargon, "i"), `${url} should not include ${jargon}`);
      }
      assert.doesNotMatch(visibleBody, /AI が自動で(決め|確定)/, `${url} should keep AI as a hint`);
    }
  } finally {
    await app.close();
  }
});

test("public ja rendered copy keeps AI review internals out of reader-facing text", async () => {
  const app = buildApp();
  try {
    for (const url of publicAiBoundaryRoutes) {
      const response = await app.inject({ method: "GET", url, headers: { accept: "text/html" } });
      assert.equal(response.statusCode, 200, `${url} should render`);
      const visibleText = visibleTextOnly(response.body);
      for (const term of JA_PUBLIC_INTERNAL_AI_BOUNDARY_TERMS) {
        assert.doesNotMatch(visibleText, literalPattern(term), `${url} should not include ${term}`);
      }
    }
  } finally {
    await app.close();
  }
});

test("general and group-help pages use the updated ja entry copy", async () => {
  const app = buildApp();
  try {
    const about = await app.inject({ method: "GET", url: "/about?lang=ja" });
    assert.equal(about.statusCode, 200);
    assert.match(about.body, /生きものを楽しむことから始める/);
    assert.match(about.body, /記録の信頼性を見る/);

    const business = await app.inject({ method: "GET", url: "/for-business?lang=ja" });
    assert.equal(business.statusCode, 200);
    assert.match(business.body, /自然資本を、現場から見直す/);
    assert.match(business.body, /観察、管理行為、再訪の記録/);
    assert.match(business.body, /企業で活用する/);
    assert.doesNotMatch(business.body, /TNFD準拠を証明|自然共生サイト認定を保証|保全効果を自動判定/);

    const businessDemo = await app.inject({ method: "GET", url: "/for-business/demo?lang=ja" });
    assert.equal(businessDemo.statusCode, 200);
    assert.doesNotMatch(businessDemo.body, /ops\/readiness/i);

    const businessStatus = await app.inject({ method: "GET", url: "/for-business/status?lang=ja" });
    assert.equal(businessStatus.statusCode, 200);
    assert.doesNotMatch(businessStatus.body, /readiness/i);
    assert.doesNotMatch(businessStatus.body, /rollback/i);
  } finally {
    await app.close();
  }
});

test("community route replaces the legacy event rail on the public shell", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/community?lang=ja" });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /小さな発見を、みんなで残す/);
    assert.match(response.body, /みんなで調べる/);

    const redirect = await app.inject({ method: "GET", url: "/events.php?lang=ja" });
    assert.equal(redirect.statusCode, 308);
    assert.equal(redirect.headers.location, "/ja/community");
  } finally {
    await app.close();
  }
});

test("updates page keeps the full release history on the v2 public shell", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/learn/updates?lang=ja" });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /バージョンの見方/);
    assert.match(response.body, /v0\.11\.7/);
    assert.match(response.body, /トップ、記録一覧、ガイド/);
    assert.match(response.body, /v0\.11\.6/);
    assert.match(response.body, /現地で記録し、観察会で場所を扱い/);
    assert.match(response.body, /v0\.11\.3/);
    assert.match(response.body, /観察会・音声記録・投稿の安全性/);
    assert.match(response.body, /AI考察 全面強化/);
    assert.match(response.body, /センサースキャン Perch v2/);
    assert.match(response.body, /プロトタイプ版スタート/);
    assert.match(response.body, /2025年11月1日/);

    const redirect = await app.inject({ method: "GET", url: "/updates.php?lang=ja" });
    assert.equal(redirect.statusCode, 308);
    assert.equal(redirect.headers.location, "/ja/learn/updates");
  } finally {
    await app.close();
  }
});

test("root home page uses the state-split guest surface", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/?lang=ja", headers: { accept: "text/html" } });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /<title>地域の記録から始める \| ikimon<\/title>/);
    assert.doesNotMatch(response.body, /<h1 id="prototype-topa-heading">みんなで作る地域図鑑<\/h1>/);
    assert.match(response.body, /data-home-contract="state-split-v1"/);
    assert.match(response.body, /data-home-view="guest"/);
    assert.match(response.body, /data-home-view="member"[^>]* hidden/);
    assert.doesNotMatch(response.body, /<h1>記録を見る<\/h1>/);
    assert.match(response.body, /何を残せるか/);
    assert.match(response.body, /正確な位置は公開しません/);
    assert.match(response.body, /<span class="home-hero-phrase">地域の記録を、<\/span><span class="home-hero-phrase">みんなで育てる。<\/span>/);
    assert.match(response.body, /<nav class="global-record-launcher"/);
    assert.match(response.body, /data-global-record-trigger="photo"/);
    assert.doesNotMatch(response.body, /data-record-feed/);
    assert.doesNotMatch(response.body, /prototype-record-feed[^"]*is-guest/);
    assert.doesNotMatch(response.body, /公開前に安全側で確認します/);
    assert.doesNotMatch(response.body, /class="me-enjoy-strip"/);
    assert.doesNotMatch(response.body, /landing:topA:primary:record/);
    assert.doesNotMatch(response.body, /ぽち/);
    assert.doesNotMatch(response.body, /写真、動画、音、短いメモ/);
    assert.doesNotMatch(response.body, /地域の記録を探す/);
    assert.doesNotMatch(response.body, /日常でいい/);
    assert.doesNotMatch(response.body, /分類は後でいい/);
    assert.doesNotMatch(response.body, /マップは道具/);
    assert.doesNotMatch(response.body, /prototype-topa-trust/);
    assert.doesNotMatch(response.body, /prototype-topa-metrics/);
    assert.doesNotMatch(response.body, /prototype-topa-actions/);
    assert.doesNotMatch(response.body, /id="map-explorer"/);
    assert.doesNotMatch(response.body, /今日見つけた生きものを、名前が分からなくても残せる。/);
    assert.doesNotMatch(response.body, /今日は、どこを見に行く？/);
    assert.doesNotMatch(response.body, /見つける、確かめる、地図で見る。/);
    assert.doesNotMatch(response.body, /フィールドループ/);
    assert.doesNotMatch(response.body, /今日のikimon\.life/);
    assert.doesNotMatch(response.body, /信頼と安全/);
  } finally {
    await app.close();
  }
});

test("home page gives guests a clear place-first path without competing with footer record", () => {
  const html = renderHomePageHtml("", "ja", {
    viewerUserId: null,
    recentObservations: [],
    myPlaces: [],
  } satisfies HomeSnapshot);

  assert.match(html, /data-testid="home-channel"/);
  assert.match(html, /記録する/);
  assert.match(html, /場所を探す/);
  assert.match(html, /近くを見る/);
  assert.match(html, /公開記録を見る/);
  assert.match(html, /フッターから記録/);
  assert.match(html, /地域の記録や地図から、次に歩く場所を選べます。/);
  assert.match(html, /みんなの最近の観察/);
  assert.match(html, /<link rel="canonical" href="https:\/\/ikimon\.life\/ja\/home" \/>/);
  assert.doesNotMatch(html, /前回より、少し見えるようになる/);
});

test("home page keeps anonymous users place-first even when public records exist", () => {
  const html = renderHomePageHtml("", "ja", {
    viewerUserId: null,
    recentObservations: [
      {
        occurrenceId: "occ-1",
        visitId: "visit-1",
        displayName: "コガネムシ科",
        scientificName: null,
        vernacularName: null,
        aiCandidateName: null,
        observedAt: "2026-06-12T08:25:00.000Z",
        observerName: "YAMAKI",
        placeName: "浜松市中央区",
        municipality: "浜松市中央区",
        publicLocation: {
          label: "浜松市中央区",
          scope: "municipality",
          cellId: null,
          gridM: null,
          radiusM: null,
          centroidLat: null,
          centroidLng: null,
          displayMode: "area",
        },
        photoUrl: null,
        hasPhoto: false,
        hasVideo: false,
        identificationCount: 0,
      },
    ],
    myPlaces: [],
  } satisfies HomeSnapshot);

  assert.match(html, /<strong>地域の記録から始める<\/strong>/);
  assert.match(html, /<span>場所を探す<\/span>\s*<strong>近くの発見を見る<\/strong>/);
  assert.match(html, /<span>みんなの記録<\/span>\s*<strong>公開記録を見る<\/strong>/);
  assert.match(html, /<span>最近の記録<\/span>\s*<strong>コガネムシ科<\/strong>/);
  assert.doesNotMatch(html, /<span>前回を見る<\/span>\s*<strong>コガネムシ科<\/strong>/);
  assert.doesNotMatch(html, /<strong>コガネムシ科<\/strong>\s*<em>2026\.06\.12/);
});

test("home page keeps the signed-in desktop dashboard compact", () => {
  const html = renderHomePageHtml("", "ja", {
    viewerUserId: "user-1",
    recentObservations: [],
    myPlaces: [],
  } satisfies HomeSnapshot);

  assert.match(html, /data-testid="home-channel"/);
  assert.match(html, /マイページ/);
  assert.match(html, /観察ノート/);
  assert.match(html, /続きから読む/);
  assert.match(html, /名前を確かめる/);
  assert.match(html, /home-continue-strip/);
  assert.match(html, /今日の入口/);
  assert.match(html, /ikimon\.lifeの流れ/);
  assert.match(html, /記録する/);
  assert.match(html, /地図で見る/);
  assert.match(html, /フッターから記録/);
  assert.match(html, /自分の記録/);
  assert.match(html, /プロフィール/);
  assert.match(html, /自分の最近の観察/);
  assert.match(html, /\.home-grid \{ display: grid; grid-template-columns: repeat\(auto-fill, minmax\(230px, 1fr\)\);/);
  assert.doesNotMatch(html, /前回より、少し見えるようになる/);
  assert.doesNotMatch(html, /今日の作業台/);
  assert.doesNotMatch(html, /権限|ランク|admin|管理者|ログイン中/);
});

test("records workbench unifies personal library and public observations", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/records?lang=ja", headers: { accept: "text/html" } });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /<body class="is-desktop-side-nav-collapsed">/);
    assert.match(response.body, /data-testid="records-workbench"/);
    assert.match(response.body, /記録を見る/);
    assert.match(response.body, /自分/);
    assert.match(response.body, /みんな/);
    assert.match(response.body, /名前待ち/);
    assert.match(response.body, /メディア/);
    assert.match(response.body, /場所/);
    assert.match(response.body, /data-library-search/);
    assert.match(response.body, /<label class="sr-only" for="records-library-search">[^<]+<\/label>/);
    assert.match(response.body, /<input id="records-library-search" type="search"[^>]*data-library-search/);
    assert.match(response.body, /\.notes-library-search:focus-within\s*\{[^}]*box-shadow:\s*0 0 0 3px/);
    assert.match(response.body, /records-view-tabs/);
    assert.match(response.body, /records-post-grid/);
    assert.equal((response.body.match(/<main\b/g) ?? []).length, 1);
    assert.doesNotMatch(response.body, /data-testid="observations-index"/);
  } finally {
    await app.close();
  }
});

test("records saved arrival preserves the saved id and shows a focused return state", async () => {
  await withEnv(
    { ALLOW_QUERY_USER_ID: "1" },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/records?view=mine&userId=story-user&source=record_saved&saved=occ%3Astaging-session-smoke-1%3A1&lang=ja",
          headers: { accept: "text/html" },
        });
        assert.equal(response.statusCode, 200);
        assert.equal(response.headers["cache-control"], "private, no-store");
        assert.match(response.body, /data-records-arrival/);
        assert.match(response.body, /記録しました。/);
        assert.match(response.body, /続けて撮る/);
        assert.match(response.body, /data-record-highlight="true"|最新の1件を一覧へ反映しています/);
        assert.match(response.body, /source=record_saved(?:&amp;|&)saved=occ%3Astaging-session-smoke-1%3A1/);
      } finally {
        await app.close();
      }
    },
  );
});

test("records source contract keeps guest public-first and actionable empty states", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "routes", "read.ts"), "utf8");
  assert.match(source, /return hasViewer \? "mine" : "public"/);
  assert.match(source, /data-records-public-intro/);
  assert.match(source, /みんなの公開記録/);
  assert.match(source, /自分の記録はまだありません/);
  assert.match(source, /写真から記録する/);
  assert.match(source, /data-record-highlight="true"/);
  assert.match(source, /private, no-store/);
});

test("records workbench localizes the unified chrome in English", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/en/records", headers: { accept: "text/html" } });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /<html lang="en">/);
    assert.match(response.body, /Records/);
    assert.match(response.body, /Mine/);
    assert.match(response.body, /Everyone/);
    assert.match(response.body, /Needs ID/);
    assert.match(response.body, /Search by name or place/);
    assert.doesNotMatch(response.body, /記録を見る/);
    assert.doesNotMatch(response.body, /確認待ち/);
  } finally {
    await app.close();
  }
});

test("records workbench renders the identification summary launcher", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/records?view=identification_summary&lang=ja", headers: { accept: "text/html" } });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /data-testid="identification-summary"/);
    assert.match(response.body, /名前確認/);
    assert.match(response.body, /名前待ち/);
    assert.match(response.body, /資料候補あり/);
    assert.match(response.body, /追加写真が必要/);
    assert.match(response.body, /作業台で開く/);
    assert.match(response.body, /href="\/ja\/records\?view=needs_id"/);
    assert.equal((response.body.match(/<main\b/g) ?? []).length, 1);
    assert.doesNotMatch(response.body, /class="global-record-launcher"/);
    assert.doesNotMatch(response.body, /この候補でよさそう/);
  } finally {
    await app.close();
  }
});

test("legacy list surfaces redirect into records while preserving intent", async () => {
  const app = buildApp();
  try {
    const redirect = await app.inject({ method: "GET", url: "/explore?q=tonbo&lang=ja", headers: { accept: "text/html" } });
    assert.equal(redirect.statusCode, 308);
    assert.equal(redirect.headers.location, "/ja/records?view=public&q=tonbo");

    const legacy = await app.inject({ method: "GET", url: "/zukan.php?lang=ja", headers: { accept: "text/html" } });
    assert.equal(legacy.statusCode, 308);
    assert.equal(legacy.headers.location, "/ja/records");

    const observations = await app.inject({ method: "GET", url: "/observations?filter=needs_id&lang=ja", headers: { accept: "text/html" } });
    assert.equal(observations.statusCode, 308);
    assert.equal(observations.headers.location, "/ja/records?view=needs_id");

    const notes = await app.inject({ method: "GET", url: "/notes?lang=ja", headers: { accept: "text/html" } });
    assert.equal(notes.statusCode, 308);
    assert.equal(notes.headers.location, "/ja/records?view=mine");
  } finally {
    await app.close();
  }
});

test("public entry read routes stay in their route lane module", async () => {
  const readRoute = await readFile(path.join(process.cwd(), "src", "routes", "read.ts"), "utf8");
  const publicEntryReadRoute = await readFile(path.join(process.cwd(), "src", "routes", "publicEntryRead.ts"), "utf8");

  assert.match(readRoute, /registerPublicEntryReadRoutes\(app\)/);
  assert.doesNotMatch(readRoute, /app\.get\("\/explore"/);
  assert.doesNotMatch(readRoute, /app\.get\("\/notes"/);
  assert.doesNotMatch(readRoute, /app\.get\("\/lens"/);
  assert.match(publicEntryReadRoute, /app\.get\("\/explore"/);
  assert.match(publicEntryReadRoute, /app\.get\("\/notes"/);
  assert.match(publicEntryReadRoute, /app\.get\("\/lens"/);
  assert.match(publicEntryReadRoute, /renderPublicRouteCardGrid/);
});

test("map page localizes the browser title in English", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/en/map", headers: { accept: "text/html" } });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /<html lang="en">/);
    assert.match(response.body, /<title>Life map \| ikimon<\/title>/);
    assert.doesNotMatch(response.body, /<title>地域のいのちマップ \| ikimon<\/title>/);
  } finally {
    await app.close();
  }
});

test("identification queue is a records workbench tab", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/records?view=needs_id&lang=ja", headers: { accept: "text/html" } });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /records-view-tabs/);
    assert.match(response.body, /名前待ち/);
    assert.match(response.body, /data-library-search/);
    assert.match(response.body, /data-records-identify-workbench/);
    assert.match(response.body, /records-identify-panel/);
    assert.match(response.body, /data-records-identify-panel/);
    assert.match(response.body, /data-testid="records-identify-intro"/);
    assert.match(response.body, /名前待ちの記録は今はありません/);
    assert.match(response.body, /今は名前を待つ公開記録が見つかりません/);
    assert.match(response.body, /名前がつく流れを見返す/);
    assert.match(response.body, /名前を確かめる/);
    assert.equal(recordsPostHrefForView("needs_id", true, "/ja/observations/record-1"), "/ja/observations/record-1#identify");
    assert.equal(recordsPostHrefForView("needs_id", false, "/ja/observations/record-1"), "/ja/observations/record-1");
    assert.equal(recordsPostHrefForView("public", true, "/ja/observations/record-1"), "/ja/observations/record-1");
    assert.doesNotMatch(response.body, /class="hero-panel/);
  } finally {
    await app.close();
  }
});

test("identification workbench panel keeps continuous actions in the records surface", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "routes", "read.ts"), "utf8");
  assert.match(source, /data-identify-panel-action="support"/);
  assert.match(source, /data-identify-panel-action="alternative"/);
  assert.match(source, /data-identify-panel-action="needs_more_evidence"/);
  assert.match(source, /data-identify-panel-action="hold"/);
  assert.match(source, /data-identify-endpoint=/);
  assert.match(source, /data-dispute-endpoint=/);
  assert.match(source, /data-hold-endpoint=/);
  assert.match(source, /data-identify-panel-restore/);
  assert.match(source, /data-identify-panel-keep/);
  assert.match(source, /data-identify-processed/);
  assert.match(source, /data-reference-candidates-endpoint/);
  assert.match(source, /data-identify-panel-reference-options/);
  assert.match(source, /data-identify-panel-reference-capture/);
  assert.match(source, /taxonHint/);
  assert.match(source, /referenceSourceIds: referenceSourceIds/);
  assert.match(source, /identification-workbench-hold/);
});

test("observation detail visible identification history includes reference evidence", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "routes", "read.ts"), "utf8");
  assert.match(source, /obs-local-name-activity-list/);
  assert.match(source, /名前を支持[\s\S]*renderIdentificationReferenceChips\(item\.references\)/);
});

test("reference candidate lookup requires an authenticated session", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/observations/occ-1/reference-candidates?proposedName=test", headers: { accept: "application/json" } });
    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), { ok: false, error: "session_required" });
  } finally {
    await app.close();
  }
});

test("records mine tab keeps source lanes and library controls", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/records?view=mine&lang=ja", headers: { accept: "text/html" } });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /記録を見る/);
    assert.match(response.body, /探す\/絞る/);
    assert.match(response.body, /場所・気づきで探す/);
    assert.match(response.body, /写真/);
    assert.match(response.body, /動画/);
    assert.match(response.body, /ガイド/);
    assert.match(response.body, /スキャン/);
    assert.match(response.body, /records-post-grid/);
    assert.match(response.body, /data-testid="records-workbench"/);
    assert.doesNotMatch(response.body, /ノートを書く/);
    assert.doesNotMatch(response.body, /最初のノートを書く/);
    assert.doesNotMatch(response.body, /notes-brief-card/);
  } finally {
    await app.close();
  }
});

test("records owner cards separate return-place memory from public metadata", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "routes", "read.ts"), "utf8");

  assert.match(source, /function recordsPostMemoryLine/);
  assert.match(source, /options\.locationMode !== "owner"/);
  assert.match(source, /records-post-memory-line/);
  assert.match(source, /options\.locationMode === "owner"[\s\S]*\[sourceLabel, civicLabel\]/);
  assert.match(source, /\.records-post-memory-line \{[\s\S]*text-overflow: ellipsis;[\s\S]*white-space: nowrap;/);
  assert.match(source, /data-record-timeline-item data-record-grouping="visit"/);
  assert.match(source, /data-record-scene-count="\$\{escapeHtml\(String\(card\.postRecordCount\)\)\}"/);
  assert.match(source, /data-notes-library data-record-timeline/);
});

test("records mine tab opens directly into the card grid instead of a story hero", async () => {
  await withEnv(
    {
      ALLOW_QUERY_USER_ID: "1",
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/records?view=mine&userId=story-user&lang=ja",
          headers: { accept: "text/html" },
        });
        assert.equal(response.statusCode, 200);
        assert.match(response.body, /records-post-grid/);
        assert.match(response.body, /data-testid="records-my-places"/);
        assert.match(response.body, /いつもの場所/);
        assert.match(response.body, /data-my-place/);
        assert.match(response.body, /data-records-lazy-root/);
        assert.match(response.body, /data-records-lazy-endpoint="\/api\/v1\/records\/mine-page"/);
        assert.match(response.body, /detectRecordsScrollRoot/);
        assert.match(response.body, /addEventListener\('scroll', scheduleNearBottomCheck/);
        assert.match(response.body, /\{ root: scroller, rootMargin: '640px 0px 640px 0px' \}/);
        assert.match(response.body, /\.shell\.shell-records-workbench \{[\s\S]*width: min\(100%, var\(--ikimon-shell-effective-w, 100%\), calc\(100% - var\(--ikimon-shell-margin-left, 0px\) - var\(--ikimon-shell-margin-right, 0px\)\)\);[\s\S]*overflow-x: clip;/);
        assert.match(response.body, /--ikimon-record-card-grid-desktop: repeat\(6, minmax\(0, 1fr\)\);/);
        assert.match(response.body, /\.records-post-grid \{[\s\S]*grid-template-columns: var\(--ikimon-record-card-grid-fluid\);/);
        assert.match(response.body, /@media \(min-width: 1161px\) \{[\s\S]*\.records-post-grid \{[\s\S]*grid-template-columns: var\(--ikimon-record-card-grid-desktop\);/);
        assert.match(response.body, /@media \(max-width: 1020px\) \{[\s\S]*\.records-post-grid \{[\s\S]*grid-template-columns: var\(--ikimon-record-card-grid-tablet\);/);
        assert.match(response.body, /\.records-post-thumb \{[\s\S]*aspect-ratio: var\(--ikimon-record-card-thumb-ratio\);/);
        assert.doesNotMatch(response.body, /自分の自然観察ストーリー/);
        assert.doesNotMatch(response.body, /最初の章を始める。/);
        assert.doesNotMatch(response.body, /data-kpi-action="records:story:first_record"/);
        assert.match(response.body, /data-testid="records-workbench"/);
      } finally {
        await app.close();
      }
    },
  );
});

test("guide route connects live use to outcomes and the next record", async () => {
  const app = buildApp();
  try {
    const guide = await app.inject({ method: "GET", url: "/guide?lang=ja", headers: { accept: "text/html" } });
    assert.equal(guide.statusCode, 200);
    assert.match(guide.body, /ライブガイド/);
    assert.match(guide.body, /ガイド成果を見る/);
    assert.match(guide.body, /\/ja\/guide\/outcomes/);
    assert.match(guide.body, /写真・動画を記録する/);

    const outcomes = await app.inject({ method: "GET", url: "/guide/outcomes?lang=ja", headers: { accept: "text/html" } });
    assert.equal(outcomes.statusCode, 401);
    assert.match(outcomes.body, /ガイド成果を見るにはログインが必要です/);
    assert.match(outcomes.body, /redirect=%2Fguide%2Foutcomes/);
    assert.match(outcomes.body, /ログインして確認する/);
    assert.match(outcomes.body, /今日できたことを見る/);

    const alias = await app.inject({ method: "GET", url: "/guide/results?lang=ja" });
    assert.equal(alias.statusCode, 308);
    assert.equal(alias.headers.location, "/guide/outcomes");
  } finally {
    await app.close();
  }
});

test("contact page renders content-backed form copy", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/contact?lang=ja" });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /カテゴリ/);
    assert.match(response.body, /送信する/);
    assert.match(response.body, /受付番号/);
  } finally {
    await app.close();
  }
});
