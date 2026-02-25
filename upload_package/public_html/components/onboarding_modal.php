<?php if (!isset($currentUser)): ?>
    <!-- Onboarding Modal: 20秒で「ikimonとは何か」を伝える3ステップ -->
    <div x-data="{
    open: !localStorage.getItem('ikimon_onboarded'),
    step: 1,
    totalSteps: 3,
    close() { this.open = false; localStorage.setItem('ikimon_onboarded', '1'); },
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
                aria-label="閉じる">✕</button>

            <!-- Progress Dots -->
            <div class="flex justify-center gap-2 pt-5 pb-3">
                <template x-for="i in totalSteps">
                    <div class="w-2 h-2 rounded-full transition-all duration-300"
                        :class="i <= step ? 'bg-primary scale-110' : 'bg-border'"></div>
                </template>
            </div>

            <!-- Step Content -->
            <div class="px-6 pb-4 text-center min-h-[220px] flex flex-col justify-center">

                <!-- Step 1: ようこそ -->
                <div x-show="step === 1" x-transition:enter="transition ease-out duration-200"
                    x-transition:enter-start="opacity-0 translate-x-4" x-transition:enter-end="opacity-100 translate-x-0">
                    <div class="w-16 h-16 bg-primary-surface rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                        <i data-lucide="sprout" class="w-8 h-8 text-primary"></i>
                    </div>
                    <h2 class="text-2xl font-black text-text mb-3">ikimon へようこそ</h2>
                    <p class="text-muted text-sm leading-relaxed">
                        見つけた生き物を<span class="text-primary font-bold">撮るだけ</span>。<br>
                        名前がわからなくても大丈夫。<br>
                        詳しい人が教えてくれます。
                    </p>
                </div>

                <!-- Step 2: かんたん3ステップ -->
                <div x-show="step === 2" x-transition:enter="transition ease-out duration-200"
                    x-transition:enter-start="opacity-0 translate-x-4" x-transition:enter-end="opacity-100 translate-x-0">
                    <h2 class="text-lg font-black text-text mb-6">かんたん3ステップ</h2>

                    <div class="space-y-5">
                        <div class="flex items-center gap-4 text-left">
                            <div class="w-12 h-12 rounded-2xl bg-primary-surface flex items-center justify-center shrink-0 shadow-sm">
                                <i data-lucide="camera" class="w-6 h-6 text-primary"></i>
                            </div>
                            <div>
                                <p class="text-base font-bold text-text">1. 撮って投稿</p>
                                <p class="text-xs text-muted">散歩中、庭先、どこでもOK</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-4 text-left">
                            <div class="w-12 h-12 rounded-2xl bg-accent-surface flex items-center justify-center shrink-0 shadow-sm">
                                <i data-lucide="sparkles" class="w-6 h-6 text-accent"></i>
                            </div>
                            <div>
                                <p class="text-base font-bold text-text">2. 名前がわかる</p>
                                <p class="text-xs text-muted">詳しい人が同定してくれます</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-4 text-left">
                            <div class="w-12 h-12 rounded-2xl bg-secondary-surface flex items-center justify-center shrink-0 shadow-sm">
                                <i data-lucide="map" class="w-6 h-6 text-secondary"></i>
                            </div>
                            <div>
                                <p class="text-base font-bold text-text">3. 自分だけの地図</p>
                                <p class="text-xs text-muted">記録が溜まると、あなただけの図鑑に</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Step 3: はじめよう -->
                <div x-show="step === 3" x-transition:enter="transition ease-out duration-200"
                    x-transition:enter-start="opacity-0 translate-x-4" x-transition:enter-end="opacity-100 translate-x-0">
                    <div class="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/30 rotate-3 hover:rotate-6 transition-transform">
                        <i data-lucide="rocket" class="w-10 h-10 text-white"></i>
                    </div>
                    <h2 class="text-xl font-black text-text mb-3">さあ、はじめよう！</h2>
                    <p class="text-muted text-sm leading-relaxed mb-4">
                        最初は「テスト」でもOK。<br>
                        まずは一枚、投稿してみよう！
                    </p>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="px-6 pb-6 flex flex-col gap-3">
                <template x-if="step < totalSteps">
                    <button @click="next()"
                        class="w-full py-3.5 rounded-2xl font-bold text-white bg-primary hover:bg-primary-dark active:scale-[0.98] transition shadow-lg shadow-primary/20">
                        <span x-text="step === 1 ? 'はじめる →' : '次へ →'"></span>
                    </button>
                </template>

                <template x-if="step === totalSteps">
                    <div class="space-y-3">
                        <a href="post.php"
                            class="block w-full py-3.5 rounded-2xl font-bold text-center text-white bg-primary hover:bg-primary-dark active:scale-[0.98] transition shadow-lg shadow-primary/20"
                            @click="close()">
                            📸 さっそく投稿する
                        </a>
                        <button @click="close()"
                            class="w-full py-3 rounded-2xl font-bold border border-border text-muted hover:text-text hover:bg-surface transition">
                            まずはタイムラインを見る
                        </button>
                    </div>
                </template>

                <div class="flex justify-between items-center pt-1">
                    <button x-show="step > 1" @click="prev()" class="text-xs text-gray-400 hover:text-gray-700 transition">
                        ← 戻る
                    </button>
                    <div x-show="step <= 1"></div>
                    <button @click="close()" class="text-xs text-gray-400 hover:text-gray-700 transition">
                        スキップ
                    </button>
                </div>
            </div>
        </div>
    </div>
<?php endif; ?>