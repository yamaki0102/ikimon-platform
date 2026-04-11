<?php
/**
 * Universal Red List Importer v2
 *
 * Imports CSV files from data/redlists/ into OmoikaneDB.redlist_assessments.
 * Supports the full MECE geographic scope hierarchy:
 *   global → regional → national → subnational_1 → subnational_2
 *
 * CSV Required Columns:
 *   scientific_name, category, scope_level, scope_name, authority
 *
 * CSV Optional Columns:
 *   japanese_name, common_name_en, criteria, country_code, region_code,
 *   municipality_code, scope_name_en, scope_centroid_lat, scope_centroid_lng,
 *   parent_scope_name, scope_valid_from, scope_valid_until, scope_note,
 *   source_url, assessment_year, version, taxon_group, taxon_group_en, notes
 *
 * GBIF Taxonomy matching is optional (--with-gbif flag).
 * Idempotent: uses INSERT OR REPLACE on the unique constraint.
 *
 * Usage:
 *   php import_redlist.php                    # Import all CSVs, no GBIF
 *   php import_redlist.php --with-gbif        # Import + resolve GBIF taxon keys
 *   php import_redlist.php --file=env_2024.csv # Import single file
 *   php import_redlist.php --dry-run          # Preview without writing
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/OmoikaneDB.php';

if (php_sapi_name() !== 'cli') {
    die("Run from CLI.\n");
}

$opts = getopt('', ['with-gbif', 'file:', 'dry-run']);
$withGbif = isset($opts['with-gbif']);
$dryRun   = isset($opts['dry-run']);
$singleFile = $opts['file'] ?? null;

if ($withGbif) {
    require_once __DIR__ . '/../../libs/Taxon.php';
}

$csvDir = DATA_DIR . '/redlists';
if ($singleFile) {
    $files = ["{$csvDir}/{$singleFile}"];
    if (!file_exists($files[0])) {
        die("File not found: {$files[0]}\n");
    }
} else {
    $files = glob($csvDir . '/*.csv');
}

if (empty($files)) {
    die("No CSV files found in {$csvDir}\n");
}

$db = new OmoikaneDB();
$pdo = $db->getPDO();

$requiredColumns = ['scientific_name', 'category', 'scope_level', 'scope_name', 'authority'];
$validScopeLevels = ['global', 'regional', 'national', 'subnational_1', 'subnational_2'];
$validCategories  = ['EX', 'EW', 'CR', 'CR+EN', 'EN', 'VU', 'NT', 'LC', 'DD', 'NE', 'LP'];

$insertSql = "
    INSERT OR REPLACE INTO redlist_assessments (
        dedup_key,
        taxon_key, scientific_name, japanese_name, common_name_en,
        category, criteria,
        scope_level, country_code, region_code, municipality_code,
        scope_name, scope_name_en, scope_centroid_lat, scope_centroid_lng,
        parent_scope_name, scope_valid_from, scope_valid_until, scope_note,
        authority, source_url, assessment_year, version,
        taxon_group, taxon_group_en, notes
    ) VALUES (
        :dedup_key,
        :taxon_key, :scientific_name, :japanese_name, :common_name_en,
        :category, :criteria,
        :scope_level, :country_code, :region_code, :municipality_code,
        :scope_name, :scope_name_en, :scope_centroid_lat, :scope_centroid_lng,
        :parent_scope_name, :scope_valid_from, :scope_valid_until, :scope_note,
        :authority, :source_url, :assessment_year, :version,
        :taxon_group, :taxon_group_en, :notes
    )
";

/**
 * dedup_key = sciName|scope|country|region|municipality|authority|year
 * assessment_year を含めることで同一スコープでも年次版を別レコードとして保持する。
 * 100年後に「2024年版はEN、2040年版はCR」という変遷が追跡可能になる。
 */
function buildDedupKey(string $sciName, string $scopeLevel, ?string $countryCode, ?string $regionCode, ?string $municipalityCode, string $authority, ?int $assessmentYear = null): string
{
    return implode('|', [$sciName, $scopeLevel, $countryCode ?? '', $regionCode ?? '', $municipalityCode ?? '', $authority, $assessmentYear ?? '']);
}

if (!$dryRun) {
    $stmt = $pdo->prepare($insertSql);
}

$stats = ['total' => 0, 'imported' => 0, 'skipped' => 0, 'gbif_matched' => 0, 'files' => 0];

