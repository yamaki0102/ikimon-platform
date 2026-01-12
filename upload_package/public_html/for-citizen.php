<?php
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>市民の方へ - ikimon</title>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>
<body class="js-loading bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">

    <?php include __DIR__ . '/components/nav.php'; ?>
    <script>document.body.classList.remove('js-loading');</script>

    <!-- Hero Section -->
    <section class="pt-32 pb-16 px-6">
        <div class="max-w-4xl mx-auto text-center">
            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/30 backdrop-blur-md mb-6">
                <i data-lucide="users" class="w-4 h-4 text-green-400"></i>
                <span class="text-xs font-bold tracking-wider uppercase text-green-400">For Citizens</span>
            </div>
            <h1 class="text-4xl md:text-6xl font-black mb-6 tracking-tight">
                あなたの<span class="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">発見</span>が、<br>
                未来の自然を守る
            </h1>
            <p class="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
                散歩中に見つけた花、庭に来た鳥、子どもと捕まえた虫。<br>
                写真を撮って投稿するだけで、あなたも「市民科学者」に。
            </p>
            <a href="post.php" class="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4">
                <i data-lucide="camera"></i>
                今すぐ投稿する
            </a>
        </div>
    </section>

    <!-- Benefits Section -->
    <section class="py-16 px-6 bg-gradient-to-b from-transparent to-green-500/5">
        <div class="max-w-5xl mx-auto">
            <h2 class="text-2xl font-bold text-center mb-12">ikimonでできること</h2>
            
            <div class="grid md:grid-cols-3 gap-8">
                <!-- Benefit 1 -->
                <div class="glass-card p-8 rounded-2xl border border-white/10 text-center">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-green-500/20 flex items-center justify-center">
                        <i data-lucide="camera" class="w-8 h-8 text-green-400"></i>
                    </div>
                    <h3 class="text-xl font-bold mb-2">撮って投稿</h3>
                    <p class="text-gray-400 text-sm">
                        名前がわからなくてもOK。<br>
                        写真を撮るだけで始められます。
                    </p>
                </div>

                <!-- Benefit 2 -->
                <div class="glass-card p-8 rounded-2xl border border-white/10 text-center">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                        <i data-lucide="graduation-cap" class="w-8 h-8 text-purple-400"></i>
                    </div>
                    <h3 class="text-xl font-bold mb-2">専門家が教える</h3>
                    <p class="text-gray-400 text-sm">
                        専門家ネットワークが<br>
                        生き物の名前を教えてくれます。
                    </p>
                </div>

                <!-- Benefit 3 -->
                <div class="glass-card p-8 rounded-2xl border border-white/10 text-center">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                        <i data-lucide="map" class="w-8 h-8 text-blue-400"></i>
                    </div>
                    <h3 class="text-xl font-bold mb-2">地図で見える化</h3>
                    <p class="text-gray-400 text-sm">
                        あなたの発見が地図に載り、<br>
                        みんなで自然を記録します。
                    </p>
                </div>
            </div>
        </div>
    </section>

    <!-- How It Works -->
    <section class="py-16 px-6">
        <div class="max-w-4xl mx-auto">
            <h2 class="text-2xl font-bold text-center mb-12">使い方は簡単</h2>
            
            <div class="space-y-8">
                <div class="flex items-start gap-6">
                    <div class="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-black font-black text-xl shrink-0">1</div>
                    <div>
                        <h3 class="text-xl font-bold mb-2">見つけたら撮影</h3>
                        <p class="text-gray-400">散歩中、庭先、公園で。スマホで撮るだけでOK。</p>
                    </div>
                </div>
                <div class="flex items-start gap-6">
                    <div class="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-black font-black text-xl shrink-0">2</div>
                    <div>
                        <h3 class="text-xl font-bold mb-2">アップロード</h3>
                        <p class="text-gray-400">位置情報と日時は自動入力。写真を選ぶだけ。</p>
                    </div>
                </div>
                <div class="flex items-start gap-6">
                    <div class="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-black font-black text-xl shrink-0">3</div>
                    <div>
                        <h3 class="text-xl font-bold mb-2">名前がわかる</h3>
                        <p class="text-gray-400">専門家が回答。図鑑が完成していきます。</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- CTA Section -->
    <section class="py-16 px-6">
        <div class="max-w-2xl mx-auto text-center glass-card p-12 rounded-[2rem] border border-green-500/30">
            <h2 class="text-3xl font-black mb-4">今日から始めよう</h2>
            <p class="text-gray-400 mb-8">
                登録不要でも投稿できます。<br>
                まずは身近な生き物を1つ撮ってみましょう。
            </p>
            <div class="flex flex-col md:flex-row gap-4 justify-center">
                <a href="post.php" class="btn-primary flex items-center justify-center gap-2">
                    <i data-lucide="camera"></i>
                    投稿する
                </a>
                <a href="explore.php" class="btn-secondary flex items-center justify-center gap-2">
                    <i data-lucide="map"></i>
                    地図を見る
                </a>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <?php include __DIR__ . '/components/footer.php'; ?>

    <script>
        lucide.createIcons();
    </script>
</body>
</html>
