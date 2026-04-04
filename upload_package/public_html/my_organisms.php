<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/BioUtils.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/RedListManager.php';

Auth::init();
$user = Auth::user();

// Redirect if not logged in
if (!$user) {
    header('Location: login.php');
    exit;
}

$rlManager = new RedListManager();
$all_obs = DataStore::fetchAll('observations');

// Filter user's observations
$user_obs = array_filter($all_obs, function ($o) use ($user) {
    return isset($o['user_id']) && (string)$o['user_id'] === (string)$user['id'];
});

// Calculate Life List (Unique Species) & Find Best Photos
$life_list = [];
foreach ($user_obs as $o) {
    if (isset($o['taxon']['key'])) {
        $key = $o['taxon']['key'];

        // If species already exists, check if this photo is better (or just newer if no rating)
        // For now, simple logic: prefer observation with photo
        if (!isset($life_list[$key]) || empty($life_list[$key]['photo'])) {
            $life_list[$key] = [
                'name' => $o['taxon']['name'],
                'photo' => $o['photos'][0] ?? null,
                'observed_at' => $o['observed_at'],
                'id' => $o['id'],
                'kingdom' => $o['taxon']['kingdom'] ?? 'Unknown', // Ideally should come from taxon data
            ];

            // Check Red List status
            $rlResult = $rlManager->lookup($o['taxon']['name']);
            if ($rlResult) {
                // Priority: National > Prefectural
                $nat = $rlResult['national'] ?? null;
                $pref = $rlResult['shizuoka'] ?? null;

                if ($nat && $nat['severity'] >= 1) {
                    $life_list[$key]['red_list'] = $nat;
                } elseif ($pref && $pref['severity'] >= 1) {
                    $life_list[$key]['red_list'] = $pref;
                }
            }
        }
    }
}

// Sort by Rarity (Severity DESC) then Date DESC
uasort($life_list, function ($a, $b) {
    $sevA = $a['red_list']['severity'] ?? 0;
    $sevB = $b['red_list']['severity'] ?? 0;

    if ($sevA !== $sevB) {
        return $sevB - $sevA;
    }
    return strtotime($b['observed_at']) - strtotime($a['observed_at']);
});

$count = count($life_list);
?>
<!DOCTYPE html>
<html lang="ja">
<?php
$meta_title = "My Organisms - デジタル標本箱";
$meta_description = "あなたが発見した生き物たちのコレクション";
?>

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
</head>

<body class="js-loading bg-base text-text font-body">
    <?php include('components/nav.php'); ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <main class="max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-24 pb-32">

        <!-- Header -->
        <header class="mb-12 text-center md:text-left">
            <a href="profile.php" class="inline-flex items-center gap-2 text-muted hover:text-primary transition mb-4 font-bold text-sm">
                <i data-lucide="arrow-left" class="w-4 h-4"></i>
                プロフィールに戻る
            </a>
            <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                <div>
                    <h1 class="text-3xl md:text-5xl font-black tracking-tight text-text mb-2">My Organisms</h1>
                    <p class="text-muted font-bold">デジタル標本箱 (<?php echo $count; ?>種)</p>
                </div>

                <!-- Filter Controls (Placeholder for JS implementation if needed later) -->
                <!-- Ideally implement Alpine.js filtering here -->
            </div>
        </header>

        <!-- Grid -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            <?php foreach ($life_list as $species): ?>
                <?php
                $isRare = isset($species['red_list']);
                $rarityColor = $isRare ? ($species['red_list']['category_color'] ?? '#666') : 'border-border';
                $glowClass = $isRare ? 'shadow-lg' : '';
                ?>
                <a href="observation_detail.php?id=<?php echo $species['id']; ?>" class="group relative block aspect-[4/5] rounded-2xl overflow-hidden bg-surface border-2 transition hover:-translate-y-1 hover:shadow-xl <?php echo $glowClass; ?>" style="border-color: <?php echo $isRare ? $rarityColor : 'var(--color-border)'; ?>">

                    <!-- Photo -->
                    <div class="absolute inset-0">
                        <?php if ($species['photo']): ?>
                            <img src="<?php echo htmlspecialchars($species['photo']); ?>" alt="<?php echo htmlspecialchars($species['name'] ?? '観察写真'); ?>" class="w-full h-full object-cover transition duration-700 group-hover:scale-110">
                        <?php else: ?>
                            <div class="w-full h-full flex items-center justify-center bg-base text-muted">
                                <i data-lucide="image" class="w-8 h-8 opacity-50"></i>
                            </div>
                        <?php endif; ?>
                        <!-- Gradient Overlay -->
                        <div class="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
                    </div>

                    <!-- Rarity Badge -->
                    <?php if ($isRare): ?>
                        <div class="absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-black text-white shadow-sm flex items-center gap-1" style="background-color: <?php echo $rarityColor; ?>">
                            <span class="text-[10px]"><?php echo $species['red_list']['list_id'] === 'national' ? '🇯🇵' : '🗻'; ?></span>
                            <?php echo $species['red_list']['category']; ?>
                        </div>
                    <?php endif; ?>

                    <!-- Info -->
                    <div class="absolute bottom-4 left-4 right-4 text-white">
                        <h3 class="font-bold text-lg leading-tight mb-1 truncate drop-shadow-md"><?php echo htmlspecialchars($species['name']); ?></h3>
                        <p class="text-xs opacity-80 font-mono"><?php echo date('Y.m.d', strtotime($species['observed_at'])); ?></p>
                    </div>
                </a>
            <?php endforeach; ?>
        </div>

        <?php if ($count === 0): ?>
            <div class="py-20 text-center">
                <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-surface border border-border mb-6">
                    <i data-lucide="box" class="w-10 h-10 text-muted"></i>
                </div>
                <h3 class="text-xl font-bold text-text mb-2">標本箱は空っぽです</h3>
                <p class="text-muted mb-8">観察を投稿して、あなただけのコレクションを作ろう！</p>
                <a href="post.php" class="btn btn-primary">
                    <i data-lucide="camera" class="w-5 h-5"></i>
                    投稿する
                </a>
            </div>
        <?php endif; ?>

    </main>
    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>

</html>
