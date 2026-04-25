<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/Lang.php';
Auth::init();
Lang::init();

$documentLang = method_exists('Lang', 'current') ? Lang::current() : 'ja';

$termsText = [
    'title' => __('terms_page.title', 'Terms of Service — ikimon.life'),
    'meta_title' => __('terms_page.meta_title', 'Terms of Service — ikimon.life'),
    'meta_description' => __('terms_page.meta_description', 'Terms of Service for ikimon.life. Covers service use conditions, data handling, and Creative Commons licensing.'),
    'updated_at' => __('terms_page.updated_at', 'Last updated: March 11, 2026'),
    'section_1_title' => __('terms_page.section_1_title', 'Article 1 (Scope)'),
    'section_1_body' => __('terms_page.section_1_body', 'These Terms of Service (the "Terms") define the conditions for using ikimon.life (the "Service"). By using the Service, users are deemed to have agreed to these Terms.'),
    'section_2_title' => __('terms_page.section_2_title', 'Article 2 (Service Description)'),
    'section_2_intro' => __('terms_page.section_2_intro', 'This Service is a citizen-participation biodiversity observation platform. Users can post wildlife observation records and participate in the community identification process.'),
    'section_2_items' => [
        __('terms_page.section_2_item_1', 'Post and view biological observation records'),
        __('terms_page.section_2_item_2', 'Community species identification'),
        __('terms_page.section_2_item_3', 'Use field maps, field guides, and rankings'),
        __('terms_page.section_2_item_4', 'API and bulk exports (paid plan)'),
    ],
    'section_3_title' => __('terms_page.section_3_title', 'Article 3 (Accounts)'),
    'section_3_body' => __('terms_page.section_3_body', 'Users may use the Service via Google authentication or guest mode. Users are responsible for managing their own account information.'),
    'section_4_title' => __('terms_page.section_4_title', 'Article 4 (Posted Data and Licensing)'),
    'section_4_badge_title' => __('terms_page.section_4_badge_title', '📋 Important: Creative Commons licensing'),
    'section_4_badge_subtitle' => __('terms_page.section_4_badge_subtitle', 'Observation data posted by users is governed by the Creative Commons license selected at submission.'),
    'section_4_items' => [
        __('terms_page.section_4_item_1', 'CC0 Public Domain — rights waived; anyone may use it freely'),
        __('terms_page.section_4_item_2', 'CC BY Attribution — anyone may use it with credit (recommended)'),
        __('terms_page.section_4_item_3', 'CC BY-NC Attribution-NonCommercial — use permitted only for non-commercial purposes'),
    ],
    'section_4_body' => __('terms_page.section_4_body', 'The selected license cannot be changed after posting. Data posted under CC0 or CC BY may be shared internationally through GBIF (the Global Biodiversity Information Facility). CC BY-NC data is not shared with GBIF.'),
    'section_5_title' => __('terms_page.section_5_title', 'Article 5 (Prohibited Acts)'),
    'section_5_items' => [
        __('terms_page.section_5_item_1', 'Posting false observation data'),
        __('terms_page.section_5_item_2', 'Posting other people’s works (photos, etc.) without permission'),
        __('terms_page.section_5_item_3', 'Intentionally publishing information that identifies endangered species habitats'),
        __('terms_page.section_5_item_4', 'Interfering with the operation of the Service'),
        __('terms_page.section_5_item_5', 'Misusing the API (e.g. bypassing rate limits)'),
        __('terms_page.section_5_item_6', 'Encouraging poaching or illegal collecting'),
    ],
    'section_6_title' => __('terms_page.section_6_title', 'Article 6 (Paid Plans)'),
    'section_6_body_1' => __('terms_page.section_6_body_1', 'Some features of the Service (such as API access, DwC-A export, and summary exports for sharing) are available only on paid plans. Pricing is listed on the <a href="for-business/#pricing" class="text-primary underline">pricing page</a>.'),
    'section_6_body_2' => __('terms_page.section_6_body_2', 'Cancellations for paid plans are handled by email. You may continue using the Service until the end of the cancellation month.'),
    'section_7_title' => __('terms_page.section_7_title', 'Article 7 (Protection of Endangered Species)'),
    'section_7_body' => __('terms_page.section_7_body', 'Location information for species listed on the Ministry of Environment Red List and prefectural Red Lists is automatically randomized (within a 10 km radius) to prevent poaching.'),
    'section_8_title' => __('terms_page.section_8_title', 'Article 8 (Disclaimer)'),
    'section_8_body' => __('terms_page.section_8_body', 'The Service is provided "as is". The operator does not guarantee the accuracy of community identification results. If you use the Service for external materials or research, we recommend expert verification based on your purpose.'),
    'section_9_title' => __('terms_page.section_9_title', 'Article 9 (Changes to the Terms)'),
    'section_9_body' => __('terms_page.section_9_body', 'The operator may change these Terms when deemed necessary. Important changes will be announced in advance through postings on this page and notifications to the registered email address. The revised Terms take effect when posted on this page.'),
    'section_10_title' => __('terms_page.section_10_title', 'Article 10 (Governing Law and Jurisdiction)'),
    'section_10_body' => __('terms_page.section_10_body', 'These Terms are governed by Japanese law, and any dispute relating to the Service shall be subject to the exclusive jurisdiction of the Shizuoka District Court as the court of first instance.'),
    'commerce_title' => __('terms_page.commerce_title', 'Commercial Transaction Act Notice'),
    'commerce_rows' => [
        ['label' => __('terms_page.commerce_seller_label', 'Seller'), 'value' => __('terms_page.commerce_seller', 'ikimon.life Operations Office')],
        ['label' => __('terms_page.commerce_address_label', 'Address'), 'value' => __('terms_page.commerce_address', 'Disclosed upon inquiry')],
        ['label' => __('terms_page.commerce_contact_label', 'Contact'), 'value' => __('terms_page.commerce_contact', 'contact@ikimon.life')],
        ['label' => __('terms_page.commerce_price_label', 'Price'), 'value' => __('terms_page.commerce_price', 'Listed on the <a href="for-business/#pricing" class="text-primary underline">pricing page</a>')],
        ['label' => __('terms_page.commerce_payment_label', 'Payment method'), 'value' => __('terms_page.commerce_payment', 'Bank transfer (invoice payment)')],
        ['label' => __('terms_page.commerce_delivery_label', 'Delivery timing'), 'value' => __('terms_page.commerce_delivery', 'Account activation within the same day to 3 business days after payment is confirmed')],
        ['label' => __('terms_page.commerce_cancellation_label', 'Returns / cancellation'), 'value' => __('terms_page.commerce_cancellation', 'Cancellation allowed at month end. You may continue using the Service through the cancellation month. No refunds in principle')],
        ['label' => __('terms_page.commerce_environment_label', 'Operating environment'), 'value' => __('terms_page.commerce_environment', 'Latest Chrome, Safari, Firefox, and Edge. Internet connection required')],
    ],
];
?>
<!DOCTYPE html>
<html lang="<?= htmlspecialchars($documentLang, ENT_QUOTES, 'UTF-8') ?>">

