import { getPool } from "../db.js";

export type RegionalKnowledgeEmbeddingMatch = {
  cardId: string;
  regionScope: string;
  category: string;
  title: string;
  summary: string;
  retrievalText: string;
  sourceUrl: string;
  sourceLabel: string;
  observationHooks: string[];
  qualityScore: number;
  similarity: number;
};

export function normalizeEmbeddingVector(values: readonly number[], expectedDim = 1536): number[] {
  if (!Array.isArray(values) || values.length !== expectedDim) {
    throw new Error(`embedding_dimension_mismatch:${values.length}:${expectedDim}`);
  }
  return values.map((value) => {
    if (!Number.isFinite(value)) {
      throw new Error("embedding_contains_non_finite_value");
    }
    return Number(value);
  });
}

export function vectorLiteral(values: readonly number[]): string {
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

export async function upsertRegionalKnowledgeEmbedding(input: {
  cardId: string;
  embedding: readonly number[];
  model: string;
  expectedDim?: number;
}): Promise<void> {
  const vector = normalizeEmbeddingVector(input.embedding, input.expectedDim ?? 1536);
  await getPool().query(
    `update regional_knowledge_cards
        set retrieval_embedding = $2::vector,
            embedding_model = $3,
            embedded_at = now(),
            updated_at = now()
      where card_id = $1`,
    [input.cardId, vectorLiteral(vector), input.model],
  );
}

export async function findRegionalKnowledgeByEmbedding(input: {
  embedding: readonly number[];
  expectedDim?: number;
  regionScope?: string;
  category?: string;
  limit?: number;
}): Promise<RegionalKnowledgeEmbeddingMatch[]> {
  const vector = normalizeEmbeddingVector(input.embedding, input.expectedDim ?? 1536);
  const values: unknown[] = [vectorLiteral(vector)];
  const clauses = [
    "retrieval_embedding is not null",
    "review_status in ('approved', 'retrieval')",
    "sensitivity_level in ('public', 'coarse')",
    "nullif(source_url, '') is not null",
  ];
  if (input.regionScope) {
    values.push(input.regionScope);
    clauses.push(`region_scope = $${values.length}`);
  }
  if (input.category) {
    values.push(input.category);
    clauses.push(`category = $${values.length}`);
  }
  values.push(Math.max(1, Math.min(50, input.limit ?? 12)));
  const limitRef = `$${values.length}`;
  const result = await getPool().query<{
    card_id: string;
    region_scope: string;
    category: string;
    title: string;
    summary: string;
    retrieval_text: string;
    source_url: string;
    source_label: string;
    observation_hooks: unknown;
    quality_score: string | number;
    similarity: string | number;
  }>(
    `select card_id,
            region_scope,
            category,
            title,
            summary,
            retrieval_text,
            source_url,
            source_label,
            observation_hooks,
            quality_score,
            1 - (retrieval_embedding <=> $1::vector) as similarity
       from regional_knowledge_cards
      where ${clauses.join(" and ")}
      order by retrieval_embedding <=> $1::vector, quality_score desc
      limit ${limitRef}`,
    values,
  );
  return result.rows.map((row) => ({
    cardId: row.card_id,
    regionScope: row.region_scope,
    category: row.category,
    title: row.title,
    summary: row.summary,
    retrievalText: row.retrieval_text,
    sourceUrl: row.source_url,
    sourceLabel: row.source_label,
    observationHooks: Array.isArray(row.observation_hooks)
      ? row.observation_hooks.map(String).filter(Boolean)
      : [],
    qualityScore: Number(row.quality_score ?? 0),
    similarity: Number(row.similarity ?? 0),
  }));
}
