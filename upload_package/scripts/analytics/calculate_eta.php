<?php
$file = 'data/library/distilled_knowledge.json';
if (!file_exists($file)) die("File not found\n");
$data = json_decode(file_get_contents($file), true);

$extractedDates = [];
$counts = ['total' => 0, 'extracted' => 0, 'pending' => 0];

foreach ($data as $item) {
    $counts['total']++;
    if (isset($item['distillation_status'])) {
        $counts[$item['distillation_status']]++;
    }
    if (isset($item['last_distilled_at']) && $item['distillation_status'] === 'extracted') {
        $extractedDates[] = strtotime($item['last_distilled_at']);
    }
}

print_r($counts);

if (count($extractedDates) > 2) {
    sort($extractedDates);
    $first = $extractedDates[0];
    $last = $extractedDates[count($extractedDates) - 1];
    $diff = $last - $first;
    if ($diff > 0) {
        $ratePerSecond = count($extractedDates) / $diff;
        $ratePerHour = $ratePerSecond * 3600;
        $ratePerDay = $ratePerSecond * 86400;
        echo "\nProcessing Speed:\n";
        echo sprintf("Species per hour: %.2f\n", $ratePerHour);
        echo sprintf("Species per day: %.2f\n", $ratePerDay);

        $remaining = $counts['total'] - $counts['extracted'];
        $daysRemaining = $remaining / $ratePerDay;
        echo sprintf("\nEstimated time remaining for %d species: %.2f days\n", $remaining, $daysRemaining);
    }
}
