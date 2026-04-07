<?php
/**
 * field_scan.php — 非推奨。field_research.php に統合済み。
 * 2026-03-24: さんぽ統合計画により field_research.php にリダイレクト
 */
$qs = $_SERVER['QUERY_STRING'] ?? '';
$redirect = 'field_research.php?mode=scan' . ($qs !== '' ? '&' . $qs : '');
header('Location: ' . $redirect);
exit;
