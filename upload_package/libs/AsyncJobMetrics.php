<?php

require_once __DIR__ . '/DataStore.php';

class AsyncJobMetrics
{
    private const POST_FILE = 'system/metrics/post_requests';
    private const QUEUE_FILE = 'system/metrics/queue_runs';
    private const AI_COMPARE_FILE = 'system/metrics/ai_lane_comparisons';

    public static function recordPostRequest(array $payload): void
    {
        self::append(self::POST_FILE, [
            'event' => 'post_request',
            'observation_id' => (string)($payload['observation_id'] ?? ''),
            'duration_ms' => (int)($payload['duration_ms'] ?? 0),
            'ai_planned' => !empty($payload['ai_planned']),
            'embedding_planned' => !empty($payload['embedding_planned']),
            'ai_queue' => is_array($payload['ai_queue'] ?? null) ? $payload['ai_queue'] : null,
            'embedding_queue' => is_array($payload['embedding_queue'] ?? null) ? $payload['embedding_queue'] : null,
            'created_at' => date('c'),
        ]);
    }

    public static function recordQueueRun(string $queueName, array $payload): void
    {
        self::append(self::QUEUE_FILE, [
            'event' => 'queue_run',
            'queue' => $queueName,
            'duration_ms' => (int)($payload['duration_ms'] ?? 0),
            'processed' => (int)($payload['processed'] ?? 0),
            'completed' => (int)($payload['completed'] ?? 0),
            'failed' => (int)($payload['failed'] ?? 0),
            'deferred' => (int)($payload['deferred'] ?? 0),
            'skipped' => (int)($payload['skipped'] ?? 0),
            'queue_snapshot' => is_array($payload['queue_snapshot'] ?? null) ? $payload['queue_snapshot'] : null,
            'created_at' => date('c'),
        ]);
    }

    public static function getRecentPostRequests(int $limit = 20): array
    {
        return self::getRecent(self::POST_FILE, $limit);
    }

    public static function getRecentQueueRuns(int $limit = 30): array
    {
        return self::getRecent(self::QUEUE_FILE, $limit);
    }

    public static function summarizePostLatency(int $sample = 20): array
    {
        $items = self::getRecentPostRequests($sample);
        if ($items === []) {
            return [
                'count' => 0,
                'avg_ms' => 0,
                'max_ms' => 0,
                'latest_ms' => 0,
            ];
        }

        $durations = array_values(array_filter(array_map(
            static fn(array $item): int => (int)($item['duration_ms'] ?? 0),
            $items
        ), static fn(int $ms): bool => $ms >= 0));

        if ($durations === []) {
            return [
                'count' => count($items),
                'avg_ms' => 0,
                'max_ms' => 0,
                'latest_ms' => 0,
            ];
        }

        return [
            'count' => count($durations),
            'avg_ms' => (int)round(array_sum($durations) / count($durations)),
            'max_ms' => max($durations),
            'latest_ms' => (int)($durations[0] ?? 0),
        ];
    }

    public static function summarizeQueueRuns(int $sample = 30): array
    {
        $items = self::getRecentQueueRuns($sample);
        $summary = [];
        foreach ($items as $item) {
            $queue = (string)($item['queue'] ?? 'unknown');
            if (!isset($summary[$queue])) {
                $summary[$queue] = [
                    'runs' => 0,
                    'failed' => 0,
                    'processed' => 0,
                    'latest_duration_ms' => 0,
                ];
            }
            $summary[$queue]['runs']++;
            $summary[$queue]['failed'] += (int)($item['failed'] ?? 0);
            $summary[$queue]['processed'] += (int)($item['processed'] ?? 0);
            if ($summary[$queue]['latest_duration_ms'] === 0) {
                $summary[$queue]['latest_duration_ms'] = (int)($item['duration_ms'] ?? 0);
            }
        }
        return $summary;
    }