<head>
    <?php
    $meta_title = $termsText['meta_title'];
    $meta_description = $termsText['meta_description'];
    include __DIR__ . '/components/meta.php';
    ?>
</head>

<body class="font-body" style="background:var(--md-surface);color:var(--md-on-surface);">
    <?php include __DIR__ . '/components/nav.php'; ?>

    <main class="max-w-3xl mx-auto px-4 pt-24 pb-20 md:pt-28">

        <h1 class="text-2xl md:text-3xl font-black tracking-tight text-text mb-2">📜 <?= htmlspecialchars($termsText['title']) ?></h1>
        <p class="text-xs text-muted mb-8"><?= htmlspecialchars($termsText['updated_at']) ?></p>

        <div class="space-y-8 text-sm text-text leading-relaxed">

            <section>
                <h2 class="text-lg font-black text-text mb-3"><?= htmlspecialchars($termsText['section_1_title']) ?></h2>
                <p><?= nl2br(htmlspecialchars($termsText['section_1_body']), false) ?></p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3"><?= htmlspecialchars($termsText['section_2_title']) ?></h2>
                <p><?= nl2br(htmlspecialchars($termsText['section_2_intro']), false) ?></p>
                <ul class="list-disc list-inside mt-2 space-y-1 text-muted">
                    <?php foreach ($termsText['section_2_items'] as $item): ?>
                        <li><?= htmlspecialchars($item) ?></li>
                    <?php endforeach; ?>
                </ul>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3"><?= htmlspecialchars($termsText['section_3_title']) ?></h2>
                <p><?= nl2br(htmlspecialchars($termsText['section_3_body']), false) ?></p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3"><?= htmlspecialchars($termsText['section_4_title']) ?></h2>
                <div class="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-3">
                    <p class="font-bold text-text mb-2"><?= htmlspecialchars($termsText['section_4_badge_title']) ?></p>
                    <p class="text-muted"><?= htmlspecialchars($termsText['section_4_badge_subtitle']) ?></p>
                    <ul class="mt-3 space-y-2">
                        <?php foreach ($termsText['section_4_items'] as $item): ?>
                            <li class="flex items-start gap-2"><span><?= htmlspecialchars($item) ?></span></li>
                        <?php endforeach; ?>
                    </ul>
                </div>
                <p><?= nl2br(htmlspecialchars($termsText['section_4_body']), false) ?></p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3"><?= htmlspecialchars($termsText['section_5_title']) ?></h2>
                <ul class="list-disc list-inside space-y-1 text-muted">
                    <?php foreach ($termsText['section_5_items'] as $item): ?>
                        <li><?= htmlspecialchars($item) ?></li>
                    <?php endforeach; ?>
                </ul>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3"><?= htmlspecialchars($termsText['section_6_title']) ?></h2>
                <p><?= nl2br(htmlspecialchars($termsText['section_6_body_1']), false) ?></p>
                <p class="mt-2"><?= nl2br(htmlspecialchars($termsText['section_6_body_2']), false) ?></p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3"><?= htmlspecialchars($termsText['section_7_title']) ?></h2>
                <p><?= nl2br(htmlspecialchars($termsText['section_7_body']), false) ?></p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3"><?= htmlspecialchars($termsText['section_8_title']) ?></h2>
                <p><?= nl2br(htmlspecialchars($termsText['section_8_body']), false) ?></p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3"><?= htmlspecialchars($termsText['section_9_title']) ?></h2>
                <p><?= nl2br(htmlspecialchars($termsText['section_9_body']), false) ?></p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3"><?= htmlspecialchars($termsText['section_10_title']) ?></h2>
                <p><?= nl2br(htmlspecialchars($termsText['section_10_body']), false) ?></p>
            </section>

            <section class="border-t border-border pt-8">
                <h2 class="text-lg font-black text-text mb-3"><?= htmlspecialchars($termsText['commerce_title']) ?></h2>
                <div class="bg-surface border border-border rounded-2xl overflow-hidden">
                    <table class="w-full text-sm">
                        <tbody>
                            <?php foreach ($termsText['commerce_rows'] as $row): ?>
                                <tr class="border-b border-border">
                                    <td class="px-4 py-3 font-bold text-muted bg-surface w-1/3"><?= htmlspecialchars($row['label']) ?></td>
                                    <td class="px-4 py-3"><?= $row['value'] ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </section>

        </div>

    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>

</html>
