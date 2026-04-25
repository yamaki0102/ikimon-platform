import path from "node:path";
import { getPool } from "../db.js";
import { ensureDir, readJsonArray, upsertById, writeJsonAtomic } from "./legacyJsonStore.js";

export type LegacyCompatibilityOptions = {
  legacyDataRoot: string;
  publicRoot?: string;
};

type CompatibilityWriteResult = {
  entityType: "user" | "observation" | "track" | "remember_token";
  canonicalId: string;
  legacyTarget: string;
};

type LegacyUserRecord = {
  id: string;
  name: string;
  email: string | null;
  password_hash: string | null;
  role: string;
  rank: string;
  auth_provider: string;
  oauth_id: string | null;
  avatar: string;
  created_at: string;
  last_login_at: string | null;
  banned: boolean;
};

type LegacyObservationRecord = Record<string, unknown> & {
  id: string;
};

type LegacyTrackRecord = {
  session_id: string;
  user_id: string;
  field_id: string | null;
  started_at: string;
  updated_at: string;
  points: Array<Record<string, unknown>>;
  point_count: number;
  total_distance_m: number | null;
  step_count: number | null;
};

type LegacyRememberTokenRecord = {
  user_id: string;
  token_hash: string;
  user_data: Record<string, unknown> | null;
  expires: number;
  created_at: string;
  ip: string | null;
};

function formatLegacyDateTime(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  const hh = `${date.getHours()}`.padStart(2, "0");
  const mi = `${date.getMinutes()}`.padStart(2, "0");
  const ss = `${date.getSeconds()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function formatIso(value: string | Date | null | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function partitionNameFromTimestamp(value: string | null | undefined): string {
  const date = value ? new Date(value) : new Date();
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${yyyy}-${mm}`;
}

async function writeLedger(
  entityType: CompatibilityWriteResult["entityType"],
  canonicalId: string,
  legacyTarget: string,
  status: string,
  details: Record<string, unknown>,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `insert into compatibility_write_ledger (
        entity_type, canonical_id, legacy_target, write_status, attempted_at, completed_at, details
     ) values (
        $1, $2, $3, $4, now(), now(), $5::jsonb
     )`,
    [entityType, canonicalId, legacyTarget, status, JSON.stringify(details)],
  );
}

export async function writeLegacyUser(userId: string, options: LegacyCompatibilityOptions): Promise<CompatibilityWriteResult> {
  const pool = getPool();
  const result = await pool.query<{
    user_id: string;
    display_name: string;
    email: string | null;
    password_hash: string | null;
    role_name: string | null;
    rank_label: string | null;
    auth_provider: string | null;
    oauth_id: string | null;
    created_at: string;
    last_login_at: string | null;
    banned: boolean;
    avatar_public_url: string | null;
    avatar_legacy_relative_path: string | null;
    avatar_storage_path: string | null;
  }>(
    `select
        u.user_id,
        u.display_name,
        u.email,
        u.password_hash,
        u.role_name,
        u.rank_label,
        u.auth_provider,
        u.oauth_id,
        u.created_at::text,
        u.last_login_at::text,
        u.banned,
        ab.public_url as avatar_public_url,
        ea.legacy_relative_path as avatar_legacy_relative_path,
        ab.storage_path as avatar_storage_path
     from users u
     left join evidence_assets ea on ea.asset_id = u.avatar_asset_id
     left join asset_blobs ab on ab.blob_id = ea.blob_id
     where u.user_id = $1`,
    [userId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`User not found: ${userId}`);
  }

  const legacyUser: LegacyUserRecord = {
    id: row.user_id,
    name: row.display_name,
    email: row.email,
    password_hash: row.password_hash,
    role: row.role_name ?? "Observer",
    rank: row.rank_label ?? "観察者",
    auth_provider: row.auth_provider ?? "local",
    oauth_id: row.oauth_id,
    avatar:
      row.avatar_legacy_relative_path ??
      row.avatar_public_url ??
      row.avatar_storage_path ??
      `https://i.pravatar.cc/150?u=${row.user_id}`,
    created_at: formatLegacyDateTime(row.created_at) ?? formatLegacyDateTime(new Date())!,
    last_login_at: formatLegacyDateTime(row.last_login_at),
    banned: row.banned,
  };

  const usersPath = path.join(options.legacyDataRoot, "users.json");
  const users = await readJsonArray<LegacyUserRecord>(usersPath);
  const nextUsers = upsertById(users, legacyUser, "id");
  await writeJsonAtomic(usersPath, nextUsers);
  await writeLedger("user", userId, usersPath, "succeeded", { file: usersPath });

  return {
    entityType: "user",
    canonicalId: userId,
    legacyTarget: usersPath,
  };
}

