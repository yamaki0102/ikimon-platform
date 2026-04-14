# ikimon v2 Cutover Fast Track

更新日: 2026-04-12

目的:

- `本当に v2 へ差し替える` ための最短クリティカルパスだけに絞る
- `今すぐ効かない product renewal` と `cutover readiness` を分ける
- 何ラリーで本番差し替え readiness に届くかの現実的な見積りを固定する

---

## 1. Root Cause

いま切替できない理由は Gate 1-3 ではない。

- Gate 1 `Scope freeze`: DONE
- Gate 2 `Canonical contract freeze`: DONE
- Gate 3 `v2 data plane ready`: DONE

本当の詰まりは次の 3 つだけ。

1. Gate 4 `v2 product parity`
2. Gate 5 `production shadow sync`
3. Gate 6 `rollback and day-0 operations`

つまり、最短ルートは `UI を全部作ること` ではなく、

- 最小 product parity
- 継続 shadow sync
- fast rollback rehearsal

を先に通すこと。

---

## 2. 採用する最短戦略

### 採用

- `full feature parity` は狙わない
- `cutover minimum slice` を固定する
- `v2 can serve + sync + revert` を先に満たす

### 不採用

- public / app の全ページを v2 へ先回りで移植する
- renewal gate を全部閉じるまで cutover を止める
- v2 UI を美しく作り込みながら infra を後回しにする

---

## 3. Cutover Minimum Slice

本番差し替え readiness に必要な最小 slice はこれ。

1. auth session / remember token
2. home minimal shell
3. record / observation upsert
4. observation detail
5. profile / my places minimal shell
6. photo upload lane
7. track upload lane
8. shadow sync daemon
9. drift / readiness monitoring
10. rollback script + rehearsal + day-0 runbook

`explore` や `for-business` の完成度は重要だが、cutover minimum slice の必須条件ではない。

---

## 4. ラリー見積り

前提:

- 新しい構造崩れが出ない
- staging `:3200` の lane は維持される
- write smoke / data plane は既存のまま使える
- photo upload lane と auth session 本体は最小実装で前進できる

見積り:

1. Gate 4 最小 parity: `0 ラリー`
2. Gate 5 shadow sync 本番影同期: `0 ラリー`
3. Gate 6 rollback / day-0: `0-1 ラリー`

したがって、

- **最短:** `0-1 ラリー`
- **安全見積り:** `1-3 ラリー`

この数字は `本番差し替え readiness` の見積りであり、cutover 実行そのものは最後に `+1 ラリー` 見る。

---

## 5. 直近の実行順

順番を固定する。

1. Gate 5 を `NOT STARTED` から出す
2. Gate 6 を `NOT STARTED` から出す
3. staging で rehearsal
4. production shadow
5. final rollback drill
6. cutover approval

理由:

- sync / rollback がないまま parity を増やしても差し替え readiness にはならない
- production shadow を回す前に rehearsal script がないのは危険

---

## 6. 今日の最短前進

2026-04-12 の前進:

- `syncLegacyDelta.ts` は既にある
- `rehearseCutover.ts` を `sync -> verify -> read smoke -> write smoke -> readiness` に拡張した
- `scripts/ops/run_shadow_sync.sh` を追加した
- `scripts/ops/run_cutover_rehearsal.sh` を追加した
- `home / observations/:id / profile/:userId` の minimal read lane を v2 に追加した
- `smoke:v2-read-lane` で user-facing read shell を確認できるようにした
- `observations/:id/photos/upload` の minimal write lane を v2 に追加した
- `smoke:v2-write-lane` に photo upload を組み込み、readiness rehearsal の write lane で同時検証できるようにした
- `auth/session/issue`, `auth/session`, `auth/session/logout` を追加し、cookie-based session の最小 lane を v2 に追加した
- `/home` と `/profile` は session cookie fallback で見られるようになった
- `/record` を追加し、session cookie または `?userId=...` で開ける minimal quick capture shell を v2 に追加した
- staging `smoke:v2-write-lane` で session lane を含む全 9 checks が `passed` した
- staging `smoke:v2-read-lane` で `record / explore / home / observation detail / profile` の全 5 checks が `passed` した
- `bootstrap_shadow_db.sh` を追加し、`ikimon_v2_staging` schema から `ikimon_v2_shadow` を即座に作れるようにした
- `pull_production_legacy_mirror.sh` で Onamae production の `ikimon.life/data` と `ikimon.life/public_html/uploads` を VPS mirror へ rsync できるようにした
- `run_production_shadow_sync_only.sh` と `run_production_shadow_cycle.sh` を追加し、`pull -> sync` と `pull -> sync -> drift` を分離した
- `ikimon_v2_shadow` で one-off production shadow sync を実行し、`users=102 / visits=238 / occurrences=233 / evidence_assets=230 / remember_tokens=61 / visit_track_points=680` まで import した
- `verifyProductionShadowParity.ts` と `run_production_shadow_verify.sh` を追加し、production mirror と `ikimon_v2_shadow` の count/checksum parity を `verify_legacy_parity` として記録できるようにした
- `run_production_shadow_cycle.sh` を end-to-end で通し、`summary.status=healthy / parityClean=true / deltaHealthy=true / deltaFresh=true / cursorFresh=true` を確認した
- production shadow cycle を VPS root crontab の `20 * * * *` に載せ、hourly `pull -> sync -> verify -> drift` 常時実行へ進めた
- `run_v2_sample_cadence.sh` を追加し、staging `:3200` に対する sample page / sample API cadence を 1 コマンド化した
- `run_v2_sample_cadence.sh` の manual run を VPS で通し、`record / explore / home / observation detail / profile` と最小 write lane が `passed` することを確認した
- sample cadence を VPS root crontab の `35 * * * *` に載せ、cutover candidate lane の page/API health も hourly 常時実行へ進めた
- `snapshot_cutover_state.sh`, `switch_public_nginx_to_v2.sh`, `rollback_public_nginx_to_legacy.sh`, `run_day0_public_smoke.sh` を追加し、cutover 当日の snapshot / switch / rollback / smoke を script 化した
- `ikimon.life-v2-cutover.conf` を repo 管理に置き、VPS で `switch_public_nginx_to_v2.sh --dry-run` と `rollback_public_nginx_to_legacy.sh` を実行して nginx 切替 path を dry-run 済みにした
- `ikimon_v2_day0_runbook_2026-04-12.md` を追加し、`T-24h / T-15m / T-0 / T+5m / rollback` を 1 枚に固定した

つまり、Gate 4 と Gate 5 は閉じ、Gate 6 も script と dry-run path まで入った。残る本筋は `MECE release QA` と `live public rehearsal` だけだ。  
判断は [ikimon_v2_production_rehearsal_decision_2026-04-12.md](/E:/Projects/Playground/docs/architecture/ikimon_v2_production_rehearsal_decision_2026-04-12.md) に固定した。
