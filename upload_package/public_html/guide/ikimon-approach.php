<?php
/**
 * ikimon のアプローチ — 100年後の生態系のために
 * SEO: /guide/ikimon-approach.php
 */
$meta_title = 'ikimon のアプローチ — 100年後の生態系のために';
$meta_description = '散歩しながら自然を記録する。それだけで、未来の科学者への贈り物になる。ikimonが採用する受動検出AI・3層プライバシー保護・5軸生物多様性評価の設計思想を、中高生にもわかるように解説。';
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
    {
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
        "dateModified": "2026-03-21",
        "about": [
            { "@type": "Thing", "name": "市民科学" },
            { "@type": "Thing", "name": "生物多様性モニタリング" },
            { "@type": "Thing", "name": "受動検出AI" }
        ],
        "description": "散歩しながら自然を記録する。それだけで、未来の科学者への贈り物になる。ikimonの設計思想を解説。"
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
            </div>

            <h1 class="text-3xl md:text-4xl font-black tracking-tight leading-tight mb-4">
                100年後の生態系のために、<br class="md:hidden">いま記録する
            </h1>

            <p class="text-lg text-muted leading-relaxed mb-6">
                散歩しながら自然を記録する。<br>
                それだけで、未来の科学者への贈り物になる。
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
                    <p class="stat-number text-2xl md:text-3xl font-black">741+</p>
                    <p class="text-xs text-muted mt-1">参照論文</p>
                </div>
                <div class="evidence-card text-center">
                    <p class="stat-number text-2xl md:text-3xl font-black">6,522</p>
                    <p class="text-xs text-muted mt-1">鳥声AI対応種</p>
                </div>
                <div class="evidence-card text-center">
                    <p class="stat-number text-2xl md:text-3xl font-black">3層</p>
                    <p class="text-xs text-muted mt-1">プライバシー保護</p>
                </div>
                <div class="evidence-card text-center">
                    <p class="stat-number text-2xl md:text-3xl font-black">5軸</p>
                    <p class="text-xs text-muted mt-1">生物多様性評価</p>
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
                    <a href="#three-methods" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-emerald-600 font-bold">02</span> 3つの記録方法
                    </a>
                    <a href="#design-philosophy" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-emerald-600 font-bold">03</span> なぜこう作ったのか
                    </a>
                    <a href="#data-protection" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-emerald-600 font-bold">04</span> データの守り方
                    </a>
                    <a href="#data-trust" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-emerald-600 font-bold">05</span> データの信頼性
                    </a>
                    <a href="#action" class="toc-link text-sm text-muted py-1 flex items-center gap-2">
                        <span class="text-xs text-amber-600 font-bold">06</span> キミができること
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
                    ikimon は、その「ふつうの散歩データ」を<strong class="text-text">100年先まで残る形</strong>で記録するために作られました。
                </p>
            </div>
        </div>
    </section>

    <!-- Section 2: 3つの記録方法 -->
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
                    ikimon はこの疑問に、<strong class="text-text">3つの仕組み</strong>で答えます。
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
                    <a href="/walk.php" class="bg-white text-text font-bold px-8 py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors border border-border">
                        <i data-lucide="footprints" class="w-5 h-5"></i>散歩ついでに記録する
                    </a>
                </div>
            </div>
        </div>
    </section>

    </main>

    <?php include __DIR__ . '/../components/footer.php'; ?>
</body>

</html>
