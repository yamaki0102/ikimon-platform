<?php
/**
 * ikimon のアプローチ — 100年後の生態系のために
 * SEO: /guide/ikimon-approach.php
 */
$meta_title = 'ikimon のアプローチ — 100年後の生態系のために';
$meta_description = 'GBIFデータの80%以上が市民科学由来、iNaturalist2億件。世界中で市民の記録が科学と政策を動かしている。ikimonの設計思想と、その背景にある世界的潮流をエビデンスで解説。';
$meta_image = 'https://ikimon.life/assets/img/ogp-default.png';
$meta_canonical = 'https://ikimon.life/guide/ikimon-approach.php';

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
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(245, 158, 11, 0.06) 50%, rgba(6, 182, 212, 0.04) 100%);
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
            background: linear-gradient(135deg, var(--color-primary), #f59e0b);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
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

        .feature-card {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(16, 185, 129, 0.12);
            border-radius: 20px;
            padding: 24px;
            transition: all 0.3s ease;
        }

        .feature-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 40px rgba(16, 185, 129, 0.1);
        }

        .blockquote-accent {
            border-left: 4px solid var(--color-primary);
            background: rgba(16, 185, 129, 0.04);
            border-radius: 0 12px 12px 0;
            padding: 16px 20px;
        }

        .section-anchor {
            scroll-margin-top: 80px;
        }

        .toc-link {
            transition: all 0.2s ease;
        }

        .toc-link:hover {
            padding-left: 8px;
            color: var(--color-primary);
        }

        .design-reason {
            background: rgba(245, 158, 11, 0.04);
            border: 1px solid rgba(245, 158, 11, 0.15);
            border-radius: 16px;
            padding: 20px 24px;
            transition: all 0.3s ease;
        }

        .design-reason:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(245, 158, 11, 0.08);
        }

        .privacy-layer {
            background: rgba(255, 255, 255, 0.9);
            border-radius: 16px;
            padding: 16px 20px;
            border-left: 4px solid;
        }

        .cta-gradient {
            background: linear-gradient(135deg, var(--color-primary), #f59e0b);
        }
    </style>

    <script type="application/ld+json" nonce="<?= CspNonce::attr() ?>">
    [{
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "ikimon のアプローチ — 100年後の生態系のために",
        "author": {
            "@type": "Person",
            "name": "八巻 毅",
            "jobTitle": "IKIMON 代表"
        },
        "publisher": {
            "@type": "Organization",
            "name": "ikimon.life"
        },
        "datePublished": "2026-03-21",
        "dateModified": "2026-03-22",
        "about": [
            { "@type": "Thing", "name": "市民科学" },
            { "@type": "Thing", "name": "生物多様性モニタリング" },
            { "@type": "Thing", "name": "受動検出AI" },
            { "@type": "Thing", "name": "GBIF" },
            { "@type": "Thing", "name": "30by30" }
        ],
        "description": "GBIFデータの80%以上が市民科学由来。世界中で市民の記録が科学と政策を動かしている。ikimonの設計思想と世界的潮流をエビデンスで解説。"
    },
    {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": "市民科学のデータは本当に科学的に使えるのか？",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "GBIFに登録された2010年以降のデータの80%以上が市民科学由来で、2020-2024年に7,786本の査読付き論文で使用されています。IPBESやIUCNレッドリストの評価にも市民科学データが使われています。"
                }
            },
            {
                "@type": "Question",
                "name": "日本でも市民科学は進んでいるのか？",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "2026年1月時点で485サイトが自然共生サイトに認定され、30by30アライアンスには1,000以上の組織が参加しています。市民データと専門家データを50-70%の割合で混合すると最も正確な種分布推定が得られることが研究で示されています。"
                }
            },
            {
                "@type": "Question",
                "name": "散歩するだけで本当に保全に貢献できるのか？",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "国連の生物多様性枠組み（GBF）の365指標のうち51%は市民の参加がないと収集できないものです。散歩中の記録は科学データとなり、政策決定の根拠に使われます。また、参加者自身の健康やウェルビーイングの向上も研究で確認されています。"
                }
            }
        ]
    }]
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
                <li><a href="/" class="hover:text-primary transition">ホーム</a></li>
                <li class="text-gray-300">/</li>
                <li class="text-gray-600 font-medium">ikimon のアプローチ</li>
            </ol>
        </div>
    </nav>

    <!-- Hero Section -->
    <section class="pt-8 pb-12 px-6 article-hero">
        <div class="max-w-3xl mx-auto">
            <div class="flex flex-wrap gap-2 mb-6">
                <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                    <i data-lucide="users" class="w-3 h-3"></i>市民科学
                </span>
                <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                    <i data-lucide="clock" class="w-3 h-3"></i>100年計画
                </span>
                <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-cyan-100 text-cyan-700">
                    <i data-lucide="database" class="w-3 h-3"></i>オープンデータ
                </span>
                <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                    <i data-lucide="globe" class="w-3 h-3"></i>エビデンス
                </span>
            </div>

            <h1 class="text-3xl md:text-4xl font-black tracking-tight leading-tight mb-4">
                100年後の生態系のために、<br class="md:hidden">いま記録する
            </h1>

            <p class="text-lg text-muted leading-relaxed mb-6">
                散歩しながら自然を記録する。<br>
                それだけで、未来の科学者への贈り物になる。<br>
                <span class="text-sm">世界中で、同じことを考えている人がいる。</span>
            </p>

            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">Y</div>
                <div>
                    <p class="text-sm font-bold">八巻 毅</p>
                    <p class="text-xs text-faint">IKIMON 代表 / 自然共生サイト認定企業・愛管株式会社パートナー</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Key Numbers -->
    <section class="px-6 -mt-4 relative z-10">
        <div class="max-w-3xl mx-auto">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div class="evidence-card text-center">
                    <p class="stat-number text-2xl md:text-3xl font-black">80%+</p>
                    <p class="text-xs text-muted mt-1">GBIF データの市民科学比率</p>
                    <p class="text-[10px] text-faint mt-0.5">2010年以降</p>
                </div>
                <div class="evidence-card text-center">
                    <p class="stat-number text-2xl md:text-3xl font-black">2億件</p>
                    <p class="text-xs text-muted mt-1">iNaturalist 累計観察</p>
                    <p class="text-[10px] text-faint mt-0.5">330万人が参加</p>
                </div>
                <div class="evidence-card text-center">
                    <p class="stat-number text-2xl md:text-3xl font-black">485</p>
                    <p class="text-xs text-muted mt-1">自然共生サイト認定</p>
                    <p class="text-[10px] text-faint mt-0.5">日本 2026年1月</p>
                </div>
                <div class="evidence-card text-center">
                    <p class="stat-number text-2xl md:text-3xl font-black">51%</p>
                    <p class="text-xs text-muted mt-1">GBF 指標の市民参加率</p>
                    <p class="text-[10px] text-faint mt-0.5">365指標中</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Table of Contents -->
    <section class="py-10 px-6">
        <div class="max-w-3xl mx-auto">
            <div class="bg-surface rounded-2xl p-6 border border-border">
                <h2 class="text-lg font-black mb-4 flex items-center gap-2">
                    <i data-lucide="list" class="w-5 h-5 text-primary"></i>
                    このガイドの内容
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                    <a href="#why-record" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-emerald-600 font-bold">01</span> なぜ記録が大切なの？
                    </a>
                    <a href="#global-context" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-blue-600 font-bold">02</span> 世界はいま、どう動いているか
                    </a>
                    <a href="#three-methods" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-emerald-600 font-bold">03</span> 3つの記録方法
                    </a>
                    <a href="#design-philosophy" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-emerald-600 font-bold">04</span> なぜこう作ったのか
                    </a>
                    <a href="#data-protection" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-emerald-600 font-bold">05</span> データの守り方
                    </a>
                    <a href="#data-trust" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-emerald-600 font-bold">06</span> データの信頼性
                    </a>
                    <a href="#references" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-gray-500 font-bold">07</span> 参考文献
                    </a>
                    <a href="#action" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-amber-600 font-bold">08</span> キミができること
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- Section 1: なぜ記録が大切なの？ -->
    <section id="why-record" class="py-8 px-6 section-anchor">
        <div class="max-w-3xl mx-auto">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                    <i data-lucide="hourglass" class="w-5 h-5 text-amber-600"></i>
                </div>
                <h2 class="text-xl font-black">なぜ記録が大切なの？</h2>
            </div>

            <div class="space-y-4 text-[15px] leading-relaxed text-muted">
                <p>
                    もし100年前の人が、近所で見た生き物を毎日メモしていたら。<br>
                    私たちは<strong class="text-text">「あの頃、ここにはどんな生き物がいたのか」</strong>を正確に知ることができたはずです。
                </p>

                <div class="blockquote-accent">
                    <p class="text-sm">
                        世界最大の生物多様性データベース GBIF（地球規模生物多様性情報機構）に登録されている 2010年以降のデータのうち、<strong class="text-text">80%以上が市民科学から生まれたもの</strong>です。このデータを使って、毎日約7本のペースで査読付き論文が世界中で出版されています。
                        <span class="block text-[11px] text-faint mt-1">出典: GBIF Science Review / BioScience 2024</span>
                    </p>
                </div>

                <div class="blockquote-accent mt-3">
                    <p class="text-sm">
                        気候変動により、日本の生き物の分布は年々変化しています。桜の開花は50年前より10日以上早くなり、かつて見られた昆虫が姿を消し、南方の蝶が北上しています。<strong class="text-text">でも、「いつから変わったのか」を証明するデータが足りない。</strong>
                    </p>
                </div>

                <p>
                    研究者だけでは、日本中の生き物を毎日観察することはできません。<br>
                    でも、<strong class="text-text">散歩する人が「今日、この場所で、この生き物を見た」と記録するだけで</strong>、それは立派な科学データになります。
                </p>

                <p>
                    そしてもうひとつ大事なこと。<strong class="text-text">「いなかった」という記録も、科学にとっては宝物</strong>です。「この場所を歩いたけど、○○は見つからなかった」——それは、分布の境界線や個体数の減少を知る手がかりになります。ikimon のウォークモードやライブスキャンは、「探したけどいなかった」という不在データも自動で残します。
                </p>

                <p>
                    これは日本だけの話じゃありません。アメリカの iNaturalist には 330万人が参加して 2億件の観察を記録しています。フィンランドでは MK という鳥声認識アプリに<strong class="text-text">国民の5%（31万人）</strong>が参加し、1,630万件の録音データが集まりました。「ふつうの人が、ふつうに記録する」ことが、世界中で科学を動かしています。
                </p>

                <p>
                    ikimon は、その「ふつうの散歩データ」を<strong class="text-text">100年先まで残る形</strong>で記録するために作られました。
                </p>
            </div>
        </div>
    </section>

    <!-- Section 2: 世界はいま、どう動いているか -->
    <section id="global-context" class="py-8 px-6 bg-surface section-anchor">
        <div class="max-w-3xl mx-auto">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <i data-lucide="globe" class="w-5 h-5 text-blue-600"></i>
                </div>
                <h2 class="text-xl font-black">世界はいま、どう動いているか</h2>
            </div>

            <div class="space-y-4 text-[15px] leading-relaxed text-muted">
                <p>
                    「市民が生き物を記録して、それが科学や政策に使われる」——これは夢物語じゃなくて、もう起きていることです。いくつか数字を見てみましょう。
                </p>

                <!-- 国際政策との接続 -->
                <h3 class="text-base font-black text-text pt-4 flex items-center gap-2">
                    <i data-lucide="landmark" class="w-4 h-4 text-blue-600"></i>
                    政策を動かすデータ
                </h3>

                <p>
                    国連の生物多様性枠組み（GBF）には、自然を守るための 365 の指標があります。このうち<strong class="text-text">51% は市民の参加がないと収集できない</strong>ものです。気候変動でいう IPCC に相当する <strong class="text-text">IPBES（生物多様性版 IPCC）</strong>も、市民科学データに依拠して評価を行っています。
                </p>

                <p>
                    2022年に採択された「30x30目標」——2030年までに陸と海の30%を保全する——の進捗モニタリングにも、市民のデータが不可欠です。専門家だけでは、時間的にも空間的にも、カバーしきれないからです。
                </p>

                <div class="evidence-card">
                    <p class="text-xs font-bold text-blue-600 mb-2">
                        <i data-lucide="bar-chart-2" class="w-3 h-3 inline"></i> 数字で見る政策インパクト
                    </p>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                            <p class="font-bold text-text">GBIF 経由の論文</p>
                            <p>2020-2024年に <strong class="text-text">7,786本</strong>の査読論文が GBIF データを使用。2019年から倍増。</p>
                        </div>
                        <div>
                            <p class="font-bold text-text">EU の動き</p>
                            <p>Horizon Europe が市民科学による生物多様性観測能力の強化に予算を配分。</p>
                        </div>
                    </div>
                    <p class="text-[11px] text-faint mt-2">出典: GBIF Science Review 2024 / PNAS 2025</p>
                </div>

                <!-- 日本の動き -->
                <h3 class="text-base font-black text-text pt-4 flex items-center gap-2">
                    <i data-lucide="map-pin" class="w-4 h-4 text-emerald-600"></i>
                    日本の動き
                </h3>

                <p>
                    日本では環境省が「自然共生サイト」の認定制度を 2023年に開始しました。2026年1月時点で <strong class="text-text">485サイトが認定</strong>され、うち 282サイト（54,500ヘクタール）が国際データベースに OECM として登録されています。30by30 アライアンスには<strong class="text-text">企業・自治体・NGO など 1,000以上の組織</strong>が参加しています。
                </p>

                <p>
                    興味深い研究結果もあります。生き物の分布を正確に推定するには、専門家のデータだけでも、市民のデータだけでもダメで、<strong class="text-text">両方を 50-70% の割合で混ぜたときがいちばん精度が高い</strong>ことがわかっています。専門家と市民が補い合う関係です。
                    <span class="block text-[11px] text-faint mt-1">出典: eLife 2024 "Boosting biodiversity monitoring using smartphone-driven data"</span>
                </p>

                <!-- 健康との接点 -->
                <h3 class="text-base font-black text-text pt-4 flex items-center gap-2">
                    <i data-lucide="heart-pulse" class="w-4 h-4 text-rose-500"></i>
                    歩くことの副産物
                </h3>

                <p>
                    市民科学には、自然を守る以外の効果もあります。2024年の Frontiers の研究では、生物多様性の市民科学に参加した人は<strong class="text-text">自然とのつながり（nature relatedness）と自己効力感が有意に向上</strong>したことが報告されています。
                </p>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="evidence-card">
                        <p class="text-xs font-bold text-emerald-600 mb-1">個人への効果</p>
                        <ul class="text-sm space-y-1">
                            <li>自然への関心・愛着の向上</li>
                            <li>屋外活動による身体的健康</li>
                            <li>ストレス軽減・気分改善</li>
                        </ul>
                    </div>
                    <div class="evidence-card">
                        <p class="text-xs font-bold text-blue-600 mb-1">社会への効果</p>
                        <ul class="text-sm space-y-1">
                            <li>地域コミュニティの形成</li>
                            <li>社会的孤立感の低減</li>
                            <li>環境リテラシーの向上</li>
                        </ul>
                    </div>
                </div>
                <p class="text-[11px] text-faint">出典: Frontiers in Environmental Science 2024 / PMC 2022</p>

                <p>
                    生き物を記録するために外を歩く。それだけで、科学データが生まれ、政策の根拠になり、自分の健康にもつながる。市民科学は「お手伝い」ではなく、<strong class="text-text">社会インフラの一部</strong>になりつつあります。
                </p>
            </div>
        </div>
    </section>

    <!-- Section 3: 3つの記録方法 -->
    <section id="three-methods" class="py-8 px-6 bg-surface section-anchor">
        <div class="max-w-3xl mx-auto">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <i data-lucide="layers" class="w-5 h-5 text-emerald-600"></i>
                </div>
                <h2 class="text-xl font-black">3つの記録方法</h2>
            </div>

            <p class="text-[15px] text-muted leading-relaxed mb-6">
                ikimon では、キミの「やる気」や「時間」に合わせて、3つの方法で生き物を記録できます。
            </p>

            <div class="grid grid-cols-1 gap-4">
                <!-- 観察投稿 -->
                <div class="feature-card">
                    <div class="flex items-start gap-4">
                        <div class="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <i data-lucide="camera" class="w-6 h-6 text-emerald-600"></i>
                        </div>
                        <div>
                            <h3 class="font-black text-base mb-1">観察投稿</h3>
                            <p class="text-xs text-emerald-600 font-bold mb-2">いちばんカンタン</p>
                            <p class="text-sm text-muted leading-relaxed mb-3">
                                生き物を見つけたら、スマホで写真を撮って投稿するだけ。撮影した写真から<strong class="text-text">場所（GPS）・日時・方角を自動で読み取る</strong>ので、キミが入力する必要はほとんどありません。
                            </p>
                            <div class="flex flex-wrap gap-2">
                                <span class="text-[10px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold">EXIF自動抽出</span>
                                <span class="text-[10px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold">iPhone / Android 対応</span>
                                <span class="text-[10px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold">オフラインOK</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ウォークモード -->
                <div class="feature-card">
                    <div class="flex items-start gap-4">
                        <div class="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <i data-lucide="footprints" class="w-6 h-6 text-blue-600"></i>
                        </div>
                        <div>
                            <h3 class="font-black text-base mb-1">ウォークモード</h3>
                            <p class="text-xs text-blue-600 font-bold mb-2">歩くだけでいい</p>
                            <p class="text-sm text-muted leading-relaxed mb-3">
                                スマホをポケットに入れて歩くだけ。<strong class="text-text">AIが周囲の鳥の声を聞き取って、自動で種名を記録</strong>してくれます。6,522種の鳥声に対応。歩いた距離やステップ数も自動計測されるので、健康記録にもなります。
                            </p>
                            <div class="flex flex-wrap gap-2">
                                <span class="text-[10px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-bold">BirdNET AI</span>
                                <span class="text-[10px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-bold">6,522種対応</span>
                                <span class="text-[10px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-bold">歩数 / 距離 自動計測</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ライブスキャン -->
                <div class="feature-card">
                    <div class="flex items-start gap-4">
                        <div class="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                            <i data-lucide="scan-line" class="w-6 h-6 text-violet-600"></i>
                        </div>
                        <div>
                            <h3 class="font-black text-base mb-1">ライブスキャン</h3>
                            <p class="text-xs text-violet-600 font-bold mb-2">AI が自動で見つける</p>
                            <p class="text-sm text-muted leading-relaxed mb-3">
                                カメラとマイクを同時に使い、<strong class="text-text">移動しながら周囲の生き物を自動検出</strong>します。AIが画像から種を判定し、同時に鳥の声も聞き取ります。徒歩・自転車・車の3つのモードがあり、移動速度に合わせて撮影間隔を自動調整します。
                            </p>
                            <div class="flex flex-wrap gap-2">
                                <span class="text-[10px] px-2 py-1 rounded-full bg-violet-50 text-violet-700 font-bold">Gemini Vision AI</span>
                                <span class="text-[10px] px-2 py-1 rounded-full bg-violet-50 text-violet-700 font-bold">カメラ + 音声</span>
                                <span class="text-[10px] px-2 py-1 rounded-full bg-violet-50 text-violet-700 font-bold">徒歩 / 自転車 / 車</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Section 3: なぜこう作ったのか -->
    <section id="design-philosophy" class="py-8 px-6 section-anchor">
        <div class="max-w-3xl mx-auto">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                    <i data-lucide="lightbulb" class="w-5 h-5 text-amber-600"></i>
                </div>
                <h2 class="text-xl font-black">ikimon はなぜこう作ったのか</h2>
            </div>

            <p class="text-[15px] text-muted leading-relaxed mb-6">
                生き物観察のアプリはいくつもあります。それぞれに素晴らしい特徴があります。<br>
                ikimon が特定の設計を選んだのには、それぞれ理由があります。
            </p>

            <div class="space-y-4">
                <!-- AI哲学 -->
                <div class="blockquote-accent">
                    <p class="text-sm leading-relaxed">
                        <strong class="text-text">ikimon の AI 哲学 — 主役は人間、AI はサポート。</strong><br><br>
                        多くの生き物アプリでは、写真を撮ると AI が「これは○○です」と答えを出します。便利ですが、ikimon はあえて違う道を選びました。<strong class="text-text">AI は「ここを見て」「この特徴に注目して」とヒントを出す役割</strong>に徹し、最終的な判断は人間が行います。<br><br>
                        ライブスキャンのように広い範囲をざっくり記録するときは AI が活躍します。でも、1件1件の正確な同定は、やっぱり人の目と経験が必要です。<br><br>
                        100年後には、AI だけで完璧に同定できる時代が来るかもしれません。でも、<strong class="text-text">そのAIを育てるための「人間が確認した正確なデータ」を、いま積み重ねておく必要がある</strong>。それが ikimon の役割です。
                    </p>
                </div>

                <div class="design-reason">
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <i data-lucide="eye" class="w-4 h-4 text-amber-700"></i>
                        </div>
                        <h3 class="font-black text-base leading-snug text-gray-900">「手動で撮る」だけでは見逃す</h3>
                    </div>
                    <p class="text-sm text-muted leading-relaxed">
                        人間の目は、興味があるものしか見ません。でも生態系の記録には「そこにいたけど気づかなかった生き物」も大切です。だから ikimon は<strong class="text-text">AIによる受動検出</strong>を採用しました。カメラと音声で、キミが気づかなかった生き物も記録します。ただし、AIが出すのはあくまで候補。最終的な同定は人間が確認します。
                    </p>
                </div>

                <div class="design-reason">
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <i data-lucide="shield-check" class="w-4 h-4 text-amber-700"></i>
                        </div>
                        <h3 class="font-black text-base leading-snug text-gray-900">「誰でも同定できる」だと精度が下がる</h3>
                    </div>
                    <p class="text-sm text-muted leading-relaxed">
                        100年後の科学者がデータを使うとき、「この記録は信頼できるのか？」が問題になります。だから ikimon は<strong class="text-text">同定者の専門性で票の重みを変える TrustLevel</strong> を導入しました。昆虫に詳しい人の昆虫同定は、そうでない人より重く扱われます。
                    </p>
                </div>

                <div class="design-reason">
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <i data-lucide="map-pin-off" class="w-4 h-4 text-amber-700"></i>
                        </div>
                        <h3 class="font-black text-base leading-snug text-gray-900">「全部公開」だと希少種が危険</h3>
                    </div>
                    <p class="text-sm text-muted leading-relaxed">
                        珍しい生き物の正確な場所を公開すると、密猟や採集のリスクがあります。だから ikimon は<strong class="text-text">3層のプライバシー保護</strong>を設計しました。希少種の位置は自動でぼかされ、時間も遅らせて公開されます。
                    </p>
                </div>

                <div class="design-reason">
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <i data-lucide="bar-chart-3" class="w-4 h-4 text-amber-700"></i>
                        </div>
                        <h3 class="font-black text-base leading-snug text-gray-900">「種数だけ」では生態系はわからない</h3>
                    </div>
                    <p class="text-sm text-muted leading-relaxed">
                        「50種見つかりました」だけでは、その場所の自然が豊かかどうかは判断できません。だから ikimon は<strong class="text-text">5つの軸で評価する BIS スコア</strong>を開発しました。種の多様性、データの質、保全価値、分類群のカバー率、そして調査の継続性。多面的に見ることで、はじめて生態系の健康状態がわかります。
                    </p>
                </div>
            </div>
        </div>
    </section>

    <!-- Section 4: データの守り方 -->
    <section id="data-protection" class="py-8 px-6 bg-surface section-anchor">
        <div class="max-w-3xl mx-auto">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <i data-lucide="lock" class="w-5 h-5 text-emerald-600"></i>
                </div>
                <h2 class="text-xl font-black">データはどう守られている？</h2>
            </div>

            <div class="space-y-4 text-[15px] leading-relaxed text-muted">
                <p>
                    キミが記録したデータは、<strong class="text-text">未来の科学者が使えるように</strong>大切に保管されます。同時に、今この瞬間の生き物を守るためのセキュリティも備えています。
                </p>

                <h3 class="text-base font-black text-text pt-4 flex items-center gap-2">
                    <i data-lucide="layers" class="w-4 h-4 text-primary"></i>
                    位置情報の3層管理
                </h3>

                <div class="space-y-3">
                    <div class="privacy-layer" style="border-left-color: #10b981;">
                        <p class="text-xs font-bold text-emerald-600 mb-1">Private 層 — 投稿者と研究パートナー</p>
                        <p class="text-sm">撮影した本人と、提携する研究者・専門家が正確な座標を確認できます。</p>
                    </div>
                    <div class="privacy-layer" style="border-left-color: #f59e0b;">
                        <p class="text-xs font-bold text-amber-600 mb-1">Ambient 層 — みんなに公開</p>
                        <p class="text-sm">公開時は位置をグリッド単位でぼかし、時間も遅らせて表示。希少種はさらに粗くなります。</p>
                    </div>
                    <div class="privacy-layer" style="border-left-color: #6366f1;">
                        <p class="text-xs font-bold text-indigo-600 mb-1">Admin 層 — 管理者限定</p>
                        <p class="text-sm">サイト管理者が全データを管理・監視し、不正利用を防止します。</p>
                    </div>
                </div>

                <p>
                    ikimon に記録されたデータは、将来的にオープンデータとして公開することを目指しています。<strong class="text-text">キミの1枚の写真が、未来の研究者にとっての貴重な資料</strong>になるかもしれません。
                </p>
            </div>
        </div>
    </section>

    <!-- Section 5: データの信頼性 -->
    <section id="data-trust" class="py-8 px-6 section-anchor">
        <div class="max-w-3xl mx-auto">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <i data-lucide="badge-check" class="w-5 h-5 text-emerald-600"></i>
                </div>
                <h2 class="text-xl font-black">データの信頼性</h2>
            </div>

            <div class="space-y-4 text-[15px] leading-relaxed text-muted">
                <p>
                    「市民が集めたデータって、本当に科学に使えるの？」<br>
                    答えは数字が出ています。2020年から2024年の5年間で、GBIF の市民科学データを使った査読付き論文は<strong class="text-text">7,786本</strong>。IPBES（生物多様性版 IPCC）や IUCN レッドリストの評価にも市民科学データが使われています。「使えるか？」ではなく「なくてはならない」段階にあります。
                </p>

                <p>
                    ikimon はこの信頼性を、<strong class="text-text">3つの仕組み</strong>で支えています。
                </p>

                <div class="grid grid-cols-1 gap-4">
                    <div class="approach-card p-5">
                        <div class="flex items-start gap-4">
                            <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                <span class="text-emerald-700 font-black">1</span>
                            </div>
                            <div>
                                <h3 class="font-black text-base leading-snug text-gray-900 mb-2">AI はヒントを出し、人が決める</h3>
                                <p class="text-sm text-muted leading-relaxed">
                                    AI（Gemini Vision / BirdNET）は「答え」ではなく「候補とヒント」を提示します。「この模様に注目」「この鳴き声の特徴は」——そのヒントをもとに、コミュニティの同定者が最終判断します。AIの速さと、人間の経験知の組み合わせです。
                                </p>
                            </div>
                        </div>
                    </div>

                    <div class="approach-card p-5">
                        <div class="flex items-start gap-4">
                            <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                <span class="text-emerald-700 font-black">2</span>
                            </div>
                            <div>
                                <h3 class="font-black text-base leading-snug text-gray-900 mb-2">TrustLevel（信頼度レベル）</h3>
                                <p class="text-sm text-muted leading-relaxed">
                                    すべての同定者の票が同じ重みではありません。過去の同定精度や専門分野に基づいて、票の重みが変わります。鳥に詳しい人の鳥の同定は、初心者の同定より重く扱われます。
                                </p>
                            </div>
                        </div>
                    </div>

                    <div class="approach-card p-5">
                        <div class="flex items-start gap-4">
                            <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                <span class="text-emerald-700 font-black">3</span>
                            </div>
                            <div>
                                <h3 class="font-black text-base leading-snug text-gray-900 mb-2">BIS スコア（5軸評価）</h3>
                                <p class="text-sm text-muted leading-relaxed">
                                    生態系の健康度を5つの軸で評価します。<strong class="text-text">種の多様性</strong>（Shannon-Wiener指数）、<strong class="text-text">データ品質</strong>、<strong class="text-text">保全価値</strong>（レッドリスト種の有無）、<strong class="text-text">分類群カバー率</strong>、そして<strong class="text-text">モニタリングの継続性</strong>。ひとつの数字ではなく、多面的に生態系を見つめます。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Section 7: 参考文献 -->
    <section id="references" class="py-8 px-6 bg-surface section-anchor">
        <div class="max-w-3xl mx-auto">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    <i data-lucide="book-open" class="w-5 h-5 text-gray-600"></i>
                </div>
                <h2 class="text-xl font-black">参考文献</h2>
            </div>

            <p class="text-[15px] text-muted leading-relaxed mb-4">
                このページで引用したデータの出典です。すべて公開されている論文・公的資料です。
            </p>

            <div class="space-y-3">
                <div class="bg-white rounded-xl p-4 border border-gray-100">
                    <p class="text-sm font-bold text-text">GBIF — Citizen Science</p>
                    <p class="text-xs text-muted mt-1">市民科学データが GBIF ネットワーク全体に占める割合と、研究利用の統計</p>
                    <a href="https://www.gbif.org/citizen-science" target="_blank" rel="noopener" class="text-xs text-primary hover:underline mt-1 inline-block">gbif.org/citizen-science</a>
                </div>

                <div class="bg-white rounded-xl p-4 border border-gray-100">
                    <p class="text-sm font-bold text-text">iNaturalist accelerates biodiversity research</p>
                    <p class="text-xs text-muted mt-1">BioScience, 2024. iNaturalist データの研究利用が5年で10倍に増加した分析</p>
                    <a href="https://academic.oup.com/bioscience/article/75/11/953/8185761" target="_blank" rel="noopener" class="text-xs text-primary hover:underline mt-1 inline-block">academic.oup.com</a>
                </div>

                <div class="bg-white rounded-xl p-4 border border-gray-100">
                    <p class="text-sm font-bold text-text">Boosting biodiversity monitoring using smartphone-driven, rapidly accumulating community-sourced data</p>
                    <p class="text-xs text-muted mt-1">eLife, 2024. スマートフォンベースの市民科学データと専門家データの最適混合比率の研究</p>
                    <a href="https://elifesciences.org/articles/93694" target="_blank" rel="noopener" class="text-xs text-primary hover:underline mt-1 inline-block">elifesciences.org</a>
                </div>

                <div class="bg-white rounded-xl p-4 border border-gray-100">
                    <p class="text-sm font-bold text-text">A digital twin for real-time biodiversity forecasting with citizen science data</p>
                    <p class="text-xs text-muted mt-1">Nature Ecology & Evolution, 2025. フィンランド MK アプリの市民科学データを用いたデジタルツイン</p>
                    <a href="https://www.nature.com/articles/s41559-025-02966-3" target="_blank" rel="noopener" class="text-xs text-primary hover:underline mt-1 inline-block">nature.com</a>
                </div>

                <div class="bg-white rounded-xl p-4 border border-gray-100">
                    <p class="text-sm font-bold text-text">Enhancing the health and wellbeing benefits of biodiversity citizen science</p>
                    <p class="text-xs text-muted mt-1">Frontiers in Environmental Science, 2024. 市民科学参加による健康・ウェルビーイング効果の研究</p>
                    <a href="https://www.frontiersin.org/journals/environmental-science/articles/10.3389/fenvs.2024.1444161/full" target="_blank" rel="noopener" class="text-xs text-primary hover:underline mt-1 inline-block">frontiersin.org</a>
                </div>

                <div class="bg-white rounded-xl p-4 border border-gray-100">
                    <p class="text-sm font-bold text-text">Nine changes needed to deliver a radical transformation in biodiversity measurement</p>
                    <p class="text-xs text-muted mt-1">PNAS, 2025. 生物多様性の計測手法を変革するために必要な9つの変化</p>
                    <a href="https://www.pnas.org/doi/10.1073/pnas.2519345123" target="_blank" rel="noopener" class="text-xs text-primary hover:underline mt-1 inline-block">pnas.org</a>
                </div>

                <div class="bg-white rounded-xl p-4 border border-gray-100">
                    <p class="text-sm font-bold text-text">環境省 — 30by30ロードマップ</p>
                    <p class="text-xs text-muted mt-1">日本の 30by30 目標達成に向けたロードマップと自然共生サイト制度の概要</p>
                    <a href="https://www.env.go.jp/nature/biodiversity/OECM.html" target="_blank" rel="noopener" class="text-xs text-primary hover:underline mt-1 inline-block">env.go.jp</a>
                </div>

                <div class="bg-white rounded-xl p-4 border border-gray-100">
                    <p class="text-sm font-bold text-text">Japan NBSAP 2023-2030</p>
                    <p class="text-xs text-muted mt-1">生物多様性条約（CBD）に基づく日本の国家戦略・行動計画</p>
                    <a href="https://www.cbd.int/doc/nbsap/NBSAPJapan2023-2030-Flier-English.pdf" target="_blank" rel="noopener" class="text-xs text-primary hover:underline mt-1 inline-block">cbd.int</a>
                </div>
            </div>
        </div>
    </section>

    <!-- CTA Section -->
    <section id="action" class="py-16 px-6 section-anchor">
        <div class="max-w-3xl mx-auto">
            <div class="bg-gradient-to-br from-emerald-50 via-amber-50 to-cyan-50 rounded-[2rem] p-8 md:p-16 border border-gray-200 text-center">
                <h2 class="text-2xl md:text-3xl font-black mb-4">100年後のために、<br class="md:hidden">キミができること</h2>
                <p class="text-muted mb-8 max-w-lg mx-auto leading-relaxed">
                    特別な知識はいりません。<br>
                    近所を散歩して、生き物を見つけたら記録する。<br>
                    それだけで、未来の地球を守る一歩になります。
                </p>
                <div class="flex flex-col sm:flex-row justify-center gap-4">
                    <a href="/post.php" class="cta-gradient text-white font-bold px-8 py-4 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg">
                        <i data-lucide="camera" class="w-5 h-5"></i>まず1枚、撮ってみる
                    </a>
                    <a href="/field_research.php" class="bg-white text-text font-bold px-8 py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors border border-border">
                        <i data-lucide="search" class="w-5 h-5"></i>いきものサーチで記録する
                    </a>
                </div>
            </div>
        </div>
    </section>

    </main>

    <?php include __DIR__ . '/../components/footer.php'; ?>
</body>

</html>
