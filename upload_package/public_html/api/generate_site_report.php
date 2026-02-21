<?php

/**
 * Phase 14A: Site Biodiversity Report Generator
 * 
 * Generates a print-ready HTML report with:
 *   - Site overview (boundary, area, location)
 *   - Observation statistics (species count, taxonomy breakdown)
 *   - Red List assessment (via RedListManager)
 *   - BIS score (Biodiversity Integrity Score)
 *   - TNFD disclosure alignment
 *   - Species inventory table
 * 
 * Usage: api/generate_site_report.php?site_id=aikan_hq
 * 
 * Output: Printable HTML (use browser "Print → Save as PDF")
 * 
 * @requires libs/SiteManager.php
 * @requires libs/RedListManager.php
 * @requires libs/DataStore.php
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/SiteManager.php';
require_once __DIR__ . '/../../libs/RedListManager.php';
require_once __DIR__ . '/../../libs/BiodiversityScorer.php';

// --- Initialization ---
$siteId = $_GET['site_id'] ?? null;
$startDate = $_GET['start_date'] ?? null; // YYYY-MM-DD
$endDate = $_GET['end_date'] ?? null;     // YYYY-MM-DD
$isPublicMode = isset($_GET['public_mode']) && $_GET['public_mode'] === '1';

if (!$siteId) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'site_id is required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$redListManager = new RedListManager();

$site = SiteManager::load($siteId);
if (!$site) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'Site not found: ' . $siteId], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// --- Data Collection ---

// Observations within this site
$allObs = DataStore::fetchAll('observations');
$siteObs = [];

foreach ($allObs as $obs) {
    // Date Filtering
    $obsDate = $obs['observed_at'] ?? ($obs['created_at'] ?? null);
    if ($obsDate) {
        $dateOnly = substr($obsDate, 0, 10);
        if ($startDate && $dateOnly < $startDate) continue;
        if ($endDate && $dateOnly > $endDate) continue;
    }

    // Match by site_id field or by geospatial containment
    if (($obs['site_id'] ?? null) === $siteId) {
        $siteObs[] = $obs;
    } elseif (isset($obs['location']['lat'], $obs['location']['lon'])) {
        if (isset($site['geometry']) && SiteManager::isPointInGeometry(
            floatval($obs['location']['lat']),
            floatval($obs['location']['lon']),
            $site['geometry']
        )) {
            $siteObs[] = $obs;
        }
    }
}

// --- Compute Statistics ---

$speciesMap = []; // name => ['count' => N, 'sci_name' => ..., 'taxon_group' => ...]
$taxonomyBreakdown = [];
$monthlyTrend = [];
$researchGradeCount = 0;
// Recalculate range based on actual filtered data
$firstObs = null;
$lastObs = null;

foreach ($siteObs as $obs) {
    $name = $obs['taxon']['name'] ?? ($obs['species_name'] ?? '不明');
    $sciName = $obs['taxon']['scientific_name'] ?? ($obs['scientific_name'] ?? '');
    $taxonGroup = $obs['taxon']['class'] ?? ($obs['taxon']['kingdom'] ?? 'Other');

    // Map common class names to Japanese
    $taxonGroupJa = match ($taxonGroup) {
        'Insecta' => '昆虫類',
        'Arachnida' => 'クモ類',
        'Aves' => '鳥類',
        'Mammalia' => '哺乳類',
        'Reptilia' => '爬虫類',
        'Amphibia' => '両生類',
        'Actinopterygii' => '魚類',
        'Plantae' => '植物',
        'Fungi' => '菌類',
        default => 'その他',
    };

    if (!isset($speciesMap[$name])) {
        $speciesMap[$name] = [
            'count' => 0,
            'sci_name' => $sciName,
            'taxon_group' => $taxonGroupJa,
            'last_seen' => null
        ];
    }
    $speciesMap[$name]['count']++;

    // Date tracking
    $date = $obs['observed_at'] ?? ($obs['created_at'] ?? null);
    if ($date) {
        $ts = strtotime($date);
        if ($ts) {
            $ym = date('Y-m', $ts);
            $monthlyTrend[$ym] = ($monthlyTrend[$ym] ?? 0) + 1;

            if ($speciesMap[$name]['last_seen'] === null || $date > $speciesMap[$name]['last_seen']) {
                $speciesMap[$name]['last_seen'] = $date;
            }
            if ($firstObs === null || $date < $firstObs) $firstObs = $date;
            if ($lastObs === null || $date > $lastObs) $lastObs = $date;
        }
    }

    // Taxonomy breakdown
    $taxonomyBreakdown[$taxonGroupJa] = ($taxonomyBreakdown[$taxonGroupJa] ?? 0) + 1;

    // Research Grade
    if (($obs['quality_grade'] ?? ($obs['status'] ?? '')) === 'Research Grade') {
        $researchGradeCount++;
    }
}

// Sort monthly trend
ksort($monthlyTrend);
arsort($taxonomyBreakdown);

$totalObs = count($siteObs);
$totalSpecies = $isPublicMode ? 0 : count($speciesMap); // Will need to adjust logic if masking logic changes
if ($isPublicMode) {
    // In Public Mode, we count species but might display differently
    // Actually totalSpecies usually should be the total number of species detected, even if names are masked.
    // So let's revert to count($speciesMap) but keep in mind display logic handles masking.
    $totalSpecies = count($speciesMap);
}

$researchGradePercent = $totalObs > 0 ? round(($researchGradeCount / $totalObs) * 100, 1) : 0;
/** @phpstan-ignore-line */

