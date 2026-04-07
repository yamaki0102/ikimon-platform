# 静岡UXテスト 統合改善計画

> Claude Opus + Codex 双方の検証結果を統合。10ケース×2レビュアーの全findingsを優先度別に整理し、実行可能な改善タスクに落とし込む。

## ソースドキュメント

- Claude 個別レポート: `docs/review/shizuoka-ux-tests/SZ-UC-01_report.md` 〜 `SZ-UC-10_report.md`
- Codex 個別レポート: `docs/review/shizuoka-ux-tests/SZ-UC-01_report_codex.md` 〜 `SZ-UC-10_report_codex.md`
- Codex 総括: `docs/review/shizuoka-ux-tests/CODEX_SHIZUOKA_UX_SUMMARY_2026-04-08.md`

## 判定サマリー（Claude / Codex 対比）

| ID | テーマ | Claude | Codex | 合意 |
|---|---|---|---|---|
| UC-01 | 浜名湖 初心者初投稿 | 要改善 | 要改善 | ✓ 一致 |
| UC-02 | 下田 親子磯遊び | 要改善 | 要改善 | ✓ 一致 |
| UC-03 | 朝霧高原 夜の昆虫記録 | 要改善 | 要改善 | ✓ 一致 |
| UC-04 | 焼津港 不明魚共有 | 合格(条件付) | 要改善 | △ Claude寄り |
| UC-05 | 牧之原 茶農家益虫害虫 | 要改善 | 要改善 | ✓ 一致 |
| UC-06 | 沼津 高校生観察会 | 合格(条件付) | 要改善 | △ Claude寄り |
| UC-07 | 安倍川 外来種モニタリング | 要改善 | 要改善 | ✓ 一致 |
| UC-08 | 山地 希少植物プライバシー | 要改善 | **不合格** | ⚠ Codex側が深刻なバグ発見 |
| UC-09 | 天竜川河口 通信不安定 | 合格(条件付) | **不合格** | ⚠ Codex側が深刻なバグ発見 |
| UC-10 | 富士市 日常カジュアル記録 | 要改善 | 要改善 | ✓ 一致 |

### 判定差分の分析

- **UC-08**: Claudeは PrivacyFilter.php のバックエンドロジックを評価し「UIが見えないだけで保護はある」としたが、Codexが **JSON-LD・地図初期化・Nominatimリクエストで生座標が漏洩**するバグを発見。Codexの「不合格」が正しい。
- **UC-09**: Claudeは OfflineManager.js の設計を評価したが、Codexが **sync先APIが `post_identification.php` で間違っている**バグを発見。オフライン保存データが復元不可能。Codexの「不合格」が正しい。

---

## Tier 0: セキュリティ緊急修正（即日対応必須）

### T0-1. 希少種の位置情報漏洩修正
- **発見者**: Codex (UC-08)
- **深刻度**: Critical / セキュリティ
- **影響**: 全ての保護種の正確な位置が公開ページから取得可能
- **対象ファイル**: `upload_package/public_html/observation_detail.php`
- **修正箇所（5箇所）**:

| 行 | 現状 | 修正 |
|---|---|---|
| L335-336 | `round((float) $obs['lat'], 4)` をJSON-LDに直出力 | PrivacyFilter::autoFilter() で粗化した座標を使用 |
| L368 | `floatval($obs['lat'])` をNominatim URLに直出力 | 粗化座標を使用、またはサーバーサイドで逆ジオコーディング |
| L1889-1890 | `floatval($obs['lat/lng'])` をJS変数に直出力 | 閲覧者権限に応じた座標を出力（自分＝正確、他人＝粗化） |

- **修正方針**:
```php
// observation_detail.phpの冒頭で閲覧者権限に応じた座標を取得
$viewerIsOwner = $currentUser && $currentUser['id'] === $obs['user_id'];
$displayLat = $viewerIsOwner ? $obs['lat'] : PrivacyFilter::getAmbientLat($obs);
$displayLng = $viewerIsOwner ? $obs['lng'] : PrivacyFilter::getAmbientLng($obs);
// 全5箇所で $displayLat / $displayLng を使用
```

