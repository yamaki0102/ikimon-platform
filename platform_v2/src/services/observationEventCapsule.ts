import { createHash } from "node:crypto";
import { getPool } from "../db.js";
import { assertAllowed as assertAiBudgetAllowed } from "./aiBudgetGate.js";
import { generateAiTextWithRoleChain } from "./aiModelRouter.js";
import { getSessionById, type ObservationEventSessionRow } from "./observationEventModeManager.js";

export type CapsuleReviewStatus = "draft" | "needs_review" | "approved_private" | "approved_public" | "published";

export type CapsuleSourceCounts = {
  observations: number;
  guideScenes: number;
  fieldScans: number;
  absences: number;
  participants: number;
  minors: number;
  risks: number;
};

export type CapsuleSourceRef = {
  sourceRef: string;
  sourceType: "observation" | "guide_scene" | "field_scan" | "absence" | "participant";
  label: string;
  createdAt: string | null;
};

export type CapsuleSourceClusters = {
  topTaxa: Array<{ label: string; count: number; sourceRefs: string[] }>;
  guideThemes: Array<{ label: string; count: number; sourceRefs: string[] }>;
  scanModes: Array<{ label: string; count: number; sourceRefs: string[] }>;
  sourceRefs: CapsuleSourceRef[];
};

export type CapsulePrivateDigest = {
  title: string;
  summary: string;
  organizerNotes: string[];
  nextActions: string[];
  sourceRefs: string[];
};

export type CapsulePublicStoryDraft = {
  title: string;
  lead: string;
  sections: Array<{
    heading: string;
    body: string;
    sourceRefs: string[];
  }>;
  claimLimit: "draft_requires_review" | "privacy_review_required" | "reviewed_public_story";
};

export type CapsuleRecordCandidate = {
  candidateId: string;
  sourceType: "observation" | "guide_scene" | "field_scan";
  taxonLabel: string;
  identificationStatus: "suggested";
  confidence: number | null;
  sourceRefs: string[];
  notes: string[];
};

export type CapsulePrivacyRisk = {
  riskId: string;
  riskType: "minor_present" | "face_present" | "human_voice" | "sensitive_species" | "exact_location" | "unreviewed_public_claim";
  blockingLevel: "public_display" | "report_export";
  reason: string;
  sourceRefs: string[];
};

export type CapsuleReadiness = {
  privateReady: boolean;
  publicReady: boolean;
  reportReady: boolean;
  exportReady: boolean;
  blockers: string[];
  warnings: string[];
};

export type CapsuleModelMetadata = {
  provider: "gemini" | "vertex" | "fallback";
  model: string;
  promptVersion: "place_event_capsule/v1";
  aiAttempted: boolean;
  fallbackReason: string | null;
  paidOrVertexRequired: boolean;
};

export type PlaceEventCapsule = {
  sessionId: string;
  sourceCounts: CapsuleSourceCounts;
  sourceClusters: CapsuleSourceClusters;
  privateDigest: CapsulePrivateDigest;
  publicStoryDraft: CapsulePublicStoryDraft;
  recordCandidates: CapsuleRecordCandidate[];
  privacyRiskQueue: CapsulePrivacyRisk[];
  readiness: CapsuleReadiness;
  sourceHash: string;
  modelMetadata: CapsuleModelMetadata;
  reviewStatus: CapsuleReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  generatedAt: string;
  updatedAt: string;
};

export type PublicPlaceEventCapsule = Pick<PlaceEventCapsule, "sessionId" | "publicStoryDraft" | "sourceCounts" | "sourceClusters" | "reviewStatus" | "publishedAt" | "generatedAt">;

