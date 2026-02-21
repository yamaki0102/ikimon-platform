<?php

/**
 * エグゼクティブサマリーテンプレート
 *
 * 1ページに収まるKPI要約。経営層向け。
 * A4 1枚で「この活動の成果」を伝える。
 *
 * Usage: api/generate_executive_summary.php?site_id=aikan_hq
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

// Top 5 species
$topSpecies = array_slice($d['speciesMap'], 0, 5, true);
$events = $d['events'];

// BIS rating label
$bisLabel = match (true) {
    $d['bis'] >= 75 => '優秀',
    $d['bis'] >= 50 => '良好',
    $d['bis'] >= 25 => '要改善',
    default => '要注意',
};
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>エグゼクティブサマリー - <?php echo htmlspecialchars($d['siteName']); ?></title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;700;900&display=swap');

        :root {
            --primary: #10b981;
            --primary-dark: #065f46;
            --text: #1a1a2e;
            --muted: #6b7280;
            --border: #e5e7eb;
            --surface: #f9fafb;
            --exec: #1e40af;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Noto Sans JP', 'Hiragino Sans', sans-serif;
            background: white;
            color: var(--text);
            font-size: 12px;
            line-height: 1.6;
        }

        .page {
            max-width: 800px;
            margin: 0 auto;
            padding: 32px 40px;
            /* A4 portrait target */
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }

        /* Header — compact */
        .exec-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid var(--exec);
            padding-bottom: 10px;
            margin-bottom: 16px;
        }

        .exec-header .logo {
            font-size: 18px;
            font-weight: 900;
            color: var(--primary);
        }

        .exec-header .meta {
            text-align: right;
            font-size: 10px;
            color: var(--muted);
        }

        .exec-header .meta strong {
            font-size: 11px;
            color: var(--exec);
        }

        /* Title Block */
        .exec-title {
            background: linear-gradient(135deg, var(--exec) 0%, #3b82f6 100%);
            color: white;
            border-radius: 8px;
            padding: 16px 20px;
            margin-bottom: 16px;
        }

        .exec-title h1 {
            font-size: 20px;
            font-weight: 900;
            margin-bottom: 2px;
        }

        .exec-title .subtitle {
            font-size: 11px;
            opacity: 0.9;
        }

        /* KPI Strip */
        .kpi-strip {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 8px;
            margin-bottom: 16px;
        }

        .kpi-mini {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 10px 8px;
            text-align: center;
        }

        .kpi-mini.bis {
            background: var(--primary);
            color: white;
            border-color: var(--primary);
        }

        .kpi-mini .val {
            font-size: 22px;
            font-weight: 900;
            display: block;
            line-height: 1;
        }

        .kpi-mini .lbl {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 2px;
            opacity: 0.8;
        }

        /* Two Column Layout */
        .two-col {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 16px;
        }

        .col-box {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 12px;
        }

        .col-box h3 {
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 8px;
            color: var(--exec);
        }

        /* Species list compact */
        .sp-row {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            padding: 3px 0;
            border-bottom: 1px solid var(--border);
        }

        .sp-row:last-child {
            border-bottom: none;
        }

        .sp-name {
            font-weight: 700;
        }

        .sp-count {
            color: var(--muted);
        }

        /* BIS Breakdown mini */
        .bis-mini-row {
            display: flex;
            align-items: center;
            gap: 6px;
            margin: 3px 0;
        }

        .bis-mini-bar {
            flex: 1;
            height: 5px;
            background: #e5e7eb;
            border-radius: 3px;
            overflow: hidden;
        }

        .bis-mini-fill {
            height: 100%;
            background: var(--primary);
            border-radius: 3px;
        }

        .bis-mini-label {
            font-size: 9px;
            color: var(--muted);
            min-width: 55px;
        }

        .bis-mini-val {
            font-size: 9px;
            font-weight: 700;
            min-width: 25px;
            text-align: right;
        }

        /* Taxonomy compact */
        .tax-compact {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }

        .tax-tag {
            background: white;
            border: 1px solid var(--border);
            border-radius: 4px;
            padding: 2px 8px;
            font-size: 10px;
        }

        .tax-tag strong {
            color: var(--primary);
        }

        /* Signoff */
        .signoff {
            margin-top: auto;
            padding-top: 12px;
            border-top: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: var(--muted);
        }

        @media print {
            body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }

            .page {
                padding: 20px 24px;
                min-height: auto;
            }

            .no-print {
                display: none !important;
            }
        }

        .action-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: white;
            border-top: 1px solid var(--border);
            padding: 10px 24px;
            display: flex;
            justify-content: center;
            gap: 12px;
            z-index: 100;
        }

        .action-bar button {
            padding: 8px 24px;
            font-size: 13px;
            font-weight: 700;
            border-radius: 6px;
            cursor: pointer;
            border: none;
        }

        .btn-print {
            background: var(--exec);
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
    <div class="page">
        <!-- Header -->
        <div class="exec-header">
            <div class="logo">ikimon</div>
            <div class="meta">
                <strong>EXECUTIVE SUMMARY</strong><br>
                <?php echo $d['reportDate']; ?> | <?php echo $d['reportPeriod']; ?>
            </div>
        </div>

        <!-- Title -->
        <div class="exec-title">
            <h1><?php echo htmlspecialchars($d['siteName']); ?></h1>
            <div class="subtitle">生物多様性モニタリング — エグゼクティブサマリー</div>
        </div>

        <!-- KPI Strip -->
        <div class="kpi-strip">
            <div class="kpi-mini bis">
                <span class="val"><?php echo $d['bis']; ?></span>
                <span class="lbl">BIS (<?php echo $bisLabel; ?>)</span>
            </div>
            <div class="kpi-mini">
                <span class="val"><?php echo $d['totalSpecies']; ?></span>
                <span class="lbl">確認種数</span>
            </div>
            <div class="kpi-mini">
                <span class="val"><?php echo $d['totalObs']; ?></span>
                <span class="lbl">観察データ</span>
            </div>
            <div class="kpi-mini">
                <span class="val"><?php echo count($d['redListSpecies']); ?></span>
                <span class="lbl">希少種</span>
            </div>
            <div class="kpi-mini">
                <span class="val"><?php echo $d['researchGradePercent']; ?>%</span>
                <span class="lbl">検証済み率</span>
            </div>
        </div>

        <!-- Two Column -->
        <div class="two-col">
            <!-- Left: BIS Breakdown -->
            <div class="col-box">
                <h3>🎯 BISスコア内訳</h3>
                <?php
                $bisAxisLabelsJa = [
                    'richness'           => '種の豊富さ',
                    'data_confidence'    => 'データ信頼性',
                    'conservation_value' => '保全価値',
                    'taxonomic_coverage' => '分類群カバー',
                    'monitoring_effort'  => 'モニタリング',
                ];
                foreach ($d['bisBreakdown'] as $key => $axis):
                    $labelJa = $bisAxisLabelsJa[$key] ?? $axis['label'];
                    $maxPt = round($axis['weight'] * 100);
                ?>
                    <div class="bis-mini-row">
                        <div class="bis-mini-label"><?php echo $labelJa; ?></div>
                        <div class="bis-mini-bar">
                            <div class="bis-mini-fill" style="width: <?php echo $axis['score']; ?>%;"></div>
                        </div>
                        <div class="bis-mini-val"><?php echo round($axis['weighted']); ?>/<?php echo $maxPt; ?></div>
                    </div>
                <?php endforeach; ?>
            </div>

            <!-- Right: Top Species -->
            <div class="col-box">
                <h3>🔬 主要確認種 TOP 5</h3>
                <?php foreach ($topSpecies as $name => $sp): ?>
                    <div class="sp-row">
                        <span class="sp-name">
                            <?php echo htmlspecialchars($name); ?>
                            <?php if (!empty($sp['redlist'])): ?>
                                <span style="color: #dc2626; font-size: 9px;">🔴 RL</span>
                            <?php endif; ?>
                        </span>
                        <span class="sp-count"><?php echo $sp['count']; ?>回</span>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>

        <!-- Second Row -->
        <div class="two-col">
            <!-- Taxonomy Tags -->
            <div class="col-box">
                <h3>🌿 確認分類群</h3>
                <div class="tax-compact">
                    <?php foreach ($d['taxonomyBreakdown'] as $group => $count): ?>
                        <span class="tax-tag"><strong><?php echo $count; ?></strong> <?php echo $group; ?></span>
                    <?php endforeach; ?>
                </div>
            </div>

            <!-- Compliance -->
            <div class="col-box">
                <h3>📋 準拠フレームワーク</h3>
                <div style="font-size: 11px;">
                    <div style="margin: 3px 0;">✅ TNFD LEAP — 全4フェーズ対応</div>
                    <div style="margin: 3px 0;">✅ 30by30 — モニタリングデータ蓄積</div>
                    <div style="margin: 3px 0;">✅ Darwin Core — 国際標準データ形式</div>
                    <div style="margin: 3px 0;">✅ SDGs 4, 13, 14, 15, 17 — 貢献項目</div>
                </div>
            </div>
        </div>

        <!-- Events Summary -->
        <?php if (!empty($events)): ?>
            <div class="col-box" style="margin-bottom: 16px;">
                <h3>📅 イベント実績サマリー</h3>
                <div style="font-size: 11px;">
                    実施回数: <strong><?php echo count($events); ?>回</strong>
                    <?php
                    $totalEvObs = array_sum(array_column($events, 'obs_count'));
                    $totalEvSp = array_sum(array_column($events, 'species_count'));
                    ?>
                    | 総観察数: <strong><?php echo $totalEvObs; ?>件</strong>
                    | 確認種数: <strong><?php echo $totalEvSp; ?>種</strong>
                </div>
            </div>
        <?php endif; ?>

        <!-- Signoff -->
        <div class="signoff">
            <div>
                Generated by <strong>ikimon</strong> (https://ikimon.life)<br>
                Data: Citizen Science / GBIF Backbone Taxonomy
            </div>
            <div style="text-align: right;">
                &copy; <?php echo date('Y'); ?> ikimon Project<br>
                Based in Hamamatsu, Japan
            </div>
        </div>
    </div>

    <!-- Action Bar -->
    <div class="action-bar no-print">
        <button class="btn-back" onclick="history.back()">← 戻る</button>
        <button class="btn-print" onclick="window.print()">🖨 PDF保存 / 印刷</button>
    </div>
</body>

</html>