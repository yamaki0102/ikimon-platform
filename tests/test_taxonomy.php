<?php

/**
 * TaxonData & TaxonSearchService の手動テストスクリプト
 * PHPUnit なし環境で動作確認用
 * 
 * Usage: php tests/test_taxonomy.php
 */

// Bootstrap — config.php の DATA_DIR を定義するため
require_once __DIR__ . '/../upload_package/config/config.php';
require_once __DIR__ . '/../upload_package/libs/TaxonData.php';
require_once __DIR__ . '/../upload_package/libs/TaxonSearchService.php';

$pass = 0;
$fail = 0;
$tests = [];

function check(string $label, $expected, $actual): void
{
    global $pass, $fail, $tests;
    $ok = ($expected === $actual);
    if ($ok) {
        $pass++;
    } else {
        $fail++;
    }
    $mark = $ok ? 'PASS' : 'FAIL';
    $exp = is_array($expected) ? json_encode($expected) : var_export($expected, true);
    $act = is_array($actual) ? json_encode($actual) : var_export($actual, true);
    $tests[] = "$mark | $label" . ($ok ? '' : " | expected=$exp | actual=$act");
}

echo "=== TaxonData Tests ===\n";

// 1: fromResolver basic
$data = [
    'slug' => 'papilio-xuthus',
    'accepted_name' => 'Papilio xuthus',
    'gbif_key' => 1936018,
    'ja_name' => 'アゲハチョウ',
];
$td = TaxonData::fromResolver($data);
check('fromResolver.slug', 'papilio-xuthus', $td->slug);
check('fromResolver.scientificName', 'Papilio xuthus', $td->scientificName);
check('fromResolver.rank', 'species', $td->rank);
check('fromResolver.gbifKey', 1936018, $td->gbifKey);
check('fromResolver.source', 'local', $td->source);
check('fromResolver.confidence', 1.0, $td->confidence);
check('fromResolver.ja_name', 'アゲハチョウ', $td->commonNames['ja'] ?? '');

// 2: fromINat
$inat = [
    'id' => 47219,
    'name' => 'Papilio xuthus',
    'rank' => 'species',
    'preferred_common_name' => 'アゲハチョウ',
    'english_common_name' => 'Asian Swallowtail',
    'default_photo' => ['square_url' => 'https://example.com/photo.jpg'],
    'ancestors' => [
        ['rank' => 'kingdom', 'name' => 'Animalia'],
        ['rank' => 'order', 'name' => 'Lepidoptera'],
        ['rank' => 'family', 'name' => 'Papilionidae'],
    ],
];
$td2 = TaxonData::fromINat($inat);
check('fromINat.scientificName', 'Papilio xuthus', $td2->scientificName);
check('fromINat.inatTaxonId', 47219, $td2->inatTaxonId);
check('fromINat.source', 'inat', $td2->source);
check('fromINat.ja_name', 'アゲハチョウ', $td2->commonNames['ja'] ?? '');
check('fromINat.en_name', 'Asian Swallowtail', $td2->commonNames['en'] ?? '');
check('fromINat.thumbnailUrl', 'https://example.com/photo.jpg', $td2->thumbnailUrl);
check('fromINat.lineage.kingdom', 'Animalia', $td2->lineage['kingdom'] ?? '');
check('fromINat.lineage.order', 'Lepidoptera', $td2->lineage['order'] ?? '');

// 3: fromGBIF
$gbif = [
    'key' => 5231190,
    'canonicalName' => 'Papilio xuthus',
    'rank' => 'SPECIES',
    'kingdom' => 'Animalia',
    'family' => 'Papilionidae',
];
$td3 = TaxonData::fromGBIF($gbif);
check('fromGBIF.scientificName', 'Papilio xuthus', $td3->scientificName);
check('fromGBIF.gbifKey', 5231190, $td3->gbifKey);
check('fromGBIF.rank', 'species', $td3->rank);
check('fromGBIF.source', 'gbif', $td3->source);

// 4: toObservationTaxon backward compat
$obs = $td->toObservationTaxon();
check('toObsTaxon.has_id', true, array_key_exists('id', $obs));
check('toObsTaxon.has_name', true, array_key_exists('name', $obs));
check('toObsTaxon.has_scientific_name', true, array_key_exists('scientific_name', $obs));
check('toObsTaxon.has_slug', true, array_key_exists('slug', $obs));
check('toObsTaxon.has_rank', true, array_key_exists('rank', $obs));
check('toObsTaxon.has_source', true, array_key_exists('source', $obs));
check('toObsTaxon.name_is_ja', 'アゲハチョウ', $obs['name']);

// 5: toSearchResult
$sr = $td2->toSearchResult();
check('toSearchResult.has_slug', true, array_key_exists('slug', $sr));
check('toSearchResult.source', 'inat', $sr['source']);
check('toSearchResult.has_confidence', true, array_key_exists('confidence', $sr));

echo "\n=== TaxonSearchService Tests ===\n";

// normalizeQuery tests
check('normalize.fullwidth', 'Abelia', TaxonSearchService::normalizeQuery('Ａｂｅｌｉａ'));
check('normalize.halfkana', 'カブトムシ', TaxonSearchService::normalizeQuery('ｶﾌﾞﾄﾑｼ'));
check('normalize.trim', 'カブト ムシ', TaxonSearchService::normalizeQuery('  カブト  ムシ  '));
check('normalize.punctuation', 'テスト', TaxonSearchService::normalizeQuery('、テスト。'));
check('normalize.empty', '', TaxonSearchService::normalizeQuery(''));
check('normalize.whitespace_only', '', TaxonSearchService::normalizeQuery('  '));
check('normalize.mixed', 'test テスト', TaxonSearchService::normalizeQuery('　ｔｅｓｔ　ﾃｽﾄ　'));

// search empty
$empty = TaxonSearchService::search('');
check('search.empty', true, empty($empty));

// search returns array
$result = TaxonSearchService::search('テスト');
check('search.returns_array', true, is_array($result));

// Output
echo "\n=== RESULTS ===\n";
foreach ($tests as $t) echo "$t\n";
echo "\nPASS=$pass FAIL=$fail TOTAL=" . ($pass + $fail) . "\n";
exit($fail > 0 ? 1 : 0);
