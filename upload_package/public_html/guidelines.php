<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php 
    $meta_title = "コミュニティガイドライン";
    include __DIR__ . '/components/meta.php'; 
    ?>
</head>
<body class="bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">
    <?php include('components/nav.php'); ?>

    <main class="max-w-4xl mx-auto px-6 py-20 pb-32">
        <header class="mb-20 text-center">
            <span class="inline-block px-4 py-1 rounded-full bg-white/5 border border-white/10 text-[var(--color-primary)] text-xs font-bold uppercase tracking-widest mb-6">Values & Rules</span>
            <h1 class="text-4xl md:text-6xl font-black mb-6">Community Guidelines</h1>
            <p class="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                ikimonは、自然を愛するすべての人々のための場所です。<br>
                安全で快適な探究の旅のために、以下の指針を大切にしています。
            </p>
        </header>

        <section class="space-y-24">
            <!-- 1. Authenticity -->
            <div class="glass-card p-10 rounded-3xl border-white/5 relative overflow-hidden">
                <div class="absolute -right-10 -top-10 w-64 h-64 bg-green-500/10 rounded-full blur-3xl"></div>
                <div class="relative z-10 flex gap-8 flex-col md:flex-row">
                    <div class="w-16 h-16 rounded-2xl bg-green-500/20 text-green-500 flex items-center justify-center shrink-0">
                        <i data-lucide="camera" class="w-8 h-8"></i>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold mb-4">誠実な記録を</h2>
                        <ul class="space-y-4 text-gray-300 leading-relaxed list-disc list-inside marker:text-green-500">
                            <li>あなた自身が撮影・録音したデータのみを投稿してください。</li>
                            <li>位置情報や日時は正確に記録しましょう。意図的な偽装は研究データの価値を損ないます。</li>
                            <li>飼育・栽培されている生き物は「野生ではない」と明記しましょう。</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- 2. Respect -->
            <div class="glass-card p-10 rounded-3xl border-white/5 relative overflow-hidden">
                 <div class="absolute -left-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div class="relative z-10 flex gap-8 flex-col md:flex-row">
                    <div class="w-16 h-16 rounded-2xl bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                        <i data-lucide="heart-handshake" class="w-8 h-8"></i>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold mb-4">互いを尊重しよう</h2>
                        <ul class="space-y-4 text-gray-300 leading-relaxed list-disc list-inside marker:text-blue-500">
                            <li>名前の提案やコメントは、建設的で敬意を持った言葉で行いましょう。</li>
                            <li>初心者には優しくサポートし、知識を分かち合いましょう。</li>
                            <li>差別的、攻撃的な言動は一切容認されません。</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- 3. Nature First -->
            <div class="glass-card p-10 rounded-3xl border-white/5 relative overflow-hidden">
                 <div class="absolute inset-0 bg-yellow-500/5"></div>
                <div class="relative z-10 flex gap-8 flex-col md:flex-row">
                    <div class="w-16 h-16 rounded-2xl bg-yellow-500/20 text-yellow-500 flex items-center justify-center shrink-0">
                        <i data-lucide="sprout" class="w-8 h-8"></i>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold mb-4">自然への配慮</h2>
                        <ul class="space-y-4 text-gray-300 leading-relaxed list-disc list-inside marker:text-yellow-500">
                            <li>観察のために生き物を傷つけたり、生息地を荒らしたりしないでください。</li>
                            <li>希少種の場所は公開範囲を制限するなど、保護に努めましょう。</li>
                            <li>私有地への無断立ち入りは禁止です。</li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>

        <div class="mt-20 text-center">
            <p class="text-gray-500 mb-8">このガイドラインに違反するコンテンツを見つけた場合は、通報機能を使用してください。</p>
            <a href="index.php" class="btn-primary inline-flex items-center gap-2">
                同意して探索を続ける
                <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </a>
        </div>
    </main>

    <footer class="border-t border-white/5 text-center py-12">
        <p class="text-[var(--color-text-muted)] text-sm">&copy; 2024 ikimon. All rights reserved.</p>
    </footer>

    <script>
        lucide.createIcons();
    </script>
</body>
</html>
