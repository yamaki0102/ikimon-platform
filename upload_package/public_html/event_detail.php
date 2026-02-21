<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
Auth::init();

$eventId = $_GET['id'] ?? '';
if (!$eventId) {
    header('Location: events.php');
    exit;
}

$event = DataStore::findById('events', $eventId);
if (!$event) {
    header('Location: events.php');
    exit;
}

$userId = Auth::isLoggedIn() ? Auth::user()['id'] : null;
$isAdmin = Auth::isLoggedIn() ? (Auth::user()['role'] ?? '') === 'Admin' : false;
$isOrganizer = ($userId === ($event['organizer_id'] ?? ''));

// Determine event status
$now = new DateTime();
$eventDate = $event['event_date'] ?? date('Y-m-d');
$startTime = $event['start_time'] ?? '09:00';
$endTime = $event['end_time'] ?? '12:00';
$rangeStart = new DateTime("{$eventDate} {$startTime}");
$rangeEnd = new DateTime("{$eventDate} {$endTime}");
$rangeStart->modify('-30 minutes');
$rangeEnd->modify('+30 minutes');

$isLive = ($now >= $rangeStart && $now <= $rangeEnd);
$isPast = ($now > $rangeEnd);
$statusLabel = $isLive ? 'LIVE' : ($isPast ? '終了' : '予定');
$statusClass = $isLive ? 'bg-red-500' : ($isPast ? 'bg-gray-400' : 'bg-emerald-500');

// Location
$evtLat = (float)($event['location']['lat'] ?? $event['lat'] ?? 0);
$evtLng = (float)($event['location']['lng'] ?? $event['lng'] ?? 0);
$locName = $event['location']['name'] ?? $event['meeting_point'] ?? '';
$radiusM = (int)($event['location']['radius_m'] ?? 500);

// Date formatting
$dateObj = new DateTime($eventDate);
$dow = ['日', '月', '火', '水', '木', '金', '土'][$dateObj->format('w')];
$dateStr = $dateObj->format('Y年n月j日') . "（{$dow}）";

$meta_title = htmlspecialchars($event['title'] ?? '観察会');
$meta_description = $dateStr . ' ' . $locName . ' の観察会';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>

