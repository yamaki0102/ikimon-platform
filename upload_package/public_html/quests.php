<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/QuestManager.php';

Auth::init();
$currentUser = Auth::user();
$meta_title = 'クエスト | ikimon.life';

$dailyQuests = QuestManager::getActiveQuests($currentUser ? $currentUser['id'] : null);
$scanQuests = $currentUser ? QuestManager::getScanQuests($currentUser['id']) : [];
$totalActive = count($scanQuests) + count($dailyQuests);

$dailyProgress = [];
if ($currentUser) {
    foreach ($dailyQuests as $q) {
        $dailyProgress[$q['id'] ?? ''] = QuestManager::checkProgress($currentUser['id'], $q['id'] ?? '');
    }
}

$significanceTexts = [
    'redlist' => [
        'why' => '絶滅危惧種の生息確認は、保全行政の基礎データです。あなたの1枚の写真が、この種の保護区域設定や環境影響評価に使われる可能性があります。',
        'icon' => 'shield-alert',
    ],
    'area_first' => [
        'why' => '新しい場所での種の記録は、分布域の変化を追跡する科学データになります。気候変動や都市化が生物の分布にどう影響しているかを知る手がかりです。',
        'icon' => 'map-pin-plus',
    ],
    'id_challenge' => [
        'why' => 'AIが科名レベルまで絞った生物の種名を特定することは、機械学習モデルの訓練データにもなります。人間とAIの協働で同定精度が上がります。',
        'icon' => 'microscope',
    ],
    'evidence_upgrade' => [
        'why' => '写真証拠が加わることで、AI単独検出（Tier 1）からコミュニティ検証可能（Tier 2）にデータグレードが上がります。論文に引用できる品質に近づきます。',
        'icon' => 'trending-up',
    ],
    'new_species' => [
        'why' => 'あなたのLife Listが広がるだけでなく、地域の種多様性データベースが豊かになります。将来の研究者がこのデータを参照する日が来るかもしれません。',
        'icon' => 'sparkles',
    ],
    'photo_needed' => [
        'why' => '写真付き記録は、将来の同定修正や分類学的再検討に不可欠です。音声やAI検出だけでは確認できない形態的特徴を保存できます。',
        'icon' => 'camera',
    ],
];

$badgeColors = [
    'redlist'          => 'bg-red-100 text-red-700 border-red-200',
    'area_first'       => 'bg-amber-100 text-amber-700 border-amber-200',
    'id_challenge'     => 'bg-purple-100 text-purple-700 border-purple-200',
    'evidence_upgrade' => 'bg-blue-100 text-blue-700 border-blue-200',
    'new_species'      => 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'photo_needed'     => 'bg-gray-100 text-gray-600 border-gray-200',
];

$bgGradients = [
    'redlist'          => 'from-red-50 to-rose-50',
    'area_first'       => 'from-amber-50 to-orange-50',
    'id_challenge'     => 'from-purple-50 to-violet-50',
    'evidence_upgrade' => 'from-blue-50 to-sky-50',
    'new_species'      => 'from-emerald-50 to-teal-50',
    'photo_needed'     => 'from-gray-50 to-slate-50',
];
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
</head>
<body class="bg-background text-text">
<?php include __DIR__ . '/components/nav.php'; ?>

