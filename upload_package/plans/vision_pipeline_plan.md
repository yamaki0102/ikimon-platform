# IMPLEMENATION PLAN: True Vision Pipeline (Batch Processing)

## Goal
Automate the extraction of visual semantics from thousands of scanned book pages without using simulated/dummy data.

## Core Philosophy
*   **See or Stop**: If the system cannot "see" (no API access), it must halt. No guessing.
*   **Idempotency**: Results are cached. Re-running the script skips already processed images.
*   **Cost Awareness**: Processing 1000 images costs money. The system must report estimated costs or require explicit confirmation (batch size limits).

## Component Architecture

### 1. `libs/VisionProcessor.php`
The brain of the operation.
*   `loadQueue(string $jsonPath)`: Reads the Bio-Graph JSON.
*   `processBatch(int $limit)`: Takes the next N `queued` items.
*   `analyzeImage(string $imagePath)`: Sends the image to the Vision API.
*   `saveCache(string $slug, string $page, array $result)`: Stores the "Truth".

### 2. `scripts/run_vision_queue.php`
The CLI entry point for the user.
*   Usage: `php run_vision_queue.php --book=world_amphibians_visual --limit=5`
*   Features:
    *   Checks for API Key (`GOOGLE_API_KEY` or `OPENAI_API_KEY`).
    *   Displays progress bar.
    *   Updates the main JSON file with results from the Cache.

### 3. API Integration Strategy
*   **Primary**: Google Gemini Pro Vision (via API Key).
    *   Why: High capacity, good Japanese OCR, understands layouts well.
*   **Prompt Engineering**:
    *   "Analyze this page from a biological visual guide."
    *   "Identify the layout (Top/Bottom, Grid, Single)."
    *   "For each species, extract: Name (JP/Scientific), Physical Features, Habitat, Descriptive Text."
    *   "Return ONLY valid JSON."

## Data Structure Transition
*   **Current**: `v3_graph_*.json` contains `{"type": "pending_vision_analysis"}`.
*   **Target**: `v3_graph_*.json` contains full `visual_guide_page` structures with data sourced from `data/vision_cache/`.

## Next Steps
1.  Implement `VisionProcessor.php`.
2.  Implement `run_vision_queue.php`.
3.  User needs to provide an API Key in `.env` (I will create a template).
