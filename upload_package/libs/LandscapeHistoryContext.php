<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';

class LandscapeHistoryContext
{
    private const SEARCH_RADIUS_KM = 3.0;
    private const DATA_DIR_REL = '/ecology/landscape_history';
    private const EARTH_RADIUS_KM = 6371.0;

    private static array $indexCache = [];
    private static array $chunkCache = [];

    public static function getPromptContext(
        float $lat,
        float $lng,
        ?string $speciesName = null,
        ?string $scientificName = null,
        string $mode = 'detection',
        string $userId = ''
    ): string {
        if ($lat == 0 && $lng == 0) return '';

        $regionCode = self::resolveRegionCode($lat, $lng);
        if (empty($regionCode)) return '';

        $chunks = self::findNearbyChunks($lat, $lng, $regionCode);
        if (empty($chunks)) return '';

        $scored = [];
        foreach ($chunks as $chunk) {
            $score = self::scoreChunk($chunk, $lat, $lng, $speciesName, $scientificName, $userId);
            $scored[] = ['chunk' => $chunk, 'score' => $score];
        }
        usort($scored, fn($a, $b) => $b['score'] <=> $a['score']);

        $best = $scored[0];
        if ($best['score'] <= 0) return '';

        $layer = self::selectNarrativeLayer($best['chunk'], $speciesName, $userId);

        return self::formatForMode($best['chunk'], $layer, $mode);
    }

    public static function getDeliveryMetadata(
        float $lat,
        float $lng,
        ?string $speciesName,
        string $mode
    ): ?array {
        if ($lat == 0 && $lng == 0) return null;

        $regionCode = self::resolveRegionCode($lat, $lng);
        if (empty($regionCode)) return null;

        $chunks = self::findNearbyChunks($lat, $lng, $regionCode);
        if (empty($chunks)) return null;

        $hint = match ($mode) {
            'opening' => 'immediate',
            'detection' => 'next_slot',
            'ambient' => 'ambient_slot',
            'closing' => 'immediate',
            default => 'immediate',
        };

        return ['delivery_hint' => $hint];
    }

    // 都道府県名 → JP-XX コードのフォールバックマップ（GeoUtils が名前を返す場合の保険）
    private const PREF_NAME_TO_CODE = [
        '北海道' => 'JP-01', '青森県' => 'JP-02', '岩手県' => 'JP-03', '宮城県' => 'JP-04',
        '秋田県' => 'JP-05', '山形県' => 'JP-06', '福島県' => 'JP-07', '茨城県' => 'JP-08',
        '栃木県' => 'JP-09', '群馬県' => 'JP-10', '埼玉県' => 'JP-11', '千葉県' => 'JP-12',
        '東京都' => 'JP-13', '神奈川県' => 'JP-14', '新潟県' => 'JP-15', '富山県' => 'JP-16',
        '石川県' => 'JP-17', '福井県' => 'JP-18', '山梨県' => 'JP-19', '長野県' => 'JP-20',
        '岐阜県' => 'JP-21', '静岡県' => 'JP-22', '愛知県' => 'JP-23', '三重県' => 'JP-24',
        '滋賀県' => 'JP-25', '京都府' => 'JP-26', '大阪府' => 'JP-27', '兵庫県' => 'JP-28',
        '奈良県' => 'JP-29', '和歌山県' => 'JP-30', '鳥取県' => 'JP-31', '島根県' => 'JP-32',
        '岡山県' => 'JP-33', '広島県' => 'JP-34', '山口県' => 'JP-35', '徳島県' => 'JP-36',
        '香川県' => 'JP-37', '愛媛県' => 'JP-38', '高知県' => 'JP-39', '福岡県' => 'JP-40',
        '佐賀県' => 'JP-41', '長崎県' => 'JP-42', '熊本県' => 'JP-43', '大分県' => 'JP-44',
        '宮崎県' => 'JP-45', '鹿児島県' => 'JP-46', '沖縄県' => 'JP-47',
    ];

