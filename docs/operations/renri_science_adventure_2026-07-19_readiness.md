# 連理の木の下で サイエンスアドベンチャー — Readiness Index

更新日: 2026-07-16

参加者向け開催時間: **2026-07-19（日）11:10–13:00**

運営振り返り・撤収: **13:00–13:40**

現在の判定: **NO-GO（2026-07-16 11:27 JST時点）**

## 1. 現在地

| 項目 | 状態 | 根拠・次の記録先 |
|---|---|---|
| 公開日時の正本 | 11:10–13:00で固定 | `renri_science_adventure_2026-07-19_event_canonical.md` |
| 運営資料 | template完成 | staff runbook / participant guide / fallback card |
| production session・QR | **未作成・未確定** | production operationは別承認 |
| 対象SHAの全自動gate | **未完了** | local Nodeはtypecheck PASS、全1335/1335、build PASS。local Workerは全265/265 PASS、`cloudflare_shadow npm run check` PASS。独立full diff scanは正式指摘0件。commit SHA固定後のimmutable evidenceとbrowser E2E実行が未完了 |
| staging同一SHA evidence | **BLOCKED / 未実施** | 現stagingは旧SHA `7438789b602dda50a6e7592a6d0dc33bece25763`。対象branch SHAではない |
| 実画像R2+D1・cleanup | **未実施として扱う** | test/evidence matrix |
| iPhone / Android物理端末 | **未実施** | device checklist / real-device results |
| 人間ユーザーテストRound 1 / 2 | **未実施（0/8人）** | user-test script / separate results |
| Fallback rehearsal | **未実施** | staff runbook / evidence matrix |
| GO / NO-GO | **NO-GO** | production公開一覧にQAイベントが残存。ほかの未実施hard gateも含め、go/no-go判定票を参照 |
| production deploy・DB・event作成 | **実施していない** | 本タスクの承認境界 |

2026-07-16 10:36 JSTのread-only確認では、productionの公開イベント一覧はHTTP 200だったが、`PR973 prod rally` が2件表示された。fresh branchの一覧除外修正はproductionへ反映していないため、このP0は公開面で未解消であり、現時点の判定はNO-GOとする。

command busのhealthはHTTP 200、executor `ready`、waiting 0、stale 0。ただし`staging_write_qa_configured=false`である。中央deploy registryのreplacement draft PR `yamaki0102/all-projects-management#188`（head `4f2b26b5`）はlocal validator greenだが未mergeで、required `validate`はGitHub billingによりjob未起動のままFAIL。このため対象SHAのstaging deploy / verify / Visual QA / browser E2E / 実画像 / load / cleanupは実行していない。

read-only runtime参照はstaging `7438789b602dda50a6e7592a6d0dc33bece25763`、production `2c4d72224ece8fe653bc1bffc4ce3ffa57b059cb`。どちらも今回の対象branch SHAではなく、今回のproduction操作を示す値でもない。

templateの作成、AIによるbrowser操作、過去SHAの成功は、未実施gateのPASS証拠にならない。

## 2. Operational documents

