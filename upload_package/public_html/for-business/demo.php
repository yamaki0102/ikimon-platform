<?php

/**
 * B2B Demo Page — 愛管HQダッシュボード 読み取り専用デモ
 * 
 * site_dashboard.php のデモモードへリダイレクト。
 * 実際のダッシュボード画面を読み取り専用で体験可能。
 */
require_once __DIR__ . '/../../config/config.php';

// デモ用サイトID — data/sites/{site_id}/meta.json 構造から検出
$demoSiteId = null;
$sitesDir = DATA_DIR . '/sites';
if (is_dir($sitesDir)) {
    $dirs = glob($sitesDir . '/*/meta.json');
    if (!empty($dirs)) {
        $demoSiteId = basename(dirname($dirs[0]));
    }
}

if ($demoSiteId) {
    header('Location: ../site_dashboard.php?site=' . urlencode($demoSiteId) . '&demo=1');
    exit;
}

// フォールバック: サイトデータがない場合
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>デモ準備中 | ikimon for Business</title>
    <link rel="icon" type="image/png" sizes="32x32" href="../assets/img/favicon-32.png">
    <style>
        body {
            font-family: 'Noto Sans JP', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: #f8faf9;
            color: #1a2e1f;
            text-align: center;
        }

        .msg {
            max-width: 420px;
            padding: 40px;
        }

        .msg h1 {
            font-size: 24px;
            margin-bottom: 12px;
        }

        .msg p {
            font-size: 14px;
            color: #6b7280;
            line-height: 1.8;
        }

        .msg a {
            display: inline-block;
            margin-top: 20px;
            padding: 10px 24px;
            background: #10b981;
            color: white;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 700;
            font-size: 14px;
        }
    </style>
</head>

<body>
    <div class="msg">
        <h1>🔧 デモ準備中</h1>
        <p>現在デモ用サイトデータを準備しています。<br>少々お待ちください。</p>
        <a href="index.php">← ikimon for Business に戻る</a>
    </div>
</body>

</html>