# Autonomous Ingestion Plan: Hemiptera & Minor Orders (Files 043-059)

## objective
Enable "Sleep Mode" processing for the remaining Hemiptera (True Bugs) and subsequent minor orders (Neuroptera, etc.) leading up to Coleoptera.

## Execution Queue

| File ID | Book Page | Predicted Image | Taxonomic Group (Expected) | Status |
|:---|:---|:---|:---|:---|
| **043** | 86-87 | `20260102_131318_Page044.jpg` | Hemiptera (Cicadas 2: Niini/Minmin) | [x] Complete |
| **044** | 88-89 | `20260102_131328_Page045.jpg` | Hemiptera (Cicadas 3: Tsukutsuku/Haru/Exotics) | [x] Complete |
| **045** | 90-91 | `20260102_131334_Page046.jpg` | Hemiptera (Leafhoppers/Planthoppers) | [x] Complete |
| **046** | 92-93 | `20260102_131341_Page047.jpg` | Hemiptera (Aquatic Bugs) | [x] Complete |
| **047** | 94-95 | `20260102_131347_Page048.jpg` | Hemiptera (Stink Bugs 1: Assassin/Squash) | [x] Complete |
| **048** | 96-97 | `20260102_131353_Page049.jpg` | Hemiptera (Stink Bugs 2: Pentatomidae) | [x] Complete |
| **049** | 98-99 | `20260102_131359_Page050.jpg` | Feature: Insects & Plants (Galls/Symbiosis) | [x] Complete |
| **050** | 100-101 | `20260102_131404_Page051.jpg` | Hymenoptera (Intro: Bees/Wasps/Ants) | [x] Complete |
| **051** | 102-103 | `20260102_131411_Page052.jpg` | Hymenoptera (Sawflies & Parasitic Wasps) | [x] Complete |
| **052** | 104-105 | `20260102_131417_Page053.jpg` | Hymenoptera (Hunting Wasps 1: Scoliidae/Sphecidae) | [x] Complete |
| **053** | 106-107 | `20260102_131422_Page054.jpg` | Hymenoptera (Hornets & Bees: Vespidae/Apidae) | [x] Complete |
| **054** | 108-109 | `20260102_131432_Page055.jpg` | Hymenoptera (Ants) | [x] Complete |
| **055** | 110-111 | `20260102_131437_Page056.jpg` | Feature: Ant Guests & Neuropterida (Snakeflies/Dobsonflies) | [x] Complete |
| **056** | 112-113 | `20260102_131445_Page057.jpg` | Megaloptera (Dobsonflies) & Neuroptera (Lacewings) | [x] Complete |
| **057** | 114-115 | `20260102_131450_Page058.jpg` | Neuroptera (Lacewings & Antlions) | [x] Complete |
| **058** | 116-117 | `20260102_131459_Page059.jpg` | Neuroptera (Lacewings & Mantispids) | [x] Complete |
| **059** | 118-119 | `20260102_131508_Page060.jpg` | Neuroptera (Antlions) & Strepsiptera | [x] Complete |

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
