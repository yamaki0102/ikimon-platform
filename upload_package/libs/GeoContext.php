<?php
declare(strict_types=1);

/**
 * GeoContext — 地理的環境文脈エンジン
 *
 * OSM Overpass API + SQLite キャッシュで、任意の座標の環境情報を取得。
 * - 最寄りの水辺(河川/湖/池)までの距離
 * - 最寄りの公園/保護区
 * - 土地利用タイプ
 * - 周辺の遊歩道
 * - 緑地率(概算)
 */
class GeoContext
{
    private static ?PDO $db = null;
    private const CACHE_TTL = 86400 * 7; // 7日キャッシュ
    private const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
    private const SEARCH_RADIUS = 500; // 500m圏内

    private static function db(): PDO
    {
        if (self::$db) return self::$db;
        $path = DATA_DIR . '/geo_cache.sqlite3';
        $isNew = !file_exists($path);
        self::$db = new PDO('sqlite:' . $path);
        self::$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        if ($isNew) self::initDb();
        return self::$db;
    }

    private static function initDb(): void
    {
        self::$db->exec("
            CREATE TABLE IF NOT EXISTS geo_cache (
                cache_key TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_geo_cache_time ON geo_cache(created_at);
        ");
    }

    /**
     * 指定座標の環境文脈を取得
     *
     * @return array{
     *   land_use: string,
     *   nearest_water: ?array{name: string, type: string, distance_m: int},
     *   nearest_park: ?array{name: string, type: string, distance_m: int},
     *   trails: array,
     *   green_features: array,
     *   environment_label: string,
     *   environment_icon: string
     * }
     */
    public static function getContext(float $lat, float $lng): array
    {
        $gridKey = self::gridKey($lat, $lng);
        $cached = self::getCache($gridKey);
        if ($cached) return $cached;

        $result = self::queryOSM($lat, $lng);
        self::setCache($gridKey, $result);
        return $result;
    }

    /**
     * 検出に付与する環境説明文を生成
     */
    public static function explainHabitat(string $speciesName, float $lat, float $lng): string
    {
        $ctx = self::getContext($lat, $lng);
        $parts = [];

        if ($ctx['nearest_water'] && $ctx['nearest_water']['distance_m'] < 300) {
            $w = $ctx['nearest_water'];
            $parts[] = $w['name'] . '（' . $w['type'] . '、' . $w['distance_m'] . 'm）が近くにあります';
        }

        if ($ctx['nearest_park']) {
            $p = $ctx['nearest_park'];
            if ($p['distance_m'] < 50) {
                $parts[] = $p['name'] . '内での記録';
            } else {
                $parts[] = $p['name'] . '（' . $p['distance_m'] . 'm）の近く';
            }
        }

        if ($ctx['land_use']) {
            $parts[] = '環境: ' . $ctx['land_use'];
        }

        return implode('。', $parts);
    }

    /**
     * scan_classify プロンプトに注入する環境文脈テキスト
     */
    public static function getPromptContext(float $lat, float $lng): string
    {
        $ctx = self::getContext($lat, $lng);
        $lines = [];

        if ($ctx['land_use']) $lines[] = '地点の環境: ' . $ctx['land_use'];
        if ($ctx['nearest_water']) {
            $w = $ctx['nearest_water'];
            $lines[] = '最寄りの水辺: ' . $w['name'] . '(' . $w['type'] . ', ' . $w['distance_m'] . 'm)';
        }
        if ($ctx['nearest_park']) {
            $p = $ctx['nearest_park'];
            $lines[] = '最寄りの公園: ' . $p['name'] . '(' . $p['distance_m'] . 'm)';
        }
        if (!empty($ctx['green_features'])) {
            $lines[] = '周辺の緑地: ' . implode(', ', array_slice(array_map(fn($g) => $g['name'] ?: $g['type'], $ctx['green_features']), 0, 3));
        }

        return empty($lines) ? '' : implode("\n", $lines);
    }

    /**
     * 貢献メッセージ用の環境価値テキスト
     */
    public static function getContributionContext(float $lat, float $lng): ?array
    {
        $ctx = self::getContext($lat, $lng);

        if ($ctx['nearest_park'] && $ctx['nearest_park']['distance_m'] < 50) {
            return ['icon' => '🏞️', 'text' => $ctx['nearest_park']['name'] . '内の記録。都市緑地の生物多様性データとして特に価値があります'];
        }

        if ($ctx['nearest_water'] && $ctx['nearest_water']['distance_m'] < 200) {
            $w = $ctx['nearest_water'];
            return ['icon' => '🌊', 'text' => $w['name'] . '沿いの記録。水辺生態系のモニタリングに貢献'];
        }

        if ($ctx['environment_label'] === '森林') {
            return ['icon' => '🌲', 'text' => '森林内の記録。樹林生態系のベースラインデータとして重要'];
        }

        return null;
    }

    // --- OSM Overpass クエリ ---

    private static function queryOSM(float $lat, float $lng): array
    {
        $r = self::SEARCH_RADIUS;
        $query = <<<OVERPASS
[out:json][timeout:10];
(
  // 水辺
  way["natural"="water"](around:{$r},{$lat},{$lng});
  way["waterway"](around:{$r},{$lat},{$lng});
  relation["natural"="water"](around:{$r},{$lat},{$lng});
  // 公園・保護区
  way["leisure"="park"](around:{$r},{$lat},{$lng});
  way["leisure"="nature_reserve"](around:{$r},{$lat},{$lng});
  relation["leisure"="park"](around:{$r},{$lat},{$lng});
  relation["boundary"="national_park"](around:{$r},{$lat},{$lng});
  // 緑地
  way["natural"="wood"](around:{$r},{$lat},{$lng});
  way["landuse"="forest"](around:{$r},{$lat},{$lng});
  way["landuse"="farmland"](around:{$r},{$lat},{$lng});
  // 遊歩道
  way["highway"="path"](around:{$r},{$lat},{$lng});
  way["highway"="footway"](around:{$r},{$lat},{$lng});
  // 地点の土地利用
  way["landuse"](around:50,{$lat},{$lng});
);
out center tags;
OVERPASS;

        $result = self::defaultContext();

        try {
            $ch = curl_init(self::OVERPASS_URL);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => 'data=' . urlencode($query),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 12,
                CURLOPT_HTTPHEADER => ['User-Agent: ikimon.life/1.0 (biodiversity platform)'],
            ]);
            $resp = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($code !== 200 || !$resp) return $result;

            $data = json_decode($resp, true);
            if (!$data || empty($data['elements'])) return $result;

            $result = self::parseElements($data['elements'], $lat, $lng);
        } catch (\Throwable $e) {
            error_log("[GeoContext] Overpass error: " . $e->getMessage());
        }

        return $result;
    }