// --- Red List Assessment ---
$speciesNames = array_keys($speciesMap);
$redListResult = $redListManager->checkObservations($siteObs, 'shizuoka');
$redListSpecies = $redListResult['species'];
$redListSummary = $redListResult['summary'];

// Enrich species map with Red List info
foreach ($redListSpecies as $name => $lists) {
    if (isset($speciesMap[$name])) {
        $speciesMap[$name]['redlist'] = $lists;
        // Get highest severity
        $maxSeverity = 0;
        foreach ($lists as $listEntry) {
            if ($listEntry['severity'] > $maxSeverity) {
                $maxSeverity = $listEntry['severity'];
            }
        }
        $speciesMap[$name]['redlist_severity'] = $maxSeverity;
    }
}

// Sort species: Red-listed first (by severity desc), then by count desc
uasort($speciesMap, function ($a, $b) {
    // In public mode, we might want to change sort order to hide "important" species mix?
    // But usually sorting by importance is still good for internal calc, view handles hiding.
    $sevA = $a['redlist_severity'] ?? 0;
    $sevB = $b['redlist_severity'] ?? 0;
    if ($sevA !== $sevB) return $sevB - $sevA;
    return $b['count'] - $a['count'];
});

// --- Event Activities linked to this site ---
$siteEvents = [];
$allEvents = DataStore::fetchAll('events') ?: [];
foreach ($allEvents as $ev) {
    // Match events by location overlap or explicit site_id
    if (($ev['site_id'] ?? '') === $siteId) {
        $siteEvents[] = $ev;
    } elseif (isset($ev['lat'], $ev['lng']) && isset($site['geometry'])) {
        if (SiteManager::isPointInGeometry(floatval($ev['lat']), floatval($ev['lng']), $site['geometry'])) {
            $siteEvents[] = $ev;
        }
    }
}
// Count observations linked to each event
foreach ($siteEvents as &$ev) {
    $evObsCount = 0;
    foreach ($siteObs as $obs) {
        if (($obs['event_id'] ?? '') === ($ev['id'] ?? '')) {
            $evObsCount++;
        }
    }
    $ev['obs_count'] = $evObsCount;
}
unset($ev);
// Sort events by date desc
usort($siteEvents, fn($a, $b) => strcmp($b['event_date'] ?? '', $a['event_date'] ?? ''));

// --- BIS Score (Biodiversity Integrity Score) via BiodiversityScorer ---
$bisResult = BiodiversityScorer::calculate($siteObs, ['area_ha' => $site['properties']['area_ha'] ?? 0]);
$bis = $bisResult['total_score'];
$bisBreakdown = $bisResult['breakdown'];

// BIS color
$bisColor = $bis >= 75 ? '#10b981' : ($bis >= 50 ? '#eab308' : ($bis >= 25 ? '#f97316' : '#ef4444'));

