<?php

/**
 * B2B Landing Page — ikimon for Business
 * 
 * セルフサービスファネルの入口。
 * LP → デモ → 料金 → 申込 の動線。
 */
require_once __DIR__ . '/../../config/config.php';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ikimon for Business | 生物多様性モニタリングで環境投資を"見える化"</title>
    <meta name="description" content="ikimonは市民科学で生物多様性データを収集し、企業の環境活動を定量レポートに変換。TNFD・CSR報告を自動生成。">
    <meta property="og:title" content="ikimon for Business">
    <meta property="og:description" content="観察するだけで、環境投資が「見える」ようになるプラットフォーム">
    <meta property="og:type" content="website">
    <link rel="icon" type="image/png" sizes="32x32" href="../assets/img/favicon-32.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #10b981;
            --primary-dark: #065f46;
            --primary-light: #d1fae5;
            --accent: #3b82f6;
            --accent-dark: #1e40af;
            --text: #1a1a2e;
            --text-secondary: #4b5563;
            --muted: #9ca3af;
            --bg: #ffffff;
            --surface: #f9fafb;
            --border: #e5e7eb;
            --gradient-hero: linear-gradient(135deg, #065f46 0%, #10b981 50%, #3b82f6 100%);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Noto Sans JP', sans-serif;
            background: var(--bg);
            color: var(--text);
            font-size: 16px;
            line-height: 1.8;
            overflow-x: hidden;
        }

        /* ===== UTILITY ===== */
        .container {
            max-width: 1100px;
            margin: 0 auto;
            padding: 0 24px;
        }

        .badge {
            display: inline-block;
            padding: 4px 14px;
            border-radius: 99px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }

        .badge-green {
            background: var(--primary-light);
            color: var(--primary-dark);
        }

        .section {
            padding: 80px 0;
        }

        .section-title {
            font-size: 28px;
            font-weight: 900;
            margin-bottom: 12px;
        }

        .section-sub {
            font-size: 16px;
            color: var(--text-secondary);
            max-width: 600px;
        }

        .section-center {
            text-align: center;
        }

        .section-center .section-sub {
            margin: 0 auto;
        }

        /* ===== LP NAV ===== */
        .lp-nav {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 100;
            background: rgba(255, 255, 255, 0.92);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--border);
            transition: transform 0.3s;
        }

        .lp-nav .inner {
            max-width: 1100px;
            margin: 0 auto;
            padding: 0 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 60px;
        }

        .lp-nav .logo {
            font-size: 20px;
            font-weight: 900;
            color: var(--primary);
            text-decoration: none;
        }

        .lp-nav .logo sup {
            font-size: 10px;
            color: var(--accent);
            font-weight: 700;
            vertical-align: super;
        }

        .lp-nav-links {
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .lp-nav-links a {
            font-size: 13px;
            font-weight: 700;
            color: var(--text-secondary);
            text-decoration: none;
            transition: color 0.2s;
        }

        .lp-nav-links a:hover {
            color: var(--primary);
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 700;
            text-decoration: none;
            transition: all 0.2s;
            border: none;
            cursor: pointer;
        }

        .btn-primary-lp {
            background: var(--primary);
            color: white;
        }

        .btn-primary-lp:hover {
            background: var(--primary-dark);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .btn-outline {
            background: transparent;
            color: var(--primary);
            border: 2px solid var(--primary);
        }

        .btn-outline:hover {
            background: var(--primary-light);
        }

        .btn-accent {
            background: var(--accent);
            color: white;
        }

        .btn-accent:hover {
            background: var(--accent-dark);
            transform: translateY(-1px);
        }

        .btn-lg {
            padding: 14px 32px;
            font-size: 16px;
            border-radius: 10px;
        }

        .btn-icon {
            font-size: 18px;
        }

        /* ===== HERO ===== */
        .hero {
            padding: 120px 0 80px;
            background: var(--gradient-hero);
            color: white;
            position: relative;
            overflow: hidden;
        }

        .hero::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -20%;
            width: 600px;
            height: 600px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.05);
            animation: float 8s ease-in-out infinite;
        }

        .hero::after {
            content: '';
            position: absolute;
            bottom: -1px;
            left: 0;
            right: 0;
            height: 80px;
            background: linear-gradient(to top, white, transparent);
        }

        @keyframes float {

            0%,
            100% {
                transform: translate(0, 0) scale(1);
            }

            50% {
                transform: translate(-30px, 30px) scale(1.05);
            }
        }

        @keyframes fadeUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }

            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .fade-up {
            opacity: 0;
            transform: translateY(30px);
            transition: opacity 0.6s ease-out, transform 0.6s ease-out;
        }

        .fade-up.is-visible {
            opacity: 1;
            transform: translateY(0);
        }

        .hero .container {
            position: relative;
            z-index: 1;
        }

        .hero h1 {
            font-size: 36px;
            font-weight: 900;
            line-height: 1.3;
            margin-bottom: 16px;
            max-width: 620px;
        }

        .hero .lead {
            font-size: 17px;
            opacity: 0.9;
            max-width: 540px;
            margin-bottom: 28px;
            line-height: 1.8;
        }

        .hero-cta {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }

        .hero-stats {
            display: flex;
            gap: 32px;
            margin-top: 40px;
            flex-wrap: wrap;
        }

        .hero-stat {
            text-align: center;
        }

        .hero-stat .num {
            font-size: 32px;
            font-weight: 900;
            display: block;
        }

        .hero-stat .label {
            font-size: 11px;
            opacity: 0.8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        @media (max-width: 768px) {
            .hero h1 {
                font-size: 26px;
            }

            .hero {
                padding: 100px 0 60px;
            }

            .hero-stats {
                gap: 24px;
            }

            .hero-stat .num {
                font-size: 24px;
            }

            .lp-nav-links a.hide-mobile {
                display: none;
            }
        }

        /* ===== 3 STEPS ===== */
        .steps-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
            margin-top: 40px;
        }

        .step-card {
            background: white;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 28px 24px;
            text-align: center;
            position: relative;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .step-card:hover {
            transform: translateY(-6px);
            box-shadow: 0 12px 32px rgba(16, 185, 129, 0.15);
            border-color: var(--primary);
        }

        .step-num {
            position: absolute;
            top: -14px;
            left: 50%;
            transform: translateX(-50%);
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: var(--primary);
            color: white;
            font-size: 13px;
            font-weight: 900;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .step-icon {
            font-size: 36px;
            margin: 8px 0 12px;
        }

        .step-card h3 {
            font-size: 16px;
            font-weight: 900;
            margin-bottom: 6px;
        }

        .step-card p {
            font-size: 13px;
            color: var(--text-secondary);
        }

        @media (max-width: 768px) {
            .steps-grid {
                grid-template-columns: 1fr;
                max-width: 400px;
                margin-left: auto;
                margin-right: auto;
            }
        }

        /* ===== REPORT GALLERY ===== */
        .report-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-top: 32px;
        }

        .report-card {
            background: white;
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            transition: all 0.2s;
        }

        .report-card:hover {
            border-color: var(--primary);
            box-shadow: 0 8px 24px rgba(16, 185, 129, 0.15);
            transform: translateY(-4px);
        }

        .report-icon {
            font-size: 32px;
            margin-bottom: 8px;
        }

        .report-card h3 {
            font-size: 14px;
            font-weight: 700;
        }

        .report-card p {
            font-size: 12px;
            color: var(--muted);
            margin-top: 4px;
        }

        .report-card .tag {
            display: inline-block;
            background: var(--surface);
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            color: var(--primary-dark);
            margin-top: 8px;
        }

        @media (max-width: 768px) {
            .report-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }

        /* ===== USE CASES ===== */
        .use-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            margin-top: 32px;
        }

        .use-card {
            display: flex;
            gap: 14px;
            align-items: flex-start;
            padding: 20px;
            background: var(--surface);
            border-radius: 10px;
            border: 1px solid var(--border);
        }

        .use-icon {
            font-size: 24px;
            flex-shrink: 0;
        }

        .use-card h3 {
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 4px;
        }

        .use-card p {
            font-size: 12px;
            color: var(--text-secondary);
        }

        @media (max-width: 768px) {
            .use-grid {
                grid-template-columns: 1fr;
            }
        }

        /* ===== COMPARISON ===== */
        .compare-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 32px;
            font-size: 14px;
        }

        .compare-table th {
            padding: 12px 16px;
            text-align: left;
            font-weight: 900;
            font-size: 16px;
            border-bottom: 3px solid var(--primary);
        }

        .compare-table td {
            padding: 10px 16px;
            border-bottom: 1px solid var(--border);
        }

        .compare-table .feature-name {
            font-weight: 700;
            font-size: 13px;
        }

        .compare-table .check {
            color: var(--primary);
            font-weight: 900;
            font-size: 16px;
        }

        .compare-table .cross {
            color: var(--muted);
        }

        .price-row td {
            padding: 16px;
            font-size: 20px;
            font-weight: 900;
            border-bottom: none;
        }

        .price-row .price-label {
            font-size: 12px;
            font-weight: 400;
            color: var(--muted);
            display: block;
        }

        /* ===== SOCIAL PROOF ===== */
        .proof-bar {
            background: var(--surface);
            border-top: 1px solid var(--border);
            border-bottom: 1px solid var(--border);
            padding: 24px 0;
            text-align: center;
        }

        .proof-bar .inner {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 40px;
            flex-wrap: wrap;
        }

        .proof-item {
            font-size: 12px;
            color: var(--muted);
            font-weight: 700;
        }

        .proof-item strong {
            color: var(--text);
            font-size: 14px;
        }

        /* ===== CTA SECTION ===== */
        .cta-section {
            background: var(--gradient-hero);
            color: white;
            padding: 64px 0;
            text-align: center;
        }

        .cta-section h2 {
            font-size: 28px;
            font-weight: 900;
            margin-bottom: 12px;
        }

        .cta-section p {
            font-size: 15px;
            opacity: 0.9;
            margin-bottom: 24px;
        }

        .cta-buttons {
            display: flex;
            gap: 12px;
            justify-content: center;
            flex-wrap: wrap;
        }

        /* ===== LP FOOTER ===== */
        .lp-footer {
            padding: 32px 0;
            text-align: center;
            font-size: 12px;
            color: var(--muted);
            border-top: 1px solid var(--border);
        }

        .lp-footer a {
            color: var(--text-secondary);
            text-decoration: none;
            margin: 0 8px;
        }

        .lp-footer a:hover {
            color: var(--primary);
        }
    </style>
