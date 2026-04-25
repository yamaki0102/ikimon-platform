<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/SiteManager.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Lang.php';

Auth::init();
Lang::init();

$documentLang = method_exists('Lang', 'current') ? Lang::current() : (!empty($_GET['lang']) ? (string)$_GET['lang'] : 'ja');

$demoSiteId = 'ikan_hq';
$site = SiteManager::load($demoSiteId);

$allObs = DataStore::fetchAll('observations');
$obsCount = 0;
$speciesSet = [];
foreach ($allObs as $obs) {
    if (($obs['site_id'] ?? null) === $demoSiteId) {
        $obsCount++;
        $name = $obs['taxon']['name'] ?? ($obs['species_name'] ?? null);
        if ($name) {
            $speciesSet[$name] = true;
        }
    }
}
$speciesCount = count($speciesSet);

$copyByLang = [
    'ja' => [
        'page_title' => 'デモ体験 — ikimon for Business',
        'meta_description' => '愛管株式会社の実データを使ったikimonデモ。自然の記録がどう積み上がり、どう見返せるかを体験できます。',
        'badge' => 'Interactive Demo — Real Data',
        'hero_title' => '「観察すると、その場所の自然がたまっていく」を体験してください。',
        'hero_body' => '<strong>愛管株式会社</strong>の実際のフィールドデータを使って、ikimon で自然の記録がどう積み上がり、どう見返せるかを試せるデモです。',
        'stat_labels' => ['観察記録', '確認種数', 'ふり返り対応'],
        'season_value' => '季節',
        'cta' => 'まとめを見る',
        'info_title' => 'このデモでわかること',
        'features' => [
            ['icon' => '📊', 'title' => '記録のまとまりメモ', 'body' => '記録の広がりや継続の様子をざっくり見返すための内部向けメモです。評価や認証の代わりではありません。'],
            ['icon' => '🔴', 'title' => '気をつけて見たい種', 'body' => '環境省・都道府県レッドリストと照らし合わせて、注意して見返したい記録を拾いやすくします。'],
            ['icon' => '📋', 'title' => '共有しやすいまとめ', 'body' => '社内共有や外部資料づくりの前段として、その場所で何が記録されたかを整理して見られます。'],
            ['icon' => '🦋', 'title' => '見つかった生きもの一覧', 'body' => '学名と和名をそろえた一覧として、その場所でどんな生きものが記録されたかを残せます。'],
        ],
        'notice_title' => '⚠️ プライバシー保護について:',
        'notice_body' => 'このデモでは、個人を特定できる情報（投稿者名・個別GPS座標）は表示されません。観察データの統計情報とサイト全体の集計結果のみを公開しています。',
        'back' => '組織で使いたい方へ に戻る',
    ],
    'en' => [
        'page_title' => 'Demo Experience — ikimon for Business',
        'meta_description' => 'An ikimon demo using real data from I-KAN Co., Ltd. See how nature records accumulate and can be revisited later.',
        'badge' => 'Interactive Demo — Real Data',
        'hero_title' => 'See how observation records accumulate place by place.',
        'hero_body' => 'This demo uses real field data from <strong>I-KAN Co., Ltd.</strong> so you can see how ikimon builds local nature records and makes them easier to revisit later.',
        'stat_labels' => ['Observations', 'Confirmed species', 'Review-ready'],
        'season_value' => 'Seasonal',
        'cta' => 'View the summary',
        'info_title' => 'What this demo shows',
        'features' => [
            ['icon' => '📊', 'title' => 'Record summary notes', 'body' => 'An internal-facing memo layer for quickly reviewing how records spread and continue over time. It is not a certification or scorecard.'],
            ['icon' => '🔴', 'title' => 'Species that deserve attention', 'body' => 'It makes it easier to revisit records that overlap with national and prefectural red lists.'],
            ['icon' => '📋', 'title' => 'Shareable summaries', 'body' => 'You can organize what was recorded at a site before moving into internal reporting or outside materials.'],
            ['icon' => '🦋', 'title' => 'Species list found on site', 'body' => 'It keeps a site-level list with scientific and common names aligned.'],
        ],
        'notice_title' => '⚠️ About privacy protection:',
        'notice_body' => 'This demo does not show personally identifying information such as poster names or precise GPS coordinates. Only aggregate observation statistics and site-level totals are shown.',
        'back' => 'Back to For organizations',
    ],
    'es' => [
        'page_title' => 'Experiencia demo — ikimon for Business',
        'meta_description' => 'Un demo de ikimon con datos reales de I-KAN Co., Ltd. para ver cómo se acumulan y se revisan después los registros de naturaleza.',
        'badge' => 'Demo interactiva — datos reales',
        'hero_title' => 'Mira cómo los registros de observación se acumulan por lugar.',
        'hero_body' => 'Este demo usa datos reales de campo de <strong>I-KAN Co., Ltd.</strong> para mostrar cómo ikimon acumula registros naturales locales y los hace más fáciles de revisar después.',
        'stat_labels' => ['Observaciones', 'Especies confirmadas', 'Listo para revisar'],
        'season_value' => 'Estación',
        'cta' => 'Ver el resumen',
        'info_title' => 'Qué muestra este demo',
        'features' => [
            ['icon' => '📊', 'title' => 'Notas de resumen', 'body' => 'Una capa interna para revisar rápido cómo se expanden y continúan los registros. No es una certificación ni una evaluación.'],
            ['icon' => '🔴', 'title' => 'Especies para vigilar', 'body' => 'Hace más fácil volver a ver registros que coinciden con listas rojas nacionales y prefecturales.'],
            ['icon' => '📋', 'title' => 'Resumen fácil de compartir', 'body' => 'Permite ordenar qué se registró en un sitio antes de preparar informes internos o materiales externos.'],
            ['icon' => '🦋', 'title' => 'Lista de especies encontradas', 'body' => 'Conserva una lista por sitio con nombres científicos y comunes alineados.'],
        ],
        'notice_title' => '⚠️ Sobre la protección de la privacidad:',
        'notice_body' => 'Este demo no muestra información personal identificable como nombres de usuarios ni coordenadas GPS exactas. Solo se muestran estadísticas agregadas y totales del sitio.',
        'back' => 'Volver a Para organizaciones',
    ],
    'pt-BR' => [
        'page_title' => 'Experiência demo — ikimon for Business',
        'meta_description' => 'Um demo do ikimon com dados reais da I-KAN Co., Ltd. para ver como os registros da natureza se acumulam e podem ser revistos depois.',
        'badge' => 'Demo interativa — dados reais',
        'hero_title' => 'Veja como os registros de observação se acumulam lugar por lugar.',
        'hero_body' => 'Este demo usa dados reais de campo da <strong>I-KAN Co., Ltd.</strong> para mostrar como o ikimon acumula registros locais da natureza e facilita a revisão posterior.',
        'stat_labels' => ['Observações', 'Espécies confirmadas', 'Pronto para rever'],
        'season_value' => 'Sazonal',
        'cta' => 'Ver o resumo',
        'info_title' => 'O que este demo mostra',
        'features' => [
            ['icon' => '📊', 'title' => 'Notas de resumo dos registros', 'body' => 'Uma camada interna para revisar rapidamente como os registros se espalham e continuam ao longo do tempo. Não é certificação nem pontuação.'],
            ['icon' => '🔴', 'title' => 'Espécies para acompanhar', 'body' => 'Facilita rever registros que coincidem com listas vermelhas nacionais e provinciais.'],
            ['icon' => '📋', 'title' => 'Resumo fácil de compartilhar', 'body' => 'Organiza o que foi registrado no local antes de relatórios internos ou materiais externos.'],
            ['icon' => '🦋', 'title' => 'Lista de espécies encontradas', 'body' => 'Mantém uma lista por local com nomes científicos e comuns alinhados.'],
        ],
        'notice_title' => '⚠️ Sobre proteção de privacidade:',
        'notice_body' => 'Este demo não mostra informações pessoais identificáveis, como nomes de usuários ou coordenadas GPS exatas. Só aparecem estatísticas agregadas e totais do local.',
        'back' => 'Voltar para Para organizações',
    ],
];

