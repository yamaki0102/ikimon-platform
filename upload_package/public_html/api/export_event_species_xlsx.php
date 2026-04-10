<?php

/**
 * Event Species List XLSX Export
 *
 * Generates a species-aggregated XLSX for a given event (observation meeting).
 * Available to Public plan corporations only.
 * Uses ZipArchive to build Open XML Spreadsheet without external libraries.
 *
 * Usage: GET /api/export_event_species_xlsx.php?event_id=evt_xxxx
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/EventManager.php';
require_once __DIR__ . '/../../libs/CorporatePlanGate.php';
require_once __DIR__ . '/../../libs/CorporateManager.php';
require_once __DIR__ . '/../../libs/RedListManager.php';
require_once __DIR__ . '/../../libs/PrivacyFilter.php';
require_once __DIR__ . '/../../libs/GeoUtils.php';

// --- ZipArchive availability check ---
if (!extension_loaded('zip')) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'XLSX生成に必要なzip拡張が無効です。CSVをご利用ください。'], JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE);
    exit;
}

// --- Auth ---
Auth::init();

if (!Auth::isLoggedIn()) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'ログインが必要です'], JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE);
    exit;
}

$user = Auth::user();

// --- Event Loading ---
$eventId = $_GET['event_id'] ?? '';
if (!$eventId) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'event_id パラメータが必要です'], JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE);
    exit;
}

$event = EventManager::get($eventId);
if (!$event) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'イベントが見つかりません'], JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE);
    exit;
}

// --- Permission Check (organizer or admin) ---
$isOrganizer = ($user['id'] === ($event['organizer_id'] ?? ''));
$isAdmin = (($user['role'] ?? '') === 'Admin');
if (!$isOrganizer && !$isAdmin) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => '権限がありません'], JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE);
    exit;
}

// --- Plan Gate (Public plan only) ---
$corporation = CorporatePlanGate::resolveCorporationForEvent($event);
if ($corporation && !CorporatePlanGate::canUseAdvancedOutputs($corporation)) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Community ワークスペースでは種リストXLSXをエクスポートできません。Public プランにアップグレードしてください。'], JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE);
    exit;
}

// --- Observation Collection (same logic as CSV export / generate_grant_report.php) ---
$eventDate = $event['event_date'] ?? date('Y-m-d');
$startTime = $event['start_time'] ?? '09:00';
$endTime = $event['end_time'] ?? '12:00';
$bufferMin = 30;

$rangeStart = (new DateTime("{$eventDate} {$startTime}"))->modify("-{$bufferMin} minutes");
$rangeEnd = (new DateTime("{$eventDate} {$endTime}"))->modify("+{$bufferMin} minutes");
$evtLat = (float)($event['location']['lat'] ?? 0);
$evtLng = (float)($event['location']['lng'] ?? 0);
$radiusM = (int)($event['location']['radius_m'] ?? 500);
$eventCode = $event['event_code'] ?? '';

$linkedIds = $event['linked_observations'] ?? [];
$touchedObsIds = [];
$matchedObs = [];

$dateKey = str_replace('-', '', $eventDate);
$partitionFile = "observations/{$dateKey}";
$dayObservations = DataStore::get($partitionFile);
$candidates = $dayObservations ? $dayObservations : DataStore::getLatest('observations', 2000);

foreach ($candidates as $obs) {
    $obsId = $obs['id'] ?? '';
    if (isset($touchedObsIds[$obsId])) {
        continue;
    }

    $obsTag = $obs['event_tag'] ?? '';
    if (in_array($obsId, $linkedIds) || ($eventCode && $obsTag === $eventCode)) {
        $touchedObsIds[$obsId] = true;
        $matchedObs[] = $obs;
        continue;
    }

    $obsTime = $obs['observed_at'] ?? $obs['created_at'] ?? '';
    if (!$obsTime || strpos($obsTime, $eventDate) !== 0) {
        continue;
    }

    $obsDateTime = new DateTime($obsTime);
    if ($obsDateTime >= $rangeStart && $obsDateTime <= $rangeEnd) {
        $obsLat = (float)($obs['lat'] ?? 0);
        $obsLng = (float)($obs['lng'] ?? 0);
        if ($obsLat && $obsLng && $evtLat && $evtLng && GeoUtils::distance($evtLat, $evtLng, $obsLat, $obsLng) <= $radiusM) {
            $touchedObsIds[$obsId] = true;
            $matchedObs[] = $obs;
        }
    }
}

// --- Species Aggregation ---
$speciesAgg = [];

foreach ($matchedObs as $obs) {
    $taxonName = $obs['taxon']['name'] ?? ($obs['identifications'][0]['taxon_name'] ?? '不明');
    $scientificName = $obs['taxon']['scientific_name'] ?? ($obs['scientific_name'] ?? '');
    $taxonKey = $obs['taxon']['key'] ?? ($obs['taxon_key'] ?? ($obs['gbif_key'] ?? ''));
    $obsTime = $obs['observed_at'] ?? ($obs['created_at'] ?? '');
    $hasPhoto = !empty($obs['photos']) || !empty($obs['images']) || !empty($obs['image_url']);

    if ($taxonName === '不明') {
        continue;
    }

    if (!isset($speciesAgg[$taxonName])) {
        $speciesAgg[$taxonName] = [
            'scientific_name' => $scientificName,
            'taxon_key' => $taxonKey,
            'count' => 0,
            'first_time' => $obsTime,
            'last_time' => $obsTime,
            'has_photo' => false,
        ];
    }

    $agg = &$speciesAgg[$taxonName];
    $agg['count']++;

    if ($obsTime && (!$agg['first_time'] || $obsTime < $agg['first_time'])) {
        $agg['first_time'] = $obsTime;
    }
    if ($obsTime && (!$agg['last_time'] || $obsTime > $agg['last_time'])) {
        $agg['last_time'] = $obsTime;
    }
    if ($hasPhoto) {
        $agg['has_photo'] = true;
    }
    if (!$agg['scientific_name'] && $scientificName) {
        $agg['scientific_name'] = $scientificName;
    }
    if (!$agg['taxon_key'] && $taxonKey) {
        $agg['taxon_key'] = $taxonKey;
    }
    unset($agg);
}

ksort($speciesAgg);

// --- RedList + Privacy ---
$redListManager = new RedListManager();

// --- Build row data ---
$headers = ['和名', '学名', 'taxon_key', '観察件数', '初観察時刻', '最終観察時刻', '代表写真有無', '希少種フラグ', '公開可否'];
$columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

$rows = [];
foreach ($speciesAgg as $name => $data) {
    $redListCategory = '';
    try {
        $rlResult = $redListManager->lookup($name);
        if ($rlResult) {
            $redListCategory = $rlResult['category'] ?? '';
        }
    } catch (\Throwable $e) {
        // skip
    }

    $isProtected = PrivacyFilter::isProtectedSpecies($name);

    $rows[] = [
        $name,
        $data['scientific_name'],
        (string)$data['taxon_key'],
        $data['count'],
        $data['first_time'],
        $data['last_time'],
        $data['has_photo'] ? 'TRUE' : 'FALSE',
        $redListCategory,
        $isProtected ? '要配慮' : 'OK',
    ];
}

// --- Collect shared strings ---
$sharedStrings = [];
$ssIndex = [];

$collectString = function (string $val) use (&$sharedStrings, &$ssIndex): int {
    if (!isset($ssIndex[$val])) {
        $ssIndex[$val] = count($sharedStrings);
        $sharedStrings[] = $val;
    }
    return $ssIndex[$val];
};

$headerIndices = [];
foreach ($headers as $h) {
    $headerIndices[] = $collectString($h);
}

$rowStringIndices = [];
foreach ($rows as $row) {
    $ri = [];
    foreach ($row as $colIdx => $cell) {
        if ($colIdx === 3) {
            $ri[] = null;
        } else {
            $ri[] = $collectString((string)$cell);
        }
    }
    $rowStringIndices[] = $ri;
}

// --- XML escape helper ---
$esc = function (string $s): string {
    return htmlspecialchars($s, ENT_XML1 | ENT_QUOTES, 'UTF-8');
};

// --- Build [Content_Types].xml ---
$contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    . '<Default Extension="xml" ContentType="application/xml"/>'
    . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    . '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
    . '</Types>';

// --- Build _rels/.rels ---
$rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    . '</Relationships>';

// --- Build xl/workbook.xml ---
$workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    . '<sheets><sheet name="種リスト" sheetId="1" r:id="rId1"/></sheets>'
    . '</workbook>';

// --- Build xl/_rels/workbook.xml.rels ---
$workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    . '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
    . '</Relationships>';

// --- Build xl/styles.xml (font normal + bold, cellXfs: default + bold) ---
$styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    . '<fonts count="2">'
    . '<font><sz val="11"/><name val="Calibri"/></font>'
    . '<font><b/><sz val="11"/><name val="Calibri"/></font>'
    . '</fonts>'
    . '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
    . '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    . '<cellXfs count="2">'
    . '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    . '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
    . '</cellXfs>'
    . '</styleSheet>';

// --- Build xl/sharedStrings.xml ---
$ssCount = count($sharedStrings);
$ssXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' . $ssCount . '" uniqueCount="' . $ssCount . '">';
foreach ($sharedStrings as $str) {
    $ssXml .= '<si><t>' . $esc($str) . '</t></si>';
}
$ssXml .= '</sst>';

// --- Build xl/worksheets/sheet1.xml ---
$sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    . '<sheetData>';

$sheetXml .= '<row r="1">';
foreach ($headerIndices as $colIdx => $ssIdx) {
    $sheetXml .= '<c r="' . $columns[$colIdx] . '1" t="s" s="1"><v>' . $ssIdx . '</v></c>';
}
$sheetXml .= '</row>';

$rowNum = 2;
foreach ($rowStringIndices as $ri) {
    $sheetXml .= '<row r="' . $rowNum . '">';
    foreach ($ri as $colIdx => $ssIdx) {
        $ref = $columns[$colIdx] . $rowNum;
        if ($colIdx === 3) {
            $sheetXml .= '<c r="' . $ref . '"><v>' . $rows[$rowNum - 2][3] . '</v></c>';
        } else {
            $sheetXml .= '<c r="' . $ref . '" t="s"><v>' . $ssIdx . '</v></c>';
        }
    }
    $sheetXml .= '</row>';
    $rowNum++;
}

$sheetXml .= '</sheetData></worksheet>';

// --- Build XLSX via ZipArchive ---
$tmp = tempnam(sys_get_temp_dir(), 'xlsx');
$zip = new ZipArchive();
if ($zip->open($tmp, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'XLSXファイルの作成に失敗しました'], JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE);
    exit;
}

$zip->addFromString('[Content_Types].xml', $contentTypes);
$zip->addFromString('_rels/.rels', $rels);
$zip->addFromString('xl/workbook.xml', $workbook);
$zip->addFromString('xl/_rels/workbook.xml.rels', $workbookRels);
$zip->addFromString('xl/styles.xml', $styles);
$zip->addFromString('xl/sharedStrings.xml', $ssXml);
$zip->addFromString('xl/worksheets/sheet1.xml', $sheetXml);
$zip->close();

// --- Output ---
$eventTitle = preg_replace('/[^\w\-]/', '_', $event['title'] ?? $eventId);
$filename = "event_species_{$eventTitle}_" . date('Ymd') . ".xlsx";

header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . filesize($tmp));
header('Pragma: no-cache');
header('Expires: 0');
readfile($tmp);
unlink($tmp);
exit;
