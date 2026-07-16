# 連理の木の下で サイエンスアドベンチャー — GO / NO-GO判定票

参加者向け開催時間: **2026-07-19（日）11:10–13:00**

判定期限: 2026-07-18 機能凍結前、および2026-07-19 10:55最終確認

状態: **NO-GO（2026-07-16 11:27 JST時点）**

## 1. 判定情報

| 項目 | 記入 |
|---|---|
| 判定 | **NO-GO** |
| 判定日時（JST） | 2026-07-16 11:27 |
| 判断責任者 | |
| 対象40文字SHA | |
| PR | |
| staging runtime SHA | `7438789b602dda50a6e7592a6d0dc33bece25763`（現行参照。対象branch SHAではない） |
| production runtime SHA | `2c4d72224ece8fe653bc1bffc4ce3ffa57b059cb`（read-only参照。今回のproduction操作なし） |
| Evidence Bundle index | |
| production反映・event作成の承認 | なし / あり（locator必須） |

この票のGOはproduction操作の承認ではない。production deploy、event作成、DB/D1/R2、secret、DNS変更は別の明示承認を必要とする。

## 2. Hard gates

すべてにevidenceがなければGOを選ばない。

| Gate | Required | Result | Evidence / Note |
|---|---|---|---|
| production公開一覧からQA eventを除外 | PASS | **FAIL** | 2026-07-16 10:36 JST、HTTP 200本文の`PR973 prod rally`は2件 |
| 公開情報が11:10–13:00で統一 | PASS | 未実施 | |
| 本番用event URLと同一QRを安全に固定可能 | PASS | 未実施 | |
| PR head、staging、verify、evidenceが同一SHA | PASS | 未実施 | |
| typecheck、unit、integration、E2E | PASS | **一部のみ実施** | local Node typecheck PASS、全1335/1335、build PASS。local Worker全265/265 PASS、`cloudflare_shadow npm run check` PASS。PHP syntax 665 files / 0 errors、deploy/migration/manifest guardrails PASS。Composer/PHPUnit toolchain不在で`composer test`はNOT RUN。E2Eはexact Renri 11件、supporting rally込み合計13件を`--list`で確認しただけで実行していない。final SHAのimmutable evidenceも未固定 |
| staging実画像R2+D1、表示、集計 | PASS | **未実施** | command bus write QA未構成、registry PR #188未merge |
| fixture cleanup残存0 | PASS | **未実施** | staging run自体を実行していない |
| guest credential・IDOR・CSRF・XSS・位置のP0/P1 0件 | PASS | **一部のみ実施 / LOCAL OBSERVED** | 独立full diff scanは36/36 files、7 candidates検証後に0 surviving formal findings。staging negative test・GPS EXIF実画像・runtime validationは未実施 |
| 写真・入力消失なし、二重送信なし | PASS | 未実施 | |
| live/recap集計一致、主催者除外 | PASS | 未実施 | |
| iPhone Safari実機 | PASS | **未実施** | |
| Android Chrome実機 | PASS | **未実施** | |
| 人間ユーザーテストRound 2 3人中3人 | PASS | **未実施（0/3）** | Round 1も0/5、合計0/8人 |
| スタッフrunbookとFallback 1–3 rehearsal | PASS | 未実施 | |

productionの公開イベント一覧をread-onlyで確認した結果、HTTP 200の本文に`PR973 prod rally`が2件残っていた。branch上の一覧除外修正はproduction未反映のため、公開QAデータ混入のhard gateはFAILのまま。production反映後のread-only再確認で0件になるまでGOへ変更しない。

command bus自体はhealth HTTP 200、executor `ready`、waiting 0、stale 0だが、`staging_write_qa_configured=false`。中央deploy registry replacement draft PR #188（head `4f2b26b5`）はlocal validator green、未merge、required `validate`はGitHub billingでjob未起動FAILである。対象SHAのstaging deploy / verify / Visual QA / 実画像 / load / cleanupを未実施のままGOへ変更しない。

## 3. 判定規則

### GO

次をすべて満たす。

- Hard gatesがすべてPASSでevidence locatorがある。
- P0/P1が0件。
- QR、当日担当、運営端末、fallback cardが確定している。
- cleanup後の残存が0で、production/staging境界が証明されている。

### GO WITH FALLBACK

写真保存、privacy、認可、QR、cleanup、SHA一致のhard gateはPASSで、次の限定的な不調だけが残る場合に選べる。

- live表示のみ
- 位置共有のみ
- recapの一部演出のみ

追加条件:

- 不調機能を当日案内から外せる。
- Fallback 1–3を担当者がrehearsal済み。
- 判断責任者が残余riskを署名して受容する。
- 人間・実機試験が未実施の場合、GOは選べない。GO WITH FALLBACKにするには、未実施理由、現地rehearsal、Fallback 2/3の即時発動条件を明記する。受容できなければNO-GO。

### NO-GO for ikimon.life mandatory use

次のどれかが1つでも残る。

- login、登録、check-inがループする。
- 写真保存の成功を確認できない、または入力・写真が失われる。
- 別家族の情報、正確な位置、guest credentialが見える。
- live/recapの件数が誤り、正しい結果を判定できない。
- QRが未確定、旧QA session、またはcredential付きである。
- productionとstagingの境界、対象SHA、fixture cleanupを証明できない。
- stale cacheで旧時刻・旧画面が残る。
- P0/P1が残る。

NO-GOはイベント自体の中止を意味しない。ikimon.lifeを必須導線から外し、Fallback 2または3で観察体験を継続する。

## 4. GO WITH FALLBACK記録

| 項目 | 記入 |
|---|---|
| 不調機能 | |
| 参加者へ見せない導線 | |
| 発動するfallback | |
| 発動判断の時刻・threshold | |
| 残余risk | |
| 受容責任者 | |
| rehearsal evidence | |

## 5. 10:55当日最終確認

| 確認 | Result | 担当 |
|---|---|---|
| 3か所QRが同一でiPhone/Android読取PASS | 未実施 | |
| 11:10–13:00表示 | 未実施 | |
| 運営端末・表示端末・予備電源 | 未実施 | |
| join、位置OFF、写真、live、recap | 未実施 | |
| 失敗・未同期件数が判断可能 | 未実施 | |
| fallback cardと紙を配置 | 未実施 | |
| 役割と代行を割当 | 未実施 | |

## 6. Sign-off

| 役割 | 氏名または運営ID | 判定 | 時刻 |
|---|---|---|---|
| 判断責任者 | | | |
| ikimon担当 | | | |
| 進行担当 | | | |

現在判定: **NO-GO**

最終sign-off: **UNEXECUTED**
