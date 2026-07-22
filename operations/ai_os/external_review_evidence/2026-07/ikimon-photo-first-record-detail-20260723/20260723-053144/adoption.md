# Scene-state review adoption

- model used: `gemini-3.1-flash-lite`
- status: complete
- target: `platform_v2/cloudflare_shadow/docs/PR_F_PHOTO_FIRST_REVIEW_PACKET.md`
- focus: 検出あり／非検出／判定不能、derived環境境界、比較非表示、位置保護、写真中心UX

## 採用・検証

- 非derived環境値と未知の内部コードがscene chipへ出ないHTML契約テストを追加した。
- `not_detected` は「この写真では」に限定し、不在を断定する語を出さない。`not_assessable` は判断不能として分離する既存契約を13件のtargeted testで再確認した。
- 公開範囲と位置保護はメディア直下のrecord metadataに常時表示し、Visual QAでmobile/desktopとも確認した。

## 不採用・調整

- 公開範囲と位置保護を写真より上へ移す提案は、写真を先頭にする確定済み情報順序と衝突するため不採用。代わりに写真直下へ常時表示し、折りたたまない契約を維持した。
- `not_detected` を一般的な「AI could not identify」に置き換える提案は不採用。正本どおり写真内の確認範囲に限定した文言の方が、同定失敗と姿の非検出を混同しない。
- `_source` の型を `derived` のみへ狭める提案は不採用。read modelはowner/imported値も保持する必要があり、表示境界でのruntime allowlistと混入テストを採用した。

## PR外へ維持

- privacy-safeな同一地点比較projection
- learning contentの新規生成・保存
- PostgreSQL側のsignal/snapshotとD1記録の新規連携
- migration、backfill、新規AI解析
