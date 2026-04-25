# ikimon Canonical Enforcement Surface Map

更新日: 2026-04-12  
目的: `canonical guard / enforcement` をどの write surface にどう適用するかを固定する。  
論点は 2 つだけ。

1. どの入口がすでに canonical write に接続しているか
2. どの入口がまだ JSON only で、Gate 2 の未完了として残っているか

---

## 1. 判定軸

### A. Guard shared now

- 既存 `CanonicalObservationGuard` をそのまま使う
- 人手投稿や同期で、`observation.id / user_id` を持つ
- test/dev residue が canonical に残る危険がある

### B. Canonical connected but separate policy

- canonical write はしている
- ただし `MachineObservation / child event / session event` 系で、guard 条件が人手投稿と違う
- 同じ guard をそのまま入れると意味がずれる

### C. JSON only, canonical gap

- 旧 write はある
- canonical へ未接続
- divergence 上は今後の parity gap 候補

---

## 2. Surface map

| Surface | File | Current write | Canonical path | Enforcement stance | Priority |
|---|---|---|---|---|---|
| Standard post | [post_observation.php](/E:/Projects/Playground/upload_package/public_html/api/post_observation.php) | `observations` append + photo upload + event side effect | `CanonicalObservationWriter` | `A. Guard shared now` | P0 |
| Legacy sync/import | [CanonicalSync.php](/E:/Projects/Playground/upload_package/libs/CanonicalSync.php) | existing JSON -> canonical replay | `CanonicalSync::syncOne` | `A. Guard shared now` | P0 |
| Quick post | [quick_post.php](/E:/Projects/Playground/upload_package/public_html/api/v2/quick_post.php) | `observations` append + photo upload | none yet | `Decision fixed: connect now via human-post path` | P1 |
| Scan summary | [scan_summary.php](/E:/Projects/Playground/upload_package/public_html/api/v2/scan_summary.php) | summary observation append | none | `Decision fixed: keep JSON-only until visit summary contract` | P1 |
| Scan detection | [scan_detection.php](/E:/Projects/Playground/upload_package/public_html/api/v2/scan_detection.php) | processed observations append + passive session append | direct `CanonicalStore::createEvent/createOccurrence/addEvidence` | `B. Separate policy implemented via CanonicalMachineObservationPolicy` | P1 |
| Passive event | [passive_event.php](/E:/Projects/Playground/upload_package/public_html/api/v2/passive_event.php) | observations append + passive sessions + env logs | direct `CanonicalStore::createEvent/createOccurrence` | `B. Separate policy implemented via CanonicalMachineObservationPolicy` | P1 |
| Observation edits | [update_observation.php](/E:/Projects/Playground/upload_package/public_html/api/update_observation.php) | `observations` upsert | `CanonicalObservationUpdater::syncEditableState` | `A/B bridge: canonical update parity added` | P2 |
| Identification | [post_identification.php](/E:/Projects/Playground/upload_package/public_html/api/post_identification.php) | `observations` upsert | `CanonicalObservationUpdater::appendIdentification` | `A/B bridge: immutable identification sync added` | P2 |
| Metadata support/review | [support_observation_metadata.php](/E:/Projects/Playground/upload_package/public_html/api/support_observation_metadata.php), [review_observation_metadata.php](/E:/Projects/Playground/upload_package/public_html/api/review_observation_metadata.php), [propose_observation_metadata.php](/E:/Projects/Playground/upload_package/public_html/api/propose_observation_metadata.php) | `observations` upsert | `CanonicalObservationUpdater::syncEditableState` on `direct / accept / auto_accepted` | `A/B bridge: accepted metadata changes sync to canonical` | P2 |

---

## 3. What is actually closed now

閉じたのは `P0` のみ。

- `CanonicalObservationWriter`
  - `test-*`
  - `test-user`
  - fixture style `o1/o2/...`
  を canonical に残さない
- `CanonicalSync`
  - 上記と同じ guard を共有
- local residue cleanup
  - [cleanup_test_canonical_residue.php](/E:/Projects/Playground/upload_package/scripts/maintenance/cleanup_test_canonical_residue.php) で掃除可能
- local divergence
  - [check_canonical_divergence.php](/E:/Projects/Playground/upload_package/tools/check_canonical_divergence.php) は local dataset 上で `PASS`

---

## 4. Remaining enforcement work

### 4.1 P1: JSON only observation creators

対象:

- `quick_post.php`
- `scan_summary.php`

意味:

- いまは JSON にしか書いていない
- ただし 3 本とも接続方針は同じではない

推奨:

- `quick_post.php`: `CanonicalObservationWriter` へ寄せる
- `scan_summary.php`: visit summary 契約まで保留

### 4.2 P1: passive_event policy split

対象:

- `passive_event.php`

意味:

- すでに canonical に直接書いている
- 人手投稿用 guard は共有せず、`official_record / session_intent / test_profile` で separate policy を使う

推奨:

- 実装済み:
  - [CanonicalMachineObservationPolicy.php](/E:/Projects/Playground/upload_package/libs/CanonicalMachineObservationPolicy.php)
  - `official_record=false`
  - `session_intent!=official`
  - `test_profile!=field/official/production`
  の場合は canonical write を行わない
  - [passive_event.php](/E:/Projects/Playground/upload_package/public_html/api/v2/passive_event.php)
  - [scan_detection.php](/E:/Projects/Playground/upload_package/public_html/api/v2/scan_detection.php)
  の両方で machine create path に共有適用
- 残件:
  - `install_id` 側の test device policy を入れるか判断する

### 4.3 P2: observation update surfaces

対象:

- metadata support/review APIs

意味:

- `update_observation.php` は canonical event / occurrence / privacy / place condition を同期する最小 parity あり
- `post_identification.php` は canonical identifications へ immutable append し、consensus を再評価する
- `propose / review / support metadata` も、観察の意味が変わる `direct / accept / auto_accepted` 時だけ canonical sync する
- JSON only で残るのは、proposal pending / rejected / supporter bookkeeping のような workflow state

---

## 5. Recommended next order

1. `quick_post.php` を canonical 接続する
2. `install_id` test device policy の必要性を判断する
3. importer / ledger 側の parity を詰める

この順なら、`人手投稿 create` と `機械観察 create` を分離したまま、残件を importer / ledger 側へ圧縮できる。
