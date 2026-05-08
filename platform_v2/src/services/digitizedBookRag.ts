import { promises as fs } from "node:fs";
import path from "node:path";

import { loadConfig } from "../config.js";

export type DigitizedRagMentionType = "explicit" | "inferred";
export type DigitizedRagResultType = "continuity_chain" | "page_anchor";

export type DigitizedRagTaxon = {
  japaneseName: string | null;
  scientificName: string | null;
  group: string | null;
  mentionType: DigitizedRagMentionType;
  confidence: number;
};

export type DigitizedRagUsage = {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
};

export type DigitizedRagBookSummary = {
  bookId: string;
  title: string;
  pageCount: number;
  processedAt: string | null;
  schemaVersion: string | null;
  chainCount: number;
  retrievalUnitCount: number;
  usage: DigitizedRagUsage;
};

export type DigitizedRagSearchResult = {
  resultId: string;
  unitId: string;
  type: DigitizedRagResultType;
  bookId: string;
  bookTitle: string;
  articleId: string | null;
  pageStart: number;
  pageEnd: number;
  anchorPage: number | null;
  title: string | null;
  summary: string;
  facts: string[];
  keywords: string[];
  taxa: DigitizedRagTaxon[];
  score: number;
};

type DigitizedRagManifest = {
  schemaVersion?: string | null;
  book?: {
    id?: string;
    title?: string;
    pageCount?: number;
  };
  processing?: {
    processedAt?: string | null;
    usage?: Partial<DigitizedRagUsage>;
  };
  continuityChains?: Array<{
    chainId?: string;
    articleId?: string | null;
    sectionTitle?: string | null;
    pageStart?: number;
    pageEnd?: number;
    summary?: string;
    keywords?: string[];
    taxa?: DigitizedRagTaxon[];
  }>;
  retrievalUnits?: Array<{
    unitId?: string;
    type?: DigitizedRagResultType;
    articleId?: string | null;
    pageStart?: number;
    pageEnd?: number;
    anchorPage?: number | null;
    title?: string | null;
    summary?: string;
    facts?: string[];
    keywords?: string[];
    taxa?: DigitizedRagTaxon[];
  }>;
};

type SearchOptions = {
  q?: string;
  bookId?: string;
  type?: "all" | DigitizedRagResultType;
  limit?: number;
  offset?: number;
};

type SearchResponse = {
  book: DigitizedRagBookSummary | null;
  booksWithRag: number;
  query: string;
  type: "all" | DigitizedRagResultType;
  count: number;
  total: number;
  results: DigitizedRagSearchResult[];
};

function libraryRoot(): string {
  return path.join(loadConfig().legacyDataRoot, "library");
}

function fallbackLibraryRoot(): string {
  return path.resolve(process.cwd(), "../upload_package/data/library");
}

function libraryRoots(): string[] {
  return Array.from(new Set([libraryRoot(), fallbackLibraryRoot()]));
}

function ragRoots(): string[] {
  return libraryRoots().map((root) => path.join(root, "digitized_rag_pilot"));
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function listManifestPaths(): Promise<string[]> {
  const seen = new Set<string>();
  const manifestPaths: string[] = [];
  for (const root of ragRoots()) {
    try {
      const entries = await fs.readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json") || seen.has(entry.name)) {
          continue;
        }
        seen.add(entry.name);
        manifestPaths.push(path.join(root, entry.name));
      }
    } catch {
      continue;
    }
  }
  return manifestPaths;
}

async function readManifestByBookId(bookId: string): Promise<DigitizedRagManifest | null> {
  for (const root of ragRoots()) {
    const manifest = await readJsonFile<DigitizedRagManifest>(path.join(root, `${bookId}.json`));
    if (manifest) {
      return manifest;
    }
  }
  return null;
}

function normalizeUsage(usage: Partial<DigitizedRagUsage> | undefined): DigitizedRagUsage {
  return {
    promptTokenCount: Number(usage?.promptTokenCount ?? 0),
    candidatesTokenCount: Number(usage?.candidatesTokenCount ?? 0),
    totalTokenCount: Number(usage?.totalTokenCount ?? 0),
  };
}