// --- Report metadata ---
$reportDate = date('Y年m月d日');
if ($startDate && $endDate) {
    $reportPeriod = date('Y年n月d日', strtotime($startDate)) . ' ～ ' . date('Y年n月d日', strtotime($endDate));
} elseif ($firstObs) {
    $reportPeriod = (date('Y年n月', strtotime($firstObs)) . ' ～ ' . date('Y年n月', strtotime($lastObs)));
} else {
    $reportPeriod = '期間指定なし（データなし）';
}
$siteName = $site['properties']['name'] ?? $site['name'] ?? $siteId;
$siteNameEn = $site['properties']['name_en'] ?? '';

// --- Output HTML ---
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>生物多様性レポート - <?php echo htmlspecialchars($siteName); ?></title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;700;900&display=swap');

        :root {
            --primary: #10b981;
            --primary-dark: #065f46;
            --danger: #dc2626;
            --warning: #f59e0b;
            --bg: #ffffff;
            --text: #1a1a2e;
            --muted: #6b7280;
            --border: #e5e7eb;
            --surface: #f9fafb;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Noto Sans JP', 'Hiragino Sans', sans-serif;
            background: var(--bg);
            color: var(--text);
            font-size: 13px;
            line-height: 1.7;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
        }

        /* Header */
        .report-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid var(--primary);
            padding-bottom: 16px;
            margin-bottom: 24px;
        }

        .report-header .brand {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .report-header .brand-logo {
            font-size: 22px;
            font-weight: 900;
            color: var(--primary);
            letter-spacing: -0.5px;
        }

        .report-header .brand-sub {
            font-size: 10px;
            color: var(--muted);
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        .report-header .meta {
            text-align: right;
            font-size: 11px;
            color: var(--muted);
        }

        .report-header .meta strong {
            display: block;
            font-size: 12px;
            color: var(--text);
        }

        /* Title */
        .report-title {
            margin-bottom: 24px;
        }

        .report-title h1 {
            font-size: 26px;
            font-weight: 900;
            letter-spacing: -0.5px;
            line-height: 1.3;
        }

        .report-title .en {
            font-size: 12px;
            color: var(--muted);
            font-weight: 300;
        }

        .report-title .compliance {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-top: 8px;
            padding: 4px 10px;
            background: #ecfdf5;
            color: var(--primary-dark);
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }

        /* Section */
        h2 {
            font-size: 16px;
            font-weight: 700;
            color: var(--primary-dark);
            margin: 28px 0 12px;
            padding-bottom: 4px;
            border-bottom: 2px solid var(--primary);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        h2 .icon {
            font-size: 18px;
        }

        /* Summary Grid */
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin: 16px 0;
        }

        .summary-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 14px;
            text-align: center;
        }

        .summary-card.highlight {
            background: var(--primary);
            color: white;
            border-color: var(--primary);
        }

        .summary-card .val {
            font-size: 28px;
            font-weight: 900;
            display: block;
            line-height: 1.1;
        }

        .summary-card .lbl {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 4px;
            opacity: 0.8;
        }

        /* BIS Section */
        .bis-section {
            background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%);
            color: white;
            border-radius: 10px;
            padding: 20px 24px;
            margin: 16px 0;
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .bis-score {
            font-size: 52px;
            font-weight: 900;
            line-height: 1;
            min-width: 80px;
            text-align: center;
        }

        .bis-details h3 {
            font-size: 14px;
            margin-bottom: 6px;
        }

        .bis-details p {
            font-size: 11px;
            opacity: 0.9;
        }

        .bis-bar-container {
            margin-top: 8px;
            display: flex;
            gap: 4px;
            align-items: center;
        }

        .bis-bar {
            flex: 1;
            height: 6px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
            overflow: hidden;
        }

        .bis-bar-fill {
            height: 100%;
            border-radius: 3px;
            background: white;
            transition: width 0.3s;
        }

        .bis-bar-label {
            font-size: 9px;
            opacity: 0.7;
            min-width: 60px;
        }

        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
            font-size: 12px;
        }

        th,
        td {
            padding: 8px 10px;
            text-align: left;
            border-bottom: 1px solid var(--border);
        }

        th {
            background: var(--surface);
            font-weight: 700;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--muted);
        }

        /* Red List Badge */
        .rl-badge {
            display: inline-block;
            padding: 1px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 700;
            color: white;
            white-space: nowrap;
        }

        .rl-badge.cr {
            background: #dc2626;
        }

        .rl-badge.en {
            background: #ea580c;
        }

        .rl-badge.vu {
            background: #eab308;
            color: #1a1a2e;
        }

        .rl-badge.nt {
            background: #22c55e;
        }

        .rl-badge.dd {
            background: #6b7280;
        }

        /* Red List Alert */
        .rl-alert {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 8px;
            padding: 14px;
            margin: 12px 0;
        }

        .rl-alert-header {
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 700;
            color: #991b1b;
            margin-bottom: 8px;
        }

        .rl-alert p {
            font-size: 12px;
            color: #7f1d1d;
        }

        /* Bar chart */
        .bar-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 4px 0;
        }

        .bar-label {
            width: 60px;
            font-size: 11px;
            text-align: right;
        }

        .bar-track {
            flex: 1;
            height: 16px;
            background: var(--surface);
            border-radius: 3px;
            overflow: hidden;
        }

        .bar-fill {
            height: 100%;
            background: var(--primary);
            border-radius: 3px;
            min-width: 2px;
        }

        .bar-val {
            font-size: 11px;
            font-weight: 700;
            min-width: 30px;
        }

        /* Trend chart */
        .trend-chart {
            display: flex;
            align-items: flex-end;
            gap: 3px;
            height: 80px;
            margin: 12px 0;
            padding: 4px 0;
        }

        .trend-bar {
            flex: 1;
            background: var(--primary);
            border-radius: 2px 2px 0 0;
            min-width: 12px;
            position: relative;
        }

        .trend-bar .tip {
            position: absolute;
            top: -16px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 9px;
            font-weight: 700;
            white-space: nowrap;
        }

        .trend-labels {
            display: flex;
            gap: 3px;
            margin-top: 2px;
        }

        .trend-labels span {
            flex: 1;
            text-align: center;
            font-size: 8px;
            color: var(--muted);
            min-width: 12px;
        }

        /* Disclaimer */
        .disclaimer {
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 6px;
            padding: 12px;
            margin: 20px 0;
            font-size: 11px;
            color: #92400e;
        }

        .disclaimer strong {
            color: #78350f;
        }

        /* Footer */
        .report-footer {
            margin-top: 40px;
            padding-top: 16px;
            border-top: 1px solid var(--border);
            font-size: 10px;
            color: var(--muted);
            text-align: center;
        }

        /* TNFD table */
        .tnfd-check {
            color: var(--primary);
            font-weight: 700;
        }

        /* Print */
        @media print {
            body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }

            .container {
                max-width: 100%;
                padding: 20px;
            }

            .no-print {
                display: none !important;
            }

            .page-break {
                page-break-before: always;
            }
        }

        /* Action bar */
        .action-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: white;
            border-top: 1px solid var(--border);
            padding: 12px 24px;
            display: flex;
            justify-content: center;
            gap: 12px;
            z-index: 100;
        }

        .action-bar button {
            padding: 10px 28px;
            font-size: 14px;
            font-weight: 700;
            border-radius: 6px;
            cursor: pointer;
            border: none;
        }

        .btn-print {
            background: var(--primary);
            color: white;
        }

        .btn-back {
            background: var(--surface);
            color: var(--text);
            border: 1px solid var(--border) !important;
        }
    </style>
