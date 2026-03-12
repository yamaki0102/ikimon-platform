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
                "jobTitle": "IKIMON株式会社 代表取締役"
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
                    <p class="text-xs text-faint">IKIMON株式会社 代表 / 愛管株式会社 自然共生サイト認定者</p>
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
                    このガイドの内容
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                    <a href="#why" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-emerald-600 font-bold">01</span> WHY — なぜネイチャーポジティブなのか
                    </a>
                    <a href="#health" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-violet-600 font-bold">04</span> KNOW × HEALTH — 生きものを知り、健康に歩く
                    </a>
                    <a href="#data" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-cyan-600 font-bold">02</span> DATA — 数字で見る生物多様性
                    </a>
                    <a href="#do" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-amber-600 font-bold">05</span> DO — 始めてみよう
                    </a>
                    <a href="#how" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-blue-600 font-bold">03</span> HOW — 企業・自治体の取り組み
                    </a>
                    <a href="#cta" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-primary font-bold">→</span> ikimonで始める
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- Cluster 1: WHY -->
    <section id="why" class="py-10 px-6 cluster-section">
        <div class="max-w-4xl mx-auto">
            <div class="cluster-card p-6 md:p-8">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <i data-lucide="sprout" class="w-5 h-5 text-emerald-600"></i>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-emerald-600 uppercase tracking-wider">Cluster 1</p>
                        <h2 class="text-xl font-black">WHY — なぜネイチャーポジティブなのか</h2>
                    </div>
                </div>
                <p class="text-muted mb-6 leading-relaxed">ネイチャーポジティブとは、自然の損失を止め、回復に向かわせること。2030年までに生物多様性の損失を止め、反転させる——それが世界目標です。</p>

                <div class="space-y-2">
                    <a href="walking-brain-science.php" class="article-link">
                        <span class="stat-pill bg-emerald-50 text-emerald-700">★★★</span>
                        <div class="min-w-0">
                            <p class="font-bold text-sm">自然の中を歩くと脳に何が起きるのか？</p>
                            <p class="text-xs text-faint mt-0.5">5つのメカニズムを科学的エビデンスとともに解説</p>
                        </div>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-gray-300 ml-auto flex-shrink-0"></i>
                    </a>
                    <a href="what-is-nature-positive.php" class="article-link">
                        <span class="stat-pill bg-emerald-50 text-emerald-700">★★★</span>
                        <div class="min-w-0">
                            <p class="font-bold text-sm">ネイチャーポジティブとは？完全解説</p>
                            <p class="text-xs text-faint mt-0.5">30by30、自然共生サイト420+、企業334社調査</p>
                        </div>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-gray-300 ml-auto flex-shrink-0"></i>
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- Cluster 4: KNOW × HEALTH -->
    <section id="health" class="py-10 px-6 cluster-section">
        <div class="max-w-4xl mx-auto">
            <div class="cluster-card p-6 md:p-8" style="border-color: rgba(139, 92, 246, 0.15);">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                        <i data-lucide="brain" class="w-5 h-5 text-violet-600"></i>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-violet-600 uppercase tracking-wider">Cluster 4</p>
                        <h2 class="text-xl font-black">KNOW × HEALTH — 生きものを知り、健康に歩く</h2>
                    </div>
                </div>
                <p class="text-muted mb-6 leading-relaxed">ikimonの核心。お散歩×生きもの観察が脳と身体をどう変えるのか、科学的エビデンスで解説します。</p>

                <div class="space-y-2">
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
                    <div class="article-link opacity-50 cursor-default">
                        <span class="stat-pill bg-gray-100 text-gray-400">★★★</span>
                        <div class="min-w-0">
                            <p class="font-bold text-sm text-faint">歩数×同定数が脳を変える｜ikimonの活用法</p>
                            <p class="text-xs text-gray-300">準備中</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Cluster 2: DATA -->
    <section id="data" class="py-10 px-6 cluster-section">
        <div class="max-w-4xl mx-auto">
            <div class="cluster-card p-6 md:p-8" style="border-color: rgba(6, 182, 212, 0.15);">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                        <i data-lucide="bar-chart-3" class="w-5 h-5 text-cyan-600"></i>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-cyan-600 uppercase tracking-wider">Cluster 2 & 5</p>
                        <h2 class="text-xl font-black">DATA — 数字で見る生物多様性</h2>
                    </div>
                </div>
                <p class="text-muted mb-6 leading-relaxed">自然共生サイト420+サイトの全データベース、経団連334社のアンケート分析、そしてikimonが持つ741件の学術論文参照。</p>

                <div class="space-y-2">
                    <a href="nature-coexistence-sites-analysis.php" class="article-link">
                        <span class="stat-pill bg-cyan-50 text-cyan-700">★★★</span>
                        <div class="min-w-0">
                            <p class="font-bold text-sm">自然共生サイト全420+認定 完全分析</p>
                            <p class="text-xs text-faint mt-0.5">都道府県・業種・活動類型マップ</p>
                        </div>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-gray-300 ml-auto flex-shrink-0"></i>
                    </a>
                    <a href="satoyama-initiative.php" class="article-link">
                        <span class="stat-pill bg-cyan-50 text-cyan-700">★★★</span>
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

    <!-- Cluster 3: HOW -->
    <section id="how" class="py-10 px-6 cluster-section">
        <div class="max-w-4xl mx-auto">
            <div class="cluster-card p-6 md:p-8" style="border-color: rgba(59, 130, 246, 0.15);">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                        <i data-lucide="building-2" class="w-5 h-5 text-blue-600"></i>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-blue-600 uppercase tracking-wider">Cluster 3</p>
                        <h2 class="text-xl font-black">HOW — 企業・自治体の取り組み</h2>
                    </div>
                </div>
                <p class="text-muted mb-6 leading-relaxed">経団連334社調査、TNFD対応209社分析、そしてikimonを活用した健康経営プログラム。</p>

                <div class="space-y-2">
                    <div class="article-link opacity-50 cursor-default">
                        <span class="stat-pill bg-gray-100 text-gray-400">★★☆</span>
                        <div class="min-w-0">
                            <p class="font-bold text-sm text-faint">経団連334社アンケートからわかること</p>
                            <p class="text-xs text-gray-300">準備中</p>
                        </div>
                    </div>
                    <a href="corporate-walking-program.php" class="article-link">
                        <span class="stat-pill bg-blue-50 text-blue-700">★★★</span>
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

    <!-- Cluster 6: DO -->
    <section id="do" class="py-10 px-6 cluster-section">
        <div class="max-w-4xl mx-auto">
            <div class="cluster-card p-6 md:p-8" style="border-color: rgba(245, 158, 11, 0.15);">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                        <i data-lucide="target" class="w-5 h-5 text-amber-600"></i>
                    </div>
                    <div>
                        <p class="text-xs font-bold text-amber-600 uppercase tracking-wider">Cluster 6</p>
                        <h2 class="text-xl font-black">DO — 始めてみよう</h2>
                    </div>
                </div>
                <p class="text-muted mb-6 leading-relaxed">明日からできること。あなたの近所から、世界の生物多様性に貢献する第一歩を。</p>

                <div class="space-y-2">
                    <div class="article-link opacity-50 cursor-default">
                        <span class="stat-pill bg-gray-100 text-gray-400">★★★</span>
                        <div class="min-w-0">
                            <p class="font-bold text-sm text-faint">ikimon×健康経営：お散歩プログラムの始め方</p>
                            <p class="text-xs text-gray-300">準備中 — B2B向け導入ガイド</p>
                        </div>
                    </div>
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
                    <a href="../post.php" class="cta-gradient text-white font-bold px-8 py-4 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg">
                        <i data-lucide="camera" class="w-5 h-5"></i>観察を始める
                    </a>
                    <a href="../about.php" class="bg-white text-text font-bold px-8 py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors border border-border">
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
