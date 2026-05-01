import { createHash } from "node:crypto";
import { getPool } from "../db.js";

export type RegionalHypothesisClaimType =
  | "habitat"
  | "seasonality"
  | "species_candidate"
  | "sampling_gap"
  | "management_effect"
  | "effort_bias";

export type RegionalHypothesisDraft = {
  meshKey: string;
  claimType: RegionalHypothesisClaimType;
  hypothesisText: string;
  whatWeCanSay: string;
  supportingGuideRecordIds: string[];
  supportingObservationIds: string[];
  supportingKnowledgeCardIds: string[];
  supportingClaimIds: string[];
  evidence: Record<string, unknown>;
  confidence: number;
  biasWarnings: string[];
  missingData: string[];
  nextSamplingProtocol: string;
  sourceFingerprint: string;
};

export type RegionalHypothesisRecord = Omit<RegionalHypothesisDraft, "meshKey"> & {
  hypothesisId: string;
  meshKey: string | null;
  placeId: string | null;
  reviewStatus: "draft" | "auto" | "needs_review" | "reviewed" | "rejected";
  generatedAt: string;
};

export type RegionalHypothesisMeshSource = {
  meshKey: string;
  guideRecordCount: number;
  contributorCount: number;
  vegetationCounts: Record<string, number>;
  landformCounts: Record<string, number>;
  structureCounts: Record<string, number>;
  soundCounts: Record<string, number>;
  sampleRecordIds: string[];
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  visitCount: number;
  occurrenceCount: number;
  absentOccurrenceCount: number;
  completeChecklistCount: number;
  effortVisitCount: number;
  coordinateUncertaintyKnownCount: number;
  audioSegmentCount: number;
  correctionCount: number;
  knowledgeCardIds: string[];
};

type MeshRow = {
  mesh_key: string;
  guide_record_count: number;
  contributor_count: number;
  vegetation_counts: unknown;
  landform_counts: unknown;
  structure_counts: unknown;
  sound_counts: unknown;
  sample_record_ids: unknown;
  first_seen_at: string | null;
  last_seen_at: string | null;
  visit_count: string | number;
  occurrence_count: string | number;
  absent_occurrence_count: string | number;
  complete_checklist_count: string | number;
  effort_visit_count: string | number;
  coordinate_uncertainty_known_count: string | number;
  audio_segment_count: string | number;
  correction_count: string | number;
};

function toInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function normalizeCountMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    const count = Number(value);
    if (key && Number.isFinite(count) && count > 0) out[key] = Math.round(count * 1000) / 1000;
  }
  return out;
}

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function topNames(map: Record<string, number>, limit = 4): string[] {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    .slice(0, limit)
    .map(([name]) => name);
}

function allFeatureNames(source: RegionalHypothesisMeshSource): string[] {
  return [
    ...Object.keys(source.vegetationCounts),
    ...Object.keys(source.landformCounts),
    ...Object.keys(source.structureCounts),
    ...Object.keys(source.soundCounts),
  ];
}

function hasFeature(source: RegionalHypothesisMeshSource, pattern: RegExp): boolean {
  return allFeatureNames(source).some((name) => pattern.test(name));
}

function missingDataFor(source: RegionalHypothesisMeshSource): string[] {
  const missing = new Set<string>();
  if (source.guideRecordCount < 3) missing.add("repeat_guide_records");
  if (source.contributorCount < 2) missing.add("independent_contributors");
  if (source.visitCount < 2) missing.add("repeat_visits");
  if (source.completeChecklistCount === 0) missing.add("complete_checklist");
  if (source.effortVisitCount === 0) missing.add("effort_minutes_or_distance");
  if (source.absentOccurrenceCount === 0) missing.add("explicit_non_detection");
  if (source.coordinateUncertaintyKnownCount === 0) missing.add("coordinate_uncertainty_m");
  if (source.audioSegmentCount === 0) missing.add("clean_audio_segments");
  return Array.from(missing);
}

function biasWarningsFor(source: RegionalHypothesisMeshSource): string[] {
  const warnings = new Set<string>([
    "guide_records_are_opportunistic",
    "ai_detected_features_need_human_or_repeat_confirmation",
  ]);
  if (source.guideRecordCount < 3 || source.contributorCount < 2) warnings.add("public_threshold_or_small_sample");
  if (source.completeChecklistCount === 0) warnings.add("absence_cannot_be_inferred_without_scope");
  if (source.effortVisitCount === 0) warnings.add("effort_bias_not_corrected");
  if (source.correctionCount > 0) warnings.add("corrections_exist_check_failure_patterns");
  return Array.from(warnings);
}

