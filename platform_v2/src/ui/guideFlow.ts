import type { SiteLang } from "../i18n.js";
import { FACE_PRIVACY_CLIENT_SCRIPT } from "./facePrivacyScript.js";
import { escapeHtml } from "./siteShell.js";

type GuideCopy = {
  title: string;
  subtitle: string;
  startBtn: string;
  startSheetTitle: string;
  startSheetBody: string;
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

export function renderGuideFlow(basePath: string, lang: SiteLang): string {
  const c = COPY[lang];
  const cats = c.categories.map((cat) => `<option value="${escapeHtml(cat.id)}">${escapeHtml(cat.label)}</option>`).join("");
  const modes = c.modes.map((mode) => `<option value="${escapeHtml(mode.id)}">${escapeHtml(mode.label)}</option>`).join("");

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
    </div>
    <div class="guide-now-state" id="guide-now-state"></div>
  </div>

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
    sessionSummaryEmpty: ${JSON.stringify(c.sessionSummaryEmpty)},
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
  let recapTimer = null;
  let running = false;
  let lastScene = null;
  let lastKnownPosition = { lat: 35.68, lng: 139.76 };
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
  const ONLINE_ANALYSE_INTERVAL_MS = 8000;
  const OFFLINE_ANALYSE_INTERVAL_MS = 22000;
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
  const offlineRow = document.getElementById('guide-offline-row');
  const offlineState = document.getElementById('guide-offline-state');
  const offlineQueued = document.getElementById('guide-offline-queued');
  const offlinePressure = document.getElementById('guide-offline-pressure');

  function getLang() { return document.getElementById('guide-lang-select').value; }
  function getGuideMode() { return document.getElementById('guide-mode-select').value || 'walk'; }
  function getCategory() { return document.getElementById('guide-category-select').value; }
  function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }
  function setNowState(msg) { if (nowState) nowState.textContent = msg || ''; }
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
    return Number(item.byteSize || 0)
      || ((item.frameBlob && item.frameBlob.size) || 0)
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
  async function getLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: 35.68, lng: 139.76 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve({ lat: 35.68, lng: 139.76 }),
        { maximumAge: 60000, timeout: 8000 }
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
  function autoSaveView(scene) {
    const state = scene && scene.autoSave ? scene.autoSave.state : '';
    const note = getLang() === 'ja' && scene && scene.autoSave ? (scene.autoSave.note || '') : '';
    if (state === 'saved') return { cls: 'is-saved', text: copy.autoSaved, note: note || (getLang() === 'ja' ? copy.autoSaveBadge : ''), showManual: false };
    if (state === 'skipped') return { cls: 'is-skipped', text: copy.autoSkipped, note: note, showManual: true };
    if (state === 'error') return { cls: 'is-error', text: copy.autoSaveError, note: '', showManual: true };
    return { cls: 'is-pending', text: copy.autoSaveBadge, note: '', showManual: true };
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
  function renderReadyDiscovery(scene) {
    readyScenes.set(scene.sceneId, scene);
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
    const frame = await blobToBase64(payload.frameBlob);
    const audio = payload.audioBlob ? await blobToBase64(payload.audioBlob) : null;
    const response = await fetch(BASE + '/api/v1/guide/scene', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientSceneId: payload.clientSceneId,
        frame: frame,
        frameThumb: payload.frameThumb,
        facePrivacy: payload.facePrivacy || null,
        audio: audio,
        lat: payload.lat,
        lng: payload.lng,
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
      lang: payload.lang,
      guideMode: payload.guideMode || 'walk',
      frameThumb: payload.frameThumb,
      frameBlob: payload.frameBlob,
      facePrivacy: payload.facePrivacy || null,
      audioBlob: payload.audioBlob,
      audioMimeType: payload.audioBlob ? payload.audioBlob.type : null,
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
        clientAudioQuality: quality
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
        lang: item.lang,
        guideMode: item.guideMode || 'walk',
        frameThumb: item.frameThumb,
        frameBlob: item.frameBlob,
        facePrivacy: item.facePrivacy || null,
        audioBlob: item.audioBlob || null,
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
  async function doAnalyse() {
    if (!running) return;
    setStatus(copy.analysing);
    setNowState(copy.analysing);
    try {
      lastKnownPosition = await getLocation();
      const framePayload = await captureFramePayload();
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
          lang,
          guideMode: getGuideMode(),
          frameThumb: framePayload.frameThumb,
          frameBlob: framePayload.frameBlob,
          facePrivacy: framePayload.facePrivacy,
          audioBlob,
          audioPrivacySkippedCount,
          audioPrivacyPolicy: 'exclude_speech_likely_chunks'
      });
      handleAcceptedScene(sceneRes);
      setStatus('');
      setNowState('');
    } catch (e) {
      console.error('Guide analyse error', e);
      setStatus('');
      setNowState('');
    }
    scheduleRecapRefresh();
    if (running) analyseTimer = setTimeout(doAnalyse, isOnlineNow() && !storagePressureActive ? ONLINE_ANALYSE_INTERVAL_MS : OFFLINE_ANALYSE_INTERVAL_MS);
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
    const first = startSheet.querySelector('input[name="guide-camera-choice"]');
    if (first && typeof first.focus === 'function') first.focus();
  }
  function closeStartSheet() {
    if (startSheet) startSheet.hidden = true;
  }
  function setRadioChoice(name, value) {
    const target = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (target) target.checked = true;
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
  function showSessionSummary() {
    if (!sessionSummary) return;
    const counts = sessionCounts();
    if (summarySaved) summarySaved.textContent = String(counts.saved);
    if (summarySkipped) summarySkipped.textContent = String(counts.skipped);
    if (summaryAudioOnly) summaryAudioOnly.textContent = String(counts.audioOnly);
    if (summaryQueued) summaryQueued.textContent = String(counts.queued);
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
      if (audioOptIn) void startOptionalAudioCapture();
      void prepareLiveAssist();
      if (nowWrap) nowWrap.hidden = false;
      startBtn.hidden = true;
      permMsg.hidden = true;
      if (photoFallback) photoFallback.hidden = true;
      if (cameraOptIn) analyseTimer = setTimeout(doAnalyse, 5000);
      scheduleRecapRefresh();
      void drainOfflineQueue();
    } catch (err) {
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
    clearTimeout(analyseTimer);
    clearTimeout(recapTimer);
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
  .guide-start-sheet-live { min-height: 18px; margin: -2px 0 0; color: #b45309; font-size: 12px; line-height: 1.5; font-weight: 900; }
  .guide-start-sheet-actions { display: flex; justify-content: flex-end; gap: 10px; }
  .guide-sheet-secondary, .guide-sheet-primary { min-height: 46px; padding: 10px 16px; border-radius: 999px; font-size: 13px; font-weight: 950; cursor: pointer; }
  .guide-sheet-secondary { border: 1px solid rgba(15,23,42,.14); background: #fff; color: #334155; }
  .guide-sheet-primary { border: none; background: #059669; color: #fff; box-shadow: 0 10px 24px rgba(5,150,105,.22); }
  .guide-now[hidden] { display: none; }
  .guide-now { margin-bottom: 14px; padding: 13px 14px; border-radius: 8px; background: rgba(255,255,255,.92); border: 1px solid rgba(15,23,42,.08); display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; box-shadow: 0 8px 20px rgba(15,23,42,.04); }
  .guide-now-title { margin: 0 0 4px; font-size: 13px; font-weight: 900; color: #0f172a; }
  .guide-now-hint { margin: 0; font-size: 12px; color: #64748b; line-height: 1.6; }
  .guide-now-state { min-width: 72px; text-align: right; font-size: 12px; color: #047857; font-weight: 900; }
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
    .guide-start-sheet-backdrop { padding: 10px; }
    .guide-start-sheet { padding: 15px; }
    .guide-recommended-card { grid-template-columns: 1fr; }
    .guide-recommended-apply { width: 100%; }
    .guide-start-options { grid-template-columns: 1fr; }
    .guide-start-sheet-actions { flex-direction: column-reverse; }
    .guide-sheet-secondary, .guide-sheet-primary { width: 100%; }
    .guide-video { height: min(70dvh, 620px); min-height: 360px; }
    .guide-session-summary-grid { grid-template-columns: 1fr; }
  }
`;
