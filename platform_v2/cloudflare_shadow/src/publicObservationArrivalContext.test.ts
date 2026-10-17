import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import publicPresentationEntry from "./publicPresentationEntry";
import { renderRecordsProductSection } from "./index";

function fixture(options: { cutover?: boolean; photo?: boolean; visibility?: string; hidden?: number; withdrawn?: boolean; policy?: string; unavailable?: boolean } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  for (const migration of [
    "0001_observation_write_contract.sql", "0004_public_derivative_gate.sql",
    "0012_public_derivative_binary_verification.sql", "0026_observation_reassessment_requests.sql",
    "0030_observation_data_rights.sql", "0035_observation_record_ai_reviews.sql",
    "0049_observation_detail_edit_runtime.sql", "0052_public_area_label_readmodel.sql",
    "0067_record_observation_foundation.sql",
  ]) {
    sqlite.exec(readFileSync(new URL(`../migrations/observations/${migration}`, import.meta.url), "utf8"));
  }
  sqlite.prepare(`INSERT INTO observations
    (observation_id, draft_id, owner_user_id, observed_at, public_cell, visibility, emergency_hidden, taxon_label)
    VALUES ('arrival-record', 'arrival-draft', 'local-fixture-owner', '2026-06-01T00:00:00Z', '34.70,137.70', ?, ?, 'Public fixture record')`)
    .run(options.visibility ?? "public", options.hidden ?? 0);
  // Keep a stale public projection so the real reader must enforce canonical visibility/withdrawal.
  sqlite.exec(`INSERT INTO readmodel_public_observations
    (observation_id, public_cell, observed_at, taxon_label)
    VALUES ('arrival-record', '34.70,137.70', '2026-06-01T00:00:00Z', 'Public fixture record')`);
  sqlite.exec(`INSERT INTO observations
    (observation_id, draft_id, owner_user_id, observed_at, public_cell, visibility, taxon_label)
    VALUES ('related-record', 'related-draft', 'local-fixture-owner', '2026-06-02T00:00:00Z', '34.70,137.70', 'public', 'Related public fixture');
    INSERT INTO readmodel_public_observations
    (observation_id, public_cell, observed_at, taxon_label)
    VALUES ('related-record', '34.70,137.70', '2026-06-02T00:00:00Z', 'Related public fixture')`);
  if (options.withdrawn) sqlite.exec(`INSERT INTO observation_data_rights
    (visit_id, withdrawal_status) VALUES ('arrival-record', 'withdrawn')`);
  if (options.photo) sqlite.exec(`INSERT INTO asset_ledger
    (asset_id, draft_id, observation_id, owner_user_id, object_key, mime, bytes,
     visibility, processing_state, public_derivative_key, public_derivative_verified_at,
     public_derivative_metadata_json, exif_scrub_state, public_ready_at)
    VALUES ('arrival-photo', 'arrival-draft', 'arrival-record', 'local-fixture-owner',
     'private/original.jpg', 'image/jpeg', 100, 'public', 'uploaded', 'public/arrival.webp',
     '2026-06-01T00:00:00Z', '{"gpsExifPresent":false,"contentType":"image/webp","scannedContainer":"binary"}',
     'scrubbed', '2026-06-01T00:00:00Z')`);
  if (options.policy) sqlite.prepare(`INSERT INTO record_observation_policies
    (record_runtime, record_id, owner_user_id, visibility)
    VALUES ('cloudflare_d1', 'arrival-record', 'local-fixture-owner', ?)`)
    .run(options.policy);
  if (options.unavailable) sqlite.exec("DROP TABLE record_observation_policies");

  const effects = { dbWrites: 0, coreReads: 0, r2Writes: 0, queueWrites: 0, network: 0 };
  const forbidden = (kind: "dbWrites" | "r2Writes" | "queueWrites"): never => {
    effects[kind] += 1;
    throw new Error(`${kind} forbidden in anonymous arrival fixture`);
  };
  const db = {
    prepare(sql: string) {
      if (!/^SELECT\b/iu.test(sql.trimStart())) return forbidden("dbWrites");
      const statement = (values: SQLInputValue[] = []) => ({
        bind(...next: SQLInputValue[]) { return statement(next); },
        async first<T>() { return (sqlite.prepare(sql).get(...values) ?? null) as T | null; },
        async all<T>() { return { results: sqlite.prepare(sql).all(...values) as T[], success: true }; },
        async run() { return forbidden("dbWrites"); },
      });
      return statement();
    },
    async batch() { return forbidden("dbWrites"); },
    async exec() { return forbidden("dbWrites"); },
  };
  const env = {
    ENVIRONMENT: "production",
    OBSERVATION_READ_CUTOVER_MODE: options.cutover ? "on" : "off",
    OBS_DB: db,
    CORE_DB: { prepare() { effects.coreReads += 1; throw new Error("anonymous fixture must not read an account"); } },
    ASSET_BUCKET: {
      async get() { return null; },
      async head() { return null; },
      async put() { return forbidden("r2Writes"); },
      async delete() { return forbidden("r2Writes"); },
    },
    MEDIA_QUEUE: { async send() { return forbidden("queueWrites"); } },
  };
  return { env, effects, close: () => sqlite.close() };
}

