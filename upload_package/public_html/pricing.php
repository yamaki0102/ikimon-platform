<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php
    $meta_title = "料金プラン — ikimon.life";
    $meta_description = "ikimonは個人利用は完全無料。研究者・企業向けのAPI・レポート機能は月額1,980円から。透明な料金体系で生物多様性データを活用。";
    include __DIR__ . '/components/meta.php';
    ?>
</head>

<body class="bg-base text-text font-body">
    <?php include __DIR__ . '/components/header.php'; ?>

    <main class="max-w-5xl mx-auto px-4 pt-24 pb-20 md:pt-28">

        <!-- Hero -->
        <div class="text-center mb-12">
            <h1 class="text-3xl md:text-4xl font-black tracking-tight text-text mb-3">
                💰 料金プラン
            </h1>
            <p class="text-muted text-sm md:text-base max-w-xl mx-auto leading-relaxed">
                <strong>市民は無料。データを活用する機関が支える。</strong><br>
                フェアな循環で、持続可能な生物多様性データ基盤を。
            </p>
        </div>

        <!-- Pricing Grid -->
        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">

            <!-- Free -->
            <div class="bg-surface border border-border rounded-3xl p-6 flex flex-col">
                <div class="text-center mb-6">
                    <span class="text-3xl">🌱</span>
                    <h3 class="text-lg font-black text-text mt-2">Free</h3>
                    <p class="text-xs text-muted mt-1">個人の市民科学者向け</p>
                    <div class="mt-3">
                        <span class="text-3xl font-black text-text">¥0</span>
                        <span class="text-xs text-muted">/月</span>
                    </div>
                </div>
                <ul class="space-y-2 text-xs text-text flex-1">
                    <li class="flex items-start gap-2"><span class="text-primary">✓</span> 観察記録の投稿（無制限）</li>
                    <li class="flex items-start gap-2"><span class="text-primary">✓</span> コミュニティ同定への参加</li>
                    <li class="flex items-start gap-2"><span class="text-primary">✓</span> フィールドマップ・図鑑・ランキング</li>
                    <li class="flex items-start gap-2"><span class="text-primary">✓</span> バッジ・クエスト・レベルアップ</li>
                    <li class="flex items-start gap-2"><span class="text-primary">✓</span> AI同定ヒント</li>
                    <li class="flex items-start gap-2"><span class="text-primary">✓</span> フリーローム（散策モード）</li>
                    <li class="flex items-start gap-2"><span class="text-primary">✓</span> 個人ダッシュボード</li>
                </ul>
                <a href="login.php" class="mt-6 block w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm text-center shadow-lg shadow-primary/20 active:scale-95 transition">
                    無料で始める
                </a>
            </div>

            <!-- Researcher -->
            <div class="bg-surface border-2 border-primary rounded-3xl p-6 flex flex-col relative overflow-hidden">
                <div class="absolute top-0 right-0 bg-primary text-white text-[9px] font-black px-3 py-1 rounded-bl-xl">おすすめ</div>
                <div class="text-center mb-6">
                    <span class="text-3xl">🔬</span>
                    <h3 class="text-lg font-black text-text mt-2">Researcher</h3>
                    <p class="text-xs text-muted mt-1">研究者・コンサルタント向け</p>
                    <div class="mt-3">
                        <span class="text-3xl font-black text-primary">¥1,980</span>
                        <span class="text-xs text-muted">/月</span>
                    </div>
                </div>
                <ul class="space-y-2 text-xs text-text flex-1">
                    <li class="flex items-start gap-2"><span class="text-primary">✓</span> Freeの全機能</li>
                    <li class="flex items-start gap-2"><span class="text-primary font-bold">★</span> API アクセス（1,000リクエスト/日）</li>
                    <li class="flex items-start gap-2"><span class="text-primary font-bold">★</span> Darwin Core (DwC-A) エクスポート</li>
                    <li class="flex items-start gap-2"><span class="text-primary font-bold">★</span> 高度検索・フィルタリング</li>
                    <li class="flex items-start gap-2"><span class="text-primary font-bold">★</span> 研究用データダウンロード</li>
                    <li class="flex items-start gap-2"><span class="text-primary font-bold">★</span> メールサポート</li>
                </ul>
                <a href="mailto:contact@ikimon.life?subject=Researcher%E3%83%97%E3%83%A9%E3%83%B3%E3%81%AE%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B"
                    class="mt-6 block w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm text-center shadow-lg shadow-primary/20 active:scale-95 transition">
                    お問い合わせ
                </a>
            </div>

            <!-- Enterprise -->
            <div class="bg-surface border border-border rounded-3xl p-6 flex flex-col">
                <div class="text-center mb-6">
                    <span class="text-3xl">🏢</span>
                    <h3 class="text-lg font-black text-text mt-2">Enterprise</h3>
                    <p class="text-xs text-muted mt-1">企業・デベロッパー向け</p>
                    <div class="mt-3">
                        <span class="text-3xl font-black text-text">¥9,800</span>
                        <span class="text-xs text-muted">/月</span>
                    </div>
                </div>
                <ul class="space-y-2 text-xs text-text flex-1">
                    <li class="flex items-start gap-2"><span class="text-primary">✓</span> Researcherの全機能</li>
                    <li class="flex items-start gap-2"><span class="text-accent font-bold">★</span> 無制限 API アクセス</li>
                    <li class="flex items-start gap-2"><span class="text-accent font-bold">★</span> TNFD LEAP レポート自動生成</li>
                    <li class="flex items-start gap-2"><span class="text-accent font-bold">★</span> BIS（生物多様性指数）スコア</li>
                    <li class="flex items-start gap-2"><span class="text-accent font-bold">★</span> カスタムサイト監視ダッシュボード</li>
                    <li class="flex items-start gap-2"><span class="text-accent font-bold">★</span> ブランド付きレポート</li>
                    <li class="flex items-start gap-2"><span class="text-accent font-bold">★</span> SLA付き優先サポート</li>
                </ul>
                <a href="mailto:contact@ikimon.life?subject=Enterprise%E3%83%97%E3%83%A9%E3%83%B3%E3%81%AE%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B"
                    class="mt-6 block w-full py-3 rounded-2xl bg-surface border-2 border-primary text-primary font-bold text-sm text-center active:scale-95 transition hover:bg-primary/5">
                    お問い合わせ
                </a>
            </div>

            <!-- Government -->
            <div class="bg-surface border border-border rounded-3xl p-6 flex flex-col">
                <div class="text-center mb-6">
                    <span class="text-3xl">🏛️</span>
                    <h3 class="text-lg font-black text-text mt-2">Government</h3>
                    <p class="text-xs text-muted mt-1">環境省・自治体向け</p>
                    <div class="mt-3">
                        <span class="text-xl font-black text-text">個別見積</span>
                    </div>
                </div>
                <ul class="space-y-2 text-xs text-text flex-1">
                    <li class="flex items-start gap-2"><span class="text-primary">✓</span> Enterpriseの全機能</li>
                    <li class="flex items-start gap-2"><span class="text-secondary font-bold">★</span> カスタム統合・API連携</li>
                    <li class="flex items-start gap-2"><span class="text-secondary font-bold">★</span> 年次環境報告書自動生成</li>
                    <li class="flex items-start gap-2"><span class="text-secondary font-bold">★</span> 職員向け研修プログラム</li>
                    <li class="flex items-start gap-2"><span class="text-secondary font-bold">★</span> 専任アカウントマネージャー</li>
                    <li class="flex items-start gap-2"><span class="text-secondary font-bold">★</span> 30by30 モニタリング対応</li>
                </ul>
                <a href="mailto:contact@ikimon.life?subject=Government%E3%83%97%E3%83%A9%E3%83%B3%E3%81%AE%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B"
                    class="mt-6 block w-full py-3 rounded-2xl bg-surface border-2 border-secondary text-secondary font-bold text-sm text-center active:scale-95 transition hover:bg-secondary/5">
                    ご相談ください
                </a>
            </div>
        </div>

        <!-- Why This Model -->
        <div class="max-w-2xl mx-auto mb-16">
            <h2 class="text-xl font-black text-text text-center mb-6">🌏 なぜこの料金モデルなのか</h2>
            <div class="bg-primary/5 border border-primary/20 rounded-3xl p-6 md:p-8">
                <div class="space-y-4 text-sm text-text leading-relaxed">
                    <p>ikimonは<strong>「データを生む市民は無料、データを活用する機関が対価を払う」</strong>というフェアな循環を大切にしています。</p>
                    <p>あなたが1件の生き物を記録するたびに、それは科学データとして蓄積され、地域の環境を守る根拠になります。この価値を正当に評価し、それを活用する企業・研究機関からの支援で、プラットフォームの持続的な運営を可能にしています。</p>
                    <div class="flex items-center gap-3 bg-white/60 rounded-2xl p-4 border border-primary/10">
                        <span class="text-2xl">💡</span>
                        <p class="text-xs text-muted"><strong class="text-text">iNaturalist モデルからの進化：</strong>データの研究利用への対価を組み込むことで、ボランティアの善意だけに頼らない持続可能なエコシステムを構築します。</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Data Standards -->
        <div class="max-w-2xl mx-auto mb-16">
            <h2 class="text-xl font-black text-text text-center mb-6">📊 データの信頼性</h2>
            <div class="grid sm:grid-cols-2 gap-4">
                <div class="bg-surface border border-border rounded-2xl p-5">
                    <div class="text-2xl mb-2">🏷️</div>
                    <h3 class="text-sm font-bold text-text mb-1">UUID v4 永続識別子</h3>
                    <p class="text-xs text-muted">すべての記録にグローバルで一意の識別子を付与。GBIF/DwC-A 互換。</p>
                </div>
                <div class="bg-surface border border-border rounded-2xl p-5">
                    <div class="text-2xl mb-2">✅</div>
                    <h3 class="text-sm font-bold text-text mb-1">7段階品質フラグ</h3>
                    <p class="text-xs text-muted">写真、位置、日時、同定、野生性、新鮮さなどを自動評価。研究グレード認定制度。</p>
                </div>
                <div class="bg-surface border border-border rounded-2xl p-5">
                    <div class="text-2xl mb-2">⚖️</div>
                    <h3 class="text-sm font-bold text-text mb-1">CC ライセンス選択</h3>
                    <p class="text-xs text-muted">投稿者がCC0/CC-BY/CC-BY-NCから選択。データ主権を尊重。</p>
                </div>
                <div class="bg-surface border border-border rounded-2xl p-5">
                    <div class="text-2xl mb-2">🌍</div>
                    <h3 class="text-sm font-bold text-text mb-1">Darwin Core 準拠</h3>
                    <p class="text-xs text-muted">GBIF 国際標準フォーマットでのエクスポート。科学的データの国際流通に対応。</p>
                </div>
            </div>
        </div>

        <!-- FAQ Link -->
        <div class="text-center">
            <p class="text-sm text-muted mb-3">料金やデータに関する詳しい質問は</p>
            <a href="faq.php" class="inline-flex items-center gap-2 bg-surface border border-border rounded-full px-6 py-3 text-sm font-bold text-text hover:border-primary/40 transition active:scale-95">
                <i data-lucide="help-circle" class="w-4 h-4 text-primary"></i>
                よくある質問（FAQ）を見る
            </a>
        </div>

    </main>

    <?php include __DIR__ . '/components/footer_nav.php'; ?>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>

</html>
