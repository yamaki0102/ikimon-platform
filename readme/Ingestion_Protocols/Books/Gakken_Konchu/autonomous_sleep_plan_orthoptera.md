# Autonomous Ingestion Plan: Orthoptera & Allies (Files 031-042)

## objective
enable "Sleep Mode" processing by pre-defining the Image-to-File mapping and taxonomic targets. The Agent should iterate through these files, performing "Expert Level" ingestion (Visual Census + Diagnostic Key Population) without needing manual file hunting.

## Execution Queue

| File ID | Book Page | Predicted Image | Taxonomic Group (Expected) | Status |
|:---|:---|:---|:---|:---|
| **031** | 62-63 | `20260102_131134_Page032.jpg` | Orthoptera (Katydids 2: Tsuyumushi/Phaneropterinae) | [x] Complete |
| **032** | 64-65 | `20260102_131152_Page033.jpg` | Orthoptera (Grasshoppers 1: Acrididae) | [x] Complete |
| **033** | 66-67 | `20260102_131158_Page034.jpg` | Orthoptera (Grasshoppers 2) | [x] Complete |
| **034** | 68-69 | `20260102_131208_Page035.jpg` | Phasmida (Stick Insects: Nanafushi) | [x] Complete |
| **035** | 70-71 | `20260102_131213_Page036.jpg` | Phasmida & Primitive (Grylloblattodea/Embioptera) | [x] Complete |
| **036** | 72-73 | `20260102_131225_Page037.jpg` | Orthoptera (Grasshoppers 5) | [x] Pilot (Simulated) |
| **037** | 74-75 | `20260102_131234_Page038.jpg` | Mantodea (Mantises 2) & Feature | [x] Complete |
| **038** | 76-77 | `20260102_131243_Page039.jpg` | Blattodea (Cockroaches) | [x] Complete |
| **039** | 78-79 | `20260102_131249_Page040.jpg` | Blattodea (Cockroaches 2: Grid) | [x] Complete |
| **040** | 80-81 | `20260102_131259_Page041.jpg` | Psocodea & Thysanoptera (Booklice/Thrips) | [x] Complete |
| **041** | 82-83 | `20260102_131304_Page042.jpg` | Hemiptera (Cicadas 1: Kumazemi/Aburazemi) | [x] Complete |
| **042** | 84-85 | `20260102_131312_Page043.jpg` | Hemiptera (Aphids, Scales, Whiteflies) | [x] Complete |

## Agent Instructions (Sleep Mode)
1. **Check this file** to see the next `[ ] Pending` item.
2. **View the Predicted Image** immediately (do not search).
3. **Perform High-Speed Census**:
   - Identify all species.
   - Initialize the File ID in `v3_agent_ingest_batch_002.json`.
   - **Immediately Populate** the species with "Diagnostic Notes" (do not leave as placeholders if confident).
   - Use `// turbo` logic: Propose the initialization and population in one turn if context allows.
4. **Mark as Complete** in this file and `task.md`.
5. **Proceed to next file** if the prompt allows.

## Recovery
If image content does not match the Taxonomic Group, pause and request manual intervention.