export async function writeLegacyObservation(
  observationId: string,
  options: LegacyCompatibilityOptions,
): Promise<CompatibilityWriteResult> {
  const pool = getPool();
  const visitResult = await pool.query<{
    visit_id: string;
    legacy_observation_id: string | null;
    source_kind: string;
    observed_at: string;
    created_at: string;
    updated_at: string;
    point_latitude: number | null;
    point_longitude: number | null;
    observed_country: string | null;
    observed_prefecture: string | null;
    observed_municipality: string | null;
    locality_note: string | null;
    note: string | null;
    user_id: string | null;
    user_name: string | null;
    user_rank: string | null;
    user_avatar: string | null;
    place_legacy_site_id: string | null;
    place_name: string | null;
    source_payload: Record<string, unknown> | null;
  }>(
    `select
        v.visit_id,
        v.legacy_observation_id,
        v.source_kind,
        v.observed_at::text,
        v.created_at::text,
        v.updated_at::text,
        v.point_latitude,
        v.point_longitude,
        v.observed_country,
        v.observed_prefecture,
        v.observed_municipality,
        v.locality_note,
        v.note,
        v.user_id,
        u.display_name as user_name,
        u.rank_label as user_rank,
        coalesce(ab.public_url, ea.legacy_relative_path, ab.storage_path) as user_avatar,
        p.legacy_site_id as place_legacy_site_id,
        p.canonical_name as place_name,
        v.source_payload
     from visits v
     left join users u on u.user_id = v.user_id
     left join evidence_assets ea on ea.asset_id = u.avatar_asset_id
     left join asset_blobs ab on ab.blob_id = ea.blob_id
     left join places p on p.place_id = v.place_id
     where v.visit_id = $1 or v.legacy_observation_id = $1
     order by case when v.visit_id = $1 then 0 else 1 end
     limit 1`,
    [observationId],
  );

  const visit = visitResult.rows[0];
  if (!visit) {
    throw new Error(`Observation not found: ${observationId}`);
  }

  const occurrenceResult = await pool.query<{
    occurrence_id: string;
    scientific_name: string | null;
    vernacular_name: string | null;
    taxon_rank: string | null;
    organism_origin: string | null;
    cultivation: string | null;
    occurrence_status: string | null;
    biome: string | null;
    data_quality: string | null;
    quality_grade: string | null;
    ai_assessment_status: string | null;
    best_supported_descendant_taxon: string | null;
    substrate_tags: string[] | null;
    evidence_tags: string[] | null;
    source_payload: Record<string, unknown> | null;
  }>(
    `select
        occurrence_id,
        scientific_name,
        vernacular_name,
        taxon_rank,
        organism_origin,
        cultivation,
        occurrence_status,
        biome,
        data_quality,
        quality_grade,
        ai_assessment_status,
        best_supported_descendant_taxon,
        substrate_tags,
        evidence_tags,
        source_payload
     from occurrences
     where visit_id = $1
     order by subject_index asc, created_at asc
     limit 1`,
    [visit.visit_id],
  );

  const occurrence = occurrenceResult.rows[0];
  const photoResult = await pool.query<{
    legacy_relative_path: string | null;
    public_url: string | null;
    storage_path: string | null;
  }>(
    `select
        ea.legacy_relative_path,
        ab.public_url,
        ab.storage_path
     from evidence_assets ea
     join asset_blobs ab on ab.blob_id = ea.blob_id
     where ea.occurrence_id = $1
       and ea.asset_role = 'observation_photo'
     order by ea.created_at asc`,
    [occurrence?.occurrence_id ?? ""],
  );

  const identificationResult = occurrence
    ? await pool.query<{
        actor_user_id: string | null;
        proposed_name: string;
        proposed_rank: string | null;
        notes: string | null;
        created_at: string;
        actor_name: string | null;
        actor_avatar: string | null;
      }>(
        `select
            i.actor_user_id,
            i.proposed_name,
            i.proposed_rank,
            i.notes,
            i.created_at::text,
            u.display_name as actor_name,
            coalesce(ab.public_url, ea.legacy_relative_path, ab.storage_path) as actor_avatar
         from identifications i
         left join users u on u.user_id = i.actor_user_id
         left join evidence_assets ea on ea.asset_id = u.avatar_asset_id
         left join asset_blobs ab on ab.blob_id = ea.blob_id
         where i.occurrence_id = $1
           and i.is_current = true
         order by i.created_at asc`,
        [occurrence.occurrence_id],
      )
    : { rows: [] };

  const basePayload = (
    visit.source_kind === "legacy_observation" && visit.source_payload && typeof visit.source_payload === "object"
      ? visit.source_payload
      : occurrence?.source_payload && typeof occurrence.source_payload === "object"
        ? occurrence.source_payload
        : {}
  ) as Record<string, unknown>;

  const legacyObservationId = visit.legacy_observation_id ?? visit.visit_id;
  const legacyObservation: LegacyObservationRecord = {
    ...basePayload,
    id: legacyObservationId,
    user_id: visit.user_id,
    user_name: visit.user_name ?? (basePayload.user_name as string | undefined) ?? "ikimon user",
    user_avatar:
      visit.user_avatar ??
      (basePayload.user_avatar as string | undefined) ??
      (visit.user_id ? `https://i.pravatar.cc/150?u=${visit.user_id}` : ""),
    user_rank: visit.user_rank ?? (basePayload.user_rank as string | undefined) ?? "観察者",
    observed_at:
      formatLegacyDateTime(visit.observed_at) ??
      (basePayload.observed_at as string | undefined) ??
      formatLegacyDateTime(new Date())!,
    created_at:
      formatLegacyDateTime(visit.created_at) ??
      (basePayload.created_at as string | undefined) ??
      formatLegacyDateTime(new Date())!,
    updated_at:
      formatLegacyDateTime(visit.updated_at) ??
      (basePayload.updated_at as string | undefined) ??
      formatLegacyDateTime(new Date())!,
    lat: visit.point_latitude,
    lng: visit.point_longitude,
    country: visit.observed_country ?? (basePayload.country as string | undefined) ?? "JP",
    prefecture: visit.observed_prefecture ?? (basePayload.prefecture as string | undefined) ?? null,
    municipality: visit.observed_municipality ?? (basePayload.municipality as string | undefined) ?? null,
    note: visit.note ?? (basePayload.note as string | undefined) ?? "",
    status: (basePayload.status as string | undefined) ?? (occurrence ? "要同定" : "Needs ID"),
    site_id: visit.place_legacy_site_id ?? (basePayload.site_id as string | undefined) ?? null,
    site_name: visit.place_name ?? (basePayload.site_name as string | undefined) ?? null,
    taxon: occurrence
      ? {
          ...(typeof basePayload.taxon === "object" && basePayload.taxon ? (basePayload.taxon as Record<string, unknown>) : {}),
          key:
            (typeof basePayload.taxon === "object" && basePayload.taxon
              ? ((basePayload.taxon as Record<string, unknown>).key as string | undefined)
              : undefined) ?? occurrence.scientific_name,
          name: occurrence.vernacular_name ?? occurrence.scientific_name,
          scientific_name: occurrence.scientific_name,
          rank: occurrence.taxon_rank,
          source:
            (typeof basePayload.taxon === "object" && basePayload.taxon
              ? ((basePayload.taxon as Record<string, unknown>).source as string | undefined)
              : undefined) ?? "v2",
        }
      : (basePayload.taxon as Record<string, unknown> | null) ?? null,
    photos: photoResult.rows.map((row) => row.legacy_relative_path ?? row.public_url ?? row.storage_path ?? "").filter(Boolean),
    identifications: identificationResult.rows.map((row, index) => ({
      id: `compat_${index + 1}_${legacyObservationId}`,
      user_id: row.actor_user_id,
      user_name: row.actor_name ?? "ikimon user",
      user_avatar:
        row.actor_avatar ?? (row.actor_user_id ? `https://i.pravatar.cc/150?u=${row.actor_user_id}` : ""),
      taxon_name: row.proposed_name,
      taxon_rank: row.proposed_rank,
      scientific_name: row.proposed_name,
      confidence: "legacy_sync",
      note: row.notes ?? "",
      created_at: formatLegacyDateTime(row.created_at) ?? formatLegacyDateTime(new Date())!,
    })),
    cultivation: occurrence?.cultivation ?? (basePayload.cultivation as string | undefined) ?? null,
    organism_origin: occurrence?.organism_origin ?? (basePayload.organism_origin as string | undefined) ?? null,
    biome: occurrence?.biome ?? (basePayload.biome as string | undefined) ?? null,
    substrate_tags: occurrence?.substrate_tags ?? basePayload.substrate_tags ?? null,
    evidence_tags: occurrence?.evidence_tags ?? basePayload.evidence_tags ?? null,
    data_quality: occurrence?.data_quality ?? (basePayload.data_quality as string | undefined) ?? null,
    quality_grade: occurrence?.quality_grade ?? (basePayload.quality_grade as string | undefined) ?? null,
    ai_assessment_status:
      occurrence?.ai_assessment_status ?? (basePayload.ai_assessment_status as string | undefined) ?? null,
    best_supported_descendant_taxon:
      occurrence?.best_supported_descendant_taxon ??
      (basePayload.best_supported_descendant_taxon as string | undefined) ??
      null,
    import_source: "v2_compat",
    record_source: (basePayload.record_source as string | undefined) ?? "v2",
  };

  const partitionName = partitionNameFromTimestamp(legacyObservation.created_at as string);
  const filePath = path.join(options.legacyDataRoot, "observations", `${partitionName}.json`);
  const observations = await readJsonArray<LegacyObservationRecord>(filePath);
  const nextObservations = upsertById(observations, legacyObservation, "id");
  await writeJsonAtomic(filePath, nextObservations);
  await writeLedger("observation", visit.visit_id, filePath, "succeeded", {
    observationId: legacyObservationId,
    file: filePath,
  });

  return {
    entityType: "observation",
    canonicalId: visit.visit_id,
    legacyTarget: filePath,
  };
}

