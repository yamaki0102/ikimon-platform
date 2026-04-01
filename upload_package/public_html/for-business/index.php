<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/CspNonce.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/BrandMessaging.php';

Auth::init();
CspNonce::sendHeader();

$isLoggedIn = Auth::isLoggedIn();
$freeCtaHref = $isLoggedIn ? '../post.php' : '../login.php?redirect=post.php';
$freeCtaLabel = $isLoggedIn ? '無料のまま使ってみる' : '無料で始める';
$workspaceCtaHref = $isLoggedIn ? 'create.php' : '../login.php?redirect=for-business/create.php';
$workspaceCtaLabel = $isLoggedIn ? '無料で団体ページを作る' : 'ログインして無料で作る';
$publicCtaHref = 'apply.php';
$regionalMessaging = BrandMessaging::regionalRevitalization();

$meta_title = 'ikimon for Business — 学校・企業・施設の自然観察記録';
$meta_description = $regionalMessaging['business_meta_description'];
$meta_canonical = rtrim(BASE_URL, '/') . '/for-business/';
$meta_image = rtrim(BASE_URL, '/') . '/assets/img/ogp_default.png';

$features = [
    ['icon' => 'map-pin', 'title' => 'スポットと観察会の管理', 'body' => '観察エリアをスポットとして登録し、観察会の開催・参加受付・記録の集約を団体ページでまとめて管理できます。'],
    ['icon' => 'users', 'title' => '参加者との記録共有', 'body' => 'QRコードやリンクから参加者が観察会に参加。投稿した記録は自動的に団体の記録として集まります。'],
    ['icon' => 'file-down', 'title' => '種一覧とレポートの出力', 'body' => '発見種の全リスト、CSV、証跡レポートなど、調査・報告に使う出力はPublicで利用できます。条件に当てはまる自治体には無償提供します。'],
];

$personas = [
    ['label' => '学校・教育機関', 'icon' => 'graduation-cap',
     'title' => '理科の授業や校外観察に',
     'body' => '授業で観察会をやっても、写真や記録がそれぞれの手元に残るだけで終わりがち。ikimon はクラス・学年を横断して記録が集まり、次の授業でも見返せる仕組みを目指しています。',
     'plan' => 'Community → 必要時 Public', 'cta' => '団体ページを作る', 'href' => $workspaceCtaHref, 'tone' => 'tone-edu'],
    ['label' => '消滅可能性自治体・地域団体', 'icon' => 'map',
     'title' => '記録の土台が必要な地域に',
     'body' => '人口減少が進む地域ほど、自然の記録が担当者依存になりやすい。ikimon はまず無料で土台を作り、条件に当てはまる自治体には出力機能も含めて無償で届ける方針です。',
     'plan' => 'Community / 条件により Public 相当も無償', 'cta' => '運営方針を見る', 'href' => '#support-model', 'tone' => 'tone-park'],
    ['label' => '企業・CSR / ESG', 'icon' => 'building-2',
     'title' => '自然共生活動の記録と報告に',
     'body' => '活動の記録を残しつつ、報告や開示にも耐える形で使いたい。企業や大規模自治体向けのPublicを有料にすることで、無料提供の土台ごと継続できる設計にしています。',
     'plan' => 'Public', 'cta' => 'Publicを相談する', 'href' => $publicCtaHref, 'tone' => 'tone-corp'],
];

$outcomes = [
    ['title' => '個人参加者はアカウント取得から', 'body' => 'Personalプランで投稿・同定・イベント参加ができます。参加者への事前準備の負担はありません。', 'icon' => 'user'],
    ['title' => '団体運営はCommunityで完結', 'body' => '法人格不要。団体ページ・スポット登録・観察会の開催・メンバー管理まで無料で使えます。', 'icon' => 'layout-dashboard'],
    ['title' => '出力が必要な時だけPublicへ', 'body' => '種の全リスト、CSV、証跡レポートなどの出力機能は、有料のPublicプランにまとめています。', 'icon' => 'file-down'],
    ['title' => '消滅可能性自治体には無償提供', 'body' => $regionalMessaging['support_policies'][0]['body'], 'icon' => 'heart-handshake'],
    ['title' => '担当者が変わっても記録は残る', 'body' => '団体ページ単位で記録が蓄積されるため、人の入れ替わりに関係なく活動履歴が継続します。', 'icon' => 'archive'],
];

