import type { SiteLang } from "../i18n.js";
import { FACE_PRIVACY_CLIENT_SCRIPT } from "./facePrivacyScript.js";
import { escapeHtml } from "./siteShell.js";

type GuideCopy = {
  title: string;
  subtitle: string;
  startBtn: string;
  startSheetTitle: string;
  startSheetBody: string;
  missionChoiceTitle: string;
  missionChoiceBody: string;
  missions: { id: string; label: string; body: string }[];
  cameraChoiceTitle: string;
  cameraChoiceBody: string;
  cameraOnBtn: string;
  cameraOffBtn: string;
  cameraOffHint: string;
  audioChoiceTitle: string;
  audioChoiceBody: string;
  audioOnBtn: string;
  audioOffBtn: string;
  beginWithChoices: string;
  startSheetCancel: string;
  noSensorNotice: string;
  audioOnlyNotice: string;
  audioOnlyTitle: string;
  audioOnlyBody: string;
  cameraOnlyNotice: string;
  cameraAudioNotice: string;
  recommendedTitle: string;
  recommendedBody: string;
  recommendedApply: string;
  recommendedPocketHint: string;
  sessionSummaryTitle: string;
  sessionSummarySaved: string;
  sessionSummarySkipped: string;
  sessionSummaryAudioOnly: string;
  queuedRecapLabel: string;
  sessionSummaryEmpty: string;
  sessionSummaryTodayLabel: string;
  sessionSummaryEvidenceLabel: string;
  sessionSummaryNextLabel: string;
  sessionSummaryTodayEmpty: string;
  sessionSummaryEvidenceEmpty: string;
  sessionSummaryNextEmpty: string;
  sessionSummaryResultsLink: string;
  offlineOnline: string;
  offlineOffline: string;
  offlineQueued: string;
  offlineSyncing: string;
  offlineSynced: string;
  offlineFailed: string;
  offlineSceneQueued: string;
  storagePressure: string;
  stopBtn: string;
  langLabel: string;
  modeLabel: string;
  modes: { id: string; label: string }[];
  categoryLabel: string;
  categories: { id: string; label: string }[];
  recordBtn: string;
  reviewTitle: string;
  noRecords: string;
  permissionDenied: string;
  photoFallbackHint: string;
  choosePhotoBtn: string;
  photoAnalysing: string;
  analysing: string;
  started: string;
  stopped: string;
  playing: string;
  privacyNotice: string;
  frameNotice: string;
  naturalSoundBadge: string;
  voiceExcludedNotice: string;
  audioOffNotice: string;
  audioOptInBtn: string;
  audioOptOutBtn: string;
  audioOptInNotice: string;
  audioUnavailableNotice: string;
  contextTitle: string;
  contextBody: string;
  audioTitle: string;
  audioEmpty: string;
  audioSkipped: string;
  audioUnnamed: string;
  nowTitle: string;
  nowHint: string;
  nowNextLabel: string;
  nowNextInitial: string;
  nowNextAnalysing: string;
  nowNextFallback: string;
  trailTitle: string;
  trailEmpty: string;
  trailPending: string;
  trailDeferred: string;
  playTrail: string;
  saveTrail: string;
  autoSaveBadge: string;
  autoSaved: string;
  autoSkipped: string;
  autoSaveError: string;
  manualSave: string;
};

const COPY: Record<SiteLang, GuideCopy> = {
  ja: {
    title: "ライブガイド",
    subtitle: "映像と音から、土地の物語を足跡に残します",
    startBtn: "ガイドを開始する",
    startSheetTitle: "使うものを選んで開始します",
    startSheetBody: "歩き方に合わせて、カメラと音声を別々に選べます。あとから画面下のボタンで音声だけ切り替えることもできます。",
    missionChoiceTitle: "今日のミッション",
    missionChoiceBody: "最初に目的を1つ選ぶと、カメラと音声のおすすめ設定を合わせます。",
    missions: [
      { id: "quick", label: "5分だけ見る", body: "近くの草地や水辺を短く見て、最初の手がかりを残す" },
      { id: "sound", label: "音だけで歩く", body: "ポケットに入れて、鳥・虫・水音などの自然音を集める" },
      { id: "spot", label: "1地点を詳しく見る", body: "同じ場所で植生・地形・管理痕跡をゆっくり拾う" },
    ],
    cameraChoiceTitle: "カメラを使いますか？",
    cameraChoiceBody: "周囲の植物や地形を読み取る場合はONが向いています。ポケットに入れて音だけ集めるときはOFFにすると、映像は取得しません。",
    cameraOnBtn: "カメラON",
    cameraOffBtn: "カメラOFF",
    cameraOffHint: "カメラOFFでは映像解析は行わず、音声ONの場合だけ自然音を記録します。",
    audioChoiceTitle: "音声も記録しますか？",
    audioChoiceBody: "外を歩いたり自転車で移動する場合、鳥・虫・水音などの手がかりが増えます。人の声らしい音は保存しないよう除外します。",
    audioOnBtn: "音声ON",
    audioOffBtn: "音声OFF",
    beginWithChoices: "この設定で開始する",
    startSheetCancel: "戻る",
    noSensorNotice: "カメラか音声のどちらかをONにすると開始できます。",
    audioOnlyNotice: "音声だけで開始しました。映像は取得せず、自然音候補だけを短く記録します。",
    audioOnlyTitle: "音声だけで記録中",
    audioOnlyBody: "カメラ映像は取得していません。ポケットに入れて歩くときは、このまま自然音の手がかりを集められます。",
    cameraOnlyNotice: "カメラだけで開始しました。音声は記録しません。",
    cameraAudioNotice: "カメラと音声で開始しました。人声らしい音は保存しません。",
    recommendedTitle: "おすすめ設定",
    recommendedBody: "歩きながら見たり、自転車でゆっくり移動するなら「カメラON + 音声ON」が一番情報量を増やせます。",
    recommendedApply: "おすすめを使う",
    recommendedPocketHint: "ポケットに入れて使う日は、カメラOFF + 音声ONに変えると映像を取らずに自然音だけ集められます。",
    sessionSummaryTitle: "今回のふりかえり",
    sessionSummarySaved: "保存されたもの",
    sessionSummarySkipped: "保存しなかったもの",
    sessionSummaryAudioOnly: "音声だけで取れたもの",
    queuedRecapLabel: "未同期のもの",
    sessionSummaryEmpty: "まだ集計できる記録はありません。",
    sessionSummaryTodayLabel: "今日見えたもの",
    sessionSummaryEvidenceLabel: "足りない証拠",
    sessionSummaryNextLabel: "次回見るもの",
    sessionSummaryTodayEmpty: "まだ手がかりはありません。",
    sessionSummaryEvidenceEmpty: "まず1つ、近い特徴か場所の状態を足すと強くなります。",
    sessionSummaryNextEmpty: "同じ場所で葉・花・水辺・地面のどれかをもう一度見てください。",
    sessionSummaryResultsLink: "ガイド成果を確認する",
    offlineOnline: "オンライン",
    offlineOffline: "オフライン中",
    offlineQueued: "未同期 {count}件",
    offlineSyncing: "同期中",
    offlineSynced: "同期しました",
    offlineFailed: "同期失敗あり",
    offlineSceneQueued: "端末に一時保存中",
    storagePressure: "端末の保存容量に近づいています。映像の頻度を下げて、自然音と代表フレームを優先します。",
    stopBtn: "停止する",
    langLabel: "言語",
    modeLabel: "移動モード",
    modes: [
      { id: "walk", label: "徒歩" },
      { id: "vehicle", label: "車・自転車" },
    ],
    categoryLabel: "ガイドカテゴリ",
    categories: [
      { id: "biodiversity", label: "🌿 生物多様性" },
      { id: "land_history", label: "🗺️ 土地の歴史" },
      { id: "buildings", label: "🏛️ 建物・文化" },
      { id: "people_history", label: "👤 人の歴史" },
    ],
    recordBtn: "この発見を記録する",
    reviewTitle: "今日の気づき",
    noRecords: "まだ記録がありません",
    permissionDenied: "カメラを使えません。写真を選ぶと解析できます。",
    photoFallbackHint: "投稿用の写真を選ぶと、ライブ映像なしでガイド解析できます。",
    choosePhotoBtn: "投稿用写真を選ぶ",
    photoAnalysing: "写真を解析中…",
    analysing: "解析中…",
    started: "ガイド中。解析用フレームは自動送信され、元画像は保存しません。",
    stopped: "停止しました。解析済みの足跡は下に残ります。",
    playing: "▶ ガイド音声を再生中",
    privacyNotice: "開始直後は映像解析のみ。音声は下のボタンを押した場合だけ、自然音候補として短く保存します。",
    frameNotice: "端末画像全体のアップロードボタンはありません。解析用の小さなフレームだけ自動で送り、保存するのはサムネイルと解析結果です。",
    naturalSoundBadge: "音声は初期OFF",
    voiceExcludedNotice: "人声の可能性がある音を除外しました",
    audioOffNotice: "音声記録はOFFです。野外らしい発見は自動保存し、室内・人物中心・自然手がかりが弱いものは残しません。",
    audioOptInBtn: "自然音も記録する",
    audioOptOutBtn: "音声記録を止める",
    audioOptInNotice: "音声記録をONにしました。人声らしい音は保存せず、自然音候補だけ2秒単位で保存します。",
    audioUnavailableNotice: "マイクなしで開始しました。映像だけで解析します。",
    contextTitle: "種名より、場所の状態を読む",
    contextBody: "ライブガイドは、種名が確定しない場面でも、植生・草刈り・水路・道路際・土地利用の細かな変化を足跡として残します。看板や車名は生きものとして扱いません。",
    audioTitle: "今回の音の記録",
    audioEmpty: "自然音のまとまりはまだありません",
    audioSkipped: "一部の音声はプライバシー保護のため保存していません",
    audioUnnamed: "まだ名前が付いていない音",
    nowTitle: "Now",
    nowHint: "今の景色には短い状態だけを出します。AIの答えは少し前の足跡として下に残ります。",
    nowNextLabel: "次",
    nowNextInitial: "ゆっくり1方向へ向けて、草・水辺・足元のどれかを見てください。",
    nowNextAnalysing: "その場で止まらず、次は近い特徴か周辺環境を1つ足してください。",
    nowNextFallback: "次は葉・花・水辺・地面・人工物との境目のどれかを1つ見てください。",
    trailTitle: "Trail",
    trailEmpty: "さっきの発見はまだありません",
    trailPending: "さっきの景色を解析中",
    trailDeferred: "移動中なので足跡に残しました",
    playTrail: "聞く",
    saveTrail: "保存",
    autoSaveBadge: "自動保存",
    autoSaved: "自動保存済み",
    autoSkipped: "保存しませんでした",
    autoSaveError: "自動保存できませんでした",
    manualSave: "手動で保存",
  },
  en: {
    title: "Live Guide",
    subtitle: "Continuous video & audio analysis — the land tells its story",
    startBtn: "Start Guide",
    startSheetTitle: "Choose what Guide can use",
    startSheetBody: "Camera and audio are separate choices. You can still change audio later.",
    missionChoiceTitle: "Today's mission",
    missionChoiceBody: "Pick one intent first, and Guide will match the recommended camera and audio setup.",
    missions: [
      { id: "quick", label: "Look for 5 min", body: "Read nearby vegetation or water edges and leave the first field clue" },
      { id: "sound", label: "Walk audio-only", body: "Keep the phone pocketed and collect bird, insect, or water cues" },
      { id: "spot", label: "Study one spot", body: "Stay in place and capture vegetation, landform, and management traces" },
    ],
    cameraChoiceTitle: "Use the camera?",
    cameraChoiceBody: "Turn it on when you want plants, habitat, and landforms read from the scene. Turn it off for pocket audio-only walks.",
    cameraOnBtn: "Camera on",
    cameraOffBtn: "Camera off",
    cameraOffHint: "With camera off, Guide does not capture video. If audio is on, only natural-sound candidates are recorded.",
    audioChoiceTitle: "Record audio too?",
    audioChoiceBody: "Audio helps during walks or bike rides by adding clues like birds, insects, and water. Speech-like clips are skipped.",
    audioOnBtn: "Audio on",
    audioOffBtn: "Audio off",
    beginWithChoices: "Start with these settings",
    startSheetCancel: "Back",
    noSensorNotice: "Turn on either camera or audio to start.",
    audioOnlyNotice: "Started audio-only. No video is captured; only natural-sound candidates are recorded.",
    audioOnlyTitle: "Recording audio only",
    audioOnlyBody: "No camera video is captured. This mode is suited to pocket walks that collect natural sound cues.",
    cameraOnlyNotice: "Started with camera only. Audio is not recorded.",
    cameraAudioNotice: "Started with camera and audio. Speech-like clips are not saved.",
    recommendedTitle: "Recommended setup",
    recommendedBody: "For walking or slow bike rides, Camera on + Audio on gives Guide the richest field clues.",
    recommendedApply: "Use recommended",
    recommendedPocketHint: "For pocket use, switch to Camera off + Audio on to collect natural sound without video.",
    sessionSummaryTitle: "Session recap",
    sessionSummarySaved: "Saved",
    sessionSummarySkipped: "Not saved",
    sessionSummaryAudioOnly: "Audio-only captures",
    queuedRecapLabel: "Waiting to sync",
    sessionSummaryEmpty: "No session activity to summarize yet.",
    sessionSummaryTodayLabel: "What you noticed",
    sessionSummaryEvidenceLabel: "Evidence to add",
    sessionSummaryNextLabel: "Next visit",
    sessionSummaryTodayEmpty: "No field clues yet.",
    sessionSummaryEvidenceEmpty: "Add one close feature or place condition to make this stronger.",
    sessionSummaryNextEmpty: "Return to the same spot and check a leaf, flower, water edge, or ground surface.",
    sessionSummaryResultsLink: "Review guide outcomes",
    offlineOnline: "Online",
    offlineOffline: "Offline",
    offlineQueued: "{count} unsynced",
    offlineSyncing: "Syncing",
    offlineSynced: "Synced",
    offlineFailed: "Sync issue",
    offlineSceneQueued: "Temporarily saved on this device",
    storagePressure: "Device storage is getting full. Guide will lower video frequency and prioritize natural sound plus representative frames.",
    stopBtn: "Stop",
    langLabel: "Language",
    modeLabel: "Movement mode",
    modes: [
      { id: "walk", label: "Walk" },
      { id: "vehicle", label: "Car / bike" },
    ],
    categoryLabel: "Guide Category",
    categories: [
      { id: "biodiversity", label: "🌿 Biodiversity" },
      { id: "land_history", label: "🗺️ Land History" },
      { id: "buildings", label: "🏛️ Buildings & Culture" },
      { id: "people_history", label: "👤 Human History" },
    ],
    recordBtn: "Save this discovery",
    reviewTitle: "Today's Discoveries",
    noRecords: "No records yet",
    permissionDenied: "Camera is unavailable. Choose a photo to analyse instead.",
    photoFallbackHint: "Choose a post photo to run guide analysis without live video.",
    choosePhotoBtn: "Choose post photo",
    photoAnalysing: "Analysing photo…",
    analysing: "Analysing…",
    started: "Guide is running. Small analysis frames are sent automatically; original device images are not stored.",
    stopped: "Stopped. Analysed trail items remain below.",
    playing: "▶ Playing guide audio",
    privacyNotice: "Guide starts with video analysis only. Audio is saved only if you enable natural sound recording below.",
    frameNotice: "There is no full-device-image upload button. Guide only sends small analysis frames and stores thumbnails plus results.",
    naturalSoundBadge: "Audio off by default",
    voiceExcludedNotice: "Possible human voice was excluded",
    audioOffNotice: "Audio recording is off. Field-like discoveries are saved automatically; indoor, person-first, or weak nature signals are not kept.",
    audioOptInBtn: "Record natural sounds",
    audioOptOutBtn: "Stop audio recording",
    audioOptInNotice: "Natural sound recording is on. Speech-like clips are not stored; natural-sound candidates are saved in short chunks.",
    audioUnavailableNotice: "Started without microphone. Video analysis continues.",
    contextTitle: "Read the place, not only species",
    contextBody: "Live Guide treats vegetation, mowing, waterways, roadside edges, and land-use changes as useful records even when species cannot be identified. Signs and vehicle names are not treated as organisms.",
    audioTitle: "Sounds From This Session",
    audioEmpty: "No natural sound bundles yet",
    audioSkipped: "Some clips were skipped for privacy",
    audioUnnamed: "Unnamed sound",
    nowTitle: "Now",
    nowHint: "The current view stays quiet. AI results appear below as earlier trail cards.",
    nowNextLabel: "Next",
    nowNextInitial: "Point slowly in one direction and look for plants, water edges, or the ground.",
    nowNextAnalysing: "Keep moving; next add one close feature or surrounding context.",
    nowNextFallback: "Next, check one leaf, flower, water edge, ground surface, or habitat boundary.",
    trailTitle: "Trail",
    trailEmpty: "No earlier discoveries yet",
    trailPending: "Analysing an earlier view",
    trailDeferred: "Saved to the trail while you keep moving",
    playTrail: "Play",
    saveTrail: "Save",
    autoSaveBadge: "Auto-save",
    autoSaved: "Auto-saved",
    autoSkipped: "Not saved",
    autoSaveError: "Auto-save failed",
    manualSave: "Save manually",
  },
  es: {
    title: "Guía de Campo",
    subtitle: "Análisis continuo de video y audio — la tierra cuenta su historia",
    startBtn: "Iniciar Guía",
    startSheetTitle: "Elige qué puede usar la guía",
    startSheetBody: "La cámara y el audio se eligen por separado. Luego puedes cambiar solo el audio.",
    missionChoiceTitle: "Misión de hoy",
    missionChoiceBody: "Elige una intención y la guía ajustará la cámara y el audio recomendados.",
    missions: [
      { id: "quick", label: "Mirar 5 min", body: "Leer vegetación o bordes de agua cercanos y dejar una primera pista" },
      { id: "sound", label: "Caminar con audio", body: "Llevar el móvil en el bolsillo y recoger aves, insectos o agua" },
      { id: "spot", label: "Estudiar un punto", body: "Quedarse en un lugar y captar vegetación, relieve y manejo" },
    ],
    cameraChoiceTitle: "¿Usar cámara?",
    cameraChoiceBody: "Actívala para leer plantas, hábitat y relieve. Desactívala si llevas el teléfono en el bolsillo y quieres solo audio.",
    cameraOnBtn: "Cámara ON",
    cameraOffBtn: "Cámara OFF",
    cameraOffHint: "Sin cámara no se captura video. Si el audio está activo, solo se guardan sonidos naturales candidatos.",
    audioChoiceTitle: "¿Grabar audio también?",
    audioChoiceBody: "En caminatas o bicicleta, el audio aporta pistas como aves, insectos o agua. Los clips con posible voz humana se omiten.",
    audioOnBtn: "Audio ON",
    audioOffBtn: "Audio OFF",
    beginWithChoices: "Iniciar con estos ajustes",
    startSheetCancel: "Volver",
    noSensorNotice: "Activa cámara o audio para iniciar.",
    audioOnlyNotice: "Iniciado solo con audio. No se captura video; solo sonidos naturales candidatos.",
    audioOnlyTitle: "Grabando solo audio",
    audioOnlyBody: "No se captura video. Este modo sirve para caminar con el teléfono en el bolsillo y recoger pistas sonoras naturales.",
    cameraOnlyNotice: "Iniciado solo con cámara. No se graba audio.",
    cameraAudioNotice: "Iniciado con cámara y audio. Los clips con voz probable no se guardan.",
    recommendedTitle: "Ajuste recomendado",
    recommendedBody: "Para caminar o ir despacio en bicicleta, cámara ON + audio ON aporta más pistas de campo.",
    recommendedApply: "Usar recomendado",
    recommendedPocketHint: "Para usarlo en el bolsillo, cambia a cámara OFF + audio ON y no se capturará video.",
    sessionSummaryTitle: "Resumen de la sesión",
    sessionSummarySaved: "Guardado",
    sessionSummarySkipped: "No guardado",
    sessionSummaryAudioOnly: "Capturas solo audio",
    queuedRecapLabel: "Pendiente de sincronizar",
    sessionSummaryEmpty: "Aún no hay actividad para resumir.",
    sessionSummaryTodayLabel: "Lo visto hoy",
    sessionSummaryEvidenceLabel: "Evidencia faltante",
    sessionSummaryNextLabel: "Próxima visita",
    sessionSummaryTodayEmpty: "Aún no hay pistas de campo.",
    sessionSummaryEvidenceEmpty: "Añade un rasgo cercano o una condición del lugar.",
    sessionSummaryNextEmpty: "Vuelve al mismo punto y revisa hoja, flor, borde de agua o suelo.",
    sessionSummaryResultsLink: "Revisar resultados de la guía",
    offlineOnline: "En línea",
    offlineOffline: "Sin conexión",
    offlineQueued: "{count} sin sincronizar",
    offlineSyncing: "Sincronizando",
    offlineSynced: "Sincronizado",
    offlineFailed: "Error de sincronización",
    offlineSceneQueued: "Guardado temporalmente en este dispositivo",
    storagePressure: "El almacenamiento del dispositivo se está llenando. La guía bajará la frecuencia de video y priorizará sonidos naturales y fotogramas representativos.",
    stopBtn: "Detener",
    langLabel: "Idioma",
    modeLabel: "Modo de movimiento",
    modes: [
      { id: "walk", label: "A pie" },
      { id: "vehicle", label: "Auto / bici" },
    ],
    categoryLabel: "Categoría",
    categories: [
      { id: "biodiversity", label: "🌿 Biodiversidad" },
      { id: "land_history", label: "🗺️ Historia del lugar" },
      { id: "buildings", label: "🏛️ Edificios y cultura" },
      { id: "people_history", label: "👤 Historia humana" },
    ],
    recordBtn: "Guardar este hallazgo",
    reviewTitle: "Descubrimientos de hoy",
    noRecords: "Sin registros aún",
    permissionDenied: "La cámara no está disponible. Elige una foto para analizarla.",
    photoFallbackHint: "Elige una foto de publicación para usar la guía sin video en vivo.",
    choosePhotoBtn: "Elegir foto",
    photoAnalysing: "Analizando foto…",
    analysing: "Analizando…",
    started: "La guía está activa. Solo se envían fotogramas pequeños de análisis; no se guardan las imágenes originales.",
    stopped: "Detenido. Las huellas analizadas quedan abajo.",
    playing: "▶ Reproduciendo audio",
    privacyNotice: "La guía empieza solo con video. El audio se guarda solo si activas la grabación de sonidos naturales.",
    frameNotice: "No hay botón para subir toda la imagen del dispositivo. Solo se envían fotogramas pequeños y se guardan miniaturas y resultados.",
    naturalSoundBadge: "Audio apagado por defecto",
    voiceExcludedNotice: "Se excluyó audio con posible voz humana",
    audioOffNotice: "La grabación de audio está apagada. Los hallazgos de campo se guardan automáticamente; las escenas de interior, personas o señales débiles no se conservan.",
    audioOptInBtn: "Grabar sonidos naturales",
    audioOptOutBtn: "Detener audio",
    audioOptInNotice: "La grabación de sonidos naturales está activa. Los clips con posible voz humana no se guardan.",
    audioUnavailableNotice: "Iniciado sin micrófono. El análisis de video continúa.",
    contextTitle: "Leer el lugar, no solo especies",
    contextBody: "La guía registra vegetación, cortes de pasto, agua, bordes de camino y uso del suelo aunque la especie no se pueda identificar. Señales y nombres de vehículos no son organismos.",
    audioTitle: "Sonidos de esta sesión",
    audioEmpty: "Todavía no hay grupos de sonidos naturales",
    audioSkipped: "Algunos clips se omitieron por privacidad",
    audioUnnamed: "Sonido sin nombre",
    nowTitle: "Ahora",
    nowHint: "La vista actual se mantiene ligera. Los resultados aparecen abajo como tarjetas del recorrido.",
    nowNextLabel: "Siguiente",
    nowNextInitial: "Apunta despacio y mira plantas, bordes de agua o el suelo.",
    nowNextAnalysing: "Sigue avanzando; añade un rasgo cercano o el contexto alrededor.",
    nowNextFallback: "Luego revisa una hoja, flor, borde de agua, suelo o límite del hábitat.",
    trailTitle: "Recorrido",
    trailEmpty: "Todavía no hay descubrimientos anteriores",
    trailPending: "Analizando una vista anterior",
    trailDeferred: "Guardado en el recorrido mientras sigues avanzando",
    playTrail: "Escuchar",
    saveTrail: "Guardar",
    autoSaveBadge: "Autoguardado",
    autoSaved: "Guardado automáticamente",
    autoSkipped: "No guardado",
    autoSaveError: "Falló el autoguardado",
    manualSave: "Guardar manualmente",
  },
  "pt-BR": {
    title: "Guia de Campo",
    subtitle: "Análise contínua de vídeo e áudio — a terra conta sua história",
    startBtn: "Iniciar Guia",
    startSheetTitle: "Escolha o que o guia pode usar",
    startSheetBody: "Câmera e áudio são escolhas separadas. Depois você ainda pode mudar só o áudio.",
    missionChoiceTitle: "Missão de hoje",
    missionChoiceBody: "Escolha uma intenção e o guia ajusta a câmera e o áudio recomendados.",
    missions: [
      { id: "quick", label: "Olhar por 5 min", body: "Ler vegetação ou margens de água próximas e deixar a primeira pista" },
      { id: "sound", label: "Caminhar só com áudio", body: "Levar o celular no bolso e coletar aves, insetos ou água" },
      { id: "spot", label: "Estudar um ponto", body: "Ficar no local e captar vegetação, relevo e manejo" },
    ],
    cameraChoiceTitle: "Usar câmera?",
    cameraChoiceBody: "Ligue para ler plantas, habitat e relevo. Desligue para caminhadas com o celular no bolso e apenas áudio.",
    cameraOnBtn: "Câmera ON",
    cameraOffBtn: "Câmera OFF",
    cameraOffHint: "Com a câmera desligada, nenhum vídeo é capturado. Se o áudio estiver ligado, apenas sons naturais candidatos são gravados.",
    audioChoiceTitle: "Gravar áudio também?",
    audioChoiceBody: "Em caminhadas ou bicicleta, o áudio traz pistas como aves, insetos e água. Clipes com possível voz humana são ignorados.",
    audioOnBtn: "Áudio ON",
    audioOffBtn: "Áudio OFF",
    beginWithChoices: "Iniciar com estes ajustes",
    startSheetCancel: "Voltar",
    noSensorNotice: "Ligue câmera ou áudio para iniciar.",
    audioOnlyNotice: "Iniciado somente com áudio. Nenhum vídeo é capturado; apenas sons naturais candidatos.",
    audioOnlyTitle: "Gravando somente áudio",
    audioOnlyBody: "Nenhum vídeo é capturado. Este modo é indicado para caminhar com o celular no bolso e coletar pistas sonoras naturais.",
    cameraOnlyNotice: "Iniciado somente com câmera. O áudio não é gravado.",
    cameraAudioNotice: "Iniciado com câmera e áudio. Clipes com provável voz não são salvos.",
    recommendedTitle: "Configuração recomendada",
    recommendedBody: "Para caminhar ou pedalar devagar, câmera ON + áudio ON dá ao guia mais pistas de campo.",
    recommendedApply: "Usar recomendado",
    recommendedPocketHint: "Para usar no bolso, mude para câmera OFF + áudio ON e nenhum vídeo será capturado.",
    sessionSummaryTitle: "Resumo da sessão",
    sessionSummarySaved: "Salvo",
    sessionSummarySkipped: "Não salvo",
    sessionSummaryAudioOnly: "Capturas só com áudio",
    queuedRecapLabel: "Aguardando sincronização",
    sessionSummaryEmpty: "Ainda não há atividade para resumir.",
    sessionSummaryTodayLabel: "O que apareceu hoje",
    sessionSummaryEvidenceLabel: "Evidência a acrescentar",
    sessionSummaryNextLabel: "Próxima visita",
    sessionSummaryTodayEmpty: "Ainda não há pistas de campo.",
    sessionSummaryEvidenceEmpty: "Acrescente um detalhe próximo ou uma condição do lugar.",
    sessionSummaryNextEmpty: "Volte ao mesmo ponto e veja folha, flor, água ou solo.",
    sessionSummaryResultsLink: "Revisar resultados do guia",
    offlineOnline: "Online",
    offlineOffline: "Offline",
    offlineQueued: "{count} sem sincronizar",
    offlineSyncing: "Sincronizando",
    offlineSynced: "Sincronizado",
    offlineFailed: "Falha de sincronização",
    offlineSceneQueued: "Salvo temporariamente neste dispositivo",
    storagePressure: "O armazenamento do dispositivo está ficando cheio. O guia reduzirá a frequência de vídeo e priorizará sons naturais e quadros representativos.",
    stopBtn: "Parar",
    langLabel: "Idioma",
    modeLabel: "Modo de movimento",
    modes: [
      { id: "walk", label: "A pé" },
      { id: "vehicle", label: "Carro / bike" },
    ],
    categoryLabel: "Categoria",
    categories: [
      { id: "biodiversity", label: "🌿 Biodiversidade" },
      { id: "land_history", label: "🗺️ História do lugar" },
      { id: "buildings", label: "🏛️ Edifícios e cultura" },
      { id: "people_history", label: "👤 História humana" },
    ],
    recordBtn: "Salvar esta descoberta",
    reviewTitle: "Descobertas de hoje",
    noRecords: "Nenhum registro ainda",
    permissionDenied: "A câmera não está disponível. Escolha uma foto para analisar.",
    photoFallbackHint: "Escolha uma foto de publicação para usar o guia sem vídeo ao vivo.",
    choosePhotoBtn: "Escolher foto",
    photoAnalysing: "Analisando foto…",
    analysing: "Analisando…",
    started: "O guia está ativo. Apenas quadros pequenos de análise são enviados; as imagens originais não são salvas.",
    stopped: "Parado. As trilhas analisadas ficam abaixo.",
    playing: "▶ Reproduzindo áudio",
    privacyNotice: "O guia começa só com vídeo. O áudio só é salvo se você ativar a gravação de sons naturais.",
    frameNotice: "Não há botão para enviar a imagem completa do dispositivo. Só quadros pequenos são enviados, com miniaturas e resultados salvos.",
    naturalSoundBadge: "Áudio desligado por padrão",
    voiceExcludedNotice: "Possível voz humana foi excluída",
    audioOffNotice: "A gravação de áudio está desligada. Descobertas de campo são salvas automaticamente; cenas internas, pessoas ou sinais fracos não ficam registradas.",
    audioOptInBtn: "Gravar sons naturais",
    audioOptOutBtn: "Parar áudio",
    audioOptInNotice: "A gravação de sons naturais está ligada. Clipes com possível voz humana não são salvos.",
    audioUnavailableNotice: "Iniciado sem microfone. A análise de vídeo continua.",
    contextTitle: "Ler o lugar, não só espécies",
    contextBody: "O guia registra vegetação, roçada, água, beiras de estrada e uso do solo mesmo sem identificar a espécie. Placas e nomes de veículos não são organismos.",
    audioTitle: "Sons desta sessão",
    audioEmpty: "Ainda não há grupos de sons naturais",
    audioSkipped: "Alguns clipes foram ignorados por privacidade",
    audioUnnamed: "Som sem nome",
    nowTitle: "Agora",
    nowHint: "A visão atual fica leve. Os resultados aparecem abaixo como cartões do trajeto.",
    nowNextLabel: "Próximo",
    nowNextInitial: "Aponte devagar e observe plantas, margens de água ou o chão.",
    nowNextAnalysing: "Continue; depois acrescente um detalhe próximo ou o contexto ao redor.",
    nowNextFallback: "Em seguida veja uma folha, flor, margem de água, solo ou borda do habitat.",
    trailTitle: "Trajeto",
    trailEmpty: "Ainda não há descobertas anteriores",
    trailPending: "Analisando uma visão anterior",
    trailDeferred: "Salvo no trajeto enquanto você continua andando",
    playTrail: "Ouvir",
    saveTrail: "Salvar",
    autoSaveBadge: "Salvamento automático",
    autoSaved: "Salvo automaticamente",
    autoSkipped: "Não salvo",
    autoSaveError: "Falha ao salvar",
    manualSave: "Salvar manualmente",
  },
};

