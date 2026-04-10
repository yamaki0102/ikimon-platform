<?php
/**
 * check_significance_scores.php
 *
 * 実データで ObservationSignificanceScorer の動作を検証する CLI スクリプト。
 *
 * 使い方:
 *   php scripts/check_significance_scores.php [--limit=50] [--min-score=0] [--show-normal]
 *
 * 出力:
 *   - 全観察のスコア分布（ヒストグラム）
 *   - important/critical 観察の一覧
 *   - 閾値の妥当性コメント
 *
 * 目的:
 *   30/60 という閾値が適切かを実データで確認し、
 *   必要なら ObservationSignificanceScorer の定数を調整する。
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/ObservationSignificanceScorer.php';

// --- CLI オプション解析 ---
$options   = getopt('', ['limit:', 'min-score:', 'show-normal']);
$limit     = isset($options['limit'])     ? (int)$options['limit']     : 100;
$minScore  = isset($options['min-score']) ? (int)$options['min-score'] : 0;
$showNormal = isset($options['show-normal']);

echo "=== ObservationSignificanceScorer 閾値検証 ===\n";
echo "設定: limit={$limit}, min-score={$minScore}, show-normal=" . ($showNormal ? 'yes' : 'no') . "\n\n";

// --- 観察データ取得 ---
$observations = DataStore::fetchAll('observations');
if (empty($observations)) {
    echo "[ERROR] 観察データが取得できませんでした。DATA_DIR を確認してください。\n";
    exit(1);
}

$total = count($observations);
echo "総観察数: {$total}\n";
echo "スコアリング対象: " . min($limit, $total) . " 件\n\n";

// --- スコアリング実行 ---
$results = [];
$processed = 0;
$errors = 0;

foreach (array_slice($observations, 0, $limit) as $obs) {
    try {
        $sig = ObservationSignificanceScorer::score($obs);
        $results[] = [
            'id'              => $obs['id'] ?? 'unknown',
            'taxon'           => $obs['taxon']['name'] ?? $obs['taxon_name'] ?? '不明',
            'prefecture'      => $obs['prefecture'] ?? '',
            'observed_at'     => $obs['observed_at'] ?? '',
            'score'           => $sig['significance_score'],
            'level'           => $sig['sensitivity_level'],
            'redlist'         => $sig['redlist_category'],
            'rarity'          => $sig['distribution_rarity'],
            'is_invasive'     => $sig['is_invasive'],
            'reasons'         => $sig['reasons'],
        ];
        $processed++;
    } catch (\Throwable $e) {
        $errors++;
    }
}

echo "スコアリング完了: {$processed} 件 (エラー: {$errors} 件)\n\n";

// --- スコア分布集計 ---
$distribution = [
    'critical (60+)'  => 0,
    'important (30-59)' => 0,
    'normal (0-29)'   => 0,
];
$redlistHits  = 0;
$rarityHits   = 0;
$invasiveHits = 0;

foreach ($results as $r) {
    if ($r['score'] >= 60) {
        $distribution['critical (60+)']++;
    } elseif ($r['score'] >= 30) {
        $distribution['important (30-59)']++;
    } else {
        $distribution['normal (0-29)']++;
    }
    if ($r['redlist'])    $redlistHits++;
    if ($r['rarity'] && $r['rarity'] !== 'common') $rarityHits++;
    if ($r['is_invasive']) $invasiveHits++;
}

echo "--- スコア分布 ---\n";
foreach ($distribution as $label => $count) {
    $pct = $processed > 0 ? round($count / $processed * 100, 1) : 0;
    $bar = str_repeat('█', (int)($count / max(1, $processed) * 40));
    printf("  %-22s %4d件 (%5.1f%%) %s\n", $label, $count, $pct, $bar);
}

echo "\n--- 検出内訳 ---\n";
printf("  RedList ヒット      : %d 件\n", $redlistHits);
printf("  地域希少性ヒット    : %d 件\n", $rarityHits);
printf("  外来種ヒット        : %d 件\n", $invasiveHits);

// --- important/critical 観察一覧 ---
$importantResults = array_filter($results, fn($r) => $r['score'] >= $minScore && ($showNormal || $r['level'] !== 'normal'));
usort($importantResults, fn($a, $b) => $b['score'] <=> $a['score']);

if (!empty($importantResults)) {
    echo "\n--- " . ($showNormal ? '全観察' : 'important / critical 観察') . " (score降順) ---\n";
    printf("  %-6s %-10s %-20s %-8s %s\n", 'Score', 'Level', '種名', '都道府県', '理由');
    echo "  " . str_repeat('-', 80) . "\n";
    foreach (array_slice($importantResults, 0, 50) as $r) {
        $taxon  = mb_substr($r['taxon'], 0, 20);
        $pref   = mb_substr($r['prefecture'], 0, 8);
        $reason = implode(' / ', array_slice($r['reasons'], 0, 2));
        $reason = mb_substr($reason, 0, 40);
        printf("  %-6d %-10s %-20s %-8s %s\n", $r['score'], $r['level'], $taxon, $pref, $reason);
    }
}

// --- 閾値の妥当性コメント ---
echo "\n--- 閾値評価 ---\n";
$criticalPct  = $processed > 0 ? round($distribution['critical (60+)']  / $processed * 100, 1) : 0;
$importantPct = $processed > 0 ? round($distribution['important (30-59)'] / $processed * 100, 1) : 0;

if ($criticalPct > 20) {
    echo "  ⚠ critical が全体の {$criticalPct}% と多い。閾値を 75+ に引き上げることを検討。\n";
} elseif ($criticalPct < 1 && $processed > 20) {
    echo "  ℹ critical が {$criticalPct}% と少ない。希少種データが少ないか、閾値が高すぎる可能性。\n";
    echo "    → RedList データが空の場合: php scripts/ingestion/import_redlist.php を実行してください。\n";
} else {
    echo "  ✓ critical {$criticalPct}% / important {$importantPct}% — 閾値は概ね適切です。\n";
}

echo "\n完了。\n";
