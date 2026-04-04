<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/Lang.php';
Auth::init();
Lang::init();

http_response_code(403);

$meta_title = "アクセスできません";
$meta_description = "このページへのアクセス権限がありません。";
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>

<body class="bg-base text-text font-body min-h-screen flex flex-col">
    <?php include __DIR__ . '/components/nav.php'; ?>

    <main class="flex-1 flex items-center justify-center px-4 py-20">
        <div class="text-center max-w-md mx-auto">
            <!-- Animated 403 Icon -->
            <div class="relative w-32 h-32 mx-auto mb-8">
                <div class="absolute inset-0 bg-accent-surface rounded-full animate-pulse"></div>
                <div class="absolute inset-0 flex items-center justify-center">
                    <i data-lucide="shield-alert" class="w-16 h-16 text-accent opacity-60"></i>
                </div>
            </div>

            <h1 class="text-5xl font-heading font-black text-text mb-2">403</h1>
            <h2 class="text-xl font-bold text-text mb-3">アクセスできません</h2>
            <p class="text-muted text-sm leading-relaxed mb-8">
                このページにアクセスする権限がないみたい。<br>
                ログインが必要かもしれないよ。
            </p>

            <!-- Helpful Navigation -->
            <div class="space-y-3">
                <?php if (!Auth::isLoggedIn()): ?>
                    <a href="login.php"
                        class="block w-full py-3 rounded-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold text-center shadow-lg shadow-primary/20 active:scale-95 transition">
                        <i data-lucide="log-in" class="w-4 h-4 inline mr-1"></i>
                        ログインする
                    </a>
                <?php endif; ?>
                <a href="index.php"
                    class="block w-full py-3 rounded-full bg-surface border border-border text-text font-bold text-sm text-center hover:bg-white/80 transition">
                    <i data-lucide="home" class="w-4 h-4 inline mr-1"></i>
                    ホームに戻る
                </a>
            </div>
        </div>
    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>

</html>