    private static function resolveRegionCode(float $lat, float $lng): string
    {
        static $cache = [];
        $key = round($lat, 1) . '_' . round($lng, 1);
        if (isset($cache[$key])) return $cache[$key];

        try {
            require_once ROOT_DIR . '/libs/GeoUtils.php';
            $geo = GeoUtils::reverseGeocode($lat, $lng);
            $code = $geo['prefecture'] ?? '';

            // GeoUtilsがJP-XX形式で返す場合はそのまま使用
            // 都道府県名（日本語）で返ってきた場合はマップ変換
            if (!empty($code) && !str_starts_with($code, 'JP-')) {
                $code = self::PREF_NAME_TO_CODE[$code] ?? $code;
            }

            if (empty($code) && !empty($geo['country'])) {
                $code = $geo['country'];
            }
            $cache[$key] = $code;
            return $code;
        } catch (\Throwable $e) {
            return $cache[$key] = '';
        }
    }

    private static function findNearbyChunks(float $lat, float $lng, string $regionCode): array
    {
        $index = self::loadIndex($regionCode);
        if (empty($index)) return [];

        $chunkIds = $index['chunks'] ?? [];
        $nearby = [];

        foreach ($chunkIds as $chunkId) {
            $chunk = self::loadChunk($regionCode, $chunkId);
            if (!$chunk) continue;

            $cLat = (float)($chunk['location']['lat'] ?? 0);
            $cLng = (float)($chunk['location']['lng'] ?? 0);
            $radius = (float)($chunk['location']['radius_km'] ?? self::SEARCH_RADIUS_KM);

            $dist = self::haversine($lat, $lng, $cLat, $cLng);
            if ($dist <= max($radius, self::SEARCH_RADIUS_KM)) {
                $chunk['_distance_km'] = $dist;
                $nearby[] = $chunk;
            }
        }

        return $nearby;
    }

    private static function scoreChunk(
        array $chunk,
        float $lat,
        float $lng,
        ?string $speciesName,
        ?string $scientificName,
        string $userId
    ): float {
        $dist = $chunk['_distance_km'] ?? self::SEARCH_RADIUS_KM;
        $maxDist = max((float)($chunk['location']['radius_km'] ?? self::SEARCH_RADIUS_KM), self::SEARCH_RADIUS_KM);
        $distScore = max(0, 1.0 - ($dist / $maxDist));

        $speciesScore = self::scoreBySpecies($chunk, $speciesName, $scientificName);

        $noveltyScore = self::scoreNovelty($chunk, $userId);

        return ($distScore * 0.3) + ($speciesScore * 0.4) + ($noveltyScore * 0.3);
    }

    private static function scoreBySpecies(array $chunk, ?string $name, ?string $sciName): float
    {
        if (empty($name) && empty($sciName)) return 0.3;

        $triggers = $chunk['tags']['common_name_triggers'] ?? [];
        $taxaTriggers = $chunk['tags']['taxa_triggers'] ?? [];

        if ($sciName) {
            foreach ($taxaTriggers as $trigger) {
                if (stripos($sciName, $trigger) !== false || stripos($trigger, $sciName) !== false) {
                    return 1.0;
                }
            }
        }

        if ($name) {
            foreach ($triggers as $trigger) {
                if (mb_strpos($name, $trigger) !== false || mb_strpos($trigger, $name) !== false) {
                    return 1.0;
                }
            }
        }

        $habitats = $chunk['tags']['habitats'] ?? [];
        if (!empty($habitats)) return 0.2;

        return 0.1;
    }

    private static function scoreNovelty(array $chunk, string $userId): float
    {
        if (empty($userId)) return 0.5;

        $history = self::loadUserNarrativeHistory($userId);
        $chunkId = $chunk['id'] ?? '';
        $usedThemes = $history[$chunkId] ?? [];
        $layers = $chunk['narrative_layers'] ?? [];

        if (empty($layers)) return 0.5;

        $unusedCount = 0;
        foreach ($layers as $layer) {
            $theme = $layer['theme'] ?? '';
            if (!in_array($theme, $usedThemes, true)) {
                $unusedCount++;
            }
        }

        return $unusedCount / count($layers);
    }

