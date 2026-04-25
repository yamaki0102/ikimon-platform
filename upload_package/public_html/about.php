<?php
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CspNonce.php';
require_once __DIR__ . '/../libs/BrandMessaging.php';
require_once __DIR__ . '/../libs/Lang.php';
Auth::init();
Lang::init();
CspNonce::sendHeader();

$isLoggedIn = Auth::isLoggedIn();
$ctaHref = $isLoggedIn ? 'post.php' : 'login.php?redirect=post.php';
$documentLang = method_exists('Lang', 'current') ? Lang::current() : 'ja';
$ctaLabel = $isLoggedIn
    ? __('about_page.cta_primary_logged_in', 'Start observing')
    : __('about_page.cta_primary_logged_out', 'Start free');

$meta_title = __('about_page.meta_title', 'Why ikimon exists — Nature connects children and towns | ikimon');
$regionalMessaging = BrandMessaging::regionalRevitalization();
$supportPlans = [
    $regionalMessaging['free_plan'],
    $regionalMessaging['community_plan'],
    $regionalMessaging['public_plan'],
];
$meta_description = __('about_page.meta_description', $regionalMessaging['about_meta_description']);
$signatureName = $documentLang === 'ja' ? '八巻 毅' : 'Tsuyoshi Yamaki';
$signatureTitle = $documentLang === 'ja' ? 'IKIMON株式会社 代表' : 'Founder, IKIMON Co., Ltd.';
$contactLocation = $documentLang === 'ja' ? '静岡県浜松市' : 'Hamamatsu, Shizuoka';
$aboutText = [
    'hero_title' => __('about_page.hero_title', 'Nature connects children and towns.'),
    'hero_sub' => __('about_page.hero_sub', 'The regional revitalization model ikimon.life is aiming for'),
    'toc_label' => __('about_page.toc_label', 'Contents'),
    'toc_origin' => __('about_page.toc_origin', 'Origin story'),
    'toc_regional' => __('about_page.toc_regional', 'Why regional revitalization'),
    'toc_disappearing' => __('about_page.toc_disappearing', 'At-risk municipalities'),
    'toc_sustainability' => __('about_page.toc_sustainability', 'A sustainable model'),
    'origin_title' => __('about_page.origin_title', 'Origin story'),
    'origin_resolution_title' => __('about_page.origin_resolution_title', 'When a place becomes clearer, attachment grows'),
    'regional_title' => __('about_page.regional_title', 'Why regional revitalization'),
    'regional_adults_title' => __('about_page.regional_adults_title', 'It is not only about children. Adults need to feel alive too.'),
    'disappearing_title' => __('about_page.disappearing_title', $regionalMessaging['disappearing_section_heading']),
    'sustainability_title' => __('about_page.sustainability_title', 'A sustainable model'),
    'cta_heading' => __('about_page.cta_heading', 'Want to connect nature and your town together?'),
    'cta_secondary' => __('about_page.cta_secondary', 'For companies and municipalities'),
    'more_label' => __('about_page.more_label', 'Learn more'),
    'guide_brain_title' => __('about_page.guide_brain_title', 'What happens to the brain when you walk in nature?'),
    'guide_brain_desc' => __('about_page.guide_brain_desc', 'The science behind walking and observing living things'),
    'guide_steps_title' => __('about_page.guide_steps_title', '9,800 steps a day and lower dementia risk'),
    'guide_steps_desc' => __('about_page.guide_steps_desc', 'A plain-language introduction to the large JAMA Neurology study'),
    'guide_nature_positive_title' => __('about_page.guide_nature_positive_title', 'Nature Positive complete guide'),
    'guide_nature_positive_desc' => __('about_page.guide_nature_positive_desc', 'The full picture of walking, observing, and health'),
    'guide_archive_title' => __('about_page.guide_archive_title', '100-year ecosystem archive'),
    'guide_archive_desc' => __('about_page.guide_archive_desc', 'Why keeping records matters, and how observations in 2026 become a baseline for the future'),
    'guide_methodology_title' => __('about_page.guide_methodology_title', 'Data policy and evaluation methods'),
    'guide_methodology_desc' => __('about_page.guide_methodology_desc', 'How data is handled and how monitoring reference indices are interpreted'),
    'origin_lead' => __('about_page.origin_lead', 'Turning over the stepping stones at my childhood home, I found a roach under the stone. That was my first encounter with making biodiversity a memory that stays.'),
    'origin_intro_paragraphs' => [
        __('about_page.origin_intro_1', "Hokkaido, Iwanai-cho was my first hometown.\nI lived there from kindergarten through first grade of elementary school."),
        __('about_page.origin_intro_2', "There was the sea, there were mountains, and there was a river. And in front of the house, there was a garden that felt like a jungle to me back then."),
        __('about_page.origin_intro_3', "I flipped the paving stones by the entrance and caught the roach. I tried raising it and observed it every day. In autumn, I also went to the ski slopes and caught more than ten grasshoppers.\nThose were my happiest days."),
        __('about_page.origin_intro_4', "But I have no photos from that time. I sometimes think the attachment would have grown even more if those moments had been recorded."),
        __('about_page.origin_insight_1', "Without those stepping stones, I would never have met the roach. Without a maintained ski area, I would not have that grasshopper memory either."),
        __('about_page.origin_insight_2', "Untouched nature is valuable, of course.\nBut it is often managed places—front-yard flagstones, mowed ski runs, maintained satoyama—where children get their first encounters with living things."),
    ],
    'origin_resolution_paragraphs' => [
        __('about_page.origin_resolution_1', "On the streets I walk every day, have you noticed what kinds of street trees stand there? Can you tell the difference between a white-tailed eagle and a hawfinch?"),
        __('about_page.origin_resolution_2', "You don't have to know to live your life. But once you do, the same path looks a little different."),
        __('about_page.origin_resolution_3', "Knowing a name. Noticing seasonal changes. That raises the resolution of the place you live in."),
        __('about_page.origin_resolution_accent_1', "When resolution rises, attachment is born.\nWhen attachment rises, you start caring for that place."),
        __('about_page.origin_resolution_4', "ikimon.life wants to create that trigger:\nfind it, record it, review it.\nThat alone gradually changes our relationship with place."),
    ],
    'origin_final' => __('about_page.origin_final', "I don't want us to lose the bonds between children and nature."),
    'regional_intro_paragraphs' => [
        __('about_page.regional_intro_1', "Regional revitalization is not something one person can do alone.\nI don't think it can be achieved by ikimon.life alone either."),
        __('about_page.regional_intro_2', "But when adults in the community—parents, teachers, neighbors—create chances to walk in nature with children, I believe change begins."),
        __('about_page.regional_intro_3', "Walking in nature connects heart and body health.\nLearning about local nature through observation builds attachment.\nThat can become the energy that keeps a place alive."),
        __('about_page.regional_intro_4', "ikimon.life wants to be a tool for that loop.\nAnd it is meant to be used by everyone who lives in the place."),
        __('about_page.regional_intro_5', "This is not just a gut feeling. Multiple national studies keep saying the same thing."),
    ],
    'regional_insight_1_title' => __('about_page.regional_insight_1_title', 'Place attachment is discussed as a combination of nature and human connection.'),
    'regional_insight_1_body' => __('about_page.regional_insight_1_body', 'In a survey of junior high students in Choshi City, the top reason for liking their hometown was “rich nature” (72.8%), followed by “kind and friendly local people” (58.3%).\nIn a Hamamatsu youth survey, 81.8% answered that they like Hamamatsu, with interpersonal ties and natural environment as major attractions.'),
    'regional_insight_2_title' => __('about_page.regional_insight_2_title', 'Children say they want to return because they feel:\n“rich nature,” “kind people,” and “the place where they were born.”'),
    'regional_insight_2_body' => __('about_page.regional_insight_2_body', 'In a survey in Iijima Town, the most frequent reason for wanting to live there was “abundant nature and good air” (45.5%).\nEven among those who were “somewhat likely to return,” “liveable nature” was the top answer (62.5%), followed by “people’s kindness and local ties” (12.5%).'),
    'regional_insight_3_title' => __('about_page.regional_insight_3_title', 'A trustworthy adult outside the family gives children a sense of safety.'),
    'regional_insight_3_body' => __('about_page.regional_insight_3_body', 'In a survey in Joetsu City, 55.18% of children reported having a reliable adult, and 51.71% reported having an adult who takes care of them.\nNatural observation settings naturally create such connections with adults beyond family.'),
    'regional_adult_intro_paragraphs' => [
        __('about_page.regional_adult_intro_1', "When speaking about regional revitalization, discussions often become “how to bring back young people” or “how to increase births.”\nBut if the adults who live there cannot stay mentally and physically healthy, there will be no room to watch over children, and no base to support the place."),
        __('about_page.regional_adult_intro_2', "There is also scientific evidence that walking in nature is effective."),
    ],
    'regional_adult_insight_brain_title' => __('about_page.regional_adult_insight_brain_title', 'Walking in natural environments activates the prefrontal cortex.'),
    'regional_adult_insight_brain_body' => __('about_page.regional_adult_insight_brain_body', 'Compared with urban environments, walking outdoors reduces stress hormones and supports recovery of attention and creativity.\nObserving living things requires active attention, which strengthens cognitive engagement.'),
    'regional_adult_insight_steps_title' => __('about_page.regional_adult_insight_steps_title', 'Taking 9,800 steps a day is associated with 51% lower dementia risk.'),
    'regional_adult_insight_steps_body' => __('about_page.regional_adult_insight_steps_body', 'A large JAMA Neurology study (78,430 participants) found this.\nWalking requires no special tools and is one of the simplest healthy habits.\nAdding observation adds curiosity and a sense of achievement beyond walking alone.'),
    'regional_adult_tail_1' => __('about_page.regional_adult_tail_1', "If adults are healthy, relaxed, and cheerful,\nchildren can go outside with confidence.\nWhen children walk, adults also move more naturally and feel lighter."),
    'regional_adult_tail_2' => __('about_page.regional_adult_tail_2', "Natural observation creates this cycle without special interventions:\nchildren’s curiosity, adult health, and intergenerational connection."),
    'regional_adult_tail_3' => __('about_page.regional_adult_tail_3', "Natural observation is not the whole answer to regional revitalization,\nbut it can surely help."),
    'disappearing_intro_paragraphs' => [
        __('about_page.disappearing_intro_1', "In April 2024, the Population Strategy Council report made many people rethink what population decline can mean for communities."),
        __('about_page.disappearing_intro_2', "{$regionalMessaging['disappearing_population_copy']}\n{$regionalMessaging['disappearing_count_copy']}\n{$regionalMessaging['disappearing_ratio_copy']}"),
    ],
    'disappearing_stat_label_1' => __('about_page.disappearing_stat_label_1', 'At-risk municipalities'),
    'disappearing_stat_label_2' => __('about_page.disappearing_stat_label_2', 'Total municipalities'),
    'disappearing_severity_intro' => __('about_page.disappearing_severity_intro', 'Some regions are especially severe.'),
    'disappearing_region_examples' => [
        ['region' => __('about_page.disappearing_region_minamimaki', 'Minamimaki Village, Gunma'), 'rate' => '-88.0%'],
        ['region' => __('about_page.disappearing_region_sotogahama', 'Sotogahama Town, Aomori'), 'rate' => '-87.5%'],
        ['region' => __('about_page.disappearing_region_uoshinai', 'Uoshinai City, Hokkaido'), 'rate' => '-86.7%'],
        ['region' => __('about_page.disappearing_region_akita', 'Akita Prefecture (whole)'), 'rate' => '96% at risk'],
        ['region' => __('about_page.disappearing_region_aomori', 'Aomori Prefecture (whole)'), 'rate' => '87.5% at risk'],
    ],
    'disappearing_memory_1' => __('about_page.disappearing_memory_1', "Behind the numbers is somebody's hometown.\nWild places I played in as a child. The stream along my route to school. The ski run in autumn.\nThese are places where I learned to meet living things."),
    'disappearing_memory_2' => __('about_page.disappearing_memory_2', "If a municipality disappears, places where those memories and these encounters were born also disappear."),
    'disappearing_support' => __('about_page.disappearing_support', "{$regionalMessaging['priority_lead']}\n{$regionalMessaging['eligibility_copy']}\nIn the most severe regions, we provide all ikimon.life functions for free."),
    'disappearing_tail_1' => __('about_page.disappearing_tail_1', "I don't believe everything will change overnight.\nBut if even one child in a community comes to say \"I like this place\" through a small trigger from nature, that is enough."),
    'disappearing_tail_2' => __('about_page.disappearing_tail_2', "I want to preserve the memory of growing up here for the next generation."),
    'sustainability_paragraphs' => [
        __('about_page.sustainability_1', "IKIMON Co., Ltd. is a startup led by me alone.\nSmall organizations can move quickly."),
        __('about_page.sustainability_2', "If revenue from Public plans for companies and large municipalities is secured,\nit can sustain the company enough to keep running.\nSo we can provide free access to places with the strongest need."),
    ],
    'sustainability_highlight' => __('about_page.sustainability_highlight', "Because we are small, we can reach the places we want to reach."),
    'sustainability_tail_1' => __('about_page.sustainability_tail_1', "This project has just started.\nStep by step, we continue to grow."),
    'sustainability_tail_2' => __('about_page.sustainability_tail_2', 'Thank you for your support.'),
    'stat_label_1' => __('about_page.stat_label_1', 'shizuoka, Hamamatsu'),
];
$formatMultiline = static function (string $text): string {
    $normalized = str_replace(["\\n", "\r\n", "\r"], "\n", $text);
    return nl2br(htmlspecialchars($normalized, ENT_QUOTES, 'UTF-8'));
};
?>
<!DOCTYPE html>
<html lang="<?= htmlspecialchars($documentLang, ENT_QUOTES, 'UTF-8') ?>">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;600&display=swap" rel="stylesheet">
    <style nonce="<?= CspNonce::attr() ?>">
        /* ── msg: about.php page-scoped styles ── */

        .msg-hero {
            background: linear-gradient(135deg, #0a0f0a 0%, #0f1a12 50%, #0a0f0a 100%);
            color: #e5e7eb;
            padding: 72px 20px 56px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .msg-hero::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -30%;
            width: 80%;
            height: 200%;
            background: radial-gradient(ellipse, rgba(16, 185, 129, 0.06) 0%, transparent 70%);
            pointer-events: none;
        }
        .msg-hero h1 {
            font-family: 'Shippori Mincho', serif;
            font-size: clamp(1.75rem, 4vw, 3rem);
            font-weight: 600;
            letter-spacing: 0.05em;
            line-height: 1.5;
            color: #ffffff;
            margin-bottom: 16px;
            position: relative;
        }
        .msg-hero .msg-hero-sub {
            font-size: clamp(0.875rem, 1.5vw, 1.0625rem);
            color: rgba(255, 255, 255, 0.55);
            letter-spacing: 0.04em;
            margin-bottom: 0;
        }

        /* signature block */
        .msg-signature {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-top: 40px;
            padding-top: 32px;
            border-top: 1px solid var(--md-outline-variant);
        }
        .msg-signature-photo {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            object-fit: cover;
            flex-shrink: 0;
            border: 2px solid rgba(16, 185, 129, 0.3);
        }
        .msg-signature-name {
            font-weight: 700;
            color: var(--md-on-surface);
            font-size: 1rem;
        }
        .msg-signature-title {
            font-size: 0.8125rem;
            color: var(--md-on-surface-variant);
            margin-top: 2px;
        }

        /* ── editorial sections ── */
        .msg-section {
            padding: 64px 20px;
        }
        .msg-section-inner {
            max-width: 680px;
            margin: 0 auto;
        }
        .msg-surface {
            background: var(--md-surface-container);
        }
        .msg-section h2 {
            font-family: 'Shippori Mincho', serif;
            font-size: clamp(1.25rem, 2.5vw, 1.625rem);
            font-weight: 600;
            color: var(--md-on-surface);
            margin-bottom: 32px;
            letter-spacing: 0.03em;
            line-height: 1.5;
        }

        /* lead blockquote */
        .msg-lead {
            border-left: 3px solid var(--md-primary);
            padding-left: 20px;
            font-family: 'Shippori Mincho', serif;
            font-size: clamp(1.0625rem, 2vw, 1.25rem);
            color: var(--md-on-surface);
            line-height: 1.8;
            margin-bottom: 40px;
        }

        /* body text */
        .msg-body p {
            font-size: 1rem;
            line-height: 2.0;
            color: var(--md-on-surface-variant);
            margin-bottom: 20px;
        }
        .msg-body p strong {
            color: var(--md-on-surface);
        }

        /* green accent line */
        .msg-accent {
            color: var(--md-primary);
            font-weight: 600;
            font-size: 1.0625rem;
            line-height: 1.8;
            margin: 28px 0;
        }

        /* large accent (section closer) */
        .msg-accent-lg {
            color: var(--md-primary);
            font-family: 'Shippori Mincho', serif;
            font-weight: 600;
            font-size: clamp(1.125rem, 2vw, 1.375rem);
            line-height: 1.6;
            text-align: center;
            margin: 48px 0 0;
            padding: 32px 0;
            border-top: 1px solid var(--md-outline-variant);
        }

        /* insight blocks */
        .msg-insight {
            display: flex;
            gap: 16px;
            margin: 28px 0;
            align-items: flex-start;
        }
        .msg-insight-num {
            font-family: 'Shippori Mincho', serif;
            font-size: 2rem;
            font-weight: 700;
            color: var(--md-primary);
            line-height: 1;
            flex-shrink: 0;
            margin-top: 2px;
        }
        .msg-insight-body {
            flex: 1;
        }
        .msg-insight-text {
            font-size: 1rem;
            font-weight: 600;
            color: var(--md-on-surface);
            line-height: 1.6;
            margin-bottom: 8px;
        }
        .msg-cite {
            font-size: 0.8125rem;
            color: var(--md-on-surface-variant);
            line-height: 1.6;
        }

        /* stat hero */
        .msg-stat-hero {
            text-align: center;
            padding: 40px 0;
            margin: 32px 0;
            border-top: 1px solid var(--md-outline-variant);
            border-bottom: 1px solid var(--md-outline-variant);
        }
        .msg-stat-row {
            display: flex;
            justify-content: center;
            align-items: baseline;
            gap: 12px;
        }
        .msg-stat-number {
            font-family: 'Montserrat', sans-serif;
            font-size: clamp(2.5rem, 6vw, 3.5rem);
            font-weight: 900;
            color: var(--md-on-surface);
            letter-spacing: -0.02em;
            line-height: 1;
        }
        .msg-stat-slash {
            font-size: clamp(1.5rem, 3vw, 2rem);
            color: var(--md-on-surface-variant);
            font-weight: 300;
        }
        .msg-stat-sub {
            font-size: clamp(1.25rem, 3vw, 1.75rem);
            color: var(--md-on-surface-variant);
            font-weight: 700;
            font-family: 'Montserrat', sans-serif;
        }
        .msg-stat-labels {
            display: flex;
            justify-content: center;
            gap: 40px;
            margin-top: 12px;
        }
        .msg-stat-label {
            font-size: 0.8125rem;
            color: var(--md-on-surface-variant);
            letter-spacing: 0.03em;
        }

        /* examples list */
        .msg-examples {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin: 20px 0;
            padding: 20px;
            border-radius: 12px;
            background: var(--md-surface-container);
            border: 1px solid var(--md-outline-variant);
        }
        .msg-surface .msg-examples {
            background: var(--md-surface);
        }
        .msg-example-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.875rem;
            color: var(--md-on-surface-variant);
            padding: 6px 0;
        }
        .msg-example-item span:last-child {
            font-weight: 700;
            font-family: 'Montserrat', sans-serif;
            color: var(--md-on-surface);
        }

        /* plan blocks */
        .msg-plans {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin: 28px 0;
        }
        .msg-plan-item {
            padding: 20px;
            border-radius: 12px;
            border: 1px solid var(--md-outline-variant);
        }
        .msg-plan-item.msg-plan-free {
            background: rgba(16, 185, 129, 0.06);
            border-color: rgba(16, 185, 129, 0.2);
        }
        .msg-plan-tag {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 999px;
            font-size: 0.6875rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        .msg-plan-free .msg-plan-tag {
            background: var(--md-primary);
            color: #ffffff;
        }
        .msg-plan-item:not(.msg-plan-free) .msg-plan-tag {
            background: var(--md-surface-container);
            color: var(--md-on-surface-variant);
            border: 1px solid var(--md-outline-variant);
        }
        .msg-plan-name {
            font-weight: 700;
            color: var(--md-on-surface);
            font-size: 1rem;
            margin-bottom: 4px;
        }
        .msg-plan-desc {
            font-size: 0.875rem;
            color: var(--md-on-surface-variant);
            line-height: 1.6;
        }

        /* CTA section */
        .msg-cta-section {
            text-align: center;
            padding: 64px 20px;
        }
        .msg-cta-inner {
            max-width: 680px;
            margin: 0 auto;
        }
        .msg-cta-heading {
            font-family: 'Shippori Mincho', serif;
            font-size: clamp(1.25rem, 2.5vw, 1.625rem);
            font-weight: 600;
            color: var(--md-on-surface);
            margin-bottom: 32px;
            letter-spacing: 0.03em;
        }
        .msg-cta-buttons {
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-width: 400px;
            margin: 0 auto 40px;
        }
        .msg-cta-buttons .btn-primary,
        .msg-cta-buttons .btn-secondary {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .msg-contact {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            padding-top: 32px;
            border-top: 1px solid var(--md-outline-variant);
        }
        .msg-contact-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.875rem;
            color: var(--md-on-surface-variant);
        }
        .msg-contact-item a {
            color: var(--md-primary);
        }

        /* guide links (simplified) */
        .msg-guides {
            max-width: 680px;
            margin: 0 auto;
            padding: 0 20px 64px;
        }
        .msg-guides-label {
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--md-on-surface-variant);
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .msg-guide-link {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            border-radius: 12px;
            transition: background 0.2s;
            text-decoration: none;
        }
        .msg-guide-link:hover {
            background: var(--md-surface-container);
        }
        .msg-guide-link .msg-guide-title {
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--md-on-surface);
        }
        .msg-guide-link .msg-guide-desc {
            font-size: 0.75rem;
            color: var(--md-on-surface-variant);
        }
        .msg-guide-link i {
            color: var(--md-on-surface-variant);
            flex-shrink: 0;
        }

        /* ── responsive ── */
        @media (min-width: 640px) {
            .msg-hero {
                padding: 88px 24px 64px;
            }
            .msg-section {
                padding: 80px 24px;
            }
            .msg-cta-buttons {
                flex-direction: row;
                max-width: 500px;
            }
            .msg-cta-buttons .btn-primary,
            .msg-cta-buttons .btn-secondary {
                flex: 1;
            }
        }
    </style>