type GuideAudioPipelineCopy = {
  title: string;
  body: string;
  aria: string;
  stages: Array<{ label: string; body: string }>;
};

function guideAudioPipelineCopy(lang: SiteLang): GuideAudioPipelineCopy {
  if (lang === "ja") {
    return {
      title: "音声ONで、発見が4つの棚につながります",
      body: "その場では楽しい鳴き声メモとして見え、裏側では自然音候補、似た音のまとまり、レビュー待ち、研究利用候補に分かれます。",
      aria: "音声データの接続先",
      stages: [
        { label: "自然音", body: "人声らしい音は保存せず、鳥・虫・水音などの短い候補だけ残す" },
        { label: "仕訳", body: "似た音を bundle / cluster にまとめ、あとで代表音を聞けるようにする" },
        { label: "確認", body: "AI候補を確定名にせず、代表音と確信度を人のレビューへ回す" },
        { label: "研究", body: "時刻・場所・努力量・公開範囲をそろえ、BioMonWeek 型の観測データへ渡す" },
      ],
    };
  }
  if (lang === "es") {
    return {
      title: "Con audio, el hallazgo se conecta a cuatro capas",
      body: "En pantalla se siente como una nota sonora; por dentro se separa en sonidos naturales, grupos similares, revisión y uso de investigación.",
      aria: "Destino de los datos de audio",
      stages: [
        { label: "Naturaleza", body: "Se omite la voz probable y se conservan candidatos breves de aves, insectos o agua." },
        { label: "Agrupar", body: "Los sonidos similares se reúnen como bundle o cluster para escuchar un representante." },
        { label: "Revisar", body: "Las sugerencias de IA no son nombres confirmados; pasan con confianza y evidencia." },
        { label: "Investigar", body: "Hora, lugar, esfuerzo y alcance público quedan listos para monitoreo." },
      ],
    };
  }
  if (lang === "pt-BR") {
    return {
      title: "Com áudio, a descoberta vai para quatro camadas",
      body: "Na tela parece uma nota sonora; por trás vira som natural candidato, grupos semelhantes, revisão e possível uso em pesquisa.",
      aria: "Destino dos dados de áudio",
      stages: [
        { label: "Natureza", body: "Voz provável não é salva; ficam candidatos curtos de aves, insetos ou água." },
        { label: "Agrupar", body: "Sons parecidos viram bundles ou clusters com um som representante." },
        { label: "Revisar", body: "A IA sugere, mas não confirma nomes; a evidência vai para revisão." },
        { label: "Pesquisa", body: "Hora, lugar, esforço e escopo público ficam prontos para monitoramento." },
      ],
    };
  }
  return {
    title: "Audio connects each discovery to four shelves",
    body: "It feels like a field sound note, while the data is separated into natural-sound candidates, similar-sound groups, review work, and research-ready signals.",
    aria: "Audio data destinations",
    stages: [
      { label: "Nature", body: "Speech-like clips are skipped; short bird, insect, and water cues are kept." },
      { label: "Sort", body: "Similar clips become bundles or clusters with a representative sound." },
      { label: "Review", body: "AI suggestions stay provisional until a person reviews the evidence." },
      { label: "Research", body: "Time, place, effort, and publication scope stay attached for monitoring." },
    ],
  };
}

