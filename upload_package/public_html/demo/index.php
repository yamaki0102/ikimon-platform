<?php

/**
 * B2B Demo Landing Page
 * 
 * Showcases ikimon's biodiversity monitoring capabilities
 * using real data from I-KAN Co., Ltd. (愛管株式会社).
 * 
 * This page serves as the entry point for the interactive demo,
 * leading visitors to the anonymized report view.
 */
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/SiteManager.php';
require_once __DIR__ . '/../../libs/DataStore.php';

Auth::init();

// Load demo site data
$demoSiteId = 'ikan_hq';
$site = SiteManager::load($demoSiteId);
$siteName = $site ? ($site['name'] ?? '愛管株式会社 本社') : '愛管株式会社 本社';

// Count real observations for this site
$allObs = DataStore::fetchAll('observations');
$obsCount = 0;
$speciesSet = [];
foreach ($allObs as $obs) {
    if (($obs['site_id'] ?? null) === $demoSiteId) {
        $obsCount++;
        $name = $obs['taxon']['name'] ?? ($obs['species_name'] ?? null);
        if ($name) $speciesSet[$name] = true;
    }
}
$speciesCount = count($speciesSet);

$pageTitle = 'デモ体験 — ikimon for Business';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($pageTitle); ?></title>
    <meta name="description" content="愛管株式会社の実データを使ったikimonデモ。生物多様性スコア、TNFD LEAP対応レポートを体験してください。">
    <meta name="robots" content="noindex, nofollow">
    <?php include __DIR__ . '/../components/meta.php'; ?>
    <style>
        /* Demo page inherits site tokens from meta.php/tokens.css */
        .demo-hero {
            min-height: 80vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 120px 24px 60px;
            position: relative;
            overflow: hidden;
        }

        .demo-hero::before {
            content: '';
            position: absolute;
            top: -200px;
            right: -200px;
            width: 600px;
            height: 600px;
            background: radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%);
            border-radius: 50%;
            pointer-events: none;
        }

        .demo-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 20px;
            border-radius: 100px;
            background: rgba(16, 185, 129, 0.08);
            border: 1px solid rgba(16, 185, 129, 0.2);
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: #059669;
            margin-bottom: 32px;
        }

        .demo-badge .pulse {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #10b981;
            animation: pulse-ring 2s ease infinite;
        }

        @keyframes pulse-ring {
            0% {
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
            }

            70% {
                box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
            }

            100% {
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
            }
        }

        .demo-title {
            font-size: clamp(32px, 6vw, 56px);
            font-weight: 900;
            line-height: 1.15;
            letter-spacing: -1px;
            margin-bottom: 24px;
        }

        .demo-title .accent {
            color: #10b981;
        }

        .demo-subtitle {
            font-size: clamp(15px, 2vw, 18px);
            line-height: 1.8;
            max-width: 640px;
            margin: 0 auto 48px;
            opacity: 0.7;
        }

        .demo-subtitle strong {
            opacity: 1;
            color: var(--color-text, #111);
        }

        /* Stats row */
        .demo-stats {
            display: flex;
            gap: 24px;
            justify-content: center;
            flex-wrap: wrap;
            margin-bottom: 48px;
        }

        .demo-stat {
            padding: 20px 28px;
            border-radius: 16px;
            background: var(--color-bg-elevated, #fff);
            border: 1px solid var(--color-border, #e5e7eb);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
            text-align: center;
            min-width: 140px;
        }

        .demo-stat .num {
            font-size: 36px;
            font-weight: 900;
            display: block;
            line-height: 1.1;
            color: var(--color-text, #111);
        }

        .demo-stat .num.green {
            color: #10b981;
        }

        .demo-stat .label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            opacity: 0.5;
            margin-top: 6px;
        }

        /* CTA */
        .demo-cta {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            padding: 18px 40px;
            border-radius: 100px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: #fff;
            font-size: 18px;
            font-weight: 800;
            text-decoration: none;
            transition: all 0.3s ease;
            box-shadow: 0 8px 32px rgba(16, 185, 129, 0.25);
        }

        .demo-cta:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 40px rgba(16, 185, 129, 0.35);
        }

        .demo-cta .arrow {
            font-size: 22px;
            transition: transform 0.3s;
        }

        .demo-cta:hover .arrow {
            transform: translateX(4px);
        }

        /* Info section */
        .demo-info {
            max-width: 800px;
            margin: 0 auto;
            padding: 60px 24px 80px;
        }

        .demo-info h2 {
            font-size: 24px;
            font-weight: 900;
            margin-bottom: 32px;
            text-align: center;
        }

        .demo-features {
            display: grid;
            gap: 20px;
        }

        @media (min-width: 640px) {
            .demo-features {
                grid-template-columns: repeat(2, 1fr);
            }
        }

        .demo-feature {
            padding: 24px;
            border-radius: 16px;
            background: var(--color-bg-elevated, #fff);
            border: 1px solid var(--color-border, #e5e7eb);
        }

        .demo-feature .icon {
            font-size: 28px;
            margin-bottom: 12px;
        }

        .demo-feature h3 {
            font-size: 16px;
            font-weight: 800;
            margin-bottom: 8px;
        }

        .demo-feature p {
            font-size: 13px;
            line-height: 1.7;
            opacity: 0.65;
        }

        .demo-notice {
            margin-top: 40px;
            padding: 16px 24px;
            border-radius: 12px;
            background: #fffbeb;
            border: 1px solid #fde68a;
            font-size: 12px;
            color: #92400e;
            line-height: 1.7;
        }

        .demo-notice strong {
            color: #78350f;
        }

        .demo-back {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-top: 40px;
            font-size: 14px;
            font-weight: 700;
            color: #10b981;
            text-decoration: none;
            transition: opacity 0.2s;
        }

        .demo-back:hover {
            opacity: 0.7;
        }
    </style>
</head>

<body>
    <?php include __DIR__ . '/../components/nav.php'; ?>

    <main class="demo-hero">
        <div class="demo-badge">
            <span class="pulse"></span>
            Interactive Demo — Real Data
        </div>

        <h1 class="demo-title">
            「<span class="accent">観察</span>すれば、<br>
            TNFDレポートが完成する」<br>
            を体験してください。
        </h1>

        <p class="demo-subtitle">
            <strong>愛管株式会社</strong>の実際のフィールドデータを使用した<br>
            ikimon 生物多様性モニタリングのデモンストレーションです。
        </p>

        <div class="demo-stats">
            <div class="demo-stat">
                <span class="num"><?php echo $obsCount; ?></span>
                <span class="label">観察記録</span>
            </div>
            <div class="demo-stat">
                <span class="num"><?php echo $speciesCount; ?></span>
                <span class="label">確認種数</span>
            </div>
            <div class="demo-stat">
                <span class="num green">TNFD</span>
                <span class="label">LEAP 準拠</span>
            </div>
        </div>

        <a href="report.php" class="demo-cta">
            レポートを見る <span class="arrow">→</span>
        </a>
    </main>

    <section class="demo-info">
        <h2>このデモでわかること</h2>

        <div class="demo-features">
            <div class="demo-feature">
                <div class="icon">📊</div>
                <h3>参考インデックス</h3>
                <p>観測データの厚みや保全シグナルを0〜100で俯瞰する参考値です。絶対評価や認証判定ではありません。</p>
            </div>
            <div class="demo-feature">
                <div class="icon">🔴</div>
                <h3>レッドリスト照合</h3>
                <p>環境省・都道府県レッドリストと自動照合。該当種がいれば自動的にアラート表示されます。</p>
            </div>
            <div class="demo-feature">
                <div class="icon">📋</div>
                <h3>TNFD LEAP 対応表</h3>
                <p>TNFD（自然関連財務情報開示タスクフォース）のLEAPフレームワークへの対応状況を一目で確認。</p>
            </div>
            <div class="demo-feature">
                <div class="icon">🦋</div>
                <h3>確認種リスト</h3>
                <p>GBIF Backbone Taxonomy準拠の学名と和名。PDFとしてそのまま稟議書に添付できます。</p>
            </div>
        </div>

        <div class="demo-notice">
            <strong>⚠️ プライバシー保護について:</strong>
            このデモでは、個人を特定できる情報（投稿者名・個別GPS座標）は表示されません。
            観察データの統計情報とサイト全体の集計結果のみを公開しています。
        </div>

        <div style="text-align: center;">
            <a href="/for-business.php" class="demo-back">
                ← 企業・自治体の方へ に戻る
            </a>
        </div>
    </section>

    <?php include __DIR__ . '/../components/footer.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>

</html>