function manifestSummary(bookId: string, manifest: DigitizedRagManifest): DigitizedRagBookSummary {
  return {
    bookId,
    title: manifest.book?.title ?? bookId,
    pageCount: Number(manifest.book?.pageCount ?? 0),
    processedAt: manifest.processing?.processedAt ?? null,
    schemaVersion: manifest.schemaVersion ?? null,
    chainCount: Array.isArray(manifest.continuityChains) ? manifest.continuityChains.length : 0,
    retrievalUnitCount: Array.isArray(manifest.retrievalUnits) ? manifest.retrievalUnits.length : 0,
    usage: normalizeUsage(manifest.processing?.usage),
  };
}

function normalizeTaxa(value: unknown): DigitizedRagTaxon[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      japaneseName: typeof item.japaneseName === "string" && item.japaneseName.trim() !== "" ? item.japaneseName : null,
      scientificName:
        typeof item.scientificName === "string" && item.scientificName.trim() !== "" ? item.scientificName : null,
      group: typeof item.group === "string" && item.group.trim() !== "" ? item.group : null,
      mentionType: item.mentionType === "inferred" ? "inferred" : "explicit",
      confidence: Math.max(0, Math.min(1, Number(item.confidence ?? 0))),
    }));
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)));
}

function flattenManifest(bookId: string, manifest: DigitizedRagManifest): DigitizedRagSearchResult[] {
  const bookTitle = manifest.book?.title ?? bookId;
  const results: DigitizedRagSearchResult[] = [];

  for (const chain of manifest.continuityChains ?? []) {
    const unitId = String(chain.chainId ?? "");
    const pageStart = Number(chain.pageStart ?? 0);
    const pageEnd = Number(chain.pageEnd ?? pageStart);
    results.push({
      resultId: `${bookId}:${unitId || `chain:${pageStart}-${pageEnd}`}`,
      unitId: unitId || `chain:${pageStart}-${pageEnd}`,
      type: "continuity_chain",
      bookId,
      bookTitle,
      articleId: typeof chain.articleId === "string" && chain.articleId.trim() !== "" ? chain.articleId : null,
      pageStart,
      pageEnd,
      anchorPage: null,
      title: typeof chain.sectionTitle === "string" && chain.sectionTitle.trim() !== "" ? chain.sectionTitle : null,
      summary: String(chain.summary ?? "").trim(),
      facts: [],
      keywords: normalizeStringArray(chain.keywords),
      taxa: normalizeTaxa(chain.taxa),
      score: 0,
    });
  }

  for (const unit of manifest.retrievalUnits ?? []) {
    if (unit.type !== "page_anchor") {
      continue;
    }
    const unitId = String(unit.unitId ?? "");
    const pageStart = Number(unit.pageStart ?? 0);
    const pageEnd = Number(unit.pageEnd ?? pageStart);
    results.push({
      resultId: `${bookId}:${unitId || `anchor:${pageStart}-${pageEnd}`}`,
      unitId: unitId || `anchor:${pageStart}-${pageEnd}`,
      type: "page_anchor",
      bookId,
      bookTitle,
      articleId: typeof unit.articleId === "string" && unit.articleId.trim() !== "" ? unit.articleId : null,
      pageStart,
      pageEnd,
      anchorPage: typeof unit.anchorPage === "number" ? unit.anchorPage : Number(unit.anchorPage ?? pageStart),
      title: typeof unit.title === "string" && unit.title.trim() !== "" ? unit.title : null,
      summary: String(unit.summary ?? "").trim(),
      facts: normalizeStringArray(unit.facts),
      keywords: normalizeStringArray(unit.keywords),
      taxa: normalizeTaxa(unit.taxa),
      score: 0,
    });
  }

  return results;
}

