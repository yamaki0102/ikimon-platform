<?php

/**
 * Meta Component - SEO & OGP handling (Design System v2)
 * Usage: $meta_title, $meta_description, $meta_image, $meta_canonical can be set before inclusion
 */
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Lang.php';
require_once __DIR__ . '/../../libs/CspNonce.php';
require_once __DIR__ . '/../../libs/CSRF.php';
require_once __DIR__ . '/../../libs/Asset.php';
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
<link rel="manifest" href="/manifest.php">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/img/apple-touch-icon.png">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
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
<script defer src="<?= htmlspecialchars(Asset::versioned('/js/SoundManager.js')) ?>"></script>
<script defer src="<?= htmlspecialchars(Asset::versioned('/js/HapticEngine.js')) ?>"></script>
<script defer src="<?= htmlspecialchars(Asset::versioned('/js/MotionEngine.js')) ?>"></script>
<script defer src="<?= htmlspecialchars(Asset::versioned('/js/OfflineManager.js')) ?>"></script>
<script defer src="<?= htmlspecialchars(Asset::versioned('/assets/js/analytics.js')) ?>"></script>

<!-- Critical FOUC Prevention (CSS遅延の保険) -->
<style>
    [x-cloak] {
        display: none !important
    }
</style>

<!-- Design System v2 CSS Stack -->
<link rel="stylesheet" href="<?= htmlspecialchars(Asset::versioned('/assets/css/tokens.css')) ?>">
<link rel="stylesheet" href="<?= htmlspecialchars(Asset::versioned('/assets/css/style.css')) ?>">
<link rel="stylesheet" href="<?= htmlspecialchars(Asset::versioned('/assets/css/skeleton.css')) ?>">
<link rel="stylesheet" href="<?= htmlspecialchars(Asset::versioned('/assets/css/input.css')) ?>">

<!-- Service Worker + PWA Install -->
<script nonce="<?= CspNonce::attr() ?>">
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.php', { updateViaCache: 'none' })
                .then(reg => {
                    reg.update();
                    console.log('SW registered:', reg.scope);
                })
                .catch(err => console.log('SW registration failed:', err));
        });
    }

    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        setTimeout(() => {
            const banner = document.getElementById('pwa-install-banner');
            if (banner) banner.style.display = 'flex';
        }, 30000);
    });

    function pwaInstall() {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(choice => {
            console.log('PWA install:', choice.outcome);
            deferredPrompt = null;
            const banner = document.getElementById('pwa-install-banner');
            if (banner) banner.style.display = 'none';
        });
    }

    function pwaDismiss() {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.style.display = 'none';
    }
</script>

<?php include __DIR__ . '/feedback_widget.php'; ?>