async function withFixture(options: Parameters<typeof fixture>[0], check: (value: ReturnType<typeof fixture>) => Promise<void>) {
  const value = fixture(options);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { value.effects.network += 1; throw new Error("external network forbidden in arrival fixture"); };
  try {
    await check(value);
    assert.deepEqual(value.effects, { dbWrites: 0, coreReads: 0, r2Writes: 0, queueWrites: 0, network: 0 });
  } finally {
    globalThis.fetch = originalFetch;
    value.close();
  }
}

async function get(path: string, env: ReturnType<typeof fixture>["env"], method = "GET") {
  return publicPresentationEntry.fetch(new Request(`https://zukan.earth${path}`, { method }), env, { waitUntil() {} });
}

test("public occurrence aliases and obsolete subject links redirect with safe arrival context", async () => {
  const cases = [
    ["/ja/observations/occ%3Aarrival-record%3A0?from=LINE&utm_source=Story&subject=old&lat=35.68&redirect=https%3A%2F%2Fevil.example", "/ja/observations/arrival-record?from=line&utm_source=story"],
    ["/en/observations/arrival-record?occurrence=old&event=walk-day", "/en/observations/arrival-record?event=walk-day"],
    ["/es/observations/arrival-record?subject=old&source=sns", "/es/observations/arrival-record?source=sns"],
    ["/pt-br/observations/occ%3Aarrival-record%3A2?invite=event-day", "/pt-br/observations/arrival-record?invite=event-day"],
    ["/observations/occ%3Aarrival-record%3A0?lang=en&share=timeline-1", "/en/observations/arrival-record?share=timeline-1"],
  ];
  for (const cutover of [false, true]) await withFixture({ cutover }, async ({ env }) => {
    for (const [path, expected] of cases) for (const method of ["GET", "HEAD"]) {
      const response = await get(path!, env, method);
      assert.equal(response.status, 302, `${method} ${path}; cutover=${cutover}`);
      assert.equal(response.headers.get("location"), expected);
      assert.match(response.headers.get("cache-control") ?? "", /no-store/u);
      assert.equal(await response.text(), "");
    }
    const destination = await get(cases[0]![1]!, env);
    assert.equal(destination.status, 200, await destination.clone().text());
    assert.equal(destination.headers.get("location"), null, "canonical destination must not loop");
    const links = [...(await destination.text()).matchAll(/href="([^"]*)"/gu)]
      .map((match) => match[1]!.replaceAll("&amp;", "&"));
    assert.ok(links.some((href) => href.startsWith("/") && href.includes("related-record")
      && new URL(href, "https://zukan.earth").searchParams.get("from") === "line"
      && new URL(href, "https://zukan.earth").searchParams.get("utm_source") === "story"),
    "safe context reaches the rendered related-record link");
  });
});

test("canonical observation links keep action state and do not redirect", async () => {
  for (const cutover of [false, true]) await withFixture({ cutover }, async ({ env }) => {
    const response = await get("/en/observations/arrival-record?action=updated&from=line", env);
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(response.headers.get("location"), null);
    if (cutover) assert.match(await response.text(), /Updated/u);
  });
});

