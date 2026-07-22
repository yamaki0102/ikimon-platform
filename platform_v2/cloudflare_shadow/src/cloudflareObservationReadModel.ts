export type RecordObservationReadRow = {
  observation_id: string;
  record_id: string;
  owner_user_id: string;
  origin: "owner" | "ai" | "community" | "curator" | "import";
  assertion_status: "human_asserted" | "provisional" | "community_proposed" | "curator_asserted";
  verification_status: string;
  lifecycle_status: "active" | "excluded" | "merged" | "deleted";
  data_use_scope: "public_reuse" | "community_review" | "personal_only";
  accepted_identification_id: string | null;
  subject_type: "organism" | "pet" | "unknown_subject" | "group";
  display_order: number;
  context_json: string;
  provenance_json: string;
};

export type RecordObservationPolicyRow = {
  visibility: "public" | "limited" | "private";
  accepts_identification_proposals: number;
  accepts_media_proposals: number;
};

export type RecordObservationMediaRow = {
  observation_id: string;
  media_id: string;
  media_kind: "photo" | "video" | "audio";
  active: number;
  display_order: number;
};

export type RecordObservationClaimRow = {
  claim_id: string;
  observation_id: string;
  actor_type: "owner" | "community" | "curator";
  actor_id: string;
  proposed_name: string;
  proposed_scientific_name: string | null;
  proposed_rank: string | null;
  stance: string;
  claim_status: "active" | "accepted" | "withdrawn" | "rejected";
  created_at: string;
};

export type RecordObservationAiSuggestionRow = {
  suggestion_id: string;
  observation_id: string;
  proposed_name: string | null;
  proposed_scientific_name: string | null;
  proposed_rank: string | null;
  suggestion_status: string;
};

export type RecordObservationReadSnapshot = {
  recordId: string;
  ownerUserId: string;
  visibility: "public" | "limited" | "private";
  policy: RecordObservationPolicyRow | null;
  observations: RecordObservationReadRow[];
  media: RecordObservationMediaRow[];
  claims: RecordObservationClaimRow[];
  aiSuggestions: RecordObservationAiSuggestionRow[];
};

export type ObservationFirstCard = {
  observationId: string;
  state: "active" | "excluded";
  subjectType: RecordObservationReadRow["subject_type"];
  subjectLabel: string;
  assertionStatus: string;
  verificationStatus: string;
  acceptedIdentification: null | {
    claimId: string;
    actorType: RecordObservationClaimRow["actor_type"];
    actorId: string;
    proposedName: string;
    proposedScientificName: string | null;
    proposedRank: string | null;
    humanDecision: true;
  };
  communityIdentifications: Array<{
    claimId: string;
    actorType: RecordObservationClaimRow["actor_type"];
    proposedName: string;
    proposedScientificName: string | null;
    proposedRank: string | null;
    stance: string;
    accepted: boolean;
  }>;
  aiSuggestions: Array<{
    suggestionId: string;
    proposedName: string | null;
    proposedScientificName: string | null;
    proposedRank: string | null;
    provisional: true;
  }>;
  media: Array<{ mediaId: string; mediaKind: "photo" | "video" | "audio"; displayOrder: number }>;
  provenance: {
    owner: boolean;
    ai: boolean;
    community: boolean;
    curator: boolean;
    imported: boolean;
  };
};

export type ObservationFirstRecordDetail = {
  schema: "ikimon.observation-first-record-detail/v1";
  recordId: string;
  owner: boolean;
  visibility: "public" | "limited" | "private";
  observationCount: number;
  proposalPolicy: {
    identification: boolean;
    media: boolean;
    disabledReason: "record_private" | "record_policy" | null;
  };
  observations: ObservationFirstCard[];
  privacy: { exactLocationExposed: false; publicLocationLabel: "位置情報は公開範囲に合わせて保護されています" };
};