<body class="bg-[var(--color-bg-base)] text-[var(--color-text)] font-sans min-h-screen pb-24 safe-area-inset-bottom"
    x-data="eventDashboard()">

    <?php include('components/nav.php'); ?>
    <div style="height: calc(var(--nav-height, 56px) + var(--safe-top, 0px))"></div>

    <div style="max-width: 640px; margin: 0 auto;">

        <!-- Back Header -->
        <div class="flex items-center justify-between px-4 py-3">
            <a href="events.php" class="size-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 transition">
                <i data-lucide="arrow-left" class="w-5 h-5"></i>
            </a>
            <span class="<?php echo $statusClass; ?> text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                <?php echo $statusLabel; ?>
            </span>
            <div class="flex items-center gap-2">
                <?php if ($isOrganizer || $isAdmin): ?>
                    <a href="generate_grant_report.php?event_id=<?php echo urlencode($eventId); ?>"
                        class="size-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition" title="レポート出力">
                        <i data-lucide="file-text" class="w-4 h-4"></i>
                    </a>
                    <a href="edit_event.php?id=<?php echo urlencode($eventId); ?>"
                        class="size-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition" title="イベント編集">
                        <i data-lucide="pencil" class="w-4 h-4"></i>
                    </a>
                <?php endif; ?>
                <button @click="share()" class="size-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 transition">
                    <i data-lucide="share-2" class="w-5 h-5"></i>
                </button>
            </div>
        </div>

        <!-- Hero: Map + Info -->
        <?php if ($evtLat && $evtLng): ?>
            <div class="mx-4 rounded-2xl overflow-hidden h-40 bg-gray-200" id="event-map"
                style="border: 2px solid var(--color-primary, #10b981);"></div>
        <?php endif; ?>

        <div class="px-5 pt-4">
            <h1 class="text-xl font-black text-gray-900 leading-tight">
                <?php echo htmlspecialchars($event['title'] ?? ''); ?>
            </h1>
            <div class="mt-2 space-y-1.5 text-sm text-gray-600">
                <div class="flex items-center gap-2">
                    <i data-lucide="calendar" class="w-4 h-4 text-emerald-500"></i>
                    <span><?php echo $dateStr; ?></span>
                </div>
                <div class="flex items-center gap-2">
                    <i data-lucide="clock" class="w-4 h-4 text-emerald-500"></i>
                    <span><?php echo htmlspecialchars($startTime); ?> 〜 <?php echo htmlspecialchars($endTime); ?></span>
                </div>
                <?php if ($locName): ?>
                    <div class="flex items-center gap-2">
                        <i data-lucide="map-pin" class="w-4 h-4 text-emerald-500"></i>
                        <span><?php echo htmlspecialchars($locName); ?></span>
                    </div>
                <?php endif; ?>
                <div class="flex items-center gap-2">
                    <i data-lucide="user" class="w-4 h-4 text-gray-400"></i>
                    <span class="text-gray-400">主催:
                        <a href="profile.php?id=<?php echo urlencode($event['organizer_id'] ?? ''); ?>"
                            class="text-emerald-600 font-bold hover:underline"><?php echo htmlspecialchars($event['organizer_name'] ?? ''); ?></a>
                    </span>
                </div>
            </div>

            <?php if (!empty($event['event_code'])): ?>
                <div class="mt-3 bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center justify-between">
                    <div>
                        <div class="text-xs font-bold text-emerald-600">イベントコード</div>
                        <div class="text-lg font-black text-emerald-800 tracking-wider"><?php echo htmlspecialchars($event['event_code']); ?></div>
                    </div>
                    <a href="survey.php?event_code=<?php echo urlencode($event['event_code']); ?>"
                        class="bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm hover:bg-emerald-600 transition-colors">
                        📷 調査に参加
                    </a>
                </div>
            <?php endif; ?>

            <p class="mt-3 p-3 bg-gray-50 rounded-xl text-sm text-gray-600"><?php echo nl2br(htmlspecialchars($event['memo'] ?? '')); ?></p>
        </div>

        <?php
        $meetingPoint = $event['meeting_point'] ?? '';
        $meetingLat = !empty($event['meeting_lat']) ? (float)$event['meeting_lat'] : null;
        $meetingLng = !empty($event['meeting_lng']) ? (float)$event['meeting_lng'] : null;
        $parkingInfo = $event['parking_info'] ?? '';
        $rainLabels = ['cancel' => '☔ 雨天中止', 'light_ok' => '🌦️ 小雨決行', 'rain_ok' => '🌧️ 雨天決行'];
        $rainPolicy = $rainLabels[$event['rain_policy'] ?? ''] ?? '';
        $precautions = $event['precautions'] ?? '';
        if ($meetingPoint || $meetingLat || $parkingInfo || $rainPolicy || $precautions):
        ?>
            <div class="mt-3 space-y-2">
                <?php if ($meetingPoint || $meetingLat): ?>
                    <div class="bg-blue-50 rounded-xl overflow-hidden border border-blue-100">
                        <?php if ($meetingLat && $meetingLng): ?>
                            <div id="meeting-point-map" style="width:100%;height:140px;"></div>
                        <?php endif; ?>
                        <div class="p-3">
                            <div class="flex items-start gap-2">
                                <span class="shrink-0">🚩</span>
                                <div class="flex-1">
                                    <div class="font-bold text-blue-700 text-xs mb-0.5">集合場所</div>
                                    <?php if ($meetingPoint): ?>
                                        <div class="text-sm text-gray-700"><?php echo htmlspecialchars($meetingPoint); ?></div>
                                    <?php endif; ?>
                                </div>
                            </div>
                            <?php if ($meetingLat && $meetingLng): ?>
                                <div class="mt-2 flex gap-2">
                                    <a href="https://www.google.com/maps/dir/?api=1&destination=<?php echo $meetingLat; ?>,<?php echo $meetingLng; ?>"
                                        target="_blank" rel="noopener noreferrer"
                                        class="flex-1 flex items-center justify-center gap-1.5 bg-blue-500 text-white text-xs font-bold py-2 px-3 rounded-lg hover:bg-blue-600 transition">
                                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
                                        </svg>
                                        Google Maps で開く
                                    </a>
                                    <a href="https://www.google.com/maps?q=<?php echo $meetingLat; ?>,<?php echo $meetingLng; ?>"
                                        target="_blank" rel="noopener noreferrer"
                                        class="flex items-center justify-center gap-1 bg-gray-100 text-gray-600 text-xs font-bold py-2 px-3 rounded-lg hover:bg-gray-200 transition">
                                        📍 地図
                                    </a>
                                </div>
                            <?php endif; ?>
                        </div>
                    </div>
                <?php endif; ?>
                <?php if ($parkingInfo): ?>
                    <div class="flex items-start gap-2 p-3 bg-emerald-50 rounded-xl text-sm">
                        <span class="shrink-0">🅿️</span>
                        <div>
                            <div class="font-bold text-emerald-700 text-xs mb-0.5">駐車場</div>
                            <div class="text-gray-700"><?php echo htmlspecialchars($parkingInfo); ?></div>
                        </div>
                    </div>
                <?php endif; ?>
                <?php if ($rainPolicy): ?>
                    <div class="flex items-center gap-2 p-3 bg-sky-50 rounded-xl text-sm text-sky-700 font-bold">
                        <?php echo $rainPolicy; ?>
                    </div>
                <?php endif; ?>
                <?php if ($precautions): ?>
                    <div class="flex items-start gap-2 p-3 bg-amber-50 rounded-xl text-sm">
                        <span class="shrink-0">⚠️</span>
                        <div>
                            <div class="font-bold text-amber-700 text-xs mb-0.5">注意事項</div>
                            <div class="text-gray-700"><?php echo nl2br(htmlspecialchars($precautions)); ?></div>
                        </div>
                    </div>
                <?php endif; ?>
            </div>
        <?php endif; ?>
        <?php
        $editHistory = $event['edit_history'] ?? [];
        if (!empty($editHistory)):
            $fieldLabels = [
                'title' => 'タイトル',
                'event_date' => '日付',
                'start_time' => '開始時間',
                'end_time' => '終了時間',
                'location' => '場所',
                'memo' => 'メモ',
                'meeting_point' => '集合場所',
                'parking_info' => '駐車場',
                'rain_policy' => '雨天時',
                'precautions' => '注意事項',
            ];
            $lastEdit = end($editHistory);
            $editDate = (new DateTime($lastEdit['at']))->format('n/j H:i');
        ?>
            <div class="px-5 mt-3">
                <p class="text-xs text-gray-300">📝 最終更新: <?php echo $editDate; ?> by <?php echo htmlspecialchars($lastEdit['by']); ?></p>
            </div>
        <?php endif; ?>

        <!-- ========== LIVE STATS ========== -->
        <div class="px-4 mt-5">
            <div class="grid grid-cols-3 gap-3">
                <div class="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
                    <div class="text-2xl font-black text-emerald-600" x-text="stats.species_count">0</div>
                    <div class="text-xs text-gray-400 mt-0.5">種</div>
                </div>
                <div class="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
                    <div class="text-2xl font-black text-blue-500" x-text="stats.observation_count">0</div>
                    <div class="text-xs text-gray-400 mt-0.5">記録</div>
                </div>
                <div class="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
                    <div class="text-2xl font-black text-orange-500" x-text="stats.contributor_count">0</div>
                    <div class="text-xs text-gray-400 mt-0.5">参加者</div>
                </div>
            </div>
        </div>

        <!-- ========== TARGET SPECIES PROGRESS ========== -->
        <template x-if="targetProgress.length > 0">
            <div class="px-4 mt-5">
                <h2 class="text-sm font-bold text-gray-900 mb-2">🎯 目標種</h2>
                <div class="space-y-1.5">
                    <template x-for="t in targetProgress" :key="t.name">
                        <div class="flex items-center gap-2 px-3 py-2 rounded-lg"
                            :class="t.found ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-100'">
                            <span class="text-lg" x-text="t.found ? '✅' : '⬜'"></span>
                            <span class="text-sm font-medium" :class="t.found ? 'text-emerald-700' : 'text-gray-500'" x-text="t.name"></span>
                        </div>
                    </template>
                </div>
            </div>
        </template>

        <!-- ========== LIVE FEED: RECENT OBSERVATIONS ========== -->
        <div class="px-4 mt-5">
            <h2 class="text-sm font-bold text-gray-900 mb-2">
                📸 発見フィード
                <span x-show="isLive" class="text-xs text-red-500 ml-1 animate-pulse">● LIVE</span>
            </h2>

            <template x-if="observations.length === 0">
                <div class="text-center py-8 text-gray-400">
                    <div class="text-4xl mb-2">🔍</div>
                    <p class="text-sm">まだ記録がないよ</p>
                    <p class="text-xs text-gray-300 mt-1" x-show="!isPast">観察会のエリア内で投稿すると自動で表示される！</p>
                </div>
            </template>

            <div class="space-y-2">
                <template x-for="obs in observations" :key="obs.id">
                    <a :href="'observation.php?id=' + obs.id"
                        class="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:shadow-md transition">
                        <template x-if="obs.photo">
                            <img :src="obs.photo" class="size-12 rounded-lg object-cover bg-gray-100" loading="lazy">
                        </template>
                        <template x-if="!obs.photo">
                            <div class="size-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 text-lg">🌿</div>
                        </template>
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-bold truncate" x-text="obs.taxon_name"></div>
                            <div class="text-xs text-gray-400 truncate" x-text="obs.scientific_name"></div>
                            <div class="text-[10px] text-gray-300 mt-0.5" x-text="obs.user_name + ' · ' + obs.observed_at.slice(11, 16)"></div>
                        </div>
                        <template x-if="obs.auto_linked">
                            <span class="text-[10px] bg-emerald-50 text-emerald-500 px-2 py-0.5 rounded-full">自動</span>
                        </template>
                    </a>
                </template>
            </div>
        </div>

        <!-- ========== CONTRIBUTORS ========== -->
        <template x-if="contributors.length > 0">
            <div class="px-4 mt-5">
                <h2 class="text-sm font-bold text-gray-900 mb-2">👥 参加者</h2>
                <div class="flex flex-wrap gap-2">
                    <template x-for="c in contributors" :key="c.name">
                        <div class="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100 text-sm">
                            <img :src="c.avatar || 'https://i.pravatar.cc/40?u=' + c.name" class="size-5 rounded-full">
                            <span x-text="c.name"></span>
                            <span class="text-xs text-emerald-600 font-bold" x-text="c.count + '件'"></span>
                        </div>
                    </template>
                </div>
            </div>
        </template>

        <!-- ========== SPECIES LIST (Past events) ========== -->
        <template x-if="isPast && speciesList.length > 0">
            <div class="px-4 mt-5">
                <h2 class="text-sm font-bold text-gray-900 mb-2">🌿 発見種リスト（<span x-text="speciesList.length"></span>種）</h2>
                <div class="flex flex-wrap gap-1.5">
                    <template x-for="sp in speciesList" :key="sp">
                        <span class="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full" x-text="sp"></span>
                    </template>
                </div>
            </div>
        </template>

        <!-- ========== CTA: Post Observation ========== -->
        <?php if (!$isPast): ?>
            <div class="px-4 mt-6">
                <a href="post.php?event_id=<?php echo urlencode($eventId); ?>&event_name=<?php echo urlencode($event['title'] ?? '観察会'); ?>"
                    class="block w-full text-center bg-emerald-500 text-white font-bold py-3.5 rounded-2xl text-sm shadow-lg hover:bg-emerald-600 transition">
                    📸 この観察会で記録する
                </a>
            </div>
        <?php endif; ?>

        <!-- ========== QR Code Section ========== -->
        <div class="px-4 mt-5 mb-6">
            <div class="bg-gray-50 rounded-xl p-4 text-center">
                <p class="text-xs text-gray-400 mb-2">このURLを共有すれば誰でも参加できるよ</p>
                <div class="flex items-center gap-2 justify-center">
                    <input type="text" value="<?php echo htmlspecialchars(BASE_URL . '/event_detail.php?id=' . $eventId); ?>"
                        readonly onclick="this.select()"
                        class="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-center flex-1 max-w-xs">
                    <button @click="share()" class="bg-emerald-500 text-white px-3 py-2 rounded-lg text-xs font-bold">
                        📋 コピー
                    </button>
                </div>
            </div>
        </div>



        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9/dist/leaflet.js"></script>
        <script nonce="<?= CspNonce::attr() ?>">
            function eventDashboard() {
                return {
                    eventId: <?php echo json_encode($eventId, JSON_HEX_TAG); ?>,
                    stats: {
                        species_count: 0,
                        observation_count: 0,
                        contributor_count: 0
                    },
                    observations: [],
                    contributors: [],
                    speciesList: [],
                    targetProgress: [],
                    isLive: <?php echo $isLive ? 'true' : 'false'; ?>,
                    isPast: <?php echo $isPast ? 'true' : 'false'; ?>,
                    refreshInterval: null,

                    init() {
                        this.$nextTick(() => {
                            if (typeof lucide !== 'undefined') lucide.createIcons();
                            this.initMap();
                        });
                        this.loadData();

                        // Auto-refresh every 15s during live events
                        if (this.isLive) {
                            this.refreshInterval = setInterval(() => this.loadData(), 15000);
                        }
                    },

                    destroy() {
                        if (this.refreshInterval) clearInterval(this.refreshInterval);
                    },

                    initMap() {
                        const mapEl = document.getElementById('event-map');
                        if (!mapEl) return;

                        const lat = <?php echo $evtLat; ?>;
                        const lng = <?php echo $evtLng; ?>;
                        if (!lat || !lng) return;

                        const map = L.map('event-map', {
                            zoomControl: false,
                            attributionControl: false
                        }).setView([lat, lng], 15);
                        L.tileLayer('https://tile.openstreetmap.jp/{z}/{x}/{y}.png', {
                            maxZoom: 19
                        }).addTo(map);
                        const pinIcon = L.divIcon({
                            className: '',
                            html: '<div style="font-size:28px;text-align:center;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3))">📍</div>',
                            iconSize: [30, 30],
                            iconAnchor: [15, 30]
                        });
                        L.marker([lat, lng], {
                            icon: pinIcon
                        }).addTo(map);
                        L.circle([lat, lng], {
                            radius: <?php echo $radiusM; ?>,
                            color: '#10b981',
                            fillColor: '#10b981',
                            fillOpacity: 0.1,
                            weight: 2
                        }).addTo(map);

                        // Meeting point map
                        <?php if ($meetingLat && $meetingLng): ?>
                            const mpEl = document.getElementById('meeting-point-map');
                            if (mpEl) {
                                const mpMap = L.map(mpEl, {
                                    zoomControl: false,
                                    attributionControl: false
                                }).setView([<?php echo $meetingLat; ?>, <?php echo $meetingLng; ?>], 16);
                                L.tileLayer('https://tile.openstreetmap.jp/{z}/{x}/{y}.png', {
                                    maxZoom: 19
                                }).addTo(mpMap);
                                const flagIcon = L.divIcon({
                                    className: '',
                                    html: '<div style="font-size:24px;text-align:center;">🚩</div>',
                                    iconSize: [30, 30],
                                    iconAnchor: [15, 28]
                                });
                                L.marker([<?php echo $meetingLat; ?>, <?php echo $meetingLng; ?>], {
                                    icon: flagIcon
                                }).addTo(mpMap);
                            }
                        <?php endif; ?>
                    },

                    async loadData() {
                        try {
                            const res = await fetch(`api/get_event_live.php?id=${this.eventId}`);
                            const data = await res.json();
                            if (!data.success) return;

                            this.stats = data.stats;
                            this.observations = data.observations || [];
                            this.contributors = data.contributors || [];
                            this.speciesList = data.species_list || [];
                            this.targetProgress = data.target_progress || [];
                            this.isLive = data.is_live;
                            this.isPast = data.is_past;
                        } catch (e) {
                            console.error('Failed to load event data:', e);
                        }
                    },

                    share() {
                        const url = window.location.href;
                        if (navigator.share) {
                            navigator.share({
                                title: document.title,
                                url: url
                            });
                        } else {
                            navigator.clipboard.writeText(url).then(() => alert('URLをコピーしました！'));
                        }
                    },
                };
            }
        </script>
    </div><!-- max-width container -->
</body>

</html>