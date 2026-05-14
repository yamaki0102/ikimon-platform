import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import sharp from "sharp";
import { loadConfig } from "../config.js";
import { getPool } from "../db.js";
import { generateAiTextWithRoleChain } from "./aiModelRouter.js";
import { upsertAssetBlob } from "./writeSupport.js";

type JsonRecord = Record<string, unknown>;

export type ReferenceTab = "owned" | "catalog" | "needs_review";

export type ReferenceCaptureItemInput = {
  filename?: string | null;
  mimeType?: string | null;
  base64Data?: string | null;
  title?: string | null;
  isbn?: string | null;
  doi?: string | null;
  url?: string | null;
  authorText?: string | null;
  publisher?: string | null;
  publicationYear?: number | string | null;
  taxonHints?: string[] | null;
  proofKind?: "cover" | "isbn" | "page" | "web_capture" | null;
};

export type ReferenceCaptureBatchInput = {
  userId: string;
  items: ReferenceCaptureItemInput[];
  countryCode?: string | null;
};

export type ReferenceTaxonLink = {
  taxonName: string;
  taxonRank: string;
  linkType: "ai_inferred" | "user_confirmed" | "reviewer_confirmed";
  confidence: number;
};

export type ReferenceAiExtraction = {
  title: string;
  isbn: string;
  doi: string;
  url: string;
  authorText: string;
  publisher: string;
  publicationYear: number | null;
  sourceKind: "field_guide" | "literature" | "web" | "book" | "unknown";
  taxonHints: string[];
  ecSearchKey: string;
  identificationUseCases: string[];
  confidence: number;
  needsReview: boolean;
  raw: JsonRecord;
};

export type ReferenceCaptureBatchResult = {
  ok: true;
  batchId: string;
  status: "completed" | "needs_review";
  ownedCount: number;
  needsReviewCount: number;
  items: Array<{
    sourceId: string;
    title: string;
    verificationStatus: "ai_verified" | "needs_review";
    taxonHints: string[];
    useCases: string[];
    duplicate: boolean;
  }>;
};

export type ReferenceProfileSummary = {
  ownedVerifiedCount: number;
  needsReviewCount: number;
  recent: Array<{
    sourceId: string;
    title: string;
    taxonLabels: string[];
    usedCount: number;
    status: string;
  }>;
};

export type ReferenceCommerceLink = {
  provider: string;
  countryCode: string;
  label: string;
  url: string;
  disclosureRequired: boolean;
  disclosureLabel: string;
  rel: "sponsored nofollow noopener";
};

export type ReferenceCard = {
  sourceId: string;
  title: string;
  authorText: string;
  publisher: string;
  publicationYear: number | null;
  isbn: string;
  doi: string;
  url: string;
  sourceKind: string;
  ownedStatus: "owned_verified" | "needs_review" | "not_owned";
  latestProofAt: string | null;
  usedCount: number;
  taxonLabels: string[];
  commerceLinks: ReferenceCommerceLink[];
  officialCorrectionCount: number;
};

export type ReferenceLibrarySnapshot = {
  tab: ReferenceTab;
  countryCode: string;
  summary: ReferenceProfileSummary;
  cards: ReferenceCard[];
};

export type ReferenceCandidate = {
  sourceId: string;
  title: string;
  authorText: string;
  publisher: string;
  publicationYear: number | null;
  isbn: string;
  taxonLabels: string[];
  owned: boolean;
  verificationStatus: string;
  linkType: string;
  usedCount: number;
  reason: string;
};

export type KnowledgeSourceCorrectionInput = {
  sourceId: string;
  locator?: string | null;
  originalName?: string | null;
  correctedName?: string | null;
  originalTaxonName?: string | null;
  correctedTaxonName?: string | null;
  correctionKind?: "misidentification" | "taxonomy_update" | "caption_error" | "distribution_update" | "other" | null;
  officialSourceUrl?: string | null;
  officialReference?: string | null;
  verificationStatus?: "pending" | "official_confirmed" | "rejected" | null;
  verifiedByUserId?: string | null;
  appliesFrom?: string | null;
  sourcePayload?: JsonRecord;
};

const VERIFIED_PROOF_STATUSES = new Set(["ai_verified", "user_confirmed", "reviewer_confirmed"]);

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean).slice(0, 12);
}

function clampConfidence(value: unknown, fallback = 0.5): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function normalizeYear(value: unknown): number | null {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 1500 || n > 2200) return null;
  return n;
}

export function normalizeReferenceIdentifier(value: string | null | undefined): string {
  return String(value ?? "").replace(/[^0-9Xx]/g, "").toUpperCase();
}

function normalizeUrl(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function sourceKindFromMetadata(input: {
  doi: string;
  url: string;
  isbn: string;
  sourceKind?: string | null;
}): ReferenceAiExtraction["sourceKind"] {
  const raw = String(input.sourceKind ?? "").trim();
  if (raw === "field_guide" || raw === "literature" || raw === "web" || raw === "book") return raw;
  if (input.doi) return "literature";
  if (input.url && !input.isbn) return "web";
  if (input.isbn) return "field_guide";
  return "unknown";
}

function cleanBase64(value: string): string {
  const comma = value.indexOf(",");
  return (comma >= 0 ? value.slice(comma + 1) : value).replace(/\s/g, "");
}

function sanitizePathPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 80) || "item";
}

function extensionForMime(mimeType: string): string {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return ".jpg";
}

async function normalizeReferenceProofImage(input: {
  base64Data: string;
  mimeType?: string | null;
}): Promise<{ buffer: Buffer; mimeType: string; widthPx: number | null; heightPx: number | null; sha256: string }> {
  const original = Buffer.from(cleanBase64(input.base64Data), "base64");
  if (original.byteLength === 0) throw new Error("reference_image_empty");
  if (original.byteLength > 18 * 1024 * 1024) throw new Error("reference_image_too_large");
  const output = await sharp(original, { failOn: "none" })
    .rotate()
    .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();
  const meta: { width?: number; height?: number } = await sharp(output, { failOn: "none" }).metadata().catch(() => ({}));
  return {
    buffer: output,
    mimeType: "image/jpeg",
    widthPx: typeof meta.width === "number" ? meta.width : null,
    heightPx: typeof meta.height === "number" ? meta.height : null,
    sha256: createHash("sha256").update(output).digest("hex"),
  };
}

