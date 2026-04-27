import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SiteLang } from "../i18n.js";
import type { AppStrings, FieldLoopStrings, LandingStrings } from "../i18n/strings.js";
import { getObservationEventStrings } from "../i18n/observationEventStrings.js";
import { renderMarkdown } from "./markdown.js";

export type ContentNamespace = "shared" | "public" | "specialist" | "ops";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

type JsonActionLink = {
  href: string;
  label: string;
};

type JsonLandingCopy = {
  title: string;
  heroEyebrow: string;
  heroHeadingPlain: string;
  heroHeadingLine1: string;
  heroHeadingEmphasis: string;
  heroLead: string;
  heroPromiseChips: string[];
  heroDailyLabel: string;
  heroLatestLabel: string;
  heroStatsLabel: string;
  heroPhotoFallback: string;
  heroReasonLabels: Record<"seasonal" | "nearby" | "vividPhoto" | "supported" | "fresh", string>;
  dailyDashboard: {
    eyebrow: string;
    title: string;
    lead: string;
    scoreLabel: string;
    seasonalTitle: string;
    seasonalEmpty: string;
    cards: Record<"recordToday" | "revisitPlace" | "nearbyPulse" | "needsId", {
      eyebrow: string;
      title: string;
      body: string;
      cta: string;
      metricLabel: string;
    }>;
  };
  numberLocale: string;
  statLabelTemplateId: "observations_species";
  toolSectionEyebrow: string;
  toolSectionTitle: string;
  toolSectionLead: string;
  tools: {
    lens: { eyebrow: string; title: string; body: string; badge: string };
    scan: { eyebrow: string; title: string; body: string; badge: string };
  };
  mapSectionEyebrow: string;
  mapSectionTitle: string;
  mapSectionLead: string;
  mapEmpty: string;
};

type JsonFieldLoopCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  primaryCta: string;
  loopTitle: string;
  principleTitle: string;
  boundaryTitle: string;
  steps: Array<{ title: string; body: string }>;
  principles: string[];
  boundaries: string[];
};

type JsonHero = {
  eyebrow: string;
  heading: string;
  lead: string;
  actions?: Array<{ href: string; label: string; variant?: "primary" | "secondary" }>;
};

type JsonMarketingPageMeta = {
  title: string;
  eyebrow: string;
  heading: string;
  lead: string;
  activeNav: "home" | "learn" | "business" | "explore" | "community";
  bodyPageId: string;
  footerNote?: string;
  afterActions?: JsonActionLink[];
};

type JsonReadPageCopy = {
  title: string;
  activeNav: string;
  footerNote: string;
  hero?: JsonHero;
  [key: string]: JsonValue | undefined;
};

type JsonSharedCopy = {
  publicShared: {
    cta: {
      record: string;
      startObservation: string;
      openNotebook: string;
      openMap: string;
      readFaq: string;
      openGuide: string;
      openScan: string;
      openAbout: string;
      openGroupHelp: string;
      contact: string;
    };
    labels: {
      notebook: string;
      hint: string;
      revisit: string;
      groupHelp: string;
      groupHelpLong: string;
    };
    ai: {
      short: string;
      support: string;
      supportLong: string;
    };
    business: {
      nav: string;
      eyebrow: string;
      title: string;
      body: string;
      cta: string;
    };
  };
  shell: {
    brandTagline: string;
    skipToContent: string;
    searchPlaceholder: string;
    searchLabel: string;
    menu: string;
    nav: Record<string, string>;
    record: string;
    footer: {
      tagline: string;
      start: string;
      startLinks: Record<string, string>;
      learn: string;
      learnLinks: Record<string, string>;
      trust: string;
      trustLinks: Record<string, string>;
      copyright: string;
      revisit: string;
    };
  };
  quickNav: {
    ariaLabel: string;
    labels: Record<string, string>;
  };
  footerNotes: {
    landing: string;
    public: string;
    qa: string;
  };
};

