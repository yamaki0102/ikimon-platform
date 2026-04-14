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
                    <h3 class="text-xl font-bold mb-2"><?= htmlspecialchars(__('onboarding_simple.step1_title', 'Find something nearby')) ?></h3>
                    <p class="text-sm text-gray-400 leading-relaxed"><?= nl2br(htmlspecialchars(__('onboarding_simple.step1_body', "Notice a bird, flower, or bug on a walk.\nA photo is enough to start."), ENT_QUOTES, 'UTF-8')) ?></p>
                    <div class="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-left">
                        <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary)] mb-1"><?= htmlspecialchars(__('onboarding_simple.step1_mission_label', 'Why this matters')) ?></p>
                        <p class="text-xs text-gray-300 leading-relaxed"><?= nl2br(htmlspecialchars(__('onboarding_simple.step1_mission_body', "The goal is not to know everything at once.\nThe first win is noticing a living thing more carefully than yesterday."), ENT_QUOTES, 'UTF-8')) ?></p>
                    </div>
                </div>
            </template>

            <!-- Step 2: Share -->
            <template x-if="step === 2">
                <div>
                    <div class="text-4xl mb-4">📸</div>
                    <h3 class="text-xl font-bold mb-2"><?= htmlspecialchars(__('onboarding_simple.step2_title', 'Save it with the place')) ?></h3>
                    <p class="text-sm text-gray-400 leading-relaxed"><?= nl2br(htmlspecialchars(__('onboarding_simple.step2_body', "Keeping the photo and location together makes it easier\nto revisit the same place later."), ENT_QUOTES, 'UTF-8')) ?></p>
                    <div class="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-left">
                        <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary)] mb-1"><?= htmlspecialchars(__('onboarding_simple.step2_mission_label', 'Your trace stays useful')) ?></p>
                        <p class="text-xs text-gray-300 leading-relaxed"><?= nl2br(htmlspecialchars(__('onboarding_simple.step2_mission_body', "A record with place and date is useful even before the name is exact.\nIt becomes something you can revisit, compare, and learn from later."), ENT_QUOTES, 'UTF-8')) ?></p>
                    </div>
                </div>
            </template>

            <!-- Step 3: Connect -->
            <template x-if="step === 3">
                <div>
                    <div class="text-4xl mb-4">🌿</div>
                    <h3 class="text-xl font-bold mb-2"><?= htmlspecialchars(__('onboarding_simple.step3_title', 'Figure it out together')) ?></h3>
                    <p class="text-sm text-gray-400 leading-relaxed"><?= nl2br(htmlspecialchars(__('onboarding_simple.step3_body', "You do not need the exact name right away.\nThe community can help narrow it down later."), ENT_QUOTES, 'UTF-8')) ?></p>
                    <div class="mt-4 rounded-2xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-3 text-left">
                        <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary)] mb-1"><?= htmlspecialchars(__('onboarding_simple.step3_mission_label', 'Learn and help others learn')) ?></p>
                        <p class="text-xs text-gray-300 leading-relaxed"><?= nl2br(htmlspecialchars(__('onboarding_simple.step3_mission_body', "Each improved observation helps you grow.\nAt the same time, it helps train better guidance and AI for the next person."), ENT_QUOTES, 'UTF-8')) ?></p>
                    </div>
                </div>
            </template>
        </div>

        <!-- Navigation -->
        <div class="flex gap-3">
            <button @click="skip()"
                class="flex-1 py-3 text-sm text-gray-400 hover:text-white transition rounded-xl">
                <?= htmlspecialchars(__('onboarding_simple.skip', 'Skip')) ?>
            </button>
            <button @click="next()"
                class="flex-1 py-3 text-sm font-bold text-white rounded-xl transition"
                :class="step === totalSteps ? 'bg-[var(--color-primary)]' : 'bg-white/10 hover:bg-white/20'">
                <span x-text="step === totalSteps ? <?= json_encode(__('onboarding_simple.start', 'Start'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?> : <?= json_encode(__('onboarding_simple.next', 'Next'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>"></span>
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
