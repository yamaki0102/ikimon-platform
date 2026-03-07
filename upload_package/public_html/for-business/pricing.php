<?php

/**
 * B2B Pricing Page — 料金プラン比較
 */
require_once __DIR__ . '/../../config/config.php';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>料金プラン | ikimon for Business</title>
    <meta name="description" content="ikimon for Business の料金プランを比較。Communityプランは無料で観察記録と種数確認。Business プランは参考インデックスとレポート出力を含む年額498,000円（税別）。">
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
        }

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
        }

        .badge-green {
            background: var(--primary-light);
            color: var(--primary-dark);
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
        }

        .lp-nav {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 100;
            background: rgba(255, 255, 255, 0.92);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--border);
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
            gap: 16px;
        }

        .lp-nav-links a {
            font-size: 13px;
            font-weight: 700;
            color: var(--text-secondary);
            text-decoration: none;
        }

        .lp-nav-links a:hover {
            color: var(--primary);
        }

        .page-header {
            padding: 100px 0 40px;
            background: var(--surface);
            border-bottom: 1px solid var(--border);
        }

        .page-header h1 {
            font-size: 28px;
            font-weight: 900;
        }

        .page-header p {
            font-size: 15px;
            color: var(--text-secondary);
            margin-top: 8px;
            max-width: 560px;
        }

        /* Plans */
        .plans-section {
            padding: 48px 0 64px;
        }

        .plans-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
            margin-top: 24px;
            max-width: 800px;
            margin-left: auto;
            margin-right: auto;
        }

        .plan-card {
            border: 2px solid var(--border);
            border-radius: 14px;
            padding: 32px;
            position: relative;
            background: white;
            transition: all 0.2s;
        }

        .plan-card.recommended {
            border-color: var(--primary);
        }

        .plan-card.recommended::before {
            content: 'おすすめ';
            position: absolute;
            top: -12px;
            right: 20px;
            background: var(--primary);
            color: white;
            padding: 2px 12px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
        }

        .plan-name {
            font-size: 20px;
            font-weight: 900;
        }

        .plan-price {
            font-size: 36px;
            font-weight: 900;
            margin: 8px 0;
        }

        .plan-price .unit {
            font-size: 14px;
            font-weight: 400;
            color: var(--muted);
        }

        .plan-desc {
            font-size: 13px;
            color: var(--text-secondary);
            margin-bottom: 20px;
        }

        .plan-features {
            list-style: none;
            margin-bottom: 24px;
        }

        .plan-features li {
            font-size: 13px;
            padding: 6px 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .plan-features .check {
            color: var(--primary);
            font-weight: 900;
        }

        .plan-features .cross {
            color: var(--muted);
        }

        .plan-cta {
            width: 100%;
            text-align: center;
        }

        .plan-cta .btn {
            width: 100%;
            justify-content: center;
        }

        /* FAQ */
        .faq-section {
            padding: 48px 0 80px;
            background: var(--surface);
        }

        .faq-grid {
            max-width: 700px;
            margin: 24px auto 0;
        }

        .faq-item {
            background: white;
            border: 1px solid var(--border);
            border-radius: 8px;
            margin-bottom: 8px;
            overflow: hidden;
        }

        .faq-q {
            padding: 16px 20px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .faq-q::after {
            content: '+';
            font-size: 20px;
            color: var(--muted);
            transition: transform 0.2s;
        }

        .faq-item.open .faq-q::after {
            transform: rotate(45deg);
        }

        .faq-a {
            padding: 0 20px 16px;
            font-size: 13px;
            color: var(--text-secondary);
            display: none;
        }

        .faq-item.open .faq-a {
            display: block;
        }

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

        @media (max-width: 768px) {
            .plans-grid {
                grid-template-columns: 1fr;
                max-width: 400px;
            }

            .page-header h1 {
                font-size: 22px;
            }

            .plan-price {
                font-size: 28px;
            }

            .lp-nav-links a.hide-mobile {
                display: none;
            }
        }
    </style>
</head>

<body>
    <nav class="lp-nav">
        <div class="inner">
            <a href="index.php" class="logo">ikimon<sup>Business</sup></a>
            <div class="lp-nav-links">
                <a href="index.php" class="hide-mobile">概要</a>
                <a href="demo.php" class="hide-mobile">デモ</a>
                <a href="apply.php" class="btn btn-primary-lp" style="padding: 6px 16px; font-size: 12px;">導入する</a>
            </div>
        </div>
    </nav>

    <header class="page-header">
        <div class="container">
            <span class="badge badge-green">💰 PRICING</span>
            <h1 style="margin-top: 8px;">シンプルな2プラン</h1>
            <p>必要に応じてアップグレード。まずは Community プランから始められます。</p>
        </div>
    </header>

    <section class="plans-section">
        <div class="container">
            <div class="plans-grid">
                <!-- Community -->
                <div class="plan-card">
                    <div class="plan-name">Community</div>
                    <div class="plan-price">¥0 <span class="unit">永年無料</span></div>
                    <p class="plan-desc">市民科学に参加したい個人・NPO向け。<br>観察記録の投稿と種数の確認ができます。</p>
                    <ul class="plan-features">
                        <li><span class="check">✓</span> サイト登録: 1サイト</li>
                        <li><span class="check">✓</span> 観察記録の投稿・閲覧</li>
                        <li><span class="check">✓</span> 種数・投稿数の確認</li>
                        <li><span class="cross">—</span> 参考インデックス算出</li>
                        <li><span class="cross">—</span> 各種レポート出力（全6種）</li>
                        <li><span class="cross">—</span> 企業ダッシュボード</li>
                        <li><span class="cross">—</span> 観察会テンプレート</li>
                        <li><span class="cross">—</span> メンバー管理</li>
                        <li><span class="cross">—</span> データエクスポート</li>
                    </ul>
                    <div class="plan-cta">
                        <a href="apply.php" class="btn btn-outline">無料で始める</a>
                    </div>
                </div>

                <!-- Business -->
                <div class="plan-card recommended">
                    <div class="plan-name">Business</div>
                    <div class="plan-price">¥498,000 <span class="unit">/ 年（税別）</span></div>
                    <p class="plan-desc">環境投資の現状把握と改善判断を進めたい企業向け。<br>全レポート + 専用ダッシュボード。</p>
                    <ul class="plan-features">
                        <li><span class="check">✓</span> サイト登録: 無制限</li>
                        <li><span class="check">✓</span> 参考インデックス算出</li>
                        <li><span class="check">✓</span> 全6種レポート出力</li>
                        <li><span class="check">✓</span> 企業ダッシュボード</li>
                        <li><span class="check">✓</span> 観察会テンプレート</li>
                        <li><span class="check">✓</span> メンバー管理（最大50名）</li>
                        <li><span class="check">✓</span> データエクスポート（CSV/JSON）</li>
                        <li><span class="check">✓</span> メールサポート</li>
                    </ul>
                    <div class="plan-cta">
                        <a href="apply.php" class="btn btn-primary-lp">導入の申込み →</a>
                    </div>
                </div>
            </div>

            <p style="text-align: center; font-size: 12px; color: var(--muted); margin-top: 16px;">
                ※ 環境予算300万円の企業なら、コストは全体の16%以下。データ資産の蓄積で費用対効果は年々向上します。
            </p>
        </div>
    </section>

    <section class="faq-section">
        <div class="container" style="text-align: center;">
            <span class="badge badge-green">FAQ</span>
            <h2 style="font-size: 22px; font-weight: 900; margin-top: 8px;">よくあるご質問</h2>
        </div>
        <div class="faq-grid">
            <div class="faq-item">
                <div class="faq-q" onclick="this.parentElement.classList.toggle('open')">導入にどのくらい時間がかかりますか？</div>
                <div class="faq-a">最短5分です。申込フォーム送信後、サイト画面でモニタリング対象の敷地境界を描画するだけで開始できます。</div>
            </div>
            <div class="faq-item">
                <div class="faq-q" onclick="this.parentElement.classList.toggle('open')">専門知識がなくても使えますか？</div>
                <div class="faq-a">はい。スマートフォンで写真を撮影するだけです。種同定はコミュニティの相互検証で行われるため、専門知識は不要です。</div>
            </div>
            <div class="faq-item">
                <div class="faq-q" onclick="this.parentElement.classList.toggle('open')">Community プランから Business にアップグレードできますか？</div>
                <div class="faq-a">はい。いつでもアップグレード可能です。既存データはそのまま引き継がれます。</div>
            </div>
            <div class="faq-item">
                <div class="faq-q" onclick="this.parentElement.classList.toggle('open')">レポートはカスタマイズできますか？</div>
                <div class="faq-a">テンプレートは6種類用意しており、それぞれサイトのデータを自動反映します。テンプレートのカスタム要望は別途ご相談ください。</div>
            </div>
            <div class="faq-item">
                <div class="faq-q" onclick="this.parentElement.classList.toggle('open')">契約期間と解約ルールを教えてください</div>
                <div class="faq-a">年間契約です。契約期間中の解約はできませんが、自動更新はされません。更新のご案内は期限の1ヶ月前にお送りします。</div>
            </div>
            <div class="faq-item">
                <div class="faq-q" onclick="this.parentElement.classList.toggle('open')">データの所有権はどうなりますか？</div>
                <div class="faq-a">観察データの所有権は投稿者に帰属します。企業ダッシュボードのデータはCSV/JSON形式でいつでもエクスポートでき、ロックインはありません。</div>
            </div>
        </div>
    </section>

    <footer class="lp-footer">
        <div class="container">
            <p style="margin-bottom: 8px;">
                <a href="../index.php">ikimon ホーム</a>
                <a href="index.php">ikimon for Business</a>
                <a href="demo.php">デモ</a>
                <a href="mailto:contact@ikimon.life">お問い合わせ</a>
            </p>
            <p>&copy; <?php echo date('Y'); ?> ikimon Project.</p>
        </div>
    </footer>
</body>

</html>
