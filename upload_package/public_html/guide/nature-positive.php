<?php
/**
 * ネイチャーポジティブ完全ガイド (Pillar Page)
 * SEO: /guide/nature-positive.php
 */
$meta_title = 'ネイチャーポジティブ完全ガイド｜自然と共に歩く生活のすべて';
$meta_description = 'ネイチャーポジティブ(自然再興)とは何か、なぜ今注目されているのか、そして私たちにできることは何か。お散歩×生きもの観察×健康の三位一体で、楽しみながら自然を守る方法を科学的エビデンスとともに完全解説。';
$meta_image = 'https://ikimon.life/guide/ogp/nature-positive.png';
$meta_canonical = 'https://ikimon.life/guide/nature-positive.php';

require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/CspNonce.php';
Auth::init();
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/../components/meta.php'; ?>

    <!-- Page-specific OGP overrides -->
    <meta property="og:type" content="article">

    <style>
        .pillar-hero {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 182, 212, 0.06) 30%, rgba(139, 92, 246, 0.06) 70%, rgba(16, 185, 129, 0.04) 100%);
        }

        .cluster-card {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(16, 185, 129, 0.12);
            border-radius: 20px;
            transition: all 0.3s ease;
        }

        .cluster-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 40px rgba(16, 185, 129, 0.1);
        }

        .article-link {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            border-radius: 12px;
            transition: all 0.2s ease;
            border: 1px solid transparent;
        }

        .article-link:hover {
            background: rgba(16, 185, 129, 0.04);
            border-color: rgba(16, 185, 129, 0.15);
        }

        .stat-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            border-radius: 99px;
            font-size: 11px;
            font-weight: 700;
            flex-shrink: 0;
        }

        .cta-gradient {
            background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
        }

        .toc-link {
            transition: all 0.2s ease;
        }

        .toc-link:hover {
            padding-left: 8px;
            color: var(--color-primary);
        }

        /* Improved section spacing */
        .cluster-section {
            scroll-margin-top: 80px;
        }

        /* Author avatar */
        .author-avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: 900;
            color: white;
            flex-shrink: 0;
        }
    </style>

    <script type="application/ld+json" nonce="<?= CspNonce::attr() ?>">
        {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "ネイチャーポジティブ完全ガイド｜自然と共に歩く生活のすべて",
            "author": {
                "@type": "Person",
                "name": "八巻 毅",
                "jobTitle": "IKIMON 代表"
            },
            "publisher": {
                "@type": "Organization",
                "name": "ikimon.life"
            },
            "datePublished": "2026-02-27",
            "dateModified": "2026-03-08",
            "about": [
                { "@type": "Thing", "name": "ネイチャーポジティブ" },
                { "@type": "Thing", "name": "生物多様性" },
                { "@type": "Thing", "name": "自然共生サイト" },
                { "@type": "Thing", "name": "ウェルビーイング" }
            ]
        }
    </script>
</head>

