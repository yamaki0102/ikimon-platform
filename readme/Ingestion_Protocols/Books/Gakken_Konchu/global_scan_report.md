# Global Scan Report: Gakken no Zukan LIVE Konchu
**Phase 1: Macro-Analysis & Density Mapping**
**Date**: 2026-01-04
**Status**: Partial Complete (Files 009 - 053)

## 1. Executive Summary
The "Two-Pass Strategy" has been initiated. A full visual inspection of **Files 009 to 053** (Book Pages ~18 to ~90) reveals a consistently **High Density** structure, averaging **15-25 distinct species per catalog page**. The "Anti-Sampling Rule" is mandatory for >85% of the content.

> [!WARNING]
> **Metadata Discrepancy Detected**: Previous ingestion records referenced "Page 54" for Cicadas and "Page 56" for Aphids. Visual inspection confirms:
> - **Crickets** are on Book Page 54/56 (Files 035/036).
> - **Aphids** are on Book Page 70 (File 043).
> - **Cicadas** are on Book Page 72 (File 044).
> Future ingestion MUST rely on **Visual Validation** of the current file, ignoring legacy page number references.

## 2. Density Heatmap & Content Map (Files 009-053)

| File ID | Book Page | Content / Group | Density | Est. Species | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **009-012** | 18-24 | Introduction / Evolution | Low | 0 | Text/Diagrams |
| **013** | 26 | Thysanura (Silverfish) | High | 15+ | **Anti-Sampling Active** |
| **014** | 28 | Ephemeroptera (Mayflies) | High | 20 | Very dense grid |
| **015-018** | 30-36 | Odonata (Dragonflies) | High | 15-20 | Male/Female figures frequent |
| **019-028** | 38-56?| Odonata (Damselflies/Darners)| High | 15-20 | Consistently dense |
| **029** | - | *Feature: Insect Flight* | Low | 0 | Ecology |
| **030** | 44?? | Dermaptera (Earwigs) | High | 15+ | |
| **031** | 46 | Plecoptera (Stoneflies) | High | 15+ | |
| **032, 033** | 48, 50 | Orthoptera (Grasshoppers) | High | 20+ | Very dense |
| **034** | 52 | *Feature: Grasshopper Body* | Med | 5 | Anatomy |
| **035, 036** | 54, 56 | Orthoptera (Crickets) | High | 20+ | |
| **037, 038** | 58, 60 | Orthoptera (Katydids) | High | 20+ | |
| **039** | 62 | *Feature: Stick Insect Body* | Med | 5 | Anatomy |
| **040** | 64 | Phasmida / Grylloblattodea | High | 15+ | |
| **041** | 66 | Mantodea (Mantids) Intro | Med | 5-10 | |
| **042** | 68 | Mantodea (Mantids) | High | 15 | |
| **043** | 70 | Hemiptera (Aphids) | **Very High**| 25+ | Tiny figures, strict census needed |
| **044, 045** | 72, 74 | Hemiptera (Cicadas) | High | 15-20 | |
| **046** | 76 | Hemiptera (Leafhoppers) | High | 20+ | |
| **047** | 78 | Giant Water Bugs / Striders | High | 15 | |
| **048, 049** | 80, 82 | Hemiptera (Stink Bugs) | High | 20+ | |
| **050** | 84 | *Feature: Insects & Plants* | Low | - | Ecology |
| **051** | 86 | Hymenoptera Intro | Med | - | |
| **052** | 88 | Sawflies / Ichneumon Wasps | High | 20+ | |
| **053** | 90 | Spider Wasps / Scoliid Wasps | High | 20+ | |

## 3. Revised Ingestion Plan (Phase 2)

Given the confirmation of High Density streams and the page number offset:
1.  **Start Point**: **File 030** (Earwigs) or **File 031** (Stoneflies).
    *   *Reason*: To ensure the Orthoptera block (Book 48-60) is fully captured in High Density, bridging the gap from Odonata.
