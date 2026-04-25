# ikimon v2 MECE Rollout Plan

更新日: 2026-04-13

## 0. 結論

現時点での最短パスは **`v2 ステージング表示復旧 → Gate6のリハーサル完走 → 本番切替可否判定`** です。  
今回確定した実装は、`/v2/` root の表示崩れ原因だった関数名不一致修正で、サイト風ランディングの表示が復帰します。

## 1. MECE 分解（実行責務）

### A. Surface 完備
公開導線を 3 つに固定して漏れを作らない。

1. Public: `/`, `/explore`
2. Authenticated: `/home`, `/record`, `/observations/:id`, `/profile`, `/profile/:userId`
3. Ops: `/healthz`, `/readyz`, `/ops/readiness`

### B. State 完備
画面と API を以下状態で観測する。

1. Guest
2. Demo（`sample-cadence` 系）
3. Authenticated（session）
4. Data-rich（photo/識別/track あり）
5. Sparse（空データ）

### C. Transition 完備
最低 6 遷移を順序固定で回す。

1. T1 Demo core loop
2. T2 Auth core loop
3. T3 Capture loop
4. T4 Revisit loop
5. T5 Public read loop
6. T6 Ops loop

### D. Failure mode 完備
リリース判断は以下の失敗軸を同時に潰す。

1. Routing 404 / prefix mismatch
2. Auth session 不整合
3. Write/API エラー
4. Data inconsistency（空・欠損）
5. Infra/監視不整合

### E. Ops 完備
環境別に最終チェックを固定する。

1. Staging内部
2. Staging edge
3. Production rehearsal

## 2. 実装優先順位（最短）

1. **Gate6残件の潰し込み（最短最優先）**
   - `run_cutover_rehearsal.sh` の live 相当シナリオを staging edge で再現可能か最終確認
   - `switch/rollback` 脚本の dry-run と本番互換演習
   - `/v2/` での画面導線（特にホーム・探索・詳細・記録・Profile）の遷移再現
2. **MECE監査実行（Matrix 運用）**
   - `ikimon_v2_release_qa_matrix_2026-04-13.md` の 5 軸を1枚に照合
   - 人手確認結果を「Pass / Fail / 条件付き」で更新
3. **本番演習 → 切替可否判断**
   - `run_day0_public_smoke.sh` を演習系URLで固定
   - rollback スクリプトを実行時間感覚付きで再確認

## 3. 今回の実装結果（2026-04-13）

- `repo_root/platform_v2/src/app.ts`
  - root handler の `buildPreviewRootHtml` 参照を `buildLandingRootHtml` に修正
  - `/v2/` の HTML モードで未定義関数呼び出しエラーを解消

実行確認:

- `npm -C repo_root/platform_v2 run -s typecheck` 通過

## 4. 進捗スコア（暫定）

- Gate1〜5: DONE（前提資料準拠）
- Gate6: internal rehearsal PASS / dry-run PASS / rollback PASS / live public switch pending
- MECE監査: `A1~A3`（surface/state/transition）に必要な人手チェックを残す

## 5. 次の 1 セッションで実行する 8 タスク

1. `/v2/` の実環境アクセス確認（表示と `?accept=application/json` の API marker）を 1 回実測
2. `T1, T2, T3, T4, T5, T6` の順で遷移手動再現
3. mobile でも core 4 画面が崩れないか確認
4. `run_v2_sample_cadence.sh` + `run_cutover_rehearsal.sh` を連続実行
5. `run_day0_public_smoke.sh` を cutover想定引数で dry-run
6. rollback script の復元先 snapshot を再確認（権限、対象ファイル）
7. 再確認結果を release matrix へ反映
8. "MECE監査の pass/fail" を明文化して次回へ引き継ぎ

## 6. 次の進化（1件）
- `/v2/` のヘッダー/フッター/言語切替を、現行サイト同等の UX で一度同期し、**「website 像」表示を最終固定**したうえで Gate6 へ突入する。