async function storePrivateReferenceProofAsset(
  client: PoolClient,
  input: {
    userId: string;
    batchId: string;
    itemId: string;
    filename: string;
    base64Data: string;
    mimeType?: string | null;
    proofKind: string;
  },
): Promise<{ assetId: string; payload: JsonRecord }> {
  const config = loadConfig();
  const image = await normalizeReferenceProofImage({ base64Data: input.base64Data, mimeType: input.mimeType });
  const safeUserId = sanitizePathPart(input.userId);
  const safeFilename = sanitizePathPart(input.filename.replace(/\.[A-Za-z0-9]+$/, ""));
  const relativePath = path.posix.join(
    "reference-proofs",
    safeUserId,
    input.batchId,
    `${safeFilename}-${image.sha256.slice(0, 12)}${extensionForMime(image.mimeType)}`,
  );
  const absolutePath = path.join(config.legacyDataRoot, ...relativePath.split("/"));
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, image.buffer);

  const blobId = await upsertAssetBlob(client, {
    storageBackend: "local_private_fs",
    storagePath: relativePath,
    mediaType: "image",
    mimeType: image.mimeType,
    publicUrl: null,
    sha256: image.sha256,
    bytes: image.buffer.byteLength,
    widthPx: image.widthPx,
    heightPx: image.heightPx,
    sourcePayload: {
      source: "reference_access_proof",
      proof_kind: input.proofKind,
      private_storage_root: "legacy_data",
      public_url_forbidden: true,
      rag_prompt_forbidden: true,
      ocr_full_text_forbidden: true,
    },
  });

  const legacyAssetKey = `reference_access_proof:${input.userId}:${input.batchId}:${image.sha256}`;
  const assetResult = await client.query<{ asset_id: string }>(
    `insert into evidence_assets (
        asset_id, blob_id, asset_role, legacy_asset_key, legacy_relative_path, source_payload
     ) values (
        $1::uuid, $2::uuid, 'reference_access_proof', $3, $4, $5::jsonb
     )
     on conflict (legacy_asset_key) do update set
        blob_id = excluded.blob_id,
        legacy_relative_path = excluded.legacy_relative_path,
        source_payload = excluded.source_payload
     returning asset_id::text`,
    [
      randomUUID(),
      blobId,
      legacyAssetKey,
      relativePath,
      JSON.stringify({
        source: "reference_access_proof",
        filename: input.filename,
        proof_kind: input.proofKind,
        private_storage_root: "legacy_data",
        public_url_forbidden: true,
        rag_prompt_forbidden: true,
        ocr_full_text_forbidden: true,
      }),
    ],
  );

  const assetId = assetResult.rows[0]?.asset_id;
  if (!assetId) throw new Error("reference_proof_asset_insert_failed");
  return {
    assetId,
    payload: {
      sha256: image.sha256,
      storagePath: relativePath,
      mimeType: image.mimeType,
      bytes: image.buffer.byteLength,
      widthPx: image.widthPx,
      heightPx: image.heightPx,
    },
  };
}

function extractionFromManualInput(item: ReferenceCaptureItemInput): ReferenceAiExtraction {
  const isbn = normalizeReferenceIdentifier(item.isbn);
  const doi = String(item.doi ?? "").trim();
  const url = normalizeUrl(item.url);
  const title = String(item.title ?? "").trim();
  const authorText = String(item.authorText ?? "").trim();
  const publisher = String(item.publisher ?? "").trim();
  const publicationYear = normalizeYear(item.publicationYear);
  const taxonHints = Array.isArray(item.taxonHints) ? item.taxonHints.map((v) => String(v).trim()).filter(Boolean) : [];
  const sourceKind = sourceKindFromMetadata({ doi, url, isbn });
  return {
    title,
    isbn,
    doi,
    url,
    authorText,
    publisher,
    publicationYear,
    sourceKind,
    taxonHints,
    ecSearchKey: [isbn, title, authorText].filter(Boolean).join(" "),
    identificationUseCases: [],
    confidence: title || isbn || doi || url ? 0.62 : 0.2,
    needsReview: !(title || isbn || doi || url),
    raw: { source: "manual_or_local_fallback" },
  };
}

function mergeExtraction(manual: ReferenceAiExtraction, ai: ReferenceAiExtraction | null): ReferenceAiExtraction {
  if (!ai) return manual;
  const taxonHints = Array.from(new Set([...manual.taxonHints, ...ai.taxonHints].map((item) => item.trim()).filter(Boolean))).slice(0, 12);
  return {
    title: manual.title || ai.title,
    isbn: manual.isbn || ai.isbn,
    doi: manual.doi || ai.doi,
    url: manual.url || ai.url,
    authorText: manual.authorText || ai.authorText,
    publisher: manual.publisher || ai.publisher,
    publicationYear: manual.publicationYear ?? ai.publicationYear,
    sourceKind: manual.sourceKind !== "unknown" ? manual.sourceKind : ai.sourceKind,
    taxonHints,
    ecSearchKey: manual.ecSearchKey || ai.ecSearchKey,
    identificationUseCases: ai.identificationUseCases.length ? ai.identificationUseCases : manual.identificationUseCases,
    confidence: Math.max(manual.confidence, ai.confidence),
    needsReview: manual.needsReview && ai.needsReview,
    raw: { manual: manual.raw, ai: ai.raw },
  };
}

function parseAiExtractionJson(rawText: string): ReferenceAiExtraction | null {
  const trimmed = rawText.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as JsonRecord;
    const isbn = normalizeReferenceIdentifier(asString(parsed.isbn));
    const doi = asString(parsed.doi);
    const url = normalizeUrl(asString(parsed.url));
    const sourceKind = sourceKindFromMetadata({ doi, url, isbn, sourceKind: asString(parsed.source_kind || parsed.sourceKind) });
    const title = asString(parsed.title);
    return {
      title,
      isbn,
      doi,
      url,
      authorText: asString(parsed.author_text || parsed.authorText || parsed.authors),
      publisher: asString(parsed.publisher),
      publicationYear: normalizeYear(parsed.publication_year ?? parsed.publicationYear),
      sourceKind,
      taxonHints: asStringArray(parsed.taxon_candidates ?? parsed.taxonHints ?? parsed.taxa),
      ecSearchKey: asString(parsed.ec_search_key ?? parsed.ecSearchKey) || [isbn, title].filter(Boolean).join(" "),
      identificationUseCases: asStringArray(parsed.identification_use_cases ?? parsed.identificationUseCases),
      confidence: clampConfidence(parsed.confidence, title || isbn ? 0.68 : 0.4),
      needsReview: parsed.needs_review === true || !(title || isbn || doi || url),
      raw: parsed,
    };
  } catch {
    return null;
  }
}

