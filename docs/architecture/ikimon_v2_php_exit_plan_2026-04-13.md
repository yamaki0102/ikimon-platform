# ikimon v2 PHP Exit Plan

更新日: 2026-04-13

## 0. 結論

`public runtime cutover` と `PHP 完全離脱` は別 gate。  
いまの v2 は前者の直前まで来ているが、後者はまだ未完。

PHP 完全離脱の定義:

1. public request が PHP を通らない
2. v2 runtime の default が `upload_package` 直参照でない
3. verify / rehearsal / rollback が `legacy mirror` で閉じる
4. uploads / asset path が PHP repo なしで解決できる
5. 旧 PHP は rollback 保険か archive に下がる

---

## 1. いま残っている PHP 依存

### A. runtime default

`platform_v2` はこれまで `../upload_package/data` と `../upload_package/public_html` を既定値にしていた。  
これは local では便利だが、production cutover 後も PHP repo の存在を前提にする。

### B. verify / rehearsal source

`verify:legacy`, `import:legacy`, `sync:legacy`, `write:legacy-compatibility` が、運用上はまだ `upload_package` を与えられる前提で動いている。

### C. uploads / public assets

asset の相対パスは `uploads/...` で持てているが、物理 root は `public_html/uploads` と `persistent/uploads` の二重性がある。

### D. write compatibility

observation / user / remember token / track は、cutover safety のため legacy JSON へ互換書き込みしている。  
これは `PHP アプリが必要` なのではなく、`legacy JSON contract が必要` という依存。

---

## 2. 今回閉じたこと

`mirror root` を first-class にした。  
これで `platform_v2` の root 解決は、環境変数 `LEGACY_MIRROR_ROOT` がある場合は以下を既定に使う。

- `data = ${LEGACY_MIRROR_ROOT}/data`
- `uploads = ${LEGACY_MIRROR_ROOT}/uploads`
- `public = ${LEGACY_MIRROR_ROOT}/public`

対象:

- app config
- `import:legacy`
- `sync:legacy`
- `verify:legacy`
- `write:legacy-compatibility`

意味:

- v2 が `repo 横の upload_package` を直接読む前提を外し始めた
- production では `legacy mirror` を作れば、PHP repo 実体が無くても rehearsal を回せる

---

## 3. ここからの Gate

### Gate P1. Mirror default 化

- staging / production の systemd or env に `LEGACY_MIRROR_ROOT` を入れる
- `pull_production_legacy_mirror.sh` は `data / uploads / public` を mirror へ揃える
- rehearsal / verify / drift report を mirror root で green にする

完了条件:

- `../upload_package` を明示せず `near_ready` まで行く

### Gate P2. Uploads independence

- `persistent/uploads` を v2 管轄 root として固定
- `public` 配下は nginx alias のみで解決
- parity / smoke で photo, avatar, audio を確認

完了条件:

- PHP repo の `public_html/uploads` を参照しなくても asset 解決が壊れない

### Gate P3. Legacy JSON isolation

- compatibility write の書き先を mirror 管轄に固定
- rollback で必要な JSON contract だけを残す
- PHP アプリ本体を動かさず read/write safety が保てることを確認

完了条件:

- `writeLegacy*` が PHP runtime 非存在でも成立

### Gate P4. Public surface replacement

- public top / explore / about / apply 等を v2 or 静的配信で置き換える
- PHP ページ URL を public 導線から外す

完了条件:

- public navigation で `.php` surface に着地しない

### Gate P5. PHP archive mode

- rollback 手順を確定
- PHP repo を live dependency から archive dependency へ下げる
- live nginx / runbook / smoke の基準を `PHP runtime optional` に揃える

完了条件:

- production runbook で PHP が `required runtime` ではなく `emergency rollback artifact` になる

---

## 4. 最短の次アクション

1. staging / production env に `LEGACY_MIRROR_ROOT` を追加
2. `pull_production_legacy_mirror.sh` の出力構造を `data/uploads/public` で揃える
3. `run_cutover_rehearsal.sh` を mirror root 前提で green にする
4. asset smoke に `avatar/audio/photo` を加える
5. public surface の `.php` 入口を棚卸しして v2 置換順を固定する
6. live cutover runbook を `mirror first + archive mode` に書き換える

---

## 5. いまの判定

