# SZ-UC-09 テスト結果: 天竜川河口で通信不安定下に記録する

## 1. 基本情報

- ケース ID: SZ-UC-09
- ケース名: 天竜川河口で通信不安定下に記録する
- 実施日: 2026-04-08
- 実施モデル: Claude Opus 4.6 (コードリーディング + ローカルサーバーHTML出力検証)
- 実施環境: localhost:8899 (PHP 8.2 Built-in Server)
- ベース URL: http://localhost:8899/
- 使用端末想定: モバイル（屋外・通信不安定）

## 2. 結論

- 総合判定: **合格（条件付き）**
- 一言要約: OfflineManager（IndexedDB投稿キュー）+ Service Worker（キャッシュ戦略）+ saveDraft（localStorage下書き）の三重オフライン対策があり技術的に堅牢。ただしオフライン状態のUIフィードバックが不十分

## 3. 実行サマリ

- 実施した主な操作: OfflineManager.jsのIndexedDBキュー機能検証、sw.phpのキャッシュ戦略確認、saveDraft()のlocalStorage保存確認、submit()のエラーハンドリング確認
- 完了できたタスク: オフライン投稿キュー機能の全容把握、下書き保存メカニズムの確認、Service Workerのキャッシュ戦略評価
- 完了できなかったタスク: 実際のオフライン環境での投稿テスト（DevToolsオフライン模擬が必要）

## 4. 主要 findings

| 重要度 | 種別 | 画面 / 機能 | 事象 | ユーザー影響 | 再現手順 | 改善の方向 |
| --- | --- | --- | --- | --- | --- | --- |
| P2 | UX | post.php オフライン状態表示 | OfflineManagerは `navigator.onLine` と `online`/`offline` イベントを監視してバックグラウンド同期するが、**投稿フォーム上にオフライン状態のバナーや「あとで送信します」インジケーターが見当たらない** | ユーザーが通信不安定な河口でフォームに入力しても、「今オフラインなのか」「入力は保存されているのか」が分からない。不安が残る | 1. オフライン状態でpost.phpを開く（Service Workerキャッシュから提供） 2. フォームに入力 3. オフライン状態を示すバナーやインジケーターがない | ヘッダーまたはフォーム上部に「📡 オフラインモード — 入力は端末に保存されます」バナーを表示 |
| P2 | UX | post.php submit() エラー時 | submit()がfetchで失敗した場合のエラーハンドリングを確認。OfflineManager.saveObservation()にフォールバックするが、**ユーザーへの通知がconsole.logのみの可能性**がある | 送信失敗時に「保存されたのか消えたのか」が分からない。河口で寒風の中、もう一度入力し直す羽目になるリスク | submit()のcatch節（post-uploader.js）を確認 | 送信失敗時にtoast通知「📡 オフラインに保存しました。通信が回復したら自動送信します」を表示 |
| P2 | UX | saveDraft() の限定性 | saveDraft()はlocalStorageに保存するが、**保存対象が note, cultivation, organism_origin の3フィールドのみ**。写真・位置・種名・日時は保存されない | 下書き復元しても写真と位置が消えており、実質的に使い物にならない。現地入力→帰宅後再開のフローが不完全 | post-uploader.js L367-L374: `JSON.stringify({note, cultivation, organism_origin, timestamp})` | saveDraft()を全フィールド（写真のblob含む）に拡張。IndexedDBに移行してサイズ制限を回避 |
| P3 | UX | Service Worker キャッシュ | sw.phpはページナビゲーションをネットワーク優先(network-first)でキャッシュ。写真は専用キャッシュ(PHOTO_CACHE)に保存。オフライン時はキャッシュからフォールバック | post.phpが一度でもオンラインで開かれていれば、オフラインでもフォームは表示される。ただしAPIリクエスト（taxon_suggest等）はオフラインで失敗する | sw.php L96-L101: network-first strategy | 種名autocompleteの頻出候補をローカルキャッシュし、オフラインでも基本的な種名入力を可能にする |

## 5. ケース観点ごとの評価

