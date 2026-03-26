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
<style>
.cc-wrap{position:fixed;right:18px;bottom:18px;z-index:9990;padding:0;pointer-events:none;max-width:min(420px,calc(100vw - 24px))}
.cc-wrap.is-hidden{display:none}
.cc-card{max-width:100%;margin:0;background:rgba(255,255,255,.98);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid rgba(15,23,42,.08);border-radius:22px;box-shadow:0 20px 48px rgba(15,23,42,.16);padding:16px 16px 14px;pointer-events:auto}
.cc-row{display:flex;flex-direction:column;gap:14px}
.cc-copy{flex:1;min-width:0}
.cc-title{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:900;color:#163126;margin:0 0 6px}
.cc-icon{width:32px;height:32px;border-radius:9999px;background:rgba(16,185,129,.12);display:inline-flex;align-items:center;justify-content:center;font-size:15px;flex:none}
.cc-text{font-size:12px;line-height:1.7;color:#5b6b63;margin:0}
.cc-text a{color:#059669;font-weight:700;text-decoration:none}
.cc-text a:hover{text-decoration:underline}
.cc-actions{display:grid;grid-template-columns:1fr 1fr auto;align-items:center;gap:8px;flex:none}
.cc-btn{appearance:none;border:none;cursor:pointer;border-radius:9999px;font-size:12px;font-weight:800;line-height:1;padding:11px 14px;min-height:42px;transition:transform .15s ease,background .15s ease,color .15s ease,border-color .15s ease;white-space:nowrap}
.cc-btn:hover{transform:translateY(-1px)}
.cc-btn-primary{background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#fff;box-shadow:0 10px 24px rgba(16,185,129,.22)}
.cc-btn-secondary{background:#fff;color:#334155;border:1px solid rgba(15,23,42,.1)}
.cc-btn-secondary:hover{background:#f8faf9}
.cc-close{appearance:none;border:none;background:transparent;color:#94a3b8;cursor:pointer;width:40px;height:40px;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;transition:background .15s ease,color .15s ease}
.cc-close:hover{background:rgba(15,23,42,.05);color:#334155}
@media (max-width:767px){
  .cc-wrap{left:12px;right:12px;bottom:12px;max-width:none}
  .cc-card{padding:16px}
  .cc-actions{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;width:100%}
  .cc-btn{width:100%;justify-content:center}
}
</style>

<div id="cookie-consent" class="cc-wrap is-hidden" role="dialog" aria-live="polite" aria-label="Cookieの設定">
    <div class="cc-card">
        <div class="cc-row">
            <div class="cc-copy">
                <h3 class="cc-title">
                    <span class="cc-icon" aria-hidden="true">🍪</span>
                    Cookieの使用について
                </h3>
                <p class="cc-text">
                    ikimon では、ログイン状態の維持や安全なフォーム送信、使いやすさの改善のために Cookie を使っています。
                    <a href="<?= $_fBase ?>/privacy.php#cookie">詳しい内容を見る</a>
                </p>
            </div>
            <div class="cc-actions">
                <button type="button" class="cc-btn cc-btn-primary" data-cookie-action="accept-all">すべて許可</button>
                <button type="button" class="cc-btn cc-btn-secondary" data-cookie-action="accept-essential">必須のみ</button>
                <button type="button" class="cc-close" data-cookie-action="close" aria-label="閉じる">×</button>
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
        root.classList.remove('is-hidden');
    }

    function hideBanner() {
        root.classList.add('is-hidden');
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
