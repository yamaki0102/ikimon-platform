import { escapeHtml } from "../ui/siteShell.js";
import { getPool } from "../db.js";
import type { PoolClient } from "pg";

export type GlossaryTermHint = {
  id: string;
  label: string;
  aliases: string[];
  shortHint: string;
  href: string;
  scopeTags: string[];
  priority: number;
};

export type GlossaryTermCandidate = {
  label: string;
  normalizedLabel: string;
  exampleText: string;
};

export type GlossaryCandidateLogResult = {
  candidateCount: number;
  labels: string[];
};

export const BUILTIN_GLOSSARY_TERMS_JA: GlossaryTermHint[] = [
  {
    id: "ja:sporangium-cluster",
    label: "胞子嚢群",
    aliases: ["ソーラス", "胞子嚢群（ソーラス）"],
    shortHint: "シダの葉裏などに並ぶ、胞子をつくる袋の集まりです。形や並び方がシダを見分ける手がかりになります。",
    href: "",
    scopeTags: ["observation", "plant", "fern"],
    priority: 10,
  },
  {
    id: "ja:sporangium",
    label: "胞子嚢",
    aliases: ["胞子のう"],
    shortHint: "胞子をつくる小さな袋です。シダでは葉裏に見えることが多く、並び方が記録の手がかりになります。",
    href: "",
    scopeTags: ["observation", "plant", "fern"],
    priority: 20,
  },
  {
    id: "ja:rachis-base",
    label: "葉柄基部",
    aliases: ["葉柄の基部"],
    shortHint: "葉の柄が根元や茎につながるあたりです。毛や鱗片の有無が見分けの材料になることがあります。",
    href: "",
    scopeTags: ["observation", "plant"],
    priority: 30,
  },
  {
    id: "ja:scale-hair",
    label: "鱗片",
    aliases: ["りん片"],
    shortHint: "薄い小片状の毛や皮のような部分です。シダでは葉柄や根元の鱗片の形・色が比較に役立ちます。",
    href: "",
    scopeTags: ["observation", "plant", "fern"],
    priority: 40,
  },
  {
    id: "ja:lobe",
    label: "裂片",
    aliases: ["花弁の裂片"],
    shortHint: "花びらや葉が切れ込んで分かれた一つひとつの部分です。形や深さを比べると違いを説明しやすくなります。",
    href: "",
    scopeTags: ["observation", "plant"],
    priority: 50,
  },
  {
    id: "ja:pappus",
    label: "冠毛",
    aliases: [],
    shortHint: "キク科の実につく、綿毛や毛のような部分です。色や形が似た仲間を比べる手がかりになります。",
    href: "",
    scopeTags: ["observation", "plant"],
    priority: 60,
  },
  {
    id: "ja:flower-head",
    label: "頭花",
    aliases: [],
    shortHint: "小さな花が集まって一つの花のように見えるまとまりです。キク科の観察でよく使う言葉です。",
    href: "",
    scopeTags: ["observation", "plant"],
    priority: 70,
  },
  {
    id: "ja:substrate",
    label: "基質",
    aliases: [],
    shortHint: "生きものが接している土、石、樹皮、水面などの面です。どこに生えていた・止まっていたかを確認する手がかりになります。",
    href: "",
    scopeTags: ["observation", "environment"],
    priority: 80,
  },
  {
    id: "ja:vegetation",
    label: "植生",
    aliases: [],
    shortHint: "その場所に生えている植物全体のようすです。草地、林、植え込みなどの違いが、場所を確認する手がかりになります。",
    href: "",
    scopeTags: ["observation", "environment", "plant"],
    priority: 84,
  },
  {
    id: "ja:ground-cover",
    label: "被覆",
    aliases: ["周辺の被覆"],
    shortHint: "地面や水面が植物、岩、雪、人工物などでどれくらい覆われているかです。暮らす場所の状態を比べやすくします。",
    href: "",
    scopeTags: ["observation", "environment"],
    priority: 86,
  },
  {
    id: "ja:disturbance",
    label: "攪乱",
    aliases: ["かく乱"],
    shortHint: "草刈り、踏みつけ、造成、増水などで環境が変わることです。生きものが出る理由や一時的な変化を読みやすくします。",
    href: "",
    scopeTags: ["observation", "environment"],
    priority: 88,
  },
  {
    id: "ja:scale-reference",
    label: "スケール参照",
    aliases: ["スケール"],
    shortHint: "大きさを比べるために一緒に写す物差しや手がかりです。写真だけでは分かりにくいサイズ感を後から確認できます。",
    href: "",
    scopeTags: ["observation", "photo"],
    priority: 90,
  },
  {
    id: "ja:gravel",
    label: "礫",
    aliases: ["小石"],
    shortHint: "砂より大きめの小石です。足元が土・砂・礫のどれに近いかで、場所の状態を後から比べやすくなります。",
    href: "",
    scopeTags: ["observation", "environment"],
    priority: 92,
  },
  {
    id: "ja:herbaceous",
    label: "草本",
    aliases: ["草本植物"],
    shortHint: "木のような硬い幹を持たない植物です。低い草地や足元の植物のようすを説明するときに使います。",
    href: "",
    scopeTags: ["observation", "plant", "environment"],
    priority: 94,
  },
];

