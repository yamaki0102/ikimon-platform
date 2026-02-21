# National Red List Configuration

To achieve national coverage (47 Prefectures + 1724 Municipalities), we use a distributed configuration system.

## How to add a new municipality
1. Copy `_template.json` to a new file, e.g., `13_tokyo.json`.
2. Find the URL of the target Red List (HTML table version is best).
3. Use browser DevTools to find CSS selectors for the table.
4. Update the JSON fields.

## File Naming Convention
- Prefectures: `JP-01_hokkaido.json` ~ `JP-47_okinawa.json`
- Cities: `JP-13-101_chivoda-ku.json` (Recommended: JIS Code prefix)

## Structure
```json
[
    {
        "id": "unique_id",
        "name": "Readable Name",
        "url": "Target URL",
        "type": "html_table",
        "selectors": {
            "row": "tr",
            "name": "td.name_class",
            "scientific_name": "td.sci_name_class",
            "category": "td.rank_class"
        },
        "scope": "local",
        "authority": "Official Authority Name"
    }
]
```
The scraper will automatically load all `.json` files in this directory.
