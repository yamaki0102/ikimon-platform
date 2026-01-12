<?php
/**
 * FB-38: NPS Survey Component
 * Shows after user's 5th observation post
 */
?>

<!-- NPS Survey Modal -->
<div x-data="npsSurvey" x-show="showModal" x-cloak
     class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
     x-transition:enter="transition ease-out duration-300"
     x-transition:enter-start="opacity-0"
     x-transition:enter-end="opacity-100"
     x-transition:leave="transition ease-in duration-200"
     x-transition:leave-start="opacity-100"
     x-transition:leave-end="opacity-0">
    
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="dismiss()"></div>
    
    <!-- Modal -->
    <div class="relative glass-card rounded-3xl p-8 max-w-md w-full border border-white/10 shadow-2xl"
         x-transition:enter="transition ease-out duration-300 delay-100"
         x-transition:enter-start="opacity-0 scale-95"
         x-transition:enter-end="opacity-100 scale-100">
        
        <button @click="dismiss()" class="absolute top-4 right-4 text-gray-400 hover:text-white">
            <i data-lucide="x" class="w-5 h-5"></i>
        </button>
        
        <div x-show="!submitted" class="text-center">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center">
                <i data-lucide="heart" class="w-8 h-8 text-[var(--color-primary)]"></i>
            </div>
            
            <h3 class="text-xl font-bold mb-2">ikimonはいかがですか？</h3>
            <p class="text-sm text-gray-400 mb-6">
                友人や同僚にikimonを勧める可能性はどのくらいですか？
            </p>
            
            <!-- NPS Score Buttons -->
            <div class="flex justify-center gap-1 mb-4">
                <template x-for="n in 11" :key="n-1">
                    <button @click="score = n-1"
                            :class="score === (n-1) ? 'bg-[var(--color-primary)] text-black' : 'bg-white/10 hover:bg-white/20'"
                            class="w-8 h-8 rounded-lg text-sm font-bold transition"
                            x-text="n-1"></button>
                </template>
            </div>
            
            <div class="flex justify-between text-xs text-gray-500 mb-6">
                <span>勧めない</span>
                <span>強く勧める</span>
            </div>
            
            <!-- Feedback textarea -->
            <div x-show="score !== null" x-transition class="mb-6">
                <textarea x-model="feedback" 
                          placeholder="改善点やご意見があればお聞かせください（任意）"
                          class="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 resize-none h-24 text-sm focus:outline-none focus:border-[var(--color-primary)]"></textarea>
            </div>
            
            <button @click="submit()" 
                    :disabled="score === null"
                    :class="score === null ? 'opacity-50 cursor-not-allowed' : ''"
                    class="btn-primary w-full">
                送信する
            </button>
        </div>
        
        <!-- Thank you state -->
        <div x-show="submitted" class="text-center py-8">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <i data-lucide="check" class="w-8 h-8 text-green-400"></i>
            </div>
            <h3 class="text-xl font-bold mb-2">ありがとうございます！</h3>
            <p class="text-sm text-gray-400">
                ご意見はプロダクトの改善に活かさせていただきます。
            </p>
        </div>
        
    </div>
</div>

<script>
document.addEventListener('alpine:init', () => {
    Alpine.data('npsSurvey', () => ({
        showModal: false,
        score: null,
        feedback: '',
        submitted: false,
        
        init() {
            // Check if should show (after 5th post, not shown before)
            const postCount = parseInt(localStorage.getItem('ikimon_post_count') || '0');
            const npsShown = localStorage.getItem('ikimon_nps_shown');
            const lastShown = localStorage.getItem('ikimon_nps_last_shown');
            
            // Show if 5+ posts and not shown in last 30 days
            if (postCount >= 5 && !npsShown) {
                const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                if (!lastShown || parseInt(lastShown) < thirtyDaysAgo) {
                    setTimeout(() => {
                        this.showModal = true;
                        lucide.createIcons();
                    }, 3000); // Show after 3 seconds
                }
            }
        },
        
        async submit() {
            if (this.score === null) return;
            
            try {
                await fetch('/api/submit_nps.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        score: this.score,
                        feedback: this.feedback
                    })
                });
            } catch (e) {
                console.error('NPS submit error:', e);
            }
            
            localStorage.setItem('ikimon_nps_shown', 'true');
            localStorage.setItem('ikimon_nps_last_shown', Date.now().toString());
            
            this.submitted = true;
            lucide.createIcons();
            
            setTimeout(() => {
                this.showModal = false;
            }, 2000);
        },
        
        dismiss() {
            localStorage.setItem('ikimon_nps_last_shown', Date.now().toString());
            this.showModal = false;
        }
    }));
});
</script>

<style>
[x-cloak] { display: none !important; }
</style>
