-- Add accepted_rank to identifications. When non-null, this represents
-- "the rank at which this identification was officially accepted" —
-- either by an authority-backed specialist (who may set any rank within
-- their scope) or by a plain review whose proposed rank is at or coarser
-- than the taxon precision policy ceiling (e.g. community support resolves
-- coarse-rank accept).
--
-- See docs/policy/identification_granularity_policy.md §1.2-§3 for the
-- semantic definition and taxonPrecisionPolicy.ts / specialistReview.ts
-- for the writer paths.

ALTER TABLE identifications
    ADD COLUMN IF NOT EXISTS accepted_rank TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'identifications_accepted_rank_check'
    ) THEN
        ALTER TABLE identifications
            ADD CONSTRAINT identifications_accepted_rank_check
            CHECK (
                accepted_rank IS NULL
                OR accepted_rank IN (
                    'kingdom','phylum','class','order','family','subfamily','tribe',
                    'genus','subgenus','species_group','species','subspecies'
                )
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_identifications_accepted_rank
    ON identifications (accepted_rank)
    WHERE accepted_rank IS NOT NULL;