$plans = [
    ['name' => 'Personal', 'price' => '¥0', 'suffix' => '', 'headline' => '個人で観察・同定する', 'desc' => '投稿・同定・図鑑・イベント参加まで無料。', 'features' => ['観察記録の投稿・編集', 'AI同定ヒントと図鑑', 'イベントへの参加'], 'note' => '申込み不要。ずっと無料。', 'cta' => $freeCtaLabel, 'href' => $freeCtaHref, 'variant' => 'free'],
    ['name' => 'Community', 'price' => '¥0', 'suffix' => '', 'headline' => '団体ページを作って運営する', 'desc' => '法人格なしで作成可。観察会の開催まで無料。', 'features' => ['団体ページ・スポット登録・観察会開催', 'メンバー招待・QR参加・ランキング', '観察数・参加人数・発見種数の概要'], 'note' => '学校・地域団体・企業の部署単位でもここから始められます。', 'cta' => $workspaceCtaLabel, 'href' => $workspaceCtaHref, 'variant' => 'community'],
    ['name' => 'Public', 'price' => '¥39,800', 'suffix' => '/ 月', 'headline' => '調査・報告用の出力を使う', 'desc' => $regionalMessaging['public_plan']['description'], 'features' => ['種の全リストと要配慮種の詳細', 'CSV / 証跡JSON / 各種レポート出力', '継続運用サポート'], 'note' => $regionalMessaging['public_plan']['note'], 'cta' => 'Publicを相談する', 'href' => $publicCtaHref, 'variant' => 'public'],
];

