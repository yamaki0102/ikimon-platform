import { createHash, randomUUID } from "node:crypto";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";
import { getPool } from "../db.js";
import { resolveLegacyRoots } from "../legacy/legacyRoots.js";
import {
  assessLegacyObservationQuality,
  shouldQuarantineLegacyNoPhoto,
  upsertLegacyObservationQualityReview,
} from "../services/observationQualityGate.js";

type JsonRecord = Record<string, unknown>;

type ImportOptions = {
  legacyDataRoot: string;
  uploadsRoot: string;
  publicRoot?: string;
  importVersion: string;
  dryRun: boolean;
};

type LegacyUser = JsonRecord & {
  id: string;
  name?: string;
  email?: string;
  password_hash?: string | null;
  role?: string;
  rank?: string;
  avatar?: string;
  auth_provider?: string;
  oauth_id?: string | null;
  observer_rank?: JsonRecord;
  banned?: boolean;
  is_seed?: boolean;
  created_at?: string;
  last_login_at?: string | null;
};

type LegacyAuthToken = JsonRecord & {
  user_id: string;
  token_hash: string;
  expires?: number | string;
  created_at?: string;
  ip?: string;
  user_data?: JsonRecord;
};

type LegacyInvite = JsonRecord & {
  id?: string;
  code?: string;
  user_id?: string;
  accept_count?: number;
  accepted_users?: unknown[];
  created_at?: string;
};

type LegacyObservation = JsonRecord & {
  id: string;
  user_id?: string;
  user_name?: string;
  user_avatar?: string;
  user_rank?: string;
  observed_at?: string;
  created_at?: string;
  updated_at?: string;
  lat?: number | string;
  lng?: number | string;
  municipality?: string;
  prefecture?: string;
  country?: string;
  note?: string;
  status?: string;
  taxon?: JsonRecord;
  photos?: unknown[];
  site_id?: string;
  site_name?: string;
  cultivation?: string;
  biome?: string;
  evidence_tags?: unknown[];
  substrate_tags?: unknown[];
  quality_grade?: string;
  data_quality?: string;
  ai_assessment_status?: string;
  best_supported_descendant_taxon?: string;
  coordinate_accuracy?: number | string;
};

type LegacyTrackSession = JsonRecord & {
  session_id: string;
  user_id?: string;
  field_id?: string | null;
  started_at?: string;
  updated_at?: string;
  point_count?: number;
  total_distance_m?: number;
  step_count?: number;
  points?: Array<{
    lat?: number;
    lng?: number;
    accuracy?: number;
    altitude?: number | null;
    timestamp?: number;
  }>;
};

type ImportSummary = {
  users: number;
  rememberTokens: number;
  invites: number;
  observations: number;
  occurrences: number;
  assets: number;
  trackVisits: number;
  trackPoints: number;
  missingAssets: number;
  orphanUsersFromObservations: number;
  quarantinedNoPhotoObservations: number;
};

const summary: ImportSummary = {
  users: 0,
  rememberTokens: 0,
  invites: 0,
  observations: 0,
  occurrences: 0,
  assets: 0,
  trackVisits: 0,
  trackPoints: 0,
  missingAssets: 0,
  orphanUsersFromObservations: 0,
  quarantinedNoPhotoObservations: 0,
};

function parseArgs(argv: string[]): ImportOptions {
  const resolvedRoots = resolveLegacyRoots(process.cwd(), {
    mirrorRoot: process.env.LEGACY_MIRROR_ROOT,
    legacyDataRoot: process.env.LEGACY_DATA_ROOT,
    uploadsRoot: process.env.LEGACY_UPLOADS_ROOT,
    publicRoot: process.env.LEGACY_PUBLIC_ROOT,
  });
  const options: ImportOptions = {
    legacyDataRoot: resolvedRoots.legacyDataRoot,
    uploadsRoot: resolvedRoots.uploadsRoot,
    publicRoot: resolvedRoots.publicRoot,
    importVersion: "legacy_bootstrap",
    dryRun: false,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg.startsWith("--legacy-data-root=")) {
      options.legacyDataRoot = path.resolve(arg.slice("--legacy-data-root=".length));
      continue;
    }

    if (arg.startsWith("--uploads-root=")) {
      options.uploadsRoot = path.resolve(arg.slice("--uploads-root=".length));
      continue;
    }

    if (arg.startsWith("--public-root=")) {
      options.publicRoot = path.resolve(arg.slice("--public-root=".length));
      continue;
    }

    if (arg.startsWith("--import-version=")) {
      options.importVersion = arg.slice("--import-version=".length).trim() || options.importVersion;
      continue;
    }

    if (arg.startsWith("--mirror-root=")) {
      const mirrorRoots = resolveLegacyRoots(process.cwd(), {
        mirrorRoot: arg.slice("--mirror-root=".length),
      });
      options.legacyDataRoot = mirrorRoots.legacyDataRoot;
      options.uploadsRoot = mirrorRoots.uploadsRoot;
      options.publicRoot = mirrorRoots.publicRoot;
    }
  }

  return options;
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  if (!(await exists(filePath))) {
    return fallback;
  }

  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

function toIsoTimestamp(value: unknown): string | null {
  if (typeof value === "number") {
    return new Date(value > 1_000_000_000_000 ? value : value * 1000).toISOString();
  }

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item !== "");
}

