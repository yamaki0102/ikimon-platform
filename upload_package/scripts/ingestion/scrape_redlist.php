<?php
/**
 * Red List Web Scraper v2
 *
 * Reads configs from data/redlists/configs/*.json,
 * fetches HTML tables from each target URL,
 * and imports directly into OmoikaneDB.redlist_assessments.
 *
 * Config format: see data/redlists/configs/prefectures.json
 * Skips entries with scrape_status != 'possible'.
 *
 * Usage:
 *   php scrape_redlist.php                     # All configs with scrape_status=possible
 *   php scrape_redlist.php --id=okinawa        # Single target
 *   php scrape_redlist.php --config=municipalities.json  # Specific config file
 *   php scrape_redlist.php --dry-run           # Preview without writing
 *   php scrape_redlist.php --to-csv            # Write CSV instead of SQLite
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/OmoikaneDB.php';

if (php_sapi_name() !== 'cli') die("Run from CLI.\n");

$opts = getopt('', ['id:', 'config:', 'dry-run', 'to-csv']);
$targetId    = $opts['id'] ?? null;
$configFile  = $opts['config'] ?? null;
$dryRun      = isset($opts['dry-run']);
$toCsv       = isset($opts['to-csv']);

$configDir = DATA_DIR . '/redlists/configs';
if ($configFile) {
    $configFiles = ["{$configDir}/{$configFile}"];
} else {
    $configFiles = glob("{$configDir}/*.json");
}

$allTargets = [];
foreach ($configFiles as $f) {
    if (basename($f) === '_template.json') continue;
    $targets = json_decode(file_get_contents($f), true);
    if (!$targets) continue;
    foreach ($targets as $t) {
        if ($targetId && $t['id'] !== $targetId) continue;
        if ($t['scrape_status'] !== 'possible') continue;
        $allTargets[] = $t;
    }
}

if (empty($allTargets)) {
    echo "No scrapable targets found.\n";
    echo "(Targets with scrape_status='manual_csv_required' need manual CSV conversion)\n";
    exit(0);
}

echo "Found " . count($allTargets) . " scrapable targets.\n\n";

$db = !$toCsv ? new OmoikaneDB() : null;
$pdo = $db?->getPDO();

if (!$dryRun && !$toCsv) {
    $insertSql = "
        INSERT OR REPLACE INTO redlist_assessments (
            dedup_key, scientific_name, japanese_name,
            category, scope_level, country_code, region_code, municipality_code,
            scope_name, scope_name_en, scope_centroid_lat, scope_centroid_lng,
            parent_scope_name, scope_valid_from, scope_note,
            authority, source_url, assessment_year, taxon_group
        ) VALUES (
            :dedup_key, :scientific_name, :japanese_name,
            :category, :scope_level, :country_code, :region_code, :municipality_code,
            :scope_name, :scope_name_en, :scope_centroid_lat, :scope_centroid_lng,
            :parent_scope_name, :scope_valid_from, :scope_note,
            :authority, :source_url, :assessment_year, :taxon_group
        )
    ";
    $stmt = $pdo->prepare($insertSql);
}

$globalStats = ['targets' => 0, 'rows' => 0, 'imported' => 0, 'skipped' => 0];

foreach ($allTargets as $target) {
    $globalStats['targets']++;
    echo "=== {$target['name']} ===\n";
    echo "  URL: {$target['url']}\n";

    $html = fetchWithRetry($target['url']);
    if (!$html) {
        echo "  SKIP: Failed to fetch\n\n";
        continue;
    }

    $rows = extractTable($html, $target['selectors'] ?? []);
    echo "  Extracted: " . count($rows) . " rows\n";

    if (empty($rows)) {
        echo "  SKIP: No rows extracted (HTML structure may have changed)\n\n";
        continue;
    }

    $scopeLevel = !empty($target['municipality_code']) ? 'subnational_2'
        : (!empty($target['region_code']) ? 'subnational_1' : 'national');

    if ($toCsv) {
        $csvOut = DATA_DIR . "/redlists/scraped_{$target['id']}.csv";
        $fp = fopen($csvOut, 'w');
        fputcsv($fp, array_keys($rows[0] + buildBaseFields($target, $scopeLevel, '')));
        foreach ($rows as $row) {
            $r = buildBaseFields($target, $scopeLevel, $row['scientific_name'] ?? '', $row);
            fputcsv($fp, $r);
            $globalStats['rows']++;
        }
        fclose($fp);
        echo "  CSV: " . basename($csvOut) . "\n";
    } elseif ($dryRun) {
        foreach (array_slice($rows, 0, 3) as $row) {
            echo "  DRY: " . ($row['japanese_name'] ?? '?') . " / " . ($row['scientific_name'] ?? '?') . " → " . ($row['category'] ?? '?') . "\n";
        }
        echo "  (showing first 3)\n";
        $globalStats['rows'] += count($rows);
    } else {
        $pdo->beginTransaction();
        $imported = 0;
        foreach ($rows as $row) {
            $globalStats['rows']++;
            $sciName  = trim($row['scientific_name'] ?? '');
            $jaName   = trim($row['japanese_name'] ?? '');
            $category = normalizeCategory(trim($row['category'] ?? ''));

            if (!$category || (!$sciName && !$jaName)) {
                $globalStats['skipped']++;
                continue;
            }

            $dedupKey = "{$sciName}|{$scopeLevel}|{$target['country_code']}|" . ($target['region_code'] ?? '') . "|" . ($target['municipality_code'] ?? '') . "|{$target['authority']}";
            $stmt->execute([
                ':dedup_key'          => $dedupKey,
                ':scientific_name'    => $sciName ?: '(unknown)',
                ':japanese_name'      => $jaName ?: null,
                ':category'           => $category,
                ':scope_level'        => $scopeLevel,
                ':country_code'       => $target['country_code'] ?? null,
                ':region_code'        => $target['region_code'] ?? null,
                ':municipality_code'  => $target['municipality_code'] ?? null,
                ':scope_name'         => $target['scope_name'],
                ':scope_name_en'      => $target['scope_name_en'] ?? null,
                ':scope_centroid_lat' => $target['scope_centroid_lat'] ?? null,
                ':scope_centroid_lng' => $target['scope_centroid_lng'] ?? null,
                ':parent_scope_name'  => $target['parent_scope_name'] ?? null,
                ':scope_valid_from'   => $target['scope_valid_from'] ?? null,
                ':scope_note'         => $target['scope_note'] ?? null,
                ':authority'          => $target['authority'],
                ':source_url'         => $target['url'],
                ':assessment_year'    => $target['assessment_year'] ?? null,
                ':taxon_group'        => $row['taxon_group'] ?? null,
            ]);
            $imported++;
            $globalStats['imported']++;
        }
        $pdo->commit();
        echo "  Imported: {$imported}\n";
    }
    echo "\n";
    usleep(500000); // 500ms between requests
}

echo "=== Scraper Summary ===\n";
echo "Targets:  {$globalStats['targets']}\n";
echo "Rows:     {$globalStats['rows']}\n";
if (!$toCsv) {
    echo "Imported: {$globalStats['imported']}\n";
    echo "Skipped:  {$globalStats['skipped']}\n";
}
if ($dryRun) echo "(Dry run)\n";

// ---------------------------------------------------
// Functions
// ---------------------------------------------------

function fetchWithRetry(string $url, int $retries = 2): ?string
{
    if (function_exists('curl_init')) {
        for ($i = 0; $i <= $retries; $i++) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS      => 5,
                CURLOPT_TIMEOUT        => 20,
                CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                CURLOPT_HTTPHEADER     => [
                    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language: ja,en;q=0.5',
                ],
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_ENCODING       => 'gzip, deflate',
            ]);
            $body = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($body !== false && $code === 200) return $body;
            if ($i < $retries) usleep(1000000);
        }
        return null;
    }

    // Fallback: file_get_contents
    for ($i = 0; $i <= $retries; $i++) {
        $ctx = stream_context_create([
            'http' => [
                'timeout' => 20,
                'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
                'header' => "Accept: text/html\r\nAccept-Language: ja,en;q=0.5\r\n",
            ],
            'ssl' => ['verify_peer' => false],
        ]);
        $html = @file_get_contents($url, false, $ctx);
        if ($html !== false) return $html;
        if ($i < $retries) usleep(1000000);
    }
    return null;
}

function extractTable(string $html, array $selectors): array
{
    $dom = new DOMDocument('1.0', 'UTF-8');
    @$dom->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
    $xpath = new DOMXPath($dom);

    $rows = [];

    // Strategy 1: Use provided selectors
    if (!empty($selectors)) {
        $rowSelector = cssToXpath($selectors['row'] ?? 'tr');
        $nodes = $xpath->query($rowSelector);
        foreach ($nodes as $node) {
            $row = extractRowBySelectors($xpath, $node, $selectors);
            if (!empty(array_filter($row))) $rows[] = $row;
        }
        if (!empty($rows)) return $rows;
    }

    // Strategy 2: Auto-detect tables with species-like content
    $tables = $xpath->query('//table');
    $bestTable = null;
    $bestScore = 0;

    foreach ($tables as $table) {
        $text = $table->textContent;
        $score = 0;
        foreach (['CR', 'EN', 'VU', 'NT', 'LP', 'DD', '絶滅', '危惧', '準絶滅'] as $kw) {
            $score += substr_count($text, $kw);
        }
        if ($score > $bestScore) {
            $bestScore = $score;
            $bestTable = $table;
        }
    }

    if (!$bestTable || $bestScore < 2) return [];

    $tableRows = $xpath->query('.//tr', $bestTable);
    $headers = [];
    $headerRow = true;

    foreach ($tableRows as $tr) {
        $cells = [];
        foreach ($xpath->query('.//td|.//th', $tr) as $cell) {
            $cells[] = trim($cell->textContent);
        }
        if (empty(array_filter($cells))) continue;

        if ($headerRow) {
            $headers = $cells;
            $headerRow = false;
            continue;
        }

        $row = mapRowToSchema($cells, $headers);
        if ($row) $rows[] = $row;
    }

    return $rows;
}

function extractRowBySelectors(DOMXPath $xpath, DOMNode $node, array $selectors): array
{
    $row = [];
    foreach (['japanese_name', 'scientific_name', 'category', 'taxon_group'] as $field) {
        if (isset($selectors[$field])) {
            $xp = cssToXpath($selectors[$field]);
            $found = $xpath->query($xp, $node);
            $row[$field] = $found->length > 0 ? trim($found->item(0)->textContent) : '';
        }
    }
    return $row;
}

function mapRowToSchema(array $cells, array $headers): ?array
{
    if (empty($cells)) return null;

    $row = ['japanese_name' => '', 'scientific_name' => '', 'category' => '', 'taxon_group' => ''];

    $catKeywords = ['category', 'status', 'rank', 'ランク', 'カテゴリ', '区分', 'コード'];
    $jaKeywords  = ['japanese', '和名', '名称', '種名', 'name'];
    $sciKeywords = ['scientific', '学名', 'latin'];
    $grpKeywords = ['group', '分類', '目', '科', 'class', 'order'];

    foreach ($headers as $i => $header) {
        $h = mb_strtolower($header);
        $val = $cells[$i] ?? '';

        foreach ($catKeywords as $kw) {
            if (str_contains($h, $kw)) { $row['category'] = $val; continue 2; }
        }
        foreach ($sciKeywords as $kw) {
            if (str_contains($h, $kw)) { $row['scientific_name'] = $val; continue 2; }
        }
        foreach ($jaKeywords as $kw) {
            if (str_contains($h, $kw) && empty($row['japanese_name'])) { $row['japanese_name'] = $val; continue 2; }
        }
        foreach ($grpKeywords as $kw) {
            if (str_contains($h, $kw)) { $row['taxon_group'] = $val; continue 2; }
        }
    }

    // Fallback: heuristic position guessing
    if (empty($row['japanese_name']) && count($cells) >= 2) {
        $row['japanese_name'] = $cells[0] ?? '';
    }
    if (empty($row['scientific_name']) && count($cells) >= 3) {
        foreach ($cells as $c) {
            if (preg_match('/^[A-Z][a-z]+ [a-z]+/', $c)) {
                $row['scientific_name'] = $c;
                break;
            }
        }
    }
    if (empty($row['category'])) {
        foreach ($cells as $c) {
            $c = strtoupper(trim($c));
            if (in_array($c, ['CR', 'EN', 'VU', 'NT', 'LC', 'DD', 'EX', 'EW', 'LP', 'NE'], true)) {
                $row['category'] = $c;
                break;
            }
        }
        if (empty($row['category'])) {
            foreach ($cells as $c) {
                if (preg_match('/絶滅危惧|準絶滅|情報不足|野生絶滅|地域個体群/', $c)) {
                    $row['category'] = jaToCode($c);
                    break;
                }
            }
        }
    }

    if (empty($row['category'])) return null;
    return $row;
}

function normalizeCategory(string $cat): string
{
    $cat = strtoupper(trim($cat));
    $map = [
        'CR' => 'CR', 'EN' => 'EN', 'VU' => 'VU', 'NT' => 'NT',
        'LC' => 'LC', 'DD' => 'DD', 'EX' => 'EX', 'EW' => 'EW',
        'LP' => 'LP', 'NE' => 'NE', 'CR+EN' => 'CR+EN',
    ];
    return $map[$cat] ?? jaToCode($cat);
}

function jaToCode(string $ja): string
{
    if (str_contains($ja, '絶滅危惧IA') || str_contains($ja, '絶滅危惧Ⅰ類A') || str_contains($ja, 'CR')) return 'CR';
    if (str_contains($ja, '絶滅危惧IB') || str_contains($ja, '絶滅危惧Ⅰ類B') || str_contains($ja, 'EN')) return 'EN';
    if (str_contains($ja, '絶滅危惧I') || str_contains($ja, '絶滅危惧Ⅰ')) return 'CR+EN';
    if (str_contains($ja, '絶滅危惧II') || str_contains($ja, '絶滅危惧Ⅱ') || str_contains($ja, 'VU')) return 'VU';
    if (str_contains($ja, '準絶滅危惧') || str_contains($ja, 'NT')) return 'NT';
    if (str_contains($ja, '地域個体群') || str_contains($ja, 'LP')) return 'LP';
    if (str_contains($ja, '情報不足') || str_contains($ja, 'DD')) return 'DD';
    if (str_contains($ja, '野生絶滅') || str_contains($ja, 'EW')) return 'EW';
    if (str_contains($ja, '絶滅') || str_contains($ja, 'EX')) return 'EX';
    return '';
}

function cssToXpath(string $css): string
{
    $css = trim($css);
    // Very basic: "tr.classname" → "//tr[contains(@class,'classname')]"
    if (preg_match('/^(\w+)\.(\S+)$/', $css, $m)) {
        return "//{$m[1]}[contains(@class,'{$m[2]}')]";
    }
    if (preg_match('/^(\w+):nth-child\((\d+)\)$/', $css, $m)) {
        return "//{$m[1]}[{$m[2]}]";
    }
    return "//{$css}";
}

function buildBaseFields(array $target, string $scopeLevel, string $sciName, array $row = []): array
{
    return [
        'scientific_name'    => $sciName,
        'japanese_name'      => $row['japanese_name'] ?? '',
        'category'           => $row['category'] ?? '',
        'scope_level'        => $scopeLevel,
        'country_code'       => $target['country_code'] ?? 'JP',
        'region_code'        => $target['region_code'] ?? '',
        'municipality_code'  => $target['municipality_code'] ?? '',
        'scope_name'         => $target['scope_name'],
        'authority'          => $target['authority'],
        'assessment_year'    => $target['assessment_year'] ?? '',
    ];
}
