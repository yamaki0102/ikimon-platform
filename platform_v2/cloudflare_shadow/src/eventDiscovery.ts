import { inspectPublicDerivativeMetadata } from "./publicDerivativeMetadata";
import { containsDiscoveryPersonalInformation, DISCOVERY_AUTO_PRIVACY_METHOD, type DiscoveryPrivacyResult } from "./eventDiscoveryPrivacy";

export const EVENT_DISCOVERY_VERSION = "event-discovery-v1";
export const EVENT_DISCOVERY_MAX_PHOTOS = 3;
export const EVENT_DISCOVERY_PRIVACY_METHOD = "metadata-scrub+organizer-visual/v1";
export const RYUYO_DISCOVERY_GEMINI_NOTICE_VERSION = "ryuyo-gemini-screening-publish-v1";

type Value = string | number | null;
export interface DiscoveryStatement {
  bind(...values: Value[]): DiscoveryStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface DiscoveryDatabase {
  prepare(query: string): DiscoveryStatement;
  batch(statements: DiscoveryStatement[]): Promise<unknown[]>;
}
export interface DiscoveryBucket {
  put(key: string, body: ArrayBuffer, options?: { httpMetadata?: { contentType?: string; cacheControl?: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream | null; httpMetadata?: { contentType?: string } } | null>;
  head(key: string): Promise<{ size?: number; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string): Promise<unknown>;
}

export class DiscoveryError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function isDiscoveryJournalConfig(value: unknown): boolean {
  const config = object(value);
  return config?.version === EVENT_DISCOVERY_VERSION && config.enabled === true
    && config.max_photos === EVENT_DISCOVERY_MAX_PHOTOS && config.gallery === "unlisted"
    && Object.keys(config).every((key) => ["version", "enabled", "max_photos", "gallery"].includes(key));
}

export function isEventDiscoveryProfile(config: Record<string, unknown>): boolean {
  return config.guest_media_enabled === true && isDiscoveryJournalConfig(config.discovery_journal);
}

export function discoveryText(value: unknown, limit: number, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new DiscoveryError(400, field + "_invalid");
  const text = value.trim();
  if (Array.from(text).length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) {
    throw new DiscoveryError(400, field + "_invalid");
  }
  return text || null;
}

export function discoveryNickname(value: unknown): string | null {
  const nickname = discoveryText(value, 32, "nickname");
  if (nickname && /[\r\n\t]/u.test(nickname)) throw new DiscoveryError(400, "nickname_invalid");
  return nickname;
}

export function discoveryIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || value.length < 16 || value.length > 128 || !/^[a-zA-Z0-9._:-]+$/u.test(value)) {
    throw new DiscoveryError(400, "valid_idempotency_key_required");
  }
  return value;
}

export interface DiscoveryCaptureInput {
  caption: string | null;
  spotLabel: string | null;
  galleryConsent: boolean;
  guardianGalleryConsent: boolean;
  isMinor: boolean;
}

export function parseDiscoveryCaptureInput(form: Pick<FormData, "get">, isMinor: boolean): DiscoveryCaptureInput {
  const input = {
    caption: discoveryText(form.get("caption"), 280, "caption"),
    spotLabel: discoveryText(form.get("spot_label"), 80, "spot_label"),
    galleryConsent: form.get("gallery_consent") === "yes",
    guardianGalleryConsent: form.get("guardian_gallery_consent") === "yes",
    isMinor,
  };
  if (input.galleryConsent && input.isMinor && !input.guardianGalleryConsent) {
    throw new DiscoveryError(400, "guardian_gallery_consent_required");
  }
  return input;
}

export interface DiscoveryPaperInput {
  nickname: string | null;
  notes: Array<{ caption: string | null; spotLabel: string | null }>;
  isMinor: boolean;
  galleryConsent: boolean;
  guardianGalleryConsent: boolean;
  idempotencyKey: string;
}

export function parseDiscoveryPaperInput(body: Record<string, unknown>): DiscoveryPaperInput {
  if (!Array.isArray(body.notes) || body.notes.length < 1 || body.notes.length > 3) throw new DiscoveryError(400, "one_to_three_paper_notes_required");
  const notes = body.notes.map((value) => {
    const note = object(value);
    if (!note) throw new DiscoveryError(400, "paper_note_invalid");
    const caption = discoveryText(note.caption, 280, "caption");
    const spotLabel = discoveryText(note.spotLabel, 80, "spot_label");
    if (!caption && !spotLabel) throw new DiscoveryError(400, "paper_note_empty");
    return { caption, spotLabel };
  });
  const input = {
    nickname: discoveryNickname(body.nickname), notes,
    isMinor: body.isMinor === true, galleryConsent: body.galleryConsent === true,
    guardianGalleryConsent: body.guardianGalleryConsent === true,
    idempotencyKey: discoveryIdempotencyKey(body.idempotencyKey),
  };
  if (input.galleryConsent && input.isMinor && !input.guardianGalleryConsent) throw new DiscoveryError(400, "guardian_gallery_consent_required");
  return input;
}

export interface DiscoveryReviewInput {
  decision: "approved" | "rejected";
  note: string;
  selectionLabel: string | null;
  selectionComment: string | null;
}

export function parseDiscoveryReviewInput(body: Record<string, unknown>): DiscoveryReviewInput {
  if (body.decision !== "approved" && body.decision !== "rejected") throw new DiscoveryError(400, "review_decision_required");
  const note = discoveryText(body.note, 500, "review_note");
  if (!note || note.length < 8) throw new DiscoveryError(400, "decision_and_review_note_required");
  if (body.decision === "approved" && (body.rightsConfirmed !== true || body.privacyConfirmed !== true)) {
    throw new DiscoveryError(400, "rights_and_visual_privacy_confirmation_required");
  }
  return {
    decision: body.decision, note,
    selectionLabel: discoveryText(body.selectionLabel, 40, "selection_label"),
    selectionComment: discoveryText(body.selectionComment, 280, "selection_comment"),
  };
}

export async function discoveryHash(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function discoveryJournalId(sessionId: string, participantId: string): Promise<string> {
  return "dj_" + (await discoveryHash(JSON.stringify(["event-discovery-journal-v1", sessionId, participantId]))).slice(0, 40);
}

export interface DiscoveryEntryRow {
  entry_id: string; journal_id: string; session_id: string; participant_id: string; submission_id: string | null;
  entry_kind: "photo" | "paper"; caption: string | null; spot_label: string | null; is_minor: number;
  gallery_consent_at: string | null; guardian_gallery_consent_at: string | null; idempotency_key: string;
  source_request_sha256: string; source_media_sha256: string | null;
  privacy_status: "pending" | "verified" | "rejected"; privacy_method: string | null; privacy_verified_at: string | null;
  participant_gemini_notice_version: string | null; participant_gemini_notice_at: string | null;
  derivative_key: string | null; derivative_sha256: string | null; derivative_verified_at: string | null;
  review_status: "pending" | "approved" | "rejected" | "withdrawn"; reviewed_by: string | null; reviewed_at: string | null; review_note: string | null; reviewed_display_name: string | null;
  selection_label: string | null; selection_comment: string | null; withdrawn_at: string | null; created_at: string; updated_at: string;
  participant_display_name: string | null; participant_is_minor: number; participant_status: string;
  media_state: "uploading" | "saved" | "failed" | null; media_rights_status: string | null;
  media_sha256: string | null; media_asset_key: string | null; media_mime: string | null; media_bytes: number | null;
  media_participant_id: string | null; media_session_id: string | null; private_delete_pending: number | null;
}

const SELECT_ENTRY = [
  "SELECT d.*, p.display_name AS participant_display_name, p.is_minor AS participant_is_minor, p.status AS participant_status,",
  "p.discovery_gemini_notice_version AS participant_gemini_notice_version, p.discovery_gemini_notice_at AS participant_gemini_notice_at,",
  "m.media_state, m.rights_review_status AS media_rights_status, m.media_sha256, m.asset_key AS media_asset_key,",
  "m.mime AS media_mime, m.bytes AS media_bytes, m.participant_id AS media_participant_id, m.session_id AS media_session_id, m.private_delete_pending",
  "FROM observation_event_discoveries d",
  "JOIN observation_event_participants p ON p.participant_id = d.participant_id AND p.session_id = d.session_id",
  "LEFT JOIN observation_event_guest_media m ON m.submission_id = d.submission_id",
].join(" ");

const ELIGIBLE_SQL = [
  "d.withdrawn_at IS NULL AND d.review_status = 'approved' AND d.privacy_status = 'verified'",
  "AND d.privacy_verified_at IS NOT NULL AND d.gallery_consent_at IS NOT NULL",
  // reviewed_display_name is the sanitized snapshot generated at approval.
  // NULL is a valid anonymous publication. Named approvals must still match
  // their approved source name; never re-screen that name with SQL patterns.
  "AND (d.reviewed_display_name IS NULL OR d.reviewed_display_name = NULLIF(TRIM(p.display_name), ''))",
  `AND (d.privacy_method IS NULL OR d.privacy_method <> '${DISCOVERY_AUTO_PRIVACY_METHOD}' OR (p.discovery_gemini_notice_version = '${RYUYO_DISCOVERY_GEMINI_NOTICE_VERSION}' AND p.discovery_gemini_notice_at IS NOT NULL))`,
  "AND p.status IN ('checked_in', 'offline', 'left')",
  "AND ((d.is_minor = 0 AND p.is_minor = 0) OR d.guardian_gallery_consent_at IS NOT NULL)",
  "AND (d.entry_kind = 'paper' OR (m.media_state = 'saved' AND m.rights_review_status = 'approved'",
  "AND m.private_delete_pending = 0 AND m.session_id = d.session_id AND m.participant_id = d.participant_id",
  "AND m.media_sha256 = d.source_media_sha256 AND d.derivative_key IS NOT NULL",
  "AND d.derivative_sha256 IS NOT NULL AND d.derivative_verified_at IS NOT NULL))",
].join(" ");

export function isDiscoveryEntryEligible(row: DiscoveryEntryRow): boolean {
  if (row.withdrawn_at || row.review_status !== "approved" || row.privacy_status !== "verified"
    || !row.privacy_verified_at || !row.gallery_consent_at
    || row.reviewed_display_name === ""
    || (row.reviewed_display_name !== null && row.reviewed_display_name !== (row.participant_display_name?.trim() || null))
    || !["checked_in", "offline", "left"].includes(row.participant_status)
    || (row.privacy_method === DISCOVERY_AUTO_PRIVACY_METHOD && (row.participant_gemini_notice_version !== RYUYO_DISCOVERY_GEMINI_NOTICE_VERSION || !row.participant_gemini_notice_at))
    || ((row.is_minor === 1 || row.participant_is_minor === 1) && !row.guardian_gallery_consent_at)) return false;
  return row.entry_kind === "paper" || Boolean(row.media_state === "saved" && row.media_rights_status === "approved"
    && row.private_delete_pending === 0 && row.media_session_id === row.session_id && row.media_participant_id === row.participant_id
    && row.media_sha256 === row.source_media_sha256 && row.derivative_key && row.derivative_sha256 && row.derivative_verified_at);
}

function discoveryPublicNickname(value: string | null | undefined): string | null {
  const nickname = value?.trim() || null;
  return nickname && !containsDiscoveryPersonalInformation(nickname) ? nickname : null;
}

function galleryStatus(row: DiscoveryEntryRow): "private" | "pending_review" | "published" | "withdrawn" {
  if (row.withdrawn_at || row.review_status === "withdrawn" || row.media_rights_status === "withdrawn") return "withdrawn";
  if (!row.gallery_consent_at || row.review_status === "rejected") return "private";
  return isDiscoveryEntryEligible(row) ? "published" : "pending_review";
}

export function discoveryReceipt(row: DiscoveryEntryRow, includeOwnKey = false) {
  const withdrawn = galleryStatus(row) === "withdrawn";
  return {
    receiptId: row.entry_id, journalId: row.journal_id, kind: row.entry_kind,
    caption: row.caption, spotLabel: row.spot_label, displayName: row.participant_display_name?.trim() || null,
    galleryConsent: Boolean(row.gallery_consent_at), guardianGalleryConsent: Boolean(row.guardian_gallery_consent_at),
    isMinor: row.is_minor === 1 || row.participant_is_minor === 1,
    mediaState: row.entry_kind === "paper" ? "saved" : row.media_state, mediaType: row.media_mime,
    rightsReviewStatus: withdrawn ? "withdrawn" : row.review_status, privacyStatus: row.privacy_status,
    privacyMethod: row.privacy_method, galleryStatus: galleryStatus(row), visibility: "private" as const,
    reviewRequiredReason: row.review_status === "pending" && row.privacy_method === DISCOVERY_AUTO_PRIVACY_METHOD ? row.review_note : null,
    createdAt: row.created_at, updatedAt: row.updated_at, cleanupPending: row.private_delete_pending === 1,
    selectionLabel: row.selection_label, selectionComment: row.selection_comment,
    ...(includeOwnKey ? { idempotencyKey: row.idempotency_key } : {}),
    ...(!includeOwnKey ? { rightsReviewNote: row.review_note } : {}),
    ...(row.entry_kind === "photo" && !withdrawn ? { privateContentHref: "/api/v1/observation-events/" + encodeURIComponent(row.session_id) + "/guest-media/" + encodeURIComponent(row.entry_id) + "/content" } : {}),
  };
}

function safeCursor(value: string | null | undefined, kind: "entry" | "journal"): string {
  if (!value) return "";
  if (!(kind === "journal" ? /^dj_[a-f0-9]{40}$/u : /^(?:egm|edp)_[a-f0-9]{40}$/u).test(value)) throw new DiscoveryError(400, "invalid_cursor");
  return value;
}

function pageLimit(value: number | undefined, defaultValue: number, max: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(max, Math.trunc(value!))) : defaultValue;
}

export class EventDiscoveryStore {
  constructor(private readonly db: DiscoveryDatabase, private readonly bucket: DiscoveryBucket) {}

