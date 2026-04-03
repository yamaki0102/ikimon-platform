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

<body class="font-body" style="background:var(--md-surface);color:var(--md-on-surface);">
    <?php include('components/nav.php'); ?>

    <main class="max-w-4xl mx-auto px-6 py-20 pb-32">
        <header class="mb-20 text-center">
            <span class="inline-block px-4 py-1 rounded-full bg-gray-100 border border-gray-200 text-[var(--color-primary)] text-xs font-bold uppercase tracking-widest mb-6">Values & Rules</span>
            <h1 class="text-4xl md:text-6xl font-black mb-6">Community Guidelines</h1>
            <p class="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                ikimonは、自然を愛するすべての人々のための場所です。<br>
                安全で快適な探究の旅のために、以下の指針を大切にしています。
            </p>
        </header>

        <section class="space-y-24">
            <!-- 1. Authenticity -->
            <div class="glass-card p-10 rounded-3xl border-gray-200 relative overflow-hidden">
                <div class="absolute -right-10 -top-10 w-64 h-64 bg-green-500/10 rounded-full blur-3xl"></div>
                <div class="relative z-10 flex gap-8 flex-col md:flex-row">
                    <div class="w-16 h-16 rounded-2xl bg-green-500/20 text-green-500 flex items-center justify-center shrink-0">
                        <i data-lucide="camera" class="w-8 h-8"></i>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold mb-4">誠実な記録を</h2>
                        <ul class="space-y-4 text-gray-600 leading-relaxed list-disc list-inside marker:text-green-500">
                            <li>あなた自身が撮影・録音したデータのみを投稿してください。</li>
                            <li>位置情報や日時は正確に記録しましょう。意図的な偽装は研究データの価値を損ないます。</li>
                            <li>飼育・栽培されている生き物は「野生ではない」と明記しましょう。</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- 2. Respect -->
            <div class="glass-card p-10 rounded-3xl border-gray-200 relative overflow-hidden">
                <div class="absolute -left-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div class="relative z-10 flex gap-8 flex-col md:flex-row">
                    <div class="w-16 h-16 rounded-2xl bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                        <i data-lucide="heart-handshake" class="w-8 h-8"></i>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold mb-4">互いを尊重しよう</h2>
                        <ul class="space-y-4 text-gray-600 leading-relaxed list-disc list-inside marker:text-blue-500">
                            <li>名前の提案やコメントは、建設的で敬意を持った言葉で行いましょう。</li>
                            <li>初心者には優しくサポートし、知識を分かち合いましょう。</li>
                            <li>差別的、攻撃的な言動は一切容認されません。</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- 3. Nature First -->
            <div class="glass-card p-10 rounded-3xl border-gray-200 relative overflow-hidden">
                <div class="absolute inset-0 bg-yellow-500/5"></div>
                <div class="relative z-10 flex gap-8 flex-col md:flex-row">
                    <div class="w-16 h-16 rounded-2xl bg-yellow-500/20 text-yellow-500 flex items-center justify-center shrink-0">
                        <i data-lucide="sprout" class="w-8 h-8"></i>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold mb-4">自然への配慮</h2>
                        <ul class="space-y-4 text-gray-600 leading-relaxed list-disc list-inside marker:text-yellow-500">
                            <li>観察のために生き物を傷つけたり、生息地を荒らしたりしないでください。</li>
                            <li>希少種の場所は公開範囲を制限するなど、保護に努めましょう。</li>
                            <li>私有地への無断立ち入りは禁止です。</li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>

        <div class="mt-20 space-y-12">
            <!-- データ品質のコツ -->
            <div class="glass-card p-10 rounded-3xl border-gray-200 relative overflow-hidden">
                <div class="absolute -right-10 -top-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>
                <div class="relative z-10">
                    <h2 class="text-2xl font-bold mb-6 flex items-center gap-3">
                        <span class="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">📸</span>
                        データ品質のコツ
                    </h2>
                    <div class="grid md:grid-cols-2 gap-6">
                        <div class="space-y-3 text-gray-600 text-sm">
                            <p>✅ <strong class="text-gray-800">全体像と特徴部分</strong>を撮ると同定精度が上がる</p>
                            <p>✅ <strong class="text-gray-800">横から・上から</strong>の複数アングルがベスト</p>
                            <p>✅ 手のひらや定規を添えると<strong class="text-gray-800">サイズ感</strong>がわかる</p>
                            <p>✅ <strong class="text-gray-800">個体数</strong>を選択すると個体数変動の追跡データに</p>
                        </div>
                        <div class="space-y-3 text-gray-600 text-sm">
                            <p>💡 種名がわからなければ<strong class="text-gray-800">空欄でOK</strong>！</p>
                            <p>💡 「○○の仲間？」と書いても全然大丈夫</p>
                            <p>💡 個体数は<strong class="text-gray-800">だいたいでOK</strong> — 正確さより継続が大事</p>
                            <p>💡 間違いは「<strong class="text-emerald-600">新しい情報が見つかりました</strong>」— 責めたりしない</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ライセンス -->
            <div class="glass-card p-8 rounded-3xl border-gray-200 text-center">
                <p class="text-sm text-gray-400 mb-2">投稿されたデータは <strong class="text-gray-900">CC BY 4.0</strong> で公開されます</p>
                <p class="text-xs text-gray-500">30by30や環境保全調査に活用 — 写真の著作権は投稿者に帰属</p>
            </div>
        </div>

        <div class="mt-12 text-center">
            <p class="text-gray-500 mb-8">このガイドラインに違反するコンテンツを見つけた場合は、通報機能を使用してください。</p>
            <a href="index.php" class="btn-primary inline-flex items-center gap-2">
                同意して探索を続ける
                <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </a>
        </div>
    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>

</html>