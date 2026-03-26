<?php
/**
 * J-STAGE / CiNii API クライアント
 *
 * 日本の学術論文プラットフォーム（J-STAGE / CiNii Research）から
 * 生物多様性関連の論文を取得する。
 *
 * Phase 2: 論文自動取り込みのローカル博物誌ソース。
 *
 * API仕様:
 *   J-STAGE: https://www.jstage.jst.go.jp/static/pages/WebAPI/-char/ja
 *   CiNii Research: https://support.nii.ac.jp/ja/cir/r_opensearch
 */
class JStageClient
{
    private const JSTAGE_API = 'https://api.jstage.jst.go.jp/searchapi/do';
    private const CINII_API = 'https://cir.nii.ac.jp/opensearch/articles';
    private const USER_AGENT = 'ikimon.life/1.0 (https://ikimon.life)';
    private const CACHE_TTL = 86400 * 7; // 7日キャッシュ

    /** 自然史博物館・生態学関連の主要誌コード（J-STAGE） */
    private const PRIORITY_JOURNALS = [
        'jjb',        // 日本生態学会誌
        'jjo',        // 日本鳥学会誌
        'jes',        // 日本昆虫学会誌
        'mammalianscience', // 哺乳類科学
        'kontyushigen', // 昆虫と自然
        'bulletin-nbm', // 国立科学博物館研究報告
    ];

    private string $cacheDir;

    public function __construct()
    {
        $this->cacheDir = (defined('DATA_DIR') ? DATA_DIR : __DIR__ . '/../data/') . 'jstage_cache/';
        if (!is_dir($this->cacheDir)) {
            @mkdir($this->cacheDir, 0755, true);
        }
    }

    /**
     * J-STAGE で学名キーワード検索
     *
     * @param string $scientificName 学名
     * @param int    $limit          最大件数
     * @param int    $start          開始位置（1-based）
     * @return array{items: array, total_results: int}
     */
    public function searchJStage(string $scientificName, int $limit = 20, int $start = 1): array
    {
        $cacheKey = md5("jstage:{$scientificName}:{$limit}:{$start}");
        $cached = $this->getCache($cacheKey);
        if ($cached !== null) {
            return $cached;
        }

        $params = [
            'service' => '3',       // 資料検索
            'keyword' => $scientificName,
            'count' => min($limit, 100),
            'start' => $start,
        ];

        $url = self::JSTAGE_API . '?' . http_build_query($params);
        $xml = $this->httpGet($url);
        if ($xml === null) {
            return ['items' => [], 'total_results' => 0];
        }

        $result = $this->parseJStageXml($xml);
        $this->setCache($cacheKey, $result);
        return $result;
    }

    /**
     * CiNii Research で学名キーワード検索
     *
     * @param string $scientificName 学名
     * @param int    $limit          最大件数
     * @param int    $start          開始位置（1-based）
     * @return array{items: array, total_results: int}
     */
    public function searchCiNii(string $scientificName, int $limit = 20, int $start = 1): array
    {
        $cacheKey = md5("cinii:{$scientificName}:{$limit}:{$start}");
        $cached = $this->getCache($cacheKey);
        if ($cached !== null) {
            return $cached;
        }

        $params = [
            'q' => $scientificName,
            'count' => min($limit, 200),
            'start' => $start,
            'format' => 'json',
        ];

        $url = self::CINII_API . '?' . http_build_query($params);
        $body = $this->httpGet($url);
        if ($body === null) {
            return ['items' => [], 'total_results' => 0];
        }

        $result = $this->parseCiNiiJson($body);
        $this->setCache($cacheKey, $result);
        return $result;
    }

    /**
     * 統合検索: J-STAGE + CiNii を両方検索し、DOI重複排除した上でマージ
     *
     * @param string $scientificName 学名
     * @param int    $limit          最大件数（各ソースごと）
     * @return array{items: array, total_results: int}
     */
    public function searchAll(string $scientificName, int $limit = 20): array
    {
        $jstage = $this->searchJStage($scientificName, $limit);
        usleep(500000); // 0.5秒待機
        $cinii = $this->searchCiNii($scientificName, $limit);

        $merged = [];
        $seen = [];

        foreach (array_merge($jstage['items'], $cinii['items']) as $item) {
            $key = $item['doi'] ?? $item['title'] ?? uniqid();
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $merged[] = $item;
        }

        return [
            'items' => $merged,
            'total_results' => count($merged),
        ];
    }