  async get(sessionId: string, entryId: string): Promise<DiscoveryEntryRow | null> {
    return this.db.prepare(SELECT_ENTRY + " WHERE d.session_id = ? AND d.entry_id = ?").bind(sessionId, entryId).first<DiscoveryEntryRow>();
  }

  async reservePhoto(input: {
    sessionId: string; participantId: string; actorUserId: string | null; submissionId: string; assetKey: string;
    requestSha256: string; mediaSha256: string; bytes: number; idempotencyKey: string; capture: DiscoveryCaptureInput;
  }): Promise<void> {
    const journalId = await discoveryJournalId(input.sessionId, input.participantId);
    const c = input.capture;
    // The count and insertion are ONE SQLite statement. All reserved, saved and
    // failed-but-retryable contributions consume a slot until explicitly withdrawn.
    // D1 batch commits the source reservation and publication sidecar atomically.
    await this.db.batch([
      this.db.prepare([
        "INSERT OR IGNORE INTO observation_event_guest_media",
        "(submission_id, session_id, participant_id, actor_user_id, asset_key, request_sha256, media_sha256, mime, bytes, idempotency_key, private_storage_consent_at, creator_rights_attested_at)",
        "SELECT ?, ?, ?, ?, ?, ?, ?, 'image/webp', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP",
        "WHERE (SELECT COUNT(*) FROM observation_event_guest_media WHERE session_id = ? AND participant_id = ? AND rights_review_status <> 'withdrawn') < 3",
        "AND EXISTS (SELECT 1 FROM observation_event_participants WHERE session_id = ? AND participant_id = ? AND status = 'checked_in')",
      ].join(" ")).bind(input.submissionId, input.sessionId, input.participantId, input.actorUserId, input.assetKey, input.requestSha256, input.mediaSha256,
        input.bytes, input.idempotencyKey, input.sessionId, input.participantId, input.sessionId, input.participantId),
      this.db.prepare([
        "INSERT OR IGNORE INTO observation_event_discoveries",
        "(entry_id, journal_id, session_id, participant_id, submission_id, entry_kind, caption, spot_label, is_minor, gallery_consent_at, guardian_gallery_consent_at, idempotency_key, source_request_sha256, source_media_sha256)",
        "SELECT submission_id, ?, session_id, participant_id, submission_id, 'photo', ?, ?, ?,",
        "CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END, idempotency_key, request_sha256, media_sha256",
        "FROM observation_event_guest_media WHERE submission_id = ? AND session_id = ? AND participant_id = ? AND request_sha256 = ? AND media_sha256 = ?",
      ].join(" ")).bind(journalId, c.caption, c.spotLabel, c.isMinor ? 1 : 0, c.galleryConsent ? 1 : 0, c.guardianGalleryConsent ? 1 : 0,
        input.submissionId, input.sessionId, input.participantId, input.requestSha256, input.mediaSha256),
    ]);
    const row = await this.get(input.sessionId, input.submissionId);
    if (!row) throw new DiscoveryError(409, "three_photo_limit");
    if (row.source_request_sha256 !== input.requestSha256 || row.participant_id !== input.participantId) throw new DiscoveryError(409, "idempotency_key_conflict");
  }

