<?php

/**
 * API v2 Bootstrap — 共通初期化
 *
 * 全 v2 エンドポイントの先頭で require する。
 * - config 読み込み
 * - JSON レスポンスヘッダー
 * - CORS 設定
 * - 共通ヘルパー関数
 */

require_once __DIR__ . '/../../../config/config.php';

// --- ヘッダー ---
header('Content-Type: application/json; charset=utf-8');
header('X-API-Version: 2.0');

// CORS（同一ドメイン + localhost 開発用）
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = ['https://ikimon.life', 'http://localhost:8899'];
if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
}

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- 共通ヘルパー ---

/**
 * 成功レスポンスを返して終了する。
 *
 * @param mixed $data    レスポンスデータ
 * @param array $meta    追加メタ情報
 */
function api_success($data, array $meta = []): never
{
    $response = [
        'success' => true,
        'data'    => $data,
        'meta'    => array_merge([
            'api_version' => '2.0',
            'timestamp'   => date('c'),
        ], $meta),
    ];
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

/**
 * エラーレスポンスを返して終了する。
 *
 * @param string $message  エラーメッセージ
 * @param int    $code     HTTP ステータスコード
 * @param array  $details  追加詳細
 */
function api_error(string $message, int $code = 400, array $details = []): never
{
    http_response_code($code);
    $response = [
        'success' => false,
        'error'   => [
            'message' => $message,
            'code'    => $code,
        ],
    ];
    if (!empty($details)) {
        $response['error']['details'] = $details;
    }
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

/**
 * GETパラメータを型安全に取得する。
 *
 * @param string $key      パラメータ名
 * @param mixed  $default  デフォルト値
 * @param string $type     期待する型 ('string', 'int', 'float', 'bool')
 * @return mixed
 */
function api_param(string $key, $default = null, string $type = 'string')
{
    $value = $_GET[$key] ?? $default;
    if ($value === null) return null;

    return match ($type) {
        'int'    => (int) $value,
        'float'  => (float) $value,
        'bool'   => filter_var($value, FILTER_VALIDATE_BOOLEAN),
        default  => (string) $value,
    };
}

/**
 * POST JSON ボディをパースする。
 *
 * @return array
 */
function api_json_body(): array
{
    $body = file_get_contents('php://input');
    if (empty($body)) return [];
    $decoded = json_decode($body, true);
    return is_array($decoded) ? $decoded : [];
}

/**
 * レート制限チェック（セッションベース）。
 *
 * @param string $key        リミットキー
 * @param int    $maxRequests 最大リクエスト数
 * @param int    $windowSec   ウィンドウ秒数
 * @return bool 制限内なら true
 */
function api_rate_limit(string $key = 'default', int $maxRequests = 60, int $windowSec = 60): bool
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        @session_start();
    }

    $storeKey = "rate_limit_{$key}";
    $now = time();

    if (!isset($_SESSION[$storeKey])) {
        $_SESSION[$storeKey] = ['count' => 0, 'window_start' => $now];
    }

    $rl = &$_SESSION[$storeKey];

    // ウィンドウリセット
    if ($now - $rl['window_start'] > $windowSec) {
        $rl = ['count' => 0, 'window_start' => $now];
    }

    $rl['count']++;

    if ($rl['count'] > $maxRequests) {
        return false;
    }

    return true;
}
