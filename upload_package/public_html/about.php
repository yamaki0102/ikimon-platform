<?php
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CspNonce.php';
require_once __DIR__ . '/../libs/BrandMessaging.php';
Auth::init();
CspNonce::sendHeader();

$isLoggedIn = Auth::isLoggedIn();
$ctaHref = $isLoggedIn ? 'post.php' : 'login.php?redirect=post.php';
$ctaLabel = $isLoggedIn ? '観察を始める' : '無料で始める';

$meta_title = 'ikimonの想い — 自然が、子どもとまちを結ぶ | ikimon';
$regionalMessaging = BrandMessaging::regionalRevitalization();
$supportPlans = [
    $regionalMessaging['free_plan'],
    $regionalMessaging['community_plan'],
    $regionalMessaging['public_plan'],
];
$meta_description = $regionalMessaging['about_meta_description'];
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;600&display=swap" rel="stylesheet">
    <style nonce="<?= CspNonce::attr() ?>">
        /* ── msg: about.php page-scoped styles ── */

        .msg-hero {
            background: linear-gradient(135deg, #0a0f0a 0%, #0f1a12 50%, #0a0f0a 100%);
            color: #e5e7eb;
            padding: 72px 20px 56px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .msg-hero::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -30%;
            width: 80%;
            height: 200%;
            background: radial-gradient(ellipse, rgba(16, 185, 129, 0.06) 0%, transparent 70%);
            pointer-events: none;
        }
        .msg-hero h1 {
            font-family: 'Shippori Mincho', serif;
            font-size: clamp(1.75rem, 4vw, 3rem);
            font-weight: 600;
            letter-spacing: 0.05em;
            line-height: 1.5;
            color: #ffffff;
            margin-bottom: 16px;
            position: relative;
        }
        .msg-hero .msg-hero-sub {
            font-size: clamp(0.875rem, 1.5vw, 1.0625rem);
            color: rgba(255, 255, 255, 0.55);
            letter-spacing: 0.04em;
            margin-bottom: 0;
        }

        /* signature block */
        .msg-signature {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-top: 40px;
            padding-top: 32px;
            border-top: 1px solid var(--md-outline-variant);
        }
        .msg-signature-photo {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            object-fit: cover;
            flex-shrink: 0;
            border: 2px solid rgba(16, 185, 129, 0.3);
        }
        .msg-signature-name {
            font-weight: 700;
            color: var(--md-on-surface);
            font-size: 1rem;
        }
        .msg-signature-title {
            font-size: 0.8125rem;
            color: var(--md-on-surface-variant);
            margin-top: 2px;
        }

        /* ── editorial sections ── */
        .msg-section {
            padding: 64px 20px;
        }
        .msg-section-inner {
            max-width: 680px;
            margin: 0 auto;
        }
        .msg-surface {
            background: var(--md-surface-container);
        }
        .msg-section h2 {
            font-family: 'Shippori Mincho', serif;
            font-size: clamp(1.25rem, 2.5vw, 1.625rem);
            font-weight: 600;
            color: var(--md-on-surface);
            margin-bottom: 32px;
            letter-spacing: 0.03em;
            line-height: 1.5;
        }

        /* lead blockquote */
        .msg-lead {
            border-left: 3px solid var(--md-primary);
            padding-left: 20px;
            font-family: 'Shippori Mincho', serif;
            font-size: clamp(1.0625rem, 2vw, 1.25rem);
            color: var(--md-on-surface);
            line-height: 1.8;
            margin-bottom: 40px;
        }

        /* body text */
        .msg-body p {
            font-size: 1rem;
            line-height: 2.0;
            color: var(--md-on-surface-variant);
            margin-bottom: 20px;
        }
        .msg-body p strong {
            color: var(--md-on-surface);
        }

        /* green accent line */
        .msg-accent {
            color: var(--md-primary);
            font-weight: 600;
            font-size: 1.0625rem;
            line-height: 1.8;
            margin: 28px 0;
        }

        /* large accent (section closer) */
        .msg-accent-lg {
            color: var(--md-primary);
            font-family: 'Shippori Mincho', serif;
            font-weight: 600;
            font-size: clamp(1.125rem, 2vw, 1.375rem);
            line-height: 1.6;
            text-align: center;
            margin: 48px 0 0;
            padding: 32px 0;
            border-top: 1px solid var(--md-outline-variant);
        }

        /* insight blocks */
        .msg-insight {
            display: flex;
            gap: 16px;
            margin: 28px 0;
            align-items: flex-start;
        }
        .msg-insight-num {
            font-family: 'Shippori Mincho', serif;
            font-size: 2rem;
            font-weight: 700;
            color: var(--md-primary);
            line-height: 1;
            flex-shrink: 0;
            margin-top: 2px;
        }
        .msg-insight-body {
            flex: 1;
        }
        .msg-insight-text {
            font-size: 1rem;
            font-weight: 600;
            color: var(--md-on-surface);
            line-height: 1.6;
            margin-bottom: 8px;
        }
        .msg-cite {
            font-size: 0.8125rem;
            color: var(--md-on-surface-variant);
            line-height: 1.6;
        }

        /* stat hero */
        .msg-stat-hero {
            text-align: center;
            padding: 40px 0;
            margin: 32px 0;
            border-top: 1px solid var(--md-outline-variant);
            border-bottom: 1px solid var(--md-outline-variant);
        }
        .msg-stat-row {
            display: flex;
            justify-content: center;
            align-items: baseline;
            gap: 12px;
        }
        .msg-stat-number {
            font-family: 'Montserrat', sans-serif;
            font-size: clamp(2.5rem, 6vw, 3.5rem);
            font-weight: 900;
            color: var(--md-on-surface);
            letter-spacing: -0.02em;
            line-height: 1;
        }
        .msg-stat-slash {
            font-size: clamp(1.5rem, 3vw, 2rem);
            color: var(--md-on-surface-variant);
            font-weight: 300;
        }
        .msg-stat-sub {
            font-size: clamp(1.25rem, 3vw, 1.75rem);
            color: var(--md-on-surface-variant);
            font-weight: 700;
            font-family: 'Montserrat', sans-serif;
        }
        .msg-stat-labels {
            display: flex;
            justify-content: center;
            gap: 40px;
            margin-top: 12px;
        }
        .msg-stat-label {
            font-size: 0.8125rem;
            color: var(--md-on-surface-variant);
            letter-spacing: 0.03em;
        }

        /* examples list */
        .msg-examples {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin: 20px 0;
            padding: 20px;
            border-radius: 12px;
            background: var(--md-surface-container);
            border: 1px solid var(--md-outline-variant);
        }
        .msg-surface .msg-examples {
            background: var(--md-surface);
        }
        .msg-example-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.875rem;
            color: var(--md-on-surface-variant);
            padding: 6px 0;
        }
        .msg-example-item span:last-child {
            font-weight: 700;
            font-family: 'Montserrat', sans-serif;
            color: var(--md-on-surface);
        }

        /* plan blocks */
        .msg-plans {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin: 28px 0;
        }
        .msg-plan-item {
            padding: 20px;
            border-radius: 12px;
            border: 1px solid var(--md-outline-variant);
        }
        .msg-plan-item.msg-plan-free {
            background: rgba(16, 185, 129, 0.06);
            border-color: rgba(16, 185, 129, 0.2);
        }
        .msg-plan-tag {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 999px;
            font-size: 0.6875rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        .msg-plan-free .msg-plan-tag {
            background: var(--md-primary);
            color: #ffffff;
        }
        .msg-plan-item:not(.msg-plan-free) .msg-plan-tag {
            background: var(--md-surface-container);
            color: var(--md-on-surface-variant);
            border: 1px solid var(--md-outline-variant);
        }
        .msg-plan-name {
            font-weight: 700;
            color: var(--md-on-surface);
            font-size: 1rem;
            margin-bottom: 4px;
        }
        .msg-plan-desc {
            font-size: 0.875rem;
            color: var(--md-on-surface-variant);
            line-height: 1.6;
        }

        /* CTA section */
        .msg-cta-section {
            text-align: center;
            padding: 64px 20px;
        }
        .msg-cta-inner {
            max-width: 680px;
            margin: 0 auto;
        }
        .msg-cta-heading {
            font-family: 'Shippori Mincho', serif;
            font-size: clamp(1.25rem, 2.5vw, 1.625rem);
            font-weight: 600;
            color: var(--md-on-surface);
            margin-bottom: 32px;
            letter-spacing: 0.03em;
        }
        .msg-cta-buttons {
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-width: 400px;
            margin: 0 auto 40px;
        }
        .msg-cta-buttons .btn-primary,
        .msg-cta-buttons .btn-secondary {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .msg-contact {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            padding-top: 32px;
            border-top: 1px solid var(--md-outline-variant);
        }
        .msg-contact-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.875rem;
            color: var(--md-on-surface-variant);
        }
        .msg-contact-item a {
            color: var(--md-primary);
        }

        /* guide links (simplified) */
        .msg-guides {
            max-width: 680px;
            margin: 0 auto;
            padding: 0 20px 64px;
        }
        .msg-guides-label {
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--md-on-surface-variant);
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .msg-guide-link {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            border-radius: 12px;
            transition: background 0.2s;
            text-decoration: none;
        }
        .msg-guide-link:hover {
            background: var(--md-surface-container);
        }
        .msg-guide-link .msg-guide-title {
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--md-on-surface);
        }
        .msg-guide-link .msg-guide-desc {
            font-size: 0.75rem;
            color: var(--md-on-surface-variant);
        }
        .msg-guide-link i {
            color: var(--md-on-surface-variant);
            flex-shrink: 0;
        }

        /* ── responsive ── */
        @media (min-width: 640px) {
            .msg-hero {
                padding: 88px 24px 64px;
            }
            .msg-section {
                padding: 80px 24px;
            }
            .msg-cta-buttons {
                flex-direction: row;
                max-width: 500px;
            }
            .msg-cta-buttons .btn-primary,
            .msg-cta-buttons .btn-secondary {
                flex: 1;
            }
        }
    </style>
