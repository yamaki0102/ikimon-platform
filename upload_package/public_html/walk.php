<?php
/**
 * walk.php — ブラウザ版ウォークモード
 *
 * GPS追跡 + 環境音モニタリング（画面ON中限定）。
 * ネイティブアプリのポケットモードの簡易Web版。
 *
 * 制約: ブラウザタブが開いている間のみ動作。
 *       バックグラウンドでは GPS/音声ともに停止する。
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
Auth::init();

$currentUser = Auth::user();
if (!$currentUser) {
    header('Location: login.php?redirect=walk.php');
    exit;
}

// ユーザーの過去ウォークデータ集計
$userId = $currentUser['id'] ?? '';
$allObs = DataStore::fetchAll('observations');
$userObs = array_filter($allObs, fn($o) => ($o['user_id'] ?? '') === $userId);
$totalUserObs = count($userObs);
$userSpecies = count(array_unique(array_filter(array_map(fn($o) => $o['taxon']['scientific_name'] ?? $o['taxon']['name'] ?? null, $userObs))));

// 直近の音声検出（全ユーザー）— Canonical Schema がまだ少ないので JSON からも
$recentAudioObs = array_filter($allObs, fn($o) => ($o['observation_source'] ?? '') === 'walk' || ($o['model'] ?? '') === 'birdnet-v2.4');
$recentAudioCount = count($recentAudioObs);

// 全体統計
$totalObs = count($allObs);
$totalSpecies = count(array_unique(array_filter(array_map(fn($o) => $o['taxon']['scientific_name'] ?? $o['taxon']['name'] ?? null, $allObs))));
unset($allObs);
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php
    $meta_title = "ウォークモード | ikimon.life";
    include __DIR__ . '/components/meta.php';
    ?>
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
    <style>[x-cloak] { display: none !important; }</style>
</head>
<body class="bg-[#050505] text-white min-h-screen" x-data="walkMode()">

<?php include __DIR__ . '/components/nav.php'; ?>

<main class="max-w-lg mx-auto px-4 py-6" style="padding-top: calc(var(--nav-height, 56px) + 1.5rem)">

    <!-- 開始前の情報パネル -->
    <div x-show="!isWalking && !showSummary" class="space-y-5">

        <!-- ヘッダー -->
        <div class="text-center">
            <div class="text-5xl mb-3">🌿</div>
            <h1 class="text-xl font-black">ウォークモード</h1>
            <p class="text-sm text-gray-400 mt-1">スマホを持って散歩するだけ。鳥の鳴き声をAIが自動判定します。</p>
        </div>

        <!-- メインボタン -->
        <button @click="startWalk()"
                class="w-full py-5 rounded-2xl text-lg font-bold bg-green-600 hover:bg-green-700 active:scale-95 transition mb-2">
            🎧 ウォーク開始
        </button>

        <!-- 仕組み説明 -->
        <div class="bg-white/5 rounded-xl p-4 space-y-3">
            <h3 class="text-sm font-bold text-gray-300">どうやって動く？</h3>
            <div class="grid grid-cols-1 gap-2 text-xs text-gray-400">
                <div class="flex items-start gap-2">
                    <span class="text-green-400 mt-0.5">🎤</span>
                    <span>3秒ごとに環境音を録音し、<strong class="text-white">BirdNET AI</strong> が鳥種を自動判定</span>
                </div>
                <div class="flex items-start gap-2">
                    <span class="text-blue-400 mt-0.5">📍</span>
                    <span>GPSで歩行ルートを記録。検出地点がマッピングされます</span>
                </div>
                <div class="flex items-start gap-2">
                    <span class="text-purple-400 mt-0.5">🔬</span>
                    <span>検出データは <strong class="text-white">6,522種</strong> の鳥類データベースと照合</span>
                </div>
            </div>
        </div>

        <!-- 天気情報（GPS取得後に表示） -->
        <div x-show="weather" x-cloak class="bg-white/5 rounded-xl p-4 flex items-center gap-4">
            <span class="text-4xl" x-text="weather?.icon || ''"></span>
            <div class="flex-1">
                <div class="text-base font-bold text-white" x-text="weather?.description || ''"></div>
                <div class="text-sm text-gray-400" x-text="weather ? weather.temp + '°C / 湿度 ' + weather.humidity + '%' : ''"></div>
                <div class="text-xs text-gray-500" x-text="weather ? '風速 ' + weather.windSpeed + 'm/s' : ''"></div>
            </div>
            <div class="text-right">
                <div class="text-xs text-gray-500" x-text="weather?.birdActivity || ''"></div>
            </div>
        </div>
        <div x-show="!weather" class="bg-white/5 rounded-xl p-4 text-center text-xs text-gray-500">
            📍 位置情報を取得中...（天気情報を読み込みます）
        </div>

        <!-- ユーザー統計 -->
        <div class="grid grid-cols-3 gap-3 text-center">
            <div class="bg-white/5 rounded-xl p-3">
                <div class="text-xl font-black text-emerald-400"><?= number_format($totalUserObs) ?></div>
                <div class="text-[10px] text-gray-500">あなたの観察</div>
            </div>
            <div class="bg-white/5 rounded-xl p-3">
                <div class="text-xl font-black text-blue-400"><?= number_format($userSpecies) ?></div>
                <div class="text-[10px] text-gray-500">確認種数</div>
            </div>
            <div class="bg-white/5 rounded-xl p-3">
                <div class="text-xl font-black text-amber-400"><?= number_format($totalSpecies) ?></div>
                <div class="text-[10px] text-gray-500">全体の種数</div>
            </div>
        </div>

        <!-- ヒント -->
        <div class="text-xs text-gray-500 text-center p-3 bg-white/5 rounded-xl leading-relaxed">
            💡 早朝（5-8時）は鳥が最も活発です。静かな場所ほど検出精度が上がります。<br>
            ⚠️ この画面を開いたまま歩いてください。タブを閉じると停止します。
        </div>
    </div>

    <!-- ウォーク中のヘッダー -->
    <div x-show="isWalking" x-cloak class="text-center mb-4">
        <div class="text-5xl mb-3">🟢</div>
        <h1 class="text-xl font-black">モニタリング中</h1>
        <p class="text-sm text-green-400 mt-1">環境音をAI分析しています...</p>

        <!-- 停止ボタン -->
        <button @click="stopWalk()"
                class="w-full py-5 rounded-2xl text-lg font-bold bg-red-600 hover:bg-red-700 active:scale-95 transition mt-4">
            🛑 ウォーク終了
        </button>
    </div>

    <!-- ウォーク中の情報 -->
    <template x-if="isWalking">
        <div class="space-y-4">
            <!-- ステータス -->
            <div class="grid grid-cols-3 gap-3 text-center">
                <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-2xl font-black" x-text="elapsedTime"></div>
                    <div class="text-xs text-gray-500">経過時間</div>
                </div>
                <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-2xl font-black text-green-400" x-text="audioDetections.length"></div>
                    <div class="text-xs text-gray-500">音声検出</div>
                </div>
                <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-2xl font-black text-blue-400" x-text="routePoints.length"></div>
                    <div class="text-xs text-gray-500">GPS点</div>
                </div>
            </div>

            <!-- 音声検出リスト -->
            <div x-show="audioDetections.length > 0">
                <h3 class="text-sm font-bold text-gray-500 mb-2">検出された音声</h3>
                <div class="bg-white/5 rounded-xl divide-y divide-white/5">
                    <template x-for="det in audioDetections.slice().reverse()" :key="det.timestamp">
                        <div class="flex items-center gap-3 p-3">
                            <div class="w-8 h-8 rounded-full bg-green-900/50 flex items-center justify-center">
                                <i data-lucide="music" class="w-4 h-4 text-green-400"></i>
                            </div>
                            <div class="flex-1">
                                <div class="text-sm font-medium" x-text="det.name"></div>
                                <div class="text-xs text-gray-600" x-text="det.time"></div>
                            </div>
                            <span class="text-xs text-gray-500" x-text="Math.round(det.confidence * 100) + '%'"></span>
                        </div>
                    </template>
                </div>
            </div>

            <!-- 音声レベルメーター -->
            <div class="bg-white/5 rounded-xl p-4">
                <div class="flex items-center gap-3 mb-2">
                    <i data-lucide="mic" class="w-4 h-4 text-gray-500"></i>
                    <span class="text-xs text-gray-500">環境音レベル</span>
                </div>
                <div class="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div class="h-full bg-green-500 transition-all duration-200 rounded-full"
                         :style="'width: ' + audioLevel + '%'"></div>
                </div>
            </div>

            <!-- 天気情報 -->
            <div x-show="weather" x-cloak class="bg-white/5 rounded-xl p-3 flex items-center gap-3">
                <span class="text-2xl" x-text="weather?.icon || ''"></span>
                <div class="flex-1">
                    <div class="text-sm font-medium" x-text="weather?.description || ''"></div>
                    <div class="text-xs text-gray-500" x-text="weather ? weather.temp + '°C / 湿度 ' + weather.humidity + '%' : ''"></div>
                </div>
                <div class="text-right text-xs text-gray-500">
                    <div x-text="weather ? '風速 ' + weather.windSpeed + 'm/s' : ''"></div>
                </div>
            </div>
        </div>
    </template>

    <!-- 終了後のサマリー -->
    <template x-if="showSummary">
        <div class="bg-white/5 rounded-2xl p-6 text-center space-y-4">
            <div class="text-4xl">🎉</div>
            <h2 class="text-lg font-bold">ウォーク完了!</h2>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <div class="text-2xl font-black" x-text="summaryData.duration"></div>
                    <div class="text-xs text-gray-500">時間</div>
                </div>
                <div>
                    <div class="text-2xl font-black text-green-400" x-text="summaryData.speciesCount"></div>
                    <div class="text-xs text-gray-500">種検出</div>
                </div>
            </div>

            <template x-if="summaryData.species.length > 0">
                <div class="text-left">
                    <div class="text-xs text-gray-500 mb-1">検出した種</div>
                    <div class="flex flex-wrap gap-1.5">
                        <template x-for="sp in summaryData.species" :key="sp">
                            <span class="text-xs px-2 py-1 bg-green-900/30 text-green-400 rounded-full" x-text="sp"></span>
                        </template>
                    </div>
                </div>
            </template>

            <button @click="uploadResults()"
                    class="w-full py-3 bg-green-600 hover:bg-green-700 rounded-xl font-bold transition"
                    :disabled="isUploading">
                <span x-text="isUploading ? '送信中...' : 'ikimon.life に投稿'"></span>
            </button>

            <button @click="showSummary = false" class="text-sm text-gray-500 hover:text-white">閉じる</button>
        </div>
    </template>

</main>

<script>
function walkMode() {
    return {
        isWalking: false,
        showSummary: false,
        isUploading: false,
        startTime: null,
        elapsedTime: '0:00',
        timerInterval: null,
        audioDetections: [],
        routePoints: [],
        audioLevel: 0,
        watchId: null,
        audioContext: null,
        analyser: null,
        mediaStream: null,
        summaryData: { duration: '0:00', speciesCount: 0, species: [] },
        weather: null,

        init() {
            // ページ読み込み時に位置情報→天気を取得
            this._fetchWeather();
        },

        async _fetchWeather() {
            try {
                const pos = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: false, timeout: 10000
                    });
                });
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;

                const resp = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia/Tokyo`
                );
                const data = await resp.json();
                const c = data.current;

                const wmo = this._weatherCodeToInfo(c.weather_code);
                const hour = new Date().getHours();
                let birdActivity = '';
                if (hour >= 5 && hour <= 8) birdActivity = '🔥 鳥の活動ピーク帯';
                else if (hour >= 16 && hour <= 18) birdActivity = '🌅 夕方の活動帯';
                else if (hour >= 21 || hour <= 4) birdActivity = '🌙 夜行性種のみ';
                else birdActivity = '☀️ 日中';

                this.weather = {
                    temp: Math.round(c.temperature_2m),
                    humidity: c.relative_humidity_2m,
                    windSpeed: c.wind_speed_10m,
                    description: wmo.description,
                    icon: wmo.icon,
                    birdActivity,
                };
            } catch (e) {
                console.warn('Weather fetch failed:', e);
            }
        },

        _weatherCodeToInfo(code) {
            const map = {
                0: { icon: '☀️', description: '快晴' },
                1: { icon: '🌤️', description: '晴れ' },
                2: { icon: '⛅', description: '薄曇り' },
                3: { icon: '☁️', description: '曇り' },
                45: { icon: '🌫️', description: '霧' },
                48: { icon: '🌫️', description: '着氷霧' },
                51: { icon: '🌦️', description: '小雨' },
                53: { icon: '🌧️', description: '雨' },
                55: { icon: '🌧️', description: '強い雨' },
                61: { icon: '🌧️', description: '小雨' },
                63: { icon: '🌧️', description: '雨' },
                65: { icon: '🌧️', description: '大雨' },
                71: { icon: '🌨️', description: '小雪' },
                73: { icon: '🌨️', description: '雪' },
                75: { icon: '❄️', description: '大雪' },
                80: { icon: '🌦️', description: 'にわか雨' },
                95: { icon: '⛈️', description: '雷雨' },
            };
            return map[code] || { icon: '🌤️', description: '晴れ' };
        },

        async startWalk() {
            this.isWalking = true;
            this.showSummary = false;
            this.startTime = Date.now();
            this.audioDetections = [];
            this.routePoints = [];

            // タイマー
            this.timerInterval = setInterval(() => {
                const sec = Math.floor((Date.now() - this.startTime) / 1000);
                const m = Math.floor(sec / 60);
                const s = sec % 60;
                this.elapsedTime = m + ':' + String(s).padStart(2, '0');
            }, 1000);

            // GPS
            if (navigator.geolocation) {
                this.watchId = navigator.geolocation.watchPosition(
                    pos => {
                        this.routePoints.push({
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                            alt: pos.coords.altitude,
                            timestamp: Date.now(),
                        });
                    },
                    () => {},
                    { enableHighAccuracy: true, maximumAge: 5000 }
                );
            }

            // 音声モニタリング + 録音 + BirdNET 分析
            try {
                this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.audioContext = new AudioContext();
                const source = this.audioContext.createMediaStreamSource(this.mediaStream);
                this.analyser = this.audioContext.createAnalyser();
                this.analyser.fftSize = 256;
                source.connect(this.analyser);

                // 音声レベルメーター
                const updateLevel = () => {
                    if (!this.isWalking) return;
                    const data = new Uint8Array(this.analyser.frequencyBinCount);
                    this.analyser.getByteFrequencyData(data);
                    const avg = data.reduce((a, b) => a + b, 0) / data.length;
                    this.audioLevel = Math.min(100, avg * 1.5);
                    requestAnimationFrame(updateLevel);
                };
                updateLevel();

                // MediaRecorder セットアップ（3秒チャンクで録音→BirdNET送信）
                this._setupAudioRecorder();

            } catch (err) {
                console.warn('Audio not available:', err);
            }
        },

        stopWalk() {
            this.isWalking = false;
            clearInterval(this.timerInterval);
            if (this._recordingTimer) clearTimeout(this._recordingTimer);

            // MediaRecorder を停止
            if (this._mediaRecorder && this._mediaRecorder.state === 'recording') {
                try { this._mediaRecorder.stop(); } catch (e) { /* ignore */ }
            }

            if (this.watchId) navigator.geolocation.clearWatch(this.watchId);
            if (this.mediaStream) this.mediaStream.getTracks().forEach(t => t.stop());
            if (this.audioContext) this.audioContext.close();

            // サマリー
            const uniqueSpecies = [...new Set(this.audioDetections.map(d => d.name))];
            this.summaryData = {
                duration: this.elapsedTime,
                speciesCount: uniqueSpecies.length,
                species: uniqueSpecies,
            };
            this.showSummary = true;
        },

        /**
         * MediaRecorder をセットアップし、3秒チャンクで録音→BirdNET API に送信
         */
        _setupAudioRecorder() {
            if (!this.mediaStream) return;

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

            this._mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });
            this._audioChunks = [];
            this._isAnalyzing = false;

            this._mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this._audioChunks.push(e.data);
                }
            };

            this._mediaRecorder.onstop = () => {
                if (this._audioChunks.length === 0 || !this.isWalking) return;
                const blob = new Blob(this._audioChunks, { type: mimeType });
                this._audioChunks = [];
                this._sendAudioForAnalysis(blob, mimeType);
            };

            // 3秒間隔で録音→停止→送信→再開のサイクル
            this._startRecordingCycle();
        },

        _startRecordingCycle() {
            if (!this.isWalking || !this._mediaRecorder) return;

            // 前回の分析がまだ進行中なら次のサイクルまでスキップ
            if (this._isAnalyzing) {
                this._recordingTimer = setTimeout(() => this._startRecordingCycle(), 1000);
                return;
            }

            try {
                this._audioChunks = [];
                this._mediaRecorder.start();

                // 3秒後に停止（→ onstop で送信）
                this._recordingTimer = setTimeout(() => {
                    if (this._mediaRecorder && this._mediaRecorder.state === 'recording') {
                        this._mediaRecorder.stop();
                    }
                    // 次のサイクルは送信完了後に開始（_sendAudioForAnalysis 内）
                }, 3000);
            } catch (err) {
                console.warn('Recording error:', err);
                // リトライ
                this._recordingTimer = setTimeout(() => this._startRecordingCycle(), 5000);
            }
        },

        /**
         * 録音した音声チャンクを BirdNET API に送信
         */
        async _sendAudioForAnalysis(blob, mimeType) {
            if (!this.isWalking) return;
            this._isAnalyzing = true;

            try {
                const lastPoint = this.routePoints.length > 0
                    ? this.routePoints[this.routePoints.length - 1]
                    : null;

                const formData = new FormData();
                const ext = mimeType.includes('mp4') ? '.mp4' : '.webm';
                formData.append('audio', blob, `snippet${ext}`);
                formData.append('lat', lastPoint?.lat ?? 35.0);
                formData.append('lng', lastPoint?.lng ?? 139.0);

                const resp = await fetch('/api/v2/analyze_audio.php', {
                    method: 'POST',
                    body: formData,
                });

                if (!resp.ok) {
                    if (resp.status === 429) {
                        console.warn('Rate limited, slowing down');
                        await new Promise(r => setTimeout(r, 5000));
                    }
                    return;
                }

                const json = await resp.json();
                if (json.success && json.data?.detections) {
                    const now = new Date();
                    for (const d of json.data.detections) {
                        this.audioDetections.push({
                            name: d.common_name || d.scientific_name,
                            scientific_name: d.scientific_name,
                            confidence: d.confidence,
                            time: now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0'),
                            timestamp: Date.now(),
                            lat: lastPoint?.lat ?? null,
                            lng: lastPoint?.lng ?? null,
                        });

                        // バイブレーション（検出時）
                        if (navigator.vibrate) navigator.vibrate(30);
                    }
                }
            } catch (err) {
                console.warn('Audio analysis error:', err);
            } finally {
                this._isAnalyzing = false;
                // 次の録音サイクルを開始
                if (this.isWalking) {
                    this._startRecordingCycle();
                }
            }
        },

        async uploadResults() {
            this.isUploading = true;
            try {
                const events = this.audioDetections.map(d => ({
                    type: 'audio',
                    taxon_name: d.name,
                    scientific_name: d.scientific_name,
                    confidence: d.confidence,
                    lat: d.lat,
                    lng: d.lng,
                    timestamp: new Date(d.timestamp).toISOString(),
                    model: 'birdnet-v2.4',
                }));

                const resp = await fetch('/api/v2/passive_event.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        events,
                        session: {
                            duration_sec: Math.floor((Date.now() - this.startTime) / 1000),
                            device: navigator.userAgent.includes('iPhone') ? 'iPhone' : 'Android',
                            app_version: 'web_1.0',
                        }
                    }),
                });

                const json = await resp.json();
                if (json.success) {
                    alert(`${json.data?.observations_created || 0}件の観察が投稿されました!`);
                }
            } catch (err) {
                alert('送信エラー: ' + err.message);
            } finally {
                this.isUploading = false;
            }
        }
    };
}
</script>
</body>
</html>
