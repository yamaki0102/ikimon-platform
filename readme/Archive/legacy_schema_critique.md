# Legacy Schema Critical Review: 20 Hard Questions

To ensure the system works for 100+ books and high-level taxonomy, I have stress-tested the current V2 schema.

## Data Structure & Scalability
1. **[Versioning] Schema changes will break parsers.**
   *   *Critique:* If we change the structure at Book #50, Books #1-49 become unreadable.
   *   *Fix:* Add `"schema_version": "2.1"` to the root.
2. **[Affiliate] Hardcoded links die.**
   *   *Critique:* Hardcoding URLs in JSON is bad. Amazon changes formats.
   *   *Fix:* Store only ASIN/ISBN. Generate links dynamically on the frontend.
3. **[ID Handling] "Page Number" is weak.**
   *   *Critique:* Some books use "Plate 1" instead of "Page 7". Reordering breaks IDs.
   *   *Fix:* Use `local_entry_id` (e.g., `uuid` or `bookid_p005_01`).
4. **[Search] "Comparison" is untyped.**
   *   *Critique:* "Compared to Sujikuwagata" is just text. The system doesn't know *who* that is.
   *   *Fix:* Use `comparison_target_id` (pointer to another TaxonID).

## Biological Precision
5. **[Taxonomy] String matching is dangerous.**
   *   *Critique:* `name_ja_old`: "Kokuwagata" might mean a subspecies in 1980s books.
   *   *Fix:* Add `scientific_name_verbatim` (as written in book) + `modern_taxon_id`.
6. **[Sexes] Morphology is often sex-specific.**
   *   *Critique:* Facts are flat. "Mandibles are long" only applies to males.
   *   *Fix:* Structure facts by sex: `facts: { "male": {...}, "female": {...} }`.
7. **[Life Stage] Larvae are ignored.**
   *   *Critique:* Handbooks often have larval pages. Current schema defaults to adults.
   *   *Fix:* Add `life_stage`: "adult" | "larva" | "pupa".
8. **[Season] "Summer" is useless for analysis.**
   *   *Critique:* Can't filter "Show species active in May".
   *   *Fix:* `season_months`: `[5, 6, 7, 8]`.
9. **[Distribution] "Honshu" is too coarse.**
   *   *Critique:* User wants "Is it in my prefecture?".
   *   *Fix:* `distribution_codes`: `["JP-01", "JP-13"]` (JIS Codes) or `geo_mesh`.
10. **[Measurements] Strings are not sortable.**
    *   *Critique:* "30-76mm" is a string. Can't sort by "Largest Stag Beetle".
    *   *Fix:* `size_min`: 30, `size_max`: 76, `unit`: "mm".

## System & Logic (Bio-Navigator)
11. **[Logic] "Difference" isn't enough.**
    *   *Critique:* "A vs B" is good, but what if there are 3 similar species?
    *   *Fix:* `diagnostic_group`: List *all* confusables, not just pairwise.
12. **[Visuals] "Highlighted Feature" is invisible.**
    *   *Critique:* AI says "Mandibles are highlighted", but the UI doesn't know *where* to look.
    *   *Fix:* `roi_box`: `[x, y, w, h]` (Region of Interest coordinates on the image).
13. **[Confidence] AI lies.**
    *   *Critique:* Did the map really exclude Hokkaido, or did the AI miss-see it?
    *   *Fix:* `ai_confidence`: 0.0 - 1.0 per field.
14. **[Key Features] Subjective adjectives.**
    *   *Critique:* "Shiny" is subjective. 
    *   *Fix:* Use controlled vocabulary for texture/color (e.g., `texture: "glossy"`).

## Operations & Rights
15. **[Copyright] "Summary" might become "Translation".**
    *   *Critique:* If the summary is too close to the original text, it's a risk.
    *   *Fix:* Add `risk_flag`: "Low" | "Review Required". Use "Facts Only" mode strictly.
16. **[Verification] Who checked this?**
    *   *Critique:* In 100 books, we'll lose track of what's validated.
    *   *Fix:* `verification_status`: "AI_Generated" | "Human_Reviewed".
17. **[Source] Original Text traceability.**
    *   *Critique:* If we find an error, we can't easily find the source sentence.
    *   *Fix:* Optional `source_citation_index`: Link fact to paragraph #.
18. **[Updates] Books get revised.**
    *   *Critique:* "Augmented Revised Edition" vs "Original".
    *   *Fix:* `edition_parent_id`: Handle book lineage.

## UX & Front-end
19. **[Tone] "Editorial Tone" is static.**
    *   *Critique:* It's just a text blob.
    *   *Fix:* `tags`: `["academic", "beginner-friendly", "visual-heavy"]`.
20. **[Completeness] Missing data handling.**
    *   *Critique:* Does "Distribution: null" mean "None" or "Not Scanned"?
    *   *Fix:* explicit `data_completeness`: "partial" | "full".
