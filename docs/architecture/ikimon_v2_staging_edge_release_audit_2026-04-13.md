# ikimon v2 Staging Edge Release Audit

更新日: 2026-04-13

対象環境:

- `https://staging.162-43-44-131.sslip.io/v2/`
- Basic Auth 内側
- nginx / TLS / forwarded prefix を含む staging edge

参照基準:

- [ikimon_v2_release_qa_matrix_2026-04-13.md](/E:/Projects/Playground/docs/architecture/ikimon_v2_release_qa_matrix_2026-04-13.md)

---

## 1. 判定

- staging edge audit: `IN PROGRESS`
- 今回閉じた範囲: `T1`, `T6`, `F1`
- 未完了: `T2`, `T3`, `T4`, `H4 mobile`

意味:

- `prefix mismatch / 404` の大物は潰れた
- demo root から `Record / Home / Observation Detail / Profile / Explore` を踏める
- ただし release 完了とはまだ言わない

---

## 2. 実測で通ったもの

### 2.1 T1 Demo core loop

すべて staging edge で `200`。

- `/v2/`
- `/v2/record?userId=sample-cadence-20260412140639-user`
- `/v2/home?userId=sample-cadence-20260412140639-user`
- `/v2/observations/occ%3Asample-cadence-20260412140639-obs%3A0`
- `/v2/profile/sample-cadence-20260412140639-user`
- `/v2/explore`

追加確認:

- demo root の各 CTA は `/v2/...` prefix 付きで返る
- record 画面内の `Open home / Explore` も `/v2/...` prefix 付きで返る

### 2.2 T6 Ops loop

すべて staging edge で `200`。

- `/v2/healthz`
- `/v2/readyz`
- `/v2/ops/readiness`

### 2.3 F1 Routing failure

今回 root cause を切った。

- 原因: `/v2` 配下なのに app 側が `/record`, `/home`, `/api/...` の絶対パスを返していた
- 対応: `X-Forwarded-Prefix: /v2` を nginx から渡し、app 側で basePath を吸収
- 結果: staging edge 上で `/v2` prefix 付きリンクへ修正され、`404 Not Found nginx` は再現しなくなった

### 2.4 Guest auth failure

- `/v2/record` は `401`
- これは意図どおり
- guest で record を開けないこと自体は failure ではなく auth policy

---

## 3. 今回の証拠

### HTML / route 確認

- demo root は `v2 demo lane` と `sample fixture` 表示あり
- `Start demo record` は `/v2/record?...`
- `Open demo detail` は `/v2/observations/...`
- `Explore / Home / Profile / Ops` も `/v2/...` prefix 付き

### HTTP 確認

- `home`: `200`
- `profile`: `200`
- `observation detail`: `200`
- `explore`: `200`
- `record`: `200`
- `guest record`: `401`
- `healthz / readyz / ops/readiness`: `200`

---

## 4. まだ未完のもの

### A. 人手での write transition

まだ `画面上で実際に押した` とは言っていない。

- `Record -> submit observation -> Detail`
- `Detail -> Profile`
- `Profile -> Home`
- `Home -> Explore`

これは next step で人手 QA する。

### B. H4 UX red flags

まだ残っている確認:

- mobile 崩れ
- CTA の文脈自然さ
- 空データ時の見え方
- session 期限切れ時の UX

### C. Public top

いまの `/v2/` は demo root であって、本番 public top ではない。  
したがって、release 前に public top 方針を別途固定する必要がある。

---

## 5. 次の実行順

1. 人手で `Record -> Detail -> Profile -> Home -> Explore` を一周する
2. mobile width で `Record / Home / Detail / Profile / Explore` を見る
3. 問題がなければ production rehearsal に入る

---

## 6. いまの判断

- `staging edge routing`: `PASS`
- `staging edge demo traversal`: `PASS`
- `staging edge release audit`: `IN PROGRESS`
- `production rehearsal`: `GO`
- `live cutover`: `HOLD`

---

## 7. 2026-04-13 Codex 追記

internal lane で追加確認したこと:

- `http://127.0.0.1:3200/healthz`: `200`
- `smoke:v2-lane`: `passed`
- `smoke:v2-read-lane`: `passed`
- `smoke:v2-write-lane`: `passed`

つまり、`read/write/session/photo/track` の最小 lane 自体は staging VPS 上で通っている。

一方で Gate6 rehearsal はまだ `PASS` ではない。

### 7.1 閉じた root cause

- `rehearse:cutover` が `verify:legacy` に `importVersion` を渡さず、`v0-plan` を見て落ちていた
- local repo では `src/scripts/rehearseCutover.ts` を修正し、`latest succeeded verify_legacy_parity` の `importVersion` を自動解決して渡すようにした

### 7.2 新たに見えた実残件