<body class="js-loading pb-24 md:pb-0 bg-base text-text font-body">

    <?php include __DIR__ . '/../components/nav.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <main class="pt-14">

    <!-- Breadcrumb -->
    <nav class="pt-6 pb-2 px-6" aria-label="パンくずリスト">
        <div class="max-w-5xl mx-auto">
            <ol class="flex items-center gap-2 text-sm text-gray-400">
                <li><a href="<?= defined('BASE_URL') ? rtrim(BASE_URL, '/') : '' ?>/index.php" class="hover:text-primary transition-colors">ホーム</a></li>
                <li class="text-gray-300">/</li>
                <li class="text-gray-600 font-medium">ネイチャーポジティブ完全ガイド</li>
            </ol>
        </div>
    </nav>

    <!-- Hero -->
    <section class="pt-8 pb-16 px-6 pillar-hero">
        <div class="max-w-5xl mx-auto text-center">
            <div class="flex flex-wrap justify-center gap-2 mb-6">
                <span class="stat-pill bg-emerald-100 text-emerald-700">ピラーページ</span>
                <span class="stat-pill bg-violet-100 text-violet-700">ウェルビーイング</span>
                <span class="stat-pill bg-blue-100 text-blue-700">データ駆動</span>
            </div>

            <h1 class="text-3xl md:text-5xl font-black tracking-tight leading-tight mb-6">
                ネイチャーポジティブ<br class="md:hidden">完全ガイド
            </h1>
            <p class="text-lg md:text-xl text-muted max-w-2xl mx-auto mb-8 leading-relaxed">
                自然を守りながら、歩いて、観察して、健康になる。<br>
                ikimonが提案する「お散歩×生きもの観察×脳活性化」のすべて。
            </p>

            <div class="flex items-center justify-center gap-4">
                <div class="author-avatar">Y</div>
                <div class="text-left">
                    <p class="text-sm font-bold text-text">八巻 毅</p>
                    <p class="text-xs text-faint">IKIMON 代表 / 自然共生サイト認定企業・愛管株式会社パートナー</p>
                </div>
            </div>
        </div>
    </section>

    <!-- ikimonの三位一体 -->
    <section class="px-6 -mt-6 relative z-10">
        <div class="max-w-5xl mx-auto">
            <div class="bg-white/90 backdrop-blur-xl rounded-3xl border border-gray-200 shadow-lg p-8 md:p-12 text-center">
                <h2 class="text-xl font-black mb-8">ikimonの三位一体</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div class="flex flex-col items-center">
                        <div class="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
                            <i data-lucide="footprints" class="w-8 h-8 text-emerald-600"></i>
                        </div>
                        <h3 class="font-black text-lg mb-2">お散歩</h3>
                        <p class="text-sm text-muted leading-relaxed">1日9,800歩で認知症リスク51%減。歩くだけで脳が変わる。</p>
                    </div>
                    <div class="flex flex-col items-center">
                        <div class="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mb-4">
                            <i data-lucide="search" class="w-8 h-8 text-violet-600"></i>
                        </div>
                        <h3 class="font-black text-lg mb-2">生きもの観察</h3>
                        <p class="text-sm text-muted leading-relaxed">種同定はパターン認識の脳トレ。認知的予備力を構築する。</p>
                    </div>
                    <div class="flex flex-col items-center">
                        <div class="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-4">
                            <i data-lucide="globe" class="w-8 h-8 text-blue-600"></i>
                        </div>
                        <h3 class="font-black text-lg mb-2">自然を守る</h3>
                        <p class="text-sm text-muted leading-relaxed">あなたの記録が科学データに。市民科学で生物多様性を保全。</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- 目次 -->
    <section class="py-10 px-6">
        <div class="max-w-4xl mx-auto">
            <div class="bg-surface rounded-2xl p-6 border border-border">
                <h2 class="text-lg font-black mb-4 flex items-center gap-2">
                    <i data-lucide="list" class="w-5 h-5 text-primary"></i>
                    ガイドカテゴリー
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                    <a href="#nature-positive" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-emerald-600 font-bold">01</span> ネイチャーポジティブ
                    </a>
                    <a href="#regional" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-orange-600 font-bold">04</span> 地方創生と生きもの
                    </a>
                    <a href="#satoyama" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-green-600 font-bold">02</span> 里山イニシアティブ
                    </a>
                    <a href="#japan-bio" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-cyan-600 font-bold">05</span> 日本の生物多様性
                    </a>
                    <a href="#health" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-violet-600 font-bold">03</span> 自然と健康の科学
                    </a>
                    <a href="#guidelines" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-blue-600 font-bold">06</span> コミュニティガイドライン
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- Category 1: ネイチャーポジティブ -->
    <section id="nature-positive" class="py-10 px-6 cluster-section">
        <div class="max-w-4xl mx-auto">
            <div class="cluster-card p-6 md:p-8">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <i data-lucide="sprout" class="w-5 h-5 text-emerald-600"></i>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-emerald-600 uppercase tracking-wider">Category 1</p>
                        <h2 class="text-xl font-black">ネイチャーポジティブ</h2>
                    </div>
                </div>
                <p class="text-muted mb-6 leading-relaxed">自然の損失を止め、回復に向かわせること。30by30、自然共生サイト、企業の取り組みまで。</p>

                <div class="space-y-2">
                    <a href="what-is-nature-positive.php" class="article-link">
                        <span class="stat-pill bg-emerald-50 text-emerald-700">★★★</span>
                        <div class="min-w-0">
                            <p class="font-bold text-sm">ネイチャーポジティブとは？完全解説</p>
                            <p class="text-xs text-faint mt-0.5">30by30、自然共生サイト420+、企業334社調査</p>
                        </div>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-gray-300 ml-auto flex-shrink-0"></i>
                    </a>
                    <a href="nature-coexistence-sites-analysis.php" class="article-link">
                        <span class="stat-pill bg-emerald-50 text-emerald-700">★★★</span>
                        <div class="min-w-0">
                            <p class="font-bold text-sm">自然共生サイト全420+認定 完全分析</p>
                            <p class="text-xs text-faint mt-0.5">都道府県・業種・活動類型マップ</p>
                        </div>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-gray-300 ml-auto flex-shrink-0"></i>
                    </a>
                    <a href="corporate-walking-program.php" class="article-link">
                        <span class="stat-pill bg-emerald-50 text-emerald-700">★★★</span>
                        <div class="min-w-0">
                            <p class="font-bold text-sm">企業が「お散歩プログラム」を導入すべき5つの理由</p>
                            <p class="text-xs text-faint mt-0.5">経団連334社×TNFD209社データに基づくB2B分析</p>
                        </div>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-gray-300 ml-auto flex-shrink-0"></i>
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- Category 2: 里山イニシアティブ -->
    <section id="satoyama" class="py-10 px-6 cluster-section">
        <div class="max-w-4xl mx-auto">
            <div class="cluster-card p-6 md:p-8" style="border-color: rgba(34, 197, 94, 0.15);">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                        <i data-lucide="mountain" class="w-5 h-5 text-green-600"></i>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-green-600 uppercase tracking-wider">Category 2</p>
                        <h2 class="text-xl font-black">里山イニシアティブ</h2>
                    </div>
                </div>
                <p class="text-muted mb-6 leading-relaxed">2010年の名古屋国際会議で生まれた里山の知恵を世界に広げる取り組み。348の組織が参加する、人と自然の共生モデル。</p>

                <div class="space-y-2">
                    <a href="satoyama-initiative.php" class="article-link">
                        <span class="stat-pill bg-green-50 text-green-700">★★★</span>
                        <div class="min-w-0">
                            <p class="font-bold text-sm">里山イニシアチブとは？市民科学との接点</p>
                            <p class="text-xs text-faint mt-0.5">COP10発・日本の知恵が世界標準に。IPSI 348組織の取り組み</p>
                        </div>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-gray-300 ml-auto flex-shrink-0"></i>
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- Category 3: 自然と健康の科学 -->
    <section id="health" class="py-10 px-6 cluster-section">
        <div class="max-w-4xl mx-auto">
            <div class="cluster-card p-6 md:p-8" style="border-color: rgba(139, 92, 246, 0.15);">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                        <i data-lucide="brain" class="w-5 h-5 text-violet-600"></i>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-violet-600 uppercase tracking-wider">Category 3</p>
                        <h2 class="text-xl font-black">自然と健康の科学</h2>
                    </div>
                </div>
                <p class="text-muted mb-6 leading-relaxed">お散歩×生きもの観察が脳と身体をどう変えるのか。科学的エビデンスで解説します。</p>

                <div class="space-y-2">
                    <a href="walking-brain-science.php" class="article-link">
                        <span class="stat-pill bg-violet-50 text-violet-700">★★★</span>
                        <div class="min-w-0">
                            <p class="font-bold text-sm">自然の中を歩くと脳に何が起きるのか？</p>
                            <p class="text-xs text-faint mt-0.5">5つのメカニズムを科学的エビデンスとともに解説</p>
                        </div>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-gray-300 ml-auto flex-shrink-0"></i>
                    </a>
                    <a href="steps-dementia-prevention.php" class="article-link">
                        <span class="stat-pill bg-violet-50 text-violet-700">★★★</span>
                        <div class="min-w-0">
                            <p class="font-bold text-sm">1日9,800歩で認知症リスク51%減</p>
                            <p class="text-xs text-faint mt-0.5">JAMA Neurology大規模研究に基づく歩数と認知症の関係</p>
                        </div>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-gray-300 ml-auto flex-shrink-0"></i>
                    </a>
                    <a href="species-id-brain-training.php" class="article-link">
                        <span class="stat-pill bg-violet-50 text-violet-700">★★★</span>
                        <div class="min-w-0">
                            <p class="font-bold text-sm">種同定は脳トレだった｜パターン認識の科学</p>
                            <p class="text-xs text-faint mt-0.5">バードウォッチャーの脳はワーキングメモリ領域が高密度</p>
                        </div>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-gray-300 ml-auto flex-shrink-0"></i>
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- Category 4: 地方創生と生きもの -->
    <section id="regional" class="py-10 px-6 cluster-section">
        <div class="max-w-4xl mx-auto">
            <div class="cluster-card p-6 md:p-8" style="border-color: rgba(249, 115, 22, 0.15);">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                        <i data-lucide="map" class="w-5 h-5 text-orange-600"></i>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-orange-600 uppercase tracking-wider">Category 4</p>
                        <h2 class="text-xl font-black">地方創生と生きもの</h2>
                    </div>
                </div>
                <p class="text-muted mb-6 leading-relaxed">消滅可能性自治体744。しかし過疎地域ほど自然は豊か。自然資本を活かした地方創生の可能性。</p>

                <div class="space-y-2">
                    <a href="regional-biodiversity.php" class="article-link">
                        <span class="stat-pill bg-orange-50 text-orange-700">★★★</span>
                        <div class="min-w-0">
                            <p class="font-bold text-sm">地方創生と生物多様性——消滅可能性自治体が持つ自然資本</p>
                            <p class="text-xs text-faint mt-0.5">増田レポート、自然共生サイト、エコツーリズム、市民科学の可能性</p>
                        </div>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-gray-300 ml-auto flex-shrink-0"></i>
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- Category 5: 日本の生物多様性 -->
    <section id="japan-bio" class="py-10 px-6 cluster-section">
        <div class="max-w-4xl mx-auto">
            <div class="cluster-card p-6 md:p-8" style="border-color: rgba(6, 182, 212, 0.15);">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                        <i data-lucide="globe-2" class="w-5 h-5 text-cyan-600"></i>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-cyan-600 uppercase tracking-wider">Category 5</p>
                        <h2 class="text-xl font-black">日本の生物多様性</h2>
                    </div>
                </div>
                <p class="text-muted mb-6 leading-relaxed">世界が認めた自然の宝庫。カエルやサンショウウオの74%が日本だけの種。名古屋で始まった国際目標から30by30まで。</p>

                <div class="space-y-2">
                    <a href="japan-biodiversity.php" class="article-link">
                        <span class="stat-pill bg-cyan-50 text-cyan-700">★★★</span>
                        <div class="min-w-0">
                            <p class="font-bold text-sm">日本の生物多様性——世界が注目する島国の自然</p>
                            <p class="text-xs text-faint mt-0.5">日本だけの生きもの、イギリスとの比較、名古屋からの国際貢献、30by30</p>
                        </div>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-gray-300 ml-auto flex-shrink-0"></i>
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- Category 6: コミュニティガイドライン -->
    <section id="guidelines" class="py-10 px-6 cluster-section">
        <div class="max-w-4xl mx-auto">
            <div class="cluster-card p-6 md:p-8" style="border-color: rgba(59, 130, 246, 0.15);">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                        <i data-lucide="shield-check" class="w-5 h-5 text-blue-600"></i>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-blue-600 uppercase tracking-wider">Category 6</p>
                        <h2 class="text-xl font-black">コミュニティガイドライン</h2>
                    </div>
                </div>
                <p class="text-muted mb-6 leading-relaxed">ikimonで活動するためのルールと倫理。誠実な記録、互いの尊重、自然への配慮。</p>

                <div class="space-y-2">
                    <a href="/guidelines.php" class="article-link">
                        <span class="stat-pill bg-blue-50 text-blue-700">★★★</span>
                        <div class="min-w-0">
                            <p class="font-bold text-sm">コミュニティガイドライン</p>
                            <p class="text-xs text-faint mt-0.5">観察ルール・データ品質・倫理・安全のための指針</p>
                        </div>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-gray-300 ml-auto flex-shrink-0"></i>
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- CTA -->
    <section id="cta" class="py-16 px-6 cluster-section">
        <div class="max-w-4xl mx-auto">
            <div class="bg-gradient-to-br from-emerald-50 via-violet-50 to-cyan-50 rounded-[2rem] p-8 md:p-16 border border-gray-200 text-center">
                <h2 class="text-2xl md:text-3xl font-black mb-4">散歩をアップグレードしよう</h2>
                <p class="text-muted mb-8 max-w-lg mx-auto leading-relaxed">ikimonでお散歩しながら生きものを観察。歩数も脳トレも科学データも、全部手に入る。</p>
                <div class="flex flex-col sm:flex-row justify-center gap-4">
                    <a href="/post.php" class="cta-gradient text-white font-bold px-8 py-4 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg">
                        <i data-lucide="camera" class="w-5 h-5"></i>観察を始める
                    </a>
                    <a href="/about.php" class="bg-white text-text font-bold px-8 py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors border border-border">
                        <i data-lucide="info" class="w-5 h-5"></i>ikimonについて
                    </a>
                </div>
            </div>
        </div>
    </section>

    </main>

    <?php include __DIR__ . '/../components/footer.php'; ?>

</body>

</html>
