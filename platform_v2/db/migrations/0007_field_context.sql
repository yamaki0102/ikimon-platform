-- Phase 1 prep for the Satellite-to-Field Loop.
--
-- Stores the Site Brief seen at the moment of an observation, so later
-- phases can surface "what was the satellite hypothesis when this was
-- recorded, and how did the field reality differ?". Phase 1 does not
-- write to this table yet — the schema lands now so Phase 2a can start
-- writing without another migration coordination round.
--
-- signals: raw OSM/elevation/landcover inputs the rules saw
-- hypothesis_id: the rule id that fired (e.g. "wet_edge"), null if generic
-- structured: Phase 2a payload (habitat, moisture, substrate, ...)
-- mismatch: observer-reported disagreement with the hypothesis

CREATE TABLE IF NOT EXISTS field_context (
    field_context_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    hypothesis_id TEXT,
    hypothesis_label TEXT,
    hypothesis_confidence REAL,
    signals JSONB NOT NULL DEFAULT '{}'::jsonb,
    structured JSONB NOT NULL DEFAULT '{}'::jsonb,
    mismatch TEXT,
    source_lang TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_context_occurrence
    ON field_context (occurrence_id);

CREATE INDEX IF NOT EXISTS idx_field_context_hypothesis_created
    ON field_context (hypothesis_id, created_at DESC);
