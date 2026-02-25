<?php

/**
 * TaxonSearchService — 3層統合種名検索
 * 
 * 設計書 taxonomy_database_design.md v3.0 Phase A 準拠。
 * Layer 1: ローカルリゾルバー（高速・オフライン可能）
 * Layer 2: iNaturalist Taxa API（多言語・代表画像）
 * Layer 3: GBIF Species API（フォールバック）
 */

require_once __DIR__ . '/TaxonData.php';

class TaxonSearchService
{
    private static string $inatBaseUrl = 'https://api.inaturalist.org/v1/taxa/autocomplete';
    private static string $gbifBaseUrl = 'https://api.gbif.org/v1/species/suggest';
    private static string $userAgent = 'ikimon-bot/1.0 (https://ikimon.life)';

    /**
     * 統合検索 — 3層 progressive loading
     *
     * @param string $query    検索クエリ
     * @param array  $options  ['locale'=>'ja', 'limit'=>20]
     * @return array  TaxonData::toSearchResult() の配列
     */
    public static function search(string $query, array $options = []): array
    {
        $locale = $options['locale'] ?? 'ja';
        $limit  = min((int)($options['limit'] ?? 20), 50);

        $normalized = self::normalizeQuery($query);
        if ($normalized === '') {
            return [];
        }

        // Layer 1: ローカルリゾルバー（高速）
        $local = self::searchLocal($normalized, $limit);

        // ローカルで十分なら Layer 2/3 はスキップ
        if (count($local) >= $limit) {
            return array_map(fn(TaxonData $td) => $td->toSearchResult(), $local);
        }

        // Layer 2: iNaturalist Taxa API
        $inat = self::searchINat($normalized, $limit, $locale);

        // Layer 3: GBIF Species API（ローカル+iNatで不足の場合のみ）
        $gbif = [];
        if (count($local) + count($inat) < $limit) {
            $gbif = self::searchGBIF($normalized, $limit);
        }

        // マージ・重複排除
        $merged = self::mergeResults($local, $inat, $gbif, $limit);

        return array_map(fn(TaxonData $td) => $td->toSearchResult(), $merged);
    }

    /**
     * 入力正規化
     *
     * 1. 全角英数字 → 半角英数字
     * 2. 半角カナ → 全角カナ
     * 3. トリム・連続スペース統一
     * 4. 先頭/末尾の句読点除去
     */
    public static function normalizeQuery(string $input): string
    {
        // 全角英数 → 半角 + 半角カナ → 全角
        $s = mb_convert_kana($input, 'asKV', 'UTF-8');

        // トリム・連続スペース正規化
        $s = trim($s);
        $s = preg_replace('/\s+/u', ' ', $s);

        // 先頭/末尾の句読点除去
        $s = preg_replace('/^[、。，．,.\s]+|[、。，．,.\s]+$/u', '', $s);

        return $s;
    }

    // ===== Layer 1: ローカルリゾルバー =====

    /**
     * ローカル taxon_resolver.json を検索
     * 和名・学名の部分一致
     */
    private static function searchLocal(string $query, int $limit): array
    {
        $resolverFile = DATA_DIR . '/taxon_resolver.json';
        if (!file_exists($resolverFile)) {
            return [];
        }

        $resolver = json_decode(file_get_contents($resolverFile), true);
        if (!$resolver) return [];

        $jpIndex = $resolver['jp_index'] ?? [];
        $taxa    = $resolver['taxa'] ?? [];
        $results = [];
        $seen    = []; // 重複排除用 slug セット

        // 和名から検索（優先）
        foreach ($jpIndex as $jpName => $slug) {
            if (str_starts_with($slug, '__jp__')) continue;
            if (mb_stripos($jpName, $query) === false) continue;

            $data = $taxa[$slug] ?? null;
            if (!$data) continue;
            if (isset($seen[$slug])) continue;

            $td = TaxonData::fromResolver($data);
            if (empty($td->commonNames['ja'])) {
                $td->commonNames['ja'] = $jpName;
            }
            $results[] = $td;
            $seen[$slug] = true;

            if (count($results) >= $limit) break;
        }

        // 学名でも検索（和名で足りなかった場合）
        if (count($results) < $limit) {
            $queryLower = strtolower($query);
            foreach ($taxa as $slug => $data) {
                if (isset($seen[$slug])) continue;
                $sciName = strtolower($data['accepted_name'] ?? '');
                if ($sciName && stripos($sciName, $queryLower) !== false) {
                    $results[] = TaxonData::fromResolver($data);
                    $seen[$slug] = true;
                    if (count($results) >= $limit) break;
                }
            }
        }

        return $results;
    }

