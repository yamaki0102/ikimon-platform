<?php

/**
 * ingest_academic_papers.php — 学術論文バッチハーベスター v1.0
 *
 * OmoikaneDB の全種に対して 5 つの学術論文 API を回し、
 * 論文メタデータを PaperStore + TaxonPaperIndex に蓄積する。
 *
 * ソース:
 *   OpenAlex    — 200M+論文・無料・要件なし (best global coverage)
 *   PubMed      — 生命科学・タクソノミー連携 (NCBI Entrez)
 *   Europe PMC  — ライフサイエンス40M+ (EBI)
 *   J-STAGE     — 日本語学術論文 (JST)
 *   CiNii Research — 国内学術論文・学位論文 (NII)
 *
 * 使い方:
 *   php ingest_academic_papers.php              # 全種を順次処理
 *   php ingest_academic_papers.php --limit=50   # 50種で停止
 *   php ingest_academic_papers.php --force      # 既処理種を再取得
 *   php ingest_academic_papers.php --source=openalex  # 特定ソースのみ
 *   php ingest_academic_papers.php --species="Taraxacum officinale"
 *
 * レート制限(保守的設定):
 *   OpenAlex    : 1 req/sec (実際は 10/sec 可能)
 *   PubMed      : 3 req/2sec (API key なし)
 *   Europe PMC  : 1 req/sec
 *   J-STAGE     : 1 req/sec
 *   CiNii       : 1 req/sec
 */

declare(strict_types=1);

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/OmoikaneDB.php';
require_once __DIR__ . '/../../libs/PaperStore.php';
require_once __DIR__ . '/../../libs/TaxonPaperIndex.php';

// === CLI 引数 ===
$opts    = getopt('', ['limit:', 'force', 'source:', 'species:']);
$limit   = isset($opts['limit'])   ? (int)$opts['limit']  : 0;
$force   = isset($opts['force']);
$onlySrc = $opts['source'] ?? '';
$onlySp  = $opts['species'] ?? '';

define('AP_UA', 'OmoikaneAcademicBot/1.0 (ikimon.life; mailto:admin@ikimon.life) PHP/' . PHP_VERSION);
define('AP_CHECKPOINT', rtrim(DATA_DIR, '/') . '/library/academic_papers_progress.json');

// === DB ===
$db  = new OmoikaneDB();
$pdo = $db->getPDO();

// === チェックポイント ===
$checkpoint = file_exists(AP_CHECKPOINT)
    ? (json_decode(file_get_contents(AP_CHECKPOINT), true) ?: [])
    : [];
$processed = $checkpoint['processed'] ?? [];

function saveCheckpoint(array &$processed): void
{
    file_put_contents(AP_CHECKPOINT, json_encode([
        'processed'  => $processed,
        'updated_at' => date('Y-m-d H:i:s'),
    ], JSON_UNESCAPED_UNICODE));
}

// === 種リスト構築 ===
if ($onlySp !== '') {
    $species = [['scientific_name' => $onlySp, 'japanese_name' => '']];
} else {
    $stmt = $pdo->query("
        SELECT scientific_name, japanese_name
        FROM species
        WHERE scientific_name != ''
          AND scientific_name NOT LIKE '% % %'
        ORDER BY id
    ");
    $species = $stmt->fetchAll(PDO::FETCH_ASSOC);
}

$total = count($species);
echo "Academic Paper Harvester v1.0\n";
echo "対象種: {$total}件 | force=" . ($force ? 'yes' : 'no') . " | source=" . ($onlySrc ?: 'all') . "\n\n";

// === HTTP GET ===
// Returns [httpCode, body|null]. Callers must check code before json_decode.
function apHttpGet(string $url, int $timeout = 12): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_HTTPHEADER     => ['User-Agent: ' . AP_UA, 'Accept: application/json'],
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 3,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $body     = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if (!is_string($body) || $body === '') return [$httpCode, null];
    return [$httpCode, $body];
}

// === OpenAlex abstract 復元 ===
function reconstructOpenAlexAbstract(array $invertedIndex): string
{
    if (empty($invertedIndex)) return '';
    $words = [];
    foreach ($invertedIndex as $word => $positions) {
        foreach ($positions as $pos) {
            $words[(int)$pos] = $word;
        }
    }
    ksort($words);
    return implode(' ', $words);
}

