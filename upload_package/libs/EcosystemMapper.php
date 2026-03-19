<?php

/**
 * EcosystemMapper.php — エリア3D生態系モデル構築エンジン
 *
 * 複数のセンサーデータ（GPS、カメラ検出、音声検出、LiDAR点群、
 * 加速度、気圧）を統合し、エリアの生態系デジタルツインを構築する。
 *
 * データ構造:
 *   Area → Zone[] → Layer[] → Organism[]
 *   時間軸: 各要素にタイムスタンプ → 季節変動・経年変化を追跡
 *
 * 出力:
 *   - 3D空間マップ（GeoJSON + 高さ情報）
 *   - 種分布ヒートマップ
 *   - 時系列変動グラフデータ
 *   - エリア生物多様性スコア
 */

class EcosystemMapper
{
    // === ゾーンタイプ（微生息地） ===
    const ZONE_CANOPY = 'canopy';         // 樹冠
    const ZONE_UNDERSTORY = 'understory'; // 林床
    const ZONE_GROUND = 'ground';         // 地表
    const ZONE_WATER = 'water';           // 水域
    const ZONE_AERIAL = 'aerial';         // 空中

    // === レイヤー（検出ソース） ===
    const LAYER_VISUAL = 'visual';   // カメラ検出
    const LAYER_AUDIO = 'audio';     // 音声検出
    const LAYER_LIDAR = 'lidar';     // 3D点群
    const LAYER_SENSOR = 'sensor';   // 環境センサー

    /**
     * フィールドスキャンセッションのデータを統合してエリアモデルを構築する。
     *
     * @param array  $scanData  スキャンデータ {
     *   route: [{lat, lng, alt, timestamp, heading}],
     *   detections: [{type, taxon_name, confidence, lat, lng, alt, zone, ...}],
     *   audio_events: [{taxon_name, confidence, lat, lng, timestamp, ...}],
     *   lidar_summary: [{zone_type, area_m2, height_m, vegetation_density, ...}],
     *   environment: [{temperature, humidity, pressure, light_level, timestamp}],
     * }
     * @param string $areaId    エリアID（同じエリアの蓄積用）
     * @param string $userId    ユーザーID
     * @return array エリアモデル
     */
    public static function buildAreaModel(array $scanData, string $areaId, string $userId): array
    {
        $model = self::loadOrCreateModel($areaId);

        // セッション追加
        $sessionId = 'fscan_' . bin2hex(random_bytes(6));
        $session = [
            'id' => $sessionId,
            'user_id' => $userId,
            'started_at' => $scanData['route'][0]['timestamp'] ?? date('c'),
            'ended_at' => end($scanData['route'])['timestamp'] ?? date('c'),
            'route' => $scanData['route'] ?? [],
            'device' => $scanData['device'] ?? 'unknown',
        ];

        // 検出データをゾーンに分類
        $organisms = self::processDetections($scanData['detections'] ?? [], $sessionId);
        $audioOrganisms = self::processAudioEvents($scanData['audio_events'] ?? [], $sessionId);

        // LiDAR データから植生構造を更新
        $vegetationStructure = self::processLidarData($scanData['lidar_summary'] ?? []);

        // 環境データ
        $environment = self::processEnvironment($scanData['environment'] ?? []);

        // モデルに統合
        $model['sessions'][] = $session;
        $model['organisms'] = self::mergeOrganisms($model['organisms'], array_merge($organisms, $audioOrganisms));
        $model['vegetation'] = self::mergeVegetation($model['vegetation'], $vegetationStructure);
        $model['environment_history'][] = $environment;
        $model['updated_at'] = date('c');
        $model['scan_count'] = count($model['sessions']);

        // バウンディングボックス更新
        $model['bounds'] = self::updateBounds($model['bounds'], $scanData['route'] ?? []);

        // エリアスコア再計算
        $model['biodiversity_score'] = self::calculateAreaScore($model);

        // 保存
        self::saveModel($areaId, $model);

        return $model;
    }

