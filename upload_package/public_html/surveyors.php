<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/SurveyorManager.php';

Auth::init();
$surveyors = SurveyorManager::listPublicSurveyors();
$meta_title = '調査員を探す';
$meta_description = 'ikimon.life で承認された調査員の一覧です。得意分野や活動地域を見て、外部SNSやメールから直接コンタクトできます。';
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>
<body class="font-body pt-14 pb-24 md:pb-0" style="background:var(--md-surface);color:var(--md-on-surface);">
    <?php include __DIR__ . '/components/nav.php'; ?>

    <main class="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <section class="rounded-[2rem] border border-sky-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ecfeff_100%)] px-6 py-8 md:px-8 md:py-10">
            <div class="max-w-3xl">
                <span class="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-black text-sky-700 border border-sky-200">SURVEYORS NETWORK</span>
                <h1 class="text-3xl md:text-5xl font-black tracking-tight text-slate-900 mt-4">調査できる人と、調査してほしい現場をつなぐ</h1>
                <p class="text-sm md:text-base text-slate-700 leading-relaxed mt-4">
                    面談や経歴確認を経て承認された調査員だけを公開しています。連絡は各プロフィールにある外部SNSやメールから直接行ってください。
                </p>
            </div>
        </section>

        <section class="mt-8">
            <div class="flex items-end justify-between gap-4 mb-4">
                <div>
                    <h2 class="text-xl font-black text-text">公開中の調査員</h2>
                    <p class="text-sm text-muted"><?= number_format(count($surveyors)) ?>名</p>
                </div>
                <div class="flex items-center gap-3">
                    <a href="surveyor_records.php" class="text-sm font-black text-sky-700 hover:text-sky-800">公式記録を見る</a>
                    <a href="request_survey.php" class="text-sm font-black text-emerald-700 hover:text-emerald-800">調査を依頼する</a>
                </div>
            </div>

            <?php if (empty($surveyors)): ?>
                <div class="rounded-3xl border border-border bg-surface px-6 py-12 text-center">
                    <p class="text-lg font-black text-text">公開中の調査員はまだいません</p>
                    <p class="text-sm text-muted mt-2">承認された調査員が増えたら、ここに一覧表示されます。</p>
                </div>
            <?php else: ?>
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    <?php foreach ($surveyors as $surveyor): ?>
                        <article class="rounded-3xl border border-border bg-surface p-5 shadow-sm">
                            <div class="flex items-start gap-4">
                                <img src="<?= htmlspecialchars($surveyor['avatar']) ?>" alt="<?= htmlspecialchars($surveyor['name']) ?>のアバター" class="w-16 h-16 rounded-2xl object-cover border border-border">
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <h3 class="text-lg font-black text-text"><?= htmlspecialchars($surveyor['name']) ?></h3>
                                        <span class="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-black text-sky-700 border border-sky-200">認定調査員</span>
                                    </div>
                                    <?php if ($surveyor['headline'] !== ''): ?>
                                        <p class="text-sm font-bold text-slate-700 mt-1"><?= htmlspecialchars($surveyor['headline']) ?></p>
                                    <?php endif; ?>
                                    <p class="text-xs text-muted mt-2 line-clamp-3"><?= htmlspecialchars($surveyor['summary'] ?: $surveyor['bio'] ?: '現地の生きものを丁寧に記録する調査員です。') ?></p>
                                </div>
                            </div>

                            <div class="grid grid-cols-3 gap-2 mt-4">
                                <div class="rounded-2xl bg-base px-3 py-3 text-center">
                                    <div class="text-lg font-black text-sky-700"><?= number_format($surveyor['official_record_count']) ?></div>
                                    <div class="text-[10px] text-muted">公式記録</div>
                                </div>
                                <div class="rounded-2xl bg-base px-3 py-3 text-center">
                                    <div class="text-lg font-black text-emerald-700"><?= number_format($surveyor['species_count']) ?></div>
                                    <div class="text-[10px] text-muted">確認種</div>
                                </div>
                                <div class="rounded-2xl bg-base px-3 py-3 text-center">
                                    <div class="text-lg font-black text-slate-800"><?= number_format($surveyor['observation_count']) ?></div>
                                    <div class="text-[10px] text-muted">総記録</div>
                                </div>
                            </div>

                            <?php if (!empty($surveyor['specialties'])): ?>
                                <div class="flex flex-wrap gap-2 mt-4">
                                    <?php foreach (array_slice($surveyor['specialties'], 0, 4) as $specialty): ?>
                                        <span class="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary"><?= htmlspecialchars($specialty) ?></span>
                                    <?php endforeach; ?>
                                </div>
                            <?php endif; ?>

                            <?php if (!empty($surveyor['areas'])): ?>
                                <p class="text-xs text-muted mt-4">主な地域: <?= htmlspecialchars(implode(' / ', array_slice($surveyor['areas'], 0, 3))) ?></p>
                            <?php endif; ?>
                            <?php if ($surveyor['price_band'] !== '' || $surveyor['travel_range'] !== ''): ?>
                                <div class="mt-3 text-xs text-muted space-y-1">
                                    <?php if ($surveyor['price_band'] !== ''): ?><p>単価帯: <?= htmlspecialchars($surveyor['price_band']) ?></p><?php endif; ?>
                                    <?php if ($surveyor['travel_range'] !== ''): ?><p>移動範囲: <?= htmlspecialchars($surveyor['travel_range']) ?></p><?php endif; ?>
                                </div>
                            <?php endif; ?>

                            <a href="surveyor_profile.php?id=<?= urlencode($surveyor['id']) ?>" class="mt-4 inline-flex items-center gap-2 text-sm font-black text-sky-700 hover:text-sky-800">
                                プロフィールを見る
                                <i data-lucide="arrow-right" class="w-4 h-4"></i>
                            </a>
                        </article>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </section>
    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">lucide.createIcons();</script>
</body>
</html>
