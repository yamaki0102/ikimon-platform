import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  DiscoveryError, EventDiscoveryStore, discoveryHash, discoveryNickname, discoveryReceipt,
  isDiscoveryJournalConfig, isEventDiscoveryProfile, parseDiscoveryCaptureInput,
  parseDiscoveryPaperInput, parseDiscoveryReviewInput, type DiscoveryDatabase,
  type DiscoveryStatement, type DiscoveryCaptureInput,
} from "./eventDiscovery";

type Value = string | number | null;
class SqlStatement implements DiscoveryStatement {
  private values: Value[] = [];
  constructor(readonly owner: SqlDatabase, readonly query: string) {}
  bind(...values: Value[]) { this.values = values; return this; }
  async first<T>() { return (this.owner.native.prepare(this.query).get(...this.values) as T | undefined) ?? null; }
  async all<T>() { return { results: this.owner.native.prepare(this.query).all(...this.values) as T[] }; }
  execute() { const result = this.owner.native.prepare(this.query).run(...this.values); return { meta: { changes: Number(result.changes) } }; }
  async run() { return this.execute(); }
}
class SqlDatabase implements DiscoveryDatabase {
  readonly native = new DatabaseSync(":memory:");
  constructor() {
    this.native.exec("PRAGMA foreign_keys = ON");
    for (const migration of ["0019_observation_event_core.sql", "0071_observation_event_guest_media.sql", "0074_observation_event_discoveries.sql"]) {
      this.native.exec(readFileSync(new URL("../migrations/observations/" + migration, import.meta.url), "utf8"));
    }
  }
  prepare(query: string) { return new SqlStatement(this, query); }
  async batch(statements: DiscoveryStatement[]) {
    this.native.exec("BEGIN");
    try { const results = statements.map((statement) => (statement as SqlStatement).execute()); this.native.exec("COMMIT"); return results; }
    catch (error) { this.native.exec("ROLLBACK"); throw error; }
  }
}
class MemoryBucket {
  readonly objects = new Map<string, { bytes: ArrayBuffer; contentType: string }>();
  onGet: ((key: string) => Promise<void>) | null = null;
  async put(key: string, body: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }) {
    this.objects.set(key, { bytes: body.slice(0), contentType: options?.httpMetadata?.contentType ?? "" });
  }
  async get(key: string) {
    const saved = this.objects.get(key);
    const result = saved ? { body: new Response(saved.bytes.slice(0)).body, httpMetadata: { contentType: saved.contentType } } : null;
    if (this.onGet) await this.onGet(key);
    return result;
  }
  async head(key: string) {
    const saved = this.objects.get(key);
    return saved ? { size: saved.bytes.byteLength, httpMetadata: { contentType: saved.contentType } } : null;
  }
  async delete(key: string) { this.objects.delete(key); }
}
const WEBP = new Uint8Array([82,73,70,70,12,0,0,0,87,69,66,80,86,80,56,32,0,0,0,0]).buffer;
const APPROVAL = parseDiscoveryReviewInput({ decision: "approved", note: "写真と文章の権利、個人情報を確認しました。", rightsConfirmed: true, privacyConfirmed: true });
const CAPTURE: DiscoveryCaptureInput = { caption: "葉っぱに小さな発見", spotLabel: "木陰", galleryConsent: true, guardianGalleryConsent: false, isMinor: false };
function fixture() {
  const db = new SqlDatabase();
  const bucket = new MemoryBucket();
  const store = new EventDiscoveryStore(db, bucket);
  db.native.prepare("INSERT INTO observation_event_sessions (session_id, title, organizer_user_id, started_at) VALUES (?, ?, ?, ?)").run("event-a", "竜洋", "organizer-private-id", "2026-10-01");
  return { db, bucket, store };
}
function participant(db: SqlDatabase, id: string, nickname = "", isMinor = false) {
  db.native.prepare("INSERT INTO observation_event_participants (participant_id, session_id, display_name, guest_token, status, is_minor) VALUES (?, 'event-a', ?, ?, 'checked_in', ?)").run(id, nickname, "private-token-" + id, isMinor ? 1 : 0);
}
async function photoInput(participantId: string, key: string, capture: DiscoveryCaptureInput = CAPTURE) {
  const hash = await discoveryHash(key);
  const submissionId = "egm_" + hash.slice(0, 40);
  return {
    sessionId: "event-a", participantId, actorUserId: null, submissionId,
    assetKey: "private/event-guest-media/event-a/" + submissionId + "/original",
    requestSha256: await discoveryHash(JSON.stringify([key, capture])), mediaSha256: await discoveryHash(WEBP),
    bytes: WEBP.byteLength, idempotencyKey: "idempotency-" + key, capture,
  };
}
async function photo(state: ReturnType<typeof fixture>, participantId: string, key: string, capture = CAPTURE) {
  const input = await photoInput(participantId, key, capture);
  await state.store.reservePhoto(input);
  await state.bucket.put(input.assetKey, WEBP, { httpMetadata: { contentType: "image/webp" } });
  state.db.native.prepare("UPDATE observation_event_guest_media SET media_state = 'saved' WHERE submission_id = ?").run(input.submissionId);
  return input;
}
function count(db: SqlDatabase, table: string) {
  return Number((db.native.prepare("SELECT COUNT(*) AS count FROM " + table).get() as { count: number }).count);
}

