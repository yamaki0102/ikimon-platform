<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/Lang.php';
Auth::init();
Lang::init();

if (!Auth::isLoggedIn()) {
    header('Location: login.php');
    exit;
}

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

$user = Auth::user();
$isOrganizer = ($user['id'] === ($event['organizer_id'] ?? ''));
$isAdmin = (($user['role'] ?? '') === 'Admin');

if (!$isOrganizer && !$isAdmin) {
    header('Location: event_detail.php?id=' . urlencode($eventId));
    exit;
}

// Prepare data for JS
$evtJson = json_encode([
    'id'             => $event['id'],
    'title'          => $event['title'] ?? '',
    'memo'           => $event['memo'] ?? '',
    'event_date'     => $event['event_date'] ?? '',
    'start_time'     => $event['start_time'] ?? '09:00',
    'end_time'       => $event['end_time'] ?? '12:00',
    'lat'            => (float)($event['location']['lat'] ?? 0),
    'lng'            => (float)($event['location']['lng'] ?? 0),
    'radius_m'       => (int)($event['location']['radius_m'] ?? 500),
    'location_name'  => $event['location']['name'] ?? '',
    'meeting_point'  => $event['meeting_point'] ?? '',
    'parking_info'   => $event['parking_info'] ?? '',
    'rain_policy'    => $event['rain_policy'] ?? '',
    'precautions'    => $event['precautions'] ?? '',
    'grant_id'       => $event['grant_id'] ?? '',
    'event_type'     => $event['event_type'] ?? 'open',
    'enable_bingo'   => !empty($event['enable_bingo']),
    'enable_leaderboard' => !isset($event['enable_leaderboard']) || !empty($event['enable_leaderboard']),
    'event_code'     => $event['event_code'] ?? '',
    'site_id'        => $event['site_id'] ?? ($event['location']['site_id'] ?? ''),
    'bingo_species'  => $event['bingo_species'] ?? [],
    'bingo_template_id' => $event['bingo_template_id'] ?? '',
    'target_species' => $event['target_species'] ?? [],
], JSON_UNESCAPED_UNICODE);