function confidenceFor(source: RegionalHypothesisMeshSource, base: number): number {
  let confidence = base;
  if (source.guideRecordCount >= 3) confidence += 0.05;
  if (source.contributorCount >= 2) confidence += 0.05;
  if (source.visitCount >= 2) confidence += 0.04;
  if (source.completeChecklistCount > 0) confidence += 0.04;
  if (source.effortVisitCount > 0) confidence += 0.03;
  return Math.max(0.25, Math.min(0.72, Math.round(confidence * 1000) / 1000));
}

function sourceFingerprint(meshKey: string, claimType: RegionalHypothesisClaimType, evidenceKey: string): string {
  const hash = createHash("sha256").update(`${meshKey}:${claimType}:${evidenceKey}`).digest("hex").slice(0, 24);
  return `regional-hypothesis:${meshKey}:${claimType}:${hash}`;
}

function draftFor(
  source: RegionalHypothesisMeshSource,
  claimType: RegionalHypothesisClaimType,
  hypothesisText: string,
  whatWeCanSay: string,
  nextSamplingProtocol: string,
  evidenceExtra: Record<string, unknown> = {},
  baseConfidence = 0.45,
): RegionalHypothesisDraft {
  const evidence = {
    meshKey: source.meshKey,
    guideRecordCount: source.guideRecordCount,
    contributorCount: source.contributorCount,
    visitCount: source.visitCount,
    occurrenceCount: source.occurrenceCount,
    absentOccurrenceCount: source.absentOccurrenceCount,
    completeChecklistCount: source.completeChecklistCount,
    topVegetation: topNames(source.vegetationCounts),
    topLandform: topNames(source.landformCounts),
    topStructure: topNames(source.structureCounts),
    topSound: topNames(source.soundCounts),
    ...evidenceExtra,
  };
  const fingerprintKey = typeof evidenceExtra.trigger === "string" ? evidenceExtra.trigger : "base";
  return {
    meshKey: source.meshKey,
    claimType,
    hypothesisText,
    whatWeCanSay,
    supportingGuideRecordIds: source.sampleRecordIds.slice(0, 12),
    supportingObservationIds: [],
    supportingKnowledgeCardIds: source.knowledgeCardIds.slice(0, 8),
    supportingClaimIds: [],
    evidence,
    confidence: confidenceFor(source, baseConfidence),
    biasWarnings: biasWarningsFor(source),
    missingData: missingDataFor(source),
    nextSamplingProtocol,
    sourceFingerprint: sourceFingerprint(source.meshKey, claimType, fingerprintKey),
  };
}

