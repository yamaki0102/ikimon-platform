<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/SurveyorManager.php';

Auth::init();
$id = (string)($_GET['id'] ?? '');
$surveyor = $id !== '' ? SurveyorManager::findPublicSurveyorById($id) : null;

if (!$surveyor) {
    http_response_code(404);
    echo 'Surveyor not found';
    exit;
}

$meta_title = $surveyor['name'] . ' | 調査員プロフィール';
$meta_description = $surveyor['headline'] ?: ($surveyor['summary'] ?: 'ikimon.life の認定調査員プロフィールです。');
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>
<body class="font-body pt-14 pb-24 md:pb-0" style="background:var(--md-surface);color:var(--md-on-surface);">
    <?php include __DIR__ . '/components/nav.php'; ?>

    <main class="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <a href="surveyors.php" class="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-text">
            <i data-lucide="arrow-left" class="w-4 h-4"></i>
            調査員一覧へ戻る
        </a>

        <section class="mt-4 rounded-[2rem] border border-sky-200 bg-[linear-gradient(145deg,#eff6ff_0%,#ffffff_45%,#ecfeff_100%)] p-6 md:p-8">
            <div class="flex flex-col md:flex-row gap-6 md:items-start">
                <img src="<?= htmlspecialchars($surveyor['avatar']) ?>" alt="<?= htmlspecialchars($surveyor['name']) ?>のアバター" class="w-28 h-28 rounded-[2rem] object-cover border border-white shadow-lg">
                <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <h1 class="text-3xl md:text-4xl font-black tracking-tight text-slate-900"><?= htmlspecialchars($surveyor['name']) ?></h1>
                        <span class="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-[11px] font-black text-sky-700 border border-sky-200">認定調査員</span>
                    </div>
                    <?php if ($surveyor['headline'] !== ''): ?>
                        <p class="text-lg font-bold text-slate-700 mt-3"><?= htmlspecialchars($surveyor['headline']) ?></p>
                    <?php endif; ?>
                    <p class="text-sm text-slate-700 leading-relaxed mt-4"><?= nl2br(htmlspecialchars($surveyor['summary'] ?: $surveyor['bio'] ?: 'プロフィール準備中です。')) ?></p>

                    <div class="grid grid-cols-3 gap-3 mt-6">
                        <div class="rounded-2xl bg-white/90 border border-sky-100 px-4 py-4 text-center">
                            <div class="text-2xl font-black text-sky-700"><?= number_format($surveyor['official_record_count']) ?></div>
                            <div class="text-[11px] text-muted mt-1">公式記録</div>
                        </div>
                        <div class="rounded-2xl bg-white/90 border border-sky-100 px-4 py-4 text-center">
                            <div class="text-2xl font-black text-emerald-700"><?= number_format($surveyor['species_count']) ?></div>
                            <div class="text-[11px] text-muted mt-1">確認種</div>
                        </div>
                        <div class="rounded-2xl bg-white/90 border border-sky-100 px-4 py-4 text-center">
                            <div class="text-2xl font-black text-slate-800"><?= number_format($surveyor['observation_count']) ?></div>
                            <div class="text-[11px] text-muted mt-1">総記録</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mt-6">
            <section class="space-y-6">
                <?php if (!empty($surveyor['specialties'])): ?>
                    <div class="rounded-3xl border border-border bg-surface p-5">
                        <h2 class="text-lg font-black text-text">得意分野</h2>
                        <div class="flex flex-wrap gap-2 mt-4">
                            <?php foreach ($surveyor['specialties'] as $specialty): ?>
                                <span class="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary"><?= htmlspecialchars($specialty) ?></span>
                            <?php endforeach; ?>
                        </div>
                    </div>
                <?php endif; ?>

                <?php if ($surveyor['price_band'] !== '' || !empty($surveyor['available_days']) || $surveyor['travel_range'] !== ''): ?>
                    <div class="rounded-3xl border border-border bg-surface p-5">
                        <h2 class="text-lg font-black text-text">受託条件の目安</h2>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                            <div class="rounded-2xl bg-base px-4 py-4 border border-border">
                                <div class="text-[11px] font-black text-faint uppercase tracking-widest">対応単価帯</div>
                                <div class="text-sm font-bold text-text mt-2"><?= htmlspecialchars($surveyor['price_band'] ?: '要相談') ?></div>
                            </div>
                            <div class="rounded-2xl bg-base px-4 py-4 border border-border">
                                <div class="text-[11px] font-black text-faint uppercase tracking-widest">対応可能曜日</div>
                                <div class="text-sm font-bold text-text mt-2"><?= htmlspecialchars(!empty($surveyor['available_days']) ? implode(' / ', $surveyor['available_days']) : '要相談') ?></div>
                            </div>
                            <div class="rounded-2xl bg-base px-4 py-4 border border-border">
                                <div class="text-[11px] font-black text-faint uppercase tracking-widest">現地移動可能範囲</div>
                                <div class="text-sm font-bold text-text mt-2"><?= htmlspecialchars($surveyor['travel_range'] ?: '要相談') ?></div>
                            </div>
                        </div>
                    </div>
                <?php endif; ?>

                <?php if (!empty($surveyor['areas'])): ?>
                    <div class="rounded-3xl border border-border bg-surface p-5">
                        <h2 class="text-lg font-black text-text">主な活動地域</h2>
                        <div class="flex flex-wrap gap-2 mt-4">
                            <?php foreach ($surveyor['areas'] as $area): ?>
                                <span class="rounded-full bg-sky-50 px-3 py-1.5 text-sm font-bold text-sky-700 border border-sky-100"><?= htmlspecialchars($area) ?></span>
                            <?php endforeach; ?>
                        </div>
                    </div>
                <?php endif; ?>

                <?php if ($surveyor['achievements'] !== ''): ?>
                    <div class="rounded-3xl border border-border bg-surface p-5">
                        <h2 class="text-lg font-black text-text">経歴・実績</h2>
                        <p class="text-sm text-muted leading-relaxed mt-4"><?= nl2br(htmlspecialchars($surveyor['achievements'])) ?></p>
                    </div>
                <?php endif; ?>
            </section>

            <aside class="space-y-4">
                <div class="rounded-3xl border border-border bg-surface p-5">
                    <h2 class="text-lg font-black text-text">コンタクト</h2>
                    <p class="text-xs text-muted leading-relaxed mt-3">連絡はサイト外で行ってください。返信可否や条件は各調査員の案内に従ってください。</p>
                    <?php if ($surveyor['contact_url'] !== ''): ?>
                        <a href="<?= htmlspecialchars($surveyor['contact_url']) ?>" target="_blank" rel="noopener noreferrer" class="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-black text-white hover:bg-sky-700">
                            <i data-lucide="send" class="w-4 h-4"></i>
                            <?= htmlspecialchars($surveyor['contact_label'] ?: '外部で連絡する') ?>
                        </a>
                    <?php else: ?>
                        <div class="mt-4 rounded-2xl bg-base px-4 py-4 text-sm text-muted">連絡先はプロフィール未設定です。</div>
                    <?php endif; ?>
                    <?php if ($surveyor['contact_notes'] !== ''): ?>
                        <p class="text-xs text-muted mt-3 leading-relaxed"><?= nl2br(htmlspecialchars($surveyor['contact_notes'])) ?></p>
                    <?php endif; ?>
                    <?php if ($surveyor['availability'] !== ''): ?>
                        <p class="text-xs text-slate-700 mt-3 font-bold">対応目安: <?= htmlspecialchars($surveyor['availability']) ?></p>
                    <?php endif; ?>
                </div>

                <div class="rounded-3xl border border-amber-200 bg-amber-50 p-5" x-data="surveyorReport()">
                    <h2 class="text-lg font-black text-amber-900">気になる点を通報</h2>
                    <p class="text-xs text-amber-900/70 mt-2 leading-relaxed">プロフィール内容に大きな問題がある場合だけ送ってください。運営が確認します。</p>
                    <div class="mt-4 space-y-3">
                        <select x-model="reason" class="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-text">
                            <option value="misleading">経歴・内容が不正確に見える</option>
                            <option value="abuse">不適切・攻撃的</option>
                            <option value="privacy">個人情報の懸念</option>
                            <option value="other">その他</option>
                        </select>
                        <textarea x-model="details" class="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-text h-24" placeholder="補足があれば"></textarea>
                        <button type="button" @click="submit" class="w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white hover:bg-amber-600">通報する</button>
                        <p x-show="message" class="text-xs font-bold" :class="success ? 'text-emerald-700' : 'text-red-600'" x-text="message"></p>
                    </div>
                </div>
            </aside>
        </div>
    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        function surveyorReport() {
            return {
                reason: 'misleading',
                details: '',
                message: '',
                success: false,
                async submit() {
                    const token = (document.cookie.match(/ikimon_csrf=([a-f0-9]+)/) || [])[1] || '';
                    try {
                        const res = await fetch('api/report_surveyor.php?csrf_token=' + token, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                surveyor_id: <?= json_encode($surveyor['id'], JSON_HEX_TAG) ?>,
                                reason: this.reason,
                                details: this.details
                            })
                        });
                        const data = await res.json();
                        this.success = !!data.success;
                        this.message = data.message || (data.success ? '送信しました。' : '送信に失敗しました。');
                        if (data.success) {
                            this.details = '';
                        }
                    } catch (e) {
                        this.success = false;
                        this.message = '送信に失敗しました。';
                    }
                }
            };
        }
        lucide.createIcons();
    </script>
</body>
</html>