const parseContext = (value: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const subjectLabel = (row: RecordObservationReadRow): string => {
  const context = parseContext(row.context_json);
  const candidate = [context.displayName, context.taxonLabel, context.subjectLabel]
    .find((value) => typeof value === "string" && value.trim()) as string | undefined;
  if (candidate) return candidate.trim();
  if (row.subject_type === "pet") return "飼育されている生きもの";
  if (row.subject_type === "group") return "複数の生きもの";
  if (row.subject_type === "unknown_subject") return "名前を決めていない対象";
  return "観察した生きもの";
};

export function buildObservationFirstRecordDetail(
  snapshot: RecordObservationReadSnapshot,
  viewerUserId: string | null,
): ObservationFirstRecordDetail | null {
  const owner = Boolean(viewerUserId && viewerUserId === snapshot.ownerUserId);
  if (snapshot.visibility !== "public" && !owner) return null;
  const privateRecord = snapshot.visibility === "private";
  const policyDisabled = !snapshot.policy || snapshot.policy.accepts_identification_proposals !== 1;
  const activeRows = snapshot.observations
    .filter((row) => row.lifecycle_status !== "deleted" && row.lifecycle_status !== "merged")
    .filter((row) => owner || (row.lifecycle_status === "active" && row.data_use_scope === "public_reuse"))
    .sort((left, right) => left.display_order - right.display_order || left.observation_id.localeCompare(right.observation_id));
  const observations = activeRows.map((row): ObservationFirstCard => {
    const claims = snapshot.claims
      .filter((claim) => claim.observation_id === row.observation_id && !["withdrawn", "rejected"].includes(claim.claim_status))
      .sort((left, right) => left.created_at.localeCompare(right.created_at) || left.claim_id.localeCompare(right.claim_id));
    const accepted = row.accepted_identification_id
      ? claims.find((claim) => claim.claim_id === row.accepted_identification_id && claim.claim_status === "accepted") ?? null
      : null;
    const aiSuggestions = snapshot.aiSuggestions
      .filter((item) => item.observation_id === row.observation_id && item.suggestion_status === "active")
      .map((item) => ({
        suggestionId: item.suggestion_id,
        proposedName: item.proposed_name,
        proposedScientificName: item.proposed_scientific_name,
        proposedRank: item.proposed_rank,
        provisional: true as const,
      }));
    return {
      observationId: row.observation_id,
      state: row.lifecycle_status === "excluded" ? "excluded" : "active",
      subjectType: row.subject_type,
      subjectLabel: subjectLabel(row),
      assertionStatus: row.assertion_status,
      verificationStatus: row.verification_status,
      acceptedIdentification: accepted ? {
        claimId: accepted.claim_id,
        actorType: accepted.actor_type,
        actorId: accepted.actor_id,
        proposedName: accepted.proposed_name,
        proposedScientificName: accepted.proposed_scientific_name,
        proposedRank: accepted.proposed_rank,
        humanDecision: true,
      } : null,
      communityIdentifications: claims.map((claim) => ({
        claimId: claim.claim_id,
        actorType: claim.actor_type,
        proposedName: claim.proposed_name,
        proposedScientificName: claim.proposed_scientific_name,
        proposedRank: claim.proposed_rank,
        stance: claim.stance,
        accepted: accepted?.claim_id === claim.claim_id,
      })),
      aiSuggestions,
      media: snapshot.media
        .filter((item) => item.observation_id === row.observation_id && item.active === 1)
        .sort((left, right) => left.display_order - right.display_order || left.media_id.localeCompare(right.media_id))
        .map((item) => ({ mediaId: item.media_id, mediaKind: item.media_kind, displayOrder: item.display_order })),
      provenance: {
        owner: row.origin === "owner",
        ai: row.origin === "ai" || aiSuggestions.length > 0,
        community: row.origin === "community" || claims.some((claim) => claim.actor_type === "community"),
        curator: row.origin === "curator" || claims.some((claim) => claim.actor_type === "curator"),
        imported: row.origin === "import",
      },
    };
  });
  return {
    schema: "ikimon.observation-first-record-detail/v1",
    recordId: snapshot.recordId,
    owner,
    visibility: snapshot.visibility,
    observationCount: observations.length,
    proposalPolicy: {
      identification: !privateRecord && !policyDisabled,
      media: !privateRecord && Boolean(snapshot.policy?.accepts_media_proposals === 1),
      disabledReason: privateRecord ? "record_private" : policyDisabled ? "record_policy" : null,
    },
    observations,
    privacy: {
      exactLocationExposed: false,
      publicLocationLabel: "位置情報は公開範囲に合わせて保護されています",
    },
  };
}

const FORBIDDEN_PUBLIC_LOCATION_KEY = /(?:^|_)(?:lat|lng|longitude|latitude|cell|mesh|geohash|coordinate|h3)(?:_|$)/iu;

export function publicRecordDetailPrivacyFindings(value: unknown, path = "$", findings: string[] = []): string[] {
  if (!value || typeof value !== "object") return findings;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}.${key}`;
    const normalizedKey = key.replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`);
    if (FORBIDDEN_PUBLIC_LOCATION_KEY.test(normalizedKey)) findings.push(childPath);
    publicRecordDetailPrivacyFindings(child, childPath, findings);
  }
  return findings;
}

