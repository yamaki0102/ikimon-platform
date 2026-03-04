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
    ],

    // BioUtils Status
    'status' => [
        'research_grade' => 'Research Grade',
        'suggested' => 'Suggested',
        'needs_id' => 'Needs ID',
        'expert_review' => 'Expert Review',
        'casual' => 'Casual',
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
        'a3_a' => '<strong>All features are completely free for citizens.</strong> There are no upload limits, and there are no "premium features" locked behind a paywall.<br><br>For businesses and government agencies, we offer paid plans that include site monitoring, TNFD/LEAP-aligned automated report generation, BIS (Biodiversity Index Score) analysis, and other specialized features.<br><br><a href="for-business.php" class="text-[var(--color-primary)] underline">View plans for businesses & government →</a>',

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
        'b4_a' => '<strong>Create a separate record for each species.</strong><br><br><strong>Example: During a walk in the park you spot:</strong><br>• A great tit → Record #1<br>• A swallowtail butterfly → Record #2<br>• A dandelion → Record #3<br><br>Posting them as separate records makes each one useful for distribution data by species.<br><br><strong>Multiple individuals of the same species:</strong><br>Record one representative individual and note the count in the description — e.g., "About 5 individuals seen at same location." You don\'t need to post every single one.<br><br><strong>Flocks or swarms:</strong><br>If you encounter a large group (like a flock of starlings), a photo of the whole group plus an estimated count (e.g., "Flock of ~30 birds") works as a single record.',

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
        'c4_a' => 'Research Grade is ikimon\'s <strong>highest data quality status</strong>.<br><br><strong>Requirements for Research Grade:</strong><br>• ✅ At least one photo is attached<br>• ✅ Observation date is recorded<br>• ✅ Location data is recorded<br>• ✅ <strong>Two or more users agree on the same species name</strong><br>• ✅ The observation is of a wild organism (not captive)<br><br><strong>What is Research Grade data used for?</strong><br>• May be cited as foundational data in scientific research papers<br>• Used for corporate environmental assessments (TNFD/30by30 compliance)<br>• Contributes to improving regional biodiversity maps<br>• Serves as reference material for national and local conservation plans<br><br>That ladybug you found in your garden? If it reaches Research Grade, it\'s legitimate scientific data.',

        'c5_q' => 'Can I help identify species?',
        'c5_a' => '<strong>Yes — anyone can participate!</strong> This is one of ikimon\'s most important features.<br><br><strong>How to participate:</strong><br>1. Go to the "ID Workbench" in the navigation<br>2. You\'ll see a list of records that still need identification (Needs ID)<br>3. Look at the photos and suggest a species name to the best of your knowledge<br>4. Broad categories like "Order Lepidoptera" or "Family Asteraceae" are welcome<br><br><strong>Still okay for beginners?</strong><br>Absolutely. Even "I\'m not sure, but it looks like a ___" is helpful. Your suggestion can prompt an expert to provide a more detailed identification.<br><br><strong>Benefits of participating in identification:</strong><br>• Sharpens your observation skills and knowledge<br>• Your contribution score (ID score) is reflected in your profile<br>• Creates a cycle of shared knowledge as others thank you for your help<br><br>ikimon\'s identification community runs on a <strong>culture of mutual learning</strong>. Start with the organisms you know best.',

        'c6_q' => 'How is free-text like the notes field linked to scientific species names in the database?',
        'c6_a' => 'In ikimon, user free text is not stored as-is for species tracking. Instead, we have a system that accumulates records as <strong>standardized data compliant with global taxonomy</strong>. This works through three connected mechanisms: "Taxon Suggestion", "AI Assistance", and "Community Consensus".<br><br><strong>1. Taxon Suggestion</strong><br>When typing a name to post or suggest an identification, you aren\'t just typing text. The system <strong>searches our Taxonomy database in real-time</strong> and lists standardized candidates (scientific and common names).<br>By selecting a candidate, it is recorded not as a string "Swallowtail", but as clearly defined taxon data (including scientific name, rank, GBIF key, etc.).<br><br><strong>2. AI Assistance</strong><br>When using the "Ask AI" feature, it doesn\'t just return text either. It cross-references its image recognition results with our Taxonomy database and <strong>suggests standardized taxa (usually at the Family level) that exist in the database</strong>. This prevents naming variations.<br><br><strong>3. Community Consensus (WE-Consensus)</strong><br>Even if you start by just writing "Swallowtail butterfly" in your notes, other users will use the Suggestion feature to propose the correct, standardized taxon. Through multiple verifications and WE-Consensus, <strong>a free-text observation note is ultimately elevated into accurate scientific data compliant with Darwin Core standards</strong>.<br><br>Through these mechanisms, naming variations and old scientific names (synonyms) are resolved and organized, resulting in an accumulation of <strong>"clean, structured data"</strong> that researchers and businesses can immediately use for analysis.',

        'c7_q' => 'How does the system resolve species names accurately without relying on AI?',
        'c7_a' => 'ikimon uses a <strong>fast, 3-layer PHP architecture</strong> to resolve biological names into standardized scientific data, entirely without AI inference. This ensures instant performance on standard servers while maintaining strict scientific accuracy.<br><br><strong>The 3-Layer Taxon Resolution:</strong><br>1. <strong>Local Resolver (Ultra-fast):</strong> Checks our built-in curated dictionary containing common names, synonyms, and historical names (like resolving "ブンチョウ" or various regional names instantly).<br>2. <strong>iNaturalist API:</strong> If not found locally, it queries the global iNaturalist database to catch diverse common names across multiple languages.<br>3. <strong>GBIF Backbone Taxonomy:</strong> As a final fallback, it verifies scientific names and synonyms against the official GBIF (Global Biodiversity Information Facility) backbone, ensuring mapping to universally accepted taxon keys.<br><br><strong>Handling Higher Taxa (Genus/Family):</strong><br>When an exact species match isn\'t possible, the system seamlessly handles higher taxonomic ranks (like Genus or Family) by retrieving their structural lineage and storing the corresponding GBIF Key and Rank. This makes sure that even partial identifications (e.g., "A type of butterfly") are scientifically structured.<br><br>All this happens in milliseconds behind the scenes. We rely on verified external databases rather than AI hallucinations, guaranteeing that your observations are accurately linked to global biodiversity networks.',

        // ── F: AI Assist ──────────────────────

        'f1_q' => 'What is "Ask AI"?',
        'f1_a' => '<strong>It\'s an AI assistance feature that suggests possible species based on your photos.</strong><br><br><strong>Key points:</strong><br>• Tap the "Ask AI" button on the recording screen to analyze your photo and get suggestions like "Maybe a member of Family ___?"<br>• AI suggestions are <strong>reference information at the Family level</strong> — not a final species determination<br>• Useful as a <strong>first clue</strong> when you have no idea what group an organism belongs to<br><br><strong>An important design principle:</strong><br>In ikimon, AI suggestions are shown <strong>after</strong> you\'ve formed your own opinion. Research in psychology has shown that seeing an AI answer first can unconsciously bias your judgment (<strong>anchoring effect</strong>).<br><br><strong>Your eyes and knowledge come first. AI is just an assistant.</strong>',

        'f2_q' => 'Is it safe to send my photos for AI analysis?',
        'f2_a' => '<strong>Yes. We protect your privacy to the maximum extent.</strong><br><br><strong>Privacy measures when sending photos:</strong><br>• Photos are <strong>resized to 512 pixels</strong> before sending (original high-resolution photos are never sent to AI)<br>• <strong>EXIF data (GPS coordinates, device info) is completely stripped</strong> before AI analysis<br>• AI analysis is <strong>real-time only</strong> — photos are not stored by the AI service<br>• We use <strong>Google Gemini Flash</strong>, and under Google\'s enterprise API terms, submitted data is not used for AI training<br><br><strong>In short:</strong> The AI only sees "a small photo of a living thing with no location data." Your privacy is protected.<br><br><a href="about.php" class="text-[var(--color-primary)] underline">Read about ikimon\'s data ethics →</a>',

        'f3_q' => 'What happens when there\'s no signal in the field?',
        'f3_a' => '<strong>Your observations can still be saved. Only the AI feature is temporarily unavailable.</strong><br><br><strong>How it works offline:</strong><br>• <strong>Recording</strong>: Photos and records are automatically saved on your device and uploaded when connectivity returns<br>• <strong>AI suggestions</strong>: The "Ask AI" button is grayed out with a "📵 Unavailable offline" message<br>• <strong>When back online</strong>: A notification appears: "📡 Back online! Want to ask AI?"<br><br><strong>ikimon\'s design principle:</strong><br>ikimon is a tool for the field — mountains, forests, rivers, coastlines. <strong>Being offline is not an exception; it\'s the norm.</strong> Your observation records are just as valuable without AI.<br><br>The most remarkable wildlife often lives where there\'s no signal.',

        'f4_q' => 'How accurate are the AI suggestions?',
        'f4_a' => '<strong>They\'re designed as reference information. They are not 100% accurate.</strong><br><br><strong>What AI is good at:</strong><br>• Identifying broad taxonomic groups ("This is a butterfly," "This is a beetle")<br>• Recognizing organisms with distinctive features (common species like ladybugs, dandelions)<br>• Offering multiple candidates as "hints"<br><br><strong>What AI struggles with:</strong><br>• Distinguishing closely related species (e.g., Cabbage White vs. Veined White butterflies)<br>• Identifying larvae, winter buds, seeds, and other morphologically different life stages<br>• Rare species or regional endemics (limited training data)<br>• Low-quality photos (blurry, backlit, distant)<br><br><strong>That\'s why community knowledge is essential:</strong><br>AI points the direction; you and the community confirm the answer. This <strong>"AI suggests → Humans confirm" relay</strong> is what maintains ikimon\'s data quality.',

        'f5_q' => 'What if the AI suggests the wrong name?',
        'f5_a' => '<strong>No problem at all. AI suggestions are "hints" and are never recorded as identifications.</strong><br><br><strong>Safety by design:</strong><br>• AI suggestions are <strong>visible only to you</strong> as reference information. Other users cannot see them<br>• AI-suggested names are <strong>never automatically registered</strong> as identifications on a record<br>• If you think a suggestion is wrong, simply ignore it<br>• Even if you agree with an AI suggestion, <strong>you</strong> are the one who ultimately enters and confirms the species name<br><br><strong>Why this design?</strong><br>Research on AI image recognition has shown that showing AI answers first can cause people to over-rely on them (<strong>automation bias</strong>). ikimon values your observation skills and judgment above all, so AI remains <strong>strictly a supporting role</strong>.<br><br>Don\'t be afraid of making mistakes. Discovery often begins with getting things wrong.',

        // ── D: Business ──────────────────────

        'd1_q' => 'Can TNFD reports be auto-generated?',
        'd1_a' => 'Yes. From ikimon\'s <strong>Site Dashboard</strong>, you can auto-generate TNFD-aligned analysis reports in PDF format with one click.<br><br><strong>What\'s included in the report:</strong><br>• <strong>LEAP analysis</strong> (Locate, Evaluate, Assess, Prepare) — structured across all 4 phases<br>• BIS (Biodiversity Index Score) calculation results<br>• Confirmed species list (scientific names, common names, record counts, with photos)<br>• Red list species (national + prefectural) highlights<br>• Monthly trend charts (species count and record volume over time)<br>• Data quality grade distribution<br><br><strong>Use cases:</strong><br>• Annual sustainability report inclusion<br>• Environmental information disclosure to investors and financial institutions<br>• ISO 14001 environmental management foundational data<br><br><a href="for-business.php" class="text-[var(--color-primary)] underline">See enterprise features in detail →</a>',

        'd2_q' => 'What is BIS (Biodiversity Index Score)?',
        'd2_a' => 'BIS (Biodiversity Index Score) is ikimon\'s proprietary <strong>score that quantifies biodiversity at a survey site</strong>.<br><br><strong>Evaluation axes (3 dimensions):</strong><br>• <strong>Species diversity</strong>: Number of confirmed species and evenness (not dominated by a single species)<br>• <strong>Data quality</strong>: Research Grade ratio, number of photos, location precision<br>• <strong>Conservation importance</strong>: Presence of red list species and regionally endemic species<br><br><strong>How to use the score:</strong><br>• <strong>Quantitatively compare</strong> biodiversity across multiple sites<br>• <strong>Monitor changes over time</strong> monthly or annually to measure the effect of environmental initiatives<br>• Visualize increases or decreases in biodiversity compared to baseline surveys<br><br>BIS turns the hard-to-explain concept of "biodiversity matters" into <strong>a number your stakeholders can understand</strong>.',

        'd3_q' => 'Is the data accurate and reliable?',
        'd3_a' => 'Yes. ikimon ensures scientific reliability through <strong>multiple quality assurance layers</strong>.<br><br><strong>Quality management system:</strong><br>• <strong>Community consensus</strong>: Species names are confirmed by agreement from multiple users (not a single opinion)<br>• <strong>Research Grade certification</strong>: Highest-quality data with photos, location, date, and species consensus all verified<br>• <strong>Expert review</strong>: High-difficulty identifications are reviewed by experienced users<br>• <strong>Data quality grades</strong>: Each record is automatically assigned a quality rating from A to E<br>• <strong>GBIF-compliant</strong>: Metadata standards aligned with the Global Biodiversity Information Facility<br><br><strong>Known limitations:</strong><br>Citizen science data differs from comprehensive ecological surveys by specialists. Bias (e.g., more records in urban areas) and gaps exist. Reports include data volume and quality grade distribution for <strong>transparent reporting that acknowledges data limitations</strong>.',

        'd4_q' => 'How much does it cost?',
        'd4_a' => 'Pricing is <strong>customized based on scale and requirements</strong>.<br><br><strong>Factors that affect pricing:</strong><br>• Number of monitoring sites<br>• Report generation frequency (monthly / quarterly / annually)<br>• Customization needs (custom indicators, integration with existing systems, etc.)<br>• Whether field survey coordination support is needed<br><br>Start with a <strong>free demo</strong> to see the actual dashboard and report quality for yourself.<br><br><a href="for-business.php" class="text-[var(--color-primary)] underline">Contact us / Request a demo →</a>',

        'd5_q' => 'Can I view data only for my property?',
        'd5_a' => 'Yes. The <strong>"Site Registration" feature</strong> lets you view and analyze data exclusively within a specific area.<br><br><strong>Setup steps:</strong><br>1. From the Site Dashboard, select "Register New Site"<br>2. Upload your property boundaries in GeoJSON format (or draw them manually on the map)<br>3. Enter the site name and administrator info, then save<br><br>Once registered, ikimon will automatically generate <strong>species lists, BIS scores, and reports</strong> based only on observation data recorded within that site. You can register and compare multiple sites.<br><br>If you need help preparing GeoJSON data, contact us and we\'ll assist you.',

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
