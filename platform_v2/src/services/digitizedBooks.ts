import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { loadConfig } from "../config.js";

export type DigitizedBookUsagePolicy = {
  visibility: "internal_only";
  publicOutput: "citation_and_summary_only";
  rawScanHandling: "do_not_publish";
  note: string;
};

export type DigitizedBookCatalogEntry = {
  id: string;
  title: string;
  folderName: string;
  pageCount: number;
  coverImage: string | null;
  visibility: "internal_only";
  publicUsage: "citation_and_summary_only";
  usagePolicy: DigitizedBookUsagePolicy;
  updatedAt: string;
};

export type DigitizedBookPage = {
  pageIndex: number;
  pageNumber: number;
  filename: string;
  relativePath: string;
};

export type DigitizedBookManifest = {
  bookId: string;
  title: string;
  pageCount: number;
  pages: DigitizedBookPage[];
};

const DEFAULT_USAGE_POLICY: DigitizedBookUsagePolicy = {
  visibility: "internal_only",
  publicOutput: "citation_and_summary_only",
  rawScanHandling: "do_not_publish",
  note: "Raw scans are internal-only. Public output must stay at citation, summary, and factual metadata.",
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

function stableBookId(title: string): string {
  return `book_${createHash("sha1").update(title.trim().toLowerCase(), "utf8").digest("hex").slice(0, 12)}`;
}

async function readJsonFile<T>(filePaths: string[], fallback: T): Promise<T> {
  for (const filePath of filePaths) {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw) as T;
    } catch {
      continue;
    }
  }
  return fallback;
}

export async function readDigitizedBooksCatalog(query?: string, limit = 100): Promise<DigitizedBookCatalogEntry[]> {
  const items = await readJsonFile<DigitizedBookCatalogEntry[]>(
    libraryRoots().map((root) => path.join(root, "digitized_books_catalog.json")),
    [],
  );
  const normalized = (query ?? "").trim().toLowerCase();
  const filtered = normalized
    ? items.filter((item) => {
        const haystack = [item.title, item.folderName, item.id].join(" ").toLowerCase();
        return haystack.includes(normalized);
      })
    : items;
  return filtered.slice(0, Math.max(1, limit));
}

export async function readDigitizedBookManifest(
  bookId: string,
  limit = 100,
  offset = 0,
): Promise<DigitizedBookManifest | null> {
  const normalizedBookId = bookId.trim();
  if (!normalizedBookId) {
    return null;
  }

  const catalog = await readJsonFile<DigitizedBookCatalogEntry[]>(
    libraryRoots().map((root) => path.join(root, "digitized_books_catalog.json")),
    [],
  );
  const catalogEntry = catalog.find((item) => item.id === normalizedBookId);
  const manifest = await readJsonFile<DigitizedBookManifest | null>(
    libraryRoots().map((root) => path.join(root, "digitized_pages", `${normalizedBookId}.json`)),
    null,
  );

  if (!catalogEntry && !manifest) {
    return null;
  }

  const pages = manifest?.pages ?? [];
  return {
    bookId: normalizedBookId,
    title: manifest?.title ?? catalogEntry?.title ?? normalizedBookId,
    pageCount: manifest?.pageCount ?? catalogEntry?.pageCount ?? pages.length,
    pages: pages.slice(Math.max(0, offset), Math.max(0, offset) + Math.max(1, limit)),
  };
}

export async function readDigitizedBookDetail(
  bookId: string,
  limit = 100,
  offset = 0,
): Promise<{ book: DigitizedBookCatalogEntry | null; manifest: DigitizedBookManifest | null }> {
  const catalog = await readJsonFile<DigitizedBookCatalogEntry[]>(
    libraryRoots().map((root) => path.join(root, "digitized_books_catalog.json")),
    [],
  );
  const book = catalog.find((item) => item.id === bookId) ?? null;
  const manifest = await readDigitizedBookManifest(bookId, limit, offset);
  return { book, manifest };
}

export function emptyCatalogEntry(bookId: string, title?: string): DigitizedBookCatalogEntry {
  return {
    id: bookId || stableBookId(title ?? "unknown"),
    title: title ?? "Untitled Digitized Book",
    folderName: title ?? "unknown",
    pageCount: 0,
    coverImage: null,
    visibility: "internal_only",
    publicUsage: "citation_and_summary_only",
    usagePolicy: DEFAULT_USAGE_POLICY,
    updatedAt: new Date(0).toISOString(),
  };
}
