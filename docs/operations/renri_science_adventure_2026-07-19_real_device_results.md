# 連理の木の下で サイエンスアドベンチャー — Real-device Test Results

更新日: 2026-07-16

参加者向け時間: **11:10–13:00**

Overall: **UNEXECUTED（未実施）**

この文書は物理端末の結果専用。手順は`renri_science_adventure_2026-07-19_device_checklist.md`を使う。Playwright、DevTools emulation、desktop responsive modeを物理端末PASSへ数えない。

## 1. Target

| Field | Value |
|---|---|
| exact 40-char SHA | 未記入 |
| staging runtime SHA | 未記入 |
| main QR checksum | 未記入 |
| tester / observer | 未割当 |
| test window JST | 未記入 |

## 2. Device results

| Result ID | Device | OS | Browser/version | Network | Required flow | Result | Evidence |
|---|---|---|---|---|---|---|---|
| RD-IOS-01 | iPhone / 未確定 | 未記入 | Safari / 未記入 | Wi-Fi + mobile | QR、camera allow/deny、location allow/deny、撮影/選択、PWA、lock、offline、back/reload、recap | **UNEXECUTED** | |
| RD-AND-01 | Android / 未確定 | 未記入 | Chrome / 未記入 | Wi-Fi + mobile | QR、camera allow/deny、location allow/deny、撮影/選択、PWA/通常browser、lock、offline、back/reload、recap | **UNEXECUTED** | |
| RD-INAPP-01 | 未確定 | 未記入 | LINE等 / 未記入 | 未記入 | join表示、external browser移行、event/draft保持、URL tokenなし | **UNEXECUTED** | |
| RD-OPS-01 | 運営端末 / 未確定 | 未記入 | 未記入 | 主回線+予備 | join/rally/live/recap、集計、未同期、個人情報非表示 | **UNEXECUTED** | |

## 3. Required recovery observations

| Check | iPhone | Android | Note |
|---|---|---|---|
| camera拒否後に端末写真選択へ進める | UNEXECUTED | UNEXECUTED | |
| location拒否でもcheck-in/投稿可 | UNEXECUTED | UNEXECUTED | |
| browser back / reloadで入力保持 | UNEXECUTED | UNEXECUTED | |
| 画面lock / unlockでdraft保持 | UNEXECUTED | UNEXECUTED | |
| offline中に成功表示を出さない | UNEXECUTED | UNEXECUTED | |
| online復帰後に二重保存しない | UNEXECUTED | UNEXECUTED | |
| 同じ端末・同じQRでrecap再訪 | UNEXECUTED | UNEXECUTED | |
| 横scroll、safe-area、keyboard重なりなし | UNEXECUTED | UNEXECUTED | |

## 4. Failures / incidents

| ID | Device | Reproduction | Impact | Evidence | Owner | State |
|---|---|---|---|---|---|---|
| | | | | | | |

credential、正確な位置、他家族dataが見えた場合は値を撮影・転載せず、privacy incidentとして全体表示を止める。写真・入力が失われそうな場合は端末の元写真を残しFallback 2へ進む。

## 5. Summary

| Metric | Result |
|---|---|
| iPhone required checks PASS | 0 / 未実施 |
| Android required checks PASS | 0 / 未実施 |
| in-app browser | UNEXECUTED |
| physical QR scan on both systems | UNEXECUTED |
| open P0/P1 | 未集計 |
| final device gate | **UNEXECUTED — GOへ使用不可** |
