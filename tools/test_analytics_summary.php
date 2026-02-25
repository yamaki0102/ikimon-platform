<?php

/**
 * テスト: get_analytics_summary.php のロジック検証
 * Auth チェックをバイパスしてAPIロジックだけをテスト
 */
error_reporting(E_ALL);
ini_set('display_errors', '1');

require_once __DIR__ . '/../upload_package/config/config.php';

$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['days'] = 7;

// === API ロジック (Auth チェック以降の部分を直接実行) ===

$days = isset($_GET['days']) ? (int)$_GET['days'] : 7;
if ($days < 1) $days = 1;
if ($days > 90) $days = 90;

$to = date('Y-m-d');
$from = date('Y-m-d', strtotime('-' . ($days - 1) . ' days'));

$analyticsDir = DATA_DIR . '/analytics';

$totalEvents = 0;
$eventCounts = [];
$pageViews = [];
$dailyCounts = [];
$uniqueSessions = [];
$funnelOrder = ['post_start', 'photo_added', 'post_submit', 'post_success'];
$funnelCounts = array_fill_keys($funnelOrder, 0);

if (is_dir($analyticsDir)) {
    $date = new DateTime($from);
    $end = new DateTime($to);

    while ($date <= $end) {
        $day = $date->format('Y-m-d');
        $file = $analyticsDir . '/' . $day . '.json';

        if (file_exists($file)) {
            $content = file_get_contents($file);
            $events = json_decode($content, true);

            if (is_array($events)) {
                foreach ($events as $ev) {
                    $eventName = $ev['event'] ?? '';
                    if ($eventName === '') continue;
                    $totalEvents++;
                    $eventCounts[$eventName] = ($eventCounts[$eventName] ?? 0) + 1;
                    $dailyCounts[$day] = ($dailyCounts[$day] ?? 0) + 1;
                    if (!empty($ev['session_id'])) {
                        $uniqueSessions[$ev['session_id']] = true;
                    }
                    if ($eventName === 'page_view') {
                        $page = $ev['page'] ?? '';
                        if ($page !== '') {
                            $pageViews[$page] = ($pageViews[$page] ?? 0) + 1;
                        }
                    }
                    if (isset($funnelCounts[$eventName])) {
                        $funnelCounts[$eventName]++;
                    }
                }
            }
        }
        $date->modify('+1 day');
    }
}

$funnelSteps = [];
$prevCount = 0;
foreach ($funnelOrder as $i => $step) {
    $count = (int)($funnelCounts[$step] ?? 0);
    if ($i === 0) {
        $rate = $count > 0 ? 100 : 0;
    } else {
        $rate = ($prevCount > 0) ? round(($count / $prevCount) * 100, 1) : 0;
    }
    $funnelSteps[] = [
        'name' => $step,
        'count' => $count,
        'rate' => $rate
    ];
    $prevCount = $count;
}

$response = [
    'success' => true,
    'period' => ['from' => $from, 'to' => $to],
    'summary' => [
        'total_events' => $totalEvents,
        'unique_sessions' => count($uniqueSessions),
        'event_counts' => $eventCounts,
        'page_views' => $pageViews,
        'daily' => $dailyCounts,
        'funnel' => ['steps' => $funnelSteps]
    ]
];

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";

// === 検証 ===
echo "\n--- 検証 ---\n";
$ok = true;
if ($totalEvents !== 10) {
    echo "❌ total_events: expected 10, got $totalEvents\n";
    $ok = false;
}
if (count($uniqueSessions) !== 2) {
    echo "❌ unique_sessions: expected 2, got " . count($uniqueSessions) . "\n";
    $ok = false;
}
if (($eventCounts['page_view'] ?? 0) !== 4) {
    echo "❌ page_view count: expected 4, got " . ($eventCounts['page_view'] ?? 0) . "\n";
    $ok = false;
}
if (($funnelCounts['post_start'] ?? 0) !== 2) {
    echo "❌ funnel post_start: expected 2, got " . ($funnelCounts['post_start'] ?? 0) . "\n";
    $ok = false;
}
if (($funnelCounts['post_success'] ?? 0) !== 1) {
    echo "❌ funnel post_success: expected 1, got " . ($funnelCounts['post_success'] ?? 0) . "\n";
    $ok = false;
}
echo $ok ? "✅ 全検証パス！\n" : "❌ 検証失敗あり\n";
