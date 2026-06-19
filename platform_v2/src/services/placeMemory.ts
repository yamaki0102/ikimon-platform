import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { PoolClient } from "pg";
import { getPool } from "../db.js";
import { loadConfig } from "../config.js";
import { buildPublicCellId } from "./publicLocation.js";
import { generateAiTextWithRoleChain, type AiRouterPart } from "./aiModelRouter.js";
import { upsertAssetBlob } from "./writeSupport.js";
import { CONTINUOUS_VISIT_GAP_INTERVAL_SQL } from "./visitWindows.js";
import { VALID_OBSERVATION_PHOTO_ASSET_SQL } from "./observationQualityGate.js";

export const PLACE_MEMORY_GRID_M = 1000;
const MAX_ECHO_NOTE_LENGTH = 80;
const MAX_PRIVATE_NOTE_LENGTH = 600;
const REPORT_HIDE_THRESHOLD = 3;

export const PLACE_MEMORY_TAGS = [
  "refresh_walk",
  "walked_with_someone",
  "first_visit",
  "looked_for_life",
  "revisit_compare",
  "season_change",
  "unexpected_find",
  "quiet_moment",
] as const;

export type PlaceMemoryTag = typeof PLACE_MEMORY_TAGS[number];

const TAG_SET = new Set<string>(PLACE_MEMORY_TAGS);

export type PlaceMemoryInput = {
  tags?: unknown;
  echoNote?: unknown;
  privateNote?: unknown;
  photoEchoEnabled?: unknown;
};

export type PlaceMemoryWriteResult = {
  entryId: string;
  cellId: string;
  tags: PlaceMemoryTag[];
  echoNote: string;
  hasPrivateNote: boolean;
  photoEchoEnabled: boolean;
  photoEchoVisibility: string;
};

export type PlaceMemoryListItem = {
  entryId: string;
  cellId: string;
  tags: PlaceMemoryTag[];
  echoNote: string;
  observedYearMonth: string;
  photoUrl: string | null;
  photoState: string;
  likeCount: number;
  likedByMe: boolean;
  ownEntry: boolean;
};

export type PlaceMemoryUserPreferences = {
  defaultPhotoEchoEnabled: boolean;
  defaultTagsPublic: boolean;
};

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeTags(value: unknown): PlaceMemoryTag[] {
  if (!Array.isArray(value)) return [];
  const output: PlaceMemoryTag[] = [];
  for (const item of value) {
    const tag = typeof item === "string" ? item.trim() : "";
    if (!TAG_SET.has(tag) || output.includes(tag as PlaceMemoryTag)) continue;
    output.push(tag as PlaceMemoryTag);
    if (output.length >= 6) break;
  }
  return output;
}

export function normalizePlaceMemoryInput(input: unknown): {
  tags: PlaceMemoryTag[];
  echoNote: string;
  privateNote: string;
  photoEchoEnabled: boolean;
  shouldPersist: boolean;
} | null {
  if (!input || typeof input !== "object") return null;
  const record = input as PlaceMemoryInput;
  const tags = normalizeTags(record.tags);
  const echoNote = cleanText(record.echoNote, MAX_ECHO_NOTE_LENGTH);
  const privateNote = cleanText(record.privateNote, MAX_PRIVATE_NOTE_LENGTH);
  const photoEchoEnabled = record.photoEchoEnabled !== false;
  const shouldPersist = tags.length > 0 || echoNote !== "" || privateNote !== "";
  return { tags, echoNote, privateNote, photoEchoEnabled, shouldPersist };
}

async function controlEnabled(client: PoolClient, controlKey: string): Promise<boolean> {
  const result = await client.query<{ enabled: boolean }>(
    `select coalesce(enabled, true) as enabled
       from place_memory_controls
      where control_key = $1
      limit 1`,
    [controlKey],
  );
  return result.rows[0]?.enabled !== false;
}

async function postingAllowed(client: PoolClient, userId: string, cellId: string): Promise<boolean> {
  const feature = await controlEnabled(client, "feature");
  const posting = await controlEnabled(client, "posting");
  const user = await client.query<{ blocked: boolean }>(
    `select coalesce(posting_blocked, false) as blocked
       from place_memory_user_controls
      where user_id = $1
      limit 1`,
    [userId],
  );
  const cell = await client.query<{ blocked: boolean }>(
    `select coalesce(blocked, false) as blocked
       from place_memory_cell_controls
      where cell_id = $1
      limit 1`,
    [cellId],
  );
  return feature && posting && user.rows[0]?.blocked !== true && cell.rows[0]?.blocked !== true;
}

