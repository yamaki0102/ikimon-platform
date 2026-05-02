CREATE EXTENSION IF NOT EXISTS vector;

-- owner-sensitive-ok: regional_knowledge_cards is introduced by the immediately preceding new migration in this same change set; staging/prod rollback is to remove this embedding migration before the table is populated.
ALTER TABLE regional_knowledge_cards
    ADD COLUMN IF NOT EXISTS retrieval_embedding VECTOR(1536),
    ADD COLUMN IF NOT EXISTS embedding_model TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_regional_knowledge_retrieval_embedding_cosine
    ON regional_knowledge_cards
    USING ivfflat (retrieval_embedding vector_cosine_ops)
    WITH (lists = 64)
    WHERE retrieval_embedding IS NOT NULL
      AND review_status IN ('approved', 'retrieval')
      AND sensitivity_level IN ('public', 'coarse');
