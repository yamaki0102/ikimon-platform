import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { SESSION_COOKIE_NAME, type SessionSnapshot } from "./core/shared";
import { sha256Hex, textToArrayBuffer } from "./core/http";
import { GUEST_PASS_COOKIE_NAME } from "./guestPosting";
import { renderGlobalPlaceDetailPage } from "./placeDetailPage";
import { PROTOTYPE_FLAGS } from "./flags/index.generated";
import * as shopPerkFlagMeta from "./flags/SHOP_PHOTO_PERK_ENABLED";
import {
  SHOP_PHOTO_PERK_FLAG,
  handleShopPhotoPerkRequest,
  loadShopPlacePerkSectionData,
  renderShopPlacePerkSectionHtml,
} from "./shopPhotoPerk";

function sqliteDb(sqlite: DatabaseSync): Env["OBS_DB"] {
  const wrapStmt = (query: string, values: unknown[]) => ({
    runSync: () => ({ meta: { changes: Number(sqlite.prepare(query).run(...(values as never[])).changes) } }),
  });
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          values = args;
          return stmt;
        },
        async run() {
          return wrapStmt(query, values).runSync();
        },
        async first<T>() {
          return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null;
        },
        async all<T>() {
          return { results: sqlite.prepare(query).all(...(values as never[])) as T[] };
        },
        __raw: () => wrapStmt(query, values),
      };
      return stmt as unknown as ReturnType<Env["OBS_DB"]["prepare"]>;
    },
    async batch(stmts: Array<{ __raw?: () => { runSync: () => unknown }; run: () => Promise<unknown> }>) {
      const results: unknown[] = [];
      for (const s of stmts) {
        results.push(s.__raw ? s.__raw().runSync() : await s.run());
      }
      return results;
    },
  } as unknown as Env["OBS_DB"];
}

function createMemoryBucket() {
  const objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  const bucket = {
    async put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }) {
      const bytes = value instanceof Uint8Array ? new Uint8Array(value) : new Uint8Array(value);
      objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType });
    },
    async get(key: string) {
      const item = objects.get(key);
      if (!item) return null;
      return {
        body: new Response(item.bytes.slice().buffer).body,
        size: item.bytes.byteLength,
        httpMetadata: { contentType: item.contentType },
      };
    },
    async delete(key: string) {
      objects.delete(key);
    },
  };
  return { bucket: bucket as unknown as Env["ASSET_BUCKET"], objects };
}

function makeCleanWebpBase64(): string {
  // Valid RIFF/WEBP VP8X minimal chunk without EXIF or XMP metadata.
  const buf = new Uint8Array(30);
  buf.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  new DataView(buf.buffer).setUint32(4, 22, true);
  buf.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  buf.set([0x56, 0x50, 0x38, 0x58], 12); // VP8X
  new DataView(buf.buffer).setUint32(16, 10, true);
  return Buffer.from(buf).toString("base64");
}

function makeExifWebpBase64(): string {
  const exifData = new TextEncoder().encode("GPSLatitude 34.71234 GPSLongitude 137.81234");
  const paddedLen = exifData.byteLength + (exifData.byteLength % 2);
  const totalLen = 4 + 8 + paddedLen;
  const buf = new Uint8Array(8 + totalLen);
  buf.set([0x52, 0x49, 0x46, 0x46], 0);
  new DataView(buf.buffer).setUint32(4, totalLen, true);
  buf.set([0x57, 0x45, 0x42, 0x50], 8);
  buf.set([0x45, 0x58, 0x49, 0x46], 12); // EXIF
  new DataView(buf.buffer).setUint32(16, exifData.byteLength, true);
  buf.set(exifData, 20);
  return Buffer.from(buf).toString("base64");
}

