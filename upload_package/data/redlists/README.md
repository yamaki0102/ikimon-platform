# Red List CSV Import Directory

Place CSV files in this directory to automatically import Red List data.
The filename does not matter, but `.csv` extension is required.

## CSV Format Definition
**Encoding**: UTF-8
**Header**: Required (`scope`, `authority`, `scientific_name`, `japanese_name`, `code`)

| Column | Description | Example |
| :--- | :--- | :--- |
| `scope` | Scope of the list (`global`, `national`, `local`) | `national` |
| `authority` | Name of the issuing authority | `Ministry of the Environment 2020` |
| `scientific_name` | Scientific name (used for matching) | `Accipiter gentilis` |
| `japanese_name` | Vernacular name (for display/fallback) | `オオタカ` |
| `code` | Threat category code (CR, EN, VU, NT, DD, LP, VW) | `VU` |

## How to Apply
Run the import script:
```bash
php scripts/import_redlist.php
```
This will generate `data/redlist_mapping.json`.
