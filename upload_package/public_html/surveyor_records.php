<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/SurveyorManager.php';

Auth::init();
$filters = [
    'q' => (string)($_GET['q'] ?? ''),
    'area' => (string)($_GET['area'] ?? ''),
    'specialty' => (string)($_GET['specialty'] ?? ''),
    'limit' => 100,
];
$records = SurveyorManager::listOfficialRecords($filters);
$meta_title = '調査員公式記録';
$meta_description = '調査員が残した公式記録だけを一覧で確認できます。地域や分類群の検索にも対応。';
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>
<body class="bg-base text-text font-body pt-14 pb-24 md:pb-0">
    <?php include __DIR__ . '/components/nav.php'; ?>
    <main class="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <header class="rounded-[2rem] border border-emerald-200 bg-[linear-gradient(145deg,#ecfdf5_0%,#ffffff_40%,#f0fdf4_100%)] px-6 py-8">
            <span class="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-black text-emerald-700 border border-emerald-200">OFFICIAL RECORDS</span>
            <h1 class="text-3xl md:text-5xl font-black tracking-tight text-slate-900 mt-4">調査員公式記録を探す</h1>
            <p class="text-sm text-slate-700 mt-4 max-w-3xl">調査員が現地確認のもとで残した公式記録だけを一覧化。自治体や団体が「誰が、どこで、どんな記録を残しているか」を実績ベースで見つけられます。</p>
        </header>

        <form method="get" class="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
            <input type="text" name="q" value="<?= htmlspecialchars($filters['q']) ?>" placeholder="種名・メモ・調査員名" class="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text">
            <input type="text" name="area" value="<?= htmlspecialchars($filters['area']) ?>" placeholder="地域" class="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text">
            <input type="text" name="specialty" value="<?= htmlspecialchars($filters['specialty']) ?>" placeholder="分類群・得意分野" class="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text">
            <button type="submit" class="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700">検索する</button>
        </form>

        <div class="mt-4 flex items-center justify-between gap-4">
            <p class="text-sm text-muted"><?= number_format(count($records)) ?>件</p>
            <a href="request_survey.php" class="text-sm font-black text-emerald-700 hover:text-emerald-800">調査を依頼する →</a>
        </div>

        <div class="mt-6 space-y-4">
            <?php foreach ($records as $record): ?>
                <article class="rounded-3xl border border-border bg-surface p-5">
                    <div class="flex flex-col lg:flex-row gap-4">
                        <div class="lg:w-80">
                            <?php if (!empty($record['photos'][0])): ?>
                                <img src="<?= htmlspecialchars($record['photos'][0]) ?>" alt="<?= htmlspecialchars($record['taxon_name']) ?>の写真" class="w-full h-52 object-cover rounded-2xl border border-border">
                            <?php else: ?>
                                <div class="w-full h-52 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold">写真なし公式記録</div>
                            <?php endif; ?>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700 border border-emerald-200">調査員公式記録</span>
                                <span class="text-xs text-muted"><?= htmlspecialchars($record['prefecture'] . ' ' . $record['municipality']) ?></span>
                            </div>
                            <h2 class="text-2xl font-black text-text mt-3"><?= htmlspecialchars($record['taxon_name']) ?></h2>
                            <p class="text-xs text-muted mt-2"><?= htmlspecialchars(date('Y.m.d H:i', strtotime($record['observed_at'] ?: $record['created_at']))) ?></p>
                            <p class="text-sm text-muted leading-relaxed mt-4"><?= nl2br(htmlspecialchars($record['note'] !== '' ? $record['note'] : 'メモは未入力です。')) ?></p>

                            <div class="mt-4 flex items-center gap-3 rounded-2xl bg-base px-4 py-3">
                                <img src="<?= htmlspecialchars($record['surveyor']['avatar']) ?>" alt="<?= htmlspecialchars($record['surveyor']['name']) ?>のアバター" class="w-12 h-12 rounded-2xl object-cover border border-border">
                                <div class="min-w-0">
                                    <p class="font-black text-text"><?= htmlspecialchars($record['surveyor']['name']) ?></p>
                                    <p class="text-xs text-muted"><?= htmlspecialchars($record['surveyor']['headline'] ?: '認定調査員') ?></p>
                                </div>
                                <a href="surveyor_profile.php?id=<?= urlencode($record['surveyor']['id']) ?>" class="ml-auto text-sm font-black text-emerald-700 hover:text-emerald-800">プロフィール</a>
                            </div>
                        </div>
                    </div>
                </article>
            <?php endforeach; ?>

            <?php if (empty($records)): ?>
                <div class="rounded-3xl border border-border bg-surface px-6 py-12 text-center">
                    <p class="text-lg font-black text-text">条件に合う公式記録はまだありません</p>
                    <p class="text-sm text-muted mt-2">地域や分類群を変えるか、直接依頼フォームから相談してください。</p>
                </div>
            <?php endif; ?>
        </div>
    </main>
    <?php include __DIR__ . '/components/footer.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">lucide.createIcons();</script>
</body>
</html>
