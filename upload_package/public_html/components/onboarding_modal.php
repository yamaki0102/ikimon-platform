<?php if (!isset($currentUser)): ?>
    <!-- Onboarding Modal: ikimonの100年構想を伝える5ステップ -->
    <div x-data="{
    open: window.location.search.includes('intro=1') && !localStorage.getItem('ikimon_onboarded_v2'),
    step: 1,
    totalSteps: 5,
    close() { this.open = false; localStorage.setItem('ikimon_onboarded_v2', '1'); },
    next() { if(this.step < this.totalSteps) this.step++; else this.close(); },
    prev() { if(this.step > 1) this.step--; }
}" x-show="open" x-transition:enter="transition ease-out duration-300"
        x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100"
        x-cloak
        style="display:none"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
        <!-- Backdrop: 不透明度高め + タップで閉じる -->
        <div class="fixed inset-0 bg-black/80" @click="close()"></div>

        <!-- Modal -->
        <div class="relative w-full max-w-sm max-h-[85dvh] overflow-y-auto bg-elevated rounded-3xl shadow-2xl border border-border" @click.stop>
            <!-- ✕ 閉じるボタン（常時表示・大きめタッチターゲット） -->
            <button @click="close()"
                class="absolute top-3 right-3 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-surface hover:bg-base active:bg-base transition text-muted hover:text-text text-xl leading-none"
                aria-label="<?= htmlspecialchars(__('onboarding.close', 'Close')) ?>">✕</button>

            <!-- Progress Dots -->
            <div class="flex justify-center gap-2 pt-5 pb-3">
                <template x-for="i in totalSteps">
                    <div class="w-2 h-2 rounded-full transition-all duration-300"
                        :class="i <= step ? 'bg-primary scale-110' : 'bg-border'"></div>
                </template>
            </div>

            <!-- Step Content -->
            <div class="px-6 pb-4 text-center min-h-[290px] flex flex-col justify-center">

                <!-- Step 1: ようこそ -->
                <div x-show="step === 1" x-transition:enter="transition ease-out duration-200"
                    x-transition:enter-start="opacity-0 translate-x-4" x-transition:enter-end="opacity-100 translate-x-0">
                    <div class="w-16 h-16 bg-primary-surface rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                        <i data-lucide="sprout" class="w-8 h-8 text-primary"></i>
                    </div>
                    <h2 class="text-2xl font-black text-text mb-3"><?= htmlspecialchars(__('onboarding.step1_title', 'Welcome to ikimon')) ?></h2>
                    <p class="text-muted text-sm leading-relaxed">
                        <?= __('onboarding.step1_body', 'This is a place to keep what you notice nearby, so you can look back on it later.') ?>
                    </p>
                </div>

                <!-- Step 2: 撮るだけ -->
                <div x-show="step === 2" x-transition:enter="transition ease-out duration-200"
                    x-transition:enter-start="opacity-0 translate-x-4" x-transition:enter-end="opacity-100 translate-x-0">
                    <div class="w-16 h-16 bg-accent-surface text-accent rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="camera" class="w-8 h-8"></i>
                    </div>
                    <h2 class="text-xl font-black text-text mb-3"><?= htmlspecialchars(__('onboarding.step2_title', '1. Leave the first trace')) ?> 🐾</h2>
                    <p class="text-muted text-sm leading-relaxed">
                        <?= __('onboarding.step2_body', 'If something catches your eye on a walk or near home, a photo is enough to start.') ?>
                    </p>
                </div>

                <!-- Step 3: 名前がわからなくてもOK -->
                <div x-show="step === 3" x-transition:enter="transition ease-out duration-200"
                    x-transition:enter-start="opacity-0 translate-x-4" x-transition:enter-end="opacity-100 translate-x-0">
                    <div class="w-16 h-16 bg-secondary-surface text-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="sparkles" class="w-8 h-8"></i>
                    </div>
                    <h2 class="text-xl font-black text-text mb-3"><?= htmlspecialchars(__('onboarding.step3_title', '2. Sort it out later')) ?> 🔭</h2>
                    <p class="text-muted text-sm leading-relaxed">
                        <?= __('onboarding.step3_body', 'You do not need the exact name right away. If the photo and place stay together, it is easier to figure out later.') ?>
                    </p>
                </div>

                <!-- Step 4: 自然の歴史書 -->
                <div x-show="step === 4" x-transition:enter="transition ease-out duration-200"
                    x-transition:enter-start="opacity-0 translate-x-4" x-transition:enter-end="opacity-100 translate-x-0">
                    <div class="w-16 h-16 bg-primary-surface text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="book-open" class="w-8 h-8"></i>
                    </div>
                    <h2 class="text-xl font-black text-text mb-3"><?= htmlspecialchars(__('onboarding.step4_title', '3. Places start to build a story')) ?> 📖</h2>
                    <p class="text-muted text-sm leading-relaxed">
                        <?= __('onboarding.step4_body', 'As records gather in the same place, it becomes easier to notice seasonal differences and what changed.') ?>
                    </p>
                </div>

                <!-- Step 5: はじめよう -->
                <div x-show="step === 5" x-transition:enter="transition ease-out duration-200"
                    x-transition:enter-start="opacity-0 translate-x-4" x-transition:enter-end="opacity-100 translate-x-0">
                    <div class="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/30 rotate-3 hover:rotate-6 transition-transform">
                        <i data-lucide="footprints" class="w-10 h-10 text-white"></i>
                    </div>
                    <h2 class="text-xl font-black text-text mb-3"><?= htmlspecialchars(__('onboarding.step5_title', 'Ready to start')) ?></h2>
                    <p class="text-muted text-sm leading-relaxed mb-4">
                        <?= __('onboarding.step5_body', 'A weed by the road or a small insect is enough. Start with one record.') ?>
                    </p>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="px-6 pb-6 flex flex-col gap-3">
                <template x-if="step < totalSteps">
                    <button @click="next()"
                        class="w-full py-3.5 rounded-2xl font-bold text-white bg-primary hover:bg-primary-dark active:scale-[0.98] transition shadow-lg shadow-primary/20">
                        <span x-text='step === 1 ? <?= json_encode(__('onboarding.start', 'Start →'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?> : <?= json_encode(__('onboarding.next', 'Next →'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>'></span>
                    </button>
                </template>

                <template x-if="step === totalSteps">
                    <div class="space-y-3">
                        <a href="post.php"
                            class="block w-full py-3.5 rounded-2xl font-bold text-center text-white bg-primary hover:bg-primary-dark active:scale-[0.98] transition shadow-lg shadow-primary/20"
                            @click="close()">
                            🐾 <?= htmlspecialchars(__('onboarding.primary_cta', 'Leave the first record')) ?>
                        </a>
                        <button @click="close()"
                            class="w-full py-3 rounded-2xl font-bold border border-border text-muted hover:text-text hover:bg-surface transition">
                            <?= htmlspecialchars(__('onboarding.secondary_cta', 'See the timeline first')) ?>
                        </button>
                    </div>
                </template>

                <div class="flex justify-between items-center pt-1">
                    <button x-show="step > 1" @click="prev()" class="text-xs text-gray-400 hover:text-gray-700 transition">
                        ← <?= htmlspecialchars(__('onboarding.back', 'Back')) ?>
                    </button>
                    <div x-show="step <= 1"></div>
                    <button @click="close()" class="text-xs text-gray-400 hover:text-gray-700 transition">
                        <?= htmlspecialchars(__('onboarding.skip', 'Skip')) ?>
                    </button>
                </div>
            </div>
        </div>
    </div>
<?php endif; ?>
