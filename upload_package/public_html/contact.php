<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/Lang.php';
require_once __DIR__ . '/../libs/CSRF.php';
Auth::init();
Lang::init();

$user = Auth::user();
$documentLang = method_exists('Lang', 'current') ? Lang::current() : 'ja';
$meta_title = __('contact_page.meta_title', 'Contact | ikimon');
$meta_description = __('contact_page.meta_description', 'Questions, partnership requests, bug reports, and deletion requests for ikimon.');
$contactText = [
    'eyebrow' => __('contact_page.eyebrow', 'Contact'),
    'title' => __('contact_page.title', 'Contact'),
    'lead' => __('contact_page.lead', 'Questions, partnership requests, pilot discussions, bug reports, and deletion requests are all welcome. We usually reply within 1 to 3 business days.'),
    'common_uses' => __('contact_page.common_uses', 'Common reasons to reach out'),
    'reply_title' => __('contact_page.reply_title', 'About replies'),
    'reply_body' => __('contact_page.reply_body', 'We usually get back to you within 1 to 3 business days. If it is urgent, mention that in your message.'),
    'reply_note' => __('contact_page.reply_note', 'For implementation or pilot discussions, sharing your background and goals upfront helps us respond more clearly.'),
    'success_title' => __('contact_page.success_title', 'Sent'),
    'success_body' => __('contact_page.success_body', 'Thanks for reaching out. If you left an email address, we will usually reply within 1 to 3 business days.'),
    'success_reset' => __('contact_page.success_reset', 'Send another message'),
    'category_label' => __('contact_page.category_label', 'Category'),
    'name_label' => __('contact_page.name_label', 'Name'),
    'organization_label' => __('contact_page.organization_label', 'Organization'),
    'organization_optional' => __('contact_page.organization_optional', '(Optional)'),
    'email_label' => __('contact_page.email_label', 'Email address'),
    'email_optional' => __('contact_page.email_optional', '(Optional if you need a reply)'),
    'email_required_hint' => __('contact_page.email_required_hint', 'This category needs an email address so we can reply.'),
    'message_label' => __('contact_page.message_label', 'Message'),
    'submit_idle' => __('contact_page.submit_idle', 'Send'),
    'submit_loading' => __('contact_page.submit_loading', 'Sending...'),
    'privacy_note' => __('contact_page.privacy_note', 'By sending this form, you agree to the privacy policy.'),
    'info_partnership_title' => __('contact_page.info_partnership_title', 'Partnership and pilot discussions'),
    'info_partnership_body' => __('contact_page.info_partnership_body', 'For municipalities, companies, and research teams exploring collaboration or field use.'),
    'info_bug_title' => __('contact_page.info_bug_title', 'Bug reports'),
    'info_bug_body' => __('contact_page.info_bug_body', 'For broken pages, display issues, and behavior that does not work as expected.'),
    'info_deletion_title' => __('contact_page.info_deletion_title', 'Data deletion'),
    'info_deletion_body' => __('contact_page.info_deletion_body', 'For requests to remove observation records or account information.'),
    'info_feature_title' => __('contact_page.info_feature_title', 'Feature requests'),
    'info_feature_body' => __('contact_page.info_feature_body', 'For ideas, suggestions, and workflow improvements you want to see.'),
    'info_media_title' => __('contact_page.info_media_title', 'Media and interviews'),
    'info_media_body' => __('contact_page.info_media_body', 'For coverage requests, interviews, speaking inquiries, and related outreach.'),
];
$contactCategories = [
    ['value' => 'question', 'icon' => '❓', 'label' => __('contact_page.cat_question', 'Question'), 'desc' => __('contact_page.cat_question_desc', 'How to use it / feature questions')],
    ['value' => 'partnership', 'icon' => '🤝', 'label' => __('contact_page.cat_partnership', 'Partnership'), 'desc' => __('contact_page.cat_partnership_desc', 'Municipality / company / research team')],
    ['value' => 'improvement', 'icon' => '💡', 'label' => __('contact_page.cat_improvement', 'Improvement'), 'desc' => __('contact_page.cat_improvement_desc', 'Ideas and suggestions')],
    ['value' => 'bug', 'icon' => '🐛', 'label' => __('contact_page.cat_bug', 'Bug report'), 'desc' => __('contact_page.cat_bug_desc', 'Errors or broken behavior')],
    ['value' => 'deletion', 'icon' => '🗑️', 'label' => __('contact_page.cat_deletion', 'Data deletion'), 'desc' => __('contact_page.cat_deletion_desc', 'Observation or account removal')],
    ['value' => 'media', 'icon' => '📰', 'label' => __('contact_page.cat_media', 'Media'), 'desc' => __('contact_page.cat_media_desc', 'Coverage and speaking requests')],
    ['value' => 'other', 'icon' => '💬', 'label' => __('contact_page.cat_other', 'Other'), 'desc' => __('contact_page.cat_other_desc', 'Anything else')],
];
$contactPlaceholders = [
    'name' => __('contact_page.placeholder_name', 'Taro Yamada'),
    'organization' => __('contact_page.placeholder_organization', 'City office / Company name'),
];
$contactJsText = [
    'placeholders' => [
        'question' => __('contact_page.js_question', "Tell us your question as specifically as you can.\n\nExample: I am not sure how to use feature X. On page Y, after I did Z..."),
        'partnership' => __('contact_page.js_partnership', "Tell us the background of your project and how you hope to use ikimon.\n\nExample: Our city is exploring data use for X and would like to discuss a pilot project."),
        'improvement' => __('contact_page.js_improvement', "Tell us what would make this better.\n\nExample: If feature X could also do Y, it would be easier to use."),
        'bug' => __('contact_page.js_bug', "Tell us what happened and how to reproduce it.\n\nExample: On iPhone Safari, button X does not appear on page Y.\nSteps: 1. Sign in -> 2. Open post page -> 3. ..."),
        'deletion' => __('contact_page.js_deletion', "Share the record URL or ID you want removed.\n\nExample: https://ikimon.life/observation_detail.php?id=obs_xxxxx"),
        'media' => __('contact_page.js_media', "Tell us about the coverage or speaking request.\n\nExample: outlet name, publication date, topic, preferred interview dates."),
        'other' => __('contact_page.js_other', 'Write your message here.'),
    ],
    'errors' => [
        'name_required' => __('contact_page.error_name_required', 'Please enter your name.'),
        'description_required' => __('contact_page.error_description_required', 'Please enter your message.'),
        'description_length' => __('contact_page.error_description_length', 'Please keep it within 2000 characters.'),
        'email_required' => __('contact_page.error_email_required', 'This category requires an email address.'),
        'email_invalid' => __('contact_page.error_email_invalid', 'Please enter a valid email address.'),
        'submit_failed' => __('contact_page.error_submit_failed', 'Could not send your message. Please try again.'),
        'network_failed' => __('contact_page.error_network_failed', 'A network error occurred. Please try again.'),
    ],
];
?>
<!DOCTYPE html>
<html lang="<?= htmlspecialchars($documentLang, ENT_QUOTES, 'UTF-8') ?>">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <style>
        .contact-card {
            background: var(--md-surface-container);
            backdrop-filter: blur(12px);
            border: 1px solid var(--md-outline-variant);
            border-radius: var(--shape-xl);
            box-shadow: var(--elev-1);
        }
        .cat-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 14px;
            border-radius: 14px;
            border: 1.5px solid var(--md-outline-variant);
            background: var(--md-surface-container-low);
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            color: var(--md-on-surface-variant);
            transition: all .18s;
            text-align: left;
        }
        .cat-btn:hover { border-color: #9ca3af; color: #374151; }
        .cat-btn.active {
            border-color: var(--md-primary);
            background: var(--md-primary-container);
            color: var(--md-primary);
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
            border: 1.5px solid var(--md-outline-variant);
            background: var(--md-surface-container-low);
            font-size: 14px;
            color: var(--md-on-surface);
            transition: border-color .18s, box-shadow .18s;
            outline: none;
            font-family: inherit;
        }
        .form-input:focus {
            border-color: var(--md-primary);
            box-shadow: 0 0 0 3px var(--md-primary-container);
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

<body class="font-body" style="background:var(--md-surface);color:var(--md-on-surface);">
    <?php include('components/nav.php'); ?>

    <main class="max-w-5xl mx-auto px-4 sm:px-6 py-16 pb-32">

        <!-- Header -->
        <header class="text-center mb-14">
            <span class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-100 border border-gray-200 text-xs font-bold uppercase tracking-widest text-gray-500 mb-6">
                <i data-lucide="mail" class="w-3 h-3"></i>
                <?= htmlspecialchars($contactText['eyebrow']) ?>
            </span>
            <h1 class="text-3xl md:text-4xl font-black mb-4 tracking-tight"><?= htmlspecialchars($contactText['title']) ?></h1>
            <p class="text-gray-400 max-w-xl mx-auto text-sm leading-relaxed">
                <?= nl2br(htmlspecialchars($contactText['lead']), false) ?>
            </p>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">

            <!-- Left: Info panel -->
            <aside class="lg:col-span-2 space-y-5">
                <div class="contact-card p-6">
                    <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4"><?= htmlspecialchars($contactText['common_uses']) ?></p>
                    <div>
                        <div class="info-item">
                            <div class="info-icon"><i data-lucide="building-2" class="w-4 h-4 text-emerald-600"></i></div>
                            <div>
                                <p class="text-sm font-bold text-gray-800"><?= htmlspecialchars($contactText['info_partnership_title']) ?></p>
                                <p class="text-xs text-gray-400 mt-0.5 leading-relaxed"><?= htmlspecialchars($contactText['info_partnership_body']) ?></p>
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-icon"><i data-lucide="bug" class="w-4 h-4 text-red-500"></i></div>
                            <div>
                                <p class="text-sm font-bold text-gray-800"><?= htmlspecialchars($contactText['info_bug_title']) ?></p>
                                <p class="text-xs text-gray-400 mt-0.5 leading-relaxed"><?= htmlspecialchars($contactText['info_bug_body']) ?></p>
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-icon"><i data-lucide="trash-2" class="w-4 h-4 text-orange-500"></i></div>
                            <div>
                                <p class="text-sm font-bold text-gray-800"><?= htmlspecialchars($contactText['info_deletion_title']) ?></p>
                                <p class="text-xs text-gray-400 mt-0.5 leading-relaxed"><?= htmlspecialchars($contactText['info_deletion_body']) ?></p>
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-icon"><i data-lucide="lightbulb" class="w-4 h-4 text-yellow-500"></i></div>
                            <div>
                                <p class="text-sm font-bold text-gray-800"><?= htmlspecialchars($contactText['info_feature_title']) ?></p>
                                <p class="text-xs text-gray-400 mt-0.5 leading-relaxed"><?= htmlspecialchars($contactText['info_feature_body']) ?></p>
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-icon"><i data-lucide="newspaper" class="w-4 h-4 text-blue-500"></i></div>
                            <div>
                                <p class="text-sm font-bold text-gray-800"><?= htmlspecialchars($contactText['info_media_title']) ?></p>
                                <p class="text-xs text-gray-400 mt-0.5 leading-relaxed"><?= htmlspecialchars($contactText['info_media_body']) ?></p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="contact-card p-6">
                    <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3"><?= htmlspecialchars($contactText['reply_title']) ?></p>
                    <p class="text-sm text-gray-500 leading-relaxed">
                        <?= htmlspecialchars($contactText['reply_body']) ?>
                    </p>
                    <p class="text-xs text-gray-400 mt-3 leading-relaxed">
                        <?= htmlspecialchars($contactText['reply_note']) ?>
                    </p>
                </div>
            </aside>

            <!-- Right: Form -->
            <div class="lg:col-span-3">
                <div class="contact-card p-6 sm:p-8" x-data="contactForm()">

                    <!-- Success state -->
                    <div x-show="sent" class="text-center py-8">
                        <div class="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                            <i data-lucide="check-circle-2" class="w-8 h-8 text-emerald-500"></i>
                        </div>
                        <h3 class="text-xl font-black mb-2"><?= htmlspecialchars($contactText['success_title']) ?></h3>
                        <p class="text-gray-400 text-sm leading-relaxed mb-6">
                            <?= nl2br(htmlspecialchars($contactText['success_body']), false) ?>
                        </p>
                        <button @click="reset()" class="px-6 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-50 transition">
                            <?= htmlspecialchars($contactText['success_reset']) ?>
                        </button>
                    </div>

                    <!-- Form -->
                    <form x-show="!sent" @submit.prevent="submit()" class="space-y-6" novalidate>

                        <!-- Category -->
                        <div>
                            <label class="form-label"><?= htmlspecialchars($contactText['category_label']) ?> <span class="req">*</span></label>
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
                                <label class="form-label"><?= htmlspecialchars($contactText['name_label']) ?> <span class="req">*</span></label>
                                <input type="text" x-model="name"
                                    placeholder="<?= htmlspecialchars($contactPlaceholders['name']) ?>"
                                    :class="fieldErrors.name ? 'error' : ''"
                                    class="form-input">
                                <p x-show="fieldErrors.name" class="text-red-400 text-xs mt-1" x-text="fieldErrors.name"></p>
                            </div>
                            <div>
                                <label class="form-label"><?= htmlspecialchars($contactText['organization_label']) ?> <span class="opt"><?= htmlspecialchars($contactText['organization_optional']) ?></span></label>
                                <input type="text" x-model="organization"
                                    placeholder="<?= htmlspecialchars($contactPlaceholders['organization']) ?>"
                                    class="form-input">
                            </div>
                        </div>

                        <!-- Email -->
                        <div>
                            <label class="form-label">
                                <?= htmlspecialchars($contactText['email_label']) ?>
                                <span x-show="needsReply" class="req">*</span>
                                <span x-show="!needsReply" class="opt"><?= htmlspecialchars($contactText['email_optional']) ?></span>
                            </label>
                            <input type="email" x-model="email"
                                placeholder="example@email.com"
                                :class="fieldErrors.email ? 'error' : ''"
                                class="form-input">
                            <p x-show="fieldErrors.email" class="text-red-400 text-xs mt-1" x-text="fieldErrors.email"></p>
                            <p x-show="needsReply && !email" class="text-amber-500 text-xs mt-1">
                                <i data-lucide="alert-circle" class="w-3 h-3 inline" style="pointer-events:none"></i>
                                <?= htmlspecialchars($contactText['email_required_hint']) ?>
                            </p>
                        </div>

                        <!-- Message -->
                        <div>
                            <label class="form-label"><?= htmlspecialchars($contactText['message_label']) ?> <span class="req">*</span></label>
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
                        <div x-show="globalError"
                            class="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                            <i data-lucide="alert-circle" class="w-4 h-4 flex-shrink-0" style="pointer-events:none"></i>
                            <span x-text="globalError"></span>
                        </div>

                        <!-- Submit -->
                        <button type="submit"
                            :disabled="loading"
                            class="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                            style="background: var(--color-primary, #10b981);">
                            <svg x-show="loading" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round" />
                            </svg>
                            <i data-lucide="send" class="w-4 h-4" x-show="!loading" style="pointer-events:none"></i>
                            <span x-text="loading ? '<?= addslashes($contactText['submit_loading']) ?>' : '<?= addslashes($contactText['submit_idle']) ?>'"></span>
                        </button>

                        <p class="text-xs text-gray-300 text-center">
                            <?= htmlspecialchars($contactText['privacy_note']) ?> <a href="/privacy.php" class="underline hover:text-gray-400"><?= htmlspecialchars(__('footer.privacy', 'Privacy Policy')) ?></a>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    </main>

    <?php include('components/footer.php'); ?>

    <script nonce="<?= CspNonce::attr() ?>">
        function contactForm() {
            const placeholders = <?= json_encode($contactJsText['placeholders'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
            const errors = <?= json_encode($contactJsText['errors'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
            const categories = <?= json_encode($contactCategories, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;

            return {
                categories,

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
                        this.fieldErrors.name = errors.name_required;
                        ok = false;
                    }

                    if (!this.description.trim()) {
                        this.fieldErrors.description = errors.description_required;
                        ok = false;
                    } else if (this.description.length > 2000) {
                        this.fieldErrors.description = errors.description_length;
                        ok = false;
                    }

                    if (this.needsReply && !this.email.trim()) {
                        this.fieldErrors.email = errors.email_required;
                        ok = false;
                    }

                    if (this.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
                        this.fieldErrors.email = errors.email_invalid;
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
                                csrf_token:   '<?= htmlspecialchars(CSRF::generate(), ENT_QUOTES, 'UTF-8') ?>',
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
                            this.globalError = data.message || errors.submit_failed;
                        }
                    } catch (e) {
                        this.globalError = errors.network_failed;
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
