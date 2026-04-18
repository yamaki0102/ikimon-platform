<?php

/**
 * Multi-Source Literature Prefetcher v4.0 — SQLite Queue
 *
 * GATE 1: GBIF Species Match (種名検証)
 *   - 有効な種/亜種のみ通過、科名・属名・ゴミはスキップ
 *   - canonical name と usageKey を付与
 *
 * GATE 2: Multi-Source Literature Collection (文献収集)
 *   Wikipedia系 (10言語):
 *     - Wikidata → 和名解決 + 多言語Wikipedia sitelink取得
 *     - Wikipedia JA / EN / 他8言語
 *   GBIF系:
 *     - GBIF Species Descriptions (limit 15)
 *     - GBIF Literature (limit 10)
 *   学術論文 (NEW):
 *     - OpenAlex      200M+論文・無料・要件なし
 *     - PubMed/NCBI   生命科学・タクソノミー連携
 *     - Europe PMC    ライフサイエンス40M+
 *     - J-STAGE       日本語学術論文
 *     - CiNii Research 国内学術論文・学位論文
 *   その他:
 *     - Semantic Scholar (limit 10)
 *     - Crossref (limit 10)
 *     - BHL / EOL
 *     - iNaturalist taxon wiki description
 *
 * v4.0: 学術論文ソース大幅拡張 (OpenAlex/PubMed/EuropePMC/J-STAGE/CiNii追加)
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/ExtractionQueue.php';

$eq = ExtractionQueue::getInstance();

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

echo "Starting Multi-Source Literature Prefetcher v3.1 (SQLite Queue)...\n";

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
// MAIN LOOP
// ==========================================
while (true) {
    $claim = $eq->claimForPrefetch($myPid);
    if (!$claim) {
        echo "No pending items. Sleeping 10s...\n";
        sleep(10);
        continue;
    }

    $speciesName = $claim['species_name'];
    $searchTerm = $speciesName;

    echo "Processing: $searchTerm\n";
    updateHeartbeat($workerStatusFile, $myPid, "Prefetcher", mb_strimwidth($searchTerm, 0, 15, "..."));

    // =============================================
    // GATE 1: GBIF Species Match (種名検証)
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
        $eq->updatePrefetchResult($speciesName, [
            'status' => 'invalid_name',
            'note' => "GATE1 reject: rank={$rank}, matchType={$matchType}"
        ]);
        usleep(100000); // 100ms
        continue;
    }

    // GATE 1 通過
    echo "  ✓ GATE 1 PASS: [{$rank}] {$canonicalName} (key={$usageKey})\n";

    $effectiveSearchTerm = $canonicalName ?: $searchTerm;
    $scientificName = $canonicalName ?: $speciesName;

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
        $searchTermsToTry[] = $gbifMatch['species'];
    }

    foreach ($searchTermsToTry as $currentSearchTerm) {
        if ($currentSearchTerm !== $effectiveSearchTerm) {
            echo "   Fallback to species level: {$currentSearchTerm}\n";
        }

        // --- STEP 0: Wikidata (和名解決 + 多言語sitelink) ---
        $wikiSitelinks = [];

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

        // --- STEP 4: GBIF Species Descriptions ---
        if ($usageKey) {
            $dUrl = "https://api.gbif.org/v1/species/{$usageKey}/descriptions?limit=20";
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
                    if ($dCount >= 15) break;
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
        $glUrl = "https://api.gbif.org/v1/literature/search?q=" . urlencode('"' . $currentSearchTerm . '"') . "&limit=10";
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

        // --- STEP 5b: OpenAlex (200M+論文・無料・最大カバレッジ) ---
        $oaUrl = "https://api.openalex.org/works?filter=title_and_abstract.search:" . urlencode('"' . $currentSearchTerm . '"')
            . "&per_page=10&select=id,title,abstract_inverted_index,doi,publication_year,primary_location"
            . "&mailto=admin@ikimon.life";
        $oaJson = $httpGet($oaUrl);
        if ($oaJson) {
            $oaData = json_decode($oaJson, true);
            foreach (($oaData['results'] ?? []) as $work) {
                $title = $work['title'] ?? '';
                $doi   = $work['doi'] ?? '';
                $pUrl  = $doi ?: ($work['primary_location']['landing_page_url'] ?? '');
                // abstract_inverted_index を平文に復元
                $invIdx = $work['abstract_inverted_index'] ?? [];
                if (!empty($invIdx)) {
                    $words = [];
                    foreach ($invIdx as $word => $positions) {
                        foreach ($positions as $pos) {
                            $words[(int)$pos] = $word;
                        }
                    }
                    ksort($words);
                    $abstract = implode(' ', $words);
                    $addText('OpenAlex', $title, $abstract, $pUrl);
                } elseif (mb_strlen($title) > 50) {
                    $addText('OpenAlex', $title, $title, $pUrl);
                }
            }
        }
        echo "   OpenAlex: " . count(array_filter($collectedTexts, fn($t) => $t['source'] === 'OpenAlex')) . " papers\n";
        usleep(200000);

        // --- STEP 5c: PubMed / NCBI Entrez (生命科学・タクソノミー連携) ---
        $pmSearch = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed"
            . "&term=" . urlencode('"' . $currentSearchTerm . '"[TIAB]')
            . "&retmax=10&retmode=json&usehistory=y"
            . (defined('NCBI_API_KEY') && NCBI_API_KEY ? "&api_key=" . NCBI_API_KEY : '');
        $pmSearchJson = $httpGet($pmSearch);
        if ($pmSearchJson) {
            $pmSearchData = json_decode($pmSearchJson, true);
            $pmIds = $pmSearchData['esearchresult']['idlist'] ?? [];
            if (!empty($pmIds)) {
                $pmFetchUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed"
                    . "&id=" . implode(',', array_slice($pmIds, 0, 10))
                    . "&retmode=text&rettype=abstract"
                    . (defined('NCBI_API_KEY') && NCBI_API_KEY ? "&api_key=" . NCBI_API_KEY : '');
                $pmAbstracts = $httpGet($pmFetchUrl);
                if ($pmAbstracts) {
                    // PubMed plain text abstracts: split on numbered blocks
                    $blocks = preg_split('/\n\d+\. /', "\n" . $pmAbstracts);
                    foreach (array_filter($blocks) as $block) {
                        $lines = explode("\n", trim($block));
                        $pmTitle = trim($lines[0] ?? '');
                        $pmBody  = trim(implode(' ', array_slice($lines, 1)));
                        if (mb_strlen($pmBody) > 50) {
                            $pmUrl = "https://pubmed.ncbi.nlm.nih.gov/?term=" . urlencode($currentSearchTerm);
                            $addText('PubMed', $pmTitle, $pmBody, $pmUrl);
                        }
                    }
                }
            }
        }
        echo "   PubMed: " . count(array_filter($collectedTexts, fn($t) => $t['source'] === 'PubMed')) . " papers\n";
        usleep(350000); // NCBI 3req/sec without key

        // --- STEP 5d: Europe PMC (ライフサイエンス40M+) ---
        $epmcUrl = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
            . "?query=" . urlencode('"' . $currentSearchTerm . '"')
            . "&resultType=core&pageSize=5&format=json&cursorMark=*";
        $epmcJson = $httpGet($epmcUrl);
        if ($epmcJson) {
            $epmcData = json_decode($epmcJson, true);
            foreach (($epmcData['resultList']['result'] ?? []) as $article) {
                $abstract = $article['abstractText'] ?? '';
                $title    = $article['title'] ?? '';
                $doi      = $article['doi'] ?? '';
                $pmid     = $article['pmid'] ?? '';
                $pUrl     = $doi ? "https://doi.org/{$doi}" : ($pmid ? "https://pubmed.ncbi.nlm.nih.gov/{$pmid}/" : '');
                $addText('EuropePMC', $title, $abstract, $pUrl);
            }
        }
        echo "   EuropePMC: " . count(array_filter($collectedTexts, fn($t) => $t['source'] === 'EuropePMC')) . " papers\n";
        usleep(200000);

        // --- STEP 5e: J-STAGE (日本語学術論文) ---
        $jstageUrl = "https://api.jstage.jst.go.jp/searchapi/do?service=3"
            . "&text=" . urlencode($currentSearchTerm)
            . (!empty($japaneseName) ? "+OR+" . urlencode($japaneseName) : '')
            . "&pubyearfrom=2000&count=5";
        $jstageXml = $httpGet($jstageUrl);
        if ($jstageXml) {
            try {
                $jstageData = @simplexml_load_string($jstageXml);
                if ($jstageData) {
                    $ns = $jstageData->getNamespaces(true);
                    $channel = $jstageData->channel ?? null;
                    if ($channel) {
                        foreach (($channel->item ?? []) as $item) {
                            $jTitle    = (string)($item->title ?? '');
                            $jAbstract = (string)($item->description ?? '');
                            $jLink     = (string)($item->link ?? '');
                            if (empty($jAbstract)) $jAbstract = $jTitle;
                            $addText('J-STAGE', $jTitle, $jAbstract, $jLink);
                        }
                    }
                }
            } catch (\Throwable $e) { /* XML parse error */ }
        }
        echo "   J-STAGE: " . count(array_filter($collectedTexts, fn($t) => $t['source'] === 'J-STAGE')) . " papers\n";
        usleep(300000);

        // --- STEP 5f: CiNii Research (国内学術論文・学位論文) ---
        $ciniiQuery = !empty($japaneseName) ? $japaneseName : $currentSearchTerm;
        $ciniiUrl = "https://cir.nii.ac.jp/opensearch/all?q=" . urlencode($ciniiQuery) . "&format=json&count=5";
        $ciniiJson = $httpGet($ciniiUrl);
        if ($ciniiJson) {
            $ciniiData = json_decode($ciniiJson, true);
            foreach (($ciniiData['items'] ?? []) as $item) {
                $cTitle    = $item['title'] ?? ($item['dc:title'] ?? '');
                $cAbstract = $item['description'] ?? ($item['dc:description'] ?? '');
                $cLink     = $item['link'] ?? ($item['@id'] ?? '');
                if (is_array($cTitle)) $cTitle = implode(' ', $cTitle);
                if (empty($cAbstract)) $cAbstract = $cTitle;
                $addText('CiNii', $cTitle, $cAbstract, $cLink);
            }
        }
        echo "   CiNii: " . count(array_filter($collectedTexts, fn($t) => $t['source'] === 'CiNii')) . " papers\n";
        usleep(300000);

        // --- STEP 5g: iNaturalist taxon wiki description ---
        $inatSearchUrl = "https://api.inaturalist.org/v1/taxa?q=" . urlencode($currentSearchTerm) . "&rank=species&per_page=1";
        $inatJson = $httpGet($inatSearchUrl);
        if ($inatJson) {
            $inatData = json_decode($inatJson, true);
            $inatResult = $inatData['results'][0] ?? null;
            if ($inatResult) {
                $wikiDesc = $inatResult['wikipedia_summary'] ?? '';
                $taxonId  = $inatResult['id'] ?? null;
                $inatUrl  = $taxonId ? "https://www.inaturalist.org/taxa/{$taxonId}" : '';
                if (!empty($wikiDesc)) {
                    $addText('iNaturalist', $inatResult['name'] ?? $currentSearchTerm, $wikiDesc, $inatUrl);
                }
                // taxon_summary テキスト
                $taxonDesc = $inatResult['taxon_summary']['summary'] ?? '';
                if (!empty($taxonDesc)) {
                    $addText('iNaturalist_Summary', $inatResult['name'] ?? $currentSearchTerm, $taxonDesc, $inatUrl);
                }
            }
        }
        usleep(200000);

        // --- STEP 6: Semantic Scholar ---
        $s2Url = "https://api.semanticscholar.org/graph/v1/paper/search?query=" . urlencode($currentSearchTerm) . "&fields=title,abstract,year,url&limit=10";
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

        // --- STEP 6b: BHL (Biodiversity Heritage Library) ---
        $bhlSearchUrl = "https://www.biodiversitylibrary.org/api3?op=PublicationSearch&searchterm=" . urlencode($currentSearchTerm) . "&searchtype=C&page=1&apikey=&format=json";
        $bhlJson = $httpGet($bhlSearchUrl);
        if ($bhlJson) {
            $bhlData = json_decode($bhlJson, true);
            $bhlResults = array_slice($bhlData['Result'] ?? [], 0, 3);
            foreach ($bhlResults as $pub) {
                $bhlTitle = $pub['Title'] ?? '';
                $bhlUrl = $pub['BHLUrl'] ?? '';
                // BHL doesn't have abstracts but titles often contain species descriptions
                if (!empty($bhlTitle)) {
                    $addText('BHL', $bhlTitle, $pub['Snippet'] ?? $bhlTitle, $bhlUrl);
                }
            }
        }
        usleep(200000);

        // --- STEP 6c: EOL (Encyclopedia of Life) ---
        $eolSearchUrl = "https://eol.org/api/search/1.0.json?q=" . urlencode($currentSearchTerm) . "&page=1&exact=true";
        $eolJson = $httpGet($eolSearchUrl);
        if ($eolJson) {
            $eolData = json_decode($eolJson, true);
            $eolResults = $eolData['results'] ?? [];
            if (!empty($eolResults)) {
                $eolId = $eolResults[0]['id'] ?? null;
                if ($eolId) {
                    $eolPageUrl = "https://eol.org/api/pages/1.0/{$eolId}.json?details=true&texts_per_page=3";
                    $eolPageJson = $httpGet($eolPageUrl);
                    if ($eolPageJson) {
                        $eolPage = json_decode($eolPageJson, true);
                        foreach (($eolPage['dataObjects'] ?? []) as $obj) {
                            if (($obj['mimeType'] ?? '') === 'text/html' || ($obj['mimeType'] ?? '') === 'text/plain') {
                                $eolText = strip_tags($obj['description'] ?? '');
                                if (mb_strlen($eolText) > 50) {
                                    $addText('EOL', $obj['title'] ?? 'EOL Description', $eolText, "https://eol.org/pages/{$eolId}");
                                }
                            }
                        }
                    }
                }
            }
        }
        usleep(200000);

        // --- STEP 7: Crossref (always) ---
        if (true) {
            $crUrl = "https://api.crossref.org/works?query.bibliographic=" . urlencode('"' . $currentSearchTerm . '"') . "&select=title,abstract,DOI&rows=10";
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

        // --- STEP 8: GBIF Specimen Records ---
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

        // もし十分なテキストが集まっていればループを抜ける
        if (count($collectedTexts) > 0) {
            break;
        }
    }

    // =============================================
    // RESULT: Update SQLite queue entry
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

    if ($usageKey) $updates['gbif_key'] = $usageKey;
    if (!empty($specimenRecords)) $updates['specimen_records'] = $specimenRecords;
    if (!empty($japaneseName)) $updates['note'] = "ja_name: {$japaneseName}";

    $eq->updatePrefetchResult($speciesName, $updates);
    usleep(1500000);
}