    /**
     * エリアモデルの3D GeoJSON 表現を生成する。
     *
     * @param string $areaId
     * @return array GeoJSON FeatureCollection + 3D拡張
     */
    public static function toGeoJSON3D(string $areaId): array
    {
        $model = self::loadOrCreateModel($areaId);
        $features = [];

        // ルート（ラインストリング）
        foreach ($model['sessions'] as $session) {
            if (empty($session['route'])) continue;
            $coords = array_map(fn($p) => [
                $p['lng'], $p['lat'], $p['alt'] ?? 0,
            ], $session['route']);

            $features[] = [
                'type' => 'Feature',
                'geometry' => [
                    'type' => 'LineString',
                    'coordinates' => $coords,
                ],
                'properties' => [
                    'type' => 'route',
                    'session_id' => $session['id'],
                    'user_id' => $session['user_id'],
                    'timestamp' => $session['started_at'],
                ],
            ];
        }

        // 生物検出ポイント（3D座標付き）
        foreach ($model['organisms'] as $org) {
            $features[] = [
                'type' => 'Feature',
                'geometry' => [
                    'type' => 'Point',
                    'coordinates' => [$org['lng'], $org['lat'], $org['alt'] ?? 0],
                ],
                'properties' => [
                    'type' => 'organism',
                    'taxon_name' => $org['taxon_name'],
                    'scientific_name' => $org['scientific_name'] ?? '',
                    'zone' => $org['zone'],
                    'detection_type' => $org['detection_type'],
                    'confidence' => $org['best_confidence'],
                    'observation_count' => $org['observation_count'],
                    'first_seen' => $org['first_seen'],
                    'last_seen' => $org['last_seen'],
                    'seasonal_pattern' => $org['seasonal_pattern'] ?? null,
                ],
            ];
        }

        // 植生ゾーン（ポリゴン + 高さ）
        foreach ($model['vegetation'] as $veg) {
            if (empty($veg['polygon'])) continue;
            $features[] = [
                'type' => 'Feature',
                'geometry' => [
                    'type' => 'Polygon',
                    'coordinates' => [$veg['polygon']],
                ],
                'properties' => [
                    'type' => 'vegetation_zone',
                    'zone_type' => $veg['zone_type'],
                    'height_m' => $veg['height_m'],
                    'density' => $veg['density'],
                    'canopy_cover' => $veg['canopy_cover'] ?? null,
                ],
            ];
        }

        return [
            'type' => 'FeatureCollection',
            'features' => $features,
            'properties' => [
                'area_id' => $areaId,
                'biodiversity_score' => $model['biodiversity_score'],
                'total_species' => count($model['organisms']),
                'total_scans' => $model['scan_count'],
                'bounds' => $model['bounds'],
                'updated_at' => $model['updated_at'],
            ],
        ];
    }

    /**
     * エリアの時系列変動データを取得する。
     *
     * @param string $areaId
     * @return array 月別の種数・検出数・スコア
     */
    public static function getTimeline(string $areaId): array
    {
        $model = self::loadOrCreateModel($areaId);
        $byMonth = [];

        foreach ($model['organisms'] as $org) {
            foreach ($org['sightings'] ?? [] as $sighting) {
                $month = substr($sighting['timestamp'] ?? '', 0, 7);
                if (!$month) continue;
                if (!isset($byMonth[$month])) {
                    $byMonth[$month] = ['species' => [], 'detections' => 0];
                }
                $byMonth[$month]['species'][$org['taxon_name']] = true;
                $byMonth[$month]['detections']++;
            }
        }

        ksort($byMonth);
        return array_map(fn($month, $data) => [
            'month' => $month,
            'species_count' => count($data['species']),
            'detection_count' => $data['detections'],
        ], array_keys($byMonth), array_values($byMonth));
    }

