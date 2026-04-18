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

    if (!in_array($category, ['bug', 'improvement', 'question', 'partnership', 'deletion', 'media', 'other'], true)) {
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

    $name = mb_substr(trim($body['name'] ?? ''), 0, 100);
    $organization = mb_substr(trim($body['organization'] ?? ''), 0, 200);

    $record = [
        'id'           => $id,
        'url'          => mb_substr($body['url'] ?? '', 0, 500),
        'page_title'   => mb_substr($body['page_title'] ?? '', 0, 200),
        'category'     => $category,
        'description'  => $description,
        'name'         => $name,
        'organization' => $organization,
        'email'        => $email,
        'user_id'      => $user['id'] ?? null,
        'user_name'    => $user['display_name'] ?? 'ゲスト',
        'user_agent'   => mb_substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500),
        'viewport'     => mb_substr($body['viewport'] ?? '', 0, 20),
        'status'       => 'open',
        'created_at'   => date('c'),
    ];

    // 保存（月別パーティション）
    DataStore::append('feedback', $record);

    // SUMMARY.md 自動更新
    rebuildSummary();

    // 管理者へ通知
    sendNotification($record);

    // 送信者へ自動返信（メールアドレスがある場合のみ）
    if ($email !== '') {
        sendAutoReply($record);
    }

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

// ── 管理者へのお問い合わせ通知 ──
function sendNotification(array $r): void {
    $icons  = ['bug' => '🐛', 'improvement' => '💡', 'question' => '❓', 'partnership' => '🤝', 'deletion' => '🗑️', 'media' => '📰', 'other' => '💬'];
    $labels = ['bug' => 'バグ報告', 'improvement' => '要望・提案', 'question' => '質問', 'partnership' => '導入・連携', 'deletion' => 'データ削除', 'media' => '取材・メディア', 'other' => 'その他'];

    $icon  = $icons[$r['category']]  ?? '💬';
    $label = $labels[$r['category']] ?? 'その他';
    $to    = 'yamaki0102@gmail.com';

    $subject = mb_encode_mimeheader(
        "[ikimon] {$icon} {$label}: " . mb_substr($r['description'], 0, 40),
        'UTF-8', 'B'
    );

    $nameOrg = $r['name'] ?: ($r['user_name'] ?? 'ゲスト');
    if (!empty($r['organization'])) {
        $nameOrg .= " / {$r['organization']}";
    }

    $replyHeader = '';
    if (!empty($r['email'])) {
        $replyHeader = "Reply-To: {$r['email']}\r\n";
    }

    $body = implode("\n", [
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "  ikimon お問い合わせ通知",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        "カテゴリ : {$icon} {$label}",
        "送信者   : {$nameOrg}",
        "メール   : " . ($r['email'] ?: '未入力'),
        "日時     : {$r['created_at']}",
        "ID       : {$r['id']}",
        "",
        "─── お問い合わせ内容 ───────────────────────",
        "",
        $r['description'],
        "",
        "─── メタ情報 ───────────────────────────────",
        "",
        "ページ   : {$r['url']}",
        "ユーザー : {$r['user_name']}",
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    ]);

    $headers = "From: ikimon <noreply@ikimon.life>\r\n"
             . "Content-Type: text/plain; charset=UTF-8\r\n"
             . $replyHeader;

    $sent = mail($to, $subject, $body, $headers);
    if (!$sent) {
        error_log("feedback.php sendNotification failed id={$r['id']} to={$to}");
        DataStore::append('feedback_errors', [
            'id'         => $r['id'] ?? '',
            'kind'       => 'notification',
            'to'         => $to,
            'failed_at'  => date('c'),
        ]);
    }
}