    // ===== Layer 2: iNaturalist Taxa API =====

    /**
     * iNaturalist Taxa autocomplete API を呼び出す
     */
    private static function searchINat(string $query, int $limit, string $locale = 'ja'): array
    {
        $params = http_build_query([
            'q'        => $query,
            'locale'   => $locale,
            'per_page' => min($limit, 30),
        ]);
        $url = self::$inatBaseUrl . '?' . $params;

        $json = self::httpGet($url);
        if (!$json) return [];

        $data = json_decode($json, true);
        if (!isset($data['results']) || !is_array($data['results'])) {
            return [];
        }

        $results = [];
        foreach ($data['results'] as $r) {
            $results[] = TaxonData::fromINat($r);
        }
        return $results;
    }

    // ===== Layer 3: GBIF Species API =====

    /**
     * GBIF Species suggest API を呼び出す
     */
    private static function searchGBIF(string $query, int $limit): array
    {
        $params = http_build_query([
            'q'     => $query,
            'limit' => min($limit, 20),
        ]);
        $url = self::$gbifBaseUrl . '?' . $params;

        $json = self::httpGet($url);
        if (!$json) return [];

        $data = json_decode($json, true);
        if (!is_array($data)) return [];

        $results = [];
        foreach ($data as $r) {
            $results[] = TaxonData::fromGBIF($r);
        }
        return $results;
    }

    // ===== マージ・重複排除 =====

    /**
     * 3層の結果をマージし、学名ベースで重複排除。
     * ローカルソースを優先。
     */
    private static function mergeResults(array $local, array $inat, array $gbif, int $limit): array
    {
        $merged = [];
        $seen = [];

        // ローカル → iNat → GBIF の優先順で追加
        foreach ([$local, $inat, $gbif] as $layer) {
            foreach ($layer as $td) {
                $key = strtolower($td->scientificName);
                if ($key === '' || isset($seen[$key])) {
                    // 重複 — ただし情報を補完
                    if ($key !== '' && isset($seen[$key])) {
                        self::enrichExisting($merged[$seen[$key]], $td);
                    }
                    continue;
                }
                $seen[$key] = count($merged);
                $merged[] = $td;

                if (count($merged) >= $limit) break 2;
            }
        }

        return $merged;
    }

    /**
     * 既存のTaxonDataを後発ソースの情報で補完（破壊的更新）
     */
    private static function enrichExisting(TaxonData $existing, TaxonData $new): void
    {
        // 和名がなければ補完
        if (empty($existing->commonNames['ja']) && !empty($new->commonNames['ja'])) {
            $existing->commonNames['ja'] = $new->commonNames['ja'];
        }
        // 英名がなければ補完
        if (empty($existing->commonNames['en']) && !empty($new->commonNames['en'])) {
            $existing->commonNames['en'] = $new->commonNames['en'];
        }
        // サムネイルがなければ補完
        if ($existing->thumbnailUrl === null && $new->thumbnailUrl !== null) {
            $existing->thumbnailUrl = $new->thumbnailUrl;
        }
        // 系統情報がなければ補完
        if ($existing->lineage === null && $new->lineage !== null) {
            $existing->lineage = $new->lineage;
        }
        // iNat IDがなければ補完
        if ($existing->inatTaxonId === null && $new->inatTaxonId !== null) {
            $existing->inatTaxonId = $new->inatTaxonId;
        }
        // GBIF keyがなければ補完
        if ($existing->gbifKey === null && $new->gbifKey !== null) {
            $existing->gbifKey = $new->gbifKey;
        }
    }

    // ===== HTTP ヘルパー =====

    /**
     * HTTP GETリクエスト（タイムアウト5秒）
     */
    private static function httpGet(string $url): ?string
    {
        $options = [
            'http' => [
                'method'  => 'GET',
                'timeout' => 5,
                'header'  => "User-Agent: " . self::$userAgent . "\r\n",
            ],
        ];
        $context = stream_context_create($options);
        $response = @file_get_contents($url, false, $context);

        if ($response === false) {
            return null;
        }
        return $response;
    }
}
