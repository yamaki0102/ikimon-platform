import {
  type ObservationAiCandidate,
  type ObservationAiSubjectCandidate,
} from "./cloudflareObservationAi";

export const GEMINI_PRIMARY_MODEL = "gemini-3.5-flash-lite";
export const GEMINI_ANALYSIS_MODEL = "gemini-3.1-flash-lite";
export const GEMINI_SUMMARY_MODEL = "gemini-3.1-flash-lite";
export const GEMINI_OBSERVATION_PROMPT_VERSION = "observation-triple-lane/v2";
export const GEMINI_OBSERVATION_RULE_VERSION = "record-observation-gemini-batch/v2";
export const GEMINI_BATCH_MAX_RECORDS = 10;
export const GEMINI_BATCH_MAX_INLINE_BYTES = 12 * 1024 * 1024;

export type GeminiObservationImage = {
  assetId: string;
  mimeType: string;
  base64Data: string;
};

export type GeminiRecordClass = "organism" | "person" | "food" | "environment" | "object" | "document" | "mixed" | "unknown";
export type GeminiInformationState = "informative" | "not_informative" | "not_assessable";

type GeminiPrimarySubject = {
  id: string;
  role: "primary" | "secondary" | "background" | "trace";
  scope: "individual" | "group" | "unknown";
  count: number;
  name: string;
  scientific: string;
  rank: "species" | "genus" | "family" | "order" | "class" | "lifeform" | "unknown";
  confidence: number;
  evidence: string;
};

