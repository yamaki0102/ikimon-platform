<?php
require_once __DIR__ . '/../../libs/Auth.php';
Auth::init();

$meta_title = 'ネイチャーポジティブとは？｜2030年までに自然を回復させる世界目標を完全解説';
$meta_description = 'ネイチャーポジティブ(自然再興)の意味、背景、昆明モントリオール目標(30by30)、日本の自然共生サイト420+認定、そしてあなたにできることを体系的に解説。初心者でもわかるネイチャーポジティブ完全ガイド。';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/../components/meta.php'; ?>
    <meta name="robots" content="noindex, nofollow">
    <style>
        .article-hero {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.08) 50%, rgba(34, 197, 94, 0.05) 100%);
        }

        .evidence-card {
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(16, 185, 129, 0.15);
            transition: all 0.3s ease;
        }

        .evidence-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 32px rgba(16, 185, 129, 0.12);
        }

        .stat-number {
            background: linear-gradient(135deg, var(--color-primary), #06b6d4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .blockquote-accent {
            border-left: 4px solid var(--color-primary);
            background: rgba(16, 185, 129, 0.04);
        }

        .cta-gradient {
            background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
        }

        .timeline-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: var(--color-primary);
            border: 3px solid white;
            box-shadow: 0 0 0 2px var(--color-primary);
        }
    </style>

    <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "ネイチャーポジティブとは？｜2030年までに自然を回復させる世界目標を完全解説",
            "author": {
                "@type": "Person",
                "name": "八巻 毅"
            },
            "publisher": {
                "@type": "Organization",
                "name": "ikimon.life"
            },
            "datePublished": "2026-02-27",
            "dateModified": "2026-02-27"
        }
    </script>
    <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [{
                    "@type": "Question",
                    "name": "ネイチャーポジティブとは何ですか？",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "ネイチャーポジティブ（自然再興）とは、2030年までに自然の損失を止め、回復に向かわせるという世界目標です。2022年のCOP15で採択された昆明・モントリオール生物多様性枠組（GBF）で正式に掲げられました。カーボンニュートラルが気候変動対策なら、ネイチャーポジティブは生物多様性版の世界目標です。"
                    }
                },
                {
                    "@type": "Question",
                    "name": "30by30（サーティ・バイ・サーティ）とは？",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "2030年までに陸と海の30%以上を保全地域にするという国際目標です。日本では国立公園だけでは不足するため、企業や個人の土地を『自然共生サイト』として認定する制度が2023年にスタートしました。2026年現在、約420サイトが認定されています。"
                    }
                },
                {
                    "@type": "Question",
                    "name": "個人にできるネイチャーポジティブの行動は？",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "最も手軽で効果的なのは『市民科学への参加』です。ikimonのようなプラットフォームで生きものを観察・記録するだけで、①生物多様性のモニタリングデータの提供 ②自然への関心と理解の深化 ③お散歩による健康増進——の三重の効果が得られます。"
                    }
                }
            ]
        }
    </script>
</head>

