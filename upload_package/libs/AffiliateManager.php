<?php
/**
 * AffiliateManager — taxonomy 階層フォールバックで書籍を推薦
 *
 * 使い方:
 *   $books = AffiliateManager::getBooks($taxon, 'encyclopedia', 2);
 *   // $taxon は species.php / observation_detail.php で利用可能な配列
 *   // 必須キー: slug (string), lineage (array), scientific_name (string)
 */
class AffiliateManager
{
    private static ?array $config   = null;
    private static ?array $catalog  = null;
    private static ?array $mappings = null;
    private static array  $lineageCache = [];

    // ───────────────────────────────────────────
    //  Public API
    // ───────────────────────────────────────────

    /**
     * taxon に関連する書籍を取得
     *
     * @param array  $taxon   slug, lineage, scientific_name を含む配列
     * @param string $context 'encyclopedia' | 'observation' | 'identification'
     * @param int    $limit   最大表示冊数
     * @return array [{id, title, author, publisher, description, book_type, cover, isbn, shops: [...], context_label}]
     */
    public static function getBooks(array $taxon, string $context = 'encyclopedia', int $limit = 0): array
    {
        $cfg = self::getConfig();
        if (!$cfg['enabled']) {
            return [];
        }
        if ($limit <= 0) {
            $limit = $cfg['display']['max_books'] ?? 2;
        }

        // lineage が空で gbif_key があれば GBIF API から補完
        if (empty($taxon['lineage']) && !empty($taxon['gbif_key'])) {
            $taxon['lineage'] = self::resolveLineageFromGbif((int)$taxon['gbif_key']);
        }

        $resolved = self::resolveBooks($taxon, $limit);
        if (empty($resolved)) {
            return [];
        }

        // ショップ URL 付きで返却
        $result = [];
        foreach ($resolved as $bookId => $book) {
            $shops = [];
            foreach ($cfg['shops'] as $shopKey => $shopCfg) {
                if (!$shopCfg['enabled']) continue;
                $shops[] = [
                    'key'   => $shopKey,
                    'label' => $shopCfg['label'],
                    'color' => $shopCfg['color'],
                    'icon'  => $shopCfg['icon'] ?? 'external-link',
                    'url'   => self::getClickUrl($bookId, $shopKey, $context, $taxon['slug'] ?? ''),
                ];
            }
            $result[] = [
                'id'          => $bookId,
                'title'       => $book['title'],
                'author'      => $book['author'],
                'publisher'   => $book['publisher'],
                'year'        => $book['year'] ?? null,
                'description' => $book['description'],
                'book_type'   => $book['book_type'],
                'cover'       => $book['cover'],
                'isbn'        => $book['isbn'] ?? null,
                'shops'       => $shops,
            ];
        }
        return $result;
    }

    /**
     * コンテキスト別のセクションヘッダー情報
     */
    public static function getContextHeader(string $context): array
    {
        return match ($context) {
            'encyclopedia'   => ['icon' => 'book-open',  'title' => 'この種をもっと知る'],
            'identification' => ['icon' => 'lightbulb',  'title' => '同定に役立つ図鑑'],
            'observation'    => ['icon' => 'book-open',  'title' => '関連する図鑑・書籍'],
            default          => ['icon' => 'book-open',  'title' => 'おすすめの書籍'],
        };
    }

    /**
     * クリックトラッキング用 URL を生成
     */
    public static function getClickUrl(string $bookId, string $shop, string $context, string $taxonSlug): string
    {
        $params = http_build_query([
            'b'   => $bookId,
            's'   => $shop,
            'ctx' => $context,
            't'   => $taxonSlug,
        ]);
        return '/api/affiliate/click.php?' . $params;
    }

