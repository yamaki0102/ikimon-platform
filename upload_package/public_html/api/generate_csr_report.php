<?php

/**
 * CSR/サステナビリティレポートテンプレート
 *
 * BISスコア推移、SDGsマッピング、環境パフォーマンスを
 * CSR/ESG報告書に添付可能なフォーマットで出力。
 *
 * Usage: api/generate_csr_report.php?site_id=aikan_hq&start_date=2025-01-01&end_date=2025-12-31
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

// SDGs mapping
$sdgsMappings = [
    ['number' => 15, 'title' => '陸の豊かさも守ろう', 'icon' => '🌿', 'desc' => '生物多様性モニタリングによる陸域生態系の保全実績'],
    ['number' => 14, 'title' => '海の豊かさを守ろう', 'icon' => '🐟', 'desc' => '水域を含む包括的な生態系把握'],
    ['number' => 13, 'title' => '気候変動に具体的な対策を', 'icon' => '🌍', 'desc' => '気候変動の影響指標としての生物相モニタリング'],
    ['number' => 4, 'title' => '質の高い教育をみんなに', 'icon' => '📚', 'desc' => '環境教育プログラムとしての観察会実施'],
    ['number' => 17, 'title' => 'パートナーシップで目標を達成しよう', 'icon' => '🤝', 'desc' => '市民科学データの共有と地域連携'],
];
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>サステナビリティレポート - <?php echo htmlspecialchars($d['siteName']); ?></title>
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
            --csr-accent: #059669;
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

        .report-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid var(--csr-accent);
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

        h2 {
            font-size: 16px;
            font-weight: 700;
            color: var(--primary-dark);
            margin: 28px 0 12px;
            padding-bottom: 4px;
            border-bottom: 2px solid var(--primary);
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
            background: var(--csr-accent);
            color: white;
            border-color: var(--csr-accent);
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

        /* SDGs */
        .sdg-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin: 16px 0;
        }

        .sdg-card {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 14px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
        }

        .sdg-icon {
            font-size: 28px;
        }

        .sdg-info h3 {
            font-size: 12px;
            font-weight: 700;
            line-height: 1.3;
        }

        .sdg-info .num {
            font-size: 10px;
            color: var(--csr-accent);
            font-weight: 700;
        }

        .sdg-info p {
            font-size: 11px;
            color: var(--muted);
            margin-top: 2px;
        }

        /* TNFD Table */
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

        .check {
            color: var(--primary);
            font-weight: 700;
        }

        /* Environment Metrics */
        .env-metric {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            margin: 8px 0;
            background: var(--surface);
            border-radius: 8px;
            border-left: 4px solid var(--csr-accent);
        }

        .env-metric .metric-icon {
            font-size: 20px;
        }

        .env-metric .metric-label {
            font-size: 12px;
            color: var(--muted);
        }

        .env-metric .metric-value {
            font-size: 20px;
            font-weight: 900;
        }

        .disclaimer {
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 6px;
            padding: 12px;
            margin: 20px 0;
            font-size: 11px;
            color: #92400e;
        }

        .report-footer {
            margin-top: 40px;
            padding-top: 16px;
            border-top: 1px solid var(--border);
            font-size: 10px;
            color: var(--muted);
            text-align: center;
        }

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
            background: var(--csr-accent);
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
                <strong>サステナビリティレポート</strong>
                作成日: <?php echo $d['reportDate']; ?><br>
                対象期間: <?php echo $d['reportPeriod']; ?>
            </div>
        </div>

        <!-- Title -->
        <div class="report-title">
            <h1><?php echo htmlspecialchars($d['siteName']); ?></h1>
            <div class="sub">環境パフォーマンス — サステナビリティ報告</div>
        </div>

        <!-- Environmental KPIs -->
        <h2>🌱 環境パフォーマンス指標</h2>
        <div class="kpi-grid">
            <div class="kpi-card highlight">
                <span class="val"><?php echo $d['bis']; ?></span>
                <span class="lbl">BIS スコア</span>
            </div>
            <div class="kpi-card">
                <span class="val"><?php echo $d['totalSpecies']; ?></span>
                <span class="lbl">確認種数</span>
            </div>
            <div class="kpi-card">
                <span class="val"><?php echo count($d['redListSpecies']); ?></span>
                <span class="lbl">希少種確認</span>
            </div>
            <div class="kpi-card">
                <span class="val"><?php echo count($d['taxonomyBreakdown']); ?></span>
                <span class="lbl">分類群数</span>
            </div>
        </div>

        <!-- Key Metrics -->
        <div class="env-metric">
            <span class="metric-icon">📊</span>
            <div>
                <div class="metric-label">データ信頼性（Research Grade率）</div>
                <div class="metric-value"><?php echo $d['researchGradePercent']; ?>%</div>
            </div>
        </div>
        <div class="env-metric">
            <span class="metric-icon">👥</span>
            <div>
                <div class="metric-label">市民科学参加者数（ユニーク）</div>
                <div class="metric-value"><?php echo $d['totalObservers']; ?>名</div>
            </div>
        </div>
        <div class="env-metric">
            <span class="metric-icon">📷</span>
            <div>
                <div class="metric-label">総観察データ件数</div>
                <div class="metric-value"><?php echo number_format($d['totalObs']); ?>件</div>
            </div>
        </div>

        <!-- SDGs Mapping -->
        <h2>🎯 SDGs貢献マッピング</h2>
        <div class="sdg-grid">
            <?php foreach ($sdgsMappings as $sdg): ?>
                <div class="sdg-card">
                    <div class="sdg-icon"><?php echo $sdg['icon']; ?></div>
                    <div class="sdg-info">
                        <div class="num">SDG <?php echo $sdg['number']; ?></div>
                        <h3><?php echo $sdg['title']; ?></h3>
                        <p><?php echo $sdg['desc']; ?></p>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>

        <!-- TNFD Alignment -->
        <h2>📋 TNFD開示対応状況</h2>
        <table>
            <thead>
                <tr>
                    <th>LEAP フェーズ</th>
                    <th>対応項目</th>
                    <th>状況</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>L — Locate</td>
                    <td>事業拠点と自然の接点の特定</td>
                    <td class="check">✓ GIS境界データで位置特定済み</td>
                </tr>
                <tr>
                    <td>E — Evaluate</td>
                    <td>依存・影響の評価</td>
                    <td class="check">✓ BISスコアで定量評価</td>
                </tr>
                <tr>
                    <td>A — Assess</td>
                    <td>リスクと機会の評価</td>
                    <td class="check">✓ レッドリスト照合で保全リスク評価</td>
                </tr>
                <tr>
                    <td>P — Prepare</td>
                    <td>対応策の策定・報告</td>
                    <td class="check">✓ モニタリング継続・データ蓄積中</td>
                </tr>
            </tbody>
        </table>

        <!-- Red List Species -->
        <?php if (count($d['redListSpecies']) > 0): ?>
            <h2>🔴 保全上重要な種</h2>
            <table>
                <thead>
                    <tr>
                        <th>種名</th>
                        <th>分類群</th>
                        <th>掲載カテゴリ</th>
                        <th>確認回数</th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                    foreach ($d['speciesMap'] as $name => $sp):
                        if (empty($sp['redlist'])) continue;
                        $cats = [];
                        foreach ($sp['redlist'] as $rl) {
                            $cats[] = $rl['category'] ?? '—';
                        }
                    ?>
                        <tr>
                            <td>
                                <strong><?php echo htmlspecialchars($name); ?></strong>
                                <?php if ($sp['sci_name']): ?>
                                    <br><em style="font-size: 10px; color: var(--muted);"><?php echo htmlspecialchars($sp['sci_name']); ?></em>
                                <?php endif; ?>
                            </td>
                            <td><?php echo $sp['taxon_group']; ?></td>
                            <td><?php echo implode(', ', $cats); ?></td>
                            <td><?php echo $sp['count']; ?>回</td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>

        <!-- Disclaimer -->
        <div class="disclaimer">
            <strong>免責事項:</strong>
            本レポートは市民科学（Citizen Science）データに基づくサステナビリティ報告資料であり、
            専門家による網羅的調査とは異なります。CSR/ESG報告書等への引用時は、
            データの性質と限界を明記してください。
        </div>

        <!-- Footer -->
        <div class="report-footer">
            <p>
                本レポートは ikimon (https://ikimon.life) により自動生成されました。<br>
                データソース: 市民科学観察データ / GBIF Backbone Taxonomy / 環境省レッドリスト<br>
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