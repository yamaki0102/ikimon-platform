<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/Lang.php';
Auth::init();
Lang::init();

// FAQ data structure: [category_key => [icon, items[]]]
$faq_categories = [
    'cat_getting_started' => ['icon' => 'sparkles',  'items' => ['a1', 'a2', 'a3', 'a4', 'a5']],
    'cat_recording'       => ['icon' => 'camera',    'items' => ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8']],
    'cat_identification'  => ['icon' => 'search',    'items' => ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7']],
    'cat_ai_assist'       => ['icon' => 'bot',       'items' => ['f1', 'f2', 'f3', 'f4', 'f5']],
    'cat_business'        => ['icon' => 'building-2', 'items' => ['d1', 'd2', 'd3', 'd4', 'd5']],
    'cat_data_privacy'    => ['icon' => 'shield',    'items' => ['e1', 'e2', 'e3', 'e4', 'e5']],
];

// Build structured data for Schema.org FAQPage
$schema_items = [];
foreach ($faq_categories as $cat_key => $cat) {
    foreach ($cat['items'] as $item_key) {
        $q = __("faq.{$item_key}_q");
        $a = __("faq.{$item_key}_a");
        $schema_items[] = [
            '@type' => 'Question',
            'name' => $q,
            'acceptedAnswer' => [
                '@type' => 'Answer',
                'text' => $a,
            ],
        ];
    }
}
$schema = [
    '@context' => 'https://schema.org',
    '@type' => 'FAQPage',
    'mainEntity' => $schema_items,
];
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php
    $meta_title = __('faq.page_title');
    $meta_description = __('faq.page_subtitle');
    include __DIR__ . '/components/meta.php';
    ?>
    <script type="application/ld+json">
        <?php echo json_encode($schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>
    </script>
</head>

<body class="bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">
    <?php include('components/nav.php'); ?>

    <main class="max-w-4xl mx-auto px-6 py-20 pb-32">
        <!-- Hero Header -->
        <header class="mb-16 text-center">
            <span class="inline-block px-4 py-1 rounded-full bg-gray-100 border border-gray-200 text-[var(--color-primary)] text-xs font-bold uppercase tracking-widest mb-6">Help & Support</span>
            <h1 class="text-4xl md:text-6xl font-black mb-6"><?php echo __('faq.page_title'); ?></h1>
            <p class="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                <?php echo __('faq.page_subtitle'); ?>
            </p>
        </header>

        <!-- Search Bar -->
        <div class="mb-12" x-data="faqSearch()">
            <div class="relative max-w-xl mx-auto">
                <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"></i>
                <input
                    type="text"
                    x-model="query"
                    @input="filterFaq()"
                    placeholder="<?php echo __('faq.search_placeholder'); ?>"
                    class="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition shadow-sm" />
                <button
                    x-show="query.length > 0"
                    x-cloak
                    @click="query = ''; filterFaq()"
                    class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <!-- No results message -->
            <p x-show="noResults" x-cloak class="text-center text-gray-400 mt-6 text-sm">
                <?php echo __('faq.no_results'); ?>
            </p>
        </div>

        <!-- FAQ Categories -->
        <div class="space-y-12" id="faq-container">
            <?php foreach ($faq_categories as $cat_key => $cat): ?>
                <section class="faq-category" data-category="<?php echo $cat_key; ?>">
                    <!-- Category Header -->
                    <div class="flex items-center gap-3 mb-6">
                        <div class="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
                            <i data-lucide="<?php echo $cat['icon']; ?>" class="w-5 h-5 text-[var(--color-primary)]"></i>
                        </div>
                        <h2 class="text-xl font-bold"><?php echo __("faq.{$cat_key}"); ?></h2>
                    </div>

                    <!-- Q&A Accordion -->
                    <div class="space-y-3">
                        <?php foreach ($cat['items'] as $item_key): ?>
                            <div
                                class="faq-item border border-gray-200 rounded-xl overflow-hidden bg-white transition-shadow hover:shadow-sm"
                                id="faq-<?php echo $item_key; ?>"
                                x-data="{ open: false }"
                                data-q="<?php echo htmlspecialchars(__("faq.{$item_key}_q"), ENT_QUOTES); ?>"
                                data-a="<?php echo htmlspecialchars(__("faq.{$item_key}_a"), ENT_QUOTES); ?>">
                                <button
                                    @click="open = !open"
                                    class="w-full flex items-center justify-between px-5 py-4 text-left gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-xl"
                                    :aria-expanded="open">
                                    <span class="font-semibold text-sm md:text-base leading-snug" style="color: var(--color-text)"><?php echo __("faq.{$item_key}_q"); ?></span>
                                    <i data-lucide="chevron-down" class="w-5 h-5 text-gray-400 shrink-0 transition-transform duration-300" :class="open && 'rotate-180'"></i>
                                </button>
                                <div
                                    x-show="open"
                                    x-collapse
                                    x-cloak>
                                    <div class="px-5 pb-5 text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
                                        <?php echo __("faq.{$item_key}_a"); ?>
                                    </div>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </section>
            <?php endforeach; ?>
        </div>

        <!-- Still Need Help CTA -->
        <div class="mt-20 text-center p-8 rounded-2xl border border-gray-200 bg-white">
            <div class="w-14 h-14 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center mx-auto mb-4">
                <i data-lucide="message-circle" class="w-7 h-7 text-[var(--color-primary)]"></i>
            </div>
            <h3 class="text-xl font-bold mb-2"><?php echo __('faq.still_need_help'); ?></h3>
            <p class="text-gray-400 mb-6 text-sm"><?php echo __('faq.contact_message'); ?></p>
            <a
                href="mailto:contact@ikimon.life"
                class="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--color-primary)] text-white font-bold text-sm hover:opacity-90 transition">
                <i data-lucide="mail" class="w-4 h-4"></i>
                <?php echo __('faq.contact_us'); ?>
            </a>
        </div>
    </main>

    <?php include('components/footer.php'); ?>

    <script nonce="<?= CspNonce::attr() ?>">
        // FAQ Search & Filter
        function faqSearch() {
            return {
                query: '',
                noResults: false,

                init() {
                    // Auto-open if URL has hash
                    const hash = window.location.hash;
                    if (hash && hash.startsWith('#faq-')) {
                        const el = document.querySelector(hash);
                        if (el) {
                            // Wait for Alpine to init
                            this.$nextTick(() => {
                                const component = Alpine.$data(el);
                                if (component) component.open = true;
                                el.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'center'
                                });
                            });
                        }
                    }
                },

                filterFaq() {
                    const q = this.query.toLowerCase().trim();
                    const items = document.querySelectorAll('.faq-item');
                    const categories = document.querySelectorAll('.faq-category');
                    let visibleCount = 0;

                    items.forEach(item => {
                        const question = (item.dataset.q || '').toLowerCase();
                        const answer = (item.dataset.a || '').toLowerCase();
                        const match = !q || question.includes(q) || answer.includes(q);
                        item.style.display = match ? '' : 'none';
                        if (match) visibleCount++;
                    });

                    // Hide empty categories
                    categories.forEach(cat => {
                        const visibleItems = cat.querySelectorAll('.faq-item:not([style*="display: none"])');
                        cat.style.display = visibleItems.length > 0 ? '' : 'none';
                    });

                    this.noResults = visibleCount === 0;
                }
            };
        }
    </script>
</body>

</html>