async function extractReferenceMetadataWithAi(item: ReferenceCaptureItemInput): Promise<ReferenceAiExtraction | null> {
  const imageData = String(item.base64Data ?? "").trim();
  if (!imageData) return null;
  try {
    const response = await generateAiTextWithRoleChain({
      chainName: "referenceCoverExtract",
      responseMimeType: "application/json",
      temperature: 0,
      maxOutputTokens: 700,
      systemInstruction: [
        "You extract metadata from a field guide, book, paper, or web-reference cover/ISBN image.",
        "Return JSON only. Do not transcribe page body text. Do not identify species from copyrighted page content.",
        "The goal is catalog metadata and broad taxon usefulness for future identification suggestions.",
      ].join(" "),
      parts: [
        {
          text: [
            "Extract these fields if visible or infer cautiously:",
            "title, isbn, doi, url, author_text, publisher, publication_year, source_kind, taxon_candidates, ec_search_key, identification_use_cases, confidence, needs_review.",
            "source_kind must be one of field_guide, literature, web, book, unknown.",
            "taxon_candidates should be broad labels such as 鳥類, カラス類, 日本産鳥類, 昆虫, 植物.",
          ].join("\n"),
        },
        {
          inlineData: {
            mimeType: item.mimeType?.trim() || "image/jpeg",
            data: cleanBase64(imageData),
          },
        },
      ],
      cost: {
        layer: "warm",
        endpoint: "reference_cover_extract",
        metadata: { inputKind: "reference_cover" },
      },
    });
    return parseAiExtractionJson(response.text);
  } catch {
    return null;
  }
}

function addTaxonLink(
  links: Map<string, ReferenceTaxonLink>,
  taxonName: string,
  taxonRank: string,
  confidence: number,
  linkType: ReferenceTaxonLink["linkType"] = "ai_inferred",
): void {
  const name = taxonName.trim();
  if (!name) return;
  const key = `${name.toLowerCase()}:${taxonRank.toLowerCase()}:${linkType}`;
  const existing = links.get(key);
  if (!existing || existing.confidence < confidence) {
    links.set(key, {
      taxonName: name,
      taxonRank: taxonRank.trim(),
      linkType,
      confidence: Math.max(0, Math.min(1, confidence)),
    });
  }
}

export function inferReferenceTaxonLinks(input: Pick<ReferenceAiExtraction, "title" | "taxonHints" | "sourceKind">): ReferenceTaxonLink[] {
  const text = [input.title, ...input.taxonHints].join(" ").toLowerCase();
  const links = new Map<string, ReferenceTaxonLink>();

  for (const hint of input.taxonHints) {
    addTaxonLink(links, hint, "group", 0.62);
  }

  if (/ハシブトガラス|ハシボソガラス|カラス|からす|corvus|crow/u.test(text)) {
    addTaxonLink(links, "カラス類", "family", 0.82);
    addTaxonLink(links, "鳥類", "class", 0.76);
    addTaxonLink(links, "日本産鳥類", "group", /日本|japan/u.test(text) ? 0.74 : 0.66);
  }
  if (/鳥|野鳥|bird|aves|avian/u.test(text)) {
    addTaxonLink(links, "鳥類", "class", 0.78);
    if (/日本|japan/u.test(text)) addTaxonLink(links, "日本産鳥類", "group", 0.76);
  }
  if (/昆虫|虫|insect|蝶|チョウ|butterfly|moth/u.test(text)) {
    addTaxonLink(links, "昆虫", "class", 0.76);
    if (/蝶|チョウ|butterfly/u.test(text)) addTaxonLink(links, "チョウ類", "order", 0.72);
  }
  if (/植物|草花|樹木|botany|plant|flora|tree/u.test(text)) {
    addTaxonLink(links, "植物", "kingdom", 0.76);
  }
  if (/魚|fish|淡水魚|海水魚/u.test(text)) {
    addTaxonLink(links, "魚類", "group", 0.74);
  }
  if (/哺乳|mammal/u.test(text)) {
    addTaxonLink(links, "哺乳類", "class", 0.74);
  }
  if (/爬虫|reptile|両生|amphibian/u.test(text)) {
    addTaxonLink(links, "爬虫類・両生類", "group", 0.72);
  }

  return [...links.values()].sort((a, b) => b.confidence - a.confidence);
}

export function buildIdentificationTaxonSearchTerms(input: {
  proposedName?: string | null;
  vernacularName?: string | null;
  scientificName?: string | null;
  taxonRank?: string | null;
  genus?: string | null;
  family?: string | null;
  orderName?: string | null;
  className?: string | null;
}): string[] {
  const terms = new Set<string>();
  [
    input.proposedName,
    input.vernacularName,
    input.scientificName,
    input.genus,
    input.family,
    input.orderName,
    input.className,
  ].forEach((value) => {
    const text = String(value ?? "").trim();
    if (text) terms.add(text);
  });
  const joined = [...terms].join(" ").toLowerCase();
  if (/ハシブトガラス|ハシボソガラス|カラス|corvus|crow/u.test(joined)) {
    terms.add("カラス類");
    terms.add("鳥類");
    terms.add("日本産鳥類");
  }
  if (/鳥|野鳥|aves|bird|カラス/u.test(joined)) {
    terms.add("鳥類");
    terms.add("日本産鳥類");
  }
  if (/昆虫|チョウ|蝶|insect|butterfly/u.test(joined)) terms.add("昆虫");
  if (/植物|plant|flora/u.test(joined)) terms.add("植物");
  return [...terms].filter(Boolean).slice(0, 20);
}

