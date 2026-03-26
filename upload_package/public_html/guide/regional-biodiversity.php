<?php
/**
 * 地方創生と生物多様性——消滅可能性自治体が持つ自然資本
 * SEO: /guide/regional-biodiversity.php
 */
$meta_title = '地方創生と生物多様性——消滅可能性自治体が持つ自然資本｜ikimon.life';
$meta_description = '消滅可能性自治体744市区町村。しかし人口が減る地域ほど生物多様性は豊か。増田レポート、OECM、エコツーリズム、市民科学——過疎地域の自然資本を活かした地方創生の可能性を、データとエビデンスで解説。';
$meta_image = 'https://ikimon.life/guide/ogp/regional-biodiversity.png';
$meta_canonical = 'https://ikimon.life/guide/regional-biodiversity.php';

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
            background: linear-gradient(135deg, rgba(249, 115, 22, 0.06) 0%, rgba(16, 185, 129, 0.06) 50%, rgba(34, 197, 94, 0.05) 100%);
        }

        .evidence-card {
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(249, 115, 22, 0.15);
            transition: all 0.3s ease;
        }

        .evidence-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 32px rgba(249, 115, 22, 0.12);
        }

        .stat-number {
            background: linear-gradient(135deg, #ea580c, var(--color-primary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .blockquote-accent {
            border-left: 4px solid #ea580c;
            background: rgba(249, 115, 22, 0.04);
        }

        .cta-gradient {
            background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
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
            "headline": "地方創生と生物多様性——消滅可能性自治体が持つ自然資本",
            "description": "消滅可能性自治体744。しかし過疎地域ほど生物多様性は豊か。自然資本を活かした地方創生の可能性を解説。",
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
                "@id": "https://ikimon.life/guide/regional-biodiversity.php"
            }
        }
    </script>

    <script type="application/ld+json" nonce="<?= CspNonce::attr() ?>">
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [{
                    "@type": "Question",
                    "name": "消滅可能性自治体とは何ですか？",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "日本創成会議（増田寛也座長）が2014年に発表した概念で、20〜39歳の若年女性人口が2040年までに50%以上減少すると推計される自治体のことです。2024年の更新版では744市区町村が該当しました。こうした地域は人口減少が深刻ですが、同時に豊かな自然環境を有していることが多いのが特徴です。"
                    }
                },
                {
                    "@type": "Question",
                    "name": "過疎地域の生物多様性はなぜ豊かなのですか？",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "一般に、人口密度が低い地域ほど大規模な開発や都市化による生息地の改変が少なく、自然環境が比較的良好に保たれています。日本の過疎地域の多くは山間部や沿岸部に位置し、原生林、河川、湿地などの多様な生態系が残されています。環境省の自然環境保全基礎調査でも、重要な自然生態系は人口希薄地域に集中していることが示されています。"
                    }
                },
                {
                    "@type": "Question",
                    "name": "市民科学は地方創生にどう貢献しますか？",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "市民科学プラットフォームを通じた生物調査は、専門家の不足する地方部でのモニタリングコストを大幅に削減します。さらに、都市部の参加者が地方で調査活動を行うことで関係人口の創出につながり、エコツーリズムの基盤にもなります。観察データの蓄積は自然共生サイト（OECM）の認定申請にも活用でき、地域の自然資本の「見える化」を促進します。"
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
                <li class="text-gray-600">地方創生と生物多様性</li>
            </ol>
        </div>
    </nav>

    <!-- Hero -->
    <section class="pt-8 pb-12 px-6 article-hero">
        <div class="max-w-4xl mx-auto">
            <div class="flex flex-wrap gap-2 mb-6">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                    <i data-lucide="map" class="w-3.5 h-3.5"></i>
                    地方創生
                </span>
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                    <i data-lucide="leaf" class="w-3.5 h-3.5"></i>
                    自然資本
                </span>
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                    <i data-lucide="users" class="w-3.5 h-3.5"></i>
                    市民科学
                </span>
            </div>

            <h1 class="text-3xl md:text-5xl font-black tracking-tight leading-tight mb-6">
                地方創生と生物多様性<br>
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-[var(--color-primary)]">消滅可能性自治体が持つ自然資本</span>
            </h1>
            <p class="text-xl text-gray-500 leading-relaxed mb-8">
                人口が減るまちに、かけがえのない自然が残っている
            </p>

            <!-- Answer-First Block -->
            <div class="blockquote-accent rounded-xl p-6 mb-8">
                <p class="text-gray-700 leading-relaxed">
                    <strong>増田レポートが挙げた消滅可能性自治体744。しかし、逆説的に、人口減少が進む地域ほど生物多様性は豊かです。</strong>
                    山間部や離島には手つかずの森や希少な生きものの生息地が残り、開発が少なかったことが結果的に自然を守ってきました。この豊かな自然を「自然資本」（経済的・社会的な価値を持つ自然環境）として活用すれば、自然体験ツアー、環境省の「自然共生サイト」認定、地域と継続的に関わる「関係人口」の創出など、地方創生の新たな切り口が見えてきます。カギは、その自然の価値を「見える化」すること。市民参加の生きもの調査は、その第一歩です。
                </p>
            </div>

            <!-- Author & Date -->
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-[var(--color-primary)] flex items-center justify-center text-lg font-black text-white">Y</div>
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
            <h2 class="text-2xl font-bold mb-8">数字で見る地方と自然</h2>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                <div class="evidence-card rounded-2xl p-5 text-center">
                    <p class="stat-number text-3xl font-black">744</p>
                    <p class="text-xs text-gray-500 mt-1">消滅可能性自治体</p>
                    <p class="text-[10px] text-gray-400">増田レポート2024</p>
                </div>
                <div class="evidence-card rounded-2xl p-5 text-center">
                    <p class="stat-number text-3xl font-black">67%</p>
                    <p class="text-xs text-gray-500 mt-1">日本の森林率</p>
                    <p class="text-[10px] text-gray-400">先進国2位</p>
                </div>
                <div class="evidence-card rounded-2xl p-5 text-center">
                    <p class="stat-number text-3xl font-black">420+</p>
                    <p class="text-xs text-gray-500 mt-1">自然共生サイト</p>
                    <p class="text-[10px] text-gray-400">OECM認定済み</p>
                </div>
                <div class="evidence-card rounded-2xl p-5 text-center">
                    <p class="stat-number text-3xl font-black">2,500</p>
                    <p class="text-xs text-gray-500 mt-1">万人が地域と関わる</p>
                    <p class="text-[10px] text-gray-400">総務省・関係人口推計</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Main Content -->
    <section class="pb-16 px-6">
        <div class="max-w-4xl mx-auto">
            <article class="prose prose-lg max-w-none space-y-12">

                <!-- Section 1: 消滅可能性自治体 -->
                <div id="masuda-report">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="topic-icon bg-orange-100">
                            <i data-lucide="trending-down" class="w-7 h-7 text-orange-600"></i>
                        </div>
                        <h2 class="text-2xl font-bold m-0">消滅可能性自治体744——数字が示す現実</h2>
                    </div>

                    <div class="space-y-4 text-gray-700 leading-relaxed">
                        <p>
                            2014年、日本創成会議の増田寛也座長が発表したレポートは、日本社会に衝撃を与えました。20〜39歳の若年女性人口が2040年までに50%以上減少すると推計される自治体を<strong>「消滅可能性自治体」</strong>と名付け、当初896市区町村をリストアップ。2024年の更新版でも、なお<strong>744市区町村</strong>が該当しています。
                        </p>

                        <p>
                            しかし、地図上でこれらの自治体の分布を見ると、あることに気づきます。<strong>消滅可能性自治体の多くが、日本の豊かな自然環境と重なっている</strong>のです。
                        </p>

                        <div class="evidence-card rounded-2xl p-6 my-6">
                            <h4 class="font-bold text-gray-900 mb-3">消滅可能性自治体の立地特性</h4>
                            <ul class="space-y-3 text-sm">
                                <li class="flex items-start gap-3">
                                    <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-orange-500 flex-shrink-0"></span>
                                    <span>山間部・中山間地域に集中——森林率が高く、生態系が比較的保全されている</span>
                                </li>
                                <li class="flex items-start gap-3">
                                    <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-orange-500 flex-shrink-0"></span>
                                    <span>沿岸部・離島にも多数——海の生態系や、その地域にしかいない生きもの（固有種）の生息地と重なる</span>
                                </li>
                                <li class="flex items-start gap-3">
                                    <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-orange-500 flex-shrink-0"></span>
                                    <span>開発圧が低い結果、<strong>里山・里海の生態系が維持されてきた</strong>地域が多い</span>
                                </li>
                            </ul>
                        </div>

                        <p>
                            つまり、人口減少という「危機」は、裏を返せば<strong>自然資本が残されている「可能性」</strong>でもあるのです。
                        </p>
                    </div>
                </div>

                <!-- Section 2: 逆説——人口減少と生物多様性 -->
                <div id="paradox">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="topic-icon bg-emerald-100">
                            <i data-lucide="arrow-up-down" class="w-7 h-7 text-emerald-600"></i>
                        </div>
                        <h2 class="text-2xl font-bold m-0">逆説：人口が減るほど、自然は豊か</h2>
                    </div>

                    <div class="space-y-4 text-gray-700 leading-relaxed">
                        <p>
                            環境省の自然環境保全基礎調査や各種生態系調査のデータを重ね合わせると、<strong>人口密度と生物多様性の間には緩やかな逆相関</strong>が見えてきます。
                        </p>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                            <div class="evidence-card rounded-2xl p-5">
                                <div class="flex items-center gap-2 mb-3">
                                    <i data-lucide="trees" class="w-5 h-5 text-emerald-500"></i>
                                    <span class="font-bold text-sm">日本の森林率67%</span>
                                </div>
                                <p class="text-sm text-gray-600">先進国ではフィンランドに次いで2位。その大部分が中山間地域——つまり過疎地域に分布しています。</p>
                            </div>
                            <div class="evidence-card rounded-2xl p-5">
                                <div class="flex items-center gap-2 mb-3">
                                    <i data-lucide="bird" class="w-5 h-5 text-emerald-500"></i>
                                    <span class="font-bold text-sm">希少種の集中</span>
                                </div>
                                <p class="text-sm text-gray-600">環境省レッドリスト掲載種の生息地は、人口密度が低い中山間地域や離島に集中しています。</p>
                            </div>
                            <div class="evidence-card rounded-2xl p-5">
                                <div class="flex items-center gap-2 mb-3">
                                    <i data-lucide="droplets" class="w-5 h-5 text-emerald-500"></i>
                                    <span class="font-bold text-sm">水源涵養機能</span>
                                </div>
                                <p class="text-sm text-gray-600">過疎地域の森林は、下流域の都市に清浄な水を供給する「緑のインフラ」として機能しています。</p>
                            </div>
                            <div class="evidence-card rounded-2xl p-5">
                                <div class="flex items-center gap-2 mb-3">
                                    <i data-lucide="flower-2" class="w-5 h-5 text-emerald-500"></i>
                                    <span class="font-bold text-sm">里山の二次的自然</span>
                                </div>
                                <p class="text-sm text-gray-600">人の営みと自然が共存してきた里山には、農地生態系に依存するオオタカやゲンジボタルなどが生息します。</p>
                            </div>
                        </div>

                        <p>
                            ただし、これは単純に「人がいなければ自然が豊か」という話ではありません。<strong>里山は適度な人間の管理があってこそ維持される生態系</strong>です。完全な放棄は、藪化や遷移の進行によって、かえって種の多様性を低下させることがあります。
                        </p>

                        <div class="blockquote-accent rounded-xl p-5 my-6">
                            <p class="text-sm text-gray-600 italic">
                                <strong>注意点</strong>：里山の管理放棄は短期的には種数が増えることもありますが、長期的には森林の閉鎖化が進み、草地性の種や水田依存の種が失われます。「適度な撹乱」がキーワードです。
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Section 3: 自然資本の活用 -->
                <div id="natural-capital">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="topic-icon bg-amber-100">
                            <i data-lucide="gem" class="w-7 h-7 text-amber-600"></i>
                        </div>
                        <h2 class="text-2xl font-bold m-0">眠れる資産——自然資本を地方創生に活かす</h2>
                    </div>

                    <div class="space-y-4 text-gray-700 leading-relaxed">
                        <p>
                            過疎地域が持つ自然環境は、経済的・社会的な価値に変換できる<strong>「自然資本」</strong>です。では、どうやって活用するのか？
                        </p>

                        <div class="space-y-6 my-6">
                            <div class="evidence-card rounded-2xl p-6">
                                <div class="flex items-center gap-3 mb-3">
                                    <div class="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                                        <i data-lucide="compass" class="w-5 h-5 text-amber-600"></i>
                                    </div>
                                    <h4 class="font-bold text-gray-900">エコツーリズム</h4>
                                </div>
                                <p class="text-sm text-gray-600">
                                    屋久島、知床、奄美大島では、自然体験型観光が地域経済を支えています。環境省の調査によると、国立公園の経済効果は年間約5兆円。過疎地域の自然を「観光資源」として位置づけることで、交流人口の拡大と雇用創出が期待できます。
                                </p>
                            </div>

                            <div class="evidence-card rounded-2xl p-6">
                                <div class="flex items-center gap-3 mb-3">
                                    <div class="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                                        <i data-lucide="shield-check" class="w-5 h-5 text-green-600"></i>
                                    </div>
                                    <h4 class="font-bold text-gray-900">「自然共生サイト」認定で価値を証明</h4>
                                </div>
                                <p class="text-sm text-gray-600">
                                    環境省が進める「自然共生サイト」とは、国立公園などの保護区以外で生物多様性の保全に役立っている場所を認定する制度です。地方自治体が管理する森林や湿地が認定されれば、「2030年までに国土の30%を保全する」という国際目標（30by30）への貢献として認められます。企業のCSR投資や国の交付金を引き出す根拠にもなり、<strong>保全と経済の好循環</strong>を生みます。
                                </p>
                            </div>

                            <div class="evidence-card rounded-2xl p-6">
                                <div class="flex items-center gap-3 mb-3">
                                    <div class="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                                        <i data-lucide="users" class="w-5 h-5 text-blue-600"></i>
                                    </div>
                                    <h4 class="font-bold text-gray-900">関係人口の創出</h4>
                                </div>
                                <p class="text-sm text-gray-600">
                                    「関係人口」とは、移住した人（定住人口）でも観光客（交流人口）でもなく、<strong>その地域と継続的に関わり続ける人々</strong>のこと。総務省も地方創生の鍵として注目しています。生きもの調査のために定期的に地方を訪れる——そんな参加型の活動は、<strong>都市と地方をつなぐ関係人口の入り口</strong>になります。
                                </p>
                            </div>

                            <div class="evidence-card rounded-2xl p-6">
                                <div class="flex items-center gap-3 mb-3">
                                    <div class="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                                        <i data-lucide="hand-helping" class="w-5 h-5 text-violet-600"></i>
                                    </div>
                                    <h4 class="font-bold text-gray-900">地域おこし協力隊 × 生物調査</h4>
                                </div>
                                <p class="text-sm text-gray-600">
                                    地域おこし協力隊の活動に生物多様性調査を組み込む自治体が増えています。地域の自然資源を調査・記録し、観光や教育に活かす——協力隊員のスキルと地域の資源をマッチングさせる新しいモデルです。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Section 4: 市民科学の役割 -->
                <div id="citizen-science">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="topic-icon bg-blue-100">
                            <i data-lucide="microscope" class="w-7 h-7 text-blue-600"></i>
                        </div>
                        <h2 class="text-2xl font-bold m-0">市民科学が解く「モニタリング不足」</h2>
                    </div>

                    <div class="space-y-4 text-gray-700 leading-relaxed">
                        <p>
                            生物多様性の保全には、まず「何がどこにいるか」を知る必要があります。しかし、専門の研究者や調査員だけで日本全国の生態系をカバーするのは物理的に不可能です。とりわけ<strong>過疎地域ではモニタリングの空白</strong>が深刻です。
                        </p>

                        <div class="evidence-card rounded-2xl p-6 my-6">
                            <h4 class="font-bold text-gray-900 mb-3">市民科学がもたらす3つの価値</h4>
                            <ul class="space-y-3 text-sm">
                                <li class="flex items-start gap-3">
                                    <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                                    <span><strong>モニタリングコストの大幅削減</strong>：専門家の調査1日あたり数万円のコストが、市民参加なら実質ゼロ。データ品質はAI同定と専門家レビューで担保</span>
                                </li>
                                <li class="flex items-start gap-3">
                                    <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                                    <span><strong>広域・長期のデータ収集</strong>：研究者が行けない場所、季節、時間帯のデータを補完。分布変化や気候変動影響の検出に不可欠</span>
                                </li>
                                <li class="flex items-start gap-3">
                                    <span class="inline-block w-2 h-2 mt-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                                    <span><strong>自然への当事者意識の醸成</strong>：調査に参加した人は保全への関心が高まり、地域の環境保全の担い手になる</span>
                                </li>
                            </ul>
                        </div>

                        <p>
                            ikimonは、こうした市民科学のデータ基盤を提供するプラットフォームです。スマートフォンで写真を撮って位置情報とともに投稿するだけで、その記録は科学的なデータになります。<strong>過疎地域に住む人はもちろん、その地域を訪れた人にとっても、ikimonは自然を記録する最も手軽な方法</strong>です。
                        </p>

                        <div class="blockquote-accent rounded-xl p-5 my-6">
                            <p class="text-sm text-gray-600 italic">
                                <strong>ikimonのポイント</strong>：「この地域にこんな生きものがいるなんて知らなかった」という発見が、地方のブランディングにもつながります。ikimonのサイト機能を使えば、特定の地域の生物多様性をダッシュボードで可視化し、自治体の政策立案や企業のTNFD開示にも活用できます。
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Section 5: 成功事例 -->
                <div id="cases">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="topic-icon bg-green-100">
                            <i data-lucide="sparkles" class="w-7 h-7 text-green-600"></i>
                        </div>
                        <h2 class="text-2xl font-bold m-0">動き出した地域——自然資本活用の先行事例</h2>
                    </div>

                    <div class="space-y-4 text-gray-700 leading-relaxed">
                        <p>
                            すでに日本各地で、自然資本を活かした地方創生の取り組みが始まっています。
                        </p>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                            <div class="evidence-card rounded-2xl p-5">
                                <div class="flex items-center gap-2 mb-3">
                                    <i data-lucide="mountain-snow" class="w-5 h-5 text-green-500"></i>
                                    <span class="font-bold text-sm">石川県・能登半島</span>
                                </div>
                                <p class="text-sm text-gray-600">世界農業遺産に認定された「能登の里山里海」。伝統的な農林漁業が維持する生態系を観光資源として活用し、交流人口の拡大に成功しています。</p>
                            </div>
                            <div class="evidence-card rounded-2xl p-5">
                                <div class="flex items-center gap-2 mb-3">
                                    <i data-lucide="bird" class="w-5 h-5 text-green-500"></i>
                                    <span class="font-bold text-sm">兵庫県・豊岡市</span>
                                </div>
                                <p class="text-sm text-gray-600">コウノトリの野生復帰プロジェクト。生態系の復元と「コウノトリ育む農法」ブランド米の確立で、環境と経済の両立を実現しました。</p>
                            </div>
                            <div class="evidence-card rounded-2xl p-5">
                                <div class="flex items-center gap-2 mb-3">
                                    <i data-lucide="fish" class="w-5 h-5 text-green-500"></i>
                                    <span class="font-bold text-sm">宮崎県・綾町</span>
                                </div>
                                <p class="text-sm text-gray-600">日本最大の照葉樹林をユネスコエコパークに登録。有機農業と森林保全を柱に、「綾ブランド」として地域全体のイメージ向上に成功しています。</p>
                            </div>
                            <div class="evidence-card rounded-2xl p-5">
                                <div class="flex items-center gap-2 mb-3">
                                    <i data-lucide="turtle" class="w-5 h-5 text-green-500"></i>
                                    <span class="font-bold text-sm">鹿児島県・奄美大島</span>
                                </div>
                                <p class="text-sm text-gray-600">世界自然遺産登録を契機にエコツーリズムが拡大。アマミノクロウサギなどの固有種を「地域の宝」として保全と観光を両立しています。</p>
                            </div>
                        </div>

                        <p>
                            これらの事例に共通するのは、<strong>地域の自然の価値を「見える化」し、ストーリーとして発信している</strong>こと。「なんとなく自然が豊か」ではなく、「どんな生きものがいて、なぜ価値があるのか」を具体的に示すことが、外部からの投資や関心を呼び込む鍵になっています。
                        </p>
                    </div>
                </div>

                <!-- まとめ -->
                <div id="summary" class="mt-16">
                    <h2 class="text-2xl font-bold mb-6">まとめ：「消滅」ではなく「再生」の可能性</h2>

                    <div class="evidence-card rounded-2xl p-8 my-6">
                        <div class="space-y-4">
                            <div class="flex items-center gap-4 py-3 border-b border-gray-100">
                                <div class="topic-icon bg-orange-100 flex-shrink-0" style="width:40px;height:40px;border-radius:12px;">
                                    <i data-lucide="map-pin" class="w-5 h-5 text-orange-600"></i>
                                </div>
                                <div>
                                    <p class="font-bold text-sm">消滅可能性自治体744——危機と可能性の表裏</p>
                                    <p class="text-xs text-gray-500">過疎地域ほど自然資本が豊かに残っている</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-4 py-3 border-b border-gray-100">
                                <div class="topic-icon bg-emerald-100 flex-shrink-0" style="width:40px;height:40px;border-radius:12px;">
                                    <i data-lucide="leaf" class="w-5 h-5 text-emerald-600"></i>
                                </div>
                                <div>
                                    <p class="font-bold text-sm">森林率67%——世界有数の緑の国</p>
                                    <p class="text-xs text-gray-500">その大部分が中山間地域に分布</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-4 py-3 border-b border-gray-100">
                                <div class="topic-icon bg-amber-100 flex-shrink-0" style="width:40px;height:40px;border-radius:12px;">
                                    <i data-lucide="gem" class="w-5 h-5 text-amber-600"></i>
                                </div>
                                <div>
                                    <p class="font-bold text-sm">エコツーリズム・OECM・関係人口</p>
                                    <p class="text-xs text-gray-500">自然資本を活かした複数の創生手段</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-4 py-3">
                                <div class="topic-icon bg-blue-100 flex-shrink-0" style="width:40px;height:40px;border-radius:12px;">
                                    <i data-lucide="camera" class="w-5 h-5 text-blue-600"></i>
                                </div>
                                <div>
                                    <p class="font-bold text-sm">市民科学で「見える化」する第一歩</p>
                                    <p class="text-xs text-gray-500">ikimonで地域の生物多様性を記録・可視化</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <p class="text-gray-700 leading-relaxed">
                        消滅可能性自治体という言葉は衝撃的ですが、それは人口の話です。自然環境に目を向ければ、こうした地域にはかけがえのない生態系が息づいています。人口が減るからこそ、残された自然をどう活かすかが問われている——<strong>「消滅可能性」を「再生可能性」に変える鍵は、自然資本の見える化にあります</strong>。
                    </p>
                </div>

                <!-- FAQ -->
                <div id="faq" class="mt-16">
                    <h2 class="text-2xl font-bold mb-8">よくある質問</h2>
                    <div class="space-y-4">
                        <details class="evidence-card rounded-2xl overflow-hidden">
                            <summary class="p-5 font-bold cursor-pointer hover:bg-gray-50 transition-colors">
                                Q. 消滅可能性自治体とは何ですか？
                            </summary>
                            <div class="px-5 pb-5 text-sm text-gray-600">
                                日本創成会議が定義した概念で、20〜39歳の若年女性人口が2040年までに50%以上減少すると推計される自治体のことです。2024年の更新版では744市区町村が該当します。ただし「消滅可能性」は人口動態に基づく推計であり、自然環境や文化的資産の価値を反映するものではありません。
                            </div>
                        </details>
                        <details class="evidence-card rounded-2xl overflow-hidden">
                            <summary class="p-5 font-bold cursor-pointer hover:bg-gray-50 transition-colors">
                                Q. 里山は放棄しても自然は復活しますか？
                            </summary>
                            <div class="px-5 pb-5 text-sm text-gray-600">
                                一概にはいえません。管理放棄された里山は短期的に藪化し、やがて遷移が進んで森林に戻りますが、その過程で草地性の生物（ギフチョウやゲンジボタルなど）は生息地を失います。里山は「人間の適度な関与」によって維持される二次的自然であり、完全な放棄は特定の生態系の喪失を意味します。
                            </div>
                        </details>
                        <details class="evidence-card rounded-2xl overflow-hidden">
                            <summary class="p-5 font-bold cursor-pointer hover:bg-gray-50 transition-colors">
                                Q. 地方の自治体にとってikimonはどう役立ちますか？
                            </summary>
                            <div class="px-5 pb-5 text-sm text-gray-600">
                                ikimonのサイト機能を使えば、自治体が管理するエリアの生物多様性をダッシュボードで可視化できます。観察データの蓄積は自然共生サイト（OECM）の認定申請の根拠資料にもなります。また、市民参加型の観察イベントを通じた関係人口の創出や、エコツーリズムのコンテンツ開発にも活用いただけます。
                            </div>
                        </details>
                    </div>
                </div>

                <!-- References -->
                <div id="references" class="mt-16">
                    <h2 class="text-2xl font-bold mb-6">参考文献</h2>
                    <div class="evidence-card rounded-2xl p-6">
                        <ol class="ref-list space-y-3 text-sm text-gray-600 list-decimal list-inside">
                            <li>増田寛也 編 (2014).『地方消滅——東京一極集中が招く人口急減』中公新書.</li>
                            <li>人口戦略会議 (2024).「消滅可能性自治体分析レポート」令和6年版.</li>
                            <li>環境省.「自然環境保全基礎調査（緑の国勢調査）」. <a href="https://www.biodic.go.jp/kiso/fnd_list.html" class="text-orange-600 hover:underline" target="_blank" rel="noopener">biodic.go.jp</a></li>
                            <li>林野庁 (2023).「森林・林業白書」令和5年版. <a href="https://www.rinya.maff.go.jp/j/kikaku/hakusyo/" class="text-orange-600 hover:underline" target="_blank" rel="noopener">rinya.maff.go.jp</a></li>
                            <li>総務省 (2021).「関係人口の創出・拡大に向けた取組」. <a href="https://www.soumu.go.jp/kankeijinkou/" class="text-orange-600 hover:underline" target="_blank" rel="noopener">soumu.go.jp</a></li>
                            <li>環境省 (2023).「自然共生サイト認定制度について」. <a href="https://policies.env.go.jp/nature/biodiversity/30by30alliance/" class="text-orange-600 hover:underline" target="_blank" rel="noopener">env.go.jp</a></li>
                            <li>FAO.「Globally Important Agricultural Heritage Systems (GIAHS): Noto's Satoyama and Satoumi.」</li>
                            <li>兵庫県豊岡市.「コウノトリ育む農法」. <a href="https://www.city.toyooka.lg.jp/" class="text-orange-600 hover:underline" target="_blank" rel="noopener">city.toyooka.lg.jp</a></li>
                            <li>国交省 (2014).「国土のグランドデザイン2050」.</li>
                        </ol>
                    </div>
                </div>

            </article>

            <!-- CTA -->
            <div class="mt-16 glass-card rounded-[2rem] p-8 md:p-12 border border-gray-200 text-center">
                <h3 class="text-2xl font-bold mb-4">
                    あなたの地域の自然を、記録しよう
                </h3>
                <p class="text-gray-500 mb-8 max-w-lg mx-auto">
                    都会でも田舎でも、あなたのまわりの生きものを記録することが、地域の自然資本の「見える化」につながります。
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
                    <a href="japan-biodiversity.php" class="evidence-card rounded-2xl p-5 block">
                        <span class="text-xs text-cyan-600 font-bold">日本の生物多様性</span>
                        <p class="font-bold text-sm mt-2">日本の生物多様性——世界が注目する島国の自然</p>
                    </a>
                    <a href="satoyama-initiative.php" class="evidence-card rounded-2xl p-5 block">
                        <span class="text-xs text-green-600 font-bold">里山イニシアティブ</span>
                        <p class="font-bold text-sm mt-2">里山イニシアチブとは？市民科学との接点</p>
                    </a>
                    <a href="nature-positive.php" class="evidence-card rounded-2xl p-5 block">
                        <span class="text-xs text-emerald-600 font-bold">ネイチャーポジティブ</span>
                        <p class="font-bold text-sm mt-2">ネイチャーポジティブ完全ガイド</p>
                    </a>
                </div>
            </div>

        </div>
    </section>

    <!-- Footer -->
    <?php include __DIR__ . '/../components/footer.php'; ?>

</body>

</html>
