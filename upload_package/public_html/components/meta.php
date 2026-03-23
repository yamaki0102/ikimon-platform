<?php

/**
 * Meta Component - SEO & OGP handling (Design System v2)
 * Usage: $meta_title, $meta_description, $meta_image, $meta_canonical can be set before inclusion
 */
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Lang.php';
require_once __DIR__ . '/../../libs/CspNonce.php';
require_once __DIR__ . '/../../libs/CSRF.php';
Lang::init();

// Send CSP header with nonce (before any output)
CspNonce::sendHeader();

// Use translations for defaults
$default_title = __('meta_title');
$default_desc = "ikimonは、" . __('descriptor') . "です。";
$default_image = BASE_URL . "/assets/img/ogp_default.png";

$title = !empty($meta_title) ? $meta_title . " | ikimon" : $default_title;
$desc = !empty($meta_description) ? $meta_description : $default_desc;
$image = !empty($meta_image) ? $meta_image : $default_image;
$url = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://$_SERVER[HTTP_HOST]$_SERVER[REQUEST_URI]";
$canonical = !empty($meta_canonical) ? $meta_canonical : $url;

?>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="csrf-token" content="<?= CSRF::generate() ?>">
<meta name="color-scheme" content="light only">
<?php if (defined('NOINDEX_SITE') && NOINDEX_SITE): ?>
    <meta name="robots" content="noindex, nofollow, noarchive">
<?php endif; ?>

<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-NCL0M1VJZ2"></script>
<script nonce="<?= CspNonce::attr() ?>">
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-NCL0M1VJZ2');
</script>

<!-- Primary Meta Tags -->
<title><?php echo htmlspecialchars($title); ?></title>
<meta name="title" content="<?php echo htmlspecialchars($title); ?>">
<meta name="description" content="<?php echo htmlspecialchars($desc); ?>">

<!-- PWA Meta Tags (Design System v2) -->
<meta name="theme-color" content="#10b981">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="ikimon">
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/img/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="/assets/img/icon-192.png">

<!-- Open Graph / Facebook -->
<meta property="og:type" content="website">
<meta property="og:url" content="<?php echo htmlspecialchars($url); ?>">
<meta property="og:title" content="<?php echo htmlspecialchars($title); ?>">
<meta property="og:description" content="<?php echo htmlspecialchars($desc); ?>">
<meta property="og:image" content="<?php echo htmlspecialchars($image); ?>">

<!-- Twitter -->
<meta property="twitter:card" content="summary_large_image">
<meta property="twitter:url" content="<?php echo htmlspecialchars($url); ?>">
<meta property="twitter:title" content="<?php echo htmlspecialchars($title); ?>">
<meta property="twitter:description" content="<?php echo htmlspecialchars($desc); ?>">
<meta property="twitter:image" content="<?php echo htmlspecialchars($image); ?>">

<!-- Canonical -->
<link rel="canonical" href="<?php echo htmlspecialchars($canonical); ?>">

<!-- Preconnect Hints -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
<link rel="dns-prefetch" href="https://cdn.tailwindcss.com">
<link rel="dns-prefetch" href="https://unpkg.com">
<link rel="dns-prefetch" href="https://tile.openstreetmap.jp">

<!-- Fonts (Design System v2: Inter + Montserrat + Noto Sans JP) -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@700;900&family=Noto+Sans+JP:wght@400;500;700;900&family=Zen+Kaku+Gothic+New:wght@300;400;500;700;900&display=swap" rel="stylesheet">
<!-- Material Symbols (used in dashboard, profile, id_wizard, bento_grid) -->
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet">

<!-- External Libraries -->
<script src="https://cdn.tailwindcss.com"></script>
<script nonce="<?= CspNonce::attr() ?>">
    tailwind.config = {
        theme: {
            extend: {
                colors: {
                    primary: 'var(--color-primary)',
                    'primary-dark': 'var(--color-primary-dark)',
                    'primary-light': 'var(--color-primary-light)',
                    secondary: 'var(--color-secondary)',
                    accent: 'var(--color-accent)',
                    warning: 'var(--color-warning)',
                    danger: 'var(--color-danger)',
                    surface: 'var(--color-bg-surface)',
                    elevated: 'var(--color-bg-elevated)',
                    base: 'var(--color-bg-base)',
                    text: 'var(--color-text)',
                    muted: 'var(--color-text-muted)',
                    faint: 'var(--color-text-faint)',
                    'text-secondary': 'var(--color-text-secondary)',
                    'primary-surface': 'var(--color-primary-surface)',
                    'secondary-surface': 'var(--color-secondary-surface)',
                    'accent-surface': 'var(--color-accent-surface)',
                    'primary-glow': 'var(--color-primary-glow)',
                    'warning-surface': 'var(--color-warning-surface)',
                    'danger-surface': 'var(--color-danger-surface)',
                    border: 'var(--color-border)',
                    'border-strong': 'var(--color-border-strong)',
                },
                fontFamily: {
                    heading: ['"Montserrat"', '"Zen Kaku Gothic New"', 'sans-serif'],
                    body: ['"Inter"', '"Noto Sans JP"', 'sans-serif'],
                },
                borderRadius: {
                    DEFAULT: '1rem',
                    md: 'var(--radius-md)',
                    lg: 'var(--radius-lg)',
                    xl: 'var(--radius-xl)',
                    full: '9999px',
                }
            }
        }
    }
