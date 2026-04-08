<?php
declare(strict_types=1);

/**
 * iNatOccurrenceService — iNaturalist API による広域種記録取得
 *
 * /observations/species_counts エンドポイントで指定座標周辺の
 * Research Grade 種カウントを効率的に取得。
 * DataStore キャッシュ（7日TTL）で API コールを最小化。
 */

require_once __DIR__ . '/../DataStore.php';

class iNatOccurrenceService
{
    const API_BASE = 'https://api.inaturalist.org/v1';
    const CACHE_PREFIX = 'inat_cache/occ';
    const CACHE_TTL = 86400 * 7; // 7日

    /**
     * 指定座標周辺の種カウントを取得
     *
     * @param float $lat 中心緯度
     * @param float $lng 中心経度
     * @param int $radiusKm 半径 (km)
     * @return array 正規化された種カウントデータ
     */
    public static function search(float $lat, float $lng, int $radiusKm = 5): array
    {
        $cacheKey = self::cacheKey($lat, $lng, $radiusKm);
        $cached = DataStore::get($cacheKey);
        if ($cached && isset($cached['_cached_at'])) {
            if (time() - $cached['_cached_at'] < self::CACHE_TTL) {
                return $cached;
            }
        }

        $result = self::fetchFromApi($lat, $lng, $radiusKm);
        if (!empty($result)) {
            $result['_cached_at'] = time();
            DataStore::save($cacheKey, $result);
        }

        return $result;
    }

    /**
     * iNaturalist species_counts API を呼び出す
     */
    private static function fetchFromApi(float $lat, float $lng, int $radiusKm): array
    {
        $params = http_build_query([
            'lat' => round($lat, 6),
            'lng' => round($lng, 6),
            'radius' => $radiusKm,
            'quality_grade' => 'research',
            'per_page' => 200,
        ]);

        $url = self::API_BASE . "/observations/species_counts?{$params}";

        $response = self::httpGet($url);
        if (!$response) {
            return self::emptyResult();
        }

        $data = json_decode($response, true);
        if (!$data || !isset($data['results'])) {
            return self::emptyResult();
        }

        return self::normalize($data);
    }

    /**
     * API レスポンスを正規化
     */
    private static function normalize(array $data): array
    {
        $totalResults = $data['total_results'] ?? 0;
        $results = $data['results'] ?? [];

        $topSpecies = [];
        foreach ($results as $entry) {
            $taxon = $entry['taxon'] ?? [];
            $topSpecies[] = [
                'name' => $taxon['preferred_common_name'] ?? $taxon['name'] ?? '',
                'scientific_name' => $taxon['name'] ?? '',
                'count' => (int)($entry['count'] ?? 0),
                'iconic_taxon' => $taxon['iconic_taxon_name'] ?? null,
            ];
        }

        return [
            'species_count' => count($topSpecies),
            'total_records' => $totalResults,
            'top_species' => $topSpecies,
            'fetched_at' => date('c'),
        ];
    }

    private static function cacheKey(float $lat, float $lng, int $radiusKm): string
    {
        $gridLat = round($lat, 2);
        $gridLng = round($lng, 2);
        return self::CACHE_PREFIX . "/{$gridLat}_{$gridLng}_r{$radiusKm}";
    }

    private static function emptyResult(): array
    {
        return [
            'species_count' => 0,
            'total_records' => 0,
            'top_species' => [],
            'fetched_at' => date('c'),
        ];
    }

    private static function httpGet(string $url): ?string
    {
        static $lastRequestTime = 0;

        $now = microtime(true);
        $elapsed = $now - $lastRequestTime;
        if ($elapsed < 1.0 && $lastRequestTime > 0) {
            usleep((int)((1.0 - $elapsed) * 1000000));
        }

        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => "Accept: application/json\r\nUser-Agent: ikimon.life/1.0 (biodiversity platform)\r\n",
                'timeout' => 15,
                'ignore_errors' => true,
            ],
        ]);

        $result = @file_get_contents($url, false, $context);
        $lastRequestTime = microtime(true);

        if ($result === false) return null;
        return $result;
    }
}
