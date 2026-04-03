<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/RedList.php';
require_once __DIR__ . '/../libs/BioUtils.php';
Auth::init();

// Dynamic stats for researcher page
$allObs = DataStore::fetchAll('observations');
$researcherTotalObs = count($allObs);
$researcherSpecies = [];
$researcherRgCount = 0;
$researcherRedlistCount = 0;
foreach ($allObs as $o) {
    $name = $o['taxon']['name'] ?? '';
    if (!empty($name)) {
        $researcherSpecies[$name] = true;
        if (RedList::check($name)) $researcherRedlistCount++;
    }
    if (BioUtils::isResearchGradeLike($o['status'] ?? ($o['quality_grade'] ?? ''))) $researcherRgCount++;
}
$researcherSpeciesCount = count($researcherSpecies);
$researcherRgRate = $researcherTotalObs > 0 ? round($researcherRgCount / $researcherTotalObs * 100) : 0;
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>データを持ち帰りたい方へ | ikimon</title>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>
<body class="js-loading pt-14 font-body" style="background:var(--md-surface);color:var(--md-on-surface);">

    <?php include __DIR__ . '/components/nav.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">document.body.classList.remove('js-loading');</script>

    <main>
    <!-- Hero Section -->
    <section class="pt-28 pb-14 px-4">
        <div class="max-w-3xl mx-auto text-center">
            <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-50 border border-violet-200 mb-5">
                <i data-lucide="microscope" class="w-3.5 h-3.5 text-violet-600"></i>
                <span class="text-xs font-bold tracking-wider uppercase text-violet-600">For Researchers</span>
            </div>
            <h1 class="text-4xl md:text-5xl font-black mb-5 tracking-tight leading-tight">
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-500">市民の記録</span>を<br>
                ていねいに持ち帰る
            </h1>
            <p class="text-base md:text-lg text-muted max-w-xl mx-auto mb-8 leading-relaxed">
                研究・教育・地域アーカイブで再利用しやすい形で、観察データを持ち帰れます。Darwin Core 形式でのエクスポートに対応し、GBIF などとの連携を見据えた構成にしています。現場に合わせた改善や共同実証のご相談も歓迎しています。
            </p>
            <div class="flex flex-col sm:flex-row gap-3 justify-center">
                <a href="explore.php" class="btn-primary inline-flex items-center gap-2 px-7 py-3">
                    <i data-lucide="database" class="w-4 h-4"></i>
                    データを閲覧
                </a>
                <a href="#data-access" class="btn-secondary inline-flex items-center gap-2 px-7 py-3">
                    <i data-lucide="download" class="w-4 h-4"></i>
                    データ申請について
                </a>
            </div>
        </div>
    </section>

    <!-- Data Quality + Stats Section -->
    <section class="py-16 px-4 bg-surface">
        <div class="max-w-5xl mx-auto">
            <div class="text-center mb-10">
                <h2 class="text-2xl font-bold mb-1.5">データ品質と標準</h2>
                <p class="text-sm text-muted">国際標準に準拠した、研究利用可能なデータ</p>
            </div>

            <div class="grid md:grid-cols-2 gap-8 items-start">
                <div class="space-y-4">
                    <div class="glass-card p-5 rounded-xl">
                        <h3 class="font-bold mb-2 flex items-center gap-2 text-base">
                            <i data-lucide="check-circle" class="w-5 h-5 text-emerald-500 flex-shrink-0"></i>
                            Darwin Core 準拠
                        </h3>
                        <p class="text-sm text-muted leading-relaxed pl-7">
                            国際標準の DwC 形式で出力できます。GBIF などとの相互運用を見据えたデータ整形に対応しています。
                        </p>
                    </div>
                    <div class="glass-card p-5 rounded-xl">
                        <h3 class="font-bold mb-2 flex items-center gap-2 text-base">
                            <i data-lucide="check-circle" class="w-5 h-5 text-emerald-500 flex-shrink-0"></i>
                            研究利用ステータス
                        </h3>
                        <p class="text-sm text-muted leading-relaxed pl-7">
                            科・属で安定した記録は「研究利用可」、種以下まで安定した記録は「種レベル研究用」として扱います。
                        </p>
                    </div>
                    <div class="glass-card p-5 rounded-xl">
                        <h3 class="font-bold mb-2 flex items-center gap-2 text-base">
                            <i data-lucide="check-circle" class="w-5 h-5 text-emerald-500 flex-shrink-0"></i>
                            位置精度の明示
                        </h3>
                        <p class="text-sm text-muted leading-relaxed pl-7">
                            GPS の精度情報を保持。絶滅危惧種は自動的に位置を秘匿（0.01°単位に丸め）します。
                        </p>
                    </div>
                </div>

                <div class="glass-card rounded-2xl p-7" style="border-left: 4px solid #7c3aed;">
                    <h3 class="text-lg font-bold mb-5">データ統計</h3>
                    <div class="divide-y divide-border">
                        <div class="flex justify-between items-center py-3.5">
                            <span class="text-sm text-muted">総観察数</span>
                            <span class="text-2xl font-black text-violet-600"><?= number_format($researcherTotalObs) ?></span>
                        </div>
                        <div class="flex justify-between items-center py-3.5">
                            <span class="text-sm text-muted">研究利用可以上</span>
                            <span class="text-2xl font-black text-emerald-600"><?= $researcherRgRate ?>%</span>
                        </div>
                        <div class="flex justify-between items-center py-3.5">
                            <span class="text-sm text-muted">確認種数</span>
                            <span class="text-2xl font-black text-sky-600"><?= number_format($researcherSpeciesCount) ?></span>
                        </div>
                        <div class="flex justify-between items-center py-3.5">
                            <span class="text-sm text-muted">レッドリスト種</span>
                            <span class="text-2xl font-black text-rose-500"><?= $researcherRedlistCount ?></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Data Access Section -->
    <section id="data-access" class="py-16 px-4">
        <div class="max-w-4xl mx-auto">
            <div class="text-center mb-10">
                <h2 class="text-2xl font-bold mb-1.5">データアクセスポリシー</h2>
                <p class="text-sm text-muted">研究・教育・地域アーカイブ用途でのデータ利用を支援します</p>
            </div>

            <div class="grid md:grid-cols-3 gap-6">
                <!-- Public -->
                <div class="glass-card p-6 rounded-2xl text-center">
                    <div class="w-11 h-11 mx-auto mb-4 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                        <i data-lucide="globe" class="w-5 h-5 text-emerald-600"></i>
                    </div>
                    <h3 class="font-bold mb-2">公開データ</h3>
                    <p class="text-sm text-muted mb-4 leading-relaxed">
                        研究利用可以上の観察データは API で自由に持ち帰り可能
                    </p>
                    <span class="text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                        CC BY-NC
                    </span>
                </div>

                <!-- Request -->
                <div class="glass-card p-6 rounded-2xl text-center">
                    <div class="w-11 h-11 mx-auto mb-4 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                        <i data-lucide="file-text" class="w-5 h-5 text-amber-600"></i>
                    </div>
                    <h3 class="font-bold mb-2">申請制データ</h3>
                    <p class="text-sm text-muted mb-4 leading-relaxed">
                        レッドリスト種の詳細位置は研究目的で申請可能
                    </p>
                    <span class="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200">
                        要申請
                    </span>
                </div>

                <!-- Collaboration -->
                <div class="glass-card p-6 rounded-2xl text-center">
                    <div class="w-11 h-11 mx-auto mb-4 rounded-full bg-violet-50 border border-violet-200 flex items-center justify-center">
                        <i data-lucide="handshake" class="w-5 h-5 text-violet-600"></i>
                    </div>
                    <h3 class="font-bold mb-2">共同研究・共同実証</h3>
                    <p class="text-sm text-muted mb-4 leading-relaxed">
                        データ品質検証や活用設計、機能改善を伴う連携相談も歓迎
                    </p>
                    <span class="text-xs px-3 py-1 rounded-full bg-violet-50 text-violet-700 font-bold border border-violet-200">
                        連携募集
                    </span>
                </div>
            </div>
        </div>
    </section>

    <!-- CTA Section -->
    <section class="py-16 px-4 bg-surface">
        <div class="max-w-lg mx-auto">
            <div class="glass-card p-10 rounded-3xl text-center">
                <div class="w-12 h-12 mx-auto mb-5 rounded-full bg-violet-50 border border-violet-200 flex items-center justify-center">
                    <i data-lucide="mail" class="w-5 h-5 text-violet-600"></i>
                </div>
                <h2 class="text-2xl font-black mb-3">データ活用・共同実証のご相談</h2>
                <p class="text-sm text-muted mb-7 leading-relaxed">
                    研究、教育、地域アーカイブづくりなど、市民の記録をどう活かすかの相談に加え、改善や共同実証のご相談も受け付けています。
                </p>
                <div class="flex flex-col gap-3">
                    <a href="contact.php" class="btn-primary flex items-center justify-center gap-2">
                        <i data-lucide="mail" class="w-4 h-4"></i>
                        データ活用を相談する
                    </a>
                    <a href="id_center.php" class="btn-secondary flex items-center justify-center gap-2">
                        <i data-lucide="microscope" class="w-4 h-4"></i>
                        同定センターで貢献する
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <?php include __DIR__ . '/components/footer.php'; ?>

    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>
</html>