    /**
     * 複数の学名で一括検索
     *
     * @param array $scientificNames 学名配列
     * @param int   $perSpecies      種あたりの最大件数
     * @return array 学名 => 論文配列
     */
    public function batchSearch(array $scientificNames, int $perSpecies = 5): array
    {
        $results = [];
        foreach ($scientificNames as $name) {
            $response = $this->searchAll($name, $perSpecies);
            $results[$name] = $response['items'];
            usleep(1000000); // 1秒待機（レート制限）
        }
        return $results;
    }

    /**
     * J-STAGE XML レスポンスを ikimon.life 標準フォーマットにパース
     */
    private function parseJStageXml(string $xml): array
    {
        libxml_use_internal_errors(true);
        $doc = simplexml_load_string($xml);
        if ($doc === false) {
            return ['items' => [], 'total_results' => 0];
        }

        $ns = $doc->getNamespaces(true);
        $totalResults = 0;
        $items = [];

        // OpenSearch namespace
        if (isset($ns['opensearch'])) {
            $os = $doc->children($ns['opensearch']);
            $totalResults = (int) ($os->totalResults ?? 0);
        }

        // エントリ解析
        $entries = $doc->entry ?? $doc->item ?? [];
        foreach ($entries as $entry) {
            $dc = isset($ns['dc']) ? $entry->children($ns['dc']) : null;
            $prism = isset($ns['prism']) ? $entry->children($ns['prism']) : null;

            $title = (string) ($entry->title ?? '');
            $doi = (string) ($prism->doi ?? $entry->id ?? '');
            $link = (string) ($entry->link['href'] ?? $entry->link ?? '');

            $authors = [];
            if ($dc) {
                foreach ($dc->creator as $creator) {
                    $authors[] = (string) $creator;
                }
            }

            $year = null;
            $pubDate = (string) ($prism->publicationDate ?? $dc->date ?? '');
            if (preg_match('/(\d{4})/', $pubDate, $m)) {
                $year = (int) $m[1];
            }

            $journal = (string) ($prism->publicationName ?? '');

            $items[] = [
                'doi' => $doi ?: null,
                'title' => $title,
                'authors' => $authors,
                'year' => $year,
                'journal' => $journal,
                'abstract' => null,
                'language' => 'ja',
                'subjects' => [],
                'source' => 'jstage',
                'published_date' => $pubDate ?: null,
                'url' => $link ?: ($doi ? 'https://doi.org/' . $doi : null),
            ];
        }

        return ['items' => $items, 'total_results' => $totalResults ?: count($items)];
    }

    /**
     * CiNii JSON レスポンスを ikimon.life 標準フォーマットにパース
     */
    private function parseCiNiiJson(string $body): array
    {
        $json = json_decode($body, true);
        if (!$json) {
            return ['items' => [], 'total_results' => 0];
        }

        $totalResults = $json['opensearch:totalResults'] ?? $json['totalResults'] ?? 0;
        $entries = $json['items'] ?? $json['@graph'] ?? [];
        $items = [];

        foreach ($entries as $entry) {
            $title = $entry['title'] ?? $entry['dc:title'] ?? '';
            if (is_array($title)) {
                $title = $title[0] ?? '';
            }

            $doi = $entry['doi'] ?? $entry['dc:identifier'] ?? null;
            if ($doi && !preg_match('/^10\./', $doi)) {
                $doi = null;
            }

            $authors = [];
            foreach ($entry['dc:creator'] ?? $entry['author'] ?? [] as $a) {
                $authors[] = is_array($a) ? ($a['name'] ?? '') : (string) $a;
            }

            $year = null;
            $pubDate = $entry['dc:date'] ?? $entry['prism:publicationDate'] ?? '';
            if (preg_match('/(\d{4})/', $pubDate, $m)) {
                $year = (int) $m[1];
            }

            $items[] = [
                'doi' => $doi,
                'title' => $title,
                'authors' => $authors,
                'year' => $year,
                'journal' => $entry['prism:publicationName'] ?? $entry['dc:publisher'] ?? '',
                'abstract' => $entry['description'] ?? $entry['dc:description'] ?? null,
                'language' => $entry['dc:language'] ?? 'ja',
                'subjects' => $entry['dc:subject'] ?? [],
                'source' => 'cinii',
                'published_date' => $pubDate ?: null,
                'url' => $entry['link'] ?? $entry['@id'] ?? ($doi ? 'https://doi.org/' . $doi : null),
            ];
        }

        return ['items' => $items, 'total_results' => (int) $totalResults];
    }

    /**
     * HTTP GET リクエスト
     */
    private function httpGet(string $url): ?string
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => "User-Agent: " . self::USER_AGENT . "\r\nAccept: application/xml, application/json\r\n",
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

        return $body;
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
