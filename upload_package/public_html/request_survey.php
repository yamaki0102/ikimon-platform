<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/SurveyorManager.php';
require_once __DIR__ . '/../libs/SurveyRequestManager.php';

Auth::init();
$request = [
    'requester_name' => '',
    'contact' => '',
    'area' => '',
    'specialty' => '',
    'preferred_days' => [],
    'travel_condition' => '',
    'budget_stance' => '',
    'budget' => '',
    'schedule' => '',
    'notes' => '',
];
$errors = [];
$matchedSurveyors = [];
$createdRequest = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $request = SurveyRequestManager::normalizeInput($_POST);
    $errors = SurveyRequestManager::validate($request);
    $matchedSurveyors = SurveyorManager::matchSurveyors([
        'area' => $request['area'],
        'specialty' => $request['specialty'],
        'preferred_days' => $request['preferred_days'],
        'travel_condition' => $request['travel_condition'],
        'budget_stance' => $request['budget_stance'],
        'q' => $request['notes'],
    ], 5);
    if (empty($errors)) {
        $createdRequest = SurveyRequestManager::create($request);
    }
}

$meta_title = '調査を依頼する';
$meta_description = '地域、分類群、予算感を入力して、条件に近い認定調査員を見つけられます。';
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>
<body class="bg-base text-text font-body pt-14 pb-24 md:pb-0">
    <?php include __DIR__ . '/components/nav.php'; ?>
    <main class="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <header class="rounded-[2rem] border border-violet-200 bg-[linear-gradient(145deg,#faf5ff_0%,#ffffff_45%,#eef2ff_100%)] px-6 py-8">
            <span class="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-black text-violet-700 border border-violet-200">REQUEST MATCHING</span>
            <h1 class="text-3xl md:text-5xl font-black tracking-tight text-slate-900 mt-4">調査依頼を整理して、近い調査員を見つける</h1>
            <p class="text-sm text-slate-700 mt-4 max-w-3xl">地域、対象分類群、予算感を入力すると、公開プロフィールと公式記録をもとに近い調査員を提案します。連絡は各プロフィールの外部窓口から直接行ってください。</p>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 mt-6">
            <section class="rounded-3xl border border-border bg-surface p-6">
                <h2 class="text-xl font-black text-text">依頼条件</h2>
                <?php if (!empty($errors)): ?>
                    <div class="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        必須項目を入力してください: <?= htmlspecialchars(implode(', ', $errors)) ?>
                    </div>
                <?php elseif ($createdRequest): ?>
                    <div class="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        依頼内容を保存しました。候補の調査員に、プロフィール記載の外部連絡先から直接コンタクトしてください。
                    </div>
                <?php endif; ?>

                <form method="post" class="mt-5 space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" name="requester_name" value="<?= htmlspecialchars($request['requester_name']) ?>" placeholder="依頼者名" class="rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text">
                        <input type="text" name="contact" value="<?= htmlspecialchars($request['contact']) ?>" placeholder="連絡先メール or SNS" class="rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text">
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" name="area" value="<?= htmlspecialchars($request['area']) ?>" placeholder="調査地域" class="rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text">
                        <input type="text" name="specialty" value="<?= htmlspecialchars($request['specialty']) ?>" placeholder="対象分類群・調査内容" class="rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text">
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="rounded-2xl border border-border bg-base px-4 py-3">
                            <p class="text-[11px] font-black text-faint uppercase tracking-widest mb-2">希望曜日</p>
                            <div class="flex flex-wrap gap-2">
                                <?php foreach (['平日', '土曜', '日曜', '祝日'] as $day): ?>
                                    <label class="inline-flex items-center gap-2 text-sm text-text">
                                        <input type="checkbox" name="preferred_days[]" value="<?= htmlspecialchars($day) ?>" <?= in_array($day, $request['preferred_days'], true) ? 'checked' : '' ?>>
                                        <?= htmlspecialchars($day) ?>
                                    </label>
                                <?php endforeach; ?>
                            </div>
                        </div>
                        <div>
                            <select name="travel_condition" class="w-full rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text">
                                <option value="">移動条件を選択</option>
                                <?php foreach (['近隣のみ', '市内中心', '県内広域', '隣県まで', '全国対応'] as $option): ?>
                                    <option value="<?= htmlspecialchars($option) ?>" <?= $request['travel_condition'] === $option ? 'selected' : '' ?>>移動条件: <?= htmlspecialchars($option) ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div>
                            <select name="budget_stance" class="w-full rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text">
                                <option value="">予算スタンスを選択</option>
                                <?php foreach (['相談して決定', '半日相当', '1日相当', '報告書込み', '案件規模で見積もり'] as $option): ?>
                                    <option value="<?= htmlspecialchars($option) ?>" <?= $request['budget_stance'] === $option ? 'selected' : '' ?>>予算スタンス: <?= htmlspecialchars($option) ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" name="budget" value="<?= htmlspecialchars($request['budget']) ?>" placeholder="予算感（任意）" class="rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text">
                        <input type="text" name="schedule" value="<?= htmlspecialchars($request['schedule']) ?>" placeholder="希望時期（任意）" class="rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text">
                    </div>
                    <textarea name="notes" class="w-full h-40 rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text" placeholder="現場の背景、必要なアウトプット、対象地点の特徴など"><?= htmlspecialchars($request['notes']) ?></textarea>
                    <button type="submit" class="rounded-2xl bg-violet-600 px-6 py-3 text-sm font-black text-white hover:bg-violet-700">候補を出す</button>
                </form>
            </section>

            <aside class="space-y-4">
                <div class="rounded-3xl border border-border bg-surface p-6">
                    <div class="flex items-center justify-between gap-3">
                        <h2 class="text-xl font-black text-text">候補の調査員</h2>
                        <span class="text-xs text-muted"><?= count($matchedSurveyors) ?>名</span>
                    </div>
                    <div class="mt-4 space-y-3">
                        <?php foreach ($matchedSurveyors as $surveyor): ?>
                            <article class="rounded-2xl border border-border bg-base p-4">
                                <div class="flex items-start gap-3">
                                    <img src="<?= htmlspecialchars($surveyor['avatar']) ?>" alt="<?= htmlspecialchars($surveyor['name']) ?>のアバター" class="w-12 h-12 rounded-2xl object-cover border border-border">
                                    <div class="min-w-0 flex-1">
                                        <div class="flex items-center gap-2">
                                            <p class="font-black text-text"><?= htmlspecialchars($surveyor['name']) ?></p>
                                            <span class="text-[10px] text-violet-700 bg-violet-50 border border-violet-100 rounded-full px-2 py-0.5">match <?= (int)$surveyor['match_score'] ?></span>
                                        </div>
                                        <p class="text-xs text-muted mt-1"><?= htmlspecialchars($surveyor['headline'] ?: '認定調査員') ?></p>
                                        <?php if (!empty($surveyor['match_reasons'])): ?>
                                            <p class="text-[11px] text-slate-500 mt-1"><?= htmlspecialchars(implode(' / ', array_slice($surveyor['match_reasons'], 0, 3))) ?></p>
                                        <?php endif; ?>
                                        <p class="text-xs text-muted mt-2"><?= htmlspecialchars(implode(' / ', array_slice($surveyor['areas'], 0, 3))) ?></p>
                                        <p class="text-xs text-muted mt-1">
                                            <?= htmlspecialchars($surveyor['price_band'] ?: '要相談') ?>
                                            <?php if (!empty($surveyor['available_days'])): ?> · <?= htmlspecialchars(implode(' / ', $surveyor['available_days'])) ?><?php endif; ?>
                                            <?php if (!empty($surveyor['travel_range'])): ?> · <?= htmlspecialchars($surveyor['travel_range']) ?><?php endif; ?>
                                        </p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-3 mt-3">
                                    <a href="surveyor_profile.php?id=<?= urlencode($surveyor['id']) ?>" class="text-sm font-black text-violet-700 hover:text-violet-800">プロフィール</a>
                                    <?php if ($surveyor['contact_url'] !== ''): ?>
                                        <a href="<?= htmlspecialchars($surveyor['contact_url']) ?>" target="_blank" rel="noopener noreferrer" class="text-sm font-black text-emerald-700 hover:text-emerald-800">外部連絡</a>
                                    <?php endif; ?>
                                </div>
                            </article>
                        <?php endforeach; ?>

                        <?php if (empty($matchedSurveyors)): ?>
                            <div class="rounded-2xl bg-base px-4 py-6 text-sm text-muted">
                                条件を入れると、地域と得意分野が近い調査員をここに提案します。
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            </aside>
        </div>
    </main>
    <?php include __DIR__ . '/components/footer.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">lucide.createIcons();</script>
</body>
</html>