type LiveEventForCapsule = {
  liveEventId: string;
  type: string;
  teamId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

type ParticipantForCapsule = {
  participantId: string;
  displayName: string;
  isMinor: boolean;
};

type CapsuleRow = {
  session_id: string;
  source_counts: CapsuleSourceCounts;
  source_clusters: CapsuleSourceClusters;
  private_digest: CapsulePrivateDigest;
  public_story_draft: CapsulePublicStoryDraft;
  record_candidates: CapsuleRecordCandidate[];
  privacy_risk_queue: CapsulePrivacyRisk[];
  readiness: CapsuleReadiness;
  source_hash: string;
  model_metadata: CapsuleModelMetadata;
  review_status: CapsuleReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  generated_at: string;
  updated_at: string;
};

export type BuildCapsuleInput = {
  session: Pick<ObservationEventSessionRow, "sessionId" | "title" | "eventCode" | "plan" | "locationLat" | "locationLng" | "locationRadiusM" | "targetSpecies" | "config" | "startedAt" | "endedAt">;
  liveEvents: LiveEventForCapsule[];
  participants: ParticipantForCapsule[];
  modelMetadata?: Partial<CapsuleModelMetadata>;
};

type CapsuleAiDraft = {
  privateDigest?: Partial<CapsulePrivateDigest>;
  publicStoryDraft?: Partial<CapsulePublicStoryDraft>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function sourceRef(event: LiveEventForCapsule): string {
  return `live:${event.liveEventId}`;
}

function taxonLabel(payload: Record<string, unknown>): string | null {
  return asString(payload.taxon_name)
    ?? asString(payload.taxon)
    ?? asString(payload.detected_taxon)
    ?? asString(payload.primary_subject)
    ?? asString(asRecord(payload.primary_subject).name)
    ?? asString(asRecord(payload.primarySubject).name);
}

function summaryLabel(event: LiveEventForCapsule): string {
  const payload = event.payload ?? {};
  if (event.type === "observation_added" || event.type === "field_scan_added") {
    return taxonLabel(payload) ?? "未同定の記録";
  }
  if (event.type === "guide_scene_added") {
    return asString(payload.scene_summary) ?? asString(payload.summary) ?? "ガイドで見た場面";
  }
  if (event.type === "absence_recorded") {
    return asString(payload.searched_taxon) ?? "不在確認";
  }
  return event.type;
}

function classifySourceType(event: LiveEventForCapsule): CapsuleSourceRef["sourceType"] | null {
  if (event.type === "observation_added") return "observation";
  if (event.type === "guide_scene_added") return "guide_scene";
  if (event.type === "field_scan_added") return "field_scan";
  if (event.type === "absence_recorded") return "absence";
  return null;
}

function incrementCluster(map: Map<string, { count: number; sourceRefs: Set<string> }>, label: string | null, ref: string): void {
  if (!label) return;
  const key = label.trim();
  if (!key) return;
  const current = map.get(key) ?? { count: 0, sourceRefs: new Set<string>() };
  current.count += 1;
  current.sourceRefs.add(ref);
  map.set(key, current);
}

function topClusters(map: Map<string, { count: number; sourceRefs: Set<string> }>, limit = 8): Array<{ label: string; count: number; sourceRefs: string[] }> {
  return Array.from(map.entries())
    .sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([label, value]) => ({ label, count: value.count, sourceRefs: Array.from(value.sourceRefs).slice(0, 8) }));
}

function includesTruthyFlag(payload: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => {
    const value = payload[key];
    return value === true || value === "true" || value === 1 || value === "1";
  });
}

