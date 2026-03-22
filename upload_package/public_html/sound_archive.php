<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CSRF.php';
Auth::init();
$isLoggedIn = Auth::isLoggedIn();
$csrfToken = CSRF::generate();
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php
    $meta_title = "サウンドアーカイブ";
    $meta_description = "生き物の声を集めて、みんなで同定しよう。未同定の音声を聞いて種名を提案できます。";
    include __DIR__ . '/components/meta.php';
    ?>
    <style>
        [x-cloak] { display: none !important; }
        .sound-card { transition: transform 0.2s, box-shadow 0.2s; }
        .sound-card:active { transform: scale(0.98); }
        .playing-pulse { animation: pulse-ring 1.5s infinite; }
        @keyframes pulse-ring {
            0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
            70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
            100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
    </style>
</head>

<body class="bg-bg text-text min-h-screen">
    <?php include __DIR__ . '/components/nav.php'; ?>

    <main class="max-w-2xl mx-auto px-4 pt-[calc(var(--nav-height)+var(--safe-top)+1rem)] pb-28"
          x-data="soundArchive()" x-init="load()">

        <!-- Header -->
        <div class="mb-6">
            <h1 class="text-xl font-black font-heading">サウンドアーカイブ</h1>
            <p class="text-sm text-muted mt-1">生き物の声を集めて、みんなで同定しよう</p>
        </div>

        <!-- Upload Button -->
        <?php if ($isLoggedIn): ?>
        <button @click="showUpload = true"
                class="w-full mb-5 flex items-center justify-center gap-2 bg-primary/10 text-primary border border-primary/20 rounded-2xl py-3 font-bold text-sm hover:bg-primary/20 transition">
            <i data-lucide="upload" class="w-4 h-4"></i> 音声をアップロード
        </button>
        <?php endif; ?>

        <!-- Filter Bar -->
        <div class="flex gap-2 mb-4 overflow-x-auto pb-1">
            <button @click="filter='all'; load()"
                    :class="filter==='all' ? 'bg-primary text-white' : 'bg-surface border border-border text-muted'"
                    class="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition">すべて</button>
            <button @click="filter='needs_id'; load()"
                    :class="filter==='needs_id' ? 'bg-amber-500 text-white' : 'bg-surface border border-border text-muted'"
                    class="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition">同定待ち</button>
            <button @click="filter='suggested'; load()"
                    :class="filter==='suggested' ? 'bg-blue-500 text-white' : 'bg-surface border border-border text-muted'"
                    class="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition">提案あり</button>
            <button @click="filter='identified'; load()"
                    :class="filter==='identified' ? 'bg-emerald-500 text-white' : 'bg-surface border border-border text-muted'"
                    class="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition">同定済み</button>
        </div>

        <!-- Stats -->
        <div class="flex gap-3 mb-4 text-xs text-muted">
            <span><span class="font-bold text-text" x-text="total"></span> 件</span>
        </div>

        <!-- Loading -->
        <div x-show="loading" class="flex justify-center py-12">
            <div class="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        </div>

        <!-- Card Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" x-show="!loading">
            <template x-for="item in items" :key="item.id">
                <div class="sound-card bg-surface rounded-2xl border border-border overflow-hidden">
                    <!-- Image (if available) -->
                    <template x-if="item.image_path">
                        <img :src="'/' + item.image_path" class="w-full h-32 object-cover" loading="lazy">
                    </template>

                    <div class="p-3 space-y-2">
                        <!-- Play Button + Area -->
                        <div class="flex items-center gap-2">
                            <button @click="togglePlay(item)"
                                    class="w-10 h-10 flex items-center justify-center rounded-full transition flex-shrink-0"
                                    :class="playing === item.id ? 'bg-red-500/10 text-red-500 playing-pulse' : 'bg-emerald-500/10 text-emerald-500'">
                                <i :data-lucide="playing === item.id ? 'pause' : 'play'" class="w-5 h-5"></i>
                            </button>
                            <div class="flex-1 min-w-0">
                                <p class="text-xs font-bold truncate" x-text="item.location?.area_name || '不明'"></p>
                                <p class="text-[10px] text-muted" x-text="formatDate(item.recorded_at)"></p>
                            </div>
                            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                                  :class="statusClass(item.identification_status)"
                                  x-text="statusLabel(item.identification_status)"></span>
                        </div>

                        <!-- BirdNET suggestion -->
                        <template x-if="item.birdnet_result && item.birdnet_result.top_species">
                            <div class="text-[11px] text-muted flex items-center gap-1">
                                <span class="opacity-60">AI:</span>
                                <span x-text="item.birdnet_result.top_species"></span>
                                <span class="opacity-40" x-text="'(' + Math.round((item.birdnet_result.top_confidence || 0) * 100) + '%)'"></span>
                            </div>
                        </template>

                        <!-- Identifications summary -->
                        <template x-if="item.identifications && item.identifications.length > 0">
                            <div class="text-[11px] text-muted">
                                <i data-lucide="users" class="w-3 h-3 inline"></i>
                                <span x-text="item.identifications.length + '件の提案'"></span>
                                <template x-if="topIdName(item)">
                                    <span class="text-text font-bold" x-text="' — ' + topIdName(item)"></span>
                                </template>
                            </div>
                        </template>

                        <!-- Source badge -->
                        <div class="flex items-center gap-1">
                            <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-faint"
                                  x-text="sourceLabel(item.source)"></span>
                            <template x-if="item.category">
                                <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-faint"
                                      x-text="categoryLabel(item.category)"></span>
                            </template>
                        </div>

                        <!-- Actions -->
                        <?php if ($isLoggedIn): ?>
                        <div class="flex gap-2 pt-1">
                            <button @click="openIdentify(item)"
                                    class="flex-1 flex items-center justify-center gap-1 bg-primary/10 text-primary rounded-xl py-2 text-xs font-bold hover:bg-primary/20 transition">
                                <i data-lucide="ear" class="w-3 h-3"></i> 同定する
                            </button>
                            <button @click="openReport(item)"
                                    class="flex items-center justify-center bg-red-500/10 text-red-400 rounded-xl px-3 py-2 text-xs hover:bg-red-500/20 transition">
                                <i data-lucide="flag" class="w-3 h-3"></i>
                            </button>
                        </div>
                        <?php endif; ?>
                    </div>
                </div>
            </template>
        </div>

        <!-- Empty state -->
        <div x-show="!loading && items.length === 0" class="text-center py-16">
            <i data-lucide="volume-x" class="w-12 h-12 text-muted mx-auto mb-3"></i>
            <p class="text-muted text-sm">まだ音声がありません</p>
        </div>

        <!-- Load More -->
        <div x-show="hasMore && !loading" class="mt-6 text-center">
            <button @click="loadMore()" class="bg-surface border border-border text-muted rounded-full px-6 py-2 text-sm font-bold hover:bg-elevated transition">
                もっと見る
            </button>
        </div>

        <!-- Hidden audio element -->
        <audio id="sa-player" @ended="playing = null" preload="none" style="display:none"></audio>

        <!-- ===== Upload Modal ===== -->
        <div x-show="showUpload" x-cloak
             class="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center"
             @click.self="showUpload = false" x-transition>
            <div class="bg-elevated w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                <div class="flex items-center justify-between">
                    <h3 class="font-bold text-lg">音声をアップロード</h3>
                    <button @click="showUpload = false" class="text-muted hover:text-text"><i data-lucide="x" class="w-5 h-5"></i></button>
                </div>

                <div class="space-y-3">
                    <div>
                        <label class="text-xs font-bold text-muted block mb-1">音声ファイル *</label>
                        <input type="file" accept="audio/*" @change="uploadForm.audio = $event.target.files[0]"
                               class="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-primary/10 file:text-primary file:font-bold file:text-xs">
                    </div>

                    <div>
                        <label class="text-xs font-bold text-muted block mb-1">画像（任意）</label>
                        <input type="file" accept="image/*" @change="uploadForm.image = $event.target.files[0]"
                               class="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-surface file:text-muted file:font-bold file:text-xs">
                        <p class="text-[10px] text-faint mt-1">声の主の写真があると同定の手がかりに</p>
                    </div>

                    <div>
                        <label class="text-xs font-bold text-muted block mb-1">カテゴリ</label>
                        <select x-model="uploadForm.category"
                                class="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm">
                            <option value="unknown">不明</option>
                            <option value="bird">鳥</option>
                            <option value="insect">昆虫</option>
                            <option value="frog">カエル</option>
                            <option value="mammal">哺乳類</option>
                            <option value="other">その他</option>
                        </select>
                    </div>

                    <div>
                        <label class="text-xs font-bold text-muted block mb-1">メモ（任意）</label>
                        <textarea x-model="uploadForm.memo" placeholder="聞こえた状況など"
                                  class="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm h-16 resize-none"></textarea>
                    </div>

                    <div class="text-[11px] text-muted">
                        <i data-lucide="map-pin" class="w-3 h-3 inline"></i>
                        <span x-text="uploadForm.lat ? '位置取得済み (' + uploadForm.lat.toFixed(4) + ', ' + uploadForm.lng.toFixed(4) + ')' : '位置情報を取得中...'"></span>
                    </div>
                </div>

                <button @click="submitUpload()"
                        :disabled="!uploadForm.audio || uploading"
                        class="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm disabled:opacity-40 transition">
                    <span x-show="!uploading">アップロード</span>
                    <span x-show="uploading" class="flex items-center justify-center gap-2">
                        <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        送信中...
                    </span>
                </button>
            </div>
        </div>

        <!-- ===== Identify Modal ===== -->
        <div x-show="identifyModal" x-cloak
             class="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center"
             @click.self="identifyModal = false" x-transition>
            <div class="bg-elevated w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                <div class="flex items-center justify-between">
                    <h3 class="font-bold text-lg">この音を同定する</h3>
                    <button @click="identifyModal = false" class="text-muted hover:text-text"><i data-lucide="x" class="w-5 h-5"></i></button>
                </div>

                <!-- Replay in modal -->
                <button @click="togglePlay(identifyTarget)"
                        class="w-full flex items-center justify-center gap-2 bg-surface border border-border rounded-xl py-3 transition"
                        :class="playing === identifyTarget?.id ? 'text-red-500' : 'text-primary'">
                    <i :data-lucide="playing === identifyTarget?.id ? 'pause' : 'play'" class="w-5 h-5"></i>
                    <span class="text-sm font-bold" x-text="playing === identifyTarget?.id ? '停止' : '再生'"></span>
                </button>

                <!-- Existing identifications -->
                <template x-if="identifyTarget && identifyTarget.identifications && identifyTarget.identifications.length > 0">
                    <div class="bg-surface rounded-xl p-3 space-y-1">
                        <p class="text-[10px] font-bold text-muted">これまでの提案:</p>
                        <template x-for="ident in identifyTarget.identifications" :key="ident.id">
                            <div class="flex items-center gap-2 text-xs">
                                <span class="font-bold" x-text="ident.suggested_name"></span>
                                <span class="text-faint" x-text="'(' + confidenceLabel(ident.confidence_self) + ')'"></span>
                            </div>
                        </template>
                    </div>
                </template>

                <div class="space-y-3">
                    <input x-model="identifyForm.suggested_name" placeholder="和名（例: ウグイス）"
                           class="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm">

                    <select x-model="identifyForm.category"
                            class="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm">
                        <option value="bird">鳥</option>
                        <option value="insect">昆虫</option>
                        <option value="frog">カエル</option>
                        <option value="mammal">哺乳類</option>
                        <option value="other">その他</option>
                        <option value="unknown">わからない</option>
                    </select>

                    <select x-model="identifyForm.confidence_self"
                            class="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm">
                        <option value="certain">確信あり</option>
                        <option value="likely">たぶん</option>
                        <option value="guess">推測</option>
                    </select>

                    <textarea x-model="identifyForm.comment" placeholder="根拠やメモ（任意）"
                              class="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm h-16 resize-none"></textarea>
                </div>

                <button @click="submitIdentify()"
                        :disabled="!identifyForm.suggested_name.trim() || submitting"
                        class="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm disabled:opacity-40 transition">
                    提案する
                </button>
            </div>
        </div>

        <!-- ===== Report Modal ===== -->
        <div x-show="reportModal" x-cloak
             class="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center"
             @click.self="reportModal = false" x-transition>
            <div class="bg-elevated w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 space-y-3">
                <div class="flex items-center justify-between">
                    <h3 class="font-bold text-lg">通報する</h3>
                    <button @click="reportModal = false" class="text-muted hover:text-text"><i data-lucide="x" class="w-5 h-5"></i></button>
                </div>

                <button @click="submitReport('human_voice')"
                        class="w-full bg-surface border border-border rounded-xl py-3 text-left px-4 text-sm hover:bg-elevated transition flex items-center gap-3">
                    <span class="text-base">🗣️</span> 人の声が入っている
                </button>
                <button @click="submitReport('noise')"
                        class="w-full bg-surface border border-border rounded-xl py-3 text-left px-4 text-sm hover:bg-elevated transition flex items-center gap-3">
                    <span class="text-base">🔇</span> ノイズ・無音
                </button>
                <button @click="submitReport('inappropriate')"
                        class="w-full bg-surface border border-border rounded-xl py-3 text-left px-4 text-sm hover:bg-elevated transition flex items-center gap-3">
                    <span class="text-base">⚠️</span> 不適切な内容
                </button>
            </div>
        </div>

    </main>

    <script>
    function soundArchive() {
        return {
            items: [],
            total: 0,
            page: 1,
            hasMore: false,
            loading: false,
            filter: 'all',
            playing: null,

            showUpload: false,
            uploading: false,
            uploadForm: { audio: null, image: null, category: 'unknown', memo: '', lat: 0, lng: 0 },

            identifyModal: false,
            identifyTarget: null,
            identifyForm: { suggested_name: '', category: 'bird', confidence_self: 'likely', comment: '' },

            reportModal: false,
            reportTarget: null,
            submitting: false,

            init() {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        pos => { this.uploadForm.lat = pos.coords.latitude; this.uploadForm.lng = pos.coords.longitude; },
                        () => {}, { enableHighAccuracy: true }
                    );
                }
            },

            async load() {
                this.loading = true;
                this.page = 1;
                try {
                    var status = this.filter === 'all' ? 'all' : this.filter;
                    var resp = await fetch('/api/v2/sound_archive_list.php?page=1&limit=20&status=' + status);
                    var json = await resp.json();
                    if (json.success) {
                        this.items = json.data.items;
                        this.total = json.data.total;
                        this.hasMore = json.data.has_more;
                    }
                } catch(e) { console.warn('Load error:', e); }
                this.loading = false;
                this.$nextTick(() => lucide.createIcons());
            },

            async loadMore() {
                this.page++;
                var status = this.filter === 'all' ? 'all' : this.filter;
                var resp = await fetch('/api/v2/sound_archive_list.php?page=' + this.page + '&limit=20&status=' + status);
                var json = await resp.json();
                if (json.success) {
                    this.items = this.items.concat(json.data.items);
                    this.hasMore = json.data.has_more;
                }
                this.$nextTick(() => lucide.createIcons());
            },

            togglePlay(item) {
                var player = document.getElementById('sa-player');
                if (this.playing === item.id) {
                    player.pause();
                    this.playing = null;
                } else {
                    player.src = '/' + item.audio_path;
                    player.play();
                    this.playing = item.id;
                }
                this.$nextTick(() => lucide.createIcons());
            },

            async submitUpload() {
                if (!this.uploadForm.audio || this.uploading) return;
                this.uploading = true;
                try {
                    var fd = new FormData();
                    fd.append('audio', this.uploadForm.audio);
                    if (this.uploadForm.image) fd.append('image', this.uploadForm.image);
                    fd.append('category', this.uploadForm.category);
                    fd.append('memo', this.uploadForm.memo);
                    fd.append('lat', this.uploadForm.lat || 0);
                    fd.append('lng', this.uploadForm.lng || 0);
                    fd.append('csrf_token', '<?= $csrfToken ?>');

                    var resp = await fetch('/api/v2/sound_archive_upload.php', { method: 'POST', body: fd });
                    var json = await resp.json();
                    if (json.success) {
                        this.showUpload = false;
                        this.uploadForm = { audio: null, image: null, category: 'unknown', memo: '', lat: this.uploadForm.lat, lng: this.uploadForm.lng };
                        this.load();
                    } else {
                        alert(json.error?.message || 'アップロードに失敗しました');
                    }
                } catch(e) { alert('エラーが発生しました'); }
                this.uploading = false;
            },

            openIdentify(item) {
                this.identifyTarget = item;
                this.identifyForm = { suggested_name: '', category: 'bird', confidence_self: 'likely', comment: '' };
                this.identifyModal = true;
                this.$nextTick(() => lucide.createIcons());
            },

            async submitIdentify() {
                if (!this.identifyForm.suggested_name.trim() || this.submitting) return;
                this.submitting = true;
                try {
                    var resp = await fetch('/api/v2/sound_archive_identify.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '<?= $csrfToken ?>' },
                        body: JSON.stringify({
                            archive_id: this.identifyTarget.id,
                            suggested_name: this.identifyForm.suggested_name,
                            category: this.identifyForm.category,
                            confidence_self: this.identifyForm.confidence_self,
                            comment: this.identifyForm.comment,
                        })
                    });
                    var json = await resp.json();
                    if (json.success) {
                        this.identifyModal = false;
                        this.load();
                    } else {
                        alert(json.error?.message || '送信に失敗しました');
                    }
                } catch(e) { alert('エラーが発生しました'); }
                this.submitting = false;
            },

            openReport(item) {
                this.reportTarget = item;
                this.reportModal = true;
            },

            async submitReport(reason) {
                try {
                    var resp = await fetch('/api/v2/sound_archive_report.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '<?= $csrfToken ?>' },
                        body: JSON.stringify({ archive_id: this.reportTarget.id, reason: reason })
                    });
                    var json = await resp.json();
                    if (json.success) {
                        this.reportModal = false;
                        if (json.data.hidden) {
                            this.items = this.items.filter(i => i.id !== this.reportTarget.id);
                        }
                    } else {
                        alert(json.error?.message || '通報に失敗しました');
                    }
                } catch(e) { alert('エラーが発生しました'); }
            },

            formatDate(dt) {
                if (!dt) return '';
                var d = new Date(dt);
                return (d.getMonth()+1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2,'0');
            },

            statusClass(s) {
                if (s === 'identified') return 'bg-emerald-500/10 text-emerald-500';
                if (s === 'suggested') return 'bg-blue-500/10 text-blue-500';
                return 'bg-amber-500/10 text-amber-500';
            },

            statusLabel(s) {
                if (s === 'identified') return '同定済み';
                if (s === 'suggested') return '提案あり';
                return '同定待ち';
            },

            sourceLabel(s) {
                if (s === 'walk') return 'ウォーク';
                if (s === 'field_scan') return 'スキャン';
                return '手動';
            },

            categoryLabel(c) {
                var m = { bird: '鳥', insect: '昆虫', frog: 'カエル', mammal: '哺乳類', fish: '魚', other: 'その他', unknown: '不明' };
                return m[c] || c;
            },

            confidenceLabel(c) {
                var m = { certain: '確信', likely: 'たぶん', guess: '推測' };
                return m[c] || c;
            },

            topIdName(item) {
                if (!item.identifications || item.identifications.length === 0) return null;
                var counts = {};
                item.identifications.forEach(function(id) {
                    counts[id.suggested_name] = (counts[id.suggested_name] || 0) + 1;
                });
                var top = Object.entries(counts).sort(function(a,b) { return b[1] - a[1]; })[0];
                return top ? top[0] : null;
            }
        };
    }
    </script>
    <script>lucide.createIcons();</script>
    <?php include __DIR__ . '/components/footer.php'; ?>
</body>

</html>
