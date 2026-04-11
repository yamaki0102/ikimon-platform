<!-- Feedback Widget -->
<div x-data="feedbackWidget()" x-cloak x-init="$nextTick(() => document.body.appendChild($el))" class="feedback-widget" :class="{ 'is-open': open }">

    <!-- Trigger Button -->
    <button
        type="button"
        @click="open = !open; if(open) $nextTick(() => lucide.createIcons({nameAttr:'data-lucide'}))"
        class="feedback-trigger"
        :class="{ 'is-active': open }"
        aria-label="フィードバックを送る"
    >
        <svg x-show="!open" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
        <svg x-show="open" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    </button>

    <!-- Panel -->
    <div
        x-show="open"
        x-transition:enter="transition ease-out duration-200"
        x-transition:enter-start="opacity-0 translate-y-4 scale-95"
        x-transition:enter-end="opacity-100 translate-y-0 scale-100"
        x-transition:leave="transition ease-in duration-150"
        x-transition:leave-start="opacity-100 translate-y-0 scale-100"
        x-transition:leave-end="opacity-0 translate-y-4 scale-95"
        @click.away="open = false"
        class="feedback-panel"
    >
        <!-- Header -->
        <div class="flex items-center gap-2 mb-4">
            <svg class="w-4 h-4 text-[var(--color-primary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
            <p class="text-sm font-bold text-text">フィードバック</p>
            <span class="text-[10px] text-faint ml-auto uppercase tracking-wider font-bold">Beta</span>
        </div>

        <!-- Sent state -->
        <template x-if="sent">
            <div class="text-center py-6">
                <div class="text-3xl mb-2">&#x2705;</div>
                <p class="text-sm font-bold text-text mb-1">ありがとうございます！</p>
                <p class="text-xs text-muted">改善に役立てます</p>
            </div>
        </template>

        <!-- Form -->
        <template x-if="!sent">
            <div>
                <!-- Category chips -->
                <div class="flex gap-2 mb-3">
                    <button
                        type="button"
                        @click="category = 'bug'"
                        class="feedback-chip"
                        :class="{ 'is-selected': category === 'bug' }"
                    >&#x1F41B; バグ</button>
                    <button
                        type="button"
                        @click="category = 'improvement'"
                        class="feedback-chip"
                        :class="{ 'is-selected': category === 'improvement' }"
                    >&#x1F4A1; 改善</button>
                    <button
                        type="button"
                        @click="category = 'other'"
                        class="feedback-chip"
                        :class="{ 'is-selected': category === 'other' }"
                    >&#x1F4AC; その他</button>
                </div>

                <!-- Description -->
                <textarea
                    x-model="description"
                    class="feedback-textarea"
                    :placeholder="category === 'bug' ? '何が起きましたか？' : 'こうなると嬉しい！'"
                    rows="3"
                    maxlength="2000"
                ></textarea>

                <!-- Page info -->
                <p class="text-[10px] text-faint mb-3 truncate" x-text="'📍 ' + pageUrl"></p>

                <!-- Submit -->
                <button
                    type="button"
                    @click="submit()"
                    class="feedback-submit"
                    :disabled="!category || !description.trim() || sending"
                    :class="{ 'opacity-50 cursor-not-allowed': !category || !description.trim() || sending }"
                >
                    <span x-show="!sending">送信</span>
                    <span x-show="sending" class="flex items-center gap-1">
                        <svg class="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        送信中
                    </span>
                </button>
            </div>
        </template>
    </div>
</div>

<script nonce="<?= CspNonce::attr() ?>">
function feedbackWidget() {
    return {
        open: false,
        category: '',
        description: '',
        sending: false,
        sent: false,
        pageUrl: location.pathname + location.search,

        async submit() {
            if (!this.category || !this.description.trim() || this.sending) return;
            this.sending = true;

            try {
                const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
                const res = await fetch('/api/feedback.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        csrf_token: csrf,
                        category: this.category,
                        description: this.description.trim(),
                        url: location.pathname + location.search,
                        page_title: document.title,
                        viewport: window.innerWidth + 'x' + window.innerHeight,
                    })
                });
                const json = await res.json();

                if (json.ok) {
                    this.sent = true;
                    if (window.Toast) Toast.show('フィードバックを送信しました！', 'success');
                    setTimeout(() => {
                        this.open = false;
                        this.reset();
                    }, 2000);
                } else {
                    if (window.Toast) Toast.show(json.message || 'エラーが発生しました', 'error');
                }
            } catch (e) {
                if (window.Toast) Toast.show('通信エラーが発生しました', 'error');
            } finally {
                this.sending = false;
            }
        },

        reset() {
            this.category = '';
            this.description = '';
            this.sent = false;
        }
    };
}
</script>