export async function upsertPlaceMemoryForVisit(
  client: PoolClient,
  input: {
    visitId: string;
    occurrenceId: string;
    userId: string;
    latitude: number;
    longitude: number;
    placeMemory?: unknown;
    source?: string;
  },
): Promise<PlaceMemoryWriteResult | null> {
  const normalized = normalizePlaceMemoryInput(input.placeMemory);
  if (!normalized?.shouldPersist) return null;
  const cellId = buildPublicCellId(input.latitude, input.longitude, PLACE_MEMORY_GRID_M);
  if (!(await postingAllowed(client, input.userId, cellId))) {
    throw new Error("place_memory_posting_disabled");
  }
  const preferences = await client.query<{ default_photo_echo_enabled: boolean; default_tags_public: boolean }>(
    `select default_photo_echo_enabled, default_tags_public
       from place_memory_user_preferences
      where user_id = $1
      limit 1`,
    [input.userId],
  );
  const defaultPhotoEchoEnabled = preferences.rows[0]?.default_photo_echo_enabled !== false;
  const requestedPhotoEchoEnabled = (input.placeMemory as PlaceMemoryInput | null | undefined)?.photoEchoEnabled;
  const photoControl = await controlEnabled(client, "photos");
  const photoEchoEnabled = (typeof requestedPhotoEchoEnabled === "boolean" ? normalized.photoEchoEnabled : defaultPhotoEchoEnabled) && photoControl;
  const tagsPublic = preferences.rows[0]?.default_tags_public !== false;
  const result = await client.query<{
    entry_id: string;
    photo_echo_visibility: string;
  }>(
    `insert into place_memory_entries (
        visit_id, occurrence_id, user_id, cell_id, cell_grid_m, memory_tags, tags_public,
        echo_note, private_note, photo_echo_enabled, photo_echo_visibility, source_payload,
        updated_at
     ) values (
        $1, $2, $3, $4, $5, $6::text[], $7, $8, $9, $10, $11, $12::jsonb, now()
     )
     on conflict (visit_id) do update set
        occurrence_id = excluded.occurrence_id,
        user_id = excluded.user_id,
        cell_id = excluded.cell_id,
        cell_grid_m = excluded.cell_grid_m,
        memory_tags = excluded.memory_tags,
        tags_public = excluded.tags_public,
        echo_note = excluded.echo_note,
        private_note = excluded.private_note,
        photo_echo_enabled = excluded.photo_echo_enabled,
        photo_echo_visibility = case
          when excluded.photo_echo_enabled is false then 'hidden_by_user'
          when place_memory_entries.photo_echo_visibility = 'ready' then place_memory_entries.photo_echo_visibility
          else excluded.photo_echo_visibility
        end,
        source_payload = excluded.source_payload,
        deleted_at = null,
        updated_at = now()
     returning entry_id::text, photo_echo_visibility`,
    [
      input.visitId,
      input.occurrenceId,
      input.userId,
      cellId,
      PLACE_MEMORY_GRID_M,
      normalized.tags,
      tagsPublic,
      normalized.echoNote,
      normalized.privateNote,
      photoEchoEnabled,
      photoEchoEnabled ? "processing" : "hidden_by_user",
      JSON.stringify({ source: input.source ?? "v2_observation_write" }),
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("place_memory_upsert_failed");
  return {
    entryId: row.entry_id,
    cellId,
    tags: normalized.tags,
    echoNote: normalized.echoNote,
    hasPrivateNote: normalized.privateNote !== "",
    photoEchoEnabled,
    photoEchoVisibility: row.photo_echo_visibility,
  };
}

async function viewerHasCellAccess(client: PoolClient, userId: string, cellId: string): Promise<boolean> {
  const result = await client.query<{ has_access: boolean }>(
    `select exists(
       select 1
         from place_memory_entries pme
        where pme.user_id = $1
          and pme.cell_id = $2
          and pme.deleted_at is null
     ) as has_access`,
    [userId, cellId],
  );
  return result.rows[0]?.has_access === true;
}

function rowToItem(row: {
  entry_id: string;
  cell_id: string;
  memory_tags: string[] | null;
  echo_note: string;
  observed_year_month: string;
  photo_url: string | null;
  photo_state: string;
  like_count: string | number;
  liked_by_me: boolean;
  own_entry: boolean;
}): PlaceMemoryListItem {
  return {
    entryId: row.entry_id,
    cellId: row.cell_id,
    tags: normalizeTags(row.memory_tags ?? []),
    echoNote: row.echo_note,
    observedYearMonth: row.observed_year_month,
    photoUrl: row.photo_url,
    photoState: row.photo_state,
    likeCount: Number(row.like_count ?? 0),
    likedByMe: row.liked_by_me === true,
    ownEntry: row.own_entry === true,
  };
}

export async function listUnlockedPlaceMemories(input: {
  userId: string;
  cellId: string;
  limit?: number;
  randomSample?: boolean;
}): Promise<{ ok: true; cellId: string; unlocked: true; items: PlaceMemoryListItem[] } | { ok: true; cellId: string; unlocked: false; items: [] }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (!(await controlEnabled(client, "feature"))) return { ok: true, cellId: input.cellId, unlocked: false, items: [] };
    if (!(await viewerHasCellAccess(client, input.userId, input.cellId))) {
      return { ok: true, cellId: input.cellId, unlocked: false, items: [] };
    }
    const limit = Math.max(1, Math.min(60, Math.floor(input.limit ?? 12)));
    const orderSql = input.randomSample
      ? `order by season_distance asc, random()`
      : `order by season_distance asc, created_at desc`;
    const result = await client.query<Parameters<typeof rowToItem>[0]>(
      `with ranked as (
         select pme.entry_id::text,
                pme.cell_id,
                case when pme.tags_public then pme.memory_tags else '{}'::text[] end as memory_tags,
                pme.echo_note,
                to_char(v.observed_at, 'YYYY-MM') as observed_year_month,
                case
                  when pme.photo_echo_visibility = 'ready'
                   and pmd.processing_status = 'ready'
                   and coalesce(pmd.sensitive_status, '') <> 'sensitive'
                  then ab.public_url
                  else null
                end as photo_url,
                case
                  when pme.photo_echo_visibility = 'ready' and pmd.processing_status = 'ready' then 'ready'
                  when pme.photo_echo_visibility = 'blocked_sensitive' then 'blocked_sensitive'
                  when pme.photo_echo_visibility = 'blocked_privacy_processing' then 'blocked_privacy_processing'
                  when pme.photo_echo_visibility = 'hidden_by_user' then 'hidden_by_user'
                  else 'processing'
                end as photo_state,
                (select count(*) from place_memory_likes l where l.entry_id = pme.entry_id)::text as like_count,
                exists(select 1 from place_memory_likes l where l.entry_id = pme.entry_id and l.liker_user_id = $2) as liked_by_me,
                pme.user_id = $2 as own_entry,
                least(
                  abs(extract(month from v.observed_at)::int - extract(month from now())::int),
                  12 - abs(extract(month from v.observed_at)::int - extract(month from now())::int)
                ) as season_distance,
                pme.created_at
           from place_memory_entries pme
           join visits v on v.visit_id = pme.visit_id
           left join place_memory_photo_derivatives pmd on pmd.entry_id = pme.entry_id
           left join asset_blobs ab on ab.blob_id = pmd.redacted_blob_id
          where pme.cell_id = $1
            and pme.deleted_at is null
            and pme.moderation_status = 'visible'
            and v.public_visibility <> 'hidden'
            and not exists (
              select 1 from place_memory_user_hides h
               where h.entry_id = pme.entry_id
                 and h.user_id = $2
            )
        )
        select * from ranked
        ${orderSql}
        limit $3`,
      [input.cellId, input.userId, limit],
    );
    return { ok: true, cellId: input.cellId, unlocked: true, items: result.rows.map(rowToItem) };
  } finally {
    client.release();
  }
}

