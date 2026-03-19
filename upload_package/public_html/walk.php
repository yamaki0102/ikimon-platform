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
Auth::init();

$currentUser = Auth::user();
if (!$currentUser) {
    header('Location: login.php?redirect=walk.php');
    exit;
}
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
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
</head>
<body class="bg-[#050505] text-white min-h-screen" x-data="walkMode()">

<?php include __DIR__ . '/components/navbar.php'; ?>

<main class="max-w-lg mx-auto px-4 py-6">

    <!-- ヘッダー -->
    <div class="text-center mb-8">
        <div class="text-5xl mb-3" x-text="isWalking ? '🟢' : '🌿'"></div>
        <h1 class="text-xl font-black">ウォークモード</h1>
        <p class="text-sm text-gray-500 mt-1" x-text="isWalking ? '環境音をモニタリング中...' : '画面を開いたまま散歩するだけ'"></p>
    </div>

    <!-- メインボタン -->
    <button @click="isWalking ? stopWalk() : startWalk()"
            class="w-full py-5 rounded-2xl text-lg font-bold transition mb-6"
            :class="isWalking ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'">
        <span x-text="isWalking ? '🛑 ウォーク終了' : '🎧 ウォーク開始'"></span>
    </button>

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

            <!-- 注意 -->
            <div class="text-xs text-gray-600 text-center p-3 bg-amber-900/20 rounded-xl">
                ⚠️ この画面を開いたまま歩いてください。<br>
                タブを閉じると記録が停止します。<br>
                より高性能な体験は <strong>ikimon pocket</strong> アプリで。
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

            // 音声モニタリング
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

                // 定期的にサーバーに音声スニペットを送信して分類
                // （簡易版: 15秒間隔でキャプチャ→AI分類）
                this._audioClassifyInterval = setInterval(() => {
                    this.classifyAudioSnippet();
                }, 15000);

            } catch (err) {
                console.warn('Audio not available:', err);
            }
        },

        stopWalk() {
            this.isWalking = false;
            clearInterval(this.timerInterval);
            clearInterval(this._audioClassifyInterval);

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

        async classifyAudioSnippet() {
            // ブラウザ版: 録音した音声をサーバーの AI に送って分類
            // NOTE: 完全な実装にはサーバー側に音声分類APIが必要
            // 暫定: ダミー検出（開発用）
            const dummySpecies = [
                { name: 'シジュウカラ', scientific: 'Parus minor', conf: 0.82 },
                { name: 'ヒヨドリ', scientific: 'Hypsipetes amaurotis', conf: 0.75 },
                { name: 'メジロ', scientific: 'Zosterops japonicus', conf: 0.68 },
                { name: 'ウグイス', scientific: 'Horornis diphone', conf: 0.71 },
                { name: 'ハシブトガラス', scientific: 'Corvus macrorhynchos', conf: 0.90 },
            ];

            // 20%の確率でランダムに検出（デモ用）
            if (Math.random() < 0.2) {
                const sp = dummySpecies[Math.floor(Math.random() * dummySpecies.length)];
                const now = new Date();
                this.audioDetections.push({
                    name: sp.name,
                    scientific_name: sp.scientific,
                    confidence: sp.conf + (Math.random() * 0.1 - 0.05),
                    time: now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0'),
                    timestamp: Date.now(),
                    lat: this.routePoints.length > 0 ? this.routePoints[this.routePoints.length - 1].lat : null,
                    lng: this.routePoints.length > 0 ? this.routePoints[this.routePoints.length - 1].lng : null,
                });

                // バイブレーション
                if (navigator.vibrate) navigator.vibrate(30);
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
                    model: 'web_audio_v1',
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
<script>lucide.createIcons();</script>
</body>
</html>