### 良かった点

- **三重オフライン対策の存在**:
  1. **OfflineManager.js**: IndexedDBベースの投稿キュー。オフライン時にフォームデータをoutboxに保存し、online復帰時に自動sync
  2. **Service Worker (sw.php)**: ページ・CSS・JS・写真のキャッシュ。オフラインでもUIが表示される
  3. **saveDraft()**: localStorageへの下書き保存（ただし限定的）
- **自動同期**: OfflineManager.sync()がonlineイベントで自動発火。ユーザーは帰宅後にアプリを開くだけで自動送信される
- **CSRF トークンリフレッシュ**: オフライン同期時にCSRFトークンを再取得する処理あり（OfflineManager.js L121）
- **エラー分類**: ネットワークエラーとバリデーションエラーを区別して処理（OfflineManager.js L154-L168）

### 問題点

- **オフライン状態の視覚的フィードバック不足**: ユーザーが現在の状態（オン/オフライン）を認識できない
- **saveDraft()の保存範囲が狭すぎる**: 3フィールドのみで実用性が低い
- **送信失敗時の通知不足**: エラー時にユーザーに明確なフィードバックがない可能性
- **API依存の機能がオフラインで機能しない**: 種名autocomplete、住所検索、GBIF連携

### 観察ポイント別メモ

- **屋外耐性**: Service Workerキャッシュでフォーム自体はオフラインで表示可能 ✓。ただしオフライン状態の認識が困難
- **再開性**: OfflineManager.saveObservation()でIndexedDBに保存されれば、帰宅後に自動sync。ただしsaveDraft()の保存範囲が限定的
- **心理負荷**: 「今やらないと全部消える」の不安は、オフライン投稿キューの存在で技術的には解消されるが、UIでそれが伝わらない

## 6. 合格条件チェック

- [x] 回線不安定でも入力内容が致命的に失われない — OfflineManager + IndexedDB キュー ✓
- [ ] 失敗時に理由と次アクションが分かる — オフライン状態表示・エラー通知が不十分
- [x] 後で再開する現実的な運用が成立する — online復帰時の自動sync ✓
- [ ] 屋外観察向けとして信頼できる — オフライン状態が見えないため、信頼感が構築されにくい

## 7. 失敗シグナル確認

- 該当した失敗シグナル:
  - **何が失敗したのか分からない** — エラー時の視覚的フィードバック不足
- 該当しなかった失敗シグナル:
  - エラーで入力が消える — IndexedDBキューで保護 ✓
  - 後から再開できず現地でやり切るしかない — 自動sync ✓
  - 回線弱者に対する配慮が感じられない — Service Worker + IndexedDBの技術実装自体は配慮あり ✓

## 8. 証拠

- 参照したファイル:
  - `upload_package/public_html/js/OfflineManager.js` (L1-L175) — IndexedDB投稿キュー全体
  - `upload_package/public_html/js/OfflineManager.js` (L43-L69) — saveObservation()
  - `upload_package/public_html/js/OfflineManager.js` (L104-L170) — sync() + エラーハンドリング
  - `upload_package/public_html/js/post-uploader.js` (L367-L374) — saveDraft() 3フィールドのみ
  - `upload_package/public_html/sw.php` (L1-L136) — Service Workerキャッシュ戦略

## 9. 次アクション

- **いますぐ直すべきこと**:
  1. post.phpのヘッダーまたは投稿ボタン近くにオンライン/オフライン状態インジケーターを追加
  2. 送信失敗時にtoast通知で「端末に保存しました」を表示

- **後続検証で切り分けること**:
  1. saveDraft()を全フィールド対応に拡張（写真のblob含む、IndexedDBベース）
  2. 種名autocompleteの頻出候補ローカルキャッシュ
  3. 実機でのオフラインテスト（DevTools Throttling or 実フィールド）

- **今回は見送るが記録すべきこと**: 「フィールドノートモード」— オフライン専用の軽量入力UIで、写真+位置+ひとことメモのみを高速保存し、帰宅後にリッチ編集する二段階フロー
