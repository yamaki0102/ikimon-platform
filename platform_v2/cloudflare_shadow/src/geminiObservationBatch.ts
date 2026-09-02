import {
  type ObservationAiCandidate,
  type ObservationAiSubjectCandidate,
} from "./cloudflareObservationAi";

export const GEMINI_PRIMARY_MODEL = "gemini-3.5-flash-lite";
export const GEMINI_ANALYSIS_MODEL = "gemini-3.1-flash-lite";
export const GEMINI_SPECIALIST_MODEL = "gemini-3.5-flash-lite";
export const GEMINI_SUMMARY_MODEL = "gemini-3.1-flash-lite";
export const GEMINI_OBSERVATION_PROMPT_VERSION = "observation-triple-lane/v3";
export const GEMINI_OBSERVATION_RULE_VERSION = "record-observation-gemini-batch/v2";
export const GEMINI_CANDIDATE_FUSION_RULE_VERSION = "candidate-fusion/v1";
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
  scientific?: string;
  rank?: ObservationAiSubjectCandidate["rank"];
  evidence: string;
  supporting_features?: string[];
  missing_features?: string[];
  contradictions?: string[];
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

export type GeminiCandidateSourceLane = "primary" | "census" | "specialist";

export type GeminiFusedCandidate = {
  candidateKey: string | null;
  name: string | null;
  scientificName: string | null;
  rank: ObservationAiSubjectCandidate["rank"];
  confidence: number;
  supportingFeatures: string[];
  missingFeatures: string[];
  contradictions: string[];
  sourceLanes: GeminiCandidateSourceLane[];
  sourceModels: string[];
  sourceAssetIndices: number[];
  subjectLocator: ObservationAiSubjectCandidate["subjectLocator"];
  fusionScore: number;
};

export type GeminiSpecialistKind = "bird" | "plant" | "insect" | "general";

export type GeminiSpecialistEvidence = {
  assessment_state: GeminiInformationState;
  candidates: Array<{
    name: string;
    scientific: string;
    rank: ObservationAiSubjectCandidate["rank"];
    confidence: number;
    supporting_features: string[];
    missing_features: string[];
    contradictions: string[];
  }>;
  comparison_summary: string;
  needs_review: boolean;
};

export type GeminiSpecialistEscalation = {
  required: boolean;
  reasons: string[];
  specialistKind: GeminiSpecialistKind;
  largestPrimaryRegionRatio: number;
};

export type GeminiMergedObservation = {
  candidate: ObservationAiCandidate;
  topCandidates: GeminiFusedCandidate[];
  genericCandidateOnly: boolean;
  candidateFusionRuleVersion: typeof GEMINI_CANDIDATE_FUSION_RULE_VERSION;
  recordClass: GeminiRecordClass;
  informationState: GeminiInformationState;
  detectionState: "detected" | "not_detected" | "not_assessable";
  environment: GeminiEnvironmentEvidence;
  relations: string[];
  qualityFlags: string[];
  needsReview: boolean;
  reviewReasons: string[];
  specialistEscalation: GeminiSpecialistEscalation | null;
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
      count: { type: "INTEGER", minimum: 0 }, label: { type: "STRING" }, scientific: { type: "STRING" },
      rank: { type: "STRING", enum: ["species", "genus", "family", "order", "class", "lifeform", "unknown"] },
      evidence: { type: "STRING" },
      supporting_features: { type: "ARRAY", maxItems: 6, items: { type: "STRING" } },
      missing_features: { type: "ARRAY", maxItems: 6, items: { type: "STRING" } },
      contradictions: { type: "ARRAY", maxItems: 6, items: { type: "STRING" } },
      confidence: { type: "NUMBER", minimum: 0, maximum: 1 },
    }, required: ["id", "kind", "role", "scope", "count", "label", "scientific", "rank", "evidence", "supporting_features", "missing_features", "contradictions", "confidence"] } },
    regions: { type: "ARRAY", maxItems: 16, items: { type: "OBJECT", properties: { group_id: { type: "STRING" }, ...rectProperties }, required: ["group_id", "asset_index", "x", "y", "width", "height"] } },
    relations: { type: "ARRAY", maxItems: 6, items: { type: "STRING" } },
    needs_review: { type: "BOOLEAN" }, review_reasons: { type: "ARRAY", maxItems: 6, items: { type: "STRING" } },
  },
  required: ["detection_state", "scene", "groups", "regions", "relations", "needs_review", "review_reasons"],
};