export async function getPostSavePlaceMemorySample(input: { userId: string; visitId: string; limit?: number }): Promise<PlaceMemoryListItem[]> {
  const pool = getPool();
  const result = await pool.query<{ cell_id: string }>(
    `select cell_id from place_memory_entries where visit_id = $1 and user_id = $2 and deleted_at is null limit 1`,
    [input.visitId, input.userId],
  );
  const cellId = result.rows[0]?.cell_id;
  if (!cellId) return [];
  const list = await listUnlockedPlaceMemories({ userId: input.userId, cellId, limit: input.limit ?? 3, randomSample: true });
  return list.unlocked ? list.items : [];
}

async function resolveEntryAccess(client: PoolClient, entryId: string, userId: string): Promise<{
  entryId: string;
  cellId: string;
  ownerUserId: string;
  occurrenceId: string;
} | null> {
  const result = await client.query<{
    entry_id: string;
    cell_id: string;
    user_id: string;
    occurrence_id: string;
  }>(
    `select entry_id::text, cell_id, user_id, occurrence_id
       from place_memory_entries
      where entry_id = $1::uuid
        and deleted_at is null
        and moderation_status = 'visible'
      limit 1`,
    [entryId],
  );
  const row = result.rows[0];
  if (!row) return null;
  if (!(await viewerHasCellAccess(client, userId, row.cell_id))) return null;
  return {
    entryId: row.entry_id,
    cellId: row.cell_id,
    ownerUserId: row.user_id,
    occurrenceId: row.occurrence_id,
  };
}

export async function likePlaceMemory(entryId: string, userId: string): Promise<{ ok: true; liked: boolean; likeCount: number }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (!(await controlEnabled(client, "likes"))) throw new Error("place_memory_likes_disabled");
    const entry = await resolveEntryAccess(client, entryId, userId);
    if (!entry) throw new Error("place_memory_not_found");
    if (entry.ownerUserId === userId) throw new Error("place_memory_own_like_not_allowed");
    const inserted = await client.query<{ entry_id: string }>(
      `insert into place_memory_likes (entry_id, liker_user_id)
       values ($1::uuid, $2)
       on conflict do nothing
       returning entry_id::text`,
      [entryId, userId],
    );
    const notificationEnabled = await controlEnabled(client, "notifications");
    if (inserted.rows.length > 0 && notificationEnabled) {
      await client.query(
        `insert into alert_deliveries (
           occurrence_id, user_id, trigger_kind, channel, delivery_status, delivered_at, payload_json
         ) values (
           $1, $2, 'place_memory_like', 'none', 'sent', now(), $3::jsonb
         )`,
        [
          entry.occurrenceId,
          entry.ownerUserId,
          JSON.stringify({
            title: "場所の記憶にいいね",
            body: "同じ場所で記録した人が、あなたの残響にいいねしました。",
            href: `/observations/${encodeURIComponent(entry.occurrenceId)}`,
            entryId,
            cellId: entry.cellId,
          }),
        ],
      );
    }
    const count = await client.query<{ count: string }>(
      `select count(*)::text from place_memory_likes where entry_id = $1::uuid`,
      [entryId],
    );
    await client.query("commit");
    return { ok: true, liked: true, likeCount: Number(count.rows[0]?.count ?? 0) };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function hidePlaceMemoryForSelf(entryId: string, userId: string, reason = "self"): Promise<{ ok: true }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const entry = await resolveEntryAccess(client, entryId, userId);
    if (!entry) throw new Error("place_memory_not_found");
    await client.query(
      `insert into place_memory_user_hides (entry_id, user_id, hide_reason)
       values ($1::uuid, $2, $3)
       on conflict do nothing`,
      [entryId, userId, reason.slice(0, 80)],
    );
    return { ok: true };
  } finally {
    client.release();
  }
}

export async function reportPlaceMemory(entryId: string, userId: string, reasonCode = "other", reasonNote = ""): Promise<{ ok: true; hiddenForMe: true; moderationStatus: string }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const entry = await resolveEntryAccess(client, entryId, userId);
    if (!entry) throw new Error("place_memory_not_found");
    await client.query(
      `insert into place_memory_reports (entry_id, reporter_user_id, reason_code, reason_note)
       values ($1::uuid, $2, $3, $4)
       on conflict (entry_id, reporter_user_id) do update set
         reason_code = excluded.reason_code,
         reason_note = excluded.reason_note`,
      [entryId, userId, cleanText(reasonCode, 80) || "other", cleanText(reasonNote, 400)],
    );
    await client.query(
      `insert into place_memory_user_hides (entry_id, user_id, hide_reason)
       values ($1::uuid, $2, 'reported')
       on conflict do nothing`,
      [entryId, userId],
    );
    const reports = await client.query<{ count: string }>(
      `select count(*)::text from place_memory_reports where entry_id = $1::uuid`,
      [entryId],
    );
    const reportCount = Number(reports.rows[0]?.count ?? 0);
    const moderationStatus = reportCount >= REPORT_HIDE_THRESHOLD ? "hidden_by_report_threshold" : "visible";
    await client.query(
      `update place_memory_entries
          set report_count = $2,
              moderation_status = $3,
              photo_echo_visibility = case when $3 <> 'visible' then 'blocked_moderation' else photo_echo_visibility end,
              updated_at = now()
        where entry_id = $1::uuid`,
      [entryId, reportCount, moderationStatus],
    );
    await client.query("commit");
    return { ok: true, hiddenForMe: true, moderationStatus };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

