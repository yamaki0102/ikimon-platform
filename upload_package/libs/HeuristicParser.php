<?php
/**
 * HeuristicParser - AI-driven table extraction
 * Auto-detects Red List data patterns without CSS selectors.
 */

class HeuristicParser {
    public static function parse($html) {
        // Suppress warnings for malformed HTML
        $dom = new DOMDocument();
        @$dom->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
        $xpath = new DOMXPath($dom);

        $tables = $xpath->query('//table');
        $bestData = [];
        $maxScore = 0;

        foreach ($tables as $table) {
            $result = self::analyzeTable($table, $xpath);
            if ($result['score'] > $maxScore) {
                $maxScore = $result['score'];
                $bestData = $result['rows'];
            }
        }

        return $bestData;
    }

    private static function analyzeTable($table, $xpath) {
        $rows = $xpath->query('.//tr', $table);
        $dataRows = [];
        $score = 0;

        // Detect column indices based on first few rows
        // Simple heuristic: 
        // - SciName: mostly latin, 2+ words
        // - Rank: Short caps (CR, EN, VU) commonly
        // - JpName: Japanese chars
        
        $colMap = ['sci' => -1, 'jp' => -1, 'rank' => -1];
        
        // Analyze first 5 valid looking rows to determine columns
        $sampleRows = [];
        $rowCount = 0;
        foreach ($rows as $row) {
            $cols = $xpath->query('.//td', $row);
            if ($cols->length < 2) continue; // Skip headers/empty
            
            // Extract text per column
            $rowTexts = [];
            foreach ($cols as $col) {
                $rowTexts[] = trim($col->textContent);
            }
            $sampleRows[] = $rowTexts;
            $rowCount++;
            if ($rowCount > 5) break; 
        }

        if (empty($sampleRows)) return ['score' => 0, 'rows' => []];

        // Guess Columns
        $numCols = count($sampleRows[0]);
        $scores = array_fill(0, $numCols, ['sci' => 0, 'jp' => 0, 'rank' => 0]);

        foreach ($sampleRows as $r) {
            foreach ($r as $idx => $text) {
                if ($text === '') continue;
                
                // Score Scientific Name (Latin text)
                if (preg_match('/^[A-Za-z\s\(\)\.-]+$/', $text) && strpos($text, ' ') !== false) {
                    $scores[$idx]['sci'] += 2;
                }
                
                // Score Rank (CR, EN, VU, etc.)
                if (preg_match('/^(CR|EN|VU|NT|DD|LP)+$/i', $text)) {
                    $scores[$idx]['rank'] += 3; // High confidence
                }

                // Score Japanese Name
                if (preg_match('/[ぁ-んァ-ヶ一-龠]/u', $text)) {
                    $scores[$idx]['jp'] += 1;
                }
            }
        }

        // Determine best column for each type
        foreach (['sci', 'rank', 'jp'] as $type) {
            $bestCol = -1;
            $highest = 0;
            for ($i = 0; $i < $numCols; $i++) {
                if ($scores[$i][$type] > $highest) {
                    $highest = $scores[$i][$type];
                    $bestCol = $i;
                }
            }
            $colMap[$type] = $bestCol;
        }

        // If we found at least SciName and Rank, or SciName and Jp, it's a good table
        if ($colMap['sci'] === -1 && $colMap['jp'] === -1) return ['score' => 0, 'rows' => []];

        // Extract Data
        foreach ($rows as $row) {
            $cols = $xpath->query('.//td', $row);
            if ($cols->length < 2) continue;

            $item = [];
            // Safe extraction
            if ($colMap['sci'] !== -1 && $cols->item($colMap['sci'])) {
                $item['scientific_name'] = trim($cols->item($colMap['sci'])->textContent);
            }
            if ($colMap['jp'] !== -1 && $cols->item($colMap['jp'])) {
                $item['name'] = trim($cols->item($colMap['jp'])->textContent);
            }
            if ($colMap['rank'] !== -1 && $cols->item($colMap['rank'])) {
                $item['category'] = trim($cols->item($colMap['rank'])->textContent);
            }

            // Validation: Must have at least a name
            if (!empty($item['scientific_name']) || !empty($item['name'])) {
                $dataRows[] = $item;
                $score++;
            }
        }

        return ['score' => $score, 'rows' => $dataRows];
    }
}
