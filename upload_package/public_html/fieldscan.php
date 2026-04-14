<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/Lang.php';

Auth::init();
Lang::init();

$documentLang = method_exists('Lang', 'current') ? Lang::current() : (!empty($_GET['lang']) ? (string)$_GET['lang'] : 'ja');

$copyByLang = [
    'ja' => [
        'meta_title' => 'FieldScan — AI生物スキャナー | ikimon.life',
        'meta_description' => '3つのAIエンジンが視覚・聴覚・環境を同時スキャン。歩くだけで生態系のタイムカプセルを生成する、100年アーカイブのためのAndroidアプリ。',
        'title' => 'フィールドスキャン',
        'hero_body' => "歩くだけで、その場の生きものと環境を\nまるごと記録するAndroidアプリ。",
        'records_title' => '1回の散歩で記録されるもの',
        'record_cards' => [
            ['icon' => '🎧', 'title' => '音の記録', 'body' => '鳥の声・虫の声・環境音。音響指数（ACI/NDSI）で「豊かさ」も数値化。オフラインで動作。'],
            ['icon' => '📷', 'title' => '場所の記録', 'body' => 'カメラが植生・水辺・開放度を自動分析。歩いた軌跡と重ね合わせてその場所の生態を記録する。'],
            ['icon' => '🌡️', 'title' => '環境の記録', 'body' => '気圧・照度・標高を60秒ごとに自動スナップショット。種の記録だけでは残せない「その日の環境」を保存する。'],
        ],
        'steps_title' => '使い方',
        'steps' => [
            ['title' => '散歩を始める', 'body' => 'タップ1つで全センサーが起動'],
            ['title' => '歩くだけ', 'body' => 'あとは自動。ポケットに入れたままでOK'],
            ['title' => '記録を終了する', 'body' => '散歩のサマリーと記録データが ikimon.life に同期'],
        ],
        'download_title' => 'Android アプリをダウンロード',
        'download_button' => 'APK をダウンロード',
        'android_requirement' => 'Android 14+',
        'download_note' => "Google Play 外からのインストールです。\nダウンロード後、「提供元不明のアプリのインストール」を許可してください。",
        'install_title' => 'インストール手順',
        'install_steps' => [
            '上のボタンから <strong class="text-white">APK をダウンロード</strong>',
            'ダウンロード完了の通知をタップ、または <strong class="text-white">ファイルアプリ → ダウンロード</strong> から開く',
            '「提供元不明のアプリ」を許可 → <strong class="text-white">インストール</strong>',
            '初回起動時に<strong class="text-white">カメラ・マイク・位置情報</strong>を許可。Gemini Nano モデルが自動ダウンロード（WiFi推奨、約3GB）',
        ],
        'requirements_title' => '動作要件',
        'requirements' => [
            ['label' => 'OS', 'value' => 'Android 14 以上'],
            ['label' => 'RAM', 'value' => '6GB 以上'],
            ['label' => 'ストレージ', 'value' => '約4GB（モデル含む）'],
            ['label' => '推奨', 'value' => 'Pixel 10 Pro'],
        ],
        'requirements_note' => 'Tensor G5 搭載端末で最適化。Gemini Nano オンデバイスには Google Play Services が必要です。',
        'changes_title' => 'v0.5.1 の変更点',
        'changes' => [
            ['mark' => '!', 'class' => 'text-red-400', 'text' => 'ハルシネーション撲滅（存在しない生物の誤検出を排除）'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'DetectionTier 導入（候補 / 概要 / 抑制の3段階分類）'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'GPS速度ベースの自動適応スキャン（モード手動選択不要）'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => '高確信度検出時に証拠写真を自動保存（WebP原寸）'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => '音声ガイド分離（概要「〜の気配」/ 候補「発見、確信度高」）'],
            ['mark' => '~', 'class' => 'text-blue-400', 'text' => 'Gemini Nano プロンプト強化（種レベル禁止・視認必須）'],
            ['mark' => '~', 'class' => 'text-blue-400', 'text' => '音声検出しきい値引き上げ（0.10→0.35/0.50）'],
            ['mark' => '~', 'class' => 'text-blue-400', 'text' => '信頼度に応じた分類階級の強制（LOW→綱、MEDIUM→目/科、HIGH→科）'],
            ['mark' => '-', 'class' => 'text-gray-500', 'text' => 'ObservationMode（通勤/散歩/定点）廃止 → 全自動に'],
        ],
        'legacy_title' => 'v0.2.0',
        'legacy_changes' => [
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'BirdNET V3 + Perch v2 デュアル音声エンジン'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => '環境センサー統合（気圧・照度・コンパス・加速度）'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => '加速度計ベースの適応型スキャン間隔'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'ikimon.life 自動同期（passive_event API）'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => '新種発見の触覚フィードバック'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Gemini Nano 環境分析（植生・水辺・都市度）'],
            ['mark' => '~', 'class' => 'text-blue-400', 'text' => 'Detection データモデル拡張（taxonRank, engines, consensus）'],
        ],
        'caution_title' => 'AIによる推定について',
        'caution_body' => '検出結果はAIによる推定です。正確な同定が必要な場合は、ikimon.life のコミュニティによる確認をご利用ください。',
        'privacy_title' => 'プライバシー',
        'privacy_items' => [
            '🔒 <strong class="text-gray-200">画像はサーバーに送信されません。</strong>視覚AIの処理は全てオンデバイスで完結します。',
            '🎤 音声AIはサーバー側で BirdNET V3 + Perch v2 を実行します。音声データは判定後に自動削除され、検出時のみ証拠として保持されます。',
            '📍 位置情報はローカルに保存され、スキャン終了後にユーザーの操作で ikimon.life に同期されます。',
            '🌡 環境センサーデータ（気圧・照度等）は生物多様性記録の一部として保存されます。個人を特定する情報は含まれません。',
        ],
    ],
    'en' => [
        'meta_title' => 'FieldScan — AI field scanner | ikimon.life',
        'meta_description' => 'Three AI engines scan vision, sound, and environment at once. An Android app that turns each walk into a long-term ecological time capsule.',
        'title' => 'FieldScan',
        'hero_body' => 'An Android app that records nearby wildlife and the environment as you walk.',
        'records_title' => 'What one walk records',
        'record_cards' => [
            ['icon' => '🎧', 'title' => 'Sound record', 'body' => 'Bird calls, insect sounds, and ambient audio. It also estimates richness with acoustic indices such as ACI and NDSI, and works offline.'],
            ['icon' => '📷', 'title' => 'Place record', 'body' => 'The camera analyzes vegetation, water edges, and openness automatically, then ties that to the route you walked.'],
            ['icon' => '🌡️', 'title' => 'Environment record', 'body' => 'Pressure, light, and elevation are snapshotted every 60 seconds so the day’s conditions are preserved too.'],
        ],
        'steps_title' => 'How it works',
        'steps' => [
            ['title' => 'Start a walk', 'body' => 'One tap starts every sensor'],
            ['title' => 'Just walk', 'body' => 'Everything else runs automatically, even if the phone stays in your pocket'],
            ['title' => 'Finish the record', 'body' => 'The walk summary and captured data sync to ikimon.life'],
        ],
        'download_title' => 'Download the Android app',
        'download_button' => 'Download APK',
        'android_requirement' => 'Android 14+',
        'download_note' => "This installs outside Google Play.\nAfter download, allow installation from unknown sources.",
        'install_title' => 'Install steps',
        'install_steps' => [
            'Download the <strong class="text-white">APK</strong> with the button above',
            'Tap the completed download notification, or open it from <strong class="text-white">Files → Downloads</strong>',
            'Allow <strong class="text-white">unknown source installs</strong> and continue with installation',
            'On first launch, allow <strong class="text-white">camera, microphone, and location</strong>. Gemini Nano downloads automatically (Wi-Fi recommended, around 3GB).',
        ],
        'requirements_title' => 'Requirements',
        'requirements' => [
            ['label' => 'OS', 'value' => 'Android 14 or later'],
            ['label' => 'RAM', 'value' => '6GB or more'],
            ['label' => 'Storage', 'value' => 'About 4GB including models'],
            ['label' => 'Recommended', 'value' => 'Pixel 10 Pro'],
        ],
        'requirements_note' => 'Optimized for Tensor G5 devices. Gemini Nano on-device requires Google Play Services.',
        'changes_title' => 'What changed in v0.5.1',
        'changes' => [
            ['mark' => '!', 'class' => 'text-red-400', 'text' => 'Aggressively reduced hallucinations and removed detections for organisms that are not really there'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Introduced DetectionTier with candidate / overview / suppressed stages'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Added GPS-speed adaptive scanning with no manual mode switching'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Automatically saves evidence photos for high-confidence detections in full WebP'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Separated voice guidance for overview versus high-confidence candidate moments'],
            ['mark' => '~', 'class' => 'text-blue-400', 'text' => 'Strengthened Gemini Nano prompts to block unsupported species-level claims'],
            ['mark' => '~', 'class' => 'text-blue-400', 'text' => 'Raised audio detection thresholds from 0.10 to 0.35 / 0.50'],
            ['mark' => '~', 'class' => 'text-blue-400', 'text' => 'Forced taxonomic rank ceilings by confidence level'],
            ['mark' => '-', 'class' => 'text-gray-500', 'text' => 'Removed ObservationMode (commute / walk / fixed-point) in favor of full automation'],
        ],
        'legacy_title' => 'v0.2.0',
        'legacy_changes' => [
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'BirdNET V3 + Perch v2 dual audio engines'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Integrated environment sensors for pressure, light, compass, and acceleration'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Adaptive scan intervals based on accelerometer input'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Automatic sync to ikimon.life via the passive_event API'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Haptic feedback for new finds'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Gemini Nano environment analysis for vegetation, water edges, and urbanity'],
            ['mark' => '~', 'class' => 'text-blue-400', 'text' => 'Expanded the Detection data model with taxonRank, engines, and consensus'],
        ],
        'caution_title' => 'About AI estimates',
        'caution_body' => 'Detection results are AI-based estimates. If you need an exact identification, use confirmation from the ikimon.life community.',
        'privacy_title' => 'Privacy',
        'privacy_items' => [
            '🔒 <strong class="text-gray-200">Images are not sent to the server.</strong> Visual AI runs entirely on-device.',
            '🎤 Audio AI runs BirdNET V3 + Perch v2 on the server. Audio is deleted after judgment and kept only as evidence when something is detected.',
            '📍 Location stays on the device and syncs to ikimon.life only after the user finishes the scan.',
            '🌡 Environment sensor data such as pressure and light is stored as part of the biodiversity record and does not include personally identifying information.',
        ],
    ],
    'es' => [
        'meta_title' => 'FieldScan — escáner de campo con IA | ikimon.life',
        'meta_description' => 'Tres motores de IA analizan visión, sonido y entorno al mismo tiempo. Una app Android que convierte cada paseo en una cápsula ecológica a largo plazo.',
        'title' => 'FieldScan',
        'hero_body' => 'Una app de Android que registra la vida cercana y el entorno mientras caminas.',
        'records_title' => 'Qué registra un paseo',
        'record_cards' => [
            ['icon' => '🎧', 'title' => 'Registro de sonido', 'body' => 'Cantos de aves, insectos y sonido ambiental. También estima riqueza con índices acústicos como ACI y NDSI, y funciona sin conexión.'],
            ['icon' => '📷', 'title' => 'Registro del lugar', 'body' => 'La cámara analiza vegetación, bordes de agua y apertura del entorno, y lo cruza con la ruta que caminaste.'],
            ['icon' => '🌡️', 'title' => 'Registro ambiental', 'body' => 'Presión, luz y altitud se guardan cada 60 segundos para conservar también las condiciones del día.'],
        ],
        'steps_title' => 'Cómo funciona',
        'steps' => [
            ['title' => 'Empieza un paseo', 'body' => 'Un toque activa todos los sensores'],
            ['title' => 'Solo camina', 'body' => 'Todo lo demás funciona automáticamente, incluso si el teléfono queda en el bolsillo'],
            ['title' => 'Cierra el registro', 'body' => 'El resumen y los datos capturados se sincronizan con ikimon.life'],
        ],
        'download_title' => 'Descargar la app de Android',
        'download_button' => 'Descargar APK',
        'android_requirement' => 'Android 14+',
        'download_note' => "La instalación se hace fuera de Google Play.\nDespués de descargar, permite instalar desde orígenes desconocidos.",
        'install_title' => 'Pasos de instalación',
        'install_steps' => [
            'Descarga el <strong class="text-white">APK</strong> con el botón de arriba',
            'Toca la notificación de descarga completada o ábrela desde <strong class="text-white">Archivos → Descargas</strong>',
            'Permite instalaciones desde <strong class="text-white">orígenes desconocidos</strong> y continúa',
            'En el primer inicio, permite <strong class="text-white">cámara, micrófono y ubicación</strong>. Gemini Nano se descarga automáticamente (mejor con Wi‑Fi, unos 3GB).',
        ],
        'requirements_title' => 'Requisitos',
        'requirements' => [
            ['label' => 'SO', 'value' => 'Android 14 o superior'],
            ['label' => 'RAM', 'value' => '6GB o más'],
            ['label' => 'Almacenamiento', 'value' => 'Aprox. 4GB incluyendo modelos'],
            ['label' => 'Recomendado', 'value' => 'Pixel 10 Pro'],
        ],
        'requirements_note' => 'Optimizado para dispositivos Tensor G5. Gemini Nano en el dispositivo requiere Google Play Services.',
        'changes_title' => 'Cambios en la v0.5.1',
        'changes' => [
            ['mark' => '!', 'class' => 'text-red-400', 'text' => 'Reducción fuerte de alucinaciones y eliminación de detecciones de organismos inexistentes'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Nuevo DetectionTier con estados de candidato / resumen / suprimido'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Escaneo adaptativo por velocidad GPS sin selección manual de modo'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Guardado automático de fotos de evidencia para detecciones de alta confianza'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Separación de guía por voz entre resumen y candidato de alta confianza'],
            ['mark' => '~', 'class' => 'text-blue-400', 'text' => 'Prompts de Gemini Nano reforzados para bloquear afirmaciones demasiado precisas'],
            ['mark' => '~', 'class' => 'text-blue-400', 'text' => 'Subida de umbrales de audio de 0.10 a 0.35 / 0.50'],
            ['mark' => '~', 'class' => 'text-blue-400', 'text' => 'Límites de rango taxonómico según nivel de confianza'],
            ['mark' => '-', 'class' => 'text-gray-500', 'text' => 'Se eliminó ObservationMode (trayecto / paseo / punto fijo) a favor de automatización total'],
        ],
        'legacy_title' => 'v0.2.0',
        'legacy_changes' => [
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Motores de audio duales BirdNET V3 + Perch v2'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Integración de sensores ambientales de presión, luz, brújula y aceleración'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Intervalos de escaneo adaptativos según acelerómetro'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Sincronización automática con ikimon.life mediante passive_event API'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Respuesta háptica para nuevos hallazgos'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Análisis ambiental con Gemini Nano para vegetación, agua y urbanidad'],
            ['mark' => '~', 'class' => 'text-blue-400', 'text' => 'Modelo Detection ampliado con taxonRank, engines y consensus'],
        ],
        'caution_title' => 'Sobre las estimaciones de IA',
        'caution_body' => 'Los resultados son estimaciones de IA. Si necesitas una identificación exacta, usa la confirmación de la comunidad de ikimon.life.',
        'privacy_title' => 'Privacidad',
        'privacy_items' => [
            '🔒 <strong class="text-gray-200">Las imágenes no se envían al servidor.</strong> La IA visual funciona por completo en el dispositivo.',
            '🎤 La IA de audio ejecuta BirdNET V3 + Perch v2 en el servidor. El audio se elimina después del análisis y solo se conserva como evidencia cuando hay detección.',
            '📍 La ubicación permanece en el dispositivo y se sincroniza con ikimon.life solo al finalizar el escaneo.',
            '🌡 Los datos ambientales como presión y luz se guardan como parte del registro de biodiversidad y no incluyen información personal identificable.',
        ],
    ],
    'pt-BR' => [
        'meta_title' => 'FieldScan — scanner de campo com IA | ikimon.life',
        'meta_description' => 'Três motores de IA analisam visão, som e ambiente ao mesmo tempo. Um app Android que transforma cada caminhada em uma cápsula ecológica de longo prazo.',
        'title' => 'FieldScan',
        'hero_body' => 'Um app Android que registra a vida ao redor e o ambiente enquanto você caminha.',
        'records_title' => 'O que uma caminhada registra',
        'record_cards' => [
            ['icon' => '🎧', 'title' => 'Registro de som', 'body' => 'Cantos de aves, insetos e som ambiente. Também estima riqueza com índices acústicos como ACI e NDSI, e funciona offline.'],
            ['icon' => '📷', 'title' => 'Registro do lugar', 'body' => 'A câmera analisa vegetação, bordas d’água e abertura do ambiente e cruza isso com o trajeto percorrido.'],
            ['icon' => '🌡️', 'title' => 'Registro ambiental', 'body' => 'Pressão, luz e altitude são salvos a cada 60 segundos para preservar também as condições do dia.'],
        ],
        'steps_title' => 'Como funciona',
        'steps' => [
            ['title' => 'Comece a caminhada', 'body' => 'Um toque ativa todos os sensores'],
            ['title' => 'Só caminhe', 'body' => 'O resto acontece automaticamente, mesmo com o telefone no bolso'],
            ['title' => 'Feche o registro', 'body' => 'O resumo e os dados capturados são sincronizados com o ikimon.life'],
        ],
        'download_title' => 'Baixar o app Android',
        'download_button' => 'Baixar APK',
        'android_requirement' => 'Android 14+',
        'download_note' => "A instalação acontece fora da Google Play.\nDepois do download, permita instalar de fontes desconhecidas.",
        'install_title' => 'Passos de instalação',
        'install_steps' => [
            'Baixe o <strong class="text-white">APK</strong> pelo botão acima',
            'Toque na notificação de download concluído ou abra em <strong class="text-white">Arquivos → Downloads</strong>',
            'Permita instalação de <strong class="text-white">fontes desconhecidas</strong> e continue',
            'Na primeira abertura, permita <strong class="text-white">câmera, microfone e localização</strong>. O Gemini Nano é baixado automaticamente (Wi‑Fi recomendado, cerca de 3GB).',
        ],
        'requirements_title' => 'Requisitos',
        'requirements' => [
            ['label' => 'SO', 'value' => 'Android 14 ou superior'],
            ['label' => 'RAM', 'value' => '6GB ou mais'],
            ['label' => 'Armazenamento', 'value' => 'Cerca de 4GB incluindo modelos'],
            ['label' => 'Recomendado', 'value' => 'Pixel 10 Pro'],
        ],
        'requirements_note' => 'Otimizado para aparelhos com Tensor G5. Gemini Nano no dispositivo requer Google Play Services.',
        'changes_title' => 'Mudanças da v0.5.1',
        'changes' => [
            ['mark' => '!', 'class' => 'text-red-400', 'text' => 'Redução forte de alucinações e remoção de detecções de organismos inexistentes'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Novo DetectionTier com estágios de candidato / visão geral / suprimido'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Escaneamento adaptativo por velocidade de GPS sem modo manual'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Salvamento automático de fotos de evidência para detecções de alta confiança'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Separação da orientação por voz entre visão geral e candidato de alta confiança'],
            ['mark' => '~', 'class' => 'text-blue-400', 'text' => 'Prompts do Gemini Nano reforçados para bloquear afirmações precisas demais'],
            ['mark' => '~', 'class' => 'text-blue-400', 'text' => 'Aumento dos limiares de áudio de 0.10 para 0.35 / 0.50'],
            ['mark' => '~', 'class' => 'text-blue-400', 'text' => 'Limites de rank taxonômico conforme o nível de confiança'],
            ['mark' => '-', 'class' => 'text-gray-500', 'text' => 'ObservationMode (trajeto / caminhada / ponto fixo) removido em favor de automação total'],
        ],
        'legacy_title' => 'v0.2.0',
        'legacy_changes' => [
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Motores de áudio duplos BirdNET V3 + Perch v2'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Integração de sensores ambientais de pressão, luz, bússola e aceleração'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Intervalos adaptativos de escaneamento com base no acelerômetro'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Sincronização automática com ikimon.life via passive_event API'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Feedback háptico para novas descobertas'],
            ['mark' => '+', 'class' => 'text-emerald-400', 'text' => 'Análise ambiental com Gemini Nano para vegetação, água e urbanidade'],
            ['mark' => '~', 'class' => 'text-blue-400', 'text' => 'Modelo Detection ampliado com taxonRank, engines e consensus'],
        ],
        'caution_title' => 'Sobre estimativas de IA',
        'caution_body' => 'Os resultados são estimativas baseadas em IA. Se você precisar de identificação exata, use a confirmação da comunidade do ikimon.life.',
        'privacy_title' => 'Privacidade',
        'privacy_items' => [
            '🔒 <strong class="text-gray-200">As imagens não são enviadas ao servidor.</strong> A IA visual roda totalmente no dispositivo.',
            '🎤 A IA de áudio executa BirdNET V3 + Perch v2 no servidor. O áudio é apagado após a análise e só fica como evidência quando há detecção.',
            '📍 A localização fica no dispositivo e só sincroniza com o ikimon.life ao final do escaneamento.',
            '🌡 Dados ambientais como pressão e luz são salvos como parte do registro de biodiversidade e não incluem informações pessoais identificáveis.',
        ],
    ],
];

