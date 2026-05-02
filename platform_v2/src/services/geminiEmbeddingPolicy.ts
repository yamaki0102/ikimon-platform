export function isGeminiEmbedding2(model: string): boolean {
  return model.trim().toLowerCase() === "gemini-embedding-2";
}

export function embeddingBatchSizeForModel(model: string, requestedBatchSize: number): number {
  const safeRequested = Math.max(1, Math.min(16, Math.round(requestedBatchSize)));
  return isGeminiEmbedding2(model) ? 1 : safeRequested;
}

export function formatEmbeddingDocument(title: string, text: string): string {
  const cleanTitle = title.trim() || "none";
  const cleanText = text.trim();
  return `title: ${cleanTitle} | text: ${cleanText}`;
}