type JsonPublicCopy = {
  landing: JsonLandingCopy;
  fieldLoop: JsonFieldLoopCopy;
  marketing: {
    pages: Record<string, JsonMarketingPageMeta>;
  };
  contactForm?: {
    categories: Array<{ value: string; label: string }>;
    fields: {
      category: string;
      message: string;
      messagePlaceholder: string;
      messageHint: string;
      name: string;
      namePlaceholder: string;
      organization: string;
      organizationPlaceholder: string;
      email: string;
      emailPlaceholder: string;
      emailHint: string;
    };
    submit: string;
    noscript: string;
    status: {
      loading: string;
      successPrefix: string;
      successSuffix: string;
      errorPrefix: string;
      network: string;
    };
  };
  read: Record<string, JsonReadPageCopy>;
};

type JsonOpsCopy = {
  qaSiteMap: {
    title: string;
    hero: JsonHero;
    sections: Array<{
      eyebrow: string;
      title: string;
      lead: string;
      cards: Array<{ href: string; label: string; note: string }>;
      note?: string;
    }>;
    checklist: {
      eyebrow: string;
      title: string;
      lead: string;
      items: Array<{ title: string; body: string }>;
    };
    footerNote: string;
  };
};

type JsonSpecialistCopy = JsonObject;

export type ContentStore = {
  short: Record<SiteLang, Record<ContentNamespace, JsonObject>>;
  longform: Record<SiteLang, Record<string, string>>;
};

export type ContentRoots = {
  shortRoot: string;
  longformRoot: string;
};

const LANGS: SiteLang[] = ["ja", "en", "es", "pt-BR"];
const NAMESPACES: ContentNamespace[] = ["shared", "public", "specialist", "ops"];

export function resolveContentRoots(moduleUrl = import.meta.url): ContentRoots {
  const contentRoot = fileURLToPath(new URL("./", moduleUrl));
  return {
    shortRoot: join(contentRoot, "short"),
    longformRoot: join(contentRoot, "longform"),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertObject(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error(`${path} must be an object`);
  }
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string`);
  }
}

function assertStringArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${path} must be a string[]`);
  }
}

function readJsonFile(path: string): JsonObject {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  assertObject(parsed, path);
  return parsed as JsonObject;
}

function readMarkdownFile(path: string): string {
  return readFileSync(path, "utf8");
}

function mergeDeep(base: JsonValue, override: JsonValue): JsonValue {
  if (Array.isArray(base) && Array.isArray(override)) {
    return override.slice();
  }
  if (isPlainObject(base) && isPlainObject(override)) {
    const merged: Record<string, JsonValue> = { ...(base as JsonObject) };
    for (const [key, value] of Object.entries(override)) {
      const current = merged[key];
      merged[key] = current === undefined ? (value as JsonValue) : mergeDeep(current, value as JsonValue);
    }
    return merged;
  }
  return override;
}

function assertSubsetShape(canonical: JsonValue, candidate: JsonValue, path: string): void {
  if (Array.isArray(candidate)) {
    if (!Array.isArray(canonical)) {
      throw new Error(`${path} must match canonical array shape`);
    }
    return;
  }

  if (isPlainObject(candidate)) {
    if (!isPlainObject(canonical)) {
      throw new Error(`${path} must match canonical object shape`);
    }
    for (const [key, value] of Object.entries(candidate)) {
      if (!(key in canonical)) {
        throw new Error(`${path}.${key} is not defined in canonical content`);
      }
      const canonicalValue = (canonical as JsonObject)[key];
      if (canonicalValue === undefined) {
        throw new Error(`${path}.${key} is missing in canonical content`);
      }
      assertSubsetShape(canonicalValue, value as JsonValue, `${path}.${key}`);
    }
    return;
  }

  if (typeof canonical !== typeof candidate) {
    throw new Error(`${path} must match canonical scalar type`);
  }
}

