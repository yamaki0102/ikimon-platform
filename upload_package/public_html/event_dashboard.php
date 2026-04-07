<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
Auth::init();
$currentUser = Auth::user();

$eventId = trim($_GET['event_id'] ?? '');
if (!$eventId) {
    header('Location: events.php');
    exit;
}

// Load event info
$events = DataStore::get('events') ?: [];
$event = null;
foreach ($events as $e) {
    if (($e['id'] ?? '') === $eventId) {
        $event = $e;
        break;
    }
}
$eventName = $event['name'] ?? '観察会';
$eventDate = $event['date'] ?? '';
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php
    $meta_title = htmlspecialchars($eventName) . " ダッシュボード — ikimon.life";
    $meta_description = "観察会「" . htmlspecialchars($eventName) . "」の記録一覧と成果サマリー";
    include __DIR__ . '/components/meta.php';
    ?>
</head>
<body class="font-body" style="background:var(--md-surface);color:var(--md-on-surface);">
    <?php include('components/nav.php'); ?>

    <main class="max-w-2xl mx-auto px-4 pt-20 pb-32" x-data="eventDashboard()" x-init="load()">
        <!-- Header -->
        <div class="mb-6">
            <a href="events.php" class="text-xs text-primary font-bold flex items-center gap-1 mb-2">
                <i data-lucide="arrow-left" class="w-3 h-3"></i> 観察会一覧に戻る
            </a>
            <h1 class="text-xl font-black text-text"><?php echo htmlspecialchars($eventName); ?></h1>
            <?php if ($eventDate): ?>
                <p class="text-sm text-muted mt-1"><?php echo htmlspecialchars($eventDate); ?></p>
            <?php endif; ?>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-3 gap-3 mb-6">
            <div class="bg-surface border border-border rounded-2xl p-4 text-center">
                <div class="text-2xl font-black text-primary font-heading" x-text="data.total_observations || 0"></div>
                <div class="text-[10px] text-muted font-bold">記録数</div>
            </div>
            <div class="bg-surface border border-border rounded-2xl p-4 text-center">
                <div class="text-2xl font-black text-secondary font-heading" x-text="data.total_species || 0"></div>
                <div class="text-[10px] text-muted font-bold">種数</div>
            </div>
            <div class="bg-surface border border-border rounded-2xl p-4 text-center">
                <div class="text-2xl font-black text-accent font-heading" x-text="data.total_participants || 0"></div>
                <div class="text-[10px] text-muted font-bold">参加者</div>
            </div>
        </div>

        <!-- Photo Mosaic -->
        <div x-show="data.photos && data.photos.length > 0" class="mb-6">
            <h2 class="text-[10px] font-black text-faint uppercase tracking-widest mb-2 flex items-center gap-1">
                <i data-lucide="image" class="w-3 h-3"></i> 記録写真
            </h2>
            <div class="grid grid-cols-4 gap-1 rounded-2xl overflow-hidden">
                <template x-for="(photo, i) in data.photos.slice(0, 8)" :key="i">
                    <div class="aspect-square bg-surface overflow-hidden">
                        <img :src="photo" alt="観察写真" class="w-full h-full object-cover" loading="lazy">
                    </div>
                </template>
            </div>
        </div>

        <!-- Participants -->
        <div x-show="data.participants && data.participants.length > 0" class="mb-6">
            <h2 class="text-[10px] font-black text-faint uppercase tracking-widest mb-2 flex items-center gap-1">
                <i data-lucide="users" class="w-3 h-3"></i> 参加者
            </h2>
            <div class="space-y-2">
                <template x-for="p in data.participants" :key="p.user_id">
                    <div class="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3">
                        <img :src="p.avatar" :alt="p.user_name" class="w-8 h-8 rounded-full object-cover border border-border" onerror="this.src='/assets/img/default-avatar.svg'">
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold text-text truncate" x-text="p.user_name"></p>
                            <p class="text-[10px] text-muted" x-text="p.count + '件の記録 · ' + p.species_count + '種'"></p>
                        </div>
                        <span class="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full" x-text="p.count + '件'"></span>
                    </div>
                </template>
            </div>
        </div>

        <!-- Species List -->
        <div x-show="data.species_list && data.species_list.length > 0" class="mb-6">
            <h2 class="text-[10px] font-black text-faint uppercase tracking-widest mb-2 flex items-center gap-1">
                <i data-lucide="leaf" class="w-3 h-3"></i> 確認された種
            </h2>
            <div class="flex flex-wrap gap-2">
                <template x-for="sp in data.species_list" :key="sp">
                    <a :href="'explore.php?q=' + encodeURIComponent(sp)" class="text-xs font-bold bg-surface border border-border px-3 py-1.5 rounded-full text-text hover:border-primary transition" x-text="sp"></a>
                </template>
            </div>
        </div>

        <!-- Observation Timeline -->
        <div x-show="data.observations && data.observations.length > 0">
            <h2 class="text-[10px] font-black text-faint uppercase tracking-widest mb-2 flex items-center gap-1">
                <i data-lucide="list" class="w-3 h-3"></i> 全記録
            </h2>
            <div class="space-y-2">
                <template x-for="obs in data.observations" :key="obs.id">
                    <a :href="'observation_detail.php?id=' + obs.id" class="flex items-center gap-3 bg-surface border border-border rounded-xl px-3 py-2 hover:border-primary transition">
                        <div class="w-12 h-12 rounded-lg overflow-hidden bg-surface flex-shrink-0">
                            <img x-show="obs.photo" :src="obs.photo" :alt="obs.species_name || '観察'" class="w-full h-full object-cover" loading="lazy">
                            <div x-show="!obs.photo" class="w-full h-full flex items-center justify-center text-faint">📝</div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold text-text truncate" x-text="obs.species_name || '未同定'"></p>
                            <p class="text-[10px] text-muted" x-text="obs.user_name + ' · ' + (obs.observed_at ? obs.observed_at.slice(11, 16) : '')"></p>
                        </div>
                        <i data-lucide="chevron-right" class="w-4 h-4 text-faint flex-shrink-0"></i>
                    </a>
                </template>
            </div>
        </div>

        <!-- Empty State -->
        <div x-show="!loading && (!data.observations || data.observations.length === 0)" class="text-center py-12">
            <div class="text-4xl mb-3">📋</div>
            <p class="text-sm font-bold text-muted">まだ記録がありません</p>
            <p class="text-xs text-faint mt-1">観察会で見つけた生き物を記録してみましょう</p>
            <a href="post.php?event_id=<?php echo urlencode($eventId); ?>&event_name=<?php echo urlencode($eventName); ?>" class="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-primary text-white rounded-full font-bold text-sm active:scale-95 transition">
                <i data-lucide="camera" class="w-4 h-4"></i> 記録する
            </a>
        </div>
    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>

    <script nonce="<?= CspNonce::attr() ?>">
        function eventDashboard() {
            return {
                data: {},
                loading: true,
                async load() {
                    try {
                        const res = await fetch('api/get_event_observations.php?event_id=<?php echo urlencode($eventId); ?>');
                        const json = await res.json();
                        if (json.success) this.data = json;
                    } catch (e) {}
                    this.loading = false;
                    this.$nextTick(() => { if (typeof lucide !== 'undefined') lucide.createIcons(); });
                }
            };
        }
    </script>
</body>
</html>
