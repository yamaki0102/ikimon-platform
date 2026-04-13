# 実装プラン：ローカル環境での全機能正常動作化

現在のローカルサーバー（`localhost:8000`）で発生している「ファイルが見つからない」エラーを解消し、実装済みの全ページを正常に動作させます。

## 修正タスク
1. **パス参照の堅牢化**: 全てのPHPファイルで `require_once __DIR__ . '/../...'` の形式に統一します。
2. **依存ライブラリの読み込み確認**: 各ページが必要とする `config.php` や `libs/` 内のクラスが漏れなく読み込まれるようにします。
3. **APIエラーの解消**: `api/` ディレクトリ内のファイルも同様に修正します。

## 対象ファイル
- `public_html/explore.php`
- `public_html/id_form.php`
- `public_html/showcase.php`
- `public_html/profile.php`
- `public_html/ranking.php`
- `public_html/api/get_observations.php`
- `public_html/api/search_taxon.php`
- `public_html/api/post_identification.php`
- `public_html/api/post_observation.php`