  async privateReceipts(sessionId: string, participantId: string | null, cursor?: string | null, limit?: number) {
    const after = safeCursor(cursor, "entry");
    const size = participantId ? 100 : pageLimit(limit, 90, 150);
    const where = " WHERE d.session_id = ? AND d.entry_id > ?" + (participantId ? " AND d.participant_id = ?" : "");
    const values: Value[] = participantId ? [sessionId, after, participantId, size + 1] : [sessionId, after, size + 1];
    const result = await this.db.prepare(SELECT_ENTRY + where + " ORDER BY d.entry_id ASC LIMIT ?").bind(...values).all<DiscoveryEntryRow>();
    const rows = result.results.slice(0, size);
    const receipts = rows.map((row) => discoveryReceipt(row, participantId !== null));
    const counts = await this.db.prepare("SELECT review_status, COUNT(*) AS count FROM observation_event_discoveries WHERE session_id = ?"
      + (participantId ? " AND participant_id = ?" : "") + " GROUP BY review_status")
      .bind(...(participantId ? [sessionId, participantId] : [sessionId])).all<{ review_status: string; count: number }>();
    const byStatus = Object.fromEntries(counts.results.map((row) => [row.review_status, Number(row.count)]));
    return {
      receipts, nextCursor: result.results.length > size ? rows.at(-1)!.entry_id : null,
      results: { pending: byStatus.pending ?? 0, approved: byStatus.approved ?? 0, rejected: byStatus.rejected ?? 0, publicProjection: "consented-reviewed-unlisted" },
      ...(participantId ? {} : { reviewQueue: rows.filter((row) => !row.withdrawn_at && row.review_status !== "withdrawn" && (row.entry_kind === "paper" || row.media_state === "saved")).map((row) => discoveryReceipt(row)) }),
    };
  }

