<?php

/**
 * Admin Head Component
 * 
 * Usage:
 *   $adminTitle = 'Dashboard';
 *   include __DIR__ . '/components/head.php';
 */
require_once __DIR__ . '/../../../libs/CspNonce.php';
CspNonce::sendHeader();
$adminTitle = $adminTitle ?? 'Admin';
?>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?php echo htmlspecialchars($adminTitle); ?> — ikimon Admin</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Montserrat:wght@800&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@0.477.0/dist/umd/lucide.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.9/dist/cdn.min.js"></script>
<style>
    body {
        font-family: 'Inter', sans-serif;
        background: #0f172a;
        color: #f1f5f9;
    }

    .font-brand {
        font-family: 'Montserrat', sans-serif;
    }

    .glass-panel {
        background: rgba(30, 41, 59, 0.7);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.05);
    }
</style>

<!-- CSRF Token Auto-Injection for admin fetch() calls -->
<script nonce="<?= CspNonce::attr() ?>">
    (function() {
        const originalFetch = window.fetch;
        const UNSAFE_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

        function getCsrfToken() {
            const m = document.cookie.match(/(?:^|;\s*)ikimon_csrf=([a-f0-9]{64})/);
            return m ? m[1] : '';
        }

        window.fetch = function(input, init) {
            init = init || {};
            const method = (init.method || 'GET').toUpperCase();

            if (UNSAFE_METHODS.includes(method)) {
                const token = getCsrfToken();
                if (token) {
                    if (init.headers instanceof Headers) {
                        if (!init.headers.has('X-Csrf-Token')) {
                            init.headers.set('X-Csrf-Token', token);
                        }
                    } else if (typeof init.headers === 'object' && init.headers !== null) {
                        if (!init.headers['X-Csrf-Token']) {
                            init.headers['X-Csrf-Token'] = token;
                        }
                    } else {
                        init.headers = {
                            'X-Csrf-Token': token
                        };
                    }
                }
            }

            return originalFetch.call(this, input, init);
        };
    })();
</script>