type GeminiRegion = {
  subject_id: string;
  asset_index: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GeminiPrimaryEvidence = {
  record_class: GeminiRecordClass;
  information_state: GeminiInformationState;
  scene_class: "single_subject" | "same_taxon_group" | "multi_taxa" | "no_clear_subject";
  subjects: GeminiPrimarySubject[];
  regions: GeminiRegion[];
  non_biological_labels: string[];
  quality_flags: string[];
  needs_review: boolean;
  review_reasons: string[];
};

type GeminiCensusGroup = {
  id: string;
  kind: "animal" | "plant" | "fungus" | "trace" | "unknown_biota";
  role: "primary" | "other";
  scope: "individual" | "group" | "unknown";
  count: number;
  label: string;
  evidence: string;
  confidence: number;
};

export type GeminiCensusEvidence = {
  detection_state: "detected" | "not_detected" | "not_assessable";
  scene: "one_group" | "same_taxon_multiple" | "multiple_taxa" | "uncertain";
  groups: GeminiCensusGroup[];
  regions: Array<Omit<GeminiRegion, "subject_id"> & { group_id: string }>;
  relations: string[];
  needs_review: boolean;
  review_reasons: string[];
};

export type GeminiEnvironmentFields = {
  place_type: "grassland_urban_edge" | "urban" | "woodland" | "water_edge" | "wetland" | "coast" | "unknown";
  contact_surface: "soil_gravel_litter" | "soil" | "plant" | "water" | "rock" | "artificial" | "unknown";
  surrounding_cover: "low_grass" | "trees_shrubs" | "bare_ground" | "water" | "snow" | "built_surface" | "unknown";
  environment_condition: "open_dry" | "sunny" | "shaded" | "wet" | "flowing" | "windy" | "unknown";
  human_change: "trampling_mowing" | "mowing" | "trampling" | "planting" | "construction" | "release" | "none_visible" | "unknown";
};

export type GeminiEnvironmentEvidence = {
  assessment_state: GeminiInformationState;
  fields: GeminiEnvironmentFields;
  cues: Array<{
    slot: "vegetation_structure" | "substrate" | "moisture" | "human_influence" | "management_signs";
    label: string;
    evidence: string;
    asset_index: number;
    confidence: number;
  }>;
  uncertain_cues: string[];
};

export type GeminiObservationSummary = {
  narrative: string;
  subject_explanations: Array<{
    subject_id: string;
    title: string;
    explanation: string;
    uncertainty: string;
    next_photo: string;
  }>;
  environment_summary: string;
  interaction_summary: string;
  observer_feedback: string;
};

export type GeminiMergedObservation = {
  candidate: ObservationAiCandidate;
  recordClass: GeminiRecordClass;
  informationState: GeminiInformationState;
  detectionState: "detected" | "not_detected" | "not_assessable";
  environment: GeminiEnvironmentEvidence;
  relations: string[];
  qualityFlags: string[];
  needsReview: boolean;
  reviewReasons: string[];
  summary: GeminiObservationSummary | null;
};

type JsonSchema = Record<string, unknown>;

const rectProperties = {
  asset_index: { type: "INTEGER", minimum: 0 },
  x: { type: "NUMBER", minimum: 0, maximum: 1 },
  y: { type: "NUMBER", minimum: 0, maximum: 1 },
  width: { type: "NUMBER", minimum: 0, maximum: 1 },
  height: { type: "NUMBER", minimum: 0, maximum: 1 },
};

export const GEMINI_PRIMARY_SCHEMA: JsonSchema = {
  type: "OBJECT",
  properties: {
    record_class: { type: "STRING", enum: ["organism", "person", "food", "environment", "object", "document", "mixed", "unknown"] },
    information_state: { type: "STRING", enum: ["informative", "not_informative", "not_assessable"] },
    scene_class: { type: "STRING", enum: ["single_subject", "same_taxon_group", "multi_taxa", "no_clear_subject"] },
    subjects: { type: "ARRAY", maxItems: 8, items: { type: "OBJECT", properties: {
      id: { type: "STRING" }, role: { type: "STRING", enum: ["primary", "secondary", "background", "trace"] },
      scope: { type: "STRING", enum: ["individual", "group", "unknown"] }, count: { type: "INTEGER", minimum: 0 },
      name: { type: "STRING" }, scientific: { type: "STRING" },
      rank: { type: "STRING", enum: ["species", "genus", "family", "order", "class", "lifeform", "unknown"] },
      confidence: { type: "NUMBER", minimum: 0, maximum: 1 }, evidence: { type: "STRING" },
    }, required: ["id", "role", "scope", "count", "name", "scientific", "rank", "confidence", "evidence"] } },
    regions: { type: "ARRAY", maxItems: 16, items: { type: "OBJECT", properties: { subject_id: { type: "STRING" }, ...rectProperties }, required: ["subject_id", "asset_index", "x", "y", "width", "height"] } },
    non_biological_labels: { type: "ARRAY", maxItems: 6, items: { type: "STRING" } },
    quality_flags: { type: "ARRAY", maxItems: 8, items: { type: "STRING" } },
    needs_review: { type: "BOOLEAN" },
    review_reasons: { type: "ARRAY", maxItems: 6, items: { type: "STRING" } },
  },
  required: ["record_class", "information_state", "scene_class", "subjects", "regions", "non_biological_labels", "quality_flags", "needs_review", "review_reasons"],
};

export const GEMINI_CENSUS_SCHEMA: JsonSchema = {
  type: "OBJECT",
  properties: {
    detection_state: { type: "STRING", enum: ["detected", "not_detected", "not_assessable"] },
    scene: { type: "STRING", enum: ["one_group", "same_taxon_multiple", "multiple_taxa", "uncertain"] },
    groups: { type: "ARRAY", maxItems: 8, items: { type: "OBJECT", properties: {
      id: { type: "STRING" }, kind: { type: "STRING", enum: ["animal", "plant", "fungus", "trace", "unknown_biota"] },
      role: { type: "STRING", enum: ["primary", "other"] }, scope: { type: "STRING", enum: ["individual", "group", "unknown"] },
      count: { type: "INTEGER", minimum: 0 }, label: { type: "STRING" }, evidence: { type: "STRING" }, confidence: { type: "NUMBER", minimum: 0, maximum: 1 },
    }, required: ["id", "kind", "role", "scope", "count", "label", "evidence", "confidence"] } },
    regions: { type: "ARRAY", maxItems: 16, items: { type: "OBJECT", properties: { group_id: { type: "STRING" }, ...rectProperties }, required: ["group_id", "asset_index", "x", "y", "width", "height"] } },
    relations: { type: "ARRAY", maxItems: 6, items: { type: "STRING" } },
    needs_review: { type: "BOOLEAN" }, review_reasons: { type: "ARRAY", maxItems: 6, items: { type: "STRING" } },
  },
  required: ["detection_state", "scene", "groups", "regions", "relations", "needs_review", "review_reasons"],
};

export const GEMINI_ENVIRONMENT_SCHEMA: JsonSchema = {
  type: "OBJECT",
  properties: {
    assessment_state: { type: "STRING", enum: ["informative", "not_informative", "not_assessable"] },
    fields: { type: "OBJECT", properties: {
      place_type: { type: "STRING", enum: ["grassland_urban_edge", "urban", "woodland", "water_edge", "wetland", "coast", "unknown"] },
      contact_surface: { type: "STRING", enum: ["soil_gravel_litter", "soil", "plant", "water", "rock", "artificial", "unknown"] },
      surrounding_cover: { type: "STRING", enum: ["low_grass", "trees_shrubs", "bare_ground", "water", "snow", "built_surface", "unknown"] },
      environment_condition: { type: "STRING", enum: ["open_dry", "sunny", "shaded", "wet", "flowing", "windy", "unknown"] },
      human_change: { type: "STRING", enum: ["trampling_mowing", "mowing", "trampling", "planting", "construction", "release", "none_visible", "unknown"] },
    }, required: ["place_type", "contact_surface", "surrounding_cover", "environment_condition", "human_change"] },
    cues: { type: "ARRAY", maxItems: 12, items: { type: "OBJECT", properties: {
      slot: { type: "STRING", enum: ["vegetation_structure", "substrate", "moisture", "human_influence", "management_signs"] },
      label: { type: "STRING" }, evidence: { type: "STRING" }, asset_index: { type: "INTEGER", minimum: 0 }, confidence: { type: "NUMBER", minimum: 0, maximum: 1 },
    }, required: ["slot", "label", "evidence", "asset_index", "confidence"] } },
    uncertain_cues: { type: "ARRAY", maxItems: 6, items: { type: "STRING" } },
  },
  required: ["assessment_state", "fields", "cues", "uncertain_cues"],
};

export const GEMINI_SUMMARY_SCHEMA: JsonSchema = {
  type: "OBJECT",
  properties: {
    narrative: { type: "STRING" },
    subject_explanations: { type: "ARRAY", maxItems: 8, items: { type: "OBJECT", properties: {
      subject_id: { type: "STRING" }, title: { type: "STRING" }, explanation: { type: "STRING" },
      uncertainty: { type: "STRING" }, next_photo: { type: "STRING" },
    }, required: ["subject_id", "title", "explanation", "uncertainty", "next_photo"] } },
    environment_summary: { type: "STRING" }, interaction_summary: { type: "STRING" }, observer_feedback: { type: "STRING" },
  },
  required: ["narrative", "subject_explanations", "environment_summary", "interaction_summary", "observer_feedback"],
};

const imageParts = (images: GeminiObservationImage[]): Array<Record<string, unknown>> => images.flatMap((image, assetIndex) => [
  { text: `入力画像 asset_index=${assetIndex} asset_id=${image.assetId}` },
  { inlineData: { mimeType: image.mimeType, data: image.base64Data } },
]);

const generationConfig = (schema: JsonSchema, maxOutputTokens: number, temperature: number) => ({
  temperature,
  maxOutputTokens,
  responseMimeType: "application/json",
  responseSchema: schema,
  thinkingConfig: { thinkingLevel: "MINIMAL" },
});

export function buildGeminiPrimaryRequest(recordId: string, observedAt: string | null, images: GeminiObservationImage[]) {
  const prompt = `あなたはikimon.lifeの公開記録写真から、主対象と写真全体の分類を短く構造化する視覚抽出器です。\n記録ID:${recordId}\n観察日:${observedAt ?? "不明"}\n画像数:${images.length}\n\n全画像を比較し、同じ対象は統合してください。主対象は1件だけprimaryにし、別生物も見落とさないでください。種の識別特徴が足りなければ属・科・目・生活型で止めます。人物、食べ物、環境風景、物、文書もrecord_classへ分類しますが、人物の容姿・属性・個人情報は記述しません。非生物をsubjectsへ入れません。information_stateは、判読できる情報があればinformative、何も有用に読めなければnot_informative、画質等で判定不能ならnot_assessableです。領域は正規化座標で返し、日本語、JSONのみを返してください。`;
  return { contents: [{ role: "user", parts: [...imageParts(images), { text: prompt }] }], generationConfig: generationConfig(GEMINI_PRIMARY_SCHEMA, 2048, 0.1) };
}

export function buildGeminiCensusRequest(recordId: string, images: GeminiObservationImage[]) {
  const prompt = `公開された市民科学写真の「個体・別生物の棚卸し」だけをしてください。分類解説は不要です。\n記録ID:${recordId}\n画像数:${images.length}\n\n全画像を横断し、同じ個体は1 groupへ統合します。同分類群の複数個体はscope=group、分かる範囲でcountへ。主対象以外の独立した昆虫、鳥、植物、菌、痕跡、寄主植物、異なる形態の背景植物もotherへ入れます。同じ対象の別名候補は別groupにせず、石、舗装、フェンス、建物、影、食べ物、人物はgroupにしません。種名を無理につけず見える粒度に止め、primaryは1 groupだけ、領域をasset_index付きで返してください。判定不能と不在を区別し、日本語、JSONのみを返してください。`;
  return { contents: [{ role: "user", parts: [...imageParts(images), { text: prompt }] }], generationConfig: generationConfig(GEMINI_CENSUS_SCHEMA, 2048, 0.1) };
}

export function buildGeminiEnvironmentRequest(recordId: string, images: GeminiObservationImage[]) {
  const prompt = `公開写真から、環境・場所の「写っている証拠」だけを棚卸ししてください。生物同定や一般知識による生息地推測は不要です。\n記録ID:${recordId}\n画像数:${images.length}\n\n全画像を比較し、植生構造、地表、水分、人為物、管理痕跡を具体的な画像証拠とasset_index付きで返してください。地域、土壌性質、長期的な湿潤状態、管理主体を推測しません。人物の属性や個人情報を書きません。fieldsは画像から支持できる選択肢だけを選び、根拠がなければunknownです。不在と画質等による判定不能をassessment_stateで分け、日本語、JSONのみを返してください。`;
  return { contents: [{ role: "user", parts: [...imageParts(images), { text: prompt }] }], generationConfig: generationConfig(GEMINI_ENVIRONMENT_SCHEMA, 2048, 0.1) };
}

export function buildGeminiSummaryRequest(recordId: string, merged: GeminiMergedObservation) {
  const evidence = { ...merged, candidate: merged.candidate, summary: undefined };
  const prompt = `以下は3つの専門レーン（主対象、別生物、環境）を決定的に統合した写真証拠JSONです。このJSONだけでikimon.life記録ページ向けの短い日本語説明を作ってください。新しい名前や事実を足さず、primaryと別対象を混ぜず、確定同定を避けます。各subjectを1件ずつ説明し、不確実性と次に撮る部位・角度を具体的にしてください。環境は写真で見える範囲に限定します。\n記録ID:${recordId}\n証拠JSON:${JSON.stringify(evidence)}`;
  return { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: generationConfig(GEMINI_SUMMARY_SCHEMA, 2048, 0.15) };
}

export type GeminiBatchRequest = { request: Record<string, unknown>; metadata: Record<string, unknown> };

export type GeminiBatchOperation = {
  name: string;
  displayName: string | null;
  state: string | null;
  batchStats: Record<string, unknown> | null;
  responses: unknown[];
  error: string | null;
};

const apiBase = "https://generativelanguage.googleapis.com/v1beta";

const operationFromJson = (value: unknown): GeminiBatchOperation => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("gemini_batch_response_invalid");
  const source = value as Record<string, unknown>;
  const metadata = source.metadata && typeof source.metadata === "object" && !Array.isArray(source.metadata)
    ? source.metadata as Record<string, unknown> : {};
  const response = source.response && typeof source.response === "object" && !Array.isArray(source.response)
    ? source.response as Record<string, unknown> : {};
  const output = (metadata.output && typeof metadata.output === "object" ? metadata.output : response.output && typeof response.output === "object" ? response.output : {}) as Record<string, unknown>;
  const inlined = output.inlinedResponses && typeof output.inlinedResponses === "object" && !Array.isArray(output.inlinedResponses)
    ? output.inlinedResponses as Record<string, unknown> : {};
  const responses = Array.isArray(inlined.inlinedResponses) ? inlined.inlinedResponses
    : Array.isArray(output.inlinedResponses) ? output.inlinedResponses
      : Array.isArray(response.inlinedResponses) ? response.inlinedResponses : [];
  const errorSource = (source.error && typeof source.error === "object" ? source.error : metadata.error && typeof metadata.error === "object" ? metadata.error : {}) as Record<string, unknown>;
  return {
    name: typeof source.name === "string" ? source.name : typeof metadata.name === "string" ? metadata.name : "",
    displayName: typeof metadata.displayName === "string" ? metadata.displayName : typeof source.displayName === "string" ? source.displayName : null,
    state: typeof metadata.state === "string" ? metadata.state : typeof source.state === "string" ? source.state : null,
    batchStats: metadata.batchStats && typeof metadata.batchStats === "object" ? metadata.batchStats as Record<string, unknown> : null,
    responses,
    error: typeof errorSource.message === "string" ? errorSource.message : null,
  };
};

