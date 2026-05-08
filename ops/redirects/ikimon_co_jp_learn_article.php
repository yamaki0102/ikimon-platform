<?php
declare(strict_types=1);

$redirects = [
    '01_fundamentals/biodiversity-basics' => 'https://ikimon.life/ja/learn/biodiversity',
    '01_fundamentals/ecosystem-services' => 'https://ikimon.life/ja/learn/biodiversity',
    '01_fundamentals/nature-positive' => 'https://ikimon.life/ja/learn/biodiversity',
    '02_international-policy/global-biodiversity-framework' => 'https://ikimon.life/ja/learn/policy-and-business',
    '02_international-policy/gbf-target-3-30by30' => 'https://ikimon.life/ja/learn/policy-and-business',
    '02_international-policy/tnfd-basics' => 'https://ikimon.life/ja/learn/policy-and-business',
    '03_japan-policy/japan-30by30' => 'https://ikimon.life/ja/learn/policy-and-business',
    '03_japan-policy/nature-symbiosis-sites' => 'https://ikimon.life/ja/learn/policy-and-business',
    '03_japan-policy/biodiversity-hotspots-japan' => 'https://ikimon.life/ja/learn/biodiversity',
    '04_business-economy/natural-capital-accounting' => 'https://ikimon.life/ja/learn/policy-and-business',
    '04_business-economy/biodiversity-credits' => 'https://ikimon.life/ja/learn/policy-and-business',
    '04_business-economy/corporate-nature-strategy' => 'https://ikimon.life/ja/learn/policy-and-business',
    '05_citizen-science/citizen-science-basics' => 'https://ikimon.life/ja/learn/citizen-science',
    '05_citizen-science/community-monitoring' => 'https://ikimon.life/ja/learn/citizen-science',
    '05_citizen-science/data-quality' => 'https://ikimon.life/ja/learn/methodology',
    '06_wellbeing/biophilia' => 'https://ikimon.life/ja/learn/wellbeing',
    '06_wellbeing/nature-wellbeing' => 'https://ikimon.life/ja/learn/wellbeing',
    '06_wellbeing/one-health' => 'https://ikimon.life/ja/learn/wellbeing',
    '07_technology/ai-identification' => 'https://ikimon.life/ja/learn/technology',
    '07_technology/edna' => 'https://ikimon.life/ja/learn/technology',
    '07_technology/remote-sensing' => 'https://ikimon.life/ja/learn/technology',
];

$category = isset($_GET['category']) ? (string) $_GET['category'] : '';
$slug = isset($_GET['slug']) ? (string) $_GET['slug'] : '';
$key = $category . '/' . $slug;
$target = $redirects[$key] ?? 'https://ikimon.life/ja/learn';

header('Location: ' . $target, true, 301);
header('X-Redirect-By: ikimon.life-migration');
exit;
