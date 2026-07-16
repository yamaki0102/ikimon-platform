# 連理の木の下で サイエンスアドベンチャー最終改善・検証 実装計画

**対象日:** 2026-07-19（日）

**参加者向け開催時間:** 11:10–13:00 JST

**運営撤収・ふり返り:** 13:00–13:40 JST（参加者向け開催時間には含めない）

**対象:** `ikimon.life` / `platform_v2` / Cloudflare staging

**作業正本:** `codex/renri-science-adventure-final-20260716`（`origin/main` の `ce3d8f70e2fda2be116429d95266a5da2a4abb16` から作成したfresh branch）
**本番境界:** production deploy、production DB/D1/R2変更、productionイベント作成、production migration、secret・DNS・custom domain・R2 pointer・権限変更、本番参加者データの参照/変更/削除は実施しない。GitHub Actionsをbuild/test/deploy/verify/Visual QA/rollbackの実行基盤にしない

## Status snapshot（2026-07-16）

`実装済み` は作業ツリー内のコード・資料が存在すること、`準備済み` は実行手順またはテストが存在することを表す。staging、人間、物理端末の実行結果を意味しない。

| 領域 | 現状 | 残る完了条件 |
|---|---|---|
| PR #1304監査 | 完了。イベントと無関係な大規模分割を含む旧branchは採用せず、fresh branchへ必要差分を直接再実装 | fresh PR作成後に旧PRを置換先付きでsupersedeする |
| Worker / Nodeイベント導線 | 実装済み。`index.ts`へ直接実装し、event-scoped HttpOnly cookie、same-origin、位置同意、終了後recap、QA公開除外、家族数集計、写真復旧時のイベント文脈を対象テストで確認済み。local Node 1335/1335、Worker 265/265、独立full diff scanは正式指摘0件 | final SHAのimmutable CI evidenceとstaging runtime validationを完了する |
| 画像安全性 | MIME/拡張子/magic bytes検証と、配信用derivativeのEXIF/GPS非露出を検証する契約を実装済み | stagingの実R2/D1経路で1件を保存・配信・cleanupする |
| Browser E2E | 8 viewport、503復帰、二重check-in、実画像、集計、cleanupを含むspecを準備済み。test discoveryのみ確認 | 対象SHAをstagingへ反映後に実行する |
| 負荷試験 | 20 check-in、20 live、40投稿/実時間10分のscriptとdry-run guardを準備済み | stagingで実行し、成功率・p95・429/5xx・孤児ゼロを記録する |
| 運営・証跡資料 | participant/staff/fallback/GO判定/evidence等を準備済み | 実行結果欄を実測値で埋める |
| 人間ユーザーテスト | 手順・記録票のみ準備済み | **未実行**。Round 1（5人）とRound 2（3人）をAI操作と区別して実施する |
| 物理端末試験 | checklist/result雛形のみ準備済み | **未実行**。iPhone Safari / Android Chrome / 可能ならアプリ内ブラウザで実施する |
| 新SHAのstaging | 未実行。既存SHAの過去証跡は流用しない | command busの先行issue/leaseを正常化後、同一40文字SHAで順番に実行する |
| production | 未実施 | manifestだけ準備し、明示承認まで変更しない |

## Goal

家族が1台のスマートフォンでQRから参加し、位置情報なしでも迷わず観察・保存・会場共有・後日ふり返りまで進める状態を、コード・テスト・運営資料・同一SHAのstaging証跡で検証する。未実施の人間ユーザーテストや実機試験を自動試験で代用したと報告しない。

## Completion criteria

1. 公開・UI・構造化データ・運営資料の参加者向け時刻が `11:10–13:00 JST` で一致し、`13:00–13:40` は運営時間としてだけ記載される。
2. ゲスト参加資格はサーバー生成・イベントスコープ・不透明で、URL、公開HTML、ログ、local/session storageに露出しない。登録ユーザーにはゲスト資格を発行しない。
3. 位置共有は初期OFFで、未成年を含む共有は明示的な保護者同意がない限りサーバー側でも拒否される。正確な位置・EXIF・内部IDを公開しない。
4. 通常の観察保存はラリー、GPS、AI同定に依存せず、AIは「受付・処理中」と「同定完了」を区別する。
5. 既存PR差分に無関係な変更や生成物混入がなく、P0/P1セキュリティ所見がゼロ、対象テスト・型検査・build・guardrailが通る。
6. stagingで20同時check-in、実時間10分に40投稿の負荷試験、503再試行、二重送信、オフライン復帰、実R2+D1画像1件の保存・表示・集計・cleanupゼロ残存を証跡化する。
7. iPhone Safari / Android Chrome / desktop / 狭幅・広幅Visual QAの結果を、実機・エミュレーション・未実施に明確に分類する。
8. 対象commit SHAを固定し、先行commandのterminal、lease 0、staging health greenを確認してからCloudflare command busの `dry_run → deploy(staging) → verify → visual_qa` を同じSHAで順番に完了する。PR本文とevidence indexも同じSHAへ同期する。

