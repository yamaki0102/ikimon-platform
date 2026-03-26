<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/DataStore.php';

/**
 * DistributionAnalyzer — 分布異常検出（「珍しい！」アラート）
 *
 * iNaturalist で複数回議論された機能。
 * 侵入種早期警戒 + ユーザーモチベーションの両立。
 */
class DistributionAnalyzer
{
    private const STATS_FILE = DATA_DIR . '/config/distribution_stats.json';
    private const RARE_THRESHOLD = 5;

    private static ?array $stats = null;

    public static function load(): array
    {
        if (self::$stats !== null) return self::$stats;
        if (file_exists(self::STATS_FILE)) {
            self::$stats = json_decode(file_get_contents(self::STATS_FILE), true) ?: [];
        } else {
            self::$stats = [];
        }
        return self::$stats;
    }

    /**
     * 種×地域の分布珍しさを判定
     *
     * @param string $speciesName 種名
     * @param float $lat 緯度
     * @param float $lng 経度
     * @return array{is_rare: bool, rarity_level: string, message: string|null, area_name: string, observation_count: int}
     */
    public static function checkRarity(string $speciesName, float $lat, float $lng): array
    {
        $stats = self::load();
        $areaName = self::resolveAreaName($lat, $lng);
        $key = self::buildKey($speciesName, $areaName);

        $count = $stats[$key]['count'] ?? 0;

        if ($count === 0) {
            return [
                'is_rare' => true,
                'rarity_level' => 'area_first',
                'message' => "{$areaName}で{$speciesName}は初記録の可能性があります！",
                'area_name' => $areaName,
                'observation_count' => 0,
            ];
        }

        if ($count < self::RARE_THRESHOLD) {
            return [
                'is_rare' => true,
                'rarity_level' => 'rare',
                'message' => "{$areaName}では{$speciesName}は珍しい観察です（過去{$count}件）",
                'area_name' => $areaName,
                'observation_count' => $count,
            ];
        }

        return [
            'is_rare' => false,
            'rarity_level' => 'common',
            'message' => null,
            'area_name' => $areaName,
            'observation_count' => $count,
        ];
    }

    /**
     * 観察投稿時に分布異常をチェックし、結果を observation に付加
     *
     * @param array $observation 観察データ
     * @return array|null 分布異常情報 or null
     */
    public static function analyzeObservation(array $observation): ?array
    {
        $speciesName = $observation['taxon']['name']
            ?? $observation['taxon_name']
            ?? $observation['species_name']
            ?? '';
        if (empty($speciesName)) return null;

        $lat = (float)($observation['latitude'] ?? $observation['lat'] ?? 0);
        $lng = (float)($observation['longitude'] ?? $observation['lng'] ?? 0);
        if (!$lat || !$lng) return null;

        $result = self::checkRarity($speciesName, $lat, $lng);
        return $result['is_rare'] ? $result : null;
    }

    /**
     * バッチ計算: 全観察から種×地域の分布統計を算出
     */
    public static function recalculate(): array
    {
        $observations = DataStore::fetchAll('observations');
        $stats = [];

        foreach ($observations as $obs) {
            $name = $obs['taxon']['name'] ?? $obs['taxon_name'] ?? $obs['species_name'] ?? '';
            if (empty($name)) continue;

            $lat = (float)($obs['latitude'] ?? $obs['lat'] ?? 0);
            $lng = (float)($obs['longitude'] ?? $obs['lng'] ?? 0);
            if (!$lat || !$lng) continue;

            $area = self::resolveAreaName($lat, $lng);
            $key = self::buildKey($name, $area);

            if (!isset($stats[$key])) {
                $stats[$key] = [
                    'species_name' => $name,
                    'area_name' => $area,
                    'count' => 0,
                    'last_observed' => '',
                ];
            }
            $stats[$key]['count']++;
            $created = $obs['created_at'] ?? '';
            if ($created > $stats[$key]['last_observed']) {
                $stats[$key]['last_observed'] = $created;
            }
        }

        $dir = dirname(self::STATS_FILE);
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        file_put_contents(self::STATS_FILE, json_encode($stats, JSON_UNESCAPED_UNICODE));
        self::$stats = $stats;

        return $stats;
    }

    /**
     * 緯度経度から市区町村レベルの地域名を推定
     * 簡易版: 0.1度グリッド（約10km）でグルーピング
     */
    private static function resolveAreaName(float $lat, float $lng): string
    {
        $gridLat = round($lat, 1);
        $gridLng = round($lng, 1);

        $prefectures = self::getPrefectureGrid();
        $key = "{$gridLat},{$gridLng}";
        if (isset($prefectures[$key])) {
            return $prefectures[$key];
        }

        $closestDist = PHP_FLOAT_MAX;
        $closestPref = "grid_{$gridLat}_{$gridLng}";
        foreach ($prefectures as $gridKey => $pref) {
            [$pLat, $pLng] = explode(',', $gridKey);
            $dist = abs((float)$pLat - $gridLat) + abs((float)$pLng - $gridLng);
            if ($dist < $closestDist) {
                $closestDist = $dist;
                $closestPref = $pref;
            }
        }
        return $closestDist < 0.5 ? $closestPref : "grid_{$gridLat}_{$gridLng}";
    }

    private static function buildKey(string $speciesName, string $areaName): string
    {
        return mb_strtolower($speciesName) . '@' . $areaName;
    }

    /**
     * 主要都市の概略グリッド座標 → 都道府県マッピング
     */
    private static function getPrefectureGrid(): array
    {
        return [
            '43.1,141.3' => '北海道', '40.8,140.7' => '青森県', '39.7,141.2' => '岩手県',
            '38.3,140.9' => '宮城県', '39.7,140.1' => '秋田県', '38.2,140.3' => '山形県',
            '37.8,140.5' => '福島県', '36.3,140.4' => '茨城県', '36.6,139.9' => '栃木県',
            '36.4,139.1' => '群馬県', '35.9,139.6' => '埼玉県', '35.6,140.1' => '千葉県',
            '35.7,139.7' => '東京都', '35.4,139.6' => '神奈川県', '37.9,139.0' => '新潟県',
            '36.7,137.2' => '富山県', '36.6,136.6' => '石川県', '36.1,136.2' => '福井県',
            '35.7,138.6' => '山梨県', '36.2,138.2' => '長野県', '35.4,136.8' => '岐阜県',
            '34.9,138.4' => '静岡県', '35.2,137.0' => '愛知県', '34.7,136.5' => '三重県',
            '35.0,135.9' => '滋賀県', '35.0,135.8' => '京都府', '34.7,135.5' => '大阪府',
            '34.7,135.2' => '兵庫県', '34.7,135.8' => '奈良県', '34.2,135.2' => '和歌山県',
            '35.5,134.2' => '鳥取県', '35.5,133.1' => '島根県', '34.7,133.9' => '岡山県',
            '34.4,132.5' => '広島県', '34.2,131.5' => '山口県', '34.1,134.6' => '徳島県',
            '34.3,134.0' => '香川県', '33.8,132.8' => '愛媛県', '33.6,133.5' => '高知県',
            '33.6,130.4' => '福岡県', '33.2,130.3' => '佐賀県', '32.7,129.9' => '長崎県',
            '32.8,130.7' => '熊本県', '33.2,131.6' => '大分県', '31.9,131.4' => '宮崎県',
            '31.6,130.6' => '鹿児島県', '26.3,127.8' => '沖縄県',
        ];
    }
}
