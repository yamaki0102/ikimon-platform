<?php
/**
 * Voice FAB Component — AI フィールドガイド「愛」との会話
 *
 * Alpine.js x-data="voiceAssistant()" で初期化される。
 * field_research.php や observation_detail.php に埋め込み可能。
 *
 * 依存: assets/js/voice-assistant.js
 */
?>
<div x-data="voiceAssistant()" class="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
    <!-- Reply bubble -->
    <template x-if="showReply && lastReply">
        <div class="max-w-[280px] bg-green-900 text-white text-sm rounded-xl px-4 py-3 shadow-lg"
             x-text="lastReply"
             x-transition:enter="transition ease-out duration-200"
             x-transition:enter-start="opacity-0 translate-y-2"
             x-transition:enter-end="opacity-100 translate-y-0"
             x-transition:leave="transition ease-in duration-150"
             x-transition:leave-start="opacity-100"
             x-transition:leave-end="opacity-0">
        </div>
    </template>

    <!-- Partial recognition -->
    <template x-if="state === 'listening' && partialText">
        <div class="max-w-[240px] bg-orange-50 text-orange-900 text-xs rounded-lg px-3 py-2 shadow">
            <span x-text="partialText"></span>
        </div>
    </template>

    <!-- FAB button -->
    <button
        @click="toggleListening()"
        :class="fabColor"
        class="w-16 h-16 rounded-full text-white shadow-xl flex flex-col items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        :title="fabLabel"
        x-show="isAvailable"
    >
        <span class="text-2xl" x-text="fabIcon"></span>
        <span class="text-[8px] leading-tight opacity-90" x-text="fabLabel"></span>
    </button>
</div>
