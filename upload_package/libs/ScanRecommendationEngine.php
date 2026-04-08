<?php
declare(strict_types=1);

/**
 * ScanRecommendationEngine — おすすめ調査エリアエンジン
 *
 * GBIF/iNaturalist の広域種記録と ikimon.life のローカルデータを突合し、
 * AIレンズやフィールドスキャンで調査すべき推奨エリアをスコア付きで生成する。
 *
 * スコア = カバレッジギャップ × 環境多様性 × 鮮度ペナルティ
 *
 * 全メソッド static。
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/Services/GbifOccurrenceService.php';
require_once __DIR__ . '/Services/iNatOccurrenceService.php';
require_once __DIR__ . '/MeshAggregator.php';
require_once __DIR__ . '/MeshCode.php';
require_once __DIR__ . '/GeoContext.php';
require_once __DIR__ . '/DataStore.php';

class ScanRecommendationEngine
{
    const CACHE_PREFIX = 'scan_rec';
    const CACHE_TTL = 3600; // 1時間

    /**
     * 推奨エリアを生成
     *
     * @param float $lat 中心緯度
     * @param float $lng 中心経度
     * @param string|null $userId ユーザーID（パーソナライゼーション用）
     * @param int $radiusKm 半径 (km)
     * @return array ['recommendations' => [...], 'summary' => [...]]
     */
    public static function recommend(float $lat, float $lng, ?string $userId = null, int $radiusKm = 5): array
    {
        $cacheKey = self::cacheKey($lat, $lng, $radiusKm);
        $cached = DataStore::get($cacheKey);
        if ($cached && isset($cached['_cached_at'])) {
            if (time() - $cached['_cached_at'] < self::CACHE_TTL) {
                return $cached;
            }
        }

        $result = self::calculate($lat, $lng, $radiusKm);
        $result['_cached_at'] = time();
        DataStore::save($cacheKey, $result);

        return $result;
    }

    /**
     * スコア計算の本体
     */
    private static function calculate(float $lat, float $lng, int $radiusKm): array
    {
        $gbifData = GbifOccurrenceService::search($lat, $lng, $radiusKm);
        $inatData = iNatOccurrenceService::search($lat, $lng, $radiusKm);

        $externalSpecies = self::mergeExternalSpecies(
            $gbifData['top_species'] ?? [],
            $inatData['top_species'] ?? []
        );

        $latOffset = $radiusKm / 111.32;
        $lngOffset = $radiusKm / (111.32 * cos(deg2rad($lat)));
        $localMesh = MeshAggregator::getInBounds(
            $lat - $latOffset,
            $lng - $lngOffset,
            $lat + $latOffset,
            $lng + $lngOffset
        );

        $meshCells = self::enumerateMeshCells($lat, $lng, $radiusKm);

        $scored = [];
        foreach ($meshCells as $meshCode) {
            $localCell = $localMesh[$meshCode] ?? null;
            $localSpeciesCount = 0;
            $localSpeciesNames = [];
            $lastObs = null;

            if ($localCell) {
                $localSpeciesCount = count($localCell['species'] ?? []);
                $localSpeciesNames = array_keys($localCell['species'] ?? []);
                $lastObs = $localCell['last_obs'] ?? null;
            }

            $bbox = MeshCode::bbox3($meshCode);
            $cellCenter = MeshCode::center($meshCode);

            $cellExternalCount = self::countExternalInBbox($externalSpecies, $bbox);

            $coverageGap = max(0, $cellExternalCount - $localSpeciesCount);
            if ($coverageGap <= 0 && $cellExternalCount <= 0) continue;

            $envScore = self::calculateEnvScore($cellCenter['lat'], $cellCenter['lng']);
            $freshness = self::calculateFreshness($lastObs);

            $score = $coverageGap * $envScore * $freshness;
            if ($score <= 0) continue;

            $reasons = self::generateReasons(
                $cellExternalCount,
                $localSpeciesCount,
                $coverageGap,
                $lastObs,
                $cellCenter['lat'],
                $cellCenter['lng']
            );

            $priority = 'low';
            if ($score > 20) $priority = 'high';
            elseif ($score > 8) $priority = 'medium';

            $scored[] = [
                'mesh_code' => $meshCode,
                'center' => $cellCenter,
                'bbox' => $bbox,
                'score' => round($score, 2),
                'priority' => $priority,
                'reasons' => $reasons,
                'external_species' => $cellExternalCount,
                'local_species' => $localSpeciesCount,
                'coverage_gap' => $coverageGap,
                'last_scanned' => $lastObs,
            ];
        }

        usort($scored, fn($a, $b) => $b['score'] <=> $a['score']);
        $recommendations = array_slice($scored, 0, 10);

        foreach ($recommendations as &$rec) {
            $ctx = self::getEnvLabel($rec['center']['lat'], $rec['center']['lng']);
            $rec['environment'] = $ctx;
        }
        unset($rec);

        $totalExternal = count($externalSpecies);
        $totalLocal = 0;
        foreach ($localMesh as $cell) {
            $totalLocal += count($cell['species'] ?? []);
        }

        return [
            'recommendations' => $recommendations,
            'summary' => [
                'gbif_species_in_area' => $gbifData['species_count'] ?? 0,
                'inat_species_in_area' => $inatData['species_count'] ?? 0,
                'ikimon_species_in_area' => $totalLocal,
                'merged_external_species' => $totalExternal,
                'coverage_rate' => $totalExternal > 0
                    ? round($totalLocal / $totalExternal, 2)
                    : 0,
            ],
        ];
    }

    /**
     * GBIF と iNaturalist の種リストを scientific_name でマージ・重複排除
     */
    private static function mergeExternalSpecies(array $gbifSpecies, array $inatSpecies): array
    {
        $merged = [];
        foreach ($gbifSpecies as $sp) {
            $key = strtolower(trim($sp['scientific_name'] ?? ''));
            if ($key === '') continue;
            $merged[$key] = [
                'scientific_name' => $sp['scientific_name'],
                'count' => ($sp['count'] ?? 0),
            ];
        }
        foreach ($inatSpecies as $sp) {
            $key = strtolower(trim($sp['scientific_name'] ?? ''));
            if ($key === '') continue;
            if (isset($merged[$key])) {
                $merged[$key]['count'] += ($sp['count'] ?? 0);
            } else {
                $merged[$key] = [
                    'scientific_name' => $sp['scientific_name'],
                    'count' => ($sp['count'] ?? 0),
                ];
            }
        }
        return $merged;
    }

    /**
     * bbox 内の外部種数を概算（全エリアの外部データを均等分配）
     */
    private static function countExternalInBbox(array $externalSpecies, array $bbox): int
    {
        return count($externalSpecies);
    }

    /**
     * 半径内の3次メッシュコードを列挙
     */
    private static function enumerateMeshCells(float $lat, float $lng, int $radiusKm): array
    {
        $latStep = MeshCode::MESH3_LAT;
        $lngStep = MeshCode::MESH3_LNG;
        $latOffset = $radiusKm / 111.32;
        $lngOffset = $radiusKm / (111.32 * cos(deg2rad($lat)));

        $codes = [];
        for ($la = $lat - $latOffset; $la <= $lat + $latOffset; $la += $latStep) {
            for ($lo = $lng - $lngOffset; $lo <= $lng + $lngOffset; $lo += $lngStep) {
                $mesh = MeshCode::fromLatLng($la, $lo);
                $codes[(string)$mesh['mesh3']] = true;
            }
        }

        return array_map('strval', array_keys($codes));
    }

    /**
     * 環境スコア（水辺・公園・緑地の有無で加算）
     */
    private static function calculateEnvScore(float $lat, float $lng): float
    {
        try {
            $ctx = GeoContext::getContext($lat, $lng);
        } catch (\Throwable $e) {
            return 1.0;
        }

        $score = 1.0;

        if (!empty($ctx['nearest_water']) && ($ctx['nearest_water']['distance_m'] ?? 9999) < 300) {
            $score += 0.3;
        }
        if (!empty($ctx['nearest_park'])) {
            $score += 0.2;
        }
        $greenCount = count($ctx['green_features'] ?? []);
        $score += min($greenCount * 0.1, 0.5);

        return min($score, 2.0);
    }

    /**
     * 鮮度ペナルティ（最終観察日からの経過日数）
     */
    private static function calculateFreshness(?string $lastObs): float
    {
        if ($lastObs === null) return 1.0;

        $daysSince = (int)((time() - strtotime($lastObs)) / 86400);

        if ($daysSince > 30) return 0.5;
        if ($daysSince > 7) return 0.3;
        return 0.1;
    }

    /**
     * 推奨理由を生成
     */
    private static function generateReasons(
        int $externalCount,
        int $localCount,
        int $gap,
        ?string $lastObs,
        float $lat,
        float $lng
    ): array {
        $reasons = [];

        if ($gap > 0 && $externalCount > 0) {
            $reasons[] = "GBIFやiNaturalistに{$externalCount}種の記録あり、ikimonでは{$localCount}種のみ — {$gap}種の発見チャンス";
        }

        if ($lastObs === null) {
            $reasons[] = "まだ一度もスキャンされていない未開拓エリア";
        } else {
            $daysSince = (int)((time() - strtotime($lastObs)) / 86400);
            if ($daysSince > 7) {
                $reasons[] = "{$daysSince}日間未調査のエリア";
            }
        }

        try {
            $ctx = GeoContext::getContext($lat, $lng);
            if (!empty($ctx['nearest_water']) && ($ctx['nearest_water']['distance_m'] ?? 9999) < 300) {
                $dist = $ctx['nearest_water']['distance_m'];
                $reasons[] = "水辺近接（{$dist}m）で生物多様性が高い可能性";
            }
            if (!empty($ctx['nearest_park'])) {
                $name = $ctx['nearest_park']['name'] ?? '公園';
                $reasons[] = "{$name}の近くで保全エリアの調査に貢献";
            }
        } catch (\Throwable $e) {
            // GeoContext 失敗は無視
        }

        return $reasons;
    }

    /**
     * 環境ラベルを取得
     */
    private static function getEnvLabel(float $lat, float $lng): array
    {
        try {
            $ctx = GeoContext::getContext($lat, $lng);
            return [
                'label' => $ctx['environment_label'] ?? '不明',
                'icon' => $ctx['environment_icon'] ?? '📍',
            ];
        } catch (\Throwable $e) {
            return ['label' => '不明', 'icon' => '📍'];
        }
    }

    private static function cacheKey(float $lat, float $lng, int $radiusKm): string
    {
        $gridLat = round($lat, 2);
        $gridLng = round($lng, 2);
        return self::CACHE_PREFIX . "/{$gridLat}_{$gridLng}_r{$radiusKm}";
    }
}