- public runtime cutover readiness: `99%`
- PHP complete exit readiness: `97%`

理由:

- runtime switch は目前
- mirror root は staging 実機へ投入できた
- `production_legacy_fs` の shadow sync / verify は mirror root だけで通った
- `compatibility write` も staging 実書き込みで mirror root を向いた
- mirror-based `rehearse:cutover` でも `verify:legacy` と `read/write smoke` は green になった
- `report:legacy-drift` 再実行後、`ops/readiness` は `near_ready` へ回復した
- public trust / business 面は v2 へ移り、旧 flat `.php` URL も redirect できるようになった
- specialist thin entry も v2 へ移り、旧 `id_workbench.php / review_queue.php` は redirect できるようになった
- specialist は minimal read shell まで v2 へ移り、queue sample と observation detail 導線を持てるようになった
- specialist の最小 action (`approve / reject / note`) も v2 API で記録できるようになった
- live cutover runbook も `legacy mirror` と `PHP runtime optional` 前提へ更新した
- ただし archive mode の実行自体はまだ未実施で、legacy fallback 整理も途中

---

## 6. 2026-04-13 staging 実測

実施:

1. `pull_production_legacy_mirror.sh` を staging VPS で実行し、`production_legacy/{data,uploads,public}` を再構成
2. `pm2 restart ikimon-v2-staging-api --update-env` で `LEGACY_MIRROR_ROOT=/var/www/ikimon.life-staging/mirrors/production_legacy` を投入
3. `run_shadow_sync.sh` を `SHADOW_LEGACY_MIRROR_ROOT` だけ指定して実行
4. `run_production_shadow_verify.sh` を mirror root 前提で実行

結果:

- staging API env に `LEGACY_MIRROR_ROOT` が入った
- `production_legacy_fs` の delta sync は `changedFiles=0 / skipped`
- `verify:production-shadow` は `mismatches=[]`
- `smoke:v2-write-lane` 実行後の `compatibility_write_ledger.legacy_target` は `/var/www/ikimon.life-staging/mirrors/production_legacy/data/...` を指した
- mirror root だけで `legacyDataRoot / uploadsRoot / publicRoot` を閉じられることを確認

追加で進んだこと:

1. `bootstrapLegacyImport.ts` を staging DB の `asset_ledger` 実スキーマへ合わせ、`observation_photo` の ledger を `mirror root + importVersion` で正規化した
2. `verifyLegacyParity.ts` は `asset_ledger` 判定を `logical_asset_type='observation_photo'` に限定し、`importObservationEvidence` の `php_fs/photo` 行を parity 判定から除外した
3. staging VPS で `run_cutover_rehearsal.sh` を `CUTOVER_PREPARE_VERIFY_FIXTURE=1` 付きで再実行し、mirror root 配下の merged verify fixture だけで `verify:legacy mismatches=[]` と `smoke:v2-lane / read-lane / write-lane = passed` を確認した

まだ残ること:

- `report:legacy-drift --stale-hours=24` を mirror rehearsal 後に再実行し、`summary.status=healthy` を確認した
- `npm run readiness` は `status=near_ready`、`rollbackSafetyWindowReady=true` を返した
- `/about`, `/faq`, `/privacy`, `/terms`, `/contact`, `/for-business/*` は v2 で HTML を返す
- `/about.php`, `/for-business.php`, `/for-business/apply.php` などの旧 flat URL は v2 path へ redirect する
- `/specialist/id-workbench`, `/specialist/review-queue` を追加し、`/id_workbench.php`, `/id_center.php`, `/needs_id.php`, `/review_queue.php` は thin entry へ redirect する
- `specialist/id-workbench` は lane 切替と queue sample、`specialist/review-queue` は review sample を v2 read shell で返す
- `/api/v1/specialist/occurrences/:id/review` を追加し、`approve / reject / note` を `occurrences.source_payload.specialist_review` と必要時の `identifications` upsert に記録できる
- old rehearsal 履歴には `repo/upload_package` 由来の run details が残るが、current mirror rehearsal 自体は green
- archive mode 定義は runbook へ反映済みだが、live switch 後の実施はまだ未確認

---

## 6. 次の進化

archive mode の dry-run checklist を `switch_public_nginx_to_v2.sh` / `rollback_public_nginx_to_legacy.sh` に直接焼き込み、実行結果だけで判定できるようにする。