type PrivacyRegion = { x: number; y: number; width: number; height: number; confidence: number };
type PrivacyAiResult = {
  faceRegions: PrivacyRegion[];
  licensePlateRegions: PrivacyRegion[];
  sensitive: { isSensitive: boolean; reasons: string[] };
  raw: unknown;
};

function parsePrivacyJson(text: string): PrivacyAiResult {
  const trimmed = text.trim();
  const matched = trimmed.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(matched ? matched[0]! : trimmed) as Record<string, unknown>;
  const normalizeRegions = (value: unknown): PrivacyRegion[] => {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 20).map((item) => {
      const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const x = Number(record.x);
      const y = Number(record.y);
      const width = Number(record.width);
      const height = Number(record.height);
      const confidence = Number(record.confidence ?? 0);
      if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
      return {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
        width: Math.max(0, Math.min(1, width)),
        height: Math.max(0, Math.min(1, height)),
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
      };
    }).filter((item): item is PrivacyRegion => Boolean(item));
  };
  const sensitive = parsed.sensitive && typeof parsed.sensitive === "object"
    ? parsed.sensitive as Record<string, unknown>
    : {};
  return {
    faceRegions: normalizeRegions(parsed.face_regions ?? parsed.faceRegions),
    licensePlateRegions: normalizeRegions(parsed.license_plate_regions ?? parsed.licensePlateRegions),
    sensitive: {
      isSensitive: sensitive.is_sensitive === true || sensitive.isSensitive === true,
      reasons: Array.isArray(sensitive.reasons)
        ? sensitive.reasons.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 6)
        : [],
    },
    raw: parsed,
  };
}

async function detectPrivacyRegions(buffer: Buffer, mimeType: string, entryId: string, occurrenceId: string): Promise<PrivacyAiResult> {
  const parts: AiRouterPart[] = [
    {
      text: [
        "Return strict JSON only.",
        "Find human faces and vehicle license plates that should be pixelated before sharing this field-record photo.",
        "Also decide whether the image is sensitive enough that it must not be shown as a place-memory echo photo.",
        "Use normalized coordinates in [0,1] with keys x,y,width,height,confidence.",
        "Schema: {\"face_regions\":[],\"license_plate_regions\":[],\"sensitive\":{\"is_sensitive\":false,\"reasons\":[]}}",
        "Do not include species-location hints in reasons. Keep reasons broad, e.g. people, private home, exact nest/rare site, violence, sexual content.",
      ].join("\n"),
    },
    {
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: buffer.toString("base64"),
      },
    },
  ];
  const response = await generateAiTextWithRoleChain({
    chainName: "observationVisualExtract",
    parts,
    responseMimeType: "application/json",
    maxOutputTokens: 1200,
    temperature: 0,
    retriesPerModel: 1,
    cost: {
      layer: "hot",
      endpoint: "place_memory_photo_privacy",
      occurrenceId,
      metadata: { entryId },
    },
  });
  return parsePrivacyJson(response.text);
}

async function pixelateRegions(buffer: Buffer, regions: PrivacyRegion[]): Promise<{ buffer: Buffer; width: number | null; height: number | null }> {
  const base = sharp(buffer, { failOn: "none" }).rotate();
  const metadata = await base.metadata();
  const width = metadata.width ?? null;
  const height = metadata.height ?? null;
  if (!width || !height || regions.length === 0) {
    const out = await sharp(buffer, { failOn: "none" }).rotate().jpeg({ quality: 84, mozjpeg: true }).toBuffer();
    return { buffer: out, width, height };
  }
  const overlays: sharp.OverlayOptions[] = [];
  for (const region of regions) {
    const left = Math.max(0, Math.floor(region.x * width));
    const top = Math.max(0, Math.floor(region.y * height));
    const regionWidth = Math.max(8, Math.min(width - left, Math.ceil(region.width * width)));
    const regionHeight = Math.max(8, Math.min(height - top, Math.ceil(region.height * height)));
    if (regionWidth <= 0 || regionHeight <= 0) continue;
    const crop = await sharp(buffer, { failOn: "none" })
      .rotate()
      .extract({ left, top, width: regionWidth, height: regionHeight })
      .resize(Math.max(1, Math.ceil(regionWidth / 14)), Math.max(1, Math.ceil(regionHeight / 14)), { fit: "fill" })
      .resize(regionWidth, regionHeight, { fit: "fill", kernel: "nearest" })
      .jpeg({ quality: 70 })
      .toBuffer();
    overlays.push({ input: crop, left, top });
  }
  const out = await sharp(buffer, { failOn: "none" })
    .rotate()
    .composite(overlays)
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
  return { buffer: out, width, height };
}

