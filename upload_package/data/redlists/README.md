# Red List CSV Import Format

## MECE Geographic Scope Hierarchy

```
scope_level        | country_code | region_code | municipality_code | Example
-------------------|-------------|-------------|-------------------|---------------------------
global             | NULL        | NULL        | NULL              | IUCN Red List
regional           | NULL        | "EU"        | NULL              | European Red List
national           | "JP"        | NULL        | NULL              | 環境省レッドリスト
subnational_1      | "JP"        | "JP-22"     | NULL              | 静岡県レッドデータブック
subnational_2      | "JP"        | "JP-22"     | "22130"           | 浜松市版レッドデータブック
```

## Required Columns

| Column | Description |
|--------|------------|
| `scientific_name` | Latin binomial (genus + species) |
| `category` | IUCN code: EX/EW/CR/EN/VU/NT/LC/DD/NE/LP |
| `scope_level` | One of: global/regional/national/subnational_1/subnational_2 |
| `scope_name` | Human-readable name of the geographic scope (in original language) |
| `authority` | Issuing body name |

## Optional Columns

| Column | Description |
|--------|------------|
| `japanese_name` | Japanese common name (和名) |
| `common_name_en` | English common name |
| `criteria` | IUCN criteria string (e.g., "B1ab(iii)") |
| `country_code` | ISO 3166-1 alpha-2 (e.g., JP, US, GB) |
| `region_code` | ISO 3166-2 (e.g., JP-22, US-CA) |
| `municipality_code` | Local admin code (e.g., JIS X 0402 for Japan: "22130") |
| `scope_name_en` | English name of scope |
| `scope_centroid_lat` | Latitude of scope area centroid (geographic anchor) |
| `scope_centroid_lng` | Longitude of scope area centroid |
| `parent_scope_name` | Parent administrative unit (for traceability after mergers) |
| `scope_valid_from` | Date scope name became valid (ISO 8601) |
| `scope_valid_until` | Date scope name was retired (NULL = still active) |
| `scope_note` | Free text: merger history, boundary changes, etc. |
| `source_url` | URL of source document |
| `assessment_year` | Year of assessment |
| `version` | Version string (e.g., "2024.1") |
| `taxon_group` | Taxon group in original language |
| `taxon_group_en` | Taxon group in English (e.g., Mammalia, Aves) |
| `notes` | Free text notes |

## 100-Year Resilience Design

Administrative boundaries change. Japan's "Great Heisei Mergers" halved municipalities
from 3,200 to 1,700. To ensure data remains interpretable in 100 years:

1. **Geographic Anchor**: `scope_centroid_lat/lng` provides a permanent spatial reference
   even when codes become obsolete
2. **Temporal Snapshot**: `scope_name` records the name as it was when assessed
3. **Change Tracking**: `scope_valid_from/until` + `scope_note` record boundary changes
4. **Parent Chain**: `parent_scope_name` links to the containing administrative unit
5. **Code Resilience**: ISO/JIS codes are convenience fields, not primary identifiers

## Category Mapping

Japanese Red List categories map to IUCN codes:

| Japanese | Code | IUCN Equivalent |
|----------|------|----------------|
| 絶滅 | EX | Extinct |
| 野生絶滅 | EW | Extinct in the Wild |
| 絶滅危惧IA類 | CR | Critically Endangered |
| 絶滅危惧IB類 | EN | Endangered |
| 絶滅危惧I類 | CR+EN | CR or EN (not differentiated) |
| 絶滅危惧II類 | VU | Vulnerable |
| 準絶滅危惧 | NT | Near Threatened |
| 情報不足 | DD | Data Deficient |
| 絶滅のおそれのある地域個体群 | LP | Local Population (Japan-specific) |

## Import Command

```bash
php scripts/ingestion/import_redlist.php                    # All CSVs
php scripts/ingestion/import_redlist.php --with-gbif        # + GBIF taxonomy resolution
php scripts/ingestion/import_redlist.php --file=env_2024.csv # Single file
php scripts/ingestion/import_redlist.php --dry-run          # Preview only
```