    public static function recordAiLaneComparison(array $payload): void
    {
        self::append(self::AI_COMPARE_FILE, [
            'event' => 'ai_lane_comparison',
            'observation_id' => (string)($payload['observation_id'] ?? ''),
            'fast_model' => (string)($payload['fast_model'] ?? ''),
            'deep_model' => (string)($payload['deep_model'] ?? ''),
            'photo_count' => (int)($payload['photo_count'] ?? 0),
            'fast_fallback' => !empty($payload['fast_fallback']),
            'deep_fallback' => !empty($payload['deep_fallback']),
            'fast_taxon' => (string)($payload['fast_taxon'] ?? ''),
            'deep_taxon' => (string)($payload['deep_taxon'] ?? ''),
            'fast_rank' => (string)($payload['fast_rank'] ?? ''),
            'deep_rank' => (string)($payload['deep_rank'] ?? ''),
            'same_taxon' => !empty($payload['same_taxon']),
            'specificity_delta' => (int)($payload['specificity_delta'] ?? 0),
            'deep_improved' => !empty($payload['deep_improved']),
            'created_at' => date('c'),
        ]);
    }

    public static function summarizeAiLaneComparison(int $sample = 50): array
    {
        $items = self::getRecent(self::AI_COMPARE_FILE, $sample);
        if ($items === []) {
            return [
                'count' => 0,
                'agreement_rate' => 0,
                'improvement_rate' => 0,
                'multi_photo_fallback_improvement_rate' => 0,
            ];
        }

        $sameTaxon = 0;
        $improved = 0;
        $multiPhotoFallbackTotal = 0;
        $multiPhotoFallbackImproved = 0;

        foreach ($items as $item) {
            if (!empty($item['same_taxon'])) {
                $sameTaxon++;
            }
            if (!empty($item['deep_improved'])) {
                $improved++;
            }
            if (!empty($item['fast_fallback']) && (int)($item['photo_count'] ?? 0) >= 3) {
                $multiPhotoFallbackTotal++;
                if (!empty($item['deep_improved'])) {
                    $multiPhotoFallbackImproved++;
                }
            }
        }

        return [
            'count' => count($items),
            'agreement_rate' => (int)round(($sameTaxon / count($items)) * 100),
            'improvement_rate' => (int)round(($improved / count($items)) * 100),
            'multi_photo_fallback_improvement_rate' => $multiPhotoFallbackTotal > 0
                ? (int)round(($multiPhotoFallbackImproved / $multiPhotoFallbackTotal) * 100)
                : 0,
        ];
    }

    public static function recommendDeepEscalationRule(int $sample = 50): array
    {
        $summary = self::summarizeAiLaneComparison($sample);
        if (($summary['count'] ?? 0) < 5) {
            return [
                'ready' => false,
                'message' => '比較データがまだ少ないため、推薦ルールは保留です。',
            ];
        }

        if (($summary['multi_photo_fallback_improvement_rate'] ?? 0) >= 60) {
            return [
                'ready' => true,
                'message' => 'photos >= 3 かつ fast fallback の観察は deep 優先が有効です。',
            ];
        }

        return [
            'ready' => true,
            'message' => '現時点では photos >= 3 fast fallback を優先しつつ、比較データを追加収集中です。',
        ];
    }

    private static function append(string $file, array $payload): void
    {
        $payload['id'] = $payload['id'] ?? uniqid('metric_', true);
        $path = DATA_DIR . '/' . $file . '/' . date('Y-m') . '.json';
        $dir = dirname($path);
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }

        $fp = fopen($path, 'c+');
        if ($fp === false) {
            return;
        }

        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            return;
        }

        $size = filesize($path);
        $content = $size > 0 ? fread($fp, $size) : '';
        $data = json_decode($content ?: '[]', true);
        if (!is_array($data)) {
            $data = [];
        }
        $data[] = $payload;

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
    }

    private static function getRecent(string $file, int $limit): array
    {
        $months = [date('Y-m'), date('Y-m', strtotime('-1 month'))];
        $items = [];
        foreach ($months as $month) {
            $path = DATA_DIR . '/' . $file . '/' . $month . '.json';
            if (!is_file($path)) {
                continue;
            }
            $content = file_get_contents($path);
            $decoded = json_decode($content ?: '[]', true);
            if (is_array($decoded)) {
                $items = array_merge($items, array_reverse($decoded));
            }
            if (count($items) >= $limit) {
                break;
            }
        }
        return array_slice($items, 0, $limit);
    }
}