async function findExistingSourceId(client: PoolClient, extraction: ReferenceAiExtraction): Promise<string | null> {
  if (extraction.isbn) {
    const result = await client.query<{ source_id: string }>(
      `select source_id::text
         from knowledge_source_reference_metadata
        where regexp_replace(coalesce(isbn, ''), '[^0-9Xx]', '', 'g') = $1
        limit 1`,
      [extraction.isbn],
    );
    if (result.rows[0]?.source_id) return result.rows[0].source_id;
  }
  if (extraction.doi) {
    const result = await client.query<{ source_id: string }>(
      `select source_id::text from knowledge_sources where lower(doi) = lower($1) limit 1`,
      [extraction.doi],
    );
    if (result.rows[0]?.source_id) return result.rows[0].source_id;
  }
  if (extraction.url) {
    const result = await client.query<{ source_id: string }>(
      `select source_id::text from knowledge_sources where url = $1 limit 1`,
      [extraction.url],
    );
    if (result.rows[0]?.source_id) return result.rows[0].source_id;
  }
  if (extraction.title) {
    const result = await client.query<{ source_id: string }>(
      `select source_id::text
         from knowledge_sources
        where lower(btrim(title)) = lower(btrim($1))
          and lower(btrim(coalesce(publisher, ''))) = lower(btrim($2))
          and coalesce(publication_year, 0) = coalesce($3::integer, 0)
        order by created_at asc
        limit 1`,
      [extraction.title, extraction.publisher, extraction.publicationYear],
    );
    if (result.rows[0]?.source_id) return result.rows[0].source_id;
  }
  return null;
}

async function upsertKnowledgeSourceReferenceMetadata(
  client: PoolClient,
  input: {
    sourceId: string;
    extraction: ReferenceAiExtraction;
    catalogStatus: string;
  },
): Promise<void> {
  await client.query(
    `insert into knowledge_source_reference_metadata (
        source_id, isbn, author_text, catalog_status, ai_extract_payload, created_at, updated_at
     ) values (
        $1::uuid, nullif($2, ''), $3, $4, $5::jsonb, now(), now()
     )
     on conflict (source_id) do update set
        isbn = coalesce(nullif(knowledge_source_reference_metadata.isbn, ''), excluded.isbn),
        author_text = coalesce(nullif(knowledge_source_reference_metadata.author_text, ''), excluded.author_text),
        catalog_status = case
          when knowledge_source_reference_metadata.catalog_status = 'active' then knowledge_source_reference_metadata.catalog_status
          else excluded.catalog_status
        end,
        ai_extract_payload = coalesce(knowledge_source_reference_metadata.ai_extract_payload, '{}'::jsonb) || excluded.ai_extract_payload,
        updated_at = now()`,
    [
      input.sourceId,
      input.extraction.isbn,
      input.extraction.authorText,
      input.catalogStatus,
      JSON.stringify(input.extraction.raw),
    ],
  );
}

async function upsertKnowledgeSourceFromExtraction(
  client: PoolClient,
  extraction: ReferenceAiExtraction,
): Promise<{ sourceId: string; duplicate: boolean }> {
  const existingId = await findExistingSourceId(client, extraction);
  const title = extraction.title || extraction.ecSearchKey || "未整理の参照資料";
  const citation = [
    extraction.authorText,
    title,
    extraction.publisher,
    extraction.publicationYear ? String(extraction.publicationYear) : "",
  ].filter(Boolean).join(" / ").slice(0, 600);
  const status = extraction.needsReview || extraction.confidence < 0.55 ? "needs_review" : "active";
  const payload = {
    source: "reference_capture",
    ec_search_key: extraction.ecSearchKey,
    identification_use_cases: extraction.identificationUseCases,
    copyright_policy: "metadata_only_no_page_text",
  };

  if (existingId) {
    await client.query(
      `update knowledge_sources
          set title = case when title = '' then $2 else title end,
              source_kind = case when source_kind = '' or source_kind = 'literature' and $3 <> 'literature' then $3 else source_kind end,
              doi = coalesce(nullif(doi, ''), nullif($4, '')),
              url = coalesce(nullif(url, ''), nullif($5, '')),
              publisher = coalesce(nullif(publisher, ''), $6),
              publication_year = coalesce(publication_year, $7),
              citation_text = case when citation_text = '' then $8 else citation_text end,
              source_payload = coalesce(source_payload, '{}'::jsonb) || $9::jsonb,
              updated_at = now()
        where source_id = $1::uuid`,
      [
        existingId,
        title,
        extraction.sourceKind,
        extraction.doi,
        extraction.url,
        extraction.publisher,
        extraction.publicationYear,
        citation,
        JSON.stringify(payload),
      ],
    );
    await upsertKnowledgeSourceReferenceMetadata(client, { sourceId: existingId, extraction, catalogStatus: status });
    return { sourceId: existingId, duplicate: true };
  }

  const result = await client.query<{ source_id: string }>(
    `insert into knowledge_sources (
        source_kind, source_provider, title, doi, url, publisher, publication_year,
        access_policy, citation_text, source_payload, created_at, updated_at
     ) values (
        $1, 'user_reference_capture', $2, nullif($3, ''), nullif($4, ''), $5, $6,
        'metadata_only', $7, $8::jsonb, now(), now()
     )
     returning source_id::text`,
    [
      extraction.sourceKind,
      title,
      extraction.doi,
      extraction.url,
      extraction.publisher,
      extraction.publicationYear,
      citation,
      JSON.stringify(payload),
    ],
  );
  const sourceId = result.rows[0]?.source_id;
  if (!sourceId) throw new Error("knowledge_source_insert_failed");
  await upsertKnowledgeSourceReferenceMetadata(client, { sourceId, extraction, catalogStatus: status });
  return { sourceId, duplicate: false };
}

async function upsertTaxonLinks(
  client: PoolClient,
  input: { sourceId: string; userId: string; links: ReferenceTaxonLink[] },
): Promise<void> {
  for (const link of input.links.slice(0, 16)) {
    await client.query(
      `insert into knowledge_source_taxon_links (
          source_id, taxon_name, taxon_rank, link_type, confidence, created_by_user_id, source_payload, created_at, updated_at
       ) values (
          $1::uuid, $2, $3, $4, $5, $6, $7::jsonb, now(), now()
       )
       on conflict do nothing`,
      [
        input.sourceId,
        link.taxonName,
        link.taxonRank,
        link.linkType,
        link.confidence,
        input.userId,
        JSON.stringify({ source: "reference_capture_ai_classification" }),
      ],
    );
  }
}

async function insertAccessProof(
  client: PoolClient,
  input: {
    userId: string;
    sourceId: string;
    batchId: string;
    proofAssetId: string | null;
    proofKind: string;
    verificationStatus: "ai_verified" | "needs_review";
    aiPayload: JsonRecord;
  },
): Promise<void> {
  await client.query(
    `insert into user_reference_access_proofs (
        user_id, source_id, proof_asset_id, batch_id, proof_kind, verification_status,
        ai_check_payload, private_use_only, created_at, updated_at
     ) values (
        $1, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7::jsonb, true, now(), now()
     )
     on conflict do nothing`,
    [
      input.userId,
      input.sourceId,
      input.proofAssetId,
      input.batchId,
      input.proofKind,
      input.verificationStatus,
      JSON.stringify(input.aiPayload),
    ],
  );
}

