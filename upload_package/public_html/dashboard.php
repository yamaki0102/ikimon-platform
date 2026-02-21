<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/QuestManager.php';
require_once __DIR__ . '/../libs/BioUtils.php';
require_once __DIR__ . '/../libs/Services/UserStatsService.php';
require_once __DIR__ . '/../libs/Services/LibraryService.php';

Auth::init();
$currentUser = Auth::user();

// Fetch Data (Stream Mode)
$latest_obs = DataStore::getLatest('observations', 5); // Just top 5 for the stream

// Bibliographic Authority Stats
$bibStats = [
    'citations' => count(glob(DataStore::getBasePath() . '/library/index/*.json')),
    'papers'    => count(glob(DataStore::getBasePath() . '/library/papers/*.json')),
    'keys'      => count(glob(DataStore::getBasePath() . '/library/keys/*.json')),
    'books'     => count(glob(DataStore::getBasePath() . '/library/references/*.json')),
];

// Stats Calculation
$userStats = [
    'rank' => 'ROOKIE',
    'score' => 0,
    'territory' => 0.0
];

if ($currentUser) {
    $userStats['score'] = $currentUser['score'] ?? 0;
    $userStats['rank'] = $currentUser['observer_rank']['rank']['name_ja'] ?? UserStatsService::calculateRank($userStats['score']);
    $userStats['territory'] = UserStatsService::getTerritoryArea($currentUser['id']);
    $userStats['observer_rank'] = $currentUser['observer_rank'] ?? null;
}
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <!-- Tactical Stylings -->
    <link href="assets/css/tactical.css" rel="stylesheet">
</head>

<body class="bg-[var(--color-bg-base)] text-gray-900 font-tactical overflow-hidden h-screen w-screen selection:bg-cyan-500/30">

    <!-- Layer 0: Radar & Ambience -->
    <?php include __DIR__ . '/components/bg_radar.php'; ?>

    <!-- Phase 3: Dopamine Widgets (Behavioral Reinforcement) -->
    <?php include __DIR__ . '/components/dopamine_widgets.php'; ?>

    <!-- Layer 1: HUD Interface -->
    <main id="hud-layer" class="relative z-10 w-full h-full pointer-events-none">

        <!-- Bottom Navigation (Nintendo Style: Rounded, Floating) -->
        <nav class="fixed bottom-6 left-6 right-6 h-16 bg-white/90 backdrop-blur-md rounded-full shadow-xl border border-gray-200 flex items-center justify-around z-50">
            <a href="index.php" class="flex flex-col items-center justify-center w-16 h-full text-gray-400 hover:text-emerald-600 transition" aria-label="Scope">
                <span class="material-symbols-outlined text-2xl">radar</span>
                <span class="text-[9px] font-bold tracking-widest mt-0.5">SCOPE</span>
            </a>

            <!-- Central Action: ID Camera (Prominent) -->
            <a href="id_wizard.php" class="flex flex-col items-center justify-center size-20 -mt-8 bg-gradient-to-tr from-emerald-500 to-cyan-500 rounded-full shadow-lg shadow-emerald-500/20 text-white hover:scale-110 transition border-4 border-white">
                <span class="material-symbols-outlined text-3xl">add_a_photo</span>
            </a>

            <a href="zukan.php" class="flex flex-col items-center justify-center w-16 h-full text-gray-400 hover:text-cyan-600 transition" aria-label="Collection">
                <span class="material-symbols-outlined text-2xl">auto_stories</span>
                <span class="text-[9px] font-bold tracking-widest mt-0.5">ZUKAN</span>
            </a>
        </nav>

        <!-- BR: Primary Action (Shutter) -->
        <div class="hud-corner-br pointer-events-auto">
            <div class="relative group">
                <!-- Rotating Ring -->
                <div class="absolute inset-0 border border-dashed border-cyan-300/40 rounded-full animate-[spin_10s_linear_infinite] group-hover:border-cyan-400 group-hover:animate-[spin_4s_linear_infinite]"></div>

                <button class="size-20 rounded-full bg-cyan-50 backdrop-blur-md border border-cyan-300 flex items-center justify-center text-cyan-500 hover:bg-cyan-500 hover:text-white hover:shadow-lg hover:shadow-cyan-500/30 transition duration-300 active:scale-95 group-active:scale-90 relative overflow-hidden">
                    <span class="material-symbols-outlined text-4xl relative z-10">filter_center_focus</span>
                    <div class="absolute inset-0 bg-gradient-to-t from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition"></div>
                </button>
                <div class="text-center mt-2">
                    <span class="text-[10px] text-cyan-400 tracking-[0.2em] group-hover:text-cyan-600 transition">CAPTURE</span>
                </div>
            </div>
        </div>

        <!-- Center: Reticle (Passive) -->
        <div class="hud-reticle opacity-15"></div>

        <!-- Bento Dashboard (Asymmetrical Grid) -->
        <div class="fixed top-24 bottom-24 left-4 right-4 md:left-24 md:right-24 z-20 overflow-hidden pointer-events-auto">
            <?php include __DIR__ . '/components/bento_grid.php'; ?>
        </div>

    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        // Clock
        setInterval(() => {
            const el = document.getElementById('clock-display');
            if (el) {
                const now = new Date();
                el.innerText = now.toLocaleTimeString('ja-JP', {
                    hour12: false
                });
            }
        }, 1000);
    </script>
</body>

</html>