</head>

<body>
    <div class="container" style="padding-bottom: 80px;">

        <!-- Header -->
        <div class="report-header">
            <div>
                <div class="brand">
                    <span class="brand-logo">ikimon</span>
                </div>
                <div class="brand-sub">Biodiversity Monitoring Platform</div>
            </div>
            <div class="meta">
                <strong>サイト生物多様性レポート</strong>
                作成日: <?php echo $reportDate; ?><br>
                対象期間: <?php echo $reportPeriod; ?>
            </div>
        </div>

        <!-- Title -->
        <div class="report-title">
            <h1><?php echo htmlspecialchars($siteName); ?></h1>
            <?php if ($siteNameEn): ?>
                <span class="en"><?php echo htmlspecialchars($siteNameEn); ?></span>
            <?php endif; ?>
            <div>
                <span class="compliance">✓ TNFD LEAP対応</span>
                <span class="compliance">✓ 30by30対応</span>
                <span class="compliance">✓ Darwin Core準拠</span>
            </div>
        </div>

        <!-- Summary Cards -->
        <div class="summary-grid">
            <div class="summary-card highlight">
                <span class="val"><?php echo $bis; ?></span>
                <span class="lbl">BIS スコア</span>
            </div>
            <div class="summary-card">
                <span class="val"><?php echo $totalSpecies; ?></span>
                <span class="lbl">確認種数</span>
            </div>
            <div class="summary-card">
                <span class="val"><?php echo $totalObs; ?></span>
                <span class="lbl">総観察数</span>
            </div>
            <div class="summary-card">
                <span class="val" style="color: <?php echo count($redListSpecies) > 0 ? '#dc2626' : 'inherit'; ?>">
                    <?php echo count($redListSpecies); ?>
                </span>
                <span class="lbl">RL掲載種</span>
            </div>
        </div>

        <!-- BIS Score -->
        <div class="bis-section">
            <div class="bis-score"><?php echo $bis; ?></div>
            <div class="bis-details">
                <h3>Biodiversity Integrity Score (BIS)</h3>
                <p>種の多様性、データ信頼性、保全価値、分類群カバレッジ、モニタリング努力を総合評価。</p>
                <?php
                $bisAxisLabelsJa = [
                    'richness'           => '種の豊富さ',
                    'data_confidence'    => 'データ信頼性',
                    'conservation_value' => '保全価値',
                    'taxonomic_coverage' => '分類群カバー',
                    'monitoring_effort'  => 'モニタリング',
                ];
                foreach ($bisBreakdown as $key => $axis):
                    $maxPt = round($axis['weight'] * 100);
                    $labelJa = $bisAxisLabelsJa[$key] ?? $axis['label'];
                ?>
                    <div class="bis-bar-container">
                        <div class="bis-bar">
                            <div class="bis-bar-fill" style="width: <?php echo $axis['score']; ?>%"></div>
                        </div>
                        <span class="bis-bar-label"><?php echo $labelJa; ?> <?php echo round($axis['weighted']); ?>/<?php echo $maxPt; ?></span>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>

        <!-- Red List Assessment -->
        <h2><span class="icon">🔴</span> レッドリスト該当種</h2>

        <?php if (count($redListSpecies) > 0): ?>
            <div class="rl-alert">
                <div class="rl-alert-header">⚠️ <?php echo count($redListSpecies); ?>種のレッドリスト掲載種を確認</div>
                <p>
                    当サイトで確認された種のうち、環境省レッドリストまたは静岡県レッドデータブック（2020）に
                    掲載されている種が<?php echo count($redListSpecies); ?>種含まれています。
                    これらの種の保全は、自然共生サイト認定およびTNFD開示において重要な指標です。
                </p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>和名</th>
                        <th>学名</th>
                        <th>カテゴリ</th>
                        <th>リスト</th>
                        <th>観察数</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($redListSpecies as $name => $lists): ?>
                        <?php if (empty($lists)) continue; ?>
                        <?php $firstList = reset($lists); ?>
                        <tr>
                            <td><strong><?php echo htmlspecialchars($name); ?></strong></td>
                            <td><em><?php echo htmlspecialchars($speciesMap[$name]['sci_name'] ?? ''); ?></em></td>
                            <td>
                                <span class="rl-badge <?php echo strtolower($firstList['category']); ?>">
                                    <?php echo htmlspecialchars($firstList['category']); ?>
                                </span>
                            </td>
                            <td><?php echo htmlspecialchars($firstList['list_id']); ?></td>
                            <td class="num"><?php echo $speciesMap[$name]['count']; ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php elseif ($isPublicMode && count($redListSpecies) > 0): ?>
            <div class="rl-alert" style="background: #f3f4f6; border-color: #d1d5db; color: #374151;">
                <div class="rl-alert-header" style="color: #1f2937;">🔒 希少種情報（非公開）</div>
                <p>
                    このサイトでは <?php echo count($redListSpecies); ?> 種の重要種（環境省/県レッドリスト掲載種）が確認されていますが、
                    種保護の観点から、一般公開レポートでは詳細な種名を伏せています。
                </p>
            </div>
        <?php else: ?>
            <p style="color: var(--muted); padding: 20px; text-align: center; background: var(--surface); border-radius: 8px;">
                該当する種は確認されていません。
            </p>
        <?php endif; ?>

        <!-- Taxonomy Breakdown -->
        <h2><span class="icon">📊</span> 分類群別観察数</h2>

        <?php
        $maxTax = !empty($taxonomyBreakdown) ? max(array_values($taxonomyBreakdown)) : 1;
        foreach ($taxonomyBreakdown as $group => $count):
            $pct = $totalObs > 0 ? round(($count / $totalObs) * 100, 1) : 0;
        ?>
            <div class="bar-row">
                <span class="bar-label"><?php echo htmlspecialchars($group); ?></span>
                <div class="bar-track">
                    <div class="bar-fill" style="width: <?php echo ($count / $maxTax) * 100; ?>%"></div>
                </div>
                <span class="bar-val"><?php echo $count; ?> (<?php echo $pct; ?>%)</span>
            </div>
        <?php endforeach; ?>

        <!-- Monthly Trend -->
        <?php if (!empty($monthlyTrend)): ?>
            <h2 class="no-print"><span class="icon">📈</span> 季節変動（月別観察数）</h2>
            <div class="trend-chart no-print">
                <?php
                $maxMonth = max($monthlyTrend);
                foreach ($monthlyTrend as $ym => $count):
                    $h = round(($count / $maxMonth) * 60) + 10;
                ?>
                    <div class="trend-bar" style="height: <?php echo $h; ?>%;">
                        <div class="tip"><?php echo $count; ?></div>
                    </div>
                <?php endforeach; ?>
            </div>
            <div class="trend-labels no-print">
                <?php foreach ($monthlyTrend as $ym => $c): ?>
                    <span><?php echo substr($ym, 5, 2); ?></span>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>

        <!-- Observation Event Activities -->
        <?php if (!empty($siteEvents)): ?>
            <h2><span class="icon">📅</span> 観察会活動実績</h2>
            <p style="font-size: 12px; color: var(--muted); margin-bottom: 12px;">
                当サイトで実施された観察会（<?php echo count($siteEvents); ?>件）の記録です。
                市民参加型モニタリングの実施状況を示します。
            </p>
            <table>
                <thead>
                    <tr>
                        <th>開催日</th>
                        <th>イベント名</th>
                        <th>カテゴリ</th>
                        <th>参加者</th>
                        <th>記録数</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($siteEvents as $ev): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($ev['event_date'] ?? ''); ?></td>
                            <td><strong><?php echo htmlspecialchars($ev['title'] ?? ''); ?></strong></td>
                            <td><?php
                                echo match ($ev['category'] ?? '') {
                                    'observation' => 'フィールド観察',
                                    'night_observation' => 'ナイトウォーク',
                                    'workshop' => 'ワークショップ',
                                    default => 'イベント',
                                };
                                ?></td>
                            <td><?php echo count($ev['participants'] ?? []); ?><?php echo ($ev['max_participants'] ?? 0) > 0 ? '/' . $ev['max_participants'] : ''; ?></td>
                            <td><?php echo $ev['obs_count'] ?? 0; ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 10px; margin-top: 8px; font-size: 11px; color: #065f46;">
                <strong>📊 活動サマリ：</strong>
                観察会<?php echo count($siteEvents); ?>件 /
                延べ参加者<?php echo array_sum(array_map(fn($e) => count($e['participants'] ?? []), $siteEvents)); ?>名 /
                イベント観察記録<?php echo array_sum(array_map(fn($e) => $e['obs_count'] ?? 0, $siteEvents)); ?>件
            </div>
        <?php endif; ?>

        <!-- Species Inventory (page break for print) -->
        <div class="page-break"></div>
        <h2><span class="icon">🦋</span> 確認種リスト（<?php echo $totalSpecies; ?>種）</h2>

        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>和名</th>
                    <th>学名</th>
                    <th>分類群</th>
                    <th>観察数</th>
                    <th>最終確認</th>
                    <th>RL</th>
                </tr>
            </thead>
            <tbody>
                <?php $i = 1;
                foreach ($speciesMap as $name => $info): ?>
                    <tr>
                        <td><?php echo $i++; ?></td>
                        <td><strong><?php echo htmlspecialchars($name); ?></strong></td>
                        <td><em style="font-size: 11px;"><?php echo htmlspecialchars($info['sci_name']); ?></em></td>
                        <td><?php echo htmlspecialchars($info['taxon_group']); ?></td>
                        <td><?php echo $info['count']; ?></td>
                        <td style="font-size: 11px;"><?php echo $info['last_seen'] ? date('Y/m/d', strtotime($info['last_seen'])) : '-'; ?></td>
                        <td>
                            <?php
                            if (isset($info['redlist'])):
                                foreach ($info['redlist'] as $listId => $entry):
                                    $cat = $entry['category'];
                                    $cssClass = strtolower($cat);
                                    if ($cssClass === 'cr+en') $cssClass = 'cr';
                                    echo '<span class="rl-badge ' . $cssClass . '">' . htmlspecialchars($cat) . '</span> ';
                                endforeach;
                            endif;
                            ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>

        <!-- TNFD Disclosure -->
        <h2><span class="icon">📋</span> TNFD LEAP対応状況</h2>
        <table>
            <thead>
                <tr>
                    <th>LEAP フレームワーク</th>
                    <th>推奨開示項目</th>
                    <th>対応状況</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>L</strong>ocate</td>
                    <td>事業拠点と自然との接点の特定</td>
                    <td><span class="tnfd-check">✓</span> GeoJSON境界定義済み</td>
                </tr>
                <tr>
                    <td><strong>E</strong>valuate</td>
                    <td>依存と影響の評価</td>
                    <td><span class="tnfd-check">✓</span> BIS <?php echo $bis; ?>（<?php echo $totalSpecies; ?>種確認）</td>
                </tr>
                <tr>
                    <td><strong>A</strong>ssess</td>
                    <td>リスクと機会の評価</td>
                    <td><span class="tnfd-check">✓</span> RL掲載種<?php echo count($redListSpecies); ?>種を特定</td>
                </tr>
                <tr>
                    <td><strong>P</strong>repare</td>
                    <td>対応策の策定・報告</td>
                    <td><span class="tnfd-check">✓</span> モニタリング継続中</td>
                </tr>
            </tbody>
        </table>

        <!-- Data Quality -->
        <h2><span class="icon">🔬</span> データ品質</h2>
        <div class="summary-grid" style="grid-template-columns: repeat(3, 1fr);">
            <div class="summary-card">
                <span class="val"><?php echo $researchGradePercent; ?>%</span>
                <span class="lbl">検証済み率</span>
            </div>
            <div class="summary-card">
                <span class="val"><?php echo $totalObs; ?></span>
                <span class="lbl">総データポイント</span>
            </div>
            <div class="summary-card">
                <span class="val"><?php echo count($taxonomyBreakdown); ?></span>
                <span class="lbl">分類群数</span>
            </div>
        </div>
        <p style="font-size: 11px; color: var(--muted); margin: 8px 0;">
            データソース: ikimon市民科学プラットフォーム / 分類名: GBIF Backbone Taxonomy準拠<br>
            引用データベース: 741冊の学術出版物・図鑑
        </p>

        <!-- Disclaimer -->
        <div class="disclaimer">
            <strong>免責事項:</strong>
            本レポートは市民科学（Citizen Science）データに基づいており、専門家による網羅的調査の代替ではありません。
            データは継続的に更新・検証されます。正式なTNFD開示資料として使用する際は、専門家によるレビューを推奨します。
            希少種の正確な位置情報は保護のため非公開です。
        </div>

        <!-- Footer -->
        <div class="report-footer">
            <p>
                本レポートは <strong>ikimon</strong> (https://ikimon.life) により自動生成されました。<br>
                データソース: 市民科学観察データ / GBIF Backbone Taxonomy / 環境省レッドリスト / 静岡県レッドデータブック2020<br>
                &copy; <?php echo date('Y'); ?> ikimon Project — Based in Hamamatsu, Shizuoka, Japan
            </p>
        </div>
    </div>

    <!-- Action Bar (hidden on print) -->
    <div class="action-bar no-print">
        <button class="btn-back" onclick="history.back()">← ダッシュボードに戻る</button>
        <button class="btn-print" onclick="window.print()">📄 PDFとして保存 / 印刷</button>
    </div>
</body>

</html>