export function renderGuideFlow(basePath: string, lang: SiteLang): string {
  const c = COPY[lang];
  const audioPipeline = guideAudioPipelineCopy(lang);
  const cats = c.categories.map((cat) => `<option value="${escapeHtml(cat.id)}">${escapeHtml(cat.label)}</option>`).join("");
  const modes = c.modes.map((mode) => `<option value="${escapeHtml(mode.id)}">${escapeHtml(mode.label)}</option>`).join("");
  const missions = c.missions.map((mission, index) => `<label class="guide-start-option guide-mission-option">
            <input type="radio" name="guide-mission-choice" value="${escapeHtml(mission.id)}"${index === 0 ? " checked" : ""}>
            <span><b>${escapeHtml(mission.label)}</b><small>${escapeHtml(mission.body)}</small></span>
          </label>`).join("");

  const langOptions = [
    { value: "ja", label: "🇯🇵 日本語" },
    { value: "en", label: "🇬🇧 English" },
    { value: "es", label: "🇪🇸 Español" },
    { value: "pt-BR", label: "🇧🇷 Português" },
    { value: "ko", label: "🇰🇷 한국어" },
    { value: "zh", label: "🇨🇳 中文" },
  ]
    .map((o) => `<option value="${escapeHtml(o.value)}"${o.value === lang ? " selected" : ""}>${escapeHtml(o.label)}</option>`)
    .join("");

  return `
<div class="guide-root" id="guide-root">
  <div class="guide-header">
    <h1 class="guide-title">${escapeHtml(c.title)}</h1>
    <p class="guide-subtitle">${escapeHtml(c.subtitle)}</p>
    <div class="guide-context-card">
      <strong>${escapeHtml(c.contextTitle)}</strong>
      <p>${escapeHtml(c.contextBody)}</p>
    </div>
    <div class="guide-audio-chain" aria-label="${escapeHtml(audioPipeline.aria)}">
      <div>
        <strong>${escapeHtml(audioPipeline.title)}</strong>
        <p>${escapeHtml(audioPipeline.body)}</p>
      </div>
      <ol>
        ${audioPipeline.stages.map((stage) => `<li><b>${escapeHtml(stage.label)}</b><span>${escapeHtml(stage.body)}</span></li>`).join("")}
      </ol>
    </div>
  </div>

  <div class="guide-controls">
    <div class="guide-selects">
      <label class="guide-select-label">${escapeHtml(c.langLabel)}
        <select class="guide-select" id="guide-lang-select">${langOptions}</select>
      </label>
      <label class="guide-select-label">${escapeHtml(c.modeLabel)}
        <select class="guide-select" id="guide-mode-select">${modes}</select>
      </label>
      <label class="guide-select-label">${escapeHtml(c.categoryLabel)}
        <select class="guide-select" id="guide-category-select">${cats}</select>
      </label>
    </div>
    <button class="guide-start-btn" id="guide-start-btn">${escapeHtml(c.startBtn)}</button>
    <div class="guide-privacy-row" aria-label="音声プライバシー">
      <span class="guide-privacy-badge">${escapeHtml(c.naturalSoundBadge)}</span>
      <p class="guide-privacy-note">${escapeHtml(c.privacyNotice)}</p>
      <p class="guide-privacy-note">${escapeHtml(c.frameNotice)}</p>
      <button class="guide-audio-opt-btn" id="guide-audio-opt-btn" type="button" aria-pressed="false">${escapeHtml(c.audioOptInBtn)}</button>
    </div>
    <p class="guide-privacy-live" id="guide-privacy-live" aria-live="polite">${escapeHtml(c.audioOffNotice)}</p>
    <div class="guide-offline-row" id="guide-offline-row" data-state="online" aria-live="polite">
      <span class="guide-offline-state" id="guide-offline-state">${escapeHtml(c.offlineOnline)}</span>
      <span class="guide-offline-queued" id="guide-offline-queued" hidden>${escapeHtml(c.offlineQueued.replace("{count}", "0"))}</span>
      <span class="guide-offline-pressure" id="guide-offline-pressure" hidden>${escapeHtml(c.storagePressure)}</span>
    </div>
  </div>

  <div class="guide-start-sheet-backdrop" id="guide-start-sheet" hidden>
    <div class="guide-start-sheet" role="dialog" aria-modal="true" aria-labelledby="guide-start-sheet-title">
      <div class="guide-start-sheet-head">
        <h2 id="guide-start-sheet-title">${escapeHtml(c.startSheetTitle)}</h2>
        <p>${escapeHtml(c.startSheetBody)}</p>
      </div>

      <fieldset class="guide-start-choice guide-mission-choice">
        <legend>${escapeHtml(c.missionChoiceTitle)}</legend>
        <p>${escapeHtml(c.missionChoiceBody)}</p>
        <div class="guide-start-options guide-mission-options">
          ${missions}
        </div>
      </fieldset>

      <div class="guide-recommended-card">
        <div>
          <strong>${escapeHtml(c.recommendedTitle)}</strong>
          <p>${escapeHtml(c.recommendedBody)}</p>
          <small>${escapeHtml(c.recommendedPocketHint)}</small>
        </div>
        <button class="guide-recommended-apply" id="guide-recommended-apply" type="button">${escapeHtml(c.recommendedApply)}</button>
      </div>

      <fieldset class="guide-start-choice">
        <legend>${escapeHtml(c.cameraChoiceTitle)}</legend>
        <p>${escapeHtml(c.cameraChoiceBody)}</p>
        <div class="guide-start-options">
          <label class="guide-start-option">
            <input type="radio" name="guide-camera-choice" value="on" checked>
            <span>${escapeHtml(c.cameraOnBtn)}</span>
          </label>
          <label class="guide-start-option">
            <input type="radio" name="guide-camera-choice" value="off">
            <span>${escapeHtml(c.cameraOffBtn)}</span>
          </label>
        </div>
        <small>${escapeHtml(c.cameraOffHint)}</small>
      </fieldset>

      <fieldset class="guide-start-choice">
        <legend>${escapeHtml(c.audioChoiceTitle)}</legend>
        <p>${escapeHtml(c.audioChoiceBody)}</p>
        <div class="guide-start-options">
          <label class="guide-start-option">
            <input type="radio" name="guide-audio-choice" value="on">
            <span>${escapeHtml(c.audioOnBtn)}</span>
          </label>
          <label class="guide-start-option">
            <input type="radio" name="guide-audio-choice" value="off" checked>
            <span>${escapeHtml(c.audioOffBtn)}</span>
          </label>
        </div>
      </fieldset>

      <p class="guide-start-sheet-live" id="guide-start-sheet-live" aria-live="polite"></p>
      <div class="guide-start-sheet-actions">
        <button class="guide-sheet-secondary" id="guide-start-cancel" type="button">${escapeHtml(c.startSheetCancel)}</button>
        <button class="guide-sheet-primary" id="guide-start-confirm" type="button">${escapeHtml(c.beginWithChoices)}</button>
      </div>
    </div>
  </div>

  <div class="guide-now" id="guide-now" hidden>
    <div>
      <h2 class="guide-now-title">${escapeHtml(c.nowTitle)}</h2>
      <p class="guide-now-hint">${escapeHtml(c.nowHint)}</p>
      <p class="guide-now-next" id="guide-now-next" hidden><span>${escapeHtml(c.nowNextLabel)}</span><b></b></p>
    </div>
    <div class="guide-now-state" id="guide-now-state"></div>
  </div>

  <section class="guide-coverage" id="guide-coverage" hidden aria-live="polite">
    <div class="guide-coverage-head">
      <div>
        <h2 id="guide-coverage-title">調査カバー</h2>
        <p id="guide-coverage-area">エリア判定中</p>
      </div>
      <span class="guide-coverage-badge" id="guide-coverage-absence">通過中</span>
    </div>
    <div class="guide-coverage-grid">
      <div><strong id="guide-coverage-time">0:00</strong><span id="guide-coverage-time-label">見た時間</span></div>
      <div><strong id="guide-coverage-distance">0m</strong><span id="guide-coverage-distance-label">距離</span></div>
      <div><strong id="guide-coverage-cells">0</strong><span id="guide-coverage-cells-label">10mセル</span></div>
      <div><strong id="guide-coverage-ai">0</strong><span id="guide-coverage-ai-label">AI解析</span></div>
    </div>
    <div class="guide-coverage-map" id="guide-coverage-map" hidden>
      <div class="guide-coverage-map-canvas" id="guide-coverage-map-canvas"></div>
      <div class="guide-coverage-map-legend">
        <span><i class="is-visited"></i>見た10m</span>
        <span><i class="is-missing"></i>未踏10m</span>
      </div>
    </div>
    <p class="guide-coverage-hint" id="guide-coverage-hint">10m単位で端末内の見た範囲を推定します。</p>
  </section>

  <div class="guide-camera-wrap" id="guide-camera-wrap" hidden>
    <video class="guide-video" id="guide-video" autoplay playsinline muted></video>
    <div class="guide-audio-only-panel" id="guide-audio-only-panel" hidden>
      <strong>${escapeHtml(c.audioOnlyTitle)}</strong>
      <p>${escapeHtml(c.audioOnlyBody)}</p>
    </div>
    <div class="guide-status" id="guide-status"></div>
    <button class="guide-stop-btn" id="guide-stop-btn">${escapeHtml(c.stopBtn)}</button>
  </div>

  <div class="guide-permission-msg" id="guide-permission-msg" hidden>${escapeHtml(c.permissionDenied)}</div>
  <div class="guide-photo-fallback" id="guide-photo-fallback" hidden>
    <p>${escapeHtml(c.photoFallbackHint)}</p>
    <button class="guide-photo-btn" id="guide-photo-btn" type="button">${escapeHtml(c.choosePhotoBtn)}</button>
    <input class="guide-photo-input" id="guide-photo-input" type="file" accept="image/*" hidden>
  </div>

  <section class="guide-session-summary" id="guide-session-summary" hidden aria-live="polite">
    <h2>${escapeHtml(c.sessionSummaryTitle)}</h2>
    <div class="guide-session-summary-grid">
      <div><strong id="guide-summary-saved">0</strong><span>${escapeHtml(c.sessionSummarySaved)}</span></div>
      <div><strong id="guide-summary-skipped">0</strong><span>${escapeHtml(c.sessionSummarySkipped)}</span></div>
      <div><strong id="guide-summary-audio-only">0</strong><span>${escapeHtml(c.sessionSummaryAudioOnly)}</span></div>
      <div><strong id="guide-summary-queued">0</strong><span>${escapeHtml(c.queuedRecapLabel)}</span></div>
    </div>
    <p id="guide-summary-empty" hidden>${escapeHtml(c.sessionSummaryEmpty)}</p>
    <div class="guide-session-insights">
      <div><span>${escapeHtml(c.sessionSummaryTodayLabel)}</span><strong id="guide-summary-today">${escapeHtml(c.sessionSummaryTodayEmpty)}</strong></div>
      <div><span>${escapeHtml(c.sessionSummaryEvidenceLabel)}</span><strong id="guide-summary-evidence">${escapeHtml(c.sessionSummaryEvidenceEmpty)}</strong></div>
      <div><span>${escapeHtml(c.sessionSummaryNextLabel)}</span><strong id="guide-summary-next">${escapeHtml(c.sessionSummaryNextEmpty)}</strong></div>
    </div>
    <a class="guide-session-results-link" href="${escapeHtml(basePath ? `${basePath}/guide/outcomes` : "/guide/outcomes")}">${escapeHtml(c.sessionSummaryResultsLink)}</a>
  </section>

  <div class="guide-discoveries" id="guide-discoveries">
    <div class="guide-trail-header">
      <h2 class="guide-discoveries-title">${escapeHtml(c.trailTitle)}</h2>
      <span class="guide-trail-pill" id="guide-trail-pill" hidden></span>
    </div>
    <ul class="guide-discovery-list" id="guide-discovery-list">
      <li class="guide-no-records" id="guide-no-records">${escapeHtml(c.trailEmpty)}</li>
    </ul>
  </div>

  <div class="guide-audio" id="guide-audio">
    <div class="guide-audio-header">
      <h2 class="guide-audio-title">${escapeHtml(c.audioTitle)}</h2>
      <p class="guide-audio-note">${escapeHtml(c.privacyNotice)}</p>
    </div>
    <p class="guide-audio-skipped" id="guide-audio-skipped" hidden></p>
    <ul class="guide-audio-list" id="guide-audio-list">
      <li class="guide-no-records" id="guide-audio-empty">${escapeHtml(c.audioEmpty)}</li>
    </ul>
  </div>
</div>

<script>
window.ikimonFacePrivacyAssetBase = ${JSON.stringify(basePath ? basePath + "/assets/face-privacy" : "/assets/face-privacy")};
${FACE_PRIVACY_CLIENT_SCRIPT}
(function () {
  const copy = {
    analysing: ${JSON.stringify(c.analysing)},
    started: ${JSON.stringify(c.started)},
    stopped: ${JSON.stringify(c.stopped)},
    playing: ${JSON.stringify(c.playing)},
    voiceExcludedNotice: ${JSON.stringify(c.voiceExcludedNotice)},
    audioOffNotice: ${JSON.stringify(c.audioOffNotice)},
    audioOptInBtn: ${JSON.stringify(c.audioOptInBtn)},
    audioOptOutBtn: ${JSON.stringify(c.audioOptOutBtn)},
    audioOptInNotice: ${JSON.stringify(c.audioOptInNotice)},
    audioUnavailableNotice: ${JSON.stringify(c.audioUnavailableNotice)},
    audioEmpty: ${JSON.stringify(c.audioEmpty)},
    audioSkipped: ${JSON.stringify(c.audioSkipped)},
    audioUnnamed: ${JSON.stringify(c.audioUnnamed)},
    photoAnalysing: ${JSON.stringify(c.photoAnalysing)},
    trailPending: ${JSON.stringify(c.trailPending)},
    trailDeferred: ${JSON.stringify(c.trailDeferred)},
    playTrail: ${JSON.stringify(c.playTrail)},
    saveTrail: ${JSON.stringify(c.saveTrail)},
    autoSaveBadge: ${JSON.stringify(c.autoSaveBadge)},
    autoSaved: ${JSON.stringify(c.autoSaved)},
    autoSkipped: ${JSON.stringify(c.autoSkipped)},
    autoSaveError: ${JSON.stringify(c.autoSaveError)},
    manualSave: ${JSON.stringify(c.manualSave)},
    noSensorNotice: ${JSON.stringify(c.noSensorNotice)},
    audioOnlyNotice: ${JSON.stringify(c.audioOnlyNotice)},
    cameraOnlyNotice: ${JSON.stringify(c.cameraOnlyNotice)},
    cameraAudioNotice: ${JSON.stringify(c.cameraAudioNotice)},
    nowNextInitial: ${JSON.stringify(c.nowNextInitial)},
    nowNextAnalysing: ${JSON.stringify(c.nowNextAnalysing)},
    nowNextFallback: ${JSON.stringify(c.nowNextFallback)},
    sessionSummaryEmpty: ${JSON.stringify(c.sessionSummaryEmpty)},
    sessionSummaryTodayEmpty: ${JSON.stringify(c.sessionSummaryTodayEmpty)},
    sessionSummaryEvidenceEmpty: ${JSON.stringify(c.sessionSummaryEvidenceEmpty)},
    sessionSummaryNextEmpty: ${JSON.stringify(c.sessionSummaryNextEmpty)},
    offlineOnline: ${JSON.stringify(c.offlineOnline)},
    offlineOffline: ${JSON.stringify(c.offlineOffline)},
    offlineQueued: ${JSON.stringify(c.offlineQueued)},
    offlineSyncing: ${JSON.stringify(c.offlineSyncing)},
    offlineSynced: ${JSON.stringify(c.offlineSynced)},
    offlineFailed: ${JSON.stringify(c.offlineFailed)},
    offlineSceneQueued: ${JSON.stringify(c.offlineSceneQueued)},
    storagePressure: ${JSON.stringify(c.storagePressure)}
  };
  const BASE = ${JSON.stringify(basePath)};

  let stream = null;
  let audioStream = null;
  let mediaRecorder = null;
  let audioContext = null;
  let analyser = null;
  let freqData = null;
  let timeData = null;
  let audioSampleTimer = null;
  let audioSliceTimer = null;
  let analyseTimer = null;
  let telemetryTimer = null;
  let visualSampleTimer = null;
  let recapTimer = null;
  let locationWatchId = null;
  let running = false;
  let lastScene = null;
  let lastKnownPosition = { lat: 35.68, lng: 139.76, accuracyM: null, speedMps: null, headingDegrees: null, positionCapturedAt: null, stale: true, source: 'fallback' };
  let lastRoutePosition = null;
  let sessionDistanceM = 0;
  let liveAssistToken = null;
  let sceneAudioChunks = [];
  let sceneAudioPrivacySkippedCount = 0;
  let analyserFrames = [];
  let clientPrivacySkippedCount = 0;
  let audioOptIn = false;
  let cameraOptIn = true;
  let audioOnlyChunkCount = 0;
  let offlineQueuedCount = 0;
  let offlineSyncing = false;
  let offlineFailed = false;
  let offlineLastSynced = false;
  let storagePressureActive = false;
  let sessionStartedAt = null;
  let lastTelemetrySentAt = 0;
  let lastAiSubmittedAt = 0;
  let aiSubmitInFlight = false;
  let visualCandidates = [];
  let telemetryBuffer = [];
  let lastVisualMetrics = null;
  let lastAiPosition = null;
  const localCoverageCells = new Set();
  const localCoverageWeakCells = new Set();
  let latestCoverageFields = [];
  let latestAbsenceState = 'non_detection_note';
  let latestCoverageHints = [];
  const coverageFeatureTypes = { species: 0, vegetation: 0, landform: 0, sound: 0, structure: 0 };
  const localCoverageCellMap = new Map();
  const coverageSceneIds = new Set();
  let coverageMap = null;
  let coverageMapReady = false;
  let coverageMapLoading = false;
  let coverageMapLastFieldId = null;
  let coverageMapMarker = null;
  const pendingScenes = new Map();
  const readyScenes = new Map();
  const trailBundles = new Map();
  const manuallySavedSceneIds = new Set();
  const sessionId = 'guide-' + Math.random().toString(36).slice(2);
  const preferredMime = pickAudioMimeType();
  const OFFLINE_DB_NAME = 'ikimon-guide-offline-v1';
  const OFFLINE_DB_VERSION = 1;
  const OFFLINE_STORE = 'queue';
  const OFFLINE_MAX_BYTES = 80 * 1024 * 1024;
  const OFFLINE_MAX_SCENES = 120;
  const OFFLINE_MAX_AUDIO = 1800;
  const ONLINE_ANALYSE_INTERVAL_MS = 18000;
  const OFFLINE_ANALYSE_INTERVAL_MS = 22000;
  const TELEMETRY_INTERVAL_MS = 1500;
  const VISUAL_SAMPLE_INTERVAL_MS = 5000;
  const AI_MIN_INTERVAL_MS = 15000;
  const AI_FORCE_INTERVAL_MS = 22000;
  const LOCAL_COVERAGE_CELL_M = 10;
  const AUDIO_CHUNK_TARGET_MS = 2000;
  const AUDIO_CHUNK_MIN_MS = 1600;
  const AUDIO_CHUNK_MAX_MS = 3200;
  const AUDIO_CHUNK_MIN_BYTES = 2048;
  const AUDIO_QUALITY_GATE_VERSION = 'guide_audio_webm_v1';

  const video      = document.getElementById('guide-video');
  const startBtn   = document.getElementById('guide-start-btn');
  const stopBtn    = document.getElementById('guide-stop-btn');
  const camWrap    = document.getElementById('guide-camera-wrap');
  const nowWrap    = document.getElementById('guide-now');
  const nowState   = document.getElementById('guide-now-state');
  const nowNext    = document.getElementById('guide-now-next');
  const permMsg    = document.getElementById('guide-permission-msg');
  const photoFallback = document.getElementById('guide-photo-fallback');
  const photoBtn   = document.getElementById('guide-photo-btn');
  const photoInput = document.getElementById('guide-photo-input');
  const statusEl   = document.getElementById('guide-status');
  const listEl     = document.getElementById('guide-discovery-list');
  const noRec      = document.getElementById('guide-no-records');
  const trailPill  = document.getElementById('guide-trail-pill');
  const audioList  = document.getElementById('guide-audio-list');
  const audioEmpty = document.getElementById('guide-audio-empty');
  const audioSkip  = document.getElementById('guide-audio-skipped');
  const audioOptBtn = document.getElementById('guide-audio-opt-btn');
  const privacyLive = document.getElementById('guide-privacy-live');
  const audioOnlyPanel = document.getElementById('guide-audio-only-panel');
  const startSheet = document.getElementById('guide-start-sheet');
  const startConfirm = document.getElementById('guide-start-confirm');
  const startCancel = document.getElementById('guide-start-cancel');
  const startSheetLive = document.getElementById('guide-start-sheet-live');
  const recommendedApply = document.getElementById('guide-recommended-apply');
  const sessionSummary = document.getElementById('guide-session-summary');
  const summarySaved = document.getElementById('guide-summary-saved');
  const summarySkipped = document.getElementById('guide-summary-skipped');
  const summaryAudioOnly = document.getElementById('guide-summary-audio-only');
  const summaryQueued = document.getElementById('guide-summary-queued');
  const summaryEmpty = document.getElementById('guide-summary-empty');
  const summaryToday = document.getElementById('guide-summary-today');
  const summaryEvidence = document.getElementById('guide-summary-evidence');
  const summaryNext = document.getElementById('guide-summary-next');
  const offlineRow = document.getElementById('guide-offline-row');
  const offlineState = document.getElementById('guide-offline-state');
  const offlineQueued = document.getElementById('guide-offline-queued');
  const offlinePressure = document.getElementById('guide-offline-pressure');
  const coveragePanel = document.getElementById('guide-coverage');
  const coverageTitle = document.getElementById('guide-coverage-title');
  const coverageArea = document.getElementById('guide-coverage-area');
  const coverageAbsence = document.getElementById('guide-coverage-absence');
  const coverageTime = document.getElementById('guide-coverage-time');
  const coverageDistance = document.getElementById('guide-coverage-distance');
  const coverageCells = document.getElementById('guide-coverage-cells');
  const coverageAi = document.getElementById('guide-coverage-ai');
  const coverageHint = document.getElementById('guide-coverage-hint');
  const coverageTimeLabel = document.getElementById('guide-coverage-time-label');
  const coverageDistanceLabel = document.getElementById('guide-coverage-distance-label');
  const coverageCellsLabel = document.getElementById('guide-coverage-cells-label');
  const coverageAiLabel = document.getElementById('guide-coverage-ai-label');
  const coverageMapWrap = document.getElementById('guide-coverage-map');
  const coverageMapCanvas = document.getElementById('guide-coverage-map-canvas');

  function getLang() { return document.getElementById('guide-lang-select').value; }
  function getGuideMode() { return document.getElementById('guide-mode-select').value || 'walk'; }
  function getCategory() { return document.getElementById('guide-category-select').value; }
  function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }
  function setNowState(msg) { if (nowState) nowState.textContent = msg || ''; }
  function setNextAction(message) {
    if (!nowNext) return;
    const body = nowNext.querySelector('b');
    const text = String(message || '').trim();
    nowNext.hidden = !text;
    if (body) body.textContent = text;
  }
  function escapeInline(value) {
    return String(value || '').replace(/[&<>\"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char;
    });
  }
  function formatCopy(template, values) {
    let text = String(template || '');
    Object.keys(values || {}).forEach((key) => {
      text = text.split('{' + key + '}').join(String(values[key]));
    });
    return text;
  }
  function coverageCopy() {
    const lang = getLang();
    if (lang === 'en') {
      return {
        title: 'Survey coverage',
        areaUnknown: 'Checking registered area',
        outsideArea: 'No registered area here',
        timeLabel: 'Time seen',
        distanceLabel: 'Distance',
        cellsLabel: '10m cells',
        aiLabel: 'AI runs',
        nonDetection: 'Passed, no AI detection',
        searched: 'Searched, not found',
        candidate: 'Absence candidate',
        weakGps: 'GPS is wider than 10m, so coverage is estimated.',
        defaultHint: 'Device-side coverage uses 10m cells; exact route stays private.',
        thinPrefix: 'Thin next: '
      };
    }
    return {
      title: '調査カバー',
      areaUnknown: '登録エリアを確認中',
      outsideArea: '登録エリア外',
      timeLabel: '見た時間',
      distanceLabel: '距離',
      cellsLabel: '10mセル',
      aiLabel: 'AI解析',
      nonDetection: '通過・AI未検出',
      searched: '探したが未検出',
      candidate: '不在候補',
      weakGps: 'GPS精度が10mより粗いので、カバー率は推定です。',
      defaultHint: '端末内では10mセルで見た範囲を推定し、exact routeは公開しません。',
      thinPrefix: '次に薄いところ: '
    };
  }
  function formatDuration(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return minutes + ':' + String(seconds).padStart(2, '0');
  }
  function formatMeters(value) {
    const meters = Math.max(0, Math.round(Number(value) || 0));
    if (meters >= 1000) return (meters / 1000).toFixed(1) + 'km';
    return meters + 'm';
  }
  function localCellKey(position) {
    if (!position || !Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return null;
    const latStep = LOCAL_COVERAGE_CELL_M / 111320;
    const lngStep = LOCAL_COVERAGE_CELL_M / Math.max(1, 111320 * Math.cos(position.lat * Math.PI / 180));
    return Math.floor(position.lat / latStep) + ':' + Math.floor(position.lng / lngStep);
  }
  function localCellBounds(position) {
    if (!position || !Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return null;
    const latStep = LOCAL_COVERAGE_CELL_M / 111320;
    const lngStep = LOCAL_COVERAGE_CELL_M / Math.max(1, 111320 * Math.cos(position.lat * Math.PI / 180));
    const y = Math.floor(position.lat / latStep);
    const x = Math.floor(position.lng / lngStep);
    return {
      minLat: y * latStep,
      maxLat: (y + 1) * latStep,
      minLng: x * lngStep,
      maxLng: (x + 1) * lngStep,
      centerLat: (y + 0.5) * latStep,
      centerLng: (x + 0.5) * lngStep
    };
  }
  function rememberCoveragePosition(position) {
    const key = localCellKey(position);
    if (!key) return;
    localCoverageCells.add(key);
    const bounds = localCellBounds(position);
    if (bounds) localCoverageCellMap.set(key, bounds);
    const accuracy = Number(position.accuracyM);
    if (!Number.isFinite(accuracy) || accuracy > Math.max(15, LOCAL_COVERAGE_CELL_M * 1.5)) {
      localCoverageWeakCells.add(key);
    }
    updateCoverageUi();
  }
  function coverageWeakAxes() {
    const entries = Object.keys(coverageFeatureTypes)
      .map(function (key) { return { key: key, value: coverageFeatureTypes[key] || 0 }; })
      .sort(function (a, b) { return a.value - b.value; });
    const labels = {
      species: getLang() === 'en' ? 'species' : '生きもの',
      vegetation: getLang() === 'en' ? 'vegetation' : '草地/植生',
      landform: getLang() === 'en' ? 'water/landform' : '水辺/地形',
      sound: getLang() === 'en' ? 'sound' : '音',
      structure: getLang() === 'en' ? 'edges/structures' : '縁/人工物'
    };
    return entries.slice(0, 2).map(function (entry) { return labels[entry.key] || entry.key; });
  }
  function emptyFeatureCollection() {
    return { type: 'FeatureCollection', features: [] };
  }
  function cellPolygon(bounds) {
    return {
      type: 'Polygon',
      coordinates: [[
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat],
        [bounds.minLng, bounds.maxLat],
        [bounds.minLng, bounds.minLat]
      ]]
    };
  }
  function visitedCellFeatures() {
    const features = [];
    localCoverageCellMap.forEach(function (bounds, key) {
      features.push({
        type: 'Feature',
        properties: { key: key },
        geometry: cellPolygon(bounds)
      });
    });
    return { type: 'FeatureCollection', features: features };
  }
  function pointInRing(lng, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const xi = Number(ring[i][0]);
      const yi = Number(ring[i][1]);
      const xj = Number(ring[j][0]);
      const yj = Number(ring[j][1]);
      const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  function geometryContainsPoint(geometry, lng, lat) {
    if (!geometry || !geometry.type || !geometry.coordinates) return true;
    if (geometry.type === 'Polygon') {
      const rings = geometry.coordinates || [];
      if (!rings.length || !pointInRing(lng, lat, rings[0])) return false;
      for (let i = 1; i < rings.length; i += 1) if (pointInRing(lng, lat, rings[i])) return false;
      return true;
    }
    if (geometry.type === 'MultiPolygon') {
      return (geometry.coordinates || []).some(function (polygon) {
        return geometryContainsPoint({ type: 'Polygon', coordinates: polygon }, lng, lat);
      });
    }
    return true;
  }
  function coverageFieldFeature(field) {
    if (!field) return null;
    const geometry = field.geometry && field.geometry.type ? field.geometry : null;
    if (geometry) {
      return {
        type: 'Feature',
        properties: { fieldId: field.fieldId || '', name: field.name || '' },
        geometry: geometry
      };
    }
    const center = field.center || {};
    const lat = Number(center.lat);
    const lng = Number(center.lng);
    const radiusM = Math.max(50, Math.min(500, Number(field.radiusM) || 100));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const points = [];
    for (let i = 0; i <= 36; i += 1) {
      const angle = (i / 36) * Math.PI * 2;
      points.push([
        lng + Math.cos(angle) * radiusM / Math.max(1, 111320 * Math.cos(lat * Math.PI / 180)),
        lat + Math.sin(angle) * radiusM / 111320
      ]);
    }
    return {
      type: 'Feature',
      properties: { fieldId: field.fieldId || '', name: field.name || '' },
      geometry: { type: 'Polygon', coordinates: [points] }
    };
  }
  function fieldBbox(field, feature) {
    if (field && field.bbox) return field.bbox;
    const coords = [];
    function collect(value) {
      if (!Array.isArray(value)) return;
      if (typeof value[0] === 'number' && typeof value[1] === 'number') coords.push(value);
      else value.forEach(collect);
    }
    if (feature && feature.geometry) collect(feature.geometry.coordinates);
    if (!coords.length) return null;
    return coords.reduce(function (bbox, coord) {
      const lng = Number(coord[0]);
      const lat = Number(coord[1]);
      return {
        minLat: Math.min(bbox.minLat, lat),
        maxLat: Math.max(bbox.maxLat, lat),
        minLng: Math.min(bbox.minLng, lng),
        maxLng: Math.max(bbox.maxLng, lng)
      };
    }, { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity });
  }
  function targetCellFeatures(field, feature) {
    const bbox = fieldBbox(field, feature);
    if (!bbox || !Number.isFinite(bbox.minLat) || !Number.isFinite(bbox.minLng)) return emptyFeatureCollection();
    const midLat = (bbox.minLat + bbox.maxLat) / 2;
    const latStep = LOCAL_COVERAGE_CELL_M / 111320;
    const lngStep = LOCAL_COVERAGE_CELL_M / Math.max(1, 111320 * Math.cos(midLat * Math.PI / 180));
    const minY = Math.floor(bbox.minLat / latStep);
    const maxY = Math.ceil(bbox.maxLat / latStep);
    const minX = Math.floor(bbox.minLng / lngStep);
    const maxX = Math.ceil(bbox.maxLng / lngStep);
    const total = Math.max(0, (maxY - minY) * (maxX - minX));
    const stride = total > 900 ? Math.ceil(Math.sqrt(total / 900)) : 1;
    const features = [];
    for (let y = minY; y < maxY; y += stride) {
      for (let x = minX; x < maxX; x += stride) {
        const bounds = {
          minLat: y * latStep,
          maxLat: (y + stride) * latStep,
          minLng: x * lngStep,
          maxLng: (x + stride) * lngStep,
          centerLat: (y + stride / 2) * latStep,
          centerLng: (x + stride / 2) * lngStep
        };
        if (!geometryContainsPoint(feature && feature.geometry, bounds.centerLng, bounds.centerLat)) continue;
        const key = y + ':' + x;
        let visitedNearby = false;
        localCoverageCellMap.forEach(function (visited) {
          if (visitedNearby) return;
          const dLatM = Math.abs(visited.centerLat - bounds.centerLat) * 111320;
          const dLngM = Math.abs(visited.centerLng - bounds.centerLng) * Math.max(1, 111320 * Math.cos(bounds.centerLat * Math.PI / 180));
          visitedNearby = Math.sqrt(dLatM * dLatM + dLngM * dLngM) <= LOCAL_COVERAGE_CELL_M * 1.6;
        });
        if (visitedNearby) continue;
        features.push({ type: 'Feature', properties: { key: key }, geometry: cellPolygon(bounds) });
      }
    }
    return { type: 'FeatureCollection', features: features };
  }
  function setGuideCoverageSource(id, data) {
    if (!coverageMap || !coverageMap.getSource(id)) return;
    coverageMap.getSource(id).setData(data || emptyFeatureCollection());
  }
  function updateCoverageMarker() {
    if (!coverageMap || !window.maplibregl || !Number.isFinite(lastKnownPosition.lng) || !Number.isFinite(lastKnownPosition.lat)) return;
    if (!coverageMapMarker) {
      const el = document.createElement('div');
      el.className = 'guide-coverage-marker';
      coverageMapMarker = new window.maplibregl.Marker({ element: el }).setLngLat([lastKnownPosition.lng, lastKnownPosition.lat]).addTo(coverageMap);
    } else {
      coverageMapMarker.setLngLat([lastKnownPosition.lng, lastKnownPosition.lat]);
    }
  }
  function updateCoverageMap() {
    const field = latestCoverageFields[0] || null;
    const feature = coverageFieldFeature(field);
    if (!coverageMapWrap) return;
    coverageMapWrap.hidden = !feature;
    if (!feature) return;
    ensureCoverageMap();
    if (!coverageMapReady || !coverageMap) return;
    setGuideCoverageSource('guide-coverage-area', { type: 'FeatureCollection', features: [feature] });
    setGuideCoverageSource('guide-coverage-missing', targetCellFeatures(field, feature));
    setGuideCoverageSource('guide-coverage-visited', visitedCellFeatures());
    updateCoverageMarker();
    if (field && field.fieldId !== coverageMapLastFieldId) {
      coverageMapLastFieldId = field.fieldId;
      const bbox = fieldBbox(field, feature);
      if (bbox && window.maplibregl) {
        coverageMap.fitBounds([[bbox.minLng, bbox.minLat], [bbox.maxLng, bbox.maxLat]], { padding: 22, duration: 400, maxZoom: 19 });
      }
    }
  }
  function addCoverageMapLayers() {
    if (!coverageMap || coverageMap.getSource('guide-coverage-area')) return;
    coverageMap.addSource('guide-coverage-area', { type: 'geojson', data: emptyFeatureCollection() });
    coverageMap.addSource('guide-coverage-missing', { type: 'geojson', data: emptyFeatureCollection() });
    coverageMap.addSource('guide-coverage-visited', { type: 'geojson', data: emptyFeatureCollection() });
    coverageMap.addLayer({ id: 'guide-coverage-area-fill', type: 'fill', source: 'guide-coverage-area', paint: { 'fill-color': '#10b981', 'fill-opacity': 0.10 } });
    coverageMap.addLayer({ id: 'guide-coverage-area-line', type: 'line', source: 'guide-coverage-area', paint: { 'line-color': '#047857', 'line-width': 2 } });
    coverageMap.addLayer({ id: 'guide-coverage-missing-fill', type: 'fill', source: 'guide-coverage-missing', paint: { 'fill-color': '#f97316', 'fill-opacity': 0.18 } });
    coverageMap.addLayer({ id: 'guide-coverage-missing-line', type: 'line', source: 'guide-coverage-missing', paint: { 'line-color': '#fb923c', 'line-width': 0.5, 'line-opacity': 0.65 } });
    coverageMap.addLayer({ id: 'guide-coverage-visited-fill', type: 'fill', source: 'guide-coverage-visited', paint: { 'fill-color': '#059669', 'fill-opacity': 0.58 } });
    coverageMap.addLayer({ id: 'guide-coverage-visited-line', type: 'line', source: 'guide-coverage-visited', paint: { 'line-color': '#ecfdf5', 'line-width': 0.7, 'line-opacity': 0.85 } });
  }
  function guideMapStyle() {
    return {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors'
        }
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
    };
  }
  function ensureCoverageMap() {
    if (coverageMap || coverageMapLoading || !coverageMapCanvas) return;
    coverageMapLoading = true;
    loadCoverageMapLibre(function () {
      coverageMapLoading = false;
      if (!window.maplibregl || !coverageMapCanvas) return;
      coverageMap = new window.maplibregl.Map({
        container: coverageMapCanvas,
        style: guideMapStyle(),
        center: [lastKnownPosition.lng || 139.76, lastKnownPosition.lat || 35.68],
        zoom: 17,
        attributionControl: false,
        interactive: false
      });
      coverageMap.on('load', function () {
        coverageMapReady = true;
        addCoverageMapLayers();
        updateCoverageMap();
      });
    });
  }
  function loadCoverageMapLibre(callback) {
    if (window.maplibregl) { callback(); return; }
    if (!document.querySelector('link[data-guide-maplibre="1"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css';
      link.setAttribute('data-guide-maplibre', '1');
      document.head.appendChild(link);
    }
    const existing = document.querySelector('script[data-guide-maplibre="1"]');
    if (existing) {
      existing.addEventListener('load', callback, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js';
    script.defer = true;
    script.setAttribute('data-guide-maplibre', '1');
    script.onload = callback;
    document.head.appendChild(script);
  }
  function updateCoverageUi() {
    if (!coveragePanel) return;
    const cc = coverageCopy();
    coveragePanel.hidden = false;
    if (coverageTitle) coverageTitle.textContent = cc.title;
    if (coverageTimeLabel) coverageTimeLabel.textContent = cc.timeLabel;
    if (coverageDistanceLabel) coverageDistanceLabel.textContent = cc.distanceLabel;
    if (coverageCellsLabel) coverageCellsLabel.textContent = cc.cellsLabel;
    if (coverageAiLabel) coverageAiLabel.textContent = cc.aiLabel;
    const field = latestCoverageFields[0] || null;
    const areaName = field && field.name ? String(field.name) : (running ? cc.areaUnknown : cc.outsideArea);
    const coveredAreaM2 = localCoverageCells.size * LOCAL_COVERAGE_CELL_M * LOCAL_COVERAGE_CELL_M;
    const areaM2 = field && Number.isFinite(Number(field.areaM2)) ? Number(field.areaM2) : null;
    const pct = areaM2 && areaM2 > 0 ? Math.min(100, Math.round((coveredAreaM2 / areaM2) * 100)) : null;
    if (coverageArea) coverageArea.textContent = pct == null ? areaName : areaName + ' · 約' + pct + '%';
    if (coverageAbsence) {
      coverageAbsence.textContent = latestAbsenceState === 'absence_candidate'
        ? cc.candidate
        : latestAbsenceState === 'searched_not_found'
          ? cc.searched
          : cc.nonDetection;
      coverageAbsence.dataset.state = latestAbsenceState;
    }
    if (coverageTime) coverageTime.textContent = sessionStartedAt ? formatDuration(Date.now() - sessionStartedAt) : '0:00';
    if (coverageDistance) coverageDistance.textContent = formatMeters(sessionDistanceM);
    if (coverageCells) coverageCells.textContent = String(localCoverageCells.size);
    if (coverageAi) coverageAi.textContent = String(readyScenes.size + pendingScenes.size);
    if (coverageHint) {
      const hints = latestCoverageHints.length ? latestCoverageHints.slice(0, 2) : coverageWeakAxes();
      const weakGps = localCoverageWeakCells.size > 0 ? cc.weakGps : '';
      coverageHint.textContent = [hints.length ? cc.thinPrefix + hints.join(' / ') : cc.defaultHint, weakGps].filter(Boolean).join(' ');
    }
    updateCoverageMap();
  }
  function isOnlineNow() {
    return typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
  }
  function newQueueId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function mirrorAppOutboxItem(item, status) {
    if (!(window.ikimonAppOutbox && typeof window.ikimonAppOutbox.enqueue === 'function')) return;
    window.ikimonAppOutbox.enqueue({
      id: 'guide:' + item.id,
      source: 'guide',
      kind: item.type || 'item',
      sourceId: item.id,
      status: status || 'queued',
      attempts: item.attempts || 0,
      payloadMeta: {
        sessionId: item.sessionId || null,
        lang: item.lang || null,
        guideMode: item.guideMode || null,
        capturedAt: item.capturedAt || item.recordedAt || null,
        lastError: item.lastError || null
      }
    }).catch(() => undefined);
  }
  function removeAppOutboxItem(id) {
    if (!(window.ikimonAppOutbox && typeof window.ikimonAppOutbox.delete === 'function')) return;
    window.ikimonAppOutbox.delete('guide:' + id).catch(() => undefined);
  }
  function updateOfflineUi() {
    const online = isOnlineNow();
    let label = online ? copy.offlineOnline : copy.offlineOffline;
    if (offlineSyncing) label = copy.offlineSyncing;
    else if (offlineFailed) label = copy.offlineFailed;
    else if (online && offlineQueuedCount === 0 && offlineLastSynced) label = copy.offlineSynced;
    if (offlineState) offlineState.textContent = label;
    if (offlineRow) offlineRow.dataset.state = offlineFailed ? 'failed' : offlineSyncing ? 'syncing' : online ? 'online' : 'offline';
    if (offlineQueued) {
      offlineQueued.hidden = offlineQueuedCount <= 0;
      offlineQueued.textContent = formatCopy(copy.offlineQueued, { count: offlineQueuedCount });
    }
    if (offlinePressure) {
      offlinePressure.hidden = !storagePressureActive;
      offlinePressure.textContent = copy.storagePressure;
    }
    if (summaryQueued) summaryQueued.textContent = String(offlineQueuedCount);
    if (sessionSummary && !sessionSummary.hidden) showSessionSummary();
  }
  function openOfflineDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('indexeddb_unavailable'));
        return;
      }
      const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
          const store = db.createObjectStore(OFFLINE_STORE, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('indexeddb_open_failed'));
    });
  }
  function readAllOfflineItems() {
    return new Promise((resolve, reject) => {
      openOfflineDb().then((db) => {
        const tx = db.transaction(OFFLINE_STORE, 'readonly');
        const request = tx.objectStore(OFFLINE_STORE).getAll();
        request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
        request.onerror = () => reject(request.error || new Error('offline_queue_read_failed'));
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error || new Error('offline_queue_tx_failed'));
        };
      }).catch(reject);
    });
  }
  function putOfflineItem(item) {
    return new Promise((resolve, reject) => {
      openOfflineDb().then((db) => {
        const tx = db.transaction(OFFLINE_STORE, 'readwrite');
        tx.objectStore(OFFLINE_STORE).put(item);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error || new Error('offline_queue_put_failed'));
        };
      }).catch(reject);
    });
  }
  function deleteOfflineItem(id) {
    return new Promise((resolve, reject) => {
      openOfflineDb().then((db) => {
        const tx = db.transaction(OFFLINE_STORE, 'readwrite');
        tx.objectStore(OFFLINE_STORE).delete(id);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error || new Error('offline_queue_delete_failed'));
        };
      }).catch(reject);
    });
  }
  function estimateOfflineItemBytes(item) {
    const frameBytes = Array.isArray(item.frames)
      ? item.frames.reduce((sum, frame) => sum + ((frame.frameBlob && frame.frameBlob.size) || 0) + (typeof frame.frameThumb === 'string' ? frame.frameThumb.length * 2 : 0), 0)
      : 0;
    return Number(item.byteSize || 0)
      || ((item.frameBlob && item.frameBlob.size) || 0)
      + frameBytes
      + ((item.audioBlob && item.audioBlob.size) || 0)
      + (typeof item.frameThumb === 'string' ? item.frameThumb.length * 2 : 0)
      + JSON.stringify({ type: item.type, id: item.id, meta: item.meta || null }).length;
  }
  async function enforceOfflineQueueLimits() {
    const items = await readAllOfflineItems();
    items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const scenes = items.filter((item) => item.type === 'scene');
    const audios = items.filter((item) => item.type === 'audio');
    let bytes = items.reduce((sum, item) => sum + estimateOfflineItemBytes(item), 0);
    const deleteIds = [];
    while (scenes.length > OFFLINE_MAX_SCENES) {
      const item = scenes.shift();
      if (item) {
        deleteIds.push(item.id);
        bytes -= estimateOfflineItemBytes(item);
      }
    }
    while (audios.length > OFFLINE_MAX_AUDIO) {
      const item = audios.shift();
      if (item) {
        deleteIds.push(item.id);
        bytes -= estimateOfflineItemBytes(item);
      }
    }
    while (bytes > OFFLINE_MAX_BYTES && scenes.length > 1) {
      const item = scenes.shift();
      if (item) {
        deleteIds.push(item.id);
        bytes -= estimateOfflineItemBytes(item);
      }
    }
    while (bytes > OFFLINE_MAX_BYTES && audios.length > 300) {
      const item = audios.shift();
      if (item) {
        deleteIds.push(item.id);
        bytes -= estimateOfflineItemBytes(item);
      }
    }
    for (const id of deleteIds) await deleteOfflineItem(id);
    return deleteIds.length > 0 || bytes > OFFLINE_MAX_BYTES * 0.85;
  }
  async function refreshQueueStatus() {
    try {
      const items = await readAllOfflineItems();
      offlineQueuedCount = items.length;
      storagePressureActive = items.reduce((sum, item) => sum + estimateOfflineItemBytes(item), 0) > OFFLINE_MAX_BYTES * 0.85;
    } catch {
      offlineQueuedCount = 0;
    }
    updateOfflineUi();
  }
  async function enqueueOfflineItem(item) {
    try {
      item.createdAt = item.createdAt || Date.now();
      item.attempts = Number(item.attempts || 0);
      item.byteSize = estimateOfflineItemBytes(item);
      await putOfflineItem(item);
      mirrorAppOutboxItem(item, 'queued');
      storagePressureActive = await enforceOfflineQueueLimits();
      offlineFailed = false;
      offlineLastSynced = false;
      await refreshQueueStatus();
      return true;
    } catch (error) {
      offlineFailed = true;
      console.error('Guide offline queue error', error);
      updateOfflineUi();
      return false;
    }
  }
  async function markOfflineItemError(item, error) {
    item.attempts = Number(item.attempts || 0) + 1;
    item.lastError = error instanceof Error ? error.message : String(error || 'sync_failed');
    item.updatedAt = Date.now();
    await putOfflineItem(item).catch(() => undefined);
    mirrorAppOutboxItem(item, 'error');
  }
  function pickAudioMimeType() {
    if (!window.MediaRecorder || typeof window.MediaRecorder.isTypeSupported !== 'function') return null;
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    for (const mime of candidates) {
      if (window.MediaRecorder.isTypeSupported(mime)) return mime;
    }
    return null;
  }
  async function requestEnvironmentCamera() {
    const attempts = [
      { video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: true, audio: false }
    ];
    let lastError = null;
    for (const constraints of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        lastError = error;
        const name = error && error.name ? String(error.name) : '';
        if (name !== 'OverconstrainedError' && name !== 'NotFoundError') break;
      }
    }
    throw lastError || new Error('camera_unavailable');
  }
  function normalizePosition(p, source) {
    return {
      lat: p.coords.latitude,
      lng: p.coords.longitude,
      accuracyM: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null,
      speedMps: Number.isFinite(p.coords.speed) ? p.coords.speed : null,
      headingDegrees: Number.isFinite(p.coords.heading) ? p.coords.heading : null,
      positionCapturedAt: new Date(p.timestamp || Date.now()).toISOString(),
      stale: false,
      source: source || 'watchPosition'
    };
  }
  function distanceMeters(a, b) {
    if (!a || !b) return 0;
    const toRad = (value) => value * Math.PI / 180;
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  }
  function rememberPosition(position) {
    const accuracy = Number(position.accuracyM);
    if (Number.isFinite(accuracy) && accuracy > 200) {
      lastKnownPosition = { ...position, stale: true };
      return lastKnownPosition;
    }
    if (lastRoutePosition) {
      const delta = distanceMeters(lastRoutePosition, position);
      if (delta >= 3 && delta <= 500) sessionDistanceM += delta;
    }
    lastRoutePosition = position;
    lastKnownPosition = position;
    rememberCoveragePosition(position);
    return position;
  }
  function startLocationWatch() {
    if (!navigator.geolocation || locationWatchId !== null) return;
    locationWatchId = navigator.geolocation.watchPosition(
      (p) => { rememberPosition(normalizePosition(p, 'watchPosition')); },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 }
    );
  }
  function stopLocationWatch() {
    if (navigator.geolocation && locationWatchId !== null) navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
    lastRoutePosition = null;
  }
  async function getLocation() {
    const capturedAt = Date.parse(lastKnownPosition.positionCapturedAt || '');
    if (Number.isFinite(capturedAt) && Date.now() - capturedAt <= 10000 && !lastKnownPosition.stale) return lastKnownPosition;
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(lastKnownPosition);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve(rememberPosition(normalizePosition(p, 'getCurrentPosition'))),
        () => resolve({ ...lastKnownPosition, stale: true }),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 6000 }
      );
    });
  }
  function captureFrame() {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
  }
  function captureFrameBlob() {
    return new Promise((resolve, reject) => {
      const sourceWidth = video.videoWidth || 640;
      const sourceHeight = video.videoHeight || 480;
      const ratio = Math.min(960 / Math.max(1, sourceWidth), 720 / Math.max(1, sourceHeight), 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sourceWidth * ratio));
      canvas.height = Math.max(1, Math.round(sourceHeight * ratio));
      try {
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch (error) {
        reject(error);
        return;
      }
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('frame_blob_failed'));
      }, 'image/jpeg', 0.68);
    });
  }
  function captureFrameThumb() {
    const canvas = document.createElement('canvas');
    canvas.width = 144;
    canvas.height = 108;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.46);
  }
  function summarizeFacePrivacy(result) {
    return window.ikimonFacePrivacy && typeof window.ikimonFacePrivacy.summarizeFacePrivacy === 'function'
      ? window.ikimonFacePrivacy.summarizeFacePrivacy(result)
      : { detector: 'none', status: 'unavailable', faceCount: 0, error: 'face_privacy_unavailable' };
  }
  async function redactGuideCanvas(canvas) {
    const result = window.ikimonFacePrivacy && typeof window.ikimonFacePrivacy.redactCanvasFaces === 'function'
      ? await window.ikimonFacePrivacy.redactCanvasFaces(canvas, { blocksPerFace: 10 })
      : { available: false, redacted: false, faceCount: 0, error: 'face_privacy_unavailable' };
    return summarizeFacePrivacy(result);
  }
  function canvasToBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('frame_blob_failed'));
      }, 'image/jpeg', quality);
    });
  }
  function frameThumbFromCanvas(sourceCanvas) {
    const canvas = document.createElement('canvas');
    canvas.width = 144;
    canvas.height = 108;
    canvas.getContext('2d').drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.46);
  }
  async function captureFramePayload() {
    const sourceWidth = video.videoWidth || 640;
    const sourceHeight = video.videoHeight || 480;
    const ratio = Math.min(960 / Math.max(1, sourceWidth), 720 / Math.max(1, sourceHeight), 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * ratio));
    canvas.height = Math.max(1, Math.round(sourceHeight * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('frame_canvas_unavailable');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const facePrivacy = await redactGuideCanvas(canvas);
    return {
      frameBlob: await canvasToBlob(canvas, 0.68),
      frameThumb: frameThumbFromCanvas(canvas),
      facePrivacy
    };
  }
  function captureVisualMetrics() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 24;
    const context = canvas.getContext('2d');
    if (!context || !video || !video.videoWidth) return { brightness: 0, blurScore: 0, diffScore: 1 };
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let brightness = 0;
    let edge = 0;
    let diff = 0;
    const grays = [];
    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
      grays.push(gray);
      brightness += gray;
      const prev = lastVisualMetrics && lastVisualMetrics.grays ? lastVisualMetrics.grays[grays.length - 1] : null;
      if (typeof prev === 'number') diff += Math.abs(gray - prev);
    }
    for (let y = 1; y < canvas.height; y += 1) {
      for (let x = 1; x < canvas.width; x += 1) {
        const index = y * canvas.width + x;
        edge += Math.abs(grays[index] - grays[index - 1]) + Math.abs(grays[index] - grays[index - canvas.width]);
      }
    }
    const count = Math.max(1, grays.length);
    const metrics = {
      brightness: brightness / count,
      blurScore: edge / count,
      diffScore: lastVisualMetrics && lastVisualMetrics.grays ? diff / count : 1,
      grays
    };
    lastVisualMetrics = metrics;
    return metrics;
  }
  function headingDelta(a, b) {
    if (!Number.isFinite(Number(a)) || !Number.isFinite(Number(b))) return null;
    const diff = Math.abs(Number(a) - Number(b)) % 360;
    return diff > 180 ? 360 - diff : diff;
  }
  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl || '').split(',');
    const meta = parts[0] || '';
    const raw = atob(parts[1] || '');
    const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  function blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.readAsDataURL(blob);
    });
  }
  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('image_load_failed'));
      };
      image.src = url;
    });
  }
  function isWebmMime(mimeType) {
    return String(mimeType || '').toLowerCase().includes('webm');
  }
  function hasWebmEbmlHeader(bytes) {
    return bytes && bytes.length >= 4
      && bytes[0] === 0x1a
      && bytes[1] === 0x45
      && bytes[2] === 0xdf
      && bytes[3] === 0xa3;
  }
  function buildAudioQualityMeta(blob, chunkMeta) {
    const durationMs = Math.round(Number(chunkMeta && chunkMeta.durationMs) || AUDIO_CHUNK_TARGET_MS);
    return {
      gateVersion: AUDIO_QUALITY_GATE_VERSION,
      targetDurationMs: AUDIO_CHUNK_TARGET_MS,
      measuredDurationMs: durationMs,
      blobBytes: blob.size,
      mimeType: blob.type || preferredMime || null,
      acceptedAt: new Date().toISOString()
    };
  }
  async function validateAudioChunkQuality(blob, chunkMeta) {
    if (!blob || !blob.size) return { ok: false, reason: 'empty_blob' };
    if (!preferredMime) return { ok: false, reason: 'unsupported_mime' };
    if (blob.size < AUDIO_CHUNK_MIN_BYTES) return { ok: false, reason: 'too_small' };

    const durationMs = Number(chunkMeta && chunkMeta.durationMs);
    if (Number.isFinite(durationMs) && durationMs > 0) {
      if (durationMs < AUDIO_CHUNK_MIN_MS) return { ok: false, reason: 'too_short' };
      if (durationMs > AUDIO_CHUNK_MAX_MS) return { ok: false, reason: 'too_long' };
    }

    const mimeType = blob.type || preferredMime || '';
    if (isWebmMime(mimeType)) {
      let header;
      try {
        header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
      } catch {
        return { ok: false, reason: 'unreadable_blob' };
      }
      if (!hasWebmEbmlHeader(header)) return { ok: false, reason: 'webm_header_missing' };
    }

    return { ok: true, quality: buildAudioQualityMeta(blob, chunkMeta) };
  }
  function drawImageData(image, maxWidth, maxHeight, quality) {
    const canvas = drawImageCanvas(image, maxWidth, maxHeight);
    return canvas.toDataURL('image/jpeg', quality);
  }
  function drawImageCanvas(image, maxWidth, maxHeight) {
    const ratio = Math.min(maxWidth / Math.max(1, image.naturalWidth), maxHeight / Math.max(1, image.naturalHeight), 1);
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(image, 0, 0, width, height);
    return canvas;
  }
  async function buildGuideFramesFromFile(file) {
    const image = await loadImageFromFile(file);
    const canvas = drawImageCanvas(image, 1280, 1280);
    const facePrivacy = await redactGuideCanvas(canvas);
    const frameDataUrl = canvas.toDataURL('image/jpeg', 0.78);
    return {
      frame: frameDataUrl.split(',')[1],
      frameBlob: dataUrlToBlob(frameDataUrl),
      frameThumb: frameThumbFromCanvas(canvas),
      facePrivacy
    };
  }
  function captureAudioBlobForScene() {
    const chunks = sceneAudioChunks.splice(0);
    if (!chunks.length) return null;
    return new Blob(chunks, { type: preferredMime || 'audio/webm' });
  }
  async function captureAudioForScene() {
    const audioBlob = captureAudioBlobForScene();
    if (!audioBlob) return null;
    return blobToBase64(audioBlob);
  }
  async function playAudio(base64Pcm) {
    try {
      const ctx = new AudioContext({ sampleRate: 24000 });
      const raw = atob(base64Pcm);
      const buf = new Int16Array(raw.length / 2);
      for (let i = 0; i < buf.length; i++) buf[i] = (raw.charCodeAt(i * 2)) | (raw.charCodeAt(i * 2 + 1) << 8);
      const audioBuf = ctx.createBuffer(1, buf.length, 24000);
      const ch = audioBuf.getChannelData(0);
      for (let i = 0; i < buf.length; i++) ch[i] = buf[i] / 32768;
      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      src.connect(ctx.destination);
      src.start();
      setStatus(copy.playing);
      src.onended = () => { setStatus(''); ctx.close(); };
    } catch (e) {
      console.error('TTS playback error', e);
    }
  }
  function updateTrailPill() {
    if (!trailPill) return;
    const pendingCount = pendingScenes.size;
    if (pendingCount > 0) {
      trailPill.hidden = false;
      trailPill.textContent = copy.trailPending + ' ' + pendingCount;
    } else {
      trailPill.hidden = true;
      trailPill.textContent = '';
    }
  }
  function addPendingDiscovery(scene) {
    if (noRec) noRec.remove();
    const existing = document.getElementById('scene-' + scene.sceneId);
    const li = existing || document.createElement('li');
    li.className = 'guide-discovery-item guide-discovery-pending';
    li.id = 'scene-' + scene.sceneId;
    li.innerHTML = '<div class="gdi-thumb-wrap">' + (scene.frameThumb ? '<img class="gdi-thumb" src="' + escapeInline(scene.frameThumb) + '" alt="">' : '<span class="gdi-icon">📍</span>') + '</div>'
      + '<div class="gdi-body"><div class="gdi-kicker">' + escapeInline(copy.trailPending) + '</div>'
      + '<div class="gdi-summary">' + escapeInline(formatCaptured(scene.capturedAt)) + '</div></div>';
    if (!existing) listEl.prepend(li);
    updateTrailPill();
  }
  function addQueuedDiscovery(scene) {
    if (noRec) noRec.remove();
    const existing = document.getElementById('scene-' + scene.sceneId);
    const li = existing || document.createElement('li');
    li.className = 'guide-discovery-item guide-discovery-pending guide-discovery-offline';
    li.id = 'scene-' + scene.sceneId;
    li.innerHTML = '<div class="gdi-thumb-wrap">' + (scene.frameThumb ? '<img class="gdi-thumb" src="' + escapeInline(scene.frameThumb) + '" alt="">' : '<span class="gdi-icon">📍</span>') + '</div>'
      + '<div class="gdi-body"><div class="gdi-kicker">' + escapeInline(copy.offlineSceneQueued) + '</div>'
      + '<div class="gdi-autosave is-pending"><span>' + escapeInline(formatCopy(copy.offlineQueued, { count: offlineQueuedCount || 1 })) + '</span></div>'
      + '<div class="gdi-summary">' + escapeInline(formatCaptured(scene.capturedAt)) + '</div></div>';
    if (!existing) listEl.prepend(li);
    setNextAction(representative.nextLookTarget || copy.nowNextFallback);
    updateTrailPill();
  }
  function formatCaptured(value) {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  function formatDistance(value) {
    if (typeof value !== 'number') return '';
    const lang = getLang();
    if (lang === 'ja') return ' · 現在地から' + value + 'm';
    return ' · ' + value + 'm from current';
  }
  function retryHintForAutoSave(scene) {
    const autoSave = scene && scene.autoSave ? scene.autoSave : null;
    const codes = autoSave && Array.isArray(autoSave.reasonCodes) ? autoSave.reasonCodes : [];
    const ja = getLang() === 'ja';
    if (codes.indexOf('duplicate_scene') >= 0) {
      return ja ? '少し移動して、別の角度か別の足元を入れると記録になります。' : 'Move a little and add another angle or a different ground patch.';
    }
    if (codes.indexOf('privacy_or_indoor_scene') >= 0) {
      return ja ? '人物や室内を外し、葉・水辺・地面など野外の手がかりへ向けてください。' : 'Point away from people or indoor scenes and toward leaves, water edges, or ground clues.';
    }
    if (codes.indexOf('no_field_nature_signal') >= 0 || codes.indexOf('vehicle_structure_only_scene') >= 0) {
      return ja ? '人工物だけでなく、近くの草・土・水辺・樹木を1つ画面に足してください。' : 'Add one nearby plant, soil, water edge, or tree instead of only structures.';
    }
    if (autoSave && (autoSave.state === 'skipped' || autoSave.state === 'error')) {
      return ja ? '次は近い特徴と周辺環境を分けて、1つずつ残してください。' : 'Next, capture a close feature and the surrounding context separately.';
    }
    return '';
  }
  function autoSaveView(scene) {
    const state = scene && scene.autoSave ? scene.autoSave.state : '';
    const note = getLang() === 'ja' && scene && scene.autoSave ? (scene.autoSave.note || '') : '';
    if (state === 'saved') return { cls: 'is-saved', text: copy.autoSaved, note: note || (getLang() === 'ja' ? copy.autoSaveBadge : ''), retry: '', showManual: false };
    if (state === 'skipped') return { cls: 'is-skipped', text: copy.autoSkipped, note: note, retry: retryHintForAutoSave(scene), showManual: true };
    if (state === 'error') return { cls: 'is-error', text: copy.autoSaveError, note: '', retry: retryHintForAutoSave(scene), showManual: true };
    return { cls: 'is-pending', text: copy.autoSaveBadge, note: '', retry: '', showManual: true };
  }
  function normalizeTrailToken(value) {
    return String(value || '').replace(/\\s+/g, '').replace(/[()]/g, function(ch){ return ch === '(' ? '（' : '）'; });
  }
  function trailFeatureTokens(scene) {
    const tokens = [];
    (Array.isArray(scene.detectedSpecies) ? scene.detectedSpecies : []).forEach(function(name){ tokens.push(normalizeTrailToken(name)); });
    (Array.isArray(scene.detectedFeatures) ? scene.detectedFeatures : [])
      .filter(function(feature){ return ['species','vegetation','landform'].indexOf(String(feature.type || '')) >= 0; })
      .forEach(function(feature){ tokens.push(normalizeTrailToken(feature.name)); });
    return Array.from(new Set(tokens.filter(Boolean))).slice(0, 6);
  }
  function trailSceneScore(scene) {
    const species = Array.isArray(scene.detectedSpecies) ? scene.detectedSpecies.length : 0;
    const features = Array.isArray(scene.detectedFeatures) ? scene.detectedFeatures.length : 0;
    return species * 2 + features + (scene.environmentContext ? 2 : 0) + (scene.summary ? 1 : 0);
  }
  function trailBundleKey(scene) {
    const ms = Date.parse(scene.capturedAt || scene.returnedAt || new Date().toISOString());
    const bucket = Math.floor((Number.isFinite(ms) ? ms : Date.now()) / 30000);
    const token = trailFeatureTokens(scene)[0] || 'place';
    return bucket + '-' + token;
  }
  function upsertTrailBundle(scene) {
    const key = trailBundleKey(scene);
    const existing = trailBundles.get(key) || { key: key, scenes: [], representative: scene };
    if (!existing.scenes.some(function(item){ return item.sceneId === scene.sceneId; })) existing.scenes.push(scene);
    if (trailSceneScore(scene) >= trailSceneScore(existing.representative || scene)) existing.representative = scene;
    existing.startAt = existing.scenes.reduce(function(min, item){
      const ms = Date.parse(item.capturedAt || item.returnedAt || '');
      return Number.isFinite(ms) ? Math.min(min, ms) : min;
    }, Date.parse(existing.scenes[0].capturedAt || existing.scenes[0].returnedAt || new Date().toISOString()));
    existing.endAt = existing.scenes.reduce(function(max, item){
      const ms = Date.parse(item.capturedAt || item.returnedAt || '');
      return Number.isFinite(ms) ? Math.max(max, ms) : max;
    }, existing.startAt);
    trailBundles.set(key, existing);
    return existing;
  }
  function trailBundleBadge(bundle) {
    if (!bundle || bundle.scenes.length <= 1) return '';
    if (getLang() === 'ja') return '代表 ' + bundle.scenes.length + '件';
    return bundle.scenes.length + ' scenes';
  }
  function applyReadySceneToCoverage(scene) {
    if (!scene || !scene.sceneId || coverageSceneIds.has(scene.sceneId)) return;
    coverageSceneIds.add(scene.sceneId);
    (Array.isArray(scene.detectedFeatures) ? scene.detectedFeatures : []).forEach(function (feature) {
      if (feature && coverageFeatureTypes[String(feature.type)] != null) coverageFeatureTypes[String(feature.type)] += 1;
    });
    if (Array.isArray(scene.coverageHints) && scene.coverageHints.length) {
      latestCoverageHints = scene.coverageHints.slice(0, 4);
    }
    if (scene.absenceBoundary && typeof scene.absenceBoundary.state === 'string') {
      latestAbsenceState = scene.absenceBoundary.state === 'confirmed_absence' ? 'absence_candidate' : scene.absenceBoundary.state;
    }
    updateCoverageUi();
  }
  function renderReadyDiscovery(scene) {
    readyScenes.set(scene.sceneId, scene);
    applyReadySceneToCoverage(scene);
    const bundle = upsertTrailBundle(scene);
    const representative = bundle.representative || scene;
    const bundleId = 'scene-bundle-' + bundle.key;
    const pending = document.getElementById('scene-' + scene.sceneId);
    const existing = document.getElementById(bundleId) || pending;
    if (pending && pending !== existing) pending.remove();
    const li = existing || document.createElement('li');
    li.className = 'guide-discovery-item';
    li.id = bundleId;
    const species = Array.isArray(representative.detectedSpecies) ? representative.detectedSpecies : [];
    const distance = formatDistance(representative.distanceFromCurrentM);
    const autoSave = autoSaveView(representative);
    const badge = trailBundleBadge(bundle);
    li.innerHTML = '<div class="gdi-thumb-wrap">' + (representative.frameThumb ? '<img class="gdi-thumb" src="' + escapeInline(representative.frameThumb) + '" alt="">' : '<span class="gdi-icon">📍</span>') + '</div>'
      + '<div class="gdi-body">'
      + '<div class="gdi-kicker">' + escapeInline(formatCaptured(new Date(bundle.startAt).toISOString()) + distance) + (badge ? '<span class="gdi-bundle">' + escapeInline(badge) + '</span>' : '') + '</div>'
      + '<div class="gdi-autosave ' + escapeInline(autoSave.cls) + '"><span>' + escapeInline(autoSave.text) + '</span>' + (autoSave.note ? '<em>' + escapeInline(autoSave.note) + '</em>' : '') + '</div>'
      + (autoSave.retry ? '<div class="gdi-retry">' + escapeInline(autoSave.retry) + '</div>' : '')
      + '<div class="gdi-summary">' + escapeInline(representative.delayedSummary || representative.summary || '') + '</div>'
      + (species.length ? '<div class="gdi-species">' + species.map(escapeInline).join(' · ') + '</div>' : '')
      + (representative.uncertaintyReason ? '<div class="gdi-note">' + escapeInline(representative.uncertaintyReason) + '</div>' : '')
      + '<div class="gdi-why">' + escapeInline(representative.whyInteresting || '') + '</div>'
      + '<div class="gdi-next">' + escapeInline(representative.nextLookTarget || '') + '</div>'
      + (representative.deliveryState === 'deferred' ? '<div class="gdi-deferred">' + escapeInline(copy.trailDeferred) + '</div>' : '')
      + '<div class="gdi-actions"><button type="button" class="gdi-play" data-scene-id="' + escapeInline(representative.sceneId) + '">' + escapeInline(copy.playTrail) + '</button>'
      + (autoSave.showManual ? '<button type="button" class="gdi-save" data-scene-id="' + escapeInline(representative.sceneId) + '">' + escapeInline(copy.manualSave) + '</button>' : '')
      + '</div>'
      + '</div>';
    if (!existing) listEl.prepend(li);
    updateTrailPill();
  }
  function startAnalyser() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor || !audioStream || !audioStream.getAudioTracks().length) return;
    audioContext = new AudioCtor();
    const source = audioContext.createMediaStreamSource(audioStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.35;
    source.connect(analyser);
    freqData = new Float32Array(analyser.frequencyBinCount);
    timeData = new Float32Array(analyser.fftSize);
    audioSampleTimer = window.setInterval(sampleAudioFrame, 250);
  }
  function sampleAudioFrame() {
    if (!analyser || !freqData || !timeData) return;
    analyser.getFloatFrequencyData(freqData);
    analyser.getFloatTimeDomainData(timeData);
    analyserFrames.push({ ts: Date.now(), ...summarizeSpectrum(freqData, timeData, audioContext ? audioContext.sampleRate : 24000) });
    if (analyserFrames.length > 160) analyserFrames = analyserFrames.slice(-160);
  }
  function summarizeSpectrum(freqValues, timeValues, sampleRate) {
    const amplitudes = Array.from(freqValues, function (value) {
      return Number.isFinite(value) ? Math.pow(10, value / 20) : 0;
    });
    const total = amplitudes.reduce((sum, value) => sum + value, 0);
    const bandDefs = [
      [0, 250], [250, 500], [500, 1000], [1000, 2000], [2000, 4000], [4000, 8000]
    ];
    if (!total) {
      return { peakHz: 0, centroidHz: 0, rolloffHz: 0, energy: 0, voiceBandRatio: 0, bandEnergies: bandDefs.map(() => 0) };
    }
    let peakIndex = 0;
    let centroidAcc = 0;
    const bandValues = bandDefs.map(() => 0);
    let voiceValue = 0;
    for (let index = 0; index < amplitudes.length; index += 1) {
      const value = amplitudes[index];
      if (value > amplitudes[peakIndex]) peakIndex = index;
      const hz = (index * sampleRate) / (2 * amplitudes.length);
      centroidAcc += hz * value;
      for (let bandIndex = 0; bandIndex < bandDefs.length; bandIndex += 1) {
        const band = bandDefs[bandIndex];
        if (hz >= band[0] && hz < band[1]) bandValues[bandIndex] += value;
      }
      if (hz >= 300 && hz <= 3400) voiceValue += value;
    }
    let cumulative = 0;
    let rolloffHz = 0;
    for (let index = 0; index < amplitudes.length; index += 1) {
      cumulative += amplitudes[index];
      if (cumulative >= total * 0.85) {
        rolloffHz = (index * sampleRate) / (2 * amplitudes.length);
        break;
      }
    }
    let rmsAcc = 0;
    for (let index = 0; index < timeValues.length; index += 1) {
      rmsAcc += timeValues[index] * timeValues[index];
    }
    const bandSum = bandValues.reduce((sum, value) => sum + value, 0) || 1;
    return {
      peakHz: (peakIndex * sampleRate) / (2 * amplitudes.length),
      centroidHz: centroidAcc / total,
      rolloffHz: rolloffHz,
      energy: Math.sqrt(rmsAcc / Math.max(1, timeValues.length)),
      voiceBandRatio: voiceValue / total,
      bandEnergies: bandValues.map((value) => value / bandSum)
    };
  }
  function summarizeFrames() {
    const cutoff = Date.now() - 3200;
    const frames = analyserFrames.filter((frame) => frame.ts >= cutoff);
    if (!frames.length) return null;
    const merged = { peakHz: 0, centroidHz: 0, rolloffHz: 0, energy: 0, voiceBandRatio: 0, bandEnergies: [] };
    for (const frame of frames) {
      merged.peakHz += frame.peakHz || 0;
      merged.centroidHz += frame.centroidHz || 0;
      merged.rolloffHz += frame.rolloffHz || 0;
      merged.energy += frame.energy || 0;
      merged.voiceBandRatio += frame.voiceBandRatio || 0;
      const bands = Array.isArray(frame.bandEnergies) ? frame.bandEnergies : [];
      for (let index = 0; index < bands.length; index += 1) {
        merged.bandEnergies[index] = (merged.bandEnergies[index] || 0) + (bands[index] || 0);
      }
    }
    return {
      version: 'v1',
      frameCount: frames.length,
      peakHz: merged.peakHz / frames.length,
      centroidHz: merged.centroidHz / frames.length,
      rolloffHz: merged.rolloffHz / frames.length,
      energy: merged.energy / frames.length,
      voiceBandRatio: merged.voiceBandRatio / frames.length,
      bandEnergies: merged.bandEnergies.map((value) => value / frames.length)
    };
  }
  function classifySpeech(fingerprint) {
    if (!fingerprint) return { speechLikely: true, confidence: 0.5, reason: 'missing_fingerprint' };
    const bands = Array.isArray(fingerprint.bandEnergies) ? fingerprint.bandEnergies : [];
    const highBandRatio = bands.length ? (bands[bands.length - 1] || 0) : 0;
    let speechScore = 0;
    if ((fingerprint.voiceBandRatio || 0) >= 0.68) speechScore += 0.45;
    if ((fingerprint.centroidHz || 0) >= 250 && (fingerprint.centroidHz || 0) <= 2200) speechScore += 0.2;
    if ((fingerprint.peakHz || 0) >= 90 && (fingerprint.peakHz || 0) <= 1200) speechScore += 0.15;
    if (highBandRatio <= 0.14) speechScore += 0.1;
    if ((fingerprint.energy || 0) >= 0.02) speechScore += 0.1;
    const speechLikely = speechScore >= 0.6;
    return {
      speechLikely: speechLikely,
      confidence: speechLikely ? Math.min(0.95, 0.55 + (speechScore * 0.35)) : Math.max(0.6, 0.82 - (speechScore * 0.25)),
      reason: speechLikely ? 'voice_band_detected' : 'natural_sound_likely',
      voiceBandRatio: fingerprint.voiceBandRatio || 0,
      energy: fingerprint.energy || 0
    };
  }
  function renderAudioBundles(recap) {
    const bundles = Array.isArray(recap && recap.soundBundles) ? recap.soundBundles : [];
    audioList.innerHTML = '';
    if (!bundles.length) {
      const empty = document.createElement('li');
      empty.className = 'guide-no-records';
      empty.id = 'guide-audio-empty';
      empty.textContent = copy.audioEmpty;
      audioList.appendChild(empty);
    } else {
      bundles.forEach(function (bundle) {
        const item = document.createElement('li');
        item.className = 'guide-audio-item';
        const first = bundle.firstRecordedAt ? new Date(bundle.firstRecordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
        const last = bundle.lastRecordedAt ? new Date(bundle.lastRecordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
        const note = bundle.note || copy.audioUnnamed;
        item.innerHTML = '<div class="guide-audio-card">'
          + '<div class="guide-audio-card-head"><strong>' + escapeInline(bundle.label || copy.audioUnnamed) + '</strong><span>' + escapeInline(note) + '</span></div>'
          + '<div class="guide-audio-meta">' + escapeInline(String(bundle.segmentCount || 0)) + ' clips · '
          + escapeInline(Number(bundle.totalDurationSec || 0).toFixed(1)) + ' sec · '
          + escapeInline(first + ' - ' + last) + '</div>'
          + (bundle.representativeAudioUrl ? '<audio class="guide-audio-player" controls preload="none" src="' + escapeInline(bundle.representativeAudioUrl) + '"></audio>' : '')
          + '</div>';
        audioList.appendChild(item);
      });
    }
    const skippedCount = Math.max(Number(recap && recap.privacySkippedCount || 0), clientPrivacySkippedCount);
    if (skippedCount > 0) {
      audioSkip.hidden = false;
      audioSkip.textContent = copy.voiceExcludedNotice + ' (' + skippedCount + ')';
    } else {
      audioSkip.hidden = true;
      audioSkip.textContent = '';
    }
  }
  async function refreshRecap() {
    try {
      const response = await fetch(BASE + '/api/v1/fieldscan/session/' + encodeURIComponent(sessionId) + '/recap');
      const payload = await response.json();
      if (payload && payload.ok && payload.recap) renderAudioBundles(payload.recap);
    } catch (error) {
      console.error('Guide recap error', error);
    }
  }
  function scheduleRecapRefresh() {
    clearTimeout(recapTimer);
    recapTimer = setTimeout(refreshRecap, 600);
  }
  function handleAcceptedScene(sceneRes) {
    if (sceneRes && sceneRes.sceneId) {
      pendingScenes.set(sceneRes.sceneId, sceneRes);
      addPendingDiscovery(sceneRes);
      void watchScene(sceneRes.sceneId);
    }
  }
  async function postScenePayload(payload) {
    const frames = Array.isArray(payload.frames) && payload.frames.length
      ? await Promise.all(payload.frames.map(async function (frame) {
          return {
            frame: await blobToBase64(frame.frameBlob),
            frameMime: frame.frameBlob.type || 'image/jpeg',
            capturedAt: frame.capturedAt,
            lat: frame.lat,
            lng: frame.lng,
            accuracyM: frame.locationAccuracyM,
            speedMps: frame.speedMps,
            headingDegrees: frame.headingDegrees
          };
        }))
      : null;
    const frame = frames ? null : await blobToBase64(payload.frameBlob);
    const audio = payload.audioBlob ? await blobToBase64(payload.audioBlob) : null;
    const audioMimeType = payload.audioBlob ? (payload.audioBlob.type || payload.audioMimeType || preferredMime || null) : null;
    const response = await fetch(BASE + '/api/v1/guide/scene', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientSceneId: payload.clientSceneId,
        frame: frame,
        frames: frames,
        frameBundleSummary: payload.frameBundleSummary || null,
        frameThumb: payload.frameThumb,
        frameThumbs: Array.isArray(payload.frames) ? payload.frames.map(function (item) { return item.frameThumb || null; }) : null,
        facePrivacy: payload.facePrivacy || null,
        visualCandidate: payload.visualCandidate || null,
        audio: audio,
        audioMimeType: audioMimeType,
        lat: payload.lat,
        lng: payload.lng,
        locationAccuracyM: payload.locationAccuracyM,
        speedMps: payload.speedMps,
        headingDegrees: payload.headingDegrees,
        positionCapturedAt: payload.positionCapturedAt,
        sessionDistanceM: payload.sessionDistanceM,
        lang: payload.lang,
        guideMode: payload.guideMode || 'walk',
        sessionId: payload.sessionId,
        capturedAt: payload.capturedAt,
        audioPrivacy: {
          clientSkippedCount: payload.audioPrivacySkippedCount || 0,
          policy: payload.audioPrivacyPolicy || 'exclude_speech_likely_chunks'
        }
      })
    });
    if (!response.ok) throw new Error('scene_submit_failed_' + response.status);
    return response.json();
  }
  async function queueScenePayload(payload, reason) {
    const item = {
      id: payload.clientSceneId,
      type: 'scene',
      clientSceneId: payload.clientSceneId,
      sessionId: payload.sessionId,
      capturedAt: payload.capturedAt,
      lat: payload.lat,
      lng: payload.lng,
      locationAccuracyM: payload.locationAccuracyM,
      speedMps: payload.speedMps,
      headingDegrees: payload.headingDegrees,
      positionCapturedAt: payload.positionCapturedAt,
      sessionDistanceM: payload.sessionDistanceM,
      lang: payload.lang,
      guideMode: payload.guideMode || 'walk',
      frameThumb: payload.frameThumb,
      frameBlob: payload.frameBlob,
      frames: payload.frames || null,
      frameBundleSummary: payload.frameBundleSummary || null,
      visualCandidate: payload.visualCandidate || null,
      facePrivacy: payload.facePrivacy || null,
      audioBlob: payload.audioBlob,
      audioMimeType: payload.audioBlob ? (payload.audioBlob.type || payload.audioMimeType || preferredMime || null) : null,
      audioPrivacySkippedCount: payload.audioPrivacySkippedCount || 0,
      audioPrivacyPolicy: payload.audioPrivacyPolicy || 'exclude_speech_likely_chunks',
      lastError: reason || null,
      createdAt: Date.now()
    };
    const queued = await enqueueOfflineItem(item);
    if (queued) addQueuedDiscovery({ sceneId: payload.clientSceneId, frameThumb: payload.frameThumb, capturedAt: payload.capturedAt });
    return queued;
  }
  async function submitScenePayload(payload) {
    if (!isOnlineNow()) {
      await queueScenePayload(payload, 'offline');
      return null;
    }
    try {
      const sceneRes = await postScenePayload(payload);
      offlineFailed = false;
      return sceneRes;
    } catch (error) {
      await queueScenePayload(payload, error instanceof Error ? error.message : 'scene_submit_failed');
      return null;
    } finally {
      updateOfflineUi();
    }
  }
  function buildTelemetryPoint(position) {
    return {
      clientPointId: newQueueId('guide-tel'),
      sessionId: sessionId,
      guideMode: getGuideMode(),
      observedAt: new Date().toISOString(),
      lat: position.lat,
      lng: position.lng,
      accuracyM: position.accuracyM,
      speedMps: position.speedMps,
      headingDegrees: position.headingDegrees,
      positionCapturedAt: position.positionCapturedAt,
      sessionDistanceM: Math.round(sessionDistanceM),
      cameraActive: Boolean(cameraOptIn && stream),
      visualCandidate: null
    };
  }
  async function postTelemetryPayload(points) {
    const response = await fetch(BASE + '/api/v1/guide/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId,
        guideMode: getGuideMode(),
        points: points
      })
    });
    if (!response.ok) throw new Error('telemetry_submit_failed_' + response.status);
    return response.json();
  }
  async function queueTelemetryPayload(points, reason) {
    if (!Array.isArray(points) || !points.length) return false;
    return enqueueOfflineItem({
      id: newQueueId('guide-telemetry'),
      type: 'telemetry',
      sessionId: sessionId,
      guideMode: getGuideMode(),
      points: points,
      lastError: reason || null,
      createdAt: Date.now()
    });
  }
  function applyTelemetryResponse(payload) {
    if (!payload || typeof payload !== 'object') return;
    if (Array.isArray(payload.fields)) latestCoverageFields = payload.fields;
    if (typeof payload.absenceState === 'string') latestAbsenceState = payload.absenceState;
    updateCoverageUi();
  }
  async function flushTelemetryBuffer(force) {
    if (!telemetryBuffer.length) return;
    const now = Date.now();
    if (!force && telemetryBuffer.length < 4 && now - lastTelemetrySentAt < 4000) return;
    const points = telemetryBuffer.splice(0, 12);
    lastTelemetrySentAt = now;
    if (!isOnlineNow()) {
      await queueTelemetryPayload(points, 'offline');
      return;
    }
    try {
      const payload = await postTelemetryPayload(points);
      applyTelemetryResponse(payload);
      offlineFailed = false;
    } catch (error) {
      await queueTelemetryPayload(points, error instanceof Error ? error.message : 'telemetry_submit_failed');
    } finally {
      updateOfflineUi();
    }
  }
  async function telemetryTick() {
    if (!running) return;
    const position = await getLocation();
    const point = buildTelemetryPoint(position);
    telemetryBuffer.push(point);
    updateCoverageUi();
    await flushTelemetryBuffer(false);
  }
  function frameBundleSummary(frames) {
    return frames.map(function (frame, index) {
      return '#' + (index + 1)
        + ' time=' + frame.capturedAt
        + ' lat=' + Number(frame.lat).toFixed(5)
        + ' lng=' + Number(frame.lng).toFixed(5)
        + (Number.isFinite(Number(frame.locationAccuracyM)) ? ' acc=' + Math.round(Number(frame.locationAccuracyM)) + 'm' : '')
        + (Number.isFinite(Number(frame.speedMps)) ? ' speed=' + Number(frame.speedMps).toFixed(1) + 'm/s' : '')
        + (Number.isFinite(Number(frame.headingDegrees)) ? ' heading=' + Math.round(Number(frame.headingDegrees)) : '');
    }).join(' / ');
  }
  function candidateLooksWorthAi(candidate) {
    const now = Date.now();
    if (!lastAiSubmittedAt) return visualCandidates.length >= 2 || now - (sessionStartedAt || now) >= AI_MIN_INTERVAL_MS;
    const age = now - lastAiSubmittedAt;
    if (age < AI_MIN_INTERVAL_MS) return false;
    if (age >= AI_FORCE_INTERVAL_MS) return true;
    if (!candidate) return false;
    if ((candidate.metrics && candidate.metrics.diffScore >= 0.11) || (candidate.distanceFromLastAiM || 0) >= 12) return true;
    if ((candidate.headingDeltaFromLastAi || 0) >= 28) return true;
    if (localCoverageCells.size > 0 && readyScenes.size + pendingScenes.size === 0) return true;
    return false;
  }
  async function maybeSubmitRepresentativeScene(reason) {
    if (!running || !cameraOptIn || aiSubmitInFlight || !visualCandidates.length) return;
    const candidate = visualCandidates[visualCandidates.length - 1];
    if (!candidateLooksWorthAi(candidate)) return;
    aiSubmitInFlight = true;
    try {
      const bundle = visualCandidates.slice(-3);
      visualCandidates = [];
      await doAnalyse(bundle, reason || 'representative_bundle');
    } finally {
      aiSubmitInFlight = false;
    }
  }
  async function captureVisualCandidate() {
    if (!running || !cameraOptIn || !stream || !video || !video.videoWidth) return;
    try {
      const position = await getLocation();
      const metrics = captureVisualMetrics();
      const framePayload = await captureFramePayload();
      const capturedAt = new Date().toISOString();
      const distanceFromLastAiM = lastAiPosition ? Math.round(distanceMeters(lastAiPosition, position)) : null;
      const headingDeltaFromLastAi = lastAiPosition ? headingDelta(lastAiPosition.headingDegrees, position.headingDegrees) : null;
      const candidate = {
        capturedAt: capturedAt,
        lat: position.lat,
        lng: position.lng,
        locationAccuracyM: position.accuracyM,
        speedMps: position.speedMps,
        headingDegrees: position.headingDegrees,
        positionCapturedAt: position.positionCapturedAt,
        sessionDistanceM: Math.round(sessionDistanceM),
        frameBlob: framePayload.frameBlob,
        frameThumb: framePayload.frameThumb,
        facePrivacy: framePayload.facePrivacy,
        metrics: {
          brightness: metrics.brightness,
          blurScore: metrics.blurScore,
          diffScore: metrics.diffScore
        },
        distanceFromLastAiM: distanceFromLastAiM,
        headingDeltaFromLastAi: headingDeltaFromLastAi,
        reason: 'visual_sample_5s'
      };
      visualCandidates.push(candidate);
      if (visualCandidates.length > 5) visualCandidates = visualCandidates.slice(-5);
      await maybeSubmitRepresentativeScene('visual_sample');
    } catch (error) {
      console.error('Guide visual candidate error', error);
    }
  }
  function startGuideSampling() {
    stopGuideSampling();
    sessionStartedAt = Date.now();
    lastTelemetrySentAt = 0;
    lastAiSubmittedAt = 0;
    lastAiPosition = null;
    visualCandidates = [];
    telemetryBuffer = [];
    updateCoverageUi();
    void telemetryTick();
    telemetryTimer = window.setInterval(function () { void telemetryTick(); }, TELEMETRY_INTERVAL_MS);
    if (cameraOptIn) {
      visualSampleTimer = window.setInterval(function () { void captureVisualCandidate(); }, VISUAL_SAMPLE_INTERVAL_MS);
      window.setTimeout(function () { void captureVisualCandidate(); }, 1200);
    }
  }
  function stopGuideSampling() {
    clearTimeout(analyseTimer);
    if (telemetryTimer) clearInterval(telemetryTimer);
    if (visualSampleTimer) clearInterval(visualSampleTimer);
    analyseTimer = null;
    telemetryTimer = null;
    visualSampleTimer = null;
  }
  function buildAudioPayload(blob, fingerprint, vad, quality) {
    const measuredDurationMs = Number(quality && quality.measuredDurationMs) || AUDIO_CHUNK_TARGET_MS;
    return {
      externalId: newQueueId('guide-audio'),
      sessionId: sessionId,
      recordedAt: new Date().toISOString(),
      durationSec: Math.round(measuredDurationMs / 100) / 10,
      lat: lastKnownPosition.lat,
      lng: lastKnownPosition.lng,
      filename: 'guide-audio.webm',
      mimeType: blob.type || preferredMime,
      meta: {
        captureProfile: 'opus_mono_24khz_32kbps_2s',
        audioFingerprint: fingerprint,
        clientVadResult: vad,
        clientAudioQuality: quality,
        locationQuality: {
          accuracyM: lastKnownPosition.accuracyM,
          speedMps: lastKnownPosition.speedMps,
          headingDegrees: lastKnownPosition.headingDegrees,
          positionCapturedAt: lastKnownPosition.positionCapturedAt,
          sessionDistanceM: Math.round(sessionDistanceM)
        }
      }
    };
  }
  async function postAudioPayload(payload, audioBlob) {
    const base64Data = await blobToBase64(audioBlob);
    const response = await fetch(BASE + '/api/v1/fieldscan/audio/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, base64Data: base64Data })
    });
    if (!response.ok) throw new Error('audio_submit_failed_' + response.status);
    return response.json();
  }
  async function queueAudioPayload(payload, audioBlob, reason) {
    return enqueueOfflineItem({
      id: payload.externalId,
      type: 'audio',
      externalId: payload.externalId,
      sessionId: payload.sessionId,
      recordedAt: payload.recordedAt,
      durationSec: payload.durationSec,
      lat: payload.lat,
      lng: payload.lng,
      filename: payload.filename,
      mimeType: payload.mimeType,
      meta: payload.meta,
      audioBlob: audioBlob,
      lastError: reason || null,
      createdAt: Date.now()
    });
  }
  async function uploadAudioChunk(blob, fingerprint, vad, quality) {
    if (!blob || !blob.size || !preferredMime) return;
    const payload = buildAudioPayload(blob, fingerprint, vad, quality);
    try {
      if (!isOnlineNow()) {
        await queueAudioPayload(payload, blob, 'offline');
        if (!cameraOptIn) audioOnlyChunkCount += 1;
        return;
      }
      await postAudioPayload(payload, blob);
      offlineFailed = false;
      if (!cameraOptIn) audioOnlyChunkCount += 1;
      if (sessionSummary && !sessionSummary.hidden) showSessionSummary();
    } catch (error) {
      console.error('Audio upload error', error);
      const queued = await queueAudioPayload(payload, blob, error instanceof Error ? error.message : 'audio_submit_failed');
      if (queued && !cameraOptIn) audioOnlyChunkCount += 1;
    } finally {
      scheduleRecapRefresh();
      updateOfflineUi();
    }
  }
  async function replayOfflineItem(item) {
    if (item.type === 'scene') {
      const sceneRes = await postScenePayload({
        clientSceneId: item.clientSceneId,
        sessionId: item.sessionId,
        capturedAt: item.capturedAt,
        lat: item.lat,
        lng: item.lng,
        locationAccuracyM: item.locationAccuracyM,
        speedMps: item.speedMps,
        headingDegrees: item.headingDegrees,
        positionCapturedAt: item.positionCapturedAt,
        sessionDistanceM: item.sessionDistanceM,
        lang: item.lang,
        guideMode: item.guideMode || 'walk',
        frameThumb: item.frameThumb,
        frameBlob: item.frameBlob,
        frames: item.frames || null,
        frameBundleSummary: item.frameBundleSummary || null,
        visualCandidate: item.visualCandidate || null,
        facePrivacy: item.facePrivacy || null,
        audioBlob: item.audioBlob || null,
        audioMimeType: item.audioMimeType || null,
        audioPrivacySkippedCount: item.audioPrivacySkippedCount || 0,
        audioPrivacyPolicy: item.audioPrivacyPolicy || 'exclude_speech_likely_chunks'
      });
      handleAcceptedScene(sceneRes);
      return;
    }
    if (item.type === 'audio') {
      await postAudioPayload({
        externalId: item.externalId,
        sessionId: item.sessionId,
        recordedAt: item.recordedAt,
        durationSec: item.durationSec,
        lat: item.lat,
        lng: item.lng,
        filename: item.filename,
        mimeType: item.mimeType,
        meta: item.meta
      }, item.audioBlob);
    }
    if (item.type === 'telemetry') {
      const payload = await postTelemetryPayload(Array.isArray(item.points) ? item.points : []);
      applyTelemetryResponse(payload);
    }
  }
  async function drainOfflineQueue() {
    if (offlineSyncing || !isOnlineNow()) {
      updateOfflineUi();
      return;
    }
    offlineSyncing = true;
    offlineFailed = false;
    updateOfflineUi();
    try {
      const items = await readAllOfflineItems();
      items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      const hadItems = items.length > 0;
      for (const item of items) {
        if (!isOnlineNow()) break;
        try {
          await replayOfflineItem(item);
          await deleteOfflineItem(item.id);
          removeAppOutboxItem(item.id);
        } catch (error) {
          offlineFailed = true;
          await markOfflineItemError(item, error);
          break;
        }
      }
      if (hadItems && !offlineFailed && isOnlineNow()) offlineLastSynced = true;
    } catch (error) {
      offlineFailed = true;
      console.error('Guide offline sync error', error);
    } finally {
      offlineSyncing = false;
      await refreshQueueStatus();
      scheduleRecapRefresh();
    }
  }
  async function handleAudioChunk(blob, chunkMeta) {
    if (!blob || !blob.size) return;
    const fingerprint = summarizeFrames();
    const vad = classifySpeech(fingerprint);
    if (vad.speechLikely) {
      clientPrivacySkippedCount += 1;
      sceneAudioPrivacySkippedCount += 1;
      if (privacyLive) {
        privacyLive.hidden = false;
        privacyLive.textContent = copy.voiceExcludedNotice;
      }
      scheduleRecapRefresh();
      return;
    }
    const quality = await validateAudioChunkQuality(blob, chunkMeta);
    if (!quality.ok) {
      console.info('Guide audio chunk rejected by quality gate', quality.reason);
      scheduleRecapRefresh();
      return;
    }
    sceneAudioChunks = [blob];
    void uploadAudioChunk(blob, fingerprint, vad, quality.quality);
  }
  async function doAnalyse(frameBundle, reason) {
    if (!running) return;
    setStatus(copy.analysing);
    setNowState(copy.analysing);
    setNextAction(copy.nowNextAnalysing);
    try {
      const bundle = Array.isArray(frameBundle) && frameBundle.length ? frameBundle : null;
      lastKnownPosition = bundle ? {
        lat: bundle[bundle.length - 1].lat,
        lng: bundle[bundle.length - 1].lng,
        accuracyM: bundle[bundle.length - 1].locationAccuracyM,
        speedMps: bundle[bundle.length - 1].speedMps,
        headingDegrees: bundle[bundle.length - 1].headingDegrees,
        positionCapturedAt: bundle[bundle.length - 1].positionCapturedAt,
        stale: false,
        source: 'visualCandidate'
      } : await getLocation();
      const framePayload = bundle ? bundle[bundle.length - 1] : await captureFramePayload();
      const capturedAt = new Date().toISOString();
      const audioBlob = captureAudioBlobForScene();
      const audioPrivacySkippedCount = sceneAudioPrivacySkippedCount;
      sceneAudioPrivacySkippedCount = 0;
      const lang = getLang();
      const sceneRes = await submitScenePayload({
          clientSceneId: newQueueId('guide-scene'),
          sessionId,
          capturedAt,
          lat: lastKnownPosition.lat,
          lng: lastKnownPosition.lng,
          locationAccuracyM: lastKnownPosition.accuracyM,
          speedMps: lastKnownPosition.speedMps,
          headingDegrees: lastKnownPosition.headingDegrees,
          positionCapturedAt: lastKnownPosition.positionCapturedAt,
          sessionDistanceM: Math.round(sessionDistanceM),
          lang,
          guideMode: getGuideMode(),
          frameThumb: framePayload.frameThumb,
          frameBlob: framePayload.frameBlob,
          frames: bundle,
          frameBundleSummary: bundle ? frameBundleSummary(bundle) : null,
          visualCandidate: bundle ? {
            capturedAt: framePayload.capturedAt,
            brightness: framePayload.metrics && framePayload.metrics.brightness,
            blurScore: framePayload.metrics && framePayload.metrics.blurScore,
            diffScore: framePayload.metrics && framePayload.metrics.diffScore,
            distanceFromLastAiM: framePayload.distanceFromLastAiM,
            headingDeltaFromLastAi: framePayload.headingDeltaFromLastAi,
            reason: reason || framePayload.reason || 'representative_bundle'
          } : null,
          facePrivacy: framePayload.facePrivacy,
          audioBlob,
          audioPrivacySkippedCount,
          audioPrivacyPolicy: 'exclude_speech_likely_chunks'
      });
      lastAiSubmittedAt = Date.now();
      lastAiPosition = {
        lat: lastKnownPosition.lat,
        lng: lastKnownPosition.lng,
        headingDegrees: lastKnownPosition.headingDegrees
      };
      handleAcceptedScene(sceneRes);
      setStatus('');
      setNowState('');
    } catch (e) {
      console.error('Guide analyse error', e);
      setStatus('');
      setNowState('');
    }
    scheduleRecapRefresh();
  }
  async function analyseSelectedPhoto(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) return;
    setNowState(copy.photoAnalysing);
    if (nowWrap) nowWrap.hidden = false;
    if (photoBtn) photoBtn.disabled = true;
    try {
      lastKnownPosition = await getLocation();
      const frames = await buildGuideFramesFromFile(file);
      const capturedAt = new Date().toISOString();
      const lang = getLang();
      const sceneRes = await submitScenePayload({
          clientSceneId: newQueueId('guide-scene'),
          sessionId,
          capturedAt,
          lat: lastKnownPosition.lat,
          lng: lastKnownPosition.lng,
          locationAccuracyM: lastKnownPosition.accuracyM,
          speedMps: lastKnownPosition.speedMps,
          headingDegrees: lastKnownPosition.headingDegrees,
          positionCapturedAt: lastKnownPosition.positionCapturedAt,
          sessionDistanceM: Math.round(sessionDistanceM),
          lang,
          guideMode: getGuideMode(),
          frameThumb: frames.frameThumb,
          frameBlob: frames.frameBlob,
          facePrivacy: frames.facePrivacy,
          audioBlob: null,
          audioPrivacySkippedCount: 0,
          audioPrivacyPolicy: 'photo_fallback_no_audio'
      });
      handleAcceptedScene(sceneRes);
    } catch (error) {
      console.error('Guide photo fallback error', error);
    } finally {
      setNowState('');
      if (photoBtn) photoBtn.disabled = false;
    }
  }
  async function watchScene(sceneId) {
    if (!('EventSource' in window)) {
      void pollScene(sceneId, 0);
      return;
    }
    try {
      const pos = await getLocation();
      const params = new URLSearchParams({ currentLat: String(pos.lat), currentLng: String(pos.lng) });
      const source = new EventSource(BASE + '/api/v1/guide/scene/' + encodeURIComponent(sceneId) + '/events?' + params.toString());
      let closed = false;
      const close = function () {
        closed = true;
        source.close();
      };
      source.addEventListener('ready', function (event) {
        const scene = JSON.parse(event.data || '{}');
        pendingScenes.delete(sceneId);
        lastScene = scene;
        renderReadyDiscovery(scene);
        close();
      });
      source.addEventListener('scene-error', function () {
        pendingScenes.delete(sceneId);
        const item = document.getElementById('scene-' + sceneId);
        if (item) item.remove();
        updateTrailPill();
        close();
      });
      source.addEventListener('timeout', function () {
        close();
        void pollScene(sceneId, 0);
      });
      source.onerror = function () {
        if (closed || !pendingScenes.has(sceneId)) return;
        close();
        void pollScene(sceneId, 0);
      };
    } catch (error) {
      console.error('Guide scene stream error', error);
      void pollScene(sceneId, 0);
    }
  }
  async function pollScene(sceneId, attempt) {
    if (!pendingScenes.has(sceneId) || attempt > 24) {
      updateTrailPill();
      return;
    }
    const delay = attempt < 3 ? 1000 : 1800;
    await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      const pos = await getLocation();
      const params = new URLSearchParams({ currentLat: String(pos.lat), currentLng: String(pos.lng) });
      const response = await fetch(BASE + '/api/v1/guide/scene/' + encodeURIComponent(sceneId) + '?' + params.toString());
      if (!response.ok) throw new Error('scene poll ' + response.status);
      const scene = await response.json();
      if (scene.status === 'ready') {
        pendingScenes.delete(sceneId);
        lastScene = scene;
        renderReadyDiscovery(scene);
        return;
      }
      if (scene.status === 'error') {
        pendingScenes.delete(sceneId);
        const item = document.getElementById('scene-' + sceneId);
        if (item) item.remove();
        updateTrailPill();
        return;
      }
    } catch (error) {
      console.error('Guide scene poll error', error);
    }
    void pollScene(sceneId, attempt + 1);
  }
  async function prepareLiveAssist() {
    try {
      const response = await fetch(BASE + '/api/v1/guide/live-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: getLang() })
      });
      if (!response.ok) return;
      liveAssistToken = await response.json();
    } catch (error) {
      liveAssistToken = null;
    }
  }
  function showPrivacyNotice(message) {
    if (!privacyLive) return;
    privacyLive.hidden = false;
    privacyLive.textContent = message;
  }
  function selectedChoice(name, fallback) {
    const checked = document.querySelector('input[name="' + name + '"]:checked');
    return checked && checked.value ? checked.value : fallback;
  }
  function openStartSheet() {
    if (!startSheet) return;
    if (startSheetLive) startSheetLive.textContent = '';
    startSheet.hidden = false;
    const first = startSheet.querySelector('input[name="guide-mission-choice"]');
    if (first && typeof first.focus === 'function') first.focus();
  }
  function closeStartSheet() {
    if (startSheet) startSheet.hidden = true;
  }
  function setRadioChoice(name, value) {
    const target = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (target) target.checked = true;
  }
  function applyMissionPreset(mission) {
    if (mission === 'sound') {
      setRadioChoice('guide-camera-choice', 'off');
      setRadioChoice('guide-audio-choice', 'on');
    } else if (mission === 'spot') {
      setRadioChoice('guide-camera-choice', 'on');
      setRadioChoice('guide-audio-choice', 'on');
    } else {
      setRadioChoice('guide-camera-choice', 'on');
      setRadioChoice('guide-audio-choice', 'off');
    }
    if (startSheetLive) startSheetLive.textContent = '';
  }
  function applyRecommendedSettings() {
    setRadioChoice('guide-camera-choice', 'on');
    setRadioChoice('guide-audio-choice', 'on');
    if (startSheetLive) startSheetLive.textContent = '';
  }
  function sessionCounts() {
    const savedIds = new Set(manuallySavedSceneIds);
    let skipped = 0;
    readyScenes.forEach((scene, sceneId) => {
      const state = scene && scene.autoSave ? scene.autoSave.state : '';
      if (state === 'saved') savedIds.add(sceneId);
      if ((state === 'skipped' || state === 'error') && !savedIds.has(sceneId)) skipped += 1;
    });
    return { saved: savedIds.size, skipped, audioOnly: audioOnlyChunkCount, queued: offlineQueuedCount };
  }
  function sessionInsights(counts) {
    const tokens = [];
    readyScenes.forEach((scene) => {
      trailFeatureTokens(scene).forEach((token) => tokens.push(token));
    });
    const seen = Array.from(new Set(tokens)).slice(0, 4).join(' / ');
    const weakAxes = coverageWeakAxes().join(' / ');
    const latestNext = lastScene && lastScene.nextLookTarget ? lastScene.nextLookTarget : '';
    const skippedHint = counts.skipped > 0
      ? (getLang() === 'ja' ? '保存しなかった場面は、近い特徴と周辺環境を分けて撮ると残しやすいです。' : 'For skipped scenes, capture one close feature and the surrounding context separately.')
      : '';
    return {
      today: seen || copy.sessionSummaryTodayEmpty,
      evidence: skippedHint || (weakAxes ? (getLang() === 'ja' ? '次に薄いところ: ' : 'Thin next: ') + weakAxes : copy.sessionSummaryEvidenceEmpty),
      next: latestNext || copy.sessionSummaryNextEmpty,
    };
  }
  function showSessionSummary() {
    if (!sessionSummary) return;
    const counts = sessionCounts();
    const insights = sessionInsights(counts);
    if (summarySaved) summarySaved.textContent = String(counts.saved);
    if (summarySkipped) summarySkipped.textContent = String(counts.skipped);
    if (summaryAudioOnly) summaryAudioOnly.textContent = String(counts.audioOnly);
    if (summaryQueued) summaryQueued.textContent = String(counts.queued);
    if (summaryToday) summaryToday.textContent = insights.today;
    if (summaryEvidence) summaryEvidence.textContent = insights.evidence;
    if (summaryNext) summaryNext.textContent = insights.next;
    const isEmpty = counts.saved === 0 && counts.skipped === 0 && counts.audioOnly === 0 && counts.queued === 0;
    if (summaryEmpty) summaryEmpty.hidden = !isEmpty;
    sessionSummary.hidden = false;
  }
  function stopAudioCapture() {
    if (audioSampleTimer) clearInterval(audioSampleTimer);
    if (audioSliceTimer) clearTimeout(audioSliceTimer);
    audioSampleTimer = null;
    audioSliceTimer = null;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    mediaRecorder = null;
    if (audioStream) audioStream.getTracks().forEach((track) => track.stop());
    audioStream = null;
    if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => undefined);
    audioContext = null;
    analyser = null;
    freqData = null;
    timeData = null;
    sceneAudioChunks = [];
    sceneAudioPrivacySkippedCount = 0;
    analyserFrames = [];
  }
  function updateAudioOptButton() {
    if (!audioOptBtn) return;
    audioOptBtn.textContent = audioOptIn ? copy.audioOptOutBtn : copy.audioOptInBtn;
    audioOptBtn.setAttribute('aria-pressed', audioOptIn ? 'true' : 'false');
    audioOptBtn.classList.toggle('is-on', audioOptIn);
  }
  async function startOptionalAudioCapture() {
    if (!audioOptIn) return;
    if (audioStream) return;
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      showPrivacyNotice(copy.audioUnavailableNotice);
      return;
    }
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: false }
      });
    } catch (error) {
      audioStream = null;
      audioOptIn = false;
      updateAudioOptButton();
      showPrivacyNotice(copy.audioUnavailableNotice);
      console.info('Guide microphone unavailable; continuing video-only', error);
      return;
    }
    if (!running) {
      audioStream.getTracks().forEach((track) => track.stop());
      audioStream = null;
      return;
    }
    if (window.MediaRecorder && preferredMime && audioStream.getAudioTracks().length) {
      try {
        const startStandaloneRecorderSlice = () => {
          try {
            if (!running || !audioOptIn || !audioStream || !audioStream.getAudioTracks().length) return;
            const chunks = [];
            const startedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
            const recorder = new MediaRecorder(audioStream, { mimeType: preferredMime, audioBitsPerSecond: 32000 });
            mediaRecorder = recorder;
            recorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) chunks.push(e.data);
            };
            recorder.onstop = () => {
              const stoppedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
              const durationMs = Math.max(0, stoppedAt - startedAt);
              if (mediaRecorder === recorder) mediaRecorder = null;
              if (chunks.length && running && audioStream) {
                const blob = chunks.length === 1 ? chunks[0] : new Blob(chunks, { type: recorder.mimeType || preferredMime });
                void handleAudioChunk(blob, { durationMs: durationMs });
              }
              if (running && audioOptIn && audioStream) {
                audioSliceTimer = setTimeout(startStandaloneRecorderSlice, 0);
              }
            };
            recorder.onerror = (error) => {
              console.info('Guide audio recorder slice failed', error);
            };
            recorder.start();
            audioSliceTimer = setTimeout(() => {
              if (recorder.state !== 'inactive') recorder.stop();
            }, AUDIO_CHUNK_TARGET_MS);
          } catch (error) {
            mediaRecorder = null;
            audioOptIn = false;
            updateAudioOptButton();
            showPrivacyNotice(copy.audioUnavailableNotice);
            console.info('Guide audio recording unavailable; continuing video-only', error);
          }
        };
        startStandaloneRecorderSlice();
      } catch (error) {
        mediaRecorder = null;
        audioOptIn = false;
        updateAudioOptButton();
        showPrivacyNotice(copy.audioUnavailableNotice);
        console.info('Guide audio recording unavailable; continuing video-only', error);
      }
    }
    startAnalyser();
    if (audioStream) showPrivacyNotice(cameraOptIn ? copy.audioOptInNotice : copy.audioOnlyNotice);
  }
  if (audioOptBtn) {
    audioOptBtn.addEventListener('click', () => {
      audioOptIn = !audioOptIn;
      updateAudioOptButton();
      if (audioOptIn) {
        showPrivacyNotice(copy.audioOptInNotice);
        if (running) void startOptionalAudioCapture();
      } else {
        stopAudioCapture();
        showPrivacyNotice(copy.audioOffNotice);
      }
    });
  }
  updateAudioOptButton();
  async function beginGuideFromSheet() {
    cameraOptIn = selectedChoice('guide-camera-choice', 'on') === 'on';
    audioOptIn = selectedChoice('guide-audio-choice', 'off') === 'on';
    updateAudioOptButton();
    if (!cameraOptIn && !audioOptIn) {
      if (startSheetLive) startSheetLive.textContent = copy.noSensorNotice;
      return;
    }
    closeStartSheet();
    try {
      startLocationWatch();
      if (cameraOptIn) {
        stream = await requestEnvironmentCamera();
        video.srcObject = stream;
        if (video) video.hidden = false;
        if (audioOnlyPanel) audioOnlyPanel.hidden = true;
        camWrap.classList.remove('is-audio-only');
        camWrap.hidden = false;
      } else {
        stream = null;
        if (video) video.srcObject = null;
        if (video) video.hidden = true;
        if (audioOnlyPanel) audioOnlyPanel.hidden = false;
        camWrap.classList.add('is-audio-only');
        camWrap.hidden = false;
      }
      lastKnownPosition = await getLocation();
      running = true;
      if (privacyLive) {
        privacyLive.hidden = false;
        privacyLive.textContent = cameraOptIn
          ? (audioOptIn ? copy.cameraAudioNotice : copy.cameraOnlyNotice)
          : copy.audioOnlyNotice;
      }
      setStatus(copy.started);
      setNowState(copy.started);
      setNextAction(copy.nowNextInitial);
      if (audioOptIn) void startOptionalAudioCapture();
      void prepareLiveAssist();
      if (nowWrap) nowWrap.hidden = false;
      startBtn.hidden = true;
      permMsg.hidden = true;
      if (photoFallback) photoFallback.hidden = true;
      startGuideSampling();
      scheduleRecapRefresh();
      void drainOfflineQueue();
    } catch (err) {
      stopLocationWatch();
      permMsg.hidden = false;
      if (photoFallback) photoFallback.hidden = false;
      console.error('Guide camera unavailable', err);
    }
  }
  startBtn.addEventListener('click', openStartSheet);
  if (startCancel) {
    startCancel.addEventListener('click', closeStartSheet);
  }
  if (startSheet) {
    startSheet.addEventListener('click', (event) => {
      if (event.target === startSheet) closeStartSheet();
    });
  }
  if (startConfirm) {
    startConfirm.addEventListener('click', () => {
      void beginGuideFromSheet();
    });
  }
  if (recommendedApply) {
    recommendedApply.addEventListener('click', applyRecommendedSettings);
  }
  document.querySelectorAll('input[name="guide-mission-choice"]').forEach((input) => {
    input.addEventListener('change', () => applyMissionPreset(input.value || 'quick'));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && startSheet && !startSheet.hidden) closeStartSheet();
  });
  if (photoBtn && photoInput) {
    photoBtn.addEventListener('click', () => {
      photoInput.click();
    });
    photoInput.addEventListener('change', () => {
      const file = photoInput.files && photoInput.files[0];
      if (file) void analyseSelectedPhoto(file);
      photoInput.value = '';
    });
  }
  stopBtn.addEventListener('click', () => {
    running = false;
    stopGuideSampling();
    void flushTelemetryBuffer(true);
    clearTimeout(recapTimer);
    stopLocationWatch();
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stopAudioCapture();
    stream = null;
    camWrap.hidden = true;
    camWrap.classList.remove('is-audio-only');
    if (video) video.hidden = false;
    if (audioOnlyPanel) audioOnlyPanel.hidden = true;
    if (nowWrap) nowWrap.hidden = true;
    startBtn.hidden = false;
    setStatus('');
    setNowState('');
    setNextAction('');
    showSessionSummary();
    if (privacyLive) {
      privacyLive.hidden = false;
      privacyLive.textContent = copy.stopped;
    }
    scheduleRecapRefresh();
  });
  window.addEventListener('online', () => {
    void refreshQueueStatus();
    void drainOfflineQueue();
  });
  window.addEventListener('ikimon-app-outbox-sync', () => {
    void refreshQueueStatus();
    void drainOfflineQueue();
  });
  window.addEventListener('offline', () => {
    updateOfflineUi();
  });
  void refreshQueueStatus().then(() => drainOfflineQueue());
  async function playTrailScene(scene) {
    if (!scene) return;
    const ttsRes = await fetch(BASE + '/api/v1/guide/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneSummary: [
          scene.delayedSummary || scene.summary || '',
          scene.whyInteresting || '',
          scene.nextLookTarget || ''
        ].filter(Boolean).join('\\n'),
        category: getCategory(),
        lang: getLang(),
        guideMode: getGuideMode(),
        lat: scene.lat || lastKnownPosition.lat,
        lng: scene.lng || lastKnownPosition.lng,
        detectedSpecies: scene.detectedSpecies || [],
      })
    }).then((r) => r.json());
    if (ttsRes.audioBase64) await playAudio(ttsRes.audioBase64);
  }
  async function saveTrailScene(scene, button) {
    if (!scene) return;
    const response = await fetch(BASE + '/api/v1/guide/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        lang: getLang(),
        lat: scene.lat || lastKnownPosition.lat,
        lng: scene.lng || lastKnownPosition.lng,
        locationAccuracyM: lastKnownPosition.accuracyM,
        speedMps: lastKnownPosition.speedMps,
        headingDegrees: lastKnownPosition.headingDegrees,
        positionCapturedAt: lastKnownPosition.positionCapturedAt,
        sessionDistanceM: Math.round(sessionDistanceM),
        capturedAt: scene.capturedAt,
        returnedAt: scene.returnedAt,
        currentDistanceM: scene.distanceFromCurrentM,
        frameThumb: scene.frameThumb,
        sceneHash: scene.sceneHash,
        sceneSummary: scene.delayedSummary || scene.summary || '',
        detectedSpecies: scene.detectedSpecies || [],
        detectedFeatures: scene.detectedFeatures || [],
        primarySubject: scene.primarySubject || null,
        environmentContext: scene.environmentContext || null,
        seasonalNote: scene.seasonalNote || null,
        coexistingTaxa: scene.coexistingTaxa || [],
        guideMode: getGuideMode(),
        ttsScript: null,
      })
    });
    if (!response.ok) throw new Error('guide_manual_save_failed_' + response.status);
    if (scene.sceneId) manuallySavedSceneIds.add(scene.sceneId);
    showSessionSummary();
    if (button) {
      const old = button.textContent;
      button.textContent = '✓';
      setTimeout(() => { button.textContent = old; }, 1600);
    }
  }
  listEl.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const sceneId = target.getAttribute('data-scene-id');
    if (!sceneId) return;
    const scene = readyScenes.get(sceneId);
    if (target.classList.contains('gdi-play')) {
      void playTrailScene(scene);
    } else if (target.classList.contains('gdi-save')) {
      void saveTrailScene(scene, target);
    }
  });
})();
</script>`;
}