  async createPaper(sessionId: string, organizerId: string, input: DiscoveryPaperInput) {
    const batchHash = await discoveryHash(JSON.stringify([sessionId, organizerId, input.idempotencyKey]));
    const participantId = "paper_" + batchHash.slice(0, 40);
    const journalId = await discoveryJournalId(sessionId, participantId);
    const requestHash = await discoveryHash(JSON.stringify(input));
    const entryIds = await Promise.all(input.notes.map((_note, index) => discoveryHash(JSON.stringify([batchHash, index])).then((hash) => "edp_" + hash.slice(0, 40))));
    const existing = await this.get(sessionId, entryIds[0]!);
    if (existing && existing.source_request_sha256 !== requestHash) throw new DiscoveryError(409, "idempotency_key_conflict");
    if (existing?.withdrawn_at) throw new DiscoveryError(410, "paper_entry_withdrawn");
    if (!existing) {
      const statements = [this.db.prepare([
        "INSERT OR IGNORE INTO observation_event_participants",
        "(participant_id, session_id, user_id, guest_token, display_name, role, status, checked_in_at, share_location, is_minor)",
        "VALUES (?, ?, NULL, NULL, ?, 'participant', 'checked_in', CURRENT_TIMESTAMP, 0, ?)",
      ].join(" ")).bind(participantId, sessionId, input.nickname ?? "", input.isMinor ? 1 : 0)];
      input.notes.forEach((note, index) => statements.push(this.db.prepare([
        "INSERT OR IGNORE INTO observation_event_discoveries",
        "(entry_id, journal_id, session_id, participant_id, entry_kind, caption, spot_label, is_minor, gallery_consent_at, guardian_gallery_consent_at, idempotency_key, source_request_sha256)",
        "SELECT ?, ?, ?, ?, 'paper', ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END, ?, ?",
        "WHERE ? = 0 OR EXISTS (SELECT 1 FROM observation_event_discoveries receipt WHERE receipt.session_id = ? AND receipt.entry_id = ? AND receipt.source_request_sha256 = ?)",
      ].join(" ")).bind(entryIds[index]!, journalId, sessionId, participantId, note.caption, note.spotLabel, input.isMinor ? 1 : 0,
        input.galleryConsent ? 1 : 0, input.guardianGalleryConsent ? 1 : 0, input.idempotencyKey + ":" + index, requestHash,
        index, sessionId, entryIds[0]!, requestHash)));
      await this.db.batch(statements);
    }
    const rows = await Promise.all(entryIds.map((id) => this.get(sessionId, id)));
    if (rows.some((row) => !row || row.source_request_sha256 !== requestHash)) throw new DiscoveryError(409, "idempotency_key_conflict");
    return { journalId, entries: rows.map((row) => discoveryReceipt(row!)), replay: Boolean(existing) };
  }

