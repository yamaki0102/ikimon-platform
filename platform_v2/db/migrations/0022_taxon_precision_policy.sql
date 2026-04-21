-- Identification granularity policy: per-taxon coarse rank ceiling.
--
-- For each taxon_key, defines the finest rank at which community support
-- (multi-citizen agreement without an authority review) is allowed to be
-- recorded as officially accepted. Authority-backed review can go finer.
--
-- See docs/policy/identification_granularity_policy.md §3 for the rationale
-- and the initial seed values below must stay in sync with that document.
--
-- taxon_key is a loose string: may be a kingdom, order, family, genus, or
-- GBIF backbone identifier. Lookup walks up the taxon hierarchy until a
-- matching policy row is found; the default (no match) is `genus`.
--
-- rank values must be one of the canonical ranks from taxonRank.ts:
--   kingdom, phylum, class, order, family, subfamily, tribe, genus,
--   subgenus, species_group, species, subspecies.

CREATE TABLE IF NOT EXISTS taxon_precision_policy (
    taxon_key TEXT PRIMARY KEY,
    coarse_ceiling_rank TEXT NOT NULL,
    notes TEXT,
    updated_by_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        coarse_ceiling_rank IN (
            'kingdom','phylum','class','order','family','subfamily','tribe',
            'genus','subgenus','species_group','species','subspecies'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_taxon_precision_policy_updated
    ON taxon_precision_policy (updated_at DESC);

-- Seed initial per-taxon exceptions (2026-04-21).
-- The default (for taxa not listed here) is handled application-side as
-- `genus`, so we only list deviations from that default.
INSERT INTO taxon_precision_policy (taxon_key, coarse_ceiling_rank, notes)
VALUES
    ('Aves', 'species', '国内鳥類は図鑑定着度が高く市民 species 識別が比較的安定。公開用途への昇格は authority 確認が必要。'),
    ('Mammalia', 'species', '国内哺乳類は種数が限定的、形態識別が比較的安定。'),
    ('Amphibia', 'species', '国内両生類は種数が限定的。'),
    ('Reptilia', 'species', '国内爬虫類は種数が限定的。'),
    ('Lepidoptera', 'genus', 'チョウ目は科〜属で迷う群が多い。種は authority 経由を原則とする。'),
    ('Coleoptera', 'subfamily', 'コウチュウ目は亜科止めが健全な群が多い。'),
    ('Hymenoptera', 'subfamily', 'ハチ目（ハナバチ類含む）は亜科止めを原則とする。'),
    ('Diptera', 'subfamily', 'ハエ目は亜科止めを原則とする。'),
    ('Fungi', 'family', '顕微鏡観察・培養なしでは属以下が危うい。')
ON CONFLICT (taxon_key) DO NOTHING;
