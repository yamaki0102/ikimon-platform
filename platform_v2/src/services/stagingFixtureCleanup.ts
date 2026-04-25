import { rm } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { loadConfig } from "../config.js";
import { getPool } from "../db.js";
import { buildStagingFixturePredicate } from "./stagingFixtureGuard.js";

export type StagingFixtureCleanupInput = {
  fixturePrefix?: string | null;
  dryRun?: boolean;
  removeFiles?: boolean;
};

type CleanupCounts = {
  users: number;
  visits: number;
  occurrences: number;
  places: number;
  rememberTokens: number;
  oauthAccounts: number;
  identifications: number;
  observationReactions: number;
  evidenceAssets: number;
  assetBlobs: number;
  files: number;
};

type CandidateAsset = {
  assetId: string;
  blobId: string | null;
  storagePath: string | null;
};

export type StagingFixtureCleanupResult = {
  fixturePrefix: string | null;
  dryRun: boolean;
  matched: CleanupCounts;
  deleted: CleanupCounts;
  warnings: string[];
};

function emptyCounts(): CleanupCounts {
  return {
    users: 0,
    visits: 0,
    occurrences: 0,
    places: 0,
    rememberTokens: 0,
    oauthAccounts: 0,
    identifications: 0,
    observationReactions: 0,
    evidenceAssets: 0,
    assetBlobs: 0,
    files: 0,
  };
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim() ?? "").filter(Boolean))];
}

function isUndefinedTableError(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as { code?: string }).code === "42P01";
}

async function queryTextArray(client: PoolClient, sql: string, params: unknown[] = []): Promise<string[]> {
  const result = await client.query<{ value: string | null }>(sql, params);
  return unique(result.rows.map((row) => row.value));
}

async function queryCandidateAssets(client: PoolClient, fixturePrefix?: string | null): Promise<CandidateAsset[]> {
  const predicate = buildStagingFixturePredicate(
    {
      userIdColumn: "v.user_id",
      visitIdColumn: "coalesce(ea.visit_id, v.visit_id)",
      occurrenceIdColumn: "ea.occurrence_id",
    },
    fixturePrefix,
  );
  const result = await client.query<{
    asset_id: string;
    blob_id: string | null;
    storage_path: string | null;
  }>(
    `select distinct
        ea.asset_id::text as asset_id,
        ea.blob_id::text as blob_id,
        ab.storage_path
       from evidence_assets ea
       left join asset_blobs ab on ab.blob_id = ea.blob_id
       left join occurrences o on o.occurrence_id = ea.occurrence_id
       left join visits v on v.visit_id = coalesce(ea.visit_id, o.visit_id)
      where ${predicate}`,
  );
  return result.rows.map((row) => ({
    assetId: row.asset_id,
    blobId: row.blob_id,
    storagePath: row.storage_path,
  }));
}

async function deleteCount(client: PoolClient, sql: string, params: unknown[] = []): Promise<number> {
  const result = await client.query<{ c: string }>(
    `with deleted_rows as (
       ${sql}
       returning 1
     )
     select count(*)::text as c from deleted_rows`,
    params,
  );
  return Number(result.rows[0]?.c ?? 0);
}

async function deleteCountIfTableExists(client: PoolClient, sql: string, params: unknown[] = []): Promise<number> {
  try {
    return await deleteCount(client, sql, params);
  } catch (error) {
    if (isUndefinedTableError(error)) {
      return 0;
    }
    throw error;
  }
}

async function deleteFiles(storagePaths: string[]): Promise<{ deleted: number; warnings: string[] }> {
  const config = loadConfig();
  let deleted = 0;
  const warnings: string[] = [];

  for (const storagePath of storagePaths) {
    const absolutePath = path.join(config.legacyPublicRoot, ...storagePath.split("/"));
    try {
      await rm(absolutePath, { force: true });
      deleted += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "file_delete_failed";
      warnings.push(`${storagePath}: ${message}`);
    }
  }

  return { deleted, warnings };
}