export async function writeLegacyTrack(visitId: string, options: LegacyCompatibilityOptions): Promise<CompatibilityWriteResult> {
  const pool = getPool();
  const visitResult = await pool.query<{
    visit_id: string;
    user_id: string | null;
    observed_at: string;
    updated_at: string;
    distance_meters: number | null;
    step_count: number | null;
    source_payload: Record<string, unknown> | null;
  }>(
    `select visit_id, user_id, observed_at::text, updated_at::text, distance_meters, step_count, source_payload
     from visits
     where visit_id = $1
     limit 1`,
    [visitId],
  );

  const visit = visitResult.rows[0];
  if (!visit) {
    throw new Error(`Track visit not found: ${visitId}`);
  }

  const pointsResult = await pool.query<{
    sequence_no: number;
    point_latitude: number;
    point_longitude: number;
    accuracy_m: number | null;
    altitude_m: number | null;
    observed_at: string;
  }>(
    `select sequence_no, point_latitude, point_longitude, accuracy_m, altitude_m, observed_at::text
     from visit_track_points
     where visit_id = $1
     order by sequence_no asc`,
    [visitId],
  );

  const sourcePayload = (visit.source_payload ?? {}) as Record<string, unknown>;
  const sessionId =
    (typeof sourcePayload.session_id === "string" && sourcePayload.session_id) ||
    (visitId.startsWith("track:") ? visitId.slice("track:".length) : visitId);
  const userId = visit.user_id ?? (typeof sourcePayload.user_id === "string" ? sourcePayload.user_id : "unknown_user");

  const legacyTrack: LegacyTrackRecord = {
    session_id: sessionId,
    user_id: userId,
    field_id: typeof sourcePayload.field_id === "string" ? sourcePayload.field_id : null,
    started_at: typeof sourcePayload.started_at === "string" ? sourcePayload.started_at : formatIso(visit.observed_at),
    updated_at: formatIso(visit.updated_at),
    points: pointsResult.rows.map((point) => ({
      lat: point.point_latitude,
      lng: point.point_longitude,
      accuracy: point.accuracy_m,
      altitude: point.altitude_m,
      timestamp: new Date(point.observed_at).getTime(),
    })),
    point_count: pointsResult.rows.length,
    total_distance_m: visit.distance_meters,
    step_count: visit.step_count,
  };

  const filePath = path.join(options.legacyDataRoot, "tracks", userId, `${sessionId}.json`);
  await ensureDir(path.dirname(filePath));
  await writeJsonAtomic(filePath, legacyTrack);
  await writeLedger("track", visit.visit_id, filePath, "succeeded", {
    sessionId,
    file: filePath,
  });

  return {
    entityType: "track",
    canonicalId: visit.visit_id,
    legacyTarget: filePath,
  };
}

