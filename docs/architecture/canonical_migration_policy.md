# Canonical Migration Policy

更新日: 2026-04-11

## 現時点の責任分離

- JSON: 既存投稿の受け口、legacy read、raw archive、rollback fallback
- `ikimon.db`: canonical schema、監査、公開制御、今後の多言語・学校・asset・AI runtime の正本

## 移行ルール

1. 既存 read path を一気に切り替えない
2. 新規 write path は dual-write 可能な単位から進める
3. canonical に入った機能は、追加 state を JSON 側だけに持たせない
4. rollback できない migration は merge しない
5. JSON と canonical の divergence を CLI で確認できる状態を保つ

## 今期の優先順

1. observation canonical schema
2. localization state
3. asset ledger
4. school consent / review
5. agent task ledger
