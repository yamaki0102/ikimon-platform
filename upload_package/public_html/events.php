<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/Lang.php';
Auth::init();
Lang::init();

$meta_title = "観察会";
$meta_description = "みんなで生きものを観察する観察会に参加しよう。";
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include('components/meta.php'); ?>
    <style>
        .event-card {
            background: white;
            border-radius: 1rem;
            padding: 1rem;
            border: 1.5px solid var(--color-border, #e5e7eb);
            transition: all 0.2s;
            display: block;
            text-decoration: none;
            color: inherit;
        }

        .event-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
        }

        .event-status-badge {
            font-size: 0.65rem;
            font-weight: 700;
            padding: 0.2rem 0.5rem;
            border-radius: 9999px;
            display: inline-block;
        }

        .badge-live {
            background: #fee2e2;
            color: #dc2626;
        }

        .badge-upcoming {
            background: #d1fae5;
            color: #059669;
        }

        .badge-ended {
            background: #f3f4f6;
            color: #6b7280;
        }

        .create-fab {
            position: fixed;
            bottom: 5.5rem;
            right: 1.25rem;
            width: 3.5rem;
            height: 3.5rem;
            background: var(--color-primary, #10b981);
            color: white;
            border: none;
            border-radius: 50%;
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.35);
            font-size: 1.5rem;
            font-weight: 900;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
            z-index: 50;
        }

        .create-fab:hover {
            transform: scale(1.1);
        }

        .empty-state {
            text-align: center;
            padding: 3rem 1rem;
        }

        .empty-state .emoji {
            font-size: 3.5rem;
            margin-bottom: 0.75rem;
        }
    </style>
</head>

<body class="bg-[var(--color-bg-base)] text-[var(--color-text)] font-sans min-h-screen pb-24 safe-area-inset-bottom"
    x-data="eventsList()">

    <?php include('components/nav.php'); ?>
    <div style="height: calc(var(--nav-height, 56px) + var(--safe-top, 0px))"></div>

    <!-- Header -->
    <div class="px-5 pt-4 pb-2 max-w-3xl mx-auto">
        <h1 class="text-xl font-black">🌿 観察会</h1>
        <p class="text-sm text-gray-400 mt-0.5">みんなで自然を観よう</p>
    </div>

    <!-- Tab Filter -->
    <div class="px-5 mb-4 flex gap-2 max-w-3xl mx-auto">
        <button @click="filter = 'upcoming'"
            class="px-3 py-1.5 rounded-full text-sm font-bold transition"
            :class="filter === 'upcoming' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'">
            予定
        </button>
        <button @click="filter = 'all'"
            class="px-3 py-1.5 rounded-full text-sm font-bold transition"
            :class="filter === 'all' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'">
            すべて
        </button>
    </div>

    <!-- Events List -->
    <div class="px-4 space-y-3 max-w-3xl mx-auto" x-show="events.length > 0">
        <template x-for="evt in filteredEvents()" :key="evt.id">
            <a :href="'event_detail.php?id=' + evt.id" class="event-card">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex-1 min-w-0">
                        <h3 class="text-sm font-bold truncate" x-text="evt.title"></h3>
                    </div>
                    <span class="event-status-badge ml-2"
                        :class="getStatusClass(evt)"
                        x-text="getStatusLabel(evt)">
                    </span>
                </div>
                <div class="space-y-1 text-xs text-gray-500">
                    <div class="flex items-center gap-1.5">
                        <span>📅</span>
                        <span x-text="formatDate(evt.event_date)"></span>
                        <span class="text-gray-300 mx-1">|</span>
                        <span x-text="(evt.start_time || '09:00') + ' 〜 ' + (evt.end_time || '12:00')"></span>
                    </div>
                    <div class="flex items-center gap-1.5" x-show="getLocationName(evt)">
                        <span>📍</span>
                        <span x-text="getLocationName(evt)"></span>
                    </div>
                </div>
                <div class="flex items-center gap-3 mt-2.5 text-xs">
                    <span class="text-emerald-600 font-bold" x-text="(evt.observation_count || 0) + ' 記録'"></span>
                    <template x-if="evt.distance_km !== null && evt.distance_km !== undefined">
                        <span class="text-gray-400" x-text="evt.distance_km + ' km'"></span>
                    </template>
                    <span class="text-gray-300 ml-auto" x-text="evt.organizer_name || ''"></span>
                </div>
            </a>
        </template>
    </div>

    <!-- Empty State -->
    <div x-show="events.length === 0 && !loading" class="max-w-3xl mx-auto">
        <div class="empty-state">
            <div class="emoji">🦋</div>
            <h2 class="text-base font-bold text-gray-700">まだ観察会がないよ</h2>
            <p class="text-sm text-gray-400 mt-1">最初の観察会をつくってみよう！</p>
            <?php if (Auth::isLoggedIn()): ?>
                <a href="create_event.php" class="inline-block mt-4 bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm">
                    🎉 観察会をつくる
                </a>
            <?php endif; ?>
        </div>
    </div>

    <!-- Loading -->
    <div x-show="loading" class="text-center py-8 max-w-3xl mx-auto">
        <div class="animate-spin inline-block w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
    </div>

    <!-- FAB -->
    <?php if (Auth::isLoggedIn()): ?>
        <a href="create_event.php" class="create-fab" title="観察会をつくる">＋</a>
    <?php endif; ?>



    <script nonce="<?= CspNonce::attr() ?>">
        function eventsList() {
            return {
                events: [],
                filter: 'upcoming',
                loading: true,

                init() {
                    this.$nextTick(() => {
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    });
                    this.loadEvents();
                },

                async loadEvents() {
                    this.loading = true;
                    try {
                        const res = await fetch('api/get_events.php?status=all&upcoming=false');
                        const data = await res.json();
                        this.events = data.events || [];
                    } catch (e) {
                        console.error('Failed to load events:', e);
                    } finally {
                        this.loading = false;
                    }
                },

                filteredEvents() {
                    if (this.filter === 'upcoming') {
                        const today = new Date().toISOString().slice(0, 10);
                        return this.events.filter(e => (e.event_date || '') >= today);
                    }
                    return this.events;
                },

                getStatusClass(evt) {
                    const now = new Date();
                    const d = evt.event_date || '';
                    const today = now.toISOString().slice(0, 10);
                    if (d === today) return 'badge-live';
                    if (d < today) return 'badge-ended';
                    return 'badge-upcoming';
                },

                getStatusLabel(evt) {
                    const now = new Date();
                    const d = evt.event_date || '';
                    const today = now.toISOString().slice(0, 10);
                    if (d === today) return '今日';
                    if (d < today) return '終了';
                    return '予定';
                },

                formatDate(dateStr) {
                    if (!dateStr) return '';
                    const d = new Date(dateStr);
                    const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
                    return `${d.getMonth()+1}/${d.getDate()}（${dow}）`;
                },

                getLocationName(evt) {
                    return evt.location?.name || evt.meeting_point || '';
                },
            };
        }
    </script>
</body>

</html>