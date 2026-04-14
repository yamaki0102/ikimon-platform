# SZ-UC-09 テスト結果: 天竜川河口で通信不安定下に記録する

## 1. 基本情報

- ケース ID: SZ-UC-09
- ケース名: 天竜川河口で通信不安定下に記録する
- 実施日: 2026-04-08
- 実施モデル: Codex
- 実施環境: `OfflineManager.js` / `post-uploader.js` / `offline.php` の実装検証
- ベース URL: `http://localhost:8899/`
- 使用端末想定: モバイル屋外

## 2. 結論

- 総合判定: 不合格
- 一言要約: オフライン保存の意図はあるが、同期先実装が観察投稿と噛み合っておらず、現状の信頼性は低い。

## 3. 実行サマリ

- 実施した主な操作: 投稿失敗時のオフライン保存ロジック確認、同期先確認、オフラインページ確認
- 完了できたタスク: 実装上の再開設計確認
- 完了できなかったタスク: ブラウザでの実オフライン往復
- 投稿完了までの時間: 実測対象外
- 大きく迷った箇所: Outbox同期先が観察投稿APIではない点

## 4. 主要 findings

| 重要度 | 種別 | 画面 / 機能 | 事象 | ユーザー影響 | 再現手順 | 改善の方向 |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | Bug / Offline | Outbox同期 | `OfflineManager.sync()` が `api/post_identification.php?_route=observation` を叩く | 端末保存された観察が正常再送されない可能性が高い | `OfflineManager.js` の同期先を確認 | `api/post_observation.php` に修正する |
| P2 | Resilience | エラー処理 | fetchがTypeErrorで落ちた時しかOutbox保存しない | 弱回線で500やHTMLエラーが返ると入力が救済されない | `post-uploader.js` の `catch` / JSON失敗処理確認 | サーバー異常時も下書きへ退避する |
| P2 | UX | 再開導線 | 端末保存後の「保留中一覧」UIが見えない | 現地で保存されたか、後で送れたか確認しづらい | `OfflineManager.js` / `offline.php` を確認 | Outbox一覧と手動再送UIを追加する |

## 5. ケース観点ごとの評価

### 良かった点

- IndexedDBへの保存意図はある
- オフライン時に責めない文言で端末保存を案内している
- `offline.php` で再接続時の自動再読込がある

### 問題点

- 観察同期先が不整合
- 回線不安定時の救済条件が狭い
- ユーザーが保留中アイテムを確認できない

### 観察ポイント別メモ

- 屋外耐性: 現状では不十分
- 再開性: 設計意図はあるが完成度が足りない
- 心理負荷: 「本当に送れたか」の不安が残る

## 6. 合格条件チェック

- [ ] 回線不安定でも入力内容が致命的に失われない
- [ ] 失敗時に理由と次アクションが分かる
- [ ] 後で再開する現実的な運用が成立する
- [ ] 屋外観察向けとして信頼できる

## 7. 失敗シグナル確認

- 該当した失敗シグナル: エラー原因が分からない、後から再開できる確証が弱い
- 該当しなかった失敗シグナル: なし

## 8. 証拠

- 確認した URL:
  - `http://localhost:8899/offline.php`
- 参照したファイル:
  - `upload_package/public_html/js/OfflineManager.js`
  - `upload_package/public_html/js/post-uploader.js`
  - `upload_package/public_html/offline.php`
  - `upload_package/public_html/api/post_identification.php`
- スクリーンショット: なし

## 9. 次アクション

- いますぐ直すべきこと: Outbox同期先を観察投稿APIへ修正する
- 後続検証で切り分けること: 弱回線・HTTP500時の退避戦略
- 今回は見送るが記録すべきこと: 保留中一覧UI
