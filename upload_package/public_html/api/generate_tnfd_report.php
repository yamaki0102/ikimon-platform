<?php
/**
 * FB-26: TNFD Report PDF Generator
 * Generates a simplified biodiversity report in HTML format (printable as PDF)
 * 
 * Usage: api/generate_tnfd_report.php?site_id=ikimon_forest
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/CorporateSites.php';

// Get site ID
$siteId = $_GET['site_id'] ?? 'ikimon_forest';
$siteDef = CorporateSites::SITES[$siteId] ?? null;

if (!$siteDef) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Site not found']);
    exit;
}

// Fetch observations for this site
$allObs = DataStore::fetchAll('observations');
$siteObs = array_filter($allObs, function($obs) use ($siteId) {
    return ($obs['site_id'] ?? null) === $siteId;
});

// Calculate statistics
$speciesSet = [];
$taxonomyBreakdown = [
    'Plantae' => 0,
    'Insecta' => 0,
    'Aves' => 0,
    'Mammalia' => 0,
    'Other' => 0
];
$redListCount = 0;
$researchGradeCount = 0;

foreach ($siteObs as $obs) {
    if (!empty($obs['taxon']['name'])) {
        $speciesSet[$obs['taxon']['name']] = true;
    }
    
    // Taxonomy breakdown (simplified)
    $kingdom = $obs['taxon']['kingdom'] ?? 'Other';
    $class = $obs['taxon']['class'] ?? '';
    
    if ($kingdom === 'Plantae') {
        $taxonomyBreakdown['Plantae']++;
    } elseif ($class === 'Insecta' || $class === 'Arachnida') {
        $taxonomyBreakdown['Insecta']++;
    } elseif ($class === 'Aves') {
        $taxonomyBreakdown['Aves']++;
    } elseif ($class === 'Mammalia') {
        $taxonomyBreakdown['Mammalia']++;
    } else {
        $taxonomyBreakdown['Other']++;
    }
    
    // Red List check
    if (!empty($obs['taxon']['redlist_status'])) {
        $redListCount++;
    }
    
    // Research Grade check
    if (($obs['status'] ?? '') === 'Research Grade') {
        $researchGradeCount++;
    }
}

$totalObs = count($siteObs);
$totalSpecies = count($speciesSet);
$researchGradePercent = $totalObs > 0 ? round(($researchGradeCount / $totalObs) * 100, 1) : 0;

// Calculate BIS (Biodiversity Integrity Score) - simplified version
// Based on: species diversity, research grade %, red list presence
$bis = min(100, ($totalSpecies * 2) + ($researchGradePercent * 0.5) + ($redListCount > 0 ? 10 : 0));
$bis = round($bis, 1);

// Report date
$reportDate = date('Y年m月d日');
$reportPeriod = date('Y年1月') . ' - ' . date('Y年n月');

// Output as printable HTML
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TNFD生物多様性レポート - <?php echo htmlspecialchars($siteDef['name']); ?></title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Noto Sans JP', sans-serif;
            background: white;
            color: #1a1a1a;
            font-size: 14px;
            line-height: 1.6;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
        }
        
        .header {
            border-bottom: 3px solid #10b981;
            padding-bottom: 20px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        
        .logo {
            font-size: 24px;
            font-weight: 700;
            color: #10b981;
        }
        
        .report-info {
            text-align: right;
            font-size: 12px;
            color: #666;
        }
        
        h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        
        h2 {
            font-size: 18px;
            color: #10b981;
            margin: 30px 0 15px;
            padding-bottom: 5px;
            border-bottom: 1px solid #e5e5e5;
        }
        
        .subtitle {
            font-size: 14px;
            color: #666;
            margin-bottom: 30px;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin: 30px 0;
        }
        
        .summary-card {
            background: #f9fafb;
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
        }
        
        .summary-card.highlight {
            background: #10b981;
            color: white;
            border-color: #10b981;
        }
        
        .summary-value {
            font-size: 32px;
            font-weight: 700;
            display: block;
        }
        
        .summary-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 5px;
        }
        
        .bis-section {
            background: linear-gradient(135deg, #065f46 0%, #10b981 100%);
            color: white;
            border-radius: 12px;
            padding: 30px;
            margin: 30px 0;
            display: flex;
            align-items: center;
            gap: 30px;
        }
        
        .bis-score {
            font-size: 64px;
            font-weight: 700;
            line-height: 1;
        }
        
        .bis-details h3 {
            font-size: 16px;
            margin-bottom: 10px;
        }
        
        .bis-details p {
            font-size: 13px;
            opacity: 0.9;
        }
        
        .taxonomy-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        
        .taxonomy-table th,
        .taxonomy-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e5e5;
        }
        
        .taxonomy-table th {
            background: #f9fafb;
            font-weight: 700;
            font-size: 12px;
            text-transform: uppercase;
        }
        
        .bar {
            height: 20px;
            background: #10b981;
            border-radius: 4px;
        }
        
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e5e5e5;
            font-size: 11px;
            color: #666;
            text-align: center;
        }
        
        .disclaimer {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 15px;
            margin: 30px 0;
            font-size: 12px;
        }
        
        .disclaimer strong {
            color: #b45309;
        }
        
        @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .container { max-width: 100%; padding: 20px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div>
                <div class="logo">ikimon</div>
                <div style="font-size: 12px; color: #666;">Biodiversity Visualization Platform</div>
            </div>
            <div class="report-info">
                <strong>TNFD対応 生物多様性レポート</strong><br>
                作成日: <?php echo $reportDate; ?><br>
                対象期間: <?php echo $reportPeriod; ?>
            </div>
        </div>
        
        <!-- Title -->
        <h1><?php echo htmlspecialchars($siteDef['name']); ?></h1>
        <p class="subtitle">
            このレポートは、市民科学データに基づく生物多様性の現状を報告するものです。<br>
            TNFD（自然関連財務情報開示タスクフォース）の開示要件に対応しています。
        </p>
        
        <!-- Summary Cards -->
        <div class="summary-grid">
            <div class="summary-card highlight">
                <span class="summary-value"><?php echo $bis; ?></span>
                <span class="summary-label">BIS スコア</span>
            </div>
            <div class="summary-card">
                <span class="summary-value"><?php echo $totalSpecies; ?></span>
                <span class="summary-label">確認種数</span>
            </div>
            <div class="summary-card">
                <span class="summary-value"><?php echo $totalObs; ?></span>
                <span class="summary-label">総観察数</span>
            </div>
            <div class="summary-card">
                <span class="summary-value"><?php echo $researchGradePercent; ?>%</span>
                <span class="summary-label">検証済み率</span>
            </div>
        </div>
        
        <!-- BIS Explanation -->
        <div class="bis-section">
            <div class="bis-score"><?php echo $bis; ?></div>
            <div class="bis-details">
                <h3>Biodiversity Integrity Score (BIS)</h3>
                <p>
                    BISは、当該サイトの生物多様性の健全性を0-100のスコアで表す指標です。<br>
                    種の多様性、データ品質（Research Grade率）、希少種の存在を総合的に評価しています。
                </p>
            </div>
        </div>
        
        <!-- Taxonomy Breakdown -->
        <h2>分類群別観察数</h2>
        <table class="taxonomy-table">
            <thead>
                <tr>
                    <th>分類群</th>
                    <th>観察数</th>
                    <th style="width: 50%;">割合</th>
                </tr>
            </thead>
            <tbody>
                <?php 
                $maxCount = max(array_values($taxonomyBreakdown)) ?: 1;
                $labels = [
                    'Plantae' => '植物',
                    'Insecta' => '昆虫',
                    'Aves' => '鳥類',
                    'Mammalia' => '哺乳類',
                    'Other' => 'その他'
                ];
                foreach ($taxonomyBreakdown as $key => $count): 
                    $percent = $totalObs > 0 ? round(($count / $totalObs) * 100, 1) : 0;
                    $barWidth = ($count / $maxCount) * 100;
                ?>
                <tr>
                    <td><?php echo $labels[$key]; ?></td>
                    <td><?php echo $count; ?> (<?php echo $percent; ?>%)</td>
                    <td>
                        <div class="bar" style="width: <?php echo $barWidth; ?>%;"></div>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        
        <!-- Red List Section -->
        <h2>希少種情報</h2>
        <?php if ($redListCount > 0): ?>
        <p>
            当該サイトでは、環境省レッドリストまたは都道府県レッドリストに掲載されている種が
            <strong style="color: #dc2626;"><?php echo $redListCount; ?>種</strong>確認されています。
        </p>
        <p style="margin-top: 10px; font-size: 12px; color: #666;">
            ※希少種の正確な位置情報は保護のため公開を制限しています。
        </p>
        <?php else: ?>
        <p>
            現時点で希少種（レッドリスト掲載種）の記録はありません。<br>
            継続的なモニタリングにより、今後の発見が期待されます。
        </p>
        <?php endif; ?>
        
        <!-- Disclaimer -->
        <div class="disclaimer">
            <strong>免責事項:</strong>
            本レポートは市民科学（Citizen Science）データに基づいており、専門家による網羅的調査とは異なります。
            データは継続的に更新・検証されており、レポート作成時点での状況を反映しています。
            正式なTNFD開示資料として使用する際は、専門家によるレビューを推奨します。
        </div>
        
        <!-- TNFD Disclosure Reference -->
        <h2>TNFD開示対応項目</h2>
        <table class="taxonomy-table">
            <thead>
                <tr>
                    <th>推奨開示項目</th>
                    <th>対応状況</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>依存・影響の特定（LEAP-D）</td>
                    <td>✓ サイト内生物種の特定完了</td>
                </tr>
                <tr>
                    <td>場所の特定（LEAP-L）</td>
                    <td>✓ GPS座標による位置特定</td>
                </tr>
                <tr>
                    <td>評価（LEAP-E）</td>
                    <td>✓ BISスコアによる定量評価</td>
                </tr>
                <tr>
                    <td>優先順位付け（LEAP-P）</td>
                    <td>✓ 希少種の優先度評価</td>
                </tr>
            </tbody>
        </table>
        
        <!-- Footer -->
        <div class="footer">
            <p>
                本レポートは ikimon (https://ikimon.life) により自動生成されました。<br>
                データソース: 市民科学観察データ / GBIF Backbone Taxonomy<br>
                &copy; <?php echo date('Y'); ?> ikimon Project. Based in Hamamatsu, Japan.
            </p>
        </div>
        
        <!-- Print Button (hidden on print) -->
        <div class="no-print" style="text-align: center; margin-top: 30px;">
            <button onclick="window.print()" style="
                background: #10b981;
                color: white;
                border: none;
                padding: 15px 40px;
                font-size: 16px;
                font-weight: 700;
                border-radius: 8px;
                cursor: pointer;
            ">
                PDFとして保存 / 印刷
            </button>
            <p style="margin-top: 10px; font-size: 12px; color: #666;">
                印刷ダイアログで「PDFとして保存」を選択してください
            </p>
        </div>
    </div>
</body>
</html>