<body class="js-loading bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">

    <?php include __DIR__ . '/../components/nav.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <nav class="pt-24 px-6">
        <div class="max-w-4xl mx-auto">
            <ol class="flex items-center gap-2 text-sm text-gray-400">
                <li><a href="../index.php" class="hover:text-[var(--color-primary)]">ホーム</a></li>
                <li>/</li>
                <li><a href="nature-positive.php" class="hover:text-[var(--color-primary)]">ガイド</a></li>
                <li>/</li>
                <li class="text-gray-600">ネイチャーポジティブとは</li>
            </ol>
        </div>
    </nav>

    <section class="pt-8 pb-12 px-6 article-hero">
        <div class="max-w-4xl mx-auto">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold mb-6">
                <i data-lucide="leaf" class="w-3.5 h-3.5"></i> Cluster 1: WHY
            </span>
            <h1 class="text-3xl md:text-5xl font-black tracking-tight leading-tight mb-6">
                <span class="stat-number">ネイチャーポジティブ</span>とは？
            </h1>
            <p class="text-xl text-gray-500 mb-8">2030年までに自然を回復させる世界目標を完全解説</p>

            <div class="blockquote-accent rounded-xl p-6 mb-8">
                <p class="text-gray-700 leading-relaxed">
                    <strong>ネイチャーポジティブ（自然再興）とは、2030年までに自然の損失を止め、回復に向かわせるという世界目標です。</strong>
                    カーボンニュートラルが気候変動への答えなら、ネイチャーポジティブは生物多様性の危機への答え。日本では「30by30」目標のもと、約420サイトが自然共生サイトとして認定され、企業から個人まで参加が広がっています。
                </p>
            </div>

            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center text-lg font-black text-[#05070a]">Y</div>
                <div>
                    <p class="text-sm font-bold">八巻 毅</p>
                    <p class="text-xs text-gray-400">IKIMON株式会社 代表 / 愛管株式会社 自然共生サイト認定取得者</p>
                    <p class="text-xs text-gray-400 mt-0.5">最終更新: 2026年2月27日</p>
                </div>
            </div>
        </div>
    </section>

    <section class="py-12 px-6">
        <div class="max-w-4xl mx-auto">
            <article class="prose prose-lg max-w-none space-y-12">

                <!-- なぜ今？ -->
                <div>
                    <h2 class="text-2xl font-bold mb-6">なぜ今「ネイチャーポジティブ」なのか</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                        <div class="evidence-card rounded-2xl p-5 text-center">
                            <p class="text-3xl font-black stat-number">100万</p>
                            <p class="text-sm text-gray-600 mt-1">種が絶滅の危機<br><span class="text-xs text-gray-400">IPBES 2019</span></p>
                        </div>
                        <div class="evidence-card rounded-2xl p-5 text-center">
                            <p class="text-3xl font-black stat-number">69%</p>
                            <p class="text-sm text-gray-600 mt-1">野生動物が1970年から減少<br><span class="text-xs text-gray-400">WWF Living Planet 2022</span></p>
                        </div>
                        <div class="evidence-card rounded-2xl p-5 text-center">
                            <p class="text-3xl font-black stat-number">$44兆</p>
                            <p class="text-sm text-gray-600 mt-1">世界GDPの半分以上が<br>自然に依存<br><span class="text-xs text-gray-400">WEF 2020</span></p>
                        </div>
                    </div>
                    <p class="text-gray-700 leading-relaxed">
                        生物多様性の損失は気候変動と並ぶ地球規模のリスクです。しかし「カーボンニュートラル」に比べ認知度は低い。
                        そこで2022年のCOP15で<strong>「昆明・モントリオール生物多様性枠組（GBF）」</strong>が採択され、
                        「ネイチャーポジティブ」が正式な世界目標として掲げられました。
                    </p>
                </div>

                <!-- 30by30 -->
                <div>
                    <h2 class="text-2xl font-bold mb-6">30by30：2030年までに陸と海の30%を保全</h2>
                    <p class="text-gray-700 leading-relaxed mb-6">
                        GBFの中核目標が<strong>「30by30（サーティ・バイ・サーティ）」</strong>。
                        2030年までに陸と海の30%以上を効果的に保全するというものです。
                    </p>
                    <div class="evidence-card rounded-2xl p-6 my-6">
                        <h4 class="font-bold text-gray-900 mb-3">🇯🇵 日本の現状</h4>
                        <ul class="space-y-2 text-sm">
                            <li class="flex items-start gap-3">
                                <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                                <span>国立公園等の保護地域：陸域 <strong>約20.5%</strong></span>
                            </li>
                            <li class="flex items-start gap-3">
                                <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>
                                <span>30%まであと<strong>約10%</strong>の上積みが必要</span>
                            </li>
                            <li class="flex items-start gap-3">
                                <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                                <span>→ 国が新設した制度が<strong>「自然共生サイト」</strong>（OECM）</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <!-- 自然共生サイト -->
                <div>
                    <h2 class="text-2xl font-bold mb-6">自然共生サイト：企業も個人も参加できる認定制度</h2>
                    <p class="text-gray-700 leading-relaxed mb-6">
                        自然共生サイトは、国立公園じゃないけれど生物多様性が保全されている場所を環境省が認定する制度です。
                        企業の敷地、大学キャンパス、個人の森——<strong>誰でも申請できる</strong>のが特徴です。
                    </p>

                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 my-6">
                        <div class="evidence-card rounded-2xl p-4 text-center">
                            <p class="text-2xl font-black stat-number">420+</p>
                            <p class="text-xs text-gray-500">認定サイト数<br>(2026年2月時点)</p>
                        </div>
                        <div class="evidence-card rounded-2xl p-4 text-center">
                            <p class="text-2xl font-black stat-number">87%</p>
                            <p class="text-xs text-gray-500">が「維持」型<br>(既存自然の保全)</p>
                        </div>
                        <div class="evidence-card rounded-2xl p-4 text-center">
                            <p class="text-2xl font-black stat-number">35%</p>
                            <p class="text-xs text-gray-500">が大企業<br>(製造業中心)</p>
                        </div>
                        <div class="evidence-card rounded-2xl p-4 text-center">
                            <p class="text-2xl font-black stat-number">15%</p>
                            <p class="text-xs text-gray-500">が中小企業<br>(愛管株式会社含む)</p>
                        </div>
                    </div>

                    <div class="blockquote-accent rounded-xl p-5 my-6">
                        <p class="text-sm text-gray-600 italic">
                            💡 <strong>当事者として</strong>：私の所属する愛管株式会社は浜松市で「連理の木の下で」を自然共生サイトに認定取得しました。
                            中小企業でも申請でき、プロセスで自社の生物多様性を「見える化」する効果があります。
                            <a href="aikan-renri-report.php" class="text-emerald-600 font-bold hover:underline">→ 詳しい体験レポートはこちら</a>
                        </p>
                    </div>
                </div>

                <!-- 企業の動き -->
                <div>
                    <h2 class="text-2xl font-bold mb-6">企業は動いている：経団連334社のリアル</h2>
                    <p class="text-gray-700 leading-relaxed mb-6">
                        経団連自然保護協議会の調査（2023年）によると、回答した<strong>334社のうち84%が生物多様性に「関心がある」</strong>と回答。
                        一方で具体的な行動に移せている企業は限定的です。
                    </p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                        <div class="evidence-card rounded-2xl p-5">
                            <h4 class="font-bold text-sm text-gray-900 mb-3">📊 経団連調査の主要データ</h4>
                            <ul class="space-y-2 text-sm text-gray-600">
                                <li>• 84%が生物多様性に関心あり</li>
                                <li>• 67%がSDGsと連動して取り組み</li>
                                <li>• TNFD対応を検討中: 42%</li>
                                <li>• 実際に自然共生サイト申請: 約10%</li>
                            </ul>
                        </div>
                        <div class="evidence-card rounded-2xl p-5">
                            <h4 class="font-bold text-sm text-gray-900 mb-3">🏢 参加企業の例</h4>
                            <ul class="space-y-2 text-sm text-gray-600">
                                <li>• トヨタ・サントリー・花王（製造）</li>
                                <li>• 三井不動産・大林組（建設・不動産）</li>
                                <li>• 北海道大学・慶應義塾（教育）</li>
                                <li>• <strong>愛管株式会社</strong>（中小・浜松市初）</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- あなたにできること -->
                <div>
                    <h2 class="text-2xl font-bold mb-6">あなたにできるネイチャーポジティブ</h2>
                    <div class="space-y-4">
                        <div class="evidence-card rounded-2xl p-5 flex items-start gap-4">
                            <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0"><span class="font-bold text-emerald-700">1</span></div>
                            <div>
                                <h4 class="font-bold text-sm mb-1">市民科学に参加する</h4>
                                <p class="text-sm text-gray-600">ikimonで生きものを観察・記録。あなたのデータが科学に貢献します。</p>
                            </div>
                        </div>
                        <div class="evidence-card rounded-2xl p-5 flex items-start gap-4">
                            <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0"><span class="font-bold text-emerald-700">2</span></div>
                            <div>
                                <h4 class="font-bold text-sm mb-1">お散歩で健康と自然を同時に得る</h4>
                                <p class="text-sm text-gray-600">1日9,800歩で認知症-51%。<a href="steps-dementia-prevention.php" class="text-emerald-600 font-bold hover:underline">歩数×脳の科学</a>も読んでみてください。</p>
                            </div>
                        </div>
                        <div class="evidence-card rounded-2xl p-5 flex items-start gap-4">
                            <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0"><span class="font-bold text-emerald-700">3</span></div>
                            <div>
                                <h4 class="font-bold text-sm mb-1">身近な自然を「見る目」を持つ</h4>
                                <p class="text-sm text-gray-600">種の同定は<a href="species-id-brain-training.php" class="text-emerald-600 font-bold hover:underline">最高の脳トレ</a>。認知的予備力も構築されます。</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- FAQ -->
                <div id="faq" class="mt-12">
                    <h2 class="text-2xl font-bold mb-8">よくある質問</h2>
                    <div class="space-y-4">
                        <details class="evidence-card rounded-2xl overflow-hidden">
                            <summary class="p-5 font-bold cursor-pointer hover:bg-gray-50">Q. ネイチャーポジティブとは何ですか？</summary>
                            <div class="px-5 pb-5 text-sm text-gray-600">自然の損失を止め、回復に向かわせるという世界目標です。COP15で採択されたGBF（昆明・モントリオール枠組）で正式に掲げられました。</div>
                        </details>
                        <details class="evidence-card rounded-2xl overflow-hidden">
                            <summary class="p-5 font-bold cursor-pointer hover:bg-gray-50">Q. 30by30とは？</summary>
                            <div class="px-5 pb-5 text-sm text-gray-600">2030年までに陸と海の30%以上を保全地域にする国際目標です。日本では「自然共生サイト」制度で企業・個人の土地も保全地域にカウントしています。</div>
                        </details>
                        <details class="evidence-card rounded-2xl overflow-hidden">
                            <summary class="p-5 font-bold cursor-pointer hover:bg-gray-50">Q. 個人にできることは？</summary>
                            <div class="px-5 pb-5 text-sm text-gray-600">ikimonのような市民科学プラットフォームで生きものを観察・記録するのが最も手軽で効果的です。お散歩しながらの観察は健康増進にもなります。</div>
                        </details>
                    </div>
                </div>

            </article>

            <!-- CTA -->
            <div class="mt-16 glass-card rounded-[2rem] p-8 md:p-12 border border-gray-200 text-center">
                <h3 class="text-2xl font-bold mb-4">自然と歩こう</h3>
                <p class="text-gray-500 mb-8 max-w-lg mx-auto">ikimonで生きものを観察。あなたの一歩がネイチャーポジティブの一歩に。</p>
                <div class="flex flex-col sm:flex-row justify-center gap-4">
                    <a href="../post.php" class="cta-gradient text-white font-bold px-8 py-4 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                        <i data-lucide="camera" class="w-5 h-5"></i>観察を始める
                    </a>
                    <a href="nature-positive.php" class="bg-gray-100 text-gray-700 font-bold px-8 py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors">
                        <i data-lucide="book-open" class="w-5 h-5"></i>完全ガイドに戻る
                    </a>
                </div>
            </div>

            <div class="mt-16">
                <h3 class="text-xl font-bold mb-6">関連記事</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <a href="walking-brain-science.php" class="evidence-card rounded-2xl p-5 block">
                        <span class="text-xs text-emerald-600 font-bold">Cluster 1</span>
                        <p class="font-bold text-sm mt-2">自然の中を歩くと脳に何が起きるのか？</p>
                    </a>
                    <a href="aikan-renri-report.php" class="evidence-card rounded-2xl p-5 block">
                        <span class="text-xs text-cyan-600 font-bold">Cluster 5</span>
                        <p class="font-bold text-sm mt-2">自然共生サイト認定レポート「連理の木の下で」</p>
                    </a>
                    <a href="nature-positive.php" class="evidence-card rounded-2xl p-5 block">
                        <span class="text-xs text-blue-600 font-bold">ピラーページ</span>
                        <p class="font-bold text-sm mt-2">ネイチャーポジティブ完全ガイド</p>
                    </a>
                </div>
            </div>
        </div>
    </section>

    <?php include __DIR__ . '/../components/footer.php'; ?>
</body>

</html>