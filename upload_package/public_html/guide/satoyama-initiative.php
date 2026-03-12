<?php
/**
 * 里山イニシアチブとは？市民科学との接点
 * SEO: /guide/satoyama-initiative.php
 */
$meta_title = '里山イニシアチブとは？市民科学との接点をわかりやすく解説';
$meta_description = '2010年COP10で生まれた里山イニシアチブ（SATOYAMAイニシアティブ）を完全解説。IPSI 348組織、COMDEKS 20カ国の活動、30by30・OECMとの関係、市民参加型の生きもの調査がなぜ重要なのかを科学的根拠とともに紹介。';
$meta_canonical = 'https://ikimon.life/guide/satoyama-initiative.php';

require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/CspNonce.php';
Auth::init();
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/../components/meta.php'; ?>

    <meta property="og:type" content="article">

    <style>
        .article-hero {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(34, 197, 94, 0.08) 50%, rgba(22, 163, 74, 0.06) 100%);
        }

        .evidence-card {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(16, 185, 129, 0.12);
            border-left: 4px solid var(--color-primary);
            border-radius: 16px;
            padding: 20px 24px;
        }

        .stat-number {
            background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .timeline-item {
            position: relative;
            padding-left: 32px;
        }

        .timeline-item::before {
            content: '';
            position: absolute;
            left: 8px;
            top: 8px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: var(--color-primary);
        }

        .timeline-item::after {
            content: '';
            position: absolute;
            left: 13px;
            top: 24px;
            width: 2px;
            height: calc(100% - 4px);
            background: rgba(16, 185, 129, 0.2);
        }

        .timeline-item:last-child::after {
            display: none;
        }

        .approach-card {
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid rgba(16, 185, 129, 0.1);
            border-radius: 20px;
            transition: all 0.3s ease;
        }

        .approach-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(16, 185, 129, 0.08);
        }

        .blockquote-accent {
            border-left: 4px solid var(--color-primary);
            background: rgba(16, 185, 129, 0.04);
            border-radius: 0 12px 12px 0;
            padding: 16px 20px;
            font-style: italic;
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

        .section-anchor {
            scroll-margin-top: 80px;
        }
    </style>

    <script type="application/ld+json" nonce="<?= CspNonce::attr() ?>">
        {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "里山イニシアチブとは？市民科学との接点をわかりやすく解説",
            "author": {
                "@type": "Person",
                "name": "八巻 毅",
                "jobTitle": "IKIMON株式会社 代表取締役"
            },
            "publisher": {
                "@type": "Organization",
                "name": "ikimon.life"
            },
            "datePublished": "2026-03-09",
            "dateModified": "2026-03-09",
            "about": [
                { "@type": "Thing", "name": "里山イニシアチブ" },
                { "@type": "Thing", "name": "SATOYAMA Initiative" },
                { "@type": "Thing", "name": "生物多様性" },
                { "@type": "Thing", "name": "IPSI" },
                { "@type": "Thing", "name": "市民科学" }
            ]
        }
    </script>

    <script type="application/ld+json" nonce="<?= CspNonce::attr() ?>">
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": "里山イニシアチブとは何ですか？",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "里山イニシアチブ（SATOYAMAイニシアティブ）は、2010年のCBD COP10（名古屋）で発足した国際的な取り組みです。里山・里海のような人と自然が共存してきた二次的自然地域（SEPLS）の持続可能な維持・再構築を通じて「自然共生社会」の実現を目指します。"
                    }
                },
                {
                    "@type": "Question",
                    "name": "IPSIとは何ですか？",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "IPSI（International Partnership for the Satoyama Initiative）は里山イニシアチブ国際パートナーシップの略称で、2010年にCOP10会期中に51団体で発足し、2026年1月時点で348組織が参加しています。国連大学サステイナビリティ高等研究所（UNU-IAS）が事務局を務めます。"
                    }
                },
                {
                    "@type": "Question",
                    "name": "里山イニシアチブと市民科学の関係は？",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "里山イニシアチブは市民参加型の生きもの調査（市民科学）を重視しています。モニタリングサイト1000里地調査では18年間で5,700人以上の市民調査員が約298万件のデータを蓄積し、チョウ類の3分の1が急減していることを科学的に証明しました。ikimon.lifeのような市民参加型プラットフォームはこの理念を体現しています。"
                    }
                }
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
        <div class="max-w-3xl mx-auto">
            <ol class="flex items-center gap-2 text-sm text-gray-400">
                <li><a href="<?= defined('BASE_URL') ? rtrim(BASE_URL, '/') : '' ?>/index.php" class="hover:text-primary transition-colors">ホーム</a></li>
                <li class="text-gray-300">/</li>
                <li><a href="nature-positive.php" class="hover:text-primary transition-colors">ガイド</a></li>
                <li class="text-gray-300">/</li>
                <li class="text-gray-600 font-medium">里山イニシアチブ</li>
            </ol>
        </div>
    </nav>

    <!-- Hero -->
    <section class="pt-8 pb-12 px-6 article-hero">
        <div class="max-w-3xl mx-auto">
            <div class="flex flex-wrap gap-2 mb-6">
                <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                    <i data-lucide="mountain" class="w-3 h-3"></i>里山
                </span>
                <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                    <i data-lucide="globe" class="w-3 h-3"></i>国際枠組み
                </span>
                <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-700">
                    <i data-lucide="users" class="w-3 h-3"></i>市民科学
                </span>
            </div>

            <h1 class="text-3xl md:text-4xl font-black tracking-tight leading-tight mb-4">
                里山イニシアチブとは？<br class="md:hidden">市民科学との接点
            </h1>
            <p class="text-lg text-muted leading-relaxed mb-6">
                日本の「里山」の知恵が、世界の生物多様性保全の標準モデルに。<br>
                COP10で生まれた国際パートナーシップと、私たちにできること。
            </p>

            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">Y</div>
                <div>
                    <p class="text-sm font-bold">八巻 毅</p>
                    <p class="text-xs text-faint">2026年3月9日</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Key Numbers -->
    <section class="px-6 -mt-4 relative z-10">
        <div class="max-w-3xl mx-auto">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div class="evidence-card text-center" style="border-left-width: 1px;">
                    <p class="stat-number text-2xl md:text-3xl font-black">2010</p>
                    <p class="text-xs text-muted mt-1">COP10で発足</p>
                </div>
                <div class="evidence-card text-center" style="border-left-width: 1px;">
                    <p class="stat-number text-2xl md:text-3xl font-black">348</p>
                    <p class="text-xs text-muted mt-1">IPSI参加組織</p>
                </div>
                <div class="evidence-card text-center" style="border-left-width: 1px;">
                    <p class="stat-number text-2xl md:text-3xl font-black">20+</p>
                    <p class="text-xs text-muted mt-1">COMDEKS対象国</p>
                </div>
                <div class="evidence-card text-center" style="border-left-width: 1px;">
                    <p class="stat-number text-2xl md:text-3xl font-black">298万</p>
                    <p class="text-xs text-muted mt-1">里地調査データ件数</p>
                </div>
            </div>
        </div>
    </section>

    <!-- TOC -->
    <section class="py-8 px-6">
        <div class="max-w-3xl mx-auto">
            <div class="bg-surface rounded-2xl p-5 border border-border">
                <h2 class="text-base font-black mb-3 flex items-center gap-2">
                    <i data-lucide="list" class="w-4 h-4 text-primary"></i>
                    目次
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                    <a href="#what" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-emerald-600 font-bold w-4">1</span> 里山イニシアチブとは
                    </a>
                    <a href="#ipsi" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-emerald-600 font-bold w-4">5</span> IPSI国際パートナーシップ
                    </a>
                    <a href="#why" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-emerald-600 font-bold w-4">2</span> なぜ今、必要なのか
                    </a>
                    <a href="#cases" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-emerald-600 font-bold w-4">6</span> 世界と日本の活動事例
                    </a>
                    <a href="#approach" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-emerald-600 font-bold w-4">3</span> 3つの行動指針
                    </a>
                    <a href="#gbf" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-emerald-600 font-bold w-4">7</span> 30by30・OECMとの関係
                    </a>
                    <a href="#sepls" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-emerald-600 font-bold w-4">4</span> SEPLSとは
                    </a>
                    <a href="#citizen" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-emerald-600 font-bold w-4">8</span> 市民科学との接点
                    </a>
                </div>
            </div>
        </div>
    </section>


    <!-- Section 1: What -->
    <section id="what" class="py-8 px-6 section-anchor">
        <div class="max-w-3xl mx-auto">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <i data-lucide="sprout" class="w-5 h-5 text-emerald-600"></i>
                </div>
                <h2 class="text-xl font-black">里山イニシアチブとは</h2>
            </div>

            <div class="space-y-4 text-[15px] leading-relaxed text-muted">
                <p>
                    <strong class="text-text">SATOYAMAイニシアティブ</strong>は、里山・里海のような「人間が自然と寄り添いながら農林漁業を通じて形成・維持してきた二次的自然地域」を守り、再生するための国際的な取り組みです。
                </p>
                <p>
                    日本語の「里山」は、集落周辺の雑木林・農地・ため池・草地が一体となった自然環境を意味しますが、同様の仕組みは世界各地に存在しています。SATOYAMAイニシアティブは、この日本の知恵を国際語として広め、<strong class="text-text">「自然共生社会」の実現</strong>を目指しています。
                </p>

                <div class="blockquote-accent">
                    <p class="text-sm">
                        自然を「手つかずのまま保護する」のではなく、人間が適切に関わりながら利用・管理することで、<strong>生物多様性と人の暮らしの両方を持続させる</strong>。これが里山イニシアチブの核心です。
                    </p>
                </div>

                <h3 class="text-base font-black text-text pt-4 flex items-center gap-2">
                    <i data-lucide="clock" class="w-4 h-4 text-primary"></i>
                    成立までの経緯
                </h3>

                <div class="space-y-4 ml-2">
                    <div class="timeline-item pb-4">
                        <p class="text-xs font-bold text-emerald-600">2009年7月</p>
                        <p class="text-sm">東京で第1回準備会合を開催</p>
                    </div>
                    <div class="timeline-item pb-4">
                        <p class="text-xs font-bold text-emerald-600">2010年1月</p>
                        <p class="text-sm">パリ（UNESCO本部）で国際有識者会合 →「パリ宣言」採択</p>
                    </div>
                    <div class="timeline-item pb-4">
                        <p class="text-xs font-bold text-emerald-600">2010年10月</p>
                        <p class="text-sm">名古屋COP10で正式承認。<strong>IPSI</strong>が51団体の創設メンバーで発足</p>
                    </div>
                    <div class="timeline-item">
                        <p class="text-xs font-bold text-emerald-600">2022年12月</p>
                        <p class="text-sm">COP15で昆明・モントリオールGBF採択。里山イニシアチブがGBF実施の具体的手段に</p>
                    </div>
                </div>
            </div>
        </div>
    </section>


    <!-- Section 2: Why -->
    <section id="why" class="py-8 px-6 bg-surface section-anchor">
        <div class="max-w-3xl mx-auto">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                    <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-600"></i>
                </div>
                <h2 class="text-xl font-black">なぜ今、里山イニシアチブが必要なのか</h2>
            </div>

            <div class="space-y-4 text-[15px] leading-relaxed text-muted">
                <p>
                    世界中で、人と自然が調和しながら維持されてきた<strong class="text-text">二次的自然地域が急速に失われています</strong>。日本では過疎化・高齢化による伝統的な土地利用の放棄が、海外では近代的な農業や開発による土地利用転換が主因です。
                </p>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div class="evidence-card">
                        <p class="stat-number text-xl font-black">チョウ類 1/3 が急減</p>
                        <p class="text-xs text-muted mt-1">モニタリングサイト1000里地調査（2005〜2022年度）で、103種中34種が10年あたり30%以上の減少率</p>
                    </div>
                    <div class="evidence-card">
                        <p class="stat-number text-xl font-black">鳥類 15% が急減</p>
                        <p class="text-xs text-muted mt-1">106種中16種が同水準で減少。農地・草原・湿地など開けた環境の種が特に深刻</p>
                    </div>
                </div>

                <p>
                    保護区（自然公園など）だけでは、陸域の約17%程度しかカバーできません。保護区の「外側」にある里山のような場所を守らなければ、生物多様性の損失は止められない。これが里山イニシアチブが生まれた背景です。
                </p>
            </div>
        </div>
    </section>


    <!-- Section 3: Approach -->
    <section id="approach" class="py-8 px-6 section-anchor">
        <div class="max-w-3xl mx-auto">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <i data-lucide="compass" class="w-5 h-5 text-blue-600"></i>
                </div>
                <h2 class="text-xl font-black">3つの行動指針</h2>
            </div>

            <p class="text-[15px] text-muted leading-relaxed mb-6">
                SATOYAMAイニシアティブは、ランドスケープ（景観）の維持・再構築に向けて3つのアプローチを掲げています。
            </p>

            <div class="grid grid-cols-1 gap-4">
                <div class="approach-card p-5">
                    <div class="flex items-start gap-4">
                        <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <span class="text-emerald-700 font-black">1</span>
                        </div>
                        <div>
                            <h3 class="font-black text-sm mb-1">知恵の結集</h3>
                            <p class="text-sm text-muted leading-relaxed">自然からのさまざまな恵み（食料・水・燃料・文化的価値など）を総合的に理解し、多様な生態系サービスを最大限に活用する。</p>
                        </div>
                    </div>
                </div>

                <div class="approach-card p-5">
                    <div class="flex items-start gap-4">
                        <div class="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <span class="text-blue-700 font-black">2</span>
                        </div>
                        <div>
                            <h3 class="font-black text-sm mb-1">伝統的知識と近代科学の融合</h3>
                            <p class="text-sm text-muted leading-relaxed">地域に代々伝わる経験知と現代の科学的知見を組み合わせ、より効果的な資源管理を実現する。市民科学はまさにこのアプローチの実践。</p>
                        </div>
                    </div>
                </div>

                <div class="approach-card p-5">
                    <div class="flex items-start gap-4">
                        <div class="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                            <span class="text-violet-700 font-black">3</span>
                        </div>
                        <div>
                            <h3 class="font-black text-sm mb-1">新たな共同管理のあり方</h3>
                            <p class="text-sm text-muted leading-relaxed">土地所有者や地域住民だけでなく、企業・行政・研究者・市民など多様な関係者が参画する新しい資源管理の枠組みを探求する。</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>


    <!-- Section 4: SEPLS -->
    <section id="sepls" class="py-8 px-6 bg-surface section-anchor">
        <div class="max-w-3xl mx-auto">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                    <i data-lucide="map-pin" class="w-5 h-5 text-cyan-600"></i>
                </div>
                <h2 class="text-xl font-black">SEPLS — 社会生態学的生産ランドスケープ</h2>
            </div>

            <div class="space-y-4 text-[15px] leading-relaxed text-muted">
                <p>
                    里山イニシアチブでは、対象となる地域を<strong class="text-text">SEPLS（Socio-ecological Production Landscapes and Seascapes）</strong>と呼びます。人間の生産活動（農業・林業・漁業など）と生物多様性が共存し、生物の生息地と土地利用がモザイク状に分布している場所です。
                </p>

                <div class="bg-white rounded-2xl border border-border p-5">
                    <h3 class="font-black text-sm mb-3">SEPLSが提供する生態系サービス</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div class="flex items-start gap-3">
                            <div class="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                <i data-lucide="wheat" class="w-4 h-4 text-emerald-600"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-text">供給サービス</p>
                                <p class="text-xs text-muted">食料、木材、燃料、繊維、薬用植物</p>
                            </div>
                        </div>
                        <div class="flex items-start gap-3">
                            <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                <i data-lucide="droplets" class="w-4 h-4 text-blue-600"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-text">調整サービス</p>
                                <p class="text-xs text-muted">水質浄化、洪水制御、受粉、気候調整</p>
                            </div>
                        </div>
                        <div class="flex items-start gap-3">
                            <div class="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                                <i data-lucide="palette" class="w-4 h-4 text-violet-600"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-text">文化的サービス</p>
                                <p class="text-xs text-muted">景観、伝統文化、レクリエーション、教育</p>
                            </div>
                        </div>
                        <div class="flex items-start gap-3">
                            <div class="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                                <i data-lucide="layers" class="w-4 h-4 text-amber-600"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-text">基盤サービス</p>
                                <p class="text-xs text-muted">土壌形成、栄養循環</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>


    <!-- Section 5: IPSI -->
    <section id="ipsi" class="py-8 px-6 section-anchor">
        <div class="max-w-3xl mx-auto">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <i data-lucide="network" class="w-5 h-5 text-indigo-600"></i>
                </div>
                <h2 class="text-xl font-black">IPSI — 国際パートナーシップ</h2>
            </div>

            <div class="space-y-4 text-[15px] leading-relaxed text-muted">
                <p>
                    <strong class="text-text">IPSI（International Partnership for the Satoyama Initiative）</strong>は、里山イニシアチブを推進する国際的なプラットフォームです。2010年にCOP10で51団体が創設メンバーとして発足し、<strong class="text-text">2026年1月時点で348組織</strong>にまで拡大しています。
                </p>

                <div class="evidence-card">
                    <h3 class="font-black text-sm mb-3">参加組織の構成</h3>
                    <div class="flex flex-wrap gap-2">
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">国・地方政府機関</span>
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200">NGO・市民社会</span>
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs bg-violet-50 text-violet-700 border border-violet-200">大学・研究機関</span>
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200">先住民・地域コミュニティ</span>
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs bg-cyan-50 text-cyan-700 border border-cyan-200">産業・民間セクター</span>
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs bg-rose-50 text-rose-700 border border-rose-200">国連・国際機関</span>
                    </div>
                </div>

                <p>
                    事務局は<strong class="text-text">国連大学サステイナビリティ高等研究所（UNU-IAS）</strong>が務めており、世界各地のSEPLS事例（ケーススタディ）の収集・共有、レジリエンス指標の開発、定期総会の開催などを行っています。
                </p>
            </div>
        </div>
    </section>


    <!-- Section 6: Cases -->
    <section id="cases" class="py-8 px-6 bg-surface section-anchor">
        <div class="max-w-3xl mx-auto">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                    <i data-lucide="globe-2" class="w-5 h-5 text-teal-600"></i>
                </div>
                <h2 class="text-xl font-black">世界と日本の活動事例</h2>
            </div>

            <div class="space-y-6 text-[15px] leading-relaxed text-muted">

                <!-- COMDEKS -->
                <div>
                    <h3 class="font-black text-base text-text mb-3 flex items-center gap-2">
                        <i data-lucide="handshake" class="w-4 h-4 text-primary"></i>
                        COMDEKS — 旗艦プログラム
                    </h3>
                    <p class="mb-3">
                        <strong class="text-text">COMDEKS（Community Development and Knowledge Management for the Satoyama Initiative）</strong>は、UNDPが実施する里山イニシアチブの旗艦プログラムです。2011年の開始以来、<strong class="text-text">20カ国・216地域</strong>の市民社会組織を支援してきました。
                    </p>
                    <div class="evidence-card">
                        <p class="text-sm"><strong>フェーズ4（2023〜2028年）</strong>では、日本政府が約7億円、経団連自然保護協議会が3億円を拠出。ブラジル、カンボジア、エチオピア、インド、ネパールなど約20の途上国が対象です。</p>
                    </div>
                </div>

                <!-- Japan -->
                <div>
                    <h3 class="font-black text-base text-text mb-3 flex items-center gap-2">
                        <i data-lucide="map" class="w-4 h-4 text-primary"></i>
                        日本国内の取り組み
                    </h3>
                    <div class="space-y-3">
                        <div class="bg-white rounded-xl border border-border p-4">
                            <p class="font-bold text-sm text-text mb-1">モニタリングサイト1000 里地調査</p>
                            <p class="text-sm text-muted">環境省と日本自然保護協会の共同事業。全国325か所で<strong>5,700人以上の市民調査員</strong>が参加し、18年間で約<strong>298万件</strong>のデータを蓄積。124本の学術論文に引用されています。</p>
                        </div>
                        <div class="bg-white rounded-xl border border-border p-4">
                            <p class="font-bold text-sm text-text mb-1">里山一斉調査（大阪府）</p>
                            <p class="text-sm text-muted">市民が参加して里山の指標生物を調査。絶滅危惧種よりも環境を代表する「親しみやすい種」を重視し、調査を通じた環境教育効果も大きいプログラムです。</p>
                        </div>
                        <div class="bg-white rounded-xl border border-border p-4">
                            <p class="font-bold text-sm text-text mb-1">かわごえ里山イニシアチブ（埼玉県川越市）</p>
                            <p class="text-sm text-muted">無農薬の米作りを通じた生きものの賑わいの回復。地域コミュニティが主体となって里山の保全と活用を実践しています。</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>


    <!-- Section 7: GBF / 30by30 / OECM -->
    <section id="gbf" class="py-8 px-6 section-anchor">
        <div class="max-w-3xl mx-auto">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <i data-lucide="target" class="w-5 h-5 text-green-600"></i>
                </div>
                <h2 class="text-xl font-black">30by30・OECM・GBFとの関係</h2>
            </div>

            <div class="space-y-4 text-[15px] leading-relaxed text-muted">
                <p>
                    2022年にCOP15で採択された<strong class="text-text">昆明・モントリオール生物多様性枠組み（GBF）</strong>は、2030年までに陸域・海域の30%以上を保全する「30by30」目標を掲げています。里山イニシアチブはこの実現に直結しています。
                </p>

                <div class="bg-white rounded-2xl border border-border overflow-hidden">
                    <div class="grid grid-cols-1 divide-y divide-border">
                        <div class="p-4 flex items-start gap-3">
                            <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-black flex-shrink-0">T3</span>
                            <div>
                                <p class="font-bold text-sm text-text">30by30 目標</p>
                                <p class="text-sm text-muted">里山は<strong>OECM（その他の効果的な地域に基づく保全手段）</strong>として保全面積に算入可能。日本では2023年から「自然共生サイト」認定制度が開始されています。</p>
                            </div>
                        </div>
                        <div class="p-4 flex items-start gap-3">
                            <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-blue-700 text-xs font-black flex-shrink-0">T10</span>
                            <div>
                                <p class="font-bold text-sm text-text">持続可能な農林水産業</p>
                                <p class="text-sm text-muted">SEPLSの持続可能な管理そのものがこのターゲットに対応。里山的な土地利用は生物多様性と食料生産を両立させます。</p>
                            </div>
                        </div>
                        <div class="p-4 flex items-start gap-3">
                            <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100 text-violet-700 text-xs font-black flex-shrink-0">T21</span>
                            <div>
                                <p class="font-bold text-sm text-text">データ・知識の蓄積</p>
                                <p class="text-sm text-muted">IPSIのケーススタディ蓄積や市民科学データが、意思決定のための科学的基盤を提供します。<strong>ikimonのデータもここに貢献。</strong></p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="blockquote-accent">
                    <p class="text-sm">
                        <strong>自然共生サイト</strong>（日本版OECM）には、市民団体が保全する里山、企業の水源林、鎮守の森、都市緑地などが認定されています。里山イニシアチブ推進ネットワークは30by30アライアンスの参加組織です。
                    </p>
                </div>
            </div>
        </div>
    </section>


    <!-- Section 8: Citizen Science -->
    <section id="citizen" class="py-8 px-6 bg-surface section-anchor">
        <div class="max-w-3xl mx-auto">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                    <i data-lucide="users" class="w-5 h-5 text-violet-600"></i>
                </div>
                <h2 class="text-xl font-black">市民科学との接点 — あなたの記録が世界を変える</h2>
            </div>

            <div class="space-y-4 text-[15px] leading-relaxed text-muted">
                <p>
                    里山イニシアチブは、専門家だけでなく<strong class="text-text">地域住民や一般市民が生物多様性のモニタリングに参加すること</strong>を重視しています。モニタリングサイト1000里地調査の18年間の成果が、その価値を証明しました。
                </p>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div class="evidence-card">
                        <div class="flex items-center gap-2 mb-2">
                            <i data-lucide="clock" class="w-4 h-4 text-primary"></i>
                            <p class="font-bold text-sm text-text">長期変化の早期把握</p>
                        </div>
                        <p class="text-xs text-muted">100年スケールの変化を捉えるための観測基盤を構築</p>
                    </div>
                    <div class="evidence-card">
                        <div class="flex items-center gap-2 mb-2">
                            <i data-lucide="thermometer" class="w-4 h-4 text-primary"></i>
                            <p class="font-bold text-sm text-text">温暖化影響の追跡</p>
                        </div>
                        <p class="text-xs text-muted">気候変動による種の分布変化をリアルタイムでモニタリング</p>
                    </div>
                    <div class="evidence-card">
                        <div class="flex items-center gap-2 mb-2">
                            <i data-lucide="book-open" class="w-4 h-4 text-primary"></i>
                            <p class="font-bold text-sm text-text">環境教育の実践</p>
                        </div>
                        <p class="text-xs text-muted">参加者が生きものの名前を覚え、四季の変化を肌で感じる体験</p>
                    </div>
                    <div class="evidence-card">
                        <div class="flex items-center gap-2 mb-2">
                            <i data-lucide="database" class="w-4 h-4 text-primary"></i>
                            <p class="font-bold text-sm text-text">科学的価値の創出</p>
                        </div>
                        <p class="text-xs text-muted">124本の学術論文に引用。政策立案の根拠データに</p>
                    </div>
                </div>

                <!-- ikimon connection -->
                <div class="bg-gradient-to-br from-emerald-50 via-white to-cyan-50 rounded-2xl border border-emerald-200 p-6 mt-6">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                            <i data-lucide="leaf" class="w-5 h-5 text-white"></i>
                        </div>
                        <h3 class="font-black text-base">ikimonと里山イニシアチブ</h3>
                    </div>
                    <p class="text-sm text-muted leading-relaxed mb-4">
                        市民参加型の生きもの調査プラットフォーム<strong class="text-text">ikimon</strong>は、里山イニシアチブが重視する理念を体現しています。
                    </p>
                    <div class="space-y-2">
                        <div class="flex items-center gap-2">
                            <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-500 flex-shrink-0"></i>
                            <p class="text-sm">市民による生きもの観察データの蓄積（<strong>市民科学</strong>）</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-500 flex-shrink-0"></i>
                            <p class="text-sm">身近な自然環境（里山的な場所）への関心喚起</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-500 flex-shrink-0"></i>
                            <p class="text-sm">地域の生物多様性の「見える化」</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-500 flex-shrink-0"></i>
                            <p class="text-sm">GBFターゲット21（意思決定のためのデータ）への貢献</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-500 flex-shrink-0"></i>
                            <p class="text-sm">OECMの根拠データとしての活用可能性</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>


    <!-- CTA -->
    <section class="py-16 px-6">
        <div class="max-w-3xl mx-auto">
            <div class="bg-gradient-to-br from-emerald-50 via-violet-50 to-cyan-50 rounded-[2rem] p-8 md:p-12 border border-gray-200 text-center">
                <h2 class="text-2xl font-black mb-3">あなたの観察が、里山を守る力になる</h2>
                <p class="text-muted mb-6 max-w-lg mx-auto leading-relaxed text-sm">
                    里山イニシアチブの理念に賛同する方へ。ikimonで身近な生きものを記録することが、生物多様性保全の第一歩です。
                </p>
                <div class="flex flex-col sm:flex-row justify-center gap-3">
                    <a href="../post.php" class="cta-gradient text-white font-bold px-6 py-3 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg text-sm">
                        <i data-lucide="camera" class="w-4 h-4"></i>観察を始める
                    </a>
                    <a href="nature-positive.php" class="bg-white text-text font-bold px-6 py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors border border-border text-sm">
                        <i data-lucide="book-open" class="w-4 h-4"></i>ガイド一覧へ戻る
                    </a>
                </div>
            </div>
        </div>
    </section>

    </main>

    <?php include __DIR__ . '/../components/footer.php'; ?>

</body>

</html>
