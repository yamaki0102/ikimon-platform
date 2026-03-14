<?php

/**
 * 活動報告書テンプレート (Activity Report)
 *
 * 観察活動の実績を時系列でまとめた報告書。
 * 企業の環境保全活動の「やったこと・成果」を示す営業ツール。
 *
 * Usage: api/generate_activity_report.php?site_id=ikan_hq&start_date=2025-01-01&end_date=2025-12-31
 */

require_once __DIR__ . '/../../libs/ReportEngine.php';

$siteId = $_GET['site_id'] ?? null;
if (!$siteId) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'site_id is required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

try {
    $engine = new ReportEngine($siteId, [
        'start_date' => $_GET['start_date'] ?? null,
        'end_date'   => $_GET['end_date'] ?? null,
    ]);
    $d = $engine->compile();
} catch (\RuntimeException $e) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Derived metrics for activity report
$monthlyTrend = $d['monthlyTrend'];
$maxMonthly = !empty($monthlyTrend) ? max($monthlyTrend) : 1;
$events = $d['events'];
$totalParticipants = 0;
foreach ($events as $ev) {
    $totalParticipants += $ev['participant_count'] ?? 0;
}
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>活動報告書 - <?php echo htmlspecialchars($d['siteName']); ?></title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;700;900&display=swap');

        :root {
            --primary: #10b981;
            --primary-dark: #065f46;
            --bg: #ffffff;
            --text: #1a1a2e;
            --muted: #6b7280;
            --border: #e5e7eb;
            --surface: #f9fafb;
            --accent: #3b82f6;
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
            padding-bottom: 80px;
        }

        /* Header */
        .report-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid var(--accent);
            padding-bottom: 16px;
            margin-bottom: 24px;
        }

        .brand-logo {
            font-size: 22px;
            font-weight: 900;
            color: var(--primary);
        }

        .brand-sub {
            font-size: 10px;
            color: var(--muted);
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        .meta {
            text-align: right;
            font-size: 11px;
            color: var(--muted);
        }

        .meta strong {
            display: block;
            font-size: 12px;
            color: var(--text);
        }

        /* Title */
        .report-title {
            margin-bottom: 24px;
        }

        .report-title h1 {
            font-size: 24px;
            font-weight: 900;
        }

        .report-title .sub {
            font-size: 13px;
            color: var(--muted);
            margin-top: 4px;
        }

        .badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }

        .badge-blue {
            background: #eff6ff;
            color: #1d4ed8;
        }

        .badge-green {
            background: #ecfdf5;
            color: var(--primary-dark);
        }

        /* Section */
        h2 {
            font-size: 16px;
            font-weight: 700;
            color: var(--primary-dark);
            margin: 28px 0 12px;
            padding-bottom: 4px;
            border-bottom: 2px solid var(--primary);
        }

        h2 .icon {
            font-size: 18px;
        }

        /* KPI Grid */
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin: 16px 0;
        }

        .kpi-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 14px;
            text-align: center;
        }

        .kpi-card.highlight {
            background: var(--accent);
            color: white;
            border-color: var(--accent);
        }

        .kpi-card .val {
            font-size: 28px;
            font-weight: 900;
            display: block;
            line-height: 1.1;
        }

        .kpi-card .lbl {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 4px;
            opacity: 0.8;
        }

        /* Monthly Chart */
        .bar-chart {
            display: flex;
            align-items: flex-end;
            gap: 3px;
            height: 100px;
            margin: 16px 0;
            padding: 4px 0;
        }

        .bar-col {
            flex: 1;
            min-width: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
        }

        .bar-fill {
            width: 100%;
            background: var(--primary);
            border-radius: 2px 2px 0 0;
            min-height: 2px;
        }

        .bar-tip {
            font-size: 9px;
            font-weight: 700;
        }

        .bar-label {
            font-size: 8px;
            color: var(--muted);
        }

        /* Event Table */
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

        /* Summary Box */
        .summary-box {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
            margin: 16px 0;
        }

        .summary-box h3 {
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 8px;
        }

        .summary-box ul {
            margin-left: 18px;
            font-size: 12px;
        }

        .summary-box li {
            margin-bottom: 4px;
        }

        /* Taxonomy bars */
        .tax-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 4px 0;
        }

        .tax-label {
            width: 60px;
            font-size: 11px;
            text-align: right;
        }

        .tax-track {
            flex: 1;
            height: 16px;
            background: var(--surface);
            border-radius: 3px;
            overflow: hidden;
        }

        .tax-fill {
            height: 100%;
            background: var(--primary);
            border-radius: 3px;
            min-width: 2px;
        }

        .tax-val {
            font-size: 11px;
            font-weight: 700;
            min-width: 35px;
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
            background: var(--accent);
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
    <div class="container">
        <!-- Header -->
        <div class="report-header">
            <div>
                <div class="brand-logo">ikimon</div>
                <div class="brand-sub">Biodiversity Monitoring Platform</div>
            </div>
            <div class="meta">
                <strong>活動報告書</strong>
                作成日: <?php echo $d['reportDate']; ?><br>
                対象期間: <?php echo $d['reportPeriod']; ?>
            </div>
        </div>

        <!-- Title -->
        <div class="report-title">
            <h1><?php echo htmlspecialchars($d['siteName']); ?> — 活動報告書</h1>
            <?php if ($d['siteNameEn']): ?>
                <div class="sub"><?php echo htmlspecialchars($d['siteNameEn']); ?> — Activity Report</div>
            <?php endif; ?>
            <div style="margin-top: 8px;">
                <span class="badge badge-blue">📊 活動報告書</span>
                <span class="badge badge-green">✓ TNFD LEAP対応</span>
            </div>
        </div>

        <!-- KPI Cards -->
        <div class="kpi-grid">
            <div class="kpi-card highlight">
                <span class="val"><?php echo $d['totalObs']; ?></span>
                <span class="lbl">総観察数</span>
            </div>
            <div class="kpi-card">
                <span class="val"><?php echo $d['totalSpecies']; ?></span>
                <span class="lbl">確認種数</span>
            </div>
            <div class="kpi-card">
                <span class="val"><?php echo count($events); ?></span>
                <span class="lbl">実施イベント</span>
            </div>
            <div class="kpi-card">
                <span class="val"><?php echo $d['totalObservers']; ?></span>
                <span class="lbl">参加者（ユニーク）</span>
            </div>
        </div>

        <!-- Monthly Trend -->
        <h2><span class="icon">📈</span> 月別観察推移</h2>
        <?php if (!empty($monthlyTrend)): ?>
            <div class="bar-chart">
                <?php foreach ($monthlyTrend as $ym => $count): ?>
                    <div class="bar-col">
                        <div class="bar-tip"><?php echo $count; ?></div>
                        <div class="bar-fill" style="height: <?php echo round(($count / $maxMonthly) * 80); ?>px;"></div>
                        <div class="bar-label"><?php echo substr($ym, 5); ?>月</div>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php else: ?>
            <p style="color: var(--muted); font-size: 12px;">対象期間にデータがありません</p>
        <?php endif; ?>

        <!-- Taxonomy Breakdown -->
        <h2><span class="icon">🔬</span> 分類群別内訳</h2>
        <?php
        $maxTax = !empty($d['taxonomyBreakdown']) ? max($d['taxonomyBreakdown']) : 1;
        foreach ($d['taxonomyBreakdown'] as $group => $count):
            $pct = $d['totalObs'] > 0 ? round(($count / $d['totalObs']) * 100, 1) : 0;
        ?>
            <div class="tax-row">
                <div class="tax-label"><?php echo $group; ?></div>
                <div class="tax-track">
                    <div class="tax-fill" style="width: <?php echo round(($count / $maxTax) * 100); ?>%;"></div>
                </div>
                <div class="tax-val"><?php echo $count; ?> (<?php echo $pct; ?>%)</div>
            </div>
        <?php endforeach; ?>

        <!-- Events -->
        <?php if (!empty($events)): ?>
            <h2><span class="icon">📅</span> 観察会・イベント実施記録</h2>
            <table>
                <thead>
                    <tr>
                        <th>日付</th>
                        <th>イベント名</th>
                        <th>観察数</th>
                        <th>確認種数</th>
                        <th>参加者</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($events as $ev): ?>
                        <tr>
                            <td><?php echo htmlspecialchars($ev['event_date'] ?? '—'); ?></td>
                            <td><?php echo htmlspecialchars($ev['title'] ?? $ev['name'] ?? '—'); ?></td>
                            <td><?php echo $ev['obs_count'] ?? 0; ?></td>
                            <td><?php echo $ev['species_count'] ?? 0; ?></td>
                            <td><?php echo $ev['participant_count'] ?? '—'; ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>

        <!-- Activity Summary -->
        <h2><span class="icon">📝</span> 活動サマリー</h2>
        <div class="summary-box">
            <h3>期間中の成果</h3>
            <ul>
                <li>延べ <strong><?php echo $d['totalObs']; ?>件</strong> の生物観察データを収集</li>
                <li><strong><?php echo $d['totalSpecies']; ?>種</strong> の生物を確認（うちレッドリスト掲載種 <strong><?php echo count($d['redListSpecies']); ?>種</strong>）</li>
            <li>参考インデックス: <strong><?php echo $d['monitoringReferenceIndex']; ?></strong> / 100（観測の厚みと保全シグナルの要約）</li>
                <li>研究利用可以上率: <strong><?php echo $d['researchGradePercent']; ?>%</strong>（コミュニティ検証済み）</li>
                <?php if (!empty($events)): ?>
                    <li>観察会・イベント <strong><?php echo count($events); ?>回</strong> 実施</li>
                <?php endif; ?>
            </ul>
        </div>

        <!-- Reference index -->
        <h2><span class="icon">🎯</span> モニタリング参考インデックス</h2>
        <div style="background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%); color: white; border-radius: 10px; padding: 20px 24px; display: flex; align-items: center; gap: 20px;">
                        <div style="font-size: 52px; font-weight: 900; min-width: 80px; text-align: center;"><?php echo $d['monitoringReferenceIndex']; ?></div>
            <div>
                <div style="font-size: 14px; font-weight: 700; margin-bottom: 6px;">Observation-based Monitoring Reference Index</div>
                <div style="font-size: 11px; opacity: 0.9;">種の多様性、データ信頼性、保全シグナル、分類群カバー、モニタリング継続性を束ねた参考値です。認証可否や法令適合を単独で示すものではありません。</div>
                <?php
                $referenceIndexAxisLabelsJa = [
                    'richness'           => '種の豊富さ',
                    'data_confidence'    => 'データ信頼性',
                    'conservation_value' => '保全価値',
                    'taxonomic_coverage' => '分類群カバー',
                    'monitoring_effort'  => 'モニタリング',
                ];
                    foreach ($d['monitoringReferenceBreakdown'] as $key => $axis):
                        $labelJa = $referenceIndexAxisLabelsJa[$key] ?? $axis['label'];
                    $maxPt = round($axis['weight'] * 100);
                ?>
                    <div style="display: flex; gap: 4px; align-items: center; margin-top: 4px;">
                        <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.2); border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; width: <?php echo $axis['score']; ?>%; background: white; border-radius: 3px;"></div>
                        </div>
                        <span style="font-size: 9px; opacity: 0.7; min-width: 60px;"><?php echo $labelJa; ?> <?php echo round($axis['weighted']); ?>/<?php echo $maxPt; ?></span>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>

        <!-- Data Utilization -->
        <h2><span class="icon">💼</span> データ活用ガイド</h2>
        <div class="summary-box">
            <h3>本データの活用先</h3>
            <ul>
                <li>🏢 CSR・サステナビリティ報告書の添付資料として</li>
                <li>📊 TNFD（自然関連財務情報開示）の入力資料として</li>
                <li>📋 各種助成制度の活動報告・成果資料として</li>
                <li>👥 社内報告・株主向け報告の定量エビデンスとして</li>
                <li>🌱 環境教育プログラムの成果レポートとして</li>
            </ul>
        </div>

        <!-- Disclaimer -->
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 12px; margin: 20px 0; font-size: 11px; color: #92400e;">
            <strong>免責事項:</strong>
            本レポートは市民科学（Citizen Science）データに基づく活動報告であり、専門家による網羅的調査とは異なります。
            データは継続的に更新・検証されており、レポート作成時点での状況を反映しています。
            開示や重要判断では、専門家レビューや現地確認と併用してください。
        </div>

        <!-- Footer -->
        <div class="report-footer">
            <p>
                本レポートは ikimon (https://ikimon.life) により自動生成されました。<br>
                データソース: 市民科学観察データ / GBIF Backbone Taxonomy<br>
                &copy; <?php echo date('Y'); ?> ikimon Project. Based in Hamamatsu, Japan.
            </p>
        </div>
    </div>

    <!-- Action Bar -->
    <div class="action-bar no-print">
        <button class="btn-back" onclick="history.back()">← 戻る</button>
        <button class="btn-print" onclick="window.print()">🖨 PDF保存 / 印刷</button>
    </div>
</body>

</html>
