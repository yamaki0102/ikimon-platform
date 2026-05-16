import { createHash } from "node:crypto";
import { getPool } from "../db.js";
import { buildPublicLocationSummary } from "./publicLocation.js";
import { canonicalizeSpeciesFeatures, canonicalizeTaxonList, type GuideRecordInsightFeature } from "./guideRecordInsights.js";

export type GuideSessionSummarySourceRow = {
  guideRecordId: string;
  sessionId: string;
  userId: string | null;
  occurrenceId?: string | null;
  observerName?: string | null;
  observerAvatarUrl?: string | null;
  lat: number | null;
  lng: number | null;
  sceneSummary: string | null;
  detectedSpecies: string[] | null;
  detectedFeatures: GuideRecordInsightFeature[] | null;
  capturedAt: string | null;
  returnedAt: string | null;
  createdAt: string;
  frameThumb?: string | null;
  primarySubject?: unknown;
  environmentContext?: string | null;
  seasonalNote?: string | null;
  meta?: Record<string, unknown> | null;
};

export type GuideSessionPublicSummary = {
  summaryId: string | null;
  userId: string;
  sessionId: string;
  observerName: string;
  observerAvatarUrl: string | null;
  recordCount: number;
  startedAt: string | null;
  endedAt: string | null;
  representativeGuideRecordId: string | null;
  headline: string;
  body: string;
  evidenceLine: string;
  motivationLine: string;
  claimBoundary: string;
  primaryTheme: "green" | "water" | "sound" | "place";
  featuredSubjects: string[];
  featureCounts: Record<string, number>;
  publicLocationLabel: string | null;
  mediaThumbUrl: string | null;
  sourceChecksum: string;
  href: string;
};

type DraftSummary = Omit<GuideSessionPublicSummary, "summaryId" | "href">;

function normalizeAssetUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) return value;
  return `/${value.replace(/^\.?\//, "")}`;
}

function timeMs(value: string | null | undefined): number {
  const ms = Date.parse(value ?? "");
  return Number.isFinite(ms) ? ms : 0;
}

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function rowTimeMs(row: GuideSessionSummarySourceRow): number {
  return timeMs(row.capturedAt ?? row.returnedAt ?? row.createdAt);
}

