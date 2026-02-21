<?php

/**
 * GbifService - GBIF Backbone Taxonomy API Wrapper
 * 
 * 設計思想 (Citation-First Axiom):
 * - GBIF は裏方の「名寄せ」のみ。ユーザーには見せない。
 * - 学名を taxon_key にリンクし、Synonym を自動解決する。
 * - Vernacular Names (多言語通称名) を取得する。
 * - 結果は DataStore にキャッシュし、APIコールを最小化する。
 */

require_once __DIR__ . '/../DataStore.php';

class GbifService
{
    const API_BASE = 'https://api.gbif.org/v1';
    const CACHE_PREFIX = 'gbif_cache';
    const CACHE_TTL = 86400 * 30; // 30 days

    /**
     * Match a scientific name against GBIF Backbone
     * 
     * @param string $scientificName e.g. "Chelonia mydas japonica"
     * @return array|null { taxon_key, status, accepted_name, confidence, kingdom, family }
     */
    public static function matchName($scientificName)
    {
        if (empty($scientificName)) return null;

        // 1. Check Cache
        $cacheKey = self::CACHE_PREFIX . '/match/' . md5($scientificName);
        $cached = DataStore::get($cacheKey);
        if ($cached && isset($cached['_cached_at'])) {
            // Check TTL
            if (time() - $cached['_cached_at'] < self::CACHE_TTL) {
                return $cached;
            }
        }

        // 2. Call GBIF API
        $url = self::API_BASE . '/species/match?' . http_build_query([
            'name' => $scientificName,
            'strict' => 'false', // Allow fuzzy matching
            'verbose' => 'false'
        ]);

        $response = self::httpGet($url);
        if (!$response) return null;

        $data = json_decode($response, true);
        if (!$data || ($data['matchType'] ?? '') === 'NONE') return null;

        // 3. Normalize Response
        $result = [
            'taxon_key'     => $data['usageKey'] ?? null,
            'scientific_name' => $data['scientificName'] ?? $scientificName,
            'status'        => $data['status'] ?? 'UNKNOWN',        // ACCEPTED / SYNONYM / DOUBTFUL
            'match_type'    => $data['matchType'] ?? 'NONE',        // EXACT / FUZZY / HIGHERRANK
            'confidence'    => $data['confidence'] ?? 0,
            'accepted_key'  => $data['acceptedUsageKey'] ?? null,   // If SYNONYM, points to accepted
            'accepted_name' => null,                                 // Filled below if synonym
            'kingdom'       => $data['kingdom'] ?? null,
            'phylum'        => $data['phylum'] ?? null,
            'class'         => $data['class'] ?? null,
            'order'         => $data['order'] ?? null,
            'family'        => $data['family'] ?? null,
            'genus'         => $data['genus'] ?? null,
            'rank'          => $data['rank'] ?? null,
            'original_query' => $scientificName,
            '_cached_at'    => time()
        ];

        // If it's a synonym, the accepted name is in the response
        if ($result['status'] === 'SYNONYM' && isset($data['species'])) {
            $result['accepted_name'] = $data['species'];
        }

        // 4. Cache Result
        DataStore::save($cacheKey, $result);

        return $result;
    }

    /**
     * Get vernacular (common) names for a taxon
     * 
     * @param int $taxonKey GBIF taxon key
     * @return array [ { name, language }, ... ]
     */
    public static function getVernacularNames($taxonKey)
    {
        if (!$taxonKey) return [];

        // 1. Check Cache
        $cacheKey = self::CACHE_PREFIX . '/vernacular/' . $taxonKey;
        $cached = DataStore::get($cacheKey);
        if ($cached && isset($cached['_cached_at'])) {
            if (time() - $cached['_cached_at'] < self::CACHE_TTL) {
                return $cached['names'] ?? [];
            }
        }

        // 2. Call GBIF API
        $url = self::API_BASE . "/species/{$taxonKey}/vernacularNames?" . http_build_query([
            'limit' => 50
        ]);

        $response = self::httpGet($url);
        if (!$response) return [];

        $data = json_decode($response, true);
        $results = $data['results'] ?? [];

        // 3. Normalize - keep only name + language
        $names = [];
        foreach ($results as $item) {
            $names[] = [
                'name'     => $item['vernacularName'] ?? '',
                'language' => $item['language'] ?? 'und', // 'und' = undetermined
                'source'   => $item['source'] ?? ''
            ];
        }

        // 4. Cache
        DataStore::save($cacheKey, [
            'names' => $names,
            '_cached_at' => time()
        ]);

        return $names;
    }

    /**
     * Get the best vernacular name for a given language
     * 
     * @param int $taxonKey
     * @param string $lang ISO 639-1 code (e.g. "jpn", "eng")
     * @return string|null
     */
    public static function getLocalName($taxonKey, $lang = 'jpn')
    {
        $names = self::getVernacularNames($taxonKey);
        foreach ($names as $entry) {
            if (($entry['language'] ?? '') === $lang) {
                return $entry['name'];
            }
        }
        return null;
    }

    /**
     * Simple HTTP GET (no dependencies)
     */
    private static function httpGet($url)
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => "Accept: application/json\r\nUser-Agent: ikimon.life/1.0\r\n",
                'timeout' => 10,
                'ignore_errors' => true
            ]
        ]);

        $result = @file_get_contents($url, false, $context);
        if ($result === false) return null;

        return $result;
    }
}
