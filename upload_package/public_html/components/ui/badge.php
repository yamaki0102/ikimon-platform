<?php
/**
 * Badge Component — 種ステータス・危険種ラベル
 *
 * Variables:
 *   $badge_label    string   表示テキスト（必須）
 *   $badge_type     string   'redlist' | 'invasive' | 'identified' | 'unidentified'
 *                            | 'new' | 'custom'
 *   $badge_color    string   type='custom' 時の手動カラー (Tailwindクラス)
 *   $badge_icon     string   Lucide icon name (optional)
 *   $badge_size     string   'xs' | 'sm' (default: 'xs')
 */

$label  = $badge_label  ?? '';
$type   = $badge_type   ?? 'custom';
$icon   = $badge_icon   ?? '';
$size   = $badge_size   ?? 'xs';

$classes = match($type) {
    'redlist'      => 'bg-emerald-50 text-red-700 border border-red-200',
    'invasive'     => 'bg-emerald-50 text-amber-700 border border-amber-200',
    'identified'   => 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    'unidentified' => 'bg-emerald-50 text-gray-500 border border-gray-200',
    'new'          => 'bg-emerald-50 text-gray-600 border border-gray-200',
    default        => $badge_color ?? 'bg-emerald-50 text-gray-500 border border-gray-200',
};

$textSize = $size === 'sm' ? 'text-xs' : 'text-[11px]';
$iconSize = $size === 'sm' ? 'w-3.5 h-3.5' : 'w-3 h-3';
$padding  = $size === 'sm' ? 'px-2.5 py-1' : 'px-2 py-0.5';
?>
<span class="inline-flex items-center gap-1 rounded-full font-bold <?= $textSize ?> <?= $padding ?> <?= $classes ?>">
    <?php if ($icon): ?>
        <i data-lucide="<?= htmlspecialchars($icon) ?>" class="<?= $iconSize ?>" aria-hidden="true"></i>
    <?php endif; ?>
    <?= htmlspecialchars($label) ?>
</span>
