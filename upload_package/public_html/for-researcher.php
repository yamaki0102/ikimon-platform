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
<body class="js-loading pt-14 bg-base text-text font-body">

    <?php include __DIR__ . '/components/nav.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">document.body.classList.remove('js-loading');</script>

    <main>
    <!-- Hero Section -->
    <section class="pt-32 pb-16 px-6">
        <div class="max-w-4xl mx-auto text-center">
            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/30 backdrop-blur-md mb-6">
                <i data-lucide="microscope" class="w-4 h-4 text-purple-400"></i>
                <span class="text-xs font-bold tracking-wider uppercase text-purple-400">For Data Use</span>
            </div>
            <h1 class="text-4xl md:text-6xl font-black mb-6 tracking-tight">
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">市民の記録</span>を<br>
                ていねいに持ち帰る
            </h1>
            <p class="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
                研究・教育・地域アーカイブで再利用しやすい形で、観察データを持ち帰れます。<br>
                Darwin Core 形式でのエクスポートに対応し、GBIF などとの連携を見据えた構成にしています。<br>
                そのままのデータ活用相談に加え、現場に合わせた改善や共同実証のご相談も歓迎しています。
            </p>
            <div class="flex flex-col md:flex-row gap-4 justify-center">
                <a href="explore.php" class="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4">
                    <i data-lucide="database"></i>
                    データを閲覧
                </a>
                <a href="#data-access" class="btn-secondary inline-flex items-center gap-2 text-lg px-8 py-4">
                    <i data-lucide="download"></i>
                    データ申請
                </a>
            </div>
        </div>
    </section>

    <!-- Data Quality Section -->
    <section class="py-16 px-6 bg-gradient-to-b from-transparent to-purple-500/5">
        <div class="max-w-5xl mx-auto">
            <h2 class="text-2xl font-bold text-center mb-12">データ品質と標準</h2>
            
            <div class="grid md:grid-cols-2 gap-12">
                <div class="space-y-6">
                    <div class="glass-card p-6 rounded-2xl border border-white/10">
                        <h3 class="font-bold mb-2 flex items-center gap-2">
                            <i data-lucide="check-circle" class="w-5 h-5 text-green-400"></i>
                            Darwin Core 準拠
                        </h3>
                        <p class="text-sm text-gray-400">
                            国際標準の DwC 形式で出力できます。GBIF などとの相互運用を見据えたデータ整形に対応しています。
                        </p>
                    </div>
                    <div class="glass-card p-6 rounded-2xl border border-white/10">
                        <h3 class="font-bold mb-2 flex items-center gap-2">
                            <i data-lucide="check-circle" class="w-5 h-5 text-green-400"></i>
                            研究利用ステータス
                        </h3>
                        <p class="text-sm text-gray-400">
                            科・属で安定した記録は「研究利用可」、種以下まで安定した記録は「種レベル研究用」として扱います。
                        </p>
                    </div>
                    <div class="glass-card p-6 rounded-2xl border border-white/10">
                        <h3 class="font-bold mb-2 flex items-center gap-2">
                            <i data-lucide="check-circle" class="w-5 h-5 text-green-400"></i>
                            位置精度の明示
                        </h3>
                        <p class="text-sm text-gray-400">
                            GPSの精度情報を保持。絶滅危惧種は自動的に位置を秘匿（0.01°単位に丸め）します。
                        </p>
                    </div>
                </div>

                <div class="glass-card rounded-2xl border border-purple-500/30 p-8">
                    <h3 class="text-xl font-bold mb-6">データ統計</h3>
                    <div class="space-y-4">
                        <div class="flex justify-between items-center py-3 border-b border-white/10">
                            <span class="text-gray-400">総観察数</span>
                            <span class="text-2xl font-black text-purple-400"><?= number_format($researcherTotalObs) ?></span>
                        </div>
                        <div class="flex justify-between items-center py-3 border-b border-white/10">
                            <span class="text-gray-400">研究利用可以上</span>
                            <span class="text-2xl font-black text-green-400"><?= $researcherRgRate ?>%</span>
                        </div>
                        <div class="flex justify-between items-center py-3 border-b border-white/10">
                            <span class="text-gray-400">確認種数</span>
                            <span class="text-2xl font-black text-blue-400"><?= number_format($researcherSpeciesCount) ?></span>
                        </div>
                        <div class="flex justify-between items-center py-3">
                            <span class="text-gray-400">レッドリスト種</span>
                            <span class="text-2xl font-black text-red-400"><?= $researcherRedlistCount ?></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Data Access Section -->
    <section id="data-access" class="py-16 px-6">
        <div class="max-w-4xl mx-auto">
            <h2 class="text-2xl font-bold text-center mb-4">データアクセスポリシー</h2>
            <p class="text-gray-400 text-center mb-12">研究・教育・地域アーカイブ用途でのデータ利用を支援します</p>
            
            <div class="grid md:grid-cols-3 gap-8">
                <!-- Public -->
                <div class="glass-card p-8 rounded-2xl border border-green-500/30 text-center">
                    <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                        <i data-lucide="globe" class="w-6 h-6 text-green-400"></i>
                    </div>
                    <h3 class="font-bold mb-2">公開データ</h3>
                    <p class="text-sm text-gray-400 mb-4">
                        研究利用可以上の観察データは<br>
                        APIで自由に持ち帰り可能
                    </p>
                    <span class="text-xs px-3 py-1 rounded-full bg-green-500/20 text-green-400 font-bold">
                        CC BY-NC
                    </span>
                </div>

                <!-- Request -->
                <div class="glass-card p-8 rounded-2xl border border-yellow-500/30 text-center">
                    <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <i data-lucide="file-text" class="w-6 h-6 text-yellow-400"></i>
                    </div>
                    <h3 class="font-bold mb-2">申請制データ</h3>
                    <p class="text-sm text-gray-400 mb-4">
                        レッドリスト種の詳細位置は<br>
                        研究目的で申請可能
                    </p>
                    <span class="text-xs px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 font-bold">
                        要申請
                    </span>
                </div>

                <!-- Collaboration -->
                <div class="glass-card p-8 rounded-2xl border border-purple-500/30 text-center">
                    <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <i data-lucide="handshake" class="w-6 h-6 text-purple-400"></i>
                    </div>
                    <h3 class="font-bold mb-2">共同研究・共同実証</h3>
                    <p class="text-sm text-gray-400 mb-4">
                        データ品質検証や活用設計、<br>
                        機能改善を伴う連携相談も歓迎
                    </p>
                    <span class="text-xs px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 font-bold">
                        連携募集
                    </span>
                </div>
            </div>
        </div>
    </section>

    <!-- CTA Section -->
    <section class="py-16 px-6">
        <div class="max-w-2xl mx-auto text-center glass-card p-12 rounded-[2rem] border border-purple-500/30">
            <h2 class="text-3xl font-black mb-4">データ活用・共同実証のご相談</h2>
            <p class="text-gray-400 mb-8">
                研究、教育、地域アーカイブづくりなど、<br>
                市民の記録をどう活かすかの相談に加え、改善や共同実証のご相談も受け付けています。
            </p>
            <div class="flex flex-col gap-4">
                <a href="contact.php" class="btn-primary flex items-center justify-center gap-2">
                    <i data-lucide="mail"></i>
                    データ活用を相談する
                </a>
                <a href="id_center.php" class="btn-secondary flex items-center justify-center gap-2">
                    <i data-lucide="microscope"></i>
                        回答センターで貢献する
                </a>
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