function getByPath(source: JsonObject, key: string): JsonValue {
  const parts = key.split(".");
  let current: JsonValue = source;
  for (const part of parts) {
    if (!isPlainObject(current) || !(part in current)) {
      throw new Error(`Unknown content key: ${key}`);
    }
    current = current[part] as JsonValue;
  }
  return current;
}

function validateLandingCopy(value: unknown, path: string): asserts value is JsonLandingCopy {
  assertObject(value, path);
  assertString(value.title, `${path}.title`);
  assertString(value.heroEyebrow, `${path}.heroEyebrow`);
  assertString(value.heroHeadingPlain, `${path}.heroHeadingPlain`);
  assertString(value.heroHeadingLine1, `${path}.heroHeadingLine1`);
  assertString(value.heroHeadingEmphasis, `${path}.heroHeadingEmphasis`);
  assertString(value.heroLead, `${path}.heroLead`);
  assertStringArray(value.heroPromiseChips, `${path}.heroPromiseChips`);
  assertString(value.heroDailyLabel, `${path}.heroDailyLabel`);
  assertString(value.heroLatestLabel, `${path}.heroLatestLabel`);
  assertString(value.heroStatsLabel, `${path}.heroStatsLabel`);
  assertString(value.heroPhotoFallback, `${path}.heroPhotoFallback`);
  assertObject(value.heroReasonLabels, `${path}.heroReasonLabels`);
  for (const key of ["seasonal", "nearby", "vividPhoto", "supported", "fresh"] as const) {
    assertString(value.heroReasonLabels[key], `${path}.heroReasonLabels.${key}`);
  }
  assertObject(value.dailyDashboard, `${path}.dailyDashboard`);
  assertString(value.dailyDashboard.eyebrow, `${path}.dailyDashboard.eyebrow`);
  assertString(value.dailyDashboard.title, `${path}.dailyDashboard.title`);
  assertString(value.dailyDashboard.lead, `${path}.dailyDashboard.lead`);
  assertString(value.dailyDashboard.scoreLabel, `${path}.dailyDashboard.scoreLabel`);
  assertString(value.dailyDashboard.seasonalTitle, `${path}.dailyDashboard.seasonalTitle`);
  assertString(value.dailyDashboard.seasonalEmpty, `${path}.dailyDashboard.seasonalEmpty`);
  assertObject(value.dailyDashboard.cards, `${path}.dailyDashboard.cards`);
  for (const key of ["recordToday", "revisitPlace", "nearbyPulse", "needsId"] as const) {
    assertObject(value.dailyDashboard.cards[key], `${path}.dailyDashboard.cards.${key}`);
    assertString(value.dailyDashboard.cards[key].eyebrow, `${path}.dailyDashboard.cards.${key}.eyebrow`);
    assertString(value.dailyDashboard.cards[key].title, `${path}.dailyDashboard.cards.${key}.title`);
    assertString(value.dailyDashboard.cards[key].body, `${path}.dailyDashboard.cards.${key}.body`);
    assertString(value.dailyDashboard.cards[key].cta, `${path}.dailyDashboard.cards.${key}.cta`);
    assertString(value.dailyDashboard.cards[key].metricLabel, `${path}.dailyDashboard.cards.${key}.metricLabel`);
  }
  assertString(value.numberLocale, `${path}.numberLocale`);
  assertString(value.statLabelTemplateId, `${path}.statLabelTemplateId`);
  assertString(value.toolSectionEyebrow, `${path}.toolSectionEyebrow`);
  assertString(value.toolSectionTitle, `${path}.toolSectionTitle`);
  assertString(value.toolSectionLead, `${path}.toolSectionLead`);
  assertObject(value.tools, `${path}.tools`);
  for (const toolName of ["lens", "scan"] as const) {
    const tool = value.tools[toolName];
    assertObject(tool, `${path}.tools.${toolName}`);
    assertString(tool.eyebrow, `${path}.tools.${toolName}.eyebrow`);
    assertString(tool.title, `${path}.tools.${toolName}.title`);
    assertString(tool.body, `${path}.tools.${toolName}.body`);
    assertString(tool.badge, `${path}.tools.${toolName}.badge`);
  }
  assertString(value.mapSectionEyebrow, `${path}.mapSectionEyebrow`);
  assertString(value.mapSectionTitle, `${path}.mapSectionTitle`);
  assertString(value.mapSectionLead, `${path}.mapSectionLead`);
  assertString(value.mapEmpty, `${path}.mapEmpty`);
}