  async autoPublishPhoto(sessionId: string, entryId: string, screen: (body: ArrayBuffer, text: string) => Promise<DiscoveryPrivacyResult>) {
    return this.applyReview(sessionId, entryId, "system:event-discovery-privacy", {
      decision: "approved", note: "clear", selectionLabel: null, selectionComment: null,
    }, screen);
  }

  async review(sessionId: string, entryId: string, organizerId: string, input: DiscoveryReviewInput) {
    const result = await this.applyReview(sessionId, entryId, organizerId, input);
    if (!result) throw new DiscoveryError(404, "reviewable_entry_not_found");
    return result;
  }

  private async applyReview(sessionId: string, entryId: string, organizerId: string, input: DiscoveryReviewInput,
    screen?: (body: ArrayBuffer, text: string) => Promise<DiscoveryPrivacyResult>) {
    const row = await this.get(sessionId, entryId);
    // Automatic publication never reconsiders an existing human decision, scans a
    // private submission, or invents guardian consent. Replay returns its state.
    if (screen && (!row || row.participant_gemini_notice_version !== RYUYO_DISCOVERY_GEMINI_NOTICE_VERSION || !row.participant_gemini_notice_at
      || row.entry_kind !== "photo" || row.review_status !== "pending" || row.reviewed_at
      || row.privacy_method || row.withdrawn_at || !row.gallery_consent_at || row.media_state !== "saved"
      || row.media_rights_status !== "pending" || row.private_delete_pending !== 0
      || ((row.is_minor === 1 || row.participant_is_minor === 1) && !row.guardian_gallery_consent_at))) {
      return row ? { receipt: discoveryReceipt(row), receiptId: entryId, rightsReviewStatus: row.review_status, galleryStatus: galleryStatus(row) } : null;
    }
    if (!row || row.withdrawn_at || row.review_status === "withdrawn" || (row.entry_kind === "photo" && (row.media_state !== "saved" || row.media_rights_status === "withdrawn"))) {
      throw new DiscoveryError(404, "reviewable_entry_not_found");
    }
    let derivativeKey: string | null = null;
    let derivativeSha256: string | null = null;
    if (input.decision === "approved" && row.entry_kind === "photo") {
      if (row.media_mime !== "image/webp" || !row.media_asset_key || row.media_sha256 !== row.source_media_sha256) throw new DiscoveryError(409, "source_media_changed");
      const source = await this.bucket.get(row.media_asset_key);
      if (!source?.body) throw new DiscoveryError(422, "private_media_unavailable");
      const body = await new Response(source.body).arrayBuffer();
      const metadata = inspectPublicDerivativeMetadata(body, "image/webp");
      if (body.byteLength < 1 || body.byteLength > 12_582_912 || metadata.scannedContainer !== "webp" || metadata.exifPresent || metadata.xmpPresent || metadata.gpsExifPresent) {
        throw new DiscoveryError(422, "image_privacy_metadata_verification_failed");
      }
      if (await discoveryHash(body) !== row.source_media_sha256) throw new DiscoveryError(409, "source_media_changed");
      if (screen) {
        // Send only the text needed to check the shared post. A participant's
        // nickname is not relevant to image screening and stays on this service.
        const verdict = await screen(body, [row.caption, row.spot_label].filter(Boolean).join("\n"));
        if (!verdict.clear || verdict.reason !== "clear") {
          await this.db.prepare("UPDATE observation_event_discoveries SET privacy_method = ?, review_note = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND entry_id = ? AND review_status = 'pending' AND reviewed_at IS NULL AND privacy_method IS NULL AND withdrawn_at IS NULL AND source_request_sha256 = ?")
            .bind(DISCOVERY_AUTO_PRIVACY_METHOD, verdict.reason, sessionId, entryId, row.source_request_sha256).run();
          const held = await this.get(sessionId, entryId);
          return held ? { receipt: discoveryReceipt(held), receiptId: entryId, rightsReviewStatus: held.review_status, galleryStatus: galleryStatus(held) } : null;
        }
      }
      // Consent is not inferred from the organizer's review. Even approved
      // private-only submissions do not get a display derivative.
      if (row.gallery_consent_at && (!(row.is_minor === 1 || row.participant_is_minor === 1) || row.guardian_gallery_consent_at)) {
        // An automatic request owns a unique object, so losing a concurrent
        // human review cannot delete that human review's display derivative.
        derivativeKey = screen ? this.derivativeKey(sessionId, entryId).replace("display.webp", "auto-" + crypto.randomUUID() + ".webp") : this.derivativeKey(sessionId, entryId);
        derivativeSha256 = await discoveryHash(body);
        await this.bucket.put(derivativeKey, body, { httpMetadata: { contentType: "image/webp", cacheControl: "private, no-store" }, customMetadata: { visibility: "unlisted-gated", source: EVENT_DISCOVERY_VERSION } });
        const persisted = await this.bucket.get(derivativeKey);
        if (!persisted?.body || persisted.httpMetadata?.contentType !== "image/webp"
          || await discoveryHash(await new Response(persisted.body).arrayBuffer()) !== derivativeSha256) throw new DiscoveryError(503, "display_derivative_verification_failed");
      }
    }
    const statements = [this.db.prepare([
      "UPDATE observation_event_discoveries SET review_status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_note = ?, reviewed_display_name = ?,",
      "privacy_status = ?, privacy_method = ?, privacy_verified_at = CASE WHEN ? = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END,",
      "derivative_key = ?, derivative_sha256 = ?, derivative_verified_at = CASE WHEN ? IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END,",
      "selection_label = ?, selection_comment = ?, updated_at = CURRENT_TIMESTAMP",
      "WHERE session_id = ? AND entry_id = ? AND withdrawn_at IS NULL AND source_request_sha256 = ?",
      ...(screen ? ["AND review_status = 'pending' AND reviewed_at IS NULL AND privacy_method IS NULL AND gallery_consent_at IS NOT NULL",
        "AND ((is_minor = 0 AND (SELECT is_minor FROM observation_event_participants WHERE participant_id = observation_event_discoveries.participant_id) = 0) OR guardian_gallery_consent_at IS NOT NULL)"] : []),
      "AND (entry_kind = 'paper' OR EXISTS (SELECT 1 FROM observation_event_guest_media m WHERE m.submission_id = observation_event_discoveries.submission_id AND m.media_state = 'saved' AND m.rights_review_status <> 'withdrawn' AND m.media_sha256 = observation_event_discoveries.source_media_sha256))",
    ].join(" ")).bind(input.decision, organizerId, input.note, discoveryPublicNickname(row.participant_display_name), input.decision === "approved" ? "verified" : "rejected",
      screen ? DISCOVERY_AUTO_PRIVACY_METHOD : row.entry_kind === "paper" ? "organizer-paper-visual/v1" : EVENT_DISCOVERY_PRIVACY_METHOD, input.decision,
      derivativeKey, derivativeSha256, derivativeKey, input.decision === "approved" ? input.selectionLabel : null,
      input.decision === "approved" ? input.selectionComment : null, sessionId, entryId, row.source_request_sha256)];
    if (row.entry_kind === "photo") {
      statements.push(this.db.prepare([
        "UPDATE observation_event_guest_media SET rights_review_status = ?, rights_reviewed_by = ?, rights_reviewed_at = CURRENT_TIMESTAMP, rights_review_note = ?, updated_at = CURRENT_TIMESTAMP",
        "WHERE session_id = ? AND submission_id = ? AND rights_review_status <> 'withdrawn' AND media_state = 'saved'",
        "AND EXISTS (SELECT 1 FROM observation_event_discoveries d WHERE d.entry_id = ? AND d.withdrawn_at IS NULL AND d.review_status = ?)",
        ...(screen ? ["AND EXISTS (SELECT 1 FROM observation_event_discoveries d WHERE d.entry_id = observation_event_guest_media.submission_id AND d.derivative_key = ? AND d.privacy_method = ?)"] : []),
      ].join(" ")).bind(input.decision, organizerId, input.note, sessionId, entryId, entryId, input.decision, ...(screen ? [derivativeKey, DISCOVERY_AUTO_PRIVACY_METHOD] : [])));
    }
    await this.db.batch(statements);
    const verified = await this.get(sessionId, entryId);
    if (!verified || verified.withdrawn_at || verified.review_status !== input.decision || (screen && verified.derivative_key !== derivativeKey)) {
      if (derivativeKey) await this.bucket.delete(derivativeKey);
      if (screen) return verified ? { receipt: discoveryReceipt(verified), receiptId: entryId, rightsReviewStatus: verified.review_status, galleryStatus: galleryStatus(verified) } : null;
      throw new DiscoveryError(409, "review_state_changed");
    }
    if (input.decision === "rejected") await this.bucket.delete(this.derivativeKey(sessionId, entryId));
    if (row.derivative_key && row.derivative_key !== verified.derivative_key) await this.bucket.delete(row.derivative_key);
    return { receipt: discoveryReceipt(verified), receiptId: entryId, rightsReviewStatus: verified.review_status, galleryStatus: galleryStatus(verified) };
  }

