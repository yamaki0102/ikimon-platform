import { getPool } from "../db.js";
import { matchTaxon } from "./gbifBackboneMatch.js";
import { ensureLegacyAiRunsForVisit, getLatestObservationAiRunForVisit } from "./observationAiRuns.js";
import { deriveVisitDisplayState, upsertVisitDisplayState } from "./visitDisplayState.js";
import { getVisitSubjectSummaries } from "./visitSubjects.js";
import {
  resolveAuthorityForReview,
  type ReviewerAuthorityReviewClass,
  type ReviewerAuthoritySnapshot,
} from "./reviewerAuthorities.js";
import { normalizeRank, type TaxonRank } from "./taxonRank.js";
import {
  DEFAULT_COARSE_CEILING,
  buildAncestryChain,
  getCoarseCeilingForAncestry,
  isProposalWithinCommunityCeiling,
} from "./taxonPrecisionPolicy.js";
import { tryPromoteToTier3 } from "./tierPromotion.js";

export type SpecialistDecision = "approve" | "reject" | "note";
export type SpecialistLane = "default" | "public-claim" | "expert-lane" | "review-queue";

export type AcceptedRankDecisionInput = {
  decision: SpecialistDecision;
  proposedName: string | null;
  proposedRank: string | null;
  reviewClass: ReviewerAuthorityReviewClass;
  ceilingRank: TaxonRank;
};

/**
 * Pure decision: given the review context and the ceiling rank for the
 * taxon, returns the accepted_rank to write on the identification row.
 * See identification_granularity_policy.md §1.2 and §3.
 */
export function decideAcceptedRank(input: AcceptedRankDecisionInput): TaxonRank | null {
  if (input.decision !== "approve") return null;
  if (!input.proposedName) return null;
  const proposed = normalizeRank(input.proposedRank);
  if (!proposed) return null;
  if (input.reviewClass === "authority_backed" || input.reviewClass === "admin_override") {
    return proposed;
  }
  if (input.reviewClass === "plain_review") {
    return isProposalWithinCommunityCeiling(proposed, input.ceilingRank) ? proposed : null;
  }
  return null;
}

export type SpecialistReviewInput = {
  occurrenceId: string;
  actorUserId: string;
  actorRoleName?: string | null;
  actorRankLabel?: string | null;
  lane: SpecialistLane;
  decision: SpecialistDecision;
  proposedName?: string | null;
  proposedRank?: string | null;
  notes?: string | null;
};

