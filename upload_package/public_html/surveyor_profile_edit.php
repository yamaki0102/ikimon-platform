<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/SurveyorManager.php';

Auth::init();
$user = Auth::user();
if (!$user) {
    header('Location: login.php?redirect=surveyor_profile_edit.php');
    exit;
}
if (!SurveyorManager::isApproved($user)) {
    http_response_code(403);
    echo 'Surveyor access required';
    exit;
}

$profile = SurveyorManager::getProfile($user);
$meta_title = '調査員プロフィール編集';
$meta_description = '調査員として公開するプロフィール情報を編集します。';
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>
<body class="bg-base text-text font-body pt-14 pb-24 md:pb-0">
    <?php include __DIR__ . '/components/nav.php'; ?>

    <main class="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12" x-data="surveyorEditor()">
        <a href="profile.php" class="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-text">
            <i data-lucide="arrow-left" class="w-4 h-4"></i>
            マイプロフィールへ戻る
        </a>

        <header class="mt-4">
            <h1 class="text-3xl font-black tracking-tight text-text">調査員プロフィール編集</h1>
            <p class="text-sm text-muted mt-2">依頼を受けるための公開情報だけを整えます。連絡は外部SNSやメールへのリンクで行います。</p>
        </header>

        <form @submit.prevent="submit" class="mt-6 space-y-5">
            <div class="rounded-3xl border border-border bg-surface p-5">
                <label class="block text-xs font-black text-faint uppercase tracking-widest">肩書き</label>
                <input type="text" x-model="form.headline" maxlength="80" class="mt-2 w-full rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text" placeholder="例: 両生類・湿地調査 / 里山モニタリング">
            </div>

            <div class="rounded-3xl border border-border bg-surface p-5">
                <label class="block text-xs font-black text-faint uppercase tracking-widest">紹介文</label>
                <textarea x-model="form.summary" maxlength="1200" class="mt-2 w-full rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text h-40" placeholder="どういう調査ができるか、どんな現場が得意か"></textarea>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div class="rounded-3xl border border-border bg-surface p-5">
                    <label class="block text-xs font-black text-faint uppercase tracking-widest">主な地域</label>
                    <textarea x-model="form.areas_text" class="mt-2 w-full rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text h-28" placeholder="静岡西部, 浜松市, 天竜川流域"></textarea>
                </div>
                <div class="rounded-3xl border border-border bg-surface p-5">
                    <label class="block text-xs font-black text-faint uppercase tracking-widest">得意分野</label>
                    <textarea x-model="form.specialties_text" class="mt-2 w-full rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text h-28" placeholder="鳥類, 両生類, 夜間調査, 外来種確認"></textarea>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div class="rounded-3xl border border-border bg-surface p-5">
                    <label class="block text-xs font-black text-faint uppercase tracking-widest">対応単価帯</label>
                    <select x-model="form.price_band" class="mt-2 w-full rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text">
                        <option value="">未設定</option>
                        <option value="相談して決定">相談して決定</option>
                        <option value="半日相当">半日相当</option>
                        <option value="1日相当">1日相当</option>
                        <option value="報告書込み">報告書込み</option>
                        <option value="案件規模で見積もり">案件規模で見積もり</option>
                    </select>
                    <p class="text-[11px] text-muted mt-2">安売り競争を避けるため、公開は参考帯に留めます。</p>
                </div>
                <div class="rounded-3xl border border-border bg-surface p-5">
                    <label class="block text-xs font-black text-faint uppercase tracking-widest">対応可能曜日</label>
                    <textarea x-model="form.available_days_text" class="mt-2 w-full rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text h-24" placeholder="平日, 土曜, 日祝"></textarea>
                </div>
                <div class="rounded-3xl border border-border bg-surface p-5">
                    <label class="block text-xs font-black text-faint uppercase tracking-widest">現地移動可能範囲</label>
                    <select x-model="form.travel_range" class="mt-2 w-full rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text">
                        <option value="">未設定</option>
                        <option value="近隣のみ">近隣のみ</option>
                        <option value="市内中心">市内中心</option>
                        <option value="県内広域">県内広域</option>
                        <option value="隣県まで">隣県まで</option>
                        <option value="全国対応">全国対応</option>
                    </select>
                </div>
            </div>

            <div class="rounded-3xl border border-border bg-surface p-5 space-y-4">
                <div>
                    <label class="block text-xs font-black text-faint uppercase tracking-widest">外部連絡ラベル</label>
                    <input type="text" x-model="form.contact_label" maxlength="40" class="mt-2 w-full rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text" placeholder="例: メールで連絡 / Xで相談">
                </div>
                <div>
                    <label class="block text-xs font-black text-faint uppercase tracking-widest">外部連絡URL</label>
                    <input type="text" x-model="form.contact_url" maxlength="255" class="mt-2 w-full rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text" placeholder="https://... または mailto:...">
                </div>
                <div>
                    <label class="block text-xs font-black text-faint uppercase tracking-widest">連絡時の注意</label>
                    <textarea x-model="form.contact_notes" maxlength="200" class="mt-2 w-full rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text h-24" placeholder="返信目安、対応可能範囲など"></textarea>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div class="rounded-3xl border border-border bg-surface p-5">
                    <label class="block text-xs font-black text-faint uppercase tracking-widest">経歴・実績</label>
                    <textarea x-model="form.achievements" maxlength="500" class="mt-2 w-full rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text h-32" placeholder="調査経験、保有資格、関わったプロジェクトなど"></textarea>
                </div>
                <div class="rounded-3xl border border-border bg-surface p-5">
                    <label class="block text-xs font-black text-faint uppercase tracking-widest">対応目安</label>
                    <input type="text" x-model="form.availability" maxlength="120" class="mt-2 w-full rounded-2xl border border-border bg-base px-4 py-3 text-sm text-text" placeholder="例: 週末中心 / 平日夜に一次返信">
                    <label class="mt-4 inline-flex items-center gap-2 text-sm font-bold text-text">
                        <input type="checkbox" x-model="form.public_visible" class="rounded border-border">
                        公開一覧に表示する
                    </label>
                </div>
            </div>

            <div class="flex items-center gap-3">
                <button type="submit" class="rounded-2xl bg-sky-600 px-6 py-3 text-sm font-black text-white hover:bg-sky-700" :disabled="saving">
                    <span x-text="saving ? '保存中...' : '保存する'"></span>
                </button>
                <a href="surveyor_profile.php?id=<?= urlencode($user['id']) ?>" class="text-sm font-bold text-muted hover:text-text">公開ページを見る</a>
            </div>
            <p x-show="message" class="text-sm font-bold" :class="success ? 'text-emerald-700' : 'text-red-600'" x-text="message"></p>
        </form>
    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        function surveyorEditor() {
            return {
                saving: false,
                success: false,
                message: '',
                form: {
                    headline: <?= json_encode($profile['headline'], JSON_HEX_TAG | JSON_UNESCAPED_UNICODE) ?>,
                    summary: <?= json_encode($profile['summary'], JSON_HEX_TAG | JSON_UNESCAPED_UNICODE) ?>,
                    areas_text: <?= json_encode(implode(', ', $profile['areas']), JSON_HEX_TAG | JSON_UNESCAPED_UNICODE) ?>,
                    specialties_text: <?= json_encode(implode(', ', $profile['specialties']), JSON_HEX_TAG | JSON_UNESCAPED_UNICODE) ?>,
                    price_band: <?= json_encode($profile['price_band'], JSON_HEX_TAG | JSON_UNESCAPED_UNICODE) ?>,
                    available_days_text: <?= json_encode(implode(', ', $profile['available_days']), JSON_HEX_TAG | JSON_UNESCAPED_UNICODE) ?>,
                    travel_range: <?= json_encode($profile['travel_range'], JSON_HEX_TAG | JSON_UNESCAPED_UNICODE) ?>,
                    contact_label: <?= json_encode($profile['contact_label'], JSON_HEX_TAG | JSON_UNESCAPED_UNICODE) ?>,
                    contact_url: <?= json_encode($profile['contact_url'], JSON_HEX_TAG | JSON_UNESCAPED_UNICODE) ?>,
                    contact_notes: <?= json_encode($profile['contact_notes'], JSON_HEX_TAG | JSON_UNESCAPED_UNICODE) ?>,
                    achievements: <?= json_encode($profile['achievements'], JSON_HEX_TAG | JSON_UNESCAPED_UNICODE) ?>,
                    availability: <?= json_encode($profile['availability'], JSON_HEX_TAG | JSON_UNESCAPED_UNICODE) ?>,
                    public_visible: <?= $profile['public_visible'] ? 'true' : 'false' ?>
                },
                async submit() {
                    this.saving = true;
                    this.message = '';
                    const token = (document.cookie.match(/ikimon_csrf=([a-f0-9]+)/) || [])[1] || '';
                    try {
                        const res = await fetch('api/update_surveyor_profile.php?csrf_token=' + token, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(this.form)
                        });
                        const data = await res.json();
                        this.success = !!data.success;
                        this.message = data.message || (data.success ? '保存しました。' : '保存に失敗しました。');
                    } catch (e) {
                        this.success = false;
                        this.message = '保存に失敗しました。';
                    } finally {
                        this.saving = false;
                    }
                }
            };
        }
        lucide.createIcons();
    </script>
</body>
</html>