  async gallery(sessionId: string, cursor?: string | null, limit?: number) {
    const after = safeCursor(cursor, "journal");
    const size = pageLimit(limit, 24, 50);
    const from = " FROM observation_event_discoveries d JOIN observation_event_participants p ON p.participant_id = d.participant_id AND p.session_id = d.session_id LEFT JOIN observation_event_guest_media m ON m.submission_id = d.submission_id";
    const journalRows = await this.db.prepare("SELECT d.journal_id" + from + " WHERE d.session_id = ? AND d.journal_id > ? AND " + ELIGIBLE_SQL
      + " GROUP BY d.journal_id ORDER BY d.journal_id ASC LIMIT ?").bind(sessionId, after, size + 1).all<{ journal_id: string }>();
    const ids = journalRows.results.slice(0, size).map((row) => row.journal_id);
    const rows = ids.length ? (await this.db.prepare(SELECT_ENTRY + " WHERE d.session_id = ? AND d.journal_id IN (" + ids.map(() => "?").join(",") + ") AND " + ELIGIBLE_SQL
      + " ORDER BY d.journal_id ASC, d.created_at ASC, d.entry_id ASC").bind(sessionId, ...ids).all<DiscoveryEntryRow>()).results.filter(isDiscoveryEntryEligible) : [];
    const counts = await this.db.prepare("SELECT COUNT(DISTINCT d.journal_id) AS journals, COUNT(*) AS entries" + from
      + " WHERE d.session_id = ? AND " + ELIGIBLE_SQL).bind(sessionId).first<{ journals: number; entries: number }>();
    return {
      journals: ids.map((id) => {
        const entries = rows.filter((row) => row.journal_id === id);
        return {
          journalId: id, displayName: entries[0]?.reviewed_display_name ?? null,
          entries: entries.map((row) => ({
            id: row.entry_id, kind: row.entry_kind, caption: row.caption, spotLabel: row.spot_label,
            ...(row.entry_kind === "photo" ? { contentHref: "/api/v1/observation-events/" + encodeURIComponent(sessionId) + "/discoveries/" + encodeURIComponent(row.entry_id) + "/content" } : {}),
            selectionLabel: row.selection_label, selectionComment: row.selection_comment,
          })),
        };
      }).filter((journal) => journal.entries.length > 0),
      nextCursor: journalRows.results.length > size ? ids.at(-1)! : null,
      counts: { journals: Number(counts?.journals ?? 0), entries: Number(counts?.entries ?? 0) },
    };
  }

