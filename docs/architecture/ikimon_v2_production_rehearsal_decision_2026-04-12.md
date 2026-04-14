# ikimon v2 Production Rehearsal Decision

更新日: 2026-04-12

## 結論

- 判定: `GO`
- 対象: `production rehearsal`
- 対象外: `live cutover`

意味:

- 本番切替そのものはまだ承認していない
- ただし、`S-final snapshot -> live switch -> public smoke -> immediate rollback if needed` を行う **本番リハーサル** には進める

---

## 判断根拠

### 1. Gate 1-5 は揃った

- Gate 1 `Scope freeze`: `DONE`
- Gate 2 `Canonical contract freeze`: `DONE`
- Gate 3 `v2 data plane ready`: `DONE`
- Gate 4 `v2 product parity ready`: `DONE`
- Gate 5 `production shadow sync ready`: `DONE`

特に重要なのはこの 3 つ。

1. staging `:3200` で `record / explore / home / observation detail / profile / session / photo upload / track upload` の最小 lane が通っている
2. production shadow は `pull -> sync -> verify -> drift` の hourly cycle で `healthy` まで確認済み
3. sample page / sample API cadence も hourly で回る状態に入った

### 2. Gate 6 は rehearsal 実施に必要な最低条件を満たした

- snapshot script がある
- nginx switch dry-run が通っている
- rollback script がある
- day-0 public smoke が 1 コマンドで固定されている
- runbook がある

つまり、`切替して戻せない` 状態ではない。

### 3. 実測で通っているもの

- staging `:3200` の sample cadence manual run で `smoke:v2-lane`, `smoke:v2-read-lane`, `smoke:v2-write-lane` がすべて `passed`
- production shadow cycle は `20 * * * *` で hourly 実行
- sample cadence は `35 * * * *` で hourly 実行
- `switch_public_nginx_to_v2.sh --dry-run` は live config 置換込みで `nginx -t` を通過
- `rollback_public_nginx_to_legacy.sh` は実行済みで、live site はその後も `HTTP 200`

---

## 実施してよい rehearsal の範囲

許可する範囲はこれだけ。

1. `snapshot_cutover_state.sh` で `S-final` snapshot を取る
2. `switch_public_nginx_to_v2.sh` で live switch を実行する
3. `run_day0_public_smoke.sh` で public smoke を打つ
4. 結果を見て `continue` か `rollback_public_nginx_to_legacy.sh` を即断する

ここでやってはいけないこと:

- 本番 DB の破壊的 migration
- dual-write を増やす ad-hoc 修正
- rehearsal 中の仕様変更

---

## Rehearsal の success 条件

- `https://ikimon.life/healthz` が `200`
- public smoke が `passed`
- `/ops/readiness` で v2 lane / drift report が `healthy`
- public page の主要導線が `record / explore / home / observation detail / profile` で致命崩れなし
- 問題が出ても rollback が数分で完了する

---

## 即 rollback 条件

- `healthz` or `readyz` が落ちる
- public smoke が `failed`
- session / observation upsert / photo upload / track upsert のいずれかが失敗
- `uploads` alias, TLS, 既存 `/deploy` など infra 面で破綻が出る

---

## Rehearsal 後の分岐

### Pass

- Gate 6 を `DONE` に上げる
- live cutover approval へ進む

### Fail

- ただちに rollback
- failure class を `routing / session / write lane / uploads / data drift` に分類する
- 1クラスずつ潰してから再判定する

---

## いま残っている本当の未完了

- live public rehearsal そのもの
- rehearsal の結果を docs へ反映すること

したがって、2026-04-12 時点の正しい判断はこれ。

- `production rehearsal`: `GO`
- `live cutover`: `HOLD`
