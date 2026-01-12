# Ingestion Direction Report: Strategies for 4 Book Types

Based on a cross-sectional sampling (~20 pages/book equivalent), here is the defined direction for mass data ingestion.

## 1. Stag Beetle Handbook (Visual Logic Focus)
*   **Target Pages**: All species profile pages.
*   **Primary Value**: **Identification Logic**.
*   **Strategy**: Deep extraction of `diagnostic_logic`. Focus on "How to tell A from B" (mandible shape, leg color).
*   **V3 Schema**: `differentiation_points` + High-res `roi_box`.

## 2. Insect Sound Guide (Sensory Focus)
*   **Target Pages**: Species pages (e.g., P.40 Sesuji-Tsuyumushi).
*   **Primary Value**: **Sensory Data**.
*   **Strategy**: Extract onomatopoeia ("Chon-Giii") and temporal patterns ("Night only").
*   **V3 Schema**: `sensory_profiles.auditory` + `region: "JP"`.

## 3. River Guide (Hybrid: Geography + Catalog)
*   **Target Pages**: 
    *   P.2-12 (Maps): Text lists linked to Map locations.
    *   P.13+ (Catalog): Standard photos.
*   **Primary Value**: **Distribution**.
*   **Strategy**:
    *   **Map Pages**: Create "Ghost Entries" (No photo, extracted Locality data).
    *   **Catalog Pages**: Standard extraction.
*   **V3 Schema**: Heavy use of `distribution.implicit_map_features` ("Nakatsugawa Rapids").

## 4. History of Fish Culture (Entity Mining Focus)
*   **Target Pages**: Essays (P.10-200).
*   **Primary Value**: **Cultural Context**.
*   **Strategy**: **Entity Mining**.
    1.  Scan text for Biological Entities (e.g., "Ayu", "Tai").
    2.  Extract the *context* surrounding them ("Used in Jomon shell mounds").
    3.  Ignore generic prose; capture only the specific ethnobiological assertion.
*   **V3 Schema**: `cultural_contexts` array. No biological stats.

## 5. Insectarium (Magazine): Methodology Mining
*   **Target Pages**: Breeding reports, Field collection diaries.
*   **Primary Value**: **Technique & Behavior**.
*   **Strategy**:
    *   **Breeding Articles**: Extract "Temp: 25C", "Mat: Fermented", "Larval Period: 1 yr".
    *   **Field Reports**: Extract "Micro-habitat" data not found in guidebooks (e.g., "Found under specific tree bark").
*   **V3 Schema**: New `rearing_methods` object (to be added) and `biological_facts.micro_habitat`.

## 6. World Bird Encyclopedia (Index-Validated)
*   **Target Pages**: Thematic Essays (e.g., "Birds & Ecosystems").
*   **Primary Value**: **Ecological Context & Evolution**.
*   **Strategy**: **Index-Cross-Reference**.
    1.  Extract species name from text (e.g., "Miyakodori").
    2.  **MANDATORY**: Look up name in Index (P.230+) to find authoritative English/Scientific Name.
    3.  Reject "common name guesses"; use the book's defined taxonomy.
*   **V3 Schema**: `source_metadata.validation_index_page` (e.g., 239).

---

## Execution Plan (Agent Mode)
I will process the high-priority pages from each book following these distinct strategies.
