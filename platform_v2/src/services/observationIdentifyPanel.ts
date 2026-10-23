import { getPool } from "../db.js";
import type { ObservationDetailSnapshot } from "./readModels.js";

export type ObservationIdentifyPanelSnapshot = Pick<ObservationDetailSnapshot,
  | "occurrenceId"
  | "visitId"
  | "displayName"
  | "scientificName"
  | "vernacularName"
  | "aiAssessmentStatus"
  | "aiReviewAgreeCount"
  | "aiReviewDisagreeCount"
  | "identifications"
  | "disputes"
>;

export type ObservationIdentifyPanelSubject = Pick<ObservationIdentifyPanelSnapshot,
  | "occurrenceId"
  | "visitId"
  | "displayName"
  | "scientificName"
  | "vernacularName"
  | "aiAssessmentStatus"
  | "aiReviewAgreeCount"
  | "aiReviewDisagreeCount"
  | "identifications"
>;

/** Keep the identify panel scoped to subject data; visit media and location never enter it. */
export function buildObservationIdentifyPanelSnapshot(
  subject: ObservationIdentifyPanelSubject,
  disputes: ObservationIdentifyPanelSnapshot["disputes"],
): ObservationIdentifyPanelSnapshot {
  return {
    occurrenceId: subject.occurrenceId,
    visitId: subject.visitId,
    displayName: subject.displayName,
    scientificName: subject.scientificName,
    vernacularName: subject.vernacularName,
    aiAssessmentStatus: subject.aiAssessmentStatus,
    aiReviewAgreeCount: subject.aiReviewAgreeCount,
    aiReviewDisagreeCount: subject.aiReviewDisagreeCount,
    identifications: subject.identifications,
    disputes,
  };
}

export async function getObservationIdentifyPanelDisputes(
  occurrenceIds: string[],
): Promise<Map<string, ObservationIdentifyPanelSnapshot["disputes"]>> {
  const uniqueIds = [...new Set(occurrenceIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const result = await getPool().query<{
    occurrence_id: string;
    dispute_id: string;
    kind: string;
    proposed_name: string | null;
    proposed_rank: string | null;
    reason: string | null;
    status: string;
    actor_name: string | null;
    created_at: string;
  }>(
    `with ranked_disputes as (
       select d.occurrence_id,
              d.dispute_id::text,
              d.kind,
              d.proposed_name,
              d.proposed_rank,
              d.reason,
              d.status,
              coalesce(u.display_name, 'Community') as actor_name,
              d.created_at::text,
              row_number() over (
                partition by d.occurrence_id
                order by case when d.status = 'open' then 0 else 1 end, d.created_at desc
              ) as row_num
         from identification_disputes d
         left join users u on u.user_id = d.actor_user_id
        where d.occurrence_id = any($1::text[])
     )
     select occurrence_id, dispute_id, kind, proposed_name, proposed_rank, reason, status, actor_name, created_at
       from ranked_disputes
      where row_num <= 8
      order by occurrence_id, row_num`,
    [uniqueIds],
  );

  const grouped = new Map<string, ObservationIdentifyPanelSnapshot["disputes"]>();
  for (const row of result.rows) {
    const items = grouped.get(row.occurrence_id) ?? [];
    items.push({
      disputeId: row.dispute_id,
      kind: row.kind,
      proposedName: row.proposed_name,
      proposedRank: row.proposed_rank,
      reason: row.reason,
      status: row.status,
      actorName: row.actor_name ?? "Community",
      createdAt: row.created_at,
    });
    grouped.set(row.occurrence_id, items);
  }
  return grouped;
}
