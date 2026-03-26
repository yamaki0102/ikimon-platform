<?php

/**
 * get_analytics_summary.php — アナリティクス集計API
 *
 * GET: 直近N日分のJSONファイルから集計して返す
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';

// GET only
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(['success' => false, 'message' => 'GET required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Auth
Auth::init();
if (!Auth::hasRole('Admin')) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// days param
$days = isset($_GET['days']) ? (int)$_GET['days'] : 7;
if ($days < 1) $days = 1;
if ($days > 90) $days = 90;

// Period (inclusive)
$to = date('Y-m-d');
$from = date('Y-m-d', strtotime('-' . ($days - 1) . ' days'));

$analyticsDir = DATA_DIR . '/analytics';

// Aggregates
$totalEvents = 0;
$eventCounts = [];
$pageViews = [];
$dailyCounts = [];
$uniqueSessions = [];
$funnelOrder = ['post_start', 'photo_added', 'post_submit', 'post_success'];
$funnelCounts = array_fill_keys($funnelOrder, 0);
$todayCardViews = 0;
$todayCardCompletedViews = 0;
$todayCardCtas = [];
$habitQualified = [
    'post' => 0,
    'walk' => 0,
    'identification' => 0,
    'reflection' => 0,
];

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

                    // daily
                    $dailyCounts[$day] = ($dailyCounts[$day] ?? 0) + 1;

                    // unique sessions
                    if (!empty($ev['session_id'])) {
                        $uniqueSessions[$ev['session_id']] = true;
                    }

                    // page views
                    if ($eventName === 'page_view') {
                        $page = $ev['page'] ?? '';
                        if ($page !== '') {
                            $pageViews[$page] = ($pageViews[$page] ?? 0) + 1;
                        }
                    }

                    // funnel
                    if (isset($funnelCounts[$eventName])) {
                        $funnelCounts[$eventName]++;
                    }

                    if ($eventName === 'today_card_view') {
                        $todayCardViews++;
                        if (!empty($ev['data']['completed'])) {
                            $todayCardCompletedViews++;
                        }
                    }

                    if ($eventName === 'today_card_cta') {
                        $target = $ev['data']['target'] ?? 'unknown';
                        $todayCardCtas[$target] = ($todayCardCtas[$target] ?? 0) + 1;
                    }

                    if ($eventName === 'walk_habit_qualified') {
                        $habitQualified['walk']++;
                    }
                    if ($eventName === 'identification_habit_qualified') {
                        $habitQualified['identification']++;
                    }
                    if ($eventName === 'reflection_habit_qualified') {
                        $habitQualified['reflection']++;
                    }
                    if ($eventName === 'post_success') {
                        $habitQualified['post']++;
                    }
                }
            }
        }

        $date->modify('+1 day');
    }
}

// Funnel steps with rates
$funnelSteps = [];
$prevCount = 0;
foreach ($funnelOrder as $i => $step) {
    $count = (int)$funnelCounts[$step];
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
    'period' => [
        'from' => $from,
        'to' => $to
    ],
    'summary' => [
        'total_events' => $totalEvents,
        'unique_sessions' => count($uniqueSessions),
        'event_counts' => $eventCounts,
        'page_views' => $pageViews,
        'daily' => $dailyCounts,
        'funnel' => [
            'steps' => $funnelSteps
        ],
        'habit' => [
            'today_card_views' => $todayCardViews,
            'today_card_completed_views' => $todayCardCompletedViews,
            'today_card_ctas' => $todayCardCtas,
            'qualified' => $habitQualified,
        ]
    ]
];

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
