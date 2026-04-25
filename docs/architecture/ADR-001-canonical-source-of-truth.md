# ADR-001 Canonical Source of Truth

更新日: 2026-04-11

## 決定

`ikimon.db` を canonical source として育てる。  
既存 JSON は直ちに廃止しないが、役割を `raw ingest / legacy read / export fallback / rollback safety` に限定する。

## 理由

- 多言語、asset ledger、school workspace、AI task log は JSON の二重正本では破綻する
- 観察単位を超える state transition を監査付きで扱うには DB が必要
- 既存運用を止めずに移行するには JSON を archive 兼 fallback として残すのが最小リスク

## 直近ポリシー

1. 新しい横断機能は canonical schema を先に持つ
2. 既存投稿系は当面 JSON write を維持する
3. canonical write は段階的に追加し、 divergence check を必須にする
4. JSON を新機能の唯一正本として増やさない

## 結果

- `DataStore` は「残す」が「広げない」
- `CanonicalStore` / migration / audit log を今期の中心に置く
- PostgreSQL 移行は今期の前提にしない。SQLite canonical を先に固める
