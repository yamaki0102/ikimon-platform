<?php

/**
 * Sample Report — 営業用デモレポート
 * 
 * 架空の「遠州灘海岸サイト」の観測ベース参考レポートを静的描画。
 * for-business LP からリンクされる営業用サンプル。
 */
require_once __DIR__ . '/../../config/config.php';

// --- Demo Data (hardcoded for sales pitch) ---
$siteName = '遠州灘海岸 生物多様性モニタリングサイト';
$siteNameEn = 'Enshu-nada Coast Biodiversity Monitoring Site';
$reportDate = date('Y年m月d日');
$reportPeriod = '2025年4月 ～ 2026年1月';
$monitoringReferenceIndex = 72;
$totalSpecies = 47;
$totalObs = 312;
$redListCount = 5;
$researchGradePercent = 68.3;

$monitoringReferenceBreakdown = [
    'richness'           => ['label' => '種の豊富さ', 'score' => 78, 'weight' => 0.30, 'weighted' => 23.4],
    'data_confidence'    => ['label' => 'データ信頼性', 'score' => 68, 'weight' => 0.20, 'weighted' => 13.6],
    'conservation_value' => ['label' => '保全価値', 'score' => 85, 'weight' => 0.25, 'weighted' => 21.3],
    'taxonomic_coverage' => ['label' => '分類群カバー', 'score' => 60, 'weight' => 0.15, 'weighted' => 9.0],
    'monitoring_effort'  => ['label' => 'モニタリング', 'score' => 63, 'weight' => 0.10, 'weighted' => 6.3],
];

$taxonomyBreakdown = [
    '鳥類' => 89,
    '昆虫類' => 78,
    '植物' => 62,
    '哺乳類' => 28,
    '両生類' => 18,
    '爬虫類' => 15,
    '菌類' => 12,
    'クモ類' => 10,
];

$monthlyTrend = [
    '2025-04' => 18,
    '2025-05' => 42,
    '2025-06' => 55,
    '2025-07' => 38,
    '2025-08' => 31,
    '2025-09' => 27,
    '2025-10' => 34,
    '2025-11' => 28,
    '2025-12' => 15,
    '2026-01' => 24,
];

$demoSpecies = [
    ['name' => 'アカウミガメ', 'sci' => 'Caretta caretta', 'group' => '爬虫類', 'count' => 3, 'rl' => 'EN', 'rl_class' => 'en', 'list' => '環境省'],
    ['name' => 'コアジサシ', 'sci' => 'Sternula albifrons', 'group' => '鳥類', 'count' => 12, 'rl' => 'VU', 'rl_class' => 'vu', 'list' => '環境省'],
    ['name' => 'スナガニ', 'sci' => 'Ocypode stimpsoni', 'group' => '甲殻類', 'count' => 8, 'rl' => 'NT', 'rl_class' => 'nt', 'list' => '静岡県'],
    ['name' => 'ハマボウフウ', 'sci' => 'Glehnia littoralis', 'group' => '植物', 'count' => 15, 'rl' => 'VU', 'rl_class' => 'vu', 'list' => '静岡県'],
    ['name' => 'タヌキ', 'sci' => 'Nyctereutes procyonoides', 'group' => '哺乳類', 'count' => 2, 'rl' => '', 'rl_class' => '', 'list' => ''],
    ['name' => 'トビ', 'sci' => 'Milvus migrans', 'group' => '鳥類', 'count' => 24, 'rl' => '', 'rl_class' => '', 'list' => ''],
    ['name' => 'シジュウカラ', 'sci' => 'Parus minor', 'group' => '鳥類', 'count' => 18, 'rl' => '', 'rl_class' => '', 'list' => ''],
    ['name' => 'ナナホシテントウ', 'sci' => 'Coccinella septempunctata', 'group' => '昆虫類', 'count' => 14, 'rl' => '', 'rl_class' => '', 'list' => ''],
    ['name' => 'ツマグロヒョウモン', 'sci' => 'Argyreus hyperbius', 'group' => '昆虫類', 'count' => 11, 'rl' => '', 'rl_class' => '', 'list' => ''],
    ['name' => 'ニホンアマガエル', 'sci' => 'Dryophytes japonicus', 'group' => '両生類', 'count' => 9, 'rl' => '', 'rl_class' => '', 'list' => ''],
];

