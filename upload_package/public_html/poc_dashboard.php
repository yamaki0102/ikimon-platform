<?php

/**
 * PoC Dashboard — 観察のOS KPI ダッシュボード
 *
 * Phase 6 PoC の進捗を可視化:
 * - 観察モード別の貢献
 * - Evidence Tier 分布
 * - G1-G7 数値ゲート
 * - 自動提案（SurveyRecommender）
 * - データ蓄積の時系列
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CanonicalStore.php';

Auth::init();

// KPI メトリクス取得
$kpi = CanonicalStore::getKPIMetrics();

// ソース名の日本語マッピング
$sourceLabels = [
    'post'      => '📷 投稿',
    'walk'      => '🚶 ウォーク',
    'live-scan' => '📡 ライブスキャン',
    'survey'    => '📋 調査',
];

// Tier ラベル
$tierLabels = [
    '1'   => 'Tier 1 (AI判定)',
    '1.5' => 'Tier 1.5 (AI+生態学的妥当性)',
    '2'   => 'Tier 2 (コミュニティ検証)',
    '3'   => 'Tier 3 (合意形成)',
    '4'   => 'Tier 4 (外部監査)',
];

$pageTitle = 'PoC Dashboard — 観察のOS';

?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($pageTitle) ?> | ikimon.life</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        .stat-card { transition: transform 0.15s ease; }
        .stat-card:hover { transform: translateY(-2px); }
        .tier-bar { transition: width 0.5s ease; }
    </style>
</head>
<body class="bg-gray-50 min-h-screen">

<!-- ヘッダー -->
<header class="bg-white border-b border-gray-200 px-4 py-3">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
            <a href="index.php" class="text-gray-500 hover:text-gray-700">
                <i data-lucide="arrow-left" class="w-5 h-5"></i>
            </a>
            <h1 class="text-xl font-bold text-gray-900">📊 PoC Dashboard</h1>
            <span class="text-sm text-gray-500">観察のOS</span>
        </div>
        <div class="text-sm text-gray-400">
            最終更新: <?= date('Y/m/d H:i') ?>
        </div>
    </div>
</header>

<main class="max-w-7xl mx-auto px-4 py-6" x-data="dashboard()">

    <!-- サマリーカード Row 1 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div class="stat-card bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div class="text-3xl font-bold text-blue-600"><?= number_format($kpi['total_occurrences']) ?></div>
            <div class="text-sm text-gray-500 mt-1">総観察数</div>
        </div>
        <div class="stat-card bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div class="text-3xl font-bold text-green-600"><?= number_format($kpi['unique_species']) ?></div>
            <div class="text-sm text-gray-500 mt-1">確認種数</div>
        </div>
        <div class="stat-card bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div class="text-3xl font-bold text-purple-600"><?= number_format($kpi['research_grade_count']) ?></div>
            <div class="text-sm text-gray-500 mt-1">Research Grade</div>
        </div>
        <div class="stat-card bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div class="text-3xl font-bold text-amber-600">
                <?= $kpi['total_occurrences'] > 0
                    ? round($kpi['research_grade_count'] / $kpi['total_occurrences'] * 100) . '%'
                    : '—' ?>
            </div>
            <div class="text-sm text-gray-500 mt-1">RG 率</div>
        </div>
    </div>

    <!-- サマリーカード Row 2: 努力量 KPI -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div class="stat-card bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div class="text-3xl font-bold text-cyan-600"><?= number_format($kpi['total_sessions']) ?></div>
            <div class="text-sm text-gray-500 mt-1">セッション数</div>
        </div>
        <div class="stat-card bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div class="text-3xl font-bold text-teal-600"><?= $kpi['total_effort_hours'] ?>h</div>
            <div class="text-sm text-gray-500 mt-1">総努力時間</div>
        </div>
        <div class="stat-card bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div class="text-3xl font-bold text-indigo-600">
                <?= $kpi['detections_per_hour'] !== null ? $kpi['detections_per_hour'] : '—' ?>
            </div>
            <div class="text-sm text-gray-500 mt-1">検出/時間</div>
        </div>
        <div class="stat-card bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div class="text-3xl font-bold text-rose-600"><?= number_format($kpi['contributor_count']) ?></div>
            <div class="text-sm text-gray-500 mt-1">貢献者数</div>
        </div>
    </div>

    <!-- 2カラムレイアウト -->
    <div class="grid md:grid-cols-2 gap-6 mb-8">

        <!-- 観察モード別 -->
        <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 class="text-lg font-semibold text-gray-800 mb-4">観察モード別の貢献</h2>
            <?php
            $maxCount = max(1, max(array_values($kpi['by_source'] ?: [0])));
            foreach ($kpi['by_source'] as $source => $count):
                $label = $sourceLabels[$source] ?? $source;
                $pct = round($count / $maxCount * 100);
            ?>
            <div class="mb-3">
                <div class="flex justify-between text-sm mb-1">
                    <span class="text-gray-700"><?= htmlspecialchars($label) ?></span>
                    <span class="font-medium text-gray-900"><?= number_format($count) ?>件</span>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-3">
                    <div class="bg-blue-500 h-3 rounded-full tier-bar" style="width: <?= $pct ?>%"></div>
                </div>
            </div>
            <?php endforeach; ?>

            <?php if (empty($kpi['by_source'])): ?>
            <p class="text-gray-400 text-sm">まだデータがありません</p>
            <?php endif; ?>
        </div>

        <!-- Evidence Tier 分布 -->
        <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 class="text-lg font-semibold text-gray-800 mb-4">Evidence Tier 分布</h2>
            <?php
            $totalOcc = max(1, $kpi['total_occurrences']);
            $tierColors = ['1' => 'bg-gray-400', '1.5' => 'bg-blue-400', '2' => 'bg-green-500', '3' => 'bg-purple-500', '4' => 'bg-amber-500'];
            foreach ($tierLabels as $tier => $label):
                $count = $kpi['by_tier'][$tier] ?? 0;
                $pct = round($count / $totalOcc * 100);
                $color = $tierColors[$tier] ?? 'bg-gray-300';
            ?>
            <div class="mb-3">
                <div class="flex justify-between text-sm mb-1">
                    <span class="text-gray-700"><?= htmlspecialchars($label) ?></span>
                    <span class="font-medium text-gray-900"><?= number_format($count) ?>件 (<?= $pct ?>%)</span>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-3">
                    <div class="<?= $color ?> h-3 rounded-full tier-bar" style="width: <?= max(2, $pct) ?>%"></div>
                </div>
            </div>
            <?php endforeach; ?>

            <?php if (empty($kpi['by_tier'])): ?>
            <p class="text-gray-400 text-sm">まだデータがありません</p>
            <?php endif; ?>
        </div>
    </div>

    <!-- G1-G7 数値ゲート -->
    <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
        <h2 class="text-lg font-semibold text-gray-800 mb-4">G1-G7 Go/No-Go ゲート</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" x-data="gateMetrics()">
            <template x-for="gate in gates" :key="gate.id">
                <div class="border rounded-lg p-3" :class="gate.pass ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-sm font-medium text-gray-700" x-text="gate.id"></span>
                        <span class="text-lg" x-text="gate.pass ? '✅' : '❌'"></span>
                    </div>
                    <div class="text-lg font-bold" :class="gate.pass ? 'text-green-700' : 'text-red-700'" x-text="gate.value"></div>
                    <div class="text-xs text-gray-500" x-text="gate.label + ' (' + gate.threshold + ')'"></div>
                </div>
            </template>
        </div>
    </div>

    <!-- 努力量詳細 -->
    <div class="grid md:grid-cols-2 gap-6 mb-8">
        <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 class="text-lg font-semibold text-gray-800 mb-4">セッションモード別</h2>
            <?php
            $modeLabels = [
                'walk' => '🚶 ウォーク',
                'live-scan' => '📡 ライブスキャン',
                'walk-scan' => '🔍 ウォークスキャン',
                'bike-scan' => '🚲 自転車スキャン',
                'car-scan' => '🚗 車スキャン',
            ];
            if (!empty($kpi['by_mode'])):
                $maxMode = max(1, max(array_values($kpi['by_mode'])));
                foreach ($kpi['by_mode'] as $mode => $cnt):
                    $ml = $modeLabels[$mode] ?? $mode;
                    $pctM = round($cnt / $maxMode * 100);
            ?>
            <div class="mb-3">
                <div class="flex justify-between text-sm mb-1">
                    <span class="text-gray-700"><?= htmlspecialchars($ml) ?></span>
                    <span class="font-medium text-gray-900"><?= number_format($cnt) ?>回</span>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-3">
                    <div class="bg-teal-500 h-3 rounded-full tier-bar" style="width: <?= $pctM ?>%"></div>
                </div>
            </div>
            <?php endforeach; else: ?>
            <p class="text-gray-400 text-sm">まだデータがありません</p>
            <?php endif; ?>
        </div>

        <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 class="text-lg font-semibold text-gray-800 mb-4">データ品質サマリー</h2>
            <div class="space-y-4">
                <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-600">レビュー待ち</span>
                    <span class="text-lg font-bold text-orange-600"><?= number_format($kpi['review_backlog']) ?>件</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-600">レビュー遅延（中央値）</span>
                    <span class="text-lg font-bold text-blue-600">
                        <?= $kpi['review_latency_median_sec'] !== null
                            ? round($kpi['review_latency_median_sec'] / 60) . '分'
                            : '未レビュー' ?>
                    </span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-600">不在データ</span>
                    <span class="text-lg font-bold text-gray-600"><?= number_format($kpi['absence_count']) ?>件</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-600">チェックリスト完了</span>
                    <span class="text-lg font-bold text-green-600"><?= number_format($kpi['checklist_sessions']) ?>回</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-600">総距離</span>
                    <span class="text-lg font-bold text-indigo-600"><?= $kpi['total_distance_km'] ?>km</span>
                </div>
            </div>
        </div>
    </div>

    <!-- 自動提案 -->
    <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
        <h2 class="text-lg font-semibold text-gray-800 mb-4">💡 自動提案</h2>
        <div id="recommendations" class="space-y-3">
            <div class="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <span class="text-amber-600 mt-0.5">⚠️</span>
                <div>
                    <div class="text-sm font-medium text-amber-800">Tier 1 の滞留確認が必要</div>
                    <div class="text-xs text-amber-600">AI判定のみで止まっている観察がある場合、reviewer による検証を推奨</div>
                </div>
            </div>
            <div class="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <span class="text-blue-600 mt-0.5">📋</span>
                <div>
                    <div class="text-sm font-medium text-blue-800">データ蓄積を継続</div>
                    <div class="text-xs text-blue-600">ウォークモードとライブスキャンで音声データを蓄積し、多様性の全体像を構築</div>
                </div>
            </div>
        </div>
    </div>

    <!-- アクションボタン -->
    <div class="flex flex-wrap gap-3 mb-8">
        <a href="id_workbench.php" class="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
            <i data-lucide="search" class="w-4 h-4"></i>
            同定ワークベンチ
        </a>
        <a href="walk.php" class="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
            <i data-lucide="footprints" class="w-4 h-4"></i>
            ウォーク開始
        </a>
        <a href="field_scan.php" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            <i data-lucide="radar" class="w-4 h-4"></i>
            ライブスキャン
        </a>
    </div>

</main>

<script>
function dashboard() {
    return {};
}

function gateMetrics() {
    const kpi = <?= json_encode($kpi, JSON_UNESCAPED_UNICODE) ?>;

    const dph = kpi.detections_per_hour;
    const reviewLatencySec = kpi.review_latency_median_sec;
    const reviewLatencyMin = reviewLatencySec !== null ? Math.round(reviewLatencySec / 60) : null;
    const reviewBacklog = kpi.review_backlog;
    const contributors = kpi.contributor_count;
    const effortHours = kpi.total_effort_hours;

    return {
        gates: [
            {
                id: 'G1', label: '検出効率', threshold: '≥10/時間',
                value: dph !== null ? dph + '/h' : '—',
                pass: dph !== null && dph >= 10
            },
            {
                id: 'G2', label: '努力量カバレッジ', threshold: '≥1h',
                value: effortHours > 0 ? effortHours + 'h' : '—',
                pass: effortHours >= 1
            },
            {
                id: 'G3', label: 'レビュー速度', threshold: '≤180分',
                value: reviewLatencyMin !== null ? reviewLatencyMin + '分' : '未レビュー',
                pass: reviewLatencyMin !== null && reviewLatencyMin <= 180
            },
            {
                id: 'G4', label: 'レビュー残', threshold: '≤50件',
                value: reviewBacklog + '件',
                pass: reviewBacklog <= 50
            },
            {
                id: 'G5', label: '貢献者数', threshold: '≥3名',
                value: contributors + '名',
                pass: contributors >= 3
            },
            {
                id: 'G6', label: '種の多様性', threshold: '≥10種',
                value: kpi.unique_species + '種',
                pass: kpi.unique_species >= 10
            },
            {
                id: 'G7', label: '総観察数', threshold: '≥100件',
                value: kpi.total_occurrences + '件',
                pass: kpi.total_occurrences >= 100
            },
        ]
    };
}
</script>
<script>lucide.createIcons();</script>
</body>
</html>