export function buildRegionalHypothesesForMesh(source: RegionalHypothesisMeshSource): RegionalHypothesisDraft[] {
  const drafts: RegionalHypothesisDraft[] = [];
  const vegetation = topNames(source.vegetationCounts, 3);
  const landform = topNames(source.landformCounts, 3);
  const structure = topNames(source.structureCounts, 3);
  const featureSummary = [...vegetation, ...landform, ...structure].slice(0, 5).join("・") || "環境手がかり";

  drafts.push(draftFor(
    source,
    source.guideRecordCount < 3 || source.contributorCount < 2 ? "sampling_gap" : "effort_bias",
    `この100mメッシュは「${featureSummary}」の手がかりが出始めているが、現時点では調査努力量の偏りを先に確認すべき。`,
    `ガイド記録${source.guideRecordCount}件、投稿/訪問${source.visitCount}件、寄与者${source.contributorCount}人相当の集約がある。これは地域の状態を断言する量ではなく、次に集めるべき観察軸を決める材料。`,
    "同じメッシュで、日時を変えて10-15分の再訪を行い、complete_checklist_flag と target_taxa_scope を付けた記録を残す。見つからなかった分類群も occurrence_status=absent で明示する。",
    { featureSummary },
    0.42,
  ));

  if (hasFeature(source, /水|川|池|湿|用水|水路|岸|泥|葦|ヨシ|抽水|湿性/)) {
    drafts.push(draftFor(
      source,
      "habitat",
      "水辺・湿性環境の手がかりが繰り返し出ており、湿性植物・水生昆虫・両生類の候補地として検証する価値がある。",
      "水辺らしい地形・植生・構造物は検出されている。ただし対象分類群の反復観察と非検出データがないため、生息地としては仮説段階。",
      "朝夕または雨後に、水際から5m以内を範囲指定して植物・昆虫・両生類を分けて記録する。見つからない場合も対象分類群と探索時間を残す。",
      { trigger: "water_or_wetland_features" },
      0.5,
    ));
  }

  if (hasFeature(source, /草地|雑草|刈|芝|道路|舗装|路肩|街路|畑|農地|管理|花壇/)) {
    drafts.push(draftFor(
      source,
      "management_effect",
      "道路際・草地・管理痕跡の手がかりがあり、草刈りや土地利用が見える生物相に影響している可能性がある。",
      "人工構造物や管理痕跡は地域の微細環境として記録できている。ただし管理イベントの日付や反復比較がないため、影響の方向はまだ言えない。",
      "草丈、刈り跡、舗装/未舗装、水路の有無を同じ構図で再撮影し、草刈り前後または2週間間隔で植物・昆虫の変化を比較する。",
      { trigger: "roadside_or_management_features" },
      0.48,
    ));
  }

  if (vegetation.length > 0 && source.occurrenceCount === 0) {
    drafts.push(draftFor(
      source,
      "species_candidate",
      `「${vegetation.join("・")}」などの植生手がかりはあるが、対応する通常観察が不足している。種名同定より先に生活形・群落として記録を厚くする段階。`,
      "ガイドは植生・環境文脈を拾えているが、occurrences 側の証拠が薄い。ここで種分布を語るより、候補分類群と必要証拠を整理するのが妥当。",
      "広角の環境写真に加え、葉・花・実・樹皮など同定部位を別カットで残す。AI同定だけで確定せず、人間補正または再訪で evidence_tier を上げる。",
      { trigger: "vegetation_without_occurrences" },
      0.44,
    ));
  }

  if (source.firstSeenAt && source.lastSeenAt && source.guideRecordCount >= 2) {
    drafts.push(draftFor(
      source,
      "seasonality",
      "同一メッシュに複数のガイド記録があり、季節・時間帯を揃えた再訪でフェノロジー仮説に育てられる。",
      "現時点では季節変化を示すには不十分だが、同じ地点を同じ観察プロトコルで繰り返す入口はできている。",
      "月1回、同じ時間帯・同じ移動範囲で complete checklist を作り、花期・結実・鳴き声・水量など季節メモを構造化して残す。",
      { firstSeenAt: source.firstSeenAt, lastSeenAt: source.lastSeenAt },
      0.43,
    ));
  }

  return drafts.slice(0, 5);
}

function sourceFromRow(row: MeshRow, knowledgeCardIds: string[]): RegionalHypothesisMeshSource {
  return {
    meshKey: row.mesh_key,
    guideRecordCount: toInt(row.guide_record_count),
    contributorCount: toInt(row.contributor_count),
    vegetationCounts: normalizeCountMap(row.vegetation_counts),
    landformCounts: normalizeCountMap(row.landform_counts),
    structureCounts: normalizeCountMap(row.structure_counts),
    soundCounts: normalizeCountMap(row.sound_counts),
    sampleRecordIds: normalizeStringArray(row.sample_record_ids),
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    visitCount: toInt(row.visit_count),
    occurrenceCount: toInt(row.occurrence_count),
    absentOccurrenceCount: toInt(row.absent_occurrence_count),
    completeChecklistCount: toInt(row.complete_checklist_count),
    effortVisitCount: toInt(row.effort_visit_count),
    coordinateUncertaintyKnownCount: toInt(row.coordinate_uncertainty_known_count),
    audioSegmentCount: toInt(row.audio_segment_count),
    correctionCount: toInt(row.correction_count),
    knowledgeCardIds,
  };
}

async function loadKnowledgeCardIdsForMesh(row: MeshRow): Promise<string[]> {
  const featureText = [
    ...topNames(normalizeCountMap(row.vegetation_counts), 3),
    ...topNames(normalizeCountMap(row.landform_counts), 3),
    ...topNames(normalizeCountMap(row.structure_counts), 3),
  ].join(" ");
  const categories = /水|川|池|湿|用水|水路/.test(featureText)
    ? ["water", "landform", "ecology"]
    : /畑|農|草刈|管理|花壇/.test(featureText)
      ? ["agriculture", "local_life", "ecology"]
      : ["ecology", "landform", "local_life"];
  const result = await getPool().query<{ card_id: string }>(
    `select card_id
       from regional_knowledge_cards
      where review_status in ('approved', 'retrieval')
        and sensitivity_level in ('public', 'coarse')
        and category = any($1::text[])
      order by quality_score desc, updated_at desc
      limit 4`,
    [categories],
  ).catch(() => ({ rows: [] as { card_id: string }[] }));
  return result.rows.map((item) => item.card_id);
}

