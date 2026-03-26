<?php
require_once __DIR__ . '/../../libs/Auth.php';
Auth::init();

$newBadges = $_SESSION['new_badges'] ?? [];
if (!empty($newBadges)) {
    // Clear badges from session so they don't show again
    unset($_SESSION['new_badges']);
}
?>

<?php if (!empty($newBadges)): ?>
    <div id="badge-modal" class="fixed inset-0 z-50 flex items-center justify-center px-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" onclick="closeBadgeModal()"></div>

        <!-- Modal Content -->
        <div class="relative w-full max-w-sm bg-gray-900/90 border border-teal-500/50 rounded-2xl p-6 shadow-[0_0_30px_rgba(20,184,166,0.3)] overflow-hidden animate-bounce-in">

            <!-- Decorative Background Elements -->
            <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-teal-500 to-transparent"></div>
            <div class="absolute -top-10 -right-10 w-32 h-32 bg-teal-500/20 rounded-full blur-2xl"></div>
            <div class="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl"></div>

            <div class="relative text-center">
                <div class="inline-block mb-4">
                    <span class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-teal-900 to-gray-800 border-2 border-teal-400 shadow-lg text-4xl animate-pulse-slow">
                        <?= htmlspecialchars($newBadges[0]['icon']) ?>
                    </span>
                </div>

                <h2 class="text-2xl font-bold text-white mb-1 tracking-wider drop-shadow-md">
                    LEVEL UP!
                </h2>
                <p class="text-teal-400 text-sm font-medium mb-4 uppercase tracking-widest">New Badge Unlocked</p>

                <div class="bg-gray-800/50 rounded-xl p-4 border border-white/10 mb-6">
                    <h3 class="text-lg font-bold text-teal-200 mb-1">
                        <?= htmlspecialchars($newBadges[0]['name_ja'] ?? $newBadges[0]['name']) ?>
                    </h3>
                    <p class="text-gray-300 text-sm leading-relaxed">
                        <?= htmlspecialchars($newBadges[0]['description_ja'] ?? $newBadges[0]['description']) ?>
                    </p>
                </div>

                <button onclick="closeBadgeModal()" class="w-full py-3 px-6 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-bold rounded-xl shadow-lg shadow-teal-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98]">
                    Awesome!
                </button>
            </div>

            <!-- Confetti Canvas (Optional, CSS-only fallback included) -->
            <div class="absolute inset-0 pointer-events-none overflow-hidden" id="confetti-container"></div>
        </div>
    </div>

    <style>
        @keyframes bounce-in {
            0% {
                opacity: 0;
                transform: scale(0.8) translateY(20px);
            }

            100% {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }

        .animate-bounce-in {
            animation: bounce-in 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        .animate-pulse-slow {
            animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
    </style>

    <script nonce="<?= CspNonce::attr() ?>">
        function closeBadgeModal() {
            const modal = document.getElementById('badge-modal');
            modal.style.opacity = '0';
            modal.style.transition = 'opacity 0.3s ease';
            setTimeout(() => modal.remove(), 300);
        }

        // Simple JS Confetti effect
        (function() {
            const colors = ['#14b8a6', '#a855f7', '#fbbf24', '#ffffff'];
            const container = document.getElementById('confetti-container');

            for (let i = 0; i < 30; i++) {
                const conf = document.createElement('div');
                conf.style.position = 'absolute';
                conf.style.width = Math.random() * 6 + 4 + 'px';
                conf.style.height = Math.random() * 6 + 4 + 'px';
                conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                conf.style.left = Math.random() * 100 + '%';
                conf.style.top = -10 + '%';
                conf.style.opacity = Math.random();
                conf.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';

                const duration = Math.random() * 2 + 2;
                const delay = Math.random() * 0.5;

                conf.style.animation = `fall ${duration}s linear ${delay}s forwards`;
                container.appendChild(conf);
            }

            const style = document.createElement('style');
            style.innerHTML = `
        @keyframes fall {
            to { transform: translateY(400px) rotate(720deg); opacity: 0; }
        }
    `;
            document.head.appendChild(style);
        })();
    </script>
<?php endif; ?>