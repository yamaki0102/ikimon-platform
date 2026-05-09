export type AiModelProvider = "gemini" | "deepseek" | "openai-compatible";

export type AiModelRef = {
  provider: AiModelProvider;
  model: string;
};

export const AI_MODELS = {
  geminiFlashLite: "gemini-3.1-flash-lite",
  geminiFlashLiteFallback: "gemini-2.5-flash-lite",
  geminiFlash: "gemini-2.5-flash",
  deepseekFlash: "deepseek-v4-flash",
} as const;

export const AI_MODEL_CATALOG = {
  geminiFlashLite: { provider: "gemini", model: AI_MODELS.geminiFlashLite },
  geminiFlashLiteFallback: { provider: "gemini", model: AI_MODELS.geminiFlashLiteFallback },
  geminiFlash: { provider: "gemini", model: AI_MODELS.geminiFlash },
  deepseekFlash: { provider: "deepseek", model: AI_MODELS.deepseekFlash },
} as const satisfies Record<string, AiModelRef>;

export const AI_MODEL_ROLES = {
  curatorDefault: AI_MODELS.geminiFlashLite,
  curatorDeepseek: AI_MODELS.deepseekFlash,
  curatorSmoke: AI_MODELS.geminiFlashLite,
  regionalStoryDefault: AI_MODELS.geminiFlashLite,
  regionalStoryFallback: AI_MODELS.geminiFlashLiteFallback,
  taxonInsightPrimary: AI_MODELS.geminiFlashLite,
  taxonInsightFallback: AI_MODELS.geminiFlashLiteFallback,
  guideScenePrimary: AI_MODELS.geminiFlashLite,
  guideSceneFallback: AI_MODELS.geminiFlashLiteFallback,
  guideTtsTextPrimary: AI_MODELS.geminiFlashLite,
  guideTtsTextFallback: AI_MODELS.geminiFlashLiteFallback,
  observationReassessPrimary: AI_MODELS.geminiFlashLite,
  observationReassessFallback: AI_MODELS.geminiFlashLiteFallback,
  observationEventQuestPrimary: AI_MODELS.geminiFlashLite,
  observationEventQuestFallback: AI_MODELS.geminiFlashLiteFallback,
  observationEventAreaPrimary: AI_MODELS.geminiFlashLite,
  observationEventAreaFallback: AI_MODELS.geminiFlashLiteFallback,
  digitizedRagAnswerPrimary: AI_MODELS.geminiFlashLite,
  digitizedRagAnswerFallback: AI_MODELS.geminiFlash,
} as const;

export const AI_MODEL_ROLE_REFS = {
  curatorDefault: AI_MODEL_CATALOG.geminiFlashLite,
  curatorDeepseek: AI_MODEL_CATALOG.deepseekFlash,
  curatorSmoke: AI_MODEL_CATALOG.geminiFlashLite,
  regionalStoryDefault: AI_MODEL_CATALOG.geminiFlashLite,
  regionalStoryFallback: AI_MODEL_CATALOG.geminiFlashLiteFallback,
  taxonInsightPrimary: AI_MODEL_CATALOG.geminiFlashLite,
  taxonInsightFallback: AI_MODEL_CATALOG.geminiFlashLiteFallback,
  guideScenePrimary: AI_MODEL_CATALOG.geminiFlashLite,
  guideSceneFallback: AI_MODEL_CATALOG.geminiFlashLiteFallback,
  guideTtsTextPrimary: AI_MODEL_CATALOG.geminiFlashLite,
  guideTtsTextFallback: AI_MODEL_CATALOG.geminiFlashLiteFallback,
  observationReassessPrimary: AI_MODEL_CATALOG.geminiFlashLite,
  observationReassessFallback: AI_MODEL_CATALOG.geminiFlashLiteFallback,
  observationEventQuestPrimary: AI_MODEL_CATALOG.geminiFlashLite,
  observationEventQuestFallback: AI_MODEL_CATALOG.geminiFlashLiteFallback,
  observationEventAreaPrimary: AI_MODEL_CATALOG.geminiFlashLite,
  observationEventAreaFallback: AI_MODEL_CATALOG.geminiFlashLiteFallback,
  digitizedRagAnswerPrimary: AI_MODEL_CATALOG.geminiFlashLite,
  digitizedRagAnswerFallback: AI_MODEL_CATALOG.geminiFlash,
} as const satisfies Record<keyof typeof AI_MODEL_ROLES, AiModelRef>;