const glossaryCache = new Map<string, { loadedAt: number; terms: GlossaryTermHint[] }>();
const GLOSSARY_CACHE_TTL_MS = 5 * 60 * 1000;
const JAPANESE_TERM_PATTERN =
  /[一-龯々ヵヶぁ-んァ-ヶー]{0,8}(?:胞子嚢群|胞子嚢|葉柄基部|葉柄|鱗片|裂片|冠毛|頭花|花冠|萼片|托葉|小葉|葉脈|鋸歯|腺毛|総苞|葯|柱頭|花序|小穂|苞|節間|基質|植生|被覆|攪乱|遷移|踏圧|湿性|乾性)[一-龯々ヵヶぁ-んァ-ヶー]{0,4}/gu;
const PAREN_TERM_PATTERN = /([一-龯々ヵヶぁ-んァ-ヶー]{2,18})（([一-龯々ヵヶぁ-んァ-ヶーA-Za-z0-9-]{2,28})）/gu;
const GLOSSARY_CANDIDATE_STOP_WORDS = new Set([
  "写真",
  "動画",
  "場所",
  "季節",
  "環境",
  "対象",
  "候補",
  "特徴",
  "状態",
  "記録",
  "確認",
  "全体",
  "周辺",
  "生息環境",
  "観察場所",
  "分類",
  "名前",
  "形状",
]);

type GlossaryQueryable = Pick<PoolClient, "query">;

export async function getGlossaryTermsForScope(options: {
  lang?: string;
  scopeTags?: string[];
} = {}): Promise<GlossaryTermHint[]> {
  const now = Date.now();
  const lang = options.lang ?? "ja";
  const scopeTags = options.scopeTags?.length ? options.scopeTags : ["observation"];
  const cacheKey = `${lang}:${scopeTags.slice().sort().join(",")}`;
  const cached = glossaryCache.get(cacheKey);
  if (cached && now - cached.loadedAt < GLOSSARY_CACHE_TTL_MS) {
    return cached.terms;
  }
  const fallbackTerms = lang === "ja" ? BUILTIN_GLOSSARY_TERMS_JA : [];
  try {
    const result = await getPool().query<{
      term_id: string;
      label: string;
      aliases: string[];
      short_hint: string;
      href: string;
      scope_tags: string[];
      priority: number;
    }>(
      `SELECT term_id, label, aliases, short_hint, href, scope_tags, priority
         FROM glossary_terms
        WHERE lang = $1
          AND active = true
          AND (scope_tags && $2::text[] OR cardinality($2::text[]) = 0)
        ORDER BY priority ASC, label ASC`,
      [lang, scopeTags],
    );
    const terms = result.rows.map((row) => ({
      id: row.term_id,
      label: row.label,
      aliases: row.aliases ?? [],
      shortHint: row.short_hint,
      href: row.href,
      scopeTags: row.scope_tags ?? [],
      priority: row.priority,
    }));
    const resolved = terms.length > 0 ? terms : fallbackTerms;
    glossaryCache.set(cacheKey, { loadedAt: now, terms: resolved });
    return resolved;
  } catch {
    glossaryCache.set(cacheKey, { loadedAt: now, terms: fallbackTerms });
    return fallbackTerms;
  }
}