async function createAdminPhotoFailureAlert(client: PoolClient, entryId: string, occurrenceId: string, error: string): Promise<void> {
  await client.query(
    `insert into place_memory_audit_events (entry_id, event_kind, event_payload)
     values ($1::uuid, 'photo_privacy_final_failure', $2::jsonb)`,
    [entryId, JSON.stringify({ occurrenceId, error })],
  );
  const admins = await client.query<{ user_id: string }>(
    `select user_id
       from users
      where lower(coalesce(role_name, '')) in ('admin','owner','specialist')
         or lower(coalesce(rank_label, '')) like '%admin%'
      limit 10`,
  );
  for (const admin of admins.rows) {
    await client.query(
      `insert into alert_deliveries (
         occurrence_id, user_id, trigger_kind, channel, delivery_status, delivered_at, payload_json
       ) values ($1, $2, 'place_memory_admin', 'none', 'sent', now(), $3::jsonb)`,
      [
        occurrenceId,
        admin.user_id,
        JSON.stringify({
          title: "場所の記憶: 写真処理に失敗",
          body: "顔・車ナンバーのモザイク処理が最終失敗したため、残響写真を非公開にしました。",
          entryId,
          occurrenceId,
          error,
        }),
      ],
    );
  }
}

function retryDelayMinutes(retryCount: number): number {
  if (retryCount <= 0) return 5;
  if (retryCount === 1) return 30;
  return 360;
}

export async function ensurePlaceMemoryPhotoJobForVisit(visitId: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query<{ entry_id: string; asset_id: string | null }>(
      `with entry as (
         select entry_id, visit_id
           from place_memory_entries
          where visit_id = $1
            and deleted_at is null
            and photo_echo_enabled = true
          limit 1
       ),
       asset as (
         select ea.asset_id::text
           from evidence_assets ea
           join entry e on e.visit_id = ea.visit_id
          where ea.asset_role = 'observation_photo'
          order by case when ea.source_payload->>'media_role' = 'primary_subject' then 0 else 1 end,
                   ea.created_at asc
          limit 1
       )
       select e.entry_id::text, a.asset_id
         from entry e
         left join asset a on true`,
      [visitId],
    );
    const row = result.rows[0];
    if (!row?.entry_id) return;
    if (!row.asset_id) {
      await client.query(
        `update place_memory_entries
            set photo_echo_visibility = 'no_photo', updated_at = now()
          where entry_id = $1::uuid`,
        [row.entry_id],
      );
      return;
    }
    await client.query(
      `insert into place_memory_photo_derivatives (entry_id, source_asset_id, processing_status, next_retry_at)
       values ($1::uuid, $2::uuid, 'pending', now())
       on conflict (entry_id) do update set
         source_asset_id = coalesce(place_memory_photo_derivatives.source_asset_id, excluded.source_asset_id),
         processing_status = case
           when place_memory_photo_derivatives.processing_status in ('ready','sensitive_blocked','failed_final') then place_memory_photo_derivatives.processing_status
           else 'pending'
         end,
         next_retry_at = case
           when place_memory_photo_derivatives.processing_status in ('ready','sensitive_blocked','failed_final') then place_memory_photo_derivatives.next_retry_at
           else now()
         end,
         updated_at = now()`,
      [row.entry_id, row.asset_id],
    );
  } finally {
    client.release();
  }
}

