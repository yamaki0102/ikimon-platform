<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Lang.php';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
Lang::init();

$documentLang = method_exists('Lang', 'current') ? Lang::current() : 'ja';
$privacyText = [
    'meta_title' => __('privacy_page.meta_title', 'Privacy Policy — ikimon.life'),
    'meta_description' => __('privacy_page.meta_description', 'ikimon.life privacy policy: how we handle location data, photo data, and personal information.'),
    'title' => __('privacy_page.title', '🔒 Privacy Policy'),
    'updated_at' => __('privacy_page.updated_at', 'Last updated: March 11, 2026'),
    'section_1_title' => __('privacy_page.section_1_title', '1. Information We Collect'),
    'section_1_intro' => __('privacy_page.section_1_intro', 'Our service collects the following information.'),
    'section_1_sub_1' => __('privacy_page.section_1_sub_1', '1.1 Account Information'),
    'section_1_sub_2' => __('privacy_page.section_1_sub_2', '1.2 Observation Data'),
    'section_1_sub_3' => __('privacy_page.section_1_sub_3', '1.3 Usage Data'),
    'section_2_title' => __('privacy_page.section_2_title', '2. Purpose of Use'),
    'section_3_title' => __('privacy_page.section_3_title', '3. Handling of Location Information'),
    'section_3_badge' => __('privacy_page.section_3_badge', '🛡️ Protection of Endangered-Species Locations'),
    'section_3_subtext' => __('privacy_page.section_3_subtext', 'Species listed on the Ministry of Environment and prefectural red lists have their location data'),
    'section_4_title' => __('privacy_page.section_4_title', '4. Handling of EXIF Data'),
    'section_4_intro_1' => __('privacy_page.section_4_intro_1', 'EXIF data in photos (capture date, GPS coordinates, camera model, etc.) is used to validate records. EXIF GPS coordinates and posted locations are compared for consistency checks.'),
    'section_4_intro_2' => __('privacy_page.section_4_intro_2', 'EXIF GPS information is removed from publicly shared photos.'),
    'section_5_title' => __('privacy_page.section_5_title', '5. Sharing with Third Parties'),
    'section_5_intro' => __('privacy_page.section_5_intro', 'Collected data may be shared only in the following cases.'),
    'section_5_note' => __('privacy_page.section_5_note', 'Data with CC BY-NC license is not shared with GBIF.'),
    'section_6_title' => __('privacy_page.section_6_title', '6. Data Retention'),
    'section_6_desc_1' => __('privacy_page.section_6_desc_1', 'Observation data is stored on servers in Japan throughout service operation. To delete your account, contact contact@ikimon.life.'),
    'section_6_desc_2' => __('privacy_page.section_6_desc_2', 'Data already shared to external databases such as GBIF is handled through third-party institutions, so complete deletion may not be guaranteed.'),
    'section_7_title' => __('privacy_page.section_7_title', '7. Cookie Use'),
    'section_7_intro' => __('privacy_page.section_7_intro', 'We use the following cookies for session management and CSRF protection.'),
    'section_7_note' => __('privacy_page.section_7_note', 'We do not use advertising or tracking cookies.'),
    'section_8_title' => __('privacy_page.section_8_title', '8. Contact'),
    'section_8_intro' => __('privacy_page.section_8_intro', 'For privacy-related inquiries, contact us at the address below.'),
    'related_title_1' => __('privacy_page.related_title_1', '📜 Terms of Service'),
    'related_title_2' => __('privacy_page.related_title_2', '❓ FAQ'),
    'related_title_3' => __('privacy_page.related_title_3', '💰 Pricing Plan'),
];
?>
<!DOCTYPE html>
<html lang="<?= htmlspecialchars($documentLang, ENT_QUOTES, 'UTF-8') ?>">

<head>
    <?php
    $meta_title = $privacyText['meta_title'];
    $meta_description = $privacyText['meta_description'];
    include __DIR__ . '/components/meta.php';
    ?>
</head>