export function normalizeGlossaryCandidateLabel(label: string): string {
  return label
    .normalize("NFKC")
    .replace(/[「」『』【】\[\](),.、。・\s]/gu, "")
    .replace(/^(?:その|この|同じ|周辺の|対象の)/u, "")
    .replace(/(?:の有無|の形状|の形|の配置|の並び方|の色|の反り|を見る|を確認|が見える)$/u, "")
    .trim()
    .toLowerCase();
}

function knownGlossaryLabels(terms: GlossaryTermHint[]): Set<string> {
  return new Set(
    terms.flatMap((term) => [term.label, ...term.aliases])
      .filter(Boolean)
      .map(normalizeGlossaryCandidateLabel)
      .filter(Boolean),
  );
}

function cleanupGlossaryCandidateLabel(label: string): string {
  return label
    .normalize("NFKC")
    .replace(/[「」『』【】\[\](),.、。]/gu, "")
    .replace(/^(?:その|この|同じ|周辺の|対象の)/u, "")
    .replace(/(?:の有無|の形状|の形|の配置|の並び方|の色|の反り|を見る|を確認|が見える)$/u, "")
    .trim();
}

function shouldKeepGlossaryCandidate(label: string, knownLabels: Set<string>): boolean {
  const normalized = normalizeGlossaryCandidateLabel(label);
  if (normalized.length < 2 || normalized.length > 40) return false;
  if (knownLabels.has(normalized)) return false;
  if (GLOSSARY_CANDIDATE_STOP_WORDS.has(label) || GLOSSARY_CANDIDATE_STOP_WORDS.has(normalized)) return false;
  if (/^[0-9a-z]+$/iu.test(normalized)) return false;
  if (/属$|科$|目$|種$|sp$/iu.test(normalized)) return false;
  return /[一-龯々ァ-ヶ]/u.test(label);
}

export function extractGlossaryTermCandidatesFromText(
  text: string,
  terms: GlossaryTermHint[] = BUILTIN_GLOSSARY_TERMS_JA,
  maxCandidates = 12,
): GlossaryTermCandidate[] {
  const knownLabels = knownGlossaryLabels(terms);
  const found = new Map<string, GlossaryTermCandidate>();
  const push = (rawLabel: string, exampleText: string): void => {
    const parts = rawLabel.split(/[とや、・]/u).map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) {
      parts.forEach((part) => push(part, exampleText));
      return;
    }
    const label = cleanupGlossaryCandidateLabel(rawLabel);
    if (!shouldKeepGlossaryCandidate(label, knownLabels)) return;
    const normalizedLabel = normalizeGlossaryCandidateLabel(label);
    if (!found.has(normalizedLabel)) {
      found.set(normalizedLabel, {
        label,
        normalizedLabel,
        exampleText: exampleText.trim().slice(0, 240),
      });
    }
  };
  for (const match of text.matchAll(PAREN_TERM_PATTERN)) {
    push(match[1] ?? "", text);
    push(match[2] ?? "", text);
  }
  for (const match of text.matchAll(JAPANESE_TERM_PATTERN)) {
    push(match[0] ?? "", text);
  }
  return Array.from(found.values()).slice(0, Math.max(0, maxCandidates));
}

