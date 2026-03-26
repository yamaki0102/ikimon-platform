<?php
/**
 * Affiliate Click Tracker + Redirect
 *
 * GET /api/affiliate/click.php?b={bookId}&s={shop}&ctx={context}&t={taxonSlug}
 *
 * 1. クリックを記録
 * 2. ショップ URL にリダイレクト
 */
require_once __DIR__ . '/../../../config/config.php';
require_once __DIR__ . '/../../../libs/AffiliateManager.php';

$bookId    = $_GET['b']   ?? '';
$shop      = $_GET['s']   ?? '';
$context   = $_GET['ctx'] ?? '';
$taxonSlug = $_GET['t']   ?? '';

// バリデーション
$allowedShops = ['amazon', 'rakuten', 'yahoo'];
if (!$bookId || !in_array($shop, $allowedShops, true)) {
    http_response_code(400);
    echo 'Bad request';
    exit;
}

// クリック記録
AffiliateManager::recordClick($bookId, $shop, $context, $taxonSlug);

// リダイレクト先 URL 取得
$url = AffiliateManager::getShopUrl($bookId, $shop);

// 302 リダイレクト
header('Location: ' . $url, true, 302);
header('Cache-Control: no-cache, no-store');
exit;
