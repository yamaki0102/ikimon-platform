<?php
/**
 * Feedback API
 * POST: ユーザーからのバグ・改善報告を保存
 * GET:  フィードバック一覧取得（Admin専用）
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';

Auth::init();

header('Content-Type: application/json; charset=utf-8');

function respond($ok, $msg, $data = null) {
    echo json_encode(['ok' => $ok, 'message' => $msg, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── POST: フィードバック保存 ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    // CSRF
    require_once __DIR__ . '/../../libs/CSRF.php';
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    if (!CSRF::validate($body['csrf_token'] ?? '')) {
        respond(false, 'セキュリティトークンが無効です');
    }

    // バリデーション
    $category = $body['category'] ?? '';
    $description = trim($body['description'] ?? '');

    if (!in_array($category, ['bug', 'improvement', 'question', 'deletion', 'other'], true)) {
        respond(false, 'カテゴリが不正です');
    }
    if ($description === '' || mb_strlen($description) > 2000) {
        respond(false, '説明を入力してください（2000文字以内）');
    }

    // レコード構築
    $user = Auth::user();
    $id = 'fb_' . time() . '_' . bin2hex(random_bytes(3));

    $email = trim($body['email'] ?? '');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $email = '';
    }

    $record = [
        'id'         => $id,
        'url'        => mb_substr($body['url'] ?? '', 0, 500),
        'page_title' => mb_substr($body['page_title'] ?? '', 0, 200),
        'category'   => $category,
        'description'=> $description,
        'email'      => $email,
        'user_id'    => $user['id'] ?? null,
        'user_name'  => $user['display_name'] ?? 'ゲスト',
        'user_agent' => mb_substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500),
        'viewport'   => mb_substr($body['viewport'] ?? '', 0, 20),
        'status'     => 'open',
        'created_at' => date('c'),
    ];

    // 保存（月別パーティション）
    DataStore::append('feedback', $record);

    // SUMMARY.md 自動更新
    rebuildSummary();

    // メール通知
    sendNotification($record);

    respond(true, 'フィードバックを送信しました', ['id' => $id]);
}

// ── GET: 一覧取得（Admin専用） ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!Auth::hasRole('Admin')) {
        http_response_code(403);
        respond(false, '権限がありません');
    }

    $all = [];
    $dir = DATA_DIR . '/feedback';
    if (is_dir($dir)) {
        foreach (glob($dir . '/????-??.json') as $file) {
            $data = json_decode(file_get_contents($file), true) ?: [];
            $all = array_merge($all, $data);
        }
    }

    // 新しい順
    usort($all, fn($a, $b) => strcmp($b['created_at'], $a['created_at']));

    respond(true, 'ok', $all);
}

respond(false, 'Invalid method');

// ── メール通知 ──
function sendNotification(array $r): void {
    $icons  = ['bug' => '🐛', 'improvement' => '💡', 'question' => '❓', 'deletion' => '🗑️', 'other' => '💬'];
    $labels = ['bug' => 'バグ', 'improvement' => '改善', 'question' => '質問', 'deletion' => 'データ削除', 'other' => 'その他'];

    $icon  = $icons[$r['category']]  ?? '💬';
    $label = $labels[$r['category']] ?? 'その他';
    $to    = 'yamaki0102@gmail.com';
    $subject = mb_encode_mimeheader(
        "[ikimon] {$icon} {$label}: " . mb_substr($r['description'], 0, 40),
        'UTF-8', 'B'
    );

    $body = implode("\n", [
        "フィードバックが届きました",
        str_repeat('-', 40),
        "ID       : {$r['id']}",
        "カテゴリ : {$icon} {$label}",
        "内容     : {$r['description']}",
        "ページ   : {$r['url']}",
        "メール   : " . ($r['email'] ?: '未入力'),
        "ユーザー : {$r['user_name']}",
        "日時     : {$r['created_at']}",
    ]);

    $headers = implode("\r\n", [
        'From: ikimon <noreply@ikimon.life>',
        'Content-Type: text/plain; charset=UTF-8',
    ]);

    @mail($to, $subject, $body, $headers);
}

// ── SUMMARY.md 再構築 ──
function rebuildSummary() {
    $dir = DATA_DIR . '/feedback';
    if (!is_dir($dir)) return;

    $all = [];
    foreach (glob($dir . '/????-??.json') as $file) {
        $data = json_decode(file_get_contents($file), true) ?: [];
        $all = array_merge($all, $data);
    }

    usort($all, fn($a, $b) => strcmp($b['created_at'], $a['created_at']));

    $icons = ['bug' => "\xF0\x9F\x90\x9B", 'improvement' => "\xF0\x9F\x92\xA1", 'question' => "\xE2\x9D\x93", 'deletion' => "\xF0\x9F\x97\x91", 'other' => "\xF0\x9F\x92\xAC"];
    $labels = ['bug' => 'バグ', 'improvement' => '改善', 'question' => '質問', 'deletion' => 'データ削除', 'other' => 'その他'];

    $open = array_filter($all, fn($r) => ($r['status'] ?? 'open') === 'open');
    $done = array_filter($all, fn($r) => ($r['status'] ?? 'open') !== 'open');

    // ページ別にグループ化
    $byPage = [];
    foreach ($open as $r) {
        $url = $r['url'] ?? '/unknown';
        $byPage[$url][] = $r;
    }
    ksort($byPage);

    $md = "# フィードバックサマリー（自動生成）\n";
    $md .= "最終更新: " . date('Y-m-d H:i') . "\n\n";

    $md .= "## 未対応 (" . count($open) . "件)\n\n";
    if (empty($open)) {
        $md .= "なし\n\n";
    } else {
        foreach ($byPage as $url => $records) {
            $md .= "### {$url} (" . count($records) . "件)\n";
            foreach ($records as $r) {
                $icon = $icons[$r['category']] ?? '💬';
                $label = $labels[$r['category']] ?? 'その他';
                $date = date('m/d', strtotime($r['created_at']));
                $user = $r['user_name'] ?? 'ゲスト';
                $desc = mb_substr($r['description'], 0, 80);
                $md .= "- [{$r['id']}] {$icon} {$label}: {$desc} ({$user}, {$date})\n";
            }
            $md .= "\n";
        }
    }

    $md .= "## 対応済み (" . count($done) . "件)\n\n";
    if (empty($done)) {
        $md .= "なし\n";
    } else {
        foreach ($done as $r) {
            $icon = $icons[$r['category']] ?? '💬';
            $label = $labels[$r['category']] ?? 'その他';
            $date = date('m/d', strtotime($r['created_at']));
            $url = $r['url'] ?? '';
            $desc = mb_substr($r['description'], 0, 80);
            $md .= "- [{$r['id']}] ✅ {$url} {$icon} {$label}: {$desc} ({$date})\n";
        }
    }

    file_put_contents($dir . '/SUMMARY.md', $md, LOCK_EX);
}
