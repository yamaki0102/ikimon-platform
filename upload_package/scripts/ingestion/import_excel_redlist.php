<?php
/**
 * Excel (.xlsx) Red List Importer
 *
 * Reads .xlsx files in data/redlists/ and imports into OmoikaneDB.
 * Zero external dependencies: uses ZipArchive + SimpleXML (standard PHP).
 *
 * .xlsx は ZIP + XML なので PhpSpreadsheet 不要で直接パース可能。
 *
 * Usage:
 *   php import_excel_redlist.php --file=tokyo_redlist.xlsx
 *   php import_excel_redlist.php --file=tokyo_redlist.xlsx --sheet=0
 *   php import_excel_redlist.php --file=tokyo_redlist.xlsx --dry-run
 *   php import_excel_redlist.php --file=tokyo_redlist.xlsx --header=2  # header on row 2
 *   php import_excel_redlist.php --scan                               # list all xlsx files
 *
 * Config lookup:
 *   Matches filename prefix against configs/prefectures.json and configs/municipalities.json
 *   to auto-fill scope metadata. Or provide --scope-id=tokyo manually.
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/OmoikaneDB.php';

if (php_sapi_name() !== 'cli') die("Run from CLI.\n");

$opts = getopt('', ['file:', 'sheet:', 'header:', 'dry-run', 'scan', 'scope-id:']);

if (isset($opts['scan'])) {
    $files = glob(DATA_DIR . '/redlists/*.xlsx');
    if (empty($files)) {
        echo "No .xlsx files found in data/redlists/\n";
    } else {
        echo "Found " . count($files) . " xlsx files:\n";
        foreach ($files as $f) echo "  " . basename($f) . "\n";
    }
    exit(0);
}

$xlsxFile = $opts['file'] ?? null;
if (!$xlsxFile) {
    echo "Usage: php import_excel_redlist.php --file=tokyo.xlsx [--sheet=0] [--dry-run]\n";
    exit(1);
}

$xlsxPath = DATA_DIR . '/redlists/' . $xlsxFile;
if (!file_exists($xlsxPath)) {
    die("File not found: {$xlsxPath}\n");
}

$sheetIndex = (int)($opts['sheet'] ?? 0);
$headerRow  = (int)($opts['header'] ?? 1);
$dryRun     = isset($opts['dry-run']);
$scopeId    = $opts['scope-id'] ?? null;

// Auto-detect scope config from filename
$scopeConfig = findScopeConfig($xlsxFile, $scopeId);
if (!$scopeConfig) {
    echo "WARNING: No scope config matched. Will use defaults.\n";
    echo "  Use --scope-id=<id> to specify (see configs/prefectures.json, configs/municipalities.json)\n";
    $scopeConfig = [
        'scope_name' => basename($xlsxFile, '.xlsx'),
        'scope_name_en' => null,
        'country_code' => 'JP',
        'region_code' => null,
        'municipality_code' => null,
        'scope_centroid_lat' => null,
        'scope_centroid_lng' => null,
        'parent_scope_name' => null,
        'scope_valid_from' => null,
        'scope_note' => null,
        'authority' => basename($xlsxFile, '.xlsx'),
        'url' => null,
        'assessment_year' => null,
    ];
} else {
    echo "Scope: {$scopeConfig['scope_name']} (matched from config '{$scopeConfig['id']}')\n";
}

echo "Reading: {$xlsxFile} (sheet {$sheetIndex}, header row {$headerRow})\n";

// Parse xlsx
$rows = readXlsx($xlsxPath, $sheetIndex);
if (empty($rows)) {
    die("No data found in xlsx file.\n");
}

echo "Total rows: " . count($rows) . "\n";

// Detect header row and map columns
$headers = $rows[$headerRow - 1] ?? $rows[0];
$headers = array_map(fn($h) => mb_strtolower(trim((string)$h)), $headers);

$colMap = detectColumns($headers);
echo "Column map: " . json_encode($colMap, JSON_UNESCAPED_UNICODE) . "\n\n";

if (empty($colMap['category'])) {
    die("ERROR: Cannot find category column. Check --header= option.\n");
}

// Import
$db = new OmoikaneDB();
$pdo = $db->getPDO();

$insertSql = "
    INSERT OR REPLACE INTO redlist_assessments (
        dedup_key, scientific_name, japanese_name, common_name_en,
        category, criteria, scope_level, country_code, region_code, municipality_code,
        scope_name, scope_name_en, scope_centroid_lat, scope_centroid_lng,
        parent_scope_name, scope_valid_from, scope_note,
        authority, source_url, assessment_year, taxon_group, taxon_group_en, notes
    ) VALUES (
        :dedup_key, :scientific_name, :japanese_name, :common_name_en,
        :category, :criteria, :scope_level, :country_code, :region_code, :municipality_code,
        :scope_name, :scope_name_en, :scope_centroid_lat, :scope_centroid_lng,
        :parent_scope_name, :scope_valid_from, :scope_note,
        :authority, :source_url, :assessment_year, :taxon_group, :taxon_group_en, :notes
    )
";

if (!$dryRun) $stmt = $pdo->prepare($insertSql);

$scopeLevel = !empty($scopeConfig['municipality_code']) ? 'subnational_2'
    : (!empty($scopeConfig['region_code']) ? 'subnational_1' : 'national');

$stats = ['total' => 0, 'imported' => 0, 'skipped' => 0];
$dataRows = array_slice($rows, $headerRow);

if (!$dryRun) $pdo->beginTransaction();

foreach ($dataRows as $lineNum => $row) {
    $stats['total']++;

    $get = fn(string $field) => isset($colMap[$field]) ? trim((string)($row[$colMap[$field]] ?? '')) : '';

    $jaName   = $get('japanese_name');
    $sciName  = $get('scientific_name');
    $category = normalizeCategory($get('category'));
    $criteria = $get('criteria');
    $taxonGrp = $get('taxon_group');
    $notes    = $get('notes');

    if (!$category || (!$jaName && !$sciName)) {
        $stats['skipped']++;
        continue;
    }

    if ($dryRun) {
        echo "  DRY L" . ($lineNum + $headerRow + 1) . ": {$jaName} / {$sciName} → {$category}\n";
        $stats['imported']++;
        continue;
    }

    $dedupKey = ($sciName ?: $jaName) . "|{$scopeLevel}|" . ($scopeConfig['country_code'] ?? '') . "|" . ($scopeConfig['region_code'] ?? '') . "|" . ($scopeConfig['municipality_code'] ?? '') . "|" . $scopeConfig['authority'];

    $stmt->execute([
        ':dedup_key'          => $dedupKey,
        ':scientific_name'    => $sciName ?: '(unknown)',
        ':japanese_name'      => $jaName ?: null,
        ':common_name_en'     => null,
        ':category'           => $category,
        ':criteria'           => $criteria ?: null,
        ':scope_level'        => $scopeLevel,
        ':country_code'       => $scopeConfig['country_code'] ?? null,
        ':region_code'        => $scopeConfig['region_code'] ?? null,
        ':municipality_code'  => $scopeConfig['municipality_code'] ?? null,
        ':scope_name'         => $scopeConfig['scope_name'],
        ':scope_name_en'      => $scopeConfig['scope_name_en'] ?? null,
        ':scope_centroid_lat' => $scopeConfig['scope_centroid_lat'] ?? null,
        ':scope_centroid_lng' => $scopeConfig['scope_centroid_lng'] ?? null,
        ':parent_scope_name'  => $scopeConfig['parent_scope_name'] ?? null,
        ':scope_valid_from'   => $scopeConfig['scope_valid_from'] ?? null,
        ':scope_note'         => $scopeConfig['scope_note'] ?? null,
        ':authority'          => $scopeConfig['authority'],
        ':source_url'         => $scopeConfig['url'] ?? null,
        ':assessment_year'    => $scopeConfig['assessment_year'] ?? null,
        ':taxon_group'        => $taxonGrp ?: null,
        ':taxon_group_en'     => null,
        ':notes'              => $notes ?: null,
    ]);
    $stats['imported']++;
}

if (!$dryRun) $pdo->commit();

echo "\n=== Excel Import Summary ===\n";
echo "Total rows:  {$stats['total']}\n";
echo "Imported:    {$stats['imported']}\n";
echo "Skipped:     {$stats['skipped']}\n";
if ($dryRun) echo "(Dry run)\n";

// ---------------------------------------------------
// Functions
// ---------------------------------------------------

function readXlsx(string $path, int $sheetIndex = 0): array
{
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        die("Cannot open xlsx: {$path}\n");
    }

    // Read shared strings (cell values that are stored as indexed strings)
    $sharedStrings = [];
    $ssXml = $zip->getFromName('xl/sharedStrings.xml');
    if ($ssXml) {
        $ss = simplexml_load_string($ssXml);
        foreach ($ss->si as $si) {
            // Handle both <t> and <r><t> formats
            $text = '';
            if (isset($si->t)) {
                $text = (string)$si->t;
            } elseif (isset($si->r)) {
                foreach ($si->r as $r) {
                    $text .= (string)$r->t;
                }
            }
            $sharedStrings[] = $text;
        }
    }

    // Find the target sheet
    $workbookXml = $zip->getFromName('xl/workbook.xml');
    $sheetFile = "xl/worksheets/sheet" . ($sheetIndex + 1) . ".xml";

    // Try to get the actual sheet filename from workbook relationships
    $relsXml = $zip->getFromName('xl/_rels/workbook.xml.rels');
    if ($relsXml) {
        $rels = simplexml_load_string($relsXml);
        $i = 0;
        foreach ($rels->Relationship as $rel) {
            $type = (string)$rel['Type'];
            if (str_contains($type, 'worksheet')) {
                if ($i === $sheetIndex) {
                    $target = (string)$rel['Target'];
                    $sheetFile = 'xl/' . ltrim($target, '/');
                    break;
                }
                $i++;
            }
        }
    }

    $sheetXml = $zip->getFromName($sheetFile);
    $zip->close();

    if (!$sheetXml) {
        die("Sheet {$sheetIndex} not found in xlsx\n");
    }

    $sheet = simplexml_load_string($sheetXml);
    $rows = [];

    foreach ($sheet->sheetData->row as $row) {
        $rowData = [];
        $maxCol = 0;

        foreach ($row->c as $cell) {
            $colLetter = preg_replace('/[0-9]/', '', (string)$cell['r']);
            $colIndex  = colLetterToIndex($colLetter);
            $maxCol    = max($maxCol, $colIndex);

            $type  = (string)$cell['t'];
            $value = (string)($cell->v ?? $cell->is->t ?? '');

            if ($type === 's') {
                $value = $sharedStrings[(int)$value] ?? '';
            } elseif ($type === 'inlineStr') {
                $value = (string)($cell->is->t ?? '');
            }

            $rowData[$colIndex] = $value;
        }

        // Fill gaps with empty strings
        $filled = [];
        for ($i = 0; $i <= $maxCol; $i++) {
            $filled[] = $rowData[$i] ?? '';
        }
        $rows[] = $filled;
    }

    return $rows;
}

function colLetterToIndex(string $col): int
{
    $col = strtoupper($col);
    $index = 0;
    for ($i = 0; $i < strlen($col); $i++) {
        $index = $index * 26 + (ord($col[$i]) - ord('A') + 1);
    }
    return $index - 1;
}

function detectColumns(array $headers): array
{
    $map = [];
    $jaKw   = ['和名', '種名', '日本語', '名称', 'japanese', 'ja_name', '生物名'];
    $sciKw  = ['学名', 'scientific', 'latin', 'species'];
    $catKw  = ['カテゴリ', 'ランク', '区分', 'category', 'rank', 'status', 'コード', '評価'];
    $grpKw  = ['分類群', '目名', '科名', 'group', 'taxon', '分類', '綱'];
    $crtKw  = ['criteria', '基準', '判定基準'];
    $noteKw = ['備考', 'note', 'remarks', '注記'];

    foreach ($headers as $i => $h) {
        foreach ($catKw  as $kw) { if (str_contains($h, $kw)) { $map['category']      = $i; break; } }
        foreach ($sciKw  as $kw) { if (str_contains($h, $kw)) { $map['scientific_name']= $i; break; } }
        foreach ($jaKw   as $kw) { if (str_contains($h, $kw) && !isset($map['japanese_name']))  { $map['japanese_name'] = $i; break; } }
        foreach ($grpKw  as $kw) { if (str_contains($h, $kw)) { $map['taxon_group']   = $i; break; } }
        foreach ($crtKw  as $kw) { if (str_contains($h, $kw)) { $map['criteria']      = $i; break; } }
        foreach ($noteKw as $kw) { if (str_contains($h, $kw)) { $map['notes']         = $i; break; } }
    }
    return $map;
}

function normalizeCategory(string $cat): string
{
    $cat = strtoupper(trim($cat));
    $known = ['EX','EW','CR','EN','VU','NT','LC','DD','NE','LP','CR+EN'];
    if (in_array($cat, $known, true)) return $cat;

    $jaMap = [
        '絶滅危惧IA類' => 'CR', '絶滅危惧IA'  => 'CR',
        '絶滅危惧IB類' => 'EN', '絶滅危惧IB'  => 'EN',
        '絶滅危惧I類'  => 'CR+EN', '絶滅危惧Ⅰ類' => 'CR+EN',
        '絶滅危惧II類' => 'VU',  '絶滅危惧Ⅱ類' => 'VU',
        '準絶滅危惧'   => 'NT',  '情報不足'    => 'DD',
        '野生絶滅'     => 'EW',  '絶滅'        => 'EX',
        '地域個体群'   => 'LP',  '低懸念'      => 'LC',
    ];
    foreach ($jaMap as $ja => $code) {
        if (str_contains($cat, strtoupper($ja)) || str_contains(normalizeJa($cat), $ja)) {
            return $code;
        }
    }
    return '';
}

function normalizeJa(string $s): string
{
    return mb_convert_kana(trim($s), 'KVC');
}

function findScopeConfig(string $filename, ?string $forceId): ?array
{
    $configDir = DATA_DIR . '/redlists/configs';
    $configFiles = glob("{$configDir}/*.json");
    $base = strtolower(basename($filename, '.xlsx'));

    foreach ($configFiles as $cf) {
        if (basename($cf) === '_template.json') continue;
        $targets = json_decode(file_get_contents($cf), true);
        if (!$targets) continue;
        foreach ($targets as $t) {
            if ($forceId && $t['id'] === $forceId) return $t;
            if (!$forceId) {
                $id = strtolower($t['id']);
                $scopeName = strtolower($t['scope_name'] ?? '');
                if (str_contains($base, $id) || str_contains($base, $scopeName)) return $t;
            }
        }
    }
    return null;
}