async function apiJson(url: string, apiKey: string, init: RequestInit, fetcher: typeof fetch): Promise<unknown> {
  const response = await fetcher(url, { ...init, headers: { "content-type": "application/json", "x-goog-api-key": apiKey, ...(init.headers ?? {}) } });
  const value = await response.json().catch(() => null);
  if (!response.ok) {
    const message = value && typeof value === "object" && !Array.isArray(value)
      ? String(((value as Record<string, unknown>).error as Record<string, unknown> | undefined)?.message ?? `http_${response.status}`)
      : `http_${response.status}`;
    throw new Error(`gemini_batch_api_failed:${response.status}:${message.slice(0, 240)}`);
  }
  return value;
}

export async function createGeminiBatch(apiKey: string, model: string, displayName: string, requests: GeminiBatchRequest[], fetcher: typeof fetch = fetch): Promise<GeminiBatchOperation> {
  if (![GEMINI_PRIMARY_MODEL, GEMINI_ANALYSIS_MODEL, GEMINI_SUMMARY_MODEL].includes(model)) throw new Error(`gemini_model_not_allowed:${model}`);
  const value = await apiJson(`${apiBase}/models/${encodeURIComponent(model)}:batchGenerateContent`, apiKey, {
    method: "POST",
    body: JSON.stringify({ batch: { display_name: displayName, input_config: { requests: { requests } } } }),
  }, fetcher);
  const operation = operationFromJson(value);
  if (!operation.name.startsWith("batches/")) throw new Error("gemini_batch_name_missing");
  return operation;
}

