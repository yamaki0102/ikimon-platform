import { escapeHtml } from "../ui/siteShell.js";
import { getPool } from "../db.js";

export type GlossaryTermHint = {
  id: string;
  label: string;
  aliases: string[];
  shortHint: string;
  href: string;
  scopeTags: string[];
  priority: number;
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
    shortHint: "生きものが接している土、石、樹皮、水面などの面です。どこに生えていた・止まっていたかを読み返す手がかりになります。",
    href: "",
    scopeTags: ["observation", "environment"],
    priority: 80,
  },
  {
    id: "ja:vegetation",
    label: "植生",
    aliases: [],
    shortHint: "その場所に生えている植物全体のようすです。草地、林、植え込みなどの違いが、場所を読み返す手がかりになります。",
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
    html += `<span class="term-hint" tabindex="0" role="note" aria-label="${hint}">${label}<span class="term-hint-pop">${hint}</span></span>`;
    cursor = match.end;
  }
  html += escapeHtml(text.slice(cursor));
  return html;
}
