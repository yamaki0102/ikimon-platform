import { getPool } from "../db.js";
import {
  getReviewerAccessContext,
  getReviewerAuthorityById,
  matchesAuthorityScope,
  type ReviewerAuthority,
  type ReviewerAuthorityEvidenceInput,
  type ReviewerAuthorityEvidenceType,
} from "./reviewerAuthorities.js";

export type AuthorityRecommendationSourceKind = "self_claim" | "ops_registered";
export type AuthorityRecommendationStatus = "pending" | "granted" | "rejected" | "revoked";

export type AuthorityRecommendationEvidenceInput = ReviewerAuthorityEvidenceInput;

export type AuthorityRecommendationEvidence = {
  evidenceId: string;
  evidenceType: ReviewerAuthorityEvidenceType;
  title: string;
  issuerName: string | null;
  url: string | null;
  notes: string | null;
  sourcePayload: Record<string, unknown>;
  createdAt: string;
};

export type AuthorityRecommendation = {
  recommendationId: string;
  subjectUserId: string;
  subjectDisplayName: string | null;
  sourceKind: AuthorityRecommendationSourceKind;
  status: AuthorityRecommendationStatus;
  scopeTaxonName: string;
  scopeTaxonRank: string | null;
  scopeTaxonKey: string | null;
  recommendedByUserId: string | null;
  recommendedByDisplayName: string | null;
  grantedAuthorityId: string | null;
  resolutionNote: string | null;
  resolvedByUserId: string | null;
  resolvedByDisplayName: string | null;
  resolvedAt: string | null;
  sourcePayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  evidence: AuthorityRecommendationEvidence[];
};

export type AuthorityRecommendationResolution = {
  recommendation: AuthorityRecommendation;
  authority: ReviewerAuthority | null;
};

export type CreateAuthorityRecommendationInput = {
  actorUserId: string;
  subjectUserId?: string | null;
  sourceKind: AuthorityRecommendationSourceKind;
  scopeTaxonName: string;
  scopeTaxonRank?: string | null;
  scopeTaxonKey?: string | null;
  evidence?: AuthorityRecommendationEvidenceInput[];
  sourcePayload?: Record<string, unknown>;
};

export type GrantAuthorityRecommendationInput = {
  recommendationId: string;
  actorUserId: string;
  actorRoleName?: string | null;
  actorRankLabel?: string | null;
  resolutionNote?: string | null;
};

export type RejectAuthorityRecommendationInput = {
  recommendationId: string;
  actorUserId: string;
  resolutionNote: string;
};

type RecommendationRow = {
  recommendation_id: string;
  subject_user_id: string;
  subject_display_name: string | null;
  source_kind: AuthorityRecommendationSourceKind;
  status: AuthorityRecommendationStatus;
  scope_taxon_name: string;
  scope_taxon_rank: string | null;
  scope_taxon_key: string | null;
  recommended_by_user_id: string | null;
  recommended_by_display_name: string | null;
  granted_authority_id: string | null;
  resolution_note: string | null;
  resolved_by_user_id: string | null;
  resolved_by_display_name: string | null;
  resolved_at: string | null;
  source_payload: unknown;
  created_at: string;
  updated_at: string;
  evidence_json: unknown;
};

const EVIDENCE_TYPES: ReviewerAuthorityEvidenceType[] = [
  "field_event",
  "webinar",
  "literature",
  "reference_owned",
  "other",
];

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function validateEvidenceInput(input: AuthorityRecommendationEvidenceInput): AuthorityRecommendationEvidenceInput {
  if (!EVIDENCE_TYPES.includes(input.evidenceType)) {
    throw new Error(`unsupported_evidence_type:${input.evidenceType}`);
  }

  const title = normalizeText(input.title);
  if (!title) {
    throw new Error("authority_recommendation_evidence_title_required");
  }

  return {
    evidenceType: input.evidenceType,
    title,
    issuerName: normalizeText(input.issuerName) || null,
    url: normalizeText(input.url) || null,
    notes: normalizeText(input.notes) || null,
    sourcePayload: input.sourcePayload ?? {},
  };
}

function toEvidence(input: unknown): AuthorityRecommendationEvidence[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry): AuthorityRecommendationEvidence | null => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const row = entry as Record<string, unknown>;
      const evidenceType = String(row.evidenceType ?? "");
      if (!EVIDENCE_TYPES.includes(evidenceType as ReviewerAuthorityEvidenceType)) {
        return null;
      }
      return {
        evidenceId: String(row.evidenceId ?? ""),
        evidenceType: evidenceType as ReviewerAuthorityEvidenceType,
        title: String(row.title ?? ""),
        issuerName: row.issuerName == null ? null : String(row.issuerName),
        url: row.url == null ? null : String(row.url),
        notes: row.notes == null ? null : String(row.notes),
        sourcePayload: asRecord(row.sourcePayload),
        createdAt: String(row.createdAt ?? ""),
      };
    })
    .filter((entry): entry is AuthorityRecommendationEvidence => Boolean(entry && entry.evidenceId && entry.title));
}

