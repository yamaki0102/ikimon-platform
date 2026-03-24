<?php
/**
 * century_archive.php — 100年アーカイブ説明ページ
 *
 * ikimon.life の哲学と、データの永続性・社会的価値を伝えるページ。
 */
require_once __DIR__ . '/../config/config.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/DataStore.php';

Auth::init();
$currentUser = Auth::user();

$totalObs = 0;
$totalUsers = 0;
try {
    $allObs = DataStore::fetchAll('observations');
    $totalObs = is_array($allObs) ? count($allObs) : 0;
    $userIds = [];
    foreach ($allObs as $obs) {
        if (!empty($obs['user_id'])) $userIds[$obs['user_id']] = true;
    }
    $totalUsers = count($userIds);
} catch (Exception $e) {}

$meta_title = "100年アーカイブ | ikimon.life";
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026">
    <link rel="stylesheet" href="assets/css/input.css?v=2026">
</head>
<body class="bg-[var(--color-bg)]">
    <?php include __DIR__ . '/components/nav.php'; ?>

    <main class="max-w-2xl mx-auto px-4 py-8" style="padding-top:calc(var(--nav-height,56px) + 2rem);padding-bottom:calc(var(--bottom-nav-height,72px) + 4rem)">

        <!-- Hero -->
        <div class="text-center mb-12">
            <div class="text-6xl mb-4">🌍</div>
            <h1 class="text-2xl font-black text-[var(--color-text)] mb-3">100年生態系アーカイブ</h1>
            <p class="text-lg font-bold" style="color:#10b981;">2026年に記録しなかったデータは<br>二度と取り戻せない</p>
        </div>

        <!-- Philosophy -->
        <div class="bg-[var(--color-surface)] rounded-2xl p-6 mb-6 border border-[var(--color-border)]">
            <h2 class="text-base font-bold text-[var(--color-text)] mb-3">なぜ記録するのか</h2>
            <div class="text-sm text-[var(--color-text-muted)] leading-relaxed space-y-3">
                <p>今この瞬間の音、光、気温、開花、初鳴き、林床、池のほとり。それらは、今記録しなければ永遠に失われます。</p>
                <p>100年後の研究者が2026年の生態系を理解しようとしたとき、頼りになるのは<strong class="text-[var(--color-text)]">あなたが今日記録したデータ</strong>です。</p>
                <p>1枚の写真でも、1回の散歩でも、それは未来への贈り物になります。</p>
            </div>
        </div>

        <!-- How it works -->
        <div class="bg-[var(--color-surface)] rounded-2xl p-6 mb-6 border border-[var(--color-border)]">
            <h2 class="text-base font-bold text-[var(--color-text)] mb-3">データはこう残る</h2>
            <div class="space-y-4">
                <div class="flex items-start gap-3">
                    <span class="text-xl flex-shrink-0">📦</span>
                    <div>
                        <div class="text-sm font-bold text-[var(--color-text)]">タイムカプセルとして保存</div>
                        <div class="text-xs text-[var(--color-text-muted)]">種の記録・環境データ・GPS軌跡・音風景をセットで不変保存。更新ではなく追記のみ。</div>
                    </div>
                </div>
                <div class="flex items-start gap-3">
                    <span class="text-xl flex-shrink-0">🌐</span>
                    <div>
                        <div class="text-sm font-bold text-[var(--color-text)]">GBIFに世界公開</div>
                        <div class="text-xs text-[var(--color-text-muted)]">DarwinCore準拠データとしてGBIF（地球規模生物多様性情報機構）に提供。世界中の研究者が利用可能に。</div>
                    </div>
                </div>
                <div class="flex items-start gap-3">
                    <span class="text-xl flex-shrink-0">🏢</span>
                    <div>
                        <div class="text-sm font-bold text-[var(--color-text)]">企業のTNFDレポートに活用</div>
                        <div class="text-xs text-[var(--color-text-muted)]">あなたの記録が、企業の生物多様性開示（TNFD LEAP）の根拠データとして使われます。</div>
                    </div>
                </div>
                <div class="flex items-start gap-3">
                    <span class="text-xl flex-shrink-0">🔒</span>
                    <div>
                        <div class="text-sm font-bold text-[var(--color-text)]">プラットフォーム非依存</div>
                        <div class="text-xs text-[var(--color-text-muted)]">ikimon.lifeが将来停止しても、GBIF経由でデータは生き続けます。データの生存がゴールです。</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Stats -->
        <div class="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-2xl p-6 mb-6 border border-emerald-200 dark:border-emerald-800">
            <h2 class="text-base font-bold text-[var(--color-text)] mb-4 text-center">アーカイブの現在</h2>
            <div class="flex justify-around text-center">
                <div>
                    <div class="text-2xl font-black" style="color:#10b981;"><?= number_format($totalObs) ?></div>
                    <div class="text-xs text-[var(--color-text-muted)]">記録</div>
                </div>
                <div>
                    <div class="text-2xl font-black" style="color:#10b981;"><?= number_format($totalUsers) ?></div>
                    <div class="text-xs text-[var(--color-text-muted)]">参加者</div>
                </div>
                <div>
                    <div class="text-2xl font-black" style="color:#10b981;">2026</div>
                    <div class="text-xs text-[var(--color-text-muted)]">開始年</div>
                </div>
            </div>
        </div>

        <!-- Your legacy -->
        <div class="bg-[var(--color-surface)] rounded-2xl p-6 mb-6 border border-[var(--color-border)]">
            <h2 class="text-base font-bold text-[var(--color-text)] mb-3">あなたの名前が残る</h2>
            <div class="text-sm text-[var(--color-text-muted)] leading-relaxed space-y-3">
                <p>100年アーカイブに参加すると、あなたの名前は2026年の地球生態系記録の一部として永久に残ります。</p>
                <p>いいねは消えます。SNSの投稿は流れます。でも、<strong class="text-[var(--color-text)]">科学データベースに記録された観察は消えません。</strong></p>
            </div>
        </div>

        <!-- CTA -->
        <div class="text-center space-y-4">
            <a href="field_research.php" class="inline-block px-8 py-4 rounded-2xl font-bold text-white text-base" style="background:#10b981;">
                🌿 さんぽを始める
            </a>
            <div class="text-xs text-[var(--color-text-muted)]">写真1枚からでも参加できます</div>

            <div class="mt-6 pt-6 border-t border-[var(--color-border)]">
                <a href="bioscan.php" class="inline-flex items-center gap-2 text-sm font-bold" style="color:#10b981;">
                    📱 BioScan（Android）でもっと豊かなデータを記録する →
                </a>
            </div>
        </div>

    </main>

    <?php include __DIR__ . '/components/bottom_nav.php'; ?>
    <script src="https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js"></script>
    <script>lucide.createIcons();</script>
</body>
</html>
