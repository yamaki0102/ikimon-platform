# Identification Granularity Policy

This document is the canonical policy companion for `platform_v2/src/services/taxonRank.ts` and `taxonPrecisionPolicy.ts`.

## 1. Trust Boundary

AI suggestions are hypotheses. Citizen identifications can create community support. Public research export requires a stronger gate: media evidence, no open dispute, interpretable taxonomy, and either authority-backed review or community consensus at an allowed rank.

`accepted_rank` means the rank at which ikimon is willing to treat an identification as officially accepted for the current trust lane. It is not a claim that every downstream ecological inference is proven.

## 2. Canonical Ranks

The application recognizes these ordered ranks:

`kingdom`, `phylum`, `class`, `order`, `family`, `subfamily`, `tribe`, `genus`, `subgenus`, `species_group`, `species`, `subspecies`.

Ranks finer than the current policy ceiling need authority-backed review before they can be used as the public research claim.

## 3. Community Precision Ceiling

The default community ceiling is `genus`. That means multi-citizen agreement may make a genus-level claim publishable, while a species-level claim normally needs authority-backed review.

Exceptions are stored in `taxon_precision_policy`. Initial exceptions allow community species-level acceptance for groups with comparatively stable public identification contexts, such as `Aves`, `Mammalia`, `Amphibia`, and `Reptilia`. Difficult groups such as fungi and some insect orders are capped coarser.

## 4. Disputes

If someone says "別の分類では？" or "証拠が足りない", the occurrence has an open dispute. Open disputes block Tier 3 promotion and research API / DwC-A export until resolved, withdrawn, or converted into an authority-backed decision.

## 5. Research Boundary

Tier 3 is the standard public research export candidate. It does not automatically prove absence, abundance change, habitat preference, or a paper-level conclusion. Those claims still require sampling effort, license/position review, and study design checks.

