<?php
require_once __DIR__ . '/../config/config.php';
$meta_title = 'アプリに戻っています';
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>
<body class="min-h-screen flex items-center justify-center px-6" style="background:var(--md-surface);color:var(--md-on-surface);">
    <main class="max-w-md w-full rounded-3xl border border-border bg-surface p-8 text-center shadow-sm">
        <h1 class="text-2xl font-black mb-3">アプリに戻っています</h1>
        <p class="text-sm text-faint leading-7 mb-6">
            ベータ版アプリが開かない場合は、ikimon アプリを開き直してください。
        </p>
        <a href="/" class="btn-primary inline-flex justify-center">ブラウザ版を開く</a>
    </main>
</body>
</html>

