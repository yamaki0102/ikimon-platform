<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CSRF.php';
require_once __DIR__ . '/../libs/SurveyManager.php';

Auth::init();
$currentUser = Auth::user();

if (!$currentUser) {
    header('Location: /login.php?redirect=/survey.php');
    exit;
}

$activeSurvey = SurveyManager::getActive($currentUser['id']);
$csrfToken = CSRF::generate();
$meta_title = 'フィールド調査';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Zen Maru Gothic', sans-serif;
            background-color: #f8fafc;
        }
    </style>
</head>

<body class="pb-20 md:pb-0">

    <?php include __DIR__ . '/components/nav.php'; ?>

    <main class="max-w-2xl mx-auto p-4" x-data="surveyApp()">
        <header class="mb-6">
            <h1 class="text-2xl font-bold text-slate-800">フィールド調査</h1>
            <p class="text-sm text-slate-500">生物多様性データの収集セッション</p>
        </header>

        <!-- ACTIVE SURVEY MODE -->
        <template x-if="activeSurvey">
            <div class="bg-white rounded-3xl shadow-sm border border-teal-100 overflow-hidden">
                <div class="bg-teal-600 px-6 py-4 text-white">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <span class="animate-pulse w-2 h-2 bg-red-400 rounded-full"></span>
                                <span class="text-xs font-bold uppercase tracking-wider opacity-90">LIVE RECORDING</span>
                            </div>
                            <h2 class="text-xl font-bold">調査進行中</h2>
                        </div>
                        <div class="text-right">
                            <div class="text-3xl font-bold font-mono" x-text="timer">00:00:00</div>
                            <div class="text-xs opacity-70">経過時間</div>
                        </div>
                    </div>
                </div>

                <div class="p-6">
                    <!-- Stats Grid -->
                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <div class="bg-slate-50 p-4 rounded-xl text-center">
                            <div class="text-2xl font-bold text-slate-700" x-text="stats.obs_count">0</div>
                            <div class="text-xs text-slate-500 font-bold">発見数</div>
                        </div>
                        <div class="bg-slate-50 p-4 rounded-xl text-center">
                            <div class="text-2xl font-bold text-slate-700" x-text="stats.sp_count">0</div>
                            <div class="text-xs text-slate-500 font-bold">種数</div>
                        </div>
                    </div>

                    <!-- Weather & Temp Chips (during survey) -->
                    <template x-if="weatherType || tempRange">
                        <div class="flex flex-wrap gap-2 mb-4">
                            <template x-if="weatherType">
                                <span class="inline-flex items-center gap-1 px-3 py-1 bg-sky-50 text-sky-700 text-xs font-bold rounded-full"
                                    x-text="weatherOptions[weatherType]"></span>
                            </template>
                            <template x-if="tempRange">
                                <span class="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full"
                                    x-text="tempOptions[tempRange]"></span>
                            </template>
                        </div>
                    </template>

                    <!-- Context Notes -->
                    <div class="mb-6">
                        <label class="block text-sm font-bold text-slate-700 mb-2">フィールドメモ</label>
                        <textarea x-model="notes"
                            @blur="updateContext"
                            class="w-full text-sm bg-slate-50 border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                            rows="3"
                            placeholder="環境の変化、特記事項など..."></textarea>
                    </div>

                    <!-- Actions -->
                    <div class="grid grid-cols-2 gap-3">
                        <a href="/post.php" class="block w-full bg-teal-600 text-white font-bold py-3 rounded-xl text-center shadow-lg shadow-teal-200 hover:bg-teal-700 transition">
                            📷 記録する
                        </a>
                        <button @click="finishSurvey" class="bg-white border-2 border-red-100 text-red-600 font-bold py-3 rounded-xl hover:bg-red-50 transition">
                            ⏹ 終了する
                        </button>
                    </div>
                </div>
            </div>
        </template>

        <!-- START NEW SURVEY MODE -->
        <template x-if="!activeSurvey">
            <div class="space-y-6">
                <!-- Setup Card -->
                <div class="bg-white rounded-3xl shadow-sm p-6 border border-slate-100">
                    <h2 class="text-lg font-bold text-slate-800 mb-4">新しい調査を開始</h2>

                    <div class="space-y-4">
                        <!-- Protocol Selection -->
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">調査タイプ</label>
                            <div class="grid grid-cols-2 gap-3">
                                <button @click="protocol = 'casual'"
                                    :class="{'bg-teal-50 border-teal-500 text-teal-700': protocol === 'casual', 'bg-white border-slate-200 text-slate-600': protocol !== 'casual'}"
                                    class="border-2 rounded-xl p-3 text-left transition">
                                    <div class="text-sm font-bold">🍃 カジュアル</div>
                                    <div class="text-[10px] opacity-70">自由散策・定点観察</div>
                                </button>
                                <button @click="protocol = 'traveling'"
                                    :class="{'bg-teal-50 border-teal-500 text-teal-700': protocol === 'traveling', 'bg-white border-slate-200 text-slate-600': protocol !== 'traveling'}"
                                    class="border-2 rounded-xl p-3 text-left transition">
                                    <div class="text-sm font-bold">🚶 トランセクト</div>
                                    <div class="text-[10px] opacity-70">ルート沿いの記録</div>
                                </button>
                            </div>
                        </div>

                        <!-- Weather Type -->
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">天候</label>
                            <div class="grid grid-cols-3 gap-2">
                                <template x-for="(label, key) in weatherOptions" :key="key">
                                    <button type="button" @click="weatherType = weatherType === key ? '' : key"
                                        :class="{'bg-sky-50 border-sky-500 text-sky-700': weatherType === key, 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50': weatherType !== key}"
                                        class="border-2 rounded-xl py-2 px-1 text-center text-xs font-bold transition"
                                        x-text="label"></button>
                                </template>
                            </div>
                        </div>

                        <!-- Temperature Range -->
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">気温帯</label>
                            <div class="grid grid-cols-5 gap-1">
                                <template x-for="(label, key) in tempOptions" :key="key">
                                    <button type="button" @click="tempRange = tempRange === key ? '' : key"
                                        :class="{'bg-amber-50 border-amber-500 text-amber-700': tempRange === key, 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50': tempRange !== key}"
                                        class="border-2 rounded-xl py-2 text-center text-[10px] font-bold transition leading-tight"
                                        x-text="label"></button>
                                </template>
                            </div>
                        </div>

                        <!-- Event Code -->
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">イベントコード (任意)</label>
                            <input type="text" x-model="eventTag" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 font-mono placeholder-slate-300" placeholder="#Tag (例: FUJI2026)">
                        </div>

                        <!-- Partner (Party) -->
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">同行者 (オプション)</label>
                            <input type="text" x-model="partnerName" @keydown.enter.prevent="addPartner" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-500 mb-2" placeholder="名前を入力してEnter">

                            <div class="flex flex-wrap gap-2">
                                <template x-for="(p, index) in party" :key="index">
                                    <span class="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full">
                                        <span x-text="p"></span>
                                        <button @click="removePartner(index)" class="text-indigo-400 hover:text-indigo-900">&times;</button>
                                    </span>
                                </template>
                            </div>
                        </div>

                        <button @click="startSurvey" class="w-full bg-teal-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-teal-200 hover:bg-teal-700 transition flex items-center justify-center gap-2">
                            <span>🚀 調査スタート</span>
                        </button>
                    </div>
                </div>

                <!-- History List -->
                <div class="bg-white rounded-3xl shadow-sm p-6 border border-slate-100">
                    <h3 class="text-sm font-bold text-slate-700 mb-4">最近の調査履歴</h3>
                    <template x-if="history.length === 0">
                        <div class="text-center py-8 text-slate-400 text-sm">履歴はありません</div>
                    </template>
                    <div class="space-y-3">
                        <template x-for="log in history" :key="log.id">
                            <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100">
                                <div class="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-lg">
                                    <span x-text="log.protocol === 'traveling' ? '🚶' : '🍃'"></span>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="flex justify-between items-baseline mb-1">
                                        <h4 class="text-sm font-bold text-slate-800" x-text="formatDate(log.started_at)"></h4>
                                        <span class="text-xs text-slate-500 font-mono" x-text="log.stats.duration_min + ' min'"></span>
                                    </div>
                                    <div class="flex items-center gap-3 text-xs text-slate-400">
                                        <span>📷 <span x-text="log.stats.obs_count"></span></span>
                                        <span>🌿 <span x-text="log.stats.sp_count"></span>種</span>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>
                    <!-- Summary Modal -->
                    <template x-if="showSummary && lastSurveyResult">
                        <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                            <div class="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-[fade-in_0.3s]">
                                <div class="text-center mb-6">
                                    <div class="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl">
                                        🏆
                                    </div>
                                    <h2 class="text-xl font-bold text-slate-800">調査完了！</h2>
                                    <p class="text-sm text-slate-500">お疲れ様でした。今回の成果です。</p>
                                </div>

                                <div class="bg-slate-50 rounded-2xl p-4 mb-6 space-y-3">
                                    <div class="flex justify-between items-center border-b border-slate-100 pb-2">
                                        <span class="text-xs font-bold text-slate-400 uppercase">活動時間</span>
                                        <span class="font-bold font-mono text-lg text-slate-700" x-text="lastSurveyResult.stats.duration_min + ' min'"></span>
                                    </div>
                                    <div class="flex justify-between items-center border-b border-slate-100 pb-2">
                                        <span class="text-xs font-bold text-slate-400 uppercase">発見数</span>
                                        <span class="font-bold font-mono text-lg text-slate-700" x-text="lastSurveyResult.stats.obs_count"></span>
                                    </div>
                                    <div class="flex justify-between items-center">
                                        <span class="text-xs font-bold text-slate-400 uppercase">種数</span>
                                        <span class="font-bold font-mono text-lg text-slate-700" x-text="lastSurveyResult.stats.sp_count + ' species'"></span>
                                    </div>
                                </div>

                                <button @click="closeSummary" class="w-full bg-teal-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-teal-700 transition">
                                    閉じる
                                </button>
                            </div>
                        </div>
                    </template>
                </div>
            </div>
        </template>
    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        function surveyApp() {
            return {
                activeSurvey: <?php echo $activeSurvey ? json_encode($activeSurvey) : 'null'; ?>,
                protocol: 'casual',
                weatherType: '',
                tempRange: '',
                weatherOptions: {
                    'clear': '☀️ 晴れ',
                    'cloudy': '⛅ 曇り',
                    'rain': '🌧️ 雨',
                    'snow': '🌨️ 雪',
                    'fog': '🌫️ 霧',
                    'windy': '🌪️ 強風'
                },
                tempOptions: {
                    'freezing': '🥶 極寒',
                    'cold': '❄️ 寒い',
                    'cool': '🌤️ 涼しい',
                    'warm': '☀️ 暖かい',
                    'hot': '🔥 暑い'
                },
                partnerName: '',
                party: [],
                notes: '',
                stats: {
                    obs_count: 0,
                    sp_count: 0
                },
                timer: '00:00:00',
                timerInterval: null,
                history: [],
                csrfToken: '<?php echo $csrfToken; ?>',
                showSummary: false,
                lastSurveyResult: null,

                init() {
                    // ... existing init ...
                    if (this.activeSurvey) {
                        this.notes = this.activeSurvey.context.notes || '';
                        this.weatherType = this.activeSurvey.context.weather_type || '';
                        this.tempRange = this.activeSurvey.context.temp_range || '';
                        this.startTimer();
                    }
                    this.fetchHistory();
                },

                // ... existing methods ...

                formatDate(dateStr) {
                    const d = new Date(dateStr);
                    return d.toLocaleDateString('ja-JP', {
                        month: 'short',
                        day: 'numeric'
                    }) + ' ' + d.toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                },

                addPartner() {
                    if (this.partnerName.trim()) {
                        this.party.push(this.partnerName.trim());
                        this.partnerName = '';
                    }
                },

                removePartner(index) {
                    this.party.splice(index, 1);
                },

                startTimer() {
                    if (!this.activeSurvey) return;
                    const startTime = new Date(this.activeSurvey.started_at).getTime();

                    this.updateTimerDisplay(startTime);
                    this.timerInterval = setInterval(() => {
                        this.updateTimerDisplay(startTime);
                    }, 1000);
                },

                updateTimerDisplay(startTime) {
                    const now = new Date().getTime();
                    const diff = now - startTime;

                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                    this.timer =
                        (hours < 10 ? "0" + hours : hours) + ":" +
                        (minutes < 10 ? "0" + minutes : minutes) + ":" +
                        (seconds < 10 ? "0" + seconds : seconds);
                },

                async startSurvey() {
                    const formData = new FormData();
                    formData.append('csrf_token', this.csrfToken);
                    formData.append('protocol', this.protocol);
                    formData.append('party', JSON.stringify(this.party));
                    if (this.weatherType) {
                        formData.append('weather_type', this.weatherType);
                    }
                    if (this.tempRange) {
                        formData.append('temp_range', this.tempRange);
                    }

                    try {
                        const res = await fetch('/api/survey.php?action=start', {
                            method: 'POST',
                            body: formData
                        });
                        const data = await res.json();
                        if (data.success) {
                            this.activeSurvey = data.survey;
                            this.startTimer();
                        } else {
                            alert(data.message);
                        }
                    } catch (e) {
                        alert('エラーが発生しました');
                    }
                },

                async updateContext() {
                    if (!this.activeSurvey) return;
                    const formData = new FormData();
                    formData.append('csrf_token', this.csrfToken);
                    formData.append('id', this.activeSurvey.id);
                    formData.append('notes', this.notes);
                    if (this.weatherType) {
                        formData.append('weather_type', this.weatherType);
                    }
                    if (this.tempRange) {
                        formData.append('temp_range', this.tempRange);
                    }

                    await fetch('/api/survey.php?action=update_context', {
                        method: 'POST',
                        body: formData
                    });
                },

                async finishSurvey() {
                    if (!confirm('調査を終了して記録を保存しますか？')) return;

                    const formData = new FormData();
                    formData.append('csrf_token', this.csrfToken);
                    formData.append('id', this.activeSurvey.id);
                    formData.append('obs_count', this.stats.obs_count);
                    formData.append('sp_count', this.stats.sp_count);
                    formData.append('weather_type', this.weatherType || '');
                    formData.append('temp_range', this.tempRange || '');

                    try {
                        const res = await fetch('/api/survey.php?action=end', {
                            method: 'POST',
                            body: formData
                        });
                        const data = await res.json();
                        if (data.success) {
                            // Store result for modal
                            this.lastSurveyResult = {
                                stats: data.survey.stats || {
                                    duration_min: 0,
                                    obs_count: this.stats.obs_count,
                                    sp_count: this.stats.sp_count
                                }
                            };

                            this.activeSurvey = null;
                            clearInterval(this.timerInterval);
                            this.fetchHistory();
                            this.showSummary = true; // Show modal
                        } else {
                            alert(data.message);
                        }
                    } catch (e) {
                        alert('エラーが発生しました');
                    }
                },

                closeSummary() {
                    this.showSummary = false;
                    this.lastSurveyResult = null;
                },

                async fetchHistory() {
                    try {
                        const res = await fetch('/api/survey.php?action=history');
                        const data = await res.json();
                        if (data.success) {
                            this.history = data.surveys;
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }
            }
        }
    </script>
</body>

</html>