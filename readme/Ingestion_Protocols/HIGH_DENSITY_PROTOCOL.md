# High-Density Ingestion Protocol (The "Constitution")

> [!DATE] 2026-01-04
> [!AGENT_DIRECTIVE]
> **TOOL USAGE**: When inspecting local images (e.g., `*.jpg`), ALWAYS use the `view_file` tool. DO NOT use the `browser_subagent`.

> [!DATE] 2026-01-03
> [!IMPORTANT]
> **RECURRENCE PREVENTION PROTOCOL**
> This document must be referred to **BEFORE** processing every single page.
> **FAILURE TO FOLLOW THIS PROTOCOL IS UNACCEPTABLE.**

## Core Principle: "Zero Loss" Archiving
The goal is to digitally preserve the physical book with **zero loss of information**. If the page contains 8 photos, the metadata MUST describe 8 photos. Grouping, summarizing, or omitting variations is a critical error.

## 1. The "Two-Pass" Strategy (Mandatory)
**Stop treating books as a stream of isolated pages. Understand the Whole first.**

### Phase 1: The Global Scan (Macro-Analysis)
Before processing a new book or a new major section:
1.  **Scan the Range**: Look at the file list and sample images across the entire target range (e.g., Pages 1-100).
2.  **Identify Patterns**: Note where density spikes (e.g., "Pages 50-60 are catalog pages with 20 spp/page").
3.  **Plan the Approach**: Adjust your mental model for expected density. "This section requires high-density extraction," or "This section is full-page profiles."

### Phase 2: Granular Ingestion (Micro-Analysis)
Only after understanding the macro-structure do you begin the page-by-page extraction.

## 2. The "Visual Census" Rule (Mandatory Local Step)
Before writing ANY JSON for a specific page, you must visually scan it and **COUNT** the distinct visual figures.

*   **Do not** trust the text headers alone.
*   **Do not** assume "Male/Female" means 2 photos. It might be 4 (Surface/Underside for both).
*   **Action**: Mentally or on scratchpad, list:
    *   Fig 1: Male Surface A (Color variation)
    *   Fig 2: Male Surface B
    *   Fig 3: Female Surface
    *   Fig 4: Underside
    *   Fig 5: Ecological pose

## 3. Comparative Morphology & Diagnostic Rigor (The "Pro" Standard)
### Diagnostic Features (Mandatory)
- **You MUST identify and describe** at least **one specific, diagnostic visual feature** for every entity (e.g., "Black knees," "Reddish forelegs," "Constricted pronotum").
    - *Bad*: "A green katydid."
    - *Good*: "Pale green body with a noticeably constricted pronotum (neck area)."

### "Compared to what?" (The Identification Key Rule)
**CRITICAL**: When ingesting a "Species List" or "Catalog" page, you **MUST** provide comparative information.
- **Why?**: The user uses this data for *Identification* (Doutei). Isolated descriptions are useless.
- **Rule**: If there are similar species on the page (or common look-alikes), you must state *how* they differ.
    - *Bad*: "Ezo-zemi: Large W-mark."
    - *Good*: "Ezo-zemi: Large W-mark. **Distinguished from Ko-ezo-zemi** by the continuous connection between the mesonotum and abdomen (Ko-ezo has a break)."
    - *Good*: "Abura-zemi: Opaque wings. **Unique among large Japanese cicadas** (others have clear wings)."

*   ❌ **Bad (Vague):** "Small body. Short antennae."
*   ✅ **Good (Comparative):** "Smaller than *L. sponsa*. Antennae are shorter than the body length."
*   ✅ **Good (Negative Feature):** "Lacks the distinct wing spots found in *M. strigata*."

### Implementation Checklist
1.  **Identify the Baseline:** Find the main species on the page.
2.  **Explicit Contrast:** Use phrases like "Smaller than X", "Darker than Y".
3.  **Quantify:** "Half the size", "Twice as long".

## 4. Global Standard for Origins (No "Alien" Labeling)
"Alien Species" (Gairaishu) is a relative term. What is alien to Japan is native to another region. We must describe species with a **Global Perspective**.

*   ❌ **Bad (Japan-Centric):** "Alien species." or "Gairaishu."
*   ✅ **Good (Global Context):** "Native to China/SE Asia, introduced to Japan." or "Cosmopolitan species (Native to Africa)."
*   **Action**: Explicitly state **Original Range** and **Introduced Status**.