    private static function parseElements(array $elements, float $lat, float $lng): array
    {
        $result = self::defaultContext();
        $waters = [];
        $parks = [];
        $greens = [];
        $trails = [];

        foreach ($elements as $el) {
            $tags = $el['tags'] ?? [];
            $cLat = $el['center']['lat'] ?? $el['lat'] ?? null;
            $cLng = $el['center']['lon'] ?? $el['lon'] ?? null;
            $dist = ($cLat && $cLng) ? self::haversine($lat, $lng, $cLat, $cLng) : 9999;
            $name = $tags['name'] ?? '';

            // 水辺
            if (isset($tags['natural']) && $tags['natural'] === 'water') {
                $waters[] = ['name' => $name ?: '池・湖', 'type' => $tags['water'] ?? '水面', 'distance_m' => $dist];
            }
            if (isset($tags['waterway'])) {
                $typeMap = ['river' => '河川', 'stream' => '小川', 'canal' => '用水路', 'ditch' => '水路'];
                $waters[] = ['name' => $name ?: ($typeMap[$tags['waterway']] ?? '水路'), 'type' => $typeMap[$tags['waterway']] ?? $tags['waterway'], 'distance_m' => $dist];
            }

            // 公園
            if ((isset($tags['leisure']) && in_array($tags['leisure'], ['park', 'nature_reserve']))
                || (isset($tags['boundary']) && $tags['boundary'] === 'national_park')) {
                $type = ($tags['leisure'] ?? '') === 'nature_reserve' ? '自然保護区' : '公園';
                if (isset($tags['boundary'])) $type = '国立公園';
                $parks[] = ['name' => $name ?: $type, 'type' => $type, 'distance_m' => $dist];
            }

            // 緑地
            if ((isset($tags['natural']) && $tags['natural'] === 'wood')
                || (isset($tags['landuse']) && in_array($tags['landuse'], ['forest', 'farmland']))) {
                $typeMap = ['wood' => '樹林', 'forest' => '森林', 'farmland' => '農地'];
                $t = $typeMap[$tags['natural'] ?? ''] ?? $typeMap[$tags['landuse'] ?? ''] ?? '緑地';
                $greens[] = ['name' => $name ?: $t, 'type' => $t, 'distance_m' => $dist];
            }

            // 遊歩道
            if (isset($tags['highway']) && in_array($tags['highway'], ['path', 'footway'])) {
                $trails[] = ['name' => $name ?: '遊歩道', 'distance_m' => $dist];
            }

            // 地点の土地利用（最も近い landuse）
            if (isset($tags['landuse']) && $dist < 100) {
                $luMap = [
                    'residential' => '住宅地', 'commercial' => '商業地', 'industrial' => '工業地',
                    'forest' => '森林', 'farmland' => '農地', 'meadow' => '草地',
                    'orchard' => '果樹園', 'vineyard' => 'ぶどう園', 'grass' => '芝地',
                    'recreation_ground' => 'レクリエーション用地', 'cemetery' => '墓地',
                    'allotments' => '市民農園', 'retail' => '商業施設',
                ];
                $result['land_use'] = $luMap[$tags['landuse']] ?? $tags['landuse'];
            }
        }

        usort($waters, fn($a, $b) => $a['distance_m'] <=> $b['distance_m']);
        usort($parks, fn($a, $b) => $a['distance_m'] <=> $b['distance_m']);
        usort($greens, fn($a, $b) => $a['distance_m'] <=> $b['distance_m']);

        $result['nearest_water'] = $waters[0] ?? null;
        $result['nearest_park'] = $parks[0] ?? null;
        $result['green_features'] = array_slice($greens, 0, 5);
        $result['trails'] = array_slice($trails, 0, 5);

        // 環境ラベルとアイコンの決定
        if ($result['nearest_park'] && $result['nearest_park']['distance_m'] < 50) {
            $result['environment_label'] = $result['nearest_park']['name'];
            $result['environment_icon'] = '🏞️';
        } elseif ($result['nearest_water'] && $result['nearest_water']['distance_m'] < 100) {
            $result['environment_label'] = '水辺';
            $result['environment_icon'] = '🌊';
        } elseif ($result['land_use'] === '森林') {
            $result['environment_label'] = '森林';
            $result['environment_icon'] = '🌲';
        } elseif ($result['land_use'] === '農地') {
            $result['environment_label'] = '里山';
            $result['environment_icon'] = '🌾';
        } elseif ($result['land_use']) {
            $result['environment_label'] = $result['land_use'];
            $result['environment_icon'] = '🏙️';
        } else {
            $result['environment_label'] = count($greens) > 0 ? '緑地' : '';
            $result['environment_icon'] = count($greens) > 0 ? '🌿' : '📍';
        }

        return $result;
    }