<main class="max-w-lg mx-auto px-4 pb-24" style="padding-top:calc(var(--nav-height,56px) + 1.5rem)">

    <!-- Hero -->
    <div class="text-center mb-6">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-blue-100 border border-emerald-200 mb-3">
            <i data-lucide="scroll-text" class="w-8 h-8 text-emerald-600"></i>
        </div>
        <h1 class="text-2xl font-black">フィールドノート</h1>
        <p class="text-sm text-muted mt-1">自然からの呼びかけに応えよう</p>
    </div>

    <?php if (!$currentUser): ?>
    <!-- ログイン促進 -->
    <div class="bg-surface border border-border rounded-2xl p-6 text-center">
        <i data-lucide="lock" class="w-8 h-8 text-muted mx-auto mb-3"></i>
        <p class="text-sm text-muted mb-4">ログインするとクエストが解放されます</p>
        <a href="login.php?redirect=quests.php" class="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-6 py-3 text-sm transition">ログイン</a>
    </div>
    <?php else: ?>

    <!-- Active Quest Count -->
    <?php if ($totalActive > 0): ?>
    <div class="flex items-center justify-center gap-3 mb-6">
        <div class="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-2">
            <span class="text-emerald-700 text-lg font-black"><?= $totalActive ?></span>
            <span class="text-emerald-600 text-xs font-bold">件のクエストが待っています</span>
        </div>
    </div>
    <?php endif; ?>

    <!-- ===== スキャンクエスト（フィールドノート） ===== -->
    <?php if (!empty($scanQuests)): ?>
    <section class="mb-8">
        <div class="flex items-center gap-2 mb-4">
            <i data-lucide="notebook-pen" class="w-5 h-5 text-emerald-600"></i>
            <h2 class="text-base font-black">スキャンから生まれたクエスト</h2>
        </div>
        <div class="space-y-3">
            <?php foreach ($scanQuests as $sq):
                $trigger = $sq['trigger'] ?? 'new_species';
                $hoursLeft = max(0, (int)round((strtotime($sq['expires_at'] ?? 'now') - time()) / 3600));
                $badge = $badgeColors[$trigger] ?? $badgeColors['new_species'];
                $bg = $bgGradients[$trigger] ?? $bgGradients['new_species'];
                $sig = $significanceTexts[$trigger] ?? null;
                $cta = $sq['cta_text'] ?? '記録する';
            ?>
            <div class="bg-gradient-to-br <?= $bg ?> rounded-2xl p-5 border border-gray-200">
                <!-- Badge + TTL -->
                <div class="flex items-center justify-between mb-3">
                    <span class="text-[10px] font-bold px-2.5 py-1 rounded-md border <?= $badge ?>">
                        <?= htmlspecialchars($sq['rarity_label'] ?? $trigger, ENT_QUOTES, 'UTF-8') ?>
                    </span>
                    <span class="text-[10px] text-gray-500 flex items-center gap-1">
                        <i data-lucide="clock" class="w-3 h-3"></i>
                        残り<?= $hoursLeft ?>時間
                    </span>
                </div>

                <!-- Title -->
                <h3 class="text-base font-black text-gray-900 mb-2"><?= htmlspecialchars($sq['title'] ?? '', ENT_QUOTES, 'UTF-8') ?></h3>

                <!-- Progress Hint (Endowed Progress) -->
                <?php if (!empty($sq['progress_hint'])): ?>
                <div class="text-xs text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-2 mb-3">
                    <?= htmlspecialchars($sq['progress_hint'], ENT_QUOTES, 'UTF-8') ?>
                </div>
                <?php endif; ?>

                <!-- Description -->
                <p class="text-xs text-gray-600 leading-relaxed mb-3">
                    <?= htmlspecialchars($sq['description'] ?? '', ENT_QUOTES, 'UTF-8') ?>
                </p>

                <!-- Why this matters -->
                <?php if ($sig): ?>
                <details class="mb-4 group">
                    <summary class="text-[11px] text-blue-600 cursor-pointer hover:text-blue-700 transition flex items-center gap-1">
                        <i data-lucide="info" class="w-3 h-3"></i>
                        なぜこのクエストが重要？
                    </summary>
                    <div class="mt-2 text-[11px] text-gray-600 leading-relaxed bg-white/70 rounded-lg p-3 border border-gray-100">
                        <?= htmlspecialchars($sig['why'], ENT_QUOTES, 'UTF-8') ?>
                    </div>
                </details>
                <?php endif; ?>

                <!-- CTA -->
                <div class="flex items-center gap-3">
                    <a href="post.php?species=<?= urlencode($sq['species_name'] ?? '') ?>&from=scan_quest&quest_id=<?= urlencode($sq['id'] ?? '') ?><?= $trigger === 'id_challenge' ? '&family_hint=' . urlencode($sq['species_name'] ?? '') : '' ?>"
                       class="flex-1 text-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-3 text-sm transition">
                        <?= htmlspecialchars($cta, ENT_QUOTES, 'UTF-8') ?>
                    </a>
                    <span class="text-[10px] text-gray-400">+<?= (int)($sq['reward'] ?? 0) ?>pt</span>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
    </section>
    <?php endif; ?>

    <!-- ===== デイリークエスト ===== -->
    <section class="mb-8">
        <div class="flex items-center gap-2 mb-4">
            <i data-lucide="calendar-check" class="w-5 h-5 text-amber-600"></i>
            <h2 class="text-base font-black">今日のクエスト</h2>
            <span class="text-[10px] text-muted ml-auto">毎日更新</span>
        </div>
        <?php if (!empty($dailyQuests)): ?>
        <div class="space-y-3">
            <?php foreach ($dailyQuests as $quest):
                $progress = $dailyProgress[$quest['id'] ?? ''] ?? 0;
                $isDone = $progress >= 100;
            ?>
            <div class="bg-surface border border-border rounded-2xl p-4 <?= $isDone ? 'opacity-60' : '' ?>">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 <?= $isDone ? 'bg-emerald-500/20' : 'bg-amber-500/10 border border-amber-500/20' ?>">
                        <?php if ($isDone): ?>
                            <i data-lucide="check" class="w-5 h-5 text-emerald-400"></i>
                        <?php else: ?>
                            <i data-lucide="<?= htmlspecialchars($quest['icon'] ?? 'target', ENT_QUOTES, 'UTF-8') ?>" class="w-5 h-5 text-amber-500"></i>
                        <?php endif; ?>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-bold <?= $isDone ? 'line-through text-muted' : '' ?>"><?= htmlspecialchars($quest['title'] ?? '', ENT_QUOTES, 'UTF-8') ?></div>
                        <div class="text-xs text-muted mt-0.5"><?= htmlspecialchars($quest['description'] ?? '', ENT_QUOTES, 'UTF-8') ?></div>
                    </div>
                    <div class="text-right shrink-0">
                        <div class="text-[10px] text-amber-500 font-bold">+<?= (int)($quest['reward'] ?? 0) ?>pt</div>
                        <?php if (!$isDone && $progress > 0): ?>
                        <div class="text-[10px] text-muted"><?= $progress ?>%</div>
                        <?php endif; ?>
                    </div>
                </div>
                <?php if (!$isDone): ?>
                <div class="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-500 <?= $progress > 0 ? 'bg-amber-500' : 'bg-white/10' ?>" style="width:<?= $progress ?>%"></div>
                </div>
                <?php endif; ?>
            </div>
            <?php endforeach; ?>
        </div>
        <?php else: ?>
        <div class="text-center text-sm text-muted py-6">クエストを読み込めませんでした</div>
        <?php endif; ?>
    </section>

    <!-- ===== なぜクエストがあるの？ ===== -->
    <section class="mb-8">
        <div class="flex items-center gap-2 mb-4">
            <i data-lucide="lightbulb" class="w-5 h-5 text-blue-600"></i>
            <h2 class="text-base font-black">クエストの意味</h2>
        </div>
        <div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
            <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                    <i data-lucide="database" class="w-4 h-4 text-emerald-600"></i>
                </div>
                <div>
                    <div class="text-sm font-bold text-gray-900 mb-1">すべてが科学データになる</div>
                    <div class="text-xs text-gray-600 leading-relaxed">あなたの観察はCanonical Schema（100年耐久設計のデータベース）に蓄積されます。将来の研究者、行政、保全活動に活用される可能性があります。</div>
                </div>
            </div>
            <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                    <i data-lucide="puzzle" class="w-4 h-4 text-amber-600"></i>
                </div>
                <div>
                    <div class="text-sm font-bold text-gray-900 mb-1">AIとのバトンリレー</div>
                    <div class="text-xs text-gray-600 leading-relaxed">ライブスキャンでAIが「ここまで」判定したものを、あなたが写真や知識で完成させる。人間とAIの協働が、データの質を飛躍的に高めます。</div>
                </div>
            </div>
            <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                    <i data-lucide="heart" class="w-4 h-4 text-red-600"></i>
                </div>
                <div>
                    <div class="text-sm font-bold text-gray-900 mb-1">希少な記録ほど価値が高い</div>
                    <div class="text-xs text-gray-600 leading-relaxed">絶滅危惧種や地域初記録のクエストが優先的に出るのは、そのデータが科学的に最も求められているからです。あなたの1枚が保全の判断材料になります。</div>
                </div>
            </div>
        </div>
    </section>

    <!-- ===== スキャンへの導線 ===== -->
    <?php if (empty($scanQuests)): ?>
    <section class="mb-8">
        <div class="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl p-6 text-center border border-emerald-200">
            <div class="text-4xl mb-3">🌍</div>
            <h3 class="text-base font-black text-gray-900 mb-2">フィールドに出よう</h3>
            <p class="text-xs text-gray-600 mb-4">ライブスキャンで周囲を探索すると、<br>AIが見つけた発見からクエストが生まれます</p>
            <a href="field_scan.php" class="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-6 py-3 text-sm transition">
                📡 ライブスキャンを始める
            </a>
        </div>
    </section>
    <?php endif; ?>

    <?php endif; ?>

</main>

<script src="https://unpkg.com/lucide@0.344.0/dist/umd/lucide.min.js"></script>
<script nonce="<?= CspNonce::attr() ?>">lucide.createIcons();</script>
</body>
</html>