function validateFieldLoopCopy(value: unknown, path: string): asserts value is JsonFieldLoopCopy {
  assertObject(value, path);
  assertString(value.eyebrow, `${path}.eyebrow`);
  assertString(value.title, `${path}.title`);
  assertString(value.lead, `${path}.lead`);
  assertString(value.primaryCta, `${path}.primaryCta`);
  assertString(value.loopTitle, `${path}.loopTitle`);
  assertString(value.principleTitle, `${path}.principleTitle`);
  assertString(value.boundaryTitle, `${path}.boundaryTitle`);
  if (!Array.isArray(value.steps)) {
    throw new Error(`${path}.steps must be an array`);
  }
  for (const [index, step] of value.steps.entries()) {
    assertObject(step, `${path}.steps[${index}]`);
    assertString(step.title, `${path}.steps[${index}].title`);
    assertString(step.body, `${path}.steps[${index}].body`);
  }
  assertStringArray(value.principles, `${path}.principles`);
  assertStringArray(value.boundaries, `${path}.boundaries`);
}

function validateMarketingMeta(value: unknown, path: string): asserts value is JsonMarketingPageMeta {
  assertObject(value, path);
  assertString(value.title, `${path}.title`);
  assertString(value.eyebrow, `${path}.eyebrow`);
  assertString(value.heading, `${path}.heading`);
  assertString(value.lead, `${path}.lead`);
  assertString(value.activeNav, `${path}.activeNav`);
  assertString(value.bodyPageId, `${path}.bodyPageId`);
  if (value.footerNote !== undefined) {
    assertString(value.footerNote, `${path}.footerNote`);
  }
  if (value.afterActions !== undefined) {
    if (!Array.isArray(value.afterActions)) {
      throw new Error(`${path}.afterActions must be an array`);
    }
    for (const [index, action] of value.afterActions.entries()) {
      assertObject(action, `${path}.afterActions[${index}]`);
      assertString(action.href, `${path}.afterActions[${index}].href`);
      assertString(action.label, `${path}.afterActions[${index}].label`);
    }
  }
}

function validateContactFormCopy(value: unknown, path: string): void {
  assertObject(value, path);
  if (!Array.isArray(value.categories)) {
    throw new Error(`${path}.categories must be an array`);
  }
  for (const [index, category] of value.categories.entries()) {
    assertObject(category, `${path}.categories[${index}]`);
    assertString(category.value, `${path}.categories[${index}].value`);
    assertString(category.label, `${path}.categories[${index}].label`);
  }
  assertObject(value.fields, `${path}.fields`);
  for (const [key, entry] of Object.entries(value.fields)) {
    assertString(entry, `${path}.fields.${key}`);
  }
  assertString(value.submit, `${path}.submit`);
  assertString(value.noscript, `${path}.noscript`);
  assertObject(value.status, `${path}.status`);
  for (const [key, entry] of Object.entries(value.status)) {
    assertString(entry, `${path}.status.${key}`);
  }
}