### T0-2. OfflineManager sync先APIの修正
- **発見者**: Codex (UC-09)
- **深刻度**: Critical / データ損失
- **影響**: オフラインで保存した観察データが同期時に全て失敗する
- **対象ファイル**: `upload_package/public_html/js/OfflineManager.js`
- **修正箇所**:

| 行 | 現状 | 修正 |
|---|---|---|
| L134 | `fetch('api/post_identification.php?_route=observation', ...)` | `fetch('api/post_observation.php', ...)` |

- **追加修正**: エラーハンドリング強化
  - TypeError以外のネットワークエラー(500, HTML応答)でもOutbox保存にフォールバック
  - sync失敗時にリトライキューを維持

---

## Tier 1: P1バグ修正（1週間以内）

### T1-1. observation_detail.php 時刻表示の追加
- **発見者**: Claude (UC-03, UC-07)
- **関連ケース**: UC-03 (夜間22:10), UC-04 (早朝5:30), UC-07 (午前)
- **対象ファイル**: `upload_package/public_html/observation_detail.php`
- **修正**:
  - L561: `date('Y年m月d日', ...)` → `date('Y年m月d日 H:i', ...)`
  - L1093: `date('Y.m.d', ...)` → `date('Y.m.d H:i', ...)`

### T1-2. モバイルボトムナビのゲスト導線修正
- **発見者**: Claude + Codex (UC-01)
- **対象ファイル**: `upload_package/public_html/components/nav.php`
- **修正**: 未ログイン時の中央カメラボタンを `href="/login.php"` → `href="/post.php"` に変更（post.php側のゲスト制御は実装済み）

### T1-3. 写真5枚上限のJSガード追加
- **発見者**: Claude (UC-03)
- **対象ファイル**: `upload_package/public_html/js/post-uploader.js`
- **修正**: `handleFiles()` 冒頭に追加:
```javascript
handleFiles(e) {
    if (this.photos.length >= 5) return; // 上限ガード
    // ... 既存コード
}
```

---

## Tier 2: UX重要改善（2〜4週間）

### T2-1. 位置プライバシー説明UIの追加
- **発見者**: Claude + Codex (UC-01, UC-08)
- **対象ファイル**: `upload_package/public_html/post.php`
- **内容**: 地図セクションに以下を追加:
  - 「📍 位置情報は市区町村レベルで公開されます。希少種は自動でさらに粗化されます」
  - FAQ/プライバシーポリシーへのリンク
- **observation_detail.php**: 自分の投稿を見るとき「👁 あなただけに正確な位置が表示されています」ラベル

### T2-2. 投稿完了画面に同定リクエスト導線追加
- **発見者**: Claude + Codex (UC-01, UC-04)
- **対象ファイル**: `upload_package/public_html/post.php`
- **内容**: 投稿成功画面のネクストアクションに追加:
  - 「🔍 みんなに名前を聞いてみる」→ id_center.php へリンク
  - 種名未入力時のみ表示

### T2-3. タッチターゲット拡大（モバイルアクセシビリティ）
- **発見者**: Claude (UC-05)
- **対象ファイル**: `upload_package/public_html/post.php`
- **修正箇所**:
  - 写真削除ボタン(L301): `p-1` → `p-2.5 min-w-[44px] min-h-[44px]`
  - 写真保存ボタン(L298): 同上
  - ヘッダー戻るボタン(L170): `p-2` → `p-3`
  - M3チップ(L76): `padding: 6px 16px` → `padding: 10px 20px`

### T2-4. resetForm() でbiome保持
- **発見者**: Claude (UC-02)
- **対象ファイル**: `upload_package/public_html/js/post-uploader.js`
- **修正**: `resetForm()` (L336) で `this.biome = 'unknown'` を削除。連続投稿時にbiomeを保持

### T2-5. エビデンスUIの初心者向け緩和
- **発見者**: Claude + Codex (UC-01)
- **対象ファイル**: `upload_package/public_html/post.php`, `upload_package/public_html/js/post-uploader.js`
- **内容**:
  - 投稿数が3件未満のユーザーにはエビデンス選択を「推奨」に格下げ（必須バッジを非表示）
  - または「わからない・AIにおまかせ」選択肢を追加

### T2-6. オフライン状態UIフィードバック
- **発見者**: Claude + Codex (UC-09)
- **対象ファイル**: `upload_package/public_html/post.php`
- **内容**:
  - ヘッダーにオンライン/オフライン状態バナー
  - 送信失敗時のtoast通知「📡 端末に保存しました。通信回復後に自動送信します」
  - pending items リスト（何件保留中か表示）