// === PaperStore に保存(重複スキップ) ===
function savePaper(array $data): bool
{
    $doi = $data['doi'] ?? '';
    if ($doi && PaperStore::findById($doi, 'doi')) return false;
    PaperStore::append($data);
    return true;
}

// =============================================
// SOURCE FUNCTIONS
// =============================================

function fetchOpenAlex(string $sciName): array
{
    $results = [];
    $url = "https://api.openalex.org/works?filter=title_and_abstract.search:" . urlencode('"' . $sciName . '"')
        . "&per_page=15&select=id,title,abstract_inverted_index,doi,publication_year,primary_location,authorships"
        . "&mailto=admin@ikimon.life";
    [$code, $json] = apHttpGet($url);
    if ($code === 429) { echo "  OpenAlex: rate limited\n"; return $results; }
    if (!$json || $code !== 200) return $results;
    $data = json_decode($json, true);
    foreach (($data['results'] ?? []) as $work) {
        $abstract = reconstructOpenAlexAbstract($work['abstract_inverted_index'] ?? []);
        if (empty($abstract) && mb_strlen($work['title'] ?? '') < 50) continue;
        $doi     = ltrim($work['doi'] ?? '', 'https://doi.org/');
        $authors = [];
        foreach (array_slice($work['authorships'] ?? [], 0, 5) as $a) {
            $authors[] = $a['author']['display_name'] ?? '';
        }
        $results[] = [
            'doi'            => $doi ?: 'openalex-' . md5($work['id'] ?? $sciName . $work['title']),
            'title'          => $work['title'] ?? '',
            'author'         => implode(', ', array_filter($authors)),
            'published_date' => (string)($work['publication_year'] ?? ''),
            'abstract'       => $abstract,
            'link'           => $doi ? "https://doi.org/{$doi}" : ($work['primary_location']['landing_page_url'] ?? ''),
            'source'         => 'OpenAlex',
        ];
    }
    usleep(200000);
    return $results;
}

function fetchPubMed(string $sciName): array
{
    $results = [];
    $apiKey = defined('NCBI_API_KEY') && NCBI_API_KEY ? "&api_key=" . NCBI_API_KEY : '';

    $searchUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed"
        . "&term=" . urlencode('"' . $sciName . '"[TIAB]')
        . "&retmax=10&retmode=json&usehistory=y" . $apiKey;
    [$code, $searchJson] = apHttpGet($searchUrl);
    if ($code === 429) { echo "  PubMed: rate limited\n"; return $results; }
    if (!$searchJson || $code !== 200) return $results;

    $searchData = json_decode($searchJson, true);
    $pmids      = $searchData['esearchresult']['idlist'] ?? [];
    if (empty($pmids)) return $results;
    usleep(350000);

    // summary でタイトル・著者・年を取得
    $summaryUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed"
        . "&id=" . implode(',', array_slice($pmids, 0, 10))
        . "&retmode=json" . $apiKey;
    [$code, $summaryJson] = apHttpGet($summaryUrl);
    if ($code === 429) { echo "  PubMed: rate limited (summary)\n"; return $results; }
    if (!$summaryJson || $code !== 200) return $results;
    $summaryData = json_decode($summaryJson, true);
    usleep(350000);

    // abstracts を取得
    $abstractsUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed"
        . "&id=" . implode(',', array_slice($pmids, 0, 10))
        . "&retmode=text&rettype=abstract" . $apiKey;
    [$code, $abstractsText] = apHttpGet($abstractsUrl);
    if ($code === 429) $abstractsText = null;
    usleep(350000);

    // abstract テキストを PMID ごとに分割
    $abstractMap = [];
    if ($abstractsText && $code === 200) {
        $blocks = preg_split('/\n\d+\. /', "\n" . $abstractsText);
        foreach (array_filter($blocks) as $block) {
            if (preg_match('/PMID:\s*(\d+)/', $block, $m)) {
                $abstractMap[$m[1]] = trim($block);
            }
        }
    }

    foreach ($pmids as $pmid) {
        $uid  = (string)$pmid;
        $meta = $summaryData['result'][$uid] ?? [];
        $title = $meta['title'] ?? '';
        $authors = array_column($meta['authors'] ?? [], 'name');
        $year    = substr($meta['pubdate'] ?? '', 0, 4);
        $doi     = '';
        foreach (($meta['articleids'] ?? []) as $aid) {
            if ($aid['idtype'] === 'doi') { $doi = $aid['value']; break; }
        }
        $abstract = $abstractMap[$uid] ?? '';
        // abstract から不要ヘッダーを取り除く
        $abstract = preg_replace('/^.*?\n\n/s', '', $abstract);

        if (empty($title)) continue;
        $results[] = [
            'doi'            => $doi ?: 'pmid-' . $pmid,
            'title'          => $title,
            'author'         => implode(', ', array_slice($authors, 0, 5)),
            'published_date' => $year,
            'abstract'       => trim($abstract),
            'link'           => "https://pubmed.ncbi.nlm.nih.gov/{$pmid}/",
            'source'         => 'PubMed',
        ];
    }
    return $results;
}

