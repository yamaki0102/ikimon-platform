<?php
/**
 * IUCN Red List API Importer
 *
 * Pulls global conservation assessments from the IUCN Red List API v3
 * and inserts them into OmoikaneDB.redlist_assessments as scope_level='global'.
 *
 * API Token: Free registration at https://apiv3.iucnredlist.org/
 * Set token in config or pass via --token=XXXX
 *
 * Usage:
 *   php import_iucn.php --token=YOUR_TOKEN
 *   php import_iucn.php --token=YOUR_TOKEN --country=JP   # Japan-relevant species only
 *   php import_iucn.php --token=YOUR_TOKEN --page=0       # Single page (100 species)
 *   php import_iucn.php --token=YOUR_TOKEN --all          # All species (140k+, slow)
 *   php import_iucn.php --token=YOUR_TOKEN --dry-run      # Preview first page
 *
 * Default: fetches all species listed for Japan (country=JP) — ~3,000 species
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/OmoikaneDB.php';

if (php_sapi_name() !== 'cli') die("Run from CLI.\n");

$opts = getopt('', ['token:', 'country:', 'page:', 'all', 'dry-run', 'region:']);
$token   = $opts['token'] ?? (defined('IUCN_API_TOKEN') ? IUCN_API_TOKEN : null);
$country = $opts['country'] ?? 'JP';
$dryRun  = isset($opts['dry-run']);
$fetchAll = isset($opts['all']);
$singlePage = isset($opts['page']) ? (int)$opts['page'] : null;
$region = $opts['region'] ?? null;

if (!$token) {
    echo "ERROR: IUCN API token required.\n";
    echo "  Get a free token at: https://apiv3.iucnredlist.org/\n";
    echo "  Usage: php import_iucn.php --token=YOUR_TOKEN\n";
    exit(1);
}

const IUCN_API_BASE = 'https://apiv3.iucnredlist.org/api/v3';
const IUCN_RATE_LIMIT_MS = 200000; // 200ms = 5 req/sec (conservative)

// IUCN → Our schema category mapping
const IUCN_CATEGORY_MAP = [
    'EX'  => 'EX', 'EW'  => 'EW',
    'CR'  => 'CR', 'EN'  => 'EN', 'VU'  => 'VU',
    'NT'  => 'NT', 'LC'  => 'LC', 'DD'  => 'DD',
    'NE'  => 'NE', 'LR/lc' => 'LC', 'LR/nt' => 'NT', 'LR/cd' => 'NT',
];

// Country code → centroid (geographic anchor)
const COUNTRY_CENTROIDS = [
    'JP' => [36.2048, 138.2529],
    'US' => [37.0902, -95.7129],
    'CN' => [35.8617, 104.1954],
    'AU' => [-25.2744, 133.7751],
    'BR' => [-14.2350, -51.9253],
    'ZA' => [-30.5595, 22.9375],
    'ID' => [-0.7893, 113.9213],
    'MY' => [4.2105, 101.9758],
    'TH' => [15.8700, 100.9925],
    'PH' => [12.8797, 121.7740],
    'MM' => [21.9162, 95.9560],
    'KH' => [12.5657, 104.9910],
    'VN' => [14.0583, 108.2772],
    'IN' => [20.5937, 78.9629],
    'RU' => [61.5240, 105.3188],
    'DE' => [51.1657, 10.4515],
    'FR' => [46.2276, 2.2137],
    'ES' => [40.4637, -3.7492],
    'GB' => [55.3781, -3.4360],
];

$db = new OmoikaneDB();
$pdo = $db->getPDO();

$insertSql = "
    INSERT OR REPLACE INTO redlist_assessments (
        dedup_key, taxon_key, scientific_name, japanese_name, common_name_en,
        category, criteria, scope_level, country_code, region_code, municipality_code,
        scope_name, scope_name_en, scope_centroid_lat, scope_centroid_lng,
        parent_scope_name, authority, source_url, assessment_year, version,
        taxon_group, taxon_group_en, notes
    ) VALUES (
        :dedup_key, :taxon_key, :scientific_name, :japanese_name, :common_name_en,
        :category, :criteria, :scope_level, :country_code, :region_code, :municipality_code,
        :scope_name, :scope_name_en, :scope_centroid_lat, :scope_centroid_lng,
        :parent_scope_name, :authority, :source_url, :assessment_year, :version,
        :taxon_group, :taxon_group_en, :notes
    )
";

if (!$dryRun) {
    $stmt = $pdo->prepare($insertSql);
}

$stats = ['fetched' => 0, 'imported' => 0, 'skipped' => 0, 'pages' => 0];

// ---------------------------------------------------
// Fetch strategy selection
// ---------------------------------------------------

if ($fetchAll) {
    // Paginated full download
    $page = $singlePage ?? 0;
    $maxPage = PHP_INT_MAX;
    echo "Mode: ALL species (paginated). Starting at page {$page}.\n";
    echo "Warning: Full download is 140k+ species. Expect several hours.\n\n";
    processPages($page, $maxPage, null, $token, $pdo, $stmt ?? null, $stats, $dryRun, $insertSql);

} elseif ($region) {
    // Regional Red List (e.g., 'europe')
    $url = IUCN_API_BASE . "/species/region/{$region}/page/0?token={$token}";
    echo "Mode: Regional — {$region}\n";
    $data = iucnGet($url);
    if (empty($data['result'])) {
        echo "No results returned for region: {$region}.\n";
        exit(1);
    }
    echo "Found " . count($data['result']) . " species for region {$region}.\n\n";
    if (!$dryRun && !isset($stmt)) {
        $stmt = $pdo->prepare($insertSql);
    }
    processSpeciesList($data['result'] ?? [], 'regional', null, $region, ucfirst($region), $token, $pdo, $stmt ?? null, $stats, $dryRun);

} else {
    // Country-specific species list (default, fastest for Japan)
    echo "Mode: Country species list — {$country}\n";
    $url = IUCN_API_BASE . "/country/getspecies/{$country}?token={$token}";
    $data = iucnGet($url);
    if (empty($data['result'])) {
        echo "No results returned. Check token and country code.\n";
        exit(1);
    }
    echo "Found " . count($data['result']) . " species for {$country}.\n\n";

    if ($dryRun) {
        $preview = array_slice($data['result'], 0, 5);
        foreach ($preview as $sp) {
            echo "DRY: " . ($sp['scientific_name'] ?? '?') . " — " . ($sp['category'] ?? '?') . "\n";
        }
        echo "(dry-run: showing first 5 only)\n";
    } else {
        processCountrySpecies($data['result'], $country, $token, $pdo, $stmt, $stats);
    }
}

echo "\n=== IUCN Import Summary ===\n";
echo "Species fetched:  {$stats['fetched']}\n";
echo "Imported:         {$stats['imported']}\n";
echo "Skipped/invalid:  {$stats['skipped']}\n";
if ($dryRun) echo "(Dry run — no data written)\n";

// ---------------------------------------------------
// Functions
// ---------------------------------------------------

function processCountrySpecies(array $species, string $countryCode, string $token, PDO $pdo, ?PDOStatement $stmt, array &$stats): void
{
    $centroid = COUNTRY_CENTROIDS[$countryCode] ?? [null, null];
    $countryName = getCountryName($countryCode);

    $pdo->beginTransaction();
    $batchSize = 0;

    foreach ($species as $sp) {
        $stats['fetched']++;
        $sciName  = trim($sp['scientific_name'] ?? '');
        $category = strtoupper(trim($sp['category'] ?? ''));
        $category = IUCN_CATEGORY_MAP[$category] ?? $category;

        if (!$sciName || !$category || !isset(IUCN_CATEGORY_MAP[$sp['category'] ?? '']) && strlen($category) > 5) {
            $stats['skipped']++;
            continue;
        }

        $taxonId = (int)($sp['taxonid'] ?? 0) ?: null;
        $commonEn = trim($sp['main_common_name'] ?? '');
        $taxonGroup = trim($sp['class_name'] ?? '');
        $criteria = '';
        $assessYear = null;

        // Fetch full assessment for important species (CR/EN only to limit API calls)
        if (in_array($category, ['CR', 'EN'], true) && $taxonId) {
            usleep(IUCN_RATE_LIMIT_MS);
            $detail = iucnGet(IUCN_API_BASE . "/species/id/{$taxonId}?token={$token}");
            $result = $detail['result'][0] ?? [];
            $criteria = trim($result['criteria'] ?? '');
            $assessYear = isset($result['assessment_date']) ? (int)substr($result['assessment_date'], 0, 4) : null;
        }

        // This entry is the global assessment
        $dedupKey = "{$sciName}|global||||IUCN Red List|" . ($assessYear ?? '');
        $params = [
            ':dedup_key'         => $dedupKey,
            ':taxon_key'         => $taxonId,
            ':scientific_name'   => $sciName,
            ':japanese_name'     => null,
            ':common_name_en'    => $commonEn ?: null,
            ':category'          => $category,
            ':criteria'          => $criteria ?: null,
            ':scope_level'       => 'global',
            ':country_code'      => null,
            ':region_code'       => null,
            ':municipality_code' => null,
            ':scope_name'        => 'Global',
            ':scope_name_en'     => 'Global',
            ':scope_centroid_lat' => null,
            ':scope_centroid_lng' => null,
            ':parent_scope_name' => null,
            ':authority'         => 'IUCN Red List',
            ':source_url'        => "https://www.iucnredlist.org/species/{$taxonId}/",
            ':assessment_year'   => $assessYear,
            ':version'           => null,
            ':taxon_group'       => $taxonGroup ?: null,
            ':taxon_group_en'    => $taxonGroup ?: null,
            ':notes'             => "Assessed in country context: {$countryCode}",
        ];

        $stmt->execute($params);
        $stats['imported']++;
        $batchSize++;

        if ($batchSize % 100 === 0) {
            $pdo->commit();
            $pdo->beginTransaction();
            echo "  {$stats['imported']} imported...\n";
        }

        usleep(IUCN_RATE_LIMIT_MS / 4); // 50ms between basic requests
    }

    $pdo->commit();
}

function processPages(int $startPage, int $maxPage, ?string $countryCode, string $token, PDO $pdo, ?PDOStatement $stmt, array &$stats, bool $dryRun, string $insertSql): void
{
    if ($dryRun && $stmt === null) {
        $stmt = $pdo->prepare($insertSql);
    }

    for ($page = $startPage; $page <= $maxPage; $page++) {
        $url = IUCN_API_BASE . "/species/page/{$page}?token={$token}";
        $data = iucnGet($url);
        $species = $data['result'] ?? [];

        if (empty($species)) {
            echo "Page {$page}: no more results. Done.\n";
            break;
        }

        $stats['pages']++;
        echo "Page {$page}: " . count($species) . " species\n";

        if (!$dryRun) {
            processCountrySpecies($species, $countryCode ?? 'GLOBAL', $token, $pdo, $stmt, $stats);
        } else {
            foreach (array_slice($species, 0, 3) as $sp) {
                echo "  DRY: " . ($sp['scientific_name'] ?? '?') . " — " . ($sp['category'] ?? '?') . "\n";
            }
            $stats['fetched'] += count($species);
        }

        usleep(IUCN_RATE_LIMIT_MS);
    }
}

function processSpeciesList(array $species, string $scopeLevel, ?string $countryCode, string $regionCode, string $scopeName, string $token, PDO $pdo, ?PDOStatement $stmt, array &$stats, bool $dryRun): void
{
    if (!$dryRun && $stmt === null) return;

    if (!$dryRun) {
        $pdo->beginTransaction();
    }

    foreach ($species as $sp) {
        $stats['fetched']++;
        $sciName  = trim($sp['scientific_name'] ?? '');
        $rawCat   = strtoupper(trim($sp['category'] ?? ''));
        $category = IUCN_CATEGORY_MAP[$rawCat] ?? null;

        if (!$sciName || !$category) {
            $stats['skipped']++;
            if ($dryRun) echo "  DRY: " . ($sp['scientific_name'] ?? '?') . " — SKIP (invalid category: {$rawCat})\n";
            continue;
        }

        if ($dryRun) {
            echo "  DRY: {$sciName} — {$category} [{$scopeLevel}:{$scopeName}]\n";
            continue;
        }

        $taxonId  = (int)($sp['taxonid'] ?? 0) ?: null;
        $commonEn = trim($sp['main_common_name'] ?? '') ?: null;
        $taxonGrp = trim($sp['class_name'] ?? '') ?: null;
        $dedupKey = "{$sciName}|{$scopeLevel}|" . ($countryCode ?? '') . "|{$regionCode}||IUCN Red List|";

        $stmt->execute([
            ':dedup_key'          => $dedupKey,
            ':taxon_key'          => $taxonId,
            ':scientific_name'    => $sciName,
            ':japanese_name'      => null,
            ':common_name_en'     => $commonEn,
            ':category'           => $category,
            ':criteria'           => null,
            ':scope_level'        => $scopeLevel,
            ':country_code'       => $countryCode,
            ':region_code'        => $regionCode ?: null,
            ':municipality_code'  => null,
            ':scope_name'         => $scopeName,
            ':scope_name_en'      => $scopeName,
            ':scope_centroid_lat' => null,
            ':scope_centroid_lng' => null,
            ':parent_scope_name'  => null,
            ':authority'          => 'IUCN Red List',
            ':source_url'         => $taxonId ? "https://www.iucnredlist.org/species/{$taxonId}/" : null,
            ':assessment_year'    => null,
            ':version'            => null,
            ':taxon_group'        => $taxonGrp,
            ':taxon_group_en'     => $taxonGrp,
            ':notes'              => null,
        ]);
        $stats['imported']++;
    }

    if (!$dryRun) {
        $pdo->commit();
    }
}

function iucnGet(string $url): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_USERAGENT      => 'ikimon.life/1.0 (biodiversity platform; contact@ikimon.life)',
        CURLOPT_HTTPHEADER     => ['Accept: application/json'],
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code !== 200 || !$body) {
        echo "  IUCN API error: HTTP {$code} for {$url}\n";
        return [];
    }

    return json_decode($body, true) ?? [];
}

function getCountryName(string $iso2): string
{
    $names = [
        'JP' => '日本', 'US' => 'United States', 'CN' => '中国', 'AU' => 'Australia',
        'BR' => 'Brazil', 'ZA' => 'South Africa', 'ID' => 'Indonesia', 'MY' => 'Malaysia',
        'TH' => 'Thailand', 'PH' => 'Philippines', 'IN' => 'India', 'RU' => 'Russia',
        'DE' => 'Germany', 'FR' => 'France', 'ES' => 'Spain', 'GB' => 'United Kingdom',
    ];
    return $names[$iso2] ?? $iso2;
}
