<?php
/**
 * Antigravity Scraper for Red Lists
 * Reads `targets.json`, fetches URL (mocked for now), extracts data, and saves to CSV.
 */

require_once __DIR__ . '/../config/config.php';

// Mock function to simulate fetching HTML since we can't easily scrape real complex sites reliably in this env without DomDocument/Guzzle setup on specific real targets.
// In a real scenario, this would use file_get_contents() or curl.
function fetchUrl($url) {
    // Return a mock HTML for the example target
    if (strpos($url, 'example.com/redlist/shizuoka') !== false) {
        return <<<HTML
<!DOCTYPE html>
<html>
<body>
    <h1>Shizuoka Red List</h1>
    <table class="redlist">
        <thead>
            <tr><th>Name</th><th>Sci Name</th><th>Status</th></tr>
        </thead>
        <tbody>
            <tr class="species-row">
                <td class="japanese-name">カモシカ</td>
                <td class="sci-name">Capricornis crispus</td>
                <td class="status-code">LP</td>
            </tr>
            <tr class="species-row">
                <td class="japanese-name">アカウミガメ</td>
                <td class="sci-name">Caretta caretta</td>
                <td class="status-code">EN</td>
            </tr>
        </tbody>
    </table>
</body>
</html>
HTML;
    } elseif (strpos($url, 'example.com/redlist/hamamatsu') !== false) {
        return <<<HTML
<table>
    <tr><td>トビハゼ</td><td>Periophthalmus modestus</td><td>VU</td></tr>
    <tr><td>コアジサシ</td><td>Sterna albifrons</td><td>EN</td></tr>
</table>
HTML;
    } elseif (strpos($url, 'example.com/redlist/okinawa') !== false) {
        return <<<HTML
<div class="list-item">
    <span class="species_name">ヤンバルクイナ</span>
    <span class="latin_name">Gallirallus okinawae</span>
    <span class="rank">CR</span>
</div>
<div class="list-item">
    <span class="species_name">イリオモテヤマネコ</span>
    <span class="latin_name">Prionailurus bengalensis iriomotensis</span>
    <span class="rank">CR</span>
</div>
HTML;
    } elseif (strpos($url, 'example.com/redlist/unknown') !== false) {
        // A messy table with no clear classes
        return <<<HTML
<html>
<body>
    <h2>Red Data List</h2>
    <table border="1">
        <tr><th>No</th><th>Japanese Name</th><th>Scientific Name</th><th>Category</th><th>Notes</th></tr>
        <tr><td>1</td><td>ニホンウナギ</td><td>Anguilla japonica</td><td>EN</td><td>Important</td></tr>
        <tr><td>2</td><td>メダカ</td><td>Oryzias latipes</td><td>VU</td><td>Common</td></tr>
    </table>
</body>
</html>
HTML;
    } elseif (strpos($url, 'example.com/redlist/saitama') !== false) {
        return "<table><tr><td>ムササビ</td><td>Petaurista leucogenys</td><td>NT</td></tr></table>";
    } elseif (strpos($url, 'example.com/redlist/kyoto') !== false) {
        return "<table><tr><td>オオサンショウウオ</td><td>Andrias japonicus</td><td>VU</td></tr></table>";
    } elseif (strpos($url, 'example.com/redlist/fukuoka') !== false) {
        return "<table><tr><td>カササギ</td><td>Pica pica</td><td>NT</td></tr></table>";
    } elseif (strpos($url, 'example.com/redlist/fukuoka') !== false) {
        return "<table><tr><td>カササギ</td><td>Pica pica</td><td>NT</td></tr></table>";
    } elseif (strpos($url, 'example.com/redlist/town/taketomi-town') !== false) {
        return "<table><tr><td>イリオモテヤマネコ</td><td>Prionailurus bengalensis iriomotensis</td><td>CR</td></tr></table>";
    } elseif (strpos($url, 'municipality-1741-cho') !== false) {
        return "<table><tr><td>サイゴノトカゲ</td><td>Lacerta finalis</td><td>CR</td></tr></table>";
    }
    return "";
}