$copy = $copyByLang[$documentLang] ?? $copyByLang['en'];
$pageTitle = $copy['page_title'];
?>
<!DOCTYPE html>
<html lang="<?= htmlspecialchars($documentLang) ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($pageTitle); ?></title>
    <meta name="description" content="<?= htmlspecialchars($copy['meta_description']) ?>">
    <meta name="robots" content="noindex, nofollow">
    <?php include __DIR__ . '/../components/meta.php'; ?>
    <style>
        .demo-hero { min-height: 80vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 120px 24px 60px; position: relative; overflow: hidden; }
        .demo-hero::before { content: ''; position: absolute; top: -200px; right: -200px; width: 600px; height: 600px; background: radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%); border-radius: 50%; pointer-events: none; }
        .demo-badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 20px; border-radius: 100px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); font-size: 12px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #059669; margin-bottom: 32px; }
        .demo-badge .pulse { width: 8px; height: 8px; border-radius: 50%; background: #10b981; animation: pulse-ring 2s ease infinite; }
        @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); } 70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
        .demo-title { font-size: clamp(32px, 6vw, 56px); font-weight: 900; line-height: 1.15; letter-spacing: -1px; margin-bottom: 24px; }
        .demo-subtitle { font-size: clamp(15px, 2vw, 18px); line-height: 1.8; max-width: 640px; margin: 0 auto 48px; opacity: 0.7; }
        .demo-subtitle strong { opacity: 1; color: var(--color-text, #111); }
        .demo-stats { display: flex; gap: 24px; justify-content: center; flex-wrap: wrap; margin-bottom: 48px; }
        .demo-stat { padding: 20px 28px; border-radius: 16px; background: var(--color-bg-elevated, #fff); border: 1px solid var(--color-border, #e5e7eb); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04); text-align: center; min-width: 140px; }
        .demo-stat .num { font-size: 36px; font-weight: 900; display: block; line-height: 1.1; color: var(--color-text, #111); }
        .demo-stat .num.green { color: #10b981; }
        .demo-stat .label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; opacity: 0.5; margin-top: 6px; }
        .demo-cta { display: inline-flex; align-items: center; gap: 12px; padding: 18px 40px; border-radius: 100px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; font-size: 18px; font-weight: 800; text-decoration: none; transition: all 0.3s ease; box-shadow: 0 8px 32px rgba(16, 185, 129, 0.25); }
        .demo-info { max-width: 800px; margin: 0 auto; padding: 60px 24px 80px; }
        .demo-info h2 { font-size: 24px; font-weight: 900; margin-bottom: 32px; text-align: center; }
        .demo-features { display: grid; gap: 20px; }
        @media (min-width: 640px) { .demo-features { grid-template-columns: repeat(2, 1fr); } }
        .demo-feature { padding: 24px; border-radius: 16px; background: var(--color-bg-elevated, #fff); border: 1px solid var(--color-border, #e5e7eb); }
        .demo-feature .icon { font-size: 28px; margin-bottom: 12px; }
        .demo-feature h3 { font-size: 16px; font-weight: 800; margin-bottom: 8px; }
        .demo-feature p { font-size: 13px; line-height: 1.7; opacity: 0.65; }
        .demo-notice { margin-top: 40px; padding: 16px 24px; border-radius: 12px; background: #fffbeb; border: 1px solid #fde68a; font-size: 12px; color: #92400e; line-height: 1.7; }
        .demo-notice strong { color: #78350f; }
        .demo-back { display: inline-flex; align-items: center; gap: 6px; margin-top: 40px; font-size: 14px; font-weight: 700; color: #10b981; text-decoration: none; }
    </style>
</head>
<body>
    <?php include __DIR__ . '/../components/nav.php'; ?>
    <main class="demo-hero">
        <div class="demo-badge"><span class="pulse"></span><?= htmlspecialchars($copy['badge']) ?></div>
        <h1 class="demo-title"><?= htmlspecialchars($copy['hero_title']) ?></h1>
        <p class="demo-subtitle"><?= $copy['hero_body'] ?></p>
        <div class="demo-stats">
            <div class="demo-stat"><span class="num"><?php echo $obsCount; ?></span><span class="label"><?= htmlspecialchars($copy['stat_labels'][0]) ?></span></div>
            <div class="demo-stat"><span class="num"><?php echo $speciesCount; ?></span><span class="label"><?= htmlspecialchars($copy['stat_labels'][1]) ?></span></div>
            <div class="demo-stat"><span class="num green"><?= htmlspecialchars($copy['season_value']) ?></span><span class="label"><?= htmlspecialchars($copy['stat_labels'][2]) ?></span></div>
        </div>
        <a href="report.php" class="demo-cta"><?= htmlspecialchars($copy['cta']) ?> <span class="arrow">→</span></a>
    </main>

    <section class="demo-info">
        <h2><?= htmlspecialchars($copy['info_title']) ?></h2>
        <div class="demo-features">
            <?php foreach ($copy['features'] as $feature): ?>
                <div class="demo-feature"><div class="icon"><?= htmlspecialchars($feature['icon']) ?></div><h3><?= htmlspecialchars($feature['title']) ?></h3><p><?= htmlspecialchars($feature['body']) ?></p></div>
            <?php endforeach; ?>
        </div>
        <div class="demo-notice"><strong><?= htmlspecialchars($copy['notice_title']) ?></strong> <?= htmlspecialchars($copy['notice_body']) ?></div>
        <div style="text-align: center;"><a href="/for-business/" class="demo-back">← <?= htmlspecialchars($copy['back']) ?></a></div>
    </section>

    <?php include __DIR__ . '/../components/footer.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">lucide.createIcons();</script>
</body>
</html>
