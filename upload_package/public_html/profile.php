<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/BioUtils.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/BadgeManager.php';

Auth::init();
$user = Auth::user();

// Redirect if not logged in
if (!$user) {
    header('Location: login.php');
    exit;
}

$my_badges = BadgeManager::getUserBadges($user['id']);

$all_obs = DataStore::fetchAll('observations');

// Filter user's observations (Strict Mode)
$user_obs = array_filter($all_obs, function($o) use ($user) {
    return isset($o['user_id']) && (string)$o['user_id'] === (string)$user['id'];
});

// Calculate Life List (Unique Species)
$life_list = [];
foreach ($user_obs as $o) {
    if (isset($o['taxon']['key'])) {
        $life_list[$o['taxon']['key']] = $o['taxon'];
    }
}
?>
<!DOCTYPE html>
<html lang="ja">
<?php
$meta_title = $user['name'] . "のプロフィール";
$meta_description = $user['name'] . "さんのikimonでの活動記録とライフリストです。";
?>
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <!-- Custom CSS -->
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
</head>
<body class="js-loading bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">
    <?php include('components/nav.php'); ?>
    <script>document.body.classList.remove('js-loading');</script>

    <main class="max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-32 pb-32">
        
        <?php
        require_once __DIR__ . '/../libs/Gamification.php';
        // Recalculate stats on profile view for consistency
        $user = Gamification::syncUserStats($user['id']);
        ?>

        <!-- Profile Header -->
        <header class="flex flex-col md:flex-row items-center md:items-start gap-12 mb-20">
            <!-- Left: Avatar (Clickable for Menu) -->
            <div class="relative group" x-data="{ showMenu: false }">
                <div @click="showMenu = !showMenu" class="w-40 h-40 rounded-[var(--radius-lg)] overflow-hidden border-4 border-white/5 shadow-2xl cursor-pointer hover:border-white/20 transition active:scale-95 relative z-10">
                    <img src="<?php echo $user['avatar']; ?>" class="w-full h-full object-cover">
                    <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <i data-lucide="more-horizontal" class="text-white w-8 h-8 drop-shadow-md"></i>
                    </div>
                </div>
                
                <!-- Badges Row -->
                <div class="absolute -bottom-4 right-0 flex gap-1 justify-center w-full z-20 pointer-events-none">
                    <?php 
                    $displayed_badges = array_slice($user['badges'] ?? [], -3); // Show last 3
                    foreach ($displayed_badges as $bKey):
                        $badge = Gamification::getBadgeDetails($bKey);
                        if (!$badge) continue;
                    ?>
                    <div class="w-8 h-8 rounded-full bg-[var(--color-bg-base)] border border-<?php echo $badge['color']; ?> flex items-center justify-center text-xs shadow-lg" title="<?php echo $badge['name']; ?>">
                        <?php echo $badge['icon']; ?>
                    </div>
                    <?php endforeach; ?>
                </div>

                <!-- Dropdown Menu -->
                <div x-show="showMenu" @click.away="showMenu = false"
                     style="display: none;"
                     x-transition:enter="transition ease-out duration-200"
                     x-transition:enter-start="opacity-0 translate-y-2"
                     x-transition:enter-end="opacity-100 translate-y-0"
                     class="absolute top-full left-0 mt-4 w-48 bg-[var(--color-bg-surface)] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-30">
                     <a href="profile_edit.php" class="block w-full text-left px-4 py-3 text-white hover:bg-white/5 transition flex items-center gap-3">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                        Edit Profile
                     </a>
                     <div class="h-px bg-white/5 mx-2"></div>
                     <a href="logout.php" class="block w-full text-left px-4 py-3 text-red-500 hover:bg-red-500/10 transition flex items-center gap-3 font-bold">
                         <i data-lucide="log-out" class="w-4 h-4"></i>
                         Logout
                     </a>
                </div>
            </div>

            <!-- Right: User Info -->
            <div class="flex-1 text-center md:text-left">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <!-- Name & Rank -->
                    <div>
                        <h1 class="text-3xl md:text-4xl font-black tracking-tight mb-2 flex flex-col md:flex-row items-center md:items-end gap-3 justify-center md:justify-start">
                            <?php echo $user['name']; ?>
                            <span class="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-[var(--color-primary)] uppercase tracking-widest mb-1">
                                <?php echo $user['rank']; ?>
                            </span>
                        </h1>
                        <p class="text-gray-400 max-w-xl mx-auto md:mx-0 leading-relaxed">
                            <?php echo nl2br(htmlspecialchars($user['bio'] ?? 'まだ自己紹介がありません。')); ?>
                        </p>
                    </div>

                    <!-- Only Show Edit Button on Desktop if needed, or remove completely since it's in the menu now -->
                    <!-- Removing the standalone buttons as per user request "Iran yo" -->
                </div>
                
                <div class="flex flex-wrap justify-center md:justify-start gap-8 mt-8">
                    <div class="text-center">
                        <p class="text-4xl md:text-5xl font-heading font-black text-[var(--color-primary)] tracking-tight"><?php echo $user['post_count'] ?? 0; ?></p>
                        <p class="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mt-1">Observations</p>
                    </div>
                    <div class="text-center">
                        <p class="text-4xl md:text-5xl font-heading font-black text-white tracking-tight"><?php echo $user['species_count'] ?? 0; ?></p>
                        <p class="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mt-1">Species</p>
                    </div>
                    <div class="text-center">
                        <p class="text-4xl md:text-5xl font-heading font-black text-[var(--color-secondary)] tracking-tight"><?php echo $user['score']; ?></p>
                        <p class="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mt-1">Score</p>
                    </div>
                </div>
            </div>

        </header>

        <!-- Stats Grid & Tabs -->
        <div x-data="{ tab: 'observations' }">
            <div class="sticky top-20 z-30 bg-[var(--color-bg-base)]/95 backdrop-blur-md border-b border-white/5 mb-12 flex gap-12 pt-4">
                <button @click="tab = 'observations'; window.scrollTo({top: 0, behavior: 'smooth'})" class="pb-4 text-sm font-bold tracking-widest uppercase transition border-b-2" :class="tab === 'observations' ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-white'">Photos</button>
                <button @click="tab = 'lifelist'; window.scrollTo({top: 0, behavior: 'smooth'})" class="pb-4 text-sm font-bold tracking-widest uppercase transition border-b-2" :class="tab === 'lifelist' ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-white'">Life List</button>
                <button @click="tab = 'stats'; window.scrollTo({top: 0, behavior: 'smooth'})" class="pb-4 text-sm font-bold tracking-widest uppercase transition border-b-2" :class="tab === 'stats' ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-white'">Stats</button>
            </div>

            <!-- Observations Grid -->
            <div x-show="tab === 'observations'" x-transition>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    <?php if (empty($user_obs)): ?>
                    <p class="col-span-full py-20 text-center text-gray-500 font-bold">まだ観察がありません。投稿してみましょう！</p>
                    <?php else: ?>
                    <?php foreach (array_reverse($user_obs) as $obs): ?>
                    <a href="observation_detail.php?id=<?php echo $obs['id']; ?>" class="group block">
                        <div class="aspect-square rounded-2xl overflow-hidden mb-3 relative">
                            <img src="<?php echo $obs['photos'][0]; ?>" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
                            <div class="absolute inset-0 bg-black/20 group-hover:bg-transparent transition"></div>
                        </div>
                        <p class="text-xs font-bold leading-tight truncate"><?php echo $obs['taxon']['name'] ?? '種名募集中'; ?></p>
                        <p class="text-[10px] text-gray-500 uppercase mt-1"><?php echo date('M d, Y', strtotime($obs['observed_at'])); ?></p>
                    </a>
                    <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Life List (Placeholder for now) -->
            <!-- Life List (Dynamic) -->
            <div x-show="tab === 'lifelist'" x-transition>
                <?php
                // Group by taxonomy (simple grouping based on name for prototype)
                $kingdoms = [
                    'Plants' => ['count' => 0, 'icon' => 'leaf', 'color' => 'text-green-500', 'bg' => 'bg-green-500/10', 'match' => ['タンポポ', 'ドクダミ', 'オオバコ', 'ススキ', 'ヒメジョオン', 'シロツメクサ', 'ツユクサ', 'アジサイ', 'アサガオ', 'ヒマワリ']],
                    'Insects' => ['count' => 0, 'icon' => 'bug', 'color' => 'text-amber-500', 'bg' => 'bg-amber-500/10', 'match' => ['ゼミ', 'カブト', 'チョウ', 'トンボ', 'バッタ', 'テントウ']],
                    'Birds' => ['count' => 0, 'icon' => 'feather', 'color' => 'text-sky-500', 'bg' => 'bg-sky-500/10', 'match' => ['ガラス', 'スズメ', 'ヒヨドリ', 'ハト', 'ツバメ', 'カラ']],
                    'Fish' => ['count' => 0, 'icon' => 'waves', 'color' => 'text-blue-500', 'bg' => 'bg-blue-500/10', 'match' => ['コイ', 'フナ', 'メダカ', 'ナマズ', 'オイカワ']],
                    'Mammals' => ['count' => 0, 'icon' => 'paw-print', 'color' => 'text-orange-500', 'bg' => 'bg-orange-500/10', 'match' => ['タヌキ', 'アライグマ', 'ネコ', 'イタチ', 'ハクビシン']],
                    'Others' => ['count' => 0, 'icon' => 'help-circle', 'color' => 'text-gray-500', 'bg' => 'bg-gray-500/10', 'match' => []]
                ];

                $species_seen = [];
                
                foreach ($life_list as $taxon) {
                    $name = $taxon['name'];
                    // Simple text matching for categorization
                    $found = false;
                    foreach ($kingdoms as $k => $data) {
                        if ($k === 'Others') continue;
                        foreach ($data['match'] as $keyword) {
                            if (strpos($name, $keyword) !== false) {
                                $kingdoms[$k]['count']++;
                                $found = true;
                                break 2;
                            }
                        }
                    }
                    if (!$found) $kingdoms['Others']['count']++;
                }
                ?>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <?php foreach ($kingdoms as $name => $k): ?>
                    <?php if ($k['count'] > 0): ?>
                    <div class="glass-card p-5 md:p-8 rounded-3xl border-white/5 flex items-center gap-6">
                        <div class="w-20 h-20 rounded-2xl <?php echo $k['bg']; ?> flex items-center justify-center <?php echo $k['color']; ?>">
                            <i data-lucide="<?php echo $k['icon']; ?>" class="w-10 h-10"></i>
                        </div>
                        <div>
                            <p class="text-xs font-bold text-gray-400 uppercase mb-1">Taxonomy</p>
                            <h3 class="text-xl font-bold"><?php echo $name; ?></h3>
                            <p class="text-sm font-bold <?php echo htmlspecialchars(str_replace('text-', 'text-', $k['color'])); ?> mt-2 opacity-80"><?php echo $k['count']; ?> Species Observed</p>
                        </div>
                    </div>
                    <?php endif; ?>
                    <?php endforeach; ?>
                </div>
            </div>

            <!-- Stats (Charts placeholder) -->
            <div x-show="tab === 'stats'" x-transition>
                <div class="space-y-12">
                     <!-- Contribution Graph -->
                     <div class="glass-card p-5 md:p-8 rounded-3xl border-white/5">
                        <div class="flex items-center justify-between mb-8">
                            <h3 class="font-black text-lg">Activity Log</h3>
                             <div class="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                                 <!-- Badges (Dynamic) -->
                <div class="mt-4 flex flex-wrap gap-2 justify-center">
                    <?php 
                    $my_badges = [];
                    foreach ($user['badges'] ?? [] as $bKey) {
                        $badge = Gamification::getBadgeDetails($bKey);
                        if ($badge) {
                            $my_badges[] = $badge;
                        }
                    }
                    ?>
                    <?php foreach ($my_badges as $badge): ?>
                    <div class="px-3 py-1 rounded-full border flex items-center gap-1.5 <?php echo $badge['color']; ?>">
                        <i data-lucide="<?php echo $badge['icon']; ?>" class="w-3 h-3"></i>
                        <span class="text-xs font-bold"><?php echo $badge['name']; ?></span>
                    </div>
                    <?php endforeach; ?>
                    <?php if (empty($my_badges)): ?>
                    <div class="px-3 py-1 rounded-full border border-gray-700 bg-gray-800 text-gray-500 flex items-center gap-1.5">
                        <span class="text-xs font-bold">バッジなし</span>
                    </div>
                    <?php endif; ?>
                </div>        
                             </div>
                        </div>
                        
                        <?php
                        // Generate last 180 days data
                        $today = new DateTime();
                        $start = (clone $today)->modify('-180 days');
                        $activity_map = [];
                        foreach ($user_obs as $o) {
                            $d = date('Y-m-d', strtotime($o['observed_at']));
                            if (!isset($activity_map[$d])) $activity_map[$d] = 0;
                            $activity_map[$d]++;
                        }
                        
                        // Weeks grid
                        $weeks = [];
                        $current = clone $start;
                        $week = [];
                        
                        // Fill initial empty days to align Sunday
                        for ($i = 0; $i < $current->format('w'); $i++) {
                            $week[] = null;
                        }

                        while ($current <= $today) {
                            $week[] = [
                                'date' => $current->format('Y-m-d'),
                                'count' => $activity_map[$current->format('Y-m-d')] ?? 0
                            ];
                            $current->modify('+1 day');
                            
                            if (count($week) === 7) {
                                $weeks[] = $week;
                                $week = [];
                            }
                        }
                        if (!empty($week)) $weeks[] = $week; // Last week
                        ?>

                        <div class="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                            <?php foreach ($weeks as $w): ?>
                            <div class="flex flex-col gap-2">
                                <?php foreach ($w as $day): ?>
                                    <?php if ($day === null): ?>
                                        <div class="w-3 h-3"></div>
                                    <?php else: ?>
                                        <?php
                                        $c = $day['count'];
                                        $color = 'bg-white/5 border border-white/5';
                                        if ($c > 0) $color = 'bg-green-500/30 border-green-500/20';
                                        if ($c > 2) $color = 'bg-green-500/60 border-green-500/40';
                                        if ($c > 4) $color = 'bg-green-500 border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.4)]';
                                        ?>
                                        <div class="w-3 h-3 rounded-sm <?php echo $color; ?>" title="<?php echo $day['date'] . ': ' . $c . ' observations'; ?>"></div>
                                    <?php endif; ?>
                                <?php endforeach; ?>
                            </div>
                            <?php endforeach; ?>
                        </div>
                     </div>
                </div>
            </div>
        </div>
    </main>

    <script>
        lucide.createIcons();
    </script>
</body>
</html>
