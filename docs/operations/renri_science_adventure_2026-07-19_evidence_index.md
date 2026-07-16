# 連理の木の下で サイエンスアドベンチャー — Evidence Bundle Index

更新日: 2026-07-16

状態: **INDEX TEMPLATE / local Node・Worker・security diff scanを観測、runtime evidence UNEXECUTED**

大容量screenshot、video、Playwright report、raw HTTP log、実画像fixtureはGitへ入れない。このindexとGit commitはlocator・hash・判定だけを保持する。

## 1. Bundle identity

| Field | Value |
|---|---|
| bundle ID | `renri-final-readiness-<SHA8>-<YYYYMMDDTHHMMSSJST>` |
| exact 40-char SHA | 未記入 |
| branch / PR | 未記入 |
| staging runtime SHA | `7438789b602dda50a6e7592a6d0dc33bece25763`（現行参照。対象branch SHAではない） |
| production runtime SHA | `2c4d72224ece8fe653bc1bffc4ce3ffa57b059cb`（read-only参照。今回のproduction操作なし） |
| production operation | **NOT AUTHORIZED / NOT EXECUTED** |
| bundle storage locator | 未記入 |
| index generated JST | 未記入 |
| verifier | 未記入 |
| `sha256sums.txt` SHA-256 | 未記入 |

## 2. Evidence inventory

| ID | Category | Required artifact | Status | Locator | SHA-256 |
|---|---|---|---|---|---|
| E01 | source | PR, base/head/merge-base, changed file list | UNEXECUTED | | |
| E02 | review | external review raw + adoption log | LOCAL OBSERVED | Gemini 3.5 FlashとGemini 3.1 Flash-Liteの2 review。いずれもNO-GO。採否は中央review adoption logへ記録 | |
| E03 | tests | typecheck/unit/integration logs | PARTIAL / LOCAL OBSERVED | Node typecheck・全1335/1335・build PASS、Worker全265/265・`cloudflare_shadow npm run check` PASS、npm audit 0、PHP syntax 665 files / 0 errors、deploy/migration/manifest guardrails PASS。Composer/PHPUnit toolchain不在のため`composer test`はNOT RUN。final SHA / bundle log未固定 | |
| E04 | security | independent review + negative test report | LOCAL OBSERVED / STAGING UNEXECUTED | Codex Security scan ID `ce3d8f70e2fda2be116429d95266a5da2a4abb16_20260716T001859Z`。36 files、7 candidates、0 surviving formal findings。staging negative test・実画像EXIFは未実施 | |
| E05 | command bus | final SHA dry-run Issue/result | BLOCKED / UNEXECUTED | registry replacement draft PR #188（head `4f2b26b5`、未merge） | |
| E06 | command bus | final SHA staging deploy Issue/result | BLOCKED / UNEXECUTED | `staging_write_qa_configured=false` | |
| E07 | command bus | final SHA verify Issue/result | BLOCKED / UNEXECUTED | 対象SHA deploy未実施 | |
| E08 | Visual QA | all viewport/state report | BLOCKED / UNEXECUTED | 対象SHA deploy未実施 | |
| E09 | browser E2E | journey report/video/screenshots | UNEXECUTED | exact Renri spec 11 tests、supporting rally specを含む合計13 testsを`--list`で確認。test runなし | |
| E10 | image | real synthetic image R2/D1/derivative/EXIF proof | UNEXECUTED | | |
| E11 | load | 20/20/40 load JSON + metrics | UNEXECUTED | | |
| E12 | failure | F01–F18 results | UNEXECUTED | | |
| E13 | cleanup | D1/R2/queue inventory before/after = 0 | UNEXECUTED | | |
| E14 | physical | iPhone Safari result | UNEXECUTED | | |
| E15 | physical | Android Chrome result | UNEXECUTED | | |
| E16 | human | Round 1 result | UNEXECUTED | | |
| E17 | human | Round 2 result | UNEXECUTED | | |
| E18 | operations | fallback rehearsal / role assignment | UNEXECUTED | | |
| E19 | QR | master QR + 3 print outputs + scan results | UNEXECUTED | | |
| E20 | decision | signed GO / GO WITH FALLBACK / NO-GO | CURRENT NO-GO / SIGN-OFF UNEXECUTED | `renri_science_adventure_2026-07-19_go_no_go.md` | |
| E21 | production | deploy/event/verify evidence | **NOT AUTHORIZED / NOT EXECUTED** | | |

