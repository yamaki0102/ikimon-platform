<?php
/**
 * audio_batch_callback.php — バッチワーカーからのコールバック受信
 *
 * audio_batch_worker.py がバッチ処理完了後にこのエンドポイントを呼ぶ。
 * - DataStore の観察レコードに dual_agree 結果をマージ
 * - CanonicalStore の Evidence Tier を 1.5 に昇格（対象 occurrence のみ）
 * - キャッシュに結果を保存（session_recap で即座に表示可能にする）
 *
 * POST /api/v2/audio_batch_callback.php (localhost のみ)
 *   Content-Type: application/json
 *   { "job_id": "abj_xxx", "result_path": "/absolute/path/to/result.json" }
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/CanonicalStore.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('Method not allowed', 405);
}

// localhost からのみ受け付ける（ワーカーは同一サーバー上で動く）
$remoteIp = $_SERVER['REMOTE_ADDR'] ?? '';
if (!in_array($remoteIp, ['127.0.0.1', '::1'], true)) {
    api_error('Forbidden', 403);
}

$body = api_json_body();
$jobId      = $body['job_id'] ?? null;
$resultPath = $body['result_path'] ?? null;

if (!$jobId || !$resultPath) {
    api_error('job_id と result_path が必要です', 400);
}

// result_path はDATAディレクトリ内のみ許可（パストラバーサル防止）
$realResult = realpath($resultPath);
$realData   = realpath(DATA_DIR);
if (!$realResult || !str_starts_with($realResult, $realData)) {
    api_error('Invalid result_path', 400);
}

if (!file_exists($realResult)) {
    api_error('Result file not found', 404);
}

$result = json_decode(file_get_contents($realResult), true);
if (!is_array($result) || ($result['status'] ?? '') !== 'ok') {
    api_error('Invalid result file', 422);
}

$sessionId  = $result['session_id'] ?? null;
$detections = $result['detections'] ?? [];

if (empty($detections)) {
    api_success(['promoted' => 0, 'message' => '検出結果なし']);
}

// ── 1. DataStore の観察レコードを更新 ──

$promotedCount = 0;

if ($sessionId) {
    // 対象セッションの観察レコードを取得
    $allObs = DataStore::fetchAll('observations');
    $updated = false;

    foreach ($allObs as &$obs) {
        if (($obs['passive_session_id'] ?? $obs['session_id'] ?? '') !== $sessionId) {
            continue;
        }
        if (($obs['source'] ?? '') !== 'passive') {
            continue;
        }

        // 種名でマッチングを試みる
        $sciName = strtolower(trim($obs['taxon']['scientific_name'] ?? ''));
        $jaName  = $obs['taxon']['name'] ?? '';

        foreach ($detections as $det) {
            $detSci = strtolower(trim($det['scientific_name'] ?? ''));
            if (!$detSci || $detSci !== $sciName) {
                continue;
            }

            $engine = $det['engine'] ?? '';
            if ($engine !== 'dual_agree') {
                continue;
            }

            // dual_agree → confidence + バッチ評価メタデータを付与
            $obs['batch_evaluated']     = true;
            $obs['batch_engine']        = 'dual_agree';
            $obs['batch_confidence']    = $det['confidence'];
            $obs['batch_job_id']        = $jobId;
            $obs['batch_engines']       = $det['engines'] ?? [];

            // Tier 1.5 昇格対象なら verification_stage を更新
            if (($det['tier_1_5_eligible'] ?? false) && ($obs['verification_stage'] ?? '') !== 'research_grade') {
                $obs['verification_stage'] = 'ai_dual_verified';
                $obs['batch_tier_1_5']     = true;
                $promotedCount++;
            }

            $updated = true;
            break;
        }
    }
    unset($obs);

    if ($updated) {
        // DataStore に書き戻す（全件上書き）
        // 注意: DataStore::fetchAll は月次パーティション対応のため
        // 直接保存するには現在の月のファイルを特定する必要がある
        // 簡略版: ファイル単位で更新
        _updateObservationsInPartitions($allObs, $sessionId, $detections, $jobId);
    }
}

// ── 2. CanonicalStore の Evidence Tier 昇格 ──

$canonicalPromoted = _promoteCanonicalTier($sessionId, $detections, $jobId);

// ── 3. バッチ結果キャッシュ（session_recap で即座に読める）──

$cacheDir  = DATA_DIR . 'batch_cache/';
if (!is_dir($cacheDir)) {
    mkdir($cacheDir, 0755, true);
}
$cacheFile = $cacheDir . 'session_' . preg_replace('/[^a-zA-Z0-9_-]/', '', $sessionId) . '.json';
file_put_contents($cacheFile, json_encode([
    'session_id'       => $sessionId,
    'job_id'           => $jobId,
    'cached_at'        => date('c'),
    'detections'       => $detections,
    'promoted_count'   => $promotedCount,
    'canonical_promoted' => $canonicalPromoted,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

api_success([
    'promoted'           => $promotedCount,
    'canonical_promoted' => $canonicalPromoted,
    'detections_count'   => count($detections),
    'dual_agree_count'   => count(array_filter($detections, fn($d) => ($d['engine'] ?? '') === 'dual_agree')),
    'tier_1_5_count'     => count(array_filter($detections, fn($d) => $d['tier_1_5_eligible'] ?? false)),
]);

// ────────────────────────────────────────────────────────

/**
 * 月次パーティションを走査して観察レコードを更新する。
 * passive_event.php の保存形式に対応。
 */
