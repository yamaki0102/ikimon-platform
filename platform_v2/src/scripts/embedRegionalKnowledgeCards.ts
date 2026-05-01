/**
 * regional_knowledge_cards.retrieval_text を Gemini embedding にして pgvector へ保存する。
 *
 * 使い方:
 *   REGIONAL_KNOWLEDGE_EMBEDDING_PROVIDER=gemini GEMINI_API_KEY=... npm run embed:regional-knowledge -- --limit=50
 *   npm run embed:regional-knowledge -- --dry-run --status=approved
 */

import { GoogleGenAI } from "@google/genai";
import { getPool } from "../db.js";
import { loadConfig } from "../config.js";
import { upsertRegionalKnowledgeEmbedding } from "../services/regionalKnowledgeEmbedding.js";
import { embeddingBatchSizeForModel, formatEmbeddingDocument } from "../services/geminiEmbeddingPolicy.js";

type CardRow = {
  card_id: string;
  title: string;
  summary: string;
  retrieval_text: string;
  source_label: string;
  observation_hooks: unknown;
};

function parseArgs(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    out[key!] = rest.length > 0 ? rest.join("=") : true;
  }
  return out;
}

function asPositiveInt(value: string | boolean | undefined, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function textForEmbedding(row: CardRow): string {
  const hooks = Array.isArray(row.observation_hooks)
    ? row.observation_hooks.map(String).filter(Boolean).join(" / ")
    : "";
  const structuredText = [
    `summary: ${row.summary}`,
    `retrieval_text: ${row.retrieval_text}`,
    `source: ${row.source_label}`,
    hooks ? `observation_hooks: ${hooks}` : "",
  ].filter(Boolean).join("\n").slice(0, 5000);
  return formatEmbeddingDocument(row.title, structuredText);
}

async function fetchCards(options: {
  status: string;
  limit: number;
  includeEmbedded: boolean;
  regionScope?: string;
}): Promise<CardRow[]> {
  const values: unknown[] = [];
  const clauses = ["sensitivity_level in ('public', 'coarse')", "nullif(source_url, '') is not null"];
  if (options.status !== "any") {
    values.push(options.status);
    clauses.push(`review_status = $${values.length}`);
  } else {
    clauses.push("review_status in ('approved', 'retrieval')");
  }
  if (!options.includeEmbedded) {
    clauses.push("retrieval_embedding is null");
  }
  if (options.regionScope) {
    values.push(options.regionScope);
    clauses.push(`region_scope = $${values.length}`);
  }
  values.push(options.limit);
  const result = await getPool().query<CardRow>(
    `select card_id, title, summary, retrieval_text, source_label, observation_hooks
       from regional_knowledge_cards
      where ${clauses.join(" and ")}
      order by quality_score desc, updated_at desc
      limit $${values.length}`,
    values,
  );
  return result.rows;
}

async function embedBatch(ai: GoogleGenAI, model: string, dim: number, texts: string[]): Promise<number[][]> {
  const response = await ai.models.embedContent({
    model,
    contents: texts,
    config: { outputDimensionality: dim },
  });
  const vectors = response.embeddings?.map((embedding) => embedding.values ?? []) ?? [];
  if (vectors.length !== texts.length) {
    throw new Error(`embedding_response_count_mismatch:${vectors.length}:${texts.length}`);
  }
  return vectors;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const dryRun = Boolean(args["dry-run"]);
  const includeEmbedded = Boolean(args["all"]);
  const limit = asPositiveInt(args["limit"], 50);
  const status = typeof args["status"] === "string" ? args["status"] : "approved";
  const regionScope = typeof args["region-scope"] === "string" ? args["region-scope"] : undefined;
  const cfg = loadConfig();
  const model = typeof args["model"] === "string" ? args["model"] : cfg.regionalKnowledgeEmbedding.model;
  const dim = asPositiveInt(args["dim"], cfg.regionalKnowledgeEmbedding.outputDimensionality);
  const batchSize = embeddingBatchSizeForModel(model, asPositiveInt(args["batch-size"], 8));
  const cards = await fetchCards({ status, limit, includeEmbedded, regionScope });

  if (dryRun) {
    console.log(JSON.stringify({
      dryRun,
      candidateCount: cards.length,
      firstCardId: cards[0]?.card_id ?? null,
      model,
      dim,
      batchSize,
    }, null, 2));
    await getPool().end();
    return;
  }
  if (cfg.regionalKnowledgeEmbedding.provider !== "gemini" || !cfg.geminiApiKey) {
    throw new Error("Set REGIONAL_KNOWLEDGE_EMBEDDING_PROVIDER=gemini and GEMINI_API_KEY before embedding.");
  }

  const ai = new GoogleGenAI({ apiKey: cfg.geminiApiKey });
  let embedded = 0;
  for (let i = 0; i < cards.length; i += batchSize) {
    const batch = cards.slice(i, i + batchSize);
    const vectors = await embedBatch(ai, model, dim, batch.map(textForEmbedding));
    for (let index = 0; index < batch.length; index += 1) {
      await upsertRegionalKnowledgeEmbedding({
        cardId: batch[index]!.card_id,
        embedding: vectors[index]!,
        model,
        expectedDim: dim,
      });
      embedded += 1;
    }
  }
  console.log(JSON.stringify({ embedded, model, dim, status, regionScope: regionScope ?? null }, null, 2));
  await getPool().end();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  await getPool().end().catch(() => undefined);
  process.exit(1);
});