export async function recordSpecialistReview(input: SpecialistReviewInput) {
  if (!input.occurrenceId.trim()) {
    throw new Error("occurrenceId is required");
  }
  if (!input.actorUserId.trim()) {
    throw new Error("actorUserId is required");
  }
  if (input.decision === "approve" && !(input.proposedName ?? "").trim()) {
    throw new Error("proposedName is required for approve");
  }

  const normalizedProposedName = (input.proposedName ?? "").trim() || null;
  const normalizedProposedRank = (input.proposedRank ?? "").trim() || null;
  const normalizedNotes = (input.notes ?? "").trim() || null;
  const needsAuthority =
    input.decision === "approve" && (input.lane === "expert-lane" || input.lane === "public-claim");

  let authorityMatched = false;
  let authorityScope: ReviewerAuthoritySnapshot | null = null;
  let reviewClass: ReviewerAuthorityReviewClass = "plain_review";

  if (input.decision === "approve" && normalizedProposedName) {
    const resolution = await resolveAuthorityForReview({
      actorUserId: input.actorUserId,
      actorRoleName: input.actorRoleName,
      actorRankLabel: input.actorRankLabel,
      proposedName: normalizedProposedName,
      proposedRank: normalizedProposedRank,
    });
    authorityMatched = resolution.authorityMatched;
    authorityScope = resolution.authorityScope;
    reviewClass = resolution.reviewClass;
  }

  if (needsAuthority && reviewClass === "plain_review") {
    throw new Error("specialist_authority_required");
  }

  // Resolve the per-taxon coarse ceiling before opening a transaction so the
  // GBIF lookup does not hold a DB connection. Fallback is the default
  // ceiling (genus) if GBIF cannot resolve the proposed name.
  let ceilingRank: TaxonRank = DEFAULT_COARSE_CEILING;
  if (input.decision === "approve" && normalizedProposedName && reviewClass === "plain_review") {
    try {
      const gbif = await matchTaxon({ name: normalizedProposedName, rank: normalizedProposedRank ?? null });
      const ancestry = buildAncestryChain({
        kingdom: gbif.kingdom,
        phylum: gbif.phylum,
        className: gbif.className,
        orderName: gbif.orderName,
        family: gbif.family,
        genus: gbif.genus,
        species: gbif.species,
      });
      if (ancestry.length > 0) {
        ceilingRank = await getCoarseCeilingForAncestry(ancestry);
      }
    } catch {
      // keep default ceiling
    }
  }

  const acceptedRank = decideAcceptedRank({
    decision: input.decision,
    proposedName: normalizedProposedName,
    proposedRank: normalizedProposedRank,
    reviewClass,
    ceilingRank,
  });

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");

    const occurrenceResult = await client.query<{ occurrence_id: string; visit_id: string }>(
      `select occurrence_id
              , visit_id
       from occurrences
       where occurrence_id = $1
       limit 1`,
      [input.occurrenceId],
    );
    const occurrenceId = occurrenceResult.rows[0]?.occurrence_id;
    const visitId = occurrenceResult.rows[0]?.visit_id;
    if (!occurrenceId || !visitId) {
      throw new Error("occurrence_not_found");
    }

    const reviewPayload = {
      lane: input.lane,
      decision: input.decision,
      actorUserId: input.actorUserId,
      actorRoleName: input.actorRoleName ?? null,
      actorRankLabel: input.actorRankLabel ?? null,
      proposedName: normalizedProposedName,
      proposedRank: normalizedProposedRank,
      acceptedRank,
      notes: normalizedNotes,
      authorityMatched,
      authoritySnapshot: authorityScope,
      reviewClass,
      updatedAt: new Date().toISOString(),
      source: "v2_specialist_review",
    };

    await client.query(
      `update occurrences
       set source_payload = jsonb_set(
         coalesce(source_payload, '{}'::jsonb),
         '{specialist_review}',
         $2::jsonb,
         true
       ),
       updated_at = now()
       where occurrence_id = $1`,
      [occurrenceId, JSON.stringify(reviewPayload)],
    );

    if (input.decision === "approve") {
      if (reviewClass === "authority_backed" || reviewClass === "admin_override") {
        await client.query(
          `update occurrences
           set evidence_tier = case
                 when coalesce(evidence_tier, 0) < 2 then 2
                 else evidence_tier
               end,
               updated_at = now()
           where occurrence_id = $1`,
          [occurrenceId],
        );
      }

      const legacyIdentificationKey = `v2_specialist:${occurrenceId}:${input.lane}:${input.actorUserId}`;
      await client.query(
        `insert into identifications (
            occurrence_id, actor_user_id, actor_kind, proposed_name, proposed_rank, accepted_rank, legacy_identification_key,
            identification_method, confidence_score, is_current, notes, source_payload
         ) values (
            $1, $2, 'human', $3, $4, $5, $6, 'v2_specialist_review', null, true, $7, $8::jsonb
         )
         on conflict (legacy_identification_key) do update set
            proposed_name = excluded.proposed_name,
            proposed_rank = excluded.proposed_rank,
            accepted_rank = excluded.accepted_rank,
            identification_method = excluded.identification_method,
            is_current = excluded.is_current,
            notes = excluded.notes,
            source_payload = excluded.source_payload`,
        [
          occurrenceId,
          input.actorUserId,
          normalizedProposedName,
          normalizedProposedRank,
          acceptedRank,
          legacyIdentificationKey,
          normalizedNotes,
          JSON.stringify(reviewPayload),
        ],
      );
    }

    await ensureLegacyAiRunsForVisit(client, visitId);
    const latestRun = await getLatestObservationAiRunForVisit(client, visitId);
    const subjects = await getVisitSubjectSummaries(visitId, client);
    const nextDisplayState = deriveVisitDisplayState(visitId, subjects, latestRun?.aiRunId ?? null);
    await upsertVisitDisplayState(client, nextDisplayState);

    await client.query("commit");

    if (
      input.decision === "approve"
      && input.lane === "public-claim"
      && (reviewClass === "authority_backed" || reviewClass === "admin_override")
    ) {
      await tryPromoteToTier3(occurrenceId);
    }

    return {
      ok: true,
      occurrenceId,
      lane: input.lane,
      decision: input.decision,
      proposedName: normalizedProposedName,
      proposedRank: normalizedProposedRank,
      acceptedRank,
      authorityMatched,
      authorityScope,
      reviewClass,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