export async function processPlaceMemoryPhoto(entryId: string): Promise<{ ok: true; status: string }> {
  const config = loadConfig();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const jobResult = await client.query<{
      derivative_id: string;
      entry_id: string;
      occurrence_id: string;
      source_asset_id: string | null;
      retry_count: number;
      storage_backend: string | null;
      storage_path: string | null;
      mime_type: string | null;
    }>(
      `select pmd.derivative_id::text,
              pme.entry_id::text,
              pme.occurrence_id,
              pmd.source_asset_id::text,
              pmd.retry_count,
              ab.storage_backend,
              ab.storage_path,
              ab.mime_type
         from place_memory_entries pme
         join place_memory_photo_derivatives pmd on pmd.entry_id = pme.entry_id
         left join evidence_assets ea on ea.asset_id = pmd.source_asset_id
         left join asset_blobs ab on ab.blob_id = ea.blob_id
        where pme.entry_id = $1::uuid
          and pme.deleted_at is null
          and pme.photo_echo_enabled = true
          and pmd.processing_status in ('pending','failed_retryable')
          and coalesce(pmd.next_retry_at, now()) <= now()
        for update of pmd`,
      [entryId],
    );
    const job = jobResult.rows[0];
    if (!job) {
      await client.query("commit");
      return { ok: true, status: "skipped" };
    }
    await client.query(
      `update place_memory_photo_derivatives
          set processing_status = 'processing', updated_at = now()
        where derivative_id = $1::uuid`,
      [job.derivative_id],
    );
    await client.query("commit");

    if (!job.storage_path || job.storage_backend !== "local_fs") {
      throw new Error("place_memory_source_photo_unavailable");
    }
    const sourcePath = path.join(config.legacyPublicRoot, ...job.storage_path.split("/"));
    const sourceBuffer = await readFile(sourcePath);
    const privacy = await detectPrivacyRegions(sourceBuffer, job.mime_type ?? "image/jpeg", job.entry_id, job.occurrence_id);
    if (privacy.sensitive.isSensitive) {
      const c = await pool.connect();
      try {
        await c.query("begin");
        await c.query(
          `update place_memory_photo_derivatives
              set processing_status = 'sensitive_blocked',
                  sensitive_status = 'sensitive',
                  reviewer_note = $2,
                  source_payload = source_payload || $3::jsonb,
                  updated_at = now()
            where derivative_id = $1::uuid`,
          [
            job.derivative_id,
            privacy.sensitive.reasons.join(", ").slice(0, 500),
            JSON.stringify({ ai_privacy: privacy.raw }),
          ],
        );
        await c.query(
          `update place_memory_entries
              set photo_echo_visibility = 'blocked_sensitive', updated_at = now()
            where entry_id = $1::uuid`,
          [job.entry_id],
        );
        await c.query("commit");
      } catch (error) {
        await c.query("rollback");
        throw error;
      } finally {
        c.release();
      }
      return { ok: true, status: "sensitive_blocked" };
    }

    const regions = [...privacy.faceRegions, ...privacy.licensePlateRegions]
      .filter((region) => region.confidence >= 0.35);
    const redacted = await pixelateRegions(sourceBuffer, regions);
    const sha256 = createHash("sha256").update(redacted.buffer).digest("hex");
    const relativePath = path.posix.join("uploads", "place-memory", job.entry_id, `${sha256.slice(0, 16)}.jpg`);
    const absolutePath = path.join(config.legacyPublicRoot, ...relativePath.split("/"));
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, redacted.buffer);

    const c = await pool.connect();
    try {
      await c.query("begin");
      const blobId = await upsertAssetBlob(c, {
        storageBackend: "local_fs",
        storagePath: relativePath,
        mediaType: "image",
        mimeType: "image/jpeg",
        publicUrl: `/${relativePath}`,
        sha256,
        bytes: redacted.buffer.byteLength,
        widthPx: redacted.width,
        heightPx: redacted.height,
        sourcePayload: {
          source: "place_memory_photo_privacy",
          entry_id: job.entry_id,
          source_asset_id: job.source_asset_id,
          ai_privacy: privacy.raw,
          redacted_regions: {
            faces: privacy.faceRegions.length,
            licensePlates: privacy.licensePlateRegions.length,
          },
        },
      });
      await c.query(
        `update place_memory_photo_derivatives
            set redacted_blob_id = $2::uuid,
                processing_status = 'ready',
                face_status = $3,
                license_plate_status = $4,
                sensitive_status = 'clear',
                last_error = null,
                next_retry_at = null,
                updated_at = now()
          where derivative_id = $1::uuid`,
        [
          job.derivative_id,
          blobId,
          privacy.faceRegions.length > 0 ? "redacted" : "not_detected",
          privacy.licensePlateRegions.length > 0 ? "redacted" : "not_detected",
        ],
      );
      await c.query(
        `update place_memory_entries
            set photo_echo_visibility = 'ready', updated_at = now()
          where entry_id = $1::uuid`,
        [job.entry_id],
      );
      await c.query("commit");
    } catch (error) {
      await c.query("rollback");
      throw error;
    } finally {
      c.release();
    }
    return { ok: true, status: "ready" };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    const retryClient = await pool.connect();
    try {
      await retryClient.query("begin");
      const current = await retryClient.query<{ retry_count: number; occurrence_id: string }>(
        `select pmd.retry_count, pme.occurrence_id
           from place_memory_photo_derivatives pmd
           join place_memory_entries pme on pme.entry_id = pmd.entry_id
          where pmd.entry_id = $1::uuid
          for update`,
        [entryId],
      );
      const retryCount = Number(current.rows[0]?.retry_count ?? 0) + 1;
      const finalFailure = retryCount >= 3;
      await retryClient.query(
        `update place_memory_photo_derivatives
            set processing_status = $2,
                retry_count = $3,
                next_retry_at = case when $2 = 'failed_retryable' then now() + ($4::text || ' minutes')::interval else null end,
                last_error = $5,
                updated_at = now()
          where entry_id = $1::uuid`,
        [entryId, finalFailure ? "failed_final" : "failed_retryable", retryCount, retryDelayMinutes(retryCount - 1), message.slice(0, 500)],
      );
      if (finalFailure) {
        await retryClient.query(
          `update place_memory_entries
              set photo_echo_visibility = 'blocked_privacy_processing', updated_at = now()
            where entry_id = $1::uuid`,
          [entryId],
        );
        const occurrenceId = current.rows[0]?.occurrence_id;
        if (occurrenceId) await createAdminPhotoFailureAlert(retryClient, entryId, occurrenceId, message.slice(0, 500));
      }
      await retryClient.query("commit");
      return { ok: true, status: finalFailure ? "failed_final" : "failed_retryable" };
    } catch (nested) {
      await retryClient.query("rollback");
      throw nested;
    } finally {
      retryClient.release();
    }
  } finally {
    client.release();
  }
}

export async function kickPlaceMemoryPhotoProcessingForVisit(visitId: string): Promise<void> {
  await ensurePlaceMemoryPhotoJobForVisit(visitId);
  const pool = getPool();
  const result = await pool.query<{ entry_id: string }>(
    `select entry_id::text
       from place_memory_entries
      where visit_id = $1
        and deleted_at is null
        and photo_echo_enabled = true
      limit 1`,
    [visitId],
  );
  const entryId = result.rows[0]?.entry_id;
  if (entryId) {
    await processPlaceMemoryPhoto(entryId);
  }
}

export async function requestPlaceMemoryPhotoReview(entryId: string, userId: string): Promise<{ ok: true }> {
  const pool = getPool();
  const result = await pool.query(
    `insert into place_memory_audit_events (entry_id, actor_user_id, event_kind, event_payload)
     select pme.entry_id, $2, 'photo_review_requested', jsonb_build_object('photoState', pme.photo_echo_visibility)
       from place_memory_entries pme
      where pme.entry_id = $1::uuid
        and pme.user_id = $2
        and pme.deleted_at is null
      returning audit_id`,
    [entryId, userId],
  );
  if (result.rows.length === 0) throw new Error("place_memory_not_found");
  return { ok: true };
}

export function placeMemoryTagLabelsJa(): Record<PlaceMemoryTag, string> {
  return {
    refresh_walk: "気分転換に歩いた",
    walked_with_someone: "誰かと歩いた",
    first_visit: "初めて来た",
    looked_for_life: "生きものを探した",
    revisit_compare: "前と比べに来た",
    season_change: "季節の変化を見た",
    unexpected_find: "思わず見つけた",
    quiet_moment: "静かな時間があった",
  };
}

