<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/Lang.php';
require_once __DIR__ . '/../libs/CSRF.php';
Auth::init();
Lang::init();

$user = Auth::user();
$meta_title = 'お問い合わせ | ikimon';
$meta_description = 'ikimonへのご質問・導入相談・共同実証・バグ報告・データ削除のリクエストはこちらから。';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <style>
        .contact-card {
            background: rgba(255,255,255,.85);
            backdrop-filter: blur(12px);
            border: 1px solid var(--color-border, #e5e7eb);
            border-radius: 24px;
            box-shadow: 0 8px 40px rgba(15,23,42,.06);
        }
        .cat-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 14px;
            border-radius: 14px;
            border: 1.5px solid #e5e7eb;
            background: #fff;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            color: #6b7280;
            transition: all .18s;
            text-align: left;
        }
        .cat-btn:hover { border-color: #9ca3af; color: #374151; }
        .cat-btn.active {
            border-color: var(--color-primary, #10b981);
            background: color-mix(in srgb, var(--color-primary, #10b981) 8%, white);
            color: var(--color-primary, #10b981);
        }
        .cat-btn .cat-desc {
            display: block;
            font-size: 11px;
            font-weight: 400;
            color: #9ca3af;
            margin-top: 1px;
            line-height: 1.4;
        }
        .cat-btn.active .cat-desc { color: color-mix(in srgb, var(--color-primary, #10b981) 70%, #555); }
        .form-input {
            width: 100%;
            padding: 12px 16px;
            border-radius: 12px;
            border: 1.5px solid #e5e7eb;
            background: #fff;
            font-size: 14px;
            color: #111827;
            transition: border-color .18s, box-shadow .18s;
            outline: none;
            font-family: inherit;
        }
        .form-input:focus {
            border-color: var(--color-primary, #10b981);
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary, #10b981) 15%, transparent);
        }
        .form-input.error { border-color: #f87171; }
        .form-label {
            display: block;
            font-size: 13px;
            font-weight: 700;
            color: #374151;
            margin-bottom: 8px;
        }
        .form-label .req { color: #f87171; margin-left: 2px; }
        .form-label .opt { color: #9ca3af; font-weight: 400; font-size: 12px; margin-left: 4px; }
        .info-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 12px 0;
            border-bottom: 1px solid #f3f4f6;
        }
        .info-item:last-child { border-bottom: none; }
        .info-icon {
            width: 32px;
            height: 32px;
            border-radius: 10px;
            background: color-mix(in srgb, var(--color-primary, #10b981) 10%, white);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
    </style>
</head>

<body class="bg-base text-text font-body">
    <?php include('components/nav.php'); ?>

    <main class="max-w-5xl mx-auto px-4 sm:px-6 py-16 pb-32">

        <!-- Header -->
        <header class="text-center mb-14">
            <span class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-100 border border-gray-200 text-xs font-bold uppercase tracking-widest text-gray-500 mb-6">
                <i data-lucide="mail" class="w-3 h-3"></i>
                Contact
            </span>
            <h1 class="text-3xl md:text-4xl font-black mb-4 tracking-tight">お問い合わせ</h1>
            <p class="text-gray-400 max-w-xl mx-auto text-sm leading-relaxed">
                ご質問・導入相談・共同実証・バグ報告・データ削除リクエストなど、<br class="hidden sm:block">
                お気軽にご連絡ください。通常 1〜3 営業日以内にご返信します。
            </p>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">

            <!-- Left: Info panel -->
            <aside class="lg:col-span-2 space-y-5">
                <div class="contact-card p-6">
                    <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">よくある用途</p>
                    <div>
                        <div class="info-item">
                            <div class="info-icon"><i data-lucide="building-2" class="w-4 h-4 text-emerald-600"></i></div>
                            <div>
                                <p class="text-sm font-bold text-gray-800">導入・連携相談</p>
                                <p class="text-xs text-gray-400 mt-0.5 leading-relaxed">自治体・企業・研究機関からの活用・共同実証のご相談</p>
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-icon"><i data-lucide="bug" class="w-4 h-4 text-red-500"></i></div>
                            <div>
                                <p class="text-sm font-bold text-gray-800">バグ報告</p>
                                <p class="text-xs text-gray-400 mt-0.5 leading-relaxed">ページのエラー・表示崩れ・動作不具合のご報告</p>
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-icon"><i data-lucide="trash-2" class="w-4 h-4 text-orange-500"></i></div>
                            <div>
                                <p class="text-sm font-bold text-gray-800">データ削除</p>
                                <p class="text-xs text-gray-400 mt-0.5 leading-relaxed">観察記録・アカウント情報の削除リクエスト</p>
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-icon"><i data-lucide="lightbulb" class="w-4 h-4 text-yellow-500"></i></div>
                            <div>
                                <p class="text-sm font-bold text-gray-800">機能要望</p>
                                <p class="text-xs text-gray-400 mt-0.5 leading-relaxed">「こんな機能があったら」というアイデア・提案</p>
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-icon"><i data-lucide="newspaper" class="w-4 h-4 text-blue-500"></i></div>
                            <div>
                                <p class="text-sm font-bold text-gray-800">取材・メディア</p>
                                <p class="text-xs text-gray-400 mt-0.5 leading-relaxed">メディア掲載・インタビュー・講演のご依頼</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="contact-card p-6">
                    <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">返信について</p>
                    <p class="text-sm text-gray-500 leading-relaxed">
                        通常 <span class="font-bold text-gray-700">1〜3 営業日</span>以内にご連絡します。
                        急ぎの場合はその旨をお書きください。
                    </p>
                    <p class="text-xs text-gray-400 mt-3 leading-relaxed">
                        導入相談・共同実証の場合は、より詳細なご要件をお聞かせいただけると
                        スムーズにご対応できます。
                    </p>
                </div>
            </aside>

            <!-- Right: Form -->
            <div class="lg:col-span-3">
                <div class="contact-card p-6 sm:p-8" x-data="contactForm()">

                    <!-- Success state -->
                    <div x-show="sent" x-cloak style="display:none" class="text-center py-8">
                        <div class="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                            <i data-lucide="check-circle-2" class="w-8 h-8 text-emerald-500"></i>
                        </div>
                        <h3 class="text-xl font-black mb-2">送信しました</h3>
                        <p class="text-gray-400 text-sm leading-relaxed mb-6">
                            お問い合わせありがとうございます。<br>
                            メールアドレスをご記入いただいた場合は、1〜3 営業日以内にご返信します。
                        </p>
                        <button @click="reset()" class="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-50 transition">
                            別の件を送る
                        </button>
                    </div>

                    <!-- Form -->
                    <form x-show="!sent" style="display:block" @submit.prevent="submit()" class="space-y-6" novalidate>

                        <!-- Category -->
                        <div>
                            <label class="form-label">お問い合わせ種別 <span class="req">*</span></label>
                            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                <template x-for="cat in categories" :key="cat.value">
                                    <button type="button"
                                        @click="category = cat.value"
                                        :class="category === cat.value ? 'active' : ''"
                                        class="cat-btn flex-col items-start">
                                        <span class="flex items-center gap-1.5">
                                            <span x-text="cat.icon"></span>
                                            <span x-text="cat.label" class="font-bold text-[13px]"></span>
                                        </span>
                                        <span class="cat-desc" x-text="cat.desc"></span>
                                    </button>
                                </template>
                            </div>
                        </div>

                        <!-- Name + Org row -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="form-label">お名前 <span class="req">*</span></label>
                                <input type="text" x-model="name"
                                    placeholder="山木 太郎"
                                    :class="fieldErrors.name ? 'error' : ''"
                                    class="form-input">
                                <p x-show="fieldErrors.name" class="text-red-400 text-xs mt-1" x-text="fieldErrors.name"></p>
                            </div>
                            <div>
                                <label class="form-label">所属・組織 <span class="opt">（任意）</span></label>
                                <input type="text" x-model="organization"
                                    placeholder="〇〇市役所 / 株式会社〇〇"
                                    class="form-input">
                            </div>
                        </div>

                        <!-- Email -->
                        <div>
                            <label class="form-label">
                                メールアドレス
                                <span x-show="needsReply" class="req">*</span>
                                <span x-show="!needsReply" class="opt">（任意・返信が必要な場合）</span>
                            </label>
                            <input type="email" x-model="email"
                                placeholder="example@email.com"
                                :class="fieldErrors.email ? 'error' : ''"
                                class="form-input">
                            <p x-show="fieldErrors.email" class="text-red-400 text-xs mt-1" x-text="fieldErrors.email"></p>
                            <p x-show="needsReply && !email" class="text-amber-500 text-xs mt-1">
                                <i data-lucide="alert-circle" class="w-3 h-3 inline" style="pointer-events:none"></i>
                                このカテゴリは返信が必要なため、メールアドレスを入力してください
                            </p>
                        </div>

                        <!-- Message -->
                        <div>
                            <label class="form-label">お問い合わせ内容 <span class="req">*</span></label>
                            <textarea x-model="description"
                                :placeholder="currentPlaceholder"
                                rows="6"
                                :class="fieldErrors.description ? 'error' : ''"
                                class="form-input resize-y"
                                maxlength="2000"
                                style="min-height:140px"></textarea>
                            <div class="flex justify-between items-center mt-1">
                                <p x-show="fieldErrors.description" class="text-red-400 text-xs" x-text="fieldErrors.description"></p>
                                <span class="text-gray-300 text-xs ml-auto"
                                    :class="description.length > 1800 ? 'text-amber-400' : ''"
                                    x-text="description.length + ' / 2000'"></span>
                            </div>
                        </div>

                        <!-- Global error -->
                        <div x-show="globalError" x-cloak style="display:none"
                            class="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                            <i data-lucide="alert-circle" class="w-4 h-4 flex-shrink-0" style="pointer-events:none"></i>
                            <span x-text="globalError"></span>
                        </div>

                        <!-- Submit -->
                        <button type="submit"
                            :disabled="loading"
                            class="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                            style="background: var(--color-primary, #10b981);">
                            <svg x-show="loading" x-cloak style="display:none" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round" />
                            </svg>
                            <i data-lucide="send" class="w-4 h-4" x-show="!loading" style="pointer-events:none"></i>
                            <span x-text="loading ? '送信中...' : '送信する'"></span>
                        </button>

                        <p class="text-xs text-gray-300 text-center">
                            送信することで<a href="/privacy.php" class="underline hover:text-gray-400">プライバシーポリシー</a>に同意したものとみなされます
                        </p>
                    </form>
                </div>
            </div>
        </div>
    </main>

    <?php include('components/footer.php'); ?>

    <script nonce="<?= CspNonce::attr() ?>">
        function contactForm() {
            const placeholders = {
                question:    'ご質問の内容をできるだけ具体的にお書きください。\n\n例）〇〇の機能の使い方がわかりません。△△ページで操作したところ…',
                partnership: '導入・連携をご検討の背景や、ご希望の活用方法をお聞かせください。\n\n例）当市では〇〇の目的でデータ活用を検討しています。御社との共同実証について詳しく聞きたいです。',
                improvement: 'ご要望・ご提案の内容をお書きください。\n\n例）〇〇機能で△△ができると、もっと使いやすくなると思います。',
                bug:         '発生した問題の内容と再現手順をお書きください。\n\n例）iPhone Safari で〇〇ページを開くと、△△ボタンが表示されない。\n手順: 1. ログイン → 2. 投稿ページへ → 3. …',
                deletion:    '削除をご希望の記録の URL または ID をお書きください。\n\n例）https://ikimon.life/observation_detail.php?id=obs_xxxxx',
                media:       '取材・講演のご依頼内容をお書きください。\n\n例）媒体名、公開予定日、テーマ、インタビュー希望日程など',
                other:       'お問い合わせ内容をご記入ください。',
            };

            return {
                categories: [
                    { value: 'question',    icon: '❓', label: '質問',      desc: '使い方・機能について' },
                    { value: 'partnership', icon: '🤝', label: '導入・連携', desc: '自治体・企業・研究機関' },
                    { value: 'improvement', icon: '💡', label: '要望・提案', desc: 'アイデア・改善提案' },
                    { value: 'bug',         icon: '🐛', label: 'バグ報告',  desc: 'エラー・動作不具合' },
                    { value: 'deletion',    icon: '🗑️', label: 'データ削除', desc: '記録・アカウント削除' },
                    { value: 'media',       icon: '📰', label: '取材・メディア', desc: '掲載・講演のご依頼' },
                    { value: 'other',       icon: '💬', label: 'その他',    desc: 'その他のお問い合わせ' },
                ],

                category: 'question',
                name: '<?= htmlspecialchars($user['display_name'] ?? '', ENT_QUOTES, 'UTF-8') ?>',
                organization: '',
                email: '<?= htmlspecialchars($user['email'] ?? '', ENT_QUOTES, 'UTF-8') ?>',
                description: '',
                loading: false,
                sent: false,
                fieldErrors: {},
                globalError: '',

                get needsReply() {
                    return ['partnership', 'deletion', 'media'].includes(this.category);
                },

                get currentPlaceholder() {
                    return placeholders[this.category] || placeholders.other;
                },

                validate() {
                    this.fieldErrors = {};
                    let ok = true;

                    if (!this.name.trim()) {
                        this.fieldErrors.name = 'お名前を入力してください';
                        ok = false;
                    }

                    if (!this.description.trim()) {
                        this.fieldErrors.description = 'お問い合わせ内容を入力してください';
                        ok = false;
                    } else if (this.description.length > 2000) {
                        this.fieldErrors.description = '2000文字以内でお入力ください';
                        ok = false;
                    }

                    if (this.needsReply && !this.email.trim()) {
                        this.fieldErrors.email = 'このカテゴリはメールアドレスが必要です';
                        ok = false;
                    }

                    if (this.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
                        this.fieldErrors.email = '有効なメールアドレスを入力してください';
                        ok = false;
                    }

                    return ok;
                },

                async submit() {
                    this.globalError = '';
                    if (!this.validate()) return;

                    this.loading = true;
                    try {
                        const res = await fetch('/api/feedback.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                csrf_token:   '<?= CSRF::token() ?>',
                                category:     this.category,
                                description:  this.description,
                                name:         this.name,
                                organization: this.organization,
                                email:        this.email,
                                url:          location.href,
                                page_title:   document.title,
                                viewport:     `${innerWidth}x${innerHeight}`
                            })
                        });
                        const data = await res.json();
                        if (data.ok) {
                            this.sent = true;
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        } else {
                            this.globalError = data.message || '送信に失敗しました。もう一度お試しください。';
                        }
                    } catch (e) {
                        this.globalError = '通信エラーが発生しました。もう一度お試しください。';
                    } finally {
                        this.loading = false;
                    }
                },

                reset() {
                    this.sent = false;
                    this.description = '';
                    this.organization = '';
                    this.category = 'question';
                    this.fieldErrors = {};
                    this.globalError = '';
                }
            };
        }
    </script>
</body>

</html>