function validateSharedNamespace(value: JsonObject): void {
  assertObject(value.publicShared, "shared.publicShared");
  assertObject(value.publicShared.cta, "shared.publicShared.cta");
  assertObject(value.publicShared.labels, "shared.publicShared.labels");
  assertObject(value.publicShared.ai, "shared.publicShared.ai");
  assertObject(value.publicShared.business, "shared.publicShared.business");
  for (const groupName of ["cta", "labels", "ai", "business"] as const) {
    const group = value.publicShared[groupName] as Record<string, string>;
    for (const [key, entry] of Object.entries(group)) {
      assertString(entry, `shared.publicShared.${groupName}.${key}`);
    }
  }
  assertObject(value.shell, "shared.shell");
  assertString(value.shell.brandTagline, "shared.shell.brandTagline");
  assertString(value.shell.skipToContent, "shared.shell.skipToContent");
  assertString(value.shell.searchPlaceholder, "shared.shell.searchPlaceholder");
  assertString(value.shell.searchLabel, "shared.shell.searchLabel");
  assertString(value.shell.menu, "shared.shell.menu");
  assertObject(value.shell.nav, "shared.shell.nav");
  assertString(value.shell.record, "shared.shell.record");
  for (const [key, entry] of Object.entries(value.shell.nav)) {
    assertString(entry, `shared.shell.nav.${key}`);
  }
  assertObject(value.shell.footer, "shared.shell.footer");
  assertString(value.shell.footer.tagline, "shared.shell.footer.tagline");
  assertString(value.shell.footer.start, "shared.shell.footer.start");
  assertObject(value.shell.footer.startLinks, "shared.shell.footer.startLinks");
  assertString(value.shell.footer.learn, "shared.shell.footer.learn");
  assertObject(value.shell.footer.learnLinks, "shared.shell.footer.learnLinks");
  assertString(value.shell.footer.trust, "shared.shell.footer.trust");
  assertObject(value.shell.footer.trustLinks, "shared.shell.footer.trustLinks");
  assertString(value.shell.footer.copyright, "shared.shell.footer.copyright");
  assertString(value.shell.footer.revisit, "shared.shell.footer.revisit");
  for (const [groupName, group] of [
    ["startLinks", value.shell.footer.startLinks],
    ["learnLinks", value.shell.footer.learnLinks],
    ["trustLinks", value.shell.footer.trustLinks],
  ] as const) {
    for (const [key, entry] of Object.entries(group)) {
      assertString(entry, `shared.shell.footer.${groupName}.${key}`);
    }
  }
  assertObject(value.quickNav, "shared.quickNav");
  assertString(value.quickNav.ariaLabel, "shared.quickNav.ariaLabel");
  assertObject(value.quickNav.labels, "shared.quickNav.labels");
  for (const [key, entry] of Object.entries(value.quickNav.labels)) {
    assertString(entry, `shared.quickNav.labels.${key}`);
  }
  assertObject(value.footerNotes, "shared.footerNotes");
  for (const [key, entry] of Object.entries(value.footerNotes)) {
    assertString(entry, `shared.footerNotes.${key}`);
  }
}

function validatePublicNamespace(value: JsonObject): void {
  validateLandingCopy(value.landing, "public.landing");
  validateFieldLoopCopy(value.fieldLoop, "public.fieldLoop");
  assertObject(value.marketing, "public.marketing");
  assertObject(value.marketing.pages, "public.marketing.pages");
  for (const [key, page] of Object.entries(value.marketing.pages)) {
    validateMarketingMeta(page, `public.marketing.pages.${key}`);
  }
  if (value.contactForm !== undefined) {
    validateContactFormCopy(value.contactForm, "public.contactForm");
  }
  assertObject(value.read, "public.read");
  for (const [key, page] of Object.entries(value.read)) {
    assertObject(page, `public.read.${key}`);
    assertString(page.title, `public.read.${key}.title`);
    assertString(page.activeNav, `public.read.${key}.activeNav`);
    assertString(page.footerNote, `public.read.${key}.footerNote`);
    if (page.hero !== undefined) {
      assertObject(page.hero, `public.read.${key}.hero`);
      assertString(page.hero.eyebrow, `public.read.${key}.hero.eyebrow`);
      assertString(page.hero.heading, `public.read.${key}.hero.heading`);
      assertString(page.hero.lead, `public.read.${key}.hero.lead`);
    }
  }
}