$maxMonthly = max($monthlyTrend);
$maxTaxonomy = max($taxonomyBreakdown);
$reportActions = [
    '未観測月がある想定で、春と初夏の追加観測を優先する。',
    '写真・位置・日時・同定コメントの運用ルールを揃え、研究グレード比率を上げる。',
    '重要種の確認記録を、清掃・草刈り・照明・動線などの現場計画と照合する。',
];
$referenceLinks = [
    ['label' => 'TNFD Recommendations (2023)', 'url' => 'https://tnfd.global/publication/recommendations-of-the-taskforce-on-nature-related-financial-disclosures/'],
    ['label' => 'CBD GBF Target 15', 'url' => 'https://www.cbd.int/gbf/targets/15'],
    ['label' => 'CBD GBF Target 3 (30x30)', 'url' => 'https://www.cbd.int/gbf/targets/3'],
    ['label' => 'SBTN Step 1: Assess', 'url' => 'https://sciencebasedtargetsnetwork.org/companies/take-action/assess/'],
];
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>サンプルレポート — <?php echo htmlspecialchars($siteName); ?> | ikimon.life</title>
    <meta name="robots" content="noindex">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;700;900&display=swap');

        :root {
            --primary: #10b981;
            --primary-dark: #065f46;
            --danger: #dc2626;
            --warning: #f59e0b;
            --bg: #fff;
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
            font-family: 'Noto Sans JP', sans-serif;
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

        /* Demo Banner */
        .demo-banner {
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            color: white;
            padding: 16px 24px;
            text-align: center;
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .demo-banner h3 {
            font-size: 14px;
            margin-bottom: 4px;
        }

        .demo-banner p {
            font-size: 12px;
            opacity: 0.9;
        }

        .demo-banner a {
            color: white;
            text-decoration: underline;
            font-weight: 700;
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
            line-height: 1.3;
        }

        .report-title .en {
            font-size: 12px;
            color: var(--muted);
            font-weight: 300;
        }

        .compliance {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-top: 8px;
            margin-right: 6px;
            padding: 4px 10px;
            background: #ecfdf5;
            color: var(--primary-dark);
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
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

        /* Reference Index */
        .reference-index-section {
            background: linear-gradient(135deg, var(--primary-dark), var(--primary));
            color: white;
            border-radius: 10px;
            padding: 20px 24px;
            margin: 16px 0;
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .reference-index-score {
            font-size: 52px;
            font-weight: 900;
            line-height: 1;
            min-width: 80px;
            text-align: center;
        }

        .reference-index-details h3 {
            font-size: 14px;
            margin-bottom: 6px;
        }

        .reference-index-details p {
            font-size: 11px;
            opacity: 0.9;
        }

        .reference-index-bar-container {
            margin-top: 4px;
            display: flex;
            gap: 4px;
            align-items: center;
        }

        .reference-index-bar {
            flex: 1;
            height: 6px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
            overflow: hidden;
        }

        .reference-index-bar-fill {
            height: 100%;
            border-radius: 3px;
            background: white;
        }

        .reference-index-bar-label {
            font-size: 9px;
            opacity: 0.7;
            min-width: 70px;
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

        /* RL Badge */
        .rl-badge {
            display: inline-block;
            padding: 1px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 700;
            color: white;
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

        /* RL Alert */
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

        /* Trend */
        .trend-chart {
            display: flex;
            align-items: flex-end;
            gap: 3px;
            height: 80px;
            margin: 12px 0;
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
        }

        /* TNFD */
        .tnfd-check {
            color: var(--primary);
            font-weight: 700;
        }

        .tnfd-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin: 16px 0;
        }

        .tnfd-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
            text-align: center;
        }

        .tnfd-card .phase {
            font-size: 20px;
            margin-bottom: 4px;
        }

        .tnfd-card h4 {
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 4px;
        }

        .tnfd-card p {
            font-size: 10px;
            color: var(--muted);
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
            .demo-banner {
                display: none !important;
            }

            body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }

            .container {
                max-width: 100%;
                padding: 20px;
            }
        }

        @media (max-width: 640px) {
            .summary-grid {
                grid-template-columns: repeat(2, 1fr);
            }

            .tnfd-grid {
                grid-template-columns: repeat(2, 1fr);
            }

            .reference-index-section {
                flex-direction: column;
                text-align: center;
            }

            .container {
                padding: 20px 16px;
            }
        }
    </style>
</head>

<body>
    <!-- Demo Banner -->
    <div class="demo-banner">
        <h3>📋 これはサンプルレポートです</h3>
        <p>実際のモニタリングデータに基づく生物多様性レポートをワンクリック生成。<a href="apply.php">導入のお問い合わせ →</a></p>
    </div>

    <div class="container">
        <!-- Header -->
        <div class="report-header">
            <div>
                <div class="brand-logo">ikimon</div>
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
            <span class="en"><?php echo htmlspecialchars($siteNameEn); ?></span>
            <div>
                <span class="compliance">参考: TNFD LEAP入力</span>
                <span class="compliance">参考: 30x30関連整理</span>
                <span class="compliance">✓ Darwin Core準拠</span>
            </div>
        </div>

        <!-- Summary -->
        <div class="summary-grid">
            <div class="summary-card highlight">
                <span class="val"><?php echo $monitoringReferenceIndex; ?></span>
                <span class="lbl">参考インデックス</span>
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
                <span class="val" style="color: #dc2626;"><?php echo $redListCount; ?></span>
                <span class="lbl">RL掲載種</span>
            </div>
        </div>

        <!-- Reference index -->
        <div class="reference-index-section">
            <div class="reference-index-score"><?php echo $monitoringReferenceIndex; ?></div>
            <div class="reference-index-details">
                <h3>モニタリング参考インデックス (β)</h3>
                <p>種の多様性、データ信頼性、保全シグナル、分類群カバー、継続観測を束ねた社内向けの参考値です。認証可否や自然価値そのものを単独で示すものではありません。</p>
                <?php foreach ($monitoringReferenceBreakdown as $axis): ?>
                    <div class="reference-index-bar-container">
                        <div class="reference-index-bar">
                            <div class="reference-index-bar-fill" style="width: <?php echo $axis['score']; ?>%"></div>
                        </div>
                        <span class="reference-index-bar-label"><?php echo $axis['label']; ?> <?php echo round($axis['weighted']); ?>/<?php echo round($axis['weight'] * 100); ?></span>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>

        <h2><span class="icon">🧭</span> 次にやるとよいこと</h2>
        <div class="rl-alert" style="background:#eff6ff; border-color:#bfdbfe; color:#1e3a8a;">
            <div class="rl-alert-header" style="color:#1d4ed8;">このサンプルで示したいこと</div>
            <ul style="margin-left: 18px;">
                <?php foreach ($reportActions as $action): ?>
                    <li><?php echo htmlspecialchars($action); ?></li>
                <?php endforeach; ?>
            </ul>
        </div>

        <!-- TNFD LEAP -->
        <h2><span class="icon">📋</span> TNFD LEAPとの対応関係（参考）</h2>
        <div class="tnfd-grid">
            <div class="tnfd-card">
                <div class="phase">📍</div>
                <h4>L — Locate</h4>
                <p>GeoJSON境界と対象期間で、自然との接点を整理する入力例を示しています。</p>
                <div style="margin-top:8px;"><span class="tnfd-check">参考入力</span></div>
            </div>
            <div class="tnfd-card">
                <div class="phase">🔍</div>
                <h4>E — Evaluate</h4>
                <p>参考インデックスとレッドリスト照合で、依存・影響を読み解くための材料を示しています。</p>
                <div style="margin-top:8px;"><span class="tnfd-check">参考入力</span></div>
            </div>
            <div class="tnfd-card">
                <div class="phase">📊</div>
                <h4>A — Assess</h4>
                <p>月次トレンドや分類群カバーから、追加調査や運用改善の優先順位を考える例です。</p>
                <div style="margin-top:8px;"><span class="tnfd-check">参考入力</span></div>
            </div>
            <div class="tnfd-card">
                <div class="phase">📝</div>
                <h4>P — Prepare</h4>
                <p>レポート体裁で社内共有しやすくまとめていますが、開示判断そのものは別途レビューが必要です。</p>
                <div style="margin-top:8px;"><span class="tnfd-check">参考入力</span></div>
            </div>
        </div>

        <!-- Red List -->
        <h2><span class="icon">🔴</span> レッドリスト該当種</h2>
        <div class="rl-alert">
            <div class="rl-alert-header">⚠️ <?php echo $redListCount; ?>種のレッドリスト掲載種を確認</div>
            <p>当サイトで確認された種のうち、環境省レッドリストまたは静岡県レッドデータブックに掲載されている種が<?php echo $redListCount; ?>種あります。重要な観測シグナルとして、現場計画との照合対象になります。</p>
        </div>

        <!-- Species Table -->
        <h2><span class="icon">📋</span> 確認種一覧（上位10種）</h2>
        <table>
            <thead>
                <tr>
                    <th>和名</th>
                    <th>学名</th>
                    <th>分類群</th>
                    <th>観察数</th>
                    <th>保全状況</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($demoSpecies as $sp): ?>
                    <tr>
                        <td style="font-weight: 700;"><?php echo $sp['name']; ?></td>
                        <td style="font-style: italic; color: var(--muted);"><?php echo $sp['sci']; ?></td>
                        <td><?php echo $sp['group']; ?></td>
                        <td style="font-weight: 700;"><?php echo $sp['count']; ?></td>
                        <td>
                            <?php if ($sp['rl']): ?>
                                <span class="rl-badge <?php echo $sp['rl_class']; ?>"><?php echo $sp['rl']; ?></span>
                                <span style="font-size:10px; color:var(--muted);"><?php echo $sp['list']; ?></span>
                            <?php else: ?>
                                <span style="color: var(--muted);">—</span>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>

        <!-- Taxonomy Breakdown -->
        <h2><span class="icon">🧬</span> 分類群別 観察数</h2>
        <?php foreach ($taxonomyBreakdown as $group => $count): ?>
            <div class="bar-row">
                <span class="bar-label"><?php echo $group; ?></span>
                <div class="bar-track">
                    <div class="bar-fill" style="width: <?php echo round(($count / $maxTaxonomy) * 100); ?>%"></div>
                </div>
                <span class="bar-val"><?php echo $count; ?></span>
            </div>
        <?php endforeach; ?>

        <!-- Monthly Trend -->
        <h2><span class="icon">📈</span> 月次観察トレンド</h2>
        <div class="trend-chart">
            <?php foreach ($monthlyTrend as $ym => $count): ?>
                <div class="trend-bar" style="height: <?php echo round(($count / $maxMonthly) * 100); ?>%">
                    <span class="tip"><?php echo $count; ?></span>
                </div>
            <?php endforeach; ?>
        </div>
        <div class="trend-labels">
            <?php foreach ($monthlyTrend as $ym => $count): ?>
                <span><?php echo date('n月', strtotime($ym . '-01')); ?></span>
            <?php endforeach; ?>
        </div>

        <h2><span class="icon">📚</span> 参考フレームワーク</h2>
        <div class="rl-alert" style="background:#f8fafc; border-color:#cbd5e1; color:#334155;">
            <div class="rl-alert-header" style="color:#0f172a;">このサンプルが参考にしている一次情報</div>
            <ul style="margin-left: 18px;">
                <?php foreach ($referenceLinks as $ref): ?>
                    <li>
                        <a href="<?php echo htmlspecialchars($ref['url']); ?>" target="_blank" rel="noopener noreferrer">
                            <?php echo htmlspecialchars($ref['label']); ?>
                        </a>
                    </li>
                <?php endforeach; ?>
            </ul>
            <p style="margin-top: 10px;">このページの数値は表示例です。フレームワークの準拠判定や認証判定を自動で行うものではありません。</p>
        </div>

        <!-- Footer -->
        <div class="report-footer">
            <p>本レポートは ikimon.life の営業用サンプルです。数値・種リストは架空の表示例であり、実測結果ではありません。</p>
            <p>表示思想: 観測ベースの参考レポート / データソース例: 市民科学観察記録 / レッドリスト照合: 環境省レッドリスト2020 / 静岡県RDB 2020</p>
            <p style="margin-top: 8px;">© <?php echo date('Y'); ?> ikimon.life — Citizen Science for Nature Symbiosis</p>
        </div>
    </div>
</body>

</html>
