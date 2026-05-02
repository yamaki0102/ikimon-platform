import type { BriefLang, SiteSignals } from "./siteBrief.js";
import { getCachedOfficialNoticeSnapshot, putCachedOfficialNoticeSnapshot } from "./officialNoticeCache.js";

export type OfficialNoticeLink = {
  label: string;
  url: string;
};

export type OfficialNoticeAction = OfficialNoticeLink & {
  kind: "open_source" | "report";
};

export type OfficialNoticeCard = {
  id: string;
  issuer: string;
  title: string;
  updatedAt: string | null;
  summary: string;
  whyRelevant: string[];
  actions: OfficialNoticeAction[];
  limits: string[];
  attachments: OfficialNoticeLink[];
  sourceUrl: string;
};

export type OfficialNoticeSnapshot = {
  sourceId: string;
  parserKey: string;
  schemaVersion: number;
  issuer: string;
  sourcePageUrl: string;
  pageUrl: string;
  title: string;
  updatedAt: string | null;
  summary: string;
  reportUrl: string | null;
  attachments: OfficialNoticeLink[];
  warnings: string[];
  fetchedAt: string;
};

export type OfficialNoticeSource = {
  id: string;
  issuer: string;
  sourcePageUrl: string;
  coverageBbox: [number, number, number, number];
  habitatRules: {
    maxWaterDistanceM: number;
    landcoverAny: Array<"water" | "wetland">;
  };
  parserKey: "hamamatsu_nutria";
  ttlHours: number;
};

type FetchLike = typeof fetch;

type NoticeParser = (input: {
  html: string;
  source: OfficialNoticeSource;
  fetchedAt: string;
}) => OfficialNoticeSnapshot;

const REQUEST_TIMEOUT_MS = 5000;

export const OFFICIAL_NOTICE_SOURCES: OfficialNoticeSource[] = [
  {
    id: "hamamatsu_nutria",
    issuer: "浜松市",
    sourcePageUrl: "https://www.city.hamamatsu.shizuoka.jp/kankyou/nutria.html",
    coverageBbox: [137.55, 34.61, 137.91, 34.85],
    habitatRules: {
      maxWaterDistanceM: 300,
      landcoverAny: ["water", "wetland"],
    },
    parserKey: "hamamatsu_nutria",
    ttlHours: 24,
  },
];

const NOTICE_PARSERS: Record<OfficialNoticeSource["parserKey"], NoticeParser> = {
  hamamatsu_nutria: parseHamamatsuNutriaPage,
};

function pointInBbox(
  lat: number,
  lng: number,
  bbox: [number, number, number, number],
): boolean {
  return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string): string {
  return normalizeWhitespace(value.replace(/<[^>]+>/g, " "));
}

function absoluteUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function extractFirstMatch(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[1] ? stripTags(match[1]) : null;
}

function extractUpdatedAt(html: string): string | null {
  const match = html.match(/更新日[:：]\s*(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/u);
  if (!match) return null;
  const year = match[1] ?? "";
  const month = match[2] ?? "";
  const day = match[3] ?? "";
  if (!year || !month || !day) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function extractSectionSummary(html: string): string {
  const sectionMatch = html.match(/<h2[^>]*>\s*ヌートリアについて\s*<\/h2>([\s\S]*?)(?:<h2\b|<\/section>|$)/iu);
  if (sectionMatch?.[1]) {
    const paragraphMatch = sectionMatch[1].match(/<p[^>]*>([\s\S]*?)<\/p>/iu);
    if (paragraphMatch?.[1]) {
      return stripTags(paragraphMatch[1]);
    }
    const text = stripTags(sectionMatch[1]);
    if (text) return text.slice(0, 240);
  }

  const fallback = html.match(/ヌートリアは南米原産[\s\S]*?水辺を好み、河川や水路、ため池の近くでよく見かけます。/u);
  return fallback ? stripTags(fallback[0]).slice(0, 240) : "自治体が地域の目撃・被害情報を案内しています。";
}

function extractLinks(html: string, baseUrl: string): Array<{ label: string; url: string }> {
  const links: Array<{ label: string; url: string }> = [];
  const pattern = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/giu;
  let match: RegExpExecArray | null = null;
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1]?.trim();
    const label = stripTags(match[2] ?? "");
    if (!href) continue;
    links.push({
      label: label || href.split("/").pop() || href,
      url: absoluteUrl(href, baseUrl),
    });
  }
  return links;
}

