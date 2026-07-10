# ikimon.life 同定ワークベンチ実装ゴール

作成日: 2026-06-01

## ゴール

`/records?view=needs_id` と観察詳細、資料ライブラリを統合し、団体向けに売れる同定ワークベンチへ育てる。

完成状態は次の通り。

- PC は確認待ち一覧を維持したまま、選択中レコードをメディア first の詳細パネルで確認できる。
- スマホは一覧から下シートで詳細を開き、戻り操作なしに次の記録へ進める。
- 同定操作は `この候補でよさそう` / `別の名前` / `証拠不足` / `保留` をパネル内で処理できる。
- 操作後は次へ進み、誤操作に備えて `戻す` / `このまま見る` を出す。
- 登録済み資料から `この資料で確認` コマンドを出す。
- 同定ログへ使用資料を自動で紐づける。
- 資料は自由登録でき、表記揺れ・重複候補を自動提示し、管理者/団体が canonical へ統合確定できる。
- authority / Tier 3 の品質ゲートと矛盾させない。
- 本番反映は許可済み。ただし local validation -> staging deploy -> staging smoke -> production deploy -> production smoke の順で進める。

## 確定した設計判断

- 売る相手は団体。ただし表の世界観は「全員が見られるところから関われる」。
- 同定ページは説明ページではなく、繰り返し使う作業台にする。
- 厚いコピーや「社会貢献」押しは避ける。
- ユーザーの能力は「見る範囲」ではなく、資料・図鑑・講習・団体承認などの根拠カードとして扱う。
- 根拠カードと観察記録を照合し、使える操作を出す。カードゲーム的に「この資料で確認」できる状態を目指す。
- 毎回参考文献を入力させない。一度登録した資料を同定時に選び、同定ログへ紐づける。
- 図鑑・資料の丸写しはしない。版、出典、適用地域、分類群、見分けメモ、誤同定/改訂情報を metadata と独自ノートで扱う。

## 既存の土台

- `knowledge_source_reference_metadata`: 資料メタデータ。
- `knowledge_source_taxon_links`: 資料と分類群の紐づけ。
- `reference_capture_batches` / `reference_capture_items`: 表紙/ISBN等の登録バッチ。
- `user_reference_access_proofs`: ユーザーが資料を使える証跡。
- `identification_references`: 同定に使用した資料。
- `knowledge_source_corrections`: 図鑑/資料の誤同定、改訂、分布更新メモ。
- `listReferenceCandidatesForIdentification`: 観察レコードに合う資料候補の抽出。

## 2026-06-01 進捗

- 同定フォーム内の資料選択コピーを `参照資料を選ぶ` から `この資料で確認` へ寄せた。
- `support` 同定だけでなく、`alternative_id` 経由の別候補提案でも `referenceSourceIds` / `referenceLocator` を API に渡すようにした。
- `openObservationDispute` が別候補提案時に作成する `identifications` 行へ、使用資料を `identification_references` として紐づけるようにした。
- `/records?view=needs_id` に同定ワークベンチパネルを追加した。PC は一覧 + 右パネル、スマホは下部ランチャーと重ならない固定下パネルで、カード選択時に一覧を維持したまま対象を切り替える。
- 確認待ちが空のケースでも、同定ワークベンチとしての空状態を出すようにした。
- 同定パネルに `この候補でよさそう` / `別の名前` / `証拠不足` / `保留` の連続処理アクションを追加した。
- 保存または保留後は対象カードを処理済み表示にし、次の未処理カードへ進む。直前カードは `戻す` / `このまま見る` で表示を戻せる。
- パネルのカード選択時に `identifications` / `disputes` の endpoint、候補名、rank、詳細リンクを差し替えるようにした。
- `/api/v1/observations/:id/reference-candidates` を追加し、ログイン中のユーザーだけが登録済み/共有カタログの資料候補を取得できるようにした。
- 同定パネル内に `この資料で確認` の資料候補カードとページ・図版番号入力を追加した。所有確認済み資料は初期選択し、support / alternative 保存時に `referenceSourceIds` / `referenceLocator` として渡す。
- 観察詳細の同定履歴 read model に `identification_references` を通し、使用資料を `この資料で確認: ...` として履歴上で見えるようにした。
- staging regression fixture に、同定者が所有確認済みとして使える `Regression Field Guide <fixturePrefix>` を seed するようにした。
- staging fixture cleanup が、fixture で作成した `knowledge_sources` も削除対象に含めるようにした。
- `e2e/identification-workbench.staging.spec.ts` を追加し、`/records?view=needs_id` で資料候補を選んで保存し、観察詳細の同定履歴に資料名と locator が残ることを staging smoke で確認できるようにした。
- 参照資料ライブラリの `needs_review` タブで、管理者/分析担当に重複候補を表示し、`canonicalへ統合` で `identification_references` / 所有証跡 / 分類群リンクを canonical source へ寄せてから duplicate source を `catalog_status=duplicate` にできるようにした。
- duplicate 扱いになった資料は、参照候補・資料一覧・同定ログの新規選択対象から外すようにした。
- 資料候補がない場合も、`資料を登録` から `returnTo` と `taxonHint` を持って登録画面へ移動し、登録後に同定ワークベンチまたは詳細の `#identify` へ戻れるようにした。
- Tier 3 昇格条件を更新し、community consensus 経路では `identification_references` が少なくとも1件紐づくまで昇格しないようにした。authority-backed public claim は既存どおり authority 証跡を根拠として扱う。
- Tier 3 に足りない項目として、資料未紐づけ時は `同定に使った資料を1件紐づける` を出すようにした。

