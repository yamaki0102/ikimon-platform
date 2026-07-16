# 連理の木の下で サイエンスアドベンチャー — Test / Evidence Matrix

更新日: 2026-07-16
状態: 2026-07-16時点の実結果を反映。未実施項目をPASSと解釈しない

## 1. Result vocabulary

| Result | 意味 |
|---|---|
| PASS | 期待結果を実行して確認し、evidence locatorがある |
| FAIL | 実行したが期待結果を満たさない |
| BLOCKED | 外部基盤・権限・端末等で実行できない。理由とownerがある |
| OBSERVED | gateの一部をlocal working treeで確認したが、対象commit SHAとimmutable evidence未固定のためrelease PASSではない |
| 未実施 | まだ実行していない |
| N/A | 適用外。理由がある |

自動操作、browser emulation、Playwrightを「人間ユーザーテスト」または「物理端末試験」として記録しない。古いSHAの成功を対象SHAへ流用しない。

## 2. Evidence record contract

各PASS/FAILには次を記録する。

- Evidence ID
- 40文字commit SHA
- environment（local / staging / physical device / human test）
- 実行コマンドまたは人間向けscript version
- JST開始・終了時刻
- 実施者またはrunner
- 結果の要約
- report、screenshot、logのlocatorとhash
- fixture prefixとcleanup後残存数（fixtureを使った場合）

大容量reportをrepoへ直接置かない。既存Evidence Bundle保存先のlocatorだけをこの文書またはevidence indexへ記録する。secret、token、メール、座標、画像ファイル名を残さない。

## 3. Canonical / automated / staging

| ID | Gate | 期待結果 | Result | SHA / Evidence | Blocker / Owner |
|---|---|---|---|---|---|
| C01 | 公開時刻 | 公開・UI・JSON-LD・session・QR・recapが11:10–13:00 | 未実施 | | |
| C02 | runtime metadata | code、field、revision、hashが確定値で一致 | 未実施 | | production event未作成 |
| C03 | QR契約 | 3か所同一URL、credentialなし、終了後recap | 未実施 | | production URL未確定 |
| C04 | 公開QA event除外 | production公開一覧にQA event 0件 | **FAIL** | 2026-07-16 10:36 JST、HTTP 200、`PR973 prod rally` 2件 | branch修正はproduction未反映 |
| A01 | typecheck/build | 対象SHAで全コマンドgreen | **OBSERVED** | local Node typecheck・build PASS、`cloudflare_shadow npm run check` PASS、PHP syntax 665 files / 0 errors、deploy/migration/manifest guardrails PASS。Composer/PHPUnit toolchain不在で`composer test`はNOT RUN。commit SHA / bundle log未固定 | final SHAのimmutable evidenceとPHPUnit環境が必要 |
| A02 | unit/integration | guest分離、minor同意、same-origin、idempotencyがgreen | **OBSERVED** | local Node全1335/1335 PASS、local Worker全265/265 PASS | final SHAのimmutable evidenceが必要 |
| A03 | security | P0/P1 0件、token・IDOR・CSRF・XSS・EXIF・位置境界を確認 | **OBSERVED** | full diff scan 36/36 files、7 candidates、0 surviving formal findings。`renri_science_adventure_2026-07-19_security_privacy_review.md` | staging negative test・GPS EXIF実画像は未実施 |
| A04 | non-event regression | login、record、mapの対象回帰green | **OBSERVED** | local Node full regression 1335/1335 PASS | final SHAのimmutable evidenceが必要 |
| S01 | SHA一致 | PR head = staging runtime = verify = evidence | **BLOCKED** | 現staging `7438789b602dda50a6e7592a6d0dc33bece25763`は対象branch SHAではない | registry PR #188未merge、write QA未構成 |
| S02 | 未登録家族journey | QR→check-in→rally→live→recap | 未実施 | exact Renri spec 11 tests、supporting rally spec込み合計13 testsをPlaywright `--list`で確認。test runなし | staging deploy未実施 |
| S03 | 登録journey | 下書きとevent contextを保持して保存 | 未実施 | | |
| S04 | 位置拒否 | check-in・投稿・recapを継続 | 未実施 | | |
| S05 | 実画像R2+D1 | mockでない専用fixtureを保存・表示・集計 | 未実施 | | |
| S06 | EXIF/GPS | 配信用derivative bytesにEXIF/GPSなし | 未実施 | | |
| S07 | 障害復帰 | 500/503/timeout/切断後、入力・写真を保持し再試行 | 未実施 | | |
| S08 | 二重送信 | 二重tap・同一submission IDで重複なし | 未実施 | | |
| S09 | load | 20同時check-in、20 live、40投稿/10分相当で閾値内 | 未実施 | `renri_science_adventure_2026-07-19_load_failure_test.md` | |
| S10 | live/recap | 参加組数・観察件数が一致、主催者除外 | 未実施 | | |
| S11 | cleanup | 対象runのD1/R2/queue残存0 | 未実施 | | |
| V01 | Visual QA | 指定viewport、200%、keyboard、横scroll、safe area | **BLOCKED** | `renri_science_adventure_2026-07-19_visual_qa.md` | command bus `staging_write_qa_configured=false`、registry PR #188未merge |

