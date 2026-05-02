<?php
/**
 * Shared experience loop for the core ikimon flow.
 *
 * Keeps the main user journey consistent across profile, guides, map, and post success:
 * record -> view on map -> learn -> review outcomes.
 */
if (!function_exists('__')) {
    require_once __DIR__ . '/../../libs/Lang.php';
    Lang::init();
}

if (!function_exists('renderExperienceLoop')) {
    function renderExperienceLoop(array $options = []): void
    {
        $base = defined('BASE_URL') ? rtrim(BASE_URL, '/') : '';
        $current = (string)($options['current'] ?? '');
        $title = (string)($options['title'] ?? __('experience_loop.title', '次の観察ループ'));
        $lead = (string)($options['lead'] ?? __('experience_loop.lead', '記録して終わりではなく、場所で眺め、ガイドで意味を補い、自分の成果を確かめる流れです。'));
        $class = trim((string)($options['class'] ?? ''));
        $compact = (bool)($options['compact'] ?? false);

        $items = [
            [
                'key' => 'post',
                'href' => '/post.php',
                'icon' => 'camera',
                'label' => __('experience_loop.post_label', '記録する'),
                'body' => __('experience_loop.post_body', '写真・現地メモを残す'),
            ],
            [
                'key' => 'map',
                'href' => '/map.php',
                'icon' => 'map',
                'label' => __('experience_loop.map_label', '場所で見る'),
                'body' => __('experience_loop.map_body', '分布と調査の空白を見る'),
            ],
            [
                'key' => 'guides',
                'href' => '/guides.php',
                'icon' => 'book-open',
                'label' => __('experience_loop.guides_label', '学ぶ'),
                'body' => __('experience_loop.guides_body', '観察の意味を補う'),
            ],
            [
                'key' => 'results',
                'href' => '/guide_results.php',
                'icon' => 'bar-chart-3',
                'label' => __('experience_loop.results_label', '成果を確かめる'),
                'body' => __('experience_loop.results_body', '自分の活動を次へつなぐ'),
            ],
        ];
        ?>
        <section class="<?= htmlspecialchars($class, ENT_QUOTES, 'UTF-8') ?> rounded-[var(--shape-xl)] border border-[var(--color-border)] bg-[var(--md-surface-container)] shadow-sm overflow-hidden">
            <div class="<?= $compact ? 'p-4 md:p-5' : 'p-5 md:p-7' ?>">
                <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                    <div>
                        <p class="text-[10px] font-black uppercase tracking-[0.16em] text-faint mb-2"><?= htmlspecialchars(__('experience_loop.eyebrow', 'Experience loop'), ENT_QUOTES, 'UTF-8') ?></p>
                        <h2 class="<?= $compact ? 'text-lg' : 'text-2xl md:text-3xl' ?> font-black text-text leading-tight"><?= htmlspecialchars($title, ENT_QUOTES, 'UTF-8') ?></h2>
                        <p class="mt-2 max-w-2xl text-sm leading-7 text-muted"><?= htmlspecialchars($lead, ENT_QUOTES, 'UTF-8') ?></p>
                    </div>
                    <?php if (!empty($options['stat_label']) && isset($options['stat_value'])): ?>
                        <div class="shrink-0 rounded-2xl bg-white/75 border border-[var(--color-border)] px-4 py-3 text-right">
                            <p class="text-2xl font-black text-primary"><?= htmlspecialchars((string)$options['stat_value'], ENT_QUOTES, 'UTF-8') ?></p>
                            <p class="text-[10px] font-bold uppercase tracking-[0.12em] text-muted"><?= htmlspecialchars((string)$options['stat_label'], ENT_QUOTES, 'UTF-8') ?></p>
                        </div>
                    <?php endif; ?>
                </div>

                <div class="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <?php foreach ($items as $index => $item):
                        $isCurrent = $current === $item['key'];
                        $classes = $isCurrent
                            ? 'border-primary/40 bg-white text-text shadow-sm'
                            : 'border-[var(--color-border)] bg-white/55 text-text hover:border-primary/30 hover:bg-white';
                    ?>
                        <a href="<?= htmlspecialchars($base . $item['href'], ENT_QUOTES, 'UTF-8') ?>"
                           class="group min-h-[112px] rounded-2xl border <?= $classes ?> p-4 flex flex-col justify-between transition no-underline">
                            <div class="flex items-center justify-between gap-3">
                                <span class="inline-flex h-10 w-10 items-center justify-center rounded-2xl <?= $isCurrent ? 'bg-primary text-white' : 'bg-primary/10 text-primary' ?>">
                                    <i data-lucide="<?= htmlspecialchars($item['icon'], ENT_QUOTES, 'UTF-8') ?>" class="w-5 h-5"></i>
                                </span>
                                <span class="text-xs font-black text-faint"><?= sprintf('%02d', $index + 1) ?></span>
                            </div>
                            <div class="mt-3">
                                <p class="text-sm font-black leading-snug"><?= htmlspecialchars($item['label'], ENT_QUOTES, 'UTF-8') ?></p>
                                <p class="mt-1 text-xs leading-5 text-muted"><?= htmlspecialchars($item['body'], ENT_QUOTES, 'UTF-8') ?></p>
                            </div>
                        </a>
                    <?php endforeach; ?>
                </div>
            </div>
        </section>
        <?php
    }
}