$supportPolicies = $regionalMessaging['support_policies'];
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/../components/meta.php'; ?>
    <style nonce="<?= CspNonce::attr() ?>">
        /* ── tokens ── */
        :root {
            --ink: #111827;
            --muted: #6b7280;
            --line: #e5e7eb;
            --green: #059669;
            --green-light: #d1fae5;
            --green-dark: #064e3b;
            --surface: #f9fafb;
            --white: #ffffff;
            --shadow-sm: 0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04);
            --shadow-md: 0 4px 12px rgba(0,0,0,.08);
            --radius-sm: 12px;
            --radius-md: 16px;
            --radius-lg: 20px;
        }
        * { box-sizing: border-box; margin: 0; }

        body { background: var(--white); color: var(--ink); }
        a { color: inherit; text-decoration: none; }

        /* ── layout ── */
        .lp-container { width: min(1140px, 100% - 24px); margin: 0 auto; }

        /* ── header ── */
        .lp-header {
            position: sticky; top: 0; z-index: 50;
            background: rgba(255,255,255,.95);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--line);
        }
        .lp-header-inner {
            min-height: 60px;
            display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .lp-brand { display: inline-flex; align-items: center; gap: 8px; }
        .lp-brand img { transition: transform .3s ease; }
        .lp-brand:hover img { transform: scale(1.05); }
        .lp-brand-text { display: flex; flex-direction: column; line-height: 1.15; }
        .lp-brand-text .lp-brand-name { font-size: 15px; font-weight: 900; letter-spacing: -.03em; color: var(--ink); font-family: var(--font-heading); }
        .lp-brand-text .lp-brand-sub { font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }

        /* nav */
        .lp-nav {
            display: none; align-items: center; gap: 24px;
            font-size: 13px; font-weight: 600; color: var(--muted);
        }
        .lp-nav a:hover { color: var(--ink); }

        /* hamburger */
        .lp-hamburger {
            display: flex; align-items: center; justify-content: center;
            width: 44px; height: 44px; border: none; background: none;
            cursor: pointer; color: var(--ink);
        }
        .lp-hamburger svg { pointer-events: none; }

        /* mobile nav overlay */
        .lp-mobile-nav {
            display: none;
            position: fixed; top: 60px; left: 0; right: 0; bottom: 0;
            z-index: 45;
            background: rgba(255,255,255,.98);
            backdrop-filter: blur(12px);
            padding: 20px;
        }
        .lp-mobile-nav.is-open { display: flex; flex-direction: column; gap: 6px; }
        .lp-mobile-nav a {
            display: flex; align-items: center; gap: 10px;
            padding: 14px 16px; border-radius: var(--radius-sm);
            font-size: 15px; font-weight: 600; color: var(--ink);
            background: var(--surface); border: 1px solid var(--line);
        }
        .lp-mobile-nav a:active { background: #f3f4f6; }
        .lp-mobile-nav .lp-mobile-cta {
            margin-top: 6px; justify-content: center;
            background: var(--green-dark); color: #fff; border-color: transparent;
        }

        /* ── buttons ── */
        .lp-btn-primary, .lp-btn-secondary, .lp-btn-ghost, .lp-nav-cta {
            display: inline-flex; align-items: center; justify-content: center; gap: 7px;
            min-height: 44px; padding: 0 20px; border-radius: 999px;
            font-size: 14px; font-weight: 700; border: none; cursor: pointer;
            transition: opacity .15s ease, transform .15s ease;
        }
        .lp-btn-primary:hover, .lp-nav-cta:hover { opacity: .88; transform: translateY(-1px); }
        .lp-btn-secondary:hover { background: #f3f4f6; }
        .lp-btn-primary, .lp-nav-cta {
            background: var(--green-dark); color: #fff;
        }
        .lp-btn-secondary {
            background: var(--white); color: var(--ink);
            border: 1.5px solid var(--line);
        }
        .lp-btn-ghost { background: transparent; color: var(--muted); min-height: 40px; padding: 0 12px; }

        /* ── hero ── */
        .hero { padding: 48px 0 0; }
        .hero-row {
            display: flex; flex-direction: column; gap: 40px;
        }
        .hero-copy { flex: 1; min-width: 0; padding-bottom: 48px; }
        .pill {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 6px 12px; border-radius: 999px;
            background: var(--green-light); color: var(--green-dark);
            font-size: 12px; font-weight: 700; letter-spacing: .06em;
        }
        .hero-copy h1 {
            margin: 16px 0 14px;
            font-family: var(--font-heading);
            font-size: clamp(30px, 5vw, 52px);
            line-height: 1.1;
            letter-spacing: -.03em;
        }
        .hero-copy h1 em {
            font-style: normal;
            color: var(--green);
        }
        .hero-lead {
            font-size: 16px; line-height: 1.85; color: var(--muted);
        }
        .hero-actions {
            display: flex; flex-direction: column; gap: 10px;
            margin-top: 28px;
        }
        .hero-actions .lp-btn-primary,
        .hero-actions .lp-btn-secondary { width: 100%; }
        .hero-note {
            margin-top: 20px;
            display: flex; flex-wrap: wrap; gap: 16px;
        }
        .hero-note-item {
            display: flex; align-items: center; gap: 6px;
            font-size: 13px; color: var(--muted);
        }
        .hero-note-item i { color: var(--green); flex-shrink: 0; }
        .hero-support {
            margin-top: 18px;
            padding: 16px 18px;
            border-radius: 16px;
            background: linear-gradient(135deg, rgba(6,95,70,.08), rgba(16,185,129,.14));
            border: 1px solid rgba(16,185,129,.22);
        }
        .hero-support strong {
            display: block;
            font-size: 14px;
            font-weight: 800;
            color: var(--green-dark);
        }
        .hero-support p {
            margin-top: 6px;
            font-size: 13px;
            line-height: 1.8;
            color: var(--muted);
        }

        /* hero visual */
        .hero-visual {
            display: none;
            flex: 0 0 460px; max-width: 460px;
            align-self: flex-end;
        }
        .hero-browser {
            border-radius: 12px 12px 0 0;
            overflow: hidden;
            border: 1px solid var(--line);
            border-bottom: none;
            box-shadow: 0 8px 32px rgba(0,0,0,.1);
        }
        .hero-browser-bar {
            height: 36px;
            background: #f1f3f0;
            border-bottom: 1px solid var(--line);
            display: flex; align-items: center; padding: 0 14px; gap: 7px;
        }
        .hero-browser-dot {
            width: 10px; height: 10px; border-radius: 50%;
        }
        .hero-browser-dot:nth-child(1) { background: #ff5f57; }
        .hero-browser-dot:nth-child(2) { background: #febc2e; }
        .hero-browser-dot:nth-child(3) { background: #28c840; }
        .hero-browser-iframe {
            display: block; width: 100%;
            height: 340px; border: none;
            pointer-events: none;
        }

        /* ── section ── */
        .section { padding: 64px 0; }
        .section-tinted { background: var(--surface); }
        .section-label {
            display: inline-block; padding: 5px 10px; border-radius: 6px;
            background: var(--green-light); color: var(--green-dark);
            font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
        }
        .section-head { margin-bottom: 32px; }
        .section-head h2 {
            margin: 12px 0 0;
            font-family: var(--font-heading);
            font-size: clamp(24px, 4vw, 40px);
            line-height: 1.15;
            letter-spacing: -.03em;
        }
        .section-head p {
            margin: 12px 0 0; font-size: 15px; line-height: 1.8; color: var(--muted);
            max-width: 580px;
        }

        /* ── cards ── */
        .card {
            border-radius: var(--radius-md);
            background: var(--white);
            border: 1px solid var(--line);
            box-shadow: var(--shadow-sm);
        }
        .section-tinted .card { background: var(--white); }

        /* grids — mobile: 1 col */
        .grid-3, .grid-2 { display: grid; gap: 16px; }

        /* ── problems ── */
        .problem-card { padding: 24px; }
        .icon-wrap {
            width: 44px; height: 44px;
            display: inline-flex; align-items: center; justify-content: center;
            border-radius: 10px;
            background: var(--green-light); color: var(--green-dark);
        }
        .problem-card h3 { margin: 16px 0 0; font-size: 16px; font-weight: 700; line-height: 1.4; }
        .problem-card p { margin: 8px 0 0; font-size: 14px; line-height: 1.8; color: var(--muted); }

        /* ── personas ── */
        .persona-card { padding: 0; overflow: hidden; }
        .persona-head {
            padding: 20px 22px;
            background: var(--surface);
            border-bottom: 1px solid var(--line);
        }
        .tone-corp { background: var(--surface); }
        .tone-park { background: var(--surface); }
        .persona-tag {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 5px 10px; border-radius: 999px;
            background: var(--white); border: 1px solid var(--line);
            font-size: 11px; font-weight: 700; letter-spacing: .08em; color: var(--muted);
        }
        .persona-head h3 { margin: 12px 0 0; font-size: 16px; font-weight: 700; line-height: 1.45; }
        .persona-body { padding: 20px 22px; }
        .persona-block {
            padding: 14px 16px; border-radius: 10px;
            background: var(--surface); border: 1px solid var(--line);
        }
        .persona-block + .persona-block { margin-top: 10px; }
        .persona-block.dark {
            background: var(--green-dark);
            color: #fff; border-color: transparent;
        }
        .persona-block small { display: block; font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
        .persona-block p { margin: 6px 0 0; font-size: 14px; line-height: 1.75; }
        .persona-block.dark small { color: rgba(255,255,255,.6); }
        .persona-block.dark p { color: rgba(255,255,255,.9); }
        .persona-foot {
            display: flex; flex-direction: column; gap: 12px;
            margin-top: 18px; padding-top: 18px;
            border-top: 1px solid var(--line);
        }
        .persona-foot-meta { display: flex; align-items: center; gap: 8px; }
        .persona-foot-meta strong { font-size: 11px; color: var(--muted); font-weight: 600; }
        .persona-foot-meta span { font-size: 13px; font-weight: 700; color: var(--green-dark); }
        .persona-foot .lp-btn-primary { width: 100%; }

        /* ── outcomes ── */
        .outcome-wrap { display: grid; gap: 16px; }
        .card.summary-card {
            padding: 28px;
            background: var(--green-dark);
            color: #fff;
            border-color: transparent;
            box-shadow: var(--shadow-md);
        }
        .summary-card h3 { margin: 16px 0 0; font-size: 18px; font-weight: 700; line-height: 1.4; }
        .summary-points { margin-top: 20px; display: grid; gap: 8px; }
        .summary-points div {
            display: flex; align-items: flex-start; gap: 10px;
            padding: 12px 14px; border-radius: 10px;
            background: rgba(255,255,255,.1);
            color: rgba(255,255,255,.9);
            font-size: 14px; line-height: 1.65;
        }
        .summary-points div::before {
            content: ''; width: 6px; height: 6px;
            border-radius: 50%; background: #6ee7b7;
            flex-shrink: 0; margin-top: 7px;
        }
        .outcome-card { padding: 22px; }
        .outcome-top { display: flex; align-items: flex-start; gap: 14px; }
        .outcome-badge {
            width: 40px; height: 40px; flex-shrink: 0;
            display: inline-flex; align-items: center; justify-content: center;
            border-radius: 10px;
            background: var(--green-light); color: var(--green-dark);
        }
        .outcome-card small { display: block; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--green); }
        .outcome-card h3 { margin: 4px 0 0; font-size: 16px; font-weight: 700; line-height: 1.3; }
        .outcome-card p { margin: 10px 0 0; font-size: 14px; line-height: 1.75; color: var(--muted); }

        /* ── plans ── */
        .plan-card { padding: 24px; display: flex; flex-direction: column; }
        .plan-community {
            border-color: var(--green);
            box-shadow: 0 0 0 1px var(--green), var(--shadow-md);
        }
        .plan-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .plan-pill, .plan-reco {
            display: inline-flex; align-items: center; gap: 5px;
            padding: 4px 10px; border-radius: 999px;
            font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
        }
        .plan-free .plan-pill { background: var(--surface); color: var(--muted); border: 1px solid var(--line); }
        .plan-community .plan-pill { background: var(--green-light); color: var(--green-dark); }
        .plan-public .plan-pill { background: #f3f4f6; color: var(--ink); border: 1px solid var(--line); }
        .plan-reco { background: var(--green-dark); color: #fff; }
        .price {
            margin-top: 20px;
            font-family: var(--font-heading);
            font-size: 34px; font-weight: 800;
            letter-spacing: -.03em; line-height: 1;
        }
        .price span { font-size: 14px; font-weight: 600; color: var(--muted); letter-spacing: normal; }
        .plan-card h3 { margin: 12px 0 0; font-size: 16px; font-weight: 700; line-height: 1.3; }
        .plan-card > p { margin: 6px 0 0; font-size: 14px; line-height: 1.7; color: var(--muted); }
        .plan-card ul { margin: 18px 0 0; padding: 0; list-style: none; display: grid; gap: 9px; }
        .plan-card li { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; line-height: 1.7; color: var(--muted); }
        .plan-note {
            margin-top: 16px; padding: 12px 14px; border-radius: 10px;
            background: var(--surface); border: 1px solid var(--line);
            font-size: 13px; line-height: 1.7; color: var(--muted);
        }
        .plan-community .plan-note { background: var(--green-light); color: var(--green-dark); border-color: transparent; }
        .plan-card .lp-btn-primary, .plan-card .lp-btn-secondary { width: 100%; margin-top: auto; padding-top: 16px; }
        .plan-card .lp-btn-primary { margin-top: 20px; padding-top: 0; }
        .plan-card .lp-btn-secondary { margin-top: 20px; padding-top: 0; }

        /* ── support model ── */
        .policy-card { padding: 24px; }
        .policy-card h3 { font-size: 17px; font-weight: 800; line-height: 1.45; }
        .policy-card p { margin-top: 10px; font-size: 14px; line-height: 1.8; color: var(--muted); }
        .policy-banner {
            margin-top: 18px;
            padding: 18px 20px;
            border-radius: 16px;
            background: linear-gradient(135deg, rgba(6,95,70,.96), rgba(16,185,129,.92));
            color: #fff;
            box-shadow: var(--shadow-md);
        }
        .policy-banner strong {
            display: block;
            font-size: 16px;
            font-weight: 800;
            line-height: 1.5;
        }
        .policy-banner p {
            margin-top: 8px;
            font-size: 14px;
            line-height: 1.8;
            color: rgba(255,255,255,.82);
        }

        /* ── divider ── */
        .section-divider {
            height: 1px; background: var(--line);
            margin: 0;
        }

        /* ── faq ── */
        .faq-card { padding: 22px; }
        .faq-card strong { display: block; font-size: 15px; font-weight: 700; line-height: 1.5; }
        .faq-card p { margin: 8px 0 0; font-size: 14px; line-height: 1.8; color: var(--muted); }

        /* ── closing ── */
        .closing {
            margin-top: 24px; padding: 36px 28px;
            border-radius: var(--radius-lg);
            background: var(--green-dark);
            color: #fff;
            box-shadow: var(--shadow-md);
        }
        .closing h2 {
            font-family: var(--font-heading);
            font-size: clamp(22px, 4vw, 38px);
            line-height: 1.15; letter-spacing: -.03em;
        }
        .closing p { margin: 12px 0 0; font-size: 15px; line-height: 1.8; color: rgba(255,255,255,.75); max-width: 560px; }
        .closing-actions {
            display: flex; flex-direction: column; gap: 10px;
            margin-top: 24px;
        }
        .closing-actions .lp-btn-primary,
        .closing-actions .lp-btn-secondary { width: 100%; }
        .closing-actions .lp-btn-primary { background: #fff; color: var(--green-dark); }
        .closing-actions .lp-btn-secondary { background: rgba(255,255,255,.12); color: #fff; border-color: rgba(255,255,255,.2); }

        /* ── mobile sticky CTA ── */
        .mobile-cta-bar {
            display: flex;
            position: fixed; bottom: 0; left: 0; right: 0;
            z-index: 50;
            padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px));
            background: rgba(255,255,255,.97);
            backdrop-filter: blur(12px);
            border-top: 1px solid var(--line);
            box-shadow: 0 -2px 12px rgba(0,0,0,.06);
            gap: 8px;
        }
        .mobile-cta-bar .lp-btn-primary { flex: 1; min-height: 44px; font-size: 14px; }
        .mobile-cta-bar .lp-btn-secondary { min-height: 44px; font-size: 13px; padding: 0 16px; }

        /* spacer so content isn't hidden behind mobile CTA */
        .mobile-cta-spacer { height: 72px; }

        /* ═══════════════════════════════════
           TABLET (640px+)
           ═══════════════════════════════════ */
        @media (min-width: 640px) {
            .lp-container { width: min(1140px, 100% - 32px); }
            .lp-header-inner { min-height: 64px; }

            .hero { padding: 56px 0 0; }
            .hero-copy h1 { font-size: clamp(34px, 4.5vw, 52px); }
            .hero-actions { flex-direction: row; }
            .hero-actions .lp-btn-primary,
            .hero-actions .lp-btn-secondary { width: auto; }

            .section { padding: 72px 0; }
            .grid-2 { grid-template-columns: repeat(2, 1fr); }

            .persona-foot { flex-direction: row; align-items: center; justify-content: space-between; }
            .persona-foot .lp-btn-primary { width: auto; }

            .closing { padding: 40px; }
            .closing-actions { flex-direction: row; }
            .closing-actions .lp-btn-primary,
            .closing-actions .lp-btn-secondary { width: auto; }
        }

        /* ═══════════════════════════════════
           SMALL DESKTOP (860px+)
           ═══════════════════════════════════ */
        @media (min-width: 860px) {
            .lp-nav { display: flex; }
            .lp-hamburger { display: none; }
            .mobile-cta-bar { display: none; }
            .mobile-cta-spacer { display: none; }

            .lp-header-inner { min-height: 68px; }
            .hero-row { flex-direction: row; align-items: flex-end; gap: 48px; }
            .hero-visual { display: flex; flex-direction: column; }
            .grid-3 { grid-template-columns: repeat(3, 1fr); }
            .outcome-wrap { grid-template-columns: 320px minmax(0, 1fr); }
        }

        /* ═══════════════════════════════════
           FULL DESKTOP (1080px+)
           ═══════════════════════════════════ */
        @media (min-width: 1080px) {
            .hero { padding: 56px 0 80px; }
            .section { padding: 80px 0; }
            .plan-card { padding: 28px; }
            .outcome-wrap { grid-template-columns: 360px minmax(0, 1fr); gap: 20px; }
        }
    </style>
</head>
<body class="js-loading bg-base text-text font-body">
    <script nonce="<?= CspNonce::attr() ?>">document.body.classList.remove('js-loading');</script>

    <!-- ── header ── -->
    <header class="lp-header">
        <div class="lp-container lp-header-inner">
            <a href="../" class="lp-brand">
                <img src="/assets/img/icon-192.png" alt="ikimon" style="width:32px;height:32px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.15)">
                <span class="lp-brand-text">
                    <span class="lp-brand-name">ikimon</span>
                    <span class="lp-brand-sub">for Business</span>
                </span>
            </a>
            <nav class="lp-nav">
                <a href="#problems">できること</a>
                <a href="#personas">使われ方</a>
                <a href="#outcomes">プラン設計</a>
                <a href="#plans">料金</a>
                <a href="<?= htmlspecialchars($workspaceCtaHref) ?>" class="lp-nav-cta">団体ページを作る</a>
            </nav>
            <button class="lp-hamburger" aria-label="メニュー" onclick="document.getElementById('mobileNav').classList.toggle('is-open'); this.setAttribute('aria-expanded', document.getElementById('mobileNav').classList.contains('is-open'))">
                <i data-lucide="menu" class="h-5 w-5"></i>
            </button>
        </div>
    </header>

    <!-- mobile nav -->
    <nav id="mobileNav" class="lp-mobile-nav" onclick="if(event.target.tagName==='A'){this.classList.remove('is-open')}">
        <a href="#problems"><i data-lucide="list" class="h-4 w-4"></i>できること</a>
        <a href="#personas"><i data-lucide="users" class="h-4 w-4"></i>使われ方</a>
        <a href="#outcomes"><i data-lucide="layers" class="h-4 w-4"></i>プラン設計</a>
        <a href="#plans"><i data-lucide="credit-card" class="h-4 w-4"></i>料金</a>
        <a href="<?= htmlspecialchars($workspaceCtaHref) ?>" class="lp-mobile-cta"><i data-lucide="sparkles" class="h-4 w-4"></i>団体ページを作る</a>
    </nav>

    <main>
        <!-- ── hero ── -->
        <section class="hero">
            <div class="lp-container">
                <div class="hero-row">
                    <div class="hero-copy">
                        <div class="pill"><i data-lucide="flask-conical" class="h-3 w-3"></i>β版 · 学校・企業・施設向け</div>
                        <h1>観察記録を、<em>チームで続ける。</em></h1>
                        <p class="hero-lead">学校の授業でも、企業の環境活動でも、施設の定期観察会でも。記録がバラバラになって後から使えない、という問題を解決するために作っています。現在β版として公開中ですが、すでに導入や試行は可能です。現場に合わせた運用設計や改善、共同実証の相談も歓迎しています。</p>
                        <div class="hero-support">
                            <strong>消滅可能性自治体には、Public相当の出力機能まで含めて無償提供します。</strong>
                            <p>若年女性減少率80%以上を目安に、最も記録基盤が必要な地域へ優先して届ける方針です。<?= htmlspecialchars($regionalMessaging['support_model_summary']) ?></p>
                        </div>
                        <div class="hero-actions">
                            <a href="<?= htmlspecialchars($workspaceCtaHref) ?>" class="lp-btn-primary"><i data-lucide="sparkles" class="h-4 w-4"></i><?= htmlspecialchars($workspaceCtaLabel) ?></a>
                            <a href="../site_dashboard.php?site=ikan_hq&demo=1" class="lp-btn-secondary"><i data-lucide="monitor-play" class="h-4 w-4"></i>デモを見る</a>
                        </div>
                        <div class="hero-note">
                            <span class="hero-note-item"><i data-lucide="check" class="h-3 w-3"></i>申込み不要</span>
                            <span class="hero-note-item"><i data-lucide="check" class="h-3 w-3"></i>法人格なしで作成可</span>
                            <span class="hero-note-item"><i data-lucide="check" class="h-3 w-3"></i>有料プランはPublicのみ</span>
                            <span class="hero-note-item"><i data-lucide="check" class="h-3 w-3"></i>消滅可能性自治体は無償対象</span>
                        </div>
                    </div>
                    <div class="hero-visual">
                        <div class="hero-browser">
                            <div class="hero-browser-bar">
                                <span class="hero-browser-dot"></span>
                                <span class="hero-browser-dot"></span>
                                <span class="hero-browser-dot"></span>
                            </div>
                            <iframe class="hero-browser-iframe" src="../site_dashboard.php?site=ikan_hq&demo=1" loading="lazy" title="ikimon デモ"></iframe>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- trust-band -->
        <div class="lp-container" style="padding:20px 0">
            <p style="text-align:center;font-size:13px;font-weight:600;color:var(--muted);line-height:1.8;max-width:640px;margin:0 auto">
                PNAS 2026 が示した「保全の答えに変わるデータ基盤」の方向と、ikimon の設計は強く整合しています。
                <a href="../century_archive.php" style="color:var(--green);text-decoration:underline">詳しくは「記録が保全に変わる理由」へ →</a>
            </p>
        </div>
        <div class="section-divider"></div>

        <!-- ── features ── -->
        <section class="section section-tinted" id="problems">
            <div class="lp-container">
                <div class="section-head">
                    <span class="section-label">できること</span>
                    <h2>観察記録の収集から、報告書の出力まで</h2>
                </div>
                <div class="grid-3">
                    <?php foreach ($features as $feature): ?>
                        <article class="card problem-card">
                            <div class="icon-wrap"><i data-lucide="<?= htmlspecialchars($feature['icon']) ?>" class="h-5 w-5"></i></div>
                            <h3><?= htmlspecialchars($feature['title']) ?></h3>
                            <p><?= htmlspecialchars($feature['body']) ?></p>
                        </article>
                    <?php endforeach; ?>
                </div>
            </div>
        </section>

        <!-- ── personas ── -->
        <section class="section" id="personas">
            <div class="lp-container">
                <div class="section-head">
                    <span class="section-label">使われ方</span>
                    <h2>どんな団体を想定しているか</h2>
                </div>
                <div class="grid-3">
                    <?php foreach ($personas as $persona): ?>
                        <article class="card persona-card">
                            <div class="persona-head">
                                <span class="persona-tag"><i data-lucide="<?= htmlspecialchars($persona['icon']) ?>" class="h-4 w-4"></i><?= htmlspecialchars($persona['label']) ?></span>
                                <h3><?= htmlspecialchars($persona['title']) ?></h3>
                            </div>
                            <div class="persona-body">
                                <p style="font-size:14px; line-height:1.8; color:var(--muted)"><?= htmlspecialchars($persona['body']) ?></p>
                                <div class="persona-foot">
                                    <div class="persona-foot-meta">
                                        <strong>プラン:</strong>
                                        <span><?= htmlspecialchars($persona['plan']) ?></span>
                                    </div>
                                    <a href="<?= htmlspecialchars($persona['href']) ?>" class="lp-btn-primary"><?= htmlspecialchars($persona['cta']) ?></a>
                                </div>
                            </div>
                        </article>
                    <?php endforeach; ?>
                </div>
            </div>
        </section>

        <!-- ── outcomes ── -->
        <section class="section section-tinted" id="outcomes">
            <div class="lp-container">
                <div class="section-head">
                    <span class="section-label">仕様</span>
                    <h2>プランの設計について</h2>
                </div>
                <div class="outcome-wrap">
                    <article class="card summary-card">
                        <div class="pill" style="background:rgba(255,255,255,.15); color:#fff; border:1px solid rgba(255,255,255,.25)">概要</div>
                        <h3>個人も団体も、参加・運営まで無料。<br>大規模運用の出力だけを有料に。</h3>
                        <div class="summary-points">
                            <div>個人参加者はPersonalプランで無料</div>
                            <div>団体ページと観察会はCommunityで無料</div>
                            <div>種の全リストとレポート出力はPublicプラン</div>
                            <div>消滅可能性自治体はPublic相当も無償提供</div>
                            <div>担当者が変わっても記録はページに残る</div>
                        </div>
                    </article>
                    <div class="grid-2">
                        <?php foreach ($outcomes as $outcome): ?>
                            <article class="card outcome-card">
                                <div class="outcome-top">
                                    <div class="outcome-badge"><i data-lucide="<?= htmlspecialchars($outcome['icon']) ?>" class="h-5 w-5"></i></div>
                                    <div>
                                        <h3><?= htmlspecialchars($outcome['title']) ?></h3>
                                    </div>
                                </div>
                                <p><?= htmlspecialchars($outcome['body']) ?></p>
                            </article>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>
        </section>

        <!-- ── pricing ── -->
        <section class="section" id="plans">
            <div class="lp-container">
                <div class="section-head">
                    <span class="section-label">料金</span>
                    <h2>3つのプラン</h2>
                    <p>有料プランはPublicのみです。個人参加と団体運営は無料で始められ、条件に当てはまる自治体には Public 相当も無償で提供します。</p>
                </div>
                <div class="grid-3">
                    <?php foreach ($plans as $plan): ?>
                        <article class="card plan-card plan-<?= htmlspecialchars($plan['variant']) ?>">
                            <div class="plan-head">
                                <span class="plan-pill"><?= htmlspecialchars($plan['name']) ?></span>
                                <?php if ($plan['name'] === 'Personal'): ?>
                                    <span class="plan-reco">まずここから</span>
                                <?php endif; ?>
                            </div>
                            <div class="price"><?= htmlspecialchars($plan['price']) ?> <span><?= htmlspecialchars($plan['suffix']) ?></span></div>
                            <h3><?= htmlspecialchars($plan['headline']) ?></h3>
                            <p><?= htmlspecialchars($plan['desc']) ?></p>
                            <ul>
                                <?php foreach ($plan['features'] as $feature): ?>
                                    <li><i data-lucide="check" class="mt-[2px] h-4 w-4 shrink-0 text-primary"></i><span><?= htmlspecialchars($feature) ?></span></li>
                                <?php endforeach; ?>
                            </ul>
                            <div class="plan-note"><?= htmlspecialchars($plan['note']) ?></div>
                            <a href="<?= htmlspecialchars($plan['href']) ?>" class="<?= $plan['name'] === 'Community' ? 'lp-btn-primary' : 'lp-btn-secondary' ?>"><?= htmlspecialchars($plan['cta']) ?></a>
                        </article>
                    <?php endforeach; ?>
                </div>
            </div>
        </section>

        <section class="section section-tinted" id="support-model">
            <div class="lp-container">
                <div class="section-head">
                    <span class="section-label">運営方針</span>
                    <h2>なぜこの料金設計なのか</h2>
                    <p>無料を入口だけの餌にしたくないので、誰から課金し、誰に無償で届けるかを先に決めています。</p>
                </div>
                <div class="grid-3">
                    <?php foreach ($supportPolicies as $policy): ?>
                        <article class="card policy-card">
                            <h3><?= htmlspecialchars($policy['title']) ?></h3>
                            <p><?= htmlspecialchars($policy['body']) ?></p>
                        </article>
                    <?php endforeach; ?>
                </div>
                <div class="policy-banner">
                    <strong>Public の収益で、地域の無料運営と無償自治体支援を支える。</strong>
                    <p>これが ikimon の現行運営モデルです。料金表だけでなく、誰のための無料かまで含めて一貫させています。</p>
                </div>
            </div>
        </section>

        <!-- ── faq ── -->
        <section class="section">
            <div class="lp-container">
                <div class="section-head">
                    <span class="section-label">Q&A</span>
                    <h2>よくある質問</h2>
                </div>
                <div class="grid-3">
                    <article class="card faq-card">
                        <strong>無料でどこまで使えますか？</strong>
                        <p>個人の投稿・同定・イベント参加に加え、団体ページの作成、スポット登録、観察会の開催、参加人数・発見種数の概要確認まで無料です。</p>
                    </article>
                    <article class="card faq-card">
                        <strong>有料プランはPublicだけですか？</strong>
                        <p>はい。PersonalとCommunityは無料で、有料プランはPublicのみです。種の全リスト、CSV、レポート出力など、調査・報告に使う出力機能をまとめています。</p>
                    </article>
                    <article class="card faq-card">
                        <strong>消滅可能性自治体は無償になりますか？</strong>
                        <p>はい。<?= htmlspecialchars($regionalMessaging['support_policies'][0]['body']) ?> まずは相談してください。</p>
                    </article>
                    <article class="card faq-card">
                        <strong>法人格がなくても使えますか？</strong>
                        <p>Communityプランは法人格不要で作成できます。学校のクラス、地域のグループ、企業の部署など、任意の団体単位でページを作れます。</p>
                    </article>
                    <article class="card faq-card">
                        <strong>なぜ無料で提供できるのですか？</strong>
                        <p><?= htmlspecialchars($regionalMessaging['support_policies'][1]['body']) ?></p>
                    </article>
                    <article class="card faq-card">
                        <strong>機能改善や共同実証の相談はできますか？</strong>
                        <p>できます。まずはそのまま使い始めたい団体だけでなく、現場の運用に合わせて改善点を整理しながら試したい自治体・研究機関・企業・保全団体からの相談も受け付けています。</p>
                    </article>
                </div>

                <!-- closing CTA -->
                <div class="closing">
                    <h2>導入相談も、共同実証の相談も歓迎しています。</h2>
                    <p>Community は申込み不要・無料で始められます。まずはそのまま使ってみたい方も、現場に合わせた改善や機能検証を一緒に進めたい方も、相談内容に応じて入口をご案内します。</p>
                    <div class="closing-actions">
                        <a href="<?= htmlspecialchars($workspaceCtaHref) ?>" class="lp-btn-primary"><i data-lucide="sparkles" class="h-4 w-4"></i><?= htmlspecialchars($workspaceCtaLabel) ?></a>
                        <a href="<?= htmlspecialchars($publicCtaHref) ?>" class="lp-btn-secondary"><i data-lucide="messages-square" class="h-4 w-4"></i>導入・共同実証を相談</a>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <!-- mobile sticky CTA -->
    <div class="mobile-cta-bar">
        <a href="<?= htmlspecialchars($workspaceCtaHref) ?>" class="lp-btn-primary"><i data-lucide="sparkles" class="h-4 w-4"></i>無料で作る</a>
        <a href="../site_dashboard.php?site=ikan_hq&demo=1" class="lp-btn-secondary"><i data-lucide="monitor-play" class="h-4 w-4"></i>デモ</a>
    </div>
    <div class="mobile-cta-spacer"></div>

    <?php include __DIR__ . '/../components/footer.php'; ?>
</body>
</html>