function toRecommendation(row: RecommendationRow): AuthorityRecommendation {
  return {
    recommendationId: row.recommendation_id,
    subjectUserId: row.subject_user_id,
    subjectDisplayName: row.subject_display_name,
    sourceKind: row.source_kind,
    status: row.status,
    scopeTaxonName: row.scope_taxon_name,
    scopeTaxonRank: row.scope_taxon_rank,
    scopeTaxonKey: row.scope_taxon_key,
    recommendedByUserId: row.recommended_by_user_id,
    recommendedByDisplayName: row.recommended_by_display_name,
    grantedAuthorityId: row.granted_authority_id,
    resolutionNote: row.resolution_note,
    resolvedByUserId: row.resolved_by_user_id,
    resolvedByDisplayName: row.resolved_by_display_name,
    resolvedAt: row.resolved_at,
    sourcePayload: asRecord(row.source_payload),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    evidence: toEvidence(row.evidence_json),
  };
}

function baseRecommendationSelect(whereClause: string, orderClause: string, limitClause = ""): string {
  return `
    select
      rec.recommendation_id::text,
      rec.subject_user_id,
      subject_user.display_name as subject_display_name,
      rec.source_kind,
      rec.status,
      rec.scope_taxon_name,
      rec.scope_taxon_rank,
      rec.scope_taxon_key,
      rec.recommended_by_user_id,
      recommender.display_name as recommended_by_display_name,
      rec.granted_authority_id::text,
      rec.resolution_note,
      rec.resolved_by_user_id,
      resolver.display_name as resolved_by_display_name,
      rec.resolved_at::text,
      rec.source_payload,
      rec.created_at::text,
      rec.updated_at::text,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'evidenceId', evidence.evidence_id::text,
            'evidenceType', evidence.evidence_type,
            'title', evidence.title,
            'issuerName', evidence.issuer_name,
            'url', evidence.url,
            'notes', evidence.notes,
            'sourcePayload', evidence.source_payload,
            'createdAt', evidence.created_at::text
          )
          order by evidence.created_at desc
        ) filter (where evidence.evidence_id is not null),
        '[]'::jsonb
      ) as evidence_json
    from authority_recommendations rec
    left join users subject_user on subject_user.user_id = rec.subject_user_id
    left join users recommender on recommender.user_id = rec.recommended_by_user_id
    left join users resolver on resolver.user_id = rec.resolved_by_user_id
    left join authority_recommendation_evidence evidence on evidence.recommendation_id = rec.recommendation_id
    ${whereClause}
    group by
      rec.recommendation_id,
      rec.subject_user_id,
      subject_user.display_name,
      rec.source_kind,
      rec.status,
      rec.scope_taxon_name,
      rec.scope_taxon_rank,
      rec.scope_taxon_key,
      rec.recommended_by_user_id,
      recommender.display_name,
      rec.granted_authority_id,
      rec.resolution_note,
      rec.resolved_by_user_id,
      resolver.display_name,
      rec.resolved_at,
      rec.source_payload,
      rec.created_at,
      rec.updated_at
    ${orderClause}
    ${limitClause}
  `;
}

async function loadRecommendations(queryText: string, values: unknown[]): Promise<AuthorityRecommendation[]> {
  const pool = getPool();
  const result = await pool.query<RecommendationRow>(queryText, values);
  return result.rows.map(toRecommendation);
}

async function getExistingActiveAuthorityId(
  subjectUserId: string,
  scopeTaxonName: string,
  scopeTaxonRank: string | null,
  scopeTaxonKey: string | null,
): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query<{ authority_id: string }>(
    `select authority_id::text
     from specialist_authorities
     where subject_user_id = $1
       and authority_kind = 'taxon_identification'
       and status = 'active'
       and lower(scope_taxon_name) = lower($2)
       and coalesce(scope_taxon_rank, '') = coalesce($3, '')
       and coalesce(scope_taxon_key, '') = coalesce($4, '')
     limit 1`,
    [subjectUserId, scopeTaxonName, scopeTaxonRank, scopeTaxonKey],
  );
  return result.rows[0]?.authority_id ?? null;
}

