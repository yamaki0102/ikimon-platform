<?php
/**
 * audio_batch_submit.php — 音声バッチ評価キュー登録
 *
 * セッション終了後に LiveScanner.js から呼ばれる。
 * リアルタイム推論では拾えなかった音声スニペットを
 * BirdNET v2.4 + Perch V2 のバッチパイプラインに投入する。
 *
 * POST /api/v2/audio_batch_submit.php
 *   multipart/form-data:
 *     audio      : 音声ファイル (webm/mp4/wav, max 5MB)
 *     session_id : サーバー側セッションID
 *     lat        : 緯度
 *     lng        : 経度
 *
 * Response:
 *   { success: true, data: { job_id, status: "queued" } }
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('Method not allowed', 405);
}

Auth::init();

// FieldScan install_id または ログインセッション
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

if (!api_rate_limit('audio_batch_submit', 60, 60)) {
    api_error('Rate limit exceeded', 429);
}

// ── 音声ファイルバリデーション ──

if (!isset($_FILES['audio']) || $_FILES['audio']['error'] !== UPLOAD_ERR_OK) {
    api_error('No audio file', 400);
}

$file = $_FILES['audio'];
if ($file['size'] > 5 * 1024 * 1024) {
    api_error('Audio too large (max 5MB)', 413);
}

$finfo       = finfo_open(FILEINFO_MIME_TYPE);
$mimeDetected = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

$allowedMimes = ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mpeg', 'video/webm', 'application/octet-stream'];
if (!in_array($mimeDetected, $allowedMimes, true)) {
    api_error('Invalid audio format: ' . $mimeDetected, 415);
}

$sessionId = $_POST['session_id'] ?? null;
$lat       = (float)($_POST['lat'] ?? 35.0);
$lng       = (float)($_POST['lng'] ?? 139.0);

// ── キューディレクトリ ──

$queueDir = DATA_DIR . 'audio_queue/';
$audioDir = DATA_DIR . 'audio_snippets/';

foreach ([$queueDir, $audioDir] as $dir) {
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
}

// ── 音声ファイル保存 ──

$ext      = in_array($mimeDetected, ['audio/mp4', 'video/webm'], true) ? '.mp4' : '.webm';
$audioId  = bin2hex(random_bytes(8));
$audioFile = $audioDir . $audioId . $ext;

if (!move_uploaded_file($file['tmp_name'], $audioFile)) {
    api_error('Failed to save audio file', 500);
}

// ── ジョブ登録 ──

$jobId  = 'abj_' . bin2hex(random_bytes(8));
$job    = [
    'job_id'     => $jobId,
    'audio_id'   => $audioId,
    'audio_path' => $audioFile,
    'session_id' => $sessionId,
    'user_id'    => $userId,
    'lat'        => $lat,
    'lng'        => $lng,
    'queued_at'  => date('c'),
    'status'     => 'queued',
];

$jobFile = $queueDir . $jobId . '.json';
file_put_contents($jobFile, json_encode($job, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

api_success([
    'job_id'    => $jobId,
    'audio_id'  => $audioId,
    'status'    => 'queued',
    'message'   => 'バッチ評価キューに登録しました。数分以内に結果が利用可能になります。',
]);
