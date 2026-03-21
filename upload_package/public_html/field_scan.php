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
<div class="field-scan" x-show="isActive" x-cloak style="display:flex; flex-direction:column">
    <canvas x-ref="canvas" class="hidden"></canvas>

    <!-- トップバー -->
    <div class="flex items-center justify-between p-2 bg-black flex-shrink-0" style="padding-top: max(env(safe-area-inset-top), 8px)">
        <button @click="stop()" class="p-2 rounded-full bg-white/10">
            <i data-lucide="x" class="w-5 h-5"></i>
        </button>
        <div class="flex gap-1.5">
            <span class="sensor-pill" :class="sensors.camera ? 'sensor-active' : 'sensor-inactive'">📷</span>
            <span class="sensor-pill" :class="sensors.audio ? 'sensor-active' : 'sensor-inactive'">🎤</span>
            <span class="sensor-pill" :class="sensors.gps ? 'sensor-active' : 'sensor-inactive'">📍</span>
        </div>
        <div class="flex items-center gap-2 text-xs">
            <span class="text-gray-400 font-mono" x-text="elapsed"></span>
            <span class="px-2 py-0.5 rounded-full bg-green-900/50 text-green-400 font-bold text-[11px]">
                🐦<span x-text="audioDetections"></span>
                📷<span x-text="totalDetections - audioDetections"></span>
            </span>
        </div>
    </div>

    <!-- 上半分: カメラ + 検出オーバーレイ -->
    <div class="relative flex-1" style="min-height:0">
        <video x-ref="video" autoplay playsinline muted class="absolute inset-0 w-full h-full object-cover"></video>

        <!-- 検出フロート（カメラの上に表示） -->
        <template x-if="latestDetection">
            <div class="absolute inset-x-0 bottom-2 flex justify-center"
                 x-transition:enter="transition ease-out duration-300"
                 x-transition:enter-start="opacity-0 translate-y-4"
                 x-transition:enter-end="opacity-100 translate-y-0">
                <div class="bg-black/70 backdrop-blur-xl rounded-2xl px-5 py-3 text-center max-w-[80%]">
                    <div class="text-xl font-black" x-text="latestDetection.name"></div>
                    <div class="text-xs text-gray-300 italic" x-text="latestDetection.scientific_name"></div>
                    <div class="flex items-center justify-center gap-2 text-[11px] mt-1">
                        <span class="px-2 py-0.5 rounded-full"
                              :class="latestDetection.confidence >= 0.7 ? 'bg-green-500/30 text-green-300' : 'bg-amber-500/30 text-amber-300'"
                              x-text="Math.round(latestDetection.confidence * 100) + '%'"></span>
                        <span class="text-gray-500" x-text="latestDetection.source === 'audio' ? '🎤 音声' : '📷 カメラ'"></span>
                    </div>
                </div>
            </div>
        </template>
    </div>

    <!-- 下半分: 地図 + 種リスト -->
    <div class="flex-shrink-0 bg-black" style="height: 45%">
        <!-- タブ切替 -->
        <div class="flex gap-1 px-2 py-1.5 bg-black">
            <button @click="bottomPanel = 'map'" class="text-[11px] px-2.5 py-1 rounded-full"
                    :class="bottomPanel === 'map' ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-500'">
                🗺️ マップ
            </button>
            <button @click="bottomPanel = 'species'" class="text-[11px] px-2.5 py-1 rounded-full"
                    :class="bottomPanel === 'species' ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-500'">
                🌿 種リスト (<span x-text="Object.keys(speciesMap).length"></span>)
            </button>
        </div>

        <!-- マップ（常に DOM に存在、表示/非表示のみ） -->
        <div x-show="bottomPanel === 'map'" class="w-full border-t border-white/10" style="height: calc(100% - 36px)">
            <div x-ref="minimap" class="w-full h-full"></div>
        </div>

        <!-- 種リスト -->
        <div x-show="bottomPanel === 'species'" class="overflow-y-auto px-2 pb-2 space-y-1" style="height: calc(100% - 36px)">
            <template x-for="[name, data] in Object.entries(speciesMap)" :key="name">
                <div class="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
                    <span class="text-xs" x-text="data.source === 'audio' ? '🐦' : '🌿'"></span>
                    <span class="text-sm font-medium flex-1" x-text="name"></span>
                    <span class="text-xs text-gray-500" x-text="'×' + data.count"></span>
                    <span class="text-xs" :class="data.confidence >= 0.7 ? 'text-green-400' : 'text-amber-400'"
                          x-text="Math.round(data.confidence * 100) + '%'"></span>
                </div>
            </template>
            <div x-show="Object.keys(speciesMap).length === 0" class="text-center text-xs text-gray-600 py-8">
                まだ検出なし — 歩いて待ちましょう
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
            <p class="text-gray-500 mt-2">歩くだけで周囲の生き物を自動検出。すべてのデータが1つの地図に蓄積されます。</p>
        </div>

        <!-- 起動ボタン -->
        <button @click="start()"
                class="w-full py-5 bg-green-600 hover:bg-green-700 rounded-2xl text-lg font-bold transition flex items-center justify-center gap-3">
            <i data-lucide="radar" class="w-6 h-6"></i>
            ライブスキャン開始
        </button>

        <!-- しくみ -->
        <div class="bg-white/5 rounded-xl p-4 space-y-2 text-xs text-gray-400">
            <div class="flex items-start gap-2"><span class="text-green-400">🎤</span><span>周囲の音から <strong class="text-white">BirdNET AI（6,522種）</strong>が鳥を自動判定</span></div>
            <div class="flex items-start gap-2"><span class="text-blue-400">📷</span><span>カメラ映像から植物・昆虫・動物を <strong class="text-white">Gemini AI</strong> が種同定</span></div>
            <div class="flex items-start gap-2"><span class="text-purple-400">📍</span><span>すべての検出にGPS座標を紐づけ。地球規模のデジタルツインに蓄積</span></div>
        </div>
    </div>