function fetchEuropePMC(string $sciName): array
{
    $results = [];
    $url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
        . "?query=" . urlencode('"' . $sciName . '"')
        . "&resultType=core&pageSize=8&format=json&cursorMark=*";
    [$code, $json] = apHttpGet($url);
    if ($code === 429) { echo "  EuropePMC: rate limited\n"; return $results; }
    if (!$json || $code !== 200) return $results;
    $data = json_decode($json, true);
    foreach (($data['resultList']['result'] ?? []) as $article) {
        $abstract = $article['abstractText'] ?? '';
        $title    = $article['title'] ?? '';
        if (empty($abstract) && mb_strlen($title) < 50) continue;
        $doi  = $article['doi'] ?? '';
        $pmid = $article['pmid'] ?? '';
        $results[] = [
            'doi'            => $doi ?: ($pmid ? "pmid-{$pmid}" : 'epmc-' . md5($title)),
            'title'          => $title,
            'author'         => implode(', ', array_column(array_slice($article['authorList']['author'] ?? [], 0, 5), 'fullName')),
            'published_date' => (string)($article['pubYear'] ?? ''),
            'abstract'       => strip_tags($abstract),
            'link'           => $doi ? "https://doi.org/{$doi}" : ($pmid ? "https://pubmed.ncbi.nlm.nih.gov/{$pmid}/" : ''),
            'source'         => 'EuropePMC',
        ];
    }
    usleep(200000);
    return $results;
}

function fetchJStage(string $sciName, string $jaName): array
{
    $results = [];
    $query = $sciName . (!empty($jaName) ? ' ' . $jaName : '');
    $url   = "https://api.jstage.jst.go.jp/searchapi/do?service=3"
        . "&text=" . urlencode($query)
        . "&pubyearfrom=2000&count=8";
    [$code, $xml] = apHttpGet($url);
    if ($code === 429) { echo "  J-STAGE: rate limited\n"; return $results; }
    if (!$xml || $code !== 200) return $results;
    try {
        $dom = @simplexml_load_string($xml);
        if (!$dom) return $results;
        $channel = $dom->channel ?? null;
        if (!$channel) return $results;
        foreach (($channel->item ?? []) as $item) {
            $title    = (string)($item->title ?? '');
            $abstract = (string)($item->description ?? '');
            $link     = (string)($item->link ?? '');
            if (empty($title)) continue;
            if (empty($abstract)) $abstract = $title;
            // DOI を link から抽出
            $doi = preg_match('#doi\.org/(.+)$#', $link, $m) ? urldecode($m[1]) : '';
            $results[] = [
                'doi'            => $doi ?: 'jstage-' . md5($title . $link),
                'title'          => $title,
                'author'         => '',
                'published_date' => '',
                'abstract'       => $abstract,
                'link'           => $link,
                'source'         => 'J-STAGE',
            ];
        }
    } catch (\Throwable $e) { /* XML parse error */ }
    usleep(300000);
    return $results;
}