test("final presentation entry preserves records search on detail, alias redirect and protected owner return", async () => {
  for (const cutover of [false, true]) for (const photo of [false, true]) await withFixture({ cutover, photo }, async ({ env }) => {
    for (const lang of ["ja", "en", "es", "pt-br"] as const) for (const view of ["public", "mine"] as const) {
      const query = '浜松 & café + "地域"';
      const listUrl = new URL(`https://zukan.earth/${lang}/records`);
      listUrl.search = new URLSearchParams({ view, q: query, token: "excluded-secret", lat: "35.123456" }).toString();
      const list = renderRecordsProductSection([{ visitId: "arrival-record", displayName: "Public fixture record", observedAt: "2026-06-01", mediaKind: "photo", photoUrl: null }] as never, listUrl, view, null);
      const href = list.match(/class="cf-records-native-card" href="([^"]+)"/)![1]!.replaceAll("&amp;", "&");
      const response = await get(href, env);
      assert.equal(response.status, 200, `${lang}; ${view}; cutover=${cutover}`);
      const html = await response.text();
      if (photo && !cutover) assert.match(html, /obs-vps-image-detail-body/u, "exercise the public photo-polish reader");
      const links = [...html.matchAll(/href="([^"]+)"/gu)].map((match) => match[1]!.replaceAll("&amp;", "&"));
      const back = links.find((link) => link === `/${lang}/records?${new URLSearchParams({ view, q: query })}`);
      assert.ok(back, `final ${cutover ? "observation-first" : "legacy"} reader must preserve the list context`);
      assert.doesNotMatch(html, /excluded-secret|35\.123456|&amp;amp;/u);
      for (const link of links.filter((link) => /^(?:mailto:|https?:)/u.test(link))) {
        assert.doesNotMatch(link, /records_view|records_q|excluded-secret/u, "sharing must not inherit search terms");
      }
      const alias = await get(href.replace("arrival-record", "occ%3Aarrival-record%3A0") + "&subject=old&token=excluded-secret&lat=35.123456", env);
      assert.equal(alias.status, 302);
      assert.equal(alias.headers.get("location"), href);
      if (view === "mine") {
        const returned = await get(back!, env);
        assert.equal(returned.status, 303, "navigation context does not authorize an owner list");
        const login = new URL(returned.headers.get("location")!, "https://zukan.earth");
        assert.equal(login.pathname, `/${lang}/login`);
        assert.equal(login.searchParams.get("redirect"), back, "sign-in continuation retains the bounded search");
      }
    }
  });
});

for (const [name, path, expected] of [
  ["empty subject", "/ja/observations/arrival-record?subject=&from=LINE", "/ja/observations/arrival-record?from=line"],
  ["duplicate subject with first value empty", "/en/observations/arrival-record?subject=&subject=old&source=sns", "/en/observations/arrival-record?source=sns"],
  ["empty occurrence", "/es/observations/arrival-record?occurrence=&from=LINE", "/es/observations/arrival-record?from=line"],
  ["duplicate occurrence with first value empty", "/pt-br/observations/arrival-record?occurrence=&occurrence=old&event=walk-day", "/pt-br/observations/arrival-record?event=walk-day"],
] as const) {
  test(`${name} is removed by the eligible public canonical redirect`, async () => {
    for (const cutover of [false, true]) await withFixture({ cutover }, async ({ env }) => {
      for (const method of ["GET", "HEAD"]) {
        const response = await get(path, env, method);
        assert.equal(response.status, 302, `${method}; cutover=${cutover}`);
        assert.equal(response.headers.get("location"), expected);
        assert.equal(await response.text(), "");
      }
      const destination = await get(expected, env);
      assert.equal(destination.status, 200);
      assert.equal(destination.headers.get("location"), null, "canonical destination must not loop");
    });
  });
}

test("private, hidden, withdrawn and missing records never reveal a canonical redirect", async () => {
  for (const options of [{ visibility: "private" }, { visibility: "limited" }, { hidden: 1 }, { withdrawn: true }]) {
    await withFixture(options, async ({ env }) => {
      for (const method of ["GET", "HEAD"]) {
        const response = await get("/ja/observations/occ%3Aarrival-record%3A0?from=line&subject=old&records_view=public&records_q=private", env, method);
        assert.equal(response.status, 404);
        assert.equal(response.headers.get("location"), null);
      }
    });
  }
  await withFixture({}, async ({ env }) => {
    const response = await get("/ja/observations/occ%3Amissing-record%3A0?from=line", env);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("location"), null);
  });
});

test("observation-first forbidden and unavailable readers keep their fail-closed response", async () => {
  for (const [options, status] of [[{ cutover: true, policy: "private" }, 404], [{ cutover: true, unavailable: true }, 503]] as const) {
    await withFixture(options, async ({ env }) => {
      for (const method of ["GET", "HEAD"]) {
        const response = await get("/ja/observations/occ%3Aarrival-record%3A0?from=line&subject=old", env, method);
        assert.equal(response.status, status);
        assert.equal(response.headers.get("location"), null);
        assert.match(response.headers.get("cache-control") ?? "", /no-store/u);
        if (status === 503) assert.equal(response.headers.get("retry-after"), "30");
      }
    });
  }
});