// Simple DOM Parser helper using Regex for "Low Gravity" environment :)
// In production, use DOMDocument.
function parseHtml($html, $selectors) {
    $rows = [];
    
    // Very naive regex parser for demonstration of "Antigravity" concept
    // Matches content inside the specific class tags
    
    // 1. Find rows? Regex on full HTML is hard. 
    // Let's assume standard DOMDocument availability for PHP 8.2 usually but let's stick to simple regex for this MVP to avoid lib deps.
    // Actually, let's try DOMDocument, standard in PHP.
    
    $dom = new DOMDocument();
    @$dom->loadHTML($html);
    $xpath = new DOMXPath($dom);

    // Convert CSS selector to XPath (Simplistic)
    // "table.redlist tr.species-row" -> "//table[contains(@class,'redlist')]//tr[contains(@class,'species-row')]"
    
    $rowNodes = $xpath->query("//tr[contains(@class, 'species-row')]");
    
    foreach ($rowNodes as $node) {
        $item = [];
        
        // Name
        $nameNode = $xpath->query(".//td[contains(@class, 'japanese-name')]", $node)->item(0);
        $item['name'] = $nameNode ? trim($nameNode->textContent) : '';

        // Sci Name
        $sciNode = $xpath->query(".//td[contains(@class, 'sci-name')]", $node)->item(0);
        $item['scientific_name'] = $sciNode ? trim($sciNode->textContent) : '';

        // Category
        $catNode = $xpath->query(".//td[contains(@class, 'status-code')]", $node)->item(0);
        $item['category'] = $catNode ? trim($catNode->textContent) : '';

        if ($item['name']) {
            $rows[] = $item;
        }
    }
    
    return $rows;
}

// Main Process
$configDir = __DIR__ . '/../data/redlists/configs';
$configFiles = glob($configDir . '/*.json');
$outputDir = __DIR__ . '/../data/redlists';

echo "Starting Scraper (National Scale Architecture)...\n";
echo "Found " . count($configFiles) . " configuration files.\n";

foreach ($configFiles as $configFile) {
    // Skip template
    if (basename($configFile) === '_template.json') continue;

    $targets = json_decode(file_get_contents($configFile), true);
    if (!$targets) {
        echo "Warning: Invalid JSON in " . basename($configFile) . "\n";
        continue;
    }

    foreach ($targets as $target) {
    echo "Target: {$target['name']} ({$target['url']})...\n";
    
    $html = fetchUrl($target['url']);
    if (!$html) {
        echo "  Failed to fetch content.\n";
        continue;
    }
    
    // Load Heuristic Parser
    require_once __DIR__ . '/../libs/HeuristicParser.php';

    $data = [];
    if (isset($target['selectors']) && !empty($target['selectors'])) {
        // Manual Mode
        $data = parseHtml($html, $target['selectors']);
    } else {
        // Autonomous Mode
        echo "  [AI Mode] Analyzing patterns...\n";
        $data = HeuristicParser::parse($html);
    }
    
    echo "  Extracted " . count($data) . " items.\n";
    
    if (count($data) > 0) {
        $csvFile = $outputDir . '/scraped_' . $target['id'] . '.csv';
        $fp = fopen($csvFile, 'w');
        
        // Universal CSV Header
        fputcsv($fp, ['scope', 'authority', 'scientific_name', 'japanese_name', 'code']);
        
        foreach ($data as $row) {
            fputcsv($fp, [
                $target['scope'],
                $target['authority'],
                $row['scientific_name'],
                $row['name'],
                $row['category']
            ]);
        }
        fclose($fp);
        echo "  Saved to " . basename($csvFile) . "\n";
    }
}

echo "Scraping Completed.\n";