export function resolveCommerceCountryCode(input: {
  userCountryCode?: string | null;
  locale?: string | null;
  acceptLanguage?: string | null;
}): string {
  const explicit = String(input.userCountryCode ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(explicit)) return explicit;

  const locale = String(input.locale ?? "").trim();
  const localeRegion = locale.match(/[-_]([A-Za-z]{2})\b/)?.[1]?.toUpperCase();
  if (localeRegion && /^[A-Z]{2}$/.test(localeRegion)) return localeRegion;
  if (/^ja\b/i.test(locale)) return "JP";
  if (/^pt\b/i.test(locale)) return "BR";
  if (/^es\b/i.test(locale)) return "ES";
  if (/^en\b/i.test(locale)) return "US";

  const langs = String(input.acceptLanguage ?? "").split(",");
  for (const lang of langs) {
    const region = lang.trim().match(/[-_]([A-Za-z]{2})\b/)?.[1]?.toUpperCase();
    if (region && /^[A-Z]{2}$/.test(region)) return region;
    if (/^ja\b/i.test(lang)) return "JP";
    if (/^pt\b/i.test(lang)) return "BR";
    if (/^es\b/i.test(lang)) return "ES";
    if (/^en\b/i.test(lang)) return "US";
  }
  return "JP";
}

async function enqueueCommerceDiscoveryJobsForSource(
  client: PoolClient,
  input: { sourceId: string; countryCode: string; extraction: ReferenceAiExtraction },
): Promise<void> {
  const providers = await client.query<{ provider_id: string; provider: string; api_mode: string; country_code: string }>(
    `select provider_id::text, provider, api_mode, country_code
       from commerce_providers
      where enabled = true
        and country_code = $1
      order by provider asc`,
    [input.countryCode],
  );
  for (const provider of providers.rows) {
    await client.query(
      `insert into commerce_link_discovery_jobs (
          source_id, provider_id, status, query_payload, result_payload, error, created_at, updated_at
       ) values (
          $1::uuid, $2::uuid, 'queued', $3::jsonb, '{}'::jsonb, '', now(), now()
       )
       on conflict do nothing`,
      [
        input.sourceId,
        provider.provider_id,
        JSON.stringify({
          source: "reference_capture",
          provider: provider.provider,
          api_mode: provider.api_mode,
          country_code: provider.country_code,
          isbn: input.extraction.isbn,
          title: input.extraction.title,
          author_text: input.extraction.authorText,
          match_preference: input.extraction.isbn ? "isbn" : "title_author",
          public_until_human_review: false,
        }),
      ],
    );
  }
}

export async function createReferenceCaptureBatch(input: ReferenceCaptureBatchInput): Promise<ReferenceCaptureBatchResult> {
  const userId = input.userId.trim();
  if (!userId) throw new Error("session_required");
  const items = input.items.slice(0, 30);
  if (items.length === 0) throw new Error("reference_capture_items_required");
  const countryCode = resolveCommerceCountryCode({ userCountryCode: input.countryCode });
  const preparedItems: Array<{
    item: ReferenceCaptureItemInput;
    extraction: ReferenceAiExtraction;
    links: ReferenceTaxonLink[];
  }> = [];
  for (const item of items) {
    const manual = extractionFromManualInput(item);
    const ai = await extractReferenceMetadataWithAi(item);
    const extraction = mergeExtraction(manual, ai);
    preparedItems.push({
      item,
      extraction,
      links: inferReferenceTaxonLinks(extraction),
    });
  }
  const pool = getPool();
  const client = await pool.connect();
  const batchId = randomUUID();
  const resultItems: ReferenceCaptureBatchResult["items"] = [];
  try {
    await client.query("begin");
    await client.query(
      `insert into reference_capture_batches (batch_id, user_id, status, item_count, ai_summary, created_at, updated_at)
       values ($1::uuid, $2, 'processing', $3, '{}'::jsonb, now(), now())`,
      [batchId, userId, items.length],
    );

    for (const prepared of preparedItems) {
      const { item, extraction, links } = prepared;
      const itemId = randomUUID();
      const proofKind = item.proofKind ?? (extraction.url && !item.base64Data ? "web_capture" : item.isbn && !item.base64Data ? "isbn" : "cover");
      let proofAssetId: string | null = null;
      let proofPayload: JsonRecord = {};
      if (item.base64Data?.trim()) {
        const stored = await storePrivateReferenceProofAsset(client, {
          userId,
          batchId,
          itemId,
          filename: item.filename?.trim() || "reference-cover.jpg",
          mimeType: item.mimeType,
          base64Data: item.base64Data,
          proofKind,
        });
        proofAssetId = stored.assetId;
        proofPayload = stored.payload;
      }

      const source = await upsertKnowledgeSourceFromExtraction(client, extraction);
      await upsertTaxonLinks(client, { sourceId: source.sourceId, userId, links });

      const enoughForVerified = Boolean((proofAssetId || proofKind === "isbn") && (extraction.title || extraction.isbn || extraction.doi || extraction.url) && extraction.confidence >= 0.55);
      const verificationStatus: "ai_verified" | "needs_review" = enoughForVerified && !extraction.needsReview ? "ai_verified" : "needs_review";
      await insertAccessProof(client, {
        userId,
        sourceId: source.sourceId,
        batchId,
        proofAssetId,
        proofKind,
        verificationStatus,
        aiPayload: {
          extraction: extraction.raw,
          proof: proofPayload,
          ai_classification_links: links,
          no_page_text_stored: true,
          no_rag_prompt_use: true,
        },
      });
      await client.query(
        `insert into reference_capture_items (
            item_id, batch_id, user_id, source_id, proof_asset_id, item_status,
            extracted_payload, classification_note, created_at, updated_at
         ) values (
            $1::uuid, $2::uuid, $3, $4::uuid, $5::uuid, $6, $7::jsonb, $8, now(), now()
         )`,
        [
          itemId,
          batchId,
          userId,
          source.sourceId,
          proofAssetId,
          source.duplicate ? "duplicate" : verificationStatus,
          JSON.stringify({
            extraction: extraction.raw,
            normalized: {
              title: extraction.title,
              isbn: extraction.isbn,
              doi: extraction.doi,
              url: extraction.url,
              authorText: extraction.authorText,
              publisher: extraction.publisher,
              publicationYear: extraction.publicationYear,
              taxonHints: extraction.taxonHints,
            },
          }),
          links.length > 0
            ? `同定候補: ${links.slice(0, 4).map((link) => link.taxonName).join(" / ")}`
            : "分類群候補は要整理",
        ],
      );
      await enqueueCommerceDiscoveryJobsForSource(client, { sourceId: source.sourceId, countryCode, extraction });
      resultItems.push({
        sourceId: source.sourceId,
        title: extraction.title || "未整理の参照資料",
        verificationStatus,
        taxonHints: links.map((link) => link.taxonName),
        useCases: extraction.identificationUseCases.length
          ? extraction.identificationUseCases
          : links.length > 0
            ? links.map((link) => `${link.taxonName}の同定候補に出せます`)
            : ["タイトル・ISBN・対象分類群の補完が必要です"],
        duplicate: source.duplicate,
      });
    }

    const ownedCount = resultItems.filter((item) => item.verificationStatus === "ai_verified").length;
    const needsReviewCount = resultItems.length - ownedCount;
    const status = needsReviewCount > 0 ? "needs_review" : "completed";
    await client.query(
      `update reference_capture_batches
          set status = $2,
              ai_summary = $3::jsonb,
              updated_at = now()
        where batch_id = $1::uuid`,
      [
        batchId,
        status,
        JSON.stringify({
          owned_count: ownedCount,
          needs_review_count: needsReviewCount,
          use_cases: resultItems.flatMap((item) => item.useCases).slice(0, 24),
        }),
      ],
    );
    await client.query("commit");
    return { ok: true, batchId, status, ownedCount, needsReviewCount, items: resultItems };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function toTaxonLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, 8);
}