</script>
<script src="https://unpkg.com/lucide@0.477.0"></script>
<script nonce="<?= CspNonce::attr() ?>">
    // Lucide Icons: 一元初期化（全ページ共通）
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });
    // Alpine.js等の動的DOM変更にも対応
    if (typeof MutationObserver !== 'undefined') {
        let _lucideTimer;
        new MutationObserver(function() {
            clearTimeout(_lucideTimer);
            _lucideTimer = setTimeout(function() {
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }, 80);
        }).observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }
</script>
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.9/dist/cdn.min.js"></script>

<!-- Tezawari Engines -->
<script defer src="/js/SoundManager.js"></script>
<script defer src="/js/HapticEngine.js"></script>
<script defer src="/js/MotionEngine.js"></script>
<script defer src="/js/OfflineManager.js?v=2.2"></script>
<script defer src="/assets/js/VoiceGuide.js?v=3"></script>
<script defer src="/assets/js/analytics.js"></script>

<!-- Critical FOUC Prevention (CSS遅延の保険) -->
<style>
    [x-cloak] {
        display: none !important
    }
</style>

<!-- Design System v2 CSS Stack -->
<link rel="stylesheet" href="/assets/css/tokens.css?v=2.2">
<link rel="stylesheet" href="/assets/css/style.css?v=2.2">
<link rel="stylesheet" href="/assets/css/skeleton.css?v=2.2">
<link rel="stylesheet" href="/assets/css/input.css?v=2.2">

<!-- Service Worker: Force migration to v13 -->
<script nonce="<?= CspNonce::attr() ?>">
    (function(){
        // One-time cache nuke: unregister old SW, clear all caches, reload
        var REQUIRED_SW = 'v13';
        if ('serviceWorker' in navigator && !sessionStorage.getItem('sw_migrated_' + REQUIRED_SW)) {
            navigator.serviceWorker.getRegistrations().then(function(regs) {
                var hadOldSW = false;
                regs.forEach(function(r) {
                    if (r.active && r.active.scriptURL && r.active.scriptURL.indexOf('v=' + REQUIRED_SW) === -1) {
                        hadOldSW = true;
                        r.unregister();
                        console.log('[SW Migration] Unregistered old SW:', r.active.scriptURL);
                    }
                });
                if (hadOldSW) {
                    caches.keys().then(function(keys) {
                        return Promise.all(keys.map(function(k) { return caches.delete(k); }));
                    }).then(function() {
                        sessionStorage.setItem('sw_migrated_' + REQUIRED_SW, '1');
                        console.log('[SW Migration] Caches cleared, reloading...');
                        location.reload(true);
                    });
                } else {
                    sessionStorage.setItem('sw_migrated_' + REQUIRED_SW, '1');
                }
            });
        }
    })();
</script>
<!-- Service Worker + PWA Install -->
<script nonce="<?= CspNonce::attr() ?>">
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('controllerchange', function() {
            if (!window.__swReloading) {
                window.__swReloading = true;
                location.reload();
            }
        });
        window.addEventListener('load', function() {
            navigator.serviceWorker.register('sw.js?v=13')
                .then(function(reg) {
                    console.log('SW registered:', reg.scope);
                    reg.update();
                })
                .catch(function(err) { console.log('SW reg failed:', err); });
        });
    }

    let deferredPrompt = null;
    let pwaMode = 'chromium';

    const pwaUtil = {
        isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
        isAndroid: /Android/.test(navigator.userAgent),
        isSafari: /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS/.test(navigator.userAgent),
        isStandalone: window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true,
        dismissed: sessionStorage.getItem('pwa-dismissed') === '1'
    };

    function showPwaBanner(mode) {
        if (pwaUtil.isStandalone || pwaUtil.dismissed) return;
        const banner = document.getElementById('pwa-install-banner');
        const desc = document.getElementById('pwa-install-desc');
        const btn = document.getElementById('pwa-install-btn');
        if (!banner) return;

        pwaMode = mode;
        if (mode === 'ios') {
            desc.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline -mt-0.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> をタップ →「ホーム画面に追加」';
            btn.textContent = 'OK';
        } else if (mode === 'desktop') {
            desc.textContent = 'ブラウザのアドレスバーからインストールできます';
            btn.textContent = 'OK';
        }
        banner.style.display = 'flex';
    }

    function pwaDismiss() {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.style.display = 'none';
        sessionStorage.setItem('pwa-dismissed', '1');
    }

    function pwaInstall() {
        if (pwaMode !== 'chromium' || !deferredPrompt) {
            pwaDismiss();
            return;
        }
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function(choice) {
            console.log('PWA install:', choice.outcome);
            deferredPrompt = null;
            pwaDismiss();
        });
    }

    document.addEventListener('DOMContentLoaded', function() {
        var dismissBtn = document.getElementById('pwa-dismiss-btn');
        var installBtn = document.getElementById('pwa-install-btn');
        if (dismissBtn) dismissBtn.addEventListener('click', pwaDismiss);
        if (installBtn) installBtn.addEventListener('click', pwaInstall);
    });

    window.addEventListener('beforeinstallprompt', function(e) {
        e.preventDefault();
        deferredPrompt = e;
        setTimeout(function() { showPwaBanner('chromium'); }, 30000);
    });

    window.addEventListener('appinstalled', function() {
        deferredPrompt = null;
        pwaDismiss();
    });

    if (!pwaUtil.isStandalone && !pwaUtil.dismissed) {
        if (pwaUtil.isIOS && pwaUtil.isSafari) {
            setTimeout(function() { showPwaBanner('ios'); }, 60000);
        } else if (!pwaUtil.isAndroid && !pwaUtil.isIOS) {
            setTimeout(function() {
                if (!deferredPrompt) showPwaBanner('desktop');
            }, 60000);
        }
    }
</script>