export const GEMINI_SPECIALIST_SCHEMA: JsonSchema = {
  type: "OBJECT",
  properties: {
    assessment_state: { type: "STRING", enum: ["informative", "not_informative", "not_assessable"] },
    candidates: {
      type: "ARRAY",
      maxItems: 5,
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          scientific: { type: "STRING" },
          rank: { type: "STRING", enum: ["species", "genus", "family", "order", "class", "lifeform", "unknown"] },
          confidence: { type: "NUMBER", minimum: 0, maximum: 1 },
          supporting_features: { type: "ARRAY", maxItems: 8, items: { type: "STRING" } },
          missing_features: { type: "ARRAY", maxItems: 8, items: { type: "STRING" } },
          contradictions: { type: "ARRAY", maxItems: 8, items: { type: "STRING" } },
        },
        required: ["name", "scientific", "rank", "confidence", "supporting_features", "missing_features", "contradictions"],
      },
    },
    comparison_summary: { type: "STRING" },
    needs_review: { type: "BOOLEAN" },
  },
  required: ["assessment_state", "candidates", "comparison_summary", "needs_review"],
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
  temperature: 1,
  maxOutputTokens,
  responseMimeType: "application/json",
  responseSchema: schema,
  thinkingConfig: { thinkingLevel: "minimal" },
});

export function buildGeminiPrimaryRequest(recordId: string, observedAt: string | null, images: GeminiObservationImage[]) {
  const prompt = `あなたはikimon.lifeの公開記録写真から、主対象と写真全体の分類を短く構造化する視覚抽出器です。\n記録ID:${recordId}\n観察日:${observedAt ?? "不明"}\n画像数:${images.length}\n\n全画像を比較し、同じ対象は統合してください。主対象は1件だけprimaryにし、別生物も見落とさないでください。種の識別特徴が足りなければ属・科・目・生活型で止めます。人物、食べ物、環境風景、物、文書もrecord_classへ分類しますが、人物の容姿・属性・個人情報は記述しません。非生物をsubjectsへ入れません。information_stateは、判読できる情報があればinformative、何も有用に読めなければnot_informative、画質等で判定不能ならnot_assessableです。領域は正規化座標で返し、日本語、JSONのみを返してください。`;
  return { contents: [{ role: "user", parts: [...imageParts(images), { text: prompt }] }], generationConfig: generationConfig(GEMINI_PRIMARY_SCHEMA, 2048, 0.1) };
}

export function buildGeminiCensusRequest(recordId: string, images: GeminiObservationImage[]) {
  const prompt = `公開された市民科学写真の「個体・別生物の棚卸し」だけをしてください。長い分類解説は不要です。\n記録ID:${recordId}\n画像数:${images.length}\n\n全画像を横断し、同じ個体は1 groupへ統合します。同分類群の複数個体はscope=group、分かる範囲でcountへ。主対象以外の独立した昆虫、鳥、植物、菌、痕跡、寄主植物、異なる形態の背景植物もotherへ入れます。同じ対象の別名候補は別groupにせず、石、舗装、フェンス、建物、影、食べ物、人物はgroupにしません。画像から支持できるname、scientific、rankを返し、種名を無理につけず属・科・目・綱・生活型の見える粒度に止めます。supporting_featuresは見える決定形質、missing_featuresは確認できない比較点、contradictionsは候補と矛盾する形質です。primaryは1 groupだけ、領域をasset_index付きで返してください。判定不能と不在を区別し、日本語、JSONのみを返してください。`;
  return { contents: [{ role: "user", parts: [...imageParts(images), { text: prompt }] }], generationConfig: generationConfig(GEMINI_CENSUS_SCHEMA, 2048, 0.1) };
}

