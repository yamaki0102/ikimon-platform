<?php
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
$meta_title = "チーム";
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>
<body class="js-loading bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">

    <?php include __DIR__ . '/components/nav.php'; ?>
    <script>document.body.classList.remove('js-loading');</script>

    <section class="pt-32 pb-16 px-6">
        <div class="max-w-4xl mx-auto">
            <h1 class="text-3xl font-black mb-4">チーム</h1>
            <p class="text-gray-400 mb-12">ikimonを支える人々</p>
            
            <!-- Founder -->
            <div class="mb-16">
                <h2 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6">ファウンダー</h2>
                <div class="glass-card p-8 rounded-2xl border border-white/10">
                    <div class="flex flex-col md:flex-row items-center md:items-start gap-6">
                        <div class="w-32 h-32 rounded-2xl bg-gradient-to-br from-green-500/20 to-blue-500/20 flex items-center justify-center shrink-0 text-4xl font-black text-green-300">
                            Y
                        </div>
                        <div class="flex-1 text-center md:text-left">
                            <h3 class="text-2xl font-bold mb-1">八巻 毅</h3>
                            <p class="text-[var(--color-primary)] font-bold mb-4">Founder & CEO</p>
                            <p class="text-gray-400 text-sm leading-relaxed">
                                浜松を拠点に、市民科学と生物多様性の可視化に取り組んでいます。
                                「あなたの発見が、未来の自然を守る」というビジョンのもと、
                                ikimonを開発しています。
                            </p>
                            <div class="flex justify-center md:justify-start gap-3 mt-4">
                                <a href="#" class="text-gray-400 hover:text-white transition">
                                    <i data-lucide="twitter" class="w-5 h-5"></i>
                                </a>
                                <a href="#" class="text-gray-400 hover:text-white transition">
                                    <i data-lucide="linkedin" class="w-5 h-5"></i>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Advisors -->
            <div class="mb-16">
                <h2 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6">アドバイザー</h2>
                <div class="grid md:grid-cols-2 gap-6">
                    
                    <!-- Advisor 1 -->
                    <div class="glass-card p-6 rounded-2xl border border-white/10">
                        <div class="flex items-center gap-4">
                            <div class="w-16 h-16 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                                <i data-lucide="graduation-cap" class="w-8 h-8 text-purple-400"></i>
                            </div>
                            <div>
                                <h3 class="font-bold text-white">【募集中】</h3>
                                <p class="text-sm text-gray-400">生態学・環境科学アドバイザー</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Advisor 2 -->
                    <div class="glass-card p-6 rounded-2xl border border-white/10">
                        <div class="flex items-center gap-4">
                            <div class="w-16 h-16 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                                <i data-lucide="building-2" class="w-8 h-8 text-blue-400"></i>
                            </div>
                            <div>
                                <h3 class="font-bold text-white">【募集中】</h3>
                                <p class="text-sm text-gray-400">ビジネス・サステナビリティアドバイザー</p>
                            </div>
                        </div>
                    </div>
                    
                </div>
            </div>
            
            <!-- Expert Network -->
            <div class="mb-16">
                <h2 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6">専門家ネットワーク</h2>
                <div class="glass-card p-6 rounded-2xl border border-white/10">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                            <i data-lucide="users" class="w-6 h-6 text-green-400"></i>
                        </div>
                        <div>
                            <p class="text-2xl font-black text-white">10+</p>
                            <p class="text-sm text-gray-400">名の検証者が参加</p>
                        </div>
                    </div>
                    <p class="text-sm text-gray-400">
                        地元の自然観察指導員、大学研究者、市民科学者のネットワークで、
                        投稿された観察の検証を行っています。
                    </p>
                </div>
            </div>
            
            <!-- Join CTA -->
            <div class="p-8 rounded-2xl border-2 border-dashed border-white/20 text-center">
                <i data-lucide="plus-circle" class="w-12 h-12 mx-auto mb-4 text-gray-500"></i>
                <h3 class="text-xl font-bold mb-2">チームに参加しませんか？</h3>
                <p class="text-sm text-gray-400 mb-6">
                    ikimonは、生物多様性の可視化に情熱を持つ仲間を募集しています。
                </p>
                <div class="flex flex-col sm:flex-row justify-center gap-3">
                    <a href="mailto:team@ikimon.life" class="btn-primary">
                        <i data-lucide="mail" class="w-4 h-4 mr-2"></i>
                        お問い合わせ
                    </a>
                    <a href="https://www.wantedly.com/" target="_blank" class="btn-secondary">
                        <i data-lucide="briefcase" class="w-4 h-4 mr-2"></i>
                        Wantedlyで見る
                    </a>
                </div>
            </div>
            
        </div>
    </section>

    <?php include __DIR__ . '/components/footer.php'; ?>

    <script>
        lucide.createIcons();
    </script>
</body>
</html>