foreach ($files as $file) {
    $basename = basename($file);
    echo "Processing {$basename}...\n";

    $handle = fopen($file, 'r');
    if (!$handle) {
        echo "  SKIP: Cannot open file\n";
        continue;
    }

    $bom = fread($handle, 3);
    if ($bom !== "\xEF\xBB\xBF") {
        rewind($handle);
    }

    $headers = fgetcsv($handle);
    if (!$headers) {
        echo "  SKIP: Empty file\n";
        fclose($handle);
        continue;
    }

    $headers = array_map('trim', $headers);
    $headerMap = array_flip($headers);

    $missing = [];
    foreach ($requiredColumns as $col) {
        if (!isset($headerMap[$col])) {
            $missing[] = $col;
        }
    }
    if (!empty($missing)) {
        echo "  SKIP: Missing required columns: " . implode(', ', $missing) . "\n";
        fclose($handle);
        continue;
    }

    $stats['files']++;
    $fileImported = 0;

    if (!$dryRun) {
        $pdo->beginTransaction();
    }

    $lineNum = 1;
    while (($row = fgetcsv($handle)) !== false) {
        $lineNum++;
        $stats['total']++;

        $get = function (string $col) use ($headerMap, $row): ?string {
            if (!isset($headerMap[$col])) return null;
            $val = trim($row[$headerMap[$col]] ?? '');
            return $val !== '' ? $val : null;
        };

        $sciName    = $get('scientific_name');
        $category   = strtoupper($get('category') ?? '');
        $scopeLevel = $get('scope_level');
        $scopeName  = $get('scope_name');
        $authority  = $get('authority');

        if (!$sciName || !$category || !$scopeLevel || !$scopeName || !$authority) {
            echo "  L{$lineNum}: SKIP (empty required field)\n";
            $stats['skipped']++;
            continue;
        }

        $category = str_replace(['Ⅰ', 'Ⅱ'], ['I', 'II'], $category);
        if ($category === 'CR+EN' || $category === 'CR/EN') {
            $category = 'CR+EN';
        }

        if (!in_array($category, $validCategories, true)) {
            echo "  L{$lineNum}: SKIP (invalid category: {$category})\n";
            $stats['skipped']++;
            continue;
        }

        if (!in_array($scopeLevel, $validScopeLevels, true)) {
            echo "  L{$lineNum}: SKIP (invalid scope_level: {$scopeLevel})\n";
            $stats['skipped']++;
            continue;
        }

        $taxonKey = null;
        if ($withGbif) {
            $match = Taxon::match($sciName);
            if (isset($match['usageKey'])) {
                $taxonKey = (int)($match['acceptedUsageKey'] ?? $match['usageKey']);
                $stats['gbif_matched']++;
            }
            usleep(50000);
        }

        $dedupKey = buildDedupKey($sciName, $scopeLevel, $get('country_code'), $get('region_code'), $get('municipality_code'), $authority, $get('assessment_year') ? (int)$get('assessment_year') : null);

        $params = [
            ':dedup_key'         => $dedupKey,
            ':taxon_key'         => $taxonKey,
            ':scientific_name'   => $sciName,
            ':japanese_name'     => $get('japanese_name'),
            ':common_name_en'    => $get('common_name_en'),
            ':category'          => $category,
            ':criteria'          => $get('criteria'),
            ':scope_level'       => $scopeLevel,
            ':country_code'      => $get('country_code'),
            ':region_code'       => $get('region_code'),
            ':municipality_code' => $get('municipality_code'),
            ':scope_name'        => $scopeName,
            ':scope_name_en'     => $get('scope_name_en'),
            ':scope_centroid_lat' => $get('scope_centroid_lat') ? (float)$get('scope_centroid_lat') : null,
            ':scope_centroid_lng' => $get('scope_centroid_lng') ? (float)$get('scope_centroid_lng') : null,
            ':parent_scope_name' => $get('parent_scope_name'),
            ':scope_valid_from'  => $get('scope_valid_from'),
            ':scope_valid_until' => $get('scope_valid_until'),
            ':scope_note'        => $get('scope_note'),
            ':authority'         => $authority,
            ':source_url'        => $get('source_url'),
            ':assessment_year'   => $get('assessment_year') ? (int)$get('assessment_year') : null,
            ':version'           => $get('version'),
            ':taxon_group'       => $get('taxon_group'),
            ':taxon_group_en'    => $get('taxon_group_en'),
            ':notes'             => $get('notes'),
        ];

        if ($dryRun) {
            $jaName = $get('japanese_name') ?? '';
            echo "  DRY: {$sciName} ({$jaName}) → {$category} [{$scopeLevel}:{$scopeName}]\n";
        } else {
            $stmt->execute($params);
        }

        $fileImported++;
        $stats['imported']++;
    }

    if (!$dryRun) {
        $pdo->commit();
    }

    fclose($handle);
    echo "  → {$fileImported} entries " . ($dryRun ? '(dry run)' : 'imported') . "\n";
}

echo "\n=== Import Summary ===\n";
echo "Files processed: {$stats['files']}\n";
echo "Total rows:      {$stats['total']}\n";
echo "Imported:        {$stats['imported']}\n";
echo "Skipped:         {$stats['skipped']}\n";
if ($withGbif) {
    echo "GBIF matched:    {$stats['gbif_matched']}\n";
}
if ($dryRun) {
    echo "(Dry run — no data written)\n";
}
