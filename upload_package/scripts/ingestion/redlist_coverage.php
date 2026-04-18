<?php
/**
 * Red List Coverage Dashboard
 * Shows current coverage status for all configured scopes.
 *
 * Usage:
 *   php redlist_coverage.php           # Summary table
 *   php redlist_coverage.php --json    # JSON output
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/OmoikaneDB.php';

if (php_sapi_name() !== 'cli') die("Run from CLI.\n");

$jsonMode = isset($argv[1]) && $argv[1] === '--json';

$db = new OmoikaneDB();
$pdo = $db->getPDO();

// Count entries per scope
$dbCounts = [];
$stmt = $pdo->query("
    SELECT scope_level, country_code, region_code, municipality_code, scope_name, authority, COUNT(*) as cnt
    FROM redlist_assessments
    GROUP BY scope_level, country_code, region_code, municipality_code, scope_name, authority
    ORDER BY scope_level, scope_name
");
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $key = $row['scope_level'] . '|' . ($row['region_code'] ?? '') . '|' . ($row['municipality_code'] ?? '') . '|' . $row['authority'];
    $dbCounts[$key] = (int)$row['cnt'];
}

// Load all configs
$configDir = DATA_DIR . '/redlists/configs';
$configFiles = glob("{$configDir}/*.json");
$allTargets = [];
foreach ($configFiles as $f) {
    if (basename($f) === '_template.json') continue;
    $targets = json_decode(file_get_contents($f), true);
    if (!$targets) continue;
    foreach ($targets as $t) {
        $allTargets[] = $t;
    }
}

// Build report
$report = [
    'generated_at' => date('c'),
    'db_total'     => (int)$pdo->query("SELECT COUNT(*) FROM redlist_assessments")->fetchColumn(),
    'scopes'       => [],
];

$statusOrder = ['possible' => 1, 'manual_csv_required' => 2, 'not_available' => 3];

usort($allTargets, fn($a, $b) => ($statusOrder[$a['scrape_status']] ?? 9) <=> ($statusOrder[$b['scrape_status']] ?? 9));

foreach ($allTargets as $t) {
    $scopeLevel = !empty($t['municipality_code']) ? 'subnational_2'
        : (!empty($t['region_code']) ? 'subnational_1' : 'national');
    $key = $scopeLevel . '|' . ($t['region_code'] ?? '') . '|' . ($t['municipality_code'] ?? '') . '|' . $t['authority'];
    $dbCount = $dbCounts[$key] ?? 0;

    $report['scopes'][] = [
        'id'             => $t['id'],
        'scope_name'     => $t['scope_name'],
        'scope_level'    => $scopeLevel,
        'region_code'    => $t['region_code'] ?? null,
        'format'         => $t['format'] ?? '?',
        'scrape_status'  => $t['scrape_status'],
        'assessment_year'=> $t['assessment_year'] ?? null,
        'db_entries'     => $dbCount,
        'url'            => $t['url'],
        'note'           => $t['note'] ?? null,
    ];
}

if ($jsonMode) {
    echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit(0);
}

// Terminal output
$total = $report['db_total'];
echo "=== Red List Coverage Dashboard ===\n";
echo "DB Total Entries: {$total}\n";
echo "Generated: " . date('Y-m-d H:i') . "\n\n";

$possible = array_filter($report['scopes'], fn($s) => $s['scrape_status'] === 'possible');
$manual   = array_filter($report['scopes'], fn($s) => $s['scrape_status'] === 'manual_csv_required');

$countPossible = count($possible);
$countManual   = count($manual);
$countInDb     = count(array_filter($report['scopes'], fn($s) => $s['db_entries'] > 0));

echo "Coverage Summary:\n";
echo sprintf("  %-25s %d/%d scopes\n", "In DB:", $countInDb, count($report['scopes']));
echo sprintf("  %-25s %d scopes\n", "Auto-scrapable:", $countPossible);
echo sprintf("  %-25s %d scopes\n", "Manual CSV needed:", $countManual);
echo "\n";

$fmt = "  %-20s %-15s %-10s %-8s %-8s %s\n";
printf($fmt, "Scope", "Level", "Format", "Year", "DB", "Status");
echo "  " . str_repeat("-", 80) . "\n";

foreach ($report['scopes'] as $s) {
    $statusLabel = match($s['scrape_status']) {
        'possible' => '✓ auto',
        'manual_csv_required' => '✗ manual',
        default => '? unknown',
    };
    $dbStr = $s['db_entries'] > 0 ? "[{$s['db_entries']}]" : "-";
    printf($fmt,
        mb_substr($s['scope_name'], 0, 18),
        $s['scope_level'],
        $s['format'] ?? '?',
        $s['assessment_year'] ?? '-',
        $dbStr,
        $statusLabel
    );
}

echo "\nLegend: ✓ auto = scraper available | ✗ manual = convert PDF/Excel to CSV first\n";
echo "Import: php scripts/ingestion/import_redlist.php --file=<name>.csv\n";
echo "Scrape: php scripts/ingestion/scrape_redlist.php --id=<id>\n";