## 5. The "Anti-Sampling" Rule (Massive Density)
**"If it has a name, it gets an entry."**
Many pages (especially Aphids, Scales, Small Moths) are "Catalog Pages" listing 10-20 species.
*   ❌ **Critical Error**: Picking 2-3 "representative" species and ignoring the rest.
*   ✅ **Requirement**: If the page lists 18 species, you create **18 JSON objects**.
*   **Workflow**:
    1.  Count the headers/bold names. (e.g., "15 names")
    2.  Count the photos. (e.g., "15 photos")
    3.  **Execute 15 times**. Do not stop until all 15 are done.

## 6. JSON Construction Rules

### `visual_description`
*   **MUST** be an itemized list corresponding exactly to the Visual Census.
*   **Format**: "Includes [N] distinct figures: 1. [Description] 2. [Description]..."
*   **Banned Words**: "General appearance", "Typical", "Various forms" (unless followed by the specific list).

### `species_entries`
*   If a page has multiple species, split them naturally.
*   If a page depicts **one species** but **multiple distinct forms/subspecies** that are labeled separately, consider whether they need distinct entries or a detailed breakdown in the description. For this Field Guide, usually, they are one `species_entry` with a **detailed, enumerated visual description**.

## 7. The "Double-Check" Loop
Before submitting the tool call:
1.  Look at the image again.
2.  Count the photos.
3.  Count the items in your `visual_description`.
4.  **If they do not match, STOP and fix it.**

## 8. Specific Handling for "Field Guide: Butterflies of Japan"
*   **Plates (Odd Pages/Visuals)**: Often contain grid-like arrangements. Every cell in the grid is a distinct datum.
*   **Profiles (Even Pages/Text)**: Often contain small thumbnail photos (Face close-ups, eggs, larvae, resting poses). These **MUST** be included in the census.

## 9. Magazine / Column / Index Handling (NEW 2026-01-10)

### 雑誌記事 (Magazine Articles / Columns)
雑誌は複数ページにまたがる「フロー」構造を持つことが多い。

*   **Flow Identification (フロー特定)**: 記事のページ範囲を最初に確認する（例: P10-P15がひとつの「カブトムシ飼育法」）。
*   **Cross-Page Context (文脈継承)**: JSONメタデータに `related_pages: [10, 11, 12, 13, 14, 15]` を付与。
*   **Methodology Extraction**: 「手順」を構造化データ (`step_by_step_instructions`) として抽出。

### 索引・参考文献 (Index / Bibliography)
*   生物エンティティ数がゼロでも、`notes` や `taxonomic_group` でページ内容を記録する。
*   **Index Validation**: 既存Bio-Graphデータの学名照合に使用。

## 10. Multi-PC Synchronization (NEW 2026-01-10)

このプロジェクトは **Google Drive** 経由で複数PCから編集される可能性がある。

*   **作業開始前**: ユーザーの明示的な「開始」指示を待つ。
*   **大きなJSON編集**: 一時ファイルに書き込み、確認後にマージする方式を検討。
*   **競合発生時**: ユーザーに報告し、手動解決を依頼。

## 11. API Non-Dependency Mandate (CRITICAL)

*   `ikimon_digitizer_v3.php` や `VisionProcessor.php` などの **外部APIスクリプトは使用禁止**。
*   エージェント自身が `view_file` ツールで画像を直接閲覧し、人間のように内容を読み取ってJSONを作成する。
*   **理由**: エージェントの「目」が最強のツール。外部APIへの依存はエラーの温床。

---
**Verification Checklist for Every Page:**
- [ ] **Tool Check**: Am I using `view_file` for images?
- [ ] **Census**: Did I count every single photo/figure?
- [ ] **Completeness**: Does my JSON list every calculated figure?
- [ ] **Comparisons**: Are my descriptions comparative ("Smaller than X") rather than absolute ("Small")?
- [ ] **Global Origin**: Did I define the native range for any introduced species?
- [ ] **Variations**: Did I separate Male, Female, Underside, and Morph variations?
- [ ] **Cross-Page Context**: (For magazines) Did I record related pages?
- [ ] **No API**: Am I avoiding external API scripts?
