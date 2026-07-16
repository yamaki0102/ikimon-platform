# 連理の木の下で サイエンスアドベンチャー — イベント運用正本

更新日: 2026-07-16

対象日: 2026-07-19（日）

文書状態: 当日運用値の正本。本番セッションとQRは未作成・未確定

検証状態（2026-07-16）: production/stagingとも`RENRI0719` by-codeは404。QR未生成。production deploy、production DB、production event作成は実施していない。

## 1. 公開情報

| 項目 | 正本値 | 備考 |
|---|---|---|
| イベント名 | 連理の木の下で サイエンスアドベンチャー ブルーベリー狩り | 表記を短縮する場合も「連理の木の下で」を残す |
| 開催日 | 2026-07-19（日） | JST |
| 会場 | 連理の木の下で | 住所・駐車案内は公開案内を参照し、未確認値を別資料へ転記しない |
| 参加者向け開催時間 | **11:10–13:00** | 参加者向け画面・掲示・QR案内の終了時刻は必ず13:00 |
| 運営振り返り・撤収 | 13:00–13:40 | 参加者向け開催時間へ含めない |
| 定員 | 最大10組 | 1組1端末を標準とする |
| 参加費 | 1組500円 | ブルーベリー約100g込み |
| 受付状態 | 受付終了 | 新規募集を示す文言を出さない |
| 公開案内 | `https://i-kan.co.jp/events/renri-science-adventure-blueberry/` | 公開日時・料金の第一正本 |

`13:40` は運営内部の撤収完了目安であり、イベント終了時刻、構造化データ、参加者向けrecap、受付掲示には使わない。

## 2. 体験の契約

参加者の主要行動は次の3つに絞る。

1. 参加する
2. 写真を残す
3. みんなの発見を見る

運用上の前提:

- 家族・グループはスマートフォン1台で参加できる。
- 参加名は家族名またはニックネームとし、未成年者の氏名を求めない。
- 生き物の名前が分からなくても写真を残せる。
- 正確な位置共有は任意で、初期状態は共有しない。
- 未成年を含む家族が位置を共有する場合だけ、保護者の明示同意を必要とする。
- ゲストはcheck-in、rally、live、recapを利用できる。写真保存でアカウント登録が必要な場合は、元のイベントと下書きへ戻れることを受入条件とする。
- イベント終了後は同じ端末・同じQRからrecapへ到達できることを受入条件とする。

## 3. runtime metadata

次の値は本番へ作成していない。GO判定後、別の明示承認を受けたproduction operationで確定する。

| 項目 | 予定値・契約 | 現在の状態 |
|---|---|---|
| event code | `RENRI0719` | 2026-07-16 read-only確認でproduction/stagingのby-code APIはいずれも404。最終確定前に承認済みoperation内でD1一意性を再確認する |
| production session ID | opaque ID | 未作成 |
| parent field | 既存の「連理の木の下で」フィールド | field ID未確定。重複地点を新設しない |
| area revision | 既存フィールドの確定revision | 未確認 |
| geometry hash | 上記revisionのhash | 未確認 |
| mode | discovery | 予定値 |
| participant window | 2026-07-19 11:10–13:00 JST | 本番作成時にUTC変換値も相互確認する |
| organizer wrap-up | 2026-07-19 13:00–13:40 JST | runtimeの公開終了時刻に設定しない |

read-only runtime参照:

| Environment | Runtime SHA | この作業との関係 |
|---|---|---|
| staging | `7438789b602dda50a6e7592a6d0dc33bece25763` | 現行staging。今回の対象branch SHAではない |
| production | `2c4d72224ece8fe653bc1bffc4ce3ffa57b059cb` | 現行production。今回のproduction操作なし |

本番作成時に値を転記しただけでは完了にしない。公開案内、イベント画面、JSON-LD、session、テスト期待値、QR、recapの表示を相互照合する。

read-only重複確認 locator:

- `GET https://ikimon.life/api/v1/observation-events/by-code/RENRI0719` → 404（2026-07-16 read-only）
- `GET https://staging.ikimon.life/api/v1/observation-events/by-code/RENRI0719` → 404（2026-07-16 read-only）

この404は公開API上で現行sessionが見つからない証拠であり、production event作成許可やD1一意性の最終証明ではない。

別のread-only確認では、2026-07-16 10:36 JSTのproduction公開イベント一覧に`PR973 prod rally`が2件残っていた。これは今回のbranch修正がproductionへ未反映であることを示し、現在のNO-GO根拠の1つである。

## 4. URLとQRの契約

本番session作成前は次のURLをQRへ印刷しない。

| 用途 | URL契約 |
|---|---|
| 主QR / join | `https://ikimon.life/community/events/<event-code>/join` |
| rally | `https://ikimon.life/events/<session-id>/rally` |
| live | `https://ikimon.life/events/<session-id>/live` |
| recap | `https://ikimon.life/events/<session-id>/recap` |

QR運用:

- 受付A4、スタッフ携帯カード、観察開始地点の3か所で、同じ主QRを使う。
- QR下の文は3文だけにする。文面は `renri_science_adventure_2026-07-19_participant_guide.md` を正本とする。
- QRにguest credential、メールアドレス、user ID、座標、内部用queryを含めない。
- 開催中はjoinへ、終了後はrecapへ、サーバー側で安全に解決する。現地でQR画像を差し替えない。
- 印刷前にiPhoneとAndroidの実機で読み、遷移先のscheme、host、event codeを声出し照合する。

## 5. 集計の契約

| 指標 | 定義 |
|---|---|
| 参加組数 | check-inが成功した家族・グループの重複排除数 |
| 主催者 | 参加組数に含めない |
| 観察件数 | 保存成功が確定した一意の観察。処理中・失敗・重複再送は含めない |
| 見つかった種類 | 同定が確定したtaxonの重複排除数。名前不明を無理に種類数へ入れない |
| 未同期件数 | 端末または運営が「保存成功」を確認できていない件数 |

liveとrecapは同じ定義を使う。差が出た場合はrecapの見栄えを優先せず、集計不整合としてGO判定を止める。

## 6. プライバシー境界

公開画面・URL・analytics・運営記録へ次を出さない。

- 本名、メールアドレス、生のuser ID、guest credential
- 正確な緯度経度、画像ファイル名、自由記述本文
- 未成年者個人を識別できる情報

当日メモは家族名または受付番号で管理し、参加者の端末や写真を運営側へ無断転送しない。位置情報を拒否してもcheck-in・投稿支援・fallbackを断らない。

## 7. 正本の優先順位

1. 公開日時・料金・受付状態: 公開案内ページ
2. ikimon.lifeの実装・session値: 対象commit SHAと承認済みproduction operation manifest
3. 当日役割・障害対応: `renri_science_adventure_2026-07-19_staff_runbook.md`
4. 参加者向け文面: `renri_science_adventure_2026-07-19_participant_guide.md`
5. 開催可否: `renri_science_adventure_2026-07-19_go_no_go.md`

矛盾を見つけた場合は推測で合わせず、公開案内を基準に参加者向け時刻を11:10–13:00へ戻し、runtime値は変更権限を持つ責任者へエスカレーションする。
