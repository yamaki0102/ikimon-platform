<?php

/**
 * generate_report.php — 企業向け生物多様性レポート生成 API
 * 
 * Nature Positive Improvement: P0 Feature
 * 
 * 特定のサイト(企業敷地)に紐づく観察データを集約し、
 * HTML形式のレポートを生成する。PDF変換はクライアント側で window.print() を利用。
 * 
 * GET Parameters:
 *   site_id    (str)  : Corporate site ID (required)
 *   from       (str)  : Start date YYYY-MM-DD (optional, default: 1 year ago)
 *   to         (str)  : End date YYYY-MM-DD (optional, default: today)
 *   format     (str)  : 'html' (default) or 'json'
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/CorporateSites.php';
require_once __DIR__ . '/../../libs/RedList.php';
require_once __DIR__ . '/../../libs/Invasive.php';
require_once __DIR__ . '/../../libs/DataQuality.php';

Auth::init();
$currentUser = Auth::user();

// Validate site_id
$siteId = $_GET['site_id'] ?? '';
if (!$siteId) {
    http_response_code(400);
    echo json_encode(['error' => true, 'message' => 'site_id is required'], JSON_UNESCAPED_UNICODE);
    exit;
}

$site = CorporateSites::get($siteId);
if (!$site) {
    http_response_code(404);
    echo json_encode(['error' => true, 'message' => 'Site not found'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Date range
$from = $_GET['from'] ?? date('Y-m-d', strtotime('-1 year'));
$to = $_GET['to'] ?? date('Y-m-d');
$format = $_GET['format'] ?? 'html';

// Fetch observations in site
$allObs = DataStore::fetchAll('observations');
$siteObs = array_filter($allObs, function ($obs) use ($siteId, $from, $to) {
    if (($obs['site_id'] ?? '') !== $siteId) return false;
    $date = $obs['observed_at'] ?? '';
    if ($date && ($date < $from || $date > $to . ' 23:59:59')) return false;
    return true;
});

// === Aggregate Data ===

// Species list (unique by taxon slug/name)
$speciesMap = [];
$redListSpecies = [];
$invasiveSpecies = [];
$monthlySpecies = [];
$observers = [];
$gradeDistribution = ['A' => 0, 'B' => 0, 'C' => 0, 'D' => 0];

foreach ($siteObs as $obs) {
    $taxon = $obs['taxon'] ?? null;
    if (!$taxon || empty($taxon['name'])) continue;

    $key = $taxon['slug'] ?? $taxon['name'];
    $sciName = $taxon['scientific_name'] ?? '';
    $date = $obs['observed_at'] ?? '';
    $month = $date ? date('Y-m', strtotime($date)) : 'unknown';

    // Species list
    if (!isset($speciesMap[$key])) {
        $speciesMap[$key] = [
            'name' => $taxon['name'],
            'scientific_name' => $sciName,
            'rank' => $taxon['rank'] ?? 'species',
            'first_seen' => $date,
            'last_seen' => $date,
            'count' => 0,
            'has_photo' => false,
            'lineage' => $taxon['lineage'] ?? [],
            'redlist' => null,
            'invasive' => false,
        ];

        // Red List check
        $taxonKey = $taxon['key'] ?? $taxon['id'] ?? null;
        if ($taxonKey) {
            $rl = RedList::check($taxonKey);
            if ($rl) {
                $speciesMap[$key]['redlist'] = $rl['category'];
                // Only count truly threatened species as "Red List" (not LC/DD/NE)
                $threatenedCategories = ['CR', 'EN', 'VU', 'NT'];
                if (in_array($rl['category'], $threatenedCategories)) {
                    $redListSpecies[] = ['name' => $taxon['name'], 'sci' => $sciName, 'category' => $rl['category']];
                }
            }
        }

        // Invasive check
        if (Invasive::check($taxon['name'], $sciName)) {
            $speciesMap[$key]['invasive'] = true;
            $invasiveSpecies[] = ['name' => $taxon['name'], 'sci' => $sciName];
        }
    }

    $speciesMap[$key]['count']++;
    if ($date && $date > $speciesMap[$key]['last_seen']) $speciesMap[$key]['last_seen'] = $date;
    if ($date && $date < $speciesMap[$key]['first_seen']) $speciesMap[$key]['first_seen'] = $date;
    if (!empty($obs['photos'])) $speciesMap[$key]['has_photo'] = true;

    // Monthly tracking
    if (!isset($monthlySpecies[$month])) $monthlySpecies[$month] = [];
    $monthlySpecies[$month][$key] = true;

    // Observers
    $userId = $obs['user_id'] ?? '';
    $userName = $obs['user_name'] ?? 'Unknown';
    if ($userId && !isset($observers[$userId])) {
        $observers[$userId] = ['name' => $userName, 'count' => 0];
    }
    if ($userId) $observers[$userId]['count']++;

    // Grade distribution
    $grade = DataQuality::calculate($obs);
    $gradeDistribution[$grade] = ($gradeDistribution[$grade] ?? 0) + 1;
}

// Sort species by name
uasort($speciesMap, fn($a, $b) => strcmp($a['name'], $b['name']));

// Monthly species count
ksort($monthlySpecies);
$monthlyChart = [];
foreach ($monthlySpecies as $month => $species) {
    $monthlyChart[] = ['month' => $month, 'count' => count($species)];
}

// Summary stats
$totalObs = count($siteObs);
$totalSpecies = count($speciesMap);
$totalObservers = count($observers);
$totalRedList = count($redListSpecies);
$totalInvasive = count($invasiveSpecies);
$researchGradeCount = $gradeDistribution['A'] ?? 0;
$researchGradeRate = $totalObs > 0 ? round(($researchGradeCount / $totalObs) * 100, 1) : 0;

// Group species by class
$speciesByClass = [];
foreach ($speciesMap as $species) {
    $class = $species['lineage']['class'] ?? '分類不明';
    if (!isset($speciesByClass[$class])) $speciesByClass[$class] = [];
    $speciesByClass[$class][] = $species;
}
ksort($speciesByClass);

// === Output ===

if ($format === 'json') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'site' => $site,
        'period' => ['from' => $from, 'to' => $to],
        'summary' => [
            'total_observations' => $totalObs,
            'total_species' => $totalSpecies,
            'total_observers' => $totalObservers,
            'red_list_count' => $totalRedList,
            'invasive_count' => $totalInvasive,
            'research_grade_rate' => $researchGradeRate,
            'grade_distribution' => $gradeDistribution,
        ],
        'species' => array_values($speciesMap),
        'red_list_species' => $redListSpecies,
        'invasive_species' => $invasiveSpecies,
        'monthly_trend' => $monthlyChart,
        'observers' => array_values($observers),
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// HTML Report
$reportDate = date('Y年m月d日');
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($site['name']); ?> — 生物多様性レポート</title>
    <style>
        *,
        *::before,
        *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Noto Sans JP', 'Hiragino Sans', sans-serif;
            color: #1a1a2e;
            background: #fff;
            line-height: 1.6;
        }

        @media print {
            .no-print {
                display: none !important;
            }

            body {
                font-size: 10pt;
            }

            .page-break {
                page-break-before: always;
            }
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 2rem;
        }

        /* Header */
        .report-header {
            border-bottom: 3px solid #1a1a2e;
            padding-bottom: 1.5rem;
            margin-bottom: 2rem;
        }

        .report-header h1 {
            font-size: 1.8rem;
            font-weight: 900;
            letter-spacing: -0.02em;
        }

        .report-header .subtitle {
            color: #666;
            font-size: 0.85rem;
            margin-top: 0.5rem;
        }

        .report-header .meta {
            display: flex;
            gap: 2rem;
            margin-top: 1rem;
            font-size: 0.8rem;
            color: #888;
        }

        .report-header .meta span {
            display: flex;
            align-items: center;
            gap: 0.3rem;
        }

        /* KPI Cards */
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
            margin: 2rem 0;
        }

        .kpi-card {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 1.2rem;
            text-align: center;
            border: 1px solid #e9ecef;
        }

        .kpi-card .value {
            font-size: 2rem;
            font-weight: 900;
            color: #1a1a2e;
        }

        .kpi-card .label {
            font-size: 0.7rem;
            color: #888;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            margin-top: 0.3rem;
        }

        .kpi-card.danger {
            background: #fff5f5;
            border-color: #fec0c0;
        }

        .kpi-card.danger .value {
            color: #c0392b;
        }

        .kpi-card.warning {
            background: #fff8e1;
            border-color: #ffe082;
        }

        .kpi-card.warning .value {
            color: #e67e22;
        }

        .kpi-card.success {
            background: #f0fdf4;
            border-color: #86efac;
        }

        .kpi-card.success .value {
            color: #16a34a;
        }

        /* Section */
        .section {
            margin: 2.5rem 0;
        }

        .section h2 {
            font-size: 1.2rem;
            font-weight: 800;
            border-left: 4px solid #1a1a2e;
            padding-left: 0.8rem;
            margin-bottom: 1rem;
        }

        /* Table */
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
        }

        thead {
            background: #1a1a2e;
            color: #fff;
        }

        th {
            padding: 0.6rem 0.8rem;
            text-align: left;
            font-weight: 700;
            font-size: 0.7rem;
            letter-spacing: 0.05em;
            text-transform: uppercase;
        }

        td {
            padding: 0.5rem 0.8rem;
            border-bottom: 1px solid #eee;
        }

        tbody tr:hover {
            background: #f8f9fa;
        }

        .badge {
            display: inline-block;
            padding: 0.15rem 0.5rem;
            border-radius: 20px;
            font-size: 0.65rem;
            font-weight: 700;
        }

        .badge-red {
            background: #fee2e2;
            color: #dc2626;
        }

        .badge-orange {
            background: #ffedd5;
            color: #ea580c;
        }

        .badge-green {
            background: #dcfce7;
            color: #16a34a;
        }

        /* Chart placeholder */
        .chart-bar {
            display: flex;
            align-items: flex-end;
            gap: 4px;
            height: 120px;
            margin: 1rem 0;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid #ddd;
            position: relative;
        }

        .chart-bar .bar {
            flex: 1;
            background: linear-gradient(to top, #4f46e5, #818cf8);
            border-radius: 4px 4px 0 0;
            min-width: 20px;
            position: relative;
            transition: all 0.3s;
        }

        .chart-bar .bar:hover {
            opacity: 0.8;
        }

        .chart-bar .bar-label {
            position: absolute;
            bottom: -1.3rem;
            left: 50%;
            transform: translateX(-50%);
            font-size: 0.55rem;
            color: #888;
            white-space: nowrap;
        }

        .chart-bar .bar-value {
            position: absolute;
            top: -1.2rem;
            left: 50%;
            transform: translateX(-50%);
            font-size: 0.6rem;
            font-weight: 700;
            color: #4f46e5;
        }

        /* Grade bar */
        .grade-bar {
            display: flex;
            border-radius: 8px;
            overflow: hidden;
            height: 24px;
            margin: 0.5rem 0;
        }

        .grade-bar div {
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.6rem;
            font-weight: 700;
            color: #fff;
        }

        /* Footer */
        .report-footer {
            border-top: 2px solid #1a1a2e;
            padding-top: 1rem;
            margin-top: 3rem;
            font-size: 0.75rem;
            color: #888;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .report-footer .powered {
            font-weight: 700;
            color: #1a1a2e;
        }

        /* Print button */
        .print-btn {
            position: fixed;
            top: 1rem;
            right: 1rem;
            background: #1a1a2e;
            color: #fff;
            border: none;
            padding: 0.7rem 1.5rem;
            border-radius: 8px;
            font-weight: 700;
            cursor: pointer;
            font-size: 0.85rem;
            z-index: 100;
        }

        .print-btn:hover {
            background: #2d2d5e;
        }
    </style>
</head>

<body>
    <button class="print-btn no-print" onclick="window.print()">📄 PDF出力</button>

    <div class="container">
        <!-- Header -->
        <div class="report-header">
            <h1>🌿 <?php echo htmlspecialchars($site['name']); ?><br>生物多様性レポート</h1>
            <p class="subtitle"><?php echo htmlspecialchars($site['description'] ?? ''); ?></p>
            <div class="meta">
                <span>📅 対象期間: <?php echo $from; ?> 〜 <?php echo $to; ?></span>
                <span>🏢 管理者: <?php echo htmlspecialchars($site['owner'] ?? ''); ?></span>
                <span>📊 生成日: <?php echo $reportDate; ?></span>
            </div>
        </div>

        <!-- KPI Cards -->
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="value"><?php echo $totalSpecies; ?></div>
                <div class="label">確認種数</div>
            </div>
            <div class="kpi-card">
                <div class="value"><?php echo $totalObs; ?></div>
                <div class="label">観察記録数</div>
            </div>
            <div class="kpi-card success">
                <div class="value"><?php echo $researchGradeRate; ?>%</div>
                <div class="label">研究用グレード率</div>
            </div>
            <div class="kpi-card">
                <div class="value"><?php echo $totalObservers; ?></div>
                <div class="label">参加者数</div>
            </div>
        </div>

        <?php if ($totalRedList > 0 || $totalInvasive > 0): ?>
            <div class="kpi-grid" style="grid-template-columns: repeat(2, 1fr);">
                <?php if ($totalRedList > 0): ?>
                    <div class="kpi-card danger">
                        <div class="value"><?php echo $totalRedList; ?> 種</div>
                        <div class="label">🔴 レッドリスト掲載種</div>
                    </div>
                <?php endif; ?>
                <?php if ($totalInvasive > 0): ?>
                    <div class="kpi-card warning">
                        <div class="value"><?php echo $totalInvasive; ?> 種</div>
                        <div class="label">⚠️ 外来種</div>
                    </div>
                <?php endif; ?>
            </div>
        <?php endif; ?>

        <!-- Data Quality -->
        <div class="section">
            <h2>データ品質分布</h2>
            <div class="grade-bar">
                <?php
                $colors = ['A' => '#16a34a', 'B' => '#eab308', 'C' => '#f97316', 'D' => '#9ca3af'];
                $labels = ['A' => '研究用', 'B' => '要同定', 'C' => 'カジュアル', 'D' => '情報不足'];
                foreach ($gradeDistribution as $g => $count):
                    $pct = $totalObs > 0 ? ($count / $totalObs) * 100 : 0;
                    if ($pct < 1 && $count > 0) $pct = 1;
                ?>
                    <div style="width: <?php echo max(0, $pct); ?>%; background: <?php echo $colors[$g]; ?>;">
                        <?php if ($pct > 8): ?>
                            <?php echo $labels[$g]; ?> <?php echo $count; ?>
                        <?php endif; ?>
                    </div>
                <?php endforeach; ?>
            </div>
            <div style="display: flex; gap: 1.5rem; font-size: 0.7rem; color: #666; margin-top: 0.5rem;">
                <?php foreach ($gradeDistribution as $g => $count): ?>
                    <span style="display: flex; align-items: center; gap: 0.3rem;">
                        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: <?php echo $colors[$g]; ?>;"></span>
                        Grade <?php echo $g; ?> (<?php echo $labels[$g]; ?>): <?php echo $count; ?>件
                    </span>
                <?php endforeach; ?>
            </div>
        </div>

        <!-- Monthly Trend -->
        <?php if (!empty($monthlyChart)): ?>
            <div class="section">
                <h2>月別 確認種数の推移</h2>
                <div class="chart-bar">
                    <?php
                    $maxCount = max(array_column($monthlyChart, 'count'));
                    foreach ($monthlyChart as $m):
                        $height = $maxCount > 0 ? ($m['count'] / $maxCount) * 100 : 0;
                        $monthLabel = date('n月', strtotime($m['month'] . '-01'));
                    ?>
                        <div class="bar" style="height: <?php echo max(4, $height); ?>%;">
                            <span class="bar-value"><?php echo $m['count']; ?></span>
                            <span class="bar-label"><?php echo $monthLabel; ?></span>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        <?php endif; ?>

        <!-- Red List Species -->
        <?php if (!empty($redListSpecies)): ?>
            <div class="section">
                <h2>🔴 レッドリスト掲載種</h2>
                <table>
                    <thead>
                        <tr>
                            <th>和名</th>
                            <th>学名</th>
                            <th>カテゴリ</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($redListSpecies as $sp): ?>
                            <tr>
                                <td><strong><?php echo htmlspecialchars($sp['name']); ?></strong></td>
                                <td><em><?php echo htmlspecialchars($sp['sci']); ?></em></td>
                                <td><span class="badge badge-red"><?php echo htmlspecialchars($sp['category']); ?></span></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>

        <!-- Invasive Species -->
        <?php if (!empty($invasiveSpecies)): ?>
            <div class="section">
                <h2>⚠️ 確認された外来種</h2>
                <table>
                    <thead>
                        <tr>
                            <th>和名</th>
                            <th>学名</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($invasiveSpecies as $sp): ?>
                            <tr>
                                <td><strong><?php echo htmlspecialchars($sp['name']); ?></strong></td>
                                <td><em><?php echo htmlspecialchars($sp['sci']); ?></em></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>

        <!-- Full Species List -->
        <div class="section page-break">
            <h2>確認種一覧（<?php echo $totalSpecies; ?> 種）</h2>

            <?php foreach ($speciesByClass as $class => $speciesList): ?>
                <h3 style="font-size: 0.9rem; color: #4f46e5; margin: 1.5rem 0 0.5rem; font-weight: 700;"><?php echo htmlspecialchars($class); ?> (<?php echo count($speciesList); ?>種)</h3>
                <table>
                    <thead>
                        <tr>
                            <th>和名</th>
                            <th>学名</th>
                            <th>記録数</th>
                            <th>初確認</th>
                            <th>最終確認</th>
                            <th>写真</th>
                            <th>備考</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($speciesList as $sp): ?>
                            <tr>
                                <td><strong><?php echo htmlspecialchars($sp['name']); ?></strong></td>
                                <td><em style="font-size: 0.8rem; color: #666;"><?php echo htmlspecialchars($sp['scientific_name']); ?></em></td>
                                <td style="text-align: center;"><?php echo $sp['count']; ?></td>
                                <td style="font-size: 0.75rem;"><?php echo $sp['first_seen'] ? date('Y.m.d', strtotime($sp['first_seen'])) : '-'; ?></td>
                                <td style="font-size: 0.75rem;"><?php echo $sp['last_seen'] ? date('Y.m.d', strtotime($sp['last_seen'])) : '-'; ?></td>
                                <td style="text-align: center;"><?php echo $sp['has_photo'] ? '📷' : '—'; ?></td>
                                <td>
                                    <?php if ($sp['redlist']): ?>
                                        <span class="badge badge-red">RL: <?php echo htmlspecialchars($sp['redlist']); ?></span>
                                    <?php endif; ?>
                                    <?php if ($sp['invasive']): ?>
                                        <span class="badge badge-orange">外来種</span>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endforeach; ?>
        </div>

        <!-- Methodology -->
        <div class="section page-break">
            <h2>調査方法について</h2>
            <div style="font-size: 0.85rem; color: #555; line-height: 1.8;">
                <p>本レポートは、市民科学プラットフォーム <strong>ikimon.life</strong> に投稿された観察記録を基に自動生成されています。</p>
                <ul style="margin: 1rem 0 1rem 1.5rem;">
                    <li><strong>データ収集方法</strong>: 写真付き観察記録（スマートフォンGPS位置情報付き）</li>
                    <li><strong>同定方法</strong>: コミュニティによる相互検証（WE-Consensus アルゴリズム）</li>
                    <li><strong>品質基準</strong>: 2人以上の同意（同意率2/3以上）で「研究用グレード」に到達</li>
                    <li><strong>データ形式</strong>: Darwin Core Archive (DwC-A) 準拠、GBIF互換</li>
                    <li><strong>分類体系</strong>: GBIF Backbone Taxonomy に準拠</li>
                </ul>
                <p>本データはオープンデータとして <a href="https://ikimon.life" style="color: #4f46e5;">ikimon.life</a> にて公開されており、第三者による検証が可能です。</p>
            </div>
        </div>

        <!-- Footer -->
        <div class="report-footer">
            <div>
                <span class="powered">ikimon.life</span> — みんなで作る生き物マップ
                <br>
                <span style="font-size: 0.65rem;">DwC-A データは <a href="api/export_dwca.php?format=archive" style="color: #4f46e5;">こちら</a> からダウンロード可能</span>
            </div>
            <div style="text-align: right;">
                生成日時: <?php echo date('Y-m-d H:i:s'); ?><br>
                <span style="font-size: 0.65rem;">© <?php echo date('Y'); ?> ikimon.life</span>
            </div>
        </div>
    </div>
</body>

</html>