export async function getGeminiBatch(apiKey: string, name: string, fetcher: typeof fetch = fetch): Promise<GeminiBatchOperation> {
  if (!/^batches\/[A-Za-z0-9_-]+$/u.test(name)) throw new Error("gemini_batch_name_invalid");
  return operationFromJson(await apiJson(`${apiBase}/${name}`, apiKey, { method: "GET" }, fetcher));
}

export async function findGeminiBatchByDisplayName(apiKey: string, displayName: string, fetcher: typeof fetch = fetch): Promise<GeminiBatchOperation | null> {
  const value = await apiJson(`${apiBase}/batches?pageSize=100`, apiKey, { method: "GET" }, fetcher);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const operations = (value as Record<string, unknown>).operations;
  if (!Array.isArray(operations)) return null;
  for (const item of operations) {
    const operation = operationFromJson(item);
    if (operation.displayName === displayName) return operation;
  }
  return null;
}

export function geminiBatchResponseText(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("gemini_batch_item_invalid");
  const source = value as Record<string, unknown>;
  const error = source.error && typeof source.error === "object" ? source.error as Record<string, unknown> : null;
  if (error) throw new Error(`gemini_batch_item_failed:${String(error.message ?? error.code ?? "unknown").slice(0, 180)}`);
  const response = source.response && typeof source.response === "object" ? source.response as Record<string, unknown> : source;
  const candidates = Array.isArray(response.candidates) ? response.candidates : [];
  const content = candidates[0] && typeof candidates[0] === "object" ? (candidates[0] as Record<string, unknown>).content : null;
  const parts = content && typeof content === "object" && !Array.isArray(content) && Array.isArray((content as Record<string, unknown>).parts)
    ? (content as Record<string, unknown>).parts as unknown[] : [];
  const text = parts.flatMap((part) => part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string" ? [(part as Record<string, unknown>).text as string] : []).join("");
  if (!text) throw new Error("gemini_batch_item_text_missing");
  return text;
}

const parseJson = <T>(text: string): T => {
  try { return JSON.parse(text) as T; } catch { throw new Error("gemini_batch_output_invalid_json"); }
};

export const parseGeminiPrimaryEvidence = (text: string): GeminiPrimaryEvidence => parseJson<GeminiPrimaryEvidence>(text);
export const parseGeminiCensusEvidence = (text: string): GeminiCensusEvidence => parseJson<GeminiCensusEvidence>(text);
export const parseGeminiEnvironmentEvidence = (text: string): GeminiEnvironmentEvidence => parseJson<GeminiEnvironmentEvidence>(text);
export const parseGeminiObservationSummary = (text: string): GeminiObservationSummary => parseJson<GeminiObservationSummary>(text);

const clipped = (value: unknown): number => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 0;
const short = (value: unknown, max = 160): string | null => typeof value === "string" && value.trim() ? value.trim().replace(/\s+/gu, " ").slice(0, max) : null;
const rankForCensus = (kind: GeminiCensusGroup["kind"]): ObservationAiSubjectCandidate["rank"] => kind === "plant" ? "lifeform" : kind === "animal" ? "class" : "unknown";

const locatorFor = (subjectId: string, regions: GeminiRegion[], imageCount: number) => {
  const region = regions.find((item) => item.subject_id === subjectId && item.asset_index >= 0 && item.asset_index < imageCount);
  if (!region) return { assetIndex: 0, subjectLocator: {} };
  const x = clipped(region.x); const y = clipped(region.y); const width = clipped(region.width); const height = clipped(region.height);
  if (width <= 0 || height <= 0 || x + width > 1.001 || y + height > 1.001) return { assetIndex: region.asset_index, subjectLocator: {} };
  return { assetIndex: region.asset_index, subjectLocator: { rect: { x, y, width, height } } };
};

const normalizeName = (value: string | null): string => (value ?? "").normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/[\s・_\-]/gu, "");