## Canonical decisions

- PR #1304の純度監査はFAIL。`origin/main`の `ce3d8f70e2fda2be116429d95266a5da2a4abb16` から作成した `codex/renri-science-adventure-final-20260716` で、イベントに必要な差分だけを再実装する。旧PRのイベントと無関係な大規模分割、汎用staging診断、SHA retry、過去deploy test修復は移植しない。
- Cloudflare Workerの変更は `platform_v2/cloudflare_shadow/src/index.ts` へ直接実装する。今回のイベント対応を理由にファイル分割や全体リファクタリングを追加しない。
- ゲストはcheck-in、live、recapを利用できる。観察写真の保存は今回、既存登録導線を維持し、受付スタッフの代理保存をfallbackにする。安全なゲスト投稿は、人間テストが登録離脱を示した場合の別判断とし、イベント直前に認可面を拡張しない。
- 同じイベントQRは開催中はjoin、終了後はrecapへ解決する。productionイベントの作成・URL・QR確定はmanifestだけ準備し、実作成しない。
- 種名不明は正式な観察状態として許容する。自分の発見を先に見せ、会場全体の集計・ラリーは保存成功後の二次価値にする。

## External review adoption

- Gemini `gemini-3.5-flash`: 完了。イベント別cookie namespace、mutationのsame-origin強制、fixture run prefix単位のcleanupを採用。
- Claude `claude-opus-4-8`: 2回とも「ファイルを読む」という前置きだけで実質レビューが返らず、採用判断には使用しない。
- EXIF指摘: 懸念は採用。ただし新しい画像処理系を先に追加せず、既存のimage derivative/storage経路で保存後bytesからEXIF/GPSが除去されていることを実証し、不合格時だけ最小修正する。
- ゲスト直接写真投稿、本番secret/D1/DNS変更の延期は維持する。

## Task 1 — PR完全性・正本・時刻を固定する【監査・実装完了／最終証跡待ち】

**Files**

- Modify: `docs/operations/renri_science_adventure_2026-07-19_readiness.md`
- Add: `docs/operations/renri_science_adventure_2026-07-19_event_canonical.md`
- Test: `platform_v2/cloudflare_shadow/src/index.test.ts`
- Test: `platform_v2/e2e/renri-science-adventure-journey.staging.spec.ts`

**Steps**

1. 旧PRのhead/base/merge-baseと差分純度を監査し、イベントと無関係な大規模分割を含むため置換判断とした。【完了】
2. fresh branchを `origin/main` の `ce3d8f70e2fda2be116429d95266a5da2a4abb16` から作成し、イベント差分だけを再実装する。【完了】
3. 公開UI・JSON-LD・fixture・運営資料の参加者向け時刻を `11:10–13:00` に統一し、`13:00–13:40` は運営撤収・ふり返りだけに使う。参加者終了を運営終了時刻へ延長する期待値は作らない。【実装済み、関連資料・E2Eの時間表記横断検索済み】
4. 公開イベントページをread-onlyで照合し、開催日、時刻、定員10組、1組500円、ブルーベリー約100g、受付終了をcanonical資料へ記録する。【完了】

## Task 2 — check-inのプライバシー・資格境界をTDDで修正する【実装済み／local全回帰・security scan完了】

**Files**

- Modify: `platform_v2/src/ui/observationEventCheckin.ts`
- Modify: `platform_v2/src/routes/observationEventApi.ts`
- Modify: `platform_v2/src/services/observationEventGuestCredential.ts`
- Modify: `platform_v2/cloudflare_shadow/src/index.ts`
- Modify: `platform_v2/src/ui/observationRally.ts`
- Test: `platform_v2/src/ui/observationEventCheckin.test.ts`
- Test: `platform_v2/src/ui/observationRally.test.ts`
- Test: `platform_v2/src/services/observationEventGuestCredential.test.ts`
- Test: `platform_v2/src/routes/observationEventGuestCredential.routes.test.ts`
- Test: `platform_v2/cloudflare_shadow/src/index.test.ts`