export async function cleanupStagingFixtures(
  input: StagingFixtureCleanupInput = {},
): Promise<StagingFixtureCleanupResult> {
  const fixturePrefix = input.fixturePrefix?.trim() || null;
  const dryRun = input.dryRun ?? false;
  const removeFiles = input.removeFiles ?? true;
  const pool = getPool();
  const client = await pool.connect();

  try {
    const userPredicate = buildStagingFixturePredicate({ userIdColumn: "u.user_id" }, fixturePrefix);
    const visitPredicate = buildStagingFixturePredicate(
      {
        userIdColumn: "v.user_id",
        visitIdColumn: "v.visit_id",
        visitSourceColumn: "coalesce(v.source_payload->>'source', '')",
      },
      fixturePrefix,
    );
    const occurrencePredicate = buildStagingFixturePredicate(
      {
        userIdColumn: "v.user_id",
        visitIdColumn: "v.visit_id",
        occurrenceIdColumn: "o.occurrence_id",
        visitSourceColumn: "coalesce(v.source_payload->>'source', '')",
        occurrenceSourceColumn: "coalesce(o.source_payload->>'source', '')",
      },
      fixturePrefix,
    );
    const placePredicate = buildStagingFixturePredicate({ placeIdColumn: "p.place_id" }, fixturePrefix);

    const [candidateUserIds, candidateVisitIds, candidateOccurrenceIds, candidateAssets, candidatePlaceIdsByPattern] =
      await Promise.all([
        queryTextArray(
          client,
          `select u.user_id as value
             from users u
            where ${userPredicate}`,
        ),
        queryTextArray(
          client,
          `select distinct v.visit_id as value
             from visits v
            where ${visitPredicate}`,
        ),
        queryTextArray(
          client,
          `select distinct o.occurrence_id as value
             from occurrences o
             join visits v on v.visit_id = o.visit_id
            where ${occurrencePredicate}`,
        ),
        queryCandidateAssets(client, fixturePrefix),
        queryTextArray(
          client,
          `select distinct p.place_id as value
             from places p
            where ${placePredicate}`,
        ),
      ]);

    const candidatePlaceIdsFromVisits = candidateVisitIds.length > 0
      ? await queryTextArray(
          client,
          `select distinct v.place_id as value
             from visits v
            where v.visit_id = any($1::text[])
              and v.place_id is not null`,
          [candidateVisitIds],
        )
      : [];

    const candidateBlobIds = unique(candidateAssets.map((asset) => asset.blobId));
    const storagePaths = unique(candidateAssets.map((asset) => asset.storagePath));
    const candidatePlaceIds = unique([...candidatePlaceIdsByPattern, ...candidatePlaceIdsFromVisits]);

    const matched = emptyCounts();
    matched.users = candidateUserIds.length;
    matched.visits = candidateVisitIds.length;
    matched.occurrences = candidateOccurrenceIds.length;
    matched.places = candidatePlaceIds.length;
    matched.rememberTokens = candidateUserIds.length > 0
      ? Number(
          (
            await client.query<{ c: string }>(
              `select count(*)::text as c
                 from remember_tokens
                where user_id = any($1::text[])`,
              [candidateUserIds],
            )
          ).rows[0]?.c ?? 0,
        )
      : 0;
    matched.oauthAccounts = candidateUserIds.length > 0
      ? Number(
          (
            await client.query<{ c: string }>(
              `select count(*)::text as c
                 from oauth_accounts
                where user_id = any($1::text[])`,
              [candidateUserIds],
            )
          ).rows[0]?.c ?? 0,
        )
      : 0;
    matched.identifications = candidateOccurrenceIds.length > 0 || candidateUserIds.length > 0
      ? Number(
          (
            await client.query<{ c: string }>(
              `select count(*)::text as c
                 from identifications
                where ($1::text[] <> '{}'::text[] and occurrence_id = any($1::text[]))
                   or ($2::text[] <> '{}'::text[] and actor_user_id = any($2::text[]))`,
              [candidateOccurrenceIds, candidateUserIds],
            )
          ).rows[0]?.c ?? 0,
        )
      : 0;
    if (candidateOccurrenceIds.length > 0 || candidateUserIds.length > 0) {
      try {
        matched.observationReactions = Number(
          (
            await client.query<{ c: string }>(
              `select count(*)::text as c
                 from observation_reactions
                where ($1::text[] <> '{}'::text[] and occurrence_id = any($1::text[]))
                   or ($2::text[] <> '{}'::text[] and user_id = any($2::text[]))`,
              [candidateOccurrenceIds, candidateUserIds],
            )
          ).rows[0]?.c ?? 0,
        );
      } catch (error) {
        if (!isUndefinedTableError(error)) {
          throw error;
        }
      }
    }
    matched.evidenceAssets = candidateAssets.length;
    matched.assetBlobs = candidateBlobIds.length;
    matched.files = storagePaths.length;

    const deleted = emptyCounts();
    const warnings: string[] = [];

    if (dryRun) {
      return {
        fixturePrefix,
        dryRun: true,
        matched,
        deleted,
        warnings,
      };
    }

    await client.query("begin");
    try {
      if (candidateUserIds.length > 0) {
        deleted.rememberTokens = await deleteCount(
          client,
          `delete from remember_tokens
            where user_id = any($1::text[])`,
          [candidateUserIds],
        );
        deleted.oauthAccounts = await deleteCount(
          client,
          `delete from oauth_accounts
            where user_id = any($1::text[])`,
          [candidateUserIds],
        );
      }

      if (candidateOccurrenceIds.length > 0 || candidateUserIds.length > 0) {
        deleted.identifications = await deleteCount(
          client,
          `delete from identifications
            where ($1::text[] <> '{}'::text[] and occurrence_id = any($1::text[]))
               or ($2::text[] <> '{}'::text[] and actor_user_id = any($2::text[]))`,
          [candidateOccurrenceIds, candidateUserIds],
        );
        deleted.observationReactions = await deleteCountIfTableExists(
          client,
          `delete from observation_reactions
            where ($1::text[] <> '{}'::text[] and occurrence_id = any($1::text[]))
               or ($2::text[] <> '{}'::text[] and user_id = any($2::text[]))`,
          [candidateOccurrenceIds, candidateUserIds],
        );
      }

      if (candidateAssets.length > 0) {
        deleted.evidenceAssets = await deleteCount(
          client,
          `delete from evidence_assets
            where asset_id = any($1::uuid[])`,
          [candidateAssets.map((asset) => asset.assetId)],
        );
      }

      if (candidateOccurrenceIds.length > 0) {
        deleted.occurrences = await deleteCount(
          client,
          `delete from occurrences
            where occurrence_id = any($1::text[])`,
          [candidateOccurrenceIds],
        );
      }

      if (candidateVisitIds.length > 0) {
        deleted.visits = await deleteCount(
          client,
          `delete from visits
            where visit_id = any($1::text[])`,
          [candidateVisitIds],
        );
      }

      if (candidateBlobIds.length > 0) {
        deleted.assetBlobs = await deleteCount(
          client,
          `delete from asset_blobs ab
            where ab.blob_id = any($1::uuid[])
              and not exists (
                select 1
                  from evidence_assets ea
                 where ea.blob_id = ab.blob_id
              )`,
          [candidateBlobIds],
        );
      }

      if (candidateUserIds.length > 0) {
        deleted.users = await deleteCount(
          client,
          `delete from users
            where user_id = any($1::text[])`,
          [candidateUserIds],
        );
      }

      if (candidatePlaceIds.length > 0) {
        deleted.places = await deleteCount(
          client,
          `delete from places p
            where p.place_id = any($1::text[])
              and not exists (
                select 1
                  from visits v
                 where v.place_id = p.place_id
              )`,
          [candidatePlaceIds],
        );
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }

    if (removeFiles && storagePaths.length > 0) {
      const fileCleanup = await deleteFiles(storagePaths);
      deleted.files = fileCleanup.deleted;
      warnings.push(...fileCleanup.warnings);
    }

    return {
      fixturePrefix,
      dryRun: false,
      matched,
      deleted,
      warnings,
    };
  } finally {
    client.release();
  }
}
