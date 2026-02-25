<?php

/**
 * Multi-Source Literature Prefetcher v3.0 — 3-Gate Pipeline
 * 
 * GATE 1: GBIF Species Match (種名検証)
 *   - 有効な種/亜種のみ通過、科名・属名・ゴミはスキップ
 *   - canonical name と usageKey を付与
 * 
 * GATE 2: Multi-Source Literature Collection (文献収集)
 *   - Wikidata → 和名解決 + 多言語Wikipedia sitelink取得
 *   - Wikipedia JA (和名で検索)
 *   - Wikipedia EN (フルセクション取得)
 *   - Wikipedia 他言語 (Wikidataのsitelinkから)
 *   - GBIF Species Descriptions
 *   - GBIF Literature
 *   - Semantic Scholar
 *   - Crossref (fallback)
 */

require_once __DIR__ . '/../config/config.php';

$queueFile = DATA_DIR . '/library/extraction_queue.json';

if (!file_exists($queueFile)) {
    echo "Queue file not found. Checked: $queueFile\n";
    exit(1);
}

// === Heartbeat ===
function updateHeartbeat($statusFile, $pid, $name, $status)
{
    if (!file_exists($statusFile)) {
        file_put_contents($statusFile, json_encode([$pid => ['name' => $name, 'status' => $status, 'updated_at' => date('Y-m-d H:i:s')]]));
        return;
    }
    $fp = fopen($statusFile, 'c+');
    if ($fp && flock($fp, LOCK_EX)) {
        clearstatcache(true, $statusFile);
        $sz = filesize($statusFile);
        $data = json_decode($sz > 0 ? fread($fp, $sz) : '', true) ?: [];
        $data[$pid] = ['name' => $name, 'status' => $status, 'updated_at' => date('Y-m-d H:i:s')];
        ftruncate($fp, 0);
        fseek($fp, 0);
        fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
    }
}

$workerStatusFile = DATA_DIR . '/library/worker_heartbeats.json';
$myPid = getmypid();

echo "Starting Multi-Source Literature Prefetcher v3.0 (3-Gate Pipeline)...\n";

// === Helper: safe HTTP GET ===
$httpGet = function (string $url): ?string {
    $ctx = stream_context_create(['http' => [
        'header' => "User-Agent: OmoikaneBot/3.0 (ikimon.life; mailto:admin@ikimon.life)\r\n",
        'timeout' => 15,
    ]]);
    $result = @file_get_contents($url, false, $ctx);
    return $result !== false ? $result : null;
};

