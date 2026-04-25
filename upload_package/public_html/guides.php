<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/Lang.php';
Auth::init();
Lang::init();

$documentLang = method_exists('Lang', 'current') ? Lang::current() : 'ja';
$meta_title = __('guides_page.meta_title', 'Guide list');
$meta_description = __('guides_page.meta_description', 'A theme-based list of ikimon guides covering nature positive, regional development, biodiversity, health, and organizational adoption.');

$guideGroups = [
    [
        'label' => __('guides_page.group_1_label', 'Nature and society'),
        'description' => __('guides_page.group_1_description', 'Understand nature positive and local natural capital through a social implementation lens.'),
        'accent' => 'from-emerald-500/15 via-cyan-500/10 to-sky-500/10',
        'border' => 'border-emerald-200/80',
        'items' => [
            [
                'href' => '/guide/nature-positive.php',
                'title' => __('guides_page.nature_positive_title', 'Nature Positive complete guide'),
                'summary' => __('guides_page.nature_positive_summary', 'A practical entry point from the big picture of nature recovery to everyday observation.'),
            ],
            [
                'href' => '/guide/what-is-nature-positive.php',
                'title' => __('guides_page.what_is_nature_positive_title', 'What is nature positive?'),
                'summary' => __('guides_page.what_is_nature_positive_summary', 'A short introduction to 30by30 and the global goals behind it.'),
            ],
            [
                'href' => '/guide/japan-biodiversity.php',
                'title' => __('guides_page.japan_biodiversity_title', 'Biodiversity in Japan'),
                'summary' => __('guides_page.japan_biodiversity_summary', 'Use data to understand Japan’s uniqueness and international position.'),
            ],
            [
                'href' => '/guide/satoyama-initiative.php',
                'title' => __('guides_page.satoyama_title', 'What is the Satoyama Initiative?'),
                'summary' => __('guides_page.satoyama_summary', 'Sort out the overlap between satoyama, OECM, and citizen science.'),
            ],
            [
                'href' => '/guide/regional-biodiversity.php',
                'title' => __('guides_page.regional_biodiversity_title', 'Regional revitalization and biodiversity'),
                'summary' => __('guides_page.regional_biodiversity_summary', 'Read how natural capital can support regional renewal.'),
            ],
        ],
    ],
    [
        'label' => __('guides_page.group_2_label', 'Health and learning'),
        'description' => __('guides_page.group_2_description', 'How walking, observing, and identifying affect the brain and body.'),
        'accent' => 'from-amber-500/15 via-orange-500/10 to-rose-500/10',
        'border' => 'border-amber-200/80',
        'items' => [
            [
                'href' => '/guide/walking-brain-science.php',
                'title' => __('guides_page.walking_brain_title', 'What happens to the brain when you walk in nature?'),
                'summary' => __('guides_page.walking_brain_summary', 'A science-based look at the health effects of walking and nature observation.'),
            ],
            [
                'href' => '/guide/steps-dementia-prevention.php',
                'title' => __('guides_page.steps_title', '9,800 steps a day and lower dementia risk'),
                'summary' => __('guides_page.steps_summary', 'Turn walking research into something sustainable in daily life.'),
            ],
            [
                'href' => '/guide/species-id-brain-training.php',
                'title' => __('guides_page.id_brain_title', 'Species ID as brain training'),
                'summary' => __('guides_page.id_brain_summary', 'Explore how identification skills connect to cognition.'),
            ],
        ],
    ],
    [
        'label' => __('guides_page.group_3_label', 'Organizational adoption and analysis'),
        'description' => __('guides_page.group_3_description', 'Guides and analysis closer to company, municipality, and research use cases.'),
        'accent' => 'from-violet-500/15 via-fuchsia-500/10 to-indigo-500/10',
        'border' => 'border-violet-200/80',
        'items' => [
            [
                'href' => '/guide/corporate-walking-program.php',
                'title' => __('guides_page.corporate_walking_title', 'Walking programs for organizations'),
                'summary' => __('guides_page.corporate_walking_summary', 'An introduction to combining wellbeing initiatives with biodiversity action.'),
            ],
            [
                'href' => '/guide/nature-coexistence-sites-analysis.php',
                'title' => __('guides_page.coexistence_analysis_title', 'Full analysis of nature coexistence sites'),
                'summary' => __('guides_page.coexistence_analysis_summary', 'Review the distribution and patterns of certified sites across Japan.'),
            ],
            [
                'href' => '/guide/ikimon-approach.php',
                'title' => __('guides_page.ikimon_approach_title', 'The ikimon approach'),
                'summary' => __('guides_page.ikimon_approach_summary', 'The product philosophy behind ikimon and its regional collaboration model.'),
            ],
        ],
    ],
];
?>
<!DOCTYPE html>
<html lang="<?= htmlspecialchars($documentLang, ENT_QUOTES, 'UTF-8') ?>">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>
<body class="font-body" style="background:var(--md-surface);color:var(--md-on-surface);">
    <?php include __DIR__ . '/components/nav.php'; ?>

    <main class="pb-32">
        <section class="relative overflow-hidden border-b border-[var(--color-border)] bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.10),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,249,0.98))]">
            <div class="max-w-6xl mx-auto px-4 md:px-6 pt-24 md:pt-28 pb-14 md:pb-18">
                <span class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-200 bg-white/80 text-emerald-700 text-xs font-black tracking-[0.18em] uppercase">
                    <?= htmlspecialchars(__('guides_page.eyebrow', 'Guides')) ?>
                </span>
                <h1 class="mt-6 text-4xl md:text-6xl font-black tracking-tight text-text"><?= htmlspecialchars(__('guides_page.title', 'Guide list')) ?></h1>
                <p class="mt-5 max-w-3xl text-base md:text-lg leading-8 text-muted">
                    <?= htmlspecialchars(__('guides_page.lead', 'The guide articles that had become hard to reach from the footer are now regrouped by theme. Start here for nature positive, regional revitalization, biodiversity in Japan, health, and organizational adoption.')) ?>
                </p>
                <div class="mt-8 flex flex-wrap gap-3 text-sm font-bold text-muted">
                    <a href="/guide/regional-biodiversity.php" class="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-white px-4 py-2 hover:border-emerald-300 hover:text-text transition">
                        <?= htmlspecialchars(__('guides_page.regional_biodiversity_title', 'Regional revitalization and biodiversity')) ?>
                    </a>
                    <a href="/guide/nature-positive.php" class="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-white px-4 py-2 hover:border-emerald-300 hover:text-text transition">
                        <?= htmlspecialchars(__('guides_page.nature_positive_title', 'Nature Positive complete guide')) ?>
                    </a>
                    <a href="/guide/walking-brain-science.php" class="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-white px-4 py-2 hover:border-emerald-300 hover:text-text transition">
                        <?= htmlspecialchars(__('guides_page.walking_brain_short', 'Walking and brain science')) ?>
                    </a>
                </div>
            </div>
        </section>

        <section class="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-14 space-y-8">
            <?php foreach ($guideGroups as $group): ?>
                <section class="rounded-3xl border <?= htmlspecialchars($group['border'], ENT_QUOTES, 'UTF-8') ?> bg-white/90 shadow-sm overflow-hidden">
                    <div class="bg-gradient-to-r <?= htmlspecialchars($group['accent'], ENT_QUOTES, 'UTF-8') ?> px-6 md:px-8 py-6 border-b border-[var(--color-border)]">
                        <p class="text-xs font-black uppercase tracking-[0.18em] text-faint"><?= htmlspecialchars(__('guides_page.cluster_label', 'Guide cluster')) ?></p>
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