export function buildGeminiEnvironmentRequest(recordId: string, images: GeminiObservationImage[]) {
  const prompt = `公開写真から、環境・場所の「写っている証拠」だけを棚卸ししてください。生物同定や一般知識による生息地推測は不要です。\n記録ID:${recordId}\n画像数:${images.length}\n\n全画像を比較し、植生構造、地表、水分、人為物、管理痕跡を具体的な画像証拠とasset_index付きで返してください。地域、土壌性質、長期的な湿潤状態、管理主体を推測しません。人物の属性や個人情報を書きません。fieldsは画像から支持できる選択肢だけを選び、根拠がなければunknownです。不在と画質等による判定不能をassessment_stateで分け、日本語、JSONのみを返してください。`;
  return { contents: [{ role: "user", parts: [...imageParts(images), { text: prompt }] }], generationConfig: generationConfig(GEMINI_ENVIRONMENT_SCHEMA, 2048, 0.1) };
}

const specialistTraits: Record<GeminiSpecialistKind, string> = {
  bird: "嘴の形と太さ、頭頂と冠羽、眼・眉斑・耳斑、喉・胸・腹の模様、翼帯、尾の長さと形、脚色、幼鳥羽と成鳥羽、止まり方を比較してください。幼鳥か雌成鳥かは画像証拠が足りなければ断定しません。",
  plant: "葉序、葉縁、葉脈、花冠、雄しべ、果実、樹皮、草本・木本、植栽・野生の文脈を比較してください。",
  insect: "翅脈、斑紋、触角、脚、胸部、腹部、静止姿勢、寄主植物、訪花・摂食の関係を比較してください。",
  general: "形、色、模様、付属器官、姿勢、対象領域、別角度で一貫する特徴を比較してください。",
};

export function buildGeminiSpecialistRequest(
  recordId: string,
  specialistKind: GeminiSpecialistKind,
  images: GeminiObservationImage[],
  merged: GeminiMergedObservation,
) {
  const evidence = {
    topCandidates: merged.topCandidates,
    candidate: merged.candidate,
    qualityFlags: merged.qualityFlags,
    reviewReasons: merged.reviewReasons,
  };
  const prompt = `公開された市民科学写真の同一主対象について、候補比較だけをしてください。別名候補を別個体・別subjectとして扱いません。\n記録ID:${recordId}\n専門分類:${specialistKind}\n画像数:${images.length}\n前段証拠:${JSON.stringify(evidence)}\n\n${specialistTraits[specialistKind]}\n最大5候補を、支持形質、不足形質、矛盾点とともに返してください。粗い汎用名だけで終えず、証拠が足りなければ無理に種へ固定せず適切なrankで止めます。人物の属性や個人情報、画像にない地域・季節情報を推測せず、AI候補であって確定同定ではない前提を守り、日本語、JSONのみを返してください。`;
  return {
    contents: [{ role: "user", parts: [...imageParts(images), { text: prompt }] }],
    generationConfig: generationConfig(GEMINI_SPECIALIST_SCHEMA, 2048, 0.1),
  };
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
export const parseGeminiSpecialistEvidence = (text: string): GeminiSpecialistEvidence => parseJson<GeminiSpecialistEvidence>(text);

const clipped = (value: unknown): number => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 0;
const short = (value: unknown, max = 160): string | null => typeof value === "string" && value.trim() ? value.trim().replace(/\s+/gu, " ").slice(0, max) : null;
const rankForCensus = (group: GeminiCensusGroup): ObservationAiSubjectCandidate["rank"] => {
  const allowed = new Set<ObservationAiSubjectCandidate["rank"]>(["species", "genus", "family", "order", "class", "lifeform", "unknown"]);
  if (group.rank && allowed.has(group.rank)) return group.rank;
  return group.kind === "plant" ? "lifeform" : group.kind === "animal" ? "class" : "unknown";
};

const locatorFor = (subjectId: string, regions: GeminiRegion[], imageCount: number) => {
  const region = regions.find((item) => item.subject_id === subjectId && item.asset_index >= 0 && item.asset_index < imageCount);
  if (!region) return { assetIndex: 0, subjectLocator: {} };
  const x = clipped(region.x); const y = clipped(region.y); const width = clipped(region.width); const height = clipped(region.height);
  if (width <= 0 || height <= 0 || x + width > 1.001 || y + height > 1.001) return { assetIndex: region.asset_index, subjectLocator: {} };
  return { assetIndex: region.asset_index, subjectLocator: { rect: { x, y, width, height } } };
};

const normalizeName = (value: string | null): string => (value ?? "").normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/[\s・_\-]/gu, "");

