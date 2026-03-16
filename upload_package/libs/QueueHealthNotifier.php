<?php

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/Notification.php';
require_once __DIR__ . '/UserStore.php';
require_once __DIR__ . '/Auth.php';

class QueueHealthNotifier
{
    private const ALERT_FILE = 'system/queue_health_alerts';
    private const DEFAULT_THRESHOLDS = [
        'ai_assessment' => [
            'oldest_pending_seconds' => 1800,
            'failed' => 3,
        ],
        'embedding' => [
            'oldest_pending_seconds' => 2400,
            'failed' => 3,
        ],
        'observation_recalc' => [
            'oldest_pending_seconds' => 1200,
            'failed' => 5,
        ],
        'post_requests' => [
            'latest_ms' => 4000,
            'avg_ms' => 2500,
        ],
    ];

    public static function evaluate(array $queueSnapshots, array $postLatency = []): array
    {
        $alerts = [];
        foreach ($queueSnapshots as $queue => $snapshot) {
            $thresholds = self::DEFAULT_THRESHOLDS[$queue] ?? null;
            if (!$thresholds || !is_array($snapshot)) {
                continue;
            }
            if (($snapshot['oldest_pending_seconds'] ?? 0) >= ($thresholds['oldest_pending_seconds'] ?? PHP_INT_MAX)) {
                $alerts[] = self::raiseAlert(
                    $queue,
                    'stalled_queue',
                    ucfirst(str_replace('_', ' ', $queue)) . ' queue が滞留',
                    'oldest_pending_seconds=' . (int)$snapshot['oldest_pending_seconds'] . ' pending=' . (int)($snapshot['pending'] ?? 0)
                );
            }
            if (($snapshot['failed'] ?? 0) >= ($thresholds['failed'] ?? PHP_INT_MAX)) {
                $alerts[] = self::raiseAlert(
                    $queue,
                    'failed_jobs',
                    ucfirst(str_replace('_', ' ', $queue)) . ' queue の失敗件数が閾値超過',
                    'failed=' . (int)$snapshot['failed'] . ' pending=' . (int)($snapshot['pending'] ?? 0)
                );
            }
        }

        if ($postLatency !== []) {
            $thresholds = self::DEFAULT_THRESHOLDS['post_requests'];
            if (($postLatency['latest_ms'] ?? 0) >= $thresholds['latest_ms']) {
                $alerts[] = self::raiseAlert(
                    'post_requests',
                    'latest_latency',
                    '投稿レイテンシが急増',
                    'latest_ms=' . (int)$postLatency['latest_ms'] . ' avg_ms=' . (int)($postLatency['avg_ms'] ?? 0)
                );
            }
            if (($postLatency['avg_ms'] ?? 0) >= $thresholds['avg_ms']) {
                $alerts[] = self::raiseAlert(
                    'post_requests',
                    'avg_latency',
                    '投稿APIの平均レイテンシが高い',
                    'avg_ms=' . (int)$postLatency['avg_ms'] . ' sample=' . (int)($postLatency['count'] ?? 0)
                );
            }
        }

        return array_values(array_filter($alerts));
    }

    public static function getRecentAlerts(int $limit = 20): array
    {
        $alerts = DataStore::get(self::ALERT_FILE, 0);
        if (!is_array($alerts)) {
            return [];
        }
        usort($alerts, static fn(array $a, array $b): int => strcmp((string)($b['created_at'] ?? ''), (string)($a['created_at'] ?? '')));
        return array_slice($alerts, 0, $limit);
    }

    private static function raiseAlert(string $queue, string $kind, string $title, string $message): ?array
    {
        $alertId = $queue . ':' . $kind . ':' . date('Y-m-d-H');
        $existing = DataStore::findById(self::ALERT_FILE, $alertId);
        if ($existing) {
            return null;
        }

        $alert = [
            'id' => $alertId,
            'queue' => $queue,
            'kind' => $kind,
            'title' => $title,
            'message' => $message,
            'created_at' => date('c'),
            'resolved' => false,
        ];
        DataStore::upsert(self::ALERT_FILE, $alert);
        self::notifyOperators($title, $message, $queue);
        return $alert;
    }

    private static function notifyOperators(string $title, string $message, string $queue): void
    {
        $users = UserStore::getAll(true);
        foreach ($users as $user) {
            $role = Auth::getRole($user);
            if (!in_array($role, ['Analyst', 'Admin'], true)) {
                continue;
            }
            Notification::send(
                (string)($user['id'] ?? ''),
                Notification::TYPE_COMMENT,
                '[Queue Alert] ' . $title,
                $message,
                '/admin/queues.php?queue=' . urlencode($queue)
            );
        }
    }
}
