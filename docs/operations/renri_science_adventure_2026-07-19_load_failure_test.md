# 連理の木の下で サイエンスアドベンチャー — Load / Failure Test Plan and Result

更新日: 2026-07-16

状態: **script contract・dry-run plan確認済み、staging実負荷はUNEXECUTED**

production mutation: **禁止**

## 1. Source and target guard

- runner: `platform_v2/cloudflare_shadow/scripts/run-renri-event-load-check.mjs`
- contract test: `platform_v2/cloudflare_shadow/src/renriEventLoadContract.test.ts`
- 許可target: `https://staging.ikimon.life`。localは明示的なlocal override時だけ。
- 禁止target: `https://ikimon.life`、`https://www.ikimon.life`、production D1/R2/Queue。
- fixture prefix: `renri-e2e-load-<timestamp>-<uuid>`。prefix外cleanupを禁止する。

staging write binding、target SHA、cleanup endpoint、Evidence Bundle保存先を確認できない場合はexecuteしない。

2026-07-16時点のcommand busはhealth HTTP 200、executor `ready`、waiting 0、stale 0だが、`staging_write_qa_configured=false`。中央deploy registry replacement draft PR #188（head `4f2b26b5`）はlocal validator green、未mergeで、required `validate`はGitHub billingによりjob未起動FAIL。このためdry-run planより先のstaging実負荷・実画像・cleanupは実行していない。

## 2. Capacity and thresholds

runner sourceと一致する正本値:

| Metric | Required |
|---|---:|
| participant sessions | 20 |
| concurrent check-ins | 20 |
| concurrent live viewers | 20 |
| photo posts | 40 / 600秒 |
| success rate | 100% |
| HTTP 429 | 0 |
| HTTP 5xx | 0 |
| check-in p95 | 2,000ms以下 |
| photo post p95 | 8,000ms以下 |
| unique participant count | 20 |
| recap observation count | 40 |
| cleanup inventory | 全resource 0 |

40件の写真投稿は600秒に均等配置する。20件同時uploadと読み替えない。

## 3. Commands

以下はworktree rootを起点にする。secret値をcommand history、log、evidenceへ出さない。

```powershell
Set-Location platform_v2/cloudflare_shadow
npm exec -- tsx --test src/renriEventLoadContract.test.ts
node scripts/run-renri-event-load-check.mjs --duration-seconds=600
```

staging executeは、承認済みwrite credentialとrepo外Evidence Bundle pathが安全に環境変数へ設定済みの場合だけ行う。

```powershell
Set-Location platform_v2/cloudflare_shadow
$env:STAGING_BASE_URL = "https://staging.ikimon.life"
$env:RENRI_EVIDENCE_PATH = "<ABSOLUTE_EVIDENCE_BUNDLE_PATH>\load\result.json"
# V2_PRIVILEGED_WRITE_API_KEY は安全な既存secret sourceからprocess環境へ設定する。値を表示しない。
node scripts/run-renri-event-load-check.mjs --execute --base-url=https://staging.ikimon.life --duration-seconds=600 --evidence=$env:RENRI_EVIDENCE_PATH
```

`RENRI_LOAD_ALLOW_LOCAL` と `RENRI_LOAD_ALLOW_SHORT` はlocal development専用であり、最終staging evidenceでは使わない。

## 4. Automated flow covered by runner

1. prefix inventoryが0であることを確認。
2. organizerと20 participantの専用sessionを発行。
3. 非公開QA eventを作成。
4. 20件を同時check-inし、participant ID重複・欠損を拒否。
5. 同一端末check-in retryが同じparticipant IDになることを確認。
6. 600秒で40観察と40 tiny-PNG uploadを送る。
7. 同一observation / client submission IDを再送。
8. liveを20並列閲覧。
9. recapの観察件数が40であることを確認。
10. prefix限定cleanup後、inventory全項目0を必須化。

tiny PNGの成功は実写真・EXIF検証を代替しない。実画像R2/D1確認は別のstaging E2E evidenceを必要とする。

## 5. Failure matrix

runner単体でfault injectionを実装していない項目は、実施済み扱いにしない。

| ID | Scenario | Expected | Method / Evidence | Result |
|---|---|---|---|---|
| F01 | check-in 503 | 入力保持、成功表示なし、retry可能 | browser route fault injection | **UNEXECUTED** |
| F02 | observation 500 | 写真・draft保持、retry上限表示 | browser/API fault injection | **UNEXECUTED** |
| F03 | observation 503 | 同上、retry stormなし | browser/API fault injection | **UNEXECUTED** |
| F04 | submit timeout | 状態不明を成功扱いせず、同じidempotency keyで確認 | network abort | **UNEXECUTED** |
| F05 | upload途中切断 | 元写真保持、孤児assetなし | request abort + D1/R2 inventory | **UNEXECUTED** |
| F06 | offline→online | durable queueがある場合だけ未同期表示、復帰後1件 | browser offline toggle | **UNEXECUTED** |
| F07 | recap集計中の追加投稿 | live/recap最終件数一致 | controlled concurrent request | **UNEXECUTED** |
| F08 | 終了直前/直後投稿 | server timeで境界判定 | fake clock / dedicated fixture | **UNEXECUTED** |
| F09 | cleanupと集計の競合 | prefix外無変更、残存0、誤集計なし | staging fixture inventory | **UNEXECUTED** |
| F10 | stale Service Worker | 現行event UIへ更新、旧時刻なし | old build → update | **UNEXECUTED** |
| F11 | browser back / reload | event、参加名、位置選択、draft保持 | browser history + reload | **UNEXECUTED** |
| F12 | screen lock / tab switch | 復帰後draft保持、重複送信なし | 物理端末。browser emulationで代替PASS禁止 | **UNEXECUTED** |
| F13 | in-app browser→Safari/Chrome | safe redirect、event context保持、token URLなし | 物理端末 | **UNEXECUTED** |
| F14 | camera / location permission denial | 写真選択・位置OFFで継続 | browser permission + physical device | **UNEXECUTED** |
| F15 | browser storage不足 | 成功を偽装せず、元写真保持とfallback案内 | quota exhaustion | **UNEXECUTED** |
| F16 | 同じbutton連打 | check-in/submit 1件、状態が破綻しない | rapid double click | **UNEXECUTED** |
| F17 | 同一写真・submission再送 | 観察/asset重複なし、retry結果を返す | same payload/key replay | **UNEXECUTED** |
| F18 | retry storm | bounded retry、429/5xxを増幅しない | controlled multi-client fault | **UNEXECUTED** |

## 6. Result record

| Field | Value |
|---|---|
| 40文字SHA | 未記入 |
| staging runtime SHA | `7438789b602dda50a6e7592a6d0dc33bece25763`（現行参照。対象branch SHAではない） |
| started / finished JST | 未記入 |
| runner | dry-run planのみ確認。`--execute`は未実行 |
| fixture prefix | 未記入 |
| requests / successful | 未記入 |
| 429 / 5xx | 未記入 |
| check-in p95 | 未記入 |
| photo post p95 | 未記入 |
| participant count | 未記入 |
| observation count | 未記入 |
| cleanup inventory | 未記入 |
| Evidence locator / SHA-256 | 未記入 |
| Overall | **UNEXECUTED** |

Overall PASSには、全threshold達成とcleanup 0の両方が必要。primary flowが成功してもcleanup failureならFAILとする。