export function mergeGeminiObservationEvidence(primary: GeminiPrimaryEvidence, census: GeminiCensusEvidence, environment: GeminiEnvironmentEvidence, imageCount: number): GeminiMergedObservation {
  const primarySource = primary.subjects.find((subject) => subject.role === "primary") ?? primary.subjects[0] ?? null;
  const censusPrimary = census.groups.find((group) => group.role === "primary") ?? census.groups[0] ?? null;
  const subjects: ObservationAiSubjectCandidate[] = [];
  if (primarySource && (short(primarySource.name) || short(primarySource.scientific))) {
    const located = locatorFor(primarySource.id, primary.regions, imageCount);
    subjects.push({
      candidateKey: short(primarySource.id, 80), vernacularName: short(primarySource.name, 120), scientificName: short(primarySource.scientific, 180),
      rank: primarySource.rank, confidence: clipped(primarySource.confidence), visualEvidence: short(primarySource.evidence) ? [short(primarySource.evidence)!] : [], needsMoreEvidence: [],
      ...located, sourceModel: GEMINI_PRIMARY_MODEL,
    });
  } else if (censusPrimary && short(censusPrimary.label)) {
    const censusRegions = census.regions.map((region) => ({ ...region, subject_id: region.group_id }));
    const located = locatorFor(censusPrimary.id, censusRegions, imageCount);
    subjects.push({ candidateKey: short(censusPrimary.id, 80), vernacularName: short(censusPrimary.label, 120), scientificName: null, rank: rankForCensus(censusPrimary.kind), confidence: clipped(censusPrimary.confidence), visualEvidence: short(censusPrimary.evidence) ? [short(censusPrimary.evidence)!] : [], needsMoreEvidence: [], ...located, sourceModel: GEMINI_ANALYSIS_MODEL });
  }
  const primaryNames = new Set(subjects.flatMap((subject) => [normalizeName(subject.vernacularName), normalizeName(subject.scientificName)]).filter(Boolean));
  const censusRegions = census.regions.map((region) => ({ ...region, subject_id: region.group_id }));
  for (const group of census.groups.filter((item) => item.role === "other")) {
    const name = short(group.label, 120);
    if (!name || primaryNames.has(normalizeName(name))) continue;
    const located = locatorFor(group.id, censusRegions, imageCount);
    subjects.push({ candidateKey: `census:${short(group.id, 70) ?? subjects.length}`, vernacularName: name, scientificName: null, rank: rankForCensus(group.kind), confidence: clipped(group.confidence), visualEvidence: short(group.evidence) ? [short(group.evidence)!] : [], needsMoreEvidence: [], ...located, sourceModel: GEMINI_ANALYSIS_MODEL });
  }
  for (const extra of primary.subjects.filter((item) => item.role !== "primary")) {
    const name = short(extra.name, 120) ?? short(extra.scientific, 180);
    if (!name || subjects.some((subject) => normalizeName(subject.vernacularName) === normalizeName(name) || normalizeName(subject.scientificName) === normalizeName(name))) continue;
    const located = locatorFor(extra.id, primary.regions, imageCount);
    subjects.push({ candidateKey: short(extra.id, 80), vernacularName: short(extra.name, 120), scientificName: short(extra.scientific, 180), rank: extra.rank, confidence: clipped(extra.confidence), visualEvidence: short(extra.evidence) ? [short(extra.evidence)!] : [], needsMoreEvidence: [], ...located, sourceModel: GEMINI_PRIMARY_MODEL });
  }
  const [main, ...coexisting] = subjects.slice(0, 8);
  const detectionState = subjects.length > 0 ? "detected" : census.detection_state === "not_assessable" || primary.information_state === "not_assessable" ? "not_assessable" : "not_detected";
  return {
    candidate: {
      candidateKey: main?.candidateKey ?? null, vernacularName: main?.vernacularName ?? null, scientificName: main?.scientificName ?? null,
      rank: main?.rank ?? "unknown", confidence: main?.confidence ?? 0, visualEvidence: main?.visualEvidence ?? [], needsMoreEvidence: main?.needsMoreEvidence ?? [],
      assetIndex: main?.assetIndex ?? 0, subjectLocator: main?.subjectLocator ?? {}, sourceModel: main?.sourceModel ?? GEMINI_PRIMARY_MODEL,
      nonBiological: subjects.length === 0, coexistingSubjects: coexisting,
    },
    recordClass: primary.record_class,
    informationState: primary.information_state,
    detectionState,
    environment,
    relations: census.relations.slice(0, 6),
    qualityFlags: primary.quality_flags.slice(0, 8),
    needsReview: Boolean(primary.needs_review || census.needs_review),
    reviewReasons: [...primary.review_reasons, ...census.review_reasons].slice(0, 8),
    summary: null,
  };
}

