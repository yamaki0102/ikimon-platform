# Legacy Ingestion Schema V2 (Scalable)

## Improvements for 100+ Book Scale
1. **`book_master_id`**: Essential for joining pages to a book entity.
2. **`page_number`**: Explicitly extracted to allow sorting.
3. **`layout_semantics`**: Structured breakdown of the visual intent.
4. **`data_reliability`**: Confidence flags for extracted facts.

## Schema Example
```json
{
  "header": {
    "book_master_id": "isbn-978-4-8299-8152-0", 
    "book_slug": "kuwagata_handbook_revised",
    "page_number": 7,
    "page_type": "visual_index"
  },
  "content": {
    "species": [
      {
        "name_check": "ヒラタクワガタ",
        "facts": {
           "distribution_map_derived": ["本州", "四国", "九州", "南西諸島"],
           "distribution_text": "記載なし"
        },
        "visual_emphasis": {
           "highlighted_feature": "大顎の内歯の位置",
           "comparison_target": "なし（単独掲載による存在感の強調）"
        }
      }
    ]
  },
  "curation": {
    "editorial_tone": "実用重視。比較よりも個体のバリエーション（大型・小型）を見せることに主眼がある。",
    "citation": {
       "text": "横川忠司 (2019) クワガタムシハンドブック 増補改訂版 p.7, 文一総合出版",
       "bibtex": "@book{yokokawa2019, author={Yokakawa, Tadashi}, title={Kuwagatamushi Handbook Revised}, publisher={Bun-ichi Sogo Shuppan}, year={2019}, pages={7}}"
    },
    "monetization": { "affiliate_tag": "enabled" }
  }
}
```

## Section 2: Requirements for Citation Utility
1. **Precise Page Numbering**: Essential for academic citation.
2. **Bibliographic Consistency**: Author, Year, Publisher must be normalized.
3. **Deep Linking**: The citation should ideally link back to the specific `ikimon.life` archive page.