検証:

- `npx tsx --test src/routes/identification.write.routes.test.ts`
- `npx tsx --test src/routes/publicCopy.routes.test.ts`
- `npx tsx --test src/services/identificationConsensus.test.ts`
- `npx tsx --test src/routes/stagingFixtures.routes.test.ts`
- `npm run typecheck`
- `npm run build`
- `npx playwright test e2e/identification-workbench.staging.spec.ts --config=playwright.staging.config.ts --list`
- `git diff --check -- .gitignore ops/runbooks/identification_workbench_goal_2026-06-01.md platform_v2/e2e/support/staging.ts platform_v2/e2e/identification-workbench.staging.spec.ts platform_v2/src/routes/identification.write.routes.test.ts platform_v2/src/routes/publicCopy.routes.test.ts platform_v2/src/routes/read.ts platform_v2/src/routes/references.ts platform_v2/src/routes/write.ts platform_v2/src/services/identificationConsensus.test.ts platform_v2/src/services/identificationConsensus.ts platform_v2/src/services/identificationParticipation.ts platform_v2/src/services/observationVisitBundle.ts platform_v2/src/services/readModels.ts platform_v2/src/services/referenceLibrary.ts platform_v2/src/services/stagingFixtureCleanup.ts platform_v2/src/services/stagingRegressionFixtures.ts platform_v2/src/services/identificationReferencesView.ts`
- PC screenshot: `platform_v2/.codex-tmp/identification-workbench-desktop.png`
- mobile screenshot: `platform_v2/.codex-tmp/identification-workbench-mobile.png`
- mobile reference capture screenshot: `platform_v2/.codex-tmp/reference-capture-mobile.png`

## 2026-06-01 deploy gate

`powershell -ExecutionPolicy Bypass -File .\scripts\start_deploy_handoff.ps1 -TargetRepo E:\Projects\03_ikimon.life_Product` を実行した。

結果:

- `E:\Projects\03_ikimon.life_Product` は `E:\Projects\ikimon\worktrees\active-clean` への junction として解決された。
- target repo は 46 dirty entries で deploy-ready ではない。
- 同定作業以外の dirty が含まれるため、このまま staging / production へ進めない。
- deploy 正規ルートは PR -> main merge -> GitHub Actions。直接 SSH deploy はしない。

## 次の実装順

1. 同定関連の差分だけを fresh deploy worktree / PR ブランチへ分離する。
2. project-local preflight を clean worktree で通す。
3. staging で PC/スマホの導線、資料紐づけ、Tier 3 gate を smoke する。
4. 合格後に production deploy workflow と production smoke まで進める。

## 2026-06-01 production smoke hardening

production deploy 後の汎用 smoke だけでは、同定ワークベンチの資料根拠保存フローを直接保証できなかったため、`production-smoke.spec.ts` に同定専用ケースを追加した。

- smoke 用の同定者を登録し、そのユーザー自身の確認待ち記録として同定ワークベンチへ出す。
- 同定者が ISBN proof 付きの資料を登録し、所有確認済み資料にする。
- 観察者が `ハシブトガラス` の写真付き記録を作成する。
- `/records?view=needs_id` で対象カードを開き、資料候補が `この資料で確認` として自動選択されることを確認する。
- `この候補でよさそう` で保存し、観察詳細の同定履歴に資料名と locator が残ることを確認する。
- checkpoint `identification_workbench_reference_flow` を production smoke summary に出す。

同時に、production smoke cleanup が `reference_capture_batches` / `reference_capture_items` / `user_reference_access_proofs` / `knowledge_source_*` / `identification_references` を fixture prefix で掃除できるようにした。これにより、本番カタログに smoke 用資料が残らない。

追加検証:

- `npm run typecheck`
- `npm run build`
- `npx playwright test -c playwright.production-smoke.config.ts --list`
- `git diff --check`

## 2026-06-11 Opus review hardening

Claude Opus review raw evidence:

- `E:\Projects\_agent_scratch\claude-latest-review\ikimon-identification-ux-20260611-opus\claude-review-20260611-opus.md`

追加実装:

- 所有済み資料を同定パネルで自動チェックしない。`input.checked = false` にし、実際に確認した資料だけを手動で選ぶ。
- AI由来の候補ラベルを `AI候補` / `AI suggestion` 系にし、AI候補名が入力欄に入っている時は注意を表示する。
- 最後のカード処理後は同定パネルを空キュー状態へ切り替える。
- `identification_workbench_holds` と `/api/v1/observations/:id/identification-workbench-hold` を追加し、保留を利用者ごとに永続化する。
- `/api/v1/records/needs-id-page` を追加し、同定ワークベンチでも追加読み込みできるようにする。
- `support` 保存時は、資料選択または `資料なしで保存する` の明示チェックを必須にする。
- 保存失敗文言と `Ready` 文言を多言語コピーへ移す。
- `J/K` と `1-4` のキーボード操作を追加し、モバイルでは必要時だけ同定パネルへスクロールする。

PR lane:

- `E:\Projects\ikimon\worktrees\identification-opus-pr`
- branch: `codex/ikimon-identification-opus-pr`
