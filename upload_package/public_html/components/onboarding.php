<?php

/**
 * Onboarding Component
 * 
 * Shows a 3-step tutorial overlay for first-time users.
 * Uses localStorage to track completion. Only shown once.
 */
?>
<div x-data="onboarding()" x-show="show" x-cloak
    class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
    x-transition:enter="transition ease-out duration-300"
    x-transition:enter-start="opacity-0"
    x-transition:enter-end="opacity-100"
    x-transition:leave="transition ease-in duration-200"
    x-transition:leave-start="opacity-100"
    x-transition:leave-end="opacity-0">

    <div class="bg-[var(--color-bg-surface)] rounded-2xl max-w-md w-[90vw] p-6 shadow-2xl border border-white/10">

        <!-- Step indicator -->
        <div class="flex justify-center gap-2 mb-6">
            <template x-for="i in totalSteps" :key="i">
                <div class="w-2 h-2 rounded-full transition-all duration-300"
                    :class="i <= step ? 'bg-[var(--color-primary)] w-6' : 'bg-white/20'"></div>
            </template>
        </div>

        <!-- Step content -->
        <div class="text-center mb-6">
            <!-- Step 1: Discover -->
            <template x-if="step === 1">
                <div>
                    <div class="text-4xl mb-4">🔍</div>
                    <h3 class="text-xl font-bold mb-2">いきものを見つけよう</h3>
                    <p class="text-sm text-gray-400 leading-relaxed">
                        散歩中に見つけた鳥、花、虫を<br>
                        スマホで撮影して記録しよう
                    </p>
                </div>
            </template>

            <!-- Step 2: Share -->
            <template x-if="step === 2">
                <div>
                    <div class="text-4xl mb-4">📸</div>
                    <h3 class="text-xl font-bold mb-2">写真を投稿しよう</h3>
                    <p class="text-sm text-gray-400 leading-relaxed">
                        位置情報と一緒に記録することで<br>
                        地域の生物多様性マップに貢献できます
                    </p>
                </div>
            </template>

            <!-- Step 3: Connect -->
            <template x-if="step === 3">
                <div>
                    <div class="text-4xl mb-4">🌿</div>
                    <h3 class="text-xl font-bold mb-2">みんなで同定しよう</h3>
                    <p class="text-sm text-gray-400 leading-relaxed">
                        専門家やベテラン観察者と一緒に<br>
                        種を特定する「市民科学」を体験しよう
                    </p>
                </div>
            </template>
        </div>

        <!-- Navigation -->
        <div class="flex gap-3">
            <button @click="skip()"
                class="flex-1 py-3 text-sm text-gray-400 hover:text-white transition rounded-xl">
                スキップ
            </button>
            <button @click="next()"
                class="flex-1 py-3 text-sm font-bold text-white rounded-xl transition"
                :class="step === totalSteps ? 'bg-[var(--color-primary)]' : 'bg-white/10 hover:bg-white/20'">
                <span x-text="step === totalSteps ? 'はじめる！' : '次へ'"></span>
            </button>
        </div>
    </div>
</div>

<script nonce="<?= CspNonce::attr() ?>">
    function onboarding() {
        return {
            show: false,
            step: 1,
            totalSteps: 3,
            init() {
                if (!localStorage.getItem('ikimon_onboarded')) {
                    setTimeout(() => {
                        this.show = true;
                    }, 2000);
                }
            },
            next() {
                if (this.step < this.totalSteps) {
                    this.step++;
                } else {
                    this.complete();
                }
            },
            skip() {
                this.complete();
            },
            complete() {
                localStorage.setItem('ikimon_onboarded', '1');
                this.show = false;
            }
        }
    }
</script>