### T2-7. saveDraft() の全フィールド対応
- **発見者**: Claude + Codex (UC-09)
- **対象ファイル**: `upload_package/public_html/js/post-uploader.js`
- **現状**: note, cultivation, organism_origin の3フィールドのみ
- **修正**: 写真blob含む全フィールドをIndexedDBに保存。localStorage→IndexedDB移行

---

## Tier 3: 機能追加（1〜3ヶ月）

### T3-1. 写真なし軽量投稿モード
- **発見者**: Claude + Codex (UC-10)
- **概要**: 通常ユーザーでも写真なしで投稿可能にする「ライトモード」
- **最小要件**: 種名 or メモ + GPS自動位置 + 日時自動
- **修正**: `canOpenForm` / `canSubmit` のロジック拡張

### T3-2. 同日記録のトリップグルーピング
- **発見者**: Claude + Codex (UC-02)
- **概要**: 同日・同エリアの複数投稿を「お出かけ記録」としてまとめて表示
- **実装先**: index.php フィード + profile.php

### T3-3. 同一地点の時系列比較ビュー
- **発見者**: Claude + Codex (UC-07)
- **概要**: 特定座標の半径Xm以内の過去記録を時系列で表示
- **実装先**: explore.php or 新規 monitoring.php

### T3-4. 写真の並べ替え・メイン指定UI
- **発見者**: Claude + Codex (UC-03)
- **概要**: 複数写真のドラッグ並べ替え、メイン写真タップ指定

### T3-5. 観察会ダッシュボード
- **発見者**: Claude + Codex (UC-06)
- **概要**: event_idでフィルタした参加者投稿一覧・種数集計・地図マッピング

### T3-6. ユーザー手動の位置粒度選択
- **発見者**: Claude (UC-08)
- **概要**: 投稿時に「詳細位置を公開/市区町村レベル/非公開」を選択するUI
- **レッドリスト外の種でも、ユーザー判断で位置を隠せるようにする**

### T3-7. 普通種歓迎メッセージ
- **発見者**: Claude + Codex (UC-10)
- **概要**: 投稿エリアに「ふだんの記録こそ、地域の生態系データの基盤です」のメッセージ

### T3-8. 「前回の観察をコピー」テンプレート投稿
- **発見者**: Claude (UC-07)
- **概要**: loadHistory()を拡張し、種名・環境・メモも復元

---

## 実行スケジュール

```
Week 1 (即日〜)
├── T0-1: 位置情報漏洩修正 ★緊急★
├── T0-2: OfflineManager sync先修正 ★緊急★
├── T1-1: 時刻表示追加
├── T1-2: ボトムナビ ゲスト導線修正
└── T1-3: 写真上限ガード

Week 2〜3
├── T2-1: 位置プライバシー説明UI
├── T2-2: 同定リクエスト導線
├── T2-3: タッチターゲット拡大
├── T2-4: biome保持修正
└── T2-5: エビデンスUI緩和

Week 3〜4
├── T2-6: オフラインUIフィードバック
└── T2-7: saveDraft全フィールド対応

Month 2〜3
├── T3-1: 写真なし軽量投稿
├── T3-2: トリップグルーピング
├── T3-3: 時系列比較ビュー
├── T3-4: 写真並べ替え
├── T3-5: 観察会ダッシュボード
├── T3-6: 手動位置粒度選択
├── T3-7: 普通種歓迎メッセージ
└── T3-8: テンプレート投稿
```

---

## 検証方法

- **T0 (セキュリティ)**: 修正後に observation_detail.php のHTML出力を `curl` で取得し、JSON-LD・JS・URLに生座標が含まれないことを確認。他ユーザーのセッションでアクセスして粗化座標のみ表示されることを確認
- **T1 (バグ修正)**: 各修正後にローカルサーバーで該当画面を確認
- **T2 (UX改善)**: ローカルサーバー + ブラウザ操作で各シナリオを再テスト
- **T3 (機能追加)**: 個別のPR単位でUXテストケースの再検証

---

*作成: 2026-04-08 by Claude Opus (Claude + Codex 双方のレビュー統合)*