export async function getPlaceMemoryUserPreferences(userId: string): Promise<PlaceMemoryUserPreferences> {
  const pool = getPool();
  const result = await pool.query<{
    default_photo_echo_enabled: boolean;
    default_tags_public: boolean;
  }>(
    `select default_photo_echo_enabled, default_tags_public
       from place_memory_user_preferences
      where user_id = $1
      limit 1`,
    [userId],
  );
  const row = result.rows[0];
  return {
    defaultPhotoEchoEnabled: row?.default_photo_echo_enabled !== false,
    defaultTagsPublic: row?.default_tags_public !== false,
  };
}

export async function updatePlaceMemoryUserPreferences(
  userId: string,
  input: Partial<PlaceMemoryUserPreferences>,
): Promise<PlaceMemoryUserPreferences> {
  const current = await getPlaceMemoryUserPreferences(userId);
  const next = {
    defaultPhotoEchoEnabled: typeof input.defaultPhotoEchoEnabled === "boolean"
      ? input.defaultPhotoEchoEnabled
      : current.defaultPhotoEchoEnabled,
    defaultTagsPublic: typeof input.defaultTagsPublic === "boolean"
      ? input.defaultTagsPublic
      : current.defaultTagsPublic,
  };
  const pool = getPool();
  const result = await pool.query<{
    default_photo_echo_enabled: boolean;
    default_tags_public: boolean;
  }>(
    `insert into place_memory_user_preferences (
        user_id, default_photo_echo_enabled, default_tags_public, updated_at
     ) values ($1, $2, $3, now())
     on conflict (user_id) do update set
        default_photo_echo_enabled = excluded.default_photo_echo_enabled,
        default_tags_public = excluded.default_tags_public,
        updated_at = now()
     returning default_photo_echo_enabled, default_tags_public`,
    [userId, next.defaultPhotoEchoEnabled, next.defaultTagsPublic],
  );
  const row = result.rows[0];
  return {
    defaultPhotoEchoEnabled: row?.default_photo_echo_enabled !== false,
    defaultTagsPublic: row?.default_tags_public !== false,
  };
}

export type PlaceMemoryVisitSort = "recent" | "frequent" | "seasonal";

export type PlaceMemoryVisitItem = {
  placeId: string;
  placeName: string;
  municipality: string | null;
  lastObservedAt: string;
  previousObservedAt: string | null;
  firstObservedAt: string | null;
  visitCount: number;
  latestVisitId: string | null;
  latestDisplayName: string | null;
  latestPhotoUrl: string | null;
  revisitReason: string | null;
  nextLookFor: string | null;
  lastRecordMode: string | null;
  lastSurveyResult: string | null;
  absenceSemantics: string | null;
  latitude: number | null;
  longitude: number | null;
  seasonalVisitCount: number;
  currentSeasonVisited: boolean;
};

type PlaceMemoryVisitRow = {
  place_id: string;
  place_name: string | null;
  municipality: string | null;
  last_observed_at: string;
  previous_observed_at: string | null;
  first_observed_at: string | null;
  visit_count: string;
  latest_visit_id: string | null;
  latest_display_name: string | null;
  latest_photo_url: string | null;
  last_record_mode: string | null;
  last_survey_result: string | null;
  absence_semantics: string | null;
  target_taxa_scope: string | null;
  source_payload: Record<string, unknown> | null;
  latitude: number | null;
  longitude: number | null;
  seasonal_visit_count: string;
  current_season_visit_count: string;
};

export function normalizePlaceMemoryVisitSort(value: unknown): PlaceMemoryVisitSort {
  return value === "frequent" || value === "seasonal" || value === "recent" ? value : "recent";
}

function placeMemoryVisitSortSql(sort: PlaceMemoryVisitSort): string {
  if (sort === "frequent") {
    return "stats.visit_count::int desc, latest_visit.observed_at desc";
  }
  if (sort === "seasonal") {
    return `case when stats.seasonal_visit_count > 0 and stats.current_season_visit_count = 0 then 0 else 1 end asc,
            stats.seasonal_visit_count desc,
            latest_visit.observed_at asc`;
  }
  return "latest_visit.observed_at desc";
}

function normalizeAssetUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) return value;
  return `/${value.replace(/^\.?\//, "")}`;
}

