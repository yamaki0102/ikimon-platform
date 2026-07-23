# PR #1434 Wレビュー採否

## 対象

- 対象SHA: `83e8cc9ee0a37ea20145bf179b0cdabf5c98ad98`
- Gemini: `gemini-3.5-flash`
- Claude: `claude-opus-4-8`
- 判定: 修正後のopen P0/P1は0

## 採用

1. Gemini P1「500件上限外のcandidate/removedがgeometry fallbackで復活」
   - 除外Record IDを表示queryから分離。
   - 5,000件超ではgeometry fallbackを全抑制しpartialへ変更。
2. Gemini P2「Occurrenceが500枠を圧迫」
   - `visit_id`単位で先に統合し、Record単位で上限を適用。
3. Claude条件付きP0「rights行が無いRecordをNOT EXISTSで許可」
   - 正のactive `public_summary` / `external_export` rightsを必須化。
   - legacy importの既存public visibilityを、出典付き・export権限なしで
     rights envelopeへ移すadditive migrationを追加。
4. Claude P1「snapshotとmembershipの和集合が500超でもcompleteになり得る」
   - merge後のunique Record数でもcomplete判定し、超過時はpartialへ変更。
5. Claude P2「別versionの除外とconfirmedが共存」
   - 除外Setをconfirmed projectionにも適用し、privacy優先でfail-closed。

## 保留・不採用

- Geminiの既存chunk query全面並列化は、今回の新規privacy P1とは独立し、
  staging実測profile latencyが既に30–75msだったため本PRでは保留。
  D1同時queryの運用上限を計測してから別性能変更として扱う。
- Claudeの観察時刻丸めは既存public snapshot contract全体の変更になるため、
  今回のhistorical membership projectionだけでは変更しない。
- `production_import_evidence_assets` は現行D1 import基盤の必須テーブルであり、
  optional table扱いへ広げない。

## 検証

- Worker TypeScript check: pass
- focused Worker tests: 26 pass / 0 fail
- exclusion overflow、merged overflow、positive rights、migration replayを追加
- exact coordinate / user identityをmembership SELECT・公開JSONへ追加していない
