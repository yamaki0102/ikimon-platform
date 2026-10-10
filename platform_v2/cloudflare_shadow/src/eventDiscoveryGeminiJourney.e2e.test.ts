import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { RYUYO_FIELD_ID } from "./areaEncyclopediaNative";
import { inspectPublicDerivativeMetadata } from "./publicDerivativeMetadata";
import { worker } from "./index";

const ORIGIN = "https://ikimon.life";
const SESSION_ID = "ryuyo-gemini-local-e2e";
const EVENT_CODE = "RYUYOE2E";
const NOTICE_VERSION = "ryuyo-gemini-screening-publish-v1";
const CLEAN_WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x0c, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
  0x00, 0x00, 0x00, 0x00,
]);
const EXIF_MARKER = new TextEncoder().encode("Exif\0\0GPSLatitude\0GPSLongitude\0");

function syntheticGpsJpeg(): Uint8Array {
  const app1Length = EXIF_MARKER.byteLength + 2;
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xe1, app1Length >> 8, app1Length & 0xff,
    ...EXIF_MARKER, 0xff, 0xd9,
  ]);
}

class SqliteD1Statement {
  private values: Array<string | number | null> = [];
  constructor(private readonly database: SqliteD1, private readonly sql: string) {}
  bind(...values: Array<string | number | null>) { this.values = values; return this; }
  async first<T>() {
    return (this.database.sqlite.prepare(this.sql).get(...this.values) as T | undefined) ?? null;
  }
  async all<T>() {
    return { success: true, results: this.database.sqlite.prepare(this.sql).all(...this.values) as T[] };
  }
  async raw<T>() {
    return this.database.sqlite.prepare(this.sql).all(...this.values).map((row) => Object.values(row as Record<string, unknown>)) as T[];
  }
  async run() {
    const result = this.database.sqlite.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
}

class SqliteD1 {
  readonly sqlite = new DatabaseSync(":memory:");
  prepare(sql: string) { return new SqliteD1Statement(this, sql); }
  async batch(statements: SqliteD1Statement[]) {
    this.sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

class MemoryBucket {
  readonly objects = new Map<string, { bytes: ArrayBuffer; contentType: string; cacheControl: string }>();
  async put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }) {
    const bytes = value instanceof ArrayBuffer
      ? value.slice(0)
      : await new Response(value as BodyInit).arrayBuffer();
    this.objects.set(key, {
      bytes,
      contentType: options?.httpMetadata?.contentType ?? "",
      cacheControl: options?.httpMetadata?.cacheControl ?? "",
    });
  }
  async get(key: string) {
    const saved = this.objects.get(key);
    return saved ? {
      body: new Response(saved.bytes.slice(0)).body,
      httpMetadata: { contentType: saved.contentType, cacheControl: saved.cacheControl },
    } : null;
  }
  async head(key: string) {
    const saved = this.objects.get(key);
    return saved ? { size: saved.bytes.byteLength, httpMetadata: { contentType: saved.contentType, cacheControl: saved.cacheControl } } : null;
  }
  async delete(key: string) { this.objects.delete(key); }
}

function localImagesBinding(calls: Array<{ input: ArrayBuffer; transform: Record<string, unknown>; output: Record<string, unknown> }>) {
  return {
    input(stream: ReadableStream | ArrayBuffer) {
      let source: ArrayBuffer | null = stream instanceof ArrayBuffer ? stream.slice(0) : null;
      let transformOptions: Record<string, unknown> = {};
      const handle = {
        transform(options: Record<string, unknown>) { transformOptions = options; return handle; },
        async output(options: Record<string, unknown>) {
          if (!source) source = await new Response(stream as ReadableStream).arrayBuffer();
          calls.push({ input: source, transform: transformOptions, output: options });
          return { response: () => new Response(CLEAN_WEBP.slice(), { status: 200, headers: { "content-type": "image/webp" } }) };
        },
      };
      return handle;
    },
  };
}

test("Ryuyo check-in consent drives safe auto-publication, uncertain hold, guardian/share safeguards, EXIF scrubbing and withdrawal", async (t) => {
  const observations = new SqliteD1();
  const core = new SqliteD1();
  const bucket = new MemoryBucket();
  const imageCalls: Array<{ input: ArrayBuffer; transform: Record<string, unknown>; output: Record<string, unknown> }> = [];
  const migrations = [
    "0019_observation_event_core.sql",
    "0020_observation_event_rally.sql",
    "0029_observation_event_recap_capsule_report.sql",
    "0065_observation_rally_submission_idempotency.sql",
    "0071_observation_event_guest_media.sql",
    "0074_observation_event_discoveries.sql",
    "0075_observation_event_discovery_gemini_notice.sql",
  ];
  observations.sqlite.exec("PRAGMA foreign_keys = ON");
  for (const migration of migrations) {
    observations.sqlite.exec(readFileSync(new URL(`../migrations/observations/${migration}`, import.meta.url), "utf8"));
  }
  const now = Date.now();
  const config = {
    guest_media_enabled: true,
    discovery_journal: { version: "event-discovery-v1", enabled: true, max_photos: 3, gallery: "unlisted" },
    event_template: { contract_version: "event-template-v1", key: "ryuyo" },
  };
  observations.sqlite.prepare(`
    INSERT INTO observation_event_sessions
      (session_id, event_code, title, organizer_user_id, plan, started_at, ended_at, config_json, field_id)
    VALUES (?, ?, ?, ?, 'public', ?, ?, ?, ?)
  `).run(SESSION_ID, EVENT_CODE, "竜洋の発見さんぽ（合成テスト）", "synthetic-organizer", new Date(now - 60_000).toISOString(), new Date(now + 3_600_000).toISOString(), JSON.stringify(config), RYUYO_FIELD_ID);
  observations.sqlite.prepare(`
    INSERT INTO observation_rally_courses (course_id, session_id, title, status, config_json)
    VALUES (?, ?, ?, 'live', '{}')
  `).run("ryuyo-gemini-local-course", SESSION_ID, "合成テスト");

  const env = {
    CORE_DB: core,
    OBS_DB: observations,
    ASSET_BUCKET: bucket,
    IMAGES: localImagesBinding(imageCalls),
    ENVIRONMENT: "shadow",
    GEMINI_API_KEY: "synthetic-local-test-key-only",
    PUBLIC_LOCATION_CELL_PRECISION: "geohash6",
  };
  t.after(() => { observations.sqlite.close(); core.sqlite.close(); });

  let screeningCalls = 0;
  const fetchMock = t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const target = String(input);
    assert.match(target, /^https:\/\/generativelanguage\.googleapis\.com\//u, "the test intercepts every provider request locally");
    assert.equal(init?.method, "POST");
    const request = JSON.parse(String(init?.body));
    const image = request.contents[0].parts[0].inlineData;
    assert.equal(image.mimeType, "image/webp");
    const screenedBytes = Buffer.from(image.data, "base64");
    assert.equal(screenedBytes.includes(Buffer.from("GPSLatitude")), false, "raw GPS/EXIF never reaches screening");
    const publicationText = JSON.parse(request.contents[0].parts[1].text).publicationText as string;
    screeningCalls++;
    const flags = publicationText.includes("uncertain")
      ? { person: false, personal_information: false, sensitive_content: false, uncertain: true }
      : { person: false, personal_information: false, sensitive_content: false, uncertain: false };
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(flags) }] }, finishReason: "STOP" }] });
  });

  const request = async (path: string, method = "GET", cookie = "", body?: unknown, idempotencyKey?: string) => {
    const headers = new Headers();
    if (cookie) headers.set("cookie", cookie);
    if (method !== "GET") headers.set("origin", ORIGIN);
    if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
    if (body instanceof FormData) {
      // Let Request create the multipart boundary.
    } else if (body !== undefined) {
      headers.set("content-type", "application/json");
    }
    const response = await worker.fetch(new Request(ORIGIN + path, {
      method,
      headers,
      ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    }), env as never);
    return { response, data: await response.clone().json().catch(() => null) as any };
  };

  async function joinAndCheckIn(isMinor = false) {
    const join = await request(`/community/events/${EVENT_CODE}/join`);
    assert.equal(join.response.status, 200);
    const html = await join.response.text();
    assert.match(html, /Google Gemini/u);
    assert.match(html, /リンクを知っている人が見られる/u);
    assert.match(html, /主催者の個別確認前/u);
    const noticeVersion = html.match(/data-discovery-gemini-consent-version="([^"]+)"/u)?.[1];
    assert.equal(noticeVersion, NOTICE_VERSION, "the participant sees the version later recorded by check-in");
    const cookie = (join.response.headers.get("set-cookie") ?? "").split(";", 1)[0]!;
    assert.match(cookie, /^__Host-ikimon_evt_[a-f0-9]{16}=/u);
    const api = `/api/v1/observation-events/${SESSION_ID}/checkin`;
    assert.equal((await request(api, "POST", cookie, { display_name: "", is_minor: isMinor, share_location: true })).response.status, 400, "participation without the notice is rejected");
    assert.equal((await request(api, "POST", cookie, { display_name: "", is_minor: isMinor, discovery_gemini_notice_version: "wrong-version" })).response.status, 400, "a guessed version is not consent");
    const accepted = await request(api, "POST", cookie, {
      display_name: "", is_minor: isMinor, share_location: true,
      guardian_location_consent: false, discovery_gemini_notice_version: noticeVersion,
    });
    assert.equal(accepted.response.status, 200, JSON.stringify(accepted.data));
    const participant = observations.sqlite.prepare(`
      SELECT participant_id, share_location, is_minor, discovery_gemini_notice_version, discovery_gemini_notice_at
        FROM observation_event_participants WHERE session_id = ? AND guest_token IS NOT NULL ORDER BY created_at DESC LIMIT 1
    `).get(SESSION_ID) as Record<string, unknown>;
    assert.equal(participant.discovery_gemini_notice_version, NOTICE_VERSION);
    assert.equal(typeof participant.discovery_gemini_notice_at, "string");
    assert.equal(participant.share_location, 0, "the discovery flow never stores participant tracking location");
    return cookie;
  }

  const originalJpeg = syntheticGpsJpeg();
  assert.equal(Buffer.from(originalJpeg).includes(Buffer.from("GPSLatitude")), true, "the fixture starts with a GPS-bearing source image");
  const upload = async (cookie: string, key: string, caption: string, options: { galleryConsent?: boolean; guardianGalleryConsent?: boolean } = {}) => {
    const form = new FormData();
    const jpegArrayBuffer = new ArrayBuffer(originalJpeg.byteLength);
    new Uint8Array(jpegArrayBuffer).set(originalJpeg);
    form.set("media", new File([jpegArrayBuffer], `${key}.jpg`, { type: "image/jpeg" }));
    form.set("private_storage_consent", "yes");
    form.set("creator_rights_attestation", "yes");
    form.set("gallery_consent", options.galleryConsent === false ? "no" : "yes");
    if (options.guardianGalleryConsent) form.set("guardian_gallery_consent", "yes");
    form.set("caption", caption);
    form.set("spot_label", "木陰");
    return request(`/api/v1/observation-events/${SESSION_ID}/guest-media`, "POST", cookie, form, key);
  };

  const adultCookie = await joinAndCheckIn();
  const safe = await upload(adultCookie, "local-e2e-safe-photo-0001", "clear leaf photo");
  assert.equal(safe.response.status, 201, JSON.stringify(safe.data));
  assert.equal(safe.data.receipt.galleryStatus, "published", "a clear photo is published by the automatic screen");
  assert.equal(safe.data.receipt.privacyMethod, "metadata-scrub+gemini-privacy/v1");
  const safeRow = observations.sqlite.prepare("SELECT reviewed_by, rights_review_status FROM observation_event_discoveries d JOIN observation_event_guest_media m ON m.submission_id = d.submission_id WHERE d.entry_id = ?").get(safe.data.receipt.receiptId) as Record<string, unknown>;
  assert.equal(safeRow.reviewed_by, "system:event-discovery-privacy", "no organizer review is required for a clear photo");
  assert.equal(safeRow.rights_review_status, "approved");
  assert.equal(screeningCalls, 1);
  assert.equal(imageCalls.length, 1);
  assert.deepEqual(imageCalls[0]!.transform, { width: 1600 });
  assert.deepEqual(imageCalls[0]!.output, { format: "image/webp", quality: 82, anim: false });
  assert.equal(Buffer.from(imageCalls[0]!.input).includes(Buffer.from("GPSLatitude")), true);
  const cleanInspection = inspectPublicDerivativeMetadata(CLEAN_WEBP.slice().buffer, "image/webp");
  assert.equal(cleanInspection.exifPresent, false);
  assert.equal(cleanInspection.gpsExifPresent, false);
  const safeContentPath = `/api/v1/observation-events/${SESSION_ID}/discoveries/${safe.data.receipt.receiptId}/content`;
  const safeContent = await request(safeContentPath);
  assert.equal(safeContent.response.status, 200);
  assert.equal(Buffer.from(await safeContent.response.arrayBuffer()).includes(Buffer.from("GPSLatitude")), false);

  const privateOnly = await upload(adultCookie, "local-e2e-private-photo-0002", "participant keeps this private", { galleryConsent: false });
  assert.equal(privateOnly.response.status, 201);
  assert.equal(privateOnly.data.receipt.galleryStatus, "private");
  assert.equal(screeningCalls, 1, "private-only media is neither scanned nor published");

  const minorCookie = await joinAndCheckIn(true);
  const missingGuardian = await upload(minorCookie, "local-e2e-minor-blocked-0003", "guardian consent required");
  assert.equal(missingGuardian.response.status, 400);
  assert.equal(screeningCalls, 1, "a minor's photo is not screened or shared without guardian consent");
  const guardianApproved = await upload(minorCookie, "local-e2e-minor-approved-0004", "clear family discovery", { guardianGalleryConsent: true });
  assert.equal(guardianApproved.response.status, 201, JSON.stringify(guardianApproved.data));
  assert.equal(guardianApproved.data.receipt.galleryStatus, "published");
  assert.equal(screeningCalls, 2);

  const uncertain = await upload(adultCookie, "local-e2e-uncertain-photo-0005", "uncertain photo");
  assert.equal(uncertain.response.status, 201, JSON.stringify(uncertain.data));
  assert.equal(uncertain.data.receipt.galleryStatus, "pending_review");
  assert.equal(uncertain.data.receipt.reviewRequiredReason, "uncertain");
  assert.equal(screeningCalls, 3);
  const gallery = await request(`/api/v1/observation-events/${SESSION_ID}/discoveries`);
  assert.equal(gallery.response.status, 200);
  assert.equal(gallery.data.counts.entries, 2, "only the clear, consented photos enter the public projection");
  assert.equal(gallery.data.journals.flatMap((journal: any) => journal.entries).some((entry: any) => entry.id === uncertain.data.receipt.receiptId), false);
  assert.equal((await request(`/api/v1/observation-events/${SESSION_ID}/discoveries/${uncertain.data.receipt.receiptId}/content`)).response.status, 404);
  assert.equal((await request(uncertain.data.receipt.privateContentHref, "GET", adultCookie)).response.status, 200, "uncertain media remains available privately to its participant");

  const withdrawn = await request(`/api/v1/observation-events/${SESSION_ID}/guest-media/${safe.data.receipt.receiptId}/withdraw`, "POST", adultCookie, {});
  assert.equal(withdrawn.response.status, 200, JSON.stringify(withdrawn.data));
  assert.equal(withdrawn.data.rightsReviewStatus, "withdrawn");
  assert.equal((await request(safeContentPath)).response.status, 404, "withdrawal removes public access to the derivative");
  const afterWithdrawal = await request(`/api/v1/observation-events/${SESSION_ID}/discoveries`);
  assert.equal(afterWithdrawal.data.counts.entries, 1);
  assert.equal(afterWithdrawal.data.journals.flatMap((journal: any) => journal.entries).some((entry: any) => entry.id === safe.data.receipt.receiptId), false);
  assert.equal(bucket.objects.size, 4, "withdrawal deletes only the withdrawn photo and its derivative");
  assert.equal(fetchMock.mock.callCount(), screeningCalls, "all screening requests were intercepted; no network request escaped");
});