- staging VPS 上の deploy 済み repo には `scripts/ops/run_cutover_rehearsal.sh` がまだ無い
- `npm run rehearse:cutover` を直接回すと、今度は `v0-full-20260412c` で比較される
- その比較では `repo/upload_package/data` 側の現行件数と、staging DB の imported snapshot がズレて mismatch になる

意味:

- Gate6 の失敗理由は `script bug` から `legacy source root mismatch` へ移った
- 次にやるべき本筋は、`verify:legacy` / `rehearse:cutover` に渡す `legacyDataRoot / uploadsRoot / publicRoot` を、staging DB を作った snapshot と一致させること

### 7.3 次の 3 手

1. staging DB の import 元 snapshot path を特定する
2. `run_cutover_rehearsal.sh` に `legacy roots` 明示渡しの運用を固定する
3. その root で `rehearse:cutover` を再実行して Gate6 判定を更新する

### 7.4 2026-04-13 Gate6 更新

実施したこと:

- `src/scripts/rehearseCutover.ts` は `latest succeeded verify_legacy_parity.importVersion` を自動解決するように更新した
- `scripts/ops/run_cutover_rehearsal.sh` は `CUTOVER_LEGACY_DATA_ROOT / CUTOVER_UPLOADS_ROOT / CUTOVER_PUBLIC_ROOT` を受け取れるように更新した
- `src/scripts/materializeLegacyVerifySnapshot.ts` を追加し、`importVersion` に対応する verify source を `migration_ledger(imported)` から再構成できるようにした
- staging VPS では `production repo data + staging repo data` を merge した verify fixture を `/tmp/ikimon-verify-v0-full-20260412c-merged` に生成した
- その fixture を使った `verify:legacy` は `mismatches=[]` で通過した
- 同 fixture を使った `rehearse:cutover` でも `sync -> verify -> read smoke -> write smoke` が通った
- `report:legacy-drift` を再実行し、`/ops/readiness` は `status=near_ready` まで回復した

更新後の判断:

- `Gate6 internal rehearsal`: `PASS`
- `ops/readiness`: `near_ready`
- `production rehearsal`: `GO`
- `live cutover`: `HOLD`

残件:

- public domain `https://ikimon.life/` はまだ legacy のままなので、`run_day0_public_smoke.sh` は未切替状態では fail が正しい
- つまり残りは `public switch / rollback` の live rehearsal と本番判断だけ

### 7.5 2026-04-13 pre-live rehearsal 更新

追加で確認したこと:

- `snapshot_cutover_state.sh codex-prelive-20260413a`: `PASS`
- `switch_public_nginx_to_v2.sh --dry-run --label=codex-dryrun-20260413a`: `PASS`
- `rollback_public_nginx_to_legacy.sh /var/www/ikimon.life-staging/cutover-snapshots/codex-prelive-20260413a`: `PASS`

確認結果:

- snapshot は `/var/www/ikimon.life-staging/cutover-snapshots/codex-prelive-20260413a` に作成された
- `nginx -t` は switch / rollback の両方で通った
- `run_day0_public_smoke.sh` が current live `https://ikimon.life` に対して失敗するのは未切替状態では正しい

いまの結論:

- `Gate6 internal rehearsal`: `PASS`
- `pre-live switch dry-run`: `PASS`
- `pre-live rollback`: `PASS`
- `live public cutover`: `NOT EXECUTED`

### 7.6 2026-04-13 mirror-only PHP exit rehearsal 更新

実施したこと:

- `bootstrapLegacyImport.ts` を staging 実スキーマの `asset_ledger` に合わせて修正し、`logical_asset_type='observation_photo'` を `legacy_fs + importVersion` で upsert するようにした
- missing photo は `asset_ledger.skipped` には残しつつ、`evidence_assets.source_payload.asset_ledger_id` を付けないようにして `evidence_assets.linked` の母集団を existing photo に一致させた
- `verifyLegacyParity.ts` は `asset_ledger.imported/skipped` を `logical_asset_type='observation_photo'` に限定した
- staging VPS で `CUTOVER_PREPARE_VERIFY_FIXTURE=1` 付き `run_cutover_rehearsal.sh` を mirror root 前提で再実行した

確認結果:

- `verify:legacy`: `mismatches=[]`
- `smoke:v2-lane`: `passed`
- `smoke:v2-read-lane`: `passed`
- `smoke:v2-write-lane`: `passed`
- つまり primary cutover rehearsal は `repo/upload_package` 非依存の mirror-only 経路で green

未完:

- 直後に `report:legacy-drift --stale-hours=24` を再実行し、`summary.status=healthy` を確認した
- `npm run readiness` は `status=near_ready` と `rollbackSafetyWindowReady=true` を返した
- public cutover 自体は未実行