</head>
<body class="js-loading pt-14 font-body" style="background:var(--md-surface);color:var(--md-on-surface);">

    <?php include __DIR__ . '/components/nav.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <main>

    <!-- ============================================
         Section 1: Hero
         ============================================ -->
    <section class="msg-hero">
        <h1>自然が、子どもとまちを結ぶ。</h1>
        <p class="msg-hero-sub">ikimon.lifeが目指す地域創生のかたち</p>
    </section>

    <!-- TOC -->
    <nav class="msg-section" style="padding-top:32px;padding-bottom:0;">
        <div class="msg-section-inner" style="max-width:520px;">
            <div style="background:var(--md-surface-container);border-radius:16px;padding:24px 28px;">
                <p style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--md-on-surface-variant);margin-bottom:14px;">目次</p>
                <ol style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px;font-size:0.9375rem;">
                    <li><a href="#origin" style="color:var(--md-primary);text-decoration:none;">原体験</a></li>
                    <li><a href="#regional" style="color:var(--md-primary);text-decoration:none;">なぜ、地域創生なのか</a></li>
                    <li><a href="#disappearing" style="color:var(--md-primary);text-decoration:none;">消滅可能性自治体</a></li>
                    <li><a href="#sustainability" style="color:var(--md-primary);text-decoration:none;">持続可能なかたち</a></li>
                </ol>
            </div>
        </div>
    </nav>

    <!-- ============================================
         Section 2: 原体験 — 岩内の記憶
         ============================================ -->
    <section id="origin" class="msg-section" style="scroll-margin-top:80px;">
        <div class="msg-section-inner">

            <h2>原体験</h2>

            <div class="msg-lead">
                玄関先の飛び石をひっくり返すと、その下にハサミムシがいた。
            </div>

            <div class="msg-body">
                <p>
                    北海道・岩内町。<br>
                    幼稚園から小学1年生まで過ごした、僕の最初のふるさとです。
                </p>
                <p>
                    海がありました。山がありました。川もありました。<br>
                    そして、家の前には——当時の僕には「ジャングル」としか思えないほどの庭がありました。
                </p>
                <p>
                    玄関先の石畳をひっくり返して、ハサミムシを捕まえる。<br>
                    飼育に挑戦して、毎日観察する。<br>
                    秋になるとスキー場に行って、トノサマバッタを10匹以上捕まえる。<br>
                    それだけで、世界は最高に面白かった。
                </p>
                <p>
                    でも、そのときの写真は1枚も残っていません。<br>
                    もし記録があったら、何度も見返して、もっと愛着が深まっていたんじゃないか。<br>
                    そう思うことがあります。
                </p>

                <p class="msg-accent">
                    飛び石がなければ、ハサミムシとの出会いはなかった。<br>
                    整備されたスキー場がなければ、バッタの記憶も残らなかった。
                </p>

                <p>
                    手つかずの自然も、もちろん大切です。<br>
                    でも、人が手入れをしている場所——玄関先の石畳、草を刈ったゲレンデ、管理された里山——<br>
                    そういう場所にこそ、子どもが生き物と出会うきっかけがあります。
                </p>
            </div>

            <h2 style="margin-top: 48px;">まちの解像度が上がると、愛着も上がる</h2>

            <div class="msg-body">
                <p>
                    いつも歩いている道の街路樹、なんという木か知っていますか？<br>
                    街でよく見かけるカラス、ハシブトガラスとハシボソガラスの違いはわかりますか？
                </p>
                <p>
                    知らなくても、生活は何も困りません。<br>
                    でも、一度知ると——<br>
                    同じ道が、ちょっとだけ違って見えるようになる。
                </p>
                <p>
                    名前を知ること。季節の変化に気づくこと。<br>
                    それは、自分が暮らしている場所の「解像度」が上がるということです。
                </p>

                <p class="msg-accent">
                    解像度が上がると、愛着が生まれる。<br>
                    愛着が生まれると、その場所を大切にしたくなる。
                </p>

                <p>
                    ikimon.lifeは、そのきっかけを作りたい。<br>
                    見つけて、記録して、見返す。<br>
                    それだけで、まちとの関係が少しずつ変わっていく。
                </p>

                <p class="msg-accent-lg">
                    子どもと自然の結びつきを、失いたくない。
                </p>
            </div>

        </div>
    </section>

    <!-- ============================================
         Section 3: なぜ、地域創生なのか
         ============================================ -->
    <section id="regional" class="msg-section msg-surface" style="scroll-margin-top:80px;">
        <div class="msg-section-inner">

            <h2>なぜ、地域創生なのか</h2>

            <div class="msg-body">
                <p>
                    地域創生って、誰かひとりが頑張ってできることじゃありません。<br>
                    ikimon.lifeだけで実現できるとも思っていません。
                </p>
                <p>
                    でも、地域の大人たちが——親も、先生も、近所のおじさんも——<br>
                    子どもと一緒に自然の中を歩く機会を作っていくことで、<br>
                    少しずつ、何かが変わり始めると信じています。
                </p>
                <p>
                    自然の中を歩くことは、心と体の健康につながる。<br>
                    観察を通じて地域の自然を知ることは、地元への愛着につながる。<br>
                    そして地元を好きな人が増えることは、その地域が生き残っていく力になる。
                </p>
                <p>
                    ikimon.lifeは、その循環のきっかけを作る道具でありたい。<br>
                    使うのは、地域に暮らすみなさんです。
                </p>
                <p>
                    感覚だけの話じゃありません。<br>
                    全国の調査が、繰り返し同じことを示しています。
                </p>
            </div>

            <!-- Insight 1 -->
            <div class="msg-insight">
                <span class="msg-insight-num">1</span>
                <div class="msg-insight-body">
                    <p class="msg-insight-text">
                        地域への愛着は、「自然」と「人のつながり」がセットで語られる
                    </p>
                    <p class="msg-cite">
                        香取市の中学生調査では、地元を好きな理由の1位が「自然が豊かだから」（72.8%）、2位が「地域の人がやさしく、親切だから」（58.3%）。
                        浜松市の若年層調査でも、81.8%が「浜松が好き」と答え、魅力として人間関係と自然環境を挙げている。
                    </p>
                </div>
            </div>

            <!-- Insight 2 -->
            <div class="msg-insight">
                <span class="msg-insight-num">2</span>
                <div class="msg-insight-body">
                    <p class="msg-insight-text">
                        子どもが「帰りたい」と思う理由——<br>「自然が豊か」「人が優しい」「生まれた場所」
                    </p>
                    <p class="msg-cite">
                        飯島町の中学生調査で、「住みたい・帰ってきたい」理由の最多は「自然が多い、空気が美味しい」（45.5%）。
                        「どちらかというと帰りたい」層でも、「自然豊か・住みやすい」が62.5%で最多、次いで「人の優しさ・地域とのつながり」（12.5%）。
                    </p>
                </div>
            </div>

            <!-- Insight 3 -->
            <div class="msg-insight">
                <span class="msg-insight-num">3</span>
                <div class="msg-insight-body">
                    <p class="msg-insight-text">
                        家族以外の「信頼できる大人」がいることが、子どもの安心感を支えている
                    </p>
                    <p class="msg-cite">
                        上越市の調査では、子どもの55.18%に「信頼できる大人」が、51.71%に「自分のことを大切にしてくれる大人」がいると報告されている。
                        自然観察の場は、こうした家族以外の大人との接点を自然に生み出す。
                    </p>
                </div>
            </div>

            <h2 style="margin-top: 48px;">子どもだけじゃない。大人もイキイキしていないと</h2>

            <div class="msg-body">
                <p>
                    地域創生というと、つい「若い人を呼び戻す」「子どもを増やす」という話になりがちです。<br>
                    でも、そこに暮らしている大人たちが心身ともに元気でなければ、<br>
                    子どもを見守る余裕も、地域を支える力も生まれません。
                </p>
                <p>
                    実は、自然の中を歩くことには、科学的に裏付けられた効果があります。
                </p>
            </div>

            <div class="msg-insight">
                <span class="msg-insight-num" style="font-size: 1.5rem;">🧠</span>
                <div class="msg-insight-body">
                    <p class="msg-insight-text">
                        自然環境での歩行は、脳の前頭前野を活性化させる
                    </p>
                    <p class="msg-cite">
                        都市環境と比較して、自然の中を歩くことでストレスホルモンが低下し、注意力の回復や創造性の向上が確認されている。
                        生き物を観察する行為は、能動的な注意を要するため、認知的エンゲージメントをさらに高める。
                    </p>
                </div>
            </div>

            <div class="msg-insight">
                <span class="msg-insight-num" style="font-size: 1.5rem;">👟</span>
                <div class="msg-insight-body">
                    <p class="msg-insight-text">
                        1日9,800歩で認知症リスクが51%低下する
                    </p>
                    <p class="msg-cite">
                        JAMA Neurology掲載の大規模研究（78,430人対象）による。
                        散歩は特別な道具もお金もいらない、最も手軽な健康習慣。
                        そこに「観察」が加わると、ただ歩くだけでは得られない好奇心と達成感が生まれる。
                    </p>
                </div>
            </div>

            <div class="msg-body" style="margin-top: 32px;">
                <p>
                    大人が健康で、笑っていて、余裕がある。<br>
                    そんな大人がそばにいるから、子どもは安心して外に出られる。<br>
                    子どもと一緒に歩くから、大人も自然と体を動かし、気持ちが軽くなる。
                </p>
                <p>
                    自然観察は、この循環を——<br>
                    子どもの好奇心、大人の健康、世代を超えた交流を——<br>
                    特別な仕掛けなしに、自然に生み出します。
                </p>
            </div>

            <p class="msg-accent-lg">
                自然観察は、地域創生のすべてじゃない。<br>
                でも、きっと力になれる。
            </p>

        </div>
    </section>

    <!-- ============================================
         Section 4: 消滅可能性自治体
         ============================================ -->
    <section id="disappearing" class="msg-section" style="scroll-margin-top:80px;">
        <div class="msg-section-inner">

            <h2><?= htmlspecialchars($regionalMessaging['disappearing_section_heading']) ?></h2>

            <div class="msg-body">
                <p>
                    2024年4月、人口戦略会議が発表したレポートは、<br>
                    多くの人に衝撃を与えました。
                </p>
                <p>
                    <?= htmlspecialchars($regionalMessaging['disappearing_population_copy']) ?><br>
                    <?= htmlspecialchars($regionalMessaging['disappearing_count_copy']) ?><br>
                    <?= htmlspecialchars($regionalMessaging['disappearing_ratio_copy']) ?>
                </p>
            </div>

            <div class="msg-stat-hero">
                <div class="msg-stat-row">
                    <span class="msg-stat-number">744</span>
                    <span class="msg-stat-slash">/</span>
                    <span class="msg-stat-sub">1,729</span>
                </div>
                <div class="msg-stat-labels">
                    <span class="msg-stat-label">消滅可能性自治体</span>
                    <span class="msg-stat-label">全国の自治体数</span>
                </div>
            </div>

            <div class="msg-body">
                <p>
                    特に深刻な地域があります。
                </p>
            </div>

            <div class="msg-examples">
                <div class="msg-example-item">
                    <span>群馬県 南牧村</span>
                    <span>-88.0%</span>
                </div>
                <div class="msg-example-item">
                    <span>青森県 外ヶ浜町</span>
                    <span>-87.5%</span>
                </div>
                <div class="msg-example-item">
                    <span>北海道 歌志内市</span>
                    <span>-86.7%</span>
                </div>
                <div class="msg-example-item" style="padding-top: 12px; border-top: 1px solid var(--md-outline-variant);">
                    <span>秋田県全体</span>
                    <span>96%が消滅可能性</span>
                </div>
                <div class="msg-example-item">
                    <span>青森県全体</span>
                    <span>87.5%が消滅可能性</span>
                </div>
            </div>

            <div class="msg-body">
                <p>
                    数字の向こうにあるのは、誰かのふるさとです。<br>
                    子どもの頃に駆け回った野山。通学路沿いの川。秋のスキー場。<br>
                    その風景の中で生き物と出会い、誰かに名前を教えてもらった記憶。
                </p>
                <p>
                    自治体が消えるということは、そういう記憶が生まれる場所が、<br>
                    なくなるということです。
                </p>
            </div>

            <div class="msg-lead" style="margin-top: 40px;">
                <?= htmlspecialchars($regionalMessaging['priority_lead']) ?>
            </div>

            <div class="msg-body">
                <p>
                    <?= htmlspecialchars($regionalMessaging['eligibility_copy']) ?><br>
                    最も厳しい状況に直面している地域に、<br>
                    ikimon.lifeのすべての機能を<strong>無償で提供</strong>します。
                </p>
                <p>
                    それだけで何かが劇的に変わるとは思っていません。<br>
                    でも、自然を通じた小さなきっかけが、<br>
                    地域に一人でも「ここが好きだ」と思う子どもを増やせるなら。
                </p>
            </div>

            <p class="msg-accent-lg">
                この町で育った記憶を、次の世代にも残したい。
            </p>

        </div>
    </section>

    <!-- ============================================
         Section 5: ビジネスモデル
         ============================================ -->
    <section id="sustainability" class="msg-section msg-surface" style="scroll-margin-top:80px;">
        <div class="msg-section-inner">

            <h2>持続可能なかたち</h2>

            <div class="msg-body">
                <p>
                    IKIMON株式会社は、僕ひとりのスタートアップです。<br>
                    大きな組織じゃないからこそ、身軽に動ける。
                </p>
                <p>
                    企業や大規模自治体向けのPublicプランで得られる収益があれば、<br>
                    会社としての持続可能性は十分に保てると考えています。<br>
                    だから、最も支援を必要としている地域には、無償で届けられる。
                </p>
            </div>

            <div class="msg-plans">
                <?php foreach ($supportPlans as $index => $plan): ?>
                <div class="msg-plan-item<?= $index === 0 ? ' msg-plan-free' : '' ?>">
                    <span class="msg-plan-tag"><?= htmlspecialchars($plan['tag']) ?></span>
                    <p class="msg-plan-name"><?= htmlspecialchars($plan['name']) ?></p>
                    <p class="msg-plan-desc"><?= htmlspecialchars($plan['description']) ?></p>
                </div>
                <?php endforeach; ?>
            </div>

            <p class="msg-accent">
                小さな会社だからこそ、届けたい場所に届けられる。
            </p>

            <div class="msg-body" style="margin-top: 32px;">
                <p>
                    まだ始まったばかりのプロジェクトです。<br>
                    一歩ずつ、着実に前に進んでいきます。
                </p>
                <p>
                    応援していただけると嬉しいです。
                </p>
            </div>

            <div class="msg-signature">
                <img src="assets/img/yamaki.jpg" alt="八巻 毅" class="msg-signature-photo">
                <div>
                    <p class="msg-signature-name">八巻 毅</p>
                    <p class="msg-signature-title">IKIMON株式会社 代表</p>
                </div>
            </div>

        </div>
    </section>

    <!-- ============================================
         Section 6: CTA
         ============================================ -->
    <section class="msg-cta-section">
        <div class="msg-cta-inner">

            <p class="msg-cta-heading">
                一緒に、自然とまちをつなぎませんか？
            </p>

            <div class="msg-cta-buttons">
                <a href="<?= htmlspecialchars($ctaHref) ?>" class="btn-primary">
                    <i data-lucide="camera" class="w-4 h-4"></i>
                    <?= htmlspecialchars($ctaLabel) ?>
                </a>
                <a href="for-business/" class="btn-secondary">
                    <i data-lucide="building-2" class="w-4 h-4"></i>
                    企業・自治体の方へ
                </a>
            </div>

            <div class="msg-contact">
                <div class="msg-contact-item">
                    <i data-lucide="map-pin" class="w-4 h-4"></i>
                    <span>静岡県浜松市</span>
                </div>
                <div class="msg-contact-item">
                    <i data-lucide="mail" class="w-4 h-4"></i>
                    <a href="mailto:contact@ikimon.life">contact@ikimon.life</a>
                </div>
            </div>

        </div>
    </section>

    <!-- Related Guides -->
    <div class="msg-guides">
        <p class="msg-guides-label">
            <i data-lucide="book-open" class="w-4 h-4"></i>
            もっと知る
        </p>
        <a href="guide/walking-brain-science.php" class="msg-guide-link">
            <span style="font-size: 1.5rem;">🧠</span>
            <div style="flex: 1;">
                <p class="msg-guide-title">自然の中を歩くと脳に何が起きるのか？</p>
                <p class="msg-guide-desc">散歩×生きもの観察の科学的エビデンス</p>
            </div>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </a>
        <a href="guide/steps-dementia-prevention.php" class="msg-guide-link">
            <span style="font-size: 1.5rem;">👟</span>
            <div style="flex: 1;">
                <p class="msg-guide-title">1日9,800歩で認知症リスク51%減</p>
                <p class="msg-guide-desc">JAMA Neurologyの大規模研究をやさしく紹介</p>
            </div>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </a>
        <a href="guide/nature-positive.php" class="msg-guide-link">
            <span style="font-size: 1.5rem;">🌿</span>
            <div style="flex: 1;">
                <p class="msg-guide-title">ネイチャーポジティブ完全ガイド</p>
                <p class="msg-guide-desc">お散歩×観察×健康の全体像</p>
            </div>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </a>
        <a href="century_archive.php" class="msg-guide-link">
            <span style="font-size: 1.5rem;">📦</span>
            <div style="flex: 1;">
                <p class="msg-guide-title">100年生態系アーカイブ</p>
                <p class="msg-guide-desc">なぜ記録するのか、2026年の観察が100年後の比較基準に</p>
            </div>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </a>
        <a href="methodology.php" class="msg-guide-link">
            <span style="font-size: 1.5rem;">📊</span>
            <div style="flex: 1;">
                <p class="msg-guide-title">データ方針と評価手法</p>
                <p class="msg-guide-desc">データの取り扱いとモニタリング参考インデックスの透明性</p>
            </div>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </a>
    </div>

    <!-- Footer -->
    <?php include __DIR__ . '/components/footer.php'; ?>

    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>
</html>
