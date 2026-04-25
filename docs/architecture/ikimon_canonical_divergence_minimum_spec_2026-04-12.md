# ikimon Canonical Divergence Minimum Spec

更新日: 2026-04-12  
この文書は、`JSON` と `canonical` のズレを最低限どう検査するかを固定する。  
目的は、`なんとなく同期できている` を禁止すること。

---

## 1. 前提

現状の既存 CLI:

- [check_canonical_divergence.php](/E:/Projects/Playground/upload_package/tools/check_canonical_divergence.php)

これは今、

- JSON observation ID 数
- canonical occurrence の `original_observation_id` 数

しか見ていない。  
つまり `Gate 2` の入口としては不十分。

---

## 2. 最小比較単位

比較は 3 層に分ける。

### 2.1 Count

- users count
- auth token count
- fieldscan app token count
- fieldscan install count
- observations count
- business application count
- corporate invite count
- photo file count
- audio file count

### 2.2 Mapping

- observation ID → occurrence 解決率
- occurrence → event 解決率
- occurrence → evidence 解決率
- place candidate → place_id 解決率
- track session → visit/event 候補解決率

### 2.3 Checksum / path

- photo relative path parity
- photo file exists parity
- optional: photo SHA256 parity
- audio relative path parity

---

## 3. pass / warn / fail

| 判定 | 条件 |
|---|---|
| `PASS` | critical 項目が 100% 一致し、actionable orphan が 0 |
| `WARN` | 件数差が 0 ではないが、critical write を壊していない。もしくは sample mismatch / local test residue のみ |
| `FAIL` | auth, observation, evidence, event, place mapping のいずれかで欠損がある |

critical とみなす項目:

- users
- auth tokens
- observations
- observation → occurrence
- occurrence → evidence
- photo file exists

---

## 4. 最小 CLI 仕様

入力:

- `--scope=auth|observations|assets|business|all`
- `--sample=20`
- `--json`

出力:

- `status`
- `summary`
- `counts`
- `mapping`
- `orphans`
- `samples`

補足:

- `orphans` と `samples` では、`actionable divergence` と `local test/dev residue` を分離する
- orphan canonical は `actionable_orphan_canonical_count` と `test_residue_orphan_canonical_count` を見る

出力例:

```json
{
  "status": "WARN",
  "summary": {
    "critical_failures": 0,
    "warnings": 2
  },
  "counts": {
    "json_observations": 298,
    "canonical_occurrences": 297
  },
  "mapping": {
    "observation_to_occurrence_resolution_rate": 0.9966
  },
  "orphans": {
    "missing_in_canonical_sample": ["obs_xxx"]
  }
}
```

---

## 5. 実装順

1. 既存 `check_canonical_divergence.php` を温存
2. まず `observations + evidence` だけ広げる
3. 次に `auth`
4. 次に `business / app auth`
5. 最後に `place / visit mapping`

理由:

- observation/evidence が最も core
- place/visit は契約確定後でないと比較式がぶれる

2026-04-12 時点:

- `observations + evidence`: 実装済み
- `auth`: user/install/token/state の参照整合まで実装済み
- `business`: corporation/application/invite の参照整合まで実装済み
- `place / visit mapping`: track/passive/environment/session_recap の参照整合まで実装済み
- `orphan canonical classification`: 実装済み。local dataset 上では `o1 / o2 / o3 / test-place-intel-*` を `local test/dev residue` と分類できる
- 未完了: canonical 側 enforcement と importer 実運用後の parity 拡張

---

## 6. いま比較しないもの

- analytics raw
- recommendation cache
- weather cache
- AI queue の derived state
- rebuild 可能な summary

これらは divergence の主戦場に入れない。

---

## 7. readiness への効き方

- Gate 1:
  - 何を比較するかが fixed される
- Gate 2:
  - `どの概念がどこへ解決されるか` が fixed される
- Gate 3:
  - importer を作った後の parity 検査仕様になる

この spec があることで、次は `CLI 実装` に入れる。
