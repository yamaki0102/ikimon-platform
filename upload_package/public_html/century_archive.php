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
            <p class="text-lg font-bold" style="color:#10b981;">2026年の観察は、<br>100年後の比較基準になる</p>
        </div>

        <!-- Philosophy -->
        <div class="bg-[var(--color-surface)] rounded-2xl p-6 mb-6 border border-[var(--color-border)]">
            <h2 class="text-base font-bold text-[var(--color-text)] mb-3">なぜ記録するのか</h2>
            <div class="text-sm text-[var(--color-text-muted)] leading-relaxed space-y-3">
                <p>生態系の変化は、あとから完全には復元できません。いつ、どこで、何を見たかという観察の積み重ねが、未来の比較基準になります。</p>
                <p>100年後の研究者や地域の担い手が2026年の自然を見返すとき、頼りになるのは<strong class="text-[var(--color-text)]">その時代に残された一次観察</strong>です。</p>
                <p>1枚の写真、1回の散歩、短いメモでも、長い時間軸では大きな意味を持ちます。</p>
            </div>
        </div>

        <!-- Evidence -->
        <div class="bg-[var(--color-surface)] rounded-2xl p-6 mb-6 border border-[var(--color-border)]">
            <h2 class="text-base font-bold text-[var(--color-text)] mb-3">ikimon.life が今、強く言えること</h2>
            <div class="space-y-4">
                <div class="flex items-start gap-3">
                    <span class="text-xl flex-shrink-0">📦</span>
                    <div>
                        <div class="text-sm font-bold text-[var(--color-text)]">観察を文脈ごと保持する</div>
                        <div class="text-xs text-[var(--color-text-muted)]">写真、日時、場所、同定、ライセンスなどを分けて持ち、あとから再利用しやすい形で整理します。</div>
                    </div>
                </div>
                <div class="flex items-start gap-3">
                    <span class="text-xl flex-shrink-0">🌐</span>
                    <div>
                        <div class="text-sm font-bold text-[var(--color-text)]">標準化された出力を持つ</div>
                        <div class="text-xs text-[var(--color-text-muted)]">Darwin Core / DwC-A 形式での出力機能を備え、GBIF 等との連携を見据えた相互運用性を確保します。</div>
                    </div>
                </div>
                <div class="flex items-start gap-3">
                    <span class="text-xl flex-shrink-0">🧭</span>
                    <div>
                        <div class="text-sm font-bold text-[var(--color-text)]">検証の履歴を残す</div>
                        <div class="text-xs text-[var(--color-text-muted)]">AI評価、コミュニティ同定、レビューや変更履歴を追えるようにし、監査可能な記録に近づけます。</div>
                    </div>
                </div>
                <div class="flex items-start gap-3">
                    <span class="text-xl flex-shrink-0">🔒</span>
                    <div>
                        <div class="text-sm font-bold text-[var(--color-text)]">単独依存を避ける方向で設計する</div>
                        <div class="text-xs text-[var(--color-text-muted)]">一つのアプリだけに閉じず、標準形式で持ち出せることを重視します。永続性は、複数の保存先と運用で支える前提です。</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- PNAS -->
        <div class="bg-[var(--color-surface)] rounded-2xl p-6 mb-6 border border-[var(--color-border)]">
            <h2 class="text-base font-bold text-[var(--color-text)] mb-3">2026年 PNAS 論文との対応</h2>
            <div class="text-sm text-[var(--color-text-muted)] leading-relaxed space-y-3">
                <p>Sutherland らが <strong class="text-[var(--color-text)]">2026年3月4日</strong> に PNAS で公開した提言では、生物多様性計測を変えるために「データ統合」「標準化」「較正」「trusted database」「resilience」など9つの変化が必要だと整理されています。</p>
                <p>ikimon.life は現時点で、<strong class="text-[var(--color-text)]">複数データの統合、Darwin Core を軸にした標準化、検証ログを伴う品質管理、プラットフォーム単独依存を避ける設計</strong>において、この提言と高い整合性があります。</p>
                <p>一方で、<strong class="text-[var(--color-text)]">地域知識のデータ主権、介入効果を比較できる設計、データ生成者への十分なクレジット</strong>は、今後さらに強化すべき領域です。</p>
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
            <h2 class="text-base font-bold text-[var(--color-text)] mb-3">記録者として残るもの</h2>
            <div class="text-sm text-[var(--color-text-muted)] leading-relaxed space-y-3">
                <p>観察には、記録者、日時、ライセンス、同定の履歴といった情報が結びつきます。誰が、どの条件で残した記録なのかが重要です。</p>
                <p>SNSの流れやすい投稿とは違い、<strong class="text-[var(--color-text)]">再利用できる形式で整理された観察記録</strong>は、研究、教育、地域アーカイブの土台になれます。</p>
            </div>
        </div>

        <!-- Caution -->
        <div class="bg-amber-50 rounded-2xl p-6 mb-6 border border-amber-200">
            <h2 class="text-base font-bold text-[var(--color-text)] mb-3">ここで言いすぎないために</h2>
            <div class="text-sm text-[var(--color-text-muted)] leading-relaxed space-y-3">
                <p>ikimon.life は、論文が求めるすべてをすでに完成させたとは言いません。特に、地域知識の扱い、介入効果の因果的評価、長期運用の体制は、実装と運用の両面で育て続ける必要があります。</p>
                <p>それでも、2026年の観察を標準化し、検証可能な形で残し、将来の外部連携に開くという方向性は、今ここで始める価値があります。</p>
            </div>
        </div>

        <!-- CTA -->
        <div class="text-center space-y-4">
            <a href="field_research.php" class="inline-block px-8 py-4 rounded-2xl font-bold text-white text-base" style="background:#10b981;">
                🔍 観察を記録する
            </a>
            <div class="text-xs text-[var(--color-text-muted)]">写真1枚、短いメモ1つからでも参加できます</div>

            <div class="mt-6 pt-6 border-t border-[var(--color-border)]">
                <a href="bioscan.php" class="inline-flex items-center gap-2 text-sm font-bold" style="color:#10b981;">
                    📱 BioScan（Android）で、より豊かな観察文脈を残す →
                </a>
            </div>
        </div>

    </main>

    <?php include __DIR__ . '/components/nav.php'; ?>
    <script src="https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.min.js"></script>
    <script>lucide.createIcons();</script>
</body>
</html>