function scoreResult(result: DigitizedRagSearchResult, query: string): number {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return 1;
  }

  const compactText = (value: string): string =>
    value
      .toLowerCase()
      .replace(/[\s\u3000]+/g, "")
      .replace(/[?？!！、。,.・/\\()[\]{}「」『』:：;；"'`]/g, "");

  const buildFragments = (value: string): string[] => {
    const compact = compactText(value);
    const fragments = new Set<string>();
    for (const token of value.split(/\s+/).map((item) => item.trim().toLowerCase()).filter((item) => item.length >= 2)) {
      fragments.add(token);
    }
    for (let index = 0; index < compact.length - 1; index += 1) {
      fragments.add(compact.slice(index, index + 2));
    }
    return Array.from(fragments);
  };

  const title = (result.title ?? "").toLowerCase();
  const summary = result.summary.toLowerCase();
  const keywords = result.keywords.join(" ").toLowerCase();
  const facts = result.facts.join(" ").toLowerCase();
  const bookTitle = result.bookTitle.toLowerCase();
  const taxa = result.taxa
    .map((taxon) => [taxon.japaneseName, taxon.scientificName, taxon.group].filter(Boolean).join(" "))
    .join(" ")
    .toLowerCase();
  const articleId = (result.articleId ?? "").toLowerCase();
  const haystack = [title, summary, keywords, facts, bookTitle, taxa, articleId].join(" ");
  const compactHaystack = compactText(haystack);
  const fragments = buildFragments(normalized);

  let score = 0;
  if (title.includes(normalized)) score += 8;
  if (summary.includes(normalized)) score += 5;
  if (keywords.includes(normalized)) score += 4;
  if (taxa.includes(normalized)) score += 4;
  if (facts.includes(normalized)) score += 3;
  if (bookTitle.includes(normalized)) score += 2;
  if (articleId.includes(normalized)) score += 1;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    for (const token of tokens) {
      if (haystack.includes(token)) {
        score += 1;
      }
    }
  }

  let fragmentMatches = 0;
  for (const fragment of fragments) {
    if (fragment.length < 2) {
      continue;
    }
    if (compactHaystack.includes(fragment)) {
      fragmentMatches += 1;
    }
  }
  score += Math.min(fragmentMatches, 20) * 0.6;

  if (result.type === "continuity_chain") {
    score += 0.4;
  }

  return score;
}

export async function readDigitizedRagBook(bookId: string): Promise<DigitizedRagBookSummary | null> {
  const manifest = await readManifestByBookId(bookId.trim());
  if (!manifest) {
    return null;
  }
  return manifestSummary(bookId.trim(), manifest);
}

export async function searchDigitizedRag(options: SearchOptions = {}): Promise<SearchResponse> {
  const query = (options.q ?? "").trim();
  const type = options.type === "continuity_chain" || options.type === "page_anchor" ? options.type : "all";
  const limit = Math.min(200, Math.max(1, options.limit ?? 40));
  const offset = Math.max(0, options.offset ?? 0);

  const manifests: Array<{ bookId: string; manifest: DigitizedRagManifest }> = [];
  if (options.bookId?.trim()) {
    const manifest = await readManifestByBookId(options.bookId.trim());
    if (manifest) {
      manifests.push({ bookId: options.bookId.trim(), manifest });
    }
  } else {
    for (const manifestPath of await listManifestPaths()) {
      const manifest = await readJsonFile<DigitizedRagManifest>(manifestPath);
      if (!manifest) {
        continue;
      }
      manifests.push({
        bookId: path.basename(manifestPath, ".json"),
        manifest,
      });
    }
  }

  const allResults = manifests.flatMap(({ bookId, manifest }) => flattenManifest(bookId, manifest));
  const filtered = allResults
    .filter((result) => (type === "all" ? true : result.type === type))
    .map((result) => ({ ...result, score: scoreResult(result, query) }))
    .filter((result) => (query ? result.score > 0 : true));

  filtered.sort((left, right) => {
    if (query && right.score !== left.score) {
      return right.score - left.score;
    }
    if (left.bookTitle !== right.bookTitle) {
      return left.bookTitle.localeCompare(right.bookTitle, "ja");
    }
    if (left.pageStart !== right.pageStart) {
      return left.pageStart - right.pageStart;
    }
    if (left.type !== right.type) {
      return left.type === "continuity_chain" ? -1 : 1;
    }
    return left.resultId.localeCompare(right.resultId, "en");
  });

  const firstManifest = manifests[0];
  const selectedBook = options.bookId?.trim() && firstManifest ? manifestSummary(firstManifest.bookId, firstManifest.manifest) : null;

  return {
    book: selectedBook,
    booksWithRag: manifests.length,
    query,
    type,
    count: filtered.slice(offset, offset + limit).length,
    total: filtered.length,
    results: filtered.slice(offset, offset + limit),
  };
}