export async function getAuthorityRecommendationById(recommendationId: string): Promise<AuthorityRecommendation | null> {
  if (!normalizeText(recommendationId)) {
    return null;
  }

  const recommendations = await loadRecommendations(
    baseRecommendationSelect(
      "where rec.recommendation_id = $1::uuid",
      "order by rec.created_at desc",
    ),
    [recommendationId],
  );
  return recommendations[0] ?? null;
}

export async function listAuthorityRecommendationsForUser(userId: string): Promise<AuthorityRecommendation[]> {
  if (!normalizeText(userId)) {
    return [];
  }

  return loadRecommendations(
    baseRecommendationSelect(
      "where rec.subject_user_id = $1",
      "order by case rec.status when 'pending' then 0 when 'granted' then 1 when 'rejected' then 2 else 3 end, rec.created_at desc",
    ),
    [userId],
  );
}

export async function listPendingAuthorityRecommendationsForReviewer(input: {
  actorUserId: string;
  actorRoleName?: string | null;
  actorRankLabel?: string | null;
  limit?: number;
}): Promise<AuthorityRecommendation[]> {
  const access = await getReviewerAccessContext(input.actorUserId, input.actorRoleName, input.actorRankLabel);
  const safeLimit = Number.isFinite(input.limit) && (input.limit ?? 0) > 0
    ? Math.min(Math.floor(input.limit as number), 100)
    : 40;

  const recommendations = await loadRecommendations(
    baseRecommendationSelect(
      "where rec.status = 'pending'",
      "order by rec.created_at desc",
      `limit ${safeLimit}`,
    ),
    [],
  );

  if (access.canManageAll) {
    return recommendations;
  }

  if (access.activeAuthorities.length === 0) {
    return [];
  }

  return recommendations.filter((recommendation) =>
    access.activeAuthorities.some((authority) =>
      matchesAuthorityScope(authority, [recommendation.scopeTaxonName, recommendation.scopeTaxonKey]),
    ),
  );
}