Command bus Issues #146, #148, #149, #150はSHA `7438789b602dda50a6e7592a6d0dc33bece25763`のhistorical staging evidenceであり、最終SHAのE05–E08へ流用しない。#150はfailedである。

2026-07-16時点のcommand bus healthはHTTP 200、executor `ready`、waiting 0、stale 0。ただし`staging_write_qa_configured=false`。中央registry replacement draft PR #188はlocal validator greenだが未mergeで、required `validate`はGitHub billingによりjob未起動FAIL。staging deploy / verify / Visual QA / 実画像 / load / cleanupはUNEXECUTEDである。

## 3. Repository document index

| Deliverable | Locator |
|---|---|
| readiness | `renri_science_adventure_2026-07-19_readiness.md` |
| canonical metadata | `renri_science_adventure_2026-07-19_event_canonical.md` |
| participant guide | `renri_science_adventure_2026-07-19_participant_guide.md` |
| participant journey | `renri_science_adventure_2026-07-19_participant_journey.md` |
| analytics/dashboard | `renri_science_adventure_2026-07-19_analytics_dashboard.md` |
| user-test script | `renri_science_adventure_2026-07-19_user_test.md` |
| user-test result | `renri_science_adventure_2026-07-19_user_test_results.md` |
| device checklist | `renri_science_adventure_2026-07-19_device_checklist.md` |
| real-device result | `renri_science_adventure_2026-07-19_real_device_results.md` |
| Visual QA | `renri_science_adventure_2026-07-19_visual_qa.md` |
| security/privacy | `renri_science_adventure_2026-07-19_security_privacy_review.md` |
| load/failure | `renri_science_adventure_2026-07-19_load_failure_test.md` |
| test matrix | `renri_science_adventure_2026-07-19_test_evidence_matrix.md` |
| staff runbook | `renri_science_adventure_2026-07-19_staff_runbook.md` |
| fallback card | `renri_science_adventure_2026-07-19_fallback_card.md` |
| QR/print locator | `renri_science_adventure_2026-07-19_qr_print_locator.md` |
| production operation manifest | `renri_science_adventure_2026-07-19_production_operation_manifest.md` |
| post-deploy verification | `renri_science_adventure_2026-07-19_post_deploy_verification.md` |
| risk / rollback | `renri_science_adventure_2026-07-19_risk_rollback.md` |
| GO / NO-GO | `renri_science_adventure_2026-07-19_go_no_go.md` |
| post-event review | `renri_science_adventure_2026-07-19_post_event_review.md` |
| Evidence Bundle index | `renri_science_adventure_2026-07-19_evidence_index.md`（this file） |

## 4. Checksum generation

Evidence Bundleへsecretや個人情報がないことをreviewしてから、repo外bundle rootで実行する。

```powershell
$root = Resolve-Path "<ABSOLUTE_EVIDENCE_BUNDLE_PATH>"
Get-ChildItem -LiteralPath $root -File -Recurse |
  Where-Object { $_.Name -ne 'sha256sums.txt' } |
  Sort-Object FullName |
  ForEach-Object {
    $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName
    "{0}  {1}" -f $hash.Hash.ToLowerInvariant(), $_.FullName.Substring($root.Path.Length + 1).Replace('\\','/')
  } | Set-Content -Encoding utf8 -LiteralPath (Join-Path $root 'sha256sums.txt')
Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $root 'sha256sums.txt')
```

`sha256sums.txt`自体のhashをこのindex、PR、GO票へ転記する。artifactを差し替えたらbundle IDを変えるかchecksumsを再生成し、古いhashを残さない。

## 5. Privacy review before acceptance

次をbundle全体で確認する。

- cookie、Authorization、API key、email、password、guest credentialがない。
- 本名、家族名、正確な座標、IP、写真ファイル名、自由記述がない。
- browser screenshotはsynthetic fixtureのみ。
- raw responseが必要な場合はprivate restricted locatorへ置き、このindexはredacted summaryだけを参照する。
- artifactのSHAとruntime SHAを混同しない。

## 6. Final acceptance

| Gate | Value |
|---|---|
| all required E01–E20 accounted for | UNEXECUTED |
| checksum verified by second reader | UNEXECUTED |
| forbidden data scan | UNEXECUTED |
| exact SHA consistency | UNEXECUTED |
| decision | **NO-GO** |