test("discovery typed profile, optional nickname, explicit display and guardian consent", () => {
  const profile = { version: "event-discovery-v1", enabled: true, max_photos: 3, gallery: "unlisted" };
  assert.equal(isDiscoveryJournalConfig(profile), true);
  assert.equal(isDiscoveryJournalConfig({ ...profile, max_photos: 4 }), false);
  assert.equal(isDiscoveryJournalConfig({ ...profile, autoApprove: true }), false);
  assert.equal(isEventDiscoveryProfile({ discovery_journal: profile }), false);
  assert.equal(isEventDiscoveryProfile({ discovery_journal: profile, guest_media_enabled: true }), true);
  assert.equal(discoveryNickname(undefined), null);
  assert.equal(discoveryNickname(" \n "), null);
  assert.equal(discoveryNickname("さくら"), "さくら");
  assert.throws(() => discoveryNickname("a".repeat(33)), /nickname_invalid/);
  assert.throws(() => discoveryNickname("a\nb"), /nickname_invalid/);
  const form = new FormData();
  assert.deepEqual(parseDiscoveryCaptureInput(form, false), { ...CAPTURE, caption: null, spotLabel: null, galleryConsent: false });
  form.set("gallery_consent", "yes");
  assert.throws(() => parseDiscoveryCaptureInput(form, true), /guardian_gallery_consent_required/);
  form.set("guardian_gallery_consent", "yes");
  assert.equal(parseDiscoveryCaptureInput(form, true).guardianGalleryConsent, true);
  form.set("caption", "あ".repeat(281));
  assert.throws(() => parseDiscoveryCaptureInput(form, false), /caption_invalid/);
  assert.throws(() => parseDiscoveryReviewInput({ decision: "approved", note: "メタデータだけを確認しました", rightsConfirmed: true }), /rights_and_visual_privacy_confirmation_required/);
});

test("three-photo reservation is atomic across concurrent requests, retries and withdrawal", async () => {
  const state = fixture(); participant(state.db, "private-participant-a");
  const inputs = await Promise.all([1,2,3,4].map((id) => photoInput("private-participant-a", "concurrent-" + id)));
  const attempts = await Promise.allSettled(inputs.map((input) => state.store.reservePhoto(input)));
  assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 3);
  assert.equal(attempts.filter((result) => result.status === "rejected" && result.reason instanceof DiscoveryError && result.reason.message === "three_photo_limit").length, 1);
  assert.equal(count(state.db, "observation_event_guest_media"), 3);
  assert.equal(count(state.db, "observation_event_discoveries"), 3);
  const accepted = inputs.filter((_input, index) => attempts[index]?.status === "fulfilled");
  await state.store.reservePhoto(accepted[0]!);
  assert.equal(count(state.db, "observation_event_guest_media"), 3);
  state.db.native.prepare("UPDATE observation_event_guest_media SET media_state = 'failed' WHERE submission_id = ?").run(accepted[0]!.submissionId);
  await state.store.reservePhoto(accepted[0]!);
  await assert.rejects(state.store.reservePhoto(await photoInput("private-participant-a", "new-fourth")), /three_photo_limit/);
  await assert.rejects(state.store.reservePhoto({ ...accepted[0]!, requestSha256: "different" }), /idempotency_key_conflict/);
  state.db.native.prepare("UPDATE observation_event_guest_media SET rights_review_status = 'withdrawn' WHERE submission_id = ?").run(accepted[0]!.submissionId);
  await state.store.withdraw("event-a", accepted[0]!.submissionId);
  await state.store.reservePhoto(await photoInput("private-participant-a", "after-withdrawal"));
  assert.equal(count(state.db, "observation_event_guest_media"), 4, "source receipt retained");
  assert.equal((await state.store.privateReceipts("event-a", "private-participant-a")).receipts.length, 4);
});