const genericCandidateNames = new Set([
  "鳥",
  "鳥類",
  "小鳥",
  "動物",
  "生きもの",
  "生き物",
  "生物",
  "植物",
  "草",
  "木",
  "写っているもの",
  "unknown",
  "unidentified",
  "unclassified",
].map((value) => normalizeName(value)));

const rankWeight: Record<ObservationAiSubjectCandidate["rank"], number> = {
  species: 6,
  genus: 5,
  family: 4,
  order: 3,
  class: 2,
  lifeform: 1,
  unknown: 0,
};

const laneOrder: Record<GeminiCandidateSourceLane, number> = {
  specialist: 0,
  primary: 1,
  census: 2,
};

const uniqueText = (values: Array<string | null | undefined>, max = 8): string[] => (
  [...new Set(values.map((value) => short(value)).filter((value): value is string => Boolean(value)))].slice(0, max)
);

const isGenericCandidateName = (name: string | null): boolean => {
  const normalized = normalizeName(name);
  return !normalized || genericCandidateNames.has(normalized);
};

const fusionScore = (candidate: Omit<GeminiFusedCandidate, "fusionScore">): number => {
  const genericPenalty = isGenericCandidateName(candidate.name ?? candidate.scientificName) ? 8 : 0;
  const evidenceBonus = Math.min(0.6, candidate.supportingFeatures.length * 0.15);
  const regionBonus = candidate.subjectLocator.rect ? 0.5 : 0;
  const scientificBonus = candidate.scientificName ? 0.15 : 0;
  const contradictionPenalty = Math.min(0.75, candidate.contradictions.length * 0.15);
  return Number((
    rankWeight[candidate.rank]
    + candidate.confidence * 1.5
    + evidenceBonus
    + regionBonus
    + scientificBonus
    - contradictionPenalty
    - genericPenalty
  ).toFixed(4));
};

const withFusionScore = (candidate: Omit<GeminiFusedCandidate, "fusionScore">): GeminiFusedCandidate => ({
  ...candidate,
  fusionScore: fusionScore(candidate),
});

const primaryFusedCandidate = (
  subject: GeminiPrimarySubject,
  regions: GeminiRegion[],
  imageCount: number,
): GeminiFusedCandidate | null => {
  const name = short(subject.name, 120);
  const scientificName = short(subject.scientific, 180);
  if (!name && !scientificName) return null;
  const located = locatorFor(subject.id, regions, imageCount);
  return withFusionScore({
    candidateKey: short(subject.id, 80),
    name,
    scientificName,
    rank: subject.rank,
    confidence: clipped(subject.confidence),
    supportingFeatures: uniqueText([subject.evidence]),
    missingFeatures: [],
    contradictions: [],
    sourceLanes: ["primary"],
    sourceModels: [GEMINI_PRIMARY_MODEL],
    sourceAssetIndices: [located.assetIndex],
    subjectLocator: located.subjectLocator,
  });
};

const censusFusedCandidate = (
  group: GeminiCensusGroup,
  regions: GeminiRegion[],
  imageCount: number,
): GeminiFusedCandidate | null => {
  const name = short(group.label, 120);
  const scientificName = short(group.scientific, 180);
  if (!name && !scientificName) return null;
  const located = locatorFor(group.id, regions, imageCount);
  return withFusionScore({
    candidateKey: short(group.id, 80),
    name,
    scientificName,
    rank: rankForCensus(group),
    confidence: clipped(group.confidence),
    supportingFeatures: uniqueText([group.evidence, ...(group.supporting_features ?? [])]),
    missingFeatures: uniqueText(group.missing_features ?? []),
    contradictions: uniqueText(group.contradictions ?? []),
    sourceLanes: ["census"],
    sourceModels: [GEMINI_ANALYSIS_MODEL],
    sourceAssetIndices: [located.assetIndex],
    subjectLocator: located.subjectLocator,
  });
};