export async function logGlossaryTermCandidatesFromAiOutput(options: {
  textBlocks: string[];
  lang?: string;
  scopeTags?: string[];
  sourceKind?: string;
  sourceId?: string;
  visitId?: string | null;
  occurrenceId?: string | null;
  aiRunId?: string | null;
  assessmentId?: string | null;
  client?: GlossaryQueryable;
}): Promise<GlossaryCandidateLogResult> {
  const lang = options.lang ?? "ja";
  if (lang !== "ja") return { candidateCount: 0, labels: [] };
  const text = options.textBlocks
    .map((block) => block.trim())
    .filter(Boolean)
    .join("\n");
  if (!text) return { candidateCount: 0, labels: [] };
  const scopeTags = options.scopeTags?.length ? options.scopeTags : ["observation"];
  const knownTerms = await getGlossaryTermsForScope({ lang, scopeTags });
  const candidates = extractGlossaryTermCandidatesFromText(text, knownTerms);
  if (candidates.length === 0) return { candidateCount: 0, labels: [] };
  const db = options.client ?? getPool();
  try {
    for (const candidate of candidates) {
      await db.query(
        `INSERT INTO glossary_term_candidates (
           lang, label, normalized_label, example_text, source_kind, source_id,
           visit_id, occurrence_id, ai_run_id, assessment_id, scope_tags
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9::uuid, $10::uuid, $11::text[]
         )
         ON CONFLICT (lang, normalized_label) DO UPDATE
         SET label = EXCLUDED.label,
             example_text = EXCLUDED.example_text,
             source_kind = EXCLUDED.source_kind,
             source_id = EXCLUDED.source_id,
             visit_id = EXCLUDED.visit_id,
             occurrence_id = EXCLUDED.occurrence_id,
             ai_run_id = EXCLUDED.ai_run_id,
             assessment_id = EXCLUDED.assessment_id,
             scope_tags = EXCLUDED.scope_tags,
             seen_count = glossary_term_candidates.seen_count + 1,
             last_seen_at = NOW()
         WHERE glossary_term_candidates.status = 'pending'`,
        [
          lang,
          candidate.label,
          candidate.normalizedLabel,
          candidate.exampleText,
          options.sourceKind ?? "ai_observation",
          options.sourceId ?? options.assessmentId ?? "",
          options.visitId ?? null,
          options.occurrenceId ?? null,
          options.aiRunId ?? null,
          options.assessmentId ?? null,
          scopeTags,
        ],
      );
    }
    return { candidateCount: candidates.length, labels: candidates.map((candidate) => candidate.label) };
  } catch {
    return { candidateCount: 0, labels: [] };
  }
}

type GlossaryMatch = {
  start: number;
  end: number;
  text: string;
  term: GlossaryTermHint;
};

function glossaryNeedles(terms: GlossaryTermHint[]): Array<{ text: string; term: GlossaryTermHint }> {
  return terms
    .flatMap((term) => [term.label, ...term.aliases].filter(Boolean).map((text) => ({ text, term })))
    .sort((a, b) => b.text.length - a.text.length || a.term.priority - b.term.priority);
}

function findGlossaryMatches(text: string, terms: GlossaryTermHint[]): GlossaryMatch[] {
  const matches: GlossaryMatch[] = [];
  const occupied = new Array(text.length).fill(false) as boolean[];
  for (const needle of glossaryNeedles(terms)) {
    let from = 0;
    while (from < text.length) {
      const start = text.indexOf(needle.text, from);
      if (start < 0) break;
      const end = start + needle.text.length;
      if (!occupied.slice(start, end).some(Boolean)) {
        matches.push({ start, end, text: needle.text, term: needle.term });
        for (let i = start; i < end; i += 1) occupied[i] = true;
      }
      from = end;
    }
  }
  return matches.sort((a, b) => a.start - b.start || b.end - a.end);
}

export function renderGlossaryText(
  text: string,
  terms: GlossaryTermHint[] = BUILTIN_GLOSSARY_TERMS_JA,
  maxMatches = 3,
): string {
  const matches = findGlossaryMatches(text, terms).slice(0, Math.max(0, maxMatches));
  if (matches.length === 0) return escapeHtml(text);
  let html = "";
  let cursor = 0;
  for (const match of matches) {
    html += escapeHtml(text.slice(cursor, match.start));
    const label = escapeHtml(match.text);
    const hint = escapeHtml(match.term.shortHint);
    html += `<span class="term-hint" tabindex="0" role="button" aria-expanded="false" aria-label="${hint}">${label}<span class="term-hint-pop">${hint}</span></span>`;
    cursor = match.end;
  }
  html += escapeHtml(text.slice(cursor));
  return html;
}
