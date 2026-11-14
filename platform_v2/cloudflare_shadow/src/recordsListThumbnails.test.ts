import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import worker, { renderRecordsProductSection } from "./index";

function createRecordsFixture() {
  const sqlite = new DatabaseSync(":memory:");
  for (const migration of [
    "0001_observation_write_contract.sql",
    "0004_public_derivative_gate.sql",
    "0011_logical_partition_month.sql",
    "0012_public_derivative_binary_verification.sql",
    "0017_public_map_snapshot_records.sql",
    "0026_observation_reassessment_requests.sql",
    "0030_observation_data_rights.sql",
    "0049_observation_detail_edit_runtime.sql",
    "0052_public_area_label_readmodel.sql",
    "0053_observation_public_area_label.sql",
  ]) {
    sqlite.exec(readFileSync(new URL(`../migrations/observations/${migration}`, import.meta.url), "utf8"));
  }
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS production_import_evidence_assets (
      visit_id TEXT,
      occurrence_id TEXT,
      asset_role TEXT
    );
  `);

  const db = {
    prepare(sql: string) {
      const statement = (values: SQLInputValue[] = []) => ({
        bind(...next: SQLInputValue[]) {
          return statement(next);
        },
        async first<T>() {
          return (sqlite.prepare(sql).get(...values) ?? null) as T | null;
        },
        async all<T>() {
          return { results: sqlite.prepare(sql).all(...values) as T[], success: true };
        },
        async run() {
          return sqlite.prepare(sql).run(...values);
        },
      });
      return statement();
    },
  };

  return { sqlite, db };
}

test("records list cards use w320 thumbnail src with 320w/640w srcset, fixed box dimensions, and priority loading for first cards", () => {
  const items = Array.from({ length: 5 }, (_, index) => ({
    visitId: `rec-${index}`,
    displayName: index === 0 ? "名前待ち" : `生きもの ${index}`,
    observedAt: `2026-09-30T0${index}:00:00Z`,
    mediaKind: "photo" as const,
    isAwaitingId: index === 0,
    photoUrl: `/derived/import/20260930/observation_photo/asset-${index}/display.webp`,
    publicAreaLabel: index === 0 ? "浜松市" : null,
  }));

  const html = renderRecordsProductSection(items as never, new URL("https://zukan.earth/ja/records?view=public"), "public", null);

  assert.match(html, /\.cf-records-native-media\{[^}]*width:104px;height:104px;aspect-ratio:1\/1;[^}]*background:#f0f2ed/);
  assert.match(html, /@media\(min-width:640px\)\{[\s\S]*?\.cf-records-native-media\{width:100%;height:auto;aspect-ratio:4\/3\}/);

  const imgs = [...html.matchAll(/<img\s+([^>]+)>/g)].map((m) => m[1]!);
  assert.equal(imgs.length, 5);

  for (let index = 0; index < imgs.length; index += 1) {
    const attrs = imgs[index]!;
    const key = `derived/import/20260930/observation_photo/asset-${index}/display.webp`;
    assert.ok(attrs.includes(`src="/derived-transform/w320/${key}"`), `card ${index} uses w320 src`);
    assert.ok(
      attrs.includes(`srcset="/derived-transform/w320/${key} 320w, /derived-transform/w640/${key} 640w"`),
      `card ${index} includes 320w and 640w srcset`
    );
    assert.ok(attrs.includes('sizes="(max-width: 639px) 104px, 320px"'), `card ${index} sets sizes`);
    assert.ok(attrs.includes('width="320" height="240"'), `card ${index} sets fixed image dimensions`);
    if (index < 3) {
      assert.ok(attrs.includes('loading="eager"'), `card ${index} loads eagerly`);
      assert.ok(attrs.includes('fetchpriority="high"'), `card ${index} has fetchpriority=high`);
    } else {
      assert.ok(attrs.includes('loading="lazy"'), `card ${index} loads lazily`);
      assert.ok(!attrs.includes('fetchpriority="high"'), `card ${index} does not use fetchpriority=high`);
    }
  }
});

test("distinguishing line prefers safe coarse place, falls back to public note, then safe AI/scene hint, else nothing, without repeating date", () => {
  const items = [
    {
      visitId: "rec-place",
      displayName: "名前待ち",
      observedAt: "2026-09-30T00:00:00Z",
      mediaKind: "photo" as const,
      isAwaitingId: true,
      photoUrl: null,
      publicAreaLabel: "静岡県浜松市",
      publicNote: "これは出ないはずのノート",
      aiCandidateLabel: "ドングリ",
    },
    {
      visitId: "rec-note",
      displayName: "名前待ち",
      observedAt: "2026-09-30T00:00:00Z",
      mediaKind: "photo" as const,
      isAwaitingId: true,
      photoUrl: null,
      publicAreaLabel: null,
      publicNote: "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほ\n二行目は表示されない",
      aiCandidateLabel: "ドングリ",
    },
    {
      visitId: "rec-sensitive-place",
      displayName: "名前待ち",
      observedAt: "2026-09-30T00:00:00Z",
      mediaKind: "photo" as const,
      isAwaitingId: true,
      photoUrl: null,
      publicAreaLabel: "浜松市立西小学校1-2-3",
      publicNote: "池のふちで鳴いていた",
    },
    {
      visitId: "rec-ai-hint",
      displayName: "名前待ち",
      observedAt: "2026-09-30T00:00:00Z",
      mediaKind: "photo" as const,
      isAwaitingId: true,
      photoUrl: null,
      publicAreaLabel: null,
      publicNote: null,
      aiCandidateLabel: "ドングリ",
      scenePlaceType: "grassland_urban_edge",
    },
    {
      visitId: "rec-scene-hint",
      displayName: "名前待ち",
      observedAt: "2026-09-30T00:00:00Z",
      mediaKind: "photo" as const,
      isAwaitingId: true,
      photoUrl: null,
      publicAreaLabel: null,
      publicNote: null,
      aiCandidateLabel: null,
      scenePlaceType: "grassland_urban_edge",
    },
    {
      visitId: "rec-none",
      displayName: "名前待ち",
      observedAt: "2026-09-30T00:00:00Z",
      mediaKind: "photo" as const,
      isAwaitingId: true,
      photoUrl: null,
      publicAreaLabel: null,
      publicNote: null,
    },
    {
      visitId: "rec-identified",
      displayName: "ニホンアマガエル",
      observedAt: "2026-09-30T00:00:00Z",
      mediaKind: "photo" as const,
      isAwaitingId: false,
      photoUrl: null,
      publicAreaLabel: "静岡県浜松市",
      publicNote: null,
    },
  ];

  const html = renderRecordsProductSection(items as never, new URL("https://zukan.earth/ja/records?view=public"), "public", null);
  const cards = [...html.matchAll(/<a class="cf-records-native-card"[\s\S]*?<\/a>/g)].map((m) => m[0]);
  assert.equal(cards.length, 7);

  assert.match(cards[0]!, /<strong>写真 · 9月30日<\/strong><span>静岡県浜松市<\/span><span>名前は未確認<\/span>/);
  assert.doesNotMatch(cards[0]!, /これは出ないはずのノート|ドングリ/);
  assert.equal(cards[0]!.match(/9月30日/g)?.length, 1);

  assert.match(cards[1]!, /<strong>写真 · 9月30日<\/strong><span>あいうえおかきくけこさしすせそたちつてとなにぬね…<\/span>/);
  assert.doesNotMatch(cards[1]!, /はひふへほ|二行目|ドングリ/);
  assert.equal(cards[1]!.match(/9月30日/g)?.length, 1);

  assert.doesNotMatch(cards[2]!, /西小学校|1-2-3|位置を保護/);
  assert.match(cards[2]!, /<strong>写真 · 9月30日<\/strong><span>池のふちで鳴いていた<\/span>/);
  assert.equal(cards[2]!.match(/9月30日/g)?.length, 1);

  assert.match(cards[3]!, /<strong>写真 · 9月30日<\/strong><span>ドングリかもしれません<\/span><span>名前は未確認<\/span>/);
  assert.doesNotMatch(cards[3]!, /草地と市街地/);
  assert.equal(cards[3]!.match(/9月30日/g)?.length, 1);

  assert.match(cards[4]!, /<strong>写真 · 9月30日<\/strong><span>草地と市街地の境界のようです<\/span><span>名前は未確認<\/span>/);
  assert.equal(cards[4]!.match(/9月30日/g)?.length, 1);

  assert.doesNotMatch(cards[5]!, /位置を保護/);
  assert.match(cards[5]!, /<strong>写真 · 9月30日<\/strong><span>名前は未確認<\/span>/);
  assert.equal(cards[5]!.match(/9月30日/g)?.length, 1);

  assert.match(cards[6]!, /<strong>ニホンアマガエル<\/strong><span>9月30日 · 静岡県浜松市<\/span>/);
});

test("derived-transform route supports w320 and w640 widths", async () => {
  const originalFetch = globalThis.fetch;
  const requestedWidths: number[] = [];
  globalThis.fetch = (async (_input: unknown, init?: RequestInit & { cf?: { image?: { width?: number } } }) => {
    requestedWidths.push(Number(init?.cf?.image?.width ?? 0));
    return new Response("webp-bytes", { status: 200, headers: { "content-type": "image/webp" } });
  }) as typeof fetch;

  try {
    const { sqlite, db } = createRecordsFixture();
    const env = { ENVIRONMENT: "production", OBS_DB: db, CORE_DB: db };
    for (const width of [320, 640]) {
      const response = await worker.fetch(
        new Request(`https://zukan.earth/derived-transform/w${width}/derived/import/20260930/observation_photo/asset-1/display.webp`, {
          headers: { accept: "image/webp" },
        }),
        env as never
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("x-ikimon-image-transform-width"), String(width));
    }
    assert.deepEqual(requestedWidths, [320, 640]);
    sqlite.close();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("public records route loads safe coarse place and public note without leaking private notes or protected locations", async () => {
  const { sqlite, db } = createRecordsFixture();
  try {
    sqlite.exec(`
      INSERT INTO observations (observation_id, draft_id, owner_user_id, observed_at, public_cell, visibility, emergency_hidden, taxon_label, note, public_area_label)
      VALUES
        ('pub-place', 'd1', 'u1', '2026-09-30T01:00:00Z', '34.70,137.70', 'public', 0, '名前待ち', '公開メモ1', '浜松市'),
        ('pub-note', 'd2', 'u1', '2026-09-30T02:00:00Z', '34.70,137.70', 'public', 0, '名前待ち', '川辺の葦原で撮影\n詳細メモ', NULL),
        ('pub-pii', 'd3', 'u1', '2026-09-30T03:00:00Z', '34.70,137.70', 'public', 0, '名前待ち', '連絡先は test@example.com です', NULL),
        ('priv-rec', 'd4', 'u1', '2026-09-30T04:00:00Z', '34.70,137.70', 'private', 0, '名前待ち', '秘密のプライベートメモ', '自宅付近');

      INSERT INTO readmodel_public_observations (observation_id, public_cell, observed_at, taxon_label, asset_count, public_area_label)
      VALUES
        ('pub-place', '34.70,137.70', '2026-09-30T01:00:00Z', '名前待ち', 1, '浜松市'),
        ('pub-note', '34.70,137.70', '2026-09-30T02:00:00Z', '名前待ち', 1, NULL),
        ('pub-pii', '34.70,137.70', '2026-09-30T03:00:00Z', '名前待ち', 1, NULL),
        ('priv-rec', '34.70,137.70', '2026-09-30T04:00:00Z', '名前待ち', 1, '自宅付近');

      INSERT INTO public_map_snapshot_records_v1 (snapshot_key, visit_id, occurrence_id, cell_1000, cell_3000, cell_10000, observed_at, observed_year, taxon_group, display_name, asset_count)
      VALUES
        ('public-map:v1:global', 'pub-place', 'occ:pub-place:0', '34.70,137.70', '34.7,137.7', '34.7,137.7', '2026-09-30T01:00:00Z', 2026, 'other', '名前待ち', 1),
        ('public-map:v1:global', 'pub-note', 'occ:pub-note:0', '34.70,137.70', '34.7,137.7', '34.7,137.7', '2026-09-30T02:00:00Z', 2026, 'other', '名前待ち', 1),
        ('public-map:v1:global', 'pub-pii', 'occ:pub-pii:0', '34.70,137.70', '34.7,137.7', '34.7,137.7', '2026-09-30T03:00:00Z', 2026, 'other', '名前待ち', 1);

      INSERT INTO asset_ledger (asset_id, draft_id, observation_id, owner_user_id, object_key, mime, bytes, visibility, processing_state, public_derivative_key, public_derivative_verified_at, public_derivative_metadata_json, exif_scrub_state, public_ready_at)
      VALUES
        ('a1', 'd1', 'pub-place', 'u1', 'orig/1.jpg', 'image/jpeg', 1000, 'public', 'uploaded', 'derived/import/20260930/observation_photo/a1/display.webp', '2026-09-30T01:00:00Z', '{"gpsExifPresent":false,"contentType":"image/webp","scannedContainer":"webp"}', 'scrubbed', '2026-09-30T01:00:00Z'),
        ('a2', 'd2', 'pub-note', 'u1', 'orig/2.jpg', 'image/jpeg', 1000, 'public', 'uploaded', 'derived/import/20260930/observation_photo/a2/display.webp', '2026-09-30T02:00:00Z', '{"gpsExifPresent":false,"contentType":"image/webp","scannedContainer":"webp"}', 'scrubbed', '2026-09-30T02:00:00Z'),
        ('a3', 'd3', 'pub-pii', 'u1', 'orig/3.jpg', 'image/jpeg', 1000, 'public', 'uploaded', 'derived/import/20260930/observation_photo/a3/display.webp', '2026-09-30T03:00:00Z', '{"gpsExifPresent":false,"contentType":"image/webp","scannedContainer":"webp"}', 'scrubbed', '2026-09-30T03:00:00Z');
    `);

    const env = {
      ENVIRONMENT: "staging",
      OBS_DB: db,
      CORE_DB: db,
      ASSET_BUCKET: {
        async get(key: string) {
          if (!/^original-ui\/html\/(ja|en|es|pt-br)\/records\.html$/u.test(key)) return null;
          return {
            body: new Response('<!doctype html><html lang="ja"><body><main></main></body></html>').body,
            httpMetadata: { contentType: "text/html; charset=utf-8" },
          };
        },
        async head() {
          return null;
        },
      },
    };

    const response = await worker.fetch(new Request("https://zukan.earth/ja/records?view=public"), env as never);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /\/derived-transform\/w320\/derived\/import\/20260930\/observation_photo\/a1\/display\.webp/);
    assert.match(html, /浜松市/);
    assert.match(html, /川辺の葦原で撮影/);
    assert.doesNotMatch(html, /<span>9月30日<\/span>/);
    assert.doesNotMatch(html, /詳細メモ|test@example\.com|秘密のプライベートメモ|自宅付近|位置を保護/);
  } finally {
    sqlite.close();
  }
});