function validateOpsNamespace(value: JsonObject): void {
  assertObject(value.qaSiteMap, "ops.qaSiteMap");
  assertObject(value.qaSiteMap.hero, "ops.qaSiteMap.hero");
  assertString(value.qaSiteMap.title, "ops.qaSiteMap.title");
  assertString(value.qaSiteMap.hero.eyebrow, "ops.qaSiteMap.hero.eyebrow");
  assertString(value.qaSiteMap.hero.heading, "ops.qaSiteMap.hero.heading");
  assertString(value.qaSiteMap.hero.lead, "ops.qaSiteMap.hero.lead");
  if (!Array.isArray(value.qaSiteMap.sections)) {
    throw new Error("ops.qaSiteMap.sections must be an array");
  }
  for (const [index, section] of value.qaSiteMap.sections.entries()) {
    assertObject(section, `ops.qaSiteMap.sections[${index}]`);
    assertString(section.eyebrow, `ops.qaSiteMap.sections[${index}].eyebrow`);
    assertString(section.title, `ops.qaSiteMap.sections[${index}].title`);
    assertString(section.lead, `ops.qaSiteMap.sections[${index}].lead`);
    if (!Array.isArray(section.cards)) {
      throw new Error(`ops.qaSiteMap.sections[${index}].cards must be an array`);
    }
    for (const [cardIndex, card] of section.cards.entries()) {
      assertObject(card, `ops.qaSiteMap.sections[${index}].cards[${cardIndex}]`);
      assertString(card.href, `ops.qaSiteMap.sections[${index}].cards[${cardIndex}].href`);
      assertString(card.label, `ops.qaSiteMap.sections[${index}].cards[${cardIndex}].label`);
      assertString(card.note, `ops.qaSiteMap.sections[${index}].cards[${cardIndex}].note`);
    }
    if (section.note !== undefined) {
      assertString(section.note, `ops.qaSiteMap.sections[${index}].note`);
    }
  }
  assertObject(value.qaSiteMap.checklist, "ops.qaSiteMap.checklist");
  assertString(value.qaSiteMap.checklist.eyebrow, "ops.qaSiteMap.checklist.eyebrow");
  assertString(value.qaSiteMap.checklist.title, "ops.qaSiteMap.checklist.title");
  assertString(value.qaSiteMap.checklist.lead, "ops.qaSiteMap.checklist.lead");
  if (!Array.isArray(value.qaSiteMap.checklist.items)) {
    throw new Error("ops.qaSiteMap.checklist.items must be an array");
  }
  for (const [index, item] of value.qaSiteMap.checklist.items.entries()) {
    assertObject(item, `ops.qaSiteMap.checklist.items[${index}]`);
    assertString(item.title, `ops.qaSiteMap.checklist.items[${index}].title`);
    assertString(item.body, `ops.qaSiteMap.checklist.items[${index}].body`);
  }
  assertString(value.qaSiteMap.footerNote, "ops.qaSiteMap.footerNote");
}

function validateSpecialistNamespace(value: JsonObject): void {
  assertObject(value, "specialist");
}

function validateNamespace(namespace: ContentNamespace, value: JsonObject): void {
  switch (namespace) {
    case "shared":
      validateSharedNamespace(value);
      return;
    case "public":
      validatePublicNamespace(value);
      return;
    case "ops":
      validateOpsNamespace(value);
      return;
    case "specialist":
      validateSpecialistNamespace(value);
      return;
  }
}

function loadShortNamespace(
  roots: ContentRoots,
  lang: SiteLang,
  namespace: ContentNamespace,
  canonical: JsonObject,
): JsonObject {
  const filePath = join(roots.shortRoot, lang, `${namespace}.json`);
  if (!existsSync(filePath)) {
    return canonical;
  }
  const parsed = readJsonFile(filePath);
  if (lang !== "ja") {
    assertSubsetShape(canonical, parsed, `${lang}.${namespace}`);
  }
  const merged = mergeDeep(canonical, parsed) as JsonObject;
  validateNamespace(namespace, merged);
  return merged;
}

