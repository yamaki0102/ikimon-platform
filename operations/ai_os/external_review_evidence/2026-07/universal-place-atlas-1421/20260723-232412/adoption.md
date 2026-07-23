# Universal Place Atlas 外部レビュー採否

対象SHA: `e365a84d48366efd98da416ef59609bee325dbdd`

採否記録日: 2026-07-23

## 判定

- Claude lane: `limited`
  - 実装ソースを読めなかったと明記しており、コード監査結果としては採用しない。
  - 仕様上の fail-closed、公開Memory、前進ロールバックに関する肯定評価のみ参考採用。
- Gemini lane: `adopted_with_fixes`
  - 3件のP1と画像URL allowlistを採用し、staging前に修正。
  - 64-bit canonical IDと自動階層化は互換性と範囲の理由で延期。

## Claude laneの事実照合

Claude出力はレビュー環境で対象ソースを取得できず、次の誤認を含む。

| 主張 | 対象SHAのGit blobによる確認 | 採否 |
|---|---|---|
| `mapExplorer.ts` が0 byte | 648,682 bytes、blob `3603ff1b99d16359752a7d9f81e982a06e720a50` | 不採用 |
| `placeDomain.ts` が7,180 bytes | 25,873 bytes、blob `aef4c9775dc74cee7dcb8bafcd4f19618692a168` | 不採用 |
| EXIF/XMP除去の記述がない | `PRIVACY_REVIEW.md` 58行目にWebP EXIF/XMP拒否を記載 | 不採用 |
| 対象ソースを独立検証できない | raw結果自身が明記 | 採用。Claude laneを限定扱いにする |

対象SHAでの追加blob確認:

- `recordPlaceBackfill.ts`: 11,257 bytes、`ed8aa3faa3f9216534a4861cb6d254ee16f10c4f`
- `placeAtlasProfileNative.ts`: 55,122 bytes、`382aa81dd6613ae357aa9c7ea8a979104d5125b3`
- `PRIVACY_REVIEW.md`: 2,947 bytes、`a973d864e46722a3be1da84964eef2a14f8a6dd7`

ClaudeのP0はコードの欠陥ではなくレビュー環境の制約に起因し、対象SHAの
Git object確認で「0 byte」とlocator誤認は反証できた。raw結果は改変せず証跡として保持する。

## Gemini laneの採否

### 採用・修正

1. P1: 境界変更後にoutsideとなったRecordの旧membership残留
   - 全有効位置Recordを再評価単位として、未レビューの計算membershipを先に
     `removed_at` 付きで無効化し、今回有効な所属だけを再有効化する。
   - 人がレビューしたcorrection/removalは上書きしない。
   - stale除去、冪等再実行、review済み保護、再入場復元を実SQLiteテストで固定。
2. P1: Workerの巨大geometry CPU負荷
   - request-time判定を1,000頂点までに制限。
   - 超過時は簡略化して誤所属を作らず、Record集計を`partial`として返す。
3. P1: D1 snapshot 5,000行読み込み
   - 上限を500行へ縮小。
   - 上限到達時は`partial`とし、`null`と0を混同しない。
4. 推奨: 同一origin画像URLの過剰許可
   - `/derived/`、`/derived-transform/`、`/thumb/`、`/uploads/`、
     `/data/uploads/`だけを許可。
   - traversal、API/HTMLパス、backslashを拒否するテストを追加。

### 延期

1. P2: 64-bit IDから128-bitへの全面変更
   - 現段階で変更すると、migration、canary、既存seedのstable IDを破壊する。
   - source referenceの一意制約とmerge/supersede監査を現契約とし、
     ID v2は互換migrationを伴う別Issueで扱う。
2. 自動階層化
   - 信頼できるzone境界がない場所を捏造しない原則を優先し、管理された
     relationship contractのみ提供する。

## staging gate

採用したP1修正後に、Node/Worker全テスト、typecheck、build、migration rehearsal、
local E2Eを再実行する。すべてgreenになるまでstaging deployしない。

本番migration、backfill、deployは中央承認ゲートの明示承認がないため実行しない。