    private static function selectNarrativeLayer(
        array $chunk,
        ?string $speciesName,
        string $userId
    ): ?array {
        $layers = $chunk['narrative_layers'] ?? [];
        if (empty($layers)) return null;

        $history = self::loadUserNarrativeHistory($userId);
        $chunkId = $chunk['id'] ?? '';
        $usedThemes = $history[$chunkId] ?? [];

        $month = (int)date('n');
        $seasonBonus = match(true) {
            $month >= 3 && $month <= 5 => ['migration', 'spring_ecology', 'insect_ecology'],
            $month >= 6 && $month <= 8 => ['wetland_ecology', 'water_management', 'river_ecology'],
            $month >= 9 && $month <= 11 => ['forest_ecology', 'harvest', 'grassland'],
            default => ['winter_ecology', 'urban_wildlife'],
        };

        $candidates = [];
        foreach ($layers as $i => $layer) {
            $theme = $layer['theme'] ?? '';
            $score = 1.0;

            if (in_array($theme, $usedThemes, true)) {
                $score *= 0.3;
            }

            if (in_array($theme, $seasonBonus, true)) {
                $score *= 1.5;
            }

            $candidates[] = ['index' => $i, 'layer' => $layer, 'score' => $score];
        }

        usort($candidates, fn($a, $b) => $b['score'] <=> $a['score']);

        $topScore = $candidates[0]['score'];
        $topCandidates = array_filter($candidates, fn($c) => $c['score'] >= $topScore * 0.9);
        $selected = $topCandidates[array_rand($topCandidates)];

        self::recordNarrativeUsage($userId, $chunkId, $selected['layer']['theme'] ?? '');

        return $selected['layer'];
    }

    private static function formatForMode(array $chunk, ?array $layer, string $mode): string
    {
        $narrative = $layer['narrative'] ?? '';
        $title = $layer['title'] ?? '';
        $landscapeBefore = $chunk['content']['landscape_before'] ?? '';
        $landUseChange = $chunk['content']['land_use_change'] ?? '';
        $ecologicalImpact = $chunk['content']['ecological_impact'] ?? '';
        $biodiversityLink = $chunk['content']['biodiversity_link'] ?? '';

        return match ($mode) {
            'opening' => self::formatOpening($chunk, $layer),
            'detection' => self::formatDetection($chunk, $layer),
            'ambient' => self::formatAmbient($chunk, $layer),
            'closing' => self::formatClosing($chunk, $layer),
            default => '',
        };
    }

    private static function formatDetection(array $chunk, ?array $layer): string
    {
        $narrative = $layer['narrative'] ?? '';
        $title = $layer['title'] ?? '';
        $link = $chunk['content']['biodiversity_link'] ?? '';
        $change = $chunk['content']['land_use_change'] ?? '';

        $parts = ["【景観史（事実。生態系の文脈で語って。観光ガイドにしない。じっくり語ってOK）】"];
        if ($title) $parts[] = "テーマ: {$title}";
        if ($narrative) {
            $parts[] = $narrative;
        } else {
            if ($change) $parts[] = "土地利用の変遷: {$change}";
            if ($link) $parts[] = $link;
        }
        $parts[] = "→ この歴史を「だから今ここにこの種がいる」という形で検出種と結びつけて。";
        $parts[] = "→ 城や神社の観光解説はしない。土地と水と生き物の関係を語って。";
        $parts[] = "→ 長めに語ってOK（300-400文字）。散歩中に聞くポッドキャストのような語り口で。";

        return implode("\n", $parts);
    }

    private static function formatOpening(array $chunk, ?array $layer): string
    {
        $before = $chunk['content']['landscape_before'] ?? '';
        $link = $chunk['content']['biodiversity_link'] ?? '';
        $placeName = $chunk['location']['place_names'][0] ?? '';

        $parts = ["【この場所の景観史（空気感の一部として自然に触れて）】"];
        if ($before) $parts[] = $before;
        if ($link) $parts[] = $link;
        $parts[] = "→ 2-3文で自然に織り込んで。歴史の授業にしない。";
        $parts[] = "→ 「昔ここは〇〇だった。だから今でも△△がいる」の形で。";

        return implode("\n", $parts);
    }

