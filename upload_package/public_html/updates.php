<?php
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>アップデート履歴 | ikimon</title>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>

<body class="js-loading pt-14 bg-base text-text font-body">

    <?php include __DIR__ . '/components/nav.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <main>
    <section class="pt-32 pb-16 px-6">
        <div class="max-w-3xl mx-auto">
            <h1 class="text-3xl font-black mb-4">アップデート履歴</h1>
            <p class="text-gray-500 mb-12">ikimonの最新の改善と機能追加をお知らせします</p>

            <!-- Updates Timeline -->
            <div class="space-y-8">

                <!-- v0.2.0 -->
                <article class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.2.0</span>
                        <time class="text-sm text-gray-500">2025年1月1日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">新年アップデート 🎉</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>PWA対応</strong>: ホーム画面に追加できるようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>TNFD対応レポート</strong>: 企業向けPDFレポートを自動生成</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>セキュリティ強化</strong>: セッション管理、レート制限を追加</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>プライバシー保護</strong>: 写真のEXIF位置情報を自動削除</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>ペルソナ別ページ</strong>: 市民/企業/研究者向けのランディングページ</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.1.5 -->
                <article class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.1.5</span>
                        <time class="text-sm text-gray-500">2024年12月15日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">企業向け機能リリース</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-blue-400 shrink-0">✓</span>
                            <span><strong>企業ダッシュボード</strong>: サイト別の生物多様性可視化</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-blue-400 shrink-0">✓</span>
                            <span><strong>BISスコア</strong>: 生物多様性スコアの自動計算</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-blue-400 shrink-0">✓</span>
                            <span><strong>地図埋め込み</strong>: 自社サイトに地図を埋め込み可能に</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.1.0 -->
                <article class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.1.0</span>
                        <time class="text-sm text-gray-500">2024年11月1日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">ベータ版リリース 🚀</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-purple-400 shrink-0">✓</span>
                            <span><strong>観察投稿機能</strong>: 写真から生き物を記録</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-purple-400 shrink-0">✓</span>
                            <span><strong>専門家による名前提案</strong>: コミュニティで種同定</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-purple-400 shrink-0">✓</span>
                            <span><strong>地図探索</strong>: 周辺の生き物を地図で確認</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-purple-400 shrink-0">✓</span>
                            <span><strong>ゲーミフィケーション</strong>: バッジとランク機能</span>
                        </li>
                    </ul>
                </article>

            </div>

            <!-- Newsletter signup -->
            <div class="mt-16 p-8 rounded-2xl bg-white border border-gray-200 shadow-sm text-center">
                <h3 class="text-lg font-bold mb-2">最新情報をお届けします</h3>
                <p class="text-sm text-gray-500 mb-4">新機能リリース時にメールでお知らせします</p>
                <div class="flex gap-2 max-w-md mx-auto">
                    <input type="email" placeholder="メールアドレス"
                        class="flex-1 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]">
                    <button class="btn-primary whitespace-nowrap">登録</button>
                </div>
            </div>

        </div>
    </section>

    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>

</html>