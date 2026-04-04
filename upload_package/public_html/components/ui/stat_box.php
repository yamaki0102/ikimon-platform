<?php
/**
 * Stat Box Component — 数値 + ラベルの統計表示
 *
 * Usage:
 *   <?php include_component('stat_box', [
 *       'value'    => '42',
 *       'label'    => '確認種数',
 *       'sub'      => '今月 +3',      // optional
 *       'icon'     => 'leaf',          // optional Lucide icon name
 *       'size'     => 'md',            // 'sm' | 'md' | 'lg'
 *       'variant'  => 'default',       // 'default' | 'primary' | 'danger' | 'warning'
 *   ]);
 *
 * Or inline:
 *   <?php $stat_value = '42'; $stat_label = '確認種数'; include __DIR__ . '/components/ui/stat_box.php'; ?>
 */

$value   = $stat_value   ?? $value   ?? '—';
$label   = $stat_label   ?? $label   ?? '';
$sub     = $stat_sub     ?? $sub     ?? '';
$icon    = $stat_icon    ?? $icon    ?? '';
$size    = $stat_size    ?? $size    ?? 'md';
$variant = $stat_variant ?? $variant ?? 'default';

$valueSize = match($size) {
    'sm' => 'text-2xl',
    'lg' => 'text-5xl md:text-6xl',
    default => 'text-3xl md:text-4xl',
};

$variantBg = match($variant) {
    'primary' => 'border-emerald-200 bg-emerald-50',
    'danger'  => 'border-red-200 bg-red-50',
    'warning' => 'border-amber-200 bg-amber-50',
    default   => 'border-[var(--md-outline-variant)] bg-[var(--md-surface-container-low)]',
};
?>
<div class="rounded-[20px] border p-4 <?= $variantBg ?>">
    <?php if ($icon): ?>
        <i data-lucide="<?= htmlspecialchars($icon) ?>" class="w-5 h-5 mb-2 text-slate-400" aria-hidden="true"></i>
    <?php endif; ?>
    <div class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 mb-1">
        <?= htmlspecialchars($label) ?>
    </div>
    <div class="<?= $valueSize ?> font-black text-[#10231f] leading-none">
        <?= htmlspecialchars((string)$value) ?>
    </div>
    <?php if ($sub): ?>
        <p class="text-xs text-slate-500 mt-1.5 leading-snug"><?= htmlspecialchars($sub) ?></p>
    <?php endif; ?>
</div>
