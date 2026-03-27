<?php
return [
    'app_name' => 'ikimon',
    'meta_title' => 'ikimon - Citizen Science Platform',
    'descriptor' => 'Citizen Science Platform',

    // Navigation
    'nav' => [
        'search_placeholder' => 'Search species, places...',
        'explore' => 'Discover',
        'field_map' => 'Field Map',
        'zukan' => 'Encyclopedia',
        'ranking' => 'Compass',
        'compass' => 'Compass',
        'profile' => 'My Page',
        'home' => 'Home',
        'post' => 'Record',
        'login' => 'Login',
        'logout' => 'Logout',
        'notifications' => 'Notifications',
        'id_center' => 'ID Workbench',
        'guidelines' => 'Guidelines',
        'admin' => 'Admin',
        'toggle_lang' => '日本語',
        'events' => 'Events',
        'field_research' => 'Field Research',
        'my_field' => 'Walk',
        'record_mode_title' => 'How do you want to record?',
        'record_observation' => 'Observation',
        'record_observation_desc' => 'Take a photo to record wildlife',
        'record_sensor' => 'Creature Sensor',
        'record_sensor_desc' => 'Auto-detect while walking',
        'record_bioscan' => 'BioScan',
        'record_bioscan_desc' => 'Real-time species ID with camera',
        'record_cancel' => 'Cancel',
        'site_dashboard' => 'Site Dashboard',
        'ranking_board' => 'Ranking',
        // Footer Keys
        'about' => 'About Us',
        'team' => 'Team',
        'updates' => 'Updates',
        'guidelines' => 'Guidelines',
        'terms' => 'Terms',
        'privacy' => 'Privacy Policy',
        'contact' => 'Contact',
        'business' => 'For Business/Gov',
        'showcase' => 'Showcase',
        'beginners' => 'Getting Started',
        'faq' => 'FAQ',
        'copyright' => '&copy; 2024-2026 ikimon Project.<br class="md:hidden"> Based in Hamamatsu, Japan.',
    ],

    // Home / Recent Discoveries
    'home' => [
        'timeline' => 'Recent Discoveries',
        'daily_mission' => 'Daily Mission',
        'activity' => 'Activity',
        'community_standing' => 'Explorer Status',
        'impact_factor' => 'Contribution',
        'trust_signal' => 'Trust',
        'stable' => 'Stable',
        'report' => 'Impact Report',
        'updates_suffix' => 'records',
        'all_seen' => 'All discoveries reviewed!',
        'user_prefix' => 'Explorer',
        'observed' => 'recorded this',
        'identifying' => 'Needs ID...',
        'detail' => 'View Details',
        'individual_count' => 'individuals',
    ],

    // BioUtils Status
    'status' => [
        'research_grade' => 'Research Grade',
        'suggested' => 'Suggested',
        'needs_id' => 'Needs ID',
        'expert_review' => 'Expert Review',
        'casual' => 'Casual',
    ],

    'species' => [
        'quick_facts_title' => 'What this page shows',
        'quick_facts_intro' => 'Here is a short summary of what is currently grounded on this page.',
        'quick_facts_note_single' => 'This summary is built only from the material currently available on the page. It will grow as more records and references are added.',
        'quick_facts_note_multi' => 'This summary is built only from the evidence already present on the page: observations, literature, specimens, and curated notes.',
        'quick_facts_taxonomy' => 'As a taxonomic group',
        'quick_facts_observation' => 'From observations',
        'quick_facts_literature' => 'From literature & specimens',
        'quick_facts_distilled' => 'From curated notes',
        'quick_facts_taxonomy_text' => '{name} is grouped here at the {rank} level. This page helps you browse records from nearby relatives together.',
        'quick_facts_obs_count' => 'This page includes {count} observation records.',
        'quick_facts_obs_peak' => 'Records are concentrated in {months}.',
        'quick_facts_obs_map' => '{count} mapped locations are shown on the map.',
        'quick_facts_lit_citations' => '{count} field-guide references',
        'quick_facts_lit_papers' => '{count} papers',
        'quick_facts_lit_specimens' => '{count} specimen records',
        'quick_facts_lit_linked' => 'Linked sources: {items}.',
        'quick_facts_lit_redlist' => 'Conservation status information is also available.',
        'quick_facts_distilled_habitat' => 'Habitat clues include {items}.',
        'quick_facts_distilled_season' => 'Seasonal clues include {items}.',
        'quick_facts_month_label' => '{month}',
        'quick_facts_list_separator' => ', ',
        'quick_facts_item_separator' => ', ',
    ],

    'zukan' => [
        'card_summary' => [
            'group_rank' => '{group} {rank}',
            'rank_only' => 'Recorded as a {rank}',
            'obs_count_singular' => '{count} observation',
            'obs_count_plural' => '{count} observations',
            'observer_count_singular' => '{count} observer',
            'observer_count_plural' => '{count} observers',
            'last_observed' => 'recorded through {year}-{month}',
            'rank_species' => 'species',
            'rank_genus' => 'genus',
            'rank_family' => 'family',
            'rank_order' => 'order',
            'rank_class' => 'class',
            'rank_phylum' => 'phylum',
            'rank_kingdom' => 'kingdom',
            'rank_generic' => 'taxon',
            'separator' => ' · ',
            'group_bird' => 'bird',
            'group_insect' => 'insect',
            'group_plant' => 'plant',
            'group_mammal' => 'mammal',
            'group_fish' => 'fish',
            'group_fungi' => 'fungus',
            'group_amphibian_reptile' => 'amphibian / reptile',
            'group_other' => 'other',
        ],
    ],

    // Explorer Levels
    'rank' => [
        'legendary' => 'LEGENDARY',
        'expert' => 'EXPERT',
        'veteran' => 'VETERAN',
        'rookie' => 'FIRST STEPS',

        'legend' => 'LEGEND',
        'influencer' => 'MASTER EXPLORER',
        'rising_star' => 'GROWING',
        'observer' => 'OBSERVER',
    ],

    // Offline
    'offline' => [
        'title' => 'You are Offline',
        'message' => 'It looks like you are not connected to the internet.<br>Please check your connection.',
        'reload' => 'Reload',
        'tips_title' => 'Offline capabilities',
        'tip_1' => 'You can view previously allowed pages',
        'tip_2' => 'Records will auto-upload when online',
        'tip_3' => 'Save photos to your device for now',
    ],

    // Ambient Presence
    'ambient' => [
        // Ghost
        'ghost_nearby' => 'There\'s a presence nearby',
        'ghost_area' => 'Someone is exploring this area',

        // Strand Map
        'strand_title' => 'Exploration Trails',
        'strand_empty' => 'No records yet',

        // Fog of War
        'fog_undiscovered' => 'Undiscovered area',
        'fog_discovered' => 'Explored area',

        // Notifications — 3 types only
        'notif_id_added' => 'Someone identified this',
        'notif_research_grade' => 'Research grade reached',
        'notif_ghost' => 'Exploration activity nearby',

        // Identification Evidence
        'id_evidence_title' => 'Identification Evidence',
        'id_evidence_morphology' => 'Morphological features',
        'id_evidence_habitat' => 'Habitat',
        'id_evidence_season' => 'Seasonality',
        'id_evidence_sound' => 'Sound / Call',
        'id_evidence_reference' => 'Reference / Field Guide',
        'id_evidence_note' => 'Additional notes',
        'id_disagree' => 'I have a different view',
        'id_escalate' => 'Request admin review',

        // Time Capsule
        'capsule_title' => 'Echoes from Last Year',
        'capsule_one_year_ago' => 'Around this time last year',
        'capsule_you_recorded' => 'You recorded',

        // Completion Bar
        'growth_this_month' => 'Discoveries this month',
        'growth_species_added' => 'new species recorded',

        // Explorer Coordinates
        'coordinates_title' => 'Explorer Coordinates',
        'coordinates_global' => 'Worldwide',
        'coordinates_regional' => 'This Region',
        'coordinates_you' => 'Your Exploration',

        // Footprint
        'footprint_left' => 'Left a footprint',
        'footprint_count' => 'people visited here',

        // Profile — Journey
        'journey_title' => 'Your Journey',
        'journey_first_record' => 'First Record',
        'journey_total_species' => 'Species Encountered',
        'journey_contribution' => 'Data Contribution',
    ],

    // FAQ
    'faq' => [
        'page_title' => 'FAQ',
        'page_subtitle' => 'Frequently asked questions about ikimon, how it works, and your data.',
        'search_placeholder' => 'Search questions...',
        'no_results' => 'No matching questions found. Try a different keyword.',
        'still_need_help' => 'Still need help?',
        'contact_us' => 'Contact Us',
        'contact_message' => 'Feel free to reach out to us via email.',

        // Category names
        'cat_getting_started' => 'Getting Started',
        'cat_recording' => 'Recording',
        'cat_identification' => 'Identification',
        'cat_ai_assist' => 'AI Assist',
        'cat_business' => 'For Business / Government',
        'cat_data_privacy' => 'Data & Privacy',

        // ── A: Getting Started ──────────────────────

        'a1_q' => 'What is ikimon?',
        'a1_a' => 'ikimon is a <strong>citizen science biodiversity platform</strong>. Record the birds, flowers, insects, and other wildlife you find around you using your smartphone, and collaborate with users and experts worldwide to identify them.<br><br>Your records become <strong>scientific open data</strong>, used to visualize regional biodiversity and support corporate environmental reporting (TNFD).<br><br>"Found it!" → "Snapped it!" → "Named it!" — this simple chain of experiences becomes a powerful force for nature conservation.<br><br><a href="about.php" class="text-[var(--color-primary)] underline">Learn more about ikimon →</a>',

        'a2_q' => 'Do I need to register?',
        'a2_a' => '<strong>No registration is needed for browsing.</strong> Field maps, the species encyclopedia, and regional rankings are all freely accessible without logging in.<br><br>The following features require <strong>signing in with a Google account</strong>:<br>• Posting wildlife observations<br>• Suggesting species names for others\' records (identification)<br>• Managing your profile, badges, and achievements<br>• Receiving notifications<br><br>Sign in by tapping the "Login" button in the top-right corner. It takes just a few seconds with your Google account — no additional registration or email input required.',

        'a3_q' => 'Is it free to use?',
        'a3_a' => '<strong>All core citizen-science features are completely free for citizens.</strong> There are no upload limits, and there are no premium posting or identification features locked behind a paywall.<br><br>For research and operational use, we offer three public plans:<br>• <strong>Pro ($4,900 JPY / month)</strong> for researchers, schools, and NPOs<br>• <strong>Public ($39,800 JPY / month)</strong> for municipalities, universities, and companies running one site<br>• <strong>Portfolio ($99,000 JPY / month)</strong> for organizations managing multiple sites<br><br><a href="for-business.php" class="text-[var(--color-primary)] underline">View plans for business & public-sector use →</a>',

        'a4_q' => 'Can I use it on my smartphone?',
        'a4_a' => 'Yes — your smartphone\'s browser is all you need. <strong>No app store download required.</strong><br><br>ikimon is a <strong>PWA (Progressive Web App)</strong>, so you can add it to your home screen and use it just like a native app:<br><br><strong>For iPhone:</strong><br>1. Open ikimon.life in Safari<br>2. Tap the share button (□↑) at the bottom<br>3. Select "Add to Home Screen"<br><br><strong>For Android:</strong><br>1. Open ikimon.life in Chrome<br>2. Tap the "Install" banner that appears near the address bar<br><br>Launching from your home screen gives you a full-screen experience, and some data is available offline. Of course, you can also access ikimon from any desktop browser.',

        'a5_q' => 'Can children use ikimon?',
        'a5_a' => 'Yes. ikimon is designed for users of all ages.<br><br><strong>For younger users:</strong><br>• Children under 13 should use ikimon with parental consent and supervision<br>• Since Google account login is required, Google\'s age restriction policies apply<br>• Records include approximate location data, so parents should be mindful of location settings when children are using the app<br><br><strong>For schools & educational institutions:</strong><br>ikimon is ideal for school fieldwork, environmental education, and science classes. Classes can record wildlife in the same area and create their own species catalogs. For inquiries about educational use, contact us at <a href="mailto:contact@ikimon.life" class="text-[var(--color-primary)] underline">contact@ikimon.life</a>.',

        // ── B: Recording ──────────────────────

        'b1_q' => 'What if I don\'t know the species name?',
        'b1_a' => '<strong>Not knowing the name is absolutely fine!</strong> In fact, that\'s one of the best things about ikimon.<br><br><strong>Here\'s what to do:</strong><br>1. Take a photo (multiple angles if possible)<br>2. On the recording screen, leave the species name blank — that\'s OK<br>3. Write down what you noticed in the notes field<br>   Examples: "Small butterfly on a garden flower," "Green insect about 2cm long"<br>4. Once posted, community experts will be notified and can suggest the name<br><br>Even rough guesses like "Maybe some kind of moth?" or "Looks like a daisy family?" help experts find your record. <strong>Not knowing is not something to be embarrassed about — it\'s the first step to discovery.</strong><br><br><a href="for-citizen.php" class="text-[var(--color-primary)] underline">Read the beginner\'s recording guide →</a>',

        'b2_q' => 'What kind of photos should I take?',
        'b2_a' => 'Good photos are the key to accurate identification. Tips vary by organism type, but here are the universal basics:<br><br><strong>The Essential 3 Shots:</strong><br>• <strong>Full body</strong>: A shot showing the entire organism (size and shape)<br>• <strong>Close-up of key features</strong>: Wing patterns, flower centers, body markings — the details that enable identification<br>• <strong>Habitat</strong>: The surroundings (on a tree, near water, on concrete, etc.)<br><br><strong>Organism-specific tips:</strong><br>• 🦋 <strong>Insects</strong>: Wings open AND closed, plus antennae and leg count if visible<br>• 🐦 <strong>Birds</strong>: Beak shape, chest pattern, and tail length are key. Video can also help<br>• 🌸 <strong>Plants</strong>: Photograph flowers, leaves, stems, and fruits separately. The underside of leaves matters too<br>• 🍄 <strong>Fungi</strong>: Capture the underside of the cap (gills or pores), the full stipe, and cross-sections if possible<br><br>Placing your hand, a pen, or a ruler next to the subject helps convey <strong>scale</strong>. In dim conditions, natural light is better than flash.<br><br><a href="guidelines.php" class="text-[var(--color-primary)] underline">See the full photography guidelines →</a>',

        'b3_q' => 'How is location handled?',
        'b3_a' => 'Location data is crucial — it records <strong>where</strong> the organism was found.<br><br><strong>How location is captured:</strong><br>• <strong>Automatic GPS</strong>: Select "Use current location" on the posting screen to capture from your phone\'s GPS<br>• <strong>Photo EXIF data</strong>: If your camera app has location enabled, coordinates are automatically extracted from the photo<br>• <strong>Manual input</strong>: Tap on the map to specify the location yourself<br><br><strong>Privacy protections:</strong><br>• <strong>Automatic masking for endangered species</strong>: Records identified as red list species have their coordinates automatically obscured (displayed at reduced precision) to prevent poaching and over-collection<br>• <strong>EXIF stripping</strong>: GPS coordinates and device metadata embedded in uploaded photos are automatically removed<br>• Map displays show approximate areas only — not specific enough to identify home addresses<br><br><a href="privacy.php" class="text-[var(--color-primary)] underline">View our Privacy Policy →</a>',

        'b4_q' => 'What if I find multiple species at the same location?',
        'b4_a' => '<strong>Create a separate record for each species.</strong><br><br><strong>Example: During a walk in the park you spot:</strong><br>• A great tit → Record #1<br>• A swallowtail butterfly → Record #2<br>• A dandelion → Record #3<br><br>Posting them as separate records makes each one useful for distribution data by species.<br><br><strong>Multiple individuals of the same species:</strong><br>Record one representative individual and use the <strong>"Individual Count" field</strong> on the recording screen to select the approximate number you observed (1, 2–5, 6–10, 11–50, 50+). An exact count isn\'t needed. You don\'t need to post every single individual.<br><br><strong>Flocks or swarms:</strong><br>If you encounter a large group (like a flock of starlings), take a photo of the whole group, select "50+" in the individual count field, and add a note like "Flock of ~30 birds" for more detail.<br><br><strong>Why individual counts matter:</strong><br>Adding "how many" to "what was here" transforms a presence record into <strong>abundance data</strong> — essential for tracking population trends over time. Recording counts at the same location year after year creates invaluable indicators of ecosystem health.',

        'b9_q' => 'How should I use the "Individual Count" field?',
        'b9_a' => 'Open "Add name and details" on the recording screen to find the <strong>"Individual Count"</strong> field. Select the approximate number of individuals you observed in the area.<br><br><strong>Options:</strong><br>• <strong>1</strong>: Single individual<br>• <strong>2–5</strong>: A few individuals<br>• <strong>6–10</strong>: Multiple individuals grouped together<br>• <strong>11–50</strong>: A flock, colony, or cluster<br>• <strong>50+</strong>: Large flock or dense population<br><br><strong>Estimates are perfectly fine!</strong><br>This isn\'t a strict count — just your best guess. The field is optional, so you can skip it if you prefer.<br><br><strong>Why this data matters:</strong><br>"Something was here" is distribution data. Adding "how many" makes it <strong>abundance data</strong> — highly valued in ecology:<br><br>• <strong>Population monitoring</strong>: Recording at the same place over years reveals population trends<br>• <strong>Environmental indicators</strong>: A sudden drop in numbers can signal habitat degradation<br>• <strong>GBIF/DwC compatible</strong>: Exported as the Darwin Core <code>individualCount</code> field — international standard data<br>• <strong>Business reports</strong>: Individual count trends are visualized on site dashboards<br><br>Your "about 5" today could become crucial evidence in determining "this species is declining" a decade from now.',

        'b5_q' => 'Can I post captive or cultivated organisms?',
        'b5_a' => 'Yes, you can. However, they must be <strong>clearly distinguished from wild observations</strong>.<br><br><strong>Rules for posting:</strong><br>• Note <strong>"captive," "cultivated," or "kept"</strong> in the description field<br>• Include details about the rearing environment if possible (aquarium, cage, flower bed, etc.)<br><br><strong>Why does this matter?</strong><br>In scientific data, "This species was found wild at this location" means something very different from "This was a captive specimen photographed here." Escaped pet reports (potential invasive species) can actually be extremely valuable data for ecosystem conservation.<br><br>Captive observations also contribute to enriching species guide photos and sharing knowledge about keeping and cultivation.',

        'b6_q' => 'Can I post older photos?',
        'b6_a' => 'Yes, you can post photos taken in the past.<br><br><strong>If EXIF data is present (recommended):</strong><br>Photos taken with smartphones and digital cameras typically have EXIF data (date/time and GPS coordinates) embedded. ikimon <strong>automatically reads this data</strong> and pre-fills the date and location.<br><br><strong>If EXIF data is missing:</strong><br>For older photos or images saved from social media where EXIF data has been stripped, you can manually enter:<br>• Observation date (approximate is fine — just do your best)<br>• Observation location (tap on the map to specify)<br><br><strong>Important notes:</strong><br>• Only post photos <strong>you took yourself</strong> (reposting others\' photos is prohibited)<br>• Even if you only have approximate details, notes like "Around spring 2024, at a park in Hamamatsu" still make valuable data<br><br><a href="guidelines.php" class="text-[var(--color-primary)] underline">View the posting guidelines →</a>',

        // ── C: Identification ──────────────────────

        'c1_q' => 'How are species identified?',
        'c1_a' => 'ikimon uses a <strong>community consensus system</strong> for species identification. No single person\'s opinion is final — instead, accuracy improves by combining knowledge from multiple people.<br><br><strong>The identification process:</strong><br>1. <strong>After posting</strong>: The status is "Needs ID"<br>2. <strong>First suggestion</strong>: When someone suggests a species name, it changes to "Suggested"<br>3. <strong>Consensus</strong>: When 2 or more users agree on the same name, it\'s upgraded to <strong>"Research Grade"</strong><br>4. <strong>If there\'s disagreement</strong>: When a different name is suggested, a discussion begins, and the name with the strongest consensus is adopted<br><br>This system prevents individual bias and misidentification, maintaining the scientific reliability of the data.',

        'c2_q' => 'Is AI used for identification?',
        'c2_a' => 'AI image recognition may be used <strong>as reference information only</strong>.<br><br><strong>ikimon\'s AI policy:</strong><br>• AI suggestions are just "hints" — <strong>final species determination is always made by humans</strong><br>• AI alone can <strong>never</strong> upgrade a record to Research Grade<br>• AI suggestions are often wrong, so always verify with your own eyes and knowledge<br><br><strong>Why do we insist on human identification?</strong><br>AI is useful, but it currently has limitations with closely related species (e.g., similar butterfly species), or organisms at different life stages (larvae, winter buds, etc.). <strong>Collaborative identification between citizens and experts</strong> is the foundation of ikimon\'s data quality.<br><br><a href="about.php" class="text-[var(--color-primary)] underline">Read about ikimon\'s data ethics →</a>',

        'c3_q' => 'What if I suggest the wrong species name?',
        'c3_a' => '<strong>Don\'t worry.</strong> Mistakes can be corrected at any time, and there\'s absolutely no blame involved.<br><br><strong>How to correct:</strong><br>• You can withdraw or change your identification suggestion from the record\'s page at any time<br>• Other users may also suggest alternative names<br>• When opinions differ, discussions happen based on evidence photos and observation notes<br><br><strong>The ikimon culture:</strong><br>Mistakes are "opportunities for new discoveries." "I thought this butterfly was a Cabbage White, but it turned out to be a Veined White" — this experience is the best way to sharpen your observation skills.<br><br>Beginners and veterans alike are all "works in progress." <strong>The ikimon community celebrates the courage to try, even when you\'re uncertain.</strong>',

        'c4_q' => 'What is "Research Grade"?',
        'c4_a' => 'Research Grade is ikimon\'s <strong>high-quality, reusable data state</strong>. Today, this does <strong>not</strong> mean "species-level only." Observations that are stably agreed at the family or genus level can also be treated as research-usable.<br><br><strong>How to read the current labels:</strong><br>• <strong>Species-ready</strong>: stable at species or below, suitable for finer analyses<br>• <strong>Research-usable</strong>: stable at family or genus, suitable for monitoring and aggregated analysis<br><br><strong>Shared requirements:</strong><br>• ✅ A photo or audio is attached<br>• ✅ Observation date is recorded<br>• ✅ Location data is recorded<br>• ✅ The observation is wild<br>• ✅ Weighted community agreement is at least 66.7%<br>• ✅ At least one identifier other than the observer has participated<br>• ✅ No unresolved disagreement remains<br>• ✅ There is no lineage conflict in the taxonomy<br><br><strong>The displayed label changes with taxonomic precision:</strong><br>• Stable at family or genus → <strong>Research-usable</strong><br>• Stable at species or below → <strong>Species-ready</strong><br><br><strong>Why this approach?</strong><br>Photos often cannot safely reach species level. Even so, a stable family or genus identification can still be very valuable for research and long-term monitoring. ikimon therefore separates <strong>precision (how specific)</strong> from <strong>trust (how strong the agreement is)</strong>.',

        'c5_q' => 'Can I help identify species?',
        'c5_a' => '<strong>Yes — anyone can participate!</strong> This is one of ikimon\'s most important features.<br><br><strong>How to participate:</strong><br>1. Go to the "ID Workbench" in the navigation<br>2. You\'ll see a list of records that still need identification (Needs ID)<br>3. Look at the photos and suggest a species name to the best of your knowledge<br>4. Broad categories like "Order Lepidoptera" or "Family Asteraceae" are welcome<br><br><strong>Still okay for beginners?</strong><br>Absolutely. Even "I\'m not sure, but it looks like a ___" is helpful. Your suggestion can prompt an expert to provide a more detailed identification.<br><br><strong>Benefits of participating in identification:</strong><br>• Sharpens your observation skills and knowledge<br>• Your contribution score (ID score) is reflected in your profile<br>• Creates a cycle of shared knowledge as others thank you for your help<br><br>ikimon\'s identification community runs on a <strong>culture of mutual learning</strong>. Start with the organisms you know best.',

        'c6_q' => 'How is free-text like the notes field linked to scientific species names in the database?',
        'c6_a' => 'In ikimon, user free text is not stored as-is for species tracking. Instead, we have a system that accumulates records as <strong>standardized data compliant with global taxonomy</strong>. This works through three connected mechanisms: "Taxon Suggestion", "AI Assistance", and "Community Consensus".<br><br><strong>1. Taxon Suggestion</strong><br>When typing a name to post or suggest an identification, you aren\'t just typing text. The system <strong>searches our Taxonomy database in real-time</strong> and lists standardized candidates (scientific and common names).<br>By selecting a candidate, it is recorded not as a string "Swallowtail", but as clearly defined taxon data (including scientific name, rank, GBIF key, etc.).<br><br><strong>2. AI Assistance</strong><br>When using the "Ask AI" feature, it doesn\'t just return text either. It cross-references its image recognition results with our Taxonomy database and <strong>suggests standardized taxa (usually at the Family level) that exist in the database</strong>. This prevents naming variations.<br><br><strong>3. Community Consensus (WE-Consensus)</strong><br>Even if you start by just writing "Swallowtail butterfly" in your notes, other users will use the Suggestion feature to propose the correct, standardized taxon. Through multiple verifications and WE-Consensus, <strong>a free-text observation note is ultimately elevated into accurate scientific data compliant with Darwin Core standards</strong>.<br><br>Through these mechanisms, naming variations and old scientific names (synonyms) are resolved and organized, resulting in an accumulation of <strong>"clean, structured data"</strong> that researchers and businesses can immediately use for analysis.',

        'c7_q' => 'How does the system resolve species names accurately without relying on AI?',
        'c7_a' => 'ikimon uses a <strong>fast, 3-layer PHP architecture</strong> to resolve biological names into standardized scientific data, entirely without AI inference. This ensures instant performance on standard servers while maintaining strict scientific accuracy.<br><br><strong>The 3-Layer Taxon Resolution:</strong><br>1. <strong>Local Resolver (Ultra-fast):</strong> Checks our built-in curated dictionary containing common names, synonyms, and historical names (like resolving "ブンチョウ" or various regional names instantly).<br>2. <strong>iNaturalist API:</strong> If not found locally, it queries the global iNaturalist database to catch diverse common names across multiple languages.<br>3. <strong>GBIF Backbone Taxonomy:</strong> As a final fallback, it verifies scientific names and synonyms against the official GBIF (Global Biodiversity Information Facility) backbone, ensuring mapping to universally accepted taxon keys.<br><br><strong>Handling Higher Taxa (Genus/Family):</strong><br>When an exact species match isn\'t possible, the system seamlessly handles higher taxonomic ranks (like Genus or Family) by retrieving their structural lineage and storing the corresponding GBIF Key and Rank. This makes sure that even partial identifications (e.g., "A type of butterfly") are scientifically structured.<br><br>All this happens in milliseconds behind the scenes. We rely on verified external databases rather than AI hallucinations, guaranteeing that your observations are accurately linked to global biodiversity networks.',

        // ── F: AI Assist ──────────────────────

        'f1_q' => 'Is there an AI check before posting?',
        'f1_a' => '<strong>Not anymore.</strong><br><br>There used to be a pre-posting "Ask AI" step, but we removed it and unified the flow around the automatic <strong>Observation Hints</strong> that appear after posting.<br><br><strong>How it works now:</strong><br>• Just post your observation<br>• After posting, an AI memo is generated automatically from the photo, place, and season<br>• You can review it later on the observation detail page<br><br><strong>Why:</strong><br>The pre-posting AI step often failed at the worst possible moment and overlapped with the post-submission AI memo. We now prioritize <strong>capturing the observation without interruption</strong>.',

        'f2_q' => 'Is it safe to send my photos for AI analysis?',
        'f2_a' => '<strong>Yes. We protect your privacy to the maximum extent.</strong><br><br><strong>Privacy measures when sending photos:</strong><br>• Photos are <strong>resized to 512 pixels</strong> before sending (original high-resolution photos are never sent to AI)<br>• <strong>EXIF data (GPS coordinates, device info) is completely stripped</strong> before AI analysis<br>• AI analysis is <strong>real-time only</strong> — photos are not stored by the AI service<br>• We use <strong>Google Gemini Flash</strong>, and under Google\'s enterprise API terms, submitted data is not used for AI training<br><br><strong>In short:</strong> The AI only sees "a small photo of a living thing with no location data." Your privacy is protected.<br><br><a href="about.php" class="text-[var(--color-primary)] underline">Read about ikimon\'s data ethics →</a>',

        'f3_q' => 'What happens when there\'s no signal in the field?',
        'f3_a' => '<strong>Your observations can still be saved. The AI memo will simply be delayed.</strong><br><br><strong>How it works offline:</strong><br>• <strong>Recording</strong>: Photos and notes are saved on your device and uploaded when connectivity returns<br>• <strong>Observation Hints</strong>: Since they are generated after posting, they appear only after the upload has gone through<br>• <strong>When back online</strong>: Once sync finishes, the observation detail page will receive the AI memo<br><br><strong>ikimon\'s design principle:</strong><br>ikimon is a field tool — mountains, forests, rivers, coastlines. <strong>Being offline is not an exception; it is normal.</strong> Your observation still matters even if AI comes later.',

        'f4_q' => 'How accurate are the AI suggestions?',
        'f4_a' => '<strong>They\'re designed as reference information. They are not 100% accurate.</strong><br><br><strong>What AI is good at:</strong><br>• Identifying broad taxonomic groups ("This is a butterfly," "This is a beetle")<br>• Recognizing organisms with distinctive features (common species like ladybugs, dandelions)<br>• Offering multiple candidates as "hints"<br><br><strong>What AI struggles with:</strong><br>• Distinguishing closely related species (e.g., Cabbage White vs. Veined White butterflies)<br>• Identifying larvae, winter buds, seeds, and other morphologically different life stages<br>• Rare species or regional endemics (limited training data)<br>• Low-quality photos (blurry, backlit, distant)<br><br><strong>That\'s why community knowledge is essential:</strong><br>AI points the direction; you and the community confirm the answer. This <strong>"AI suggests → Humans confirm" relay</strong> is what maintains ikimon\'s data quality.',

        'f5_q' => 'What if the AI suggests the wrong name?',
        'f5_a' => '<strong>No problem at all. AI suggestions are "hints" and are never recorded as identifications.</strong><br><br><strong>Safety by design:</strong><br>• AI suggestions are <strong>visible only to you</strong> as reference information. Other users cannot see them<br>• AI-suggested names are <strong>never automatically registered</strong> as identifications on a record<br>• If you think a suggestion is wrong, simply ignore it<br>• Even if you agree with an AI suggestion, <strong>you</strong> are the one who ultimately enters and confirms the species name<br><br><strong>Why this design?</strong><br>Research on AI image recognition has shown that showing AI answers first can cause people to over-rely on them (<strong>automation bias</strong>). ikimon values your observation skills and judgment above all, so AI remains <strong>strictly a supporting role</strong>.<br><br>Don\'t be afraid of making mistakes. Discovery often begins with getting things wrong.',
        'f6_q' => 'What is the "Observation Hints" section shown after posting?',
        'f6_a' => 'After you post an observation, ikimon may add a public <strong>Observation Hints</strong> note to the detail page. It is an AI-generated memo based on the photo, location, and season.<br><br><strong>What it includes:</strong><br>• A safe taxonomic range the photo supports right now<br>• Why the AI stops at family or genus instead of forcing a species name<br>• Visual clues the photo actually shows<br>• Similar taxa worth comparing<br>• What kind of extra photo or context would help narrow it further<br>• Supportive feedback about what is already useful in your observation<br><br><strong>Important principle:</strong><br>This memo does <strong>not</strong> count as a community identification vote. The final name is still decided by people through observation and agreement.',
        'f7_q' => 'Why was the pre-posting AI check removed?',
        'f7_a' => '<strong>Because it no longer pulled its weight.</strong><br><br><strong>Main reasons:</strong><br>• Automatic <strong>Observation Hints</strong> already appear after posting, so the two features overlapped<br>• Errors before posting made the experience worse and sometimes blocked momentum<br>• It is more useful to save the record first, then review the clues calmly afterward<br><br><strong>Current design:</strong><br>In ikimon, AI should not act like a gatekeeper. It should help you learn <strong>after the observation has been safely recorded</strong>.',
        'f8_q' => 'How should I read the "Observation Hints" section?',
        'f8_a' => '<strong>Think of Observation Hints as a guide for narrowing things down, not as a final answer.</strong><br><br><strong>How to read it:</strong><br>• <strong>"This is likely as far as we can safely narrow it"</strong>: the safest taxonomic level supported by the photo<br>• <strong>"Among the candidates, this looks closest"</strong>: the most likely working hypothesis, but not a final determination<br>• <strong>"Clues visible in the photo"</strong>: actual features the AI used, not imagined details<br>• <strong>"What would help narrow it further"</strong>: the next useful photo or observation to try<br><br><strong>Important:</strong><br>This memo is not counted as an identification vote. Human observation and community agreement still decide the final name.',

        // ── D: Business ──────────────────────

        'd1_q' => 'Can TNFD reports be auto-generated?',
        'd1_a' => 'Yes. From ikimon\'s <strong>Site Dashboard</strong>, you can auto-generate observation-based reference reports that are easier to map to the LEAP structure.<br><br><strong>What\'s included in the report:</strong><br>• <strong>Locate / Evaluate / Assess / Prepare</strong> organized as a practical reference structure<br>• A <strong>monitoring reference index</strong> that bundles species diversity, data quality, and conservation signals<br>• Confirmed species list (scientific names, common names, record counts, with photos)<br>• Red list species (national + prefectural) highlights<br>• Monthly trend charts (species count and record volume over time)<br>• Data quality grade distribution<br><br><strong>Important context:</strong><br>This report does <strong>not</strong> automatically certify TNFD alignment. It is an input for disclosure preparation and internal review, and important decisions should still include expert review or additional surveys.<br><br><a href="for-business.php" class="text-[var(--color-primary)] underline">See enterprise features in detail →</a>',

        'd2_q' => 'What is the monitoring reference index?',
        'd2_a' => 'ikimon\'s monitoring reference index is an internal indicator used to understand <strong>how complete the observation picture is and whether conservation signals are visible</strong> within a site.<br><br><strong>What it looks at:</strong><br>• <strong>Species diversity</strong>: Number of confirmed species and how uneven the records are<br>• <strong>Data quality</strong>: the share of research-usable observations, plus completeness of location, date, and photo evidence<br>• <strong>Conservation signals</strong>: Whether red list species have been observed<br>• <strong>Observation coverage</strong>: Taxonomic spread, seasonal spread, and continuity of monitoring<br><br><strong>How to use it:</strong><br>• Identify where monitoring is still thin<br>• Track improvement in monitoring practice over time<br>• Prioritize follow-up surveys or operational changes<br><br><strong>Important limitation:</strong><br>This number does not represent the absolute state of biodiversity and should not be used as a certification or disclosure conclusion on its own. It reflects the biases and gaps of presence-only observation data, so expert review should still be combined for important claims.',

        'd3_q' => 'Is the data accurate and reliable?',
        'd3_a' => 'Yes. ikimon ensures scientific reliability through <strong>multiple quality assurance layers</strong>.<br><br><strong>Quality management system:</strong><br>• <strong>Community consensus</strong>: Species names are confirmed by agreement from multiple users, not by a single opinion<br>• <strong>Research-usable status</strong>: stable family/genus observations are labeled <strong>Research-usable</strong>, while species-or-below agreement is labeled <strong>Species-ready</strong><br>• <strong>Expert-weighted input</strong>: Experienced identifiers carry more internal weight<br>• <strong>Data quality grades</strong>: Each record is automatically assigned a quality rating based on evidence completeness and agreement depth<br>• <strong>GBIF-compliant</strong>: Metadata standards aligned with the Global Biodiversity Information Facility<br><br><strong>Known limitations:</strong><br>Citizen science data differs from comprehensive ecological surveys by specialists. Bias (e.g., more records in urban areas) and gaps exist. Reports include data volume and quality distributions for <strong>transparent reporting that acknowledges data limitations</strong>.',

        'd4_q' => 'How much does it cost?',
        'd4_a' => 'ikimon uses <strong>transparent public pricing</strong>.<br><br><strong>Plans:</strong><br>• <strong>Free (¥0 / month)</strong>: citizen-science posting, identification, browsing, and AI hints<br>• <strong>Pro (¥4,900 / month)</strong>: API access, Darwin Core export, advanced search<br>• <strong>Public (¥39,800 / month)</strong>: 1 site, 5 seats, site dashboard, basic reports, audit logs<br>• <strong>Portfolio (¥99,000 / month)</strong>: 5 sites, 20 seats, cross-site monitoring foundation<br><br><strong>Public add-ons:</strong><br>• Extra site: +¥19,800 / month<br>• Extra 5 seats: +¥9,800 / month<br>• 1,000 AI analyses: +¥9,800<br>• Priority support: +¥29,800 / month<br><br>Start with a <strong>free demo</strong> to see the dashboard and report quality first.<br><br><a href="for-business.php" class="text-[var(--color-primary)] underline">View plans for business & public-sector use →</a>',

        'd5_q' => 'Can I view data only for my property?',
        'd5_a' => 'Yes. The <strong>"Site Registration" feature</strong> lets you view and analyze data exclusively within a specific area.<br><br><strong>Setup steps:</strong><br>1. From the Site Dashboard, select "Register New Site"<br>2. Upload your property boundaries in GeoJSON format (or draw them manually on the map)<br>3. Enter the site name and administrator info, then save<br><br>Once registered, ikimon will automatically generate <strong>species lists, monitoring reference indexes, and reports</strong> based only on observation data recorded within that site. You can register and compare multiple sites.<br><br>If you need help preparing GeoJSON data, contact us and we\'ll assist you.',

        // ── E: Data & Privacy ──────────────────────

        'e1_q' => 'What license applies to posted data?',
        'e1_a' => 'Observation data is published under <strong>CC BY-NC 4.0</strong> (Creative Commons Attribution-NonCommercial 4.0 International).<br><br><strong>In plain language:</strong><br>• ✅ <strong>OK</strong>: Academic research, conservation surveys, educational use, news/article citations<br>• ✅ <strong>OK</strong>: Anyone can use and modify the data with credit (poster name + ikimon)<br>• ❌ <strong>Not OK</strong>: Commercial use (product development, advertising materials, etc.)<br><br><strong>About photo copyrights:</strong><br>Copyright of posted photos <strong>remains with the poster</strong>. ikimon does not acquire photo copyrights.<br><br>This license framework was chosen to make data accessible for 30by30 targets and local conservation research while protecting contributors\' rights.<br><br><a href="terms.php" class="text-[var(--color-primary)] underline">View the full Terms of Service →</a>',

        'e2_q' => 'Is my location data protected?',
        'e2_a' => 'Yes. ikimon implements <strong>multi-layered privacy protections</strong>.<br><br><strong>Protection measures in detail:</strong><br>• <strong>Automatic masking for endangered species</strong>: Records matching Japan\'s national or prefectural red lists have their location precision automatically reduced (e.g., randomized within a 10km radius). This prevents poachers and collectors from pinpointing exact habitats<br>• <strong>EXIF stripping</strong>: GPS coordinates, device info, and other metadata embedded in uploaded photos are automatically removed<br>• <strong>No address disclosure</strong>: Map displays show "this general area" level precision — never specific enough to identify a home address<br><br><a href="privacy.php" class="text-[var(--color-primary)] underline">View our Privacy Policy →</a>',

        'e3_q' => 'Will my data be used for AI training?',
        'e3_a' => '<strong>Absolutely not.</strong> This is one of ikimon\'s most important policies.<br><br><strong>ikimon\'s Anti-AI policy:</strong><br>• User-posted data (photos, observation records, text) is <strong>never provided, sold, or licensed for AI model training</strong><br>• We refuse all data requests from third-party AI companies<br>• We implement <strong>technical blocking at both robots.txt and HTTP header levels</strong> against AI crawlers (GPTBot, CCBot, etc.)<br><br><strong>Why this policy?</strong><br>ikimon\'s data represents the precious observations of citizens who went out into nature and invested their time and effort to create these records. Consuming these as AI training material would be a betrayal of our contributors\' dedication.<br><br><a href="about.php" class="text-[var(--color-primary)] underline">Read about ikimon\'s data ethics →</a>',

        'e4_q' => 'Can I delete my data?',
        'e4_a' => 'Yes. You can delete your posted data at any time.<br><br><strong>How to delete:</strong><br>• <strong>Individual deletion</strong>: Use the "Delete" button on each observation\'s detail page to remove records one at a time<br>• <strong>Bulk deletion</strong>: Go to My Page → Settings → Data Management to delete all your posts at once<br><br><strong>After deletion:</strong><br>• Deleted records are completely removed from the database<br>• Photo files are also deleted from the server<br>• Identification comments from other users are removed along with the original record<br>• Once deleted, data cannot be recovered<br><br>If you wish to <strong>delete your entire account</strong>, please contact <a href="mailto:contact@ikimon.life" class="text-[var(--color-primary)] underline">contact@ikimon.life</a>.',

        'e5_q' => 'Is data shared with other platforms?',
        'e5_a' => '<strong>Currently, all data is managed exclusively within ikimon.</strong><br><br><strong>Future plans:</strong><br>• We are considering future integration with GBIF (Global Biodiversity Information Facility), an international scientific database that aggregates data from natural history museums and citizen science platforms worldwide<br>• If integration is implemented, <strong>users will be notified in advance</strong> and given the option to opt out (exclude their data from sharing)<br>• Data is <strong>never shared</strong> with SNS platforms or for corporate advertising purposes<br><br>For questions about data sharing practices, please contact <a href="mailto:contact@ikimon.life" class="text-[var(--color-primary)] underline">contact@ikimon.life</a>.',
    ],
];