    private static function formatAmbient(array $chunk, ?array $layer): string
    {
        $narrative = $layer['narrative'] ?? '';
        $title = $layer['title'] ?? '';
        $impact = $chunk['content']['ecological_impact'] ?? '';

        $parts = ["【景観史ガイド（散歩中のポッドキャストのように。じっくり語って）】"];
        if ($title) $parts[] = "テーマ: {$title}";
        if ($narrative) {
            $parts[] = $narrative;
        } else {
            if ($impact) $parts[] = $impact;
        }
        $parts[] = "→ 400-500文字でじっくり語ってOK。リスナーが「へぇ」「そうなんだ」と思える密度で。";
        $parts[] = "→ 城跡・寺社の解説は絶対にしない。土地利用の変化→生態系への影響の視点のみ。";
        $parts[] = "→ 今この季節・天気だからこそ感じられるポイントがあれば添えて。";

        return implode("\n", $parts);
    }

    private static function formatClosing(array $chunk, ?array $layer): string
    {
        $title = $layer['title'] ?? '';
        $before = $chunk['content']['landscape_before'] ?? '';
        $link = $chunk['content']['biodiversity_link'] ?? '';

        $parts = ["【今日の散歩と景観史（振り返りに1文だけ添えて）】"];
        if ($title) $parts[] = "今日のテーマ: {$title}";
        if ($before) $parts[] = "この場所のかつての姿: {$before}";
        $parts[] = "→ 「今日歩いた場所は、昔は〇〇だった。キミのデータがその変化を記録している」のように。";
        $parts[] = "→ 1-2文で簡潔に。余韻を残す形で。";

        return implode("\n", $parts);
    }

    // --- Data loaders ---

    private static function loadIndex(string $regionCode): array
    {
        if (isset(self::$indexCache[$regionCode])) {
            return self::$indexCache[$regionCode];
        }

        $path = DATA_DIR . self::DATA_DIR_REL . "/{$regionCode}/index.json";
        if (!file_exists($path)) {
            return self::$indexCache[$regionCode] = [];
        }

        $data = json_decode(file_get_contents($path), true);
        return self::$indexCache[$regionCode] = ($data ?: []);
    }

    private static function loadChunk(string $regionCode, string $chunkId): ?array
    {
        $key = "{$regionCode}/{$chunkId}";
        if (isset(self::$chunkCache[$key])) {
            return self::$chunkCache[$key];
        }

        $safeId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $chunkId);
        $path = DATA_DIR . self::DATA_DIR_REL . "/{$regionCode}/chunks/{$safeId}.json";
        if (!file_exists($path)) {
            return self::$chunkCache[$key] = null;
        }

        $data = json_decode(file_get_contents($path), true);
        self::$chunkCache[$key] = $data;
        return $data;
    }

    // --- User narrative history (LRU tracking) ---

    private static function loadUserNarrativeHistory(string $userId): array
    {
        if (empty($userId)) return [];

        $path = DATA_DIR . "/voice_guide_history/{$userId}_landscape.json";
        if (!file_exists($path)) return [];

        $data = json_decode(file_get_contents($path), true);
        return $data ?: [];
    }

    private static function recordNarrativeUsage(string $userId, string $chunkId, string $theme): void
    {
        if (empty($userId) || empty($theme)) return;

        $safeUserId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $userId);
        $dir = DATA_DIR . '/voice_guide_history';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);

        $path = "{$dir}/{$safeUserId}_landscape.json";
        $history = [];
        if (file_exists($path)) {
            $history = json_decode(file_get_contents($path), true) ?: [];
        }

        if (!isset($history[$chunkId])) {
            $history[$chunkId] = [];
        }

        $history[$chunkId] = array_values(array_filter(
            $history[$chunkId],
            fn($t) => $t !== $theme
        ));
        $history[$chunkId][] = $theme;

        if (count($history[$chunkId]) > 20) {
            $history[$chunkId] = array_slice($history[$chunkId], -20);
        }

        file_put_contents($path, json_encode($history, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }

    // --- Geo utils ---

    private static function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return self::EARTH_RADIUS_KM * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
