import type { PoolClient } from "pg";
import { getPool } from "../db.js";
import { getLatestAiAssessment, type AiAssessment } from "./observationAiAssessment.js";
import { ensureLegacyAiRunsForVisit, listObservationAiRunsForVisit, type ObservationAiRun } from "./observationAiRuns.js";
import { rankVisitSubjects, type RankedSubject } from "./subjectRanking.js";
import { deriveVisitDisplayState, getStoredVisitDisplayState, type VisitDisplayStateRecord } from "./visitDisplayState.js";
import { getVisitSubjectSummaries, type VisitSubjectSummary } from "./visitSubjects.js";

export type ObservationVisitAssessment = AiAssessment & {
  aiRunId: string | null;
  pipelineVersion: string | null;
  taxonomyVersion: string | null;
  interpretationStatus: string | null;
};

export type SubjectMediaRegionView = {
  regionId: string;
  occurrenceId: string | null;
  candidateId: string | null;
  assetId: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  frameTimeMs: number | null;
  confidenceScore: number | null;
  sourceKind: string;
  sourceModel: string;
  note: string | null;
};

export type ObservationVisitCandidate = {
  candidateId: string;
  suggestedOccurrenceId: string | null;
  displayName: string;
  scientificName: string | null;
  rank: string | null;
  confidence: number | null;
  candidateStatus: string;
  note: string | null;
  regions: SubjectMediaRegionView[];
};

export type ObservationVisitSubject = RankedSubject<VisitSubjectSummary> & {
  identifications: Array<{
    proposedName: string;
    proposedRank: string | null;
    acceptedRank: string | null;
    notes: string | null;
    actorName: string;
    createdAt: string;
  }>;
  lineage: Array<{
    rank: string;
    name: string;
  }>;
  aiAssessment: ObservationVisitAssessment | null;
  previousAiAssessment: ObservationVisitAssessment | null;
  regions: SubjectMediaRegionView[];
};

export type ObservationVisitBundle = {
  visitId: string;
  canonicalSubjectId: string;
  featuredOccurrenceId: string;
  selectedReason: string;
  selectionSource: VisitDisplayStateRecord["selectionSource"];
  lockedByHuman: boolean;
  displayStability: VisitDisplayStateRecord["displayStability"];
  selectedRun: ObservationAiRun | null;
  previousRun: ObservationAiRun | null;
  subjects: ObservationVisitSubject[];
  aiCandidates: ObservationVisitCandidate[];
};

type ResolvedVisit = {
  visitId: string;
  matchedOccurrenceId: string | null;
};

function normalizeRect(raw: unknown): SubjectMediaRegionView["rect"] {
  if (!raw || typeof raw !== "object") return null;
  const rect = raw as Record<string, unknown>;
  const x = Number(rect.x);
  const y = Number(rect.y);
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (![x, y, width, height].every((value) => Number.isFinite(value))) {
    return null;
  }
  return { x, y, width, height };
}