    /**
     * 実際のショップ URL を生成（クリック後のリダイレクト先）
     */
    public static function getShopUrl(string $bookId, string $shop): string
    {
        $cfg     = self::getConfig();
        $catalog = self::getBooksCatalog();
        $book    = $catalog[$bookId] ?? null;
        $shopCfg = $cfg['shops'][$shop] ?? null;

        if (!$book || !$shopCfg) {
            return 'https://www.amazon.co.jp/';
        }

        $isbn = $book['isbn'] ?? '';
        $title = $book['title'] ?? '';
        $searchQuery = $isbn ?: $title;

        switch ($shop) {
            case 'amazon':
                $asin = $book['codes']['amazon_asin'] ?? '';
                $tag  = $shopCfg['tag'] ?? '';
                if ($asin) {
                    $url = $shopCfg['dp_url'] . rawurlencode($asin);
                    return $tag ? $url . '?tag=' . rawurlencode($tag) : $url;
                }
                // ASIN なし → ISBN 検索
                $url = $shopCfg['search_url'] . rawurlencode($searchQuery);
                return $tag ? $url . '&tag=' . rawurlencode($tag) : $url;

            case 'rakuten':
                $affId = $shopCfg['affiliate_id'] ?? '';
                $url = $shopCfg['search_url'] . rawurlencode($searchQuery);
                // 楽天アフィリエイトIDがある場合はリンク変換が必要（通常は楽天リンクAPIで生成）
                // 簡易版: 検索URLをそのまま返す
                return $url;

            case 'yahoo':
                $url = $shopCfg['search_url'] . rawurlencode($searchQuery);
                $sid = $shopCfg['sid'] ?? '';
                $pid = $shopCfg['pid'] ?? '';
                if ($sid && $pid) {
                    $url .= '&sid=' . rawurlencode($sid) . '&pid=' . rawurlencode($pid);
                }
                return $url;

            default:
                return 'https://www.amazon.co.jp/s?k=' . rawurlencode($searchQuery);
        }
    }