const sameCandidateName = (left: GeminiFusedCandidate, right: GeminiFusedCandidate): boolean => {
  const leftNames = [normalizeName(left.name), normalizeName(left.scientificName)].filter(Boolean);
  const rightNames = new Set([normalizeName(right.name), normalizeName(right.scientificName)].filter(Boolean));
  return leftNames.some((name) => rightNames.has(name));
};

const mergeFusedCandidates = (candidates: GeminiFusedCandidate[]): GeminiFusedCandidate[] => {
  const merged: GeminiFusedCandidate[] = [];
  for (const candidate of candidates) {
    const existingIndex = merged.findIndex((existing) => sameCandidateName(existing, candidate));
    if (existingIndex < 0) {
      merged.push(candidate);
      continue;
    }
    const existing = merged[existingIndex]!;
    const preferred = candidate.fusionScore > existing.fusionScore ? candidate : existing;
    merged[existingIndex] = withFusionScore({
      ...preferred,
      confidence: Math.max(existing.confidence, candidate.confidence),
      supportingFeatures: uniqueText([...existing.supportingFeatures, ...candidate.supportingFeatures]),
      missingFeatures: uniqueText([...existing.missingFeatures, ...candidate.missingFeatures]),
      contradictions: uniqueText([...existing.contradictions, ...candidate.contradictions]),
      sourceLanes: [...new Set([...existing.sourceLanes, ...candidate.sourceLanes])]
        .sort((left, right) => laneOrder[left] - laneOrder[right]),
      sourceModels: uniqueText([...existing.sourceModels, ...candidate.sourceModels], 4),
      sourceAssetIndices: [...new Set([
        ...preferred.sourceAssetIndices,
        ...existing.sourceAssetIndices,
        ...candidate.sourceAssetIndices,
      ])],
    });
  }
  return merged.sort((left, right) => (
    right.fusionScore - left.fusionScore
    || right.confidence - left.confidence
    || (left.name ?? left.scientificName ?? "").localeCompare(right.name ?? right.scientificName ?? "", "ja")
  ));
};

const subjectFromFusedCandidate = (candidate: GeminiFusedCandidate): ObservationAiSubjectCandidate => ({
  candidateKey: candidate.candidateKey,
  vernacularName: candidate.name,
  scientificName: candidate.scientificName,
  rank: candidate.rank,
  confidence: candidate.confidence,
  visualEvidence: candidate.supportingFeatures.slice(0, 4),
  needsMoreEvidence: candidate.missingFeatures.slice(0, 4),
  assetIndex: candidate.sourceAssetIndices[0] ?? 0,
  sourceModel: candidate.sourceModels[0],
  subjectLocator: candidate.subjectLocator,
});