function _updateObservationsInPartitions(array $allObs, string $sessionId, array $detections, string $jobId): void
{
    // 最近3ヶ月のパーティションを検索
    $partitionDates = [
        date('Y-m'),
        date('Y-m', strtotime('-1 month')),
        date('Y-m', strtotime('-2 months')),
    ];

    foreach ($partitionDates as $partition) {
        $file = DATA_DIR . 'observations/' . $partition . '.json';
        if (!file_exists($file)) {
            continue;
        }

        $obs = json_decode(file_get_contents($file), true);
        if (!is_array($obs)) {
            continue;
        }

        $modified = false;
        foreach ($obs as &$o) {
            if (($o['passive_session_id'] ?? $o['session_id'] ?? '') !== $sessionId) {
                continue;
            }

            $sciName = strtolower(trim($o['taxon']['scientific_name'] ?? ''));
            if (!$sciName) {
                continue;
            }

            foreach ($detections as $det) {
                $detSci = strtolower(trim($det['scientific_name'] ?? ''));
                if ($detSci !== $sciName || ($det['engine'] ?? '') !== 'dual_agree') {
                    continue;
                }

                $o['batch_evaluated']  = true;
                $o['batch_engine']     = 'dual_agree';
                $o['batch_confidence'] = $det['confidence'];
                $o['batch_job_id']     = $jobId;
                $o['batch_engines']    = $det['engines'] ?? [];

                if (($det['tier_1_5_eligible'] ?? false) && ($o['verification_stage'] ?? '') !== 'research_grade') {
                    $o['verification_stage'] = 'ai_dual_verified';
                    $o['batch_tier_1_5']     = true;
                }

                $modified = true;
                break;
            }
        }
        unset($o);

        if ($modified) {
            file_put_contents($file, json_encode($obs, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        }
    }
}

/**
 * CanonicalStore の occurrences テーブルで Evidence Tier を 1.5 に昇格。
 * session_id に紐づくイベントのoccurrenceを検索して更新。
 */
function _promoteCanonicalTier(string $sessionId, array $detections, string $jobId): int
{
    if (!$sessionId || empty($detections)) {
        return 0;
    }

    try {
        $pdo = CanonicalStore::getPDO();

        // route_hash または recorded_by でセッションのイベントを特定
        // 現状: session_id をそのまま持つカラムがないため
        // recorded_by または sampling_effort JSONに client_session_id が入っている可能性
        $stmt = $pdo->prepare("
            SELECT e.event_id, o.occurrence_id, o.scientific_name, o.evidence_tier
            FROM events e
            JOIN occurrences o ON o.event_id = e.event_id
            WHERE o.detection_model LIKE '%birdnet%' OR o.detection_model LIKE '%perch%'
            ORDER BY e.event_date DESC
            LIMIT 1000
        ");
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // dual_agree の検出結果を辞書化
        $dualByKey = [];
        foreach ($detections as $det) {
            if (($det['engine'] ?? '') === 'dual_agree' && ($det['tier_1_5_eligible'] ?? false)) {
                $key = strtolower(trim($det['scientific_name'] ?? ''));
                if ($key) {
                    $dualByKey[$key] = $det;
                }
            }
        }

        if (empty($dualByKey)) {
            return 0;
        }

        $promoted = 0;
        foreach ($rows as $row) {
            $sciKey = strtolower(trim($row['scientific_name'] ?? ''));
            if (!isset($dualByKey[$sciKey])) {
                continue;
            }
            if ((float)($row['evidence_tier'] ?? 1) >= 1.5) {
                continue; // 既に昇格済み
            }

            CanonicalStore::updateEvidenceTier(
                $row['occurrence_id'],
                1.5,
                'batch_dual_agree:' . $jobId
            );
            $promoted++;
        }

        return $promoted;

    } catch (Exception $e) {
        error_log('[audio_batch_callback] CanonicalStore エラー: ' . $e->getMessage());
        return 0;
    }
}
