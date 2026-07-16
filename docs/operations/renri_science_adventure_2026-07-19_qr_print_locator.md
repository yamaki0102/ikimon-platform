# 連理の木の下で サイエンスアドベンチャー — QR / Print Asset Locator

更新日: 2026-07-16

状態: **主URL未確定・QR未生成・印刷未実施**

参加者向け時間: **2026-07-19（日）11:10–13:00**

## 1. Master contract

| Field | Value |
|---|---|
| proposed event code | `RENRI0719`（2026-07-16のproduction/staging by-code公開APIは404。D1最終確認前） |
| production session ID | 未作成 |
| main QR URL | `https://ikimon.life/community/events/RENRI0719/join`（未確定） |
| last read-only by-code check | production 404 / staging 404（2026-07-16） |
| QR content SHA-256 | 未記入 |
| QR asset checksum | 未記入 |
| freeze approval | NOT REQUESTED |

QRは未生成である。production sessionが未作成で、対象SHAのstaging deploy / verify / Visual QA / 実機読取もUNEXECUTEDのため、未確定URLをasset化しない。

query、guest credential、user ID、session token、座標、内部versionをQRへ含めない。終了後もQR画像を差し替えず、server側でrecapへ安全に解決する。

## 2. Source copy

QR下の文は`renri_science_adventure_2026-07-19_participant_guide.md`の次の3文だけを使う。

> 家族でスマホ1台あれば参加できます。
>
> 名前が分からなくても写真だけで大丈夫です。
>
> 位置情報を共有しなくても参加できます。

公開時刻、参加費、受付状態は`renri_science_adventure_2026-07-19_event_canonical.md`と照合する。

## 3. Asset locators

binary assetはrepoへ入れず、Evidence Bundleへ保存する。

| Asset ID | Planned filename | Storage locator | SHA-256 | Status |
|---|---|---|---|---|
| QR-SVG | `renri0719-main-qr.svg` | 未記入 | | UNEXECUTED |
| QR-PNG | `renri0719-main-qr.png` | 未記入 | | UNEXECUTED |
| PRINT-A4 | `renri0719-reception-a4.pdf` | 未記入 | | UNEXECUTED |
| PRINT-STAFF | `renri0719-staff-card.pdf` | 未記入 | | UNEXECUTED |
| PRINT-START | `renri0719-observation-start.pdf` | 未記入 | | UNEXECUTED |
| PRINT-PREVIEW | `renri0719-print-contact-sheet.png` | 未記入 | | UNEXECUTED |

3印刷物は同じQR masterをembedし、生成後にQR regionまたはembedded URLが同一であることをhash/decoderで確認する。

URL文字列と生成assetのchecksum記録例:

```powershell
$url = 'https://ikimon.life/community/events/RENRI0719/join'
$urlHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($url))).ToLowerInvariant()
$urlHash
Get-FileHash -Algorithm SHA256 -LiteralPath '<ABSOLUTE_QR_ASSET_PATH>'
```

## 4. Physical placement

| Placement | Count | Owner | Installed JST | Removed JST | Result |
|---|---:|---|---|---|---|
| 受付A4掲示 | 1 | 未割当 | | | UNEXECUTED |
| スタッフ携帯カード | 必要人数分 | 未割当 | | | UNEXECUTED |
| 観察開始地点 | 1 | 未割当 | | | UNEXECUTED |

## 5. Scan verification

| Check | iPhone Safari | Android Chrome | Evidence |
|---|---|---|---|
| schemeがHTTPS | UNEXECUTED | UNEXECUTED | |
| hostが`ikimon.life` | UNEXECUTED | UNEXECUTED | |
| event codeが`RENRI0719` | UNEXECUTED | UNEXECUTED | |
| query/credentialなし | UNEXECUTED | UNEXECUTED | |
| 開催前/中にjoinへ到達 | UNEXECUTED | UNEXECUTED | |
| 終了後にrecapへ到達 | UNEXECUTED | UNEXECUTED | |
| 低照度・反射下で読取 | UNEXECUTED | UNEXECUTED | |

本番event作成、by-code verify、production read-only postcheck、2系統実読取が終わるまで「QR確定」「印刷完了」と報告しない。