export async function listPlaceMemoryVisits(
  userId: string,
  options: { limit?: number; sort?: PlaceMemoryVisitSort } = {},
): Promise<PlaceMemoryVisitItem[]> {
  const limit = Math.max(1, Math.min(24, Math.trunc(options.limit ?? 12)));
  const sort = normalizePlaceMemoryVisitSort(options.sort);
  const pool = getPool();
  const result = await pool.query<PlaceMemoryVisitRow>(
    `with ordered_place_visits as (
        select
          v.*,
          lag(v.observed_at) over (partition by v.place_id order by v.observed_at asc, v.visit_id asc) as previous_observed_at
        from visits v
        where v.user_id = $1
          and v.place_id is not null
          and v.place_id not like 'place:unlocated:%'
          and coalesce(v.public_visibility, 'public') <> 'hidden'
      ),
      visit_windows as (
        select
          *,
          sum(
            case
              when previous_observed_at is null
                or observed_at - previous_observed_at > ${CONTINUOUS_VISIT_GAP_INTERVAL_SQL}
              then 1
              else 0
            end
          ) over (partition by place_id order by observed_at asc, visit_id asc) as visit_window_index
        from ordered_place_visits
      ),
      place_window_stats as (
        select
          place_id,
          visit_window_index,
          min(observed_at) as first_observed_at,
          max(observed_at) as last_observed_at
        from visit_windows
        group by place_id, visit_window_index
      ),
      place_stats as (
        select
          place_id,
          count(*)::text as visit_count,
          min(first_observed_at)::text as first_observed_at,
          max(last_observed_at)::text as last_observed_at,
          count(*) filter (
            where case
              when extract(month from last_observed_at) in (3, 4, 5) then 'spring'
              when extract(month from last_observed_at) in (6, 7, 8) then 'summer'
              when extract(month from last_observed_at) in (9, 10, 11) then 'autumn'
              else 'winter'
            end = case
              when extract(month from now()) in (3, 4, 5) then 'spring'
              when extract(month from now()) in (6, 7, 8) then 'summer'
              when extract(month from now()) in (9, 10, 11) then 'autumn'
              else 'winter'
            end
          )::text as seasonal_visit_count,
          count(*) filter (
            where extract(year from last_observed_at) = extract(year from now())
              and case
                when extract(month from last_observed_at) in (3, 4, 5) then 'spring'
                when extract(month from last_observed_at) in (6, 7, 8) then 'summer'
                when extract(month from last_observed_at) in (9, 10, 11) then 'autumn'
                else 'winter'
              end = case
                when extract(month from now()) in (3, 4, 5) then 'spring'
                when extract(month from now()) in (6, 7, 8) then 'summer'
                when extract(month from now()) in (9, 10, 11) then 'autumn'
                else 'winter'
              end
          )::text as current_season_visit_count
        from place_window_stats
        group by place_id
      )
      select
        p.place_id,
        coalesce(nullif(p.canonical_name, ''), nullif(p.locality_label, ''), p.place_id) as place_name,
        p.municipality,
        stats.last_observed_at,
        previous_visit.previous_observed_at,
        stats.first_observed_at,
        stats.visit_count,
        latest_visit.visit_id as latest_visit_id,
        latest_subject.display_name as latest_display_name,
        latest_photo.public_url as latest_photo_url,
        latest_visit.visit_mode as last_record_mode,
        latest_visit.source_payload,
        latest_visit.source_payload->>'survey_result' as last_survey_result,
        latest_visit.source_payload->>'absence_semantics' as absence_semantics,
        latest_visit.target_taxa_scope,
        coalesce(latest_visit.point_latitude, p.center_latitude)::float8 as latitude,
        coalesce(latest_visit.point_longitude, p.center_longitude)::float8 as longitude,
        stats.seasonal_visit_count,
        stats.current_season_visit_count
      from place_stats stats
      join places p on p.place_id = stats.place_id
      join lateral (
        select
          v.visit_id,
          v.observed_at,
          v.visit_mode,
          v.target_taxa_scope,
          v.source_payload,
          v.point_latitude,
          v.point_longitude
        from visits v
        where v.user_id = $1
          and v.place_id = stats.place_id
          and coalesce(v.public_visibility, 'public') <> 'hidden'
        order by v.observed_at desc, v.visit_id desc
        limit 1
      ) latest_visit on true
      left join lateral (
        select window_stats.last_observed_at::text as previous_observed_at
        from place_window_stats window_stats
        where window_stats.place_id = stats.place_id
        order by window_stats.last_observed_at desc
        offset 1
        limit 1
      ) previous_visit on true
      left join lateral (
        select coalesce(nullif(o.vernacular_name, ''), nullif(o.scientific_name, ''), nullif(ai.recommended_taxon_name, '')) as display_name
        from occurrences o
        left join lateral (
          select recommended_taxon_name
            from observation_ai_assessments a
           where a.occurrence_id = o.occurrence_id
           order by generated_at desc
           limit 1
        ) ai on true
        where o.visit_id = latest_visit.visit_id
        order by
          case when coalesce(nullif(o.vernacular_name, ''), nullif(o.scientific_name, ''), nullif(ai.recommended_taxon_name, '')) is null then 1 else 0 end,
          o.subject_index asc
        limit 1
      ) latest_subject on true
      left join lateral (
        select coalesce(ab.public_url, ab.storage_path) as public_url
        from evidence_assets ea
        join asset_blobs ab on ab.blob_id = ea.blob_id
        where ea.visit_id = latest_visit.visit_id
          and ${VALID_OBSERVATION_PHOTO_ASSET_SQL}
        order by
          case when ea.occurrence_id is not null then 0 else 1 end,
          ea.created_at asc
        limit 1
      ) latest_photo on true
      order by ${placeMemoryVisitSortSql(sort)}
      limit $2`,
    [userId, limit],
  );

  return result.rows.map((row) => {
    const visitPayload = (row.source_payload && typeof row.source_payload === "object")
      ? row.source_payload
      : {};
    const revisitReason = typeof visitPayload.revisit_reason === "string"
      ? visitPayload.revisit_reason.trim()
      : "";
    const nextLookFor = typeof visitPayload.next_look_for === "string"
      ? visitPayload.next_look_for.trim()
      : "";
    const seasonalVisitCount = Number(row.seasonal_visit_count) || 0;
    return {
      placeId: row.place_id,
      placeName: row.place_name ?? row.place_id,
      municipality: row.municipality,
      lastObservedAt: row.last_observed_at,
      previousObservedAt: row.previous_observed_at,
      firstObservedAt: row.first_observed_at,
      visitCount: Number(row.visit_count) || 0,
      latestVisitId: row.latest_visit_id,
      latestDisplayName: row.latest_display_name,
      latestPhotoUrl: normalizeAssetUrl(row.latest_photo_url),
      revisitReason: revisitReason || null,
      nextLookFor: nextLookFor || row.target_taxa_scope || row.latest_display_name || null,
      lastRecordMode: row.last_record_mode,
      lastSurveyResult: row.last_survey_result,
      absenceSemantics: row.absence_semantics,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
      seasonalVisitCount,
      currentSeasonVisited: (Number(row.current_season_visit_count) || 0) > 0,
    };
  });
}
