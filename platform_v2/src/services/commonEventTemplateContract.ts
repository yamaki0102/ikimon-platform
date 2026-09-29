export const COMMON_EVENT_TEMPLATE_CONTRACT_VERSION = "event-template-v1" as const;

export const COMMON_EVENT_TEMPLATE_KEYS = [
  "stamp-rally",
  "mission-quest",
  "collaborative-observation",
  "ryuyo",
] as const;

export type CommonEventTemplateKey = (typeof COMMON_EVENT_TEMPLATE_KEYS)[number];

export const COMMON_EVENT_TEMPLATE_LABELS: Readonly<Record<CommonEventTemplateKey, string>> = Object.freeze({
  "stamp-rally": "スタンプラリー",
  "mission-quest": "Mission / Quest",
  "collaborative-observation": "みんなで観察",
  ryuyo: "竜洋の自然観察イベント",
});

export interface CommonEventTemplateConfig {
  contract_version: typeof COMMON_EVENT_TEMPLATE_CONTRACT_VERSION;
  key: CommonEventTemplateKey;
}

export function isCommonEventTemplateKey(value: unknown): value is CommonEventTemplateKey {
  return typeof value === "string" && COMMON_EVENT_TEMPLATE_KEYS.some((key) => key === value);
}

export function isCommonEventTemplateConfig(value: unknown): value is CommonEventTemplateConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const config = value as Record<string, unknown>;
  return config.contract_version === COMMON_EVENT_TEMPLATE_CONTRACT_VERSION && isCommonEventTemplateKey(config.key);
}
