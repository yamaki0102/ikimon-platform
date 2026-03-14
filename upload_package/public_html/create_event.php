<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CSRF.php';
Auth::init();

if (!Auth::isLoggedIn()) {
    header('Location: login.php?redirect=create_event.php');
    exit;
}

$meta_title = "観察会をつくる";
$meta_description = "30秒で観察会を作成。場所と日時を選ぶだけ。";
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include('components/meta.php'); ?>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9/dist/leaflet.js"></script>
    <style>
        .wizard-step {
            display: none;
        }

        .wizard-step.active {
            display: block;
        }

        .step-indicator {
            display: flex;
            gap: 0.5rem;
            justify-content: center;
            margin-bottom: 1.5rem;
        }

        .step-dot {
            width: 2.5rem;
            height: 4px;
            border-radius: 2px;
            background: var(--color-border, #e5e7eb);
            transition: background 0.3s;
        }

        .step-dot.completed {
            background: var(--color-primary, #10b981);
        }

        .step-dot.current {
            background: var(--color-primary, #10b981);
        }

        .wizard-container {
            max-width: 480px;
            margin: 0 auto;
            padding: 1rem;
        }

        .location-map {
            width: 100%;
            height: 250px;
            border-radius: 1rem;
            overflow: hidden;
            border: 2px solid var(--color-primary, #10b981);
        }

        .meeting-map {
            width: 100%;
            height: 180px;
            border-radius: 0.75rem;
            overflow: hidden;
            border: 1.5px solid var(--color-border, #e5e7eb);
            margin-top: 0.5rem;
        }

        .form-field {
            margin-bottom: 1rem;
        }

        .form-field label {
            display: block;
            font-size: 0.8rem;
            font-weight: 700;
            color: var(--color-text-muted, #6b7280);
            margin-bottom: 0.35rem;
        }

        .form-field input,
        .form-field textarea,
        .form-field select {
            width: 100%;
            padding: 0.65rem 0.85rem;
            border: 1.5px solid var(--color-border, #e5e7eb);
            border-radius: 0.75rem;
            font-size: 0.95rem;
            background: white;
            transition: border-color 0.2s;
        }

        .form-field input:focus,
        .form-field textarea:focus,
        .form-field select:focus {
            outline: none;
            border-color: var(--color-primary, #10b981);
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }

        .time-row {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            gap: 0.5rem;
            align-items: center;
        }

        .time-row .separator {
            text-align: center;
            color: var(--color-text-muted);
            font-weight: 700;
        }

        .species-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-top: 0.5rem;
        }

        .species-chip {
            display: flex;
            align-items: center;
            gap: 0.3rem;
            background: var(--color-primary, #10b981);
            color: white;
            padding: 0.3rem 0.65rem;
            border-radius: 9999px;
            font-size: 0.8rem;
        }

        .species-chip button {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            opacity: 0.7;
            font-size: 1rem;
            line-height: 1;
        }

        .nav-buttons {
            display: flex;
            gap: 0.75rem;
            margin-top: 1.5rem;
        }

        .nav-buttons button {
            flex: 1;
            padding: 0.85rem;
            border-radius: 1rem;
            font-weight: 700;
            font-size: 0.95rem;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
        }

        .btn-back {
            background: var(--color-bg-surface, #f3f4f6);
            color: var(--color-text-muted, #6b7280);
        }

        .btn-next,
        .btn-create {
            background: var(--color-primary, #10b981);
            color: white;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .btn-next:hover,
        .btn-create:hover {
            transform: translateY(-1px);
        }

        .btn-next:disabled,
        .btn-create:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }

        .summary-card {
            background: white;
            border-radius: 1rem;
            padding: 1.25rem;
            border: 1.5px solid var(--color-border, #e5e7eb);
        }

        .summary-row {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 0;
            font-size: 0.9rem;
        }

        .summary-row .icon {
            font-size: 1.2rem;
        }

        .summary-row .label {
            color: var(--color-text-muted);
            font-size: 0.75rem;
            min-width: 3rem;
        }

        .success-screen {
            text-align: center;
            padding: 3rem 1rem;
        }

        .empty-state .emoji {
            font-size: 3.5rem;
            margin-bottom: 0.75rem;
        }

        .success-screen .emoji {
            font-size: 4rem;
            margin-bottom: 1rem;
        }

        .search-container {
            position: relative;
            margin-bottom: 0.75rem;
        }

        .search-container input {
            width: 100%;
            padding: 0.65rem 0.85rem 0.65rem 2.5rem;
            border: 1.5px solid var(--color-border, #e5e7eb);
            border-radius: 0.75rem;
            font-size: 0.95rem;
            background: white;
        }

        .search-container input:focus {
            outline: none;
            border-color: var(--color-primary, #10b981);
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
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
            border-bottom: 1px solid var(--color-border, #f3f4f6);
            transition: background 0.15s;
        }

        .search-results .result-item:last-child {
            border-bottom: none;
        }

        .search-results .result-item:hover {
            background: var(--color-bg-surface, #f0fdf4);
        }

        .success-screen h2 {
            font-size: 1.4rem;
            font-weight: 900;
            margin-bottom: 0.5rem;
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
            border: 1.5px solid var(--color-border, #e5e7eb);
            background: white;
            padding: 0.9rem;
            text-align: left;
            transition: all 0.2s;
        }

        .site-card.active {
            border-color: var(--color-primary, #10b981);
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

<body class="bg-[var(--color-bg-base)] text-[var(--color-text)] font-sans min-h-screen pb-24 safe-area-inset-bottom"
    x-data="createEvent()">

    <?php include('components/nav.php'); ?>

    <!-- Back Header -->
    <div class="flex items-center justify-between px-4 py-3">
        <a href="events.php" class="size-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
            <i data-lucide="arrow-left" class="w-5 h-5"></i>
        </a>
        <h1 class="text-base font-bold">観察会をつくる</h1>
        <div class="size-9"></div>
    </div>

    <!-- Step Indicator -->
    <div class="step-indicator">
        <div class="step-dot" :class="step >= 1 ? 'completed' : ''"></div>
        <div class="step-dot" :class="step >= 2 ? 'completed' : ''"></div>
        <div class="step-dot" :class="step >= 3 ? 'completed' : ''"></div>
    </div>

    <div class="wizard-container">

        <!-- ========== STEP 1: WHERE ========== -->
        <div class="wizard-step" :class="step === 1 ? 'active' : ''">
            <h2 class="text-lg font-black mb-1">📍 どこで？</h2>
            <p class="text-sm text-gray-400 mb-3">住所を検索するか、地図をタップして選んでね</p>

            <div x-show="sites.length > 0" class="mb-3">
                <div class="flex items-center justify-between mb-2">
                    <h3 class="text-xs font-black text-gray-600 tracking-[0.12em] uppercase">おすすめ Site</h3>
                    <button type="button" x-show="selectedSiteId" @click="clearSiteSelection()" class="text-xs font-bold text-gray-400">
                        解除
                    </button>
                </div>
                <div class="site-strip">
                    <template x-for="site in sites" :key="site.id">
                        <button type="button" class="site-card" :class="{ 'active': selectedSiteId === site.id }" @click="selectSite(site)">
                            <div class="flex items-center justify-between gap-2">
                                <span class="text-sm font-black text-gray-900" x-text="site.name"></span>
                                <span x-show="selectedSiteId === site.id" class="text-[10px] font-black text-emerald-600">選択中</span>
                            </div>
                            <p class="text-xs text-gray-500 mt-2" x-text="site.description || 'エリアと連動したイベントを作れます'"></p>
                            <div class="mt-3 text-[11px] font-bold text-emerald-700" x-text="'ID: ' + site.id"></div>
                        </button>
                    </template>
                </div>
            </div>

            <div class="search-container">
                <span class="search-icon">🔍</span>
                <input type="text" x-model="searchQuery" @input.debounce.400ms="searchAddress()"
                    placeholder="住所・場所名で検索（例: 城北公園）" autocomplete="off">
                <div class="search-results" x-show="searchResults.length > 0" @click.outside="searchResults = []">
                    <template x-for="(r, i) in searchResults" :key="i">
                        <div class="result-item" @click="selectSearchResult(r)">
                            <span x-text="r.display_name"></span>
                        </div>
                    </template>
                </div>
            </div>

            <div id="picker-map" class="location-map"></div>
            <button type="button" @click="locateMe()" class="mt-1.5 w-full flex items-center justify-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 py-2 rounded-lg transition">
                📍 現在地へ移動
            </button>

            <div class="form-field mt-4">
                <label>場所の名前（任意）</label>
                <input type="text" x-model="locationName" placeholder="例: 城北公園、里山田んぼ" maxlength="50">
            </div>

            <div class="form-field">
                <label>集約半径</label>
                <div class="flex items-center gap-3">
                    <input type="range" min="100" max="2000" step="100" x-model.number="radiusM"
                        class="flex-1" @input="updateRadiusCircle()">
                    <span class="text-sm font-bold text-emerald-600 w-16 text-right" x-text="radiusM + 'm'"></span>
                </div>
                <p class="text-xs text-gray-400 mt-1">この範囲内の投稿が自動で観察会に紐づくよ</p>
            </div>

            <div class="nav-buttons">
                <button class="btn-next" @click="goStep(2)" :disabled="!lat">
                    次へ →
                </button>
            </div>
        </div>

        <!-- ========== STEP 2: WHEN ========== -->
        <div class="wizard-step" :class="step === 2 ? 'active' : ''">
            <h2 class="text-lg font-black mb-1">📅 いつ？</h2>
            <p class="text-sm text-gray-400 mb-4">日時を選んでね</p>

            <div class="form-field">
                <label>日付</label>
                <input type="date" x-model="eventDate" :min="today">
            </div>

            <div class="form-field">
                <label>時間</label>
                <div class="time-row">
                    <input type="time" x-model="startTime">
                    <span class="separator">〜</span>
                    <input type="time" x-model="endTime">
                </div>
            </div>

            <div class="nav-buttons">
                <button class="btn-back" @click="goStep(1)">← 戻る</button>
                <button class="btn-next" @click="goStep(3)" :disabled="!eventDate">
                    次へ →
                </button>
            </div>
        </div>

        <!-- ========== STEP 3: CONFIRM ========== -->
        <div class="wizard-step" :class="step === 3 ? 'active' : ''">
            <h2 class="text-lg font-black mb-1">✅ 確認</h2>
            <p class="text-sm text-gray-400 mb-4">内容をチェックして作成！</p>

            <div class="summary-card">
                <div class="summary-row">
                    <span class="icon">📍</span>
                    <span x-text="locationName || '地図上の地点'"></span>
                </div>
                <div class="summary-row">
                    <span class="icon">📅</span>
                    <span x-text="formatDate()"></span>
                </div>
                <div class="summary-row">
                    <span class="icon">⏰</span>
                    <span x-text="startTime + ' 〜 ' + endTime"></span>
                </div>
                <div class="summary-row">
                    <span class="icon">📡</span>
                    <span x-text="'半径 ' + radiusM + 'm の投稿を自動集約'"></span>
                </div>
            </div>

            <div class="form-field mt-4">
                <label>タイトル（空欄なら自動生成）</label>
                <input type="text" x-model="title" :placeholder="autoTitle()" maxlength="60">
            </div>

            <div class="form-field">
                <label>メモ（任意・100字）</label>
                <textarea x-model="memo" rows="2" maxlength="100" placeholder="簡単な説明など"></textarea>
            </div>

            <div class="form-field">
                <label>🚩 集合場所（任意）</label>
                <input type="text" x-model="meetingPoint" placeholder="例: ○○公園の駐車場前、バス停横の東屋" maxlength="200">
                <div class="mt-2">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-xs text-gray-400">地図で集合地点をピン指定（タップで設定）</span>
                        <template x-if="meetingLat">
                            <span class="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">📍 設定済み</span>
                        </template>
                    </div>
                    <div id="meeting-map" class="meeting-map"></div>
                    <div class="flex items-center gap-2 mt-1" x-show="meetingLat">
                        <span class="text-xs text-gray-500" x-text="meetingLat ? meetingLat.toFixed(5) + ', ' + meetingLng.toFixed(5) : ''"></span>
                        <button type="button" @click="clearMeetingPin()" class="text-xs text-red-400 hover:text-red-600">✕ クリア</button>
                    </div>
                </div>
            </div>

            <div class="form-field">
                <label>🅿️ 駐車場（任意）</label>
                <input type="text" x-model="parkingInfo" placeholder="例: 無料駐車場あり（30台）、最寄りコインP徒歩3分" maxlength="200">
            </div>

            <div class="form-field">
                <label>🌧️ 雨天時（任意）</label>
                <select x-model="rainPolicy">
                    <option value="">未設定</option>
                    <option value="cancel">雨天中止</option>
                    <option value="light_ok">小雨決行</option>
                    <option value="rain_ok">雨天決行</option>
                </select>
            </div>

            <div class="form-field">
                <label>⚠️ 注意事項（任意・500字）</label>
                <textarea x-model="precautions" rows="3" maxlength="500" placeholder="例: 長靴推奨、虫除け持参、お子様連れOK"></textarea>
            </div>

            <div class="form-field">
                <label>見つけたい種（任意）</label>
                <div class="flex gap-2">
                    <input type="text" x-model="newSpecies" placeholder="種名を入力" maxlength="30"
                        @keydown.enter.prevent="addSpecies()">
                    <button @click="addSpecies()" class="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold">追加</button>
                </div>
                <div class="species-chips">
                    <template x-for="(sp, i) in targetSpecies" :key="i">
                        <span class="species-chip">
                            <span x-text="sp"></span>
                            <button @click="targetSpecies.splice(i, 1)">×</button>
                        </span>
                    </template>
                </div>
            </div>

            <div class="form-field">
                <label>参加方式</label>
                <select x-model="eventType">
                    <option value="open">誰でも参加できる</option>
                    <option value="invite">招待制</option>
                </select>
            </div>

            <div class="form-field">
                <label class="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" x-model="enableLeaderboard" class="mt-1">
                    <span>
                        <span class="block text-sm font-bold text-gray-700">イベント内ランキングを表示する</span>
                        <span class="block text-xs text-gray-400 mt-1">投稿数と発見種数を自動集計します</span>
                    </span>
                </label>
            </div>

            <div class="form-field">
                <label class="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" x-model="enableBingo" class="mt-1">
                    <span>
                        <span class="block text-sm font-bold text-gray-700">ビンゴカードを自動生成する</span>
                        <span class="block text-xs text-gray-400 mt-1">開催地に紐づく記録から 3x3 ビンゴを作ります</span>
                    </span>
                </label>
            </div>

            <div class="form-field">
                <label>助成金・プロジェクト紐付け（任意）</label>
                <select x-model="grantId">
                    <option value="">-- 指定なし --</option>
                    <option value="ToG_Nature_2025">ToG: 地域の自然史編纂助成 (2025)</option>
                    <option value="CSR_AcmeCorp_100">企業CSR: AcmeCorp 100年の森プロジェクト</option>
                    <option value="30by30_Shizuoka">自治体: 静岡30by30コンソーシアム</option>
                </select>
                <p class="text-xs text-gray-400 mt-1">この観察会の記録が自動的に指定プロジェクトのレポートに集計されます。</p>
            </div>

            <div class="nav-buttons">
                <button class="btn-back" @click="goStep(2)">← 戻る</button>
                <button class="btn-create" @click="createEvent()" :disabled="submitting">
                    <span x-show="!submitting">🎉 観察会をつくる！</span>
                    <span x-show="submitting" class="animate-pulse">作成中...</span>
                </button>
            </div>
        </div>

        <!-- ========== SUCCESS ========== -->
        <div class="wizard-step" :class="step === 4 ? 'active' : ''">
            <div class="success-screen">
                <div class="emoji">🎊</div>
                <h2>観察会ができたよ！</h2>
                <p class="text-sm text-gray-500 mb-6">URLをシェアすれば誰でも参加できる</p>

                <label>注意事項（持ち物・服装など）</label>
                <textarea x-model="precautions" rows="3" placeholder="長袖長ズボン推奨、飲み物持参など"></textarea>
            </div>

            <!-- Event Code -->
            <div class="form-field">
                <label>イベントコード（任意）</label>
                <div class="flex items-center gap-2">
                    <input type="text" x-model="eventCode" placeholder="英数字 (例: AKAMIMI2023)"
                        @input="eventCode = eventCode.toUpperCase().replace(/[^A-Z0-9]/g, '')">
                    <span class="text-xs text-gray-400 shrink-0">参加者が調査時に<br>入力するコード</span>
                </div>
            </div>

            <div class="summary-card text-left mb-4">
                <div class="summary-row">
                    <span class="icon">🔗</span>
                    <input type="text" :value="shareUrl" readonly
                        class="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        @click="$event.target.select()">
                </div>
            </div>

            <div class="flex gap-3">
                <button @click="copyUrl()" class="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-bold text-sm">
                    📋 URLをコピー
                </button>
                <a :href="'event_detail.php?id=' + createdId" class="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold text-sm text-center">
                    👀 観察会を見る
                </a>
            </div>
        </div>
    </div>



    <script nonce="<?= CspNonce::attr() ?>">
        function createEvent() {
            return {
                step: 1,
                lat: 0,
                lng: 0,
                locationName: '',
                radiusM: 500,
                eventDate: '',
                startTime: '09:00',
                endTime: '12:00',
                title: '',
                memo: '',
                meetingPoint: '',
                meetingLat: 0,
                meetingLng: 0,
                meetingMap: null,
                meetingMarker: null,
                parkingInfo: '',
                rainPolicy: '',
                rainPolicy: '',
                precautions: '',
                eventCode: '',
                eventType: 'open',
                grantId: '',
                enableBingo: false,
                enableLeaderboard: true,
                targetSpecies: [],
                newSpecies: '',
                submitting: false,
                createdId: '',
                shareUrl: '',
                today: new Date().toISOString().slice(0, 10),
                map: null,
                marker: null,
                circle: null,
                sites: [],
                selectedSiteId: '',
                searchQuery: '',
                searchResults: [],
                searchTimeout: null,

                init() {
                    this.$nextTick(() => {
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                        this.initMap();
                    });
                    this.loadSites();
                    // Default date to tomorrow
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    this.eventDate = tomorrow.toISOString().slice(0, 10);
                },

                initMap() {
                    // Default to user location or Japan center
                    this.map = L.map('picker-map').setView([34.97, 138.38], 12);
                    L.tileLayer('https://tile.openstreetmap.jp/{z}/{x}/{y}.png', {
                        maxZoom: 19,
                        attribution: '© OpenStreetMap'
                    }).addTo(this.map);

                    // Try geolocation
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                            (pos) => {
                                this.lat = pos.coords.latitude;
                                this.lng = pos.coords.longitude;
                                this.map.setView([this.lat, this.lng], 15);
                                this.placeMarker();
                            },
                            (err) => {
                                console.warn('Geolocation failed:', err.message);
                            }, {
                                enableHighAccuracy: true,
                                timeout: 10000,
                                maximumAge: 60000
                            }
                        );
                    }

                    // Click to place marker
                    this.map.on('click', (e) => {
                        this.lat = Math.round(e.latlng.lat * 100000) / 100000;
                        this.lng = Math.round(e.latlng.lng * 100000) / 100000;
                        this.placeMarker();
                    });
                },

                locateMe() {
                    if (!navigator.geolocation) {
                        alert('位置情報に対応していません');
                        return;
                    }
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            this.lat = pos.coords.latitude;
                            this.lng = pos.coords.longitude;
                            this.map.setView([this.lat, this.lng], 16);
                            this.placeMarker();
                        },
                        (err) => {
                            alert('位置情報を取得できませんでした。ブラウザの設定を確認してね');
                        }, {
                            enableHighAccuracy: true,
                            timeout: 10000,
                            maximumAge: 0
                        }
                    );
                },

                placeMarker() {
                    if (this.marker) this.map.removeLayer(this.marker);
                    if (this.circle) this.map.removeLayer(this.circle);

                    const pinIcon = L.divIcon({
                        className: '',
                        html: '<div style="font-size:28px;text-align:center;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3))">📍</div>',
                        iconSize: [30, 30],
                        iconAnchor: [15, 30]
                    });
                    this.marker = L.marker([this.lat, this.lng], {
                        icon: pinIcon
                    }).addTo(this.map);
                    this.circle = L.circle([this.lat, this.lng], {
                        radius: this.radiusM,
                        color: '#10b981',
                        fillColor: '#10b981',
                        fillOpacity: 0.1,
                        weight: 2
                    }).addTo(this.map);
                },

                updateRadiusCircle() {
                    if (this.circle) {
                        this.circle.setRadius(this.radiusM);
                    }
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
                    this.selectedSiteId = site.id;
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
                    this.selectedSiteId = '';
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
                        console.error('Geocoding error:', e);
                        this.searchResults = [];
                    }
                },

                selectSearchResult(result) {
                    this.lat = parseFloat(result.lat);
                    this.lng = parseFloat(result.lon);
                    this.searchResults = [];
                    this.searchQuery = '';
                    // Use short name for location
                    const parts = result.display_name.split(',');
                    if (!this.locationName && parts.length > 0) {
                        this.locationName = parts[0].trim();
                    }
                    this.map.setView([this.lat, this.lng], 16);
                    this.placeMarker();
                },

                goStep(n) {
                    this.step = n;
                    if (n === 1) {
                        this.$nextTick(() => {
                            if (this.map) this.map.invalidateSize();
                        });
                    }
                    if (n === 3) {
                        this.$nextTick(() => {
                            this.initMeetingMap();
                        });
                    }
                },

                initMeetingMap() {
                    if (this.meetingMap) {
                        this.meetingMap.invalidateSize();
                        return;
                    }
                    const center = this.lat ? [this.lat, this.lng] : [34.97, 138.38];
                    this.meetingMap = L.map('meeting-map').setView(center, this.lat ? 16 : 12);
                    L.tileLayer('https://tile.openstreetmap.jp/{z}/{x}/{y}.png', {
                        maxZoom: 19,
                        attribution: '© OSM'
                    }).addTo(this.meetingMap);
                    // Show event area circle as reference
                    if (this.lat) {
                        L.circle([this.lat, this.lng], {
                            radius: this.radiusM,
                            color: '#10b981',
                            fillColor: '#10b981',
                            fillOpacity: 0.05,
                            weight: 1,
                            dashArray: '4'
                        }).addTo(this.meetingMap);
                    }
                    this.meetingMap.on('click', (e) => {
                        this.meetingLat = Math.round(e.latlng.lat * 100000) / 100000;
                        this.meetingLng = Math.round(e.latlng.lng * 100000) / 100000;
                        this.placeMeetingMarker();
                    });
                },

                placeMeetingMarker() {
                    if (this.meetingMarker) this.meetingMap.removeLayer(this.meetingMarker);
                    const icon = L.divIcon({
                        className: '',
                        html: '<div style="font-size:24px;text-align:center;">🚩</div>',
                        iconSize: [30, 30],
                        iconAnchor: [15, 28]
                    });
                    this.meetingMarker = L.marker([this.meetingLat, this.meetingLng], {
                        icon
                    }).addTo(this.meetingMap);
                },

                clearMeetingPin() {
                    this.meetingLat = 0;
                    this.meetingLng = 0;
                    if (this.meetingMarker) {
                        this.meetingMap.removeLayer(this.meetingMarker);
                        this.meetingMarker = null;
                    }
                },

                autoTitle() {
                    if (!this.eventDate) return '自動生成されます';
                    const d = new Date(this.eventDate);
                    const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
                    const loc = this.locationName || '';
                    return `${d.getMonth()+1}/${d.getDate()}（${dow}）${loc ? ' ' + loc : ''} 観察会`;
                },

                formatDate() {
                    if (!this.eventDate) return '';
                    const d = new Date(this.eventDate);
                    const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
                    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${dow}）`;
                },

                addSpecies() {
                    const sp = this.newSpecies.trim();
                    if (sp && !this.targetSpecies.includes(sp) && this.targetSpecies.length < 20) {
                        this.targetSpecies.push(sp);
                        this.newSpecies = '';
                    }
                },

                async createEvent() {
                    this.submitting = true;
                    try {
                        const body = {
                            title: this.title || '',
                            memo: this.memo,
                            meeting_point: this.meetingPoint,
                            meeting_lat: this.meetingLat || null,
                            meeting_lng: this.meetingLng || null,
                            parking_info: this.parkingInfo,
                            rain_policy: this.rainPolicy,
                            precautions: this.precautions,
                            event_code: this.eventCode,
                            event_type: this.eventType,
                            grant_id: this.grantId,
                            enable_bingo: this.enableBingo,
                            enable_leaderboard: this.enableLeaderboard,
                            site_id: this.selectedSiteId || null,
                            event_date: this.eventDate,
                            start_time: this.startTime,
                            end_time: this.endTime,
                            location: {
                                type: this.selectedSiteId ? 'site' : 'custom',
                                site_id: this.selectedSiteId || null,
                                lat: this.lat,
                                lng: this.lng,
                                radius_m: this.radiusM,
                                name: this.locationName,
                            },
                            target_species: this.targetSpecies,
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
                            if (this.enableBingo && data.event?.id) {
                                await this.generateBingo(data.event.id, body);
                            }
                            this.createdId = data.event.id;
                            this.shareUrl = window.location.origin + '/event_detail.php?id=' + this.createdId;
                            this.step = 4;
                        } else {
                            alert(data.message || '作成に失敗しました');
                        }
                    } catch (e) {
                        alert('通信エラーが発生しました');
                        console.error(e);
                    } finally {
                        this.submitting = false;
                    }
                },

                copyUrl() {
                    navigator.clipboard.writeText(this.shareUrl).then(() => {
                        alert('URLをコピーしました！');
                    });
                },

                async generateBingo(eventId, body) {
                    try {
                        const res = await fetch('api/generate_bingo_template.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                event_id: eventId
                            }),
                        });
                        const data = await res.json();
                        if (!data.success) {
                            return;
                        }

                        await fetch('api/save_event.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                ...body,
                                id: eventId,
                                bingo_template_id: data.template_id,
                                bingo_species: data.cells || [],
                            }),
                        });
                    } catch (e) {
                        console.warn('Bingo generation failed:', e);
                    }
                },
            };
        }
    </script>
</body>

</html>
