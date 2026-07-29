import type { SiteLang } from "../i18n.js";
import { KUBIAKA_FOCUSED_EXPERIENCE } from "./kubiakaExperience.js";

export type LocalizedText = Readonly<Record<SiteLang, string>>;

export type FocusedExperienceShell = "focused";

export type FocusedExperienceDefinition = Readonly<{
  experienceKey: string;
  canonicalPath: `/${string}`;
  title: LocalizedText;
  shortTitle: LocalizedText;
  taxonId: string | null;
  protocolProfile: string;
  protocolVersion: string;
  seasonalContentVersion: string;
  shell: FocusedExperienceShell;
  publicAreaPrecision: "aggregate_only";
  enabled: boolean;
}>;

const DEFINITIONS = [KUBIAKA_FOCUSED_EXPERIENCE] as const satisfies readonly FocusedExperienceDefinition[];

function validateDefinition(definition: FocusedExperienceDefinition): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.experienceKey)) {
    throw new Error(`invalid_focused_experience_key:${definition.experienceKey}`);
  }
  if (!definition.canonicalPath.startsWith("/") || definition.canonicalPath.includes("?")) {
    throw new Error(`invalid_focused_experience_path:${definition.experienceKey}`);
  }
  if (!definition.protocolProfile.trim() || !definition.protocolVersion.trim()) {
    throw new Error(`invalid_focused_experience_protocol:${definition.experienceKey}`);
  }
  for (const lang of ["ja", "en", "es", "pt-BR"] as const satisfies readonly SiteLang[]) {
    if (!definition.title[lang].trim() || !definition.shortTitle[lang].trim()) {
      throw new Error(`missing_focused_experience_copy:${definition.experienceKey}:${lang}`);
    }
  }
}

const definitionByKey = new Map<string, FocusedExperienceDefinition>();
const definitionByPath = new Map<string, FocusedExperienceDefinition>();

for (const definition of DEFINITIONS) {
  validateDefinition(definition);
  if (definitionByKey.has(definition.experienceKey)) {
    throw new Error(`duplicate_focused_experience_key:${definition.experienceKey}`);
  }
  if (definitionByPath.has(definition.canonicalPath)) {
    throw new Error(`duplicate_focused_experience_path:${definition.canonicalPath}`);
  }
  definitionByKey.set(definition.experienceKey, definition);
  definitionByPath.set(definition.canonicalPath, definition);
}

export function listFocusedExperiences(options: { includeDisabled?: boolean } = {}): readonly FocusedExperienceDefinition[] {
  const includeDisabled = options.includeDisabled === true;
  return DEFINITIONS.filter((definition) => includeDisabled || definition.enabled);
}

export function findFocusedExperience(experienceKey: string | null | undefined): FocusedExperienceDefinition | null {
  const normalized = String(experienceKey ?? "").trim().toLowerCase();
  if (!normalized) return null;
  const definition = definitionByKey.get(normalized) ?? null;
  return definition?.enabled ? definition : null;
}

export function findFocusedExperienceByCanonicalPath(path: string | null | undefined): FocusedExperienceDefinition | null {
  const normalized = normalizeFocusedExperiencePath(path);
  if (!normalized) return null;
  const definition = definitionByPath.get(normalized) ?? null;
  return definition?.enabled ? definition : null;
}

export function requireFocusedExperience(experienceKey: string): FocusedExperienceDefinition {
  const definition = findFocusedExperience(experienceKey);
  if (!definition) {
    throw new Error(`focused_experience_not_found:${experienceKey}`);
  }
  return definition;
}

export function focusedExperienceText(text: LocalizedText, lang: SiteLang): string {
  return text[lang] || text.ja;
}

export function focusedExperienceHref(
  definition: Pick<FocusedExperienceDefinition, "canonicalPath">,
  suffix = "",
): string {
  const base = definition.canonicalPath.replace(/\/+$/, "");
  const normalizedSuffix = String(suffix).trim().replace(/^\/+/, "");
  return normalizedSuffix ? `${base}/${normalizedSuffix}` : base;
}

function normalizeFocusedExperiencePath(path: string | null | undefined): string | null {
  const value = String(path ?? "").trim();
  if (!value) return null;
  let pathname = value;
  try {
    pathname = new URL(value, "https://zukan.local").pathname;
  } catch {
    pathname = value.split("?", 1)[0] || "/";
  }
  const normalized = pathname !== "/" ? pathname.replace(/\/+$/, "") : "/";
  for (const definition of DEFINITIONS) {
    if (normalized === definition.canonicalPath || normalized.startsWith(`${definition.canonicalPath}/`)) {
      return definition.canonicalPath;
    }
  }
  return normalized;
}
