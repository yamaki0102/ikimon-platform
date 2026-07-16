# 連理の木の下で サイエンスアドベンチャー — Participant Journey

更新日: 2026-07-16

対象: 2026-07-19（日）**11:10–13:00** の参加者体験

状態: 設計・受入条件は確定。人間ユーザーテストと物理端末確認は未実施

公開値は `renri_science_adventure_2026-07-19_event_canonical.md`、参加者向け文面は `renri_science_adventure_2026-07-19_participant_guide.md` を正本とする。

## 1. 体験の約束

家族・グループはスマートフォン1台で、次の3つを迷わず行える。

1. 参加する
2. 写真を残す
3. みんなの発見を見る

参加名は家族名またはニックネームとする。生き物名、位置共有、アカウント登録のいずれも、観察を始める前の必須入力にしない。位置共有は初期OFFとし、未成年を含む家族が位置を共有するときだけ保護者の明示同意を求める。

## 2. 主経路

| Step | 参加者の行動 | 画面・system state | 成功の見え方 | 保持するもの | 失敗時 |
|---|---|---|---|---|---|
| J01 | 受付等の主QRを読む | event codeのjoinを開く | イベント名、11:10–13:00、家族1台、位置OFFを確認できる | event code、event session identity | host/code不一致ならQR案内を止める |
| J02 | 家族名またはニックネームを入力 | check-in form | 30秒目安で「参加できました」へ進む | 参加名、位置選択、未成年情報 | validation/通信失敗でも入力を消さない |
| J03 | rallyを開く | 主要行動を3つ以内で表示 | 「写真を残す」が主操作として見える | participant identity、event context | guest credentialをURLへ出さない |
| J04 | 撮影または端末内写真を選ぶ | record draft | 名前不明のまま先へ進める | 元写真、下書き、event context | camera拒否時は写真選択へ進める |
| J05 | 必要なら無料登録・loginへ進む | auth transition | 元イベントと下書きへ戻る | 参加名、位置選択、未成年情報、写真下書き | loopまたは下書き消失なら停止条件 |
| J06 | 観察を保存する | submit started → processing → succeeded/failed | server successだけを保存完了と表示 | 冪等key、retry state、元写真 | offlineを成功扱いせず再試行を示す |
| J07 | みんなの発見を見る | live | 自分と会場全体を区別し、更新時刻が分かる | event identity | liveだけの不調はFallback 1 |
| J08 | 終了後に同じQRを読む | recapへ安全に解決 | 参加組数、観察件数、種類、写真、次のヒント | 同端末のevent別credential | URL tokenなしで再訪できない場合はNO-GO候補 |

## 3. 分岐

### 未登録家族

- check-in、rally、live、recapはevent別のsame-site credentialで利用する。
- credentialはHttpOnly cookieに置き、URL、公開HTML、analytics、運営メモへ出さない。
- 写真保存で登録が必要な構成は、人間ユーザーテストの維持条件を満たす場合だけ採用する。

### 登録済み保護者

- 認証済みsessionを利用し、新しいguest credentialを参加者へ見せない。
- 同じbrowserに事前のguest参加がある場合は、別家族を作らず安全にaccountへ引き継ぐ。

### 位置共有を拒否

- check-in、写真、live、recapを継続する。
- exact locationを公開しない。拒否はerrorや未完了として数えない。

### 通信・upload失敗

- 成功確認前に下書きや元写真を消さない。
- offlineのまま成功表示を出さない。
- retry上限到達後は端末へ写真を残し、`renri_science_adventure_2026-07-19_fallback_card.md` のFallback 2へ移る。

## 4. 終了時の状態遷移

- 参加者向け終了は13:00。13:00以後に同じ主QRを読むとrecapへ解決する。
- 13:00–13:40は運営振り返り・撤収であり、参加者向けイベント時間へ含めない。
- 終了境界の投稿可否はserver timeで判定し、端末時計やquery parameterを信頼しない。
- liveとrecapは同じ集計定義を使い、主催者を参加組数へ含めない。

## 5. Success / Stop criteria

| 指標 | 合格条件 | 現在 |
|---|---|---|
| QR→参加 | 中央値30秒以内 | 人間テスト未実施 |
| QR→最初の保存 | 2分以内 | 人間テスト未実施 |
| Round 1 | 5人中4人以上、口頭介助なし | 未実施 |
| Round 2 | 3人中3人、参加・写真・live・recap完了 | 未実施 |
| 画面数 | 観察開始まで3画面以内 | Visual QA未実施 |
| データ完全性 | 二重参加・二重投稿・欠損0 | staging未実施 |

別家族の情報、正確な位置、guest credentialの露出、写真・入力消失、production/staging混同のいずれかを見つけたら、その経路の試験を止め、GO判定を保留する。

## 6. 検証先

- browser/viewport: `renri_science_adventure_2026-07-19_visual_qa.md`
- 物理端末: `renri_science_adventure_2026-07-19_device_checklist.md` と `renri_science_adventure_2026-07-19_real_device_results.md`
- 人間テスト: `renri_science_adventure_2026-07-19_user_test.md` と `renri_science_adventure_2026-07-19_user_test_results.md`
- 障害時: `renri_science_adventure_2026-07-19_fallback_card.md`
- 最終判定: `renri_science_adventure_2026-07-19_go_no_go.md`