    private static function defaultContext(): array
    {
        return [
            'land_use' => '',
            'nearest_water' => null,
            'nearest_park' => null,
            'trails' => [],
            'green_features' => [],
            'environment_label' => '',
            'environment_icon' => '📍',
        ];
    }

    // --- キャッシュ ---

    private static function gridKey(float $lat, float $lng): string
    {
        // 約100m グリッドでキャッシュ（小数第3位で丸め）
        return sprintf('%.3f,%.3f', $lat, $lng);
    }

    private static function getCache(string $key): ?array
    {
        try {
            $stmt = self::db()->prepare("SELECT data, created_at FROM geo_cache WHERE cache_key = ?");
            $stmt->execute([$key]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) return null;
            if (time() - intval($row['created_at']) > self::CACHE_TTL) {
                self::db()->prepare("DELETE FROM geo_cache WHERE cache_key = ?")->execute([$key]);
                return null;
            }
            return json_decode($row['data'], true);
        } catch (\Throwable $e) {
            return null;
        }
    }

    private static function setCache(string $key, array $data): void
    {
        try {
            $stmt = self::db()->prepare("INSERT OR REPLACE INTO geo_cache (cache_key, data, created_at) VALUES (?, ?, ?)");
            $stmt->execute([$key, json_encode($data, JSON_UNESCAPED_UNICODE), time()]);
        } catch (\Throwable $e) {
            error_log("[GeoContext] Cache write error: " . $e->getMessage());
        }
    }

    // --- ユーティリティ ---

    private static function haversine(float $lat1, float $lng1, float $lat2, float $lng2): int
    {
        $R = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return intval($R * 2 * atan2(sqrt($a), sqrt(1 - $a)));
    }
}
