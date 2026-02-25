<?php
$html = file_get_contents('https://ikimon.life/?nc=' . time());
if ($html === false) {
    echo "FETCH FAILED\n";
    exit(1);
}

preg_match_all('/<script(?![^>]*src)[^>]*>/', $html, $matches);
echo "Inline script tags found: " . count($matches[0]) . "\n";
echo "---\n";
foreach ($matches[0] as $i => $tag) {
    echo ($i + 1) . ": " . $tag . "\n";
}
echo "---\n";

$nonceCount = preg_match_all('/nonce="[^"]*"/', $html, $nonceMatches);
echo "Nonce attributes in HTML: " . $nonceCount . "\n";
if ($nonceCount > 0) {
    echo "Sample: " . $nonceMatches[0][0] . "\n";
}