test("only consented human-reviewed derivatives enter a journal; anonymous names never fall back to account identity", async () => {
  const state = fixture(); participant(state.db, "private-participant-a");
  const first = await photo(state, "private-participant-a", "blank-name");
  assert.deepEqual((await state.store.gallery("event-a")).journals, []);
  await assert.rejects(state.store.content("event-a", first.submissionId), /not_found/);
  const approved = await state.store.review("event-a", first.submissionId, "organizer-private-id", APPROVAL);
  assert.equal(approved.galleryStatus, "published");
  assert.equal(approved.receipt.privacyMethod, "metadata-scrub+organizer-visual/v1");
  const gallery = await state.store.gallery("event-a");
  assert.equal(gallery.journals[0]?.displayName, null);
  assert.equal(gallery.counts.entries, 1);
  assert.doesNotMatch(JSON.stringify(gallery), /private-participant|private-token|organizer-private-id|participant_id|idempotency|review_note|media_asset/);
  assert.deepEqual(await state.store.content("event-a", first.submissionId), WEBP);
  assert.equal(await state.store.get("another-event", first.submissionId), null);
  await assert.rejects(state.store.content("another-event", first.submissionId), /not_found/);
  const privatePhoto = await photo(state, "private-participant-a", "private-only", { ...CAPTURE, galleryConsent: false });
  await state.store.review("event-a", privatePhoto.submissionId, "organizer-private-id", APPROVAL);
  assert.equal((await state.store.gallery("event-a")).counts.entries, 1);
  assert.equal(await state.bucket.head(state.store.derivativeKey("event-a", privatePhoto.submissionId)), null);
  const selection = await state.store.review("event-a", first.submissionId, "organizer-private-id", { ...APPROVAL, selectionLabel: "小さな発見賞", selectionComment: "葉の裏までよく見ましたね。" });
  assert.equal(selection.receipt.selectionLabel, "小さな発見賞");
  assert.equal((await state.store.privateReceipts("event-a", null)).reviewQueue?.some((row) => row.receiptId === first.submissionId), true);
  assert.equal((await state.store.privateReceipts("event-a", "private-participant-a")).receipts[0]?.idempotencyKey?.startsWith("idempotency-"), true);
  assert.equal((await state.store.privateReceipts("event-a", "private-participant-a")).receipts.some((row) => "rightsReviewNote" in row), false, "organizer review notes stay out of participant receipts");
  assert.equal((await state.store.privateReceipts("event-a", null)).receipts.find((row) => row.receiptId === first.submissionId)?.rightsReviewNote, APPROVAL.note);
  assert.equal((await state.store.privateReceipts("event-a", null)).receipts.some((row) => "idempotencyKey" in row), false);
  state.db.native.prepare("UPDATE observation_event_participants SET display_name = 'あとで変えた名前' WHERE participant_id = ?").run("private-participant-a");
  assert.equal((await state.store.gallery("event-a")).counts.entries, 0, "nickname changes are not published under an earlier review");
  await assert.rejects(state.store.content("event-a", first.submissionId), /not_found/);
  await state.store.review("event-a", first.submissionId, "organizer-private-id", APPROVAL);
  assert.equal((await state.store.gallery("event-a")).journals[0]?.displayName, "あとで変えた名前");
  state.db.native.prepare("UPDATE observation_event_participants SET display_name = '' WHERE participant_id = ?").run("private-participant-a");
  assert.equal((await state.store.gallery("event-a")).counts.entries, 0, "clearing a nickname also removes the old displayed name immediately");
  await state.store.review("event-a", first.submissionId, "organizer-private-id", APPROVAL);
  assert.equal((await state.store.gallery("event-a")).journals[0]?.displayName, null);
  state.db.native.prepare("UPDATE observation_event_participants SET status = 'registered' WHERE participant_id = ?").run("private-participant-a");
  assert.equal((await state.store.gallery("event-a")).counts.entries, 0, "unrecognized/nonparticipating status cannot publish an earlier approval");
  await assert.rejects(state.store.content("event-a", first.submissionId), /not_found/);
  state.db.native.prepare("UPDATE observation_event_participants SET status = 'left' WHERE participant_id = ?").run("private-participant-a");
  assert.equal((await state.store.gallery("event-a")).counts.entries, 1, "a participant leaving normally retains explicitly consented memories");
  state.db.native.prepare("UPDATE observation_event_participants SET is_minor = 1 WHERE participant_id = ?").run("private-participant-a");
  assert.deepEqual((await state.store.gallery("event-a")).journals, [], "a newly marked minor still requires guardian display consent");
});

