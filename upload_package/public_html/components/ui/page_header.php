<?php
/**
 * Page Header Component — ページタイトル + 説明文
 *
 * Variables (set before include):
 *   $header_title   string  H1 テキスト（必須）
 *   $header_sub     string  説明文 (optional)
 *   $header_chip    string  chip ラベル (optional, e.g. "Beta")
 *   $header_actions string  右側のアクション HTML (optional, raw HTML)
 *   $header_size    string  'sm' | 'md' | 'lg' (default: 'md')
 */

$title   = $header_title   ?? '';
$sub     = $header_sub     ?? '';
$chip    = $header_chip    ?? '';
$actions = $header_actions ?? '';
$size    = $header_size    ?? 'md';

$titleClass = match($size) {
    'sm' => 'text-2xl font-black tracking-[-0.04em] text-[#10231f]',
    'lg' => 'text-4xl md:text-5xl font-black tracking-[-0.05em] text-[#10231f]',
    default => 'text-3xl md:text-4xl font-black tracking-[-0.04em] text-[#10231f]',
};
?>
<div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between mb-6">
    <div>
        <?php if ($chip): ?>
            <span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200
                         bg-emerald-50 px-3 py-1 text-[11px] font-extrabold uppercase
                         tracking-[0.16em] text-emerald-700 mb-3">
                <?= htmlspecialchars($chip) ?>
            </span>
        <?php endif; ?>
        <h1 class="<?= $titleClass ?>"><?= htmlspecialchars($title) ?></h1>
        <?php if ($sub): ?>
            <p class="mt-2 text-sm leading-7 text-slate-500 max-w-2xl"><?= htmlspecialchars($sub) ?></p>
        <?php endif; ?>
    </div>
    <?php if ($actions): ?>
        <div class="flex flex-wrap gap-2 flex-shrink-0"><?= $actions ?></div>
    <?php endif; ?>
</div>
