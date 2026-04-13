<?php if (!isset($currentUser)): ?>
    <!-- Onboarding Modal: ikimonの100年構想を伝える5ステップ -->
    <div x-data="{
    open: !localStorage.getItem('ikimon_onboarded_v2'),
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
                aria-label="閉じる">✕</button>

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
                    <h2 class="text-2xl font-black text-text mb-3">ikimon へようこそ</h2>
                    <p class="text-muted text-sm leading-relaxed">
                        ここは、あなたが見つけた生き物を<br>
                        <span class="text-primary font-bold">100年後の未来に残す</span>場所です。
                    </p>
                </div>

                <!-- Step 2: 撮るだけ -->
                <div x-show="step === 2" x-transition:enter="transition ease-out duration-200"
                    x-transition:enter-start="opacity-0 translate-x-4" x-transition:enter-end="opacity-100 translate-x-0">
                    <div class="w-16 h-16 bg-accent-surface text-accent rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="camera" class="w-8 h-8"></i>
                    </div>
                    <h2 class="text-xl font-black text-text mb-3">1. 足跡を残す 🐾</h2>
                    <p class="text-muted text-sm leading-relaxed">
                        散歩中や庭先で見かけた生き物を<br>
                        スマホで<span class="text-primary font-bold">写真に撮るだけ</span>。<br>
                        GPSで場所も自動で記録されます。
                    </p>
                </div>

                <!-- Step 3: 名前がわからなくてもOK -->
                <div x-show="step === 3" x-transition:enter="transition ease-out duration-200"
                    x-transition:enter-start="opacity-0 translate-x-4" x-transition:enter-end="opacity-100 translate-x-0">
                    <div class="w-16 h-16 bg-secondary-surface text-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="sparkles" class="w-8 h-8"></i>
                    </div>
                    <h2 class="text-xl font-black text-text mb-3">2. 誰かが見つける 🔭</h2>
                    <p class="text-muted text-sm leading-relaxed">
                        生き物の名前は<span class="text-primary font-bold">わからなくてOK</span>。<br>
                        あなたの残した足跡を、<br>
                        世界中の詳しい人が教えてくれます。
                    </p>
                </div>

                <!-- Step 4: 自然の歴史書 -->
                <div x-show="step === 4" x-transition:enter="transition ease-out duration-200"
                    x-transition:enter-start="opacity-0 translate-x-4" x-transition:enter-end="opacity-100 translate-x-0">
                    <div class="w-16 h-16 bg-primary-surface text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="book-open" class="w-8 h-8"></i>
                    </div>
                    <h2 class="text-xl font-black text-text mb-3">3. 歴史書になる 📖</h2>
                    <p class="text-muted text-sm leading-relaxed">
                        集まった記録は、この町の<br>
                        <span class="text-primary font-bold">「生きている自然の歴史書」</span>として<br>
                        世界中の研究データの基盤になります。
                    </p>
                </div>

                <!-- Step 5: はじめよう -->
                <div x-show="step === 5" x-transition:enter="transition ease-out duration-200"
                    x-transition:enter-start="opacity-0 translate-x-4" x-transition:enter-end="opacity-100 translate-x-0">
                    <div class="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/30 rotate-3 hover:rotate-6 transition-transform">
                        <i data-lucide="footprints" class="w-10 h-10 text-white"></i>
                    </div>
                    <h2 class="text-xl font-black text-text mb-3">さあ、残そう</h2>
                    <p class="text-muted text-sm leading-relaxed mb-4">
                        道端の雑草でも、小さな虫でも。<br>
                        最初の足跡を、刻んでみましょう。
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
                            🐾 最初の足跡を残す
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