// ── 送信者への自動返信 ──
function sendAutoReply(array $r): void {
    $icons  = ['bug' => '🐛', 'improvement' => '💡', 'question' => '❓', 'partnership' => '🤝', 'deletion' => '🗑️', 'media' => '📰', 'other' => '💬'];
    $labels = ['bug' => 'バグ報告', 'improvement' => '要望・提案', 'question' => '質問', 'partnership' => '導入・連携', 'deletion' => 'データ削除', 'media' => '取材・メディア', 'other' => 'その他'];

    $icon  = $icons[$r['category']]  ?? '💬';
    $label = $labels[$r['category']] ?? 'その他';

    $firstName = $r['name'] ? mb_substr($r['name'], 0, mb_strpos($r['name'] . ' ', ' ')) : 'お客様';

    $subject = mb_encode_mimeheader(
        '[ikimon] お問い合わせを受け付けました',
        'UTF-8', 'B'
    );

    // カテゴリ別の返信メッセージ
    $categoryNote = match($r['category']) {
        'partnership' => "導入・連携に関するご相談をいただきありがとうございます。\nご要件を確認のうえ、詳細についてあらためてご連絡いたします。",
        'media'       => "取材・メディアに関するご依頼をいただきありがとうございます。\n担当者より詳細についてご連絡いたします。",
        'deletion'    => "データ削除のリクエストをいただきありがとうございます。\n内容を確認のうえ、速やかに対応いたします。",
        'bug'         => "バグ報告をいただきありがとうございます。\n詳細を確認し、修正に向けて取り組みます。",
        default       => "お問い合わせいただきありがとうございます。\n内容を確認のうえ、ご返信いたします。",
    };

    $body = implode("\n", [
        "{$firstName} 様",
        "",
        $categoryNote,
        "",
        "通常 1〜3 営業日以内にご返信します。",
        "しばらくお待ちくださいますよう、よろしくお願いいたします。",
        "",
        "─── 受付内容 ───────────────────────────────",
        "",
        "受付番号 : {$r['id']}",
        "カテゴリ : {$icon} {$label}",
        "受付日時 : " . date('Y年m月d日 H:i', strtotime($r['created_at'])),
        "",
        "お問い合わせ内容:",
        $r['description'],
        "",
        "──────────────────────────────────────────",
        "",
        "※ このメールは自動送信です。このメールへの返信は受け付けていません。",
        "   お問い合わせは https://ikimon.life/contact.php からお願いします。",
        "",
        "ikimon 運営チーム",
        "https://ikimon.life",
    ]);

    $headers = "From: ikimon <noreply@ikimon.life>\r\n"
             . "Reply-To: noreply@ikimon.life\r\n"
             . "Content-Type: text/plain; charset=UTF-8\r\n";

    $sent = mail($r['email'], $subject, $body, $headers);
    if (!$sent) {
        error_log("feedback.php sendAutoReply failed id={$r['id']} to={$r['email']}");
        DataStore::append('feedback_errors', [
            'id'         => $r['id'] ?? '',
            'kind'       => 'auto_reply',
            'to'         => $r['email'] ?? '',
            'failed_at'  => date('c'),
        ]);
    }
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

    $icons  = ['bug' => '🐛', 'improvement' => '💡', 'question' => '❓', 'partnership' => '🤝', 'deletion' => '🗑️', 'media' => '📰', 'other' => '💬'];
    $labels = ['bug' => 'バグ', 'improvement' => '改善', 'question' => '質問', 'partnership' => '導入・連携', 'deletion' => 'データ削除', 'media' => '取材', 'other' => 'その他'];

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
                $icon  = $icons[$r['category']]  ?? '💬';
                $label = $labels[$r['category']] ?? 'その他';
                $date  = date('m/d', strtotime($r['created_at']));
                $user  = $r['name'] ?: ($r['user_name'] ?? 'ゲスト');
                $desc  = mb_substr($r['description'], 0, 80);
                $md   .= "- [{$r['id']}] {$icon} {$label}: {$desc} ({$user}, {$date})\n";
            }
            $md .= "\n";
        }
    }

    $md .= "## 対応済み (" . count($done) . "件)\n\n";
    if (empty($done)) {
        $md .= "なし\n";
    } else {
        foreach ($done as $r) {
            $icon  = $icons[$r['category']]  ?? '💬';
            $label = $labels[$r['category']] ?? 'その他';
            $date  = date('m/d', strtotime($r['created_at']));
            $url   = $r['url'] ?? '';
            $desc  = mb_substr($r['description'], 0, 80);
            $md   .= "- [{$r['id']}] ✅ {$url} {$icon} {$label}: {$desc} ({$date})\n";
        }
    }

    file_put_contents($dir . '/SUMMARY.md', $md, LOCK_EX);
}
