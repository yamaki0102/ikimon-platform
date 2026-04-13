# Autonomous Ingestion Plan: Coleoptera (Files 060-090)

## objective
Enable "Sleep Mode" processing for the Coleoptera (Beetles) section, the largest order in the book.

## Execution Queue

| File ID | Book Page | Predicted Image | Taxonomic Group (Expected) | Status |
|:---|:---|:---|:---|:---|
| **060** | 120-121 | `20260102_131514_Page061.jpg` | Coleoptera (Introduction) | [x] Complete |
| **061** | 122-123 | `20260102_131520_Page062.jpg` | Coleoptera (Primitive & Tiger Beetles) | [x] Complete |
| **062** | 124-125 | `20260102_131527_Page063.jpg` | Coleoptera (Ground Beetles: Carabus) | [x] Complete |
| **063** | 126-127 | `20260102_131535_Page064.jpg` | Coleoptera (Ground Beetles: Harpalinae & Brachininae) | [x] Complete |
| **064** | 128-129 | `20260102_131542_Page065.jpg` | Coleoptera (Ground Beetles: Small Gomimushi) | [x] Complete |
| **065** | 130-131 | `20260102_131551_Page066.jpg` | Coleoptera (Water Beetles: Dytiscidae/Hydrophilidae) | [x] Complete |
| **066** | 132-133 | `20260102_131607_Page067.jpg` | Coleoptera (Scavenger/Carrion/Hister Beetles) | [x] Complete |
| **067** | 134-135 | `20260102_131614_Page068.jpg` | Coleoptera (Rove Beetles: Staphylinidae) | [x] Complete |
| **068** | 136-137 | `20260102_131621_Page069.jpg` | Coleoptera (Stag Beetles 1: Platycerus/Dorcus) | [x] Complete |
| **069** | 138-139 | `20260102_131626_Page070.jpg` | Coleoptera (Stag Beetles 2: Miyama/Nokogiri) | [x] Complete |
| **070** | 140-141 | `20260102_131633_Page071.jpg` | Coleoptera (Stag Beetles 3: Dorcus/Neolucanus) | [x] Complete |
| **071** | 142-143 | `20260102_131642_Page072.jpg` | Meta: Errata Sheet | [x] Complete |
| **072** | 144-145 | `20260102_131659_Page073.jpg` | Coleoptera (Dung Beetles) | [x] Complete |
| **073** | 146-147 | `20260102_131704_Page074.jpg` | Coleoptera (Rhinoceros Beetles) | [x] Complete |
| **074** | 148-149 | `20260102_131708_Page075.jpg` | Coleoptera (Shining Leaf Chafers: Rutelinae) | [x] Complete |
| **075** | 150-151 | `20260102_131713_Page076.jpg` | Coleoptera (Long-armed & Flower Chafers) | [x] Complete |
| **076** | 152-153 | `20260102_131719_Page077.jpg` | Coleoptera (Flower Chafers) | [x] Complete |
| **077** | 154-155 | `20260102_131729_Page078.jpg` | Coleoptera (Click Beetles & Ladybugs 1) | [x] Complete |
| **078** | 156-157 | `20260102_131735_Page079.jpg` | Coleoptera (Ladybugs 2 & Darkling Beetles) | [x] Complete |
| **079** | 158-159 | `20260102_131745_Page080.jpg` | Coleoptera (Tenebrionoids & Longhorn Beetles 1) | [x] Complete |
| **080** | 160-161 | `20260102_131752_Page081.jpg` | Coleoptera (Longhorn Beetles 2) | [x] Complete |
| **081** | 162-163 | `20260102_131758_Page082.jpg` | Coleoptera (Fireflies) | [x] Complete |
| **082** | 164-165 | `20260102_131803_Page083.jpg` | Coleoptera (Dermestids, Anobiids & Dark Jewel Beetles) | [x] Complete |
| **083** | 166-167 | `20260102_131810_Page084.jpg` | Coleoptera (Flat/Fungus & Leaf Beetles 1) | [x] Complete |
| **084** | 168-169 | `20260102_131816_Page085.jpg` | Coleoptera (Sap/Fungus & Leaf Beetles 2) | [x] Complete |
| **085** | 170-171 | `20260102_131824_Page086.jpg` | Meta: Duplicate (Ladybugs) | [x] Complete |
| **086** | 172-173 | `20260102_131829_Page087.jpg` | Coleoptera (Tumbling Flower & False Darkling Beetles) | [x] Complete |
| **087** | 158 (Dup) | `20260102_131839_Page088.jpg` | Meta: Duplicate (Tenebrionidae) | [x] Complete |
| **088** | 160 (Dup) | `20260102_131844_Page089.jpg` | Meta: Duplicate (Meloidae) | [x] Complete |
| **089** | 162 (Dup) | `20260102_131851_Page090.jpg` | Meta: Duplicate (Cerambycidae 1) | [x] Complete |
| **090** | 164 (Dup) | `20260102_131856_Page091.jpg` | Meta: Duplicate (Cerambycidae 2) | [x] Complete |
| **091** | 166 (Dup) | `20260102_131903_Page092.jpg` | Meta: Duplicate (Cerambycidae 3) | [x] Complete |
| **092** | 168 (Dup) | `20260102_131908_Page093.jpg` | Meta: Duplicate (Chrysomelidae) | [x] Complete |
| **093** | 176-177 | `20260102_131916_Page094.jpg` | Coleoptera (Weevils 1: Attelabidae) | [x] Complete |
| **094** | 178-179 | `20260102_131921_Page095.jpg` | Coleoptera (Weevils 2: Curculionidae) | [x] Complete |
| **095** | 180-181 | `20260102_131927_Page096.jpg` | Trichoptera (Caddisflies) | [x] Complete |
| **096** | 182-183 | `20260102_131953_Page097.jpg` | Lepidoptera (Introduction) | [x] Complete |

## Agent Instructions (Sleep Mode)
1. **Check this file** to see the next `[ ] Pending` item.
2. **View the Predicted Image** immediately.
3. **Perform High-Speed Census**:
   - Identify all species.
   - Initialize the File ID in `v3_agent_ingest_batch_002.json`.
   - **Immediately Populate** the species with "Diagnostic Notes" and Romaji.
   - Use `// turbo` logic: Propose the initialization and population in one turn if context allows.
4. **Mark as Complete** in this file and `task.md`.
5. **Proceed to next file** autonomously.

## Recovery
If image content does not match the Taxonomic Group, update the group in this file and proceed.
