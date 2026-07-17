import assert from "node:assert/strict";
import test from "node:test";
import { worker } from "./index";

const BASE_PATH = "/__ops/browser-qa/renri";
const FIXED_ROUTES = [
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/join`,
  `${BASE_PATH}/rally`,
  `${BASE_PATH}/live`,
  `${BASE_PATH}/recap`
] as const;

function poisonEnv(environment: string) {
  let platformCalls = 0;
  const touched = (name: string): never => {
    platformCalls += 1;
    throw new Error(`synthetic QA touched ${name}`);
  };
  const d1 = {
    prepare() { return touched("D1.prepare"); },
    batch() { return touched("D1.batch"); }
  };
  const bucket = {
    put() { return touched("R2.put"); },
    get() { return touched("R2.get"); },
    head() { return touched("R2.head"); },
    delete() { return touched("R2.delete"); },
    list() { return touched("R2.list"); }
  };
  const queue = { send() { return touched("Queue.send"); } };
  const images = {
    input() { return touched("Images.input"); },
    info() { return touched("Images.info"); }
  };
  return {
    env: {
      ENVIRONMENT: environment,
      CORE_DB: d1,
      OBS_DB: d1,
      ASSET_BUCKET: bucket,
      MEDIA_QUEUE: queue,
      ALERT_QUEUE: queue,
      IMAGES: images,
      PUBLIC_LOCATION_CELL_PRECISION: "geohash6"
    } as never,
    platformCalls: () => platformCalls
  };
}

function assertSyntheticHeaders(response: Response): void {
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive, nosnippet");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.match(response.headers.get("content-security-policy") ?? "", /connect-src 'none'/);
}

function assertAllScriptsCarryCspNonce(response: Response, body: string): void {
  const csp = response.headers.get("content-security-policy") ?? "";
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  assert.ok(nonce, "synthetic HTML must include a CSP nonce");
  const scriptTags = body.match(/<script\b[^>]*>/g) ?? [];
  for (const scriptTag of scriptTags) {
    assert.match(scriptTag, new RegExp(`\\bnonce=["']${nonce}["']`));
  }
}

test("staging synthetic Renri manifest is fixed, secretless, and platform-storage-free", async () => {
  const { env, platformCalls } = poisonEnv("staging");
  const response = await worker.fetch(new Request(`https://staging.ikimon.life${BASE_PATH}/manifest.json`, {
    headers: {
      authorization: "not-a-credential-sentinel",
      cookie: "ikimon_v2_session=should-not-be-read-or-reflected"
    }
  }), env);

  assert.equal(response.status, 200);
  assertSyntheticHeaders(response);
  const payload = await response.json() as Record<string, unknown>;
  assert.equal(payload.synthetic, true);
  assert.equal(payload.staging_only, true);
  assert.equal(payload.values_exposed, false);
  assert.equal(payload.customer_data_access, false);
  assert.equal(payload.customer_data_write, false);
  assert.equal(payload.production_unchanged, true);
  assert.equal(payload.external_requests, false);
  assert.deepEqual(Object.values(payload.routes as Record<string, string>), FIXED_ROUTES);
  assert.deepEqual(payload.viewports, [
    "320x568",
    "360x800",
    "375x667",
    "390x844",
    "412x915",
    "768x1024",
    "1024x768",
    "1366x768",
    "1440x900",
    "1920x1080"
  ]);
  assert.doesNotMatch(JSON.stringify(payload), /should-not-be-read-or-reflected/);
  assert.equal(platformCalls(), 0);
});