test("unknown/failed metadata, altered derivative and concurrent withdrawal never produce public content", async () => {
  const state = fixture(); participant(state.db, "p");
  const first = await photo(state, "p", "failure-case");
  await state.bucket.put(first.assetKey, new TextEncoder().encode("not a WebP").buffer, { httpMetadata: { contentType: "image/webp" } });
  await assert.rejects(state.store.review("event-a", first.submissionId, "organizer-private-id", APPROVAL), /image_privacy_metadata_verification_failed/);
  assert.equal((await state.store.get("event-a", first.submissionId))?.privacy_status, "pending");
  assert.equal((await state.store.gallery("event-a")).counts.entries, 0);
  await state.bucket.put(first.assetKey, WEBP, { httpMetadata: { contentType: "image/webp" } });
  await state.store.review("event-a", first.submissionId, "organizer-private-id", APPROVAL);
  await state.bucket.put(state.store.derivativeKey("event-a", first.submissionId), new TextEncoder().encode("tampered").buffer, { httpMetadata: { contentType: "image/webp" } });
  await assert.rejects(state.store.content("event-a", first.submissionId), /not_found/);
  await state.store.review("event-a", first.submissionId, "organizer-private-id", APPROVAL);
  state.bucket.onGet = async (key) => {
    if (!key.includes("event-discovery-derivatives")) return;
    state.bucket.onGet = null;
    state.db.native.prepare("UPDATE observation_event_guest_media SET rights_review_status = 'withdrawn' WHERE submission_id = ?").run(first.submissionId);
    await state.store.withdraw("event-a", first.submissionId);
  };
  await assert.rejects(state.store.content("event-a", first.submissionId), /not_found/);
  assert.equal((await state.store.gallery("event-a")).counts.entries, 0);
  assert.equal(discoveryReceipt((await state.store.get("event-a", first.submissionId))!).galleryStatus, "withdrawn");
});

test("paper transcription creates one bounded journal, preserves notes as text and replays without duplicate participants", async () => {
  const state = fixture();
  const input = parseDiscoveryPaperInput({
    nickname: "むし丸", notes: [{ caption: "<script>alert(1)</script>", spotLabel: "木陰" }, { caption: "足もとに気づいた" }, { spotLabel: "池のそば" }],
    isMinor: true, galleryConsent: true, guardianGalleryConsent: true, idempotencyKey: "paper-transcription-001",
  });
  const saved = await state.store.createPaper("event-a", "organizer-private-id", input);
  assert.equal(saved.entries.length, 3);
  assert.equal(new Set(saved.entries.map((entry) => entry.journalId)).size, 1);
  assert.equal((await state.store.gallery("event-a")).counts.entries, 0);
  assert.equal((await state.store.createPaper("event-a", "organizer-private-id", input)).replay, true);
  assert.equal(count(state.db, "observation_event_participants"), 1);
  await assert.rejects(state.store.createPaper("event-a", "organizer-private-id", { ...input, nickname: "変更" }), /idempotency_key_conflict/);
  for (const entry of saved.entries) await state.store.review("event-a", entry.receiptId, "organizer-private-id", APPROVAL);
  const gallery = await state.store.gallery("event-a");
  assert.equal(gallery.journals.length, 1);
  assert.equal(gallery.journals[0]?.displayName, "むし丸");
  assert.equal(gallery.journals[0]?.entries.length, 3);
  assert.equal(gallery.journals[0]?.entries.some((entry) => entry.caption === "<script>alert(1)</script>"), true, "API preserves text; renderer is responsible for escaping");
  assert.equal(gallery.journals[0]?.entries.some((entry) => "contentHref" in entry), false);
  await state.store.withdraw("event-a", saved.entries[0]!.receiptId);
  assert.equal((await state.store.gallery("event-a")).counts.entries, 2);
  assert.throws(() => parseDiscoveryPaperInput({ ...input, guardianGalleryConsent: false }), /guardian_gallery_consent_required/);
  assert.throws(() => parseDiscoveryPaperInput({ ...input, notes: [{ caption: "1" }, { caption: "2" }, { caption: "3" }, { caption: "4" }] }), /one_to_three_paper_notes_required/);
});