function fetchCiNii(string $sciName, string $jaName): array
{
    $results = [];
    $query = !empty($jaName) ? $jaName : $sciName;
    $url   = "https://cir.nii.ac.jp/opensearch/all?q=" . urlencode($query) . "&format=json&count=8";
    [$code, $json] = apHttpGet($url);
    if ($code === 429) { echo "  CiNii: rate limited\n"; return $results; }
    if (!$json || $code !== 200) return $results;
    $data = json_decode($json, true);
    foreach (($data['items'] ?? []) as $item) {
        $title    = $item['title'] ?? ($item['dc:title'] ?? '');
        $abstract = $item['description'] ?? ($item['dc:description'] ?? '');
        // link は文字列・配列・オブジェクト配列いずれもあり得る
        $rawLink = $item['link'] ?? ($item['@id'] ?? '');
        if (is_array($rawLink)) {
            $link = $rawLink[0]['@id'] ?? $rawLink[0] ?? '';
            if (is_array($link)) $link = '';
        } else {
            $link = (string)$rawLink;
        }
        if (is_array($title))    $title    = implode(' / ', $title);
        if (is_array($abstract)) $abstract = implode(' ', $abstract);
        $title    = (string)$title;
        $abstract = (string)$abstract;
        if (empty($title)) continue;
        if (empty($abstract)) $abstract = $title;
        $doi = is_string($link) && preg_match('#doi\.org/(.+)$#', $link, $m) ? urldecode($m[1]) : '';
        $results[] = [
            'doi'            => $doi ?: 'cinii-' . md5($title . $link),
            'title'          => $title,
            'author'         => '',
            'published_date' => '',
            'abstract'       => $abstract,
            'link'           => $link,
            'source'         => 'CiNii',
        ];
    }
    usleep(300000);
    return $results;
}

// =============================================
// MAIN LOOP
// =============================================
$done = $skip = $err = 0;
$newPapers = 0;
$index = TaxonPaperIndex::getIndex();