function normalizeIp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function upsertAssetBlob(
  pool: Pool,
  input: {
    storageBackend: string;
    storagePath: string;
    mediaType: string;
    mimeType?: string | null;
    publicUrl?: string | null;
    sha256?: string | null;
    bytes?: number | null;
    widthPx?: number | null;
    heightPx?: number | null;
    durationMs?: number | null;
    sourcePayload?: JsonRecord;
  },
): Promise<string> {
  const result = await pool.query<{ blob_id: string }>(
    `insert into asset_blobs (
        storage_backend, storage_path, media_type, mime_type, public_url, sha256, bytes,
        width_px, height_px, duration_ms, source_payload, created_at, updated_at
     ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now(), now()
     )
     on conflict (storage_backend, storage_path) do update set
        media_type = excluded.media_type,
        mime_type = coalesce(excluded.mime_type, asset_blobs.mime_type),
        public_url = coalesce(excluded.public_url, asset_blobs.public_url),
        sha256 = coalesce(excluded.sha256, asset_blobs.sha256),
        bytes = coalesce(excluded.bytes, asset_blobs.bytes),
        width_px = coalesce(excluded.width_px, asset_blobs.width_px),
        height_px = coalesce(excluded.height_px, asset_blobs.height_px),
        duration_ms = coalesce(excluded.duration_ms, asset_blobs.duration_ms),
        source_payload = excluded.source_payload,
        updated_at = now()
     returning blob_id`,
    [
      input.storageBackend,
      input.storagePath,
      input.mediaType,
      input.mimeType ?? null,
      input.publicUrl ?? null,
      input.sha256 ?? null,
      input.bytes ?? null,
      input.widthPx ?? null,
      input.heightPx ?? null,
      input.durationMs ?? null,
      JSON.stringify(input.sourcePayload ?? {}),
    ],
  );

  const blobId = result.rows[0]?.blob_id;
  if (!blobId) {
    throw new Error(`Failed to upsert asset blob for ${input.storageBackend}:${input.storagePath}`);
  }

  return blobId;
}

async function upsertAssetLedger(
  pool: Pool,
  input: {
    legacyRelativePath: string;
    storagePath: string | null;
    storageBackend: string;
    blobId: string | null;
    importVersion: string;
    sourceObservationId: string;
    assetExists: boolean;
    sha256: string | null;
    bytes: number | null;
    mimeType?: string | null;
  },
): Promise<string> {
  const result = await pool.query<{ asset_ledger_id: string }>(
    `insert into asset_ledger (
        asset_ledger_id, legacy_source, legacy_relative_path, logical_asset_type,
        storage_backend, storage_path, blob_id, import_status, skipped_reason,
        sha256, bytes, mime_type, import_version, imported_at, last_seen_at, metadata
     ) values (
        $1::uuid, 'legacy_fs', $2, 'observation_photo',
        $3, $4, $5::uuid, $6, $7, $8, $9, $10, $11, now(), now(), $12::jsonb
     )
     on conflict (legacy_source, legacy_relative_path, import_version) do update set
        storage_backend = excluded.storage_backend,
        storage_path = excluded.storage_path,
        blob_id = excluded.blob_id,
        import_status = excluded.import_status,
        skipped_reason = excluded.skipped_reason,
        sha256 = excluded.sha256,
        bytes = excluded.bytes,
        mime_type = excluded.mime_type,
        imported_at = excluded.imported_at,
        last_seen_at = now(),
        metadata = excluded.metadata
     returning asset_ledger_id`,
    [
      randomUUID(),
      input.legacyRelativePath,
      input.storageBackend,
      input.storagePath,
      input.blobId,
      input.assetExists ? "imported" : "skipped",
      input.assetExists ? null : "missing_asset_file",
      input.sha256,
      input.bytes,
      input.mimeType ?? null,
      input.importVersion,
      JSON.stringify({
        source_observation_id: input.sourceObservationId,
        importer: "bootstrapLegacyImport",
        storage_path: input.storagePath,
      }),
    ],
  );

  const assetLedgerId = result.rows[0]?.asset_ledger_id;
  if (!assetLedgerId) {
    throw new Error(`Failed to upsert asset ledger for ${input.legacyRelativePath}`);
  }

  return assetLedgerId;
}

function buildPlaceId(observation: LegacyObservation): string {
  const siteId = typeof observation.site_id === "string" ? observation.site_id.trim() : "";
  if (siteId !== "") {
    return `site:${siteId}`;
  }

  const lat = asFiniteNumber(observation.lat);
  const lng = asFiniteNumber(observation.lng);
  if (lat !== null && lng !== null) {
    return `geo:${lat.toFixed(3)}:${lng.toFixed(3)}`;
  }

  const municipality = typeof observation.municipality === "string" ? observation.municipality.trim() : "";
  const prefecture = typeof observation.prefecture === "string" ? observation.prefecture.trim() : "";
  if (municipality !== "" || prefecture !== "") {
    return `locality:${prefecture}:${municipality}`;
  }

  return "place:unknown";
}

function buildPlaceName(observation: LegacyObservation): string {
  const siteName = typeof observation.site_name === "string" ? observation.site_name.trim() : "";
  if (siteName !== "") {
    return siteName;
  }

  const municipality = typeof observation.municipality === "string" ? observation.municipality.trim() : "";
  const prefecture = typeof observation.prefecture === "string" ? observation.prefecture.trim() : "";
  if (municipality !== "" || prefecture !== "") {
    return [municipality, prefecture].filter(Boolean).join(" / ");
  }

  return "Legacy Imported Place";
}

