# Staging Digitized Books

- staging host: `https://staging.ikimon.life/`
- review URL: `https://staging.ikimon.life/ops/digitized-books`
- RAG data URL: `https://staging.ikimon.life/ops/digitized-books/rag-data`
- purpose: raw scan を公開せず、staging 上で catalog / page manifest / usage policy だけを確認する

## Sync command

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync_staging_digitized_books.ps1 -Source "E:\Projects\book"

php .\upload_package\scripts\ingestion\pilot_digitized_book_rag.php "E:\Projects\book\data\インセクタリゥム37" 1 31 --resume
```

## Notes

- `E:\Projects\book` の直下に `data\` がある場合は自動でそこを使う
- staging に上げるのは `digitized_books_catalog.json` と `digitized_pages/*.json` だけ
- raw image 本体は VPS に送らない
- staging deploy 後にこの sync を実行する
- continuity-aware pilot manifests は `upload_package/data/library/digitized_rag_pilot/*.json` に保存する