test("staging synthetic Renri pages reuse fixed renderers without API, analytics, assets, or credentials", async () => {
  const expectedRenderer = {
    join: "renderObservationEventJoinPage",
    rally: "renderObservationEventRallyPage",
    live: "renderObservationEventLivePage",
    recap: "renderObservationEventRecapPage"
  } as const;

  for (const state of Object.keys(expectedRenderer) as Array<keyof typeof expectedRenderer>) {
    const { env, platformCalls } = poisonEnv("staging");
    const response = await worker.fetch(new Request(`https://staging.ikimon.life${BASE_PATH}/${state}`, {
      headers: {
        authorization: "not-a-credential-html-sentinel",
        cookie: "ikimon_v2_session=html-sentinel"
      }
    }), env);
    const body = await response.text();

    assert.equal(response.status, 200, state);
    assertSyntheticHeaders(response);
    assert.equal(response.headers.get("x-ikimon-cloudflare-native"), `synthetic-renri-browser-qa-${state}`);
    assert.match(body, new RegExp(`data-synthetic-state=["']${state}["']`));
    assert.match(body, /data-synthetic-marker="true"/);
    assert.match(body, /合成データだけを使う表示・操作確認面です/);
    assert.match(body, new RegExp(`data-renderer-contract=["']${expectedRenderer[state]}["']`));
    assert.doesNotMatch(body, /html-sentinel/);
    assert.doesNotMatch(body, /<img\b/i);
    assert.doesNotMatch(body, /https?:\/\//i);
    assert.doesNotMatch(body, /\/api\//i);
    assert.doesNotMatch(body, /\b(?:fetch|sendBeacon|XMLHttpRequest)\s*\(/i);
    assert.doesNotMatch(body, /(?:googletagmanager|google-analytics|clarity|cloudflareinsights)/i);
    assert.doesNotMatch(body, /type=["']password["']/i);
    assert.doesNotMatch(body, /name=["'](?:token|secret|password|authorization)["']/i);
    assertAllScriptsCarryCspNonce(response, body);

    const hrefs = [...body.matchAll(/\bhref="([^"]+)"/g)].map((match) => match[1]);
    for (const href of hrefs) {
      assert.equal(FIXED_ROUTES.includes(href as typeof FIXED_ROUTES[number]), true, `unexpected href on ${state}: ${href}`);
    }
    assert.equal(platformCalls(), 0, state);
  }
});

test("synthetic join covers validation, browser-local draft restore, controlled error, and no-network success", async () => {
  const { env, platformCalls } = poisonEnv("staging");
  const response = await worker.fetch(new Request(`https://staging.ikimon.life${BASE_PATH}/join`), env);
  const body = await response.text();

  assert.match(body, /synthetic-renri-checkin-draft-v1/);
  assert.match(body, /sessionStorage\.setItem/);
  assert.match(body, /sessionStorage\.getItem/);
  assert.match(body, /参加名を入力してください/);
  assert.match(body, /保護者または引率者の同意/);
  assert.match(body, /合成通信エラーです/);
  assert.match(body, /実際の通信は行っていません/);
  assert.match(body, /実APIへの送信はありません/);
  assert.doesNotMatch(body, /\bfetch\s*\(/);
  assert.doesNotMatch(body, /window\.location/);
  assert.equal(platformCalls(), 0);
});

test("synthetic rally interaction is browser-local and cannot submit a real observation", async () => {
  const { env, platformCalls } = poisonEnv("staging");
  const response = await worker.fetch(new Request(`https://staging.ikimon.life${BASE_PATH}/rally`), env);
  const body = await response.text();

  assert.match(body, /data-synthetic-mission="synthetic-mission-bark"/);
  assert.match(body, /role="progressbar"/);
  assert.match(body, /合成発見を1件追加/);
  assert.match(body, /実投稿なし（合成QA）/);
  assert.doesNotMatch(body, /\/record(?:\?|["'])/);
  assert.doesNotMatch(body, /\bfetch\s*\(/);
  assert.equal(platformCalls(), 0);
});

test("production and every non-staging environment hide the entire synthetic surface", async () => {
  for (const environment of ["production", "shadow", "development", ""] as const) {
    for (const pathname of [FIXED_ROUTES[0], FIXED_ROUTES[1], `${BASE_PATH}/unknown`]) {
      const { env, platformCalls } = poisonEnv(environment);
      const response = await worker.fetch(new Request(`https://ikimon.life${pathname}`), env);
      assert.equal(response.status, 404, `${environment}:${pathname}`);
      assert.deepEqual(await response.json(), { error: "not_found" });
      assert.equal(response.headers.get("x-ikimon-synthetic-browser-qa"), null);
      assert.equal(response.headers.get("x-ikimon-cloudflare-native"), null);
      assert.equal(platformCalls(), 0);
    }
  }
});

test("a staging binding cannot expose the synthetic surface on a production or arbitrary host", async () => {
  for (const host of ["ikimon.life", "www.ikimon.life", "preview.example.test"]) {
    const { env, platformCalls } = poisonEnv("staging");
    const response = await worker.fetch(new Request(`https://${host}${BASE_PATH}/join`), env);
    assert.equal(response.status, 404, host);
    assert.deepEqual(await response.json(), { error: "not_found" });
    assert.equal(response.headers.get("x-ikimon-synthetic-browser-qa"), null);
    assert.equal(platformCalls(), 0);
  }
});

test("the fixed staging workers.dev host can serve the secretless manifest", async () => {
  const { env, platformCalls } = poisonEnv("staging");
  const response = await worker.fetch(new Request(
    `https://ikimon-life-cloudflare-staging.yamaki0102.workers.dev${BASE_PATH}/manifest.json`
  ), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { values_exposed?: boolean }).values_exposed, false);
  assert.equal(platformCalls(), 0);
});

test("staging synthetic surface rejects query input, non-GET methods, and arbitrary paths", async () => {
  const cases = [
    new Request(`https://staging.ikimon.life${BASE_PATH}/join?state=anything`),
    new Request(`https://staging.ikimon.life${BASE_PATH}/join`, { method: "POST", body: "anything" }),
    new Request(`https://staging.ikimon.life${BASE_PATH}/join/arbitrary`),
    new Request(`https://staging.ikimon.life${BASE_PATH}`)
  ];
  for (const request of cases) {
    const { env, platformCalls } = poisonEnv("staging");
    const response = await worker.fetch(request, env);
    assert.equal(response.status, 404, request.url);
    assert.deepEqual(await response.json(), { error: "not_found" });
    assert.equal(platformCalls(), 0);
  }
});