$copy = $copyByLang[$documentLang] ?? $copyByLang['en'];

$meta_title = $copy['meta_title'];
$meta_description = $copy['meta_description'];
$meta_canonical = rtrim(BASE_URL, '/') . '/fieldscan';

$apkVersion = '0.5.1';
$apkSize = '15MB';
$apkFile = 'assets/downloads/ikimon-fieldscan.apk';
?>
<!DOCTYPE html>
<html lang="<?= htmlspecialchars($documentLang) ?>">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
</head>
<body class="bg-[#050505] text-white min-h-screen">

<?php include __DIR__ . '/components/nav.php'; ?>

<main class="max-w-2xl mx-auto px-4 py-8" style="padding-top: calc(var(--nav-height, 56px) + 2rem); padding-bottom: calc(var(--bottom-nav-height, 72px) + 2rem)">
    <section class="text-center space-y-4 mb-12">
        <div class="text-6xl">🌿</div>
        <h1 class="text-3xl font-black tracking-tight"><?= htmlspecialchars($copy['title']) ?> <span class="text-xs font-normal text-gray-500 ml-2">v<?= htmlspecialchars($apkVersion) ?></span></h1>
        <p class="text-gray-400 text-sm leading-relaxed max-w-md mx-auto whitespace-pre-line"><?= htmlspecialchars($copy['hero_body']) ?></p>
    </section>

    <section class="grid gap-3 mb-10">
        <h2 class="text-xs font-bold text-gray-500 uppercase tracking-wider px-1"><?= htmlspecialchars($copy['records_title']) ?></h2>
        <?php foreach ($copy['record_cards'] as $card): ?>
            <div class="bg-white/5 rounded-2xl p-5 flex items-start gap-4">
                <span class="text-2xl mt-1"><?= htmlspecialchars($card['icon']) ?></span>
                <div><div class="font-bold text-sm"><?= htmlspecialchars($card['title']) ?></div><div class="text-xs text-gray-400 mt-1 leading-relaxed"><?= htmlspecialchars($card['body']) ?></div></div>
            </div>
        <?php endforeach; ?>
    </section>

    <section class="mb-10">
        <h2 class="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-3"><?= htmlspecialchars($copy['steps_title']) ?></h2>
        <div class="bg-white/5 rounded-2xl p-5 space-y-4">
            <?php foreach ($copy['steps'] as $index => $step): ?>
                <div class="flex items-center gap-3">
                    <div class="bg-emerald-600 text-white text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0"><?= $index + 1 ?></div>
                    <div class="text-xs text-gray-300"><strong class="text-white"><?= htmlspecialchars($step['title']) ?></strong> — <?= htmlspecialchars($step['body']) ?></div>
                </div>
            <?php endforeach; ?>
        </div>
    </section>

    <section class="bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 border border-emerald-500/20 rounded-2xl p-6 text-center space-y-4 mb-10">
        <h2 class="text-lg font-black"><?= htmlspecialchars($copy['download_title']) ?></h2>
        <div class="flex items-center justify-center gap-3 text-xs text-gray-400"><span>v<?= htmlspecialchars($apkVersion) ?></span><span>·</span><span><?= htmlspecialchars($apkSize) ?></span><span>·</span><span><?= htmlspecialchars($copy['android_requirement']) ?></span></div>
        <a href="<?= htmlspecialchars($apkFile) ?>" download="ikimon-fieldscan-v<?= htmlspecialchars($apkVersion) ?>.apk" class="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-4 px-8 rounded-xl text-base transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <?= htmlspecialchars($copy['download_button']) ?>
        </a>
        <p class="text-[10px] text-gray-500 leading-relaxed whitespace-pre-line"><?= htmlspecialchars($copy['download_note']) ?></p>
    </section>

    <section class="space-y-3 mb-10">
        <h3 class="text-sm font-bold text-gray-300 px-1"><?= htmlspecialchars($copy['install_title']) ?></h3>
        <div class="space-y-2">
            <?php foreach ($copy['install_steps'] as $index => $step): ?>
                <div class="bg-white/5 rounded-xl p-4 flex items-start gap-3"><span class="bg-emerald-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"><?= $index + 1 ?></span><div class="text-xs text-gray-300"><?= $step ?></div></div>
            <?php endforeach; ?>
        </div>
    </section>

    <section class="bg-white/5 rounded-2xl p-5 mb-10">
        <h3 class="text-sm font-bold text-gray-300 mb-3"><?= htmlspecialchars($copy['requirements_title']) ?></h3>
        <div class="grid grid-cols-2 gap-3 text-xs">
            <?php foreach ($copy['requirements'] as $requirement): ?>
                <div><div class="text-gray-500"><?= htmlspecialchars($requirement['label']) ?></div><div class="text-gray-200 font-bold"><?= htmlspecialchars($requirement['value']) ?></div></div>
            <?php endforeach; ?>
        </div>
        <div class="mt-3 text-[10px] text-gray-500"><?= htmlspecialchars($copy['requirements_note']) ?></div>
    </section>

    <section class="bg-white/5 rounded-2xl p-5 mb-10">
        <h3 class="text-sm font-bold text-gray-300 mb-3"><?= htmlspecialchars($copy['changes_title']) ?></h3>
        <div class="text-xs text-gray-400 space-y-1.5">
            <?php foreach ($copy['changes'] as $change): ?>
                <div class="flex gap-2"><span class="<?= htmlspecialchars($change['class']) ?> shrink-0"><?= htmlspecialchars($change['mark']) ?></span> <?= htmlspecialchars($change['text']) ?></div>
            <?php endforeach; ?>
        </div>
    </section>

    <section class="bg-white/5 rounded-2xl p-5 mb-10">
        <h3 class="text-sm font-bold text-gray-300 mb-3"><?= htmlspecialchars($copy['legacy_title']) ?></h3>
        <div class="text-xs text-gray-400 space-y-1.5">
            <?php foreach ($copy['legacy_changes'] as $change): ?>
                <div class="flex gap-2"><span class="<?= htmlspecialchars($change['class']) ?> shrink-0"><?= htmlspecialchars($change['mark']) ?></span> <?= htmlspecialchars($change['text']) ?></div>
            <?php endforeach; ?>
        </div>
    </section>

    <section class="bg-amber-900/20 border border-amber-600/30 rounded-2xl p-5 mb-10">
        <div class="flex items-start gap-3"><span class="text-lg">⚠️</span><div class="text-xs text-gray-300 space-y-1"><p><strong class="text-amber-300"><?= htmlspecialchars($copy['caution_title']) ?></strong></p><p><?= htmlspecialchars($copy['caution_body']) ?></p></div></div>
    </section>

    <section class="bg-white/5 rounded-2xl p-5 mb-10">
        <h3 class="text-sm font-bold text-gray-300 mb-3"><?= htmlspecialchars($copy['privacy_title']) ?></h3>
        <div class="text-xs text-gray-400 space-y-2"><?php foreach ($copy['privacy_items'] as $item): ?><p><?= $item ?></p><?php endforeach; ?></div>
    </section>

    <section class="text-center text-[10px] text-gray-600 space-y-1">
        <p>BirdNET+ V3.0 — Cornell Lab of Ornithology (CC BY-SA 4.0)</p>
        <p>Perch v2 — Google DeepMind (Apache 2.0)</p>
        <p>Gemini Nano — Google AI Edge (on-device)</p>
    </section>
</main>

<?php include __DIR__ . '/components/nav.php'; ?>

</body>
</html>
