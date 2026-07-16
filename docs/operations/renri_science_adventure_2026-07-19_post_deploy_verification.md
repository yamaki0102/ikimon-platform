# 連理の木の下で サイエンスアドベンチャー — Post-deploy Verification

更新日: 2026-07-16

状態: **TEMPLATE / staging deploy NOT EXECUTED / production NOT EXECUTED**

このchecklistは、別途承認済みのdeploy/event operation後に使う。productionへsynthetic participant、写真、fixtureを作成しない。本タスクの実行記録ではない。

2026-07-16時点のread-only snapshot:

- staging runtime: `7438789b602dda50a6e7592a6d0dc33bece25763`（今回の対象branch SHAではない）
- production runtime: `2c4d72224ece8fe653bc1bffc4ce3ffa57b059cb`（今回のproduction操作なし）
- production公開一覧: 2026-07-16 10:36 JST HTTP 200、`PR973 prod rally` 2件
- `RENRI0719` by-code: production 404、staging 404
- command bus: health HTTP 200、executor `ready`、waiting 0、stale 0、`staging_write_qa_configured=false`
- 中央deploy registry replacement: draft PR #188、head `4f2b26b5`、local validator green、未merge、required `validate`はGitHub billingでjob未起動FAIL

上記は既存runtimeのread-only参照であり、post-deploy PASS evidenceではない。対象SHAのstaging deploy / verify / Visual QA / 実画像 / load / cleanupはUNEXECUTEDである。

## 1. Deployment identity

| Field | Value |
|---|---|
| environment | staging / production |
| exact 40-char source SHA | 未記入 |
| runtime SHA | 未記入 |
| current staging runtime reference | `7438789b602dda50a6e7592a6d0dc33bece25763`（targetではない） |
| current production runtime reference | `2c4d72224ece8fe653bc1bffc4ce3ffa57b059cb`（今回のoperationなし） |
| deploy command-bus Issue | 未記入 |
| verify Issue | 未記入 |
| deploy completed JST | 未記入 |
| verifier | 未記入 |
| overall | **UNEXECUTED** |

source SHA、runtime SHA、Issue body、Evidence Bundle SHAが1文字でも違えば停止する。

## 2. Health / readiness — read-only

```powershell
curl.exe --fail-with-body --dump-header "<EVIDENCE_PATH>\healthz.headers.txt" --output "<EVIDENCE_PATH>\healthz.json" "https://ikimon.life/healthz"
curl.exe --fail-with-body --dump-header "<EVIDENCE_PATH>\readyz.headers.txt" --output "<EVIDENCE_PATH>\readyz.json" "https://ikimon.life/readyz"
```

| Check | Expected | Result | Evidence |
|---|---|---|---|
| `/healthz` | 200、target service healthy | UNEXECUTED | |
| `/readyz` | 200、required bindings ready | UNEXECUTED | |
| runtime SHA | approved exact SHA | UNEXECUTED | |
| staging route isolation | production Workerがstaging routeを所有しない | UNEXECUTED | |

## 3. Public event metadata — read-only

```powershell
curl.exe --fail-with-body --output "<EVIDENCE_PATH>\event-by-code.json" "https://ikimon.life/api/v1/observation-events/by-code/RENRI0719"
curl.exe --fail-with-body --output "<EVIDENCE_PATH>\join.html" "https://ikimon.life/community/events/RENRI0719/join"
```

| Check | Expected | Result |
|---|---|---|
| event title | canonical exact title | UNEXECUTED |
| start/end | 2026-07-19 11:10–13:00 JST | UNEXECUTED |
| parent field | verified existing field ID/revision/hash | UNEXECUTED |
| event code | one session only, `RENRI0719` | UNEXECUTED |
| public UI / JSON-LD | 11:10–13:00、参加費500円、最大10組、受付終了 | UNEXECUTED |
| participant surface | 13:40を終了時刻として表示しない | UNEXECUTED |
| URL privacy | query/token/user ID/coordinateなし | UNEXECUTED |

## 4. Event pages — read-only

`<SESSION_ID>`はby-code responseから取得する。値をhard-codeせず、evidenceへsession IDだけを記録する。

```powershell
curl.exe --fail-with-body --output "<EVIDENCE_PATH>\rally.html" "https://ikimon.life/events/<SESSION_ID>/rally"
curl.exe --fail-with-body --output "<EVIDENCE_PATH>\live.html" "https://ikimon.life/events/<SESSION_ID>/live"
curl.exe --fail-with-body --output "<EVIDENCE_PATH>\recap.html" "https://ikimon.life/events/<SESSION_ID>/recap"
```

| Page | Expected | Result |
|---|---|---|
| join | 家族1台、写真だけ可、位置OFF、参加CTA | UNEXECUTED |
| rally | 写真を残す主CTA、live/recap、技術語なし | UNEXECUTED |
| live | 個人情報・exact locationなし、更新時刻あり | UNEXECUTED |
| recap | 家族数・観察数・種類・写真・次のヒント | UNEXECUTED |
| same QR after end | server-side recap resolution | UNEXECUTED |

公開pageの取得はparticipant check-inや観察投稿を行わない。認証が必要な運営画面は承認済み担当者が本人操作し、cookieや2FAをevidenceへ残さない。

## 5. Cache / security headers

| Check | Expected | Result | Evidence |
|---|---|---|---|
| CSP | nonce-based、unsafe dynamic dataなし | UNEXECUTED | |
| cookie | Secure/HttpOnly/SameSite、URLへ値なし | UNEXECUTED | |
| cache | participant-sensitive responseはno-store | UNEXECUTED | |
| old Service Worker | 現行UIへ更新 | UNEXECUTED | |
| public payload | actor ID/guest digest/exact coordinateなし | UNEXECUTED | |

## 6. QR and physical verification

`renri_science_adventure_2026-07-19_qr_print_locator.md`の同一master checksumを使う。

| Check | Result |
|---|---|
| reception/staff/startの3 assetが同じURL | UNEXECUTED |
| iPhone standard camera | UNEXECUTED |
| Android standard camera | UNEXECUTED |
| join到達とevent code声出し照合 | UNEXECUTED |
| token/queryなし | UNEXECUTED |

## 7. Analytics / operations dashboard

| Check | Expected | Result |
|---|---|---|
| 16 event registry only | specと一致 | UNEXECUTED |
| forbidden PII | 0 | UNEXECUTED |
| family/observation counter | canonical定義 | UNEXECUTED |
| failed/unsynced/updated/live delay/recap state | 表示可能 | UNEXECUTED |

productionで検証用check-inや写真を作らず、analyticsのwrite verificationはstaging evidenceを用いる。当日は実参加者dataをこのEvidence Bundleへ抽出しない。

## 8. Stop / rollback decision

次のどれかがあればGOへ進まず、`renri_science_adventure_2026-07-19_risk_rollback.md`と`renri_science_adventure_2026-07-19_fallback_card.md`へ移る。

- health/readyまたはruntime SHA不一致
- participant時間が11:10–13:00でない
- duplicate event code / wrong parent field
- credential、他家族情報、exact location露出
- stale UI、join loop、写真消失の疑い
- rollback targetやdata compatibilityが不明

## 9. Sign-off

| Role | Name/ID | Result | JST | Evidence index |
|---|---|---|---|---|
| deploy operator | | UNEXECUTED | | |
| independent verifier | | UNEXECUTED | | |
| event owner | | UNEXECUTED | | |

Final: **UNEXECUTED — production operation not authorized in this task**
