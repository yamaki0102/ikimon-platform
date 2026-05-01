<?php
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CspNonce.php';
require_once __DIR__ . '/../libs/BrandMessaging.php';
require_once __DIR__ . '/../libs/Lang.php';
Auth::init();
Lang::init();
CspNonce::sendHeader();

$isLoggedIn = Auth::isLoggedIn();
$ctaHref = $isLoggedIn ? 'post.php' : 'login.php?redirect=post.php';
$documentLang = method_exists('Lang', 'current') ? Lang::current() : 'ja';
$documentLangKey = strtolower($documentLang);
$ctaLabel = $isLoggedIn
    ? __('about_page.cta_primary_logged_in', 'Start observing')
    : __('about_page.cta_primary_logged_out', 'Start free');

$meta_title = __('about_page.meta_title', 'Why ikimon exists — Nature connects children and towns | ikimon');
$regionalMessaging = BrandMessaging::regionalRevitalization();
$supportPlans = [
    $regionalMessaging['free_plan'],
    $regionalMessaging['community_plan'],
    $regionalMessaging['public_plan'],
];
$meta_description = __('about_page.meta_description', $regionalMessaging['about_meta_description']);
$signatureName = $documentLang === 'ja' ? '八巻 毅' : 'Tsuyoshi Yamaki';
$signatureTitle = $documentLang === 'ja' ? 'IKIMON株式会社 代表' : 'Founder, IKIMON Co., Ltd.';
$contactLocation = $documentLang === 'ja' ? '静岡県浜松市' : 'Hamamatsu, Shizuoka';
$fieldLoopContent = match ($documentLangKey) {
    'ja' => [
        'toc' => 'フィールドループ',
        'title' => 'フィールドループ',
        'lead' => '不確かな観測を、段階的に解像度の高い知識へ育てていく ikimon.life の仕組みです。',
        'trust' => 'AI は確定役ではなく、候補を広げる役です。',
        'intro' => 'ikimon.life は、その場で完璧に種名を当てることより、観測を失わずに残し、あとから検証と学習で精度を上げていくことを重視します。',
        'stages' => [
            ['title' => '衛星データ・現地観測', 'body' => '見落としを減らし、観測候補を広く拾います。'],
            ['title' => 'フィールドスキャン・ガイド・ノート', 'body' => '画像、場所、季節、メモを残し、文脈を失わないようにします。'],
            ['title' => 'AI同定・市民同定', 'body' => '科・属・種の候補を出し、次に確かめるべき方向を絞ります。'],
            ['title' => '専門家同定', 'body' => '重要観測を検証し、保留と確定の基準を管理します。'],
            ['title' => '研究資料化', 'body' => '再利用できる証拠として整理し、出典と条件を固定します。'],
            ['title' => '集合知アップデート', 'body' => 'ガイド、判別点、地域知を更新します。'],
            ['title' => 'AIアップデート', 'body' => '検証条件を満たした知見だけを、次の候補提示改善へ戻します。'],
        ],
        'after_loop' => 'この循環により、同じ地域・同じ生きものでも、次の観測ほど見つけやすく、学びやすく、確かめやすくなります。',
        'ladder_title' => '証拠の階段',
        'ladder_intro' => '有用性と確定性は同じではありません。ikimon.life では、観測の価値と証拠の強さを分けて扱います。',
        'ladder_use_label' => '使える場面',
        'ladder_not_label' => '使わない場面',
        'ladder_rows' => [
            ['label' => '科・属レベル', 'use' => '分布、季節性、初学者参加、ホットスポット把握', 'avoid' => '稀少種の確定'],
            ['label' => '種レベル候補', 'use' => '学習、追加観察、レビュー優先順位付け', 'avoid' => '単独での確定判断'],
            ['label' => '専門家確認', 'use' => '重要観測の確定、基準管理', 'avoid' => '自動大量確定'],
            ['label' => '研究資料・更新対象', 'use' => 'ガイド更新、モデル更新、分析', 'avoid' => '生データの無差別投入'],
        ],
        'roles_title' => 'だれが何をするか',
        'roles' => [
            ['title' => '観測者', 'body' => '見つけて、残して、文脈を渡す人。'],
            ['title' => 'AI', 'body' => '確定せず、候補と見落とし防止を支える道具。'],
            ['title' => '市民同定者', 'body' => '知識を持ち寄り、候補を絞り込む人。'],
            ['title' => '専門家', 'body' => '基準を管理し、重要観測を確かめる人。'],
        ],
        'coarse_title' => '科・属レベルでも価値がある理由',
        'coarse_body' => '種名が分からなくても、科や属の情報が集まるだけで、地域の変化、季節の偏り、異変の兆し、観測の空白地帯は見えてきます。',
        'coarse_points' => [
            '観測数を増やせる',
            '初学者が参加しやすい',
            'あとから解像度を上げられる',
        ],
        'coarse_note' => 'ただし、保全上重要な判断や稀少種の確定は、より高い証拠階層で扱います。',
        'faq_title' => '誤解されやすい点',
        'faq' => [
            ['q' => 'AIが勝手に正解を決めるのですか？', 'a' => 'いいえ。AI同定は候補提示であり、確定ではありません。'],
            ['q' => '多数決で種名が決まるのですか？', 'a' => 'いいえ。市民同定は知識形成に参加する層ですが、重要観測の確定は検証プロセスを通ります。'],
            ['q' => '間違った観測も学習されるのですか？', 'a' => 'いいえ。更新対象に入るのは、整理と検証条件を満たした知見だけです。'],
        ],
    ],
    'es' => [
        'toc' => 'Field Loop',
        'title' => 'Field Loop',
        'lead' => 'Es el sistema de ikimon.life para convertir observaciones inciertas en conocimiento de mayor resolución paso a paso.',
        'trust' => 'La IA no decide la respuesta final. Amplía las hipótesis.',
        'intro' => 'ikimon.life prioriza no perder observaciones y aumentar su resolución después mediante validación y aprendizaje, en lugar de exigir una identificación perfecta en el momento.',
        'stages' => [
            ['title' => 'Datos satelitales y observación de campo', 'body' => 'Amplían la captura de señales y reducen omisiones.'],
            ['title' => 'FieldScan, guías y notas', 'body' => 'Conservan imagen, lugar, estación y contexto.'],
            ['title' => 'IA e identificación ciudadana', 'body' => 'Proponen familia, género o especie candidata.'],
            ['title' => 'Identificación experta', 'body' => 'Verifica observaciones importantes y administra el criterio.'],
            ['title' => 'Conversión en material de investigación', 'body' => 'Ordena la evidencia para que pueda reutilizarse.'],
            ['title' => 'Actualización del conocimiento colectivo', 'body' => 'Mejora guías, puntos de distinción y conocimiento local.'],
            ['title' => 'Actualización de IA', 'body' => 'Solo devuelve al modelo conocimiento que superó las condiciones de validación.'],
        ],
        'after_loop' => 'Con este ciclo, cada observación futura se vuelve más fácil de encontrar, aprender y verificar.',
        'ladder_title' => 'Escalera de evidencia',
        'ladder_intro' => 'Utilidad y certeza no son lo mismo. ikimon.life separa el valor de observación de la fuerza de la evidencia.',
        'ladder_use_label' => 'Util para',
        'ladder_not_label' => 'No para',
        'ladder_rows' => [
            ['label' => 'Familia o género', 'use' => 'distribución, estacionalidad, participación inicial, puntos calientes', 'avoid' => 'confirmación de especies raras'],
            ['label' => 'Especie candidata', 'use' => 'aprendizaje, observación adicional, priorización de revisión', 'avoid' => 'confirmación por sí sola'],
            ['label' => 'Confirmación experta', 'use' => 'confirmación de observaciones importantes, control de criterio', 'avoid' => 'confirmación automática masiva'],
            ['label' => 'Material de investigación / actualización', 'use' => 'actualización de guías, modelos y análisis', 'avoid' => 'volcado indiscriminado de datos brutos'],
        ],
        'roles_title' => 'Quién hace qué',
        'roles' => [
            ['title' => 'Observador', 'body' => 'Encuentra, registra y transmite contexto.'],
            ['title' => 'IA', 'body' => 'Herramienta que sugiere candidatos y reduce omisiones.'],
            ['title' => 'Identificador ciudadano', 'body' => 'Aporta conocimiento y estrecha candidatos.'],
            ['title' => 'Experto', 'body' => 'Administra criterios y verifica observaciones importantes.'],
        ],
        'coarse_title' => 'Por qué familia o género siguen siendo útiles',
        'coarse_body' => 'Incluso sin nombre de especie, acumular información de familia o género ya muestra cambios locales, sesgos estacionales, señales anómalas y vacíos de observación.',
        'coarse_points' => [
            'Aumenta el volumen de observaciones',
            'Reduce la barrera de entrada',
            'Permite aumentar la resolución después',
        ],
        'coarse_note' => 'Las decisiones de conservación sensibles y la confirmación de especies raras se tratan en niveles de evidencia más altos.',
        'faq_title' => 'Puntos que suelen malinterpretarse',
        'faq' => [
            ['q' => '¿La IA decide sola la respuesta correcta?', 'a' => 'No. La IA solo propone candidatos.'],
            ['q' => '¿El nombre se decide por mayoría?', 'a' => 'No. La identificación ciudadana participa en la formación de conocimiento, pero las observaciones importantes pasan por validación.'],
            ['q' => '¿También se aprende de observaciones erróneas?', 'a' => 'No. Solo entra en actualización el conocimiento que cumple condiciones de organización y validación.'],
        ],
    ],
    'pt-br', 'pt' => [
        'toc' => 'Field Loop',
        'title' => 'Field Loop',
        'lead' => 'Este e o sistema do ikimon.life para transformar observacoes incertas em conhecimento de maior resolucao, etapa por etapa.',
        'trust' => 'A IA nao decide a resposta final. Ela amplia as hipoteses.',
        'intro' => 'O ikimon.life prioriza nao perder observacoes e aumentar sua resolucao depois, com validacao e aprendizado, em vez de exigir identificacao perfeita no momento do registro.',
        'stages' => [
            ['title' => 'Dados de satelite e observacao de campo', 'body' => 'Ampliam a captura de sinais e reduzem omissoes.'],
            ['title' => 'FieldScan, guias e notas', 'body' => 'Guardam imagem, lugar, estacao e contexto.'],
            ['title' => 'IA e identificacao cidada', 'body' => 'Sugerem familia, genero ou especie candidata.'],
            ['title' => 'Identificacao especializada', 'body' => 'Verifica observacoes importantes e administra o criterio.'],
            ['title' => 'Material de pesquisa', 'body' => 'Organiza a evidencia para reuso.'],
            ['title' => 'Atualizacao do conhecimento coletivo', 'body' => 'Melhora guias, pontos de distincao e conhecimento local.'],
            ['title' => 'Atualizacao de IA', 'body' => 'So devolve ao modelo o conhecimento que passou pelas condicoes de validacao.'],
        ],
        'after_loop' => 'Com esse ciclo, cada observacao futura fica mais facil de encontrar, aprender e verificar.',
        'ladder_title' => 'Escada de evidencia',
        'ladder_intro' => 'Utilidade e certeza nao sao a mesma coisa. O ikimon.life separa o valor da observacao da forca da evidencia.',
        'ladder_use_label' => 'Util para',
        'ladder_not_label' => 'Nao para',
        'ladder_rows' => [
            ['label' => 'Familia ou genero', 'use' => 'distribuicao, sazonalidade, entrada de iniciantes, hotspots', 'avoid' => 'confirmacao de especies raras'],
            ['label' => 'Especie candidata', 'use' => 'aprendizado, observacao adicional, priorizacao de revisao', 'avoid' => 'confirmacao isolada'],
            ['label' => 'Confirmacao especializada', 'use' => 'confirmacao de observacoes importantes, controle de criterio', 'avoid' => 'confirmacao automatica em massa'],
            ['label' => 'Material de pesquisa / atualizacao', 'use' => 'atualizacao de guias, modelos e analises', 'avoid' => 'entrada indiscriminada de dados brutos'],
        ],
        'roles_title' => 'Quem faz o que',
        'roles' => [
            ['title' => 'Observador', 'body' => 'Encontra, registra e transmite contexto.'],
            ['title' => 'IA', 'body' => 'Ferramenta que sugere candidatos e reduz omissoes.'],
            ['title' => 'Identificador cidadao', 'body' => 'Traz conhecimento e afunila candidatos.'],
            ['title' => 'Especialista', 'body' => 'Administra criterios e verifica observacoes importantes.'],
        ],
        'coarse_title' => 'Por que familia ou genero ainda tem valor',
        'coarse_body' => 'Mesmo sem nome de especie, acumular informacao de familia ou genero ja revela mudancas locais, vieses sazonais, sinais anormais e vazios de observacao.',
        'coarse_points' => [
            'Aumenta o volume de observacoes',
            'Reduz a barreira de entrada',
            'Permite elevar a resolucao depois',
        ],
        'coarse_note' => 'Decisoes sensiveis de conservacao e confirmacao de especies raras ficam em niveis de evidencia mais altos.',
        'faq_title' => 'Pontos que geram mal-entendido',
        'faq' => [
            ['q' => 'A IA decide sozinha a resposta correta?', 'a' => 'Nao. A IA apenas sugere candidatos.'],
            ['q' => 'O nome e decidido por maioria?', 'a' => 'Nao. A identificacao cidada participa da formacao de conhecimento, mas observacoes importantes passam por validacao.'],
            ['q' => 'Observacoes erradas tambem entram no aprendizado?', 'a' => 'Nao. So entra na atualizacao o conhecimento que cumpre as condicoes de organizacao e validacao.'],
        ],
    ],
    default => [
        'toc' => 'Field Loop',
        'title' => 'Field Loop',
        'lead' => 'This is ikimon.life\'s system for turning uncertain observations into higher-resolution knowledge over time.',
        'trust' => 'AI does not make the final call. It expands the candidate set.',
        'intro' => 'ikimon.life prioritizes preserving observations and improving their resolution later through validation and learning, instead of demanding a perfect species name at the moment of capture.',
        'stages' => [
            ['title' => 'Satellite data and field observation', 'body' => 'Broaden signal capture and reduce blind spots.'],
            ['title' => 'FieldScan, guides, and notes', 'body' => 'Preserve image, place, season, and context.'],
            ['title' => 'AI identification and citizen identification', 'body' => 'Propose family, genus, or species candidates.'],
            ['title' => 'Expert identification', 'body' => 'Verify important observations and manage the threshold for certainty.'],
            ['title' => 'Research materialization', 'body' => 'Organize reusable evidence with traceable conditions.'],
            ['title' => 'Collective knowledge update', 'body' => 'Improve guides, distinction points, and local knowledge.'],
            ['title' => 'AI update', 'body' => 'Feed back only knowledge that passed validation conditions.'],
        ],
        'after_loop' => 'This cycle makes each future observation easier to find, learn from, and verify.',
        'ladder_title' => 'Evidence Ladder',
        'ladder_intro' => 'Usefulness and certainty are not the same. ikimon.life separates observation value from evidence strength.',
        'ladder_use_label' => 'Useful for',
        'ladder_not_label' => 'Not for',
        'ladder_rows' => [
            ['label' => 'Family or genus', 'use' => 'distribution, seasonality, beginner participation, hotspot mapping', 'avoid' => 'rare species confirmation'],
            ['label' => 'Species candidate', 'use' => 'learning, follow-up observation, review prioritization', 'avoid' => 'standalone confirmation'],
            ['label' => 'Expert confirmation', 'use' => 'important-record confirmation, threshold management', 'avoid' => 'mass automatic confirmation'],
            ['label' => 'Research material / update target', 'use' => 'guide updates, model updates, analysis', 'avoid' => 'indiscriminate ingestion of raw data'],
        ],
        'roles_title' => 'Who does what',
        'roles' => [
            ['title' => 'Observer', 'body' => 'Finds, records, and passes context forward.'],
            ['title' => 'AI', 'body' => 'A tool that suggests candidates and reduces omissions.'],
            ['title' => 'Citizen identifier', 'body' => 'Brings knowledge and narrows candidates.'],
            ['title' => 'Expert', 'body' => 'Manages standards and verifies important observations.'],
        ],
        'coarse_title' => 'Why family or genus level still matters',
        'coarse_body' => 'Even without a species name, accumulating family or genus information can reveal local change, seasonal bias, anomaly signals, and observation gaps.',
        'coarse_points' => [
            'It increases observation volume',
            'It lowers the barrier for beginners',
            'It keeps the door open for later resolution upgrades',
        ],
        'coarse_note' => 'Sensitive conservation decisions and rare-species confirmation are handled at higher evidence tiers.',
        'faq_title' => 'Common misunderstandings',
        'faq' => [
            ['q' => 'Does AI decide the correct answer on its own?', 'a' => 'No. AI identification only proposes candidates.'],
            ['q' => 'Is the name decided by majority vote?', 'a' => 'No. Citizen identification participates in knowledge formation, but important records still go through validation.'],
            ['q' => 'Are wrong observations also used for learning?', 'a' => 'No. Only knowledge that meets organization and validation conditions enters the update loop.'],
        ],
    ],
};
$aboutText = [
    'hero_title' => __('about_page.hero_title', 'Nature connects children and towns.'),
    'hero_sub' => __('about_page.hero_sub', 'The regional revitalization model ikimon.life is aiming for'),
    'toc_label' => __('about_page.toc_label', 'Contents'),
    'toc_field_loop' => $fieldLoopContent['toc'],
    'toc_origin' => __('about_page.toc_origin', 'Origin story'),
    'toc_regional' => __('about_page.toc_regional', 'Why regional revitalization'),
    'toc_disappearing' => __('about_page.toc_disappearing', 'At-risk municipalities'),
    'toc_sustainability' => __('about_page.toc_sustainability', 'A sustainable model'),
    'origin_title' => __('about_page.origin_title', 'Origin story'),
    'origin_resolution_title' => __('about_page.origin_resolution_title', 'When a place becomes clearer, attachment grows'),
    'regional_title' => __('about_page.regional_title', 'Why regional revitalization'),
    'regional_adults_title' => __('about_page.regional_adults_title', 'It is not only about children. Adults need to feel alive too.'),
    'disappearing_title' => __('about_page.disappearing_title', $regionalMessaging['disappearing_section_heading']),
    'sustainability_title' => __('about_page.sustainability_title', 'A sustainable model'),
    'cta_heading' => __('about_page.cta_heading', 'Want to connect nature and your town together?'),
    'cta_secondary' => __('about_page.cta_secondary', 'For companies and municipalities'),
    'more_label' => __('about_page.more_label', 'Learn more'),
    'guide_brain_title' => __('about_page.guide_brain_title', 'What happens to the brain when you walk in nature?'),
    'guide_brain_desc' => __('about_page.guide_brain_desc', 'The science behind walking and observing living things'),
    'guide_steps_title' => __('about_page.guide_steps_title', '9,800 steps a day and lower dementia risk'),
    'guide_steps_desc' => __('about_page.guide_steps_desc', 'A plain-language introduction to the large JAMA Neurology study'),
    'guide_nature_positive_title' => __('about_page.guide_nature_positive_title', 'Nature Positive complete guide'),
    'guide_nature_positive_desc' => __('about_page.guide_nature_positive_desc', 'The full picture of walking, observing, and health'),
    'guide_archive_title' => __('about_page.guide_archive_title', '100-year ecosystem archive'),
    'guide_archive_desc' => __('about_page.guide_archive_desc', 'Why keeping records matters, and how observations in 2026 become a baseline for the future'),
    'guide_methodology_title' => __('about_page.guide_methodology_title', 'Data policy and evaluation methods'),
    'guide_methodology_desc' => __('about_page.guide_methodology_desc', 'How data is handled and how monitoring reference indices are interpreted'),
    'origin_lead' => __('about_page.origin_lead', 'Turning over the stepping stones at my childhood home, I found a roach under the stone. That was my first encounter with making biodiversity a memory that stays.'),
    'origin_intro_paragraphs' => [
        __('about_page.origin_intro_1', "Hokkaido, Iwanai-cho was my first hometown.\nI lived there from kindergarten through first grade of elementary school."),
        __('about_page.origin_intro_2', "There was the sea, there were mountains, and there was a river. And in front of the house, there was a garden that felt like a jungle to me back then."),
        __('about_page.origin_intro_3', "I flipped the paving stones by the entrance and caught the roach. I tried raising it and observed it every day. In autumn, I also went to the ski slopes and caught more than ten grasshoppers.\nThose were my happiest days."),
        __('about_page.origin_intro_4', "But I have no photos from that time. I sometimes think the attachment would have grown even more if those moments had been recorded."),
        __('about_page.origin_insight_1', "Without those stepping stones, I would never have met the roach. Without a maintained ski area, I would not have that grasshopper memory either."),
        __('about_page.origin_insight_2', "Untouched nature is valuable, of course.\nBut it is often managed places—front-yard flagstones, mowed ski runs, maintained satoyama—where children get their first encounters with living things."),
    ],
    'origin_resolution_paragraphs' => [
        __('about_page.origin_resolution_1', "On the streets I walk every day, have you noticed what kinds of street trees stand there? Can you tell the difference between a white-tailed eagle and a hawfinch?"),
        __('about_page.origin_resolution_2', "You don't have to know to live your life. But once you do, the same path looks a little different."),
        __('about_page.origin_resolution_3', "Knowing a name. Noticing seasonal changes. That raises the resolution of the place you live in."),
        __('about_page.origin_resolution_accent_1', "When resolution rises, attachment is born.\nWhen attachment rises, you start caring for that place."),
        __('about_page.origin_resolution_4', "ikimon.life wants to create that trigger:\nfind it, record it, review it.\nThat alone gradually changes our relationship with place."),
    ],
    'origin_final' => __('about_page.origin_final', "I don't want us to lose the bonds between children and nature."),
    'regional_intro_paragraphs' => [
        __('about_page.regional_intro_1', "Regional revitalization is not something one person can do alone.\nI don't think it can be achieved by ikimon.life alone either."),
        __('about_page.regional_intro_2', "But when adults in the community—parents, teachers, neighbors—create chances to walk in nature with children, I believe change begins."),
        __('about_page.regional_intro_3', "Walking in nature connects heart and body health.\nLearning about local nature through observation builds attachment.\nThat can become the energy that keeps a place alive."),
        __('about_page.regional_intro_4', "ikimon.life wants to be a tool for that loop.\nAnd it is meant to be used by everyone who lives in the place."),
        __('about_page.regional_intro_5', "This is not just a gut feeling. Multiple national studies keep saying the same thing."),
    ],
    'regional_insight_1_title' => __('about_page.regional_insight_1_title', 'Place attachment is discussed as a combination of nature and human connection.'),
    'regional_insight_1_body' => __('about_page.regional_insight_1_body', 'In a survey of junior high students in Choshi City, the top reason for liking their hometown was “rich nature” (72.8%), followed by “kind and friendly local people” (58.3%).\nIn a Hamamatsu youth survey, 81.8% answered that they like Hamamatsu, with interpersonal ties and natural environment as major attractions.'),
    'regional_insight_2_title' => __('about_page.regional_insight_2_title', 'Children say they want to return because they feel:\n“rich nature,” “kind people,” and “the place where they were born.”'),
    'regional_insight_2_body' => __('about_page.regional_insight_2_body', 'In a survey in Iijima Town, the most frequent reason for wanting to live there was “abundant nature and good air” (45.5%).\nEven among those who were “somewhat likely to return,” “liveable nature” was the top answer (62.5%), followed by “people’s kindness and local ties” (12.5%).'),
    'regional_insight_3_title' => __('about_page.regional_insight_3_title', 'A trustworthy adult outside the family gives children a sense of safety.'),
    'regional_insight_3_body' => __('about_page.regional_insight_3_body', 'In a survey in Joetsu City, 55.18% of children reported having a reliable adult, and 51.71% reported having an adult who takes care of them.\nNatural observation settings naturally create such connections with adults beyond family.'),
    'regional_adult_intro_paragraphs' => [
        __('about_page.regional_adult_intro_1', "When speaking about regional revitalization, discussions often become “how to bring back young people” or “how to increase births.”\nBut if the adults who live there cannot stay mentally and physically healthy, there will be no room to watch over children, and no base to support the place."),
        __('about_page.regional_adult_intro_2', "There is also scientific evidence that walking in nature is effective."),
    ],
    'regional_adult_insight_brain_title' => __('about_page.regional_adult_insight_brain_title', 'Walking in natural environments activates the prefrontal cortex.'),
    'regional_adult_insight_brain_body' => __('about_page.regional_adult_insight_brain_body', 'Compared with urban environments, walking outdoors reduces stress hormones and supports recovery of attention and creativity.\nObserving living things requires active attention, which strengthens cognitive engagement.'),
    'regional_adult_insight_steps_title' => __('about_page.regional_adult_insight_steps_title', 'Taking 9,800 steps a day is associated with 51% lower dementia risk.'),
    'regional_adult_insight_steps_body' => __('about_page.regional_adult_insight_steps_body', 'A large JAMA Neurology study (78,430 participants) found this.\nWalking requires no special tools and is one of the simplest healthy habits.\nAdding observation adds curiosity and a sense of achievement beyond walking alone.'),
    'regional_adult_tail_1' => __('about_page.regional_adult_tail_1', "If adults are healthy, relaxed, and cheerful,\nchildren can go outside with confidence.\nWhen children walk, adults also move more naturally and feel lighter."),
    'regional_adult_tail_2' => __('about_page.regional_adult_tail_2', "Natural observation creates this cycle without special interventions:\nchildren’s curiosity, adult health, and intergenerational connection."),
    'regional_adult_tail_3' => __('about_page.regional_adult_tail_3', "Natural observation is not the whole answer to regional revitalization,\nbut it can surely help."),
    'disappearing_intro_paragraphs' => [
        __('about_page.disappearing_intro_1', "In April 2024, the Population Strategy Council report made many people rethink what population decline can mean for communities."),
        __('about_page.disappearing_intro_2', "{$regionalMessaging['disappearing_population_copy']}\n{$regionalMessaging['disappearing_count_copy']}\n{$regionalMessaging['disappearing_ratio_copy']}"),
    ],
    'disappearing_stat_label_1' => __('about_page.disappearing_stat_label_1', 'At-risk municipalities'),
    'disappearing_stat_label_2' => __('about_page.disappearing_stat_label_2', 'Total municipalities'),
    'disappearing_severity_intro' => __('about_page.disappearing_severity_intro', 'Some regions are especially severe.'),
    'disappearing_region_examples' => [
        ['region' => __('about_page.disappearing_region_minamimaki', 'Minamimaki Village, Gunma'), 'rate' => '-88.0%'],
        ['region' => __('about_page.disappearing_region_sotogahama', 'Sotogahama Town, Aomori'), 'rate' => '-87.5%'],
        ['region' => __('about_page.disappearing_region_uoshinai', 'Uoshinai City, Hokkaido'), 'rate' => '-86.7%'],
        ['region' => __('about_page.disappearing_region_akita', 'Akita Prefecture (whole)'), 'rate' => '96% at risk'],
        ['region' => __('about_page.disappearing_region_aomori', 'Aomori Prefecture (whole)'), 'rate' => '87.5% at risk'],
    ],
    'disappearing_memory_1' => __('about_page.disappearing_memory_1', "Behind the numbers is somebody's hometown.\nWild places I played in as a child. The stream along my route to school. The ski run in autumn.\nThese are places where I learned to meet living things."),
    'disappearing_memory_2' => __('about_page.disappearing_memory_2', "If a municipality disappears, places where those memories and these encounters were born also disappear."),
    'disappearing_support' => __('about_page.disappearing_support', "{$regionalMessaging['priority_lead']}\n{$regionalMessaging['eligibility_copy']}\nIn the most severe regions, we provide all ikimon.life functions for free."),
    'disappearing_tail_1' => __('about_page.disappearing_tail_1', "I don't believe everything will change overnight.\nBut if even one child in a community comes to say \"I like this place\" through a small trigger from nature, that is enough."),
    'disappearing_tail_2' => __('about_page.disappearing_tail_2', "I want to preserve the memory of growing up here for the next generation."),
    'sustainability_paragraphs' => [
        __('about_page.sustainability_1', "IKIMON Co., Ltd. is a startup led by me alone.\nSmall organizations can move quickly."),
        __('about_page.sustainability_2', "If revenue from Public plans for companies and large municipalities is secured,\nit can sustain the company enough to keep running.\nSo we can provide free access to places with the strongest need."),
    ],
    'sustainability_highlight' => __('about_page.sustainability_highlight', "Because we are small, we can reach the places we want to reach."),
    'sustainability_tail_1' => __('about_page.sustainability_tail_1', "This project has just started.\nStep by step, we continue to grow."),
    'sustainability_tail_2' => __('about_page.sustainability_tail_2', 'Thank you for your support.'),
    'stat_label_1' => __('about_page.stat_label_1', 'shizuoka, Hamamatsu'),
];
$formatMultiline = static function (string $text): string {
    $normalized = str_replace(["\\n", "\r\n", "\r"], "\n", $text);
    return nl2br(htmlspecialchars($normalized, ENT_QUOTES, 'UTF-8'));
};
?>
<!DOCTYPE html>
<html lang="<?= htmlspecialchars($documentLang, ENT_QUOTES, 'UTF-8') ?>">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;600&display=swap" rel="stylesheet">
    <style nonce="<?= CspNonce::attr() ?>">
        /* ── msg: about.php page-scoped styles ── */

        .msg-hero {
            background: linear-gradient(135deg, #0a0f0a 0%, #0f1a12 50%, #0a0f0a 100%);
            color: #e5e7eb;
            padding: 72px 20px 56px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .msg-hero::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -30%;
            width: 80%;
            height: 200%;
            background: radial-gradient(ellipse, rgba(16, 185, 129, 0.06) 0%, transparent 70%);
            pointer-events: none;
        }
        .msg-hero h1 {
            font-family: 'Shippori Mincho', serif;
            font-size: clamp(1.75rem, 4vw, 3rem);
            font-weight: 600;
            letter-spacing: 0.05em;
            line-height: 1.5;
            color: #ffffff;
            margin-bottom: 16px;
            position: relative;
        }
        .msg-hero .msg-hero-sub {
            font-size: clamp(0.875rem, 1.5vw, 1.0625rem);
            color: rgba(255, 255, 255, 0.55);
            letter-spacing: 0.04em;
            margin-bottom: 0;
        }

        /* signature block */
        .msg-signature {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-top: 40px;
            padding-top: 32px;
            border-top: 1px solid var(--md-outline-variant);
        }
        .msg-signature-photo {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            object-fit: cover;
            flex-shrink: 0;
            border: 2px solid rgba(16, 185, 129, 0.3);
        }
        .msg-signature-name {
            font-weight: 700;
            color: var(--md-on-surface);
            font-size: 1rem;
        }
        .msg-signature-title {
            font-size: 0.8125rem;
            color: var(--md-on-surface-variant);
            margin-top: 2px;
        }

        /* ── editorial sections ── */
        .msg-section {
            padding: 64px 20px;
        }
        .msg-section-inner {
            max-width: 680px;
            margin: 0 auto;
        }
        .msg-surface {
            background: var(--md-surface-container);
        }
        .msg-section h2 {
            font-family: 'Shippori Mincho', serif;
            font-size: clamp(1.25rem, 2.5vw, 1.625rem);
            font-weight: 600;
            color: var(--md-on-surface);
            margin-bottom: 32px;
            letter-spacing: 0.03em;
            line-height: 1.5;
        }

        /* lead blockquote */
        .msg-lead {
            border-left: 3px solid var(--md-primary);
            padding-left: 20px;
            font-family: 'Shippori Mincho', serif;
            font-size: clamp(1.0625rem, 2vw, 1.25rem);
            color: var(--md-on-surface);
            line-height: 1.8;
            margin-bottom: 40px;
        }

        /* body text */
        .msg-body p {
            font-size: 1rem;
            line-height: 2.0;
            color: var(--md-on-surface-variant);
            margin-bottom: 20px;
        }
        .msg-body p strong {
            color: var(--md-on-surface);
        }

        /* green accent line */
        .msg-accent {
            color: var(--md-primary);
            font-weight: 600;
            font-size: 1.0625rem;
            line-height: 1.8;
            margin: 28px 0;
        }

        /* large accent (section closer) */
        .msg-accent-lg {
            color: var(--md-primary);
            font-family: 'Shippori Mincho', serif;
            font-weight: 600;
            font-size: clamp(1.125rem, 2vw, 1.375rem);
            line-height: 1.6;
            text-align: center;
            margin: 48px 0 0;
            padding: 32px 0;
            border-top: 1px solid var(--md-outline-variant);
        }

        /* insight blocks */
        .msg-insight {
            display: flex;
            gap: 16px;
            margin: 28px 0;
            align-items: flex-start;
        }
        .msg-insight-num {
            font-family: 'Shippori Mincho', serif;
            font-size: 2rem;
            font-weight: 700;
            color: var(--md-primary);
            line-height: 1;
            flex-shrink: 0;
            margin-top: 2px;
        }
        .msg-insight-body {
            flex: 1;
        }
        .msg-insight-text {
            font-size: 1rem;
            font-weight: 600;
            color: var(--md-on-surface);
            line-height: 1.6;
            margin-bottom: 8px;
        }
        .msg-cite {
            font-size: 0.8125rem;
            color: var(--md-on-surface-variant);
            line-height: 1.6;
        }

        /* stat hero */
        .msg-stat-hero {
            text-align: center;
            padding: 40px 0;
            margin: 32px 0;
            border-top: 1px solid var(--md-outline-variant);
            border-bottom: 1px solid var(--md-outline-variant);
        }
        .msg-stat-row {
            display: flex;
            justify-content: center;
            align-items: baseline;
            gap: 12px;
        }
        .msg-stat-number {
            font-family: 'Montserrat', sans-serif;
            font-size: clamp(2.5rem, 6vw, 3.5rem);
            font-weight: 900;
            color: var(--md-on-surface);
            letter-spacing: -0.02em;
            line-height: 1;
        }
        .msg-stat-slash {
            font-size: clamp(1.5rem, 3vw, 2rem);
            color: var(--md-on-surface-variant);
            font-weight: 300;
        }
        .msg-stat-sub {
            font-size: clamp(1.25rem, 3vw, 1.75rem);
            color: var(--md-on-surface-variant);
            font-weight: 700;
            font-family: 'Montserrat', sans-serif;
        }
        .msg-stat-labels {
            display: flex;
            justify-content: center;
            gap: 40px;
            margin-top: 12px;
        }
        .msg-stat-label {
            font-size: 0.8125rem;
            color: var(--md-on-surface-variant);
            letter-spacing: 0.03em;
        }

        /* examples list */
        .msg-examples {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin: 20px 0;
            padding: 20px;
            border-radius: 12px;
            background: var(--md-surface-container);
            border: 1px solid var(--md-outline-variant);
        }
        .msg-surface .msg-examples {
            background: var(--md-surface);
        }
        .msg-example-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.875rem;
            color: var(--md-on-surface-variant);
            padding: 6px 0;
        }
        .msg-example-item span:last-child {
            font-weight: 700;
            font-family: 'Montserrat', sans-serif;
            color: var(--md-on-surface);
        }

        /* plan blocks */
        .msg-plans {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin: 28px 0;
        }
        .msg-plan-item {
            padding: 20px;
            border-radius: 12px;
            border: 1px solid var(--md-outline-variant);
        }
        .msg-plan-item.msg-plan-free {
            background: rgba(16, 185, 129, 0.06);
            border-color: rgba(16, 185, 129, 0.2);
        }
        .msg-plan-tag {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 999px;
            font-size: 0.6875rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        .msg-plan-free .msg-plan-tag {
            background: var(--md-primary);
            color: #ffffff;
        }
        .msg-plan-item:not(.msg-plan-free) .msg-plan-tag {
            background: var(--md-surface-container);
            color: var(--md-on-surface-variant);
            border: 1px solid var(--md-outline-variant);
        }
        .msg-plan-name {
            font-weight: 700;
            color: var(--md-on-surface);
            font-size: 1rem;
            margin-bottom: 4px;
        }
        .msg-plan-desc {
            font-size: 0.875rem;
            color: var(--md-on-surface-variant);
            line-height: 1.6;
        }

        /* CTA section */
        .msg-cta-section {
            text-align: center;
            padding: 64px 20px;
        }
        .msg-cta-inner {
            max-width: 680px;
            margin: 0 auto;
        }
        .msg-cta-heading {
            font-family: 'Shippori Mincho', serif;
            font-size: clamp(1.25rem, 2.5vw, 1.625rem);
            font-weight: 600;
            color: var(--md-on-surface);
            margin-bottom: 32px;
            letter-spacing: 0.03em;
        }
        .msg-cta-buttons {
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-width: 400px;
            margin: 0 auto 40px;
        }
        .msg-cta-buttons .btn-primary,
        .msg-cta-buttons .btn-secondary {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .msg-contact {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            padding-top: 32px;
            border-top: 1px solid var(--md-outline-variant);
        }
        .msg-contact-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.875rem;
            color: var(--md-on-surface-variant);
        }
        .msg-contact-item a {
            color: var(--md-primary);
        }

        /* guide links (simplified) */
        .msg-guides {
            max-width: 680px;
            margin: 0 auto;
            padding: 0 20px 64px;
        }
        .msg-guides-label {
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--md-on-surface-variant);
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .msg-guide-link {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            border-radius: 12px;
            transition: background 0.2s;
            text-decoration: none;
        }
        .msg-guide-link:hover {
            background: var(--md-surface-container);
        }
        .msg-guide-link .msg-guide-title {
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--md-on-surface);
        }
        .msg-guide-link .msg-guide-desc {
            font-size: 0.75rem;
            color: var(--md-on-surface-variant);
        }
        .msg-guide-link i {
            color: var(--md-on-surface-variant);
            flex-shrink: 0;
        }

        /* field loop */
        .msg-loop-hero {
            border-radius: 20px;
            padding: 28px;
            background:
                radial-gradient(circle at top right, rgba(16, 185, 129, 0.12), transparent 40%),
                linear-gradient(180deg, rgba(5, 30, 20, 0.96), rgba(7, 16, 12, 0.98));
            color: #e5e7eb;
            border: 1px solid rgba(16, 185, 129, 0.18);
            margin-bottom: 24px;
        }
        .msg-loop-hero h2 {
            color: #ffffff;
            margin-bottom: 12px;
        }
        .msg-loop-lead {
            font-size: 1rem;
            line-height: 1.9;
            color: rgba(255, 255, 255, 0.82);
            margin-bottom: 16px;
        }
        .msg-loop-trust {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border-radius: 999px;
            background: rgba(16, 185, 129, 0.14);
            color: #d1fae5;
            font-size: 0.8125rem;
            font-weight: 700;
            letter-spacing: 0.03em;
        }
        .msg-loop-grid {
            display: grid;
            grid-template-columns: repeat(1, minmax(0, 1fr));
            gap: 14px;
            margin: 28px 0 20px;
        }
        .msg-loop-card,
        .msg-role-card,
        .msg-ladder-row,
        .msg-faq-item {
            border: 1px solid var(--md-outline-variant);
            border-radius: 16px;
            background: var(--md-surface-container);
        }
        .msg-loop-card {
            padding: 18px;
        }
        .msg-loop-step {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border-radius: 999px;
            background: rgba(16, 185, 129, 0.12);
            color: var(--md-primary);
            font-size: 0.8125rem;
            font-weight: 800;
            margin-bottom: 12px;
        }
        .msg-loop-card-title,
        .msg-role-title,
        .msg-ladder-label,
        .msg-faq-question {
            font-weight: 700;
            color: var(--md-on-surface);
            line-height: 1.6;
        }
        .msg-loop-card-title {
            margin-bottom: 8px;
        }
        .msg-loop-card-body,
        .msg-role-body,
        .msg-ladder-copy,
        .msg-faq-answer {
            font-size: 0.9375rem;
            color: var(--md-on-surface-variant);
            line-height: 1.8;
        }
        .msg-loop-after {
            margin-top: 16px;
            font-size: 0.9375rem;
            line-height: 1.8;
            color: var(--md-on-surface);
        }
        .msg-subsection-title {
            font-family: 'Shippori Mincho', serif;
            font-size: 1.125rem;
            font-weight: 600;
            color: var(--md-on-surface);
            margin: 40px 0 14px;
            line-height: 1.5;
        }
        .msg-ladder {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 18px;
        }
        .msg-ladder-row {
            padding: 18px;
        }
        .msg-ladder-meta {
            display: grid;
            grid-template-columns: repeat(1, minmax(0, 1fr));
            gap: 8px;
            margin-top: 10px;
        }
        .msg-ladder-copy strong {
            color: var(--md-on-surface);
        }
        .msg-role-grid {
            display: grid;
            grid-template-columns: repeat(1, minmax(0, 1fr));
            gap: 12px;
            margin-top: 18px;
        }
        .msg-role-card,
        .msg-faq-item {
            padding: 18px;
        }
        .msg-coarse-points {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin: 18px 0 12px;
        }
        .msg-coarse-point {
            display: inline-flex;
            align-items: center;
            padding: 8px 12px;
            border-radius: 999px;
            background: rgba(16, 185, 129, 0.09);
            color: var(--md-on-surface);
            font-size: 0.875rem;
            font-weight: 600;
        }
        .msg-faq-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 18px;
        }
        .msg-faq-question {
            margin-bottom: 8px;
        }

        /* ── responsive ── */
        @media (min-width: 640px) {
            .msg-hero {
                padding: 88px 24px 64px;
            }
            .msg-section {
                padding: 80px 24px;
            }
            .msg-cta-buttons {
                flex-direction: row;
                max-width: 500px;
            }
            .msg-cta-buttons .btn-primary,
            .msg-cta-buttons .btn-secondary {
                flex: 1;
            }
            .msg-loop-grid,
            .msg-role-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .msg-ladder-meta {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }
        }
    </style>