export function mergeGeminiObservationEvidence(primary: GeminiPrimaryEvidence, census: GeminiCensusEvidence, environment: GeminiEnvironmentEvidence, imageCount: number): GeminiMergedObservation {
  const primarySource = primary.subjects.find((subject) => subject.role === "primary") ?? primary.subjects[0] ?? null;
  const censusPrimary = census.groups.find((group) => group.role === "primary") ?? census.groups[0] ?? null;
  const censusRegions = census.regions.map((region) => ({ ...region, subject_id: region.group_id }));
  const topCandidates = mergeFusedCandidates([
    ...(primarySource ? [primaryFusedCandidate(primarySource, primary.regions, imageCount)] : []),
    ...(censusPrimary ? [censusFusedCandidate(censusPrimary, censusRegions, imageCount)] : []),
  ].filter((candidate): candidate is GeminiFusedCandidate => candidate !== null)).slice(0, 5);
  const main = topCandidates[0] ? subjectFromFusedCandidate(topCandidates[0]) : null;
  const alternativeNames = new Set(
    topCandidates.flatMap((candidate) => [normalizeName(candidate.name), normalizeName(candidate.scientificName)]).filter(Boolean),
  );
  const coexisting: ObservationAiSubjectCandidate[] = [];
  for (const group of census.groups.filter((item) => item.role === "other")) {
    const fused = censusFusedCandidate(group, censusRegions, imageCount);
    if (!fused || [normalizeName(fused.name), normalizeName(fused.scientificName)].some((name) => name && alternativeNames.has(name))) continue;
    const subject = subjectFromFusedCandidate({ ...fused, candidateKey: `census:${short(group.id, 70) ?? coexisting.length}` });
    if (coexisting.some((item) => normalizeName(item.vernacularName) === normalizeName(subject.vernacularName) || normalizeName(item.scientificName) === normalizeName(subject.scientificName))) continue;
    coexisting.push(subject);
  }
  for (const extra of primary.subjects.filter((item) => item.role !== "primary")) {
    const fused = primaryFusedCandidate(extra, primary.regions, imageCount);
    if (!fused || [normalizeName(fused.name), normalizeName(fused.scientificName)].some((name) => name && alternativeNames.has(name))) continue;
    const subject = subjectFromFusedCandidate(fused);
    if (coexisting.some((item) => normalizeName(item.vernacularName) === normalizeName(subject.vernacularName) || normalizeName(item.scientificName) === normalizeName(subject.scientificName))) continue;
    coexisting.push(subject);
  }
  const detectionState = main || coexisting.length > 0 ? "detected" : census.detection_state === "not_assessable" || primary.information_state === "not_assessable" ? "not_assessable" : "not_detected";
  return {
    candidate: {
      candidateKey: main?.candidateKey ?? null, vernacularName: main?.vernacularName ?? null, scientificName: main?.scientificName ?? null,
      rank: main?.rank ?? "unknown", confidence: main?.confidence ?? 0, visualEvidence: main?.visualEvidence ?? [], needsMoreEvidence: main?.needsMoreEvidence ?? [],
      assetIndex: main?.assetIndex ?? 0, subjectLocator: main?.subjectLocator ?? {}, sourceModel: main?.sourceModel ?? GEMINI_PRIMARY_MODEL,
      nonBiological: !main && coexisting.length === 0, coexistingSubjects: coexisting.slice(0, 7),
    },
    topCandidates,
    genericCandidateOnly: topCandidates.length > 0 && topCandidates.every((candidate) => isGenericCandidateName(candidate.name ?? candidate.scientificName)),
    candidateFusionRuleVersion: GEMINI_CANDIDATE_FUSION_RULE_VERSION,
    recordClass: primary.record_class,
    informationState: primary.information_state,
    detectionState,
    environment,
    relations: census.relations.slice(0, 6),
    qualityFlags: primary.quality_flags.slice(0, 8),
    needsReview: Boolean(primary.needs_review || census.needs_review),
    reviewReasons: [...primary.review_reasons, ...census.review_reasons].slice(0, 8),
    specialistEscalation: null,
    summary: null,
  };
}

const regionArea = (region: GeminiRegion | undefined): number => region
  ? clipped(region.width) * clipped(region.height)
  : 0;

const inferSpecialistKind = (
  primary: GeminiPrimaryEvidence,
  census: GeminiCensusEvidence,
): GeminiSpecialistKind => {
  const labels = [
    ...primary.subjects.flatMap((subject) => [subject.name, subject.scientific]),
    ...census.groups.flatMap((group) => [group.label, group.scientific ?? ""]),
  ].join(" ").normalize("NFKC").toLocaleLowerCase("ja-JP");
  if (/(鳥|bird|aves|ヒヨドリ|ムクドリ|ツグミ|スズメ)/u.test(labels)) return "bird";
  if (/(昆虫|insect|蝶|チョウ|蛾|ガ|蜂|ハチ|甲虫|トンボ|セミ)/u.test(labels)) return "insect";
  if (census.groups.some((group) => group.kind === "plant") || /(植物|草|木|花|plant)/u.test(labels)) return "plant";
  return "general";
};