function primarySubjectName(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const name = (value as Record<string, unknown>).name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function cleanText(value: string | null | undefined): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function trimSentence(value: string | null | undefined, maxLength = 46): string | null {
  const text = cleanText(value)
    .replace(/[。.!！?？]+$/u, "")
    .replace(/^この(?:フレーム|画像|場面|記録)(?:では|で|に)?、?/u, "")
    .replace(/モーションブラーを伴う/g, "")
    .replace(/モーションブラー|ブラー/g, "");
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function isMeaningfulGuideSignal(text: string): boolean {
  if (/フレーム束|空間的な連続性|横断歩道|車道|駐車場|標識|看板|ロゴ|モーションブラー|ブラー/u.test(text)) return false;
  return /草|雑草|樹|林|森|木|葉|花|群落|水|水路|湿地|川|池|鳥|鳴き声|声|虫|昆虫|巣|穴|土|落葉|植生/u.test(text);
}

function friendlySubject(raw: string): string | null {
  const text = cleanText(raw);
  if (!text) return null;
  if (/舗装路|道路|線路|鉄道|防音壁|コンクリート|住宅|架線|電柱|看板|ロゴ/u.test(text)) return null;
  if (/常緑.*落葉|落葉.*常緑|樹林|二次林|竹林|広葉樹|幼樹/u.test(text)) return "樹林";
  if (/雑草|草地|草本|群落|つる植物|イネ科/u.test(text)) return "草地";
  if (/街路樹|樹木|樹|木|林/u.test(text)) return "樹木";
  if (/水辺|水路|湿地|川|池/u.test(text)) return "水辺";
  return text.length > 16 ? `${text.slice(0, 16)}…` : text;
}

function inferTheme(rows: GuideSessionSummarySourceRow[], subjects: string[]): GuideSessionPublicSummary["primaryTheme"] {
  const text = [
    ...subjects,
    ...rows.flatMap((row) => [
      row.sceneSummary,
      row.environmentContext,
      row.seasonalNote,
      primarySubjectName(row.primarySubject),
      ...(row.detectedSpecies ?? []),
      ...(row.detectedFeatures ?? []).map((feature) => `${feature.type ?? ""} ${feature.name ?? ""} ${feature.note ?? ""}`),
    ]),
  ].filter(Boolean).join(" ");
  if (/鳥の声|鳴き声|自然音|音声|sound/u.test(text)) return "sound";
  if (/水辺|水路|湿地|川|池|岸|用水/u.test(text)) return "water";
  if (/草|雑草|樹|林|竹|葉|植生|群落|花|街路樹|イネ科/u.test(text)) return "green";
  return "place";
}

function summarizeSubjects(rows: GuideSessionSummarySourceRow[]): string[] {
  const counts = new Map<string, number>();
  const add = (value: string | null | undefined, weight = 1) => {
    const subject = friendlySubject(value ?? "");
    if (!subject) return;
    counts.set(subject, (counts.get(subject) ?? 0) + weight);
  };
  for (const row of rows) {
    add(primarySubjectName(row.primarySubject), 4);
    for (const name of canonicalizeTaxonList(row.detectedSpecies ?? []).map((item) => item.canonicalName)) add(name, 3);
    for (const feature of canonicalizeSpeciesFeatures(row.detectedFeatures ?? [])) {
      if (feature.type === "species") add(feature.name, 3);
      if (feature.type === "vegetation" || feature.type === "landform") add(feature.name, 2);
    }
    add(row.environmentContext, 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    .map(([name]) => name)
    .slice(0, 3);
}

function compactSubjects(subjects: string[]): string[] {
  const unique = Array.from(new Set(subjects.map(cleanText).filter(Boolean)));
  if (unique.includes("樹林") && unique.length > 1) {
    return unique.filter((subject) => subject !== "樹木").slice(0, 2);
  }
  return unique.slice(0, 2);
}

function naturalList(items: string[]): string {
  const list = items.filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0]!;
  return `${list[0]}と${list[1]}`;
}

function isBroadSubject(value: string): boolean {
  return /^(草地|樹木|樹林|水辺|鳥の声)$/u.test(value);
}

function isSoundHighlight(value: string): boolean {
  return /鳥の声|鳴き声|音/u.test(value);
}

function extractSignalList(rows: GuideSessionSummarySourceRow[], key: "newSignals" | "continuedSignals" | "coverageHints"): string[] {
  const values: string[] = [];
  for (const row of rows) {
    const guideSignals = row.meta?.guideSignals;
    if (!guideSignals || typeof guideSignals !== "object" || Array.isArray(guideSignals)) continue;
    const raw = (guideSignals as Record<string, unknown>)[key];
    if (!Array.isArray(raw)) continue;
    for (const item of raw) {
      if (typeof item !== "string") continue;
      const text = trimSentence(item, 42);
      if (!text || /^(なし|不明|特になし|確認できない)$/u.test(text)) continue;
      if (!isMeaningfulGuideSignal(text)) continue;
      values.push(text);
    }
  }
  return Array.from(new Set(values)).slice(0, 3);
}

function summarizeContexts(rows: GuideSessionSummarySourceRow[], subjects: string[]): string[] {
  const subjectSet = new Set(subjects);
  const values: string[] = [];
  for (const row of rows) {
    for (const raw of [row.environmentContext, row.seasonalNote, row.sceneSummary]) {
      const text = trimSentence(raw, 34);
      if (!text) continue;
      const subjectOnly = Array.from(subjectSet).some((subject) => text === subject || text === `${subject}が写っている`);
      if (subjectOnly) continue;
      if (/^(ガイドで見た自然|自然の場面|周辺環境)$/u.test(text)) continue;
      values.push(text);
    }
  }
  return Array.from(new Set(values)).slice(0, 2);
}

function normalizeHighlight(raw: string | null | undefined): string | null {
  const text = trimSentence(raw, 36);
  if (!text) return null;
  if (/フレーム束|空間的な連続性|モーションブラー|横断歩道|駅構内|検出/u.test(text)) return null;
  if (/道路際歩道の雑草群落|道路際.*雑草群落/u.test(text)) return "道路際の雑草群落";
  if (/盛土植生/u.test(text)) return "盛土植生";
  if (/街路樹/u.test(text)) return "街路樹";
  if (/低木/u.test(text) && /タンポポ属/u.test(text)) return "低木とタンポポ属";
  if (/低木/u.test(text)) return "低木";
  if (/タンポポ属/u.test(text)) return "タンポポ属";
  if (/鳥の声|鳴き声/u.test(text)) return "鳥の声";
  if (/水路|水辺|湿地/u.test(text)) return "水辺";
  if (/雑草群落/u.test(text)) return "雑草群落";
  if (/草地|樹林|樹木/u.test(text)) return null;
  return text.length <= 18 ? text : null;
}

function extractHighlights(rows: GuideSessionSummarySourceRow[], subjects: string[], signals: string[], contexts: string[]): string[] {
  const subjectSet = new Set(subjects);
  const values: string[] = [];
  const add = (raw: string | null | undefined) => {
    const highlight = normalizeHighlight(raw);
    if (!highlight || (subjectSet.has(highlight) && isBroadSubject(highlight))) return;
    values.push(highlight);
  };
  for (const signal of signals) add(signal);
  for (const row of rows) {
    add(row.environmentContext);
    add(row.seasonalNote);
  }
  for (const context of contexts) add(context);
  for (const row of rows) {
    for (const feature of canonicalizeSpeciesFeatures(row.detectedFeatures ?? [])) add(feature.name);
    for (const species of canonicalizeTaxonList(row.detectedSpecies ?? []).map((item) => item.canonicalName)) add(species);
    add(row.sceneSummary);
  }
  return Array.from(new Set(values)).slice(0, 3);
}

function extractTaxonLabels(rows: GuideSessionSummarySourceRow[], subjects: string[], highlights: string[]): string[] {
  const blocked = new Set([...subjects, ...highlights].map(cleanText));
  const values: string[] = [];
  const add = (raw: string | null | undefined) => {
    const name = cleanText(raw);
    if (!name || blocked.has(name) || isBroadSubject(name)) return;
    if (/舗装|道路|歩道|街路樹|盛土|植生|群落|低木|樹林|樹木|草地|水辺|鳥の声/u.test(name)) return;
    if (name.length > 18) return;
    values.push(name);
  };
  for (const row of rows) {
    for (const taxon of canonicalizeTaxonList(row.detectedSpecies ?? [])) {
      if (taxon.rank === "species" || taxon.rank === "genus" || taxon.rank === "family" || taxon.rank === "lifeform") {
        add(taxon.canonicalName);
      }
    }
    const speciesFeatureNames = canonicalizeSpeciesFeatures(row.detectedFeatures ?? [])
      .filter((feature) => feature.type === "species")
      .map((feature) => String(feature.name ?? ""));
    for (const taxon of canonicalizeTaxonList(speciesFeatureNames)) add(taxon.canonicalName);
    const primary = primarySubjectName(row.primarySubject);
    if (primary && /属|科|種|類/u.test(primary)) add(primary);
  }
  return Array.from(new Set(values)).slice(0, 3);
}

function countFeatures(rows: GuideSessionSummarySourceRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    for (const feature of canonicalizeSpeciesFeatures(row.detectedFeatures ?? [])) {
      const type = String(feature.type ?? "other");
      counts[type] = (counts[type] ?? 0) + 1;
    }
    if ((row.detectedSpecies ?? []).length > 0) counts.species = (counts.species ?? 0) + (row.detectedSpecies ?? []).length;
  }
  return counts;
}

function absenceNotes(rows: GuideSessionSummarySourceRow[]): string[] {
  const notes: string[] = [];
  for (const row of rows) {
    const guideSignals = row.meta?.guideSignals;
    const boundary = guideSignals && typeof guideSignals === "object" && !Array.isArray(guideSignals)
      ? (guideSignals as Record<string, unknown>).absenceBoundary
      : null;
    if (!boundary || typeof boundary !== "object" || Array.isArray(boundary)) continue;
    const value = boundary as Record<string, unknown>;
    const state = typeof value.state === "string" ? value.state : "";
    const note = typeof value.note === "string" ? cleanText(value.note) : "";
    if (!isMeaningfulAbsenceNote(note)) continue;
    const explicitAbsence = state === "searched_not_found"
      || state === "absence_candidate"
      || state === "confirmed_absence"
      || /探した|見つからな|確認できな|未確認/u.test(note);
    if (explicitAbsence && note) notes.push(note);
  }
  return Array.from(new Set(notes)).slice(0, 2);
}

function isMeaningfulAbsenceNote(note: string): boolean {
  if (!note) return false;
  if (/画像に映っていない広範囲|広範囲な生物|広範囲な植生/u.test(note)) return false;
  if (/生物全般|動植物全般|何らかの生物/u.test(note) && !/生物個体|鳥|昆虫|虫|花|開花|草|樹|木|魚|両生|爬虫|哺乳|小動物|巣|足あと/u.test(note)) return false;
  if (/検出されません|検出されない|検出なし/u.test(note) && !/生物個体|探した|見つからな|確認できな|未確認/u.test(note)) return false;
  return /生物個体|鳥|昆虫|虫|花|開花|草|樹|木|魚|両生|爬虫|哺乳|小動物|巣|足あと|水生|外来|在来/u.test(note);
}

function absenceLabel(note: string | null | undefined): string | null {
  const original = cleanText(note);
  const text = original
    .replace(/この(?:フレーム束|画像|場面|記録)(?:では|で)?/gu, "")
    .replace(/通過したが、?/gu, "")
    .replace(/確認できない|確認できなかった|見つからない|見つからなかった/gu, "")
    .replace(/未確認/gu, "")
    .replace(/[。、，,]+$/u, "");
  const explicit = original;
  const match = explicit.match(/([^。、，,]{1,36}?)(?:は|が)(?:この[^。、，,]*では)?(?:確認できな|見つからな|未確認|検出されな|検出されません)/u);
  const label = cleanText(match?.[1] ?? text)
    .replace(/^.*(?:移動経路上|駅構内|駅周辺|道路沿い|歩道沿い|水路沿い)(?:で|の|に)?/u, "")
    .replace(/^(水路沿い|道路沿い|歩道沿い|周辺|範囲|場所)を?/u, "")
    .replace(/^(だが|では|で|は|が|、)+/u, "");
  if (!isMeaningfulAbsenceNote(label)) return null;
  if (!label) return null;
  return label.length > 18 ? null : label;
}

function publicAreaLabel(rows: GuideSessionSummarySourceRow[]): string | null {
  const points = rows
    .filter((row) => row.lat != null && row.lng != null)
    .map((row) => ({ lat: row.lat as number, lng: row.lng as number }));
  if (points.length === 0) return null;
  const labels = Array.from(new Set(points.map((point) => buildPublicLocationSummary({ latitude: point.lat, longitude: point.lng }).label)));
  const center = points.reduce((acc, point) => ({ lat: acc.lat + point.lat / points.length, lng: acc.lng + point.lng / points.length }), { lat: 0, lng: 0 });
  const coarse = center.lat >= 34.55 && center.lat <= 35.25 && center.lng >= 136.95 && center.lng <= 138.25
    ? "浜松市周辺"
    : center.lat >= 34.85 && center.lat <= 35.15 && center.lng >= 135.55 && center.lng <= 135.9
      ? "京都市周辺"
      : null;
  const baseLabel = labels.find((label) => !/位置をぼかしています/u.test(label)) ?? coarse ?? null;
  let maxDistance = 0;
  for (const a of points) {
    for (const b of points) maxDistance = Math.max(maxDistance, metersBetween(a, b));
  }
  if (!baseLabel) return maxDistance >= 5000 ? "複数地点・移動あり" : "位置は安全側";
  if (maxDistance >= 5000) return `${baseLabel}・移動あり`;
  if (labels.length > 1) return `${baseLabel}ほか`;
  return baseLabel;
}

function sourceChecksum(rows: GuideSessionSummarySourceRow[]): string {
  const payload = rows
    .slice()
    .sort((a, b) => a.guideRecordId.localeCompare(b.guideRecordId))
    .map((row) => ({
      id: row.guideRecordId,
      sessionId: row.sessionId,
      createdAt: row.createdAt,
      capturedAt: row.capturedAt,
      sceneSummary: row.sceneSummary,
      detectedSpecies: row.detectedSpecies,
      detectedFeatures: row.detectedFeatures,
      environmentContext: row.environmentContext,
      seasonalNote: row.seasonalNote,
      primarySubject: row.primarySubject,
      meta: row.meta,
    }));
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function representativeRow(rows: GuideSessionSummarySourceRow[]): GuideSessionSummarySourceRow {
  return rows.slice().sort((a, b) => {
    const aScore = (a.frameThumb ? 6 : 0) + (a.detectedSpecies?.length ?? 0) * 3 + (a.detectedFeatures?.length ?? 0) + (a.environmentContext ? 2 : 0);
    const bScore = (b.frameThumb ? 6 : 0) + (b.detectedSpecies?.length ?? 0) * 3 + (b.detectedFeatures?.length ?? 0) + (b.environmentContext ? 2 : 0);
    return bScore - aScore || rowTimeMs(b) - rowTimeMs(a);
  })[0] ?? rows[0]!;
}

type GuideSummaryCopyContext = {
  theme: GuideSessionPublicSummary["primaryTheme"];
  subjects: string[];
  highlights: string[];
  taxonLabels: string[];
  contexts: string[];
  newSignals: string[];
  continuedSignals: string[];
  coverageHints: string[];
  missingNotes: string[];
  recordCount: number;
};

function headlineFor(context: GuideSummaryCopyContext): string {
  const highlight = context.highlights[0];
  const main = context.subjects[0];
  const pair = naturalList(context.subjects);
  if (highlight && isSoundHighlight(highlight)) return `${highlight}を記録に残せた`;
  if (highlight) return `${highlight}を記録に残せた`;
  if (context.theme === "sound" && main) return `${main}を写真と音で残せた`;
  if (context.theme === "water" && main) return `${main}の水辺記録になった`;
  if (context.recordCount >= 8 && pair) return `${pair}のまとまった記録になった`;
  if (context.recordCount >= 2 && pair) return `${pair}を記録として残せた`;
  if (main) return `${main}を記録として残せた`;
  if (context.theme === "sound") return "写真と音を同じ記録にできた";
  if (context.theme === "water") return "水辺の状態を記録にできた";
  return "その場の状態を記録にできた";
}

function bodyFor(context: GuideSummaryCopyContext): string {
  const highlight = context.highlights[0];
  const taxonText = naturalList(context.taxonLabels.slice(0, 2));
  const pair = naturalList(context.subjects);
  const signal = context.newSignals[0] ?? context.continuedSignals[0] ?? context.coverageHints[0] ?? null;
  if (highlight && pair) {
    const companion = context.subjects.filter((subject) => subject !== highlight && !highlight.includes(subject)).slice(0, 2);
    const companionText = companion.length > 0 ? `と周辺の${naturalList(companion)}` : "";
    if (taxonText) return `${context.recordCount}シーンで、${highlight}と${taxonText}の候補を同じ記録に残しました。`;
    if (/盛土植生/u.test(highlight)) return `${context.recordCount}シーンで、${highlight}${companionText}を音も含めて残しました。`;
    if (/道路際の雑草群落/u.test(highlight)) return `${context.recordCount}シーンで、${highlight}${companionText}を同じ場面に残しました。`;
    if (/街路樹/u.test(highlight)) return `${context.recordCount}シーンで、${highlight}${companionText}を移動中の記録として残しました。`;
    if (/低木/u.test(highlight)) return `${context.recordCount}シーンで、${highlight}${companionText}が同じ場所の記録に入りました。`;
    return `${context.recordCount}シーンの中で、${highlight}${companionText}が見える記録になりました。`;
  }
  if (signal) return `${context.recordCount}シーンの中に、${signal}が記録されています。`;
  const placeContext = context.contexts[0];
  const media = context.theme === "sound" ? "写真・音・位置" : "写真・位置";
  if (pair && placeContext) return `${context.recordCount}シーン分の${media}で、${placeContext}の${pair}を残しました。`;
  if (pair) return `${context.recordCount}シーン分の${media}で、${pair}の場所と時刻をそろえました。`;
  return `${context.recordCount}シーン分の${media}で、名前が決まる前の状態を残しました。`;
}

function evidenceLineFor(context: GuideSummaryCopyContext): string {
  const highlight = context.highlights[0];
  const taxonText = naturalList(context.taxonLabels.slice(0, 2));
  const pair = naturalList(context.subjects) || "その場の状態";
  const missing = context.missingNotes[0];
  if (missing) {
    const missingLabel = absenceLabel(missing);
    return missingLabel
      ? `${pair}の記録に、${missingLabel}の未検出メモも添えています。`
      : `${pair}の記録に、未検出の範囲メモも添えています。`;
  }
  if (context.theme === "sound") {
    if (highlight && taxonText) return `${highlight}、${taxonText}の候補、周辺音が同じ時間帯に揃っています。`;
    return highlight
      ? `${highlight}、${pair}、周辺音が同じ時間帯に揃っています。`
      : `${pair}と周辺音が、同じ時間帯の記録として揃っています。`;
  }
  if (context.coverageHints[0]) return `${context.coverageHints[0]}の範囲で、位置と時刻が揃っています。`;
  return `${pair}に、位置と時刻が揃っています。`;
}

function motivationLineFor(context: GuideSummaryCopyContext): string {
  if (context.missingNotes.length > 0) return "見つかったものと見つからなかった情報を、同じ記録の中で扱えます。";
  if (context.taxonLabels[0]) return `${context.taxonLabels[0]}は候補名として、場所・時刻と一緒に残っています。`;
  if (context.newSignals[0]) return `新しく見えた点: ${context.newSignals[0]}`;
  if (context.continuedSignals[0]) return `続けて確認できた点: ${context.continuedSignals[0]}`;
  if (context.theme === "sound") return "画像だけでは残らない現地音も、記録の一部になりました。";
  return "種名が決まる前でも、場所・時刻・環境を成果として扱えます。";
}

export function buildGuideSessionPublicSummaries(rows: readonly GuideSessionSummarySourceRow[], userId: string): GuideSessionPublicSummary[] {
  const bySession = new Map<string, GuideSessionSummarySourceRow[]>();
  for (const row of rows) {
    if (!row.sessionId || row.userId !== userId) continue;
    const list = bySession.get(row.sessionId) ?? [];
    list.push(row);
    bySession.set(row.sessionId, list);
  }
  const summaries: GuideSessionPublicSummary[] = [];
  for (const [sessionId, sessionRows] of bySession) {
    const sorted = sessionRows.slice().sort((a, b) => rowTimeMs(a) - rowTimeMs(b));
    const first = sorted[0];
    if (!first) continue;
    const representative = representativeRow(sorted);
    const subjects = compactSubjects(summarizeSubjects(sorted));
    const missingNotes = absenceNotes(sorted);
    const theme = inferTheme(sorted, subjects);
    const contexts = summarizeContexts(sorted, subjects);
    const newSignals = extractSignalList(sorted, "newSignals");
    const continuedSignals = extractSignalList(sorted, "continuedSignals");
    const coverageHints = extractSignalList(sorted, "coverageHints");
    const highlights = extractHighlights(sorted, subjects, [...newSignals, ...continuedSignals, ...coverageHints], contexts);
    const copyContext: GuideSummaryCopyContext = {
      theme,
      subjects,
      highlights,
      taxonLabels: extractTaxonLabels(sorted, subjects, highlights),
      contexts,
      newSignals,
      continuedSignals,
      coverageHints,
      missingNotes,
      recordCount: sorted.length,
    };
    const publicLocationLabel = publicAreaLabel(sorted);
    const draft: DraftSummary = {
      userId,
      sessionId,
      observerName: first.observerName || "ガイド利用者",
      observerAvatarUrl: normalizeAssetUrl(first.observerAvatarUrl),
      recordCount: sorted.length,
      startedAt: new Date(rowTimeMs(first)).toISOString(),
      endedAt: new Date(rowTimeMs(sorted[sorted.length - 1] ?? first)).toISOString(),
      representativeGuideRecordId: representative.guideRecordId,
      headline: headlineFor(copyContext),
      body: bodyFor(copyContext),
      evidenceLine: evidenceLineFor(copyContext),
      motivationLine: motivationLineFor(copyContext),
      claimBoundary: "AIガイドの未検証サマリーです。増減・不在・保全効果は断言しません。",
      primaryTheme: theme,
      featuredSubjects: subjects,
      featureCounts: countFeatures(sorted),
      publicLocationLabel,
      mediaThumbUrl: normalizeAssetUrl(representative.frameThumb),
      sourceChecksum: sourceChecksum(sorted),
    };
    summaries.push({
      ...draft,
      summaryId: null,
      href: `/guide/outcomes?session=${encodeURIComponent(sessionId)}`,
    });
  }
  return summaries.sort((a, b) => timeMs(b.endedAt) - timeMs(a.endedAt));
}

export async function refreshGuideSessionPublicSummaries(rows: readonly GuideSessionSummarySourceRow[], userId: string): Promise<GuideSessionPublicSummary[]> {
  const summaries = buildGuideSessionPublicSummaries(rows, userId);
  if (summaries.length === 0) return [];
  const pool = getPool();
  const upserted: GuideSessionPublicSummary[] = [];
  try {
    for (const summary of summaries) {
      const result = await pool.query<{
        summary_id: string;
      }>(
        `insert into guide_session_public_summary
           (user_id, session_id, lang, visibility, record_count, started_at, ended_at,
            representative_guide_record_id, headline, body, evidence_line, motivation_line,
            claim_boundary, primary_theme, featured_subjects, feature_counts,
            public_location_label, observer_avatar_url, media_thumb_url, source_checksum, generated_by, summary_payload)
         values ($1, $2, 'ja', 'viewer_only', $3, $4, $5, $6::uuid, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, $17, $18, 'deterministic_biomonweek_v3', $19::jsonb)
         on conflict (user_id, session_id, lang) do update set
           visibility = excluded.visibility,
           record_count = excluded.record_count,
           started_at = excluded.started_at,
           ended_at = excluded.ended_at,
           representative_guide_record_id = excluded.representative_guide_record_id,
           headline = excluded.headline,
           body = excluded.body,
           evidence_line = excluded.evidence_line,
           motivation_line = excluded.motivation_line,
           claim_boundary = excluded.claim_boundary,
           primary_theme = excluded.primary_theme,
           featured_subjects = excluded.featured_subjects,
           feature_counts = excluded.feature_counts,
           public_location_label = excluded.public_location_label,
           observer_avatar_url = excluded.observer_avatar_url,
           media_thumb_url = excluded.media_thumb_url,
           source_checksum = excluded.source_checksum,
           generated_by = excluded.generated_by,
           summary_payload = excluded.summary_payload,
           updated_at = now()
         where guide_session_public_summary.source_checksum <> excluded.source_checksum
            or guide_session_public_summary.generated_by <> excluded.generated_by
         returning summary_id`,
        [
          summary.userId,
          summary.sessionId,
          summary.recordCount,
          summary.startedAt,
          summary.endedAt,
          summary.representativeGuideRecordId,
          summary.headline,
          summary.body,
          summary.evidenceLine,
          summary.motivationLine,
          summary.claimBoundary,
          summary.primaryTheme,
          summary.featuredSubjects,
          JSON.stringify(summary.featureCounts),
          summary.publicLocationLabel,
          summary.observerAvatarUrl,
          summary.mediaThumbUrl,
          summary.sourceChecksum,
          JSON.stringify({
            biomonweek: {
              monitoringBoundary: "same place/time/method first; no trend or absence claims from a single session",
            },
          }),
        ],
      );
      upserted.push({ ...summary, summaryId: result.rows[0]?.summary_id ?? summary.summaryId });
    }
    return upserted;
  } catch {
    return summaries;
  }
}

type GuideSessionSourceDbRow = {
  guide_record_id: string;
  session_id: string;
  user_id: string | null;
  occurrence_id: string | null;
  observer_name: string | null;
  observer_avatar_url: string | null;
  lat: string | number | null;
  lng: string | number | null;
  scene_summary: string | null;
  detected_species: string[] | null;
  detected_features: GuideRecordInsightFeature[] | null;
  captured_at: string | null;
  returned_at: string | null;
  created_at: string;
  frame_thumb: string | null;
  primary_subject: unknown;
  environment_context: string | null;
  seasonal_note: string | null;
  meta: Record<string, unknown> | null;
};

function toNumberOrNull(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function refreshGuideSessionPublicSummaryForSession(
  userId: string | null | undefined,
  sessionId: string,
): Promise<GuideSessionPublicSummary[]> {
  if (!userId || !sessionId) return [];
  const result = await getPool().query<GuideSessionSourceDbRow>(
    `select gr.guide_record_id::text as guide_record_id,
            gr.session_id,
            gr.user_id,
            gr.occurrence_id,
            coalesce(nullif(u.display_name, ''), gr.user_id, 'ガイド利用者') as observer_name,
            avatar.public_url as observer_avatar_url,
            gr.lat,
            gr.lng,
            gr.scene_summary,
            gr.detected_species,
            gr.detected_features,
            gr.created_at::text as created_at,
            gls.captured_at::text as captured_at,
            gls.returned_at::text as returned_at,
            gls.frame_thumb,
            gls.primary_subject,
            gls.environment_context,
            gls.seasonal_note,
            gls.meta
       from guide_records gr
       left join guide_record_latency_states gls on gls.guide_record_id = gr.guide_record_id
       left join users u on u.user_id = gr.user_id
       left join lateral (
         select coalesce(ab.public_url, ab.storage_path) as public_url
           from evidence_assets ea
           join asset_blobs ab on ab.blob_id = ea.blob_id
          where ea.asset_id = u.avatar_asset_id
          limit 1
       ) avatar on true
      where gr.user_id = $1
        and gr.session_id = $2
        and coalesce(gls.delivery_state, 'ready') <> 'archived'
      order by coalesce(gls.captured_at, gls.returned_at, gr.created_at) asc`,
    [userId, sessionId],
  );
  return refreshGuideSessionPublicSummaries(result.rows.map((row) => ({
    guideRecordId: row.guide_record_id,
    sessionId: row.session_id,
    userId: row.user_id,
    occurrenceId: row.occurrence_id,
    observerName: row.observer_name,
    observerAvatarUrl: row.observer_avatar_url,
    lat: toNumberOrNull(row.lat),
    lng: toNumberOrNull(row.lng),
    sceneSummary: row.scene_summary,
    detectedSpecies: row.detected_species,
    detectedFeatures: row.detected_features,
    capturedAt: row.captured_at,
    returnedAt: row.returned_at,
    createdAt: row.created_at,
    frameThumb: row.frame_thumb,
    primarySubject: row.primary_subject,
    environmentContext: row.environment_context,
    seasonalNote: row.seasonal_note,
    meta: row.meta,
  })), userId);
}