async function setupEnv(t: test.TestContext, flagValue: "true" | "false" = "true") {
  const obsSqlite = new DatabaseSync(":memory:");
  const coreSqlite = new DatabaseSync(":memory:");
  t.after(() => {
    obsSqlite.close();
    coreSqlite.close();
  });
  obsSqlite.exec(`
    CREATE TABLE IF NOT EXISTS place_memory_entries (
      entry_id TEXT PRIMARY KEY,
      cell_id TEXT,
      updated_at TEXT
    );
  `);
  for (const file of [
    "../migrations/observations/0001_observation_write_contract.sql",
    "../migrations/observations/0068_universal_place_atlas.sql",
    "../migrations/observations/0078_guest_posting_core.sql",
    "../migrations/observations/0089_shop_photo_perk.sql",
  ]) {
    obsSqlite.exec(await readFile(new URL(file, import.meta.url), "utf8"));
  }
  obsSqlite.exec(`
    ALTER TABLE observations ADD COLUMN partition_month TEXT;
    CREATE TABLE IF NOT EXISTS field_managers (
      user_id TEXT NOT NULL,
      field_id TEXT NOT NULL,
      role TEXT NOT NULL,
      expires_at TEXT,
      created_by_user_id TEXT,
      PRIMARY KEY (user_id, field_id)
    );
  `);
  coreSqlite.exec(`
    CREATE TABLE IF NOT EXISTS auth_users (user_id TEXT PRIMARY KEY, display_name TEXT, role_name TEXT, rank_label TEXT, banned INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);
  `);

  obsSqlite.prepare(
    `INSERT INTO places (place_id, canonical_name, canonical_name_normalized, place_kind, verification_status, public_profile_status, official_status)
     VALUES ('plc_shop_1', '浜名湖カフェ', '浜名湖カフェ', 'other_named_area', 'verified', 'published', 'official')`
  ).run();

  const stewardToken = "tok-steward-1";
  const memberToken = "tok-member-1";
  const otherToken = "tok-other-1";
  const adminToken = "tok-admin-1";
  const future = "2099-01-01T00:00:00.000Z";

  const addUser = async (token: string, userId: string, displayName: string, roleName: string) => {
    coreSqlite.prepare("INSERT INTO auth_users (user_id, display_name, role_name, banned) VALUES (?, ?, ?, 0)").run(userId, displayName, roleName);
    const hash = await sha256Hex(textToArrayBuffer(token));
    coreSqlite.prepare("INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(hash, userId, future);
  };
  await addUser(stewardToken, "user_steward_1", "店長", "member");
  await addUser(memberToken, "user_member_1", "お客さんA", "member");
  await addUser(otherToken, "user_other_1", "別の人B", "member");
  await addUser(adminToken, "user_admin_1", "運営", "admin");

  obsSqlite.prepare("INSERT INTO field_managers (user_id, field_id, role, created_by_user_id) VALUES ('user_steward_1', 'plc_shop_1', 'steward', 'user_admin_1')").run();

  const { bucket } = createMemoryBucket();
  const env = {
    OBS_DB: sqliteDb(obsSqlite),
    CORE_DB: sqliteDb(coreSqlite),
    ASSET_BUCKET: bucket,
    [SHOP_PHOTO_PERK_FLAG]: flagValue,
  } as unknown as Env;

  return { env, obsSqlite, coreSqlite, tokens: { stewardToken, memberToken, otherToken, adminToken } };
}

function sessionOf(userId: string, roleName: string): SessionSnapshot {
  return {
    tokenHash: `hash-${userId}`,
    userId,
    displayName: userId,
    roleName,
    rankLabel: null,
    banned: false,
    expiresAt: "2099-01-01T00:00:00.000Z",
  };
}

test("SHOP_PHOTO_PERK_ENABLED is default off in prototype flags and returns 404 when disabled", async (t) => {
  const entry = PROTOTYPE_FLAGS.find((f) => f.flag === "SHOP_PHOTO_PERK_ENABLED");
  assert.ok(entry);
  assert.equal(shopPerkFlagMeta.staging, false);
  assert.equal(shopPerkFlagMeta.production, false);

  const { env } = await setupEnv(t, "false");
  for (const req of [
    new Request("https://zukan.earth/ja/shops/plc_shop_1/qr"),
    new Request("https://zukan.earth/api/v1/shops/plc_shop_1/perk-config", { method: "PUT", body: "{}" }),
    new Request("https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk", { method: "POST", body: "{}" }),
    new Request("https://zukan.earth/ja/shops/plc_shop_1/tickets/spp_1"),
  ]) {
    const res = await handleShopPhotoPerkRequest(req, new URL(req.url), env, null);
    assert.ok(res);
    assert.equal(res.status, 404);
  }
});

test("write endpoints enforce 401 unauthenticated, 403 non-owner/non-steward, and ignore client status/id/coords", async (t) => {
  const { env, tokens } = await setupEnv(t, "true");
  const steward = sessionOf("user_steward_1", "member");
  const member = sessionOf("user_member_1", "member");
  const other = sessionOf("user_other_1", "member");

  // 1. PUT perk-config: unauth -> 401, non-steward member -> 403, shop steward -> 200
  const cfgAnon = await handleShopPhotoPerkRequest(
    new Request("https://zukan.earth/api/v1/shops/plc_shop_1/perk-config", {
      method: "PUT",
      headers: { origin: "https://zukan.earth", "content-type": "application/json" },
      body: JSON.stringify({ perkText: "コーヒー50円引き", active: true }),
    }),
    new URL("https://zukan.earth/api/v1/shops/plc_shop_1/perk-config"),
    env,
    null
  );
  assert.equal(cfgAnon?.status, 401);

  const cfgNonAdmin = await handleShopPhotoPerkRequest(
    new Request("https://zukan.earth/api/v1/shops/plc_shop_1/perk-config", {
      method: "PUT",
      headers: { origin: "https://zukan.earth", "content-type": "application/json", cookie: `${SESSION_COOKIE_NAME}=${tokens.memberToken}` },
      body: JSON.stringify({ perkText: "不正変更", active: true }),
    }),
    new URL("https://zukan.earth/api/v1/shops/plc_shop_1/perk-config"),
    env,
    member
  );
  assert.equal(cfgNonAdmin?.status, 403);

  const cfgSteward = await handleShopPhotoPerkRequest(
    new Request("https://zukan.earth/api/v1/shops/plc_shop_1/perk-config", {
      method: "PUT",
      headers: { origin: "https://zukan.earth", "content-type": "application/json", cookie: `${SESSION_COOKIE_NAME}=${tokens.stewardToken}` },
      body: JSON.stringify({ perkText: "本日のブレンド50円引き", shopName: "浜名湖カフェ", active: true }),
    }),
    new URL("https://zukan.earth/api/v1/shops/plc_shop_1/perk-config"),
    env,
    steward
  );
  assert.equal(cfgSteward?.status, 200);

  // 2. POST photo-perk without pass/login -> 401
  const postAnon = await handleShopPhotoPerkRequest(
    new Request("https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk", {
      method: "POST",
      headers: { origin: "https://zukan.earth", "content-type": "application/json" },
      body: JSON.stringify({ mimeType: "image/webp", filename: "shot.webp", base64Data: makeCleanWebpBase64(), facePrivacy: "no_faces" }),
    }),
    new URL("https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk"),
    env,
    null
  );
  assert.equal(postAnon?.status, 401);

  // 3. Authenticated member posts with forged fields -> server assigns own id, status, ownerKey, ignores coords
  const postMember = await handleShopPhotoPerkRequest(
    new Request("https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk", {
      method: "POST",
      headers: { origin: "https://zukan.earth", "content-type": "application/json" },
      body: JSON.stringify({
        perkPostId: "forged-id",
        ticketStatus: "redeemed",
        moderationStatus: "published",
        ownerKey: "user:forged",
        lat: 34.71234,
        lng: 137.81234,
        mimeType: "image/webp",
        filename: "bird.webp",
        base64Data: makeCleanWebpBase64(),
        facePrivacy: "no_faces",
      }),
    }),
    new URL("https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk"),
    env,
    member
  );
  assert.equal(postMember?.status, 201);
  const posted = await postMember!.json() as { perkPostId: string; ticketStatus: string; passed: boolean };
  assert.notEqual(posted.perkPostId, "forged-id");
  assert.equal(posted.passed, true);
  assert.equal(posted.ticketStatus, "issued");

  // 4. Redeem: unauth -> 401, non-owner -> 403
  const redeemAnon = await handleShopPhotoPerkRequest(
    new Request(`https://zukan.earth/api/v1/shops/plc_shop_1/tickets/${posted.perkPostId}/redeem`, {
      method: "POST",
      headers: { origin: "https://zukan.earth" },
    }),
    new URL(`https://zukan.earth/api/v1/shops/plc_shop_1/tickets/${posted.perkPostId}/redeem`),
    env,
    null
  );
  assert.equal(redeemAnon?.status, 401);

  const redeemOther = await handleShopPhotoPerkRequest(
    new Request(`https://zukan.earth/api/v1/shops/plc_shop_1/tickets/${posted.perkPostId}/redeem`, {
      method: "POST",
      headers: { origin: "https://zukan.earth" },
    }),
    new URL(`https://zukan.earth/api/v1/shops/plc_shop_1/tickets/${posted.perkPostId}/redeem`),
    env,
    other
  );
  assert.equal(redeemOther?.status, 403);

  // 5. Save-to-record: unauth -> 401 with loginUrl, non-owner -> 403
  const saveAnon = await handleShopPhotoPerkRequest(
    new Request(`https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk/${posted.perkPostId}/save-to-record`, {
      method: "POST",
      headers: { origin: "https://zukan.earth" },
    }),
    new URL(`https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk/${posted.perkPostId}/save-to-record`),
    env,
    null
  );
  assert.equal(saveAnon?.status, 401);
  const saveAnonBody = await saveAnon!.json() as { loginUrl?: string };
  assert.match(saveAnonBody.loginUrl ?? "", /^\/login\?next=/);

  const saveOther = await handleShopPhotoPerkRequest(
    new Request(`https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk/${posted.perkPostId}/save-to-record`, {
      method: "POST",
      headers: { origin: "https://zukan.earth" },
    }),
    new URL(`https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk/${posted.perkPostId}/save-to-record`),
    env,
    other
  );
  assert.equal(saveOther?.status, 403);

  // 6. Takedown & metrics: unauth -> 401, non-steward member -> 403
  const takedownAnon = await handleShopPhotoPerkRequest(
    new Request(`https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk/${posted.perkPostId}/takedown`, {
      method: "POST",
      headers: { origin: "https://zukan.earth" },
    }),
    new URL(`https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk/${posted.perkPostId}/takedown`),
    env,
    null
  );
  assert.equal(takedownAnon?.status, 401);

  const takedownMember = await handleShopPhotoPerkRequest(
    new Request(`https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk/${posted.perkPostId}/takedown`, {
      method: "POST",
      headers: { origin: "https://zukan.earth" },
    }),
    new URL(`https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk/${posted.perkPostId}/takedown`),
    env,
    member
  );
  assert.equal(takedownMember?.status, 403);

  const metricsMember = await handleShopPhotoPerkRequest(
    new Request("https://zukan.earth/api/v1/shops/plc_shop_1/perk-metrics"),
    new URL("https://zukan.earth/api/v1/shops/plc_shop_1/perk-metrics"),
    env,
    member
  );
  assert.equal(metricsMember?.status, 403);
});

test("full QR guest -> inspection gate -> ticket clock/redeem once -> place page disclosure -> takedown -> one-tap save -> metrics", async (t) => {
  const { env, obsSqlite } = await setupEnv(t, "true");
  const steward = sessionOf("user_steward_1", "member");
  const member = sessionOf("user_member_1", "member");

  await handleShopPhotoPerkRequest(
    new Request("https://zukan.earth/api/v1/shops/plc_shop_1/perk-config", {
      method: "PUT",
      headers: { origin: "https://zukan.earth", "content-type": "application/json" },
      body: JSON.stringify({ perkText: "100円引きクーポン", shopName: "浜名湖カフェ", active: true }),
    }),
    new URL("https://zukan.earth/api/v1/shops/plc_shop_1/perk-config"),
    env,
    steward
  );

  // 1. Guest scans shop QR page -> records qr_visit, no stars/reviews
  const qrRes = await handleShopPhotoPerkRequest(
    new Request("https://zukan.earth/ja/shops/plc_shop_1/qr"),
    new URL("https://zukan.earth/ja/shops/plc_shop_1/qr"),
    env,
    null
  );
  assert.equal(qrRes?.status, 200);
  const qrHtml = await qrRes!.text();
  assert.match(qrHtml, /浜名湖カフェ/);
  assert.match(qrHtml, /100円引きクーポン/);
  assert.match(qrHtml, /特典つき投稿/);
  assert.ok(!/星|レビュー|口コミ|ランキング/.test(qrHtml));

  // 2. Guest requests shop pass cookie
  const passRes = await handleShopPhotoPerkRequest(
    new Request("https://zukan.earth/api/v1/shops/plc_shop_1/pass/issue", {
      method: "POST",
      headers: { origin: "https://zukan.earth" },
    }),
    new URL("https://zukan.earth/api/v1/shops/plc_shop_1/pass/issue"),
    env,
    null
  );
  assert.equal(passRes?.status, 201);
  const setCookieHeader = passRes!.headers.get("set-cookie") ?? "";
  const guestMatch = setCookieHeader.match(new RegExp(`${GUEST_PASS_COOKIE_NAME}=([^;]+)`));
  assert.ok(guestMatch?.[1]);
  const guestCookie = `${GUEST_PASS_COOKIE_NAME}=${guestMatch[1]}`;

  // 3. Inspection rejects EXIF GPS metadata WebP & records rejection metric
  const rejectedRes = await handleShopPhotoPerkRequest(
    new Request("https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk", {
      method: "POST",
      headers: { origin: "https://zukan.earth", "content-type": "application/json", cookie: guestCookie },
      body: JSON.stringify({ mimeType: "image/webp", filename: "gps.webp", base64Data: makeExifWebpBase64(), facePrivacy: "no_faces" }),
    }),
    new URL("https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk"),
    env,
    null
  );
  assert.equal(rejectedRes?.status, 422);
  const rejectedJson = await rejectedRes!.json() as { passed: boolean; reason: string };
  assert.equal(rejectedJson.passed, false);

  // 4. Valid clean image passes inspection -> creates ticket & publishes to place page
  const passedRes = await handleShopPhotoPerkRequest(
    new Request("https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk", {
      method: "POST",
      headers: { origin: "https://zukan.earth", "content-type": "application/json", cookie: guestCookie },
      body: JSON.stringify({ mimeType: "image/webp", filename: "clean.webp", base64Data: makeCleanWebpBase64(), facePrivacy: "no_faces" }),
    }),
    new URL("https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk"),
    env,
    null
  );
  assert.equal(passedRes?.status, 201);
  const passedJson = await passedRes!.json() as { perkPostId: string; ticketUrl: string; passed: boolean };
  assert.equal(passedJson.passed, true);

  // 5. Same guest pass / checkout cannot claim a second perk (1会計1回)
  const secondPostRes = await handleShopPhotoPerkRequest(
    new Request("https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk", {
      method: "POST",
      headers: { origin: "https://zukan.earth", "content-type": "application/json", cookie: guestCookie },
      body: JSON.stringify({ mimeType: "image/webp", filename: "clean2.webp", base64Data: makeCleanWebpBase64(), facePrivacy: "no_faces" }),
    }),
    new URL("https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk"),
    env,
    null
  );
  assert.equal(secondPostRes?.status, 409);

  // 6. Ticket screen renders thumbnail, shop name, moving clock, tear-off redeem button, one-tap save button
  const ticketRes = await handleShopPhotoPerkRequest(
    new Request(`https://zukan.earth${passedJson.ticketUrl}`, { headers: { cookie: guestCookie } }),
    new URL(`https://zukan.earth${passedJson.ticketUrl}`),
    env,
    null
  );
  assert.equal(ticketRes?.status, 200);
  const ticketHtml = await ticketRes!.text();
  assert.match(ticketHtml, /data-shop-ticket-clock/);
  assert.match(ticketHtml, /setInterval/);
  assert.match(ticketHtml, /浜名湖カフェ/);
  assert.match(ticketHtml, /100円引きクーポン/);
  assert.match(ticketHtml, /店員が押す/);
  assert.match(ticketHtml, /この写真を自分の記録に残す/);
  assert.match(ticketHtml, /\/photo-perk\/[^"]+\/image/);

  // 7. Clerk taps redeem once -> 200, second tap -> 409 already_redeemed
  const redeem1 = await handleShopPhotoPerkRequest(
    new Request(`https://zukan.earth/api/v1/shops/plc_shop_1/tickets/${passedJson.perkPostId}/redeem`, {
      method: "POST",
      headers: { origin: "https://zukan.earth", cookie: guestCookie },
    }),
    new URL(`https://zukan.earth/api/v1/shops/plc_shop_1/tickets/${passedJson.perkPostId}/redeem`),
    env,
    null
  );
  assert.equal(redeem1?.status, 200);
  const redeem2 = await handleShopPhotoPerkRequest(
    new Request(`https://zukan.earth/api/v1/shops/plc_shop_1/tickets/${passedJson.perkPostId}/redeem`, {
      method: "POST",
      headers: { origin: "https://zukan.earth", cookie: guestCookie },
    }),
    new URL(`https://zukan.earth/api/v1/shops/plc_shop_1/tickets/${passedJson.perkPostId}/redeem`),
    env,
    null
  );
  assert.equal(redeem2?.status, 409);

  // 8. Place page displays published photo with "特典つき投稿" disclosure & no ranking/reviews
  const sectionData = await loadShopPlacePerkSectionData(env, "plc_shop_1", steward);
  assert.ok(sectionData);
  assert.equal(sectionData.photos.length, 1);
  const sectionHtml = renderShopPlacePerkSectionHtml(sectionData);
  assert.match(sectionHtml, /特典つき投稿/);
  assert.match(sectionHtml, /1タップで下げる/);
  assert.ok(!/星|ランキング|順位|口コミ/.test(sectionHtml));

  // Verify place detail integration keeps default unchanged when empty
  const placeHtml = renderGlobalPlaceDetailPage({
    profile: {
      version: 1,
      placeRef: { kind: "registered_place", placeId: "plc_shop_1" },
      place: {
        name: "浜名湖カフェ",
        type: "other_named_area",
        localityLabel: "静岡県浜松市",
        description: null,
        representativeMedia: [],
        canonicalPlaceId: "plc_shop_1",
        aliases: [],
        multilingualNames: { ja: "浜名湖カフェ" },
        verificationStatus: "source_verified",
        officialStatus: "official",
      },
      summary: { recordCount: 0, contributorCount: null, firstRecordedAt: null, latestRecordedAt: null },
      facets: [],
      highlights: [],
      recentRecords: [],
      guide: null,
      memories: [],
      facilities: [],
      policy: {
        placeVisibility: "public",
        recordingPolicy: "check_rules",
        publicLocationMode: "place",
        contributionCtaMode: "check_rules",
        ruleSource: "official",
        ruleUrl: null,
        reason: "shop_pilot",
      },
      dataGaps: [],
      publication: { status: "published", suppressedSections: [], locationMode: "registered_place" },
      provenance: {
        generatedAt: "2026-11-27T00:00:00Z",
        profileVersion: "place_atlas_profile/v1",
        sources: ["place_registry"],
        sourceReferences: [],
      },
    },
    lang: "ja",
    shopPhotoPerkHtml: sectionHtml,
  });
  assert.match(placeHtml, /data-shop-photo-perks="1"/);
  assert.match(placeHtml, /特典つき投稿/);

  // 9. Signed-in user holding guest cookie taps "この写真を自分の記録に残す" -> creates own observation
  const saveRes = await handleShopPhotoPerkRequest(
    new Request(`https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk/${passedJson.perkPostId}/save-to-record`, {
      method: "POST",
      headers: { origin: "https://zukan.earth", cookie: guestCookie },
    }),
    new URL(`https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk/${passedJson.perkPostId}/save-to-record`),
    env,
    member
  );
  assert.equal(saveRes?.status, 201);
  const saveJson = await saveRes!.json() as { observationId: string; ownerUserId: string };
  assert.equal(saveJson.ownerUserId, "user_member_1");
  const obsRow = obsSqlite.prepare("SELECT owner_user_id FROM observations WHERE observation_id = ?").get(saveJson.observationId) as { owner_user_id: string } | undefined;
  assert.equal(obsRow?.owner_user_id, "user_member_1");

  // 10. Steward takedown removes from place page immediately
  const takedownRes = await handleShopPhotoPerkRequest(
    new Request(`https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk/${passedJson.perkPostId}/takedown`, {
      method: "POST",
      headers: { origin: "https://zukan.earth" },
    }),
    new URL(`https://zukan.earth/api/v1/shops/plc_shop_1/photo-perk/${passedJson.perkPostId}/takedown`),
    env,
    steward
  );
  assert.equal(takedownRes?.status, 200);
  const afterTakedown = await loadShopPlacePerkSectionData(env, "plc_shop_1", null);
  assert.equal(afterTakedown?.photos.length, 0);

  // 11. Steward checks metrics
  const metricsRes = await handleShopPhotoPerkRequest(
    new Request("https://zukan.earth/api/v1/shops/plc_shop_1/perk-metrics"),
    new URL("https://zukan.earth/api/v1/shops/plc_shop_1/perk-metrics"),
    env,
    steward
  );
  assert.equal(metricsRes?.status, 200);
  const metrics = await metricsRes!.json() as {
    qrVisits: number;
    submittedCount: number;
    passedCount: number;
    rejectedCount: number;
    redeemedCount: number;
    oneTapSavedCount: number;
    submissionRate: number;
    redemptionCount: number;
    rejectionRate: number;
    oneTapSaveRate: number;
  };
  assert.equal(metrics.qrVisits, 1);
  assert.equal(metrics.submittedCount, 2);
  assert.equal(metrics.passedCount, 1);
  assert.equal(metrics.rejectedCount, 1);
  assert.equal(metrics.redeemedCount, 1);
  assert.equal(metrics.oneTapSavedCount, 1);
  assert.equal(metrics.redemptionCount, 1);
  assert.equal(metrics.rejectionRate, 0.5);
  assert.equal(metrics.oneTapSaveRate, 1);
});