  async content(sessionId: string, entryId: string): Promise<ArrayBuffer> {
    const row = await this.get(sessionId, entryId);
    if (!row || row.entry_kind !== "photo" || !isDiscoveryEntryEligible(row)
      || !this.validDerivativeKey(sessionId, entryId, row.derivative_key)) throw new DiscoveryError(404, "not_found");
    const object = await this.bucket.get(row.derivative_key);
    if (!object?.body || object.httpMetadata?.contentType !== "image/webp") throw new DiscoveryError(404, "not_found");
    const body = await new Response(object.body).arrayBuffer();
    if (await discoveryHash(body) !== row.derivative_sha256) throw new DiscoveryError(404, "not_found");
    // Re-read after object retrieval so an in-flight withdrawal cannot turn a
    // stale metadata snapshot into a newly authorized response.
    const current = await this.get(sessionId, entryId);
    if (!current || !isDiscoveryEntryEligible(current) || current.derivative_sha256 !== row.derivative_sha256) throw new DiscoveryError(404, "not_found");
    return body;
  }

  async withdraw(sessionId: string, entryId: string): Promise<void> {
    const row = await this.get(sessionId, entryId);
    await this.db.prepare("UPDATE observation_event_discoveries SET review_status = 'withdrawn', withdrawn_at = COALESCE(withdrawn_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND entry_id = ?")
      .bind(sessionId, entryId).run();
    await this.bucket.delete(this.derivativeKey(sessionId, entryId));
    if (row?.derivative_key && this.validDerivativeKey(sessionId, entryId, row.derivative_key)) {
      await this.bucket.delete(row.derivative_key);
      if (await this.bucket.head(row.derivative_key)) throw new DiscoveryError(503, "display_derivative_delete_unverified");
    }
    if (await this.bucket.head(this.derivativeKey(sessionId, entryId))) throw new DiscoveryError(503, "display_derivative_delete_unverified");
  }

