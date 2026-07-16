# 連理の木の下で サイエンスアドベンチャー — Human User-test Results

更新日: 2026-07-16

Overall: **UNEXECUTED（Round 1 / Round 2とも未実施）**

facilitator script、task、stop conditionは`renri_science_adventure_2026-07-19_user_test.md`を使う。この結果票へAI agent、Playwright、browser automationを参加人数として記録しない。

## 1. Target and consent

| Field | Value |
|---|---|
| exact 40-char SHA | 未記入 |
| staging runtime SHA | 未記入 |
| staging URL | 未記入 |
| test image fixture | 未記入 |
| facilitator / observer | 未割当 |
| consent explanation version | 未記入 |
| recording retention / locator | 未記入 |

個人名を記録せず匿名IDだけを使う。メール、password、写真内容、正確な位置、credentialを結果票へ入れない。

## 2. Round 1 results

| ID | Profile | Device/browser | Join seconds | Save seconds | No-help completion | Stop point / assist | Result |
|---|---|---|---:|---:|---|---|---|
| R1-P01 | smartphone-comfortable parent equivalent | 未記入 | | | | | **UNEXECUTED** |
| R1-P02 | smartphone-comfortable parent equivalent | 未記入 | | | | | **UNEXECUTED** |
| R1-P03 | general smartphone user | 未記入 | | | | | **UNEXECUTED** |
| R1-P04 | general smartphone user | 未記入 | | | | | **UNEXECUTED** |
| R1-P05 | less-confident smartphone user | 未記入 | | | | | **UNEXECUTED** |

| Round 1 metric | Required | Actual |
|---|---:|---:|
| participants executed | 5 | 0 |
| no-help main task completion | 4/5以上 | 0 / UNEXECUTED |
| median QR→join | 30秒以内 | 未計測 |
| QR→first save | 2分以内 | 未計測 |
| same stop point | 2人未満 | 未計測 |

## 3. Improvement decision

| Pattern | Affected count | Root cause | UI/state change | SHA | Verification |
|---|---:|---|---|---|---|
| UNEXECUTED | 0 | | | | |

メール、password条件、確認メール、登録後のreturn、draft消失で2人以上が失敗した場合は、説明文追加だけで閉じず、登録flowの簡略化または安全なfallbackを判断する。

## 4. Round 2 results

Round 1に参加していない3人を使う。

| ID | Device/browser | QR→join | Photo save | Live | Recap | Oral assist | Result |
|---|---|---|---|---|---|---:|---|
| R2-P01 | 未記入 | UNEXECUTED | UNEXECUTED | UNEXECUTED | UNEXECUTED | | **UNEXECUTED** |
| R2-P02 | 未記入 | UNEXECUTED | UNEXECUTED | UNEXECUTED | UNEXECUTED | | **UNEXECUTED** |
| R2-P03 | 未記入 | UNEXECUTED | UNEXECUTED | UNEXECUTED | UNEXECUTED | | **UNEXECUTED** |

合格は3人中3人が、口頭介助なしで4 taskすべてを完了した場合だけ。

## 5. Final result

| Field | Value |
|---|---|
| Round 1 | **0/5 executed — UNEXECUTED** |
| Round 2 | **0/3 executed — UNEXECUTED** |
| guest vs registration decision | 未判定 |
| open P0/P1 from human test | 未集計 |
| Evidence locator / SHA-256 | 未記入 |
| GO gate | **FAIL-CLOSED: human evidenceなし** |

人間テスターを確保できない場合は未実施のままGO票へ引き継ぐ。AI操作でPASSへ変更しない。
