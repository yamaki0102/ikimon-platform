<?php
// Badge Notification Toast (Alpine.js)
// $_SESSION['new_badges'] に配列があれば自動表示
$newBadges = $_SESSION['new_badges'] ?? [];
if (!empty($newBadges)) {
    unset($_SESSION['new_badges']);
}
?>
<?php if (!empty($newBadges)): ?>
<div x-data="{ toasts: <?= htmlspecialchars(json_encode($newBadges, JSON_HEX_TAG | JSON_UNESCAPED_UNICODE), ENT_QUOTES) ?>, current: 0, show: true }"
     x-init="setTimeout(() => show = true, 500); setInterval(() => { if (current < toasts.length - 1) current++; else show = false; }, 4000)"
     x-show="show && toasts.length > 0"
     x-transition:enter="transition ease-out duration-300"
     x-transition:enter-start="translate-y-4 opacity-0"
     x-transition:enter-end="translate-y-0 opacity-100"
     x-transition:leave="transition ease-in duration-200"
     x-transition:leave-start="translate-y-0 opacity-100"
     x-transition:leave-end="translate-y-4 opacity-0"
     class="fixed bottom-24 right-4 z-50 max-w-sm"
     role="alert" aria-live="polite">
    <div class="bg-surface border border-primary/20 rounded-xl shadow-lg p-4 flex items-center gap-3">
        <span class="text-2xl" x-text="toasts[current]?.icon || '🏆'"></span>
        <div>
            <p class="text-xs text-primary font-bold">バッジ獲得！</p>
            <p class="text-sm font-bold text-text" x-text="toasts[current]?.name_ja || toasts[current]?.name"></p>
        </div>
        <button @click="show = false" class="ml-auto text-faint hover:text-text" aria-label="閉じる">
            <i data-lucide="x" class="w-4 h-4"></i>
        </button>
    </div>
</div>
<?php endif; ?>
