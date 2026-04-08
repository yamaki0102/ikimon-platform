<?php
declare(strict_types=1);

/**
 * GbifOccurrenceService — GBIF Occurrence API による広域種記録取得
 *
 * 指定座標周辺の GBIF 登録済み種カウントを facet クエリで効率的に取得。
 * DataStore キャッシュ（7日TTL）で API コールを最小化。
 */

require_once __DIR__ . '/../DataStore.php';
require_once __DIR__ . '/GbifService.php';

class GbifOccurrenceService
{
    const API_BASE = 'https://api.gbif.org/v1';
    const CACHE_PREFIX = 'gbif_cache/occ';
    const CACHE_TTL = 86400 * 7; // 7日
    const GRID_SIZE = 1000; // ~1km グリッド

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
     * GBIF Occurrence Search API (facet) を呼び出す
     */
    private static function fetchFromApi(float $lat, float $lng, int $radiusKm): array
    {
        $latOffset = $radiusKm / 111.32;
        $lngOffset = $radiusKm / (111.32 * cos(deg2rad($lat)));

        $params = http_build_query([
            'hasCoordinate' => 'true',
            'country' => 'JP',
            'limit' => 0,
            'facet' => 'speciesKey',
            'facetLimit' => 200,
        ]);

        $latRange = sprintf('%.4f,%4f', $lat - $latOffset, $lat + $latOffset);
        $lngRange = sprintf('%.4f,%.4f', $lng - $lngOffset, $lng + $lngOffset);

        $url = self::API_BASE . "/occurrence/search?{$params}"
            . "&decimalLatitude={$latRange}"
            . "&decimalLongitude={$lngRange}";

        $response = self::httpGet($url);
        if (!$response) {
            return self::emptyResult();
        }

        $data = json_decode($response, true);
        if (!$data || !isset($data['count'])) {
            return self::emptyResult();
        }

        return self::normalize($data);
    }

    /**
     * API レスポンスを正規化
     */
    private static function normalize(array $data): array
    {
        $totalRecords = $data['count'] ?? 0;
        $facets = $data['facets'] ?? [];

        $speciesFacet = [];
        foreach ($facets as $f) {
            if (($f['field'] ?? '') === 'SPECIES_KEY') {
                $speciesFacet = $f['counts'] ?? [];
                break;
            }
        }

        $topSpecies = [];
        $kingdoms = [];

        usort($speciesFacet, fn($a, $b) => ($b['count'] ?? 0) <=> ($a['count'] ?? 0));

        $resolveLimit = 20;
        $index = 0;
        foreach ($speciesFacet as $entry) {
            $taxonKey = (int)($entry['name'] ?? 0);
            $count = (int)($entry['count'] ?? 0);
            if ($taxonKey <= 0) continue;

            if ($index < $resolveLimit) {
                $speciesInfo = self::resolveSpeciesName($taxonKey);
                $topSpecies[] = [
                    'taxon_key' => $taxonKey,
                    'count' => $count,
                    'scientific_name' => $speciesInfo['scientific_name'] ?? "species_{$taxonKey}",
                    'kingdom' => $speciesInfo['kingdom'] ?? null,
                ];
                $kingdom = $speciesInfo['kingdom'] ?? 'Unknown';
                $kingdoms[$kingdom] = ($kingdoms[$kingdom] ?? 0) + $count;
            } else {
                $topSpecies[] = [
                    'taxon_key' => $taxonKey,
                    'count' => $count,
                    'scientific_name' => "species_{$taxonKey}",
                    'kingdom' => null,
                ];
            }
            $index++;
        }

        return [
            'species_count' => count($topSpecies),
            'total_records' => $totalRecords,
            'top_species' => $topSpecies,
            'kingdoms' => $kingdoms,
            'fetched_at' => date('c'),
        ];
    }

    /**
     * taxon_key から種名を解決（GbifService のキャッシュを活用）
     */
    private static function resolveSpeciesName(int $taxonKey): array
    {
        $cacheKey = 'gbif_cache/species/' . $taxonKey;
        $cached = DataStore::get($cacheKey);
        if ($cached && isset($cached['_cached_at'])) {
            if (time() - $cached['_cached_at'] < 86400 * 30) {
                return $cached;
            }
        }

        $url = self::API_BASE . "/species/{$taxonKey}";
        $response = self::httpGet($url);
        if (!$response) {
            return ['scientific_name' => "species_{$taxonKey}", 'kingdom' => null];
        }

        $data = json_decode($response, true);
        $result = [
            'scientific_name' => $data['scientificName'] ?? $data['canonicalName'] ?? "species_{$taxonKey}",
            'kingdom' => $data['kingdom'] ?? null,
            'family' => $data['family'] ?? null,
            'rank' => $data['rank'] ?? null,
            '_cached_at' => time(),
        ];

        DataStore::save($cacheKey, $result);
        return $result;
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
            'kingdoms' => [],
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