function detectRisks(input: BuildCapsuleInput, sourceRefs: CapsuleSourceRef[]): CapsulePrivacyRisk[] {
  const risks: CapsulePrivacyRisk[] = [];
  const sourceRefSet = new Set(sourceRefs.map((ref) => ref.sourceRef));

  const minorRefs = input.participants.filter((p) => p.isMinor).map((p) => `participant:${p.participantId}`);
  if (minorRefs.length > 0) {
    risks.push({
      riskId: "risk:minor_present",
      riskType: "minor_present",
      blockingLevel: "public_display",
      reason: "未成年の参加者が含まれるため、人物・位置・発言の公開前確認が必要です。",
      sourceRefs: minorRefs,
    });
  }

  for (const event of input.liveEvents) {
    const payload = event.payload ?? {};
    const ref = sourceRef(event);
    const facePrivacy = asRecord(payload.facePrivacy ?? payload.face_privacy);
    const faceCount = asNumber(facePrivacy.faceCount ?? facePrivacy.face_count);
    if ((faceCount ?? 0) > 0 || includesTruthyFlag(payload, ["person_present", "face_present", "has_face"])) {
      risks.push({
        riskId: `risk:face:${event.liveEventId}`,
        riskType: "face_present",
        blockingLevel: "public_display",
        reason: "人物または顔が含まれる可能性があります。",
        sourceRefs: [ref],
      });
    }
    if (includesTruthyFlag(payload, ["human_voice", "voice_flag", "speech_likely"]) || asString(payload.audio_privacy_status) === "deleted_human_voice") {
      risks.push({
        riskId: `risk:voice:${event.liveEventId}`,
        riskType: "human_voice",
        blockingLevel: "public_display",
        reason: "人声が含まれる可能性があります。",
        sourceRefs: [ref],
      });
    }
    if (event.type === "rare_species" || includesTruthyFlag(payload, ["sensitive_species", "rare_species", "location_sensitive"])) {
      risks.push({
        riskId: `risk:sensitive:${event.liveEventId}`,
        riskType: "sensitive_species",
        blockingLevel: "report_export",
        reason: "希少種または採集圧のある情報の可能性があります。",
        sourceRefs: [ref],
      });
    }
    if (sourceRefSet.has(ref) && (asNumber(payload.lat) !== null || asNumber(payload.lng) !== null) && includesTruthyFlag(payload, ["exact_location_public", "public_exact_location"])) {
      risks.push({
        riskId: `risk:location:${event.liveEventId}`,
        riskType: "exact_location",
        blockingLevel: "public_display",
        reason: "正確な位置情報を公開に使う前に粒度確認が必要です。",
        sourceRefs: [ref],
      });
    }
  }

  return risks;
}

function buildSourceClusters(input: BuildCapsuleInput): CapsuleSourceClusters {
  const taxa = new Map<string, { count: number; sourceRefs: Set<string> }>();
  const guideThemes = new Map<string, { count: number; sourceRefs: Set<string> }>();
  const scanModes = new Map<string, { count: number; sourceRefs: Set<string> }>();
  const refs: CapsuleSourceRef[] = [];

  for (const event of input.liveEvents) {
    const sourceType = classifySourceType(event);
    if (!sourceType) continue;
    const ref = sourceRef(event);
    refs.push({
      sourceRef: ref,
      sourceType,
      label: summaryLabel(event),
      createdAt: event.createdAt,
    });

    if (event.type === "observation_added" || event.type === "field_scan_added") {
      incrementCluster(taxa, taxonLabel(event.payload), ref);
    }
    if (event.type === "guide_scene_added") {
      const payload = event.payload ?? {};
      incrementCluster(guideThemes, asString(payload.environment_context) ?? asString(payload.scene_summary) ?? asString(payload.summary), ref);
      const species = Array.isArray(payload.detected_species) ? payload.detected_species : Array.isArray(payload.detectedSpecies) ? payload.detectedSpecies : [];
      for (const name of species.slice(0, 4)) {
        incrementCluster(taxa, asString(name), ref);
      }
    }
    if (event.type === "field_scan_added") {
      incrementCluster(scanModes, asString(event.payload.scan_mode) ?? asString(event.payload.fieldScanMode) ?? "site_snapshot", ref);
    }
  }

  return {
    topTaxa: topClusters(taxa),
    guideThemes: topClusters(guideThemes, 6),
    scanModes: topClusters(scanModes, 6),
    sourceRefs: refs.slice(0, 200),
  };
}

