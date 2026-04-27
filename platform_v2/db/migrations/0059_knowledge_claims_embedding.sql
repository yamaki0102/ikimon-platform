-- Biodiversity Freshness OS: knowledge_claims.claim_embedding
--
-- Adds a pgvector embedding column so the Hot path can do semantic recall
-- when the exact (taxon_name, scientific_name, region) lookup misses.
--
-- Embedding model: Gemini Embedding 2 (1536 dim) — same as profile_digest
-- elsewhere in the platform.

CREATE EXTENSION IF NOT EXISTS vector;

-- owner-sensitive-ok: ADD COLUMN IF NOT EXISTS is non-rewriting and idempotent;
-- knowledge_claims is owned by ikimon-staging (same role that runs npm run migrate);
-- rollback = ALTER TABLE knowledge_claims DROP COLUMN claim_embedding, DROP COLUMN
-- embedding_model, DROP COLUMN embedded_at; safe under app DB role.
ALTER TABLE knowledge_claims
    ADD COLUMN IF NOT EXISTS claim_embedding VECTOR(1536),
    ADD COLUMN IF NOT EXISTS embedding_model TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS embedded_at     TIMESTAMPTZ;

-- ivfflat index for cosine similarity. lists=50 is sized for the early
-- "thousands of claims" regime; revisit when we cross 100k claims.
CREATE INDEX IF NOT EXISTS idx_knowledge_claims_embedding_cosine
    ON knowledge_claims
    USING ivfflat (claim_embedding vector_cosine_ops)
    WITH (lists = 50);
