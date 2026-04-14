# ikimon Cutover Day 1 Todo

更新日: 2026-04-12  
目的: `ikimon_v2_cutover_readiness_checklist_2026-04-12.md` の Gate 1 と Gate 2 を、1日で実務前進させる。  
ゴールは `切替そのもの` ではない。  
ゴールは、**切替条件を曖昧にしないための土台を今日中に揃えること**。

---

## 0. 今日の勝ち筋

今日やることは 3 本だけ。

1. `legacy write inventory` をコード起点で再監査する
2. `canonical 契約表` の初版を作る
3. 次回以降に迷わないよう、差分確認の入口を docs に固定する

今日やらないこと:

- v2 UI 実装
- PostgreSQL 本実装
- importer 実装
- delta sync 実装
- rollback script 実装

理由:

- そこへ行く前に、`何を同期するのか` と `何を正本にするのか` を固定しないと全てやり直しになる

---

## 1. 成果物

今日の成果物は、最低でも次の 4 つ。

1. `legacy_write_inventory_2026-04-11.md` 更新
2. `place / visit / observation / evidence / condition / follow` の canonical 契約表 doc 新規作成
3. divergence check の最小入口 doc 新規作成
4. readiness checklist の Gate 1 / Gate 2 現在地更新

Done 判定:

- docs を見れば `何をPHPで維持し、何をcanonicalへ寄せるか` が第三者にも分かる
- 次の実装者がコード探索をゼロからやらなくて済む

---

## 2. 1日のタイムボックス

### Block 1. Legacy write 再監査

目安:

- 90 分

対象:

- `upload_package/public_html/api/`
- `upload_package/public_html/api/v2/`
- `upload_package/libs/`
- `oauth_callback.php`

やること:

- write 系 endpoint を機械検索で列挙する
- `DataStore::save`, `DataStore::append`, `file_put_contents`, upload move を拾う
- `users`, `auth_tokens`, `observations`, `events`, `tracks`, `likes`, `follows`, `notifications`, `invites`, `surveys`, `uploads` のどれに触るか分類する
- `legacy_write_inventory_2026-04-11.md` に漏れ・ズレを反映する

完了条件:

- critical write surface の追加漏れがない
- physical write target が各 write path にひもづく

失敗条件:

- endpoint 名だけで止まり、実ファイル書き込み先まで落ちていない

### Block 2. Asset path 実態固定

目安:

- 45 分

対象:

- photos
- avatars
- audio
- scan uploads

やること:

- code 上の upload path 定義を列挙する
- `public_html/uploads` と `persistent/uploads` の使い分けを整理する
- `legacy path -> canonical path` のマッピング表に必要な列を決める

完了条件:

- `asset path drift` の正体が文書で追える
- path 例が最低 1 件ずつある

### Block 3. Canonical 契約表 初版

目安:

- 120 分

対象概念:

- `place`
- `visit`
- `observation`
- `evidence`
- `condition`
- `follow`

やること:

- 各概念について、`役割 / 主キー / 現行保存先 / 将来canonical先 / 生成契機 / UIでの主語 / rollback上の注意` を表にする
- `JSON only state` を明示する
- `今はPHPで持つもの` と `v2で再定義するもの` を分ける

完了条件:

- UI 主語と保存主語のズレが見える
- 次に divergence check を作る時の参照表になる

失敗条件:

- 抽象論だけで、現行コード / 保存先への接続がない

### Block 4. Divergence check 入口設計

目安:

- 60 分

やること:

- 最小で比較すべき項目を決める
- まず docs で比較観点を固定する
- 可能なら CLI の入出力仕様だけ書く

最低比較項目:

- users count
- auth token count
- observations count
- photo file count
- sample observation -> asset 解決率
- sample place / visit 解決率

完了条件:

- 何を比べれば `ずれている` と言うのかが固定される

### Block 5. Readiness 更新

目安:

- 30 分

やること:

- Gate 1 / Gate 2 の現在地を更新
- 今日埋まらなかった穴を `次回の first action` として残す

完了条件:

- 明日見たときに `続きが1手目から分かる`

---

## 3. 実行順チェックリスト

### A. 着手前

- [ ] `ikimon_v2_cutover_readiness_checklist_2026-04-12.md` を開く
- [ ] `legacy_write_inventory_2026-04-11.md` を開く
- [ ] `ADR-001-canonical-source-of-truth.md` を開く
- [ ] `canonical_migration_policy.md` を開く

### B. Code search

- [ ] `DataStore::save`
- [ ] `DataStore::append`
- [ ] `file_put_contents`
- [ ] `move_uploaded_file`
- [ ] `rename(`
- [ ] `copy(`
- [ ] `auth_tokens.json`
- [ ] `users.json`
- [ ] `observations`
- [ ] `tracks`
- [ ] `persistent/uploads`
- [ ] `public_html/uploads`

### C. Inventory 更新

- [ ] write endpoint 名を確定
- [ ] 実ファイル保存先を確定
- [ ] side effect を列挙
- [ ] dual-write minimum set を見直す
- [ ] hotspot を更新する

### D. Canonical 契約表

- [ ] `place` 行を書く
- [ ] `visit` 行を書く
- [ ] `observation` 行を書く
- [ ] `evidence` 行を書く
- [ ] `condition` 行を書く
- [ ] `follow` 行を書く
- [ ] `UI 主語` 列を埋める
- [ ] `現行正本` 列を埋める
- [ ] `将来canonical` 列を埋める
- [ ] `rollback注意点` 列を埋める

### E. Divergence check 入口

- [ ] 比較単位を count / mapping / checksum に分ける
- [ ] 最小 CLI 入力を決める
- [ ] 最小 CLI 出力を決める
- [ ] `pass / warn / fail` の条件を書く

### F. Close

- [ ] readiness checklist の Gate 1 を更新
- [ ] readiness checklist の Gate 2 を更新
- [ ] `次にやる1手` を 3つ以内で書く

---

## 4. 推奨コマンド

```powershell
rg -n "DataStore::save|DataStore::append|file_put_contents|move_uploaded_file|rename\\(|copy\\(" E:\Projects\Playground\upload_package
rg -n "auth_tokens\\.json|users\\.json|invites\\.json|observations|tracks|persistent/uploads|public_html/uploads" E:\Projects\Playground\upload_package
php E:\Projects\Playground\upload_package\tools\lint.php
```

`rg` が使えない場合:

```powershell
Get-ChildItem E:\Projects\Playground\upload_package -Recurse -Include *.php | Select-String -Pattern "DataStore::save|DataStore::append|file_put_contents|move_uploaded_file|rename\(|copy\("
```

---

## 5. 採用条件 / 不採用条件 / 計測指標

### 採用条件

- 1日で終わる粒度に分解されている
- 1つの成果物が次の実装に直結する
- docs 更新だけでなく、コード起点の棚卸しが入っている

### 不採用条件

- `v2 を作り始める` まで含める
- product UI 改装と切替基盤を同日に混ぜる
- gate 状態を更新しない

### 計測指標

- 更新された write surface 数
- 契約表に載った概念数
- divergence check 比較項目数
- Gate 1 / Gate 2 の未解決論点数

---

## 6. 今日の終わりに残すべき状態

- Gate 1:
  - `ほぼ DONE` か、残件が1つに圧縮されている
- Gate 2:
  - `初版あり` で、ズレが見える
- 明日の1手:
  - divergence check 最小版を作る
  - asset path mapping を確定する
  - canonical contract をコードへ接続する

ここまで行けば、`切替条件を整える` は口だけでなく実務フェーズに入る。
