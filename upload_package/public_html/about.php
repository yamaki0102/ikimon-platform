<?php
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ikimonについて - 創業ストーリー</title>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <style>
        .story-section {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%);
        }
    </style>
</head>
<body class="js-loading bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">

    <?php include __DIR__ . '/components/nav.php'; ?>
    <script>document.body.classList.remove('js-loading');</script>

    <!-- Hero Section -->
    <section class="pt-32 pb-16 px-6">
        <div class="max-w-4xl mx-auto text-center">
            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-6">
                <span class="text-xs font-bold tracking-wider uppercase">About ikimon</span>
            </div>
            <h1 class="text-4xl md:text-6xl font-black mb-6 tracking-tight">
                なぜ、<span class="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)]">ikimon</span>を作ったのか
            </h1>
            <p class="text-lg text-gray-400 max-w-2xl mx-auto">
                浜松から始まる、自然と人をつなぐ物語
            </p>
        </div>
    </section>

    <!-- Founder Story Section -->
    <section class="py-16 px-6 story-section">
        <div class="max-w-3xl mx-auto">
            
            <!-- Story Content -->
            <div class="glass-card rounded-[2rem] p-8 md:p-12 border border-white/10">
                
                <!-- Photo placeholder -->
                <div class="flex items-center gap-6 mb-8 pb-8 border-b border-white/10">
                    <div class="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center text-3xl font-black text-[#05070a]">
                        Y
                    </div>
                    <div>
                        <h2 class="text-xl font-bold">八巻 毅</h2>
                        <p class="text-sm text-gray-400">ikimon 創業者 / CEO</p>
                    </div>
                </div>

                <article class="prose prose-invert prose-lg max-w-none space-y-6 text-gray-300 leading-relaxed">
                    
                    <h3 class="text-2xl font-bold text-white">きっかけ：浜松の自然との出会い</h3>
                    <p>
                        浜松の身近な公園で、小さな虫や草花の違いに気づいたことが原点でした。
                        その気づきが「この自然を未来に残したい」という思いにつながり、
                        発見を記録し、共有できる仕組みを作ろうと決めました。
                    </p>

                    <h3 class="text-2xl font-bold text-white mt-8">課題：見えない自然の価値</h3>
                    <p>
                        日本には豊かな自然がありますが、その価値は可視化されにくく、
                        「何が、どこに、どれだけいるのか」が分からないまま意思決定されることが多いのが現状です。
                        企業や自治体が自然を守ろうとしても、判断材料が不足しています。
                    </p>
                    
                    <h3 class="text-2xl font-bold text-white mt-8">解決策：市民の力で自然を可視化する</h3>
                    <p>
                        ikimonは、市民の「見つけた！」という小さな発見を、
                        科学的に価値のあるデータへ変えるプラットフォームです。
                        専門家のネットワークが正確性を担保し、
                        企業や自治体はそのデータを使ってTNFD対応や自然資本の可視化を進められます。
                    </p>

                    <h3 class="text-2xl font-bold text-white mt-8">ビジョン：自然と共に生きる社会へ</h3>
                    <p>
                        2030年までに、浜松のすべての小中学校でikimonが使われ、
                        子どもたちが自分の街の自然を知る世界を作りたい。
                        その経験が大人になっても続き、
                        自然を守ることが当たり前の社会を実現することが目標です。
                    </p>

                    <blockquote class="border-l-4 border-[var(--color-primary)] pl-6 my-8 italic text-xl">
                        「自然を守ることは、未来を守ること。<br>
                        一人ひとりの発見が、大きな変化を生む。」
                    </blockquote>

                </article>

                <!-- Call to Action -->
                <div class="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row gap-4">
                    <a href="post.php" class="btn-primary flex-1 flex items-center justify-center gap-2">
                        <i data-lucide="camera"></i>
                        観察を始める
                    </a>
                    <a href="showcase.php" class="btn-secondary flex-1 flex items-center justify-center gap-2">
                        <i data-lucide="building-2"></i>
                        企業・自治体の方へ
                    </a>
                </div>
            </div>

        </div>
    </section>

    <!-- Team Section (Future) -->
    <section class="py-16 px-6">
        <div class="max-w-4xl mx-auto text-center">
            <h2 class="text-2xl font-bold mb-4">チーム</h2>
            <p class="text-gray-400 mb-8">ikimonは、自然を愛する仲間と一緒に作っています</p>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                <!-- Placeholder for team members -->
                <div class="glass-card p-6 rounded-2xl border border-white/10 text-center">
                    <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-green-500/20 to-blue-500/20 flex items-center justify-center">
                        <i data-lucide="user" class="w-8 h-8 text-gray-500"></i>
                    </div>
                    <p class="text-sm font-bold">創業者</p>
                    <p class="text-xs text-gray-500">CEO</p>
                </div>
                <div class="glass-card p-6 rounded-2xl border border-white/10 border-dashed text-center opacity-50">
                    <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
                        <i data-lucide="user-plus" class="w-8 h-8 text-gray-600"></i>
                    </div>
                    <p class="text-sm font-bold text-gray-500">募集中</p>
                    <p class="text-xs text-gray-600">エンジニア</p>
                </div>
                <div class="glass-card p-6 rounded-2xl border border-white/10 border-dashed text-center opacity-50">
                    <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
                        <i data-lucide="user-plus" class="w-8 h-8 text-gray-600"></i>
                    </div>
                    <p class="text-sm font-bold text-gray-500">募集中</p>
                    <p class="text-xs text-gray-600">デザイナー</p>
                </div>
                <div class="glass-card p-6 rounded-2xl border border-white/10 border-dashed text-center opacity-50">
                    <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
                        <i data-lucide="user-plus" class="w-8 h-8 text-gray-600"></i>
                    </div>
                    <p class="text-sm font-bold text-gray-500">募集中</p>
                    <p class="text-xs text-gray-600">アドバイザー</p>
                </div>
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