command bus healthはHTTP 200、executor `ready`、waiting 0、stale 0。中央deploy registry replacement draft PR `yamaki0102/all-projects-management#188`（head `4f2b26b5`）はlocal validator greenだが未mergeで、required `validate`はGitHub billingによりjob未起動FAIL。したがってstaging deploy / verify / Visual QA / real-image E2E / load / cleanupはUNEXECUTEDである。

## 4. 物理端末試験

**2026-07-16時点ではiPhone / Android / アプリ内browserを含む全項目未実施。** 手順は `renri_science_adventure_2026-07-19_device_checklist.md`、結果は `renri_science_adventure_2026-07-19_real_device_results.md` に記録する。

| ID | Gate | 期待結果 | Result | Device / Evidence | Blocker / Owner |
|---|---|---|---|---|---|
| D01 | iPhone Safari | QR、許可/拒否、撮影/選択、lock、offline、recap | **未実施** | | 物理端末と実施者が必要 |
| D02 | Android Chrome | QR、許可/拒否、撮影/選択、lock、offline、recap | **未実施** | | 物理端末と実施者が必要 |
| D03 | アプリ内browser | join表示と外部browser移行 | **未実施** | | 対象app/端末が必要 |
| D04 | 運営端末 | console/live、電源、予備回線、個人情報非表示 | **未実施** | | 当日端末が必要 |

## 5. 人間ユーザーテスト

**2026-07-16時点ではRound 1 / Round 2とも未実施（0/8人）。** scriptは `renri_science_adventure_2026-07-19_user_test.md`、結果は `renri_science_adventure_2026-07-19_user_test_results.md` に記録する。AIエージェントの操作は人数へ数えない。

| ID | Gate | 成功基準 | Result | Human evidence | Blocker / Owner |
|---|---|---|---|---|---|
| H01 | Round 1 | 5人中4人以上が口頭介助なしで主要task完了 | **未実施（0/5）** | | 被験者5人・進行役・同意が必要 |
| H02 | QR→参加 | 中央値30秒以内 | **未実施** | | H01で計測 |
| H03 | QR→最初の保存 | 2分以内、登録で停止しない | **未実施** | | H01で計測 |
| H04 | 改善判断 | 2人以上失敗なら登録flow簡略化または安全なfallback判断 | **未実施** | | H01結果が必要 |
| H05 | Round 2 | 修正後3人中3人が主要task完了 | **未実施（0/3）** | | 被験者3人・対象SHAが必要 |

人間テストの記録は個人名を使わず `R1-P01` 等の匿名ID、task成否、時刻、介助内容だけを残す。未成年者を被験者に含める場合は別途保護者同意を得る。

## 6. 運営rehearsal

| ID | Gate | 期待結果 | Result | Evidence | Blocker / Owner |
|---|---|---|---|---|---|
| O01 | 3枚QR | 同一URLを2系統実機で読取 | **未実施** | | 本番URLと印刷物が必要 |
| O02 | Fallback 1 | live/位置を外し写真継続を1分以内で判断 | **未実施** | | 担当者割当が必要 |
| O03 | Fallback 2 | 写真端末保持、受付番号・時刻だけを紙へ記録 | **未実施** | | 担当者割当が必要 |
| O04 | Fallback 3 | ikimonを外してイベント継続 | **未実施** | | 判断責任者が必要 |
| O05 | 13:00 close | 参加者終了と13:00–13:40運営時間を分離 | **未実施** | | 当日進行確認 |

## 7. Final summary

| 集計 | 件数 |
|---|---|
| PASS | 0（release gate） |
| FAIL | 1（C04） |
| BLOCKED | 2（S01、V01） |
| OBSERVED | 4（A01–A04。release PASSではない） |
| 未実施 | 上記以外の全gate |
| Open P0 | 1（production公開一覧のQA event残存） |
| Open P1 | source diff formal finding 0件。staging negative test・GPS EXIF実画像・runtime validationは未実施 |

最終集計は対象SHAで全実行が終わった時点に更新する。template作成を検証完了の証拠にしない。