test("concurrent changed paper payloads cannot append notes from a rejected idempotency replay", async () => {
  const state = fixture();
  const one = parseDiscoveryPaperInput({ nickname: "一枚目", notes: [{ caption: "最初のメモ" }], galleryConsent: false, idempotencyKey: "paper-concurrent-conflict" });
  const three = parseDiscoveryPaperInput({ ...one, nickname: "別の呼び名", notes: [{ caption: "異なるメモ" }, { caption: "追加しない二枚目" }, { caption: "追加しない三枚目" }] });
  const results = await Promise.allSettled([
    state.store.createPaper("event-a", "organizer-private-id", one),
    state.store.createPaper("event-a", "organizer-private-id", three),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const accepted = results.find((result) => result.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<EventDiscoveryStore["createPaper"]>>>;
  const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
  assert.match(String(rejected.reason), /idempotency_key_conflict/);
  assert.equal(count(state.db, "observation_event_discoveries"), accepted.value.entries.length);
  assert.equal(count(state.db, "observation_event_participants"), 1);
  const hashes = state.db.native.prepare("SELECT DISTINCT source_request_sha256 FROM observation_event_discoveries").all();
  assert.equal(hashes.length, 1, "a conflicting retry cannot persist any of its notes");
});

test("105 participants with 315 photos paginate by complete journals and all private review pages remain reachable", async () => {
  const state = fixture();
  for (let person = 0; person < 105; person++) {
    const participantId = "internal-person-" + person;
    participant(state.db, participantId, "発見者" + person);
    for (let image = 0; image < 3; image++) {
      const saved = await photo(state, participantId, "page-" + person + "-" + image);
      await state.store.review("event-a", saved.submissionId, "organizer-private-id", APPROVAL);
    }
  }
  let cursor: string | null = null;
  const seen = new Set<string>();
  let pages = 0;
  do {
    const page = await state.store.gallery("event-a", cursor, 24);
    assert.equal(page.counts.journals, 105); assert.equal(page.counts.entries, 315);
    for (const journal of page.journals) { assert.equal(journal.entries.length, 3); assert.equal(seen.has(journal.journalId), false); seen.add(journal.journalId); }
    assert.doesNotMatch(JSON.stringify(page), /internal-person|private-token|participant_id|user_id/);
    cursor = page.nextCursor; pages++;
  } while (cursor && pages < 10);
  assert.equal(seen.size, 105); assert.equal(pages, 5);
  let reviewCursor: string | null = null; const reviewIds = new Set<string>();
  do {
    const page = await state.store.privateReceipts("event-a", null, reviewCursor, 90);
    for (const row of page.reviewQueue ?? []) reviewIds.add(row.receiptId);
    reviewCursor = page.nextCursor;
  } while (reviewCursor);
  assert.equal(reviewIds.size, 315);
  await assert.rejects(state.store.gallery("event-a", "some-participant-id"), /invalid_cursor/);
});

test("account claim enforces combined photo capacity atomically without losing sources or substituting identity", async () => {
  const state = fixture(); participant(state.db, "guest"); participant(state.db, "account");
  const a = await photo(state, "guest", "claim-a");
  await photo(state, "account", "claim-b");
  const merge = await state.store.participantClaimStatements("event-a", "guest", "account", "private-user-id");
  await state.db.batch([...merge, state.db.prepare("DELETE FROM observation_event_participants WHERE participant_id = 'guest'")]);
  assert.equal((await state.store.get("event-a", a.submissionId))?.participant_id, "account");
  assert.equal((await state.store.get("event-a", a.submissionId))?.participant_display_name, "");
  assert.equal(count(state.db, "observation_event_guest_media"), 2);

  const blocked = fixture(); participant(blocked.db, "guest"); participant(blocked.db, "account");
  await photo(blocked, "guest", "guest-1"); await photo(blocked, "account", "account-1");
  const beforeRace = await blocked.store.participantClaimStatements("event-a", "guest", "account", "private-user-id");
  await photo(blocked, "guest", "guest-2"); await photo(blocked, "account", "account-2");
  await assert.rejects(blocked.db.batch([...beforeRace, blocked.db.prepare("DELETE FROM observation_event_participants WHERE participant_id = 'guest'")]), /FOREIGN KEY/);
  assert.equal(count(blocked.db, "observation_event_participants"), 2);
  assert.equal(count(blocked.db, "observation_event_guest_media"), 4);
  assert.equal((await blocked.store.privateReceipts("event-a", "guest")).receipts.length, 2);
  await assert.rejects(blocked.store.participantClaimStatements("event-a", "guest", "account", "private-user-id"), /discovery_claim_photo_limit/);
});