export function applyGeminiObservationSummary(merged: GeminiMergedObservation, summary: GeminiObservationSummary): GeminiMergedObservation {
  const byId = new Map(summary.subject_explanations.map((item) => [item.subject_id, item]));
  const enrich = (subject: ObservationAiSubjectCandidate): ObservationAiSubjectCandidate => {
    const explanation = byId.get(subject.candidateKey ?? "") ?? summary.subject_explanations.find((item) => normalizeName(item.title) === normalizeName(subject.vernacularName));
    if (!explanation) return subject;
    return {
      ...subject,
      visualEvidence: [...subject.visualEvidence, ...[short(explanation.explanation), short(explanation.uncertainty)].filter((item): item is string => Boolean(item))].slice(0, 4),
      needsMoreEvidence: [...subject.needsMoreEvidence, ...[short(explanation.next_photo)].filter((item): item is string => Boolean(item))].slice(0, 4),
    };
  };
  const main = enrich(merged.candidate);
  return { ...merged, candidate: { ...merged.candidate, ...main, coexistingSubjects: merged.candidate.coexistingSubjects.map(enrich) }, summary };
}

export function geminiBatchDisplayName(claimId: string, lane: "primary" | "analysis" | "summary"): string {
  return `ikimon-observation-${GEMINI_OBSERVATION_RULE_VERSION.replace(/[^A-Za-z0-9-]/gu, "-")}-${claimId}-${lane}`.slice(0, 120);
}
