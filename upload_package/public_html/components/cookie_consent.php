<?php

/**
 * FB-41: Cookie Consent Banner
 * GDPR compliant cookie consent
 */
?>

<!-- Cookie Consent Banner -->
<div x-data="cookieConsent" x-show="showBanner" x-cloak
    x-transition:enter="transition ease-out duration-300 transform"
    x-transition:enter-start="opacity-0 translate-y-4"
    x-transition:enter-end="opacity-100 translate-y-0"
    x-transition:leave="transition ease-in duration-200 transform"
    x-transition:leave-start="opacity-100 translate-y-0"
    x-transition:leave-end="opacity-0 translate-y-4"
    class="fixed bottom-0 left-0 right-0 z-[9990] p-4 md:p-6">

    <div class="max-w-4xl mx-auto glass-card rounded-2xl border border-gray-200 p-6 shadow-2xl">
        <div class="flex flex-col md:flex-row items-start md:items-center gap-4">

            <div class="flex-1">
                <h3 class="font-bold text-gray-900 mb-1 flex items-center gap-2">
                    <i data-lucide="cookie" class="w-5 h-5 text-yellow-400"></i>
                    Cookieの使用について
                </h3>
                <p class="text-sm text-gray-400">
                    当サイトでは、サービス向上のためにCookieを使用しています。
                    <a href="privacy.php#cookie" class="text-[var(--color-primary)] hover:underline">詳細はこちら</a>
                </p>
            </div>

            <div class="flex gap-2 shrink-0 w-full md:w-auto">
                <button @click="acceptAll()"
                    class="flex-1 md:flex-none px-6 py-2.5 rounded-xl bg-[var(--color-primary)] text-black font-bold text-sm hover:bg-[var(--color-primary)]/80 transition">
                    すべて許可
                </button>
                <button @click="acceptEssential()"
                    class="flex-1 md:flex-none px-6 py-2.5 rounded-xl bg-gray-100 text-gray-900 font-bold text-sm hover:bg-gray-200 transition">
                    必須のみ
                </button>
            </div>

        </div>
    </div>
</div>

<script nonce="<?= CspNonce::attr() ?>">
    document.addEventListener('alpine:init', () => {
        Alpine.data('cookieConsent', () => ({
            showBanner: false,

            init() {
                // Check if consent already given
                const consent = localStorage.getItem('ikimon_cookie_consent');
                if (!consent) {
                    // Small delay before showing
                    setTimeout(() => {
                        this.showBanner = true;
                        lucide.createIcons();
                    }, 1000);
                }
            },

            acceptAll() {
                this.saveConsent({
                    essential: true,
                    analytics: true,
                    functional: true,
                    timestamp: new Date().toISOString()
                });
            },

            acceptEssential() {
                this.saveConsent({
                    essential: true,
                    analytics: false,
                    functional: false,
                    timestamp: new Date().toISOString()
                });
            },

            saveConsent(consent) {
                localStorage.setItem('ikimon_cookie_consent', JSON.stringify(consent));
                this.showBanner = false;

                // If analytics not accepted, disable GA (if exists)
                if (!consent.analytics && window.ga) {
                    window['ga-disable-UA-XXXXX-Y'] = true;
                }
            }
        }));
    });
</script>