<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/Lang.php';
Auth::init();
Lang::init();

http_response_code(404);

$meta_title = "ページが見つかりません";
$meta_description = "お探しのページは見つかりませんでした。";
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
            <!-- Animated 404 Icon -->
            <div class="relative w-32 h-32 mx-auto mb-8">
                <div class="absolute inset-0 bg-primary-surface rounded-full animate-pulse"></div>
                <div class="absolute inset-0 flex items-center justify-center">
                    <i data-lucide="search-x" class="w-16 h-16 text-primary opacity-60"></i>
                </div>
            </div>

            <h1 class="text-5xl font-heading font-black text-text mb-2">404</h1>
            <h2 class="text-xl font-bold text-text mb-3">ページが見つかりません</h2>
            <p class="text-muted text-sm leading-relaxed mb-8">
                お探しのページは移動したか、削除された可能性があります。<br>
                URLが正しいか確認してみてね。
            </p>

            <!-- Helpful Navigation -->
            <div class="space-y-3">
                <a href="index.php"
                    class="block w-full py-3 rounded-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold text-center shadow-lg shadow-primary/20 active:scale-95 transition">
                    <i data-lucide="home" class="w-4 h-4 inline mr-1"></i>
                    ホームに戻る
                </a>
                <div class="flex gap-3">
                    <a href="explore.php"
                        class="flex-1 py-3 rounded-full bg-surface border border-border text-text font-bold text-sm text-center hover:bg-white/80 transition">
                        🔍 観察を探す
                    </a>
                    <a href="post.php"
                        class="flex-1 py-3 rounded-full bg-surface border border-border text-text font-bold text-sm text-center hover:bg-white/80 transition">
                        📸 投稿する
                    </a>
                </div>
            </div>

            <!-- Fun Fact -->
            <div class="mt-10 p-4 bg-primary-surface border border-primary-glow rounded-2xl">
                <p class="text-xs text-primary font-bold mb-1">🌿 ikimon 豆知識</p>
                <p class="text-xs text-muted leading-relaxed">
                    <?php
                    $facts = [
                        "日本には約9万種の生物が確認されていて、うち約4万種は固有種だよ。",
                        "カタツムリには約1万2千本の歯があるって知ってた？",
                        "タンポポは1つの花に見えるけど、実は100〜200の小さな花の集まりだよ。",
                        "ミツバチは1kgのハチミツを作るのに約560万回花を訪れるんだって。",
                        "ナマケモノは1日に葉っぱ8gしか食べないよ。究極のエコ生活！",
                    ];
                    echo $facts[array_rand($facts)];
                    ?>
                </p>
            </div>
        </div>
    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>

</html>