    /**
     * 種分布ヒートマップデータを生成する。
     *
     * @param string $areaId
     * @param string|null $taxonFilter 特定種でフィルタ
     * @return array [[lat, lng, intensity], ...]
     */
    public static function getHeatmap(string $areaId, ?string $taxonFilter = null): array
    {
        $model = self::loadOrCreateModel($areaId);
        $points = [];

        foreach ($model['organisms'] as $org) {
            if ($taxonFilter && $org['taxon_name'] !== $taxonFilter) continue;

            $points[] = [
                $org['lat'],
                $org['lng'],
                min(1.0, $org['observation_count'] / 10), // 正規化
            ];
        }

        return $points;
    }

    // === 内部処理 ===

    private static function processDetections(array $detections, string $sessionId): array
    {
        $organisms = [];
        foreach ($detections as $det) {
            if (($det['confidence'] ?? 0) < 0.4) continue;

            $key = ($det['taxon_name'] ?? 'unknown') . '_' . round($det['lat'] ?? 0, 4) . '_' . round($det['lng'] ?? 0, 4);

            if (!isset($organisms[$key])) {
                $organisms[$key] = [
                    'taxon_name' => $det['taxon_name'],
                    'scientific_name' => $det['scientific_name'] ?? '',
                    'lat' => $det['lat'],
                    'lng' => $det['lng'],
                    'alt' => $det['alt'] ?? 0,
                    'zone' => $det['zone'] ?? self::inferZone($det),
                    'detection_type' => $det['type'] ?? 'visual',
                    'best_confidence' => $det['confidence'],
                    'observation_count' => 0,
                    'first_seen' => $det['timestamp'] ?? date('c'),
                    'last_seen' => $det['timestamp'] ?? date('c'),
                    'sightings' => [],
                ];
            }

            $organisms[$key]['observation_count']++;
            $organisms[$key]['best_confidence'] = max($organisms[$key]['best_confidence'], $det['confidence']);
            $organisms[$key]['last_seen'] = $det['timestamp'] ?? date('c');
            $organisms[$key]['sightings'][] = [
                'session_id' => $sessionId,
                'timestamp' => $det['timestamp'] ?? date('c'),
                'confidence' => $det['confidence'],
            ];
        }

        return array_values($organisms);
    }

    private static function processAudioEvents(array $events, string $sessionId): array
    {
        return self::processDetections(
            array_map(fn($e) => array_merge($e, ['type' => 'audio']), $events),
            $sessionId
        );
    }

    private static function processLidarData(array $lidarSummary): array
    {
        return array_map(fn($zone) => [
            'zone_type' => $zone['zone_type'] ?? 'ground',
            'height_m' => $zone['height_m'] ?? 0,
            'area_m2' => $zone['area_m2'] ?? 0,
            'density' => $zone['vegetation_density'] ?? 0,
            'canopy_cover' => $zone['canopy_cover'] ?? null,
            'polygon' => $zone['polygon'] ?? null,
        ], $lidarSummary);
    }

    private static function processEnvironment(array $envData): array
    {
        if (empty($envData)) return [];
        return [
            'timestamp' => date('c'),
            'temperature' => $envData[0]['temperature'] ?? null,
            'humidity' => $envData[0]['humidity'] ?? null,
            'pressure' => $envData[0]['pressure'] ?? null,
            'light_level' => $envData[0]['light_level'] ?? null,
        ];
    }

    private static function inferZone(array $detection): string
    {
        $alt = $detection['relative_height'] ?? $detection['alt'] ?? 0;
        if ($alt > 5) return self::ZONE_CANOPY;
        if ($alt > 1) return self::ZONE_UNDERSTORY;
        return self::ZONE_GROUND;
    }

