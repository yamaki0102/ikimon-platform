import { getPool } from "../db.js";
import {
  getManualVisitOccurrenceIntegrity,
  type ManualVisitOccurrenceGap,
} from "../services/readModels.js";
import { makeOccurrenceId } from "../services/writeSupport.js";

type RepairOptions = {
  apply: boolean;
  limit?: number;
  userId?: string;
  visitId?: string;
};

function parseArgs(argv: string[]): RepairOptions {
  const options: RepairOptions = {
    apply: false,
  };

  for (const arg of argv) {
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const limit = Number(arg.slice("--limit=".length).trim());
      if (Number.isFinite(limit) && limit > 0) {
        options.limit = Math.trunc(limit);
      }
      continue;
    }
    if (arg.startsWith("--user-id=")) {
      const userId = arg.slice("--user-id=".length).trim();
      if (userId) {
        options.userId = userId;
      }
      continue;
    }
    if (arg.startsWith("--visit-id=")) {
      const visitId = arg.slice("--visit-id=".length).trim();
      if (visitId) {
        options.visitId = visitId;
      }
    }
  }

  return options;
}

function buildRepairPayload(gap: ManualVisitOccurrenceGap, repairedAt: string): Record<string, unknown> {
  return {
    source: "repair_missing_manual_occurrences",
    repair_reason: "missing_primary_occurrence_backfill",
    repaired_at: repairedAt,
    repaired_from_visit_id: gap.visitId,
    repaired_from_legacy_observation_id: gap.legacyObservationId,
    repaired_from_user_id: gap.userId,
    v2_subject: {
      subject_index: 0,
      is_primary: true,
      role_hint: "primary",
      confidence: null,
      note: null,
    },
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = getPool();
  try {
    const lookupLimit = options.apply ? options.limit : options.limit ?? 50;
    const initial = await getManualVisitOccurrenceIntegrity({
      limit: lookupLimit,
      userId: options.userId,
      visitId: options.visitId,
    });

    if (!options.apply || initial.orphanVisitCount === 0 || initial.orphanVisits.length === 0) {
      console.log(
        JSON.stringify(
          {
            options,
            status: options.apply ? "noop" : "dry-run",
            orphanVisitCount: initial.orphanVisitCount,
            orphanVisitIds: initial.orphanVisits.map((gap) => gap.visitId),
          },
          null,
          2,
        ),
      );
      return;
    }

    const client = await pool.connect();
    const repairedAt = new Date().toISOString();
    const repairedVisitIds: string[] = [];

    try {
      await client.query("begin");

      for (const gap of initial.orphanVisits) {
        const occurrenceId = makeOccurrenceId(gap.visitId, 0);
        await client.query(
          `insert into occurrences (
              occurrence_id, visit_id, legacy_observation_id, subject_index, scientific_name, vernacular_name,
              taxon_rank, basis_of_record, organism_origin, cultivation, occurrence_status,
              confidence_score, evidence_tier, data_quality, quality_grade, ai_assessment_status,
              best_supported_descendant_taxon, biome, substrate_tags, evidence_tags, source_payload, created_at, updated_at
           ) values (
              $1, $2, $3, 0, null, null,
              null, 'HumanObservation', null, null, 'present',
              null, 1, null, null, null,
              null, null, '[]'::jsonb, '[]'::jsonb, $4::jsonb, $5, now()
           )
           on conflict (occurrence_id) do nothing`,
          [
            occurrenceId,
            gap.visitId,
            gap.legacyObservationId ?? gap.visitId,
            JSON.stringify(buildRepairPayload(gap, repairedAt)),
            gap.observedAt,
          ],
        );
        repairedVisitIds.push(gap.visitId);
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    const remaining = await getManualVisitOccurrenceIntegrity({
      userId: options.userId,
      visitId: options.visitId,
      limit: options.limit ?? 50,
    });

    console.log(
      JSON.stringify(
        {
          options,
          status: "applied",
          repairedCount: repairedVisitIds.length,
          repairedVisitIds,
          remainingOrphanCount: remaining.orphanVisitCount,
          remainingOrphanVisitIds: remaining.orphanVisits.map((gap) => gap.visitId),
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
