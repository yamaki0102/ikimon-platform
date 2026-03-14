<?php
/**
 * 30by30 / 自然共生サイト 参考レポート (HTML)
 *
 * site_id ベースで観測データを集計し、環境省 30by30 / 自然共生サイト申請に
 * 必要な種名リスト・重要種・外来種情報を人間が読めるHTML形式で出力する。
 *
 * Usage: api/generate_30by30_report.php?site_id=ikan_hq
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/CorporatePlanGate.php';
require_once __DIR__ . '/../../libs/CorporateSites.php';

// Get site ID
$siteId = $_GET['site_id'] ?? '';
$siteDef = CorporateSites::SITES[$siteId] ?? null;

if (!$siteDef) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'Site not found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$corporation = CorporatePlanGate::resolveCorporationForSite((string)$siteId);
if ($corporation && !CorporatePlanGate::canUseAdvancedOutputs($corporation)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Community ワークスペースでは 30x30 参考レポートを出力できません。Public プランで有効になります。'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// RedListManager (optional)
$hasRedList = false;
$redListManager = null;
if (file_exists(__DIR__ . '/../../libs/RedListManager.php')) {
    require_once __DIR__ . '/../../libs/RedListManager.php';
    $redListManager = new RedListManager();
    $hasRedList = true;
}

// MVP Alien Species List
$alienSpeciesList = [
    'アライグマ', 'ウシガエル', 'オオクチバス', 'ブルーギル',
    'アメリカザリガニ', 'アカミミガメ', 'マングース', 'カミツキガメ',
    'クビアカツヤカミキリ', 'ヒアリ', 'セアカゴケグモ', 'アルゼンチンアリ',
    'オオキンケイギク', 'アレチウリ'
];

// Fetch observations for this site
$allObs = DataStore::fetchAll('observations');
$siteObs = array_filter($allObs, function ($obs) use ($siteId) {
    return ($obs['site_id'] ?? null) === $siteId;
});

// Aggregate species
$speciesMap = [];
$taxonomyBreakdown = ['Plantae' => 0, 'Insecta' => 0, 'Aves' => 0, 'Mammalia' => 0, 'Other' => 0];
$totalObs = 0;

foreach ($siteObs as $obs) {
    $taxonName = $obs['taxon']['name'] ?? $obs['taxon_name_ja'] ?? '';
    if (!$taxonName || $taxonName === 'Unknown') continue;
    $totalObs++;

    $taxonId = $obs['taxon']['id'] ?? null;
    $date = $obs['observed_at'] ?? $obs['date'] ?? null;

    // Taxonomy breakdown
    $kingdom = $obs['taxon']['kingdom'] ?? 'Other';
    $class = $obs['taxon']['class'] ?? '';
    if ($kingdom === 'Plantae') $taxonomyBreakdown['Plantae']++;
    elseif ($class === 'Insecta' || $class === 'Arachnida') $taxonomyBreakdown['Insecta']++;
    elseif ($class === 'Aves') $taxonomyBreakdown['Aves']++;
    elseif ($class === 'Mammalia') $taxonomyBreakdown['Mammalia']++;
    else $taxonomyBreakdown['Other']++;

    if (!isset($speciesMap[$taxonName])) {
        $speciesMap[$taxonName] = [
            'name' => $taxonName,
            'taxon_id' => $taxonId,
            'count' => 0,
            'first_seen' => $date,
            'last_seen' => $date,
            'is_important' => false,
            'red_list_status' => null,
            'is_alien' => in_array($taxonName, $alienSpeciesList),
            'kingdom' => $kingdom,
            'class' => $class,
        ];

        if ($hasRedList && $redListManager) {
            $rlMatch = $redListManager->lookupTaxon($taxonId, $taxonName, 'shizuoka');
            if ($rlMatch) {
                $speciesMap[$taxonName]['is_important'] = true;
                $speciesMap[$taxonName]['red_list_status'] = $rlMatch;
            }
        }
    }

    $speciesMap[$taxonName]['count']++;
    if ($date && (!$speciesMap[$taxonName]['first_seen'] || $date < $speciesMap[$taxonName]['first_seen'])) {
        $speciesMap[$taxonName]['first_seen'] = $date;
    }
    if ($date && (!$speciesMap[$taxonName]['last_seen'] || $date > $speciesMap[$taxonName]['last_seen'])) {
        $speciesMap[$taxonName]['last_seen'] = $date;
    }
}

// Sort by count desc
uasort($speciesMap, fn($a, $b) => $b['count'] <=> $a['count']);

$totalSpecies = count($speciesMap);
$importantCount = count(array_filter($speciesMap, fn($s) => $s['is_important']));
$alienCount = count(array_filter($speciesMap, fn($s) => $s['is_alien']));
$reportDate = date('Y年m月d日');

$taxonLabels = ['Plantae' => '植物', 'Insecta' => '昆虫', 'Aves' => '鳥類', 'Mammalia' => '哺乳類', 'Other' => 'その他'];
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>30by30 自然共生サイト 参考レポート - <?php echo htmlspecialchars($siteDef['name']); ?></title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Noto Sans JP', sans-serif; background: white; color: #1a1a1a; font-size: 14px; line-height: 1.6; }
        .container { max-width: 800px; margin: 0 auto; padding: 40px; }
        .header { border-bottom: 3px solid #0d9488; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; }
        .logo { font-size: 24px; font-weight: 700; color: #0d9488; }
        .report-info { text-align: right; font-size: 12px; color: #666; }
        h1 { font-size: 28px; margin-bottom: 10px; }
        h2 { font-size: 18px; color: #0d9488; margin: 30px 0 15px; padding-bottom: 5px; border-bottom: 1px solid #e5e5e5; }
        .subtitle { font-size: 14px; color: #666; margin-bottom: 30px; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 30px 0; }
        .summary-card { background: #f9fafb; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; text-align: center; }
        .summary-card.highlight { background: #0d9488; color: white; border-color: #0d9488; }
        .summary-card.warn { background: #fef3c7; border-color: #f59e0b; }
        .summary-value { font-size: 32px; font-weight: 700; display: block; }
        .summary-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 5px; }
        .species-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
        .species-table th, .species-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; }
        .species-table th { background: #f9fafb; font-weight: 700; font-size: 11px; text-transform: uppercase; position: sticky; top: 0; }
        .species-table tr:hover { background: #f9fafb; }
        .badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
        .badge-red { background: #fee2e2; color: #dc2626; }
        .badge-orange { background: #ffedd5; color: #ea580c; }
        .badge-teal { background: #ccfbf1; color: #0d9488; }
        .taxonomy-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .taxonomy-table th, .taxonomy-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e5e5; }
        .taxonomy-table th { background: #f9fafb; font-weight: 700; font-size: 12px; text-transform: uppercase; }
        .bar { height: 20px; background: #0d9488; border-radius: 4px; }
        .disclaimer { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 30px 0; font-size: 12px; }
        .disclaimer strong { color: #b45309; }
        .info-box { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 15px; margin: 20px 0; font-size: 12px; }
        .info-box strong { color: #0d9488; }
        .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #666; text-align: center; }
        @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .container { max-width: 100%; padding: 20px; }
            .no-print { display: none; }
            .species-table th { position: static; }
        }
        @media (max-width: 600px) {
            .container { padding: 20px; }
            .summary-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
            .summary-value { font-size: 24px; }
            h1 { font-size: 22px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div>
                <div class="logo">ikimon</div>
                <div style="font-size: 12px; color: #666;">30by30 自然共生サイト 参考資料</div>
            </div>
            <div class="report-info">
                <strong>種名リスト・重要種レポート</strong><br>
                作成日: <?php echo $reportDate; ?>
            </div>
        </div>

        <!-- Title -->
        <h1><?php echo htmlspecialchars($siteDef['name']); ?></h1>
        <p class="subtitle">
            環境省「自然共生サイト」認定申請に必要な種名リスト・重要種・外来種情報を、<br>
            市民科学観測データから整理した参考資料です。
        </p>

        <!-- Summary Cards -->
        <div class="summary-grid">
            <div class="summary-card highlight">
                <span class="summary-value"><?php echo $totalSpecies; ?></span>
                <span class="summary-label">確認種数</span>
            </div>
            <div class="summary-card">
                <span class="summary-value"><?php echo $totalObs; ?></span>
                <span class="summary-label">総観察数</span>
            </div>
            <div class="summary-card <?php echo $importantCount > 0 ? 'warn' : ''; ?>">
                <span class="summary-value"><?php echo $importantCount; ?></span>
                <span class="summary-label">重要種</span>
            </div>
            <div class="summary-card <?php echo $alienCount > 0 ? 'warn' : ''; ?>">
                <span class="summary-value"><?php echo $alienCount; ?></span>
                <span class="summary-label">要対策外来種</span>
            </div>
        </div>

        <div class="info-box">
            <strong>30by30 目標とは:</strong>
            2030年までに陸域・海域の30%を保全する国際目標（昆明・モントリオール生物多様性枠組 Target 3）。
            日本では「自然共生サイト」認定制度として、企業緑地や里山なども対象に含めて推進しています。
        </div>

        <!-- Species List -->
        <h2>確認種一覧（<?php echo $totalSpecies; ?>種）</h2>
        <table class="species-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>種名</th>
                    <th>観察数</th>
                    <th>初確認</th>
                    <th>最終確認</th>
                    <th>備考</th>
                </tr>
            </thead>
            <tbody>
                <?php $i = 1; foreach ($speciesMap as $sp): ?>
                <tr>
                    <td style="color:#999;"><?php echo $i++; ?></td>
                    <td style="font-weight:700;"><?php echo htmlspecialchars($sp['name']); ?></td>
                    <td><?php echo $sp['count']; ?></td>
                    <td style="font-size:12px;"><?php echo $sp['first_seen'] ? date('Y/m/d', strtotime($sp['first_seen'])) : '—'; ?></td>
                    <td style="font-size:12px;"><?php echo $sp['last_seen'] ? date('Y/m/d', strtotime($sp['last_seen'])) : '—'; ?></td>
                    <td>
                        <?php if ($sp['is_important']): ?>
                            <span class="badge badge-red">重要種</span>
                        <?php endif; ?>
                        <?php if ($sp['is_alien']): ?>
                            <span class="badge badge-orange">外来種</span>
                        <?php endif; ?>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>

        <?php if ($importantCount > 0): ?>
        <div class="disclaimer">
            <strong>重要種について:</strong>
            環境省レッドリストまたは静岡県レッドリストに掲載されている種が <?php echo $importantCount; ?> 種確認されています。
            重要種の正確な位置情報は保護のため精度を落として記録しています。
        </div>
        <?php endif; ?>

        <?php if ($alienCount > 0): ?>
        <div class="disclaimer" style="background:#fff7ed; border-color:#fb923c;">
            <strong style="color:#ea580c;">要対策外来種について:</strong>
            侵略的外来種のリストに該当する種が <?php echo $alienCount; ?> 種確認されています。
            自然共生サイト申請では外来種対策の計画も評価対象となります。
        </div>
        <?php endif; ?>

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
                foreach ($taxonomyBreakdown as $key => $count):
                    $percent = $totalObs > 0 ? round(($count / $totalObs) * 100, 1) : 0;
                    $barWidth = ($count / $maxCount) * 100;
                ?>
                <tr>
                    <td><?php echo $taxonLabels[$key]; ?></td>
                    <td><?php echo $count; ?> (<?php echo $percent; ?>%)</td>
                    <td><div class="bar" style="width: <?php echo $barWidth; ?>%;"></div></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>

        <!-- 30by30 Alignment -->
        <h2>自然共生サイト認定との対応（参考）</h2>
        <table class="taxonomy-table">
            <thead>
                <tr>
                    <th>認定で求められる情報</th>
                    <th>このレポートで確認できるもの</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>生物の生息・生育状況</td>
                    <td>✓ <?php echo $totalSpecies; ?>種の確認記録（観察数・期間付き）</td>
                </tr>
                <tr>
                    <td>重要な種の生息確認</td>
                    <td><?php echo $importantCount > 0 ? "✓ {$importantCount}種のレッドリスト該当種" : '— 現時点で該当なし'; ?></td>
                </tr>
                <tr>
                    <td>外来種の侵入状況</td>
                    <td><?php echo $alienCount > 0 ? "⚠ {$alienCount}種の要対策外来種を確認" : '✓ 要対策外来種の記録なし'; ?></td>
                </tr>
                <tr>
                    <td>継続的なモニタリング体制</td>
                    <td>✓ ikimonによる市民科学ベースの継続観測</td>
                </tr>
            </tbody>
        </table>

        <h2>参考リンク</h2>
        <div class="info-box">
            <ul style="margin: 0 0 0 18px;">
                <li><a href="https://policies.env.go.jp/nature/biodiversity/30by30alliance/" target="_blank" rel="noopener">環境省 30by30アライアンス</a></li>
                <li><a href="https://www.cbd.int/gbf/targets/3" target="_blank" rel="noopener">CBD GBF Target 3 (30x30)</a></li>
                <li><a href="https://www.env.go.jp/nature/kisho/hogokaihatsu/ncs.html" target="_blank" rel="noopener">自然共生サイト認定制度</a></li>
            </ul>
        </div>

        <!-- Disclaimer -->
        <div class="disclaimer">
            <strong>免責事項:</strong>
            本レポートは市民科学（Citizen Science）データに基づく参考資料であり、
            自然共生サイト認定の正式な調査報告書ではありません。
            認定申請には専門家による現地調査と正式な書類作成が必要です。
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>
                本レポートは ikimon (https://ikimon.life) により自動生成されました。<br>
                データソース: 市民科学観察データ / GBIF Backbone Taxonomy<br>
                &copy; <?php echo date('Y'); ?> ikimon Project. Based in Hamamatsu, Japan.
            </p>
        </div>

        <!-- Print Button -->
        <div class="no-print" style="text-align: center; margin-top: 30px;">
            <button onclick="window.print()" style="
                background: #0d9488; color: white; border: none;
                padding: 15px 40px; font-size: 16px; font-weight: 700;
                border-radius: 8px; cursor: pointer;
            ">PDFとして保存 / 印刷</button>
            <p style="margin-top: 10px; font-size: 12px; color: #666;">
                印刷ダイアログで「PDFとして保存」を選択してください
            </p>
        </div>
    </div>
</body>
</html>
