<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/RedList.php';
Auth::init();

// Dynamic stats
$allObs = DataStore::fetchAll('observations');
$totalObs = count($allObs);
$species = [];
$rgCount = 0;
$redlistCount = 0;
foreach ($allObs as $o) {
    $name = $o['taxon']['name'] ?? '';
    if (!empty($name)) {
        $species[$name] = true;
        if (RedList::check($name)) $redlistCount++;
    }
    if (($o['status'] ?? '') === 'Research Grade') $rgCount++;
}
$speciesCount = count($species);
$rgRate = $totalObs > 0 ? round($rgCount / $totalObs * 100) : 0;
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php
    $meta_title = "研究者・専門家・調査員の方へ | ikimon";
    $meta_description = "ikimonの市民科学データを研究に活用。調査プロジェクトへの参加や専門家としての同定協力も歓迎しています。";
    ?>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
</head>
<body class="js-loading pt-14 bg-base text-text font-body">
    <?php include __DIR__ . '/components/nav.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">document.body.classList.remove('js-loading');</script>

    <main>

    <!-- Hero -->
    <section class="pt-24 md:pt-32 pb-16 px-6 bg-gradient-to-b from-primary-surface/50 to-transparent">
        <div class="max-w-4xl mx-auto text-center">
            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-border mb-6">
                <i data-lucide="microscope" class="w-4 h-4 text-primary"></i>
                <span class="text-xs font-bold tracking-wider uppercase text-primary">For Professionals</span>
            </div>
            <h1 class="text-3xl md:text-5xl font-black mb-6 tracking-tight text-text">
                専門知識を<br class="md:hidden">フィールドに活かす
            </h1>
            <p class="text-base md:text-lg text-muted max-w-2xl mx-auto mb-10">
                研究データの活用から、調査プロジェクトの設計・実施、<br class="hidden md:block">
                種同定の専門家協力まで。あなたの専門性が生態系理解を深めます。
            </p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="#survey" class="btn-primary inline-flex items-center justify-center gap-2 px-8 py-3">
                    <i data-lucide="clipboard-list" class="w-5 h-5"></i>
                    調査に参加する
                </a>
                <a href="#data" class="btn-secondary inline-flex items-center justify-center gap-2 px-8 py-3">
                    <i data-lucide="database" class="w-5 h-5"></i>
                    データにアクセス
                </a>
            </div>
        </div>
    </section>

    <!-- Role Cards -->
    <section class="py-16 px-6">
        <div class="max-w-5xl mx-auto">
            <h2 class="text-2xl font-black text-center mb-4 text-text">あなたの専門性を活かす3つの方法</h2>
            <p class="text-center text-muted mb-12">どの役割も、生物多様性の理解と保全に直結します</p>

            <div class="grid md:grid-cols-3 gap-6">
                <!-- Surveyor -->
                <div class="glass-card p-8 rounded-2xl border-border text-center hover:-translate-y-1 transition">
                    <div class="w-16 h-16 mx-auto mb-5 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <i data-lucide="map-pin" class="w-8 h-8 text-primary"></i>
                    </div>
                    <h3 class="font-black text-lg mb-3 text-text">調査員として参加</h3>
                    <p class="text-sm text-muted mb-6">
                        プロトコルに沿ったフィールド調査を実施。トランセクト調査やポイントカウント法で、科学的に信頼できるデータを収集します。
                    </p>
                    <a href="survey.php" class="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                        調査を始める <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </a>
                </div>

                <!-- Identifier -->
                <div class="glass-card p-8 rounded-2xl border-border text-center hover:-translate-y-1 transition">
                    <div class="w-16 h-16 mx-auto mb-5 rounded-2xl bg-secondary/10 flex items-center justify-center">
                        <i data-lucide="microscope" class="w-8 h-8 text-secondary"></i>
                    </div>
                    <h3 class="font-black text-lg mb-3 text-text">同定で貢献</h3>
                    <p class="text-sm text-muted mb-6">
                        市民が投稿した観察記録の種同定を支援。あなたの専門知識で「名前のない発見」を「科学的記録」に変えます。
                    </p>
                    <a href="id_workbench.php" class="inline-flex items-center gap-2 text-sm font-bold text-secondary hover:underline">
                        同定センターへ <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </a>
                </div>

                <!-- Researcher -->
                <div class="glass-card p-8 rounded-2xl border-border text-center hover:-translate-y-1 transition">
                    <div class="w-16 h-16 mx-auto mb-5 rounded-2xl bg-accent/10 flex items-center justify-center">
                        <i data-lucide="flask-conical" class="w-8 h-8 text-accent"></i>
                    </div>
                    <h3 class="font-black text-lg mb-3 text-text">データを研究に活用</h3>
                    <p class="text-sm text-muted mb-6">
                        Darwin Core準拠のオープンデータにアクセス。地域生態系モニタリングや共同研究も歓迎しています。
                    </p>
                    <a href="#data" class="inline-flex items-center gap-2 text-sm font-bold text-accent hover:underline">
                        データ詳細へ <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- Survey Section -->
    <section id="survey" class="py-16 px-6 bg-surface">
        <div class="max-w-5xl mx-auto">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <i data-lucide="clipboard-list" class="w-5 h-5 text-primary"></i>
                </div>
                <h2 class="text-2xl font-black text-text">フィールド調査</h2>
            </div>
            <p class="text-muted mb-10 max-w-2xl">構造化された調査プロトコルで、継続的な生態系モニタリングを実施しています。</p>

            <div class="grid md:grid-cols-2 gap-8">
                <div class="space-y-4">
                    <div class="bg-base border border-border rounded-2xl p-6">
                        <h3 class="font-bold text-text mb-2 flex items-center gap-2">
                            <span class="text-lg">🚶</span> トランセクト調査
                        </h3>
                        <p class="text-sm text-muted">
                            決められたルートを歩きながら、出現する全ての種を記録。ルート沿いの生物多様性を定量的に評価します。
                        </p>
                    </div>
                    <div class="bg-base border border-border rounded-2xl p-6">
                        <h3 class="font-bold text-text mb-2 flex items-center gap-2">
                            <span class="text-lg">📍</span> ポイントカウント
                        </h3>
                        <p class="text-sm text-muted">
                            定点で一定時間観察し、確認した個体数と種数を記録。季節変動や経年変化の追跡に最適です。
                        </p>
                    </div>
                    <div class="bg-base border border-border rounded-2xl p-6">
                        <h3 class="font-bold text-text mb-2 flex items-center gap-2">
                            <span class="text-lg">📊</span> 品質スコアリング
                        </h3>
                        <p class="text-sm text-muted">
                            調査データには自動で品質スコアが付与。観察時間、種数、天候記録などの充実度を100点満点で評価します。
                        </p>
                    </div>
                </div>

                <div class="bg-base border border-border rounded-2xl p-8 flex flex-col justify-between">
                    <div>
                        <h3 class="font-black text-lg text-text mb-4">調査員になるには</h3>
                        <div class="space-y-4 mb-8">
                            <div class="flex items-start gap-3">
                                <span class="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-black shrink-0">1</span>
                                <p class="text-sm text-muted"><strong class="text-text">アカウント作成</strong> — 無料で始められます</p>
                            </div>
                            <div class="flex items-start gap-3">
                                <span class="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-black shrink-0">2</span>
                                <p class="text-sm text-muted"><strong class="text-text">調査に参加</strong> — 既存の調査プロジェクトに参加、または自分で開始</p>
                            </div>
                            <div class="flex items-start gap-3">
                                <span class="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-black shrink-0">3</span>
                                <p class="text-sm text-muted"><strong class="text-text">データを記録</strong> — アプリで写真・GPS・天候を自動記録</p>
                            </div>
                        </div>
                    </div>
                    <a href="survey.php" class="btn-primary flex items-center justify-center gap-2 w-full py-3">
                        <i data-lucide="clipboard-list" class="w-5 h-5"></i>
                        調査プロジェクトを見る
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- Data Section -->
    <section id="data" class="py-16 px-6">
        <div class="max-w-5xl mx-auto">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <i data-lucide="database" class="w-5 h-5 text-accent"></i>
                </div>
                <h2 class="text-2xl font-black text-text">データ品質と標準</h2>
            </div>
            <p class="text-muted mb-10 max-w-2xl">GBIF準拠のオープンデータ。Darwin Core形式でエクスポート可能です。</p>

            <div class="grid md:grid-cols-2 gap-8">
                <div class="space-y-4">
                    <div class="glass-card p-6 rounded-2xl border-border">
                        <h3 class="font-bold mb-2 flex items-center gap-2 text-text">
                            <i data-lucide="check-circle" class="w-5 h-5 text-primary"></i>
                            Darwin Core 準拠
                        </h3>
                        <p class="text-sm text-muted">国際標準のDwC形式でデータを管理。GBIF、iNaturalistとの互換性を確保。</p>
                    </div>
                    <div class="glass-card p-6 rounded-2xl border-border">
                        <h3 class="font-bold mb-2 flex items-center gap-2 text-text">
                            <i data-lucide="check-circle" class="w-5 h-5 text-primary"></i>
                            Research Grade システム
                        </h3>
                        <p class="text-sm text-muted">複数の専門家による検証を経たデータに「Research Grade」ステータスを付与。</p>
                    </div>
                    <div class="glass-card p-6 rounded-2xl border-border">
                        <h3 class="font-bold mb-2 flex items-center gap-2 text-text">
                            <i data-lucide="check-circle" class="w-5 h-5 text-primary"></i>
                            希少種の位置秘匿
                        </h3>
                        <p class="text-sm text-muted">絶滅危惧種は自動的に位置を秘匿（0.01&deg;単位に丸め）。研究目的での詳細位置は申請制。</p>
                    </div>
                </div>

                <div class="glass-card rounded-2xl border-border p-8">
                    <h3 class="text-lg font-black mb-6 text-text">プラットフォーム統計</h3>
                    <div class="space-y-4">
                        <div class="flex justify-between items-center py-3 border-b border-border">
                            <span class="text-muted text-sm font-bold">総観察数</span>
                            <span class="text-2xl font-black text-primary"><?= number_format($totalObs) ?></span>
                        </div>
                        <div class="flex justify-between items-center py-3 border-b border-border">
                            <span class="text-muted text-sm font-bold">Research Grade</span>
                            <span class="text-2xl font-black text-primary"><?= $rgRate ?>%</span>
                        </div>
                        <div class="flex justify-between items-center py-3 border-b border-border">
                            <span class="text-muted text-sm font-bold">確認種数</span>
                            <span class="text-2xl font-black text-secondary"><?= number_format($speciesCount) ?></span>
                        </div>
                        <div class="flex justify-between items-center py-3">
                            <span class="text-muted text-sm font-bold">レッドリスト種</span>
                            <span class="text-2xl font-black text-danger"><?= $redlistCount ?></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Data Access Policy -->
    <section class="py-16 px-6 bg-surface">
        <div class="max-w-4xl mx-auto">
            <h2 class="text-2xl font-black text-center mb-4 text-text">データアクセスポリシー</h2>
            <p class="text-muted text-center mb-12">研究目的でのデータ利用を支援します</p>

            <div class="grid md:grid-cols-3 gap-6">
                <div class="bg-base border border-border rounded-2xl p-8 text-center">
                    <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                        <i data-lucide="globe" class="w-6 h-6 text-primary"></i>
                    </div>
                    <h3 class="font-bold mb-2 text-text">公開データ</h3>
                    <p class="text-sm text-muted mb-4">Research Gradeの観察データは APIで自由にアクセス可能</p>
                    <span class="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-bold">CC BY-NC</span>
                </div>
                <div class="bg-base border border-border rounded-2xl p-8 text-center">
                    <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
                        <i data-lucide="file-text" class="w-6 h-6 text-accent"></i>
                    </div>
                    <h3 class="font-bold mb-2 text-text">申請制データ</h3>
                    <p class="text-sm text-muted mb-4">レッドリスト種の詳細位置は 研究目的で申請可能</p>
                    <span class="text-xs px-3 py-1 rounded-full bg-accent/10 text-accent font-bold">要申請</span>
                </div>
                <div class="bg-base border border-border rounded-2xl p-8 text-center">
                    <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-secondary/10 flex items-center justify-center">
                        <i data-lucide="handshake" class="w-6 h-6 text-secondary"></i>
                    </div>
                    <h3 class="font-bold mb-2 text-text">共同研究</h3>
                    <p class="text-sm text-muted mb-4">データ品質検証やAI開発での 共同研究を歓迎</p>
                    <span class="text-xs px-3 py-1 rounded-full bg-secondary/10 text-secondary font-bold">連携募集</span>
                </div>
            </div>
        </div>
    </section>

    <!-- CTA -->
    <section class="py-16 px-6">
        <div class="max-w-2xl mx-auto text-center glass-card p-12 rounded-3xl border-border">
            <h2 class="text-2xl md:text-3xl font-black mb-4 text-text">お問い合わせ</h2>
            <p class="text-muted mb-8">
                調査プロジェクトの設計、データ提供、<br>
                共同研究のご相談をお待ちしています。
            </p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="mailto:contact@ikimon.life" class="btn-primary flex items-center justify-center gap-2 px-8 py-3">
                    <i data-lucide="mail" class="w-5 h-5"></i>
                    お問い合わせ
                </a>
                <a href="explore.php" class="btn-secondary flex items-center justify-center gap-2 px-8 py-3">
                    <i data-lucide="search" class="w-5 h-5"></i>
                    データを閲覧
                </a>
            </div>
        </div>
    </section>

    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">lucide.createIcons();</script>
</body>
</html>