export const AI_MODEL_ROLE_CHAINS = {
  taxonInsights: [AI_MODEL_ROLE_REFS.taxonInsightPrimary, AI_MODEL_ROLE_REFS.taxonInsightFallback],
  regionalStory: [AI_MODEL_ROLE_REFS.regionalStoryDefault, AI_MODEL_ROLE_REFS.regionalStoryFallback],
  guideScene: [AI_MODEL_ROLE_REFS.guideScenePrimary, AI_MODEL_ROLE_REFS.guideSceneFallback],
  guideTtsText: [AI_MODEL_ROLE_REFS.guideTtsTextPrimary, AI_MODEL_ROLE_REFS.guideTtsTextFallback],
  observationReassess: [AI_MODEL_ROLE_REFS.observationReassessPrimary, AI_MODEL_ROLE_REFS.observationReassessFallback],
  observationEventQuest: [AI_MODEL_ROLE_REFS.observationEventQuestPrimary, AI_MODEL_ROLE_REFS.observationEventQuestFallback],
  observationEventArea: [AI_MODEL_ROLE_REFS.observationEventAreaPrimary, AI_MODEL_ROLE_REFS.observationEventAreaFallback],
  digitizedRagAnswer: [AI_MODEL_ROLE_REFS.digitizedRagAnswerPrimary, AI_MODEL_ROLE_REFS.digitizedRagAnswerFallback],
} as const;

export const CURATOR_DEFAULT_MODEL = AI_MODEL_ROLES.curatorDefault;
export const CURATOR_DEEPSEEK_MODEL = AI_MODEL_ROLES.curatorDeepseek;

export type AiModelRoleChainName = keyof typeof AI_MODEL_ROLE_CHAINS;

export const AI_MODEL_CHAIN_ENV_KEYS = {
  taxonInsights: "AI_MODEL_CHAIN_TAXON_INSIGHTS",
  regionalStory: "AI_MODEL_CHAIN_REGIONAL_STORY",
  guideScene: "AI_MODEL_CHAIN_GUIDE_SCENE",
  guideTtsText: "AI_MODEL_CHAIN_GUIDE_TTS_TEXT",
  observationReassess: "AI_MODEL_CHAIN_OBSERVATION_REASSESS",
  observationEventQuest: "AI_MODEL_CHAIN_OBSERVATION_EVENT_QUEST",
  observationEventArea: "AI_MODEL_CHAIN_OBSERVATION_EVENT_AREA",
  digitizedRagAnswer: "AI_MODEL_CHAIN_DIGITIZED_RAG_ANSWER",
} as const satisfies Record<AiModelRoleChainName, string>;

function refFromCatalogOrModel(raw: string): AiModelRef {
  const trimmed = raw.trim();
  const catalog = AI_MODEL_CATALOG[trimmed as keyof typeof AI_MODEL_CATALOG];
  if (catalog) return catalog;

  const separator = trimmed.indexOf(":");
  if (separator > 0) {
    const provider = trimmed.slice(0, separator).trim().toLowerCase();
    const model = trimmed.slice(separator + 1).trim();
    if (!model) throw new Error(`ai_model_override_empty_model:${raw}`);
    if (provider === "gemini" || provider === "deepseek" || provider === "openai-compatible") {
      return { provider, model };
    }
    if (provider === "openai") {
      return { provider: "openai-compatible", model };
    }
    throw new Error(`ai_model_override_unknown_provider:${provider}`);
  }

  if (trimmed.startsWith("gemini-")) return { provider: "gemini", model: trimmed };
  if (trimmed.startsWith("deepseek-")) return { provider: "deepseek", model: trimmed };
  throw new Error(`ai_model_override_requires_provider:${raw}`);
}

export function parseAiModelRoleChainOverride(raw: string): AiModelRef[] {
  const refs = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(refFromCatalogOrModel);
  if (refs.length === 0) {
    throw new Error("ai_model_override_empty_chain");
  }
  return refs;
}

export function getAiModelRoleChain(
  chainName: AiModelRoleChainName,
  env: NodeJS.ProcessEnv = process.env,
): AiModelRef[] {
  const override = env[AI_MODEL_CHAIN_ENV_KEYS[chainName]]?.trim();
  if (override) {
    return parseAiModelRoleChainOverride(override);
  }
  if (chainName === "regionalStory" && env.REGIONAL_STORY_GEMINI_MODEL?.trim()) {
    return [{ provider: "gemini", model: env.REGIONAL_STORY_GEMINI_MODEL.trim() }];
  }
  return [...AI_MODEL_ROLE_CHAINS[chainName]];
}

export function modelIdsForProvider(
  chainName: AiModelRoleChainName,
  provider: AiModelProvider,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  return getAiModelRoleChain(chainName, env).map((ref) => {
    if (ref.provider !== provider) {
      throw new Error(`ai_model_provider_mismatch:${chainName}:${ref.provider}:${ref.model}`);
    }
    return ref.model;
  });
}

export function geminiModelIdsForRoleChain(
  chainName: AiModelRoleChainName,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  return modelIdsForProvider(chainName, "gemini", env);
}
