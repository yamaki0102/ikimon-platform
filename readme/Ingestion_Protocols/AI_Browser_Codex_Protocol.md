# AI Browser Ingestion Protocol: The Codex Standard (2026.01.11)

> **"From Semantic Interpretation to Physical Measurement"**

## 1. Objective
To transcend the limitations of "Agent Vision" (Qualitative/Semantic) by introducing **"Codex Intelligence"** (Quantitative/Spatial).
We utilize a Browser Agent to drive ChatGPT's **Advanced Data Analysis (Python)** to extract physically accurate metadata from book pages.

---

## 2. The Core Shift
| Dimension | Old Standard (Agent Vision) | **New Standard (Codex Protocol)** |
| :--- | :--- | :--- |
| **Counting** | "I see about 5 bugs" (Subjective) | **"CV2 found 7 contours" (Objective)** |
| **Location** | "Top Right" (Text) | **`{"bbox": [100, 40, 200, 150]}` (Coordinates)** |
| **Color** | "Light Green" (Language) | **`["#A5D6A7", "#1B5E20"]` (Hex Quantization)** |
| **Verification** | Human Review | **Code Execution (Physical Truth)** |

---

## 3. Workflow Specification

### Phase 1: Browser Navigation & Injection
The Agent (You) does not analyze the image directly. You act as the **Operator**.
1.  **Open Browser**: Navigate to `https://chatgpt.com`.
2.  **Upload**: Upload the high-resolution page scan (`.jpg`).
3.  **Prompt Injection**: Paste the standard **Codex Ingest Prompt**.
    *   *Prompt Key Objectives*:
        1.  Convert to Grayscale & Threshold.
        2.  `cv2.findContours` to isolate biological islands.
        3.  `K-Means` clustering for dominant color extraction per island.
        4.  Output **Raw JSON** only.

### Phase 2: The Physical JSON Schema
The Output from Codex MUST adhere to this structure:

```json
{
  "meta": {
    "image_width": 2000,
    "image_height": 3000,
    "detected_count": 5
  },
  "visual_entities": [
    {
      "id": "codex_obj_01",
      "bbox": [x, y, w, h],  // The physical location on the image
      "dominant_colors": ["#HEX1", "#HEX2"], // The physical color truth
      "shape_metrics": { "aspect_ratio": 1.5, "area": 4500 }
    }
  ]
}
```

### Phase 3: The Semantic Merger
The Agent (You) takes the Codex JSON and merges it with your biological knowledge.
*   **Codex says**: "There is a green object at `[100, 100]`."
*   **Agent says**: "That location corresponds to *Holochlora japonica*."
*   **Result**:
    ```json
    {
        "japanese_name": "クビキリギス",
        "notes": "Diagnostic: Red mouth...",
        "meta_visual": {
            "bbox": [100, 100, 300, 200],
            "dominant_colors": ["#4CAF50"]
        }
    }
    ```

---

## 4. Zero Loss Enforcement
*   **Count mismatch**: If Codex finds 10 objects but Agent only identifies 8 species, the Agent **MUST** investigate the remaining 2 objects. They are likely:
    *   Sexual dimorphism (Male/Female separate figures).
    *   Larval stages.
    *   Synonyms or "Look-alike" species mentioned in text.
    *   *Artifacts/Dirt (False Positive)* - only then can they be discarded.

## 5. Fallback Mode (Manual Pilot)
If Browser Automation is unavailable (Network/Auth issues):
1.  **Manual Upload**: Asking the User to run the prompt.
2.  **Paste Output**: User provides the JSON.
3.  **Merge**: Agent performs the semantic mapping.