export function decideGeminiSpecialistEscalation(
  merged: GeminiMergedObservation,
  primary: GeminiPrimaryEvidence,
  census: GeminiCensusEvidence,
): GeminiSpecialistEscalation {
  const primaryId = primary.subjects.find((subject) => subject.role === "primary")?.id;
  const censusId = census.groups.find((group) => group.role === "primary")?.id;
  const largestPrimaryRegionRatio = Math.max(
    0,
    ...primary.regions.filter((region) => region.subject_id === primaryId).map(regionArea),
    ...census.regions.filter((region) => region.group_id === censusId).map((region) => regionArea({ ...region, subject_id: region.group_id })),
  );
  const reasons: string[] = [];
  const primaryCandidate = merged.topCandidates.find((candidate) => candidate.sourceLanes.includes("primary"));
  const censusCandidate = merged.topCandidates.find((candidate) => candidate.sourceLanes.includes("census"));
  if (
    primaryCandidate
    && censusCandidate
    && !sameCandidateName(primaryCandidate, censusCandidate)
    && primaryCandidate.confidence >= 0.4
    && censusCandidate.confidence >= 0.4
  ) {
    reasons.push("lane_candidate_conflict");
  }
  if (largestPrimaryRegionRatio >= 0.035 && ["order", "class", "lifeform", "unknown"].includes(merged.candidate.rank)) {
    reasons.push("coarse_rank_with_visible_region");
  }
  if (largestPrimaryRegionRatio >= 0.035 && merged.genericCandidateOnly) {
    reasons.push("generic_label_with_visible_region");
  }
  if (merged.needsReview && largestPrimaryRegionRatio >= 0.08 && (merged.genericCandidateOnly || merged.candidate.rank !== "species")) {
    reasons.push("review_requested_for_visible_subject");
  }
  return {
    required: reasons.length > 0,
    reasons,
    specialistKind: inferSpecialistKind(primary, census),
    largestPrimaryRegionRatio: Number(largestPrimaryRegionRatio.toFixed(4)),
  };
}

export function applyGeminiSpecialistEvidence(
  merged: GeminiMergedObservation,
  specialist: GeminiSpecialistEvidence,
): GeminiMergedObservation {
  const sourceAssetIndex = merged.candidate.assetIndex ?? 0;
  const specialistCandidates = specialist.candidates.slice(0, 5).map((candidate, index) => withFusionScore({
    candidateKey: `specialist:${index}:${normalizeName(short(candidate.name, 80)) || "candidate"}`,
    name: short(candidate.name, 120),
    scientificName: short(candidate.scientific, 180),
    rank: candidate.rank,
    confidence: clipped(candidate.confidence),
    supportingFeatures: uniqueText(candidate.supporting_features ?? []),
    missingFeatures: uniqueText(candidate.missing_features ?? []),
    contradictions: uniqueText(candidate.contradictions ?? []),
    sourceLanes: ["specialist"],
    sourceModels: [GEMINI_SPECIALIST_MODEL],
    sourceAssetIndices: [sourceAssetIndex],
    subjectLocator: merged.candidate.subjectLocator,
  }));
  const topCandidates = mergeFusedCandidates([...specialistCandidates, ...merged.topCandidates]).slice(0, 5);
  const top = topCandidates[0];
  if (!top) return merged;
  const main = subjectFromFusedCandidate(top);
  const birdComparison = topCandidates.some((candidate) => /(鳥|ドリ|ツグミ|スズメ)/u.test(candidate.name ?? ""));
  return {
    ...merged,
    candidate: {
      ...merged.candidate,
      ...main,
      nonBiological: false,
      coexistingSubjects: merged.candidate.coexistingSubjects,
    },
    topCandidates,
    genericCandidateOnly: topCandidates.every((candidate) => isGenericCandidateName(candidate.name ?? candidate.scientificName)),
    needsReview: merged.needsReview || specialist.needs_review,
    reviewReasons: uniqueText([
      ...merged.reviewReasons,
      specialist.comparison_summary,
      birdComparison ? "幼鳥か雌成鳥かは画像だけで断定しない" : null,
    ]),
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

export function geminiBatchDisplayName(claimId: string, lane: "primary" | "analysis" | "specialist" | "summary"): string {
  return `ikimon-observation-${GEMINI_OBSERVATION_RULE_VERSION.replace(/[^A-Za-z0-9-]/gu, "-")}-${claimId}-${lane}`.slice(0, 120);
}
