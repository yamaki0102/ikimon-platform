<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/Lang.php';
require_once __DIR__ . '/../libs/CSRF.php';
Auth::init();
Lang::init();

$user = Auth::user();
$meta_title = 'お問い合わせ | ikimon';
$meta_description = 'ikimonへのご質問・ご要望・バグ報告・データ削除のリクエストはこちらから。';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>

<body class="bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">
    <?php include('components/nav.php'); ?>

    <main class="max-w-2xl mx-auto px-6 py-20 pb-32">
        <header class="mb-12 text-center">
            <span class="inline-block px-4 py-1 rounded-full bg-gray-100 border border-gray-200 text-[var(--color-primary)] text-xs font-bold uppercase tracking-widest mb-6">Contact</span>
            <h1 class="text-3xl md:text-5xl font-black mb-4">お問い合わせ</h1>
            <p class="text-gray-400 max-w-lg mx-auto leading-relaxed">
                ご質問・ご要望・バグ報告・データ削除のリクエストなど、お気軽にご連絡ください。
            </p>
        </header>

        <div x-data="contactForm()" class="space-y-6">
            <!-- Success message -->
            <div x-show="sent" x-cloak
                class="p-6 rounded-2xl bg-green-50 border border-green-200 text-center">
                <div class="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                    <i data-lucide="check-circle" class="w-6 h-6 text-green-600"></i>
                </div>
                <h3 class="font-bold text-lg text-green-800 mb-1">送信しました</h3>
                <p class="text-green-600 text-sm">お問い合わせありがとうございます。内容を確認次第、ご対応いたします。</p>
            </div>

            <!-- Form -->
            <form x-show="!sent" @submit.prevent="submit()" class="space-y-5">
                <!-- Category -->
                <div>
                    <label class="block text-sm font-semibold mb-2">カテゴリ <span class="text-red-400">*</span></label>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <template x-for="cat in categories" :key="cat.value">
                            <button type="button"
                                @click="category = cat.value"
                                :class="category === cat.value
                                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
                                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'"
                                class="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition">
                                <span x-text="cat.icon"></span>
                                <span x-text="cat.label"></span>
                            </button>
                        </template>
                    </div>
                </div>

                <!-- Email -->
                <div>
                    <label class="block text-sm font-semibold mb-2">メールアドレス <span class="text-gray-300 font-normal">（任意・返信が必要な場合）</span></label>
                    <input type="email" x-model="email"
                        placeholder="example@email.com"
                        class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition" />
                </div>

                <!-- Description -->
                <div>
                    <label class="block text-sm font-semibold mb-2">内容 <span class="text-red-400">*</span></label>
                    <textarea x-model="description" rows="6"
                        placeholder="お問い合わせ内容をご記入ください。&#10;&#10;データ削除をご希望の場合は、該当する記録のURLまたはIDをお書きください。"
                        class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition resize-y"
                        maxlength="2000"></textarea>
                    <div class="flex justify-between mt-1">
                        <span x-show="error" x-text="error" class="text-red-500 text-xs"></span>
                        <span class="text-gray-300 text-xs ml-auto" x-text="description.length + ' / 2000'"></span>
                    </div>
                </div>

                <!-- Submit -->
                <button type="submit"
                    :disabled="loading"
                    class="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--color-primary)] text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed">
                    <i data-lucide="send" class="w-4 h-4" x-show="!loading"></i>
                    <svg x-show="loading" x-cloak class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round" />
                    </svg>
                    <span x-text="loading ? '送信中...' : '送信する'"></span>
                </button>
            </form>
        </div>
    </main>

    <?php include('components/footer.php'); ?>

    <script nonce="<?= CspNonce::attr() ?>">
        function contactForm() {
            return {
                categories: [
                    { value: 'question', icon: '❓', label: '質問' },
                    { value: 'improvement', icon: '💡', label: '要望・提案' },
                    { value: 'bug', icon: '🐛', label: 'バグ報告' },
                    { value: 'deletion', icon: '🗑️', label: 'データ削除' },
                    { value: 'other', icon: '💬', label: 'その他' },
                ],
                category: 'question',
                email: '',
                description: '',
                error: '',
                loading: false,
                sent: false,

                async submit() {
                    this.error = '';
                    if (!this.description.trim()) {
                        this.error = '内容を入力してください';
                        return;
                    }
                    this.loading = true;
                    try {
                        const res = await fetch('/api/feedback.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                csrf_token: '<?= CSRF::token() ?>',
                                category: this.category,
                                description: this.description,
                                email: this.email,
                                url: location.href,
                                page_title: document.title,
                                viewport: `${innerWidth}x${innerHeight}`
                            })
                        });
                        const data = await res.json();
                        if (data.ok) {
                            this.sent = true;
                        } else {
                            this.error = data.message || '送信に失敗しました';
                        }
                    } catch (e) {
                        this.error = '通信エラーが発生しました。もう一度お試しください。';
                    } finally {
                        this.loading = false;
                    }
                }
            };
        }
    </script>
</body>

</html>