**Steps**

1. 位置共有初期OFF、未成年の位置共有時だけ保護者同意必須、同意期限のサーバー決定をWorkerとNodeの両経路へ実装する。【完了】
2. 未登録参加者だけにCSPRNG由来のevent-scoped資格を発行し、digestだけをD1へ保存する。資格はevent別 `__Host-` cookie（`Path=/; HttpOnly; Secure; SameSite=Lax`、`Domain`なし）で保持し、URL/body/HTML/web storageへ出さない。【完了】
3. 登録済みユーザーのcheck-inではguest資格を新規発行せず、既存guest参加を安全にclaimしてcookieを破棄する。【完了】
4. check-in、role、absence、location、rally submission等のmutationへsame-origin gateを適用し、二重check-inを冪等にする。【完了】
5. CSP nonceと安全な直列化を使い、inline script breakout、token query、内部actor/digest露出を回帰試験で防ぐ。【完了】
6. focused testに加え、Node 1335/1335、Worker 265/265の全回帰と独立full diff scanを実行した。scanで検出した終了後check-in、匿名rally snapshot、credential-bearing trace等を修正・再検証し、surviving formal findings 0件。【local完了、staging未実行】

## Task 3 — 観察保存・AI状態・オフライン耐性を固定する【実装済み／staging実証待ち】

**Files**

- Modify: `platform_v2/cloudflare_shadow/src/recordRecoveryHtml.ts`
- Test: `platform_v2/cloudflare_shadow/src/recordRecoveryHtml.test.ts`
- Modify: `platform_v2/cloudflare_shadow/src/index.ts`
- Test: `platform_v2/cloudflare_shadow/src/index.test.ts`
- Modify: `platform_v2/e2e/renri-science-adventure-journey.staging.spec.ts`

**Steps**

1. GPS・ラリー・AIなしで通常保存できる既存契約を維持し、AI受付/処理中と同定完了を混同しない表示を対象試験で確認する。【実装済み】
2. 署名付き写真復旧でevent code、session、team、participant roleをIndexedDB metadataから安全に復元し、復旧後の観察をイベントlive/recap集計へ戻す。【実装済み、focused test green】
3. JPEG/PNG/WebP/HEIC/HEIF/AVIFのallowlist、MIME・拡張子・magic bytes一致をstaging/production経路で強制し、偽装画像やSVGを415で拒否する。【実装済み、focused test green】
4. E2Eで一度だけ503を発生させ、reload後のフォーム復元と二重check-in冪等性を確認する。【spec準備済み、staging未実行】
5. GPS EXIF入りの合成fixtureを実R2/D1へ保存し、配信用WebPにEXIF/座標bytesが残らないことを確認する。【staging未実行】

## Task 4 — staging fixture・実画像・cleanup契約を強化する【実装済み／focused test green／staging未実行】

**Files**

- Modify: `platform_v2/e2e/renri-science-adventure-journey.staging.spec.ts`
- Modify: `platform_v2/src/services/stagingFixtureGuard.ts`
- Test: `platform_v2/src/services/stagingFixtureGuard.test.ts`
- Modify/Test: `platform_v2/cloudflare_shadow/src/index.ts`
- Modify/Test: `platform_v2/cloudflare_shadow/src/index.test.ts`

**Steps**

1. upload mockだけでは合格しないE2Eを分離し、合成画像を通常API経由でR2/D1へ保存する。【準備済み】
2. staging専用・期限付き・`renri-e2e-*` run prefix固定のfixture inventory/cleanup APIを設け、production host/bindingではfail-closedにする。【実装済み、focused test green】
3. run開始前後のinventoryを保存し、当該run prefixのD1/R2/queue残存がゼロでなければtestをfailさせる。他runnerのfixtureは削除も合否判定もしない。【実装済み、focused test green】
4. 実画像表示、participant/observation集計、cleanupゼロを同一staging SHAで確認する。【未実行】

## Task 5 — 負荷・失敗・分析契約を作る【準備済み／staging未実行】

**Files**