// ==========================================
// ATOMIC QUEUE HELPERS
// ==========================================
function atomicClaimPendingItem($queueFile, $myPid)
{
    $fp = fopen($queueFile, 'c+');
    if (!$fp || !flock($fp, LOCK_EX)) return null;
    clearstatcache(true, $queueFile);
    $sz = filesize($queueFile);
    $q = json_decode($sz > 0 ? fread($fp, $sz) : '', true) ?: [];

    $claimedId = null;
    $claimedItem = null;
    foreach ($q as $id => &$item) {
        if (isset($item['status']) && $item['status'] === 'pending') {
            $item['status'] = 'fetching_lit';
            $item['worker_pid'] = $myPid;
            $item['claimed_at'] = date('Y-m-d H:i:s');
            $claimedId = $id;
            $claimedItem = $item;
            break;
        }
    }

    if ($claimedId !== null) {
        ftruncate($fp, 0);
        fseek($fp, 0);
        fwrite($fp, json_encode($q, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        fflush($fp);
    }

    flock($fp, LOCK_UN);
    fclose($fp);

    return $claimedId !== null ? ['id' => $claimedId, 'item' => $claimedItem] : null;
}

function atomicUpdateItem($queueFile, $id, $updates)
{
    $fp = fopen($queueFile, 'c+');
    if (!$fp || !flock($fp, LOCK_EX)) return false;
    clearstatcache(true, $queueFile);
    $sz = filesize($queueFile);
    $q = json_decode($sz > 0 ? fread($fp, $sz) : '', true) ?: [];

    if (isset($q[$id])) {
        foreach ($updates as $k => $v) {
            $q[$id][$k] = $v;
        }
        ftruncate($fp, 0);
        fseek($fp, 0);
        fwrite($fp, json_encode($q, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        fflush($fp);
    }

    flock($fp, LOCK_UN);
    fclose($fp);
    return true;
}

// ==========================================
// MAIN LOOP
// ==========================================
while (true) {
    if (!file_exists($queueFile)) break;

    $claim = atomicClaimPendingItem($queueFile, $myPid);
    if (!$claim) {
        echo "No pending items. Sleeping 10s...\n";
        sleep(10);
        continue;
    }

    $id = $claim['id'];
    $item = $claim['item'];

    $searchTerm = $item['species_name'] ?? $id;
    $scientificName = $item['scientific_name'] ?? '';

    echo "Processing: $searchTerm\n";
    updateHeartbeat($workerStatusFile, $myPid, "Prefetcher", mb_strimwidth($searchTerm, 0, 15, "..."));

    // =============================================
    // GATE 1: GBIF Species Match (種名検証) — fetching_lit の前にチェック
    // =============================================
    $gbifMatchUrl = "https://api.gbif.org/v1/species/match?name=" . urlencode($searchTerm) . "&strict=true";
    $gbifMatchJson = $httpGet($gbifMatchUrl);
    $gbifMatch = $gbifMatchJson ? json_decode($gbifMatchJson, true) : null;

    $matchType = $gbifMatch['matchType'] ?? 'NONE';
    $rank = $gbifMatch['rank'] ?? 'UNKNOWN';
    $usageKey = $gbifMatch['usageKey'] ?? null;
    $canonicalName = $gbifMatch['canonicalName'] ?? $gbifMatch['species'] ?? null;

    if ($matchType === 'NONE' || !in_array($rank, ['SPECIES', 'SUBSPECIES', 'VARIETY', 'FORM'])) {
        echo "  ✗ GATE 1 REJECT: [{$rank}] {$searchTerm} (matchType={$matchType})\n";
        atomicUpdateItem($queueFile, $id, [
            'status' => 'invalid_name',
            'gate1_reason' => "rank={$rank}, matchType={$matchType}"
        ]);
        usleep(100000); // 100ms
        continue;
    }

    // GATE 1 通過 — canonical名とGBIF keyを付与
    echo "  ✓ GATE 1 PASS: [{$rank}] {$canonicalName} (key={$usageKey})\n";
    atomicUpdateItem($queueFile, $id, [
        'gbif_canonical' => $canonicalName,
        'gbif_key' => $usageKey
    ]);

    // 検索にはcanonical nameを優先使用
    $effectiveSearchTerm = $canonicalName ?: $searchTerm;
    if (empty($scientificName) && $canonicalName) {
        $scientificName = $canonicalName;
    }

    // =============================================
    // GATE 2: Multi-Source Literature Collection
    // =============================================
    $collectedTexts = [];
    $sourceCitations = [];
    $specimenRecords = [];
    $japaneseName = '';

    $addText = function (string $source, string $title, string $text, string $url = '') use (&$collectedTexts, &$sourceCitations) {
        $text = strip_tags($text);
        $text = trim($text);
        if (strlen($text) > 50) {
            $collectedTexts[] = ['source' => $source, 'title' => $title, 'text' => $text, 'url' => $url];
            if (!empty($url) && !in_array($url, $sourceCitations)) {
                $sourceCitations[] = $url;
            }
        }
    };

    $searchTermsToTry = [$effectiveSearchTerm];
    if (!empty($gbifMatch['species']) && $gbifMatch['species'] !== $effectiveSearchTerm) {
        $searchTermsToTry[] = $gbifMatch['species']; // Fallback for subspecies/varieties
    }

    foreach ($searchTermsToTry as $currentSearchTerm) {
        if ($currentSearchTerm !== $effectiveSearchTerm) {
            echo "   Fallback to species level: {$currentSearchTerm}\n";
        }

        // --- STEP 0: Wikidata (和名解決 + 多言語sitelink) ---
        $wikiSitelinks = []; // lang => title

        $wdUrl = "https://www.wikidata.org/w/api.php?action=wbsearchentities&search=" . urlencode($currentSearchTerm) . "&language=en&type=item&limit=1&format=json";
        $wdJson = $httpGet($wdUrl);
        if ($wdJson) {
            $wdData = json_decode($wdJson, true);
            $entities = $wdData['search'] ?? [];
            if (!empty($entities)) {
                $qid = $entities[0]['id'] ?? '';
                if ($qid) {
                    $entityUrl = "https://www.wikidata.org/w/api.php?action=wbgetentities&ids={$qid}&props=labels|sitelinks&format=json";
                    $entityJson = $httpGet($entityUrl);
                    if ($entityJson) {
                        $entityData = json_decode($entityJson, true);
                        $entity = $entityData['entities'][$qid] ?? [];

                        if (empty($japaneseName)) {
                            $japaneseName = $entity['labels']['ja']['value'] ?? '';
                        }

                        $sitelinks = $entity['sitelinks'] ?? [];
                        $targetLangs = ['ja', 'en', 'de', 'fr', 'zh', 'ko', 'es', 'it', 'pt', 'ru'];
                        foreach ($targetLangs as $lang) {
                            $siteKey = $lang . 'wiki';
                            if (isset($sitelinks[$siteKey])) {
                                $wikiSitelinks[$lang] = $sitelinks[$siteKey]['title'];
                            }
                        }
                    }
                }
            }
        }

        if ($japaneseName) {
            echo "   Wikidata: {$currentSearchTerm} -> {$japaneseName}\n";
        }
        if (!empty($wikiSitelinks)) {
            echo "   Sitelinks: " . implode(', ', array_keys($wikiSitelinks)) . "\n";
        }

        // --- STEP 1: Wikipedia JA (和名で検索) ---
        $fetchWikiExtract = function (string $lang, string $title, bool $fullArticle = false) use ($httpGet, $addText): bool {
            $params = "action=query&prop=extracts&explaintext=1&titles=" . urlencode($title) . "&format=json";
            if (!$fullArticle) {
                $params .= "&exintro=1";
            }
            $url = "https://{$lang}.wikipedia.org/w/api.php?{$params}";
            $json = $httpGet($url);
            if (!$json) return false;
            $data = json_decode($json, true);
            $found = false;
            foreach (($data['query']['pages'] ?? []) as $pageId => $page) {
                if ($pageId != -1 && !empty($page['extract'])) {
                    $pageUrl = "https://{$lang}.wikipedia.org/wiki/" . urlencode(str_replace(' ', '_', $page['title']));
                    $langUpper = strtoupper($lang);
                    $addText("Wikipedia_{$langUpper}", $page['title'], $page['extract'], $pageUrl);
                    $found = true;
                }
            }
            return $found;
        };

        if (isset($wikiSitelinks['ja'])) {
            $fetchWikiExtract('ja', $wikiSitelinks['ja']);
        } elseif (!empty($japaneseName)) {
            $fetchWikiExtract('ja', $japaneseName);
        } else {
            $fetchWikiExtract('ja', $currentSearchTerm);
        }

        // --- STEP 2: Wikipedia EN (フルセクション取得) ---
        if (isset($wikiSitelinks['en'])) {
            $fetchWikiExtract('en', $wikiSitelinks['en'], true);
        } else {
            $fetchWikiExtract('en', $currentSearchTerm, true);
        }

        // --- STEP 3: Wikipedia 他言語 (sitelinkがある言語) ---
        $otherLangs = array_diff(array_keys($wikiSitelinks), ['ja', 'en']);
        $langCount = 0;
        foreach ($otherLangs as $lang) {
            if ($langCount >= 3) break;
            $fetchWikiExtract($lang, $wikiSitelinks[$lang]);
            $langCount++;
        }

        // --- STEP 4: GBIF Species Descriptions (usageKeyを活用) ---
        if ($usageKey) {
            $dUrl = "https://api.gbif.org/v1/species/{$usageKey}/descriptions?limit=10";
            $dJson = $httpGet($dUrl);
            if ($dJson) {
                $dData = json_decode($dJson, true);
                $dCount = 0;
                foreach (($dData['results'] ?? []) as $dItem) {
                    $dText = $dItem['description'] ?? '';
                    $dSrc = $dItem['source'] ?? 'GBIF';
                    $dPageUrl = "https://www.gbif.org/species/{$usageKey}";
                    $addText('GBIF_Species', $dSrc, $dText, $dPageUrl);
                    $dCount++;
                    if ($dCount >= 3) break;
                }
            }

            $vnUrl = "https://api.gbif.org/v1/species/{$usageKey}/vernacularNames?limit=20";
            $vnJson = $httpGet($vnUrl);
            if ($vnJson) {
                $vnData = json_decode($vnJson, true);
                $vernaculars = [];
                foreach (($vnData['results'] ?? []) as $vn) {
                    $lang = $vn['language'] ?? '';
                    $name = $vn['vernacularName'] ?? '';
                    if ($name) $vernaculars[$lang] = $name;
                }
                if (!empty($vernaculars)) {
                    if (empty($japaneseName) && !empty($vernaculars['jpn'])) {
                        $japaneseName = $vernaculars['jpn'];
                        echo "   GBIF vernacular: {$japaneseName}\n";
                    }
                }
            }
        }

        // --- STEP 5: GBIF Literature ---
        $glUrl = "https://api.gbif.org/v1/literature/search?q=" . urlencode($currentSearchTerm) . "&limit=3";
        $glJson = $httpGet($glUrl);
        if ($glJson) {
            $glData = json_decode($glJson, true);
            foreach (($glData['results'] ?? []) as $paper) {
                $abstract = $paper['abstract'] ?? '';
                $doi = $paper['identifiers']['doi'] ?? ($paper['id'] ?? '');
                $pUrl = $doi ? (str_starts_with($doi, 'http') ? $doi : "https://doi.org/{$doi}") : '';
                $addText('GBIF_Literature', $paper['title'] ?? '', $abstract, $pUrl);
            }
        }

        // --- STEP 6: Semantic Scholar ---
        $s2Url = "https://api.semanticscholar.org/graph/v1/paper/search?query=" . urlencode($currentSearchTerm) . "&fields=title,abstract,year,url&limit=3";
        $s2Json = $httpGet($s2Url);
        if ($s2Json) {
            $s2Data = json_decode($s2Json, true);
            foreach (($s2Data['data'] ?? []) as $paper) {
                $abstract = $paper['abstract'] ?? '';
                $pUrl = $paper['url'] ?? '';
                if (empty($pUrl) && !empty($paper['paperId'])) {
                    $pUrl = "https://www.semanticscholar.org/paper/" . $paper['paperId'];
                }
                $addText('SemanticScholar', $paper['title'] ?? '', $abstract, $pUrl);
            }
        }
        usleep(1100000); // Semantic Scholar rate limit

        // --- STEP 7: Crossref (fallback) ---
        if (count($collectedTexts) < 5) {
            $crUrl = "https://api.crossref.org/works?query=" . urlencode($currentSearchTerm) . "&select=title,abstract,DOI&rows=3";
            $crJson = $httpGet($crUrl);
            if ($crJson) {
                $crData = json_decode($crJson, true);
                foreach (($crData['message']['items'] ?? []) as $paper) {
                    $abstract = $paper['abstract'] ?? '';
                    $title = current($paper['title'] ?? ['']);
                    $doi = $paper['DOI'] ?? '';
                    $pUrl = $doi ? "https://doi.org/{$doi}" : '';
                    $addText('Crossref', $title, $abstract, $pUrl);
                }
            }
        }

        // --- STEP 8: GBIF Specimen Records (博物館標本データ) ---
        if ($usageKey) {
            $spUrl = "https://api.gbif.org/v1/occurrence/search?taxonKey={$usageKey}&basisOfRecord=PRESERVED_SPECIMEN&limit=10";
            $spJson = $httpGet($spUrl);
            if ($spJson) {
                $spData = json_decode($spJson, true);
                foreach (($spData['results'] ?? []) as $sp) {
                    $specimenRecords[] = [
                        'gbif_occurrence_key' => (string)($sp['key'] ?? ''),
                        'institution_code'    => $sp['institutionCode'] ?? '',
                        'collection_code'     => $sp['collectionCode'] ?? '',
                        'catalog_number'      => $sp['catalogNumber'] ?? '',
                        'recorded_by'         => $sp['recordedBy'] ?? '',
                        'event_date'          => $sp['eventDate'] ?? '',
                        'country'             => $sp['country'] ?? '',
                        'locality'            => $sp['locality'] ?? '',
                        'decimal_latitude'    => $sp['decimalLatitude'] ?? null,
                        'decimal_longitude'   => $sp['decimalLongitude'] ?? null,
                    ];
                }
                if (!empty($specimenRecords)) {
                    echo "   Specimens: " . count($specimenRecords) . " museum records found\n";
                }
            }
        }

        // もし十分なテキストが集まっていればループを抜ける（フォールバックに行かない）
        if (count($collectedTexts) > 0) {
            break;
        }
    }

    // =============================================
    // RESULT: Update queue entry
    // =============================================
    $updates = [];

    if (empty($collectedTexts)) {
        echo "  -> No literature found.\n";
        $updates['status'] = 'no_literature';
    } else {
        echo "  -> Found " . count($collectedTexts) . " valid texts from " . count(array_unique(array_column($collectedTexts, 'source'))) . " sources.\n";
        $updates['status'] = 'literature_ready';
        $updates['prefetched_literature'] = $collectedTexts;
        if (!empty($sourceCitations)) {
            $updates['source_citations'] = $sourceCitations;
        }
    }

    if (!empty($japaneseName)) $updates['resolved_ja_name'] = $japaneseName;
    if (!empty($scientificName)) $updates['scientific_name'] = $scientificName;
    if ($canonicalName) $updates['gbif_canonical'] = $canonicalName;
    if ($usageKey) $updates['gbif_key'] = $usageKey;
    if (!empty($specimenRecords)) $updates['specimen_records'] = $specimenRecords;

    atomicUpdateItem($queueFile, $id, $updates);
    usleep(1500000);
}
