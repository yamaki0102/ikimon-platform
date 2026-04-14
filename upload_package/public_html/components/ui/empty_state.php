<?php
/**
 * Empty State Component — 空状態UI
 *
 * Usage:
 *   <?php include __DIR__ . '/components/ui/empty_state.php'; ?>
 *
 * Variables (set before include):
 *   $empty_icon    string  Lucide icon name (default: 'inbox')
 *   $empty_title   string  見出し
 *   $empty_body    string  説明文
 *   $empty_action  string  ボタンラベル (optional)
 *   $empty_href    string  ボタンリンク (optional)
 *   $empty_size    string  'sm' | 'md' (default: 'md')
 */

$icon   = $empty_icon   ?? 'inbox';
$title  = $empty_title  ?? __('ui.empty_state_default_title', 'No data yet');
$body   = $empty_body   ?? '';
$action = $empty_action ?? '';
$href   = $empty_href   ?? '';
$size   = $empty_size   ?? 'md';

$padding = $size === 'sm' ? 'p-6' : 'p-10 md:p-16';
$iconSize = $size === 'sm' ? 'w-8 h-8' : 'w-12 h-12';
$titleSize = $size === 'sm' ? 'text-base' : 'text-lg';
?>
<div class="flex flex-col items-center text-center <?= $padding ?>">
    <div class="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <i data-lucide="<?= htmlspecialchars($icon) ?>"
           class="<?= $iconSize ?> text-slate-400" aria-hidden="true"></i>
    </div>
    <h3 class="<?= $titleSize ?> font-black text-[#10231f] mb-2">
        <?= htmlspecialchars($title) ?>
    </h3>
    <?php if ($body): ?>
        <p class="text-sm leading-7 text-slate-500 max-w-sm"><?= htmlspecialchars($body) ?></p>
    <?php endif; ?>
    <?php if ($action && $href): ?>
        <a href="<?= htmlspecialchars($href) ?>"
           class="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full
                  bg-[#0f3d2e] px-5 text-sm font-bold text-white">
            <?= htmlspecialchars($action) ?>
        </a>
    <?php endif; ?>
</div>