foreach ($species as $sp) {
    $sci = trim($sp['scientific_name']);
    $ja  = trim($sp['japanese_name'] ?? '');

    if (empty($sci) || strpos($sci, ' ') === false) { $skip++; continue; }
    if (!$force && in_array($sci, $processed, true)) { $skip++; continue; }

    echo "[{$sci}]" . ($ja ? " ({$ja})" : '') . "\n";

    $allPapers = [];

    if ($onlySrc) {
        // Single source mode (original sequential)
        if ($onlySrc === 'openalex')  { $p = fetchOpenAlex($sci);   echo "  OpenAlex: " . count($p) . " papers\n";  $allPapers = array_merge($allPapers, $p); }
        if ($onlySrc === 'pubmed')    { $p = fetchPubMed($sci);     echo "  PubMed: " . count($p) . " papers\n";    $allPapers = array_merge($allPapers, $p); }
        if ($onlySrc === 'europepmc') { $p = fetchEuropePMC($sci);  echo "  EuropePMC: " . count($p) . " papers\n"; $allPapers = array_merge($allPapers, $p); }
        if ($onlySrc === 'jstage')    { $p = fetchJStage($sci, $ja); echo "  J-STAGE: " . count($p) . " papers\n"; $allPapers = array_merge($allPapers, $p); }
        if ($onlySrc === 'cinii')     { $p = fetchCiNii($sci, $ja);  echo "  CiNii: " . count($p) . " papers\n";  $allPapers = array_merge($allPapers, $p); }
    } else {
        // Parallel mode: fire OpenAlex + EuropePMC + J-STAGE + CiNii via curl_multi,
        // PubMed runs sequentially (3-step API).
        // Each source has INDEPENDENT rate limits — parallel is safe.
        $mh = curl_multi_init();
        $handles = [];

        // OpenAlex
        $oaUrl = "https://api.openalex.org/works?filter=title_and_abstract.search:" . urlencode('"' . $sci . '"')
            . "&per_page=15&select=id,title,abstract_inverted_index,doi,publication_year,primary_location,authorships"
            . "&mailto=admin@ikimon.life";
        $handles['openalex'] = curl_init($oaUrl);

        // EuropePMC
        $epmcUrl = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
            . "?query=" . urlencode('"' . $sci . '"')
            . "&resultType=core&pageSize=8&format=json&cursorMark=*";
        $handles['europepmc'] = curl_init($epmcUrl);

        // J-STAGE
        $jsQuery = $sci . (!empty($ja) ? ' ' . $ja : '');
        $jsUrl = "https://api.jstage.jst.go.jp/searchapi/do?service=3"
            . "&text=" . urlencode($jsQuery) . "&pubyearfrom=2000&count=8";
        $handles['jstage'] = curl_init($jsUrl);

        // CiNii
        $cnQuery = !empty($ja) ? $ja : $sci;
        $cnUrl = "https://cir.nii.ac.jp/opensearch/all?q=" . urlencode($cnQuery) . "&format=json&count=8";
        $handles['cinii'] = curl_init($cnUrl);

        foreach ($handles as $ch) {
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 12,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_HTTPHEADER     => ['User-Agent: ' . AP_UA, 'Accept: application/json'],
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS      => 3,
                CURLOPT_SSL_VERIFYPEER => true,
            ]);
            curl_multi_add_handle($mh, $ch);
        }

        // Run PubMed sequentially while curl_multi fetches the other 4
        $pubmedPapers = fetchPubMed($sci);
        echo "  PubMed: " . count($pubmedPapers) . " papers\n";
        $allPapers = array_merge($allPapers, $pubmedPapers);

        // Wait for parallel requests to complete
        $running = null;
        do {
            curl_multi_exec($mh, $running);
            curl_multi_select($mh, 1);
        } while ($running > 0);

        // Collect OpenAlex results
        $oaBody = curl_multi_getcontent($handles['openalex']);
        if ($oaBody && curl_getinfo($handles['openalex'], CURLINFO_HTTP_CODE) === 200) {
            $oaData = json_decode($oaBody, true);
            $oaPapers = [];
            foreach (($oaData['results'] ?? []) as $work) {
                $abstract = reconstructOpenAlexAbstract($work['abstract_inverted_index'] ?? []);
                if (empty($abstract) && mb_strlen($work['title'] ?? '') < 50) continue;
                $doi = ltrim($work['doi'] ?? '', 'https://doi.org/');
                $authors = [];
                foreach (array_slice($work['authorships'] ?? [], 0, 5) as $a) {
                    $authors[] = $a['author']['display_name'] ?? '';
                }
                $oaPapers[] = [
                    'doi'            => $doi ?: 'openalex-' . md5($work['id'] ?? $sci . $work['title']),
                    'title'          => $work['title'] ?? '',
                    'author'         => implode(', ', array_filter($authors)),
                    'published_date' => (string)($work['publication_year'] ?? ''),
                    'abstract'       => $abstract,
                    'link'           => $doi ? "https://doi.org/{$doi}" : ($work['primary_location']['landing_page_url'] ?? ''),
                    'source'         => 'OpenAlex',
                ];
            }
            echo "  OpenAlex: " . count($oaPapers) . " papers\n";
            $allPapers = array_merge($allPapers, $oaPapers);
        } else {
            echo "  OpenAlex: 0 papers\n";
        }

        // Collect EuropePMC results
        $epmcBody = curl_multi_getcontent($handles['europepmc']);
        if ($epmcBody && curl_getinfo($handles['europepmc'], CURLINFO_HTTP_CODE) === 200) {
            $epmcData = json_decode($epmcBody, true);
            $epmcPapers = [];
            foreach (($epmcData['resultList']['result'] ?? []) as $article) {
                $abstract = $article['abstractText'] ?? '';
                $title = $article['title'] ?? '';
                if (empty($abstract) && mb_strlen($title) < 50) continue;
                $doi = $article['doi'] ?? '';
                $pmid = $article['pmid'] ?? '';
                $epmcPapers[] = [
                    'doi'            => $doi ?: ($pmid ? "pmid-{$pmid}" : 'epmc-' . md5($title)),
                    'title'          => $title,
                    'author'         => implode(', ', array_column(array_slice($article['authorList']['author'] ?? [], 0, 5), 'fullName')),
                    'published_date' => (string)($article['pubYear'] ?? ''),
                    'abstract'       => strip_tags($abstract),
                    'link'           => $doi ? "https://doi.org/{$doi}" : ($pmid ? "https://pubmed.ncbi.nlm.nih.gov/{$pmid}/" : ''),
                    'source'         => 'EuropePMC',
                ];
            }
            echo "  EuropePMC: " . count($epmcPapers) . " papers\n";
            $allPapers = array_merge($allPapers, $epmcPapers);
        } else {
            echo "  EuropePMC: 0 papers\n";
        }

        // Collect J-STAGE results
        $jsBody = curl_multi_getcontent($handles['jstage']);
        if ($jsBody && curl_getinfo($handles['jstage'], CURLINFO_HTTP_CODE) === 200) {
            $jsPapers = [];
            try {
                $dom = @simplexml_load_string($jsBody);
                if ($dom && $dom->channel) {
                    foreach (($dom->channel->item ?? []) as $item) {
                        $title = (string)($item->title ?? '');
                        $abstract = (string)($item->description ?? '');
                        $link = (string)($item->link ?? '');
                        if (empty($title)) continue;
                        if (empty($abstract)) $abstract = $title;
                        $doi = preg_match('#doi\.org/(.+)$#', $link, $m) ? urldecode($m[1]) : '';
                        $jsPapers[] = [
                            'doi'            => $doi ?: 'jstage-' . md5($title . $link),
                            'title'          => $title,
                            'author'         => '',
                            'published_date' => '',
                            'abstract'       => $abstract,
                            'link'           => $link,
                            'source'         => 'J-STAGE',
                        ];
                    }
                }
            } catch (\Throwable $e) {}
            echo "  J-STAGE: " . count($jsPapers) . " papers\n";
            $allPapers = array_merge($allPapers, $jsPapers);
        } else {
            echo "  J-STAGE: 0 papers\n";
        }

        // Collect CiNii results
        $cnBody = curl_multi_getcontent($handles['cinii']);
        if ($cnBody && curl_getinfo($handles['cinii'], CURLINFO_HTTP_CODE) === 200) {
            $cnData = json_decode($cnBody, true);
            $cnPapers = [];
            foreach (($cnData['items'] ?? []) as $item) {
                $title = $item['title'] ?? ($item['dc:title'] ?? '');
                $abstract = $item['description'] ?? ($item['dc:description'] ?? '');
                $rawLink = $item['link'] ?? ($item['@id'] ?? '');
                if (is_array($rawLink)) {
                    $link = $rawLink[0]['@id'] ?? $rawLink[0] ?? '';
                    if (is_array($link)) $link = '';
                } else {
                    $link = (string)$rawLink;
                }
                if (is_array($title))    $title    = implode(' / ', $title);
                if (is_array($abstract)) $abstract = implode(' ', $abstract);
                $title = (string)$title;
                $abstract = (string)$abstract;
                if (empty($title)) continue;
                if (empty($abstract)) $abstract = $title;
                $doi = is_string($link) && preg_match('#doi\.org/(.+)$#', $link, $m) ? urldecode($m[1]) : '';
                $cnPapers[] = [
                    'doi'            => $doi ?: 'cinii-' . md5($title . $link),
                    'title'          => $title,
                    'author'         => '',
                    'published_date' => '',
                    'abstract'       => $abstract,
                    'link'           => $link,
                    'source'         => 'CiNii',
                ];
            }
            echo "  CiNii: " . count($cnPapers) . " papers\n";
            $allPapers = array_merge($allPapers, $cnPapers);
        } else {
            echo "  CiNii: 0 papers\n";
        }

        foreach ($handles as $ch) {
            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);
        }
        curl_multi_close($mh);

        // Polite delay between species (200ms)
        usleep(200000);
    }

    // PaperStore + TaxonPaperIndex に保存
    $nameKey = strtolower(trim($sci));
    if (!isset($index[$nameKey])) $index[$nameKey] = [];

    $savedCount = 0;
    foreach ($allPapers as $paper) {
        $paper['ingested_at'] = date('Y-m-d H:i:s');
        $doi = $paper['doi'];
        if (savePaper($paper)) {
            $savedCount++;
            $newPapers++;
        }
        if (!in_array($doi, $index[$nameKey])) {
            $index[$nameKey][] = $doi;
        }
    }

    echo "  → 新規保存: {$savedCount}件 / 取得: " . count($allPapers) . "件\n";

    $processed[] = $sci;
    $done++;

    // チェックポイント保存 (10種ごと)
    if ($done % 10 === 0) {
        TaxonPaperIndex::saveIndex($index);
        saveCheckpoint($processed);
        echo "  [checkpoint saved: {$done}件処理済み]\n";
    }

    if ($limit > 0 && $done >= $limit) break;
    usleep(500000); // 0.5秒インターバル
}

// 最終保存
TaxonPaperIndex::saveIndex($index);
saveCheckpoint($processed);

echo "\n=== 完了 ===\n";
echo "処理: {$done}件 | スキップ: {$skip}件 | 新規論文: {$newPapers}件\n";