function resolveAssetCandidatePaths(relativePath: string, options: ImportOptions): string[] {
  const normalized = normalizeRelativePath(relativePath);
  const candidates: string[] = [];

  if (normalized.startsWith("uploads/")) {
    candidates.push(path.join(options.uploadsRoot, normalized.slice("uploads/".length)));
    if (options.publicRoot) {
      candidates.push(path.join(options.publicRoot, normalized));
    }
  } else if (normalized.startsWith("data/uploads/")) {
    candidates.push(path.join(options.legacyDataRoot, normalized.slice("data/".length)));
  } else if (options.publicRoot) {
    candidates.push(path.join(options.publicRoot, normalized));
  }

  return [...new Set(candidates)];
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

async function sha256ForFile(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

async function loadLegacyUsers(options: ImportOptions): Promise<Map<string, LegacyUser>> {
  const usersPath = path.join(options.legacyDataRoot, "users.json");
  const users = await readJsonFile<LegacyUser[]>(usersPath, []);
  const map = new Map<string, LegacyUser>();

  for (const user of users) {
    if (user.id) {
      map.set(user.id, user);
    }
  }

  return map;
}

async function loadLegacyObservations(options: ImportOptions): Promise<LegacyObservation[]> {
  const rootObservations = await readJsonFile<LegacyObservation[]>(
    path.join(options.legacyDataRoot, "observations.json"),
    [],
  );

  const partitionDir = path.join(options.legacyDataRoot, "observations");
  const partitionFiles = (await exists(partitionDir))
    ? (await readdir(partitionDir)).filter((name) => name.endsWith(".json")).sort()
    : [];

  const deduped = new Map<string, LegacyObservation>();
  for (const observation of rootObservations) {
    if (observation.id) {
      deduped.set(observation.id, observation);
    }
  }

  for (const filename of partitionFiles) {
    const batch = await readJsonFile<LegacyObservation[]>(path.join(partitionDir, filename), []);
    for (const observation of batch) {
      if (observation.id) {
        deduped.set(observation.id, observation);
      }
    }
  }

  return [...deduped.values()].sort((left, right) => {
    const leftTime = toIsoTimestamp(left.observed_at ?? left.created_at) ?? "";
    const rightTime = toIsoTimestamp(right.observed_at ?? right.created_at) ?? "";
    return leftTime.localeCompare(rightTime);
  });
}

async function loadLegacyAuthTokens(options: ImportOptions): Promise<LegacyAuthToken[]> {
  return readJsonFile<LegacyAuthToken[]>(path.join(options.legacyDataRoot, "auth_tokens.json"), []);
}

async function loadLegacyInvites(options: ImportOptions): Promise<LegacyInvite[]> {
  return readJsonFile<LegacyInvite[]>(path.join(options.legacyDataRoot, "invites.json"), []);
}

async function loadLegacyTracks(options: ImportOptions): Promise<LegacyTrackSession[]> {
  const tracksRoot = path.join(options.legacyDataRoot, "tracks");
  if (!(await exists(tracksRoot))) {
    return [];
  }

  const sessions: LegacyTrackSession[] = [];
  const userDirs = await readdir(tracksRoot);
  for (const userDir of userDirs) {
    const userRoot = path.join(tracksRoot, userDir);
    const userStat = await stat(userRoot);
    if (!userStat.isDirectory()) {
      continue;
    }

    const files = (await readdir(userRoot)).filter((name) => name.endsWith(".json")).sort();
    for (const filename of files) {
      const session = await readJsonFile<LegacyTrackSession | null>(path.join(userRoot, filename), null);
      if (session?.session_id) {
        sessions.push(session);
      }
    }
  }

  return sessions;
}

function mergeLegacyUser(existing: LegacyUser | undefined, incoming: LegacyUser): LegacyUser {
  if (!existing) {
    return incoming;
  }

  return {
    ...incoming,
    ...existing,
    observer_rank: existing.observer_rank ?? incoming.observer_rank,
  };
}

function supplementUsersFromAuthTokens(
  legacyUsers: Map<string, LegacyUser>,
  tokens: LegacyAuthToken[],
) {
  for (const token of tokens) {
    const tokenUserId = typeof token.user_id === "string" ? token.user_id : "";
    if (tokenUserId === "") {
      continue;
    }

    const tokenUserData = token.user_data;
    if (!tokenUserData || typeof tokenUserData !== "object") {
      continue;
    }

    const incoming: LegacyUser = {
      id: tokenUserId,
      name: typeof tokenUserData.name === "string" ? tokenUserData.name : tokenUserId,
      email: typeof tokenUserData.email === "string" ? tokenUserData.email : undefined,
      password_hash: typeof tokenUserData.password_hash === "string" ? tokenUserData.password_hash : undefined,
      role: typeof tokenUserData.role === "string" ? tokenUserData.role : undefined,
      rank: typeof tokenUserData.rank === "string" ? tokenUserData.rank : undefined,
      avatar: typeof tokenUserData.avatar === "string" ? tokenUserData.avatar : undefined,
      auth_provider: typeof tokenUserData.auth_provider === "string" ? tokenUserData.auth_provider : undefined,
      oauth_id: typeof tokenUserData.oauth_id === "string" ? tokenUserData.oauth_id : undefined,
      banned: Boolean(tokenUserData.banned),
      is_seed: Boolean(tokenUserData.is_seed),
      created_at: typeof tokenUserData.created_at === "string" ? tokenUserData.created_at : undefined,
      last_login_at: typeof tokenUserData.last_login_at === "string" ? tokenUserData.last_login_at : undefined,
      observer_rank:
        tokenUserData.observer_rank && typeof tokenUserData.observer_rank === "object"
          ? (tokenUserData.observer_rank as JsonRecord)
          : undefined,
    };

    legacyUsers.set(tokenUserId, mergeLegacyUser(legacyUsers.get(tokenUserId), incoming));
  }
}

function supplementUsersFromInvites(
  legacyUsers: Map<string, LegacyUser>,
  invites: LegacyInvite[],
) {
  for (const invite of invites) {
    const ownerUserId = typeof invite.user_id === "string" ? invite.user_id : "";
    if (ownerUserId === "") {
      continue;
    }

    const incoming: LegacyUser = {
      id: ownerUserId,
      name: ownerUserId,
      rank: "観察者",
      auth_provider: "legacy_invite_owner",
    };

    legacyUsers.set(ownerUserId, mergeLegacyUser(legacyUsers.get(ownerUserId), incoming));
  }
}

function supplementUsersFromTracks(
  legacyUsers: Map<string, LegacyUser>,
  tracks: LegacyTrackSession[],
) {
  for (const session of tracks) {
    const userId = typeof session.user_id === "string" ? session.user_id : "";
    if (userId === "") {
      continue;
    }

    const incoming: LegacyUser = {
      id: userId,
      name: userId,
      rank: "観察者",
      auth_provider: "legacy_track_session",
    };

    legacyUsers.set(userId, mergeLegacyUser(legacyUsers.get(userId), incoming));
  }
}

async function importUsers(
  options: ImportOptions,
  legacyUsers: Map<string, LegacyUser>,
  observations: LegacyObservation[],
) {
  for (const observation of observations) {
    const observationUserId = typeof observation.user_id === "string" ? observation.user_id : "";
    if (observationUserId === "" || legacyUsers.has(observationUserId)) {
      continue;
    }

    summary.orphanUsersFromObservations += 1;
    legacyUsers.set(observationUserId, {
      id: observationUserId,
      name: typeof observation.user_name === "string" ? observation.user_name : observationUserId,
      avatar: typeof observation.user_avatar === "string" ? observation.user_avatar : undefined,
      rank: typeof observation.user_rank === "string" ? observation.user_rank : "観察者",
      auth_provider: "legacy_embedded",
      created_at: observation.created_at,
      last_login_at: observation.updated_at ?? observation.created_at,
      metadata: {
        orphan_from_observation: observation.id,
      },
    });
  }

  if (options.dryRun) {
    summary.users = legacyUsers.size;
    return;
  }

  const pool = getPool();
  for (const user of legacyUsers.values()) {
    let avatarAssetId: string | null = null;
    const normalizedEmail = user.email?.toLowerCase() ?? null;
    if (typeof user.avatar === "string" && user.avatar.startsWith("uploads/")) {
      avatarAssetId = randomUUID();
      const legacyAssetKey = `avatar:${user.id}`;
      const candidates = resolveAssetCandidatePaths(user.avatar, options);
      let sha256: string | null = null;
      let bytes: number | null = null;
      let storagePath = user.avatar;

      for (const candidate of candidates) {
        if (await exists(candidate)) {
          sha256 = await sha256ForFile(candidate);
          bytes = (await stat(candidate)).size;
          storagePath = candidate;
          break;
        }
      }

      const blobId = await upsertAssetBlob(pool, {
        storageBackend: "legacy_fs",
        storagePath,
        mediaType: "image",
        publicUrl: user.avatar,
        sha256,
        bytes,
        sourcePayload: {
          imported_from: "legacy_user_avatar",
          legacy_relative_path: user.avatar,
        },
      });

      await pool.query(
        `insert into evidence_assets (
            asset_id, blob_id, asset_role, legacy_asset_key, legacy_relative_path, source_payload
         ) values ($1, $2::uuid, 'avatar', $3, $4, $5::jsonb)
         on conflict (legacy_asset_key) do update set
            blob_id = excluded.blob_id,
            legacy_relative_path = excluded.legacy_relative_path,
            source_payload = excluded.source_payload`,
        [
          avatarAssetId,
          blobId,
          legacyAssetKey,
          user.avatar,
          JSON.stringify({
            imported_from: "legacy_user_avatar",
            legacy_relative_path: user.avatar,
          }),
        ],
      );
    }

    if (normalizedEmail) {
      // Staging can retain stale rows from older rehearsal imports under different user_ids.
      // The current legacy mirror wins, so release conflicting emails before upserting.
      await pool.query(
        `update users
         set email = null,
             updated_at = now()
         where user_id <> $1
           and lower(coalesce(email, '')) = $2`,
        [user.id, normalizedEmail],
      );
    }

    await pool.query(
      `insert into users (
          user_id, legacy_user_id, display_name, email, password_hash, avatar_asset_id,
          role_name, rank_label, auth_provider, oauth_id, observer_rank_json,
          stats_json, is_seed, banned, created_at, updated_at, last_login_at
       ) values (
          $1, $2, $3, $4, $5, $6::uuid, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13, $14, $15, now(), $16
       )
       on conflict (user_id) do update set
          display_name = excluded.display_name,
          email = excluded.email,
          password_hash = excluded.password_hash,
          avatar_asset_id = excluded.avatar_asset_id,
          role_name = excluded.role_name,
          rank_label = excluded.rank_label,
          auth_provider = excluded.auth_provider,
          oauth_id = excluded.oauth_id,
          observer_rank_json = excluded.observer_rank_json,
          stats_json = excluded.stats_json,
          is_seed = excluded.is_seed,
          banned = excluded.banned,
          last_login_at = excluded.last_login_at,
          updated_at = now()`,
      [
        user.id,
        user.id,
        user.name ?? user.id,
        normalizedEmail,
        user.password_hash ?? null,
        avatarAssetId,
        user.role ?? "Observer",
        user.rank ?? "観察者",
        user.auth_provider ?? "local",
        user.oauth_id ?? null,
        JSON.stringify(user.observer_rank ?? {}),
        JSON.stringify({
          post_count: user.post_count ?? null,
          score: user.score ?? null,
          source: "legacy_import",
        }),
        Boolean(user.is_seed),
        Boolean(user.banned),
        toIsoTimestamp(user.created_at) ?? new Date().toISOString(),
        toIsoTimestamp(user.last_login_at),
      ],
    );

    await pool.query(
      `insert into legacy_id_map (
          legacy_source, legacy_entity_type, legacy_id, canonical_entity_type, canonical_id, metadata
       ) values ('legacy_json', 'user', $1, 'user', $2, $3::jsonb)
       on conflict (legacy_source, legacy_entity_type, legacy_id)
       do update set canonical_id = excluded.canonical_id, metadata = excluded.metadata`,
      [user.id, user.id, JSON.stringify({ imported_at: new Date().toISOString() })],
    );

    if (user.auth_provider && user.auth_provider !== "local" && user.oauth_id) {
      await pool.query(
        `insert into oauth_accounts (
            user_id, provider, provider_user_id, provider_email, profile_json
         ) values ($1, $2, $3, $4, $5::jsonb)
         on conflict (provider, provider_user_id)
         do update set user_id = excluded.user_id, provider_email = excluded.provider_email, profile_json = excluded.profile_json`,
        [
          user.id,
          user.auth_provider,
          user.oauth_id,
          normalizedEmail,
          JSON.stringify({ source: "legacy_user_record" }),
        ],
      );
    }

    summary.users += 1;
  }
}

async function importRememberTokens(options: ImportOptions, tokens: LegacyAuthToken[]) {
  summary.rememberTokens = tokens.length;
  if (options.dryRun) {
    return;
  }

  const pool = getPool();
  const sourceTokenHashes = [
    ...new Set(
      tokens
        .map((token) => token.token_hash)
        .filter((tokenHash): tokenHash is string => typeof tokenHash === "string" && tokenHash !== ""),
    ),
  ];

  for (const token of tokens) {
    await pool.query(
      `insert into remember_tokens (
          user_id, token_hash, token_family, user_agent, ip_address, expires_at, created_at
       ) values ($1, $2, $3, $4, $5::inet, $6, $7)
       on conflict (token_hash) do update set
          user_id = excluded.user_id,
          expires_at = excluded.expires_at,
          last_used_at = remember_tokens.last_used_at`,
      [
        token.user_id,
        token.token_hash,
        "legacy",
        null,
        normalizeIp(token.ip),
        toIsoTimestamp(token.expires) ?? new Date(Date.now() + 90 * 86400 * 1000).toISOString(),
        toIsoTimestamp(token.created_at) ?? new Date().toISOString(),
      ],
    );
  }

  if (sourceTokenHashes.length > 0) {
    await pool.query(
      `delete from remember_tokens
       where token_family = 'legacy'
         and not (token_hash = any($1::text[]))`,
      [sourceTokenHashes],
    );
  }
}

async function importInvites(options: ImportOptions, invites: LegacyInvite[]) {
  summary.invites = invites.length;
  if (options.dryRun) {
    return;
  }

  const pool = getPool();
  for (const invite of invites) {
    const code = typeof invite.code === "string" ? invite.code : "";
    if (code === "") {
      continue;
    }

    const inviteId = typeof invite.id === "string" ? invite.id : `invite:${code}`;
    await pool.query(
      `insert into invites (
          invite_id, legacy_code, owner_user_id, code, accept_count, accepted_user_ids, created_at, metadata
       ) values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb)
       on conflict (invite_id) do update set
          owner_user_id = excluded.owner_user_id,
          accept_count = excluded.accept_count,
          accepted_user_ids = excluded.accepted_user_ids,
          metadata = excluded.metadata`,
      [
        inviteId,
        code,
        typeof invite.user_id === "string" ? invite.user_id : null,
        code,
        Number.isFinite(invite.accept_count) ? invite.accept_count : 0,
        JSON.stringify(Array.isArray(invite.accepted_users) ? invite.accepted_users : []),
        toIsoTimestamp(invite.created_at) ?? new Date().toISOString(),
        JSON.stringify({ source: "legacy_invites_json" }),
      ],
    );
  }
}

async function importObservations(options: ImportOptions, observations: LegacyObservation[]) {
  summary.observations = 0;
  summary.occurrences = 0;
  const pool = options.dryRun ? null : getPool();

  if (pool) {
    await pool.query(
      `delete from asset_ledger
       where import_version = $1
         and logical_asset_type = 'observation_photo'`,
      [options.importVersion],
    );
  }

  for (const observation of observations) {
    const visitId = observation.id;
    const occurrenceId = `occ:${observation.id}:0`;
    const placeId = buildPlaceId(observation);
    const observedAt = toIsoTimestamp(observation.observed_at ?? observation.created_at) ?? new Date().toISOString();
    const latitude = asFiniteNumber(observation.lat);
    const longitude = asFiniteNumber(observation.lng);
    const qualitySignals = assessLegacyObservationQuality(observation);

    if (shouldQuarantineLegacyNoPhoto(observation)) {
      summary.quarantinedNoPhotoObservations += 1;
      if (!options.dryRun && pool) {
        await upsertLegacyObservationQualityReview(pool, {
          observation,
          importVersion: options.importVersion,
          reasonCode: "legacy_no_photo",
          reasonDetail: "Legacy observation has no photo evidence and is quarantined instead of imported.",
          legacyPath: "data/observations",
        });
        await pool.query(
          `update visits
           set public_visibility = 'review',
               quality_review_status = 'needs_review',
               quality_gate_reasons = $2::jsonb,
               updated_at = now()
           where visit_id = $1`,
          [visitId, JSON.stringify(qualitySignals.gateReasons)],
        );
      }
      continue;
    }

    if (!options.dryRun && pool) {
      await pool.query(
        `insert into places (
            place_id, legacy_place_key, legacy_site_id, canonical_name, locality_label,
            source_kind, country_code, prefecture, municipality, center_latitude, center_longitude, metadata, created_at, updated_at
         ) values (
            $1, $2, $3, $4, $5, 'legacy_observation', $6, $7, $8, $9, $10, $11::jsonb, $12, now()
         )
         on conflict (place_id) do update set
            canonical_name = excluded.canonical_name,
            locality_label = excluded.locality_label,
            legacy_site_id = excluded.legacy_site_id,
            municipality = excluded.municipality,
            prefecture = excluded.prefecture,
            center_latitude = coalesce(excluded.center_latitude, places.center_latitude),
            center_longitude = coalesce(excluded.center_longitude, places.center_longitude),
            updated_at = now()`,
        [
          placeId,
          placeId,
          observation.site_id ?? null,
          buildPlaceName(observation),
          observation.site_name ?? observation.municipality ?? null,
          observation.country ?? "JP",
          observation.prefecture ?? null,
          observation.municipality ?? null,
          latitude,
          longitude,
          JSON.stringify({
            source_observation_id: observation.id,
            imported_from: "legacy_observations_json",
          }),
          observedAt,
        ],
      );

      await pool.query(
        `insert into visits (
            visit_id, legacy_observation_id, place_id, user_id, observed_at, session_mode, visit_mode,
            complete_checklist_flag, target_taxa_scope, point_latitude, point_longitude, coordinate_uncertainty_m,
            observed_country, observed_prefecture, observed_municipality, locality_note, note,
            source_kind, source_payload, created_at, updated_at
         ) values (
            $1, $2, $3, $4, $5, $6, 'manual', false, null, $7, $8,
            $9, $10, $11, $12, $13, $14, 'legacy_observation', $15::jsonb, $16, now()
         )
         on conflict (visit_id) do update set
            place_id = excluded.place_id,
            user_id = excluded.user_id,
            observed_at = excluded.observed_at,
            point_latitude = coalesce(excluded.point_latitude, visits.point_latitude),
            point_longitude = coalesce(excluded.point_longitude, visits.point_longitude),
            coordinate_uncertainty_m = excluded.coordinate_uncertainty_m,
            observed_country = excluded.observed_country,
            observed_prefecture = excluded.observed_prefecture,
            observed_municipality = excluded.observed_municipality,
            note = excluded.note,
            source_payload = excluded.source_payload,
            updated_at = now()`,
        [
          visitId,
          observation.id,
          placeId,
          observation.user_id ?? null,
          observedAt,
          observation.status ?? null,
          latitude,
          longitude,
          asFiniteNumber(observation.coordinate_accuracy),
          observation.country ?? "JP",
          observation.prefecture ?? null,
          observation.municipality ?? null,
          observation.site_name ?? null,
          observation.note ?? null,
          JSON.stringify(observation),
          toIsoTimestamp(observation.created_at) ?? observedAt,
        ],
      );

      await pool.query(
        `insert into occurrences (
            occurrence_id, visit_id, legacy_observation_id, subject_index, scientific_name, vernacular_name,
            taxon_rank, taxon_concept_version, basis_of_record, organism_origin, cultivation,
            occurrence_status, confidence_score, evidence_tier, data_quality, quality_grade,
            ai_assessment_status, best_supported_descendant_taxon, biome, substrate_tags, evidence_tags,
            source_payload, created_at, updated_at
         ) values (
            $1, $2, $3, 0, $4, $5, $6, 'legacy', 'HumanObservation', null, $7,
            'present', null, 1, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb,
            $15::jsonb, $16, now()
         )
         on conflict (occurrence_id) do update set
            scientific_name = excluded.scientific_name,
            vernacular_name = excluded.vernacular_name,
            taxon_rank = excluded.taxon_rank,
            cultivation = excluded.cultivation,
            data_quality = excluded.data_quality,
            quality_grade = excluded.quality_grade,
            ai_assessment_status = excluded.ai_assessment_status,
            best_supported_descendant_taxon = excluded.best_supported_descendant_taxon,
            biome = excluded.biome,
            substrate_tags = excluded.substrate_tags,
            evidence_tags = excluded.evidence_tags,
            source_payload = excluded.source_payload,
            updated_at = now()`,
        [
          occurrenceId,
          visitId,
          observation.id,
          (observation.taxon?.scientific_name as string | undefined) ?? null,
          (observation.taxon?.name as string | undefined) ?? null,
          (observation.taxon?.rank as string | undefined) ?? null,
          observation.cultivation ?? null,
          observation.data_quality ?? null,
          observation.quality_grade ?? null,
          observation.ai_assessment_status ?? null,
          observation.best_supported_descendant_taxon ?? null,
          observation.biome ?? null,
          JSON.stringify(asStringArray(observation.substrate_tags)),
          JSON.stringify(asStringArray(observation.evidence_tags)),
          JSON.stringify(observation),
          toIsoTimestamp(observation.created_at) ?? observedAt,
        ],
      );

      const photos = Array.isArray(observation.photos) ? observation.photos : [];
      const legacyPhotoKeys = photos
        .map((photo, index) =>
          typeof photo === "string" && photo.trim() !== ""
            ? `observation_photo:${observation.id}:${index}:${photo.trim()}`
            : null,
        )
        .filter((value): value is string => value !== null);

      if (legacyPhotoKeys.length > 0) {
        await pool.query(
          `delete from evidence_assets
           where occurrence_id = $1
             and asset_role = 'observation_photo'
             and legacy_asset_key is not null
             and not (legacy_asset_key = any($2::text[]))`,
          [occurrenceId, legacyPhotoKeys],
        );
      } else {
        await pool.query(
          `delete from evidence_assets
           where occurrence_id = $1
             and asset_role = 'observation_photo'
             and legacy_asset_key is not null`,
          [occurrenceId],
        );
      }

      for (let index = 0; index < photos.length; index += 1) {
        const photo = photos[index];
        if (typeof photo !== "string" || photo.trim() === "") {
          continue;
        }

        const normalizedPhoto = normalizeRelativePath(photo.trim());
        const legacyAssetKey = `observation_photo:${observation.id}:${index}:${normalizedPhoto}`;

        let storagePath = photo;
        let sha256: string | null = null;
        let bytes: number | null = null;
        let assetExists = false;
        for (const candidate of resolveAssetCandidatePaths(normalizedPhoto, options)) {
          if (await exists(candidate)) {
            storagePath = candidate;
            sha256 = await sha256ForFile(candidate);
            bytes = (await stat(candidate)).size;
            assetExists = true;
            break;
          }
        }

        if (!assetExists) {
          summary.missingAssets += 1;
        }

        const blobId = await upsertAssetBlob(pool, {
          storageBackend: "legacy_fs",
          storagePath,
          mediaType: "image",
          publicUrl: photo,
          sha256,
          bytes,
          sourcePayload: {
            source_observation_id: observation.id,
            photo_index: index,
            asset_exists: assetExists,
            legacy_relative_path: photo,
          },
        });

        const assetLedgerId = await upsertAssetLedger(pool, {
          legacyRelativePath: normalizedPhoto,
          storagePath: assetExists ? storagePath : null,
          storageBackend: "legacy_fs",
          blobId: assetExists ? blobId : null,
          importVersion: options.importVersion,
          sourceObservationId: observation.id,
          assetExists,
          sha256,
          bytes,
        });

        await pool.query(
          `insert into evidence_assets (
              asset_id, blob_id, occurrence_id, visit_id, asset_role, legacy_asset_key, legacy_relative_path, source_payload
           ) values (
              $1::uuid, $2::uuid, $3, $4, 'observation_photo', $5, $6, $7::jsonb
           ) on conflict (legacy_asset_key) do update set
              blob_id = excluded.blob_id,
              occurrence_id = excluded.occurrence_id,
              visit_id = excluded.visit_id,
              legacy_relative_path = excluded.legacy_relative_path,
              source_payload = excluded.source_payload`,
          [
            randomUUID(),
            blobId,
            occurrenceId,
            visitId,
            legacyAssetKey,
            normalizedPhoto,
            JSON.stringify({
              asset_ledger_id: assetExists ? assetLedgerId : null,
              source_observation_id: observation.id,
              photo_index: index,
              asset_exists: assetExists,
            }),
          ],
        );
        summary.assets += 1;
      }

      const proposedName =
        typeof observation.taxon?.scientific_name === "string" && observation.taxon.scientific_name.trim() !== ""
          ? observation.taxon.scientific_name
          : typeof observation.taxon?.name === "string" && observation.taxon.name.trim() !== ""
            ? observation.taxon.name
            : null;

      const legacyIdentificationKey = `legacy_taxon:${occurrenceId}:primary`;

      if (!proposedName) {
        await pool.query(
          `delete from identifications
           where occurrence_id = $1
             and legacy_identification_key = $2`,
          [occurrenceId, legacyIdentificationKey],
        );
      }

      if (proposedName && observation.user_id) {
        await pool.query(
          `insert into identifications (
              occurrence_id, actor_user_id, actor_kind, proposed_name, proposed_rank, legacy_identification_key,
              identification_method, confidence_score, is_current, notes, source_payload
           ) values (
              $1, $2, 'human', $3, $4, $5, 'legacy_taxon_snapshot', null, true, null, $6::jsonb
           ) on conflict (legacy_identification_key) do update set
              occurrence_id = excluded.occurrence_id,
              actor_user_id = excluded.actor_user_id,
              proposed_name = excluded.proposed_name,
              proposed_rank = excluded.proposed_rank,
              identification_method = excluded.identification_method,
              is_current = excluded.is_current,
              notes = excluded.notes,
              source_payload = excluded.source_payload`,
          [
            occurrenceId,
            observation.user_id,
            proposedName,
            typeof observation.taxon?.rank === "string" ? observation.taxon.rank : null,
            legacyIdentificationKey,
            JSON.stringify({ imported_from: "legacy_observation_taxon" }),
          ],
        );
      }

      summary.observations += 1;
      summary.occurrences += 1;
    } else {
      summary.observations += 1;
      summary.occurrences += 1;
      summary.assets += Array.isArray(observation.photos) ? observation.photos.length : 0;
    }
  }
}

async function importTracks(options: ImportOptions, tracks: LegacyTrackSession[]) {
  summary.trackVisits = tracks.length;
  if (options.dryRun) {
    summary.trackPoints = tracks.reduce((sum, session) => sum + (session.points?.length ?? 0), 0);
    return;
  }

  const pool = getPool();
  for (const session of tracks) {
    const points = Array.isArray(session.points) ? session.points : [];
    const visitId = `track:${session.session_id}`;
    const firstPoint = points.find((point) => asFiniteNumber(point.lat) !== null && asFiniteNumber(point.lng) !== null);
    const observedAt = toIsoTimestamp(session.started_at ?? session.updated_at) ?? new Date().toISOString();
    const firstLat = asFiniteNumber(firstPoint?.lat);
    const firstLng = asFiniteNumber(firstPoint?.lng);
    const placeId =
      firstLat !== null && firstLng !== null
        ? `geo:${firstLat.toFixed(3)}:${firstLng.toFixed(3)}`
        : "place:unknown";

    await pool.query(
      `insert into places (
          place_id, legacy_place_key, canonical_name, source_kind, center_latitude, center_longitude, metadata, created_at, updated_at
       ) values (
          $1, $2, $3, 'legacy_track', $4, $5, $6::jsonb, $7, now()
       ) on conflict (place_id) do nothing`,
      [
        placeId,
        placeId,
        "Legacy Track Place",
        firstLat,
        firstLng,
        JSON.stringify({ field_id: session.field_id ?? null }),
        observedAt,
      ],
    );

    await pool.query(
      `insert into visits (
          visit_id, place_id, user_id, observed_at, session_mode, visit_mode, effort_minutes,
          distance_meters, step_count, point_latitude, point_longitude, source_kind, source_payload, created_at, updated_at
       ) values (
          $1, $2, $3, $4, 'fieldscan', 'track', null, $5, $6, $7, $8, 'legacy_track_session', $9::jsonb, $10, now()
       )
       on conflict (visit_id) do update set
          distance_meters = excluded.distance_meters,
          step_count = excluded.step_count,
          source_payload = excluded.source_payload,
          updated_at = now()`,
      [
        visitId,
        placeId,
        session.user_id ?? null,
        observedAt,
        asFiniteNumber(session.total_distance_m),
        Number.isFinite(session.step_count) ? session.step_count : null,
        firstLat,
        firstLng,
        JSON.stringify(session),
        observedAt,
      ],
    );

    let sequence = 0;
    await pool.query(`delete from visit_track_points where visit_id = $1`, [visitId]);
    for (const point of points) {
      const lat = asFiniteNumber(point.lat);
      const lng = asFiniteNumber(point.lng);
      if (lat === null || lng === null) {
          continue;
      }

      await pool.query(
        `insert into visit_track_points (
            visit_id, observed_at, sequence_no, point_latitude, point_longitude, accuracy_m, altitude_m, speed_mps, heading_degrees, raw_payload
         ) values (
            $1, $2, $3, $4, $5, $6, $7, null, null, $8::jsonb
         )`,
        [
          visitId,
          toIsoTimestamp(point.timestamp) ?? observedAt,
          sequence,
          lat,
          lng,
          asFiniteNumber(point.accuracy),
          asFiniteNumber(point.altitude),
          JSON.stringify(point),
        ],
      );

      summary.trackPoints += 1;
      sequence += 1;
    }
  }
}

async function ensureDatabaseReady() {
  const pool = getPool();
  const result = await pool.query<{ count: string }>(
    "select count(*)::text as count from information_schema.tables where table_schema = 'public'",
  );
  if ((result.rows[0]?.count ?? "0") === "0") {
    throw new Error("Database is empty. Run npm run migrate first.");
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log("bootstrapLegacyImport options", options);

  const legacyUsers = await loadLegacyUsers(options);
  const legacyObservations = await loadLegacyObservations(options);
  const legacyTokens = await loadLegacyAuthTokens(options);
  const legacyInvites = await loadLegacyInvites(options);
  const legacyTracks = await loadLegacyTracks(options);

  supplementUsersFromAuthTokens(legacyUsers, legacyTokens);
  supplementUsersFromInvites(legacyUsers, legacyInvites);
  supplementUsersFromTracks(legacyUsers, legacyTracks);

  if (!options.dryRun) {
    await ensureDatabaseReady();
  }

  await importUsers(options, legacyUsers, legacyObservations);
  await importRememberTokens(options, legacyTokens);
  await importInvites(options, legacyInvites);
  await importObservations(options, legacyObservations);
  await importTracks(options, legacyTracks);

  console.log(JSON.stringify(summary, null, 2));

  if (!options.dryRun) {
    await getPool().end();
  }
}

void main();