export const GUIDE_FLOW_STYLES = `
  .guide-root { max-width: 640px; min-height: calc(100vh - 80px); margin: 0 auto; padding: 30px 16px 64px; background-image: linear-gradient(rgba(16,185,129,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,.045) 1px, transparent 1px); background-size: 56px 56px; }
  .guide-header { margin-bottom: 24px; }
  .guide-title { font-size: 32px; font-weight: 950; color: #0f172a; letter-spacing: 0; line-height: 1.12; margin: 0 0 8px; }
  .guide-subtitle { font-size: 14px; color: #475569; margin: 0; line-height: 1.7; font-weight: 700; }
  .guide-context-card { margin-top: 14px; display: grid; gap: 5px; padding: 12px 13px; border-radius: 8px; background: linear-gradient(135deg, rgba(236,253,245,.92), rgba(239,246,255,.9)); border: 1px solid rgba(5,150,105,.18); box-shadow: 0 8px 20px rgba(15,23,42,.04); }
  .guide-context-card strong { color: #064e3b; font-size: 13px; line-height: 1.35; font-weight: 950; }
  .guide-context-card p { margin: 0; color: #475569; font-size: 12px; line-height: 1.65; font-weight: 800; }
  .guide-audio-chain { margin-top: 10px; display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 10px; padding: 12px; border-radius: 8px; background: #0f172a; border: 1px solid rgba(15,23,42,.12); box-shadow: 0 10px 26px rgba(15,23,42,.08); }
  .guide-audio-chain strong { color: #fff; font-size: 13px; line-height: 1.35; font-weight: 950; }
  .guide-audio-chain p { margin: 5px 0 0; color: #cbd5e1; font-size: 12px; line-height: 1.6; font-weight: 760; }
  .guide-audio-chain ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
  .guide-audio-chain li { min-width: 0; display: grid; gap: 3px; padding: 9px; border-radius: 8px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.08); }
  .guide-audio-chain b { color: #a7f3d0; font-size: 11px; line-height: 1.2; font-weight: 950; }
  .guide-audio-chain span { color: #e2e8f0; font-size: 11px; line-height: 1.45; font-weight: 720; }
  .guide-controls { display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px; }
  .guide-privacy-row { display: grid; gap: 8px; padding: 10px 12px; border-radius: 8px; background: rgba(255,255,255,.86); border: 1px solid rgba(5,150,105,.18); box-shadow: 0 8px 20px rgba(15,23,42,.04); }
  .guide-privacy-badge { width: fit-content; display: inline-flex; align-items: center; min-height: 28px; padding: 0 10px; border-radius: 999px; background: #ecfdf5; color: #065f46; font-size: 11px; font-weight: 950; border: 1px solid rgba(5,150,105,.2); }
  .guide-privacy-note { margin: 0; font-size: 12px; color: #047857; line-height: 1.6; font-weight: 800; }
  .guide-audio-opt-btn { width: fit-content; min-height: 38px; padding: 8px 14px; border-radius: 999px; border: 1px solid rgba(15,23,42,.14); background: #fff; color: #0f172a; font-size: 12px; font-weight: 900; cursor: pointer; }
  .guide-audio-opt-btn.is-on { background: #0f172a; color: #fff; border-color: #0f172a; }
  .guide-privacy-live { margin: -4px 0 0; padding: 8px 10px; border-radius: 8px; background: rgba(254,249,195,.92); color: #854d0e; border: 1px solid rgba(202,138,4,.2); font-size: 12px; line-height: 1.55; font-weight: 850; }
  .guide-privacy-live[hidden] { display: none; }
  .guide-offline-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-height: 36px; padding: 8px 10px; border-radius: 8px; background: rgba(248,250,252,.92); border: 1px solid rgba(15,23,42,.08); color: #334155; font-size: 12px; font-weight: 900; }
  .guide-offline-row[data-state="offline"], .guide-offline-row[data-state="failed"] { background: rgba(255,247,237,.94); border-color: rgba(234,88,12,.22); color: #9a3412; }
  .guide-offline-row[data-state="syncing"] { background: rgba(239,246,255,.94); border-color: rgba(37,99,235,.18); color: #1d4ed8; }
  .guide-offline-state, .guide-offline-queued { display: inline-flex; align-items: center; min-height: 24px; border-radius: 999px; padding: 0 9px; background: rgba(255,255,255,.8); border: 1px solid rgba(15,23,42,.08); }
  .guide-offline-queued[hidden], .guide-offline-pressure[hidden] { display: none; }
  .guide-offline-pressure { flex-basis: 100%; color: #b45309; line-height: 1.5; font-weight: 850; }
  .guide-selects { display: flex; gap: 10px; flex-wrap: wrap; }
  .guide-select-label { font-size: 11px; font-weight: 900; color: #334155; text-transform: uppercase; letter-spacing: 0; display: flex; flex-direction: column; gap: 5px; }
  .guide-select { padding: 9px 12px; border-radius: 999px; border: 1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.92); font-size: 13px; font-weight: 800; color: #0f172a; cursor: pointer; box-shadow: 0 6px 16px rgba(15,23,42,.04); }
  .guide-start-btn { min-height: 56px; padding: 14px 24px; border-radius: 999px; background: #059669; color: #fff; font-size: 15px; font-weight: 950; border: none; cursor: pointer; box-shadow: 0 12px 26px rgba(5,150,105,.24); transition: transform .15s ease, box-shadow .15s ease, background .15s ease; }
  .guide-start-btn:hover { transform: translateY(-2px); background: #047857; box-shadow: 0 16px 30px rgba(5,150,105,.28); }
  .guide-start-sheet-backdrop[hidden] { display: none; }
  .guide-start-sheet-backdrop { position: fixed; inset: 0; z-index: 80; display: flex; align-items: flex-end; justify-content: center; padding: 16px; background: rgba(15,23,42,.48); backdrop-filter: blur(5px); }
  .guide-start-sheet { width: min(100%, 560px); max-height: min(86vh, 720px); overflow-y: auto; display: grid; gap: 14px; padding: 18px; border-radius: 8px; background: #fff; border: 1px solid rgba(15,23,42,.12); box-shadow: 0 24px 60px rgba(15,23,42,.28); }
  .guide-start-sheet-head { display: grid; gap: 6px; }
  .guide-start-sheet-head h2 { margin: 0; color: #0f172a; font-size: 20px; line-height: 1.28; font-weight: 950; letter-spacing: 0; }
  .guide-start-sheet-head p { margin: 0; color: #475569; font-size: 13px; line-height: 1.7; font-weight: 750; }
  .guide-recommended-card { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 13px; border-radius: 8px; background: #ecfdf5; border: 1px solid rgba(5,150,105,.22); box-shadow: inset 0 0 0 1px rgba(5,150,105,.08); }
  .guide-recommended-card strong { display: block; color: #064e3b; font-size: 13px; line-height: 1.35; font-weight: 950; }
  .guide-recommended-card p { margin: 4px 0 0; color: #065f46; font-size: 12px; line-height: 1.6; font-weight: 850; }
  .guide-recommended-card small { display: block; margin-top: 5px; color: #0f766e; font-size: 11px; line-height: 1.5; font-weight: 800; }
  .guide-recommended-apply { min-height: 40px; padding: 8px 13px; border: none; border-radius: 999px; background: #059669; color: #fff; font-size: 12px; font-weight: 950; cursor: pointer; white-space: nowrap; }
  .guide-start-choice { margin: 0; padding: 13px; border-radius: 8px; border: 1px solid rgba(15,23,42,.1); background: #f8fafc; display: grid; gap: 9px; }
  .guide-start-choice legend { padding: 0 4px; color: #0f172a; font-size: 13px; font-weight: 950; }
  .guide-start-choice p { margin: 0; color: #475569; font-size: 12px; line-height: 1.65; font-weight: 800; }
  .guide-start-choice small { color: #0f766e; font-size: 11px; line-height: 1.5; font-weight: 850; }
  .guide-start-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .guide-start-option { min-height: 48px; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(15,23,42,.14); background: #fff; color: #0f172a; font-size: 13px; font-weight: 950; cursor: pointer; }
  .guide-start-option:has(input:checked) { border-color: rgba(5,150,105,.55); background: #ecfdf5; color: #065f46; box-shadow: inset 0 0 0 1px rgba(5,150,105,.18); }
  .guide-start-option input { width: 16px; height: 16px; accent-color: #059669; flex: 0 0 auto; }
  .guide-mission-options { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .guide-mission-option { align-items: flex-start; justify-content: flex-start; min-height: 82px; text-align: left; }
  .guide-mission-option span { min-width: 0; display: grid; gap: 3px; }
  .guide-mission-option b { color: inherit; font-size: 13px; line-height: 1.25; }
  .guide-mission-option small { color: #64748b; font-size: 11px; line-height: 1.45; font-weight: 800; }
  .guide-mission-option:has(input:checked) small { color: #047857; }
  .guide-start-sheet-live { min-height: 18px; margin: -2px 0 0; color: #b45309; font-size: 12px; line-height: 1.5; font-weight: 900; }
  .guide-start-sheet-actions { display: flex; justify-content: flex-end; gap: 10px; }
  .guide-sheet-secondary, .guide-sheet-primary { min-height: 46px; padding: 10px 16px; border-radius: 999px; font-size: 13px; font-weight: 950; cursor: pointer; }
  .guide-sheet-secondary { border: 1px solid rgba(15,23,42,.14); background: #fff; color: #334155; }
  .guide-sheet-primary { border: none; background: #059669; color: #fff; box-shadow: 0 10px 24px rgba(5,150,105,.22); }
  .guide-now[hidden] { display: none; }
  .guide-now { margin-bottom: 14px; padding: 13px 14px; border-radius: 8px; background: rgba(255,255,255,.92); border: 1px solid rgba(15,23,42,.08); display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; box-shadow: 0 8px 20px rgba(15,23,42,.04); }
  .guide-now-title { margin: 0 0 4px; font-size: 13px; font-weight: 900; color: #0f172a; }
  .guide-now-hint { margin: 0; font-size: 12px; color: #64748b; line-height: 1.6; }
  .guide-now-next { margin: 8px 0 0; display: flex; gap: 7px; align-items: baseline; color: #065f46; font-size: 12px; line-height: 1.45; }
  .guide-now-next[hidden] { display: none; }
  .guide-now-next span { flex: 0 0 auto; min-height: 22px; display: inline-flex; align-items: center; border-radius: 999px; padding: 0 8px; background: #dcfce7; color: #047857; font-size: 11px; font-weight: 950; }
  .guide-now-next b { font-weight: 900; }
  .guide-now-state { min-width: 72px; text-align: right; font-size: 12px; color: #047857; font-weight: 900; }
  .guide-coverage[hidden] { display: none; }
  .guide-coverage { margin: 0 0 14px; padding: 13px 14px; border-radius: 8px; background: rgba(255,255,255,.94); border: 1px solid rgba(5,150,105,.16); box-shadow: 0 8px 20px rgba(15,23,42,.05); display: grid; gap: 11px; }
  .guide-coverage-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .guide-coverage-head h2 { margin: 0 0 3px; font-size: 14px; line-height: 1.25; font-weight: 950; color: #0f172a; letter-spacing: 0; }
  .guide-coverage-head p { margin: 0; color: #475569; font-size: 12px; line-height: 1.45; font-weight: 850; }
  .guide-coverage-badge { flex: 0 0 auto; min-height: 28px; display: inline-flex; align-items: center; padding: 0 9px; border-radius: 999px; background: #ecfdf5; color: #047857; border: 1px solid rgba(5,150,105,.18); font-size: 11px; font-weight: 950; white-space: nowrap; }
  .guide-coverage-badge[data-state="searched_not_found"] { background: #eff6ff; color: #1d4ed8; border-color: rgba(37,99,235,.18); }
  .guide-coverage-badge[data-state="absence_candidate"] { background: #fff7ed; color: #c2410c; border-color: rgba(234,88,12,.2); }
  .guide-coverage-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .guide-coverage-grid div { min-width: 0; padding: 9px; border-radius: 8px; background: #f8fafc; border: 1px solid rgba(15,23,42,.07); display: grid; gap: 2px; }
  .guide-coverage-grid strong { color: #059669; font-size: 19px; line-height: 1; font-weight: 950; }
  .guide-coverage-grid span { color: #64748b; font-size: 10.5px; line-height: 1.25; font-weight: 850; }
  .guide-coverage-hint { margin: 0; color: #0f766e; font-size: 12px; line-height: 1.55; font-weight: 850; }
  .guide-camera-wrap { position: relative; background: #0f172a; border-radius: 8px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 14px 34px rgba(15,23,42,.18); }
  .guide-camera-wrap.is-audio-only { min-height: 172px; display: grid; place-items: center; padding: 18px; background: linear-gradient(135deg, #0f172a, #164e63); }
  .guide-video { width: 100%; display: block; border-radius: 8px; height: min(68dvh, 640px); min-height: 420px; object-fit: cover; }
  .guide-video[hidden] { display: none; }
  .guide-audio-only-panel[hidden] { display: none; }
  .guide-audio-only-panel { max-width: 420px; text-align: center; color: #e0f2fe; display: grid; gap: 8px; padding: 24px 18px 52px; }
  .guide-audio-only-panel strong { color: #fff; font-size: 18px; font-weight: 950; line-height: 1.25; }
  .guide-audio-only-panel p { margin: 0; color: #bae6fd; font-size: 13px; line-height: 1.7; font-weight: 800; }
  .guide-status { position: absolute; top: 12px; left: 12px; padding: 6px 14px; border-radius: 999px; background: rgba(15,23,42,.72); color: #fff; font-size: 12px; font-weight: 800; backdrop-filter: blur(6px); }
  .guide-stop-btn { position: absolute; bottom: 12px; right: 12px; padding: 8px 16px; border-radius: 999px; background: rgba(239,68,68,.88); color: #fff; font-size: 12px; font-weight: 800; border: none; cursor: pointer; backdrop-filter: blur(6px); }
  .guide-record-btn { position: absolute; bottom: 12px; left: 12px; padding: 8px 16px; border-radius: 999px; background: rgba(16,185,129,.88); color: #fff; font-size: 12px; font-weight: 800; border: none; cursor: pointer; backdrop-filter: blur(6px); }
  .guide-permission-msg { padding: 16px; border-radius: 8px; background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.2); color: #b91c1c; font-size: 13px; font-weight: 700; margin-bottom: 20px; }
  .guide-photo-fallback[hidden] { display: none; }
  .guide-photo-fallback { margin: -6px 0 20px; padding: 14px; border-radius: 8px; background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.1); box-shadow: 0 8px 20px rgba(15,23,42,.05); display: grid; gap: 10px; }
  .guide-photo-fallback p { margin: 0; color: #475569; font-size: 12px; line-height: 1.65; font-weight: 800; }
  .guide-photo-btn { min-height: 46px; padding: 10px 16px; border-radius: 999px; border: none; background: #0f172a; color: #fff; font-size: 13px; font-weight: 900; cursor: pointer; }
  .guide-photo-btn:disabled { opacity: .62; cursor: wait; }
  .guide-session-summary[hidden] { display: none; }
  .guide-session-summary { margin: 18px 0 22px; padding: 14px; border-radius: 8px; background: rgba(255,255,255,.95); border: 1px solid rgba(15,23,42,.1); box-shadow: 0 8px 20px rgba(15,23,42,.05); display: grid; gap: 11px; }
  .guide-session-summary h2 { margin: 0; color: #0f172a; font-size: 14px; font-weight: 950; line-height: 1.35; }
  .guide-session-summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .guide-session-summary-grid div { min-width: 0; padding: 10px; border-radius: 8px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); display: grid; gap: 2px; }
  .guide-session-summary-grid strong { color: #059669; font-size: 22px; line-height: 1; font-weight: 950; }
  .guide-session-summary-grid span { color: #475569; font-size: 11px; line-height: 1.35; font-weight: 850; }
  .guide-session-summary p { margin: 0; color: #64748b; font-size: 12px; line-height: 1.55; font-weight: 800; }
  .guide-session-insights { display: grid; gap: 8px; }
  .guide-session-insights div { display: grid; gap: 3px; padding: 10px 11px; border-radius: 8px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); }
  .guide-session-insights span { color: #64748b; font-size: 11px; line-height: 1.25; font-weight: 950; }
  .guide-session-insights strong { color: #0f172a; font-size: 12px; line-height: 1.55; font-weight: 850; }
  .guide-session-results-link { width: fit-content; min-height: 38px; display: inline-flex; align-items: center; justify-content: center; padding: 8px 12px; border-radius: 999px; background: #0f172a; color: #fff; font-size: 12px; font-weight: 950; text-decoration: none; }
  .guide-discoveries { margin-top: 24px; }
  .guide-trail-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
  .guide-discoveries-title { font-size: 14px; font-weight: 900; color: #0f172a; letter-spacing: -.01em; margin: 0 0 12px; }
  .guide-trail-header .guide-discoveries-title { margin: 0; }
  .guide-trail-pill { flex: 0 0 auto; border-radius: 999px; padding: 4px 9px; background: rgba(5,150,105,.1); color: #047857; font-size: 11px; font-weight: 900; }
  .guide-discovery-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .guide-no-records { font-size: 13px; color: #94a3b8; padding: 12px 0; }
  .guide-discovery-item { display: flex; gap: 12px; padding: 12px 14px; background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.08); border-radius: 8px; box-shadow: 0 8px 20px rgba(15,23,42,.05); }
  .guide-discovery-pending { background: rgba(248,250,252,.94); }
  .guide-discovery-offline { border-color: rgba(234,88,12,.2); background: rgba(255,247,237,.94); }
  .gdi-thumb-wrap { width: 62px; height: 52px; border-radius: 7px; overflow: hidden; background: #e2e8f0; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; }
  .gdi-thumb { width: 100%; height: 100%; object-fit: cover; display: block; }
  .gdi-icon { font-size: 18px; flex-shrink: 0; }
  .gdi-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .gdi-kicker { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 10px; color: #64748b; font-weight: 800; }
  .gdi-bundle { display: inline-flex; align-items: center; min-height: 20px; padding: 0 7px; border-radius: 999px; background: rgba(5,150,105,.1); color: #047857; border: 1px solid rgba(5,150,105,.16); font-size: 10px; font-weight: 950; }
  .gdi-autosave { width: fit-content; display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; border-radius: 999px; padding: 4px 9px; font-size: 10.5px; font-weight: 900; line-height: 1.35; }
  .gdi-autosave span { white-space: nowrap; }
  .gdi-autosave em { font-style: normal; font-weight: 800; opacity: .82; }
  .gdi-autosave.is-saved { background: rgba(16,185,129,.14); color: #047857; border: 1px solid rgba(16,185,129,.22); }
  .gdi-autosave.is-skipped { background: rgba(245,158,11,.12); color: #92400e; border: 1px solid rgba(245,158,11,.22); }
  .gdi-autosave.is-error { background: rgba(239,68,68,.12); color: #991b1b; border: 1px solid rgba(239,68,68,.2); }
  .gdi-autosave.is-pending { background: rgba(148,163,184,.14); color: #475569; border: 1px solid rgba(148,163,184,.22); }
  .gdi-retry { font-size: 12px; color: #0f766e; background: rgba(236,253,245,.9); border: 1px solid rgba(16,185,129,.18); border-radius: 7px; padding: 7px 8px; line-height: 1.45; font-weight: 850; }
  .gdi-summary { font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.5; }
  .gdi-species { font-size: 11px; color: #047857; font-weight: 700; }
  .gdi-note { font-size: 12px; color: #b45309; background: rgba(245,158,11,.1); border-radius: 7px; padding: 7px 8px; line-height: 1.45; }
  .gdi-why, .gdi-next { font-size: 12px; color: #475569; line-height: 1.55; }
  .gdi-next { color: #0f766e; font-weight: 700; }
  .gdi-deferred { font-size: 11px; color: #047857; font-weight: 900; }
  .gdi-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
  .gdi-actions button { border: 1px solid rgba(15,23,42,.12); background: #fff; color: #0f172a; border-radius: 999px; padding: 7px 12px; font-size: 12px; font-weight: 800; cursor: pointer; min-height: 34px; }
  .gdi-actions .gdi-play { background: #0f172a; color: #fff; }
  .guide-audio { margin-top: 24px; display: flex; flex-direction: column; gap: 12px; }
  .guide-audio-header { display: flex; flex-direction: column; gap: 6px; }
  .guide-audio-title { margin: 0; font-size: 14px; font-weight: 900; color: #0f172a; letter-spacing: -.01em; }
  .guide-audio-note { margin: 0; font-size: 12px; color: #64748b; line-height: 1.5; }
  .guide-audio-skipped { margin: 0; font-size: 12px; color: #b45309; background: rgba(245,158,11,.10); border: 1px solid rgba(245,158,11,.16); border-radius: 8px; padding: 10px 12px; }
  .guide-audio-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .guide-audio-item { margin: 0; }
  .guide-audio-card { background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.08); border-radius: 8px; padding: 14px; box-shadow: 0 8px 20px rgba(15,23,42,.04); display: flex; flex-direction: column; gap: 10px; }
  .guide-audio-card-head { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; flex-wrap: wrap; }
  .guide-audio-card-head strong { font-size: 14px; color: #0f172a; }
  .guide-audio-card-head span { font-size: 12px; color: #0f766e; font-weight: 700; }
  .guide-audio-meta { font-size: 12px; color: #64748b; }
  .guide-audio-player { width: 100%; }
  @media (min-width: 720px) {
    .guide-start-sheet-backdrop { align-items: center; }
  }
  @media (max-width: 520px) {
    .guide-audio-chain { grid-template-columns: 1fr; }
    .guide-audio-chain ol { grid-template-columns: 1fr; }
    .guide-start-sheet-backdrop { padding: 10px; }
    .guide-start-sheet { padding: 15px; }
    .guide-recommended-card { grid-template-columns: 1fr; }
    .guide-recommended-apply { width: 100%; }
    .guide-start-options { grid-template-columns: 1fr; }
    .guide-start-sheet-actions { flex-direction: column-reverse; }
    .guide-sheet-secondary, .guide-sheet-primary { width: 100%; }
    .guide-video { height: min(70dvh, 620px); min-height: 360px; }
    .guide-coverage-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .guide-session-summary-grid { grid-template-columns: 1fr; }
  }
`;
