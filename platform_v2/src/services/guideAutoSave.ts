import type { GuideMode, SceneResult } from "./guideSession.js";
import type { SiteBrief } from "./siteBrief.js";

export type GuideAutoSaveDecision = {
  decision: "save" | "skip";
  confidence: number;
  reasonCodes: string[];
  note: string;
};

type AutoSaveInput = {
  result: SceneResult;
  siteBrief?: Pick<SiteBrief, "hypothesis" | "signals"> | null;
  guideMode?: GuideMode;
};

const PRIVACY_OR_INDOOR_RE = /(?:室内|屋内|部屋|自室|家の中|店内|車内|天井|蛍光灯|照明|机|テーブル|椅子|壁|床|モニター|パソコン|キーボード|人物|人間|人の顔|顔|自撮り|indoor|room|ceiling|fluorescent|desk|table|chair|wall|floor|monitor|keyboard|person|people|human|face|selfie)/i;
const NATURE_WORD_RE = /(?:草|木|葉|花|実|樹|林|竹|苔|藻|菌|虫|鳥|魚|哺乳|爬虫|両生|貝|水辺|川|池|湿地|土|砂|岩|風|鳴き声|vegetation|plant|leaf|flower|tree|grass|moss|insect|bird|fish|mammal|reptile|amphibian|water|river|pond|wetland|soil|rock|natural)/i;

function sceneText(result: SceneResult): string {
  return [
    result.summary,
    result.primarySubject?.name,
    result.environmentContext,
    result.seasonalNote,
    ...(result.detectedSpecies ?? []),
    ...(result.coexistingTaxa ?? []),
    ...(result.detectedFeatures ?? []).flatMap((feature) => [feature.type, feature.name, feature.note ?? ""]),
    result.saveRecommendation?.note,
    ...(result.saveRecommendation?.reasonCodes ?? []),
  ].filter(Boolean).join(" ");
}

function modelWantsSkip(result: SceneResult): boolean {
  const recommendation = result.saveRecommendation;
  return recommendation?.decision === "skip" && (recommendation.confidence ?? 0) >= 0.6;
}

function hasNatureSignal(result: SceneResult): boolean {
  if ((result.detectedSpecies ?? []).length > 0) return true;
  const natureFeature = (result.detectedFeatures ?? []).some((feature) => {
    if (feature.type === "species" || feature.type === "vegetation" || feature.type === "landform" || feature.type === "sound") {
      return (feature.confidence ?? 0.5) >= 0.35;
    }
    return false;
  });
  if (natureFeature) return true;
  return NATURE_WORD_RE.test(sceneText(result));
}

function hasVehicleModeFieldSignal(result: SceneResult): boolean {
  if ((result.detectedSpecies ?? []).length > 0) return true;
  return (result.detectedFeatures ?? []).some((feature) => {
    if (feature.type !== "vegetation" && feature.type !== "landform" && feature.type !== "sound") return false;
    return (feature.confidence ?? 0.5) >= 0.35;
  }) || NATURE_WORD_RE.test([
    result.summary,
    result.environmentContext,
    result.seasonalNote,
  ].filter(Boolean).join(" "));
}

function siteIsOnlyBuiltUp(siteBrief?: Pick<SiteBrief, "signals"> | null): boolean {
  const signals = siteBrief?.signals;
  if (!signals) return false;
  const covers = [...signals.landcover, ...signals.nearbyLandcover];
  return covers.length > 0 && covers.every((cover) => cover === "built_up");
}

export function decideGuideAutoSave(input: AutoSaveInput): GuideAutoSaveDecision {
  const { result, siteBrief } = input;
  const reasons: string[] = [];
  const text = sceneText(result);

  if (!result.isNew) {
    return {
      decision: "skip",
      confidence: 0.95,
      reasonCodes: ["duplicate_scene"],
      note: "直前とほぼ同じシーンなので自動保存しません。",
    };
  }

  if (PRIVACY_OR_INDOOR_RE.test(text)) {
    return {
      decision: "skip",
      confidence: 0.92,
      reasonCodes: ["privacy_or_indoor_scene"],
      note: "人物・室内・生活空間らしい要素があるため自動保存しません。",
    };
  }

  const natureSignal = hasNatureSignal(result);
  if (!natureSignal) {
    return {
      decision: "skip",
      confidence: 0.86,
      reasonCodes: ["no_field_nature_signal"],
      note: "生きもの・植生・地形・自然音の手がかりが弱いため自動保存しません。",
    };
  }

  if (input.guideMode === "vehicle" && !hasVehicleModeFieldSignal(result)) {
    return {
      decision: "skip",
      confidence: 0.84,
      reasonCodes: ["vehicle_structure_only_scene"],
      note: "車・看板・道路などの人工物だけに見えるため自動保存しません。",
    };
  }

  if (siteIsOnlyBuiltUp(siteBrief) && modelWantsSkip(result)) {
    return {
      decision: "skip",
      confidence: 0.8,
      reasonCodes: ["built_up_location_model_skip"],
      note: "位置情報は市街地寄りで、画像側も保存不要と判定したため自動保存しません。",
    };
  }

  if (modelWantsSkip(result)) {
    return {
      decision: "skip",
      confidence: 0.72,
      reasonCodes: ["model_skip"],
      note: result.saveRecommendation?.note || "保存不要と判定したため自動保存しません。",
    };
  }

  reasons.push("field_nature_signal");
  if (siteBrief?.hypothesis?.id && siteBrief.hypothesis.id !== "generic") reasons.push("location_context_available");
  if (result.saveRecommendation?.decision === "save") reasons.push("model_save");

  return {
    decision: "save",
    confidence: Math.max(0.64, result.saveRecommendation?.confidence ?? 0.68),
    reasonCodes: reasons,
    note: "野外の生きもの・植生・環境手がかりとして自動保存します。",
  };
}
