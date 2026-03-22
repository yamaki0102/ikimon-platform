# PHP コーディングスタイル — ikimon.life

## 全般
- PHP 8.2 の機能を活用: readonly properties, enum, match, named arguments, fibers
- 関数には型ヒント（パラメータ + 戻り値）を付ける
- `declare(strict_types=1)` は新規ファイルで推奨（既存ファイルは触らない）

## 命名規約
- クラス: PascalCase (`BiodiversityScorer`)
- メソッド: camelCase (`calculateScore`)
- 変数: camelCase (`$siteData`)
- 定数: UPPER_SNAKE (`ROOT_DIR`, `DATA_DIR`)
- ファイル: PascalCase.php (クラス) / snake_case.php (ページ)

## DataStore API（必ず守る）
```php
// ✅ 正しい
DataStore::fetchAll('observations')   // 全レコード取得
DataStore::get('users/user-123')      // 単一ファイル読込
DataStore::save('users/user-123', $d) // 書込
DataStore::append('observations', $i) // 追記

// ❌ 存在しないメソッド
DataStore::getAll()    // ← 使うな
DataStore::findAll()   // ← 使うな
DataStore::update()    // ← 使うな
```

## SiteManager API（必ず守る）
```php
// ✅ 全メソッド static
SiteManager::load($siteId);
SiteManager::listAll();
SiteManager::isPointInGeometry($lat, $lng, $geo);

// ❌ インスタンス化禁止
$sm = new SiteManager();  // ← 使うな
```

## パス定数
```php
ROOT_DIR   // → upload_package/
DATA_DIR   // → upload_package/data/
PUBLIC_DIR // → upload_package/public_html/

// ✅ 正しい使い方
require_once ROOT_DIR . 'libs/DataStore.php';
$data = file_get_contents(DATA_DIR . 'species.json');

// ❌ ハードコード禁止
require_once '/home/user/upload_package/libs/DataStore.php';
```

## エラーハンドリング
- API は必ず JSON レスポンス: `['success' => bool, 'error' => string]`
- 例外はキャッチして適切なHTTPステータスコードを返す
- ユーザー向けメッセージに内部パスやスタックトレースを含めない

## コメント
- 既存コードにコメントを追加しない（CLAUDE.md のルール）
- 新規コードでロジックが自明でない箇所のみ簡潔にコメント