</head>
<body class="js-loading pt-14 font-body" style="background:var(--md-surface);color:var(--md-on-surface);">

    <?php include __DIR__ . '/components/nav.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <main>

    <!-- ============================================
         Section 1: Hero
         ============================================ -->
    <section class="msg-hero">
        <h1><?= htmlspecialchars($aboutText['hero_title']) ?></h1>
        <p class="msg-hero-sub"><?= htmlspecialchars($aboutText['hero_sub']) ?></p>
    </section>

    <!-- TOC -->
    <nav class="msg-section" style="padding-top:32px;padding-bottom:0;">
        <div class="msg-section-inner" style="max-width:520px;">
            <div style="background:var(--md-surface-container);border-radius:16px;padding:24px 28px;">
                <p style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--md-on-surface-variant);margin-bottom:14px;"><?= htmlspecialchars($aboutText['toc_label']) ?></p>
                <ol style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px;font-size:0.9375rem;">
                    <li><a href="#field-loop" style="color:var(--md-primary);text-decoration:none;"><?= htmlspecialchars($aboutText['toc_field_loop']) ?></a></li>
                    <li><a href="#origin" style="color:var(--md-primary);text-decoration:none;"><?= htmlspecialchars($aboutText['toc_origin']) ?></a></li>
                    <li><a href="#regional" style="color:var(--md-primary);text-decoration:none;"><?= htmlspecialchars($aboutText['toc_regional']) ?></a></li>
                    <li><a href="#disappearing" style="color:var(--md-primary);text-decoration:none;"><?= htmlspecialchars($aboutText['toc_disappearing']) ?></a></li>
                    <li><a href="#sustainability" style="color:var(--md-primary);text-decoration:none;"><?= htmlspecialchars($aboutText['toc_sustainability']) ?></a></li>
                </ol>
            </div>
        </div>
    </nav>

    <!-- ============================================
         Section 2: Field Loop
         ============================================ -->
    <section id="field-loop" class="msg-section" style="scroll-margin-top:80px;">
        <div class="msg-section-inner">

            <div class="msg-loop-hero">
                <h2><?= htmlspecialchars($fieldLoopContent['title']) ?></h2>
                <p class="msg-loop-lead"><?= htmlspecialchars($fieldLoopContent['lead']) ?></p>
                <p class="msg-loop-lead" style="margin-bottom:18px;"><?= htmlspecialchars($fieldLoopContent['intro']) ?></p>
                <span class="msg-loop-trust"><?= htmlspecialchars($fieldLoopContent['trust']) ?></span>
            </div>

            <div class="msg-loop-grid">
                <?php foreach ($fieldLoopContent['stages'] as $index => $stage): ?>
                <article class="msg-loop-card">
                    <span class="msg-loop-step"><?= $index + 1 ?></span>
                    <p class="msg-loop-card-title"><?= htmlspecialchars($stage['title']) ?></p>
                    <p class="msg-loop-card-body"><?= htmlspecialchars($stage['body']) ?></p>
                </article>
                <?php endforeach; ?>
            </div>

            <p class="msg-loop-after"><?= htmlspecialchars($fieldLoopContent['after_loop']) ?></p>

            <h3 class="msg-subsection-title"><?= htmlspecialchars($fieldLoopContent['ladder_title']) ?></h3>
            <div class="msg-body">
                <p><?= htmlspecialchars($fieldLoopContent['ladder_intro']) ?></p>
            </div>
            <div class="msg-ladder">
                <?php foreach ($fieldLoopContent['ladder_rows'] as $row): ?>
                <article class="msg-ladder-row">
                    <p class="msg-ladder-label"><?= htmlspecialchars($row['label']) ?></p>
                    <div class="msg-ladder-meta">
                        <p class="msg-ladder-copy"><strong><?= htmlspecialchars($fieldLoopContent['ladder_use_label']) ?>:</strong> <?= htmlspecialchars($row['use']) ?></p>
                        <p class="msg-ladder-copy"><strong><?= htmlspecialchars($fieldLoopContent['ladder_not_label']) ?>:</strong> <?= htmlspecialchars($row['avoid']) ?></p>
                    </div>
                </article>
                <?php endforeach; ?>
            </div>

            <h3 class="msg-subsection-title"><?= htmlspecialchars($fieldLoopContent['roles_title']) ?></h3>
            <div class="msg-role-grid">
                <?php foreach ($fieldLoopContent['roles'] as $role): ?>
                <article class="msg-role-card">
                    <p class="msg-role-title"><?= htmlspecialchars($role['title']) ?></p>
                    <p class="msg-role-body"><?= htmlspecialchars($role['body']) ?></p>
                </article>
                <?php endforeach; ?>
            </div>

            <h3 class="msg-subsection-title"><?= htmlspecialchars($fieldLoopContent['coarse_title']) ?></h3>
            <div class="msg-body">
                <p><?= htmlspecialchars($fieldLoopContent['coarse_body']) ?></p>
            </div>
            <div class="msg-coarse-points">
                <?php foreach ($fieldLoopContent['coarse_points'] as $point): ?>
                <span class="msg-coarse-point"><?= htmlspecialchars($point) ?></span>
                <?php endforeach; ?>
            </div>
            <div class="msg-body">
                <p><?= htmlspecialchars($fieldLoopContent['coarse_note']) ?></p>
            </div>

            <h3 class="msg-subsection-title"><?= htmlspecialchars($fieldLoopContent['faq_title']) ?></h3>
            <div class="msg-faq-list">
                <?php foreach ($fieldLoopContent['faq'] as $item): ?>
                <article class="msg-faq-item">
                    <p class="msg-faq-question"><?= htmlspecialchars($item['q']) ?></p>
                    <p class="msg-faq-answer"><?= htmlspecialchars($item['a']) ?></p>
                </article>
                <?php endforeach; ?>
            </div>

        </div>
    </section>

    <!-- ============================================
         Section 3: 原体験 — 岩内の記憶
         ============================================ -->
    <section id="origin" class="msg-section" style="scroll-margin-top:80px;">
        <div class="msg-section-inner">

            <h2><?= htmlspecialchars($aboutText['origin_title']) ?></h2>

            <div class="msg-lead">
                <?= $formatMultiline($aboutText['origin_lead']) ?>
            </div>

            <div class="msg-body">
                <?php foreach (array_slice($aboutText['origin_intro_paragraphs'], 0, 4) as $paragraph): ?>
                <p><?= $formatMultiline($paragraph) ?></p>
                <?php endforeach; ?>

                <p class="msg-accent"><?= $formatMultiline($aboutText['origin_intro_paragraphs'][4] . "\n" . $aboutText['origin_intro_paragraphs'][5]) ?></p>
            </div>

            <h2 style="margin-top: 48px;"><?= htmlspecialchars($aboutText['origin_resolution_title']) ?></h2>

            <div class="msg-body">
                <?php foreach (array_slice($aboutText['origin_resolution_paragraphs'], 0, 3) as $paragraph): ?>
                <p><?= $formatMultiline($paragraph) ?></p>
                <?php endforeach; ?>

                <p class="msg-accent"><?= $formatMultiline($aboutText['origin_resolution_paragraphs'][3]) ?></p>
                <p><?= $formatMultiline($aboutText['origin_resolution_paragraphs'][4]) ?></p>

                <p class="msg-accent-lg"><?= $formatMultiline($aboutText['origin_final']) ?></p>
            </div>

        </div>
    </section>

    <!-- ============================================
         Section 3: なぜ、地域創生なのか
         ============================================ -->
    <section id="regional" class="msg-section msg-surface" style="scroll-margin-top:80px;">
        <div class="msg-section-inner">

            <h2><?= htmlspecialchars($aboutText['regional_title']) ?></h2>

            <div class="msg-body">
                <?php foreach ($aboutText['regional_intro_paragraphs'] as $paragraph): ?>
                <p><?= $formatMultiline($paragraph) ?></p>
                <?php endforeach; ?>
            </div>

            <!-- Insight 1 -->
            <div class="msg-insight">
                <span class="msg-insight-num">1</span>
                <div class="msg-insight-body">
                    <p class="msg-insight-text">
                        <?= $formatMultiline($aboutText['regional_insight_1_title']) ?>
                    </p>
                    <p class="msg-cite">
                        <?= $formatMultiline($aboutText['regional_insight_1_body']) ?>
                    </p>
                </div>
            </div>

            <!-- Insight 2 -->
            <div class="msg-insight">
                <span class="msg-insight-num">2</span>
                <div class="msg-insight-body">
                    <p class="msg-insight-text">
                        <?= $formatMultiline($aboutText['regional_insight_2_title']) ?>
                    </p>
                    <p class="msg-cite">
                        <?= $formatMultiline($aboutText['regional_insight_2_body']) ?>
                    </p>
                </div>
            </div>

            <!-- Insight 3 -->
            <div class="msg-insight">
                <span class="msg-insight-num">3</span>
                <div class="msg-insight-body">
                    <p class="msg-insight-text">
                        <?= $formatMultiline($aboutText['regional_insight_3_title']) ?>
                    </p>
                    <p class="msg-cite">
                        <?= $formatMultiline($aboutText['regional_insight_3_body']) ?>
                    </p>
                </div>
            </div>

            <h2 style="margin-top: 48px;"><?= htmlspecialchars($aboutText['regional_adults_title']) ?></h2>

            <div class="msg-body">
                <?php foreach ($aboutText['regional_adult_intro_paragraphs'] as $paragraph): ?>
                <p><?= $formatMultiline($paragraph) ?></p>
                <?php endforeach; ?>
            </div>

            <div class="msg-insight">
                <span class="msg-insight-num" style="font-size: 1.5rem;">🧠</span>
                <div class="msg-insight-body">
                    <p class="msg-insight-text">
                        <?= $formatMultiline($aboutText['regional_adult_insight_brain_title']) ?>
                    </p>
                    <p class="msg-cite">
                        <?= $formatMultiline($aboutText['regional_adult_insight_brain_body']) ?>
                    </p>
                </div>
            </div>

            <div class="msg-insight">
                <span class="msg-insight-num" style="font-size: 1.5rem;">👟</span>
                <div class="msg-insight-body">
                    <p class="msg-insight-text">
                        <?= $formatMultiline($aboutText['regional_adult_insight_steps_title']) ?>
                    </p>
                    <p class="msg-cite">
                        <?= $formatMultiline($aboutText['regional_adult_insight_steps_body']) ?>
                    </p>
                </div>
            </div>

            <div class="msg-body" style="margin-top: 32px;">
                <p><?= $formatMultiline($aboutText['regional_adult_tail_1']) ?></p>
                <p><?= $formatMultiline($aboutText['regional_adult_tail_2']) ?></p>
            </div>

            <p class="msg-accent-lg"><?= $formatMultiline($aboutText['regional_adult_tail_3']) ?></p>

        </div>
    </section>

    <!-- ============================================
         Section 4: 消滅可能性自治体
         ============================================ -->
    <section id="disappearing" class="msg-section" style="scroll-margin-top:80px;">
        <div class="msg-section-inner">

            <h2><?= htmlspecialchars($aboutText['disappearing_title']) ?></h2>

            <div class="msg-body">
                <?php foreach ($aboutText['disappearing_intro_paragraphs'] as $paragraph): ?>
                <p><?= $formatMultiline($paragraph) ?></p>
                <?php endforeach; ?>
            </div>

            <div class="msg-stat-hero">
                <div class="msg-stat-row">
                    <span class="msg-stat-number">744</span>
                    <span class="msg-stat-slash">/</span>
                    <span class="msg-stat-sub">1,729</span>
                </div>
                <div class="msg-stat-labels">
                    <span class="msg-stat-label"><?= htmlspecialchars($aboutText['disappearing_stat_label_1']) ?></span>
                    <span class="msg-stat-label"><?= htmlspecialchars($aboutText['disappearing_stat_label_2']) ?></span>
                </div>
            </div>

            <div class="msg-body">
                <p><?= $formatMultiline($aboutText['disappearing_severity_intro']) ?></p>
            </div>

            <div class="msg-examples">
                <?php foreach ($aboutText['disappearing_region_examples'] as $index => $example): ?>
                <div class="msg-example-item"<?= $index === 3 ? ' style="padding-top: 12px; border-top: 1px solid var(--md-outline-variant);"' : '' ?>>
                    <span><?= htmlspecialchars($example['region']) ?></span>
                    <span><?= htmlspecialchars($example['rate']) ?></span>
                </div>
                <?php endforeach; ?>
            </div>

            <div class="msg-body">
                <p><?= $formatMultiline($aboutText['disappearing_memory_1']) ?></p>
                <p><?= $formatMultiline($aboutText['disappearing_memory_2']) ?></p>
            </div>

            <div class="msg-lead" style="margin-top: 40px;">
                <?= htmlspecialchars($regionalMessaging['priority_lead']) ?>
            </div>

            <div class="msg-body">
                <p><?= $formatMultiline($aboutText['disappearing_support']) ?></p>
                <p><?= $formatMultiline($aboutText['disappearing_tail_1']) ?></p>
            </div>

            <p class="msg-accent-lg"><?= $formatMultiline($aboutText['disappearing_tail_2']) ?></p>

        </div>
    </section>

    <!-- ============================================
         Section 5: ビジネスモデル
         ============================================ -->
    <section id="sustainability" class="msg-section msg-surface" style="scroll-margin-top:80px;">
        <div class="msg-section-inner">

            <h2><?= htmlspecialchars($aboutText['sustainability_title']) ?></h2>

            <div class="msg-body">
                <?php foreach ($aboutText['sustainability_paragraphs'] as $paragraph): ?>
                <p><?= $formatMultiline($paragraph) ?></p>
                <?php endforeach; ?>
            </div>

            <p class="msg-accent"><?= htmlspecialchars($regionalMessaging['support_model_summary']) ?></p>

            <div class="msg-plans">
                <?php foreach ($supportPlans as $index => $plan): ?>
                <div class="msg-plan-item<?= $index === 0 ? ' msg-plan-free' : '' ?>">
                    <span class="msg-plan-tag"><?= htmlspecialchars($plan['tag']) ?></span>
                    <p class="msg-plan-name"><?= htmlspecialchars($plan['name']) ?></p>
                    <p class="msg-plan-desc"><?= htmlspecialchars($plan['description']) ?></p>
                </div>
                <?php endforeach; ?>
            </div>

            <p class="msg-accent"><?= $formatMultiline($aboutText['sustainability_highlight']) ?></p>

            <div class="msg-body" style="margin-top: 32px;">
                <p><?= $formatMultiline($aboutText['sustainability_tail_1']) ?></p>
                <p><?= $formatMultiline($aboutText['sustainability_tail_2']) ?></p>
            </div>

            <div class="msg-signature">
                <img src="assets/img/yamaki.jpg" alt="<?= htmlspecialchars($signatureName) ?>" class="msg-signature-photo">
                <div>
                    <p class="msg-signature-name"><?= htmlspecialchars($signatureName) ?></p>
                    <p class="msg-signature-title"><?= htmlspecialchars($signatureTitle) ?></p>
                </div>
            </div>

        </div>
    </section>

    <!-- ============================================
         Section 6: CTA
         ============================================ -->
    <section class="msg-cta-section">
        <div class="msg-cta-inner">

            <p class="msg-cta-heading">
                <?= htmlspecialchars($aboutText['cta_heading']) ?>
            </p>

            <div class="msg-cta-buttons">
                <a href="<?= htmlspecialchars($ctaHref) ?>" class="btn-primary">
                    <i data-lucide="camera" class="w-4 h-4"></i>
                    <?= htmlspecialchars($ctaLabel) ?>
                </a>
                <a href="for-business/" class="btn-secondary">
                    <i data-lucide="building-2" class="w-4 h-4"></i>
                    <?= htmlspecialchars($aboutText['cta_secondary']) ?>
                </a>
            </div>

            <div class="msg-contact">
                <div class="msg-contact-item">
                    <i data-lucide="map-pin" class="w-4 h-4"></i>
                    <span><?= htmlspecialchars($contactLocation) ?></span>
                </div>
                <div class="msg-contact-item">
                    <i data-lucide="mail" class="w-4 h-4"></i>
                    <a href="mailto:contact@ikimon.life">contact@ikimon.life</a>
                </div>
            </div>

        </div>
    </section>

    <!-- Related Guides -->
    <div class="msg-guides">
        <p class="msg-guides-label">
            <i data-lucide="book-open" class="w-4 h-4"></i>
            <?= htmlspecialchars($aboutText['more_label']) ?>
        </p>
        <a href="guide/walking-brain-science.php" class="msg-guide-link">
            <span style="font-size: 1.5rem;">🧠</span>
            <div style="flex: 1;">
                <p class="msg-guide-title"><?= htmlspecialchars($aboutText['guide_brain_title']) ?></p>
                <p class="msg-guide-desc"><?= htmlspecialchars($aboutText['guide_brain_desc']) ?></p>
            </div>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </a>
        <a href="guide/steps-dementia-prevention.php" class="msg-guide-link">
            <span style="font-size: 1.5rem;">👟</span>
            <div style="flex: 1;">
                <p class="msg-guide-title"><?= htmlspecialchars($aboutText['guide_steps_title']) ?></p>
                <p class="msg-guide-desc"><?= htmlspecialchars($aboutText['guide_steps_desc']) ?></p>
            </div>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </a>
        <a href="guide/nature-positive.php" class="msg-guide-link">
            <span style="font-size: 1.5rem;">🌿</span>
            <div style="flex: 1;">
                <p class="msg-guide-title"><?= htmlspecialchars($aboutText['guide_nature_positive_title']) ?></p>
                <p class="msg-guide-desc"><?= htmlspecialchars($aboutText['guide_nature_positive_desc']) ?></p>
            </div>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </a>
        <a href="century_archive.php" class="msg-guide-link">
            <span style="font-size: 1.5rem;">📦</span>
            <div style="flex: 1;">
                <p class="msg-guide-title"><?= htmlspecialchars($aboutText['guide_archive_title']) ?></p>
                <p class="msg-guide-desc"><?= htmlspecialchars($aboutText['guide_archive_desc']) ?></p>
            </div>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </a>
        <a href="methodology.php" class="msg-guide-link">
            <span style="font-size: 1.5rem;">📊</span>
            <div style="flex: 1;">
                <p class="msg-guide-title"><?= htmlspecialchars($aboutText['guide_methodology_title']) ?></p>
                <p class="msg-guide-desc"><?= htmlspecialchars($aboutText['guide_methodology_desc']) ?></p>
            </div>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </a>
    </div>

    <!-- Footer -->
    <?php include __DIR__ . '/components/footer.php'; ?>

    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>
</html>
