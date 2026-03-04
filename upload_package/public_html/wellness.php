<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';

Auth::init();
$user = Auth::user();

if (!$user) {
    header('Location: login.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="ja">
<?php
$meta_title = "ネイチャーウェルネス — ikimon";
$meta_description = "自然がもたらす心身の健康。あなたのフィールド活動がウェルネス指標になります。";
?>

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
</head>

<body class="js-loading pt-14 bg-base text-text font-body">
    <?php include('components/nav.php'); ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <main class="max-w-5xl mx-auto px-4 md:px-6 py-12 md:py-32 pb-32" x-data="wellnessDashboard()" x-init="loadData()">

        <!-- Page Header -->
        <header class="mb-12">
            <div class="flex items-center gap-4 mb-3">
                <a href="profile.php" class="text-muted hover:text-text transition">
                    <i data-lucide="arrow-left" class="w-5 h-5"></i>
                </a>
                <div>
                    <h1 class="text-2xl md:text-3xl font-black text-text tracking-tight flex items-center gap-3 mb-2">
                        🌿 ネイチャーウェルネス
                    </h1>
                    <p class="text-muted text-sm mt-1">自然がもたらす心身の健康</p>
                </div>
            </div>
        </header>

        <!-- Loading State -->
        <div x-show="loading" class="flex items-center justify-center py-24">
            <div class="text-center">
                <div class="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                <p class="text-muted text-sm">ウェルネスデータを読み込み中...</p>
            </div>
        </div>

        <div x-show="!loading" x-cloak>

            <!-- Section 1: Weekly Nature Time Summary -->
            <section class="bg-surface border border-border rounded-2xl p-6 mb-6">
                <h2 class="text-sm font-black text-text uppercase tracking-widest mb-5 flex items-center gap-2">
                    <span>🌳</span> 週間自然時間
                </h2>

                <!-- 4-Week Grid -->
                <div class="space-y-4">
                    <template x-for="(week, i) in (data?.weekly_nature ?? [])" :key="i">
                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-xs font-bold text-muted" x-text="formatWeekLabel(week.week, i)"></span>
                                <span class="text-xs font-black"
                                    :class="week.achieved ? 'text-primary' : 'text-text'"
                                    x-text="week.minutes + ' / ' + week.target + '分'"></span>
                            </div>
                            <div class="relative h-3 rounded-full bg-[var(--color-bg-base)] overflow-hidden">
                                <div class="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
                                    :style="'width:' + week.percentage + '%; background: linear-gradient(90deg,' + (week.achieved ? '#43a047, #66bb6a' : '#90a4ae, #b0bec5') + ');'">
                                </div>
                            </div>
                            <p class="text-muted mt-1" style="font-size: var(--text-xs);"
                                x-show="week.achieved">🎉 WHO推奨達成！</p>
                        </div>
                    </template>
                </div>

                <!-- Monthly Summary -->
                <div class="mt-5 pt-5 border-t border-border flex items-center justify-between">
                    <span class="text-xs font-bold text-muted uppercase tracking-wider">月間合計</span>
                    <span class="text-lg font-black text-primary" x-text="monthlyTotal + '分'"></span>
                </div>
            </section>

            <!-- Section 2: Field Session History -->
            <section class="bg-surface border border-border rounded-2xl p-6 mb-6">
                <h2 class="text-sm font-black text-text uppercase tracking-widest mb-5 flex items-center gap-2">
                    <span>🥾</span> フィールドセッション履歴
                </h2>

                <div x-show="sessions.length === 0" class="text-center py-8">
                    <p class="text-muted text-sm">まだフィールドセッションがありません。観察を投稿するとここに表示されます。</p>
                </div>

                <div class="space-y-3">
                    <template x-for="(s, i) in sessions" :key="i">
                        <div class="flex items-center gap-4 p-3 rounded-xl bg-[var(--color-bg-base)] hover:bg-[var(--color-bg-base)]/80 transition">
                            <div class="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                                :class="s.duration_min >= 30 ? 'bg-primary/10' : 'bg-muted/10'"
                                x-text="s.duration_min >= 30 ? '🟢' : '🟡'">
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-bold text-text truncate" x-text="s.date"></p>
                                <p class="text-muted truncate" style="font-size: var(--text-xs);"
                                    x-text="s.observation_count + '件の観察 · ' + s.species_count + '種'"></p>
                            </div>
                            <div class="text-right">
                                <p class="text-sm font-black" :class="s.duration_min >= 30 ? 'text-primary' : 'text-muted'"
                                    x-text="s.duration_min + '分'"></p>
                            </div>
                        </div>
                    </template>
                </div>
            </section>

            <!-- Section 3: Cognitive & Emotional Wellness -->
            <div class="grid md:grid-cols-2 gap-6 mb-6">
                <!-- Cognitive -->
                <section class="bg-surface border border-border rounded-2xl p-6">
                    <h2 class="text-sm font-black text-text uppercase tracking-widest mb-5 flex items-center gap-2">
                        <span>🧠</span> 認知ウェルネス
                    </h2>
                    <div class="space-y-4">
                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-xs font-bold text-muted">観察密度</span>
                                <span class="text-xs font-black text-text" x-text="(data?.cognitive?.observation_density ?? 0) + '件/時間'"></span>
                            </div>
                            <div class="relative h-2 rounded-full bg-[var(--color-bg-base)] overflow-hidden">
                                <div class="absolute inset-y-0 left-0 rounded-full bg-accent transition-all duration-1000"
                                    :style="'width:' + Math.min(100, (data?.cognitive?.observation_density ?? 0) * 10) + '%'"></div>
                            </div>
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-xs font-bold text-muted">種の多様性</span>
                                <span class="text-xs font-black text-text" x-text="(data?.cognitive?.unique_species_count ?? 0) + '種'"></span>
                            </div>
                            <div class="relative h-2 rounded-full bg-[var(--color-bg-base)] overflow-hidden">
                                <div class="absolute inset-y-0 left-0 rounded-full bg-secondary transition-all duration-1000"
                                    :style="'width:' + Math.min(100, (data?.cognitive?.unique_species_count ?? 0) * 5) + '%'"></div>
                            </div>
                        </div>
                        <div class="text-center pt-4 border-t border-border">
                            <p class="text-3xl font-black text-accent" x-text="data?.cognitive?.cognitive_engagement ?? 0"></p>
                            <p class="text-xs font-bold text-muted uppercase tracking-wider mt-1">認知エンゲージメント</p>
                            <p class="text-muted mt-1" style="font-size: 9px;">観察密度・種多様性・新発見に基づく参考指標</p>
                        </div>
                    </div>
                </section>

                <!-- Emotional -->
                <section class="bg-surface border border-border rounded-2xl p-6">
                    <h2 class="text-sm font-black text-text uppercase tracking-widest mb-5 flex items-center gap-2">
                        <span>💚</span> 感情ウェルネス
                    </h2>
                    <div class="space-y-4">
                        <div class="flex items-center justify-between p-3 rounded-xl bg-[var(--color-bg-base)]">
                            <span class="text-xs font-bold text-muted">🔥 連続記録</span>
                            <span class="text-lg font-black text-text" x-text="(data?.emotional?.streak_days ?? 0) + '日'"></span>
                        </div>
                        <div class="flex items-center justify-between p-3 rounded-xl bg-[var(--color-bg-base)]">
                            <span class="text-xs font-bold text-muted">🆕 今期の新種</span>
                            <span class="text-lg font-black text-secondary" x-text="'+' + (data?.cognitive?.new_species_count ?? 0)"></span>
                        </div>
                        <div class="flex items-center justify-between p-3 rounded-xl bg-[var(--color-bg-base)]">
                            <span class="text-xs font-bold text-muted">📋 ライフリスト</span>
                            <span class="text-lg font-black text-primary" x-text="(data?.emotional?.lifelist_total ?? 0) + '種'"></span>
                        </div>

                        <!-- Next Milestone -->
                        <div class="pt-4 border-t border-border" x-show="data?.emotional?.next_milestone">
                            <p class="text-xs font-bold text-muted mb-1">次のマイルストーン</p>
                            <div class="flex items-center justify-between">
                                <span class="text-sm font-black text-text" x-text="data?.emotional?.next_milestone?.label ?? ''"></span>
                                <span class="text-xs text-muted"
                                    x-text="'あと ' + ((data?.emotional?.next_milestone?.threshold ?? 0) - (data?.emotional?.lifelist_total ?? 0)) + '種'"></span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <!-- Section 4: Scientific Evidence -->
            <section class="bg-surface border border-border rounded-2xl p-6">
                <h2 class="text-sm font-black text-text uppercase tracking-widest mb-5 flex items-center gap-2">
                    <span>📚</span> 科学的エビデンス
                </h2>
                <div class="space-y-4 text-sm text-muted leading-relaxed">
                    <div class="p-4 rounded-xl bg-[var(--color-bg-base)] border-l-4 border-primary">
                        <p class="font-bold text-text mb-1">週120分の自然接触</p>
                        <p>週に120分以上自然の中で過ごす人は、そうでない人に比べて、良好な健康状態と高い心理的ウェルビーイングを報告する確率が有意に高い。</p>
                        <p class="mt-2 text-xs italic">White, M.P. et al. (2019). Spending at least 120 minutes a week in nature is associated with good health and wellbeing. <em>Scientific Reports</em>, 9(1), 7730.</p>
                    </div>
                    <div class="p-4 rounded-xl bg-[var(--color-bg-base)] border-l-4 border-secondary">
                        <p class="font-bold text-text mb-1">生物多様性と認知機能</p>
                        <p>自然環境での観察活動は「デュアルタスク」として機能し、歩行しながら種を同定する行為が前頭葉の活性化を促す。</p>
                        <p class="mt-2 text-xs italic">Sudimac, S. et al. (2022). How nature nurtures: Amygdala activity decreases as the result of a one-hour walk in nature. <em>Molecular Psychiatry</em>, 27, 4446–4452.</p>
                    </div>
                    <div class="p-4 rounded-xl bg-[var(--color-bg-base)] border-l-4 border-accent">
                        <p class="font-bold text-text mb-1">種の発見と幸福感</p>
                        <p>生物多様性が高い環境で過ごすことは、それ自体がメンタルヘルスの改善と関連しており、新しい種を「発見」する体験が内発的動機を強化する。</p>
                        <p class="mt-2 text-xs italic">Marselle, M.R. et al. (2021). Biodiversity and Health in the Urban Environment. <em>Current Environmental Health Reports</em>, 8, 146–156.</p>
                    </div>
                    <div class="p-4 rounded-xl bg-[var(--color-bg-base)] border-l-4 border-muted mt-4">
                        <p class="font-bold text-text mb-1">⚠️ 認知エンゲージメントについて</p>
                        <p>本指標は上記の学術知見に<strong>着想を得た参考指標</strong>です。観察密度・種の多様性・新種発見の3要素を均等配分で0-100にスコアリングしていますが、このスコアリング式自体は臨床的に検証されたものではありません。</p>
                        <p class="mt-2 text-xs italic">参考: Shimada, H. et al. (2018). Effects of combined physical and cognitive exercises on cognition. <em>J. Am. Med. Dir. Assoc.</em>; Soga, M. & Gaston, K.J. (2020). Extinction of experience. <em>PNAS</em>.</p>
                    </div>
                </div>
            </section>

        </div>
    </main>

    <?php include('components/footer.php'); ?>

    <!-- Alpine.js & Lucide -->
    <script src="https://unpkg.com/lucide@0.469.0"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.3/dist/cdn.min.js"></script>

    <script nonce="<?= CspNonce::attr() ?>">
        function wellnessDashboard() {
            return {
                loading: true,
                data: null,
                sessions: [],

                get monthlyTotal() {
                    const wn = this.data?.weekly_nature;
                    if (!wn || !wn.length) return 0;
                    return wn.reduce((sum, w) => sum + (w.minutes ?? 0), 0);
                },

                formatWeekLabel(weekKey, index) {
                    const labels = ['3週間前', '2週間前', '先週', '今週'];
                    return labels[index] ?? weekKey;
                },

                async loadData() {
                    try {
                        const [wellRes, sessRes] = await Promise.all([
                            fetch('api/get_wellness_summary.php?period=month'),
                            fetch('api/get_field_sessions.php?period=month'),
                        ]);

                        const wellData = await wellRes.json();
                        if (wellData.success && wellData.data) {
                            this.data = wellData.data;
                        }

                        const sessData = await sessRes.json();
                        if (sessData.success && sessData.sessions) {
                            this.sessions = sessData.sessions.map(s => ({
                                date: new Date(s.start_time * 1000).toLocaleDateString('ja-JP', {
                                    month: 'short',
                                    day: 'numeric',
                                    weekday: 'short'
                                }),
                                duration_min: s.duration_min ?? 0,
                                observation_count: s.observation_count ?? 0,
                                species_count: s.unique_species ?? 0,
                            }));
                        }
                    } catch (e) {
                        console.error('Wellness dashboard load error', e);
                    }
                    this.loading = false;
                    this.$nextTick(() => lucide.createIcons());
                }
            };
        }

        lucide.createIcons();
    </script>
</body>

</html>