function loadLongformFiles(
  roots: ContentRoots,
  lang: SiteLang,
  canonical: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [pageId, body] of Object.entries(canonical)) {
    const filePath = join(roots.longformRoot, lang, `${pageId}.md`);
    result[pageId] = existsSync(filePath) ? readMarkdownFile(filePath) : body;
  }
  return result;
}

export function createContentStore(roots: ContentRoots = resolveContentRoots()): ContentStore {
  const canonicalShort: Record<ContentNamespace, JsonObject> = {
    shared: readJsonFile(join(roots.shortRoot, "ja", "shared.json")),
    public: readJsonFile(join(roots.shortRoot, "ja", "public.json")),
    specialist: existsSync(join(roots.shortRoot, "ja", "specialist.json"))
      ? readJsonFile(join(roots.shortRoot, "ja", "specialist.json"))
      : {},
    ops: readJsonFile(join(roots.shortRoot, "ja", "ops.json")),
  };
  for (const namespace of NAMESPACES) {
    validateNamespace(namespace, canonicalShort[namespace]);
  }

  const canonicalLongform: Record<string, string> = {};
  const pageIds = Object.values((canonicalShort.public as JsonPublicCopy).marketing.pages).map((page) => page.bodyPageId);
  for (const pageId of pageIds) {
    const filePath = join(roots.longformRoot, "ja", `${pageId}.md`);
    if (!existsSync(filePath)) {
      throw new Error(`Missing canonical longform content: ${pageId}`);
    }
    canonicalLongform[pageId] = readMarkdownFile(filePath);
  }

  const short: ContentStore["short"] = {} as ContentStore["short"];
  const longform: ContentStore["longform"] = {} as ContentStore["longform"];

  for (const lang of LANGS) {
    short[lang] = {} as Record<ContentNamespace, JsonObject>;
    for (const namespace of NAMESPACES) {
      short[lang][namespace] = loadShortNamespace(roots, lang, namespace, canonicalShort[namespace]);
    }
    longform[lang] = loadLongformFiles(roots, lang, canonicalLongform);
  }

  return { short, longform };
}

const store = createContentStore();

export function fallbackChain(lang: SiteLang): SiteLang[] {
  return lang === "ja" ? ["ja"] : [lang, "ja"];
}

export function getShortNamespace<T>(lang: SiteLang, namespace: ContentNamespace): T {
  return store.short[lang][namespace] as T;
}

export function getShortCopy<T>(lang: SiteLang, namespace: ContentNamespace, key: string): T {
  const namespaceObject = getShortNamespace<JsonObject>(lang, namespace);
  return getByPath(namespaceObject, key) as T;
}

export function getLongformMarkdown(lang: SiteLang, pageId: string): string {
  const body = store.longform[lang][pageId];
  if (!body) {
    throw new Error(`Unknown longform page: ${pageId}`);
  }
  return body;
}

export function renderLongformPage(lang: SiteLang, pageId: string): string {
  return renderMarkdown(getLongformMarkdown(lang, pageId));
}

function composeHeroHeading(source: JsonLandingCopy): { plain: string; html: string } {
  return {
    plain: source.heroHeadingPlain,
    html: `${source.heroHeadingLine1}<br><span class="hero-emphasis">${source.heroHeadingEmphasis}</span>`,
  };
}

function statLabelFormatter(templateId: JsonLandingCopy["statLabelTemplateId"], locale: string): LandingStrings["statLabelTemplate"] {
  switch (templateId) {
    case "observations_species":
      return (observations, species) => {
        const separator = locale.startsWith("ja") ? "件の観察 · " : " observations · ";
        const suffix = locale.startsWith("ja") ? " 種" : " species";
        return `${observations}${separator}${species}${suffix}`;
      };
  }
}