    /**
     * クリックを記録
     */
    public static function recordClick(string $bookId, string $shop, string $context, string $taxonSlug): void
    {
        $month = date('Y-m');
        $file  = DATA_DIR . '/affiliate/clicks/' . $month . '.json';

        $entry = [
            'book'    => $bookId,
            'shop'    => $shop,
            'context' => $context,
            'taxon'   => $taxonSlug,
            'at'      => date('c'),
            'ip_hash' => substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . date('Y-m-d')), 0, 8),
        ];

        // ファイルが存在しなければ空配列で初期化
        $data = [];
        if (file_exists($file)) {
            $raw = file_get_contents($file);
            $data = json_decode($raw, true) ?: [];
        }
        $data[] = $entry;

        $dir = dirname($file);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    }

    /**
     * クリック統計を取得（管理画面用）
     */
    public static function getClickStats(string $month = ''): array
    {
        if (!$month) $month = date('Y-m');
        $file = DATA_DIR . '/affiliate/clicks/' . $month . '.json';
        if (!file_exists($file)) return ['total' => 0, 'by_shop' => [], 'by_book' => [], 'by_context' => []];

        $data = json_decode(file_get_contents($file), true) ?: [];
        $stats = ['total' => count($data), 'by_shop' => [], 'by_book' => [], 'by_context' => []];

        foreach ($data as $click) {
            $stats['by_shop'][$click['shop']]       = ($stats['by_shop'][$click['shop']] ?? 0) + 1;
            $stats['by_book'][$click['book']]        = ($stats['by_book'][$click['book']] ?? 0) + 1;
            $stats['by_context'][$click['context']]  = ($stats['by_context'][$click['context']] ?? 0) + 1;
        }
        arsort($stats['by_book']);
        arsort($stats['by_shop']);
        return $stats;
    }

    /**
     * GBIF API から lineage を取得（ファイルキャッシュ付き）
     */
    public static function resolveLineageFromGbif(int $gbifKey): array
    {
        if (isset(self::$lineageCache[$gbifKey])) {
            return self::$lineageCache[$gbifKey];
        }

        // ファイルキャッシュ確認
        $cacheDir = (defined('DATA_DIR') ? DATA_DIR : __DIR__ . '/../data') . '/affiliate/lineage_cache';
        $cacheFile = $cacheDir . '/' . $gbifKey . '.json';
        if (file_exists($cacheFile)) {
            $cached = json_decode(file_get_contents($cacheFile), true);
            if ($cached) {
                self::$lineageCache[$gbifKey] = $cached;
                return $cached;
            }
        }

        // GBIF API 呼び出し
        $url = 'https://api.gbif.org/v1/species/' . $gbifKey;
        $ctx = stream_context_create([
            'http' => ['timeout' => 3, 'ignore_errors' => true],
        ]);
        $json = @file_get_contents($url, false, $ctx);
        if (!$json) {
            return [];
        }

        $data = json_decode($json, true);
        if (!$data) {
            return [];
        }

        $lineage = [];
        foreach (['kingdom', 'phylum', 'class', 'order', 'family', 'genus'] as $rank) {
            if (!empty($data[$rank])) {
                $lineage[$rank] = $data[$rank];
            }
        }

        // ファイルキャッシュ保存
        if (!empty($lineage)) {
            if (!is_dir($cacheDir)) {
                mkdir($cacheDir, 0755, true);
            }
            file_put_contents($cacheFile, json_encode($lineage, JSON_UNESCAPED_UNICODE), LOCK_EX);
        }

        self::$lineageCache[$gbifKey] = $lineage;
        return $lineage;
    }

    // ───────────────────────────────────────────
    //  Internal
    // ───────────────────────────────────────────

    /**
     * taxonomy 階層フォールバックで書籍を解決
     * species → genus → family → order → class → kingdom → _general
     */
    private static function resolveBooks(array $taxon, int $limit): array
    {
        $mappings = self::getMappings();
        $catalog  = self::getBooksCatalog();
        $collected = []; // bookId => book data（重複排除用）

        $slug    = $taxon['slug'] ?? '';
        $lineage = $taxon['lineage'] ?? [];
        $sciName = $taxon['scientific_name'] ?? '';

        // lineage に genus がなければ学名から抽出（species.php 互換）
        if (empty($lineage['genus']) && $sciName) {
            $parts = explode(' ', trim($sciName));
            if (count($parts) >= 2 && ctype_upper($parts[0][0] ?? '')) {
                $lineage['genus'] = $parts[0];
            }
        }

        // 検索順序
        $lookups = [
            ['level' => 'species', 'key' => $slug],
            ['level' => 'genus',   'key' => $lineage['genus'] ?? ''],
            ['level' => 'family',  'key' => $lineage['family'] ?? ''],
            ['level' => 'order',   'key' => $lineage['order'] ?? ''],
            ['level' => 'class',   'key' => $lineage['class'] ?? ''],
            ['level' => 'kingdom', 'key' => $lineage['kingdom'] ?? ''],
        ];

        foreach ($lookups as $lookup) {
            if (count($collected) >= $limit) break;
            if (empty($lookup['key'])) continue;

            $level = $lookup['level'];
            $key   = $lookup['key'];

            $entry = $mappings[$level][$key] ?? null;
            if (!$entry || empty($entry['books'])) continue;

            foreach ($entry['books'] as $bookId) {
                if (count($collected) >= $limit) break;
                if (isset($collected[$bookId])) continue;

                $book = $catalog[$bookId] ?? null;
                if (!$book || !($book['is_active'] ?? true)) continue;

                $book['_matched_level'] = $level;
                $book['_matched_key']   = $key;
                $book['_context_label'] = $entry['label'] ?? '';
                $collected[$bookId] = $book;
            }
        }

        // _general フォールバック
        if (count($collected) < $limit) {
            $general = $mappings['_general'] ?? null;
            if ($general && !empty($general['books'])) {
                foreach ($general['books'] as $bookId) {
                    if (count($collected) >= $limit) break;
                    if (isset($collected[$bookId])) continue;
                    $book = $catalog[$bookId] ?? null;
                    if (!$book || !($book['is_active'] ?? true)) continue;
                    $book['_matched_level'] = '_general';
                    $book['_context_label'] = $general['label'] ?? '';
                    $collected[$bookId] = $book;
                }
            }
        }

        // priority 降順ソート
        uasort($collected, fn($a, $b) => ($b['priority'] ?? 0) - ($a['priority'] ?? 0));

        return array_slice($collected, 0, $limit, true);
    }

    // ───────────────────────────────────────────
    //  Data Loaders (cached per-request)
    // ───────────────────────────────────────────

    private static function getConfig(): array
    {
        if (self::$config === null) {
            $file = defined('ROOT_DIR') ? ROOT_DIR . '/config/affiliate.php' : __DIR__ . '/../config/affiliate.php';
            self::$config = file_exists($file) ? (require $file) : ['enabled' => false];
        }
        return self::$config;
    }

    private static function getBooksCatalog(): array
    {
        if (self::$catalog === null) {
            $file = defined('DATA_DIR') ? DATA_DIR . '/affiliate/books.json' : __DIR__ . '/../data/affiliate/books.json';
            if (file_exists($file)) {
                $data = json_decode(file_get_contents($file), true) ?: [];
                unset($data['_meta']);
                self::$catalog = $data;
            } else {
                self::$catalog = [];
            }
        }
        return self::$catalog;
    }

    private static function getMappings(): array
    {
        if (self::$mappings === null) {
            $file = defined('DATA_DIR') ? DATA_DIR . '/affiliate/mappings.json' : __DIR__ . '/../data/affiliate/mappings.json';
            if (file_exists($file)) {
                $data = json_decode(file_get_contents($file), true) ?: [];
                unset($data['_meta']);
                self::$mappings = $data;
            } else {
                self::$mappings = [];
            }
        }
        return self::$mappings;
    }
}
