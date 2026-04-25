# ikimon v2 Live Cutover Runbook

更新日: 2026-04-13

## 0. 目的

この runbook は `ikimon.life` を legacy から v2 へ切り替える直前の実行手順を固定する。  
対象は `public nginx switch`, `day0 smoke`, `rollback`, `archive mode` の 4 点。

前提:

- `Gate6 internal rehearsal = PASS`
- `/ops/readiness = near_ready`
- live public switch は **明示承認後のみ**

---

## 1. 現在の判定

- internal rehearsal: `PASS`
- public switch dry-run: `PASS`
- rollback script: `PASS`
- live public switch: `NOT EXECUTED`

進捗:

- `Gate1-5 = 100%`
- `Gate6 = 99%`
- 残件は `public domain live switch + day0 smoke`

---

## 2. Source of Truth

作業ディレクトリ:

- `repo_root/platform_v2`

staging v2 runtime:

- `http://127.0.0.1:3200`

public domain:

- `https://ikimon.life`

staging preview:

- `https://staging.162-43-44-131.sslip.io/v2/`

snapshot root:

- `/var/www/ikimon.life-staging/cutover-snapshots`

- mirror root:

- `/var/www/ikimon.life-staging/mirrors/production_legacy`

- verify fixture:

- `/tmp/ikimon-verify-v0-full-20260412c-merged`

---

## 2.1 Cutover 後の runtime 定義

live cutover 後の public runtime は `nginx -> v2 (127.0.0.1:3200)` で固定する。  
legacy PHP は public request を受ける runtime ではなく、以下の rollback / archive 資産へ下げる。

- `legacy mirror` の source
- nginx rollback snapshot
- emergency comparison 用 artifact

この runbook の成功条件は、`ikimon.life` の通常導線が PHP を経由しないこと。

---

## 3. Gate6 で確定した事実

### 3.1 Root cause

`rehearse:cutover` は以前、`verify:legacy` に `importVersion` を渡しておらず、常に `v0-plan` を参照して偽失敗していた。  
現在は `latest succeeded verify_legacy_parity.importVersion` を自動解決して使う。

### 3.2 Verify fixture

staging DB の `importVersion = v0-full-20260412c` は、単一の `upload_package/data` では再現できなかった。  
`production repo data + staging repo data` を merge した fixture を使うと以下で一致した。

- observations: `6743`
- rememberTokens: `63`
- trackVisits: `42`

---

## 4. Rehearsal 再現コマンド

### 4.1 Verify fixture を再生成

```bash
cd /var/www/ikimon.life-staging/repo/platform_v2
sudo -u postgres env DATABASE_URL='postgresql:///ikimon_v2_staging?host=%2Fvar%2Frun%2Fpostgresql' \
  npm run materialize:legacy-verify-snapshot -- \
  --legacy-data-root=/var/www/ikimon.life-staging/mirrors/production_legacy/data \
  --fallback-legacy-data-root=/var/www/ikimon.life-staging/repo/upload_package/data \
  --output-root=/tmp/ikimon-verify-v0-full-20260412c-merged \
  --import-version=v0-full-20260412c
find /tmp/ikimon-verify-v0-full-20260412c-merged -type f -exec touch -d '2026-04-12 07:00:00 +0900' {} +
```

### 4.2 Internal rehearsal

```bash
cd /var/www/ikimon.life-staging/repo/platform_v2
sudo -u postgres env DATABASE_URL='postgresql:///ikimon_v2_staging?host=%2Fvar%2Frun%2Fpostgresql' \
  LEGACY_MIRROR_ROOT=/var/www/ikimon.life-staging/mirrors/production_legacy \
  npm run rehearse:cutover -- \
  --legacy-data-root=/tmp/ikimon-verify-v0-full-20260412c-merged/data \
  --uploads-root=/var/www/ikimon.life-staging/mirrors/production_legacy/uploads \
  --public-root=/var/www/ikimon.life-staging/mirrors/production_legacy/public \
  --base-url=http://127.0.0.1:3200 \
  --fixture-prefix=codex-cutover-20260413d
```

### 4.3 Drift / readiness 更新