export function buildAppStrings(lang: SiteLang): AppStrings {
  const shared = getShortNamespace<JsonSharedCopy>(lang, "shared");
  const publicCopy = getShortNamespace<JsonPublicCopy>(lang, "public");
  const heading = composeHeroHeading(publicCopy.landing);
  const landing: LandingStrings = {
    title: publicCopy.landing.title,
    heroEyebrow: publicCopy.landing.heroEyebrow,
    heroHeading: heading.html,
    heroHeadingPlain: heading.plain,
    heroLead: publicCopy.landing.heroLead,
    heroPromiseChips: [...publicCopy.landing.heroPromiseChips, shared.publicShared.ai.short],
    heroDailyLabel: publicCopy.landing.heroDailyLabel,
    heroLatestLabel: publicCopy.landing.heroLatestLabel,
    heroStatsLabel: publicCopy.landing.heroStatsLabel,
    heroPhotoFallback: publicCopy.landing.heroPhotoFallback,
    heroReasonLabels: publicCopy.landing.heroReasonLabels,
    dailyDashboard: publicCopy.landing.dailyDashboard,
    numberLocale: publicCopy.landing.numberLocale,
    statLabelTemplate: statLabelFormatter(publicCopy.landing.statLabelTemplateId, publicCopy.landing.numberLocale),
    actionPrimaryLoggedIn: shared.publicShared.cta.openNotebook,
    actionPrimaryGuest: shared.publicShared.cta.startObservation,
    actionSecondary: shared.publicShared.cta.openMap,
    toolSectionEyebrow: publicCopy.landing.toolSectionEyebrow,
    toolSectionTitle: publicCopy.landing.toolSectionTitle,
    toolSectionLead: publicCopy.landing.toolSectionLead,
    tools: {
      lens: {
        eyebrow: publicCopy.landing.tools.lens.eyebrow,
        title: publicCopy.landing.tools.lens.title,
        body: publicCopy.landing.tools.lens.body,
        cta: shared.publicShared.cta.openGuide,
        badge: publicCopy.landing.tools.lens.badge,
      },
      scan: {
        eyebrow: publicCopy.landing.tools.scan.eyebrow,
        title: publicCopy.landing.tools.scan.title,
        body: publicCopy.landing.tools.scan.body,
        cta: shared.publicShared.cta.openScan,
        badge: publicCopy.landing.tools.scan.badge,
      },
    },
    mapSectionEyebrow: publicCopy.landing.mapSectionEyebrow,
    mapSectionTitle: publicCopy.landing.mapSectionTitle,
    mapSectionLead: publicCopy.landing.mapSectionLead,
    mapCta: shared.publicShared.cta.openMap,
    mapEmpty: publicCopy.landing.mapEmpty,
    bizEyebrow: shared.publicShared.business.eyebrow,
    bizTitle: shared.publicShared.business.title,
    bizBody: shared.publicShared.business.body,
    bizCta: shared.publicShared.business.cta,
    footerNote: shared.footerNotes.landing,
  };
  const fieldLoop: FieldLoopStrings = {
    eyebrow: publicCopy.fieldLoop.eyebrow,
    title: publicCopy.fieldLoop.title,
    lead: publicCopy.fieldLoop.lead,
    primaryCta: publicCopy.fieldLoop.primaryCta,
    secondaryCta: shared.publicShared.cta.openScan,
    loopTitle: publicCopy.fieldLoop.loopTitle,
    principleTitle: publicCopy.fieldLoop.principleTitle,
    boundaryTitle: publicCopy.fieldLoop.boundaryTitle,
    steps: publicCopy.fieldLoop.steps,
    principles: publicCopy.fieldLoop.principles,
    boundaries: publicCopy.fieldLoop.boundaries,
  };

  const observationEvent = getObservationEventStrings(lang);
  return { landing, fieldLoop, observationEvent };
}
