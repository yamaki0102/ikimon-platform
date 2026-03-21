<?php
/**
 * field_scan.php — ライブスキャン
 *
 * 全センサー統合モード。起動して歩き回るだけで、
 * エリアの3D生態系モデルが自動構築される。
 *
 * カメラ(種検出) + 音声(鳥声) + GPS(ルート) + 加速度(行動)
 * → EcosystemMapper で統合 → 3D GeoJSON + 種リスト + スコア
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();

$currentUser = Auth::user();
if (!$currentUser) {
    header('Location: login.php?redirect=field_scan.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php
    $meta_title = "ライブスキャン | ikimon.life";
    include __DIR__ . '/components/meta.php';
    ?>
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
    <script src="https://unpkg.com/maplibre-gl@4.1.0/dist/maplibre-gl.js"></script>
    <link href="https://unpkg.com/maplibre-gl@4.1.0/dist/maplibre-gl.css" rel="stylesheet">
    <style>
        .field-scan { position: fixed; inset: 0; z-index: 50; background: #000; }
        .sensor-pill { font-size: 10px; padding: 2px 8px; border-radius: 999px; }
        .sensor-active { background: rgba(34,197,94,0.2); color: #4ade80; }
        .sensor-inactive { background: rgba(255,255,255,0.05); color: #666; }
        @keyframes breathe { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        .breathe { animation: breathe 2s ease-in-out infinite; }
    </style>
</head>
<body class="bg-black text-white" x-data="fieldScan()">

<!-- ライブスキャン画面 -->
<div class="field-scan" x-show="isActive" x-cloak>
    <!-- カメラ映像（背景） -->
    <video x-ref="video" autoplay playsinline muted class="absolute inset-0 w-full h-full object-cover"></video>
    <canvas x-ref="canvas" class="hidden"></canvas>

    <!-- UI オーバーレイ -->
    <div class="absolute inset-0 flex flex-col">

        <!-- トップバー -->
        <div class="flex items-center justify-between p-3 bg-gradient-to-b from-black/70 to-transparent">
            <button @click="stop()" class="p-2 rounded-full bg-white/10 backdrop-blur-sm">
                <i data-lucide="x" class="w-5 h-5"></i>
            </button>

            <!-- センサーステータス -->
            <div class="flex gap-1.5">
                <span class="sensor-pill" :class="sensors.camera ? 'sensor-active' : 'sensor-inactive'">📷</span>
                <span class="sensor-pill" :class="sensors.audio ? 'sensor-active' : 'sensor-inactive'">🎤</span>
                <span class="sensor-pill" :class="sensors.gps ? 'sensor-active' : 'sensor-inactive'">📍</span>
                <span class="sensor-pill" :class="sensors.motion ? 'sensor-active' : 'sensor-inactive'">📊</span>
            </div>

            <!-- タイマー + 種カウント -->
            <div class="flex items-center gap-3 text-xs">
                <span class="text-gray-400 font-mono" x-text="elapsed"></span>
                <span class="px-2 py-1 rounded-full bg-green-900/50 text-green-400 font-bold">
                    <span x-text="Object.keys(speciesMap).length"></span>種
                </span>
            </div>
        </div>

        <!-- 中央: 検出フロート -->
        <div class="flex-1 flex items-center justify-center">
            <template x-if="latestDetection">
                <div class="text-center bg-black/60 backdrop-blur-xl rounded-3xl px-8 py-5 max-w-xs"
                     x-transition:enter="transition ease-out duration-300"
                     x-transition:enter-start="opacity-0 scale-90"
                     x-transition:enter-end="opacity-100 scale-100">
                    <div class="text-3xl font-black mb-1" x-text="latestDetection.name"></div>
                    <div class="text-sm text-gray-300 italic mb-2" x-text="latestDetection.scientific_name"></div>
                    <div class="flex items-center justify-center gap-3 text-xs">
                        <span class="px-2 py-1 rounded-full"
                              :class="latestDetection.confidence >= 0.7 ? 'bg-green-500/30 text-green-300' : 'bg-amber-500/30 text-amber-300'"
                              x-text="Math.round(latestDetection.confidence * 100) + '%'"></span>
                        <span class="text-gray-500" x-text="latestDetection.source === 'audio' ? '🎤 音声' : '📷 カメラ'"></span>
                        <span class="text-gray-600" x-text="latestDetection.zone || ''"></span>
                    </div>
                </div>
            </template>
        </div>

        <!-- 下部パネル -->
        <div class="bg-gradient-to-t from-black/80 to-transparent pt-8 pb-6 px-4">

            <!-- ミニマップ + 種リスト の切替 -->
            <div class="flex gap-2 mb-3">
                <button @click="bottomPanel = 'map'" class="text-xs px-3 py-1.5 rounded-full"
                        :class="bottomPanel === 'map' ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-500'">
                    🗺️ マップ
                </button>
                <button @click="bottomPanel = 'species'" class="text-xs px-3 py-1.5 rounded-full"
                        :class="bottomPanel === 'species' ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-500'">
                    🌿 種リスト
                </button>
                <button @click="bottomPanel = 'stats'" class="text-xs px-3 py-1.5 rounded-full"
                        :class="bottomPanel === 'stats' ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-500'">
                    📊 統計
                </button>
            </div>

            <!-- ミニマップ -->
            <div x-show="bottomPanel === 'map'" class="h-32 rounded-xl overflow-hidden border border-white/10">
                <div x-ref="minimap" class="w-full h-full"></div>
            </div>

            <!-- 種リスト -->
            <div x-show="bottomPanel === 'species'" class="h-32 overflow-y-auto space-y-1 scrollbar-thin">
                <template x-for="[name, data] in Object.entries(speciesMap)" :key="name">
                    <div class="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
                        <span class="text-xs" x-text="data.source === 'audio' ? '🎤' : '📷'"></span>
                        <span class="text-sm font-medium flex-1" x-text="name"></span>
                        <span class="text-xs text-gray-500" x-text="'×' + data.count"></span>
                        <span class="text-xs" :class="data.confidence >= 0.7 ? 'text-green-400' : 'text-amber-400'"
                              x-text="Math.round(data.confidence * 100) + '%'"></span>
                    </div>
                </template>
            </div>

            <!-- 統計 -->
            <div x-show="bottomPanel === 'stats'" class="h-32 grid grid-cols-4 gap-2">
                <div class="bg-white/5 rounded-lg p-2 text-center">
                    <div class="text-lg font-black text-green-400" x-text="Object.keys(speciesMap).length"></div>
                    <div class="text-[10px] text-gray-500">種数</div>
                </div>
                <div class="bg-white/5 rounded-lg p-2 text-center">
                    <div class="text-lg font-black" x-text="totalDetections"></div>
                    <div class="text-[10px] text-gray-500">検出</div>
                </div>
                <div class="bg-white/5 rounded-lg p-2 text-center">
                    <div class="text-lg font-black text-blue-400" x-text="routePoints.length"></div>
                    <div class="text-[10px] text-gray-500">GPS点</div>
                </div>
                <div class="bg-white/5 rounded-lg p-2 text-center">
                    <div class="text-lg font-black text-amber-400" x-text="audioDetections"></div>
                    <div class="text-[10px] text-gray-500">音声検出</div>
                </div>
            </div>

        </div>
    </div>
</div>

<!-- スタート画面 -->
<div x-show="!isActive" class="min-h-screen">
    <?php include __DIR__ . '/components/nav.php'; ?>

    <div class="max-w-lg mx-auto px-4 py-8 space-y-6" style="padding-top: calc(var(--nav-height, 56px) + 2rem)">
        <div class="text-center">
            <div class="text-6xl mb-4">🌍</div>
            <h1 class="text-2xl font-black">ライブスキャン</h1>
            <p class="text-gray-500 mt-2">起動して歩くだけで、エリアの生態系3Dモデルが構築される</p>
        </div>

        <!-- エリア選択 -->
        <div>
            <label class="text-sm text-gray-500 block mb-2">スキャンエリア</label>
            <input type="text" x-model="areaName" placeholder="例: 武蔵野公園、自宅周辺..."
                   class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:border-green-500 focus:outline-none">
            <p class="text-xs text-gray-600 mt-1">同じ名前で何度もスキャンすると、データが蓄積されていきます</p>
        </div>

        <!-- 起動ボタン -->
        <button @click="start()"
                class="w-full py-5 bg-green-600 hover:bg-green-700 rounded-2xl text-lg font-bold transition flex items-center justify-center gap-3">
            <i data-lucide="radar" class="w-6 h-6"></i>
            ライブスキャン開始
        </button>

        <!-- 使うセンサーの説明 -->
        <div class="grid grid-cols-2 gap-3">
            <div class="bg-white/5 rounded-xl p-3 text-center">
                <div class="text-2xl mb-1">📷</div>
                <div class="text-xs text-gray-400">カメラで種を検出</div>
            </div>
            <div class="bg-white/5 rounded-xl p-3 text-center">
                <div class="text-2xl mb-1">🎤</div>
                <div class="text-xs text-gray-400">音声で鳥声を検出</div>
            </div>
            <div class="bg-white/5 rounded-xl p-3 text-center">
                <div class="text-2xl mb-1">📍</div>
                <div class="text-xs text-gray-400">GPS でルート記録</div>
            </div>
            <div class="bg-white/5 rounded-xl p-3 text-center">
                <div class="text-2xl mb-1">📊</div>
                <div class="text-xs text-gray-400">センサーで環境記録</div>
            </div>
        </div>

        <!-- 過去のエリア -->
        <div x-show="pastAreas.length > 0">
            <h3 class="text-sm font-bold text-gray-500 mb-2">スキャン済みエリア</h3>
            <div class="space-y-2">
                <template x-for="area in pastAreas" :key="area.id">
                    <a :href="'ecosystem_view.php?area=' + area.id"
                       class="block bg-white/5 rounded-xl p-3 hover:bg-white/10 transition">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="font-medium text-sm" x-text="area.name"></div>
                                <div class="text-xs text-gray-500" x-text="area.species + '種 · ' + area.scans + '回スキャン'"></div>
                            </div>
                            <i data-lucide="chevron-right" class="w-4 h-4 text-gray-600"></i>
                        </div>
                    </a>
                </template>
            </div>
        </div>
    </div>
</div>

<script nonce="<?= CspNonce::attr() ?>">
function fieldScan() {
    return {
        isActive: false,
        areaName: '',
        areaId: '',
        bottomPanel: 'species',
        elapsed: '0:00',
        startTime: null,
        sensors: { camera: false, audio: false, gps: false, motion: false },
        speciesMap: {},
        totalDetections: 0,
        audioDetections: 0,
        routePoints: [],
        latestDetection: null,
        pastAreas: JSON.parse(localStorage.getItem('ikimon_field_areas') || '[]'),

        // Internals
        _stream: null,
        _audioCtx: null,
        _watchId: null,
        _timerInterval: null,
        _captureInterval: null,
        _audioInterval: null,
        _minimap: null,

        async start() {
            if (!this.areaName.trim()) {
                alert('エリア名を入力してください');
                return;
            }

            this.areaId = this.areaName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
            if (!this.areaId) this.areaId = 'area_' + Date.now();

            this.isActive = true;
            this.startTime = Date.now();
            this.speciesMap = {};
            this.totalDetections = 0;
            this.audioDetections = 0;
            this.routePoints = [];

            // タイマー
            this._timerInterval = setInterval(() => {
                const s = Math.floor((Date.now() - this.startTime) / 1000);
                this.elapsed = Math.floor(s/60) + ':' + String(s%60).padStart(2, '0');
            }, 1000);

            // カメラ
            try {
                this._stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 1920 } },
                    audio: true,
                });
                this.$refs.video.srcObject = this._stream;
                this.sensors.camera = true;
                this.sensors.audio = true;

                // カメラキャプチャ（4秒間隔）
                this._captureInterval = setInterval(() => this.captureAndClassify(), 4000);

                // 音声録音 + BirdNET 分析（3秒チャンク）
                this._setupAudioRecorder(this._stream);
            } catch (e) {
                console.warn('Camera/audio error:', e);
            }

            // GPS
            if (navigator.geolocation) {
                this._watchId = navigator.geolocation.watchPosition(
                    pos => {
                        this.sensors.gps = true;
                        this.routePoints.push({
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                            alt: pos.coords.altitude || 0,
                            timestamp: new Date().toISOString(),
                            heading: pos.coords.heading,
                        });
                        this.updateMinimap();
                    }, () => {}, { enableHighAccuracy: true, maximumAge: 3000 }
                );
            }

            // モーションセンサー
            if (window.DeviceMotionEvent) {
                this.sensors.motion = true;
            }

            // ミニマップ初期化（少し遅延）
            setTimeout(() => this.initMinimap(), 500);
        },

        stop() {
            this.isActive = false;
            clearInterval(this._timerInterval);
            clearInterval(this._captureInterval);
            if (this._recordingTimer) clearTimeout(this._recordingTimer);
            if (this._audioRecorder && this._audioRecorder.state === 'recording') {
                try { this._audioRecorder.stop(); } catch (e) { /* ignore */ }
            }
            if (this._watchId) navigator.geolocation.clearWatch(this._watchId);
            if (this._stream) this._stream.getTracks().forEach(t => t.stop());
            if (this._audioCtx) this._audioCtx.close();

            // サーバーに送信
            this.uploadToServer();
        },

        async captureAndClassify() {
            try {
                const v = this.$refs.video;
                const c = this.$refs.canvas;
                c.width = v.videoWidth;
                c.height = v.videoHeight;
                c.getContext('2d').drawImage(v, 0, 0);

                const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
                const fd = new FormData();
                fd.append('photo', blob, 'field.jpg');

                const last = this.routePoints[this.routePoints.length - 1];
                if (last) {
                    fd.append('lat', last.lat);
                    fd.append('lng', last.lng);
                }

                const resp = await fetch('/api/v2/ai_classify.php', { method: 'POST', body: fd });
                const json = await resp.json();

                if (json.success && json.data?.suggestions?.length > 0) {
                    for (const sug of json.data.suggestions) {
                        this.addDetection(sug.name, sug.scientific_name || '', sug.confidence, 'visual');
                    }
                }
            } catch (e) { /* ignore */ }
        },

        /**
         * 音声ストリームから MediaRecorder を作成し、3秒チャンクで BirdNET API に送信
         */
        _setupAudioRecorder(stream) {
            // 音声トラックのみを抽出
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
                console.warn('No audio tracks available');
                return;
            }
            const audioStream = new MediaStream(audioTracks);

            // MIME タイプ検出（iOS Safari は webm 非対応 → mp4 フォールバック）
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/mp4')
                    ? 'audio/mp4'
                    : '';

            if (!mimeType) {
                console.warn('No supported audio recording format');
                return;
            }

            this._audioRecorder = new MediaRecorder(audioStream, { mimeType });
            this._audioChunks = [];
            this._isAudioAnalyzing = false;
            this._audioMimeType = mimeType;

            this._audioRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this._audioChunks.push(e.data);
            };

            this._audioRecorder.onstop = () => {
                if (this._audioChunks.length === 0 || !this.isActive) return;
                const blob = new Blob(this._audioChunks, { type: mimeType });
                this._audioChunks = [];
                this._sendAudioChunk(blob);
            };

            this._startAudioCycle();
        },

        _startAudioCycle() {
            if (!this.isActive || !this._audioRecorder) return;
            if (this._isAudioAnalyzing) {
                this._recordingTimer = setTimeout(() => this._startAudioCycle(), 1000);
                return;
            }
            try {
                this._audioChunks = [];
                this._audioRecorder.start();
                this._recordingTimer = setTimeout(() => {
                    if (this._audioRecorder && this._audioRecorder.state === 'recording') {
                        this._audioRecorder.stop();
                    }
                }, 3000);
            } catch (err) {
                console.warn('Audio recording error:', err);
                this._recordingTimer = setTimeout(() => this._startAudioCycle(), 5000);
            }
        },

        async _sendAudioChunk(blob) {
            if (!this.isActive) return;
            this._isAudioAnalyzing = true;

            try {
                const lastPoint = this.routePoints.length > 0
                    ? this.routePoints[this.routePoints.length - 1]
                    : null;

                const formData = new FormData();
                const ext = this._audioMimeType.includes('mp4') ? '.mp4' : '.webm';
                formData.append('audio', blob, `snippet${ext}`);
                formData.append('lat', lastPoint?.lat ?? 35.0);
                formData.append('lng', lastPoint?.lng ?? 139.0);

                const resp = await fetch('/api/v2/analyze_audio.php', {
                    method: 'POST',
                    body: formData,
                });

                if (!resp.ok) {
                    if (resp.status === 429) await new Promise(r => setTimeout(r, 5000));
                    return;
                }

                const json = await resp.json();
                if (json.success && json.data?.detections) {
                    for (const d of json.data.detections) {
                        const name = d.common_name || d.scientific_name;
                        this.addDetection(name, d.scientific_name, d.confidence, 'audio');
                        this.audioDetections++;
                    }
                }
            } catch (err) {
                console.warn('Audio analysis error:', err);
            } finally {
                this._isAudioAnalyzing = false;
                if (this.isActive) this._startAudioCycle();
            }
        },

        addDetection(name, scientific, confidence, source) {
            this.totalDetections++;

            if (!this.speciesMap[name]) {
                this.speciesMap[name] = { count: 0, confidence: 0, source };
                // 新種 → バイブレーション
                if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
            }
            this.speciesMap[name].count++;
            this.speciesMap[name].confidence = Math.max(this.speciesMap[name].confidence, confidence);

            this.latestDetection = { name, scientific_name: scientific, confidence, source };

            // 3秒後にフェード
            setTimeout(() => {
                if (this.latestDetection?.name === name) this.latestDetection = null;
            }, 3000);
        },

        initMinimap() {
            if (!this.$refs.minimap || this._minimap) return;
            const last = this.routePoints[this.routePoints.length - 1];
            const center = last ? [last.lng, last.lat] : [139.6917, 35.6895];

            this._minimap = new maplibregl.Map({
                container: this.$refs.minimap,
                style: { version: 8, sources: {
                    osm: { type: 'raster', tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'], tileSize: 256 }
                }, layers: [{ id: 'osm', type: 'raster', source: 'osm' }] },
                center, zoom: 16,
                interactive: false,
            });
        },

        updateMinimap() {
            if (!this._minimap || this.routePoints.length < 2) return;
            const last = this.routePoints[this.routePoints.length - 1];
            this._minimap.setCenter([last.lng, last.lat]);

            // ルートライン更新
            const coords = this.routePoints.map(p => [p.lng, p.lat]);
            const source = this._minimap.getSource('route');
            if (source) {
                source.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } });
            } else if (this._minimap.loaded()) {
                this._minimap.addSource('route', {
                    type: 'geojson',
                    data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } },
                });
                this._minimap.addLayer({ id: 'route', type: 'line', source: 'route',
                    paint: { 'line-color': '#4ade80', 'line-width': 3 } });
            }
        },

        async uploadToServer() {
            const scanData = {
                route: this.routePoints,
                detections: Object.entries(this.speciesMap).map(([name, data]) => ({
                    taxon_name: name,
                    confidence: data.confidence,
                    type: data.source,
                    lat: this.routePoints[this.routePoints.length - 1]?.lat,
                    lng: this.routePoints[this.routePoints.length - 1]?.lng,
                    timestamp: new Date().toISOString(),
                })),
                audio_events: [],
                environment: [],
            };

            try {
                await fetch('/api/v2/ecosystem_map.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ area_id: this.areaId, scan_data: scanData }),
                });

                // ローカルにエリアを保存
                const areas = JSON.parse(localStorage.getItem('ikimon_field_areas') || '[]');
                const existing = areas.find(a => a.id === this.areaId);
                if (existing) {
                    existing.scans++;
                    existing.species = Object.keys(this.speciesMap).length;
                } else {
                    areas.push({
                        id: this.areaId,
                        name: this.areaName,
                        species: Object.keys(this.speciesMap).length,
                        scans: 1,
                    });
                }
                localStorage.setItem('ikimon_field_areas', JSON.stringify(areas));
                this.pastAreas = areas;

                alert(`ライブスキャン完了!\n${Object.keys(this.speciesMap).length}種検出、${this.totalDetections}件記録`);
            } catch (e) {
                console.error('Upload error:', e);
            }
        },
    };
}
</script>
<script nonce="<?= CspNonce::attr() ?>">if(typeof lucide!=='undefined')lucide.createIcons();</script>
</body>
</html>