export async function loadRegionalHypothesisSources(limit = 100): Promise<RegionalHypothesisMeshSource[]> {
  const cappedLimit = Math.max(1, Math.min(500, Math.round(limit)));
  const result = await getPool().query<MeshRow>(
    `select gemc.mesh_key,
            gemc.guide_record_count,
            gemc.contributor_count,
            gemc.vegetation_counts,
            gemc.landform_counts,
            gemc.structure_counts,
            gemc.sound_counts,
            gemc.sample_record_ids,
            gemc.first_seen_at::text as first_seen_at,
            gemc.last_seen_at::text as last_seen_at,
            count(distinct v.visit_id) as visit_count,
            count(distinct o.occurrence_id) as occurrence_count,
            count(distinct o.occurrence_id) filter (where o.occurrence_status = 'absent') as absent_occurrence_count,
            count(distinct v.visit_id) filter (where v.complete_checklist_flag = true) as complete_checklist_count,
            count(distinct v.visit_id) filter (where v.effort_minutes is not null or v.distance_meters is not null) as effort_visit_count,
            count(distinct v.visit_id) filter (where v.coordinate_uncertainty_m is not null) as coordinate_uncertainty_known_count,
            count(distinct a.segment_id) as audio_segment_count,
            count(distinct c.correction_id) as correction_count
       from guide_environment_mesh_cells gemc
       left join visits v
         on v.point_latitude between gemc.center_lat - 0.001 and gemc.center_lat + 0.001
        and v.point_longitude between gemc.center_lng - 0.001 and gemc.center_lng + 0.001
       left join occurrences o on o.visit_id = v.visit_id
       left join audio_segments a
         on a.lat between gemc.center_lat - 0.001 and gemc.center_lat + 0.001
        and a.lng between gemc.center_lng - 0.001 and gemc.center_lng + 0.001
        and a.privacy_status = 'clean'
       left join guide_record_corrections c
         on gemc.sample_record_ids ? (c.guide_record_id::text)
      group by gemc.mesh_key
      order by gemc.last_seen_at desc nulls last, gemc.guide_record_count desc
      limit $1`,
    [cappedLimit],
  );
  const sources: RegionalHypothesisMeshSource[] = [];
  for (const row of result.rows) {
    const knowledgeCardIds = await loadKnowledgeCardIdsForMesh(row);
    sources.push(sourceFromRow(row, knowledgeCardIds));
  }
  return sources;
}

export async function upsertRegionalHypotheses(drafts: RegionalHypothesisDraft[]): Promise<number> {
  let written = 0;
  for (const draft of drafts) {
    await getPool().query(
      `insert into regional_hypotheses (
          subject_kind,
          mesh_key,
          claim_type,
          hypothesis_text,
          what_we_can_say,
          supporting_observation_ids,
          supporting_guide_record_ids,
          supporting_knowledge_card_ids,
          supporting_claim_ids,
          evidence,
          confidence,
          bias_warnings,
          missing_data,
          next_sampling_protocol,
          review_status,
          generation_method,
          source_fingerprint,
          generated_at,
          updated_at
       ) values (
          'mesh',
          $1,
          $2,
          $3,
          $4,
          $5::jsonb,
          $6::jsonb,
          $7::jsonb,
          $8::jsonb,
          $9::jsonb,
          $10,
          $11::jsonb,
          $12::jsonb,
          $13,
          'auto',
          'deterministic_v1',
          $14,
          now(),
          now()
       )
       on conflict (source_fingerprint) do update set
          hypothesis_text = excluded.hypothesis_text,
          what_we_can_say = excluded.what_we_can_say,
          supporting_observation_ids = excluded.supporting_observation_ids,
          supporting_guide_record_ids = excluded.supporting_guide_record_ids,
          supporting_knowledge_card_ids = excluded.supporting_knowledge_card_ids,
          supporting_claim_ids = excluded.supporting_claim_ids,
          evidence = excluded.evidence,
          confidence = excluded.confidence,
          bias_warnings = excluded.bias_warnings,
          missing_data = excluded.missing_data,
          next_sampling_protocol = excluded.next_sampling_protocol,
          generated_at = now(),
          updated_at = now()`,
      [
        draft.meshKey,
        draft.claimType,
        draft.hypothesisText,
        draft.whatWeCanSay,
        JSON.stringify(draft.supportingObservationIds),
        JSON.stringify(draft.supportingGuideRecordIds),
        JSON.stringify(draft.supportingKnowledgeCardIds),
        JSON.stringify(draft.supportingClaimIds),
        JSON.stringify(draft.evidence),
        draft.confidence,
        JSON.stringify(draft.biasWarnings),
        JSON.stringify(draft.missingData),
        draft.nextSamplingProtocol,
        draft.sourceFingerprint,
      ],
    );
    written += 1;
  }
  return written;
}

