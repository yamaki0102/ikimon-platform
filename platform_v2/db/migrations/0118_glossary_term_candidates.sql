--
-- Glossary Term Candidates
-- Review queue for specialized words found in AI-generated observation copy.
--

CREATE TABLE IF NOT EXISTS glossary_term_candidates (
    candidate_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    lang              TEXT         NOT NULL DEFAULT 'ja',
    label             TEXT         NOT NULL,
    normalized_label  TEXT         NOT NULL,
    example_text      TEXT         NOT NULL DEFAULT '',
    source_kind       TEXT         NOT NULL DEFAULT 'ai_observation',
    source_id         TEXT         NOT NULL DEFAULT '',
    visit_id          TEXT,
    occurrence_id     TEXT,
    ai_run_id         UUID,
    assessment_id     UUID,
    scope_tags        TEXT[]       NOT NULL DEFAULT '{}'::text[],
    seen_count        INT          NOT NULL DEFAULT 1,
    status            TEXT         NOT NULL DEFAULT 'pending',
    reviewer_note     TEXT         NOT NULL DEFAULT '',
    first_seen_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_seen_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT glossary_term_candidates_lang_chk CHECK (lang IN ('ja', 'en', 'es', 'pt-BR')),
    CONSTRAINT glossary_term_candidates_label_len_chk CHECK (char_length(label) BETWEEN 2 AND 80),
    CONSTRAINT glossary_term_candidates_status_chk CHECK (status IN ('pending', 'accepted', 'rejected', 'ignored'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_glossary_term_candidates_lang_normalized
    ON glossary_term_candidates (lang, normalized_label);

CREATE INDEX IF NOT EXISTS idx_glossary_term_candidates_status_seen
    ON glossary_term_candidates (status, seen_count DESC, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_glossary_term_candidates_occurrence
    ON glossary_term_candidates (occurrence_id, last_seen_at DESC);