    private static function mergeOrganisms(array $existing, array $new): array
    {
        $merged = [];
        foreach ($existing as $org) {
            $merged[$org['taxon_name']] = $org;
        }

        foreach ($new as $org) {
            $key = $org['taxon_name'];
            if (isset($merged[$key])) {
                $merged[$key]['observation_count'] += $org['observation_count'];
                $merged[$key]['best_confidence'] = max($merged[$key]['best_confidence'], $org['best_confidence']);
                $merged[$key]['last_seen'] = max($merged[$key]['last_seen'], $org['last_seen']);
                $merged[$key]['sightings'] = array_merge($merged[$key]['sightings'] ?? [], $org['sightings'] ?? []);
                // 季節パターン更新
                $merged[$key]['seasonal_pattern'] = self::buildSeasonalPattern($merged[$key]['sightings']);
            } else {
                $merged[$key] = $org;
            }
        }

        return array_values($merged);
    }

    private static function mergeVegetation(array $existing, array $new): array
    {
        // 新しいデータで上書き（LiDAR は毎回新しい方が正確）
        return !empty($new) ? $new : $existing;
    }

    private static function updateBounds(array $bounds, array $route): array
    {
        $minLat = $bounds['min_lat'] ?? 90;
        $maxLat = $bounds['max_lat'] ?? -90;
        $minLng = $bounds['min_lng'] ?? 180;
        $maxLng = $bounds['max_lng'] ?? -180;

        foreach ($route as $p) {
            $minLat = min($minLat, $p['lat']);
            $maxLat = max($maxLat, $p['lat']);
            $minLng = min($minLng, $p['lng']);
            $maxLng = max($maxLng, $p['lng']);
        }

        return compact('minLat', 'maxLat', 'minLng', 'maxLng');
    }

    private static function buildSeasonalPattern(array $sightings): array
    {
        $byMonth = array_fill(1, 12, 0);
        foreach ($sightings as $s) {
            $month = (int) date('n', strtotime($s['timestamp'] ?? 'now'));
            $byMonth[$month]++;
        }
        return $byMonth;
    }

    private static function calculateAreaScore(array $model): array
    {
        $speciesCount = count($model['organisms']);
        $totalObs = array_sum(array_column($model['organisms'], 'observation_count'));
        $zoneCount = count(array_unique(array_column($model['organisms'], 'zone')));
        $sessionCount = count($model['sessions']);

        // Simpson's Diversity Index
        $simpson = 0;
        if ($totalObs > 1) {
            foreach ($model['organisms'] as $org) {
                $p = $org['observation_count'] / $totalObs;
                $simpson += $p * $p;
            }
            $simpson = 1 - $simpson;
        }

        return [
            'species_richness' => $speciesCount,
            'simpson_diversity' => round($simpson, 3),
            'zone_coverage' => $zoneCount,
            'monitoring_effort' => $sessionCount,
            'total_observations' => $totalObs,
            'score' => min(100, (int) ($speciesCount * 5 + $simpson * 30 + $zoneCount * 10 + min($sessionCount, 10) * 2)),
        ];
    }

    // === 永続化 ===

    private static function loadOrCreateModel(string $areaId): array
    {
        $file = self::modelPath($areaId);
        if (file_exists($file)) {
            $data = json_decode(file_get_contents($file), true);
            if ($data) return $data;
        }

        return [
            'area_id' => $areaId,
            'created_at' => date('c'),
            'updated_at' => date('c'),
            'scan_count' => 0,
            'sessions' => [],
            'organisms' => [],
            'vegetation' => [],
            'environment_history' => [],
            'bounds' => [],
            'biodiversity_score' => [],
        ];
    }

    private static function saveModel(string $areaId, array $model): void
    {
        $dir = dirname(self::modelPath($areaId));
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        file_put_contents(
            self::modelPath($areaId),
            json_encode($model, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT),
            LOCK_EX
        );
    }

    private static function modelPath(string $areaId): string
    {
        $dataDir = defined('DATA_DIR') ? DATA_DIR : __DIR__ . '/../data/';
        return $dataDir . 'ecosystem_maps/' . preg_replace('/[^a-zA-Z0-9_-]/', '', $areaId) . '.json';
    }
}