</div>

<script nonce="<?= CspNonce::attr() ?>">
function fieldScan() {
    return {
        isActive: false,
        sessionId: '',
        bottomPanel: 'species',
        elapsed: '0:00',
        startTime: null,
        sensors: { camera: false, audio: false, gps: false, motion: false },
        speciesMap: {},
        totalDetections: 0,
        audioDetections: 0,
        routePoints: [],
        latestDetection: null,
        // pastAreas removed — no area concept, all data is GPS-coordinated

        // Internals
        _stream: null,
        _audioCtx: null,
        _watchId: null,
        _timerInterval: null,
        _captureInterval: null,
        _audioInterval: null,
        _minimap: null,

        async start() {
            // エリア概念なし。セッションIDだけ生成
            this.sessionId = 'scan_' + Date.now();
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

            // ミニマップにマーカー追加
            if (this._minimap && this.routePoints.length > 0) {
                var last = this.routePoints[this.routePoints.length - 1];
                var el = document.createElement('div');
                el.style.cssText = 'font-size:18px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))';
                el.textContent = source === 'audio' ? '🐦' : '🌿';
                el.title = name;
                new maplibregl.Marker({element: el}).setLngLat([last.lng, last.lat]).addTo(this._minimap);
            }

            // 3秒後にフェード
            setTimeout(() => {
                if (this.latestDetection?.name === name) this.latestDetection = null;
            }, 3000);
        },

        initMinimap() {
            if (!this.$refs.minimap || this._minimap) return;
            const last = this.routePoints[this.routePoints.length - 1];
            const center = last ? [last.lng, last.lat] : [139.6917, 35.6895];

            // bottomPanel を map に切り替えて描画領域を確保
            this.bottomPanel = 'map';

            this._minimap = new maplibregl.Map({
                container: this.$refs.minimap,
                style: { version: 8, sources: {
                    osm: { type: 'raster', tiles: ['https://tile.openstreetmap.jp/styles/osm-bright-ja/{z}/{x}/{y}.png'], tileSize: 256 }
                }, layers: [{ id: 'osm', type: 'raster', source: 'osm' }] },
                center, zoom: 16,
            });

            // 描画サイズ修正（x-show 切り替え後に必要）
            var mm = this._minimap;
            setTimeout(function() { mm.resize(); }, 200);

            // 現在地マーカー
            this._minimap.on('load', () => {
                var el = document.createElement('div');
                el.style.cssText = 'width:12px;height:12px;background:#3b82f6;border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(59,130,246,0.5)';
                this._posMarker = new maplibregl.Marker({element: el}).setLngLat(center).addTo(mm);
            });
        },

        updateMinimap() {
            if (!this._minimap) return;
            const last = this.routePoints[this.routePoints.length - 1];
            if (!last) return;
            this._minimap.easeTo({center: [last.lng, last.lat], duration: 500});
            if (this._posMarker) this._posMarker.setLngLat([last.lng, last.lat]);
            if (this.routePoints.length < 2) return;

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
                    body: JSON.stringify({ session_id: this.sessionId, scan_data: scanData }),
                });

                alert('ライブスキャン完了! ' + Object.keys(this.speciesMap).length + '種検出、' + this.totalDetections + '件記録');
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
