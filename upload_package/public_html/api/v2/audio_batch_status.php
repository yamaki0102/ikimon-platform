<?php
/**
 * audio_batch_status.php — バッチ評価結果取得
 *
 * LiveScanner.js から散歩レポート表示時に呼ばれる。
 * ジョブIDまたはセッションIDで結果を取得。
 *
 * GET /api/v2/audio_batch_status.php?job_id=abj_xxx
 * GET /api/v2/audio_batch_status.php?session_id=ls_xxx
 *
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       status: "queued" | "processing" | "done" | "error",
 *       detections: [...],       // done 時のみ
 *       tier_promotions: [...],  // dual_agree + confidence >= 0.80
 *       summary: { dual_agree_count, birdnet_only, perch_only, tier_1_5_count }
 *     }
 *   }
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_error('Method not allowed', 405);
}

Auth::init();

$userId = null;
if (Auth::isLoggedIn()) {
    $userId = Auth::getCurrentUserId();
} else {
    $installId = $_GET['install_id'] ?? null;
    if ($installId) {
        $installs = DataStore::get('fieldscan_installs') ?? [];
        foreach ($installs as $inst) {
            if (($inst['install_id'] ?? '') === $installId && ($inst['status'] ?? 'active') === 'active') {
                $userId = $inst['user_id'] ?? null;
                break;
            }
        }
    }
    if (!$userId) {
        api_error('Unauthorized', 401);
    }
}

$jobId     = $_GET['job_id'] ?? null;
$sessionId = $_GET['session_id'] ?? null;

if (!$jobId && !$sessionId) {
    api_error('job_id または session_id が必要です', 400);
}

$resultsDir = DATA_DIR . 'audio_results/';
$queueDir   = DATA_DIR . 'audio_queue/';

// ── ジョブID指定 ──

if ($jobId) {
    $result = _findResult($jobId, $resultsDir, $queueDir);
    api_success($result);
}

// ── セッションID指定（そのセッションの全ジョブを集約）──

if ($sessionId) {
    $jobs = glob($queueDir . '*.json') ?: [];
    $jobIds = [];

    foreach ($jobs as $jobFile) {
        $job = json_decode(file_get_contents($jobFile), true);
        if (($job['session_id'] ?? '') === $sessionId) {
            $jobIds[] = $job['job_id'];
        }
    }

    // 完了済みジョブも検索
    $doneJobs = glob($queueDir . 'done/*.json') ?: [];
    foreach ($doneJobs as $jobFile) {
        $job = json_decode(file_get_contents($jobFile), true);
        if (($job['session_id'] ?? '') === $sessionId) {
            $jobIds[] = $job['job_id'];
        }
    }

    if (empty($jobIds)) {
        api_success([
            'status'     => 'no_jobs',
            'message'    => 'このセッションのバッチジョブが見つかりません',
            'detections' => [],
        ]);
    }

    // 全ジョブの結果を集約
    $allDetections   = [];
    $pendingCount    = 0;
    $completedCount  = 0;

    foreach ($jobIds as $jid) {
        $r = _findResult($jid, $resultsDir, $queueDir);
        if ($r['status'] === 'done') {
            $completedCount++;
            foreach ($r['detections'] ?? [] as $det) {
                $key = strtolower(trim($det['scientific_name'] ?? ''));
                if (!$key) continue;
                if (!isset($allDetections[$key]) || $det['confidence'] > $allDetections[$key]['confidence']) {
                    $allDetections[$key] = $det;
                }
            }
        } elseif (in_array($r['status'], ['queued', 'processing'], true)) {
            $pendingCount++;
        }
    }

    $detections = array_values($allDetections);
    usort($detections, fn($a, $b) => $b['confidence'] <=> $a['confidence']);

    $overallStatus = $pendingCount > 0 ? 'processing' : 'done';

    api_success([
        'status'           => $overallStatus,
        'total_jobs'       => count($jobIds),
        'completed_jobs'   => $completedCount,
        'pending_jobs'     => $pendingCount,
        'detections'       => $detections,
        'tier_promotions'  => array_values(array_filter($detections, fn($d) => $d['tier_1_5_eligible'] ?? false)),
        'summary'          => _buildSummary($detections),
    ]);
}

// ────────────────────────────────────────────────────────

function _findResult(string $jobId, string $resultsDir, string $queueDir): array
{
    $resultFile = $resultsDir . $jobId . '.json';

    if (file_exists($resultFile)) {
        $result = json_decode(file_get_contents($resultFile), true);
        if (($result['status'] ?? '') === 'error') {
            return ['status' => 'error', 'error' => $result['error'] ?? 'unknown'];
        }
        return [
            'status'          => 'done',
            'job_id'          => $jobId,
            'processed_at'    => $result['processed_at'] ?? null,
            'engines_used'    => $result['engines_used'] ?? [],
            'birdnet_count'   => $result['birdnet_count'] ?? 0,
            'perch_count'     => $result['perch_count'] ?? 0,
            'detections'      => $result['detections'] ?? [],
            'tier_promotions' => $result['tier_promotions'] ?? [],
            'summary'         => _buildSummary($result['detections'] ?? []),
        ];
    }

    // キューに存在するか確認
    $queueFile = $queueDir . $jobId . '.json';
    if (file_exists($queueFile)) {
        return ['status' => 'queued', 'job_id' => $jobId];
    }

    // 処理中ロック
    $lockFile = DATA_DIR . 'audio_processing/' . $jobId . '.lock';
    if (file_exists($lockFile)) {
        return ['status' => 'processing', 'job_id' => $jobId];
    }

    return ['status' => 'not_found', 'job_id' => $jobId];
}

function _buildSummary(array $detections): array
{
    $dual = $birdnetOnly = $perchOnly = $tier15 = 0;
    foreach ($detections as $d) {
        $engine = $d['engine'] ?? '';
        if ($engine === 'dual_agree') $dual++;
        elseif ($engine === 'birdnet_v2.4') $birdnetOnly++;
        elseif ($engine === 'perch_v2') $perchOnly++;
        if ($d['tier_1_5_eligible'] ?? false) $tier15++;
    }
    return [
        'total'             => count($detections),
        'dual_agree_count'  => $dual,
        'birdnet_only'      => $birdnetOnly,
        'perch_only'        => $perchOnly,
        'tier_1_5_count'    => $tier15,
    ];
}