function commerceLinksFromJson(value: unknown): ReferenceCommerceLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const row = asRecord(entry);
      const provider = asString(row.provider);
      const url = asString(row.affiliate_url) || asString(row.product_url);
      const countryCode = asString(row.country_code);
      if (!provider || !url || !countryCode) return null;
      return {
        provider,
        countryCode,
        label: provider === "amazon" ? "Amazon" : provider === "rakuten" ? "楽天" : provider === "bookshop" ? "Bookshop" : "購入先",
        url,
        disclosureRequired: row.affiliate_disclosure_required === true,
        disclosureLabel: asString(row.disclosure_label) || "広告/成果報酬リンクを含みます",
        rel: "sponsored nofollow noopener" as const,
      };
    })
    .filter((entry): entry is ReferenceCommerceLink => Boolean(entry));
}

export async function getReferenceProfileSummary(userId: string): Promise<ReferenceProfileSummary> {
  const pool = getPool();
  const [counts, recent] = await Promise.all([
    pool.query<{ owned_verified_count: string; needs_review_count: string }>(
      `select
          count(distinct source_id) filter (where verification_status in ('ai_verified', 'user_confirmed', 'reviewer_confirmed'))::text as owned_verified_count,
          count(distinct source_id) filter (where verification_status = 'needs_review')::text as needs_review_count
         from user_reference_access_proofs
        where user_id = $1`,
      [userId],
    ),
    pool.query<{
      source_id: string;
      title: string;
      status: string;
      used_count: string;
      taxa: unknown;
    }>(
      `with latest_owned as (
          select distinct on (p.source_id)
                 p.source_id, p.verification_status, p.created_at
            from user_reference_access_proofs p
           where p.user_id = $1
           order by p.source_id, p.created_at desc
        )
        select ks.source_id::text,
               ks.title,
               latest_owned.verification_status as status,
               coalesce(used.n, 0)::text as used_count,
               coalesce(taxa.labels, '[]'::jsonb) as taxa
          from latest_owned
          join knowledge_sources ks on ks.source_id = latest_owned.source_id
          left join lateral (
            select count(*)::int as n
              from identification_references ir
             where ir.source_id = ks.source_id
               and ir.selected_by_user_id = $1
          ) used on true
          left join lateral (
            select jsonb_agg(distinct kt.taxon_name order by kt.taxon_name) as labels
              from knowledge_source_taxon_links kt
             where kt.source_id = ks.source_id
          ) taxa on true
         order by latest_owned.created_at desc
         limit 5`,
      [userId],
    ),
  ]);

  const countRow = counts.rows[0];
  return {
    ownedVerifiedCount: Number(countRow?.owned_verified_count ?? 0),
    needsReviewCount: Number(countRow?.needs_review_count ?? 0),
    recent: recent.rows.map((row) => ({
      sourceId: row.source_id,
      title: row.title,
      taxonLabels: toTaxonLabels(row.taxa),
      usedCount: Number(row.used_count),
      status: row.status,
    })),
  };
}

