<?php

/**
 * 全ページ HTTP 疎通チェック (file_get_contents版)
 * Usage: php tools/page_check.php
 */

$pages = [
    'index.php',
    'explore.php',
    'map.php',
    'post.php',
    'species.php',
    'compass.php',
    'ranking.php',
    'profile.php',
    'profile_edit.php',
    'my_organisms.php',
    'heatmap.php',
    'reference_layer.php',
    'updates.php',
    'login.php',
    'logout.php',
    'oauth_login.php',
    'oauth_callback.php',
    'guidelines.php',
    'id_center.php',
    'id_form.php',
    'id_wizard.php',
    'id_workbench.php',
    'survey.php',
    'my_field_dashboard.php',
    'field_research.php',
    'review_queue.php',
    'events.php',
    'event_detail.php',
    'create_event.php',
    'edit_event.php',
    'corporate_dashboard.php',
    'site_dashboard.php',
    'site_editor.php',
    'showcase.php',
    'showcase_embed.php',
    'csr_showcase.php',
    'for-business.php',
    'for-citizen.php',
    'for-researcher.php',
    'dashboard.php',
    'dev_admin_login.php',
    'about.php',
    'team.php',
    'terms.php',
    'privacy.php',
    'offline.php',
    'sitemap.php',
    '403.php',
    '404.php',
    'observation_detail.php',
];

$base = 'http://localhost:8899/';

foreach ($pages as $p) {
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 5,
            'follow_location' => 0,
            'ignore_errors' => true,
        ]
    ]);

    $body = @file_get_contents($base . $p, false, $ctx);

    // Parse HTTP status from $http_response_header
    $code = 0;
    $redirect = '';
    if (isset($http_response_header)) {
        foreach ($http_response_header as $h) {
            if (preg_match('/^HTTP\/\S+\s+(\d+)/', $h, $m)) {
                $code = (int)$m[1];
            }
            if (preg_match('/^Location:\s*(.+)/i', $h, $m)) {
                $redirect = trim($m[1]);
            }
        }
    }

    $size = $body !== false ? strlen($body) : 0;

    // Check for PHP errors
    $phpErr = '';
    if ($body !== false) {
        if (stripos($body, 'Fatal error') !== false) $phpErr = 'FATAL';
        elseif (stripos($body, 'Parse error') !== false) $phpErr = 'PARSE';
        elseif (preg_match('/\bWarning\b.*?\bon line\b/i', $body)) $phpErr = 'WARN';
    }

    // Title
    $title = '';
    if ($body && preg_match('/<title[^>]*>(.*?)<\/title>/is', $body, $tm)) {
        $title = trim(html_entity_decode(strip_tags($tm[1])));
        if (mb_strlen($title) > 50) $title = mb_substr($title, 0, 47) . '...';
    }

    $icon = match (true) {
        $code === 200 && !$phpErr => '✅',
        $code === 302 || $code === 301 => '↪️',
        $code >= 500 || $phpErr !== '' => '🔴',
        default => '⚠️',
    };

    $line = sprintf("%-3s %3d  %7s  %-35s", $icon, $code, number_format($size) . 'B', $p);
    if ($phpErr) $line .= "  [PHP:{$phpErr}]";
    if ($redirect) $line .= "  → {$redirect}";
    if ($title && !$phpErr && !$redirect) $line .= "  \"{$title}\"";

    echo $line . PHP_EOL;
}

// Summary
echo PHP_EOL . "=== Done ===" . PHP_EOL;
