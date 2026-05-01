import assert from "node:assert/strict";
import test from "node:test";
import { embeddingBatchSizeForModel, formatEmbeddingDocument, isGeminiEmbedding2 } from "./geminiEmbeddingPolicy.js";

test("Gemini Embedding 2 is embedded one document at a time to avoid aggregate vectors", () => {
  assert.equal(isGeminiEmbedding2("gemini-embedding-2"), true);
  assert.equal(embeddingBatchSizeForModel("gemini-embedding-2", 8), 1);
  assert.equal(embeddingBatchSizeForModel("text-embedding-004", 8), 8);
});

test("embedding documents use Gemini 2 retrieval document structure", () => {
  const text = formatEmbeddingDocument("浜松の水路", "summary: 水辺\nobservation_hooks: 水際を見る");
  assert.match(text, /^title: 浜松の水路 \| text: summary: 水辺/);
  assert.match(text, /observation_hooks: 水際を見る/);
});