<body class="font-body" style="background:var(--md-surface);color:var(--md-on-surface);">
    <?php include __DIR__ . '/components/nav.php'; ?>

    <main class="max-w-3xl mx-auto px-4 pt-24 pb-20 md:pt-28">

        <h1 class="text-2xl md:text-3xl font-black tracking-tight text-text mb-2"><?php echo $privacyText['title']; ?></h1>
        <p class="text-xs text-muted mb-8"><?php echo $privacyText['updated_at']; ?></p>

        <div class="space-y-8 text-sm text-text leading-relaxed">

            <section>
                <h2 class="text-lg font-black text-text mb-3"><?php echo $privacyText['section_1_title']; ?></h2>
                <p><?php echo $privacyText['section_1_intro']; ?></p>

                <h3 class="font-bold text-text mt-4 mb-2"><?php echo $privacyText['section_1_sub_1']; ?></h3>
                <ul class="list-disc list-inside space-y-1 text-muted">
                    <li>Google アカウント名、メールアドレス、プロフィール画像（Google認証利用時）</li>
                    <li>ゲストユーザーの場合は一時的な識別子のみ</li>
                </ul>

                <h3 class="font-bold text-text mt-4 mb-2"><?php echo $privacyText['section_1_sub_2']; ?></h3>
                <ul class="list-disc list-inside space-y-1 text-muted">
                    <li>写真（EXIF データを含む場合があります）</li>
                    <li>GPS 座標（緯度・経度）</li>
                    <li>観察日時</li>
                    <li>メモ・コメント</li>
                    <li>選択されたライセンス種別</li>
                </ul>

                <h3 class="font-bold text-text mt-4 mb-2"><?php echo $privacyText['section_1_sub_3']; ?></h3>
                <ul class="list-disc list-inside space-y-1 text-muted">
                    <li>アクセスログ（IPアドレス、ブラウザ情報、アクセス日時）</li>
                    <li>API リクエストログ（有料プラン利用者）</li>
                </ul>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3"><?php echo $privacyText['section_2_title']; ?></h2>
                <ul class="list-disc list-inside space-y-1 text-muted">
                    <li>サービスの提供・運営・改善</li>
                    <li>コミュニティによる生物同定の支援</li>
                    <li>観察データの公共的な共有（GBIF 等への連携準備を含む）</li>
                    <li>不正利用の防止・セキュリティの確保</li>
                    <li>利用状況の分析・統計の作成</li>
                </ul>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3"><?php echo $privacyText['section_3_title']; ?></h2>
                <div class="bg-secondary/5 border border-secondary/20 rounded-2xl p-5 mb-3">
                    <p class="font-bold text-text mb-2"><?php echo $privacyText['section_3_badge']; ?></p>
                    <p class="text-muted"><?php echo $privacyText['section_3_subtext']; ?><strong class="text-text">自動的にランダム化</strong>（半径10km圏内）されます。これは密猟防止のための措置であり、ユーザーが解除することはできません。</p>
                </div>
                <p>通常の観察記録の位置情報は、投稿者が選択したライセンスに基づき公開されます。位置情報を共有したくない場合は、投稿前に手動で位置を調整してください。</p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3"><?php echo $privacyText['section_4_title']; ?></h2>
                <p><?php echo $privacyText['section_4_intro_1']; ?></p>
                <p class="mt-2"><?php echo $privacyText['section_4_intro_2']; ?></p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3"><?php echo $privacyText['section_5_title']; ?></h2>
                <p><?php echo $privacyText['section_5_intro']; ?></p>
                <ul class="list-disc list-inside space-y-1 text-muted mt-2">
                    <li><strong class="text-text">GBIF への共有</strong>: 共有対象となる場合は、CC0 または CC BY ライセンスで、研究利用可または種レベル研究用に整理されたデータのみ</li>
                    <li><strong class="text-text">API 経由の提供</strong>: 有料プラン契約者に対し、投稿者が選択したライセンスの範囲内で</li>
                    <li><strong class="text-text">法的要請</strong>: 法令に基づく開示要請があった場合</li>
                </ul>
                <p class="mt-2"><strong><?php echo $privacyText['section_5_note']; ?></strong></p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3"><?php echo $privacyText['section_6_title']; ?></h2>
                <p><?php echo $privacyText['section_6_desc_1']; ?></p>
                <p class="mt-2"><?php echo $privacyText['section_6_desc_2']; ?></p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3"><?php echo $privacyText['section_7_title']; ?></h2>
                <p><?php echo $privacyText['section_7_intro']; ?></p>
                <ul class="list-disc list-inside space-y-1 text-muted mt-2">
                    <li><code class="bg-surface px-1.5 py-0.5 rounded text-xs">PHPSESSID</code> — セッション管理</li>
                    <li><code class="bg-surface px-1.5 py-0.5 rounded text-xs">ikimon_csrf</code> — CSRF トークン（セキュリティ）</li>
                    <li><code class="bg-surface px-1.5 py-0.5 rounded text-xs">ikimon_guest_id</code> — ゲストユーザー識別</li>
                </ul>
                <p class="mt-2"><?php echo $privacyText['section_7_note']; ?></p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3"><?php echo $privacyText['section_8_title']; ?></h2>
                <p><?php echo $privacyText['section_8_intro']; ?></p>
                <div class="bg-surface border border-border rounded-2xl p-4 mt-3">
                    <p class="font-bold text-text">ikimon.life 運営事務局</p>
                    <p class="text-muted mt-1">📧 <a href="mailto:contact@ikimon.life" class="text-primary underline">contact@ikimon.life</a></p>
                </div>
            </section>

        </div>

        <!-- Related Links -->
        <div class="flex flex-wrap gap-3 mt-10 pt-6 border-t border-border">
            <a href="terms.php" class="text-xs font-bold text-primary hover:underline"><?php echo $privacyText['related_title_1']; ?></a>
            <a href="faq.php" class="text-xs font-bold text-primary hover:underline"><?php echo $privacyText['related_title_2']; ?></a>
            <a href="for-business/#pricing" class="text-xs font-bold text-primary hover:underline"><?php echo $privacyText['related_title_3']; ?></a>
            </div>

    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>

</html>