| 文書 | 用途 |
|---|---|
| `renri_science_adventure_2026-07-19_event_canonical.md` | 公開値、runtime予定値、URL、集計、privacyの正本 |
| `renri_science_adventure_2026-07-19_participant_guide.md` | QR下3文、参加3step、受付掲示 |
| `renri_science_adventure_2026-07-19_participant_journey.md` | QRからrecapまでの主経路、分岐、成功・停止条件 |
| `renri_science_adventure_2026-07-19_analytics_dashboard.md` | 16 event、禁止PII、funnelと運営counterの仕様 |
| `renri_science_adventure_2026-07-19_staff_runbook.md` | 役割、10:10–13:40の当日進行、障害判断 |
| `renri_science_adventure_2026-07-19_device_checklist.md` | iPhone、Android、アプリ内browser、運営端末の実施手順 |
| `renri_science_adventure_2026-07-19_real_device_results.md` | 物理端末専用の結果票。現在UNEXECUTED |
| `renri_science_adventure_2026-07-19_user_test.md` | 人間Round 1 / Round 2のfacilitator script |
| `renri_science_adventure_2026-07-19_user_test_results.md` | 人間テスト専用の結果票。現在0人・UNEXECUTED |
| `renri_science_adventure_2026-07-19_visual_qa.md` | 全指定viewportと画面stateのbrowser QA matrix |
| `renri_science_adventure_2026-07-19_security_privacy_review.md` | code evidence、negative tests、独立review sign-off |
| `renri_science_adventure_2026-07-19_load_failure_test.md` | 20/20/40負荷thresholdとfailure matrix、結果票 |
| `renri_science_adventure_2026-07-19_fallback_card.md` | Fallback 1–3の発動条件・案内文 |
| `renri_science_adventure_2026-07-19_qr_print_locator.md` | 同一主QR、3印刷物、実読取のlocator/checksum |
| `renri_science_adventure_2026-07-19_production_operation_manifest.md` | 別承認後のproduction deploy/event作成packet。未実行 |
| `renri_science_adventure_2026-07-19_post_deploy_verification.md` | exact SHA、health、event、QRのread-only postcheck |
| `renri_science_adventure_2026-07-19_risk_rollback.md` | risk、停止条件、staging/当日rollback |
| `renri_science_adventure_2026-07-19_test_evidence_matrix.md` | 自動、staging、実機、人間、rehearsalの証跡台帳 |
| `renri_science_adventure_2026-07-19_evidence_index.md` | Evidence Bundle locator、SHA-256、成果物index |
| `renri_science_adventure_2026-07-19_go_no_go.md` | hard gateと最終署名 |
| `renri_science_adventure_2026-07-19_post_event_review.md` | 13:00以後の結果・incident・closeout記録 |

## 3. 成功条件

### 参加者体験

- QR→参加中央値30秒以内。
- 観察開始まで3画面以内。
- QR→最初の保存2分以内。
- 家族1台、家族名・ニックネーム、位置共有なし、種名不明で進める。
- 戻る、reload、画面ロック、通信切断後も入力と写真を失わない。

### 当日運用

- 最大10組が同じQRを使う。
- 20同時check-in、20 live、40投稿/10分相当のstaging負荷契約を満たす。
- 参加組数、観察件数、失敗件数、未同期件数、最終更新を確認できる。
- Fallback 1–3へ1分以内に切り替えられる。

### Safety

- 未成年者の氏名を必須にしない。
- 位置共有は初期OFF。未成年を含む共有は保護者の明示同意が必要。
- 公開面へ正確な位置、メール、user ID、guest credentialを出さない。
- 二重tap・retryで参加者・投稿を重複させない。
- 写真保存成功を確認する前に元写真・下書きを消さない。

## 4. Release gates

次をすべて対象SHAで確認する。

1. typecheck、unit、integration、E2E、security gate。
2. staging実画像の保存、表示、集計、EXIF/GPS非露出。
3. 20同時check-in、20 live、40投稿/10分相当。
4. fixture prefix限定cleanupとD1/R2/queue残存0。
5. 指定viewport、200%、keyboard、safe areaのVisual QA。
6. iPhone SafariとAndroid Chromeの物理端末試験。
7. 人間Round 1の5人中4人以上、改善後Round 2の3人中3人。
8. fallback rehearsal、役割割当、3か所の同一QR実読取。

P0/P1、写真消失、credential/位置漏えい、cleanup残存、SHA不一致があればGOを選ばない。

## 5. Execution order

1. コードと自動gateを対象SHAで固定する。
2. command busのstaging `dry_run → deploy → verify → visual_qa` を同一SHAで実行する。
3. staging E2E、実画像、負荷、障害、cleanupを記録する。
4. 人間Round 1を行い、共通停止箇所を修正する。
5. 新しいSHAで自動・staging gateを再実行する。
6. 未使用の3人でRound 2、iPhone/Android実機、fallback rehearsalを行う。
7. 2026-07-18に機能凍結し、GO/GO WITH FALLBACK/NO-GOを署名する。
8. production operationは、GO後の別承認がある場合だけ実行する。

## 6. Approval boundary

このreadiness preparationで実施しないもの:

- production deploy
- production DB/D1/R2の直接編集
- production event session作成
- production migration
- secret、DNS、custom domain、権限変更
- 本番参加者データの参照・変更・削除
- required checkやguardrailの迂回

当日現場でもこの境界は変わらない。境界外の操作が必要になった場合はikimon.lifeを必須導線から外し、fallbackを使う。