export async function listReferenceLibrary(input: {
  userId: string;
  tab: ReferenceTab;
  countryCode: string;
  limit?: number;
}): Promise<ReferenceLibrarySnapshot> {
  const limit = Math.max(1, Math.min(80, Math.floor(input.limit ?? 36)));
  const pool = getPool();
  const where =
    input.tab === "owned"
      ? "where owned.owned_status = 'owned_verified' and coalesce(krm.catalog_status, 'active') <> 'withdrawn'"
      : input.tab === "needs_review"
        ? "where owned.owned_status = 'needs_review' and coalesce(krm.catalog_status, 'active') <> 'withdrawn'"
        : "where coalesce(krm.catalog_status, 'active') <> 'withdrawn'";
  const rows = await pool.query<{
    source_id: string;
    title: string;
    author_text: string;
    publisher: string;
    publication_year: number | null;
    isbn: string | null;
    doi: string | null;
    url: string | null;
    source_kind: string;
    owned_status: "owned_verified" | "needs_review" | "not_owned";
    latest_proof_at: string | null;
    used_count: string;
    taxa: unknown;
    commerce_links: unknown;
    official_correction_count: string;
  }>(
    `with source_base as (
        select ks.*
          from knowledge_sources ks
         where ks.source_kind in ('field_guide', 'literature', 'web', 'book', 'unknown')
            or ks.source_provider = 'user_reference_capture'
      ),
      owned as (
        select s.source_id,
               case
                 when bool_or(p.verification_status in ('ai_verified', 'user_confirmed', 'reviewer_confirmed')) then 'owned_verified'
                 when bool_or(p.verification_status = 'needs_review') then 'needs_review'
                 else 'not_owned'
               end as owned_status,
               max(p.created_at)::text as latest_proof_at
          from source_base s
          left join user_reference_access_proofs p
            on p.source_id = s.source_id
           and p.user_id = $1
         group by s.source_id
       )
       select ks.source_id::text,
              ks.title,
              coalesce(krm.author_text, '') as author_text,
              ks.publisher,
              ks.publication_year,
              krm.isbn,
              ks.doi,
              ks.url,
              ks.source_kind,
             owned.owned_status,
             owned.latest_proof_at,
             coalesce(used.n, 0)::text as used_count,
             coalesce(taxa.labels, '[]'::jsonb) as taxa,
             coalesce(links.items, '[]'::jsonb) as commerce_links,
              coalesce(corrections.n, 0)::text as official_correction_count
         from source_base ks
         join owned on owned.source_id = ks.source_id
         left join knowledge_source_reference_metadata krm on krm.source_id = ks.source_id
         left join lateral (
           select count(*)::int as n
             from identification_references ir
           where ir.source_id = ks.source_id
             and ir.selected_by_user_id = $1
        ) used on true
        left join lateral (
          select jsonb_agg(distinct kt.taxon_name order by kt.taxon_name) as labels
            from knowledge_source_taxon_links kt
           where kt.source_id = ks.source_id
        ) taxa on true
        left join lateral (
          select jsonb_agg(jsonb_build_object(
              'provider', cp.provider,
              'country_code', scl.country_code,
              'product_url', scl.product_url,
              'affiliate_url', scl.affiliate_url,
              'affiliate_disclosure_required', scl.affiliate_disclosure_required,
              'disclosure_label', cp.disclosure_label
            ) order by cp.provider) as items
            from source_commerce_links scl
            join commerce_providers cp on cp.provider_id = scl.provider_id
           where scl.source_id = ks.source_id
             and scl.country_code = $2
             and scl.review_status = 'approved'
             and scl.availability_status in ('available', 'unknown')
             and (scl.affiliate_url is null or scl.affiliate_url = '' or scl.affiliate_disclosure_required is true)
        ) links on true
        left join lateral (
          select count(*)::int as n
            from knowledge_source_corrections ksc
           where ksc.source_id = ks.source_id
             and ksc.verification_status = 'official_confirmed'
        ) corrections on true
        ${where}
       order by
         case owned.owned_status when 'owned_verified' then 0 when 'needs_review' then 1 else 2 end,
         coalesce(owned.latest_proof_at, ks.updated_at::text) desc
       limit $3`,
    [input.userId, input.countryCode, limit],
  );

  return {
    tab: input.tab,
    countryCode: input.countryCode,
    summary: await getReferenceProfileSummary(input.userId),
    cards: rows.rows.map((row) => ({
      sourceId: row.source_id,
      title: row.title,
      authorText: row.author_text,
      publisher: row.publisher,
      publicationYear: row.publication_year,
      isbn: row.isbn ?? "",
      doi: row.doi ?? "",
      url: row.url ?? "",
      sourceKind: row.source_kind,
      ownedStatus: row.owned_status,
      latestProofAt: row.latest_proof_at,
      usedCount: Number(row.used_count),
      taxonLabels: toTaxonLabels(row.taxa),
      commerceLinks: commerceLinksFromJson(row.commerce_links),
      officialCorrectionCount: Number(row.official_correction_count),
    })),
  };
}

export async function listReferenceCandidatesForIdentification(input: {
  userId: string;
  occurrenceId: string;
  proposedName?: string | null;
  limit?: number;
}): Promise<ReferenceCandidate[]> {
  const pool = getPool();
  const occurrence = await pool.query<{
    vernacular_name: string | null;
    scientific_name: string | null;
    taxon_rank: string | null;
    genus: string | null;
    family: string | null;
    order_name: string | null;
    class_name: string | null;
  }>(
    `select vernacular_name, scientific_name, taxon_rank, genus, family, order_name, class_name
       from occurrences
      where occurrence_id = $1
      limit 1`,
    [input.occurrenceId],
  ).catch(() => ({ rows: [] as Array<{
    vernacular_name: string | null;
    scientific_name: string | null;
    taxon_rank: string | null;
    genus: string | null;
    family: string | null;
    order_name: string | null;
    class_name: string | null;
  }> }));
  const row = occurrence.rows[0];
  const terms = buildIdentificationTaxonSearchTerms({
    proposedName: input.proposedName,
    vernacularName: row?.vernacular_name,
    scientificName: row?.scientific_name,
    taxonRank: row?.taxon_rank,
    genus: row?.genus,
    family: row?.family,
    orderName: row?.order_name,
    className: row?.class_name,
  });
  if (terms.length === 0) return [];
  const limit = Math.max(1, Math.min(12, Math.floor(input.limit ?? 8)));
  const candidates = await pool.query<{
    source_id: string;
    title: string;
    author_text: string;
    publisher: string;
    publication_year: number | null;
    isbn: string | null;
    taxa: unknown;
    owned: boolean;
    verification_status: string | null;
    link_type: string;
    used_count: string;
    reason: string;
  }>(
    `with term(term) as (
        select lower(btrim(x)) from unnest($2::text[]) as x
      ),
      matched as (
        select kt.source_id,
               min(case
                 when lower(btrim(kt.taxon_name)) in (select term from term) then 0
                 when kt.link_type = 'reviewer_confirmed' then 1
                 when kt.link_type = 'user_confirmed' then 2
                 else 3
               end) as match_rank,
               (array_agg(kt.link_type order by kt.confidence desc))[1] as link_type
          from knowledge_source_taxon_links kt
         where lower(btrim(kt.taxon_name)) in (select term from term)
         group by kt.source_id
      )
       select ks.source_id::text,
              ks.title,
              coalesce(krm.author_text, '') as author_text,
              ks.publisher,
              ks.publication_year,
              krm.isbn,
              coalesce(taxa.labels, '[]'::jsonb) as taxa,
              coalesce(owned.owned, false) as owned,
             owned.verification_status,
             matched.link_type,
             coalesce(used.n, 0)::text as used_count,
             case
               when coalesce(owned.owned, false) then '自分の所有確認済み資料'
               when matched.match_rank = 0 then '共有カタログで分類群一致'
               when matched.link_type = 'ai_inferred' then 'AI推定の参照候補'
               else '上位分類群一致'
              end as reason
         from matched
         join knowledge_sources ks on ks.source_id = matched.source_id
         left join knowledge_source_reference_metadata krm on krm.source_id = ks.source_id
         left join lateral (
           select true as owned, p.verification_status
            from user_reference_access_proofs p
           where p.source_id = ks.source_id
             and p.user_id = $1
             and p.verification_status in ('ai_verified', 'user_confirmed', 'reviewer_confirmed')
           order by p.created_at desc
           limit 1
        ) owned on true
        left join lateral (
          select count(*)::int as n
            from identification_references ir
           where ir.source_id = ks.source_id
             and ir.selected_by_user_id = $1
        ) used on true
        left join lateral (
          select jsonb_agg(distinct kt.taxon_name order by kt.taxon_name) as labels
            from knowledge_source_taxon_links kt
           where kt.source_id = ks.source_id
        ) taxa on true
       where coalesce(krm.catalog_status, 'active') <> 'withdrawn'
       order by
         case when coalesce(owned.owned, false) then 0 else 1 end,
         matched.match_rank asc,
         coalesce(used.n, 0) desc,
         ks.updated_at desc
       limit $3`,
    [input.userId, terms, limit],
  );

  return candidates.rows.map((candidate) => ({
    sourceId: candidate.source_id,
    title: candidate.title,
    authorText: candidate.author_text,
    publisher: candidate.publisher,
    publicationYear: candidate.publication_year,
    isbn: candidate.isbn ?? "",
    taxonLabels: toTaxonLabels(candidate.taxa),
    owned: candidate.owned,
    verificationStatus: candidate.verification_status ?? "not_owned",
    linkType: candidate.link_type,
    usedCount: Number(candidate.used_count),
    reason: candidate.reason,
  }));
}