  async participantClaimStatements(sessionId: string, fromParticipantId: string, toParticipantId: string, userId: string): Promise<DiscoveryStatement[]> {
    const count = await this.db.prepare("SELECT COUNT(*) AS count FROM observation_event_guest_media WHERE session_id = ? AND participant_id IN (?, ?) AND rights_review_status <> 'withdrawn'")
      .bind(sessionId, fromParticipantId, toParticipantId).first<{ count: number }>();
    if (Number(count?.count ?? 0) > 3) throw new DiscoveryError(409, "discovery_claim_photo_limit");
    const journalId = await discoveryJournalId(sessionId, toParticipantId);
    return [
      this.db.prepare([
        "UPDATE observation_event_guest_media AS guest SET participant_id = ?, actor_user_id = ?,",
        "idempotency_key = CASE WHEN EXISTS (SELECT 1 FROM observation_event_guest_media account WHERE account.session_id = guest.session_id AND account.participant_id = ? AND account.idempotency_key = guest.idempotency_key AND account.submission_id <> guest.submission_id)",
        "THEN 'claimed:' || guest.submission_id ELSE guest.idempotency_key END",
        "WHERE guest.session_id = ? AND guest.participant_id = ?",
        "AND (SELECT COUNT(*) FROM observation_event_guest_media WHERE session_id = ? AND participant_id IN (?, ?) AND rights_review_status <> 'withdrawn') <= 3",
      ].join(" ")).bind(toParticipantId, userId, toParticipantId, sessionId, fromParticipantId, sessionId, fromParticipantId, toParticipantId),
      this.db.prepare([
        "UPDATE observation_event_discoveries SET participant_id = ?, journal_id = ?,",
        "idempotency_key = COALESCE((SELECT idempotency_key FROM observation_event_guest_media m WHERE m.submission_id = observation_event_discoveries.submission_id), 'claimed:' || entry_id), updated_at = CURRENT_TIMESTAMP",
        "WHERE session_id = ? AND participant_id = ? AND (entry_kind = 'paper' OR EXISTS",
        "(SELECT 1 FROM observation_event_guest_media m WHERE m.submission_id = observation_event_discoveries.submission_id AND m.participant_id = ?))",
      ].join(" ")).bind(toParticipantId, journalId, sessionId, fromParticipantId, toParticipantId),
    ];
  }

  derivativeKey(sessionId: string, entryId: string): string {
    return "private/event-discovery-derivatives/" + encodeURIComponent(sessionId) + "/" + encodeURIComponent(entryId) + "/display.webp";
  }

  private validDerivativeKey(sessionId: string, entryId: string, key: string | null): key is string {
    const base = this.derivativeKey(sessionId, entryId);
    return key === base || Boolean(key?.startsWith(base.slice(0, -"display.webp".length)) && /^auto-[a-f0-9-]{36}\.webp$/u.test(key.slice(base.length - "display.webp".length)));
  }
}