- Add: `platform_v2/cloudflare_shadow/scripts/run-renri-event-load-check.mjs`
- Add/Test: `platform_v2/cloudflare_shadow/src/renriEventLoadContract.test.ts`
- Add: `docs/operations/renri_science_adventure_2026-07-19_load_failure_test.md`
- Add: `docs/operations/renri_science_adventure_2026-07-19_analytics_dashboard.md`

**Steps**

1. 20同時check-in、20 live閲覧、実時間10分で40投稿の成功率・p95・429/5xx閾値を定義する。【完了】
2. staging fixtureだけを使い、production targetを拒否する負荷scriptとdry-run/600秒minimum guardを実装する。【完了、dry-runのみ】
3. QR→join→check-in→登録開始→保存→live→recapのイベント名、集計クエリ、当日ダッシュボード、個人情報を含めないログ境界を文書化する。
4. 503、ネット切断、二重tap、位置拒否、AI遅延、写真upload失敗の期待挙動と運営fallbackを文書化する。【資料準備済み、実環境検証未実行】
5. staging実行後、重複・欠損・孤児、participant/observation count、p95、error rateをevidenceへ記録する。【未実行】

## Task 6 — 人間テスト・実機・運営資料を実行可能状態へする【資料準備済み／人間・物理端末未実行】

**Files**

- Add: `docs/operations/renri_science_adventure_2026-07-19_user_test.md`
- Add: `docs/operations/renri_science_adventure_2026-07-19_user_test_results.md`
- Add: `docs/operations/renri_science_adventure_2026-07-19_device_checklist.md`
- Add: `docs/operations/renri_science_adventure_2026-07-19_real_device_results.md`
- Add: `docs/operations/renri_science_adventure_2026-07-19_visual_qa.md`
- Add: `docs/operations/renri_science_adventure_2026-07-19_security_privacy_review.md`
- Add: `docs/operations/renri_science_adventure_2026-07-19_staff_runbook.md`
- Add: `docs/operations/renri_science_adventure_2026-07-19_participant_guide.md`
- Add: `docs/operations/renri_science_adventure_2026-07-19_fallback_card.md`
- Add: `docs/operations/renri_science_adventure_2026-07-19_go_no_go.md`

**Steps**

1. 初見家族5名のRound 1、修正後3名のRound 2用に、進行台本、観察項目、成功基準、同意、記録用紙を準備する。【完了、テスト未実行】
2. iPhone Safari、Android Chrome、desktop、低速/オフライン、カメラ権限、位置拒否の試験表を作り、`物理端末 / エミュレーション / 未実施` を必須列にする。【完了、物理端末未実行】
3. 受付、QR、登録詰まり、代理保存、AI遅延、位置非共有、障害時紙運用、13:00の参加者終了、13:00–13:40の運営撤収・ふり返りをrunbookへ分離する。【完了】
4. 参加者向け1枚案内は専門語を避け、種名不明・位置共有なし・家族1台を明記する。【完了】
5. PlaywrightやAI操作を人間ユーザーテストまたは物理端末試験のPASSへ置き換えない。【継続条件】

## Task 7 — セキュリティ・UI・全回帰ゲートを通す【local Node/Worker/security完了、staging/UI実行待ち】

**Verification commands**

```powershell
cd E:\Projects\ikimon\worktrees\renri-science-adventure-final-20260716\platform_v2
npm run typecheck
npm run test:node
npm run build

cd cloudflare_shadow
npm run check
npm test
npm run test:quick
npm run wrangler:check:staging

cd E:\Projects\ikimon\worktrees\renri-science-adventure-final-20260716
php tools/lint.php
composer test
powershell -ExecutionPolicy Bypass -File .\scripts\check_deploy_guardrails.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\check_platform_migration_guardrails.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\check_deploy_manifest_sync.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\check_staging_manifest_sync.ps1
```

**Additional gates**

- 実行結果: Node typecheck・1335/1335・build PASS、Worker check・265/265 PASS、Node/Worker npm audit 0、PHP syntax 665 files / 0 errors、deploy/migration/manifest guardrails PASS。Composer/PHPUnit toolchain不在のため`composer test`はNOT RUN。Codex Security full diff scanは36/36 filesをreviewし、7 candidates検証後のsurviving formal findings 0。browser E2Eはexact Renri 11 / supporting込み13 testsの定義確認のみで、staging runは未実施。