export async function createAuthorityRecommendation(
  input: CreateAuthorityRecommendationInput,
): Promise<AuthorityRecommendation> {
  const actorUserId = normalizeText(input.actorUserId);
  const sourceKind = input.sourceKind;
  const subjectUserId = normalizeText(input.subjectUserId) || actorUserId;
  const scopeTaxonName = normalizeText(input.scopeTaxonName);
  const scopeTaxonRank = normalizeText(input.scopeTaxonRank) || null;
  const scopeTaxonKey = normalizeText(input.scopeTaxonKey) || null;
  const evidence = (input.evidence ?? []).map(validateEvidenceInput);

  if (!actorUserId) {
    throw new Error("actor_user_id_required");
  }
  if (!subjectUserId) {
    throw new Error("subject_user_id_required");
  }
  if (!scopeTaxonName) {
    throw new Error("scope_taxon_name_required");
  }
  if (sourceKind !== "self_claim" && sourceKind !== "ops_registered") {
    throw new Error("authority_recommendation_source_kind_invalid");
  }

  const activeAuthorityId = await getExistingActiveAuthorityId(
    subjectUserId,
    scopeTaxonName,
    scopeTaxonRank,
    scopeTaxonKey,
  );
  if (activeAuthorityId) {
    throw new Error("recommendation_not_needed_active_authority_exists");
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");

    const existing = await client.query<{ recommendation_id: string }>(
      `select recommendation_id::text
       from authority_recommendations
       where subject_user_id = $1
         and status = 'pending'
         and lower(scope_taxon_name) = lower($2)
         and coalesce(scope_taxon_rank, '') = coalesce($3, '')
         and coalesce(scope_taxon_key, '') = coalesce($4, '')
       limit 1`,
      [subjectUserId, scopeTaxonName, scopeTaxonRank, scopeTaxonKey],
    );

    let recommendationId = existing.rows[0]?.recommendation_id ?? "";
    if (recommendationId) {
      await client.query(
        `update authority_recommendations
         set recommended_by_user_id = $2,
             source_payload = coalesce(source_payload, '{}'::jsonb) || $3::jsonb,
             updated_at = now()
         where recommendation_id = $1::uuid`,
        [
          recommendationId,
          actorUserId,
          JSON.stringify({
            ...(input.sourcePayload ?? {}),
            latestSourceKind: sourceKind,
            updatedByUserId: actorUserId,
          }),
        ],
      );
    } else {
      const inserted = await client.query<{ recommendation_id: string }>(
        `insert into authority_recommendations (
            subject_user_id,
            source_kind,
            status,
            scope_taxon_name,
            scope_taxon_rank,
            scope_taxon_key,
            recommended_by_user_id,
            source_payload,
            created_at,
            updated_at
         ) values (
            $1, $2, 'pending', $3, $4, $5, $6, $7::jsonb, now(), now()
         )
         returning recommendation_id::text`,
        [
          subjectUserId,
          sourceKind,
          scopeTaxonName,
          scopeTaxonRank,
          scopeTaxonKey,
          actorUserId,
          JSON.stringify({
            ...(input.sourcePayload ?? {}),
            origin: "authority_recommendation",
          }),
        ],
      );
      recommendationId = inserted.rows[0]?.recommendation_id ?? "";
    }

    if (!recommendationId) {
      throw new Error("authority_recommendation_create_failed");
    }

    for (const entry of evidence) {
      await client.query(
        `insert into authority_recommendation_evidence (
            recommendation_id,
            evidence_type,
            title,
            issuer_name,
            url,
            notes,
            source_payload
         ) values ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb)`,
        [
          recommendationId,
          entry.evidenceType,
          entry.title,
          entry.issuerName,
          entry.url,
          entry.notes,
          JSON.stringify(entry.sourcePayload ?? {}),
        ],
      );
    }

    await client.query(
      `insert into authority_recommendation_audit (recommendation_id, actor_user_id, action, payload)
       values ($1::uuid, $2, $3, $4::jsonb)`,
      [
        recommendationId,
        actorUserId,
        existing.rows[0]?.recommendation_id ? "update" : "create",
        JSON.stringify({
          sourceKind,
          subjectUserId,
          scopeTaxonName,
          scopeTaxonRank,
          scopeTaxonKey,
          evidenceCount: evidence.length,
        }),
      ],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const recommendation = await loadRecommendations(
    baseRecommendationSelect(
      "where rec.subject_user_id = $1 and rec.status = 'pending' and lower(rec.scope_taxon_name) = lower($2) and coalesce(rec.scope_taxon_rank, '') = coalesce($3, '') and coalesce(rec.scope_taxon_key, '') = coalesce($4, '')",
      "order by rec.created_at desc",
      "limit 1",
    ),
    [subjectUserId, scopeTaxonName, scopeTaxonRank, scopeTaxonKey],
  );

  if (!recommendation[0]) {
    throw new Error("authority_recommendation_create_failed");
  }

  return recommendation[0];
}

export async function grantAuthorityRecommendation(
  input: GrantAuthorityRecommendationInput,
): Promise<AuthorityRecommendationResolution> {
  const recommendationId = normalizeText(input.recommendationId);
  const actorUserId = normalizeText(input.actorUserId);
  const resolutionNote = normalizeText(input.resolutionNote) || null;

  if (!recommendationId) {
    throw new Error("recommendation_id_required");
  }
  if (!actorUserId) {
    throw new Error("actor_user_id_required");
  }

  const recommendation = await getAuthorityRecommendationById(recommendationId);
  if (!recommendation) {
    throw new Error("authority_recommendation_not_found");
  }
  if (recommendation.status !== "pending") {
    throw new Error("authority_recommendation_not_pending");
  }

  const access = await getReviewerAccessContext(actorUserId, input.actorRoleName, input.actorRankLabel);
  const matchingAuthority = access.activeAuthorities.find((authority) =>
    matchesAuthorityScope(authority, [recommendation.scopeTaxonName, recommendation.scopeTaxonKey]),
  ) ?? null;

  if (!matchingAuthority) {
    throw new Error("recommendation_grant_scope_required");
  }

  const pool = getPool();
  const client = await pool.connect();
  let authorityId: string | null = null;
  try {
    await client.query("begin");

    const existingAuthority = await client.query<{ authority_id: string }>(
      `select authority_id::text
       from specialist_authorities
       where subject_user_id = $1
         and authority_kind = 'taxon_identification'
         and status = 'active'
         and lower(scope_taxon_name) = lower($2)
         and coalesce(scope_taxon_rank, '') = coalesce($3, '')
         and coalesce(scope_taxon_key, '') = coalesce($4, '')
       limit 1`,
      [
        recommendation.subjectUserId,
        recommendation.scopeTaxonName,
        recommendation.scopeTaxonRank,
        recommendation.scopeTaxonKey,
      ],
    );

    authorityId = existingAuthority.rows[0]?.authority_id ?? null;
    if (!authorityId) {
      const inserted = await client.query<{ authority_id: string }>(
        `insert into specialist_authorities (
            subject_user_id,
            granted_by_user_id,
            status,
            authority_kind,
            scope_taxon_name,
            scope_taxon_rank,
            scope_taxon_key,
            scope_json,
            reason,
            source_payload,
            granted_at,
            created_at,
            updated_at
         ) values (
            $1, $2, 'active', 'taxon_identification', $3, $4, $5, '{}'::jsonb, $6, $7::jsonb, now(), now(), now()
         )
         returning authority_id::text`,
        [
          recommendation.subjectUserId,
          actorUserId,
          recommendation.scopeTaxonName,
          recommendation.scopeTaxonRank,
          recommendation.scopeTaxonKey,
          resolutionNote ?? `recommendation:${recommendation.recommendationId}`,
          JSON.stringify({
            origin: "authority_recommendation_grant",
            recommendationId: recommendation.recommendationId,
            grantedViaAuthorityId: matchingAuthority.authorityId,
          }),
        ],
      );
      authorityId = inserted.rows[0]?.authority_id ?? null;

      for (const entry of recommendation.evidence) {
        await client.query(
          `insert into specialist_authority_evidence (
              authority_id,
              evidence_type,
              title,
              issuer_name,
              url,
              notes,
              source_payload
           ) values ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb)`,
          [
            authorityId,
            entry.evidenceType,
            entry.title,
            entry.issuerName,
            entry.url,
            entry.notes,
            JSON.stringify({
              ...entry.sourcePayload,
              recommendationId: recommendation.recommendationId,
            }),
          ],
        );
      }

      await client.query(
        `insert into specialist_authority_audit (authority_id, actor_user_id, action, payload)
         values ($1::uuid, $2, 'grant', $3::jsonb)`,
        [
          authorityId,
          actorUserId,
          JSON.stringify({
            recommendationId: recommendation.recommendationId,
            subjectUserId: recommendation.subjectUserId,
            scopeTaxonName: recommendation.scopeTaxonName,
            scopeTaxonRank: recommendation.scopeTaxonRank,
            evidenceCount: recommendation.evidence.length,
            autoGranted: true,
          }),
        ],
      );
    }

    await client.query(
      `update authority_recommendations
       set status = 'granted',
           granted_authority_id = $2::uuid,
           resolution_note = $3,
           resolved_by_user_id = $4,
           resolved_at = now(),
           updated_at = now()
       where recommendation_id = $1::uuid`,
      [recommendation.recommendationId, authorityId, resolutionNote, actorUserId],
    );

    await client.query(
      `insert into authority_recommendation_audit (recommendation_id, actor_user_id, action, payload)
       values ($1::uuid, $2, 'grant', $3::jsonb)`,
      [
        recommendation.recommendationId,
        actorUserId,
        JSON.stringify({
          authorityId,
          grantedViaAuthorityId: matchingAuthority.authorityId,
          resolutionNote,
        }),
      ],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const resolvedRecommendation = await getAuthorityRecommendationById(recommendation.recommendationId);
  const authority = authorityId ? await getReviewerAuthorityById(authorityId) : null;
  if (!resolvedRecommendation) {
    throw new Error("authority_recommendation_not_found");
  }

  return {
    recommendation: resolvedRecommendation,
    authority,
  };
}

export async function rejectAuthorityRecommendation(
  input: RejectAuthorityRecommendationInput,
): Promise<AuthorityRecommendation> {
  const recommendationId = normalizeText(input.recommendationId);
  const actorUserId = normalizeText(input.actorUserId);
  const resolutionNote = normalizeText(input.resolutionNote);

  if (!recommendationId) {
    throw new Error("recommendation_id_required");
  }
  if (!actorUserId) {
    throw new Error("actor_user_id_required");
  }
  if (!resolutionNote) {
    throw new Error("recommendation_resolution_note_required");
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const updated = await client.query<{ recommendation_id: string }>(
      `update authority_recommendations
       set status = 'rejected',
           resolution_note = $2,
           resolved_by_user_id = $3,
           resolved_at = now(),
           updated_at = now()
       where recommendation_id = $1::uuid
         and status = 'pending'
       returning recommendation_id::text`,
      [recommendationId, resolutionNote, actorUserId],
    );
    if (!updated.rows[0]?.recommendation_id) {
      throw new Error("authority_recommendation_not_pending");
    }

    await client.query(
      `insert into authority_recommendation_audit (recommendation_id, actor_user_id, action, payload)
       values ($1::uuid, $2, 'reject', $3::jsonb)`,
      [recommendationId, actorUserId, JSON.stringify({ resolutionNote })],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const recommendation = await getAuthorityRecommendationById(recommendationId);
  if (!recommendation) {
    throw new Error("authority_recommendation_not_found");
  }
  return recommendation;
}
