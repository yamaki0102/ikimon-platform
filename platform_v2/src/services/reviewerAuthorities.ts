import { getPool } from "../db.js";

export type ReviewerAuthorityEvidenceType =
  | "field_event"
  | "webinar"
  | "literature"
  | "reference_owned"
  | "other";

export type ReviewerAuthorityEvidenceInput = {
  evidenceType: ReviewerAuthorityEvidenceType;
  title: string;
  issuerName?: string | null;
  url?: string | null;
  notes?: string | null;
  sourcePayload?: Record<string, unknown>;
};

export type ReviewerAuthorityEvidence = {
  evidenceId: string;
  evidenceType: ReviewerAuthorityEvidenceType;
  title: string;
  issuerName: string | null;
  url: string | null;
  notes: string | null;
  sourcePayload: Record<string, unknown>;
  createdAt: string;
};

export type ReviewerAuthority = {
  authorityId: string;
  subjectUserId: string;
  grantedByUserId: string | null;
  status: "active" | "revoked";
  authorityKind: "taxon_identification";
  scopeTaxonName: string;
  scopeTaxonRank: string | null;
  scopeTaxonKey: string | null;
  scopeJson: Record<string, unknown>;
  grantedAt: string;
  revokedAt: string | null;
  expiresAt: string | null;
  reason: string | null;
  sourcePayload: Record<string, unknown>;
  evidence: ReviewerAuthorityEvidence[];
};

export type ReviewerAuthoritySnapshot = {
  authorityId: string;
  authorityKind: "taxon_identification";
  scopeTaxonName: string;
  scopeTaxonRank: string | null;
  scopeTaxonKey: string | null;
  scopeJson: Record<string, unknown>;
  grantedAt: string;
  expiresAt: string | null;
  reason: string | null;
  evidence: Array<{
    evidenceId: string;
    evidenceType: ReviewerAuthorityEvidenceType;
    title: string;
    issuerName: string | null;
    url: string | null;
  }>;
};

export type ReviewerAuthorityAccessContext = {
  globalRole: "admin" | "analyst" | "specialist" | null;
  canManageAll: boolean;
  hasSpecialistAccess: boolean;
  activeAuthorities: ReviewerAuthoritySnapshot[];
};

export type ReviewerAuthorityReviewClass =
  | "authority_backed"
  | "admin_override"
  | "plain_review";

export type ReviewerAuthorityResolution = {
  authorityMatched: boolean;
  authorityScope: ReviewerAuthoritySnapshot | null;
  reviewClass: ReviewerAuthorityReviewClass;
  accessContext: ReviewerAuthorityAccessContext;
};

export type GrantReviewerAuthorityInput = {
  subjectUserId: string;
  grantedByUserId: string;
  scopeTaxonName: string;
  scopeTaxonRank?: string | null;
  scopeTaxonKey?: string | null;
  reason?: string | null;
  evidence?: ReviewerAuthorityEvidenceInput[];
  sourcePayload?: Record<string, unknown>;
};

export type RevokeReviewerAuthorityInput = {
  authorityId: string;
  revokedByUserId: string;
  reason: string;
};

export type AddReviewerAuthorityEvidenceInput = {
  authorityId: string;
  actorUserId: string;
  evidence: ReviewerAuthorityEvidenceInput;
};

export type ReviewerAuthorityAuditAction = "grant" | "revoke" | "update";

export type ReviewerAuthorityAuditEntry = {
  auditId: string;
  authorityId: string | null;
  action: ReviewerAuthorityAuditAction;
  createdAt: string;
  actorUserId: string | null;
  actorDisplayName: string | null;
  subjectUserId: string | null;
  subjectDisplayName: string | null;
  authorityStatus: "active" | "revoked" | null;
  scopeTaxonName: string | null;
  scopeTaxonRank: string | null;
  payload: Record<string, unknown>;
  evidence: Array<{
    evidenceType: ReviewerAuthorityEvidenceType;
    title: string;
    issuerName: string | null;
    url: string | null;
  }>;
};