</head>
<body class="js-loading pt-14 font-body" style="background:var(--md-surface);color:var(--md-on-surface);">

    <?php include __DIR__ . '/components/nav.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <main>

    <!-- ============================================
         Section 1: Hero
         ============================================ -->
    <section class="msg-hero">
        <h1><?= htmlspecialchars($aboutText['hero_title']) ?></h1>
        <p class="msg-hero-sub"><?= htmlspecialchars($aboutText['hero_sub']) ?></p>
    </section>

    <!-- TOC -->
    <nav class="msg-section" style="padding-top:32px;padding-bottom:0;">
        <div class="msg-section-inner" style="max-width:520px;">
            <div style="background:var(--md-surface-container);border-radius:16px;padding:24px 28px;">
                <p style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--md-on-surface-variant);margin-bottom:14px;"><?= htmlspecialchars($aboutText['toc_label']) ?></p>
                <ol style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px;font-size:0.9375rem;">
                    <li><a href="#origin" style="color:var(--md-primary);text-decoration:none;"><?= htmlspecialchars($aboutText['toc_origin']) ?></a></li>
                    <li><a href="#regional" style="color:var(--md-primary);text-decoration:none;"><?= htmlspecialchars($aboutText['toc_regional']) ?></a></li>
                    <li><a href="#disappearing" style="color:var(--md-primary);text-decoration:none;"><?= htmlspecialchars($aboutText['toc_disappearing']) ?></a></li>
                    <li><a href="#sustainability" style="color:var(--md-primary);text-decoration:none;"><?= htmlspecialchars($aboutText['toc_sustainability']) ?></a></li>
                </ol>
            </div>
        </div>
    </nav>

    <!-- ============================================
         Section 2: 原体験 — 岩内の記憶
         ============================================ -->
    <section id="origin" class="msg-section" style="scroll-margin-top:80px;">
        <div class="msg-section-inner">

            <h2><?= htmlspecialchars($aboutText['origin_title']) ?></h2>

            <div class="msg-lead">
                <?= $formatMultiline($aboutText['origin_lead']) ?>
            </div>

            <div class="msg-body">
                <?php foreach (array_slice($aboutText['origin_intro_paragraphs'], 0, 4) as $paragraph): ?>
                <p><?= $formatMultiline($paragraph) ?></p>
                <?php endforeach; ?>

                <p class="msg-accent"><?= $formatMultiline($aboutText['origin_intro_paragraphs'][4] . "\n" . $aboutText['origin_intro_paragraphs'][5]) ?></p>
            </div>

            <h2 style="margin-top: 48px;"><?= htmlspecialchars($aboutText['origin_resolution_title']) ?></h2>

            <div class="msg-body">
                <?php foreach (array_slice($aboutText['origin_resolution_paragraphs'], 0, 3) as $paragraph): ?>
                <p><?= $formatMultiline($paragraph) ?></p>
                <?php endforeach; ?>

                <p class="msg-accent"><?= $formatMultiline($aboutText['origin_resolution_paragraphs'][3]) ?></p>
                <p><?= $formatMultiline($aboutText['origin_resolution_paragraphs'][4]) ?></p>

                <p class="msg-accent-lg"><?= $formatMultiline($aboutText['origin_final']) ?></p>
            </div>

        </div>
    </section>

    <!-- ============================================
         Section 3: なぜ、地域創生なのか
         ============================================ -->
    <section id="regional" class="msg-section msg-surface" style="scroll-margin-top:80px;">
        <div class="msg-section-inner">

            <h2><?= htmlspecialchars($aboutText['regional_title']) ?></h2>

            <div class="msg-body">
                <?php foreach ($aboutText['regional_intro_paragraphs'] as $paragraph): ?>
                <p><?= $formatMultiline($paragraph) ?></p>
                <?php endforeach; ?>
            </div>

            <!-- Insight 1 -->
            <div class="msg-insight">
                <span class="msg-insight-num">1</span>
                <div class="msg-insight-body">
                    <p class="msg-insight-text">
                        <?= $formatMultiline($aboutText['regional_insight_1_title']) ?>
                    </p>
                    <p class="msg-cite">
                        <?= $formatMultiline($aboutText['regional_insight_1_body']) ?>
                    </p>
                </div>
            </div>

            <!-- Insight 2 -->
            <div class="msg-insight">
                <span class="msg-insight-num">2</span>
                <div class="msg-insight-body">
                    <p class="msg-insight-text">
                        <?= $formatMultiline($aboutText['regional_insight_2_title']) ?>
                    </p>
                    <p class="msg-cite">
                        <?= $formatMultiline($aboutText['regional_insight_2_body']) ?>
                    </p>
                </div>
            </div>

            <!-- Insight 3 -->
            <div class="msg-insight">
                <span class="msg-insight-num">3</span>
                <div class="msg-insight-body">
                    <p class="msg-insight-text">
                        <?= $formatMultiline($aboutText['regional_insight_3_title']) ?>
                    </p>
                    <p class="msg-cite">
                        <?= $formatMultiline($aboutText['regional_insight_3_body']) ?>
                    </p>
                </div>
            </div>

            <h2 style="margin-top: 48px;"><?= htmlspecialchars($aboutText['regional_adults_title']) ?></h2>

            <div class="msg-body">
                <?php foreach ($aboutText['regional_adult_intro_paragraphs'] as $paragraph): ?>
                <p><?= $formatMultiline($paragraph) ?></p>
                <?php endforeach; ?>
            </div>

            <div class="msg-insight">
                <span class="msg-insight-num" style="font-size: 1.5rem;">🧠</span>
                <div class="msg-insight-body">
                    <p class="msg-insight-text">
                        <?= $formatMultiline($aboutText['regional_adult_insight_brain_title']) ?>
                    </p>
                    <p class="msg-cite">
                        <?= $formatMultiline($aboutText['regional_adult_insight_brain_body']) ?>
                    </p>
                </div>
            </div>

            <div class="msg-insight">
                <span class="msg-insight-num" style="font-size: 1.5rem;">👟</span>
                <div class="msg-insight-body">
                    <p class="msg-insight-text">
                        <?= $formatMultiline($aboutText['regional_adult_insight_steps_title']) ?>
                    </p>
                    <p class="msg-cite">
                        <?= $formatMultiline($aboutText['regional_adult_insight_steps_body']) ?>
                    </p>
                </div>
            </div>

            <div class="msg-body" style="margin-top: 32px;">
                <p><?= $formatMultiline($aboutText['regional_adult_tail_1']) ?></p>
                <p><?= $formatMultiline($aboutText['regional_adult_tail_2']) ?></p>
            </div>

            <p class="msg-accent-lg"><?= $formatMultiline($aboutText['regional_adult_tail_3']) ?></p>

        </div>
    </section>

    <!-- ============================================
         Section 4: 消滅可能性自治体
         ============================================ -->
    <section id="disappearing" class="msg-section" style="scroll-margin-top:80px;">
        <div class="msg-section-inner">

            <h2><?= htmlspecialchars($aboutText['disappearing_title']) ?></h2>

            <div class="msg-body">
                <?php foreach ($aboutText['disappearing_intro_paragraphs'] as $paragraph): ?>
                <p><?= $formatMultiline($paragraph) ?></p>
                <?php endforeach; ?>
            </div>

            <div class="msg-stat-hero">
                <div class="msg-stat-row">
                    <span class="msg-stat-number">744</span>
                    <span class="msg-stat-slash">/</span>
                    <span class="msg-stat-sub">1,729</span>
                </div>
                <div class="msg-stat-labels">
                    <span class="msg-stat-label"><?= htmlspecialchars($aboutText['disappearing_stat_label_1']) ?></span>
                    <span class="msg-stat-label"><?= htmlspecialchars($aboutText['disappearing_stat_label_2']) ?></span>
                </div>
            </div>

            <div class="msg-body">
                <p><?= $formatMultiline($aboutText['disappearing_severity_intro']) ?></p>
            </div>

            <div class="msg-examples">
                <?php foreach ($aboutText['disappearing_region_examples'] as $index => $example): ?>
                <div class="msg-example-item"<?= $index === 3 ? ' style="padding-top: 12px; border-top: 1px solid var(--md-outline-variant);"' : '' ?>>
                    <span><?= htmlspecialchars($example['region']) ?></span>
                    <span><?= htmlspecialchars($example['rate']) ?></span>
                </div>
                <?php endforeach; ?>
            </div>

            <div class="msg-body">
                <p><?= $formatMultiline($aboutText['disappearing_memory_1']) ?></p>
                <p><?= $formatMultiline($aboutText['disappearing_memory_2']) ?></p>
            </div>

            <div class="msg-lead" style="margin-top: 40px;">
                <?= htmlspecialchars($regionalMessaging['priority_lead']) ?>
            </div>

            <div class="msg-body">
                <p><?= $formatMultiline($aboutText['disappearing_support']) ?></p>
                <p><?= $formatMultiline($aboutText['disappearing_tail_1']) ?></p>
            </div>

            <p class="msg-accent-lg"><?= $formatMultiline($aboutText['disappearing_tail_2']) ?></p>

        </div>
    </section>

    <!-- ============================================
         Section 5: ビジネスモデル
         ============================================ -->
    <section id="sustainability" class="msg-section msg-surface" style="scroll-margin-top:80px;">
        <div class="msg-section-inner">

            <h2><?= htmlspecialchars($aboutText['sustainability_title']) ?></h2>

            <div class="msg-body">
                <?php foreach ($aboutText['sustainability_paragraphs'] as $paragraph): ?>
                <p><?= $formatMultiline($paragraph) ?></p>
                <?php endforeach; ?>
            </div>

            <p class="msg-accent"><?= htmlspecialchars($regionalMessaging['support_model_summary']) ?></p>

            <div class="msg-plans">
                <?php foreach ($supportPlans as $index => $plan): ?>
                <div class="msg-plan-item<?= $index === 0 ? ' msg-plan-free' : '' ?>">
                    <span class="msg-plan-tag"><?= htmlspecialchars($plan['tag']) ?></span>
                    <p class="msg-plan-name"><?= htmlspecialchars($plan['name']) ?></p>
                    <p class="msg-plan-desc"><?= htmlspecialchars($plan['description']) ?></p>
                </div>
                <?php endforeach; ?>
            </div>

            <p class="msg-accent"><?= $formatMultiline($aboutText['sustainability_highlight']) ?></p>

            <div class="msg-body" style="margin-top: 32px;">
                <p><?= $formatMultiline($aboutText['sustainability_tail_1']) ?></p>
                <p><?= $formatMultiline($aboutText['sustainability_tail_2']) ?></p>
            </div>

            <div class="msg-signature">
                <img src="assets/img/yamaki.jpg" alt="<?= htmlspecialchars($signatureName) ?>" class="msg-signature-photo">
                <div>
                    <p class="msg-signature-name"><?= htmlspecialchars($signatureName) ?></p>
                    <p class="msg-signature-title"><?= htmlspecialchars($signatureTitle) ?></p>
                </div>
            </div>

        </div>
    </section>

    <!-- ============================================
         Section 6: CTA
         ============================================ -->
    <section class="msg-cta-section">
        <div class="msg-cta-inner">

            <p class="msg-cta-heading">
                <?= htmlspecialchars($aboutText['cta_heading']) ?>
            </p>

            <div class="msg-cta-buttons">
                <a href="<?= htmlspecialchars($ctaHref) ?>" class="btn-primary">
                    <i data-lucide="camera" class="w-4 h-4"></i>
                    <?= htmlspecialchars($ctaLabel) ?>
                </a>
                <a href="for-business/" class="btn-secondary">
                    <i data-lucide="building-2" class="w-4 h-4"></i>
                    <?= htmlspecialchars($aboutText['cta_secondary']) ?>
                </a>
            </div>

            <div class="msg-contact">
                <div class="msg-contact-item">
                    <i data-lucide="map-pin" class="w-4 h-4"></i>
                    <span><?= htmlspecialchars($contactLocation) ?></span>
                </div>
                <div class="msg-contact-item">
                    <i data-lucide="mail" class="w-4 h-4"></i>
                    <a href="mailto:contact@ikimon.life">contact@ikimon.life</a>
                </div>
            </div>

        </div>
    </section>

    <!-- Related Guides -->
    <div class="msg-guides">
        <p class="msg-guides-label">
            <i data-lucide="book-open" class="w-4 h-4"></i>
            <?= htmlspecialchars($aboutText['more_label']) ?>
        </p>
        <a href="guide/walking-brain-science.php" class="msg-guide-link">
            <span style="font-size: 1.5rem;">🧠</span>
            <div style="flex: 1;">
                <p class="msg-guide-title"><?= htmlspecialchars($aboutText['guide_brain_title']) ?></p>
                <p class="msg-guide-desc"><?= htmlspecialchars($aboutText['guide_brain_desc']) ?></p>
            </div>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </a>
        <a href="guide/steps-dementia-prevention.php" class="msg-guide-link">
            <span style="font-size: 1.5rem;">👟</span>
            <div style="flex: 1;">
                <p class="msg-guide-title"><?= htmlspecialchars($aboutText['guide_steps_title']) ?></p>
                <p class="msg-guide-desc"><?= htmlspecialchars($aboutText['guide_steps_desc']) ?></p>
            </div>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </a>
        <a href="guide/nature-positive.php" class="msg-guide-link">
            <span style="font-size: 1.5rem;">🌿</span>
            <div style="flex: 1;">
                <p class="msg-guide-title"><?= htmlspecialchars($aboutText['guide_nature_positive_title']) ?></p>
                <p class="msg-guide-desc"><?= htmlspecialchars($aboutText['guide_nature_positive_desc']) ?></p>
            </div>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </a>
        <a href="century_archive.php" class="msg-guide-link">
            <span style="font-size: 1.5rem;">📦</span>
            <div style="flex: 1;">
                <p class="msg-guide-title"><?= htmlspecialchars($aboutText['guide_archive_title']) ?></p>
                <p class="msg-guide-desc"><?= htmlspecialchars($aboutText['guide_archive_desc']) ?></p>
            </div>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </a>
        <a href="methodology.php" class="msg-guide-link">
            <span style="font-size: 1.5rem;">📊</span>
            <div style="flex: 1;">
                <p class="msg-guide-title"><?= htmlspecialchars($aboutText['guide_methodology_title']) ?></p>
                <p class="msg-guide-desc"><?= htmlspecialchars($aboutText['guide_methodology_desc']) ?></p>
            </div>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </a>
    </div>

    <!-- Footer -->
    <?php include __DIR__ . '/components/footer.php'; ?>

    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>
</html>