function buildSourceCounts(input: BuildCapsuleInput, riskCount: number): CapsuleSourceCounts {
  return {
    observations: input.liveEvents.filter((event) => event.type === "observation_added").length,
    guideScenes: input.liveEvents.filter((event) => event.type === "guide_scene_added").length,
    fieldScans: input.liveEvents.filter((event) => event.type === "field_scan_added").length,
    absences: input.liveEvents.filter((event) => event.type === "absence_recorded").length,
    participants: input.participants.length,
    minors: input.participants.filter((participant) => participant.isMinor).length,
    risks: riskCount,
  };
}

function buildRecordCandidates(input: BuildCapsuleInput): CapsuleRecordCandidate[] {
  const candidates: CapsuleRecordCandidate[] = [];
  const seen = new Set<string>();
  for (const event of input.liveEvents) {
    if (!["observation_added", "guide_scene_added", "field_scan_added"].includes(event.type)) continue;
    const label = taxonLabel(event.payload)
      ?? (event.type === "guide_scene_added" ? asString(event.payload.primary_subject) ?? asString(asRecord(event.payload.primary_subject).name) ?? asString(asRecord(event.payload.primarySubject).name) : null);
    if (!label) continue;
    const sourceType = event.type === "guide_scene_added" ? "guide_scene" : event.type === "field_scan_added" ? "field_scan" : "observation";
    const key = `${sourceType}:${label.toLowerCase()}:${event.liveEventId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      candidateId: `candidate:${event.liveEventId}`,
      sourceType,
      taxonLabel: label,
      identificationStatus: "suggested",
      confidence: asNumber(event.payload.confidence) ?? asNumber(asRecord(event.payload.primarySubject).confidence),
      sourceRefs: [sourceRef(event)],
      notes: [
        "AIまたは参加者の候補です。専門家確認前は確定種名として扱いません。",
      ],
    });
  }
  return candidates.slice(0, 80);
}

function buildReadiness(counts: CapsuleSourceCounts, risks: CapsulePrivacyRisk[], sessionPlan: "community" | "public"): CapsuleReadiness {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (counts.observations + counts.guideScenes + counts.fieldScans === 0) blockers.push("no_event_sources");
  if (risks.length > 0) blockers.push("privacy_risk_unresolved");
  if (counts.guideScenes === 0) warnings.push("guide_scene_missing");
  if (counts.fieldScans === 0) warnings.push("field_scan_missing");
  if (sessionPlan !== "public") warnings.push("public_plan_required_for_formal_outputs");
  return {
    privateReady: counts.observations + counts.guideScenes + counts.fieldScans + counts.absences > 0,
    publicReady: blockers.length === 0,
    reportReady: sessionPlan === "public" && blockers.length === 0,
    exportReady: sessionPlan === "public" && blockers.length === 0,
    blockers,
    warnings,
  };
}

function placeLabel(session: BuildCapsuleInput["session"]): string {
  const placeEvent = asRecord(asRecord(session.config).place_event);
  return asString(placeEvent.place_label) ?? asString(placeEvent.meeting_point) ?? (session.title || "この場所");
}

function buildFallbackDigest(input: BuildCapsuleInput, clusters: CapsuleSourceClusters, counts: CapsuleSourceCounts): CapsulePrivateDigest {
  const label = placeLabel(input.session);
  const topTaxa = clusters.topTaxa.slice(0, 5).map((taxon) => taxon.label);
  const notes = [
    `${counts.participants}名が参加し、通常記録${counts.observations}件、ガイド場面${counts.guideScenes}件、フィールドスキャン${counts.fieldScans}件が集まりました。`,
    topTaxa.length > 0 ? `候補として目立つ生き物: ${topTaxa.join("、")}` : "種名候補はまだ少ないため、写真・音・場所状態の確認が必要です。",
  ];
  return {
    title: `${label}の地点観察パッケージ`,
    summary: `${label}で集まった多視点の観察を、記録・ガイド・スキャンに分けて整理しました。`,
    organizerNotes: notes,
    nextActions: [
      counts.guideScenes === 0 ? "次回はガイド導線を1人以上に使ってもらい、気づきと未検出も残す。" : "ガイド場面から、次回見るべき環境手がかりを選ぶ。",
      counts.fieldScans === 0 ? "次回は定点または周辺一周のフィールドスキャンを追加する。" : "同じ地点・同じ画角で再スキャンして季節差を比較する。",
      "公開前に人物、声、未成年、希少種位置を確認する。",
    ],
    sourceRefs: clusters.sourceRefs.slice(0, 20).map((ref) => ref.sourceRef),
  };
}

function buildFallbackPublicStory(input: BuildCapsuleInput, clusters: CapsuleSourceClusters, counts: CapsuleSourceCounts, risks: CapsulePrivacyRisk[]): CapsulePublicStoryDraft {
  const label = placeLabel(input.session);
  const observationRefs = clusters.sourceRefs.filter((ref) => ref.sourceType === "observation").slice(0, 8).map((ref) => ref.sourceRef);
  const guideRefs = clusters.sourceRefs.filter((ref) => ref.sourceType === "guide_scene").slice(0, 8).map((ref) => ref.sourceRef);
  const scanRefs = clusters.sourceRefs.filter((ref) => ref.sourceType === "field_scan").slice(0, 8).map((ref) => ref.sourceRef);
  const topTaxa = clusters.topTaxa.slice(0, 6).map((taxon) => taxon.label);
  return {
    title: `${label}の一日`,
    lead: `${label}で、参加者の記録・ガイド・フィールドスキャンから、その日の自然の手がかりを整理しました。`,
    sections: [
      {
        heading: "見つかったもの",
        body: topTaxa.length > 0
          ? `この日は ${topTaxa.join("、")} などの候補が集まりました。これらは公開前レビュー前の候補であり、確定同定ではありません。`
          : "この日は種名候補よりも、場所や環境の手がかりを残す記録が中心でした。",
        sourceRefs: observationRefs.length ? observationRefs : clusters.sourceRefs.slice(0, 4).map((ref) => ref.sourceRef),
      },
      {
        heading: "場所の状態",
        body: counts.fieldScans > 0
          ? "フィールドスキャンにより、同じ場所を次回見返すための状態記録が残りました。"
          : "次回は定点写真や周辺スキャンを足すと、季節変化を比べやすくなります。",
        sourceRefs: scanRefs,
      },
      {
        heading: "次に見るポイント",
        body: counts.guideScenes > 0
          ? "ガイドで得た気づきを次回の観察ポイントに戻すことで、単発イベントを継続観察に変えられます。"
          : "次回はガイド導線で、見つかったものだけでなく探した過程も残すと記録価値が上がります。",
        sourceRefs: guideRefs,
      },
    ],
    claimLimit: risks.length > 0 ? "privacy_review_required" : "draft_requires_review",
  };
}

function capsuleSourceHash(input: BuildCapsuleInput): string {
  const eventShape = input.liveEvents.map((event) => ({
    id: event.liveEventId,
    type: event.type,
    createdAt: event.createdAt,
    payload: event.payload,
  }));
  return createHash("sha256")
    .update(JSON.stringify({
      sessionId: input.session.sessionId,
      updatedAt: input.session.endedAt ?? input.session.startedAt,
      events: eventShape,
      participants: input.participants.map((p) => ({ id: p.participantId, minor: p.isMinor })),
    }))
    .digest("hex");
}

function mergeAiDraft(base: PlaceEventCapsule, aiDraft: CapsuleAiDraft | null): PlaceEventCapsule {
  if (!aiDraft) return base;
  const publicSections = Array.isArray(aiDraft.publicStoryDraft?.sections)
    ? aiDraft.publicStoryDraft.sections
        .map((section) => ({
          heading: asString((section as Record<string, unknown>).heading) ?? "",
          body: asString((section as Record<string, unknown>).body) ?? "",
          sourceRefs: Array.isArray((section as Record<string, unknown>).sourceRefs)
            ? ((section as Record<string, unknown>).sourceRefs as unknown[]).filter((ref): ref is string => typeof ref === "string")
            : [],
        }))
        .filter((section) => section.heading && section.body && section.sourceRefs.length > 0)
    : [];
  return {
    ...base,
    privateDigest: {
      ...base.privateDigest,
      ...aiDraft.privateDigest,
      sourceRefs: Array.isArray(aiDraft.privateDigest?.sourceRefs) && aiDraft.privateDigest.sourceRefs.length
        ? aiDraft.privateDigest.sourceRefs.filter((ref): ref is string => typeof ref === "string")
        : base.privateDigest.sourceRefs,
    },
    publicStoryDraft: {
      ...base.publicStoryDraft,
      ...aiDraft.publicStoryDraft,
      sections: publicSections.length ? publicSections : base.publicStoryDraft.sections,
      claimLimit: base.publicStoryDraft.claimLimit,
    },
  };
}

export function buildPlaceEventCapsuleDraft(input: BuildCapsuleInput): PlaceEventCapsule {
  const clusters = buildSourceClusters(input);
  const risks = detectRisks(input, clusters.sourceRefs);
  const counts = buildSourceCounts(input, risks.length);
  const readiness = buildReadiness(counts, risks, input.session.plan);
  const modelMetadata: CapsuleModelMetadata = {
    provider: "fallback",
    model: "deterministic-place-event-capsule-v1",
    promptVersion: "place_event_capsule/v1",
    aiAttempted: false,
    fallbackReason: null,
    paidOrVertexRequired: true,
    ...input.modelMetadata,
  };
  const now = new Date().toISOString();
  return {
    sessionId: input.session.sessionId,
    sourceCounts: counts,
    sourceClusters: clusters,
    privateDigest: buildFallbackDigest(input, clusters, counts),
    publicStoryDraft: buildFallbackPublicStory(input, clusters, counts, risks),
    recordCandidates: buildRecordCandidates(input),
    privacyRiskQueue: risks,
    readiness,
    sourceHash: capsuleSourceHash(input),
    modelMetadata,
    reviewStatus: risks.length > 0 ? "needs_review" : "draft",
    reviewedBy: null,
    reviewedAt: null,
    publishedAt: null,
    generatedAt: now,
    updatedAt: now,
  };
}

function renderAiPrompt(capsule: PlaceEventCapsule, input: BuildCapsuleInput): string {
  return JSON.stringify({
    instruction: "観察会後の地点観察パッケージを、根拠sourceRefs付きで改善してください。AI同定は確定扱いにせず、公開文は人物・声・子ども・希少種位置に踏み込まないでください。",
    output_schema: {
      privateDigest: { title: "string", summary: "string", organizerNotes: ["string"], nextActions: ["string"], sourceRefs: ["string"] },
      publicStoryDraft: { title: "string", lead: "string", sections: [{ heading: "string", body: "string", sourceRefs: ["string"] }] },
    },
    session: {
      title: input.session.title,
      placeLabel: placeLabel(input.session),
      plan: input.session.plan,
      startedAt: input.session.startedAt,
      endedAt: input.session.endedAt,
    },
    sourceCounts: capsule.sourceCounts,
    sourceClusters: capsule.sourceClusters,
    privacyRiskQueue: capsule.privacyRiskQueue,
  });
}

function parseAiDraft(text: string): CapsuleAiDraft | null {
  try {
    const parsed = JSON.parse(text) as CapsuleAiDraft;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function tryEnhanceWithAi(base: PlaceEventCapsule, input: BuildCapsuleInput, userId: string | null): Promise<PlaceEventCapsule> {
  try {
    await assertAiBudgetAllowed("hot");
    const result = await generateAiTextWithRoleChain({
      chainName: "observationEventCapsule",
      text: renderAiPrompt(base, input),
      responseMimeType: "application/json",
      temperature: 0.25,
      maxOutputTokens: 1600,
      retriesPerModel: 1,
      cost: {
        layer: "hot",
        endpoint: "observation_event_capsule",
        userId,
        metadata: {
          sessionId: input.session.sessionId,
          sourceHash: base.sourceHash,
          promptVersion: "place_event_capsule/v1",
        },
      },
    });
    const merged = mergeAiDraft(base, parseAiDraft(result.text));
    return {
      ...merged,
      modelMetadata: {
        provider: result.provider === "vertex" ? "vertex" : "gemini",
        model: result.model,
        promptVersion: "place_event_capsule/v1",
        aiAttempted: true,
        fallbackReason: null,
        paidOrVertexRequired: true,
      },
    };
  } catch (error) {
    return {
      ...base,
      modelMetadata: {
        ...base.modelMetadata,
        aiAttempted: true,
        fallbackReason: error instanceof Error ? error.message.slice(0, 180) : "ai_generation_failed",
      },
    };
  }
}

function rowToCapsule(row: CapsuleRow): PlaceEventCapsule {
  return {
    sessionId: row.session_id,
    sourceCounts: row.source_counts,
    sourceClusters: row.source_clusters,
    privateDigest: row.private_digest,
    publicStoryDraft: row.public_story_draft,
    recordCandidates: row.record_candidates,
    privacyRiskQueue: row.privacy_risk_queue,
    readiness: row.readiness,
    sourceHash: row.source_hash,
    modelMetadata: row.model_metadata,
    reviewStatus: row.review_status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    publishedAt: row.published_at,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
  };
}

export async function generatePlaceEventCapsule(input: {
  sessionId: string;
  actorUserId: string;
  useAi?: boolean;
}): Promise<PlaceEventCapsule> {
  const session = await getSessionById(input.sessionId);
  if (!session) throw new Error("session_not_found");
  if (session.organizerUserId !== input.actorUserId) throw new Error("organizer_only");
  const pool = getPool();
  const [eventsResult, participantsResult] = await Promise.all([
    pool.query<{
      live_event_id: string;
      type: string;
      team_id: string | null;
      payload: Record<string, unknown>;
      created_at: string;
    }>(
      `select live_event_id, type, team_id, payload, created_at::text as created_at
         from observation_event_live_events
        where session_id = $1
        order by created_at asc
        limit 1000`,
      [session.sessionId],
    ),
    pool.query<{
      participant_id: string;
      display_name: string;
      is_minor: boolean;
    }>(
      `select participant_id, display_name, is_minor
         from observation_event_participants
        where session_id = $1
        order by created_at asc`,
      [session.sessionId],
    ),
  ]);
  const buildInput: BuildCapsuleInput = {
    session,
    liveEvents: eventsResult.rows.map((row) => ({
      liveEventId: row.live_event_id,
      type: row.type,
      teamId: row.team_id,
      payload: row.payload ?? {},
      createdAt: row.created_at,
    })),
    participants: participantsResult.rows.map((row) => ({
      participantId: row.participant_id,
      displayName: row.display_name,
      isMinor: row.is_minor,
    })),
  };
  const placeEventConfig = asRecord(asRecord(session.config).place_event);
  const shouldUseAi = input.useAi ?? placeEventConfig.ai_recap_enabled !== false;
  const draft = buildPlaceEventCapsuleDraft(buildInput);
  const capsule = shouldUseAi ? await tryEnhanceWithAi(draft, buildInput, input.actorUserId) : draft;

  const saved = await pool.query<CapsuleRow>(
    `insert into observation_event_capsules (
       session_id, source_counts, source_clusters, private_digest, public_story_draft,
       record_candidates, privacy_risk_queue, readiness, source_hash, model_metadata,
       review_status, reviewed_by, reviewed_at, published_at, generated_at, updated_at
     ) values (
       $1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb,
       $6::jsonb, $7::jsonb, $8::jsonb, $9, $10::jsonb,
       $11, null, null, null, now(), now()
     )
     on conflict (session_id) do update set
       source_counts = excluded.source_counts,
       source_clusters = excluded.source_clusters,
       private_digest = excluded.private_digest,
       public_story_draft = excluded.public_story_draft,
       record_candidates = excluded.record_candidates,
       privacy_risk_queue = excluded.privacy_risk_queue,
       readiness = excluded.readiness,
       source_hash = excluded.source_hash,
       model_metadata = excluded.model_metadata,
       review_status = excluded.review_status,
       reviewed_by = null,
       reviewed_at = null,
       published_at = null,
       generated_at = now(),
       updated_at = now()
     returning session_id, source_counts, source_clusters, private_digest, public_story_draft,
       record_candidates, privacy_risk_queue, readiness, source_hash, model_metadata,
       review_status, reviewed_by, reviewed_at::text as reviewed_at,
       published_at::text as published_at, generated_at::text as generated_at, updated_at::text as updated_at`,
    [
      capsule.sessionId,
      JSON.stringify(capsule.sourceCounts),
      JSON.stringify(capsule.sourceClusters),
      JSON.stringify(capsule.privateDigest),
      JSON.stringify(capsule.publicStoryDraft),
      JSON.stringify(capsule.recordCandidates),
      JSON.stringify(capsule.privacyRiskQueue),
      JSON.stringify(capsule.readiness),
      capsule.sourceHash,
      JSON.stringify(capsule.modelMetadata),
      capsule.reviewStatus,
    ],
  );
  const row = saved.rows[0];
  if (!row) throw new Error("capsule_save_failed");
  return rowToCapsule(row);
}

export async function getPlaceEventCapsule(sessionId: string): Promise<PlaceEventCapsule | null> {
  const result = await getPool().query<CapsuleRow>(
    `select session_id, source_counts, source_clusters, private_digest, public_story_draft,
       record_candidates, privacy_risk_queue, readiness, source_hash, model_metadata,
       review_status, reviewed_by, reviewed_at::text as reviewed_at,
       published_at::text as published_at, generated_at::text as generated_at, updated_at::text as updated_at
     from observation_event_capsules
     where session_id = $1`,
    [sessionId],
  );
  const row = result.rows[0];
  return row ? rowToCapsule(row) : null;
}

export function publicCapsuleView(capsule: PlaceEventCapsule): PublicPlaceEventCapsule | null {
  if (capsule.reviewStatus !== "approved_public" && capsule.reviewStatus !== "published") return null;
  return {
    sessionId: capsule.sessionId,
    publicStoryDraft: {
      ...capsule.publicStoryDraft,
      claimLimit: "reviewed_public_story",
    },
    sourceCounts: capsule.sourceCounts,
    sourceClusters: capsule.sourceClusters,
    reviewStatus: capsule.reviewStatus,
    publishedAt: capsule.publishedAt,
    generatedAt: capsule.generatedAt,
  };
}

export async function updatePlaceEventCapsuleReviewStatus(input: {
  sessionId: string;
  actorUserId: string;
  reviewStatus: CapsuleReviewStatus;
}): Promise<PlaceEventCapsule> {
  const session = await getSessionById(input.sessionId);
  if (!session) throw new Error("session_not_found");
  if (session.organizerUserId !== input.actorUserId) throw new Error("organizer_only");
  const capsule = await getPlaceEventCapsule(input.sessionId);
  if (!capsule) throw new Error("capsule_not_found");
  if ((input.reviewStatus === "approved_public" || input.reviewStatus === "published") && capsule.privacyRiskQueue.length > 0) {
    throw new Error("privacy_risk_queue_not_resolved");
  }
  const result = await getPool().query<CapsuleRow>(
    `update observation_event_capsules
        set review_status = $2,
            reviewed_by = $3,
            reviewed_at = now(),
            published_at = case when $2 = 'published' then now() else published_at end,
            updated_at = now()
      where session_id = $1
      returning session_id, source_counts, source_clusters, private_digest, public_story_draft,
       record_candidates, privacy_risk_queue, readiness, source_hash, model_metadata,
       review_status, reviewed_by, reviewed_at::text as reviewed_at,
       published_at::text as published_at, generated_at::text as generated_at, updated_at::text as updated_at`,
    [input.sessionId, input.reviewStatus, input.actorUserId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("capsule_review_failed");
  return rowToCapsule(row);
}