$meta_title = "観察会を編集";
$meta_description = "観察会の情報を編集します。";
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include('components/meta.php'); ?>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        .edit-form {
            max-width: 640px;
            margin: 0 auto;
            padding: 1rem;
        }

        .form-field {
            margin-bottom: 1rem;
        }

        .form-field label {
            display: block;
            font-weight: 700;
            font-size: 0.85rem;
            margin-bottom: 0.35rem;
            color: var(--md-on-surface-variant);
        }

        .form-field input,
        .form-field textarea,
        .form-field select {
            width: 100%;
            padding: 0.6rem 0.8rem;
            border: 1.5px solid var(--md-outline-variant);
            border-radius: 0.75rem;
            font-size: 0.95rem;
            background: white;
        }

        .form-field input:focus,
        .form-field textarea:focus,
        .form-field select:focus {
            outline: none;
            border-color: var(--md-primary);
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }

        .location-map {
            width: 100%;
            height: 200px;
            border-radius: 1rem;
            border: 2px solid var(--md-primary);
            margin-bottom: 0.75rem;
        }

        .btn-save {
            width: 100%;
            padding: 0.85rem;
            background: var(--md-primary);
            color: white;
            font-weight: 800;
            font-size: 1rem;
            border: none;
            border-radius: 0.75rem;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn-save:hover {
            opacity: 0.9;
            transform: translateY(-1px);
        }

        .btn-save:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .search-container {
            position: relative;
            margin-bottom: 0.75rem;
        }

        .search-container input {
            padding-left: 2.5rem;
        }

        .search-container .search-icon {
            position: absolute;
            left: 0.85rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--md-on-surface-variant);
            pointer-events: none;
        }

        .search-results {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1.5px solid var(--md-outline-variant);
            border-radius: 0.75rem;
            margin-top: 0.25rem;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        }

        .search-results .result-item {
            padding: 0.6rem 0.85rem;
            cursor: pointer;
            font-size: 0.85rem;
            border-bottom: 1px solid #f3f4f6;
            transition: background 0.15s;
        }

        .search-results .result-item:last-child {
            border-bottom: none;
        }

        .search-results .result-item:hover {
            background: #f0fdf4;
        }

        .site-strip {
            display: flex;
            gap: 0.75rem;
            overflow-x: auto;
            padding-bottom: 0.25rem;
            margin-bottom: 1rem;
        }

        .site-card {
            min-width: 220px;
            border-radius: 1rem;
            border: 1.5px solid var(--md-outline-variant);
            background: white;
            padding: 0.9rem;
            text-align: left;
            transition: all 0.2s;
        }

        .site-card.active {
            border-color: var(--md-primary);
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(59, 130, 246, 0.04));
            box-shadow: 0 8px 24px rgba(16, 185, 129, 0.12);
        }

        .site-card p {
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
    </style>
</head>

<body class="font-sans min-h-screen pb-24" style="background:var(--md-surface);color:var(--md-on-surface);"
    x-data="editEvent()">

    <?php include('components/nav.php'); ?>
    <div style="height: calc(var(--nav-height, 56px) + var(--safe-top, 0px))"></div>

    <div class="edit-form">
        <!-- Header -->
        <div class="flex items-center gap-3 mb-4">
            <a href="event_detail.php?id=<?php echo urlencode($eventId); ?>"
                class="size-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                <i data-lucide="arrow-left" class="w-5 h-5"></i>
            </a>
            <h1 class="text-lg font-black">✏️ 観察会を編集</h1>
        </div>

        <!-- Title -->
        <div class="form-field">
            <label>タイトル</label>
            <input type="text" x-model="title" placeholder="自動生成されます（空欄OK）" maxlength="100">
        </div>

        <!-- Date / Time -->
        <div class="grid grid-cols-3 gap-3">
            <div class="form-field col-span-1">
                <label>📅 日付</label>
                <input type="date" x-model="eventDate" required>
            </div>
            <div class="form-field col-span-1">
                <label>🕐 開始</label>
                <input type="time" x-model="startTime">
            </div>
            <div class="form-field col-span-1">
                <label>🕐 終了</label>
                <input type="time" x-model="endTime">
            </div>
        </div>

        <!-- Location Search -->
        <div class="form-field">
            <label>📍 場所</label>
            <div x-show="sites.length > 0" class="mb-3">
                <div class="flex items-center justify-between mb-2">
                    <h3 class="text-xs font-black text-gray-600 tracking-[0.12em] uppercase">Site から選ぶ</h3>
                    <button type="button" x-show="siteId" @click="clearSiteSelection()" class="text-xs font-bold text-gray-400">解除</button>
                </div>
                <div class="site-strip">
                    <template x-for="site in sites" :key="site.id">
                        <button type="button" class="site-card" :class="{ 'active': siteId === site.id }" @click="selectSite(site)">
                            <div class="flex items-center justify-between gap-2">
                                <span class="text-sm font-black text-gray-900" x-text="site.name"></span>
                                <span x-show="siteId === site.id" class="text-[10px] font-black text-emerald-600">選択中</span>
                            </div>
                            <p class="text-xs text-gray-500 mt-2" x-text="site.description || 'エリアと連動したイベントに使えます'"></p>
                            <div class="mt-3 text-[11px] font-bold text-emerald-700" x-text="'ID: ' + site.id"></div>
                        </button>
                    </template>
                </div>
            </div>
            <div class="search-container">
                <span class="search-icon">🔍</span>
                <input type="text" x-model="searchQuery" @input.debounce.400ms="searchAddress()"
                    placeholder="住所・場所名で検索" autocomplete="off">
                <div class="search-results" x-show="searchResults.length > 0" @click.outside="searchResults = []">
                    <template x-for="(r, i) in searchResults" :key="i">
                        <div class="result-item" @click="selectSearchResult(r)">
                            <span x-text="r.display_name"></span>
                        </div>
                    </template>
                </div>
            </div>
        </div>

        <!-- Map -->
        <div id="edit-map" class="location-map"></div>

        <div class="form-field">
            <label>場所の名前（任意）</label>
            <input type="text" x-model="locationName" placeholder="例: 城北公園" maxlength="100">
        </div>

        <!-- Radius -->
        <div class="form-field">
            <label>エリア半径: <span x-text="radiusM + 'm'"></span></label>
            <input type="range" x-model.number="radiusM" min="100" max="5000" step="100"
                @input="updateRadiusCircle()" class="w-full">
        </div>

        <!-- Memo -->
        <div class="form-field">
            <label>メモ（任意・100字）</label>
            <textarea x-model="memo" rows="2" maxlength="100" placeholder="簡単な説明など"></textarea>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="form-field">
                <label>参加方式</label>
                <select x-model="eventType">
                    <option value="open">誰でも参加できる</option>
                    <option value="invite">招待制</option>
                </select>
            </div>
            <div class="form-field">
                <label>イベントコード（任意）</label>
                <input type="text" x-model="eventCode" maxlength="20"
                    @input="eventCode = eventCode.toUpperCase().replace(/[^A-Z0-9]/g, '')"
                    placeholder="例: HAMANAKO2026">
            </div>
        </div>

        <div class="form-field">
            <label>Site ID（任意）</label>
            <input type="text" x-model="siteId" maxlength="120" placeholder="例: site_hamanako_area">
            <p class="text-xs text-gray-400 mt-1">サイト境界と紐付けるとビンゴや集計に利用されます</p>
        </div>

        <!-- Meeting Point -->
        <div class="form-field">
            <label>🚩 集合場所（任意）</label>
            <input type="text" x-model="meetingPoint" placeholder="例: ○○公園の駐車場前" maxlength="200">
        </div>

        <!-- Parking -->
        <div class="form-field">
            <label>🅿️ 駐車場（任意）</label>
            <input type="text" x-model="parkingInfo" placeholder="例: 無料駐車場あり（30台）" maxlength="200">
        </div>

        <!-- Rain Policy -->
        <div class="form-field">
            <label>🌧️ 雨天時（任意）</label>
            <select x-model="rainPolicy">
                <option value="">未設定</option>
                <option value="cancel">雨天中止</option>
                <option value="light_ok">小雨決行</option>
                <option value="rain_ok">雨天決行</option>
            </select>
        </div>

        <!-- Precautions -->
        <div class="form-field">
            <label>⚠️ 注意事項（任意・500字）</label>
            <textarea x-model="precautions" rows="3" maxlength="500" placeholder="参加者への注意事項"></textarea>
        </div>

        <!-- Grant -->
        <div class="form-field">
            <label>助成金・プロジェクト紐付け（任意）</label>
            <select x-model="grantId">
                <option value="">-- 指定なし --</option>
                <option value="ToG_Nature_2025">ToG: 地域の自然史編纂助成 (2025)</option>
                <option value="CSR_AcmeCorp_100">企業CSR: AcmeCorp 100年の森プロジェクト</option>
                <option value="30by30_Shizuoka">自治体: 静岡30by30コンソーシアム</option>
            </select>
        </div>

        <div class="form-field">
            <label class="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" x-model="enableLeaderboard" class="mt-1">
                <span>
                    <span class="block text-sm font-bold text-gray-700">イベント内ランキングを表示する</span>
                    <span class="block text-xs text-gray-400 mt-1">終了後サマリーにも使います</span>
                </span>
            </label>
        </div>

        <div class="form-field">
            <label class="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" x-model="enableBingo" class="mt-1">
                <span>
                    <span class="block text-sm font-bold text-gray-700">ビンゴカードを有効化する</span>
                    <span class="block text-xs text-gray-400 mt-1">必要なら保存時に再生成できます</span>
                </span>
            </label>
        </div>

        <div class="form-field" x-show="enableBingo" x-cloak>
            <div class="flex items-center justify-between mb-2">
                <label class="mb-0">ビンゴ候補種</label>
                <button type="button" @click="regenerateBingo()" :disabled="saving || bingoGenerating"
                    class="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                    <span x-text="bingoGenerating ? '生成中...' : '再生成する'"></span>
                </button>
            </div>
            <div class="flex flex-wrap gap-2" x-show="bingoSpecies.length > 0">
                <template x-for="species in bingoSpecies" :key="species">
                    <span class="px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold" x-text="species"></span>
                </template>
            </div>
            <p x-show="bingoSpecies.length === 0" class="text-xs text-gray-400">まだ生成されていません</p>
        </div>

        <!-- Save Button -->
        <button class="btn-save" @click="saveEvent()" :disabled="saving">
            <span x-show="!saving">💾 保存する</span>
            <span x-show="saving">保存中...</span>
        </button>

        <div x-show="errorMsg" class="mt-3 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold"
            x-text="errorMsg"></div>
    </div>



    <script nonce="<?= CspNonce::attr() ?>">
        function editEvent() {
            const evt = <?php echo $evtJson; ?>;
            return {
                id: evt.id,
                title: evt.title,
                memo: evt.memo,
                eventDate: evt.event_date,
                startTime: evt.start_time,
                endTime: evt.end_time,
                lat: evt.lat,
                lng: evt.lng,
                radiusM: evt.radius_m,
                locationName: evt.location_name,
                meetingPoint: evt.meeting_point,
                parkingInfo: evt.parking_info,
                rainPolicy: evt.rain_policy,
                precautions: evt.precautions,
                grantId: evt.grant_id || '',
                eventType: evt.event_type || 'open',
                enableBingo: !!evt.enable_bingo,
                enableLeaderboard: !!evt.enable_leaderboard,
                eventCode: evt.event_code || '',
                siteId: evt.site_id || '',
                bingoSpecies: evt.bingo_species || [],
                bingoTemplateId: evt.bingo_template_id || '',
                searchQuery: '',
                searchResults: [],
                saving: false,
                bingoGenerating: false,
                errorMsg: '',
                map: null,
                marker: null,
                circle: null,
                sites: [],

                init() {
                    this.$nextTick(() => {
                        this.map = L.map('edit-map').setView([this.lat || 34.7, this.lng || 137.7], this.lat ? 15 : 10);
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '© OpenStreetMap'
                        }).addTo(this.map);

                        if (this.lat && this.lng) {
                            this.placeMarker();
                        }

                        this.map.on('click', (e) => {
                            this.lat = e.latlng.lat;
                            this.lng = e.latlng.lng;
                            this.placeMarker();
                        });
                    });
                    this.loadSites();
                },

                placeMarker() {
                    if (this.marker) this.map.removeLayer(this.marker);
                    if (this.circle) this.map.removeLayer(this.circle);
                    this.marker = L.marker([this.lat, this.lng]).addTo(this.map);
                    this.circle = L.circle([this.lat, this.lng], {
                        radius: this.radiusM,
                        color: '#10b981',
                        fillOpacity: 0.08,
                        weight: 2,
                    }).addTo(this.map);
                },

                updateRadiusCircle() {
                    if (this.circle) this.circle.setRadius(this.radiusM);
                },

                async loadSites() {
                    try {
                        const res = await fetch('api/list_sites.php');
                        const data = await res.json();
                        this.sites = (data.sites || []).filter((site) => site.status === 'active');
                    } catch (e) {
                        console.warn('Failed to load sites:', e);
                    }
                },

                selectSite(site) {
                    this.siteId = site.id;
                    const center = Array.isArray(site.center) ? site.center : null;
                    if (center && center.length >= 2) {
                        this.lng = Number(center[0]);
                        this.lat = Number(center[1]);
                    }
                    this.locationName = site.name || this.locationName;
                    this.radiusM = Math.max(this.radiusM, 500);
                    this.map.setView([this.lat, this.lng], 15);
                    this.placeMarker();
                },

                clearSiteSelection() {
                    this.siteId = '';
                },

                async searchAddress() {
                    const q = this.searchQuery.trim();
                    if (q.length < 2) {
                        this.searchResults = [];
                        return;
                    }
                    try {
                        const res = await fetch(
                            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=jp&limit=5&accept-language=ja`, {
                                headers: {
                                    'User-Agent': 'ikimon.life/1.0'
                                }
                            }
                        );
                        this.searchResults = await res.json();
                    } catch (e) {
                        this.searchResults = [];
                    }
                },

                selectSearchResult(result) {
                    this.lat = parseFloat(result.lat);
                    this.lng = parseFloat(result.lon);
                    this.searchResults = [];
                    this.searchQuery = '';
                    const parts = result.display_name.split(',');
                    if (!this.locationName && parts.length > 0) {
                        this.locationName = parts[0].trim();
                    }
                    this.map.setView([this.lat, this.lng], 16);
                    this.placeMarker();
                },

                async saveEvent() {
                    if (!this.eventDate || !this.lat) {
                        this.errorMsg = '日付と場所は必須です';
                        return;
                    }
                    this.saving = true;
                    this.errorMsg = '';
                    try {
                        const body = {
                            id: this.id,
                            title: this.title || '',
                            memo: this.memo,
                            meeting_point: this.meetingPoint,
                            parking_info: this.parkingInfo,
                            rain_policy: this.rainPolicy,
                            precautions: this.precautions,
                            event_type: this.eventType,
                            event_code: this.eventCode,
                            grant_id: this.grantId,
                            site_id: this.siteId,
                            enable_bingo: this.enableBingo,
                            enable_leaderboard: this.enableLeaderboard,
                            bingo_species: this.bingoSpecies,
                            bingo_template_id: this.bingoTemplateId,
                            event_date: this.eventDate,
                            start_time: this.startTime,
                            end_time: this.endTime,
                            location: {
                                type: 'custom',
                                site_id: this.siteId || null,
                                lat: this.lat,
                                lng: this.lng,
                                radius_m: this.radiusM,
                                name: this.locationName,
                            },
                            target_species: [],
                        };
                        const res = await fetch('api/save_event.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(body),
                        });
                        const data = await res.json();
                        if (data.success) {
                            window.location.href = `event_detail.php?id=${encodeURIComponent(this.id)}`;
                        } else {
                            this.errorMsg = data.message || '保存に失敗しました';
                        }
                    } catch (e) {
                        this.errorMsg = '通信エラーが発生しました';
                    } finally {
                        this.saving = false;
                    }
                },

                async regenerateBingo() {
                    if (!this.enableBingo) {
                        return;
                    }
                    this.bingoGenerating = true;
                    this.errorMsg = '';
                    try {
                        const res = await fetch('api/generate_bingo_template.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                event_id: this.id,
                            }),
                        });
                        const data = await res.json();
                        if (!data.success) {
                            this.errorMsg = data.message || 'ビンゴ生成に失敗しました';
                            return;
                        }
                        this.bingoSpecies = data.cells || [];
                        this.bingoTemplateId = data.template_id || '';
                    } catch (e) {
                        this.errorMsg = 'ビンゴ生成に失敗しました';
                    } finally {
                        this.bingoGenerating = false;
                    }
                },
            };
        }
    </script>
</body>

</html>
