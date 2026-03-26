<?php
/**
 * CrossRef API クライアント
 *
 * 学名を起点として CrossRef API から関連学術論文を取得する。
 * Phase 2: 論文自動取り込みの GBIF 以外のソース。
 *
 * API仕様: https://api.crossref.org/swagger-ui/index.html
 */
class CrossRefClient
{
    private const API_BASE = 'https://api.crossref.org';
    private const USER_AGENT = 'ikimon.life/1.0 (https://ikimon.life; mailto:info@ikimon.life)';
    private const CACHE_TTL = 86400 * 7; // 7日キャッシュ

    private string $cacheDir;
    private ?string $mailto;

    /**
     * @param string|null $mailto Polite Pool 用メールアドレス（レート優遇）
     */
    public function __construct(?string $mailto = null)
    {
        $this->mailto = $mailto;
        $this->cacheDir = (defined('DATA_DIR') ? DATA_DIR : __DIR__ . '/../data/') . 'crossref_cache/';
        if (!is_dir($this->cacheDir)) {
            @mkdir($this->cacheDir, 0755, true);
        }
    }

    /**
     * 学名で論文を検索
     *
     * @param string $scientificName 学名（例: "Canis lupus"）
     * @param int    $limit          最大取得件数
     * @param int    $offset         オフセット
     * @return array{items: array, total_results: int}
     */
    public function searchBySpecies(string $scientificName, int $limit = 20, int $offset = 0): array
    {
        $cacheKey = md5("species:{$scientificName}:{$limit}:{$offset}");
        $cached = $this->getCache($cacheKey);
        if ($cached !== null) {
            return $cached;
        }

        $params = [
            'query' => $scientificName,
            'filter' => 'type:journal-article',
            'rows' => min($limit, 100),
            'offset' => $offset,
            'sort' => 'relevance',
            'select' => 'DOI,title,author,published-print,published-online,container-title,abstract,subject,language,type',
        ];

        $response = $this->apiGet('/works', $params);
        if ($response === null) {
            return ['items' => [], 'total_results' => 0];
        }

        $result = [
            'items' => array_map([$this, 'normalizePaper'], $response['items'] ?? []),
            'total_results' => $response['total-results'] ?? 0,
        ];

        $this->setCache($cacheKey, $result);
        return $result;
    }

    /**
     * DOI で論文メタデータを取得
     *
     * @param string $doi DOI（例: "10.1234/abc"）
     * @return array|null 正規化された論文データ
     */
    public function getByDoi(string $doi): ?array
    {
        $cacheKey = md5("doi:{$doi}");
        $cached = $this->getCache($cacheKey);
        if ($cached !== null) {
            return $cached;
        }

        $response = $this->apiGet('/works/' . urlencode($doi));
        if ($response === null) {
            return null;
        }

        $result = $this->normalizePaper($response);
        $this->setCache($cacheKey, $result);
        return $result;
    }

    /**
     * 複数の学名で一括検索（バッチ処理用）
     *
     * @param array  $scientificNames 学名配列
     * @param int    $perSpecies      種あたりの最大件数
     * @return array 学名 => 論文配列
     */
    public function batchSearchBySpecies(array $scientificNames, int $perSpecies = 5): array
    {
        $results = [];
        foreach ($scientificNames as $name) {
            $response = $this->searchBySpecies($name, $perSpecies);
            $results[$name] = $response['items'];
            // Polite Pool: リクエスト間に1秒待機
            usleep(1000000);
        }
        return $results;
    }

    /**
     * CrossRef 論文データを ikimon.life 標準フォーマットに正規化
     */
    private function normalizePaper(array $item): array
    {
        $published = $item['published-print']['date-parts'][0]
            ?? $item['published-online']['date-parts'][0]
            ?? null;

        $year = $published[0] ?? null;
        $month = $published[1] ?? 1;
        $day = $published[2] ?? 1;

        $authors = [];
        foreach ($item['author'] ?? [] as $a) {
            $authors[] = trim(($a['family'] ?? '') . ' ' . ($a['given'] ?? ''));
        }

        return [
            'doi' => $item['DOI'] ?? null,
            'title' => is_array($item['title'] ?? null) ? ($item['title'][0] ?? '') : ($item['title'] ?? ''),
            'authors' => $authors,
            'year' => $year,
            'journal' => is_array($item['container-title'] ?? null) ? ($item['container-title'][0] ?? '') : ($item['container-title'] ?? ''),
            'abstract' => $item['abstract'] ?? null,
            'language' => $item['language'] ?? null,
            'subjects' => $item['subject'] ?? [],
            'source' => 'crossref',
            'published_date' => $year ? sprintf('%04d-%02d-%02d', $year, $month, $day) : null,
            'url' => $item['DOI'] ? 'https://doi.org/' . $item['DOI'] : null,
        ];
    }

    /**
     * CrossRef API GET リクエスト
     */
    private function apiGet(string $path, array $params = []): ?array
    {
        if ($this->mailto) {
            $params['mailto'] = $this->mailto;
        }

        $url = self::API_BASE . $path;
        if (!empty($params)) {
            $url .= '?' . http_build_query($params);
        }

        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => "User-Agent: " . self::USER_AGENT . "\r\nAccept: application/json\r\n",
                'timeout' => 30,
                'ignore_errors' => true,
            ],
        ]);

        $body = @file_get_contents($url, false, $context);
        if ($body === false) {
            return null;
        }

        $statusLine = $http_response_header[0] ?? '';
        if (!preg_match('/\b200\b/', $statusLine)) {
            return null;
        }

        $json = json_decode($body, true);
        if (!$json || !isset($json['message'])) {
            return null;
        }

        return $json['message'];
    }

    // --- キャッシュ ---

    private function getCache(string $key): ?array
    {
        $file = $this->cacheDir . $key . '.json';
        if (!file_exists($file)) {
            return null;
        }
        if (filemtime($file) < time() - self::CACHE_TTL) {
            @unlink($file);
            return null;
        }
        $data = @file_get_contents($file);
        return $data ? json_decode($data, true) : null;
    }

    private function setCache(string $key, array $data): void
    {
        $file = $this->cacheDir . $key . '.json';
        @file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE));
    }
}