export async function writeLegacyRememberToken(
  tokenHash: string,
  options: LegacyCompatibilityOptions,
): Promise<CompatibilityWriteResult> {
  const pool = getPool();
  const result = await pool.query<{
    token_hash: string;
    user_id: string;
    expires_at: string;
    created_at: string;
    ip_address: string | null;
    display_name: string;
    email: string | null;
    password_hash: string | null;
    role_name: string | null;
    rank_label: string | null;
    auth_provider: string | null;
    oauth_id: string | null;
    avatar_public_url: string | null;
    avatar_legacy_relative_path: string | null;
    avatar_storage_path: string | null;
    banned: boolean;
  }>(
    `select
        rt.token_hash,
        rt.user_id,
        rt.expires_at::text,
        rt.created_at::text,
        host(rt.ip_address) as ip_address,
        u.display_name,
        u.email,
        u.password_hash,
        u.role_name,
        u.rank_label,
        u.auth_provider,
        u.oauth_id,
        ab.public_url as avatar_public_url,
        ea.legacy_relative_path as avatar_legacy_relative_path,
        ab.storage_path as avatar_storage_path,
        u.banned
     from remember_tokens rt
     join users u on u.user_id = rt.user_id
     left join evidence_assets ea on ea.asset_id = u.avatar_asset_id
     left join asset_blobs ab on ab.blob_id = ea.blob_id
     where rt.token_hash = $1
     limit 1`,
    [tokenHash],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`Remember token not found: ${tokenHash}`);
  }

  const filePath = path.join(options.legacyDataRoot, "auth_tokens.json");
  const tokens = await readJsonArray<LegacyRememberTokenRecord>(filePath);
  const userData = {
    id: row.user_id,
    name: row.display_name,
    email: row.email,
    password_hash: row.password_hash,
    role: row.role_name ?? "Observer",
    rank: row.rank_label ?? "観察者",
    auth_provider: row.auth_provider ?? "local",
    oauth_id: row.oauth_id,
    avatar:
      row.avatar_legacy_relative_path ??
      row.avatar_public_url ??
      row.avatar_storage_path ??
      `https://i.pravatar.cc/150?u=${row.user_id}`,
    banned: row.banned,
  };

  const expiresEpoch = Math.floor(new Date(row.expires_at).getTime() / 1000);
  const nextTokens = upsertById(
    tokens,
    {
      user_id: row.user_id,
      token_hash: row.token_hash,
      user_data: userData,
      expires: expiresEpoch,
      created_at: formatLegacyDateTime(row.created_at) ?? formatLegacyDateTime(new Date())!,
      ip: row.ip_address,
    },
    "token_hash",
  );

  await writeJsonAtomic(filePath, nextTokens);
  await writeLedger("remember_token", tokenHash, filePath, "succeeded", {
    userId: row.user_id,
    file: filePath,
  });

  return {
    entityType: "remember_token",
    canonicalId: tokenHash,
    legacyTarget: filePath,
  };
}

export async function revokeLegacyRememberToken(
  tokenHash: string,
  options: LegacyCompatibilityOptions,
): Promise<CompatibilityWriteResult> {
  const filePath = path.join(options.legacyDataRoot, "auth_tokens.json");
  const tokens = await readJsonArray<LegacyRememberTokenRecord>(filePath);
  const nextTokens = tokens.filter((token) => token.token_hash !== tokenHash);
  await writeJsonAtomic(filePath, nextTokens);
  await writeLedger("remember_token", tokenHash, filePath, "succeeded", {
    revoked: true,
    file: filePath,
  });

  return {
    entityType: "remember_token",
    canonicalId: tokenHash,
    legacyTarget: filePath,
  };
}
