<?php
/**
 * Shared Cookie Consent Banner
 *
 * Self-contained:
 * - No Tailwind dependency
 * - No Alpine dependency
 * - Works from any subdirectory via $_fBase
 */
?>
<div id="cookie-consent"
     class="hidden fixed right-[18px] bottom-[18px] z-[9990] pointer-events-none
            max-w-[min(420px,calc(100vw-24px))]
            max-md:left-3 max-md:right-3 max-md:bottom-3 max-md:max-w-none"
     role="dialog" aria-live="polite" aria-label="<?= htmlspecialchars(__('cookie.banner_aria', 'Cookie settings')) ?>">
    <div class="pointer-events-auto bg-white/98 backdrop-blur-[18px]
                border border-black/[0.08] rounded-[22px]
                shadow-[0_20px_48px_rgba(15,23,42,0.16)]
                p-4 pb-3.5">
        <div class="flex flex-col gap-3.5">
            <!-- Text -->
            <div>
                <h3 class="flex items-center gap-2.5 text-[15px] font-black text-[#163126] mb-1.5">
                    <span class="w-8 h-8 rounded-full bg-primary-surface inline-flex items-center justify-center text-[15px] flex-none" aria-hidden="true">🍪</span>
                    <?= htmlspecialchars(__('cookie.title', 'About cookies')) ?>
                </h3>
                <p class="text-xs leading-relaxed text-[#5b6b63] m-0">
                    <?= htmlspecialchars(__('cookie.body', 'ikimon uses cookies to keep you signed in, submit forms safely, and improve usability.')) ?>
                    <a href="<?= $_fBase ?>/privacy.php#cookie"
                       class="text-primary-dark font-bold no-underline hover:underline"><?= htmlspecialchars(__('cookie.learn_more', 'See details')) ?></a>
                </p>
            </div>
            <!-- Actions -->
            <div class="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                <button type="button"
                        data-cookie-action="accept-all"
                        class="appearance-none border-none cursor-pointer rounded-full text-xs font-extrabold px-3.5 py-[11px] min-h-[42px]
                               bg-gradient-to-br from-primary to-primary-dark text-white
                               shadow-[0_10px_24px_rgba(16,185,129,0.22)]
                               hover:-translate-y-px transition-transform duration-150"
                        style="text-wrap: balance;">
                    <?= htmlspecialchars(__('cookie.accept_all', 'Allow all')) ?>
                </button>
                <button type="button"
                        data-cookie-action="accept-essential"
                        class="appearance-none cursor-pointer rounded-full text-xs font-extrabold px-3.5 py-[11px] min-h-[42px]
                               bg-white text-slate-700 border border-black/10
                               hover:bg-surface hover:-translate-y-px transition-all duration-150"
                        style="text-wrap: balance;">
                    <?= htmlspecialchars(__('cookie.accept_essential', 'Essential only')) ?>
                </button>
                <button type="button"
                        data-cookie-action="close"
                        aria-label="<?= htmlspecialchars(__('nav.close', 'Close')) ?>"
                        class="appearance-none border-none bg-transparent text-slate-400 cursor-pointer
                               w-10 h-10 rounded-full inline-flex items-center justify-center
                               hover:bg-black/5 hover:text-slate-600 transition-all duration-150">
                    ×
                </button>
            </div>
        </div>
    </div>
</div>

<script nonce="<?= CspNonce::attr() ?>">
(function() {
    var root = document.getElementById('cookie-consent');
    if (!root) return;

    var STORAGE_KEY = 'ikimon_cookie_consent';

    function getConsent() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        } catch (e) {
            return null;
        }
    }

    function saveConsent(consent) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
        hideBanner();
        if (!consent.analytics && window.ga) {
            window['ga-disable-UA-XXXXX-Y'] = true;
        }
    }

    function showBanner() {
        root.classList.remove('hidden');
    }

    function hideBanner() {
        root.classList.add('hidden');
    }

    root.addEventListener('click', function(event) {
        var button = event.target.closest('[data-cookie-action]');
        if (!button) return;
        var action = button.getAttribute('data-cookie-action');
        if (action === 'accept-all') {
            saveConsent({
                essential: true,
                analytics: true,
                functional: true,
                timestamp: new Date().toISOString()
            });
            return;
        }
        if (action === 'accept-essential') {
            saveConsent({
                essential: true,
                analytics: false,
                functional: false,
                timestamp: new Date().toISOString()
            });
            return;
        }
        if (action === 'close') {
            hideBanner();
        }
    });

    if (!getConsent()) {
        window.setTimeout(showBanner, 700);
    }
})();
</script>
