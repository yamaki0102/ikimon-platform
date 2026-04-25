# ikimon Canonical Connection Decision: Quick Post / Scan Summary / Scan Detection

更新日: 2026-04-12  
目的: `quick_post / scan_summary / scan_detection` を、`いま canonical に接続するか` で決め切る。  
曖昧にすると、create path ごとに別 contract が増えて Gate 2 が崩れる。

---

## 1. Decision

### 1.1 `quick_post.php`

決定:

- `いま canonical に接続する`

理由:

- 人手投稿である
- 写真付き observation create であり、意味は `post_observation` と近い
- `CanonicalObservationWriter` の contract に最も自然に乗る
- place-first の公開面で使う導線に近く、legacy JSON only のまま放置する価値が低い

扱い:

- `DataStore::append('observations', ...)` の後に `CanonicalObservationWriter::writeFromObservation(...)`
- 既存 guard をそのまま共有してよい

### 1.2 `scan_summary.php`

決定:

- `いま canonical に接続しない`

理由:

- これは `1件の生物 occurrence` ではなく `活動サマリー`
- `3種検出 / 30分ウォーク` のような summary を occurrence に入れると canonical の主語が壊れる
- 将来は `visit / session summary` 側に寄せるべきで、`observation writer` に無理に流す対象ではない

扱い:

- 当面 `JSON only`
- v2 では `visit summary / session contribution` 契約として再定義する

### 1.3 `scan_detection.php`

決定:

- `CanonicalObservationWriter には接続しない`
- `passive_event` と同じ machine policy で canonical に接続する

理由:

- machine-generated detection であり、人手投稿 contract と別物
- `PassiveObservationEngine` と `passive_event.php` がすでに `MachineObservation` の separate policy を持ち始めている
- ここだけ human-post writer に寄せると、`machine observation create` が二系統になる

扱い:

- `CanonicalMachineObservationPolicy` を共有する
- parent event / child event / occurrence / photo evidence は machine path として直接 canonical に書く
- `official_record / session_intent / test_profile` が field でない場合は canonical write を行わない

---

## 2. Why this split is correct

### `quick_post`

- 主語: 人が撮ってすぐ残す 1 observation
- canonical fit: 高い
- rollback complexity: 低い

### `scan_summary`

- 主語: visit / session summary
- canonical fit: 低い
- rollback complexity: 高い

### `scan_detection`

- 主語: machine observation batch
- canonical fit: 中
- ただし human-post writer への fit は低い

結論:

- `quick_post` だけ先に canonical へ寄せる
- `scan_summary` は summary として保留
- `scan_detection` は `passive_event` 側へ寄せてから扱う

---

## 3. Implementation order

1. `quick_post.php`
   - `CanonicalObservationWriter` 接続
   - guard shared
   - divergence 再確認
2. `passive_event.php`
   - machine observation separate test/dev policy
3. `scan_detection.php`
   - `passive_event` と contract 統一
   - machine policy 共有で canonical 接続
4. `scan_summary.php`
   - v2 `visit summary` 設計まで保留

---

## 4. Gate impact

この決定で閉じるもの:

- create surface の優先順位
- `human post` と `machine observation` を混ぜない方針

まだ閉じないもの:

- `scan_detection` の canonical write
- `scan_detection` の machine policy 共有実装
- `scan_summary` の visit summary 契約
- update path parity

---

## 5. Next concrete move

- 次にやるコード変更は `scan_summary` を除いた create path の整理まででよい
- 残る未完了は update path と `scan_summary` の visit summary 契約

これで `1ラリー = 1判断` を守りつつ、Gate 2 を崩さず前進できる。