export async function recordIdentificationReferenceSelections(
  client: PoolClient,
  input: {
    identificationId: string;
    selectedByUserId: string;
    sourceIds: string[];
    locator?: string | null;
    referenceRole?: "primary_basis" | "comparison" | "correction" | "exclusion" | "reading_suggestion";
  },
): Promise<void> {
  const cleanIds = Array.from(new Set(input.sourceIds.map((id) => id.trim()).filter((id) => /^[0-9a-f-]{36}$/i.test(id)))).slice(0, 8);
  if (cleanIds.length === 0) return;
  const existing = await client.query<{ source_id: string }>(
    `select ks.source_id::text
       from knowledge_sources ks
       left join knowledge_source_reference_metadata krm on krm.source_id = ks.source_id
      where ks.source_id = any($1::uuid[])
        and coalesce(krm.catalog_status, 'active') <> 'withdrawn'`,
    [cleanIds],
  );
  const locator = String(input.locator ?? "").trim().slice(0, 160);
  for (const row of existing.rows) {
    await client.query(
      `insert into identification_references (
          identification_id, source_id, locator, reference_role, selected_by_user_id, source_payload, created_at
       ) values (
          $1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, now()
       )
       on conflict do nothing`,
      [
        input.identificationId,
        row.source_id,
        locator,
        input.referenceRole ?? "primary_basis",
        input.selectedByUserId,
        JSON.stringify({
          source: "identification_form_reference_picker",
          no_page_text_stored: true,
        }),
      ],
    );
  }
}

export async function createKnowledgeSourceCorrection(input: KnowledgeSourceCorrectionInput): Promise<{ ok: true; correctionId: string }> {
  const status = input.verificationStatus ?? "pending";
  const officialUrl = normalizeUrl(input.officialSourceUrl);
  const officialReference = String(input.officialReference ?? "").trim();
  if (status === "official_confirmed" && !officialUrl && !officialReference) {
    throw new Error("official_correction_source_required");
  }
  const pool = getPool();
  const result = await pool.query<{ correction_id: string }>(
    `insert into knowledge_source_corrections (
        source_id, locator, original_name, corrected_name, original_taxon_name,
        corrected_taxon_name, correction_kind, official_source_url, official_reference,
        verification_status, verified_by_user_id, verified_at, applies_from, source_payload,
        created_at, updated_at
     ) values (
        $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        case when $10 = 'official_confirmed' then now() else null end,
        $12::date, $13::jsonb, now(), now()
     )
     returning correction_id::text`,
    [
      input.sourceId,
      String(input.locator ?? "").trim().slice(0, 160),
      String(input.originalName ?? "").trim(),
      String(input.correctedName ?? "").trim(),
      String(input.originalTaxonName ?? "").trim(),
      String(input.correctedTaxonName ?? "").trim(),
      input.correctionKind ?? "misidentification",
      officialUrl,
      officialReference,
      status,
      input.verifiedByUserId ?? null,
      input.appliesFrom ?? null,
      JSON.stringify({
        ...(input.sourcePayload ?? {}),
        policy: "official_metadata_only_no_page_body",
      }),
    ],
  );
  const correctionId = result.rows[0]?.correction_id;
  if (!correctionId) throw new Error("knowledge_source_correction_insert_failed");
  return { ok: true, correctionId };
}

export async function listKnowledgeSourceCorrections(sourceId: string): Promise<Array<{
  correctionId: string;
  locator: string;
  originalName: string;
  correctedName: string;
  originalTaxonName: string;
  correctedTaxonName: string;
  correctionKind: string;
  officialSourceUrl: string;
  officialReference: string;
  verificationStatus: string;
}>> {
  const pool = getPool();
  const rows = await pool.query<{
    correction_id: string;
    locator: string;
    original_name: string;
    corrected_name: string;
    original_taxon_name: string;
    corrected_taxon_name: string;
    correction_kind: string;
    official_source_url: string;
    official_reference: string;
    verification_status: string;
  }>(
    `select correction_id::text, locator, original_name, corrected_name, original_taxon_name,
            corrected_taxon_name, correction_kind,
            official_source_url, official_reference, verification_status
       from knowledge_source_corrections
      where source_id = $1::uuid
      order by verification_status = 'official_confirmed' desc, created_at desc
      limit 40`,
    [sourceId],
  );
  return rows.rows.map((row) => ({
    correctionId: row.correction_id,
    locator: row.locator,
    originalName: row.original_name,
    correctedName: row.corrected_name,
    originalTaxonName: row.original_taxon_name,
    correctedTaxonName: row.corrected_taxon_name,
    correctionKind: row.correction_kind,
    officialSourceUrl: row.official_source_url,
    officialReference: row.official_reference,
    verificationStatus: row.verification_status,
  }));
}

export function isVerifiedProofStatus(status: string | null | undefined): boolean {
  return VERIFIED_PROOF_STATUSES.has(String(status ?? ""));
}
