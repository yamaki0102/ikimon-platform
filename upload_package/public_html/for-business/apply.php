<?php

/**
 * B2B Apply Page — Public プラン / 共同実証 相談フォーム
 * 
 * 無料の Community は別導線でセルフ作成。
 * このページは Public プランと共同実証の相談用。
 */
require_once __DIR__ . '/../../config/config.php';
require_once ROOT_DIR . '/libs/CspNonce.php';
require_once ROOT_DIR . '/libs/CSRF.php';
require_once ROOT_DIR . '/libs/BrandMessaging.php';
require_once ROOT_DIR . '/libs/Lang.php';

Lang::init();
$nonce = CspNonce::get();
CspNonce::sendHeader();
$csrfToken = CSRF::generate();
$documentLang = method_exists('Lang', 'current') ? Lang::current() : 'ja';
$regionalMessaging = BrandMessaging::regionalRevitalization();
$publicPlan = $regionalMessaging['public_plan'];
$communityPlan = $regionalMessaging['community_plan'];
$freePlan = $regionalMessaging['free_plan'];
$publicPlanSummary = $publicPlan['description'];
$freeMunicipalityPolicy = $regionalMessaging['support_policies'][0]['body'];
$applyText = [
    'meta_title' => __('business_apply.meta_title', '導入・共同実証の相談 | ikimon for Business'),
    'meta_description' => __('business_apply.meta_description', 'ikimon for Business の導入・共同実証相談フォーム。'),
    'nav_overview' => __('business_apply.nav_overview', '概要'),
    'nav_pricing' => __('business_apply.nav_pricing', '料金'),
    'nav_status' => __('business_apply.nav_status', '進み具合'),
    'nav_demo' => __('business_apply.nav_demo', 'デモ'),
    'badge' => __('business_apply.badge', 'APPLY'),
    'hero_title' => __('business_apply.hero_title', '導入・共同実証の相談'),
    'hero_lead' => __('business_apply.hero_lead', 'フォーム送信後は受付番号を発行します。導入相談、共同実証、改善提案のいずれでも、内容に応じて次の進め方をご案内します。'),
    'section_inquiry' => __('business_apply.section_inquiry', 'ご相談内容'),
    'section_company' => __('business_apply.section_company', '企業情報'),
    'section_site' => __('business_apply.section_site', 'サイト情報'),
    'required' => __('business_apply.required', '*必須'),
    'privacy_note' => __('business_apply.privacy_note', '送信後、担当よりご連絡いたします。プライバシーポリシーに同意のうえお申し込みください。'),
    'privacy_link' => __('business_apply.privacy_link', 'プライバシーポリシー'),
    'submit' => __('business_apply.submit', '📝 相談内容を送信する'),
    'submitting' => __('business_apply.submitting', '送信中...'),
    'success_title' => __('business_apply.success_title', 'ご相談ありがとうございます'),
    'success_lead' => __('business_apply.success_lead', '受付番号を発行しました。1営業日以内を目安に、内容に合わせた進め方をご案内します。'),
    'success_reference' => __('business_apply.success_reference', '受付番号'),
    'success_next' => __('business_apply.success_next', '次のご案内をお待ちください。'),
    'back_to_top' => __('business_apply.back_to_top', 'トップに戻る'),
    'view_status' => __('business_apply.view_status', '進み具合を見る'),
    'sidebar_plans_title' => __('business_apply.sidebar_plans_title', '🧭 どのプランを選ぶ？'),
    'sidebar_flow_title' => __('business_apply.sidebar_flow_title', '🎯 相談後の流れ'),
    'sidebar_public_title' => __('business_apply.sidebar_public_title', '✨ Public でできること'),
    'sidebar_ok_title' => __('business_apply.sidebar_ok_title', '💬 ご相談だけでもOK'),
    'sidebar_ok_body' => __('business_apply.sidebar_ok_body', '「まず話を聞きたい」「こういう改善ができるか聞きたい」という段階でも歓迎です。'),
    'workspace_cta' => __('business_apply.workspace_cta', '無料の団体ページを作る'),
    'flow_1' => __('business_apply.flow_1', '受付番号つきで申込み保存'),
    'flow_2' => __('business_apply.flow_2', '内容確認と初回連絡'),
    'flow_3' => __('business_apply.flow_3', '導入 / 実証 / 改善の進め方を整理'),
    'flow_4' => __('business_apply.flow_4', '必要に応じて運用開始や検証へ'),
    'public_feature_1' => __('business_apply.public_feature_1', 'CSV / 証跡JSON / 各種レポート出力'),
    'public_feature_2' => __('business_apply.public_feature_2', '継続運用と提出向けの Public サポート'),
    'public_feature_3' => __('business_apply.public_feature_3', 'Community で育てた活動をそのまま昇格'),
    'community_box_title' => __('business_apply.community_box_title', 'Community でできること'),
    'free_box_title' => __('business_apply.free_box_title', '無償提供の方針'),
    'field_inquiry_type' => __('business_apply.field_inquiry_type', 'ご相談の種類'),
    'field_collaboration_scope' => __('business_apply.field_collaboration_scope', '一緒に進めたい範囲'),
    'field_company' => __('business_apply.field_company', '会社名/団体名'),
    'field_contact_name' => __('business_apply.field_contact_name', '担当者名'),
    'field_department' => __('business_apply.field_department', '部署'),
    'field_email' => __('business_apply.field_email', 'メールアドレス'),
    'field_phone' => __('business_apply.field_phone', '電話番号'),
    'field_site_name' => __('business_apply.field_site_name', 'モニタリング対象の拠点名'),
    'field_site_location' => __('business_apply.field_site_location', '拠点の所在地'),
    'field_plan' => __('business_apply.field_plan', '想定している入口'),
    'field_expected_start' => __('business_apply.field_expected_start', '始めたい時期'),
    'field_planned_site_count' => __('business_apply.field_planned_site_count', '想定している拠点数'),
    'field_use_mode' => __('business_apply.field_use_mode', '主な使い方'),
    'field_message' => __('business_apply.field_message', '備考・ご相談内容'),
    'placeholder_company' => __('business_apply.placeholder_company', '例：株式会社サンプル'),
    'placeholder_contact_name' => __('business_apply.placeholder_contact_name', '山田 太郎'),
    'placeholder_department' => __('business_apply.placeholder_department', '環境推進室'),
    'placeholder_email' => __('business_apply.placeholder_email', 'taro@example.co.jp'),
    'placeholder_phone' => __('business_apply.placeholder_phone', '053-XXX-XXXX'),
    'placeholder_site_name' => __('business_apply.placeholder_site_name', '例：本社敷地、工場まわりの緑地、公園エリア'),
    'placeholder_site_location' => __('business_apply.placeholder_site_location', '例：静岡県浜松市中央区XX町 1-2-3'),
    'placeholder_message' => __('business_apply.placeholder_message', '導入で気になっている点、共同実証で確かめたいこと、改善したい運用課題などをご記入ください'),
    'option_select' => __('business_apply.option_select', '選択してください'),
    'option_inquiry_consultation' => __('business_apply.option_inquiry_consultation', '導入相談'),
    'option_inquiry_pilot' => __('business_apply.option_inquiry_pilot', '共同実証'),
    'option_inquiry_improvement' => __('business_apply.option_inquiry_improvement', '改善提案'),
    'option_scope_none' => __('business_apply.option_scope_none', '特に決まっていない'),
    'option_scope_operations' => __('business_apply.option_scope_operations', '運用設計を相談したい'),
    'option_scope_feature' => __('business_apply.option_scope_feature', '機能改善も相談したい'),
    'option_scope_data' => __('business_apply.option_scope_data', 'データ活用を相談したい'),
    'option_scope_mixed' => __('business_apply.option_scope_mixed', '複合的に相談したい'),
    'option_plan_consultation' => __('business_apply.option_plan_consultation', 'まず相談したい'),
    'public_price_suffix' => __('business_apply.public_price_suffix', '/ 月'),
    'option_start_soon' => __('business_apply.option_start_soon', 'できるだけ早く'),
    'option_start_this_month' => __('business_apply.option_start_this_month', '今月中に'),
    'option_start_next_quarter' => __('business_apply.option_start_next_quarter', '1〜3か月以内に'),
    'option_start_exploring' => __('business_apply.option_start_exploring', 'まずは相談したい'),
    'option_sites_1' => __('business_apply.option_sites_1', '1拠点'),
    'option_sites_2_5' => __('business_apply.option_sites_2_5', '2〜5拠点'),
    'option_sites_6_plus' => __('business_apply.option_sites_6_plus', '6拠点以上'),
    'option_use_archive' => __('business_apply.option_use_archive', 'その場所の自然記録を残したい'),
    'option_use_program' => __('business_apply.option_use_program', '授業・観察会・小さな調査で使いたい'),
    'option_use_team' => __('business_apply.option_use_team', 'チームで見返せる形にしたい'),
    'option_use_handoff' => __('business_apply.option_use_handoff', '外部資料づくりの下準備にしたい'),
];
$jsText = [
    'submit' => $applyText['submit'],
    'submitting' => $applyText['submitting'],
    'submit_error' => __('business_apply.submit_error', '送信に失敗しました。'),
    'submit_error_retry' => __('business_apply.submit_error_retry', '送信に失敗しました。時間をおいてもう一度お試しください。'),
    'help_inquiry_default' => __('business_apply.help_inquiry_default', 'いま考えている進め方に近いものを選んでください。途中で変わっても問題ありません。'),
    'help_inquiry_pilot' => __('business_apply.help_inquiry_pilot', '共同実証では、現場で試しながら運用や機能を一緒に詰めていく前提の相談を想定しています。'),
    'help_inquiry_improvement' => __('business_apply.help_inquiry_improvement', '改善提案では、既存運用の課題や追加したい機能、より使いやすくしたい点の相談を想定しています。'),
    'help_inquiry_consultation' => __('business_apply.help_inquiry_consultation', '導入相談では、まず何に使いたいか、どの単位で始めたいかを確認しながらご案内します。'),
    'help_plan_default' => __('business_apply.help_plan_default', '個人利用と無料の Community 団体ページは申込み不要です。必要に応じて Public や相談導線をご案内します。'),
    'help_plan_pilot' => __('business_apply.help_plan_pilot', '共同実証の段階では、まず相談ベースで要件整理するのがおすすめです。無料の Community から始める構成も案内できます。'),
    'help_plan_improvement' => __('business_apply.help_plan_improvement', '改善提案では、いきなり Public を前提にせず、まず相談ベースで現状と課題を整理できます。'),
    'help_plan_consultation' => __('business_apply.help_plan_consultation', 'Public を具体的に検討している場合はそのまま選べます。まだ迷っている場合は「まず相談したい」を選んでください。'),
    'success_inquiry_prefix' => __('business_apply.success_inquiry_prefix', ' / 相談種別: '),
    'success_default_content' => __('business_apply.success_default_content', 'ご相談内容'),
    'success_received_prefix' => __('business_apply.success_received_prefix', '受付番号を発行しました。'),
    'success_received_suffix' => __('business_apply.success_received_suffix', 'として受け付け、1営業日以内を目安にご連絡します。'),
    'success_status_prefix' => __('business_apply.success_status_prefix', ' / 次の動き: '),
    'success_default_status' => __('business_apply.success_default_status', '新規受付'),
    'success_default_next_action' => __('business_apply.success_default_next_action', '初回連絡'),
];
?>
<!DOCTYPE html>
<html lang="<?= htmlspecialchars($documentLang, ENT_QUOTES, 'UTF-8') ?>">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($applyText['meta_title'], ENT_QUOTES, 'UTF-8') ?></title>
    <meta name="description" content="<?= htmlspecialchars($applyText['meta_description'] . ' ' . $publicPlanSummary, ENT_QUOTES, 'UTF-8') ?>">
    <link rel="icon" type="image/png" sizes="32x32" href="../assets/img/favicon-32.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #10b981;
            --primary-dark: #065f46;
            --primary-light: #d1fae5;
            --accent: #3b82f6;
            --accent-dark: #1e40af;
            --text: #1a1a2e;
            --text-secondary: #4b5563;
            --muted: #9ca3af;
            --bg: #ffffff;
            --surface: #f9fafb;
            --border: #e5e7eb;
            --error: #ef4444;
            --error-light: #fee2e2;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Noto Sans JP', sans-serif;
            background: var(--bg);
            color: var(--text);
            font-size: 16px;
            line-height: 1.8;
        }

        .container {
            max-width: 1100px;
            margin: 0 auto;
            padding: 0 24px;
        }

        .badge {
            display: inline-block;
            padding: 4px 14px;
            border-radius: 99px;
            font-size: 12px;
            font-weight: 700;
        }

        .badge-green {
            background: var(--primary-light);
            color: var(--primary-dark);
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 700;
            text-decoration: none;
            transition: all 0.2s;
            border: none;
            cursor: pointer;
        }

        .btn-primary-lp {
            background: var(--primary);
            color: white;
        }

        .btn-primary-lp:hover {
            background: var(--primary-dark);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .btn-outline {
            background: transparent;
            color: var(--primary);
            border: 2px solid var(--primary);
        }

        .lp-nav {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 100;
            background: rgba(255, 255, 255, 0.92);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--border);
        }

        .lp-nav .inner {
            max-width: 1100px;
            margin: 0 auto;
            padding: 0 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 60px;
        }

        .lp-nav .logo {
            font-size: 20px;
            font-weight: 900;
            color: var(--primary);
            text-decoration: none;
        }

        .lp-nav .logo sup {
            font-size: 10px;
            color: var(--accent);
            font-weight: 700;
            vertical-align: super;
        }

        .lp-nav-links {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .lp-nav-links a {
            font-size: 13px;
            font-weight: 700;
            color: var(--text-secondary);
            text-decoration: none;
        }

        .lp-nav-links a:hover {
            color: var(--primary);
        }

        .page-header {
            padding: 100px 0 40px;
            background: var(--surface);
            border-bottom: 1px solid var(--border);
        }

        .page-header h1 {
            font-size: 28px;
            font-weight: 900;
        }

        .page-header p {
            font-size: 15px;
            color: var(--text-secondary);
            margin-top: 8px;
            max-width: 560px;
        }

        /* Form */
        .form-section {
            padding: 48px 0 80px;
        }

        .form-layout {
            display: grid;
            grid-template-columns: 1fr 340px;
            gap: 40px;
            max-width: 900px;
            margin: 0 auto;
        }

        .form-main {}

        .form-sidebar {
            padding-top: 8px;
        }

        .field {
            margin-bottom: 20px;
        }

        .field label {
            display: block;
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 6px;
        }

        .field label .req {
            color: var(--error);
            font-size: 11px;
            margin-left: 4px;
        }

        .field input,
        .field select,
        .field textarea {
            width: 100%;
            padding: 10px 14px;
            border: 2px solid var(--border);
            border-radius: 8px;
            font-family: inherit;
            font-size: 14px;
            transition: border-color 0.2s;
            background: white;
        }

        .field input:focus,
        .field select:focus,
        .field textarea:focus {
            outline: none;
            border-color: var(--primary);
        }

        .field textarea {
            resize: vertical;
            min-height: 80px;
        }

        .field-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }

        .form-submit {
            margin-top: 24px;
        }

        .form-submit .btn {
            width: 100%;
            justify-content: center;
            padding: 14px;
            font-size: 16px;
        }

        .sidebar-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 16px;
        }

        .sidebar-card h3 {
            font-size: 14px;
            font-weight: 900;
            margin-bottom: 8px;
        }

        .sidebar-card ul {
            list-style: none;
        }

        .sidebar-card li {
            font-size: 12px;
            padding: 4px 0;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .sidebar-card .check {
            color: var(--primary);
            font-weight: 700;
        }

        /* Success state */
        .success-message {
            display: none;
            text-align: center;
            padding: 48px;
            background: var(--primary-light);
            border-radius: 12px;
        }

        .success-message.show {
            display: block;
        }

        .success-message h2 {
            font-size: 24px;
            font-weight: 900;
            color: var(--primary-dark);
            margin-bottom: 8px;
        }

        .success-message p {
            font-size: 14px;
            color: var(--primary-dark);
        }

        /* Footer: uses shared components/footer.php */

        @media (max-width: 768px) {
            .form-layout {
                grid-template-columns: 1fr;
            }

            .form-sidebar {
                order: -1;
            }

            .field-row {
                grid-template-columns: 1fr;
            }

            .page-header h1 {
                font-size: 22px;
            }

            .lp-nav-links a.hide-mobile {
                display: none;
            }
        }
    </style>
</head>

<body>
    <nav class="lp-nav">
        <div class="inner">
            <a href="index.php" class="logo">ikimon<sup>Business</sup></a>
            <div class="lp-nav-links">
                <a href="index.php" class="hide-mobile"><?= htmlspecialchars($applyText['nav_overview']) ?></a>
                <a href="/for-business/#plans" class="hide-mobile"><?= htmlspecialchars($applyText['nav_pricing']) ?></a>
                <a href="status.php" class="hide-mobile"><?= htmlspecialchars($applyText['nav_status']) ?></a>
                <a href="demo.php" class="btn btn-outline" style="padding: 6px 16px; font-size: 12px;"><?= htmlspecialchars($applyText['nav_demo']) ?></a>
            </div>
        </div>
    </nav>

    <header class="page-header">
        <div class="container">
            <span class="badge badge-green">📝 <?= htmlspecialchars($applyText['badge']) ?></span>
            <h1 style="margin-top: 8px;"><?= htmlspecialchars($applyText['hero_title']) ?></h1>
            <p><?= htmlspecialchars($applyText['hero_lead'] . ' ' . $freeMunicipalityPolicy) ?></p>
        </div>
    </header>

    <section class="form-section">
        <div class="container">
            <div id="formArea" class="form-layout">
                <div class="form-main">
                    <form id="applyForm" method="POST" action="#" onsubmit="return handleSubmit(event)">
                        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
                        <h3 style="font-size: 16px; font-weight: 900; margin-bottom: 16px;"><?= htmlspecialchars($applyText['section_inquiry']) ?></h3>

                        <div class="field">
                            <label><?= htmlspecialchars($applyText['field_inquiry_type']) ?> <span class="req"><?= htmlspecialchars($applyText['required']) ?></span></label>
                            <select name="inquiry_type" id="inquiryType" required>
                                <option value=""><?= htmlspecialchars($applyText['option_select']) ?></option>
                                <option value="consultation"><?= htmlspecialchars($applyText['option_inquiry_consultation']) ?></option>
                                <option value="pilot"><?= htmlspecialchars($applyText['option_inquiry_pilot']) ?></option>
                                <option value="improvement"><?= htmlspecialchars($applyText['option_inquiry_improvement']) ?></option>
                            </select>
                            <p id="inquiryHelp" style="margin-top:8px; font-size:12px; color:var(--muted);"><?= htmlspecialchars($jsText['help_inquiry_default']) ?></p>
                        </div>

                        <div class="field">
                            <label><?= htmlspecialchars($applyText['field_collaboration_scope']) ?></label>
                            <select name="collaboration_scope" id="collaborationScope">
                                <option value=""><?= htmlspecialchars($applyText['option_scope_none']) ?></option>
                                <option value="operations"><?= htmlspecialchars($applyText['option_scope_operations']) ?></option>
                                <option value="feature"><?= htmlspecialchars($applyText['option_scope_feature']) ?></option>
                                <option value="data"><?= htmlspecialchars($applyText['option_scope_data']) ?></option>
                                <option value="mixed"><?= htmlspecialchars($applyText['option_scope_mixed']) ?></option>
                            </select>
                        </div>

                        <h3 style="font-size: 16px; font-weight: 900; margin: 24px 0 16px;"><?= htmlspecialchars($applyText['section_company']) ?></h3>

                        <div class="field">
                            <label><?= htmlspecialchars($applyText['field_company']) ?> <span class="req"><?= htmlspecialchars($applyText['required']) ?></span></label>
                            <input type="text" name="company" required placeholder="<?= htmlspecialchars($applyText['placeholder_company']) ?>">
                        </div>

                        <div class="field-row">
                            <div class="field">
                                <label><?= htmlspecialchars($applyText['field_contact_name']) ?> <span class="req"><?= htmlspecialchars($applyText['required']) ?></span></label>
                                <input type="text" name="contact_name" required placeholder="<?= htmlspecialchars($applyText['placeholder_contact_name']) ?>">
                            </div>
                            <div class="field">
                                <label><?= htmlspecialchars($applyText['field_department']) ?></label>
                                <input type="text" name="department" placeholder="<?= htmlspecialchars($applyText['placeholder_department']) ?>">
                            </div>
                        </div>

                        <div class="field-row">
                            <div class="field">
                                <label><?= htmlspecialchars($applyText['field_email']) ?> <span class="req"><?= htmlspecialchars($applyText['required']) ?></span></label>
                                <input type="email" name="email" required placeholder="<?= htmlspecialchars($applyText['placeholder_email']) ?>">
                            </div>
                            <div class="field">
                                <label><?= htmlspecialchars($applyText['field_phone']) ?></label>
                                <input type="tel" name="phone" placeholder="<?= htmlspecialchars($applyText['placeholder_phone']) ?>">
                            </div>
                        </div>

                        <h3 style="font-size: 16px; font-weight: 900; margin: 24px 0 16px;"><?= htmlspecialchars($applyText['section_site']) ?></h3>

                        <div class="field">
                            <label><?= htmlspecialchars($applyText['field_site_name']) ?> <span class="req"><?= htmlspecialchars($applyText['required']) ?></span></label>
                            <input type="text" name="site_name" required placeholder="<?= htmlspecialchars($applyText['placeholder_site_name']) ?>">
                        </div>

                        <div class="field">
                            <label><?= htmlspecialchars($applyText['field_site_location']) ?></label>
                            <input type="text" name="site_location" placeholder="<?= htmlspecialchars($applyText['placeholder_site_location']) ?>">
                        </div>

                        <div class="field">
                            <label><?= htmlspecialchars($applyText['field_plan']) ?></label>
                            <select name="plan" id="planSelect">
                                <option value="public">Public（<?= htmlspecialchars($publicPlan['description']) ?> / ¥39,800 <?= htmlspecialchars($applyText['public_price_suffix']) ?>）</option>
                                <option value="consultation"><?= htmlspecialchars($applyText['option_plan_consultation']) ?></option>
                            </select>
                            <p id="planHelp" style="margin-top:8px; font-size:12px; color:var(--muted);"><?= htmlspecialchars($jsText['help_plan_default']) ?></p>
                        </div>

                        <div class="field-row">
                            <div class="field">
                                <label><?= htmlspecialchars($applyText['field_expected_start']) ?></label>
                                <select name="expected_start">
                                    <option value="soon"><?= htmlspecialchars($applyText['option_start_soon']) ?></option>
                                    <option value="this_month"><?= htmlspecialchars($applyText['option_start_this_month']) ?></option>
                                    <option value="next_quarter"><?= htmlspecialchars($applyText['option_start_next_quarter']) ?></option>
                                    <option value="exploring"><?= htmlspecialchars($applyText['option_start_exploring']) ?></option>
                                </select>
                            </div>
                            <div class="field">
                                <label><?= htmlspecialchars($applyText['field_planned_site_count']) ?></label>
                                <select name="planned_site_count">
                                    <option value="1"><?= htmlspecialchars($applyText['option_sites_1']) ?></option>
                                    <option value="2-5"><?= htmlspecialchars($applyText['option_sites_2_5']) ?></option>
                                    <option value="6+"><?= htmlspecialchars($applyText['option_sites_6_plus']) ?></option>
                                </select>
                            </div>
                        </div>

                        <div class="field">
                            <label><?= htmlspecialchars($applyText['field_use_mode']) ?></label>
                            <select name="use_mode">
                                <option value=""><?= htmlspecialchars($applyText['option_select']) ?></option>
                                <option value="archive"><?= htmlspecialchars($applyText['option_use_archive']) ?></option>
                                <option value="program"><?= htmlspecialchars($applyText['option_use_program']) ?></option>
                                <option value="team"><?= htmlspecialchars($applyText['option_use_team']) ?></option>
                                <option value="handoff"><?= htmlspecialchars($applyText['option_use_handoff']) ?></option>
                            </select>
                        </div>

                        <div class="field">
                            <label><?= htmlspecialchars($applyText['field_message']) ?></label>
                            <textarea name="message" rows="4" placeholder="<?= htmlspecialchars($applyText['placeholder_message']) ?>"></textarea>
                        </div>

                        <div class="form-submit">
                            <button type="submit" class="btn btn-primary-lp"><?= htmlspecialchars($applyText['submit']) ?></button>
                        </div>
                        <p style="font-size: 11px; color: var(--muted); margin-top: 8px; text-align: center;">
                            <a href="../privacy.php" style="color: var(--primary);"><?= htmlspecialchars($applyText['privacy_link']) ?></a>
                            <?= htmlspecialchars(' ' . $applyText['privacy_note']) ?>
                        </p>
                    </form>
                </div>

                <div class="form-sidebar">
                    <div class="sidebar-card">
                        <h3><?= htmlspecialchars($applyText['sidebar_plans_title']) ?></h3>
                        <ul>
                            <li><span class="check">Free</span> <?= htmlspecialchars(__('business_lp.personal_plan.note', '個人で始める入口。申込み不要')) ?></li>
                            <li><span class="check"><?= htmlspecialchars($communityPlan['tag']) ?></span> <?= htmlspecialchars($communityPlan['description']) ?></li>
                            <li><span class="check"><?= htmlspecialchars($publicPlan['tag']) ?></span> <?= htmlspecialchars($publicPlan['description']) ?></li>
                        </ul>
                        <a href="create.php" class="btn btn-outline" style="width:100%; justify-content:center; margin-top:12px;"><?= htmlspecialchars($applyText['workspace_cta']) ?></a>
                    </div>

                    <div class="sidebar-card">
                        <h3><?= htmlspecialchars($applyText['sidebar_flow_title']) ?></h3>
                        <ul>
                            <li><span class="check">1.</span> <?= htmlspecialchars($applyText['flow_1']) ?></li>
                            <li><span class="check">2.</span> <?= htmlspecialchars($applyText['flow_2']) ?></li>
                            <li><span class="check">3.</span> <?= htmlspecialchars($applyText['flow_3']) ?></li>
                            <li><span class="check">4.</span> <?= htmlspecialchars($applyText['flow_4']) ?></li>
                        </ul>
                    </div>

                    <div class="sidebar-card">
                        <h3><?= htmlspecialchars($applyText['sidebar_public_title']) ?></h3>
                        <ul>
                            <li><span class="check">✓</span> <?= htmlspecialchars($publicPlan['description']) ?></li>
                            <li><span class="check">✓</span> <?= htmlspecialchars($applyText['public_feature_1']) ?></li>
                            <li><span class="check">✓</span> <?= htmlspecialchars($applyText['public_feature_2']) ?></li>
                            <li><span class="check">✓</span> <?= htmlspecialchars($applyText['public_feature_3']) ?></li>
                        </ul>
                        <div style="margin-top:14px; border-radius:14px; background:#ecfdf5; border:1px solid #bbf7d0; padding:12px 14px; font-size:13px; color:var(--primary-dark);">
                            <strong style="display:block; margin-bottom:4px;"><?= htmlspecialchars($applyText['community_box_title']) ?></strong>
                            <?= htmlspecialchars($communityPlan['description']) ?>
                        </div>
                        <div style="margin-top:14px; border-radius:14px; background:#f0fdf4; border:1px solid #86efac; padding:12px 14px; font-size:13px; color:var(--primary-dark);">
                            <strong style="display:block; margin-bottom:4px;"><?= htmlspecialchars($applyText['free_box_title']) ?></strong>
                            <?= htmlspecialchars($freeMunicipalityPolicy) ?>
                        </div>
                    </div>

                    <div class="sidebar-card" style="background: var(--primary-light);">
                        <h3 style="color: var(--primary-dark);"><?= htmlspecialchars($applyText['sidebar_ok_title']) ?></h3>
                        <p style="font-size: 12px; color: var(--primary-dark);">
                            <?= htmlspecialchars($applyText['sidebar_ok_body']) ?>
                        </p>
                    </div>
                </div>
            </div>

            <div id="successMessage" class="success-message">
                <p style="font-size: 40px; margin-bottom: 12px;">🎉</p>
                <h2><?= htmlspecialchars($applyText['success_title']) ?></h2>
                <p id="successLead"><?= htmlspecialchars($applyText['success_lead']) ?></p>
                <div style="margin-top: 20px; padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.7);">
                    <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.08em; color: var(--primary-dark); text-transform: uppercase;"><?= htmlspecialchars($applyText['success_reference']) ?></div>
                    <div id="successReference" style="font-size: 24px; font-weight: 900; color: var(--primary-dark); margin-top: 6px;">-</div>
                    <p id="successNext" style="font-size: 13px; color: var(--primary-dark); margin-top: 8px;"><?= htmlspecialchars($applyText['success_next']) ?></p>
                </div>
                <div style="margin-top: 24px;">
                    <a href="index.php" class="btn btn-outline"><?= htmlspecialchars($applyText['back_to_top']) ?></a>
                    <a id="statusLink" href="status.php" class="btn btn-primary-lp"><?= htmlspecialchars($applyText['view_status']) ?></a>
                </div>
            </div>
        </div>
    </section>

    <?php include __DIR__ . '/../components/footer.php'; ?>

    <script nonce="<?= $nonce ?>">
        const applyText = <?= json_encode($jsText, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;

        function getCsrfToken() {
            const m = document.cookie.match(/(?:^|;\s*)ikimon_csrf=([a-f0-9]{64})/);
            return m ? m[1] : document.querySelector('input[name="csrf_token"]')?.value || '';
        }

        function handleSubmit(e) {
            e.preventDefault();
            const form = document.getElementById('applyForm');
            const data = new FormData(form);
            const payload = Object.fromEntries(data.entries());
            const submitButton = form.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = applyText.submitting;

            fetch('../api/business/submit_application.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Csrf-Token': getCsrfToken()
                },
                body: JSON.stringify(payload)
            })
                .then(function(response) {
                    return response.json().then(function(json) {
                        if (!response.ok || !json.success) {
                            throw new Error(json.message || applyText.submit_error);
                        }
                        return json;
                    });
                })
                .then(function(result) {
                    document.getElementById('formArea').style.display = 'none';
                    document.getElementById('successMessage').classList.add('show');
                    document.getElementById('successReference').textContent = result.reference || '-';
                    const inquiryLabel = result.inquiry_type_label ? applyText.success_inquiry_prefix + result.inquiry_type_label : '';
                    document.getElementById('successLead').textContent = applyText.success_received_prefix + (result.inquiry_type_label || applyText.success_default_content) + applyText.success_received_suffix;
                    document.getElementById('successNext').textContent = (result.status_label || applyText.success_default_status) + inquiryLabel + applyText.success_status_prefix + (result.next_action || applyText.success_default_next_action);
                    document.getElementById('statusLink').href = 'status.php?ref=' + encodeURIComponent(result.reference || '');
                })
                .catch(function(error) {
                    alert(error.message || applyText.submit_error_retry);
                    submitButton.disabled = false;
                    submitButton.textContent = applyText.submit;
                });

            return false;
        }

        (function setupInquiryForm() {
            const inquiryType = document.getElementById('inquiryType');
            const planSelect = document.getElementById('planSelect');
            const inquiryHelp = document.getElementById('inquiryHelp');
            const planHelp = document.getElementById('planHelp');
            const collaborationScope = document.getElementById('collaborationScope');

            function sync() {
                const type = inquiryType.value;
                if (type === 'pilot') {
                    inquiryHelp.textContent = applyText.help_inquiry_pilot;
                    planSelect.value = 'consultation';
                    planHelp.textContent = applyText.help_plan_pilot;
                    if (!collaborationScope.value) collaborationScope.value = 'mixed';
                } else if (type === 'improvement') {
                    inquiryHelp.textContent = applyText.help_inquiry_improvement;
                    planSelect.value = 'consultation';
                    planHelp.textContent = applyText.help_plan_improvement;
                    if (!collaborationScope.value) collaborationScope.value = 'feature';
                } else if (type === 'consultation') {
                    inquiryHelp.textContent = applyText.help_inquiry_consultation;
                    planHelp.textContent = applyText.help_plan_consultation;
                } else {
                    inquiryHelp.textContent = applyText.help_inquiry_default;
                    planHelp.textContent = applyText.help_plan_default;
                }
            }

            inquiryType.addEventListener('change', sync);
            sync();
        })();
    </script>
</body>

</html>
