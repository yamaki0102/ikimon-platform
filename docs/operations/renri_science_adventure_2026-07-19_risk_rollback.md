# 連理の木の下で サイエンスアドベンチャー — risk register / rollback

更新日: 2026-07-16

適用範囲: staging検証、当日運用、GO判定

production境界: production deploy・DB/D1/R2直接変更・event作成・secret/DNS変更はこの文書で承認しない

## 1. Risk register

| ID | Risk | 検知・停止条件 | 予防 | 当日回復 / rollback | 状態 |
|---|---|---|---|---|---|
| R01 | 13:40が参加者向け終了として再混入 | 公開UI、JSON-LD、QR、recap、資料のいずれかが13:40 | canonicalを11:10–13:00へ固定 | 掲示を止め、11:10–13:00版だけを再確認。runtime値は現場で直接編集しない | Open |
| R02 | QRが別session・旧QA・credential付きURLを指す | host/event code不一致、queryにtoken等 | 3枚を同一masterから印刷、実機2系統で読取 | QR案内を停止し、確定URLをスタッフが直接開く。未確定ならFallback 3 | Open |
| R03 | guest credential漏えい | URL、HTML、storage、log、公開APIへ値が出る | event別HttpOnly cookie、same-origin、公開payload除去 | ikimon利用を停止しFallback 3。値を転載せずsecurity incidentとして保全 | Open |
| R04 | 未成年者の正確な位置共有 | 明示保護者同意なしで保存・公開 | 位置初期OFF、サーバー側fail-closed | 位置案内を停止しFallback 1。公開露出ならFallback 3 | Open |
| R05 | 写真または入力消失 | 失敗・timeout・reload後に元写真/下書きへ戻れない | 成功確定前に下書きを消さない、冪等性、実機障害試験 | 直ちにFallback 2。端末の元写真を保持 | Open |
| R06 | check-in/登録ループ | 2分超、同じ画面を3回以上往復 | return先・draft復帰をE2E/人間試験 | スタッフ支援1回後Fallback 2または3 | Open |
| R07 | 二重参加・二重投稿 | 同じ端末・submission IDで2件以上 | server-side idempotency、二重tap試験 | 再送を止め、数値を手編集しない。重複はincidentへ記録 | Open |
| R08 | live/recap集計不一致 | 参加組数・観察件数が一致しない | 同一定義、主催者除外、同一SHAテスト | live案内を止めFallback 1。recapを確定成果として読まない | Open |
| R09 | stale Service Worker / cache | 旧時刻・旧UI・旧URLが残る | 更新試験、runtime SHA照合 | 外部browserへ移動。解消しなければQR案内停止 | Open |
| R10 | 会場通信不良 | 複数端末でtimeout、未同期増加 | 予備回線、写真端末保持、負荷試験 | Fallback 2。全端末の一斉retry禁止 | Open |
| R11 | staging fixture残存・越境 | cleanup後D1/R2/queueが0でない、production binding検出 | run prefixと環境guard、inventory前後取得 | GO禁止。prefix限定cleanupを別手順で行い、推測削除しない | Open |
| R12 | staging SHA不一致 | PR head、deploy、verify、evidence SHAが不一致 | 40文字SHA固定、command bus直列実行 | 古いevidenceを破棄し、正しいSHAで全gateを再実行 | Open |
| R13 | 人間/実機試験不足 | Round 2またはiPhone/Androidが未実施 | 7/18までに端末・被験者・担当を確保 | GOは選ばない。責任者受容とFallback 2/3 rehearsalがある場合のみGO WITH FALLBACK候補 | Open |
| R14 | 運営端末・担当不在 | 10:25時点で担当、電源、回線がない | 役割と代行を事前割当 | ikimonを必須から外しFallback 3 | Open |
| R15 | 天候・熱中症等の現地安全 | フィールド担当が危険と判断 | 現地主催者の安全計画を優先 | Web運用判断より現地安全判断を優先し、進行を停止・変更 | Open |

状態は `Open / Mitigated / Accepted / Closed` のいずれか。`Accepted`には責任者、期限、fallbackを必須とする。

## 2. rollback原則

1. **参加者の写真を守る。** 保存成功が不明なら端末の元写真を削除させない。
2. **データを推測で直さない。** 当日現場でDB行・R2 object・参加者データを削除・更新しない。
3. **演出から落とす。** live/位置/recap演出の順に外し、観察体験を継続する。
4. **同一SHAに戻す。** staging software rollbackが必要な場合は、承認済みmanifestの既知のSHAだけをcommand busで指定する。GitHub Actions、任意shell、手動SSHへ迂回しない。
5. **productionには触れない。** 本作業でproduction反映がないため、production rollbackを実行しない。

## 3. Staging software rollback template

この節は再現可能な手順の記録欄であり、実行済みではない。

| 項目 | 値 |
|---|---|
| bad SHA | 未記入 |
| last known good SHA | 未記入 |
| command bus issue | 未記入 |
| rollback actionのmanifest support | 未確認 |
| 実行承認者 | 未記入 |
| health/verify evidence | 未記入 |
| fixture inventory before/after | 未記入 |

last known good SHA、manifest support、staging bindingの3点を証明できない場合はrollbackを実行せず、staging利用を止めて原因調査へ移る。

## 4. 当日operational rollback

| 段階 | 残すもの | 外すもの | 復帰条件 |
|---|---|---|---|
| Normal | join、写真、live、recap | なし | — |
| Fallback 1 | join、写真 | 不調なlive/位置/recap演出 | 1端末検証と責任者判断 |
| Fallback 2 | 端末の写真、現地体験 | online投稿を必須にする案内 | 保存成功とprivacy確認 |
| Fallback 3 | 現地体験、紙の発見数 | ikimon.lifeの必須導線 | 原因特定後。イベント中の無理な復帰は不要 |

## 5. Close条件

- R01–R14にownerと最終状態がある。
- P0/P1に相当するR02–R08、R11、R12がClosedまたは明示的なNO-GO。
- fallback rehearsalの実施時刻と担当がevidence matrixへ記録される。
- production操作を行っていないことを最終報告へ明記する。
