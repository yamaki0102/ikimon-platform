<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();

$meta_title = '解説ガイド一覧';
$meta_description = 'ネイチャーポジティブ、地方創生、生物多様性、健康、企業導入まで。ikimon.life の解説コンテンツをまとめて読める一覧ページです。';

$guideGroups = [
    [
        'label' => '自然と社会',
        'description' => 'ネイチャーポジティブや地域の自然資本を、社会実装の視点でつかむ。',
        'accent' => 'from-emerald-500/15 via-cyan-500/10 to-sky-500/10',
        'border' => 'border-emerald-200/80',
        'items' => [
            [
                'href' => '/guide/nature-positive.php',
                'title' => 'ネイチャーポジティブ完全ガイド',
                'summary' => '自然再興の全体像と、日常の観察行動につなげる入口。',
            ],
            [
                'href' => '/guide/what-is-nature-positive.php',
                'title' => 'ネイチャーポジティブとは？',
                'summary' => '30by30 や世界目標を最短で理解する入門編。',
            ],
            [
                'href' => '/guide/japan-biodiversity.php',
                'title' => '日本の生物多様性',
                'summary' => '日本の固有性と国際的な位置づけをデータで把握する。',
            ],
            [
                'href' => '/guide/satoyama-initiative.php',
                'title' => '里山イニシアチブとは？',
                'summary' => '里山・OECM・市民科学の接点を整理する。',
            ],
            [
                'href' => '/guide/regional-biodiversity.php',
                'title' => '地方創生と生物多様性',
                'summary' => '自然資本を活かした地域再生の可能性を読む。',
            ],
        ],
    ],
    [
        'label' => '健康と学び',
        'description' => '歩くこと、観察すること、見分けることが脳と身体にどう効くか。',
        'accent' => 'from-amber-500/15 via-orange-500/10 to-rose-500/10',
        'border' => 'border-amber-200/80',
        'items' => [
            [
                'href' => '/guide/walking-brain-science.php',
                'title' => '自然の中を歩くと脳に何が起きるのか？',
                'summary' => 'お散歩と自然観察の健康効果を科学的に解説。',
            ],
            [
                'href' => '/guide/steps-dementia-prevention.php',
                'title' => '1日9,800歩で認知症リスク51%減',
                'summary' => '歩数研究をもとに、継続しやすい実践に落とし込む。',
            ],
            [
                'href' => '/guide/species-id-brain-training.php',
                'title' => '種同定は脳トレだった',
                'summary' => '見分ける力が認知機能にどう効くかを追う。',
            ],
        ],
    ],
    [
        'label' => '組織導入と分析',
        'description' => '企業・自治体・研究用途に近い視点の読み物と分析記事。',
        'accent' => 'from-violet-500/15 via-fuchsia-500/10 to-indigo-500/10',
        'border' => 'border-violet-200/80',
        'items' => [
            [
                'href' => '/guide/corporate-walking-program.php',
                'title' => '企業向けお散歩プログラム',
                'summary' => '健康経営と生物多様性推進を両立させる導入論。',
            ],
            [
                'href' => '/guide/nature-coexistence-sites-analysis.php',
                'title' => '自然共生サイト全件分析',
                'summary' => '全国認定サイトの分布と傾向をまとめて把握する。',
            ],
            [
                'href' => '/guide/ikimon-approach.php',
                'title' => 'ikimon のアプローチ',
                'summary' => 'ikimon が目指す設計思想と地域連携の考え方。',
            ],
        ],
    ],
];
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>
<body class="font-body" style="background:var(--md-surface);color:var(--md-on-surface);">
    <?php include __DIR__ . '/components/nav.php'; ?>

    <main class="pb-32">
        <section class="relative overflow-hidden border-b border-[var(--color-border)] bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.10),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,249,0.98))]">
            <div class="max-w-6xl mx-auto px-4 md:px-6 pt-24 md:pt-28 pb-14 md:pb-18">
                <span class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-200 bg-white/80 text-emerald-700 text-xs font-black tracking-[0.18em] uppercase">
                    Guides
                </span>
                <h1 class="mt-6 text-4xl md:text-6xl font-black tracking-tight text-text">解説ガイド一覧</h1>
                <p class="mt-5 max-w-3xl text-base md:text-lg leading-8 text-muted">
                    フッターから消えていた解説コンテンツを、テーマ別にまとめ直しました。
                    ネイチャーポジティブ、地方創生、日本の生物多様性、健康、企業導入までここから辿れます。
                </p>
                <div class="mt-8 flex flex-wrap gap-3 text-sm font-bold text-muted">
                    <a href="/guide/regional-biodiversity.php" class="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-white px-4 py-2 hover:border-emerald-300 hover:text-text transition">
                        地方創生と生物多様性
                    </a>
                    <a href="/guide/nature-positive.php" class="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-white px-4 py-2 hover:border-emerald-300 hover:text-text transition">
                        ネイチャーポジティブ完全ガイド
                    </a>
                    <a href="/guide/walking-brain-science.php" class="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-white px-4 py-2 hover:border-emerald-300 hover:text-text transition">
                        お散歩と脳科学
                    </a>
                </div>
            </div>
        </section>

        <section class="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-14 space-y-8">
            <?php foreach ($guideGroups as $group): ?>
                <section class="rounded-3xl border <?= htmlspecialchars($group['border'], ENT_QUOTES, 'UTF-8') ?> bg-white/90 shadow-sm overflow-hidden">
                    <div class="bg-gradient-to-r <?= htmlspecialchars($group['accent'], ENT_QUOTES, 'UTF-8') ?> px-6 md:px-8 py-6 border-b border-[var(--color-border)]">
                        <p class="text-xs font-black uppercase tracking-[0.18em] text-faint">Guide Cluster</p>
                        <h2 class="mt-2 text-2xl md:text-3xl font-black text-text"><?= htmlspecialchars($group['label'], ENT_QUOTES, 'UTF-8') ?></h2>
                        <p class="mt-3 max-w-3xl text-sm md:text-base leading-7 text-muted"><?= htmlspecialchars($group['description'], ENT_QUOTES, 'UTF-8') ?></p>
                    </div>

                    <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 md:p-6">
                        <?php foreach ($group['items'] as $item): ?>
                            <a href="<?= htmlspecialchars($item['href'], ENT_QUOTES, 'UTF-8') ?>" class="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]/80 p-5 hover:border-[var(--color-primary)]/30 hover:bg-white hover:shadow-md transition">
                                <div class="flex items-start justify-between gap-3">
                                    <h3 class="text-lg font-black leading-7 text-text group-hover:text-[var(--color-primary)] transition">
                                        <?= htmlspecialchars($item['title'], ENT_QUOTES, 'UTF-8') ?>
                                    </h3>
                                    <span class="mt-1 text-[var(--color-primary)] transition group-hover:translate-x-1">→</span>
                                </div>
                                <p class="mt-3 text-sm leading-7 text-muted">
                                    <?= htmlspecialchars($item['summary'], ENT_QUOTES, 'UTF-8') ?>
                                </p>
                            </a>
                        <?php endforeach; ?>
                    </div>
                </section>
            <?php endforeach; ?>
        </section>
    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>
</html>