- security diff scan: threat model → finding discovery → validation → attack path; P0/P1は修正して再走査する。
- UI quality: 320×568、360×800、375×667、390×844、393×852、412×915、768×1024、1440×900、200% zoom、keyboard、screen-reader landmarks、reduced motion、horizontal overflow。
- secrets/personal data scan: staged pathとdiffを対象にし、証跡へ値を出力しない。
- regression: event外のrecord、map、login、rally保存成功後導線を対象に含める。
- staging E2E、Visual QA、負荷試験はTask 8の同一SHA deploy/verify完了後だけ実行し、ローカルまたは旧SHAの結果と混同しない。
- 人間ユーザーテスト、iPhone/Android物理端末、アプリ内ブラウザはこの自動ゲートに含めず、未実行ならそのまま記録する。

## Task 8 — PR、同一SHA staging、evidenceを閉じる【未実行】

**Files**

- Add: `docs/operations/renri_science_adventure_2026-07-19_production_operation_manifest.md`
- Add: `docs/operations/renri_science_adventure_2026-07-19_risk_rollback.md`
- Add: `docs/operations/renri_science_adventure_2026-07-19_evidence_index.md`
- Close/supersede: PR #1304
- Create/update: fresh event-only PR from `codex/renri-science-adventure-final-20260716`
- Inspect/update separately: `E:\Projects\00_all_projects_management\operations\deploy_standard\service_deploy_registry.json`（中央entryの陳腐化が確認済み。イベントPRへ混ぜず、中央repoのfresh branch/PRでcommand-bus正本へ更新する。mergeはしない）

**Steps**

1. 明示ファイルだけstageし、`git diff --cached --check`、secret scan、`git diff --cached --name-only`を通す。
2. scoped commitをpushし、PR本文を `変更内容 / 影響範囲 / 検証 / 本番反映なし / review重点` と正しい時刻へ更新する。
3. 40文字head SHAを固定する。新規commandをenqueueする前に、既存command issueがterminal、active leaseが0、recovery/staging healthがgreen、対象manifestがcommand-bus方式と一致することを確認する。queued/lease不整合ならblind retryせず停止して証跡化する。
4. Cloudflare command busで、必ず同じSHAの `dry_run` 成功後に `deploy staging`、その成功後に `verify`、その成功後に `visual_qa` を一件ずつ実行する。GitHub Actionsへfallbackしない。
5. `deploy` 前にE2Eや負荷試験を実行しない。`verify` 後の同じstaging SHAでBrowser E2E、8 viewport、実R2+D1画像、20 check-in/20 live/40投稿10分、cleanupゼロを実行する。古いissueや旧SHAの成功証跡を流用しない。
6. screenshot、JSON/ログ要約、command issue番号、PR、SHA、実行時刻、fixture prefix、未実施の人間/物理端末試験、production承認境界をevidence indexへ記録する。
7. production manifestにはevent code、`11:10–13:00`、運営 `13:00–13:40`、定員、料金、QR解決規則、想定URL、作成/rollback手順だけを書き、production event/session作成、deploy、DB/D1/R2/migration、secret、DNS、参加者データ操作は行わない。

## Risk registry and rollback

| Risk | Stop condition | Recovery |
|---|---|---|
| fresh PRへの無関係差分混入 | イベント外の大規模分割、generated混入 | 対象外差分をstageせず、イベントに必要な差分だけでPRを作る |
| token漏えい | query/body/HTML/storage/logにguest tokenが残る | staging deploy停止、cookie境界へ戻して再監査 |
| 未成年位置共有 | 明示同意なしでshareが保存される | APIをfail-closed、共有OFFへ強制 |
| fixture越境 | production binding/URLを検出 | 即停止、データ変更せずmanifestを破棄 |
| cleanup残存 | D1/R2/queue残存数が0でない | GO禁止、fixture prefixで個別cleanupし再検証 |
| visual QA/e2e基盤停止 | command issueがqueued/lease不整合 | productionへ進まず、実施不能を証拠付きで記録 |
| 人間/実機試験未実施 | 被験者または端末が用意できない | 自動試験と区別し、当日スタッフfallbackを有効化 |

## Final decision rule

- **GO:** 自動・staging・セキュリティのP0/P1がゼロ、cleanupゼロ、時刻/資格/位置境界が一致し、人間・実機の未実施項目が運営fallbackで受容可能。
- **CONDITIONAL GO:** 自動ゲートはgreenだが、人間/物理端末や外部executorの一部が未実施で、当日fallbackと責任者確認が必要。
- **NO-GO:** token/位置/写真消失/認可/production越境/cleanup残存/同一SHA不一致のいずれかが残る。
