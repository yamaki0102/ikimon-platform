# 外部レビュー採用ログ

- タスク: `ikimon-top-home-capture-20260723`
- 対象: ikimon.life Top / Home / 共通ナビ / カメラ導線
- 最終判断者: Codex

## Claude

- model_used: `claude-opus-4-8`
- 状態: `partial_unusable`
- 証跡: `claude-review.md`
- 判定理由: wrapper は成功扱いだったが、本文は調査開始時のツール呼び出し表示だけで、採否を判断できるレビュー結果が完結していなかった。
- 採用: なし
- 未確認: 実装計画への実質的な指摘

## Gemini

- model_used: `gemini-3.5-flash`
- 状態: `complete`
- 証跡: `gemini-review.md`

### 採用

- HTTPS / `mediaDevices.getUserMedia` の機能ガードを追加し、非対応時は明示エラーへ遷移。
- 下部ナビを `<nav>` とし、「撮る」を `button` + `aria-haspopup="dialog"` で通常リンクと区別。
- `visibilitychange` と `pagehide` で MediaStream の全 track を停止。
- 320pxを含む4ロケールの展開、44pxタップ領域、横はみ出しを自動検証。
- カメラ拒否・非対応時に、再許可・端末写真・キャンセルを明示し、ギャラリーへの自動フォールバックを禁止。

### 既存実装で充足

- 未ログインTopの位置情報は、既存の `publicFeedEligible`、`publicLocation`、`safePlace()` を通し、正確な緯度経度や非公開地名を描画しない。
- 撮影下書きは既存 IndexedDB と認証復帰経路、保存は既存観察記録APIを再利用。

### 不採用・見送り

- 新しい位置情報API・DB変更: 今回の表示経路は既存の安全化済みread modelで充足し、スキーマ変更は範囲外。
- 複雑な Permissions API 再照会ループ: iOS Safari互換性が低く、ユーザー操作による再試行と明示フォールバックを採用。
- 撮影直後の自動アップロード: 本人の保存操作前に送信しない既存方針を維持。
- iOS設定画面の長い技術説明: 主要画面では短い案内を優先し、ブラウザ／端末設定後の再試行を示す。

## 最終検証

- Node tests: 1371件成功
- Chromium Playwright: 20件成功
- WebKit（Safari相当）: 375px / 390px、guest / member、権限拒否 / 非対応の6件成功
- TypeScript typecheck: 成功
- production deploy / DB / secret / DNS / merge: 未実行