export async function generateAndStoreRegionalHypotheses(limit = 100): Promise<{ scannedMeshes: number; generated: number; written: number }> {
  const sources = await loadRegionalHypothesisSources(limit);
  const drafts = sources.flatMap(buildRegionalHypothesesForMesh);
  const written = await upsertRegionalHypotheses(drafts);
  return { scannedMeshes: sources.length, generated: drafts.length, written };
}

export async function listRegionalHypotheses(opts: { limit?: number; meshKey?: string; placeId?: string; publicOnly?: boolean } = {}): Promise<RegionalHypothesisRecord[]> {
  const values: unknown[] = [];
  const clauses = ["review_status <> 'rejected'"];
  if (opts.publicOnly) {
    clauses.push("confidence >= 0.35");
  }
  if (opts.meshKey) {
    values.push(opts.meshKey);
    clauses.push(`mesh_key = $${values.length}`);
  }
  if (opts.placeId) {
    values.push(opts.placeId);
    clauses.push(`place_id = $${values.length}`);
  }
  values.push(Math.max(1, Math.min(100, Math.round(opts.limit ?? 20))));
  const result = await getPool().query<{
    hypothesis_id: string;
    mesh_key: string | null;
    place_id: string | null;
    claim_type: RegionalHypothesisClaimType;
    hypothesis_text: string;
    what_we_can_say: string;
    supporting_observation_ids: unknown;
    supporting_guide_record_ids: unknown;
    supporting_knowledge_card_ids: unknown;
    supporting_claim_ids: unknown;
    evidence: Record<string, unknown>;
    confidence: string | number;
    bias_warnings: unknown;
    missing_data: unknown;
    next_sampling_protocol: string;
    source_fingerprint: string;
    review_status: RegionalHypothesisRecord["reviewStatus"];
    generated_at: string;
  }>(
    `select hypothesis_id::text,
            mesh_key,
            place_id,
            claim_type,
            hypothesis_text,
            what_we_can_say,
            supporting_observation_ids,
            supporting_guide_record_ids,
            supporting_knowledge_card_ids,
            supporting_claim_ids,
            evidence,
            confidence,
            bias_warnings,
            missing_data,
            next_sampling_protocol,
            source_fingerprint,
            review_status,
            generated_at::text
       from regional_hypotheses
      where ${clauses.join(" and ")}
      order by confidence desc, generated_at desc
      limit $${values.length}`,
    values,
  );
  return result.rows.map((row) => ({
    hypothesisId: row.hypothesis_id,
    meshKey: row.mesh_key,
    placeId: row.place_id,
    claimType: row.claim_type,
    hypothesisText: row.hypothesis_text,
    whatWeCanSay: row.what_we_can_say,
    supportingObservationIds: normalizeStringArray(row.supporting_observation_ids),
    supportingGuideRecordIds: normalizeStringArray(row.supporting_guide_record_ids),
    supportingKnowledgeCardIds: normalizeStringArray(row.supporting_knowledge_card_ids),
    supportingClaimIds: normalizeStringArray(row.supporting_claim_ids),
    evidence: row.evidence ?? {},
    confidence: Number(row.confidence ?? 0),
    biasWarnings: normalizeStringArray(row.bias_warnings),
    missingData: normalizeStringArray(row.missing_data),
    nextSamplingProtocol: row.next_sampling_protocol,
    sourceFingerprint: row.source_fingerprint,
    reviewStatus: row.review_status,
    generatedAt: row.generated_at,
  }));
}

export const __test__ = {
  missingDataFor,
  biasWarningsFor,
  normalizeCountMap,
};