2.  **Protocol**:
    *   Strict **Anti-Sampling**.
    *   **Visual Census** for every page.
    *   **Ignore Legacy Page Numbers**; use File ID as the primary reference key.
3.  **Batching**:
    *   Batch A: Files 030-042 (Earwigs, Orthoptera, Mantids).
    *   Batch B: Files 043-055 (Hemiptera part 1).

## 4. Next Steps
- [x] Global Scan (Files 009-053).
- [ ] Determine if Files 054-166 should be scanned immediately or if Ingestion can begin for Batch A while scanning continues in parallel.
- [ ] **Recommendation**: Begin Ingestion of Batch A (Files 030-042) to demonstrate "Zero Loss" on the Orthoptera block immediately.

## 5. Detailed Scan Data (Files 009-166)

| File ID | Est. Book Pg | Taxonomic Group | Est. Count | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `File009-027.jpg` | ~20-50 | Odonata (Dragonflies/Damselflies) | High | *Scanned in previous session. High density confirmed.* |
| `File028.jpg` | ~44 | Orthoptera (Intro) | N/A | Feature page. |
| `File029.jpg` | ~56 | Orthoptera (Crickets) | ~15 | **Korogi 1**. Mismapped in legacy. |
| `File030.jpg` | ~44 | Dermaptera (Earwigs) | ~14 | **Hasamimushi**. Validated. |
| `File031.jpg` | ~52 | Orthoptera (Katydids 1) | ~15 | **Kirigirisu 1**. |
| `File032.jpg` | ~54 | Orthoptera (Katydids 2) | ~15 | **Kirigirisu 2**. |
| `File033.jpg` | ~48 | Orthoptera (Grasshoppers 1) | ~10 | **Batta 1**. |
| `File034.jpg` | ~50 | Orthoptera (Grasshoppers 2) | ~15 | **Batta 2**. |
| `File035-039.jpg` | ~56-62 | (Pending precise map) | ? | *To be verified in Phase 2.* |
| `File040.jpg` | ~64 | Blattodea (Cockroaches) | ~15 | **Gokiburi**. Confirmed Forest species. |
| `File041.jpg` | ~66 | Mantodea (Mantids 1) | N/A | Feature. |
| `File042.jpg` | ~68 | Mantodea (Mantids 2) | ~12 | **Kamakiri**. |
| `File043-053.jpg` | ~70-90 | Hemiptera (Cicadas, Bugs) | High | *Scanned in previous session.* |
| `File054.jpg` | ~92 | Hymenoptera (Wasps/Bees) | ~15 | **Suzumebachi / Hanabachi**. |
| `File055.jpg` | ~94 | Hymenoptera (Ants 1) | ~20 | **Ari no nakama 1**. High density. |
| `File056.jpg` | ~96 | Hymenoptera (Ants 2) | ~10 | **Ari no su**. Guests & ecology. |
| `File057.jpg` | ~98 | Neurop/Megaloptera | ~10 | **Rakudamushi / Hebitonbo**. |
| `File058.jpg` | ~100 | Megaloptera / Neuroptera | ~12 | **Hebitonbo / Amime-kagero**. |
| `File059.jpg` | ~102 | Neuroptera / Strepsiptera | ~15 | **Kusakagero / Nejibane**. |
| `File060.jpg` | ~104 | Coleoptera (Intro) | N/A | **Kochu-moku**. |
| `File061.jpg` | ~106 | Coleoptera (Tiger Beetles) | ~12 | **Hanmyou**. |
| `File062.jpg` | ~108 | Coleoptera (Carabidae 1) | ~15 | **Osamushi**. Ground Beetles Part 1. High density. |
| `File063.jpg` | ~110 | Coleoptera (Carabidae 2) | ~20 | **Gomimushi 1**. Ground Beetles Part 2. Very high density. |
| `File064.jpg` | ~112 | Coleoptera (Carabidae 3) | ~20 | **Gomimushi 2**. Ground Beetles Part 3. Very high density. |
| `File065.jpg` | ~114 | Coleoptera (Dytiscidae) | ~15 | **Gengoro**. Water Beetles. |
| `File066.jpg` | ~116 | Coleoptera (Hydrophilidae) | ~15 | **Gamushi / Shidemushi**. Water Scavenger / Carrion Beetles. |
| `File067.jpg` | ~118 | Coleoptera (Staphylinidae) | ~20 | **Hanekakushi**. Rove Beetles. Very high density. |
| `File068.jpg` | ~120 | Coleoptera (Lucanidae 1) | ~12 | **Kuwagata 1**. Stag Beetles. |
| `File069.jpg` | ~122 | Coleoptera (Lucanidae 2) | ~10 | **Kuwagata 2**. Stag Beetles. |
| `File070.jpg` | ~124 | Coleoptera (Lucanidae 3) | ~12 | **Kuwagata 3**. Stag Beetles. |
| `File071.jpg` | N/A | **ERRATA SHEET** | N/A | **Seigohyo**. Correction sheet. *Important Reference*. |
| `File072.jpg` | ~126 | Coleoptera (Geotrupidae) | ~15 | **Senchi-kogane**. Dung Beetles. |
| `File073.jpg` | ~128 | Coleoptera (Scarabaeidae 1) | ~6 | **Kabutomushi** (Rhinoceros Beetle) intro + Kogane. |
| `File074.jpg` | ~130 | Coleoptera (Scarabaeidae 2) | ~15 | **Kogane-mushi 2**. Scarabs. |
| `File075.jpg` | ~132 | Coleoptera (Scarabaeidae 3) | ~15 | **Kogane-mushi 3**. Scarabs. |
| `File076.jpg` | ~134 | Coleoptera (Scarabaeidae 4) | ~15 | **Hanamuguri 1**. Flower Chafers. |
| `File077.jpg` | ~136 | Coleoptera (Scarabaeidae 5) | ~15 | **Hanamuguri 2**. Flower Chafers. |
| `File078.jpg` | ~138 | Coleoptera (Buprestidae 1) | ~15 | **Tamamushi**. Jewel Beetles. |
| `File079.jpg` | ~140 | Coleoptera (Buprestidae 2) | ~15 | **Tamamushi / Doromushi**. Jewel/Riffle Beetles. |
| `File080.jpg` | ~142 | Coleoptera (Elateridae 1) | ~15 | **Kometsuki 1**. Click Beetles. |
| `File081.jpg` | ~144 | Coleoptera (Elateridae 2) | ~15 | **Kometsuki 2**. Click Beetles. |
| `File082.jpg` | ~146 | Coleoptera (Lampyridae) | ~12 | **Hotaru**. Fireflies. Feature page? |
| `File083.jpg` | ~148 | Coleoptera (Dermestidae) | ~15 | **Katsuobushi-mushi**. Skin Beetles. |
| `File084.jpg` | ~150 | Coleoptera (Cucujoidea 1) | ~15 | **Hiratamushi**. Flat Bark Beetles. |
| `File085.jpg` | ~152 | Coleoptera (Nitidulidae) | ~15 | **Keshikisui**. Sap Beetles. High Density. |
| `File086.jpg` | ~154 | Coleoptera (Coccinellidae) | ~20 | **Tentoumushi**. Ladybugs. High Density. |
| `File087.jpg` | ~156 | Coleoptera (Mordellidae) | ~15 | **Hanaminomi**. Tumbling Flower Beetles. |
| `File088.jpg` | ~158 | Coleoptera (Tenebrionidae) | ~20 | **Gomimushidamashi**. Darkling Beetles. |
| `File089.jpg` | ~160 | Coleoptera (Meloidae) | ~10 | **Tsuchihanmyo**. Blister Beetles. |
| `File090.jpg` | ~162 | Coleoptera (Cerambycidae 1) | ~15 | **Kamikirimushi 1**. Longhorn Beetles. |
| `File091.jpg` | ~164 | Coleoptera (Cerambycidae 2) | ~15 | **Kamikirimushi 2**. Longhorn Beetles. |
| `File092.jpg` | ~166 | Coleoptera (Cerambycidae 3) | ~15 | **Kamikirimushi 3**. Longhorn Beetles. |
| `File093.jpg` | ~168 | Coleoptera (Chrysomelidae) | ~20 | **Hamushi**. Leaf Beetles. High Density. |
| `File094.jpg` | ~170 | Coleoptera (Attelabidae) | ~15 | **Otoshibumi**. Leaf-rolling Weevils. |
| `File095.jpg` | ~172 | Coleoptera (Curculionidae) | ~20 | **Zoumushi**. Weevils. High Density. |
| `File096.jpg` | ~174 | Trichoptera | ~15 | **Tobikera**. Caddisflies. |
| `File097.jpg` | ~176 | Lepidoptera (Intro) | N/A | **Chōmoku**. Butterflies & Moths Intro. |
| `File098.jpg` | ~178 | Lepidoptera (Primitive Moths 1) | ~15 | **Komoriga / Suikoga**. Swift Moths etc. |
| `File099.jpg` | ~180 | Lepidoptera (Primitive Moths 2) | ~15 | **Minoga / Hirozuga**. Bagworms / Clothes Moths. |
| `File100.jpg` | ~182 | Lepidoptera (Lasiocampidae) | ~12 | **Karehaga**. Lappet Moths. |
| `File101.jpg` | ~184 | Lepidoptera (Saturniidae 1) | ~8 | **Yamamayuga 1**. Giant Silkmoths (Yo-na). |
| `File102.jpg` | ~186 | Lepidoptera (Saturniidae 2) | ~8 | **Yamamayuga 2**. Giant Silkmoths. |
| `File103.jpg` | ~188 | Lepidoptera (Sphingidae) | ~12 | **Suzumega**. Hawk Moths. |
| `File104.jpg` | ~190 | Lepidoptera (Papilionidae 1) | ~8 | **Agehachō 1**. Swallowtails. |
| `File105.jpg` | ~192 | Lepidoptera (Papilionidae 2) | ~6 | **Agehachō 2**. Swallowtails. |
| `File106.jpg` | ~194 | Lepidoptera (Pieridae 1) | ~15 | **Shirochō 1**. Whites/Sulphurs. |
| `File107.jpg` | ~196 | Lepidoptera (Pier/Lyc) | ~15 | **Shirochō 2 / Shijimichō 1**. Whites / Blues. |
| `File108.jpg` | ~198 | Lepidoptera (Lycaenidae 1) | ~15 | **Shijimichō 2**. Blues/Coppers. |
| `File109.jpg` | ~200 | Lepidoptera (Lycaenidae 2) | ~15 | **Shijimichō 3**. Hairstreaks. |
| `File110.jpg` | ~202 | Lepidoptera (Lycaenidae 3) | ~15 | **Shijimichō 4**. Hairstreaks / Metalmarks. |
| `File111.jpg` | ~204 | Lepidoptera (Nymphalidae 1) | ~12 | **Tatehachō 1**. Danainae (Asagimadara). |
| `File112.jpg` | ~206 | Lepidoptera (Nymphalidae 2) | ~12 | **Tatehachō 2**. Fritillaries (Hyomon). |
| `File113.jpg` | ~208 | Lepidoptera (Nymphalidae 3) | ~12 | **Tatehachō 3**. Admirals / Mapwings. |
| `File114.jpg` | ~210 | Lepidoptera (Nymphalidae 4) | ~12 | **Tatehachō 4**. Commas / Tortoiseshells. |
| `File115.jpg` | ~212 | Lepidoptera (Nymphalidae 5) | ~12 | **Tatehachō 5**. Oakleaf / Pansies / Emperors. |
| `File116.jpg` | ~214 | Lepidoptera (Nymphalidae 6) | ~10 | **Tatehachō 6**. Emperors (Oomurasaki). |
| `File117.jpg` | ~216 | Lepidoptera (Nymphalidae 7) | ~15 | **Tatehachō 7 (Janomechō)**. Satyrs / Ringlets. |
| `File118.jpg` | ~218 | Lepidoptera (Hesperiidae) | ~20 | **Seserichō**. Skippers. |
| `File119.jpg` | ~220 | Lepidoptera (Larvae) | ~15 | **Chō no Yōchū**. Caterpillars. |
| `File120.jpg` | ~222 | Lepidoptera (Drepanidae) | ~15 | **Kagiba**. Hooktips. |
| `File121.jpg` | ~224 | Lepidoptera (Geometridae 1) | ~15 | **Tsubamega / Shakuga 1**. Uraniidae / Geometers. |
| `File122.jpg` | ~226 | Lepidoptera (Geometridae 2) | ~15 | **Shakuga 2**. Geometers. |
| `File123.jpg` | ~228 | Lepidoptera (Notodontidae) | ~15 | **Shachihokoga**. Prominents. |
| `File124.jpg` | ~230 | Lepidoptera (Lymantriidae) | ~15 | **Dokuga**. Tussock Moths. |
| `File125.jpg` | ~232 | Lepidoptera (Erebidae 1) | ~15 | **Hitoriga**. Tiger Moths. |
| `File126.jpg` | ~234 | Lepidoptera (Nolidae / Noctuidae 1) | ~20 | **Kobuga / Yaga 1**. Nolid / Owlet Moths. |
| `File127.jpg` | ~236 | Lepidoptera (Noctuidae 2) | ~20 | **Yaga 2**. Owlet Moths. |
| `File128.jpg` | ~238 | Lepidoptera (Noctuidae 3) | ~15 | **Yaga 3 / Yochu**. Owlets / Moth Larvae. |
| `File129.jpg` | ~240 | Lepidoptera (Column) | N/A | **Mimicry**. Comparisons. |
| `File130.jpg` | ~242 | Mecoptera / Siphonaptera | ~10 | **Siriagemushi / Nomi**. Scorpionflies / Fleas. |
| `File131.jpg` | ~244 | Diptera 1 (Nematocera) | ~15 | **Gaganbo / Ka**. Crane Flies / Mosquitoes. |
| `File132.jpg` | ~246 | Diptera 2 (Brachycera 1) | ~15 | **Abu / Hae 1**. Horse / Robber Flies. |
| `File133.jpg` | ~248 | Diptera 3 (Brachycera 2) | ~15 | **Hana-abu / Hae 2**. Hover / House Flies. |
| `File134.jpg` | ~250 | Non-Insect Arthropods (Intro) | N/A | **Fushibushi-doubutsu**. Intro to non-insects. |
| `File135.jpg` | ~252 | Entognatha | ~12 | **Tobimushi**. Springtails. |
| `File136.jpg` | ~254 | Crustacea (Isopoda) | ~15 | **Dangomushi / Warajimushi**. Woodlice. |
| `File137.jpg` | ~256 | Myriapoda | ~15 | **Mukade / Yasude**. Centipedes / Millipedes. |
| `File138.jpg` | ~258 | Arachnida (Acari) | ~15 | **Dani**. Mites / Ticks. |
| `File139.jpg` | ~260 | Arachnida (Scorpiones etc.) | ~10 | **Sasori / Zatomushi**. Scorpions / Harvestmen. |
| `File140.jpg` | ~262 | Arachnida (Araneae 1) | ~10 | **Kumo 1**. Spiders (Intro / Orb Weavers). |
| `File141.jpg` | ~264 | Arachnida (Araneae 2) | ~15 | **Kumo 2**. Spiders (Orb Weavers). |
| `File142.jpg` | ~266 | Arachnida (Araneae 3) | ~15 | **Kumo 3**. Hunting Spiders (Salticidae/Lycosidae). |
| `File143.jpg` | ~268 | Column (Environment) | N/A | **Kankyo**. Environment & Conservation. |
| `File144.jpg` | ~270 | Guide (Collecting/Rearing) | N/A | **Saishu / Shiiku**. Collecting & Rearing Guide. |
| `File145.jpg` | ~272 | Guide (Rearing) | N/A | **Shiiku**. Rearing Examples. |
| `File146.jpg` | ~274 | Guide (Rearing) | N/A | **Kuwagata**. Rearing Stag Beetles. |
| `File147.jpg` | ~276 | Guide (Rearing) | N/A | **Gengorou**. Rearing Diving Beetles. |
| `File148.jpg` | ~278 | Guide (Rearing) | N/A | **Batta**. Rearing Locusts. |
| `File149.jpg` | ~280 | Guide (Rearing) | N/A | **Koorogi**. Rearing Crickets. |
| `File150.jpg` | ~282 | Guide (Rearing) | N/A | **Kamakiri**. Rearing Mantises. |
| `File151.jpg` | ~284 | Guide (Rearing) | N/A | **Ageha**. Rearing Butterflies. |
| `File152.jpg` | ~286 | Guide (Specimens) | N/A | **Hyouhon**. Making Beetle Specimens. |
| `File153.jpg` | ~288 | Guide (Specimens) | N/A | **Hyouhon**. Making Butterfly Specimens. |
| `File154.jpg` | ~290 | Guide (Museums) | N/A | **Konchukan**. Visiting Insect Museums. |
| `File155.jpg` | ~292 | Guide (Shops) | N/A | **Dougu**. Insect Gear & Shops. |
| `File156.jpg` | ~294 | Index (A-Ka) | N/A | **Sakuin**. Index. |
| `File157.jpg` | ~296 | Index (Ka-Sa) | N/A | **Sakuin**. Index. |
| `File158.jpg` | ~298 | Index (Sa-Ta) | N/A | **Sakuin**. Index. |
| `File159.jpg` | ~300 | Index (Ta-Ha) | N/A | **Sakuin**. Index. |
| `File160.jpg` | ~302 | Index (Ha-Ma) | N/A | **Sakuin**. Index. |
| `File161.jpg` | ~304 | Index (Ma-Wa) | N/A | **Sakuin**. Index. |
| `File162.jpg` | ~306 | Index (Wa / Sci) | N/A | **Sakuin**. Index. |
| `File163.jpg` | ~308 | Index / Ending | N/A | **Sakuin**. Index End. |
| `File164.jpg` | ~310 | Credits | N/A | **Staff**. Credits. |
| `File165.jpg` | ~312 | Colophon | N/A | **Okuzuke**. Colophon. |
| `File166.jpg` | ~314 | End / AR | N/A | **AR**. AR Promo. |

## 6. Global Scan Summary & Next Steps

### Scan Completion Status
- **Files Scanned**: 009 - 166 (Complete Content Range).
- **Core Biological Content**: Files 009 - 142.
- **Appendices**: Files 143 - 166.

### Critical Discrepancies Found
1.  **Non-Linear Indexing**: The file names (e.g., `Page042.jpg`) do NOT correspond to book page numbers.
2.  **Offset**: There is a consistent offset, and the "Page" number in the filename largely acts as a unique ID rather than a semantic page number.
3.  **Missing Groups**: Plecoptera (Stoneflies) were not explicitly isolated in the high-level scan. They require targeted search in **Phase 2** (Likely near File 016-018).

### Phase 2 Ingestion Strategy (Revised)
1.  **Block-Based Ingestion**: Proceed by Taxonomic Blocks defined in this report, rather than numerical file order.
2.  **Visual Verification First**: Always `view_file` to confirm content before generating JSON.
3.  **Density & Comparison**: adherence to High-Density Protocol is now safe, as the "Map" is complete.