export type ListReviewerAuthorityAuditInput = {
  subjectUserId?: string | null;
  scopeTaxonName?: string | null;
  action?: ReviewerAuthorityAuditAction | null;
  status?: "active" | "revoked" | null;
  limit?: number;
};

type AuthorityRow = {
  authority_id: string;
  subject_user_id: string;
  granted_by_user_id: string | null;
  status: "active" | "revoked";
  authority_kind: "taxon_identification";
  scope_taxon_name: string;
  scope_taxon_rank: string | null;
  scope_taxon_key: string | null;
  scope_json: unknown;
  granted_at: string;
  revoked_at: string | null;
  expires_at: string | null;
  reason: string | null;
  source_payload: unknown;
  evidence_json: unknown;
};

type AuthorityAuditRow = {
  audit_id: string;
  authority_id: string | null;
  action: ReviewerAuthorityAuditAction;
  created_at: string;
  actor_user_id: string | null;
  actor_display_name: string | null;
  subject_user_id: string | null;
  subject_display_name: string | null;
  authority_status: "active" | "revoked" | null;
  scope_taxon_name: string | null;
  scope_taxon_rank: string | null;
  payload: unknown;
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
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function stripScopeSuffix(value: string): string {
  return value.replace(/(属|科|目|綱|門|類)$/u, "").trim();
}

function toEvidence(input: unknown): ReviewerAuthorityEvidence[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry): ReviewerAuthorityEvidence | null => {
      if (typeof entry !== "object" || entry === null) {
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
    .filter((entry): entry is ReviewerAuthorityEvidence => Boolean(entry && entry.evidenceId && entry.title));
}

function toAuthority(row: AuthorityRow): ReviewerAuthority {
  return {
    authorityId: row.authority_id,
    subjectUserId: row.subject_user_id,
    grantedByUserId: row.granted_by_user_id,
    status: row.status,
    authorityKind: row.authority_kind,
    scopeTaxonName: row.scope_taxon_name,
    scopeTaxonRank: row.scope_taxon_rank,
    scopeTaxonKey: row.scope_taxon_key,
    scopeJson: asRecord(row.scope_json),
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at,
    expiresAt: row.expires_at,
    reason: row.reason,
    sourcePayload: asRecord(row.source_payload),
    evidence: toEvidence(row.evidence_json),
  };
}

function toSnapshot(authority: ReviewerAuthority): ReviewerAuthoritySnapshot {
  return {
    authorityId: authority.authorityId,
    authorityKind: authority.authorityKind,
    scopeTaxonName: authority.scopeTaxonName,
    scopeTaxonRank: authority.scopeTaxonRank,
    scopeTaxonKey: authority.scopeTaxonKey,
    scopeJson: authority.scopeJson,
    grantedAt: authority.grantedAt,
    expiresAt: authority.expiresAt,
    reason: authority.reason,
    evidence: authority.evidence.map((entry) => ({
      evidenceId: entry.evidenceId,
      evidenceType: entry.evidenceType,
      title: entry.title,
      issuerName: entry.issuerName,
      url: entry.url,
    })),
  };
}

function toAuditEntry(row: AuthorityAuditRow): ReviewerAuthorityAuditEntry {
  const evidence = toEvidence(row.evidence_json).map((entry) => ({
    evidenceType: entry.evidenceType,
    title: entry.title,
    issuerName: entry.issuerName,
    url: entry.url,
  }));

  return {
    auditId: row.audit_id,
    authorityId: row.authority_id,
    action: row.action,
    createdAt: row.created_at,
    actorUserId: row.actor_user_id,
    actorDisplayName: row.actor_display_name,
    subjectUserId: row.subject_user_id,
    subjectDisplayName: row.subject_display_name,
    authorityStatus: row.authority_status,
    scopeTaxonName: row.scope_taxon_name,
    scopeTaxonRank: row.scope_taxon_rank,
    payload: asRecord(row.payload),
    evidence,
  };
}

function validateEvidenceInput(input: ReviewerAuthorityEvidenceInput): ReviewerAuthorityEvidenceInput {
  if (!EVIDENCE_TYPES.includes(input.evidenceType)) {
    throw new Error(`unsupported_evidence_type:${input.evidenceType}`);
  }

  const title = input.title.trim();
  if (!title) {
    throw new Error("authority_evidence_title_required");
  }

  return {
    evidenceType: input.evidenceType,
    title,
    issuerName: input.issuerName?.trim() || null,
    url: input.url?.trim() || null,
    notes: input.notes?.trim() || null,
    sourcePayload: input.sourcePayload ?? {},
  };
}

async function loadAuthorityRows(queryText: string, values: unknown[]): Promise<ReviewerAuthority[]> {
  const pool = getPool();
  const result = await pool.query<AuthorityRow>(queryText, values);
  return result.rows.map(toAuthority);
}

function baseAuthoritySelect(whereClause: string, orderClause: string, limitClause = ""): string {
  return `
    select
      sa.authority_id::text,
      sa.subject_user_id,
      sa.granted_by_user_id,
      sa.status,
      sa.authority_kind,
      sa.scope_taxon_name,
      sa.scope_taxon_rank,
      sa.scope_taxon_key,
      sa.scope_json,
      sa.granted_at::text,
      sa.revoked_at::text,
      sa.expires_at::text,
      sa.reason,
      sa.source_payload,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'evidenceId', e.evidence_id::text,
            'evidenceType', e.evidence_type,
            'title', e.title,
            'issuerName', e.issuer_name,
            'url', e.url,
            'notes', e.notes,
            'sourcePayload', e.source_payload,
            'createdAt', e.created_at::text
          )
          order by e.created_at desc
        ) filter (where e.evidence_id is not null),
        '[]'::jsonb
      ) as evidence_json
    from specialist_authorities sa
    left join specialist_authority_evidence e on e.authority_id = sa.authority_id
    ${whereClause}
    group by
      sa.authority_id,
      sa.subject_user_id,
      sa.granted_by_user_id,
      sa.status,
      sa.authority_kind,
      sa.scope_taxon_name,
      sa.scope_taxon_rank,
      sa.scope_taxon_key,
      sa.scope_json,
      sa.granted_at,
      sa.revoked_at,
      sa.expires_at,
      sa.reason,
      sa.source_payload
    ${orderClause}
    ${limitClause}
  `;
}

export function resolveReviewerGlobalRole(
  roleName: string | null | undefined,
  rankLabel: string | null | undefined,
): ReviewerAuthorityAccessContext["globalRole"] {
  const candidates = [roleName, rankLabel].map((value) => normalizeText(value));

  if (candidates.some((value) => value === "admin" || value === "管理者")) {
    return "admin";
  }
  if (candidates.some((value) => value === "analyst" || value === "分析担当")) {
    return "analyst";
  }
  if (candidates.some((value) => value === "specialist" || value === "専門家" || value === "研究者")) {
    return "specialist";
  }
  return null;
}

export function isAdminOrAnalystRole(
  roleName: string | null | undefined,
  rankLabel: string | null | undefined,
): boolean {
  const globalRole = resolveReviewerGlobalRole(roleName, rankLabel);
  return globalRole === "admin" || globalRole === "analyst";
}

export async function listActiveReviewerAuthoritiesForUser(userId: string): Promise<ReviewerAuthoritySnapshot[]> {
  if (!userId.trim()) {
    return [];
  }

  const authorities = await loadAuthorityRows(
    baseAuthoritySelect(
      "where sa.subject_user_id = $1 and sa.status = 'active' and (sa.expires_at is null or sa.expires_at > now())",
      "order by sa.granted_at desc",
    ),
    [userId],
  );

  return authorities.map(toSnapshot);
}

export async function listReviewerAuthoritiesForUser(userId: string): Promise<ReviewerAuthority[]> {
  if (!userId.trim()) {
    return [];
  }

  return loadAuthorityRows(
    baseAuthoritySelect(
      "where sa.subject_user_id = $1",
      "order by sa.granted_at desc",
    ),
    [userId],
  );
}

export async function listRecentReviewerAuthorities(limit = 24): Promise<ReviewerAuthority[]> {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 24;
  return loadAuthorityRows(
    baseAuthoritySelect(
      "",
      "order by sa.granted_at desc",
      `limit ${safeLimit}`,
    ),
    [],
  );
}

export async function getReviewerAuthorityById(authorityId: string): Promise<ReviewerAuthority | null> {
  if (!authorityId.trim()) {
    return null;
  }

  const authorities = await loadAuthorityRows(
    baseAuthoritySelect(
      "where sa.authority_id = $1::uuid",
      "order by sa.granted_at desc",
    ),
    [authorityId],
  );
  return authorities[0] ?? null;
}

export async function listReviewerAuthorityAudit(
  input: ListReviewerAuthorityAuditInput = {},
): Promise<ReviewerAuthorityAuditEntry[]> {
  const values: unknown[] = [];
  const where: string[] = [];
  const safeLimit = Number.isFinite(input.limit) && (input.limit ?? 0) > 0
    ? Math.min(Math.floor(input.limit as number), 200)
    : 40;

  if (input.subjectUserId?.trim()) {
    values.push(input.subjectUserId.trim());
    where.push(`sa.subject_user_id = $${values.length}`);
  }

  if (input.scopeTaxonName?.trim()) {
    values.push(`%${input.scopeTaxonName.trim().toLowerCase()}%`);
    where.push(`lower(coalesce(sa.scope_taxon_name, '')) like $${values.length}`);
  }

  if (input.action) {
    values.push(input.action);
    where.push(`audit.action = $${values.length}`);
  }

  if (input.status) {
    values.push(input.status);
    where.push(`sa.status = $${values.length}`);
  }

  const whereClause = where.length > 0 ? `where ${where.join(" and ")}` : "";
  const pool = getPool();
  const result = await pool.query<AuthorityAuditRow>(
    `
      select
        audit.audit_id::text,
        audit.authority_id::text,
        audit.action,
        audit.created_at::text,
        audit.actor_user_id,
        actor.display_name as actor_display_name,
        sa.subject_user_id,
        subject_user.display_name as subject_display_name,
        sa.status as authority_status,
        sa.scope_taxon_name,
        sa.scope_taxon_rank,
        audit.payload,
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
      from specialist_authority_audit audit
      left join specialist_authorities sa on sa.authority_id = audit.authority_id
      left join users actor on actor.user_id = audit.actor_user_id
      left join users subject_user on subject_user.user_id = sa.subject_user_id
      left join specialist_authority_evidence evidence on evidence.authority_id = sa.authority_id
      ${whereClause}
      group by
        audit.audit_id,
        audit.authority_id,
        audit.action,
        audit.created_at,
        audit.actor_user_id,
        actor.display_name,
        sa.subject_user_id,
        subject_user.display_name,
        sa.status,
        sa.scope_taxon_name,
        sa.scope_taxon_rank,
        audit.payload
      order by audit.created_at desc
      limit ${safeLimit}
    `,
    values,
  );

  return result.rows.map(toAuditEntry);
}

export async function getReviewerAccessContext(
  userId: string,
  roleName: string | null | undefined,
  rankLabel: string | null | undefined,
): Promise<ReviewerAuthorityAccessContext> {
  const globalRole = resolveReviewerGlobalRole(roleName, rankLabel);
  const activeAuthorities = await listActiveReviewerAuthoritiesForUser(userId);
  const canManageAll = globalRole === "admin" || globalRole === "analyst";

  return {
    globalRole,
    canManageAll,
    hasSpecialistAccess: canManageAll || activeAuthorities.length > 0,
    activeAuthorities,
  };
}

export function matchesAuthorityScope(
  authority: ReviewerAuthoritySnapshot,
  candidateTaxa: Array<string | null | undefined>,
): boolean {
  const normalizedCandidates = candidateTaxa
    .map((value) => normalizeText(value))
    .filter((value) => value.length > 0);

  if (normalizedCandidates.length === 0) {
    return false;
  }

  const scopeNames = new Set<string>();
  const primary = normalizeText(authority.scopeTaxonName);
  if (primary) {
    scopeNames.add(primary);
  }

  const rawAliases = authority.scopeJson.aliases;
  if (Array.isArray(rawAliases)) {
    for (const alias of rawAliases) {
      const normalizedAlias = normalizeText(typeof alias === "string" ? alias : null);
      if (normalizedAlias) {
        scopeNames.add(normalizedAlias);
      }
    }
  }

  for (const scopeName of scopeNames) {
    const stripped = stripScopeSuffix(scopeName);
    for (const candidate of normalizedCandidates) {
      if (candidate === scopeName) {
        return true;
      }
      if (candidate.startsWith(`${scopeName} `) || candidate.startsWith(`${scopeName}_`)) {
        return true;
      }
      if (stripped.length >= 3 && candidate.includes(stripped)) {
        return true;
      }
    }
  }

  return false;
}

export async function resolveAuthorityForReview(input: {
  actorUserId: string;
  actorRoleName?: string | null;
  actorRankLabel?: string | null;
  proposedName: string;
}): Promise<ReviewerAuthorityResolution> {
  const accessContext = await getReviewerAccessContext(
    input.actorUserId,
    input.actorRoleName,
    input.actorRankLabel,
  );

  const matched = accessContext.activeAuthorities.find((authority) =>
    matchesAuthorityScope(authority, [input.proposedName]),
  ) ?? null;

  if (matched) {
    return {
      authorityMatched: true,
      authorityScope: matched,
      reviewClass: "authority_backed",
      accessContext,
    };
  }

  if (accessContext.canManageAll) {
    return {
      authorityMatched: false,
      authorityScope: null,
      reviewClass: "admin_override",
      accessContext,
    };
  }

  return {
    authorityMatched: false,
    authorityScope: null,
    reviewClass: "plain_review",
    accessContext,
  };
}

export async function grantReviewerAuthority(input: GrantReviewerAuthorityInput): Promise<ReviewerAuthority> {
  const subjectUserId = input.subjectUserId.trim();
  const grantedByUserId = input.grantedByUserId.trim();
  const scopeTaxonName = input.scopeTaxonName.trim();

  if (!subjectUserId) {
    throw new Error("subject_user_id_required");
  }
  if (!grantedByUserId) {
    throw new Error("granted_by_user_id_required");
  }
  if (!scopeTaxonName) {
    throw new Error("scope_taxon_name_required");
  }

  const normalizedRank = input.scopeTaxonRank?.trim() || null;
  const normalizedKey = input.scopeTaxonKey?.trim() || null;
  const normalizedReason = input.reason?.trim() || null;
  const evidence = (input.evidence ?? []).map(validateEvidenceInput);
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const existing = await client.query<{ authority_id: string }>(
      `select authority_id::text
       from specialist_authorities
       where subject_user_id = $1
         and authority_kind = 'taxon_identification'
         and status = 'active'
         and lower(scope_taxon_name) = lower($2)
         and coalesce(scope_taxon_rank, '') = coalesce($3, '')
         and coalesce(scope_taxon_key, '') = coalesce($4, '')
       limit 1`,
      [subjectUserId, scopeTaxonName, normalizedRank, normalizedKey],
    );
    if (existing.rows[0]?.authority_id) {
      throw new Error("specialist_authority_already_active");
    }

    const authorityResult = await client.query<{ authority_id: string }>(
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
          $1, $2, 'active', 'taxon_identification', $3, $4, $5, $6::jsonb, $7, $8::jsonb, now(), now(), now()
       )
       returning authority_id::text`,
      [
        subjectUserId,
        grantedByUserId,
        scopeTaxonName,
        normalizedRank,
        normalizedKey,
        JSON.stringify({}),
        normalizedReason,
        JSON.stringify({
          ...(input.sourcePayload ?? {}),
          origin: "v2_authority_grant",
        }),
      ],
    );
    const authorityId = authorityResult.rows[0]?.authority_id;
    if (!authorityId) {
      throw new Error("specialist_authority_grant_failed");
    }

    for (const entry of evidence) {
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
          JSON.stringify(entry.sourcePayload ?? {}),
        ],
      );
    }

    await client.query(
      `insert into specialist_authority_audit (authority_id, actor_user_id, action, payload)
       values ($1::uuid, $2, 'grant', $3::jsonb)`,
      [
        authorityId,
        grantedByUserId,
        JSON.stringify({
          subjectUserId,
          scopeTaxonName,
          scopeTaxonRank: normalizedRank,
          scopeTaxonKey: normalizedKey,
          reason: normalizedReason,
          evidenceCount: evidence.length,
        }),
      ],
    );

    await client.query("commit");
    const granted = await getReviewerAuthorityById(authorityId);
    if (!granted) {
      throw new Error("specialist_authority_grant_failed");
    }
    return granted;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeReviewerAuthority(input: RevokeReviewerAuthorityInput): Promise<ReviewerAuthority> {
  const authorityId = input.authorityId.trim();
  const revokedByUserId = input.revokedByUserId.trim();
  const reason = input.reason.trim();

  if (!authorityId) {
    throw new Error("authority_id_required");
  }
  if (!revokedByUserId) {
    throw new Error("revoked_by_user_id_required");
  }
  if (!reason) {
    throw new Error("revoke_reason_required");
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const updated = await client.query<{ authority_id: string }>(
      `update specialist_authorities
       set status = 'revoked',
           revoked_at = now(),
           updated_at = now(),
           source_payload = coalesce(source_payload, '{}'::jsonb) || jsonb_build_object(
             'revokedByUserId', $2::text,
             'revokeReason', $3::text,
             'revokedAt', now()::text
           )
       where authority_id = $1::uuid
         and status = 'active'
       returning authority_id::text`,
      [authorityId, revokedByUserId, reason],
    );
    if (!updated.rows[0]?.authority_id) {
      throw new Error("specialist_authority_not_found_or_revoked");
    }

    await client.query(
      `insert into specialist_authority_audit (authority_id, actor_user_id, action, payload)
       values ($1::uuid, $2, 'revoke', $3::jsonb)`,
      [authorityId, revokedByUserId, JSON.stringify({ reason })],
    );

    await client.query("commit");
    const revoked = await getReviewerAuthorityById(authorityId);
    if (!revoked) {
      throw new Error("specialist_authority_not_found_or_revoked");
    }
    return revoked;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function addReviewerAuthorityEvidence(
  input: AddReviewerAuthorityEvidenceInput,
): Promise<ReviewerAuthority> {
  const authorityId = input.authorityId.trim();
  const actorUserId = input.actorUserId.trim();
  if (!authorityId) {
    throw new Error("authority_id_required");
  }
  if (!actorUserId) {
    throw new Error("actor_user_id_required");
  }
  const evidence = validateEvidenceInput(input.evidence);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const exists = await client.query<{ authority_id: string }>(
      `select authority_id::text
       from specialist_authorities
       where authority_id = $1::uuid
       limit 1`,
      [authorityId],
    );
    if (!exists.rows[0]?.authority_id) {
      throw new Error("specialist_authority_not_found");
    }

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
        evidence.evidenceType,
        evidence.title,
        evidence.issuerName,
        evidence.url,
        evidence.notes,
        JSON.stringify(evidence.sourcePayload ?? {}),
      ],
    );

    await client.query(
      `insert into specialist_authority_audit (authority_id, actor_user_id, action, payload)
       values ($1::uuid, $2, 'update', $3::jsonb)`,
      [
        authorityId,
        actorUserId,
        JSON.stringify({
          type: "evidence_added",
          evidenceType: evidence.evidenceType,
          title: evidence.title,
        }),
      ],
    );

    await client.query("commit");
    const authority = await getReviewerAuthorityById(authorityId);
    if (!authority) {
      throw new Error("specialist_authority_not_found");
    }
    return authority;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