async function resolveVisit(client: PoolClient, id: string): Promise<ResolvedVisit | null> {
  const result = await client.query<{
    visit_id: string;
    matched_occurrence_id: string | null;
  }>(
    `WITH matched_visit AS (
        SELECT visit_id
          FROM visits
         WHERE visit_id = $1
            OR legacy_observation_id = $1
        UNION
        SELECT visit_id
          FROM occurrences
         WHERE occurrence_id = $1
            OR legacy_observation_id = $1
        LIMIT 1
     )
     SELECT v.visit_id,
            matched.occurrence_id AS matched_occurrence_id
       FROM matched_visit mv
       JOIN visits v ON v.visit_id = mv.visit_id
       LEFT JOIN LATERAL (
         SELECT occurrence_id
           FROM occurrences
          WHERE visit_id = v.visit_id
            AND (occurrence_id = $1 OR legacy_observation_id = $1)
          ORDER BY subject_index ASC
          LIMIT 1
       ) matched ON true
      LIMIT 1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    visitId: row.visit_id,
    matchedOccurrenceId: row.matched_occurrence_id,
  };
}

async function getAssessmentMap(
  client: PoolClient,
  occurrenceIds: string[],
  aiRunId: string | null,
): Promise<Map<string, ObservationVisitAssessment>> {
  if (occurrenceIds.length === 0) return new Map();
  if (!aiRunId) {
    const entries = await Promise.all(occurrenceIds.map(async (occurrenceId) => {
      const latest = await getLatestAiAssessment(occurrenceId).catch(() => null);
      if (!latest) {
        return null;
      }
      const assessment: ObservationVisitAssessment = {
        ...latest,
        aiRunId: null,
        pipelineVersion: null,
        taxonomyVersion: null,
        interpretationStatus: null,
      };
      return [occurrenceId, assessment] as const;
    }));
    return new Map(
      entries.filter((entry): entry is readonly [string, ObservationVisitAssessment] => entry !== null),
    );
  }

  const result = await client.query<{
    assessment_id: string;
    occurrence_id: string;
    confidence_band: string | null;
    model_used: string;
    recommended_rank: string | null;
    recommended_taxon_name: string | null;
    best_specific_taxon_name: string | null;
    narrative: string;
    simple_summary: string;
    observer_boost: string;
    next_step_text: string;
    stop_reason: string;
    fun_fact: string;
    fun_fact_grounded: boolean;
    diagnostic_features_seen: unknown;
    missing_evidence: unknown;
    similar_taxa: unknown;
    distinguishing_tips: unknown;
    confirm_more: unknown;
    geographic_context: string;
    seasonal_context: string;
    area_inference: unknown;
    shot_suggestions: unknown;
    generated_at: string;
    ai_run_id: string | null;
    pipeline_version: string | null;
    taxonomy_version: string | null;
    interpretation_status: string | null;
  }>(
    `SELECT assessment_id::text,
            occurrence_id,
            confidence_band,
            model_used,
            recommended_rank,
            recommended_taxon_name,
            best_specific_taxon_name,
            narrative,
            simple_summary,
            observer_boost,
            next_step_text,
            stop_reason,
            fun_fact,
            fun_fact_grounded,
            diagnostic_features_seen,
            missing_evidence,
            similar_taxa,
            distinguishing_tips,
            confirm_more,
            geographic_context,
            seasonal_context,
            area_inference,
            shot_suggestions,
            generated_at::text,
            ai_run_id::text,
            pipeline_version,
            taxonomy_version,
            interpretation_status
       FROM observation_ai_assessments
      WHERE occurrence_id = ANY($1::text[])
        AND ai_run_id = $2::uuid
      ORDER BY generated_at DESC`,
    [occurrenceIds, aiRunId],
  );

  const readStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  const similarTaxa = (value: unknown): Array<{ name: string; rank?: string }> =>
    Array.isArray(value)
      ? value.reduce<Array<{ name: string; rank?: string }>>((accumulator, item) => {
            if (!item || typeof item !== "object") {
              return accumulator;
            }
            const taxon = item as Record<string, unknown>;
            const name = typeof taxon.name === "string" ? taxon.name : typeof taxon.scientific_name === "string" ? taxon.scientific_name : "";
            if (!name) {
              return accumulator;
            }
            accumulator.push({
              name,
              rank: typeof taxon.rank === "string" ? taxon.rank : undefined,
            });
            return accumulator;
          }, [])
      : [];

  const readAreaInference = (value: unknown): AiAssessment["areaInference"] => {
    const empty: AiAssessment["areaInference"] = {
      vegetationStructureCandidates: [],
      successionStageCandidates: [],
      humanInfluenceCandidates: [],
      moistureRegimeCandidates: [],
      managementHintCandidates: [],
    };
    if (!value || typeof value !== "object") return empty;
    const obj = value as Record<string, unknown>;
    const keys: Array<[keyof AiAssessment["areaInference"], string]> = [
      ["vegetationStructureCandidates", "vegetation_structure_candidates"],
      ["successionStageCandidates", "succession_stage_candidates"],
      ["humanInfluenceCandidates", "human_influence_candidates"],
      ["moistureRegimeCandidates", "moisture_regime_candidates"],
      ["managementHintCandidates", "management_hint_candidates"],
    ];
    for (const [camel, snake] of keys) {
      const arr = obj[snake];
      if (!Array.isArray(arr)) continue;
      empty[camel] = arr
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const e = entry as { label?: unknown; why?: unknown; confidence?: unknown };
          const label = typeof e.label === "string" ? e.label.trim() : "";
          if (!label) return null;
          const why = typeof e.why === "string" ? e.why.trim() : "";
          const confidence = typeof e.confidence === "number" && Number.isFinite(e.confidence)
            ? Math.min(1, Math.max(0, e.confidence))
            : null;
          return { label, why, confidence };
        })
        .filter((value): value is { label: string; why: string; confidence: number | null } => value !== null);
    }
    return empty;
  };

  const readShotSuggestions = (value: unknown): AiAssessment["shotSuggestions"] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const e = entry as { role?: unknown; target?: unknown; rationale?: unknown; priority?: unknown };
        const role = typeof e.role === "string" ? e.role.trim() : "";
        const target = typeof e.target === "string" ? e.target.trim() : "";
        if (!role || !target) return null;
        const rationale = typeof e.rationale === "string" ? e.rationale.trim() : "";
        const priority: AiAssessment["shotSuggestions"][number]["priority"] = e.priority === "high" ? "high" : "medium";
        return { role, target, rationale, priority };
      })
      .filter((entry): entry is AiAssessment["shotSuggestions"][number] => entry !== null);
  };

  const assessmentMap = new Map<string, ObservationVisitAssessment>();
  for (const row of result.rows) {
    if (assessmentMap.has(row.occurrence_id)) continue;
    assessmentMap.set(row.occurrence_id, {
      assessmentId: row.assessment_id,
      confidenceBand: row.confidence_band === "high" || row.confidence_band === "medium" || row.confidence_band === "low" ? row.confidence_band : "unknown",
      modelUsed: row.model_used,
      recommendedRank: row.recommended_rank,
      recommendedTaxonName: row.recommended_taxon_name,
      bestSpecificTaxonName: row.best_specific_taxon_name,
      narrative: row.narrative,
      simpleSummary: row.simple_summary,
      observerBoost: row.observer_boost,
      nextStepText: row.next_step_text,
      stopReason: row.stop_reason,
      funFact: row.fun_fact,
      funFactGrounded: row.fun_fact_grounded,
      diagnosticFeaturesSeen: readStringArray(row.diagnostic_features_seen),
      missingEvidence: readStringArray(row.missing_evidence),
      similarTaxa: similarTaxa(row.similar_taxa),
      distinguishingTips: readStringArray(row.distinguishing_tips),
      confirmMore: readStringArray(row.confirm_more),
      geographicContext: row.geographic_context,
      seasonalContext: row.seasonal_context,
      areaInference: readAreaInference(row.area_inference),
      shotSuggestions: readShotSuggestions(row.shot_suggestions),
      generatedAt: row.generated_at,
      aiRunId: row.ai_run_id,
      pipelineVersion: row.pipeline_version,
      taxonomyVersion: row.taxonomy_version,
      interpretationStatus: row.interpretation_status,
    });
  }
  return assessmentMap;
}

export async function getObservationVisitBundle(
  id: string,
  requestedSubjectId?: string | null,
): Promise<ObservationVisitBundle | null> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const resolvedVisit = await resolveVisit(client, id);
    if (!resolvedVisit) return null;

    await ensureLegacyAiRunsForVisit(client, resolvedVisit.visitId);
    const [subjects, storedDisplayState, aiRuns] = await Promise.all([
      getVisitSubjectSummaries(resolvedVisit.visitId, client),
      getStoredVisitDisplayState(client, resolvedVisit.visitId).catch(() => null),
      listObservationAiRunsForVisit(client, resolvedVisit.visitId),
    ]);
    if (subjects.length === 0) {
      return null;
    }

    const latestRun = aiRuns[0] ?? null;
    const displayState = storedDisplayState ?? deriveVisitDisplayState(resolvedVisit.visitId, subjects, latestRun?.aiRunId ?? null);
    const subjectIds = new Set(subjects.map((subject) => subject.occurrenceId));
    const canonicalSubjectId =
      requestedSubjectId && subjectIds.has(requestedSubjectId)
        ? requestedSubjectId
        : resolvedVisit.matchedOccurrenceId && subjectIds.has(resolvedVisit.matchedOccurrenceId)
          ? resolvedVisit.matchedOccurrenceId
          : displayState.featuredOccurrenceId && subjectIds.has(displayState.featuredOccurrenceId)
            ? displayState.featuredOccurrenceId
            : subjects[0]!.occurrenceId;
    const featuredOccurrenceId =
      displayState.featuredOccurrenceId && subjectIds.has(displayState.featuredOccurrenceId)
        ? displayState.featuredOccurrenceId
        : canonicalSubjectId;

    const selectedRun = displayState.derivedFromAiRunId
      ? aiRuns.find((run) => run.aiRunId === displayState.derivedFromAiRunId) ?? latestRun
      : latestRun;
    const previousRun = aiRuns.find((run) => run.aiRunId !== selectedRun?.aiRunId) ?? null;
    const occurrenceIds = subjects.map((subject) => subject.occurrenceId);

    const [identifications, lineages, selectedAssessments, previousAssessments, candidateRows, regionRows] = await Promise.all([
      client.query<{
        occurrence_id: string;
        proposed_name: string;
        proposed_rank: string | null;
        accepted_rank: string | null;
        notes: string | null;
        actor_name: string | null;
        created_at: string;
      }>(
        `SELECT i.occurrence_id,
                i.proposed_name,
                i.proposed_rank,
                i.accepted_rank,
                i.notes,
                coalesce(u.display_name, 'Community') AS actor_name,
                i.created_at::text
           FROM identifications i
           LEFT JOIN users u ON u.user_id = i.actor_user_id
          WHERE i.occurrence_id = ANY($1::text[])
          ORDER BY i.occurrence_id ASC, i.created_at DESC`,
        [occurrenceIds],
      ),
      client.query<{
        occurrence_id: string;
        kingdom: string | null;
        phylum: string | null;
        class_name: string | null;
        order_name: string | null;
        family: string | null;
        genus: string | null;
        scientific_name: string | null;
      }>(
        `SELECT occurrence_id, kingdom, phylum, class_name, order_name, family, genus, scientific_name
           FROM occurrences
          WHERE occurrence_id = ANY($1::text[])`,
        [occurrenceIds],
      ),
      getAssessmentMap(client, occurrenceIds, selectedRun?.aiRunId ?? null),
      getAssessmentMap(client, occurrenceIds, previousRun?.aiRunId ?? null),
      selectedRun
        ? client.query<{
            candidate_id: string;
            suggested_occurrence_id: string | null;
            vernacular_name: string | null;
            scientific_name: string | null;
            taxon_rank: string | null;
            confidence_score: string | null;
            candidate_status: string;
            note: string | null;
          }>(
          `SELECT candidate_id::text,
                  suggested_occurrence_id,
                  vernacular_name,
                  scientific_name,
                  taxon_rank,
                  confidence_score::text,
                  candidate_status,
                  note
             FROM observation_ai_subject_candidates
            WHERE ai_run_id = $1::uuid
            ORDER BY confidence_score DESC NULLS LAST, created_at DESC`,
          [selectedRun.aiRunId],
        )
        : Promise.resolve({ rows: [] }),
      selectedRun
        ? client.query<{
            region_id: string;
            occurrence_id: string | null;
            candidate_id: string | null;
            asset_id: string;
            normalized_rect: unknown;
            frame_time_ms: number | null;
            confidence_score: string | null;
            source_kind: string;
            source_model: string;
            source_payload: Record<string, unknown> | null;
          }>(
          `SELECT region_id::text,
                  occurrence_id,
                  candidate_id::text,
                  asset_id::text,
                  normalized_rect,
                  frame_time_ms,
                  confidence_score::text,
                  source_kind,
                  source_model,
                  source_payload
             FROM subject_media_regions
            WHERE ai_run_id = $1::uuid`,
          [selectedRun.aiRunId],
        )
        : Promise.resolve({ rows: [] }),
    ]);

    const idsByOccurrence = new Map<string, ObservationVisitSubject["identifications"]>();
    for (const row of identifications.rows) {
      const list = idsByOccurrence.get(row.occurrence_id) ?? [];
      list.push({
        proposedName: row.proposed_name,
        proposedRank: row.proposed_rank,
        acceptedRank: row.accepted_rank,
        notes: row.notes,
        actorName: row.actor_name ?? "Community",
        createdAt: row.created_at,
      });
      idsByOccurrence.set(row.occurrence_id, list);
    }

    const lineageByOccurrence = new Map<string, ObservationVisitSubject["lineage"]>();
    for (const row of lineages.rows) {
      const lineage: ObservationVisitSubject["lineage"] = [];
      const steps: Array<[string, string | null]> = [
        ["界", row.kingdom],
        ["門", row.phylum],
        ["綱", row.class_name],
        ["目", row.order_name],
        ["科", row.family],
        ["属", row.genus],
      ];
      for (const [rank, name] of steps) {
        if (name) lineage.push({ rank, name });
      }
      if (row.scientific_name) {
        lineage.push({ rank: "学名", name: row.scientific_name });
      }
      lineageByOccurrence.set(row.occurrence_id, lineage);
    }

    const regionsByOccurrence = new Map<string, SubjectMediaRegionView[]>();
    const regionsByCandidate = new Map<string, SubjectMediaRegionView[]>();
    for (const row of regionRows.rows) {
      const payload = row.source_payload ?? {};
      const view: SubjectMediaRegionView = {
        regionId: row.region_id,
        occurrenceId: row.occurrence_id,
        candidateId: row.candidate_id,
        assetId: row.asset_id,
        rect: normalizeRect(row.normalized_rect),
        frameTimeMs: row.frame_time_ms,
        confidenceScore: row.confidence_score != null ? Number(row.confidence_score) : null,
        sourceKind: row.source_kind,
        sourceModel: row.source_model,
        note: typeof payload.note === "string" ? payload.note : null,
      };
      if (row.occurrence_id) {
        const list = regionsByOccurrence.get(row.occurrence_id) ?? [];
        list.push(view);
        regionsByOccurrence.set(row.occurrence_id, list);
      }
      if (row.candidate_id) {
        const list = regionsByCandidate.get(row.candidate_id) ?? [];
        list.push(view);
        regionsByCandidate.set(row.candidate_id, list);
      }
    }

    const rankedSubjects = rankVisitSubjects(subjects, canonicalSubjectId).map((subject) => ({
      ...subject,
      identifications: idsByOccurrence.get(subject.occurrenceId) ?? [],
      lineage: lineageByOccurrence.get(subject.occurrenceId) ?? [],
      aiAssessment: selectedAssessments.get(subject.occurrenceId) ?? null,
      previousAiAssessment: previousAssessments.get(subject.occurrenceId) ?? null,
      regions: regionsByOccurrence.get(subject.occurrenceId) ?? [],
    }));

    const aiCandidates = candidateRows.rows.map((row) => ({
      candidateId: row.candidate_id,
      suggestedOccurrenceId: row.suggested_occurrence_id,
      displayName: row.vernacular_name || row.scientific_name || "AI 候補",
      scientificName: row.scientific_name,
      rank: row.taxon_rank,
      confidence: row.confidence_score != null ? Number(row.confidence_score) : null,
      candidateStatus: row.candidate_status,
      note: row.note,
      regions: regionsByCandidate.get(row.candidate_id) ?? [],
    }));

    return {
      visitId: resolvedVisit.visitId,
      canonicalSubjectId,
      featuredOccurrenceId,
      selectedReason: displayState.selectedReason,
      selectionSource: displayState.selectionSource,
      lockedByHuman: displayState.lockedByHuman,
      displayStability: displayState.displayStability,
      selectedRun,
      previousRun,
      subjects: rankedSubjects,
      aiCandidates,
    };
  } finally {
    client.release();
  }
}