```bash
cd /var/www/ikimon.life-staging/repo/platform_v2
sudo -u postgres env DATABASE_URL='postgresql:///ikimon_v2_staging?host=%2Fvar%2Frun%2Fpostgresql' \
  npm run report:legacy-drift -- --history=5 --stale-hours=24
curl -s http://127.0.0.1:3200/ops/readiness
```

期待値:

- `rehearse:cutover` が `sync -> verify -> smoke:v2-lane -> smoke:v2-read-lane -> smoke:v2-write-lane` を完走
- `/ops/readiness.status = near_ready`

---

## 5. Public switch 直前チェック

### 5.1 Snapshot 採取

```bash
cd /var/www/ikimon.life-staging/repo/platform_v2/scripts/ops
bash snapshot_cutover_state.sh codex-prelive-YYYYMMDDa
```

期待値:

- snapshot dir 作成
- nginx live config 保存
- `ikimon_v2_shadow.dump` 保存
- `v2-healthz.json`, `v2-readyz.json`, `v2-ops-readiness.json` 保存

### 5.2 Dry-run

```bash
cd /var/www/ikimon.life-staging/repo/platform_v2/scripts/ops
bash switch_public_nginx_to_v2.sh --dry-run --label=codex-dryrun-YYYYMMDDa
```

期待値:

- `dry-run ok`
- `nginx -t` success

### 5.3 Rollback rehearsal

```bash
cd /var/www/ikimon.life-staging/repo/platform_v2/scripts/ops
bash rollback_public_nginx_to_legacy.sh /var/www/ikimon.life-staging/cutover-snapshots/codex-prelive-YYYYMMDDa
```

期待値:

- `nginx -t` success
- `https://ikimon.life/` が legacy top を返す

---

## 6. Live cutover 手順

**この章はユーザー承認後のみ実行。**

### 6.1 Switch

```bash
cd /var/www/ikimon.life-staging/repo/platform_v2/scripts/ops
bash switch_public_nginx_to_v2.sh --label=codex-live-YYYYMMDDa
```

期待値:

- snapshot path が返る
- `https://ikimon.life/healthz` が `200`

### 6.2 Day0 smoke

```bash
cd /var/www/ikimon.life-staging/repo/platform_v2/scripts/ops
FIXTURE_PREFIX=live-cutover-YYYYMMDDa bash run_day0_public_smoke.sh
```

pass 条件:

- `smoke:v2-lane`
- `smoke:v2-read-lane`
- `smoke:v2-write-lane`

### 6.3 Fail 時の rollback

```bash
cd /var/www/ikimon.life-staging/repo/platform_v2/scripts/ops
bash rollback_public_nginx_to_legacy.sh /var/www/ikimon.life-staging/cutover-snapshots/codex-live-YYYYMMDDa
```

rollback 条件:

- public `healthz` が失敗
- read smoke 失敗
- write smoke 失敗
- 人手で major UX break を確認

---

## 6.4 Archive mode 化

live cutover が成功したら、legacy PHP は次の役割だけを持つ。

- `switch_public_nginx_to_v2.sh` が残した snapshot から戻すための rollback artifact
- `legacy mirror` の再生成元
- emergency diff / evidence 確認用の archived codebase

やってはいけないこと:

- public nginx を PHP runtime へ戻さずに、通常運用で `.php` surface を再公開する
- verify / rehearsal の既定値を `repo/upload_package` 直参照へ戻す

archive mode 確認:

- live nginx config の `/` が `127.0.0.1:3200` を向いている
- `/about.php`, `/for-business.php`, `/id_workbench.php` などが v2 path へ redirect する
- `legacy mirror` と snapshot root が rollback 用に残っている

---

## 7. 判断ルール

`GO`:

- internal rehearsal `PASS`
- dry-run `PASS`
- rollback rehearsal `PASS`
- `/ops/readiness = near_ready`
- live day0 smoke `PASS`
- archive mode 条件を満たす

`NO-GO`:

- `verify:legacy` mismatch 再発
- public `healthz` / `readyz` 異常
- write smoke 不通
- rollback 手順が壊れている

---

## 8. 次の進化

live cutover 実行前に、`switch -> day0 smoke -> rollback` を 1 つの `run_public_cutover_rehearsal.sh` に束ねる。  
これで本番判断を 1 コマンドに寄せられる。
