<?php
/**
 * century_archive.php — 記録が保全に変わる理由
 *
 * ikimon.life の設計思想・学術的裏付け・100年アーカイブ哲学を伝える母艦ページ。
 */
require_once __DIR__ . '/../config/config.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/CspNonce.php';

Auth::init();
$currentUser = Auth::user();

$totalObs = 0;
$totalUsers = 0;
try {
    $allObs = DataStore::fetchAll('observations');
    $totalObs = is_array($allObs) ? count($allObs) : 0;
    $userIds = [];
    foreach ($allObs as $obs) {
        if (!empty($obs['user_id'])) $userIds[$obs['user_id']] = true;
    }
    $totalUsers = count($userIds);
} catch (Exception $e) {}

$meta_title = "記録が保全に変わる理由 | ikimon.life";
$meta_description = "生物多様性データが保全の答えに変わる仕組み。ikimon.life の設計思想と100年アーカイブ哲学。";
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <style nonce="<?= CspNonce::attr() ?>">
        .step-line { border-left: 2px dashed var(--color-border, #e5e7eb); margin-left: 19px; }
        .step-dot { width: 40px; height: 40px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; flex-shrink: 0; }
        .scroll-target { scroll-margin-top: 80px; }
    </style>
</head>
<body class="bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">
    <?php include __DIR__ . '/components/nav.php'; ?>

    <main class="max-w-3xl mx-auto px-6 py-20 pb-32">

        <!-- Hero -->
        <header class="mb-20 text-center">
            <span class="inline-block px-4 py-1.5 rounded-full bg-surface border border-border text-emerald-500 text-xs font-bold uppercase tracking-widest mb-6">
                Why ikimon
            </span>
            <h1 class="text-3xl md:text-5xl font-black mb-6 leading-tight">
                見つけて終わりじゃない。
            </h1>
            <p class="text-lg text-muted max-w-xl mx-auto leading-relaxed">
                あなたの1枚が、この町の自然を未来に残す。<br class="hidden md:block">
                記録を集めるだけでなく、保全の答えに変える仕組みがここにあります。
            </p>
        </header>

        <div class="space-y-20">

            <!-- ==============================
                 1. なぜ、記録が増えても保全の答えにならないのか
            ============================== -->
            <section id="data-gap" class="scroll-target">
                <div class="flex items-center gap-3 mb-8">
                    <div class="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center">
                        <i data-lucide="alert-circle" class="w-5 h-5 text-rose-400"></i>
                    </div>
                    <h2 class="text-2xl font-black">なぜ、記録が増えても<br class="sm:hidden">保全の答えにならないのか</h2>
                </div>

                <div class="bg-surface rounded-2xl p-6 border border-border space-y-4">
                    <p class="text-sm text-muted leading-relaxed">
                        世界最大の生物多様性データベース GBIF には毎年数億件の観測データが追加されています。
                        AI による種同定、環境 DNA、音響センサーなどの技術革新も進んでいます。
                    </p>
                    <p class="text-sm text-muted leading-relaxed">
                        しかし 2026年3月、44名の研究者が PNAS で共同発表した論文は、明確にこう指摘しました。
                        <strong class="text-[var(--color-text)]">「データが多い」ことと「保全の答えがある」ことは別の問題だ</strong>、と。
                    </p>
                    <p class="text-sm text-muted leading-relaxed">
                        記録がバラバラの形式で散在し、品質が担保されず、政策や企業の意思決定に接続できなければ、
                        どれだけ数が増えても「何が起きているか」を超えて「何をすべきか」には到達しません。
                    </p>
                    <p class="text-xs text-faint mt-2">
                        参考: Sutherland, W.J. et al. (2026-03-04) PNAS — 提言 1, 2, 5
                    </p>
                </div>
            </section>

            <!-- ==============================
                 2. ikimon は何を変えているのか
            ============================== -->
            <section id="what-we-change" class="scroll-target">
                <div class="flex items-center gap-3 mb-8">
                    <div class="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                        <i data-lucide="layers" class="w-5 h-5 text-emerald-400"></i>
                    </div>
                    <h2 class="text-2xl font-black">ikimon は何を変えているのか</h2>
                </div>

                <div class="grid sm:grid-cols-2 gap-4">
                    <div class="bg-surface rounded-2xl p-6 border border-border">
                        <div class="flex items-center gap-2 mb-3">
                            <i data-lucide="database" class="w-5 h-5 text-emerald-500"></i>
                            <h3 class="text-base font-bold">統一スキーマ</h3>
                        </div>
                        <p class="text-sm text-muted leading-relaxed">
                            画像・音声・GPS・環境データを DarwinCore 準拠の共通形式で記録。
                            誰がいつどこで何をどう観察したかが、1つの構造で残ります。
                        </p>
                    </div>

                    <div class="bg-surface rounded-2xl p-6 border border-border">
                        <div class="flex items-center gap-2 mb-3">
                            <i data-lucide="shield-check" class="w-5 h-5 text-emerald-500"></i>
                            <h3 class="text-base font-bold">エビデンス段階制</h3>
                        </div>
                        <p class="text-sm text-muted leading-relaxed">
                            AI の初期判定から、コミュニティレビュー、研究利用可、企業開示に使える品質まで。
                            データの信頼度を段階的に育てる仕組みです。
                        </p>
                    </div>

                    <div class="bg-surface rounded-2xl p-6 border border-border">
                        <div class="flex items-center gap-2 mb-3">
                            <i data-lucide="users" class="w-5 h-5 text-emerald-500"></i>
                            <h3 class="text-base font-bold">検証ワークベンチ</h3>
                        </div>
                        <p class="text-sm text-muted leading-relaxed">
                            市民レビュアーから専門家まで、4階層の検証体制。
                            誰がいつ何を判断したかの監査証跡が残り、AI の誤りも追跡できます。
                        </p>
                    </div>

                    <div class="bg-surface rounded-2xl p-6 border border-border">
                        <div class="flex items-center gap-2 mb-3">
                            <i data-lucide="globe" class="w-5 h-5 text-emerald-500"></i>
                            <h3 class="text-base font-bold">GBIF 連携</h3>
                        </div>
                        <p class="text-sm text-muted leading-relaxed">
                            検証されたデータは GBIF を通じて世界に公開。
                            ikimon が停止してもデータは生き続けます。プラットフォーム非依存の永続性です。
                        </p>
                    </div>
                </div>

                <p class="text-xs text-faint mt-4">
                    Sutherland et al. 提言 1（データ統合）, 2（標準化）, 3（較正）, 5（信頼DB）, 9（耐性）に対応
                </p>
            </section>

            <!-- ==============================
                 3. あなたの1記録が、地域の答えになるまで
            ============================== -->
            <section id="pipeline" class="scroll-target">
                <div class="flex items-center gap-3 mb-8">
                    <div class="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                        <i data-lucide="git-branch" class="w-5 h-5 text-blue-400"></i>
                    </div>
                    <h2 class="text-2xl font-black">あなたの1記録が、<br class="sm:hidden">地域の答えになるまで</h2>
                </div>

                <div class="space-y-0">
                    <!-- Step 1 -->
                    <div class="flex items-start gap-4">
                        <div class="step-dot bg-blue-500/15 text-blue-500">1</div>
                        <div class="pb-6">
                            <h3 class="text-base font-bold mb-1">観察する</h3>
                            <p class="text-sm text-muted">写真・音・GPSを記録。散歩中の1枚でも、センサーによる連続記録でも。</p>
                        </div>
                    </div>
                    <div class="step-line pl-8">
                        <!-- Step 2 -->
                        <div class="flex items-start gap-4 -ml-[25px]">
                            <div class="step-dot bg-purple-500/15 text-purple-500">2</div>
                            <div class="pb-6">
                                <h3 class="text-base font-bold mb-1">検証される</h3>
                                <p class="text-sm text-muted">AIが種を推定し、コミュニティのレビュアーが確認。信頼度が段階的に上がります。</p>
                            </div>
                        </div>
                        <!-- Step 3 -->
                        <div class="flex items-start gap-4 -ml-[25px]">
                            <div class="step-dot bg-teal-500/15 text-teal-500">3</div>
                            <div class="pb-6">
                                <h3 class="text-base font-bold mb-1">サイトに蓄積される</h3>
                                <p class="text-sm text-muted">同じ場所の記録が積み重なり、その地域の生物多様性の時系列データに育ちます。</p>
                            </div>
                        </div>
                        <!-- Step 4 -->
                        <div class="flex items-start gap-4 -ml-[25px]">
                            <div class="step-dot bg-emerald-500/15 text-emerald-500">4</div>
                            <div>
                                <h3 class="text-base font-bold mb-1">保全の答えになる</h3>
                                <p class="text-sm text-muted">TNFDレポート・OECM認定根拠・自治体の政策資料・研究データとして活用されます。</p>
                            </div>
                        </div>
                    </div>
                </div>

                <p class="text-xs text-faint mt-6">
                    Sutherland et al. 提言 3（較正）, 6（価値評価）, 8（介入効果）に対応
                </p>
            </section>

            <!-- ==============================
                 4. 30by30・OECM・TNFDにどうつながるか
            ============================== -->
            <section id="policy-link" class="scroll-target">
                <div class="flex items-center gap-3 mb-8">
                    <div class="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                        <i data-lucide="landmark" class="w-5 h-5 text-indigo-400"></i>
                    </div>
                    <h2 class="text-2xl font-black">30by30・OECM・TNFDに<br class="sm:hidden">どうつながるか</h2>
                </div>

                <div class="grid sm:grid-cols-3 gap-4">
                    <div class="bg-surface rounded-2xl p-6 border border-border">
                        <h3 class="text-base font-bold mb-2 text-emerald-500">30by30</h3>
                        <p class="text-sm text-muted leading-relaxed mb-3">
                            2030年までに陸と海の30%を保全する国際目標。日本では自然共生サイト（OECM）の認定が加速しています。
                        </p>
                        <p class="text-xs text-faint">市民の記録が、保全対象エリアの生態系価値を証明する根拠になります。</p>
                    </div>

                    <div class="bg-surface rounded-2xl p-6 border border-border">
                        <h3 class="text-base font-bold mb-2 text-emerald-500">OECM</h3>
                        <p class="text-sm text-muted leading-relaxed mb-3">
                            企業敷地・里山・学校林・都市公園も OECM 候補になりえます。認定に必要なのは継続的なモニタリングデータです。
                        </p>
                        <p class="text-xs text-faint">ikimon のサイトダッシュボードが、そのモニタリング基盤として機能します。</p>
                    </div>

                    <div class="bg-surface rounded-2xl p-6 border border-border">
                        <h3 class="text-base font-bold mb-2 text-emerald-500">TNFD</h3>
                        <p class="text-sm text-muted leading-relaxed mb-3">
                            自然関連財務情報開示。LEAP分析の「Locate（場所の特定）」「Evaluate（影響評価）」に観察データが対応します。
                        </p>
                        <p class="text-xs text-faint">検証済みデータとサイトレポートが、開示の根拠資料になります。</p>
                    </div>
                </div>

                <p class="text-xs text-faint mt-4">
                    Sutherland et al. 提言 4（ギャップ解消）, 6（価値評価）, 8（介入効果）, 9（耐性）に対応
                </p>
            </section>

            <!-- ==============================
                 5. 100年アーカイブとは何か
            ============================== -->
            <section id="century-archive" class="scroll-target">
                <div class="flex items-center gap-3 mb-8">
                    <div class="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                        <i data-lucide="archive" class="w-5 h-5 text-amber-400"></i>
                    </div>
                    <h2 class="text-2xl font-black">100年アーカイブとは何か</h2>
                </div>

                <div class="bg-surface rounded-2xl p-6 border border-border mb-6">
                    <div class="text-sm text-muted leading-relaxed space-y-4">
                        <p>
                            今年の春に聞こえた鳥の声、咲いた順番、池のほとりの気温。
                            <strong class="text-[var(--color-text)]">今年記録しなかったものは、来年も10年後も比べられません。</strong>
                        </p>
                        <p>
                            100年アーカイブは「100年後のために我慢する」仕組みではありません。
                            今日の散歩を少しだけ豊かにしながら、その記録が来年との比較に使え、10年後の変化を捉え、
                            100年後の研究者が2026年の生態系を理解する手がかりになる。そういう仕組みです。
                        </p>
                        <p>
                            企業や自治体にとっては、<strong class="text-[var(--color-text)]">担当者が変わっても地域の自然記録が消えない仕組み</strong>でもあります。
                            データは DarwinCore 形式で GBIF に提供され、プラットフォームの存続に依存しません。
                        </p>
                    </div>
                </div>

                <!-- Live stats -->
                <div class="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-2xl p-6 border border-emerald-200 dark:border-emerald-800">
                    <h3 class="text-sm font-bold text-center mb-4">アーカイブの現在</h3>
                    <div class="flex justify-around text-center">
                        <div>
                            <div class="text-2xl font-black text-emerald-500"><?= number_format($totalObs) ?></div>
                            <div class="text-xs text-muted">記録</div>
                        </div>
                        <div>
                            <div class="text-2xl font-black text-emerald-500"><?= number_format($totalUsers) ?></div>
                            <div class="text-xs text-muted">参加者</div>
                        </div>
                        <div>
                            <div class="text-2xl font-black text-emerald-500">2026</div>
                            <div class="text-xs text-muted">開始年</div>
                        </div>
                    </div>
                    <p class="text-xs text-center text-muted mt-4">
                        いいねは消えます。SNSの投稿は流れます。でも、科学データベースに記録された観察は消えません。
                    </p>
                </div>
            </section>

            <!-- ==============================
                 6. まだ未完の領域
            ============================== -->
            <section id="gaps" class="scroll-target">
                <div class="flex items-center gap-3 mb-8">
                    <div class="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                        <i data-lucide="construction" class="w-5 h-5 text-amber-400"></i>
                    </div>
                    <h2 class="text-2xl font-black">まだ未完の領域</h2>
                </div>

                <div class="bg-amber-50 dark:bg-amber-950/20 rounded-2xl p-6 border border-amber-200 dark:border-amber-800/40 space-y-4">
                    <p class="text-sm text-muted leading-relaxed">
                        Sutherland et al. の9提言のうち、以下の2領域は ikimon でも今後の強化課題です。
                        過大に語るより、正直に示す方が信頼に値すると考えています。
                    </p>
                    <div class="flex items-start gap-3">
                        <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"></i>
                        <div>
                            <div class="text-sm font-bold">地域知識の敬意ある統合（提言 7）</div>
                            <div class="text-xs text-muted">先住民・地域住民が世代を超えて持つ自然の知見を、適切な同意と敬意のもとに組み込む仕組み。地方創生戦略と接続して取り組みます。</div>
                        </div>
                    </div>
                    <div class="flex items-start gap-3">
                        <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"></i>
                        <div>
                            <div class="text-sm font-bold">介入効果の厳密な定量化（提言 8）</div>
                            <div class="text-xs text-muted">「保護活動がなかったらどうなっていたか」という反事実推定を可能にする精密生態学。BIS時系列データと介入記録の接続を計画しています。</div>
                        </div>
                    </div>
                </div>
            </section>

        </div>

        <!-- CTA -->
        <div class="mt-20 text-center space-y-4">
            <a href="field_research.php" class="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white text-base bg-emerald-500 hover:bg-emerald-600 transition">
                <i data-lucide="search" class="w-5 h-5"></i>
                観察を始める
            </a>
            <div class="text-xs text-muted">写真1枚からでも、散歩の記録からでも参加できます</div>

            <div class="flex flex-wrap justify-center gap-4 mt-6 pt-6 border-t border-border">
                <a href="for-business/" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-surface border border-border font-bold text-sm hover:bg-elevated transition">
                    <i data-lucide="building-2" class="w-4 h-4"></i>
                    企業・自治体の方へ
                </a>
                <a href="for-researcher.php" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-surface border border-border font-bold text-sm hover:bg-elevated transition">
                    <i data-lucide="flask-conical" class="w-4 h-4"></i>
                    データを持ち帰りたい方へ
                </a>
            </div>
        </div>

    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>
</body>
</html>
