# Autonomous Ingestion Plan: Lepidoptera (Files 096-129)

## objective
Enable "Sleep Mode" processing for the Lepidoptera (Butterflies & Moths) section.

## Execution Queue

| File ID | Book Page | Predicted Image | Taxonomic Group (Expected) | Status |
|:---|:---|:---|:---|:---|
| **096** | 182-183 | `20260102_131953_Page097.jpg` | Lepidoptera (Introduction) | [x] Complete |
| **097** | 184-185 | `20260102_132002_Page098.jpg` | Lepidoptera (Primitive Moths: Micropterigidae/Hepialidae) | [x] Complete |
| **098** | 186-187 | `20260102_132009_Page099.jpg` | Lepidoptera (Bagworms & Tineidae) | [x] Complete |
| **099** | 188-189 | `20260102_132014_Page100.jpg` | Lepidoptera (Tortricidae & Pyralidae) | [x] Complete |
| **100** | 190-191 | `20260102_132020_Page101.jpg` | Lepidoptera (Lasiocampidae) | [x] Complete |
| **101** | 192-193 | `20260102_132028_Page102.jpg` | Lepidoptera (Saturniidae 1) | [x] Complete |
| **102** | 194-195 | `20260102_132034_Page103.jpg` | Lepidoptera (Saturniidae 2) | [x] Complete |
| **103** | 196-197 | `20260102_132040_Page104.jpg` | Lepidoptera (Papilionidae 1) | [x] Complete |
| **104** | 198-199 | `20260102_132047_Page105.jpg` | Lepidoptera (Papilionidae 2) | [x] Complete |
| **105** | 200-201 | `20260102_132052_Page106.jpg` | Lepidoptera (Pieridae 1) | [x] Complete |
| **106** | 202-203 | `20260102_132057_Page107.jpg` | Lepidoptera (Pieridae 2) | [x] Complete |
| **107** | 204-205 | `20260102_132103_Page108.jpg` | Lepidoptera (Lycaenidae 1) | [x] Complete |
| **108** | 206-207 | `20260102_132109_Page109.jpg` | Lepidoptera (Lycaenidae 2) | [x] Complete |
| **109** | 208-209 | `20260102_132115_Page110.jpg` | Lepidoptera (Lycaenidae 3) | [x] Complete |
| **110** | 210-211 | `20260102_132127_Page111.jpg` | Lepidoptera (Nymphalidae 1) | [x] Complete |
| **111** | 212-213 | `20260102_132133_Page112.jpg` | Lepidoptera (Nymphalidae 2) | [x] Complete |
| **112** | 214-215 | `20260102_132137_Page113.jpg` | Lepidoptera (Nymphalidae 3) | [x] Complete |
| **113** | 216-217 | `20260102_132145_Page114.jpg` | Lepidoptera (Nymphalidae 4) | [x] Complete |
| **114** | 218-219 | `20260102_132208_Page115.jpg` | Lepidoptera (Nymphalidae 5: Apaturinae/Charaxinae) | [x] Complete |
| **115** | 220-221 | `20260102_132214_Page116.jpg` | Lepidoptera (Satyrinae) | [x] Complete |
| **116** | 222-223 | `20260102_132220_Page117.jpg` | Lepidoptera (Hesperiidae 1) | [x] Complete |
| **117** | 222-223 | `20260102_132220_Page117.jpg` | Lepidoptera (Hesperiidae 2) | [x] Complete |
| **118** | 224-225 | `20260102_132230_Page118.jpg` | Lepidoptera (Larvae 1) | [x] Complete |
| **119** | 226-227 | `20260102_132236_Page119.jpg` | Lepidoptera (Drepanidae & Epicopeiidae) | [x] Complete |
| **120** | 228-229 | `20260102_132242_Page120.jpg` | Lepidoptera (Uraniidae & Geometridae 1) | [x] Complete |
| **121** | 230-231 | `20260102_132251_Page121.jpg` | Lepidoptera (Geometridae 2: Ennominae) | [x] Complete |
| **122** | 232-233 | `20260102_132300_Page122.jpg` | Lepidoptera (Geometridae 3: Geometrinae) | [x] Complete |
| **123** | 234-235 | `20260102_132306_Page123.jpg` | Lepidoptera (Notodontidae) | [x] Complete |
| **124** | 236-237 | `20260102_132312_Page124.jpg` | Lepidoptera (Erebidae 1: Arctiinae) | [x] Complete |
| **125** | 238-239 | `20260102_132319_Page125.jpg` | Lepidoptera (Nolidae & Erebidae 2) | [x] Complete |
| **126** | 240-241 | `20260102_132338_Page126.jpg` | Lepidoptera (Noctuidae 1) | [x] Complete |
| **127** | 242-243 | `20260102_132347_Page127.jpg` | Lepidoptera (Noctuidae 2) | [x] Complete |
| **128** | 244-245 | `20260102_132355_Page128.jpg` | Lepidoptera (Larvae 2) | [x] Complete |
| **129** | 246-247 | `20260102_132406_Page129.jpg` | Lepidoptera (Ecology/Mimicry) | [x] Complete |

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
