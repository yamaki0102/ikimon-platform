<?php
/**
 * scan.php — ブラウザ版スキャンモード
 *
 * カメラで生物を撮影すると AI がリアルタイムで種を推定する。
 * ネイティブアプリ不要、ikimon.life から直接アクセス可能。
 *
 * フロー:
 *   1. カメラ起動（getUserMedia）
 *   2. シャッターボタンまたは自動キャプチャ
 *   3. api/v2/ai_classify.php に送信
 *   4. 結果表示 → ワンタップでフィールドノート
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();

$currentUser = Auth::user();
if (!$currentUser) {
    header('Location: login.php?redirect=scan.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php
    $meta_title = "スキャンモード | ikimon.life";
    include __DIR__ . '/components/meta.php';
    ?>
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.9/dist/cdn.min.js"></script>
    <style>
        .scan-overlay { position: fixed; inset: 0; z-index: 40; background: #000; }
        .viewfinder { position: relative; width: 100%; height: 100%; }
        .viewfinder video { width: 100%; height: 100%; object-fit: cover; }
        .scan-ui { position: absolute; inset: 0; display: flex; flex-direction: column; pointer-events: none; }
        .scan-ui > * { pointer-events: auto; }
        .detection-badge {
            animation: fadeInUp 0.3s ease-out;
        }
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .pulse { animation: pulse 1.5s infinite; }
    </style>
</head>
<body class="bg-black text-white overflow-hidden" x-data="scanMode()">

<!-- スキャン画面 -->
<div class="scan-overlay" x-show="isActive" x-cloak>
    <div class="viewfinder">
        <!-- カメラ映像 -->
        <video x-ref="video" autoplay playsinline muted></video>
        <canvas x-ref="canvas" class="hidden"></canvas>

        <div class="scan-ui">
            <!-- トップバー -->
            <div class="flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
                <button @click="stop()" class="p-2 rounded-full bg-white/10 backdrop-blur">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>

                <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur text-xs">
                    <template x-if="isScanning">
                        <span class="flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-red-500 pulse"></span>
                            SCAN中
                            <span x-text="elapsedTime" class="font-mono"></span>
                        </span>
                    </template>
                </div>

                <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur text-xs">
                    <i data-lucide="leaf" class="w-3.5 h-3.5 text-green-400"></i>
                    <span x-text="detections.length" class="font-bold"></span>種
                </div>
            </div>

            <!-- 検出バッジ（中央に浮かぶ） -->
            <div class="flex-1 flex items-center justify-center">
                <template x-if="latestDetection">
                    <div class="detection-badge text-center bg-black/70 backdrop-blur-lg rounded-2xl px-6 py-4" :key="latestDetection.name">
                        <div class="text-2xl font-black" x-text="latestDetection.name"></div>
                        <div class="text-sm text-gray-300 italic" x-text="latestDetection.scientific_name"></div>
                        <div class="mt-2 flex items-center justify-center gap-2">
                            <div class="text-xs px-2 py-0.5 rounded-full"
                                 :class="latestDetection.confidence >= 0.7 ? 'bg-green-500/30 text-green-300' : 'bg-amber-500/30 text-amber-300'"
                                 x-text="Math.round(latestDetection.confidence * 100) + '%'"></div>
                            <template x-if="latestDetection.confidence >= 0.7">
                                <span class="text-green-400 text-xs">✓ 記録済み</span>
                            </template>
                        </div>
                    </div>
                </template>
            </div>

            <!-- 最近の検出リスト -->
            <div class="px-4 pb-2" x-show="detections.length > 0">
                <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                    <template x-for="det in detections.slice(-5).reverse()" :key="det.timestamp">
                        <div class="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur text-xs">
                            <span x-text="det.name" class="font-medium"></span>
                            <span class="text-gray-400" x-text="Math.round(det.confidence * 100) + '%'"></span>
                        </div>
                    </template>
                </div>
            </div>

            <!-- 下部コントロール -->
            <div class="flex items-center justify-center gap-8 pb-8 pt-4 bg-gradient-to-t from-black/60 to-transparent">
                <!-- 自動モード切替 -->
                <button @click="autoMode = !autoMode"
                        class="p-3 rounded-full"
                        :class="autoMode ? 'bg-green-600' : 'bg-white/10'">
                    <i data-lucide="scan-line" class="w-5 h-5"></i>
                </button>

                <!-- シャッター / キャプチャ -->
                <button @click="capture()"
                        class="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center"
                        :class="isProcessing ? 'opacity-50' : ''"
                        :disabled="isProcessing">
                    <div class="w-12 h-12 rounded-full" :class="isProcessing ? 'bg-amber-500 pulse' : 'bg-green-500'"></div>
                </button>

                <!-- カメラ切替 -->
                <button @click="switchCamera()"
                        class="p-3 rounded-full bg-white/10">
                    <i data-lucide="switch-camera" class="w-5 h-5"></i>
                </button>
            </div>
        </div>
    </div>
</div>

<!-- 開始画面（非スキャン時） -->
<div x-show="!isActive" class="min-h-screen flex flex-col items-center justify-center p-6">
    <?php include __DIR__ . '/components/navbar.php'; ?>

    <div class="text-center space-y-6 mt-20">
        <div class="text-6xl">📷</div>
        <h1 class="text-2xl font-black">スキャンモード</h1>
        <p class="text-gray-400 max-w-xs mx-auto">
            カメラを向けると、AI が生物を自動で検出して名前を教えてくれる
        </p>

        <button @click="start()"
                class="px-8 py-4 bg-green-600 hover:bg-green-700 rounded-xl text-lg font-bold transition flex items-center gap-3 mx-auto">
            <i data-lucide="camera" class="w-6 h-6"></i>
            スキャン開始
        </button>

        <div class="text-xs text-gray-600 space-y-1">
            <p>カメラと位置情報の許可が必要です</p>
            <p>撮影した写真は AI 同定にのみ使用されます</p>
        </div>
    </div>

    <!-- 過去の検出サマリー -->
    <template x-if="allDetections.length > 0">
        <div class="w-full max-w-sm mt-8">
            <h2 class="text-sm font-bold text-gray-500 mb-2">最近の検出</h2>
            <div class="bg-white/5 rounded-xl divide-y divide-white/5">
                <template x-for="det in allDetections.slice(-5).reverse()" :key="det.timestamp">
                    <div class="flex items-center gap-3 p-3">
                        <div class="w-10 h-10 rounded-lg bg-green-900/30 flex items-center justify-center text-green-400">
                            <i data-lucide="leaf" class="w-4 h-4"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-medium truncate" x-text="det.name"></div>
                            <div class="text-xs text-gray-500" x-text="det.scientific_name"></div>
                        </div>
                        <span class="text-xs text-gray-600" x-text="Math.round(det.confidence * 100) + '%'"></span>
                    </div>
                </template>
            </div>
        </div>
    </template>
</div>

<script nonce="<?= CspNonce::attr() ?>">
function scanMode() {
    return {
        isActive: false,
        isScanning: false,
        isProcessing: false,
        autoMode: false,
        autoInterval: null,
        startTime: null,
        elapsedTime: '0:00',
        timerInterval: null,
        detections: [],
        allDetections: JSON.parse(localStorage.getItem('ikimon_scan_detections') || '[]'),
        latestDetection: null,
        stream: null,
        facingMode: 'environment',

        async start() {
            try {
                this.stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: this.facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
                    audio: false,
                });
                this.$refs.video.srcObject = this.stream;
                this.isActive = true;
                this.isScanning = true;
                this.startTime = Date.now();
                this.detections = [];
                this.latestDetection = null;

                // タイマー
                this.timerInterval = setInterval(() => {
                    const sec = Math.floor((Date.now() - this.startTime) / 1000);
                    this.elapsedTime = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
                }, 1000);

                // 自動キャプチャ（3秒間隔）
                if (this.autoMode) {
                    this.startAutoCapture();
                }

                // 位置情報取得
                this.getLocation();
            } catch (err) {
                this._startError = err.message;
                alert('カメラの許可が必要です: ' + err.message);
            }
        },

        retryStart() {
            this._startError = null;
            this.start();
        },

        stop() {
            this.isActive = false;
            this.isScanning = false;
            clearInterval(this.timerInterval);
            clearInterval(this.autoInterval);
            if (this.stream) {
                this.stream.getTracks().forEach(t => t.stop());
                this.stream = null;
            }
            // 検出結果をローカルに保存（quota保護付き）
            this.allDetections.push(...this.detections);
            try {
                const data = JSON.stringify(this.allDetections.slice(-50));
                localStorage.setItem('ikimon_scan_detections', data);
            } catch (e) {
                this.allDetections = this.allDetections.slice(-20);
                try { localStorage.setItem('ikimon_scan_detections', JSON.stringify(this.allDetections)); } catch (e2) {}
            }
        },

        startAutoCapture() {
            this.autoInterval = setInterval(() => {
                if (!this.isProcessing && this.isScanning) {
                    this.capture();
                }
            }, 3000);
        },

        async capture() {
            if (this.isProcessing) return;
            this.isProcessing = true;

            try {
                const video = this.$refs.video;
                const canvas = this.$refs.canvas;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0);

                // JPEG に変換
                const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
                const formData = new FormData();
                formData.append('photo', blob, 'scan.jpg');

                if (this._lat) formData.append('lat', this._lat);
                if (this._lng) formData.append('lng', this._lng);

                // AI 分類 API 呼び出し
                const resp = await fetch('/api/v2/ai_classify.php', {
                    method: 'POST',
                    body: formData,
                });
                const json = await resp.json();

                if (json.success && json.data?.suggestions?.length > 0) {
                    for (const sug of json.data.suggestions) {
                        const det = {
                            name: sug.name,
                            scientific_name: sug.scientific_name || '',
                            confidence: sug.confidence,
                            lat: this._lat,
                            lng: this._lng,
                            timestamp: Date.now(),
                        };
                        this.detections.push(det);
                        this.latestDetection = det;

                        // 高信頼度 → 触覚フィードバック
                        if (sug.confidence >= 0.7 && navigator.vibrate) {
                            navigator.vibrate(50);
                        }
                    }
                }
            } catch (err) {
                console.error('Capture error:', err);
            } finally {
                this.isProcessing = false;
            }
        },

        async switchCamera() {
            if (this.isProcessing) return;
            this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
            try {
                if (this.stream) {
                    this.stream.getTracks().forEach(t => t.stop());
                }
                this.stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: this.facingMode },
                });
                this.$refs.video.srcObject = this.stream;
            } catch (err) {
                console.error('Camera switch failed:', err);
                this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
                try {
                    this.stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: this.facingMode },
                    });
                    this.$refs.video.srcObject = this.stream;
                } catch (e) {}
            }
        },

        getLocation() {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(pos => {
                    this._lat = pos.coords.latitude;
                    this._lng = pos.coords.longitude;
                }, () => {}, { enableHighAccuracy: true });
            }
        },

        // Alpine.js watch
        init() {
            this.$watch('autoMode', (val) => {
                clearInterval(this.autoInterval);
                if (val && this.isScanning) this.startAutoCapture();
            });
        }
    };
}
</script>
<script nonce="<?= CspNonce::attr() ?>">lucide.createIcons();</script>
</body>
</html>