</head>

<body>
    <!-- Navigation -->
    <nav class="lp-nav">
        <div class="inner">
            <a href="index.php" class="logo">ikimon<sup>Business</sup></a>
            <div class="lp-nav-links">
                <a href="../index.php" class="hide-mobile" style="font-size:12px; opacity:0.6;">← ikimon 一般サイトへ</a>
                <a href="#how" class="hide-mobile">仕組み</a>
                <a href="#reports" class="hide-mobile">レポート</a>
                <a href="pricing.php" class="hide-mobile">料金</a>
                <a href="demo.php" class="btn btn-outline" style="padding: 6px 16px; font-size: 12px;">デモを体験</a>
                <a href="apply.php" class="btn btn-primary-lp" style="padding: 6px 16px; font-size: 12px;">導入する</a>
            </div>
        </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero">
        <div class="container">
            <span class="badge badge-green">🌿 TNFD / 30by30 対応</span>
            <h1 style="margin-top: 12px;">観察するだけで、<br>環境投資が"見える"ようになる</h1>
            <p class="lead">
                社員が身近な生き物を記録するだけで、<br>
                生物多様性データが蓄積され、<br>
                高品質なレポートが自動生成されます。
            </p>
            <div class="hero-cta">
                <a href="demo.php" class="btn btn-lg" style="background: white; color: var(--primary-dark);">🎯 無料デモを体験する</a>
                <a href="../api/generate_report.php?site_id=ikan_hq&from=2000-01-01" target="_blank" class="btn btn-lg btn-outline" style="color: white; border-color: rgba(255,255,255,0.5);">📄 実際のレポートを見る</a>
            </div>
            <div class="hero-stats">
                <?php
                // Dynamic stats from real platform data
                $omoikaneCount = 0;
                $omoikanePath = __DIR__ . '/../../data/library/omoikane.sqlite3';
                if (file_exists($omoikanePath)) {
                    try {
                        $odb = new SQLite3($omoikanePath);
                        $omoikaneCount = (int)$odb->querySingle("SELECT COUNT(*) FROM species WHERE distillation_status = 'distilled'");
                        $odb->close();
                    } catch (Exception $e) {
                    }
                }
                $reportCount = count(glob(__DIR__ . '/../api/generate_*.php'));
                ?>
                <div class="hero-stat">
                    <span class="num"><?php echo number_format($omoikaneCount); ?></span>
                    <span class="label">分析済み科学文献</span>
                </div>
                <div class="hero-stat">
                    <span class="num"><?php echo $reportCount; ?></span>
                    <span class="label">レポートテンプレート</span>
                </div>
                <div class="hero-stat">
                    <span class="num">TNFD</span>
                    <span class="label">LEAP対応</span>
                </div>
            </div>
        </div>
    </section>

    <!-- How It Works -->
    <section class="section" id="how">
        <div class="container section-center">
            <span class="badge badge-green">HOW IT WORKS</span>
            <h2 class="section-title" style="margin-top: 8px;">3ステップでデータ資産に変わる</h2>
            <p class="section-sub">特別な知識は不要。スマートフォンで写真を撮るだけで、専門レポートが自動で仕上がります。</p>

            <div class="steps-grid">
                <div class="step-card">
                    <div class="step-num">1</div>
                    <div class="step-icon">📱</div>
                    <h3>観察する</h3>
                    <p>社員がスマホで身近な生き物を撮影・記録。<br>アプリ感覚で簡単操作。</p>
                </div>
                <div class="step-card">
                    <div class="step-num">2</div>
                    <div class="step-icon">🔬</div>
                    <h3>市民科学で検証</h3>
                    <p>コミュニティの相互検証で<br>データの信頼性が確保されます。</p>
                </div>
                <div class="step-card">
                    <div class="step-num">3</div>
                    <div class="step-icon">📊</div>
                    <h3>レポート自動生成</h3>
                    <p>BISスコア、TNFD対応レポートが<br>ワンクリックで出力されます。</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Report Gallery -->
    <section class="section" id="reports" style="background: var(--surface);">
        <div class="container section-center">
            <span class="badge badge-green">REPORT TEMPLATES</span>
            <h2 class="section-title" style="margin-top: 8px;">6種のプロフェッショナルレポート</h2>
            <p class="section-sub">目的に応じて最適なレポートをワンクリック生成。PDF保存・印刷にも対応。</p>

            <div class="report-grid">
                <div class="report-card">
                    <div class="report-icon">📊</div>
                    <h3>サイト生物多様性レポート</h3>
                    <p>種一覧、BISスコア、レッドリスト照合を網羅した基本レポート</p>
                    <span class="tag">全プラン</span>
                </div>
                <div class="report-card">
                    <div class="report-icon">📋</div>
                    <h3>TNFD LEAPレポート</h3>
                    <p>TNFD フレームワークの4フェーズに対応した開示資料</p>
                    <span class="tag">全プラン</span>
                </div>
                <div class="report-card">
                    <div class="report-icon">📝</div>
                    <h3>活動報告書</h3>
                    <p>観察活動の時系列実績、月次推移、イベント記録</p>
                    <span class="tag">Business</span>
                </div>
                <div class="report-card">
                    <div class="report-icon">🌱</div>
                    <h3>サステナビリティレポート</h3>
                    <p>SDGsマッピング、環境パフォーマンス指標、CSR添付資料</p>
                    <span class="tag">Business</span>
                </div>
                <div class="report-card">
                    <div class="report-icon">🎯</div>
                    <h3>エグゼクティブサマリー</h3>
                    <p>A4 1ページ。経営層向けKPI要約</p>
                    <span class="tag">Business</span>
                </div>
                <div class="report-card">
                    <div class="report-icon">📸</div>
                    <h3>写真ダイジェスト</h3>
                    <p>観察写真ギャラリー。社内報告やイベント振り返りに</p>
                    <span class="tag">Business</span>
                </div>
            </div>

            <div style="text-align: center; margin-top: 32px;">
                <a href="../api/generate_report.php?site_id=ikan_hq&from=2000-01-01" target="_blank" class="btn btn-lg btn-primary-lp">📋 実際のレポートを見る →</a>
                <p style="font-size: 12px; color: var(--muted); margin-top: 8px;">愛管株式会社様の実データから自動生成されたレポート</p>
            </div>
        </div>
    </section>

    <!-- Use Cases -->
    <section class="section">
        <div class="container">
            <div class="section-center">
                <span class="badge badge-green">USE CASES</span>
                <h2 class="section-title" style="margin-top: 8px;">こんなシーンで活用できます</h2>
            </div>

            <div class="use-grid">
                <div class="use-card">
                    <span class="use-icon">🏢</span>
                    <div>
                        <h3>CSR/ESG報告書の添付資料</h3>
                        <p>定量的な生物多様性データをサステナビリティレポートに添付。エビデンスベースの情報開示を実現。</p>
                    </div>
                </div>
                <div class="use-card">
                    <span class="use-icon">📋</span>
                    <div>
                        <h3>TNFD開示対応</h3>
                        <p>LEAP フレームワークに準拠したデータ収集から報告書出力まで一貫してサポート。</p>
                    </div>
                </div>
                <div class="use-card">
                    <span class="use-icon">💰</span>
                    <div>
                        <h3>助成制度の活動報告</h3>
                        <p>環境保全活動の成果を定量化。活動報告書や成果レポートの作成工数を大幅削減。</p>
                    </div>
                </div>
                <div class="use-card">
                    <span class="use-icon">👥</span>
                    <div>
                        <h3>社内報告・株主向け報告</h3>
                        <p>エグゼクティブサマリー1枚で「この活動の成果」を伝える。写真ダイジェストで社内報にも。</p>
                    </div>
                </div>
                <div class="use-card">
                    <span class="use-icon">🌱</span>
                    <div>
                        <h3>環境教育プログラム</h3>
                        <p>社員参加型の観察会を定期開催。チームビルディングと環境教育を両立。</p>
                    </div>
                </div>
                <div class="use-card">
                    <span class="use-icon">📈</span>
                    <div>
                        <h3>中長期モニタリング</h3>
                        <p>BISスコアで生物多様性の経年変化を追跡。データの蓄積が資産になる。</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Social Proof -->
    <div class="proof-bar">
        <div class="inner">
            <div class="proof-item">🌿 <strong>TNFD LEAP</strong> 全4フェーズ対応</div>
            <div class="proof-item">📊 <strong>BIS</strong> 独自生物多様性指数</div>
            <div class="proof-item">🔬 <strong>Darwin Core</strong> 国際標準準拠</div>
            <div class="proof-item">🇯🇵 <strong>静岡県</strong> 浜松発</div>
        </div>
    </div>

    <!-- Pricing Preview -->
    <section class="section" id="pricing">
        <div class="container section-center">
            <span class="badge badge-green">PRICING</span>
            <h2 class="section-title" style="margin-top: 8px;">シンプルな2プラン</h2>
            <p class="section-sub">環境予算300万円の企業なら、その16%以下。データ資産の蓄積で費用対効果は年々向上します。</p>

            <table class="compare-table" style="max-width: 700px; margin: 32px auto 0;">
                <thead>
                    <tr>
                        <th></th>
                        <th>Community</th>
                        <th>Business</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="feature-name">サイト数</td>
                        <td>1サイト</td>
                        <td>無制限</td>
                    </tr>
                    <tr>
                        <td class="feature-name">観察記録の投稿・閲覧</td>
                        <td class="check">✓</td>
                        <td class="check">✓</td>
                    </tr>
                    <tr>
                        <td class="feature-name">種数・投稿数の確認</td>
                        <td class="check">✓</td>
                        <td class="check">✓</td>
                    </tr>
                    <tr>
                        <td class="feature-name">BISスコア</td>
                        <td class="cross">—</td>
                        <td class="check">✓</td>
                    </tr>
                    <tr>
                        <td class="feature-name">サイトレポート</td>
                        <td class="cross">—</td>
                        <td class="check">✓</td>
                    </tr>
                    <tr>
                        <td class="feature-name">TNFD LEAPレポート</td>
                        <td class="cross">—</td>
                        <td class="check">✓</td>
                    </tr>
                    <tr>
                        <td class="feature-name">活動報告書</td>
                        <td class="cross">—</td>
                        <td class="check">✓</td>
                    </tr>
                    <tr>
                        <td class="feature-name">CSR / エグゼクティブ</td>
                        <td class="cross">—</td>
                        <td class="check">✓</td>
                    </tr>
                    <tr>
                        <td class="feature-name">企業ダッシュボード</td>
                        <td class="cross">—</td>
                        <td class="check">✓</td>
                    </tr>
                    <tr class="price-row">
                        <td></td>
                        <td>¥0<span class="price-label">永年無料</span></td>
                        <td>¥498,000<span class="price-label">年額（税別）</span></td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-top: 24px;">
                <a href="pricing.php" class="btn btn-primary-lp btn-lg">📋 詳しい料金比較を見る →</a>
            </div>
        </div>
    </section>

    <!-- CTA -->
    <section class="cta-section">
        <div class="container">
            <h2>まずは無料デモで体験してください</h2>
            <p>サンプルデータで全レポートを閲覧できます。導入は最短5分。</p>
            <div class="cta-buttons">
                <a href="demo.php" class="btn btn-lg" style="background: white; color: var(--primary-dark);">🎯 無料デモを体験する</a>
                <a href="apply.php" class="btn btn-lg btn-outline" style="color: white; border-color: rgba(255,255,255,0.5);">📝 導入の申込み</a>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="lp-footer">
        <div class="container">
            <p style="margin-bottom: 8px;">
                <a href="../index.php">ikimon ホーム</a>
                <a href="../about.php">私たちについて</a>
                <a href="../terms.php">利用規約</a>
                <a href="../privacy.php">プライバシーポリシー</a>
                <a href="mailto:contact@ikimon.life">お問い合わせ</a>
            </p>
            <p>&copy; <?php echo date('Y'); ?> ikimon Project. Based in Hamamatsu, Japan.</p>
        </div>
    </footer>
    <script>
        // Intersection Observer for fade-up animations
        (function() {
            var els = document.querySelectorAll('.step-card, .report-card, .use-card, .section-title, .section-sub');
            els.forEach(function(el) {
                el.classList.add('fade-up');
            });
            var observer = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        observer.unobserve(entry.target);
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '0px 0px -40px 0px'
            });
            els.forEach(function(el) {
                observer.observe(el);
            });
        })();

        // Staggered animation for grid items
        document.querySelectorAll('.steps-grid, .report-grid, .use-grid').forEach(function(grid) {
            var items = grid.children;
            for (var i = 0; i < items.length; i++) {
                items[i].style.transitionDelay = (i * 0.1) + 's';
            }
        });

        // Navbar hide on scroll down
        var lastScroll = 0;
        var nav = document.querySelector('.lp-nav');
        window.addEventListener('scroll', function() {
            var curr = window.scrollY;
            if (curr > lastScroll && curr > 100) {
                nav.style.transform = 'translateY(-100%)';
            } else {
                nav.style.transform = 'translateY(0)';
            }
            lastScroll = curr;
        });
    </script>
</body>

</html>