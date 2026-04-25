# V3 Data Fusion Strategy: From Books to "Bio-Graph"

We have successfully simulated the ingestion of two very different books:
1.  **Stag Beetle Handbook (Book A)**: Deep identification logic, visual focus.
2.  **River Guide (Book B)**: Broad regional distribution, habitat maps.

## How to Utilize (Fuse) the Data

The goal is not just an archive, but a living **Bio-Graph**.

### 1. The Merge Key: `modern_taxon_id`
All data is pivoted on the `modern_taxon_id` (e.g., GBIF ID or J-IBIS ID).
*   Book A says: "Dorcus rectus" (ID: 1001) is "Length 15-54mm".
*   Book B says: "Dorcus rectus" (ID: 1001) is "Found in Nakatsugawa Rapids".

### 2. The Fusion Result (API Response)
When the user asks "Tell me about Dorcus rectus", the API constructs this:

```json
{
  "taxon_id": 1001,
  "name": "コクワガタ",
  "identification_wizard": {
    "logic_source": "Book A (Stag Beetle Handbook)",
    "question": "大顎の内歯は直線的ですか？"
  },
  "distribution_layer": [
    { "region": "Global", "text": "北海道〜九州 (Book A)" },
    { "region": "Kanagawa", "text": "相模川中流・中津川 (Book B)", "habitat": "Riverbeds" }
  ],
  "gallery": [
    { "image": "book_a_p05_crop.jpg", "label": "Male Large", "roi": [...] },
    { "image": "book_b_p42.jpg", "label": "Specimen", "roi": [...] }
  ]
}
```

### 3. Utilization Scenarios
*   **The "Travel Guide" Mode**: Using Book B's data, users near Sagami River get a specific checklist.
*   **The "Expert ID" Mode**: Using Book A's logic, users identify the exact species found.

This proves that **diversity in input leads to richness in output**.

## 4. Visualizing Respect: The "Authors First" UI
To ensure our respect is **visible** to the world (and the authors), the UI must implement:

### A. The "Source Shelf" (Virtual Bookshelf)
At the bottom of every Species Profile, display a horizontal scroll of **every book/paper referenced**.
*   **Visual**: Cover art (for books) or Journal Logo (for papers).
*   **Action**: One-click "Buy on Amazon" or "View on J-STAGE".
*   **Affiliate/Purchase**: "Buy this book" links for users who want the full original context.

## 5. Temporal Honesty (The Archive Concept)
**Crucial Philosophy**: `ikimon` is a "Living Archive", not a "Breaking News" site.
*   **The Rule**: Never display a fact without its valid era.
    *   ❌ "Distribution: Sagami River"
    *   ✅ "Distribution: Sagami River (**1995**)"
*   **UI Implementation**:
    *   **Timestamp Badges**: Every data block (Bio, Map, Logic) gets a `YYYY` badge.
    *   **"Outdated" is Valuable**: We celebrate the difference. "In 1995, Ooyoshikiri were common here (now rare)" is a massive value proposition for conservation biology.
*   **Disclaimer**: A global sticky note on legacy pages: *"This data reflects the biological state as of [Year]. Modern taxonomy or distribution may have changed."*
*   **Message**: "This data was compiled from these respectable sources."

### B. Evidence Badges
When displaying a specific fact, tag the source immediately.
*   *Before*: "Size: 50mm"
*   *After*: "Size: 50mm (Source: Stag Beetle Handbook)"
*   **Why**: It proves we aren't stealing; we are **quoting**.

### C. The "Diversity Graph"
A visualization showing: "This species data is a consensus of [3 Books] and [5 Papers]."
*   High source count = High Confidence.
*   Demonstrates that ikimon is a **hub**, not a copycat.

