# 連理の木の下で サイエンスアドベンチャー — Browser / Viewport Visual QA Matrix

更新日: 2026-07-16

状態: **全項目UNEXECUTED**

対象はstagingへ配置された同一40文字SHA。local HTMLや古いstaging screenshotを最終evidenceへ流用しない。browser emulationは物理端末試験を代替しない。

2026-07-16時点で現staging runtimeは`7438789b602dda50a6e7592a6d0dc33bece25763`であり、対象branch SHAではない。command bus healthはHTTP 200 / executor `ready` / waiting 0 / stale 0だが、`staging_write_qa_configured=false`。中央deploy registry replacement draft PR #188（head `4f2b26b5`）はlocal validator green、未merge、required `validate`はGitHub billingでjob未起動FAILのため、対象SHAのdeploy / verify / Visual QAを開始していない。

Playwright staging journeyはexact Renri spec 11 tests（supporting rally spec込み合計13 tests）を`--list`で列挙しただけで、browser実行、screenshot取得、目視reviewはすべてUNEXECUTEDである。

## 1. Viewports

| ID | Viewport | 想定 | Result |
|---|---:|---|---|
| V01 | 320×568 | small mobile | **UNEXECUTED** |
| V02 | 360×800 | Android narrow | **UNEXECUTED** |
| V03 | 375×667 | iPhone compact | **UNEXECUTED** |
| V04 | 390×844 | modern iPhone | **UNEXECUTED** |
| V05 | 393×852 | modern mobile | **UNEXECUTED** |
| V06 | 412×915 | Android large | **UNEXECUTED** |
| V07 | 768×1024 portrait | tablet portrait representative | **UNEXECUTED** |
| V08 | 1440×900 | operations PC representative | **UNEXECUTED** |

## 2. State groups

| ID | Page / state | Required checks |
|---|---|---|
| S01 | join default | 家族1台・写真だけでよい・11:10–13:00が上部、位置OFF、主CTA可視 |
| S02 | join validation | family name error、未成年+位置同意error、入力保持、色以外のerror表現 |
| S03 | check-in pending / double tap | processing表示、二重tap防止、固定UI重なりなし |
| S04 | check-in 4xx/503/timeout | 入力保持、再試行、成功との視覚区別 |
| S05 | rally guest / signed-in | 写真を残す主CTA、live/recap、技術語やtokenなし |
| S06 | registration transition / return | event contextとdraft復元、loopなし |
| S07 | record camera allow/deny / file select | camera拒否後も写真選択可、名前不明で継続 |
| S08 | record draft / upload / success / failure / offline | 写真保持、processingと保存成功を混同しない、retry可 |
| S09 | live loading / empty / populated / reconnect | 自分と会場全体の区別、更新時刻、件数、横scrollなし |
| S10 | recap loading / ready / failed / same-QR revisit | 家族数、観察数、種類、写真、次のヒント、13:00終了 |
| S11 | old Service Worker / cache update | 旧時刻・旧UIに固定されない |
| S12 | keyboard / focus / 200% text | CTA操作可、focus visible、label、56px前後のtouch target |
| S13 | safe area / landscape perturbation | notch・browser bar・fixed UI重なり、button見切れなし |

## 3. Coverage matrix

`U` はUNEXECUTED。各cellはstate group内の全sub-stateを実行し、1つでも未確認ならPASSにしない。

| Viewport | S01 | S02 | S03 | S04 | S05 | S06 | S07 | S08 | S09 | S10 | S11 | S12 | S13 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| V01 | U | U | U | U | U | U | U | U | U | U | U | U | U |
| V02 | U | U | U | U | U | U | U | U | U | U | U | U | U |
| V03 | U | U | U | U | U | U | U | U | U | U | U | U | U |
| V04 | U | U | U | U | U | U | U | U | U | U | U | U | U |
| V05 | U | U | U | U | U | U | U | U | U | U | U | U | U |
| V06 | U | U | U | U | U | U | U | U | U | U | U | U | U |
| V07 | U | U | U | U | U | U | U | U | U | U | U | U | U |
| V08 | U | U | U | U | U | U | U | U | U | U | U | U | U |

## 4. Checks required in every applicable cell

- horizontal overflowが0。
- sticky/fixed CTA、browser chrome、keyboard、safe areaが重ならない。
- primary buttonの全文と状態が見える。
- text 200%で情報・操作が欠落しない。
- keyboardだけで順序、focus、submit、error復帰が可能。
- screen reader labelとvisible labelの意味が一致。
- errorを色だけで示さない。
- screenshotにtoken、メール、座標、画像名、実参加者dataがない。

## 5. Evidence record

| Field | Value |
|---|---|
| target SHA | 未固定（対象branchは未commit） |
| staging runtime SHA | `7438789b602dda50a6e7592a6d0dc33bece25763`（対象branch SHAではない） |
| browser / version | 未記入 |
| Playwright report locator | 未記入 |
| screenshot index locator | 未記入 |
| command-bus Issue | 対象SHAのIssueなし。registry replacement draft PR #188は未merge |
| executed at JST | 未記入 |
| reviewer | 未記入 |
| overall | **UNEXECUTED** |
| blocker | `staging_write_qa_configured=false`、registry PR #188未merge / required validate job未起動FAIL |

大容量screenshot/video/reportはGitへ置かず、`renri_science_adventure_2026-07-19_evidence_index.md` から外部Evidence BundleのlocatorとSHA-256を参照する。
