<?php
/**
 * Meta Component - SEO & OGP handling
 * Usage: $meta_title, $meta_description, $meta_image can be set before inclusion
 */
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Lang.php';
Lang::init();

// Use translations for defaults
$default_title = __('meta_title');
$default_desc = "ikimonは、" . __('descriptor') . "です。";
$default_image = BASE_URL . "/assets/img/ogp_default.png";

$title = (isset($meta_title) && $meta_title) ? $meta_title . " | ikimon" : $default_title;
$desc = (isset($meta_description) && $meta_description) ? $meta_description : $default_desc;
$image = (isset($meta_image) && $meta_image) ? $meta_image : $default_image;
$url = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://$_SERVER[HTTP_HOST]$_SERVER[REQUEST_URI]";

?>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<?php if (defined('NOINDEX_SITE') && NOINDEX_SITE): ?>
<meta name="robots" content="noindex, nofollow, noarchive">
<?php endif; ?>

<!-- Primary Meta Tags -->
<title><?php echo htmlspecialchars($title); ?></title>
<meta name="title" content="<?php echo htmlspecialchars($title); ?>">
<meta name="description" content="<?php echo htmlspecialchars($desc); ?>">

<!-- FB-20: PWA Meta Tags -->
<meta name="theme-color" content="#020405">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ikimon">
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="assets/img/icon-192.png">

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
<link rel="canonical" href="<?php echo htmlspecialchars($url); ?>">

<!-- External Libraries (Shared) -->
<script src="https://cdn.tailwindcss.com"></script>
<script>
    tailwind.config = {
        theme: {
            extend: {
                colors: {
                    primary: 'var(--color-primary)',
                    secondary: 'var(--color-secondary)',
                    accent: 'var(--color-accent)',
                    surface: 'var(--color-bg-surface)',
                    base: 'var(--color-bg-base)',
                    muted: 'var(--color-text-muted)',
                },
                fontFamily: {
                    heading: ['"Zen Kaku Gothic New"', 'sans-serif'],
                    body: ['"Noto Sans JP"', 'sans-serif'],
                    mono: ['"Fira Code"', 'monospace'],
                }
            }
        }
    }
</script>
<script src="https://unpkg.com/lucide@latest"></script>
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>

<!-- Tezawari Engines -->
<script defer src="js/SoundManager.js"></script>
<script defer src="js/HapticEngine.js"></script>
<script defer src="js/MotionEngine.js"></script>
<script defer src="js/OfflineManager.js"></script>




<!-- Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&family=Noto+Sans+JP:wght@400;500;700;900&family=Zen+Kaku+Gothic+New:wght@300;400;500;700;900&display=swap" rel="stylesheet">

<!-- Custom CSS -->
<link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
<link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">

<!-- FB-20: Service Worker Registration -->
<script>
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.log('SW registration failed:', err));
    });
}
</script>

