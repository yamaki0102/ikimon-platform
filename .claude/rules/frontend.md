# フロントエンドルール — ikimon.life

## Alpine.js
- `x-data` でコンポーネントのステートを定義
- `x-text` を優先（XSS 防止）。`x-html` は信頼データのみ
- `x-on:click` / `@click` でイベントハンドリング
- `$fetch` / `fetch()` で API 通信
- `x-init` で重い処理を実行しない（defer パターンを使う）

## Tailwind CSS
- CDN 利用（ビルドステップなし）
- レスポンシブ: `sm:`, `md:`, `lg:` プレフィックス
- ダークモード: 現時点で未対応（将来対応予定）
- カスタム CSS は最小限。Tailwind ユーティリティで表現できるものはそちらを使う

## Lucide Icons
- アイコンは Lucide Icons に統一
- `<i data-lucide="icon-name"></i>` + `lucide.createIcons()` パターン

## MapLibre GL JS
- 地図初期化は `x-init` ではなく `DOMContentLoaded` / `x-effect` で
- マーカー大量描画時は GeoJSON Source + Layer を使う（DOM マーカーを避ける）
- 地理院タイルを使用

## パフォーマンス
- 画像は WebP 形式で圧縮保存
- Lazy loading: `loading="lazy"` 属性
- API レスポンスが大きい場合はページネーション
- `fetch()` 結果のキャッシュを検討
