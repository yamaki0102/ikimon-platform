<?php
/**
 * 日本の生物多様性——世界が注目する島国の自然
 * SEO: /guide/japan-biodiversity.php
 */
$meta_title = '日本の生物多様性——世界が注目する島国の自然｜ikimon.life';
$meta_description = '日本は世界36の生物多様性ホットスポットの1つ。哺乳類の約40%、両生類の約74%が固有種。COP10愛知目標から昆明モントリオールGBFへ、30by30、TNFDまで——日本の生物多様性の全体像を科学的データとともに解説。';
$meta_image = 'https://ikimon.life/guide/ogp/japan-biodiversity.png';
$meta_canonical = 'https://ikimon.life/guide/japan-biodiversity.php';

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
            background: linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(16, 185, 129, 0.06) 50%, rgba(59, 130, 246, 0.06) 100%);
        }

        .evidence-card {
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(6, 182, 212, 0.15);
            transition: all 0.3s ease;
        }

        .evidence-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 32px rgba(6, 182, 212, 0.12);
        }

        .stat-number {
            background: linear-gradient(135deg, #0891b2, var(--color-primary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .blockquote-accent {
            border-left: 4px solid #0891b2;
            background: rgba(6, 182, 212, 0.04);
        }

        .cta-gradient {
            background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
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
            background: #0891b2;
        }

        .timeline-item::after {
            content: '';
            position: absolute;
            left: 13px;
            top: 24px;
            bottom: -12px;
            width: 2px;
            background: rgba(6, 182, 212, 0.2);
        }

        .timeline-item:last-child::after {
            display: none;
        }

        .topic-icon {
            width: 56px;
            height: 56px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .ref-list li {
            text-indent: -1.5em;
            padding-left: 1.5em;
        }
    </style>

    <script type="application/ld+json" nonce="<?= CspNonce::attr() ?>">
        {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "日本の生物多様性——世界が注目する島国の自然",
            "description": "日本は世界36の生物多様性ホットスポットの1つ。固有種の宝庫である島国の自然と国際的位置づけを解説。",
            "author": {
                "@type": "Person",
                "name": "八巻 毅",
                "jobTitle": "ikimon 代表 / 自然共生サイト認定企業・愛管株式会社パートナー"
            },
            "publisher": {
                "@type": "Organization",
                "name": "ikimon.life",
                "url": "https://ikimon.life"
            },
            "datePublished": "2026-03-22",
            "dateModified": "2026-03-22",
            "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": "https://ikimon.life/guide/japan-biodiversity.php"
            }
        }
    </script>

    <script type="application/ld+json" nonce="<?= CspNonce::attr() ?>">
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [{
                    "@type": "Question",
                    "name": "日本はなぜ生物多様性ホットスポットなのですか？",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "日本列島は南北約3,000kmにわたり亜寒帯から亜熱帯まで多様な気候帯を持ち、複雑な地形と海流の影響で極めて多様な生態系が成立しています。Conservation Internationalが定める「生物多様性ホットスポット」の基準——固有の維管束植物が1,500種以上かつ原生植生の70%以上が失われている地域——を満たす世界36カ所のうちの1つです。"
                    }
                },
                {
                    "@type": "Question",
                    "name": "日本の固有種はどれくらいいますか？",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "日本の哺乳類の約40%、両生類の約74%、維管束植物の約36%が固有種です。ニホンカモシカ、オオサンショウウオ、ヤンバルクイナなど、日本でしか見られない生きものが数多く存在します。島国という地理的隔離が、独自の進化を促してきました。"
                    }
                },
                {
                    "@type": "Question",
                    "name": "30by30とは何ですか？",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "2022年のCOP15（昆明モントリオール生物多様性枠組み）で採択された国際目標で、2030年までに陸域・海域の30%以上を保全地域にするというものです。日本では環境省が「自然共生サイト」認定制度を創設し、国立公園などの保護地域に加え、企業の森や里山なども含めて30%達成を目指しています。"
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

    <!-- Breadcrumb -->
    <nav class="pt-24 px-6">
        <div class="max-w-4xl mx-auto">
            <ol class="flex items-center gap-2 text-sm text-gray-400">
                <li><a href="../index.php" class="hover:text-[var(--color-primary)] transition-colors">ホーム</a></li>
                <li>/</li>
                <li><a href="nature-positive.php" class="hover:text-[var(--color-primary)] transition-colors">ガイド</a></li>
                <li>/</li>
                <li class="text-gray-600">日本の生物多様性</li>
            </ol>
        </div>
    </nav>

    <!-- Hero -->
    <section class="pt-8 pb-12 px-6 article-hero">
        <div class="max-w-4xl mx-auto">
            <div class="flex flex-wrap gap-2 mb-6">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-100 text-cyan-700 text-xs font-bold">
                    <i data-lucide="globe-2" class="w-3.5 h-3.5"></i>
                    世界が認めた自然の宝庫
                </span>
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                    <i data-lucide="leaf" class="w-3.5 h-3.5"></i>
                    日本だけの生きもの
                </span>
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                    <i data-lucide="landmark" class="w-3.5 h-3.5"></i>
                    国際条約
                </span>
            </div>

            <h1 class="text-3xl md:text-5xl font-black tracking-tight leading-tight mb-6">
                日本の生物多様性<br>
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-[var(--color-primary)]">世界が注目する島国の自然</span>
            </h1>
            <p class="text-xl text-gray-500 leading-relaxed mb-8">
                世界有数の自然の宝庫、日本だけにしかいない生きもの、そして自然を守る国際的な取り組み
            </p>

            <!-- Answer-First Block -->
            <div class="blockquote-accent rounded-xl p-6 mb-8">
                <p class="text-gray-700 leading-relaxed">
                    <strong>日本列島は、世界でも類を見ない生物多様性の宝庫です。</strong>
                    南北3,000kmにわたる気候帯、6,800以上の島々、4つのプレートが交差する地形——この地理的条件が、カエルやサンショウウオなど両生類の74%が「日本にしかいない種」という驚くべき多様性を生みました。2010年には生物多様性に関する国際会議（COP10）を名古屋で主催。2022年には「2030年までに国土の30%を自然保全エリアにする」という世界目標に合意し、日本独自の「自然共生サイト」認定制度を始動させています。ikimonは、この豊かな自然を市民の力で記録し、守るためのプラットフォームです。
                </p>
            </div>

            <!-- Author & Date -->
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-[var(--color-primary)] flex items-center justify-center text-lg font-black text-white">Y</div>
                <div>
                    <p class="text-sm font-bold">八巻 毅</p>
                    <p class="text-xs text-gray-400">ikimon 代表 / 自然共生サイト認定企業・愛管株式会社パートナー</p>
                    <p class="text-xs text-gray-400 mt-0.5">最終更新: 2026年3月22日</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Key Numbers -->
    <section class="py-12 px-6">
        <div class="max-w-4xl mx-auto">
            <h2 class="text-2xl font-bold mb-8">数字で見る日本の生物多様性</h2>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                <div class="evidence-card rounded-2xl p-5 text-center">
                    <p class="stat-number text-3xl font-black">36</p>
                    <p class="text-xs text-gray-500 mt-1">世界のホットスポット</p>
                    <p class="text-[10px] text-gray-400">日本はその1つ</p>
                </div>
                <div class="evidence-card rounded-2xl p-5 text-center">
                    <p class="stat-number text-3xl font-black">~74%</p>
                    <p class="text-xs text-gray-500 mt-1">両生類の固有率</p>
                    <p class="text-[10px] text-gray-400">世界有数の高さ</p>
                </div>
                <div class="evidence-card rounded-2xl p-5 text-center">
                    <p class="stat-number text-3xl font-black">3,716</p>
                    <p class="text-xs text-gray-500 mt-1">絶滅危惧種</p>
                    <p class="text-[10px] text-gray-400">環境省レッドリスト</p>
                </div>
                <div class="evidence-card rounded-2xl p-5 text-center">
                    <p class="stat-number text-3xl font-black">30%</p>
                    <p class="text-xs text-gray-500 mt-1">2030年保全目標</p>
                    <p class="text-[10px] text-gray-400">30by30</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Main Content -->
    <section class="pb-16 px-6">
        <div class="max-w-4xl mx-auto">
            <article class="prose prose-lg max-w-none space-y-12">

                <!-- Section 1: ホットスポット -->
                <div id="hotspot">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="topic-icon bg-cyan-100">
                            <i data-lucide="map-pin" class="w-7 h-7 text-cyan-600"></i>
                        </div>
                        <h2 class="text-2xl font-bold m-0">なぜ日本は「ホットスポット」なのか</h2>
                    </div>

                    <div class="space-y-4 text-gray-700 leading-relaxed">
                        <p>
                            「生物多様性ホットスポット」とは、<strong>その地域にしかいない植物が特に多く、なおかつ自然破壊が進んでいる場所</strong>のことです。国際的な自然保全団体Conservation International（CI）が定めた概念で、地球の陸地面積のわずか2.5%にあたるこれらの地域に、全陸上脊椎動物種の半数以上が集中しています。世界に36カ所あるうちの1つが、私たちの暮らす日本列島です。
                        </p>

                        <p>
                            日本列島がホットスポットである理由は、その地理にあります。
                        </p>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                            <div class="evidence-card rounded-2xl p-5">
                                <div class="flex items-center gap-2 mb-3">
                                    <i data-lucide="mountain" class="w-5 h-5 text-cyan-500"></i>
                                    <span class="font-bold text-sm">南北3,000kmの気候帯</span>
                                </div>
                                <p class="text-sm text-gray-600">北海道の亜寒帯針葉樹林から沖縄の亜熱帯マングローブまで。年平均気温の差は20℃以上にもなります。</p>
                            </div>
                            <div class="evidence-card rounded-2xl p-5">
                                <div class="flex items-center gap-2 mb-3">
                                    <i data-lucide="waves" class="w-5 h-5 text-cyan-500"></i>
                                    <span class="font-bold text-sm">4つの海流の交差点</span>
                                </div>
                                <p class="text-sm text-gray-600">暖流の黒潮と対馬海流、寒流の親潮とリマン海流。これらが沿岸の生態系に異なる生物相をもたらします。</p>
                            </div>
                            <div class="evidence-card rounded-2xl p-5">
                                <div class="flex items-center gap-2 mb-3">
                                    <i data-lucide="layers" class="w-5 h-5 text-cyan-500"></i>
                                    <span class="font-bold text-sm">4つのプレートの衝突</span>
                                </div>
                                <p class="text-sm text-gray-600">太平洋・フィリピン海・ユーラシア・北米プレートが交差し、複雑な山岳地形と火山列島を形成しています。</p>
                            </div>
                            <div class="evidence-card rounded-2xl p-5">
                                <div class="flex items-center gap-2 mb-3">
                                    <i data-lucide="palmtree" class="w-5 h-5 text-cyan-500"></i>
                                    <span class="font-bold text-sm">6,800以上の島々</span>
                                </div>
                                <p class="text-sm text-gray-600">島ごとに隔離された進化が起き、固有種・固有亜種が数多く誕生しました。</p>
                            </div>
                        </div>

                        <p>
                            氷河期に大陸とつながっては離れるという歴史を繰り返すなかで、日本列島には大陸由来の生物が渡来し、隔離された環境で独自の進化を遂げました。こうして、<strong>小さな島国に不釣り合いなほど多様な生命</strong>が息づくようになったのです。
                        </p>
                    </div>
                </div>

                <!-- Section 2: 固有種 -->
                <div id="endemic">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="topic-icon bg-emerald-100">
                            <i data-lucide="fingerprint" class="w-7 h-7 text-emerald-600"></i>
                        </div>
                        <h2 class="text-2xl font-bold m-0">固有種の宝庫——日本でしか会えない生きものたち</h2>
                    </div>

                    <div class="space-y-4 text-gray-700 leading-relaxed">
                        <p>
                            「固有種」とは、<strong>世界でその地域にしか生息しない生きもの</strong>のことです。たとえばオオサンショウウオやニホンカモシカは日本の固有種——地球上で日本でしか会えない生きものです。日本の固有種率は、先進国の中で際立って高い水準にあります。
                        </p>

                        <p>
                            同じ島国であるイギリスと比べると、その差は歴然です。イギリスの在来哺乳類にはイギリスだけの固有種がほぼおらず、植物でも固有種は数十種程度。一方で日本は哺乳類の約40%が固有種です。なぜこれほど違うのか？　イギリスはわずか約8,000年前まで欧州大陸と地続きで、独自の種が進化するには隔離期間が短すぎました。一方の日本列島は、数十万年以上にわたる大陸からの隔離と、南北3,000kmに及ぶ気候の多様性が、爆発的な固有種の誕生を可能にしたのです。
                        </p>

                        <div class="evidence-card rounded-2xl p-6 my-6">
                            <h4 class="font-bold text-gray-900 mb-3">日本にしかいない生きもの——どれくらい多い？</h4>
                            <ul class="space-y-3 text-sm">
                                <li class="flex items-start gap-3">
                                    <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                                    <span><strong>両生類: 約74%</strong>が固有種——オオサンショウウオ、アベサンショウウオ、アマミイシカワガエルなど</span>
                                </li>
                                <li class="flex items-start gap-3">
                                    <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                                    <span><strong>哺乳類: 約40%</strong>が固有種——ニホンカモシカ、アマミノクロウサギ、イリオモテヤマネコなど</span>
                                </li>
                                <li class="flex items-start gap-3">
                                    <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                                    <span><strong>維管束植物（木や草花など）: 約36%</strong>が固有種——約7,000種のうち2,500種以上が日本固有</span>
                                </li>
                                <li class="flex items-start gap-3">
                                    <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                                    <span><strong>爬虫類: 約38%</strong>が固有種——ミヤコカナヘビ、クロイワトカゲモドキなど</span>
                                </li>
                            </ul>
                        </div>

                        <p>
                            とりわけ南西諸島と小笠原諸島は「東洋のガラパゴス」と呼ばれるほど固有種が集中しています。2021年には奄美大島・徳之島・沖縄島北部・西表島がユネスコ世界自然遺産に登録され、ヤンバルクイナやアマミノクロウサギといった固有種の生息地が国際的にも認められました。
                        </p>

                        <div class="blockquote-accent rounded-xl p-5 my-6">
                            <p class="text-sm text-gray-600 italic">
                                <strong>ikimonのポイント</strong>：あなたが身近で見つけた生きものが、実は日本の固有種かもしれません。ikimonに記録を投稿すれば、固有種の分布データを研究者と共有し、保全に直接貢献できます。
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Section 3: 国際条約の歴史 -->
                <div id="international">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="topic-icon bg-blue-100">
                            <i data-lucide="landmark" class="w-7 h-7 text-blue-600"></i>
                        </div>
                        <h2 class="text-2xl font-bold m-0">COP10から30by30へ——日本が世界をリードしてきた歴史</h2>
                    </div>

                    <div class="space-y-4 text-gray-700 leading-relaxed">
                        <p>
                            生物多様性の国際的な保全枠組みにおいて、日本は重要な役割を果たしてきました。
                        </p>

                        <div class="space-y-6 my-8">
                            <div class="timeline-item">
                                <p class="font-bold text-sm text-cyan-700">1993年</p>
                                <p class="text-sm text-gray-600 mt-1">生物多様性条約（CBD＝生きものの多様さを守るための国際条約）を批准。保全、持続可能な利用、遺伝資源の公正な利益配分を約束。</p>
                            </div>
                            <div class="timeline-item">
                                <p class="font-bold text-sm text-cyan-700">2010年 — COP10 名古屋</p>
                                <p class="text-sm text-gray-600 mt-1"><strong>愛知目標（Aichi Biodiversity Targets）</strong>を採択。20の個別目標を掲げ、2020年までの生物多様性保全の世界目標に。名古屋議定書（遺伝資源のアクセスと利益配分）もここで合意。</p>
                            </div>
                            <div class="timeline-item">
                                <p class="font-bold text-sm text-cyan-700">2012年</p>
                                <p class="text-sm text-gray-600 mt-1">生物多様性国家戦略2012-2020を閣議決定。愛知目標の国内実施計画を策定。</p>
                            </div>
                            <div class="timeline-item">
                                <p class="font-bold text-sm text-cyan-700">2021年</p>
                                <p class="text-sm text-gray-600 mt-1">G7で<strong>30by30目標</strong>を支持。同年、「奄美大島、徳之島、沖縄島北部及び西表島」がユネスコ世界自然遺産に登録。</p>
                            </div>
                            <div class="timeline-item">
                                <p class="font-bold text-sm text-cyan-700">2022年 — COP15 モントリオール</p>
                                <p class="text-sm text-gray-600 mt-1"><strong>昆明モントリオール生物多様性枠組み（GBF）</strong>を採択。2030年までに陸と海の30%を保全するTarget 3（30by30）を含む23の目標を設定。</p>
                            </div>
                            <div class="timeline-item">
                                <p class="font-bold text-sm text-cyan-700">2023年</p>
                                <p class="text-sm text-gray-600 mt-1"><strong>生物多様性国家戦略2023-2030</strong>を閣議決定。「自然共生サイト」認定制度を本格開始し、30by30の国内実施を推進。</p>
                            </div>
                            <div class="timeline-item">
                                <p class="font-bold text-sm text-cyan-700">2024-2025年</p>
                                <p class="text-sm text-gray-600 mt-1">自然共生サイトの認定が420カ所を超える。企業の森林、大学キャンパス、寺社の鎮守の森なども認定対象に。</p>
                            </div>
                        </div>

                        <p>
                            愛知目標は「概ね未達」という評価でしたが、その経験を踏まえてGBFではより具体的な数値目標と実施手段が盛り込まれました。日本が果たした議長国としての役割は、生物多様性の国際協力の転機となっています。
                        </p>
                    </div>
                </div>

                <!-- Section 4: 30by30と自然共生サイト -->
                <div id="thirty-by-thirty">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="topic-icon bg-green-100">
                            <i data-lucide="trees" class="w-7 h-7 text-green-600"></i>
                        </div>
                        <h2 class="text-2xl font-bold m-0">30by30——日本はどこまで進んでいるか</h2>
                    </div>

                    <div class="space-y-4 text-gray-700 leading-relaxed">
                        <p>
                            30by30とは、2030年までに陸域と海域のそれぞれ30%以上を保全地域にするという目標です。日本は現在、陸域の約20.5%が国立公園や自然保護区に指定されています。残り約10%をどう確保するか——そこで鍵となるのが<strong>OECM（Other Effective area-based Conservation Measures）</strong>、つまり保護区以外の効果的な保全地域です。
                        </p>

                        <div class="evidence-card rounded-2xl p-6 my-6">
                            <h4 class="font-bold text-gray-900 mb-3">自然共生サイト認定制度</h4>
                            <ul class="space-y-3 text-sm">
                                <li class="flex items-start gap-3">
                                    <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
                                    <span>環境省が2023年に開始。生物多様性の保全に資する区域を「自然共生サイト」として認定</span>
                                </li>
                                <li class="flex items-start gap-3">
                                    <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
                                    <span><strong>420カ所以上</strong>が認定済み（2025年時点）。企業の森、大学キャンパス、寺社の森、ゴルフ場なども含む</span>
                                </li>
                                <li class="flex items-start gap-3">
                                    <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
                                    <span>認定サイトはOECMとして国際データベース（WDPA）に登録され、30by30の実績にカウント</span>
                                </li>
                                <li class="flex items-start gap-3">
                                    <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
                                    <span>企業にとってはTNFD開示におけるポジティブインパクトの実証手段にもなる</span>
                                </li>
                            </ul>
                        </div>

                        <p>
                            この仕組みは、トップダウン（政府の保護区指定）だけでなく、<strong>ボトムアップ（企業・自治体・市民の自発的保全）</strong>で30%を達成しようとする日本独自のアプローチです。
                        </p>
                    </div>
                </div>

                <!-- Section 5: TNFDと企業 -->
                <div id="tnfd">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="topic-icon bg-indigo-100">
                            <i data-lucide="building-2" class="w-7 h-7 text-indigo-600"></i>
                        </div>
                        <h2 class="text-2xl font-bold m-0">TNFDと日本企業——自然情報開示の最前線</h2>
                    </div>

                    <div class="space-y-4 text-gray-700 leading-relaxed">
                        <p>
                            TNFD（自然関連財務情報開示タスクフォース）とは、<strong>企業が「自分たちの事業が自然にどんな影響を与えているか」を投資家に報告するための国際ルール</strong>です。CO2排出量の開示が当たり前になったように、今度は「自然への影響」も開示が求められる時代。2023年に最終提言が公表されました。
                        </p>

                        <div class="evidence-card rounded-2xl p-6 my-6">
                            <h4 class="font-bold text-gray-900 mb-3">日本のTNFD対応状況</h4>
                            <ul class="space-y-3 text-sm">
                                <li class="flex items-start gap-3">
                                    <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>
                                    <span>TNFD早期採用企業（Adopter）数で<strong>日本は世界最多</strong>（2024年時点、80社以上がAdopter登録）</span>
                                </li>
                                <li class="flex items-start gap-3">
                                    <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>
                                    <span>TNFDが推奨する<strong>LEAP分析</strong>（自然との接点を「見つけて→評価して→分析して→備える」4ステップ）の実施企業も増加中</span>
                                </li>
                                <li class="flex items-start gap-3">
                                    <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>
                                    <span>自然共生サイトの認定取得は、TNFD開示における「ネイチャーポジティブ」への具体的行動の証明に</span>
                                </li>
                            </ul>
                        </div>

                        <p>
                            気候変動対策でESG投資が加速したように、<strong>生物多様性でも「自然関連リスクを開示できない企業は投資家から評価されない」時代</strong>が到来しています。日本企業がこの分野で世界をリードしていることは、もっと知られてよい事実です。
                        </p>
                    </div>
                </div>

                <!-- Section 6: 課題と市民科学 -->
                <div id="challenges">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="topic-icon bg-amber-100">
                            <i data-lucide="alert-triangle" class="w-7 h-7 text-amber-600"></i>
                        </div>
                        <h2 class="text-2xl font-bold m-0">残された課題——そして市民にできること</h2>
                    </div>

                    <div class="space-y-4 text-gray-700 leading-relaxed">
                        <p>
                            日本の生物多様性は確かに豊かですが、同時に大きな危機にも直面しています。環境省のレッドリストには<strong>3,716種</strong>が絶滅危惧種として掲載されています。
                        </p>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                            <div class="evidence-card rounded-2xl p-5">
                                <div class="flex items-center gap-2 mb-3">
                                    <i data-lucide="home" class="w-5 h-5 text-amber-500"></i>
                                    <span class="font-bold text-sm">生息地の喪失</span>
                                </div>
                                <p class="text-sm text-gray-600">都市化、農地転用、里山の管理放棄。原生林は国土の約18%にまで減少しています。</p>
                            </div>
                            <div class="evidence-card rounded-2xl p-5">
                                <div class="flex items-center gap-2 mb-3">
                                    <i data-lucide="bug" class="w-5 h-5 text-amber-500"></i>
                                    <span class="font-bold text-sm">外来種の影響</span>
                                </div>
                                <p class="text-sm text-gray-600">アライグマ、ヒアリ、セイタカアワダチソウなど。在来種の生存を脅かす外来種が増加しています。</p>
                            </div>
                            <div class="evidence-card rounded-2xl p-5">
                                <div class="flex items-center gap-2 mb-3">
                                    <i data-lucide="thermometer" class="w-5 h-5 text-amber-500"></i>
                                    <span class="font-bold text-sm">気候変動</span>
                                </div>
                                <p class="text-sm text-gray-600">サクラの開花前進、サンゴの白化、高山植物の生育域の縮小。温暖化の影響が顕在化しています。</p>
                            </div>
                            <div class="evidence-card rounded-2xl p-5">
                                <div class="flex items-center gap-2 mb-3">
                                    <i data-lucide="users" class="w-5 h-5 text-amber-500"></i>
                                    <span class="font-bold text-sm">モニタリングの限界</span>
                                </div>
                                <p class="text-sm text-gray-600">専門家だけでは全国の生態系を監視しきれません。市民科学の力が不可欠です。</p>
                            </div>
                        </div>

                        <p>
                            こうした課題に対して、<strong>市民一人ひとりにできることがあります</strong>。身近な公園や里山で生きものを見つけ、写真を撮り、記録する。この何気ない行為が、科学的なデータとなり、保全政策の基盤を支えるのです。
                        </p>

                        <div class="blockquote-accent rounded-xl p-5 my-6">
                            <p class="text-sm text-gray-600 italic">
                                <strong>ikimonのポイント</strong>：ikimonに投稿された観察データは、種の分布記録として研究者が利用可能です。あなたの「今日見つけた鳥」の1枚が、日本の生物多様性の現状把握に直接貢献しています。
                            </p>
                        </div>
                    </div>
                </div>

                <!-- まとめ -->
                <div id="summary" class="mt-16">
                    <h2 class="text-2xl font-bold mb-6">まとめ：世界有数の自然を、次の世代へ</h2>

                    <div class="evidence-card rounded-2xl p-8 my-6">
                        <div class="space-y-4">
                            <div class="flex items-center gap-4 py-3 border-b border-gray-100">
                                <div class="topic-icon bg-cyan-100 flex-shrink-0" style="width:40px;height:40px;border-radius:12px;">
                                    <i data-lucide="globe-2" class="w-5 h-5 text-cyan-600"></i>
                                </div>
                                <div>
                                    <p class="font-bold text-sm">世界36のホットスポットの1つ</p>
                                    <p class="text-xs text-gray-500">南北3,000km、6,800島が生む多様性</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-4 py-3 border-b border-gray-100">
                                <div class="topic-icon bg-emerald-100 flex-shrink-0" style="width:40px;height:40px;border-radius:12px;">
                                    <i data-lucide="fingerprint" class="w-5 h-5 text-emerald-600"></i>
                                </div>
                                <div>
                                    <p class="font-bold text-sm">両生類の74%、哺乳類の40%が固有種</p>
                                    <p class="text-xs text-gray-500">島国の隔離が生んだ独自の進化</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-4 py-3 border-b border-gray-100">
                                <div class="topic-icon bg-blue-100 flex-shrink-0" style="width:40px;height:40px;border-radius:12px;">
                                    <i data-lucide="landmark" class="w-5 h-5 text-blue-600"></i>
                                </div>
                                <div>
                                    <p class="font-bold text-sm">COP10愛知目標 → 30by30 → 自然共生サイト</p>
                                    <p class="text-xs text-gray-500">日本は国際的な保全枠組みの議長国</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-4 py-3">
                                <div class="topic-icon bg-amber-100 flex-shrink-0" style="width:40px;height:40px;border-radius:12px;">
                                    <i data-lucide="camera" class="w-5 h-5 text-amber-600"></i>
                                </div>
                                <div>
                                    <p class="font-bold text-sm">市民科学で、あなたも保全に参加できる</p>
                                    <p class="text-xs text-gray-500">ikimonの観察データは研究者と共有</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- FAQ -->
                <div id="faq" class="mt-16">
                    <h2 class="text-2xl font-bold mb-8">よくある質問</h2>
                    <div class="space-y-4">
                        <details class="evidence-card rounded-2xl overflow-hidden">
                            <summary class="p-5 font-bold cursor-pointer hover:bg-gray-50 transition-colors">
                                Q. 日本はなぜ生物多様性ホットスポットなのですか？
                            </summary>
                            <div class="px-5 pb-5 text-sm text-gray-600">
                                南北約3,000kmにわたる気候帯の多様性、4つのプレートが生む複雑な地形、6,800以上の島々による地理的隔離が、極めて多様な生態系と高い固有種率をもたらしています。Conservation Internationalの基準（固有維管束植物1,500種以上 + 原生植生の70%以上喪失）を満たす世界36カ所のうちの1つです。
                            </div>
                        </details>
                        <details class="evidence-card rounded-2xl overflow-hidden">
                            <summary class="p-5 font-bold cursor-pointer hover:bg-gray-50 transition-colors">
                                Q. 30by30は達成できそうですか？
                            </summary>
                            <div class="px-5 pb-5 text-sm text-gray-600">
                                日本の陸域は現在約20.5%が保護地域です。残り約10%を自然共生サイト（OECM）で補う戦略で、2025年時点で420カ所以上が認定されています。企業の森やゴルフ場、大学キャンパスなど民間の力を活かすアプローチが進んでおり、達成に向けた取り組みは加速しています。
                            </div>
                        </details>
                        <details class="evidence-card rounded-2xl overflow-hidden">
                            <summary class="p-5 font-bold cursor-pointer hover:bg-gray-50 transition-colors">
                                Q. 市民にできる生物多様性保全活動は何ですか？
                            </summary>
                            <div class="px-5 pb-5 text-sm text-gray-600">
                                最も手軽で効果的な方法は「観察データの記録」です。身近な公園や里山で生きものを見つけて写真を撮り、ikimonなどの市民科学プラットフォームに投稿する。このデータが種の分布記録として蓄積され、研究者の保全計画策定に活用されます。専門知識は不要で、スマートフォン1台から始められます。
                            </div>
                        </details>
                    </div>
                </div>

                <!-- References -->
                <div id="references" class="mt-16">
                    <h2 class="text-2xl font-bold mb-6">参考文献</h2>
                    <div class="evidence-card rounded-2xl p-6">
                        <ol class="ref-list space-y-3 text-sm text-gray-600 list-decimal list-inside">
                            <li>Conservation International. "Biodiversity Hotspots: Japan." <a href="https://www.conservation.org/priorities/biodiversity-hotspots" class="text-cyan-600 hover:underline" target="_blank" rel="noopener">conservation.org</a></li>
                            <li>環境省 (2023).「生物多様性国家戦略2023-2030」閣議決定. <a href="https://www.biodic.go.jp/biodiversity/about/initiatives6/index.html" class="text-cyan-600 hover:underline" target="_blank" rel="noopener">biodic.go.jp</a></li>
                            <li>環境省 (2020).「環境省レッドリスト2020」. <a href="https://www.env.go.jp/nature/kisho/hozen/redlist/index.html" class="text-cyan-600 hover:underline" target="_blank" rel="noopener">env.go.jp</a></li>
                            <li>Convention on Biological Diversity (2022). "Kunming-Montreal Global Biodiversity Framework." Decision 15/4, CBD COP15.</li>
                            <li>環境省 (2023).「自然共生サイト認定制度について」. <a href="https://policies.env.go.jp/nature/biodiversity/30by30alliance/" class="text-cyan-600 hover:underline" target="_blank" rel="noopener">env.go.jp</a></li>
                            <li>TNFD (2023). "Recommendations of the Taskforce on Nature-related Financial Disclosures." Final Report, September 2023.</li>
                            <li>Myers, N., et al. (2000). "Biodiversity hotspots for conservation priorities." <em>Nature</em>, 403, 853-858.</li>
                            <li>UNESCO (2021). "Amami-Oshima Island, Tokunoshima Island, Northern Part of Okinawa Island, and Iriomote Island." World Heritage List.</li>
                            <li>生物多様性センター.「自然環境保全基礎調査」. <a href="https://www.biodic.go.jp/kiso/fnd_list.html" class="text-cyan-600 hover:underline" target="_blank" rel="noopener">biodic.go.jp</a></li>
                        </ol>
                    </div>
                </div>

            </article>

            <!-- CTA -->
            <div class="mt-16 glass-card rounded-[2rem] p-8 md:p-12 border border-gray-200 text-center">
                <h3 class="text-2xl font-bold mb-4">
                    日本の自然を、あなたの目で記録しよう
                </h3>
                <p class="text-gray-500 mb-8 max-w-lg mx-auto">
                    世界が注目するこの島国の生物多様性を、市民の力で守る。ikimonで今日から観察を始めませんか？
                </p>
                <div class="flex flex-col sm:flex-row justify-center gap-4">
                    <a href="../post.php" class="cta-gradient text-white font-bold px-8 py-4 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                        <i data-lucide="camera" class="w-5 h-5"></i>
                        観察を始める
                    </a>
                    <a href="../explore.php" class="bg-gray-100 text-gray-700 font-bold px-8 py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors">
                        <i data-lucide="search" class="w-5 h-5"></i>
                        生きものを探す
                    </a>
                </div>
            </div>

            <!-- Related Articles -->
            <div class="mt-16">
                <h3 class="text-xl font-bold mb-6">関連記事</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <a href="nature-positive.php" class="evidence-card rounded-2xl p-5 block">
                        <span class="text-xs text-emerald-600 font-bold">ネイチャーポジティブ</span>
                        <p class="font-bold text-sm mt-2">ネイチャーポジティブ完全ガイド</p>
                    </a>
                    <a href="satoyama-initiative.php" class="evidence-card rounded-2xl p-5 block">
                        <span class="text-xs text-green-600 font-bold">里山イニシアティブ</span>
                        <p class="font-bold text-sm mt-2">里山イニシアチブとは？市民科学との接点</p>
                    </a>
                    <a href="regional-biodiversity.php" class="evidence-card rounded-2xl p-5 block">
                        <span class="text-xs text-orange-600 font-bold">地方創生</span>
                        <p class="font-bold text-sm mt-2">地方創生と生物多様性——消滅可能性自治体が持つ自然資本</p>
                    </a>
                </div>
            </div>

        </div>
    </section>

    <!-- Footer -->
    <?php include __DIR__ . '/../components/footer.php'; ?>

</body>

</html>