export type LegacyRecordShadowSummary = {
  recordId: string;
  ownerUserId: string;
  visibility: "public" | "limited" | "private";
  mediaCount: number;
  expectedObservationMinimum: number;
};

export type RecordShadowDifference = { severity: "P0" | "P1" | "P2"; code: string; recordId: string };

export function compareLegacyAndObservationFirstRecord(
  legacy: LegacyRecordShadowSummary,
  snapshot: RecordObservationReadSnapshot,
): RecordShadowDifference[] {
  const differences: RecordShadowDifference[] = [];
  const ownerDetail = buildObservationFirstRecordDetail(snapshot, legacy.ownerUserId);
  if (!ownerDetail) return [{ severity: "P0", code: "new_read_missing", recordId: legacy.recordId }];
  if (snapshot.ownerUserId !== legacy.ownerUserId) differences.push({ severity: "P0", code: "owner_mismatch", recordId: legacy.recordId });
  if (snapshot.visibility !== legacy.visibility) differences.push({ severity: "P0", code: "visibility_mismatch", recordId: legacy.recordId });
  if (publicRecordDetailPrivacyFindings(ownerDetail).length > 0) differences.push({ severity: "P0", code: "exact_location_key_exposed", recordId: legacy.recordId });
  const mediaCount = ownerDetail.observations.reduce((count, observation) => count + observation.media.length, 0);
  if (mediaCount !== legacy.mediaCount) differences.push({ severity: "P1", code: "media_association_count_mismatch", recordId: legacy.recordId });
  if (ownerDetail.observationCount < legacy.expectedObservationMinimum) differences.push({ severity: "P1", code: "observation_count_below_legacy_minimum", recordId: legacy.recordId });
  for (const observation of ownerDetail.observations) {
    if (observation.acceptedIdentification && observation.acceptedIdentification.humanDecision !== true) {
      differences.push({ severity: "P0", code: "accepted_identification_without_human_decision", recordId: legacy.recordId });
    }
  }
  return differences;
}

export function summarizeRecordShadowComparison(differences: RecordShadowDifference[], compared: number) {
  const counts = { P0: 0, P1: 0, P2: 0 };
  for (const difference of differences) counts[difference.severity] += 1;
  return {
    schema: "ikimon.record-observation-shadow-comparison/v1" as const,
    compared,
    differences: counts,
    unexplainedP0P1: counts.P0 + counts.P1,
    pass: compared >= 100 && counts.P0 === 0 && counts.P1 === 0,
    privacyFindings: differences.filter((item) => item.code === "exact_location_key_exposed").length,
  };
}
