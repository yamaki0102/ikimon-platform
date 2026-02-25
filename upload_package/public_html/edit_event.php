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
            color: var(--color-text-muted, #6b7280);
        }

        .form-field input,
        .form-field textarea,
        .form-field select {
            width: 100%;
            padding: 0.6rem 0.8rem;
            border: 1.5px solid var(--color-border, #e5e7eb);
            border-radius: 0.75rem;
            font-size: 0.95rem;
            background: white;
        }

        .form-field input:focus,
        .form-field textarea:focus,
        .form-field select:focus {
            outline: none;
            border-color: var(--color-primary, #10b981);
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }

        .location-map {
            width: 100%;
            height: 200px;
            border-radius: 1rem;
            border: 2px solid var(--color-primary, #10b981);
            margin-bottom: 0.75rem;
        }

        .btn-save {
            width: 100%;
            padding: 0.85rem;
            background: var(--color-primary, #10b981);
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
            color: var(--color-text-faint, #9ca3af);
            pointer-events: none;
        }

        .search-results {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1.5px solid var(--color-border, #e5e7eb);
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
    </style>
</head>

<body class="bg-[var(--color-bg-base)] text-[var(--color-text)] font-sans min-h-screen pb-24"
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
                searchQuery: '',
                searchResults: [],
                saving: false,
                errorMsg: '',
                map: null,
                marker: null,
                circle: null,

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
                            event_date: this.eventDate,
                            start_time: this.startTime,
                            end_time: this.endTime,
                            location: {
                                type: 'custom',
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
            };
        }
    </script>
</body>

</html>