function dedupeLinks(links: OfficialNoticeLink[]): OfficialNoticeLink[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.label}::${link.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractWarnings(html: string): string[] {
  const text = stripTags(html);
  const candidates = text
    .split(/(?<=[。！？])/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const warnings = candidates.filter((line) =>
    line.includes("触らないでください")
    || line.includes("許可なく捕獲")
    || line.includes("運搬、放出することなどが禁止")
    || line.includes("違法となり")
    || line.includes("罰せられる可能性"),
  );
  return Array.from(new Set(warnings)).slice(0, 3);
}

export function parseHamamatsuNutriaPage(input: {
  html: string;
  source: OfficialNoticeSource;
  fetchedAt: string;
}): OfficialNoticeSnapshot {
  const title = extractFirstMatch(input.html, /<h1[^>]*>([\s\S]*?)<\/h1>/iu) ?? "ヌートリア";
  const links = extractLinks(input.html, input.source.sourcePageUrl);
  const attachments = dedupeLinks(
    links.filter((link) => /\.pdf(?:$|\?)/i.test(link.url)),
  );
  const reportUrl = links.find((link) => link.label.includes("入力フォーム"))?.url ?? null;

  return {
    sourceId: input.source.id,
    parserKey: input.source.parserKey,
    schemaVersion: 1,
    issuer: input.source.issuer,
    sourcePageUrl: input.source.sourcePageUrl,
    pageUrl: input.source.sourcePageUrl,
    title,
    updatedAt: extractUpdatedAt(input.html),
    summary: extractSectionSummary(input.html),
    reportUrl,
    attachments,
    warnings: extractWarnings(input.html),
    fetchedAt: input.fetchedAt,
  };
}

export function isOfficialNoticeRelevant(
  source: OfficialNoticeSource,
  lat: number,
  lng: number,
  signals: SiteSignals,
): boolean {
  if (!pointInBbox(lat, lng, source.coverageBbox)) return false;
  if (typeof signals.waterDistanceM === "number" && signals.waterDistanceM <= source.habitatRules.maxWaterDistanceM) {
    return true;
  }
  const effective = [...signals.landcover, ...signals.nearbyLandcover];
  return source.habitatRules.landcoverAny.some((landcover) => effective.includes(landcover));
}

function buildWhyRelevant(
  source: OfficialNoticeSource,
  lat: number,
  lng: number,
  signals: SiteSignals,
  lang: BriefLang,
): string[] {
  const lines: string[] = [];
  if (pointInBbox(lat, lng, source.coverageBbox)) {
    lines.push(lang === "ja" ? "浜松市の対象範囲内です。" : "Inside the Hamamatsu coverage area.");
  }
  if (typeof signals.waterDistanceM === "number" && signals.waterDistanceM <= source.habitatRules.maxWaterDistanceM) {
    lines.push(
      lang === "ja"
        ? `水辺まで約 ${Math.round(signals.waterDistanceM)}m の地点です。`
        : `This point is about ${Math.round(signals.waterDistanceM)}m from water.`,
    );
  }
  const effective = [...signals.landcover, ...signals.nearbyLandcover];
  if (effective.includes("wetland")) {
    lines.push(lang === "ja" ? "湿地・水際の環境手がかりがあります。" : "Wetland or water-edge signals are present.");
  } else if (effective.includes("water")) {
    lines.push(lang === "ja" ? "水域に近い地形手がかりがあります。" : "Water-body signals are present nearby.");
  }
  return lines.slice(0, 3);
}

function buildNoticeCard(
  source: OfficialNoticeSource,
  snapshot: OfficialNoticeSnapshot,
  lat: number,
  lng: number,
  signals: SiteSignals,
  lang: BriefLang,
): OfficialNoticeCard {
  const actions: OfficialNoticeAction[] = [
    {
      kind: "open_source",
      label: lang === "ja" ? "自治体ページを見る" : "Open municipality page",
      url: snapshot.pageUrl,
    },
  ];
  if (snapshot.reportUrl) {
    actions.push({
      kind: "report",
      label: lang === "ja" ? "目撃情報フォーム" : "Report sighting",
      url: snapshot.reportUrl,
    });
  }

  const limits = snapshot.warnings.length > 0
    ? snapshot.warnings.slice(0, 2)
    : [lang === "ja" ? "対応や捕獲の可否は自治体ページの案内を確認してください。" : "Check the municipality page before taking action."];

  return {
    id: source.id,
    issuer: snapshot.issuer,
    title: snapshot.title,
    updatedAt: snapshot.updatedAt,
    summary: snapshot.summary,
    whyRelevant: buildWhyRelevant(source, lat, lng, signals, lang),
    actions,
    limits,
    attachments: snapshot.attachments,
    sourceUrl: snapshot.pageUrl,
  };
}

async function fetchNoticeSnapshot(
  source: OfficialNoticeSource,
  fetchImpl: FetchLike,
): Promise<OfficialNoticeSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(source.sourcePageUrl, {
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      throw new Error(`official_notice_fetch_failed:${response.status}`);
    }
    const html = await response.text();
    const parser = NOTICE_PARSERS[source.parserKey];
    return parser({
      html,
      source,
      fetchedAt: new Date().toISOString(),
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function getSourceSnapshot(
  source: OfficialNoticeSource,
  fetchImpl: FetchLike,
): Promise<OfficialNoticeSnapshot | null> {
  const cached = await getCachedOfficialNoticeSnapshot(source.id);
  if (cached && !cached.isExpired) {
    return cached.snapshot;
  }

  try {
    const fresh = await fetchNoticeSnapshot(source, fetchImpl);
    await putCachedOfficialNoticeSnapshot(
      source.id,
      source.parserKey,
      source.sourcePageUrl,
      fresh,
      source.ttlHours,
    );
    return fresh;
  } catch {
    return cached?.snapshot ?? null;
  }
}

export async function resolveOfficialNoticeCards(
  lat: number,
  lng: number,
  signals: SiteSignals,
  lang: BriefLang,
  fetchImpl: FetchLike = fetch,
): Promise<OfficialNoticeCard[]> {
  const candidates = OFFICIAL_NOTICE_SOURCES.filter((source) => pointInBbox(lat, lng, source.coverageBbox));
  if (candidates.length === 0) return [];

  const snapshots = await Promise.all(
    candidates.map(async (source) => ({
      source,
      snapshot: await getSourceSnapshot(source, fetchImpl).catch(() => null),
    })),
  );

  return snapshots
    .filter((entry) => entry.snapshot && isOfficialNoticeRelevant(entry.source, lat, lng, signals))
    .map((entry) => buildNoticeCard(entry.source, entry.snapshot!, lat, lng, signals, lang));
}
